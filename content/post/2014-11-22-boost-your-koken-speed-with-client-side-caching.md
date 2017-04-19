+++
title = "Boost your Koken speed with client-side caching"
author = "Daniel"
date = "2014-11-22T08:05:10+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
image = "/images/2014/11/koken-logo.png"
categories = [
  "Koken",
  "Photos"
]
tags = [
  "Cache",
  "Gallery",
  "Speed"
]
[amp]
  elements = ["amp-social-share"]
+++
[Koken](http://koken.me)'s default caching behavior is non-existent. Apart from the Photos who have a 1yr cache policy, all other assets have a `Cache-Control: max-age=0`.

With just a little bit of configuration, you can highly improve the user experience for your visitors.

<!--more-->

As long as your Koken server is located nearby, you will not see any blazing impact. But having my [Koken server](http://daniel.mesphotos.ch) in Europe and living in [Asia](https://farfromhome.asia/), I need to bear with the awful Inter-Continental lines and the latency that this induces.

Not having a client-side cache, means that after every click, the browser needs to load a new HTML page and re-fetch all the Stylesheets, Javascripts and Fonts again from the origin. This files won't have changed from one page to another, there is no need to fetch them again. Same goes for all other assets like icons, images and even the html page itself.

To avoid that, all you have to do is to tell your visitors browser that the file is the same and that there is no need to fetch it again, just use the one it already has. Sure, the visitor can disable his cache, or force-reload to ask for a fresh version, but that is his problem and he is doing this knowing the consequences.

Also read my article about using a [CDN in front of Koken](/2014/11/koken-serve-assets-through-cdn/), which is a great complement to the client-side caching.

## Caching rules

### Stylesheets, Scripts and Fonts

The amount of time a content needs to be cached, depends on your visitors pattern. In my case, a visitor will stay on the site for less than 1 hour and not come back for several days. During the whole time of his "stay", I can serve him the same assets. Adding some margin and rounding up, let's tell his browser that a file is "fresh" for 2 hours: `Cache-Control: max-age=7200`.

### HTML

HTML content is more tricky. When you upload new Photos, you want him to see them right away and not in 2 hours. But you still want a fast page load when he navigates between thumbnail page and photo page. A 15 minute cache should do it: `Cache-Control: max-age=900`.

### Photos

By default, Koken caches the photos for 1 year, since each photo has a version token in the filename. An updated photo will always result in a new URL and therefore be a fresh object for the browser.

## Adding Caching

### Apache

Add this to your _.htaccess_ file, above the rules added by Koken.

```apache
<IfModule mod_expires.c>
  ExpiresByType text/html "access plus 1 hour"
  <FilesMatch ".*\.(js|css|lens|png|ico|ttf|woff)$">
    ExpiresDefault "access plus 2 hours"
  </FilesMatch>
</IfModule>
```

### Nginx

Add this in your server configuration.

```nginx
location ~ ".*\.(js|css|lens|png|ico|ttf|woff)$" {
  expires 2h;
}
if ($content_type = "text/html") {
  expires 1h;
}
```
