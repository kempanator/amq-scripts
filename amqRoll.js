// ==UserScript==
// @name        	AMQ Better Roll Script
// @namespace   	https://github.com/kempanator
// @version     	0.1
// @description 	Roll numbers or players in AMQ chat, type /roll for option list
// @author      	kempanator
// @match       	https://animemusicquiz.com/*
// @grant       	none
// @require     	https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL 	https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqRoll.js
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
        console.log(payload);
        payload.messages.forEach(message => {
            if (quiz.inQuiz === true && quiz.gameMode === "Ranked") return;
            if (message.sender === selfName) {
                if(/^\/roll$/.test(message.message)) {
                    sendChatMessage("roll commands: #, player, playerteam, spectator");
                }
                else if (/^\/roll \d+$/.test(message.message)) {
                    let number = parseInt(message.message.split(" ")[1]);
                    if (number > 0) {
                        sendChatMessage("rolls " + (Math.floor(Math.random() * number) + 1));
                    }
                }
                else if (/^\/roll \d+ \d+$/.test(message.message)) {
                    let split = message.message.split(" ");
                    let low_number = parseInt(split[1]);
                    let high_number = parseInt(split[2]);
                    if (low_number > 0 && high_number > 0 && high_number > low_number) {
                        sendChatMessage("rolls " + (Math.floor(Math.random() * (high_number - low_number + 1)) + low_number));
                    }
                }
                else if (/^\/roll player$/.test(message.message)) {
                    let player_list = getPlayerList();
                    if (player_list.length > 0) {
                        sendChatMessage(player_list[Math.floor(Math.random() * player_list.length)]);
                    }
                    else {
                        sendChatMessage("no players");
                    }
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
            }
        });
    }).bindListener();

    AMQ_addScriptData({
        name: "Better Roll Script",
        author: "kempanator",
        description: `
            <p>/roll # (pick a random number between 1 and #)</p>
            <p>/roll # # (pick a random number between first # and second #)</p>
            <p>/roll player (pick a random player in game, ignore spectators)</p>
            <p>/roll playerteam (pick a random player from each team)</p>
            <p>/roll spectator (pick a random spectator)</p>
        `
    });
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
