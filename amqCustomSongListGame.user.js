// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.28
// @description  Play a solo game with a custom song list
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/TheJoseph98/AMQ-Scripts/raw/master/common/amqScriptInfo.js
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

const version = "0.28";
const saveData = validateLocalStorage("customSongListGame");
let replacedAnswers = saveData.replacedAnswers || {};
let fastSkip = false;
let nextVideoReady = false;
let guessTime = 20;
let extraGuessTime = 0;
let currentSong = 0;
let currentAnswer = "";
let score = 0;
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
let fileHostOverride = "";
let autocomplete = []; //store lowercase version for faster compare speed
let autocompleteInput;

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
                            <span id="cslgSongListCount" style="font-size: 20px; font-weight: bold; margin-left: 120px;">Total Songs: 0</span>
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
                                <option value="">default</option>
                                <option value="files.catbox.moe">files.catbox.moe</option>
                                <option value="nl.catbox.moe">nl.catbox.moe</option>
                                <option value="ladist1.catbox.video">ladist1.catbox.video</option>
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
                    <div id="cslgInfoContainer" style="text-align: center; margin: 40px 0;">
                        <p>Created by: kempanator</p>
                        <p>Version: ${version}</p>
                        <p><a href="https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js" target="blank">Link</a></p>
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
                displayMessage("Upload Error");
            }
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
        displayMessage("No songs", "add some songs to the merged song list");
    }
});
$("#cslgAutocompleteButton").click(() => {
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
});
$("#cslgStartButton").click(() => {
    songOrder = {};
    if (!songList || !songList.length) {
        return displayMessage("Unable to start", "no songs");
    }
    if (autocomplete.length === 0) {
        return displayMessage("Unable to start", "autocomplete list empty");
    }
    let numSongs = parseInt($("#cslgSettingsSongs").val());
    if (isNaN(numSongs) || numSongs < 1) {
        return displayMessage("Unable to start", "invalid number of songs");
    }
    guessTime = parseInt($("#cslgSettingsGuessTime").val());
    if (isNaN(guessTime) || guessTime < 1 || guessTime > 99) {
        return displayMessage("Unable to start", "invalid guess time");
    }
    extraGuessTime = parseInt($("#cslgSettingsExtraGuessTime").val());
    if (isNaN(extraGuessTime) || extraGuessTime < 0 || extraGuessTime > 15) {
        return displayMessage("Unable to start", "invalid extra guess time");
    }
    let startPointText = $("#cslgSettingsStartPoint").val().trim();
    if (/^[0-9]+$/.test(startPointText)) {
        startPointRange = [parseInt(startPointText), parseInt(startPointText)];
    }
    else if (/^[0-9]+[\s-]+[0-9]+$/.test(startPointText)) {
        startPointRange = [parseInt(/^([0-9]+)[\s-]+[0-9]+$/.exec(startPointText)[1]), parseInt(/^[0-9]+[\s-]+([0-9]+)$/.exec(startPointText)[1])];
    }
    else {
        return displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    if (startPointRange[0] < 0 || startPointRange[0] > 100 || startPointRange[1] < 0 || startPointRange[1] > 100 || startPointRange[0] > startPointRange[1]) {
        return displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    let difficultyText = $("#cslgSettingsDifficulty").val().trim();
    if (/^[0-9]+[\s-]+[0-9]+$/.test(difficultyText)) {
        difficultyRange = [parseInt(/^([0-9]+)[\s-]+[0-9]+$/.exec(difficultyText)[1]), parseInt(/^[0-9]+[\s-]+([0-9]+)$/.exec(difficultyText)[1])];
    }
    else {
        return displayMessage("Unable to start", "difficulty must be a range 0-100");
    }
    if (difficultyRange[0] < 0 || difficultyRange[0] > 100 || difficultyRange[1] < 0 || difficultyRange[1] > 100 || difficultyRange[0] > difficultyRange[1]) {
        return displayMessage("Unable to start", "difficulty must be a range 0-100");
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
    if (Object.keys(songOrder).length === 0) {
        return displayMessage("Unable to start", "no songs");
    }
    fastSkip = $("#cslgSettingsFastSkip").prop("checked");
    $("#cslgSettingsModal").modal("hide");
    //console.log(songOrder);
    startQuiz();
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
        localStorage.setItem("customSongListGame", JSON.stringify({replacedAnswers: replacedAnswers}));
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
tabReset();
$("#cslgSongListTab").addClass("selected");
$("#cslgSongListContainer").show();

// setup
function setup() {
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
            socket.sendCommand({type: "quiz", command: quiz.pauseButton.pauseOn ? "quiz unpause" : "quiz pause"});
        }
    });

    const oldSendSkipVote = quiz.skipController.sendSkipVote;
    quiz.skipController.sendSkipVote = function() {
        if (quiz.cslActive) {
            clearTimeout(this.autoVoteTimeout);
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
        if (quiz.cslActive) {
            quizOver();
        }
        else {
            oldStartReturnLobbyVote.apply(this, arguments);
        }
    }

    const oldSubmitAnswer = QuizTypeAnswerInputController.prototype.submitAnswer;
    QuizTypeAnswerInputController.prototype.submitAnswer = function(answer) {
        if (quiz.cslActive) {
            currentAnswer = answer;
            fireListener("quiz answer", {
                "answer": answer,
                "success": true
            });
            fireListener("player answered", [0]);
            this.skipController.highlight = true;
            if (options.autoVoteSkipGuess) {
                this.skipController.voteSkip();
                fireListener("quiz overlay message", "Skipping to Answers");
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
    if (!lobby.inLobby || !lobby.soloMode || !songList.length) return;
    quiz.cslActive = true;
    let song = songList[songOrder[1]];
    let date = new Date().toISOString();
    fireListener("Game Starting", {
        "gameMode": "Solo",
        "showSelection": 1,
        "groupSlotMap": {1: [0]},
        "players": Object.values(lobby.players),
        "multipleChoice": false,
        "quizDescription": {
            "quizId": "",
            "startTime": date,
            "roomName": "Solo"
        }
    });
    setTimeout(() => {
        fireListener("quiz next video info", {
            "playLength": guessTime,
            "playbackSpeed": 1,
            "startPont": getStartPoint(),
            "videoInfo": {
                "id": null,
                "videoMap": {
                    "catbox": {
                        "0": getFileURL(song.audio),
                        "480": getFileURL(song.video480),
                        "720": getFileURL(song.video720)
                    }
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
    }, 100);
    setTimeout(() => {
        fireListener("quiz ready", {
            "numberOfSongs": Object.keys(songOrder).length
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

// check if all conditions are met to go to next song
function readySong(songNumber) {
    nextVideoReadyInterval = setInterval(() => {
        if (nextVideoReady && !quiz.pauseButton.pauseOn && previousSongFinished) {
            clearInterval(nextVideoReadyInterval);
            nextVideoReady = false;
            previousSongFinished = false;
            playSong(songNumber);
        }
    }, 100);
}

// play a song
function playSong(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    currentSong = songNumber;
    fireListener("play next song", {
        "time": guessTime,
        "extraGuessTime": extraGuessTime,
        "songNumber": songNumber,
        "progressBarState": {"length": guessTime, "played": 0},
        "onLastSong": songNumber === Object.keys(songOrder).length,
        "multipleChoiceNames": null
    });
    if (extraGuessTime) {
        extraGuessTimer = setTimeout(() => {
            fireListener("extra guess time");
        }, guessTime * 1000);
    }
    endGuessTimer = setTimeout(() => {
        clearInterval(skipInterval);
        clearTimeout(endGuessTimer);
        clearTimeout(extraGuessTimer);
        endGuessPhase(songNumber);
    }, (guessTime + extraGuessTime) * 1000);
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
    setTimeout(() => {
        if (songNumber < Object.keys(songOrder).length) {
            readySong(songNumber + 1);
            let nextSong = songList[songOrder[songNumber + 1]];
            fireListener("quiz next video info", {
                "playLength": guessTime,
                "playbackSpeed": 1,
                "startPont": getStartPoint(),
                "videoInfo": {
                    "id": null,
                    "videoMap": {
                        "catbox": {
                            "0": getFileURL(nextSong.audio),
                            "480": getFileURL(nextSong.video480),
                            "720": getFileURL(nextSong.video720)
                        }
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
    }, 100);
}

// end guess phase and display answer
function endGuessPhase(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    let song = songList[songOrder[songNumber]];
    fireListener("guess phase over");
    answerTimer = setTimeout(() => {
        if (!quiz.cslActive || !quiz.inQuiz) return reset();
        fireListener("player answers", {
            "answers": [{"gamePlayerId": 0, "pose": 3, "answer": currentAnswer}],
            "progressBarState": null
        });
        answerTimer = setTimeout(() => {
            if (!quiz.cslActive || !quiz.inQuiz) return reset();
            let correct = isCorrectAnswer(songNumber, currentAnswer);
            let pose = currentAnswer ? (correct ? 5 : 4) : 6;
            if (correct) score++;
            currentAnswer = "";
            fireListener("answer results", {
                "players": [{
                    "gamePlayerId": 0,
                    "pose": pose,
                    "level": quiz.players[0].level,
                    "correct": correct,
                    "score": score,
                    "listStatus": null,
                    "showScore": null,
                    "position": 1,
                    "positionSlot": 0
                }],
                "songInfo": {
                    "animeNames": {
                        "english": song.animeEnglishName,
                        "romaji": song.animeRomajiName
                    },
                    "artist": song.songArtist,
                    "songName": song.songName,
                    "urlMap": {
                        "catbox": {
                            "0": song.audio,
                            "480": song.video480,
                            "720": song.video720
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
                "groupMap": {
                    "1": [0]
                },
                "watched": false
            });
            setTimeout(() => {
                if (!quiz.cslActive || !quiz.inQuiz) return reset();
                skipInterval = setInterval(() => {
                    if (quiz.skipController._toggled) {
                        clearInterval(skipInterval);
                        endReplayPhase(songNumber);
                    }
                }, 100);
            }, fastSkip ? 1000 : 2000);
        }, fastSkip ? 200 : 3000);
    }, fastSkip ? 100: 400);
}

// end replay phase
function endReplayPhase(songNumber) {
    if (!quiz.cslActive || !quiz.inQuiz) return reset();
    if (songNumber < Object.keys(songOrder).length) {
        fireListener("quiz overlay message", "Skipping to Next Song");
        setTimeout(() => {
            previousSongFinished = true;
        }, fastSkip ? 1000 : 3000);
    }
    else {
        fireListener("quiz overlay message", "Skipping to Final Standings");
        setTimeout(() => {
            fireListener("quiz end result", {
                "resultStates": [{
                    "gamePlayerId": 0,
                    "pose": 1,
                    "endPosition": 1
                }]
            });
            /*"progressBarState": {
                "length": 26.484,
                "played": 6.484
            }*/
        }, fastSkip ? 2000 : 5000);
        setTimeout(() => {
            quizOver();
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
        gameChat.systemMessage(`CSL Error: "${type}" listener failed`);
        console.error(error);
        console.log(type);
        console.log(data);
    }
}

// check if the player's answer is correct
function isCorrectAnswer(songNumber, answer) {
    if (!answer) return false;
    answer = answer.toLowerCase();
    let song = songList[songOrder[songNumber]];
    let correctAnswers = [].concat(song.altAnimeNames, song.altAnimeNamesAnswers);
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
    currentSong = 0;
    currentAnswer = "";
    score = 0;
    previousSongFinished = false;
    fastSkip = false;
}

// end quiz and set up lobby
function quizOver() {
    let data = {
        "spectators": [],
        "inLobby": true,
        "settings": hostModal.getSettings(),
        "soloMode": true,
        "inQueue": [],
        "hostName": selfName,
        "gameId": lobby.gameId,
        "players": [{
            "name": selfName,
            "gamePlayerId": 0,
            "level": quiz.players[0].level,
            "avatar": quiz.players[0].avatarInfo,
            "ready": true,
            "inGame": true,
            "teamNumber": null,
            "multipleChoice": false
        }],
        "numberOfTeams": 0,
        "teamFullMap": {}
    };
    reset();
    lobby.setupLobby(data, quiz.isSpectator);
    viewChanger.changeView("lobby", {supressServerMsg: true, keepChatOpen: true});
}

// open custom song list settings modal
function openSettingsModal() {
    if (lobby.inLobby && lobby.soloMode) {
        if (autocomplete.length) {
            $("#cslgAutocompleteButton").removeClass("btn-danger").addClass("btn-success disabled");
        }
        $("#cslgSettingsModal").modal("show");
    }
    else {
        displayMessage("Error", "must be in solo lobby");
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
        if (songList.length === 0 && ranked.currentState === 2) {
            $("#cslgSongListCount").text("Total Songs: 0");
            $("#cslgMergeCurrentCount").text("Found 0 songs in the current song list");
            $("#cslgSongListTable tbody").empty();
            $("#cslgSongListWarning").text("anisongdb is not available during ranked");
        }
        else {
            createSongListTable();
        }
        createAnswerTable();
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
}

// create song list table
function createSongListTable() {
    $("#cslgSongListCount").text("Total Songs: " + songList.length);
    $("#cslgMergeCurrentCount").text(`Found ${songList.length} song${songList.length === 1 ? "" : "s"} in the current song list`);
    $("#cslgSongListWarning").text("");
    let $tbody = $("#cslgSongListTable tbody");
    $tbody.empty();
    songList.forEach((result, i) => {
        let $row = $("<tr></tr>");
        $row.append($("<td></td>").addClass("number").text(i + 1));
        $row.append($("<td></td>").addClass("song").text(result.songName));
        $row.append($("<td></td>").addClass("artist").text(result.songArtist));
        $row.append($("<td></td>").addClass("difficulty").text(Number.isFinite(result.songDifficulty) ? Math.floor(result.songDifficulty) : ""));
        $row.append($("<td></td>").addClass("trash clickAble").append(`<i class="fa fa-trash" aria-hidden="true"></i>`));
        $tbody.append($row);
    });
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

// reset all tabs
function tabReset() {
    $("#cslgSongListTab").removeClass("selected");
    $("#cslgQuizSettingsTab").removeClass("selected");
    $("#cslgAnswerTab").removeClass("selected");
    $("#cslgMergeTab").removeClass("selected");
    $("#cslgInfoTab").removeClass("selected");
    $("#cslgSongListContainer").hide();
    $("#cslgQuizSettingsContainer").hide();
    $("#cslgAnswerContainer").hide();
    $("#cslgMergeContainer").hide();
    $("#cslgInfoContainer").hide();
}

// modify the song url if necessary
function getFileURL(url) {
    if (url) {
        if (fileHostOverride) {
            return "https://" + fileHostOverride + "/" + url.split("/").slice(-1)[0];
        }
        return url;
    }
    return undefined;
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
    //$("#customSongListStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "customSongListStyle";
    let text = `
        #lnCustomSongListButton {
            right: calc(25% - 250px);
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
