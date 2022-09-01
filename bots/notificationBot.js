// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
    ActivityHandler,
    TurnContext
} = require('botbuilder');

class NotificationBot extends ActivityHandler {
    constructor(myStorage) {
        super();

        this.storage = myStorage;

        this.onConversationUpdate(async (context, next) => {
            await this.addConversationReference(context.activity);

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await this.addConversationReference(context.activity);
                    //const welcomeMessage = 'Welcome to the Proactive Bot sample';
                    //await context.sendActivity(welcomeMessage);
                }
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMessage(async (context, next) => {
            this.addConversationReference(context.activity);

            // Echo back what the user said
            await context.sendActivity(`You sent '${context.activity.text}'`);
            await next();
        });
    }

    /**
     * Adds a member conversation reference.
     * @param {activity} activity object with the conversation information.
     */
    async addConversationReference(activity) {
        const cr = TurnContext.getConversationReference(activity);
        const conversationReferences = await this.getConversationReferences();
        conversationReferences["ConversationReferences"].CRList[cr.user.id] = cr;
        await this.storage.write(conversationReferences);
    }

    /**
     * Return the Conversation References
     */
    async getConversationReferences() {
        // Dependency injected dictionary for storing ConversationReference objects used in NotifyController to proactively message users

        let conversationReferences = await this.storage.read(["ConversationReferences"]);
        //conversationReferences["ConversationReferences"] = { CRList: {}, "eTag": "*" };
        if (typeof (conversationReferences["ConversationReferences"]) === 'undefined') {
            conversationReferences["ConversationReferences"] = { CRList: {}, "eTag": "*" };
        }

        return conversationReferences;
    }
}

module.exports.NotificationBot = NotificationBot;
