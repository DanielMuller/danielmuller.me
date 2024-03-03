+++
author = "Daniel"
title = "Serverless Search with Lambda"
date = 2024-01-30T09:16:00+01:00
lastmod = 2024-02-22T09:16:00+01:00
draft = false
image = "images/2024/01/serverless-search.jpg"
categories = [
  "Serverless"
]
summary="Adding a search capability to your application doesn't necessarily mean using dedicated solutions. We can build a Serverless solutions that allows scaling while keeping the costs low."
tags = [
  "AWS",
  "Lambda"
]
origin="https://serverlessguru.com/blog/serverless-search-with-lambda"
+++

You want to add the capability to add a search functionality to your application, but the storage your are currently using doesn't offer an easy out-of-the-box way to address this.

You might want to be tempted to use solutions like [ElasticSearch](https://www.elastic.co/), [AWS OpenSearch](https://aws.amazon.com/opensearch-service/) or any Search Infrastructure Service, which often is the right choice.

What if your needs don't require the heavy lifting and the cost of full blown search infrastructures? Why not use a Serverless based search solution?

I had my eyes on [LunrJS](https://lunrjs.com/) since a while to provide search capabilities on a static website. LunrJS is primarily made for browser integrations, but since it also works in Node, why not integrate it with a [Lambda](https://aws.amazon.com/lambda/) function and provide search as an API?

## Pre-Build and share the indexes
Indexing the data is the most time consuming operation. We need to pre-build the indexes for each search request and store them in a shared storage.

We will be using [Amazon S3](https://aws.amazon.com/s3/) for this. We could also use [Amazon EFS](https://aws.amazon.com/efs/) for faster retrievals. But by caching the index in memory, we only get penalized on the first load.

## Memory Limits
The index is loaded into memory, but the result of a search query only returns the elements identifiers.

To return all the fields of the resulting documents, they would need to be fetched from the source. This also is loaded into memory.

Since Lambda can have a maximum of 10GB of memory, if the sizes for your index and documents exceeds Lambda's memory, this solution isn't for you.

You could retrieve the documents from the storage each time using a stream, but this will come with a latency penalty.

## The Solution
The application is separated in 2 independent parts: indexing and searching.

{{<amp-figure
src="images/2024/01/serverless-search-diagram.png"
caption="Indexing and Search are separated functionalities"
>}}

### Full Re-Index
Creating an index is a full re-index, meaning that you need to be able to scan your entire [DynamoDB](https://aws.amazon.com/dynamodb/) table and re-index all documents. This could become costly if the process is triggered on every change. You can mitigate this by running the indexing on a schedule, leaving you source data and search results out of sync during a period.

### Partial Indexing
With the help of the [lunr-mutable-indexes](https://www.npmjs.com/package/lunr-mutable-indexes) extension, we can listen to DynamoDB Streams and update our index for every row change without the need to re-index the whole dataset.

Indexes generated with _lunr-mutable-indexes_ are slightly bigger, but are directly usable by *lunr*.

## Let's build it
We will use the [serverless.com](https://serverless.com) framework to build our application. Source Code is available on [Github](https://github.com/DanielMuller/serverless-search).

We will use source files as CSV uploaded to a bucket for the searchable data.

### S3 Bucket to store sources and indexes
Using Cloudformation, we provision a bucket and enable EventBridge to allow listening to new incoming files events.

```yaml
Type: AWS::S3::Bucket
Properties:
  BucketName: serverless-search-${aws:accountId}-${aws:region}
  NotificationConfiguration:
    EventBridgeConfiguration:
      EventBridgeEnabled: true
```

### Building Index
Lambda is invoked when a new csv is uploaded to S3. Memory and Timeout are set to high values.

```yaml
handler: src/handlers/indexBuild.handler
name: ${self:service}-index-build
memorySize: 5120
timeout: 900
environment:
  BUCKET:
    Ref: S3BucketSearch
events:
  - eventBridge:
      pattern:
        source:
          - aws.s3
        detail-type:
          - Object Created
        detail:
          bucket:
            name:
              - Ref: S3BucketSearch
          object:
            key:
              - prefix: 'source/'
```

The function reads the source CSV file, converts it into JSON, builds and stores the index.

```typescript
import internal from 'stream'
import {
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3'
import csv from 'csvtojson'
import lunr from 'lunr'

const bucket = process.env.BUCKET
const indexPrefix = 'indexes/'

export const handler = async (event: S3ObjectCreatedNotificationEvent): Promise<void> => {
  const key = event.detail.object.key

  const sourceName = path.basename(key, path.extname(key))

  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  })
  const res = await client.send(command)
  if (!(res.Body instanceof internal.Readable)) {
    return
  }

  const sourceStream = res.Body

  let fields: string[] = []
  const allData = await csv()
    .on('header', (header) => {
      fields = header
    })
    .fromStream(sourceStream)

  const idx: lunr.Index = lunr(function () {
    this.ref(fields[0])
    fields.slice(1).forEach((f) => {
      this.field(f)
    })

    params.documents.forEach((document) => {
      this.add(document)
    })
  })

  await Promise.all([
    store({
      bucket,
      content: JSON.stringify(idx.toJSON()),
      filename: sourceName,
      fileType: 'idx',
    }),
    store({
      bucket,
      content: JSON.stringify(allData),
      filename: sourceName,
      fileType: 'doc',
    })
  ])
}

const store = async (params: Store): Promise<void> => {
  const s3Params: PutObjectCommandInput = {
    Bucket: params.bucket,
    Key: `${indexPrefix}${params.filename}/${params.fileType}`,
    ContentType: 'application/json',
    Body: params.content,
  }
  const command = new PutObjectCommand(s3Params)
  return client.send(command)
}
```

### Search and return results

To reduce storage access and improve latency, the index and the documents are cached in memory outside the handler top be re-used on subsequent invokes.

```typescript
const bucket = process.env.BUCKET

let idx
let documents

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2<SearchResponse>> => {
  const searchQuery = event.queryStringParameters.search
  const indexName = event.queryStringParameters.indexname

  if (!idx) {
    idx = lunr.Index.load(JSON.parse(await getFromS3({ bucket, filename: indexName, fileType: 'idx' })))
    documents = JSON.parse(await getFromS3({ bucket, filename: indexName, fileType: 'doc' }))
  }

  const queryResult = idx.search(searchQuery)

  const response = queryResult.map((item) => {
    const match = documents.find((doc) => item.ref === doc.set_id)
    if (match) {
      const enhancedMatch: SearchResponseItem = {
        ...match,
        matchInfo: {
          score: item.score,
          matchData: item.matchData,
        },
      }
      return enhancedMatch
    }
    return undefined
  })

  return response
}
```

## Let's run it

We will be using 2 datasets to showcase the solution:
- A list of [Lego Sets](https://mavenanalytics.io/data-playground?search=lego+Sets)
  - 14 fields
  - 18459 records
  - 3.8 MB
- A list of [Movies](https://www.kaggle.com/datasets/ashpalsingh1525/imdb-movies-dataset)
  - 12 fields
  - 10178 records
  - 6.5 MB
  - Contains list of actors and synopsys

### Indexing performance

|                             | Lego Sets | Movies  |
|:----------------------------|----------:|--------:|
| Items                       |  18459    |  10178  |
| CSV size                    |  3.8 MB   |  6.5 MB |
| Load source and convert     |  306 ms   |  502 ms |
| Build index                 | 5629 ms   | 7685 ms |
| Store indexes and documents | 1062 ms   | 1522 ms |
| Memory used                 |  984 MB   | 1319 MB |
| Resulting index size        |  25.8 MB  | 39.0 MB |
| Resulting Document size     |  7.0 MB   |  7.7 MB |

### Query performance
- Search Lego sets produced in 1984 in the Duplo theme
  - query: `search=+year:1984 +theme:duplo`
  - amount of results: 17
  - loading index and documents: 1927 ms (only on first load)
  - query duration: 10 ms
  - memory used: 562 MB
- Search Movies with Ryan Reynolds
  - query: `search=+ryan +reynolds`
  - amount of results: 37
  - loading index and documents: 3924 ms (only on first load)
  - query duration: 5 ms
  - memory used: 690 MB
- Search Movies with the word "extra-terrestrial" in the synopsis
  - query: `search=overview:extra-terrestrial`
  - amount of results: 17
  - loading index and documents: 3411 ms (only on first load)
  - query duration: 4 ms
  - memory used: 690 MB

As we can notice, loading the index is very slow, but twice as fast as building it. Requests using an already loaded function, don't have any latency penalty.

## Cost analysis

Let's consider the _movie_ dataset. And make the following assumptions:
- Source file updated daily (30 times a month)
- 1M search requests per month
  - 25% are fresh: 250,000
  - 75% are re-using an already loaded Lambda: 750,000

| Item | | Volume | Monthly Cost|
|-|-|-:|-:|
| S3 Storage |CSV + Index + Docs | 53.2 MB | $0.0012 |
| S3 PUT | Daily CSV + Index + Docs | 90 | $0.0005 |
| S3 GET | 250k Indexes + 250k Docs | 500000 | $0.2150 |
| Lambda Indexing | 2048 MB Memory, 10s | 30 | $0.01 |
| Lambda Search Cold | 1024 MB Memory, 5s | 250000 | $16.72 |
| Lambda Search Hot | 1024 MB Memory, 0.5s | 750000 | $1.40 |
|**Total**|||**$18.13**|

Comparing this to other available solutions from AWS:

### Amazon OpenSearch Serverless
Minimum settings: 2 indexing OCU, 2 Read OCU, 1GB storage

Total monthly cost: **$989.91**

### Amazon CloudSearch
This solution is not serverless. But managed enough to be considered as an alternative.

We need 2x `search.small` instances to provide a multi-AZ setup.

Total monthly cost: **$99.28**

## Conclusion

We successfully built a Serverless based API Search service. But not without some drawbacks.

### Pros
- The solution is able to scale to match an increase in incoming requests.
- We are only billed when a request is made.
- We don't need to manage any fleet of servers or additional services.
- Very good solution for full text search. LunrJS has support for other languages than english.
- We can improve the latency by reducing the index sizes. Indexing only the fields fields we want to search on will achieve that.

### Cons
- The solution is very primitive and can only do as much LunrJS is able.
  - There isn't any capability of numeric range search, like all Lego Sets built between 1995 and 2000.
  - Searching for "+ryan +reynolds" actually searches for documents with _ryan_ and _reynolds_. Returning "_Ryan Gosling_" and "_Burt Reynolds_".
- Index schemas should be defined depending on the source. In the case of the movies data set, we should split _crew members_ and _genres_ into an array.
- Latency for fresh Lambdas is still slow. Can be improved by reducing the index and document sizes, or using a faster storage like EFS.


