// ==UserScript==
// @name         AMQ New Game Mode UI
// @namespace    https://github.com/kempanator
// @version      0.10
// @description  Adds a user interface to new game mode to keep track of guesses
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqNewGameModeUI.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqNewGameModeUI.user.js
// ==/UserScript==

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.10";
let ngmWindow;
let numGuesses = 5;
let guessCounter = [];
let countButtons = [];
let teamNumber = null; // your team number
let teamList = null; // list of everyone on your team
let teamSlot = null; // your index # on your team
let correctGuesses = 0; // total correct guesses from your team
let remainingGuesses = 0; // total remaining guesses from your team
let autothrowCount = false;
$("#qpOptionContainer").width($("#qpOptionContainer").width() + 35);
$("#qpOptionContainer > div").append($(`<div id="qpNGM" class="clickAble qpOption"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAMAAAAM7l6QAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAGUExURdnZ2QAAAE/vHxMAAAACdFJOU/8A5bcwSgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAFdJREFUOE/VjsENwCAMA8n+S4NN09qI9lOBxL0cXxSlxCen69JgGFmsoRIUymoNGGds0K+41iuMqiFZ5mCajuSgmoWBsrt73W+4flIOqq8km/rajD86ogIU2QKttGjahwAAAABJRU5ErkJggg=='/></div>`)
    .click(() => {
        if (ngmWindow.isVisible()) ngmWindow.close();
        else ngmWindow.open();
    })
    .popover({
        content: "New Game Mode UI",
        trigger: "hover",
        placement: "bottom"
    })
);

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName && message.message === "/version") {
                setTimeout(() => { gameChat.systemMessage("New Game Mode UI - " + version) }, 1);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName && payload.message === "/version") {
            setTimeout(() => { gameChat.systemMessage("New Game Mode UI - " + version) }, 1);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        let selfPlayer = payload.players.find((player) => player.name === selfName);
        let settings = hostModal.getSettings();
        if (selfPlayer?.inGame && settings.teamSize > 1 && settings.scoreType === 3) {
            updateWindow(payload.players);
        }
        else {
            clearWindow();
        }
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.quizState && payload.settings.teamSize > 1 && payload.settings.scoreType === 3) {
            updateWindow(payload.quizState.players);
        }
        else {
            clearWindow();
        }
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        clearWindow();
    }).bindListener();
    new Listener("quiz over", (payload) => {
        clearWindow();
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (autothrowCount && guessCounter.length && hostModal.getSettings().scoreType === 3) {
            setTimeout(() => {
                socket.sendCommand({
                    type: "quiz",
                    command: "quiz answer",
                    data: {answer: String(guessCounter[teamSlot]), isPlaying: true, volumeAtMax: false}
                });
            }, 100);
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.getSettings().scoreType === 3) {
            correctGuesses = payload.players.find((player) => player.gamePlayerId === quiz.ownGamePlayerId).correctGuesses;
            remainingGuesses = (teamList.length * numGuesses) - (correctGuesses % (teamList.length * numGuesses));
            $("#ngmCorrectAnswers").text(`Correct Answers: ${correctGuesses}`);
            $("#ngmRemainingGuesses").text(`Remaining Guesses: ${remainingGuesses}`);
        }
    }).bindListener();

    ngmWindow = new AMQWindow({
        id: "ngmWindow",
        title: "NGM",
        width: 170,
        height: 270,
        minWidth: 170,
        minHeight: 70,
        zIndex: 1060,
        resizable: true,
        draggable: true
    });
    ngmWindow.addPanel({
        id: "ngmPanel",
        width: 1.0,
        height: "100%",
    });
    clearWindow();

    AMQ_addScriptData({
        name: "New Game Mode UI",
        author: "kempanator",
        description: `<p>Click the button in the options bar during quiz to open the new game mode user interface</p>`
    });
    applyStyles();
}

function clearWindow() {
    ngmWindow.panels[0].clear();
    ngmWindow.panels[0].panel.append($(`<div style="text-align: center">Not in team game with lives</div>`));
    guessCounter = [];
    countButtons = [];
    teamNumber = null;
    teamList = null;
    teamSlot = null;
    correctGuesses = 0;
    remainingGuesses = 0;
}

// input array of Player objects
function updateWindow(players) {
    ngmWindow.panels[0].clear();
    selfPlayer = players.find((player) => player.name === selfName);
    teamNumber = selfPlayer.teamNumber;
    teamList = players.filter((player) => player.teamNumber === teamNumber).map((player) => player.name);
    teamSlot = teamList.indexOf(selfName);
    guessCounter = Array(teamList.length).fill(numGuesses);
    countButtons = Array(teamList.length);
    correctGuesses = selfPlayer.correctGuesses;
    remainingGuesses = (teamList.length * numGuesses) - (correctGuesses % (teamList.length * numGuesses));
    let $row1 = $(`<div class="ngmRow"></div>`);
    let $row2 = $(`<div class="ngmRow"></div>`);
    let $row3 = $(`<div class="ngmRow"></div>`);
    let $row4 = $(`<div class="ngmRow"></div>`);
    let $row5 = $(`<div class="ngmRow"></div>`);
    let $row6 = $(`<div class="ngmRow" style="padding-top: 3px"></div>`);
    $row1.append($(`<span id="ngmCorrectAnswers" style="padding: 0 3px">Correct Answers: ${correctGuesses}</span>`));
    $row2.append($(`<span id="ngmRemainingGuesses" style="padding: 0 3px">Remaining Guesses: ${remainingGuesses}</span>`));
    for (let i = 0; i < guessCounter.length; i++) {
        let $button = $(`<button class="btn btn-default ngmButton">${guessCounter[i]}</button>`).click(() => {
            guessCounter[i] === 0 ? guessCounter[i] = numGuesses : guessCounter[i]--;
            countButtons[i].text(guessCounter[i]);
        });
        countButtons[i] = $button;
        $row3.append($button);
    }
    $row4.append($(`<button class="btn btn-danger ngmButton ngmStatus"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAArSURBVDhPYxgFo2AQAEYozfAfCKBMsgAjEIBoJjCPimDwGzgKRsHAAwYGACL9BAgJlOpKAAAAAElFTkSuQmCC'/></button>`)
        .click(() => {
            sendGuess("-");
        })
    );
    $row4.append($(`<button class="btn btn-warning ngmButton ngmStatus"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAGUExURf///wAAAFXC034AAAACdFJOU/8A5bcwSgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAADlJREFUKFPNiskNACAMw5r9l6ZnlEq8Ef7UmBgu/BDNSXHa45TNg83hQNowP3vfJ0jloJo4i/IoAgcIXQE9Oa5xnQAAAABJRU5ErkJggg=='/></button>`)
        .click(() => {
            sendGuess("~");
        })
    );
    $row4.append($(`<button class="btn btn-success ngmButton ngmStatus"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA9SURBVDhPYxj0gBFK4wT/gQDKBANGIIAysQImKE01MGog5QAeY+ixSSqAxf5IDkNcYDSnEASD38DBDhgYAD/fDB70XVBaAAAAAElFTkSuQmCC'/></button>`)
        .click(() => {
            sendGuess("+");
        })
    );
    $row5.append($(`<button class="btn btn-default ngmButton">Reset</button>`)
        .click(() => {
            guessCounter = Array(teamList.length).fill(numGuesses);
            countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
        })
    );
    $row5.append($(`<button id="ngmCountNumberButton" class="btn btn-info ngmButton">${numGuesses}</button>`)
        .click(() => {
            numGuesses === 1 ? numGuesses = 9 : numGuesses--;
            $("#ngmCountNumberButton").text(numGuesses);
            guessCounter = Array(teamList.length).fill(numGuesses);
            countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
        })
        .popover({
            content: "# of guesses per person",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false
        })
    );
    $row5.append($(`<button type="button" class="btn btn-primary ngmButton"><i aria-hidden="true" class="fa fa-comment"></i></button>`)
        .click(() => {
            socket.sendCommand({
                type: "lobby",
                command: "game chat message",
                data: {msg: guessCounter.join(""), teamMessage: $("#gcTeamChatSwitch").hasClass("active")}
            });
        })
        .popover({
            content: "send team count to chat",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false
        })
    );
    $row6.append($(`<span id="ngmAutoThrowCountText" style="padding: 0 3px">Autothrow count</span>`)
        .popover({
            content: "automatically send your # of remaining guesses at the beginning of each song",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false
        })
    );
    $row6.append($(`
        <div class="customCheckbox" style="margin-left: 3px; vertical-align: middle;">
            <input type="checkbox" id="ngmAutoThrowCountCheckbox">
            <label for="ngmAutoThrowCountCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>
        </div>
    `));
    $row6.find("#ngmAutoThrowCountCheckbox").click(() => { autothrowCount = !autothrowCount; });
    ngmWindow.panels[0].panel.append($row1);
    ngmWindow.panels[0].panel.append($row2);
    ngmWindow.panels[0].panel.append($row3);
    ngmWindow.panels[0].panel.append($row4);
    ngmWindow.panels[0].panel.append($row5);
    ngmWindow.panels[0].panel.append($row6);
}

// send your remaining guess count and status to answer box
function sendGuess(guess) {
    socket.sendCommand({
        type: "quiz",
        command: "quiz answer",
        data: {answer: guessCounter[teamSlot] + guess, isPlaying: true, volumeAtMax: false}
    });
}

// apply styles
function applyStyles() {
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "newGameModeUIStyle";
    style.appendChild(document.createTextNode(`
        #qpNGM {
            width: 30px;
            margin-right: 5px;
        }
        .ngmRow {
            margin: 0 2px;
        }
        .ngmButton {
            margin: 3px;
        }
        .ngmStatus {
            padding: 6px;
        }
    `));
    document.head.appendChild(style);
}
