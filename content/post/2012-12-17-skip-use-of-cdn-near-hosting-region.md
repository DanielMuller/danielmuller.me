+++
title = "Skip use of CDN near hosting region"
author = "Daniel"
date = "2012-12-17T15:44:57+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
categories = [
  "Routing"
]
tags = [
  "AWS",
  "CloudFront",
  "DNS",
  "Route53"
]
+++
The server hosting this domain is a VPS hosted in Switzerland by [Nimag network SàRL](http://nimag.net/index.php/produits-8/vps). Access speed from Asia is pretty bad, specially due to network latency on the pipes Singapore-US and US-Europe. In using a [CDN](http://en.wikipedia.org/wiki/Content_delivery_network) to serve assets, we improve global page loading time in lowering the loading times of assets.

The VPS has a good European connexion, there is not much need for visitors in Europe to use a CDN. The other reason, is to lower the traffic costs on the CDN level.

## Latency based routing

### How does that work?

We are using the DNS service [Route53](http://aws.amazon.com/route53/) from Amazon which has built-in functionality for latency based routing. You define several entries of the same entity in the DNS zone that will respond differently depending on region. So visitors from europe will receive IP aaa.aaa.aaa.aaa when requesting for cdn.yourdomain.com and visitors from US will receive IP bbb.bbb.bbb.bbb when requesting for the same hostname.

In assuring that aaa.aaa.aaa.aaa points to your server and bbb.bbb.bbb.bbb to the CDN, you achieved the wanted configuration.

### How do we do that?

I assume you already have set up your CDN, either [Cloudfront](http://aws.amazon.com/cloudfront/) or any another one, and is accessible with the hostname cdn.yourdomain.com. In Amazon's web console, open the Route53 configuration and edit your zone.

  1. Make sure that your webserver is configured to respond to www.yourdomain.com and cdn.yourdomain.com
  2. Add a new record called cdn.yourdomain.com of type CNAME to www.yourdomain.com
  3. Check the "_Latency_" box in _Routing Policy_
  4. Choose the AWS region for which you don't want routing through CDN
  5. Give it an unique ID (name of the region will just do fine)
  6. Add a new record called cdn.yourdomain.com of type CNAME to dxxxxxx.cloudfront.net
  7. Check the "_Latency_" box in _Routing Policy_
  8. Choose an AWS Region for which you want routing through CDN
  9. Repeat step 6 to 8 to cover the world. No need to fill each region. Just the ones surrounding your non-CDN region. Visitors near Tokyo will get the response from us-west-1 or sa-southeast-1, so no need to create an entry for sa-northest-1

{{<amp-figure
src="images/2012/12/route53_latency_record1.png"
caption="Route53 Latency Record - Europe"
>}}
{{<amp-figure
src="images/2012/12/route53_latency_record2.png"
caption="Route53 Latency Record - Asia"
>}}

## Testing results

Go to [traceroute.org](http://www.traceroute.org, choose a server in a region you want to test. Enter cdn.yourdomain.com in the search field and hit enter.

The result will show you the route from the chosen server to cdn.yourdomain.com. If it ends on your webserver, it means that it got the DNS query from the non-CDN region. Fine tune your DNS latency settings based on those results.
