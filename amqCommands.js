// ==UserScript==
// @name        	AMQ Mega Commands
// @namespace   	https://github.com/kempanator
// @version     	0.1
// @description 	Commands for AMQ Chat
// @author      	kempanator
// @match       	https://animemusicquiz.com/*
// @grant       	none
// @require     	https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL 	https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqCommands.js
// ==/UserScript==

if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    new Listener("game chat update", (payload) => {
        payload.messages.forEach(parseChat(message));
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        // team chat listener
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (auto_answer && !quiz.isSpectator && quiz.gameMode !== "Ranked") {
            $("#qpAnswerInput").val(auto_answer);
			quiz.answerInput.submitAnswer(true);
        }
        if (auto_skip && !quiz.isSpectator && quiz.gameMode !== "Ranked") {
            setTimeout(() => { quiz.skipClicked() }, 200);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (auto_skip) {
            sendSystemMessage("Auto Skip: Enabled");
        }
        if (auto_copy_player) {
            sendSystemMessage("Auto Copy: " + auto_copy_player);
        }
        if (auto_answer) {
            sendSystemMessage("Auto Throw: " + auto_answer);
        }
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (auto_copy_player && auto_copy_player !== selfName.toLowerCase()) {
            if (auto_copy_player === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
                $("#qpAnswerInput").val(payload.answer);
			    quiz.answerInput.submitAnswer(true);
            }
        }
    }).bindListener();

    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        description: `
            <p>TODO: documentation</p>
        `
    });
}

function parseChat(message) {
    if (checkRankedMode()) return;
    if (message.sender === selfName) {
        if (/^\/roll$/.test(message.message)) {
            sendChatMessage("roll commands: #, player, playerteam, spectator");
        }
        else if (/^\/roll \d+$/.test(message.message)) {
            let number = parseInt(message.message.split(" ")[1]);
            sendChatMessage("rolls " + (Math.floor(Math.random() * number) + 1));
        }
        else if (/^\/roll \d+ \d+$/.test(message.message)) {
            let split = message.message.split(" ");
            let low_number = parseInt(split[1]);
            let high_number = parseInt(split[2]);
            sendChatMessage("rolls " + (Math.floor(Math.random() * (high_number - low_number + 1)) + low_number));
        }
        else if (/^\/roll player$/.test(message.message)) {
            let player_list = getPlayerList();
            sendChatMessage(player_list[Math.floor(Math.random() * player_list.length)]);
        }
        else if (/^\/roll playerteam$/.test(message.message)) {
            if (lobby.settings.teamSize > 1) {
                let teamDictionary = getTeamDictionary();
                if (Object.keys(teamDictionary).length > 0) {
                    let teams = Object.keys(teamDictionary);
                    teams.sort((a, b) => parseInt(a) - parseInt(b));
                    for (let team of teams) {
                        sendChatMessage("Team " + team + ": " + teamDictionary[team][Math.floor(Math.random() * teamDictionary[team].length)]);
                    }
                }
            }
            else {
                sendChatMessage("team size must be greater than 1");
            }
        }
        else if (/^\/roll spectator$/.test(message.message)) {
            let spectator_list = getSpectatorList();
            if (spectator_list.length > 0) {
                sendChatMessage(spectator_list[Math.floor(Math.random() * spectator_list.length)]);
            }
            else {
                sendChatMessage("no spectators");
            }
        }
        else if (/^\/size \d+$/.test(message.message)) {
            let option = parseInt(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.roomSize = option;
            changeGameSettings(settings);
        }
        else if (/^\/type \w+$/.test(message.message)) {
            let option = message.message.split(" ")[1].toLowerCase();
            let settings = hostModal.getSettings();
            settings.songType.standardValue.openings = option.includes("o");
            settings.songType.standardValue.endings = option.includes("e");
            settings.songType.standardValue.inserts = option.includes("i");
            settings.songType.advancedValue.openings = 0;
            settings.songType.advancedValue.endings = 0;
            settings.songType.advancedValue.inserts = 0;
            settings.songType.advancedValue.random = settings.numberOfSongs;
            changeGameSettings(settings);
        }
        else if (/^\/speed (\d+|\d+.\d+)$/.test(message.message)) {
            let option = parseFloat(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.playbackSpeed.randomOn = false;
            settings.playbackSpeed.standardValue = option;
		    changeGameSettings(settings);
        }
        else if (/^\/time \d+$/.test(message.message)) {
            let option = parseInt(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.guessTime.randomOn = false;
            settings.guessTime.standardValue = option;
		    changeGameSettings(settings);
        }
        else if (/^\/lives \d+$/.test(message.message)) {
            let option = parseInt(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.scoreType = 3;
            settings.lives = option;
		    changeGameSettings(settings);
        }
        else if (/^\/team \d+$/.test(message.message)) {
            let option = parseInt(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.teamSize.randomOn = false;
            settings.teamSize.standardValue = option;
		    changeGameSettings(settings);
        }
        else if (/^\/num \d+$/.test(message.message)) {
            let option = parseInt(message.message.split(" ")[1]);
            let settings = hostModal.getSettings();
            settings.numberOfSongs = option;
            changeGameSettings(settings);
        }
        else if (/^\/dif \d+-\d+$/.test(message.message)) {
            let option = message.message.split(" ")[1];
            let low = parseInt(option.split("-")[0]);
            let high = parseInt(option.split("-")[1]);
            let settings = hostModal.getSettings();
            settings.songDifficulity.advancedOn = true;
            settings.songDifficulity.advancedValue = [low, high];
            changeGameSettings(settings);
        }
        else if (/^\/pause$/.test(message.message)) {
            socket.sendCommand({ type:"quiz", command:"quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause") });
        }
        else if (/^\/autoskip$/.test(message.message)) {
            auto_skip = !auto_skip;
            sendSystemMessage("auto skip " + (auto_skip ? "enabled" : "disabled"));
        }
        else if (/^\/autocopy$/.test(message.message)) {
            auto_copy_player = "";
            sendSystemMessage("auto copy disabled");
        }
        else if (/^\/autocopy \w+$/.test(message.message)) {
            auto_copy_player = message.message.split(" ")[1].toLowerCase();
            sendSystemMessage("auto copying " + auto_copy_player);
        }
        else if (/^\/autothrow$/.test(message.message)) {
            auto_answer = "";
            sendSystemMessage("auto throw disabled " + auto_copy_player);
        }
        else if (/^\/autothrow .+$/.test(message.message)) {
            let text = /^\/autothrow (.+)$/.exec(message.message)[1];
            auto_answer = translateShortcodeToUnicode(text).text;
            sendSystemMessage("auto throwing: " + auto_answer);
        }
        else if (/^\/host \w+$/.test(message.message)) {
            let name = message.message.split(" ")[1].toLowerCase();
            lobby.promoteHost(name);
        }
        else if (/^\/(inv|invite) \w+$/.test(message.message)) {
            let name = message.message.split(" ")[1].toLowerCase();
            socket.sendCommand({
                type: "social",
                command: "invite to game",
                data: { target: name }
            });
        }
        else if (/^\/kick \w+$/.test(message.message)) {
            let name = message.message.split(" ")[1].toLowerCase();
            socket.sendCommand({
                type: "lobby",
                command: "kick player",
                data: { playerName: name }
            });
        }
        else if (/^\/(lb|lobby|returntolobby)$/.test(message.message)) {
            quiz.startReturnLobbyVote();
        }
        else if (/^\/password$/.test(message.message)) {
            let password = hostModal.getSettings().password;
            if (password) sendChatMessage(password);
        }
        else if (/^\/invisible$/.test(message.message)) {
            let invisibleFriends = [];
            for (let name of Object.keys(socialTab.offlineFriends)) {
                if (name in socialTab.allPlayerList._playerEntries) {
                    invisibleFriends.push(name);
                }
            }
            sendChatMessage(invisibleFriends.length > 0 ? invisibleFriends.join(", ") : "no invisible friends detected");
        }
        else if (/^\/pm$/.test(message.message)) {
            socialTab.startChat(selfName);
        }
        else if (/^\/pm \w+$/.test(message.message)) {
            let name = /^\/pm (\w+)$/.exec(message.message)[1];
            socialTab.startChat(name);
        }
        else if (/^\/pm \w+ .+$/.test(message.message)) {
            let name = /^\/pm (\w+) .+$/.exec(message.message)[1];
            let text = /^\/pm \w+ (.+)$/.exec(message.message)[1];
            socialTab.startChat(name);
            socket.sendCommand({
                type: "social",
                command: "chat message",
                data: { target: name, message: text }
            });
        }
        else if (/^\/(prof|profile) \w+$/.test(message.message)) {
            let name = message.message.split(" ")[1].toLowerCase();
            playerProfileController.loadProfileIfClosed(name, $("#gameChatContainer"), {}, () => {}, false, true);
        }
        else if (/^\/rules$/.test(message.message)) {
            sendChatMessage(Object.keys(rules).join(", "));
        }
        else if (/^\/rules .+$/.test(message.message)) {
            let option =/^\/rules (.+)$/.exec(message.message)[1];
            if (option in rules) sendChatMessage(rules[option]);
        }
        else if (/^\/info$/.test(message.message)) {
            sendChatMessage(Object.keys(info).join(", "));
        }
        else if (/^\/info .+$/.test(message.message)) {
            let option =/^\/info (.+)$/.exec(message.message)[1];
            if (option in info) sendChatMessage(info[option]);
        }
    }
}

function getPlayerList() {
    let player_list = [];
    if (lobby.inLobby) {
        for (let playerId in lobby.players) {
            player_list.push(lobby.players[playerId]._name);
        }
    }
    else if (quiz.inQuiz) {
        for (let playerId in quiz.players) {
            player_list.push(quiz.players[playerId]._name);
        }
    }
    return player_list;
}

function getSpectatorList() {
    let spectator_list = [];
    for (let playerId in gameChat.spectators) {
        spectator_list.push(gameChat.spectators[playerId].name);
    }
    return spectator_list;
}

function getTeamDictionary() {
    let teamDictionary = {};
    if (lobby.inLobby) {
        for (let lobbyAvatar of document.querySelectorAll(".lobbyAvatar")) {
            let name = lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner").querySelector("h2").innerText;
            let team = lobbyAvatar.querySelector(".lobbyAvatarTeamContainer").querySelector("h3").innerText;
            if (isNaN(parseInt(team))) {
                sendChatMessage("Error: can't get team number for " + name);
                return {};
            }
            if (team in teamDictionary) {
                teamDictionary[team].push(name);
            }
            else {
                teamDictionary[team] = [name];
            }
        }
    }
    else if (quiz.inQuiz) {
        for (let playerId in quiz.players) {
            let name = quiz.players[playerId]._name;
            let team = quiz.players[playerId].teamNumber.toString();
            if (team in teamDictionary) {
                teamDictionary[team].push(name);
            }
            else {
                teamDictionary[team] = [name];
            }
        }
    }
    return teamDictionary;
}

function sendChatMessage(message) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: { msg: message, teamMessage: false }
    });
}

function sendSystemMessage(message) {
    setTimeout(() => { gameChat.systemMessage(message) }, 50);
}

function checkRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
}

function getAllFriends() {
    return Object.keys(socialTab.onlineFriends).concat(Object.keys(socialTab.offlineFriends));
}

const rules = {
    "alien": "https://pastebin.com/LxLMg1nA",
    "blackjack": "https://pastebin.com/kcq7hsJm",
    "dualraidboss": "https://pastebin.com/XkG7WWwj",
    "newgamemode": "https://pastebin.com/TAyYVsii",
    "password": "https://pastebin.com/17vKE78J",
    "pictionary": "https://pastebin.com/qc3NQJdX",
    "raidboss": "https://pastebin.com/NE28GUPq",
    "reversepassword": "https://pastebin.com/S8cQahNA",
    "spy": "https://pastebin.com/Q1Z35czX",
    "warlords": "https://pastebin.com/zWNRFsC3"
};

const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};

let auto_skip = false;
let auto_answer = "";
let auto_copy_player = "";
