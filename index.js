#!/usr/bin/env node
import minimist from 'minimist';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import BskyAgent from '@atproto/api';
import pkg from 'threads-api';
const { ThreadsAPI } = pkg; //TODO: understand why this is necessary?
import Mastodon from 'mastodon-api';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { uploadImage } from './plugins/upload_image.js';

const argv = minimist(process.argv.slice(2));

// Returns array of jpg images. That way we can use concat instead of caller handling error.
// It's unfortunate this is necessary but it seems the threads api has a bug with pngs
// TODO: move to helpers file?
// TODO: also downsize images to respect twitter's limit: 5242880 bytes
function image_to_jpg(image) {
    let ext = path.extname(image);
    let jpg_image = image.replace(ext, '.jpg');

    const convertProcess = spawnSync('convert', [image, jpg_image]);
    if (convertProcess.status == 0) {
        return [jpg_image];
    } else {
        console.log("Copying image to jpg failed.");
        return [];
    }
}

// Opens an editor for the user to compose their message
// Returns an array of messages split by the delimiter
function openEditor() {
    const editor = process.env.EDITOR || 'nvim';
    const tempFile = path.join(os.tmpdir(), `poast-${Date.now()}.txt`);
    
    // Create a template file with instructions
    const template = `# Compose your post below
# Lines starting with # are comments and will be ignored
# Use \\ to separate multiple posts in a thread
# Empty lines are preserved

`;
    fs.writeFileSync(tempFile, template);
    
    // Open the editor and wait for it to close
    const editorProcess = spawnSync(editor, [tempFile], {
        stdio: 'inherit'
    });
    
    if (editorProcess.status !== 0) {
        console.error(`Editor exited with status ${editorProcess.status}`);
        process.exit(1);
    }
    
    // Read the file content
    const content = fs.readFileSync(tempFile, 'utf8');
    
    // Clean up the temp file
    fs.unlinkSync(tempFile);
    
    // Parse the content
    const messages = [];
    let currentMessage = '';
    
    for (const line of content.split('\n')) {
        // Skip comment lines
        if (line.startsWith('#')) {
            continue;
        }
        
        // Check for delimiter
        if (line.trim() === '\\\\') {
            if (currentMessage.trim()) {
                messages.push(currentMessage.trim());
                currentMessage = '';
            }
        } else {
            currentMessage += line + '\n';
        }
    }
    
    // Add the last message if it's not empty
    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }
    
    return messages;
}

let thread = [];
let current_post = {
    images: [],
    images_jpg: [], // Unfortunately the threads api doesn't support png
};

const dirname = path.dirname(fileURLToPath(import.meta.url));

if (argv.p) {
    let temp_image_file = `${dirname}/.xclip_temp.png`;
    let temp_image_file_jpg = `${dirname}/.xclip_temp.jpg`;

    // TODO: support macOS and Windows
    const xclipProcess = spawnSync('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-o'],
                                   {stdio: 'pipe'});
    fs.writeFileSync(temp_image_file, xclipProcess.stdout);
    
    if (xclipProcess.status != 0) {
        console.log("Obtaining image from clipboard failed.");
    } else {
        current_post.images.push(temp_image_file);
        let jpg_image = image_to_jpg(temp_image_file);
        current_post.images_jpg = current_post.images_jpg.concat(jpg_image);
    }
}

// If no text arguments are provided, open an editor
if (argv._.length === 0) {
    const messages = openEditor();
    
    if (messages.length === 0) {
        console.log("No message provided. Exiting.");
        process.exit(0);
    }
    
    // Create thread from editor messages
    for (const message of messages) {
        if (current_post.text) {
            thread.push(current_post);
            current_post = {
                images: [],
                images_jpg: [],
            };
        }
        current_post.text = message;
    }
    
    if (current_post.text) {
        thread.push(current_post);
    }
} else {
    // Process command line arguments as before
    for (const postOrImage of argv._) {
        if (fs.existsSync(postOrImage)) { // Currently the only supported embed is images.
            current_post.images.push(postOrImage);
            let jpg_image = image_to_jpg(postOrImage);
            current_post.images_jpg = current_post.images_jpg.concat(jpg_image);
        } else {
            if (current_post.text) {
                thread.push(current_post);
                current_post = {
                    images: [],
                    images_jpg: [],
                };
            }
            current_post.text = postOrImage;
        }
    }
    
    if (current_post.text) {
        thread.push(current_post);
    }
}

const configPath = path.join(os.homedir(), '.poast-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

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

if (x) {
    console.log("Posting to X");
    try {
        const consumerClient = new TwitterApi({
          appKey: x.appKey,
          appSecret: x.appSecret,
          accessToken: x.accessToken,
          accessSecret: x.accessSecret,
        });
        async function post_to_X(text, images, parent_post) {
            const mediaIds = await Promise.all(images.map(image => consumerClient.v1.uploadMedia(image)));
            let post_data = { text: text };
            if (mediaIds.length > 0) {
                post_data.media = {media_ids: mediaIds};
            }
            if (parent_post) {
                post_data.reply = {in_reply_to_tweet_id: parent_post.data.id};
            }
            return await consumerClient.v2.tweet(post_data);
        }

        // The API provides tweetThread. Perhaps we should use that instead?
        let previous_tweet;
        for (const post of thread) {
            previous_tweet = await post_to_X(post.text, post.images, previous_tweet);
        }
    } catch (e) {
        console.log(e);
        console.log("Posting to X failed. See error above.");
    }
}

if (bluesky) {
    console.log("Posting to bluesky");
    try {
        const agent = new BskyAgent.BskyAgent({ service: 'https://bsky.social' })
        await agent.login({
          identifier: bluesky.identifier,
          password: bluesky.password,
        });

        async function post_to_bsky(text, images, parent_id, root_id) {
            let post_data = { text: text };
            if (parent_id) {
                post_data.reply = { parent: parent_id, root: root_id };
            }

            if (images.length > 0) {
                let image_response = await Promise.all(images.map(image => {
                    let data = Buffer.from(fs.readFileSync(image), 'binary');
                    return agent.uploadBlob(data, {
                        encoding: 'image/jpeg',
                    });
                }));

                post_data.embed = {
                    $type: 'app.bsky.embed.images',
                    images: image_response.map(image_res => { return { image: image_res.data.blob, alt: "" } })};
            }

            return await agent.post(post_data);
        }

        let previous_response, head_response;
        for (const post of thread) {
            // jpg file is used because bluesky requires you to specify the encoding and I don't want to detect it.
            previous_response = await post_to_bsky(post.text, post.images_jpg, previous_response, head_response);
            if (!head_response) {
                head_response = previous_response;
            }
        }
    } catch (e) {
        console.log(e);
        console.log("Posting to bluesky failed. See error above.");
    }
}

if (threads) {
    console.log("Posting to threads");
    try {
        let threadsAPI;
        if (threads.token) {
            threadsAPI = new ThreadsAPI({
                username: threads.username,
                token: threads.token,
                deviceID: threads.deviceID,
            });
        } else {
            threadsAPI = new ThreadsAPI({
                username: threads.username,
                password: threads.password,
                deviceID: threads.deviceID,
            });
        }

        async function post_to_threads(text, images, previous_response) {
            let post_data = { text: text };
            if (previous_response) {
                let parent_post_id = previous_response.split("_")[0];
                post_data.parentPostID = parent_post_id;
            }

            if (images.length > 0) {
                if (images.length > 1) {
                    post_data.attachment = {
                        sidecar: images
                    };
                } else {
                    post_data.attachment = {
                        image: {
                            path: images[0]
                        }
                    };
                }
            }

            return await threadsAPI.publish(post_data);
        }

        let previous_response;
        for (const post of thread) {
            previous_response = await post_to_threads(post.text, post.images, previous_response);
        }
    } catch (e) {
        console.log(e);
        console.log("Posting to threads failed. See error above.");
    }
}

if (mastodon) {
    console.log("Posting to mastodon");
    try {
        const M = new Mastodon({
            access_token: mastodon.accessToken,
        });

        let poast = "";
        for (const post of thread) {
            poast += post.text + "\n";
        }
        let image_ids = [];
        for (const post of thread) {
            for (const image of post.images) {
                let image_response = await M.post('media', { file: fs.createReadStream(image) });
                image_ids.push(image_response.data.id);
            }
        }
        if (poast.length > 0) {
            M.post('statuses', { status: poast, media_ids: image_ids }, (err, data, response) => {
                if (err) {
                    console.error(err);
                    return;
                }
            });
        }
    } catch (e) {
        console.log(e);
        console.log("Posting to mastodon failed. See error above.");
    }
}

if (farcaster) {
    console.log("Posting to farcaster");
    try {
        const mnemonic = farcaster.mnemonic;

        let hash = 'None';
        let fid = 'None';
        for (const post of thread) {
            let embeds = [];
            for (const image of post.images) {
                const remote_image_file = await uploadImage(image);
                embeds.push(remote_image_file);
            }

            let farcasterProcess = spawnSync(`${dirname}/farcaster_poster.py`,
                [mnemonic, post.text, hash, fid].concat(embeds),
                {stdio: 'pipe', encoding: 'utf-8'});
            [hash, fid] = farcasterProcess.stdout.split("\n");
        }
    } catch (e) {
        console.log(e);
        console.log("Posting to farcaster failed. See error above.");
    }
}
