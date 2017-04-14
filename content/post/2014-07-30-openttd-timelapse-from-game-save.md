+++
title = "OpenTTD: Timelapse from game save"
author = "Daniel"
date = "2014-07-30T01:27:55+00:00"
image = "/images/2014/07/Openttd.png"
categories = [
  "Ubuntu",
  "Video"
]
tags = [
  "Game",
  "OpenTTD",
  "timelapse"
]
[amp]
  elements = ["amp-youtube", "amp-social-share"]
+++
This script allows you to create a timelapse video from your [OpenTTD](http://www.openttd.org) game. It will use your previously saved games. No need to remember to take screenshots during the game, ad since you play it safe and save before and after each big civil engineering work (ooops ?), you will have enough frames to create a nice work to put into your Company heritage cabinet.

The resulting video is zoomed into a defined location and works with large games (tested on a 512x512 map).

<!--more-->

After opening an old game by mistake, I realized how much civil engineering my region had undergone. Having a timelapse of all that heavy work sprung to my mind. But I never saved any screenshot of my games and opening each game one by one is not my favorite thing. Better spend more time to create an automated script.
<div class="clearfix"></div>
<div class="video">
{{<amp-youtube
video="8bUFkXgPdg0"
controls="true"
width="16"
height="9"
layout="responsive"
>}}
</div>

## Basics

OpenTTD has a [console](https://wiki.openttd.org/Console) that allows some basic commands mainly intended for network games), and more importantly allows you to take screenshots. A second sweet feature, is the support for [start up scripts](https://wiki.openttd.org/Running_Startup_Scripts), on openttd level and/or on a game level.

## What we need

  * OpenTTD (obviously)
  * Python with PIL support
  * ffmpeg or avconv
  * Some saved games

## Take the right screenshot

OpenTTD's console allows you take different types of screenshots:

  * `screenshot`: just grabs the screen with all the GUI present
  * `screenshot no_con`: same as above but without the console window
  * `screenshot big`: a zoomed in version
  * `screenshot giant`: the whole map

The location and zoom level are stored within the saved game. Meaning that when you open a game your visible area is how you left it. You can go to a specific tile with the console command `scrollto`, but you can't set a specific zoom level. The first three screenshot options are dependent on zoom level, you won't get a consistent area for each saved game.

This leaves us only with the *giant* option, which creates really huge files: 32000x16000, 40MB for a 512x512 map.

## Re-sampling the images

Re-sampling the images to 1920x1080 and using it as could be a choice, but you loose the sight of the detail and you end up with only a generic overview. Don't you prefer to show the amazing landscaping you made to fit this *airport* and *good's station* into the city?

We will cut out the interesting region from the main file, to simulate a zoom-in and achieve something similar to `screenshot big`, but without having to worry about the zoom.

## The steps

I ran this script on Ubuntu 14.04, it will work on other Linux distro or OSX and should work on Windows too (still someone using Windows, seriously ?) as long as you have all the tools installed. The paths in the sample are for Ubuntu, just replace them with the ones for your installation.

### Screenshot and exit

To take a screenshot and exit immediately after starting a game, simply create the file `~/.openttd/scripts/game_start.scr`, with this content:

```bash
screenshot giant
exit
```

### Start a game

You can start OpenTTD and directly open a game:

```bash
openttd -x -g game_filename
```

### Crop and resize images

PIL is surprisingly handling this quite well. My first approach was to use [ImageMagick](http://www.imagemagick.org), but the time and CPU taken to crop the huge source file was below expectations.

### Display the right area

I was too lazy to write a *tile\_to\_pixel* method by using matrix calculation and geographic projections, so I went the easy route by using the position relative to the source image.

## The final script

[comment]: <> (once amp-gist is official)
[comment]: <> ({{<amp-gist gistid="a8e855ab1516e6807762" height="520" >}})


```python
#!/usr/bin/python
import argparse
import glob
import os
from PIL import Image
from PIL import ImageFont
from PIL import ImageDraw
from distutils.spawn import find_executable
import time
import re
import locale

class OpenTTDTimelapse:
  args = None
  autoexec_script_name = "autoexec.scr"
  gamestart_script_name = "game_start.scr"
  autoexec_script_path = None
  gamestart_script_path = None
  screenshot_path = None
  save_path = None
  ottd = None
  openttd = None
  ffmpeg = None
  backup_autoexec = False
  backup_gamestart = False

  def __init__(self, args):
    self.args = args
    self.define_paths()

  def define_paths(self):
    self.ottd = os.path.realpath(os.path.expanduser(self.args.ottd))

    self.autoexec_script_path = os.path.join(self.ottd,"scripts", self.autoexec_script_name)
    self.gamestart_script_path = os.path.join(self.ottd,"scripts", self.gamestart_script_name)
    self.screenshot_path = os.path.join(self,self.ottd,"screenshot")
    self.save_path = os.path.join(self.ottd,"save")

    if not os.path.isdir(self.ottd):
      print "No such folder %s" % self.ottd
      exit(1)
    if not os.path.isdir(os.path.join(self.ottd,"save")):
      print "Folder %s is not an OpenTTD folder" % self.ottd
      exit(1)

    self.openttd = find_executable("openttd")
    if self.openttd is None:
      print "openttd not found, please install openttd"
      exit(1)

    self.ffmpeg = find_executable("ffmpeg")
    if self.ffmpeg is None:
      self.ffmpeg = find_executable("avconv")
      if self.ffmpeg is None:
        print "ffmpeg or avconv not found, please install ffmpeg or libav-tools"
        exit(1)

  def get_file_date(self, filename):
    return time.strptime(" ".join(re.split("^([0-9]+)[a-z]*\s([a-zA-Z]+)\s([0-9]+)$",os.path.basename(filename).split(',')[-1].split('.')[0].strip())[1:4]), "%d %b %Y")

  def get_save_game(self):
    files = sorted(glob.glob(os.path.join(self.save_path, "%s*.sav" % self.args.company)), key=lambda x: time.strftime("%Y%m%d",self.get_file_date(x)))

    return files

  def backup_script(self, script_path):
    backup = False
    if os.path.isfile(script_path):
      backup = True
      os.rename(script_path, script_path+".orig")
    return backup

  def make_screenshot_script(self, screenshot_name):
    f = open(self.gamestart_script_path,"w")
    f.write("screenshot giant "+screenshot_name+os.linesep+"exit")
    f.close()

  def get_crop_info(self, im):
    width0, height0 = im.size

    width1 = self.args.width*self.args.zoom
    height1 = self.args.height*self.args.zoom

    left1 = int(round((width0*self.args.left/100)-(width1/2)))
    top1 = int(round((height0*self.args.top/100)-(height1/2)))
    right1 = left1+width1
    bottom1 = top1+height1

    if right1>width0:
      delta = right1-width0
      left1 = left1-delta
    if bottom1>height0:
      delta = bottom1-height0
      bottom1 = bottom1-delta
    if right1<0:
      right1=0
    if top1<0:
      top1=0

    return (left1, top1, right1, bottom1)

  def draw_date(self, im1, game_file):
    txt = time.strftime("%Y",self.get_file_date(game_file))
    txt_margins = (int(round(self.args.width*0.015)),int(round(self.args.height*0.015)))
    draw = ImageDraw.Draw(im1)
    font_size = int(round(self.args.height/20))
    font = ImageFont.truetype(self.args.font_path, font_size)

    txt_size = font.getsize(txt)
    txt_pos = (self.args.width-txt_margins[0]-txt_size[0], self.args.height-txt_margins[1]-1.5*txt_size[1])

    draw.text(txt_pos,txt,(255,255,255),font=font)
    return im1

  def clean(self):
    if not self.args.debug:
      if os.path.isfile(self.gamestart_script_path):
        os.unlink(self.gamestart_script_path)

      for frame_image in glob.glob(os.path.join(self.screenshot_path,"frame_*.png")):
        os.unlink(frame_image)

    if self.backup_autoexec:
      os.rename(self.autoexec_script_path+".orig", self.autoexec_script_path)
    if self.backup_gamestart:
      os.rename(self.gamestart_script_path+".orig", self.gamestart_script_path)

  def create_movie(self):
    file_id = 1
    company = None

    game_files = self.get_save_game()
    if len(game_files) == 0:
      print "No game files found for %s" % self.args.company
      exit(1)

    self.backup_autoexec = self.backup_script(self.autoexec_script_path)
    self.backup_gamestart = self.backup_script(self.gamestart_script_path)

    for game_file in game_files:
      game=os.path.basename(game_file)

      if company is None:
        company = game.split(",")[0].strip()

      screenshot_name="timelapse_%05d" % file_id
      screenshot_name_ext = screenshot_name+".png"

      self.make_screenshot_script(screenshot_name)

      os.system(self.openttd+" -x -g \""+game+"\"")
      os.unlink(self.gamestart_script_path)

      im = Image.open(os.path.join(self.screenshot_path,screenshot_name_ext))
      crop_info = self.get_crop_info(im)

      frame_name = "frame_%05d.png" % file_id
      final_frame = os.path.join(self.screenshot_path,frame_name)

      im1 = im.crop(crop_info).convert('RGB').resize((self.args.width,self.args.height),Image.BILINEAR)
      if self.args.timestamp:
        im1 = self.draw_date(im1, game_file)

      if self.args.check:
        final_frame="timelapse_check.png"

      im1.convert('P', palette=Image.ADAPTIVE, colors=255).save(final_frame)

      im = im1 = None
      file_id+=1

      if self.args.check:
        break

      if not self.args.debug:
        os.unlink(os.path.join(self.screenshot_path,screenshot_name_ext))

    if not self.args.check:
      ffmpeg_cmd = "%s -y -r 1 -i %s/frame_%%05d.png -r 24 -s %dx%d -c:v libx264 -an -vsync cfr \"%s.mp4\"" % (self.ffmpeg, self.screenshot_path, self.args.width, self.args.height, company)
      os.system(ffmpeg_cmd)

    self.clean()

if __name__ == "__main__":
  parser = argparse.ArgumentParser(description='Create a Timelapse from an OpenTTD game')
  parser.add_argument('-c','--company', dest='company', required=True, help='Game Name')
  parser.add_argument('-d','--dir', dest='ottd', metavar='OPENTTD_FOLDER', default='~/.openttd', help='OpenTTD folder (default %(default)s)')
  parser.add_argument('-dx','--width', dest='width', type=int, default=1920, help='Width of frames (px) (default: %(default)s)')
  parser.add_argument('-dy','--height', dest='height', type=int, default=1080, help='Height of frames (px) (default: %(default)s)')
  parser.add_argument('-z','--zoom', dest='zoom', type=int, default=2, choices=xrange(1,5), help='Scale factor')
  parser.add_argument('-l','--left', dest='left', type=int, default=50, help='Position from left in percent (default: %(default)s)')
  parser.add_argument('-t','--top', dest='top', type=int, default=50, help='Position from top in percent (default: %(default)s)')
  parser.add_argument('-s','--timestamp', dest='timestamp', action="store_true", help='Display year on frames')
  parser.add_argument('-f','--font', dest='font_path', metavar="FONT PATH", default='/usr/share/fonts/truetype/msttcorefonts/Arial.ttf', help="Path to TTF file")
  parser.add_argument('--debug', dest='debug', action="store_true", help='Do not clean temp files')
  parser.add_argument('--check', dest='check', action="store_true", help='Output first image only, useful to verify the selected area')
  args = parser.parse_args()

  ottd = OpenTTDTimelapse(args)
  ottd.create_movie()
```

### Help

`python openttd_timelapse.py --help` should give you all the information you need.

```bash
usage: openttd_timelapse.py [-h] -c COMPANY [-d OPENTTD_FOLDER] [-dx WIDTH]
[-dy HEIGHT] [-z {1,2,3,4}] [-l LEFT] [-t TOP]
[-s] [-f FONT PATH] [--debug] [--check]

Create a Timelapse from an OpenTTD game

optional arguments:
-h, --help show this help message and exit
-c COMPANY, --company COMPANY
Game Name
-d OPENTTD_FOLDER, --dir OPENTTD_FOLDER
OpenTTD folder (default ~/.openttd)
-dx WIDTH, --width WIDTH
Width of frames (px) (default: 1920)
-dy HEIGHT, --height HEIGHT
Height of frames (px) (default: 1080)
-z {1,2,3,4}, --zoom {1,2,3,4}
Scale factor
-l LEFT, --left LEFT Position from left in percent (default: 50)
-t TOP, --top TOP Position from top in percent (default: 50)
-s, --timestamp Display year on frames
-f FONT PATH, --font FONT PATH
Path to TTF file
--debug Do not clean temp files
--check Output first image only, useful to verify the selected
area
```

**output**

Movie is created in current path, with the name *company_name*.mp4

**-z, -zoom {1,2,3,4}**

Allows to cut out a smaller or bigger area from the source file which is resized to the movie size.

Zoom 1 crops out the exact size. Zoom 2 the double size. The timelapse will display a bigger regions, similar to a "zoom-out" in game.

**-c, -check**

Creates only the first file in current folder as _timelapse_check.png_. This allows you to verify that the settings are alright, before starting the generation of all images.
