import minimist from 'minimist';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import BskyAgent from '@atproto/api';
import { Client } from '@threadsjs/threads.js';
import Mastodon from 'mastodon-api';
import { spawn } from 'child_process';

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

// TODO: Implement threaded multiple tweets.
const poast = argv._[0];

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
            x_response = await consumerClient.v2.tweet(tweetText);
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

    await agent.post({
        text: poast
    });
}

if (threads) {
    const client = new Client();
    await client.login(threads.username, threads.password);

    // TODO: store token so as not to login every single time.
    await client.posts.create(1, { contents: poast })
}

if (mastodon) {
    const M = new Mastodon({
        access_token: mastodon.accessToken,
    });

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
    const pythonProcess = spawn('python3', ['./farcaster_poster.py', mnemonic, poast]);

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python script output: ${data}`);
    });
}
