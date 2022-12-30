// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.15
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
6. Load images/audio/video directly in chat
7. Add a gif search window in chat using tenor
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.15";
const apiKey = "LIVDSRZULELA";
const saveData = JSON.parse(localStorage.getItem("chatPlus")) || {};
const saveData2 = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
const imageURLregex = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|tiff)/i;
const audioURLregex = /https?:\/\/\S+\.(?:mp3|ogg|m4a|flac|wav)/i;
const videoURLregex = /https?:\/\/\S+\.(?:webm|mp4|mkv|avi|mov)/i;
let gcTimestamps = saveData.gcTimestamps !== undefined ? saveData.gcTimestamps : true;
let ncTimestamps = saveData.ncTimestamps !== undefined ? saveData.ncTimestamps : true;
let dmTimestamps = saveData.dmTimestamps !== undefined ? saveData.dmTimestamps : true;
let ncColor = saveData.ncColor !== undefined ? saveData.ncColor : false;
let dmColor = saveData.dmColor !== undefined ? saveData.dmColor : true;
let dmWidthExtension = saveData.dmWidthExtension !== undefined ? saveData.dmWidthExtension : 60;
let dmHeightExtension = saveData.dmHeightExtension !== undefined ? saveData.dmHeightExtension : 40;
let resizeNexusChat = saveData.resizeNexusChat !== undefined ? saveData.resizeNexusChat : false;
let shiftRight = saveData.shiftRight !== undefined ? saveData.shiftRight : true;
let gcLoadMediaButton = saveData.gcLoadMediaButton !== undefined ? saveData.gcLoadMediaButton : true;
let gcAutoLoadMedia = saveData.gcAutoLoadMedia !== undefined ? saveData.gcAutoLoadMedia : "never";
let gcMaxMessages = saveData.gcMaxMessages !== undefined ? saveData.gcMaxMessages : 200;
let ncMaxMessages = saveData.ncMaxMessages !== undefined ? saveData.ncMaxMessages : 100;
let gifSearch = saveData.gifSearch !== undefined ? saveData.gifSearch : true;
let gifSearchHeight = saveData.gifSearchHeight !== undefined ? saveData.gifSearchHeight : 200;
let gifSendOnClick = saveData.gifSendOnClick !== undefined ? saveData.gifSendOnClick : true;
let tenorQuery;
let tenorPosition;
let imagesPerRequest = 20;

$("#settingsGraphicContainer").append(`
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
                <span><b>Max Messages:</b></span>
                <span style="margin-left: 10px">Chat</span>
                <input id="chatPlusGCMaxMessages" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 10px">Nexus</span>
                <input id="chatPlusNCMaxMessages" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 48px"><b>Resize Nexus Chat</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusResizeNexusChat">
                    <label for="chatPlusResizeNexusChat"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
            <div style="padding-top: 10px">
                <span><b>Extend DM (px):</b></span>
                <span style="margin-left: 10px">Width</span>
                <input id="chatPlusDMWidthExtension" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 10px">Height</span>
                <input id="chatPlusDMHeightExtension" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 37px"><b>Shift XP/Notes Right</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusShiftRight">
                    <label for="chatPlusShiftRight"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
            <div style="padding-top: 10px">
                <span><b>Load Media in Chat</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusLoadMedia">
                    <label for="chatPlusLoadMedia"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span id="chatPlusAutoLoadMediaContainer" style="margin-left: 40px">
                    <span><b>Auto Load Media:</b></span>
                    <span style="margin-left: 10px">Never</span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusAutoLoadMediaNever">
                        <label for="chatPlusAutoLoadMediaNever"><i class="fa fa-check" aria-hidden="true"></i></label>
                    </div>
                    <span style="margin-left: 10px">Friends</span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusAutoLoadMediaFriends">
                        <label for="chatPlusAutoLoadMediaFriends"><i class="fa fa-check" aria-hidden="true"></i></label>
                    </div>
                    <span style="margin-left: 10px">All</span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusAutoLoadMediaAll">
                        <label for="chatPlusAutoLoadMediaAll"><i class="fa fa-check" aria-hidden="true"></i></label>
                    </div>
                </span>
            </div>
            <div style="padding-top: 10px">
                <span><b>Gif Search</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusGifSearch">
                    <label for="chatPlusGifSearch"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span id="chatPlusGifSearchContainer" style="margin-left: 40px">
                    <span><b>Gif Window:</b></span>
                    <span style="margin-left: 10px">Height</span>
                    <input id="chatPlusGifSearchHeight" class="form-control" type="text" style="width: 40px">
                    <span style="margin-left: 10px">Send on click</span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusGifSendOnClick">
                        <label for="chatPlusGifSendOnClick"><i class="fa fa-check" aria-hidden="true"></i></label>
                    </div>
                </span>
            </div>
        </div>
    </div>
`);

$("#gameChatContainer .gcInputContainer").append(`
    <div id="gcGifSearchContainer">
        <div id="gcGifSearchButton" class="clickAble">
            <i class="fa fa-picture-o" aria-hidden="true"></i>
        </div>
    </div>
`);

$("#gcMessageContainer").after(`
    <div id="gcGifContainer">
        <input id="tenorSearchInput" type="text" placeholder="gif search...">
        <div id="tenorGifContainer"></div>
    </div>
`);

const $tenorGifContainer = $("#tenorGifContainer");

$("#chatPlusGCTimestamps").prop("checked", gcTimestamps).click(() => {
    gcTimestamps = !gcTimestamps;
    saveSettings();
});
$("#chatPlusNCTimestamps").prop("checked", ncTimestamps).click(() => {
    ncTimestamps = !ncTimestamps;
    saveSettings();
});
$("#chatPlusDMTimestamps").prop("checked", dmTimestamps).click(() => {
    dmTimestamps = !dmTimestamps;
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
$("#chatPlusDMWidthExtension").val(dmWidthExtension).blur(() => {
    let number = parseInt($("#chatPlusDMWidthExtension").val());
    if (Number.isInteger(number) && number >= 0) {
        dmWidthExtension = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusDMHeightExtension").val(dmHeightExtension).blur(() => {
    let number = parseInt($("#chatPlusDMHeightExtension").val());
    if (Number.isInteger(number) && number >= 0) {
        dmHeightExtension = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusResizeNexusChat").prop("checked", resizeNexusChat).click(() => {
    resizeNexusChat = !resizeNexusChat;
    if (resizeNexusChat) $("#nexusCoopMainContainer").css({"resize": "both", "overflow": "hidden", "min-width": "initial", "max-width": "initial"});
    else $("#nexusCoopMainContainer").removeAttr("style");
    saveSettings();
});
$("#chatPlusShiftRight").prop("checked", shiftRight).click(() => {
    shiftRight = !shiftRight;
    applyStyles();
    saveSettings();
});
$("#chatPlusGCMaxMessages").val(gcMaxMessages).blur(() => {
    let number = parseInt($("#chatPlusGCMaxMessages").val());
    if (Number.isInteger(number) && number > 0) {
        gcMaxMessages = number;
        gameChat.MAX_CHAT_MESSAGES = number;
        saveSettings();
    }
});
$("#chatPlusNCMaxMessages").val(ncMaxMessages).blur(() => {
    let number = parseInt($("#chatPlusNCMaxMessages").val());
    if (Number.isInteger(number) && number > 0) {
        ncMaxMessages = number;
        nexusCoopChat.MAX_CHAT_MESSAGES = number;
        saveSettings();
    }
});
$("#chatPlusLoadMedia").prop("checked", gcLoadMediaButton).click(() => {
    gcLoadMediaButton = !gcLoadMediaButton;
    if (gcLoadMediaButton) $("#chatPlusAutoLoadMediaContainer").removeClass("disabled");
    else $("#chatPlusAutoLoadMediaContainer").addClass("disabled");    
    saveSettings();
});
$("#chatPlusAutoLoadMediaNever").prop("checked", gcAutoLoadMedia === "never").click(() => {
    gcAutoLoadMedia = "never";
    $("#chatPlusAutoLoadMediaFriends").prop("checked", false);
    $("#chatPlusAutoLoadMediaAll").prop("checked", false);
    saveSettings();
});
$("#chatPlusAutoLoadMediaFriends").prop("checked", gcAutoLoadMedia === "friends").click(() => {
    gcAutoLoadMedia = "friends";
    $("#chatPlusAutoLoadMediaNever").prop("checked", false);
    $("#chatPlusAutoLoadMediaAll").prop("checked", false);
    saveSettings();
});
$("#chatPlusAutoLoadMediaAll").prop("checked", gcAutoLoadMedia === "all").click(() => {
    gcAutoLoadMedia = "all";
    $("#chatPlusAutoLoadMediaNever").prop("checked", false);
    $("#chatPlusAutoLoadMediaFriends").prop("checked", false);
    saveSettings();
});
$("#chatPlusGifSearch").prop("checked", gifSearch).click(() => {
    gifSearch = !gifSearch;
    if (gifSearch) {
        $("#gcGifSearchContainer").show();
        $("#chatPlusGifSearchContainer").removeClass("disabled");
    }
    else {
        $("#gcGifSearchContainer").hide();
        $("#gcGifContainer").hide();
        $("#chatPlusGifSearchContainer").addClass("disabled");
    }
    applyStyles();
    saveSettings();
});
$("#chatPlusGifSearchHeight").val(gifSearchHeight).blur(() => {
    let number = parseInt($("#chatPlusGifSearchHeight").val());
    if (!isNaN(number) && number >= 0) {
        gifSearchHeight = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusGifSendOnClick").prop("checked", gifSendOnClick).click(() => {
    gifSendOnClick = !gifSendOnClick;
    saveSettings();
});
$("#gcGifSearchButton").click(() => {
    if ($("#gcGifContainer").is(":visible")) {
        $("#gcGifContainer").hide();
    }
    else {
        $("#gcGifContainer").show();
        $("#tenorSearchInput").val("").focus();
    }
});
$("#tenorGifContainer").scroll(() => {
    let atBottom = $tenorGifContainer.scrollTop() + $tenorGifContainer.innerHeight() >= tenorGifContainer.scrollHeight;
    if (atBottom) {
        fetch(`https://api.tenor.com/v1/search?q=${tenorQuery}&key=${apiKey}&limit=${imagesPerRequest}&pos=${tenorPosition}`).then(response => response.json()).then(data => {
            for (let gif of data.results) {
                let url = gif.media[0].gif.url;
                $tenorGifContainer.append($(`<img class="tenorGif" loading="lazy">`).attr("src", url).click(() => {
                    if (gifSendOnClick) {
                        $("#gcGifContainer").hide();
                        socket.sendCommand({type: "lobby", command: "game chat message", data: {msg: url, teamMessage: $("#gcTeamChatSwitch").hasClass("active")}});
                    }
                    else {
                        $("#gcInput").val((index, value) => value + url);
                    }
                }));
            };
        });
        tenorPosition += imagesPerRequest;
    }
});
$("#tenorSearchInput").keypress((event) => {
    if (event.which === 13) {
        $(".tenorGif").remove();
        tenorQuery = $("#tenorSearchInput").val();
        fetch(`https://api.tenor.com/v1/search?q=${tenorQuery}&key=${apiKey}&limit=${imagesPerRequest}`).then(response => response.json()).then(data => {
            for (let gif of data.results) {
                let url = gif.media[0].gif.url;
                $tenorGifContainer.append($(`<img class="tenorGif" loading="lazy">`).attr("src", url).click(() => {
                    if (gifSendOnClick) {
                        $("#gcGifContainer").hide();
                        socket.sendCommand({type: "lobby", command: "game chat message", data: {msg: url, teamMessage: $("#gcTeamChatSwitch").hasClass("active")}});
                    }
                    else {
                        $("#gcInput").val((index, value) => value + url);
                    }
                }));
            };
        });
        tenorPosition = imagesPerRequest;
    }
});
if (!gcLoadMediaButton) $("#chatPlusAutoLoadMediaContainer").addClass("disabled");
if (!gifSearch) $("#chatPlusGifSearchContainer").addClass("disabled");
$("#tenorGifContainer").perfectScrollbar();

AMQ_addStyle(`
    .gcTimestamp {
        opacity: 0.5;
    }
    .dmTimestamp {
        opacity: 0.5;
    }
    .ncTimestamp {
        opacity: 0.5;
    }
    .dmUsername {
        font-weight: bold;
    }
    #smChatPlusSettings input.form-control {
        height: initial;
        color: black;
        display: inline-block;
        padding: 2px 4px;
    }
    button.gcLoadMedia {
        background: #6D6D6D;
        color: #d9d9d9;
        display: block;
        margin: 5px auto 2px;
        padding: 3px 6px;
    }
    button.gcLoadMedia:hover {
        color: #d9d9d9;
        opacity: .7;
    }
    img.gcLoadedImage {
        display: block;
        margin: 5px auto 3px;
        max-width: 70%;
        max-height: 200px;
    }
    audio.gcLoadedAudio {
        display: block;
        margin: 5px auto 3px;
        width: 80%;
        height: 40px;
    }
    video.gcLoadedVideo {
        display: block;
        margin: 5px auto 3px;
        max-width: 70%;
        max-height: 200px;
    }
    #gcGifSearchContainer {
        position: absolute;
        top: 35px;
        right: 86px;
        width: 24px;
        height: 29px;
        z-index: 20;
    }
    #gcGifSearchButton > i {
        font-size: 25px;
        color: #1b1b1b;
    }
    #gcGifContainer {
        width: 100%;
        display: none;
        position: absolute;
        bottom: 75px;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 20;
    }
    #tenorSearchInput {
        color: black;
        width: 100%;
    }
    #tenorGifContainer {
        padding: 2px 0;
        position: absolute;
    }
    .tenorGif {
        height: 70px;
        margin: 2px;
        border-radius: 5px;
        cursor: pointer;
    }
`);

applyStyles();

function setup() {
    gameChat.MAX_CHAT_MESSAGES = gcMaxMessages;
    nexusCoopChat.MAX_CHAT_MESSAGES = ncMaxMessages;
    if (resizeNexusChat) $("#nexusCoopMainContainer").css({"resize": "both", "overflow": "hidden", "min-width": "initial", "max-width": "initial"});

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
            if (!mutation.addedNodes) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                if (gcTimestamps) {
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
                if (gcLoadMediaButton) {
                    let urls = extractUrls($node.find(".gcMessage").text());
                    if (urls.length > 0) {
                        if (imageURLregex.test(urls[0])) {
                            let name = $node.find(".gcUserName").text();
                            let atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                            if (gcAutoLoadMedia === "all" || (gcAutoLoadMedia === "friends" && (name === selfName || socialTab.isFriend(name)))) {
                                $node.append($(`<img>`).attr("src", urls[0]).addClass("gcLoadedImage").on("load", () => mediaOnLoad(atBottom)).click(function() {
                                    $(this).remove();
                                }));
                            }
                            else {
                                $node.append($(`<button>Load Image</button>`).addClass("btn gcLoadMedia").click(function() {
                                    let atBottom2 = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                                    $(this).remove();
                                    $node.append($(`<img>`).attr("src", urls[0]).addClass("gcLoadedImage").on("load", () => mediaOnLoad(atBottom2)).click(function() {
                                        $(this).remove();
                                    }));
                                }));
                            }
                        }
                        else if (audioURLregex.test(urls[0])) {
                            let name = $node.find(".gcUserName").text();
                            let atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                            if (gcAutoLoadMedia === "all" || (gcAutoLoadMedia === "friends" && (name === selfName || socialTab.isFriend(name)))) {
                                $node.append($(`<audio controls></audio>`).attr("src", urls[0]).addClass("gcLoadedAudio"));
                            }
                            else {
                                $node.append($(`<button>Load Audio</button>`).addClass("btn gcLoadMedia").click(function() {
                                    let atBottom2 = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                                    $(this).remove();
                                    $node.append($(`<audio controls></audio>`).attr("src", urls[0]).addClass("gcLoadedAudio"));
                                    if (atBottom2) gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
                                }));
                            }
                            if (atBottom) gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
                        }
                        else if (videoURLregex.test(urls[0])) {
                            let name = $node.find(".gcUserName").text();
                            let atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                            if (gcAutoLoadMedia === "all" || (gcAutoLoadMedia === "friends" && (name === selfName || socialTab.isFriend(name)))) {
                                $node.append($(`<video controls></video>`).attr("src", urls[0]).addClass("gcLoadedVideo").on("canplay", () => mediaOnLoad(atBottom)));
                            }
                            else {
                                $node.append($(`<button>Load Video</button>`).addClass("btn gcLoadMedia").click(function() {
                                    let atBottom2 = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                                    $(this).remove();
                                    $node.append($(`<video controls></video>`).attr("src", urls[0]).addClass("gcLoadedVideo").on("canplay", () => mediaOnLoad(atBottom2)));
                                }));
                            }
                        }
                    }
                }
            }
        }
    }).observe(document.querySelector("#gcMessageContainer"), {childList: true, attributes: false, CharacterData: false});

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                if ($node.is(".ncTimestamp .ps__scrollbar-y-rail .ps__scrollbar-x-rail")) return;
                if (ncTimestamps) {
                    let date = new Date();
                    let timestamp = date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
                    let $timestampNode = $(`<span class="ncTimestamp">${timestamp}</span>`);
                    if (!$node.find(".nexusCoopChatName").length) $timestampNode.css("margin-right", "7px");
                    $node.prepend($timestampNode);
                }
                if (ncColor) {
                    let name = $node.find(".nexusCoopChatName").text().slice(0, -1);
                    if (name === selfName) $node.find(".nexusCoopChatName").addClass("self");
                    else if (socialTab.isFriend(name)) $node.find(".nexusCoopChatName").addClass("friend");
                }
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
                <li>6. Load images/audio/video directly in chat</li>
                <li>7. Add a gif search window in chat using tenor</li>
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
        .dmUsername.self {
            color: ${dmColor ? getSelfColor() : "inherit"};
        }
        .dmUsername.friend {
            color: ${dmColor ? getFriendColor() : "inherit"};
        }
        .nexusCoopChatName.self {
            color: ${ncColor ? getSelfColor() : "inherit"};
        }
        .nexusCoopChatName.friend {
            color: ${ncColor ? getFriendColor() : "inherit"};
        }
        .gcInputContainer .textAreaContainer {
            width: ${gifSearch ? "calc(100% - 145px)" : "calc(100% - 120px)"};
        }
        #gcEmojiPickerOuterContainer, #gcGifSearchContainer {
            right: ${gifSearch ? "111px" : "86px"};
        }
        #gcGifContainer {
            height: ${gifSearchHeight}px;
        }
        #tenorGifContainer {
            height: ${gifSearchHeight - 27}px;
        }
    `);
}

function getSelfColor() {
    return saveData2 ? saveData2.smColorSelfColor : "#80c7ff";
}

function getFriendColor() {
    return saveData2 ? saveData2.smColorFriendColor : "#80ff80";
}

function mediaOnLoad(atBottom) {
    if (atBottom) {
        gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
    }
}

function saveSettings() {
    let settings = {};
    settings.gcTimestamps = gcTimestamps;
    settings.ncTimestamps = ncTimestamps;
    settings.dmTimestamps = dmTimestamps;
    settings.dmColor = dmColor;
    settings.ncColor = ncColor;
    settings.gcMaxMessages = gcMaxMessages;
    settings.ncMaxMessages = ncMaxMessages;
    settings.dmWidthExtension = dmWidthExtension;
    settings.dmHeightExtension = dmHeightExtension;
    settings.resizeNexusChat = resizeNexusChat;
    settings.shiftRight = shiftRight;
    settings.gcLoadMediaButton = gcLoadMediaButton;
    settings.gcAutoLoadMedia = gcAutoLoadMedia;
    settings.gifSearch = gifSearch;
    settings.gifSearchHeight = gifSearchHeight;
    settings.gifSendOnClick = gifSendOnClick;
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

// override resetDrag function to remove custom width and height of nexus chat
nexusCoopChat.resetDrag = function() {
    this.$container.css("transform", "");
    this.$container.removeClass("dragged");
    if (resizeNexusChat) $("#nexusCoopMainContainer").removeAttr("style").css({"resize": "both", "overflow": "hidden", "min-width": "initial", "max-width": "initial"});
};
