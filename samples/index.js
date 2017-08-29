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
			botId:"mybot",
			botUrl:"http://localhost:3979/api/messages",
			"msaAppId": "",
			"msaPassword": ""
		},
		{
			botId:"mybot2",
			botUrl:"http://localhost:3978/api/messages",
			"msaAppId": "",
			"msaPassword": ""
		},
	]
};

directline.initializeRoutes(app, config);



