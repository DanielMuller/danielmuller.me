+++
author = "Daniel"
title = "Should aws-sdk be included in the bundle?"
date = 2024-12-11T20:00:00+00:00
lastmod = 2024-12-11T20:00:00+00:00
draft = false
image = "images/2024/12/package-box.png"
summary="When deploying a NodeJS application on AWS Lambda, common practice is to exclude @aws-sdk. But should we?"
categories = [
  "NodeJS",
  "Serverless"
]
tags = [
  "AWS",
  "Lambda"
]

# origin="https://serverlessguru.com/blog/diving-into-cloudfront"
+++

When deploying an application on [AWS Lambda](https://aws.amazon.com/lambda/) using the provided [NodeJS](https://nodejs.org/) [runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html), the [@aws-sdk](https://aws.amazon.com/sdk-for-javascript/) modules are already pre-packaged in the image.

Common practice is to not include this dependency when bundling your code to reduce the size of the bundled code. I came across a statement in an online discussion that this practice hurts the performance. Let's investigate if it is true or not.

## The premises

We will compare the execution time, memory usage and cold start between functions using the pre-packaged modules and function bundling the modules.

In both cases, the bundles are created using esbuild.

- NodeJS runtime: 22
- NodeJS version: v22.11.0 (at the time of writing the article)
- Architecture: amd64
- @aws-sdk version provided: 3.632.0 (at the time of writing the article)
- @aws-sdk version bundled: 3.632.0
- AWS Region: eu-central-1

The function will simply list resources of an AWS service. For each service a new @aws-sdk module is needed.

- 1 service
  - @aws-sdk/client-s3
- 3 services
  - @aws-sdk/client-s3
  - @aws-sdk/client-dynamodb
  - @aws-sdk/client-cloudfront
- 10 services
  - @aws-sdk/client-s3
  - @aws-sdk/client-dynamodb
  - @aws-sdk/client-cloudfront
  - @aws-sdk/client-cloudformation
  - @aws-sdk/client-cognito-identity
  - @aws-sdk/client-firehose
  - @aws-sdk/client-lambda
  - @aws-sdk/client-mediapackage
  - @aws-sdk/client-sns
  - @aws-sdk/client-sqs

## Results

### Packages sizes
No surprise here, by excluding the modules, the bundle size increases only slightly due to the additional code. The size increase becomes more visible when the packages are bundled.

| | Excluded | Bundled |
|--|--:|--:|
| 1 service | 75 kB | 760 kB |
| 3 services | 75 kB | 1018 kB |
| 10 services | 76 kB | 1437 kB |

The package size will impact the deployment duration (time to upload the ZIP to S3), and also the Cold Start invocations (time to download the bundle into the Lambda environment). The size are still small and this differences would be barely noticeable (as seen below).

### Execution times
In the first test, each function was invoked 100 times in sequence to ensure that the function is "hot".

In the second test, each function was re-deployed before being invoked, to ensure a "cold start".

#### Hot function

Average execution times in milliseconds:

| | Excluded | Bundled | Diff |
|--|--:|--:|--:|
| 1 service | 92.0 | 81.5 | -11.4% |
| 3 services | 829.9 | 776.7 | -6.4% |
| 10 services | 1284.2 | 1233.5 | -3.9% |

#### Cold function

Average execution times in milliseconds:

| | Excluded | Bundled | Diff |
|--|--:|--:|--:|
| 1 service | 1219.9 | 1089.3 | -10.71% |
| 3 services | 3859.1 | 3548.5 | -8.1% |
| 10 services | 5868.4 | 5849.7 | -0.3 % |

Average initStart times in milliseconds:

| | Excluded | Bundled | Diff |
|--|--:|--:|--:|
| 1 service | 374.3 | 364.2 | -2.6% |
| 3 services | 472.8 | 459.3 | -2.8% |
| 10 services | 618.4 | 596.1 | -3.6% |

## Conclusion

As we can notice, in all cases the execution time is faster when the packages are bundled. This is mainly due to iops, when bundled, your function has to load only one file (your bundle). When using the pre-installed modules, your function needs to locate, open and interpret multiples files.

The less packages included in the bundle, the bigger the difference in execution time. This difference becomes less visible when more packages are included. This is due to the fact that the time spent to open the files is smaller that the time spent executing the various tasks. Therefore it has less impact on the overall execution time.

We can also notice that the bundle size has very little impact on initStart.

The improvement in execution time is specially noticeable when only a few modules are needed. This is generally the case in a Lambda function, where you focus on a single task. You rarely need more than 2 or 3 dependencies.

With only one AWS service used (most often S3 or DynamoDB), the improvement is 10% and since you pay per millisecond of execution, this translates directly into a 10% reduction in cost.