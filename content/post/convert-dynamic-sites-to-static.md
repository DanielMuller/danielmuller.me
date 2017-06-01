+++
author = "daniel"
categories = ["Static"]
date = "2017-06-02T00:00:31+08:00"
lastmod = "2017-06-01T23:58:56+08:00"
tags = ["Wordpress", "PHP", "Joomla"]
title = "converting dynamic sites to static hosting"
draft = false

[amp]
  elements = ["amp-image-lightbox","amp-social-share"]

+++

## Why?
Security and speed are the two main factors that made me migrate dynamic sites to static sites.

I used to build some small sites without any framework using [PHP](http://php.net/) to reuse common files (headers, footers, database connections) with some minimalistic administration pages to avoid to do vi over ssh to manage content. Security wasn't a concern, Internet users where nice and respectful back then (or more probably I was young and naive). A badly done image upload can quickly become a hacker paradise. This little *php* snippet that sends out thousands of emails or worse runs brute force attacks against some powerful institutions.

This kind of security holes becomes even more important when you are using well known frameworks ([Wordpress](https://wordpress.org), [Joomla](https://www.joomla.org) anyone?).

I used Joomla or Wordpress on some of my less smaller sites. All this sites where made for personal fun or for small community clubs I was part of, and once time passes the sites doesn't get updated anymore, but you don't want to kill it by pride. You keep it in the wild, forgetting Joomla's security updates and still needing your [Apache](http://apache.org), [libapache2-mod-php](https://packages.debian.org/stretch/libapache2-mod-php) and [PHP](http://php.net).

> Time to archive it!

## Archive your old sites
For sites you know you won't have any content or layout updates anymore, the easy way out is downloading your dynamic site as plain HTML and serve it read-only without any server-side dynamic component. You could still keep some on-the-fly Javascript DOM replacements.

### Tools
Many ways to skin a cat. Browsers have the ability to download a page and their asset. Good enough for small 3 pages sites. I find [httrack](https://www.httrack.com/) more elegant and flexible. There are obviously many other tools to get to the same result, all depends on your taste and needs.

#### httrack
httrack is a mirroring tool, it allows to update local mirror when the source has changed, it allows to continue interrupted mirroring processes. For our archive process we will use it in a very simple way.
```bash
httrack http://www.example.com -O ~/mirror/
```
Your site is now mirrored in `~/mirror/www.example.com/`.

We can now upload our HTML, CSS, JS and Images to our hosting provider and update the domain's DNS entry to point to the new server. Or you could just replace all the files of your PHP site.

If your files (HTML, JS, CSS) contain references to www.example.com it doesn't matter, since the site is hosted under the same domain.

## Hide your admin and update content when needed
If you still need to do updates to your content from time to time, you can keep your PHP site on a server inside your LAN or behind a firewall to limit access. You can even keep it in a [Virtualbox](https://www.virtualbox.org) or [Docker](https://www.docker.com/) image and run it when needed.

Using httrack, you update your static mirror with
```bash
httrack --update http://source.example.com -O ~/mirror/
```
Your site is now updated with the latest changes in `~/mirror/source.example.com/`, and you can upload the content to your HTTP server.

## Use a static generator
If none of the above options are suitable, you can migrate your site to a static generator like [Hugo]({{< relref "going-static.md#going-hugo">}}), [Hexo](https://hexo.io/) or any other similar tool.

## Examples
{{<amp-image-lightbox id="lightbox">}}
{{<amp-figure
  src="/images/2017/05/paomusic.png"
  title="PAO"
  caption="Celtic Rock Band. No more active, but site looked good and most of the pictures are mine. Migrated from Joomla 1.5"
  attrlink="https://paomusic.com/"
  attr="paomusic.com"
  lightbox="lightbox"
>}}
{{<amp-figure
  src="/images/2017/05/bardesfossiles.png"
  title="Bar des Fossiles"
  caption="Alumni Bar at the annual physics department festival. Used to keep in touch and keep track of the drunk evenings, Facebook wasn't there yet. Migrated from Joomla 1.5"
  attrlink="https://bardesfossiles.ch/"
  attr="bardesfossiles.ch"
  lightbox="lightbox"
>}}
{{<amp-figure
  src="/images/2017/05/chapelle-echarlens.png"
  title="Chapelle Echarlens"
  caption="A beer my wife an I used to brew but never made the market jump. The site was more a joke, you need to keep busy between the brewing steps. Migrated from custom framework."
  attrlink="https://chapelle-echarlens.ch/"
  attr="chapelle-echarlens.ch"
  lightbox="lightbox"
>}}
{{<amp-figure
  src="/images/2017/05/geranium.png"
  title="Geranium"
  caption="It's a concept! Default landing page of the VPS that I was sharing with a friend. Intended as a joke about the hype of dynamic content, every content in boxes (but no descent CSS). Migrated from custom framwork."
  attrlink="https://geranium.crealbum.com/"
  attr="geranium.crealbum.com"
  lightbox="lightbox"
>}}
