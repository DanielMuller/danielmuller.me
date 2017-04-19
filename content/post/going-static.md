+++
author = "Daniel"
categories = ["Static"]
date = "2017-04-19T23:24:20+08:00"
draft = false
tags = ["Wordpress", "Hugo"]
title = "Going Static"
[amp]
  elements = ["amp-image-lightbox","amp-social-share"]
lastmod = "2017-04-19"
+++

I hosted my blog with [Wordpress](https://wordpress.org) on my own VPS. The amount of attacks and successful hacks on this blogs is enormous. Wordpress just suffers from notoriety and therefore becomes an easy target.

Maintaining Wordpress up-to-date and add some tricks to minimize the risks just didn't become worth the pain anymore. On top of that, maintaining a VPS to run [Apache](http://apache.org), [PHP](http://php.net) and [MySQL](https://www.mysql.com/) to serve a few never changing posts didn't make sense anymore.

## Why does it matter?
You can use code versioning tools like [Git](https://git-scm.com/) to keep track of the changes in your posts. Your website becomes read-only increasing the security. You gain a consequent speed improvement.

With a static page, you are in control on what is served and are able to reduce the size of the content and the amount of calls. Static content can be easily cached on a CDN or served from memory.

Using the browser's network debugger, disabling local cache, the improvement on the home page are impressive:

|                 | Wordpress        | Hugo        |
|-----------------|:----------------:|:-----------:|
| Requests        |              159 |          27 |
| DOM load time   |          4320 ms |       35 ms |
| Total load time |          5980 ms |     1115 ms |

The same improvements can be observed with some curl timings:

**Wordpress**
```text
    time_namelookup:  0.004
       time_connect:  0.214
    time_appconnect:  0.938
   time_pretransfer:  0.938
      time_redirect:  0.000
 time_starttransfer:  1.911
                    ----------
         time_total:  2.123
```
**Hugo**
```text
    time_namelookup:  0.004
       time_connect:  0.007
    time_appconnect:  0.096
   time_pretransfer:  0.096
      time_redirect:  0.000
 time_starttransfer:  0.105
                    ----------
         time_total:  0.109
```

## Alternatives solutions

* **Keeping Wordpress**  
    Wordpress makes a blogger's life easy. Throw in some plugins, a theme and off you go. Maintaining the code is a pain, and without the right caching plugins, it's very slow.
* **Moving to [Hosted Wordpress](https://wordpress.com)**  
    For 3USD a month, you get your own domain and no maintenance hassle. But you loose some of the personalization you have, even if [Jetpack](https://wordpress.org/plugins/jetpack/) is becoming more and more powerful.
* **[Pagekit](https://pagekit.com/)**  
    [YooTheme](http://yootheme.com/), a [Joomla](https://joomla.org) and [Wordpress](https://wordpress.com) theme shop, started their own CMS, making it a Joomla-light or Wordpress-light. But it's based on PHP and will eventually suffer from the same obesity disease. Not counting you still need a server to run it.
* **[Ghost](https://ghost.org)**  
    Using [NodeJS](https://nodejs.org/) as backend, like Wordpress you can self-host the code or use their pricey hosted version at 20USD/month. But again, you need to run your own server. Their [Markdown](https://en.wikipedia.org/wiki/Markdown) editor with live preview is very appealing.
* **[Hugo](https://gohugo.io/)**  
    Written in [Go](https://golang.org/), Hugo uses Markdown content and generates your site as plain HTML pages. No need to install Go or other dependencies, Hugo provides a single binary with everything bundled inside.
* **[Jekyll](https://jekyllrb.com/)**  
    I didn't dig into Jekyll, the [Ruby](http://www.ruby-lang.org/) blocked me.
* **[Github](https://github.com)**  
    With Github pages, you get a hosted Jekyll (with CDN) for free. But you won't be able to serve your content over HTTPS on your own domain, and you won't be able to use the CDN and your own APEX domain.

## Going Hugo
I chose to go down the Hugo road. No more server-side dependency, being able to writing post with simple Markdown and having the freedom to host where and how I want, where some of the key factors for the choice.

### Migrating from Wordpress
Several existing articles convinced me that the migration should be easy enough:

* [Switching from Wordpress to Hugo](http://schnuddelhuddel.de/switching-from-wordpress-to-hugo/)
* [Building our site: From Django & Wordpress to a static generator (Part I)](https://tryolabs.com/blog/2016/09/20/building-our-site-django-wordpress-to-static-part-i/)
* [Switching from Wordpress to Hugo](http://justinfx.com/2015/11/08/switching-from-wordpress-to-hugo/)
* [Moving to Hugo](http://abhipandey.com/2015/09/)
* [Good-Bye Wordpress, Hello Hugo!](http://blog.arminhanisch.de/2015/08/blog-migration-zu-hugo/)

And in some ways it is easy. With the help of a [Wordpress Plugin](https://github.com/SchumacherFM/wordpress-to-hugo-exporter), you easily export your content to Hugo. You still need to keep some points in mind:

 * You don't care if your layout changes
 * You keep the Wordpress media paths
 * You keep whatever HTML complexity is in your content
 * You don't want to migrate comments

If you need to change some of the points above, your migration will get more complex and more time consuming.

Read more about the migration in "[From Wordpress to Hugo](/2017/04/from-wordpress-to-hugo/)"