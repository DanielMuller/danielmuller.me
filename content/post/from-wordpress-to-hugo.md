+++
author = "Daniel"
categories = ["Static"]
date = "2017-05-20T01:40:05+08:00"
lastmod = "2017-05-20T01:39:52+08:00"
tags = ["Wordpress", "Hugo", "AWS", "CDN", "Cloudfront"]
title = "From Wordpress to Hugo"
draft = false

+++

As mentioned in [Going Static]({{< relref "going-static.md" >}}), I migrated my [Wordpress](https://wordpress.org) blogs to a static site build with [Hugo](https://gohugo.io). Most articles on the subject convinced me that it would be easy. The truth is, it isn't that straight forward.

## Content
With help of a Wordpress [plugin](https://github.com/SchumacherFM/wordpress-to-hugo-exporter), exporting your posts and content is easy. The plugin adds the necessary [front matter](https://gohugo.io/content/front-matter/) in Yaml format.
But you still need to go through all your posts to update manually all image references. Depending on the amount of posts and images you have, this can be a tremendous task.
## Themes
Finding a theme is never an easy task. Specially if you want a theme as close as possible to your previous Wordpress theme. If you are not picky on themes, this step is an easy task.

Depending on the theme chosen, you will need to adapt each post's [front matter](https://gohugo.io/content/front-matter/) to add theme related informations, like cover image, author, ...
### A M P
I wanted my blogs to me [AMP](https://www.ampproject.org) validated. I didn't find a theme doing what I wanted. Using the concepts implemented in [gohugo-amp](https://gohugo-amp.gohugohq.com/), I wrote a theme for each of my blogs:

* Using Hugo's theme [Casper](https://github.com/vjeantet/hugo-theme-casper) as a base, I modified it to create [Campser](https://github.com/DanielMuller/hugo-theme-campser). *casper* + *AMP* = c**AMP**ster. This theme is currently used on [Far from Home](https://farfromhome.asia).
* Using this blog's wordpress theme [Origin](https://alienwp.com/themes/origin/) as a base, I created [Origin for Hugo](https://github.com/DanielMuller/hugo-theme-origin) from scratch. This theme is used on this blog.
{{<amp-figure
  src="images/2017/05/campser.jpg"
  caption="Hugo Theme Campser"
>}}
{{<amp-figure
  src="images/2017/05/origin.jpg"
  caption="Hugo Theme Origin"
>}}

### Front Matter
I modified all post's front matter from YAML to TOML, this was probably useless overkill work. But as said before, each post's front matter need to be edited to match the needs of theme.

### CSS
In Hugo, stylesheets are simply static files. I wanted to managed my styles with [Sass](http://sass-lang.com/), using [Gulp](http://gulpjs.com/) to generate the final css. Stylesheets are the concerns of the theme, if you just use an existing theme, you don't have to bother with this issue.

## Medias
This is probably the most time consuming part. Wordpress automatically creates several sizes of every image uploaded. There is no automation in Hugo to handle images.

### Images
To create different resolution for each image, I used [Gulp](http://gulpjs.com/) and several plugins:

* **gulp-responsive**: to create different variations for each image
* **gulp-changed**: to treat only images that haven't been treated yet
* **gulp-filter**: to assign different tasks for different image files
* **gulp-imagemin**: to load various images compression algorithms
* **imagemin-jpeg-recompress**: compression for jpeg
* **imagemin-pngquant-gfw**: compression for png

Sources images are stored in `src/images` and stored in `static/images` once processed. Hugo will use the content in `static/` to generate the site and not use the source images in `src/images`.

You need to define a list of output sizes, jpeg files are transformed in webp in addition to jpeg.

**gulpfile.js**
```javascript
const gulp = require('gulp')
const $ = require('gulp-load-plugins')()

// image lossy compression plugins
const compressJpg = require('imagemin-jpeg-recompress')
const pngquant = require('imagemin-pngquant-gfw')

const contentSrc = 'src/images'
const contentDst = 'static/images'
const pngFilter = $.filter(['**/*.png'], {restore: true})

function buildOutputs (sizes, resolutions) {
  var outputs = []
  for (let i = 0; i < sizes.length; i += 1) {
    let size = sizes[i]
    for (let j = 0; j < resolutions.length; j += 1) {
      let res = resolutions[j]
      let resext = '-' + res + 'x'
      if (res === 1) { resext = '' }
      let output = {
        width: size * res,
        rename: {
          suffix: '-' + size + 'px' + resext
        }
      }
      outputs.push(output)
      let webp = JSON.parse(JSON.stringify(output))
      webp.rename.extname = '.webp'
      outputs.push(webp)
    }
  }
  let squares = [150, 300]
  for (let i = 0; i < squares.length; i += 1) {
    let size = squares[i]
    let output = {
      width: size,
      height: size,
      crop: 'entropy',
      rename: {
        suffix: '-square-' + size + 'px'
      }
    }
    outputs.push(output)
    let webp = JSON.parse(JSON.stringify(output))
    webp.rename.extname = '.webp'
    outputs.push(webp)
  }
  outputs.push({
    progressive: true,
    compressionLevel: 6,
    withMetadata: false
  })
  outputs.push({
    rename: {
      extname: '.webp'
    }
  })
  return outputs
}

gulp.task('img-content', function () {
  return gulp.src(contentSrc + '/**/*.{jpg,png}')
    .pipe($.changed(contentDst))
    .pipe($.responsive({
      '**/*': buildOutputs([150, 360, 720, 1280, 1920, 3840], [1])
    }, {
      progressive: true,
      compressionLevel: 6,
      withMetadata: false,
      withoutenlargement: true,
      skipOnEnlargement: true,
      errorOnEnlargement: false,
      errorOnUnusedConfig: false
    }))
    .pipe($.imagemin([
      $.imagemin.gifsicle(),
      compressJpg({
        loops: 4,
        min: 50,
        max: 95,
        quality: 'high'
      }),
      $.imagemin.optipng(),
      $.imagemin.svgo()
    ]))
    .pipe(pngFilter)
    .pipe(pngquant({ quality: '65-80', speed: 4 })())
    .pipe(pngFilter.restore)
    .pipe(gulp.dest(contentDst))
})

gulp.task('images', ['img-content'])
gulp.task('img-content:clean', function () {
  return gulp.src(contentDst, {read: false})
    .pipe($.clean())
})
gulp.task('images:clean', ['img-content:clean'])
```
Markdown doesn't provide a solution to define automatically an `srcset`. Either you create every single one of them manually, or you can use a [Shortcode](https://gohugo.io/extras/shortcodes/) and [Partials](https://gohugo.io/templates/partials/) to automate the insertion of images.

```text
{{ $image := .Params.src }}
{{ $type_arr := split $image "." }}
{{ $srcbase := index $type_arr 0 }}
{{ $srcext := index $type_arr 1 }}
{{ $.Scratch.Set "srcbase" $srcbase }}
{{ $.Scratch.Set "srcext" $srcext }}
{{ with (imageConfig (printf "static%s" $image)) }}
    {{ $.Scratch.Set "srcwidth" .Width }}
    {{ $.Scratch.Set "srcheight" .Height }}
{{end}}

{{ $.Scratch.Set "srcset" "" }}
{{ range ( slice 150 360 720 1280 1920 3840) ", "}}
    {{ if gt ( $.Scratch.Get "srcwidth" ) . }}
        {{ $.Scratch.Set "srcset" ( printf "%s%s-%dpx.%s %dw, " ($.Scratch.Get "srcset") ($.Scratch.Get "srcbase") . ($.Scratch.Get "srcext") .) }}
    {{ end }}
{{end}}
{{ $.Scratch.Set "srcset" ( printf "%s%s.%s %dw" ($.Scratch.Get "srcset") $srcbase $srcext ($.Scratch.Get "srcwidth")) }}
<figure class="w450">
    <amp-img
        src="{{$srcbase}}.webp"
        {{ with .Params.alt }}alt="{{ range (split . " ") }}{{ . }} {{ end }}"{{ end }}
        {{ with .Params.attribution }}attribution="{{ range (split . " ") }}{{ . }} {{ end }}"{{ end }}
        srcset="{{ range (split ($.Scratch.Get "srcset") " ") }}{{ replace . $srcext "webp" }} {{ end }}"
        width="{{ $.Scratch.Get "srcwidth" }}"
        height="{{ $.Scratch.Get "srcheight" }}"
        {{ with .Params.lightbox }}
            tabindex="0"
            on="tap:{{.}}"
            role="link"
        {{ end }}
        layout="responsive"
        sizes="(min-width: 500px) 450px, 100vw"
    >
        <div fallback>
            <amp-img
                src="{{$srcbase}}.{{$srcext}}"
                {{ with .Params.alt }}alt="{{ range (split . " ") }}{{ . }} {{ end }}"{{ end }}
                {{ with .Params.attribution }}attribution="{{ range (split . " ") }}{{ . }} {{ end }}"{{ end }}
                srcset="{{ range (split ($.Scratch.Get "srcset") " ") }}{{ . }} {{ end }}"
                width="{{ $.Scratch.Get "srcwidth" }}"
                height="{{ $.Scratch.Get "srcheight" }}"
                {{ with .Params.lightbox }}
                    tabindex="0"
                    on="tap:{{.}}"
                    role="link"
                {{ end }}
                layout="responsive"
                sizes="(min-width: 500px) 450px, 100vw"
            >
            </amp-img>
        </div>
    </amp-img>
    {{ if or (isset .Params "title") (isset .Params "caption") (isset .Params "attr") }}
    <figcaption>
    {{ if isset .Params "title" }}
        <h4>{{ .Params.title }}</h4>
    {{ end }}
    {{ if or (isset .Params "caption") (isset .Params "attr")}}
        <p>
        {{ .Params.caption }}
        {{ if isset .Params "attrlink" }}<a href="{{.Params.attrlink}}">{{ end }}
        {{ .Params.attr }}
        {{ if isset .Params "attrlink" }}</a>{{ end }}
        </p>
    {{ end }}
    </figcaption>
    {{ end }}
</figure>
```

Inserting a multi source image becomes very easy:

```text
{{&lt;amp-figure src="/images/2014/09/VPN.png" caption="Standard Site-to-Site VPN setup"&gt;}}
```

# Dates
Hugo doesn't handle "Last modified" or "published date" automatically. You need to update the front matter manually. Nothing that a little sed based script can manage:
```bash
. bin/lastmod content/post/from-wordpress-to-hugo.md
```

**bin/lastmod**
```bash
#!/bin/bash

file='content/post/*.md'
update_draft_date=false

if [[ $1 ]]; then
    file=$1
    update_draft_date=true
    if [[ ! -f $file ]]; then
        echo "Error: No such file: "$file
        exit 1
    fi
fi

now=`date +%FT%T%:z`
sed -i '/^lastmod =.*$/d' $file
sed -i '/^date =.*$/a lastmod = "'$now'"' $file
echo "lastmod updated to "$now" on "`basename $file`

if [[ $update_draft_date ]]; then
    draft=`grep -i "^draft\s*=\s*true$" $file`
    if [[ $draft ]]; then
        sed -i 's/^date =.*$/date = "'$now'"/' $file
        echo "date updated to "$now" on "`basename $file`
    fi
fi

```

# Comments
Being static, there is no possibility to host comment. Most Hugo theme come with an easy [Disqus](https://disqus.com/) integration. Exporting your existing comment from Wordpress to Disqus is again made easy with a Wordpress [plugin](https://wordpress.org/plugins/disqus-comment-system/).

# Hosting
I chose [S3](https://aws.amazon.com/s3/) to host my blog and [Cloudfront](https://aws.amazon.com/cloudfront/). To avoid purging the cache after each deploy, I set a long TTL on images and a shorter one on HTML content. With this, new content is available as soon as published, but pages referencing the new post will be updated worst case in a few hours only.

I chose to deploy manually new content and note use any CI.

# Build and deploy
Using [npm](https://www.npmjs.com/) to orchestrate build and deploy, deploying the site becomes:
```bash
npm run deploy
```

The complete package.json is available on [github](https://github.com/DanielMuller/danielmuller.me/blob/master/package.json).
## HTTP redirects
Hugo handles HTTP redirects (like `/tags/1.html` redirected to `/tags/`) with html meta-tags. Nothing wrong with this practice, except that the http response is `200 OK` instead of `301 Moved Permanently` preferred by SEO engines.
S3 allows to create http redirects by using a specific meta-data. After building the site, we find all the files with `http-equiv="refresh"`, delete them and create an empty file in S3 with the correct meta-tag.

```bash
. bin/alias/build
. bin/alias/push
```

**bin/alias/build**
```bash
!/bin/bash
rm -f bin/alias/push
touch bin/alias/empty
rgrep -Po '(?<=http-equiv=\"refresh\" content=\"0; url=https://example.com).*(?=\".*)' public/* | while read line; do
    srcfile=`echo $line | cut -d':' -f1`
    dstfile=`echo $line | cut -d':' -f2`
    rm -f $srcfile
    cleansrcfile=`echo $srcfile | sed -e 's/^public\///'`
    echo "aws --region us-east-1 --profile default s3 cp --website-redirect $dstfile --cache-control 'max-age=43200' --storage-class REDUCED_REDUNDANCY --acl public-read bin/alias/empty s3://example.com/$cleansrcfile" >> bin/alias/push
done
find public/ -type d -empty -delete
```
# Conclusion
If you have a one-man Wordpress site, migrating to Hugo is a perfect solution. Specially if you add all the automation tasks. You not only win in security but you also win in delivery speed.

Getting new content is fast and easy too:
```bash
hugo new post/new-post-title.md
edit content/post/new-post-title.md
. bin/lastmod content/post/new-post-title.md
hugo undraft content/post/new-post-title.md
npm run deploy
```
