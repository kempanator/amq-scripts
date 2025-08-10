// ==UserScript==
// @name         AMQ Custom Score Counter
// @namespace    https://github.com/kempanator
// @version      0.8
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
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("customScoreCounter");
let teams = {}; //[1: {number: 1, players: ["name"], correct: 0, score: 0}]
let soloBonus = 0; //bonus points for solo correct guess
let scoreMap = { 1: {}, 2: {}, 3: {}, 4: {} };
let scoreTableSort = { mode: "team", ascending: true };
let cscWindow;
let hotKeys = {
    cscWindow: loadHotkey("cscWindow")
};

// setup
function setup() {
    new Listener("game chat update", (data) => {
        for (const message of data.messages) {
            if (message.sender === selfName) parseMessage(message.message);
        }
    }).bindListener();
    new Listener("Game Chat Message", (data) => {
        if (data.sender === selfName) parseMessage(data.message);
    }).bindListener();
    new Listener("Game Starting", (data) => {
        resetScores();
    }).bindListener();
    new Listener("Join Game", (data) => {
        createTeamTable(data.players || data.quizState?.players);
    }).bindListener();
    new Listener("Spectate Game", (data) => {
        createTeamTable(data.players || data.quizState?.players);
    }).bindListener();
    new Listener("Player Changed To Spectator", (data) => {
        setTimeout(() => {
            createTeamTable(Object.values(lobby.players));
        }, 0);
    }).bindListener();
    new Listener("Spectator Change To Player", (data) => {
        setTimeout(() => {
            createTeamTable(Object.values(lobby.players));
        }, 0);
    }).bindListener();
    new Listener("answer results", (data) => {
        if (Object.keys(teams).length === 0) return;
        let totalCorrect = 0;
        let totalCorrectMap = Object.fromEntries(Object.keys(teams).map(t => [t, 0])); //{teamNumber: #correct}
        for (const player of data.players) {
            if (player.correct) {
                const name = quiz.players[player.gamePlayerId]?.name;
                const team = Object.values(teams).find(t => t.players.includes(name));
                if (team) {
                    team.correct += 1;
                    totalCorrect += 1;
                    totalCorrectMap[team.number] += 1;
                }
            }
        }
        for (const teamNumber of Object.keys(totalCorrectMap)) {
            const teamSize = teams[teamNumber].players.length;
            if (scoreMap.hasOwnProperty(teamSize)) {
                if (scoreMap[teamSize].hasOwnProperty(totalCorrectMap[teamNumber])) {
                    teams[teamNumber].score += scoreMap[teamSize][totalCorrectMap[teamNumber]];
                }
            }
        }
        if (soloBonus && totalCorrect === 1) {
            const teamNumber = Object.keys(totalCorrectMap).find(t => totalCorrectMap[t]);
            if (teamNumber) teams[teamNumber].score += soloBonus;
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
        scrollable: { x: true, y: true }
    });

    const hotkeyActions = {
        cscWindow: () => {
            cscWindow.isVisible() ? cscWindow.close() : cscWindow.open();
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

    $("#qpOptionContainer")
        .width((index, width) => width + 35)
        .children("div")
        .append($("<div>", { id: "qpCSC", class: "clickAble qpOption" })
            .append(`<i class="fa fa-plus qpMenuItem" aria-hidden="true"></i>`)
            .on("click", () => {
                cscWindow.isVisible() ? cscWindow.close() : cscWindow.open();
            })
            .popover({
                content: "Custom Score Counter",
                trigger: "hover",
                placement: "bottom"
            })
        );

    setupcscWindow();
    applyStyles();
    AMQ_addScriptData({
        name: "Custom Score Counter",
        author: "kempanator",
        version: GM_info.script.version,
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
        data: { msg: String(text), teamMessage: Boolean(teamChat) }
    });
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
    const $tbody = $("#cscHotkeyTable tbody");
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
    const $tbody = $("#cscTeamTable tbody").empty();
    players.sort((a, b) => a.name.localeCompare(b.name));
    for (const player of players) {
        const team = Object.values(teams).find(t => t.players.includes(player.name));
        $tbody.append($("<tr>")
            .append($("<td>", { class: "name", text: player.name }))
            .append($("<td>", { class: "team" })
                .append($("<input>", { type: "text" }).val(team?.number || ""))
            )
        );
    }
}

// update team table
function updateTeamTable() {
    teams = {};
    for (const element of $("#cscTeamTable tbody tr")) {
        const $tr = $(element);
        const name = $tr.find("td.name").text();
        const teamNumber = $tr.find("input").val();
        if (!isNaN(teamNumber) && teamNumber > 0) {
            if (teams.hasOwnProperty(teamNumber)) {
                teams[teamNumber].players.push(name);
            }
            else {
                teams[teamNumber] = { number: teamNumber, players: [name], correct: 0, score: 0 };
            }
        }
    }
}

// shuffle teams
function shuffleTeams() {
    const players = getPlayers();
    const teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    const numTeams = Math.ceil(players.length / teamSize);
    teams = {};
    for (let i = 1; i <= numTeams; i++) {
        teams[i] = { number: i, players: [], correct: 0, score: 0 };
    }
    const ids = shuffleArray(players.map(p => p.gamePlayerId));
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const name = players.find(p => p.gamePlayerId === id)?._name;
        teams[i % numTeams + 1].players.push(name);
    }
    createTeamTable(players);
}

// import current team setup from lobby
function importTeamsFromLobby() {
    const teamSize = parseInt(hostModal.$teamSize.val()) || 0;
    if (teamSize > 1) {
        $("#cscTeamSizeInput").val(teamSize);
        const players = getPlayers();
        teams = {};
        for (const player of players) {
            const teamNumber = player.teamNumber ?? Number(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
            if (teamNumber) {
                if (teams.hasOwnProperty(teamNumber)) {
                    teams[teamNumber].players.push(player.name);
                }
                else {
                    teams[teamNumber] = { number: teamNumber, players: [player.name], correct: 0, score: 0 };
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
    const players = getPlayers();
    let importStarted = false;
    const tempTeams = {};
    for (const message of $("#gcMessageContainer .gcMessage").toArray().reverse()) {
        const text = $(message).text();
        const regex = /^Team ([0-9]+):(.+) - [0-9]+$/.exec(text);
        if (regex) {
            importStarted = true;
            const teamNumber = parseInt(regex[1]);
            const names = regex[2].split(/[\s,]+/).filter(Boolean);
            if (!tempTeams.hasOwnProperty(teamNumber)) {
                tempTeams[teamNumber] = { number: teamNumber, players: names, correct: 0, score: 0 };
            }
        }
        else if (importStarted) {
            break;
        }
    }
    if (importStarted) {
        teams = tempTeams;
        if (Object.keys(teams).length) {
            const teamSize = Math.max(...Object.values(teams).map(t => t.players.length));
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
    const $tbody = $("#cscScoreTable tbody").empty();
    const sortedKeys = Object.keys(teams);
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
    for (const key of sortedKeys) {
        const team = teams[key];
        $tbody.append($("<tr>")
            .append($("<td>", { text: `${team.number}: ${team.players.join(", ")}` }))
            .append($("<td>", { class: "correct", text: team.correct }))
            .append($("<td>", { class: "score", text: team.score }))
        );
    }
}

// create score map user inputs
function createScoreMap(teamSize) {
    const $thead = $("#cscScoreMapTable thead").empty();
    const $tbody = $("#cscScoreMapTable tbody").empty();
    if (teamSize) $("#cscTeamSizeInput").val(teamSize);
    else teamSize = parseInt($("#cscTeamSizeInput").val());
    if (isNaN(teamSize) || teamSize < 1) return;
    $thead.append(`<tr><th colspan="${teamSize + 2}" style="text-align: center;"># Correct</th></tr>`);
    for (let i = 0; i <= teamSize; i++) {
        const $tr = $("<tr>");
        for (let j = 0; j <= teamSize + 1; j++) {
            const $td = $("<td>");
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
    const inputs = $("#cscScoreMapTable input").toArray().map(x => parseFloat(x.value) || 0);
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
    for (const team of Object.values(teams)) {
        team.correct = 0;
        team.score = 0;
    }
    updateScoreTable();
}

// reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#cscWindow");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
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
        .append($("<i>", { class: "fa fa-times clickAble", style: "font-size: 25px; top: 8px; right: 15px; position: absolute;", "aria-hidden": "true" })
            .on("click", () => {
                cscWindow.close();
            }))
        .append($("<h2>", { text: "Custom Score Counter" }))
        .append($("<div>", { class: "tabContainer" })
            .append($("<div>", { id: "cscTeamTab", class: "tab clickAble selected" })
                .append($("<span>", { text: "Teams" }))
                .on("click", () => {
                    switchTab("cscTeam");
                }))
            .append($("<div>", { id: "cscScoreTab", class: "tab clickAble" })
                .append($("<span>", { text: "Score" }))
                .on("click", () => {
                    switchTab("cscScore");
                }))
            .append($("<div>", { id: "cscSettingsTab", class: "tab clickAble" })
                .append($("<span>", { text: "Settings" }))
                .on("click", () => {
                    switchTab("cscSettings");
                }))
        );
    cscWindow.panels[0].panel
        .append($("<div>", { id: "cscTeamContainer", class: "tabSection", style: "padding: 10px;" })
            .append($("<button>", { id: "cscResetButton", text: "Reset", style: "user-select: none;" })
                .on("click", () => {
                    teams = {};
                    createTeamTable(getPlayers());
                }))
            .append($("<button>", { id: "cscShuffleButton", text: "Shuffle", style: "user-select: none;" })
                .on("click", () => {
                    shuffleTeams();
                }))
            .append($("<button>", { id: "cscImportButton", text: "Import", style: "user-select: none;" })
                .on("click", () => {
                    Swal.fire({
                        title: "Select Import Method",
                        input: "select",
                        inputOptions: { 1: "From Chat", 2: "From Lobby Settings", 3: "Text" },
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
            .append($("<span>", { text: "Team size:", style: "margin-left: 15px;" }))
            .append($("<input>", { id: "cscTeamSizeInput", type: "number", min: 1, max: 99, style: "width: 40px; margin-left: 5px;" })
                .val(4)
                .on("change", createScoreMap))
            .append($("<button>", { id: "cscToChatButton", text: "To Chat", style: "user-select: none; margin-left: 15px;" })
                .on("click", () => {
                    for (const team of Object.values(teams)) {
                        sendChatMessage(`Team ${team.number}: ${team.players.join(", ")} - ${team.score}`);
                    }
                }))
            .append($("<table>", { id: "cscTeamTable", style: "margin-top: 10px;" })
                .append($("<thead>")
                    .append($("<tr>")
                        .append($("<th>", { text: "Name" }))
                        .append($("<th>", { class: "team", text: "Team #" }))
                    )
                )
                .append($("<tbody>"))
            )
        )
        .append($("<div>", { id: "cscScoreContainer", class: "tabSection", style: "padding: 10px; display: none;" })
            .append($("<table>", { id: "cscScoreTable" })
                .append($("<thead>")
                    .append($("<tr>")
                        .append($("<th>", { class: "team", text: "Team", "data-sort": "team" }))
                        .append($("<th>", { class: "correct", text: "Correct", "data-sort": "correct" }))
                        .append($("<th>", { class: "score", text: "Score", "data-sort": "score" }))
                    )
                    .on("click", "th", (event) => {
                        const sortKey = event.currentTarget.getAttribute("data-sort");
                        if (!sortKey) return;
                        tableSortChange(scoreTableSort, sortKey);
                        updateScoreTable();
                    }))
                .append($("<tbody>"))
            )
        )
        .append($("<div>", { id: "cscSettingsContainer", class: "tabSection", style: "padding: 10px; display: none;" })
            .append($("<div>")
                .append($("<span>", { text: "Preset:" }))
                .append($("<select>", { id: "cscPresetSelect", style: "margin-left: 5px; padding: 4px 2px;" })
                    .append($("<option>", { text: "-" }))
                    .append($("<option>", { text: "yashadox" }))
                    .on("change", function () {
                        presetChange(this.value);
                    })
                )
                .append($("<span>", { text: "Solo Bonus:", style: "margin: 0 5px 0 15px;" }))
                .append($("<input>", { id: "cscSoloBonusInput", type: "text", style: "width: 40px;" })
                    .on("change", function () {
                        soloBonus = parseFloat(this.value) || 0;
                    }))
            )
            .append($("<table>", { id: "cscScoreMapTable", style: "margin-top: 10px;" })
                .append($("<thead>"))
                .append($("<tbody>"))
            )
            .append($("<table>", { id: "cscHotkeyTable", style: "margin-top: 20px;" })
                .append($("<thead>")
                    .append($("<tr>")
                        .append($("<th>", { text: "Action" }))
                        .append($("<th>", { text: "Keybind" }))
                    )
                )
                .append($("<tbody>"))
            )
        );
    createHotkeyTable([
        { action: "cscWindow", title: "Open This Window" },
    ]);
    createScoreMap();

    $("#cscTeamTable").on("change", "input", (event) => {
        updateTeamTable();
    }).on("keydown", "input", (event) => {
        if (event.key === "ArrowDown" || event.key === "Enter") {
            const inputs = $("#cscTeamTable input");
            const index = inputs.index(event.target);
            if (index < inputs.length - 1) {
                inputs.eq(index + 1).focus();
            }
        }
        else if (event.key === "ArrowUp") {
            const inputs = $("#cscTeamTable input");
            const index = inputs.index(event.target);
            if (index > 0) {
                inputs.eq(index - 1).focus();
            }
        }
    });
    $("#cscScoreMapTable").on("change", "input", (event) => {
        updateScoreMap();
    })
}

// handle preset select
function presetChange(value) {
    if (value === "-") {
        soloBonus = 0;
        scoreMap = {};
        $("#cscSoloBonusInput").val("");
        createScoreMap();
    }
    else if (value === "yashadox") {
        soloBonus = 1;
        scoreMap = {
            1: { 0: 0, 1: 1 },
            2: { 0: 0, 1: 1, 2: 1.75 },
            3: { 0: 0, 1: 1, 2: 1.75, 3: 2.25 },
            4: { 0: 0, 1: 1, 2: 1.75, 3: 2.25, 4: 2.5 }
        };
        $("#cscSoloBonusInput").val(soloBonus);
        createScoreMap(4);
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
    localStorage.setItem("customScoreCounter", JSON.stringify({
        hotKeys
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
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
        #cscHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
        }
    `;
    let style = document.getElementById("customScoreCounterStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "customScoreCounterStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
