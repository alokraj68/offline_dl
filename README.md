offline-directline
(https://www.npmjs.com/package/offline-directline)
================
Unofficial package to emulate the bot framework connector locally. This package exposes three endpoints: 
1. directline - For your messaging client to post and get message activities to
2. conversation - For your bot to post message activities to
3. botstate - For your bot to post and get state to (privateConversationData, conversationData and userData)

See [Bot Framework API Reference](https://docs.microsoft.com/en-us/bot-framework/rest-api/bot-framework-rest-connector-api-reference) for API references. 

NOTE: Not all routes (e.g. attachments) are fully implemented in this package. For now this connector functions as a message broker and state store. Further, this package currently facilitates a single conversation between a user and a bot.


## Installation

### NPM

```sh
npm install --save offline-directline-gss
```

## Usage
Using this package requires multiple moving pieces. For one you need to have a bot web service (hosted locally or elsewhere). Further, you'll need to install and include this package in a node project and run it. Finally you'll need a client (we'll use webchat) to connect to our offline directline instance. 

### Set up your direct line connector
In order to run an instance of offline directline, you'll need to create a new project, include this module, and run initializeRoutes:

1. Create a new node project 
    * npm init 
    * create a javascript file (e.g. app.js, index.js)
2. Include express and the offline-directline packages
3. Create an express server
4. Call the initializeRoutes function, passing in:
    * Your express server
    * The endpoint/port where you want to host the offline connector
    * Your bot messaging endpoint (generally ends in api/messages)
4. Run your code (node app.js in the command line)!

```js
const url = require("url");
//const directline = require("offline-directline-gss");
const directline = require("../dist/bridge");
const express = require("express");
const app = express();

// const bot = {
//     "botId": "mybotid",
//     "botUrl": "http://localhost:3979/api/messages",
//     "msaAppId": "",
//     "msaPassword": ""
//   };
// const port = process.env.PORT;
// const serviceUrl = "http://127.0.0.1:3000:" + port;

// app.set("port", port);
// app.get('/', function (req, res) {
//     res.send('Offline Directline Bot Connector');
// });
const config = {
    localDirectLine: {
        url: "http://127.0.0.1",
        port: "3000"
        },
	apbots:[
		{
			mybot:{
                botId:"mlbot",
                botUrl:"http://localhost:3979/api/messages",
                "msaAppId": "",
                "msaPassword": ""
            },
			iota:{
				webhook:"",
				secret:"",
				token:""
				}
		}
	]
};

directline.initializeRoutes(app, config);
```

### Build a bot 
See dev.botframework.com for bot building reference. You don't have to actually register a bot - just use one of the botbuilder SDKs to build a bot web service, which you can deploy locally or into the cloud. 

Once you have a bot service built, the only thing you need is your bot messaging endpoint.

### Set up your client
Though you could create your own client to connect to the directline endpoint that this package creates, I'll demonstrate this connection using the Microsoft Bot Framework WebChat channel. See the [Webchat Github Repo](https://github.com/Microsoft/BotFramework-WebChat) samples to get your client set up. Again, keep in mind that you won't actually need to register a bot or channels. As the samples demonstrate, you will create a BotChat.App which you will pass a directline object into. Add the a field for webSocket and set it to false, as in:

```js
const params = BotChat.queryParams(location.search);
const defaultUserId = Math.random().toString(36).substring(7);
const user = {
id: params['userid'] || defaultUserId,
name: params['username'] || defaultUserId
};

const bot = {
id: params['botid'] || 'mlbot',
name: params['botname'] || 'MeetingBot'
};

window['botchatDebug'] = params['debug'] && params['debug'] === 'true';
var domainUrl = 'http://localhost:3000/directline'; //params['domain']
BotChat.App({
bot: bot,
locale: params['locale'],
resize: 'window',
// sendTyping: true,    // defaults to false. set to true to send 'typing' activities to bot (and other users) when user is typing
user: user,

directLine: {
    secret:  params['s'],
    token: params['t'],
    domain: domainUrl,
    webSocket: false // defaults to true
    , pollingInterval: 5000
}
}, document.getElementById('BotChatGoesHere'));
```
This package is not using websockets, so this is our way of telling webchat to use polling instead. 

Now that you have a bot running and directline endpoint running, run your webchat client, passing in your directline endpoint (including '/directline/') as in:

```
http://localhost:8000/samples/fullwindow/?domain=http://localhost:3000/directline
```
Offline directline doesn't require a token or secret, so don't worry about these fields. 


Once everything is running, you should see messages sent in through webchat passed through to your bot and vice versa. Your bot should also be able to set privateConversationData, conversationData and userData as offered by the botbuilder SDKs.