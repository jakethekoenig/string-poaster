#!/usr/bin/env node
import pkg from 'threads-api';
const { ThreadsAPI } = pkg; //TODO: understand why this is necessary?
import Mastodon from 'mastodon-api';
import readlineSync from 'readline-sync';
import fs from 'fs';
import path from 'path';
import os from 'os';

let config = {
    services: {}
};
const hidden = { hideEchoBack: true };

console.log("This is a utility to enter the accounts and credentials you want to poast with.");
console.log("They will be saved to ~/.poast-config.json which is possible to manually edit.");

const xyn = readlineSync.question("Setup X (Twitter)? (Y/n) ");
if (xyn == "y" || xyn == "Y" || xyn == "") {
    console.log("Currently OAuth is not supported so you will have need your own twitter developer account and app credentials.");
    console.log("See the following for more information: https://developer.twitter.com/en/docs/authentication/oauth-1-0a/api-key-and-secret");
    const appKey = readlineSync.question("Enter your Twitter app key: ", hidden);
    const appSecret = readlineSync.question("Enter your Twitter app secret: ", hidden);
    const accessToken = readlineSync.question("Enter your Twitter access token: ", hidden);
    const accessSecret = readlineSync.question("Enter your Twitter access secret: ", hidden);
    config.services.X = {
        appKey: appKey,
        appSecret: appSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
    };
}

const byn = readlineSync.question("Setup Bluesky? (Y/n) ");
if (byn == "y" || byn == "Y" || byn == "") {
    console.log("Bluesky is authenticated with username and password. Note you can setup an application specific password which is easier to revoke.");
    const username = readlineSync.question("Enter your Bluesky username: ");
    const password = readlineSync.question("Enter your Bluesky password: ", hidden);
    config.services.bluesky = {
        identifier: username,
        password: password,
    };
}

const tyn = readlineSync.question("Setup Threads? (Y/n) ");
if (tyn == "y" || tyn == "Y" || tyn == "") {
    console.log("Threads is authenticated with username and password. They are used by this script to obtain a user token and the password is not saved.");
    const username = readlineSync.question("Enter your Threads username: ");
    const password = readlineSync.question("Enter your Threads password: ", hidden);
    const threadsAPI = new ThreadsAPI({
        username: username,
        password: password
    });
    const token = await threadsAPI.getToken();
    config.services.threads = {
        username: username,
        token: token,
        deviceID: threadsAPI.deviceID
    };
}

const myn = readlineSync.question("Setup Mastodon? (Y/n) ");
if (myn == "y" || myn == "Y" || myn == "") {
    let clientId;
    let clientSecret;
    console.log("Mastodon is authenticated with an access token. You will have to login to your Mastodon with the provided url and enter the code they give you. (Note the developers have observed problems with some instances. But mastodon.social works.");
    const mastodonInstance = readlineSync.question("Enter your Mastodon instance: ");
    const accessToken = await Mastodon.createOAuthApp()
        .catch((err) => console.error(err))
        .then((res) => {
            console.log(res)

            clientId = res.client_id
            clientSecret = res.client_secret

            return Mastodon.getAuthorizationUrl(clientId, clientSecret, mastodonInstance)
        })
        .then((url) => {
            console.log('This is the authorization URL. Open it in your browser and authorize with your account!')
            console.log(url)
            return readlineSync.question("Enter your Mastodon access token: ", hidden);
        })
        .then((code) => Mastodon.getAccessToken(clientId, clientSecret, code))
        .catch((err) => console.error(err))
        .then((accessToken) => {
            console.log('Your access token is:');
            console.log(accessToken);
            return accessToken;
        });

    config.services.mastodon = {
        accessToken: accessToken,
    };
}

const fyn = readlineSync.question("Setup Farcaster? (Y/n) ");
if (fyn == "y" || fyn == "Y" || fyn == "") {
    console.log("Farcaster is authenticated with a mnemonic pass phrase.");
    const mneumonic = readlineSync.question("Enter your Farcaster mneumonic: ");
    config.services.farcaster = {
        mneumonic: mneumonic,
    };
}

const configPath = path.join(os.homedir(), '.poast-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
