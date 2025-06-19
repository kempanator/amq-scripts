// ==UserScript==
// @name         AMQ Answer Stats
// @namespace    https://github.com/kempanator
// @version      0.37
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
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const SCRIPT_VERSION = "0.37";
const SCRIPT_NAME = "Answer Stats";
const regionMap = { E: "Eastern", C: "Central", W: "Western" };
const saveData = validateLocalStorage("answerStats");
let showPlayerColors = saveData.showPlayerColors ?? true;
let showCustomColors = saveData.showCustomColors ?? true;
let answerStatsWindow;
let answerSpeedWindow;
let answerHistoryWindow;
let answerCompareWindow;
let distributionWindow;
let answers = {}; //{1: {name, id, answer, correct}, ...}
let songHistory = {}; //{1: {romaji, english, number, artist, song, type, vintage, difficulty, fastestSpeed, fastestPlayers, answers: {1: {id, text, speed, correct, rank, score, invalidAnswer, uniqueAnswer, noAnswer}, ...}, ...}
let playerInfo = {}; //{1: {name, id, level, score, rank, box, averageSpeed, correctSpeedList}, ...}
let listLowerCase = [];
let averageSpeedSort = { mode: "score", ascending: false };
let songHistoryFilter = { type: "all" };
let songHistorySort = { mode: "position", ascending: true };
let playerHistorySort = { mode: "number", ascending: true };
let answerHistorySettings = { mode: "song", songNumber: null, playerId: null, roomType: "", roomName: "" };
let customColorMap = {};
let $answerCompareSearchInput;
let hotKeys = {
    asWindow: loadHotkey("asWindow"),
    historyWindow: loadHotkey("historyWindow"),
    speedWindow: loadHotkey("speedWindow"),
    compareWindow: loadHotkey("compareWindow"),
    saveResults: loadHotkey("saveResults")
};

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
    new Listener("Game Starting", (data) => {
        resetHistory();
        answerHistorySettings.roomType = data.gameMode;
        if (answerHistorySettings.roomType === "Ranked") {
            answerHistorySettings.roomName = regionMap[$("#mpRankedTimer h3").text()] + " " + data.quizDescription.roomName;
        }
        else {
            answerHistorySettings.roomName = data.quizDescription.roomName;
        }
    }).bindListener();
    new Listener("Join Game", (data) => {
        if (data.quizState) {
            joinRoomUpdate(data);
        }
    }).bindListener();
    new Listener("Spectate Game", (data) => {
        if (data.quizState) {
            joinRoomUpdate(data);
        }
    }).bindListener();
    new Listener("player answers", (data) => {
        if (!quiz.answerInput.typingInput.autoCompleteController.list.length) {
            quiz.answerInput.typingInput.autoCompleteController.updateList();
        }
        answers = {};
        for (const item of data.answers) {
            answers[item.gamePlayerId] = {
                name: quiz.players[item.gamePlayerId]._name,
                id: item.gamePlayerId,
                answer: item.answer
            };
        }
    }).bindListener();
    new Listener("answer results", (data) => {
        if (Object.keys(answers).length === 0) return;
        if (listLowerCase.length === 0) return;
        const currentPlayer = quizVideoController.getCurrentPlayer();
        const songNumber = parseInt(quiz.infoContainer.$currentSongCount.text());
        if (songNumber < Math.max(...Object.keys(songHistory).map(x => parseInt(x)))) songHistory = {}; //handle jam reset
        const correctPlayers = {}; //{id: answer speed, ...}
        const correctAnswerIdList = {}; //{title: [], ...}
        const incorrectAnswerIdList = {}; //{title: [], ...}
        const otherAnswerIdList = []; //unique incorrect answers
        const invalidAnswerIdList = [];
        const noAnswerIdList = [];
        songHistory[songNumber] = {
            animeRomajiName: data.songInfo.animeNames.romaji,
            animeEnglishName: data.songInfo.animeNames.english,
            altAnimeNames: data.songInfo.altAnimeNames,
            altAnimeNamesAnswers: data.songInfo.altAnimeNamesAnswers,
            animeType: data.songInfo.animeType,
            animeVintage: data.songInfo.vintage,
            animeTags: data.songInfo.animeTags,
            animeGenre: data.songInfo.animeGenre,
            songNumber: songNumber,
            songArtist: data.songInfo.artist,
            songName: data.songInfo.songName,
            songType: data.songInfo.type,
            songTypeNumber: data.songInfo.typeNumber,
            songTypeText: typeText(data.songInfo.type, data.songInfo.typeNumber),
            songDifficulty: data.songInfo.animeDifficulty,
            rebroadcast: data.songInfo.rebroadcast,
            dub: data.songInfo.dub,
            annId: data.songInfo.siteIds.annId,
            malId: data.songInfo.siteIds.malId,
            kitsuId: data.songInfo.siteIds.kitsuId,
            aniListId: data.songInfo.siteIds.aniListId,
            startPoint: currentPlayer?.startPoint ?? null,
            audio: data.songInfo.videoTargetMap.catbox?.[0] ?? data.songInfo.videoTargetMap.openingsmoe?.[0] ?? null,
            video480: data.songInfo.videoTargetMap.catbox?.[480] ?? data.songInfo.videoTargetMap.openingsmoe?.[480] ?? null,
            video720: data.songInfo.videoTargetMap.catbox?.[720] ?? data.songInfo.videoTargetMap.openingsmoe?.[720] ?? null,
            groupSlotMap: { ...data.groupMap },
            answers: {}
        };
        for (const anime of data.songInfo.altAnimeNames.concat(data.songInfo.altAnimeNamesAnswers)) {
            correctAnswerIdList[anime] = [];
        }
        for (const player of data.players) {
            const quizPlayer = answers[player.gamePlayerId];
            if (quizPlayer) {
                quizPlayer.correct = player.correct;
                const speed = validateSpeed(amqAnswerTimesUtility.playerTimes[player.gamePlayerId]);
                if (player.correct && speed) correctPlayers[answers[player.gamePlayerId].id] = speed;
                const item = playerInfo[player.gamePlayerId];
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
        for (const player of Object.values(answers)) {
            const answerItem = songHistory[songNumber].answers[player.id];
            if (answerItem) {
                if (player.answer.trim() === "") {
                    noAnswerIdList.push(player.id);
                    answerItem.noAnswer = true;
                }
                else {
                    const answerLowerCase = player.answer.toLowerCase();
                    let index = Object.keys(correctAnswerIdList).findIndex((value) => answerLowerCase === value.toLowerCase());
                    if (index > -1) {
                        correctAnswerIdList[Object.keys(correctAnswerIdList)[index]].push(player.id);
                    }
                    else {
                        index = listLowerCase.findIndex((value) => answerLowerCase === value);
                        if (index > -1) {
                            const wrongAnime = quiz.answerInput.typingInput.autoCompleteController.list[index];
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
        const numCorrect = Object.keys(correctPlayers).length;
        const averageSpeed = numCorrect ? Math.round(Object.values(correctPlayers).reduce((a, b) => a + b) / numCorrect) : null;
        const fastestSpeed = numCorrect ? Math.min(...Object.values(correctPlayers)) : null;
        const fastestPlayers = Object.keys(correctPlayers).filter((id) => correctPlayers[id] === fastestSpeed);
        songHistory[songNumber].fastestSpeed = fastestSpeed;
        songHistory[songNumber].fastestPlayers = fastestPlayers;
        for (const anime of Object.keys(incorrectAnswerIdList)) {
            if (incorrectAnswerIdList[anime].length === 1) {
                const id = incorrectAnswerIdList[anime][0];
                otherAnswerIdList.push(id);
                songHistory[songNumber].answers[id].uniqueAnswer = true;
            }
        }
        const correctSortedKeys = Object.keys(correctAnswerIdList).sort((a, b) => correctAnswerIdList[b].length - correctAnswerIdList[a].length);
        const incorrectSortedKeys = Object.keys(incorrectAnswerIdList).sort((a, b) => incorrectAnswerIdList[b].length - incorrectAnswerIdList[a].length);
        answers = {};

        setTimeout(() => {
            //const $asMainContainer = $("#asMainContainer");
            //const totalPlayers = $("#qpScoreBoardEntryContainer .qpStandingItem").length;
            const activePlayers = $("#qpScoreBoardEntryContainer .qpStandingItem:not(.disabled)").length;
            const roomName = hostModal.$roomName.val();
            const difficultyList = songHistoryWindow.currentGameTab.table.rows.map((x) => parseFloat(x.songInfo.animeDifficulty) || 0);
            const songTypeList = songHistoryWindow.currentGameTab.table.rows.map((x) => x.songInfo.type);
            $("#asRoomInfoRow").empty().append(`
                <span><b>${roomNameText()}</b></span>
                <span style="margin-left: 20px"><b>Song:</b> ${songNumber}/${quiz.infoContainer.$totalSongCount.text()}</span>
                <span style="margin-left: 20px"><b>Host:</b> ${hostText(currentPlayer?.currentVideoUrl)}</span>
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
            const options = $("#asDistributionButton").data("bs.popover").options;
            if (quiz.gameMode === "Ranked") {
                options.title = roomName;
                options.content = difficultyInfoText(roomName);
            }
            else {
                options.title = "";
                options.content = "";
            }
            const currentMinutes = Math.floor(currentPlayer?.startPoint / 60);
            const currentSeconds = String(Math.round(currentPlayer?.startPoint) % 60).padStart(2, 0);
            const totalMinutes = Math.floor(currentPlayer?.videoLength / 60);
            const totalSeconds = String(Math.round(currentPlayer?.videoLength) % 60).padStart(2, 0);
            $("#asSongGuessRow").empty().append(`
                <span><b>Correct:</b> ${numCorrect}/${activePlayers} ${(numCorrect / activePlayers * 100).toFixed(2)}%</span>
                <span style="margin-left: 20px"><b>Dif:</b> ${Number(data.songInfo.animeDifficulty).toFixed(2)}</span>
                <span style="margin-left: 20px"><b>Sample:</b> ${currentMinutes}:${currentSeconds} / ${totalMinutes}:${totalSeconds}</span>
            `);
            //<span style="margin-left: 20px"><b>Rig:</b> ${data.watched}</span>
            if (numCorrect && !quiz.soloMode && !quiz.teamMode) {
                const $speedRow = $("#asAnswerSpeedRow").empty().show();
                $speedRow.append(`<span><b>Average:</b> ${averageSpeed}ms</span><span style="margin-left: 20px"><b>Fastest:</b> ${fastestSpeed}ms - </span>`);
                fastestPlayers.forEach((id, i) => {
                    $speedRow.append($("<span>", { text: playerInfo[id].name, style: "cursor: pointer;" }).click(() => {
                        displayPlayerHistoryResults(id);
                        answerHistoryWindow.open();
                    }));
                    if (i < fastestPlayers.length - 1) $speedRow.append(", ");
                });
            }
            else {
                $("#asAnswerSpeedRow").empty().hide();
            }
            if (data.players.length > 8 && Object.keys(correctPlayers).length <= 5) {
                const $correctRow = $("#asCorrectPlayersRow").empty().show();
                $correctRow.append(`<span><b>Correct Players: </b></span>`);
                Object.keys(correctPlayers).forEach((id, i) => {
                    const playerElement = $("<span>", { text: playerInfo[id].name, style: "cursor: pointer;" }).click(() => {
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
            const $ulCorrect = $("#asCorrectAnswersList").empty();
            $ulCorrect.append($("<b>", { text: "Correct Answers:", style: "cursor: pointer;" }).click(() => {
                songHistoryFilter = { type: "allCorrectAnswers" };
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (const anime of correctSortedKeys) {
                if (correctAnswerIdList[anime].length > 0) {
                    $ulCorrect.append($("<li>")
                        .append($("<span>", { class: "answerStatsAnimeTitle", text: anime, style: "cursor: pointer;" }).click(() => {
                            songHistoryFilter = { type: "answer", answer: anime };
                            displaySongHistoryResults(songNumber);
                            answerHistoryWindow.open()
                        }))
                        .append($("<span>", { class: "answerStatsNumber", text: correctAnswerIdList[anime].length }))
                    );
                }
            }
            const $ulWrong = $("#asWrongAnswersList").empty();
            $ulWrong.append($("<b>", { text: "Wrong Answers:", style: "cursor: pointer;" }).click(() => {
                songHistoryFilter = { type: "allWrongAnswers" };
                displaySongHistoryResults(songNumber);
                answerHistoryWindow.open();
            }));
            for (const anime of incorrectSortedKeys) {
                if (incorrectAnswerIdList[anime].length > 1) {
                    $ulWrong.append($("<li>")
                        .append($("<span>", { class: "answerStatsAnimeTitle", text: anime, style: "cursor: pointer;" }).click(() => {
                            songHistoryFilter = { type: "answer", answer: anime };
                            displaySongHistoryResults(songNumber);
                            answerHistoryWindow.open();
                        }))
                        .append($("<span>", { class: "answerStatsNumber", text: incorrectAnswerIdList[anime].length }))
                    );
                }
            }
            if (otherAnswerIdList.length > 0) {
                $ulWrong.append($("<li>")
                    .append($("<span>", { class: "answerStatsAnimeTitle", text: "Other Answer", style: "cursor: pointer;" }).click(() => {
                        songHistoryFilter = { type: "uniqueValidWrongAnswers" };
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open();
                    }))
                    .append($("<span>", { class: "answerStatsNumber", text: otherAnswerIdList.length }))
                );
            }
            if (invalidAnswerIdList.length > 0) {
                $ulWrong.append($("<li>")
                    .append($("<span>", { class: "answerStatsAnimeTitle", text: "Invalid Answer", style: "cursor: pointer;" }).click(() => {
                        songHistoryFilter = { type: "invalidAnswers" };
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open();
                    }))
                    .append($("<span>", { class: "answerStatsNumber", text: invalidAnswerIdList.length }))
                );
            }
            if (noAnswerIdList.length > 0) {
                $ulWrong.append($("<li>")
                    .append($("<span>", { class: "answerStatsAnimeTitle", text: "No Answer", style: "cursor: pointer;" }).click(() => {
                        songHistoryFilter = { type: "noAnswers" };
                        displaySongHistoryResults(songNumber);
                        answerHistoryWindow.open();
                    }))
                    .append($("<span>", { class: "answerStatsNumber", text: noAnswerIdList.length }))
                );
            }

            displayAverageSpeedResults();
            if (answerHistorySettings.mode === "song") {
                songHistoryFilter = { type: "all" };
                displaySongHistoryResults(songNumber);
            }
            else if (answerHistorySettings.mode === "player") {
                displayPlayerHistoryResults(answerHistorySettings.playerId);
            }
            else if (answerHistorySettings.mode === "speed") {
                displayFastestSpeedResults();
            }
            displayAnswerCompareResults($answerCompareSearchInput.val());
            displayDistributionResults(difficultyList, songTypeList);
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
        scrollable: { x: false, y: true }
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
        scrollable: { x: false, y: true }
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
        scrollable: { x: false, y: true }
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
        scrollable: { x: false, y: true }
    });

    distributionWindow = new AMQWindow({
        id: "distributionWindow",
        title: "Distribution",
        width: 250,
        height: 350,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1005,
        resizable: true,
        draggable: true
    });
    distributionWindow.addPanel({
        id: "distributionPanel",
        width: 1.0,
        height: "100%",
        scrollable: { x: false, y: true }
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
        .append($("<div>", { class: "tabContainer" })
            .append($("<div>", { id: "asAnswerHistoryTab", class: "tab clickAble" })
                .append(`<span>History</span>`)
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
            .append($("<div>", { id: "asAverageSpeedTab", class: "tab clickAble" })
                .append(`<span>Speed</span>`)
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
            .append($("<div>", { id: "asAnswerCompareTab", class: "tab clickAble" })
                .append(`<span>Compare</span>`)
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
            .append($("<div>", { id: "asDistributionTab", class: "tab clickAble" })
                .append(`<span>Distribution</span>`)
                .popover({
                    container: "#gameContainer",
                    placement: "top",
                    trigger: "hover",
                    content: "show anime distribution by type and difficulty"
                })
                .click(() => {
                    distributionWindow.isVisible() ? distributionWindow.close() : distributionWindow.open();
                })
            )
            /*.append($("<div>", { id: "mcInfoTab", class: "tab clickAble", style: "width: 45px; margin-right: -10px; padding-right: 8px; float: right;" })
                .append(`<h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>`)
                .click(function () {
                    //$(this).addClass("selected");
                    //$("#asSettingsContainer").show();
                }))
            */
        );

    answerStatsWindow.panels[0].panel.append(/*html*/`
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
                        <th>Keybind</th>
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
    let $header = answerHistoryWindow.window.find(".modal-header");
    $header.find("h2").remove();
    $("<div>")
        .append($("<span>", { text: "Answer History", style: "font-size: 23px; line-height: normal; margin: 6px 0 2px 8px;" }))
        .append($("<label>", { class: "answerStatsIcon" })
            .append($("<input>", { type: "file", accept: ".json", style: "display: none;" }).on("change", uploadHandler))
            .append(`<i class="fa fa-folder-open-o" aria-hidden="true"></i>`)
            .popover({
                container: "#gameContainer",
                placement: "top",
                trigger: "hover",
                content: "open json file"
            }))
        .append($(`<div class="answerStatsIcon"></div>`)
            .append(`<i class="fa fa-floppy-o" aria-hidden="true"></i>`)
            .popover({
                container: "#gameContainer",
                placement: "top",
                trigger: "hover",
                content: "save current game results to json file"
            })
            .click(() => {
                saveResults();
            }))
        .append($(`<div class="answerStatsIcon"></div>`)
            .append(`<i class="fa fa-clock-o" aria-hidden="true"></i>`)
            .popover({
                container: "#gameContainer",
                placement: "top",
                trigger: "hover",
                content: "show fastest speed for each song"
            })
            .click(() => {
                displayFastestSpeedResults();
            }))
        .append($("<div>", { class: "answerStatsIcon filterButton" })
            .append(`<i class="fa fa-refresh" aria-hidden="true"></i>`)
            .hide()
            .popover({
                container: "#gameContainer",
                placement: "top",
                trigger: "hover",
                content: "reset answer filter"
            })
            .click(function () {
                $(this).hide();
                songHistoryFilter = { type: "all" };
                displaySongHistoryResults(answerHistorySettings.songNumber);
            }))
        .appendTo($header);
    $("<div>", { style: "float: left; margin-top: 3px;" })
        .append(`<span id="answerHistoryCurrentSong" style="font-size: 16px; margin: 0 8px 0 8px;">Song: </span>`)
        .append($("<div>", { class: "infoButton" })
            .append(`<i class="fa fa-info-circle" aria-hidden="true"></i>`)
            .hide()
            .popover({
                container: "#gameContainer",
                placement: "bottom",
                trigger: "hover",
                html: true,
                title: "",
                content: ""
            }))
        .append($("<div>", { class: "answerStatsButton arrowButton", text: "«" }).hide().click(() => {
            if (Object.keys(songHistory).length) {
                songHistoryFilter = { type: "all" };
                displaySongHistoryResults(parseInt(Object.keys(songHistory)[0]));
            }
        }))
        .append($("<div>", { class: "answerStatsButton arrowButton", text: "‹" }).hide().click(() => {
            if (Object.keys(songHistory).length) {
                const songNumber = answerHistorySettings.songNumber;
                if (songNumber !== Object.values(songHistory)[0].songNumber) {
                    songHistoryFilter = { type: "all" };
                    displaySongHistoryResults(songNumber - 1);
                }
            }
        }))
        .append($("<div>", { class: "answerStatsButton arrowButton", text: "›" }).hide().click(() => {
            if (Object.keys(songHistory).length) {
                const songNumber = answerHistorySettings.songNumber;
                if (songNumber !== Object.values(songHistory).slice(-1)[0].songNumber) {
                    songHistoryFilter = { type: "all" };
                    displaySongHistoryResults(songNumber + 1);
                }
            }
        }))
        .append($("<div>", { class: "answerStatsButton arrowButton", text: "»" }).hide().click(() => {
            if (Object.keys(songHistory).length) {
                songHistoryFilter = { type: "all" };
                displaySongHistoryResults(Object.values(songHistory).slice(-1)[0].songNumber);
            }
        }))
        .append($("<div>", { class: "answerStatsButton backButton", text: "back" }).hide().click(() => {
            if (Object.keys(songHistory).length) {
                if (songHistory[answerHistorySettings.songNumber]) {
                    displaySongHistoryResults(answerHistorySettings.songNumber);
                }
                else {
                    displaySongHistoryResults(Object.values(songHistory).slice(-1)[0].songNumber);
                }
            }
        }))
        .append($(`<span id="answerHistoryCurrentPlayer" style="font-size: 16px; margin: 0 8px 0 8px;">Player: </span>`).hide().popover({
            container: "#gameContainer",
            placement: "top",
            trigger: "hover",
            html: true,
            title: "",
            content: ""
        }))
        .appendTo($header);

    // setup average speed window
    $header = answerSpeedWindow.window.find(".modal-header");
    $header.find("h2").remove();
    $header
        .append($("<div>", { text: "Average Speed", style: "font-size: 23px; line-height: normal; margin: 6px 0 2px 8px" }))
        .append($("<div>", { style: "margin: 0 0 0 8px;" })
            .append(`<span style="font-size: 16px">Sort:</span>`)
            .append($("<div>", { id: "averageSpeedSortModeButton", class: "answerStatsButton", text: averageSpeedSort.mode }).click(function () {
                const modes = ["score", "time", "name"];
                averageSpeedSort.mode = modes[(modes.indexOf(averageSpeedSort.mode) + 1) % modes.length];
                $(this).text(averageSpeedSort.mode);
                displayAverageSpeedResults();
            }))
            .append($("<div>", { id: "averageSpeedSortDirectionButton", class: "answerStatsButton", text: averageSpeedSort.ascending ? "🡅" : "🡇" }).click(function () {
                averageSpeedSort.ascending = !averageSpeedSort.ascending;
                $(this).text(averageSpeedSort.ascending ? "🡅" : "🡇");
                displayAverageSpeedResults();
            })));

    // setup answer compare window
    $header = answerCompareWindow.window.find(".modal-header");
    $header.find("h2").remove();
    $header
        .append($("<div>", { text: "Answer Compare", style: "font-size: 23px; line-height: normal; margin: 6px 0 2px 8px;" }))
        .append($("<div>", { style: "float: left; margin: 3px 0 0 8px;" })
            .append($("<input>", { id: "answerCompareSearchInput", type: "text" }).keypress((event) => {
                if (event.key === "Enter") {
                    displayAnswerCompareResults($("#answerCompareSearchInput").val());
                }
            }))
            .append($("<div>", { id: "answerCompareButtonGo", class: "answerStatsButton", text: "Go" }).click(() => {
                displayAnswerCompareResults($("#answerCompareSearchInput").val());
            }))
            .append($("<label>", { class: "clickAble", style: "margin-left: 10px;", text: "Correct" })
                .append($("<input>", { id: "answerCompareHighlightCorrectCheckbox", type: "checkbox" }).click(() => {
                    setTimeout(() => { displayAnswerCompareResults($("#answerCompareSearchInput").val()) }, 1);
                })))
            .append($("<label>", { class: "clickAble", style: "margin-left: 10px;", text: "Wrong" })
                .append($("<input>", { id: "answerCompareHighlightWrongCheckbox", type: "checkbox" }).click(() => {
                    setTimeout(() => { displayAnswerCompareResults($("#answerCompareSearchInput").val()) }, 1);
                })))
        );
    $answerCompareSearchInput = $header.find("#answerCompareSearchInput");

    createHotkeyTable([
        { action: "asWindow", title: "Open This Window" },
        { action: "historyWindow", title: "Open History Window" },
        { action: "speedWindow", title: "Open Speed Window" },
        { action: "compareWindow", title: "Open Compare Window" },
        { action: "distributionWindow", title: "Open Distribution Window" },
        { action: "saveResults", title: "Save Results" }
    ]);

    const hotkeyActions = {
        asWindow: () => {
            answerStatsWindow.isVisible() ? answerStatsWindow.close() : answerStatsWindow.open();
        },
        historyWindow: () => {
            answerHistoryWindow.isVisible() ? answerHistoryWindow.close() : answerHistoryWindow.open();
        },
        speedWindow: () => {
            answerSpeedWindow.isVisible() ? answerSpeedWindow.close() : answerSpeedWindow.open();
        },
        compareWindow: () => {
            answerCompareWindow.isVisible() ? answerCompareWindow.close() : answerCompareWindow.open();
        },
        distributionWindow: () => {
            distributionWindow.isVisible() ? distributionWindow.close() : distributionWindow.open();
        },
        saveResults: () => {
            saveResults();
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
        .append($(`<div id="qpAnswerStats" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-list-alt qpMenuItem"></i></div>`)
            .click(() => {
                answerStatsWindow.isVisible() ? answerStatsWindow.close() : answerStatsWindow.open();
            })
            .popover({
                content: "Answer Stats",
                trigger: "hover",
                placement: "bottom"
            })
        );

    $("#optionListSettings").before($("<li>", { class: "clickAble", text: "Answer Stats" }).click(() => {
        answerStatsWindow.open();
    }));
    $("#asSettingsContainer").hide();

    applyStyles();
    AMQ_addScriptData({
        name: SCRIPT_NAME,
        author: "kempanator",
        version: SCRIPT_VERSION,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js",
        description: `
            <p>Click the button in the options bar during quiz to open the answer stats window</p>
        `
    });
}

// handle song history json file uploads
function uploadHandler() {
    if (quiz.inQuiz) {
        messageDisplayer.displayMessage("Don't do this in quiz");
    }
    else {
        if (this.files.length) {
            this.files[0].text().then((data) => {
                try {
                    const json = JSON.parse(data);
                    //console.log(json);
                    if (json.playerInfo && json.songHistory) {
                        // support for older version of this script
                        if (Object.values(json.songHistory)[0].romaji) {
                            for (const song of Object.values(json.songHistory)) {
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
                        answerHistorySettings = { mode: "song", songNumber: null, playerId: null, roomType: json.roomType, roomName: json.roomName };
                        playerInfo = json.playerInfo;
                        songHistory = json.songHistory;
                        songHistoryFilter = { type: "all" };
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
}

// display average time list in time track window
function displayAverageSpeedResults() {
    answerSpeedWindow.panels[0].clear();
    let sortedIds = [];
    if (averageSpeedSort.mode === "score") {
        sortedIds = averageSpeedSort.ascending
            ? Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat().reverse()
            : Object.values(Object.values(songHistory).slice(-1)[0].groupSlotMap).flat();
    }
    else if (averageSpeedSort.mode === "time") {
        sortedIds = averageSpeedSort.ascending
            ? Object.keys(playerInfo).sort((a, b) => playerInfo[a].averageSpeed - playerInfo[b].averageSpeed)
            : Object.keys(playerInfo).sort((a, b) => playerInfo[b].averageSpeed - playerInfo[a].averageSpeed);
    }
    else if (averageSpeedSort.mode === "name") {
        sortedIds = averageSpeedSort.ascending
            ? Object.keys(playerInfo).sort((a, b) => playerInfo[a].name.localeCompare(playerInfo[b].name))
            : Object.keys(playerInfo).sort((a, b) => playerInfo[b].name.localeCompare(playerInfo[a].name));
    }
    const $results = $("<div>", { id: "averageSpeedResults" });
    for (const id of sortedIds) {
        const player = playerInfo[id];
        if (!player) continue;
        const $row = $("<div>").addClass(colorClass(player.name))
            .append($("<span>", { class: "time", text: Math.round(player.averageSpeed) }))
            //.append("<span>", { class: "time", text: Math.round(player.standardDeviation) })
            .append($(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`).click(() => {
                playerProfileController.loadProfile(player.name, $("#answerSpeedWindow"), {}, () => { }, false, true);
            }))
            .append($("<span>", { class: "name", text: player.name, style: "cursor: pointer;" }).click(() => {
                displayPlayerHistoryResults(id);
                answerHistoryWindow.open();
            }))
            .append($("<span>", { class: "score", text: player.score }));
        $results.append($row);
    }
    answerSpeedWindow.panels[0].panel.append($results);
}

// create a table with each row being 1 player
function displaySongHistoryResults(songNumber) {
    const song = songHistory[songNumber];
    if (!song) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentSong").text("Song: " + songNumber);
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").hide();
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .speedButton").show();
    songHistoryFilter.type === "all" ? answerHistoryWindow.window.find(".filterButton").hide() : answerHistoryWindow.window.find(".filterButton").show();
    //answerHistoryWindow.window.find(".infoButton").data("bs.popover").options.title = "Song " + songNumber;
    answerHistoryWindow.window.find(".infoButton").data("bs.popover").options.content = $("<div>")
        .append($("<p>").text(song.songName))
        .append($("<p>").text(song.songArtist))
        .append($("<p>").text(options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName).css("color", getComputedStyle(document.documentElement).getPropertyValue("--accentColorContrast") || "#4497ea"))
        .append($("<p>").text(`${song.songTypeText} (${Number(song.songDifficulty).toFixed(1)}) ${song.animeVintage}`))
    answerHistoryWindow.panels[0].clear();
    const $table = $("<table>", { id: "answerHistoryTable", class: "styledTable songMode" });
    const $thead = $("<thead>");
    const $tbody = $("<tbody>");
    $thead.append($("<tr>", { style: "cursor: pointer;" })
        .append($("<th>", { class: "rank", text: "Rank" }))
        .append($("<th>", { class: "box", text: "Box" }))
        .append($("<th>", { class: "score", text: "Score" }))
        .append($("<th>", { class: "level", text: "Level" }))
        .append($("<th>", { class: "name", text: "Name" }))
        .append($("<th>", { class: "speed", text: "Speed" }))
        .append($("<th>", { class: "answer", text: "Answer" }))
    );
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
    const filter = (answer) => {
        if (songHistoryFilter.type === "all") return true;
        if (songHistoryFilter.type === "allCorrectAnswers" && answer.correct) return true;
        if (songHistoryFilter.type === "allWrongAnswers" && !answer.correct) return true;
        if (songHistoryFilter.type === "answer" && songHistoryFilter.answer.toLowerCase() === answer.text.toLowerCase()) return true;
        if (songHistoryFilter.type === "noAnswers" && answer.noAnswer) return true;
        if (songHistoryFilter.type === "uniqueValidWrongAnswers" && answer.uniqueAnswer) return true;
        if (songHistoryFilter.type === "invalidAnswers" && answer.invalidAnswer) return true;
        return false;
    }
    for (const id of sortedIds) {
        const player = playerInfo[id];
        const answer = song.answers[id];
        if (player && answer && filter(answer)) {
            $tbody.append($("<tr>", { class: colorClass(player.name) })
                .append($("<td>", { class: "rank", text: answer.rank }))
                .append($("<td>", { class: "box", text: findBoxById(player.id, song.groupSlotMap), style: "cursor: pointer;" }))
                .append($("<td>", { class: "score", text: answer.score }))
                .append($("<td>", { class: "level", text: player.level }))
                .append($("<td>", { class: "name", text: player.name, style: "cursor: pointer;" })
                    .prepend(`<i class="fa fa-id-card-o clickAble" aria-hidden="true"></i>`))
                .append($("<td>", { class: "speed" }).text(answer.speed ? answer.speed : ""))
                .append($("<td>", { class: "answer", text: answer.text, style: "cursor: pointer;" })
                    .prepend(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}" aria-hidden="true"></i>`))
            );
        }
    }
    $thead.on("click", "th", (event) => {
        const classMap = {
            rank: "position",
            box: "position",
            score: "position",
            level: "level",
            name: "name",
            speed: "speed",
            answer: "answer"
        }
        tableSortChange(songHistorySort, classMap[event.target.classList[0]]);
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
            songHistoryFilter = { type: "answer", answer: event.target.innerText };
            displaySongHistoryResults(answerHistorySettings.songNumber);
        }
    });
    $tbody.on("click", "i.fa-id-card-o", (event) => {
        playerProfileController.loadProfile(event.target.parentElement.innerText, $("#answerHistoryWindow"), {}, () => { }, false, true);
    });
    $table.append($thead, $tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "song";
    answerHistorySettings.songNumber = songNumber;
}

// create a table with each row being 1 answer
function displayPlayerHistoryResults(id) {
    const player = playerInfo[id];
    if (!player) return;
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer").text("Player: " + player.name);
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .filterButton").hide();
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer, .backButton").show();
    answerHistoryWindow.window.find("#answerHistoryCurrentPlayer").data("bs.popover").options.content = `
        <p>Current Score: ${player.score}</p>
        <p>Level: ${player.level}</p>
        <p>Average Speed: ${Math.round(player.averageSpeed)}</p>
    `;
    answerHistoryWindow.panels[0].clear();
    const $table = $("<table>", { id: "answerHistoryTable", class: "styledTable playerMode" });
    const $thead = $("<thead>");
    const $tbody = $("<tbody>");
    $thead.append($("<tr>")
        .append($("<th>", { class: "songNumber", text: "#", style: "cursor: pointer;" }))
        .append($("<th>", { class: "songDifficulty", text: "Dif", style: "cursor: pointer;" }))
        .append($("<th>", { class: "speed", text: "Speed", style: "cursor: pointer;" }))
        .append($("<th>", { class: "answer", text: "Answer", style: "cursor: pointer;" }))
    );
    const sortedIds = Object.keys(songHistory).filter((songNumber) => songHistory[songNumber].answers[id]);
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
    for (const songNumber of sortedIds) {
        const answer = songHistory[songNumber].answers[id];
        $tbody.append($("<tr>")
            .append($("<td>", { class: "songNumber", text: songNumber, style: "cursor: pointer;" }))
            .append($("<td>", { class: "songDifficulty", text: Math.round(songHistory[songNumber].songDifficulty) }))
            .append($("<td>", { class: "speed", text: answer.speed || "" }))
            .append($("<td>", { class: "answer", text: answer.text })
                .prepend(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}" aria-hidden="true"></i>`))
        );
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
            songHistoryFilter = { type: "all" };
            displaySongHistoryResults(parseInt(event.target.innerText));
        }
    });
    $table.append($thead, $tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "player";
    answerHistorySettings.playerId = id;
}

// create a table with each row showing the song #, fastest speed, and fastest player(s)
function displayFastestSpeedResults() {
    answerHistoryWindow.window.find(".infoButton, .arrowButton, .filterButton, #answerHistoryCurrentPlayer").hide();
    answerHistoryWindow.window.find(".backButton").show();
    answerHistoryWindow.panels[0].clear();
    const $table = $("<table>", { id: "answerHistoryTable", class: "styledTable speedMode" });
    const $thead = $("<thead>");
    const $tbody = $("<tbody>");
    $thead.append($("<tr>")
        .append($("<th>", { class: "songNumber", text: "#" }))
        .append($("<th>", { class: "anime", text: "Anime" }))
        .append($("<th>", { class: "speed", text: "Speed" }))
        .append($("<th>", { class: "name", text: "Name" }))
    );
    for (const song of Object.values(songHistory)) {
        const $row = $("<tr>")
            .append($("<td>", { class: "songNumber", text: song.songNumber, style: "cursor: pointer;" }))
            .append($("<td>", { class: "anime", text: options.useRomajiNames ? song.animeRomajiName : song.animeEnglishName }))
            .append($("<td>", { class: "speed", text: song.fastestSpeed ?? "" }))
            .append($("<td>", { class: "name" })
                .append(song.fastestPlayers.map(id => {
                    const name = playerInfo[id].name;
                    return $("<span>", { class: colorClass(name), text: name, style: "cursor: pointer;" });
                }))
            );
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
    $table.append($thead, $tbody);
    answerHistoryWindow.panels[0].panel.append($table);
    answerHistorySettings.mode = "speed";
}

function displayAnswerCompareResults(text) {
    if (!text) return;
    answerCompareWindow.panels[0].clear();
    const players = text.split(/[\s,]+/).filter(Boolean).map(p => p.toLowerCase());
    if (players.length < 2) {
        answerCompareWindow.panels[0].panel.append(`<p>Please add 2 or more players</p>`);
        return;
    }
    const idList = [];
    for (const name of players) {
        const item = Object.values(playerInfo).find(p => p.name.toLowerCase() === name);
        if (item) {
            idList.push(item.id);
        }
        else {
            answerCompareWindow.panels[0].panel.append(`<p>Not found: ${name}</p>`);
            return;
        }
    }
    const highlightCorrect = $("#answerCompareHighlightCorrectCheckbox").prop("checked");
    const highlightWrong = $("#answerCompareHighlightWrongCheckbox").prop("checked");
    const $table = $("<table>", { id: "answerCompareTable", class: "styledTable" });
    const $thead = $("<thead>");
    const $tbody = $("<tbody>");
    $thead.append($("<tr>")
        .append(`<th class="songNumber">#</th>`)
        .append(idList.map(id => `<th>${playerInfo[id].name} (${playerInfo[id].score})</th>`))
    );
    for (const songNumber of Object.keys(songHistory)) {
        let numCorrect = 0;
        let numWrong = 0;
        const $row = $("<tr>");
        $row.append($("<td>", { class: "songNumber", text: songNumber, style: "cursor: pointer;" }).click(() => {
            displaySongHistoryResults(songNumber);
            answerHistoryWindow.open();
        }));
        for (const id of idList) {
            const answer = songHistory[songNumber].answers[id];
            if (answer) {
                answer.correct ? numCorrect++ : numWrong++;
                $row.append($("<td>", { text: answer.text })
                    .prepend(`<i class="fa ${answer.correct ? "fa-check" : "fa-times"}" aria-hidden="true">></i>`));
            }
            else {
                $row.append("<td>");
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
    $table.append($thead, $tbody);
    answerCompareWindow.panels[0].panel.append($table);
}

function displayDistributionResults(difficultyList, songTypeList) {
    const ranges = [
        { min: 60, max: 100 },
        { min: 45, max: 60 },
        { min: 30, max: 45 },
        { min: 25, max: 35 },
        { min: 0, max: 25 }
    ];

    const tableData = ranges.map(r => ({
        range: `${r.min}-${r.max}`,
        OP: 0,
        ED: 0,
        IN: 0
    }));

    if (difficultyList && songTypeList) {
        difficultyList.forEach((diff, index) => {
            const type = songTypeList[index];
            for (let i = 0; i < ranges.length; i++) {
                const { min, max } = ranges[i];
                if (diff >= min && diff < max) {
                    if (type === 1) tableData[i].OP++;
                    else if (type === 2) tableData[i].ED++;
                    else if (type === 3) tableData[i].IN++;
                    break;
                }
            }
        });
    }

    const tableHTML = `
        <table id="asDistributionTable" class="styledTable" style="margin-top: 10px; width: 100%; text-align: center;">
            <thead>
                <tr>
                    <td><b>Dif</b></td>
                    <td><b>OP</b></td>
                    <td><b>ED</b></td>
                    <td><b>IN</b></td>
                    <td><b>Total</b></td>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>60-100</td>
                    <td>${tableData[0].OP}</td>
                    <td>${tableData[0].ED}</td>
                    <td>${tableData[0].IN}</td>
                    <td>${tableData[0].OP + tableData[0].ED + tableData[0].IN}</td>
                </tr>
                <tr>
                    <td>45-60</td>
                    <td>${tableData[1].OP}</td>
                    <td>${tableData[1].ED}</td>
                    <td>${tableData[1].IN}</td>
                    <td>${tableData[1].OP + tableData[1].ED + tableData[1].IN}</td>
                </tr>
                <tr>
                    <td>30-45</td>
                    <td>${tableData[2].OP}</td>
                    <td>${tableData[2].ED}</td>
                    <td>${tableData[2].IN}</td>
                    <td>${tableData[2].OP + tableData[2].ED + tableData[2].IN}</td>
                </tr>
                <tr>
                    <td>25-35</td>
                    <td>${tableData[3].OP}</td>
                    <td>${tableData[3].ED}</td>
                    <td>${tableData[3].IN}</td>
                    <td>${tableData[3].OP + tableData[3].ED + tableData[3].IN}</td>
                </tr>
                <tr>
                    <td>0-25</td>
                    <td>${tableData[4].OP}</td>
                    <td>${tableData[4].ED}</td>
                    <td>${tableData[4].IN}</td>
                    <td>${tableData[4].OP + tableData[4].ED + tableData[4].IN}</td>
                </tr>
                <tr style="font-weight: bold; border-top: 1px solid #666;">
                    <td>Total</td>
                    <td>${tableData.reduce((sum, row) => sum + row.OP, 0)}</td>
                    <td>${tableData.reduce((sum, row) => sum + row.ED, 0)}</td>
                    <td>${tableData.reduce((sum, row) => sum + row.IN, 0)}</td>
                    <td>${tableData.reduce((sum, row) => sum + row.OP + row.ED + row.IN, 0)}</td>
                </tr>
            </tbody>
        </table>
    `;

    distributionWindow.panels[0].clear();
    distributionWindow.panels[0].panel.append(tableHTML);
}

// set undefined and glitched out speed times to null
function validateSpeed(speed) {
    return (speed && speed < 1000000) ? speed : null;
}

// input full song type text, return shortened version
function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// get shortened host name
function hostText(url) {
    if (!url) return "?";
    for (const [key, value] of Object.entries(videoResolver.CATBOX_ENDPOINTS)) {
        if (url.startsWith(value)) return key;
    }
    if (url.startsWith("https://openings.moe/")) return "OM";
    return "?";
}

// input type and typeNumber, return shortened type
function typeText(type, typeNumber) {
    if (type === 1) return "OP" + typeNumber;
    if (type === 2) return "ED" + typeNumber;
    if (type === 3) return "IN";
};

// get type of room, if ranked specify region
function roomNameText() {
    if (!quiz.inQuiz) return "";
    if (quiz.gameMode === "Ranked") {
        const region = regionMap[$("#mpRankedTimer h3").text()] || "";
        const type = hostModal.$roomName.val();
        return region + " " + type;
    }
    else if (quiz.gameMode === "Themed") {
        const region = regionMap[$("#mpRankedTimer h3").text()] || "";
        return region + " Themed Quiz";
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

// input name, return space-separated color classes
function colorClass(name) {
    const classes = [];
    const lower = name.toLowerCase();
    if (name === selfName) {
        classes.push("self");
    }
    if (socialTab.isFriend(name)) {
        classes.push("friend");
    }
    if (socialTab.isBlocked(name)) {
        classes.push("blocked");
    }
    if (customColorMap.hasOwnProperty(lower)) {
        classes.push("customColor" + customColorMap[lower]);
    }
    return classes.join(" ");
}

function getScore(player) {
    if (quiz.scoreboard.scoreType === 1) return player.score;
    return player.correctGuesses;
}

function resetHistory() {
    songHistory = {};
    playerInfo = {};
    answerHistorySettings = { mode: "song", songNumber: null, playerId: null, roomType: "", roomName: "" };
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
        answerHistorySettings.roomName = regionMap[$("#mpRankedTimer h3").text()] + " " + data.settings.roomName;
    }
    else if (answerHistorySettings.roomType === "Themed") {
        answerHistorySettings.roomName = regionMap[$("#mpRankedTimer h3").text()] + " Themed Quiz";
    }
    else {
        answerHistorySettings.roomName = data.settings.roomName;
    }
    /*
    for (const player of data.quizState.players) {
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
    for (const song of data.quizState.songHistory) {
        const songInfo = song.historyInfo.songInfo;
        const answers = {};
        for (const name of song.historyInfo.correctGuessPlayers) {
            const player = Object.values(playerInfo).find(p => p.name === name);
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

// download quiz answer data as json file
function saveResults() {
    if (Object.keys(songHistory).length === 0 || Object.keys(playerInfo).length === 0) return;
    const date = new Date();
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, 0);
    const day = String(date.getDate()).padStart(2, 0);
    const hour = String(date.getHours()).padStart(2, 0);
    const minute = String(date.getMinutes()).padStart(2, 0);
    const second = String(date.getSeconds()).padStart(2, 0);
    const dateFormatted = `${year}-${month}-${day}`;
    const timeFormatted = `${hour}.${minute}.${second}`;
    const fileName = answerHistorySettings.roomType === "Ranked"
        ? `${dateFormatted} ${answerHistorySettings.roomName} Answer History.json`
        : `${dateFormatted} ${timeFormatted} ${answerHistorySettings.roomType} Answer History.json`;
    const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        date: dateFormatted,
        roomType: answerHistorySettings.roomType,
        roomName: answerHistorySettings.roomName,
        playerInfo: playerInfo,
        songHistory: songHistory
    }));
    const element = document.createElement("a");
    element.setAttribute("href", data);
    element.setAttribute("download", fileName);
    document.body.appendChild(element);
    element.click();
    element.remove();
}

function printCorrelations(numberOfResults) {
    const keys = Object.keys(playerInfo);
    const combinations = keys.flatMap((v, i) => keys.slice(i + 1).map(w => [v, w]));
    const percentages = {};
    combinations.forEach((x, i) => {
        if (playerInfo[x[0]].score > 10 && playerInfo[x[1]].score > 10) {
            percentages[i] = calculateCorrelation(x[0], x[1]);
        }
    });
    const sortedKeys = Object.keys(percentages).sort((a, b) => percentages[b] - percentages[a]);
    for (let i = 0; i < numberOfResults; i++) {
        const index = parseInt(sortedKeys[i]);
        const name1 = playerInfo[combinations[index][0]].name;
        const name2 = playerInfo[combinations[index][1]].name;
        console.log(`${percentages[index]} ${name1} ${name2}`);
    }
}

function calculateCorrelation(id1, id2) {
    //console.log(`${id1}: ${playerInfo[id1].name}   ${id2}: ${playerInfo[id2].name}`);
    let count = 0;
    for (const song of Object.values(songHistory)) {
        const answer1 = song.answers[id1]?.correct ?? null;
        const answer2 = song.answers[id2]?.correct ?? null;
        if (answer1 !== null && answer1 === answer2) count++;
    }
    return ((count / Object.keys(songHistory).length) * 100).toFixed(2);
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
    const $tbody = $("#asHotkeyTable tbody");
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
    localStorage.setItem("answerStats", JSON.stringify(
        showPlayerColors,
        showCustomColors,
        hotKeys
    ));
}

// apply styles
function applyStyles() {
    const saveDataHF = validateLocalStorage("highlightFriendsSettings");
    const selfColor = saveDataHF.smColorSelfColor ?? "#80c7ff";
    const friendColor = saveDataHF.smColorFriendColor ?? "#80ff80";
    const blockedColor = saveDataHF.smColorBlockedColor ?? "#ff8080";
    const customColors = saveDataHF.customColors ?? [];
    customColorMap = {};
    customColors.forEach((item, index) => {
        for (const player of item.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
    let css = /*css*/ `
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
        #asHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
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
    if (showPlayerColors) css += /*css*/ `
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
            css += /*css*/ `
                #answerSpeedWindow .customColor${index} span.name,
                #answerSpeedWindow .customColor${index} i.fa-id-card-o,
                #answerHistoryWindow tr.customColor${index} td.name,
                #answerHistoryTable.speedMode .name span.customColor${index} {
                    color: ${item.color};
                }
            `;
        });
    }
    let style = document.getElementById("answerStatsStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "answerStatsStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
