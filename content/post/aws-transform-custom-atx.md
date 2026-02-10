+++
author = "Daniel"
title = "Use AWS Transform to modernize your stacks"
date = 2026-01-12T11:23:00+00:00
lastmod = 2026-01-12T11:23:00+00:00
draft = false
image = "images/2026/01/aws-atx.jpg"
categories = [
  "Serverless",
  "NodeJS"
]
tags = [
  "AWS",
  "Transform",
  "AI"
]

+++

You have some Lambda functions written a few years back, and you suddenly realize that the NodeJS version you are using is no longer supported and you are several versions behind. You have postponed since too long the upgrade and now you are afraid to try to upgrade them.
Does this scenario feel familiar? You are not alone.
<!--more-->
AWS announced [AWS Transform Custom](https://aws.amazon.com/transform/custom/) at Re:Invent26, to help with keeping legacy technologies up-to-date with the help of AI.

The tool, named ATX, is a CLI that interacts with the AWS Transform service and applies transformations to your code. You can leverage existing transformations published by AWS, but the power lies in the ability to define your own transformations tailored to your business needs and apply them in batches to multiple repositories.

Your own transformations can be published to your AWS Account and re-used by other teams based on their IAM access rights.

# How does it work?
Transformations are defined as `markdown` files and contain the steps and modifications needed in plain english. `atx` will read this transformation definition and leverage AWS AI tools to apply the transformations to your locally hosted code.

Your code isn't hosted on AWS, instead your code will be sent and retrieved by AWS Transform when transformations are needed.

# Install ATX
The command line tool can be installed on Linux, MacOS or on the Windows Subsystem for Linux:

```bash
curl -fsSL https://desktop-release.transform.us-east-1.api.aws/install.sh | bash
```

To be able to use `atx` you need an AWS Account and an IAM user with the rights on `"transform-custom:*"`.

More details on [AWS's product page](https://docs.aws.amazon.com/transform/latest/userguide/custom-get-started.html).

# List existing transformations
Some predefined, commonly needed transformations, are made available by AWS.

```bash
atx custom def list
```

Note the ones that are of interest to you, `AWS/nodejs-aws-sdk-v2-to-v3 ` or `AWS/nodejs-version-upgrade` are the ones useful to me, but other transformations targeted to Java or Python are also available.

Sadly, the transformation definitions for transformations provided by AWS can't be downloaded and previewed.

# Interactive mode
The interactive mode allows you to create a new transformation from scratch. During the interactive phase, you pass all the prompts defining your transformations. At each step, `atx` will enhance the transformation definition file. You can at any time modify the definition file directly, since it is a markdown file.

You can exit the interactive mode, make your modifications, and re-open interactive mode and load your locally stored markdown definition and continue your work.

Once you are satisfied with your transformation, you can publish it to your AWS Account to either allow other developers to use it, or to simply run the same transformation from another client on a different source code.

To enter interactive mode, simply start `atx`:
```bash
atx
```

By default, each action taken by `atx` needs to be trusted once for each type of access. You can instruct `atx` to automatically trust access to your files:

```bash
atx -t
```


## Upgrade AWS SDK
Once in the interactive shell, you can instruct the AI to execute transformations. Let's use the aws-sdk V2 to V3 transformation by AWS:
```text
List existing transformations

I can see 8 AWS-managed transformations available:

1. Java AWS SDK v1 to v2
2. Node.js AWS SDK v2 to v3
3. Python boto2 to boto3
4. Python version upgrade (3.8/3.9 to 3.11/3.12/3.13)
5. Node.js version upgrade
6. Comprehensive codebase analysis (early access)
7. Java version upgrade
8. Java x86 to Graviton (early access)

Please select a transformation by entering either:
- Its number (e.g., "1", "2", "3")
- Its exact name (e.g., "AWS/java-aws-sdk-v1-to-v2")

Or let me know if you'd like to create a new custom transformation instead.

```
Simply enter `2` to tell `atx` that you want to use `Node.js AWS SDK v2 to v3` and enter the path to your source code once asked.

In the first step, `atx` will analyze your code and give you a summary of the changes. If you agree, just tell `atx` to proceed.

Once the transformation is applied, all steps are committed as separate commit.

### Transformations logs
Logs of your transformations are located in `~/.aws/atx/custom/<executionId>/`.

You can find the full conversation logs, the plan and also a markdown file describing all the modifications applied.

## Create your own transformation
The next step for our upgrade plan, is to migrate from the ServerlessFrameworkV3 (with webpack) to ServerlessFrameworkV4 (with eslint) to allow upgrading to NodeJs24.

Start `atx` in interactive mode and tell it that you want to create a new transformation:

```text
> I want to create a new transformation
What kind of transformation would you like to create?

> Upgrade serverless framework from version 3 to version 4. Replace webpack with in-built esbuild
To create an effective transformation definition, it would be useful to know:
- What runtime are you using (Node.js version, Python, etc.)?
- Are you using any custom webpack configurations or plugins that need special handling?
- Do you have TypeScript in your project?

You can also provide file paths to migration guides, documentation, example serverless.yml files,
or before/after code examples if you have them. If you don't have these available, you can always add them later.

> I want to use NodeJS24. No specific webpack configuration.
```text

The CLI will provide you with a plan of the intended changes. At this stage, you can refine your transformation by explicitly giving example or details of what you want to achieve.

You can analyze the generated transformation document located in `~/.aws/atx/custom/<sessionId>/artifacts/tp-staging/transformation_definition.md`.

Once your are happy with the changes proposed, you can instruct `atx` to publish the transformation to your account or apply it to your code.

```text
You can review and update the transformation definition directly at that location if needed.

Would you like to:
1. Apply this transformation to your code
2. Publish this transformation to the registry
3. Make further refinements to the transformation definition
4. Create a different transformation
```

Apply to transformation to your code:
```text
apply to ~/path/to/code/folder
```

Same as when applying an existing transformation, `atx` will first propose a plan, that ou can validate before proceeding.

The execution time will depend on the size of your repo and the complexity of the changes needed. This can range between 10 minutes and 50 minutes.

### Transformation Definition
The generated transformation definition can be viewed here: [slsv3-slsv4-transformation.md](/atx/slsv3-slsv4-transformation.md).

### Results
`atx` tried to bundle using esbuild, but the dependencies in my repo didn't allow for esbuild building. `atx` tried several ways by itself, but finally decided to use the basic bundling from serverless, which is just bundling all the files in the repo. This results in bigger than expected zip sizes.

By giving additional guidance in the transformation definition, we can instruct `atx` to try to prioritize esbuild and fallback to webpack.

```text
When esbuild is not a solution, try to modify the code to make it usable with esbuild. Fallback to using webpack when no other solution is possible.
```

## Resume interactions
In case you need to stop and resume an interaction, you can do so by passing the transactionId when starting `atx`.

An interaction can also stop, when your credentials aren't valid anymore. In this case, the communication with `atx` will fail and you would need to re-authenticate and resume.

# Headless mode
The headless mode allows you to apply the transformation without any user input. This is ideal for proven transformation and large scale upgrade of several stacks in parallel.

The tool will create a new branch, create several commit on that branch, bit won't push the changes. This step is still in the hand of the developers. This can obviously be taken care of automatically through shell scripting.

```bash
atx custom def exec -n <transformation-name> -p <path> -x -t
```

# What did we achieve?
By using 2 different transformations, one provided by AWS and one created on our own, we transformed a stack using SLSv3 with NodeJs20 and aws-sdk v2 to the latest standards using SLSv4 with NodeJs24 and aws-sdk v3.

We didn't achieve bundling our code in a efficient manner. But with some more tweaking this can be achieved.

# Where to go from here?

We want to move the headless solution to the next level, by running it on an EC2 instance or even multiple EC2 instances in parallel.

Combining AWS Batch and SQS we can process multiples repositories in parallel, apply the changes, commit the changes, push the changes and create a PR that can be reviewed by developers, QA or other stakeholders on the project.

The triggers for this parallel executions can come from various sources:
- New NodeJS version published to AWS Lambda => Apply Transformation to every single tracked repository
- New version of an internal dependency: => Apply Transformation to every single tracked repository
- An many more...
