// ==UserScript==
// @name         AMQ Custom Score Counter
// @namespace    https://github.com/kempanator
// @version      0.1
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

const version = "0.1";
const saveData = validateLocalStorage("customScoreCounter");
let teams = {}; //[1: {number: 1, players: [{0: "name"}], totalCorrect: 0, score: 0}]
let scoreMap = {};
let hotKeys = saveData.hotKeys ?? {};
let cscWindow;

hotKeys.cscWindow = saveData.hotKeys?.cscWindow ?? {altKey: false, ctrlKey: false, key: ""};

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
    /*new Listener("quiz over", (payload) => {

    }).bindListener();
    new Listener("play next song", (payload) => {
        
    }).bindListener();
    new Listener("team member answer", (payload) => {
        
    }).bindListener();
    new Listener("player answers", (payload) => {
        
    }).bindListener();*/
    new Listener("answer results", (payload) => {
        if (Object.keys(teams).length === 0) return;
        //let highestValue = Math.max(...Object.keys(scoreMap).map(n => Number(n)));
        let totalCorrect =  Object.fromEntries(Object.keys(teams).map(t => [t, 0]));
        for (let player of payload.players) {
            if (player.correct) {
                let id = String(player.gamePlayerId);
                let team = Object.values(teams).find(t => Object.keys(t.players).includes(id));
                if (team) {
                    team.totalCorrect += 1;
                    totalCorrect[team.number] += 1;
                }
            }
        }
        for (let n of Object.keys(totalCorrect)) {
            if (scoreMap.hasOwnProperty(totalCorrect[n])) {
                teams[n].score += scoreMap[totalCorrect[n]];
            }
            /*else if (totalCorrect[n] > highestValue) {
                teams[n].score += scoreMap[highestValue];
            }*/
        }
        updateScoreTable();

    }).bindListener();

    cscWindow = new AMQWindow({
        id: "cscWindow",
        title: "",
        width: 400,
        height: 300,
        minWidth: 10,
        minHeight: 10,
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
            content: "Custom Score Counter UI",
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
    
    AMQ_addScriptData({
        name: "Custom Score Counter",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqCustomScoreCounter.user.js",
        description: `
            <p>Type /csc or click the + button in the options bar during quiz to open the custom score counter user interface</p>
        `
    });
    setupcscWindow();
    applyStyles();
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

// crteate team table, input array of Player objects
function createTeamTable(players) {
    if (!players) return;
    let $tbody = $("#cscTeamTable tbody").empty();
    players.sort((a, b) => a.name.localeCompare(b.name));
    for (let player of players) {
        let id = String(player.gamePlayerId);
        let team = Object.values(teams).find(t => Object.keys(t.players).includes(id));
        $tbody.append($(`<tr></tr>`)
            .append($(`<td class="name"></td>`).text(player.name))
            .append($(`<td class="team"></td>`)
                .append($(`<input type="text">`).val(team?.number || "").on("change", () => {
                    updateTeamTable();
                }))
            )
        );
    }
}

// update team table
function updateTeamTable() {
    let players = quiz.inQuiz ? Object.values(quiz.players) : Object.values(lobby.players);
    for (let tr of $("#cscTeamTable tbody tr")) {
        let name = $(tr).find("td.name").text();
        let teamNumber = $(tr).find("input").val();
        if (!isNaN(teamNumber) && teamNumber > 0) {
            let id = players.find(p => p._name === name)?.gamePlayerId;
            if (teams.hasOwnProperty(teamNumber)) {
                teams[teamNumber].players[id] = name;
            }
            else {
                teams[teamNumber] = {number: teamNumber, players: {[id]: name}, totalCorrect: 0, score: 0};
            }
        }
    }
}

// shuffle teams
function shuffleTeams() {
    let players = quiz.inQuiz ? Object.values(quiz.players) : Object.values(lobby.players);
    let teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    let numTeams = Math.ceil(players.length / teamSize);
    teams = {};
    for (let i = 1; i <= numTeams; i++) {
        teams[i] = {number: i, players: {}, totalCorrect: 0, score: 0};
    }
    let ids = shuffleArray(players.map(p => p.gamePlayerId));
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i];
        let name = players.find(p => p.gamePlayerId === id)?._name;
        teams[i % numTeams + 1].players[id] = name;
    }
    createTeamTable(players);
}

// import current team setup from lobby
function importTeams() {
    let teamSize = parseInt(hostModal.$teamSize.val()) || 0;
    if (teamSize > 1) {
        $("#cscTeamSizeInput").val(teamSize);
        let players = quiz.inQuiz ? Object.values(quiz.players) : Object.values(lobby.players);
        teams = {};
        for (let player of players) {
            let teamNumber = player.teamNumber ?? Number(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
            if (teamNumber) {
                if (teams.hasOwnProperty(teamNumber)) {
                    teams[teamNumber].players[player.gamePlayerId] = player._name;
                }
                else {
                    teams[teamNumber] = {number: teamNumber, players: {[player.gamePlayerId]: player._name}, totalCorrect: 0, score: 0};
                }
            }
        }
        createTeamTable(players);
    }
    else {
        messageDisplayer.displayMessage("Invalid team players", "Set the quiz to team mode and this script will import those values");
    }
}

// update score table
function updateScoreTable() {
    if (Object.keys(teams).length === 0) return;
    let $tbody = $("#cscScoreTable tbody").empty();
    for (let team of Object.values(teams)) {
        $tbody.append(`<tr><td>${team.number}: ${Object.values(team.players).join(", ")}</td><td class="correct">${team.totalCorrect}</td><td class="score">${team.score}</td></tr>`);
    }
}

// create score map user inputs
function createScoreMap() {
    let $container = $("#cscScoreMapContainer").empty();
    let teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    for (let i = 0; i <= teamSize; i++) {
        let $input = $(`<input type="text" style="width: 40px; margin: 0 10px 0 3px">`).on("change", updateScoreMap).val(scoreMap[i] ?? "");
        $container.append(`<span>${i}:</span>`).append($input);
    }
}

// read score map user inputs and update score maps
function updateScoreMap() {
    let $inputs = $("#cscScoreMapContainer input");
    let teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    scoreMap = {};
    for (let i = 0; i <= teamSize; i++) {
        scoreMap[i] = parseInt($($inputs[i]).val()) || 0;
    }
}

// reset scores for all teams
function resetScores() {
    if (Object.keys(teams).length === 0) return;
    for (let team of Object.values(teams)) {
        team.totalCorrect = 0;
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
            .append($(`<button id="cscShuffleButton" style="user-select: none;">Shuffle</button>`).click(() => {
                shuffleTeams();
            }))
            .append($(`<button id="cscImportButton" style="user-select: none;">Import</button>`).click(() => {
                importTeams();
            }))
            .append($(`<span style="margin-left: 15px;">Team size:</span>`))
            .append($(`<input id="cscTeamSizeInput" type="number" min="1" max="99" style="width: 40px; margin-left: 5px;">`).val(4).on("change", createScoreMap))
            .append($(`<button id="cscToChatButton" style="user-select: none; margin-left: 15px;">To Chat</button>`).click(() => {
                for (let team of Object.values(teams)) {
                    sendChatMessage(`Team ${team.number}: ${Object.values(team.players).join(", ")} - ${team.score}`);
                }
            }))
            .append($(`<table id="cscTeamTable" style="margin-top: 10px;"><thead><tr><th>Name</th><th class="team">Team #</th></tr></thead><tbody></tbody></table>`))
        )
        .append($(`<div id="cscScoreContainer" style="padding: 10px;"></div>`).hide()
            .append($(`<table id="cscScoreTable"><thead><tr><th>Team</th><th class="correct">Correct</th><th class="score">Score</th></tr></thead><tbody></tbody></table>`))
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
                        $("#cscTeamSizeInput").val(4);
                        scoreMap = {0: 0, 1: 1, 2: 1.75, 3: 2.25, 4: 2.5};
                        createScoreMap();
                    }
                })
            )
            .append($(`<div id="cscScoreMapContainer" style="margin-top: 10px;"></div>`))
            .append(`<table id="cscHotkeyTable" style="margin-top: 20px;"><thead><tr><th>Action</th><th>Modifier</th><th>Key</th></tr></thead><tbody></tbody></table>`)
        )
    ;
    createHotkeyElement("Open this window", "cscWindow", "cscWindowSelect", "cscWindowInput");
    createScoreMap();
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
        }
        #cscScoreTable .correct, #cscScoreTable .score {
            padding-left: 10px;
            text-align: right;
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
