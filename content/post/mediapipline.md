+++
author = "Daniel"
title = "Convert and distribute your videos with AWS Elemental"
date = 2022-11-21T10:45:10+00:00
lastmod = 2022-11-21T10:45:10+00:00
draft = true
image = "images/2022/11/video.jpg"
summary = ""
categories = [
  "Serverless",
  "Media"
]
tags = [
  "AWS",
  "MediaConvert",
  "MediaPackage",
  "S3",
  "DynamoDB"
]
[amp]
  elements = ["amp-image", "amp-video"]
+++
You are in possession of some videos that you want to distribute or share.

Your use case could be as simple as needing to share a lower resolution of a video taken on your smartphone or camera. Or your use case could be as complex as sharing production quality copies of the latest movie you are producing.

For both cases you can use Serverless Cloud Products to address your need. [AWS Elemental MediaConvert](https://aws.amazon.com/mediaconvert/), one of the Media tools from the [AWS Elemental](https://www.elemental.com/) family, will allow you to solve your problem.

Or perhaps, you want to distribute your content to viewers around the globe allowing them to watch on any device? Then you can use another Serverless Cloud Products from the AWS Elemental family: [AWS Elemental MediaPackage](https://aws.amazon.com/mediapackage/).

## Services used
Video files are complex. You need to worry about image and audio. You need to worry about container, codecs, bitrate, pixel aspect ratio and more.

### MediaConvert
MediaConvert allows to transcode file-based content. Which means that you can transform a Video file into a video file of a different format and size.

But MediaConvert is ore that just transformation. We won't get into details of all functionalities in this article, some noticeable features:
* Watermarking
* Graphic overlay (static or motion)
* Select parts (time or size) of an Input
* Rotation
* Deinterlacing
* ...

### MediaPackage
AWS Elemental MediaPackage is a Just-In-Time media packager for your existing assets. It will generate the relevant manifest for a group of video sources.

It not only allows to define multiple qualities of the same video, but allows to add multiple audio sources and different video sources like camera angles.

For our use case, we are only interested in providing different qualities of the same content and only a single audio track.

MediaPackage uses the formats created by MediaConvert and generates on the fly a manifest either in HLS or in Dash to be consumed by the player.

## Simple Use case: Reduce and Convert for mobile sharing
You created a FHD (1920x1080) video with your camera. You camera creates movies in uncompressed QuickTime format. Most of the devices won't be able to read this format unless they have the right codecs installed.

To allow recipients to play your video, you need to convert it to an MP4 container and the H.264 codec (de facto standard for Web distribution). You also want to improve the download speed.

* Upload your source file to S3
* Trigger a MediaConvert job using this file
  * Convert to an MP4 Container
  * Convert to H.264 codec
  * Reduce the size to 1280x720

### Result
| | Source file | Converted file | Converted file |
|-|-------------|----------------|----------------|
| Container | QuickTime | MP4 | MP4 |
| Codec | H.264 | H.264 | H.264 |
| Dimensions | 1920x1080 | 1920x1080 | 1280x720 |
| Duration | 28s | 28s | 28s |
| Size | 37 MB | 21.7 MB | 12.9 MB |
| Bitrate | 10836 kb/s | 6429 kb/s | 3835 kb/s |

Both outputs were creating in a single MediaConvert job that took 17s.

## More complex use case: Create content for web distribution
In this use case, we want to distribute a 4K (3840x2160) 90 minutes movie. We want our viewer to enjoy our content on any type of screen: from small smartphones to big TV screens.

We also want them to enjoy it regardless of their network connectivity.

We need to be bandwidth conscious and not ship more than the viewer can consume.

MP4 container and H.264 Codec is a combination that can be viewed by most media players (smartphones, TV, Set-top boxes, Gaming devices, ...). We will use this format to distribute our content.

### Screen size consideration
We pre-render our content to adapt to our viewers screen size. Reducing the dimensions also allows to reduce the bandwith needed.

Unless mentioned, we will use H.264 and source frame rate.

* SD: 480 x 270, 400kbps, 15fps
* SD: 640 x 360, 700kbps
* SD: 854 x 480, 1Mbps
* HD: 1280 x 720, 3.5Mbps
* FHD: 1920 x 1080, 6Mbps
* 4K: 3840 x 2160, 20Mbps, H.265

### Segmented videos: HLS and Dash
If we distribute a single file, the client would be stuck on a single quality. Without tweaks on the player side, the client would download the whole file, even the parts that aren't watched.

To allow a streaming-like experience, we will use a distribution format named [HLS](https://en.wikipedia.org/wiki/HTTP_Live_Streaming) (HTTP Live Streaming) and [Dash](https://dashif.org/).

Both format are very similar in the concept, the choice of their usage depends on the players OS. For simplification, one could say that HLS is for Apple devices and Dash for others, but in reality it's slightly more complex.

The idea behind theses formats, is to split the movie in little chunks of a few seconds and define the structure through a manifest file.

By doing this, the player will download little chunks of content in the dimensions appropriate for the screen and the available bandwidth. By downloading only a few segments ahead of the current timestamp, it will use only the bandwidth needed for what is really watched and adapt playback on the current conditions of the player (phone rotated, window resized, bandwidth alterations, ...).

By leveraging HTTP as a delivery mechanism, we not only rely on an universally approved protocol but also allow caching at the CDN level, improving distribution around the globe.

{{<amp-figure
src="images/2022/11/hls.png"
caption="HLS manifests and video files"
>}}

### Generate HLS and Dash Segments
MediaConvert can generate segmented videos and store them to S3. But with everything generated statically once, you loose flexibility. There a multiple reasons you want to have a more dynamic way to generate your manifests:
* Removing some renditions on client attributes: paid tiers, legal constraints in some countries
* Ordering of renditions: Improve start time for some players
* Cost of storing never accessed renditions
* DRM protection
* Additional audio or video tracks

## The solution
{{<amp-figure
src="images/2022/11/mediapipeline.png"
caption="Serverless stack: Build renditions and distribution of large video files"
>}}

### Configuration
#### MediaConvert outputs
**Audio**: AAC, 160kbps, 48kHz
```json
"AudioDescriptions": [
    {
        "AudioSourceName": "Audio Selector 1",
        "AudioType": 0,
        "AudioTypeControl": "FOLLOW_INPUT",
        "Codec": "AAC",
            "CodecSettings": {
                "AacSettings": {
                "AudioDescriptionBroadcasterMix": "NORMAL",
                "Bitrate": 160000,
                "CodecProfile": "LC",
                "CodingMode": "CODING_MODE_2_0",
                "RateControlMode": "CBR",
                "RawFormat": "NONE",
                "SampleRate": 48000,
                "Specification": "MPEG4"
            }
        },
        "LanguageCodeControl": "FOLLOW_INPUT"
    }
]
```
**Video**: MP4, H.264/H.265, Quality based bitrate

Bitrate and dimensions are replaced for each output quality.

The GOPSize of 2 seconds is important, this allows to "cut" the MP4 on key frames every multiple of 2 seconds, providing a fast and safe way to generate segments from the source file.

```json
{
    "ContainerSettings": {
        "Container": "MP4",
        "Mp4Settings": {
            "CslgAtom": "INCLUDE",
            "FreeSpaceBox": "EXCLUDE",
            "MoovPlacement": "PROGRESSIVE_DOWNLOAD",
        },
    },
    "VideoDescription": {
        "AfdSignaling": "NONE",
        "AntiAlias": "ENABLED",
        "Height": 1080,
        "Width": 1920,
        "CodecSettings": {
            "Codec": "H_264",
            "H264Settings": {
                "AdaptiveQuantization": "HIGH",
                "CodecLevel": "LEVEL_4_2",
                "CodecProfile": "HIGH",
                "EntropyEncoding": "CABAC",
                "FieldEncoding": "PAFF",
                "FlickerAdaptiveQuantization": "ENABLED",
                "FramerateControl": "SPECIFIED",
                "FramerateConversionAlgorithm": "DUPLICATE_DROP",
                "FramerateDenominator": 1001,
                "FramerateNumerator": 30000,
                "GopBReference": "DISABLED",
                "GopClosedCadence": 1,
                "GopSize": 2,
                "GopSizeUnits": "SECONDS",
                "HrdBufferInitialFillPercentage": 90,
                "HrdBufferSize": 12000000,
                "InterlaceMode": "PROGRESSIVE",
                "MaxBitrate": 6000000,
                "MinIInterval": 0,
                "NumberBFramesBetweenReferenceFrames": 1,
                "NumberReferenceFrames": 3,
                "ParControl": "SPECIFIED",
                "ParDenominator": 1,
                "ParNumerator": 1,
                "QualityTuningLevel": "SINGLE_PASS_HQ",
                "QvbrSettings": {
                    "QvbrQualityLevel": 8
                },
                "RateControlMode": "QVBR",
                "RepeatPps": "DISABLED",
                "SceneChangeDetect": "ENABLED",
                "Slices": 1,
                "SlowPal": "DISABLED",
                "Softness": 0,
                "SpatialAdaptiveQuantization": "ENABLED",
                "Syntax": "DEFAULT",
                "Telecine": "NONE",
                "TemporalAdaptiveQuantization": "ENABLED",
                "UnregisteredSeiTimecode": "DISABLED"
            }
        },
        "ColorMetadata": "INSERT",
        "DropFrameTimecode": "ENABLED",
        "RespondToAfd": "NONE",
        "ScalingBehavior": "STRETCH_TO_OUTPUT",
        "Sharpness": 50,
        "TimecodeInsertion": "DISABLED"
    }
}
```

```json
[
  {
    "Width": 3840,
    "Height": 2160,
    "Bitrate": 20000000,
    "Profile": "MAIN-MAIN",
    "Level": "AUTO",
    "Codec": "H_265",
  },
  {
    "Width": 1920,
    "Height": 1080,
    "Bitrate": 6000000,
    "Profile": "HIGH",
    "Level": "LEVEL_4_2",
  },
  {
    "Width": 1280,
    "Height": 720,
    "Bitrate": 3500000,
    "Profile": "HIGH",
    "Level": "LEVEL_4_2",
  },
  {
    "Width": 854,
    "Height": 480,
    "Bitrate": 1000000,
    "Profile": "MAIN",
    "Level": "LEVEL_3_1",
  },
  {
    "Width": 640,
    "Height": 360,
    "Bitrate": 700000,
    "Profile": "MAIN",
    "Level": "LEVEL_3_1",
  },
  {
    "Width": 480,
    "Height": 270,
    "Bitrate": 400000,
    "FramerateNumerator": 15000,
    "Profile": "MAIN",
    "Level": "LEVEL_3_1",
  },
]
```
#### MediaPackage packaging groups
**HLS**
For HLS, we create segments of 6 seconds (industry standard)

```yml
Type: AWS::MediaPackage::PackagingConfiguration
Properties:
  Id: hls
  PackagingGroupId: !Ref MediaPackagePackagingGroup
  HlsPackage:
    HlsManifests:
      - ManifestName: index
        IncludeIFrameOnlyStream: true
        StreamSelection:
          StreamOrder: VIDEO_BITRATE_DESCENDING
    SegmentDurationSeconds: 6
    UseAudioRenditionGroup: false
```

**Dash**
For HLS, we create segments of 2 seconds (industry standard)

```yml
Type: AWS::MediaPackage::PackagingConfiguration
Properties:
  Id: dash
  PackagingGroupId: !Ref MediaPackagePackagingGroup
  DashPackage:
    DashManifests:
      - ManifestName: index
        ManifestLayout: FULL
        MinBufferTimeSeconds: 30
        StreamSelection:
          StreamOrder: VIDEO_BITRATE_DESCENDING
    SegmentDurationSeconds: 2
    SegmentTemplateFormat: NUMBER_WITH_TIMELINE
```

### Incoming Bucket
* Source files are uploaded to S3
* A rule on EventBridge listens to "Object:Created" events and triggers the execution of the "Conversion" Step Function.

### Conversion Step Function
* Using a Lambda function and [https://ffmpeg.org/](ffmpeg), the source file is analyzed
    * Bitrate
    * Dimensions
    * Codecs
* The file name is parsed to provide a movie name
  * A naming convention could be used to interact with IMDB to gather more informations
* An entry is created in DynamoDB
* The video is sent to [Rekognition](https://aws.amazon.com/rekognition/) to extract labels, persons, ... _Not implemented for this article_
* A Lambda function builts the outputs based on the source file definition and triggers MediaConvert
  * We don't create a rendition bigger than the source
  * We don't create renditions with a higher bitrate than the source
  * Generate video stills to be used as covers
* An EventBridge rule listens to executed MediaConvert jobs and triggers 

### Packaging Step Function
* Store still informations to DynamoDB
  * Images can be used by a CRM as Video covers
* Store renditions informations to DynamoDB
  * This files can be used for download (offline viewing)
* A Lambda function creates a SMIL manifest
* A Lambda function creates a package using the manifest and the pre-defined HLS and Dash outputs
* The URLs are stored to DynamoDB

### Consumption
* The video metadata and sources can be provided to the client via an API (_not implemented for this article_).
* The client accessed the video content directly from the HLS or Dash URL served via Cloudfront

## Result in action
To showcase the solution, we used a simple source file shot on a Smartphone: 11 seconds FHD (1920x1080) of 25MB.

All we needed to do to produce ready consumable content, was to upload this file to S3. Our Serverless solution took care of all the underlying steps.

### MP4
| Source | 11 s     | 1920 x 1080 | 25 MB  | 19.1 Mbps |
|--------|----------|-------------|--------|-----------|
| [1080p](https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-1080p.mp4)  | 11 s     | 1920 x 1080 | 8.6 MB | 19.1 Mbps |
|  [720p](https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-720p.mp4)  | 11 s     | 1280 x 720  | 5.0 MB | 19.1 Mbps |
|  [480p](https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-480p.mp4)  | 11 s     |  854 x 480  | 1.6 MB | 19.1 Mbps |
|  [360p](https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-360p.mp4)  | 11 s     |  640 x 360  | 7.3 MB | 19.1 Mbps |
|  [270p](https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-270p.mp4)  | 11 s     |  480 x 270  | 0.8 MB | 19.1 Mbps |

**360p**

{{<amp-video
  src="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/estoril_classics_2022-360p.mp4"
  width="640"
  height="360"
  controls=""
  layout="intrinsic"
  poster="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000005.jpg"
>}}

### Stills

{{<amp-image
  src="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000003.jpg"
  alt="0003"
  width="320"
  height="180"
  layout="intrinsic"
>}}
{{<amp-image
  src="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000005.jpg"
  alt="0005"
  width="320"
  height="180"
  layout="fixed"
>}}
{{<amp-image
  src="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000006.jpg"
  alt="0006"
  width="320"
  height="180"
  layout="intrinsic"
>}}
### Adaptive bitrates
**HLS**

{{<amp-video
  src="https://d2bv705w0inzgj.cloudfront.net/out/v1/fabe3df4cc8945ae98f4599edd714697/4d70e98d285e4f5fa77eb3bd125b2bf4/74f30d88f4854b78b23c8eaa0e6c7829/index.m3u8"
  width="640"
  height="360"
  controls=""
  layout="intrinsic"
  poster="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000005.jpg"
>}}

If your browser doesn't support HLS natively, you can access it on the [hls-js demo page](https://hls-js.netlify.app/demo/?src=https://d2bv705w0inzgj.cloudfront.net/out/v1/fabe3df4cc8945ae98f4599edd714697/4d70e98d285e4f5fa77eb3bd125b2bf4/74f30d88f4854b78b23c8eaa0e6c7829/index.m3u8).


**Dash**

{{<amp-video
  src="https://d2bv705w0inzgj.cloudfront.net/out/v1/fabe3df4cc8945ae98f4599edd714697/5aba5a08bb4943aa8fc625e562e2f1cd/b85a89a8e76e4d36bec2b6dab59342d2/index.mpd"
  width="640"
  height="360"
  controls=""
  layout="intrinsic"
  poster="https://d2bv705w0inzgj.cloudfront.net/bae61c4a-5ae1-43f2-bbf3-b22bd6fb20a2/frames/estoril_classics_2022.0000005.jpg"
>}}

If your browser doesn't support Dash natively, you can access it on the [dashif demo page](https://reference.dashif.org/dash.js/nightly/samples/dash-if-reference-player/index.html?url=https://d2bv705w0inzgj.cloudfront.net/out/v1/fabe3df4cc8945ae98f4599edd714697/5aba5a08bb4943aa8fc625e562e2f1cd/b85a89a8e76e4d36bec2b6dab59342d2/index.mpd).

## What did we achieve?
We created a fully Serverless pipeline to transform a source video provided in any format in a group of ready consumable formats by any smartphone or browser anywhere in the world. Even viewers with limited bandwidth can enjoy our content without buffering, they will however settle for a lower quality.

By leveraging Serverless solutions, we get all the known benefits of serverless:
* Cost is kept to a minimum by paying only for what we use
  * Video Conversion: Pay per movie conversion
  * Video Packaging: Pay per movie consumption
  * CDN: Pay per movie consumption
  * S3 Storage: Pay for stored content
  * DynamoDB: Pay for stored data
* No servers to provision or maintain
* The services scales with usage automatically

## Extending the solution

With the solution we built, we barely scratched the surface of what can be done. There are several addons that can be built on top of this solution:
* Provide DRM to protect your content
* Use multiple manifests to allow high definition to selected viewers
* Monetize your content with in-stream ads by leveraging [AWS Media Tailor](https://aws.amazon.com/mediatailor/)
* Create live feeds from your VOD assets
* ...