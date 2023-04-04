// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.3
// @description  Play a solo game with a custom song list
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqCustomSongListGame.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqCustomSongListGame.user.js
// ==/UserScript==

/*
How to start a custom song list game:
  1. create a solo lobby
  2. click CSL button in the top right
  3. use the tools and settings to create a list
  4. fetch the autocomplete if the button is red
  5. click start to play the quiz

Some considerations:
  1. anisongdb is unavailable during ranked, please prepare some json files in advance
  2. anime titles that were changed recently in amq will be incorrect if anisongdb never updated it
  3. no volume normalizing
  4. keep duplicates in the song list if you want to use any acceptable title for each
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.3";
let active = false;
let fastSkip = false;
let nextVideoReady = false;
let guessTime = 20;
let extraGuessTime = 0;
let currentAnswer = "";
let score = 0;
let songList;
let songOrder = {}; //{song#: index#, ...}
let startPoint; //"random" "start" "middle" "end"
let previousSongFinished = false;
let skipInterval;
let nextVideoReadyInterval;
let answerTimer;
let extraGuessTimer;
let endGuessTimer;

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName && message.message === "/version") {
                setTimeout(() => { gameChat.systemMessage("Custom Song List Game - " + version) }, 1);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName && payload.message === "/version") {
            setTimeout(() => { gameChat.systemMessage("Custom Song List Game - " + version) }, 1);
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

    quiz.pauseButton.$button.off("click").click(() => {
        if (active) {
            if (quiz.pauseButton.pauseOn) {
                for (let listener of socket.listners["quiz unpause triggered"]) {
                    listener.fire({playerName: selfName});
                    //listener.fire({playerName: selfName, doCountDown: true, countDownLength: 3000});
                }
            }
            else {
                for (let listener of socket.listners["quiz pause triggered"]) {
                    listener.fire({playerName: selfName});
                }
            }
        }
        else {
            socket.sendCommand({type: "quiz", command: quiz.pauseButton.pauseOn ? "quiz unpause" : "quiz pause"});
        }
    });

    const oldSendSkipVote = quiz.skipController.sendSkipVote;
    quiz.skipController.sendSkipVote = function() {
        if (active) {
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
        if (active) {
            quizOver();
        }
        else {
            oldStartReturnLobbyVote.apply(this, arguments);
        }
    }

    const oldSubmitAnswer = QuizTypeAnswerInputController.prototype.submitAnswer;
    QuizTypeAnswerInputController.prototype.submitAnswer = function(answer) {
        if (active) {
            currentAnswer = answer;
            for (let listener of socket.listners["quiz answer"]) {
                listener.fire({answer: answer, success: true});
            }
            for (let listener of socket.listners["player answered"]) {
                listener.fire([0]);
            }
            this.skipController.highlight = true;
            if (options.autoVoteSkipGuess) {
                this.skipController.voteSkip();
                for (let listener of socket.listners["quiz overlay message"]) {
                    listener.fire("Skipping to Answers");
                }
            }
        }
        else {
            oldSubmitAnswer.apply(this, arguments);
        }
    }

    quiz.videoReady = function(songId) {
        if (active && this.inQuiz) {
            nextVideoReady = true;
        }
        else if (!this.isSpectator && this.inQuiz) {
            socket.sendCommand({
                type: "quiz",
                command: "video ready",
                data: {songId: songId}
            });
        }
    }

    AMQ_addScriptData({
        name: "Custom Song List Game",
        author: "kempanator",
        description: `
            <p>Description</p>
        `
    });
    applyStyles();
}

function startQuiz() {
    if (!lobby.inLobby || !lobby.soloMode || !songList.length) return;
    let song = songList[songOrder[1]];
    active = true;
    let date = new Date().toISOString();
    for (let listener of socket.listners["Game Starting"]) {
        listener.fire({
            gameMode: "Solo",
            showSelection: 1,
            groupSlotMap: {1: [0]},
            players: Object.values(lobby.players),
            multipleChoice: false,
            quizDescription: {
                quizId: "",
                startTime: date,
                roomName: "Solo"
            }
        });
    }
    setTimeout(() => {
        for (let listener of socket.listners["quiz next video info"]) {
            listener.fire({
                playLength: guessTime,
                playbackSpeed: 1,
                startPont: getStartPoint(), //thanks egerod
                videoInfo: {
                    id: null,
                    videoMap: {
                        catbox: {
                            "0": song.audio,
                            "480": song.MQ,
                            "720": song.HQ
                        }
                    },
                    videoVolumeMap: {
                        catbox: {
                            "0": -20,
                            "480": -20,
                            "720": -20
                        }
                    }
                }
            });
        }
    }, 100);
    setTimeout(() => {
        for (let listener of socket.listners["quiz ready"]) {
            listener.fire({"numberOfSongs": Object.keys(songOrder).length});
        }
    }, 200);
    setTimeout(() => {
        for (let listener of socket.listners["quiz waiting buffering"]) {
            listener.fire({"firstSong": true});
        }
    }, 300);
    setTimeout(() => {
        previousSongFinished = true;
        readySong(1);
    }, 400);
}

function readySong(songNumber) {
    //console.log("readying song " + songNumber);
    nextVideoReadyInterval = setInterval(() => {
        //console.log({song: songNumber nextVideoReady: nextVideoReady, paused: quiz.pauseButton.pauseOn, previousSongFinished: previousSongFinished});
        if (nextVideoReady && !quiz.pauseButton.pauseOn && previousSongFinished) {
            clearInterval(nextVideoReadyInterval);
            nextVideoReady = false;
            previousSongFinished = false;
            playSong(songNumber);
        }
    }, 100);
}

function playSong(songNumber) {
    if (!active || !quiz.inQuiz) return reset();
    //console.log("playing song " + songNumber);
    playingSong = true;
    for (let listener of socket.listners["play next song"]) {
        listener.fire({
            "time": guessTime,
            "extraGuessTime": extraGuessTime,
            "songNumber": songNumber,
            "progressBarState": {"length": guessTime, "played": 0},
            "onLastSong": songNumber === Object.keys(songOrder).length,
            "multipleChoiceNames": null
        });
    }
    if (extraGuessTime) {
        extraGuessTimer = setTimeout(() => {
            for (let listener of socket.listners["extra guess time"]) {
                listener.fire();
            }
        }, extraGuessTime * 1000);
    }
    endGuessTimer = setTimeout(() => {
        clearInterval(skipInterval);
        clearTimeout(endGuessTimer);
        clearTimeout(extraGuessTimer);
        endGuessPhase(songNumber);
    }, (guessTime + extraGuessTime) * 1000);
    skipInterval = setInterval(() => {
        if (quiz.skipController._toggled) {
            for (let listener of socket.listners["quiz overlay message"]) {
                listener.fire("Skipping to Answers");
            }
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
            for (let listener of socket.listners["quiz next video info"]) {
                listener.fire({
                    playLength: guessTime,
                    playbackSpeed: 1,
                    startPont: getStartPoint(), //thanks egerod
                    videoInfo: {
                        id: null,
                        videoMap: {
                            catbox: {
                                "0": nextSong.audio,
                                "480": nextSong.MQ,
                                "720": nextSong.HQ
                            }
                        },
                        videoVolumeMap: {
                            catbox: {
                                "0": -20,
                                "480": -20,
                                "720": -20
                            }
                        }
                    }
                });
            }
        }
    }, 100);
}

function endGuessPhase(songNumber) {
    if (!active || !quiz.inQuiz) return reset();
    //console.log("end guess phase for song " + songNumber);
    let song = songList[songOrder[songNumber]];
    for (let listener of socket.listners["guess phase over"]) {
        listener.fire();
    }
    answerTimer = setTimeout(() => {
        if (!active || !quiz.inQuiz) return reset();
        for (let listener of socket.listners["player answers"]) {
            listener.fire({
                "answers": [{"gamePlayerId": 0, "pose": 3, "answer": currentAnswer}],
                "progressBarState": null
            });
        }
        answerTimer = setTimeout(() => {
            if (!active || !quiz.inQuiz) return reset();
            let correct = isCorrectAnswer(songNumber, currentAnswer);
            let pose = currentAnswer ? (correct ? 5 : 4) : 6;
            if (correct) score++;
            currentAnswer = "";
            for (let listener of socket.listners["answer results"]) {
                listener.fire({
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
            }
            setTimeout(() => {
                if (!active || !quiz.inQuiz) return reset();
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

function endReplayPhase(songNumber) {
    if (!active || !quiz.inQuiz) return reset();
    if (songNumber < Object.keys(songOrder).length) {
        for (let listener of socket.listners["quiz overlay message"]) {
            listener.fire("Skipping to Next Song");
        }
        setTimeout(() => {
            previousSongFinished = true;
        }, fastSkip ? 1000 : 3000);
    }
    else {
        for (let listener of socket.listners["quiz overlay message"]) {
            listener.fire("Skipping to Final Standings");
        }
        setTimeout(() => {
            for (let listener of socket.listners["quiz end result"]) {
                listener.fire({
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
            }
        }, fastSkip ? 2000 : 5000);
        setTimeout(() => {
            quizOver();
        }, fastSkip ? 5000 : 12000);
    }
}
    

// check if the player's answer is correct
// also include anime names of items with the same song and artist
function isCorrectAnswer(songNumber, answer) {
    if (!answer) return false;
    answer = answer.toLowerCase();
    let song = songList[songOrder[songNumber]];
    let correctAnswers = new Set();
    for (let s of songList) {
        if (s.songName === song.songName && s.songArtist === song.songArtist) {
            let answers = [s.animeEnglishName, s.animeRomajiName].concat(s.altAnimeNames, s.altAnimeNamesAnswers);
            answers.forEach((x) => correctAnswers.add(x));
        }
    }
    //console.log(Array.from(correctAnswers));
    for (let x of correctAnswers) {
        if (x.toLowerCase() === answer) return true;
    }
    return false;
}

function getStartPoint() {
    if (startPoint === "random") return Math.floor(Math.random() * 101);
    if (startPoint === "start") return 0;
    if (startPoint === "middle") return 50;
    if (startPoint === "end") return 100;
}

function clearTimeEvents() {
    clearInterval(nextVideoReadyInterval);
    clearInterval(skipInterval);
    clearTimeout(endGuessTimer);
    clearTimeout(extraGuessTimer);    
    clearTimeout(answerTimer);
}

function reset() {
    clearTimeEvents();
    active = false;
    currentAnswer = "";
    score = 0;
    previousSongFinished = false;
    fastSkip = false;
}

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
    //console.log(data);
    lobby.setupLobby(data, quiz.isSpectator);
	viewChanger.changeView("lobby", {supressServerMsg: true, keepChatOpen: true});
}

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
        #cslgAnisongdbSearchMode {
            color: black;
            padding: 3px 0;
        }
        #cslgAnisongdbSearchInput {
            color: black;
            width: 185px;
        }
        #cslgAnisongdbSearchButtonGo {
            color: black;
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
        #cslgSongListTable .number {
            width: 30px;
        }
        #cslgSongListTable .trash {
            width: 20px;
        }
        #cslgSongListTable thead tr {
            background-color: #282828;
            font-weight: bold;
        }
        #cslgSongListTable tbody i.fa-trash:hover {
            opacity: .8;
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
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}

function openSettingsModal() {
    if (lobby.inLobby && lobby.soloMode) {
        if ((quiz.answerInput.typingInput.autoCompleteController.list.length)) {
            $("#cslgAutocompleteButton").removeClass("btn-danger").addClass("btn-success disabled");
        }
        $("#cslgSettingsModal").modal("show");
    }
    else {
        displayMessage("Error", "must be in solo lobby");
    }
}

function anisongdbDataSearch() {
    let mode = $("#cslgAnisongdbSearchMode").val().toLowerCase();
    let query = $("#cslgAnisongdbSearchInput").val();
    let partial = $("#cslgAnisongdbSearchPartialCheckbox").prop("checked");
    let ignoreDuplicates = $("#cslgAnisongdbSearchIgnoreDuplicatesCheckbox").prop("checked");
    //console.log({mode: mode, query: query, partial: partial, ignoreDuplicates: ignoreDuplicates});
    if (query) getAnisongdbData(mode, query, partial, ignoreDuplicates);
}

// send anisongdb request
function getAnisongdbData(mode, query, partial, ignoreDuplicates) {
    $("#cslgSongListCount").text("Loading");
    $("#cslgSongListTable tbody").empty();
    let json = {and_logic: false, ignore_duplicate: ignoreDuplicates, opening_filter: true, ending_filter: true, insert_filter: true};
    if (mode === "anime") json.anime_search_filter = {search: query, partial_match: partial};
    else if (mode === "artist") json.artist_search_filter = {search: query, partial_match: partial, group_granularity: 0, max_other_artist: 99};
    else if (mode === "song") json.song_name_search_filter = {search: query, partial_match: partial};
    else if (mode === "composer") json.composer_search_filter = {search: query, partial_match: partial, arrangement: false};
    fetch("https://anisongdb.com/api/search_request", {
        method: "POST",
        headers: {"Accept": "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(json)
    }).then(res => res.json()).then(json => {
        handleData(json);
        buildTable();
    });
}

function handleData(data) {
    songList = [];
    if (data) {
        // anisongdb structure
        if (Array.isArray(data) && data.length && data[0].animeJPName) {
            data = data.filter((song) => song.audio || song.MQ || song.HQ);
            for (let song of data) {
                songList.push({
                    animeRomajiName: song.animeJPName,
                    animeEnglishName: song.animeENName,
                    altAnimeNames: song.animeAltName || [],
                    altAnimeNamesAnswers: [],
                    songArtist: song.songArtist,
                    songName: song.songName,
                    songType: Object({O: 1, E: 2, I: 3})[song.songType[0]],
                    songTypeNumber: song.songType[0] === "I" ? null : parseInt(song.songType.split(" ")[1]),
                    songDifficulty: song.songDifficulty,
                    animeType: song.animeType,
                    animeVintage: song.vintage,
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
                    correctGuess: null,
                    incorrectGuess: null
                });
            }
        }
        // joseph song export script structure
        else if (Array.isArray(data) && data.length && data[0].gameMode) {
            for (let song of data) {
                songList.push({
                    animeRomajiName: song.anime.romaji,
                    animeEnglishName: song.anime.english,
                    altAnimeNames: song.altAnswers || [],
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
                    incorrectGuess: song.correct
                });
            }
        }
        // official amq song export structure
        else if (typeof data === "object" && data.roomName && data.startTime && data.songs) {
            for (let song of data.songs) {
                songList.push({
                    animeRomajiName: song.songInfo.animeNames.romaji,
                    animeEnglishName: song.songInfo.animeNames.english,
                    altAnimeNames: song.songInfo.altAnimeNames || [],
                    altAnimeNamesAnswers: song.songInfo.altAnimeNamesAnswers || [],
                    songArtist: song.songInfo.artist,
                    songName: song.songInfo.songName,
                    songType: song.songInfo.songType,
                    songTypeNumber: song.songInfo.songTypeNumber,
                    songDifficulty: song.animeDifficulty,
                    animeType: song.songInfo.animeType,
                    animeVintage: song.songInfo.vintage,
                    annId: song.songInfo.siteIds.annId,
                    malId: song.songInfo.siteIds.malId,
                    kitsuId: song.songInfo.siteIds.kitsuId,
                    aniListId: song.songInfo.siteIds.aniListId,
                    animeTags: song.songInfo.animeTags,
                    animeGenre: song.songInfo.animeGenre,
                    startPoint: song.startPoint,
                    audio: song.videoUrl.endsWith(".mp3") ? song.videoUrl : null,
                    video480: null,
                    video720: song.videoUrl.endsWith(".webm") ? song.videoUrl : null,
                    correctGuess: song.correctGuess,
                    incorrectGuess: song.wrongGuess
                });
            }
        }
    }
}

function buildTable() {
    $("#cslgSongListCount").text("Total Songs: " + songList.length);
    $tbody = $("#cslgSongListTable tbody");
    $tbody.empty();
    songList.forEach((result, i) => {
        let $row = $("<tr></tr>");
        $row.append($("<td></td>").addClass("number").text(i + 1));
        $row.append($("<td></td>").addClass("song").text(result.songName));
        $row.append($("<td></td>").addClass("artist").text(result.songArtist));
        $row.append($("<td></td>").addClass("trash clickAble").append(`<i class="fa fa-trash" aria-hidden="true"></i>`));
        $tbody.append($row);
    });
}

function showSongListInterface() {
    $("#cslgQuizSettingsTab").removeClass("selected");
    $("#cslgInfoTab").removeClass("selected");
    $("#cslgSongListTab").addClass("selected");
    $("#cslgQuizSettingsContainer").hide();
    $("#cslgInfoContainer").hide();
    $("#cslgSongListContainer").show();
}

function showSettingsInterface() {
    $("#cslgSongListTab").removeClass("selected");
    $("#cslgInfoTab").removeClass("selected");
    $("#cslgQuizSettingsTab").addClass("selected");
    $("#cslgSongListContainer").hide();
    $("#cslgInfoContainer").hide();
    $("#cslgQuizSettingsContainer").show();
}

function showInfoInterface() {
    $("#cslgSongListTab").removeClass("selected");
    $("#cslgQuizSettingsTab").removeClass("selected");
    $("#cslgInfoTab").addClass("selected");
    $("#cslgSongListContainer").hide();
    $("#cslgQuizSettingsContainer").hide();
    $("#cslgInfoContainer").show();
}

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
                        <div id="cslgInfoTab" class="tab clickAble" style="width: 40px; float: right;">
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
                        <div id="cslgFileUploadRow" style="height: 30px">
                            <label style="vertical-align: -4px"><input id="cslgFileUpload" type="file" style="width: 500px"></label>
                        </div>
                        <div id="cslgAnisongdbSearchRow" style="height: 30px">
                            <select id="cslgAnisongdbSearchMode">
                                <option value="Anime">Anime</option>
                                <option value="Artist">Artist</option>
                                <option value="Song">Song</option>
                                <option value="Composer">Composer</option>
                            </select>
                            <input id="cslgAnisongdbSearchInput" type="text">
                            <button id="cslgAnisongdbSearchButtonGo">Go</button>
                            <label class="clickAble" style="margin-left: 10px">Partial<input id="cslgAnisongdbSearchPartialCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Ignore Duplicates<input id="cslgAnisongdbSearchIgnoreDuplicatesCheckbox" type="checkbox"></label>
                        </div>
                        <div style="height: 400px; margin: 5px 0; overflow-y: scroll;">
                            <table id="cslgSongListTable">
                                <thead>
                                    <tr>
                                        <th class="number">#</th>
                                        <th class="song">Song</th>
                                        <th class="artist">Artist</th>
                                        <th class="trash"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div id="cslgQuizSettingsContainer" style="margin-top: 10px">
                        <div>
                            <span style="font-size: 18px; font-weight: bold;">Songs:</span><input id="cslgSettingsSongs" type="text" style="width: 40px">
                            <span style="font-size: 18px; font-weight: bold; margin-left: 15px;">Guess Time:</span><input id="cslgSettingsGuessTime" type="text" style="width: 40px">
                            <span style="font-size: 18px; font-weight: bold; margin-left: 15px;">Extra Time:</span><input id="cslgSettingsExtraGuessTime" type="text" style="width: 40px">
                        </div>
                        <div>
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Song Types:</span>
                            <label class="clickAble">OP<input id="cslgSettingsOPCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">ED<input id="cslgSettingsEDCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">IN<input id="cslgSettingsINCheckbox" type="checkbox"></label>
                            <span style="font-size: 18px; font-weight: bold; margin: 0 15px 0 35px;">Guess:</span>
                            <label class="clickAble">Correct<input id="cslgSettingsCorrectGuessCheckbox" type="checkbox"></label>
                            <label class="clickAble" style="margin-left: 10px">Wrong<input id="cslgSettingsIncorrectGuessCheckbox" type="checkbox"></label>
                        </div>
                        <div>
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Song Order:</span>
                            <label class="clickAble">Random<input id="cslgSettingsSongOrderRandomRadio" type="radio" name="cslgSongOrderMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Ascending<input id="cslgSettingsSongOrderAscendingRadio" type="radio" name="cslgSongOrderMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Descending<input id="cslgSettingsSongOrderDescendingRadio" type="radio" name="cslgSongOrderMode"></label>
                        </div>
                        <div>
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Sample:</span>
                            <label class="clickAble">Random<input id="cslgSettingsStartPointRandomRadio" type="radio" name="cslgStartPointMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Start<input id="cslgSettingsStartPointStartRadio" type="radio" name="cslgStartPointMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Middle<input id="cslgSettingsStartPointMiddleRadio" type="radio" name="cslgStartPointMode"></label>
                            <label class="clickAble" style="margin-left: 10px">End<input id="cslgSettingsStartPointEndRadio" type="radio" name="cslgStartPointMode"></label>
                        </div>
                        <div>
                            <span style="font-size: 18px; font-weight: bold; margin-right: 15px;">Skip Speed:</span>
                            <label class="clickAble">Normal<input id="cslgSettingsSkipNormalRadio" type="radio" name="cslgSkipMode"></label>
                            <label class="clickAble" style="margin-left: 10px">Fast<input id="cslgSettingsSkipFastRadio" type="radio" name="cslgSkipMode"></label>
                        </div>
                        <p style="margin-top: 20px">*Normal room settings are ignored. Only these settings will apply.</p>
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
$("#cslgSongListTab").click(() => { showSongListInterface() });
$("#cslgQuizSettingsTab").click(() => { showSettingsInterface() });
$("#cslgInfoTab").click(() => { showInfoInterface() });
$("#cslgAnisongdbSearchButtonGo").click(() => { anisongdbDataSearch() });
$("#cslgAnisongdbSearchInput").keypress((event) => { if (event.which === 13) anisongdbDataSearch() });
$("#cslgFileUpload").on("change", function() {
    this.files[0].text().then((data) => {
        try {
            handleData(JSON.parse(data));
        }
        catch {
            songList = [];
            displayMessage("Upload Error");
        }
        buildTable();
    });
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
    if (quiz.answerInput.typingInput.autoCompleteController.list.length === 0) {
        return displayMessage("Unable to start", "autocomplete list empty");
    }
    let numSongs = parseInt($("#cslgSettingsSongs").val());
    if (isNaN(numSongs) || numSongs < 1) {
        return displayMessage("Unable to start", "invalid number of songs");
    }
    guessTime = parseInt($("#cslgSettingsGuessTime").val());
    if (isNaN(guessTime) || guessTime < 1 || guessTime > 60) {
        return displayMessage("Unable to start", "invalid guess time");
    }
    extraGuessTime = parseInt($("#cslgSettingsExtraGuessTime").val());
    if (isNaN(extraGuessTime) || extraGuessTime < 0 || extraGuessTime > 15) {
        return displayMessage("Unable to start", "invalid extra guess time");
    }
    let ops = $("#cslgSettingsOPCheckbox").prop("checked");
    let eds = $("#cslgSettingsEDCheckbox").prop("checked");
    let ins = $("#cslgSettingsINCheckbox").prop("checked");
    let correctGuesses = $("#cslgSettingsCorrectGuessCheckbox").prop("checked");
    let incorrectGuesses = $("#cslgSettingsIncorrectGuessCheckbox").prop("checked");
    let songKeys = Object.keys(songList).filter((key) =>
        (ops && songList[key].songType === 1) || (eds && songList[key].songType === 2) || (ins && songList[key].songType === 3) ||
        (songList[key].correctGuess === null || correctGuesses && songList[key].correctGuess === true) ||
        (songList[key].incorrectGuess === null || incorrectGuesses && songList[key].incorrectGuess === true)
    );
    if ($("#cslgSettingsSongOrderRandomRadio").prop("checked")) shuffleArray(songKeys);
    else if ($("#cslgSettingsSongOrderDescendingRadio").prop("checked")) songKeys.reverse();
    songKeys.slice(0, numSongs).forEach((key, i) => { songOrder[i + 1] = parseInt(key) });
    if (Object.keys(songOrder).length === 0) {
        return displayMessage("Unable to start", "no songs");
    }
    if ($("#cslgSettingsStartPointRandomRadio").prop("checked")) startPoint = "random";
    else if ($("cslgSettingsStartPointStartRadio").prop("checked")) startPoint = "start";
    else if ($("cslgSettingsStartPointMiddleRadio").prop("checked")) startPoint = "middle";
    else if ($("cslgSettingsStartPointEndRadio").prop("checked")) startPoint = "end";
    if ($("#cslgSettingsSkipNormalRadio").prop("checked")) fastSkip = false;
    else if ($("#cslgSettingsSkipFastRadio").prop("checked")) fastSkip = true;
    $("#cslgSettingsModal").modal("hide");
    //console.log(songOrder);
    startQuiz();
});
$("#cslgSongListTable").on("click", "i.fa-trash", (event) => {
    let index = parseInt(event.target.parentElement.parentElement.querySelector("td.number").innerText) - 1;
    songList.splice(index, 1);
    $("#cslgSongListCount").text("Total Songs: " + songList.length);
    buildTable();
});
showSongListInterface();
$("#cslgModeAnisongdbRadio").prop("checked", true);
$("#cslgAnisongdbSearchPartialCheckbox").prop("checked", true);
$("#cslgAnisongdbSearchMode").val("Artist");
$("#cslgSettingsSongs").val("20");
$("#cslgSettingsGuessTime").val("20");
$("#cslgSettingsExtraGuessTime").val("0");
$("#cslgSettingsOPCheckbox").prop("checked", true);
$("#cslgSettingsEDCheckbox").prop("checked", true);
$("#cslgSettingsINCheckbox").prop("checked", true);
$("#cslgSettingsCorrectGuessCheckbox").prop("checked", true);
$("#cslgSettingsIncorrectGuessCheckbox").prop("checked", true);
$("#cslgSettingsSongOrderRandomRadio").prop("checked", true);
$("#cslgSettingsStartPointRandomRadio").prop("checked", true);
$("#cslgSettingsSkipNormalRadio").prop("checked", true);
$("#cslgFileUploadRow").hide();
$("#cslgModeAnisongdbRadio").click(() => {
    songList = [];
    $("#cslgFileUploadRow").hide();
    $("#cslgAnisongdbSearchRow").show();
    $("#cslgSongListCount").text("Total Songs: 0");
    $("#cslgFileUploadRow input").val("");
    $("#cslgSongListTable tbody").empty();
});
$("#cslgModeFileUploadRadio").click(() => {
    songList = [];
    $("#cslgAnisongdbSearchRow").hide();
    $("#cslgFileUploadRow").show();
    $("#cslgSongListCount").text("Total Songs: 0");
    $("#cslgAnisongdbSearchInput").val("");
    $("#cslgSongListTable tbody").empty();
});
