+++
title = "The Corporate Disease"
author = "Daniel"
date = "2015-03-06T06:16:14+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
categories = ["Thoughts"]
tags = ["aws", "akamai", "tata", "cdn"]
[amp]
  elements = ["amp-social-share"]
+++
The tech B2B world has changed in the last decade. It used to be sales talks to sales and agree on a product and price. Then give the job to the tech team.

In a tech-startup, Geeks are King. They decide what's useful or usable.

> If you can't convince the geek, you won't get the business.

At [Spuul](https://spuul.com), I am on geek-side of the chain, and too often I had to experience the lack of market knowledge from some corporations. If I have to spend endless hours in meetings, sign an endless trail of paperwork and involve all departments of the company just to be able to start testing a service, the game is not worth it. It doesn't matter how good your product is or how well [Gartner](http://www.gartner.com) ranks you. You are just too much hassle.

> Lock us in with features and awesomeness, not contracts!

## Amazon

  * Username, password, Credit Card
  * Access to everything
  * Stop using => stop paying
  * Never speak to a sales rep

Let's take [AWS](http://aws.amazon.com). It's straight forward: username, password, credit card. You pay what you use, no minimal fee, no minimal term. And you get instantly access to all the products. For a minimal cost you are able to decide if the tools are what you need. If not, stop using them and therefore stop paying for them.

## Akamai

  * Contract, paperwork
  * Access to features part of your contract only
  * Akamai needed for some configurations
  * Pay until contract ends

One of Amazon's product we where not 100% satisfied with was [Cloudfront](http://aws.amazon.com/cloudfront/). We decided to try out [Akamai](http://www.akamai.com). Even to try the product out, you need to start with a contract. It took us several month of meetings to agree on a _pay-as-you-go short term tryout_ contract. Once we finally received our credentials to an account, I needed to attend a technical meeting. I was pleased with the idea that in an afternoon, Akamai's tech team would walk me through the config and that I would leave with everything set up and running. I was soon to be disappointed, the meeting was to walk me through all the aspects of their dashboard. I came out without having anything near to be ready to test.

I was only able to set-up a basic configuration by myself. When I wanted something more complex, I needed to fill a ticket and let Akamai do the job. When I wanted more features, I couldn't, because it was "_not part of the product we purchased_".

Even if Akamai performs slightly better than Cloudfront, the hurdles one need to face are not worth it. I decided to drop Akamai, not for technical reasons but simply for administrative reasons.

## Instacompute

  * Cheap to test
  * Delay for account verification
  * Outdated and buggy technology
  * Access to everything (that works)
  * Lack of documentation
  * Stop using => stop paying

I needed a server running in India. AWS doesn't have that (yet?). The VPS hosting business in India is near to inexistent. Most of the services are 1 year VPS contracts with awfully low bandwidth limits. I don't want to pay 1 year to test a service for an afternoon. Luckily, one popped out: [Instacompute](http://www.instacompute.com/) (owned by Giant Corporate [Tata](http://www.tata.com), this should have ringed a bell). Launch servers and pay-by-the-hour. I will be able to try it out during a few hours and start looking for something else if it doesn't fit. Entering username, password and credit card. But still no straight away access! First pain: I need to contact support: "_To open your account, we need to verify you first, what is your phone number so we can interview you?_". Ouch! You have my Credit Card, why the hell do you want to know what I am doing. Just take my money and let me play!

After the call, still no direct access. I needed to wait one more day to get my account opened. And then, the big blow. On paper, the service seamed great and mature. But it is far from that. Usable Images are 4 year old ([Ubuntu](http://www.ubuntu.com) 10.04, [CentOS](http://www.centos.org) 6.3, no [Debian](http://www.debian.org)), no documentation. User forum has only messages from the Instacompute team, and most recent is from 2012.

The whole service feels like a summer Internship project bought by Tata which never bothered to follow-up with technology.
