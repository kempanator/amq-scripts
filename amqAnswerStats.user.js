// ==UserScript==
// @name         AMQ Answer Stats
// @namespace    https://github.com/kempanator
// @version      0.31
// @description  Adds a window to display quiz answer stats
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @require      https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqAnswerTimesUtility.user.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js
// ==/UserScript==

/*
Features:
1. Add a window with answer stats
2. Add a window to track average guess time for players' correct answers
3. Add a window to lookup all players' answers for the current game
4. Add a window to compare all answers between selected players
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.31";
const regionDictionary = {E: "Eastern", C: "Central", W: "Western"};
const saveData = validateLocalStorage("answerStats");
//const saveData2 = validateLocalStorage("highlightFriendsSettings");
let showPlayerColors = saveData.showPlayerColors ?? true;
let showCustomColors = saveData.showCustomColors ?? true;
let hotKeys = saveData.hotKeys ?? {};
let answerStatsWindow;
let answerSpeedWindow;
let answerHistoryWindow;
let answerCompareWindow;
let answers = {}; //{1: {name, id, answer, correct}, ...}
let songHistory = {}; //{1: {romaji, english, number, artist, song, type, vintage, difficulty, fastestSpeed, fastestPlayers, answers: {1: {id, text, speed, correct, rank, score, invalidAnswer, uniqueAnswer, noAnswer}, ...}, ...}
let playerInfo = {}; //{1: {name, id, level, score, rank, box, averageSpeed, correctSpeedList}, ...}
let listLowerCase = [];
let answerHistoryButton = true;
let answerSpeedButton = true;
let answerCompareButton = true;
let averageSpeedSort = {mode: "score", ascending: false};
let songHistoryFilter = {type: "all"};
let songHistorySort = {mode: "position", ascending: true};
let playerHistorySort = {mode: "number", ascending: true};
let answerHistorySettings = {mode: "song", songNumber: null, playerId: null, roomType: "", roomName: ""};
let customColorMap = {};

hotKeys.asWindow = saveData.hotKeys?.asWindow ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.historyWindow = saveData.hotKeys?.historyWindow ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.speedWindow = saveData.hotKeys?.speedWindow ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.compareWindow = saveData.hotKeys?.compareWindow ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.saveResults = saveData.hotKeys?.saveResults ?? {altKey: false, ctrlKey: false, key: ""};

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
    new Listener("Game Starting", (payload) => {
        resetHistory();
        answerHistorySettings.roomType = payload.gameMode;
        if (answerHistorySettings.roomType === "Ranked") {
            answerHistorySettings.roomName = regionDictionary[$("#mpRankedTimer h3").text()] + " " + payload.quizDescription.roomName;
        }
        else {
            answerHistorySettings.roomName = payload.quizDescription.roomName;
        }
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.quizState) {
            joinRoomUpdate();
        }
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.quizState) {
            joinRoomUpdate(payload);
        }
    }).bindListener();
    new Listener("player answers", (payload) => {
        if (!quiz.answerInput.typingInput.autoCompleteController.list.length) {
            quiz.answerInput.typingInput.autoCompleteController.updateList();
        }
        answers = {};
        for (let item of payload.answers) {
            answers[item.gamePlayerId] = {name: quiz.players[item.gamePlayerId]._name, id: item.gamePlayerId, answer: item.answer};
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (Object.keys(answers).length === 0) return;
        if (listLowerCase.length === 0) return;
        let currentPlayer = quizVideoController.getCurrentPlayer();
        let songNumber = parseInt(quiz.infoContainer.$currentSongCount.text());
        let correctPlayers = {}; //{id: answer speed, ...}
        let correctAnswerIdList = {}; //{title: [], ...}
        let incorrectAnswerIdList = {}; //{title: [], ...}
        let otherAnswerIdList = []; //unique incorrect answers
        let invalidAnswerIdList = [];
        let noAnswerIdList = [];
        songHistory[songNumber] = {
            animeRomajiName: payload.songInfo.animeNames.romaji,
            animeEnglishName: payload.songInfo.animeNames.english,
            altAnimeNames: payload.songInfo.altAnimeNames,
            altAnimeNamesAnswers: payload.songInfo.altAnimeNamesAnswers,
            animeType: payload.songInfo.animeType,
            animeVintage: payload.songInfo.vintage,
            animeTags: payload.songInfo.animeTags,
            animeGenre: payload.songInfo.animeGenre,
            songNumber: songNumber,
            songArtist: payload.songInfo.artist,
            songName: payload.songInfo.songName,
            songType: payload.songInfo.type,
            songTypeNumber: payload.songInfo.typeNumber,
            songTypeText: typeText(payload.songInfo.type, payload.songInfo.typeNumber),
            songDifficulty: payload.songInfo.animeDifficulty,
            rebroadcast: payload.songInfo.rebroadcast,
            dub: payload.songInfo.dub,
            annId: payload.songInfo.siteIds.annId,
            malId: payload.songInfo.siteIds.malId,
            kitsuId: payload.songInfo.siteIds.kitsuId,
            aniListId: payload.songInfo.siteIds.aniListId,
            startPoint: currentPlayer?.startPoint ?? null,
            audio: payload.songInfo.videoTargetMap.catbox?.[0] ?? payload.songInfo.videoTargetMap.openingsmoe?.[0] ?? null,
            video480: payload.songInfo.videoTargetMap.catbox?.[480] ?? payload.songInfo.videoTargetMap.openingsmoe?.[480] ?? null,
            video720: payload.songInfo.videoTargetMap.catbox?.[720] ?? payload.songInfo.videoTargetMap.openingsmoe?.[720] ?? null,
            groupSlotMap: {...payload.groupMap},
            answers: {}
        };
        payload.songInfo.altAnimeNames.concat(payload.songInfo.altAnimeNamesAnswers).forEach((anime) => { correctAnswerIdList[anime] = [] });
        for (let player of payload.players) {
            let quizPlayer = answers[player.gamePlayerId];
            if (quizPlayer) {
                quizPlayer.correct = player.correct;
                let speed = validateSpeed(amqAnswerTimesUtility.playerTimes[player.gamePlayerId]);
                if (player.correct && speed) correctPlayers[answers[player.gamePlayerId].id] = speed;
                let item = playerInfo[player.gamePlayerId];
                if (item) {
                    item.level = player.level;
                    item.score = getScore(player);
                    item.rank = player.position;
                    if (player.correct && speed) {
                        item.correctSpeedList.push(speed);
                        item.averageSpeed = item.correctSpeedList.reduce((a, b) => a + b) / item.correctSpeedList.length;
                        item.standardDeviation = Math.sqrt(item.correctSpeedList.map((x) => (x - item.averageSpeed) ** 2).reduce((a, b) => a + b) / item.correctSpeedList.length);
                    }
                }
                else {
                    playerInfo[player.gamePlayerId] = {
                        name: quizPlayer.name,
                        id: player.gamePlayerId,
                        level: player.level,
                        score: getScore(player),
                        rank: player.position,
                        correctSpeedList: (player.correct && speed) ? [speed] : [],
                        averageSpeed: (player.correct && speed) ? speed : 0,
                        standardDeviation: 0
                    };
                }
                songHistory[songNumber].answers[player.gamePlayerId] = {
                    id: player.gamePlayerId,
                    text: answers[player.gamePlayerId].answer,
                    speed: speed,
                    correct: player.correct,
                    rank: player.position,
                    score: getScore(player)
                };
            }
        }
        for (let player of Object.values(answers)) {
            let answerItem = songHistory[songNumber].answers[player.id];
            if (answerItem) {
                if (player.answer.trim() === "") {
                    noAnswerIdList.push(player.id);
                    answerItem.noAnswer = true;
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
                            answerItem.invalidAnswer = true;
                        }
                    }
                }
            }
        }
        let numCorrect = Object.keys(correctPlayers).length;
        let averageSpeed = numCorrect ? Math.round(Object.values(correctPlayers).reduce((a, b) => a + b) / numCorrect) : null;
        let fastestSpeed = numCorrect ? Math.min(...Object.values(correctPlayers)) : null;
        let fastestPlayers = Object.keys(correctPlayers).filter((id) => correctPlayers[id] === fastestSpeed);
        songHistory[songNumber].fastestSpeed = fastestSpeed;
        songHistory[songNumber].fastestPlayers = fastestPlayers;
        for (let anime of Object.keys(incorrectAnswerIdList)) {
            if (incorrectAnswerIdList[anime].length === 1) {
                let id = incorrectAnswerIdList[anime][0];
                otherAnswerIdList.push(id);
                songHistory[songNumber].answers[id].uniqueAnswer = true;
            }
        }
        let correctSortedKeys = Object.keys(correctAnswerIdList).sort((a, b) => correctAnswerIdList[b].length - correctAnswerIdList[a].length);
        let incorrectSortedKeys = Object.keys(incorrectAnswerIdList).sort((a, b) => incorrectAnswerIdList[b].length - incorrectAnswerIdList[a].length);
        answers = {};

        setTimeout(() => {
            let $asMainContainer = $("#asMainContainer");
            let totalPlayers = $("#qpScoreBoardEntryContainer .qpStandingItem").length;
            let activePlayers = $("#qpScoreBoardEntryContainer .qpStandingItem:not(.disabled)").length;
            let roomName = hostModal.$roomName.val();
            let difficultyList = songHistoryWindow.currentGameTab.table.rows.map((x) => parseFloat(x.songInfo.animeDifficulty) || 0);
            let songTypeList = songHistoryWindow.currentGameTab.table.rows.map((x) => x.songInfo.type);
            $("#asRoomInfoRow").empty().append(`
                <span><b>${roomNameText()}</b></span>
                <span style="margin-left: 20px"><b>Song:</b> ${songNumber}/${quiz.infoContainer.$totalSongCount.text()}</span>
            `);
            //<span style="margin-left: 20px"><b>Total Players:</b> ${totalPlayers}</span>
            $("#asSongDistributionRow span").remove();
            $("#asSongDistributionRow").append(`
                <span style="margin-left: 10px"><b>OP:</b> ${songTypeList.filter((x) => x === 1).length}</span>
                <span style="margin-left: 10px"><b>ED:</b> ${songTypeList.filter((x) => x === 2).length}</span>
                <span style="margin-left: 10px"><b>IN:</b> ${songTypeList.filter((x) => x === 3).length}</span>
                <span style="margin-left: 20px"><b>Easy:</b> ${difficultyList.filter((x) => x >= 60).length}</span>
                <span style="margin-left: 10px"><b>Medium:</b> ${difficultyList.filter((x) => x >= 25 && x < 60).length}</span>
                <span style="margin-left: 10px"><b>Hard:</b> ${difficultyList.filter((x) => x < 25).length}</span>
            `);
            let options = $("#asDistributionButton").data("bs.popover").options;
            if (quiz.gameMode === "Ranked") {
                options.title = roomName;
                options.content = difficultyInfoText(roomName);
            }
            else {
                options.title = "";
                options.content = "";
            }
            $("#asSongGuessRow").empty().append(`
                <span><b>Correct:</b> ${numCorrect}/${activePlayers} ${(numCorrect / activePlayers * 100).toFixed(2)}%</span>
                <span style="margin-left: 20px"><b>Dif:</b> ${Number(payload.songInfo.animeDifficulty).toFixed(2)}</span>
                <span style="margin-left: 20px"><b>Rig:</b> ${payload.watched}</span>
            `);
            if (numCorrect && !quiz.soloMode && !quiz.teamMode) {
                let $speedRow = $("#asAnswerSpeedRow").empty().show();
                $speedRow.append(`<span><b>Average:</b> ${averageSpeed}ms</span><span style="margin-left: 20px"><b>Fastest:</b> ${fastestSpeed}ms - </span>`);
                fastestPlayers.forEach((id, i) => {
                    let playerElement = $("<span></span>").css("cursor", "pointer").text(playerInfo[id].name).click(() => {
                        displayPlayerHistoryResults(id);
                        answerHistoryWindow.open();
                    });
                    $speedRow.append(playerElement);
                    if (i < fastestPlayers.length - 1) $speedRow.append(", ");
                });
            }
            else {
                $("#asAnswerSpeedRow").empty().hide();
            }
            if (payload.players.length > 8 && Object.keys(correctPlayers).length <= 5) {
                let $correctRow = $("#asCorrectPlayersRow").empty().show();
                $correctRow.append(`<span><b>Correct Players: </b></span>`);
                Object.keys(correctPlayers).forEach((id, i) => {
                    let playerElement = $("<span></span>").css("cursor", "pointer").text(playerInfo[id].name).click(() => {
                        displayPlayerHistoryResults(id);
                        answerHistoryWindow.open();
                    });
                    $correctRow.append(playerElement);
                    if (i < Object.keys(correctPlayers).length - 1) $correctRow.append(", ");
                });
            }
            else {
                $("#asCorrectPlayersRow").empty().hide();
            }
            let $ulCorrect = $("#asCorrectAnswersList").empty();
            $ulCorrect.append($("<b>Correct Answers:</b>").css("cursor", "pointer").click(() => {
                songHistoryFilter = {type: "allCorrectAnswers"};
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (let anime of correctSortedKeys) {
                if (correctAnswerIdList[anime].length > 0) {
                    let li = $("<li></li>");
                    li.append($("<span></span>").css("cursor", "pointer").addClass("answerStatsAnimeTitle").text(anime).click(() => {
                        songHistoryFilter = {type: "answer", answer: anime};
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open()
                    }));
                    li.append($("<span></span>").addClass("answerStatsNumber").text(correctAnswerIdList[anime].length));
                    $ulCorrect.append(li);
                }
            }
            let $ulWrong = $("#asWrongAnswersList").empty();
            $ulWrong.append($("<b>Wrong Answers:</b>").css("cursor", "pointer").click(() => {
                songHistoryFilter = {type: "allWrongAnswers"};
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (let anime of incorrectSortedKeys) {
                if (incorrectAnswerIdList[anime].length > 1) {
                    let li = $("<li></li>");
                    li.append($("<span></span>").css("cursor", "pointer").addClass("answerStatsAnimeTitle").text(anime).click(() => {
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
                li.append($("<span></span>").css("cursor", "pointer").addClass("answerStatsAnimeTitle").text("Other Answer").click(() => {
                    songHistoryFilter = {type: "uniqueValidWrongAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(otherAnswerIdList.length));
                $ulWrong.append(li);
            }
            if (invalidAnswerIdList.length > 0) {
                let li = $("<li></li>");
                li.append($("<span></span>").css("cursor", "pointer").addClass("answerStatsAnimeTitle").text("Invalid Answer").click(() => {
                    songHistoryFilter = {type: "invalidAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(invalidAnswerIdList.length));
                $ulWrong.append(li);
            }
            if (noAnswerIdList.length > 0) {
                let li = $("<li></li>");
                li.append($("<span></span>").css("cursor", "pointer").addClass("answerStatsAnimeTitle").text("No Answer").click(() => {
                    songHistoryFilter = {type: "noAnswers"};
                    displaySongHistoryResults(songNumber);
                    answerHistoryWindow.open();
                }));
                li.append($("<span></span>").addClass("answerStatsNumber").text(noAnswerIdList.length));
                $ulWrong.append(li);
            }

            if (answerSpeedButton) {
                displayAverageSpeedResults();
            }

            if (answerHistoryButton) {
                if (answerHistorySettings.mode === "song") {
                    songHistoryFilter = {type: "all"};
                    displaySongHistoryResults(songNumber);
                }
                else if (answerHistorySettings.mode === "player") {
                    displayPlayerHistoryResults(answerHistorySettings.playerId);
                }
                else if (answerHistorySettings.mode === "speed") {
                    displayFastestSpeedResults();
                }
            }

            if (answerCompareButton && $("answerCompareSearchInput").text()) {
                displayAnswerCompareResults();
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

    answerStatsWindow.window.find(".modal-header").empty()
        .append($(`<i class="fa fa-times clickAble" style="font-size: 25px; top: 8px; right: 15px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            answerStatsWindow.close();
        }))
        .append($(`<i class="fa fa-cog clickAble" style="font-size: 22px; top: 11px; right: 42px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            if ($("#asSettingsContainer").is(":visible")) {
                $("#asMainContainer").show();
                $("#asSettingsContainer").hide();
            }
            else {
                $("#asMainContainer").hide();
                $("#asSettingsContainer").show();
            }
        }))
        .append(`<h2>Answer Stats</h2>`)
        .append($(`<div class="tabContainer">`)
            .append($(`<div id="asAnswerHistoryTab" class="tab clickAble"><span>History</span></div>`)
                .popover({
                    container: "#gameContainer",
                    placement: "top",
                    trigger: "hover",
                    content: "complete answer history for all players and all songs in current quiz"
                })
                .click(() => {
                    answerHistoryWindow.isVisible() ? answerHistoryWindow.close() : answerHistoryWindow.open();
                })
            )
            .append($(`<div id="asAverageSpeedTab" class="tab clickAble"><span>Speed</span></div>`)
                .popover({
                    container: "#gameContainer",
                    placement: "top",
                    trigger: "hover",
                    content: "list everyone's average speed for correct answers"
                })
                .click(() => {
                    answerSpeedWindow.isVisible() ? answerSpeedWindow.close() : answerSpeedWindow.open();
                })
            )
            .append($(`<div id="asAnswerCompareTab" class="tab clickAble"><span>Compare</span></div>`)
                .popover({
                    container: "#gameContainer",
                    placement: "top",
                    trigger: "hover",
                    content: "compare answers between players to detect teaming"
                })
                .click(() => {
                    answerCompareWindow.isVisible() ? answerCompareWindow.close() : answerCompareWindow.open();
                })
            )
            /*.append($(`<div id="mcInfoTab" class="tab clickAble" style="width: 45px; margin-right: -10px; padding-right: 8px; float: right;"><h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5></div>`).click(function() {
                console.log("answer stats info tab click");
                //tabReset();
                //$(this).addClass("selected");
                //$("#asSettingsContainer").show();
            }))*/
        );

    answerStatsWindow.panels[0].panel.append(`
        <div id="asMainContainer">
            <div id="asRoomInfoRow" style="margin: 0 3px"></div>
            <div id="asSongDistributionRow" style="margin: 0 3px"><i id="asDistributionButton" class="fa fa-info-circle" aria-hidden="true"></i></div>
            <div id="asSongGuessRow" style="margin: 0 3px"></div>
            <div id="asAnswerSpeedRow" style="margin: 0 3px"></div>
            <div id="asCorrectPlayersRow" style="margin: 0 3px"></div>
            <ul id="asCorrectAnswersList" style="margin: 10px 3px 0 3px;"></ul>
            <ul id="asWrongAnswersList" style="margin: 10px 3px 0 3px;"></ul>
        </div>
        <div id="asSettingsContainer">
            <table id="asHotkeyTable">
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

    `);
    $("#asDistributionButton").popover({
        container: "#gameContainer",
        placement: "bottom",
        trigger: "hover",
        html: true
    });

    // setup answer history window
    let $div1 = $("<div></div>");
    $div1.append("<span>Answer History</span>").css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
    $div1.append($(`<label class="answerStatsIcon"><input type="file" style="display: none"><i class="fa fa-folder-open-o" aria-hidden="true"></i></label>`)
        .popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            content: "open json file"
        })
    );
    $div1.append($(`<div class="answerStatsIcon"><i class="fa fa-floppy-o" aria-hidden="true"></i></div>`)
        .popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            content: "save current game results to json file"
        })
        .click(() => {
            saveResults();
        })
    );
    $div1.append($(`<div class="answerStatsIcon"><i class="fa fa-clock-o" aria-hidden="true"></i></div>`)
        .popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            content: "show fastest speed for each song"
        })
        .click(() => {
            displayFastestSpeedResults();
        })
    );
    $div1.find("input").on("change", function() {
        if (quiz.inQuiz) {
            messageDisplayer.displayMessage("Don't do this in quiz");
        }
        else {
            if (this.files.length) {
                this.files[0].text().then((data) => {
                    try {
                        let json = JSON.parse(data);
                        //console.log(json);
                        if (json.playerInfo && json.songHistory) {
                            // support for older version of this script
                            if (Object.values(json.songHistory)[0].romaji) {
                                for (song of Object.values(json.songHistory)) {
                                    song.animeRomajiName = song.romaji;
                                    delete song.romaji;
                                    song.animeEnglishName = song.english;
                                    delete song.english;
                                    song.songNumber = song.number;
                                    delete song.number;
                                    song.songArtist = song.artist;
                                    delete song.artist;
                                    song.songName = song.song;
                                    delete song.song;
                                    song.songTypeText = song.type;
                                    delete song.type;
                                    song.animeVintage = song.vintage;
                                    delete song.vintage;
                                    song.songDifficulty = song.difficulty;
                                    delete song.difficulty;
                                }
                            }
                            answerHistorySettings = {mode: "song", songNumber: null, playerId: null, roomType: json.roomType, roomName: json.roomName};
                            playerInfo = json.playerInfo;
                            songHistory = json.songHistory;
                            songHistoryFilter = {type: "all"};
                            displaySongHistoryResults(Object.values(songHistory)[0].songNumber);
                            displayAverageSpeedResults();
                        }
                    }
                    catch {
                        messageDisplayer.displayMessage("Upload Error");
                    }
                });
            }
        }
    });
    $div1.append($(`<div class="answerStatsIcon filterButton"><i class="fa fa-refresh" aria-hidden="true"></i></div>`)
        .popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            content: "reset answer filter"
        })
        .click(function() {
            $(this).hide();
            songHistoryFilter = {type: "all"};
            displaySongHistoryResults(answerHistorySettings.songNumber);
        })
        .hide()
    );
    let $div2 = $("<div></div>").css({"float": "left", "margin-top": "3px"});
    let $button1 = $(`<div class="infoButton"><i class="fa fa-info-circle" aria-hidden="true"></i></div>`).hide().popover({
        container: "#gameContainer",
        placement: "bottom",
        trigger: "hover",
        html: true,
        title: "",
        content: ""
    });
    let $button2 = $(`<div class="answerStatsButton arrowButton">«</div>`).hide().click(() => {
        if (Object.keys(songHistory).length) {
            songHistoryFilter = {type: "all"};
            displaySongHistoryResults(parseInt(Object.keys(songHistory)[0]));
        }
    });
    let $button3 = $(`<div class="answerStatsButton arrowButton">‹</div>`).hide().click(() => {
        if (Object.keys(songHistory).length) {
            let songNumber = answerHistorySettings.songNumber;
            if (songNumber !== Object.values(songHistory)[0].songNumber) {
                songHistoryFilter = {type: "all"};
                displaySongHistoryResults(songNumber - 1);
            }
        }
    });
    let $button4 = $(`<div class="answerStatsButton arrowButton">›</div>`).hide().click(() => {
        if (Object.keys(songHistory).length) {
            let songNumber = answerHistorySettings.songNumber;
            if (songNumber !== Object.values(songHistory).slice(-1)[0].songNumber) {
                songHistoryFilter = {type: "all"};
                displaySongHistoryResults(songNumber + 1);
            }
        }
    });
    let $button5 = $(`<div class="answerStatsButton arrowButton">»</div>`).hide().click(() => {
        if (Object.keys(songHistory).length) {
            songHistoryFilter = {type: "all"};
            displaySongHistoryResults(Object.values(songHistory).slice(-1)[0].songNumber);
        }
    });
    let $button6 = $(`<div class="answerStatsButton backButton">back</div>`).hide().click(() => {
        if (Object.keys(songHistory).length) {
            if (songHistory[answerHistorySettings.songNumber]) displaySongHistoryResults(answerHistorySettings.songNumber);
            else displaySongHistoryResults(Object.values(songHistory).slice(-1)[0].songNumber);
        }
    });
    $div2.append(`<span id="answerHistoryCurrentSong" style="font-size: 16px; margin: 0 8px 0 8px;">Song: </span>`);
    $div2.append($button1).append($button2).append($button3).append($button4).append($button5).append($button6);
    $div2.append($(`<span id="answerHistoryCurrentPlayer" style="font-size: 16px; margin: 0 8px 0 8px;">Player: </span>`).hide().popover({
        container: "#gameContainer",
        placement: "top",
        trigger: "hover",
        html: true,
        title: "",
        content: ""
    }));
    answerHistoryWindow.window.find(".modal-header h2").remove();
    answerHistoryWindow.window.find(".modal-header").append($div1).append($div2);

    // setup average spped window
    $div1 = $(`<div>Average Speed</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
    $div2 = $(`<div></div>`).css("margin", "0 0 0 8px");
    $button1 = $(`<div id="averageSpeedSortModeButton" class="answerStatsButton">${averageSpeedSort.mode}</div>`).click(function() {
        if (averageSpeedSort.mode === "time") averageSpeedSort.mode = "name";
        else if (averageSpeedSort.mode === "name") averageSpeedSort.mode = "score";
        else if (averageSpeedSort.mode === "score") averageSpeedSort.mode = "time";
        $(this).text(averageSpeedSort.mode);
        displayAverageSpeedResults();
    });
    $button2 = $(`<div id="averageSpeedSortDirectionButton" class="answerStatsButton">${averageSpeedSort.ascending ? "🡅" : "🡇"}</div>`).click(function() {
        averageSpeedSort.ascending = !averageSpeedSort.ascending;
        $(this).text(averageSpeedSort.ascending ? "🡅" : "🡇");
        displayAverageSpeedResults();
    });
    $div2.append(`<span style="font-size: 16px">Sort:</span>`);
    $div2.append($button1);
    $div2.append($button2);
    answerSpeedWindow.window.find(".modal-header h2").remove();
    answerSpeedWindow.window.find(".modal-header").append($div1).append($div2);

    // setup answer compare window
    $div1 = $(`<div>Answer Compare</div>`).css({"font-size": "23px", "line-height": "normal", "margin": "6px 0 2px 8px"});
    $div2 = $("<div></div>").css({"float": "left", "margin": "3px 0 0 8px"});
    let $input = $(`<input id="answerCompareSearchInput" type="text">`).keypress((event) => {
        if (event.which === 13) {
            displayAnswerCompareResults($("#answerCompareSearchInput").val());
        }
    });
    let $button = $(`<div id="answerCompareButtonGo" class="answerStatsButton">Go</div>"`).click(() => {
        displayAnswerCompareResults($("#answerCompareSearchInput").val());
    });
    let $correctCheckbox = $(`<input id="answerCompareHighlightCorrectCheckbox" type="checkbox"></input>`).click(() => {
        setTimeout(() => { displayAnswerCompareResults($("#answerCompareSearchInput").val()) }, 1);
    });
    let $wrongCheckbox = $(`<input id="answerCompareHighlightWrongCheckbox" type="checkbox">`).click(() => {
        setTimeout(() => { displayAnswerCompareResults($("#answerCompareSearchInput").val()) }, 1);
    });
    $div2.append($input);
    $div2.append($button);
    $div2.append($(`<label class="clickAble" style="margin-left: 10px">Correct</label>`).append($correctCheckbox));
    $div2.append($(`<label class="clickAble" style="margin-left: 10px">Wrong</label>`).append($wrongCheckbox));
    answerCompareWindow.window.find(".modal-header h2").remove();
    answerCompareWindow.window.find(".modal-header").append($div1).append($div2);

    document.body.addEventListener("keydown", (event) => {
        const key = event.key;
        const altKey = event.altKey;
        const ctrlKey = event.ctrlKey;
        if (testHotkey("asWindow", key, altKey, ctrlKey)) {
            answerStatsWindow.isVisible() ? answerStatsWindow.close() : answerStatsWindow.open();
        }
        if (testHotkey("historyWindow", key, altKey, ctrlKey)) {
            answerHistoryWindow.isVisible() ? answerHistoryWindow.close() : answerHistoryWindow.open();
        }
        if (testHotkey("speedWindow", key, altKey, ctrlKey)) {
            answerSpeedWindow.isVisible() ? answerSpeedWindow.close() : answerSpeedWindow.open();
        }
        if (testHotkey("compareWindow", key, altKey, ctrlKey)) {
            answerCompareWindow.isVisible() ? answerCompareWindow.close() : answerCompareWindow.open();
        }
        if (testHotkey("saveResults", key, altKey, ctrlKey)) {
            saveResults();
        }
    });

    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#answerStatsWindow').show()">Answer Stats</li>`);
    $("#asSettingsContainer").hide();
    createHotkeyElement("Open This Window", "asWindow", "asWindowHotkeySelect", "asWindowHotkeyInput");
    createHotkeyElement("Open History Window", "historyWindow", "asHistoryWindowHotkeySelect", "asHistoryWindowHotkeyInput");
    createHotkeyElement("Open Speed Window", "speedWindow", "asSpeedWindowHotkeySelect", "asSpeedWindowHotkeyInput");
    createHotkeyElement("Open Compare Window", "compareWindow", "asCompareWindowHotkeySelect", "asCompareWindowHotkeyInput");
    createHotkeyElement("Save Results", "saveResults", "asSaveResultsHotkeySelect", "asSaveResultsHotkeyInput");
    AMQ_addScriptData({
        name: "Answer Stats",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js",
        description: `
            <p>Click the button in the options bar during quiz to open the answer stats window</p>
        `
    });
    applyStyles();
}

// display average time list in time track window
function displayAverageSpeedResults() {
    answerSpeedWindow.panels[0].clear();
    let sortedIds = [];
    if (averageSpeedSort.mode === "time") {
        sortedIds = averageSpeedSort.ascending
            ? Object.keys(playerInfo).sort((a, b) => playerInfo[a].averageSpeed - playerInfo[b].averageSpeed)
            : Object.keys(playerInfo).sort((a, b) => playerInfo[b].averageSpeed - playerInfo[a].averageSpeed);
    }
    else if (averageSpeedSort.mode === "name") {
        sortedIds = averageSpeedSort.ascending
            ? Object.keys(playerInfo).sort((a, b) => playerInfo[a].name.localeCompare(playerInfo[b].name))
            : Object.keys(playerInfo).sort((a, b) => playerInfo[b].name.localeCompare(playerInfo[a].name));
    }
    else if (averageSpeedSort.mode === "score") {
        sortedIds = averageSpeedSort.ascending
            ? Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat().reverse()
            : Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat();
    }
    let $results = $(`<div id="averageSpeedResults"></div>`);
    for (let id of sortedIds) {
        let player = playerInfo[id];
        if (player) {
            let $row = $("<div></div>");
            if (player.name === selfName) $row.addClass("self");
            else if (socialTab.isFriend(player.name)) $row.addClass("friend");
            else if (socialTab.isBlocked(player.name)) $row.addClass("blocked");
            if (customColorMap.hasOwnProperty(player.name.toLowerCase())) $row.addClass("customColor" + customColorMap[player.name.toLowerCase()]);
            $row.append(`<span class="time">${Math.round(player.averageSpeed)}</span>`);
            //$row.append(`<span class="time">${Math.round(player.standardDeviation)}</span>`);
            $row.append($(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`).click(() => {
                playerProfileController.loadProfile(player.name, $("#answerSpeedWindow"), {}, () => {}, false, true);
            }));
            $row.append($(`<span class="name">${player.name}</span>`).css("cursor", "pointer").click(() => {
                displayPlayerHistoryResults(id);
                answerHistoryWindow.open();
            }));
            $row.append(`<span class="score">${player.score}</span>`);
            $results.append($row);
        }
    }
    answerSpeedWindow.panels[0].panel.append($results);
}

// create a table with each row being 1 player
function displaySongHistoryResults(songNumber) {
    let song = songHistory[songNumber];
    if (!song) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentSong").text("Song: " + songNumber);
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").hide();
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .speedButton").show();
    songHistoryFilter.type === "all" ? answerHistoryWindow.window.find(".filterButton").hide() : answerHistoryWindow.window.find(".filterButton").show();
    //answerHistoryWindow.window.find(".infoButton").data("bs.popover").options.title = "Song " + songNumber;
    answerHistoryWindow.window.find(".infoButton").data("bs.popover").options.content = $("<div></div>")
        .append($(`<p></p>`).text(song.songName))
        .append($(`<p></p>`).text(song.songArtist))
        .append($(`<p></p>`).text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName).css("color", getComputedStyle(document.documentElement).getPropertyValue("--accentColorContrast") || "#4497ea"))
        .append($(`<p></p>`).text(`${song.songTypeText} (${Number(song.songDifficulty).toFixed(1)}) ${song.animeVintage}`))
    answerHistoryWindow.panels[0].clear();
    let $table = $(`<table id="answerHistoryTable" class="styledTable songMode"></table>`);
    let $thead = $("<thead></thead>");
    let $tbody = $("<tbody></tbody>");
    let $row = $(`<tr></tr>`).css("cursor", "pointer");
    $row.append($("<th></th>").addClass("rank").text("Rank"));
    $row.append($("<th></th>").addClass("box").text("Box"));
    $row.append($("<th></th>").addClass("score").text("Score"));
    $row.append($("<th></th>").addClass("level").text("Level"));
    $row.append($("<th></th>").addClass("name").text("Name"));
    $row.append($("<th></th>").addClass("speed").text("Speed"));
    $row.append($("<th></th>").addClass("answer").text("Answer"));
    $thead.append($row);
    let sortedIds = [];
    if (songHistorySort.mode === "position") {
        sortedIds = songHistorySort.ascending
            ? sortedIds = Object.values(song.groupSlotMap).flat()
            : sortedIds = Object.values(song.groupSlotMap).flat().reverse();
    }
    else if (songHistorySort.mode === "level") {
        sortedIds = songHistorySort.ascending
            ? Object.keys(song.answers).sort((a, b) => playerInfo[a].level - playerInfo[b].level)
            : Object.keys(song.answers).sort((a, b) => playerInfo[b].level - playerInfo[a].level);
    }
    else if (songHistorySort.mode === "name") {
        sortedIds = songHistorySort.ascending
            ? Object.keys(song.answers).sort((a, b) => playerInfo[a].name.localeCompare(playerInfo[b].name))
            : Object.keys(song.answers).sort((a, b) => playerInfo[b].name.localeCompare(playerInfo[a].name));
    }
    else if (songHistorySort.mode === "speed") {
        sortedIds = songHistorySort.ascending
            ? Object.keys(song.answers).sort((a, b) => song.answers[a].speed - song.answers[b].speed)
            : Object.keys(song.answers).sort((a, b) => song.answers[b].speed - song.answers[a].speed);
    }
    else if (songHistorySort.mode === "answer") {
        sortedIds = songHistorySort.ascending
            ? Object.keys(song.answers).sort((a, b) => song.answers[a].text.localeCompare(song.answers[b].text))
            : Object.keys(song.answers).sort((a, b) => song.answers[b].text.localeCompare(song.answers[a].text));
    }
    for (let id of sortedIds) {
        let player = playerInfo[id];
        let answer = song.answers[id];
        if (player && answer) {
            if (songHistoryFilter.type === "all" || (songHistoryFilter.type === "allCorrectAnswers" && answer.correct) || (songHistoryFilter.type === "allWrongAnswers" && !answer.correct) ||
            (songHistoryFilter.type === "answer" && songHistoryFilter.answer.toLowerCase() === answer.text.toLowerCase()) || (songHistoryFilter.type === "noAnswers" && answer.noAnswer) ||
            (songHistoryFilter.type === "uniqueValidWrongAnswers" && answer.uniqueAnswer) || (songHistoryFilter.type === "invalidAnswers" && answer.invalidAnswer)) {
                let $row = $(`<tr></tr>`).addClass(colorClass(player.name));
                $row.append($("<td></td>").addClass("rank").text(answer.rank));
                $row.append($("<td></td>").css("cursor", "pointer").addClass("box").text(findBoxById(player.id, song.groupSlotMap)));
                $row.append($("<td></td>").addClass("score").text(answer.score));
                $row.append($("<td></td>").addClass("level").text(player.level));
                $row.append($("<td></td>").css("cursor", "pointer").addClass("name").text(player.name).prepend($(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`)));
                $row.append($("<td></td>").addClass("speed").text(answer.speed ? answer.speed : ""));
                $row.append($("<td></td>").css("cursor", "pointer").addClass("answer").text(answer.text).prepend($(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}" aria-hidden="true"></i>`)));
                $tbody.append($row);
            }
        }
    }
    $thead.on("click", "th", (event) => {
        if (event.target.classList.contains("rank")) {
            tableSortChange(songHistorySort, "position");
        }
        else if (event.target.classList.contains("box")) {
            tableSortChange(songHistorySort, "position");
        }
        else if (event.target.classList.contains("score")) {
            tableSortChange(songHistorySort, "position");
        }
        else if (event.target.classList.contains("level")) {
            tableSortChange(songHistorySort, "level");
        }
        else if (event.target.classList.contains("name")) {
            tableSortChange(songHistorySort, "name");
        }
        else if (event.target.classList.contains("speed")) {
            tableSortChange(songHistorySort, "speed");
        }
        else if (event.target.classList.contains("answer")) {
            tableSortChange(songHistorySort, "answer");
        }
        displaySongHistoryResults(answerHistorySettings.songNumber);
    });
    $tbody.on("click", "td", (event) => {
        if (event.target.classList.contains("name")) {
            displayPlayerHistoryResults(Object.values(playerInfo).find((player) => player.name === event.target.innerText).id);
        }
        else if (event.target.classList.contains("box")) {
            selectAvatarGroup(parseInt(event.target.innerText));
        }
        else if (event.target.classList.contains("answer")) {
            songHistoryFilter = {type: "answer", answer: event.target.innerText};
            displaySongHistoryResults(answerHistorySettings.songNumber);
        }
    });
    $tbody.on("click", "i.fa-id-card-o", (event) => {
        playerProfileController.loadProfile(event.target.parentElement.innerText, $("#answerHistoryWindow"), {}, () => {}, false, true);
    });
    $table.append($thead).append($tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "song";
    answerHistorySettings.songNumber = songNumber;
}

// create a table with each row being 1 answer
function displayPlayerHistoryResults(id) {
    let player = playerInfo[id];
    if (!player) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer").text("Player: " + player.name);
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .filterButton").hide();
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").show();
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer").data("bs.popover").options.content = `
        <p>Current Sore: ${player.score}</p>
        <p>Level: ${player.level}</p>
        <p>Average Speed: ${Math.round(player.averageSpeed)}</p>
    `;
    answerHistoryWindow.panels[0].clear();
    let $table = $(`<table id="answerHistoryTable" class="styledTable playerMode"></table>`);
    let $thead = $("<thead></thead>");
    let $tbody = $("<tbody></tbody>");
    let $row = $(`<tr></tr>`);
    $row.append($("<th></th>").css("cursor", "pointer").addClass("songNumber").text("#"));
    $row.append($("<th></th>").css("cursor", "pointer").addClass("songDifficulty").text("Dif"));
    $row.append($("<th></th>").css("cursor", "pointer").addClass("speed").text("Speed"));
    $row.append($("<th></th>").css("cursor", "pointer").addClass("answer").text("Answer"));
    $thead.append($row);
    let sortedIds = Object.keys(songHistory).filter((songNumber) => songHistory[songNumber].answers[id]);
    if (playerHistorySort.mode === "number") {
        playerHistorySort.ascending
            ? sortedIds.sort((a, b) => parseInt(a) - parseInt(b))
            : sortedIds.sort((a, b) => parseInt(b) - parseInt(a));
    }
    else if (playerHistorySort.mode === "difficulty") {
        playerHistorySort.ascending
            ? sortedIds.sort((a, b) => songHistory[a].songDifficulty - songHistory[b].songDifficulty)
            : sortedIds.sort((a, b) => songHistory[b].songDifficulty - songHistory[a].songDifficulty);
    }
    else if (playerHistorySort.mode === "speed") {
        playerHistorySort.ascending
            ? sortedIds.sort((a, b) => songHistory[a].answers[id].speed - songHistory[b].answers[id].speed)
            : sortedIds.sort((a, b) => songHistory[b].answers[id].speed - songHistory[a].answers[id].speed);
    }
    else if (playerHistorySort.mode === "answer") {
        playerHistorySort.ascending
            ? sortedIds.sort((a, b) => songHistory[a].answers[id].text.localeCompare(songHistory[b].answers[id].text))
            : sortedIds.sort((a, b) => songHistory[b].answers[id].text.localeCompare(songHistory[a].answers[id].text));
    }
    for (let songNumber of sortedIds) {
        let answer = songHistory[songNumber].answers[id];
        let $row = $("<tr></tr>");
        $row.append($("<td></td>").css("cursor", "pointer").addClass("songNumber").text(songNumber));
        $row.append($("<td></td>").addClass("songDifficulty").text(Math.round(songHistory[songNumber].songDifficulty)));
        $row.append($("<td></td>").addClass("speed").text(answer.speed || ""));
        $row.append($("<td></td>").addClass("answer").text(answer.text).prepend(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}">`));
        $tbody.append($row);
    }
    $thead.on("click", "th", (event) => {
        if (event.target.classList.contains("songNumber")) {
            tableSortChange(playerHistorySort, "number");
        }
        else if (event.target.classList.contains("songDifficulty")) {
            tableSortChange(playerHistorySort, "difficulty");
        }
        else if (event.target.classList.contains("speed")) {
            tableSortChange(playerHistorySort, "speed");
        }
        else if (event.target.classList.contains("answer")) {
            tableSortChange(playerHistorySort, "answer");
        }
        displayPlayerHistoryResults(answerHistorySettings.playerId);
    });
    $tbody.on("click", "td", (event) => {
        if (event.target.classList.contains("songNumber")) {
            songHistoryFilter = {type: "all"};
            displaySongHistoryResults(parseInt(event.target.innerText));
        }
    });
    $table.append($thead).append($tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "player";
    answerHistorySettings.playerId = id;
}

// create a table with each row showing the song #, fastest speed, and fastest player(s)
function displayFastestSpeedResults() {
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .filterButton, #answerHistoryCurrentPlayer").hide();
    answerHistoryWindow.window.find(".backButton").show();
    answerHistoryWindow.panels[0].clear();
    let $table = $(`<table id="answerHistoryTable" class="styledTable speedMode"></table>`);
    let $thead = $("<thead></thead>");
    let $tbody = $("<tbody></tbody>");
    let $row = $(`<tr></tr>`);
    $row.append($("<th></th>").addClass("songNumber").text("#"));
    $row.append($("<th></th>").addClass("anime").text("Anime"));
    $row.append($("<th></th>").addClass("speed").text("Speed"));
    $row.append($("<th></th>").addClass("name").text("Name"));
    $thead.append($row);
    for (let song of Object.values(songHistory)) {
        let $row = $(`<tr></tr>`);
        $row.append($("<td></td>").css("cursor", "pointer").addClass("songNumber").text(song.songNumber));
        $row.append($("<td></td>").addClass("anime").text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName));
        $row.append($("<td></td>").addClass("speed").text(song.fastestSpeed ?? ""));
        let $tdName = $("<td></td>").addClass("name");
        for (let id of song.fastestPlayers) {
            let name = playerInfo[id].name;
            $tdName.append($("<span></span>").css("cursor", "pointer").addClass(colorClass(name)).text(name));
        }
        $row.append($tdName);
        $tbody.append($row);
    }
    $tbody.on("click", "td", (event) => {
        if (event.target.classList.contains("songNumber")) {
            displaySongHistoryResults(parseInt(event.target.innerText));
        }
    });
    $tbody.on("click", "span", (event) => {
        displayPlayerHistoryResults(Object.values(playerInfo).find((player) => player.name === event.target.innerText).id);
    });
    $table.append($thead).append($tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "speed";
}

function displayAnswerCompareResults(text) {
    answerCompareWindow.panels[0].clear();
    let players = text.split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase());
    if (players.length < 2) {
        answerCompareWindow.panels[0].panel.append(`<p>Please add 2 or more players</p>`);
        return;
    }
    let idList = [];
    for (let name of players) {
        let item = Object.values(playerInfo).find((x) => x.name.toLowerCase() === name);
        if (item) {
            idList.push(item.id);
        }
        else {
            answerCompareWindow.panels[0].panel.append(`<p>Not found: ${name}</p>`);
            return;
        }
    }
    let highlightCorrect = $("#answerCompareHighlightCorrectCheckbox").prop("checked");
    let highlightWrong = $("#answerCompareHighlightWrongCheckbox").prop("checked");
    let $table = $(`<table id="answerCompareTable" class="styledTable"></table>`);
    let $thead = $("<thead></thead>");
    let $tbody = $("<tbody></tbody>");
    let $row = $(`<tr><th class="songNumber">#</th></tr>`);
    for (let id of idList) {
        $row.append(`<th>${playerInfo[id].name} (${playerInfo[id].score})</th>`);
    }
    $thead.append($row);
    for (let songNumber of Object.keys(songHistory)) {
        let numCorrect = 0;
        let numWrong = 0;
        let $row = $(`<tr></tr>`);
        $row.append($("<td></td>").css("cursor", "pointer").addClass("songNumber").text(songNumber).click(() => {
            displaySongHistoryResults(songNumber);
            answerHistoryWindow.open();
        }));
        for (let id of idList) {
            let answer = songHistory[songNumber].answers[id];
            if (answer) {
                answer.correct ? numCorrect++ : numWrong++;
                $row.append($("<td></td>").text(answer.text).prepend(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}"></i>`));
            }
            else {
                $row.append("<td></td>");
            }
        }
        if (highlightCorrect && numCorrect === idList.length) {
            $row.addClass("highlightCorrect");
        }
        else if (highlightWrong && numWrong === idList.length) {
            $row.addClass("highlightWrong");
        }
        $tbody.append($row);
    }
    $table.append($thead).append($tbody);
    answerCompareWindow.panels[0].panel.append($table);
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

function roomNameText() {
    if (!quiz.inQuiz) return "";
    if (quiz.gameMode === "Ranked") {
        let region = regionDictionary[$("#mpRankedTimer h3").text()] || "";
        let type = hostModal.$roomName.val();
        return region + " " + type;
    }
    return quiz.gameMode + " Quiz";
}

function difficultyInfoText(roomName) {
    if (roomName.includes("Ranked Novice")) {
        return `
            <table id="asDistributionTable">
                <thead>
                    <tr>
                        <td>Dif</td>
                        <td>OP</td>
                        <td>ED</td>
                        <td>IN</td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>60-100</td>
                        <td>9</td>
                        <td>2</td>
                        <td>1</td>
                    </tr>
                    <tr>
                        <td>45-60</td>
                        <td>8</td>
                        <td>2</td>
                        <td>2</td>
                    </tr>
                    <tr>
                        <td>30-45</td>
                        <td>5</td>
                        <td>2</td>
                        <td>2</td>
                    </tr>
                    <tr>
                        <td>25-35</td>
                        <td>3</td>
                        <td>2</td>
                        <td>2</td>
                    </tr>
                    <tr>
                        <td>0-25</td>
                        <td>2</td>
                        <td>2</td>
                        <td>1</td>
                    </tr>
                    <tr>
                        <td>Total</td>
                        <td>27</td>
                        <td>10</td>
                        <td>8</td>
                    </tr>
                </tbody>
            </table>
        `;
    }
    if (roomName.includes("Ranked Expert")) {
        return "song selection is completely random";
    }
    return "";
}

function colorClass(name) {
    let c = "";
    let nameLower = name.toLowerCase();
    if (name === selfName) c = "self";
    if (socialTab.isFriend(name)) c = "friend";
    if (socialTab.isBlocked(name)) c = "blocked";
    if (customColorMap.hasOwnProperty(nameLower)) c += " customColor" + customColorMap[nameLower];
    return c;
}

function getScore(player) {
    if (quiz.scoreboard.scoreType === 1) return player.score;
    return player.correctGuesses;
}

function resetHistory() {
    songHistory = {};
    playerInfo = {};
    answerHistorySettings = {mode: "song", songNumber: null, playerId: null, roomType: "", roomName: ""};
    answerHistoryWindow.window.find("#answerHistoryCurrentSong").text("Song: ");
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .infoButton, .arrowButton, .backButton, .speedButton, .filterButton").hide();
    //$("#asMainContainer").empty();
    answerHistoryWindow.panels[0].clear();
    answerSpeedWindow.panels[0].clear();
    answerCompareWindow.panels[0].clear();
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

// used for sorting table contents when you click a header
function tableSortChange(obj, mode) {
    if (obj.mode === mode) {
        obj.ascending = !obj.ascending;
    }
    else {
        obj.mode = mode;
        obj.ascending = true;
    }
}

// clear and update room and player data
function joinRoomUpdate(data) {
    //console.log(data)
    resetHistory();
    answerHistorySettings.roomType = data.settings.gameMode;
    if (answerHistorySettings.roomType === "Ranked") {
        answerHistorySettings.roomName = regionDictionary[$("#mpRankedTimer h3").text()] + " " + payload.settings.roomName;
    }
    else {
        answerHistorySettings.roomName = data.settings.roomName;
    }
    /*
    for (let player of data.quizState.players) {
        playerInfo[player.gamePlayerId] = {
            name: player.name,
            id: player.gamePlayerId,
            level: player.level,
            score: player.score,
            rank: player.position,
            correctSpeedList: [],
            averageSpeed: 0,
            standardDeviation: 0
        };
    }
    for (let song of data.quizState.songHistory) {
        let songInfo = song.historyInfo.songInfo;
        let answers = {};
        for (let name of song.historyInfo.correctGuessPlayers) {
            let player = Object.values(playerInfo).find(p => p.name === name);
            if (player) {
                //playerInfo[player.gamePlayerId].score += 1;
                answers[player.id] = {
                    id: 153,
                    //text: "",
                    //speed: null,
                    correct: true,
                    //rank: 1,
                    //score: playerInfo[player.gamePlayerId]++,
                    //noAnswer: true
                }
            }
        }
        songHistory[song.songNumber] = {
            animeRomajiName: songInfo.animeNames.romaji,
            animeEnglishName: songInfo.animeNames.english,
            altAnimeNames: songInfo.altAnimeNames,
            altAnimeNamesAnswers: songInfo.altAnimeNamesAnswers,
            animeType: songInfo.animeType,
            animeVintage: songInfo.vintage,
            animeTags: songInfo.animeTags,
            animeGenre: songInfo.animeGenre,
            songNumber: song.historyInfo.songNumber,
            songArtist: songInfo.artist,
            songName: songInfo.songName,
            songType: songInfo.type,
            songTypeNumber: songInfo.typeNumber,
            songTypeText: typeText(songInfo.type, songInfo.typeNumber),
            songDifficulty: songInfo.animeDifficulty,
            rebroadcast: songInfo.rebroadcast,
            dub: songInfo.dub,
            annId: songInfo.siteIds.annId,
            malId: songInfo.siteIds.malId,
            kitsuId: songInfo.siteIds.kitsuId,
            aniListId: songInfo.siteIds.aniListId,
            startPoint: song.historyInfo.startPoint,
            audio: null,
            video480: null,
            video720: null,
            groupSlotMap: null,
            answers: answers
        };
    }
    */
}

function saveResults() {
    if (Object.keys(songHistory).length === 0 || Object.keys(playerInfo).length === 0) return;
    let date = new Date();
    let dateFormatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, 0)}-${String(date.getDate()).padStart(2, 0)}`;
    let timeFormatted = `${String(date.getHours()).padStart(2, 0)}.${String(date.getMinutes()).padStart(2, 0)}.${String(date.getSeconds()).padStart(2, 0)}`;
    let fileName = answerHistorySettings.roomType = "Ranked"
        ? `${dateFormatted} ${answerHistorySettings.roomName} Answer History.json`
        : `${dateFormatted} ${timeFormatted} ${answerHistorySettings.roomType} Answer History.json`;
    let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        date: dateFormatted,
        roomType: answerHistorySettings.roomType,
        roomName: answerHistorySettings.roomName,
        playerInfo: playerInfo,
        songHistory: songHistory
    }));
    let element = document.createElement("a");
    element.setAttribute("href", data);
    element.setAttribute("download", fileName);
    document.body.appendChild(element);
    element.click();
    element.remove();
}

function printCorrelations(numberOfResults) {
    let keys = Object.keys(playerInfo);
    let combinations = keys.flatMap((v, i) => keys.slice(i + 1).map(w => [v, w]));
    let percentages = {};
    let sortedKeys = [];
    combinations.forEach((x, i) => {
        if (playerInfo[x[0]].score > 10 && playerInfo[x[1]].score > 10) {
            percentages[i] = calculateCorrelation(x[0], x[1]);
        }
    });
    sortedKeys = Object.keys(percentages).sort((a, b) => percentages[b] - percentages[a]);
    for (let i = 0; i < numberOfResults; i++) {
        let index = parseInt(sortedKeys[i]);
        let name1 = playerInfo[combinations[index][0]].name;
        let name2 = playerInfo[combinations[index][1]].name;
        console.log(`${percentages[index]} ${name1} ${name2}`);
    }
}

function calculateCorrelation(id1, id2) {
    //console.log(`${id1}: ${playerInfo[id1].name}   ${id2}: ${playerInfo[id2].name}`);
    let count = 0;
    for (let song of Object.values(songHistory)) {
        let answer1 = song.answers[id1]?.correct ?? null;
        let answer2 = song.answers[id2]?.correct ?? null;
        if (answer1 !== null && answer1 === answer2) count++;
    }
    return ((count / Object.keys(songHistory).length) * 100).toFixed(2);
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
    $("#asHotkeyTable tbody").append($(`<tr></tr>`).append($(`<td></td>`).text(title)).append($(`<td></td>`).append($select)).append($(`<td></td>`).append($input)));
}

// test hotkey
function testHotkey(action, key, altKey, ctrlKey) {
    let hotkey = hotKeys[action];
    return key === hotkey.key && altKey === hotkey.altKey && ctrlKey === hotkey.ctrlKey;
}

// save settings
function saveSettings() {
    let settings = {
        showPlayerColors,
        showCustomColors,
        hotKeys,
    };
    localStorage.setItem("answerStats", JSON.stringify(settings));
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
    $("#answerStatsStyle").remove();
    const saveData2 = validateLocalStorage("highlightFriendsSettings");
    customColorMap = {};
    let selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
    let friendColor = saveData2.smColorFriendColor ?? "#80ff80";
    let blockedColor = saveData2.smColorBlockedColor ?? "#ff8080";
    let customColors = saveData2.customColors ?? [];
    customColors.forEach((item, index) => {
        for (let player of item.players) {
            customColorMap[player] = index;
        }
    });
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "answerStatsStyle";
    let text = `
        #qpAnswerStats {
            width: 30px;
            margin-right: 5px;
        }
        #answerStatsWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #answerStatsWindow .modal-header h2 {
            font-size: 22px;
            text-align: left;
            height: 45px;
            margin: 0;
            padding: 10px;
            display: block;
        }
        #answerStatsWindow .modal-header .tabContainer {
            border-bottom: none;
        }
        #answerStatsWindow .modal-header .tabContainer .tab::before {
            box-shadow: none;
        }
        #answerStatsWindow .modal-header i.fa:hover {
            opacity: .7;
        }
        #answerStatsWindow .tabContainer .tab:hover {
            opacity: .8;
        }
        .answerStatsRow {
            margin: 0 2px;
        }
        .answerStatsNumber {
            opacity: .7;
            margin-left: 8px;
        }
        .answerStatsButton {
            border: 1px solid #D9D9D9;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
            display: inline-block;
            cursor: pointer;
            user-select: none;
        }
        .answerStatsButton:hover {
            opacity: .8;
        }
        #asHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #asHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #asHotkeyTable select, #asHotkeyTable input {
            color: black;
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
        #averageSpeedSortModeButton, #averageSpeedSortDirectionButton {
            margin: 5px 0 5px 5px;
            padding: 0 5px;
        }
        #answerSpeedWindow span.time {
            width: 48px;
            display: inline-block;
        }
        #answerSpeedWindow i.fa {
            margin-right: 3px;
            display: inline-block;
        }
        #answerSpeedWindow span.name {
            display: inline-block;
        }
        #answerSpeedWindow span.score {
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
        #answerHistoryWindow .arrowButton {
            width: 27px;
            font-size: 24px;
            line-height: .8;
            vertical-align: top;
            margin: 0 2px;
            padding: 0 0 3px 0;
        }
        #answerHistoryWindow .backButton {
            margin: 0 2px;
            padding: 0 5px;
        }
        #answerHistoryWindow .infoButton {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            vertical-align: top;
            margin: 0 2px;
            padding: 0 8px 0 0;
            display: inline-block;
            cursor: pointer;
            user-select: none;
        }
        #answerHistoryWindow .answerStatsIcon {
            font-size: 22px;
            margin: 0 0 0 8px;
            vertical-align: top;
            display: inline-block;
            user-select: none;
            cursor: pointer;
        }
        #answerHistoryWindow .answerStatsButton:hover, #answerHistoryWindow .answerStatsIcon:hover {
            opacity: .8;
        }
        #answerHistoryWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerHistoryTable {
            width: 100%;
            table-layout: fixed;
        }
        #answerHistoryTable th, #answerHistoryTable td {
            padding: 0 4px;
        }
        #answerHistoryTable thead tr {
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
            width: 30px;
        }
        #answerHistoryTable.playerMode .songDifficulty {
            width: 30px;
        }
        #answerHistoryTable.playerMode .speed {
            width: 60px;
        }
        #answerHistoryTable.playerMode .answer {
            width: auto;
        }
        #answerHistoryTable.speedMode .songNumber {
            width: 30px;
        }
        #answerHistoryTable.speedMode .anime {
            width: 50%;
        }
        #answerHistoryTable.speedMode .speed {
            width: 55px;
        }
        #answerHistoryTable.speedMode .name {
            width: 50%;
        }
        #answerHistoryTable.speedMode .name span {
            margin-right: 10px;
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
        #answerCompareButtonGo {
            margin: 0 0 0 5px;
            padding: 0 5px;
        }
        #answerCompareWindow .modal-header input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-left: 3px;
            vertical-align: -5px;
            cursor: pointer;
        }
        #answerCompareWindow .close {
            top: 15px;
            right: 15px;
            position: absolute;
        }
        #answerCompareTable {
            width: 100%;
            table-layout: fixed;
        }
        #answerCompareTable th, #answerCompareTable td {
            word-wrap: break-word;
        }
        #answerCompareTable thead tr {
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
        #answerCompareTable th.songNumber, #answerCompareTable td.songNumber {
            width: 30px;
        }
        #answerCompareTable tbody tr.highlightCorrect {
            background-color: #00570f;
        }
        #answerCompareTable tbody tr.highlightWrong {
            background-color: #6B0000;
        }
        #asDistributionTable td {
            text-align: left;
            padding: 0 4px;
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
    `;
    if (showPlayerColors) text += `
        #answerSpeedWindow .self span.name,
        #answerSpeedWindow .self i.fa-id-card-o,
        #answerHistoryWindow tr.self td.name,
        #answerHistoryTable.speedMode .name span.self {
            color: ${selfColor};
        }
        #answerSpeedWindow .friend span.name,
        #answerSpeedWindow .friend i.fa-id-card-o,
        #answerHistoryWindow tr.friend td.name,
        #answerHistoryTable.speedMode .name span.friend {
            color: ${friendColor};
        }
        #answerSpeedWindow .blocked span.name,
        #answerSpeedWindow .blocked i.fa-id-card-o,
        #answerHistoryWindow tr.blocked td.name,
        #answerHistoryTable.speedMode .name span.blocked {
            color: ${blockedColor};
        }
    `;
    if (showCustomColors) {
        customColors.forEach((item, index) => {
            text += `
                #answerSpeedWindow .customColor${index} span.name,
                #answerSpeedWindow .customColor${index} i.fa-id-card-o,
                #answerHistoryWindow tr.customColor${index} td.name,
                #answerHistoryTable.speedMode .name span.customColor${index} {
                    color: ${item.color};
                }
            `;
        });
    }

    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
