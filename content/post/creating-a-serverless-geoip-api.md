+++
author = "Daniel"
title = "Creating a Serverless GeoIP API"
date = 2018-05-02T22:22:17+08:00
lastmod = 2018-05-02T22:22:17+08:00
draft = false
image = "/images/2018/05/geoip.png"
categories = [
  "Internet",
  "Network",
  "Serverless"
]
tags = [
  "AWS",
  "S3",
  "NoMoreServers",
  "Lambda"
]
[amp]
  elements = ["amp-image-lightbox", "amp-social-share"]
+++
Why build a GeoIP API when you can buy it directly from [Maxmind](https://www.maxmind.com/en/geoip2-precision-city-service) or use their [GeoIP Databases](https://www.maxmind.com/en/geoip2-city)?

Using the downloadable database works well when used on an instance. When you need it inside [Lambda](https://aws.amazon.com/lambda/) or [Glue](https://aws.amazon.com/glue/), it becomes difficult to keep it up-to-date.

It becomes easier to use an external HTTP-API. Hosting it yourself reduces the response time by having it nearer to your apps and you can extend your service by combining multiples sources.

## Make it serverless
To avoid maintenance and to not have to pay for idle time, you want to have it serverless. Storage is the one part that still costs something when idle, so we need something cheap. [Lambda](https://aws.amazon.com/lambda/), [S3](https://aws.amazon.com/s3/), [S3-Select](https://aws.amazon.com/blogs/aws/s3-glacier-select/) and [API Gateway](https://aws.amazon.com/api-gateway/) are the services used for this.

{{<amp-image-lightbox id="lightbox">}}
{{<amp-figure
src="/images/2018/05/geoIP-schema.png"
title="GeoAPI-Serverless"
caption="GeoAPI-Serverless: Lambda, S3-Select, API Gateway, Cloudfront"
lightbox="lightbox"
>}}

## Storing the data
We use Lambda to download the CSV source data when there is a new update. This job is run once a month when Maxmind's data is updated.

This file comes as a ZIP and contains a range file and multiple GeoNames files. We keep only the range file and one language that we store back to S3.

Another Lambda is triggered once a new source file is stored, this Lambda will combine the original range file and the GeoNames files and create the source data.

### Queryable range file
We need to partition the data to reduce the query size. We use the the first block of digits of the IP.

To efficiently query a range, we need to convert the IP to query to a number and find to which range it belongs.
```javascript
var IpParts = IpAddress.split('.')
var IpLong = parseInt(IpParts[0])*256^3 + parseInt(IpParts[1]*256^2) + parseInt(IpParts[2])*256 + parseInt(IpParts[3])
```
To simplify, we will make use of the IP package.

The source data comes with ranges as CIDR notation (a.b.c.d/e), we need to convert it to start and end:
```javascript
const ip = require('ip')

let network = '157.23.200.0/24' // Read from range file
let subnet = ip.cidrSubnet(network)
let network_head = parseInt(network.split('.')[0]) // 157
let rangeStart = subnet.networkAddress // 157.23.200.0
let rangeEnd = subnet.broadcastAddress // 157.23.200.255
let network_range_start = ip.toLong(rangeStart) // 2635581440
let network_range_end = ip.toLong(rangeEnd) // 2635581695
...
```

After combining this data with the GeoNames values and converting to JSON, we have this line:

```json
{
  "network_head": 157,
  "network_range_start": 2635581440,
  "network_range_end": 2635581695,"%s.gz" %
  "updated_at":1525279354,
  "valid_until":1525521600,
  "data": {
    "continent": {
      "code": "EU",
      "name": "Europe"
    },
    "country": {
      "code": "FR",
      "name": "France",
      "is_eu": true
    },
    "city": {
      "name": "Paris",
      "metro_code": "",
      "postal_code": "75001"
    },
    "subdivision_1": {
      "iso_code": "IDF",
      "name": "Île-de-France"
    },
    "subdivision_2": {
      "iso_code": "75",
      "name": "Paris"
    },
    "location": {
      "geo_point": {
        "type": "Point",
        "coordinates": [
          2.3292,
          48.8628
        ]
      },
      "accuracy_radius": 20
    },
    "time_zone": "Europe/Paris"
  },
}
```
This line is appended to the partition *db/157*.

The partitions are compressed and stored in S3: *s3://mybucket/db/GeoLite2-City/157.gz*

## Querying the data
To query the data, we use a Lambda function invoked through API Gateway with the IP address to query and the database to use as arguments:
```bash
curl https://ipdb.example.com/157.23.200.32/city
```

```python
ip_request = event['pathParameters']['ip']
db_type = event['pathParameters']['dbType']
if db_type == 'city':
    db_edition = 'GeoLite2-City'
```

We retrieve the IP's "network head" and convert the IP to a number:
```python
import ipaddress
network_head = ip_request.split('.')[0]
ip_long = int(ipaddress.ip_address(ip_request))
```

We use [S3-Select](https://aws.amazon.com/blogs/aws/s3-glacier-select/) to fetch the exact data line we need:
```python
import os
import boto3
key = "%s.gz" % os.path.join('db', db_edition, network_head)

expression = "select * from s3object s where s.network_range_start<=%s \
and s.network_range_end>=%s" % (ip_long, ip_long)

query_result = S3.select_object_content(
    Bucket='mybucket',
    Key=key,
    ExpressionType='SQL',
    Expression=expression,
    InputSerialization={'JSON': {'Type': 'LINES'}, 'CompressionType': 'GZIP'},
    OutputSerialization={'JSON': {}},
)
records = json.dumps({
    "data": {}
})
for s3event in query_result['Payload']:
    if 'Records' in s3event:
        records = s3event['Records']['Payload'].decode('utf-8')
        break

return json.loads(records)

```

## The code
We used [serverless.com](https://www.serverless.com) to orchestrate the pieces. You can download the code from Github: https://github.com/Spuul/geoip-serverless

## Protect the API
Since you are only allowed to use the Maxmind data for your own infrastructure, you need to protect the access. For that we use the `x-api-key` header provided by Api Gateway.

To reduce the load on the API and the amount of S3 queries, we cache the queries. To have a better control over the caching mechanism (custom cache-control headers), we won't use API Gateway's cache, but use our own [Cloudfront](https://aws.amazon.com/cloudfront/) distribution.

## The result
First call is a bit slow, Lambda needs to spawn and the query to S3 needs to be made.

```bash
$ cat curl-timing.txt
time_namelookup:  %{time_namelookup}\n
   time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
  time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
                ----------\n
     time_total:  %{time_total}\n

$ curl -w "@curl-timing.txt" -H "x-api-key: XXXXXXXX" -s -v "https://myipservice.example.com/157.23.200.32/city"
< X-Cache: Miss from cloudfront
{"continent": {"code": "EU", "name": "Europe"}, "country": {"code": "FR", "name": "France", "is_eu": true}, "city": {"name": "Paris", "metro_code": "", "postal_code": "75001"}, "subdivision_1": {"iso_code": "IDF", "name": "\u00cele-de-France"}, "subdivision_2": {"iso_code": "75", "name": "Paris"}, "location": {"geo_point": {"type": "Point", "coordinates": [2.3292, 48.8628]}, "accuracy_radius": 20}, "time_zone": "Europe/Paris"}
time_namelookup:  0.004130
   time_connect:  0.006398
time_appconnect:  0.019093
time_pretransfer:  0.019134
  time_redirect:  0.000000
time_starttransfer:  1.236681
                ----------
     time_total:  1.236967
```
Second call for the same IP will leverage Cloudfront cache:
```bash
$ curl -w "@curl-timing.txt" -H "x-api-key: XXXXXXXX" -s -v "https://myipservice.example.com/157.23.200.32/city"
< X-Cache: Hit from cloudfront
{"continent": {"code": "EU", "name": "Europe"}, "country": {"code": "FR", "name": "France", "is_eu": true}, "city": {"name": "Paris", "metro_code": "", "postal_code": "75001"}, "subdivision_1": {"iso_code": "IDF", "name": "\u00cele-de-France"}, "subdivision_2": {"iso_code": "75", "name": "Paris"}, "location": {"geo_point": {"type": "Point", "coordinates": [2.3292, 48.8628]}, "accuracy_radius": 20}, "time_zone": "Europe/Paris"}
time_namelookup:  0.012311
   time_connect:  0.014386
time_appconnect:  0.025544
time_pretransfer:  0.025580
  time_redirect:  0.000000
time_starttransfer:  0.027953
                ----------
     time_total:  0.028005
```
A call for a new IP will not use Cloudfront but will leverage the already spawn Lambda:
```bash
$ curl -w "@curl-timing.txt" -H "x-api-key: XXXXXXXX" -s -v "https://myipservice.example.com/157.23.200.33/city"
< X-Cache: Miss from cloudfront
{"continent": {"code": "EU", "name": "Europe"}, "country": {"code": "FR", "name": "France", "is_eu": true}, "city": {"name": "Paris", "metro_code": "", "postal_code": "75001"}, "subdivision_1": {"iso_code": "IDF", "name": "\u00cele-de-France"}, "subdivision_2": {"iso_code": "75", "name": "Paris"}, "location": {"geo_point": {"type": "Point", "coordinates": [2.3292, 48.8628]}, "accuracy_radius": 20}, "time_zone": "Europe/Paris"}
time_namelookup:  0.012263
   time_connect:  0.014462
time_appconnect:  0.026965
time_pretransfer:  0.027003
  time_redirect:  0.000000
time_starttransfer:  0.538435
                ----------
     time_total:  0.538682
```
