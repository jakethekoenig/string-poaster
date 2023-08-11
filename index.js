import minimist from 'minimist';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import BskyAgent from '@atproto/api';
import { Client } from '@threadsjs/threads.js';
import Mastodon from 'mastodon-api';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const argv = minimist(process.argv.slice(2));

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

let x = config.services.X;
let bluesky = config.services.bluesky;
let threads = config.services.threads;
let mastodon = config.services.mastodon;
let farcaster = config.services.farcaster;

if (argv.x || argv.b || argv.t || argv.m || argv.f) {
    x = argv.x && x;
    bluesky = argv.b && bluesky;
    threads = argv.t && threads;
    mastodon = argv.m && mastodon;
    farcaster = argv.f && farcaster;
}

let paste = argv.p;

    let temp_image_file;
if (paste) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    temp_image_file = `${__dirname}/.xclip_temp.png`;
    let logStream = fs.createWriteStream(temp_image_file);

    // TODO: support macOS and Windows
    const xclipProcess = spawn('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-o']);
    xclipProcess.stdout.pipe(logStream);
    await xclipProcess.on('exit', (code) => {
        console.log(`xclip exited with code ${code}`);
    });
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // I'm not sure why the previous await wasn't sufficient. In the future we can refactor the code as a callback.
    await sleep(500);
}

if (x) {
    const consumerClient = new TwitterApi({
      appKey: x.appKey,
      appSecret: x.appSecret,
      accessToken: x.accessToken,
      accessSecret: x.accessSecret,
    });

    let previous_tweet_id;
    for (const tweetText of argv._) {
        let x_response;
        if (!previous_tweet_id) {
            if (paste) {
                const mediaIds = await Promise.all([consumerClient.v1.uploadMedia(temp_image_file)]);
                // TODO: can we refactor to pass empty mediaIds array when no images to only call tweet once?
                x_response = await consumerClient.v2.tweet(
                    {text: tweetText,
                     media: { media_ids: mediaIds }});
            } else {
                x_response = await consumerClient.v2.tweet(tweetText);
            }
        } else {
            x_response = await consumerClient.v2.reply(tweetText, previous_tweet_id);
        }
        previous_tweet_id = x_response.data.id;
    }
}

if (bluesky) {
    const agent = new BskyAgent.BskyAgent({ service: 'https://bsky.social' })

    await agent.login({
      identifier: bluesky.identifier,
      password: bluesky.password,
    });

    let previous_response;
    let head_response;
    for (const postText of argv._) {
        let bsky_response;
        if (!previous_response) {
            bsky_response = await agent.post({ text: postText });
            head_response = bsky_response;
        } else {
            bsky_response = await agent.post({ text: postText, reply: { parent: previous_response, root: head_response }});
        }
        previous_response = bsky_response;
    }
}

if (threads) {
    let client;
    if (threads.token) {
        client = new Client({
            token: threads.token,
            userAgent: threads.userAgent,
            appId: threads.appId,
            androidId: threads.androidId,
        });
    } else {
        client = new Client();
        await client.login(threads.username, threads.password);
    }

    let previous_response;
    for (const postText of argv._) {
        if (!previous_response) {
            previous_response = await client.posts.create(1, { contents: postText });
        } else {
            let post_id = previous_response.media.id.split("_")[0];
            previous_response = await client.posts.reply(1, { contents: postText, post: post_id});
        }
    }
}

if (mastodon) {
    const M = new Mastodon({
        access_token: mastodon.accessToken,
    });

    let poast = argv._.join("\n");

    M.post('statuses', { status: poast }, (err, data, response) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}

if (farcaster) {
    const mnemonic = farcaster.mnemonic;
    const pythonProcess = spawn('python3', ['./farcaster_poster.py', mnemonic].concat(argv._));

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python script output: ${data}`);
    });
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python script error: ${data}`);
    });
}
