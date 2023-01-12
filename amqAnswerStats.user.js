// ==UserScript==
// @name         AMQ Answer Stats
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Adds a window to display quiz answer stats
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnswerStats.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnswerStats.user.js
// ==/UserScript==

/*
Features:
1. Add a window with answer stats
2. Add a window for anisongdb search results
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

const version = "0.1";
let answerStatsWindow;
let anisongdbWindow;
let answers = {}; //{1: {name, answer, correct}, ...}
let listLowerCase = [];
let anisongdbSearchButtons = true;
let allSourceLinks = true;
$("#qpOptionContainer").width($("#qpOptionContainer").width() + 35);
$("#qpOptionContainer > div").append($(`<div id="qpAnswerStats" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-list-alt qpMenuItem"></i></div>`)
    .click(() => {
        if (answerStatsWindow.isVisible()) answerStatsWindow.close();
        else answerStatsWindow.open();
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
    new Listener("get all song names", (payload) => {
        setTimeout(() => {
            listLowerCase = quiz.answerInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 1);
    }).bindListener();
    new Listener("update all song names", (payload) => {
        setTimeout(() => {
            listLowerCase = quiz.answerInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 1);
    }).bindListener();
    new Listener("player answers", (payload) => {
        //console.log(payload);
        if (!quiz.answerInput.autoCompleteController.list.length) quiz.answerInput.autoCompleteController.updateList();
        answers = {};
        for (let item of payload.answers) {
            answers[item.gamePlayerId] = {name: quiz.players[item.gamePlayerId]._name, answer: item.answer};
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        //console.log(payload);
        if (Object.keys(answers).length === 0) return;
        if (listLowerCase.length === 0) return;
        let correctPlayers = [];
        let correctAnswerCount = {};
        let incorrectAnswerCount = {};
        let otherAnswerCount = 0;
        let invalidAnswerCount = 0;
        let noAnswerCount = 0;
        payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).forEach((anime) => { correctAnswerCount[anime] = 0 });
        for (let player of payload.players) {
            let quizPlayer = answers[player.gamePlayerId];
            if (quizPlayer) {
                quizPlayer.correct = player.correct;
                if (player.correct) correctPlayers.push(answers[player.gamePlayerId].name);
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
                        let wrongAnime = quiz.answerInput.autoCompleteController.list[index];
                        incorrectAnswerCount[wrongAnime] ? incorrectAnswerCount[wrongAnime]++ : incorrectAnswerCount[wrongAnime] = 1;
                    }
                    else {
                        invalidAnswerCount++;
                    }
                }
            }
        }
        Object.keys(incorrectAnswerCount).forEach((x) => { if (incorrectAnswerCount[x] === 1) otherAnswerCount++ });
        let correctSortedKeys = Object.keys(correctAnswerCount).sort((a, b) => correctAnswerCount[b] - correctAnswerCount[a]);
        let incorrectSortedKeys = Object.keys(incorrectAnswerCount).sort((a, b) => incorrectAnswerCount[b] - incorrectAnswerCount[a]);
        answers = {};

        setTimeout(() => {
            let correctCount = $(".qpAvatarAnswerContainer .rightAnswer").length;
            let totalPlayers = $("#qpScoreBoardEntryContainer .qpStandingItem").length;
            let activePlayers = $("#qpScoreBoardEntryContainer .qpStandingItem:not(.disabled)").length;
            //let totalCorrectAverage = correctCount / totalPlayers;
            //let totalPercentage = Math.round(totalCorrectAverage * 100);
            answerStatsWindow.panels[0].clear();
            answerStatsWindow.panels[0].panel.append($(`
                <div>
                    <span><b>Correct:</b> ${correctCount}/${activePlayers} ${(correctCount / activePlayers * 100).toFixed(2)}%</span>
                    <span style="margin-left: 20px"><b>Dif:</b> ${Math.round(payload.songInfo.animeDifficulty)}</span>
                    <span style="margin-left: 20px"><b>Watched:</b> ${payload.watched}</span>
                </div>
                <div>
                    <span><b>Total Players:</b> ${totalPlayers}</span>
                </div>
            `));
            let $ulCorrect = $(`<ul><b>Correct Answers:</b></ul>`).css("margin-top", "10px");
            for (let anime of correctSortedKeys) {
                if (correctAnswerCount[anime] > 0) {
                    $ulCorrect.append(`<li>${anime}<span class="answerStatsNumber">${correctAnswerCount[anime]}</span></li>`);
                }
            }
            let $ulWrong = $(`<ul><b>Wrong Answers:</b></ul>`);
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
            if (payload.players.length > 8 && correctPlayers.length <= 5) {
                answerStatsWindow.panels[0].panel.append(`<p><b>Correct Players:</b> ${correctPlayers.join(", ")}</p>`);
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
                    getAnisongdbData("anime", payload.songInfo.animeNames.romaji);
                });
                $("#answerStatsAnisongdbSearchButtonArtist").click(() => {
                    anisongdbWindow.open();
                    getAnisongdbData("artist", payload.songInfo.artist);
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
        }, 10);
    }).bindListener();

    answerStatsWindow = new AMQWindow({
        id: "answerStatsWindow",
        title: "Answer Stats",
        width: 400,
        height: 300,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1070,
        resizable: true,
        draggable: true
    });
    answerStatsWindow.addPanel({
        id: "answerStatsPanel",
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
        zIndex: 1100,
        resizable: true,
        draggable: true
    });
    anisongdbWindow.addPanel({
        id: "anisongdbPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    AMQ_addScriptData({
        name: "Answer Stats",
        author: "kempanator",
        description: `<p>Click the button in the options bar during quiz to open the answer stats window</p>`
    });
    applyStyles();
}

// send anisongdb request
function getAnisongdbData(mode, query) {
    anisongdbWindow.panels[0].clear();
    anisongdbWindow.panels[0].panel.append(`<p>loading...</p>`);
    let json = {};
    json.and_logic = false;
    json.ignore_duplicate = false;
    json.opening_filter = true;
    json.ending_filter = true;
    json.insert_filter = true;
    if (mode === "anime") json.anime_search_filter = {search: query, partial_match: false};
    else if (mode === "artist") json.artist_search_filter = {search: query, partial_match: false, group_granularity: 0, max_other_artist: 99};
    else if (mode === "song") json.song_search_filter = {search: query, partial_match: false};
    else if (mode === "composer") json.composer_search_filter = {search: query, partial_match: false, arrangement: false};
    return fetch("https://anisongdb.com/api/search_request", {
        method: "POST",
        headers: {"Accept": "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(json)
    }).then(res => res.json()).then(json => {
        console.log(json);
        anisongdbWindow.panels[0].clear();
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
            $table.append($(`
                <tr>
                    <td>${options.useRomajiNames ? result.animeJPName : result.animeENName}</td>
                    <td>${result.songArtist}</td>
                    <td>${result.songName}</td>
                    <td>${shortenType(result.songType)}</td>
                    <td>${result.animeVintage}</td>
                </tr>
            `));
        }
        anisongdbWindow.panels[0].panel.append($table);
    });
}

function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
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
        #anisongdbTable {
            width: 100%;
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
        #anisongdbTable tr:hover {
            color: #70b7ff;
        }
        #anisongdbTable th.anime {
            width: 25%;
        }
        #anisongdbTable th.artist {
            width: 25%;
        }
        #anisongdbTable th.song {
            width: 25%;
        }
        #anisongdbTable th.type {
            width: 10%;
        }
        #anisongdbTable th.vintage {
            width: 15%;
        }
    `));
    document.head.appendChild(style);
}
