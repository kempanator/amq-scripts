// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.45
// @description  Play a solo game with a custom song list
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
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
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.45";
const saveData = validateLocalStorage("customSongListGame");
const catboxHostDict = {1: "files.catbox.moe", 2: "nl.catbox.moe", 3: "nl.catbox.video", 4: "ladist1.catbox.video", 5: "vhdist1.catbox.video"};
let CSLButtonCSS = saveData.CSLButtonCSS || "calc(25% - 250px)";
let showCSLMessages = saveData.showCSLMessages ?? true;
let replacedAnswers = saveData.replacedAnswers || {};
let debug = Boolean(saveData.debug);
let fastSkip = false;
let nextVideoReady = false;
let showSelection = 1;
let guessTime = 20;
let extraGuessTime = 0;
let currentSong = 0;
let totalSongs = 0;
let currentAnswers = {};
let score = {};
let songListTableMode = 0; //0: song + artist, 1: anime + song type + vintage, 2: catbox links
let songListTableSort = [0, 0, 0, 0, 0, 0, 0, 0, 0] //song, artist, difficulty, anime, type, vintage, mp3, 480, 720 (0: off, 1: ascending, 2: descending)
let songList = [];
let songOrder = {}; //{song#: index#, ...}
let mergedSongList = [];
let songOrderType = "random";
let startPointRange = [0, 100];
let difficultyRange = [0, 100];
let previousSongFinished = false;
let skipInterval;
let nextVideoReadyInterval;
let answerTimer;
let extraGuessTimer;
let endGuessTimer;
let fileHostOverride = "0";
let autocomplete = []; //store lowercase version for faster compare speed
let autocompleteInput;
let cslMultiplayer = {host: "", songInfo: {}, voteSkip: {}};
let cslState = 0; //0: none, 1: guessing phase, 2: answer phase
let songLinkReceived = {};
let skipping = false;

$("#gameContainer").append($(`
    <div class="modal fade tab-modal" id="cslgSettingsModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
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
                        <div id="cslgAnswerTab" class="tab clickAble">
                            <h5>Answers</h5>
                        </div>
                        <div id="cslgMergeTab" class="tab clickAble">
                            <h5>Merge</h5>
                        </div>
                        <div id="cslgMultiplayerTab" class="tab clickAble">
                            <h5>Multiplayer</h5>
                        </div>
                        <div id="cslgInfoTab" class="tab clickAble" style="width: 45px; margin-right: -10px; padding-right: 8px; float: right;">
                            <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                        </div>
                    </div>
                </div>
                <div class="modal-body" style="overflow-y: auto; max-height: calc(100vh - 150px);">
                    <div id="cslgSongListContainer">
                        <div>
                            <span style="font-size: 20px; font-weight: bold;">Mode</span>
                            <label class="clickAble" style="margin-left: 10px">Anisongdb<input id="cslgModeAnisongdbRadio" type="radio" name="cslgSongListMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Load File<input id="cslgModeFileUploadRadio" type="radio" name="cslgSongListMode"></label>
                            <i id="cslgTableModeButton" class="fa fa-table clickAble" aria-hidden="true" style="font-size: 20px; margin-left: 80px;"></i>
                            <span id="cslgSongListCount" style="font-size: 20px; font-weight: bold; margin-left: 20px;">Total Songs: 0</span>
                        </div>
                        <div id="cslgFileUploadRow">
                            <label style="vertical-align: -4px"><input id="cslgFileUpload" type="file" style="width: 500px"></label>
                        </div>
                        <div id="cslgAnisongdbSearchRow">
                            <div>
                                <select id="cslgAnisongdbModeSelect" style="color: black; padding: 3px 0;">
                                    <option value="Anime">Anime</option>
                                    <option value="Artist">Artist</option>
                                    <option value="Song">Song</option>
                                    <option value="Composer">Composer</option>
                                </select>
                                <input id="cslgAnisongdbQueryInput" type="text" style="color: black; width: 185px;">
                                <button id="cslgAnisongdbSearchButtonGo" style="color: black">Go</button>
                                <label class="clickAble" style="margin-left: 7px">Partial<input id="cslgAnisongdbPartialCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">OP<input id="cslgAnisongdbOPCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">ED<input id="cslgAnisongdbEDCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">IN<input id="cslgAnisongdbINCheckbox" type="checkbox"></label>
                            </div>
                            <div>
                                <label class="clickAble">Max Other People<input id="cslgAnisongdbMaxOtherPeopleInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                <label class="clickAble" style="margin-left: 10px">Min Group Members<input id="cslgAnisongdbMinGroupMembersInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                <label class="clickAble" style="margin-left: 20px">Ignore Duplicates<input id="cslgAnisongdbIgnoreDuplicatesCheckbox" type="checkbox"></label>
                            </div>
                        </div>
                        <div style="height: 400px; margin: 5px 0; overflow-y: scroll;">
                            <table id="cslgSongListTable">
                                <thead>
                                    <tr>
                                        <th class="number">#</th>
                                        <th class="song">Song</th>
                                        <th class="artist">Artist</th>
                                        <th class="difficulty">Dif</th>
                                        <th class="trash"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                            <div id="cslgSongListWarning"></div>
                        </div>
                    </div>
                    <div id="cslgQuizSettingsContainer" style="margin-top: 10px">
                        <div>
                            <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 0;">Songs:</span><input id="cslgSettingsSongs" type="text" style="width: 40px">
                            <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Guess Time:</span><input id="cslgSettingsGuessTime" type="text" style="width: 40px">
                            <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Extra Time:</span><input id="cslgSettingsExtraGuessTime" type="text" style="width: 40px">
                        </div>
                        <div style="margin-top: 5px">
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Song Types:</span>
                            <label class="clickAble">OP<input id="cslgSettingsOPCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">ED<input id="cslgSettingsEDCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">IN<input id="cslgSettingsINCheckbox" type="checkbox"></label>
                            <span style="font-size: 18px; font-weight: bold; margin: 0 15px 0 35px;">Guess:</span>
                            <label class="clickAble">Correct<input id="cslgSettingsCorrectGuessCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Wrong<input id="cslgSettingsIncorrectGuessCheckbox" type="checkbox"></label>
                        </div>
                        <div style="margin-top: 5px">
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Anime Types:</span>
                            <label class="clickAble">TV<input id="cslgSettingsTVCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Movie<input id="cslgSettingsMovieCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">OVA<input id="cslgSettingsOVACheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">ONA<input id="cslgSettingsONACheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Special<input id="cslgSettingsSpecialCheckbox" type="checkbox"></label>
                        </div>
                        <div style="margin-top: 5px">
                            <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 0;">Sample:</span>
                            <input id="cslgSettingsStartPoint" type="text" style="width: 70px">
                            <span style="font-size: 18px; font-weight: bold; margin: 0 10px 0 40px;">Difficulty:</span>
                            <input id="cslgSettingsDifficulty" type="text" style="width: 70px">
                            <label class="clickAble" style="margin-left: 50px">Fast Skip<input id="cslgSettingsFastSkip" type="checkbox"></label>
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
                                <option value="1">files.catbox.moe</option>
                                <option value="2">nl.catbox.moe</option>
                                <option value="3">nl.catbox.video</option>
                                <option value="4">ladist1.catbox.video</option>
                                <option value="5">vhdist1.catbox.video</option>
                                
                            </select>
                        </div>
                        <p style="margin-top: 20px">Normal room settings are ignored. Only these settings will apply.</p>
                    </div>
                    <div id="cslgAnswerContainer">
                        <span style="font-size: 16px; font-weight: bold;">Old:</span>
                        <input id="cslgOldAnswerInput" type="text" style="width: 200px; color: black; margin: 10px 0;">
                        <span style="font-size: 16px; font-weight: bold; margin-left: 10px;">New:</span>
                        <input id="cslgNewAnswerInput" type="text" style="width: 200px; color: black; margin: 10px 0;">
                        <button id="cslgAnswerButtonAdd" style="color: black; margin-left: 10px;">Add</button>
                        <div id="cslgAnswerText" style="font-size: 16px; font-weight: bold;">No list loaded</div>
                        <div style="height: 300px; margin: 5px 0; overflow-y: scroll;">
                            <table id="cslgAnswerTable">
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
                    <div id="cslgMergeContainer">
                        <h4 style="text-align: center; margin-bottom: 20px;">Merge multiple song lists into 1 JSON file</h4>
                        <div id="cslgMergeCurrentCount" style="font-size: 16px; font-weight: bold; margin-bottom: 15px;">Found 0 songs in the current song list</div>
                        <span id="cslgMergeTotalCount" style="font-size: 16px; font-weight: bold;">Merged JSON file: 0 songs</span>
                        <span style="float: right">
                            <button id="cslgMergeButton" class="btn btn-default">Merge</button>
                            <button id="cslgMergeClearButton" class="btn btn-warning">Clear</button>
                            <button id="cslgMergeDownloadButton" class="btn btn-success">Download</button>
                        </span>
                        <p style="margin-top: 30px">1. Load some songs into the table in the song list tab<br>2. Come back to this tab<br>3. Click "merge" to add everything from that list to a new combined list<br>4. Repeat steps 1-3 as many times as you want<br>5. Click "download" to download the new json file<br>6. Upload the file in the song list tab and play</p>
                    </div>
                    <div id="cslgMultiplayerContainer" style="text-align: center; margin: 10px 0;">
                        <div style="font-size: 20px; margin: 20px 0;">WORK IN PROGRESS</div>
                        <div style="margin-top: 15px"><span style="font-size: 16px; margin-right: 10px; vertical-align: middle;">Show CSL Messages</span><div class="customCheckbox" style="vertical-align: middle"><input type="checkbox" id="cslgShowCSLMessagesCheckbox"><label for="cslgShowCSLMessagesCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div></div>
                        <h4 style="margin-top: 20px;">Prompt All Players</h4>
                        <div style="margin: 10px 0"><button id="cslgPromptAllAutocompleteButton" style="color: black; margin-right: 10px;">Autocomplete</button><button id="cslgPromptAllVersionButton" style="color: black;">Version</button></div>
                    </div>
                    <div id="cslgInfoContainer" style="text-align: center; margin: 10px 0;">
                        <h4>Script Info</h4>
                        <div>Created by: kempanator</div>
                        <div>Version: ${version}</div>
                        <div><a href="https://github.com/kempanator/amq-scripts/blob/main/amqCustomSongListGame.user.js" target="blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js" target="blank">Install</a></div>
                        <h4 style="margin-top: 20px;">Custom CSS</h4>
                        <div><span style="font-size: 15px; margin-right: 17px;">#lnCustomSongListButton </span>right: <input id="cslgCSLButtonCSSInput" type="text" style="width: 150px; color: black;"></div>
                        <div style="margin: 10px 0"><button id="cslgResetCSSButton" style="color: black; margin-right: 10px;">Reset</button><button id="cslgApplyCSSButton" style="color: black;">Save</button></div>
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

$("#lobbyPage .topMenuBar").append(`<div id="lnCustomSongListButton" class="clickAble topMenuButton topMenuMediumButton"><h3>CSL</h3></div>`);
$("#lnCustomSongListButton").click(() => { openSettingsModal() });
$("#cslgSongListTab").click(() => {
    tabReset();
    $("#cslgSongListTab").addClass("selected");
    $("#cslgSongListContainer").show();
});
$("#cslgQuizSettingsTab").click(() => {
    tabReset();
    $("#cslgQuizSettingsTab").addClass("selected");
    $("#cslgQuizSettingsContainer").show();
});
$("#cslgAnswerTab").click(() => {
    tabReset();
    $("#cslgAnswerTab").addClass("selected");
    $("#cslgAnswerContainer").show();
});
$("#cslgMergeTab").click(() => {
    tabReset();
    $("#cslgMergeTab").addClass("selected");
    $("#cslgMergeContainer").show();
});
$("#cslgMultiplayerTab").click(() => {
    tabReset();
    $("#cslgMultiplayerTab").addClass("selected");
    $("#cslgMultiplayerContainer").show();
});
$("#cslgInfoTab").click(() => {
    tabReset();
    $("#cslgInfoTab").addClass("selected");
    $("#cslgInfoContainer").show();
});
$("#cslgAnisongdbSearchButtonGo").click(() => { anisongdbDataSearch() });
$("#cslgAnisongdbQueryInput").keypress((event) => { if (event.which === 13) anisongdbDataSearch() });
$("#cslgFileUpload").on("change", function() {
    if (this.files.length) {
        this.files[0].text().then((data) => {
            try {
                handleData(JSON.parse(data));
            }
            catch {
                songList = [];
                messageDisplayer.displayMessage("Upload Error");
            }
            setSongListTableSort();
            createSongListTable();
            createAnswerTable();
        });
    }
});
$("#cslgSongOrderSelect").on("change", function() {
    songOrderType = this.value;
});
$("#cslgHostOverrideSelect").on("change", function() {
    fileHostOverride = this.value;
});
$("#cslgMergeButton").click(() => {
    mergedSongList = Array.from(new Set(mergedSongList.concat(songList).map((x) => JSON.stringify(x)))).map((x) => JSON.parse(x));
    $("#cslgMergeTotalCount").text(`Merged JSON file: ${mergedSongList.length} song${mergedSongList.length === 1 ? "" : "s"}`);
});
$("#cslgMergeClearButton").click(() => {
    mergedSongList = [];
    $("#cslgMergeTotalCount").text("Merged JSON file: 0 songs");
});
$("#cslgMergeDownloadButton").click(() => {
    if (mergedSongList.length) {
        let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mergedSongList));
        let element = document.createElement("a");
        element.setAttribute("href", data);
        element.setAttribute("download", "merged.json");
        document.body.appendChild(element);
        element.click();
        element.remove();
    }
    else {
        messageDisplayer.displayMessage("No songs", "add some songs to the merged song list");
    }
});
$("#cslgAutocompleteButton").click(() => {
    if (lobby.soloMode) {
        $("#cslgSettingsModal").modal("hide");
        socket.sendCommand({type: "lobby", command: "start game"});
        let autocompleteListener = new Listener("get all song names", () => {
            autocompleteListener.unbindListener();
            viewChanger.changeView("main");
            setTimeout(() => {
                hostModal.displayHostSolo();
            }, 200);
            setTimeout(() => {
                let returnListener = new Listener("Host Game", (payload) => {
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
$("#cslgStartButton").click(() => {
    songOrder = {};
    if (!lobby.isHost) {
        return messageDisplayer.displayMessage("Unable to start", "must be host");
    }
    if (lobby.numberOfPlayers !== lobby.numberOfPlayersReady) {
        return messageDisplayer.displayMessage("Unable to start", "all players must be ready");
    }
    if (!songList || !songList.length) {
        return messageDisplayer.displayMessage("Unable to start", "no songs");
    }
    if (autocomplete.length === 0) {
        return messageDisplayer.displayMessage("Unable to start", "autocomplete list empty");
    }
    let numSongs = parseInt($("#cslgSettingsSongs").val());
    if (isNaN(numSongs) || numSongs < 1) {
        return messageDisplayer.displayMessage("Unable to start", "invalid number of songs");
    }
    guessTime = parseInt($("#cslgSettingsGuessTime").val());
    if (isNaN(guessTime) || guessTime < 1 || guessTime > 99) {
        return messageDisplayer.displayMessage("Unable to start", "invalid guess time");
    }
    extraGuessTime = parseInt($("#cslgSettingsExtraGuessTime").val());
    if (isNaN(extraGuessTime) || extraGuessTime < 0 || extraGuessTime > 15) {
        return messageDisplayer.displayMessage("Unable to start", "invalid extra guess time");
    }
    let startPointText = $("#cslgSettingsStartPoint").val().trim();
    if (/^[0-9]+$/.test(startPointText)) {
        startPointRange = [parseInt(startPointText), parseInt(startPointText)];
    }
    else if (/^[0-9]+[\s-]+[0-9]+$/.test(startPointText)) {
        startPointRange = [parseInt(/^([0-9]+)[\s-]+[0-9]+$/.exec(startPointText)[1]), parseInt(/^[0-9]+[\s-]+([0-9]+)$/.exec(startPointText)[1])];
    }
    else {
        return messageDisplayer.displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    if (startPointRange[0] < 0 || startPointRange[0] > 100 || startPointRange[1] < 0 || startPointRange[1] > 100 || startPointRange[0] > startPointRange[1]) {
        return messageDisplayer.displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    let difficultyText = $("#cslgSettingsDifficulty").val().trim();
    if (/^[0-9]+[\s-]+[0-9]+$/.test(difficultyText)) {
        difficultyRange = [parseInt(/^([0-9]+)[\s-]+[0-9]+$/.exec(difficultyText)[1]), parseInt(/^[0-9]+[\s-]+([0-9]+)$/.exec(difficultyText)[1])];
    }
    else {
        return messageDisplayer.displayMessage("Unable to start", "difficulty must be a range 0-100");
    }
    if (difficultyRange[0] < 0 || difficultyRange[0] > 100 || difficultyRange[1] < 0 || difficultyRange[1] > 100 || difficultyRange[0] > difficultyRange[1]) {
        return messageDisplayer.displayMessage("Unable to start", "difficulty must be a range 0-100");
    }
    let ops = $("#cslgSettingsOPCheckbox").prop("checked");
    let eds = $("#cslgSettingsEDCheckbox").prop("checked");
    let ins = $("#cslgSettingsINCheckbox").prop("checked");
    let tv = $("#cslgSettingsTVCheckbox").prop("checked");
    let movie = $("#cslgSettingsMovieCheckbox").prop("checked");
    let ova = $("#cslgSettingsOVACheckbox").prop("checked");
    let ona = $("#cslgSettingsONACheckbox").prop("checked");
    let special = $("#cslgSettingsSpecialCheckbox").prop("checked");
    let correctGuesses = $("#cslgSettingsCorrectGuessCheckbox").prop("checked");
    let incorrectGuesses = $("#cslgSettingsIncorrectGuessCheckbox").prop("checked");
    let songKeys = Object.keys(songList)
        .filter((key) => songTypeFilter(songList[key], ops, eds, ins))
        .filter((key) => animeTypeFilter(songList[key], tv, movie, ova, ona, special))
        .filter((key) => difficultyFilter(songList[key], difficultyRange[0], difficultyRange[1]))
        .filter((key) => guessTypeFilter(songList[key], correctGuesses, incorrectGuesses));
    if (songOrderType === "random") shuffleArray(songKeys);
    else if (songOrderType === "descending") songKeys.reverse();
    songKeys.slice(0, numSongs).forEach((key, i) => { songOrder[i + 1] = parseInt(key) });
    totalSongs = Object.keys(songOrder).length;
    if (totalSongs === 0) {
        return messageDisplayer.displayMessage("Unable to start", "no songs");
    }
    fastSkip = $("#cslgSettingsFastSkip").prop("checked");
    $("#cslgSettingsModal").modal("hide");
    //console.log(songOrder);
    if (lobby.soloMode) {
        startQuiz();
    }
    else if (lobby.isHost) {
        cslMessage("§CSL0" + btoa(encodeURI(`${showSelection}-${currentSong}-${totalSongs}-${guessTime}-${extraGuessTime}-${fastSkip ? "1" : "0"}`)));
    }
});
$("#cslgSongListTable").on("click", "i.fa-trash", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    songList.splice(index, 1);
    createSongListTable();
    createAnswerTable();
});
$("#cslgAnswerButtonAdd").click(() => {
    let oldName = $("#cslgOldAnswerInput").val().trim();
    let newName = $("#cslgNewAnswerInput").val().trim();
    if (oldName) {
        newName ? replacedAnswers[oldName] = newName : delete replacedAnswers[oldName];
        saveSettings();
        createAnswerTable();
    }
    //console.log(replacedAnswers);
});
$("#cslgAnswerTable").on("click", "i.fa-pencil", (event) => {
    let oldName = event.target.parentElement.parentElement.querySelector("td.oldName").innerText;
    let newName = event.target.parentElement.parentElement.querySelector("td.newName").innerText;
    $("#cslgOldAnswerInput").val(oldName);
    $("#cslgNewAnswerInput").val(newName);
});
$("#cslgModeAnisongdbRadio").prop("checked", true);
$("#cslgAnisongdbModeSelect").val("Artist");
$("#cslgAnisongdbPartialCheckbox").prop("checked", true);
$("#cslgAnisongdbOPCheckbox").prop("checked", true);
$("#cslgAnisongdbEDCheckbox").prop("checked", true);
$("#cslgAnisongdbINCheckbox").prop("checked", true);
$("#cslgAnisongdbMaxOtherPeopleInput").val("99");
$("#cslgAnisongdbMinGroupMembersInput").val("0");
$("#cslgSettingsSongs").val("20");
$("#cslgSettingsGuessTime").val("20");
$("#cslgSettingsExtraGuessTime").val("0");
$("#cslgSettingsOPCheckbox").prop("checked", true);
$("#cslgSettingsEDCheckbox").prop("checked", true);
$("#cslgSettingsINCheckbox").prop("checked", true);
$("#cslgSettingsCorrectGuessCheckbox").prop("checked", true);
$("#cslgSettingsIncorrectGuessCheckbox").prop("checked", true);
$("#cslgSettingsTVCheckbox").prop("checked", true);
$("#cslgSettingsMovieCheckbox").prop("checked", true);
$("#cslgSettingsOVACheckbox").prop("checked", true);
$("#cslgSettingsONACheckbox").prop("checked", true);
$("#cslgSettingsSpecialCheckbox").prop("checked", true);
$("#cslgSettingsStartPoint").val("0-100");
$("#cslgSettingsDifficulty").val("0-100");
$("#cslgSettingsFastSkip").prop("checked", false);
$("#cslgFileUploadRow").hide();
$("#cslgModeAnisongdbRadio").click(() => {
    songList = [];
    $("#cslgFileUploadRow").hide();
    $("#cslgAnisongdbSearchRow").show();
    $("#cslgSongListCount").text("Total Songs: 0");
    $("#cslgFileUploadRow input").val("");
    $("#cslgSongListTable tbody").empty();
    $("#cslgMergeCurrentCount").text("Found 0 songs in the current song list");
});
$("#cslgModeFileUploadRadio").click(() => {
    songList = [];
    $("#cslgAnisongdbSearchRow").hide();
    $("#cslgFileUploadRow").show();
    $("#cslgSongListCount").text("Total Songs: 0");
    $("#cslgAnisongdbQueryInput").val("");
    $("#cslgSongListTable tbody").empty();
    $("#cslgMergeCurrentCount").text("Found 0 songs in the current song list");
});
$("#cslgTableModeButton").click(() => {
    songListTableMode = (songListTableMode + 1) % 3;
    createSongListTable();
});
$("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
$("#cslgResetCSSButton").click(() => {
    CSLButtonCSS = "calc(25% - 250px)";
    $("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
});
$("#cslgApplyCSSButton").click(() => {
    let val = $("#cslgCSLButtonCSSInput").val();
    if (val) {
        CSLButtonCSS = val;
        saveSettings();
        applyStyles();
    }
    else {
        messageDisplayer.displayMessage("Error");
    }
});
$("#cslgShowCSLMessagesCheckbox").prop("checked", showCSLMessages).click(() => {
    showCSLMessages = !showCSLMessages;
});
$("#cslgPromptAllAutocompleteButton").click(() => {
    cslMessage("§CSL21");
});
$("#cslgPromptAllVersionButton").click(() => {
    cslMessage("§CSL22");
});
tabReset();
$("#cslgSongListTab").addClass("selected");
$("#cslgSongListContainer").show();

// setup
function setup() {
    new Listener("New Player", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            let player = Object.values(quiz.players).find((p) => p._name === payload.name);
            if (player) {
                sendSystemMessage(`CSL: reconnecting ${payload.name}`);
                cslMessage("§CSL0" + btoa(encodeURI(`${showSelection}-${currentSong}-${totalSongs}-${guessTime}-${extraGuessTime}-${fastSkip ? "1" : "0"}`)));
            }
            else {
                cslMessage(`CSL game in progress, removing ${payload.name}`);
                lobby.changeToSpectator(payload.name);
            }
        }
    }).bindListener();
    new Listener("New Spectator", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            let player = Object.values(quiz.players).find((p) => p._name === payload.name);
            if (player) {
                sendSystemMessage(`CSL: reconnecting ${payload.name}`);
                cslMessage("§CSL20" + btoa(payload.name));
            }
            setTimeout(() => {
                cslMessage("§CSL3" + btoa(`${currentSong}-${getStartPoint()}-${songList[songOrder[currentSong]].audio || ""}-${/*nextSong.video480 || */""}-${/*nextSong.video720 || */""}`));
            }, 300);
        }
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            let player = Object.values(quiz.players).find((p) => p._name === payload.name);
            if (player) {
                cslMessage("§CSL0" + btoa(encodeURI(`${showSelection}-${currentSong}-${totalSongs}-${guessTime}-${extraGuessTime}-${fastSkip ? "1" : "0"}`)));
            }
            else {
                cslMessage(`CSL game in progress, removing ${payload.name}`);
                lobby.changeToSpectator(payload.name);
            }
        }
    }).bindListener();
    new Listener("Player Change To Spectator", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            let player = Object.values(quiz.players).find((p) => p._name === payload.name);
            if (player) {
                cslMessage("§CSL20" + btoa(payload.name));
            }
        }
    }).bindListener();
    new Listener("Host Promotion", (payload) => {
        if (quiz.cslActive && quiz.inQuiz) {
            sendSystemMessage("CSL host changed, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("Player Left", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && payload.player.name === cslMultiplayer.host) {
            sendSystemMessage("CSL host left, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("Spectator Left", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && payload.spectator === cslMultiplayer.host) {
            sendSystemMessage("CSL host left, ending quiz");
            quizOver();
        }
    }).bindListener();
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.message.startsWith("§CSL")) {
                if (!showCSLMessages) {
                    setTimeout(() => {
                        let $message = gameChat.$chatMessageContainer.find(".gcMessage").last();
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
    new Listener("Game Chat Message", (payload) => {
        if (payload.message.startsWith("§CSL")) {
            parseMessage(message.message, message.sender);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        clearTimeEvents();
    }).bindListener();
    new Listener("Join Game", (payload) => {
        reset();
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        reset();
    }).bindListener();
    new Listener("Host Game", (payload) => {
        reset();
        $("#cslgSettingsModal").modal("hide");
    }).bindListener();
    new Listener("get all song names", () => {
        setTimeout(() => {
            let list = quiz.answerInput.typingInput.autoCompleteController.list;
            if (list.length) {
                autocomplete = list.map(x => x.toLowerCase());
                autocompleteInput = new AmqAwesomeplete(document.querySelector("#cslgNewAnswerInput"), {list: list}, true);
            }
        }, 10);
    }).bindListener();
    new Listener("update all song names", () => {
        setTimeout(() => {
            let list = quiz.answerInput.typingInput.autoCompleteController.list;
            if (list.length) {
                autocomplete = list.map(x => x.toLowerCase());
                autocompleteInput.list = list;
            }
        }, 10);
    }).bindListener();

    quiz.pauseButton.$button.off("click").click(() => {
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
                    cslMessage("§CSL82");
                }
                else {
                    cslMessage("§CSL81");
                }
            }
        }
        else {
            socket.sendCommand({type: "quiz", command: quiz.pauseButton.pauseOn ? "quiz unpause" : "quiz pause"});
        }
    });

    const oldSendSkipVote = quiz.skipController.sendSkipVote;
    quiz.skipController.sendSkipVote = function() {
        if (quiz.cslActive) {
            if (quiz.soloMode) {
                clearTimeout(this.autoVoteTimeout);
            }
            else if (!skipping) {
                cslMessage("§CSL91");
            }
        }
        else {
            oldSendSkipVote.apply(this, arguments);
        }
    }

    const oldLeave = quiz.leave;
    quiz.leave = function() {
        reset();
        oldLeave.apply(this, arguments);
    }

    const oldStartReturnLobbyVote = quiz.startReturnLobbyVote;
    quiz.startReturnLobbyVote = function() {
        if (quiz.cslActive && quiz.inQuiz) {
            if (quiz.soloMode) {
                quizOver();
            }
            else if (quiz.isHost) {
                cslMessage("§CSL1");
            }
        }
        else {
            oldStartReturnLobbyVote.apply(this, arguments);
        }
    }

    const oldSubmitAnswer = QuizTypeAnswerInputController.prototype.submitAnswer;
    QuizTypeAnswerInputController.prototype.submitAnswer = function(answer) {
        if (quiz.cslActive) {
            currentAnswers[quiz.ownGamePlayerId] = answer;
            this.skipController.highlight = true;
            fireListener("quiz answer", {
                "answer": answer,
                "success": true
            });
            if (quiz.soloMode) {
                fireListener("player answered", [0]);
                if (options.autoVoteSkipGuess) {
                    this.skipController.voteSkip();
                    fireListener("quiz overlay message", "Skipping to Answers");
                }
            }
            else {
                cslMessage("§CSL5");
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
    quiz.videoReady = function(songId) {
        if (quiz.cslActive && this.inQuiz) {
            nextVideoReady = true;
        }
        else {
            oldVideoReady.apply(this, arguments);
        }
    }

    const oldHandleError = MoeVideoPlayer.prototype.handleError;
    MoeVideoPlayer.prototype.handleError = function() {
        if (quiz.cslActive) {
            gameChat.systemMessage(`CSL Error: couldn't load song ${currentSong + 1}`);
            nextVideoReady = true;
        }
        else {
            oldHandleError.apply(this, arguments);
        }
	}

    AMQ_addScriptData({
        name: "Custom Song List Game",
        author: "kempanator",
        version: version,
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
    applyStyles();
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
    let date = new Date().toISOString();
    for (let player of Object.values(lobby.players)) {
        score[player.gamePlayerId] = 0;
    }
    //console.log({showSelection, totalSongs, guessTime, extraGuessTime, fastSkip});
    let data = {
        "gameMode": lobby.soloMode ? "Solo" : "Multiplayer",
        "showSelection": showSelection,
        "groupSlotMap": createGroupSlotMap(Object.keys(lobby.players)),
        "players": [],
        "multipleChoice": false,
        "quizDescription": {
            "quizId": "",
            "startTime": date,
            "roomName": hostModal.$roomName.val()
        }
    };
    Object.values(lobby.players).forEach((player, i) => {
        player.pose = 1;
        player.sore = 0;
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
                "startPont": getStartPoint(),
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
                cslMessage("§CSL3" + btoa(`${1}-${getStartPoint()}-${song.audio || ""}-${/*song.video480 || */""}-${/*song.video720 || */""}`));
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
    for (let key of Object.keys(quiz.players)) {
        currentAnswers[key] = "";
        cslMultiplayer.voteSkip[key] = false;
    }
    cslMultiplayer.songInfo = {};
    currentSong = songNumber;
    cslState = 1;
    skipping = false;
    fireListener("play next song", {
        "time": guessTime,
        "extraGuessTime": extraGuessTime,
        "songNumber": songNumber,
        "progressBarState": {"length": guessTime, "played": 0},
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
            cslMessage("§CSL92");
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
                let nextSong = songList[songOrder[songNumber + 1]];
                fireListener("quiz next video info", {
                    "playLength": guessTime,
                    "playbackSpeed": 1,
                    "startPont": getStartPoint(),
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
                    let nextSong = songList[songOrder[songNumber + 1]];
                    cslMessage("§CSL3" + btoa(`${songNumber + 1}-${getStartPoint()}-${nextSong.audio || ""}-${/*nextSong.video480 || */""}-${/*nextSong.video720 || */""}`));
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
    if (!quiz.soloMode && quiz.inQuiz) {
        cslMessage("§CSL6" + btoa(encodeURIComponent(currentAnswers[quiz.ownGamePlayerId])));
    }
    answerTimer = setTimeout(() => {
        if (!quiz.cslActive || !quiz.inQuiz) return reset();
        cslState = 2;
        skipping = false;
        for (let key of Object.keys(quiz.players)) {
            cslMultiplayer.voteSkip[key] = false;
        }
        let data = {
            "answers": [],
            "progressBarState": null
        };
        for (let player of Object.values(quiz.players)) {
            data.answers.push({
                "gamePlayerId": player.gamePlayerId,
                "pose": 3,
                "answer": currentAnswers[player.gamePlayerId] || ""
            });
        }
        fireListener("player answers", data);
        if (!quiz.soloMode && quiz.isHost) {
            cslMessage("§CSLa" + btoa(encodeURI(song.animeRomajiName || "")));
            cslMessage("§CSLb" + btoa(encodeURI(song.animeEnglishName || "")));
            cslMessage("§CSLc" + btoa(encodeURI(song.songArtist || "")));
            cslMessage("§CSLd" + btoa(encodeURI(song.songName || "")));
            cslMessage("§CSLe" + btoa(`${song.songType || ""}-${song.songTypeNumber || ""}-${song.songDifficulty || ""}-${song.animeType || ""}-${song.animeVintage || ""}-${song.annId || ""}-${song.malId || ""}-${song.kitsuId || ""}-${song.aniListId || ""}`));
            cslMessage("§CSLf" + btoa(encodeURI(song.audio || "")));
        }
        answerTimer = setTimeout(() => {
            if (!quiz.cslActive || !quiz.inQuiz) return reset();
            let correct = {};
            let pose = {};
            if (quiz.isHost) {
                for (let player of Object.values(quiz.players)) {
                    let isCorrect = isCorrectAnswer(songNumber, currentAnswers[player.gamePlayerId]);
                    correct[player.gamePlayerId] = isCorrect;
                    pose[player.gamePlayerId] = currentAnswers[player.gamePlayerId] ? (isCorrect ? 5 : 4) : 6;
                    if (isCorrect) score[player.gamePlayerId]++;
                }
            }
            if (quiz.soloMode) {
                let data = {
                    "players": [],
                    "songInfo": {
                        "animeNames": {
                            "english": song.animeEnglishName,
                            "romaji": song.animeRomajiName
                        },
                        "artist": song.songArtist,
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
                        "vintage": song.animeVintage,
                        "animeDifficulty": song.songDifficulty,
                        "animeTags": song.animeTags,
                        "animeGenre": song.animeGenre,
                        "altAnimeNames": song.altAnimeNames,
                        "altAnimeNamesAnswers": song.altAnimeNamesAnswers,
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
                for (let player of Object.values(quiz.players)) {
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
                let list = [];
                for (let id of Object.keys(correct)) {
                    list.push(`${id},${correct[id] ? "1" : "0"},${pose[id]},${score[id]}`);
                }
                cslMessage("§CSL7" + btoa(list.join("-")));
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
    }, fastSkip ? 100: 400);
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
            let data = {
                "resultStates": []
            };
            /*"progressBarState": {
                "length": 26.484,
                "played": 6.484
            }*/
            let sortedScores = Array.from(new Set(Object.values(score))).sort((a, b) => b - a);
            for (let id of Object.keys(score)) {
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
                cslMessage("§CSL1");
            }
        }, fastSkip ? 5000 : 12000);
    }
}

// fire all event listeners (including scripts)
function fireListener(type, data) {
    try {
        for (let listener of socket.listners[type]) {
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
    if (!isRankedMode()) {
        socket.sendCommand({type: "lobby", command: "game chat message", data: {msg: String(text), teamMessage: false}});
    }
}

// send a client side message to game chat
function sendSystemMessage(message) {
    if (gameChat.open) {
        setTimeout(() => { gameChat.systemMessage(String(message)) }, 1);
    }
}

// parse message
function parseMessage(content, sender) {
    if (isRankedMode()) return;
    let player;
    if (lobby.inLobby) player = Object.values(lobby.players).find((x) => x._name === sender);
    else if (quiz.inQuiz) player = Object.values(quiz.players).find((x) => x._name === sender);
    let isHost = sender === cslMultiplayer.host;
    if (content.startsWith("§CSL0")) { //start quiz
        if (lobby.inLobby && sender === lobby.hostName && !quiz.cslActive) {
            let split = decodeURI(atob(content.slice(5))).split("-");
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
    else if (content.startsWith("§CSL1")) { //return to lobby
        if (quiz.cslActive && quiz.inQuiz && (isHost || sender === lobby.hostName)) {
            quizOver();
        }
    }
    else if (content.startsWith("§CSL20")) { //player rejoin
        if (sender === lobby.hostName) {
            let name = atob(content.slice(6));
            if (name === selfName) {
                socket.sendCommand({type: "lobby", command: "change to player"});
            }
            else if (quiz.cslActive && quiz.inQuiz) {
                let player = Object.values(quiz.players).find((p) => p._name === name);
                if (player) {
                    fireListener("Rejoining Player", {"name": name, "gamePlayerId": player.gamePlayerId});
                }
            }
        }
    }
    else if (content === "§CSL21") { //has autocomplete
        cslMessage("has autocomplete:  " + Boolean(autocomplete.length));
    }
    else if (content === "§CSL22") { //version
        cslMessage("CSL version " + version);
    }
    else if (content.startsWith("§CSL3")) { //next song link
        if (quiz.cslActive && isHost) {
            let split = atob(content.slice(5)).split("-");
            //console.log(split);
            if (split.length === 5) {
                if (!songLinkReceived[split[0]]) {
                    songLinkReceived[split[0]] = true;
                    fireListener("quiz next video info", {
                        "playLength": guessTime,
                        "playbackSpeed": 1,
                        "startPont": parseInt(split[1]),
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
                sendSystemMessage(`CSL Multiplayer Error: next song link decode failed`);
            }
        }
    }
    else if (content.startsWith("§CSL4")) { //play song
        if (quiz.cslActive && isHost) {
            let number = parseInt(atob(content.slice(5)));
            //console.log("Play song: " + number);
            if (currentSong !== totalSongs) {
                playSong(number);
            }
        }
    }
    else if (content.startsWith("§CSL5")) { //player submission
        if (quiz.cslActive && player) {
            fireListener("player answered", [player.gamePlayerId]);
        }
    }
    else if (content.startsWith("§CSL6")) { //player final answer
        if (quiz.cslActive && player) {
            currentAnswers[player.gamePlayerId] = decodeURIComponent(atob(content.slice(5)));
        }
    }
    else if (content.startsWith("§CSL7")) { //answer results
        if (quiz.cslActive && isHost) {
            let split = atob(content.slice(5)).split("-");
            //console.log("Answer results: " + atob(content.slice(5)));
            let data = {
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
            let decodedPlayers = [];
            for (p of split) {
                let playerSplit = p.split(",");
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
    else if (content === "§CSL81") { //pause
        if (isHost) {
            fireListener("quiz pause triggered", {
                "playerName": sender
            });
        }
    }
    else if (content === "§CSL82") { //unpause
        if (isHost) {
            fireListener("quiz unpause triggered", {
                "playerName": sender
            });
        }
    }
    else if (content === "§CSL91") { //vote skip
        if (quiz.isHost && player) {
            cslMultiplayer.voteSkip[player.gamePlayerId] = true;
            if (!skipping && checkVoteSkip()) {
                skipping = true;
                if (cslState === 1) {
                    cslMessage("§CSL92");
                }
                else if (cslState === 2) {
                    cslMessage("§CSL93");
                }
            }
        }
    }
    else if (content === "§CSL92") { //skip guessing phase
        if (isHost) {
            fireListener("quiz overlay message", "Skipping to Answers");
            clearInterval(skipInterval);
            clearTimeout(endGuessTimer);
            clearTimeout(extraGuessTimer);
            setTimeout(() => {
                endGuessPhase(currentSong);
            }, fastSkip ? 1000 : 3000);
        }
    }
    else if (content === "§CSL93") { //skip replay phase
        if (isHost) {
            endReplayPhase(currentSong);
        }
    }
    else if (content.startsWith("§CSLa")) { //animeRomajiName
        if (isHost) {
            cslMultiplayer.songInfo.animeRomajiName = decodeURI(atob(content.slice(5)));
        }
    }
    else if (content.startsWith("§CSLb")) { //animeEnglishName
        if (isHost) {
            cslMultiplayer.songInfo.animeEnglishName = decodeURI(atob(content.slice(5)));
        }
    }
    else if (content.startsWith("§CSLc")) { //songArtist
        if (isHost) {
            cslMultiplayer.songInfo.songArtist = decodeURI(atob(content.slice(5)));
        }
    }
    else if (content.startsWith("§CSLd")) { //songName
        if (isHost) {
            cslMultiplayer.songInfo.songName = decodeURI(atob(content.slice(5)));
        }
    }
    else if (content.startsWith("§CSLe")) { //songType songTypeNumber songDifficulty animeType animeVintage
        if (quiz.cslActive && isHost) {
            let split = atob(content.slice(5)).split("-");
            //console.log(split);
            cslMultiplayer.songInfo.songType = parseInt(split[0]) || null;
            cslMultiplayer.songInfo.songTypeNumber = parseInt(split[1]) || null;
            cslMultiplayer.songInfo.songDifficulty = parseFloat(split[2]) || null;
            cslMultiplayer.songInfo.animeType = parseInt(split[3]) || null;
            cslMultiplayer.songInfo.animeVintage = split[4];
            cslMultiplayer.songInfo.annId = parseInt(split[5]) || null;
            cslMultiplayer.songInfo.malId = parseInt(split[6]) || null;
            cslMultiplayer.songInfo.kitsuId = parseInt(split[7]) || null;
            cslMultiplayer.songInfo.aniListId = parseInt(split[8]) || null;
        }
    }
    else if (content.startsWith("§CSLf")) { //audio
        if (isHost) {
            cslMultiplayer.songInfo.audio = decodeURI(atob(content.slice(5)));
        }
    }
}

function checkVoteSkip() {
    let keys = Object.keys(cslMultiplayer.voteSkip).filter((key) => key in quiz.players && !quiz.players[key].avatarDisabled);
    for (let key of keys) {
        if (!cslMultiplayer.voteSkip[key]) return false;
    }
    return true;
}

// input list of player keys, return group slot map
function createGroupSlotMap(players) {
    players = players.map(Number);
    let map = {};
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
    let song = songList[songOrder[songNumber]];
    let correctAnswers = [].concat((song.altAnimeNames || []), (song.altAnimeNamesAnswers || []));
    for (let a1 of correctAnswers) {
        let a2 = replacedAnswers[a1];
        if (a2 && a2.toLowerCase() === answer) return true;
        if (a1.toLowerCase() === answer) return true;
    }
    return false;
}

// get start point value
function getStartPoint() {
    return Math.floor(Math.random() * (startPointRange[1] - startPointRange[0] + 1)) + startPointRange[0];
}

// return true if song type is allowed
function songTypeFilter(song, ops, eds, ins) {
    let type = song.songType;
    if (ops && type === 1) return true;
    if (eds && type === 2) return true;
    if (ins && type === 3) return true;
    return false;
}

// return true if anime type is allowed
function animeTypeFilter(song, tv, movie, ova, ona, special) {
    if (song.animeType) {
        let type = song.animeType.toLowerCase();
        if (tv && type === "tv") return true;
        if (movie && type === "movie") return true;
        if (ova && type === "ova") return true;
        if (ona && type === "ona") return true;
        if (special && type === "special") return true;
        return false;
    }
    else {
        if (tv && movie && ova && ona && special) return true;
        return false;
    }
}

// return true if the song difficulty is in allowed range
function difficultyFilter(song, low, high) {
    if (low === 0 && high === 100) return true;
    let dif = parseFloat(song.songDifficulty);
    if (isNaN(dif)) return false;
    if (dif >= low && dif <= high) return true;
    return false;
}

// return true if guess type is allowed
function guessTypeFilter(song, correctGuesses, incorrectGuesses) {
    if (correctGuesses && song.correctGuess) return true;
    if (incorrectGuesses && song.incorrectGuess) return true;
    return false;
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
    cslMultiplayer = {host: "", songInfo: {}, voteSkip: {}};
    cslState = 0;
    currentSong = 0;
    currentAnswers = {};
    score = {};
    previousSongFinished = false;
    fastSkip = false;
    skipping = false;
    songLinkReceived = {};
}

// end quiz and set up lobby
function quizOver() {
    reset();
    let data = {
        "spectators": [],
        "inLobby": true,
        "settings": hostModal.getSettings(),
        "soloMode": quiz.soloMode,
        "inQueue": [],
        "hostName": lobby.hostName,
        "gameId": lobby.gameId,
        "players": [],
        "numberOfTeams": 0,
        "teamFullMap": {}
    };
    for (let player of Object.values(quiz.players)) {
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
    viewChanger.changeView("lobby", {supressServerMsg: true, keepChatOpen: true});
}

// open custom song list settings modal
function openSettingsModal() {
    if (lobby.inLobby) {
        if (autocomplete.length) {
            $("#cslgAutocompleteButton").removeClass("btn-danger").addClass("btn-success disabled");
        }
        $("#cslgSettingsModal").modal("show");
    }
}

// when you click the go button
function anisongdbDataSearch() {
    let mode = $("#cslgAnisongdbModeSelect").val().toLowerCase();
    let query = $("#cslgAnisongdbQueryInput").val();
    let ops = $("#cslgAnisongdbOPCheckbox").prop("checked");
    let eds = $("#cslgAnisongdbEDCheckbox").prop("checked");
    let ins = $("#cslgAnisongdbINCheckbox").prop("checked");
    let partial = $("#cslgAnisongdbPartialCheckbox").prop("checked");
    let ignoreDuplicates = $("#cslgAnisongdbIgnoreDuplicatesCheckbox").prop("checked");
    let maxOtherPeople = parseInt($("#cslgAnisongdbMaxOtherPeopleInput").val());
    let minGroupMembers = parseInt($("#cslgAnisongdbMinGroupMembersInput").val());
    if (query && !isNaN(maxOtherPeople) && !isNaN(minGroupMembers)) {
        getAnisongdbData(mode, query, ops, eds, ins, partial, ignoreDuplicates, maxOtherPeople, minGroupMembers);
    }
}

// send anisongdb request
function getAnisongdbData(mode, query, ops, eds, ins, partial, ignoreDuplicates, maxOtherPeople, minGroupMembers) {
    $("#cslgSongListCount").text("Loading...");
    $("#cslgSongListTable tbody").empty();
    let json = {
        and_logic: false,
        ignore_duplicate: ignoreDuplicates,
        opening_filter: ops,
        ending_filter: eds,
        insert_filter: ins
    };
    if (mode === "anime") {
        json.anime_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "artist") {
        json.artist_search_filter = {
            search: query,
            partial_match: partial,
            group_granularity: minGroupMembers,
            max_other_artist: maxOtherPeople
        };
    }
    else if (mode === "song") {
        json.song_name_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "composer") {
        json.composer_search_filter = {
            search: query,
            partial_match: partial,
            arrangement: false
        };
    }
    fetch("https://anisongdb.com/api/search_request", {
        method: "POST",
        headers: {"Accept": "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(json)
    }).then(res => res.json()).then(json => {
        handleData(json);
        setSongListTableSort();
        if (songList.length === 0 && (ranked.currentState === ranked.RANKED_STATE_IDS.RUNNING || ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_RUNNING)) {
            $("#cslgSongListCount").text("Total Songs: 0");
            $("#cslgMergeCurrentCount").text("Found 0 songs in the current song list");
            $("#cslgSongListTable tbody").empty();
            $("#cslgSongListWarning").text("AnisongDB is not available during ranked");
        }
        else {
            createSongListTable();
        }
        createAnswerTable();
    }).catch(res => {
        songList = [];
        setSongListTableSort();
        $("#cslgSongListCount").text("Total Songs: 0");
        $("#cslgMergeCurrentCount").text("Found 0 songs in the current song list");
        $("#cslgSongListTable tbody").empty();
        $("#cslgSongListWarning").text(res.toString());
    });
}

function handleData(data) {
    songList = [];
    if (!data) return;
    // anisongdb structure
    if (Array.isArray(data) && data.length && data[0].animeJPName) {
        data = data.filter((song) => song.audio || song.MQ || song.HQ);
        for (let song of data) {
            songList.push({
                animeRomajiName: song.animeJPName,
                animeEnglishName: song.animeENName,
                altAnimeNames: [].concat(song.animeJPName, song.animeENName, song.animeAltName || []),
                altAnimeNamesAnswers: [],
                songArtist: song.songArtist,
                songName: song.songName,
                songType: Object({O: 1, E: 2, I: 3})[song.songType[0]],
                songTypeNumber: song.songType[0] === "I" ? null : parseInt(song.songType.split(" ")[1]),
                songDifficulty: song.songDifficulty,
                animeType: song.animeType,
                animeVintage: song.animeVintage,
                annId: song.annId,
                malId: null,
                kitsuId: null,
                aniListId: null,
                animeTags: [],
                animeGenre: [],
                startPoint: null,
                audio: song.audio,
                video480: song.MQ,
                video720: song.HQ,
                correctGuess: true,
                incorrectGuess: true
            });
        }
        for (let song of songList) {
            let otherAnswers = new Set();
            for (let s of songList) {
                if (s.songName === song.songName && s.songArtist === song.songArtist) {
                    s.altAnimeNames.forEach((x) => otherAnswers.add(x));
                }
            }
            song.altAnimeNamesAnswers = Array.from(otherAnswers).filter((x) => !song.altAnimeNames.includes(x));
        }
    }
    // official amq song export structure
    else if (typeof data === "object" && data.roomName && data.startTime && data.songs) {
        for (let song of data.songs) {
            songList.push({
                animeRomajiName: song.songInfo.animeNames.romaji,
                animeEnglishName: song.songInfo.animeNames.english,
                altAnimeNames: song.songInfo.altAnimeNames || [song.songInfo.animeNames.romaji, song.songInfo.animeNames.english],
                altAnimeNamesAnswers: song.songInfo.altAnimeNamesAnswers || [],
                songArtist: song.songInfo.artist,
                songName: song.songInfo.songName,
                songType: song.songInfo.type,
                songTypeNumber: song.songInfo.typeNumber,
                songDifficulty: song.songInfo.animeDifficulty,
                animeType: song.songInfo.animeType,
                animeVintage: song.songInfo.vintage,
                annId: song.songInfo.siteIds.annId,
                malId: song.songInfo.siteIds.malId,
                kitsuId: song.songInfo.siteIds.kitsuId,
                aniListId: song.songInfo.siteIds.aniListId,
                animeTags: song.songInfo.animeTags,
                animeGenre: song.songInfo.animeGenre,
                startPoint: song.startPoint,
                audio: String(song.videoUrl).endsWith(".mp3") ? song.videoUrl : null,
                video480: null,
                video720: String(song.videoUrl).endsWith(".webm") ? song.videoUrl : null,
                correctGuess: song.correctGuess,
                incorrectGuess: song.wrongGuess
            });
        }
    }
    // joseph song export script structure
    else if (Array.isArray(data) && data.length && data[0].gameMode) {
        for (let song of data) {
            songList.push({
                animeRomajiName: song.anime.romaji,
                animeEnglishName: song.anime.english,
                altAnimeNames: song.altAnswers || [song.anime.romaji, song.anime.english],
                altAnimeNamesAnswers: [],
                songArtist: song.artist,
                songName: song.name,
                songType: Object({O: 1, E: 2, I: 3})[song.type[0]],
                songTypeNumber: song.type[0] === "I" ? null : parseInt(song.type.split(" ")[1]),
                songDifficulty: parseFloat(song.difficulty),
                animeType: song.animeType,
                animeVintage: song.vintage,
                annId: song.siteIds.annId,
                malId: song.siteIds.malId,
                kitsuId: song.siteIds.kitsuId,
                aniListId: song.siteIds.aniListId,
                animeTags: song.tags,
                animeGenre: song.genre,
                startPoint: song.startSample,
                audio: song.urls.catbox?.[0] ?? song.urls.openingsmoe?.[0] ?? null,
                video480: song.urls.catbox?.[480] ?? song.urls.openingsmoe?.[480] ?? null,
                video720: song.urls.catbox?.[720] ?? song.urls.openingsmoe?.[720] ?? null,
                correctGuess: song.correct,
                incorrectGuess: !song.correct
            });
        }
    }
    // blissfulyoshi ranked data export structure
    else if (Array.isArray(data) && data.length && data[0].animeRomaji) {
        for (let song of data) {
            songList.push({
                animeRomajiName: song.animeRomaji,
                animeEnglishName: song.animeEng,
                altAnimeNames: [song.animeRomaji, song.animeEng],
                altAnimeNamesAnswers: [],
                songArtist: song.artist,
                songName: song.songName,
                songType: Object({O: 1, E: 2, I: 3})[song.type[0]],
                songTypeNumber: song.type[0] === "I" ? null : parseInt(song.type.split(" ")[1]),
                songDifficulty: song.songDifficulty,
                animeType: null,
                animeVintage: song.vintage,
                annId: song.annId,
                malId: song.malId,
                kitsuId: song.kitsuId,
                aniListId: song.aniListId,
                animeTags: [],
                animeGenre: [],
                startPoint: null,
                audio: song.LinkMp3,
                video480: null,
                video720: song.LinkVideo,
                correctGuess: true,
                incorrectGuess: true
            });
        }
    }
    // this script structure
    else if (Array.isArray(data) && data.length && data[0].animeRomajiName) {
        songList = data;
    }
    songList = songList.filter((song) => song.audio || song.video480 || song.video720);
}

// create song list table
function createSongListTable() {
    $("#cslgSongListCount").text("Total Songs: " + songList.length);
    $("#cslgMergeCurrentCount").text(`Found ${songList.length} song${songList.length === 1 ? "" : "s"} in the current song list`);
    $("#cslgSongListWarning").text("");
    let $thead = $("#cslgSongListTable thead");
    let $tbody = $("#cslgSongListTable tbody");
    $thead.empty();
    $tbody.empty();
    if (songListTableSort[0] === 1) { //song name ascending
        songList.sort((a, b) => (a.songName || "").localeCompare((b.songName || "")));
    }
    else if (songListTableSort[0] === 2) { //song name descending
        songList.sort((a, b) => (b.songName || "").localeCompare((a.songName || "")));
    }
    else if (songListTableSort[1] === 1) { //artist ascending
        songList.sort((a, b) => (a.songArtist || "").localeCompare((b.songArtist || "")));
    }
    else if (songListTableSort[1] === 2) { //artist descending
        songList.sort((a, b) => (b.songArtist || "").localeCompare((a.songArtist || "")));
    }
    else if (songListTableSort[2] === 1) { //difficulty ascending
        songList.sort((a, b) => a.songDifficulty - b.songDifficulty);
    }
    else if (songListTableSort[2] === 2) { //difficulty descending
        songList.sort((a, b) => b.songDifficulty - a.songDifficulty);
    }
    else if (songListTableSort[3] === 1) { //anime ascending
        options.useRomajiNames
            ? songList.sort((a, b) => (a.animeRomajiName || "").localeCompare((b.animeRomajiName || "")))
            : songList.sort((a, b) => (a.animeEnglishName || "").localeCompare((b.animeEnglishName || "")));
    }
    else if (songListTableSort[3] === 2) { //anime descending
        options.useRomajiNames
            ? songList.sort((a, b) => (b.animeRomajiName || "").localeCompare((a.animeRomajiName || "")))
            : songList.sort((a, b) => (b.animeEnglishName || "").localeCompare((a.animeEnglishName || "")));
    }
    else if (songListTableSort[4] === 1) { //song type ascending
        songList.sort((a, b) => songTypeSortValue(a.songType, a.songTypeNumber) - songTypeSortValue(b.songType, b.songTypeNumber));
    }
    else if (songListTableSort[4] === 2) { //song type descending
        songList.sort((a, b) => songTypeSortValue(b.songType, b.songTypeNumber) - songTypeSortValue(a.songType, a.songTypeNumber));
    }
    else if (songListTableSort[5] === 1) { //vintage ascending
        songList.sort((a, b) => vintageSortValue(a.animeVintage) - vintageSortValue(b.animeVintage));
    }
    else if (songListTableSort[5] === 2) { //vintage descending
        songList.sort((a, b) => vintageSortValue(b.animeVintage) - vintageSortValue(a.animeVintage));
    }
    else if (songListTableSort[6] === 1) { //mp3 link ascending
        songList.sort((a, b) => (a.audio || "").localeCompare((b.audio || "")));
    }
    else if (songListTableSort[6] === 2) { //mp3 link descending
        songList.sort((a, b) => (b.audio || "").localeCompare((a.audio || "")));
    }
    else if (songListTableSort[7] === 1) { //480 link ascending
        songList.sort((a, b) => (a.video480 || "").localeCompare((b.video480 || "")));
    }
    else if (songListTableSort[7] === 2) { //480 link descending
        songList.sort((a, b) => (b.video480 || "").localeCompare((a.video480 || "")));
    }
    else if (songListTableSort[8] === 1) { //720 link ascending
        songList.sort((a, b) => (a.video720 || "").localeCompare((b.video720 || "")));
    }
    else if (songListTableSort[8] === 2) { //720 link descending
        songList.sort((a, b) => (b.video720 || "").localeCompare((a.video720 || "")));
    }
    if (songListTableMode === 0) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="song clickAble">Song</th>`).click(() => {
            setSongListTableSort(0);
            createSongListTable();
        }));
        $row.append($(`<th class="artist clickAble">Artist</th>`).click(() => {
            setSongListTableSort(1);
            createSongListTable();
        }));
        $row.append($(`<th class="difficulty clickAble">Dif</th>`).click(() => {
            setSongListTableSort(2);
            createSongListTable();
        }));
        $row.append($(`<th class="trash"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("song").text(song.songName));
            $row.append($("<td></td>").addClass("artist").text(song.songArtist));
            $row.append($("<td></td>").addClass("difficulty").text(Number.isFinite(song.songDifficulty) ? Math.floor(song.songDifficulty) : ""));
            $row.append($("<td></td>").addClass("trash clickAble").append(`<i class="fa fa-trash" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
    else if (songListTableMode === 1) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="anime clickAble">Anime</th>`).click(() => {
            setSongListTableSort(3);
            createSongListTable();
        }));
        $row.append($(`<th class="songType clickAble">Type</th>`).click(() => {
            setSongListTableSort(4);
            createSongListTable();
        }));
        $row.append($(`<th class="vintage clickAble">Vintage</th>`).click(() => {
            setSongListTableSort(5);
            createSongListTable();
        }));
        $row.append($(`<th class="trash"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("anime").text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName));
            $row.append($("<td></td>").addClass("songType").text(songTypeText(song.songType, song.songTypeNumber)));
            $row.append($("<td></td>").addClass("vintage").text(song.animeVintage));
            $row.append($("<td></td>").addClass("trash clickAble").append(`<i class="fa fa-trash" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
    else if (songListTableMode === 2) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="link clickAble">MP3</th>`).click(() => {
            setSongListTableSort(6);
            createSongListTable();
        }));
        $row.append($(`<th class="link clickAble">480</th>`).click(() => {
            setSongListTableSort(7);
            createSongListTable();
        }));
        $row.append($(`<th class="link clickAble">720</th>`).click(() => {
            setSongListTableSort(8);
            createSongListTable();
        }));
        $row.append($(`<th class="trash"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.audio)));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.video480)));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.video720)));
            $row.append($("<td></td>").addClass("trash clickAble").append(`<i class="fa fa-trash" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
}

// create answer table
function createAnswerTable() {
    let $tbody = $("#cslgAnswerTable tbody");
    $tbody.empty();
    if (songList.length === 0) {
        $("#cslgAnswerText").text("No list loaded");
    }
    else if (autocomplete.length === 0) {
        $("#cslgAnswerText").text("Fetch autocomplete first");
    }
    else {
        let animeList = new Set();
        let missingAnimeList = [];
        for (let song of songList) {
            let answers = [song.animeEnglishName, song.animeRomajiName].concat(song.altAnimeNames, song.altAnimeNamesAnswers);
            answers.forEach((x) => animeList.add(x));
        }
        for (let anime of animeList) {
            if (!autocomplete.includes(anime.toLowerCase())) {
                missingAnimeList.push(anime);
            }
        }
        missingAnimeList.sort((a, b) => a.localeCompare(b));
        $("#cslgAnswerText").text(`Found ${missingAnimeList.length} anime missing from AMQ's autocomplete`);
        for (let anime of missingAnimeList) {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("oldName").text(anime));
            $row.append($("<td></td>").addClass("newName").text(replacedAnswers[anime] || ""));
            $row.append($("<td></td>").addClass("edit").append(`<i class="fa fa-pencil clickAble" aria-hidden="true"></i>`));
            $tbody.append($row);
        }
    }
}

// create link element for song list table
function createLinkElement(link) {
    if (!link) return "";
    let $a = $("<a></a>");
    if (link.startsWith("http")) {
        $a.text(link.includes("catbox") ? link.split("/").slice(-1)[0] : link);
        $a.attr("href", link);
    }
    else if (/[a-z0-9]+\.(mp3|webm|mp4|avi|ogg|flac|wav)/i.test(link)) {
        $a.text(link);
        if (fileHostOverride === "0") {
            $a.attr("href", "https://ladist1.catbox.video/" + link);
        }
        else {
            $a.attr("href", "https://" + catboxHostDict[fileHostOverride] + "/" + link);
        }
    }
    return $a;
}

// reset all values in table sort options and toggle specified index
function setSongListTableSort(index) {
    if (Number.isInteger(index)) {
        let value = songListTableSort[index];
        songListTableSort.forEach((x, i) => { songListTableSort[i] = 0 });
        songListTableSort[index] = value === 1 ? 2 : 1;
    }
    else {
        songListTableSort.forEach((x, i) => { songListTableSort[i] = 0 });
    }
}

// get sorting value for anime vintage
function vintageSortValue(vintage) {
    if (!vintage) return 0;
    let split = vintage.split(" ");
    let year = parseInt(split[1]);
    if (isNaN(year)) return 0;
    let season = Object({"Winter": .1, "Spring": .2, "Summer": .3, "Fall": .4})[split[0]];
    if (!season) return 0;
    return year + season;
}

// get sorting value for song type
function songTypeSortValue(type, typeNumber) {
    return (type || 0) * 1000 + (typeNumber || 0);
}

// reset all tabs
function tabReset() {
    $("#cslgSongListTab").removeClass("selected");
    $("#cslgQuizSettingsTab").removeClass("selected");
    $("#cslgAnswerTab").removeClass("selected");
    $("#cslgMergeTab").removeClass("selected");
    $("#cslgMultiplayerTab").removeClass("selected");
    $("#cslgInfoTab").removeClass("selected");
    $("#cslgSongListContainer").hide();
    $("#cslgQuizSettingsContainer").hide();
    $("#cslgAnswerContainer").hide();
    $("#cslgMergeContainer").hide();
    $("#cslgMultiplayerContainer").hide();
    $("#cslgInfoContainer").hide();
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
    let links = {};
    if (fileHostOverride === "0") {
        if (audio) links["0"] = audio;
        if (video480) links["480"] = video480;
        if (video720) links["720"] = video720;
    }
    else {
        if (audio) links["0"] = "https://" + catboxHostDict[fileHostOverride] + "/" + audio.split("/").slice(-1)[0];
        if (video480) links["480"] = "https://" + catboxHostDict[fileHostOverride] + "/" + video480.split("/").slice(-1)[0];
        if (video720) links["720"] = "https://" + catboxHostDict[fileHostOverride] + "/" + video720.split("/").slice(-1)[0];
    }
    return links;
}

// return true if you are in a ranked lobby or quiz
function isRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
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

// save settings
function saveSettings() {
    localStorage.setItem("customSongListGame", JSON.stringify({
        replacedAnswers: replacedAnswers,
        CSLButtonCSS: CSLButtonCSS,
        debug: debug
    }));
}

// apply styles
function applyStyles() {
    $("#customSongListStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "customSongListStyle";
    let text = `
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
        #cslgTableModeButton:hover {
            opacity: .8;
        }
        #cslgSongListTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgSongListTable thead tr {
            background-color: #282828;
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
        #cslgSongListTable .trash {
            width: 20px;
        }
        #cslgSongListTable tbody i.fa-trash:hover {
            opacity: .8;
        }
        #cslgSongListTable th, #cslgSongListTable td {
            padding: 0 4px;
        }
        #cslgSongListTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        #cslgSongListTable tbody tr:nth-child(even) {
            background-color: #353535;
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
            background-color: #282828;
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
        #cslgAnswerTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        #cslgAnswerTable tbody tr:nth-child(even) {
            background-color: #353535;
        }
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
