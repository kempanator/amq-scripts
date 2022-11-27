// ==UserScript==
// @name            AMQ Mega Commands
// @namespace       https://github.com/kempanator
// @version         0.50
// @description     Commands for AMQ Chat
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js
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
/speed [1-4]          change song speed
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

OTHER
/roll                 roll number, player, playerteam, spectator
/shuffle [list]       shuffle a list of anything (separate with commas)
/calc [expression]    calculate a math expression
/rules                show list of gamemodes and rules
/info                 show list of external utilities
/clear                clear chat
/dm [name] [text]     direct message a player
/profile [name]       show profile window of any player
/password             reveal private room password
/invisible            show invisible friends (this command might be broken)
/background [url]     change the background
/logout               log out
/relog                log out, log in, and auto join the room you were in
/version              check the version of this script
/commands [on|off]    turn this script on or off
*/

"use strict";
const version = "0.50";
const saveData = JSON.parse(localStorage.getItem("megaCommands")) || {};
let animeList;
let autoAcceptInvite = saveData.autoAcceptInvite || false;
let autoCopy = saveData.autoCopy || "";
let autoHost = saveData.autoHost || "";
let autoInvite = saveData.autoInvite || "";
let autoJoinRoom = saveData.autoJoinRoom || false;
let autoKey = saveData.autoKey || false;
let autoMute = saveData.autoMute || null;
let autoReady = saveData.autoReady || false;
let autoStart = saveData.autoStart || false;
let autoStatus = saveData.autoStatus || "";
let autoSwitch = saveData.autoSwitch || "";
let autoThrow = saveData.autoThrow || "";
let autoUnmute = saveData.autoUnmute || null;
let autoVoteLobby = saveData.autoVoteLobby || false;
let autoVoteSkip = saveData.autoVoteSkip || null;
let backgroundURL = saveData.backgroundURL || "";
let commands = saveData.commands || true;
let countdown = null;
let countdownInterval;
let dropdown = saveData.dropdown || true;
let dropdownInSpec = saveData.dropdownInSpec || false;
let lastUsedVersion = saveData.lastUsedVersion || null;
let playerDetection = saveData.playerDetection || {invisible: false, players: []};
let printLoot = saveData.printLoot || false;
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
    if (autoJoinRoom && document.querySelector(".loginMainForm h1").innerText === "Account Already Online") {
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
        payload.messages.forEach((message) => { parseChat(message) });
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        parseChat(payload);
    }).bindListener();
    new Listener("chat message", (payload) => {
        parseIncomingDM(payload);
    }).bindListener();
    new Listener("chat message response", (payload) => {
        parseDM(payload);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (autoThrow) quiz.answerInput.setNewAnswer(autoThrow);
            if (autoVoteSkip !== null) setTimeout(() => { quiz.skipClicked() }, autoVoteSkip);
        }
        if (autoMute !== null) {
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, autoMute);
        }
        if (autoUnmute !== null) {
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            setTimeout(() => {
                document.querySelector("#qpVolume").classList.remove("disabled");
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }, autoUnmute);
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.autoCompleteController.list.length) quiz.answerInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled");
                $("#qpAnswerInput").val("");
            }, 1);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (autoVoteSkip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
        if (autoKey) sendSystemMessage("Auto Key: Enabled");
        if (autoCopy) sendSystemMessage("Auto Copy: " + autoCopy);
        if (autoThrow) sendSystemMessage("Auto Throw: " + autoThrow);
        if (autoMute !== null) sendSystemMessage("Auto Mute: " + (autoMute / 1000) + "s");
        if (autoUnmute !== null) sendSystemMessage("Auto Unmute: " + (autoUnmute / 1000) + "s");
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
            setTimeOut(() => { socket.sendCommand({ type: "social", command: "invite to game", data: { target: payload.name } }), 1000 });
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
        parseNexusChat(payload);
    }).bindListener();
    new Listener("nexus game invite", (payload) => {
        if (autoAcceptInvite && !inRoom() && ((autoAcceptInvite === true && isFriend(payload.sender))
        || (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())))) {
            socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: payload.lobbyId}});
        }
    }).bindListener();
    document.querySelector("#qpAnswerInput").addEventListener("input", (event) => {
        let answer = event.target.value || " ";
        if (autoKey) {
            socket.sendCommand({ type: "quiz", command: "quiz answer", data: { answer: answer, isPlaying: true, volumeAtMax: false } });
        }
    });
    // check auto join on log in
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
    const profileElement = document.querySelector("#playerProfileLayer");
    new MutationObserver(function() {
        if (profileElement.querySelector(".ppFooterOptionIcon, .startChat")) {
            profileElement.querySelector(".ppFooterOptionIcon, .startChat").classList.remove("disabled");
        }
    }).observe(profileElement, {childList: true});
    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        description: `<a href="https://kempanator.github.io/amq-mega-commands" target="_blank">https://kempanator.github.io/amq-mega-commands</a>`
    });
}

function parseChat(message) {
    if (isRankedMode()) return;
    if (message.message === S("0gpsdfbmm!wfstjpo", -1)) return sendChatMessage(S("$\"($", 12), message.teamMessage);
    if (message.sender !== selfName) return;
    if (message.message === "/commands on") commands = true;
    if (!commands) return;
    let content = message.message;
    let isTeamMessage = message.teamMessage;
    if (/^\/players$/.test(content)) {
        sendChatMessage(getPlayerList().map((player) => player.toLowerCase()).join(", "), isTeamMessage);
    }
    else if (/^\/spectators$/.test(content)) {
        sendChatMessage(getSpectatorList().map((player) => player.toLowerCase()).join(", "), isTeamMessage);
    }
    else if (/^\/teammates$/.test(content)) {
        sendChatMessage(getTeamList(getTeamNumber(selfName)).join(", "), isTeamMessage);
    }
    else if (/^\/roll$/.test(content)) {
        sendSystemMessage("roll commands: #, player, otherplayer, teammate, otherteammate, playerteam, spectator, relay");
    }
    else if (/^\/roll [0-9]+$/.test(content)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        sendChatMessage("rolls " + (Math.floor(Math.random() * number) + 1), isTeamMessage);
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(content)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendChatMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low), isTeamMessage);
    }
    else if (/^\/roll (p|players?)$/.test(content)) {
        let list = getPlayerList();
        sendChatMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no players", isTeamMessage);
    }
    else if (/^\/roll (op|otherplayers?)$/.test(content)) {
        let name = getRandomOtherPlayer();
        if (name) sendChatMessage(name, isTeamMessage);
    }
    else if (/^\/roll (t|teammates?)$/.test(content)) {
        let list = getTeamList(getTeamNumber(selfName));
        sendChatMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no teammates", isTeamMessage);
    }
    else if (/^\/roll (ot|otherteammates?)$/.test(content)) {
        let name = getRandomOtherTeammate();
        if (name) sendChatMessage(name, isTeamMessage);
    }
    else if (/^\/roll (pt|playerteams?|teams?|warlords?)$/.test(content)) {
        if (hostModal.getSettings().teamSize === 1) return sendChatMessage("team size must be greater than 1", isTeamMessage);
        let dict = getTeamDictionary();
        if (Object.keys(dict).length === 0) return;
        let teams = Object.keys(dict);
        teams.sort((a, b) => parseInt(a) - parseInt(b));
        for (let team of teams) {
            let name = dict[team][Math.floor(Math.random() * dict[team].length)];
            sendChatMessage(`Team ${team}: ${name}`, isTeamMessage);
        }
    }
    else if (/^\/roll (s|spectators?)$/.test(content)) {
        let list = getSpectatorList();
        sendChatMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators", isTeamMessage);
    }
    else if (/^\/roll relay$/.test(content)) {
        if (hostModal.getSettings().teamSize === 1) return sendChatMessage("team size must be greater than 1", isTeamMessage);
        let dict = getTeamDictionary();
        if (Object.keys(dict).length === 0) return;
        let teams = Object.keys(dict);
        teams.sort((a, b) => parseInt(a) - parseInt(b));
        teams.forEach((team) => sendChatMessage(`Team ${team}: ` + shuffleArray(dict[team]).join(" ➜ "), isTeamMessage));
    }
    else if (/^\/roll .+,.+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendChatMessage(list[Math.floor(Math.random() * list.length)], isTeamMessage);
    }
    else if (/^\/shuffle .+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendChatMessage(shuffleArray(list).join(", "), isTeamMessage);
    }
    else if (/^\/(calc|math) .+$/.test(content)) {
        sendChatMessage(calc(/^\S+ (.+)$/.exec(content)[1]), isTeamMessage);
    }
    else if (/^\/size [0-9]+$/.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.roomSize = option;
        changeGameSettings(settings);
    }
    else if (/^\/(t|types?|songtypes?) \w+$/.test(content)) {
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
    else if (/^\/(t|types?|songtypes?) \w+ [0-9]+$/.test(content)) {
        let option = /^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase();
        let value = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        if (option[0] === "o") settings.songType.advancedValue.openings = value;
        else if (option[0] === "e") settings.songType.advancedValue.endings = value;
        else if (option[0] === "i") settings.songType.advancedValue.inserts = value;
        else if (option[0] === "r") settings.songType.advancedValue.random = value;
        changeGameSettings(settings);
    }
    else if (/^\/watched$/.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 1;
        settings.songSelection.advancedValue.watched = 0;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.random = settings.numberOfSongs;
        changeGameSettings(settings);
    }
    else if (/^\/random$/.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 3;
        settings.songSelection.advancedValue.watched = settings.numberOfSongs;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.random = 0;
        changeGameSettings(settings);
    }
    else if (/^\/selection \w+ [0-9]+$/.test(content)) {
        let option = /^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase();
        let value = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        if (option[0] === "w") settings.songSelection.advancedValue.watched = value;
        else if (option[0] === "u") settings.songSelection.advancedValue.unwatched = value;
        else if (option[0] === "r") settings.songSelection.advancedValue.random = value;
        changeGameSettings(settings);
    }
    else if (/^\/(s|speed) [0-9.]+$/.test(content)) {
        let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.playbackSpeed.randomOn = false;
        settings.playbackSpeed.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/time [0-9]+$/.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.guessTime.randomOn = false;
        settings.guessTime.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/lives [0-9]+$/.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.scoreType = 3;
        settings.lives = option;
        changeGameSettings(settings);
    }
    else if (/^\/team [0-9]+$/.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.teamSize.randomOn = false;
        settings.teamSize.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/(n|songs) [0-9]+$/.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.numberOfSongs = option;
        changeGameSettings(settings);
    }
    else if (/^\/(d|dif|difficulty) [0-9]+[ -][0-9]+$/.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ -][0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ -]([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.songDifficulity.advancedOn = true;
        settings.songDifficulity.advancedValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/skip$/.test(content)) {
        quiz.skipClicked();
    }
    else if (/^\/pause$/.test(content)) {
        socket.sendCommand({ type: "quiz", command: "quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause") });
    }
    else if (/^\/(autoskip|autovoteskip)$/.test(content)) {
        if (autoVoteSkip === null) autoVoteSkip = 100;
        else autoVoteSkip = null;
        sendSystemMessage("auto vote skip " + (autoVoteSkip ? "enabled" : "disabled"));
    }
    else if (/^\/(autoskip|autovoteskip) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = seconds * 1000;
        sendSystemMessage(`auto vote skip after ${seconds} seconds`);     
    }
    else if (/^\/(ak|autokey|autosubmit)$/.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendSystemMessage("auto key " + (autoKey ? "enabled" : "disabled"));
    }
    else if (/^\/(at|autothrow)$/.test(content)) {
        autoThrow = "";
        sendSystemMessage("auto throw disabled " + autoCopy);
    }
    else if (/^\/(at|autothrow) .+$/.test(content)) {
        autoThrow = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendSystemMessage("auto throwing: " + autoThrow);
    }
    else if (/^\/(ac|autocopy)$/.test(content)) {
        autoCopy = "";
        sendSystemMessage("auto copy disabled");
    }
    else if (/^\/(ac|autocopy) \w+$/.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto copying " + autoCopy);
    }
    else if (/^\/(am|automute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = null;
        autoUnmute = null;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = seconds * 1000;
        autoUnmute = null;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoUnmute = null;
        autoMute = null;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoUnmute = seconds * 1000;
        autoMute = null;
        sendSystemMessage("auto unmuting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/autoready$/.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendSystemMessage("auto ready " + (autoReady ? "enabled" : "disabled"));
        checkAutoReady();
    }
    else if (/^\/autostart$/.test(content)) {
        autoStart = !autoStart;
        sendSystemMessage("auto start game " + (autoStart ? "enabled" : "disabled"));
        checkAutoStart();
    }
    else if (/^\/autohost$/.test(content)) {
        autoHost = "";
        sendSystemMessage("auto host disabled");
    }
    else if (/^\/autohost \S+$/.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto hosting " + autoHost);
        checkAutoHost();
    }
    else if (/^\/autoinvite$/.test(content)) {
        autoInvite = "";
        sendSystemMessage("auto invite disabled");
    }
    else if (/^\/autoinvite \w+$/.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto inviting " + autoInvite);
    }
    else if (/^\/autoaccept$/.test(content)) {
        autoAcceptInvite = !autoAcceptInvite;
        saveSettings();
        sendSystemMessage("auto accept invite " + (autoAcceptInvite ? "enabled" : "disabled"));
    }
    else if (/^\/autoaccept .+$/.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter((x) => !!x);
        saveSettings();
        sendSystemMessage("auto accept invite only from " + autoAcceptInvite.join(", "));
    }
    else if (/^\/autojoin$/.test(content)) {
        if (autoJoinRoom || isSoloMode() || isRankedMode()) {
            autoJoinRoom = false;
            saveSettings();
            sendSystemMessage("auto join room disabled");
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            autoJoinRoom = {id: lobby.gameId, password: password};
            saveSettings();
            sendSystemMessage(`auto joining room ${lobby.gameId} ${password}`);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    autoJoinRoom = {id: payload.gameId, password: password};
                    saveSettings();
                    sendSystemMessage(`auto joining room ${payload.gameId} ${password}`);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            autoJoinRoom = false;
            saveSettings();
            sendSystemMessage("auto join room disabled");
        }
    }
    else if (/^\/autojoin [0-9]+/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        autoJoinRoom = {id: id, password: password ? password : ""};
        saveSettings();
        sendSystemMessage(`auto joining room ${id} ${password}`);
    }
    else if (/^\/autoswitch$/.test(content)) {
        autoSwitch = "";
        sendSystemMessage("auto switch disabled");
    }
    else if (/^\/autoswitch (p|s)/.test(content)) {
        let option = /^\S+ (p|s)/.exec(content)[1];
        if (option === "p") autoSwitch = "player";
        else if (option === "s") autoSwitch = "spectator";
        sendSystemMessage("auto switching to " + autoSwitch);
        checkAutoSwitch();
    }
    else if (/^\/autolobby$/.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendSystemMessage("auto vote lobby " + (autoVoteLobby ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        autoStatus = "";
        saveSettings();
        sendSystemMessage("auto status removed");
    }
    else if (/^\/autostatus .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option === "away" || option === "do not disturb" || option === "invisible") {
            autoStatus = option;
            saveSettings();
            sendSystemMessage("auto status set to " + autoStatus);
        }
        else {
            sendSystemMessage("Options: away, do not disturb, invisible");
        }
    }
    else if (/^\/(cd|countdown)$/.test(content)) {
        if (countdown === null) {
            sendSystemMessage("Command: /countdown #");
        }
        else {
            countdown = null;
            clearInterval(countdownInterval);
            sendSystemMessage("countdown stopped");
        }
    }
    else if (/^\/(cd|countdown) [0-9]+$/.test(content)) {
        if (!lobby.inLobby || !lobby.isHost) return sendSystemMessage("countdown failed: not host");
        countdown = parseInt(/^\S+ (.+)$/.exec(content)[1]);
        sendChatMessage(`Game starting in ${countdown} seconds`, isTeamMessage);
        countdownInterval = setInterval(() => {
            if (countdown < 1) {
                if (!lobby.inLobby) null;
                else if (!lobby.isHost) sendChatMessage("failed to start: not host", isTeamMessage);
                else if (!allPlayersReady()) sendChatMessage("failed to start: not all players ready", isTeamMessage);
                else lobby.fireMainButtonEvent();
                countdown = null;
                clearInterval(countdownInterval);
            }
            else {
                if (countdown % 10 === 0 || countdown <= 5) {
                    sendChatMessage(countdown, isTeamMessage);
                }
                countdown--;
            }
        }, 1000);
    }
    else if (/^\/ready$/.test(content)) {
        if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
            lobby.fireMainButtonEvent();
        }
    }
    else if (/^\/(inv|invite) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socket.sendCommand({ type: "social", command: "invite to game", data: { target: name } });
    }
    else if (/^\/(spec|spectate)$/.test(content)) {
        lobby.changeToSpectator(selfName);
    }
    else if (/^\/(spec|spectate) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        lobby.changeToSpectator(name);
    }
    else if (/^\/join$/.test(content)) {
        socket.sendCommand({ type: "lobby", command: "change to player" });
    }
    else if (/^\/queue$/.test(content)) {
        gameChat.joinLeaveQueue();
    }
    else if (/^\/host \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        lobby.promoteHost(name);
    }
    else if (/^\/kick \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socket.sendCommand({ type: "lobby", command: "kick player", data: { playerName: name } });
    }
    else if (/^\/(lb|lobby|returntolobby)$/.test(content)) {
        quiz.startReturnLobbyVote();
    }
    else if (/^\/(v|volume) [0-9]+$/.test(content)) {
        let option = parseFloat(/^\S+ ([0-9]+)$/.exec(content)[1]) / 100;
        volumeController.volume = option;
        volumeController.setMuted(false);
        volumeController.adjustVolume();
    }
    else if (/^\/clear$/.test(content)) {
        setTimeout(() => { document.querySelectorAll("#gcMessageContainer li").forEach((e) => e.remove()) }, 1);
    }
    else if (/^\/(dd|dropdown)$/.test(content)) {
        dropdown = !dropdown;
        sendSystemMessage("dropdown " + (dropdown ? "enabled" : "disabled"));
        quiz.answerInput.autoCompleteController.newList();
    }
    else if (/^\/(dds|dropdownspec|dropdownspectate)$/.test(content)) {
        dropdownInSpec = !dropdownInSpec;
        if (dropdownInSpec) $("#qpAnswerInput").removeAttr("disabled");
        sendSystemMessage("dropdown while spectating " + (dropdownInSpec ? "enabled" : "disabled"));
        saveSettings();
    }
    else if (/^\/password$/.test(content)) {
        let password = hostModal.getSettings().password;
        if (password) sendChatMessage(password, isTeamMessage);
    }
    else if (/^\/invisible$/.test(content)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = Object.keys(socialTab.offlineFriends).filter((name) => onlineUsers.includes(name));
            sendChatMessage(list.length > 0 ? list.join(", ") : "no invisible friends detected", isTeamMessage);
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({ type: "social", command: "get online users" });
    }
    else if (/^\/(roomid|lobbyid)$/.test(content)) {
        if (lobby.inLobby) {
            sendChatMessage(lobby.gameId, isTeamMessage);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    sendChatMessage(payload.gameId, isTeamMessage);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
    }
    else if (/^\/(dm|pm)$/.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(dm|pm) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(dm|pm) \w+ .+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
    }
    else if (/^\/(prof|profile) \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/(rules|gamemodes?)$/.test(content)) {
        sendChatMessage(Object.keys(rules).join(", "), isTeamMessage);
    }
    else if (/^\/(rules|gamemodes?) .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in rules) sendChatMessage(rules[option], isTeamMessage);
    }
    else if (/^\/scripts?$/.test(content)) {
        sendChatMessage(Object.keys(scripts).join(", "), isTeamMessage);
    }
    else if (/^\/scripts? .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in scripts) sendChatMessage(scripts[option], isTeamMessage);
    }
    else if (/^\/info$/.test(content)) {
        sendChatMessage(Object.keys(info).join(", "), isTeamMessage);
    }
    else if (/^\/info .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in info) sendChatMessage(info[option], isTeamMessage);
    }
    else if (/^\/rejoin$/.test(content)) {
        rejoinRoom(100);
    }
    else if (/^\/rejoin ([0-9]+)$/.test(content)) {
        let time = parseInt((/^\S+ ([0-9]+)$/).exec(content)[1]) * 1000;
        rejoinRoom(time);
    }
    else if (/^\/leave$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
    }
    else if (/^\/(logout|logoff)$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
        setTimeout(() => { options.logout() }, 10);
    }
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/.test(content)) {
        relog();
    }
    else if (/^\/commands$/.test(content)) {
        sendSystemMessage("/commands on off help link version clear auto");
    }
    else if (/^\/commands \w+$/.test(content)) {
        let option = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        if (option === "on") {
            commands = true;
            sendSystemMessage("Mega Commands enabled");
        }
        else if (option === "off") {
            commands = false;
            sendSystemMessage("Mega Commands disabled");
        }
        else if (option === "help") {
            sendChatMessage("https://kempanator.github.io/amq-mega-commands", isTeamMessage);
        }
        else if (option === "link") {
            sendChatMessage("https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js", isTeamMessage);
        }
        else if (option === "version") {
            sendChatMessage(version, isTeamMessage);
        }
        else if (option === "clear") {
            localStorage.removeItem("megaCommands");
            sendSystemMessage("mega commands local storage cleared");
        }
        else if (option === "auto") {
            autoList().forEach((item) => sendSystemMessage(item));
        }
    }
    else if (/^\/version$/.test(content)) {
        sendChatMessage("Mega Commands version " + version, isTeamMessage);
    }
    else if (/^\/alien$/.test(content)) {
        sendSystemMessage("command: /alien pick #");
    }
    else if (/^\/alien pick [0-9]+$/.test(content)) {
        let n = parseInt(/^\S+ pick ([0-9]+)$/.exec(content)[1]);
        if (!inRoom() || n < 1) return;
        if (Object.keys(lobby.players).length < n) return sendChatMessage("not enough people");
        let aliens = shuffleArray(getPlayerList()).slice(0, n);
        for (let i = 0; i < aliens.length; i++) {
            setTimeout(() => {
                socket.sendCommand({
                    type: "social",
                    command: "chat message",
                    data: { target: aliens[i], message: "Aliens: " + aliens.join(", ") + " (turn on your list and disable share entries)" }
                });
            }, 500 * i);
        }
        setTimeout(() => { sendChatMessage(n + " alien" + (n === 1 ? "" : "s") + " chosen") }, 500 * n);
    }
    else if (/^\/(bg|background|wallpaper)$/.test(content)) {
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
    else if (/^\/(bg|background|wallpaper) (link|url)$/.test(content)) {
        if (backgroundURL) sendChatMessage(backgroundURL, isTeamMessage);
    }
    else if (/^\/(bg|background|wallpaper) http.+\.(jpg|jpeg|png|gif|tiff|bmp|webp)$/.test(content)) {
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
    else if (/^\/detect$/.test(content)) {
        sendSystemMessage("invisible: " + playerDetection.invisible);
        sendSystemMessage("players: " + playerDetection.players.join(", "));
    }
    else if (/^\/detect disable$/.test(content)) {
        playerDetection = {invisible: false, players: []};
        saveSettings();
        sendSystemMessage("detection system disabled");
    }
    else if (/^\/detect invisible$/.test(content)) {
        playerDetection.invisible = true;
        saveSettings();
        sendSystemMessage("now detecting invisible friends in the room browser");
    }
    else if (/^\/detect \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1];
        if (playerDetection.players.includes(name)) {
            playerDetection.players = playerDetection.players.filter((item) => item !== name);
            sendSystemMessage(`${name} removed from detection system`);
        }
        else {
            playerDetection.players.push(name);
            sendSystemMessage(`now detecting ${name} in the room browser`);
        }
        saveSettings();
    }
    else if (/^\/printloot$/.test(content)) {
        printLoot = !printLoot;
        saveSettings();
        sendSystemMessage("print loot " + (printLoot ? "enabled" : "disabled"));
    }
}

function parseNexusChat(message) {
    if (message.sender !== selfName) return;
    if (message.message === "/commands on") commands = true;
    if (!commands) return;
    let content = message.message;
    if (/^\/players$/.test(content)) {
        sendNexusChatMessage(getPlayerList().map((player) => player.toLowerCase()).join(", "));
    }
    else if (/^\/roll [0-9]+$/.test(content)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        sendNexusChatMessage("rolls " + (Math.floor(Math.random() * number) + 1));
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(content)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendNexusChatMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low));
    }
    else if (/^\/roll (p|players?)$/.test(content)) {
        let list = getPlayerList();
        sendNexusChatMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no players");
    }
    else if (/^\/roll (op|otherplayers?)$/.test(content)) {
        let name = getRandomOtherPlayer();
        if (name) sendNexusChatMessage(name);
    }
    else if (/^\/roll .+,.+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendNexusChatMessage(list[Math.floor(Math.random() * list.length)]);
    }
    else if (/^\/shuffle .+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendNexusChatMessage(shuffleArray(list).join(", "));
    }
    else if (/^\/(calc|math) .+$/.test(content)) {
        sendNexusChatMessage(calc(/^\S+ (.+)$/.exec(content)[1]));
    }
    else if (/^\/(autoskip|autovoteskip)$/.test(content)) {
        if (autoVoteSkip === null) autoVoteSkip = 100;
        else autoVoteSkip = null;
        sendNexusSystemMessage("auto vote skip " + (autoVoteSkip ? "enabled" : "disabled"));
    }
    else if (/^\/(autoskip|autovoteskip) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = seconds * 1000;
        sendNexusSystemMessage(`auto vote skip after ${seconds} seconds`);     
    }
    else if (/^\/(ak|autokey|autosubmit)$/.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendNexusSystemMessage("auto key " + (autoKey ? "enabled" : "disabled"));
    }
    else if (/^\/(at|autothrow)$/.test(content)) {
        autoThrow = "";
        sendNexusSystemMessage("auto throw disabled " + autoCopy);
    }
    else if (/^\/(at|autothrow) .+$/.test(content)) {
        autoThrow = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendNexusSystemMessage("auto throwing: " + autoThrow);
    }
    else if (/^\/(ac|autocopy)$/.test(content)) {
        autoCopy = "";
        sendNexusSystemMessage("auto copy disabled");
    }
    else if (/^\/(ac|autocopy) \w+$/.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendNexusSystemMessage("auto copying " + autoCopy);
    }
    else if (/^\/(am|automute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = null;
        autoUnmute = null;
        sendNexusSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = seconds * 1000;
        autoUnmute = null;
        sendNexusSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoUnmute = null;
        autoMute = null;
        sendNexusSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoUnmute = seconds * 1000;
        autoMute = null;
        sendNexusSystemMessage("auto unmuting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/autoready$/.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendNexusSystemMessage("auto ready " + (autoReady ? "enabled" : "disabled"));
        checkAutoReady();
    }
    else if (/^\/autostart$/.test(content)) {
        autoStart = !autoStart;
        sendNexusSystemMessage("auto start game " + (autoStart ? "enabled" : "disabled"));
        checkAutoStart();
    }
    else if (/^\/autohost$/.test(content)) {
        autoHost = "";
        sendNexusSystemMessage("auto host disabled");
    }
    else if (/^\/autohost \S+$/.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendNexusSystemMessage("auto hosting " + autoHost);
        checkAutoHost();
    }
    else if (/^\/autoinvite$/.test(content)) {
        autoInvite = "";
        sendNexusSystemMessage("auto invite disabled");
    }
    else if (/^\/autoinvite \w+$/.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendNexusSystemMessage("auto inviting " + autoInvite);
    }
    else if (/^\/autoaccept$/.test(content)) {
        autoAcceptInvite = !autoAcceptInvite;
        saveSettings();
        sendNexusSystemMessage("auto accept invite " + (autoAcceptInvite ? "enabled" : "disabled"));
    }
    else if (/^\/autoaccept .+$/.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter((x) => !!x);
        saveSettings();
        sendNexusSystemMessage("auto accept invite only from " + autoAcceptInvite.join(", "));
    }
    else if (/^\/autojoin$/.test(content)) {
        if (autoJoinRoom || isSoloMode() || isRankedMode()) {
            autoJoinRoom = false;
            saveSettings();
            sendNexusSystemMessage("auto join room disabled");
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            autoJoinRoom = {id: lobby.gameId, password: password};
            saveSettings();
            sendNexusSystemMessage(`auto joining room ${lobby.gameId} ${password}`);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    autoJoinRoom = {id: payload.gameId, password: password};
                    saveSettings();
                    sendNexusSystemMessage(`auto joining room ${payload.gameId} ${password}`);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            autoJoinRoom = false;
            saveSettings();
            sendNexusSystemMessage("auto join room disabled");
        }
    }
    else if (/^\/autojoin [0-9]+/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        autoJoinRoom = {id: id, password: password ? password : ""};
        saveSettings();
        sendNexusSystemMessage(`auto joining room ${id} ${password}`);
    }
    else if (/^\/autoswitch$/.test(content)) {
        autoSwitch = "";
        sendNexusSystemMessage("auto switch disabled");
    }
    else if (/^\/autoswitch (p|s)/.test(content)) {
        let option = /^\S+ (p|s)/.exec(content)[1];
        if (option === "p") autoSwitch = "player";
        else if (option === "s") autoSwitch = "spectator";
        sendNexusSystemMessage("auto switching to " + autoSwitch);
        checkAutoSwitch();
    }
    else if (/^\/autolobby$/.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendNexusSystemMessage("auto vote lobby " + (autoVoteLobby ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        autoStatus = "";
        saveSettings();
        sendNexusSystemMessage("auto status removed");
    }
    else if (/^\/autostatus .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option === "away" || option === "do not disturb" || option === "invisible") {
            autoStatus = option;
            saveSettings();
            sendNexusSystemMessage("auto status set to " + autoStatus);
        }
        else {
            sendNexusSystemMessage("Options: away, do not disturb, invisible");
        }
    }
    else if (/^\/(inv|invite) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socket.sendCommand({ type: "social", command: "invite to game", data: { target: name } });
    }
    else if (/^\/(dm|pm)$/.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(dm|pm) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(dm|pm) \w+ .+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
    }
    else if (/^\/(prof|profile) \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/invisible$/.test(content)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = Object.keys(socialTab.offlineFriends).filter((name) => onlineUsers.includes(name));
            sendNexusChatMessage(list.length > 0 ? list.join(", ") : "no invisible friends detected");
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({ type: "social", command: "get online users" });
    }
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/.test(content)) {
        relog();        
    }
    else if (/^\/commands$/.test(content)) {
        sendNexusSystemMessage("/commands on off help link version clear auto");
    }
    else if (/^\/commands \w+$/.test(content)) {
        let option = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        if (option === "on") {
            commands = true;
            sendNexusSystemMessage("Mega Commands enabled");
        }
        else if (option === "off") {
            commands = false;
            sendNexusSystemMessage("Mega Commands disabled");
        }
        else if (option === "help") {
            sendNexusChatMessage("https://kempanator.github.io/amq-mega-commands");
        }
        else if (option === "link") {
            sendNexusChatMessage("https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js");
        }
        else if (option === "version") {
            sendNexusChatMessage(version);
        }
        else if (option === "clear") {
            localStorage.removeItem("megaCommands");
            sendNexusSystemMessage("mega commands local storage cleared");
        }
        else if (option === "auto") {
            autoList().forEach((item) => sendNexusSystemMessage(item));
        }
    }
    else if (/^\/version$/.test(content)) {
        sendNexusChatMessage("Mega Commands version " + version);
    }
}

function parseDM(message) {
    if (!message.msg.startsWith("/")) return;
    if (message.msg === "/commands on") commands = true;
    if (!commands) return;
    let content = message.msg;
    if (/^\/roll [0-9]+$/.test(content)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        sendDM(message.target, "rolls " + (Math.floor(Math.random() * number) + 1));
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(content)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendDM(message.target, "rolls " + (Math.floor(Math.random() * (high - low + 1)) + low));
    }
    else if (/^\/roll .+,.+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendDM(message.target, list[Math.floor(Math.random() * list.length)]);
    }
    else if (/^\/shuffle .+$/.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter((x) => !!x);
        if (list.length > 1) sendDM(message.target, shuffleArray(list).join(", "));
    }
    else if (/^\/(calc|math) .+$/.test(content)) {
        sendDM(message.target, calc(/^\S+ (.+)$/.exec(content)[1]));
    }
    else if (/^\/(autoskip|autovoteskip)$/.test(content)) {
        if (autoVoteSkip === null) autoVoteSkip = 100;
        else autoVoteSkip = null;
        sendSystemMessage("auto vote skip " + (autoVoteSkip ? "enabled" : "disabled"));
    }
    else if (/^\/(autoskip|autovoteskip) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = seconds * 1000;
        sendSystemMessage(`auto vote skip after ${seconds} seconds`);     
    }
    else if (/^\/(ak|autokey|autosubmit)$/.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendSystemMessage("auto key " + (autoKey ? "enabled" : "disabled"));
    }
    else if (/^\/(at|autothrow)$/.test(content)) {
        autoThrow = "";
        sendSystemMessage("auto throw disabled " + autoCopy);
    }
    else if (/^\/(at|autothrow) .+$/.test(content)) {
        autoThrow = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendSystemMessage("auto throwing: " + autoThrow);
    }
    else if (/^\/(ac|autocopy)$/.test(content)) {
        autoCopy = "";
        sendSystemMessage("auto copy disabled");
    }
    else if (/^\/(ac|autocopy) \w+$/.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto copying " + autoCopy);
    }
    else if (/^\/(am|automute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = null;
        autoUnmute = null;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = seconds * 1000;
        autoUnmute = null;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoUnmute = null;
        autoMute = null;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoUnmute = seconds * 1000;
        autoMute = null;
        sendSystemMessage("auto unmuting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/autoready$/.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendSystemMessage("auto ready " + (autoReady ? "enabled" : "disabled"));
        checkAutoReady();
    }
    else if (/^\/autostart$/.test(content)) {
        autoStart = !autoStart;
        sendSystemMessage("auto start game " + (autoStart ? "enabled" : "disabled"));
        checkAutoStart();
    }
    else if (/^\/autohost$/.test(content)) {
        autoHost = "";
        sendSystemMessage("auto host disabled");
    }
    else if (/^\/autohost \S+$/.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto hosting " + autoHost);
        checkAutoHost();
    }
    else if (/^\/autoinvite$/.test(content)) {
        autoInvite = "";
        sendSystemMessage("auto invite disabled");
    }
    else if (/^\/autoinvite \w+$/.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto inviting " + autoInvite);
    }
    else if (/^\/autoaccept$/.test(content)) {
        autoAcceptInvite = !autoAcceptInvite;
        saveSettings();
        sendSystemMessage("auto accept invite " + (autoAcceptInvite ? "enabled" : "disabled"));
    }
    else if (/^\/autoaccept .+$/.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter((x) => !!x);
        saveSettings();
        sendSystemMessage("auto accept invite only from " + autoAcceptInvite.join(", "));
    }
    else if (/^\/autojoin$/.test(content)) {
        if (autoJoinRoom || isSoloMode() || isRankedMode()) {
            autoJoinRoom = false;
            saveSettings();
            sendSystemMessage("auto join room disabled");
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            autoJoinRoom = {id: lobby.gameId, password: password};
            saveSettings();
            sendSystemMessage(`auto joining room ${lobby.gameId} ${password}`);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    autoJoinRoom = {id: payload.gameId, password: password};
                    saveSettings();
                    sendSystemMessage(`auto joining room ${payload.gameId} ${password}`);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            autoJoinRoom = false;
            saveSettings();
            sendSystemMessage("auto join room disabled");
        }
    }
    else if (/^\/autojoin [0-9]+/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        autoJoinRoom = {id: id, password: password ? password : ""};
        saveSettings();
        sendSystemMessage(`auto joining room ${id} ${password}`);
    }
    else if (/^\/autoswitch$/.test(content)) {
        autoSwitch = "";
        sendSystemMessage("auto switch disabled");
    }
    else if (/^\/autoswitch (p|s)/.test(content)) {
        let option = /^\S+ (p|s)/.exec(content)[1];
        if (option === "p") autoSwitch = "player";
        else if (option === "s") autoSwitch = "spectator";
        sendSystemMessage("auto switching to " + autoSwitch);
        checkAutoSwitch();
    }
    else if (/^\/autolobby$/.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendSystemMessage("auto vote lobby " + (autoVoteLobby ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        autoStatus = "";
        saveSettings();
        sendSystemMessage("auto status removed");
    }
    else if (/^\/autostatus .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option === "away" || option === "do not disturb" || option === "invisible") {
            autoStatus = option;
            saveSettings();
            sendSystemMessage("auto status set to " + autoStatus);
        }
        else {
            sendSystemMessage("Options: away, do not disturb, invisible");
        }
    }
    else if (/^\/(dm|pm)$/.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(dm|pm) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(dm|pm) \w+ .+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
    }
    else if (/^\/(prof|profile) \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/invisible$/.test(content)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = Object.keys(socialTab.offlineFriends).filter((name) => onlineUsers.includes(name));
            sendDM(message.target, list.length > 0 ? list.join(", ") : "no invisible friends detected");
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({ type: "social", command: "get online users" });
    }
    else if (/^\/(roomid|lobbyid)$/.test(content)) {
        if (lobby.inLobby) {
            sendDM(message.target, lobby.gameId);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    sendDM(message.target, payload.gameId);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
    }
    else if (/^\/(rules|gamemodes?)$/.test(content)) {
        sendDM(message.target, Object.keys(rules).join(", "));
    }
    else if (/^\/(rules|gamemodes?) .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in rules) sendDM(message.target, rules[option]);
    }
    else if (/^\/scripts?$/.test(content)) {
        sendDM(message.target, Object.keys(scripts).join(", "));
    }
    else if (/^\/scripts? .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in scripts) sendDM(message.target, scripts[option]);
    }
    else if (/^\/info$/.test(content)) {
        sendDM(message.target, Object.keys(info).join(", "));
    }
    else if (/^\/info .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in info) sendDM(message.target, info[option]);
    }
    else if (/^\/join [0-9]+$/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        roomBrowser.fireSpectateGame(id);
    }
    else if (/^\/join [0-9]+ .+$/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+) .+$/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        roomBrowser.fireSpectateGame(id, password);
    }
    else if (/^\/leave$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
    }
    else if (/^\/(logout|logoff)$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
        setTimeout(() => { options.logout() }, 10);
    }
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/.test(content)) {
        relog();
    }
    else if (/^\/commands$/.test(content)) {
        sendDM(message.target, "/commands on off help link version clear auto");
    }
    else if (/^\/commands \w+$/.test(content)) {
        let option = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        if (option === "on") {
            commands = true;
            sendDM(message.target, "Mega Commands enabled");
        }
        else if (option === "off") {
            commands = false;
            sendDM(message.target, "Mega Commands disabled");
        }
        else if (option === "help") {
            sendDM(message.target, "https://kempanator.github.io/amq-mega-commands");
        }
        else if (option === "link") {
            sendDM(message.target, "https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.user.js");
        }
        else if (option === "version") {
            sendDM(message.target, version);
        }
        else if (option === "clear") {
            localStorage.removeItem("megaCommands");
            sendDM(message.target, "mega commands local storage cleared");
        }
        else if (option === "auto") {
            autoList().forEach((item) => sendSystemMessage(item));
        }
    }
    else if (/^\/version$/.test(content)) {
        sendDM(message.target, "Mega Commands version " + version);
    }
    else if (/^\/(bg|background|wallpaper)$/.test(content)) {
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
    else if (/^\/(bg|background|wallpaper) (link|url)$/.test(content)) {
        if (backgroundURL) sendDM(message.target, backgroundURL);
    }
    else if (/^\/(bg|background|wallpaper) http.+\.(jpg|jpeg|png|gif|tiff|bmp|webp)$/.test(content)) {
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
    else if (/^\/detect$/.test(content)) {
        sendDM(message.target, `invisible: ${playerDetection.invisible}, players: ${playerDetection.players.join(", ")}`);
    }
    else if (/^\/detect disable$/.test(content)) {
        playerDetection = {invisible: false, players: []};
        saveSettings();
        sendDM(message.target, "detection system disabled");
    }
    else if (/^\/detect invisible$/.test(content)) {
        playerDetection.invisible = true;
        saveSettings();
        sendDM(message.target, "now detecting invisible friends in the room browser");
    }
    else if (/^\/detect \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1];
        if (playerDetection.players.includes(name)) {
            playerDetection.players = playerDetection.players.filter((item) => item !== name);
            sendDM(message.target, `${name} removed from detection system`);
        }
        else {
            playerDetection.players.push(name);
            sendDM(message.target, `now detecting ${name} in the room browser`);
        }
        saveSettings();
    }
    else if (/^\/printloot$/.test(content)) {
        printLoot = !printLoot;
        saveSettings();
        sendDM(message.target, "print loot " + (printLoot ? "enabled" : "disabled"));
    }
    if (inRoom()) {
        if (/^\/players$/.test(content)) {
            sendDM(message.target, getPlayerList().map((player) => player.toLowerCase()).join(", "));
        }
        else if (/^\/spectators$/.test(content)) {
            sendDM(message.target, getSpectatorList().map((player) => player.toLowerCase()).join(", "));
        }
        else if (/^\/teammates$/.test(content)) {
            sendDM(message.target, getTeamList(getTeamNumber(selfName)).join(", "));
        }
        else if (/^\/roll (p|players?)$/.test(content)) {
            let list = getPlayerList();
            sendDM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no players");
        }
        else if (/^\/roll (op|otherplayers?)$/.test(content)) {
            let name = getRandomOtherPlayer();
            if (name) sendDM(message.target, name);
        }
        else if (/^\/roll (t|teammates?)$/.test(content)) {
            let list = getTeamList(getTeamNumber(selfName));
            sendDM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no teammates");
        }
        else if (/^\/roll (ot|otherteammates?)$/.test(content)) {
            let name = getRandomOtherTeammate();
            if (name) sendDM(message.target, name);
        }
        else if (/^\/roll (pt|playerteams?|teams?|warlords?)$/.test(content)) {
            if (hostModal.getSettings().teamSize === 1) return sendDM(message.target, "team size must be greater than 1");
            let dict = getTeamDictionary();
            if (Object.keys(dict).length === 0) return;
            let teams = Object.keys(dict);
            teams.sort((a, b) => parseInt(a) - parseInt(b));
            teams.forEach((team, i) => {
                let name = dict[team][Math.floor(Math.random() * dict[team].length)];
                setTimeout(() => { sendDM(message.target, `Team ${team}: ${name}`) }, (i + 1) * 300);
            });
        }
        else if (/^\/roll (s|spectators?)$/.test(content)) {
            let list = getSpectatorList();
            sendDM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators");
        }
        else if (/^\/roll relay$/.test(content)) {
            if (hostModal.getSettings().teamSize === 1) return sendDM(message.target, "team size must be greater than 1");
            let dict = getTeamDictionary();
            if (Object.keys(dict).length === 0) return;
            let teams = Object.keys(dict);
            teams.sort((a, b) => parseInt(a) - parseInt(b));
            teams.forEach((team, i) => {
                setTimeout(() => { sendDM(message.target, `Team ${team}: ` + shuffleArray(dict[team]).join(" ➜ ")) }, (i + 1) * 300);
            });
        }
        else if (/^\/ready$/.test(content)) {
            if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
        }
        else if (/^\/(inv|invite)$/.test(content)) {
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: message.target } });
        }
        else if (/^\/(inv|invite) \w+$/.test(content)) {
            let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: name } });
        }
        else if (/^\/(spec|spectate)$/.test(content)) {
            lobby.changeToSpectator(selfName);
        }
        else if (/^\/(spec|spectate) \w+$/.test(content)) {
            let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
            lobby.changeToSpectator(name);
        }
        else if (/^\/join$/.test(content)) {
            socket.sendCommand({ type: "lobby", command: "change to player" });
        }
        else if (/^\/queue$/.test(content)) {
            gameChat.joinLeaveQueue();
        }
        else if (/^\/host \w+$/.test(content)) {
            let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
            lobby.promoteHost(name);
        }
        else if (/^\/kick \w+$/.test(content)) {
            let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
            socket.sendCommand({ type: "lobby", command: "kick player", data: { playerName: name } });
        }
        else if (/^\/(lb|lobby|returntolobby)$/.test(content)) {
            socket.sendCommand({ type: "quiz", command: "start return lobby vote" });
        }
        else if (/^\/rejoin$/.test(content)) {
            rejoinRoom(100);
        }
        else if (/^\/rejoin ([0-9]+)$/.test(content)) {
            let time = parseInt((/^\S+ ([0-9]+)$/).exec(content)[1]) * 1000;
            rejoinRoom(time);
        }
        else if (/^\/(dd|dropdown)$/.test(content)) {
            dropdown = !dropdown;
            sendDM(message.target, "dropdown " + (dropdown ? "enabled" : "disabled"));
            quiz.answerInput.autoCompleteController.newList();
        }
        else if (/^\/(dds|dropdownspec|dropdownspectate)$/.test(content)) {
            dropdownInSpec = !dropdownInSpec;
            if (dropdownInSpec) $("#qpAnswerInput").removeAttr("disabled");
            sendSystemMessage("dropdown while spectating " + (dropdownInSpec ? "enabled" : "disabled"));
            saveSettings();
        }
        else if (/^\/password$/.test(content)) {
            let password = hostModal.getSettings().password;
            if (password) sendDM(message.target, password);
        }
    }
}

function parseIncomingDM(message) {
    if (commands && message.message.startsWith("/")) {
        let content = message.message;
        if (isFriend(message.sender)) {
            if (/^\/forceversion$/.test(content)) {
                sendDM(message.sender, version);
            }
            else if (/^\/forceready$/.test(content) && lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
            else if (/^\/forceinvite$/.test(content) && inRoom()) {
                socket.sendCommand({ type: "social", command: "invite to game", data: { target: message.sender } });
            }
            else if (/^\/forcepassword$/.test(content) && inRoom()) {
                sendDM(message.sender, hostModal.getSettings().password);
            }
            else if (/^\/forcehost$/.test(content) && lobby.inLobby && lobby.isHost) {
                lobby.promoteHost(message.sender);
            }
            else if (/^\/forcehost \w+$/.test(content) && lobby.inLobby && lobby.isHost) {
                lobby.promoteHost(getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]));
            }
            else if (/^\/forceautolist$/.test(content)) {
                autoList().forEach((text, i) => setTimeout(() => { sendDM(message.sender, text) }, i * 200));
            }
        }
        if (/^\/whereis \w+$/.test(content)) {
            if (Object.keys(roomBrowser.activeRooms).length === 0) return;
            let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
            let foundRoom;
            for (let roomId of Object.keys(roomBrowser.activeRooms)) {
                for (let player of roomBrowser.activeRooms[roomId]._players) {
                    if (name === player.toLowerCase()) {
                        foundRoom = roomId;
                    }
                }
            }
            sendDM(message.sender, (Number.isInteger(foundRoom) ? `in room ${foundRoom}` : "not found"));
        }
        else if (/^\/room [0-9]+$/.test(content)) {
            if (Object.keys(roomBrowser.activeRooms).length === 0) return;
            let roomId = /^\S+ ([0-9]+)$/.exec(content)[1];
            if (roomId in roomBrowser.activeRooms) {
                let room = roomBrowser.activeRooms[roomId];
                setTimeout(() => sendDM(message.sender, `${room._private ? "private" : "public"} room: ${room.roomName}`), 100);
                setTimeout(() => sendDM(message.sender, `host: ${room.host}, players: ${room._numberOfPlayers}, spectators: ${room._numberOfSpectators}`), 200);
            }
            else {
                sendDM(message.sender, "not found");
            }
        }
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

// return object with team number as keys and list of player names as each value
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
        data: { msg: String(message), teamMessage: Boolean(isTeamMessage) }
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
        data: { message: String(message) }
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
            data: { target: target, message: String(message) }
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
        if (autoSwitch === "player" && lobby.isSpectator) socket.sendCommand({ type: "lobby", command: "change to player" });
        else if (autoSwitch === "spectator" && !lobby.isSpectator) lobby.changeToSpectator(selfName);
    }
}

// check conditions and promote host
function checkAutoHost() {
    if (autoHost && lobby.inLobby && lobby.isHost) {
        if (autoHost === "{random}") {
            lobby.promoteHost(getRandomOtherPlayer());
        }
        else if (isInYourRoom(autoHost)) {
            lobby.promoteHost(getPlayerNameCorrectCase(autoHost));
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
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
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
    if (autoMute !== null) list.push("Auto Mute: " + (autoMute / 1000) + "s");
    if (autoUnmute !== null) list.push("Auto Unmute: " + (autoUnmute / 1000) + "s");
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

// log out, log in, auto join the room you were in
function relog() {
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
        socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
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

// overload changeView function for auto ready
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

// overload newList function for drop down disable
const oldNewList = AutoCompleteController.prototype.newList;
AutoCompleteController.prototype.newList = function() {
    if (this.list.length > 0) animeList = this.list;
    this.list = dropdown ? animeList : [];
    oldNewList.apply(this, arguments);
}

// save settings
function saveSettings() {
    let settings = {}
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
    settings.playerDetection = playerDetection;
    settings.printLoot = printLoot;
    localStorage.setItem("megaCommands", JSON.stringify(settings));
}
