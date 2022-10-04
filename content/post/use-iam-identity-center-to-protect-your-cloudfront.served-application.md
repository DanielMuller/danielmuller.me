+++
author = "Daniel"
title = "Use IAM Identity Center (AWS SSO) to protect your Cloudfront served application"
date = 2022-10-04T22:10:32+01:00
lastmod = 2022-10-04T22:10:32+01:00
draft = false
image = "images/2022/09/aws-sso.png"
summary = "You built a new web application, you are serving it using Cloudfront, but you want that only members from your organization can view the pre-release version. You want to add a password protection using the already existing IAM Identity Center (Successor to AWS Single Sign-On) to grant access to your organization."
categories = [
  "Security",
  "Static",
  "Serverless"
]
tags = [
  "AWS",
  "CDN",
  "Cloudfront",
  "Lambda",
  "SSO",
  "S3"
]
origin="https://serverlessguru.com/blog/use-iam-identity-center-aws-sso-to-protect-your-cloudfront-served-application"
+++

Using [Cloudfront](https://aws.amazon.com/cloudfront/) to distribute your web application is a good practice, by leveraging caching at the Edge, you ensure that your visitors will get the lowest latency possible.

But what if you had a pre-release of your application that isn't for the whole world to see, but you still want to provide the same experience as you will in production? Cloudfront doesn't propose a solution out-of-the-box for this.

## Lambda@Edge or Cloudfront-Functions
Luckily, Cloudfront has ways to act on request by using either [Lambda@Edge](https://aws.amazon.com/lambda/edge/) or [Cloudfront-Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html).

Several solutions already exist leveraging theses services to add different types of password protection or user authentication on Cloudfront:
* HTTP Basic Authentication using Cloudfront-Functions: [joshualyman.com](https://www.joshualyman.com/2022/01/add-http-basic-authentication-to-cloudfront-distributions/)
* CloudFront authorization@edge: [aws-samples](https://github.com/aws-samples/cloudfront-authorization-at-edge)

## Using SAML Authentication with existing IAM Identity Center
You might have set-up your AWS Accounts using [Control Tower](https://aws.amazon.com/controltower) with [Organizations](https://aws.amazon.com/organizations/) and are managing your members using [IAM Identity Center](https://aws.amazon.com/iam/identity-center/) (Successor to AWS Single-Sign-On). Or you are using AWS Identity Center as a standalone tool to centralize your SSO credentials for 3rd party applications.

### The solution

The application is the SAML Service Provider (SP), IAM Identity Center is the SAML Identity Provider (IdP).

1. For each request, the SP validates the encrypted authorization cookie using a Lambda@Edge function in the _viewer-request_ event.
1. If the Cookie isn't valid:
    1. The Lambda@Edge function will create an _Authorization Request_ and redirect the browser to the relevant IdP Endpoint.
    1. The IdP provides the user with a login page.
    1. Upon successful login, the IdP generates a _SAML Assertion Document_ and redirects the browser to the _SP ACS Endpoint_.
    1. The SP validates the assertion, sets an encrypted authorization cookie in the browser and redirects the browser to the originally requested URL.
1. If the Cookie is valid:
    1. The content is either served from the cache or retrieved from the origin.

{{<amp-figure
src="images/2022/09/saml-sso-diagram.png"
caption="Service Provider initiated login with IAM Identity Center using Lambda@Edge"
>}}

## Add an Application in IAM Identity Center
We assume that you already have IAM Identity Center setup, perhaps already with some groups and users.

* Open the AWS Console
* Open IAM Identity Center
* On the left menu, expand "Application assignments" and click on "Applications"
* Click on the "Add application" button on the right
* Choose "Add custom SAML 2.0 application" and click on the "Next" button
* Enter a user friendly _Display Name_
* enter a user friendly _Description_
* Download the _IAM Identity center SAML metadata file_, you will need it to configure the solution
* Leave _Application start URL_ and _Relay state_ empty
* Enter dummy values for _Application ACS URL_ and _Application SAML audience_, we will come back to configure this later
* Click on the "Submit" button
* Open your application settings
* On the "Action" drop-down top right, choose "Edit Attribute Mappings"
* Enter the name of your project (this value isn't used, but needs to be filled)
* Set the Format to _transient_
* Click on the button "Save changes"



## The code: Cloudfront and S3 hosted website
The solution is deployed using [serverless.com](https://serverless.com)

- It creates a Cloudfront distribution
- It creates an S3 Bucket
- It creates an SSL Certificate in [ACM](https://aws.amazon.com/certificate-manager/)
- It creates an Entry in Route53
- It creates 3 Lambda@Edge functions:
  - **Protect**:
    - Attached as _viewer-request_ to the default Cloudfront Behavior
    - Invoked on each request to validate the cookie and redirect the browser to the IdP if needed
  - **acs**:
    - Attached to as _viewer-request_ to the _/saml/acs_ path
    - Invoked with POST by the browser with the _SAML Assertion Document_
  - **metadata**:
    - Attached to as _viewer-request_ to the _/saml/metadata.xml_ path
    - Allows to retrieve the SP metadata document to configure the IdP 

- It uses one NPM module:
  - [samlify](https://github.com/tngan/samlify)

### Prerequisites
#### AWS IAM Roles

Your account needs to have 2 IAM Roles set-up to allow deploying StackSets for the bucket that is in another region:
* AWSCloudFormationStackSetAdministrationRole
* AWSCloudFormationStackSetExecutionRole

Create them if they don't already exist
```yaml
AWSTemplateFormatVersion: 2010-09-09
Description: Configure the AWSCloudFormationStackSet Roles to enable use of AWS CloudFormation StackSets.

Resources:
  AdministrationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: AWSCloudFormationStackSetAdministrationRole
      AssumeRolePolicyDocument:
        Version: 2012-10-17
        Statement:
          - Effect: Allow
            Principal:
              Service: cloudformation.amazonaws.com
            Action:
              - sts:AssumeRole
      Path: /
      Policies:
        - PolicyName: AssumeRole-AWSCloudFormationStackSetExecutionRole
          PolicyDocument:
            Version: 2012-10-17
            Statement:
              - Effect: Allow
                Action:
                  - sts:AssumeRole
                Resource:
                  - "arn:*:iam::*:role/AWSCloudFormationStackSetExecutionRole"
  ExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: AWSCloudFormationStackSetExecutionRole
      AssumeRolePolicyDocument:
        Version: 2012-10-17
        Statement:
          - Effect: Allow
            Principal:
              AWS:
                - !Sub arn:aws:iam::${AWS::AccountId}:root
            Action:
              - sts:AssumeRole
      Path: /
      ManagedPolicyArns:
        - !Sub arn:${AWS::Partition}:iam::aws:policy/AdministratorAccess
```
#### Domain
* Your domain needs to be hosted in [Route53](https://aws.amazon.com/route53/)
* You need to retrieve the HostedZoneId

#### Development tools
Some tools are needed, install them if you don't already have them:
* npm i -g serverless
* [nvm](https://github.com/nvm-sh/nvm)

### Get the source
```bash
git clone https://github.com/DanielMuller/Cloudfront-Auth-IAM-Identity-Center
cd Cloudfront-Auth-IAM-Identity-Center
npm i
```

Edit `serverless.yml`, change the following settings:
* service
* custom.domainName: This is the domain for your Cloudfront distribution
* custom.hostedZoneId: The Route53 HostedZoneId for your domain
* custom.bucketRegion: The region you want your S3 Bucket to be created in
* custom.sourceToken: Any string, protects direct access to your bucket 
* custom.origin.DomainName: Remove `.${self:custom.bucketRegion}` if your bucket is in us-east-1
* provider.deploymentBucket.name: Set your deployment bucket name
* The region needs to be set to us-east-1, Lambda@Edge functions can only be deployed to this region

Create `src/secrets/main.ts`:

```typescript
export const secrets = {
  initVector: '1234567890123456', // change me to any 16 Bytes string
  privateKey: '12345678901234567890123456789012', // change me to any 32 Bytes string
  audience: 'audience string', // change me to my application name
  idpMetadata: `XML content of IdP metadata.xml downloaded earlier`
};
```
Replace `WantAuthnRequestsSigned="true"` with `WantAuthnRequestsSigned="false"` in the IdP metadata if it is present.

### Deploy it
```bash
sls deploy
```

## Configure your Application in IAM Identity Center
* Download your SP metadata.xml by visiting https://yourdomain.example.com/saml/metadata.xml
* Open the previously created Custom SAML Application in IAM Identity Center
* On the "Action" drop-down top right, choose "Edit Configuration"
* Upload your metadata.xml in the "Application metadata" section
* Add users or groups to your application

## Add some files to your bucket
```bash
echo 'Index' > index.html
echo "Page1" > page1.html
echo "Page2" > page2.html
echo "404" > 404.html
echo "403" > 403.html

# Replace ${DomainName} with your bucket name (same as domain name)
aws s3 cp --cache-control max-age=31536000 index.html s3://${domainName}/index.html
aws s3 cp --cache-control max-age=31536000 page1.html s3://${domainName}/page.html
aws s3 cp --cache-control max-age=31536000 page2.html s3://${domainName}/page2/index.html
aws s3 cp --cache-control max-age=31536000 404.html s3://${domainName}/404.html
aws s3 cp --cache-control max-age=31536000 403.html s3://${domainName}/403.html

rm *.html
```
## What did we achieve?
* Access to your distribution requires an authentication
* SP initiated and IdP initiated login to your site
* Direct access to your bucket is blocked
* All visitors share the same cached content

## Test it out
* Open http://${domainName}.s3-website.${aws_region}.amazonaws.com/page.html: You receive an _Access denied_
* Open https://${domainName}/page.html: You will be redirected to the IAM Identity Center login page and back to your site where the page will display
* Clear your cookies
* Open your IAM Identity Center start page and log-in
* Select your application and click on it. You will be redirected to your site and already logged in
* Open https://${domainName}/page2. You will see the content of page2/index.html
* Open https://${domainName}/anything. You will see your 404 page

## Why Lambda@Edge and not Cloudfront Functions?
* Cloudfront Functions doesn't have access to the request body. IAM Identity Center will issue a POST request to the ACS endpoint with the payload in the body.
* Cloudfront Functions can't include modules and has some limitations on what Javascript functions can be used

## Conclusion
Serving your website using Cloudfront is the perfect way to ensure a low latency to all your visitors. You want to use the same technology in development than in production, but you want the next version of your application to be a surprise to your members.

You want to allow only certain members of your organization to have access to the next version.

To achieve this, we added an additional layer to Cloudfront by protecting all access with a login-wall and thus keeping unwanted eyes away from our future release. By adding this to Cloudfront (which is our Network Stack), we didn't need to alter our application's code in any way, keeping it identical for development and production.

By leveraging the Identity Provider already used to grant access to AWS resources, we don't have to manage a separate IdP and still have the fine grained capability of picking which members of the Organization can access our application. No need to send passwords via email and rotate them when we want to revoke an access, like it would have been needed with HTTP's Basic Authentication.

We can as easily revoke access by simply removing the user from the relevant group.