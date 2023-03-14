// ==UserScript==
// @name         AMQ Answer Stats
// @namespace    https://github.com/kempanator
// @version      0.7
// @description  Adds a window to display quiz answer stats
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @require      https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqAnswerTimesUtility.user.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnswerStats.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnswerStats.user.js
// ==/UserScript==

/*
Features:
1. Add a window with answer stats
2. Add a window to track average guess time for players' correct answers
3. Add a window to lookup all players' answers for the current game
4. Add a window to compare all answers between selected players
5. Add a window for anisongdb search results
6. Add anisongdb anime and artist lookup buttons to song info
7. Add anilist, kitsu, myanimelist, annid, 720, 480, mp3 links to song info
8. Extra song info button is always visible
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.7";
const regionDictionary = {E: "Eastern", C: "Central", W: "Western"};
let answerStatsWindow;
let answerSpeedWindow;
let answerHistoryWindow;
let answerCompareWindow;
let anisongdbWindow;
let answers = {}; //{1: {name, id, answer, correct}, ...}
let songHistory = {}; //{1: {romaji, english, number, artist, song, type, vintage, difficulty}, ...}
let answerHistory = {}; //{1: {name, id, level, score, rank, box, averageTime, answers: {1: {number, text, speed, correct, invalidAnswer, uniqueAnswer, noAnswer}, ...}, ...}
let listLowerCase = [];
let answerHistoryButton = true;
let answerSpeedButton = true;
let answerCompareButton = true;
let anisongdbSearchButtons = true;
let allSourceLinks = true;
let anisongdbSort = {animeSortAscending: false, artistSortAscending: false, songSortAscending: false, typeSortAscending: false, vintageSortAscending: false};
let averageSpeedSort = "score"; //"score" "time" "name"
let averageSpeedSortAscending = false;
let songHistoryFilter = {type: "all"};
let songHistorySort = {rankSortAscending: null, boxSortAscending: true, scoreSortAscending: null, levelSortAscending: null, nameSortAscending: null, speedSortAscending: null, answerSortAscending: null};
let playerHistorySort = {numberSortAscending: true, difSortAscending: null, speedSortAscending: null, answerSortAscending: null};
let answerHistorySettings = {mode: "song", songNumber: null, playerId: null, roomName: ""};

$("#qpOptionContainer").width($("#qpOptionContainer").width() + 35);
$("#qpOptionContainer > div").append($(`<div id="qpAnswerStats" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-list-alt qpMenuItem"></i></div>`)
    .click(() => {
        answerStatsWindow.isVisible() ? answerStatsWindow.close() : answerStatsWindow.open();
    })
    .popover({
        content: "Answer Stats",
        trigger: "hover",
        placement: "bottom"
    })
);

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName && message.message === "/version") {
                setTimeout(() => { gameChat.systemMessage("Answer Stats - " + version) }, 1);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName && payload.message === "/version") {
            setTimeout(() => { gameChat.systemMessage("Answer Stats - " + version) }, 1);
        }
    }).bindListener();
    new Listener("get all song names", () => {
        setTimeout(() => {
            listLowerCase = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 1);
    }).bindListener();
    new Listener("update all song names", () => {
        setTimeout(() => {
            listLowerCase = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 1);
    }).bindListener();
    new Listener("Game Starting", () => {
        resetHistory();
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.quizState) resetHistory();
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.quizState) resetHistory();
    }).bindListener();
    new Listener("player answers", (payload) => {
        if (!quiz.answerInput.typingInput.autoCompleteController.list.length) quiz.answerInput.typingInput.autoCompleteController.updateList();
        answers = {};
        for (let item of payload.answers) {
            answers[item.gamePlayerId] = {name: quiz.players[item.gamePlayerId]._name, id: item.gamePlayerId, answer: item.answer};
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (Object.keys(answers).length === 0) return;
        if (listLowerCase.length === 0) return;
        let songNumber = parseInt(quiz.infoContainer.$currentSongCount.text());
        let correctPlayers = {}; //{name: answer speed, ...}
        let correctAnswerIdList = {}; //{title: [], ...}
        let incorrectAnswerIdList = {}; //{title: [], ...}
        let otherAnswerIdList = []; //unique incorrect answers
        let invalidAnswerIdList = [];
        let noAnswerIdList = [];
        payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).forEach((anime) => { correctAnswerIdList[anime] = [] });
        for (let player of payload.players) {
            let quizPlayer = answers[player.gamePlayerId];
            if (quizPlayer) {
                quizPlayer.correct = player.correct;
                if (player.correct) {
                    let speed = validateSpeed(amqAnswerTimesUtility.playerTimes[player.gamePlayerId]);
                    if (speed) correctPlayers[answers[player.gamePlayerId].name] = speed;
                    let item = answerHistory[player.gamePlayerId];
                    if (item) {
                        item.level = player.level;
                        item.score = getScore(player);
                        item.rank = player.position;
                        item.answers[songNumber] = {number: songNumber, text: answers[player.gamePlayerId].answer, speed: speed, correct: true, rank: item.rank, score: item.score};
                        if (speed) {
                            item.correctTimeList.push(speed);
                            item.averageTime = item.correctTimeList.reduce((a, b) => a + b) / item.correctTimeList.length;
                            //item.standardDeviation = Math.sqrt(item.correctTimeList.map((x) => (x - item.averageTime) ** 2).reduce((a, b) => a + b) / item.correctTimeList.length);
                        }
                    }
                    else {
                        answerHistory[player.gamePlayerId] = {
                            name: quizPlayer.name,
                            id: player.gamePlayerId,
                            level: player.level,
                            score: getScore(player),
                            rank: player.position,
                            answers: {[songNumber]: {number: songNumber, text: answers[player.gamePlayerId].answer, speed: speed, correct: true, rank: player.position, score: getScore(player)}},
                            correctTimeList: speed ? [speed] : [],
                            averageTime: speed ? speed : 0,
                            standardDeviation: 0
                        };
                    }
                }
                else {
                    let speed = validateSpeed(amqAnswerTimesUtility.playerTimes[player.gamePlayerId]);
                    let item = answerHistory[player.gamePlayerId];
                    if (item) {
                        item.level = player.level;
                        item.score = getScore(player);
                        item.rank = player.position;
                        item.answers[songNumber] = {number: songNumber, text: answers[player.gamePlayerId].answer, speed: speed, correct: false, rank: item.rank, score: item.score};
                    }
                    else {
                        answerHistory[player.gamePlayerId] = {
                            name: quizPlayer.name,
                            id: player.gamePlayerId,
                            level: player.level,
                            score: getScore(player),
                            rank: player.position,
                            answers: {[songNumber]: {number: songNumber, text: answers[player.gamePlayerId].answer, speed: speed, correct: false, rank: player.position, score: getScore(player)}},
                            correctTimeList: [],
                            averageTime: 0,
                            standardDeviation: 0
                        };
                    }
                }
            }
        }
        for (let player of Object.values(answers)) {
            if (player.answer.trim() === "") {
                noAnswerIdList.push(player.id);
                answerHistory[player.id].answers[songNumber].noAnswer = true;
            }
            else {
                let answerLowerCase = player.answer.toLowerCase();
                let index = Object.keys(correctAnswerIdList).findIndex((value) => answerLowerCase === value.toLowerCase());
                if (index > -1) {
                    correctAnswerIdList[Object.keys(correctAnswerIdList)[index]].push(player.id);
                }
                else {
                    index = listLowerCase.findIndex((value) => answerLowerCase === value);
                    if (index > -1) {
                        let wrongAnime = quiz.answerInput.typingInput.autoCompleteController.list[index];
                        incorrectAnswerIdList[wrongAnime] ? incorrectAnswerIdList[wrongAnime].push(player.id) : incorrectAnswerIdList[wrongAnime] = [player.id];
                    }
                    else {
                        invalidAnswerIdList.push(player.id);
                        answerHistory[player.id].answers[songNumber].invalidAnswer = true;
                    }
                }
            }
        }
        let numCorrect = Object.keys(correctPlayers).length;
        let averageTime = numCorrect ? Math.round(Object.values(correctPlayers).reduce((a, b) => a + b) / numCorrect) : null;
        let fastestTime = numCorrect ? Math.min(...Object.values(correctPlayers)) : null;
        let fastestPlayers = Object.keys(correctPlayers).filter((name) => correctPlayers[name] === fastestTime);
        for (let anime of Object.keys(incorrectAnswerIdList)) {
            if (incorrectAnswerIdList[anime].length === 1) {
                let id = incorrectAnswerIdList[anime][0];
                otherAnswerIdList.push(id);
                answerHistory[id].answers[songNumber].uniqueAnswer = true;
            }
        }
        let correctSortedKeys = Object.keys(correctAnswerIdList).sort((a, b) => correctAnswerIdList[b].length - correctAnswerIdList[a].length);
        let incorrectSortedKeys = Object.keys(incorrectAnswerIdList).sort((a, b) => incorrectAnswerIdList[b].length - incorrectAnswerIdList[a].length);
        songHistory[songNumber] = {
            romaji: payload.songInfo.animeNames.romaji,
            english: payload.songInfo.animeNames.english,
            number: songNumber,
            artist: payload.songInfo.artist,
            song: payload.songInfo.songName,
            type: typeText(payload.songInfo.type, payload.songInfo.typeNumber),
            vintage: payload.songInfo.vintage,
            difficulty: Math.round(payload.songInfo.animeDifficulty),
            groupSlotMap: {...payload.groupMap}
        };
        answers = {};

        setTimeout(() => {
            let totalPlayers = $("#qpScoreBoardEntryContainer .qpStandingItem").length;
            let activePlayers = $("#qpScoreBoardEntryContainer .qpStandingItem:not(.disabled)").length;
            answerStatsWindow.panels[0].clear();
            if (quiz.gameMode === "Ranked") {
                answerStatsWindow.panels[0].panel.append(`
                    <div style="margin: 0 3px">
                        <span><b>${rankedText()}</b></span>
                        <span style="margin-left: 20px"><b>Song:</b> ${songNumber}/${quiz.infoContainer.$totalSongCount.text()}</span>
                        <span style="margin-left: 20px"><b>Total Players:</b> ${totalPlayers}</span>
                    </div>
                `);
            }
            answerStatsWindow.panels[0].panel.append(`
                <div style="margin: 0 3px">
                    <span><b>Correct:</b> ${numCorrect}/${activePlayers} ${(numCorrect / activePlayers * 100).toFixed(2)}%</span>
                    <span style="margin-left: 20px"><b>Dif:</b> ${Math.round(payload.songInfo.animeDifficulty)}</span>
                    <span style="margin-left: 20px"><b>Rig:</b> ${payload.watched}</span>
                </div>
            `);
            if (numCorrect && !quiz.soloMode && !quiz.teamMode) {
                answerStatsWindow.panels[0].panel.append(`
                    <div style="margin: 0 3px">
                        <span><b>Average:</b> ${averageTime}ms</span>
                        <span style="margin-left: 20px"><b>Fastest:</b> ${fastestTime}ms - ${fastestPlayers.join(", ")}</span>
                    </div>
                `);
            }
            if (payload.players.length > 8 && Object.keys(correctPlayers).length <= 5) {
                answerStatsWindow.panels[0].panel.append(`
                    <div style="margin: 0 3px">
                        <span><b>Correct Players:</b> ${Object.keys(correctPlayers).join(", ")}</span>
                    </div>
                `);
            }
            let $ulCorrect = $("<ul></ul>").css("margin", "10px 3px 0 3px");
            $ulCorrect.append($("<b>Correct Answers:</b>").addClass("clickAble").click(() => {
                songHistoryFilter = {type: "allCorrectAnswers"};
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (let anime of correctSortedKeys) {
                if (correctAnswerIdList[anime].length > 0) {
                    let li = $("<li></li>");
                    li.append($("<span></span>").addClass("answerStatsAnimeTitle clickAble").text(anime).click(() => {
                        songHistoryFilter = {type: "answer", answer: anime};
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open()
                    }));
                    li.append($("<span></span>").addClass("answerStatsNumber").text(correctAnswerIdList[anime].length));
                    $ulCorrect.append(li);
                }
            }
            let $ulWrong = $("<ul></ul>").css("margin", "10px 3px 0 3px");
            $ulWrong.append($("<b>Wrong Answers:</b>").addClass("clickAble").click(() => {
                songHistoryFilter = {type: "allWrongAnswers"};
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (let anime of incorrectSortedKeys) {
                if (incorrectAnswerIdList[anime].length > 1) {
                    let li = $("<li></li>");
                    li.append($("<span></span>").addClass("answerStatsAnimeTitle clickAble").text(anime).click(() => {
                        songHistoryFilter = {type: "answer", answer: anime};
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open();
                    }));
                    li.append($("<span></span>").addClass("answerStatsNumber").text(incorrectAnswerIdList[anime].length));
                    $ulWrong.append(li);
                }
            }
            if (otherAnswerIdList.length > 0) {
                let li = $("<li></li>");
                li.append($("<span></span>").addClass("answerStatsAnimeTitle clickAble").text("Other Answer").click(() => {
                    songHistoryFilter = {type: "uniqueValidWrongAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(otherAnswerIdList.length));
                $ulWrong.append(li);
            }
            if (invalidAnswerIdList.length > 0) {
                let li = $("<li></li>");
                li.append($("<span></span>").addClass("answerStatsAnimeTitle clickAble").text("Invalid Answer").click(() => {
                    songHistoryFilter = {type: "invalidAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(invalidAnswerIdList.length));
                $ulWrong.append(li);
            }
            if (noAnswerIdList.length > 0) {
                let li = $("<li></li>");
                li.append($("<span></span>").addClass("answerStatsAnimeTitle clickAble").text("No Answer").click(() => {
                    songHistoryFilter = {type: "noAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(noAnswerIdList.length));
                $ulWrong.append(li);
            }
            answerStatsWindow.panels[0].panel.append($ulCorrect);
            answerStatsWindow.panels[0].panel.append($ulWrong);

            if (answerSpeedButton) {
                displayAnswerSpeedResults();
            }

            if (answerHistoryButton) {
                if (answerHistorySettings.mode === "song") {
                    songHistoryFilter = {type: "all"};
                    displaySongHistoryResults(songNumber);
                }
                else if (answerHistorySettings.mode === "player") {
                    displayPlayerHistoryResults(answerHistorySettings.playerId);
                }
            }

            if (answerCompareButton && $("answerCompareSearchInput").text()) {
                displayAnswerCompareResults();
            }

            if (anisongdbSearchButtons) {
                $("#answerStatsAnisongdbSearchRow").remove();
                $("#answerStatsAnimeDatabase").remove();
                $("#answerStatsSongLink").remove();
                $("#qpSongInfoLinkRow").before(`
                    <div id="answerStatsAnisongdbSearchRow" class="row">
                        <h5><b>AnisongDB Search</b></h5>
                        <button id="answerStatsAnisongdbSearchButtonAnime">Anime</button>
                        <button id="answerStatsAnisongdbSearchButtonArtist">Artist</button>
                    </div>
                `);
                $("#answerStatsAnisongdbSearchButtonAnime").click(() => {
                    anisongdbWindow.open();
                    $("#anisongdbSearchMode").val("Anime");
                    $("#anisongdbSearchInput").val(payload.songInfo.animeNames.romaji);
                    getAnisongdbData("anime", payload.songInfo.animeNames.romaji, false);
                });
                $("#answerStatsAnisongdbSearchButtonArtist").click(() => {
                    anisongdbWindow.open();
                    $("#anisongdbSearchMode").val("Artist");
                    $("#anisongdbSearchInput").val(payload.songInfo.artist);
                    getAnisongdbData("artist", payload.songInfo.artist, false);
                });
            }
            if (allSourceLinks) {
                $("#qpSongInfoLinkRow b").remove();
                let anilistUrl = payload.songInfo.siteIds.aniListId ? "https://anilist.co/anime/" + payload.songInfo.siteIds.aniListId : "";
                let kitsuUrl = payload.songInfo.siteIds.kitsuId ? "https://kitsu.io/anime/" + payload.songInfo.siteIds.kitsuId : "";
                let malUrl = payload.songInfo.siteIds.malId ? "https://myanimelist.net/anime/" + payload.songInfo.siteIds.malId : "";
                let annUrl = payload.songInfo.siteIds.annId ? "https://www.animenewsnetwork.com/encyclopedia/anime.php?id=" + payload.songInfo.siteIds.annId : "";
                let url720 = payload.songInfo.urlMap.catbox?.[720] ?? payload.songInfo.urlMap.openingsmoe?.[720] ?? "";
                let url480 = payload.songInfo.urlMap.catbox?.[480] ?? payload.songInfo.urlMap.openingsmoe?.[480] ?? "";
                let urlmp3 = payload.songInfo.urlMap.catbox?.[0] ?? payload.songInfo.urlMap.openingsmoe?.[0] ?? "";              
                $("#qpSongInfoLinkRow").prepend(`
                    <b id="answerStatsUrls">
                        <a href="${anilistUrl}" target="_blank" ${anilistUrl ? "" : 'class="disabled"'}>ANI</a>
                        <a href="${kitsuUrl}" target="_blank" ${kitsuUrl ? "" : 'class="disabled"'}>KIT</a>
                        <a href="${malUrl}" target="_blank" ${malUrl ? "" : 'class="disabled"'}>MAL</a>
                        <a href="${annUrl}" target="_blank" ${annUrl ? "" : 'class="disabled"'}>ANN</a>
                        <br>
                        <a href="${url720}" target="_blank" ${url720 ? "" : 'class="disabled"'}>720</a>
                        <a href="${url480}" target="_blank" ${url480 ? "" : 'class="disabled"'}>480</a>
                        <a href="${urlmp3}" target="_blank" ${urlmp3 ? "" : 'class="disabled"'}>MP3</a>
                    </b>
                `);
            }
        }, 1);
    }).bindListener();

    answerStatsWindow = new AMQWindow({
        id: "answerStatsWindow",
        title: "Answer Stats",
        width: 550,
        height: 350,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1001,
        resizable: true,
        draggable: true
    });
    answerStatsWindow.addPanel({
        id: "answerStatsPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    answerHistoryWindow = new AMQWindow({
        id: "answerHistoryWindow",
        title: "Answer History",
        width: 800,
        height: 300,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1003,
        resizable: true,
        draggable: true
    });
    answerHistoryWindow.addPanel({
        id: "answerHistoryPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    answerSpeedWindow = new AMQWindow({
        id: "answerSpeedWindow",
        title: "Average Speed",
        width: 250,
        height: 350,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1002,
        resizable: true,
        draggable: true
    });
    answerSpeedWindow.addPanel({
        id: "answerSpeedPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    answerCompareWindow = new AMQWindow({
        id: "answerCompareWindow",
        title: "Answer Compare",
        width: 600,
        height: 300,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1004,
        resizable: true,
        draggable: true
    });
    answerCompareWindow.addPanel({
        id: "answerComparePanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    anisongdbWindow = new AMQWindow({
        id: "anisongdbWindow",
        title: "AnisongDB Search",
        width: 600,
        height: 400,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1005,
        resizable: true,
        draggable: true
    });
    anisongdbWindow.addPanel({
        id: "anisongdbPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });
    anisongdbWindow.panels[0].panel.append(`
        <div id="anisongdbSearchRow">
            <select id="anisongdbSearchMode">
                <option value="Anime">Anime</option>
                <option value="Artist">Artist</option>
                <option value="Song">Song</option>
                <option value="Composer">Composer</option>
            </select>
            <input id="anisongdbSearchInput" type="text">
            <button id="anisongdbSearchButtonGo">Go</button>
            <label for="anisongdbSearchPartialCheckbox" style="padding: 0 4px 0 0; margin: 0 0 0 10px; vertical-align: middle;">Partial</label><input id="anisongdbSearchPartialCheckbox" type="checkbox">
        </div>
    `);
    $("#anisongdbSearchButtonGo").click(() => {
        let mode = $("#anisongdbSearchMode").val().toLowerCase();
        let query = $("#anisongdbSearchInput").val();
        let partial = $("#anisongdbSearchPartialCheckbox").prop("checked");
        if (query.trim() === "") {
            $("#anisongdbLoading").remove();
            $("#anisongdbTable").remove();
        }
        else {
            getAnisongdbData(mode, query, partial);
        }
    });
    $("#anisongdbSearchInput").keypress((event) => {
        if (event.which === 13) {
            let mode = $("#anisongdbSearchMode").val().toLowerCase();
            let query = $("#anisongdbSearchInput").val();
            let partial = $("#anisongdbSearchPartialCheckbox").prop("checked");
            if (query.trim() === "") {
                $("#anisongdbLoading").remove();
                $("#anisongdbTable").remove();
            }
            else {
                getAnisongdbData(mode, query, partial);
            }
        }
    });
    $("#anisongdbSearchPartialCheckbox").prop("checked", true);

    if (answerHistoryButton) {
        answerStatsWindow.window.find(".modal-header").append($(`<button class="answerStatsHeaderButton">answer<br>history</button>`).click(() => {
            answerHistoryWindow.isVisible() ? answerHistoryWindow.close() : answerHistoryWindow.open();
        }));
        let $div1 = $(`<div>Answer History</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
        let $div2 = $("<div></div>").css("float", "left");
        let $button1 = $(`<button class="arrowButton">⯇</button>`).click(function() {
            if (Object.keys(songHistory).length) {
                let songNumber = answerHistorySettings.songNumber;
                if (songNumber !== Object.values(songHistory)[0].number) {
                    songHistoryFilter = {type: "all"};
                    displaySongHistoryResults(songNumber - 1);
                }
            }
        });
        let $button2 = $(`<button class="arrowButton">⯈</button>`).click(function() {
            if (Object.keys(songHistory).length) {
                let songNumber = answerHistorySettings.songNumber;
                if (songNumber !== Object.values(songHistory).slice(-1)[0].number) {
                    songHistoryFilter = {type: "all"};
                    displaySongHistoryResults(songNumber + 1);
                }
            }
        });
        let $button3 = $(`<button class="backButton">back</button>`).hide().click(function() {
            if (Object.keys(songHistory).length) {
                displaySongHistoryResults(answerHistorySettings.songNumber);
            }
        });
        $div2.append(`<span id="answerHistoryCurrentSong" style="font-size: 16px; margin: 0 8px 0 8px;">Song: </span>`);
        $div2.append($button1);
        $div2.append($button2);
        $div2.append($button3);
        $div2.append($(`<span id="answerHistoryCurrentPlayer" style="font-size: 16px; margin: 0 8px 0 8px;">Player: </span>`).hide());
        answerHistoryWindow.window.find(".modal-header h2").remove();
        answerHistoryWindow.window.find(".modal-header").append($div1);
        answerHistoryWindow.window.find(".modal-header").append($div2);
    }

    if (answerSpeedButton) {
        answerStatsWindow.window.find(".modal-header").append($(`<button class="answerStatsHeaderButton">average<br>speed</button>`).click(() => {
            answerSpeedWindow.isVisible() ? answerSpeedWindow.close() : answerSpeedWindow.open();
        }));
        let $div1 = $(`<div>Average Speed</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
        let $div2 = $(`<div></div>`).css("margin", "0 0 0 8px");
        let $button1 = $(`<button id="averageSpeedSortModeButton">${averageSpeedSort}</button>`).click(function() {
            if (averageSpeedSort === "time") averageSpeedSort = "name";
            else if (averageSpeedSort === "name") averageSpeedSort = "score";
            else if (averageSpeedSort === "score") averageSpeedSort = "time";
            $(this).text(averageSpeedSort);
            displayAnswerSpeedResults();
        });
        let $button2 = $(`<button id="averageSpeedSortDirectionButton">${averageSpeedSortAscending ? "🡅" : "🡇"}</button>`).click(function() {
            averageSpeedSortAscending = !averageSpeedSortAscending;
            $(this).text(averageSpeedSortAscending ? "🡅" : "🡇");
            displayAnswerSpeedResults();
        });
        $div2.append(`<span style="font-size: 16px">Sort:</span>`);
        $div2.append($button1);
        $div2.append($button2);
        answerSpeedWindow.window.find(".modal-header h2").remove();
        answerSpeedWindow.window.find(".modal-header").append($div1);
        answerSpeedWindow.window.find(".modal-header").append($div2);
    }

    if (answerCompareButton) {
        answerStatsWindow.window.find(".modal-header").append($(`<button class="answerStatsHeaderButton">answer<br>compare</button>`).click(() => {
            answerCompareWindow.isVisible() ? answerCompareWindow.close() : answerCompareWindow.open();
        }));
        let $div1 = $(`<div>Answer Compare</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
        let $div2 = $("<div></div>").css({"float": "left", "margin": "3px 0 0 8px"});
        let $input = $(`<input id="answerCompareSearchInput" type="text">`).keypress(function(event) {
            if (event.which === 13) {
                displayAnswerCompareResults($("#answerCompareSearchInput").val());
            }
        });
        let $button = $(`<button id="answerCompareButtonGo">Go</button>"`).click(function() {
            displayAnswerCompareResults($("#answerCompareSearchInput").val());
        });
        $div2.append($input);
        $div2.append($button);
        answerCompareWindow.window.find(".modal-header h2").remove();
        answerCompareWindow.window.find(".modal-header").append($div1);
        answerCompareWindow.window.find(".modal-header").append($div2);
    }

    AMQ_addScriptData({
        name: "Answer Stats",
        author: "kempanator",
        description: `<p>Click the button in the options bar during quiz to open the answer stats window</p>`
    });
    applyStyles();
}

// send anisongdb request
function getAnisongdbData(mode, query, partial) {
    $("#anisongdbTable").remove();
    anisongdbWindow.panels[0].panel.append(`<p id="anisongdbLoading">loading...</p>`);
    let json = {};
    json.and_logic = false;
    json.ignore_duplicate = false;
    json.opening_filter = true;
    json.ending_filter = true;
    json.insert_filter = true;
    if (mode === "anime") json.anime_search_filter = {search: query, partial_match: partial};
    else if (mode === "artist") json.artist_search_filter = {search: query, partial_match: partial, group_granularity: 0, max_other_artist: 99};
    else if (mode === "song") json.song_name_search_filter = {search: query, partial_match: partial};
    else if (mode === "composer") json.composer_search_filter = {search: query, partial_match: partial, arrangement: false};
    fetch("https://anisongdb.com/api/search_request", {
        method: "POST",
        headers: {"Accept": "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(json)
    }).then(res => res.json()).then(json => {
        anisongdbSort = {animeSortAscending: false, artistSortAscending: false, songSortAscending: false, typeSortAscending: false, vintageSortAscending: false};
        $("#anisongdbLoading").remove();
        let $table = $(`
            <table id="anisongdbTable">
                <tr class="headerRow">
                    <th class="anime">Anime</th>
                    <th class="artist">Artist</th>
                    <th class="song">Song</th>
                    <th class="type">Type</th>
                    <th class="vintage">Vintage</th>
                </tr>
            </table>
        `);
        for (let result of json) {
            $table.append(`
                <tr class="bodyRow">
                    <td class="anime">${options.useRomajiNames ? result.animeJPName : result.animeENName}</td>
                    <td class="artist">${result.songArtist}</td>
                    <td class="song">${result.songName}</td>
                    <td class="type">${shortenType(result.songType)}</td>
                    <td class="vintage">${result.animeVintage}</td>
                </tr>
            `);
        }
        $table.on("click", "td", (event) => {
            if (event.target.classList.contains("anime")) {
                getAnisongdbData("anime", event.target.innerText);
            }
            else if (event.target.classList.contains("artist")) {
                getAnisongdbData("artist", event.target.innerText);
            }
            else if (event.target.classList.contains("song")) {
                getAnisongdbData("song", event.target.innerText);
            }
        });
        $table.find("th.anime").click(() => {
            sortAnisongdbTableEntries($table, "anime", anisongdbSort.animeSortAscending);
            anisongdbSort.animeSortAscending = !anisongdbSort.animeSortAscending;
            anisongdbSort.artistSortAscending = false;
            anisongdbSort.songSortAscending = false;
            anisongdbSort.typeSortAscending = false;
            anisongdbSort.vintageSortAscending = false;
        });
        $table.find("th.artist").click(() => {
            sortAnisongdbTableEntries($table, "artist", anisongdbSort.artistSortAscending);
            anisongdbSort.animeSortAscending = false;
            anisongdbSort.artistSortAscending = !anisongdbSort.artistSortAscending;
            anisongdbSort.songSortAscending = false;
            anisongdbSort.typeSortAscending = false;
            anisongdbSort.vintageSortAscending = false;
        });
        $table.find("th.song").click(() => {
            sortAnisongdbTableEntries($table, "song", anisongdbSort.songSortAscending);
            anisongdbSort.animeSortAscending = false;
            anisongdbSort.artistSortAscending = false;
            anisongdbSort.songSortAscending = !anisongdbSort.songSortAscending;
            anisongdbSort.typeSortAscending = false;
            anisongdbSort.vintageSortAscending = false;
        });
        $table.find("th.type").click(() => {
            sortAnisongdbTableEntries($table, "type", anisongdbSort.typeSortAscending);
            anisongdbSort.animeSortAscending = false;
            anisongdbSort.artistSortAscending = false;
            anisongdbSort.songSortAscending = false;
            anisongdbSort.typeSortAscending = !anisongdbSort.typeSortAscending;
            anisongdbSort.vintageSortAscending = false;
        });
        $table.find("th.vintage").click(() => {
            sortAnisongdbTableEntries($table, "vintage", anisongdbSort.vintageSortAscending);
            anisongdbSort.animeSortAscending = false;
            anisongdbSort.artistSortAscending = false;
            anisongdbSort.songSortAscending = false;
            anisongdbSort.typeSortAscending = false;
            anisongdbSort.vintageSortAscending = !anisongdbSort.vintageSortAscending;
        });
        anisongdbWindow.panels[0].panel.append($table);
    });
}

// display average time list in time track window
function displayAnswerSpeedResults() {
    answerSpeedWindow.window.find("#averageSpeedResults").remove();
    let sortedIds;
    if (averageSpeedSort === "time") {
        sortedIds = averageSpeedSortAscending
            ? Object.keys(answerHistory).sort((a, b) => answerHistory[a].averageTime - answerHistory[b].averageTime)
            : Object.keys(answerHistory).sort((a, b) => answerHistory[b].averageTime - answerHistory[a].averageTime);
    }
    else if (averageSpeedSort === "name") {
        sortedIds = averageSpeedSortAscending
            ? Object.keys(answerHistory).sort((a, b) => answerHistory[a].name.localeCompare(answerHistory[b].name))
            : Object.keys(answerHistory).sort((a, b) => answerHistory[b].name.localeCompare(answerHistory[a].name));
    }
    else if (averageSpeedSort === "score") {
        sortedIds = averageSpeedSortAscending
            ? Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat().reverse()
            : Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat();
    }
    let $results = $(`<div id="averageSpeedResults"></div>`);
    for (let id of sortedIds) {
        let player = answerHistory[id];
        if (player) {
            let $row = $("<div></div>");
            $row.append(`<span class="trackTime">${Math.round(player.averageTime)}</span>`);
            //$row.append(`<span class="trackTime">${Math.round(player.standardDeviation)}</span>`);
            $row.append($(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`).click(() => {
                playerProfileController.loadProfile(player.name, $("#answerSpeedWindow"), {}, () => {}, false, true);
            }));
            $row.append($(`<span class="trackName clickAble">${player.name}</span>`).click(() => {
                displayPlayerHistoryResults(id);
                answerHistoryWindow.open();
            }));
            $row.append(`<span class="trackScore">${player.score}</span>`);
            $results.append($row);
        }
    }
    answerSpeedWindow.panels[0].panel.append($results);
}

// create a table with each row being 1 player
function displaySongHistoryResults(songNumber) {
    if (!songHistory[songNumber]) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentSong").text("Song: " + songNumber);
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").hide();
    answerHistoryWindow.window.find(".arrowButton").show();
    answerHistoryWindow.window.find("#answerHistoryTable").remove();
    let $table = $(`
        <table id="answerHistoryTable" class="songMode">
            <tr class="headerRow">
                <th class="rank clickAble">Rank</th>
                <th class="box clickAble">Box</th>
                <th class="score clickAble">Score</th>
                <th class="level clickAble">Level</th>
                <th class="name clickAble">Name</th>
                <th class="speed clickAble">Speed</th>
                <th class="answer clickAble">Answer</th>
            </tr>
        </table>
    `);
    let sortedKeys; 
    if (songHistorySort.rankSortAscending !== null) {
        if (songHistorySort.rankSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].answers[songNumber].rank - answerHistory[b].answers[songNumber].rank);
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].answers[songNumber].rank - answerHistory[a].answers[songNumber].rank);
    }
    else if (songHistorySort.boxSortAscending !== null) {
        if (songHistorySort.boxSortAscending) sortedKeys = Object.values(songHistory[songNumber].groupSlotMap).flat();
        else sortedKeys = Object.values(songHistory[songNumber].groupSlotMap).flat().reverse();
    }
    else if (songHistorySort.scoreSortAscending !== null) {
        if (songHistorySort.scoreSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].answers[songNumber].score - answerHistory[b].answers[songNumber].score);
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].answers[songNumber].score - answerHistory[a].answers[songNumber].score);
    }
    else if (songHistorySort.levelSortAscending !== null) {
        if (songHistorySort.levelSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].level - answerHistory[b].level);
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].level - answerHistory[a].level);
    }
    else if (songHistorySort.nameSortAscending !== null) {
        if (songHistorySort.nameSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].name.localeCompare(answerHistory[b].name));
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].name.localeCompare(answerHistory[a].name));
    }
    else if (songHistorySort.speedSortAscending !== null) {
        if (songHistorySort.speedSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].answers[songNumber].speed - answerHistory[b].answers[songNumber].speed);
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].answers[songNumber].speed - answerHistory[a].answers[songNumber].speed);
    }
    else if (songHistorySort.answerSortAscending !== null) {
        if (songHistorySort.answerSortAscending) sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[a].answers[songNumber].text.localeCompare(answerHistory[b].answers[songNumber].text));
        else sortedKeys = Object.keys(answerHistory).sort((a, b) => answerHistory[b].answers[songNumber].text.localeCompare(answerHistory[a].answers[songNumber].text));
    }
    for (let id of sortedKeys) {
        let player = answerHistory[id];
        if (player) {
            let answer = player.answers[songNumber];
            if (answer) {
                if (songHistoryFilter.type === "all" || (songHistoryFilter.type === "allCorrectAnswers" && answer.correct) || (songHistoryFilter.type === "allWrongAnswers" && !answer.correct) ||
                (songHistoryFilter.type === "answer" && songHistoryFilter.answer.toLowerCase() === answer.text.toLowerCase()) || (songHistoryFilter.type === "noAnswers" && answer.noAnswer) ||
                (songHistoryFilter.type === "uniqueValidWrongAnswers" && answer.uniqueAnswer) || (songHistoryFilter.type === "invalidAnswers" && answer.invalidAnswer)) {
                    $table.append(`
                        <tr class="bodyRow">
                            <td class="rank">${answer.rank}</td>
                            <td class="box clickAble">${findBoxById(player.id, songHistory[songNumber].groupSlotMap)}</td>
                            <td class="score">${answer.score}</td>
                            <td class="level">${player.level}</td>
                            <td class="name clickAble"><i class="fa fa-id-card-o clickAble" aria-hidden="true" onclick="playerProfileController.loadProfile('${player.name}', $('#answerHistoryWindow'), {}, () => {}, false, true)"></i>${player.name}</td>
                            <td class="speed">${answer.speed ? answer.speed : ""}</td>
                            <td class="answer clickAble"><i class="fa ${answer.correct ? "fa-check" : "fa-times"}"></i>${answer.text}</td>
                        </tr>
                    `);
                }
            }
        }
    }
    $table.on("click", "th", (event) => {
        if (event.target.classList.contains("rank")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = !songHistorySort.boxSortAscending;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("box")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = !songHistorySort.boxSortAscending;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("score")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = !songHistorySort.boxSortAscending;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("level")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = null;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = !songHistorySort.levelSortAscending;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("name")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = null;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = !songHistorySort.nameSortAscending;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("speed")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = null;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = !songHistorySort.speedSortAscending;
            songHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("answer")) {
            songHistorySort.rankSortAscending = null;
            songHistorySort.boxSortAscending = null;
            songHistorySort.scoreSortAscending = null;
            songHistorySort.levelSortAscending = null;
            songHistorySort.nameSortAscending = null;
            songHistorySort.speedSortAscending = null;
            songHistorySort.answerSortAscending = !songHistorySort.answerSortAscending;
        }
        displaySongHistoryResults(answerHistorySettings.songNumber);
    });
    $table.on("click", "td", (event) => {
        if (event.target.classList.contains("name")) {
            displayPlayerHistoryResults(Object.values(answerHistory).find((player) => player.name === event.target.innerText).id);
        }
        else if (event.target.classList.contains("box")) {
            selectAvatarGroup(parseInt(event.target.innerText));
        }
        else if (event.target.classList.contains("answer")) {
            songHistoryFilter = {type: "answer", answer: event.target.innerText};
            displaySongHistoryResults(answerHistorySettings.songNumber);
        }
    });
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "song";
    answerHistorySettings.songNumber = songNumber;
}

// create a table with each row being 1 answer
function displayPlayerHistoryResults(id) {
    let player = answerHistory[id];
    if (!player) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer").text("Player: " + player.name);
    answerHistoryWindow.window.find(".arrowButton").hide();
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").show();
    answerHistoryWindow.window.find("#answerHistoryTable").remove();
    let $table = $(`
        <table id="answerHistoryTable" class="playerMode">
            <tr class="headerRow">
                <th class="songNumber clickAble">#</th>
                <th class="songDifficulty clickAble">Dif</th>
                <th class="speed clickAble">Speed</th>
                <th class="answer clickAble">Answer</th>
            </tr>
        </table>
    `);
    let sortedKeys;
    let answers = player.answers;
    if (playerHistorySort.numberSortAscending !== null) {
        if (playerHistorySort.numberSortAscending) sortedKeys = Object.keys(answers).sort((a, b) => answers[a].number - answers[b].number);
        else sortedKeys = Object.keys(answers).sort((a, b) => answers[b].number - answers[a].number);
    }
    else if (playerHistorySort.difSortAscending !== null) {
        if (playerHistorySort.difSortAscending) sortedKeys = Object.keys(answers).sort((a, b) => songHistory[a].difficulty - songHistory[b].difficulty);
        else sortedKeys = sortedKeys = Object.keys(answers).sort((a, b) => songHistory[b].difficulty - songHistory[a].difficulty);
    }
    else if (playerHistorySort.speedSortAscending !== null) {
        if (playerHistorySort.speedSortAscending) sortedKeys = Object.keys(answers).sort((a, b) => answers[a].speed - answers[b].speed);
        else sortedKeys = Object.keys(answers).sort((a, b) => answers[b].speed - answers[a].speed);
    }
    else if (playerHistorySort.answerSortAscending !== null) {
        if (playerHistorySort.answerSortAscending) sortedKeys = Object.keys(answers).sort((a, b) => answers[a].text.localeCompare(answers[b].text));
        else sortedKeys = Object.keys(answers).sort((a, b) => answers[b].text.localeCompare(answers[a].text));
    }
    for (let songNumber of sortedKeys) {
        let answer = player.answers[songNumber];
        $table.append(`
            <tr class="bodyRow">
                <td class="songNumber clickAble">${songNumber}</td>
                <td class="songDifficulty">${songHistory[songNumber].difficulty}</td>
                <td class="speed">${answer.speed ? answer.speed : ""}</td>
                <td class="answer"><i class="fa ${answer.correct ? "fa-check" : "fa-times"}"></i>${answer.text}</td>
            </tr>
        `);
    }
    $table.on("click", "th", (event) => {
        if (event.target.classList.contains("songNumber")) {
            playerHistorySort.numberSortAscending = !playerHistorySort.numberSortAscending;
            playerHistorySort.difSortAscending = null;
            playerHistorySort.speedSortAscending = null;
            playerHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("songDifficulty")) {
            playerHistorySort.numberSortAscending = null;
            playerHistorySort.difSortAscending = !playerHistorySort.difSortAscending;
            playerHistorySort.speedSortAscending = null;
            playerHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("speed")) {
            playerHistorySort.numberSortAscending = null;
            playerHistorySort.difSortAscending = null;
            playerHistorySort.speedSortAscending = !playerHistorySort.speedSortAscending;
            playerHistorySort.answerSortAscending = null;
        }
        else if (event.target.classList.contains("answer")) {
            playerHistorySort.numberSortAscending = null;
            playerHistorySort.difSortAscending = null;
            playerHistorySort.speedSortAscending = null;
            playerHistorySort.answerSortAscending = !playerHistorySort.answerSortAscending;
        }
        displayPlayerHistoryResults(answerHistorySettings.playerId);
    });
    $table.on("click", "td", (event) => {
        if (event.target.classList.contains("songNumber")) {
            songHistoryFilter = {type: "all"};
            displaySongHistoryResults(parseInt(event.target.innerText));
        }
    });
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "player";
    answerHistorySettings.playerId = id;
}

function displayAnswerCompareResults(text) {
    let players = text.split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase());
    answerCompareWindow.panels[0].clear();
    if (players.length < 2) {
        answerCompareWindow.panels[0].panel.append(`<p>Please add 2 or more players</p>`);
        return;
    }
    let idList = [];
    for (let name of players) {
        let item = Object.values(answerHistory).find((x) => x.name.toLowerCase() === name);
        if (item) {
            idList.push(item.id);
        }
        else {
            answerCompareWindow.panels[0].panel.append(`<p>Not found: ${name}</p>`);
            return;
        }
    }
    let $table = $(`<table id="answerCompareTable">`);
    let $headerRow = $(`<tr class="headerRow">`);
    for (let player of players) {
        $headerRow.append(`<th>${player}</th>`);
    }
    $table.append($headerRow);
    for (let songNumber of Object.keys(songHistory)) {
        let answers = [];
        for (let id of idList) {
            let answer = answerHistory[id].answers[songNumber];
            answer ? answers.push(answer) : answers.push(null);
        }
        if (answers.filter(Boolean).length > 0) {
            let $row = $("<tr></tr>");
            for (let answer of answers) {
                if (answer) $row.append(`<td><i class="fa ${answer.correct ? "fa-check" : "fa-times"}"></i>${answer.text}</td>`);
                else $row.append("<td></td>");
            }
            $table.append($row);
        }
    }
    answerCompareWindow.panels[0].panel.append($table);
}

// input table element, column name, and sort ascending boolean
function sortAnisongdbTableEntries($table, column, sortAscending) {
    let sortedElements = sortAscending
        ? $table.find("tr.bodyRow").toArray().sort((a, b) => $(b).find("td." + column).text().localeCompare($(a).find("td." + column).text()))
        : $table.find("tr.bodyRow").toArray().sort((a, b) => $(a).find("td." + column).text().localeCompare($(b).find("td." + column).text()));
    sortedElements.forEach((element) => { $table.append(element) });
}

function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// set undefined and glitched out speed times to null
function validateSpeed(speed) {
    return (speed && speed < 100000) ? speed : null;
}

function typeText(type, typeNumber) {
    if (type === 1) return "OP" + typeNumber;
    if (type === 2) return "ED" + typeNumber;
    if (type === 3) return "IN";
};

function rankedText() {
    let region = regionDictionary[$("#mpRankedTimer h3").text()] || "";
    let type = hostModal.getSettings().roomName;
    return region + " " + type;
}

function getScore(player) {
    if (quiz.scoreboard.scoreType === 1) return player.score;
    if (quiz.scoreboard.scoreType === 2) return player.correctGuesses;
    if (quiz.scoreboard.scoreType === 3) return player.correctGuesses;
}

function resetHistory() {
    songHistory = {};
    answerHistory = {};
}

function findBoxById(id, groupSlotMap) {
    return Object.keys(groupSlotMap).find((key) => groupSlotMap[key].indexOf(id) !== -1);
}

function selectAvatarGroup(number) {
	quiz.avatarContainer.currentGroup = number;
	quiz.scoreboard.setActiveGroup(number);
	if (Object.keys(quiz.scoreboard.groups).length > 1) {
		quiz.scoreboard.$quizScoreboardItemContainer.stop().scrollTop(quiz.scoreboard.groups[number].topOffset - 3);
	}
}

function downloadAverageAnswerTimes() {
    let date = new Date();
    let fileName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, 0)}-${String(date.getDate()).padStart(2, 0)} ${String(date.getHours()).padStart(2, 0)}:${String(date.getMinutes()).padStart(2, 0)}:${String(date.getSeconds()).padStart(2, 0)} average answer times`;
    let text = "";
    Object.values(answerHistory).forEach((player) => { text += `${player.averageTime} ${player.name} ${player.score}\n` });
    let data = "data:text/json;charset=utf-8," + encodeURIComponent(text);
    let element = document.createElement("a");
    element.setAttribute("href", data);
    element.setAttribute("download", fileName);
    document.body.appendChild(element);
    element.click();
    element.remove();
}

// apply styles
function applyStyles() {
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "answerStatsStyle";
    style.appendChild(document.createTextNode(`
        #qpAnswerStats {
            width: 30px;
            margin-right: 5px;
        }
        #answerStatsWindow .modal-header h2 {
            float: left;
        }
        .answerStatsRow {
            margin: 0 2px;
        }
        .answerStatsNumber {
            opacity: .7;
            margin-left: 8px;
        }
        #answerStatsAnisongdbSearchRow {
            margin-bottom: 10px;
        }
        #answerStatsAnisongdbSearchButtonAnime, #answerStatsAnisongdbSearchButtonArtist {
            background: #D9D9D9;
            color: #1B1B1B;
            border: 1px solid #6D6D6D;
            border-radius: 4px;
            margin-top: 3px;
            padding: 2px 5px;
            font-weight: bold;
        }
        #answerStatsAnisongdbSearchButtonAnime:hover, #answerStatsAnisongdbSearchButtonArtist:hover {
            opacity: .8;
        }
        #answerStatsUrls a {
            margin: 0 2px;
        }
        #qpExtraSongInfo {
            z-index: 1;
        }
        #anisongdbWindow select {
            color: black;
            padding: 2px 0;
        }
        #anisongdbSearchInput {
            color: black;
            width: 300px;
            padding: 0 2px;
        }
        #anisongdbWindow input[type="checkbox"] {
            width: 17px;
            height: 17px;
            margin: 0;
            vertical-align: middle;
        }
        #anisongdbWindow button {
            color: black;
            padding: 0 5px;
        }
        #anisongdbSearchRow {
            margin: 2px;
        }
        #anisongdbTable {
            width: 100%;
        }
        #anisongdbTable th, #anisongdbTable td {
            padding: 0 2px;
        }
        #anisongdbTable tr:nth-child(odd) {
            background-color: #353535;
        }
        #anisongdbTable tr:nth-child(even) {
            background-color: #424242;
        }
        #anisongdbTable tr.headerRow {
            background-color: #282828;
            font-weight: bold;
        }
        #anisongdbTable tr.headerRow {
            cursor: pointer;
            user-select: none;
        }
        #anisongdbTable tr.bodyRow:hover {
            color: #70B7FF;
        }
        #anisongdbTable .anime {
            width: 25%;
        }
        #anisongdbTable .artist {
            width: 25%;
        }
        #anisongdbTable .song {
            width: 25%;
        }
        #anisongdbTable .type {
            width: 10%;
        }
        #anisongdbTable .vintage {
            width: 15%;
        }
        .answerStatsHeaderButton {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            line-height: normal;
            font-weight: bold;
            margin-left: 15px;
            padding: 4px 5px;
            float: left;
            user-select: none;
        }
        .answerStatsHeaderButton:hover {
            opacity: .8;
        }
        #answerSpeedWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #answerSpeedWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerSpeedWindow .modal-header button {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            font-weight: bold;
            margin: 5px 0px 5px 5px;
            padding: 0px 5px;
            user-select: none;
        }
        #answerSpeedWindow .modal-header button:hover {
            opacity: .8;
        }
        #averageSpeedResults {
            cursor: auto;
        }
        #answerSpeedWindow span.trackTime {
            width: 48px;
            display: inline-block;
        }
        #answerSpeedWindow i.fa {
            margin-right: 3px;
            display: inline-block;
        }
        #answerSpeedWindow span.trackName {
            display: inline-block;
        }
        #answerSpeedWindow span.trackScore {
            opacity: .7;
            margin-left: 8px;
            display: inline-block;
        }
        #answerHistoryWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #answerHistoryWindow .modal-header h2 {
            float: left;
        }
        #answerHistoryWindow .modal-header button {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            font-weight: bold;
            margin: 5px 2px 5px 2px;
            padding: 0px 5px;
            user-select: none;
        }
        #answerHistoryWindow .modal-header button:hover {
            opacity: .8;
        }
        #answerHistoryWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerHistoryTable {
            width: 100%;
        }
        #answerHistoryTable tr:nth-child(odd) {
            background-color: #353535;
        }
        #answerHistoryTable tr:nth-child(even) {
            background-color: #424242;
        }
        #answerHistoryTable tr.headerRow {
            background-color: #282828;
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        #answerHistoryTable.songMode .rank {
            width: 6%;
        }
        #answerHistoryTable.songMode .box {
            width: 6%;
        }
        #answerHistoryTable.songMode .level {
            width: 6%;
        }
        #answerHistoryTable.songMode .name {
            width: 20%;
        }
        #answerHistoryTable.songMode .score {
            width: 6%;
        }
        #answerHistoryTable.songMode .speed {
            width: 8%;
        }
        #answerHistoryTable.songMode .answer {
            width: 48%;
        }
        #answerHistoryTable.playerMode .songNumber {
            width: 6%;
        }
        #answerHistoryTable.playerMode .songDifficulty {
            width: 6%;
        }
        #answerHistoryTable.playerMode .speed {
            width: 8%;
        }
        #answerHistoryTable.playerMode .answer {
            width: 80%;
        }
        #answerHistoryTable i.fa-id-card-o {
            margin-right: 3px;
        }
        #answerHistoryTable i.fa-check {
            color: #00C900;
            margin-right: 5px;
        }
        #answerHistoryTable i.fa-times {
            color: #FD3900;
            margin-right: 8px;
        }
        #answerCompareWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #answerCompareSearchInput {
            color: black;
            width: 300px;
            padding: 0 2px;
        }
        #answerCompareWindow .modal-header button {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            font-weight: bold;
            margin: 5px 0px 5px 5px;
            padding: 0px 5px;
            user-select: none;
        }
        #answerCompareWindow .modal-header button:hover {
            opacity: .8;
        }
        #answerCompareWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerCompareTable {
            width: 100%;
        }
        #answerCompareTable tr:nth-child(odd) {
            background-color: #353535;
        }
        #answerCompareTable tr:nth-child(even) {
            background-color: #424242;
        }
        #answerCompareTable tr.headerRow {
            background-color: #282828;
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        #answerCompareTable i.fa-check {
            color: #00C900;
            margin-right: 5px;
        }
        #answerCompareTable i.fa-times {
            color: #FD3900;
            margin-right: 8px;
        }
    `));
    document.head.appendChild(style);
}
