// ==UserScript==
// @name         AMQ Answer Stats
// @namespace    https://github.com/kempanator
// @version      0.6
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
2. Add a window for anisongdb search results
3. Add a window to track average guess time for players' correct answers
2. Add anisongdb anime and artist lookup buttons to song info
3. Add anilist, kitsu, myanimelist, annid, 720, 480, mp3 links to song info
4. Extra song info button is always visible
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.6";
let answerStatsWindow;
let answerTimeTrackWindow;
let anisongdbWindow;
let answers = {}; //{1: {name, answer, correct}, ...}
let songHistory = []; //[{romaji, english, number, type, difficulty}, ...]
let answerHistory = {}; //{1: {name, averageTime, totalTime, score, correctAnswers, wrongAnswers}, ...}
let listLowerCase = [];
let timeTrackButton = true;
let anisongdbSearchButtons = true;
let allSourceLinks = true;
let animeSortAscending = false;
let artistSortAscending = false;
let songSortAscending = false;
let typeSortAscending = false;
let vintageSortAscending = false;
let timeTrackSort = "time"; //"time" "name" "score"
let timeTrackSortAscending = false;

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
    new Listener("Join Game", () => {
        resetHistory();
    }).bindListener();
    new Listener("Spectate Game", () => {
        resetHistory();
    }).bindListener();
    new Listener("player answers", (payload) => {
        //console.log(payload);
        if (!quiz.answerInput.typingInput.autoCompleteController.list.length) quiz.answerInput.typingInput.autoCompleteController.updateList();
        answers = {};
        for (let item of payload.answers) {
            answers[item.gamePlayerId] = {name: quiz.players[item.gamePlayerId]._name, answer: item.answer};
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        //console.log(payload);
        //console.log(amqAnswerTimesUtility);
        if (Object.keys(answers).length === 0) return;
        if (listLowerCase.length === 0) return;
        let correctPlayers = {}; //{name: answer speed, ...}
        let correctAnswerCount = {}; //{title: # of people who answered, ...}
        let incorrectAnswerCount = {}; //{title: # of people who answered, ...}
        let otherAnswerCount = 0;
        let invalidAnswerCount = 0;
        let noAnswerCount = 0;
        payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).forEach((anime) => { correctAnswerCount[anime] = 0 });
        for (let player of payload.players) {
            let quizPlayer = answers[player.gamePlayerId];
            if (quizPlayer) {
                quizPlayer.correct = player.correct;
                if (player.correct) {
                    let speed = amqAnswerTimesUtility.playerTimes[player.gamePlayerId];
                    correctPlayers[answers[player.gamePlayerId].name] = speed;
                    if (speed && speed < 100000) {
                        let item = answerHistory[player.gamePlayerId];
                        if (item) {
                            item.averageTime = (item.totalTime + speed) / (item.correctAnswers.length + 1);
                            item.totalTime = item.totalTime + speed;
                            item.correctAnswers.push(songHistory.length);
                            item.score = getScore(player);
                        }
                        else {
                            answerHistory[player.gamePlayerId] = {
                                name: quizPlayer.name,
                                averageTime: speed,
                                totalTime: speed,
                                correctAnswers: [songHistory.length],
                                wrongAnswers: [],
                                score: getScore(player)
                            };
                        }
                    }
                }
                else {
                    let item = answerHistory[player.gamePlayerId];
                    if (item) {
                        item.wrongAnswers.push(songHistory.length);
                    }
                    else {
                        answerHistory[player.gamePlayerId] = {
                            name: quizPlayer.name,
                            averageTime: 0,
                            totalTime: 0,
                            correctAnswers: [],
                            wrongAnswers: [songHistory.length],
                            score: getScore(player)
                        };
                    }
                }
            }
            else {
                console.log("player id not found: " + player.gamePlayerId);
                console.log(payload);
            }
        }
        for (let player of Object.values(answers)) {
            if (player.answer === "") {
                noAnswerCount++;
            }
            else {
                let answerLowerCase = player.answer.toLowerCase();
                let index = Object.keys(correctAnswerCount).findIndex((value) => answerLowerCase === value.toLowerCase());
                if (index > -1) {
                    correctAnswerCount[Object.keys(correctAnswerCount)[index]]++;
                }
                else {
                    index = listLowerCase.findIndex((value) => answerLowerCase === value);
                    if (index > -1) {
                        let wrongAnime = quiz.answerInput.typingInput.autoCompleteController.list[index];
                        incorrectAnswerCount[wrongAnime] ? incorrectAnswerCount[wrongAnime]++ : incorrectAnswerCount[wrongAnime] = 1;
                    }
                    else {
                        invalidAnswerCount++;
                    }
                }
            }
        }
        let numCorrect = Object.keys(correctPlayers).length;
        let averageTime = numCorrect ? Math.round(Object.values(correctPlayers).reduce((a, b) => a + b) / numCorrect) : null;
        let fastestTime = numCorrect ? Math.min(...Object.values(correctPlayers)) : null;
        let fastestPlayers = Object.keys(correctPlayers).filter((name) => correctPlayers[name] === fastestTime);
        Object.keys(incorrectAnswerCount).forEach((x) => { if (incorrectAnswerCount[x] === 1) otherAnswerCount++ });
        let correctSortedKeys = Object.keys(correctAnswerCount).sort((a, b) => correctAnswerCount[b] - correctAnswerCount[a]);
        let incorrectSortedKeys = Object.keys(incorrectAnswerCount).sort((a, b) => incorrectAnswerCount[b] - incorrectAnswerCount[a]);
        songHistory.push({
            romaji: payload.songInfo.animeNames.romaji,
            english: payload.songInfo.animeNames.english,
            number: quiz.infoContainer.$currentSongCount.text(),
            type: typeText(payload.songInfo.type, payload.songInfo.typeNumber),
            difficulty: Math.round(payload.songInfo.animeDifficulty)
        });
        answers = {};

        setTimeout(() => {
            let totalPlayers = $("#qpScoreBoardEntryContainer .qpStandingItem").length;
            let activePlayers = $("#qpScoreBoardEntryContainer .qpStandingItem:not(.disabled)").length;
            answerStatsWindow.panels[0].clear();
            if (quiz.gameMode === "Ranked") {
                answerStatsWindow.panels[0].panel.append(`
                    <div style="margin: 0 3px">
                        <span><b>${rankedText()}</b></span>
                        <span style="margin-left: 20px"><b>Song:</b> ${quiz.infoContainer.$currentSongCount.text()}/${quiz.infoContainer.$totalSongCount.text()}</span>
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
            let $ulCorrect = $(`<ul><b>Correct Answers:</b></ul>`).css("margin", "10px 3px 0 3px");
            for (let anime of correctSortedKeys) {
                if (correctAnswerCount[anime] > 0) {
                    $ulCorrect.append(`<li>${anime}<span class="answerStatsNumber">${correctAnswerCount[anime]}</span></li>`);
                }
            }
            let $ulWrong = $(`<ul><b>Wrong Answers:</b></ul>`).css("margin", "10px 3px 0 3px");
            for (let anime of incorrectSortedKeys) {
                if (incorrectAnswerCount[anime] > 1) {
                    $ulWrong.append(`<li>${anime}<span class="answerStatsNumber">${incorrectAnswerCount[anime]}</span></li>`);
                }
            }
            if (otherAnswerCount > 0) {
                $ulWrong.append(`<li>Other Answer<span class="answerStatsNumber">${otherAnswerCount}</span></li>`);
            }
            if (invalidAnswerCount > 0) {
                $ulWrong.append(`<li>Invalid Answer<span class="answerStatsNumber">${invalidAnswerCount}</span></li>`);
            }
            if (noAnswerCount > 0) {
                $ulWrong.append(`<li>No Answer<span class="answerStatsNumber">${noAnswerCount}</span></li>`);
            }
            answerStatsWindow.panels[0].panel.append($ulCorrect);
            answerStatsWindow.panels[0].panel.append($ulWrong);

            if (timeTrackButton) {
                displayTimeTrackResults();
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
                let aniListUrl = payload.songInfo.siteIds.aniListId ? options.ANIME_LIST_BASE_URL.ANILIST + payload.songInfo.siteIds.aniListId : "";
                let kitsuUrl = payload.songInfo.siteIds.kitsuId ? options.ANIME_LIST_BASE_URL.KTISU + payload.songInfo.siteIds.kitsuId : ""; //thanks egerod
                let malUrl = payload.songInfo.siteIds.malId ? options.ANIME_LIST_BASE_URL.MAL + payload.songInfo.siteIds.malId : "";
                let annUrl = payload.songInfo.siteIds.annId ? options.ANIME_LIST_BASE_URL.ANN + payload.songInfo.siteIds.annId : "";
                let url720 = "", url480 = "", urlmp3 = "";
                if (payload.songInfo.urlMap.catbox && payload.songInfo.urlMap.catbox[720]) url720 = payload.songInfo.urlMap.catbox[720];
                else if (payload.songInfo.urlMap.openingsmoe && payload.songInfo.urlMap.openingsmoe[720]) url720 = payload.songInfo.urlMap.openingsmoe[720];
                if (payload.songInfo.urlMap.catbox && payload.songInfo.urlMap.catbox[480]) url480 = payload.songInfo.urlMap.catbox[480];
                else if (payload.songInfo.urlMap.openingsmoe && payload.songInfo.urlMap.openingsmoe[480]) url480 = payload.songInfo.urlMap.openingsmoe[480];
                if (payload.songInfo.urlMap.catbox && payload.songInfo.urlMap.catbox[0]) urlmp3 = payload.songInfo.urlMap.catbox[0];
                else if (payload.songInfo.urlMap.openingsmoe && payload.songInfo.urlMap.openingsmoe[0]) urlmp3 = payload.songInfo.urlMap.openingsmoe[0];                
                $("#qpSongInfoLinkRow").prepend(`
                    <b id="answerStatsUrls">
                        <a href="${aniListUrl}" target="_blank" ${aniListUrl ? "" : 'class="disabled"'}>ANI</a>
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
        width: 450,
        height: 300,
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

    answerTimeTrackWindow = new AMQWindow({
        id: "answerTimeTrackWindow",
        title: "Time Track",
        width: 250,
        height: 300,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1002,
        resizable: true,
        draggable: true
    });
    answerTimeTrackWindow.addPanel({
        id: "answerTimeTrackPanel",
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
        zIndex: 1003,
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

    if (timeTrackButton) {
        answerStatsWindow.window.find(".modal-header").prepend($(`<button id="answerStatsTimeTrackButton">time<br>track</button>`).click(() => {
            answerTimeTrackWindow.isVisible() ? answerTimeTrackWindow.close() : answerTimeTrackWindow.open();
        }));
        answerStatsWindow.window.find("#answerStatsTimeTrackButton").popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            content: "track average guess time of all players' correct answers"
        });
        let $div1 = $(`<div>Time Track</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
        let $div2 = $(`<div></div>`).css("margin", "0 0 0 8px");
        let $button1 = $(`<button id="timeTrackSortModeButton">${timeTrackSort}</button>`).click(function() {
            if (timeTrackSort === "time") timeTrackSort = "name";
            else if (timeTrackSort === "name") timeTrackSort = "score";
            else if (timeTrackSort === "score") timeTrackSort = "time";
            $(this).text(timeTrackSort);
            displayTimeTrackResults();
        });
        let $button2 = $(`<button id="timeTrackSortDirectionButton">${timeTrackSortAscending ? "🡅" : "🡇"}</button>`).click(function() {
            timeTrackSortAscending = !timeTrackSortAscending;
            $(this).text(timeTrackSortAscending ? "🡅" : "🡇");
            displayTimeTrackResults();
        });
        $div2.append(`<span style="font-size: 16px">Sort:</span>`);
        $div2.append($button1);
        $div2.append($button2);
        answerTimeTrackWindow.window.find(".modal-header h2").remove();
        answerTimeTrackWindow.window.find(".modal-header").append($div1);
        answerTimeTrackWindow.window.find(".modal-header").append($div2);
        answerTimeTrackWindow.window.popover({container: "#gameContainer", placement: "right", trigger: "manual", html: true});
        answerTimeTrackWindow.window.data("bs.popover").tip().addClass("timeTrackAnswersPopover");
        answerTimeTrackWindow.window.mousedown(() => { $(".timeTrackAnswersPopover").remove() });
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
        //console.log(json);
        animeSortAscending = false;
        artistSortAscending = false;
        songSortAscending = false;
        typeSortAscending = false;
        vintageSortAscending = false;
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
            sortAnisongdbTableEntries($table, "anime", animeSortAscending);
            animeSortAscending = !animeSortAscending;
            artistSortAscending = false;
            songSortAscending = false;
            typeSortAscending = false;
            vintageSortAscending = false;
        });
        $table.find("th.artist").click(() => {
            sortAnisongdbTableEntries($table, "artist", artistSortAscending);
            animeSortAscending = false;
            artistSortAscending = !artistSortAscending;
            songSortAscending = false;
            typeSortAscending = false;
            vintageSortAscending = false;
        });
        $table.find("th.song").click(() => {
            sortAnisongdbTableEntries($table, "song", songSortAscending);
            animeSortAscending = false;
            artistSortAscending = false;
            songSortAscending = !songSortAscending;
            typeSortAscending = false;
            vintageSortAscending = false;
        });
        $table.find("th.type").click(() => {
            sortAnisongdbTableEntries($table, "type", typeSortAscending);
            animeSortAscending = false;
            artistSortAscending = false;
            songSortAscending = false;
            typeSortAscending = !typeSortAscending;
            vintageSortAscending = false;
        });
        $table.find("th.vintage").click(() => {
            sortAnisongdbTableEntries($table, "vintage", vintageSortAscending);
            animeSortAscending = false;
            artistSortAscending = false;
            songSortAscending = false;
            typeSortAscending = false;
            vintageSortAscending = !vintageSortAscending;
        });
        anisongdbWindow.panels[0].panel.append($table);
    });
}

// display average time list in time track window
function displayTimeTrackResults() {
    $(".timeTrackAnswersPopover").remove();
    answerTimeTrackWindow.window.find("#timeTrackResults").remove();
    let sortedIds;
    if (timeTrackSort === "time") {
        sortedIds = timeTrackSortAscending
            ? Object.keys(answerHistory).sort((a, b) => answerHistory[a].averageTime - answerHistory[b].averageTime)
            : Object.keys(answerHistory).sort((a, b) => answerHistory[b].averageTime - answerHistory[a].averageTime);
    }
    else if (timeTrackSort === "name") {
        sortedIds = timeTrackSortAscending
            ? Object.keys(answerHistory).sort((a, b) => answerHistory[a].name.localeCompare(answerHistory[b].name))
            : Object.keys(answerHistory).sort((a, b) => answerHistory[b].name.localeCompare(answerHistory[a].name));
    }
    else if (timeTrackSort === "score") {
        sortedIds = timeTrackSortAscending
            ? Object.keys(answerHistory).sort((a, b) => answerHistory[a].score - answerHistory[b].score)
            : Object.keys(answerHistory).sort((a, b) => answerHistory[b].score - answerHistory[a].score);
    }
    let $results = $(`<div id="timeTrackResults"></div>`);
    for (let id of sortedIds) {
        let $row = $("<div></div>");
        $row.append(`<span class="trackTime">${Math.round(answerHistory[id].averageTime)}</span>`);
        $row.append($(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`).click(() => {
            playerProfileController.loadProfile(answerHistory[id].name, $("#answerTimeTrackWindow"), {}, () => {}, false, true);
        }));
        let $correctIcon = $(`<i class="fa fa-check-circle clickAble" aria-hidden="true"></i>`).click(() => {
            answerTimeTrackWindow.window.data("bs.popover").options.title = answerHistory[id].name + " - Correct: " + answerHistory[id].correctAnswers.length;
            answerTimeTrackWindow.window.data("bs.popover").options.content = answerListPopoverContent(answerHistory[id].correctAnswers);
            answerTimeTrackWindow.window.popover("show");
        });
        $row.append($correctIcon);
        let $wrongIcon = $(`<i class="fa fa-times-circle clickAble" aria-hidden="true"></i>`).click(() => {
            answerTimeTrackWindow.window.data("bs.popover").options.title = answerHistory[id].name + " - Wrong: " + answerHistory[id].wrongAnswers.length;
            answerTimeTrackWindow.window.data("bs.popover").options.content = answerListPopoverContent(answerHistory[id].wrongAnswers);
            answerTimeTrackWindow.window.popover("show");
        });
        $row.append($wrongIcon);
        $row.append(`<span class="trackName">${answerHistory[id].name}</span>`);
        $row.append(`<span class="trackScore">${answerHistory[id].score}</span>`);
        $results.append($row);
    }
    answerTimeTrackWindow.panels[0].panel.append($results);
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

function typeText(type, typeNumber) {
    if (type === 1) return "OP" + typeNumber;
    if (type === 2) return "ED" + typeNumber;
    if (type === 3) return "IN";
};

function rankedText() {
    let region = Object({E: "Eastern ", C: "Central ", W: "Western "})[$("#mpRankedTimer h3").text()] || "";
    let type = hostModal.getSettings().roomName;
    return region + type;
}

function getScore(player) {
    if (quiz.scoreboard.scoreType === 1) return player.score;
    if (quiz.scoreboard.scoreType === 2) return player.correctGuesses;
    if (quiz.scoreboard.scoreType === 3) return player.correctGuesses;
}

function resetHistory() {
    songHistory = [];
    answerHistory = {};
}

function answerListPopoverContent(list) {
    let language = options.useRomajiNames ? "romaji" : "english";
    $ul = $("<ul></ul>");
    for (let x of list) {
        let $li = $("<li></li>");
        $li.append($("<span></span>").addClass("number").text(songHistory[x].number + "."));
        $li.append($("<span></span>").text(songHistory[x][language]));
        $li.append($("<span></span>").addClass("type").text(songHistory[x].type));
        $li.append($("<span></span>").addClass("difficulty").text(songHistory[x].difficulty));
        $ul.append($li);
    }
    return $ul;
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
        #answerStatsTimeTrackButton {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            line-height: normal;
            font-weight: bold;
            padding: 4px 5px;
            position: absolute;
            float: left;
            user-select: none;
        }
        #answerStatsTimeTrackButton:hover {
            opacity: .8;
        }
        #answerTimeTrackWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #answerTimeTrackWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerTimeTrackWindow .modal-header button {
            background: none;
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            color: #D9D9D9;
            font-weight: bold;
            margin: 5px 0px 5px 5px;
            padding: 0px 5px;
            user-select: none;
        }
        #answerTimeTrackWindow .modal-header button:hover {
            opacity: .8;
        }
        #timeTrackResults {
            cursor: auto;
        }
        #answerTimeTrackWindow span.trackTime {
            width: 48px;
            display: inline-block;
        }
        #answerTimeTrackWindow i.fa {
            margin-right: 3px;
            display: inline-block;
        }
        #answerTimeTrackWindow span.trackName {
            display: inline-block;
        }
        #answerTimeTrackWindow span.trackScore {
            opacity: .7;
            margin-left: 8px;
            display: inline-block;
        }
        .timeTrackAnswersPopover {
            max-width: 600px;
            text-align: left;
        }
        .timeTrackAnswersPopover span.number {
            opacity: .7;
            margin-right: 5px;
        }
        .timeTrackAnswersPopover span.type {
            opacity: .7;
            margin-left: 10px;
        }
        .timeTrackAnswersPopover span.difficulty {
            opacity: .7;
            margin-left: 10px;
        }
    `));
    document.head.appendChild(style);
}
