+++
title = "Network Speed Testing"
author = "Daniel"
date = "2012-12-09T05:48:41+00:00"
categories = [
  "Network"
]
tags = [
  "AWS",
  "Internet",
  "Javascript",
  "Speed"
]
[amp]
  elements = ["amp-social-share"]

+++
Everyone is aware of tools like [speedtest.net](http://speedtest.net) to get a sens of the Internet connectivity speed to certain regions. While it works on mostly every device it allows you to test speed to only one server at a time. And is primarily meant to test the speed of your ISP. I wanted to test connectivity to several part of the world in an _one click_ way, usable on multiple devices.

The answer didn't struck me at once, but it all can be done with some Javascript and mainly with the xhr object.

<!--more-->

## How does it work?

The html page makes requests through XHR on several files around the world, measuring time to download the file. Since it is done in Javascript, the file is downloaded client side thus giving the clients connectivity. Using HEAD instead of GET, gives us a fare sens of ping times.

## Host files around the world

Sadly, you cannot take any file from any server. You need to be in control, domain access restriction with XHR means that we need to configure [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) on the servers hosting the files. I choose to host the files on S3, since my company is already using AWS.

### Create files

Any file will do. Choose size between 256Kb and 1Mb. Too small will result in statistical errors and too big will just kill the clients bandwidth. If you don't have a file, just create an zero padded one.

```bash
dd if=/dev/zero of=testfile.bin bs=1024 count=512
```

Push this file to several S3 buckets around the world and make them public.

### Configure CORS

S3 allows you easily to configure CORS from their web console. Their default configurations allows only GET. We need to add HEAD.

```xml
?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
<AllowedOrigin>*</AllowedOrigin>
<AllowedMethod>GET</AllowedMethod>
<AllowedMethod>HEAD</AllowedMethod>
<MaxAgeSeconds>3000</MaxAgeSeconds>
<AllowedHeader>Authorization</AllowedHeader>
</CORSRule>
</CORSConfiguration>
```

You can restrict AllowedOrigin to your domain, to avoid peoples downloading illegally your empty file and increasing your bandwidth costs.

## Create and host an HTML page

You can host your HTML page on S3 and serve it through CloudFront. On Page-Load, HEAD is called 5 times on each file and GET is called 5 times on each file. Average response time is displayed in the page. The behaviour on DOM while tests are running is very browser dependent. Firefox allows DOM redraw between each request but Safari and Chrome don't. The user will have the impression that nothing is working.

```html
<html>
<head>
<title>Speed Test</title>
<script type="text/javascript">
<!-- javascript codes goes here -->
</script>
</head>
<body>
<h1>Speed test</h1>
<div id="spinner">
<div><h2>Test is running, please be patient</h2></div>
<div id="msg"></div>
</div>
<div id="results"></div>
</body>
</html>
```

The javascript code:

```javascript
var msg;

function getSpeed(testfile) {
  var attempts=5;
  var sum=0;
  for (var i = 0; i < attempts; i++) {
    msg.innerHTML+='.';
    var start = new Date().getTime();
    var X = new XMLHttpRequest;
    // make a GET, add a random query string to avoid local caching
    // Call is synchronous
    X.open("GET", testfile + "?" + Math.random(), false);
    X.send();
    var end = new Date().getTime();
    delta_t = (end - start)/1000;
    // get speed in kbps
    speed = 8 * X.responseText.length / delta_t / 1024;
    sum+=speed;
  }
  return sum/attempts;
}

function getPing (testfile) {
  var attempts=5;
  var sum=0;
  for (var i = 0; i < attempts; i++) {
    msg.innerHTML+='.';
    var start = new Date().getTime();
    var X = new XMLHttpRequest;
    // make a HEAD, add a random query string to avoid local caching
    // Call is synchronous
    X.open("HEAD", testfile + "?" + Math.random(), false);
    X.send();
    var end = new Date().getTime();
    delta_t = (end - start);
    sum+=delta_t;
  }
  return sum/attempts;
}

window.onload = function(){
  var urls=[
    {'Location':'East','url':'http://s3.amazonaws.com/my_bucket1/testfile.bin'},
    {'Location':'West','url':'http://s3-us-west-1.amazonaws.com/my_bucket2/testfile.bin'}
  ]

  msg = document.getElementById('msg');
  var results = document.getElementById('msg');
  var ping = 0;
  var speed = 0;
  for (var i = 0;i < urls.length; i++ ) {
    ping = getPing(urls[i]);
    speed = getSpeed(urls[i]);
    var result = document.createElement('div');
    result.innerHTML=urls[i].location + ' : ' + ping + ' ms, ' + speed + ' kbps'
    results.appendChild(result);
  }
  document.getElementById('spinner').innerHTML='';
}
```

# Make it better

While this code works, it is a bit "Quick and Dirty". Some improvement can be done using [JQuery](http://jquery.com) and asynchronous calls with callbacks, better presentations and telling the user whats going on. The user has to copy-paste the code and send it to support. Storing the results in a database (or email) would remove some pain.

You can take a look at others works on the subject:

  * https://github.com/anderssonjohan/Nettest
  * https://github.com/yahoo/boomerang

Based on Johan Andersson's work, I created a simplified multi-region version: [net_speed_test](https://github.com/DanielMuller/net_speed_test)
