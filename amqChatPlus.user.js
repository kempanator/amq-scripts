// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.33
// @description  Add new features to chat and messages
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js
// ==/UserScript==

/*
IMPORTANT: disable these scripts before installing
- chat time stamps by thejoseph98/joske2865
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
8. Drag & drop or copy & paste file into chat/dm to automatically upload to litterbox
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.33";
const apiKey = "LIVDSRZULELA";
const saveData = validateLocalStorage("chatPlus");
const imageURLregex = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|tiff)/i;
const audioURLregex = /https?:\/\/\S+\.(?:mp3|ogg|m4a|flac|wav)/i;
const videoURLregex = /https?:\/\/\S+\.(?:webm|mp4|mkv|avi|mov)/i;
let gcTimestamps = saveData.gcTimestamps ?? true;
let ncTimestamps = saveData.ncTimestamps ?? true;
let dmTimestamps = saveData.dmTimestamps ?? true;
let timeStampFormat = saveData.timeStampFormat ?? "0"; //0: HH:MM, 1: HH:MM:SS
let ncColor = saveData.ncColor ?? false;
let dmColor = saveData.dmColor ?? true;
let reformatBottomBar = saveData.reformatBottomBar ?? true;
let loadBalancerFromLeft = saveData.loadBalancerFromLeft ?? 225;
let xpBarWidth = saveData.xpBarWidth ?? 110;
let xpBarFromRight = saveData.xpBarFromRight ?? 496;
let dmWidthExtension = saveData.dmWidthExtension ?? 60;
let dmHeightExtension = saveData.dmHeightExtension ?? 40;
let resizeNexusChat = saveData.resizeNexusChat ?? false;
let gcLoadMediaButton = saveData.gcLoadMediaButton ?? true;
let gcAutoLoadMedia = saveData.gcAutoLoadMedia ?? "never";
let gifSearch = saveData.gifSearch ?? true;
let gifSearchHeight = saveData.gifSearchHeight ?? 250;
let gifSendOnClick = saveData.gifSendOnClick ?? true;
let gcMaxMessages = saveData.gcMaxMessages ?? 200;
let ncMaxMessages = saveData.ncMaxMessages ?? 100;
let fileUploadToLitterbox = saveData.fileUploadToLitterbox ?? true;
let tenorQuery;
let tenorPosition;
let imagesPerRequest = 20;
let litterboxUploadTime = "12h";
let showCustomColors = true;
let customColorMap = {};

$("#settingsGraphicContainer").append(/*html*/`
    <div class="row" style="padding-top: 10px">
        <div id="smChatPlusSettings" class="col-xs-12">
            <div style="text-align: center">
                <label>Chat Plus Settings</label>
            </div>
            <div style="padding-top: 5px">
                <span><b>Timestamps:</b></span>
                <span style="margin-left: 10px">Chat</span>
                <div class="customCheckbox">
                    <input type="checkbox" id="chatPlusGCTimestamps">
                    <label for="chatPlusGCTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">Nexus</span>
                <div class="customCheckbox">
                    <input type="checkbox" id="chatPlusNCTimestamps">
                    <label for="chatPlusNCTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">DM</span>
                <div class="customCheckbox">
                    <input type="checkbox" id="chatPlusDMTimestamps">
                    <label for="chatPlusDMTimestamps"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">Format</span>
                <select id="chatPlusTimestampFormatSelect" class="form-control" style="display: inline-block; width: 108px; height: auto; padding: 2px">
                    <option value="0">HH:MM</option>
                    <option value="1">HH:MM:SS</option>
                </select>
            </div>
            <div style="padding-top: 10px">
                <span style="margin-left: 0px"><b>Name Color:</b></span>
                <span style="margin-left: 10px">Nexus</span>
                <div class="customCheckbox">
                    <input type="checkbox" id="chatPlusNCColor">
                    <label for="chatPlusNCColor"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span style="margin-left: 10px">DM</span>
                <div class="customCheckbox">
                    <input type="checkbox" id="chatPlusDMColor">
                    <label for="chatPlusDMColor"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span id="chatPlusLoadBalancerContainer">
                    <span style="margin-left: 45px"><b>Load Balancer:</b></span>
                    <span style="margin-left: 10px"># Pixels From Left</span>
                    <input id="chatPlusLoadBalancerPositionInput" class="form-control" type="text" style="width: 40px;">
                </span>
            </div>
            <div style="padding-top: 10px">
                <span><b>Extend DM (px):</b></span>
                <span style="margin-left: 10px">Width</span>
                <input id="chatPlusDMWidthExtension" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 10px">Height</span>
                <input id="chatPlusDMHeightExtension" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 38px"><b>Resize Nexus Chat</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusResizeNexusChat">
                    <label for="chatPlusResizeNexusChat"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
            <div style="padding-top: 10px">
                <span><b>Reformat XP/Currency</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusReformatBottomBar">
                    <label for="chatPlusReformatBottomBar"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
                <span id="chatPlusReformatBottomBarContainer" style="margin-left: 19px">
                    <span>XP Bar Width</span>
                    <input id="chatPlusXPBarWidth" class="form-control" type="text" style="width: 40px">
                    <span style="margin-left: 20px"># Pixels From Right</span>
                    <input id="chatPlusXPBarFromRight" class="form-control" type="text" style="width: 40px">
                </span>
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
                <span id="chatPlusGifSearchContainer" style="margin-left: 98px">
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
            <div style="padding-top: 10px">
                <span><b>Max Messages:</b></span>
                <span style="margin-left: 10px">Chat</span>
                <input id="chatPlusGCMaxMessages" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 10px">Nexus</span>
                <input id="chatPlusNCMaxMessages" class="form-control" type="text" style="width: 40px">
                <span style="margin-left: 50px"><b>Upload files to Litterbox</b></span>
                <div class="customCheckbox" style="vertical-align: middle">
                    <input type="checkbox" id="chatPlusUploadToLitterbox">
                    <label for="chatPlusUploadToLitterbox"><i class="fa fa-check" aria-hidden="true"></i></label>
                </div>
            </div>
        </div>
    </div>
`);

$("#gcChatContent .gcInputContainer").append(/*html*/`
    <div id="gcGifSearchOuterContainer">
        <div id="gcGifSearchButton" class="clickAble">
            <i class="fa fa-picture-o" aria-hidden="true"></i>
        </div>
    </div>
`);

$("#gcMessageContainer").after(/*html*/`
    <div id="gcGifContainer">
        <input id="tenorSearchInput" type="text" placeholder="gif search...">
        <div id="tenorGifContainer"></div>
    </div>
`);

const $gcInput = $("#gcInput");
const $tenorGifContainer = $("#tenorGifContainer");
$gcInput.popover({
    container: "#gcChatContent",
    placement: "top",
    trigger: "manual",
    content: ""
});
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
$("#chatPlusTimestampFormatSelect").val(timeStampFormat).on("change", function() {
    timeStampFormat = this.value;
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
$("#chatPlusReformatBottomBar").prop("checked", reformatBottomBar).click(() => {
    reformatBottomBar = !reformatBottomBar;
    if (reformatBottomBar) {
        $("#chatPlusReformatBottomBarContainer, #chatPlusLoadBalancerContainer").removeClass("disabled");
    }
    else {
        $("#chatPlusReformatBottomBarContainer, #chatPlusLoadBalancerContainer").addClass("disabled");
    }
    applyStyles();
    saveSettings();
});
$("#chatPlusLoadBalancerPositionInput").val(loadBalancerFromLeft).blur(() => {
    let number = parseInt($("#chatPlusLoadBalancerPositionInput").val());
    if (Number.isInteger(number) && number >= 0) {
        loadBalancerFromLeft = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusXPBarWidth").val(xpBarWidth).blur(() => {
    let number = parseInt($("#chatPlusXPBarWidth").val());
    if (Number.isInteger(number) && number >= 0) {
        xpBarWidth = number;
        applyStyles();
        saveSettings();
    }
});
$("#chatPlusXPBarFromRight").val(xpBarFromRight).blur(() => {
    let number = parseInt($("#chatPlusXPBarFromRight").val());
    if (Number.isInteger(number) && number >= 0) {
        xpBarFromRight = number;
        applyStyles();
        saveSettings();
    }
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
    if (resizeNexusChat) $("#nexusCoopMainContainer").css({"resize": "both", "overflow": "hidden", "min-width": "0", "max-width": "none"});
    else $("#nexusCoopMainContainer").removeAttr("style");
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
        $("#gcGifSearchOuterContainer").show();
        $("#chatPlusGifSearchContainer").removeClass("disabled");
    }
    else {
        $("#gcGifSearchOuterContainer").hide();
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
$("#chatPlusUploadToLitterbox").prop("checked", fileUploadToLitterbox).click(() => {
    fileUploadToLitterbox = !fileUploadToLitterbox;
    saveSettings();
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
                        $gcInput.val((index, value) => value + url);
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
                        $gcInput.val((index, value) => value + url);
                    }
                }));
            };
        });
        tenorPosition = imagesPerRequest;
    }
});
$gcInput.on("dragenter", () => {
    if (fileUploadToLitterbox) {
        $gcInput.data("bs.popover").options.content = "Upload to litterbox";
        $gcInput.popover("show");
    }
});
$gcInput.on("dragleave", () => {
    if (fileUploadToLitterbox) {
        $gcInput.popover("hide");
    }
});
$gcInput.on("drop", (event) => {
    if (fileUploadToLitterbox) {
        $gcInput.popover("hide");
        let file = event.originalEvent.dataTransfer.files[0];
        if (file) {
            event.preventDefault();
            event.stopPropagation();
            $gcInput.data("bs.popover").options.content = "Uploading to litterbox...";
            $gcInput.popover("show");
            fetch("https://litterbox.catbox.moe/resources/internals/api.php", {method: "POST", body: litterboxFormData(file)})
            .then((response) => response.text())
            .then((data) => {
                $gcInput.popover("hide");
                $gcInput.val((index, value) => value + data);
            })
            .catch((response) => {
                $gcInput.popover("hide");
                gameChat.systemMessage("Error: litterbox upload failed");
                console.log(response);
            });
        }
    }
});
$gcInput.on("paste", (event) => {
    if (fileUploadToLitterbox) {
        $gcInput.popover("hide");
        let file = event.originalEvent.clipboardData.files[0];
        if (file) {
            event.preventDefault();
            event.stopPropagation();
            $gcInput.data("bs.popover").options.content = "Uploading to litterbox...";
            $gcInput.popover("show");
            fetch("https://litterbox.catbox.moe/resources/internals/api.php", {method: "POST", body: litterboxFormData(file)})
            .then((response) => response.text())
            .then((data) => {
                $gcInput.popover("hide");
                $gcInput.val((index, value) => value + data);
            })
            .catch((response) => {
                $gcInput.popover("hide");
                gameChat.systemMessage("Error: litterbox upload failed");
                console.log(response);
            });
        }
    }
});
if (!reformatBottomBar) $("#chatPlusReformatBottomBarContainer, #chatPlusLoadBalancerContainer").addClass("disabled");
if (!gcLoadMediaButton) $("#chatPlusAutoLoadMediaContainer").addClass("disabled");
if (!gifSearch) $("#chatPlusGifSearchContainer").addClass("disabled");
$("#tenorGifContainer").perfectScrollbar();
applyStyles();

function setup() {
    gameChat.MAX_CHAT_MESSAGES = gcMaxMessages;
    nexusCoopChat.MAX_CHAT_MESSAGES = ncMaxMessages;
    if (resizeNexusChat) $("#nexusCoopMainContainer").css({"resize": "both", "overflow": "hidden", "min-width": "0", "max-width": "none"});

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                let atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                if (gcTimestamps) {
                    if ($node.is(".gcTimestamp .ps__scrollbar-y-rail .ps__scrollbar-x-rail")) return;
                    let timestamp = getTimestamp();
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
                        let name = $node.find(".gcUserName").text();
                        let canAutoLoad = gcAutoLoadMedia === "all" || (gcAutoLoadMedia === "friends" && (name === selfName || socialTab.isFriend(name)));
                        if (imageURLregex.test(urls[0])) {
                            createMediaElement($node, "img", urls[0], canAutoLoad);
                        }
                        else if (audioURLregex.test(urls[0])) {
                            createMediaElement($node, "audio", urls[0], canAutoLoad);
                        }
                        else if (videoURLregex.test(urls[0])) {
                            createMediaElement($node, "video", urls[0], canAutoLoad);
                        }
                    }
                }
                if (atBottom) gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
            }
        }
    }).observe(document.querySelector("#gcMessageContainer"), {childList: true, attributes: false, CharacterData: false});

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                let atBottom = nexusCoopChat.$chatMessageContainer.scrollTop() + nexusCoopChat.$chatMessageContainer.innerHeight() >= nexusCoopChat.$chatMessageContainer[0].scrollHeight - 100;
                if ($node.is(".ncTimestamp .ps__scrollbar-y-rail .ps__scrollbar-x-rail")) return;
                if (ncTimestamps) {
                    let timestamp = getTimestamp();
                    let $timestampNode = $(`<span class="ncTimestamp">${timestamp}</span>`);
                    if (!$node.find(".nexusCoopChatName").length) $timestampNode.css("margin-right", "7px");
                    $node.prepend($timestampNode);
                }
                if (ncColor) {
                    let name = $node.find(".nexusCoopChatName").text().slice(0, -1);
                    if (name === selfName) $node.find(".nexusCoopChatName").addClass("self");
                    else if (socialTab.isFriend(name)) $node.find(".nexusCoopChatName").addClass("friend");
                    if (customColorMap.hasOwnProperty(name.toLowerCase())) $node.find(".nexusCoopChatName").addClass("customColor" + customColorMap[sender.toLowerCase()]);
                }
                if (atBottom) nexusCoopChat.$chatMessageContainer.scrollTop(nexusCoopChat.$chatMessageContainer.prop("scrollHeight"));
            }
        }
    }).observe(document.querySelector("#nexusCoopChatContainerInner"), {childList: true, attributes: false, CharacterData: false});

    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (!mutation.addedNodes) return;
            for (let node of mutation.addedNodes) {
                let $node = $(node);
                if ($node.hasClass("chatBox")) {
                    $node.find("textarea").on("drop", (event) => {
                        if (fileUploadToLitterbox) {
                            let file = event.originalEvent.dataTransfer.files[0];
                            if (file) {
                                event.preventDefault();
                                event.stopPropagation();
                                fetch("https://litterbox.catbox.moe/resources/internals/api.php", {method: "POST", body: litterboxFormData(file)})
                                .then((response) => response.text())
                                .then((data) => {
                                    $node.find("textarea").val((index, value) => value + data);
                                })
                                .catch((response) => {
                                    console.log(response);
                                });
                            }
                        }
                    }).on("paste", (event) => {
                        if (fileUploadToLitterbox) {
                            let file = event.originalEvent.clipboardData.files[0];
                            if (file) {
                                event.preventDefault();
                                event.stopPropagation();
                                fetch("https://litterbox.catbox.moe/resources/internals/api.php", {method: "POST", body: litterboxFormData(file)})
                                .then((response) => response.text())
                                .then((data) => {
                                    $node.find("textarea").val((index, value) => value + data);
                                })
                                .catch((response) => {
                                    console.log(response);
                                });
                            }
                        }
                    });
                }
            }
        }
    }).observe(document.querySelector("#activeChatScrollContainer"), {childList: true, attributes: false, CharacterData: false});

    AMQ_addScriptData({
        name: "Chat Plus",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js",
        description: `
            <ul><b>New chat/message features:</b>
                <li>1. Add timestamps to chat, dms, and nexus</li>
                <li>2. Add color to usernames in dms and nexus</li>
                <li>3. Adjustable dm width and height</li>
                <li>4. Move level, ticket, and note count to the right</li>
                <li>5. Bug fix for new dms not autoscrolling</li>
                <li>6. Load images/audio/video directly in chat</li>
                <li>7. Add a gif search window in chat using tenor</li>
                <li>8. Drag & drop or copy & paste file into chat/dm to automatically upload to litterbox</li>
            </ul>
        `
    });
}

// create load button or img/audio/video element in chat
function createMediaElement($node, type, src, autoLoad) {
    let atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
    $node.find(".gcLoadMediaContainer").remove();
    let $container = $(`<div class="gcLoadMediaContainer"></div>`);
    if (type === "img") {
        if (autoLoad) {
            let $img = $(`<img class="gcLoadedImage">`).attr("src", src).on("load", () => gcCheckAtBottom(atBottom));
            let $button = $(`<button class="btn gcCloseMedia"><i class="fa fa-close"></i></button>`).hide().click(() => {
                createMediaElement($node, type, src, false);
            });
            $container.append($img);
            $container.append($button);
            $container.hover(() => $button.show(), () => $button.hide());
        }
        else {
            $container.append($(`<button class="btn gcLoadMediaButton">Load Image</button>`).click(() => {
                createMediaElement($node, type, src, true);
            }));
            gcCheckAtBottom(atBottom);
        }
    }
    else if (type === "audio") {
        if (autoLoad) {
            let $audio = $(`<audio class="gcLoadedAudio" controls></audio>`).attr("src", src);
            let $button = $(`<button class="btn gcCloseMedia"><i class="fa fa-close"></i></button>`).hide().click(() => {
                createMediaElement($node, type, src, false);
            });
            $container.append($audio);
            $container.append($button);
            $container.hover(() => $button.show(), () => $button.hide());
            gcCheckAtBottom(atBottom);
        }
        else {
            $container.append($(`<button class="btn gcLoadMediaButton">Load Audio</button>`).click(() => {
                createMediaElement($node, type, src, true);
            }));
            gcCheckAtBottom(atBottom);
        }
    }
    else if (type === "video") {
        if (autoLoad) {
            let $video = $(`<video class="gcLoadedVideo" controls></video>`).attr("src", src).on("canplay", () => gcCheckAtBottom(atBottom));
            let $button = $(`<button class="btn gcCloseMedia"><i class="fa fa-close"></i></button>`).hide().click(() => {
                createMediaElement($node, type, src, false);
            });
            $container.append($video);
            $container.append($button);
            $container.hover(() => $button.show(), () => $button.hide());
        }
        else {
            $container.append($(`<button class="btn gcLoadMediaButton">Load Video</button>`).click(() => {
                createMediaElement($node, type, src, true);
            }));
            gcCheckAtBottom(atBottom);
        }
    }
    $node.append($container);
}

// check if the main game chat window is scrolled to the bottom
function gcCheckAtBottom(atBottom) {
    if (atBottom) {
        gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
    }
}

// return form data for litterbox
function litterboxFormData(file) {
    let formData = new FormData();
    formData.append("fileToUpload", file);
    formData.append("reqtype", "fileupload");
    formData.append("time", litterboxUploadTime);
    return formData;
}

// get formatted timestamp
function getTimestamp() {
    let date = new Date();
    if (timeStampFormat === "0") {
        return date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
    }
    else if (timeStampFormat === "1") {
        return date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0) + ":" + date.getSeconds().toString().padStart(2, 0);
    }
}

// override writeMessage function to inject timestamp and username color
ChatBox.prototype.writeMessage = function(sender, msg, emojis, allowHtml) {
    msg = passChatMessage(msg, emojis, allowHtml);
    let timestamp = getTimestamp();
    let atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight - 20;
    let dmUsernameClass = "dmUsername";
    if (sender === selfName) dmUsernameClass += " self";
    else if (socialTab.isFriend(sender)) dmUsernameClass += " friend";
    if (customColorMap.hasOwnProperty(sender.toLowerCase())) dmUsernameClass += " customColor" + customColorMap[sender.toLowerCase()];
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
const oldResetDrag = nexusCoopChat.resetDrag;
nexusCoopChat.resetDrag = function() {
    oldResetDrag.apply(this, arguments);
    if (resizeNexusChat) $("#nexusCoopMainContainer").removeAttr("style").css({"resize": "both", "overflow": "hidden", "min-width": "0", "max-width": "none"});
};

// validate json data in local storage
function validateLocalStorage(item) {
    try {
        return JSON.parse(localStorage.getItem(item)) || {};
    }
    catch {
        return {};
    }
}

// save settings
function saveSettings() {
    let settings = {};
    settings.gcTimestamps = gcTimestamps;
    settings.ncTimestamps = ncTimestamps;
    settings.dmTimestamps = dmTimestamps;
    settings.timeStampFormat = timeStampFormat;
    settings.dmColor = dmColor;
    settings.ncColor = ncColor;
    settings.dmWidthExtension = dmWidthExtension;
    settings.dmHeightExtension = dmHeightExtension;
    settings.resizeNexusChat = resizeNexusChat;
    settings.reformatBottomBar = reformatBottomBar;
    settings.loadBalancerFromLeft = loadBalancerFromLeft;
    settings.xpBarWidth = xpBarWidth;
    settings.xpBarFromRight = xpBarFromRight;
    settings.gcLoadMediaButton = gcLoadMediaButton;
    settings.gcAutoLoadMedia = gcAutoLoadMedia;
    settings.gifSearch = gifSearch;
    settings.gifSearchHeight = gifSearchHeight;
    settings.gifSendOnClick = gifSendOnClick;
    settings.gcMaxMessages = gcMaxMessages;
    settings.ncMaxMessages = ncMaxMessages;
    settings.fileUploadToLitterbox = fileUploadToLitterbox;
    localStorage.setItem("chatPlus", JSON.stringify(settings));
}

// apply styles
function applyStyles() {
    $("#chatPlusStyle").remove();
    const saveData2 = validateLocalStorage("highlightFriendsSettings");
    let selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
    let friendColor = saveData2.smColorFriendColor ?? "#80ff80";
    //let blockedColor = saveData2.smColorBlockedColor ?? "#ff8080";
    let customColors = saveData2.customColors ?? [];
    customColorMap = {};
    customColors.forEach((item, index) => {
        for (let player of item.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
    let css = /*css*/ `
        #smChatPlusSettings span, #smChatPlusSettings .customCheckbox {
            vertical-align: middle;
        }
        #smChatPlusSettings input.form-control {
            height: initial;
            color: black;
            display: inline-block;
            padding: 2px 4px;
        }
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
        #chatContainer {
            width: ${reformatBottomBar ? "calc(100% - 85px - " + xpBarFromRight + "px - " + xpBarWidth + "px)" : "calc(50% - 275px)"};
            height: ${300 + dmHeightExtension}px;
        }
        #activeChatScrollContainer {
            margin-top: ${255 + dmHeightExtension}px;
        }
        #xpOuterContainer {
            width: ${reformatBottomBar ? xpBarWidth + "px" : "240px"};
            margin: ${reformatBottomBar ? 0 : "auto"};
            left: ${reformatBottomBar ? "auto" : 0};
            right: ${reformatBottomBar ? xpBarFromRight + "px" : 0};
        }
        #xpBarOuter {
            width: ${reformatBottomBar ? xpBarWidth + "px" : "240px"};
        }
        #currencyContainer {
            left: ${reformatBottomBar ? xpBarWidth + "px" : "240px"};
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
        .gcInputContainer .textAreaContainer {
            width: ${gifSearch ? "calc(100% - 145px)" : "calc(100% - 120px)"};
        }
        .gcLoadMediaContainer {
            margin: 5px 0 3px 0;
        }
        button.gcLoadMediaButton {
            background: #6D6D6D;
            border: none;
            color: #d9d9d9;
            display: block;
            margin: auto;
            padding: 3px 6px;
        }
        button.gcLoadMediaButton:hover {
            color: #d9d9d9;
            opacity: .7;
        }
        img.gcLoadedImage {
            display: block;
            margin: auto;
            max-width: 70%;
            max-height: 200px;
        }
        audio.gcLoadedAudio {
            display: block;
            margin: auto;
            width: 80%;
            height: 35px;
        }
        video.gcLoadedVideo {
            display: block;
            margin: auto;
            max-width: 70%;
            max-height: 200px;
        }
        #gcEmojiPickerOuterContainer {
            right: ${gifSearch ? "111px" : "86px"};
        }
        #gcGifSearchOuterContainer {
            position: absolute;
            top: 35px;
            right: ${gifSearch ? "111px" : "86px"};
            width: 24px;
            height: 29px;
        }
        #gcGifSearchButton > i {
            font-size: 25px;
            color: #1b1b1b;
        }
        #gcGifContainer {
            width: 100%;
            height: ${gifSearchHeight}px;
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
            height: ${gifSearchHeight - 27}px;
            padding: 2px 0;
            position: absolute;
        }
        img.tenorGif {
            height: 70px;
            margin: 2px;
            border-radius: 5px;
            cursor: pointer;
        }
        button.gcCloseMedia {
            background: #6D6D6D;
            border: none;
            color: #d9d9d9;
            width: 25px;
            height: 25px;
            padding: 0;
            position: absolute;
            top: 0;
            right: 0;
        }
        button.gcCloseMedia:hover {
            color: #d9d9d9;
            opacity: .7;
        }
    `;
    if (reformatBottomBar) css += `
        #loadBalanceStatusContainer {
            left: ${loadBalancerFromLeft}px;
        }
    `;
    if (dmColor) {
        css += `
            .dmUsername.self {
                color: ${selfColor};
            }
            .dmUsername.friend {
                color: ${friendColor};
            }
        `;
        if (showCustomColors) {
            customColors.forEach((item, index) => {
                css += `
                    .dmUsername.customColor${index} {
                        color: ${item.color};
                    }
                `;
            });
        }
    }
    if (ncColor) {
        css += `
            .nexusCoopChatName.self {
                color: ${selfColor};
            }
            .nexusCoopChatName.friend {
                color: ${friendColor};
            }
        `;
        if (showCustomColors) {
            customColors.forEach((item, index) => {
                css += `
                    .nexusCoopChatName.customColor${index} {
                        color: ${item.color};
                    }
                `;
            });
        }
    }
    let style = document.createElement("style");
    style.id = "chatPlusStyle";
    style.textContent = css.trim();
    document.head.appendChild(style);
}
