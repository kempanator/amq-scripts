// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.10
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

New chat/message features:
1. Add timestamps to chat, dms, and nexus
2. Add color to usernames in dms and nexus
3. Adjustable dm width and height
4. Move level, ticket, and note count to the right
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

const version = "0.10";
const saveData = JSON.parse(localStorage.getItem("chatPlus")) || {};
const saveData2 = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
const $nexusChat = $("#nexusCoopMainContainer");
let gcTimestamps = saveData.gcTimestamps !== undefined ? saveData.gcTimestamps : true;
let ncTimestamps = saveData.ncTimestamps !== undefined ? saveData.ncTimestamps : true;
let dmTimestamps = saveData.dmTimestamps !== undefined ? saveData.dmTimestamps : true;
let ncColor = saveData.ncColor !== undefined ? saveData.ncColor : false;
let dmColor = saveData.dmColor !== undefined ? saveData.dmColor : true;
let dmWidthExtension = saveData.dmWidthExtension !== undefined ? saveData.dmWidthExtension : 60;
let dmHeightExtension = saveData.dmHeightExtension !== undefined ? saveData.dmHeightExtension : 40;
let shiftRight = saveData.shiftRight !== undefined ? saveData.shiftRight : true;
//let gcMaxMessages = saveData.gcMaxMessages !== undefined ? saveData.gcMaxMessages : 200;
//let ncMaxMessages = saveData.ncMaxMessages !== undefined ? saveData.ncMaxMessages : 100;
applyStyles();

$("#settingsGraphicContainer").append($(`
    <div class="row" style="padding-top: 10px">
        <div id="smChatPlusSettings" class="col-xs-12">
            <div style="text-align: center">
                <label>Chat Plus Settings</label>
            </div>
            <div style="padding-top: 5px">
                <span><b>Timestamps:</b></span>
                <span style="margin-left: 10px">Chat</span>
                <div class="customCheckbox" style="vertical-align: bottom">
                    <input type="checkbox" id="chatPlusGCTimestamps">
                    <label for="chatPlusGCTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">Nexus</span>
                <div class="customCheckbox" style="vertical-align: bottom">
                    <input type="checkbox" id="chatPlusNCTimestamps">
                    <label for="chatPlusNCTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">DM</span>
                <div class="customCheckbox" style="vertical-align: bottom">
                    <input type="checkbox" id="chatPlusDMTimestamps">
                    <label for="chatPlusDMTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 45px"><b>Name Color</b>:</span>
                <span style="margin-left: 10px">Nexus</span>
                <div class="customCheckbox" style="vertical-align: bottom">
                    <input type="checkbox" id="chatPlusNCColor">
                    <label for="chatPlusNCColor"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">DM</span>
                <div class="customCheckbox" style="vertical-align: bottom">
                    <input type="checkbox" id="chatPlusDMColor">
                    <label for="chatPlusDMColor"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
            <div style="padding-top: 10px">
                <span><b>Extend DM (px):</b></span>
                <span style="margin-left: 10px">Width</span>
                <input id="chatPlusDMWidthExtension" type="text" style="width: 35px; color: black;">
                <button id="chatPlusDMWidthExtensionButton" style="color: black">Go</button>
                <span style="margin-left: 10px">Height</span>
                <input id="chatPlusDMHeightExtension" type="text" style="width: 35px; color: black;">
                <button id="chatPlusDMHeightExtensionButton" style="color: black">Go</button>
                <span style="margin-left: 50px"><b>Shift Right</b>:</span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusShiftRight">
                    <label for="chatPlusShiftRight"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
        </div>
    </div>
`));

$("#chatPlusGCTimestamps").prop("checked", gcTimestamps).click(() => {
    gcTimestamps = !gcTimestamps;
    applyStyles();
    saveSettings();
});
$("#chatPlusNCTimestamps").prop("checked", ncTimestamps).click(() => {
    ncTimestamps = !ncTimestamps;
    applyStyles();
    saveSettings();
});
$("#chatPlusDMTimestamps").prop("checked", dmTimestamps).click(() => {
    dmTimestamps = !dmTimestamps;
    applyStyles();
    saveSettings();
});
$("#chatPlusNCColor").prop("checked", ncColor).click(() => {
    ncColor = !ncColor;
    applyStyles();
    saveSettings();
});
$("#chatPlusDMColor").prop("checked", dmColor).click(() => {
    dmColor = !dmColor;
    applyStyles();
    saveSettings();
});
$("#chatPlusDMWidthExtension").val(dmWidthExtension);
$("#chatPlusDMWidthExtensionButton").click(() => {
    let number = parseInt($("#chatPlusDMWidthExtension").val());
    if (!isNaN(number) && number >= 0) {
        dmWidthExtension = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusDMHeightExtension").val(dmHeightExtension);
$("#chatPlusDMHeightExtensionButton").click(() => {
    let number = parseInt($("#chatPlusDMHeightExtension").val());
    if (!isNaN(number) && number >= 0) {
        dmHeightExtension = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusShiftRight").prop("checked", shiftRight).click(() => {
    shiftRight = !shiftRight;
    applyStyles();
    saveSettings();
});

function setup() {
    //gameChat.MAX_CHAT_MESSAGES = gcMaxMessages;
    //nexusCoopChat.MAX_CHAT_MESSAGES = ncMaxMessages;
    //$nexusChat.css({resize: "both", overflow: "hidden"});

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
        }
    }).observe(document.querySelector("#gcMessageContainer"), {childList: true, attributes: false, CharacterData: false});

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes || !ncTimestamps) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                if ($node.is(".ncTimestamp .ps__scrollbar-y-rail .ps__scrollbar-x-rail")) return;
                let date = new Date();
                let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
                let $timestampNode = $(`<span class="ncTimestamp">${timestamp}</span>`)
                if (!$node.find(".nexusCoopChatName").length) $timestampNode.css("margin-right", "7px");
                $node.prepend($timestampNode);
                let name = $node.find(".nexusCoopChatName").text().slice(0, -1);
                if (name === selfName) $node.find(".nexusCoopChatName").addClass("self");
                else if (socialTab.isFriend(name)) $node.find(".nexusCoopChatName").addClass("friend");
            }
        }
    }).observe(document.querySelector("#nexusCoopChatContainerInner"), {childList: true, attributes: false, CharacterData: false});

    AMQ_addScriptData({
        name: "Chat Plus",
        author: "kempanator",
        description: `
            <ul><b>New chat/message features:</b>
                <li>1. Add timestamps to chat, dms, and nexus</li>
                <li>2. Add color to usernames in dms and nexus</li>
                <li>3. Adjustable dm width and height</li>
                <li>4. Move level, ticket, and note count to the right</li>
                <li>5. Bug fix for new dms not autoscrolling</li>
            </ul>
        `
    });
}

function applyStyles() {
    AMQ_addStyle(`
        #chatContainer {
            width: ${shiftRight ? "calc(100% - 646px)" : "calc(50% - 205px)"};
            height: ${300 + dmHeightExtension}px;
        }
        #activeChatScrollContainer {
            margin-top: ${255 + dmHeightExtension}px;
        }
        #xpOuterContainer {
            width: ${shiftRight ? "110px" : "240px"};
            margin: ${shiftRight ? 0 : "auto"};
            left: ${shiftRight ? "auto" : 0};
            right: ${shiftRight ? "450px" : 0};
        }
        #xpBarOuter {
            width: ${shiftRight ? "110px" : "240px"};
        }
        #currencyContainer {
            left: ${shiftRight ? "110px" : "240px"};
        }
        .chatBoxContainer {
            height: ${200 + dmHeightExtension}px;
        }
        .chatContent {
            height: ${132 + dmHeightExtension}px;
        }
        .chatBox {
            width: ${155 + dmWidthExtension}px;
        }
        .chatTopBar p {
            width: ${76 + dmWidthExtension}px;
        }
        .gcTimestamp {
            opacity: 0.5;
        }
        .dmTimestamp {
            opacity: 0.5;
        }
        .ncTimestamp {
            opacity: 0.7;
        }
        .dmUsername {
            font-weight: bold;
        }
        .dmUsername.self, .nexusCoopChatName.self {
            color: ${dmColor ? getSelfColor() : "inherit"};
        }
        .dmUsername.friend, .nexusCoopChatName.friend {
            color: ${dmColor ? getFriendColor() : "inherit"};
        } 
    `);
}

function getSelfColor() {
    return saveData2 ? saveData2.smColorSelfColor : "#80c7ff";
}

function getFriendColor() {
    return saveData2 ? saveData2.smColorFriendColor : "#80ff80";
}

function saveSettings() {
    let settings = {};
    settings.gcTimestamps = gcTimestamps;
    settings.ncTimestamps = ncTimestamps;
    settings.dmTimestamps = dmTimestamps;
    settings.dmColor = dmColor;
    settings.ncColor = ncColor;
    settings.dmWidthExtension = dmWidthExtension;
    settings.dmHeightExtension = dmHeightExtension;
    settings.shiftRight = shiftRight;
    localStorage.setItem("chatPlus", JSON.stringify(settings));
}

// override writeMessage function to inject timestamp and username color
ChatBox.prototype.writeMessage = function(sender, msg, emojis, allowHtml) {
    msg = passChatMessage(msg, emojis, allowHtml);
    let date = new Date();
    let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
    let atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight - 20;
    let dmUsernameClass = "dmUsername";
    if (sender === selfName) dmUsernameClass += " self";
    else if (socialTab.isFriend(sender)) dmUsernameClass += " friend";
    let newDMFormat;
    if (dmTimestamps) newDMFormat = `\n\t<li>\n\t\t<span class="dmTimestamp">${timestamp}</span> <span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    else newDMFormat = `\n\t<li>\n\t\t<span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    this.$CHAT_CONTENT.append(newDMFormat);
    if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    this.$CHAT_CONTENT.perfectScrollbar("update");
};

// override updateLayout function to account for width extension
ChatBar.prototype.updateLayout = function() {
    this._$ACTIVE_CHAT_SCROLL_CONTAINER.width(this.activeChats.length * (165 + dmWidthExtension));
    this.activeChatContainerDom.perfectScrollbar("update");
    this.toggleIndicators();
    this.closeOutsideChats();
};

// override getInsideOffsets function to account for width extension
ChatBar.prototype.getInsideOffsets = function() {
    let containerWidth = this.activeChatContainerDom.innerWidth();
    let insideLeftOffset = - this._$ACTIVE_CHAT_SCROLL_CONTAINER.position().left;
    let insideRightOffset = insideLeftOffset + containerWidth - (165 + dmWidthExtension);
    return {right: insideRightOffset, left: insideLeftOffset};
};

// override toggleIndicators function to account for width extension
ChatBar.prototype.toggleIndicators = function() {
    let offsets = this.getInsideOffsets();
    offsets.left -= (165 + dmWidthExtension) / 2;
    offsets.right += (165 + dmWidthExtension) / 2;
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

// override handleAlert function to account for height extension
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
    this.$CHAT_CONTENT.css("height", 132 + dmHeightExtension - headerHeight);
    if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    this.$CHAT_CONTENT.perfectScrollbar("update");
    this.newUpdate();
};

// override displayMessage to include username color
nexusCoopChat.displayMessage = function({sender, message, emojis, badges}) {
    let $chatMessage = $(format(this.CHAT_MESSAGE_TEMPLATE, escapeHtml(sender), passChatMessage(message, emojis)));
    popoutEmotesInMessage($chatMessage, "#nexusCoopMainContainer");
    let $badgeContainer = $chatMessage.find(".nexusCoopChatBadgeContainer");
    badges.forEach((badge) => {
        let $badge = $(this.BADGE_TEMPLATE);
        new PreloadImage($badge, cdnFormater.newBadgeSrc(badge.fileName), cdnFormater.newBadgeSrcSet(badge.fileName));
        $badge.popover({
            content: createBadgePopoverHtml(badge.fileName, badge.name),
            html: true,
            delay: 50,
            placement: "auto top",
            trigger: "hover",
            container: "#gcChatContent",
        });
        $badgeContainer.append($badge);
    });
    if (selfName !== sender) {
        let $username = $chatMessage.find(".nexusCoopChatName");
        $username.addClass("clickAble");
        let openProfileFunction = () => {
            playerProfileController.loadProfileIfClosed(sender, $username, {}, () => {}, false, true);
        };
        $username.click(openProfileFunction);
    }
    this.chatMesageList.push($chatMessage);
    if (this.chageMessageList > this.MAX_CHAT_MESSAGES) {
        let oldestMessage = this.chatMesageList.shift();
        oldestMessage.remove();
    }
    this.insertMsg($chatMessage);
}

/*
// override resetDrag function to remove custom width and height of nexus chat
nexusCoopChat.resetDrag = function() {
    this.$container.css("transform", "");
    this.$container.removeClass("dragged");
    $nexusChat.removeAttr("style");
    $nexusChat.css({resize: "both", overflow: "hidden"});
}
*/