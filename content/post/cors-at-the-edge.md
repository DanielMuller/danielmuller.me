+++
author = "Daniel"
title = "Cors at the Edge"
date = 2018-11-15T08:06:48+08:00
lastmod = 2018-11-15T08:06:48+08:00
draft = false
Excerpt = "With the raise of API driven apps, CORS is becoming an unavoidable subject. By adding a CDN, your CORS rules become a burden on caching."
categories = [
  "Internet"
]
tags = [
  "AWS",
  "CDN",
  "Cloudfront",
  "Lambda"
]
[amp]
  elements = ["amp-social-share"]
+++

With the raise of API driven apps, CORS is becoming an unavoidable subject.

The easy way to allow Cross-Domain Javascript requests, is to define your CORS headers allowing anybody on your [Nginx](https://enable-cors.org/server_nginx.html) or [S3](https://docs.aws.amazon.com/AmazonS3/latest/dev/cors.html) backend.

```nginx
add_header 'Access-Control-Allow-Origin' '*';
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
add_header 'Access-Control-Max-Age' 1728000;
```

```xml
<CORSConfiguration>
 <CORSRule>
 <CORSRule>
   <AllowedOrigin>*</AllowedOrigin>
   <AllowedMethod>GET</AllowedMethod>
   <AllowedMethod>POST</AllowedMethod>
   <AllowedHeader>*</AllowedHeader>
 </CORSRule>
</CORSConfiguration>
```

## The CDN conundrum
The above configurations work well if none of the requests are cached by a CDN.

With Javascript consuming not only API calls, but also large binary files (*HTML5 Video* as an example), correctly caching this files on a CDN becomes important.

You need to [whitelist headers](https://medium.com/@dmitter/amazon-cloudfront-and-cors-57dd43cdfd30):

* Origin
* Access-Control-Request-Headers
* Access-Control-Request-Method

With that you create different cache buckets for every combination of headers.

Different Origins, or non Javascript (iOS, Android, ...) clients that don't send an *Origin* header won't be able to share the same CDN caches.

## Lambda@Edge and Cloudfront
Every CDN vendor will have it's own way of doing it. If your CDN vendor doesn't have an answer to that, change CDN provider.

With [Cloudfront](https://aws.amazon.com/cloudfront/), we can use [Lambda@Edge](https://aws.amazon.com/lambda/edge/) to address the problem by attaching it to the *Client Response* event.

CORS headers will be added if needed on every response regardless if the content is already cached on the CDN or not.

To only allow GET,HEAD on any *Origin*. Instead of explicitly allowing anybody, we allow only the *Origin* sent in the request.
The result is the same, but we avoid sending a wildcard back to the browser. Application not sending an *Origin*, won't have the CORS headers in the response.

```js
'use strict'
const log = require('lambda-log')

exports.handler = (event, context, callback) => {
  log.info('event', JSON.stringify(event))
  const response = event.Records[0].cf.response

  if ('origin' in event.Records[0].cf.request.headers) {
    log.info('headers', 'request has origin header')
    try {
      response.headers['access-control-allow-origin'] = [{
        key: 'Access-Control-Allow-Origin',
        value: event.Records[0].cf.request.headers.origin[0].value.toString()
      }]
      response.headers['access-control-allow-methods'] = [{
        key: 'Access-Control-Allow-Methods',
        value: 'GET, HEAD'
      }]
    } catch (err) {
      log.warn('headers', { error: { message: err.message, stack: err.stack } })
    }
  } else {
    log.info('headers', 'request doesn\'t have origin header')
  }
  log.info('response', JSON.stringify(response, null, 2))
  callback(null, response)
}
```

You can expand this script, to add more rules and logic. As an example, only reply with CORS headers for a known domains.

Once this function is deployed to the Edge, you can disable your headers whitelisting and CORS definitions at the backend and enjoy an increased HIT/MISS ratio.
