import * as express from 'express';
import bodyParser = require('body-parser');
import 'isomorphic-fetch';
import * as uuidv4 from 'uuid/v4';
import * as HttpStatus from "http-status-codes";
import * as _ from 'lodash';

var http = require('http');

import { IUser, IUserConversation } from './types/userTypes';
import { IActivity, IConversationUpdateActivity, IMessageActivity, ITypingActivity, IInvokeActivity } from './types/activityTypes';
import { IAttachment } from './types/attachmentTypes';
import { IConversationAccount, IChannelAccount } from './types/accountTypes';
import { IEntity } from './types/entityTypes';
import { IConversation } from './types/conversationTypes';
import { IBot, IBotData } from './types/botTypes';
import { Conversation } from './conversationManager';

const expires_in = 1800;
let botDataStore: { [key: string]: IBotData } = {};
let history: {[key: string]: IActivity[]} = {};
let userConversations:{[key:string]: IUserConversation[]} = {};
let apBots : IBot[] = [];



export const initializeRoutes = (app: express.Server, config: any) => {
    const virtualDirPath = process.env.virtualDirPath || '';
    const serviceUrlPort =  config.localDirectLine.port || 3000;
    const port = process.env.PORT || serviceUrlPort;
    //註:在 iis 中的 port 會類似 \\.\pipe\88731ae5-10c4-42dd-8685-91ecf6f13861 
    let serviceUrl = `${config.localDirectLine.hostUrl}:${serviceUrlPort}${virtualDirPath}`;
    //在某些 iis node 沒有fun中寫 console.log 會發生錯誤
    //console.log(serviceUrl);
    apBots = config.apbots;
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, PATCH, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        next();
    });

    

    // CLIENT ENDPOINT
    app.options(`${virtualDirPath}/directline`, (req, res) => {
        res.send(`${virtualDirPath}/directline`);
    });

    app.get(`${virtualDirPath}/directline`, (req, res) => {
        res.send(`${virtualDirPath}/directline`);
    });

    // ROOT ENDPOINT
    app.get(`${virtualDirPath}/`, (req, res) => {
        res.send(`port:${port}, serverUrl:${serviceUrl}`);
    });


    //Creates a conversation
    app.post(`${virtualDirPath}/directline/conversations`, (req, res) => {
        let conversationId = uuidv4();
        history[conversationId] = [];
        console.log("Created conversation with conversationId: " + conversationId);
        res.send({
            conversationId,
            expires_in
        });
    })

    //在某些node v6.10.0 下有 callback會掛
    app.listen(port);

    //reconnect API
    app.get(`${virtualDirPath}/v3/directline/conversations/:conversationId`, (req, res) => { console.warn("/v3/directline/conversations/:conversationId not implemented") })
    app.get(`${virtualDirPath}/directline/tokens/generate`, (req, res) => { console.warn("/directline/tokens/generate not implemented") })
    app.get(`${virtualDirPath}/directline/tokens/refresh`, (req, res) => { console.warn("/directline/tokens/refresh not implemented") })

    //Gets activities from store (local history array for now)
    app.get(`${virtualDirPath}/directline/conversations/:conversationId/activities`, (req, res) => {
        let watermark = Number(req.query.watermark || 0);
        let queryConversationId = req.params.conversationId;

        if (history[queryConversationId]) {
            //If the bot has pushed anything into the history array
            if (history[queryConversationId].length > watermark) {
                let activities = getActivitiesSince(queryConversationId, watermark);
                const sendJson = {
                    activities,
                    watermark: watermark + activities.length
                };
                res.status(200).json(sendJson);
            } else {
                res.status(200).send({
                    activities: [],
                    watermark
                })
            }
        } else {
            console.warn("Client is polling connector before conversation is initialized.");
            res.status(400).send;
        }
    })

    //Gets activities from store (local history array for now)
    app.get(`${virtualDirPath}/directline/conversations/:conversationId`, (req, res) => {
        let watermark = Number(req.query.watermark || 0);
        let queryConversationId = req.params.conversationId;
        if (history[queryConversationId]) {
            //If the bot has pushed anything into the history array
            if (history[queryConversationId].length > watermark) {
                let activities = getActivitiesSince(queryConversationId, watermark);
                const sendJson = {
                    activities,
                    watermark: watermark + activities.length
                };
                console.log(sendJson);
                res.writeHead(200, {"Content-Type": "application/json"});
                const sendJsonStr = JSON.stringify(sendJson);
                res.end(sendJsonStr);
            } else {
                res.status(200).send({
                    activities: [],
                    watermark
                })
            }
        } else {
            console.warn("Client is polling connector before conversation is initialized.");
            res.status(400).send;
        }
    })

    //Sends message to bot. Assumes message activities. 
    app.post(`${virtualDirPath}/directline/conversations/:conversationId/activities`, (req, res) => {
        let incomingActivity = req.body;
        let queryConversationId = req.params.conversationId;
        //make copy of activity. Add required fields. 
        let activity = createMessageActivity(incomingActivity, serviceUrl, queryConversationId);
        const bot = getBot(req);
        if (activity) {
            let user: IUser = { name: activity.from.name, id: activity.from.id };
            //add user conversation info 
            addUserConversation(user.id, bot.botId, queryConversationId);
             
            var conversation = new Conversation(queryConversationId, user, bot);
            conversation.postActivityToBot(activity, true, (err, statusCode, activityId) => {
                if (err || !/^2\d\d$/.test(`${statusCode}`)) {
                    res.send(statusCode || HttpStatus.INTERNAL_SERVER_ERROR);
                } else {
                    res.send(statusCode, { id: activityId });
                }
                res.end();
            });
        }
    })

    // BOT CONVERSATION ENDPOINT
    app.post(`${virtualDirPath}/v3/directline/conversations/:conversationId/upload`, (req, res) => { console.warn("/v3/directline/conversations/:conversationId/upload not implemented") })
    app.get(`${virtualDirPath}/v3/directline/conversations/:conversationId/stream`, (req, res) => { console.warn("/v3/directline/conversations/:conversationId/stream not implemented") })

    app.post(`${virtualDirPath}/v3/conversations`, (req, res) => { 
        console.warn("/v3/conversations");
        var bot = req.body.bot || {};
        
        var members = req.body.members || [];
        let conversationId = '';
        if(members.length > 0){
            const memberId = members[0].id;
            var convId = getUserConversationId(memberId, bot.id)
            if(convId){
                conversationId = convId;
                console.log("use conversation with conversationId: " + conversationId);
            }else{
                conversationId = uuidv4();
                history[conversationId] = [];
                console.log("Created conversation with conversationId: " + conversationId);
            }
            res.status(200).send({
                "conversationId" : conversationId,
                "expires_in" : expires_in,
                "id":conversationId,
                "token":conversationId
            });
        }
    });

    app.post(`${virtualDirPath}/v3/conversations/:conversationId/activities`, (req, res) => { 
        console.warn("/v3/conversations/:conversationId/activities");
        let incomingActivity = req.body;
        let queryConversationId = req.params.conversationId;
        incomingActivity.id = incomingActivity.id || uuidv4();
        if (incomingActivity) {
            history[queryConversationId].push(incomingActivity);
            res.send(200, { id: incomingActivity.id });
        }
    });

    app.post(`${virtualDirPath}/v3/conversations/:conversationId/activities/:activityId`, (req, res) => {
        let activity: IActivity;
        let queryConversationId = req.params.conversationId;
        activity = req.body;
        activity.id = uuidv4();

        if (history) {
            history[queryConversationId].push(activity);
            res.status(200).send();
        } else {
            console.warn("Client is attempting to send messages before conversation is initialized.");
            res.status(400).send();
        }

    })

    app.get(`${virtualDirPath}/v3/conversations/:conversationId/members`, (req, res) => { console.warn("/v3/conversations/:conversationId/members not implemented") })
    app.get(`${virtualDirPath}/v3/conversations/:conversationId/activities/:activityId/members`, (req, res) => { console.warn("/v3/conversations/:conversationId/activities/:activityId/members") })

    // BOTSTATE ENDPOINT

    app.get(`${virtualDirPath}/v3/botstate/:channelId/users/:userId`, (req, res) => {
        console.log("Called GET user data");
        getBotData(req, res);
    })

    app.get(`${virtualDirPath}/v3/botstate/:channelId/conversations/:conversationId`, (req, res) => {
        console.log(("Called GET conversation data"));
        getBotData(req, res);
    })

    app.get(`${virtualDirPath}/v3/botstate/:channelId/conversations/:conversationId/users/:userId`, (req, res) => {
        console.log("Called GET private conversation data");
        getBotData(req, res);
    })

    app.post(`${virtualDirPath}/v3/botstate/:channelId/users/:userId`, (req, res) => {
        console.log("Called POST setUserData");
        setUserData(req, res);
    })

    app.post(`${virtualDirPath}/v3/botstate/:channelId/conversations/:conversationId`, (req, res) => {
        console.log("Called POST setConversationData");
        setConversationData(req, res);
    })

    app.post(`${virtualDirPath}/v3/botstate/:channelId/conversations/:conversationId/users/:userId`, (req, res) => {
        setPrivateConversationData(req, res);
    })

    app.delete(`${virtualDirPath}/v3/botstate/:channelId/users/:userId`, (req, res) => {
        console.log("Called DELETE deleteStateForUser");
        deleteStateForUser(req, res);
    })

}

const getBotDataKey = (channelId: string, conversationId: string, userId: string) => {
    return `$${channelId || '*'}!${conversationId || '*'}!${userId || '*'}`;
}

const setBotData = (channelId: string, conversationId: string, userId: string, incomingData: IBotData): IBotData => {
    const key = getBotDataKey(channelId, conversationId, userId);
    let newData: IBotData = {
        eTag: new Date().getTime().toString(),
        data: incomingData.data
    };

    if (incomingData) {
        botDataStore[key] = newData;
    } else {
        delete botDataStore[key];
        newData.eTag = '*';
    }

    return newData;
}

const getBotData = (req: express.Request, res: express.Response) => {
    const key = getBotDataKey(req.params.channelId, req.params.conversationId, req.params.userId);
    console.log("Data key: " + key);

    res.status(200).send(botDataStore[key] || { data: null, eTag: '*' });
}

const setUserData = (req: express.Request, res: express.Response) => {
    res.status(200).send(setBotData(req.params.channelId, req.params.conversationId, req.params.userId, req.body));
}

const setConversationData = (req: express.Request, res: express.Response) => {
    res.status(200).send(setBotData(req.params.channelId, req.params.conversationId, req.params.userId, req.body));
}

const setPrivateConversationData = (req: express.Request, res: express.Response) => {
    res.status(200).send(setBotData(req.params.channelId, req.params.conversationId, req.params.userId, req.body));
}

const deleteStateForUser = (req: express.Request, res: express.Response) => {
    Object.keys(botDataStore)
        .forEach(key => {
            if (key.endsWith(`!{req.query.userId}`)) {
                delete botDataStore[key];
            }
        });
    res.status(200).send();
}

//CLIENT ENDPOINT HELPERS
const createMessageActivity = (incomingActivity: IMessageActivity, serviceUrl: string,  conversationId:string): IMessageActivity => {
    return { ...incomingActivity, channelId: "emulator", serviceUrl: serviceUrl, conversation: { 'id': conversationId }, id: uuidv4() };
}

const getActivitiesSince = (key:string, watermark: number): IActivity[] => {
    return history[key].slice(watermark);
}


const addUserConversation = (userId:string, botId:string, conversationId:string) => {
    let userConvs : IUserConversation[] = userConversations[userId] || [];
    //remove bot's info
    userConvs = _.remove(userConvs, uc => {
        uc.botId == botId
    });
    userConvs.push({botId,  conversationId });
    userConversations[userId] = userConvs;
    console.log('userConversations[userId]', userConversations[userId]);
}

const getUserConversationId = (userId:string, botId:string) => {
    let userConvs : IUserConversation[] = userConversations[userId] || [];
    let firstConv = _.find(userConvs, uc => {
        uc.botId == botId
    });
    if(firstConv){
       return firstConv.conversationId; 
    }else{
        console.warn("getUserConversationId empty")
        return null;
    }
}

const getBot = (req: any) =>{
    const auth = req.header('Authorization');
    const tokenMatch = /Bearer\s+(.+)/.exec(auth);
    let apBot:IBot;
    if(tokenMatch.length > 1){
        const botId = tokenMatch[1];
        apBot = _.find(apBots, bot=>bot.botId === botId);
     }
     return apBot || apBots[0];
}

