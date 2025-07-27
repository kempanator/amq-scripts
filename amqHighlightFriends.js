// ==UserScript==
// @name         AMQ Highlight Friends
// @namespace    https://github.com/kempanator
// @version      2.1
// @description  Apply color to name of yourself and friends. and more
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
- custom colors
- change mode and sort columns in summary table
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const largeRooms = ["Ranked", "Themed", "Event", "Jam"]; // gamemodes for friend view
const saveData = validateLocalStorage("highlightFriendsSettings");
const colorClassRegex = /(isSelf|isFriend|isBlocked|customColor\d+)/g;
let smColorSelfColor = saveData.smColorSelfColor ?? "#80c7ff";
let smColorSelfShadow = saveData.smColorSelfShadow ?? "#228dff";
let smColorFriendColor = saveData.smColorFriendColor ?? "#80ff80";
let smColorFriendShadow = saveData.smColorFriendShadow ?? "#40ff40";
let smColorBlockedColor = saveData.smColorBlockedColor ?? "#ff8080";
let smColorBlockedShadow = saveData.smColorBlockedShadow ?? "#ff4343";
let smColorJoinColor = saveData.smColorJoinColor ?? "#8080ff";
let smColorSpecColor = saveData.smColorSpecColor ?? "#ffff80";
let smColorLeaveColor = saveData.smColorLeaveColor ?? "#ff8080";
let smColorSelf = saveData.smColorSelf ?? true;
let smColorFriend = saveData.smColorFriend ?? true;
let smColorBlocked = saveData.smColorBlocked ?? true;
let smColorScorebox = saveData.smColorScorebox ?? true;
let smColorName = saveData.smColorName ?? true;
let smColorPoint = saveData.smColorPoint ?? true;
let smColorLevel = saveData.smColorLevel ?? true;
let smColorChat = saveData.smColorChat ?? true;
let smColorLeaderboard = saveData.smColorLeaderboard ?? true;
let smColorJoin = saveData.smColorJoin ?? true;
let smColorSpec = saveData.smColorSpec ?? true;
let smColorLeave = saveData.smColorLeave ?? true;
let smRemoveColor = saveData.smRemoveColor ?? false;
let smRemoveGlow = saveData.smRemoveGlow ?? false;
let smOverrideRankedColor = saveData.smOverrideRankedColor ?? false;
let tableFriendsOnly = false;
let tableSort = { mode: "position", ascending: true }; //position, name, answer
let answerResults = {};
let playerSummaryWindow;
let $playerSummaryTable;
let playerSummaryRows = [];
let customColors = saveData.customColors ?? [];
let customColorMap = {};
let hotKeys = {
    hfWindow: loadHotkey("hfWindow", "SCROLLLOCK"),
    toggleCustomColors: loadHotkey("toggleCustomColors")
}
customColors.forEach((item, index) => {
    for (const player of item.players) {
        customColorMap[player] = index;
    }
});

// setup listeners and summary window
function setup() {
    new Listener("Join Game", (data) => {
        if (!data.error && data.quizState && data.quizState.state !== quiz.QUIZ_STATES.BATTLE_ROYAL) {
            tableFriendsOnly = largeRooms.includes(data.settings.gameMode);
            answerResults = data.quizState;
            createSummaryTable();
        }
    }).bindListener();

    new Listener("Spectate Game", (data) => {
        if (!data.error && data.quizState && data.quizState.state !== quiz.QUIZ_STATES.BATTLE_ROYAL) {
            tableFriendsOnly = largeRooms.includes(data.settings.gameMode);
            answerResults = data.quizState;
            createSummaryTable();
        }
    }).bindListener();

    new Listener("New Player", () => {
        colorLobbyPlayers();
    }).bindListener();

    new Listener("Spectator Change To Player", () => {
        colorLobbyPlayers();
    }).bindListener();

    new Listener("New Spectator", () => {
        colorSpectators();
    }).bindListener();

    new Listener("Player Changed To Spectator", () => {
        colorSpectators();
    }).bindListener();

    new Listener("Game Starting", (data) => {
        tableFriendsOnly = largeRooms.includes(data.gameMode);
        answerResults = data;
        createSummaryTable();
    }).bindListener();

    new Listener("player late join", () => {
        setTimeout(() => {
            refreshColors();
        }, 0);
    }).bindListener();

    new Listener("Jam Game Restarting", () => {
        setTimeout(() => {
            refreshColors();
        }, 0);
    }).bindListener();

    new Listener("answer results", (data) => {
        setTimeout(() => {
            if (data.lateJoinPlayers) {
                refreshColors();
            }
            answerResults = JSON.parse(JSON.stringify(data));
            createSummaryTable();
        }, 0);
    }).bindListener();

    new Listener("Game Chat Message", (data) => {
        updateChatMessage(data);
    }).bindListener();

    new Listener("game chat update", (data) => {
        data.messages.forEach(message => {
            updateChatMessage(message);
        });
    }).bindListener();

    new Listener("new friend", () => {
        setTimeout(() => {
            refreshColors();
        }, 0);
    }).bindListener();

    new Listener("friend removed", () => {
        setTimeout(() => {
            refreshColors();
            createSummaryTable();
        }, 0);
    }).bindListener();

    new Listener("friend name change", (data) => {
        for (const item of Object.values(customColors)) {
            const index = item.players.indexOf(data.oldName.toLowerCase());
            if (index !== -1) {
                item.players[index] = data.newName.toLowerCase();
            }
        }
        setTimeout(() => {
            saveSettings();
            buildCustomColorList();
            refreshColors();
            createSummaryTable();
        }, 0);
    }).bindListener();

    playerSummaryWindow = new AMQWindow({
        id: "playerSummaryWindow",
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
        id: "playerSummaryWindowTableContainer",
        width: 1.0,
        height: "calc(100%)",
        scrollable: { x: false, y: true }
    });

    $playerSummaryTable = $("<table>", { id: "playerSummaryWindowTable", class: "table floatingContainer" })
        .append($("<tr>", { class: "header clickAble" })
            .append($("<td>", { class: "fstRank", text: "Rank", "data-sort": "position" }))
            .append($("<td>", { class: "fstScore", text: "Score", "data-sort": "position" }))
            .append($("<td>", { class: "fstName", text: "Name", "data-sort": "name" }))
            .append($("<td>", { class: "fstBox", text: "Box", "data-sort": "position" }))
            .append($("<td>", { class: "fstAnswer", text: "Last Answer", "data-sort": "answer" }))
        ).on("click", "td", (event) => {
            const $cell = $(event.currentTarget);
            const $row = $cell.parent();
            if ($row.hasClass("header")) {
                tableSortChange($cell.data("sort"));
                sortSummaryTableRows();
            }
            else {
                const box = $row.find(".fstBox").text();
                if (box) selectAvatarGroup(box);
            }
        });

    playerSummaryWindow.panels[0].panel.append($playerSummaryTable);
    playerSummaryWindow.window.find(".close").remove();
    playerSummaryWindow.window.find(".modal-header")
        .prepend($("<i>", { class: "fa fa-table clickAble", "aria-hidden": "true", style: "font-size: 22px; float: right; margin: 3px 5px 0 0;" })
            .on("click", () => {
                tableFriendsOnly = !tableFriendsOnly;
                createSummaryTable();
            }))
        .prepend($("<i>", { class: "fa fa-times clickAble", "aria-hidden": "true", style: "font-size: 25px; float: right;" })
            .on("click", () => {
                playerSummaryWindow.close();
            }));

    $("#settingsGraphicContainer").append(`
        <div class="row" style="padding-top: 10px">
            <div id="smColorSettings" class="col-xs-12">
                <div style="text-align: center"><label>ColorSettings</label></div>
                <div id="smColorContainer"></div>
            </div>
        </div>
    `);

    $("#smColorContainer")
        .append($("<div>", { style: "margin-bottom: 10px;" })
            .append("<span>Scorebox</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smColorScorebox", type: "checkbox", checked: smColorScorebox })
                    .on("click", function () {
                        smColorScorebox = !smColorScorebox;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorScorebox"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Name</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smColorName", type: "checkbox", checked: smColorName })
                    .on("click", function () {
                        smColorName = !smColorName;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorName"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Point</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smColorPoint", type: "checkbox", checked: smColorPoint })
                    .on("click", function () {
                        smColorPoint = !smColorPoint;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorPoint"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Level</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smColorLevel", type: "checkbox", checked: smColorLevel })
                    .on("click", function () {
                        smColorLevel = !smColorLevel;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorLevel"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Chat</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smColorChat", type: "checkbox", checked: smColorChat })
                    .on("click", function () {
                        smColorChat = !smColorChat;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorChat"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Leaderboard</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 0 0 4px;" })
                .append($("<input>", { id: "smColorLeaderboard", type: "checkbox", checked: smColorLeaderboard })
                    .on("click", function () {
                        smColorLeaderboard = !smColorLeaderboard;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorLeaderboard"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
        )
        .append($("<div>")
            .append("<span>Remove Reward Color</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smRemoveColor", type: "checkbox", checked: smRemoveColor })
                    .on("click", function () {
                        smRemoveColor = !smRemoveColor;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smRemoveColor"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Remove Reward Glow</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 15px 0 4px;" })
                .append($("<input>", { id: "smRemoveGlow", type: "checkbox", checked: smRemoveGlow })
                    .on("click", function () {
                        smRemoveGlow = !smRemoveGlow;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smRemoveGlow"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append("<span>Override</span>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 0 0 4px;" })
                .append($("<input>", { id: "smOverrideRankedColor", type: "checkbox", checked: smOverrideRankedColor })
                    .on("click", function () {
                        smOverrideRankedColor = !smOverrideRankedColor;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smOverrideRankedColor"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
        )
        .append($("<div>")
            .append(`<span style="margin-left: 88px;">Color</span>`)
            .append(`<span style="margin-left: 27px;">Shadow</span>`)
        )
        .append($("<div>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 0;" })
                .append($("<input>", { id: "smColorSelf", type: "checkbox", checked: smColorSelf })
                    .on("click", function () {
                        smColorSelf = !smColorSelf;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorSelf"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 60px; display: inline-block;">Self</span>`)
            .append($("<input>", { id: "smColorSelfColor", type: "color" })
                .val(smColorSelfColor)
                .on("change", function () {
                    smColorSelfColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<input>", { id: "smColorSelfShadow", type: "color", style: "margin-left: 10px;" })
                .val(smColorSelfShadow)
                .on("change", function () {
                    smColorSelfShadow = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 50px;" })
                .append($("<input>", { id: "smColorJoin", type: "checkbox", checked: smColorJoin })
                    .on("click", function () {
                        smColorJoin = !smColorJoin;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorJoin"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 47px; display: inline-block;">Join</span>`)
            .append($("<input>", { id: "smColorJoinColor", type: "color" })
                .val(smColorJoinColor)
                .on("change", function () {
                    smColorJoinColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
        )
        .append($("<div>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 0;" })
                .append($("<input>", { id: "smColorFriend", type: "checkbox", checked: smColorFriend })
                    .on("click", function () {
                        smColorFriend = !smColorFriend;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorFriend"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 60px; display: inline-block;">Friend</span>`)
            .append($("<input>", { id: "smColorFriendColor", type: "color" })
                .val(smColorFriendColor)
                .on("change", function () {
                    smColorFriendColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<input>", { id: "smColorFriendShadow", type: "color", style: "margin-left: 10px;" })
                .val(smColorFriendShadow)
                .on("change", function () {
                    smColorFriendShadow = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 50px;" })
                .append($("<input>", { id: "smColorSpec", type: "checkbox", checked: smColorSpec })
                    .on("click", function () {
                        smColorSpec = !smColorSpec;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorSpec"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 47px; display: inline-block;">Spec</span>`)
            .append($("<input>", { id: "smColorSpecColor", type: "color" })
                .val(smColorSpecColor)
                .on("change", function () {
                    smColorSpecColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
        )
        .append($("<div>")
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 0;" })
                .append($("<input>", { id: "smColorBlocked", type: "checkbox", checked: smColorBlocked })
                    .on("click", function () {
                        smColorBlocked = !smColorBlocked;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorBlocked"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 60px; display: inline-block;">Blocked</span>`)
            .append($("<input>", { id: "smColorBlockedColor", type: "color" })
                .val(smColorBlockedColor)
                .on("change", function () {
                    smColorBlockedColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<input>", { id: "smColorBlockedShadow", type: "color", style: "margin-left: 10px;" })
                .val(smColorBlockedShadow)
                .on("change", function () {
                    smColorBlockedShadow = this.value;
                    saveSettings();
                    applyStyles();
                }))
            .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 50px;" })
                .append($("<input>", { id: "smColorLeave", type: "checkbox", checked: smColorLeave })
                    .on("click", function () {
                        smColorLeave = !smColorLeave;
                        saveSettings();
                        applyStyles();
                    }))
                .append(`<label for="smColorLeave"><i class="fa fa-check" aria-hidden="true"></i></label>`)
            )
            .append(`<span style="width: 47px; display: inline-block;">Leave</span>`)
            .append($("<input>", { id: "smColorLeaveColor", type: "color" })
                .val(smColorLeaveColor)
                .on("change", function () {
                    smColorLeaveColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
        )
        .append($("<div>", { id: "smCustomColors" }))
        .append($("<button>", { text: "+", style: "color: black;" }).on("click", () => {
            customColors.push({ enabled: true, color: "#80c7ff", shadow: "#228dff", players: [] });
            buildCustomColorList();
        }))
        .append($("<button>", { text: "Reset", style: "color: black;" }).on("click", () => {
            messageDisplayer.displayMessage("not implemented yet");
        }));

    $("#qpOptionContainer")
        .width((i, w) => w + 35)
        .children("div")
        .append($("<div>", { id: "qpPlayerSummaryButton", class: "clickAble qpOption" })
            .append(`<i class="fa fa-users qpMenuItem" aria-hidden="true"></i>`)
            .click(() => {
                playerSummaryWindow.isVisible() ? playerSummaryWindow.close() : playerSummaryWindow.open();
            })
            .popover({
                placement: "bottom",
                content: "Player Summary",
                trigger: "hover"
            })
        );

    const hotkeyActions = {
        hfWindow: () => {
            playerSummaryWindow.isVisible() ? playerSummaryWindow.close() : playerSummaryWindow.open();
        },
        toggleCustomColors: () => {
            for (const item of Object.values(customColors)) {
                item.enabled = !item.enabled;
            }
            $(".hfCustomColorRow input[type='checkbox']").prop("checked", x => !x);
            saveSettings();
            applyStyles();
        }
    };

    document.addEventListener("keydown", (event) => {
        const key = event.key.toUpperCase();
        const ctrl = event.ctrlKey;
        const alt = event.altKey;
        const shift = event.shiftKey;
        const match = (b) => {
            if (!b.key) return false;
            if (key !== b.key) return false;
            if (ctrl !== b.ctrl) return false;
            if (alt !== b.alt) return false;
            if (shift !== b.shift) return false;
            return true;
        }
        for (const [action, bind] of Object.entries(hotKeys)) {
            if (match(bind)) {
                event.preventDefault();
                hotkeyActions[action]();
            }
        }
    });

    applyStyles();
    buildCustomColorList();
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

// create summary table
function createSummaryTable() {
    $playerSummaryTable.find("tr:not(.header)").remove();
    playerSummaryWindow.setTitle(tableFriendsOnly ? "Friend Summary" : "Player Summary");
    playerSummaryRows = [];
    if (!Object.keys(answerResults).length) return;
    for (const player of answerResults.players) {
        const name = player.name ?? quiz.players[player.gamePlayerId]._name ?? "";
        const answer = player.answer ?? (quiz.players ? quiz.players[player.gamePlayerId].avatarSlot.$answerContainerText.text() : "");
        if (player.name === undefined) player.name = name;
        if (player.answer === undefined) player.answer = answer;
        if (name && (!tableFriendsOnly || name === selfName || socialTab.isFriend(name))) {
            const row = {
                name: name,
                gamePlayerId: player.gamePlayerId,
                rank: player.position ?? "",
                score: player.correctGuesses ?? player.score ?? "",
                box: findBoxById(player.gamePlayerId, answerResults.groupMap ?? answerResults.groupSlotMap),
                answer: answer,
                correct: player.correct
            };
            row.$row = $("<tr>", { id: `friendScore${player.gamePlayerId}`, class: "friendScore clickAble" })
                .addClass(player.correct ? "correctGuess" : (player.correct === undefined ? "" : "incorrectGuess"))
                .append($("<td>", { class: "fstRank", text: row.rank }))
                .append($("<td>", { class: "fstScore", text: row.score }))
                .append($("<td>", { class: "fstName", text: row.name }))
                .append($("<td>", { class: "fstBox", text: row.box }))
                .append($("<td>", { class: "fstAnswer", text: row.answer }))
            playerSummaryRows.push(row);
        }
    }
    sortSummaryTableRows();
}

// used for sorting table contents when you click a header
function tableSortChange(mode) {
    if (tableSort.mode === mode) {
        tableSort.ascending = !tableSort.ascending;
    }
    else {
        tableSort.mode = mode;
        tableSort.ascending = true;
    }
}

// sort summary rows and append to table
function sortSummaryTableRows() {
    if (tableSort.mode === "position") {
        const groupMap = Object.values(answerResults.groupMap ?? answerResults.groupSlotMap).flat();
        playerSummaryRows.sort((a, b) => groupMap.indexOf(a.gamePlayerId) - groupMap.indexOf(b.gamePlayerId));
    }
    else if (tableSort.mode === "name") {
        playerSummaryRows.sort((a, b) => a.name.localeCompare(b.name));
    }
    else if (tableSort.mode === "answer") {
        playerSummaryRows.sort((a, b) => a.answer.localeCompare(b.answer));
    }
    if (!tableSort.ascending) playerSummaryRows.reverse();
    $playerSummaryTable.append(playerSummaryRows.map((item) => item.$row));
}

function findBoxById(id, groupMap) {
    if (!groupMap) {
        groupMap = quiz.avatarContainer._groupSlotMap;
    }
    return Object.keys(groupMap).find(key => groupMap[key].indexOf(id) !== -1);
}

function selectAvatarGroup(number) {
    quiz.avatarContainer.currentGroup = number;
    quiz.scoreboard.setActiveGroup(number);
    if (Object.keys(quiz.scoreboard.groups).length > 1) {
        quiz.scoreboard.$quizScoreboardItemContainer.stop().scrollTop(quiz.scoreboard.groups[number].topOffset - 3);
    }
}

function buildCustomColorList() {
    customColorMap = {};
    const $smCustomColors = $("#smCustomColors").empty();
    customColors.forEach((item, index) => {
        for (const player of item.players) {
            customColorMap[player] = index;
        }
        $smCustomColors
            .append($("<div>", { class: "hfCustomColorRow", "data-color": index })
                .append($("<div>", { class: "customCheckbox", style: "margin: 0 8px 0 0;" })
                    .append($("<input>", { id: `smColorCustomCheckbox${index}`, type: "checkbox", checked: item.enabled })
                        .on("click", function () {
                            item.enabled = !item.enabled;
                            saveSettings();
                            applyStyles();
                        }))
                    .append(`<label for="smColorCustomCheckbox${index}"><i class="fa fa-check" aria-hidden="true"></i></label>`)
                )
                .append("<span>", { text: "Custom", style: "width: 60px; display: inline-block;" })
                .append($("<input>", { id: `smColorCustomColor${index}`, type: "color" })
                    .val(item.color)
                    .on("change", function () {
                        item.color = this.value;
                        saveSettings();
                        applyStyles();
                    }))
                .append($("<input>", { id: `smColorCustomShadow${index}`, type: "color", style: "margin-left: 10px;" })
                    .val(item.shadow)
                    .on("change", function () {
                        item.shadow = this.value;
                        saveSettings();
                        applyStyles();
                    }))
                .append($("<input>", { id: `smColorCustomList${index}`, type: "text", placeholder: "players", style: "color: black; width: 300px; margin: 0 10px 0 10px;" })
                    .val(item.players.join(" "))
                    .on("change", function () {
                        item.players = this.value.toLowerCase().split(/[\s,]+/).filter(Boolean);
                        customColorMap = {};
                        customColors.forEach((item, index) => {
                            for (const player of item.players) {
                                customColorMap[player] = index;
                            }
                        });
                        saveSettings();
                        applyStyles();
                        refreshColors();
                    }))
                .append($("<i>", { class: "fa fa-trash clickAble", "aria-hidden": "true" }).on("click", function () {
                    customColors.splice(index, 1);
                    saveSettings();
                    applyStyles();
                    refreshColors();
                    buildCustomColorList();
                }))
            )
    });
}

// apply colors to scoreboard in quiz
function colorScorebox() {
    if (!quiz.inQuiz) return;
    for (const [key, player] of Object.entries(quiz.scoreboard.playerEntries)) {
        const name = quiz.players[key]?._name ?? "";
        player.$entry.removeClass((index, className) => (className.match(colorClassRegex) || []).join(" "));
        if (player.isSelf) {
            player.$entry.addClass("isSelf");
        }
        else if (socialTab.isFriend(name)) {
            player.$entry.addClass("isFriend");
        }
        else if (socialTab.isBlocked(name)) {
            player.$entry.addClass("isBlocked");
        }
        if (customColorMap.hasOwnProperty(name.toLowerCase())) {
            player.$entry.addClass("customColor" + customColorMap[name.toLowerCase()]);
        }
    }
}

// apply colors to avatars in quiz
function colorQuizPlayers() {
    if (!quiz.inQuiz) return;
    for (const player of Object.values(quiz.players)) {
        player.avatarSlot.$body.removeClass((index, className) => (className.match(colorClassRegex) || []).join(" "));
        if (player._name === selfName) {
            player.avatarSlot.$body.addClass("isSelf");
        }
        else if (socialTab.isFriend(player._name)) {
            player.avatarSlot.$body.addClass("isFriend");
        }
        else if (socialTab.isBlocked(player._name)) {
            player.avatarSlot.$body.addClass("isBlocked");
        }
        if (customColorMap.hasOwnProperty(player._name.toLowerCase())) {
            player.avatarSlot.$body.addClass("customColor" + customColorMap[player._name.toLowerCase()]);
        }
    }
}

// apply colors to players in lobby
function colorLobbyPlayers() {
    if (!lobby.inLobby) return;
    setTimeout(() => {
        for (const player of Object.values(lobby.players)) {
            player.lobbySlot.$LOBBY_SLOT.removeClass((index, className) => (className.match(colorClassRegex) || []).join(" "));
            if (player._name === selfName) {
                player.lobbySlot.$LOBBY_SLOT.addClass("isSelf");
            }
            else if (socialTab.isFriend(player._name)) {
                player.lobbySlot.$LOBBY_SLOT.addClass("isFriend");
            }
            else if (socialTab.isBlocked(player._name)) {
                player.lobbySlot.$LOBBY_SLOT.addClass("isBlocked");
            }
            if (customColorMap.hasOwnProperty(player._name.toLowerCase())) {
                player.lobbySlot.$LOBBY_SLOT.addClass("customColor" + customColorMap[player._name.toLowerCase()]);
            }
        }
    }, 0);
}

// apply colors to spectator names
function colorSpectators() {
    if (!quiz.inQuiz && !lobby.inLobby) return;
    setTimeout(() => {
        $(".gcSpectatorItem").each((index, element) => {
            const $el = $(element);
            const name = $el.find("h3").text();
            $el.removeClass((index, className) => (className.match(colorClassRegex) || []).join(" "));
            if (isSelf(name)) {
                $el.addClass("isSelf");
            }
            else if (isFriend(name)) {
                $el.addClass("isFriend");
            }
            else if (isBlocked(name)) {
                $el.addClass("isBlocked");
            }
            if (customColorMap.hasOwnProperty(name.toLowerCase())) {
                $el.addClass("customColor" + customColorMap[name.toLowerCase()]);
            }
        });
    }, 0);
}

// update chat message
function updateChatMessage(message) {
    setTimeout(() => {
        const $gcUserName = $(`#gcPlayerMessage-${message.messageId}`).find(".gcUserName");
        if (message.sender === selfName) {
            $gcUserName.addClass("isSelf");
        }
        else if (socialTab.isFriend(message.sender)) {
            $gcUserName.addClass("isFriend");
        }
        else if (socialTab.isBlocked(message.sender)) {
            $gcUserName.addClass("isBlocked");
        }
        if (customColorMap.hasOwnProperty(message.sender.toLowerCase())) {
            $gcUserName.addClass("customColor" + customColorMap[message.sender.toLowerCase()]);
        }
        if (smRemoveColor) {
            $gcUserName.removeClass("gcNameColor");
        }
        if (smRemoveGlow) {
            $gcUserName.removeClass("gcNameGlow");
        }
    }, 1);
}

// check if name is self (handle original name script)
function isSelf(username) {
    const s = username.indexOf("(");
    if (s > -1) {
        username = username.slice(0, s).trim();
    }
    return username === selfName;
}

// check if name is friend (handle original name script)
function isFriend(username) {
    const s = username.indexOf("(");
    if (s > -1) {
        username = username.slice(0, s).trim();
    }
    return socialTab.isFriend(username);
}

// check if name is blocked (handle original name script)
function isBlocked(username) {
    const s = username.indexOf("(");
    if (s > -1) {
        username = username.slice(0, s).trim();
    }
    return socialTab.isBlocked(username);
}

// redraw all name colors in lobby and quiz
function refreshColors() {
    colorScorebox();
    colorLobbyPlayers();
    colorQuizPlayers();
    colorSpectators();
}

// load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false) {
    const item = saveData.hotKeys?.[action];
    return {
        key: (item?.key ?? key).toUpperCase(),
        ctrl: item?.ctrl ?? item?.ctrlKey ?? ctrl,
        alt: item?.alt ?? item?.altKey ?? alt,
        shift: item?.shift ?? item?.shiftKey ?? shift
    }
}

// create hotkey rows and add to table
function createHotkeyTable(data) {
    const $tbody = $("#hfHotkeyTable tbody");
    for (const { action, title } of data) {
        const $input = $("<input>", { type: "text", class: "hk-input", readonly: true, "data-action": action })
            .val(bindingToText(hotKeys[action]))
            .on("click", startHotkeyRecord);
        $tbody.append($("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>").append($input)));
    }
}

// begin hotkey capture on click
function startHotkeyRecord() {
    const $input = $(this);
    if ($input.hasClass("recording")) return;
    const action = $input.data("action");
    const capture = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!e.key) return;
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        if ((e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            hotKeys[action] = {
                key: "",
                ctrl: false,
                alt: false,
                shift: false
            };
        }
        else {
            hotKeys[action] = {
                key: e.key.toUpperCase(),
                ctrl: e.ctrlKey,
                alt: e.altKey,
                shift: e.shiftKey
            };
        }
        saveSettings();
        finish();
    };
    const finish = () => {
        document.removeEventListener("keydown", capture, true);
        $input.removeClass("recording").val(bindingToText(hotKeys[action])).off("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    $input.addClass("recording").val("Press keys…").on("blur", finish);
}

// input hotKeys[action] and convert the data to a string for the input field
function bindingToText(b) {
    if (!b) return "";
    const keys = [];
    if (b.ctrl) keys.push("CTRL");
    if (b.alt) keys.push("ALT");
    if (b.shift) keys.push("SHIFT");
    if (b.key) keys.push(b.key === " " ? "SPACE" : b.key);
    return keys.join(" + ");
}

// override system message function to inject color classes
GameChat.prototype.systemMessage = function (title, msg, teamMessage) {
    if (!msg) msg = "";
    const $msg = $(format(this.serverMsgTemplate, title, msg));
    if (teamMessage) {
        $msg.find(".gcTeamMessageIcon").removeClass("hide");
    }
    if (title.includes("started spectating") || title.includes("changed to spectator")) {
        $msg.addClass("csmSpec");
    }
    else if (title.includes("joined the room") || title.includes("changed to player")) {
        $msg.addClass("csmJoin");
    }
    else if (title.includes("stopped spectating") || title.includes("left the room") || title.includes("kicked from the room")) {
        $msg.addClass("csmLeave");
    }
    this.insertMsg($msg);
}

// override change view function to apply colors
const oldChangeView = ViewChanger.prototype.changeView;
ViewChanger.prototype.changeView = function () {
    oldChangeView.apply(this, arguments);
    refreshColors();
};

// override block player function to apply colors
const oldBlockPlayer = SocialTab.prototype.blockPlayer
SocialTab.prototype.blockPlayer = function () {
    oldBlockPlayer.apply(this, arguments);
    refreshColors();
};

// override unblock player function to apply colors
const oldUnblockPlayer = SocialTab.prototype.unblockPlayer
SocialTab.prototype.unblockPlayer = function () {
    oldUnblockPlayer.apply(this, arguments);
    refreshColors();
};

// override updateList function to apply colors
Leaderboard.prototype.updateList = function (listName, entries) {
    const tabEntry = this.tabMap[listName];
    const $container = tabEntry.$container;
    $container.find(".lbmBoardEntry").remove();
    entries.forEach((entry) => {
        const rank = this.formatRankFunction(entry);
        const score = this.formatScoreFunction(entry);
        const $entry = $(format(this.ENTRY_TEMPLATE, entry.name, score, rank));
        if (entry.name) {
            if (entry.name === selfName) {
                $entry.addClass("self");
            }
            else if (socialTab.isFriend(entry.name)) {
                $entry.addClass("friend");
            }
            else if (socialTab.isBlocked(entry.name)) {
                $entry.addClass("blocked");
            }
            if (customColorMap.hasOwnProperty(entry.name.toLowerCase())) {
                $entry.addClass("customColor" + customColorMap[entry.name.toLowerCase()]);
            }
            $entry.click(() => {
                playerProfileController.loadProfile(entry.name, $entry, {}, () => { }, true, false);
            });
        }
        $container.append($entry);
    });
    if (tabEntry.scroll) {
        $container.perfectScrollbar("update");
    }
    if (tabEntry.scrollToSelf) {
        this.scrollToSelf(listName);
    }
}

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
    localStorage.setItem("highlightFriendsSettings", JSON.stringify({
        smColorSelfColor,
        smColorSelfShadow,
        smColorFriendColor,
        smColorFriendShadow,
        smColorBlockedColor,
        smColorBlockedShadow,
        smColorJoinColor,
        smColorSpecColor,
        smColorLeaveColor,
        smColorScorebox,
        smColorName,
        smColorPoint,
        smColorLevel,
        smColorChat,
        smColorLeaderboard,
        smColorJoin,
        smColorSpec,
        smColorLeave,
        smRemoveColor,
        smRemoveGlow,
        smOverrideRankedColor,
        customColors
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/`
        #playerSummaryWindowTableContainer {
            padding: 10px;
        }
        #playerSummaryWindowTable .header {
            font-weight: bold;
        }
        #playerSummaryWindowTable td {
            border: 1px solid black;
            text-align: center;
            vertical-align: middle;
            padding: 0;
        }
        #playerSummaryWindow .modal-header i.fa:hover {
            opacity: .7;
        }
        .friendScore {
            height: 30px;
        }
        .fstRank {
            min-width: 40px;
        }
        .fstScore {
            min-width: 40px;
        }
        .fstName {
            min-width: 80px;
        }
        .fstBox {
            min-width: 40px;
        }
        .fstAnswer {
            min-width: 80px;
        }
        .correctGuess {
            background-color: rgba(0, 200, 0, 0.07);
        }
        .incorrectGuess {
            background-color: rgba(255, 0, 0, 0.07);
        }
        #qpPlayerSummaryButton {
            width: 30px;
            height: 100%;
            margin-right: 5px;
        }
        #smColorContainer .customCheckbox {
            vertical-align: middle;
        }
        #smColorContainer input[type="color"] {
            vertical-align: bottom;
        }
        #smCustomColors i.fa-trash:hover {
            color: #d9534f;
        }
    `;
    if (smColorJoin) css += `
        .csmJoin {
            color: ${smColorJoinColor};
        }
    `;
    if (smColorSpec) css += `
        .csmSpec {
            color: ${smColorSpecColor};
        }
    `;
    if (smColorLeave) css += `
        .csmLeave {
            color: ${smColorLeaveColor};
        }
    `;

    const colorData = {};
    if (smColorSelf) colorData["self"] = { class: "isSelf", color: smColorSelfColor, shadow: smColorSelfShadow };
    if (smColorFriend) colorData["friend"] = { class: "isFriend", color: smColorFriendColor, shadow: smColorFriendShadow };
    if (smColorBlocked) colorData["blocked"] = { class: "isBlocked", color: smColorBlockedColor, shadow: smColorBlockedShadow };
    for (const [key, value] of Object.entries(colorData)) {
        if (smColorScorebox) css += `
            .qpStandingItem.${value.class} .qpsPlayerName {
                color: ${value.color};
                text-shadow: 0 0 10px ${value.shadow};
            }
        `;
        if (smColorName) css += `
            .lobbyAvatar.${value.class} .lobbyAvatarNameContainerInner > h2 {
                color: ${value.color};
            }
            .qpAvatarContainerOuter.${value.class} .qpAvatarName {
                color: ${value.color};
            }
        `;
        if (smColorLevel) css += `
            .qpAvatarContainerOuter.${value.class} .qpAvatarLevel {
                color: ${value.color};
            }
        `;
        if (smColorPoint) css += `
            .qpAvatarContainerOuter.${value.class} .qpAvatarScore {
                color: ${value.color};
            }
        `;
        if (smColorChat) css += `
            #gcMessageContainer .gcUserName.${value.class} {
                color: ${value.color};
            }
        `;
        if (smColorChat) css += `
            .gcSpectatorItem.${value.class} h3 {
                color: ${value.color};
            }
        `;
        if (smColorLeaderboard) css += `
            li.lbmBoardEntry.${key} .lmbEntryText {
                color: ${value.color};
            }
        `;
    }

    customColors.forEach((item, index) => {
        if (item.enabled) {
            if (smColorScorebox) css += `
                .qpStandingItem.customColor${index} .qpsPlayerName {
                    color: ${item.color};
                    text-shadow: 0 0 10px ${item.shadow};
                }
            `;
            if (smColorName) css += `
                .lobbyAvatar.customColor${index} .lobbyAvatarNameContainerInner > h2 {
                    color: ${item.color};
                }
                .qpAvatarContainerOuter.customColor${index} .qpAvatarName {
                    color: ${item.color};
                }
            `;
            if (smColorLevel) css += `
                .qpAvatarContainerOuter.customColor${index} .qpAvatarLevel {
                    color: ${item.color};
                }
            `;
            if (smColorPoint) css += `
                .qpAvatarContainerOuter.customColor${index} .qpAvatarScore {
                    color: ${item.color};
                }
            `;
            if (smColorChat) css += `
                #gcMessageContainer .gcUserName.customColor${index} {
                    color: ${item.color};
                }
            `;
            if (smColorChat) css += `
                .gcSpectatorItem.customColor${index} h3 {
                    color: ${item.color};
                }
            `;
            if (smColorLeaderboard) css += `
                li.lbmBoardEntry.customColor${index} .lmbEntryText {
                    color: ${item.color};
                }
            `;
        }
    });
    let style = document.getElementById("highlightFriendsStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "highlightFriendsStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
