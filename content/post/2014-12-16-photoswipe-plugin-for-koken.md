+++
title = "Photoswipe plugin for Koken"
author = "Daniel"
date = "2014-12-16T11:54:16+00:00"
image = "/images/2014/11/koken-logo.png"
categories = [
  "Koken",
  "Photos"
]
tags = [
  "Javascript",
  "Mobile",
  "Photos"
]
[amp]
  elements = ["amp-social-share"]
+++
Yes, I know! Again an article about [Koken](http://koken.me)! This time it is about front-end, something I am really not familiar not at ease with, Thanks [Steve](https://github.com/steverandy) for your help and trying to convince me that async is not that evil. The default _Lightbox_ functionality from Koken has always annoyed me. Specially in a mobile world where swiping has become a defacto standard. Enters [Photoswipe](http://photoswipe.com/).<!--more-->

Photoswipe works amazingly well on mobile, you swipe through the pictures as if their where on the device. You even sometimes forget you are inside a web browser. I was ready to write a [Koken Theme](http://help.koken.me/customer/portal/topics/483366-tutorials---theme-design/articles) from scratch, but finally opted for the plugin way.

As they state on [their site](http://photoswipe.com/documentation/getting-started.html), Photoswipe does not make the life easy for developers, and that's the beauty. Instead of having a locked down functionality, you need to get your hands dirty and do some work. Without this lack of scope, it would have been impossible to make a Koken plugin working with an existing theme.

## Get the Plugin

You can get the plugin on [Github](https://github.com/DanielMuller/koken-plugin-photoswipe).

## See it in action

On my [Gallery](http://daniel.mesphotos.ch/albums/indonesia14/).

## How it works

The plugin replaces the default lightbox feature. It is made to work with a thumbnail-grid layout where all the images are displayed in one page. The plugin will load the full sized images based on the thumbnail infos. There is no Koken-API callbacks inside the slideshow.

The one theme in the Koken Store for which it works well is Axis (Axis does no more exist and has been replaces with the paid Axis2). You need to configure your theme to display thumbs as grid and activate the "open with lightbox" functionality. Activate the plugin, clear the _System Cache_ and you are all set.

### Layout

Only the default layout is implement in the plugin. But you can override this files by saving your own version of the scripts into the _custom_ folder. The plugin will use this files first and the default ones as fallback. Using the _custom_ folder has the advantage that you don't loose your changes on updates.

### Build Photoswipe Items from DOM

Since Koken already creates al lot of images sizes, I wanted to use the ability of responsive images, as described [here](http://photoswipe.com/documentation/responsive-images.html), therefore the _items_ object needs to contain all size. Images smaller than 800px don't make sens, I will not use them. The 800px limit is a bit low, but all my older photos are 800x600 bounded, that's why the choice.

```javascript
var items = []
$('a.k-link-lightbox').children("img").each(() => {
  let item = {}
  let base = $(this).attr('data-base')
  let ext = $(this).attr('data-extension')

  jQuery.each($(this).attr('data-presets').split(' '), (i, val) => {
    let preset_info = val.split(',')
    let name = preset_info[0]
    let size_factor = isHighDensity() ? 2 : 1
    let retina = isHighDensity() ? '.2x.' : '.'
    let w = parseInt(preset_info[1])
    let h = parseInt(preset_info[2])
    let src = base + name + retina + ext
    if (Math.max(w, h) >= 800) {
      item[name] = {
        'src': src,
        'w': size_factor * w,
        'h': size_factor * h
      }
    }
  })
  items.push(item)
})
```
