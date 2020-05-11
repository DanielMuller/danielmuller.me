+++
title = "WordPress, Total Cache and Cloudflare"
author = "Daniel"
date = "2013-01-09T16:30:30+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
image = "images/2012/12/wp_truck.jpg"
categories = [
  "Wordpress"
]
tags = [
  "Cloudflare",
  "Internet",
  "Speed",
  "Wordpress"
]
+++
Everybody is aware that WordPress is a heavy truck to display some "mostly" static content. Each _Plugin_ or _Widget_ that is added ads some stylesheet calls, javascript calls and database requests. This all together slows up the loading time of your blog. And it gets even worse when the site become popular and has to deal with thousands of requests. Why request for each visitor something from the database when the content only changes once in a while? Why go through all the PHP logic when the final rendered HTML is always the same?

<!--more-->

## What do we want?

### Improve page rendering speed: Server-Side caching

The first step toward a faster rendering of the pages, is to cache the resulting HTML on the server and serve this pre-built result. Less time spent in PHP, less DB calls.

#### Store on Disk or RAM?

RAM is much faster than Disk. But it takes up RAM (obviously). All depends on your server and site load. If your WordPress site is alone on a VPS and you have enough spare RAM, go for it. If your site is small and not too busy and you need to spare RAM for other apps, go for Disk.

### Improve loading speeds

#### Ask visitor to not request static content: User-Side caching

Defined the right response headers on your pages, you can ask the visitors browser to keep a copy of your pages a certain amount of time. Why request the header image on every page load if it doesn't change? Just keep in mind, that the client's browser is not forced to store page, it is more a recommendation.

#### Avoid data traveling the world: proximity caching (CDN)

{{<amp-figure
src="images/2013/01/cdn-map.png"
>}}

Caching your pages and images near to the user, will improve his page loading time. It will also allow to reduce your server load, since less requests will reach your server.

#### Downsize CSS and Javascript: Minify

Removing comments and spaces in JS and CSS files will reduce their size and increase loading speed.

#### Reduce amount of files to download: Combine

Each TCP request has a payload. To avoid carrying this payload several times, combine all your JS in one file and all CSS in one file.

## How to get there?

### Caching pages, minify and combine: WP Total Cache

There a several plugins achieving one (or more) of the wanted tasks. Each one in his own specialty. [WP Total Cache](http://wordpress.org/extend/plugins/w3-total-cache/) aims to solve all problems in one huge unified plugin. At first sight, this plugins can scare one off, it offers a lot of options. But once this first step passed, it is rather easy to work with, since most of the time the defaults values is what you want. I won't cover here all the options, since it has already be done by Antti Kokkonen on his extensive [Complete Settings Guide](http://zemalf.com/1443/w3-total-cache/) post.

On the _general settings_, you need to choose what functionality you want to use. Once activated, you are able to get into more details from the functionality specific params.

Depending on the theme and the plugin used, the automatic minifying works just out of the box. You can check what CSS and JS are loaded using the Network tab in [Firebug](https://addons.mozilla.org/firefox/addon/firebug) (or other equivalent page inspector). You should have only 1 CSS loaded from your site and only 1 JS loaded from your site. WP Total Cache can't minify or combine files served by external servers (Google, Facebook, ...) since there are not hosted on your blog.

If you still see multiple file calls, you will need to use the _manual_ settings and give Total Cache the list of files wanted. Keep in mind that Total Cache will only minify and combine real files (thoses ending in .js or .css), and not on the fly generated ones (.css.php).

#### Combine and minify dynamic stylesheets or javascripts

Some plugins have the tendency to use dynamic css to include color configuration defined in the backend. Theses files won't be used by Total Cache, since Total Cache is assuming theses files can change on each request. To have Total Cache use theses files, you need to hack the plugin code to not make it use a _.css_ instead of a _.css.php_.

If you use the plugin called easy-fancybox, in `wp-content/plugins/easy-fancybox/easy-fancybox.php` you will find the line:

```php
wp_enqueue_style('easy-fancybox.css', plugins_url(FANCYBOX_SUBDIR.'/easy-fancybox.css.php', __FILE__), false, FANCYBOX_VERSION, 'screen');
```

This CSS doesn't change unless you make changes in the backend. So why not used a cached version?

```bash
cd wp-content/plugins/easy-fancybox/
wget -O easy-fancybox.css http://yourhost/wp-content/plugins/easy-fancybox/easy-fancybox.css.php
```

Change the enqueue command:

```php
wp_enqueue_style('easy-fancybox.css', plugins_url(FANCYBOX_SUBDIR.'/easy-fancybox.css', __FILE__), false, FANCYBOX_VERSION, 'screen');
```

Just remember to download the file again if you make changes in the plugin configurations.

A smarter way would be to have the plugin creating a cached copy on each config change automatically.

#### htaccess and mod_rewrite

WP Total Cache makes heavy use of URL rewriting in Apache, and therefore creates rules in several .htaccess files (at least for Apache, WP Total Cache handles Nginx too). Make sure that your Webserver is able to write theses files (please don't chmod 777, 666 is plenty enough). The latest versions of Total Cache, handles errors quite well, telling you what to do if something didn't work out.

The main problem I encountered are errors message on minify or cache not working, even if the .htaccess files where created. This is generally due to the .htaccess at the root not having WordPresses rewrite rules at the end. Solving this problems is quite well explained in this article: [Page Cache URL rewriting is not working](http://www.mkyong.com/blog/w3-total-cache-page-cache-url-rewriting-is-not-working/).

### CDN

WP Total Cache is able to handle several CDN providers. The CDN feature of Total Cache allows you to host assets on a CDN while still serving your site directly from the main server, this has the advantage of not caching your dynamic PHP pages on a CDN. This is achieved by using an additional sub-domain routed through the CDN for all your assets. Total Cache will let you choose which type of asset needs to be used through a CDN sub-domain and automatically take care to change domain name for all these assets types.

#### AWS: S3 and Cloudfront

You can give an access key and private key that has access to cloudfront and S3 in read/write. Total Cache will create for you the needed ressources on AWS side.

Total Cache lets you choose between 3 ways of using Cloudfront:

  1. Cloudfront origin pull: Cloudfront is defined to fetch content from your website. Update of files is defined by the TTL policy set in Cloudfront
  2. Cloudfront origin push: Cloudfront is defined to directly fetch from your website, but Total Cache with notify Cloudfront to invalidate changed objects. This allows you to publish a new version of file in a few minutes. But invalidating has a cost, billed by AWS.
  3. S3 origin push: Your assets are hosted on S3 and served by Cloudfront. This allows you to serve assets really fast, with traffic never reaching your server. S3 storage has a cost, as has S3 and CF traffic.

#### Cloudflare

I presented [Cloudflare](http://www.cloudflare.com) in [another article](/2012/12/first-steps-into-cloudflare/). Total Cache has not an explicit support for Cloudflare, you will need to use "Generic Mirror" in the pull section. You are able to define a sub-domain, and that is all you need.

Cloudflare support is provided in the "General Settings", by giving your account details, you are able to purge your Cloudflare cache directly from WordPress console.

With Cloudflare, you could still use the CDN option provided by Total Cache, to separate traffic of assets and pages, or you could skip the CDN part and route all your site through Cloudflare. This choice is up to you.
