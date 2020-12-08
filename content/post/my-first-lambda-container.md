+++
author = ""
title = "My First Lambda Container"
date = 2020-12-07T21:48:37Z
lastmod = 2020-12-07T21:48:37Z
draft = false
summary = "AWS announced the support for running containers inside Lambda. Since I had a little side project that would benefit from it, I dived in. I passed through the 4 stages of a typical Re:Invent announcement: excitement, disappointment, anger and resignation."
image = "images/2020/12/lambda.png"
categories = [
  "Serverless",
  "Email"
]
tags = [
  "AWS",
  "Lambda",
  "Spam"
]
[amp]
  elements = ["amp-image-lightbox"]
+++
Container support for Lambda was [announced](https://aws.amazon.com/about-aws/whats-new/2020/12/aws-lambda-now-supports-container-images-as-a-packaging-format/) at Re:Invent 2020. At first, I didn't think much of it. My projects are generally small enough to work fine with a little `npm i`. But I have a little side project that could benefit from it: running Spamassassin inside [Lambda](https://aws.amazon.com/lambda/) to tackle [SES's spam tagging failure]({{< ref "/post/aws-ses-receive-it-s-worse-than-you-thought.md" >}}).

Despite not being very familiar with Docker, I pulled my sleeves back and started on the project. This put me through the typical 4 stages of an AWS Re:Invent announcement:

  * :heart_eyes: Excitement
  * :disappointed: Disappointment
  * :rage: Anger
  * :expressionless: Resignation

<br/>

## My Journey

### Stage 1: Excitement
Being able to use Lambda in my SES flow without calling a third service, what a relief. Building a container for Lambda shouldn't be that hard...

Lucky for me, [Danilo Poccia](https://aws.amazon.com/blogs/aws/author/danilop/) did a great [blog post](https://aws.amazon.com/blogs/aws/new-for-aws-lambda-container-image-support/) on how to build your own image from scratch.

I used the [spamassassin image](https://github.com/instantlinux/docker-tools/tree/master/images/spamassassin) provided by [instantlinux](https://github.com/instantlinux) to get me started. I chose this image, because it runs on [Debian](https://debian.org), configures Razor, Pyzor and DCC correctly.

I just needed a [NodeJS Spamc](https://www.npmjs.com/package/spamc) implementation in my function, pass the body of the E-Mail to Lambda et voilà.

I fired up the container locally, threw some messages at it and there it was, all the messages that SES let through where putting Spamassassin's score into the dark red. I finally had a solution that was cheap (aka pay only when needed) and without any change in my current flow, except adding a `lambda.invoke`.

At that point, I had big plans for a v2 with [EFS](https://aws.amazon.com/efs/) backed storage to share Bayes and manual learning of falsely classified messages. One can dream big...

### Stage 2: Disappointment
I pushed my image into [ECR](https://aws.amazon.com/ecr/) (Thank You [ecr-credential-helper](https://github.com/awslabs/amazon-ecr-credential-helper), your tool made my life easier), quickly configured a Lambda manually through the console and invoked it with a test content.

That's when I fell from excitement into disappointment. Everything that worked so perfectly locally, just failed in a big ball of fire. My container in Lambda had the same constraints than any function in Lambda: it runs on a read-only system. I was now unable to run `sa-update`, unable to bind `spamd` to 127.0.0.1:783. No pid files could be written, no log files per services, ...

### Stage 3: Anger
I naively thought that I could do what I want with my container. No Lambda runtime would go into my way. I was first very angry at AWS for promising me something that didn't meet my wishes/hopes (I generally always somehow land into this state with a new service).

Then I got angry to myself for not having foreseen the obvious, it is logical that my container runs in read-only. It's still Lambda.

I started to try to move everything to /tmp, which kind of worked after several trial-and-error. I don't know how to emulate this in my local Docker, so I had to test online each little tweak. I was still hitting a problem, running spamd on a file socket instead of an io socket, I somehow never got it to work. I wanted to keep spamd, since it gave me a nice output with just the score and the rules.

### Stage 4: Resignation
After a few hours, I caved in and let go of my dreams of a fleet of spamd with shared config and rules.

I decided to just run [spamassassin](https://spamassassin.apache.org/) and parse the headers on the modified message. `sa-update` runs during `image build` and logs are sent to stderr. I disabled DCC, hoping that the standard RBL rules in addition to Pyzor and Razor should be a good enough start. Can't be worse than what SES is doing.

## Does it work?
I have this in production since less than 2 days at time of writing, not enough data to make a definitive statement, but so far it behaves very nicely. All the spams are discarded, and no false positive so far. :crossed_fingers:

The function runs between 10 and 12 seconds and uses between 180 and 220 MB (~0.01¢).

You can find it on [Github](https://github.com/DanielMuller/lambda-docker-spamassassin) or on [Public ECR](https://gallery.ecr.aws/z5f6y0y4/danielmuller/lambda-spamassassin).

## What is still missing
Despite the read-only limitation, which will probably never be lifted, you currently can't use an image from another account's ECR. You also can't use an image published to public ECR. I guess this are just limitations on a brand new service, and should be lifted in the near future. For now, I just need to push my image to the 2 accounts where they are needed. Some [CodePipeline](https://aws.amazon.com/codepipeline/) would come in handy.

## What's next ?
I could use an EventBridge Scheduler to rebuild the image weekly to have the rules up-to-date. Which anyway is a better solution than pulling them at every start.

Else, I had thoughts about running this on [Fargate](https://aws.amazon.com/fargate) before, but I didn't insist enough on trying to get down to 0 when there is nothing to process.
[AWS batch](https://aws.amazon.com/batch/) could be another contender, now that it [runs on Fargate](https://aws.amazon.com/about-aws/whats-new/2020/12/severless-batch-scheduling-with-aws-batch-and-aws-fargate/).

## In Conclusion
Lambda Container won't become my major way of deploying Lambda. I just find the hassle of building, deploying, testing your container more troublesome than an `sls invoke local` and `sls deploy`.

But I can see why this will appeal to some peoples, specially when you need tools compiled that you can't compile on your development machine ([sharp](https://github.com/lovell/sharp) comes to mind), or if you can't just `npm`, `pip` or `go get` in your dependencies.
