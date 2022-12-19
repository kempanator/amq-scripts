// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.8
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

Game chat features:
1. Add timestamps

DM features:
1. Add timestamps
2. Add color to usernames
3. Adjustable width and height
4. Move level, ticket, and note count to the right to make more space for dms
5. Bug fix for new dms not autoscrolling
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.8";
const saveData = JSON.parse(localStorage.getItem("chatPlus")) || {};
const saveData2 = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
let dmTimestamps = saveData.dmTimestamps || true;
let gcTimestamps = saveData.gcTimestamps || true;
let widthExtension = saveData.widthExtension || 60;
let heightExtension = saveData.heightExtension || 40;

AMQ_addStyle(`
    #chatContainer {
        width: calc(100% - 646px);
        height: ${300 + heightExtension}px;
    }
    #activeChatScrollContainer {
        margin-top: ${255 + heightExtension}px;
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
        height: ${200 + heightExtension}px;
    }
    .chatContent {
        height: ${132 + heightExtension}px;
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
    .dmUsernameSelf {
        color: ${saveData2 ? saveData2.smColorSelfColor : "#80c7ff"};
    }
    .dmUsernameFriend {
        color: ${saveData2 ? saveData2.smColorFriendColor : "80ff80"};
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

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes || !gcTimestamps) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                if ($node.is(".gcTimestamp .ps__scrollbar-y-rail .ps__scrollbar-x-rail")) return;
                let date = new Date();
                let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
                if ($node.find(".gcTeamMessageIcon").length === 1) {
                    $node.find(".gcTeamMessageIcon").after($(`<span class="gcTimestamp">${timestamp}</span>`));
                }
                else {
                    $node.prepend($(`<span class="gcTimestamp">${timestamp}</span>`));
                }
            }
        };
    }).observe(document.querySelector("#gcMessageContainer"), {childList: true, attributes: false, CharacterData: false});

    AMQ_addScriptData({
        name: "Chat Plus",
        author: "kempanator",
        description: `
            <ul><b>Game chat features:</b>
                <li>1. Add timestamps</li>
            </ul>
            <ul><b>DM features:</b>
                <li>1. Add timestamps</li>
                <li>2. Add color to usernames</li>
                <li>3. Adjustable width and height</li>
                <li>4. Move level, ticket, and note count to the right to make more space for dms</li>
                <li>5. Bug fix for new dms not autoscrolling</li>
            </ul>
        `
    });
}

function saveSettings() {
    let settings = {};
    settings.dmTimestamps = dmTimestamps;
    settings.gcTimestamps = gcTimestamps;
    settings.widthExtension = widthExtension;
    settings.heightExtension = heightExtension;
    localStorage.setItem("chatPlus", JSON.stringify(settings));
}

ChatBox.prototype.writeMessage = function(sender, msg, emojis, allowHtml) {
    msg = passChatMessage(msg, emojis, allowHtml);
    let date = new Date();
    let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
    let atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight - 20;
    let dmUsernameClass = "dmUsername";
    if (sender === selfName) dmUsernameClass = "dmUsernameSelf";
    else if (socialTab.onlineFriends[sender] || socialTab.offlineFriends[sender]) dmUsernameClass = "dmUsernameFriend";
    let newDMFormat;
    if (dmTimestamps) newDMFormat = `\n\t<li>\n\t\t<span class="dmTimestamp">${timestamp}</span> <span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    else newDMFormat = `\n\t<li>\n\t\t<span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    this.$CHAT_CONTENT.append(newDMFormat);
    if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    this.$CHAT_CONTENT.perfectScrollbar("update");
};

ChatBar.prototype.updateLayout = function() {
    this._$ACTIVE_CHAT_SCROLL_CONTAINER.width(this.activeChats.length * (165 + widthExtension));
    this.activeChatContainerDom.perfectScrollbar("update");
    this.toggleIndicators();
    this.closeOutsideChats();
};

ChatBar.prototype.getInsideOffsets = function() {
    let containerWidth = this.activeChatContainerDom.innerWidth();
    let insideLeftOffset = - this._$ACTIVE_CHAT_SCROLL_CONTAINER.position().left;
    let insideRightOffset = insideLeftOffset + containerWidth - (165 + widthExtension);
    return {right: insideRightOffset, left: insideLeftOffset};
};

ChatBar.prototype.toggleIndicators = function() {
	let offsets = this.getInsideOffsets();
	offsets.left -= (165 + widthExtension) / 2;
	offsets.right += (165 + widthExtension) / 2;
	let activeOutsideLeft = false;
	let activeOutsideRight = false;
	this.activeChats.forEach(chat => {
		if (chat.object.update) {
			let position = chat.object.getXOffset();
			if (position < offsets.left) activeOutsideLeft = true;
			else if (position > offsets.right) activeOutsideRight = true;
		}
	});
	if (activeOutsideLeft) this.$LEFT_INDICATOR.addClass("runAnimation");
    else this.$LEFT_INDICATOR.removeClass("runAnimation");
	if (activeOutsideRight) this.$RIGHT_INDICATOR.addClass("runAnimation");
	else this.$RIGHT_INDICATOR.removeClass("runAnimation");
};

ChatBox.prototype.handleAlert = function(msg, callback) {
	let atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight;
	this.$HEADER.text(msg);
	if (callback) {
		this.$HEADER.append(format(chatHeaderInputTemplate));
		this.container.find(".accept").click(createFriendRequestHandler.call(this, true, callback));
		this.container.find(".reject").click(createFriendRequestHandler.call(this, false, callback));
	} else {
		this.$HEADER.append(format(chatHeaderCloseTemplate));
		this.container.find(".accept").click(this.closeHeader.bind(this));
	}
	this.$HEADER.removeClass("hidden");
	var headerHeight = this.container.find(".header").outerHeight(true);
	this.$CHAT_CONTENT.css("height", 132 + heightExtension - headerHeight);
	if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
	this.$CHAT_CONTENT.perfectScrollbar("update");
	this.newUpdate();
};
