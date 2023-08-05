// ==UserScript==
// @name         AMQ New Game Mode UI
// @namespace    https://github.com/kempanator
// @version      0.21
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
if (document.querySelector("#loginPage")) return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.21";
let ngmWindow;
let initialGuessCount = []; //list of initial # guesses for your team [5, 5, 5, 5]
let guessCounter = []; //list of current # guesses for your team [4, 2, 1, 3]
let countButtons = []; //list of jQuery objects of count buttons
let answers = {}; //{0: {id: 0, text: "text", speed: 5000, valid: false}, ...}
let teamNumber = null; //your team number
let teamList = []; //list of gamePlayerIds of everyone on your team
let teamSlot = null; //your index # on your team
let correctGuesses = 0; //total correct guesses from your team
let remainingGuesses = 0; //total remaining guesses from your team
let autoTrackCount = false;
let autoThrowSelfCount = false;
let autoSendTeamCount = 0; //0: off, 1: team chat, 2: regular chat
let halfModeList = []; //list of your teammates with half point deductions enabled [true, false, true, false]
let autocomplete = []; //store lowercase version for faster compare speed
let answerValidation = 1; //0: none, 1: normal, 2: strict
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
            if (autoThrowSelfCount && guessCounter.length) {
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
            answers[payload.gamePlayerId] = {id: payload.gamePlayerId, text: payload.answer};
        }
    }).bindListener();
    new Listener("player answers", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === 3) {
            Object.keys(answers).forEach((id) => answers[id].speed = amqAnswerTimesUtility.playerTimes[id]);
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === 3) {
            let halfMode = halfModeList.some((x) => x === true);
            if (autoTrackCount && Object.keys(answers).length) {
                let selfPlayer = payload.players.find((player) => player.gamePlayerId === quiz.ownGamePlayerId);
                if (selfPlayer.correct) {
                    let allCorrectAnime = payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).map((x) => x.toLowerCase());
                    let correctAnswers = Object.values(answers).filter((answer) => allCorrectAnime.includes(answer.text.toLowerCase()));
                    let fastestSpeed = Math.min(...correctAnswers.map((answer) => answer.speed));
                    let fastestPlayers = correctAnswers.filter((answer) => answer.speed === fastestSpeed);
                    if (fastestPlayers.length === 1) {
                        let index = teamList.indexOf(fastestPlayers[0].id);
                        countButtons[index].addClass("ngmAnimateCorrect");
                        setTimeout(() => { countButtons[index].removeClass("ngmAnimateCorrect") }, 2000);
                        if (halfMode) {
                            guessCounter[index] -= 1;
                            if (guessCounter.every((x) => x <= 0)) guessCounter = [...initialGuessCount];
                        }
                        else {
                            if (remainingGuesses === 1) guessCounter = [...initialGuessCount];
                            else guessCounter[index] -= 1;
                        }
                        countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
                        if (autoSendTeamCount === 1) sendChatMessage(guessCounter.join(halfMode ? " " : ""), true);
                        else if (autoSendTeamCount === 2) sendChatMessage(guessCounter.join(halfMode ? " " : ""), false);
                    }
                    else {
                        gameChat.systemMessage("NGM auto track: couldn't determine who answered");
                        console.log({allCorrectAnime, answers, correctAnswers, fastestSpeed, fastestPlayers});
                    }
                }
                else {
                    let validAnswers = [];
                    Object.values(answers).forEach((answer) => { answer.valid = autocomplete.includes(answer.text.toLowerCase()) });
                    if (answerValidation === 0 ) {
                        validAnswers = Object.values(answers).filter((answer) => answer.text.trim());
                    }
                    else if (answerValidation === 1) {
                        validAnswers = Object.values(answers).filter((answer) => answer.valid);
                        if (validAnswers.length === 0) validAnswers = Object.values(answers).filter((answer) => answer.text.trim());
                    }
                    else if (answerValidation === 2) {
                        validAnswers = Object.values(answers).filter((answer) => answer.valid);
                    }
                    if (validAnswers.length) {
                        let fastestSpeed = Math.min(...validAnswers.map((answer) => answer.speed));
                        let fastestPlayers = validAnswers.filter((answer) => answer.speed === fastestSpeed);
                        if (fastestPlayers.length === 1) {
                            let index = teamList.indexOf(fastestPlayers[0].id);
                            if (halfModeList[index]) {
                                countButtons[index].addClass("ngmAnimateWrong");
                                setTimeout(() => { countButtons[index].removeClass("ngmAnimateWrong") }, 2000);
                                guessCounter[index] -= .5;
                                if (guessCounter.every((x) => x <= 0)) guessCounter = [...initialGuessCount];
                                countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
                                if (autoSendTeamCount === 1) sendChatMessage(guessCounter.join(halfMode ? " " : ""), true);
                                else if (autoSendTeamCount === 2) sendChatMessage(guessCounter.join(halfMode ? " " : ""), false);
                            }
                        }
                    }
                }
            }
            correctGuesses = payload.players.find((player) => player.gamePlayerId === quiz.ownGamePlayerId).correctGuesses;
            $("#ngmCorrectAnswers").text(`Correct Answers: ${correctGuesses}`);
            if (halfMode) {
                remainingGuesses = null;
            }
            else if (initialGuessCount.length) {
                let totalGuesses = initialGuessCount.reduce((a, b) => a + b);
                remainingGuesses = totalGuesses - (correctGuesses % totalGuesses);
            }
            else {
                remainingGuesses = null;
            }
            $("#ngmRemainingGuesses").text(remainingGuesses ? `Remaining Guesses: ${remainingGuesses}` : "");
        }
    }).bindListener();
    new Listener("get all song names", () => {
        setTimeout(() => {
            autocomplete = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 10);
    }).bindListener();
    new Listener("update all song names", () => {
        setTimeout(() => {
            autocomplete = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 10);
    }).bindListener();

    ngmWindow = new AMQWindow({
        id: "ngmWindow",
        title: "NGM",
        width: 180,
        height: 282,
        minWidth: 180,
        minHeight: 70,
        zIndex: 1060,
        resizable: true,
        draggable: true
    });
    ngmWindow.addPanel({
        id: "ngmPanel",
        width: 1.0,
        height: "100%"
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

function clearWindow() {
    $("#ngmGuessContainer").empty().append($(`<div id="ngmNotInGame">Not in team game with lives</div>`));
    $("#ngmCorrectAnswers").text("");
    $("#ngmRemainingGuesses").text("");
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
    let $ngmGuessContainer = $("#ngmGuessContainer");
    $ngmGuessContainer.empty();
    let selfPlayer = players.find((player) => player.name === selfName);
    teamNumber = selfPlayer.teamNumber;
    teamList = players.filter((player) => player.teamNumber === teamNumber).map((player) => player.gamePlayerId);
    teamSlot = teamList.indexOf(selfPlayer.gamePlayerId);
    correctGuesses = selfPlayer.correctGuesses;
    countButtons = Array(teamList.length);
    for (let i = 0; i < teamList.length; i++) {
        let $button = $(`<div class="ngmButton ngmCount"></div>`).click(() => {
            guessCounter[i] <= 0 ? guessCounter[i] = initialGuessCount[i] : guessCounter[i] -= (halfModeList[i] ? .5 : 1);
            countButtons[i].text(guessCounter[i]);
        });
        countButtons[i] = $button;
        $ngmGuessContainer.append($button);
    }
    resetCounter();
}

// reset counter
function resetCounter() {
    if (!teamList.length) return;
    let countText = $("#ngmInitialGuessCountInput").val().trim();
    if ($("#ngmHalfGuessInput").hasClass("disabled")) {
        halfModeList = Array(teamList.length).fill(false);
        $("#ngmTitle").text("NGM");
    }
    else {
        let halfText = $("#ngmHalfGuessInput").val().trim().toLowerCase();
        if (halfText) {
            if (halfText.length === teamList.length && /^[h-]+$/.test(halfText)) {
                halfModeList = halfText.split("").map((x) => x === "h");
            }
            else {
                return counterError();
            }
        }
        else {
            halfModeList = Array(teamList.length).fill(true);
        }
        $("#ngmTitle").text("NGM .5");
    }
    if (/^[0-9]+$/.test(countText)) {
        if (countText.length === 1) {
            initialGuessCount = Array(teamList.length).fill(parseInt(countText));
        }
        else if (countText.length === teamList.length) {
            initialGuessCount = countText.split("").map((x) => parseInt(x));
        }
        else {
            return counterError();
        }
        guessCounter = [...initialGuessCount];
        countButtons.forEach((element, i) => { element.removeClass("disabled").text(guessCounter[i]) });
        let totalGuesses = initialGuessCount.reduce((a, b) => a + b);
        if (totalGuesses === 0) {
            return counterError();
        }
        else {
            remainingGuesses = halfModeList.some((x) => x === true) ? null : totalGuesses - (correctGuesses % totalGuesses);
            $("#ngmRemainingGuesses").text(remainingGuesses ? `Remaining Guesses: ${remainingGuesses}` : "");
        }
    }
    else {
        return counterError();
    }
    $("#ngmCorrectAnswers").text(`Correct Answers: ${correctGuesses}`);
}

// disable counter when initial guess count is invalid
function counterError() {
    guessCounter = [];
    initialGuessCount = [];
    halfModeList = [];
    countButtons.forEach((x) => x.addClass("disabled").text("-"));
    $("#ngmCorrectAnswers").text("Invalid Settings");
    $("#ngmRemainingGuesses").text("");
}

// setup ngm window
function setupNGMWindow() {
    ngmWindow.window.find(".modal-header h2").remove();
    ngmWindow.window.find(".modal-header").append(`<div id="ngmTitle">NGM</div><div id="ngmCorrectAnswers"></div><div id="ngmRemainingGuesses"></div>`);
    ngmWindow.panels[0].panel.append(`<div id="ngmGuessContainer" class="ngmRow"><div id="ngmNotInGame">Not in team game with lives</div></div>`);
    let $row1 = $(`<div class="ngmRow"></div>`);
    let $row2 = $(`<div class="ngmRow"></div>`);
    let $row3 = $(`<div class="ngmRow"></div>`);
    let $row4 = $(`<div class="ngmRow"></div>`);
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
    $row2.append($(`<div class="ngmButton" style="width: 60px; background-color: #ffffff; border-color: #cccccc; color: #000000;">Reset</div>`)
        .click(() => {
            quiz.inQuiz ? resetCounter() : clearWindow();
        })
    );
    $row2.append($(`<input type="text" id="ngmInitialGuessCountInput">`)
        .popover({
            title: "Initial Guess Count",
            content: "<p>use a single number to give everyone on your team the specified guess count</p><p>use several numbers to give each person on your team a different guess count</p><p>example: 5 or 5454</p>",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
        .val("5")
    );
    $row3.append($(`<div class="ngmButton" style="width: 50px; background-color: #ffffff; border-color: #cccccc; color: #000000;">Half</div>`)
        .click(function() {
            if ($("#ngmHalfGuessInput").hasClass("disabled")) {
                $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
                $("#ngmHalfGuessInput").removeClass("disabled");
                $("#ngmAnswerValidationButton").removeClass("disabled");
            }
            else {
                $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#000000"});
                $("#ngmHalfGuessInput").addClass("disabled");
                $("#ngmAnswerValidationButton").addClass("disabled");
            }
        })
        .popover({
            title: "Half Point Deductions",
            content: "Lose .5 points if you answer incorrectly",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row3.append($(`<input type="text" id="ngmHalfGuessInput" class="disabled">`)
        .popover({
            title: "",
            content: `<p>For each person on your team (in order) type "h" or "-" to enable/disable half point deductions</p><p>Example: h-h-</p><p>Leave blank to enable for everyone</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row3.append($(`<div id="ngmAnswerValidationButton" class="ngmButton disabled" style="width: 34px; background-color: #4497ea; border-color: #006ab7; color: #ffffff;"><i class="fa fa-check" aria-hidden="true"></i></div>`)
        .click(function() {
            answerValidation = (answerValidation + 1) % 3;
            if (answerValidation === 0) {
                $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#333333"});
            }
            else if (answerValidation === 1) {
                $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            }
            else if (answerValidation === 2) {
                $(this).css({"background-color": "#9444EA", "border-color": "#6C00B7", "color": "#ffffff"});
            }
        })
        .popover({
            title: "Answer Validation",
            content: `<p>White: None<br>deduct .5 if the person has any text in their answer box</p><p>Blue: Normal<br>if at least 1 valid answer do strict mode, else none</p><p>Purple: Strict<br>only deduct .5 on valid answers</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($(`<div class="ngmButton" style="width: 50px; background-color: #ffffff; border-color: #cccccc; color: #000000;">Auto</div>`)
        .click(function() {
            autoTrackCount = !autoTrackCount;
            if (autoTrackCount) {
                $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
                $("#ngmSelfCountButton").removeClass("disabled");
                $("#ngmTeamCountButton").removeClass("disabled");
            }
            else {
                $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#000000"});
                $("#ngmSelfCountButton").addClass("disabled");
                $("#ngmTeamCountButton").addClass("disabled");
            }
        })
        .popover({
            title: "Auto Track",
            content: "<p>Attempt to auto update team guess counter</p>",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($(`<div id="ngmSelfCountButton" class="ngmButton disabled" style="width: 34px; background-color: #ffffff; border-color: #cccccc; color: #333333;"><i class="fa fa-user" aria-hidden="true"></i></div>`)
        .click(function() {
            autoThrowSelfCount = !autoThrowSelfCount;
            if (autoThrowSelfCount) {
                $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            }
            else {
                $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#333333"});
            }
        })
        .popover({
            title: "Auto Throw Self Count",
            content: "When a song starts, send your current count to the answer box",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($(`<div id="ngmTeamCountButton"class="ngmButton disabled" style="width: 34px; background-color: #ffffff; border-color: #cccccc; color: #333333;"><i class="fa fa-comment" aria-hidden="true"></i></div>`)
        .click(function() {
            autoSendTeamCount = (autoSendTeamCount + 1) % 3;
            if (autoSendTeamCount === 0) {
                $(this).css({"background-color": "#ffffff", "border-color": "#cccccc", "color": "#333333"});
            }
            else if (autoSendTeamCount === 1) {
                $(this).css({"background-color": "#4497ea", "border-color": "#006ab7", "color": "#ffffff"});
            }
            else if (autoSendTeamCount === 2) {
                $(this).css({"background-color": "#9444EA", "border-color": "#6C00B7", "color": "#ffffff"});
            }
        })
        .popover({
            title: "Auto Send Team Count",
            content: "<p>On answer reveal, send team guess count to chat</p><p>Blue: team chat<br>Purple: public chat</p>",
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    ngmWindow.panels[0].panel.append($row1).append($row2).append($row3).append($row4);
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
        #ngmWindow .modal-header {
            height: 74px;
            padding: 0;
            line-height: normal;
        }
        #ngmWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #ngmTitle {
            font-size: 20px;
            font-weight: bold;
            padding: 3px 3px 8px 3px;
        }
        #ngmCorrectAnswers, #ngmRemainingGuesses {
            padding: 0 3px;
        }
        #ngmGuessContainer {
            padding-top: 3px;
        }
        .ngmRow {
            margin: 0 2px;
        }
        .ngmButton {
            border: 1px solid transparent;
            border-radius: 4px;
            font-size: 14px;
            text-align: center;
            padding: 6px 0px;
            margin: 3px;
            display: inline-block;
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
        .ngmAnimateCorrect {
            animation: ngmColorAnimationBlue 2s ease-in;
        }
        .ngmAnimateWrong {
            animation: ngmColorAnimationRed 2s ease-in;
        }
        @keyframes ngmColorAnimationBlue {
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
        @keyframes ngmColorAnimationRed {
            from {
                background-color: #d9534f;
                border-color: #d43f3a;
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
        #ngmNotInGame {
            text-align: center;
            line-height: normal;
            margin: 12px 0;
        }
        #ngmInitialGuessCountInput, #ngmHalfGuessInput {
            color: black;
            width: 60px;
            margin: 0 3px;
            border-radius: 4px;
            padding: 6px 6px;
            border: 1px solid #cccccc;
        }
    `));
    document.head.appendChild(style);
}
