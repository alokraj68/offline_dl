const url = require("url");
const directline = require("./dist/bridge");
const express = require("express");
const app = express();

const config = {
    localDirectLine: {
            hostUrl: "http://localhost",
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

// 一開始在 iis 中測試請用以下的 code 
// var virtualDirPath = process.env.virtualDirPath || '';
// var app = require('express')();
// app.get(virtualDirPath + '/', (req, res) => {
//   res.send(`virtualDirPath: ${virtualDirPath}`);
// });
// app.get(virtualDirPath + '/directline', (req, res) => {
// 	res.send(`virtualDirPath: ${virtualDirPath}/directline`);
//   });
// app.listen(process.env.PORT);
