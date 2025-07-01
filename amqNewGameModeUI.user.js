// ==UserScript==
// @name         AMQ New Game Mode UI
// @namespace    https://github.com/kempanator
// @version      0.33
// @description  Adds a user interface to new game mode to keep track of guesses
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @require      https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqAnswerTimesUtility.user.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("newGameModeUI");
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
let animeListLower = []; //store lowercase version for faster compare speed
let answerValidation = 1; //0: none, 1: normal, 2: strict
let hotKeys = {
    ngmWindow: loadHotkey("ngmWindow")
};

function setup() {
    new Listener("game chat update", (data) => {
        for (const message of data.messages) {
            if (message.sender === selfName) {
                parseMessage(message.message);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (data) => {
        if (data.sender === selfName) {
            parseMessage(data.message);
        }
    }).bindListener();
    new Listener("Game Starting", (data) => {
        const selfPlayer = data.players.find(p => p.name === selfName);
        if (selfPlayer?.inGame && hostModal.$teamSize.slider("getValue") > 1 && hostModal.$scoring.slider("getValue") === quiz.SCORE_TYPE_IDS.LIVES) {
            updateWindow(data.players);
        }
        else {
            clearWindow();
        }
    }).bindListener();
    new Listener("Join Game", (data) => {
        if (data.quizState && data.settings.teamSize > 1 && data.settings.scoreType === quiz.SCORE_TYPE_IDS.LIVES) {
            updateWindow(data.quizState.players);
        }
        else {
            clearWindow();
        }
    }).bindListener();
    new Listener("Spectate Game", (data) => {
        clearWindow();
    }).bindListener();
    new Listener("quiz over", (data) => {
        clearWindow();
    }).bindListener();
    new Listener("play next song", (data) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === quiz.SCORE_TYPE_IDS.LIVES) {
            answers = {};
            if (autoThrowSelfCount && guessCounter.length) {
                setTimeout(() => {
                    socket.sendCommand({
                        type: "quiz",
                        command: "quiz answer",
                        data: { answer: String(guessCounter[teamSlot]) }
                    });
                }, 100);
            }
        }
    }).bindListener();
    new Listener("team member answer", (data) => {
        if (quiz.teamMode && hostModal.$scoring.slider("getValue") === quiz.SCORE_TYPE_IDS.LIVES) {
            answers[data.gamePlayerId] = { id: data.gamePlayerId, text: data.answer };
        }
    }).bindListener();
    new Listener("player answers", (data) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === quiz.SCORE_TYPE_IDS.LIVES) {
            Object.keys(answers).forEach(id => answers[id].speed = amqAnswerTimesUtility.playerTimes[id]);
        }
    }).bindListener();
    new Listener("answer results", (data) => {
        if (quiz.teamMode && !quiz.isSpectator && hostModal.$scoring.slider("getValue") === quiz.SCORE_TYPE_IDS.LIVES) {
            const halfMode = halfModeList.some(x => x === true);
            if (autoTrackCount && Object.keys(answers).length) {
                const selfPlayer = data.players.find(p => p.gamePlayerId === quiz.ownGamePlayerId);
                if (selfPlayer.correct) {
                    const allCorrectAnime = data.songInfo.altAnimeNames.concat(data.songInfo.altAnimeNamesAnswers).map(x => x.toLowerCase());
                    const correctAnswers = Object.values(answers).filter(x => allCorrectAnime.includes(x.text.toLowerCase()));
                    const fastestSpeed = Math.min(...correctAnswers.map(x => x.speed));
                    const fastestPlayers = correctAnswers.filter(x => x.speed === fastestSpeed);
                    if (fastestPlayers.length === 1) {
                        const index = teamList.indexOf(fastestPlayers[0].id);
                        countButtons[index].addClass("ngmAnimateCorrect");
                        setTimeout(() => { countButtons[index].removeClass("ngmAnimateCorrect") }, 2000);
                        if (halfMode) {
                            guessCounter[index] -= 1;
                            if (guessCounter.every(x => x <= 0)) guessCounter = [...initialGuessCount];
                        }
                        else {
                            if (remainingGuesses === 1) guessCounter = [...initialGuessCount];
                            else guessCounter[index] -= 1;
                        }
                        countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
                        if (autoSendTeamCount === 1) {
                            sendChatMessage(guessCounter.join(halfMode ? " " : ""), true);
                        }
                        else if (autoSendTeamCount === 2) {
                            sendChatMessage(guessCounter.join(halfMode ? " " : ""), false);
                        }
                    }
                    else {
                        gameChat.systemMessage("NGM auto track: couldn't determine who answered");
                        console.log({ allCorrectAnime, answers, correctAnswers, fastestSpeed, fastestPlayers });
                    }
                }
                else {
                    let validAnswers = [];
                    for (const answer of Object.values(answers)) {
                        answer.valid = animeListLower.includes(answer.text.toLowerCase());
                    }
                    if (answerValidation === 0) {
                        validAnswers = Object.values(answers).filter(a => a.text.trim());
                    }
                    else if (answerValidation === 1) {
                        validAnswers = Object.values(answers).filter(a => a.valid);
                        if (validAnswers.length === 0) validAnswers = Object.values(answers).filter(a => a.text.trim());
                    }
                    else if (answerValidation === 2) {
                        validAnswers = Object.values(answers).filter(a => a.valid);
                    }
                    if (validAnswers.length) {
                        const fastestSpeed = Math.min(...validAnswers.map(a => a.speed));
                        const fastestPlayers = validAnswers.filter(a => a.speed === fastestSpeed);
                        if (fastestPlayers.length === 1) {
                            const index = teamList.indexOf(fastestPlayers[0].id);
                            if (halfModeList[index]) {
                                countButtons[index].addClass("ngmAnimateWrong");
                                setTimeout(() => { countButtons[index].removeClass("ngmAnimateWrong") }, 2000);
                                guessCounter[index] -= .5;
                                if (guessCounter.every(x => x <= 0)) guessCounter = [...initialGuessCount];
                                countButtons.forEach((element, i) => { element.text(guessCounter[i]) });
                                if (autoSendTeamCount === 1) {
                                    sendChatMessage(guessCounter.join(halfMode ? " " : ""), true);
                                }
                                else if (autoSendTeamCount === 2) {
                                    sendChatMessage(guessCounter.join(halfMode ? " " : ""), false);
                                }
                            }
                        }
                    }
                }
            }
            correctGuesses = data.players.find(p => p.gamePlayerId === quiz.ownGamePlayerId).correctGuesses;
            $("#ngmCorrectAnswers").text(`Correct Answers: ${correctGuesses}`);
            if (halfMode) {
                remainingGuesses = null;
            }
            else if (initialGuessCount.length) {
                const totalGuesses = initialGuessCount.reduce((a, b) => a + b);
                remainingGuesses = totalGuesses - (correctGuesses % totalGuesses);
            }
            else {
                remainingGuesses = null;
            }
            $("#ngmRemainingGuesses").text(remainingGuesses ? `Remaining Guesses: ${remainingGuesses}` : "");
        }
    }).bindListener();
    new Listener("get all song names", (data) => {
        animeListLower = data.names.map(x => x.toLowerCase());
    }).bindListener();
    new Listener("update all song names", (data) => {
        if (data.deleted.length) {
            const deletedLower = data.deleted.map(x => x.toLowerCase());
            animeListLower = animeListLower.filter(name => !deletedLower.includes(name));
        }
        if (data.new.length) {
            const newLower = data.new.map(x => x.toLowerCase());
            animeListLower.push(...newLower);
        }
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

    // setup hotkeys
    const hotkeyActions = {
        ngmWindow: () => {
            ngmWindow.isVisible() ? ngmWindow.close() : ngmWindow.open();
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
        .width((i, w) => w + 35)
        .children("div")
        .append($("<div>", { id: "qpNGM", class: "clickAble qpOption" })
            .append(ngmSvg)
            .click(() => {
                ngmWindow.isVisible() ? ngmWindow.close() : ngmWindow.open();
            })
            .popover({
                content: "New Game Mode UI",
                trigger: "hover",
                placement: "bottom"
            })
        );

    setupNGMWindow();
    applyStyles();
    AMQ_addScriptData({
        name: "New Game Mode UI",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js",
        description: `
            <p>Click the button in the options bar during quiz to open the new game mode user interface</p>
        `
    });

}

// parse message
function parseMessage(content) {
    if (content === "/ngm") {
        ngmWindow.isVisible() ? ngmWindow.close() : ngmWindow.open();
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

function clearWindow() {
    $("#ngmGuessContainer").empty().append(`<div id="ngmNotInGame">Not in team game with lives</div>`);
    $("#ngmCorrectAnswers").text("");
    $("#ngmRemainingGuesses").text("");
    guessCounter = [];
    countButtons = [];
    teamNumber = null;
    teamList = [];
    teamSlot = null;
    correctGuesses = 0;
    remainingGuesses = 0;
    answers = {};
}

// input array of Player objects
function updateWindow(players) {
    const selfPlayer = players.find(p => p.name === selfName);
    teamNumber = selfPlayer.teamNumber;
    teamList = players.filter(p => p.teamNumber === teamNumber).map(p => p.gamePlayerId);
    teamSlot = teamList.indexOf(selfPlayer.gamePlayerId);
    correctGuesses = selfPlayer.correctGuesses;
    countButtons = teamList.map((id, index) => {
        return $("<div>", { class: "ngmButton ngmCount" }).click(() => {
            if (guessCounter[index] > 0) {
                guessCounter[index] -= (halfModeList[index] ? .5 : 1);
            }
            else {
                guessCounter[index] = initialGuessCount[index];
            }
            countButtons[index].text(guessCounter[index]);
        });
    });
    $("#ngmGuessContainer").empty().append(countButtons);
    resetCounter();
}

// reset counter
function resetCounter() {
    if (!teamList.length) return;
    const countText = $("#ngmInitialGuessCountInput").val().trim();
    if ($("#ngmHalfGuessInput").hasClass("disabled")) {
        halfModeList = Array(teamList.length).fill(false);
        $("#ngmTitle").text("NGM");
    }
    else {
        const halfText = $("#ngmHalfGuessInput").val().trim().toLowerCase();
        if (halfText) {
            if (halfText.length === teamList.length && /^[h-]+$/.test(halfText)) {
                halfModeList = halfText.split("").map(x => x === "h");
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
            initialGuessCount = countText.split("").map(x => parseInt(x));
        }
        else {
            return counterError();
        }
        guessCounter = [...initialGuessCount];
        countButtons.forEach((element, i) => { element.removeClass("disabled").text(guessCounter[i]) });
        const totalGuesses = initialGuessCount.reduce((a, b) => a + b);
        if (totalGuesses === 0) {
            return counterError();
        }
        else {
            remainingGuesses = halfModeList.some(x => x === true) ? null : totalGuesses - (correctGuesses % totalGuesses);
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
    countButtons.forEach(x => x.addClass("disabled").text("-"));
    $("#ngmCorrectAnswers").text("Invalid Settings");
    $("#ngmRemainingGuesses").text("");
}

// setup ngm window
function setupNGMWindow() {
    ngmWindow.window.find(".modal-header").empty()
        .append($("<i>", { class: "fa fa-times clickAble", style: "font-size: 25px; top: 8px; right: 12px; position: absolute;", "aria-hidden": "true" })
            .click(() => {
                ngmWindow.close();
            }))
        .append($("<i>", { class: "fa fa-cog clickAble", style: "font-size: 22px; top: 11px; right: 36px; position: absolute;", "aria-hidden": "true" })
            .click(() => {
                $("#ngmMainContainer").toggle();
                $("#ngmSettingsContainer").toggle();
            }))
        .append($("<div>", { id: "ngmTitle", text: "NGM" }))
        .append($("<div>", { id: "ngmCorrectAnswers" }))
        .append($("<div>", { id: "ngmRemainingGuesses" }));
    ngmWindow.panels[0].panel.append(`
        <div id="ngmMainContainer">
            <div id="ngmGuessContainer" style="margin: 0 2px;">
                <div id="ngmNotInGame">Not in team game with lives</div>
            </div>
        </div>
        <div id="ngmSettingsContainer" style="display: none;">
            <table id="ngmHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>
        </div>
    `);
    createHotkeyTable([
        { action: "ngmWindow", title: "Open This Window" }
    ]);
    const $row1 = $("<div>", { style: "margin: 0 2px;" });
    const $row2 = $("<div>", { style: "margin: 0 2px;" });
    const $row3 = $("<div>", { style: "margin: 0 2px;" });
    const $row4 = $("<div>", { style: "margin: 0 2px;" });
    $row1.append($("<div>", { class: "ngmButton ngmStatus red" })
        .append(minusSvg)
        .click(() => {
            sendChatMessage("-", true);
        })
    );
    $row1.append($("<div>", { class: "ngmButton ngmStatus yellow" })
        .append(tildeSvg)
        .click(() => {
            sendChatMessage("~", true);
        })
    );
    $row1.append($("<div>", { class: "ngmButton ngmStatus green" })
        .append(plusSvg)
        .click(() => {
            sendChatMessage("+", true);
        })
    );
    $row2.append($("<div>", { class: "ngmButton white", text: "Reset", style: "width: 60px;" })
        .click(() => {
            quiz.inQuiz ? resetCounter() : clearWindow();
        })
    );
    $row2.append($("<input>", { id: "ngmInitialGuessCountInput", type: "text" })
        .popover({
            title: "Initial Guess Count",
            content: `
                <p>use a single number to give everyone on your team the specified guess count</p>
                <p>use several numbers to give each person on your team a different guess count</p>
                <p>example: 5 or 5454</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
        .val("5")
    );
    $row3.append($("<div>", { class: "ngmButton white", text: "Half", style: "width: 50px;" })
        .click(function () {
            $(this).toggleClass("white blue");
            $("#ngmHalfGuessInput").toggleClass("disabled");
            $("#ngmAnswerValidationButton").toggleClass("disabled");
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
    $row3.append($("<input>", { id: "ngmHalfGuessInput", class: "disabled", type: "text" })
        .popover({
            title: "",
            content: `
                <p>For each person on your team (in order) type "h" or "-" to enable/disable half point deductions</p>
                <p>Example: h-h-</p><p>Leave blank to enable for everyone</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row3.append($("<div>", { id: "ngmAnswerValidationButton", class: "ngmButton blue disabled", style: "width: 34px;" })
        .append(`<i class="fa fa-check" aria-hidden="true"></i>`)
        .click(function () {
            answerValidation = (answerValidation + 1) % 3;
            const classMap = { 0: "white", 1: "blue", 2: "purple" };
            $(this).removeClass("white blue purple").addClass(classMap[answerValidation]);
        })
        .popover({
            title: "Answer Validation",
            content: `
                <p>White: None<br>deduct .5 if the person has any text in their answer box</p>
                <p>Blue: Normal<br>if at least 1 valid answer do strict mode, else none</p>
                <p>Purple: Strict<br>only deduct .5 on valid answers</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($("<div>", { class: "ngmButton white", style: "width: 50px;", text: "Auto" })
        .click(function () {
            autoTrackCount = !autoTrackCount;
            $(this).toggleClass("white blue");
            $("#ngmSelfCountButton").toggleClass("disabled");
            $("#ngmTeamCountButton").toggleClass("disabled");
        })
        .popover({
            title: "Auto Track",
            content: `<p>Attempt to auto update team guess counter</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($("<div>", { id: "ngmSelfCountButton", class: "ngmButton white disabled", style: "width: 34px;" })
        .append(`<i class="fa fa-user" aria-hidden="true"></i>`)
        .click(function () {
            autoThrowSelfCount = !autoThrowSelfCount;
            $(this).toggleClass("white blue");
        })
        .popover({
            title: "Auto Throw Self Count",
            content: `<p>When a song starts, send your current count to the answer box</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $row4.append($("<div>", { id: "ngmTeamCountButton", class: "ngmButton white disabled", style: "width: 34px;" })
        .append(`<i class="fa fa-comment" aria-hidden="true"></i>`)
        .click(function () {
            autoSendTeamCount = (autoSendTeamCount + 1) % 3;
            const classMap = { 0: "white", 1: "blue", 2: "purple" };
            $(this).removeClass("white blue purple").addClass(classMap[autoSendTeamCount]);
        })
        .popover({
            title: "Auto Send Team Count",
            content: `
                <p>On answer reveal, send team guess count to chat</p>
                <p>Blue: team chat<br>Purple: public chat</p>`,
            placement: "bottom",
            trigger: "hover",
            container: "body",
            animation: false,
            html: true
        })
    );
    $("#ngmMainContainer").append($row1, $row2, $row3, $row4);
}

// html for svg icons
const ngmSvg = `
    <svg class="qpMenuItem" aria-hidden="true"
        viewBox="0 0 30 20" fill="currentColor">
        <rect x="4"  y="0" width="4"  height="12"/>
        <rect x="0"  y="4" width="12" height="4"/>
        <rect x="16" y="4" width="13" height="4"/>
        <path d="M9 17 Q13.5 12 18 16 T27 14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

const minusSvg = `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
        <line x1="6" y1="10" x2="14" y2="10"/>
    </svg>`;

const tildeSvg = `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
        <path d="M4 10 q3 -4 6 0 t6 0"/>
    </svg>`;

const plusSvg = `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
        <line x1="10" y1="6" x2="10" y2="14"/>
        <line x1="6" y1="10" x2="14" y2="10"/>
    </svg>`;

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
    const $tbody = $("#ngmHotkeyTable tbody");
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
    localStorage.setItem("newGameModeUI", JSON.stringify({
        hotKeys
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
        #qpNGM {
            width: 30px;
            margin-right: 5px;
        }
        #ngmWindow .modal-header {
            height: 74px;
            padding: 0;
            line-height: normal;
        }
        #ngmWindow .modal-header i.fa:hover {
            opacity: .7;
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
            padding: 0;
            line-height: 0;
        }
        .ngmStatus svg {
            width: 32px;
            height: 32px;
        }
        .ngmButton.red {
            background-color: #d9534f;
            border-color: #d43f3a;
            color: #ffffff;
        }
        .ngmButton.yellow {
            background-color: #f0ad4e;
            border-color: #eea236;
            color: #ffffff;
        }
        .ngmButton.green {
            background-color: #5cb85c;
            border-color: #4cae4c;
            color: #ffffff;
        }
        .ngmButton.white {
            background-color: #ffffff;
            border-color: #cccccc;
            color: #000000;
        }
        .ngmButton.white i.fa {
            color: #333333;
        }
        .ngmButton.blue {
            background-color: #4497ea;
            border-color: #006ab7;
            color: #ffffff;
        }
        .ngmButton.purple {
            background-color: #9444EA;
            border-color: #6C00B7;
            color: #ffffff;
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
        #ngmHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #ngmHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #ngmHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
        }
    `;
    let style = document.getElementById("newGameModeUIStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "newGameModeUIStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
