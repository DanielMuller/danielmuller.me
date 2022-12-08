+++
author = "Daniel"
title = "Diving into Cloudfront"
date = 2022-11-25T09:26:32+00:00
lastmod = 2022-11-25T09:26:32+00:00
draft = true
image = "images/2022/11/cloudfront-dive.jpg"
summary = ""
categories = [
  "Security",
  "Static",
  "Serverless"
]
tags = [
  "AWS",
  "CDN",
  "Cloudfront",
  "Lambda",
  "SSO",
  "S3"
]

origin="https://serverlessguru.com/blog/diving-into-cloudfront"
+++

Cloudfront can be simply defined as a CDN (Content Delivery Network), caching your static assets in a datacenter nearer to your viewers. But Cloudfront is a lot more complex and versatile than this simple definition.

Cloudfront is a "pull" CDN, which means that you don't push your content to the CDN. The content is pulled into the CDN Edge from the Origin at the first request of any piece of content.

In addition to the traditional pull and cache usage, Cloudfront can also be used as:
- A Networking Router
- A Firewall
- A Web Server
- An Application Server

## Edges, Mid-Tier Caches and Origins
Cloudfront isn't "just" some servers in datacenters around the world. The service is a layered network of _Edge Locations_ and _Regional Edge Caches_ (or _Mid-Tier Caches_).

_Edge Locations_ are distributed around the globe with more than 400 points of presence over 90 cities across 48 countries. Each _Edge Location_ is connected to one of the 13 _Regional Edge Caches_.

_Regional Edge Caches_ are transparent to you and your visitors, you can't configure them or access them directly. Your visitors will interact with the nearest _Edge Location_, which will connect to the attached _Regional Edge Cache_ and finally to your origin. Therefore, in this article, we will refer to _Cloudfront_ as the combination of _Edge Locations_  and _Region Edge Caches_.

{{<amp-figure
src="images/2022/11/cloudfront-edges.png"
caption="Cloudfront Edge Locations, Regional Edge Caches and Origins"
>}}

Not only will the visitors benefit on download speed by retrieving content cached on the same _Edge Location_, but visitors in the same region using different _Edge Locations_ will also benefit from the content cached at the _Region Edge Cache_ level by not having the need retrieve the content from the Origin.

## Classic Pull and Cache Setup
Before diving into the deep end, let's refresh our memories with some of the basics of Cloudfront.

Cloudfront can allow write actions (POST, PUT, DELETE) but they will never be cached. We will mainly focus on the read actions (GET, HEAD, OPTIONS).

### Origin types
- HTTP/HTTPS
  - S3 Website
  - S3 Multi-Region Access Points
  - API Gateway
  - ALB
  - Any HTTP Webserver
- S3
  - S3 API
- Elemental Media Store Container
- Elemental Media Package Container

#### S3 Website or S3 API ?
Even if they look very similar, this two ways of accessing S3 are very different.

- __S3 Website__:
  - The bucket needs to be configured with website capabilities
  - Origin Domain: _bucketName_.s3-website-_region_.amazonaws.com
  - Configured as CustomOrigin
  - Pros:
    - _GET /foo/bar/_ will serve _/foo/bar/index.html_
    - Returns _404_ on file not found (if _listBucket_ is public)
  - Cons:
    - HTTP origin only
    - Files in the bucket need to be public
    - Files can be accessed by calling directly the S3-Website endpoint
- __S3 API__:
  - Origin Domain: _bucketName_.s3.amazonaws.com (or _bucketName_.s3._region_.amazonaws.com)
  - Configured as S3Origin
  - Pros:
    - HTTPS origin only
    - Files can be private and Cloudfront is granted access using [OAC](https://aws.amazon.com/blogs/networking-and-content-delivery/amazon-cloudfront-introduces-origin-access-control-oac/)
  - Cons:
    - _GET /foo/bar/_ returns 403 and not _index.html_
                
In both cases, we can overcome some of the cons:
- __S3 Website__:
  - Spoofing the _referer_ header on the origin call and using an S3 policy to enforce this header minimizes the possibility to access the bucket directly

      {{<amp-figure
        src="images/2022/11/cloudfront-s3-website-header.png"
      >}}

      ```json
      {
        "Version": "2012-10-17",
        "Id": "Cloudfront",
        "Statement": [
          {
            "Sid": "Cloudfront",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::myBucket/*",
            "Condition": {
              "StringLike": {
                "aws:Referer": "AAAAAA"
              }
            }
          }
        ]
      }
      ```
- __S3 API__:
  - Using Lambda@Edge, we can rewrite the origin URI to serve index.html (more details below).

#### S3 Multi-Region Access Points
Sadly you won't see it as a possible origin, you need to treat it as a custom HTTPS endpoint.

To allow access to the origin you need to sign all the requests with [AWS Sig4](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html) by yourself using Lambda@Edge.

#### Custom HTTP(S) origins
For any HTTP/HTTPS origin, you can configure how Cloudfront connects to it:
- Enforce HTTPS (or HTTP)
- Custom ports
- Timeouts
- Additional Headers
- ...

### Multiple Origins and Behaviors
Cloudfront can handle multiple origins. The routing is based on the request path and are configured as _behaviors_.

Each _behavior_ has it's own settings of origin to use and how to handle cache policies.

It is not uncommon to have multiple behaviors sharing the same origin to adjust caching policies for different kind of content.

{{<amp-figure
src="images/2022/11/cloudfront-behaviors.png"
caption="Combination of multiple backends and behaviors"
>}}
### Custom Domain

Cloudfront will always attach their xxxxx.cloudfront.net domain to your distribution. But you have the possibility to use your own domain by defining one or more domain aliases.

### SSL Termination

Cloudfront handles SSL terminations at the Edge. You can only attach a single SSL certificate. This certificate needs to list all domains used as aliases. Furthermore, your clients need to support SNI (all modern browser do), else you need to purchase dedicated IP addresses for your distribution.

You need to provision the certificate in _us-east-1_, which is an annoyance when working with Cloudformation and deploying to another region.

This allows to serve HTTPS traffic to your client, but connect using HTTP to the origin (S3 Website) or HTTPS on another domain (ALB, API Gateway).

### Cache Policies and Cache Key
Caching is controlled using cache policies. Each behavior has a cache policy.

The cache policy not only dictates what makes a content vary, but also sets the time an object should remain in cache and if the response should be compressed or not. Values defined as Cache Key are automatically transferred to the Origin.

Cloudfront provides a set of pre-defined set of cache policies:
- CachingOptimized: Ideal for S3 backends
  - Headers, Cookies and Query String aren't taken into consideration
  - Origin's Max-Age is used, defaults to 1 day
  - Response is compressed
- CachingDisabled:
  - Headers, Cookies and Query String aren't taken into consideration
  - Origin's Max-Age is overwritten to 0 (no cache)
  - Response is compressed
- MediaPackage: Ideal for MediaPackage origin
  - _origin_ Header is used to vary content
  - Query String parameters _aws.manifestfilter_, _start_, _end_, _m_ are used to vary content 
  - Cookies aren't taken into account
  - Origin's Max-Age is used, defaults to 1 day
  - Response is compressed

You can create your own depending on your needs, some examples:
- Visitor's Language:
  - Use the Browser's Header _Accept-Language_
- Visitor's Country:
  - Use the Header generated by Cloudfront based on the visitor's IP: _CloudFront-Viewer-Country_
- API with pagination:
  - Use the Query String Parameter _page_

Cache policies aren't linked to a specific distribution. You can re-use the same policy on different and unrelated distributions.

#### Max-Age and Cache-Control
Cloudfront will use the Origin's Max-Age (_Cache-Control_) if it is in the bounds of _min TTL_ and _max TTL_.

If the Origin's TTL is outside the defined bounds, cloudfront will overwrite it with _min TTL_ or _max TTL_.

If the Origin doesn't set any caching rule, the _Default TTL_ value will be used.

Cloudfront's behavior on TTL doesn't affect the clients behavior. The Cache-Control header from the Origin  is sent unmodified to the client.

Cloudfront might evict your object before the _Max-Age_ is reached, specially if the object isn't requested often, but it won't never keep it longer than that value.

The browser will also cache for the amount of _Max-Age_, to cache the object differently in Cloudfront, you can use a combination of _Max-Age_ and _s-maxage_. Cloudfront will cache the object for a duration of _s-maxage_ and the browser for a duration of _Max-Age_. This is useful when using _Cloudfront Functions_ to validate access token, when you want the browser to re-validate access but without having to fetch the object from the Origin.

_Max-Age_ isn't the only way to control cache, _Expires_. For more in-depth details on the usage of _Max-Age_, refer to Cloudfront's [expiration documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html).

## Extending with edge functions
Cloudfront isn't limited at only a fetching and caching statically defined resources. It gives you the ability to modify requests and responses in-flight using functions deployed and executed at the edge.

You are able to interact with the request/response in four different steps of the execution.
- __viewer-request__:
  - Triggered before the request reaches Cloudfront
  - Access to the first 40 KB of the body
  - A modified body can have a maximum size of 53.2 KB
  - Executed on each request
  - Generate a response and by-pass the Origin Request
  - Use cases:
    - Normalize headers
    - Normalize query string
    - Normalize cache keys
    - Authorization
- __origin-request__:
  - Triggered before Cloudfront calls the Origin
  - Access to the first 1 MB of the body
  - A modified body can have a maximum size of 1.33 MB
  - Executed on cache miss only
  - Generate a response and by-pass the Origin Request
  - Use cases:
    - Rewriting path or host
    - Generate cached redirects
    - Generate cached static responses
- __origin-response__:
  - Triggered before Cloudfront received the Origin response
  - No access to the body
  - Body can be generated
  - Executed on cache miss only
  - Use cases:
    - Add headers
    - Change HTTP status
    - Replace body with static content
- __viewer-response__:
  - Triggered before Cloudfront sends the response to the client
  - No access to the body
  - Body can be generated
  - Executed on each response
  - Use cases:
    - Add dynamic CORS headers

You have two solutions to interact with this requests/responses:
- __Cloudfront Functions__:
  - Executed on the Edge Location
  - Access to _viewer-request_ and _viewer-response_ only
  - Function can be deployed in any region. It's a Cloudfront Object
  - Logs are stored in Cloudwatch Logs in _us-east-1_
  - No access to body
  - Geolocation Headers available
  - Runtime: javascript (ES 5.1) with some restrictions:
    - No custom ENV variables
    - No module includes
    - No timers
    - No network access
    - No File system access
    - _Crypto_ and _QueryString_ modules are built-in
  - Cost: $0.10 / 1M executions
  - Use cases:
    - Header normalization, manipulation
    - Query String normalization
    - Cache key generation
    - Path rewrite
    - Static Authorization
- __Lambda@Edge__:
  - Executed at the Regional Edge Cache
  - Access to all 4 events
  - Function needs to be deployed to _us-east-1_ as a Lambda Function
  - Logs are stored in Cloudwatch Logs in the region of the Regional Edge Cache
  - Limited access on request body
  - 5s timeout on viewer request/response
  - 30s timeout on origin request/response
  - Geolocation Headers available
  - Runtime: NodeJS or Python with some restrictions:
    - No custom ENV variables
    - No Lambda DLQ
    - No VPC
    - No Lambda Layers
    - No Lambda Container Images
  - Cost: $0.60 / 1M executions and additionally for the execution duration. 
  - Use cases:
    - Authorization with oAuth endpoint
    - Database query
    - Body rewrite/validation

When to use which depends on the use case. If you don't need to access network resources, Cloudfront Functions is the right choice. Even if they are executed on each request (viewer-request), you would need a very good hit ratio to get cheaper with Lambda@Edge (origin-request).

Furthermore, the need to deploy Lambda@Edge to _us-east-1_ makes it a cumbersome task when you want to define your stack in a single Cloudformation template deployed to any other region than _us_east_1.

If you need to access network resources or need more memory and time to execute your code, then Lambda@Edge is the right choice.

If neither of this solutions works for you, you still can deploy Lambda and access it via API Gateway or Lambda function URL deployed in one or multiple regions and cache the result in Cloudfront.

### Event structure
Events for Lambda@Edge or Cloudfront Functions differ in some parts, mainly how headers are represented.

#### Viewer Request
__Lambda@Edge__

```json
{
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "d111111abcdef8.cloudfront.net",
          "distributionId": "EDFDVBD6EXAMPLE",
          "eventType": "viewer-request",
          "requestId": "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ=="
        },
        "request": {
          "clientIp": "203.0.113.178",
          "headers": {
            "host": [
              {
                "key": "Host",
                "value": "d111111abcdef8.cloudfront.net"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "curl/7.66.0"
              }
            ],
            "accept": [
              {
                "key": "accept",
                "value": "*/*"
              }
            ]
          },
          "method": "GET",
          "querystring": "",
          "uri": "/"
        }
      }
    }
  ]
}
```

__Cloudfront Function__

```json
{
    "version": "1.0",
    "context": {
        "distributionDomainName": "d111111abcdef8.cloudfront.net",
        "distributionId": "EDFDVBD6EXAMPLE",
        "eventType": "viewer-request",
        "requestId": "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ=="
    },
    "viewer": {
        "ip": "203.0.113.178"
    },
    "request": {
        "method": "GET",
        "uri": "/",
        "querystring": {},
        "headers": {
            "host": {
                "value": "d111111abcdef8.cloudfront.net"
            },
            "user-agent": {
                "value": "curl/7.85.0"
            },
            "accept": {
                "value": "*/*"
            }
        },
        "cookies": {}
    }
}
```
#### Origin Request
__Lambda@Edge__

```json
{
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "d111111abcdef8.cloudfront.net",
          "distributionId": "EDFDVBD6EXAMPLE",
          "eventType": "origin-request",
          "requestId": "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ=="
        },
        "request": {
          "clientIp": "203.0.113.178",
          "headers": {
            "x-forwarded-for": [
              {
                "key": "X-Forwarded-For",
                "value": "203.0.113.178"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "Amazon CloudFront"
              }
            ],
            "via": [
              {
                "key": "Via",
                "value": "2.0 2afae0d44e2540f472c0635ab62c232b.cloudfront.net (CloudFront)"
              }
            ],
            "host": [
              {
                "key": "Host",
                "value": "example.org"
              }
            ],
            "cache-control": [
              {
                "key": "Cache-Control",
                "value": "no-cache, cf-no-cache"
              }
            ]
          },
          "method": "GET",
          "origin": {
            "custom": {
              "customHeaders": {},
              "domainName": "example.org",
              "keepaliveTimeout": 5,
              "path": "",
              "port": 443,
              "protocol": "https",
              "readTimeout": 30,
              "sslProtocols": [
                "TLSv1",
                "TLSv1.1",
                "TLSv1.2"
              ]
            }
          },
          "querystring": "",
          "uri": "/"
        }
      }
    }
  ]
}
```
#### Origin Response
__Lambda@Edge__
```json
{
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "d111111abcdef8.cloudfront.net",
          "distributionId": "EDFDVBD6EXAMPLE",
          "eventType": "origin-response",
          "requestId": "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ=="
        },
        "request": {
          "clientIp": "203.0.113.178",
          "headers": {
            "x-forwarded-for": [
              {
                "key": "X-Forwarded-For",
                "value": "203.0.113.178"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "Amazon CloudFront"
              }
            ],
            "via": [
              {
                "key": "Via",
                "value": "2.0 8f22423015641505b8c857a37450d6c0.cloudfront.net (CloudFront)"
              }
            ],
            "host": [
              {
                "key": "Host",
                "value": "example.org"
              }
            ],
            "cache-control": [
              {
                "key": "Cache-Control",
                "value": "no-cache, cf-no-cache"
              }
            ]
          },
          "method": "GET",
          "origin": {
            "custom": {
              "customHeaders": {},
              "domainName": "example.org",
              "keepaliveTimeout": 5,
              "path": "",
              "port": 443,
              "protocol": "https",
              "readTimeout": 30,
              "sslProtocols": [
                "TLSv1",
                "TLSv1.1",
                "TLSv1.2"
              ]
            }
          },
          "querystring": "",
          "uri": "/"
        },
        "response": {
          "headers": {
            "access-control-allow-credentials": [
              {
                "key": "Access-Control-Allow-Credentials",
                "value": "true"
              }
            ],
            "access-control-allow-origin": [
              {
                "key": "Access-Control-Allow-Origin",
                "value": "*"
              }
            ],
            "date": [
              {
                "key": "Date",
                "value": "Mon, 13 Jan 2020 20:12:38 GMT"
              }
            ],
            "referrer-policy": [
              {
                "key": "Referrer-Policy",
                "value": "no-referrer-when-downgrade"
              }
            ],
            "server": [
              {
                "key": "Server",
                "value": "ExampleCustomOriginServer"
              }
            ],
            "x-content-type-options": [
              {
                "key": "X-Content-Type-Options",
                "value": "nosniff"
              }
            ],
            "x-frame-options": [
              {
                "key": "X-Frame-Options",
                "value": "DENY"
              }
            ],
            "x-xss-protection": [
              {
                "key": "X-XSS-Protection",
                "value": "1; mode=block"
              }
            ],
            "content-type": [
              {
                "key": "Content-Type",
                "value": "text/html; charset=utf-8"
              }
            ],
            "content-length": [
              {
                "key": "Content-Length",
                "value": "9593"
              }
            ]
          },
          "status": "200",
          "statusDescription": "OK"
        }
      }
    }
  ]
}
```

#### Viewer Response
__Lambda@Edge__

```json
{
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "d111111abcdef8.cloudfront.net",
          "distributionId": "EDFDVBD6EXAMPLE",
          "eventType": "viewer-response",
          "requestId": "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ=="
        },
        "request": {
          "clientIp": "203.0.113.178",
          "headers": {
            "host": [
              {
                "key": "Host",
                "value": "d111111abcdef8.cloudfront.net"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "curl/7.66.0"
              }
            ],
            "accept": [
              {
                "key": "accept",
                "value": "*/*"
              }
            ]
          },
          "method": "GET",
          "querystring": "",
          "uri": "/"
        },
        "response": {
          "headers": {
            "access-control-allow-credentials": [
              {
                "key": "Access-Control-Allow-Credentials",
                "value": "true"
              }
            ],
            "access-control-allow-origin": [
              {
                "key": "Access-Control-Allow-Origin",
                "value": "*"
              }
            ],
            "date": [
              {
                "key": "Date",
                "value": "Mon, 13 Jan 2020 20:14:56 GMT"
              }
            ],
            "referrer-policy": [
              {
                "key": "Referrer-Policy",
                "value": "no-referrer-when-downgrade"
              }
            ],
            "server": [
              {
                "key": "Server",
                "value": "ExampleCustomOriginServer"
              }
            ],
            "x-content-type-options": [
              {
                "key": "X-Content-Type-Options",
                "value": "nosniff"
              }
            ],
            "x-frame-options": [
              {
                "key": "X-Frame-Options",
                "value": "DENY"
              }
            ],
            "x-xss-protection": [
              {
                "key": "X-XSS-Protection",
                "value": "1; mode=block"
              }
            ],
            "age": [
              {
                "key": "Age",
                "value": "2402"
              }
            ],
            "content-type": [
              {
                "key": "Content-Type",
                "value": "text/html; charset=utf-8"
              }
            ],
            "content-length": [
              {
                "key": "Content-Length",
                "value": "9593"
              }
            ]
          },
          "status": "200",
          "statusDescription": "OK"
        }
      }
    }
  ]
}
```
__Cloudfront Function__

```json
{
    "version": "1.0",
    "context": {
        "distributionDomainName": "d111111abcdef8.cloudfront.net",
        "distributionId": "EDFDVBD6EXAMPLE",
        "eventType": "viewer-response",
        "requestId": "MmxS5hbDhc9VyOIqzmYksKesOj6n_54ycCBX4XCS5-w7OJJ5wloOAA=="
    },
    "viewer": {
        "ip": "203.0.113.178"
    },
    "request": {
        "method": "GET",
        "uri": "/",
        "querystring": {},
        "headers": {
            "host": {
                "value": "d111111abcdef8.cloudfront.net"
            },
            "user-agent": {
                "value": "curl/7.85.0"
            },
            "accept": {
                "value": "*/*"
            }
        },
        "cookies": {}
    },
    "response": {
        "statusCode": 200,
        "statusDescription": "OK",
        "headers": {
            "date": {
                "value": "Fri, 25 Nov 2022 12:33:42 GMT"
            },
            "last-modified": {
                "value": "Fri, 25 Nov 2022 12:31:12 GMT"
            },
            "etag": {
                "value": "\"b9c2e628c3ffe65db36c4d92c9aebbb3\""
            },
            "accept-ranges": {
                "value": "bytes"
            },
            "server": {
                "value": "AmazonS3"
            },
            "via": {
                "value": "1.1 dfeaaa9951aa7df30bdb3dfb8a94470a.cloudfront.net (CloudFront)"
            },
            "age": {
                "value": "82"
            },
            "content-type": {
                "value": "text/html"
            },
            "content-length": {
                "value": "109"
            }
        },
        "cookies": {}
    }
}
```

## Networking Router
Even if you don't need the caching functionalities of Cloudfront (POST requests or disabling cache on GET), you can still use Cloudfront to act as a Networking Router, by sending your visitor traffic to the nearest edge. From the edge to the origin, the performant AWS Backbone will be used instead of your ISP's peering.

By using multiples behaviors, you can route your traffic to different backends that don't need to be in the same region or even inside AWS.

{{<amp-figure
src="images/2022/11/cloudfront-networking.png"
caption="Leveraging the AWS Backbone over the ISP's Peering"
>}}

As an example, [S3 Transfer Acceleration](https://aws.amazon.com/s3/transfer-acceleration/) uses Cloudfront as the endpoint, forcing the networking path to the nearest Edge Location and leveraging the AWS backbone to reach the bucket.

## Firewall
In addition to use [AWS WAF](https://aws.amazon.com/waf/) with Cloudfront to protect your Origin application, Cloudfront also provides a default DDOS protection. You can also deny access to visitors from specific countries.

By adding [Origin Shield](https://aws.amazon.com/about-aws/whats-new/2020/10/announcing-amazon-cloudfront-origin-shield/), you add an additional layer of caching between Cloudfront and your Origin, reducing the need for Cloudfront to retrieve content from your Origin. This helps to reduce the load on your origin and improves the CDN hit ratio (and therefore download speed) for your visitors.

## Application Server
By using Lambda@Edge functions, you can directly query databases like DynamoDB and apply business logic to it, without needing any Origin.

Combining this with [DynamoDB Global Tables](https://aws.amazon.com/dynamodb/global-tables/), you can always query a table near your edge, making your application performant and reliable.

## Web Server
As seen through all the examples mentioned in this article, Cloudfront can be seen as "just" an HTTP server in front of your application.

Using functions (or Lambda@Edge) you can return redirections or static content without the need of any backend.

By using multiples behaviors, you can route your traffic to different types backends.

## Real World Use Cases
You can find the template used for the examples on [Github](https://github.com/serverless-guru/tempaltes/tree/master/cloudfront-samples).

The template provides a distribution with different backends:
- S3 Website
  - /blog/*
  - /private/*
- S3 API
  - /assets/*
  - /html/*
  - /airport/*
- API Gateway
  - /*

### Cache based on visitor's country
- Backend: Api Gateway + Lambda
- Edge function: None
- Policy: Whitelist _cloudfront-viewer-country_
  ```yaml
  Type: AWS::CloudFront::CachePolicy
  Properties:
    CachePolicyConfig:
      DefaultTTL: 10
      MinTTL: 0
      MaxTTL: 3600
      Name: Country
      ParametersInCacheKeyAndForwardedToOrigin:
        CookiesConfig:
          CookieBehavior: none
        EnableAcceptEncodingBrotli: true
        EnableAcceptEncodingGzip: true
        HeadersConfig:
          HeaderBehavior: whitelist
          Headers:
            - cloudfront-viewer-country
        QueryStringsConfig:
          QueryStringBehavior: none
  ```

__Request__:
```bash
curl -v 'https://d3h57w0cnyb350.cloudfront.net/country'

> GET /country HTTP/2
> Host: d3h57w0cnyb350.cloudfront.net
> user-agent: curl/7.85.0
> accept: */*

< HTTP/2 200 
< content-type: application/json
< content-length: 2
< date: Tue, 06 Dec 2022 17:58:23 GMT
< x-amz-cf-pop: LIS50-C1
```
__Lambda Event__:
```json
{
    "version": "2.0",
    "routeKey": "GET /country",
    "rawPath": "/country",
    "rawQueryString": "",
    "headers": {
        "accept-encoding": "br,gzip",
        "cloudfront-viewer-country": "PT",
        "content-length": "0",
        "host": "wvo7t33pz3.execute-api.eu-central-1.amazonaws.com",
        "user-agent": "Amazon CloudFront",
        "via": "2.0 592fdb72142153f4ac204b48e22d9036.cloudfront.net (CloudFront)",
        "x-amz-cf-id": "kz-vrWiS6p5lg9ZjGRCY7Xuwg2gmr5utkrJLaU62Leol8ApRIzL4nw==",
        "x-amzn-trace-id": "Root=1-638f8250-33b4ecae5ea02e382b6d5d8b",
        "x-forwarded-for": "X.X.X.X",
        "x-forwarded-port": "443",
        "x-forwarded-proto": "https"
    },
    "requestContext": {
        "accountId": "688589788262",
        "apiId": "wvo7t33pz3",
        "domainName": "wvo7t33pz3.execute-api.eu-central-1.amazonaws.com",
        "domainPrefix": "wvo7t33pz3",
        "http": {
            "method": "GET",
            "path": "/country",
            "protocol": "HTTP/1.1",
            "sourceIp": "X.X.X.X",
            "userAgent": "Amazon CloudFront"
        },
        "requestId": "cvFMihZBliAEPSw=",
        "routeKey": "GET /country",
        "stage": "$default",
        "time": "06/Dec/2022:17:56:32 +0000",
        "timeEpoch": 1670349392038
    },
    "isBase64Encoded": false
}
```

### Rewrite URI to load index.html
Nobody wants to type `/index.html` when calling a URL. Apache, Nginx and S3-Website are loading `index.html` automatically when no document is passed in the URI. When using an S3-API backend we need to provide this functionality ourselves. Cloudfront is only able to load `index.html` at the root, which is generally enough for an SPA but not for a static generated site.

#### S3-Website
- Backend: S3-Website
- Edge function: None
- Policy: managed-cacheOptimized

__Request__:
```bash
curl -v 'https://d3h57w0cnyb350.cloudfront.net/blog/articles/'

< HTTP/2 200 
< content-type: text/html
```
index.html is returned, the backend is an S3-Website and has the logic to serve index.html when document name is provided.

#### S3-API without function
- Backend: S3-API
- Edge function: None
- Policy: managed-cacheOptimized

__Request__:
```bash
curl -v 'https://d3h57w0cnyb350.cloudfront.net/assets/articles/'

< HTTP/2 403
< content-type: application/xml
```
An error is returned. The document `/assets/articles/` doesn't exist in S3.

#### S3-API with function
- Backend: S3-API
- Edge function: viewer-request Cloudfront Function
- Policy: managed-cacheOptimized

__function__:

```javascript
function handler(event) {
  var request = event.request
  var uri = request.uri
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  }
  else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
```

__Request__:
```bash
curl -v 'https://d3h57w0cnyb350.cloudfront.net/html/articles/'

< HTTP/2 200
< content-type: text/html
```
index.html is returned, we rewrite the incoming URI to append `index.html` to the request so that an existing key could be fetched from S3.

### Serve localized content
Using the browsers header `accept-language`, we are returning the content in the language requested by the viewer. The URL is the same regardless of the language, but needs to be cached according to the language. Since this header can have multiple variations, we normalize it to increase our hit ratio.

- Backend: S3-API
- Edge function: viewer-request Cloudfront Function
- Policy: Whitelist _x-locale_

__function__:
```javascript
function handler(event) {
  /*
  * Rewrite URI to serve index.html when missing
  **/
  var request = event.request

  if (request.uri.endsWith('/')) {
    request.uri += 'index.html';
  }
  else if (!request.uri.includes('.')) {
    request.uri += '/index.html';
  }

  /*
  * Set default locale
  **/
  var locale = 'en'
  var translations = ['fr', 'de']

  /*
  * Parse accept-language and extract the first value for simplicity
  * We should use all languages and use the first for which we have a translation
  **/
  if (request.headers['accept-language'] && request.headers['accept-language'].value) {
    var language = request.headers['accept-language'].value.split(',')[0].split(';')[0].substring(0,2).toLowerCase()
    if (translations.indexOf(language) > -1) {
      locale = language
    }
  }

  /*
  * Create an x-locale header to be used as part of the cache key
  **/
  request.headers['x-locale'] = {
    value: locale
  }
  /**
   * Rewrite the URI
   */
  request.uri = request.uri.replace('locale/', `locale/${locale}/`)
  return request;
}
```

__Default (English)__:
```bash
curl https://d3h57w0cnyb350.cloudfront.net/html/locale/

< x-cache: Miss from cloudfront
```
```html
<html>
  <head>
    <title>English</title>
  </head>
  <body>
    <h1>English content</h1>
  </body>
</html>
```

__French__:
```bash
curl -H "Accept-Language: fr" https://d3h57w0cnyb350.cloudfront.net/html/locale/

< x-cache: Miss from cloudfront
```
```html
<html>
  <head>
    <title>French</title>
  </head>
  <body>
    <h1>French content</h1>
  </body>
</html>
```

__Swiss-French__:
```bash
curl -H "Accept-Language: fr-CH" https://d3h57w0cnyb350.cloudfront.net/html/locale/

< x-cache: Hit from cloudfront
```
```html
<html>
  <head>
    <title>French</title>
  </head>
  <body>
    <h1>French content</h1>
  </body>
</html>
```

Even with a different `Accept-Language` header, the call for _fr-CH_ is a Hit. Both languages are normalized to _fr_.

### Protect with password
To showcase how password protection work, we will use "Basic Authentication". In a more realistic setup, we would use a [JWT token validation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-validate-token.html). In both cases, the authorization is stored inside the function's code. If this is a security concern, you would need to use a Lambda@Edge function and validate the token by calling the Authorization service.

- Backend: S3-Website
- Edge function: viewer-request Cloudfront Function
- Policy: managed-cacheOptimized

__function__:
```javascript
function handler(event) {
  var authHeaders = event.request.headers.authorization
  /**
   * Authorization string is sent by the browser as base64Encode(username:password).
   * base64Encode('private:private')='cHJpdmF0ZTpwcml2YXRl'
   */
  var expected = "Basic cHJpdmF0ZTpwcml2YXRl"
  if (authHeaders && authHeaders.value === expected) {
    return event.request
  }

  var response = {
    statusCode: 401,
    statusDescription: "Unauthorized",
    headers: {
      "www-authenticate": {
        value: "Basic realm='Enter your credentials'"
      }
    }
  }
  return response
}
```

With a valid authentication, the request is returned, instructing Cloudfront to continue by sending the request to the Origin.

Without any valid authentication, a response is returned, instructing Cloudfront to not call the Origin and directly return the response to the client.

```bash
curl -v https://d3h57w0cnyb350.cloudfront.net/private/

< HTTP/2 401 
< www-authenticate: Basic realm='Enter your credentials'
< x-cache: FunctionGeneratedResponse from cloudfront

curl -v https://private:private@d3h57w0cnyb350.cloudfront.net/private/

> authorization: Basic cHJpdmF0ZTpwcml2YXRl

< HTTP/2 200 
< content-type: text/html
```

```html
<html>
  <head>
    <title>Private</title>
  </head>
  <body>
    <h1>Private Content</h1>
  </body>
</html>
```
### Fetch content from DynamoDB
We use a Lambda@Edge function on the _origin-request_ event. We fetch data from a DynamoDB Table and return the result, bypassing the request to the Origin.

By using _origin-request_, we can cache the response in Cloudfront and trigger the function only when the result isn't already cached in Cloudfront.

- Backend: Any (not used but must be provided)
- Edge function: origin-request Lambda@Edge
- Policy: managed-cacheOptimized

__function__:
```typescript
import type { CloudFrontRequestEvent, CloudFrontResponseResult } from 'aws-lambda'
import aws from 'aws-sdk'
import https from 'https'

const documentClient = new aws.DynamoDB.DocumentClient({
  region: 'eu-central-1',
  httpOptions: {
    agent: new https.Agent({
      keepAlive: true,
    }),
  },
})

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResponseResult> => {
  const request = event.Records[0].cf.request

  try {
    const code = request.uri.split('/').slice(-1)[0]

    const data = await documentClient
      .get({
        TableName: 'demoContent',
        Key: {
          code,
        },
      })
      .promise()
    if (!(data && data.Item && data.Item.name)) {
      return notFound
    }
    return {
      status: '200',
      statusDescription: 'OK',
      body: JSON.stringify(data.Item),
      headers: {
        'content-type': [
          {
            value: 'application/json',
          },
        ],
        'cache-control': [
          {
            value: 'max-age=120',
          },
        ],
      },
    }
  } catch () {
    return notFound
  }
}

const notFound = {
  status: '404',
  statusDescription: 'Not Found',
  headers: {
    'content-type': [
      {
        value: 'application/json',
      },
    ],
    'cache-control': [
      {
        value: 'max-age=10',
      },
    ],
  },
  body: JSON.stringify({ message: 'Object Not Found' }),
}
```

```bash
curl -v "https://d3h57w0cnyb350.cloudfront.net/airport/gva"

< x-cache: Miss from cloudfront

curl -v "https://d3h57w0cnyb350.cloudfront.net/airport/gva"

< x-cache: Hit from cloudfront
```

```json
{
  "city":"Geneva",
  "code":"gva",
  "name":"Geneva International Airport",
  "country":"Switzerland"
}
```

