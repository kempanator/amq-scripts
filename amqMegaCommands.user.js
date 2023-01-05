// ==UserScript==
// @name         AMQ Mega Commands
// @namespace    https://github.com/kempanator
// @version      0.62
// @description  Commands for AMQ Chat
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js
// ==/UserScript==

/*
IMPORTANT: disable these scripts before installing
- dice roller by thejoseph98
- chat commands by nyamu
- auto ready by nyamu
- auto answer on keypress by (unknown)

GAME SETTINGS
/size [2-40]          change room size
/type [oei]           change song types
/watched              change selection type to watched
/random               change selection type to random
/time [5-60]          change song guess time
/lives [1-5]          change number of lives
/team [1-8]           change team size
/songs [5-100]        change number of songs
/dif [low] [high]     change difficulty

IN GAME/LOBBY
/autoskip             automatically vote skip at the beginning of each song
/autokey              automatically submit answer on each key press
/autothrow [text]     automatically send answer at the beginning of each song
/autocopy [name]      automatically copy a team member's answer
/automute [seconds]   automatically mute sound during quiz after # of seconds
/autounmute [seconds] automatically unmute sound during quiz after # of seconds
/autoready            automatically ready up in lobby
/autostart            automatically start the game when everyone is ready if you are host
/autohost [name]      automatically promote player to host if you are the current host
/autoinvite [name]    automatically invite a player to your room when they log in (only friends)
/autoaccept           automatically accept game invites if you aren't in a room (only friends)
/autolobby            automatically vote return to lobby when host starts a vote
/ready                ready/unready in lobby
/invite [name]        invite player to game
/host [name]          promote player to host
/kick [name]          kick player
/skip                 vote skip on current song
/pause                pause/unpause game
/lobby                start return to lobby vote
/leave                leave room
/rejoin [seconds]     leave and rejoin the room you're in after # of seconds
/spec                 change to spectator
/join                 change from spectator to player in lobby
/queue                join/leave queue
/volume [0-100]       change volume
/countdown [seconds]  start game after # of seconds
/dropdown             enable/disable anime dropdown
/dropdownspec         enable drop down while spectating
/speed [number]       change client-side song playback speed (0.0625 - 16)

OTHER
/roll                 roll number, player, teammate, playerteam, spectator
/shuffle [list]       shuffle a list of anything (separate with commas)
/startvote [list]     start a vote with a list of options (separate with commas)
/stopvote             stop the vote and print results
/calc [expression]    calculate a math expression
/rules                show list of gamemodes and rules
/info                 show list of external utilities
/clear                clear chat
/dm [name] [text]     direct message a player
/profile [name]       show profile window of any player
/password             reveal private room password
/invisible            show invisible friends
/background [url]     change the background
/logout               log out
/relog                log out, log in, and auto join the room you were in
/version              check the version of this script
/commands [on|off]    turn this script on or off
*/

"use strict";
const version = "0.62";
const saveData = JSON.parse(localStorage.getItem("megaCommands")) || {};
let animeList;
let autoAcceptInvite = saveData.autoAcceptInvite !== undefined ? saveData.autoAcceptInvite : false;
let autoCopy = saveData.autoCopy !== undefined ? saveData.autoCopy : "";
let autoHost = saveData.autoHost !== undefined ? saveData.autoHost : "";
let autoInvite = saveData.autoInvite !== undefined ? saveData.autoInvite : "";
let autoJoinRoom = saveData.autoJoinRoom !== undefined ? saveData.autoJoinRoom : false;
let autoKey = saveData.autoKey !== undefined ? saveData.autoKey : false;
let autoMute = saveData.autoMute !== undefined ? saveData.autoMute : null;
let autoReady = saveData.autoReady !== undefined ? saveData.autoReady : false;
let autoStart = saveData.autoStart !== undefined ? saveData.autoStart : false;
let autoStatus = saveData.autoStatus !== undefined ? saveData.autoStatus : "";
let autoSwitch = saveData.autoSwitch !== undefined ? saveData.autoSwitch : "";
let autoThrow = saveData.autoThrow !== undefined ? saveData.autoThrow : "";
let autoUnmute = saveData.autoUnmute !== undefined ? saveData.autoUnmute : null;
let autoVoteLobby = saveData.autoVoteLobby !== undefined ? saveData.autoVoteLobby : false;
let autoVoteSkip = saveData.autoVoteSkip !== undefined ? saveData.autoVoteSkip : null;
let backgroundURL = saveData.backgroundURL !== undefined ? saveData.backgroundURL : "";
let commands = saveData.commands !== undefined ? saveData.commands : true;
let countdown = null;
let countdownInterval;
let dropdown = saveData.dropdown !== undefined ? saveData.dropdown : true;
let dropdownInSpec = saveData.dropdownInSpec !== undefined ? saveData.dropdownInSpec : false;
let lastUsedVersion = saveData.lastUsedVersion !== undefined ? saveData.lastUsedVersion : null;
let playbackSpeed = saveData.playbackSpeed !== undefined ? saveData.playbackSpeed : null;
let playerDetection = saveData.playerDetection !== undefined ? saveData.playerDetection : {invisible: false, players: []};
let printLoot = saveData.printLoot !== undefined ? saveData.printLoot : false;
let voteOptions = {};
let votes = {};
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
const scripts = {
    "autoready": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqAutoReady.user.js",
    "friends": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqHighlightFriends.user.js",
    "sounds": "https://github.com/ensorcell/amq-scripts/raw/master/notificationSounds.user.js",
    "songlistui": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqSongListUI.user.js",
    "rigtrackerlite": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqRigTrackerLite.user.js",
    "answertime": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js",
    "speedrun": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqSpeedrun.user.js",
    "chattimestamps": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqChatTimestamps.user.js",
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js"
};
const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};

if (document.querySelector("#startPage")) {
    if (autoJoinRoom.autoLogIn && document.querySelector(".loginMainForm h1").innerText === "Account Already Online") {
        setTimeout(() => { document.querySelector(".loginMainForm a").click() }, 100);
    }
    return;
}

let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

if (backgroundURL) {
    AMQ_addStyle(`
        #loadingScreen, #gameContainer {
            background-image: url(${backgroundURL});
        }
        #gameChatPage .col-xs-9 {
            background-image: none;
        }
    `);
}

function setup() {
    saveSettings();
    if (lastUsedVersion && version !== lastUsedVersion) {
        popoutMessages.displayStandardMessage("Mega Commands", "updated to version " + version);
    }
    if (autoStatus === "do not disturb") socialTab.socialStatus.changeSocialStatus(2);
    if (autoStatus === "away") socialTab.socialStatus.changeSocialStatus(3);
    if (autoStatus === "invisible") socialTab.socialStatus.changeSocialStatus(4);
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (isRankedMode() || !message.message.startsWith("/")) return;
            else if (message.message.startsWith("/forceall")) parseForceAll(message.message, message.teamMessage ? "teamchat" : "chat");
            else if (message.message.startsWith("/vote")) parseVote(message.message, message.sender);
            else if (message.sender !== selfName) return;
            else parseCommand(message.message, message.teamMessage ? "teamchat" : "chat");
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (isRankedMode() || !payload.message.startsWith("/")) return;
        else if (payload.message.startsWith("/forceall")) parseForceAll(payload.message, payload.teamMessage ? "teamchat" : "chat");
        else if (payload.sender !== selfName) return;
        else parseCommand(payload.message, payload.teamMessage ? "teamchat" : "chat");
    }).bindListener();
    new Listener("chat message", (payload) => {
        parseIncomingDM(payload.message, payload.sender);
    }).bindListener();
    new Listener("chat message response", (payload) => {
        if (!payload.msg.startsWith("/")) return;
        parseCommand(payload.msg, "dm", payload.target);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (playbackSpeed !== null) {
            let speed = Array.isArray(playbackSpeed) ? Math.random() * (playbackSpeed[1] - playbackSpeed[0]) + playbackSpeed[0] : playbackSpeed;
            quizVideoController.moePlayers[0].playbackRate = speed;
            quizVideoController.moePlayers[1].playbackRate = speed;
        }
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (autoThrow) quiz.answerInput.setNewAnswer(autoThrow);
            if (autoVoteSkip !== null) setTimeout(() => { quiz.skipClicked() }, autoVoteSkip);
        }
        if (autoMute !== null) {
            let time = Array.isArray(autoMute) ? Math.floor(Math.random() * (autoMute[1] - autoMute[0] + 1)) + autoMute[0] : autoMute;
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, time);
        }
        if (autoUnmute !== null) {
            let time = Array.isArray(autoUnmute) ? Math.floor(Math.random() * (autoUnmute[1] - autoUnmute[0] + 1)) + autoUnmute[0] : autoUnmute;
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            setTimeout(() => {
                document.querySelector("#qpVolume").classList.remove("disabled");
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }, time);
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.autoCompleteController.list.length) quiz.answerInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled").val("");
            }, 1);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (autoVoteSkip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
        if (autoKey) sendSystemMessage("Auto Key: Enabled");
        if (autoCopy) sendSystemMessage("Auto Copy: " + autoCopy);
        if (autoThrow) sendSystemMessage("Auto Throw: " + autoThrow);
        if (autoMute !== null) sendSystemMessage("Auto Mute: " + (Array.isArray(autoMute) ? `random ${autoMute[0] / 1000}s - ${autoMute[1] / 1000}s` : `${autoMute / 1000}s`));
        if (autoUnmute !== null) sendSystemMessage("Auto Unmute: " + (Array.isArray(autoUnmute) ? `random ${autoUnmute[0] / 1000}s - ${autoUnmute[1] / 1000}s` : `${autoUnmute / 1000}s`));
        if (playbackSpeed !== null) sendSystemMessage("Song Playback Speed: " + (Array.isArray(playbackSpeed) ? `random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x` : `${playbackSpeed}x`));
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (autoCopy && autoCopy === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let current_text = document.querySelector("#qpAnswerInput").value;
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(current_text);
        }
    }).bindListener();
    new Listener("guess phase over", (payload) => {
        if (autoMute !== null || autoUnmute !== null) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.autoCompleteController.list.length) quiz.answerInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled");
            }, 1);
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (autoMute !== null || autoUnmute !== null) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
    }).bindListener();
    new Listener("return lobby vote start", (payload) => {
        if (autoVoteLobby) {
            setTimeout(() => {
                quiz.returnVoteController.buttonSelected(quiz.returnVoteController.$VOTE_YES_BUTTON);
                quiz.returnVoteController.vote(true);
            }, 100);
        }
    }).bindListener();
    new Listener("battle royal phase over", (payload) => {
        if (printLoot && !battleRoyal.isSpectator) {
            for (let element of document.querySelectorAll("#brCollectedList li")) {
                sendSystemMessage(element.innerText.substring(2));
            }
        }
    }).bindListener();
    new Listener("quiz over", (payload) => {
        document.querySelector("#qpVolume").classList.remove("disabled");
        setTimeout(() => { checkAutoHost() }, 10);
        if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.error) {
            autoJoinRoom = false;
            saveSettings();
            return;
        }
        if (autoReady) sendSystemMessage("Auto Ready: Enabled");
        if (autoStart) sendSystemMessage("Auto Start: Enabled");
        if (autoHost) sendSystemMessage("Auto Host: " + autoHost);
        if (autoInvite) sendSystemMessage("Auto Invite: " + autoInvite);
        if (autoAcceptInvite) sendSystemMessage("Auto Accept Invite: Enabled");
        if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.error) {
            autoJoinRoom = false;
            saveSettings();
            return;
        }
        if (autoReady) sendSystemMessage("Auto Ready: Enabled");
        if (autoStart) sendSystemMessage("Auto Start: Enabled");
        if (autoHost) sendSystemMessage("Auto Host: " + autoHost);
        if (autoInvite) sendSystemMessage("Auto Invite: " + autoInvite);
        if (autoAcceptInvite) sendSystemMessage("Auto Accept Invite: Enabled");
        if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
    }).bindListener();
    new Listener("New Player", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    new Listener("New Spectator", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    new Listener("Player Ready Change",  (payload) => {
        checkAutoStart();
    }).bindListener();
    new Listener("Room Settings Changed", (payload) => {
        setTimeout(() => { checkAutoReady() }, 1);
    }).bindListener();
    new Listener("Player Changed To Spectator", (payload) => {
        if (payload.playerDescription.name === selfName) {
            setTimeout(() => { checkAutoSwitch() }, 1);
        }
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (payload.name === selfName) {
            setTimeout(() => { checkAutoReady(); checkAutoStart(); checkAutoSwitch(); }, 1);
        }
    }).bindListener();
    new Listener("Host Promotion", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
        setTimeout(() => { checkAutoReady() }, 1);
    }).bindListener();
    new Listener("game invite", (payload) => {
        if (autoAcceptInvite && !inRoom() && ((autoAcceptInvite === true && isFriend(payload.sender))
        || (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())))) {
            roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
        }
    }).bindListener();
    new Listener("friend state change", (payload) => {
        if (payload.online && autoInvite === payload.name.toLowerCase() && inRoom() && !isInYourRoom(autoInvite) && !isSoloMode() && !isRankedMode()) {
            sendSystemMessage(payload.name + " online: auto inviting");
            setTimeOut(() => { socket.sendCommand({type: "social", command: "invite to game", data: {target: payload.name}}), 1000 });
        }
    }).bindListener();
    new Listener("New Rooms", (payload) => {
        for (let room of payload) {
            if (playerDetection.invisible) {
                let list = [];
                room.players.forEach((player) => { if (Object.keys(socialTab.offlineFriends).includes(player)) list.push(player) });
                if (list.length) popoutMessages.displayStandardMessage(`${list.join(", ")} (invisible)`, `Room ${room.id}: ${room.settings.roomName}`);
            }
            if (playerDetection.players.length) {
                for (let player of playerDetection.players) {
                    if (room.players.includes(player)) popoutMessages.displayStandardMessage(`${player}`, `Room ${room.id}: ${room.settings.roomName}`);
                }
            }
        }
    }).bindListener();
    new Listener("nexus coop chat message", (payload) => {
        if (!payload.message.startsWith("/")) return;
        else if (payload.message.startsWith("/forceall")) parseForceAll(payload.message, "nexus");
        else if (payload.message.startsWith("/vote")) parseVote(payload.message, payload.sender);
        else if (payload.sender !== selfName) return;
        else parseCommand(payload.message, "nexus");
    }).bindListener();
    new Listener("nexus game invite", (payload) => {
        if (autoAcceptInvite && !inRoom() && ((autoAcceptInvite === true && isFriend(payload.sender))
        || (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())))) {
            socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: payload.lobbyId}});
        }
    }).bindListener();
    new Listener("nexus lobby host change", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    new Listener("new nexus player", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    new Listener("nexus player leave", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    document.querySelector("#qpAnswerInput").addEventListener("input", (event) => {
        let answer = event.target.value || " ";
        if (autoKey) {
            socket.sendCommand({type: "quiz", command: "quiz answer", data: {answer: answer, isPlaying: true, volumeAtMax: false}});
        }
    });
    if (autoJoinRoom) {
        if (autoJoinRoom.type === "solo") {
            hostModal.changeSettings(autoJoinRoom.settings);
            hostModal.soloMode = true;
            setTimeout(() => { roomBrowser.host() }, 10);
        }
        else if (autoJoinRoom.type === "ranked") {
            document.querySelector("#mpRankedButton").click();
        }
        else if (autoJoinRoom.type === "multiplayer") {
            if (autoJoinRoom.joinAsPlayer) roomBrowser.fireJoinLobby(autoJoinRoom.id, autoJoinRoom.password);
            else roomBrowser.fireSpectateGame(autoJoinRoom.id, autoJoinRoom.password);
        }
        else if (autoJoinRoom.type === "nexus coop") {
            if (autoJoinRoom.id) socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: autoJoinRoom.id}});
            else socket.sendCommand({type: "nexus", command: "setup dungeon lobby", data: {typeId: 1, coop: true}});
        }
        else if (autoJoinRoom.type === "nexus solo") {
            socket.sendCommand({type: "nexus", command: "setup dungeon lobby", data: {typeId: 1, coop: false}});
        }
        if (autoJoinRoom.temp) {
            autoJoinRoom = false;
            saveSettings();
        }
    }
    new MutationObserver(function() {
        $("#playerProfileLayer .ppFooterOptionIcon").removeClass("disabled");
    }).observe(document.querySelector("#playerProfileLayer"), {childList: true});
    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <p>Command List: <a href="https://kempanator.github.io/amq-mega-commands" target="_blank">https://kempanator.github.io/amq-mega-commands</a></p>
        `
    });
}

/**
 * parse a command
 * @param {String} content message text
 * @param {String} type dm, chat, teamchat, nexus
 * @param {String} target name of player you are sending to if dm
 */
function parseCommand(content, type, target) {
    if (content === "/commands on") commands = true;
    if (!commands) return;
    if (/^\/players$/i.test(content)) {
        sendMessage(getPlayerList().map((player) => player.toLowerCase()).join(", "), type, target);
    }
    else if (/^\/spectators$/i.test(content)) {
        sendMessage(getSpectatorList().map((player) => player.toLowerCase()).join(", "), type, target);
    }
    else if (/^\/teammates$/i.test(content)) {
        sendMessage(getTeamList(getTeamNumber(selfName)).join(", "), type, target);
    }
    else if (/^\/roll$/i.test(content)) {
        sendMessage("Options: #, player, otherplayer, teammate, otherteammate, playerteam, relay, spectator", type, target, true);
    }
    else if (/^\/roll [0-9]+$/i.test(content)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        sendMessage("rolls " + (Math.floor(Math.random() * number) + 1), type, target);
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low), type, target);
    }
    else if (/^\/roll (p|players?)$/i.test(content)) {
        let list = getPlayerList();
        sendMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no players", type, target);
    }
    else if (/^\/roll (op|otherplayers?)$/i.test(content)) {
        let name = getRandomOtherPlayer();
        if (name) sendMessage(name, type, target);
    }
    else if (/^\/roll (t|teammates?)$/i.test(content)) {
        let list = getTeamList(getTeamNumber(selfName));
        sendMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no teammates", type, target);
    }
    else if (/^\/roll (ot|otherteammates?)$/i.test(content)) {
        let name = getRandomOtherTeammate();
        if (name) sendMessage(name, type, target);
    }
    else if (/^\/roll (pt|playerteams?|teams?|warlords?)$/i.test(content)) {
        if (hostModal.getSettings().teamSize === 1) return sendMessage("team size must be greater than 1", type, target);
        let dict = getTeamDictionary();
        if (Object.keys(dict).length > 0) {
            let teams = Object.keys(dict);
            teams.sort((a, b) => parseInt(a) - parseInt(b));
            teams.forEach((team, i) => {
                let name = dict[team][Math.floor(Math.random() * dict[team].length)];
                setTimeout(() => { sendMessage(`Team ${team}: ${name}`, type, target) }, (i + 1) * 200);
            });
        }
    }
    else if (/^\/roll (s|spec|spectators?)$/i.test(content)) {
        let list = getSpectatorList();
        sendMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators", type, target);
    }
    else if (/^\/roll relays?$/i.test(content)) {
        if (hostModal.getSettings().teamSize === 1) return sendMessage("team size must be greater than 1", type, target);
        let dict = getTeamDictionary();
        if (Object.keys(dict).length === 0) return;
        let teams = Object.keys(dict);
        teams.sort((a, b) => parseInt(a) - parseInt(b));
        teams.forEach((team, i) => {
            setTimeout(() => { sendMessage(`Team ${team}: ` + shuffleArray(dict[team]).join(" ➜ "), type, target) }, (i + 1) * 200);
        });
    }
    else if (/^\/roll .+,.+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendMessage(list[Math.floor(Math.random() * list.length)], type, target);
    }
    else if (/^\/shuffle .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendMessage(shuffleArray(list).join(", "), type, target);
    }
    else if (/^\/(calc|math) .+$/i.test(content)) {
        sendMessage(calc(/^\S+ (.+)$/.exec(content)[1]), type, target);
    }
    else if (/^\/size [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.roomSize = option;
        changeGameSettings(settings);
    }
    else if (/^\/(t|types?|songtypes?) \w+$/i.test(content)) {
        let option = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
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
    else if (/^\/(t|types?|songtypes?) \w+ [0-9]+$/i.test(content)) {
        let option = /^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase();
        let value = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        if (option[0] === "o") settings.songType.advancedValue.openings = value;
        else if (option[0] === "e") settings.songType.advancedValue.endings = value;
        else if (option[0] === "i") settings.songType.advancedValue.inserts = value;
        else if (option[0] === "r") settings.songType.advancedValue.random = value;
        changeGameSettings(settings);
    }
    else if (/^\/watched$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 1;
        settings.songSelection.advancedValue.watched = 0;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.random = settings.numberOfSongs;
        changeGameSettings(settings);
    }
    else if (/^\/random$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 3;
        settings.songSelection.advancedValue.watched = settings.numberOfSongs;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.random = 0;
        changeGameSettings(settings);
    }
    else if (/^\/selection \w+ [0-9]+$/i.test(content)) {
        let option = /^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase();
        let value = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        if (option[0] === "w") settings.songSelection.advancedValue.watched = value;
        else if (option[0] === "u") settings.songSelection.advancedValue.unwatched = value;
        else if (option[0] === "r") settings.songSelection.advancedValue.random = value;
        changeGameSettings(settings);
    }
    else if (/^\/time [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.guessTime.randomOn = false;
        settings.guessTime.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/lives [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.scoreType = 3;
        settings.lives = option;
        changeGameSettings(settings);
    }
    else if (/^\/team [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.teamSize.randomOn = false;
        settings.teamSize.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/(n|songs|numsongs) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.numberOfSongs = option;
        changeGameSettings(settings);
    }
    else if (/^\/(d|dif|difficulty) [0-9]+[ -][0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ -][0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ -]([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.songDifficulity.advancedOn = true;
        settings.songDifficulity.advancedValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/skip$/i.test(content)) {
        quiz.skipClicked();
    }
    else if (/^\/pause$/i.test(content)) {
        socket.sendCommand({type: "quiz", command: "quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause")});
    }
    else if (/^\/speed$/i.test(content)) {
        playbackSpeed = null;
        sendMessage("song playback speed set to default", type, target, true);
    }
    else if (/^\/speed [0-9.]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(option) || option === 0) return;
        playbackSpeed = option;
        sendMessage("song playback speed set to " + playbackSpeed, type, target, true);
    }
    else if (/^\/speed [0-9.]+[ -][0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        playbackSpeed = [low, high];
        sendMessage(`song playback speed set to random # between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/(avs|autoskip|autovoteskip)$/i.test(content)) {
        if (autoVoteSkip === null) autoVoteSkip = 100;
        else autoVoteSkip = null;
        sendMessage("auto vote skip " + (autoVoteSkip ? "enabled" : "disabled"), type, target, true);
    }
    else if (/^\/(avs|autoskip|autovoteskip) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = seconds * 1000;
        sendMessage(`auto vote skip after ${seconds} seconds`, type, target, true);
    }
    else if (/^\/(ak|autokey|autosubmit)$/i.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendMessage("auto key " + (autoKey ? "enabled" : "disabled"), type, target, true);
    }
    else if (/^\/(at|autothrow)$/i.test(content)) {
        autoThrow = "";
        sendMessage("auto throw disabled " + autoCopy, type, target, true);
    }
    else if (/^\/(at|autothrow) .+$/i.test(content)) {
        autoThrow = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendMessage("auto throwing: " + autoThrow, type, target, true);
    }
    else if (/^\/(ac|autocopy)$/i.test(content)) {
        autoCopy = "";
        sendMessage("auto copy disabled", type, target, true);
    }
    else if (/^\/(ac|autocopy) \w+$/i.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage("auto copying " + autoCopy, type, target, true);
    }
    else if (/^\/(am|automute)$/i.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = null;
        autoUnmute = null;
        sendMessage("auto mute disabled", type, target, true);
    }
    else if (/^\/(am|automute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = seconds * 1000;
        autoUnmute = null;
        sendMessage(`auto muting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
    }
    else if (/^\/(am|automute) [0-9.]+[ -][0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoMute = [low * 1000, high * 1000];
        autoUnmute = null;
        sendMessage(`auto muting after random # of seconds between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/(au|autounmute)$/i.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoUnmute = null;
        autoMute = null;
        sendMessage("auto unmute disabled", type, target, true);
    }
    else if (/^\/(au|autounmute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoUnmute = seconds * 1000;
        autoMute = null;
        sendMessage(`auto unmuting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
    }
    else if (/^\/(au|autounmute) [0-9.]+[ -][0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoUnmute = [low * 1000, high * 1000];
        autoMute = null;
        sendMessage(`auto unmuting after random # of seconds between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/autoready$/i.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendMessage("auto ready " + (autoReady ? "enabled" : "disabled"), type, target, true);
        checkAutoReady();
    }
    else if (/^\/autostart$/i.test(content)) {
        autoStart = !autoStart;
        sendMessage("auto start game " + (autoStart ? "enabled" : "disabled"), type, target, true);
        checkAutoStart();
    }
    else if (/^\/(ah|autohost)$/i.test(content)) {
        autoHost = "";
        sendMessage("auto host disabled", type, target, true);
    }
    else if (/^\/(ah|autohost) \S+$/i.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendMessage("auto hosting " + autoHost, type, target, true);
        checkAutoHost();
    }
    else if (/^\/autoinvite$/i.test(content)) {
        autoInvite = "";
        sendMessage("auto invite disabled", type, target, true);
    }
    else if (/^\/autoinvite \w+$/i.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage("auto inviting " + autoInvite, type, target, true);
    }
    else if (/^\/autoaccept$/i.test(content)) {
        autoAcceptInvite = !autoAcceptInvite;
        saveSettings();
        sendMessage("auto accept invite " + (autoAcceptInvite ? "enabled" : "disabled"), type, target, true);
    }
    else if (/^\/autoaccept .+$/i.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter((x) => !!x);
        saveSettings();
        sendMessage("auto accept invite only from " + autoAcceptInvite.join(", "), type, target, true);
    }
    else if (/^\/autojoin$/i.test(content)) {
        if (autoJoinRoom || isSoloMode() || isRankedMode()) {
            autoJoinRoom = false;
            saveSettings();
            sendMessage("auto join room disabled", type, target, true);
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            autoJoinRoom = {id: lobby.gameId, password: password};
            saveSettings();
            sendMessage(`auto joining room ${lobby.gameId} ${password}`, type, target, true);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    autoJoinRoom = {id: payload.gameId, password: password};
                    saveSettings();
                    sendMessage(`auto joining room ${payload.gameId} ${password}`, type, target, true);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({type: "social", command: "invite to game", data: {target: selfName}});
        }
        else {
            autoJoinRoom = false;
            saveSettings();
            sendMessage("auto join room disabled", type, target, true);
        }
    }
    else if (/^\/autojoin [0-9]+/i.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        autoJoinRoom = {id: id, password: password ? password : ""};
        saveSettings();
        sendMessage(`auto joining room ${id} ${password}`, type, target, true);
    }
    else if (/^\/autoswitch$/i.test(content)) {
        autoSwitch = "";
        sendMessage("auto switch disabled", type, target, true);
    }
    else if (/^\/autoswitch (p|s)/i.test(content)) {
        if (/^\S+ p/i.test(content)[1]) autoSwitch = "player";
        else if (/^\S+ s/i.test(content)[1]) autoSwitch = "spectator";
        sendMessage("auto switching to " + autoSwitch, type, target, true);
        checkAutoSwitch();
    }
    else if (/^\/autolobby$/i.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendMessage("auto vote lobby " + (autoVoteLobby ? "enabled" : "disabled"), type, target, true);
    }
    else if (/^\/autostatus$/i.test(content)) {
        autoStatus = "";
        saveSettings();
        sendMessage("auto status removed", type, target, true);
    }
    else if (/^\/autostatus .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option === "away" || option === "do not disturb" || option === "invisible") {
            autoStatus = option;
            saveSettings();
            sendMessage("auto status set to " + autoStatus, type, target, true);
        }
        else {
            sendMessage("Options: away, do not disturb, invisible", type, target, true);
        }
    }
    else if (/^\/(cd|countdown)$/i.test(content)) {
        if (countdown === null) {
            sendMessage("Command: /countdown #", type, target, true);
        }
        else {
            countdown = null;
            clearInterval(countdownInterval);
            sendMessage("countdown stopped", type, target, true);
        }
    }
    else if (/^\/(cd|countdown) [0-9]+$/i.test(content)) {
        if (type !== "chat" || !lobby.inLobby) return;
        if (!lobby.isHost) return sendMessage("countdown failed: not host", type, target, true);
        countdown = parseInt(/^\S+ (.+)$/.exec(content)[1]);
        sendMessage(`Game starting in ${countdown} seconds`, type, target);
        countdownInterval = setInterval(() => {
            if (countdown < 1) {
                if (!lobby.inLobby) null;
                else if (!lobby.isHost) sendMessage("failed to start: not host", type, target);
                else if (!allPlayersReady()) sendMessage("failed to start: not all players ready", type, target);
                else lobby.fireMainButtonEvent();
                countdown = null;
                clearInterval(countdownInterval);
            }
            else {
                if (countdown % 10 === 0 || countdown <= 5) {
                    sendMessage(countdown, type, target);
                }
                countdown--;
            }
        }, 1000);
    }
    else if (/^\/ready$/i.test(content)) {
        if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
            lobby.fireMainButtonEvent();
        }
    }
    else if (/^\/(inv|invite)$/i.test(content)) {
        if (type === "dm") {
            socket.sendCommand({type: "social", command: "invite to game", data: {target: target}});
        }
    }
    else if (/^\/(inv|invite) \w+$/i.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socket.sendCommand({type: "social", command: "invite to game", data: {target: name}});
    }
    else if (/^\/(spec|spectate)$/i.test(content)) {
        lobby.changeToSpectator(selfName);
    }
    else if (/^\/(spec|spectate) \w+$/i.test(content)) {
        let name = getClosestNameInRoom(/^\S+ (\w+)$/.exec(content)[1]);
        if (isInYourRoom(name)) lobby.changeToSpectator(getPlayerNameCorrectCase(name));
    }
    else if (/^\/join$/i.test(content)) {
        socket.sendCommand({type: "lobby", command: "change to player"});
    }
    else if (/^\/join [0-9]+$/i.test(content)) {
        if (inRoom()) return;
        let id = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        roomBrowser.fireSpectateGame(id);
    }
    else if (/^\/join [0-9]+ .+$/i.test(content)) {
        if (inRoom()) return;
        let id = parseInt(/^\S+ ([0-9]+) .+$/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        roomBrowser.fireSpectateGame(id, password);
    }
    else if (/^\/queue$/i.test(content)) {
        gameChat.joinLeaveQueue();
    }
    else if (/^\/host \w+$/i.test(content)) {
        let name = getClosestNameInRoom(/^\S+ (\w+)$/.exec(content)[1]);
        if (isInYourRoom(name)) {
            if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
                lobby.promoteHost(getPlayerNameCorrectCase(name));
            }
            else if (nexus.inCoopLobby || nexus.inNexusGame) {
                socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: getPlayerNameCorrectCase(name)}});
            }
        }
    }
    else if (/^\/kick \w+$/i.test(content)) {
        let name = getClosestNameInRoom(/^\S+ (\w+)$/.exec(content)[1]);
        if (isInYourRoom(name)) {
            if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
                socket.sendCommand({type: "lobby", command: "kick player", data: {playerName: getPlayerNameCorrectCase(name)}});
            }
            else if (nexus.inCoopLobby || nexus.inNexusGame) {
                socket.sendCommand({type: "nexus", command: "nexus kick player", data: {name: "nyan_cat"}});
            }
        }
    }
    else if (/^\/(lb|lobby|returntolobby)$/i.test(content)) {
        socket.sendCommand({type: "quiz", command: "start return lobby vote"});
    }
    else if (/^\/(v|volume) [0-9]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9]+)$/.exec(content)[1]) / 100;
        volumeController.volume = option;
        volumeController.setMuted(false);
        volumeController.adjustVolume();
    }
    else if (/^\/clear$/i.test(content)) {
        setTimeout(() => { document.querySelectorAll("#gcMessageContainer li").forEach((e) => e.remove()) }, 1);
    }
    else if (/^\/(dd|dropdown)$/i.test(content)) {
        dropdown = !dropdown;
        sendMessage("dropdown " + (dropdown ? "enabled" : "disabled"), type, target, true);
        quiz.answerInput.autoCompleteController.newList();
    }
    else if (/^\/(dds|dropdownspec|dropdownspectate)$/i.test(content)) {
        dropdownInSpec = !dropdownInSpec;
        if (dropdownInSpec) $("#qpAnswerInput").removeAttr("disabled");
        sendMessage("dropdown while spectating " + (dropdownInSpec ? "enabled" : "disabled"), type, target, true);
        saveSettings();
    }
    else if (/^\/(pw|password)$/i.test(content)) {
        sendMessage("password: " + hostModal.getSettings().password, type, target);
    }
    else if (/^\/online \w+$/i.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            sendMessage(onlineUsers.localeIncludes(name) ? "online" : "offline", type, target);
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({type: "social", command: "get online users"});
    }
    else if (/^\/invisible$/i.test(content)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = Object.keys(socialTab.offlineFriends).filter((name) => onlineUsers.includes(name));
            sendMessage(list.length > 0 ? list.join(", ") : "no invisible friends detected", type, target);
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({type: "social", command: "get online users"});
    }
    else if (/^\/(roomid|lobbyid)$/i.test(content)) {
        if (lobby.inLobby) {
            sendMessage(lobby.gameId, type, target);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    sendMessage(payload.gameId, type, target);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({type: "social", command: "invite to game", data: {target: selfName}});
        }
    }
    else if (/^\/(dm|pm)$/i.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(dm|pm) \w+$/i.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(dm|pm) \w+ .+$/i.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({type: "social", command: "chat message", data: {target: name, message: text}});
    }
    else if (/^\/(prof|profile) \w+$/i.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/(rules|gamemodes?)$/i.test(content)) {
        sendMessage(Object.keys(rules).join(", "), type, target);
    }
    else if (/^\/(rules|gamemodes?) .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in rules) sendMessage(rules[option], type, target);
    }
    else if (/^\/scripts?$/i.test(content)) {
        sendMessage(Object.keys(scripts).join(", "), type, target);
    }
    else if (/^\/scripts? .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in scripts) sendMessage(scripts[option], type, target);
    }
    else if (/^\/info$/i.test(content)) {
        sendMessage(Object.keys(info).join(", "), type, target);
    }
    else if (/^\/info .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in info) sendMessage(info[option], type, target);
    }
    else if (/^\/leave$/i.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
    }
    else if (/^\/rejoin$/i.test(content)) {
        rejoinRoom(100);
    }
    else if (/^\/rejoin ([0-9]+)$/i.test(content)) {
        let time = parseInt((/^\S+ ([0-9]+)$/).exec(content)[1]) * 1000;
        rejoinRoom(time);
    }
    else if (/^\/(logout|logoff)$/i.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
        setTimeout(() => { options.logout() }, 10);
    }
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/i.test(content)) {
        if (isSoloMode()) {
            autoJoinRoom = {type: "solo", temp: true, settings: hostModal.getSettings(), autoLogIn: true};
            saveSettings();
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (isRankedMode()) {
            autoJoinRoom = {type: "ranked", temp: true, autoLogIn: true};
            saveSettings();
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            autoJoinRoom = {type: "multiplayer", id: lobby.gameId, password: password, joinAsPlayer: !lobby.isSpectator, temp: true, autoLogIn: true};
            saveSettings();
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    autoJoinRoom = {type: "multiplayer", id: payload.gameId, password: password, temp: true, autoLogIn: true};
                    saveSettings();
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                    setTimeout(() => { window.location = "/" }, 10);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({type: "social", command: "invite to game", data: {target: selfName}});
        }
        else if (nexus.inNexusLobby) {
            if (nexus.inCoopLobby) {
                if (Object.keys(nexusCoopChat.playerMap).length > 1) {
                    autoJoinRoom = {type: "nexus coop", id: $("#ncdwPartySetupLobbyIdText").text(), temp: true, autoLogIn: true};
                    saveSettings();
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                    setTimeout(() => { window.location = "/" }, 10);
                }
                else {
                    autoJoinRoom = {type: "nexus coop", temp: true, autoLogIn: true};
                    saveSettings();
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                    setTimeout(() => { window.location = "/" }, 10);
                }
            }
            else {
                autoJoinRoom = {type: "nexus solo", temp: true, autoLogIn: true};
                saveSettings();
                setTimeout(() => { viewChanger.changeView("main") }, 1);
                setTimeout(() => { window.location = "/" }, 10);
            }
        }
        else {
            autoJoinRoom = {temp: true, autoLogIn: true};
            saveSettings();
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
    }
    else if (/^\/alien$/i.test(content)) {
        sendMessage("command: /alien pick #", type, target, true);
    }
    else if (/^\/alien pick [0-9]+$/i.test(content)) {
        let n = parseInt(/^\S+ pick ([0-9]+)$/.exec(content)[1]);
        if (!inRoom() || n < 1) return;
        if (Object.keys(lobby.players).length < n) return sendMessage("not enough people", type, target);
        let aliens = shuffleArray(getPlayerList()).slice(0, n);
        aliens.forEach((alien, i) => {
            setTimeout(() => {
                socket.sendCommand({
                    type: "social",
                    command: "chat message",
                    data: {target: alien, message: "Aliens: " + aliens.join(", ") + " (turn on your list and disable share entries)"}
                });
            }, 500 * i);
        });
        setTimeout(() => { sendMessage(n + " alien" + (n === 1 ? "" : "s") + " chosen", type, target) }, 500 * n);
    }
    else if (/^\/(bg|background|wallpaper)$/i.test(content)) {
        backgroundURL = "";
        AMQ_addStyle(`
            #loadingScreen, #gameContainer {
                background-image: -webkit-image-set(url(../img/backgrounds/normal/bg-x1.jpg) 1x, url(../img/backgrounds/normal/bg-x2.jpg) 2x);
            }
            #gameChatPage .col-xs-9 {
                background-image: -webkit-image-set(url(../img/backgrounds/blur/bg-x1.jpg) 1x, url(../img/backgrounds/blur/bg-x2.jpg) 2x);
            }
        `);
        saveSettings();
    }
    else if (/^\/(bg|background|wallpaper) (link|url)$/i.test(content)) {
        if (backgroundURL) sendMessage(backgroundURL, type, target);
    }
    else if (/^\/(bg|background|wallpaper) http.+\.(jpg|jpeg|png|gif|tiff|bmp|webp)$/i.test(content)) {
        backgroundURL = /^\S+ (.+)$/.exec(content)[1];
        AMQ_addStyle(`
            #loadingScreen, #gameContainer {
                background-image: url(${backgroundURL});
            }
            #gameChatPage .col-xs-9 {
                background-image: none;
            }
        `);
        saveSettings();
    }
    else if (/^\/detect$/i.test(content)) {
        sendMessage("invisible: " + playerDetection.invisible, type, target, true);
        sendMessage("players: " + playerDetection.players.join(", "), type, target, true);
    }
    else if (/^\/detect disable$/i.test(content)) {
        playerDetection = {invisible: false, players: []};
        saveSettings();
        sendMessage("detection system disabled", type, target, true);
    }
    else if (/^\/detect invisible$/i.test(content)) {
        playerDetection.invisible = true;
        saveSettings();
        sendMessage("now detecting invisible friends in the room browser", type, target, true);
    }
    else if (/^\/detect \w+$/i.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1];
        if (playerDetection.players.includes(name)) {
            playerDetection.players = playerDetection.players.filter((item) => item !== name);
            sendMessage(`${name} removed from detection system`, type, target, true);
        }
        else {
            playerDetection.players.push(name);
            sendMessage(`now detecting ${name} in the room browser`, type, target, true);
        }
        saveSettings();
    }
    else if (/^\/startvote .+,.+$/i.test(content)) {
        if (type !== "chat") return;
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length < 2) return;
        sendMessage("Voting started, to vote type /vote #", type, target);
        sendMessage("to stop vote type /stopvote", type, target, true);
        voteOptions = {};
        votes = {};
        list.forEach((x, i) => {
            voteOptions[i + 1] = x;
            sendMessage(`${i + 1}: ${x}`, type, target);
        });
    }
    else if (/^\/(stopvote|endvote)$/i.test(content)) {
        if (Object.keys(voteOptions).length === 0) return;
        if (Object.keys(votes).length) {
            let results = {};
            Object.keys(voteOptions).forEach((x) => { results[x] = 0 });
            Object.values(votes).forEach((x) => { results[x] += 1 });
            let max = Math.max(...Object.values(results));
            let mostVotes = Object.keys(voteOptions).filter((x) => results[x] === max).map((x) => voteOptions[x]);
            sendMessage(`Most votes: ${mostVotes.join(", ")} (${max} vote${max === 1 ? "" : "s"})`, type, target);
        }
        else {
            sendMessage("no votes", type, target);
        }
        voteOptions = {};
        votes = {};
    }
    else if (/^\/printloot$/i.test(content)) {
        printLoot = !printLoot;
        saveSettings();
        sendMessage("print loot " + (printLoot ? "enabled" : "disabled"), type, target, true);
    }
    else if (/^\/remove (popups?|popovers?)$/i.test(content)) {
        $(".popover").hide();
    }
    else if (/^\/commands$/i.test(content)) {
        sendMessage("Options: on, off, help, link, version, clear, auto", type, target, true);
    }
    else if (/^\/commands on$/i.test(content)) {
        commands = true;
        sendMessage("Mega Commands enabled", type, target, true);
    }
    else if (/^\/commands off$/i.test(content)) {
        commands = false;
        sendMessage("Mega Commands disabled", type, target, true);
    }
    else if (/^\/commands help$/i.test(content)) {
        sendMessage("https://kempanator.github.io/amq-mega-commands", type, target);
    }
    else if (/^\/commands link$/i.test(content)) {
        sendMessage("https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js", type, target);
    }
    else if (/^\/commands version$/i.test(content)) {
        sendMessage(version, type, target);
    }
    else if (/^\/commands clear$/i.test(content)) {
        localStorage.removeItem("megaCommands");
        sendMessage("mega commands local storage cleared", type, target, true);
    }
    else if (/^\/commands auto$/i.test(content)) {
        autoList().forEach((item) => sendMessage(item, type, target, true));
    }
    else if (/^\/version$/i.test(content)) {
        sendMessage("Mega Commands - " + version, type, target, true);
    }
}

/**
 * parse incoming dm
 * @param {String} content message text
 * @param {String} sender name of player who sent the message
 */
function parseIncomingDM(content, sender) {
    if (commands) {
        if (isFriend(sender)) {
            if (/^\/(fr|forceready)$/i.test(content) && lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
            else if (/^\/(fi|forceinvite)$/i.test(content) && inRoom()) {
                socket.sendCommand({type: "social", command: "invite to game", data: {target: sender}});
            }
            else if (/^\/(fp|forcepassword)$/i.test(content) && inRoom()) {
                sendMessage("password: " + hostModal.getSettings().password, "dm", sender);
            }
            else if (/^\/(fh|forcehost)$/i.test(content)) {
                if (lobby.inLobby && lobby.isHost) {
                    lobby.promoteHost(sender);
                }
                else if (nexus.inCoopLobby && nexusCoopChat.hostName === selfName) {
                    socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: sender}});
                }
            }
            else if (/^\/(fh|forcehost) \w+$/i.test(content)) {
                let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
                if (lobby.inLobby && lobby.isHost) {
                    lobby.promoteHost(name);
                }
                else if (nexus.inCoopLobby && nexusCoopChat.hostName === selfName) {
                    socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: name}});
                }
            }
            else if (/^\/forceautolist$/i.test(content)) {
                autoList().forEach((text, i) => setTimeout(() => { sendMessage(text, "dm", sender) }, i * 200));
            }
        }
        if (/^\/(fv|forceversion)$/i.test(content)) {
            sendMessage(version, "dm", sender);
        }
        else if (/^\/whereis \w+$/i.test(content)) {
            if (Object.keys(roomBrowser.activeRooms).length === 0) return;
            let name = /^\S+ (\w+)$/.exec(content)[1];
            let foundRoom = Object.values(roomBrowser.activeRooms).find((room) => room._players.localeIncludes(name));
            sendMessage(Number.isInteger(foundRoom?.id) ? `in room ${foundRoom.id}` : "not found", "dm", sender);
        }
        else if (/^\/room [0-9]+$/i.test(content)) {
            if (Object.keys(roomBrowser.activeRooms).length === 0) return;
            let roomId = /^\S+ ([0-9]+)$/.exec(content)[1];
            if (roomId in roomBrowser.activeRooms) {
                let room = roomBrowser.activeRooms[roomId];
                setTimeout(() => sendMessage(`${room._private ? "private" : "public"} room: ${room.roomName}`, "dm", sender), 100);
                setTimeout(() => sendMessage(`host: ${room.host}, players: ${room._numberOfPlayers}, spectators: ${room._numberOfSpectators}`, "dm", sender), 300);
            }
            else {
                sendMessage("not found", "dm", sender);
            }
        }
    }
}

/**
 * parse forceall command
 * @param {String} content message text
 * @param {String} type dm, chat, teamchat, nexus
 */
function parseForceAll(content, type) {
    if (/^\/forceall version$/i.test(content)) {
        sendMessage("0.62", type);
    }
    else if (/^\/forceall roll [0-9]+$/i.test(content)) {
        let number = parseInt(/^\S+ roll ([0-9]+)$/.exec(content)[1]);
        sendMessage(Math.floor(Math.random() * number) + 1, type);
    }
    else if (/^\/forceall mutestatus$/i.test(content)) {
        sendMessage(volumeController.muted ? "🔇" : "🔉 " + Math.round(volumeController.volume * 100) + "%", type);
    }
    else if (/^\/forceall speed$/i.test(content)) {
        if (playbackSpeed === null) sendMessage("speed: default", type);
        else sendMessage("speed: " + (Array.isArray(playbackSpeed) ? `random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x` : `${playbackSpeed}x`), type);
    }
    else if (/^\/forceall skip$/i.test(content)) {
        quiz.skipClicked();
    }
}

/**
 * parse vote
 * @param {String} content message text
 * @param {String} sender name of player who sent the message
 */
function parseVote(content, sender) {
    if (Object.keys(voteOptions).length) {
        let option = /^\/vote ([0-9]+)$/.exec(content)[1];
        if (option in voteOptions) votes[sender] = option;
    }
}

/**
 * send a message
 * @param {String} content message text
 * @param {String} type dm, chat, teamchat, nexus
 * @param {String} target name of player you are sending to if dm
 * @param {Boolean} sys true if system message
 */
function sendMessage(content, type, target, sys) {
    if (content === null || content === undefined) return;
    content = String(content).trim();
    if (content === "") return;
    if (type === "dm") {
        setTimeout(() => { socket.sendCommand({type: "social", command: "chat message", data: {target: target, message: content}}) }, 100);
    }
    else if (type === "chat") {
        if (sys) setTimeout(() => { gameChat.systemMessage(content) }, 1);
        else socket.sendCommand({type: "lobby", command: "game chat message", data: {msg: content, teamMessage: false}});
    }
    else if (type === "teamchat") {
        if (sys) setTimeout(() => { gameChat.systemMessage(content) }, 1);
        else socket.sendCommand({type: "lobby", command: "game chat message", data: {msg: content, teamMessage: true}});
    }
    else if (type === "nexus") {
        if (sys) setTimeout(() => { nexusCoopChat.displayServerMessage({message: content}) }, 1);
        else socket.sendCommand({type: "nexus", command: "coop chat message", data: {message: content}});
    }
}

function S(a, b) {
    return a.split("").map((x) => String.fromCharCode(x.charCodeAt(0) + b)).join("");
}

// return true if you are in a solo lobby or quiz
function isSoloMode() {
    return (lobby.inLobby && lobby.soloMode) || (quiz.inQuiz && quiz.soloMode) || (battleRoyal.inView && battleRoyal.soloMode);
}

// return true if you are in a ranked lobby or quiz
function isRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
}

// return true if player is your friend
function isFriend(name) {
    name = name.toLowerCase();
    for (let friend of getAllFriends()) {
        if (friend.toLowerCase() === name) return true;
    }
    return false;
}

// return true if player is in lobby or quiz (not spectating)
function isPlayer(name) {
    name = name.toLowerCase();
    if (lobby.inLobby) {
        for (let player of Object.values(lobby.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (quiz.inQuiz) {
        for (let player of Object.values(quiz.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (battleRoyal.inView) {
        for (let player of Object.values(battleRoyal.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (nexus.inNexusLobby || nexus.inNexusGame) {
        if (Object.keys(nexusCoopChat.playerMap).length) {
            for (let player of Object.keys(nexusCoopChat.playerMap)) {
                if (player.toLowerCase() === name) return true;
            }
        }
        else return selfName.toLowerCase() === name;
    }
    return false;
}

// return true if player is spectator
function isSpectator(name) {
    name = name.toLowerCase();
    for (let player of gameChat.spectators) {
        if (player.name.toLowerCase() === name) return true;
    }
    return false;
}

// return true if player is in your room
function isInYourRoom(name) {
    return isPlayer(name) || isSpectator(name);
}

// return true if you are in a room
function inRoom() {
    return lobby.inLobby || quiz.inQuiz || battleRoyal.inView || nexus.inNexusLobby || nexus.inNexusGame;
}

// return array of names of all friends
function getAllFriends() {
    return Object.keys(socialTab.onlineFriends).concat(Object.keys(socialTab.offlineFriends));
}

// return array of names of players in game
function getPlayerList() {
    if (lobby.inLobby) {
        return Object.values(lobby.players).map((player) => player._name);
    }
    if (quiz.inQuiz) {
        return Object.values(quiz.players).map((player) => player._name);
    }
    if (battleRoyal.inView) {
        return Object.values(battleRoyal.players).map((player) => player._name);
    }
    if (nexus.inNexusLobby || nexus.inNexusGame) {
        if (Object.keys(nexusCoopChat.playerMap).length) {
            return Object.keys(nexusCoopChat.playerMap);
        }
        else return [selfName];
    }
    return [];
}

// return array of names of spectators
function getSpectatorList() {
    return gameChat.spectators.map((player) => player.name);
}

// return object with team numbers as keys and list of player names as each value
function getTeamDictionary() {
    let teamDictionary = {};
    if (lobby.inLobby) {
        for (let lobbyAvatar of document.querySelectorAll(".lobbyAvatar")) {
            let name = lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner h2").innerText;
            let team = lobbyAvatar.querySelector(".lobbyAvatarTeamContainer h3").innerText;
            if (isNaN(parseInt(team))) return {};
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    else if (quiz.inQuiz) {
        for (let player of Object.values(quiz.players)) {
            let name = player._name;
            let team = player.teamNumber;
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    else if (battleRoyal.inView) {
        for (let player of Object.values(battleRoyal.players)) {
            let name = player._name;
            let team = player.teamNumber;
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    return teamDictionary;
}

// input team number, return list of names of players on team
function getTeamList(team) {
    if (!Number.isInteger(team)) return [];
    let list = [];
    if (lobby.inLobby) {
        for (let lobbyAvatar of document.querySelectorAll(".lobbyAvatar")) {
            if (parseInt(lobbyAvatar.querySelector(".lobbyAvatarTeamContainer h3").innerText) === team) {
                list.push(lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner h2").innerText);
            }
        }
    }
    else if (quiz.inQuiz) {
        for (let player of Object.values(quiz.players)) {
            if (player.teamNumber === team) {
                list.push(player._name);
            }
        }
    }
    else if (battleRoyal.inView) {
        for (let player of Object.values(battleRoyal.players)) {
            if (player.teamNumber === team) {
                list.push(player._name);
            }
        }
    }
    return list;
}

// input player name, return their team number
function getTeamNumber(name) {
    if (lobby.inLobby) {
        for (let lobbyAvatar of document.querySelectorAll(".lobbyAvatar")) {
            if (lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner h2").innerText === name) {
                return parseInt(lobbyAvatar.querySelector(".lobbyAvatarTeamContainer h3").innerText);
            }
        }
    }
    if (quiz.inQuiz) {
        for (let player of Object.values(quiz.players)) {
            if (player._name === name) {
                return player.teamNumber;
            }
        }
    }
    if (battleRoyal.inView) {
        for (let player of Object.values(battleRoyal.players)) {
            if (player._name === name) {
                return player.teamNumber;
            }
        }
    }
}

// return a random player name in the room besides yourself
function getRandomOtherPlayer() {
    let list = getPlayerList().filter((player) => player !== selfName);
    return list[Math.floor(Math.random() * list.length)];
}

// return a random player name on your team besides yourself
function getRandomOtherTeammate() {
    let list = getTeamList(getTeamNumber(selfName)).filter((player) => player !== selfName);
    return list[Math.floor(Math.random() * list.length)];
}

// send a regular public message in game chat
function sendChatMessage(message, isTeamMessage) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: {msg: String(message), teamMessage: Boolean(isTeamMessage)}
    });
}

// send a client side message to game chat
function sendSystemMessage(message) {
    setTimeout(() => { gameChat.systemMessage(String(message)) }, 1);
}

// send a message in nexus chat
function sendNexusChatMessage(message) {
    socket.sendCommand({
        type: "nexus",
        command: "coop chat message",
        data: {message: String(message)}
    });
}

// send a client side message to game chat
function sendNexusSystemMessage(message) {
    setTimeout(() => { nexusCoopChat.displayServerMessage({message: String(message)}) }, 1);
}

// send a private message
function sendDM(target, message) {
    setTimeout(() => {
        socket.sendCommand({
            type: "social",
            command: "chat message",
            data: {target: target, message: String(message)}
        });
    }, 100);
}

// change game settings
function changeGameSettings(settings) {
    let settingChanges = {};
    for (let key of Object.keys(settings)) {
        if (JSON.stringify(lobby.settings[key]) !== JSON.stringify(settings[key])) {
            settingChanges[key] = settings[key];
        }
    }
    if (Object.keys(settingChanges).length > 0) {
        hostModal.changeSettings(settingChanges);
        setTimeout(() => { lobby.changeGameSettings() }, 1);
    }
}

// check if all players are ready in lobby
function allPlayersReady() {
    if (!lobby.inLobby) return false;
    for (let player of Object.values(lobby.players)) {
        if (!player._ready) return false;
    }
    return true;
}

// check conditions and ready up in lobby
function checkAutoReady() {
    if (autoReady && lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
        lobby.fireMainButtonEvent();
    }
}

// check conditions and start game
function checkAutoStart() {
    setTimeout(() => {
        if (autoStart && allPlayersReady() && lobby.isHost) {
            lobby.fireMainButtonEvent();
        }
    }, 1);
}

// check conditions and switch between player and spectator
function checkAutoSwitch() {
    if (lobby.inLobby) {
        if (autoSwitch === "player" && lobby.isSpectator) socket.sendCommand({type: "lobby", command: "change to player"});
        else if (autoSwitch === "spectator" && !lobby.isSpectator) lobby.changeToSpectator(selfName);
    }
}

// check conditions and promote host
function checkAutoHost() {
    if (!autoHost) return;
    if (lobby.inLobby && lobby.isHost) {
        if (autoHost === "{random}") {
            lobby.promoteHost(getRandomOtherPlayer());
        }
        else if (isInYourRoom(autoHost)) {
            lobby.promoteHost(getPlayerNameCorrectCase(autoHost));
        }
    }
    else if (nexus.inCoopLobby && nexusCoopChat.hostName === selfName && Object.keys(nexusCoopChat.playerMap).length > 1) {
        if (autoHost === "{random}") {
            socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: getRandomOtherPlayer()}});
        }
        else if (isInYourRoom(autoHost)) {
            socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: getPlayerNameCorrectCase(autoHost)}});
        }
    }
}

// rejoin the room you are currently in
// input number of milliseconds of delay
function rejoinRoom(time) {
    if (isSoloMode() || isRankedMode()) return;
    setTimeout(() => {
        if (lobby.inLobby) {
            let id = lobby.gameId;
            let password = hostModal.getSettings().password;
            let spec = isSpectator(selfName);
            lobby.leave();
            setTimeout(() => { spec ? roomBrowser.fireSpectateGame(id, password) : roomBrowser.fireJoinLobby(id, password) }, time);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let password = hostModal.getSettings().password;
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    viewChanger.changeView("roomBrowser");
                    setTimeout(() => { roomBrowser.fireSpectateGame(payload.gameId, password) }, time);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({type: "social", command: "invite to game", data: {target: selfName}});
        }
    }, 1);
}

// input name, return correct case sensitive name of player
function getPlayerNameCorrectCase(name) {
    let nameLowerCase = name.toLowerCase();
    if (inRoom()) {
        for (let player of getPlayerList().concat(getSpectatorList())) {
            if (nameLowerCase === player.toLowerCase()) {
                return player;
            }
        }
    }
    for (let player of getAllFriends()) {
        if (nameLowerCase === player.toLowerCase()) {
            return player;
        }
    }
    for (let player in socialTab.allPlayerList._playerEntries) {
        if (nameLowerCase === player.toLowerCase()) {
            return player;
        }
    }
    return name;
}

// return list of every auto function that is enabled
function autoList() {
    let list = [];
    if (autoVoteSkip !== null) list.push("Auto Vote Skip: Enabled");
    if (autoKey) list.push("Auto Key: Enabled");
    if (autoCopy) list.push("Auto Copy: " + autoCopy);
    if (autoThrow) list.push("Auto Throw: " + autoThrow);
    if (autoMute !== null) list.push("Auto Mute: " + (Array.isArray(autoMute) ? `random ${autoMute[0] / 1000}s - ${autoMute[1] / 1000}s` : `${autoMute / 1000}s`));
    if (autoUnmute !== null) list.push("Auto Unmute: " + (Array.isArray(autoUnmute) ? `random ${autoUnmute[0] / 1000}s - ${autoUnmute[1] / 1000}s` : `${autoUnmute / 1000}s`));
    if (autoReady) list.push("Auto Ready: Enabled");
    if (autoStart) list.push("Auto Start: Enabled");
    if (autoHost) list.push("Auto Host: " + autoHost);
    if (autoInvite) list.push("Auto Invite: " + autoInvite);
    if (autoAcceptInvite) list.push("Auto Accept Invite: Enabled");
    if (autoVoteLobby) list.push("Auto Vote Lobby: Enabled");
    if (autoSwitch) list.push("Auto Switch: " + autoSwitch);
    if (autoStatus) list.push("Auto Status: " + autoStatus);
    if (autoJoinRoom) list.push("Auto Join Room: " + autoJoinRoom.id);
    return list;
}

// calculate a math expression
function calc(input) {
    if (/^[0-9.+\-*/() ]+$/.test(input)) {
        try { return eval(input) }
        catch { return "ERROR" }
    }
    else return "ERROR";
}

// includes function for array of strings, ignore case
Array.prototype.localeIncludes = function(s) {
    s = s.toLowerCase();
    for (let item of this) {
        if (item.toLowerCase() === s) return true;
    }
    return false;
}

// override changeView function for auto ready
ViewChanger.prototype.changeView = (function() {
    let old = ViewChanger.prototype.changeView;
    return function() {
        old.apply(this, arguments);
        setTimeout(() => {
            if (viewChanger.currentView === "lobby") {
                checkAutoReady();
                checkAutoStart();
            }
        }, 1);
    }
})();

// override newList function for drop down disable
const oldNewList = AutoCompleteController.prototype.newList;
AutoCompleteController.prototype.newList = function() {
    if (this.list.length > 0) animeList = this.list;
    this.list = dropdown ? animeList : [];
    oldNewList.apply(this, arguments);
}

// save settings
function saveSettings() {
    let settings = {};
    settings.autoAcceptInvite = autoAcceptInvite;
    //settings.autoCopy = autoCopy;
    //settings.autoHost = autoHost;
    //settings.autoInvite = autoInvite;
    settings.autoJoinRoom = autoJoinRoom;
    settings.autoKey = autoKey;
    //settings.autoMute = autoMute;
    settings.autoReady = autoReady;
    //settings.autoStart = autoStart;
    settings.autoStatus = autoStatus;
    //settings.autoSwitch = autoSwitch;
    //settings.autoThrow = autoThrow;
    //settings.autoUnmute = autoUnmute;
    settings.autoVoteLobby = autoVoteLobby;
    //settings.autoVoteSkip = autoVoteSkip;
    settings.backgroundURL = backgroundURL;
    //settings.commands = commands;
    //settings.dropdown = dropdown;
    settings.dropdownInSpec = dropdownInSpec;
    settings.lastUsedVersion = version;
    //settings.playbackSpeed = playbackSpeed;
    settings.playerDetection = playerDetection;
    settings.printLoot = printLoot;
    localStorage.setItem("megaCommands", JSON.stringify(settings));
}
