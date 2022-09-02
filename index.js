
// index.js is used to setup and configure your bot

// Import required pckages
const path = require('path');

// Read botFilePath and botFileSecret from .env file.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

const restify = require('restify');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { CosmosDbPartitionedStorage } = require('botbuilder-azure');

const myStorage = new CosmosDbPartitionedStorage({
  cosmosDbEndpoint: process.env.CosmosDbEndpoint,
  authKey: process.env.CosmosDbAuthKey,
  databaseId: process.env.CosmosDbDatabaseId,
  containerId: process.env.CosmosDbContainerId,
  compatibilityMode: false
});
const { NotificationBot } = require('./bots/notificationBot');

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about how bots work.
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights. See https://aka.ms/bottelemetry for telemetry
  //       configuration instructions.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    'OnTurnError Trace',
    `${error}`,
    'https://www.botframework.com/schemas/error',
    'TurnError'
  );

  // Send a message to the user
  await context.sendActivity('The bot encountered an error or bug.');
  await context.sendActivity('To continue to run this bot, please fix the bot source code.');
};


// Create the bot that will handle notification messages.
const bot = new NotificationBot(myStorage);

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.queryParser({
  mapParams: true
}));
server.use(restify.plugins.bodyParser({
  mapParams: true
}));

server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log(`\n${server.name} listening to ${server.url}`);
});

// Listen for incoming notifications and send Notification messages to users.
server.post('/api/notify', async (req, res) => {
  try {
    console.log("req", req.body);
    const userID = req.body.userID;
    const text = req.body.text;
    const conversationReferences = await bot.getConversationReferences();
    if (userID !== undefined && text !== undefined) {
      const cr_user = conversationReferences["ConversationReferences"].CRList[userID];
      await adapter.continueConversationAsync(process.env.MicrosoftAppId, cr_user, async context => {
        let result = await context.sendActivity(text);
        console.log(result);
      });
    } else {
      throw new Error("No user or text defined");
    }
    res.setHeader('Content-Type', 'json');
    res.send(200, {response:{message: 'Notification messages have been sent'}});
  } catch (error) {
    res.setHeader('Content-Type', 'json');
    res.send(400, {response:{message: error}});
  }
});

server.post('/api/notifyAll', async (req, res) => {
  try {
    console.log("req", req.body);
    const text = req.body.text || 'This is a notification message';
    const conversationReferences = await bot.getConversationReferences();
    for (const conversationReference of Object.values(conversationReferences["ConversationReferences"].CRList)) {
      adapter.continueConversationAsync(process.env.MicrosoftAppId, conversationReference, async context => {
        await context.sendActivity(text);
      });
    }  
    
    res.setHeader('Content-Type', 'json');
    res.send(200, {response:{message: 'Notification messages have been sent'}});
    
  } catch (error) {
    res.setHeader('Content-Type', 'json');
    res.send(400, {response:{message: error}});
  }


});

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', async (req, res) => {
  // Route received a request to adapter for processing
  await adapter.process(req, res, (context) => bot.run(context));
});
