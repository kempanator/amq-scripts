// ==UserScript==
// @name            AMQ New Game Mode UI
// @namespace       https://github.com/kempanator
// @version         0.1
// @description     adds a user interface to new game mode to keep track of guesses
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqNewGameModeUI.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqNewGameModeUI.js
// ==/UserScript==


if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

let ngmWindow;
let numGuesses = 5;
let guessCounter = [];
let teamNumber = null; // your team number
let teamList = null; // list of everyone on your team
let teamSlot = null; // your index # on your team
let correctGuesses = 0; // total correct guesses from your team
let autothrowCount = false;
let oldWidth = $("#qpOptionContainer").width();
$("#qpOptionContainer").width(oldWidth + 35);
$("#qpOptionContainer > div").append($(`<div id="qpNGM" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-plus qpMenuItem"></i></div>`)
    .click(() => {
        if (ngmWindow.isVisible()) {
            ngmWindow.close();
        }
        else {
            ngmWindow.open();
        }
    })
    .popover({
        content: "New Game Mode UI",
        trigger: "hover",
        placement: "bottom"
    })
);

function setup() {
    new Listener("Game Starting", (payload) => {
        setTimeout(() => { updateWindow() }, 1);
	}).bindListener();
    new Listener("Join Game", (payload) => {
        setTimeout(() => { updateWindow() }, 1);
	}).bindListener();
    new Listener("leave game",  (payload) => {
        setTimeout(() => { updateWindow() }, 1);
    }).bindListener();
    new Listener("quiz over", (payload) => {
        setTimeout(() => { updateWindow() }, 1);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (autothrowCount && guessCounter.length) {
            setTimeout(() => { sendCount() }, 100);
        }
	}).bindListener();
    new Listener("answer results", (payload) => {
        if (quiz.teamMode && !quiz.isSpectator) {
            correctGuesses = getCorrectGuesses(payload);
            $("#ngmTracker1").text(`Correct Answers: ${correctGuesses}`);
            $("#ngmTracker2").text(`Remaining Guesses: ${getRemainingGuesses()}`);     
        }
    }).bindListener();

    ngmWindow = new AMQWindow({
        id: "ngmWindow",
        title: "NGM",
        width: 180,
        height: 280,
        minWidth: 180,
        minHeight: 70,
        zIndex: 1060,
        closeHandler: undefined,
        resizable: true,
        draggable: true
    });
    ngmWindow.addPanel({
        id: "ngmPanel",
        width: 1.0,
        height: 200
    });
    updateWindow();

    AMQ_addScriptData({
        name: "New Game Mode UI",
        author: "kempanator",
        description: `<p>Click the + button in the options bar during quiz to open the new game mode user interface</p>`
    });

    AMQ_addStyle(`
        #qpNGM {
            width: 30px;
            margin-right: 5px;
        }
        .ngmText {
            margin: 0px 3px;
        }
        .ngmButton {
            margin: 3px;
        }
    `);
}

function updateWindow() {
    if (!quiz.inQuiz || quiz.isSpectator || !quiz.teamMode) {
        ngmWindow.panels[0].clear();
        ngmWindow.panels[0].panel.append($(`<div class="ngmText" style="text-align: center">Not in team game</div>`));
        guessCounter = [];
        teamNumber = null;
        teamList = null;
        teamSlot = null;
        correctGuesses = 0;
        return;
    }
    ngmWindow.panels[0].clear();
    teamNumber = getTeamNumber();
    teamList = getTeamList(teamNumber);
    teamSlot = teamList.indexOf(selfName);
    guessCounter = Array(teamList.length).fill(numGuesses);
    ngmWindow.panels[0].panel.append($(`<div id="ngmTracker1" class="ngmText">Correct Answers: ${correctGuesses}</div>`));
    ngmWindow.panels[0].panel.append($(`<div id="ngmTracker2" class="ngmText">Remaining Guesses: ${teamList.length * numGuesses}</div>`));
    for (let i = 0; i < guessCounter.length; i++) {
        ngmWindow.panels[0].panel
        .append($(`<button id="ngmCountButton${i}" class="btn btn-default ngmButton">${guessCounter[i]}</button>`)
            .click(() => {
                updateCount(i);
                updateCountButtons();
            })
        );
    }
    ngmWindow.panels[0].panel.append($(`<br>`));
    ngmWindow.panels[0].panel
        .append($(`<button class="btn btn-danger ngmButton"><i aria-hidden="true" class="fa fa-minus"></button>`)
            .click(() => {
                sendGuess("-");
            })
        );
        ngmWindow.panels[0].panel
        .append($(`<button class="btn btn-warning ngmButton"><i aria-hidden="true" class="fa fa-question"></button>`)
            .click(() => {
                sendGuess("~");
            })
        );
        ngmWindow.panels[0].panel
        .append($(`<button class="btn btn-success ngmButton"><i aria-hidden="true" class="fa fa-plus"></button>`)
            .click(() => {
                sendGuess("+");
            })
        );
    ngmWindow.panels[0].panel.append($(`<br>`));
    ngmWindow.panels[0].panel
        .append($(`<button class="btn btn-default ngmButton">Reset</button>`)
            .click(() => {
                guessCounter = [];
                for (let i = 0; i < teamList.length; i++) {
                    guessCounter.push(numGuesses);
                    updateCountButtons();
                }
            })
        );
    ngmWindow.panels[0].panel
        .append($(`<button id="ngmCountNumberButton" class="btn btn-info ngmButton">${numGuesses}</button>`)
            .click(() => {
                numGuesses === 1 ? numGuesses = 9 : numGuesses--;
                $("#ngmCountNumberButton").text(numGuesses);
                guessCounter = Array(teamList.length).fill(numGuesses);
                updateCountButtons();
            })
            .popover({
                content: "# of guesses per person",
                placement: "bottom",
                trigger: "hover",
                container: "body",
                animation: false
            })
        );
    ngmWindow.panels[0].panel
        .append($(`<button type="button" class="btn btn-primary ngmButton"><i aria-hidden="true" class="fa fa-comment"></button>`)
            .click(() => {
                sendChatMessage(guessCounter.join(""));
            })
            .popover({
                content: "send team count to chat",
                placement: "bottom",
                trigger: "hover",
                container: "body",
                animation: false
            })
        );
    ngmWindow.panels[0].panel.append($(`<br>`));
    ngmWindow.panels[0].panel
        .append($(`<button id="ngmautothrowCountButton" class="btn btn-${autothrowCount ? "success" : "danger"} ngmButton">Autothrow Count</button>`)
            .click(() => {
                autothrowCount = !autothrowCount;
                $("#ngmautothrowCountButton").removeClass("btn-success");
                $("#ngmautothrowCountButton").removeClass("btn-danger");
                $("#ngmautothrowCountButton").addClass(autothrowCount ? "btn-success" : "btn-danger");
            })
            .popover({
                content: "automatically send your # of remaining guesses at the beginning of each song",
                placement: "bottom",
                trigger: "hover",
                container: "body",
                animation: false
            })
        );
}

// return your team number (must be in quiz)
function getTeamNumber() {
    for (let player of Object.values(quiz.players)) {
        if (player.isSelf) {
            return player.teamNumber;
        }
    }
}

// input team number, return list of player names (must be in quiz)
function getTeamList(team) {
    let list = [];
    for (let player of Object.values(quiz.players)) {
        if (player.teamNumber === team) {
            list.push(player._name);
        }
    }
    return list;
}

// send your remaining guess count to answer box
function sendCount() {
    let text = String(guessCounter[teamSlot]);
    socket.sendCommand({ type: "quiz", command: "quiz answer", data: { answer: text, isPlaying: true, volumeAtMax: false } });
}

// send your remaining guess count and status to answer box
function sendGuess(guess) {
    let text = String(guessCounter[teamSlot] + guess);
    socket.sendCommand({ type: "quiz", command: "quiz answer", data: { answer: text, isPlaying: true, volumeAtMax: false } });
}

// input team slot number, update team guess counter
function updateCount(position) {
    if (guessCounter[position] === 0) {
        guessCounter[position] = numGuesses;
    }
    else {
        guessCounter[position]--;
    }
}

// update count buttons
function updateCountButtons() {
    for (let i = 0; i < guessCounter.length; i++) {
        $("#ngmCountButton" + i).text(guessCounter[i]);
    }
}

// input quiz answer results payload, return number of team total correct guesses
function getCorrectGuesses(payload) {
    for (let player of payload.players) {
        if (player.gamePlayerId === quiz.ownGamePlayerId) return player.correctGuesses;
    }
}

// return number of remaining guesses
function getRemainingGuesses() {
    return (teamList.length * numGuesses) - (correctGuesses % (teamList.length * numGuesses));
}

// return true if guess counts are currently accurate
function checkCount() {
    return correctGuesses % (guessCounter.length * numGuesses) === guessCounter.length * numGuesses - guessCounter.reduce((a, b) => a + b, 0);
}

// send a regular public message in game chat
function sendChatMessage(message) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: { msg: message, teamMessage: false }
    });
}

// send a client side message to game chat
function sendSystemMessage(message) {
    setTimeout(() => { gameChat.systemMessage(message) }, 1);
}
