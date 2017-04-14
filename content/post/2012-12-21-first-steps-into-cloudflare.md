+++
title = "First steps into Cloudflare"
author = "Daniel"
date = "2012-12-21T15:48:28+00:00"
image = "/images/2012/12/cloudflare.png"
categories = [
  "Internet",
  "Routing"
]
tags = [
  "CDN",
  "Cloudflare",
  "DNS",
  "Speed"
]
[amp]
  elements = ["amp-image-lightbox", "amp-social-share"]
+++
While writing about [Cloudfront](/2012/12/skip-use-of-cdn-near-hosting-region/), I came accross another CDN service called [Cloudflare](http://www.cloudflare.com). The free entry price made me suspicious, hosting and transport has a price. Since I had nothing to loose and that this domain was new, I decided to give it a try. So far, didn't find any dirty trick.

## What is Cloudflare?

CDN is one of the features, but in fact, they do more than just delivery.

### Content Delivery Network

They place themselves in the CDN category. They are not a CDN in the strict sens of the term. You are not able to push files to Cloudflare and let them serve it. They are acting as a proxy in front of your site, same way [Varnish](https://www.varnish-cache.org/) would do it. But instead of having only one proxy server, they have them spread over the world, assuring that each user always get the content from the nearest one, and therefore reducing latency and speeding up the page serving.

The fact that they are "only" a proxy, makes the use easier for the blogger. No need to push files or to adapts url's of assets. All is done in a transparent, easy to use way. In this matter, they are more like Cloudfront than Akamai.

### Website Optimizer

Since our content is "hosted" on Cloudflare (or at least passes through), they are able to alter the content and optimize it. Cloudflare will minimize javascripts, css and html automatically. 's in their interest, the smaller files they serve, the less money they pay to their carrier.

### Firewall

Cloudflare can block (or make life difficult) for some known "bad-IP", avoiding that those calls reaches your server.

### Apps

They propose several "[apps](https://www.cloudflare.com/apps)", to integrate to your website.  No need to host GoogleAnalytics or SnapEngage scripts. Cloudflare will do it for you.

## Let's dive in

Initial setup is really easy and straight forward, you will be able to have your site served by a CDN is a few minutes. A bit of DNS knowledge is required, but this is something you need to have if you host your own domain. You must be admin of the domain name, you will need to change the NS entries for that domain where your purchased it.

### Host DNS at Cloudflare

Once your account is created, Cloudflare will ask for your domain. The DNS for your domains needs to be hosted by Cloudflare. The sad part, is that you cannot use a delegated sub-domain. I wanted to delegate only cdn.danielmuller.asia to Cloudflare, but it forced me to use the main domain.

The actual domain settings are scanned, and original configuration is proposed. You can then tweak and change all you want. It's an easy, intuitive and nice interface to manage your DNS entries. You define directly from the DNS interface, which hostnames should be served by Cloudflare.

{{<amp-image-lightbox id="lightbox" >}}
{{<amp-figure
src="/images/2012/12/cf_dns_record.png"
caption="A record crossing Cloudflare"
lightbox="lightbox"
>}}

Once your hostnames are configured, you need to change your domain configuration to make it use Cloudflare's DNS servers. Let the DNS stuff spread the world (can be immediate, or take several days depending on TTL's). All the steps are well explained, no worries.

## Tweaking

Depending on your site, you could just stop here and live with it. It is generally better to tweak some stuff.

### Default settings

Each domain has a set of default settings (applied to all URL's of the domain) that you can tweak. Either is choosing from default templates, or going into each point individually. You can define TTL, IP black listing, Auto Minify, ...

### Define per URL rules

With the free account, your can define 3 rules per hostname. Each rule is based on a URL expression and can have settings that differ from the default one. On rule you want to create is to avoid caching of the admin part of your site.

An URL rule needs to contain the protocol and the domain (not just the path part). The good point, you can use wildcards. Adding a rule on http://danielmuller.asia/admin/* and activating &"bypass cache", allows me to not cache the admin section.

### Apps

A nice feature of Cloudflare is the ability to use "apps". This goes from the simple GoogleAnalytics to more complex stuff like integrating a bunch of JS libraries/apps (SnapEngage, CDNJS, ...). Why integrate this tools in your page if Cloudflare can do it for you?

## Personal experiences

The first point that blocked me is the need to host the DNS with Cloudflare. Why can't I just create a cdn.danielmuller.asia as CNAME that point to Cloudflare and point my assets to that domain? The second blocking point is the lack of possibility to use a delegated sub-domain.

The need to have a CDN (it's more the ability to be able to play with a CDN) was greater than the psychological barrier of giving away my DNS records. Once I passed this point, the ease of configuration and the amount of options that are proposed on a free account are largely enough for a small to medium site.

I mostly use the basic CDN functions, having my JS/CSS/Images cached there. Works like a charm. The sad part, is that caching of dynamic css files like mystyles.css.php will not happen. Cache is based on file extension rather than content-type. To cache those files, you will need to serve a static file (generated from the php) or tune your webserver to interpret mystyles.css as a php script and so fool the CDN rules.

The time that the file remains on the CDN cannot be set. I guess they invalidate the files automatically depending on the access rate. This is actually quite normal, I am getting this for free, so why would they store 2Gb lifetime for me? You can however force a cache time on the browser side. If your site is lame and don't add the necessary headers on each file, Cloudflare will add them for you.

I didn't get too much in the apps side, I prefer to host most of the JS tools myself. I am using GA and "A better browser", this allows to remove some plugins from my wordpress config.

## Conclusion

Cloudflare is a great CDN service, easy to make your first steps in the CDN world. For the price you pay with your free account, you can't complain. You get much more than I was expecting. It's the perfect solution for your blog, or picture gallery.

Still haven't found out how the service can be free. Perhaps they need to have a enough traffic to improve services for paid customers (threat blocking, ...). Perhaps it is just their way of making the service known. You start with your small blog and one step leading to another you have all your company sites using Cloudflare.

Even if you don't use the CDN features, you still get a free DNS server.
