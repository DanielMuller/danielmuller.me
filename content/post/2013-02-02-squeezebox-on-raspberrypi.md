+++
title = "Squeezebox on RaspberryPI"
author = "Daniel"
date = "2013-02-02T09:33:01+00:00"
image = "/images/2013/02/raspberrypi.jpg"
categories = [
  "Media"
]
tags = [
  "LAN",
  "Media"
]
[amp]
  elements = ["amp-image-lightbox","amp-social-share"]
+++
I was looking to find a usage for my (RaspberryPI)[http://www.raspberrypi.org/]. Why not a headless Squeezebox-Client? To control the player, the Squeezebox app on your Android phone is the perfect choice.<!--more-->


## The pieces

### Squeezebox

For those who don't know, [Squeezebox](http://www.mysqueezebox.com/index/Home) is a brand from [Logitech](http://www.logitech.com) featuring several Internet music players, able to play songs from a [SqueezeServer](http://wiki.slimdevices.com/index.php/Logitech_Media_Server). The server is just some piece of [perl](http://www.perl.org) that you can install where you want, as long as it can index your song. You can run the server on the same RaspberryPI or dedicate a second one for that. In my case, the server is running on a [Synology](http://www.synology.com) NAS.

### RaspberryPI

RasperryPI is a small educative piece of hardware, featuring a CPU, some RAM, USB, HDMI, LAN, audio and SD slot. Basically it's a computer perfectly adapter as a TV Set-up Box, a NAS controller or a media player.

## Installing SqueezePlug

SqueezePlay is the player part of the Squeeze family. I was looking to compile it for Raspbian (a Debian based distro for Raspberry), but it seemed a too high challenge. Luckily, the guys at [Squeezeplug](http://www.squeezeplug.eu/?p=260) ported the Squeezebox OS to RasperryPI, making the process a lot easier, and offers not only SqueezePlay, but also SqueezeLite and SqueezeSlave.

  1. SqueezePlug is 3Gb. you will need a 4Gb SD card
  2. Download the lastest squeezeplug build from the [download page](http://www.squeezeplug.eu/?page_id=52) and unzip the archive to reveal SqueezePlug\_HF\_602.img
  3. Burn the image to the SD card:

    ```bash
    sudo umount /dev/sdd1 # Or wherever your SD card got mounted when inserted
    sudo dd bs=4M if=SqueezePlug_HF_602.img of=/dev/sdd # Or wherever the SD card is located
    ```

  4. Put the SD into the RPI, connect LAN, Audio and power.
  5. The IP address is set by DHCP. Get the IP address either from your router or connect an HDMI screen. IP address is printed out on login screen.
  6. Connect through ssh to your RPI, with user _root_ and password _nosoup4u_
  7. You will by default enter an ncurses menu, in case you quit it accidentally, just launch it again with the _setup_ command

## Configuration

The SqueezePlug image not only allows you to have a Squeeze-client, but allows you also to install a Squeeze-server. On the main configuration screen, you are able to configure Network, install samba end even upgrade the underlaying Debian distribution.

{{<amp-image-lightbox id="lightbox">}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeplug_config_main.png"
>}}

## Server Installation

Go to Server\_and\_Player to install the Server software. Choose one of the Server packages. It all depends on the clients you want to serve. I won't cover Server installation here, since I am only interested in the client part.

## Player Installation

Go to Server\_and\_Player to install the player software. Choose one of the players for LMS (Logitech Media Server):

  * SqueezeSlave: a headless player
  * SqueezeLite: another headless player
  * SqueezePlay: Official player run, same as the one running on Logitech&#8217;s hardware. Has a display interface that you can control by keyboard or touchscreen.

We are installing SqueezeLite, which is an improved version of SqueezeSlave. SqueezePlay just adds a useless overhead for our case.

Installation is pretty straight forward. Choose "Install SqueezeLite" and follow the screens:

  1. Give a name to your box, avoid spaces
  2. Choose your soundcard. If you are using a speakers plugged on the headphone jack, choose _bcm2835 RPi internal_
  3. No need to go into the advanced setup screens, unless you know what to do
  4. SqueezeLite is started automatically

{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeplug_config_client.png"
caption="Choose SqueezeLite"
>}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeplug_config_name.jpg"
caption="Choose a name"
>}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeplug_config_client_server.png"
caption="Set your Server IP"
>}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeplug_config_client_audio.png"
caption="Set your soundcard"
>}}

## Start / Stop / Configure

Configuration file is located at `/etc/default/squeezelite`. Client can be stopped with `/etc/init.d/squeezelite stop` and started with `etc/init.d/squeezelite start`.

## Controlling the player

To control the player, the easiest way is to use the Squeezebox app available from [App Store](https://itunes.apple.com/us/app/logitech-squeezebox-controller/id431302899) or [Google Play](https://play.google.com/store/apps/details?id=com.logitech.squeezeboxremote).

{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeremote_choose.png"
caption="Choose client to control"
>}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeremote_menu.png"
caption="Main menu/images"
>}}
{{<amp-figure
lightbox="lightbox"
src="/images/2013/02/squeezeremote_sync.png"
caption="Sync SqueezeLite with Squeezebox Touch"
>}}

From the SqueezeControl, you have access to the same menus you have on your SqueezeBox Touch, or SqueezePlay. Allowing to access your library and even sync the boxes so that every room in your home plays the same songs.
