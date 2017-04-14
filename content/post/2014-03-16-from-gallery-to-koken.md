+++
title = "From Gallery to Koken"
author = "Daniel"
date = "2014-03-15T16:48:21+00:00"
image = "/images/2014/03/galleries.png"
categories = [
  "Koken",
  "Media",
  "Photos"
]
tags = [
  "Gallery",
  "Photos"
]
[amp]
  elements = ["amp-image-lightbox","amp-social-share"]
+++
Back in the 90's, there was no Ajax or HTML5. There was no Flickr, Picasaweb, or Instagram. The most common way to publish your photos on a website was to create a static html page for each album with all the thumbnails and images associated to it.

To solve this problem, one project emerged: [Gallery](http://galleryproject.org). Since the beginning, the tagline was "*Your photos on your website*" and it did exactly that. Your photos are organized in albums, thumbnails and HTML are generated on the fly. There was even no database, information is stored as serialized data in flatfiles. In the past 15 years, 2 new versions where created each of them addressing issues from the previous. Gallery was always focused on the backend technology, doing a lot of amazing things. The frontend stayed in the same line, generating HTML to display albums, thumbnails and photos.

I started to use Gallery in the late 90's and still using it now. I upgraded some of my galleries to Gallery2 and Gallery3. The secondary screen has since long taken over media consumption, be it for pictures or movies.

The layouts available by default for Gallery are lacking of "*Ajaxiness*" and "*Responsiveness*". I started to feel the default album-album-thumbnail-picture organisation too rigid. Some pictures would have the merit to be assigned to multiples albums. I don't have the skills to make this happen on Gallery and migrating is a painful work. I pushed back an upgrade multiple times, following the moto : "*If it ain't broken, don't fix*".

But my Dad's Gallery 1 installation broke with the latest PHP upgrade. [Koken](http://koken.me/) was on my radar since a few month. Instead of upgrading to Gallery3, this was a good opportunity to try out Koken with real data. Self hosting this pictures is a requirement. I don't want to give them away to Google, Facebook, Yahoo! or other data eaters.

{{<amp-image-lightbox id="lightbox">}}
{{<amp-figure
src="/images/2014/03/mesphotos-old.png"
title="Albums in Gallery1"
caption="Pagination is present: no infinite scroll"
lightbox="lightbox"
>}}
{{<amp-figure
src="/images/2014/03/mesphotos-new.png"
title="Albums in Koken"
caption="Theme: Axis"
lightbox="lightbox"
>}}

## My thoughts about Koken

### Pros

  * The variety of templates:
      * Ability to configure basic behaviors without putting your hands in the code
      * Each template is truly different, serving it's own purpose
  * Responsiveness
  * Infinite scroll
  * Mobile and Retina ready
  * Thumbs created on the fly depending on theme and display screen
  * An image can be part of multiple albums
  * Categories, Keywords assigned to albums or images
  * Multi-Cover for albums
  * More than a Gallery: You can add articles (they call it Essays)
  * API
  * It's free (as in beer), some plugins and themes are sold separately. I like this kind of business model.
  * You can develop your own plugins and themes using the Lens framework.

### Cons

  * The image management is too "Lightroom"
  * With a lot of albums and pictures, the navigation in the library becomes difficult. Specially when you want to set manual order.
  * No image size limit. You hosting storage will need an increase.
  * No API documentation.
  * Some basic plugins are missing: panorama display, map display or serve images from CDN. But you can always write them by yourself.
  * No ability to combine CSS and JS.

## Is Koken for me?

The lack of API documentation, forced me to write my own SQL migration script to import the existing images and meta-data. This took some time, but once it is imported and you have chosen/configured a template (this is always the longest part for me), the end result is quite nice. You even get used to the "Lightroom like" management interface.

Koken is at version 0.12 (released 13 march 2014), it is still in beta and there is room for improvement. Just sad that Koken is not on Github, some functionalities could be improved by peoples like me and you faster than going through their forums or sending patches.

Want to see what it looks like? Take a look at my [dad's albums](https://willy.mesphotos.ch), he has some amazing pictures there.

## Migrations scripts

The scripts I used to migrate from Gallery to koken are available on [Github](https://github.com/DanielMuller/gallery_to_koken).
