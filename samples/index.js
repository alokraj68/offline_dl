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



