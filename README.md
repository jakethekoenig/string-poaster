
# String Poaster

A command line utility for making the same post to multiple social media platforms. Currently supports X, bluesky, threads, Mastodon and Farcaster.

## Install

```bash
npm install -g @ja3k/string-poaster
pip install farcaster # if you want to use farcaster. The node library does not support embeds.
```

## Setup

Run the following command to setup auth for the social media sites you want to post to. The credentials are saved to `~/.poast-config.json`.

```bash
poast-login
```

## Usage

The following posts "This is my post" to every social network you set up in the previous step.

```bash
poast "This is my post"
```

You can use the flags x,b,t,m,f to only post to specific sites. The following posts to only Twitter and Threads:

```bash
poast -xt -- "Hi Twitter and Threads"
```

If you list multiple strings they will be posted in reply to each other except on Mastodon on which they will each become another paragraph.

```bash
poast "Here's my post" "And one more thing! "
```

## Images

Each string in the list string-poaster checks if it is a file in the file system. If so it will upload it to the most recent string post.

```bash
poast "Check out my vacation" image1.png image2.jpg "I loved the beach" image3.png
```

The `p` flag attempts to dump the clipboard to `.xclip_temp.png` and attach it to the first post in the thread.

### Images Quirks

The author did not find a reliable node library that could get an image from the clipboard so is spawning `xclip` which you will need to install yourself and has only been tested on Ubuntu.

The threads library only supports jpg and bluesky requires the filetype to be specified so for both those networks the image is converted to jpg with `convert` which again the user will have to have installed and may only work on Ubuntu.

Farcaster does not have a way to upload images to it directly and requires a link. The author makes one by uploading to a public S3 bucket which you can see [here](plugins/upload_image.js). In the future imgur support may be added.
