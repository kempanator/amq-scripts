// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.4
// @description  Add timestamps, color, and wider boxes to DMs
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqChatPlus.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqChatPlus.user.js
// ==/UserScript==

/*
IMPORTANT: disable these scripts before installing
- chat time stamps by thejoseph98
- dm time stamps by xsardine
- bigger dms css by xsardine

FEATURES:
1. Add timestamps to chat
2. Add timestamps to DMs
3. Increase size of DMs
4. Move level, ticket, and note count to the right
5. Add colors to usernames in DMs if you have the highlight friends script
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.4";
const widthExtension = 60;
let saveData = JSON.parse(localStorage.getItem("highlightFriendsSettings"));

if (saveData) {
    AMQ_addStyle(`
        .dmUsernameSelf {
            color: ${saveData.smColorSelfColor};
        }
        .dmUsernameFriend {
            color: ${saveData.smColorFriendColor};
        }
    `);
}

AMQ_addStyle(`
    #chatContainer {
        width: calc(100% - 646px);
    }
    #xpOuterContainer {
        width: 110px;
        margin: 0;
        left: unset;
        right: 450px;
    }
    #xpBarOuter {
        position: absolute;
        width: 110px;
    }
    #currencyContainer {
        left: 110px;
    }
    .chatBoxContainer {
        height: 240px;
    }
    .chatContent {
        height: 175px;
    }
    .chatBox {
        width: ${155 + widthExtension}px;
    }
    .chatTopBar p {
        width: ${76 + widthExtension}px;
    }
    .gcTimestamp {
        opacity: 0.5;
    }
    .dmTimestamp {
        opacity: 0.5;
    }
    .dmUsername, .dmUsernameSelf, .dmUsernameFriend {
        font-weight: bold;
    }
`);

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName && message.message === "/version") {
                setTimeout(() => { gameChat.systemMessage("Chat Plus - " + version) }, 1);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName && payload.message === "/version") {
            setTimeout(() => { gameChat.systemMessage("Chat Plus - " + version) }, 1);
        }
    }).bindListener();

    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (!mutation.addedNodes) return;
            for (let i = 0; i < mutation.addedNodes.length; i++) {
                let node = mutation.addedNodes[i];
                if ($(node).hasClass("gcTimestamp")) return;
                if ($(node).hasClass("ps__scrollbar-y-rail")) return;
                if ($(node).hasClass("ps__scrollbar-x-rail")) return;
                let date = new Date();
                let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
                if ($(node).find(".gcTeamMessageIcon").length === 1) {
                    $(node).find(".gcTeamMessageIcon").after($(`<span class="gcTimestamp">${timestamp}</span>`));
                }
                else {
                    $(node).prepend($(`<span class="gcTimestamp">${timestamp}</span>`));
                }
                let chat = gameChat.$chatMessageContainer;
                let atBottom = chat.scrollTop() + chat.innerHeight() >= chat[0].scrollHeight - 25;
                if (atBottom) chat.scrollTop(chat.prop("scrollHeight"));
            }
        });
    }).observe(document.querySelector("#gcMessageContainer"), {childList: true, attributes: false, CharacterData: false});

    AMQ_addScriptData({
        name: "Chat Plus",
        author: "kempanator",
        description: `Add timestamps, color, and wider boxes to DMs`
    });
}

ChatBox.prototype.writeMessage = function(sender, msg, emojis, allowHtml) {
    msg = passChatMessage(msg, emojis, allowHtml);
    let date = new Date();
    let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
    let atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight;
    let dmUsernameClass = "dmUsername";
    if (sender === selfName) dmUsernameClass = "dmUsernameSelf";
    else if (socialTab.onlineFriends[sender] || socialTab.offlineFriends[sender]) dmUsernameClass = "dmUsernameFriend";
    let newDMFormat = `\n\t<li>\n\t\t<span class="dmTimestamp">${timestamp}</span> <span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    this.$CHAT_CONTENT.append(newDMFormat);
    if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    this.$CHAT_CONTENT.perfectScrollbar("update");
};

ChatBar.prototype.updateLayout = function() {
    this._$ACTIVE_CHAT_SCROLL_CONTAINER.width(this.activeChats.length * (165 + widthExtension));
    this.activeChatContainerDom.perfectScrollbar('update');
    this.toggleIndicators();
    this.closeOutsideChats();
};

ChatBar.prototype.getInsideOffsets = function() {
    let containerWidth = this.activeChatContainerDom.innerWidth();
    let insideLeftOffset = - this._$ACTIVE_CHAT_SCROLL_CONTAINER.position().left;
    let insideRightOffset = insideLeftOffset + containerWidth - (165 + widthExtension);
    return {right: insideRightOffset, left: insideLeftOffset};
};

/*
    #chatContainer {
        height: 330px;
        left: 240px;
        width: calc(77% - 205px);
    }
    #activeChatScrollContainer {
        padding-left: 0px;
    }
    .chatBox {
        width: 294px;
        margin-right: 20px;
        bottom: -30px;
    }
    .chatTopBar p {
        width: 182px;
    }
    .chatContent {
        height: 209px;
        margin-left: 2px;
    }
    .chatBoxContainer {
        height: 275px;
        bottom: 0px;
    }
    .chatBoxContainer .header {
        height: 55px;
        line-height: 25px;
    }
    .chatBoxContainer.open {
        transform: translateY(-16%);
    }
*/
