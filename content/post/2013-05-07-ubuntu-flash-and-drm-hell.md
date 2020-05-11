+++
title = "Ubuntu, Flash and DRM hell"
author = "Daniel"
date = "2013-05-07T15:01:41+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
categories = [
  "Ubuntu",
  "Video"
]
+++
Yes, there are still peoples serving content through flash, and yes there are still peoples using DRM.

I was struggling getting movies with Adobe-Access DRM to work on Ubuntu Raring (13.04), and the cryptic "_3323 error_" didn't help much.<!--more-->

## Check your actual status

The first place to look, is Adobe's test page:

http://drmtest2.adobe.com:8080/SVP/SampleVideoPlayer_FP.html

Enter the URL `http://drmtest2.adobe.com:8080/Content/anonymous.f4v` and check the box "Show DRM Events".

If the movie doesn't play, you have a DRM problem (and some useless debugger logs).

## How to solve?

I finally found the answer here: http://askubuntu.com/questions/286297/is-there-a-work-around-to-get-amazon-prime-instant-videos-working, thanks a lot to the community at AskUbuntu for finding a solution with better professionalism than giant Adobe.

Absolutely no credit for me, all credits goes to Aaron and the peoples at AskUbuntu.

Adobe-Access requires the Hardware Abstraction Layer (HAL) to be present to identify the machine and to be able to retrieve Adobe's voucher. There is a problem with the HAL libraries in Raring.

### Install Flash

You need to activate the partner repo.

```bash
sudo add-apt-repository "deb http://archive.canonical.com/ $(lsb_release -sc) partner"
```

Quantal had a package called adobe-flashplugin which no longer exists. You will need to install flashplugin-installer.

```bash
sudo apt-get update
sudo apt-get install flashplugin-installer
```

### Install HAL

HAL should be installed by default, `dpkg -l | grpe hal`. If not, just apt it:

```bash
sudo apt-get install hal
```

#### Patch HAL install

```bash
sudo mkdir /etc/hal/fdi/preprobe
sudo mkdir /etc/hal/fdi/information
/usr/sbin/hald --daemon=yes --verbose=yes
```

### Clean Adobe's user cache

```bash
rm -rf ~/.adobe
```
