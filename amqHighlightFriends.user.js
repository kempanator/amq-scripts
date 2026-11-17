// ==UserScript==
// @name         AMQ Highlight Friends
// @namespace    https://github.com/kempanator
// @version      2.5
// @description  Apply colors to player names and add an answer summary table
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqHighlightFriends.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqHighlightFriends.user.js
// ==/UserScript==

/*
Fork of Highlight Friends by nyamu
https://github.com/nyamu-amq/amq_scripts/blob/master/amqHighlightFriends.user.js

New Features:
- blocked people are red
- custom colors for any name
- change mode and sort columns in summary table
*/

"use strict";
if (typeof Listener === "undefined") return;

const largeRooms = ["Ranked", "Themed", "Jam", "Event", "event"]; // gamemodes for friend view
const colorClassRegex = /(isSelf|isFriend|isBlocked|customColor\d+)/g;
let smColorSelfColor;
let smColorSelfShadow;
let smColorFriendColor;
let smColorFriendShadow;
let smColorBlockedColor;
let smColorBlockedShadow;
let smColorJoinColor;
let smColorSpecColor;
let smColorLeaveColor;
let smColorSelf;
let smColorFriend;
let smColorBlocked;
let smColorScorebox;
let smColorName;
let smColorPoint;
let smColorLevel;
let smColorChat;
let smColorLeaderboard;
let smColorJoin;
let smColorSpec;
let smColorLeave;
let chatNameColorMode;
let chatRewardGlowMode;
let tableFriendsOnly = false;
let tableSort = { mode: "position", ascending: true }; // position, name, answer, time
let summarySnapshot = [];
let answerTimes = {}; // { gamePlayerId: ms }
let latestPlayerAnswers = {}; // { gamePlayerId: answerText }
let playerSummaryWindow;
let $playerSummaryTable;
let $playerSummarySettings;
let playerSummaryRows = [];
let playerSummaryRowCache = new Map();
let playerSummarySettingsOpen = false;
let summaryTimeUnit;
let summaryAnswerAppendTime;
let summaryColumns;
let customColors;
let customColorMap = Object.create(null);
let hotkeyController;
let hotKeys;
let colorStyleElement;
let colorRefreshTimeoutId = null;
let customColorDraft = null;

const chatNameColorModes = {
    preferHighlights: "Prefer highlights",
    preferAmq: "Prefer AMQ rewards",
    highlightsOnly: "Highlights only",
    amqOnly: "AMQ colors only",
    plain: "Plain names",
};
const chatRewardGlowModes = {
    keep: "Keep AMQ glow",
    remove: "Remove AMQ glow",
};

const summaryColumnDefinitions = [
    { key: "rank", label: "Rank", className: "hfSummaryRank", sort: "position" },
    { key: "score", label: "Score", className: "hfSummaryScore", sort: "position" },
    { key: "name", label: "Name", className: "hfSummaryName", sort: "name" },
    { key: "box", label: "Box", className: "hfSummaryBox", sort: "position" },
    { key: "answer", label: "Answer", className: "hfSummaryAnswer", sort: "answer" },
    { key: "time", label: "Time", className: "hfSummaryTime", sort: "time" },
];
const hotkeyActions = {
    hfWindow: {
        label: "Open Player Summary",
        defaultBinding: { key: "SCROLLLOCK", ctrl: false, alt: false, shift: false },
        run: toggleSummaryWindow
    },
    toggleCustomColors: {
        label: "Toggle Custom Colors",
        run: toggleCustomColors
    },
};

// Initialize once AMQ finishes loading
function startScript() {
    initializeState();
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
    smColorSelfColor = settings.smColorSelfColor;
    smColorSelfShadow = settings.smColorSelfShadow;
    smColorFriendColor = settings.smColorFriendColor;
    smColorFriendShadow = settings.smColorFriendShadow;
    smColorBlockedColor = settings.smColorBlockedColor;
    smColorBlockedShadow = settings.smColorBlockedShadow;
    smColorJoinColor = settings.smColorJoinColor;
    smColorSpecColor = settings.smColorSpecColor;
    smColorLeaveColor = settings.smColorLeaveColor;
    smColorSelf = settings.smColorSelf;
    smColorFriend = settings.smColorFriend;
    smColorBlocked = settings.smColorBlocked;
    smColorScorebox = settings.smColorScorebox;
    smColorName = settings.smColorName;
    smColorPoint = settings.smColorPoint;
    smColorLevel = settings.smColorLevel;
    smColorChat = settings.smColorChat;
    smColorLeaderboard = settings.smColorLeaderboard;
    smColorJoin = settings.smColorJoin;
    smColorSpec = settings.smColorSpec;
    smColorLeave = settings.smColorLeave;
    chatNameColorMode = settings.chatNameColorMode;
    chatRewardGlowMode = settings.chatRewardGlowMode;
    summaryTimeUnit = settings.summaryTimeUnit;
    summaryAnswerAppendTime = settings.summaryAnswerAppendTime;
    summaryColumns = settings.summaryColumns;
    customColors = settings.customColors;
    hotkeyController = new HotkeyController({
        actions: hotkeyActions,
        savedBindings: settings.hotKeys,
        onChange: saveSettings
    });
    hotKeys = hotkeyController.bindings;
    rebuildCustomColorMap();
}

// Install color hooks before AMQ creates its first messages and leaderboard rows
function installHooks() {
    GameChat.prototype.systemMessage = function (title, message = "", teamMessage) {
        const $message = $(format(this.serverMsgTemplate, title, message || ""));
        if (teamMessage) $message.find(".gcTeamMessageIcon").removeClass("hide");
        $message.addClass(getSystemMessageClass(title));
        this.insertMsg($message);
    };

    const originalFormatChatMessage = GameChat.prototype.formatChatMessage;
    GameChat.prototype.formatChatMessage = function (sender, message, emojis, messageId, badges, nameColor, nameGlow) {
        const result = originalFormatChatMessage.apply(this, arguments);
        const $username = result.$chatMessage.find(".gcUserName");
        $username.attr("data-hf-player-name", sender).data("hfNameEffects", {
            color: nameColor ?? "",
            glow: nameGlow ?? ""
        });
        applyChatClasses($username, sender);
        return result;
    };

    const originalChangeView = ViewChanger.prototype.changeView;
    ViewChanger.prototype.changeView = function (...args) {
        const result = originalChangeView.apply(this, args);
        scheduleColorRefresh();
        return result;
    };

    const originalBlockPlayer = SocialTab.prototype.blockPlayer;
    SocialTab.prototype.blockPlayer = function (...args) {
        const result = originalBlockPlayer.apply(this, args);
        scheduleColorRefresh();
        return result;
    };

    const originalUnblockPlayer = SocialTab.prototype.unblockPlayer;
    SocialTab.prototype.unblockPlayer = function (...args) {
        const result = originalUnblockPlayer.apply(this, args);
        scheduleColorRefresh();
        return result;
    };

    const originalUpdateList = Leaderboard.prototype.updateList;
    Leaderboard.prototype.updateList = function (listName, entries) {
        const result = originalUpdateList.call(this, listName, entries);
        const $rows = this.tabMap[listName].$container.find(".lbmBoardEntry");
        entries.forEach((entry, index) => {
            if (!entry.name) return;
            const $row = $rows.eq(index).attr("data-hf-player-name", entry.name);
            applyLeaderboardClasses($row, entry.name);
        });
        return result;
    };
}

// Create controls before subscribing to events that can render into them
function setup() {
    createSummaryWindow();
    createGraphicsSettings();
    bindWindowEvents();
    bindSettingsEvents();
    createMenuButton();
    applyStyles();
    updateSettingsControls();
    renderCustomColorRows();
    updateSummaryColumnVisibility();
    hotkeyController.renderTable(document.querySelector("#hfHotkeyTable tbody"));
    hotkeyController.start();
    bindGameEvents();
    refreshColors();
    registerScriptInfo();
}

// Keep event registration separate from summary and color rendering
function bindGameEvents() {
    new Listener("Join Game", handleGameJoin).bindListener();
    new Listener("Spectate Game", handleGameJoin).bindListener();
    new Listener("Game Starting", handleGameStart).bindListener();
    new Listener("New Player", scheduleColorRefresh).bindListener();
    new Listener("Spectator Change To Player", scheduleColorRefresh).bindListener();
    new Listener("New Spectator", scheduleColorRefresh).bindListener();
    new Listener("Player Changed To Spectator", scheduleColorRefresh).bindListener();
    new Listener("player late join", scheduleColorRefresh).bindListener();
    new Listener("Jam Game Restarting", scheduleColorRefresh).bindListener();
    new Listener("play next song", () => {
        answerTimes = {};
        latestPlayerAnswers = {};
    }).bindListener();
    new Listener("player answered", recordAnswerTimes).bindListener();
    new Listener("player answers", data => {
        latestPlayerAnswers = {};
        for (const answer of data.answers) {
            latestPlayerAnswers[answer.gamePlayerId] = answer.answer;
        }
    }).bindListener();
    new Listener("answer results", handleAnswerResults).bindListener();
    new Listener("new friend", handleRelationshipChange).bindListener();
    new Listener("friend removed", handleRelationshipChange).bindListener();
    new Listener("friend name change", handleFriendNameChange).bindListener();
}

// Use the same summary setup when joining as a player or spectator
function handleGameJoin(data) {
    if (data.error || !data.quizState || data.quizState.state === quiz.QUIZ_STATES.BATTLE_ROYAL) return;
    tableFriendsOnly = largeRooms.includes(data.settings.gameMode);
    answerTimes = {};
    latestPlayerAnswers = {};
    summarySnapshot = createSummarySnapshot(data.quizState, answerTimes, latestPlayerAnswers);
    renderSummaryTable();
}

// Start the summary with the room's default player filter
function handleGameStart(data) {
    tableFriendsOnly = largeRooms.includes(data.gameMode);
    answerTimes = {};
    latestPlayerAnswers = {};
    summarySnapshot = createSummarySnapshot(data, answerTimes, latestPlayerAnswers);
    renderSummaryTable();
}

// Store answer times in milliseconds for formatting and numeric sorting
function recordAnswerTimes(groups) {
    for (const group of groups) {
        const milliseconds = Math.floor(group.answerTime * 1000);
        for (const playerId of group.gamePlayerIds) {
            answerTimes[playerId] = milliseconds;
        }
    }
}

// Let the client finish creating late-join avatars before reading their display data
function handleAnswerResults(data) {
    const times = { ...answerTimes };
    const answers = { ...latestPlayerAnswers };
    setTimeout(() => {
        if (data.lateJoinPlayers) scheduleColorRefresh();
        summarySnapshot = createSummarySnapshot(data, times, answers);
        renderSummaryTable();
    }, 0);
}

// Reconcile relationship colors and the friend filter after the native listener runs
function handleRelationshipChange() {
    scheduleColorRefresh();
    setTimeout(renderSummaryTable, 0);
}

// Keep custom groups and the summary aligned with a friend's new name
function handleFriendNameChange(data) {
    const oldName = data.oldName.toLowerCase();
    const newName = data.newName.toLowerCase();
    for (const group of customColors) {
        group.players = group.players.map(name => name.toLowerCase() === oldName ? newName : name);
    }
    for (const player of summarySnapshot) {
        if (player.name.toLowerCase() === oldName) player.name = data.newName;
    }
    setTimeout(() => {
        commitCustomColorChanges();
        renderCustomColorRows();
        renderSummaryTable();
    }, 0);
}

// Reuse one window toggle for the quiz menu and hotkey
function toggleSummaryWindow() {
    if (playerSummaryWindow.isVisible()) {
        playerSummaryWindow.close();
        return;
    }
    playerSummaryWindow.open();
}

// Invert every group's enabled state and render the checkboxes from the updated data
function toggleCustomColors() {
    for (const group of customColors) {
        group.enabled = !group.enabled;
    }
    renderCustomColorRows();
    commitColorStyleChanges();
    colorExistingChatNames();
}

// Create the summary table and controls while retaining AMQWindow's title element
function createSummaryWindow() {
    playerSummaryWindow = new AMQWindow({
        id: "hfSummaryWindow",
        title: "Player Summary",
        position: { x: 0, y: 34 },
        width: 400,
        height: 374,
        minWidth: 400,
        minHeight: 150,
        zIndex: 1010,
        resizable: true,
        draggable: true
    });
    playerSummaryWindow.addPanel({
        id: "hfSummaryTableContainer",
        width: 1.0,
        height: "100%",
        scrollable: { x: false, y: true }
    });
    const $header = playerSummaryWindow.window.find(".modal-header");
    $header.find(".close").remove();
    $header.append(/*html*/`
        <div class="hfHeaderActions">
            <button type="button" class="hfIconButton" data-action="filter" title="Toggle friend summary">
                <i class="fa fa-table" aria-hidden="true"></i>
            </button>
            <button type="button" class="hfIconButton" data-action="settings" title="Toggle settings">
                <i class="fa fa-cog" aria-hidden="true"></i>
            </button>
            <button type="button" class="hfIconButton hfCloseButton" data-action="close" title="Close">
                <i class="fa fa-times" aria-hidden="true"></i>
            </button>
        </div>
    `);
    $playerSummaryTable = $(/*html*/`
        <table id="hfSummaryTable" class="table floatingContainer">
            <thead><tr class="header clickAble"></tr></thead>
            <tbody></tbody>
        </table>
    `);
    for (const column of summaryColumnDefinitions) {
        $playerSummaryTable.find("thead tr").append($("<th>", {
            scope: "col",
            class: column.className,
            "data-sort": column.sort,
            text: column.label
        }));
    }
    $playerSummarySettings = $(/*html*/`
        <div id="hfSummarySettings">
            <h3>Time Unit</h3>
            <div class="hfSettingsRow">
                <select id="hfSummaryTimeUnitSelect">
                    <option value="seconds">Seconds</option>
                    <option value="milliseconds">Milliseconds</option>
                </select>
                <label class="hfCheckbox">
                    <input id="hfSummaryAppendTimeCheckbox" type="checkbox">
                    <span>Append Time to Answer</span>
                </label>
            </div>
            <h3>Column Visibility</h3>
            <div class="hfCheckboxRow" id="hfSummaryColumns"></div>
        </div>
    `).hide();
    for (const column of summaryColumnDefinitions) {
        $playerSummarySettings.find("#hfSummaryColumns").append(
            createCheckboxControl("hfSummaryColumn" + column.key, column.label, { "data-column": column.key })
        );
    }
    playerSummaryWindow.panels[0].panel.append($playerSummaryTable, $playerSummarySettings);
}

// Bind stable containers so row rendering never needs to install more click handlers
function bindWindowEvents() {
    playerSummaryWindow.window.on("click", "button[data-action]", event => {
        switch (event.currentTarget.dataset.action) {
            case "close":
                playerSummaryWindow.close();
                break;
            case "filter":
                tableFriendsOnly = !tableFriendsOnly;
                renderSummaryTable();
                break;
            case "settings":
                playerSummarySettingsOpen = !playerSummarySettingsOpen;
                $playerSummaryTable.toggle(!playerSummarySettingsOpen);
                $playerSummarySettings.toggle(playerSummarySettingsOpen);
                break;
        }
    });
    $playerSummaryTable.on("click", "th[data-sort]", event => {
        changeSummarySort(event.currentTarget.dataset.sort);
    });
    $playerSummaryTable.on("click", "tbody tr", event => {
        const box = $(event.currentTarget).data("summary").box;
        if (box) selectAvatarGroup(box);
    });
    $("#hfSummaryTimeUnitSelect").on("change", function () {
        summaryTimeUnit = this.value;
        saveSettings();
        renderSummaryTable();
    });
    $("#hfSummaryAppendTimeCheckbox").on("change", function () {
        summaryAnswerAppendTime = this.checked;
        saveSettings();
        renderSummaryTable();
    });
    $("#hfSummaryColumns").on("change", "input", function () {
        summaryColumns[this.dataset.column] = this.checked;
        saveSettings();
        updateSummaryColumnVisibility();
    });
}

// Keep native checkbox markup consistent across graphics and summary settings
function createCheckboxControl(id, label, attributes = {}) {
    return $("<label>", { class: "hfCheckbox" }).append(
        $("<input>", { type: "checkbox", id, ...attributes }),
        $("<span>", { text: label })
    );
}

// Use AMQ's checkbox control for graphics settings and editor fields
function createGameCheckbox(id, label, attributes = {}) {
    const $box = $("<div>", { class: "customCheckbox" }).append(
        $("<input>", { type: "checkbox", id, ...attributes }),
        $("<label>", { for: id }).append(
            $("<i>", { class: "fa fa-check", "aria-hidden": "true" })
        )
    );
    const $control = $("<div>", { class: "hfGameCheckbox" }).append($box);
    if (label) $control.append($("<label>", { for: id, text: label }));
    return $control;
}

// Keep the settings pages inside AMQ's existing Graphics tab
function createGraphicsSettings() {
    $("#settingsGraphicContainer").append(/*html*/`
        <div class="row hfGraphicsSettings">
            <div id="hfSettings" class="col-xs-12">
                <h3 id="hfSettingsTitle" class="clickAble">Highlight Friends <i class="fa fa-fw fa-caret-right"></i></h3>
                <div id="hfSettingsContent">
                    <div id="hfSettingsTabs" class="tabContainer">
                        <div id="hfAppearanceTab" class="tab clickAble" data-tab="hfAppearance"><h5>Appearance</h5></div>
                        <div id="hfCustomColorsTab" class="tab clickAble" data-tab="hfCustomColors"><h5>Custom colors</h5></div>
                        <div id="hfHotkeysTab" class="tab clickAble" data-tab="hfHotkeys"><h5>Hotkeys</h5></div>
                        <div id="hfInfoTab" class="tab clickAble right" data-tab="hfInfo">
                            <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                        </div>
                    </div>
                    <div id="hfAppearanceContainer" class="tabSection" data-tab="hfAppearance">
                        <div class="row">
                            <div class="col-sm-6 form-group">
                                <label for="hfChatNameColorMode">Chat name colors</label>
                                <select id="hfChatNameColorMode" class="form-control" data-setting="chatNameColorMode"></select>
                            </div>
                            <div class="col-sm-6 form-group">
                                <label for="hfChatRewardGlowMode">AMQ reward glow</label>
                                <select id="hfChatRewardGlowMode" class="form-control" data-setting="chatRewardGlowMode"></select>
                            </div>
                        </div>
                        <div class="hfSectionLabel">Show highlights in</div>
                        <div id="hfColorTargets" class="hfCheckboxRow"></div>
                        <div class="row">
                            <div class="col-sm-7">
                                <table id="hfPaletteTable" class="hfSettingsTable">
                                    <thead><tr>
                                        <th scope="col">Player</th>
                                        <th scope="col">Color</th>
                                        <th scope="col">Shadow</th>
                                    </tr></thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                            <div class="col-sm-5">
                                <table id="hfActivityPaletteTable" class="hfSettingsTable">
                                    <thead><tr><th scope="col">Message</th><th scope="col">Color</th></tr></thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div id="hfCustomColorsContainer" class="tabSection" data-tab="hfCustomColors">
                        <div id="hfCustomColorList">
                            <div class="hfSettingsToolbar">
                                <button type="button" class="btn btn-default" data-action="add-color">
                                    <i class="fa fa-plus" aria-hidden="true"></i> Add custom color
                                </button>
                            </div>
                            <div class="table-responsive">
                                <table id="hfCustomColorTable" class="hfSettingsTable">
                                    <thead><tr>
                                        <th scope="col"></th>
                                        <th scope="col">Group</th>
                                        <th scope="col">Players</th>
                                        <th scope="col">Color</th>
                                        <th scope="col">Shadow</th>
                                        <th scope="col"></th>
                                    </tr></thead>
                                    <tbody id="hfCustomColorRows"></tbody>
                                </table>
                            </div>
                            <p id="hfNoCustomColors" class="hfSettingsHint">No custom colors yet.</p>
                        </div>
                        <form id="hfCustomColorEditor">
                            <h4 id="hfCustomColorEditorTitle"></h4>
                            <div class="hfCustomColorFields">
                                <div class="form-group hfCustomNameField">
                                    <label for="hfCustomNameInput">Group name</label>
                                    <input id="hfCustomNameInput" class="form-control" type="text" data-field="name">
                                </div>
                                <div class="form-group">
                                    <label for="hfCustomColorInput">Color</label>
                                    <input id="hfCustomColorInput" class="form-control hfColorInput" type="color" data-field="color">
                                </div>
                                <div class="form-group">
                                    <label for="hfCustomShadowInput">Shadow</label>
                                    <input id="hfCustomShadowInput" class="form-control hfColorInput" type="color" data-field="shadow">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="hfCustomPlayersInput">Players</label>
                                <textarea id="hfCustomPlayersInput" class="form-control" data-field="players" rows="3" placeholder="Player names separated by spaces or commas"></textarea>
                            </div>
                            <div class="hfEditorActions">
                                <button type="button" id="hfDeleteCustomColorButton" class="btn btn-danger" data-action="delete-color">
                                    <i class="fa fa-trash" aria-hidden="true"></i> Delete group
                                </button>
                                <div class="hfSettingsActions">
                                    <button type="button" class="btn btn-default" data-action="cancel-edit">Cancel</button>
                                    <button type="submit" class="btn btn-primary">Save changes</button>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div id="hfHotkeysContainer" class="tabSection" data-tab="hfHotkeys">
                        <table id="hfHotkeyTable">
                            <thead><tr><th scope="col">Action</th><th scope="col">Keybind</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div id="hfInfoContainer" class="tabSection" data-tab="hfInfo">
                        <div class="hfInfoColumns">
                            <div>
                                <h4>Script Info</h4>
                                <div>Created by: kempanator</div>
                                <div>Version: ${GM_info.script.version}</div>
                                <div>
                                    <a href="https://github.com/kempanator/amq-scripts/blob/main/amqHighlightFriends.user.js" target="_blank">Github</a>
                                    <a href="https://github.com/kempanator/amq-scripts/raw/main/amqHighlightFriends.user.js" target="_blank">Install</a>
                                </div>
                            </div>
                            <div class="hfSettingsActions">
                                <button type="button" class="btn btn-danger" data-action="reset-colors">Reset colors</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    for (const [value, label] of Object.entries(chatNameColorModes)) {
        $("#hfChatNameColorMode").append($("<option>", { value, text: label }));
    }
    for (const [value, label] of Object.entries(chatRewardGlowModes)) {
        $("#hfChatRewardGlowMode").append($("<option>", { value, text: label }));
    }
    const targets = [
        ["smColorScorebox", "Scoreboard", "hfScoreboardCheckbox"],
        ["smColorName", "Names", "hfPlayerNamesCheckbox"],
        ["smColorPoint", "Scores", "hfPlayerScoresCheckbox"],
        ["smColorLevel", "Levels", "hfPlayerLevelsCheckbox"],
        ["smColorChat", "Chat", "hfChatNamesCheckbox"],
        ["smColorLeaderboard", "Leaderboard", "hfLeaderboardNamesCheckbox"]
    ];
    for (const [key, label, id] of targets) {
        $("#hfColorTargets").append(createGameCheckbox(id, label, { "data-setting": key }));
    }
    for (const [key, label] of [["Self", "Self"], ["Friend", "Friends"], ["Blocked", "Blocked"]]) {
        const $row = $(/*html*/`
            <tr>
                <td class="hfPaletteEnabled"></td>
                <td><input type="color" class="form-control hfColorInput" id="hf${key}ColorInput" data-setting="smColor${key}Color"></td>
                <td><input type="color" class="form-control hfColorInput" id="hf${key}ShadowInput" data-setting="smColor${key}Shadow"></td>
            </tr>
        `);
        $row.find(".hfPaletteEnabled").append(
            createGameCheckbox("hf" + key + "Checkbox", label, { "data-setting": "smColor" + key })
        );
        $("#hfPaletteTable tbody").append($row);
    }
    for (const [key, label] of [["Join", "Join"], ["Spec", "Spec"], ["Leave", "Leave"]]) {
        const $row = $(/*html*/`
            <tr>
                <td class="hfActivityEnabled"></td>
                <td><input type="color" class="form-control hfColorInput" id="hf${key}ColorInput" data-setting="smColor${key}Color"></td>
            </tr>
        `);
        $row.find(".hfActivityEnabled").append(
            createGameCheckbox("hf" + key + "Checkbox", label, { "data-setting": "smColor" + key })
        );
        $("#hfActivityPaletteTable tbody").append($row);
    }
    $("#hfCustomColorEditor").hide();
    $("#hfSettingsContent").hide();
    switchTab("hfAppearance");
}

// Select only this script's nested settings tab
function switchTab(tabKey) {
    const $tabRoot = $("#hfSettings");
    $tabRoot.find(".tab").removeClass("selected");
    $tabRoot.find(".tabSection").hide();
    $tabRoot.find(`.tab[data-tab="${tabKey}"]`).addClass("selected");
    $tabRoot.find(`.tabSection[data-tab="${tabKey}"]`).show();
}

// Apply appearance and group toggles immediately; save group details through the editor
function bindSettingsEvents() {
    $("#hfSettingsTitle").on("click", event => {
        $(event.currentTarget).find("i").toggleClass("fa-caret-down fa-caret-right");
        $("#hfSettingsContent").stop(true, true).slideToggle(150);
    });
    $("#hfSettingsTabs").on("click", ".tab[data-tab]", event => {
        switchTab(event.currentTarget.dataset.tab);
    });
    $("#hfSettings").on("change", "[data-setting]", function () {
        const key = this.dataset.setting;
        const value = this.type === "checkbox" ? this.checked : this.value;
        setColorPreference(key, value);
        commitColorStyleChanges();
        if ([
            "chatNameColorMode", "chatRewardGlowMode",
            "smColorSelf", "smColorFriend", "smColorBlocked", "smColorChat"
        ].includes(key)) {
            colorExistingChatNames();
        }
    });
    $("#hfSettings").on("click", "button[data-action]", event => {
        switch (event.currentTarget.dataset.action) {
            case "reset-colors":
                resetColors();
                break;
            case "add-color":
                openCustomColorEditor();
                break;
            case "edit-color":
                openCustomColorEditor(Number($(event.currentTarget).closest("[data-color]").attr("data-color")));
                break;
            case "cancel-edit":
                closeCustomColorEditor();
                break;
            case "delete-color":
                deleteCustomColor();
                break;
        }
    });
    $("#hfCustomColorEditor").on("submit", event => {
        event.preventDefault();
        saveCustomColor();
    });
    $("#hfCustomColorRows").on("change", "input[data-group-enabled]", function () {
        const index = Number($(this).closest("[data-color]").attr("data-color"));
        customColors[index].enabled = this.checked;
        commitColorStyleChanges();
        colorExistingChatNames();
    });
}

// Keep persisted preferences as individual globals with explicit assignments
function setColorPreference(key, value) {
    switch (key) {
        case "smColorSelfColor": smColorSelfColor = value; break;
        case "smColorSelfShadow": smColorSelfShadow = value; break;
        case "smColorFriendColor": smColorFriendColor = value; break;
        case "smColorFriendShadow": smColorFriendShadow = value; break;
        case "smColorBlockedColor": smColorBlockedColor = value; break;
        case "smColorBlockedShadow": smColorBlockedShadow = value; break;
        case "smColorJoinColor": smColorJoinColor = value; break;
        case "smColorSpecColor": smColorSpecColor = value; break;
        case "smColorLeaveColor": smColorLeaveColor = value; break;
        case "smColorSelf": smColorSelf = value; break;
        case "smColorFriend": smColorFriend = value; break;
        case "smColorBlocked": smColorBlocked = value; break;
        case "smColorScorebox": smColorScorebox = value; break;
        case "smColorName": smColorName = value; break;
        case "smColorPoint": smColorPoint = value; break;
        case "smColorLevel": smColorLevel = value; break;
        case "smColorChat": smColorChat = value; break;
        case "smColorLeaderboard": smColorLeaderboard = value; break;
        case "smColorJoin": smColorJoin = value; break;
        case "smColorSpec": smColorSpec = value; break;
        case "smColorLeave": smColorLeave = value; break;
        case "chatNameColorMode": chatNameColorMode = value; break;
        case "chatRewardGlowMode": chatRewardGlowMode = value; break;
    }
}

// Refresh controls from the current globals after startup or a palette reset
function updateSettingsControls() {
    const values = getSettingsData();
    $("#hfSettings [data-setting]").each(function () {
        const value = values[this.dataset.setting];
        if (this.type === "checkbox") this.checked = value;
        else this.value = value;
    });
    $("#hfSummaryTimeUnitSelect").val(summaryTimeUnit);
    $("#hfSummaryAppendTimeCheckbox").prop("checked", summaryAnswerAppendTime);
    for (const column of summaryColumnDefinitions) {
        $("#hfSummaryColumn" + column.key).prop("checked", summaryColumns[column.key]);
    }
}

// Reset only palette values and custom groups, retaining the existing preference choices
async function resetColors() {
    const result = await Swal.fire({
        title: "Reset Script Defaults",
        text: "Are you sure you want to reset all colors?",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
        reverseButtons: true
    });
    if (!result.isConfirmed) return;
    const defaults = getDefaultSettings();
    for (const key of [
        "smColorSelfColor", "smColorSelfShadow", "smColorFriendColor", "smColorFriendShadow",
        "smColorBlockedColor", "smColorBlockedShadow", "smColorJoinColor", "smColorSpecColor", "smColorLeaveColor"
    ]) {
        setColorPreference(key, defaults[key]);
    }
    closeCustomColorEditor();
    customColors = [];
    commitCustomColorChanges();
    renderCustomColorRows();
    updateSettingsControls();
}

// Add the summary entry point to AMQ's quiz toolbar
function createMenuButton() {
    $("#qpOptionContainer").width((index, width) => width + 35)
        .children("div").append(
            $("<div>", { id: "hfSummaryButton", class: "clickAble qpOption" })
                .append(/*html*/`<i class="fa fa-users qpMenuItem" aria-hidden="true"></i>`)
                .on("click", toggleSummaryWindow)
                .popover({ placement: "bottom", content: "Player Summary", trigger: "hover" })
        );
}

// Register the script and its settings location in AMQ's installed-script menu
function registerScriptInfo() {
    AMQ_addScriptData({
        name: "Highlight Friends",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqHighlightFriends.user.js",
        description: `
            <p>Fork of Highlight Friends by nyamu (do not install both scripts at the same time)</p>
            <p>Color yourself, friends, blocked, or custom players in lobby, quiz, scoreboard, leaderboard</p>
            <p>Adds a friend summary window in quiz to see their answers</p>
            <p>Settings are located in: bottom right gear icon > settings > graphics</p>
        `
    });
}

// Capture result data once so later formatting changes cannot read another round's buffers
function createSummarySnapshot(data, times, answers) {
    const groupMap = data.groupMap ?? data.groupSlotMap ?? quiz.avatarContainer._groupSlotMap;
    const groupPositions = new Map();
    for (const [box, playerIds] of Object.entries(groupMap)) {
        for (const playerId of playerIds) {
            groupPositions.set(playerId, { box, order: groupPositions.size });
        }
    }
    return data.players.map(player => captureSummaryPlayer(player, groupPositions, times, answers));
}

// Format and filter the captured summary without consulting live answer buffers
function renderSummaryTable() {
    playerSummaryWindow.setTitle(tableFriendsOnly ? "Friend Summary" : "Player Summary");
    playerSummaryRows = [];
    const visibleIds = new Set();
    for (const player of summarySnapshot) {
        if (!player.name) continue;
        if (tableFriendsOnly && player.name !== selfName && !socialTab.isFriend(player.name)) continue;
        const time = formatAnswerTime(player.timeMs);
        const record = {
            ...player,
            time,
            answer: summaryAnswerAppendTime && time ? player.answer + " (" + time + ")" : player.answer
        };
        let row = playerSummaryRowCache.get(record.gamePlayerId);
        if (!row) {
            row = createSummaryRow(record.gamePlayerId);
            playerSummaryRowCache.set(record.gamePlayerId, row);
        }
        row.data = record;
        row.$row.data("summary", record)
            .toggleClass("correctGuess", Boolean(record.correct))
            .toggleClass("incorrectGuess", record.correct !== undefined && !record.correct);
        for (const column of summaryColumnDefinitions) {
            row.cells[column.key].text(record[column.key]);
        }
        playerSummaryRows.push(row);
        visibleIds.add(record.gamePlayerId);
    }
    for (const [playerId, row] of playerSummaryRowCache) {
        if (visibleIds.has(playerId)) continue;
        row.$row.remove();
        playerSummaryRowCache.delete(playerId);
    }
    sortSummaryRows();
    updateSummaryColumnVisibility();
}

// Resolve fallback fields while the result still belongs to the current round
function captureSummaryPlayer(player, groupPositions, times, answers) {
    const gamePlayerId = player.gamePlayerId;
    const quizPlayer = quiz.players[gamePlayerId];
    const name = player.name ?? quizPlayer?._name ?? "";
    const answer = player.answer ?? answers[gamePlayerId]
        ?? quizPlayer?.avatarSlot.$answerContainerText.text() ?? "";
    const position = groupPositions.get(gamePlayerId);
    return {
        gamePlayerId,
        name,
        rank: player.position ?? "",
        score: player.correctGuesses ?? player.score ?? "",
        box: position?.box ?? "",
        order: position?.order ?? Number.MAX_SAFE_INTEGER,
        answer,
        timeMs: times[gamePlayerId] ?? null,
        correct: player.correct
    };
}

// Cache row cells so each result update changes text rather than rebuilding the table
function createSummaryRow(gamePlayerId) {
    const $row = $("<tr>", { id: "hfSummaryRow" + gamePlayerId, class: "hfSummaryRow clickAble" });
    const cells = {};
    for (const column of summaryColumnDefinitions) {
        cells[column.key] = $("<td>", { class: column.className }).appendTo($row);
    }
    return { $row, cells, data: null };
}

// Toggle a selected sort or start a different column in ascending order
function changeSummarySort(mode) {
    if (tableSort.mode === mode) {
        tableSort.ascending = !tableSort.ascending;
    }
    else {
        tableSort.mode = mode;
        tableSort.ascending = true;
    }
    sortSummaryRows();
}

// Compare normalized values rather than reading formatted cell text
function compareSummaryRows(firstRow, secondRow) {
    const first = firstRow.data;
    const second = secondRow.data;
    switch (tableSort.mode) {
        case "name": return first.name.localeCompare(second.name);
        case "answer": return first.answer.localeCompare(second.answer);
        case "time":
            return (first.timeMs ?? Number.MAX_SAFE_INTEGER) - (second.timeMs ?? Number.MAX_SAFE_INTEGER);
        default: return first.order - second.order;
    }
}

// Reorder existing rows while preserving their identity and delegated click actions
function sortSummaryRows() {
    playerSummaryRows.sort(compareSummaryRows);
    if (!tableSort.ascending) playerSummaryRows.reverse();
    $playerSummaryTable.find("tbody").append(playerSummaryRows.map(row => row.$row));
}

// Apply column choices to both the header and any newly rendered rows
function updateSummaryColumnVisibility() {
    for (const column of summaryColumnDefinitions) {
        $playerSummaryTable.find("." + column.className).toggle(summaryColumns[column.key]);
    }
}

// Keep missing times blank and numeric milliseconds separate from display units
function formatAnswerTime(milliseconds) {
    if (milliseconds === null || milliseconds === undefined) return "";
    if (summaryTimeUnit === "milliseconds") return milliseconds + "ms";
    return (milliseconds / 1000).toFixed(2) + "s";
}

// Select the row's avatar group and scroll its scoreboard section into view
function selectAvatarGroup(number) {
    quiz.avatarContainer.currentGroup = number;
    quiz.scoreboard.setActiveGroup(number);
    if (Object.keys(quiz.scoreboard.groups).length > 1) {
        const topOffset = quiz.scoreboard.groups[number].topOffset;
        quiz.scoreboard.$quizScoreboardItemContainer.stop().scrollTop(topOffset - 3);
    }
}

// Use the default self palette for each newly added custom group
function createCustomColorGroup() {
    const defaults = getDefaultSettings();
    return {
        name: "Custom group",
        enabled: true,
        color: defaults.smColorSelfColor,
        shadow: defaults.smColorSelfShadow,
        players: []
    };
}

// Rebuild membership after edits; later groups retain priority over earlier groups
function rebuildCustomColorMap() {
    customColorMap = Object.create(null);
    customColors.forEach((group, index) => {
        for (const player of group.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
}

// Update membership before refreshing CSS and elements that reference group indices
function commitCustomColorChanges() {
    rebuildCustomColorMap();
    commitColorStyleChanges();
    refreshColors();
}

// Save visual edits and notify scripts that use the shared palette
function commitColorStyleChanges() {
    saveSettings();
    updateHighlightStyles();
    window.dispatchEvent(new Event("amq:highlight-friends-changed"));
}

// Keep group details read-only while allowing quick enable toggles
function renderCustomColorRows() {
    const $container = $("#hfCustomColorRows").empty();
    customColors.forEach((group, index) => {
        const $enabledControl = createGameCheckbox("hfCustomEnabledCheckbox" + index, "", { "data-group-enabled": "" });
        $enabledControl.find("input").prop("checked", group.enabled);
        const $row = $("<tr>", { class: "hfCustomColorRow", "data-color": index }).append(
            $("<td>").append($enabledControl),
            $("<td>", { class: "hfCustomNameCell", text: group.name }),
            $("<td>", { class: "hfCustomPlayersCell", text: group.players.join(", ") || "No players" }),
            $("<td>").append(createColorSwatch(group.color)),
            $("<td>").append(createColorSwatch(group.shadow)),
            $("<td>").append(
                $("<button>", { type: "button", class: "btn btn-default btn-sm", "data-action": "edit-color" })
                    .append($("<i>", { class: "fa fa-pencil", "aria-hidden": "true" }), " Edit")
            )
        );
        $container.append($row);
    });
    $("#hfNoCustomColors").toggle(customColors.length === 0);
    $("#hfCustomColorTable").closest(".table-responsive").toggle(customColors.length > 0);
}

// Display saved colors as swatches and text instead of color picker inputs
function createColorSwatch(color) {
    return $("<span>", { class: "hfColorChip" }).append(
        $("<span>", { class: "hfColorSwatch" }).css("background-color", color),
        $("<span>", { class: "hfColorValue", text: color })
    );
}

// Copy saved values into a draft so editing cannot change active colors
function openCustomColorEditor(index = null) {
    const saved = index === null ? createCustomColorGroup() : customColors[index];
    customColorDraft = { index, group: { ...saved, players: [...saved.players] } };
    $("#hfCustomColorEditorTitle").text(index === null ? "Add custom color" : "Edit custom color");
    $("#hfCustomNameInput").val(customColorDraft.group.name);
    $("#hfCustomPlayersInput").val(customColorDraft.group.players.join(" "));
    $("#hfCustomColorInput").val(customColorDraft.group.color);
    $("#hfCustomShadowInput").val(customColorDraft.group.shadow);
    $("#hfDeleteCustomColorButton").toggle(index !== null);
    $("#hfCustomColorList").hide();
    $("#hfCustomColorEditor").show();
    $("#hfCustomNameInput").trigger("focus");
}

// Discard the draft and return to the group list
function closeCustomColorEditor() {
    customColorDraft = null;
    $("#hfCustomColorEditor").hide();
    $("#hfCustomColorList").show();
}

// Commit edited values once and rebuild membership only when the player list changes
function saveCustomColor() {
    const index = customColorDraft.index;
    const previous = index === null ? null : customColors[index];
    const group = {
        name: $("#hfCustomNameInput").val().trim() || "Custom group",
        enabled: previous === null ? true : previous.enabled,
        color: $("#hfCustomColorInput").val(),
        shadow: $("#hfCustomShadowInput").val(),
        players: $("#hfCustomPlayersInput").val().toLowerCase().split(/[\s,]+/).filter(Boolean)
    };
    const membershipChanged = previous === null
        || previous.players.length !== group.players.length
        || previous.players.some((name, playerIndex) => name !== group.players[playerIndex]);
    if (index === null) customColors.push(group);
    else customColors[index] = group;
    if (membershipChanged) {
        commitCustomColorChanges();
    }
    else {
        commitColorStyleChanges();
    }
    renderCustomColorRows();
    closeCustomColorEditor();
}

// Delete only the group explicitly opened in the editor
function deleteCustomColor() {
    customColors.splice(customColorDraft.index, 1);
    commitCustomColorChanges();
    renderCustomColorRows();
    closeCustomColorEditor();
}

// Keep relationship precedence consistent across names, avatars, chat, and scoreboards
function getRelationshipClass(name) {
    if (name === selfName) return "isSelf";
    if (socialTab.isFriend(name)) return "isFriend";
    if (socialTab.isBlocked(name)) return "isBlocked";
    return "";
}

// Look up only explicit group members, including names that match object prototype keys
function getCustomColorClass(name) {
    const key = name.toLowerCase();
    return Object.hasOwn(customColorMap, key) ? "customColor" + customColorMap[key] : "";
}

// Remove only the classes owned by this script
function removePlayerColorClasses(index, className) {
    return (className.match(colorClassRegex) || []).join(" ");
}

// Apply relationship and custom membership independently so custom CSS keeps priority
function applyPlayerClasses($element, name, relationship = getRelationshipClass(name)) {
    $element.removeClass(removePlayerColorClasses)
        .addClass(relationship).addClass(getCustomColorClass(name));
}

// Apply leaderboard-specific relationship names without replacing native rendering
function applyLeaderboardClasses($element, name) {
    const classNames = { isSelf: "self", isFriend: "friend", isBlocked: "blocked" };
    const relationship = classNames[getRelationshipClass(name)] ?? "";
    $element.removeClass("self friend blocked").removeClass(removePlayerColorClasses)
        .addClass(relationship).addClass(getCustomColorClass(name));
}

// Color scoreboard entries after the client has created them
function colorScorebox() {
    if (!quiz.inQuiz) return;
    for (const [playerId, entry] of Object.entries(quiz.scoreboard.playerEntries)) {
        const name = quiz.players[playerId]?._name ?? "";
        const relationship = entry.isSelf ? "isSelf" : getRelationshipClass(name);
        applyPlayerClasses(entry.$entry, name, relationship);
    }
}

// Keep avatar colors aligned with their current player names
function colorQuizPlayers() {
    if (!quiz.inQuiz) return;
    for (const player of Object.values(quiz.players)) {
        applyPlayerClasses(player.avatarSlot.$body, player._name);
    }
}

// Reconcile lobby slots after player and relationship changes
function colorLobbyPlayers() {
    if (!lobby.inLobby) return;
    for (const player of Object.values(lobby.players)) {
        applyPlayerClasses(player.lobbySlot.$LOBBY_SLOT, player._name);
    }
}

// Strip the suffix added by original-name scripts only for relationship checks
function getRelationshipName(displayName) {
    const suffixStart = displayName.indexOf("(");
    return suffixStart === -1 ? displayName : displayName.slice(0, suffixStart).trim();
}

// Preserve displayed-name handling for spectator rows
function colorSpectators() {
    if (!quiz.inQuiz && !lobby.inLobby) return;
    $(".gcSpectatorItem").each(function () {
        const $row = $(this);
        const name = $row.find("h3").text();
        applyPlayerClasses($row, name, getRelationshipClass(getRelationshipName(name)));
    });
}

// Check whether an enabled palette can supply this player's chat color
function hasChatHighlight(name) {
    if (!smColorChat) return false;
    const key = name.toLowerCase();
    if (Object.hasOwn(customColorMap, key) && customColors[customColorMap[key]].enabled) return true;
    switch (getRelationshipClass(name)) {
        case "isSelf": return smColorSelf;
        case "isFriend": return smColorFriend;
        case "isBlocked": return smColorBlocked;
        default: return false;
    }
}

// Resolve color priority independently of the original AMQ reward glow
function applyChatClasses($username, name) {
    const effects = $username.data("hfNameEffects");
    const highlightAvailable = hasChatHighlight(name);
    let useHighlight = false;
    let keepRewardColor = false;
    switch (chatNameColorMode) {
        case "preferHighlights":
            useHighlight = highlightAvailable;
            keepRewardColor = !highlightAvailable;
            break;
        case "preferAmq":
            useHighlight = !effects.color && highlightAvailable;
            keepRewardColor = true;
            break;
        case "highlightsOnly":
            useHighlight = highlightAvailable;
            break;
        case "amqOnly":
            keepRewardColor = true;
            break;
        case "plain":
            break;
    }
    applyPlayerClasses($username, name);
    $username.toggleClass(effects.color, keepRewardColor)
        .toggleClass(effects.glow, chatRewardGlowMode === "keep")
        .toggleClass("hfChatHighlight", useHighlight);
}

// Recolor regular and pinned usernames using their captured sender and reward classes
function colorExistingChatNames() {
    const selector = "#gcMessageContainer .gcUserName[data-hf-player-name], "
        + "#gcPinnedMessageContainer .gcUserName[data-hf-player-name]";
    $(selector).each(function () {
        applyChatClasses($(this), this.getAttribute("data-hf-player-name"));
    });
}

// Recolor leaderboard entries without rebuilding the native lists
function colorExistingLeaderboardNames() {
    $(".lbmBoardEntry[data-hf-player-name]").each(function () {
        applyLeaderboardClasses($(this), this.getAttribute("data-hf-player-name"));
    });
}

// Combine same-turn requests while waiting for native handlers to finish updating elements
function scheduleColorRefresh() {
    if (colorRefreshTimeoutId !== null) return;
    colorRefreshTimeoutId = setTimeout(refreshColors, 0);
}

// Reconcile membership classes without rebuilding any game-owned elements
function refreshColors() {
    clearTimeout(colorRefreshTimeoutId);
    colorRefreshTimeoutId = null;
    colorScorebox();
    colorLobbyPlayers();
    colorQuizPlayers();
    colorSpectators();
    colorExistingChatNames();
    colorExistingLeaderboardNames();
}

// Match spectator messages before join and departure messages
function getSystemMessageClass(title) {
    const categories = [
        ["hfChatSpec", ["game_chat.new_spectator_message", "game_chat.changed_to_spectator_message"]],
        ["hfChatJoin", ["game_chat.joined_room_message", "game_chat.changed_to_player_message"]],
        ["hfChatLeave", [
            "game_chat.stopped_spectating_message", "game_chat.left_room_message",
            "game_chat.kicked_message", "game_chat.disconnected_message"
        ]]
    ];
    for (const [className, messageKeys] of categories) {
        if (messageKeys.some(key => matchLocalizedSystemMessage(title, key))) return className;
    }
    return "";
}

// Match localized static fragments while allowing any player name in the placeholder
function matchLocalizedSystemMessage(title, messageKey) {
    const marker = "__HF_NAME__";
    const template = localizationHandler.translate(messageKey, { name: marker });
    if (!template || template === messageKey) return false;
    if (!template.includes(marker)) return title === template;
    let position = 0;
    for (const fragment of template.split(marker).filter(Boolean)) {
        const index = title.indexOf(fragment, position);
        if (index === -1) return false;
        position = index + fragment.length;
    }
    return true;
}

// Manage hotkey bindings, recording, and settings editor
class HotkeyController {
    static bindingTypes = { key: "string", ctrl: "boolean", alt: "boolean", shift: "boolean" };

    static normalizeKey(key) {
        const uppercase = key.toUpperCase();
        if ([...key].length === 1 && [...uppercase].length !== 1) return key;
        return uppercase;
    }

    // Keep valid fields and silently replace invalid values with defaults
    static normalizeBinding(value, fallback = { key: "", ctrl: false, alt: false, shift: false }) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return { ...fallback };
        }

        const binding = {};
        for (const [field, type] of Object.entries(HotkeyController.bindingTypes)) {
            const savedValue = value[field];
            if (typeof savedValue !== type) {
                binding[field] = fallback[field];
                continue;
            }
            binding[field] = field === "key" ? HotkeyController.normalizeKey(savedValue) : savedValue;
        }
        return binding;
    }

    // Restore known actions and discard unrecognized saved entries
    static normalizeBindings(value, defaults) {
        const bindings = {};
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            value = {};
        }
        for (const [action, fallback] of Object.entries(defaults)) {
            bindings[action] = HotkeyController.normalizeBinding(value[action], fallback);
        }
        return bindings;
    }

    static getDefaults(actions) {
        const defaults = {};
        for (const [action, definition] of Object.entries(actions)) {
            defaults[action] = HotkeyController.normalizeBinding(definition.defaultBinding);
        }
        return defaults;
    }

    constructor({ actions, savedBindings, onChange }) {
        this.actions = actions;
        this.entries = Object.entries(actions);
        this.onChange = onChange;
        this.defaults = HotkeyController.getDefaults(actions);
        this.editors = new Map();
        this.recording = null;

        this.bindings = HotkeyController.normalizeBindings(savedBindings, this.defaults);
    }

    formatBinding(binding) {
        if (!binding.key) return "";
        const parts = [];
        if (binding.ctrl) parts.push("CTRL");
        if (binding.alt) parts.push("ALT");
        if (binding.shift) parts.push("SHIFT");
        parts.push(binding.key === " " ? "SPACE" : binding.key);
        return parts.join(" + ");
    }

    isSupportedEvent(event) {
        if (!event.key || event.metaKey || event.isComposing || event.getModifierState("AltGraph")) return false;
        const key = HotkeyController.normalizeKey(event.key);
        return !["SHIFT", "CONTROL", "ALT", "META", "ALTGRAPH", "DEAD", "PROCESS", "UNIDENTIFIED"].includes(key);
    }

    start() {
        document.addEventListener("keydown", this.handleKeydown);
    }

    destroy() {
        this.cancelRecording();
        document.removeEventListener("keydown", this.handleKeydown);
        this.editors.clear();
    }

    setBindings(value) {
        const imported = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        this.stopRecording();

        for (const [action] of this.entries) {
            this.bindings[action] = Object.hasOwn(imported, action)
                ? HotkeyController.normalizeBinding(imported[action])
                : { ...this.defaults[action] };
        }
        this.refreshEditors();
    }

    handleKeydown = event => {
        if (this.recording || !this.isSupportedEvent(event)) return;
        const key = HotkeyController.normalizeKey(event.key);

        // All matches intentionally run, including while typing and on repeated keydowns
        for (const [action, definition] of this.entries) {
            const binding = this.bindings[action];
            if (!binding.key || binding.key !== key) continue;
            if (binding.ctrl !== event.ctrlKey) continue;
            if (binding.alt !== event.altKey) continue;
            if (binding.shift !== event.shiftKey) continue;
            if (definition.enabled && !definition.enabled()) continue;

            event.preventDefault();
            definition.run();
        }
    };

    refreshEditors() {
        for (const [action, editor] of this.editors) {
            const text = this.formatBinding(this.bindings[action]);
            editor.button.textContent = text || "—";
            editor.button.classList.remove("recording");
            editor.button.classList.toggle("unset", !this.bindings[action].key);
            editor.clear.hidden = !this.bindings[action].key;
        }
    }

    stopRecording() {
        if (!this.recording) return false;
        document.removeEventListener("keydown", this.captureKeydown, true);
        this.recording.button.removeEventListener("blur", this.cancelRecording);
        window.removeEventListener("blur", this.cancelRecording);
        this.recording = null;
        return true;
    }

    cancelRecording = () => {
        if (this.stopRecording()) this.refreshEditors();
    };

    commitBinding(action, binding) {
        this.stopRecording();
        this.bindings[action] = binding;
        this.refreshEditors();
        this.onChange();
    }

    captureKeydown = event => {
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        event.preventDefault();

        const unmodified = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
        if (unmodified && event.key === "Escape") {
            this.cancelRecording();
            return;
        }
        if (unmodified && ["Delete", "Backspace"].includes(event.key)) {
            this.commitBinding(this.recording.action, HotkeyController.normalizeBinding());
            return;
        }
        if (!this.isSupportedEvent(event)) return;

        this.commitBinding(this.recording.action, {
            key: HotkeyController.normalizeKey(event.key),
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey
        });
    };

    startRecording(action) {
        this.cancelRecording();
        const editor = this.editors.get(action);
        this.recording = { action, button: editor.button };
        editor.button.focus();
        editor.button.classList.remove("unset");
        editor.button.classList.add("recording");
        editor.button.textContent = "Press keys…";
        editor.button.addEventListener("blur", this.cancelRecording);
        window.addEventListener("blur", this.cancelRecording);
        document.addEventListener("keydown", this.captureKeydown, true);
    }

    renderTable(tbody) {
        this.stopRecording();
        this.editors.clear();
        tbody.replaceChildren();

        for (const [action, definition] of this.entries) {
            const row = document.createElement("tr");
            const label = document.createElement("td");
            label.textContent = definition.label;
            const controls = document.createElement("td");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "hk-input";
            button.dataset.hotkeyAction = action;
            button.addEventListener("click", () => this.startRecording(action));

            const clear = document.createElement("button");
            clear.type = "button";
            clear.className = "hk-clear";
            clear.title = "Clear shortcut";
            clear.addEventListener("click", () => this.commitBinding(action, HotkeyController.normalizeBinding()));

            const icon = document.createElement("i");
            icon.className = "fa fa-trash";
            icon.setAttribute("aria-hidden", "true");
            clear.append(icon);

            controls.append(button, clear);
            row.append(label, controls);
            tbody.append(row);
            this.editors.set(action, { button, clear });
        }
        this.refreshEditors();
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

// Provide one source for initial preferences and palette resets
function getDefaultSettings() {
    return {
        smColorSelfColor: "#80c7ff",
        smColorSelfShadow: "#228dff",
        smColorFriendColor: "#80ff80",
        smColorFriendShadow: "#40ff40",
        smColorBlockedColor: "#ff8080",
        smColorBlockedShadow: "#ff4343",
        smColorJoinColor: "#8080ff",
        smColorSpecColor: "#ffff80",
        smColorLeaveColor: "#ff8080",
        smColorSelf: true,
        smColorFriend: true,
        smColorBlocked: true,
        smColorScorebox: true,
        smColorName: true,
        smColorPoint: true,
        smColorLevel: true,
        smColorChat: true,
        smColorLeaderboard: true,
        smColorJoin: true,
        smColorSpec: true,
        smColorLeave: true,
        chatNameColorMode: "preferHighlights",
        chatRewardGlowMode: "keep",
        summaryTimeUnit: "seconds",
        summaryAnswerAppendTime: false,
        summaryColumns: { rank: true, score: true, name: true, box: true, answer: true, time: false },
        customColors: [],
    };
}

// Load validated preferences without changing runtime state
function loadSettings() {
    const settings = getDefaultSettings();
    const savedSettings = readStorageObject("highlightFriendsSettings");

    for (const key of [
        "smColorSelfColor", "smColorSelfShadow",
        "smColorFriendColor", "smColorFriendShadow",
        "smColorBlockedColor", "smColorBlockedShadow",
        "smColorJoinColor", "smColorSpecColor", "smColorLeaveColor"
    ]) {
        if (typeof savedSettings[key] === "string") settings[key] = savedSettings[key];
    }
    for (const key of [
        "smColorSelf", "smColorFriend", "smColorBlocked",
        "smColorScorebox", "smColorName", "smColorPoint",
        "smColorLevel", "smColorChat", "smColorLeaderboard",
        "smColorJoin", "smColorSpec", "smColorLeave",
        "summaryAnswerAppendTime"
    ]) {
        if (typeof savedSettings[key] === "boolean") settings[key] = savedSettings[key];
    }
    const savedChatColorMode = savedSettings.chatNameColorMode;
    if (typeof savedChatColorMode === "string" && Object.hasOwn(chatNameColorModes, savedChatColorMode)) {
        settings.chatNameColorMode = savedChatColorMode;
    }
    const savedChatGlowMode = savedSettings.chatRewardGlowMode;
    if (typeof savedChatGlowMode === "string" && Object.hasOwn(chatRewardGlowModes, savedChatGlowMode)) {
        settings.chatRewardGlowMode = savedChatGlowMode;
    }
    if (["seconds", "milliseconds"].includes(savedSettings.summaryTimeUnit)) {
        settings.summaryTimeUnit = savedSettings.summaryTimeUnit;
    }
    const savedColumns = savedSettings.summaryColumns;
    if (savedColumns && typeof savedColumns === "object" && !Array.isArray(savedColumns)) {
        for (const key of Object.keys(settings.summaryColumns)) {
            if (typeof savedColumns[key] === "boolean") settings.summaryColumns[key] = savedColumns[key];
        }
    }
    settings.customColors = normalizeCustomColors(savedSettings.customColors);
    settings.hotKeys = savedSettings.hotKeys;
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
            name: typeof group.name === "string" && group.name.trim() ? group.name.trim() : "Custom group",
            enabled: typeof group.enabled === "boolean" ? group.enabled : true,
            color: typeof group.color === "string" ? group.color : "#80c7ff",
            shadow: typeof group.shadow === "string" ? group.shadow : "#228dff",
            players
        });
    }
    return colors;
}

// Collect individual persisted globals for saving and control rendering
function getSettingsData() {
    return {
        smColorSelfColor,
        smColorSelfShadow,
        smColorFriendColor,
        smColorFriendShadow,
        smColorBlockedColor,
        smColorBlockedShadow,
        smColorJoinColor,
        smColorSpecColor,
        smColorLeaveColor,
        smColorSelf,
        smColorFriend,
        smColorBlocked,
        smColorScorebox,
        smColorName,
        smColorPoint,
        smColorLevel,
        smColorChat,
        smColorLeaderboard,
        smColorJoin,
        smColorSpec,
        smColorLeave,
        chatNameColorMode,
        chatRewardGlowMode,
        customColors,
        hotKeys,
        summaryColumns,
        summaryTimeUnit,
        summaryAnswerAppendTime
    };
}

// Save the current preferences and custom groups
function saveSettings() {
    localStorage.setItem("highlightFriendsSettings", JSON.stringify(getSettingsData()));
}

// Install layout once using AMQ tabs, checkboxes, and Bootstrap form controls
function applyStyles() {
    const style = document.createElement("style");
    style.id = "highlightFriendsStyle";
    style.textContent = /*css*/`
        #hfSummaryWindow .modal-header {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #hfSummaryWindow .modal-header h2 {
            margin: 0;
        }
        #hfSummaryWindow .hfHeaderActions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto;
        }
        #hfSummaryWindow .hfIconButton {
            padding: 0;
            border: 0;
            background: transparent;
            color: inherit;
            font: inherit;
            line-height: 1;
            cursor: pointer;
        }
        #hfSummaryWindow .hfHeaderActions .hfIconButton {
            font-size: 22px;
        }
        #hfSummaryWindow .hfHeaderActions .hfCloseButton {
            font-size: 25px;
        }
        #hfSummaryWindow .hfIconButton:hover {
            opacity: 0.7;
        }
        #hfSummaryTableContainer {
            padding: 10px;
        }
        #hfSummaryTable th,
        #hfSummaryTable td {
            border: 1px solid black;
            text-align: center;
            vertical-align: middle;
            padding: 0;
        }
        #hfSummaryTable th {
            font-weight: bold;
        }
        #hfSummaryTable .hfSummaryRow {
            height: 30px;
        }
        #hfSummaryTable .hfSummaryRank,
        #hfSummaryTable .hfSummaryScore,
        #hfSummaryTable .hfSummaryBox {
            min-width: 40px;
        }
        #hfSummaryTable .hfSummaryName,
        #hfSummaryTable .hfSummaryAnswer {
            min-width: 80px;
        }
        #hfSummaryTable .hfSummaryTime {
            min-width: 55px;
        }
        #hfSummaryTable .correctGuess {
            background-color: rgba(0, 200, 0, 0.07);
        }
        #hfSummaryTable .incorrectGuess {
            background-color: rgba(255, 0, 0, 0.07);
        }
        #hfSummarySettings h3 {
            margin: 0 0 8px;
            font-size: 14px;
            font-weight: bold;
        }
        #hfSummaryWindow .hfSettingsRow,
        #hfSummaryWindow .hfCheckboxRow {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }
        #hfSummaryWindow .hfSettingsRow {
            margin-bottom: 20px;
        }
        #hfSummaryWindow .hfCheckbox {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }
        #hfSummaryWindow input[type="checkbox"] {
            width: 15px;
            height: 15px;
            margin: 0;
        }
        #hfSummaryTimeUnitSelect {
            color: black;
        }
        #hfSummaryButton {
            width: 30px;
            height: 100%;
            margin-right: 5px;
        }
        #settingsGraphicContainer .hfGraphicsSettings {
            padding-top: 10px;
        }
        #hfSettingsTitle {
            margin: 0;
            padding: 0;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            cursor: pointer;
        }
        #hfSettingsContent {
            margin: 0;
            padding: 5px 0 0;
        }
        #hfSettings #hfInfoTab {
            width: 45px;
        }
        #hfSettings .tabSection {
            padding-top: 5px;
        }
        #hfInfoContainer .hfInfoColumns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: start;
            gap: 15px;
        }
        #hfInfoContainer h4 {
            margin: 0 0 5px;
        }
        #hfInfoContainer .hfSettingsActions {
            justify-content: flex-end;
        }
        #hfSettings .hfSectionLabel {
            margin-bottom: 5px;
            font-weight: bold;
        }
        #hfSettings .hfCheckboxRow {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px 16px;
            margin-bottom: 15px;
        }
        #hfSettings .hfGameCheckbox {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        #hfSettings .hfGameCheckbox > label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }
        #hfSettings .hfGameCheckbox .customCheckbox {
            flex: none;
        }
        #hfSettings .hfSettingsTable {
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        #hfSettings .hfSettingsTable th {
            font-weight: bold;
        }
        #hfSettings .hfSettingsTable th,
        #hfSettings .hfSettingsTable td {
            padding: 2px 12px 2px 0;
            vertical-align: middle;
        }
        #hfSettings .form-control,
        #hfSettings .btn-default {
            color: black;
        }
        #hfSettings .hfColorInput {
            width: 60px;
            padding: 3px;
        }
        #hfPaletteTable .hfColorInput,
        #hfActivityPaletteTable .hfColorInput {
            height: 26px;
            padding: 2px;
        }
        #hfSettings .hfSettingsHint {
            margin: 0 0 15px;
            font-size: 12px;
            opacity: 0.85;
        }
        #hfSettings .hfSettingsToolbar,
        #hfSettings .hfEditorActions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 12px;
        }
        #hfSettings .hfSettingsActions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
        }
        #hfSettings .hfEditorActions {
            margin-top: 15px;
        }
        #hfCustomColorTable {
            width: 100%;
        }
        #hfCustomColorTable .hfCustomNameCell {
            min-width: 100px;
            max-width: 180px;
            overflow-wrap: anywhere;
        }
        #hfCustomColorTable .hfCustomPlayersCell {
            width: 100%;
            min-width: 140px;
            overflow-wrap: anywhere;
        }
        #hfSettings .hfColorChip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        #hfSettings .hfColorSwatch {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 1px solid currentColor;
        }
        #hfSettings .hfColorValue {
            font-family: monospace;
        }
        #hfCustomColorEditor .hfCustomColorFields {
            display: flex;
            gap: 15px;
        }
        #hfCustomColorEditor .hfCustomNameField {
            flex: 1;
            min-width: 0;
        }
        #hfCustomColorEditor textarea {
            resize: vertical;
        }
        #hfHotkeyTable th,
        #hfHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #hfHotkeyTable button.hk-clear {
            margin-left: 6px;
            padding: 0;
            border: 0;
            background: transparent;
            box-shadow: none;
            color: inherit;
            cursor: pointer;
        }
        #hfHotkeyTable button.hk-clear:hover {
            opacity: 0.7;
        }
        #hfHotkeyTable button.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
        }
        #hfHotkeyTable button.hk-input.unset {
            color: gray;
        }
    `;
    document.head.appendChild(style);
    colorStyleElement = document.createElement("style");
    colorStyleElement.id = "highlightFriendsStyle";
    document.head.appendChild(colorStyleElement);
    updateHighlightStyles();
}

// Rebuild only rules affected by highlight preferences or custom groups
function updateHighlightStyles() {
    const rules = [];
    const systemColors = [
        { enabled: smColorJoin, className: "hfChatJoin", color: smColorJoinColor },
        { enabled: smColorSpec, className: "hfChatSpec", color: smColorSpecColor },
        { enabled: smColorLeave, className: "hfChatLeave", color: smColorLeaveColor }
    ];
    for (const item of systemColors) {
        if (!item.enabled) continue;
        rules.push("." + item.className + " { color: " + item.color + "; }");
    }
    const relationships = [
        { enabled: smColorSelf, className: "isSelf", leaderboardClass: "self", color: smColorSelfColor, shadow: smColorSelfShadow },
        { enabled: smColorFriend, className: "isFriend", leaderboardClass: "friend", color: smColorFriendColor, shadow: smColorFriendShadow },
        { enabled: smColorBlocked, className: "isBlocked", leaderboardClass: "blocked", color: smColorBlockedColor, shadow: smColorBlockedShadow }
    ];
    for (const group of relationships) {
        if (!group.enabled) continue;
        rules.push(createPlayerColorRules(group.className, group.color, group.shadow, group.leaderboardClass));
    }
    customColors.forEach((group, index) => {
        if (!group.enabled) return;
        rules.push(createPlayerColorRules("customColor" + index, group.color, group.shadow));
    });
    colorStyleElement.textContent = rules.join("\n");
}

// Generate one set of selectors for both relationship and custom palettes
function createPlayerColorRules(className, color, shadow, leaderboardClass = className) {
    const rules = [];
    if (smColorScorebox) rules.push(`
        .qpStandingItem.${className} .qpsPlayerName {
            color: ${color};
            text-shadow: 0 0 10px ${shadow};
        }
    `);
    if (smColorName) rules.push(`
        .lobbyAvatar.${className} .lobbyAvatarNameContainerInner > h2,
        .qpAvatarContainerOuter.${className} .qpAvatarName {
            color: ${color};
        }
    `);
    if (smColorLevel) rules.push(`
        .qpAvatarContainerOuter.${className} .qpAvatarLevel { color: ${color}; }
    `);
    if (smColorPoint) rules.push(`
        .qpAvatarContainerOuter.${className} .qpAvatarScore { color: ${color}; }
    `);
    if (smColorChat) rules.push(`
        #gcMessageContainer .gcUserName.hfChatHighlight.${className},
        #gcPinnedMessageContainer .gcUserName.hfChatHighlight.${className},
        .gcSpectatorItem.${className} h3 {
            color: ${color};
        }
    `);
    if (smColorLeaderboard) rules.push(`
        li.lbmBoardEntry.${leaderboardClass} .lmbEntryText { color: ${color}; }
    `);
    return rules.join("\n");
}

startScript();
