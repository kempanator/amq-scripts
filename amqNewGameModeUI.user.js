// ==UserScript==
// @name         AMQ New Game Mode UI
// @namespace    https://github.com/kempanator
// @version      0.15
// @description  Adds a user interface to new game mode to keep track of guesses
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @require      https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqAnswerTimesUtility.user.js
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

const version = "0.15";
let ngmWindow;
let initialGuessCount = []; // list of initial # guesses for your team [5, 5, 5, 5]
let guessCounter = []; // list of current # guesses for your team [4, 2, 1, 3]
let countButtons = []; // list of jQuery objects of count buttons
let answers = {}; //{0: {id: 0, text: "text", speed: 5000}, ...}
let teamNumber = null; // your team number
let teamList = []; // list of gamePlayerIds of everyone on your team
let teamSlot = null; // your index # on your team
let correctGuesses = 0; // total correct guesses from your team
let remainingGuesses = 0; // total remaining guesses from your team
let autoTrackCount = false;
let autothrowSelfCount = false;
let autoSendTeamCount = 0; //0: off, 1: team chat, 2: regular chat
$("#qpOptionContainer").width($("#qpOptionContainer").width() + 35);
$("#qpOptionContainer > div").append($(`<div id="qpNGM" class="clickAble qpOption"><img class="qpMenuItem" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAGUExURdnZ2QAAAE/vHxMAAAACdFJOU/8A5bcwSgAAAAlwSFlzAAAOwgAADsIBFShKgAAAAEpJREFUKFO9jEESABAMA/X/nyahJIYje0qynZYApcGw81hDJRiU1xownvigr7jWL4yqITlmMU1HsqjmYGDsbp77D9crZVE90rqMqNWrAYH0hYPXAAAAAElFTkSuQmCC"></div>`)
    .click(() => {
        ngmWindow.isVisible() ? ngmWindow.close() : ngmWindow.open();
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
            if (message.sender === selfName) parseMessage(message.message);
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName) parseMessage(payload.message);
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        let selfPlayer = payload.players.find((player) => player.name === selfName);
        if (selfPlayer?.inGame && hostModal.$teamSize.slider("getValue") > 1 && hostModal.$scoring.slider("getValue") === 3) {
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
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === 3) {
            answers = {};
            if (autothrowSelfCount && guessCounter.length) {
                setTimeout(() => {
                    socket.sendCommand({
                        type: "quiz",
                        command: "quiz answer",
                        data: {answer: String(guessCounter[teamSlot]), isPlaying: true, volumeAtMax: false}
                    });
                }, 100);
            }
        }
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (quiz.teamMode && hostModal.$scoring.slider("getValue") === 3) {
            answers[payload.gamePlayerId] = {
                id: payload.gamePlayerId,
                text: payload.answer
            };
        }
    }).bindListener();
    new Listener("player answers", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === 3) {
            Object.keys(answers).forEach((id) => answers[id].speed = amqAnswerTimesUtility.playerTimes[id]);
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === 3) {
            if (autoTrackCount) {
                let selfPlayer = payload.players.find((player) => player.gamePlayerId === quiz.ownGamePlayerId);
                if (selfPlayer.correct && Object.keys(answers).length) {
                    let allCorrectAnime = payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).map((x) => x.toLowerCase());
                    let correctAnswers = Object.values(answers).filter((answer) => allCorrectAnime.includes(answer.text.toLowerCase()));
                    let fastestSpeed = Math.min(...correctAnswers.map((answer) => answer.speed));
                    let fastestPlayers = correctAnswers.filter((answer) => answer.speed === fastestSpeed);
                    if (fastestPlayers.length === 1) {
                        let index = teamList.indexOf(fastestPlayers[0].id);
                        countButtons[index].addClass("ngmAnimate");
                        setTimeout(() => { countButtons[index].removeClass("ngmAnimate") }, 2000);
                        remainingGuesses === 1 ? guessCounter = [...initialGuessCount] : guessCounter[index]--;
                        countButtons.forEach((element, i) => { element.removeClass("disabled").text(guessCounter[i]) });
                        if (autoSendTeamCount === 1) sendChatMessage(guessCounter.join(""), true);
                        else if (autoSendTeamCount === 2) sendChatMessage(guessCounter.join(""), false);
                    }
                    else {
                        gameChat.systemMessage("NGM auto track: couldn't determine who answered");
                        console.log({allCorrectAnime, answers, correctAnswers, fastestSpeed, fastestPlayers});
                    }
                }       
            }
            let totalGuesses = initialGuessCount.reduce((a, b) => a + b);
            correctGuesses = payload.players.find((player) => player.gamePlayerId === quiz.ownGamePlayerId).correctGuesses;
            remainingGuesses = totalGuesses - (correctGuesses % totalGuesses);
            $("#ngmCorrectAnswers").text(`Correct Answers: ${correctGuesses}`);
            $("#ngmRemainingGuesses").text(`Remaining Guesses: ${remainingGuesses}`);
        }
    }).bindListener();

    ngmWindow = new AMQWindow({
        id: "ngmWindow",
        title: "NGM",
        width: 180,
        height: 280,
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
    setupNGMWindow();

    AMQ_addScriptData({
        name: "New Game Mode UI",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <p>Click the button in the options bar during quiz to open the new game mode user interface</p>
        `
    });
    applyStyles();
}

function clearWindow() {
    $("#ngmActionContainer").empty().append($(`<div class="ngmNotInGame">Not in team game with lives</div>`));
    guessCounter = [];
    countButtons = [];
    teamNumber = null;
    teamList = [];
    teamSlot = null;
    correctGuesses = 0;
    remainingGuesses = 0;
}

// input array of Player objects
function updateWindow(players) {
    $("#ngmActionContainer").empty();
    let selfPlayer = players.find((player) => player.name === selfName);
    teamNumber = selfPlayer.teamNumber;
    teamList = players.filter((player) => player.teamNumber === teamNumber).map((player) => player.gamePlayerId);
    teamSlot = teamList.indexOf(selfPlayer.gamePlayerId);
    correctGuesses = selfPlayer.correctGuesses;
    countButtons = Array(teamList.length);
    let $row1 = $(`<div class="ngmRow"></div>`);
    let $row2 = $(`<div class="ngmRow"></div>`);
    let $row3 = $(`<div class="ngmRow"></div>`);
    $row1.append($(`<span id="ngmCorrectAnswers" style="padding: 0 3px">Correct Answers: ${correctGuesses}</span>`));
    $row2.append($(`<span id="ngmRemainingGuesses" style="padding: 0 3px">Remaining Guesses:</span>`));
    for (let i = 0; i < teamList.length; i++) {
        let $button = $(`<div class="ngmButton ngmCount"></div>`).click(() => {
            guessCounter[i] <= 0 ? guessCounter[i] = initialGuessCount[i] : guessCounter[i]--;
            countButtons[i].text(guessCounter[i]);
        });
        countButtons[i] = $button;
        $row3.append($button);
    }
    $("#ngmActionContainer").append($row1).append($row2).append($row3);
    resetCounter();
}

// parse message
function parseMessage(content) {
    if (content === "/version") {
        setTimeout(() => { gameChat.systemMessage("New Game Mode UI - " + version) }, 1);
    }
    else if (content === "/ngm") {
        ngmWindow.isVisible() ? ngmWindow.close() : ngmWindow.open();
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

// reset counter
function resetCounter() {
    if (!teamList.length) return;
    let text = $("#ngmInitialGuessCountInput").val().trim();
    if (/^[0-9]+$/.test(text)) {
        if (text.length === 1) {
            initialGuessCount = Array(teamList.length).fill(parseInt(text));
            guessCounter = [...initialGuessCount];
            countButtons.forEach((element, i) => { element.removeClass("disabled").text(guessCounter[i]) });
            let totalGuesses = initialGuessCount.reduce((a, b) => a + b);
            if (totalGuesses === 0) {
                counterError();
            }
            else {
                remainingGuesses = totalGuesses - (correctGuesses % totalGuesses);
                $("#ngmRemainingGuesses").text(`Remaining Guesses: ${remainingGuesses}`);
            }
        }
        else if (text.length === teamList.length) {
            initialGuessCount = text.split("").map((x) => parseInt(x));
            guessCounter = [...initialGuessCount];
            countButtons.forEach((element, i) => { element.removeClass("disabled").text(guessCounter[i]) });
            let totalGuesses = initialGuessCount.reduce((a, b) => a + b);
            if (totalGuesses === 0) {
                counterError();
            }
            else {
                remainingGuesses = totalGuesses - (correctGuesses % totalGuesses);
                $("#ngmRemainingGuesses").text(`Remaining Guesses: ${remainingGuesses}`);
            }
        }
        else {
            counterError();
        }
    }
    else {
        counterError();
    }
}

// disable counter when initial guess count is invalid
function counterError() {
    guessCounter = [];
    initialGuessCount = [];
    countButtons.forEach((x) => x.addClass("disabled").text("-"));
}

// setup ngm window
function setupNGMWindow() {
    ngmWindow.panels[0].panel.append(`<div id="ngmActionContainer"></div><div id="ngmSettingsContainer"></div>`)
    let $row1 = $(`<div class="ngmRow"></div>`);
    let $row2 = $(`<div class="ngmRow"></div>`);
    let $row3 = $(`<div class="ngmRow"></div>`);
    let $row4 = $(`<div class="ngmRow" style="padding-top: 3px"></div>`);
    let $row5 = $(`<div class="ngmRow" style="padding-top: 3px"></div>`);
    $row1.append($(`<div class="ngmButton ngmStatus" style="background-color: #d9534f; border-color: #d43f3a; color: #ffffff"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAArSURBVDhPYxgFo2AQAEYozfAfCKBMsgAjEIBoJjCPimDwGzgKRsHAAwYGACL9BAgJlOpKAAAAAElFTkSuQmCC'/></div>`)
        .click(() => {
            sendChatMessage("-", true);
        })
    );
    $row1.append($(`<div class="ngmButton ngmStatus" style="background-color: #f0ad4e; border-color: #eea236; color: #ffffff;"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAGUExURf///wAAAFXC034AAAACdFJOU/8A5bcwSgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAADlJREFUKFPNiskNACAMw5r9l6ZnlEq8Ef7UmBgu/BDNSXHa45TNg83hQNowP3vfJ0jloJo4i/IoAgcIXQE9Oa5xnQAAAABJRU5ErkJggg=='/></div>`)
        .click(() => {
            sendChatMessage("~", true);
        })
    );
    $row1.append($(`<div class="ngmButton ngmStatus" style="background-color: #5cb85c; border-color: #4cae4c; color: #ffffff;"><img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA9SURBVDhPYxj0gBFK4wT/gQDKBANGIIAysQImKE01MGog5QAeY+ixSSqAxf5IDkNcYDSnEASD38DBDhgYAD/fDB70XVBaAAAAAElFTkSuQmCC'/></div>`)
        .click(() => {
            sendChatMessage("+", true);
        })
    );
    $row2.append($(`<div class="ngmButton" style="background-color: #ffffff; border-color: #cccccc; color: #000000;">Reset</div>`)
        .click(() => {
            resetCounter();
        })
    );
    $row2.append($(`<input type="text" id="ngmInitialGuessCountInput">`).val("5"));
    $row3.append($(`<div class="ngmButton" style="background-color: #ffffff; border-color: #cccccc; color: #000000;">Auto</div>`)
        .click(function() {
            autoTrackCount = !autoTrackCount;
            if (autoTrackCount) $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            else $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#000000"});
        })
        .popover({
            content: "attempt to auto update team guess counter",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false
        })
    );
    $row3.append($(`<div class="ngmButton" style="background-color: #ffffff; border-color: #cccccc; color: #333333;"><i class="fa fa-user" aria-hidden="true"></i></div>`)
        .click(function() {
            autothrowSelfCount = !autothrowSelfCount;
            if (autothrowSelfCount) $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            else $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#333333"});
        })
        .popover({
            content: "auto throw your guess count",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false
        })
    );
    $row3.append($(`<div class="ngmButton" style="background-color: #ffffff; border-color: #cccccc; color: #333333;"><i class="fa fa-comment" aria-hidden="true"></i></div>`)
        .click(function() {
            autoSendTeamCount = (autoSendTeamCount + 1) % 3;
            if (autoSendTeamCount === 0) $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#333333"});
            else if (autoSendTeamCount === 1) $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            else if (autoSendTeamCount === 2) $(this).css({"background-color": "#9444EA", "border-color": "#6C00B7", "color": "#ffffff"});
        })
        .popover({
            content: "auto send team count to chat<br>blue: team chat<br>purple: public chat",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row3.find("#ngmAutoTrackCountCheckbox").prop("checked", autoTrackCount).click(() => { autoTrackCount = !autoTrackCount });
    $row4.find("#ngmAutoThrowSelfCountCheckbox").prop("checked", autothrowSelfCount).click(() => { autothrowSelfCount = !autothrowSelfCount });
    $row5.find("#ngmAutoSendTeamCountCheckbox").prop("checked", autoSendTeamCount).click(() => { autoSendTeamCount = !autoSendTeamCount });
    $("#ngmSettingsContainer").append($row1).append($row2).append($row3).append($row4).append($row5);
    $("#ngmActionContainer").empty().append($(`<div class="ngmNotInGame">Not in team game with lives</div>`));
}


// apply styles
function applyStyles() {
    //$("#newGameModeUIStyle").remove();
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
            border: 1px solid transparent;
            border-radius: 4px;
            font-size: 14px;
            padding: 6px 12px;
            margin: 3px;
            display: inline-block;
            vertical-align: middle;
            cursor: pointer;
            user-select: none;
        }
        .ngmButton:hover {
            opacity: 0.8;
        }
        .ngmCount {
            background-color: #ffffff;
            border-color: #cccccc;
            color: #333333;
            width: 34px;
        }
        .ngmAnimate {
            animation: ngmColorAnimation 2s ease-in;
        }
        @keyframes ngmColorAnimation {
            from {
                background-color: #4497ea;
                border-color: #006ab7;
                color: #ffffff;
            }
            to {
                background-color: #ffffff;
                border-color: #cccccc;
                color: #000000;
            }
          }
        .ngmStatus {
            padding: 6px;
        }
        .ngmNotInGame {
            text-align: center;
            margin: 10px 0;
        }
        #ngmInitialGuessCountInput {
            color: black;
            width: 60px;
            margin-left: 3px;
            border-radius: 4px;
            padding: 6px 6px;
            border: 1px solid #cccccc;
        }
    `));
    document.head.appendChild(style);
}
