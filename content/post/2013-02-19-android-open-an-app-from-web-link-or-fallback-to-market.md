+++
title = "Android: Open an app from web link or fallback to market"
author = "Daniel"
date = "2013-02-19T15:53:36+00:00"
categories = [
  "Android"
]
[amp]
  elements = ["amp-image-lightbox","amp-social-share"]
+++
For the Android app we developed at [Spuul](https://spuul.com/), we needed to redirect users to the app when they opened certain links on their device.

The first problem was that not every link should open the app, since some pages are ment to be visited by a mobile device.

The second problem was to redirect users to [Google Play](http://play.google.com/store/apps/details?id=com.spuul.android) when the app is not installed.

## Opening the app for certain links only

Android apps have the ability to interact with the network stack and launch an app according to known patterns in an URI. This is known as [Intent](http://developer.android.com/reference/android/content/Intent.html). The most common use is to catch all schemes that have a specific name.

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"></action>
  <category android:name="android.intent.category.DEFAULT"></category>
  <category android:name="android.intent.category.BROWSABLE"></category>
  <data android:scheme="spuul"></data>
</intent-filter>
```

With this, all URI's like `spuul://movies/123` will be openend by the app. The app is then able to handle this URI and launch the correct content. Best known example is the link to Google Play like `market://details?id=com.spuul.android`.

## Fallback to market if app is not installed

The above method works fine if the app is installed. When the app is not installed, the users only see an error message in his browser. Not really sexy.

The idea is to still use the http scheme and have the app listen to another domain like _android.app.spuul.com_

  1. Configure app to listen to subdomain

    **Edit (2015-06-07)**: As pointed out by _Sufian_, the pathPrefix param is needed:</p>
    ```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"></action>
  <category android:name="android.intent.category.DEFAULT"></category>
  <category android:name="android.intent.category.BROWSABLE"></category>
  <data android:scheme="http" android:host="android.app.spuul.com" android:pathPrefix=""></data>
</intent-filter>
    ```
  2. Configure web server to redirect all request for android.app.spuul.com to redirect to market://details?id=com.spuul.android
  3. Configure web app to redirect subdomain when client is an Android device, adding wanted path depending on context
  4. If the app is installed:
    * The user needs to choose if he wants to continue with Browser or with the app (if he didn't already set the app as default)
    {{<amp-image-lightbox id="lightbox">}}
    {{<amp-figure
    src="/images/2013/02/android_app_chooser.png"
    lightbox="lightbox"
    >}}
    * If he chooses _Browser_, the web server redirects the user to the market from where he can open the app
  5. If the app is not installed:
    * The action is handled by the browser and the web server redirects the user to the market from where he can install the app</ol>
