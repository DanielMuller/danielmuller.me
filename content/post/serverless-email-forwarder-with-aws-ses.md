+++
author = "Daniel"
title = "Serverless E-Mail forwarder with AWS SES"
date = 2020-10-28T11:27:40+00:00
lastmod = 2020-10-28T11:27:40+00:00
draft = false
image = "images/2020/10/ses-forward.png"
summary = "If you don't need (or don't want to pay for) a real E-Mail solution for your domain, but just need to communicate nice looking addresses and have them forwarded to your real, fully fledged E-Mail host. Then this solution is for you."
categories = [
  "email",
  "Serverless"
]
tags = [
  "AWS",
  "Lambda",
  "SES",
  "DynamoDB"
]
+++
## A little walk on memory lane
I used to [manage my own E-Mail server]({{< ref "post/2014-03-15-qmail-routing-outgoing-smtp-through-smarthost#the-stack" >}}) with SMTP, IMAP, POP3, Webmail, Spamassassin, Greylisting, SSL Certs, ...

After several improvements, fixes and iterations over the years, I ended up running the whole stack with [Mailcow](https://mailcow.email/) on a [Digitalocean](https://www.digitalocean.com/) droplet and a [Mailgun](https://www.mailgun.com/) relay host, but never jumped on the [mailcow dockerized](https://github.com/mailcow/mailcow-dockerized) train.

The main issues faced with this setup:
* Handling spam is a nightmare. Legit messages don't go through and spam just piles up
* Your server IP always ends up on some kind of blacklist
* You need to run and maintain a server 24/7

I ended up moving some domains to an existing [GSuite](https://workspace.google.com/) (now Google Workspaces) account or other web+mail hosting providers.

The remaining domains, used mainly for non-profit groups with redirects to private mailboxes of its members. The existing paid services didn't allow easy management or where too expensive.

## Using SES Email receiving
[SES](https://aws.amazon.com/ses/) is mostly known for it's ability to [send E-Mails](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/send-email.html). But SES is also able to [receive E-Mails](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email.html), but only in a limited set of regions:
* North Virginia (us-east-1)
* Oregon (us-west-2)
* Dublin (eu-west-1)

This service isn't a fully blown E-Mail service, you can't access them with POP3 or IMAP protocols for example. It looks like it was initially created as an [MDA](https://en.wikipedia.org/wiki/Mail_delivery_agent) for [WorkMail](https://aws.amazon.com/workmail/).

But SES Email receiving isn't only for WorkMail, through rules you can add headers, send to S3, send to Lambda, send to SNS or return a bounce.

This consists of a rule-set comprised by multiples rules. Rules are executed in order. A rule can be executed only for a specific domain or even a specific destination.

Each rule consist of several actions, executed in order. An action can be a Lambda invocation, an S3 storage, a bounce, ...

When using Lambda, the functions return code can stop the current rule (and go the the next, skipping other actions in the rule) or stop the entire rule-set ending the process without any notification to the sender.

We will use _SES Email receiving_ with [Lambda](https://aws.amazon.com/lambda/) and _SES email sending_ to achieve our redirection service.

## Global concept overview
{{<amp-figure
  src="images/2020/10/SES-forward-diagram.png"
  caption="SES Forward General Diagram"
>}}

* example.com's MX is set to send E-Mails to _SES E-Mail Receiving_
* The E-Mail is passed to a first lambda function
* Using the metadata added by SES, we either stop the rules (dropping silently the message) or proceed to the next step
* The E-Mail is passed to a second lambda function
* The recipients address is looked up in a [DynamoDB](https://aws.amazon.com/dynamodb/) table to retrieve all the destinations for this address
* If no result is returned, we send back a bounce
* We rewrite the raw E-Mail message to replace the _From_ header with a dummy address from our domain
  
  This is an annoying SES limitation, where the sender domain needs to be one of the validated SES domains
* We add the original sender as _Reply-To_ header
* We use SES to send the modified message to all destinations

## TLDR: Just install and run it
You can install my ready made solution built with the [serverless.com](https://serverless.com/) framework from my Github repo: [ses-email-forward](https://github.com/DanielMuller/ses-email-forward).

You can also install the optional [management web UI](https://github.com/DanielMuller/ses-email-forward-ui) (built with [Amplify](https://amplify.aws/) and [Quasar](https://quasar.dev/)).

Or you can continue reading if you want to know more.

## Prepare your account
Some steps aren't taken care by installing the solution. You need to configure them before installing the solution.

Choose one of the 3 regions in which SES email receiving is available.

### Create SNS topics
The SNS topics are used with _SES Email Sending_. Since your domain can be used to send messages from other services, we manage this topics manually, so that they can be retained when deleting the project.
* Bounce Notifications
* Complaint Notifications
* Delivery Notifications (optional)

You can attach any email or lambda function to this topics for debugging purpose.

### Whitelist your domain
* Validate your domain under _Identity Management_/_Domains_. This is needed to allow both incoming and outgoing messages
* Attach the 3 SNS topics to each notification type.
* Enable DKIM
* Add a MAIL FROM Domain (optional)
* Create a support request to remove your account from the global sanbox. In sanbox mode, you are only allowed to send emails to validated destinations.

### Create _SES receiving_ default-rule-set
An empty active rule set name _default-rule-set_ needs to exist.

## Infrastructure created by SES E-Mail Forward
### Incoming Rules
An SES incoming message passes through a rule-set, comprised by multiples rules. Each rules can apply to all messages or only for specific recipients through a wildcard matching.

We use 2 sets of rules, valid for all recipients:

#### 1. Spam Filtering
By enabling _spam and virus scanning_ in the rule, SES adds several [verdicts](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-notifications-contents.html#receiving-email-notifications-contents-receipt-object) to the message:
* __spamVerdict__: PASS | FAIL | GRAY | PROCESSING_FAILED
* __virusVerdict__: PASS | FAIL | GRAY | PROCESSING_FAILED
* __spfVerdict__: PASS | FAIL | GRAY | PROCESSING_FAILED
* __dkimVerdict__: PASS | FAIL | GRAY | PROCESSING_FAILED
* __dmarcVerdict__: PASS | FAIL | GRAY | PROCESSING_FAILED
* __dmarcPolicy__: none | quarantine | reject

Example data:
```json
{
  "receipt": {
    "timestamp": "2020-10-25T09:38:44.495Z",
    "processingTimeMillis": 280,
    "recipients": [
      "john.doe@example.com"
    ],
    "spamVerdict": {
      "status": "PASS"
    },
    "virusVerdict": {
      "status": "PASS"
    },
    "spfVerdict": {
      "status": "PASS"
    },
    "dkimVerdict": {
      "status": "PASS"
    },
    "dmarcVerdict": {
      "status": "PASS"
    },
    "action": {
      "type": "Lambda",
      "functionArn": "arn:aws:lambda:us-east-1:123456789000:function:sesEmailForward-spam",
      "invocationType": "RequestResponse"
    }
  }
}
```

This rule has 2 actions:
* Pass the message to [Lambda](https://github.com/DanielMuller/ses-email-forward/blob/master/services/spam.js) (Type: _RequestResponse_)
  * If _dmarcVerdict_ fails and _dmarcPolicy_ is "reject", returns _null_ to enter the next action and bounce the message.
  * If any of the other verdicts fails, return "STOP_RULE_SET" to silently drop the message.
  * If none of the verdicts fails, return "STOP_RULE" to go to the next rule.
* Return a bounce (_5.6.1 Message content rejected_)

#### 2. Redirections

We don't need to enable _spam and virus scanning_, since this the message where filtered by the first rule already.

This rule has 3 actions:
* Store the raw message in S3
* Pass the message to [Lambda](https://github.com/DanielMuller/ses-email-forward/blob/master/services/process.js) (Type: _RequestResponse_)
  * Lookup a forward table and fetch all destinations for the original recipient
  * Remove any destination that previously bounced
  * If there are valid destinations:
    * Fetch the original message from S3
    * Rewrite _From_
    * Send the message to the new destinations
    * Return _STOP_RULE_SET_
* Return a bounce (_5.6.1 Message content rejected_)

### S3 Bucket
We use an S3 bucket as a temporary storage for the messages. The bucket has a lifecycle to delete it's content after a few days.

SES is granted write rights via a Bucket Policy:
```json
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*",
      "Condition": {
        "StringEquals": {
          "aws:Referer": "123456789000"
        }
      }
    }
  ]
}
```

### DynamoDB tables
#### Aliases
This is the main table. It contains the mapping between a recipient and its destinations. We also store the amount of bounces per destination in this table.

This table isn't populated directly, but through triggers on the other tables.

Typical content:
```json
[
  {
    "alias": "john.doe@example.com",
    "destination": "john.doe@gmail.com",
    "bounces": 0
  },
  {
    "alias": "john.doe@example.com",
    "destination": "john.doe@hotmail.com",
    "bounces": 0
  },
  {
    "alias": "help@example.com",
    "destination": "example@zendesk.com",
    "bounces": 0
  }
]
```

#### Domains
Contains aliases between domains.

```json
[
  {
    "domain": "example.net",
    "aliasfor": "example.com"
  },
  {
    "domain": "example.org",
    "aliasfor": "example.com"
  }
]
```

#### Bounces
Bounces from SES of destinations are added to this tables. Each entry has a _Time To Live_ and will be removed after some days.

This table has a trigger. After each change, a [Lambda](https://github.com/DanielMuller/ses-email-forward/blob/master/services/updateBounceCount.js) is invoked to update the bounce counter in the [Aliases](#aliases) table.

We use this bounces to avoid sending messages to invalid destinations to avoid that SES blacklists our account.

#### Definitions
This table is used to define the mappings. There is one entry per alias with destinations being an Array. Additional informations are there to help filtering.

On change, a [Lambda](https://github.com/DanielMuller/ses-email-forward/blob/master/services/buildForwards.js) trigger is executed to update the [Aliases](#aliases) table.

Typical entry:
```json
[
  {
    "domain":"example.com",
    "alias": "john.doe",
    "destinations": [
      "john.doe@gmail.com",
      "john.doe@hotmail.com"
    ],
    "type":"person",
    "active": true
  },
  {
    "domain":"example.com",
    "alias": "info",
    "destinations": [
      "john.doe"
    ],
    "type":"group",
    "active": false
  },
  {
    "domain":"example.com",
    "alias": "help",
    "destinations": [
      "example@zendesk.com"
    ],
    "type":"group",
    "active": true
  }
]
```

### Lambda functions
Accessible in the [services](https://github.com/DanielMuller/ses-email-forward/tree/master/services) folder.

#### spam.js and process.js
This functions are associated to the relevant SES rules.

SES needs to have the right to invoke them:

```json
{
  "StatementId": "GiveSESPermissionToInvokeFunction",
  "Action": "lambda:InvokeFunction",
  "FunctionName": "My LambdaFunction",
  "Principal": "ses.amazonaws.com"
}
```

#### triggerBuild.js
Called when the [definitions](#definitions) table changes. It executes _buildForwards_ asynchronously.

#### buildForwards.js
Builds the content for the aliases table from the definition table.

#### updateBounceCount.js
Updates the bounces counter in the [aliases](#aliases) table upon a change in the [bounces](#bounces) table.

#### bounceOrComplaint.js
Triggered from the SNS-Bounces or SNS-Complaints topics. It adds entries to the [bounces](#bounces) table.

### Cloudwatch Metrics
[Cloudwatch Metrics](https://github.com/DanielMuller/ses-email-forward/tree/master/resources/MetricFilter) are a created from Cloudwatch Logs.

### Cloudwatch Dashboard
A simple dashboard to visualize messages.
