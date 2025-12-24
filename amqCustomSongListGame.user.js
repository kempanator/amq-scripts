// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.93
// @description  Play a solo game with a custom song list
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
// @grant        GM_xmlhttpRequest
// @connect      myanimelist.net
// ==/UserScript==

/*
How to start a custom song list game:
  1. create a solo lobby
  2. click the CSL button in the top right
  3. click the autocomplete button if it is red
  4. create or upload a list in the song list tab
  5. change settings in the settings tab
  6. fix any invalid answers in the answer tab
  7. click start to play the quiz

Supported upload files:
  1. anisongdb json
  2. official AMQ song history export
  3. joseph song list script export
  4. blissfulyoshi ranked song list

Some considerations:
  1. anisongdb is unavailable during ranked, please prepare some json files in advance
  2. anime titles that were changed recently in AMQ will be incorrect if anisongdb never updated it
  3. no automatic volume equalizing
  4. keep duplicates in the song list if you want to use any acceptable title for each
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("customSongListGame");
const apiBase = "https://anisongdb.com/api/";
const hostDict = { 1: "eudist.animemusicquiz.com", 2: "nawdist.animemusicquiz.com", 3: "naedist.animemusicquiz.com" };
let CSLButtonCSS = saveData.CSLButtonCSS || "calc(25% - 250px)";
let showCSLMessages = saveData.showCSLMessages ?? true;
let replacedAnswers = saveData.replacedAnswers || {};
let malClientId = saveData.malClientId ?? "";
let debug = Boolean(saveData.debug);
let fastSkip = false;
let fullSongRange = false;
let nextVideoReady = false;
let showSelection = 1;
let guessTime = 20;
let extraGuessTime = 0;
let currentSong = 0;
let totalSongs = 0;
let currentAnswers = {};
let score = {};
let songListTableView = 0; //0: song + artist, 1: anime + song type + vintage, 2: video/audio links
let songListTableSort = { mode: "", ascending: true } //modes: songName, artist, difficulty, anime, songType, vintage, mp3, 480, 720
let songList = [];
let songOrder = {}; //{song#: index#, ...}
let mergedSongList = [];
let importedSongList = [];
let songOrderType = "random";
let startPointRange = [0, 100];
let difficultyRange = [0, 100];
let previousSongFinished = false;
let skipInterval;
let nextVideoReadyInterval;
let answerTimer;
let extraGuessTimer;
let endGuessTimer;
let fileHostOverride = 0;
let animeListLower = new Set(); //store lowercase version for faster compare speed
let autocompleteInput;
let cslMultiplayer = { host: "", songInfo: {}, voteSkip: {} };
let cslState = 0; //0: none, 1: guessing phase, 2: answer phase
let songLinkReceived = {};
let songStartTime;
let skipping = false;
let answerChunks = {}; //store player answer chunks, ids are keys
let resultChunk;
let songInfoChunk;
let nextSongChunk;
let importRunning = false;
let hotKeys = {
    cslgWindow: loadHotkey("cslgWindow"),
    start: loadHotkey("start"),
    stop: loadHotkey("stop"),
    mergeAll: loadHotkey("mergeAll"),
    clearSongList: loadHotkey("clearSongList"),
    transferMerged: loadHotkey("transferMerged"),
    clearMerged: loadHotkey("clearMerged"),
    downloadMerged: loadHotkey("downloadMerged"),
    tableMode: loadHotkey("tableMode"),
};

// setup
function setup() {
    new Listener("New Player", (data) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            const player = Object.values(quiz.players).find(p => p._name === data.name);
            if (player) {
                sendSystemMessage(`CSL: reconnecting ${data.name}`);
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
            }
            else {
                cslMessage(`CSL game in progress, removing ${data.name}`);
                lobby.changeToSpectator(data.name);
            }
        }
    }).bindListener();
    new Listener("New Spectator", (data) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            const player = Object.values(quiz.players).find(p => p._name === data.name);
            if (player) {
                sendSystemMessage(`CSL: reconnecting ${data.name}`);
                cslMessage("§CSL17" + btoa(data.name));
            }
            else {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
            }
            setTimeout(() => {
                const song = songList[songOrder[currentSong]];
                const message = `${currentSong}§${getStartPoint()}§${song.audio || ""}§${song.video480 || ""}§${song.video720 || ""}`;
                splitIntoChunks(btoa(message) + "$", 144).forEach((item, index) => {
                    cslMessage("§CSL3" + base10to36(index % 36) + item);
                });
            }, 300);
        }
    }).bindListener();
    new Listener("Spectator Change To Player", (data) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            const player = Object.values(quiz.players).find(p => p._name === data.name);
            if (player) {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
            }
            else {
                cslMessage(`CSL game in progress, removing ${data.name}`);
                lobby.changeToSpectator(data.name);
            }
        }
    }).bindListener();
    new Listener("Player Change To Spectator", (data) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            const player = Object.values(quiz.players).find(p => p._name === data.name);
            if (player) {
                cslMessage("§CSL17" + btoa(data.name));
            }
            else {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
            }
        }
    }).bindListener();
    new Listener("Host Promotion", (data) => {
        if (quiz.cslActive && quiz.inQuiz) {
            sendSystemMessage("CSL host changed, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("Player Left", (data) => {
        if (quiz.cslActive && quiz.inQuiz && data.player.name === cslMultiplayer.host) {
            sendSystemMessage("CSL host left, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("Spectator Left", (data) => {
        if (quiz.cslActive && quiz.inQuiz && data.spectator === cslMultiplayer.host) {
            sendSystemMessage("CSL host left, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("game closed", (data) => {
        if (quiz.cslActive && quiz.inQuiz) {
            reset();
            messageDisplayer.displayMessage("Room Closed", data.reason);
            lobby.leave({ supressServerMsg: true });
        }
    }).bindListener();
    new Listener("game chat update", (data) => {
        for (const message of data.messages) {
            if (message.message.startsWith("§CSL")) {
                if (!showCSLMessages) {
                    setTimeout(() => {
                        const $message = gameChat.$chatMessageContainer.find(".gcMessage").last();
                        if ($message.text().startsWith("§CSL")) $message.parent().remove();
                    }, 0);
                }
                parseMessage(message.message, message.sender);
            }
            else if (debug && message.sender === selfName && message.message.startsWith("/csl")) {
                try { cslMessage(JSON.stringify(eval(message.message.slice(5)))) }
                catch { cslMessage("ERROR") }
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (data) => {
        if (data.message.startsWith("§CSL")) {
            parseMessage(data.message, data.sender);
        }
    }).bindListener();
    new Listener("Game Starting", (data) => {
        clearTimeEvents();
    }).bindListener();
    new Listener("Join Game", (data) => {
        reset();
    }).bindListener();
    new Listener("Spectate Game", (data) => {
        reset();
    }).bindListener();
    new Listener("Host Game", (data) => {
        reset();
        $("#cslgSettingsModal").modal("hide");
    }).bindListener();
    new Listener("get all song names", (data) => {
        animeListLower = new Set(data.names.map(x => x.toLowerCase()));
        autocompleteInput = new AmqAwesomeplete(document.querySelector("#cslgNewAnswerInput"), { list: data.names }, true);
    }).bindListener();
    new Listener("update all song names", (data) => {
        if (data.deleted.length) {
            const deletedLower = data.deleted.map(x => x.toLowerCase());
            for (const name of deletedLower) {
                animeListLower.delete(name);
            }
            autocompleteInput.list = autocompleteInput.list.filter(name => !data.deleted.includes(name));
        }
        if (data.new.length) {
            const newLower = data.new.map(x => x.toLowerCase());
            for (const name of newLower) {
                animeListLower.add(name);
            }
            autocompleteInput.list.push(...data.new);
        }
    }).bindListener();

    quiz.pauseButton.$button.off("click").on("click", () => {
        if (quiz.cslActive) {
            if (quiz.soloMode) {
                if (quiz.pauseButton.pauseOn) {
                    fireListener("quiz unpause triggered", {
                        "playerName": selfName
                    });
                    /*fireListener("quiz unpause triggered", {
                        "playerName": selfName,
                        "doCountDown": true,
                        "countDownLength": 3000
                    });*/
                }
                else {
                    fireListener("quiz pause triggered", {
                        "playerName": selfName
                    });
                }
            }
            else {
                if (quiz.pauseButton.pauseOn) {
                    cslMessage("§CSL12");
                }
                else {
                    cslMessage("§CSL11");
                }
            }
        }
        else {
            socket.sendCommand({
                type: "quiz",
                command: quiz.pauseButton.pauseOn ? "quiz unpause" : "quiz pause"
            });
        }
    });

    const oldSendSkipVote = quiz.skipController.sendSkipVote;
    quiz.skipController.sendSkipVote = function () {
        if (quiz.cslActive) {
            if (quiz.soloMode) {
                clearTimeout(this.autoVoteTimeout);
            }
            else if (!skipping) {
                cslMessage("§CSL14");
            }
        }
        else {
            oldSendSkipVote.apply(this, arguments);
        }
    }

    const oldLeave = quiz.leave;
    quiz.leave = function () {
        reset();
        oldLeave.apply(this, arguments);
    }

    const oldStartReturnLobbyVote = quiz.startReturnLobbyVote;
    quiz.startReturnLobbyVote = function () {
        if (quiz.cslActive && quiz.inQuiz) {
            if (quiz.soloMode) {
                quizOver();
            }
            else if (quiz.isHost) {
                cslMessage("§CSL10");
            }
        }
        else {
            oldStartReturnLobbyVote.apply(this, arguments);
        }
    }

    const oldSubmitAnswer = QuizTypeAnswerInputController.prototype.submitAnswer;
    QuizTypeAnswerInputController.prototype.submitAnswer = function (answer) {
        if (quiz.cslActive) {
            currentAnswers[quiz.ownGamePlayerId] = answer;
            this.skipController.highlight = true;
            fireListener("quiz answer", {
                "answer": answer,
                "success": true
            });
            if (quiz.soloMode) {
                const time = Number(((Date.now() - songStartTime) / 1000).toFixed(3));
                fireListener("player answered", [{ answerTime: time, gamePlayerIds: [0] }]);
                if (options.autoVoteSkipGuess) {
                    this.skipController.voteSkip();
                    fireListener("quiz overlay message", "Skipping to Answers");
                }
            }
            else {
                cslMessage("§CSL13");
                if (options.autoVoteSkipGuess) {
                    this.skipController.voteSkip();
                }
            }
        }
        else {
            oldSubmitAnswer.apply(this, arguments);
        }
    }

    const oldVideoReady = quiz.videoReady;
    quiz.videoReady = function () {
        if (quiz.cslActive && this.inQuiz) {
            nextVideoReady = true;
        }
        else {
            oldVideoReady.apply(this, arguments);
        }
    }

    const oldHandleError = MoeVideoPlayer.prototype.handleError;
    MoeVideoPlayer.prototype.handleError = function () {
        if (quiz.cslActive) {
            gameChat.systemMessage(`CSL Error: couldn't load song ${currentSong + 1}`);
            nextVideoReady = true;
        }
        else {
            oldHandleError.apply(this, arguments);
        }
    }

    $("#lobbyPage .topMenuBar").append(`<div id="lnCustomSongListButton" class="clickAble topMenuButton topMenuMediumButton"><h3>CSL</h3></div>`);
    $("#lnCustomSongListButton").on("click", openSettingsModal);

    // build settings modal
    $("#gameContainer").append($(/*html*/`
        <div class="modal fade tab-modal" id="cslgSettingsModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document" style="width: 680px">
                <div class="modal-content">
                    <div class="modal-header" style="padding: 3px 0 0 0">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">×</span>
                        </button>
                        <h4 class="modal-title">Custom Song List Game</h4>
                        <div class="tabContainer">
                            <div id="cslgSongListTab" class="tab clickAble selected">
                                <h5>Song List</h5>
                            </div>
                            <div id="cslgQuizSettingsTab" class="tab clickAble">
                                <h5>Settings</h5>
                            </div>
                            <div id="cslgMergeTab" class="tab clickAble">
                                <h5>Merge</h5>
                            </div>
                            <div id="cslgAnswerTab" class="tab clickAble">
                                <h5>Answers</h5>
                            </div>
                            <div id="cslgHotkeyTab" class="tab clickAble">
                                <h5>Hotkey</h5>
                            </div>
                            <div id="cslgListImportTab" class="tab clickAble">
                                <h5>List Import</h5>
                            </div>
                            <div id="cslgInfoTab" class="tab clickAble" style="width: 45px; margin-right: -10px; padding-right: 8px; float: right;">
                                <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; max-height: calc(100vh - 150px);">
                        <div id="cslgSongListContainer" class="tabSection">
                            <div id="cslgSongListTopRow" style="margin: 2px 0 3px 0;">
                                <span style="font-size: 20px; font-weight: bold;">Mode</span>
                                <select id="cslgSongListModeSelect" style="color: black; margin-left: 2px; padding: 3px 0;">
                                    <option>Anisongdb</option>
                                    <option>Load File</option>
                                    <option>Previous Game</option>
                                    <option>Filter List</option>
                                </select>
                                <i id="cslgMergeAllButton" class="fa fa-plus clickAble" aria-hidden="true" style="font-size: 20px; margin-left: 100px;"></i>
                                <i id="cslgClearSongListButton" class="fa fa-trash clickAble" aria-hidden="true" style="font-size: 20px; margin-left: 10px;"></i>
                                <i id="cslgTransferSongListButton" class="fa fa-exchange clickAble" aria-hidden="true" style="font-size: 20px; margin-left: 10px;"></i>
                                <i id="cslgTableModeButton" class="fa fa-table clickAble" aria-hidden="true" style="font-size: 20px; margin-left: 10px;"></i>
                                <span id="cslgSongListCount" style="font-size: 20px; font-weight: bold; margin-left: 20px;">Songs: 0</span>
                                <span id="cslgMergedSongListCount" style="font-size: 20px; font-weight: bold; margin-left: 20px;">Merged: 0</span>
                            </div>
                            <div id="cslgAnisongdbSearchRow">
                                <div>
                                    <select id="cslgAnisongdbModeSelect" style="color: black; padding: 3px 0;">
                                        <option>Anime</option>
                                        <option>Artist</option>
                                        <option>Song</option>
                                        <option>Composer</option>
                                        <option>Season</option>
                                        <option>Ann Id</option>
                                        <option>Mal Id</option>
                                        <option>Ann Song Id</option>
                                        <option>Amq Song Id</option>
                                    </select>
                                    <input id="cslgAnisongdbQueryInput" type="text" style="color: black; width: 310px;">
                                    <button id="cslgAnisongdbSearchButtonGo" style="color: black">Go</button>
                                    <button id="cslgAnisongdbFilterDropdownButton" style="color: black; margin-left: 7px;">Filters <i class="fa fa-caret-down" aria-hidden="true"></i></button>
                                </div>
                                <div id="cslgAnisongdbFilterOptions" style="display: none; margin-top: 7px;">
                                    <div>
                                        <label class="clickAble">Partial Match<input id="cslgAnisongdbPartialCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 20px">OP<input id="cslgAnisongdbOPCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 7px">ED<input id="cslgAnisongdbEDCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 7px">IN<input id="cslgAnisongdbINCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 20px">Ignore Duplicates<input id="cslgAnisongdbIgnoreDuplicatesCheckbox" type="checkbox"></label>
                                        <label class="clickAble" style="margin-left: 20px">Arrangement<input id="cslgAnisongdbArrangementCheckbox" type="checkbox" checked></label>
                                    </div>
                                    <div>
                                        <label class="clickAble">Normal Broadcasts<input id="cslgAnisongdbNormalCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 10px">Dubs<input id="cslgAnisongdbDubCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 10px">Rebroadcasts<input id="cslgAnisongdbRebroadcastCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 90px">Max Other People<input id="cslgAnisongdbMaxOtherPeopleInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                    </div>
                                    <div>
                                        <label class="clickAble">Standard<input id="cslgAnisongdbStandardCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 10px">Character<input id="cslgAnisongdbCharacterCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 10px">Chanting<input id="cslgAnisongdbChantingCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 10px">Instrumental<input id="cslgAnisongdbInstrumentalCheckbox" type="checkbox" checked></label>
                                        <label class="clickAble" style="margin-left: 38px">Min Group Members<input id="cslgAnisongdbMinGroupMembersInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                    </div>
                                </div>
                            </div>
                            <div id="cslgFileUploadRow">
                                <label style="vertical-align: -4px"><input id="cslgFileUpload" type="file" accept=".json" style="width: 600px"></label>
                            </div>
                            <div id="cslgPreviousGameRow">
                                <select id="cslgPreviousGameSelect" style="color: black; padding: 3px 0;"></select>
                                <button id="cslgPreviousGameButtonGo" style="color: black">Go</button>
                            </div>
                            <div id="cslgFilterListRow">
                                <div>
                                    <select id="cslgFilterModeSelect" style="color: black; padding: 3px 0;">
                                        <option>Keep</option>
                                        <option>Remove</option>
                                    </select>
                                    <select id="cslgFilterKeySelect" style="color: black; padding: 3px 0;">
                                        <option>Anime</option>
                                        <option>Artist</option>
                                        <option>Song Name</option>
                                        <option>Song Type</option>
                                        <option>Anime Type</option>
                                        <option>Difficulty</option>
                                        <option>Vintage</option>
                                        <option>Rebroadcast</option>
                                        <option>Dub</option>
                                        <option>Correct</option>
                                        <option>Incorrect</option>
                                    </select>
                                    <input id="cslgFilterListInput" type="text" style="color: black; width: 250px;">
                                    <button id="cslgFilterListButtonGo" style="color: black">Go</button>
                                    <label class="clickAble" style="margin-left: 10px">Case<input id="cslgFilterListCaseCheckbox" type="checkbox"></label>
                                </div>
                            </div>
                            <div style="height: 400px; margin: 5px 0; overflow-y: scroll;">
                                <table id="cslgSongListTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="number">#</th>
                                            <th class="song">Song</th>
                                            <th class="artist">Artist</th>
                                            <th class="difficulty">Dif</th>
                                            <th class="action"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                                <div id="cslgSongListWarning"></div>
                            </div>
                        </div>
                        <div id="cslgQuizSettingsContainer" class="tabSection" style="margin-top: 10px">
                            <div>
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 0;">Songs:</span><input id="cslgSettingsSongs" type="text" style="width: 40px">
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Guess Time:</span><input id="cslgSettingsGuessTime" type="text" style="width: 40px">
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Extra Time:</span><input id="cslgSettingsExtraGuessTime" type="text" style="width: 40px">
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Song Types:</span>
                                <label class="clickAble">OP<input id="cslgSettingsOPCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">ED<input id="cslgSettingsEDCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">IN<input id="cslgSettingsINCheckbox" type="checkbox" checked></label>
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Anime Types:</span>
                                <label class="clickAble">TV<input id="cslgSettingsTVCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Movie<input id="cslgSettingsMovieCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">OVA<input id="cslgSettingsOVACheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">ONA<input id="cslgSettingsONACheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Special<input id="cslgSettingsSpecialCheckbox" type="checkbox" checked></label>
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Broadcast Types:</span>
                                <label class="clickAble">Dub<input id="cslgSettingsDubCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Rebroadcast<input id="cslgSettingsRebroadcastCheckbox" type="checkbox" checked></label>
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Guess:</span>
                                <label class="clickAble">Correct<input id="cslgSettingsCorrectGuessCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Wrong<input id="cslgSettingsIncorrectGuessCheckbox" type="checkbox" checked></label>
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Gameplay Options:</span>
                                <label class="clickAble">Full Song Range<input id="cslgSettingsFullSongRangeCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 20px">Fast Skip<input id="cslgSettingsFastSkipCheckbox" type="checkbox"></label>
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 0;">Sample:</span>
                                <input id="cslgSettingsStartPoint" type="text" style="width: 70px">
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Difficulty:</span>
                                <input id="cslgSettingsDifficulty" type="text" style="width: 70px">
                            </div>
                            <div style="margin-top: 5px">
                                <span style="font-size: 18px; font-weight: bold; margin-right: 10px;">Song Order:</span>
                                <select id="cslgSongOrderSelect" style="color: black; padding: 3px 0;">
                                    <option value="random">random</option>
                                    <option value="ascending">ascending</option>
                                    <option value="descending">descending</option>
                                </select>
                                <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 10px;">Override URL:</span>
                                <select id="cslgHostOverrideSelect" style="color: black; padding: 3px 0;">
                                    <option value="0">default</option>
                                    <option value="1">EU (eudist)</option>
                                    <option value="2">NA1 (nawdist)</option>
                                    <option value="3">NA2 (naedist)</option>
                                    
                                </select>
                            </div>
                            <p style="margin-top: 20px">Normal room settings are ignored. Only these settings will apply.</p>
                        </div>
                        <div id="cslgAnswerContainer" class="tabSection">
                            <span style="font-size: 16px; font-weight: bold;">Old:</span>
                            <input id="cslgOldAnswerInput" type="text" style="width: 240px; color: black; margin: 10px 0;">
                            <span style="font-size: 16px; font-weight: bold; margin-left: 10px;">New:</span>
                            <input id="cslgNewAnswerInput" type="text" style="width: 240px; color: black; margin: 10px 0;">
                            <button id="cslgAnswerButtonAdd" style="color: black; margin-left: 10px;">Add</button>
                            <div id="cslgAnswerText" style="font-size: 16px; font-weight: bold;">No list loaded</div>
                            <div style="height: 300px; margin: 5px 0; overflow-y: scroll;">
                                <table id="cslgAnswerTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="oldName">Old</th>
                                            <th class="newName">New</th>
                                            <th class="edit"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                            <p style="margin-top: 5px">Use this window to replace invalid answers from your imported song list with valid answers from AMQ's autocomplete.</p>
                        </div>
                        <div id="cslgMergeContainer" class="tabSection">
                            <h4 style="text-align: center; margin-bottom: 10px;">Merge multiple song lists into 1 JSON file</h4>
                            <div style="width: 400px; display: inline-block;">
                                <div id="cslgMergeCurrentCount" style="font-size: 16px; font-weight: bold;">Current song list: 0 songs</div>
                                <div id="cslgMergeTotalCount" style="font-size: 16px; font-weight: bold;">Merged song list: 0 songs</div>
                            </div>
                            <div style="display: inline-block; vertical-align: 13px">
                                <button id="cslgMergeButton" class="btn btn-default">Merge</button>
                                <button id="cslgMergeClearButton" class="btn btn-warning">Clear</button>
                                <button id="cslgMergeDownloadButton" class="btn btn-success">Download</button>
                            </div>
                            <div style="height: 400px; margin: 5px 0; overflow-y: scroll;">
                                <table id="cslgMergedSongListTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="number">#</th>
                                            <th class="anime">Anime</th>
                                            <th class="songType">Type</th>
                                            <th class="action"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                            <p style="margin-top: 30px; display: none;">1. Load some songs into the table in the song list tab<br>2. Come back to this tab<br>3. Click "merge" to add everything from that list to a new combined list<br>4. Repeat steps 1-3 as many times as you want<br>5. Click "download" to download the new json file<br>6. Upload the file in the song list tab and play</p>
                        </div>
                        <div id="cslgHotkeyContainer" class="tabSection">
                            <table id="cslgHotkeyTable">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Keybind</th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                        </div>
                        <div id="cslgListImportContainer" class="tabSection" style="text-align: center; margin: 10px 0;">
                            <h4 style="">Import list from username</h4>
                            <div>
                                <select id="cslgListImportSelect" style="padding: 3px 0; color: black;">
                                    <option>myanimelist</option>
                                    <option>anilist</option>
                                </select>
                                <input id="cslgListImportUsernameInput" type="text" placeholder="username" style="width: 200px; color: black;">
                                <button id="cslgListImportStartButton" style="color: black;">Go</button>
                            </div>
                            <div style="margin-top: 5px">
                                <label class="clickAble">Watching<input id="cslgListImportWatchingCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Completed<input id="cslgListImportCompletedCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">On Hold<input id="cslgListImportHoldCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Dropped<input id="cslgListImportDroppedCheckbox" type="checkbox" checked></label>
                                <label class="clickAble" style="margin-left: 10px">Planning<input id="cslgListImportPlanningCheckbox" type="checkbox" checked></label>
                            </div>
                            <h4 id="cslgListImportText" style="margin-top: 10px;"></h4>
                            <div id="cslgListImportActionContainer" style="display: none;">
                                <button id="cslgListImportMoveButton" style="color: black;">Move To Song List</button>
                                <button id="cslgListImportDownloadButton" style="color: black;">Download</button>
                            </div>
                        </div>
                        <div id="cslgInfoContainer" class="tabSection" style="text-align: center; margin: 10px 0;">
                            <h4>Script Info</h4>
                            <div>Created by: kempanator</div>
                            <div>Version: ${GM_info.script.version}</div>
                            <div><a href="https://github.com/kempanator/amq-scripts/blob/main/amqCustomSongListGame.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js" target="_blank">Install</a></div>
                            <h4 style="margin-top: 20px;">Custom CSS</h4>
                            <div><span style="font-size: 15px; margin-right: 17px;">#lnCustomSongListButton </span>right: <input id="cslgCSLButtonCSSInput" type="text" style="width: 150px; color: black;"></div>
                            <div style="margin: 10px 0"><button id="cslgResetCSSButton" style="color: black; margin-right: 10px;">Reset</button><button id="cslgApplyCSSButton" style="color: black;">Save</button></div>
                            <h4 style="margin-top: 20px;">Prompt All Players</h4>
                            <div style="margin: 10px 0"><button id="cslgPromptAllAutocompleteButton" style="color: black; margin-right: 10px;">Autocomplete</button><button id="cslgPromptAllVersionButton" style="color: black;">Version</button></div>
                            <div style="margin-top: 15px"><span style="font-size: 16px; margin-right: 10px; vertical-align: middle;">Show CSL Messages</span><div class="customCheckbox" style="vertical-align: middle"><input type="checkbox" id="cslgShowCSLMessagesCheckbox"><label for="cslgShowCSLMessagesCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div></div>
                            <div style="margin: 10px 0"><input id="cslgMalClientIdInput" type="text" placeholder="MAL Client ID" style="width: 300px; color: black;"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cslgAutocompleteButton" class="btn btn-danger" style="float: left">Autocomplete</button>
                        <button id="cslgExitButton" class="btn btn-default" data-dismiss="modal">Exit</button>
                        <button id="cslgStartButton" class="btn btn-primary">Start</button>
                    </div>
                </div>
            </div>
        </div>
    `));

    const tabs = ["cslgSongList", "cslgQuizSettings", "cslgAnswer", "cslgMerge", "cslgHotkey", "cslgListImport", "cslgInfo"];
    for (const tab of tabs) {
        $(`#${tab}Tab`).on("click", () => {
            switchTab(tab);
        });
    }
    switchTab("cslgSongList");

    $("#cslgAnisongdbSearchButtonGo").on("click", () => {
        anisongdbDataSearch();
    });
    $("#cslgAnisongdbQueryInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            anisongdbDataSearch();
        }
    });
    $("#cslgAnisongdbFilterDropdownButton").on("click", function () {
        $(this).find("i").toggleClass("fa-caret-down fa-caret-up");
        $("#cslgAnisongdbFilterOptions").slideToggle(150);
    });
    $("#cslgFileUpload").on("change", function () {
        if (this.files.length) {
            this.files[0].text().then((data) => {
                try {
                    handleData(JSON.parse(data));
                    if (songList.length === 0) {
                        messageDisplayer.displayMessage("0 song links found");
                    }
                }
                catch (error) {
                    songList = [];
                    $(this).val("");
                    console.error(error);
                    messageDisplayer.displayMessage("Upload Error");
                }
                setSongListTableSort();
                createSongListTable(true);
                createAnswerTable();
            });
        }
    });
    $("#cslgPreviousGameButtonGo").on("click", () => {
        const id = $("#cslgPreviousGameSelect").val();
        const found = Object.values(songHistoryWindow.tabs[2].gameMap).find(game => game.quizId === id);
        if (found) {
            handleData(found.songTable.rows);
            setSongListTableSort();
            createSongListTable(true);
            createAnswerTable();
        }
    });
    $("#cslgFilterListButtonGo").on("click", () => {
        filterSongList();
    });
    $("#cslgFilterListInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            filterSongList();
        }
    });
    $("#cslgMergeAllButton").on("click", () => {
        const set = new Set(mergedSongList.concat(songList).map(JSON.stringify));
        mergedSongList = Array.from(set, JSON.parse);
        createMergedSongListTable();
    }).popover({
        content: "Add all to merged",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgClearSongListButton").on("click", () => {
        songList = [];
        createSongListTable(true);
    }).popover({
        content: "Clear song list",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgTransferSongListButton").on("click", () => {
        songList = Array.from(mergedSongList);
        createSongListTable(true);
    }).popover({
        content: "Transfer from merged",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgTableModeButton").on("click", () => {
        songListTableView = (songListTableView + 1) % 3;
        createSongListTable(true);
    }).popover({
        content: "Table mode",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgSongOrderSelect").on("change", function () {
        songOrderType = this.value;
    });
    $("#cslgHostOverrideSelect").on("change", function () {
        fileHostOverride = parseInt(this.value);
    });
    $("#cslgMergeButton").on("click", () => {
        const set = new Set(mergedSongList.concat(songList).map(JSON.stringify));
        mergedSongList = Array.from(set, JSON.parse);
        createMergedSongListTable();
    });
    $("#cslgMergeClearButton").on("click", () => {
        mergedSongList = [];
        createMergedSongListTable();
    });
    $("#cslgMergeDownloadButton").on("click", () => {
        if (mergedSongList.length) {
            downloadListJson(mergedSongList, "merged.json");
        }
        else {
            messageDisplayer.displayMessage("No songs", "Add some songs to the merged song list");
        }
    });
    $("#cslgAutocompleteButton").on("click", () => {
        if (lobby.soloMode) {
            $("#cslgSettingsModal").modal("hide");
            socket.sendCommand({ type: "lobby", command: "start game" });
            const autocompleteListener = new Listener("get all song names", () => {
                autocompleteListener.unbindListener();
                viewChanger.changeView("main");
                setTimeout(() => {
                    hostModal.displayHostSolo();
                }, 200);
                setTimeout(() => {
                    const returnListener = new Listener("Host Game", () => {
                        returnListener.unbindListener();
                        if (songList.length) createAnswerTable();
                        setTimeout(() => { openSettingsModal() }, 10);
                    });
                    returnListener.bindListener();
                    roomBrowser.host();
                }, 400);
            });
            autocompleteListener.bindListener();
        }
        else {
            messageDisplayer.displayMessage("Autocomplete", "For multiplayer, just start the quiz normally and immediately lobby");
        }
    });
    $("#cslgListImportUsernameInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            startImport();
        }
    });
    $("#cslgListImportStartButton").on("click", () => {
        startImport();
    });
    $("#cslgListImportMoveButton").on("click", () => {
        if (!importedSongList.length) return;
        handleData(importedSongList);
        setSongListTableSort();
        createSongListTable(true);
        createAnswerTable();
    });
    $("#cslgListImportDownloadButton").on("click", () => {
        if (!importedSongList.length) return;
        const listType = $("#cslgListImportSelect").val();
        const username = $("#cslgListImportUsernameInput").val().trim();
        const date = new Date();
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, 0);
        const day = String(date.getDate()).padStart(2, 0);
        const fileName = `${username} ${listType} ${year}-${month}-${day} song list.json`;
        downloadListJson(importedSongList, fileName);
    });
    $("#cslgStartButton").on("click", () => {
        validateStart();
    });
    $("#cslgSongListTable")
        .on("click", "th", function () {
            const sort = $(this).data("sort");
            if (!sort) return;
            setSongListTableSort(sort);
            createSongListTable();
        })
        .on("click", "i.fa-plus", function () {
            const index = $(this).closest("tr").index();
            mergedSongList.push(songList[index]);
            mergedSongList = Array.from(new Set(mergedSongList.map(JSON.stringify))).map(JSON.parse);
            createMergedSongListTable();
        })
        .on("click", "i.fa-trash", function () {
            const index = $(this).closest("tr").index();
            songList.splice(index, 1);
            createSongListTable(true);
            createAnswerTable();
        })
        .on("mouseenter", "i.fa-plus, i.fa-trash", function () {
            $(this).closest("tr").addClass("selected");
        })
        .on("mouseleave", "i.fa-plus, i.fa-trash", function () {
            $(this).closest("tr").removeClass("selected");
        });
    $("#cslgAnswerButtonAdd").on("click", function () {
        const oldName = $("#cslgOldAnswerInput").val().trim();
        const newName = $("#cslgNewAnswerInput").val().trim();
        if (oldName) {
            if (newName) replacedAnswers[oldName] = newName;
            else delete replacedAnswers[oldName];
            saveSettings();
            createAnswerTable();
        }
        //console.log(replacedAnswers);
    });
    $("#cslgAnswerTable").on("click", "i.fa-pencil", function () {
        const $row = $(this).closest("tr");
        const oldName = $row.find("td.oldName").text();
        const newName = $row.find("td.newName").text();
        $("#cslgOldAnswerInput").val(oldName);
        $("#cslgNewAnswerInput").val(newName);
    });
    $("#cslgMergedSongListTable")
        .on("click", "i.fa-chevron-up", function () {
            const index = $(this).closest("tr").index();
            if (index > 0) {
                [mergedSongList[index], mergedSongList[index - 1]] = [mergedSongList[index - 1], mergedSongList[index]];
                createMergedSongListTable();
            }
        })
        .on("click", "i.fa-chevron-down", function () {
            const index = $(this).closest("tr").index();
            if (index < mergedSongList.length - 1) {
                [mergedSongList[index], mergedSongList[index + 1]] = [mergedSongList[index + 1], mergedSongList[index]];
                createMergedSongListTable();
            }
        })
        .on("click", "i.fa-trash", function () {
            const index = $(this).closest("tr").index();
            mergedSongList.splice(index, 1);
            createMergedSongListTable();
        })
        .on("mouseenter", "i.fa-chevron-up, i.fa-chevron-down, i.fa-trash", function () {
            $(this).closest("tr").addClass("selected");
        })
        .on("mouseleave", "i.fa-chevron-up, i.fa-chevron-down, i.fa-trash", function () {
            $(this).closest("tr").removeClass("selected");
        });
    $("#cslgSongListModeSelect").val("Anisongdb").on("change", function () {
        const val = this.value;
        const idMap = {
            "Anisongdb": "#cslgAnisongdbSearchRow",
            "Load File": "#cslgFileUploadRow",
            "Previous Game": "#cslgPreviousGameRow",
            "Filter List": "#cslgFilterListRow"
        }
        $(Object.values(idMap).join(",")).hide();
        $(idMap[val]).show();
        if (val === "Load File") $("#cslgAnisongdbQueryInput").val("");
        if (val === "Previous Game") loadPreviousGameOptions();
    });
    $("#cslgAnisongdbModeSelect").val("Artist");
    $("#cslgAnisongdbMaxOtherPeopleInput").val("99");
    $("#cslgAnisongdbMinGroupMembersInput").val("0");
    $("#cslgSettingsSongs").val("20");
    $("#cslgSettingsGuessTime").val("20");
    $("#cslgSettingsExtraGuessTime").val("0");
    $("#cslgSettingsStartPoint").val("0-100");
    $("#cslgSettingsDifficulty").val("0-100");
    $("#cslgFileUploadRow").hide();
    $("#cslgPreviousGameRow").hide();
    $("#cslgFilterListRow").hide();
    $("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
    $("#cslgResetCSSButton").on("click", () => {
        CSLButtonCSS = "calc(25% - 250px)";
        $("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
    });
    $("#cslgApplyCSSButton").on("click", () => {
        const val = $("#cslgCSLButtonCSSInput").val();
        if (val) {
            CSLButtonCSS = val;
            saveSettings();
            applyStyles();
        }
        else {
            messageDisplayer.displayMessage("Error");
        }
    });
    $("#cslgShowCSLMessagesCheckbox").prop("checked", showCSLMessages).on("click", () => {
        showCSLMessages = !showCSLMessages;
    });
    $("#cslgPromptAllAutocompleteButton").on("click", () => {
        cslMessage("§CSL21");
    });
    $("#cslgPromptAllVersionButton").on("click", () => {
        cslMessage("§CSL22");
    });
    $("#cslgMalClientIdInput").val(malClientId).on("change", function () {
        malClientId = this.value;
        saveSettings();
    });

    createHotkeyTable([
        { action: "cslgWindow", title: "Open This Window" },
        { action: "start", title: "Start CSL" },
        { action: "stop", title: "Stop CSL" },
        { action: "mergeAll", title: "Add All To Merged" },
        { action: "clearSongList", title: "Clear Song List" },
        { action: "transferMerged", title: "Transfer From Merged" },
        { action: "clearMerged", title: "Clear Merged" },
        { action: "downloadMerged", title: "Download Merged" },
        { action: "tableMode", title: "Change Table Mode" }
    ]);

    const hotkeyActions = {
        cslgWindow: () => {
            if ($("#cslgSettingsModal").is(":visible")) {
                $("#cslgSettingsModal").modal("hide");
            }
            else {
                openSettingsModal();
            }
        },
        start: () => {
            validateStart();
        },
        stop: () => {
            quizOver();
        },
        mergeAll: () => {
            const set = new Set(mergedSongList.concat(songList).map(JSON.stringify));
            mergedSongList = Array.from(set, JSON.parse);
            createMergedSongListTable();
        },
        clearSongList: () => {
            if (quiz.inQuiz) return;
            songList = [];
            createSongListTable(true);
        },
        transferMerged: () => {
            if (quiz.inQuiz) return;
            songList = Array.from(mergedSongList);
            createSongListTable(true);
        },
        clearMerged: () => {
            mergedSongList = [];
            createMergedSongListTable();
        },
        downloadMerged: () => {
            if (mergedSongList.length) {
                downloadListJson(mergedSongList, "merged.json");
            }
            else {
                messageDisplayer.displayMessage("No songs", "Add some songs to the merged song list");
            }
        },
        tableMode: () => {
            songListTableView = (songListTableView + 1) % 3;
            createSongListTable(true);
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

    resultChunk = new Chunk();
    songInfoChunk = new Chunk();
    nextSongChunk = new Chunk();

    applyStyles();
    AMQ_addScriptData({
        name: "Custom Song List Game",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js",
        description: `
            </ul><b>How to start a custom song list game:</b>
                <li>create a solo lobby</li>
                <li>click the CSL button in the top right</li>
                <li>click the autocomplete button if it is red</li>
                <li>create or upload a list in the song list tab</li>
                <li>change settings in the settings tab</li>
                <li>fix any invalid answers in the answer tab</li>
                <li>click start to play the quiz</li>
            </ul>
        `
    });
}

// validate all settings and attempt to start csl quiz
function validateStart() {
    if (!lobby.inLobby) return;
    songOrder = {};
    if (!lobby.isHost) {
        return messageDisplayer.displayMessage("Unable to start", "Must be host");
    }
    if (lobby.numberOfPlayers !== lobby.numberOfPlayersReady) {
        return messageDisplayer.displayMessage("Unable to start", "All players must be ready");
    }
    if (!songList || !songList.length) {
        return messageDisplayer.displayMessage("Unable to start", "No songs");
    }
    if (animeListLower.size === 0) {
        return messageDisplayer.displayMessage("Unable to start", "Autocomplete list empty");
    }
    const numSongs = parseInt($("#cslgSettingsSongs").val());
    if (isNaN(numSongs) || numSongs < 1) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid number of songs");
    }
    guessTime = parseInt($("#cslgSettingsGuessTime").val());
    if (isNaN(guessTime) || guessTime < 1 || guessTime > 99) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid guess time");
    }
    extraGuessTime = parseInt($("#cslgSettingsExtraGuessTime").val());
    if (isNaN(extraGuessTime) || extraGuessTime < 0 || extraGuessTime > 15) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid extra guess time");
    }
    const startPointText = $("#cslgSettingsStartPoint").val().trim();
    if (/^[0-9]+$/.test(startPointText)) {
        startPointRange = [parseInt(startPointText), parseInt(startPointText)];
    }
    else if (/^[0-9]+[\s-]+[0-9]+$/.test(startPointText)) {
        const regex = /^([0-9]+)[\s-]+([0-9]+)$/.exec(startPointText);
        startPointRange = [parseInt(regex[1]), parseInt(regex[2])];
    }
    else {
        return messageDisplayer.displayMessage("Unable to start", "Song start sample must be a number or range 0-100");
    }
    if (startPointRange[0] < 0 || startPointRange[0] > 100 || startPointRange[1] < 0 || startPointRange[1] > 100 || startPointRange[0] > startPointRange[1]) {
        return messageDisplayer.displayMessage("Unable to start", "Song start sample must be a number or range 0-100");
    }
    const difficultyText = $("#cslgSettingsDifficulty").val().trim();
    if (/^[0-9]+[\s-]+[0-9]+$/.test(difficultyText)) {
        const regex = /^([0-9]+)[\s-]+([0-9]+)$/.exec(difficultyText);
        difficultyRange = [parseInt(regex[1]), parseInt(regex[2])];
    }
    else {
        return messageDisplayer.displayMessage("Unable to start", "Difficulty must be a range 0-100");
    }
    if (difficultyRange[0] < 0 || difficultyRange[0] > 100 || difficultyRange[1] < 0 || difficultyRange[1] > 100 || difficultyRange[0] > difficultyRange[1]) {
        return messageDisplayer.displayMessage("Unable to start", "Difficulty must be a range 0-100");
    }
    const ops = $("#cslgSettingsOPCheckbox").prop("checked");
    const eds = $("#cslgSettingsEDCheckbox").prop("checked");
    const ins = $("#cslgSettingsINCheckbox").prop("checked");
    const tv = $("#cslgSettingsTVCheckbox").prop("checked");
    const movie = $("#cslgSettingsMovieCheckbox").prop("checked");
    const ova = $("#cslgSettingsOVACheckbox").prop("checked");
    const ona = $("#cslgSettingsONACheckbox").prop("checked");
    const special = $("#cslgSettingsSpecialCheckbox").prop("checked");
    const dub = $("#cslgSettingsDubCheckbox").prop("checked");
    const rebroadcast = $("#cslgSettingsRebroadcastCheckbox").prop("checked");
    const correctGuesses = $("#cslgSettingsCorrectGuessCheckbox").prop("checked");
    const incorrectGuesses = $("#cslgSettingsIncorrectGuessCheckbox").prop("checked");
    const songKeys = Object.keys(songList)
        .filter((key) => songTypeFilter(songList[key], ops, eds, ins))
        .filter((key) => animeTypeFilter(songList[key], tv, movie, ova, ona, special))
        .filter((key) => difficultyFilter(songList[key], difficultyRange[0], difficultyRange[1]))
        .filter((key) => guessTypeFilter(songList[key], correctGuesses, incorrectGuesses))
        .filter((key) => broadcastTypeFilter(songList[key], dub, rebroadcast));
    if (songOrderType === "random") shuffleArray(songKeys);
    else if (songOrderType === "descending") songKeys.reverse();
    songKeys.slice(0, numSongs).forEach((key, i) => { songOrder[i + 1] = parseInt(key) });
    totalSongs = Object.keys(songOrder).length;
    if (totalSongs === 0) {
        return messageDisplayer.displayMessage("Unable to start", "No songs");
    }
    fastSkip = $("#cslgSettingsFastSkipCheckbox").prop("checked");
    fullSongRange = $("#cslgSettingsFullSongRangeCheckbox").prop("checked");
    $("#cslgSettingsModal").modal("hide");
    //console.log(songOrder);
    if (lobby.soloMode) {
        startQuiz();
    }
    else if (lobby.isHost) {
        cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
    }
}

// start quiz and load first song
function startQuiz() {
    if (!lobby.inLobby) return;
    if (lobby.soloMode) {
        if (!songList.length) return;
    }
    else {
        cslMultiplayer.host = lobby.hostName;
    }
    let song;
    if (lobby.isHost) {
        song = songList[songOrder[1]];
    }
    skipping = false;
    quiz.cslActive = true;
    const date = new Date().toISOString();
    for (const player of Object.values(lobby.players)) {
        score[player.gamePlayerId] = 0;
    }
    //console.log({showSelection, totalSongs, guessTime, extraGuessTime, fastSkip});
    const data = {
        "gameMode": lobby.soloMode ? "Solo" : "Multiplayer",
        "showSelection": showSelection,
        "groupSlotMap": createGroupSlotMap(Object.keys(lobby.players)),
        "players": [],
        "multipleChoice": false,
        "quizDescription": {
            "quizId": crypto.randomUUID(),
            "startTime": date,
            "roomName": hostModal.$roomName.val()
        }
    };
    Object.values(lobby.players).forEach((player, i) => {
        player.pose = 1;
        player.score = 0;
        player.position = Math.floor(i / 8) + 1;
        player.positionSlot = i % 8;
        player.teamCaptain = null;
        player.teamNumber = null;
        player.teamPlayer = null;
        data.players.push(player);
    });
    //console.log(data.players);
    fireListener("Game Starting", data);
    setTimeout(() => {
        if (quiz.soloMode) {
            fireListener("quiz next video info", {
                "playLength": guessTime,
                "playbackSpeed": 1,
                "startPoint": getStartPoint(),
                "fullSongRange": fullSongRange,
                "videoInfo": {
                    "id": null,
                    "videoMap": {
                        "catbox": createCatboxLinkObject(song.audio, song.video480, song.video720)
                    },
                    "videoVolumeMap": {
                        "catbox": {
                            "0": -20,
                            "480": -20,
                            "720": -20
                        }
                    }
                }
            });
        }
        else {
            if (quiz.isHost) {
                const message = `1§${getStartPoint()}§${song.audio || ""}§${song.video480 || ""}§${song.video720 || ""}`;
                splitIntoChunks(btoa(encodeURIComponent(message)) + "$", 144).forEach((item, index) => {
                    cslMessage("§CSL3" + base10to36(index % 36) + item);
                });
            }
        }
    }, 100);
    if (quiz.soloMode) {
        setTimeout(() => {
            fireListener("quiz ready", {
                "numberOfSongs": totalSongs
            });
        }, 200);
        setTimeout(() => {
            fireListener("quiz waiting buffering", {
                "firstSong": true
            });
        }, 300);
        setTimeout(() => {
            previousSongFinished = true;
            readySong(1);
        }, 400);
    }
}

// check if all conditions are met to go to next song
function readySong(songNumber) {
    if (songNumber === currentSong) return;
    //console.log("Ready song: " + songNumber);
    nextVideoReadyInterval = setInterval(() => {
        //console.log({nextVideoReady, previousSongFinished});
        if (nextVideoReady && !quiz.pauseButton.pauseOn && previousSongFinished) {
            clearInterval(nextVideoReadyInterval);
            nextVideoReady = false;
            previousSongFinished = false;
            if (quiz.soloMode) {
                playSong(songNumber);
            }
            else if (quiz.isHost) {
                cslMessage("§CSL4" + btoa(songNumber));
            }
        }
    }, 100);
}

// play a song
function playSong(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    for (const key of Object.keys(quiz.players)) {
        currentAnswers[key] = "";
        cslMultiplayer.voteSkip[key] = false;
    }
    answerChunks = {};
    resultChunk = new Chunk();
    songInfoChunk = new Chunk();
    cslMultiplayer.songInfo = {};
    currentSong = songNumber;
    cslState = 1;
    skipping = false;
    songStartTime = Date.now();
    fireListener("play next song", {
        "time": guessTime,
        "extraGuessTime": extraGuessTime,
        "songNumber": songNumber,
        "progressBarState": { "length": guessTime, "played": 0 },
        "onLastSong": songNumber === totalSongs,
        "multipleChoiceNames": null
    });
    if (extraGuessTime) {
        extraGuessTimer = setTimeout(() => {
            fireListener("extra guess time");
        }, guessTime * 1000);
    }
    endGuessTimer = setTimeout(() => {
        if (quiz.soloMode) {
            clearInterval(skipInterval);
            clearTimeout(endGuessTimer);
            clearTimeout(extraGuessTimer);
            endGuessPhase(songNumber);
        }
        else if (quiz.isHost) {
            cslMessage("§CSL15");
        }
    }, (guessTime + extraGuessTime) * 1000);
    if (quiz.soloMode) {
        skipInterval = setInterval(() => {
            if (quiz.skipController._toggled) {
                fireListener("quiz overlay message", "Skipping to Answers");
                clearInterval(skipInterval);
                clearTimeout(endGuessTimer);
                clearTimeout(extraGuessTimer);
                setTimeout(() => {
                    endGuessPhase(songNumber);
                }, fastSkip ? 1000 : 3000);
            }
        }, 100);
    }
    setTimeout(() => {
        if (songNumber < totalSongs) {
            if (quiz.soloMode) {
                readySong(songNumber + 1);
                const nextSong = songList[songOrder[songNumber + 1]];
                fireListener("quiz next video info", {
                    "playLength": guessTime,
                    "playbackSpeed": 1,
                    "startPoint": getStartPoint(),
                    "videoInfo": {
                        "id": null,
                        "videoMap": {
                            "catbox": createCatboxLinkObject(nextSong.audio, nextSong.video480, nextSong.video720)
                        },
                        "videoVolumeMap": {
                            "catbox": {
                                "0": -20,
                                "480": -20,
                                "720": -20
                            }
                        }
                    }
                });
            }
            else {
                readySong(songNumber + 1);
                if (quiz.isHost) {
                    const nextSong = songList[songOrder[songNumber + 1]];
                    const message = `${songNumber + 1}§${getStartPoint()}§${nextSong.audio || ""}§${nextSong.video480 || ""}§${nextSong.video720 || ""}`;
                    splitIntoChunks(btoa(encodeURIComponent(message)) + "$", 144).forEach((item, index) => {
                        cslMessage("§CSL3" + base10to36(index % 36) + item);
                    });
                }
            }
        }
    }, 100);
}

// end guess phase and display answer
function endGuessPhase(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    let song;
    if (quiz.isHost) {
        song = songList[songOrder[songNumber]];
    }
    fireListener("guess phase over");
    if (!quiz.soloMode && quiz.inQuiz && !quiz.isSpectator) {
        const answer = currentAnswers[quiz.ownGamePlayerId];
        if (answer) {
            splitIntoChunks(btoa(encodeURIComponent(answer)) + "$", 144).forEach((item, index) => {
                cslMessage("§CSL5" + base10to36(index % 36) + item);
            });
        }
    }
    answerTimer = setTimeout(() => {
        if (!quiz.cslActive || !quiz.inQuiz) return reset();
        cslState = 2;
        skipping = false;
        if (!quiz.soloMode) {
            for (const player of Object.values(quiz.players)) {
                currentAnswers[player.gamePlayerId] = answerChunks[player.gamePlayerId] ? answerChunks[player.gamePlayerId].decode() : "";
            }
        }
        for (const key of Object.keys(quiz.players)) {
            cslMultiplayer.voteSkip[key] = false;
        }
        const data = {
            "answers": [],
            "progressBarState": null
        };
        for (const player of Object.values(quiz.players)) {
            data.answers.push({
                "gamePlayerId": player.gamePlayerId,
                "pose": 3,
                "answer": currentAnswers[player.gamePlayerId] || ""
            });
        }
        fireListener("player answers", data);
        if (!quiz.soloMode && quiz.isHost) {
            const message = `${song.animeRomajiName || ""}\n${song.animeEnglishName || ""}\n${(song.altAnimeNames || []).join("\t")}\n${(song.altAnimeNamesAnswers || []).join("\t")}\n${song.songArtist || ""}\n${song.songName || ""}\n${song.songType || ""}\n${song.songTypeNumber || ""}\n${song.songDifficulty || ""}\n${song.animeType || ""}\n${song.animeVintage || ""}\n${song.annId || ""}\n${song.malId || ""}\n${song.kitsuId || ""}\n${song.aniListId || ""}\n${Array.isArray(song.animeTags) ? song.animeTags.join(",") : ""}\n${Array.isArray(song.animeGenre) ? song.animeGenre.join(",") : ""}\n${song.audio || ""}\n${song.video480 || ""}\n${song.video720 || ""}`;
            splitIntoChunks(btoa(encodeURIComponent(message)) + "$", 144).forEach((item, index) => {
                cslMessage("§CSL7" + base10to36(index % 36) + item);
            });
        }
        answerTimer = setTimeout(() => {
            if (!quiz.cslActive || !quiz.inQuiz) return reset();
            const correct = {};
            const pose = {};
            if (quiz.isHost) {
                for (const player of Object.values(quiz.players)) {
                    const isCorrect = isCorrectAnswer(songNumber, currentAnswers[player.gamePlayerId]);
                    correct[player.gamePlayerId] = isCorrect;
                    pose[player.gamePlayerId] = currentAnswers[player.gamePlayerId] ? (isCorrect ? 5 : 4) : 6;
                    if (isCorrect) score[player.gamePlayerId]++;
                }
            }
            if (quiz.soloMode) {
                const data = {
                    "players": [],
                    "songInfo": {
                        "animeNames": {
                            "english": song.animeEnglishName,
                            "romaji": song.animeRomajiName
                        },
                        "artist": song.songArtist,
                        "artistInfo": {
                            "artistId": null, //song.songArtistIds.artistId,
                            "groupId": null, //song.songArtistIds.groupId,
                            "name": song.songArtist
                        },
                        "arrangerInfo": {
                            "artistId": null, //song.songArrangerIds.artistId,
                            "groupId": null, //song.songArrangerIds.groupId,
                            "name": song.songArranger
                        },
                        "composerInfo": {
                            "artistId": null, //song.songComposerIds.artistId,
                            "groupId": null, //song.songComposerIds.groupId,
                            "name": song.songComposer
                        },
                        "songName": song.songName,
                        "videoTargetMap": {
                            "catbox": {
                                "0": formatTargetUrl(song.audio),
                                "480": formatTargetUrl(song.video480),
                                "720": formatTargetUrl(song.video720)
                            }
                        },
                        "type": song.songType,
                        "typeNumber": song.songTypeNumber,
                        "annId": song.annId,
                        "highRisk": 0,
                        "animeScore": null,
                        "animeType": song.animeType,
                        "vintage": formatAmqVintage(song.animeVintage),
                        "animeDifficulty": song.songDifficulty,
                        "animeTags": song.animeTags,
                        "animeGenre": song.animeGenre,
                        "altAnimeNames": song.altAnimeNames,
                        "altAnimeNamesAnswers": song.altAnimeNamesAnswers,
                        "rebroadcast": song.rebroadcast,
                        "dub": song.dub,
                        "siteIds": {
                            "annId": song.annId,
                            "malId": song.malId,
                            "kitsuId": song.kitsuId,
                            "aniListId": song.aniListId
                        }
                    },
                    "progressBarState": {
                        "length": 25,
                        "played": 0
                    },
                    "groupMap": createGroupSlotMap(Object.keys(quiz.players)),
                    "watched": false
                };
                for (const player of Object.values(quiz.players)) {
                    data.players.push({
                        "gamePlayerId": player.gamePlayerId,
                        "pose": pose[player.gamePlayerId],
                        "level": quiz.players[player.gamePlayerId].level,
                        "correct": correct[player.gamePlayerId],
                        "score": score[player.gamePlayerId],
                        "listStatus": null,
                        "showScore": null,
                        "position": Math.floor(player.gamePlayerId / 8) + 1,
                        "positionSlot": player.gamePlayerId % 8
                    });
                }
                fireListener("answer results", data);
            }
            else if (quiz.isHost) {
                const list = [];
                for (const id of Object.keys(correct)) {
                    list.push(`${id},${correct[id] ? "1" : "0"},${pose[id]},${score[id]}`);
                }
                splitIntoChunks(btoa(encodeURIComponent(list.join("§"))) + "$", 144).forEach((item, index) => {
                    cslMessage("§CSL6" + base10to36(index % 36) + item);
                });
            }
            setTimeout(() => {
                if (!quiz.cslActive || !quiz.inQuiz) return reset();
                if (quiz.soloMode) {
                    skipInterval = setInterval(() => {
                        if (quiz.skipController._toggled) {
                            clearInterval(skipInterval);
                            endReplayPhase(songNumber);
                        }
                    }, 100);
                }
            }, fastSkip ? 1000 : 2000);
        }, fastSkip ? 200 : 3000);
    }, fastSkip ? 100 : 400);
}

// end replay phase
function endReplayPhase(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    //console.log(`end replay phase (${songNumber})`);
    if (songNumber < totalSongs) {
        fireListener("quiz overlay message", "Skipping to Next Song");
        setTimeout(() => {
            previousSongFinished = true;
        }, fastSkip ? 1000 : 3000);
    }
    else {
        fireListener("quiz overlay message", "Skipping to Final Standings");
        setTimeout(() => {
            const data = {
                "resultStates": []
            };
            /*"progressBarState": {
                "length": 26.484,
                "played": 6.484
            }*/
            const sortedScores = Array.from(new Set(Object.values(score))).sort((a, b) => b - a);
            for (const id of Object.keys(score)) {
                data.resultStates.push({
                    "gamePlayerId": parseInt(id),
                    "pose": 1,
                    "endPosition": sortedScores.indexOf(score[id]) + 1
                });
            }
            fireListener("quiz end result", data);
        }, fastSkip ? 2000 : 5000);
        setTimeout(() => {
            if (quiz.soloMode) {
                quizOver();
            }
            else if (quiz.isHost) {
                cslMessage("§CSL10");
            }
        }, fastSkip ? 5000 : 12000);
    }
}

// fire all event listeners (including scripts)
function fireListener(type, data) {
    try {
        for (const listener of socket.listners[type]) {
            listener.fire(data);
        }
    }
    catch (error) {
        sendSystemMessage(`CSL Error: "${type}" listener failed`);
        console.error(error);
        console.log(type);
        console.log(data);
    }
}

// send csl chat message
function cslMessage(text) {
    if (!isQuizOfTheDay()) {
        socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: String(text), teamMessage: false } });
    }
}

// send a client side message to game chat
function sendSystemMessage(message, message2) {
    setTimeout(() => {
        if (gameChat.open) {
            if (message2) {
                gameChat.systemMessage(String(message), String(message2));
            }
            else {
                gameChat.systemMessage(String(message));
            }
        }
        else if (nexus.inCoopLobby) {
            nexusCoopChat.displayServerMessage({ message: String(message) });
        }
    }, 0);
}

// parse message
function parseMessage(content, sender) {
    if (isQuizOfTheDay()) return;
    let player;
    if (lobby.inLobby) player = Object.values(lobby.players).find(x => x._name === sender);
    else if (quiz.inQuiz) player = Object.values(quiz.players).find(x => x._name === sender);
    const isHost = sender === cslMultiplayer.host;
    if (content.startsWith("§CSL0")) { //start quiz
        if (lobby.inLobby && sender === lobby.hostName && !quiz.cslActive) {
            const split = atob(content.slice(5)).split("§");
            if (split.length === 6) {
                //mode = parseInt(split[0]);
                currentSong = parseInt(split[1]);
                totalSongs = parseInt(split[2]);
                guessTime = parseInt(split[3]);
                extraGuessTime = parseInt(split[4]);
                fastSkip = Boolean(parseInt(split[5]));
                sendSystemMessage(`CSL: starting multiplayer quiz (${totalSongs} songs)`);
                startQuiz();
            }
        }
    }
    else if (quiz.cslActive && quiz.inQuiz && cslMultiplayer.host !== lobby.hostName) {
        sendSystemMessage("client out of sync, quitting CSL");
        quizOver();
    }
    else if (content === "§CSL10") { //return to lobby
        if (quiz.cslActive && quiz.inQuiz && (isHost || sender === lobby.hostName)) {
            quizOver();
        }
    }
    else if (content === "§CSL11") { //pause
        if (quiz.cslActive && isHost) {
            fireListener("quiz pause triggered", {
                "playerName": sender
            });
        }
    }
    else if (content === "§CSL12") { //unpause
        if (quiz.cslActive && isHost) {
            fireListener("quiz unpause triggered", {
                "playerName": sender
            });
        }
    }
    else if (content === "§CSL13") { //player answered
        if (quiz.cslActive && player) {
            const time = Number(((Date.now() - songStartTime) / 1000).toFixed(3));
            fireListener("player answered", [{ answerTime: time, gamePlayerIds: [player.gamePlayerId] }]);
        }
    }
    else if (content === "§CSL14") { //vote skip
        if (quiz.cslActive && quiz.isHost && player) {
            cslMultiplayer.voteSkip[player.gamePlayerId] = true;
            if (!skipping && checkVoteSkip()) {
                skipping = true;
                if (cslState === 1) {
                    cslMessage("§CSL15");
                }
                else if (cslState === 2) {
                    cslMessage("§CSL16");
                }
            }
        }
    }
    else if (content === "§CSL15") { //skip guessing phase
        if (quiz.cslActive && isHost) {
            fireListener("quiz overlay message", "Skipping to Answers");
            clearInterval(skipInterval);
            clearTimeout(endGuessTimer);
            clearTimeout(extraGuessTimer);
            setTimeout(() => {
                endGuessPhase(currentSong);
            }, fastSkip ? 1000 : 3000);
        }
    }
    else if (content === "§CSL16") { //skip replay phase
        if (quiz.cslActive && isHost) {
            endReplayPhase(currentSong);
        }
    }
    else if (content.startsWith("§CSL17")) { //player rejoin
        if (sender === lobby.hostName) {
            const name = atob(content.slice(6));
            if (name === selfName) {
                socket.sendCommand({ type: "lobby", command: "change to player" });
            }
            else if (quiz.cslActive && quiz.inQuiz) {
                const player = Object.values(quiz.players).find(p => p._name === name);
                if (player) {
                    fireListener("Rejoining Player", { "name": name, "gamePlayerId": player.gamePlayerId });
                }
            }
        }
    }
    else if (content === "§CSL21") { //has autocomplete
        cslMessage(`Autocomplete: ${animeListLower.size ? "✅" : "⛔"}`);
    }
    else if (content === "§CSL22") { //version
        cslMessage(`CSL version ${GM_info.script.version}`);
    }
    else if (content.startsWith("§CSL3")) { //next song link
        if (quiz.cslActive && isHost) {
            //§CSL3#songNumber§startPoint§mp3§480§720
            nextSongChunk.append(content);
            if (nextSongChunk.isComplete) {
                const split = nextSongChunk.decode().split("§");
                nextSongChunk = new Chunk();
                if (split.length === 5) {
                    if (!songLinkReceived[split[0]]) {
                        songLinkReceived[split[0]] = true;
                        fireListener("quiz next video info", {
                            "playLength": guessTime,
                            "playbackSpeed": 1,
                            "startPoint": parseInt(split[1]),
                            "videoInfo": {
                                "id": null,
                                "videoMap": {
                                    "catbox": createCatboxLinkObject(split[2], split[3], split[4])
                                },
                                "videoVolumeMap": {
                                    "catbox": {
                                        "0": -20,
                                        "480": -20,
                                        "720": -20
                                    }
                                }
                            }
                        });
                        if (Object.keys(songLinkReceived).length === 1) {
                            setTimeout(() => {
                                fireListener("quiz ready", {
                                    "numberOfSongs": totalSongs
                                });
                            }, 200);
                            setTimeout(() => {
                                fireListener("quiz waiting buffering", {
                                    "firstSong": true
                                });
                            }, 300);
                            setTimeout(() => {
                                previousSongFinished = true;
                                readySong(currentSong + 1);
                            }, 400);
                        }
                    }
                }
                else {
                    sendSystemMessage(`CSL Error: next song link decode failed`);
                }
            }
        }
    }
    else if (content.startsWith("§CSL4")) { //play song
        if (quiz.cslActive && isHost) {
            const number = parseInt(atob(content.slice(5)));
            //console.log("Play song: " + number);
            if (currentSong !== totalSongs) {
                playSong(number);
            }
        }
    }
    else if (content.startsWith("§CSL5")) { //player final answer
        if (quiz.cslActive && player) {
            if (!answerChunks[player.gamePlayerId]) answerChunks[player.gamePlayerId] = new Chunk();
            answerChunks[player.gamePlayerId].append(content);
        }
    }
    else if (content.startsWith("§CSL6")) { //answer results
        if (quiz.cslActive && isHost) {
            resultChunk.append(content);
            if (resultChunk.isComplete) {
                const split = resultChunk.decode().split("§");
                const data = {
                    "players": [],
                    "songInfo": {
                        "animeNames": {
                            "english": cslMultiplayer.songInfo.animeEnglishName,
                            "romaji": cslMultiplayer.songInfo.animeRomajiName
                        },
                        "artist": cslMultiplayer.songInfo.songArtist,
                        "songName": cslMultiplayer.songInfo.songName,
                        "videoTargetMap": {
                            "catbox": {
                                "0": formatTargetUrl(cslMultiplayer.songInfo.audio) || "",
                                "480": formatTargetUrl(cslMultiplayer.songInfo.video480) || "",
                                "720": formatTargetUrl(cslMultiplayer.songInfo.video720) || ""
                            }
                        },
                        "type": cslMultiplayer.songInfo.songType,
                        "typeNumber": cslMultiplayer.songInfo.songTypeNumber,
                        "annId": cslMultiplayer.songInfo.annId,
                        "highRisk": 0,
                        "animeScore": null,
                        "animeType": cslMultiplayer.songInfo.animeType,
                        "vintage": cslMultiplayer.songInfo.animeVintage,
                        "animeDifficulty": cslMultiplayer.songInfo.songDifficulty || 0,
                        "animeTags": cslMultiplayer.songInfo.animeTags || [],
                        "animeGenre": cslMultiplayer.songInfo.animeGenre || [],
                        "altAnimeNames": cslMultiplayer.songInfo.altAnimeNames || [],
                        "altAnimeNamesAnswers": cslMultiplayer.songInfo.altAnimeNamesAnswers || [],
                        "siteIds": {
                            "annId": cslMultiplayer.songInfo.annId,
                            "malId": cslMultiplayer.songInfo.malId,
                            "kitsuId": cslMultiplayer.songInfo.kitsuId,
                            "aniListId": cslMultiplayer.songInfo.aniListId
                        }
                    },
                    "progressBarState": {
                        "length": 25,
                        "played": 0
                    },
                    "groupMap": createGroupSlotMap(Object.keys(quiz.players)),
                    "watched": false
                };
                const decodedPlayers = [];
                for (const p of split) {
                    const playerSplit = p.split(",");
                    decodedPlayers.push({
                        id: parseInt(playerSplit[0]),
                        correct: Boolean(parseInt(playerSplit[1])),
                        pose: parseInt(playerSplit[2]),
                        score: parseInt(playerSplit[3])
                    });
                }
                decodedPlayers.sort((a, b) => b.score - a.score);
                decodedPlayers.forEach((p, i) => {
                    data.players.push({
                        "gamePlayerId": p.id,
                        "pose": p.pose,
                        "level": quiz.players[p.id].level,
                        "correct": p.correct,
                        "score": p.score,
                        "listStatus": null,
                        "showScore": null,
                        "position": Math.floor(i / 8) + 1,
                        "positionSlot": i % 8
                    });
                });
                //console.log(data.players);
                fireListener("answer results", data);
            }
        }
    }
    else if (content.startsWith("§CSL7")) {
        songInfoChunk.append(content);
        if (songInfoChunk.isComplete) {
            const split = preventCodeInjection(songInfoChunk.decode()).split("\n");
            cslMultiplayer.songInfo.animeRomajiName = split[0];
            cslMultiplayer.songInfo.animeEnglishName = split[1];
            cslMultiplayer.songInfo.altAnimeNames = split[2].split("\t").filter(Boolean);
            cslMultiplayer.songInfo.altAnimeNamesAnswers = split[3].split("\t").filter(Boolean);
            cslMultiplayer.songInfo.songArtist = split[4];
            cslMultiplayer.songInfo.songName = split[5];
            cslMultiplayer.songInfo.songType = parseInt(split[6]) || null;
            cslMultiplayer.songInfo.songTypeNumber = parseInt(split[7]) || null;
            cslMultiplayer.songInfo.songDifficulty = parseFloat(split[8]) || null;
            cslMultiplayer.songInfo.animeType = split[9];
            cslMultiplayer.songInfo.animeVintage = split[10];
            cslMultiplayer.songInfo.annId = parseInt(split[11]) || null;
            cslMultiplayer.songInfo.malId = parseInt(split[12]) || null;
            cslMultiplayer.songInfo.kitsuId = parseInt(split[13]) || null;
            cslMultiplayer.songInfo.aniListId = parseInt(split[14]) || null;
            cslMultiplayer.songInfo.animeTags = split[15].split(",");
            cslMultiplayer.songInfo.animeGenre = split[16].split(",");
            cslMultiplayer.songInfo.audio = split[17];
            cslMultiplayer.songInfo.video480 = split[18];
            cslMultiplayer.songInfo.video720 = split[19];
            console.log(split);
        }
    }
}

function checkVoteSkip() {
    const keys = Object.keys(cslMultiplayer.voteSkip).filter((key) => quiz.players.hasOwnProperty(key) && !quiz.players[key].avatarDisabled);
    for (const key of keys) {
        if (!cslMultiplayer.voteSkip[key]) return false;
    }
    return true;
}

// input list of player keys, return group slot map
function createGroupSlotMap(players) {
    players = players.map(Number);
    const map = {};
    let group = 1;
    if (Object.keys(score).length) players.sort((a, b) => score[b] - score[a]);
    for (let i = 0; i < players.length; i += 8) {
        map[group] = players.slice(i, i + 8);
        group++;
    }
    return map;
}

// check if the player's answer is correct
function isCorrectAnswer(songNumber, answer) {
    if (!answer) return false;
    answer = answer.toLowerCase();
    const song = songList[songOrder[songNumber]];
    const altAnimeNames = song.altAnimeNames || [];
    const altAnimeNamesAnswers = song.altAnimeNamesAnswers || [];
    const correctAnswers = [...altAnimeNames, ...altAnimeNamesAnswers];
    for (const a1 of correctAnswers) {
        const a2 = replacedAnswers[a1];
        if (a2 && a2.toLowerCase() === answer) return true;
        if (a1.toLowerCase() === answer) return true;
    }
    return false;
}

// get start point value (0-100)
function getStartPoint() {
    return Math.floor(Math.random() * (startPointRange[1] - startPointRange[0] + 1)) + startPointRange[0];
}

// return true if song type is allowed
function songTypeFilter(song, ops, eds, ins) {
    const type = song.songType;
    if (ops && type === 1) return true;
    if (eds && type === 2) return true;
    if (ins && type === 3) return true;
    return false;
}

// return true if anime type is allowed
function animeTypeFilter(song, tv, movie, ova, ona, special) {
    if (song.animeType) {
        const type = song.animeType.toLowerCase();
        if (tv && type === "tv") return true;
        if (movie && type === "movie") return true;
        if (ova && type === "ova") return true;
        if (ona && type === "ona") return true;
        if (special && type === "special") return true;
        return false;
    }
    else {
        return tv && movie && ova && ona && special;
    }
}

// return true if the song difficulty is in allowed range
// songs with missing difficulty will only pass if 0-100
function difficultyFilter(song, low, high) {
    if (low === 0 && high === 100) return true;
    const dif = parseFloat(song.songDifficulty);
    if (isNaN(dif)) return false;
    if (dif >= low && dif <= high) return true;
    return false;
}

// return true if guess type is allowed
// songs with null will only pass if both true
function guessTypeFilter(song, correctGuesses, incorrectGuesses) {
    if (correctGuesses && incorrectGuesses) return true;
    if (correctGuesses && song.correctGuess === true) return true;
    if (incorrectGuesses && song.incorrectGuess === true) return true;
    return false;
}

// return true if the song is allowed under the selected broadcast type
function broadcastTypeFilter(song, dub, rebroadcast) {
    if (!dub && song.dub) return false;
    if (!rebroadcast && song.rebroadcast) return false;
    return true;
}

// clear all intervals and timeouts
function clearTimeEvents() {
    clearInterval(nextVideoReadyInterval);
    clearInterval(skipInterval);
    clearTimeout(endGuessTimer);
    clearTimeout(extraGuessTimer);
    clearTimeout(answerTimer);
}

// reset variables from this script
function reset() {
    clearTimeEvents();
    quiz.cslActive = false;
    cslMultiplayer = { host: "", songInfo: {}, voteSkip: {} };
    cslState = 0;
    currentSong = 0;
    currentAnswers = {};
    score = {};
    previousSongFinished = false;
    skipping = false;
    songLinkReceived = {};
    answerChunks = {};
    songInfoChunk = new Chunk();
    nextSongChunk = new Chunk();
}

// end quiz and set up lobby
function quizOver() {
    reset();
    const data = {
        "spectators": [],
        "inLobby": true,
        "settings": hostModal.getSettings(true),
        "soloMode": quiz.soloMode,
        "inQueue": [],
        "hostName": lobby.hostName,
        "gameId": lobby.gameId,
        "players": [],
        "numberOfTeams": 0,
        "teamFullMap": {}
    };
    for (const player of Object.values(quiz.players)) {
        if (gameChat.spectators.some((spectator) => spectator.name === player._name)) {
            data.spectators.push({
                "name": player._name,
                "gamePlayerId": null
            });
        }
        else if (!player.avatarDisabled) {
            data.players.push({
                "name": player._name,
                "gamePlayerId": player.gamePlayerId,
                "level": player.level,
                "avatar": player.avatarInfo,
                "ready": true,
                "inGame": true,
                "teamNumber": null,
                "multipleChoice": false
            });
        }
    }
    lobby.setupLobby(data, gameChat.spectators.some((spectator) => spectator.name === selfName));
    viewChanger.changeView("lobby", { supressServerMsg: true, keepChatOpen: true });
}

// open custom song list settings modal
function openSettingsModal() {
    if (lobby.inLobby) {
        if (animeListLower.size) {
            $("#cslgAutocompleteButton").removeClass("btn-danger").addClass("btn-success disabled");
        }
        if ($("#cslgSongListModeSelect").val() === "Previous Game") {
            loadPreviousGameOptions();
        }
        $("#cslgSettingsModal").modal("show");
    }
}

// load previous game options in song list window
function loadPreviousGameOptions() {
    const $select = $("#cslgPreviousGameSelect").empty();
    const games = [];
    for (const game of Object.values(songHistoryWindow.tabs[2].gameMap)) {
        if (game.songTable.rows.length) {
            games.push({
                roomName: game.roomName,
                startTime: game.startTime,
                quizId: game.quizId
            });
        }
    }
    games.sort((a, b) => b.startTime - a.startTime);
    for (const game of games) {
        const text = `${game.roomName} - ${game.startTime.format("YYYY-MM-DD HH:mm")}`;
        $select.append($("<option>", { text: text, val: game.quizId }));
    }
}

// when you click the go button
function anisongdbDataSearch() {
    const mode = $("#cslgAnisongdbModeSelect").val().toLowerCase();
    const query = $("#cslgAnisongdbQueryInput").val();
    const filters = {
        ops: $("#cslgAnisongdbOPCheckbox").prop("checked"),
        eds: $("#cslgAnisongdbEDCheckbox").prop("checked"),
        ins: $("#cslgAnisongdbINCheckbox").prop("checked"),
        partial: $("#cslgAnisongdbPartialCheckbox").prop("checked"),
        ignoreDuplicates: $("#cslgAnisongdbIgnoreDuplicatesCheckbox").prop("checked"),
        arrangement: $("#cslgAnisongdbArrangementCheckbox").prop("checked"),
        maxOtherPeople: parseInt($("#cslgAnisongdbMaxOtherPeopleInput").val()),
        minGroupMembers: parseInt($("#cslgAnisongdbMinGroupMembersInput").val()),
        normal: $("#cslgAnisongdbNormalCheckbox").prop("checked"),
        dub: $("#cslgAnisongdbDubCheckbox").prop("checked"),
        rebroadcast: $("#cslgAnisongdbRebroadcastCheckbox").prop("checked"),
        standard: $("#cslgAnisongdbStandardCheckbox").prop("checked"),
        character: $("#cslgAnisongdbCharacterCheckbox").prop("checked"),
        chanting: $("#cslgAnisongdbChantingCheckbox").prop("checked"),
        instrumental: $("#cslgAnisongdbInstrumentalCheckbox").prop("checked")
    };
    if (query && !isNaN(filters.maxOtherPeople) && !isNaN(filters.minGroupMembers)) {
        getAnisongdbData(mode, query, filters);
    }
}

// send anisongdb request
function getAnisongdbData(mode, query, filters) {
    $("#cslgSongListCount").text("Loading...");
    $("#cslgSongListTable tbody").empty();
    let url, data;
    let json = {
        and_logic: false,
        ignore_duplicate: filters.ignoreDuplicates,
        opening_filter: filters.ops,
        ending_filter: filters.eds,
        insert_filter: filters.ins,
        normal_broadcast: filters.normal,
        dub: filters.dub,
        rebroadcast: filters.rebroadcast,
        standard: filters.standard,
        character: filters.character,
        chanting: filters.chanting,
        instrumental: filters.instrumental
    };
    if (mode === "anime") {
        url = apiBase + "search_request";
        json.anime_search_filter = {
            search: query,
            partial_match: filters.partial
        };
    }
    else if (mode === "artist") {
        url = apiBase + "search_request";
        json.artist_search_filter = {
            search: query,
            partial_match: filters.partial,
            group_granularity: filters.minGroupMembers,
            max_other_artist: filters.maxOtherPeople
        };
    }
    else if (mode === "song") {
        url = apiBase + "search_request";
        json.song_name_search_filter = {
            search: query,
            partial_match: filters.partial
        };
    }
    else if (mode === "composer") {
        url = apiBase + "search_request";
        json.composer_search_filter = {
            search: query,
            partial_match: filters.partial,
            arrangement: filters.arrangement
        };
    }
    else if (mode === "season") {
        json.season = query;
        url = apiBase + "season_request";
    }
    else if (mode === "ann id") {
        url = apiBase + "ann_ids_request";
        json.ann_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "mal id") {
        url = apiBase + "mal_ids_request";
        json.mal_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "ann song id") {
        url = apiBase + "ann_song_ids_request";
        json.ann_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "amq song id") {
        url = apiBase + "amq_song_ids_request";
        json.amq_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    data = {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(json)
    };
    fetch(url, data)
        .then(res => res.json())
        .then(json => {
            if (debug) console.log(json);
            handleData(json);
            setSongListTableSort();
            if (Array.isArray(json)) {
                createSongListTable(true);
            }
            else {
                $("#cslgSongListCount").text("Songs: 0");
                $("#cslgMergeCurrentCount").text("Current song list: 0 songs");
                $("#cslgSongListTable tbody").empty();
                $("#cslgSongListWarning").text(json?.detail || JSON.stringify(json));
            }
            createAnswerTable();
        })
        .catch(res => {
            songList = [];
            setSongListTableSort();
            $("#cslgSongListCount").text("Songs: 0");
            $("#cslgMergeCurrentCount").text("Current song list: 0 songs");
            $("#cslgSongListTable tbody").empty();
            $("#cslgSongListWarning").text(res.toString());
        });
}

function handleData(data) {
    songList = [];
    //remap data to actual song array
    if (!Array.isArray(data)) {
        if (typeof data === "object") {
            if (data.songs) {
                data = data.songs;
            }
            else if (data.songHistory) {
                data = Object.values(data.songHistory);
            }
            else return;
        }
        else return;
    }
    for (const song of data) {
        let animeRomajiName = song.animeRomajiName ?? song.animeJPName ?? song.songInfo?.animeNames?.romaji ?? song.anime?.romaji ?? song.animeRomaji ?? song.animeRom ?? "";
        let animeEnglishName = song.animeEnglishName ?? song.animeENName ?? song.songInfo?.animeNames?.english ?? song.anime?.english ?? song.animeEnglish ?? song.animeEng ?? "";
        let altAnimeNames = song.altAnimeNames ?? song.songInfo?.altAnimeNames ?? [].concat(animeRomajiName, animeEnglishName, song.animeAltName || []);
        let altAnimeNamesAnswers = song.altAnimeNamesAnswers ?? song.songInfo?.altAnimeNamesAnswers ?? [];
        let songArtist = song.songArtist ?? song.artist ?? song.songInfo?.artist ?? song.artistInfo?.name ?? "";
        /*let songArtistIds = {
            artistId: song.songArtistIds?.artistId ?? song.artistInfo?.artistId,
            groupId: song.songArtistIds?.groupId ?? song.artistInfo?.groupId
        };*/
        let songArranger = song.songArranger ?? song.arrangerInfo?.name ?? "";
        /*let songArrangerIds = {
            artistId: song.songArrangerIds?.artistId ?? song.arrangerInfo?.artistId,
            groupId: song.songArrangerIds?.groupId ?? song.arrangerInfo?.groupId
        };*/
        let songComposer = song.songComposer ?? song.composerInfo?.name ?? "";
        /*let songComposerIds = {
            artistId: song.songComposerIds?.artistId ?? song.composerInfo?.artistId,
            groupId: song.songComposerIds?.groupId ?? song.composerInfo?.groupId
        };*/
        let songName = song.songName ?? song.name ?? song.songInfo?.songName ?? "";
        let songType = song.songType ?? song.type ?? song.songInfo?.type ?? null;
        let songTypeNumber = song.songTypeNumber ?? song.songInfo?.typeNumber ?? null;
        let songDifficulty = parseFloat(song.songDifficulty ?? song.difficulty ?? song.songInfo?.animeDifficulty) || null;
        let animeType = song.animeType ?? song.songInfo?.animeType ?? "";
        let animeVintage = song.animeVintage ?? song.vintage ?? song.songInfo?.vintage ?? null;
        let annId = song.annId ?? song.siteIds?.annId ?? song.songInfo?.siteIds?.annId ?? null;
        let malId = song.malId ?? song.linked_ids?.myanimelist ?? song.siteIds?.malId ?? song.songInfo?.siteIds?.malId ?? null;
        let kitsuId = song.kitsuId ?? song.linked_ids?.kitsu ?? song.siteIds?.kitsuId ?? song.songInfo?.siteIds?.kitsuId ?? null;
        let aniListId = song.aniListId ?? song.linked_ids?.anilist ?? song.siteIds?.aniListId ?? song.songInfo?.siteIds?.aniListId ?? null;
        let animeTags = song.animeTags ?? song.tags ?? song.songInfo?.animeTags ?? [];
        let animeGenre = song.animeGenre ?? song.genre ?? song.songInfo?.animeGenre ?? [];
        let rebroadcast = song.rebroadcast ?? song.isRebroadcast ?? song.songInfo?.rebroadcast ?? null;
        let dub = song.dub ?? song.isDub ?? song.songInfo?.dub ?? null;
        let startPoint = song.startPoint ?? song.startSample ?? null;
        let annSongId = song.annSongId ?? null;
        let audio = song.audio ?? song.videoUrl ?? song.urls?.catbox?.[0] ?? song.songInfo?.videoTargetMap?.catbox?.[0] ?? song.songInfo?.urlMap?.catbox?.[0] ?? song.LinkMp3 ?? "";
        let video480 = song.video480 ?? song.MQ ?? song.videoUrl ?? song.urls?.catbox?.[480] ?? song.songInfo?.videoTargetMap?.catbox?.[480] ?? song.songInfo?.urlMap?.catbox?.[480] ?? "";
        let video720 = song.video720 ?? song.HQ ?? song.videoUrl ?? song.urls?.catbox?.[720] ?? song.songInfo?.videoTargetMap?.catbox?.[720] ?? song.songInfo?.urlMap?.catbox?.[720] ?? song.LinkVideo ?? "";
        let correctGuess = song.correctGuess ?? null;
        let incorrectGuess = song.incorrectGuess ?? null;
        if (correctGuess === null && typeof song.correct === "boolean") { //joseph script check
            correctGuess = song.correct;
            incorrectGuess = !song.correct;
        }
        if (typeof animeVintage === "object" && animeVintage?.key && animeVintage?.data?.year) { //amq songinfo vintage is an object
            animeVintage = localizationHandler.translate(animeVintage.key, animeVintage.data);
        }
        if (typeof songType === "string") { //convert songtype string to amq integers
            if (songType.startsWith("O")) {
                songTypeNumber = parseInt(songType.split(" ")[1]) || null;
                songType = 1;
            }
            else if (songType.startsWith("E")) {
                songTypeNumber = parseInt(songType.split(" ")[1]) || null;
                songType = 2;
            }
            else if (songType.startsWith("I")) {
                songTypeNumber = null;
                songType = 3;
            }
        }
        if (audio || video480 || video720) {
            songList.push({
                animeRomajiName,
                animeEnglishName,
                altAnimeNames,
                altAnimeNamesAnswers,
                songArtist,
                //songArtistIds,
                songArranger,
                //songArrangerIds,
                songComposer,
                //songComposerIds,
                songName,
                songType,
                songTypeNumber,
                songDifficulty,
                animeType,
                animeVintage,
                annId,
                malId,
                kitsuId,
                aniListId,
                animeTags,
                animeGenre,
                rebroadcast,
                dub,
                startPoint,
                annSongId,
                audio,
                video480,
                video720,
                correctGuess,
                incorrectGuess
            });
        }
    }
    for (const song of songList) {
        const otherAnswers = new Set();
        for (const s of songList) {
            if (s.songName === song.songName && s.songArtist === song.songArtist) {
                s.altAnimeNames.forEach(x => otherAnswers.add(x));
            }
        }
        song.altAnimeNamesAnswers = Array.from(otherAnswers).filter(x => !song.altAnimeNames.includes(x));
    }
}

// create song list table
function createSongListTable(skipSort) {
    $("#cslgSongListCount").text("Songs: " + songList.length);
    $("#cslgMergeCurrentCount").text(`Current song list: ${songList.length} song${songList.length === 1 ? "" : "s"}`);
    $("#cslgSongListWarning").text("");
    const language = options.useRomajiNames ? "animeRomajiName" : "animeEnglishName";
    const $thead = $("#cslgSongListTable thead").empty();
    const $tbody = $("#cslgSongListTable tbody").empty();
    if (!skipSort) {
        if (songListTableSort.mode === "songName") {
            songList.sort((a, b) => a.songName.localeCompare(b.songName));
        }
        else if (songListTableSort.mode === "artist") {
            songList.sort((a, b) => a.songArtist.localeCompare(b.songArtist));
        }
        else if (songListTableSort.mode === "difficulty") {
            songList.sort((a, b) => a.songDifficulty - b.songDifficulty);
        }
        else if (songListTableSort.mode === "anime") {
            songList.sort((a, b) => a[language].localeCompare(b[language]));
        }
        else if (songListTableSort.mode === "songType") {
            songList.sort((a, b) => songTypeSortValue(a, b));
        }
        else if (songListTableSort.mode === "vintage") {
            songList.sort((a, b) => vintageSortValue(a, b));
        }
        else if (songListTableSort.mode === "mp3") {
            songList.sort((a, b) => a.audio.localeCompare(b.audio));
        }
        else if (songListTableSort.mode === "480") {
            songList.sort((a, b) => a.video480.localeCompare(b.video480));
        }
        else if (songListTableSort.mode === "720") {
            songList.sort((a, b) => a.video720.localeCompare(b.video720));
        }
        if (!songListTableSort.ascending) {
            songList.reverse();
        }
    }
    if (songListTableView === 0) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "song clickAble", text: "Song", "data-sort": "songName" }))
            .append($("<th>", { class: "artist clickAble", text: "Artist", "data-sort": "artist" }))
            .append($("<th>", { class: "difficulty clickAble", text: "Dif", "data-sort": "difficulty" }))
            .append($("<th>", { class: "action" }))
        );
        songList.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "song", text: song.songName }))
                .append($("<td>", { class: "artist", text: song.songArtist }))
                .append($("<td>", { class: "difficulty", text: Number.isFinite(song.songDifficulty) ? Math.floor(song.songDifficulty) : "" }))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
    else if (songListTableView === 1) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "anime clickAble", text: "Anime", "data-sort": "anime" }))
            .append($("<th>", { class: "songType clickAble", text: "Type", "data-sort": "songType" }))
            .append($("<th>", { class: "vintage clickAble", text: "Vintage", "data-sort": "vintage" }))
            .append($("<th>", { class: "action" }))
        );
        songList.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "anime", text: song[language] }))
                .append($("<td>", { class: "songType", text: songTypeText(song.songType, song.songTypeNumber) }))
                .append($("<td>", { class: "vintage", text: song.animeVintage }))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
    else if (songListTableView === 2) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "link clickAble", text: "MP3", "data-sort": "mp3" }))
            .append($("<th>", { class: "link clickAble", text: "480", "data-sort": "480" }))
            .append($("<th>", { class: "link clickAble", text: "720", "data-sort": "720" }))
            .append($("<th>", { class: "action" }))
        );
        songList.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.audio)))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.video480)))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.video720)))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
}

// create merged song list table
function createMergedSongListTable() {
    $("#cslgMergedSongListCount").text("Merged: " + mergedSongList.length);
    $("#cslgMergeTotalCount").text(`Merged song list: ${mergedSongList.length} song${mergedSongList.length === 1 ? "" : "s"}`);
    const $tbody = $("#cslgMergedSongListTable tbody").empty();
    const language = options.useRomajiNames ? "animeRomajiName" : "animeEnglishName";
    mergedSongList.forEach((song, i) => {
        $tbody.append($("<tr>")
            .append($("<td>", { class: "number", text: i + 1 }))
            .append($("<td>", { class: "anime", text: song[language] }))
            .append($("<td>", { class: "songType", text: songTypeText(song.songType, song.songTypeNumber) }))
            .append($("<td>", { class: "action" })
                .append(`<i class="fa fa-chevron-up clickAble" aria-hidden="true"></i>`)
                .append(`<i class="fa fa-chevron-down clickAble" aria-hidden="true"></i>`)
                .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
            )
        );
    });
}

// create answer table
function createAnswerTable() {
    const $tbody = $("#cslgAnswerTable tbody").empty();
    if (songList.length === 0) {
        $("#cslgAnswerText").text("No list loaded");
    }
    else if (animeListLower.size === 0) {
        $("#cslgAnswerText").text("Fetch autocomplete first");
    }
    else {
        const animeList = new Set();
        const missingAnimeList = [];
        for (const song of songList) {
            const answers = [song.animeEnglishName, song.animeRomajiName].concat(song.altAnimeNames, song.altAnimeNamesAnswers);
            answers.forEach(x => animeList.add(x));
        }
        for (const anime of animeList) {
            if (!animeListLower.has(anime.toLowerCase())) {
                missingAnimeList.push(anime);
            }
        }
        missingAnimeList.sort((a, b) => a.localeCompare(b));
        $("#cslgAnswerText").text(`Found ${missingAnimeList.length} anime missing from AMQ's autocomplete`);
        for (const anime of missingAnimeList) {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "oldName", text: anime }))
                .append($("<td>", { class: "newName", text: replacedAnswers[anime] || "" }))
                .append($("<td>", { class: "edit" })
                    .append(`<i class="fa fa-pencil clickAble" aria-hidden="true"></i>`))
            );
        }
    }
}

// create link element for song list table
function createLinkElement(link) {
    if (!link) return "";
    const $a = $("<a>", { target: "_blank" });
    if (link.startsWith("http")) {
        $a.text(link.includes("animemusicquiz") || link.includes("catbox") ? link.split("/").slice(-1)[0] : link);
        $a.attr("href", link);
    }
    else if (/^\w+\.\w{3,4}$/.test(link)) {
        $a.text(link);
        if (fileHostOverride) {
            $a.attr("href", "https://" + hostDict[fileHostOverride] + "/" + link);
        }
        else {
            $a.attr("href", "https://naedist.animemusicquiz.com/" + link);
        }
    }
    return $a;
}

// change sort mode or toggle sort order
function setSongListTableSort(mode) {
    if (mode) {
        if (songListTableSort.mode === mode) {
            songListTableSort.ascending = !songListTableSort.ascending;
        }
        else {
            songListTableSort.mode = mode;
            songListTableSort.ascending = true;
        }
    }
    else {
        songListTableSort.mode = "";
        songListTableSort.ascending = true;
    }
}

// get sorting value for anime vintage
function vintageSortValue(a, b) {
    if (!a.animeVintage && !b.animeVintage) return 0;
    if (!a.animeVintage) return 1;
    if (!b.animeVintage) return -1;
    const [seasonA, yearA] = a.animeVintage.split(" ");
    const [seasonB, yearB] = b.animeVintage.split(" ");
    if (yearA !== yearB) {
        return yearA - yearB;
    }
    const seasonOrder = { "Winter": 1, "Spring": 2, "Summer": 3, "Fall": 4 };
    return seasonOrder[seasonA] - seasonOrder[seasonB];
}

// get sorting value for song type
function songTypeSortValue(a, b) {
    if (a.songType !== b.songType) {
        return a.songType - b.songType;
    }
    if (a.songType !== 3 && b.songType !== 3) {
        return (a.songTypeNumber || 0) - (b.songTypeNumber || 0);
    }
    return 0;
}

// filter the song list
function filterSongList() {
    const keep = $("#cslgFilterModeSelect").val() === "Keep";
    const key = $("#cslgFilterKeySelect").val();
    let text = $("#cslgFilterListInput").val();
    const caseSensitive = $("#cslgFilterListCaseCheckbox").prop("checked");
    const customIncludes = (string, sub) => {
        return caseSensitive ? string.includes(sub) : string.toLowerCase().includes(sub.toLowerCase());
    }
    if (key === "Anime") {
        if (!text) return;
        songList = songList.filter((song) => {
            const match = customIncludes(song.animeRomajiName, text) || customIncludes(song.animeEnglishName, text);
            return keep ? match : !match;
        });
    }
    else if (key === "Artist") {
        if (!text) return;
        songList = songList.filter((song) => {
            const match = customIncludes(song.songArtist, text);
            return keep ? match : !match;
        });
    }
    else if (key === "Song Name") {
        if (!text) return;
        songList = songList.filter((song) => {
            const match = customIncludes(song.songName, text);
            return keep ? match : !match;
        });
    }
    else if (key === "Song Type") {
        text = text.toLowerCase().trim();
        if (!text) return;
        let option;
        const number = parseInt(text.match(/[0-9]+/)?.[0]) || null;
        if (text.startsWith("o")) {
            option = { songType: 1, songTypeNumber: number };
        }
        else if (text.startsWith("e")) {
            option = { songType: 2, songTypeNumber: number };
        }
        else if (text.startsWith("i")) {
            option = { songType: 3, songTypeNumber: null };
        }
        else return;
        songList = songList.filter((song) => {
            const matchesType = song.songType === option.songType;
            const matchesNumber = !option.songTypeNumber || option.songTypeNumber === song.songTypeNumber;
            const match = matchesType && matchesNumber;
            return keep ? match : !match;
        });
    }
    else if (key === "Anime Type") {
        text = text.toLowerCase().trim();
        if (!text) return;
        songList = songList.filter((song) => {
            const match = song.animeType && text === song.animeType.toLowerCase();
            return keep ? match : !match;
        });
    }
    else if (key === "Difficulty") {
        text = text.toLowerCase().trim();
        if (!text) return;
        if (text === "null") {
            songList = songList.filter((song) => {
                const match = song.songDifficulty === null;
                return keep ? match : !match;
            });
        }
        else {
            const [low, high] = text.split(/[\s-]+/).map(Number);
            if (isNaN(low) || isNaN(high) || low > high) return;
            songList = songList.filter((song) => {
                const match = song.songDifficulty && song.songDifficulty >= low && song.songDifficulty <= high;
                return keep ? match : !match;
            });
        }
    }
    else if (key === "Vintage") {
        text = text.toLowerCase().trim();
        if (!text) return;
        if (text === "null") {
            songList = songList.filter((song) => {
                const match = song.animeVintage === null;
                return keep ? match : !match;
            });
        }
        else if (/^[0-9]{4}[\s-]+[0-9]{4}$/.test(text)) {
            const [low, high] = text.split(/[\s-]+/).map(Number);
            if (isNaN(low) || isNaN(high) || low > high) return;
            songList = songList.filter((song) => {
                const year = song.animeVintage ? Number(song.animeVintage.split(" ")[1]) : NaN;
                const match = Number.isInteger(year) && year >= low && year <= high;
                return keep ? match : !match;
            });
        }
        else {
            songList = songList.filter((song) => {
                const match = song.animeVintage && song.animeVintage.toLowerCase().includes(text);
                return keep ? match : !match;
            });
        }
    }
    else if (key === "Rebroadcast") {
        songList = songList.filter((song) => {
            const match = Boolean(song.rebroadcast);
            return keep ? match : !match;
        });
    }
    else if (key === "Dub") {
        songList = songList.filter((song) => {
            const match = Boolean(song.dub);
            return keep ? match : !match;
        });
    }
    else if (key === "Correct") {
        songList = songList.filter((song) => {
            const match = song.correctGuess === true;
            return keep ? match : !match;
        });
    }
    else if (key === "Incorrect") {
        songList = songList.filter((song) => {
            const match = song.incorrectGuess === true;
            return keep ? match : !match;
        });
    }
    createSongListTable(true);
    createAnswerTable();
}

// reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#cslgSettingsModal");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
}

// convert vintage string into AMQ songInfo vintage object
function formatAmqVintage(vintage) {
    if (!vintage) return null;
    if (typeof vintage === "object") return vintage;
    vintage = String(vintage).toLowerCase();
    const regex = /^(winter|spring|summer|fall) ([0-9]+)$/.exec(vintage);
    if (!regex) return null;
    return {
        key: "song_library.anime_entry.vintage." + regex[1],
        data: {
            year: Number(regex[2])
        }
    }
}

// convert full url to target data
function formatTargetUrl(url) {
    if (url && url.startsWith("http")) {
        return url.split("/").slice(-1)[0];
    }
    return url;
}

// translate type and typeNumber ids to shortened type text
function songTypeText(type, typeNumber) {
    if (type === 1) return "OP" + typeNumber;
    if (type === 2) return "ED" + typeNumber;
    if (type === 3) return "IN";
    return "";
};

// input 3 links, return formatted catbox link object
function createCatboxLinkObject(audio, video480, video720) {
    const links = {};
    if (fileHostOverride) {
        if (audio) links["0"] = "https://" + hostDict[fileHostOverride] + "/" + audio.split("/").slice(-1)[0];
        if (video480) links["480"] = "https://" + hostDict[fileHostOverride] + "/" + video480.split("/").slice(-1)[0];
        if (video720) links["720"] = "https://" + hostDict[fileHostOverride] + "/" + video720.split("/").slice(-1)[0];
    }
    else {
        if (audio) links["0"] = audio;
        if (video480) links["480"] = video480;
        if (video720) links["720"] = video720;
    }
    return links;
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
    const $tbody = $("#cslgHotkeyTable tbody");
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

// return true if you are in a ranked lobby or quiz
function isQuizOfTheDay() {
    const types = ["Ranked", "Themed"];
    if (lobby.inLobby) {
        if (types.includes(lobby.settings.gameMode)) {
            return true;
        }
    }
    if (quiz.inQuiz) {
        if (types.includes(quiz.gameMode)) {
            return true;
        }
    }
    return false;
}

// safeguard against people putting valid javascript in the song json
function preventCodeInjection(text) {
    if (/<script/i.test(text)) {
        cslMessage("⚠️ code injection attempt detected, ending quiz");
        quizOver();
        console.warn("CSL CODE INJECTION ATTEMPT:\n" + text);
        return "";
    }
    return text;
}

// split a string into chunks
function splitIntoChunks(str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
}

// convert base 10 number to base 36
function base10to36(number) {
    if (number === 0) return 0;
    const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
    let result = "";
    while (number > 0) {
        let remainder = number % 36;
        result = digits[remainder] + result;
        number = Math.floor(number / 36);
    }
    return result;
}

// convert base 36 number to base 10
function base36to10(number) {
    number = String(number);
    const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
    let result = 0;
    for (let i = 0; i < number.length; i++) {
        const digit = digits.indexOf(number[i]);
        if (digit === -1) return null;
        result = result * 36 + digit;
    }
    return result;
}

// manage data for split messages
class Chunk {
    constructor() {
        this.chunkMap = {};
        this.isComplete = false;
    }
    append(text) {
        const regex = /^§CSL\w(\w)/.exec(text);
        if (regex) {
            const index = base36to10(regex[1]);
            if (text.endsWith("$")) {
                this.chunkMap[index] = text.slice(6, -1);
                this.isComplete = true;
            }
            else {
                this.chunkMap[index] = text.slice(6);
            }
        }
        else {
            console.log("CSL ERROR: bad chunk\n" + text);
        }
    }
    decode() {
        if (this.isComplete) {
            const result = Object.values(this.chunkMap).reduce((a, b) => a + b);
            try {
                return decodeURIComponent(atob(result));
            }
            catch {
                sendSystemMessage("CSL chunk decode error");
                console.log("CSL ERROR: could not decode\n" + result);
            }
        }
        else {
            sendSystemMessage("CSL incomplete chunk");
            console.log("CSL ERROR: incomplete chunk\n", this.chunkMap);
        }
        return "";
    }
}

// input myanimelist username, return list of mal ids
async function getMalIdsFromMyanimelist(username) {
    const malIds = [];
    const statuses = [];
    if ($("#cslgListImportWatchingCheckbox").prop("checked")) {
        statuses.push("watching");
    }
    if ($("#cslgListImportCompletedCheckbox").prop("checked")) {
        statuses.push("completed");
    }
    if ($("#cslgListImportHoldCheckbox").prop("checked")) {
        statuses.push("on_hold");
    }
    if ($("#cslgListImportDroppedCheckbox").prop("checked")) {
        statuses.push("dropped");
    }
    if ($("#cslgListImportPlanningCheckbox").prop("checked")) {
        statuses.push("plan_to_watch");
    }
    for (const status of statuses) {
        $("#cslgListImportText").text(`Retrieving Myanimelist: ${status}`);
        let nextPage = `https://api.myanimelist.net/v2/users/${username}/animelist?offset=0&limit=1000&nsfw=true&status=${status}`;
        while (nextPage) {
            const result = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: nextPage,
                    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-MAL-CLIENT-ID": malClientId },
                    onload: (res) => resolve(JSON.parse(res.response)),
                    onerror: (res) => reject(res)
                });
            });
            if (result.error) {
                nextPage = false;
                $("#cslgListImportText").text(`MAL API Error: ${result.error}`);
            }
            else {
                for (const anime of result.data) {
                    malIds.push(anime.node.id);
                }
                nextPage = result.paging.next;
            }
        }
    }
    return malIds;
}

// input anilist username, return list of mal ids
async function getMalIdsFromAnilist(username) {
    const malIds = [];
    const statuses = [];
    let pageNumber = 1;
    let hasNextPage = true;
    if ($("#cslgListImportWatchingCheckbox").prop("checked")) {
        statuses.push("CURRENT");
    }
    if ($("#cslgListImportCompletedCheckbox").prop("checked")) {
        statuses.push("COMPLETED");
    }
    if ($("#cslgListImportHoldCheckbox").prop("checked")) {
        statuses.push("PAUSED");
    }
    if ($("#cslgListImportDroppedCheckbox").prop("checked")) {
        statuses.push("DROPPED");
    }
    if ($("#cslgListImportPlanningCheckbox").prop("checked")) {
        statuses.push("PLANNING");
    }
    while (hasNextPage) {
        if (pageNumber % 29 === 0) {
            $("#cslgListImportText").text(`Large list: pausing 1 minute to avoid rate limit`);
            await new Promise(r => setTimeout(r, 60000));
        }
        $("#cslgListImportText").text(`Retrieving Anilist: page ${pageNumber}`);
        const data = await getAnilistData(username, statuses, pageNumber);
        if (data) {
            for (const item of data.mediaList) {
                if (item.media.idMal) {
                    malIds.push(item.media.idMal);
                }
            }
            if (data.pageInfo.hasNextPage) {
                pageNumber += 1;
            }
            else {
                hasNextPage = false;
            }
        }
        else {
            $("#cslgListImportText").text("Anilist API Error");
            hasNextPage = false;
        }
    }
    return malIds;
}

// input username, status, and page number
function getAnilistData(username, statuses, pageNumber) {
    const query = `
        query {
            Page (page: ${pageNumber}, perPage: 50) {
                pageInfo {
                    currentPage
                    hasNextPage
                }
                mediaList (userName: "${username}", type: ANIME, status_in: [${statuses}]) {
                    status
                    media {
                        id
                        idMal
                    }
                }
            }
        }
    `;
    const data = {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: query })
    }
    return fetch("https://graphql.anilist.co", data)
        .then(res => res.json())
        .then(json => json?.data?.Page)
        .catch(error => console.log(error));
}

// convert list of mal ids to anisongdb song list
async function getSongListFromMalIds(malIds) {
    importedSongList = [];
    if (!malIds) malIds = [];
    if (malIds.length === 0) return;
    $("#cslgListImportText").text(`Anime: 0 / ${malIds.length} | Songs: ${importedSongList.length}`);
    const url = apiBase + "mal_ids_request";
    let idsProcessed = 0;
    for (let i = 0; i < malIds.length; i += 500) {
        const segment = malIds.slice(i, i + 500);
        idsProcessed += segment.length;
        const data = {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ "mal_ids": segment })
        };
        await fetch(url, data)
            .then(res => res.json())
            .then(json => {
                if (Array.isArray(json)) {
                    importedSongList = importedSongList.concat(json);
                    $("#cslgListImportText").text(`Anime: ${idsProcessed} / ${malIds.length} | Songs: ${importedSongList.length}`);
                }
                else {
                    importedSongList = [];
                    $("#cslgListImportText").text("anisongdb error");
                    console.log(json);
                    throw new Error("did not receive an array from anisongdb");
                }
            })
            .catch(res => {
                importedSongList = [];
                $("#cslgListImportText").text("anisongdb error");
                console.log(res);
            });
    }
}

// start list import process
async function startImport() {
    if (importRunning) return;
    importRunning = true;
    $("#cslgListImportStartButton").addClass("disabled");
    $("#cslgListImportActionContainer").hide();
    const val = $("#cslgListImportSelect").val();
    if (val === "myanimelist") {
        if (malClientId) {
            const username = $("#cslgListImportUsernameInput").val().trim();
            if (username) {
                const malIds = await getMalIdsFromMyanimelist(username);
                await getSongListFromMalIds(malIds);
            }
            else {
                $("#cslgListImportText").text("Input Myanimelist Username");
            }
        }
        else {
            $("#cslgListImportText").text("Missing MAL Client ID");
        }
    }
    else if (val === "anilist") {
        const username = $("#cslgListImportUsernameInput").val().trim();
        if (username) {
            const malIds = await getMalIdsFromAnilist(username);
            await getSongListFromMalIds(malIds);
        }
        else {
            $("#cslgListImportText").text("Input Anilist Username");
        }
    }
    if (importedSongList.length) $("#cslgListImportActionContainer").show();
    $("#cslgListImportStartButton").removeClass("disabled");
    importRunning = false;
}

// input list and file name, download json file
function downloadListJson(list, fileName) {
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list));
    const element = document.createElement("a");
    element.setAttribute("href", data);
    element.setAttribute("download", fileName);
    document.body.appendChild(element);
    element.click();
    element.remove();
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
    localStorage.setItem("customSongListGame", JSON.stringify({
        replacedAnswers,
        CSLButtonCSS,
        debug,
        hotKeys,
        malClientId
    }));
}

// apply styles
function applyStyles() {
    const tableHighlightColor = getComputedStyle(document.documentElement).getPropertyValue("--accentColorContrast") || "#4497ea";
    let css = /*css*/ `
        #lnCustomSongListButton {
            right: ${CSLButtonCSS};
            width: 80px;
        }
        #cslgSongListContainer input[type="radio"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #cslgAnisongdbSearchRow input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #cslgFilterListRow input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #cslgSongListTopRow i.fa:hover {
            opacity: .7;
        }
        #cslgSongListTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgSongListTable thead tr {
            font-weight: bold;
        }
        #cslgSongListTable .number {
            width: 30px;
        }
        #cslgSongListTable .difficulty {
            width: 30px;
        }
        #cslgSongListTable .songType {
            width: 45px;
        }
        #cslgSongListTable .vintage {
            width: 100px;
        }
        #cslgSongListTable .action {
            width: 35px;
        }
        #cslgSongListTable .action i.fa-trash {
            margin-left: 4px;
        }
        #cslgSongListTable .action i.fa-plus:hover {
            color: #5cb85c;
        }
        #cslgSongListTable .action i.fa-trash:hover {
            color: #d9534f;
        }
        #cslgSongListTable th, #cslgSongListTable td {
            padding: 0 4px;
        }
        #cslgSongListTable tr.selected td:not(.action) {
            color: ${tableHighlightColor};
        }
        #cslgMergedSongListTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgMergedSongListTable thead tr {
            font-weight: bold;
        }
        #cslgMergedSongListTable .number {
            width: 30px;
        }
        #cslgMergedSongListTable .songType {
            width: 45px;
        }
        #cslgMergedSongListTable .action {
            width: 55px;
        }
        #cslgMergedSongListTable .action i.fa-trash {
            margin-left: 4px;
        }
        #cslgMergedSongListTable .action i.fa-chevron-up:hover, #cslgMergedSongListTable .action i.fa-chevron-down:hover {
            color: #f0ad4e;
        }
        #cslgMergedSongListTable .action i.fa-trash:hover {
            color: #d9534f;
        }
        #cslgMergedSongListTable th, #cslgMergedSongListTable td {
            padding: 0 4px;
        }
        #cslgMergedSongListTable tr.selected td:not(.action) {
            color: ${tableHighlightColor};
        }
        #cslgQuizSettingsContainer input[type="text"] {
            color: black;
            font-weight: normal;
            margin-left: 3px;
        }
        #cslgQuizSettingsContainer input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #cslgQuizSettingsContainer input[type="radio"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #cslgAnswerTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgAnswerTable thead tr {
            font-weight: bold;
        }
        #cslgAnswerTable .edit {
            width: 20px;
        }
        #cslgAnswerTable tbody i.fa-pencil:hover {
            opacity: .8;
        }
        #cslgAnswerTable th, #cslgAnswerTable td {
            padding: 0 4px;
        }
        #cslgHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #cslgHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #cslgHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
        }
        table.styledTable thead tr {
            background-color: #282828;
        }
        table.styledTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        table.styledTable tbody tr:nth-child(even) {
            background-color: #353535;
        }
        #cslgListImportContainer input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
    `;
    let style = document.getElementById("customSongListGameStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "customSongListGameStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
