// ==UserScript==
// @name         AMQ Custom Score Counter
// @namespace    https://github.com/kempanator
// @version      0.4
// @description  Adds a user interface to keep track of custom score game modes
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCustomScoreCounter.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCustomScoreCounter.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.4";
const saveData = validateLocalStorage("customScoreCounter");
let teams = {}; //[1: {number: 1, players: ["name"], correct: 0, score: 0}]
let scoreMap = {1: {}, 2: {}, 3: {}, 4: {}};
let scoreTableSort = {mode: "team", ascending: true};
let hotKeys = {
    cscWindow: saveData.hotKeys?.cscWindow ?? {altKey: false, ctrlKey: false, key: ""}
};
let cscWindow;

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName) parseMessage(message.message);
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName) parseMessage(payload.message);
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        resetScores();
    }).bindListener();
    new Listener("Join Game", (payload) => {
        createTeamTable(payload.players || payload.quizState?.players);
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        createTeamTable(payload.players || payload.quizState?.players);
    }).bindListener();
    new Listener("Player Changed To Spectator", (payload) => {
        setTimeout(() => {
            createTeamTable(Object.values(lobby.players));
        }, 0);
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        setTimeout(() => {
            createTeamTable(Object.values(lobby.players));
        }, 0);
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (Object.keys(teams).length === 0) return;
        let totalCorrect =  Object.fromEntries(Object.keys(teams).map(t => [t, 0])); //{teamNumber: #correct}
        for (let player of payload.players) {
            if (player.correct) {
                let name = quiz.players[player.gamePlayerId]?.name;
                let team = Object.values(teams).find(t => t.players.includes(name));
                if (team) {
                    team.correct += 1;
                    totalCorrect[team.number] += 1;
                }
            }
        }
        for (let teamNumber of Object.keys(totalCorrect)) {
            let teamSize = teams[teamNumber].players.length;
            if (scoreMap.hasOwnProperty(teamSize)) {
                if (scoreMap[teamSize].hasOwnProperty(totalCorrect[teamNumber])) {
                    teams[teamNumber].score += scoreMap[teamSize][totalCorrect[teamNumber]];
                }
            }
        }
        updateScoreTable();
    }).bindListener();

    cscWindow = new AMQWindow({
        id: "cscWindow",
        title: "",
        width: 420,
        height: 300,
        minWidth: 300,
        minHeight: 90,
        zIndex: 1060,
        resizable: true,
        draggable: true
    });
    cscWindow.addPanel({
        id: "cscPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: true, y: true}
    });

    $("#qpOptionContainer").width($("#qpOptionContainer").width() + 35);
    $("#qpOptionContainer > div").append($(`<div id="qpCSC" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-plus qpMenuItem"></i></div>`)
        .click(() => {
            cscWindow.isVisible() ? cscWindow.close() : cscWindow.open();
        })
        .popover({
            content: "Custom Score Counter",
            trigger: "hover",
            placement: "bottom"
        })
    );

    document.body.addEventListener("keydown", (event) => {
        const key = event.key;
        const altKey = event.altKey;
        const ctrlKey = event.ctrlKey;
        if (testHotkey("cscWindow", key, altKey, ctrlKey)) {
            cscWindow.isVisible() ? cscWindow.close() : cscWindow.open();
        }
    });

    setupcscWindow();
    applyStyles();
    AMQ_addScriptData({
        name: "Custom Score Counter",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqCustomScoreCounter.user.js",
        description: `
            <p>Type /csc or click the + button in the options bar during quiz to open the custom score counter user interface</p>
        `
    });
}

// parse message
function parseMessage(content) {
    if (content === "/csc") {
        cscWindow.isVisible() ? cscWindow.close() : cscWindow.open();
    }
}

// send chat message
function sendChatMessage(text, teamChat) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: {msg: String(text), teamMessage: Boolean(teamChat)}
    });
}

// create hotkey element
function createHotkeyElement(title, key, selectID, inputID) {
    let $select = $(`<select id="${selectID}" style="padding: 3px 0;"></select>`).append(`<option>ALT</option>`).append(`<option>CTRL</option>`).append(`<option>CTRL ALT</option>`).append(`<option>-</option>`);
    let $input = $(`<input id="${inputID}" type="text" maxlength="1" style="width: 40px;">`).val(hotKeys[key].key);
    $select.on("change", () => {
        hotKeys[key] = {
            "altKey": $select.val().includes("ALT"),
            "ctrlKey": $select.val().includes("CTRL"),
            "key": $input.val().toLowerCase()
        }
        saveSettings();
    });
    $input.on("change", () => {
        hotKeys[key] = {
            "altKey": $select.val().includes("ALT"),
            "ctrlKey": $select.val().includes("CTRL"),
            "key": $input.val().toLowerCase()
        }
        saveSettings();
    })
    if (hotKeys[key].altKey && hotKeys[key].ctrlKey) $select.val("CTRL ALT");
    else if (hotKeys[key].altKey) $select.val("ALT");
    else if (hotKeys[key].ctrlKey) $select.val("CTRL");
    else $select.val("-");
    $("#cscHotkeyTable tbody").append($(`<tr></tr>`).append($(`<td></td>`).text(title)).append($(`<td></td>`).append($select)).append($(`<td></td>`).append($input)));
}

// test hotkey
function testHotkey(action, key, altKey, ctrlKey) {
    let hotkey = hotKeys[action];
    return key === hotkey.key && altKey === hotkey.altKey && ctrlKey === hotkey.ctrlKey;
}

// get players list
function getPlayers() {
    if (lobby.inLobby) {
        return Object.values(lobby.players);
    }
    if (quiz.inQuiz) {
        return Object.values(quiz.players);
    }
    return [];
}

// crteate team table, input array of Player objects
function createTeamTable(players) {
    if (!players) return;
    let $tbody = $("#cscTeamTable tbody").empty();
    players.sort((a, b) => a.name.localeCompare(b.name));
    for (let player of players) {
        let team = Object.values(teams).find(t => t.players.includes(player.name));
        $tbody.append($(`<tr></tr>`)
            .append($(`<td class="name"></td>`).text(player.name))
            .append($(`<td class="team"></td>`)
                .append($(`<input type="text">`).val(team?.number || ""))
            )
        );
    }
}

// update team table
function updateTeamTable() {
    teams = {};
    for (let tr of $("#cscTeamTable tbody tr")) {
        let name = $(tr).find("td.name").text();
        let teamNumber = $(tr).find("input").val();
        if (!isNaN(teamNumber) && teamNumber > 0) {
            if (teams.hasOwnProperty(teamNumber)) {
                teams[teamNumber].players.push(name);
            }
            else {
                teams[teamNumber] = {number: teamNumber, players: [name], correct: 0, score: 0};
            }
        }
    }
}

// shuffle teams
function shuffleTeams() {
    let players = getPlayers();
    let teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    let numTeams = Math.ceil(players.length / teamSize);
    teams = {};
    for (let i = 1; i <= numTeams; i++) {
        teams[i] = {number: i, players: [], correct: 0, score: 0};
    }
    let ids = shuffleArray(players.map(p => p.gamePlayerId));
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i];
        let name = players.find(p => p.gamePlayerId === id)?._name;
        teams[i % numTeams + 1].players.push(name);
    }
    createTeamTable(players);
}

// import current team setup from lobby
function importTeamsFromLobby() {
    let teamSize = parseInt(hostModal.$teamSize.val()) || 0;
    if (teamSize > 1) {
        $("#cscTeamSizeInput").val(teamSize);
        let players = getPlayers();
        teams = {};
        for (let player of players) {
            let teamNumber = player.teamNumber ?? Number(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
            if (teamNumber) {
                if (teams.hasOwnProperty(teamNumber)) {
                    teams[teamNumber].players.push(player.name);
                }
                else {
                    teams[teamNumber] = {number: teamNumber, players: [player.name], correct: 0, score: 0};
                }
            }
        }
        createTeamTable(players);
    }
    else {
        messageDisplayer.displayMessage("Invalid team players", "Set the quiz to team mode and this script will import those values");
    }
}

// import current team setup from chat
function importTeamsFromChat() {
    let importStarted = false;
    let players = getPlayers();
    let tempTeams = {};
    for (let message of $("#gcMessageContainer .gcMessage").toArray().reverse()) {
        let text = $(message).text();
        let regex = /^Team ([0-9]+):(.+) - [0-9]+$/.exec(text);
        if (regex) {
            importStarted = true;
            let teamNumber = parseInt(regex[1]);
            let names = regex[2].split(/[\s,]+/).filter(Boolean);
            if (!tempTeams.hasOwnProperty(teamNumber)) {
                tempTeams[teamNumber] = {number: teamNumber, players: names, correct: 0, score: 0};
            }
        }
        else if (importStarted) {
            break;
        }
    }
    if (importStarted) {
        teams = tempTeams;
        if (Object.keys(teams).length) {
            let teamSize = Math.max(...Object.values(teams).map(t => t.players.length));
            $("#cscTeamSizeInput").val(teamSize);
        }
        createTeamTable(players);
    }
    else {
        messageDisplayer.displayMessage("Error", "Couldn't find team list in chat");
    }
}

// update score table
function updateScoreTable() {
    if (Object.keys(teams).length === 0) return;
    let $tbody = $("#cscScoreTable tbody").empty();
    let sortedKeys = Object.keys(teams);
    if (scoreTableSort.mode === "team") {
        sortedKeys.sort((a, b) => a - b);
    }
    else if (scoreTableSort.mode === "correct") {
        sortedKeys.sort((a, b) => teams[a].correct - teams[b].correct);
    }
    else if (scoreTableSort.mode === "score") {
        sortedKeys.sort((a, b) => teams[a].score - teams[b].score);
    }
    if (!scoreTableSort.ascending) {
        sortedKeys.reverse();
    }
    for (let key of sortedKeys) {
        let team = teams[key];
        $tbody.append(`<tr><td>${team.number}: ${team.players.join(", ")}</td><td class="correct">${team.correct}</td><td class="score">${team.score}</td></tr>`);
    }
}

// create score map user inputs
function createScoreMap(teamSize) {
    let $thead = $("#cscScoreMapTable thead").empty();
    let $tbody = $("#cscScoreMapTable tbody").empty();
    if (teamSize) $("#cscTeamSizeInput").val(teamSize);
    else teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    $thead.append(`<tr><th colspan="${teamSize + 2}" style="text-align: center;"># Correct</th></tr>`);
    for (let i = 0; i <= teamSize; i++) {
        let $tr = $(`<tr></tr>`);
        for (let j = 0; j <= teamSize + 1; j++) {
            let $td = $(`<td></td>`);
            if (i === 0 && j === 0) {
                //$td.text("");
            }
            else if (i === 0) {
                $td.text(j - 1).css("text-align", "center");
            }
            else if (j === 0) {
                $td.text(i + "P").css("padding-right", "5px");
            }
            else if (j - 1 <= i) {
                $td.append($(`<input type="text" style="width: 40px">`).val(scoreMap[i]?.[j - 1] ?? ""));
            }
            $tr.append($td);
        }
        $tbody.append($tr);
    }
}

// read score map user inputs and update score maps
function updateScoreMap() {
    let inputs = $("#cscScoreMapTable input").toArray().map(x => parseFloat(x.value) || 0);
    if (inputs.length === 0) return;
    scoreMap = {};
    let start = 0;
    let teamSize = 1;
    while (start < inputs.length) {
        scoreMap[teamSize] = Object.assign({}, inputs.slice(start, start + teamSize + 1));
        start += teamSize + 1;
        teamSize++;
    }
}

// reset scores for all teams
function resetScores() {
    if (Object.keys(teams).length === 0) return;
    for (let team of Object.values(teams)) {
        team.correct = 0;
        team.score = 0;
    }
    updateScoreTable();
}

// reset tabs in csc window
function tabReset() {
    $("#cscTeamTab").removeClass("selected");
    $("#cscScoreTab").removeClass("selected");
    $("#cscSettingsTab").removeClass("selected");
    $("#cscTeamContainer").hide();
    $("#cscScoreContainer").hide();
    $("#cscSettingsContainer").hide();
}

// used for sorting table contents when you click a header
function tableSortChange(obj, mode) {
    if (obj.mode === mode) {
        obj.ascending = !obj.ascending;
    }
    else {
        obj.mode = mode;
        obj.ascending = true;
    }
}

// setup csc window
function setupcscWindow() {
    cscWindow.window.find(".modal-header").empty()
        .append($(`<i class="fa fa-times clickAble" style="font-size: 25px; top: 8px; right: 15px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            cscWindow.close();
        }))
        .append(`<h2>Custom Score Counter</h2>`)
        .append($(`<div class="tabContainer">`)
        .append($(`<div id="cscTeamTab" class="tab clickAble selected"><span>Teams</span></div>`).click(function() {
            tabReset();
            $(this).addClass("selected");
            $("#cscTeamContainer").show();
        }))
        .append($(`<div id="cscScoreTab" class="tab clickAble"><span>Score</span></div>`).click(function() {
            tabReset();
            $(this).addClass("selected");
            $("#cscScoreContainer").show();
        }))
        .append($(`<div id="cscSettingsTab" class="tab clickAble"><span>Settings</span></div>`).click(function() {
            tabReset();
            $(this).addClass("selected");
            $("#cscSettingsContainer").show();
        }))
    );
    cscWindow.panels[0].panel
        .append($(`<div id="cscTeamContainer" style="padding: 10px;"></div>`)
            .append($(`<button id="cscResetButton" style="user-select: none;">Reset</button>`).click(() => {
                teams = {};
                createTeamTable(getPlayers());
            }))
            .append($(`<button id="cscShuffleButton" style="user-select: none;">Shuffle</button>`).click(() => {
                shuffleTeams();
            }))
            .append($(`<button id="cscImportButton" style="user-select: none;">Import</button>`).click(() => {
                swal({
                    title: "Select Import Method",
                    input: "select",
                    inputOptions: {1: "From Chat", 2: "From Lobby Settings", 3: "Text"},
                    showCancelButton: true,
                    cancelButtonText: "Cancel",
                    allowOutsideClick: true
                }).then((result) => {
                    if (result.value) {
                        if (result.value === "1") {
                            importTeamsFromChat();
                        }
                        else if (result.value === "2") {
                            importTeamsFromLobby();
                        }
                        else if (result.value === "3") {
                            messageDisplayer.displayMessage("not implemented yet");
                        }
                    }
                });
            }))
            .append($(`<span style="margin-left: 15px;">Team size:</span>`))
            .append($(`<input id="cscTeamSizeInput" type="number" min="1" max="99" style="width: 40px; margin-left: 5px;">`).val(4).on("change", () => createScoreMap()))
            .append($(`<button id="cscToChatButton" style="user-select: none; margin-left: 15px;">To Chat</button>`).click(() => {
                for (let team of Object.values(teams)) {
                    sendChatMessage(`Team ${team.number}: ${team.players.join(", ")} - ${team.score}`);
                }
            }))
            .append($(`<table id="cscTeamTable" style="margin-top: 10px;"><thead><tr><th>Name</th><th class="team">Team #</th></tr></thead><tbody></tbody></table>`))
        )
        .append($(`<div id="cscScoreContainer" style="padding: 10px;"></div>`).hide()
            .append($(`<table id="cscScoreTable"></table>`)
                .append($(`<thead></thead>`)
                    .append($(`<tr></tr>`)
                        .append($(`<th>Team</th>`).click(() => {
                            tableSortChange(scoreTableSort, "team");
                            updateScoreTable();
                        }))
                        .append($(`<th class="correct">Correct</th>`).click(() => {
                            tableSortChange(scoreTableSort, "correct");
                            updateScoreTable();
                        }))
                        .append($(`<th class="score">Score</th>`).click(() => {
                            tableSortChange(scoreTableSort, "score");
                            updateScoreTable();
                        }))
                    )
                )
                .append($(`<tbody></tbody>`))
            )
        )
        .append($(`<div id="cscSettingsContainer" style="padding: 10px;"></div>`).hide()
            .append(`<div></div>`)
            .append($(`<span>Preset:</span>`))
            .append($(`<select id="cscPresetSelect" style="margin-left: 5px; padding: 4px 2px;"></select>`)
                .append(`<option>-</option>`)
                .append(`<option>yashadox</option>`)
                .on("change", function() {
                    if (this.value === "-") {
                        scoreMap = {};
                        createScoreMap();
                    }
                    else if (this.value === "yashadox") {
                        scoreMap = {4: {0: 0, 1: 1, 2: 1.75, 3: 2.25, 4: 2.5}};
                        createScoreMap(4);
                    }
                })
            )
            .append($(`<table id="cscScoreMapTable" style="margin-top: 10px;"><thead></thead><tbody></tbody></table>`))
            .append(`<table id="cscHotkeyTable" style="margin-top: 20px;"><thead><tr><th>Action</th><th>Modifier</th><th>Key</th></tr></thead><tbody></tbody></table>`)
        )
    ;
    createHotkeyElement("Open this window", "cscWindow", "cscWindowSelect", "cscWindowInput");
    createScoreMap();

    $("#cscTeamTable").on("change", "input", (event) => {
        updateTeamTable();
    }).on("keydown", "input", (event) => {
        if (event.key === "ArrowDown" || event.key === "Enter") {
            let inputs = $("#cscTeamTable input");
            let index = inputs.index(event.target);
            if (index < inputs.length - 1) {
                inputs.eq(index + 1).focus();
            }
        }
        else if (event.key === "ArrowUp") {
            let inputs = $("#cscTeamTable input");
            let index = inputs.index(event.target);
            if (index > 0) {
                inputs.eq(index - 1).focus();
            }
        }
    });
    $("#cscScoreMapTable").on("change", "input", (event) => {
        updateScoreMap();
    })
}

// save settings
function saveSettings() {
    localStorage.setItem("customScoreCounter", JSON.stringify({
        hotKeys
    }));
}

// validate json data in local storage
function validateLocalStorage(item) {
    try {
        return JSON.parse(localStorage.getItem(item)) || {};
    }
    catch {
        return {};
    }
}

// apply styles
function applyStyles() {
    //$("#customScoreCounterStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "customScoreCounterStyle";
    style.appendChild(document.createTextNode(`
        #qpCSC {
            width: 30px;
            margin-right: 5px;
        }
        #cscWindow .modal-header {
            height: 74px;
            padding: 0;
            line-height: normal;
        }
        #cscWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #cscWindow .modal-header h2 {
            font-size: 22px;
            text-align: left;
            height: 45px;
            margin: 0;
            padding: 10px;
            display: block;
        }
        #cscWindow .modal-header i.fa:hover {
            opacity: .7;
        }
        #cscWindow input, #cscWindow button, #cscWindow select {
            color: black;
        }
        #cscTeamTable th {
            font-weight: bold;
        }
        #cscTeamTable input {
            width: 40px;
        }
        #cscTeamTable .team {
            padding-left: 10px;
        }
        #cscScoreTable th {
            font-weight: bold;
            cursor: pointer;
        }
        #cscScoreTable .correct, #cscScoreTable .score {
            padding-left: 10px;
            text-align: right;
        }
        #cscScoreMapTable input {
            margin: 2px;
        }
        #cscHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #cscHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
    `));
    document.head.appendChild(style);
}
