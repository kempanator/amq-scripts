// ==UserScript==
// @name         AMQ Chat Plus
// @namespace    https://github.com/kempanator
// @version      0.46
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

const tenorApiKey = "LIVDSRZULELA";
const litterboxUrl = "https://litterbox.catbox.moe/resources/internals/api.php";
const emojiCatalogueUrl = "https://cdn.jsdelivr.net/npm/emoji-toolkit@latest/emoji.json";
const skinModifiers = [0x1F3FB, 0x1F3FC, 0x1F3FD, 0x1F3FE, 0x1F3FF];
const hairModifiers = [0x1F9B0, 0x1F9B1, 0x1F9B2, 0x1F9B3];
const genderModifiers = [0x2642, 0x2640];
const imageUrlRegex = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|tiff)(?:[?#]\S*)?$/i;
const audioUrlRegex = /^https?:\/\/\S+\.(?:mp3|ogg|m4a|flac|wav)(?:[?#]\S*)?$/i;
const videoUrlRegex = /^https?:\/\/\S+\.(?:webm|mp4|mkv|avi|mov)(?:[?#]\S*)?$/i;
const gifPageSize = 20;
const litterboxUploadTime = "12h";

// Persisted preferences
let gcTimestamps;
let ncTimestamps;
let dmTimestamps;
let timestampFormat;
let ncColor;
let dmColor;
let reformatBottomBar;
let loadBalancerFromLeft;
let xpBarWidth;
let xpBarFromRight;
let dmWidthExtension;
let dmHeightExtension;
let resizeNexusChat;
let gcLoadMediaButton;
let gcAutoLoadMedia;
let gifSearch;
let gifSearchHeight;
let gifSendOnClick;
let gcMaxMessages;
let ncMaxMessages;
let fileUploadToLitterbox;
let convertShortcodes;
let fetchEmojiList;

// Chat and GIF runtime state
let $chatInput;
let $gifResults;
let gifSearchQuery;
let gifResultOffset = 0;
let customColorMap = Object.create(null);

// Initialize once AMQ finishes loading
function startScript() {
    initializeState();
    applyStyles();
    installHooks();
    const loadingScreen = document.querySelector("#loadingScreen");
    if (loadingScreen.classList.contains("hidden")) {
        setup();
        return;
    }
    const observer = new MutationObserver(() => {
        if (!loadingScreen.classList.contains("hidden")) return;
        observer.disconnect();
        setup();
    });
    observer.observe(loadingScreen, { attributes: true, attributeFilter: ["class"] });
}

// Restore preferences and create runtime state before startup
function initializeState() {
    const settings = loadSettings();
    gcTimestamps = settings.gcTimestamps;
    ncTimestamps = settings.ncTimestamps;
    dmTimestamps = settings.dmTimestamps;
    timestampFormat = settings.timestampFormat;
    ncColor = settings.ncColor;
    dmColor = settings.dmColor;
    reformatBottomBar = settings.reformatBottomBar;
    loadBalancerFromLeft = settings.loadBalancerFromLeft;
    xpBarWidth = settings.xpBarWidth;
    xpBarFromRight = settings.xpBarFromRight;
    dmWidthExtension = settings.dmWidthExtension;
    dmHeightExtension = settings.dmHeightExtension;
    resizeNexusChat = settings.resizeNexusChat;
    gcLoadMediaButton = settings.gcLoadMediaButton;
    gcAutoLoadMedia = settings.gcAutoLoadMedia;
    gifSearch = settings.gifSearch;
    gifSearchHeight = settings.gifSearchHeight;
    gifSendOnClick = settings.gifSendOnClick;
    gcMaxMessages = settings.gcMaxMessages;
    ncMaxMessages = settings.ncMaxMessages;
    fileUploadToLitterbox = settings.fileUploadToLitterbox;
    convertShortcodes = settings.convertShortcodes;
    fetchEmojiList = settings.fetchEmojiList;
}

// Install game method overrides before AMQ's initial rendering
function installHooks() {
    // Preserve AMQ's message formatting while adding timestamps and highlight classes
    ChatBox.prototype.writeMessage = function (sender, msg, emojis, allowHtml) {
        const message = passChatMessage(msg, emojis, allowHtml);
        const atBottom = isScrolledToBottom(this.$CHAT_CONTENT, 20);
        const $line = $("<li>");
        if (dmTimestamps) {
            $line.append($("<span>", { class: "cpDmTimestamp", text: getTimestamp() }), " ");
        }
        const $name = $("<span>", { class: "cpDmUsername", text: sender + ":" })
            .addClass(getPlayerColorClasses(sender));
        $line.append($name, " ", message);
        this.$CHAT_CONTENT.append($line);
        if (atBottom) scrollToBottom(this.$CHAT_CONTENT);
        this.$CHAT_CONTENT.perfectScrollbar("update");
    };

    // Override updateLayout function to account for width extension
    ChatBar.prototype.updateLayout = function () {
        this._$ACTIVE_CHAT_SCROLL_CONTAINER.width(this.activeChats.length * (165 + dmWidthExtension));
        this.activeChatContainerDom.perfectScrollbar("update");
        this.toggleIndicators();
        this.closeOutsideChats();
    };

    // Override getInsideOffsets function to account for width extension
    ChatBar.prototype.getInsideOffsets = function () {
        const containerWidth = this.activeChatContainerDom.innerWidth();
        const chatWidth = 165 + dmWidthExtension;
        const left = -this._$ACTIVE_CHAT_SCROLL_CONTAINER.position().left;
        return { right: left + containerWidth - chatWidth, left };
    };

    // Override toggleIndicators function to account for width extension
    ChatBar.prototype.toggleIndicators = function () {
        const offsets = this.getInsideOffsets();
        const halfChatWidth = (165 + dmWidthExtension) / 2;
        offsets.left -= halfChatWidth;
        offsets.right += halfChatWidth;
        let activeOutsideLeft = false;
        let activeOutsideRight = false;
        for (const chat of this.activeChats) {
            if (!chat.object.update) continue;
            const position = chat.object.getXOffset();
            if (position < offsets.left) activeOutsideLeft = true;
            else if (position > offsets.right) activeOutsideRight = true;
        }
        this.$LEFT_INDICATOR.toggleClass("runAnimation", activeOutsideLeft);
        this.$RIGHT_INDICATOR.toggleClass("runAnimation", activeOutsideRight);
    };

    // Override handleAlert function to account for height extension
    ChatBox.prototype.handleAlert = function (msg, callback) {
        const atBottom = isScrolledToBottom(this.$CHAT_CONTENT);
        this.$HEADER.text(msg);
        if (callback) {
            this.$HEADER.append(format(chatHeaderInputTemplate));
            this.container.find(".accept").click(createFriendRequestHandler.call(this, true, callback));
            this.container.find(".reject").click(createFriendRequestHandler.call(this, false, callback));
        }
        else {
            this.$HEADER.append(format(chatHeaderCloseTemplate));
            this.container.find(".accept").click(this.closeHeader.bind(this));
        }
        this.$HEADER.removeClass("hidden");
        const headerHeight = this.container.find(".header").outerHeight(true);
        this.$CHAT_CONTENT.css("height", 132 + dmHeightExtension - headerHeight);
        if (atBottom) scrollToBottom(this.$CHAT_CONTENT);
        this.$CHAT_CONTENT.perfectScrollbar("update");
        this.newUpdate();
    };

    const originalResetDrag = nexusCoopChat.resetDrag;
    nexusCoopChat.resetDrag = function () {
        originalResetDrag.apply(this, arguments);
        if (!resizeNexusChat) return;
        $("#nexusCoopMainContainer").removeAttr("style");
        enableNexusChatResize();
    };
}

// Connect settings, chat observers, uploads, and answer-input emoji completion
function setup() {
    window.addEventListener("amq:highlight-friends-changed", refreshHighlightColors);
    createGraphicsSettings();
    createGifSearch();
    bindDisplaySettings();
    bindMediaSettings();
    bindLayoutSettings();
    updateSettingsControls();
    updateSettingsAvailability();
    bindGifSearchEvents();
    bindChatUploadEvents();
    observeChatMessages();
    setupAnswerInputEmojis();
    registerScriptInfo();

    gameChat.MAX_CHAT_MESSAGES = gcMaxMessages;
    nexusCoopChat.MAX_CHAT_MESSAGES = ncMaxMessages;
    if (resizeNexusChat) enableNexusChatResize();
}

// Keep registration text apart from startup and live chat behavior
function registerScriptInfo() {
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

// Build the feature tabs inside AMQ's Graphics settings
function createGraphicsSettings() {
    $("#settingsGraphicContainer").append(/*html*/`
        <div class="row cpGraphicsSettings">
            <div id="cpSettings" class="col-xs-12">
                <h3 id="cpSettingsTitle" class="clickAble">Chat Plus <i class="fa fa-fw fa-caret-right"></i></h3>
                <div id="cpSettingsContent">
                    <div id="cpSettingsTabs" class="tabContainer">
                        <div id="cpDisplayTab" class="tab clickAble" data-tab="cpDisplay"><h5>Display</h5></div>
                        <div id="cpMediaTab" class="tab clickAble" data-tab="cpMedia"><h5>Media</h5></div>
                        <div id="cpLayoutTab" class="tab clickAble" data-tab="cpLayout"><h5>Layout</h5></div>
                        <div id="cpInfoTab" class="tab clickAble right" data-tab="cpInfo">
                            <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                        </div>
                    </div>
                    <div id="cpDisplayContainer" class="tabSection" data-tab="cpDisplay">
                        <table class="cpSettingsTable">
                            <thead><tr>
                                <th scope="col">Channel</th>
                                <th scope="col">Timestamps</th>
                                <th scope="col">Name colors</th>
                                <th scope="col">Max messages</th>
                            </tr></thead>
                            <tbody>
                                <tr>
                                    <th scope="row">Chat</th>
                                    <td>${createSettingsCheckbox("cpChatTimestampsCheckbox")}</td>
                                    <td>—</td>
                                    <td><input id="cpChatMessageLimitInput" class="form-control" type="text"></td>
                                </tr>
                                <tr>
                                    <th scope="row">Nexus</th>
                                    <td>${createSettingsCheckbox("cpNexusTimestampsCheckbox")}</td>
                                    <td>${createSettingsCheckbox("cpNexusNameColorsCheckbox")}</td>
                                    <td><input id="cpNexusMessageLimitInput" class="form-control" type="text"></td>
                                </tr>
                                <tr>
                                    <th scope="row">DM</th>
                                    <td>${createSettingsCheckbox("cpDmTimestampsCheckbox")}</td>
                                    <td>${createSettingsCheckbox("cpDmNameColorsCheckbox")}</td>
                                    <td>—</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="cpDisplayOptions">
                            <div class="cpSettingsRow">
                                <label for="cpTimestampFormatSelect">Timestamp format</label>
                                <select id="cpTimestampFormatSelect" class="form-control">
                                    <option value="HH:MM">HH:MM</option>
                                    <option value="HH:MM:SS">HH:MM:SS</option>
                                </select>
                            </div>
                            ${createSettingsCheckbox("cpMoreEmojisCheckbox", "More emojis")}
                            ${createSettingsCheckbox("cpConvertShortcodesCheckbox", "Convert shortcodes")}
                        </div>
                    </div>
                    <div id="cpMediaContainer" class="tabSection" data-tab="cpMedia">
                        <div class="cpSettingsStack">
                            <section class="cpSettingsGroup">
                                <h4>Images, audio, and video</h4>
                                <div class="cpSettingsOptions">
                                    ${createSettingsCheckbox("cpLoadMediaCheckbox", "Load media in chat")}
                                    <div id="cpAutoLoadMediaContainer" class="cpSettingsRow">
                                        <label for="cpAutoLoadMediaSelect">Auto load</label>
                                        <select id="cpAutoLoadMediaSelect" class="form-control">
                                            <option value="never">Never</option>
                                            <option value="friends">Friends</option>
                                            <option value="all">All</option>
                                        </select>
                                    </div>
                                </div>
                            </section>
                            <section class="cpSettingsGroup">
                                <h4>GIFs</h4>
                                <div class="cpSettingsOptions">
                                    ${createSettingsCheckbox("cpGifSearchCheckbox", "GIF search")}
                                    <div id="cpGifOptions" class="cpSettingsOptions">
                                        <div class="cpSettingsRow">
                                            <label for="cpGifHeightInput">Window height (px)</label>
                                            <input id="cpGifHeightInput" class="form-control" type="text">
                                        </div>
                                        ${createSettingsCheckbox("cpSendGifOnClickCheckbox", "Send on click")}
                                    </div>
                                </div>
                            </section>
                            <section class="cpSettingsGroup">
                                <h4>File Uploads</h4>
                                ${createSettingsCheckbox("cpFileUploadsCheckbox", "Upload files to Litterbox")}
                            </section>
                        </div>
                    </div>
                    <div id="cpLayoutContainer" class="tabSection" data-tab="cpLayout">
                        <div class="cpSettingsGrid">
                            <section class="cpSettingsGroup">
                                <h4>Chat windows</h4>
                                <div class="cpSettingsRow">
                                    <label for="cpDmWidthInput">Extra DM width (px)</label>
                                    <input id="cpDmWidthInput" class="form-control" type="text">
                                </div>
                                <div class="cpSettingsRow">
                                    <label for="cpDmHeightInput">Extra DM height (px)</label>
                                    <input id="cpDmHeightInput" class="form-control" type="text">
                                </div>
                                ${createSettingsCheckbox("cpResizeNexusChatCheckbox", "Resize Nexus chat")}
                            </section>
                            <section class="cpSettingsGroup">
                                <h4>XP and currency bar</h4>
                                ${createSettingsCheckbox("cpReformatBottomBarCheckbox", "Reformat XP/Currency")}
                                <div id="cpBottomBarOptions" class="cpSettingsFields">
                                    <div class="cpSettingsRow">
                                        <label for="cpXpBarWidthInput">XP bar width (px)</label>
                                        <input id="cpXpBarWidthInput" class="form-control" type="text">
                                    </div>
                                    <div class="cpSettingsRow">
                                        <label for="cpXpBarOffsetInput">Offset from right (px)</label>
                                        <input id="cpXpBarOffsetInput" class="form-control" type="text">
                                    </div>
                                </div>
                                <div id="cpLoadBalancerOptions" class="cpSettingsRow">
                                    <label for="cpLoadBalancerOffsetInput">Load balancer from left (px)</label>
                                    <input id="cpLoadBalancerOffsetInput" class="form-control" type="text">
                                </div>
                            </section>
                        </div>
                    </div>
                    <div id="cpInfoContainer" class="tabSection" data-tab="cpInfo">
                        <h4>Script Info</h4>
                        <div>Created by: kempanator</div>
                        <div>Version: ${GM_info.script.version}</div>
                        <div>
                            <a href="https://github.com/kempanator/amq-scripts/blob/main/amqChatPlus.user.js" target="_blank">Github</a>
                            <a href="https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js" target="_blank">Install</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    $("#cpSettingsContent").hide();
    $("#cpSettingsTitle").on("click", event => {
        $(event.currentTarget).find("i").toggleClass("fa-caret-down fa-caret-right");
        $("#cpSettingsContent").stop(true, true).slideToggle(150);
    });
    $("#cpSettingsTabs").on("click", ".tab[data-tab]", event => {
        switchTab(event.currentTarget.dataset.tab);
    });
    switchTab("cpDisplay");
}

// Use AMQ's checkbox markup consistently for standalone and table controls
function createSettingsCheckbox(id, label = "") {
    let caption = "";
    if (label) caption = `<label for="${id}">${label}</label>`;
    return /*html*/`
        <div class="cpSettingsCheckbox">
            <div class="customCheckbox">
                <input type="checkbox" id="${id}">
                <label for="${id}"><i class="fa fa-check" aria-hidden="true"></i></label>
            </div>
            ${caption}
        </div>
    `;
}

// Switch only this script's settings tabs and preserve the other Graphics sections
function switchTab(tabKey) {
    const $tabRoot = $("#cpSettings");
    $tabRoot.find(".tab").removeClass("selected");
    $tabRoot.find(".tabSection").hide();
    $tabRoot.find(`.tab[data-tab="${tabKey}"]`).addClass("selected");
    $tabRoot.find(`.tabSection[data-tab="${tabKey}"]`).show();
}

// Reflect persisted values without mixing initial rendering into event handlers
function updateSettingsControls() {
    $("#cpChatTimestampsCheckbox").prop("checked", gcTimestamps);
    $("#cpNexusTimestampsCheckbox").prop("checked", ncTimestamps);
    $("#cpDmTimestampsCheckbox").prop("checked", dmTimestamps);
    $("#cpTimestampFormatSelect").val(timestampFormat);
    $("#cpNexusNameColorsCheckbox").prop("checked", ncColor);
    $("#cpDmNameColorsCheckbox").prop("checked", dmColor);
    $("#cpChatMessageLimitInput").val(gcMaxMessages);
    $("#cpNexusMessageLimitInput").val(ncMaxMessages);
    $("#cpLoadMediaCheckbox").prop("checked", gcLoadMediaButton);
    $("#cpAutoLoadMediaSelect").val(gcAutoLoadMedia);
    $("#cpGifSearchCheckbox").prop("checked", gifSearch);
    $("#cpGifHeightInput").val(gifSearchHeight);
    $("#cpSendGifOnClickCheckbox").prop("checked", gifSendOnClick);
    $("#cpFileUploadsCheckbox").prop("checked", fileUploadToLitterbox);
    $("#cpMoreEmojisCheckbox").prop("checked", fetchEmojiList);
    $("#cpConvertShortcodesCheckbox").prop("checked", convertShortcodes);
    $("#cpDmWidthInput").val(dmWidthExtension);
    $("#cpDmHeightInput").val(dmHeightExtension);
    $("#cpResizeNexusChatCheckbox").prop("checked", resizeNexusChat);
    $("#cpReformatBottomBarCheckbox").prop("checked", reformatBottomBar);
    $("#cpXpBarWidthInput").val(xpBarWidth);
    $("#cpXpBarOffsetInput").val(xpBarFromRight);
    $("#cpLoadBalancerOffsetInput").val(loadBalancerFromLeft);
}

// Keep dependent controls dimmed and inactive while their feature is disabled
function updateSettingsAvailability() {
    $("#cpBottomBarOptions, #cpLoadBalancerOptions").toggleClass("disabled", !reformatBottomBar);
    $("#cpAutoLoadMediaContainer").toggleClass("disabled", !gcLoadMediaButton);
    $("#cpGifOptions").toggleClass("disabled", !gifSearch);
}

// Apply display preferences while preserving the existing positive message limits
function bindDisplaySettings() {
    $("#cpChatTimestampsCheckbox").on("click", function () {
        gcTimestamps = this.checked;
        saveSettings();
    });
    $("#cpNexusTimestampsCheckbox").on("click", function () {
        ncTimestamps = this.checked;
        saveSettings();
    });
    $("#cpDmTimestampsCheckbox").on("click", function () {
        dmTimestamps = this.checked;
        saveSettings();
    });
    $("#cpTimestampFormatSelect").on("change", function () {
        timestampFormat = this.value;
        saveSettings();
    });
    $("#cpNexusNameColorsCheckbox").on("click", function () {
        ncColor = this.checked;
        refreshHighlightColors();
        saveSettings();
    });
    $("#cpDmNameColorsCheckbox").on("click", function () {
        dmColor = this.checked;
        refreshHighlightColors();
        saveSettings();
    });
    $("#cpChatMessageLimitInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value <= 0) return;
        gcMaxMessages = value;
        gameChat.MAX_CHAT_MESSAGES = value;
        saveSettings();
    });
    $("#cpNexusMessageLimitInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value <= 0) return;
        ncMaxMessages = value;
        nexusCoopChat.MAX_CHAT_MESSAGES = value;
        saveSettings();
    });
    $("#cpMoreEmojisCheckbox").on("click", function () {
        fetchEmojiList = this.checked;
        saveSettings();
    });
    $("#cpConvertShortcodesCheckbox").on("click", function () {
        convertShortcodes = this.checked;
        saveSettings();
    });
}

// Apply media preferences and update only the controls affected by each toggle
function bindMediaSettings() {
    $("#cpLoadMediaCheckbox").on("click", function () {
        gcLoadMediaButton = this.checked;
        updateSettingsAvailability();
        saveSettings();
    });
    $("#cpAutoLoadMediaSelect").on("change", function () {
        gcAutoLoadMedia = this.value;
        saveSettings();
    });
    $("#cpGifSearchCheckbox").on("click", function () {
        gifSearch = this.checked;
        $("#cpGifButtonContainer").toggle(gifSearch);
        if (!gifSearch) $("#gcGifContainer").hide();
        updateSettingsAvailability();
        applyStyles();
        saveSettings();
    });
    $("#cpGifHeightInput").on("blur", function () {
        const value = parseInt(this.value);
        if (isNaN(value) || value < 0) return;
        gifSearchHeight = value;
        applyStyles();
        saveSettings();
    });
    $("#cpSendGifOnClickCheckbox").on("click", function () {
        gifSendOnClick = this.checked;
        saveSettings();
    });
    $("#cpFileUploadsCheckbox").on("click", function () {
        fileUploadToLitterbox = this.checked;
        saveSettings();
    });
}

// Apply window and bottom-bar dimensions after validating each numeric input
function bindLayoutSettings() {
    $("#cpLoadBalancerOffsetInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value < 0) return;
        loadBalancerFromLeft = value;
        applyStyles();
        saveSettings();
    });
    $("#cpXpBarWidthInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value < 0) return;
        xpBarWidth = value;
        applyStyles();
        saveSettings();
    });
    $("#cpXpBarOffsetInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value < 0) return;
        xpBarFromRight = value;
        applyStyles();
        saveSettings();
    });
    $("#cpDmWidthInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value < 0) return;
        dmWidthExtension = value;
        applyStyles();
        saveSettings();
    });
    $("#cpDmHeightInput").on("blur", function () {
        const value = parseInt(this.value);
        if (!Number.isInteger(value) || value < 0) return;
        dmHeightExtension = value;
        applyStyles();
        saveSettings();
    });
    $("#cpResizeNexusChatCheckbox").on("click", function () {
        resizeNexusChat = this.checked;
        if (resizeNexusChat) enableNexusChatResize();
        else $("#nexusCoopMainContainer").removeAttr("style");
        saveSettings();
    });
    $("#cpReformatBottomBarCheckbox").on("click", function () {
        reformatBottomBar = this.checked;
        updateSettingsAvailability();
        applyStyles();
        saveSettings();
    });
}

// Restore resize behavior after AMQ resets Nexus chat positioning
function enableNexusChatResize() {
    $("#nexusCoopMainContainer").css({
        "resize": "both",
        "overflow": "hidden",
        "min-width": "0",
        "max-width": "none"
    });
}

// Keep the same scroll thresholds when preserving chat position across insertions
function isScrolledToBottom($container, threshold = 0) {
    const visibleBottom = $container.scrollTop() + $container.innerHeight();
    return visibleBottom >= $container[0].scrollHeight - threshold;
}

// Follow new messages only when the user was already reading the bottom
function scrollToBottom($container) {
    $container.scrollTop($container.prop("scrollHeight"));
}

// Process newly inserted nodes without repeating observer loops for each chat
function observeAddedNodes(selector, handleNode) {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) handleNode($(node));
        }
    });
    observer.observe(document.querySelector(selector), { childList: true, subtree: false });
}

// Keep game-chat, Nexus, and DM processing separate from their DOM observers
function observeChatMessages() {
    observeAddedNodes("#gcMessageContainer", processChatMessage);
    observeAddedNodes("#nexusCoopChatContainerInner", processNexusMessage);
    observeAddedNodes("#activeChatScrollContainer", $chat => {
        if (!$chat.hasClass("chatBox")) return;
        $chat.find("textarea").on("drop paste", event => handleDirectMessageUpload(event, $chat));
    });
}

// Add timestamps and media controls while retaining the user's chat scroll position
function processChatMessage($message) {
    const atBottom = isScrolledToBottom(gameChat.$chatMessageContainer, 100);
    if (gcTimestamps) {
        if ($message.is(".cpChatTimestamp, .ps__scrollbar-y-rail, .ps__scrollbar-x-rail")) return;
        const $timestamp = $("<span>", { class: "cpChatTimestamp", text: getTimestamp() });
        const $teamIcon = $message.find(".gcTeamMessageIcon");
        if ($teamIcon.length) $teamIcon.after($timestamp);
        else $message.prepend($timestamp);
    }
    if (gcLoadMediaButton) addMessageMedia($message);
    if (atBottom) scrollToBottom(gameChat.$chatMessageContainer);
}

// Apply the Nexus-specific timestamp spacing and name highlights
function processNexusMessage($message) {
    const atBottom = isScrolledToBottom(nexusCoopChat.$chatMessageContainer, 100);
    if ($message.is(".cpNexusTimestamp, .ps__scrollbar-y-rail, .ps__scrollbar-x-rail")) return;
    const $name = $message.find(".nexusCoopChatName");
    if (ncTimestamps) {
        const $timestamp = $("<span>", { class: "cpNexusTimestamp", text: getTimestamp() });
        if (!$name.length) $timestamp.css("margin-right", "7px");
        $message.prepend($timestamp);
    }
    if (ncColor) $name.addClass(getPlayerColorClasses($name.text().slice(0, -1)));
    if (atBottom) scrollToBottom(nexusCoopChat.$chatMessageContainer);
}

// Use the same relationship and custom-group classes in Nexus and direct messages
function getPlayerColorClasses(name) {
    const classes = [];
    if (name === selfName) classes.push("self");
    else if (socialTab.isFriend(name)) classes.push("friend");
    const groupIndex = customColorMap[name.toLowerCase()];
    if (groupIndex !== undefined) classes.push("customColor" + groupIndex);
    return classes.join(" ");
}

// Mount the GIF picker and cache its frequently used input and result container
function createGifSearch() {
    $("#gcChatContent .gcInputContainer").append(/*html*/`
        <div id="cpGifButtonContainer">
            <div id="gcGifSearchButton" class="clickAble">
                <i class="fa fa-picture-o" aria-hidden="true"></i>
            </div>
        </div>
    `);
    $("#gcMessageContainer").after(/*html*/`
        <div id="gcGifContainer">
            <input id="cpGifSearchInput" type="text" placeholder="gif search...">
            <div id="cpGifResults">
                <p class="cpGifNotice">Google shut down the Tenor API on June 30, 2026.</p>
            </div>
        </div>
    `);
    $chatInput = $("#gcInput");
    $gifResults = $("#cpGifResults");
    $gifResults.perfectScrollbar();
}

// Open the GIF picker, start searches, and request the next page at the bottom
function bindGifSearchEvents() {
    $("#gcGifSearchButton").on("click", () => {
        const $picker = $("#gcGifContainer");
        if ($picker.is(":visible")) {
            $picker.hide();
            return;
        }
        $picker.show();
        $("#cpGifSearchInput").val("").focus();
    });
    $("#cpGifSearchInput").on("keypress", event => {
        if (event.key !== "Enter") return;
        gifSearchQuery = event.target.value;
        gifResultOffset = gifPageSize;
        fetchTenorPage(gifSearchQuery, 0, true);
    });
    $gifResults.on("scroll", () => {
        const container = $gifResults[0];
        const visibleBottom = container.scrollTop + container.clientHeight;
        if (visibleBottom < container.scrollHeight) return;
        fetchTenorPage(gifSearchQuery, gifResultOffset);
        gifResultOffset += gifPageSize;
    });
}

// Append a Tenor result page, clearing the existing thumbnails for new searches
async function fetchTenorPage(query, position = 0, clearExisting = false) {
    if (clearExisting) $gifResults.find(".cpGifThumbnail").remove();
    const url = "https://api.tenor.com/v1/search"
        + `?q=${encodeURIComponent(query)}`
        + `&key=${tenorApiKey}`
        + `&limit=${gifPageSize}`
        + `&pos=${position}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Tenor request failed (${response.status})`);
        const data = await response.json();
        for (const gif of data.results) appendGifThumbnail(gif.media[0].gif.url);
    }
    catch (error) {
        console.error("AMQ ChatPlus: failed to fetch Tenor gifs", error);
    }
}

// Send a selected GIF immediately or append its URL to the chat input
function appendGifThumbnail(url) {
    $("<img>", { class: "cpGifThumbnail", loading: "lazy", src: url })
        .on("click", () => {
            if (!gifSendOnClick) {
                $chatInput.val((index, value) => value + url);
                return;
            }
            $("#gcGifContainer").hide();
            socket.sendCommand({
                type: "lobby",
                command: "game chat message",
                data: { msg: url, teamMessage: gameChat.teamChatSwitch.on }
            });
        })
        .appendTo($gifResults);
}

// Inspect only the first message URL, matching the existing media-loading policy
function addMessageMedia($message) {
    const urls = extractUrls($message.find(".gcMessage").text());
    if (urls.length === 0) return;
    const url = urls[0];
    let type;
    if (imageUrlRegex.test(url)) type = "img";
    else if (audioUrlRegex.test(url)) type = "audio";
    else if (videoUrlRegex.test(url)) type = "video";
    else return;

    const sender = $message.find(".gcUserName").text();
    let autoLoad = gcAutoLoadMedia === "all";
    if (gcAutoLoadMedia === "friends") autoLoad = sender === selfName || socialTab.isFriend(sender);
    renderMessageMedia($message, type, url, autoLoad);
}

// Replace a message's media with either a load button or its native media element
function renderMessageMedia($message, type, url, loaded) {
    const atBottom = isScrolledToBottom(gameChat.$chatMessageContainer, 100);
    const label = { img: "Image", audio: "Audio", video: "Video" }[type];
    $message.find(".cpMediaContainer").remove();
    const $container = $("<div>", { class: "cpMediaContainer" });
    if (!loaded) {
        const $loadButton = $("<button>", { class: "btn cpLoadMediaButton", text: "Load " + label })
            .on("click", () => renderMessageMedia($message, type, url, true));
        $container.append($loadButton);
        restoreChatScroll(atBottom);
        $message.append($container);
        return;
    }

    const $media = $("<" + type + ">", { class: "cpLoaded" + label, src: url });
    if (type !== "img") $media.prop("controls", true);
    if (type === "img") $media.on("load", () => restoreChatScroll(atBottom));
    else if (type === "video") $media.on("canplay", () => restoreChatScroll(atBottom));
    else restoreChatScroll(atBottom);

    const $closeButton = $("<button>", { class: "btn cpCloseMediaButton" })
        .append(`<i class="fa fa-close" aria-hidden="true"></i>`)
        .on("click", () => renderMessageMedia($message, type, url, false))
        .hide();
    $container.append($media, $closeButton);
    $container.hover(() => $closeButton.show(), () => $closeButton.hide());
    $message.append($container);
}

// Retain the chat position captured before media changed its message's height
function restoreChatScroll(atBottom) {
    if (atBottom) scrollToBottom(gameChat.$chatMessageContainer);
}

// Show upload feedback only for drag events while file uploads are enabled
function bindChatUploadEvents() {
    $chatInput.popover({
        container: "#gcChatContent",
        placement: "top",
        trigger: "manual",
        content: ""
    });
    $chatInput.on("dragenter", () => {
        if (!fileUploadToLitterbox) return;
        showUploadMessage("Upload to litterbox");
    });
    $chatInput.on("dragleave", () => {
        if (fileUploadToLitterbox) $chatInput.popover("hide");
    });
    $chatInput.on("drop paste", handleChatUpload);
}

// Update the existing chat-input popover without creating another feedback element
function showUploadMessage(message) {
    $chatInput.data("bs.popover").options.content = message;
    $chatInput.popover("show");
}

// Consume only file-bearing paste and drop events, keeping normal text input intact
function getUploadFile(event) {
    const { clipboardData, dataTransfer } = event.originalEvent;
    const file = clipboardData?.files?.[0] ?? dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    return file;
}

// Share request construction and HTTP validation between chat and DM uploads
async function uploadFile(file) {
    const body = new FormData();
    body.append("fileToUpload", file);
    body.append("reqtype", "fileupload");
    body.append("time", litterboxUploadTime);
    const response = await fetch(litterboxUrl, { method: "POST", body });
    if (!response.ok) throw new Error(`Litterbox upload failed (${response.status})`);
    return response.text();
}

// Upload the first attached file with chat-specific progress and failure feedback
async function handleChatUpload(event) {
    if (!fileUploadToLitterbox) return;
    $chatInput.popover("hide");
    const file = getUploadFile(event);
    if (!file) return;
    showUploadMessage("Uploading to litterbox...");
    try {
        const url = await uploadFile(file);
        $chatInput.popover("hide");
        $chatInput.val((index, value) => value + url);
    }
    catch (error) {
        $chatInput.popover("hide");
        gameChat.systemMessage("ChatPlus Error: litterbox upload failed");
        console.log(error);
    }
}

// Append the uploaded URL to the DM that received the paste or drop event
async function handleDirectMessageUpload(event, $chat) {
    if (!fileUploadToLitterbox) return;
    const file = getUploadFile(event);
    if (!file) return;
    try {
        const url = await uploadFile(file);
        $chat.find("textarea").val((index, value) => value + url);
    }
    catch (error) {
        console.log(error);
    }
}

// Complete emoji shortcodes in the answer box without taking over anime suggestions
class AnswerInputEmoteSelector {
    constructor($input, selector) {
        this.$input = $input;
        this.items = [];
        this.displayed = false;
        this.currentWord = null;
        this.defaultKeyHandler = EmoteSelectorInputWrapper.prototype.CUSTOM_KEY_HANDLER;
        $.contextMenu({
            selector,
            trigger: "none",
            className: "",
            position: menu => {
                const { left, top } = this.$input.offset();
                menu.$menu.css({ width: 280, top: top - 10, left, transform: "translateY(-100%)" });
            },
            build: () => ({ items: this.buildMenuItems() }),
            events: {
                show: () => {
                    this.displayed = true;
                    setTimeout(() => {
                        $(document).off("keydown.contextMenu")
                            .on("keydown.contextMenu", this.handleKeydown.bind(this));
                    }, 1);
                },
                hide: () => { this.displayed = false; }
            },
            animation: { duration: 0, show: "slideDown", hide: "slideUp" }
        });
    }

    buildMenuItems() {
        const items = {};
        for (const { name, src } of this.items) {
            const $image = $("<img>", { class: "amqEmoji", sizes: "30px", src });
            items[name] = {
                name,
                className: "context-menu-item emoteSelectorItem",
                icon: (menu, $item) => { $item.prepend($image); },
                callback: () => this.insertEmoji(name)
            };
        }
        return items;
    }

    insertEmoji(shortcode) {
        const input = this.$input[0];
        const text = this.$input.val();
        const cursor = input.selectionStart;
        const previousSpace = text.lastIndexOf(" ", cursor - 1);
        const previousColon = text.lastIndexOf(":", cursor - 1);
        const wordStart = previousSpace > previousColon ? previousSpace + 1 : previousColon;
        const nextSpace = text.indexOf(" ", cursor);
        const begin = Math.max(wordStart, 0);
        const end = nextSpace < 0 ? text.length : nextSpace;
        const emoji = translateShortcodeToUnicode(shortcode).text;
        let updatedText = text.slice(0, begin) + emoji + text.slice(end);
        const maxLength = parseInt(this.$input.attr("maxlength"));
        if (updatedText.length > maxLength) updatedText = updatedText.slice(0, maxLength);
        this.$input.val(updatedText);
        const nextCursor = Math.min(begin + emoji.length, updatedText.length);
        input.selectionStart = nextCursor;
        input.selectionEnd = nextCursor;
    }

    handleKeypress() {
        if (options.disableEmojis) return;
        const word = emoteSelector.getCurrentWord(this.$input);
        let entries = [];
        if (emoteSelector.EMOJI_REGEX.test(word)) {
            entries = emoteSelector.getEmojiMatches(word).map(shortcode => {
                const emoji = translateShortcodeToUnicode(shortcode).text;
                const src = $(twemoji.parse(emoji)).attr("src");
                return { name: shortcode, src };
            });
        }
        this.items = entries.slice(0, 10);
        if (entries.length === 0) this.hide();
        else if (this.currentWord !== word) this.display();
        this.currentWord = word;
    }

    handleKeydown(...args) {
        const dropdown = quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance.ul;
        if (!dropdown.hasAttribute("hidden")) return;
        this.defaultKeyHandler.apply(this, args);
    }

    display() {
        if (this.displayed) this.$input.contextMenu("hide");
        this.$input.contextMenu();
        this.displayed = true;
    }

    hide() {
        if (this.displayed) this.$input.contextMenu("hide");
    }
}

// Attach answer suggestions and shortcode conversion to the existing game inputs
function setupAnswerInputEmojis() {
    if (fetchEmojiList) loadEmojiCatalogue();
    const $answerInput = $("#qpAnswerInput");
    $("#qpAnswerInput, #mhRoomNameInput, #hostCustomQuizRoomName").on("input", convertText);
    const selector = new AnswerInputEmoteSelector($answerInput, "#qpAnswerInput");
    $answerInput.on("keyup", () => selector.handleKeypress());
}

// Load the extra catalogue once during startup when the setting is enabled
async function loadEmojiCatalogue() {
    try {
        const response = await fetch(emojiCatalogueUrl);
        const catalogue = await response.json();
        populateEmojiMaps(catalogue);
    }
    catch (error) {
        console.error("AMQ ChatPlus: failed to load JoyPixels list ", error);
    }
}

// Format the shared timestamp with the selected precision
function getTimestamp() {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const time = hours + ":" + minutes;
    if (timestampFormat !== "HH:MM:SS") return time;
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return time + ":" + seconds;
}

// Wait for the input update before replacing any emoji shortcodes
function convertText(event) {
    if (!convertShortcodes || !event.target.value.includes(":")) return;
    setTimeout(() => {
        event.target.value = translateShortcodeToUnicode(event.target.value).text;
    }, 0);
}

// Exclude catalogue variants that duplicate the base skin, hair, or gender entry
function isEmojiVariant(codePoints) {
    if (codePoints.some(codePoint => skinModifiers.includes(codePoint))) return true;
    if (codePoints.some(codePoint => hairModifiers.includes(codePoint))) return true;
    if (!codePoints.includes(0x200D)) return false;
    return codePoints.some(codePoint => genderModifiers.includes(codePoint));
}

// Add primary JoyPixels shortcodes without replacing AMQ's existing mappings
function populateEmojiMaps(catalogue) {
    for (const entry of Object.values(catalogue)) {
        const codePoints = entry.code_points.fully_qualified.split("-").map(codePoint => parseInt(codePoint, 16));
        if (isEmojiVariant(codePoints)) continue;
        const shortcode = entry.shortname;
        if (!Object.hasOwn(EMOJI_SHORTCODE_MAP, shortcode)) {
            EMOJI_SHORTCODE_MAP[shortcode] = codePoints;
            EMOJI_SHORTCODE_LIST.push(shortcode);
        }
        const emoji = String.fromCodePoint(...codePoints);
        if (!Object.hasOwn(EMOJI_TO_NAME_MAP, emoji)) EMOJI_TO_NAME_MAP[emoji] = shortcode;
    }
}

// Read a JSON object from localStorage, returning an empty object if invalid
function readStorageObject(key) {
    let value;
    try {
        value = JSON.parse(localStorage.getItem(key));
    }
    catch {
        return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

// Load validated preferences without changing runtime state
function loadSettings() {
    const settings = {
        gcTimestamps: true,
        ncTimestamps: true,
        dmTimestamps: true,
        timestampFormat: "HH:MM",
        ncColor: false,
        dmColor: true,
        reformatBottomBar: true,
        loadBalancerFromLeft: 225,
        xpBarWidth: 110,
        xpBarFromRight: 496,
        dmWidthExtension: 60,
        dmHeightExtension: 40,
        resizeNexusChat: false,
        gcLoadMediaButton: true,
        gcAutoLoadMedia: "never",
        gifSearch: true,
        gifSearchHeight: 250,
        gifSendOnClick: true,
        gcMaxMessages: 200,
        ncMaxMessages: 100,
        fileUploadToLitterbox: true,
        convertShortcodes: true,
        fetchEmojiList: true,
    };
    const savedSettings = readStorageObject("chatPlus");

    for (const key of [
        "gcTimestamps", "ncTimestamps", "dmTimestamps",
        "ncColor", "dmColor", "reformatBottomBar",
        "resizeNexusChat", "gcLoadMediaButton", "gifSearch",
        "gifSendOnClick", "fileUploadToLitterbox", "convertShortcodes",
        "fetchEmojiList"
    ]) {
        if (typeof savedSettings[key] === "boolean") settings[key] = savedSettings[key];
    }
    for (const key of [
        "loadBalancerFromLeft", "xpBarWidth", "xpBarFromRight",
        "dmWidthExtension", "dmHeightExtension", "gifSearchHeight"
    ]) {
        const value = savedSettings[key];
        if (Number.isInteger(value) && value >= 0) settings[key] = value;
    }
    for (const key of ["gcMaxMessages", "ncMaxMessages"]) {
        const value = savedSettings[key];
        if (Number.isInteger(value) && value > 0) settings[key] = value;
    }
    if (["HH:MM", "HH:MM:SS"].includes(savedSettings.timestampFormat)) {
        settings.timestampFormat = savedSettings.timestampFormat;
    }
    if (["never", "friends", "all"].includes(savedSettings.gcAutoLoadMedia)) {
        settings.gcAutoLoadMedia = savedSettings.gcAutoLoadMedia;
    }
    return settings;
}

// Load the Highlight Friends preferences used by this script
function loadHighlightSettings() {
    const settings = {
        smColorSelfColor: "#80c7ff",
        smColorFriendColor: "#80ff80",
        smColorBlockedColor: "#ff8080",
        customColors: []
    };
    const savedSettings = readStorageObject("highlightFriendsSettings");

    for (const key of [
        "smColorSelfColor", "smColorFriendColor", "smColorBlockedColor"
    ]) {
        if (typeof savedSettings[key] === "string") settings[key] = savedSettings[key];
    }
    settings.customColors = normalizeCustomColors(savedSettings.customColors);
    return settings;
}

// Normalize saved color groups before building player lookups or CSS
function normalizeCustomColors(value) {
    if (!Array.isArray(value)) return [];
    const colors = [];
    for (const group of value) {
        if (!group || typeof group !== "object" || Array.isArray(group)) continue;
        const players = Array.isArray(group.players)
            ? group.players.filter(player => typeof player === "string")
            : [];
        colors.push({
            enabled: typeof group.enabled === "boolean" ? group.enabled : true,
            color: typeof group.color === "string" ? group.color : "#80c7ff",
            shadow: typeof group.shadow === "string" ? group.shadow : "#228dff",
            players
        });
    }
    return colors;
}

// Save settings
function saveSettings() {
    localStorage.setItem("chatPlus", JSON.stringify({
        gcTimestamps,
        ncTimestamps,
        dmTimestamps,
        timestampFormat,
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

// Reapply current palettes and memberships without rebuilding chat messages
function refreshHighlightColors() {
    applyStyles();
    let selector = ".cpDmUsername";
    if (ncColor) selector += ", .nexusCoopChatName";
    $(selector).each(function () {
        const $name = $(this);
        const playerName = $name.text().slice(0, -1);
        $name.removeClass(removePlayerColorClasses).addClass(getPlayerColorClasses(playerName));
    });
}

// Remove only the relationship and group classes managed by Chat Plus
function removePlayerColorClasses(index, className) {
    return className.split(/\s+/)
        .filter(name => /^(self|friend|customColor\d+)$/.test(name))
        .join(" ");
}

// Refresh player lookups and compose settings, layout, media, and highlight styles
function applyStyles() {
    const hfSettings = loadHighlightSettings();
    customColorMap = Object.create(null);
    for (const [index, group] of hfSettings.customColors.entries()) {
        for (const player of group.players) customColorMap[player.toLowerCase()] = index;
    }
    const styles = [createBaseStyles(), createChatLayoutStyles(), createMediaStyles()];
    if (dmColor) styles.push(createNameColorStyles(".cpDmUsername", hfSettings));
    if (ncColor) styles.push(createNameColorStyles(".nexusCoopChatName", hfSettings));
    let style = document.getElementById("chatPlusStyle");
    if (!style) {
        style = document.createElement("style");
        style.id = "chatPlusStyle";
        document.head.appendChild(style);
    }
    style.textContent = styles.join("\n").trim();
}

// Share the same palette rules between direct messages and Nexus names
function createNameColorStyles(selector, hfSettings) {
    const rules = [/*css*/`
        ${selector}.self {
            color: ${hfSettings.smColorSelfColor};
        }
        ${selector}.friend {
            color: ${hfSettings.smColorFriendColor};
        }
    `];
    hfSettings.customColors.forEach((group, index) => {
        if (!group.enabled) return;
        rules.push(/*css*/`
            ${selector}.customColor${index} {
                color: ${group.color};
            }
        `);
    });
    return rules.join("\n");
}

// Keep the settings and message decoration CSS separate from adjustable dimensions
function createBaseStyles() {
    return /*css*/`
        #settingsGraphicContainer .cpGraphicsSettings {
            padding-top: 10px;
        }
        #cpSettingsTitle {
            margin: 0;
            padding: 0;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            cursor: pointer;
        }
        #cpSettingsContent {
            margin: 0;
            padding: 5px 0 0;
        }
        #cpSettings #cpInfoTab {
            width: 45px;
        }
        #cpInfoContainer h4 {
            margin: 0 0 5px;
        }
        #cpSettings .tabSection {
            padding-top: 5px;
        }
        #cpSettings .cpSettingsGrid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 18px 24px;
        }
        #cpSettings .cpSettingsStack {
            display: grid;
            align-content: start;
            gap: 18px;
        }
        #cpSettings .cpSettingsGroup,
        #cpSettings .cpSettingsFields {
            display: grid;
            align-content: start;
            gap: 10px;
            min-width: 0;
        }
        #cpSettings .cpSettingsGroup > h4 {
            margin: 0;
            font-size: 14px;
            font-weight: bold;
        }
        #cpSettings .cpSettingsOptions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px 24px;
        }
        #cpSettings .cpSettingsRow {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 6px 10px;
        }
        #cpSettings .cpSettingsRow > label {
            margin: 0;
            font-weight: normal;
        }
        #cpSettings .cpSettingsCheckbox {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        #cpSettings .cpSettingsCheckbox > label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }
        #cpSettings .customCheckbox {
            flex: none;
        }
        #cpSettings .form-control {
            height: 28px;
            color: black;
            padding: 2px 6px;
        }
        #cpSettings input.form-control {
            width: 78px;
            display: inline-block;
        }
        #cpSettings select.form-control {
            width: auto;
        }
        #cpSettings .cpSettingsTable {
            width: 100%;
            border-collapse: collapse;
        }
        #cpSettings .cpSettingsTable th,
        #cpSettings .cpSettingsTable td {
            padding: 3px 8px;
            text-align: center;
            vertical-align: middle;
        }
        #cpSettings .cpSettingsTable th {
            font-weight: bold;
        }
        #cpSettings .cpSettingsTable th:first-child {
            padding-left: 0;
            text-align: left;
        }
        #cpSettings .cpSettingsTable th:last-child,
        #cpSettings .cpSettingsTable td:last-child {
            padding-right: 0;
        }
        #cpSettings .cpDisplayOptions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px 20px;
            margin-top: 12px;
        }
        .cpChatTimestamp {
            opacity: 0.5;
        }
        .cpDmTimestamp {
            opacity: 0.5;
        }
        .cpNexusTimestamp {
            opacity: 0.5;
        }
        .cpDmUsername {
            font-weight: bold;
        }
    `;
}

// Calculate chat-window and bottom-bar dimensions from the persisted preferences
function createChatLayoutStyles() {
    const xpWidth = reformatBottomBar ? xpBarWidth + "px" : "240px";
    let chatWidth = "calc(50% - 275px)";
    if (reformatBottomBar) chatWidth = `calc(100% - 85px - ${xpBarFromRight}px - ${xpBarWidth}px)`;
    let css = /*css*/`
        #chatContainer {
            width: ${chatWidth};
            height: ${300 + dmHeightExtension}px;
        }
        #activeChatScrollContainer {
            margin-top: ${255 + dmHeightExtension}px;
        }
        #xpOuterContainer {
            width: ${xpWidth};
            margin: ${reformatBottomBar ? 0 : "auto"};
            left: ${reformatBottomBar ? "auto" : 0};
            right: ${reformatBottomBar ? xpBarFromRight + "px" : 0};
        }
        #xpBarOuter {
            width: ${xpWidth};
        }
        #currencyContainer {
            left: ${xpWidth};
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
    `;
    if (reformatBottomBar) css += /*css*/`
        #loadBalanceStatusContainer {
            left: ${loadBalancerFromLeft}px;
        }
    `;
    return css;
}

// Keep media rendering and GIF-picker styling together
function createMediaStyles() {
    return /*css*/`
        .cpMediaContainer {
            margin: 5px 0 3px 0;
        }
        button.cpLoadMediaButton {
            background: #6D6D6D;
            border: none;
            color: #d9d9d9;
            display: block;
            margin: auto;
            padding: 3px 6px;
        }
        button.cpLoadMediaButton:hover {
            color: #d9d9d9;
            opacity: .7;
        }
        img.cpLoadedImage {
            display: block;
            margin: auto;
            max-width: 70%;
            max-height: 200px;
        }
        audio.cpLoadedAudio {
            display: block;
            margin: auto;
            width: 80%;
            height: 35px;
        }
        video.cpLoadedVideo {
            display: block;
            margin: auto;
            max-width: 70%;
            max-height: 200px;
        }
        #gcEmojiPickerOuterContainer {
            right: ${gifSearch ? "111px" : "86px"};
        }
        #cpGifButtonContainer {
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
        #cpGifSearchInput {
            color: black;
            width: 100%;
        }
        #cpGifResults {
            height: ${gifSearchHeight - 27}px;
            padding: 2px 0;
            position: absolute;
        }
        #cpGifResults .cpGifNotice {
            margin: 8px;
        }
        img.cpGifThumbnail {
            height: 70px;
            margin: 2px;
            border-radius: 5px;
            cursor: pointer;
        }
        button.cpCloseMediaButton {
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
        button.cpCloseMediaButton:hover {
            color: #d9d9d9;
            opacity: .7;
        }
    `;
}

startScript();
