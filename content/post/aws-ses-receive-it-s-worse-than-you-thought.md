+++
author = "Daniel"
title = "AWS SES Receive: It's Worse Than You Thought"
date = 2020-12-06T22:48:52Z
lastmod = 2020-12-06T22:48:52Z
summary = "No IMAP client. No forwarding capabilities. And worst of all, a useless SPAM detection algorithm."
draft = false
image = "images/2020/12/ses-trash.png"
categories = [
  "Email"
]
tags = [
  "AWS",
  "SES",
  "Spam",
  "SMTP"
]
[amp]
  elements = ["amp-image-lightbox"]
+++
[AWS](https://aws.amazon.com) generally has great products, I use them almost exclusively, both professionally and privately, I am a what you could call a fanboy.

But now and then, they offer a service that is just utterly garbage, which becomes useless unless you write a lot around it. B2C services providfed by AWS often fall into this category.

One of this services is [SES Receiving](https://aws.amazon.com/ses/details/#Email_Receiving).

I [migrated from a self-hosted solution to AWS-SES-Receiving]({{< ref "/post/serverless-email-forwarder-with-aws-ses.md">}}) a few weeks back. My main area of concern is the lack of SPAM filtering.

I gathered enough data to realize that this service is very faulty, under performing and creates more problems than it solves.
It other words: it's useless or one could even say: total garbage.

## The bad stuff
This are limitation I was aware of before starting my migration and accepted them. But it would make the service so much more appealing if they where addressed.

### No IMAP client
AWS has the [WorkMail service](https://aws.amazon.com/workmail/), which comes with a Webapp and IMAP server and costs 4.00 USD/month/user. For 6.00 USD/month/user, you get a [Google Workspace](https://workspace.google.com/) account account, which includes so much more than just EMail (Drive, Meet, ...)

This isn't a deal breaker for me, since I only wanted to provide forwards to personal emails.

### No ability to forward messages
You have to send as a user from your domain, so no ability to forward an incoming message keeping the original external sender.

This is the main feature of my needs. I made peace with it, and rewrite the From field and providing a Reply-To.

### No in-built alias management
Everybody needs aliases. Be it only `info`. No way to do this in SES, unless you fiddle with the rules settings.

Not a deal breaker, since I was to [handle externally](http://github.com/danielMuller/ses-email-forward) all forwards.

## The totally broken stuff
This is the part that made me cringe the most.

### Spam filtering
_SES Receiving_ is absolutely worthless when it comes to SPAM filtering. Their functionality is totally useless, an important proportions of SPAM messages are still going through.

### What is happening
On average, 30 to 50 messages are received a day. The total sample rate is of 840.

{{<amp-figure
src="images/2020/12/msg_flow.svg"
title="Messages Flow"
caption="From reception to delivery"
width="400"
height="250"
>}}

Out of the 840 messages, SES identified:
* Spam: 198
* Invalid SPF: 2
* Ham: 640

On manual analysis (just checking the Sender and Subject), from this 640, I identified:
* False Negative: 559
* Ham: 81

From the _false negative_, 33 where dropped with a simple MX check on the sender's domain. Which leaves us with a delivery of 526 Spam messages to my end users.

{{<amp-figure
src="images/2020/12/ham-spam-ratio.svg"
title="Global Ham / Spam Ratio"
caption="Ratio based on all incoming messages"
width="400"
height="250"
>}}

{{<amp-figure
src="images/2020/12/missed-spam-ratio.svg"
title="Missed Spam Ratio"
caption="Ratio based on messages who passed SES checks"
width="400"
height="250"
>}}

87.3% of the messages claimed to be clean by SES are actually SPAM. This is an astonishing bad and shameful result.

## How to improve this?
There are a few obvious "tricks", which I started to implement:
* Check the sender's MX. If it doesn't exist, drop the message. This reduced the SPAM in only a minimalistic way.
* Use [Postmarks's Spamassassin API](https://spamcheck.postmarkapp.com/): It removed some SPAM, but not enough. Their rules seems top be a bit outdated.
* Run your own Spamassassin: which makes us going back to square one and hosting a solution on a server. Yes there is [Fargate](https://aws.amazon.com/fargate), or even [Lambda Container](https://aws.amazon.com/blogs/aws/new-for-aws-lambda-container-image-support/), but you still need to build and manage it.

## What AWS should do
AWS want's to proclaim themselves as a leader in [ML](https://aws.amazon.com/free/machine-learning). Then show us how! Give us a decent and bullet proof SPAM filtering solution.

We should be able to see some kind of confidence level and decide ourselves what is spam or not. We should even be able to cut the STMP communication early if the level is too high, and never have to process an obvious SPAM messages.

And also, allow us to call an API to declare what is SPAM and what is HAM, like any [Gmail](https://mail.google.com) Account allows us to do.

## In Conclusion
Almost 90% of the messages (yes that's 9 out of 10) claiming to be clean are actually SPAM. This doesn't check anybody's level of expectation.

Until AWS put's a lot of effort into SES, don't use them for your E-Mail solution. Just give your money to [Google](https://workspace.google.com/).
