+++
author = "Daniel"
title = "Set DynamoDB TTL values on existing data"
date = 2024-10-21T18:15:00+00:00
lastmod = 2024-10-21T18:15:00+00:00
draft = false
image = "images/2024/10/dynamodb-ttl-cover.png"
categories = [
  "Serverless"
]
tags = [
  "AWS",
  "DynamoDB",
  "StepFunctions"
]

+++

You created an application using DynamoDB, once your table size grows, you realize that you didn't define a TTL. Time to solve this by defining a TTL key. But how about all the existing data, how can you backfill a value in all the fields?
<!--more-->

By default, after adding a TTL field to DynamoDB, existing records will not have any value for the field and therefore theses rows won't ever be evicted.

To solve this, we need to assign a value to every single row. This can be very cumbersome, specially if several thousands of rows are already present. There are multiple ways to solve this need. You could run a script in an [EC2](https://aws.amazon.com/ec2/) instance, use a [Glue Job](https://aws.amazon.com/glue/) or even [PartiQL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.html).


# Make use of Step Functions

In this article, we will be using an [AWS StepFunctions](https://aws.amazon.com/step-functions/) flow. This has the benefit of not needing any code by taking advantage of in-built functionalities provided by AWS.

{{<amp-figure
src="images/2024/10/dynamodb-ttl-sf.png"
caption="Step Functions Flow"
>}}

## In a nutshell
We will run 2 embedded stepFunctions.

1. We execute parallel scans on the table using `Segments`.
1. In each Segment, the table is scanned as many times needed to fetch all rows.
1. For each Item:
  - When a TTL value exists, the item is skipped
  - When no TTL value exists, the item is updated with the TTL value defined in the parameters

With this approach, we have two ways of controlling the execution speed and the table load:
1. Amount of parallel scans
1. Maximum of items returned in each scan

### Step Function Schema
```json
{
  "Comment": "DynamoDB TTL backfill",
  "StartAt": "Define Defaults",
  "States": {
    "Define Defaults": {
      "Type": "Pass",
      "Next": "Apply Defaults",
      "ResultPath": "$.inputDefaults",
      "Parameters": {
        "limit": 100,
        "scanAmount": 10,
        "scanMaxConcurreny": 300,
        "PK": "PK",
        "SK": "SK",
        "TTLKey": "expiresAt"
      }
    },
    "Apply Defaults": {
      "Type": "Pass",
      "Next": "Set Parallel Scan Segments",
      "Parameters": {
        "args.$": "States.JsonMerge($.inputDefaults, $$.Execution.Input, false)"
      },
      "ResultPath": "$.withDefaults",
      "OutputPath": "$.withDefaults.args"
    },
    "Set Parallel Scan Segments": {
      "Type": "Pass",
      "Next": "Distributed Parallel Scan",
      "Parameters": {
        "listSegments.$": "States.ArrayRange(0, States.MathAdd($.scanAmount, -1) , 1)",
        "totalSegments.$": "$.scanAmount",
        "tableName.$": "$.tableName",
        "expiresAt.$": "$.expiresAt",
        "limit.$": "$.limit",
        "PK.$": "$.PK",
        "SK.$": "$.SK",
        "TTLKey.$": "$.TTLKey"
      }
    },
    "Distributed Parallel Scan": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "EXPRESS"
        },
        "StartAt": "Scan Table",
        "States": {
          "Scan Table": {
            "Type": "Task",
            "Parameters": {
              "TableName.$": "$.tableName",
              "ProjectionExpression": "#PK, #SK, #TTLKey",
              "Limit.$": "$.limit",
              "ExclusiveStartKey.$": "$.lastEvaluatedKey",
              "Segment.$": "$.segment",
              "TotalSegments.$": "$.totalSegments",
              "ExpressionAttributeNames": {
                "#PK.$": "$.PK",
                "#SK.$": "$.SK",
                "#TTLKey.$": "$.TTLKey"
              }
            },
            "Resource": "arn:aws:states:::aws-sdk:dynamodb:scan",
            "Next": "Distributed Parallel Update",
            "ResultPath": "$.result"
          },
          "Distributed Parallel Update": {
            "Type": "Map",
            "ItemProcessor": {
              "ProcessorConfig": {
                "Mode": "DISTRIBUTED",
                "ExecutionType": "EXPRESS"
              },
              "StartAt": "Is TTL already set?",
              "States": {
                "Is TTL already set?": {
                  "Type": "Choice",
                  "Choices": [
                    {
                      "Variable": "$.States.Format('$.item.{}.N', $.TTLKey)",
                      "IsPresent": true,
                      "Comment": "TTLKey already set",
                      "Next": "End Map"
                    }
                  ],
                  "Default": "Update Item"
                },
                "End Map": {
                  "Type": "Succeed"
                },
                "Update Item": {
                  "Type": "Task",
                  "Resource": "arn:aws:states:::dynamodb:updateItem",
                  "Parameters": {
                    "TableName.$": "$.tableName",
                    "Key": {
                      "$.PK": {
                        "S.$": "States.Format('$.item.{}.S', $.PK)"
                      },
                      "$.SK": {
                        "S.$": "States.Format('$.item.{}.S', $.SK)"
                      }
                    },
                    "UpdateExpression": "SET #TTLKey = :expiresAt",
                    "ExpressionAttributeValues": {
                      ":expiresAt": {
                        "N.$": "States.Format('{}',$.expiresAt)"
                      }
                    },
                    "ExpressionAttributeNames": {
                      "#TTLKey.$": "$.TTLKey"
                    }
                  },
                  "Retry": [
                    {
                      "ErrorEquals": [
                        "States.ALL"
                      ],
                      "BackoffRate": 2,
                      "IntervalSeconds": 1,
                      "MaxAttempts": 3
                    }
                  ]
                  "End": true
                }
              }
            },
            "Next": "Has lastEvaluatedKey ?",
            "ResultPath": null,
            "Label": "DistributedExpressMap",
            "MaxConcurrency": 50,
            "ItemsPath": "$.result.Items",
            "ItemSelector": {
              "tableName.$": "$.tableName",
              "expiresAt.$": "$.expiresAt",
              "item.$": "$$.Map.Item.Value",
              "PK.$": "$.PK",
              "SK.$": "$.SK",
              "TTLKey.$": "$.TTLKey"
            },
            "ToleratedFailurePercentage": 100
          },
          "Has lastEvaluatedKey ?": {
            "Type": "Choice",
            "Choices": [
              {
                "Variable": "$.result.LastEvaluatedKey",
                "IsPresent": true,
                "Comment": "NextItem exists",
                "Next": "Build Next Input"
              }
            ],
            "Default": "End Flow"
          },
          "Build Next Input": {
            "Type": "Pass",
            "Next": "Scan Table",
            "Parameters": {
              "tableName.$": "$.tableName",
              "expiresAt.$": "$.expiresAt",
              "limit.$": "$.limit",
              "lastEvaluatedKey.$": "$.result.LastEvaluatedKey",
              "segment.$": "$.segment",
              "totalSegments.$": "$.totalSegments",
              "PK.$": "$.PK",
              "SK.$": "$.SK",
              "TTLKey.$": "$.TTLKey"
            }
          },
          "End Flow": {
            "Type": "Succeed"
          }
        }
      },
      "End": true,
      "ItemsPath": "$.listSegments",
      "ItemSelector": {
        "tableName.$": "$.tableName",
        "expiresAt.$": "$.expiresAt",
        "lastEvaluatedKey": null,
        "segment.$": "$$.Map.Item.Value",
        "totalSegments.$": "$.totalSegments",
        "limit.$": "$.limit",
        "PK.$": "$.PK",
        "SK.$": "$.SK",
        "TTLKey.$": "$.TTLKey"
      },
      "MaxConcurrency": 10
    }
  }
}
```
## Into the details
### Input
When starting the step function, we can pass some configuration:
```json
{
  "tableName": "fooBar",
  "limit": 100,
  "scanAmount": 10,
  "PK": "PK",
  "SK": "SK",
  "TTLKey": "expiresAt"
}
```
- `tableName`: mandatory, the name of the Table to update
- `expiresAt`: mandatory, the value is Unix Timestamp (seconds) at which the record should expire
- `limit`: optional (default to 100), maximum items to return in each scan
- `scanAmount`: optional (default to 10), amount of parallel scans
- `PK`: optional (default to 'PK'), name of the Partition Key
- `SK`: optional (default to 'SK'), name of the Range Key
- `TTLKey`: optional (default to 'expiresAt'), name of the TTL Key

## Step 1: Set Defaults
In the first 2 steps, we assign some defaults and overwrite them from the input.

In the 3rd step, we create a range as an array with the amounts of segments needed and we build the dynamoDB Scan parameters input.

`States.ArrayRange(0, States.MathAdd($.scanAmount, -1) , 1)`

## Step 2: Invoke a distributed map to scan
Using the array of segments generated on the previous step, the step function will execute them in parallel.

By setting `MaxConcurrency` to a different value than `10` provided in the template, we can set a high amount of parallel scans, but only execute `MaxConcurrency` at a time.

The more segments you generate and run in parallel, the more load on the table.

## Step 3: Invoke a distributed map to update
Each row returned from the scan will invoke a distributed map. The amount of parallel updates will be `amountOfScans x amountOfItems`. As you notice, this can quickly become very big. Adjust `MaxConcurrency` (set to 50 in the template) to your needs in case your table can't handle the load.

By adjusting `maxConcurrency` to a value lower than the amount of items returned by a scan, you will only update a subset in parallel before moving to the next items.

## Step 4: Updating an item
Updating an item in DynamoDB can't be done in batches and has to be done item by item. This part is the most heavy on the table. 

Therefore, only items that don't already have a value set will be updated, which allows you to run the Step Functions Workflow again in case of failure, updating only the rows missed during the first pass.

## Step 5: Scan next set of items
After updating each item in a scan result, we return into the scan step. If there are more items to scan in the segment, we return to Step 2 and retrieve the next set of items to update.

This is done until all items from a segment are retrieved.

# Performance
The performance will highly depend on the amount of items present in the table and also on the billing type of your table.

If you are using a provisioned throughput, you will need to increase it before running your workflow, even if you are using autoscaling.

If you are using an on-demand capacity, you might miss some updates due to the latency in autoscaling. Depending on the amount of items present, this can also become costly. It might be preferable to switch to Provisioned before running the Workflow and return to ON-Demand afterwards.

# Real World Experience
This workflow has been executed on a real table, with 1M items to update. After an first unsuccessful attempt with a large amount of segments and a large items returned in each scan, the ideal settings have been to control the `MaxConcurrency`. This allowed to reduce the amount of parallel updates, but still keeping the parallelism efficient enough.