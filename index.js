import minimist from 'minimist';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import BskyAgent from '@atproto/api';
import { Client } from '@threadsjs/threads.js';
import Mastodon from 'mastodon-api';
import { spawn } from 'child_process';

const argv = minimist(process.argv.slice(2));

// TODO: Implement threaded multiple tweets.
const poast = argv._[0];

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

if (config.services.X) {
    const consumerClient = new TwitterApi({
      appKey: config.services.X.appKey,
      appSecret: config.services.X.appSecret,
      accessToken: config.services.X.accessToken,
      accessSecret: config.services.X.accessSecret,
    });

    await consumerClient.v2.tweet(poast);
}

if (config.services.bluesky) {
    const agent = new BskyAgent.BskyAgent({ service: 'https://bsky.social' })

    await agent.login({
      identifier: config.services.bluesky.identifier,
      password: config.services.bluesky.password,
    });

    await agent.post({
        text: poast
    });
}

if (config.services.threads) {
    const client = new Client();
    await client.login(config.services.threads.username, config.services.threads.password);

    // TODO: store token so as not to login every single time.
    await client.posts.create(1, { contents: poast })
}

if (config.services.mastadon) {
    const M = new Mastodon({
        access_token: config.services.mastadon.accessToken,
    });

    M.post('statuses', { status: poast }, (err, data, response) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}

if (config.services.farcaster) {
    const mnemonic = config.services.farcaster.mnemonic;
    const pythonProcess = spawn('python3', ['./farcaster_scrap.py', mnemonic, poast]);

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python script output: ${data}`);
    });
}
