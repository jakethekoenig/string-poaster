import { basename } from 'path';
import { spawnSync } from 'child_process';
import fs from 'fs';

// TODO: do this in one place?
const configPath = path.join(os.homedir(), '.poast-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Farcaster doesn't host images so we need to upload it ourselves somewhere.
// The intention of this file is to be an example of how I do it. Others may want to use Imgur.
//
// This script provides a function which given a local file uploads it to an s3
// bucket and returns the url.
export function uploadImage(imageFile) {
    // I add the unix timestamp because files from copy/paste all have the same name. TODO: if the file is not specified via copy paste don't add a timestamp.
    const base_name = Date.now() + '_' + basename(imageFile);
    // TODO: error handling
    // TODO: handle auth myself instead of relying on the environment
    const aws = config.services.aws;
    const relativePath = `${aws.folder}/${base_name}`;
    const target = `${aws.bucket}/${relativePath}`;
    const awsS3Process = spawnSync('aws', ['s3', 'cp', imageFile, target]);

    return `${aws.url}/${relativePath}`;
}
