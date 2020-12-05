+++
author = "Daniel"
title = "Resize Images on the Fly"
date = 2020-03-05T10:21:27+08:00
lastmod = 2020-03-05T10:21:27+08:00
draft = false
summary = "Clients know the best what sizes an image should be (screen size, dpr, ...). Don't pre-generate useless sizes and let them ask for the dimensions that suits them best."
categories = [
  "Media",
  "Static",
  "Serverless"
]
tags = [
  "AWS",
  "CDN",
  "Cloudfront",
  "Lambda",
  "Api Gateway"
]
+++

I guess you are familiar with services like [Cloudinary](https://cloudinary.com/) or [ImageKit.io](https://imagekit.io/). They are both excellent services with free tiers.

Cloudinary is more mature and has better images algorithms (person detection as example), but your images need to be uploaded to Cloudinary's storage or pulled via HTTP from your original.

ImageKit provides less fancy features, but allows you to use your own S3 bucket, keeping your originals private.

To avoid using (and paying) a third party, you can easily (to an extent) do yourself what this services are providing.

## Why build your own image resize service?
- Cost control
- Privacy control
- Tweaks for your specific needs
- For the fun and because you can...

## Cost control
One commonly used solution for this kind of stack, is to use [Lambda@Edge](https://aws.amazon.com/lambda/edge/) and run the logic directly on Cloudfront. The downside with this method, is that Lambda@Edge is invoked on each request, which might get costly with high traffic.

Instead, I use the redirection capabilities offered by an S3-Website-Bucket.

When the requested image is not found, S3 will reply with a redirect to the API Gateway. API Gateway will execute Lambda which generates the image and returns a redirect to the initial URL. This time, when the client requests the image, Cloudfront is able to serve it from S3 and will cache it for subsequent requests.

All new requests for this image, will either be served from Cloudfront or fetched from S3, without any extra invocation of Lambda or Lambda@Edge.

## Use it
The solution exists as a [serverless](https://serverless.com) project: https://github.com/yapawa/imageResize

It is developed for an [Image Gallery project](https://github.com/yapawa) I am working on. But can be used for any use case. Perhaps only the APIGateway resources path would need to be adapted (see below).

## The stack
- Private [S3 bucket](https://aws.amazon.com/s3/) for your originals
- Website enabled [S3 bucket](https://aws.amazon.com/s3/) for your resized images
- [Cloudfront](https://aws.amazon.com/cloudfront/) distribution to serve your resized images
- [Lambda](https://aws.amazon.com/lambda/) function to generate the resized image
- [API Gateway](https://aws.amazon.com/api-gateway/) to trigger the Lambda function

### Bucket for Original
Nothing special here, just create a bucket. Don't allow any public access.

### API Gateway
Create an API Gateway. No need to have it in the same region as the buckets. But having the whole stack in the same region, reduces the latency and the cost, since you won't have to pay for data-transfer across regions.

Make you API "Edge optimized", and don't bother with a custom domain name.

Create the resources to attach the lambda function: `{srcKey}/{version}/{transformations}/{imageName}`, where:

- **srcKey**: The path of your image in the "original bucket". You can use any other means to find the original key, even a call to a database. But to improve speed and cost, we want the Lambda function to be auto-sufficient in knowing the key to the original.
- **version**: A string allowing to have a new cache in Cloudfront. A good practice is to use the lastModified date of the image, if the client has this value.
- **transformations**: a list of transformations to apply to the original. As example `w_100,h_100,c_crop` to resize the image to 100x100 and cropping out any overflow.
- **imageName**: any name, but the extension matters: .jpg, .jpeg or .webp to generate the right format. This could have been part of the transformations, but i just prefer having it as the extension.

### Lambda function
The function is written in NodeJS and uses [Sharp](https://www.npmjs.com/package/sharp) for the image processing.

It needs:
- _Original bucket name_ as ENV variable
- _Cache bucket name_ as ENV variable
- Cloudfront domain as ENV variable
- _Prefix_ on the _original bucket_ where all the images are located
- Read access on _original bucket_
- Write access to _cache bucket_

- From the _srcKey_ path parameter, the original image is fetched and transformed according to _transformations_ and _format_
- The transformed image is stored on the _cache bucket_
- A 307 response is returned telling the browser to go to _cloudfront URL_/_path_

### Bucket for resized images
- Create a bucket, it doesn't need to be in the same region as the "original"
- Enable Website Hosting
- Define the redirection rules:

    ```xml
    <RoutingRules>
      <RoutingRule>
        <Condition>
          <KeyPrefixEquals/>
          <HttpErrorCodeReturnedEquals>403</HttpErrorCodeReturnedEquals>
        </Condition>
        <Redirect>
          <Protocol>https</Protocol>
          <HostName>{apiId}.execute-api.{region}.amazonaws.com</HostName>
          <ReplaceKeyPrefixWith>production/</ReplaceKeyPrefixWith>
          <HttpRedirectCode>307</HttpRedirectCode>
        </Redirect>
      </RoutingRule>
    </RoutingRules>
    ```
    Replace _apiId_ and _region_ with the correct values for your API.

    What this rule does, is that if the response from S3 is 403, we replace the response with an HTTP-Code of _307_ and a _Location_ instructing the browser to call our API, keeping the same path, but prefixing it with _production/_. The prefix is important since API Gateway uses this to differentiate the stages.

### Cloudfront
A Cloudfront distribution using the S3-Website-URL as backend. No need to pass Cookies or Headers. Use cache controls from the origin.

## What did we achieve?
- Clients can decide on the dimensions and formats they need according to their screen size and capabilities.
- When existing, images are served directly from Cloudfront and S3, without any additional ifrastructure needed.
- When not existing, only a single Lambda function needs to be invoked. Without any need to connect to a database. Only the _original bucket_ needs to exist.

## Drawbacks on commercial solutions
- No auto detection on DPR, client needs to know it's DPR.

    This can be done using Javascript:

    ```javascript
    let dpr = 1
    if (devicePixelRatio) {
      dpr = devicePixelRatio
    } else if (window.devicePixelRatio) {
      dpr = window.devicePixelRatio
    }
    dpr = parseFloat(parseFloat(dpr).toFixed(1))
    ```
- No auto detection on supported formats: client needs to know if he can display webp.

    This can be done using Javascript:

    ```javascript
    let supportsWebp = false
    if (!self.createImageBitmap) {
      supportsWebp = false
    }
    const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA='
    return fetch(webpData).then(r => {
      return r.blob().then(blob => {
        return createImageBitmap(blob).then(() => {
          supportsWebp = true
        }, () => {
          supportsWebp = false
        })
      })
    })
    ```
- No normalization for transformations
    - `/w_100,h_100/` and `/w_101,h_100/` will generate different files in S3 and execute lambda twice
    - `/w_100,h_100/` and `/h_100,w_100/` will generate different files in S3 and execute lambda twice

    This can be mitigated by using size names instead of pixels:

      - `/s_medium/` would tell Lambda to generate an image of 128x128
- Works only with clients following redirection
    Not really a problem, your client is a browser, and all of them follow redirection

## Possible improvements
- Use [Api Gateway HTTP API](https://aws.amazon.com/blogs/compute/announcing-http-apis-for-amazon-api-gateway/) instead of API Gateway Rest Api once it is available in all regions.
- Use Lambda@Edge for path normalization, capabilities and [client hints](https://developer.mozilla.org/en-US/docs/Glossary/Client_hints), if we can accept the costs.
