+++
title = "Qmail: Routing outgoing SMTP through smarthost"
author = "Daniel"
date = "2014-03-15T08:06:09+00:00"
categories = [
  "Server"
]
tags = [
  "QMail",
  "SMTP",
  "Spam"
]
[amp]
  elements = ["amp-social-share"]
+++
If, like me, you are still using an old style LAMP stack combining Web and E-Mail, then you certainly made a "stay over" in SPAM-paradise.

## The Stack

I self-host my E-Mails, using [QMail](http://www.qmail.org/top.html) and [vpopmail](http://www.inter7.com/vpopmail/) with a bunch of intermediate tools like [Spamassassin](http://spamassassin.apache.org), [Clamav](http://www.clamav.net/), [Greylisting](http://oss.albawaba.com/cqgreylist.html), [DNSBL](http://en.wikipedia.org/wiki/DNSBL) checks. This helps to clean out incoming SPAM. Messages are delivered to users through [courier-imap](http://www.courier-mta.org) or qmail-pop3d.

For outgoing messages, Qmail sends (via qmail-remote) the messages via SMTP to the concerned MX servers. Qmail doesn't have a great way to handle SMTP-Auth, at least not without applying a bunch of patches. To allow users using the server to send E-Mails, I use [Anubis](http://www.gnu.org/software/anubis/) on the submission port. Anubis takes the incoming messages and feeds it to qmail-queue for final delivery.

## The problem

When you have outdated frameworks lying around and are too lazy to keep them up-to-date (Yes, I feel terribly ashamed), you become a spammer paradise. They will upload some php script and use this to do their harm. Aside from beeing able to gain access to some parts of your server, they will be able to send out massive amount of E-Mails. The end result is that your server ends up in almost all known spammer databases blocking your everyday legal messaging. Spamassassin and Clamav are scanning the ougoing messages, minimzing the harm. To avoid the scan and to avoid an entry in the smtp logs, the trick used by spammers is to directly talk to the remote SMTP, bypassing all safety net you have put in place.

One solution is to close port 25 for outgoing traffic. Port 25 for incoming needs to stay open, to continue receiving your E-Mails.

## SMTP Relay

You are going to block outgoing port 25, so you will need a relay that listen to another port. If your hosting company already has a solution in place, just use them. Else you can use a third party service to do the job. There are several solutions out there:

  * [Sendgrid](http://sendgrid.com)
  * [SocketLab](http://www.socketlabs.com)
  * [Postmark](https://postmarkapp.com)
  * [MailJet](http://www.mailjet.com/)
  * [AWS SES](http.//aws.amazon.com/ses/)
  * [ElasticEmail](http://www.elasticemail.com)

They all aim the same goal, provide a platform for Marketing E-Mails using a RESTful API, but they offer SMTP fallback, that's what we are looking for.

### Sendgrid

Price is too high. Minimum purchase is 10USD/month for 40'000 messages. I don't need that much.

### SocketLabs

Even worse than SendGrid: 15USD/month for 5'000 messages.

### Postmark

1.50USD for 1000 messages and they have a free trial period. They advertise their SMTP server as "transitional method" and recommend you to switch to API as soon as possible. I don't want to use HTTP for sending my mail.

### Mailjet

First 6000 messages per month a free. SMTP is part of their supported features. Seemed a good choice. But after creating an account, I wasn't able to use the service. They claimed there was a technical issue with my account creation and that I needed to contact them. Not really the kind of stability I am looking for. I went quickly away from this service.

### AWS SES

Obviously the cheapest: 0.1USD for 1000 messages. The problem is that you need to yerify the sender domain. If you have addresses that act only as forwards (info@company.com that redirects to company@gmail.com), you end up verifying every domain in the world.

### ElasticMail

1USD for 1000 messages. No monthly minimum. The first 1000 messages are free. Sign-up takes 2 minutes and it is up and running. You don't need to verify domains, but it is recommended. I chose to give ElasticMail a try.

## Patching qmail-remote

ElasticMail does not accept connexion based on IP rules, you need to pass a username and password. qmail-remote does not know how to do that: It's patching time! You need  the [qmail-remote-auth](http://tomclegg.net/qmail/#qmail-remote-auth) patch. This patch needs base64.c and base64.h which are included in the [qmail-smptd-auth](http://tomclegg.net/qmail/#qmail-smtpd-auth) patch. So we need to apply this patch too.

```bash
# Assuming qmail sources are located in /usr/local/src/qmail-1.03
cd /usr/local/src/
wget http://tomclegg.net/qmail/qmail-smtpd-auth-0.31.tar.gz
tar xzf qmail-smtpd-auth-0.31.tar.gz
cd qmail-smtpd-auth-0.31
qsrc=/usr/local/src/qmail-1.03
cp -i base64.? $qsrc/
(cd $qsrc &amp;&amp; patch) &lt; auth.patch
cd $qsrc
wget http://tomclegg.net/qmail/qmail-remote-auth.patch
patch &lt; qmail-remote-auth.patch
make qmail-remote
install -m 711 qmail-remote /var/qmail/bin/qmail-remote
```

## Telling Qmail to use relay host

Edit _/var/qmail/control/smtproutes_ to add ElasticEmail as gateway for all domains:

```bash
echo ':smtp.elasticemail.com:2525 api_username api_password' &gt; /var/qmail/control/smtproutes
qmailctl restart
```

## Closing port 25

We add some logging, to see if what we did is useful. We only want to block on the outgoing interface, not on the loopback interface.

```bash
iptables -A OUTPUT -o eth0 -m limit --limit 5/min -j LOG --log-prefix "PORT 25 DROP: " --log-uid
iptables -A OUTPUT -o eth0 -p tcp --dport 25 -j DROP
```
