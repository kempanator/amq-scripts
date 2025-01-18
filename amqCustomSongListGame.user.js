// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.73
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
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.73";
const saveData = validateLocalStorage("customSongListGame");
const hostDict = {1: "eudist.animemusicquiz.com", 2: "nawdist.animemusicquiz.com", 3: "naedist.animemusicquiz.com"};
let CSLButtonCSS = saveData.CSLButtonCSS || "calc(25% - 250px)";
let showCSLMessages = saveData.showCSLMessages ?? true;
let replacedAnswers = saveData.replacedAnswers || {};
let malClientId = saveData.malClientId ?? "";
let hotKeys = saveData.hotKeys ?? {};
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
let songListTableView = 0; //0: song + artist, 1: anime + song type + vintage, 2: video/audio links
let songListTableSort = {mode: "", ascending: true} //modes: songName, artist, difficulty, anime, songType, vintage, mp3, 480, 720
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
let autocomplete = []; //store lowercase version for faster compare speed
let autocompleteInput;
let cslMultiplayer = {host: "", songInfo: {}, voteSkip: {}};
let cslState = 0; //0: none, 1: guessing phase, 2: answer phase
let songLinkReceived = {};
let skipping = false;
let answerChunks = {}; //store player answer chunks, ids are keys
let resultChunk;
let songInfoChunk;
let nextSongChunk;
let importRunning = false;

hotKeys.start = saveData.hotKeys?.start ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.stop = saveData.hotKeys?.stop ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.cslgWindow = saveData.hotKeys?.cslgWindow ?? {altKey: false, ctrlKey: false, key: ""};
//hotKeys.mergeAll = saveData.hotKeys?.mergeAll ?? {altKey: false, ctrlKey: false, key: ""};

$("#gameContainer").append($(`
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
                    <div id="cslgSongListContainer">
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
                                </select>
                                <input id="cslgAnisongdbQueryInput" type="text" style="color: black; width: 250px;">
                                <button id="cslgAnisongdbSearchButtonGo" style="color: black">Go</button>
                                <label class="clickAble" style="margin-left: 7px">Partial<input id="cslgAnisongdbPartialCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">OP<input id="cslgAnisongdbOPCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">ED<input id="cslgAnisongdbEDCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 7px">IN<input id="cslgAnisongdbINCheckbox" type="checkbox"></label>
                            </div>
                            <div>
                                <label class="clickAble">Max Other People<input id="cslgAnisongdbMaxOtherPeopleInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                <label class="clickAble" style="margin-left: 10px">Min Group Members<input id="cslgAnisongdbMinGroupMembersInput" type="text" style="color: black; font-weight: normal; width: 40px; margin-left: 3px;"></label>
                                <label class="clickAble" style="margin-left: 10px">Ignore Duplicates<input id="cslgAnisongdbIgnoreDuplicatesCheckbox" type="checkbox"></label>
                                <label class="clickAble" style="margin-left: 10px">Arrangement<input id="cslgAnisongdbArrangementCheckbox" type="checkbox"></label>
                            </div>
                        </div>
                        <div id="cslgFileUploadRow">
                            <label style="vertical-align: -4px"><input id="cslgFileUpload" type="file" style="width: 600px"></label>
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
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Modifiers:</span>
                            <label class="clickAble">Dub<input id="cslgSettingsDubCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Rebroadcast<input id="cslgSettingsRebroadcastCheckbox" type="checkbox"></label>
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
                                <option value="1">eudist.animemusicquiz.com</option>
                                <option value="2">nawdist.animemusicquiz.com</option>
                                <option value="3">naedist.animemusicquiz.com</option>
                                
                            </select>
                        </div>
                        <p style="margin-top: 20px">Normal room settings are ignored. Only these settings will apply.</p>
                    </div>
                    <div id="cslgAnswerContainer">
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
                    <div id="cslgMergeContainer">
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
                    <div id="cslgHotkeyContainer">
                        <table id="cslgHotkeyTable">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Modifier</th>
                                    <th>Key</th>
                                </tr>
                            </thead>
                            <tbody>
                            </tbody>
                        </table>
                    </div>
                    <div id="cslgListImportContainer" style="text-align: center; margin: 10px 0;">
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
                    <div id="cslgInfoContainer" style="text-align: center; margin: 10px 0;">
                        <h4>Script Info</h4>
                        <div>Created by: kempanator</div>
                        <div>Version: ${version}</div>
                        <div><a href="https://github.com/kempanator/amq-scripts/blob/main/amqCustomSongListGame.user.js" target="blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js" target="blank">Install</a></div>
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

createHotkeyElement("Start CSL", "start", "cslgStartHotkeySelect", "cslgStartHotkeyInput");
createHotkeyElement("Stop CSL", "stop", "cslgStopHotkeySelect", "cslgStopHotkeyInput");
createHotkeyElement("Open Window", "cslgWindow", "cslgWindowHotkeySelect", "cslgWindowHotkeyInput");
//createHotkeyElement("Merge All", "mergeAll", "cslgMergeAllHotkeySelect", "cslgMergeAllHotkeyInput");

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
$("#cslgHotkeyTab").click(() => {
    tabReset();
    $("#cslgHotkeyTab").addClass("selected");
    $("#cslgHotkeyContainer").show();
});
$("#cslgListImportTab").click(() => {
    tabReset();
    $("#cslgListImportTab").addClass("selected");
    $("#cslgListImportContainer").show();
});
$("#cslgInfoTab").click(() => {
    tabReset();
    $("#cslgInfoTab").addClass("selected");
    $("#cslgInfoContainer").show();
});
$("#cslgAnisongdbSearchButtonGo").click(() => {
    anisongdbDataSearch();
});
$("#cslgAnisongdbQueryInput").keypress((event) => {
    if (event.which === 13) {
        anisongdbDataSearch();
    }
});
$("#cslgFileUpload").on("change", function() {
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
            createSongListTable();
            createAnswerTable();
        });
    }
});
$("#cslgPreviousGameButtonGo").click(() => {
    let id = $("#cslgPreviousGameSelect").val();
    let found = Object.values(songHistoryWindow.tabs[2].gameMap).find(game => game.quizId === id);
    if (found) {
        handleData(found.songTable.rows);
        setSongListTableSort();
        createSongListTable();
        createAnswerTable();
    }
});
$("#cslgFilterListButtonGo").click(() => {
    filterSongList();
});
$("#cslgFilterListInput").keypress((event) => {
    if (event.which === 13) {
        filterSongList();
    }
});
$("#cslgMergeAllButton").click(() => {
    mergedSongList = Array.from(new Set(mergedSongList.concat(songList).map((x) => JSON.stringify(x)))).map((x) => JSON.parse(x));
    createMergedSongListTable();
}).popover({
    content: "Add all to merged",
    trigger: "hover",
    placement: "bottom"
});
$("#cslgClearSongListButton").click(() => {
    songList = [];
    createSongListTable();
}).popover({
    content: "Clear song list",
    trigger: "hover",
    placement: "bottom"
});
$("#cslgTransferSongListButton").click(() => {
    songList = Array.from(mergedSongList);
    createSongListTable();
}).popover({
    content: "Transfer from merged",
    trigger: "hover",
    placement: "bottom"
});
$("#cslgTableModeButton").click(() => {
    songListTableView = (songListTableView + 1) % 3;
    createSongListTable();
}).popover({
    content: "Table mode",
    trigger: "hover",
    placement: "bottom"
});
$("#cslgSongOrderSelect").on("change", function() {
    songOrderType = this.value;
});
$("#cslgHostOverrideSelect").on("change", function() {
    fileHostOverride = parseInt(this.value);
});
$("#cslgMergeButton").click(() => {
    mergedSongList = Array.from(new Set(mergedSongList.concat(songList).map((x) => JSON.stringify(x)))).map((x) => JSON.parse(x));
    createMergedSongListTable();
});
$("#cslgMergeClearButton").click(() => {
    mergedSongList = [];
    createMergedSongListTable();
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
$("#cslgListImportUsernameInput").keypress((event) => {
    if (event.which === 13) {
        startImport();
    }
});
$("#cslgListImportStartButton").click(() => {
    startImport();
});
$("#cslgListImportMoveButton").click(() => {
    if (!importedSongList.length) return;
    handleData(importedSongList);
    setSongListTableSort();
    createSongListTable();
    createAnswerTable();
});
$("#cslgListImportDownloadButton").click(() => {
    if (!importedSongList.length) return;
    let listType = $("#cslgListImportSelect").val();
    let username = $("#cslgListImportUsernameInput").val().trim();
    let date = new Date();
    let dateFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, 0)}-${String(date.getDate()).padStart(2, 0)}`;
    let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(importedSongList));
    let element = document.createElement("a");
    element.setAttribute("href", data);
    element.setAttribute("download", `${username} ${listType} ${dateFormatted} song list.json`);
    document.body.appendChild(element);
    element.click();
    element.remove();
});
$("#cslgStartButton").click(() => {
    validateStart();
});
$("#cslgSongListTable").on("click", "i.fa-trash", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    songList.splice(index, 1);
    createSongListTable();
    createAnswerTable();
}).on("mouseenter", "i.fa-trash", (event) => {
    event.target.parentElement.parentElement.classList.add("selected");
}).on("mouseleave", "i.fa-trash", (event) => {
    event.target.parentElement.parentElement.classList.remove("selected");
});
$("#cslgSongListTable").on("click", "i.fa-plus", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    mergedSongList.push(songList[index]);
    mergedSongList = Array.from(new Set(mergedSongList.map((x) => JSON.stringify(x)))).map((x) => JSON.parse(x));
    createMergedSongListTable();
}).on("mouseenter", "i.fa-plus", (event) => {
    event.target.parentElement.parentElement.classList.add("selected");
}).on("mouseleave", "i.fa-plus", (event) => {
    event.target.parentElement.parentElement.classList.remove("selected");
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
$("#cslgMergedSongListTable").on("click", "i.fa-chevron-up", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    if (index !== 0) {
        [mergedSongList[index], mergedSongList[index - 1]] = [mergedSongList[index - 1], mergedSongList[index]];
        createMergedSongListTable();
    }
}).on("mouseenter", "i.fa-chevron-up", (event) => {
    event.target.parentElement.parentElement.classList.add("selected");
}).on("mouseleave", "i.fa-chevron-up", (event) => {
    event.target.parentElement.parentElement.classList.remove("selected");
});
$("#cslgMergedSongListTable").on("click", "i.fa-chevron-down", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    if (index !== mergedSongList.length - 1) {
        [mergedSongList[index], mergedSongList[index + 1]] = [mergedSongList[index + 1], mergedSongList[index]];
        createMergedSongListTable();
    }
}).on("mouseenter", "i.fa-chevron-down", (event) => {
    event.target.parentElement.parentElement.classList.add("selected");
}).on("mouseleave", "i.fa-chevron-down", (event) => {
    event.target.parentElement.parentElement.classList.remove("selected");
});
$("#cslgMergedSongListTable").on("click", "i.fa-trash", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    mergedSongList.splice(index, 1);
    createMergedSongListTable();
}).on("mouseenter", "i.fa-trash", (event) => {
    event.target.parentElement.parentElement.classList.add("selected");
}).on("mouseleave", "i.fa-trash", (event) => {
    event.target.parentElement.parentElement.classList.remove("selected");
});
$("#cslgSongListModeSelect").val("Anisongdb").on("change", function() {
    if (this.value === "Anisongdb") {
        $("#cslgFileUploadRow").hide();
        $("#cslgPreviousGameRow").hide();
        $("#cslgFilterListRow").hide();
        $("#cslgAnisongdbSearchRow").show();
    }
    else if (this.value === "Load File") {
        $("#cslgAnisongdbSearchRow").hide();
        $("#cslgPreviousGameRow").hide();
        $("#cslgFilterListRow").hide();
        $("#cslgFileUploadRow").show();
        $("#cslgAnisongdbQueryInput").val("");
    }
    else if (this.value === "Previous Game") {
        $("#cslgAnisongdbSearchRow").hide();
        $("#cslgFileUploadRow").hide();
        $("#cslgFilterListRow").hide();
        $("#cslgPreviousGameRow").show();
        LoadPreviousGameOptions();
    }
    else if (this.value === "Filter List") {
        $("#cslgAnisongdbSearchRow").hide();
        $("#cslgFileUploadRow").hide();
        $("#cslgPreviousGameRow").hide();
        $("#cslgFilterListRow").show();
    }
});
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
$("#cslgSettingsDubCheckbox").prop("checked", true);
$("#cslgSettingsRebroadcastCheckbox").prop("checked", true);
$("#cslgSettingsStartPoint").val("0-100");
$("#cslgSettingsDifficulty").val("0-100");
$("#cslgSettingsFastSkip").prop("checked", false);
$("#cslgFileUploadRow").hide();
$("#cslgPreviousGameRow").hide();
$("#cslgFilterListRow").hide();
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
$("#cslgMalClientIdInput").val(malClientId).on("change", function() {
    malClientId = this.value;
    saveSettings();
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
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
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
                cslMessage("§CSL17" + btoa(payload.name));
            }
            else {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
            }
            setTimeout(() => {
                let song = songList[songOrder[currentSong]];
                let message  = `${currentSong}§${getStartPoint()}§${song.audio || ""}§${song.video480 || ""}§${song.video720 || ""}`;
                splitIntoChunks(btoa(message) + "$", 144).forEach((item, index) => {
                    cslMessage("§CSL3" + base10to36(index % 36) + item);
                });
            }, 300);
        }
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (quiz.cslActive && quiz.inQuiz && quiz.isHost) {
            let player = Object.values(quiz.players).find((p) => p._name === payload.name);
            if (player) {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
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
                cslMessage("§CSL17" + btoa(payload.name));
            }
            else {
                cslMessage("§CSL0" + btoa(`${showSelection}§${currentSong}§${totalSongs}§${guessTime}§${extraGuessTime}§${fastSkip ? "1" : "0"}`));
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
    new Listener("game closed", (payload) => {
        if (quiz.cslActive && quiz.inQuiz) {
            reset();
            messageDisplayer.displayMessage("Room Closed", payload.reason);
            lobby.leave({ supressServerMsg: true });
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
                    cslMessage("§CSL12");
                }
                else {
                    cslMessage("§CSL11");
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
                cslMessage("§CSL14");
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
                cslMessage("§CSL10");
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

    document.body.addEventListener("keydown", (event) => {
        const key = event.key;
        const altKey = event.altKey;
        const ctrlKey = event.ctrlKey;
        if (testHotkey("start", key, altKey, ctrlKey)) {
            validateStart();
        }
        if (testHotkey("stop", key, altKey, ctrlKey)) {
            quizOver();
        }
        if (testHotkey("cslgWindow", key, altKey, ctrlKey)) {
            if ($("#cslgSettingsModal").is(":visible")) {
                $("#cslgSettingsModal").modal("hide");
            }
            else {
                openSettingsModal();
            }
        }
        /*if (testHotkey("mergeAll", key, altKey, ctrlKey)) {
            mergedSongList = Array.from(new Set(mergedSongList.concat(songList).map((x) => JSON.stringify(x)))).map((x) => JSON.parse(x));
            createMergedSongListTable();
        }*/
    });

    resultChunk = new Chunk();
    songInfoChunk = new Chunk();
    nextSongChunk = new Chunk();

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

// validate all settings and attempt to start csl quiz
function validateStart() {
    if (!lobby.inLobby) return;
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
        let regex = /^([0-9]+)[\s-]+([0-9]+)$/.exec(startPointText);
        startPointRange = [parseInt(regex[1]), parseInt(regex[2])];
    }
    else {
        return messageDisplayer.displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    if (startPointRange[0] < 0 || startPointRange[0] > 100 || startPointRange[1] < 0 || startPointRange[1] > 100 || startPointRange[0] > startPointRange[1]) {
        return messageDisplayer.displayMessage("Unable to start", "song start sample must be a number or range 0-100");
    }
    let difficultyText = $("#cslgSettingsDifficulty").val().trim();
    if (/^[0-9]+[\s-]+[0-9]+$/.test(difficultyText)) {
        let regex = /^([0-9]+)[\s-]+([0-9]+)$/.exec(difficultyText);
        difficultyRange = [parseInt(regex[1]), parseInt(regex[2])];
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
    let dub = $("#cslgSettingsDubCheckbox").prop("checked");
    let rebroadcast = $("#cslgSettingsRebroadcastCheckbox").prop("checked");
    let correctGuesses = $("#cslgSettingsCorrectGuessCheckbox").prop("checked");
    let incorrectGuesses = $("#cslgSettingsIncorrectGuessCheckbox").prop("checked");
    let songKeys = Object.keys(songList)
        .filter((key) => songTypeFilter(songList[key], ops, eds, ins))
        .filter((key) => animeTypeFilter(songList[key], tv, movie, ova, ona, special))
        .filter((key) => difficultyFilter(songList[key], difficultyRange[0], difficultyRange[1]))
        .filter((key) => guessTypeFilter(songList[key], correctGuesses, incorrectGuesses))
        .filter((key) => modifiersFilter(songList[key], dub, rebroadcast));
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
            "quizId": crypto.randomUUID(),
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
                "startPoint": getStartPoint(),
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
                let message  = `1§${getStartPoint()}§${song.audio || ""}§${song.video480 || ""}§${song.video720 || ""}`;
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
    for (let key of Object.keys(quiz.players)) {
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
                let nextSong = songList[songOrder[songNumber + 1]];
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
                    let nextSong = songList[songOrder[songNumber + 1]];
                    let message  = `${songNumber + 1}§${getStartPoint()}§${nextSong.audio || ""}§${nextSong.video480 || ""}§${nextSong.video720 || ""}`;
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
        let answer = currentAnswers[quiz.ownGamePlayerId];
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
            for (let player of Object.values(quiz.players)) {
                currentAnswers[player.gamePlayerId] = answerChunks[player.gamePlayerId] ? answerChunks[player.gamePlayerId].decode() : "";
            }
        }
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
            let message = `${song.animeRomajiName || ""}\n${song.animeEnglishName || ""}\n${(song.altAnimeNames || []).join("\t")}\n${(song.altAnimeNamesAnswers || []).join("\t")}\n${song.songArtist || ""}\n${song.songName || ""}\n${song.songType || ""}\n${song.songTypeNumber || ""}\n${song.songDifficulty || ""}\n${song.animeType || ""}\n${song.animeVintage || ""}\n${song.annId || ""}\n${song.malId || ""}\n${song.kitsuId || ""}\n${song.aniListId || ""}\n${Array.isArray(song.animeTags) ? song.animeTags.join(",") : ""}\n${Array.isArray(song.animeGenre) ? song.animeGenre.join(",") : ""}\n${song.audio || ""}\n${song.video480 || ""}\n${song.video720 || ""}`;
            splitIntoChunks(btoa(encodeURIComponent(message)) + "$", 144).forEach((item, index) => {
                cslMessage("§CSL7" + base10to36(index % 36) + item);
            });
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
                cslMessage("§CSL10");
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
            let split = atob(content.slice(5)).split("§");
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
            fireListener("player answered", [player.gamePlayerId]);
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
        cslMessage(`Autocomplete: ${autocomplete.length ? "✅" : "⛔"}`);
    }
    else if (content === "§CSL22") { //version
        cslMessage(`CSL version ${version}`);
    }
    else if (content.startsWith("§CSL3")) { //next song link
        if (quiz.cslActive && isHost) {
            //§CSL3#songNumber§startPoint§mp3§480§720
            nextSongChunk.append(content);
            if (nextSongChunk.isComplete) {
                let split = nextSongChunk.decode().split("§");
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
            let number = parseInt(atob(content.slice(5)));
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
                let split = resultChunk.decode().split("§");
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
    }
    else if (content.startsWith("§CSL7")) {
        songInfoChunk.append(content);
        if (songInfoChunk.isComplete) {
            let split = preventCodeInjection(songInfoChunk.decode()).split("\n");
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
    let keys = Object.keys(cslMultiplayer.voteSkip).filter((key) => quiz.players.hasOwnProperty(key) && !quiz.players[key].avatarDisabled);
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

// get start point value (0-100)
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
        return tv && movie && ova && ona && special;
    }
}

// return true if the song difficulty is in allowed range
// songs with missing difficulty will only pass if 0-100
function difficultyFilter(song, low, high) {
    if (low === 0 && high === 100) return true;
    let dif = parseFloat(song.songDifficulty);
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

// return true if the song is allowed under the selected modifiers
function modifiersFilter(song, dub, rebroadcast) {
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
    cslMultiplayer = {host: "", songInfo: {}, voteSkip: {}};
    cslState = 0;
    currentSong = 0;
    currentAnswers = {};
    score = {};
    previousSongFinished = false;
    fastSkip = false;
    skipping = false;
    songLinkReceived = {};
    answerChunks = {};
    songInfoChunk = new Chunk();
    nextSongChunk = new Chunk();
}

// end quiz and set up lobby
function quizOver() {
    reset();
    let data = {
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
        if ($("#cslgSongListModeSelect").val() === "Previous Game") {
            LoadPreviousGameOptions();
        }
        $("#cslgSettingsModal").modal("show");
    }
}

// load previous game options in song list window
function LoadPreviousGameOptions() {
    let $select = $("#cslgPreviousGameSelect").empty();
    let games = [];
    for (let game of Object.values(songHistoryWindow.tabs[2].gameMap)) {
        if (game.songTable.rows.length) {
            games.push({roomName: game.roomName, startTime: game.startTime, quizId: game.quizId});
        }
    }
    games.sort((a, b) => b.startTime - a.startTime);
    for (let game of games) {
        $select.append($("<option></option>").val(game.quizId).text(`${game.roomName} - ${game.startTime.format("YYYY-MM-DD HH:mm")}`));
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
    let arrangement = $("#cslgAnisongdbArrangementCheckbox").prop("checked");
    let maxOtherPeople = parseInt($("#cslgAnisongdbMaxOtherPeopleInput").val());
    let minGroupMembers = parseInt($("#cslgAnisongdbMinGroupMembersInput").val());
    if (query && !isNaN(maxOtherPeople) && !isNaN(minGroupMembers)) {
        getAnisongdbData(mode, query, ops, eds, ins, partial, ignoreDuplicates, arrangement, maxOtherPeople, minGroupMembers);
    }
}

// send anisongdb request
function getAnisongdbData(mode, query, ops, eds, ins, partial, ignoreDuplicates, arrangement, maxOtherPeople, minGroupMembers) {
    $("#cslgSongListCount").text("Loading...");
    $("#cslgSongListTable tbody").empty();
    let url, data;
    let json = {
        and_logic: false,
        ignore_duplicate: ignoreDuplicates,
        opening_filter: ops,
        ending_filter: eds,
        insert_filter: ins
    };
    if (mode === "anime") {
        url = "https://anisongdb.com/api/search_request";
        json.anime_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "artist") {
        url = "https://anisongdb.com/api/search_request";
        json.artist_search_filter = {
            search: query,
            partial_match: partial,
            group_granularity: minGroupMembers,
            max_other_artist: maxOtherPeople
        };
    }
    else if (mode === "song") {
        url = "https://anisongdb.com/api/search_request";
        json.song_name_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "composer") {
        url = "https://anisongdb.com/api/search_request";
        json.composer_search_filter = {
            search: query,
            partial_match: partial,
            arrangement: arrangement
        };
    }
    else if (mode === "season") {
        query = query.trim();
        query = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
        url = `https://anisongdb.com/api/filter_season?${new URLSearchParams({season: query})}`;
    }
    else if (mode === "ann id") {
        url = "https://anisongdb.com/api/annId_request";
        json.annId = parseInt(query);
    }
    else if (mode === "mal id") {
        url = "https://anisongdb.com/api/malIDs_request";
        json.malIds = query.split(/[\s,]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
    }
    if (mode === "season") {
        data = {
            method: "GET",
            headers: {"Accept": "application/json", "Content-Type": "application/json"},
        };
    }
    else {
        data = {
            method: "POST",
            headers: {"Accept": "application/json", "Content-Type": "application/json"},
            body: JSON.stringify(json)
        };
    }
    fetch(url, data).then(res => res.json()).then(json => {
        handleData(json);
        songList = songList.filter((song) => songTypeFilter(song, ops, eds, ins));
        setSongListTableSort();
        if (!Array.isArray(json)) {
            $("#cslgSongListCount").text("Songs: 0");
            $("#cslgMergeCurrentCount").text("Current song list: 0 songs");
            $("#cslgSongListTable tbody").empty();
            $("#cslgSongListWarning").text(JSON.stringify(json));
        }
        else if (songList.length === 0 && (ranked.currentState === ranked.RANKED_STATE_IDS.RUNNING || ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_RUNNING)) {
            $("#cslgSongListCount").text("Songs: 0");
            $("#cslgMergeCurrentCount").text("Current song list: 0 songs");
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
    for (let song of data) {
        let animeRomajiName = song.animeRomajiName ?? song.animeJPName ?? song.songInfo?.animeNames?.romaji ?? song.anime?.romaji ?? song.animeRomaji ?? song.animeRom ??"";
        let animeEnglishName = song.animeEnglishName ?? song.animeENName ?? song.songInfo?.animeNames?.english ?? song.anime?.english ?? song.animeEnglish ?? song.animeEng ?? "";
        let altAnimeNames = song.altAnimeNames ?? song.songInfo?.altAnimeNames ?? [].concat(animeRomajiName, animeEnglishName, song.animeAltName || []);
        let altAnimeNamesAnswers = song.altAnimeNamesAnswers ?? song.songInfo?.altAnimeNamesAnswers ?? [];
        let songArtist = song.songArtist ?? song.artist ?? song.songInfo?.artist ?? "";
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

// create song list table
function createSongListTable() {
    $("#cslgSongListCount").text("Songs: " + songList.length);
    $("#cslgMergeCurrentCount").text(`Current song list: ${songList.length} song${songList.length === 1 ? "" : "s"}`);
    $("#cslgSongListWarning").text("");
    let $thead = $("#cslgSongListTable thead");
    let $tbody = $("#cslgSongListTable tbody");
    $thead.empty();
    $tbody.empty();
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
        options.useRomajiNames
            ? songList.sort((a, b) => a.animeRomajiName.localeCompare(b.animeRomajiName))
            : songList.sort((a, b) => a.animeEnglishName.localeCompare(b.animeEnglishName));
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
    if (songListTableView === 0) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="song clickAble">Song</th>`).click(() => {
            setSongListTableSort("songName");
            createSongListTable();
        }));
        $row.append($(`<th class="artist clickAble">Artist</th>`).click(() => {
            setSongListTableSort("artist");
            createSongListTable();
        }));
        $row.append($(`<th class="difficulty clickAble">Dif</th>`).click(() => {
            setSongListTableSort("difficulty");
            createSongListTable();
        }));
        $row.append($(`<th class="action"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("song").text(song.songName));
            $row.append($("<td></td>").addClass("artist").text(song.songArtist));
            $row.append($("<td></td>").addClass("difficulty").text(Number.isFinite(song.songDifficulty) ? Math.floor(song.songDifficulty) : ""));
            $row.append($("<td></td>").addClass("action").append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i> <i class="fa fa-trash clickAble" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
    else if (songListTableView === 1) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="anime clickAble">Anime</th>`).click(() => {
            setSongListTableSort("anime");
            createSongListTable();
        }));
        $row.append($(`<th class="songType clickAble">Type</th>`).click(() => {
            setSongListTableSort("songType");
            createSongListTable();
        }));
        $row.append($(`<th class="vintage clickAble">Vintage</th>`).click(() => {
            setSongListTableSort("vintage");
            createSongListTable();
        }));
        $row.append($(`<th class="action"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("anime").text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName));
            $row.append($("<td></td>").addClass("songType").text(songTypeText(song.songType, song.songTypeNumber)));
            $row.append($("<td></td>").addClass("vintage").text(song.animeVintage));
            $row.append($("<td></td>").addClass("action").append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i> <i class="fa fa-trash clickAble" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
    else if (songListTableView === 2) {
        let $row = $("<tr></tr>");
        $row.append($(`<th class="number">#</th>`));
        $row.append($(`<th class="link clickAble">MP3</th>`).click(() => {
            setSongListTableSort("mp3");
            createSongListTable();
        }));
        $row.append($(`<th class="link clickAble">480</th>`).click(() => {
            setSongListTableSort("480");
            createSongListTable();
        }));
        $row.append($(`<th class="link clickAble">720</th>`).click(() => {
            setSongListTableSort("720");
            createSongListTable();
        }));
        $row.append($(`<th class="action"></th>`));
        $thead.append($row);
        songList.forEach((song, i) => {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("number").text(i + 1));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.audio)));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.video480)));
            $row.append($("<td></td>").addClass("link").append(createLinkElement(song.video720)));
            $row.append($("<td></td>").addClass("action").append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i> <i class="fa fa-trash clickAble" aria-hidden="true"></i>`));
            $tbody.append($row);
        });
    }
}

// create merged song list table
function createMergedSongListTable() {
    $("#cslgMergedSongListCount").text("Merged: " + mergedSongList.length);
    $("#cslgMergeTotalCount").text(`Merged song list: ${mergedSongList.length} song${mergedSongList.length === 1 ? "" : "s"}`);
    let $tbody = $("#cslgMergedSongListTable tbody");
    $tbody.empty();
    mergedSongList.forEach((song, i) => {
        let $row = $("<tr></tr>");
        $row.append($("<td></td>").addClass("number").text(i + 1));
        $row.append($("<td></td>").addClass("anime").text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName));
        $row.append($("<td></td>").addClass("songType").text(songTypeText(song.songType, song.songTypeNumber)));
        $row.append($("<td></td>").addClass("action").append(`<i class="fa fa-chevron-up clickAble" aria-hidden="true"></i><i class="fa fa-chevron-down clickAble" aria-hidden="true"></i> <i class="fa fa-trash clickAble" aria-hidden="true"></i>`));
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

// create link element for song list table
function createLinkElement(link) {
    if (!link) return "";
    let $a = $("<a></a>");
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
    $a.attr("target", "_blank");
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
    let [seasonA, yearA] = a.animeVintage.split(" ");
    let [seasonB, yearB] = b.animeVintage.split(" ");
    if (yearA !== yearB) {
        return yearA - yearB;
    }
    let seasonOrder = {"Winter": 1, "Spring": 2, "Summer": 3, "Fall": 4};
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
    let keep = $("#cslgFilterModeSelect").val() === "Keep";
    let key = $("#cslgFilterKeySelect").val();
    let text = $("#cslgFilterListInput").val();
    let caseSensitive = $("#cslgFilterListCaseCheckbox").prop("checked");
    let customIncludes = (string, sub) => {
        return caseSensitive ? string.includes(sub) : string.toLowerCase().includes(sub.toLowerCase());
    }
    if (key === "Anime") {
        if (!text) return;
        songList = songList.filter((song) => {
            let result = customIncludes(song.animeRomajiName, text) || customIncludes(song.animeEnglishName, text);
            return keep ? result : !result;
        });
    }
    else if (key === "Artist") {
        if (!text) return;
        songList = songList.filter((song) => {
            let result = customIncludes(song.songArtist, text);
            return keep ? result : !result;
        });
    }
    else if (key === "Song Name") {
        if (!text) return;
        songList = songList.filter((song) => {
            let result = customIncludes(song.songName, text);
            return keep ? result : !result;
        });
    }
    else if (key === "Song Type") {
        text = text.toLowerCase().trim();
        if (!text) return;
        let option;
        let number = parseInt(text.match(/([0-9]+)/)) || null;
        if (text.startsWith("o")) {
            option = {songType: 1, songTypeNumber: number};
        }
        else if (text.startsWith("e")) {
            option = {songType: 2, songTypeNumber: number};
        }
        else if (text.startsWith("i")) {
            option = {songType: 3, songTypeNumber: null};
        }
        else return;
        songList = songList.filter((song) => {
            let result = false;
            if (option.songType === song.songType) {
                if (option.songTypeNumber) {
                    if (option.songTypeNumber === song.songTypeNumber) {
                        result = true;
                    }
                }
                else {
                    result = true;
                }
            }
            return keep ? result : !result;
        });
    }
    else if (key === "Anime Type") {
        text = text.toLowerCase().trim();
        if (!text) return;
        songList = songList.filter((song) => {
            let result = song.animeType && text === song.animeType.toLowerCase();
            return keep ? result : !result;
        });
    }
    else if (key === "Difficulty") {
        text = text.toLowerCase().trim();
        if (!text) return;
        if (text === "null") {
            songList = songList.filter((song) => {
                let result = song.songDifficulty === null;
                return keep ? result : !result;
            });
        }
        else {
            let [low, high] = text.split(/[\s-]+/);
            if (isNaN(low) || isNaN(high) || low > high) return;
            songList = songList.filter((song) => {
                let result = song.songDifficulty && song.songDifficulty >= low && song.songDifficulty <= high;
                return keep ? result : !result;
            });
        }
    }
    else if (key === "Vintage") {
        text = text.toLowerCase().trim();
        if (!text) return;
        if (text === "null") {
            songList = songList.filter((song) => {
                let result = song.animeVintage === null;
                return keep ? result : !result;
            });
        }
        else if (/^[0-9]{4}[\s-]+[0-9]{4}$/.test(text)) {
            let [low, high] = text.split(/[\s-]+/);
            if (low > high) return;
            songList = songList.filter((song) => {
                let result = false;
                if (song.animeVintage) {
                    let year = parseInt(song.animeVintage.split(" "));
                    result = year >= low && year <= high;
                }
                return keep ? result : !result;
            });
        }
        else {
            songList = songList.filter((song) => {
                let result = song.animeVintage && song.animeVintage.toLowerCase().includes(text);
                return keep ? result : !result;
            });
        }
    }
    else if (key === "Rebroadcast") {
        songList = songList.filter((song) => {
            let result = Boolean(song.rebroadcast);
            return keep ? result : !result;
        });
    }
    else if (key === "Dub") {
        songList = songList.filter((song) => {
            let result = Boolean(song.dub);
            return keep ? result : !result;
        });
    }
    else if (key === "Correct") {
        songList = songList.filter((song) => {
            let result = song.correctGuess === true;
            return keep ? result : !result;
        });
    }
    else if (key === "Incorrect") {
        songList = songList.filter((song) => {
            let result = song.incorrectGuess === true;
            return keep ? result : !result;
        });
    }
    createSongListTable();
    createAnswerTable();
}

// reset all tabs
function tabReset() {
    $("#cslgSongListTab").removeClass("selected");
    $("#cslgQuizSettingsTab").removeClass("selected");
    $("#cslgAnswerTab").removeClass("selected");
    $("#cslgMergeTab").removeClass("selected");
    $("#cslgHotkeyTab").removeClass("selected");
    $("#cslgListImportTab").removeClass("selected");
    $("#cslgInfoTab").removeClass("selected");
    $("#cslgSongListContainer").hide();
    $("#cslgQuizSettingsContainer").hide();
    $("#cslgAnswerContainer").hide();
    $("#cslgMergeContainer").hide();
    $("#cslgHotkeyContainer").hide();
    $("#cslgListImportContainer").hide();
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
    $("#cslgHotkeyTable tbody").append($(`<tr></tr>`).append($(`<td></td>`).text(title)).append($(`<td></td>`).append($select)).append($(`<td></td>`).append($input)));
}

// test hotkey
function testHotkey(action, key, altKey, ctrlKey) {
    let hotkey = hotKeys[action];
    return key === hotkey.key && altKey === hotkey.altKey && ctrlKey === hotkey.ctrlKey;
}

// return true if you are in a ranked lobby or quiz
function isRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
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
    let chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
}

// convert base 10 number to base 36
function base10to36(number) {
    if (number === 0) return 0;
    let digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
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
    let digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = 0;
    for (let i = 0; i < number.length; i++) {
        let digit = digits.indexOf(number[i]);
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
        let regex = /^§CSL\w(\w)/.exec(text);
        if (regex) {
            let index = base36to10(regex[1]);
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
            let result = Object.values(this.chunkMap).reduce((a, b) => a + b);
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
    let malIds = [];
    let statuses = [];
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
    for (let status of statuses) {
        $("#cslgListImportText").text(`Retrieving Myanimelist: ${status}`);
        let nextPage = `https://api.myanimelist.net/v2/users/${username}/animelist?offset=0&limit=1000&nsfw=true&status=${status}`;
        while (nextPage) {
            let result = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: nextPage,
                    headers: {"Content-Type": "application/json", "Accept": "application/json", "X-MAL-CLIENT-ID": malClientId},
                    onload: (res) => resolve(JSON.parse(res.response)),
                    onerror: (res) => reject(res)
                });
            });
            if (result.error) {
                nextPage = false;
                $("#cslgListImportText").text(`MAL API Error: ${result.error}`);
            }
            else {
                for (let anime of result.data) {
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
    let malIds = [];
    let statuses = [];
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
        let data = await getAnilistData(username, statuses, pageNumber);
        if (data) {
            for (let item of data.mediaList) {
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
    let query = `
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
    let data = {
        method: "POST",
        headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({query: query})
    }
    return fetch("https://graphql.anilist.co", data)
        .then(res => res.json())
        .then(json => json?.data?.Page)
        .catch(error => console.log(error));
}

async function getSongListFromMalIds(malIds) {
    importedSongList = [];
    if (!malIds) malIds = [];
    if (malIds.length === 0) return;
    $("#cslgListImportText").text(`Anime: 0 / ${malIds.length} | Songs: ${importedSongList.length}`);
    let url = "https://anisongdb.com/api/malIDs_request";
    let idsProcessed = 0;
    for (let i = 0; i < malIds.length; i += 500) {
        let segment = malIds.slice(i, i + 500);
        idsProcessed += segment.length;
        let data = {
            method: "POST",
            headers: {"Accept": "application/json", "Content-Type": "application/json"},
            body: JSON.stringify({"malIds": segment})
        };
        await fetch(url, data).then(res => res.json()).then(json => {
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
        }).catch(res => {
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
    if ($("#cslgListImportSelect").val() === "myanimelist") {
        if (malClientId) {
            let username = $("#cslgListImportUsernameInput").val().trim();
            if (username) {
                let malIds = await getMalIdsFromMyanimelist(username);
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
    else if ($("#cslgListImportSelect").val() === "anilist") {
        let username = $("#cslgListImportUsernameInput").val().trim();
        if (username) {
            let malIds = await getMalIdsFromAnilist(username);
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
        replacedAnswers,
        CSLButtonCSS,
        debug,
        hotKeys,
        malClientId
    }));
}

// apply styles
function applyStyles() {
    $("#customSongListStyle").remove();
    let tableHighlightColor = getComputedStyle(document.documentElement).getPropertyValue("--accentColorContrast") || "#4497ea";
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
        #cslgHotkeyTable select, #cslgHotkeyTable input {
            color: black;
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
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
