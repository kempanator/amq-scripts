// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.41
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
- emoji answer by nyamu
- extra emotes by mintydude

New chat/message features:
1. Add timestamps to chat, dms, and nexus
2. Add color to usernames in dms and nexus
3. Adjustable dm width and height
4. Move level, ticket, and note count to the right
5. Bug fix for new dms not autoscrolling
6. Load images/audio/video directly in chat
7. Add a gif search window in chat using tenor
8. Drag & drop or copy & paste file into chat/dm to automatically upload to litterbox
9. Emoji shortcode convert in answer box and room title
10. More emojis
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("chatPlus");
const tenorApiKey = "LIVDSRZULELA";
const litterboxUrl = "https://litterbox.catbox.moe/resources/internals/api.php";
const joypixelsUrl = "https://cdn.jsdelivr.net/npm/emoji-toolkit@latest/emoji.json";
const skinModifiers = [0x1F3FB, 0x1F3FC, 0x1F3FD, 0x1F3FE, 0x1F3FF];
const hairModifiers = [0x1F9B0, 0x1F9B1, 0x1F9B2, 0x1F9B3];
const genderModifiers = [0x2642, 0x2640];
const imageUrlRegex = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|tiff)$/i;
const audioUrlRegex = /^https?:\/\/\S+\.(?:mp3|ogg|m4a|flac|wav)$/i;
const videoUrlRegex = /^https?:\/\/\S+\.(?:webm|mp4|mkv|avi|mov)$/i;
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
let convertShortcodes = saveData.convertShortcodes ?? true;
let fetchEmojiList = saveData.fetchEmojiList ?? true;
let $gcInput;
let $tenorGifContainer;
let tenorQuery;
let tenorPosition = 0;
let imagesPerRequest = 20;
let litterboxUploadTime = "12h";
let showCustomColors = true;
let customColorMap = {};

applyStyles();

// setup
function setup() {
    // build settings
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
                        <select id="chatPlusAutoLoadMediaSelect" class="form-control" style="display: inline-block; width: 108px; height: auto; padding: 2px">
                            <option value="never">Never</option>
                            <option value="friends">Friends</option>
                            <option value="all">All</option>
                        </select>
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
                <div style="padding-top: 10px">
                    <span><b>More Emojis</b></span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusMoreEmojis">
                        <label for="chatPlusMoreEmojis"><i class="fa fa-check" aria-hidden="true"></i></label>
                    </div>
                    <span style="margin-left: 50px"><b>Convert Shortcodes</b></span>
                    <div class="customCheckbox" style="vertical-align: middle">
                        <input type="checkbox" id="chatPlusConvertShortcodes">
                        <label for="chatPlusConvertShortcodes"><i class="fa fa-check" aria-hidden="true"></i></label>
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

    $gcInput = $("#gcInput");
    $tenorGifContainer = $("#tenorGifContainer");

    $gcInput.popover({
        container: "#gcChatContent",
        placement: "top",
        trigger: "manual",
        content: ""
    });
    $("#chatPlusGCTimestamps").prop("checked", gcTimestamps).on("click", () => {
        gcTimestamps = !gcTimestamps;
        saveSettings();
    });
    $("#chatPlusNCTimestamps").prop("checked", ncTimestamps).on("click", () => {
        ncTimestamps = !ncTimestamps;
        saveSettings();
    });
    $("#chatPlusDMTimestamps").prop("checked", dmTimestamps).on("click", () => {
        dmTimestamps = !dmTimestamps;
        saveSettings();
    });
    $("#chatPlusTimestampFormatSelect").val(timeStampFormat).on("change", function () {
        timeStampFormat = this.value;
        saveSettings();
    });
    $("#chatPlusNCColor").prop("checked", ncColor).on("click", () => {
        ncColor = !ncColor;
        applyStyles();
        saveSettings();
    });
    $("#chatPlusDMColor").prop("checked", dmColor).on("click", () => {
        dmColor = !dmColor;
        applyStyles();
        saveSettings();
    });
    $("#chatPlusReformatBottomBar").prop("checked", reformatBottomBar).on("click", () => {
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
    $("#chatPlusLoadBalancerPositionInput").val(loadBalancerFromLeft).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number >= 0) {
            loadBalancerFromLeft = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusXPBarWidth").val(xpBarWidth).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number >= 0) {
            xpBarWidth = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusXPBarFromRight").val(xpBarFromRight).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number >= 0) {
            xpBarFromRight = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusDMWidthExtension").val(dmWidthExtension).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number >= 0) {
            dmWidthExtension = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusDMHeightExtension").val(dmHeightExtension).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number >= 0) {
            dmHeightExtension = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusResizeNexusChat").prop("checked", resizeNexusChat).on("click", () => {
        resizeNexusChat = !resizeNexusChat;
        if (resizeNexusChat) {
            $("#nexusCoopMainContainer").css({
                "resize": "both",
                "overflow": "hidden",
                "min-width": "0",
                "max-width": "none"
            });
        }
        else {
            $("#nexusCoopMainContainer").removeAttr("style");
        }
        saveSettings();
    });
    $("#chatPlusGCMaxMessages").val(gcMaxMessages).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number > 0) {
            gcMaxMessages = number;
            gameChat.MAX_CHAT_MESSAGES = number;
            saveSettings();
        }
    });
    $("#chatPlusNCMaxMessages").val(ncMaxMessages).on("blur", function () {
        const number = parseInt(this.value);
        if (Number.isInteger(number) && number > 0) {
            ncMaxMessages = number;
            nexusCoopChat.MAX_CHAT_MESSAGES = number;
            saveSettings();
        }
    });
    $("#chatPlusLoadMedia").prop("checked", gcLoadMediaButton).on("click", () => {
        gcLoadMediaButton = !gcLoadMediaButton;
        $("#chatPlusAutoLoadMediaContainer").toggleClass("disabled", !gcLoadMediaButton);
        saveSettings();
    });
    $("#chatPlusAutoLoadMediaSelect").val(gcAutoLoadMedia).on("change", function () {
        gcAutoLoadMedia = this.value;
        saveSettings();
    });
    $("#chatPlusGifSearch").prop("checked", gifSearch).on("click", () => {
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
    $("#chatPlusGifSearchHeight").val(gifSearchHeight).on("blur", function () {
        const number = parseInt(this.value);
        if (!isNaN(number) && number >= 0) {
            gifSearchHeight = number;
            applyStyles();
            saveSettings();
        }
    });
    $("#chatPlusGifSendOnClick").prop("checked", gifSendOnClick).on("click", () => {
        gifSendOnClick = !gifSendOnClick;
        saveSettings();
    });
    $("#gcGifSearchButton").on("click", () => {
        if ($("#gcGifContainer").is(":visible")) {
            $("#gcGifContainer").hide();
        }
        else {
            $("#gcGifContainer").show();
            $("#tenorSearchInput").val("").focus();
        }
    });
    $("#chatPlusUploadToLitterbox").prop("checked", fileUploadToLitterbox).on("click", () => {
        fileUploadToLitterbox = !fileUploadToLitterbox;
        saveSettings();
    });
    $("#chatPlusMoreEmojis").prop("checked", fetchEmojiList).on("click", () => {
        fetchEmojiList = !fetchEmojiList;
        saveSettings();
    });
    $("#chatPlusConvertShortcodes").prop("checked", convertShortcodes).on("click", () => {
        convertShortcodes = !convertShortcodes;
        saveSettings();
    });
    $tenorGifContainer.on("scroll", () => {
        const el = $tenorGifContainer[0];
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight;
        if (atBottom) {
            fetchTenorPage(tenorQuery, tenorPosition);
            tenorPosition += imagesPerRequest;
        }
    });
    $("#tenorSearchInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            tenorQuery = event.target.value;
            tenorPosition = imagesPerRequest;
            fetchTenorPage(tenorQuery, 0, true);
        }
    });
    $gcInput
        .on("dragenter", () => {
            if (fileUploadToLitterbox) {
                $gcInput.popover("show").data("bs.popover").options.content = "Upload to litterbox";
            }
        })
        .on("dragleave", () => {
            if (fileUploadToLitterbox) {
                $gcInput.popover("hide");
            }
        })
        .on("drop", (event) => {
            gcUploadEvent(event, $gcInput)
        })
        .on("paste", (event) => {
            gcUploadEvent(event, $gcInput)
        })

    gameChat.MAX_CHAT_MESSAGES = gcMaxMessages;
    nexusCoopChat.MAX_CHAT_MESSAGES = ncMaxMessages;
    $("#tenorGifContainer").perfectScrollbar();
    if (!reformatBottomBar) $("#chatPlusReformatBottomBarContainer, #chatPlusLoadBalancerContainer").addClass("disabled");
    if (!gcLoadMediaButton) $("#chatPlusAutoLoadMediaContainer").addClass("disabled");
    if (!gifSearch) $("#chatPlusGifSearchContainer").addClass("disabled");
    if (resizeNexusChat) $("#nexusCoopMainContainer").css({ "resize": "both", "overflow": "hidden", "min-width": "0", "max-width": "none" });

    // watch game chat
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (!mutation.addedNodes.length) continue;
            for (const node of mutation.addedNodes) {
                const $node = $(node);
                const atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
                if (gcTimestamps) {
                    if ($node.is(".gcTimestamp, .ps__scrollbar-y-rail, .ps__scrollbar-x-rail")) continue;
                    const $timestamp = $("<span>", { class: "gcTimestamp", text: getTimestamp() });
                    if ($node.find(".gcTeamMessageIcon").length) {
                        $node.find(".gcTeamMessageIcon").after($timestamp);
                    }
                    else {
                        $node.prepend($timestamp);
                    }
                }
                if (gcLoadMediaButton) {
                    const urls = extractUrls($node.find(".gcMessage").text());
                    if (urls.length > 0) {
                        const name = $node.find(".gcUserName").text();
                        const canAutoLoad = gcAutoLoadMedia === "all" || (gcAutoLoadMedia === "friends" && (name === selfName || socialTab.isFriend(name)));
                        if (imageUrlRegex.test(urls[0])) {
                            createMediaElement($node, "img", urls[0], canAutoLoad);
                        }
                        else if (audioUrlRegex.test(urls[0])) {
                            createMediaElement($node, "audio", urls[0], canAutoLoad);
                        }
                        else if (videoUrlRegex.test(urls[0])) {
                            createMediaElement($node, "video", urls[0], canAutoLoad);
                        }
                    }
                }
                if (atBottom) {
                    gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
                }
            }
        }
    }).observe(document.querySelector("#gcMessageContainer"), { childList: true, subtree: false });

    // watch nexus chat
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (!mutation.addedNodes.length) continue;
            for (const node of mutation.addedNodes) {
                const $node = $(node);
                const atBottom = nexusCoopChat.$chatMessageContainer.scrollTop() + nexusCoopChat.$chatMessageContainer.innerHeight() >= nexusCoopChat.$chatMessageContainer[0].scrollHeight - 100;
                if ($node.is(".ncTimestamp, .ps__scrollbar-y-rail, .ps__scrollbar-x-rail")) continue;
                if (ncTimestamps) {
                    const $timestamp = $("<span>", { class: "ncTimestamp", text: getTimestamp() });
                    if (!$node.find(".nexusCoopChatName").length) $timestamp.css("margin-right", "7px");
                    $node.prepend($timestamp);
                }
                if (ncColor) {
                    const name = $node.find(".nexusCoopChatName").text().slice(0, -1);
                    if (name === selfName) $node.find(".nexusCoopChatName").addClass("self");
                    else if (socialTab.isFriend(name)) $node.find(".nexusCoopChatName").addClass("friend");
                    if (customColorMap.hasOwnProperty(name.toLowerCase())) $node.find(".nexusCoopChatName").addClass("customColor" + customColorMap[name.toLowerCase()]);
                }
                if (atBottom) {
                    nexusCoopChat.$chatMessageContainer.scrollTop(nexusCoopChat.$chatMessageContainer.prop("scrollHeight"));
                }
            }
        }
    }).observe(document.querySelector("#nexusCoopChatContainerInner"), { childList: true, subtree: false });

    // watch dms
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (!mutation.addedNodes.length) continue;
            for (const node of mutation.addedNodes) {
                const $node = $(node);
                if ($node.hasClass("chatBox")) {
                    $node.find("textarea")
                        .on("drop", (event) => { dmUploadEvent(event, $node) })
                        .on("paste", (event) => { dmUploadEvent(event, $node) });
                }
            }
        }
    }).observe(document.querySelector("#activeChatScrollContainer"), { childList: true, subtree: false });

    // create new class for emoji selector on answer input
    class AnswerBoxEmoteWrapper {
        constructor($input, inputIdentifer, customClassName = "") {
            this.$input = $input;
            this.items = [];
            this.counter = 0;
            this.displayed = false;
            this.currentWord = null;
            $.contextMenu({
                selector: inputIdentifer,
                trigger: "none",
                className: customClassName,
                position: (opt) => {
                    const { left, top } = this.$input.offset();
                    opt.$menu.css({ width: 280, top: top - 10, left: left, transform: "translateY(-100%)" });
                },
                build: () => {
                    const itemMap = {};
                    this.items.forEach(({ name, src, srcset }) => {
                        const $img = $("<img>", { class: "amqEmoji", sizes: "30px" });
                        if (srcset) $img.attr("srcset", srcset);
                        $img.attr("src", src);
                        itemMap[name] = {
                            name: name,
                            className: "context-menu-item emoteSelectorItem",
                            icon: (opt, $itemElement) => {
                                $itemElement.prepend($img);
                            },
                            callback: () => {
                                const text = this.$input.val();
                                const targetIndex = $input[0].selectionStart;
                                const prevSpaceIndex = text.lastIndexOf(" ", targetIndex - 1);
                                const prevEmojiIndex = text.lastIndexOf(":", targetIndex - 1);
                                const prevIndex = prevSpaceIndex > prevEmojiIndex ? prevSpaceIndex + 1 : prevEmojiIndex;
                                const nextSpaceIndex = text.indexOf(" ", targetIndex);
                                const begin = prevIndex < 0 ? 0 : prevIndex;
                                const end = nextSpaceIndex < 0 ? text.length : nextSpaceIndex;
                                let newText = text.slice(0, begin) + translateShortcodeToUnicode(name).text + text.slice(end);
                                const textMaxLength = this.$input.attr("maxlength");
                                if (textMaxLength && newText.length > parseInt(textMaxLength)) {
                                    newText = newText.slice(0, parseInt(textMaxLength));
                                }
                                this.$input.val(newText);
                                const newCursorPosition = begin + name.length;
                                this.$input[0].selectionEnd = newCursorPosition;
                            },
                        };
                    });
                    return { items: itemMap };
                },
                events: {
                    show: () => {
                        this.displayed = true;
                        setTimeout(() => {
                            $(document).off("keydown.contextMenu").on("keydown.contextMenu", AnswerBoxEmoteWrapper.prototype.CUSTOM_KEY_HANDLER.bind(this));
                        }, 1);
                    },
                    hide: () => {
                        this.displayed = false;
                    },
                },
                animation: { duration: 0, show: "slideDown", hide: "slideUp" },
            });
        }
        handleKeypress() {
            if (options.disableEmojis) return;
            const word = emoteSelector.getCurrentWord(this.$input);
            let entries = [];
            if (emoteSelector.EMOJI_REGEX.test(word)) {
                entries = emoteSelector.getEmojiMatches(word).map((shortcode) => {
                    const text = translateShortcodeToUnicode(shortcode).text;
                    const tweSrc = $(twemoji.parse(text)).attr("src");
                    return { name: shortcode, src: tweSrc, srcset: null };
                });
            }
            this.items = entries.slice(0, 10);
            this.counter++;
            if (entries.length) {
                if (this.currentWord !== word) {
                    this.display();
                }
            }
            else {
                this.hide();
            }
            this.currentWord = word;
        }
        display() {
            if (this.displayed) {
                this.$input.contextMenu("hide");
                this.$input.contextMenu();
            }
            else {
                this.$input.contextMenu();
                this.displayed = true;
            }
        }
        hide() {
            if (this.displayed) {
                this.$input.contextMenu("hide");
            }
        }
    }

    // create new custom key handler for AnswerBoxEmoteWrapper, must not activate when anime dropdown is visible
    const oldCustomKeyHandler = EmoteSelectorInputWrapper.prototype.CUSTOM_KEY_HANDLER;
    AnswerBoxEmoteWrapper.prototype.CUSTOM_KEY_HANDLER = function () {
        if (quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance.ul.getAttribute("hidden") === null) return;
        oldCustomKeyHandler.apply(this, arguments);
    };

    // add joypixels emojis list to the game
    if (fetchEmojiList) {
        fetch(joypixelsUrl)
            .then(response => response.json())
            .then(populateEmojiMaps)
            .catch(err => console.error("AMQ Emoji Convert: failed to load JoyPixels list ", err));
    }

    // auto convert shortcodes
    const $qpAnswerInput = $("#qpAnswerInput");
    $qpAnswerInput.on("input", convertText);
    $("#mhRoomNameInput").on("input", convertText);
    $("#hostCustomQuizRoomName").on("input", convertText);

    // setup emoji selector on answer input
    const answerEmoteSelector = new AnswerBoxEmoteWrapper($qpAnswerInput, "#qpAnswerInput");
    $qpAnswerInput.on("keyup", () => { answerEmoteSelector.handleKeypress() });

    AMQ_addScriptData({
        name: "Chat Plus",
        author: "kempanator",
        version: GM_info.script.version,
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
                <li>9. Emoji shortcode convert in answer box and room title</li>
                <li>10. More emojis</li>
            </ul>
        `
    });
}

// check if the main game chat window is scrolled to the bottom
function gcCheckAtBottom(atBottom) {
    if (atBottom) {
        gameChat.$chatMessageContainer.scrollTop(gameChat.$chatMessageContainer.prop("scrollHeight"));
    }
}

// fetch gifs from tenor
function fetchTenorPage(query, pos = 0, clearExisting = false) {
    if (clearExisting) {
        $tenorGifContainer.find(".tenorGif").remove();
    }
    const url =
        "https://api.tenor.com/v1/search" +
        `?q=${encodeURIComponent(query)}` +
        `&key=${tenorApiKey}` +
        `&limit=${imagesPerRequest}` +
        `&pos=${pos}`;

    fetch(url).then(res => res.json()).then(data => {
        for (const gif of data.results) {
            appendThumbnail(gif.media[0].gif.url);
        }
    });
}

// add tenor gif to container
function appendThumbnail(url) {
    $("<img>", { class: "tenorGif", loading: "lazy", src: url })
        .on("click", () => {
            if (gifSendOnClick) {
                $("#gcGifContainer").hide();
                socket.sendCommand({
                    type: "lobby",
                    command: "game chat message",
                    data: {
                        msg: url,
                        teamMessage: gameChat.teamChatSwitch.on
                    }
                });
            } else {
                $gcInput.val((index, value) => value + url);
            }
        })
        .appendTo($tenorGifContainer);
}

// create load button or img/audio/video element in chat
function createMediaElement($node, type, src, autoLoad) {
    const atBottom = gameChat.$chatMessageContainer.scrollTop() + gameChat.$chatMessageContainer.innerHeight() >= gameChat.$chatMessageContainer[0].scrollHeight - 100;
    $node.find(".gcLoadMediaContainer").remove();
    const $container = $("<div>", { class: "gcLoadMediaContainer" });
    if (type === "img") {
        if (autoLoad) {
            const $img = $("<img>", { class: "gcLoadedImage", src: src })
                .on("load", () => gcCheckAtBottom(atBottom));
            const $closeButton = $("<button>", { class: "btn gcCloseMedia" })
                .append(`<i class="fa fa-close" aria-hidden="true"></i>`)
                .on("click", () => createMediaElement($node, type, src, false))
                .hide();
            $container.append($img, $closeButton);
            $container.hover(() => $closeButton.show(), () => $closeButton.hide());
        }
        else {
            const $loadButton = $("<button>", { class: "btn gcLoadMediaButton", text: "Load Image" })
                .on("click", () => createMediaElement($node, type, src, true));
            $container.append($loadButton);
            gcCheckAtBottom(atBottom);
        }
    }
    else if (type === "audio") {
        if (autoLoad) {
            const $audio = $("<audio>", { class: "gcLoadedAudio", controls: true, src: src });
            const $closeButton = $("<button>", { class: "btn gcCloseMedia" })
                .append(`<i class="fa fa-close" aria-hidden="true"></i>`)
                .on("click", () => createMediaElement($node, type, src, false))
                .hide();
            $container.append($audio, $closeButton);
            $container.hover(() => $closeButton.show(), () => $closeButton.hide());
            gcCheckAtBottom(atBottom);
        }
        else {
            const $loadButton = $("<button>", { class: "btn gcLoadMediaButton", text: "Load Audio" })
                .on("click", () => createMediaElement($node, type, src, true));
            $container.append($loadButton);
            gcCheckAtBottom(atBottom);
        }
    }
    else if (type === "video") {
        if (autoLoad) {
            const $video = $("<video>", { class: "gcLoadedVideo", controls: true, src: src })
                .on("canplay", () => gcCheckAtBottom(atBottom));
            const $closeButton = $("<button>", { class: "btn gcCloseMedia" })
                .append(`<i class="fa fa-close" aria-hidden="true"></i>`)
                .on("click", () => createMediaElement($node, type, src, false))
                .hide();
            $container.append($video, $closeButton);
            $container.hover(() => $closeButton.show(), () => $closeButton.hide());
        }
        else {
            const $loadButton = $("<button>", { class: "btn gcLoadMediaButton", text: "Load Video" })
                .on("click", () => createMediaElement($node, type, src, true));
            $container.append($loadButton);
            gcCheckAtBottom(atBottom);
        }
    }
    $node.append($container);
}

// return form data for litterbox
function litterboxFormData(file) {
    const formData = new FormData();
    formData.append("fileToUpload", file);
    formData.append("reqtype", "fileupload");
    formData.append("time", litterboxUploadTime);
    return formData;
}

// upload file to litterbox on event in game chat
function gcUploadEvent(event, $node) {
    if (!fileUploadToLitterbox) return;
    $node.popover("hide");
    const file = event.originalEvent.clipboardData?.files?.[0] ?? event.originalEvent.dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    $node.data("bs.popover").options.content = "Uploading to litterbox...";
    $node.popover("show");
    fetch(litterboxUrl, { method: "POST", body: litterboxFormData(file) })
        .then(res => res.text())
        .then(data => {
            $node.popover("hide");
            $node.val((index, value) => value + data);
        })
        .catch(res => {
            $node.popover("hide");
            gameChat.systemMessage("Error: litterbox upload failed");
            console.log(res);
        });
}

// upload file to litterbox on event in dm
function dmUploadEvent(event, $node) {
    if (!fileUploadToLitterbox) return;
    const file = event.originalEvent.clipboardData?.files?.[0] ?? event.originalEvent.dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    fetch(litterboxUrl, { method: "POST", body: litterboxFormData(file) })
        .then(res => res.text())
        .then(data => {
            $node.find("textarea").val((index, value) => value + data);
        })
        .catch(res => {
            console.log(res);
        });
}

// get formatted timestamp
function getTimestamp() {
    const date = new Date();
    if (timeStampFormat === "0") {
        return date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0);
    }
    else if (timeStampFormat === "1") {
        return date.getHours().toString().padStart(2, 0) + ":" + date.getMinutes().toString().padStart(2, 0) + ":" + date.getSeconds().toString().padStart(2, 0);
    }
}

// convert any shortcodes present in the field to unicode as the user types
function convertText(event) {
    if (!convertShortcodes) return;
    if (!event.target.value.includes(":")) return;
    setTimeout(() => {
        event.target.value = translateShortcodeToUnicode(event.target.value).text;
    }, 0);
}

// used to remove skin tone variants in emojis
function hasSkinTone(cps) {
    return cps.some(cp => skinModifiers.includes(cp));
}

// used to remove hair variants in emojis
function hasHair(cps) {
    return cps.some(cp => hairModifiers.includes(cp));
}

// used to remove gendered variants in emojis
function hasGender(cps) {
    if (!cps.includes(0x200D)) return false; //must have zero width joiner
    return cps.some(cp => genderModifiers.includes(cp));
}

// merge the JoyPixels catalogue into the global shortcode maps
function populateEmojiMaps(catalogue) {
    for (const data of Object.values(catalogue)) {
        const codePoints = data.code_points.fully_qualified.split("-").map(cp => parseInt(cp, 16));
        if (!hasSkinTone(codePoints) && !hasHair(codePoints) && !hasGender(codePoints)) {
            /*const names = [data.shortname].concat(data.shortname_alternates || []);
            for (const name of names) {
                if (!EMOJI_SHORTCODE_MAP.hasOwnProperty(name)) {
                    EMOJI_SHORTCODE_MAP[name] = codePoints;
                    EMOJI_SHORTCODE_LIST.push(name);
                }
            };*/
            if (!EMOJI_SHORTCODE_MAP.hasOwnProperty(data.shortname)) {
                EMOJI_SHORTCODE_MAP[data.shortname] = codePoints;
                EMOJI_SHORTCODE_LIST.push(data.shortname);
            }
            const emoji = String.fromCodePoint(...codePoints);
            if (!EMOJI_TO_NAME_MAP.hasOwnProperty(emoji)) {
                EMOJI_TO_NAME_MAP[emoji] = data.shortname;
            }
        }
    }
}

// override writeMessage function to inject timestamp and username color
ChatBox.prototype.writeMessage = function (sender, msg, emojis, allowHtml) {
    msg = passChatMessage(msg, emojis, allowHtml);
    const timestamp = getTimestamp();
    const atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight - 20;
    let dmUsernameClass = "dmUsername";
    if (sender === selfName) {
        dmUsernameClass += " self";
    }
    else if (socialTab.isFriend(sender)) {
        dmUsernameClass += " friend";
    }
    if (customColorMap.hasOwnProperty(sender.toLowerCase())) {
        dmUsernameClass += " customColor" + customColorMap[sender.toLowerCase()];
    }
    const newDMFormat = dmTimestamps
        ? `\n\t<li>\n\t\t<span class="dmTimestamp">${timestamp}</span> <span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`
        : `\n\t<li>\n\t\t<span class="${dmUsernameClass}">${sender}:</span> ${msg}\n\t</li>\n`;
    this.$CHAT_CONTENT.append(newDMFormat);
    if (atBottom) {
        this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    }
    this.$CHAT_CONTENT.perfectScrollbar("update");
};

// override updateLayout function to account for width extension
ChatBar.prototype.updateLayout = function () {
    this._$ACTIVE_CHAT_SCROLL_CONTAINER.width(this.activeChats.length * (165 + dmWidthExtension));
    this.activeChatContainerDom.perfectScrollbar("update");
    this.toggleIndicators();
    this.closeOutsideChats();
};

// override getInsideOffsets function to account for width extension
ChatBar.prototype.getInsideOffsets = function () {
    const containerWidth = this.activeChatContainerDom.innerWidth();
    const insideLeftOffset = - this._$ACTIVE_CHAT_SCROLL_CONTAINER.position().left;
    const insideRightOffset = insideLeftOffset + containerWidth - (165 + dmWidthExtension);
    return { right: insideRightOffset, left: insideLeftOffset };
};

// override toggleIndicators function to account for width extension
ChatBar.prototype.toggleIndicators = function () {
    let offsets = this.getInsideOffsets();
    offsets.left -= (165 + dmWidthExtension) / 2;
    offsets.right += (165 + dmWidthExtension) / 2;
    let activeOutsideLeft = false;
    let activeOutsideRight = false;
    this.activeChats.forEach(chat => {
        if (chat.object.update) {
            const position = chat.object.getXOffset();
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
ChatBox.prototype.handleAlert = function (msg, callback) {
    const atBottom = this.$CHAT_CONTENT.scrollTop() + this.$CHAT_CONTENT.innerHeight() >= this.$CHAT_CONTENT[0].scrollHeight;
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
    const headerHeight = this.container.find(".header").outerHeight(true);
    this.$CHAT_CONTENT.css("height", 132 + dmHeightExtension - headerHeight);
    if (atBottom) this.$CHAT_CONTENT.scrollTop(this.$CHAT_CONTENT.prop("scrollHeight"));
    this.$CHAT_CONTENT.perfectScrollbar("update");
    this.newUpdate();
};

// override resetDrag function to remove custom width and height of nexus chat
const oldResetDrag = nexusCoopChat.resetDrag;
nexusCoopChat.resetDrag = function () {
    oldResetDrag.apply(this, arguments);
    if (resizeNexusChat) {
        $("#nexusCoopMainContainer").removeAttr("style").css({ "resize": "both", "overflow": "hidden", "min-width": "0", "max-width": "none" });
    }
};

// validate json data in local storage
function validateLocalStorage(item) {
    try {
        const json = JSON.parse(localStorage.getItem(item));
        if (!json || typeof json !== "object") return {};
        return json;
    }
    catch {
        return {};
    }
}

// save settings
function saveSettings() {
    localStorage.setItem("chatPlus", JSON.stringify({
        gcTimestamps,
        ncTimestamps,
        dmTimestamps,
        timeStampFormat,
        dmColor,
        ncColor,
        dmWidthExtension,
        dmHeightExtension,
        resizeNexusChat,
        reformatBottomBar,
        loadBalancerFromLeft,
        xpBarWidth,
        xpBarFromRight,
        gcLoadMediaButton,
        gcAutoLoadMedia,
        gifSearch,
        gifSearchHeight,
        gifSendOnClick,
        gcMaxMessages,
        ncMaxMessages,
        fileUploadToLitterbox,
        convertShortcodes,
        fetchEmojiList
    }));
}

// apply styles
function applyStyles() {
    const saveData2 = validateLocalStorage("highlightFriendsSettings");
    const selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
    const friendColor = saveData2.smColorFriendColor ?? "#80ff80";
    //const blockedColor = saveData2.smColorBlockedColor ?? "#ff8080";
    const customColors = saveData2.customColors ?? [];
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
    let style = document.getElementById("chatPlusStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "chatPlusStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
