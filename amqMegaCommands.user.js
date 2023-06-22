// ==UserScript==
// @name         AMQ Mega Commands
// @namespace    https://github.com/kempanator
// @version      0.88
// @description  Commands for AMQ Chat
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      myanimelist.net
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
/random               change selection type to random
/unwatched            change selection type to unwatched
/watched              change selection type to watched
/time [1-60]          change song guess time
/extratime [0-15]     change song guess extra time
/sample [low] [high]  change start sample point
/lives [1-5]          change number of lives
/team [1-8]           change team size
/songs [5-100]        change number of songs
/dif [low] [high]     change difficulty
/vintage [text]       change vintage
/genre [text]         change genre
/tag [text]           change tags

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
/mutereplay           auto mute during the replay phase
/mutesubmit           auto mute after answer submit

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
/printonline          print friend names in chat when they log in
/printoffline         print friend names in chat when they log out
/version              check the version of this script
/commands [on|off]    turn this script on or off
*/

"use strict";
const version = "0.88";
const saveData = JSON.parse(localStorage.getItem("megaCommands")) || {};
let alertHidden = saveData.alertHidden ?? true;
let animeList;
let autoAcceptInvite = saveData.autoAcceptInvite ?? false;
let autoCopy = saveData.autoCopy ?? "";
let autoHost = saveData.autoHost ?? "";
let autoInvite = saveData.autoInvite ?? "";
let autoJoinRoom = saveData.autoJoinRoom ?? false;
let autoKey = saveData.autoKey ?? false;
let autoMute = saveData.autoMute ?? null;
let autoReady = saveData.autoReady ?? false;
let autoStart = saveData.autoStart ?? false;
let autoStatus = saveData.autoStatus ?? "";
let autoSwitch = saveData.autoSwitch ?? "";
let autoThrow = saveData.autoThrow ?? {time1: null, time2: null, text: null, multichoice: null};
let autoUnmute = saveData.autoUnmute ?? null;
let autoVoteLobby = saveData.autoVoteLobby ?? false;
let autoVoteSkip = saveData.autoVoteSkip ?? null;
let backgroundURL = saveData.backgroundURL ?? "";
let commands = saveData.commands ?? true;
let countdown = null;
let countdownInterval;
let dropdown = saveData.dropdown ?? true;
let dropdownInSpec = saveData.dropdownInSpec ?? false;
let enableAllProfileButtons = saveData.enableAllProfileButtons ?? true;
let hidePlayers = saveData.hidePlayers ?? false;
let lastUsedVersion = saveData.lastUsedVersion ?? null;
let malClientId = saveData.malClientId ?? null;
let muteReplay = saveData.muteReplay ?? false;
let muteSubmit = saveData.muteSubmit ?? false;
let playbackSpeed = saveData.playbackSpeed ?? null;
let playerDetection = saveData.playerDetection ?? {invisible: false, players: []};
let printLoot = saveData.printLoot ?? false;
let printOffline = saveData.printOffline ?? false;
let printOnline = saveData.printOnline ?? false;
let selfDM = saveData.selfDM ?? false;
let tabSwitch = saveData.tabSwitch ?? true;
let voteOptions = {};
let votes = {};
const rules = {
    "alien": "https://pastebin.com/LxLMg1nA",
    "blackjack": "https://pastebin.com/kcq7hsJm",
    "dualraidboss": "https://pastebin.com/XkG7WWwj",
    "newgamemode": "https://pastebin.com/TAyYVsii",
    "password": "https://pastebin.com/17vKE78J",
    "pgm": "https://pastebin.com/CEc0uSHp",
    "pictionary": "https://pastebin.com/qc3NQJdX",
    "raidboss": "https://pastebin.com/NE28GUPq",
    "reversepassword": "https://pastebin.com/S8cQahNA",
    "spy": "https://pastebin.com/Q1Z35czX",
    "warlords": "https://pastebin.com/zWNRFsC3"
};
const scripts = {
    "autoready": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqAutoReady.user.js",
    "highlightfriends": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqHighlightFriends.user.js",
    "notificationsounds": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqNotificationSounds.user.js",
    "songlistui": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqSongListUI.user.js",
    "rigtrackerlite": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqRigTrackerLite.user.js",
    "answertime": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js",
    "speedrun": "https://github.com/TheJoseph98/AMQ-Scripts/raw/master/amqSpeedrun.user.js",
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js",
    "answerstats": "https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js",
    "chatplus": "https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js",
    "customsonglistgame" : "https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js",
    "megacommands": "https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js",
    "newgamemodeui": "https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js",
    "showroomplayers": "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js"
};
const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};
const dqMap = {
    "Naruto": {genre: [1, 2, 3, 4, 6, 17], years: [2002, 2002], seasons: [3, 3]},
    "Neon Genesis Evangelion": {genre: [1, 4, 9, 11, 12, 14], years: [1995, 1995], seasons: [3, 3]},
    "Gintama": {genre: [1, 3, 4, 14], years: [2006, 2006], seasons: [1, 1]},
    "Detective Conan": {genre: [2, 3, 11, 12], years: [1996, 1996], seasons: [0, 0]},
    "BECK: Mongolian Chop Squad": {genre: [3, 4, 10, 15], years: [2004, 2004], seasons: [3, 3]},
    "Initial D": {genre: [1, 4, 16], years: [1998, 1998], seasons: [1, 1]},
    "Negima!?": {genre: [2, 3, 5, 6, 13], years: [2006, 2006], seasons: [3, 3]},
    "Urusei Yatsura": {genre: [3, 4, 13, 14, 15], years: [1981, 1981], seasons: [3, 3]},
    "Touch": {genre: [4, 13, 15, 16], years: [1985, 1985], seasons: [1, 1]},
    "Code Geass: Lelouch of the Rebellion Remake Movies": {genre: [1, 9, 14, 17, 18], years: [2017, 2018], seasons: [3, 1]},
    "Chainsaw Man": {genre: [1, 4, 7, 17], tags: [1090], years: [2022, 2022], seasons: [3, 3]},
    "Senki Zesshou Symphogear GX": {genre: [1, 4, 8, 10, 14], years: [2015, 2015], seasons: [2, 2]},
    "Ojamajo Doremi Dokkaan!": {genre: [3, 4, 6, 8, 15], years: [2012, 2012], seasons: [3, 3]},
    "Macross Delta": {genre: [1, 9, 10, 13, 14], years: [2016, 2016], seasons: [1, 1]},
    "Macross 7": {genre: [1, 3, 4, 9, 10, 14], years: [1994, 1994], seasons: [3, 3]},
    "Mobile Suit Gundam Seed Destiny": {genre: [1, 4, 9, 13, 14], years: [2004, 2004], seasons: [3, 3]},
    "Zombie Land Saga Revenge": {genre: [3, 10, 17], years: [2021, 2021], seasons: [1, 1]},
    "Revue Starlight": {genre: [1, 4, 10, 12], years: [2018, 2018], seasons: [2, 2]},
    "Idoly Pride": {genre: [4, 10, 15, 17], years: [2021, 2021], seasons: [0, 0]},
    "Extra Olympia Kyklos": {genre: [3, 6, 15, 16], years: [2020, 2020], seasons: [1, 1]},
    "Japan Animator Expo": {genre: [1, 5, 6, 9, 10, 17], years: [2014, 2014], seasons: [3, 3]},
    "Persona 4 the Animation": {genre: [1, 2, 11, 14, 17], years: [2011, 2011], seasons: [3, 3]},
    "Ranma 1/2": {genre: [1, 3, 5, 13, 15], years: [1989, 1989], seasons: [1, 1]},
    "High School of the Dead": {genre: [1, 4, 5, 7, 13, 17], years: [2010, 2010], seasons: [2, 2]},
    "Re:Zero: Starting Life in Another World": {genre: [1, 2, 4, 6, 12, 13, 18], years: [2016, 2021], seasons: [1, 0]},
    "Guilty Crown": {genre: [1, 4, 9, 12, 13, 14], years: [2011, 2011], seasons: [3, 3]},
    ".hack//Sign": {genre: [2, 6, 11, 14], years: [2002, 2002], seasons: [1, 1]},
    "Heaven's Lost Property": {genre: [3, 5, 13, 14, 15, 17], years: [2009, 2009], seasons: [3, 3]},
    "White Album 2": {genre: [4, 10, 13, 15], years: [2013, 2013], seasons: [3, 3]},
    "Kimagure Orange★Road": {genre: [1, 3, 4, 6, 13], years: [1987, 1987], seasons: [1, 1]},
    "Cardcaptor Sakura": {genre: [3, 4, 6, 8, 13], years: [1998, 1998], seasons: [1, 1]},
    "Healer Girl": {genre: [10, 15, 17], years: [2022, 2022], seasons: [1, 1]},
    "Puella Magi Madoka Magica": {genre: [1, 4, 6, 8, 12, 18], years: [2011, 2011], seasons: [0, 0]},
    "Magic Knight Rayearth": {genre: [2, 4, 6, 8, 9], years: [1994, 1995], seasons: [3, 1]},
    "Fate/kaleid liner Prisma☆Illya 2wei Herz!": {genre: [1, 3, 5, 6, 8], years: [2015, 2015], seasons: [2, 2]},
    "Aquarion Evol": {genre: [1, 4, 6, 9, 13, 14], years: [2012, 2012], seasons: [0, 0]},
    "Wolf's Rain": {genre: [1, 2, 4, 6, 11, 14], years: [2003, 2003], seasons: [0, 0]},
    "Koyomimonogatari": {genre: [3, 11, 17], years: [2016, 2016], seasons: [0, 0]},
    "Beastars": {genre: [4, 11, 12, 13, 15], years: [2019, 2021], seasons: [3, 0]},
    "Vivy: Fluorite Eye's Song": {genre: [1, 4, 10, 14, 18], years: [2021, 2021], seasons: [1, 1]},
    "Monogatari Series Second Season": {genre: [3, 4, 11, 12, 13, 17], years: [2013, 2013], seasons: [2, 2]},
    "Akame ga Kill!": {genre: [1, 2, 4, 6, 7, 12, 18], years: [2014, 2014], seasons: [2, 2]},
    "Made in Abyss": {genre: [2, 4, 6, 7, 11, 14], years: [2017, 2017], seasons: [2, 2]},
    "Mirai Nikki": {genre: [1, 7, 11, 12, 17, 18], years: [2011, 2011], seasons: [3, 3]}
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
applyStyles();

function setup() {
    saveSettings();
    if (lastUsedVersion && version !== lastUsedVersion) {
        popoutMessages.displayStandardMessage("Mega Commands", "updated to version " + version);
    }
    if (selfDM) {
        setTimeout(() => {
            socialTab.startChat(selfName);
            socialTab.chatBar.activeChats[0].object.close();
            socialTab.chatBar.activeChats[0].object.selected();
        }, 100);
    }
    if (autoStatus === "do not disturb") socialTab.socialStatus.changeSocialStatus(2);
    else if (autoStatus === "away") socialTab.socialStatus.changeSocialStatus(3);
    else if (autoStatus === "invisible") socialTab.socialStatus.changeSocialStatus(4);
    document.body.addEventListener("keydown", (event) => {
        if (event.which === 9) {
            if (tabSwitch && quiz.inQuiz) {
                toggleTextInputFocus();
            }
        }
    });
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (!isRankedMode() && message.message.startsWith("/")) {
                if (message.message.startsWith("/forceall")) parseForceAll(message.message, message.teamMessage ? "teamchat" : "chat");
                else if (message.message.startsWith("/vote")) parseVote(message.message, message.sender);
                else if (message.sender === selfName) parseCommand(message.message, message.teamMessage ? "teamchat" : "chat");
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (!isRankedMode() && payload.message.startsWith("/")) {
            if (payload.message.startsWith("/forceall")) parseForceAll(payload.message, payload.teamMessage ? "teamchat" : "chat");
            else if (payload.sender === selfName) parseCommand(payload.message, payload.teamMessage ? "teamchat" : "chat");
        }
    }).bindListener();
    new Listener("chat message", (payload) => {
        parseIncomingDM(payload.message, payload.sender);
    }).bindListener();
    new Listener("chat message response", (payload) => {
        if (payload.msg.startsWith("/")) parseCommand(payload.msg, "dm", payload.target);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (playbackSpeed !== null) {
            let speed = Array.isArray(playbackSpeed) ? Math.random() * (playbackSpeed[1] - playbackSpeed[0]) + playbackSpeed[0] : playbackSpeed;
            quizVideoController.moePlayers.forEach((moePlayer) => { moePlayer.playbackRate = speed });
        }
        if (muteReplay || muteSubmit) {
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (quiz.answerInput.multipleChoice.displayed && autoThrow.multichoice) {
                let index = autoThrow.multichoice === "random" ? Math.floor(Math.random() * 4) : autoThrow.multichoice - 1;
                setTimeout(() => { quiz.answerInput.multipleChoice.handleClick(quiz.answerInput.multipleChoice.answerOptions[index]) }, autoThrow.time1);
            }
            else if (autoThrow.text) {
                if (autoThrow.time2) {
                    setTimeout(() => { quiz.answerInput.setNewAnswer(autoThrow.text) }, Math.floor(Math.random() * (autoThrow.time2 - autoThrow.time1 + 1)) + autoThrow.time1);
                }
                else {
                    setTimeout(() => { quiz.answerInput.setNewAnswer(autoThrow.text) }, autoThrow.time1);
                }
            }
            if (autoVoteSkip !== null) {
                setTimeout(() => { if (!quiz.skipController._toggled) quiz.skipClicked() }, autoVoteSkip);
            }
        }
        if (autoMute !== null) {
            let time = Array.isArray(autoMute) ? Math.floor(Math.random() * (autoMute[1] - autoMute[0] + 1)) + autoMute[0] : autoMute;
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                $("#qpVolume").addClass("disabled");
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, time);
        }
        if (autoUnmute !== null) {
            let time = Array.isArray(autoUnmute) ? Math.floor(Math.random() * (autoUnmute[1] - autoUnmute[0] + 1)) + autoUnmute[0] : autoUnmute;
            $("#qpVolume").addClass("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            setTimeout(() => {
                $("#qpVolume").removeClass("disabled");
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }, time);
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.typingInput.autoCompleteController.list.length) quiz.answerInput.typingInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled").val("");
            }, 1);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (autoVoteSkip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
        if (autoKey) sendSystemMessage("Auto Key: Enabled");
        if (autoCopy) sendSystemMessage("Auto Copy: " + autoCopy);
        if (autoThrow.text) sendSystemMessage("Auto Throw: " + autoThrow.text);
        if (autoThrow.multichoice) sendSystemMessage("Auto Throwing Multi Choice Option: " + autoThrow.multichoice);
        if (autoMute !== null) sendSystemMessage("Auto Mute: " + (Array.isArray(autoMute) ? `random ${autoMute[0] / 1000}s - ${autoMute[1] / 1000}s` : `${autoMute / 1000}s`));
        if (autoUnmute !== null) sendSystemMessage("Auto Unmute: " + (Array.isArray(autoUnmute) ? `random ${autoUnmute[0] / 1000}s - ${autoUnmute[1] / 1000}s` : `${autoUnmute / 1000}s`));
        if (muteReplay) sendSystemMessage("Mute During Replay Phase: Enabled");
        if (muteSubmit) sendSystemMessage("Mute After Submit: Enabled");
        if (playbackSpeed !== null) sendSystemMessage("Song Playback Speed: " + (Array.isArray(playbackSpeed) ? `random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x` : `${playbackSpeed}x`));
        if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (autoCopy && autoCopy === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let currentText = $("#qpAnswerInput").val();
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(currentText);
        }
    }).bindListener();
    new Listener("guess phase over", (payload) => {
        if (autoMute !== null || autoUnmute !== null) {
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.typingInput.autoCompleteController.list.length) quiz.answerInput.typingInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled");
            }, 1);
        }
    }).bindListener();
    new Listener("answer results", (payload) => {
        if (autoMute !== null || autoUnmute !== null) {
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (muteReplay) {
            volumeController.setMuted(true);
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
            for (let entry of battleRoyal.collectionController.entries) {
                sendSystemMessage(entry.$entry.text().substring(2));
            }
        }
    }).bindListener();
    new Listener("quiz over", (payload) => {
        setTimeout(() => { checkAutoHost() }, 10);
        if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.error) {
            autoJoinRoom = false;
            saveSettings();
        }
        else {
            if (payload.inLobby) {
                if (autoReady) sendSystemMessage("Auto Ready: Enabled");
                if (autoStart) sendSystemMessage("Auto Start: Enabled");
                if (autoHost) sendSystemMessage("Auto Host: " + autoHost);
                if (autoInvite) sendSystemMessage("Auto Invite: " + autoInvite);
                if (autoAcceptInvite) sendSystemMessage("Auto Accept Invite: Enabled");
                if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
                if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
            }
            else {
                if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
            }
        }
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.error) {
            autoJoinRoom = false;
            saveSettings();
        }
        else {
            if (payload.inLobby) {
                if (autoReady) sendSystemMessage("Auto Ready: Enabled");
                if (autoStart) sendSystemMessage("Auto Start: Enabled");
                if (autoHost) sendSystemMessage("Auto Host: " + autoHost);
                if (autoInvite) sendSystemMessage("Auto Invite: " + autoInvite);
                if (autoAcceptInvite) sendSystemMessage("Auto Accept Invite: Enabled");
                if (autoSwitch) setTimeout(() => { checkAutoSwitch() }, 100);
                if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
            }
            else {
                if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
            }
        }
    }).bindListener();
    new Listener("New Player", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();
    new Listener("New Spectator", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
    }).bindListener();
    new Listener("player late join", (payload) => {
        if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
    }).bindListener();
    new Listener("player hidden", (payload) => {
        if (alertHidden) {
            gameChat.systemMessage("Player Hidden: " + payload.name);
            popoutMessages.displayStandardMessage("Player Hidden", payload.name);
        }
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
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();
    new Listener("Host Promotion", (payload) => {
        setTimeout(() => { checkAutoHost() }, 1);
        setTimeout(() => { checkAutoReady() }, 1);
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();
    new Listener("game invite", (payload) => {
        if (autoAcceptInvite && !inRoom() && ((autoAcceptInvite === true && socialTab.isFriend(payload.sender))
        || (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())))) {
            roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
        }
    }).bindListener();
    new Listener("friend state change", (payload) => {
        if (payload.online && autoInvite === payload.name.toLowerCase() && inRoom() && !isInYourRoom(autoInvite) && !isSoloMode() && !isRankedMode()) {
            sendSystemMessage(payload.name + " online: auto inviting");
            setTimeout(() => { socket.sendCommand({type: "social", command: "invite to game", data: {target: payload.name}}) }, 1000);
        }
        else if (printOnline && payload.online) {
            sendSystemMessage(payload.name + " online");
        }
        else if (printOffline && !payload.online) {
            sendSystemMessage(payload.name + " offline");
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
                    if (room.players.includes(player)) popoutMessages.displayStandardMessage(player, `Room ${room.id}: ${room.settings.roomName}`);
                }
            }
        }
    }).bindListener();
    new Listener("nexus coop chat message", (payload) => {
        if (payload.message.startsWith("/")) {
            if (payload.message.startsWith("/forceall")) parseForceAll(payload.message, "nexus");
            else if (payload.message.startsWith("/vote")) parseVote(payload.message, payload.sender);
            else if (payload.sender === selfName) parseCommand(payload.message, "nexus");
        }
    }).bindListener();
    new Listener("nexus game invite", (payload) => {
        if (autoAcceptInvite && !inRoom() && ((autoAcceptInvite === true && socialTab.isFriend(payload.sender))
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
    new Listener("friend name change", (payload) => {
        if (gameChat.isShown()) sendSystemMessage(`friend name change: ${payload.oldName} => ${payload.newName}`);
    }).bindListener();
    $("#qpAnswerInput").on("input", (event) => {
        if (autoKey) {
            socket.sendCommand({type: "quiz", command: "quiz answer", data: {answer: event.target.value || " ", isPlaying: true, volumeAtMax: false}});
            quiz.answerInput.typingInput.autoSubmitEligible = false;
        }
    }).on("keypress", (event) => {
        if (event.which === 13 && muteSubmit && !volumeController.muted) {
            volumeController.setMuted(true);
            volumeController.adjustVolume();
        }
    });
    $("#brMap").keypress((event) => {
        if (event.which === 32 && printLoot && battleRoyal.inView) {
            $("#brMapContent .brMapObject").popover($(".popover").length ? "hide" : "show");
        }
    });
    if (autoJoinRoom) {
        if (autoJoinRoom.rejoin) {
            if (document.querySelector(".swal2-container")) {
                document.querySelector(".swal2-container button.swal2-confirm").click();
            }
        }
        else if (autoJoinRoom.type === "solo") {
            hostModal.changeSettings(autoJoinRoom.settings);
            hostModal.soloMode = true;
            setTimeout(() => { roomBrowser.host() }, 10);
        }
        else if (autoJoinRoom.type === "ranked novice") {
            if (ranked.currentState !== ranked.RANKED_STATE_IDS.RUNNING && ranked.currentState !== ranked.RANKED_STATE_IDS.CHAMP_RUNNING) {
                ranked.joinRankedLobby(ranked.RANKED_TYPE_IDS.NOVICE);
            }
            else {
                ranked.joinRankedGame(ranked.RANKED_TYPE_IDS.NOVICE);
            }
        }
        else if (autoJoinRoom.type === "ranked expert") {
            if (ranked.currentState !== ranked.RANKED_STATE_IDS.RUNNING && ranked.currentState !== ranked.RANKED_STATE_IDS.CHAMP_RUNNING) {
                ranked.joinRankedLobby(ranked.RANKED_TYPE_IDS.EXPERT);
            }
            else {
                ranked.joinRankedGame(ranked.RANKED_TYPE_IDS.EXPERT);
            }
        }
        else if (autoJoinRoom.type === "multiplayer") {
            if (autoJoinRoom.joinAsPlayer) {
                roomBrowser.fireJoinLobby(autoJoinRoom.id, autoJoinRoom.password);
            }
            else {
                roomBrowser.fireSpectateGame(autoJoinRoom.id, autoJoinRoom.password);
            }
        }
        else if (autoJoinRoom.type === "nexus coop") {
            if (autoJoinRoom.id) {
                socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: autoJoinRoom.id}});
            }
            else {
                socket.sendCommand({type: "nexus", command: "setup dungeon lobby", data: {typeId: 1, coop: true}});
            }
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
        if (enableAllProfileButtons) {
            $("#playerProfileLayer .ppFooterOptionIcon").removeClass("disabled");
        }
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
async function parseCommand(content, type, target) {
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
        if (hostModal.$teamSize.slider("getValue") === 1) return sendMessage("team size must be greater than 1", type, target);
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
        if (hostModal.$teamSize.slider("getValue") === 1) return sendMessage("team size must be greater than 1", type, target);
        let dict = getTeamDictionary();
        if (Object.keys(dict).length === 0) return;
        let teams = Object.keys(dict);
        teams.sort((a, b) => parseInt(a) - parseInt(b));
        teams.forEach((team, i) => {
            setTimeout(() => { sendMessage(`Team ${team}: ` + shuffleArray(dict[team]).join(" ➜ "), type, target) }, (i + 1) * 200);
        });
    }
    else if (/^\/roll .+,.+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter(Boolean);
        if (list.length > 1) sendMessage(list[Math.floor(Math.random() * list.length)], type, target);
    }
    else if (/^\/shuffle (p|players?)$/i.test(content)) {
        let list = getPlayerList();
        if (list.length > 1) sendMessage(shuffleArray(list).join(", "), type, target);
    }
    else if (/^\/shuffle (s|spectators?)$/i.test(content)) {
        let list = getSpectatorList();
        if (list.length > 1) sendMessage(shuffleArray(list).join(", "), type, target);
    }
    else if (/^\/shuffle (t|teammates?)$/i.test(content)) {
        let list = getTeamList(getTeamNumber(selfName));
        if (list.length > 1) sendMessage(shuffleArray(list).join(", "), type, target);
    }
    else if (/^\/shuffle .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter(Boolean);
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
        if (isNaN(value)) return;
        let settings = hostModal.getSettings();
        if (option === "all") {
            settings.songType.advancedValue.openings = value;
            settings.songType.advancedValue.endings = value;
            settings.songType.advancedValue.inserts = value;
            settings.songType.advancedValue.random = value;
        }
        else if (option[0] === "o") {
            settings.songType.advancedValue.openings = value;
        }
        else if (option[0] === "e") {
            settings.songType.advancedValue.endings = value;
        }
        else if (option[0] === "i") {
            settings.songType.advancedValue.inserts = value;
        }
        else if (option[0] === "r") {
            settings.songType.advancedValue.random = value;
        }
        else return;
        changeGameSettings(settings);
    }
    else if (/^\/random$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 1;
        settings.songSelection.advancedValue.random = settings.numberOfSongs;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.watched = 0;
        changeGameSettings(settings);
    }
    else if (/^\/unwatched$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 2;
        settings.songSelection.advancedValue.random = 0;
        settings.songSelection.advancedValue.unwatched = settings.numberOfSongs;
        settings.songSelection.advancedValue.watched = 0;
        changeGameSettings(settings);
    }
    else if (/^\/watched$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.songSelection.standardValue = 3;
        settings.songSelection.advancedValue.random = 0;
        settings.songSelection.advancedValue.unwatched = 0;
        settings.songSelection.advancedValue.watched = settings.numberOfSongs;
        changeGameSettings(settings);
    }
    else if (/^\/selection \w+ [0-9]+$/i.test(content)) {
        let option = /^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase();
        let value = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        if (isNaN(value)) return;
        let settings = hostModal.getSettings();
        if (option === "all") {
            settings.songSelection.advancedValue.watched = value;
            settings.songSelection.advancedValue.unwatched = value;
            settings.songSelection.advancedValue.random = value;
        }
        else if (option[0] === "w") {
            settings.songSelection.advancedValue.watched = value;
        }
        else if (option[0] === "u") {
            settings.songSelection.advancedValue.unwatched = value;
        }
        else if (option[0] === "r") {
            settings.songSelection.advancedValue.random = value;
        }
        else return;
        changeGameSettings(settings);
    }
    else if (/^\/time [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.guessTime.randomOn = false;
        settings.guessTime.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/time [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.guessTime.randomOn = true;
        settings.guessTime.randomValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/(etime|extratime) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.extraGuessTime.randomOn = false;
        settings.extraGuessTime.standardValue = option;
        changeGameSettings(settings);
    }
    else if (/^\/(etime|extratime) [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.extraGuessTime.randomOn = true;
        settings.extraGuessTime.randomValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/(sp|sample|samplepoint|startpoint) [a-zA-z]+$/i.test(content)) {
        let option = /^\S+ ([a-zA-z]+)$/.exec(content)[1].toLowerCase();
        let settings = hostModal.getSettings();
        settings.samplePoint.randomOn = false;
        if (option[0] === "s") settings.samplePoint.standardValue = 1;
        else if (option[0] === "m") settings.samplePoint.standardValue = 2;
        else if (option[0] === "e") settings.samplePoint.standardValue = 3;
        else return;
        changeGameSettings(settings);
    }
    else if (/^\/(sp|sample|samplepoint|startpoint) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.samplePoint.randomOn = true;
        settings.samplePoint.randomValue = [option, option];
        changeGameSettings(settings);
    }
    else if (/^\/(sp|sample|samplepoint|startpoint) [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.samplePoint.randomOn = true;
        settings.samplePoint.randomValue = [low, high];
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
    else if (/^\/(d|dif|difficulty) [a-zA-Z]+$/i.test(content)) {
        let option = /^\S+ ([a-zA-Z]+)$/.exec(content)[1].toLowerCase();
        let settings = hostModal.getSettings();
        settings.songDifficulity.advancedOn = false;
        settings.songDifficulity.standardValue.easy = option.includes("e");
        settings.songDifficulity.standardValue.medium = option.includes("m");
        settings.songDifficulity.standardValue.hard = option.includes("h");
        changeGameSettings(settings);
    }
    else if (/^\/(d|dif|difficulty) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.songDifficulity.advancedOn = true;
        settings.songDifficulity.advancedValue = [option, option];
        changeGameSettings(settings);
    }
    else if (/^\/(d|dif|difficulty) [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.songDifficulity.advancedOn = true;
        settings.songDifficulity.advancedValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/years?$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.vintage = hostModal.DEFUALT_SETTINGS.vintage;
        changeGameSettings(settings);
    }
    else if (/^\/years? [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = {years: [option, option], seasons: [0, 3]};
        changeGameSettings(settings);
    }
    else if (/^\/years? [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = {years: [low, high], seasons: [0, 3]};
        changeGameSettings(settings);
    }
    else if (/^\/seasons?$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue.seasons = [0, 3];
        changeGameSettings(settings);
    }
    else if (/^\/seasons? (winter|spring|summer|fall|0|1|2|3)$/i.test(content)) {
        let seasonMap = {winter: 0, spring: 1, summer: 2, fall: 3, 0: 0, 1: 1, 2: 2, 3: 3};
        let option = seasonMap[/^\S+ ([0-9]+)$/.exec(content)[1].toLowerCase()];
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue.seasons = [option, option];
        changeGameSettings(settings);
    }
    else if (/^\/seasons? (winter|spring|summer|fall|0|1|2|3)[ ,-]+(winter|spring|summer|fall|0|1|2|3)$/i.test(content)) {
        let seasonMap = {winter: 0, spring: 1, summer: 2, fall: 3, 0: 0, 1: 1, 2: 2, 3: 3};
        let low = seasonMap[/^\S+ (\w+)[ ,-]+\w+$/.exec(content)[1].toLowerCase()];
        let high = seasonMap[/^\S+ \w+[ ,-]+(\w+)$/.exec(content)[1].toLowerCase()];
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue.seasons = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/vintage$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.vintage = hostModal.DEFUALT_SETTINGS.vintage;
        changeGameSettings(settings);
    }
    else if (/^\/vintage (winter|spring|summer|fall|0|1|2|3) [0-9]+$/i.test(content)) {
        let seasonMap = {winter: 0, spring: 1, summer: 2, fall: 3, 0: 0, 1: 1, 2: 2, 3: 3};
        let season = seasonMap[/^\S+ (\w+) [0-9]+$/.exec(content)[1].toLowerCase()];
        let year = parseInt(/^\S+ \w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = {years: [year, year], seasons: [season, season]};
        changeGameSettings(settings);
    }
    else if (/^\/vintage (winter|spring|summer|fall|0|1|2|3) [0-9]+[ ,-]+(winter|spring|summer|fall|0|1|2|3) [0-9]+$/i.test(content)) {
        let seasonMap = {winter: 0, spring: 1, summer: 2, fall: 3, 0: 0, 1: 1, 2: 2, 3: 3};
        let season1 = seasonMap[/^\S+ (\w+) [0-9]+[ ,-]+\w+ [0-9]+$/.exec(content)[1].toLowerCase()];
        let season2 = seasonMap[/^\S+ \w+ [0-9]+[ ,-]+(\w+) [0-9]+$/.exec(content)[1].toLowerCase()];
        let year1 = parseInt(/^\S+ \w+ ([0-9]+)[ ,-]+\w+ [0-9]+$/.exec(content)[1]);
        let year2 = parseInt(/^\S+ \w+ [0-9]+[ ,-]+\w+ ([0-9]+)$/.exec(content)[1]);
        let settings = hostModal.getSettings();
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = {years: [year1, year2], seasons: [season1, season2]};
        changeGameSettings(settings);
    }
    else if (/^\/genres?$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.genre = [];
        changeGameSettings(settings);
    }
    else if (/^\/genres? .+$/i.test(content)) {
        let genres = Object.values(idTranslator.genreNames).map((x) => x.toLowerCase());
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => x.trim()).filter((x) => genres.includes(x));
        if (!list.length) return;
        let settings = hostModal.getSettings();
        settings.genre = [];
        for (let genre of list) {
            let id = Object.keys(idTranslator.genreNames).find((id) => idTranslator.genreNames[id].toLowerCase() === genre);
            settings.genre.push({id: id, state: 1});
        }
        changeGameSettings(settings);
    }
    else if (/^\/tags?$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.tags = [];
        changeGameSettings(settings);
    }
    else if (/^\/tags? .+$/i.test(content)) {
        let tags = Object.values(idTranslator.tagNames).map((x) => x.toLowerCase());
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => x.trim()).filter((x) => tags.includes(x));
        if (!list.length) return;
        let settings = hostModal.getSettings();
        settings.tags = [];
        for (let tag of list) {
            let id = Object.keys(idTranslator.tagNames).find((id) => idTranslator.tagNames[id].toLowerCase() === tag);
            settings.tags.push({id: id, state: 1});
        }
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
        sendMessage(`song playback speed set to ${playbackSpeed}`, type, target, true);
    }
    else if (/^\/speed [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        playbackSpeed = [low, high];
        sendMessage(`song playback speed set to random # between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/(mr|mutereplay)$/i.test(content)) {
        muteReplay = !muteReplay;
        sendMessage(`mute during replay phase ${muteReplay ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(ms|mutesubmit)$/i.test(content)) {
        muteSubmit = !muteSubmit;
        sendMessage(`mute after answer submit ${muteSubmit ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(avs|autoskip|autovoteskip)$/i.test(content)) {
        if (autoVoteSkip === null) autoVoteSkip = 100;
        else autoVoteSkip = null;
        sendMessage(`auto vote skip ${autoVoteSkip ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(avs|autoskip|autovoteskip) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = Math.floor(seconds * 1000);
        sendMessage(`auto vote skip after ${seconds} seconds`, type, target, true);
    }
    else if (/^\/(ak|autokey|autosubmit)$/i.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendMessage(`auto key ${autoKey ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(at|att|atmc|autothrow|autothrowtime|autothrowmc|autothrowmultichoice|autothrowmultiplechoice)$/i.test(content)) {
        autoThrow = {time1: null, time2: null, text: null, multichoice: null};
        sendMessage("auto throw disabled", type, target, true);
    }
    else if (/^\/(at|autothrow) .+$/i.test(content)) {
        autoThrow.time1 = 1;
        autoThrow.time2 = null;
        autoThrow.text = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text}`, type, target, true);
    }
    else if (/^\/(att|autothrowtime) [0-9.]+ .+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+) .+$/.exec(content)[1]);
        if (isNaN(time1)) return;
        autoThrow.time1 = Math.floor(time1 * 1000);
        autoThrow.time2 = null;
        autoThrow.text = translateShortcodeToUnicode(/^\S+ [0-9.]+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text} after ${time1} seconds`, type, target, true);
    }
    else if (/^\/(att|autothrowtime) [0-9.]+[ -][0-9.]+ .+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+ .+$/.exec(content)[1]);
        let time2 = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+) .+$/.exec(content)[1]);
        if (isNaN(time1) || isNaN(time2)) return;
        autoThrow.time1 = Math.floor(time1 * 1000);
        autoThrow.time2 = Math.floor(time2 * 1000);
        autoThrow.text = translateShortcodeToUnicode(/^\S+ [0-9.]+[ -][0-9.]+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text} after ${time1}-${time2} seconds`, type, target, true);
    }
    else if (/^\/(atmc|autothrowmc|autothrowmultichoice|autothrowmultiplechoice) \S+$/i.test(content)) {
        let option = /^\S+ (\S+)$/.exec(content)[1];
        if (option === "r" || option === "random") {
            autoThrow.time1 = 100;
            autoThrow.time2 = null;
            autoThrow.text = null;
            autoThrow.multichoice = "random";
            sendMessage(`auto throwing multi choice item: ${autoThrow.multichoice}`, type, target, true);
        }
        else if (option === "1" || option === "2" || option === "3" || option === "4") {
            autoThrow.time1 = 100;
            autoThrow.time2 = null;
            autoThrow.text = null;
            autoThrow.multichoice = parseInt(option);
            sendMessage(`auto throwing multi choice item: ${autoThrow.multichoice}`, type, target, true);
        }
    }
    else if (/^\/(ac|autocopy)$/i.test(content)) {
        autoCopy = "";
        sendMessage("auto copy disabled", type, target, true);
    }
    else if (/^\/(ac|autocopy) \w+$/i.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto copying ${autoCopy}`, type, target, true);
    }
    else if (/^\/(am|automute)$/i.test(content)) {
        $("#qpVolume").removeClass("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = null;
        autoUnmute = null;
        sendMessage("auto mute disabled", type, target, true);
    }
    else if (/^\/(am|automute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = Math.floor(seconds * 1000);
        autoUnmute = null;
        sendMessage(`auto muting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
    }
    else if (/^\/(am|automute) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoMute = [Math.floor(low * 1000), Math.floor(high * 1000)];
        autoUnmute = null;
        sendMessage(`auto muting after random # of seconds between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/(au|autounmute)$/i.test(content)) {
        $("#qpVolume").removeClass("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoUnmute = null;
        autoMute = null;
        sendMessage("auto unmute disabled", type, target, true);
    }
    else if (/^\/(au|autounmute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoUnmute = Math.floor(seconds * 1000);
        autoMute = null;
        sendMessage(`auto unmuting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
    }
    else if (/^\/(au|autounmute) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoUnmute = [Math.floor(low * 1000), Math.floor(high * 1000)];
        autoMute = null;
        sendMessage(`auto unmuting after random # of seconds between ${low} - ${high}`, type, target, true);
    }
    else if (/^\/autoready$/i.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendMessage(`auto ready ${autoReady ? "enabled" : "disabled"}`, type, target, true);
        checkAutoReady();
    }
    else if (/^\/autostart$/i.test(content)) {
        autoStart = !autoStart;
        sendMessage(`auto start game ${autoStart ? "enabled" : "disabled"}`, type, target, true);
        checkAutoStart();
    }
    else if (/^\/(ah|autohost)$/i.test(content)) {
        autoHost = "";
        sendMessage("auto host disabled", type, target, true);
    }
    else if (/^\/(ah|autohost) \S+$/i.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto hosting ${autoHost}`, type, target, true);
        checkAutoHost();
    }
    else if (/^\/autoinvite$/i.test(content)) {
        autoInvite = "";
        sendMessage("auto invite disabled", type, target, true);
    }
    else if (/^\/autoinvite \w+$/i.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto inviting ${autoInvite}`, type, target, true);
    }
    else if (/^\/autoaccept$/i.test(content)) {
        autoAcceptInvite = !autoAcceptInvite;
        saveSettings();
        sendMessage(`auto accept invite ${autoAcceptInvite ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/autoaccept .+$/i.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
        saveSettings();
        sendMessage(`auto accept invite only from ${autoAcceptInvite.join(", ")}`, type, target, true);
    }
    else if (/^\/autojoin$/i.test(content)) {
        if (autoJoinRoom || isSoloMode() || isRankedMode()) {
            autoJoinRoom = false;
            saveSettings();
            sendMessage("auto join room disabled", type, target, true);
        }
        else if (lobby.inLobby) {
            let password = hostModal.$passwordInput.val();
            autoJoinRoom = {id: lobby.gameId, password: password};
            saveSettings();
            sendMessage(`auto joining room ${lobby.gameId} ${password}`, type, target, true);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.$passwordInput.val();
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
        if (/^\S+ p/i.test(content)) autoSwitch = "player";
        else if (/^\S+ s/i.test(content)) autoSwitch = "spectator";
        sendMessage(`auto switching to ${autoSwitch}`, type, target, true);
        checkAutoSwitch();
    }
    else if (/^\/autolobby$/i.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendMessage(`auto vote lobby ${autoVoteLobby ? "enabled" : "disabled"}`, type, target, true);
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
            sendMessage(`auto status set to ${autoStatus}`, type, target, true);
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
    else if (/^\/host$/i.test(content)) {
        if (type === "dm" && isInYourRoom(target)) {
            if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
                lobby.promoteHost(target);
            }
            else if (nexus.inCoopLobby || nexus.inNexusGame) {
                socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: target}});
            }
        }
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
                socket.sendCommand({type: "nexus", command: "nexus kick player", data: {name: getPlayerNameCorrectCase(name)}});
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
        setTimeout(() => { $("#gcMessageContainer li").remove() }, 1);
    }
    else if (/^\/(dd|dropdown)$/i.test(content)) {
        dropdown = !dropdown;
        sendMessage(`dropdown ${dropdown ? "enabled" : "disabled"}`, type, target, true);
        quiz.answerInput.typingInput.autoCompleteController.newList();
    }
    else if (/^\/(dds|dropdownspec|dropdownspectate)$/i.test(content)) {
        dropdownInSpec = !dropdownInSpec;
        if (dropdownInSpec) $("#qpAnswerInput").removeAttr("disabled");
        sendMessage(`dropdown while spectating ${dropdownInSpec ? "enabled" : "disabled"}`, type, target, true);
        saveSettings();
    }
    else if (/^\/(pw|password)$/i.test(content)) {
        sendMessage(`password: ${hostModal.$passwordInput.val()}`, type, target);
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
        unsafeWindow.onbeforeunload = null;
        setTimeout(() => { options.logout() }, 1);
    }
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/i.test(content)) {
        if (isSoloMode()) {
            autoJoinRoom = {type: "solo", rejoin: quiz.inQuiz, temp: true, settings: hostModal.getSettings(), autoLogIn: true};
            saveSettings();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
        }
        else if (isRankedMode()) {
            autoJoinRoom = {type: hostModal.$roomName.val().toLowerCase(), rejoin: quiz.inQuiz && !quiz.isSpectator, temp: true, autoLogIn: true};
            saveSettings();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
        }
        else if (lobby.inLobby) {
            let password = hostModal.$passwordInput.val();
            autoJoinRoom = {type: "multiplayer", id: lobby.gameId, password: password, joinAsPlayer: !lobby.isSpectator, temp: true, autoLogIn: true};
            saveSettings();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.$passwordInput.val();
                    autoJoinRoom = {type: "multiplayer", id: payload.gameId, password: password, rejoin: !quiz.isSpectator, temp: true, autoLogIn: true};
                    saveSettings();
                    unsafeWindow.onbeforeunload = null;
                    setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
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
                    unsafeWindow.onbeforeunload = null;
                    setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
                }
                else {
                    autoJoinRoom = {type: "nexus coop", temp: true, autoLogIn: true};
                    saveSettings();
                    unsafeWindow.onbeforeunload = null;
                    setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
                }
            }
            else {
                autoJoinRoom = {type: "nexus solo", temp: true, autoLogIn: true};
                saveSettings();
                unsafeWindow.onbeforeunload = null;
                setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
            }
        }
        else if (nexus.inNexusGame) {
            autoJoinRoom = {type: "nexus coop", rejoin: true, temp: true, autoLogIn: true};
            saveSettings();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
        }
        else {
            autoJoinRoom = {temp: true, autoLogIn: true};
            saveSettings();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { unsafeWindow.location = "/?forceLogin=True" }, 1);
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
        applyStyles();
        saveSettings();
    }
    else if (/^\/(bg|background|wallpaper) (link|url)$/i.test(content)) {
        if (backgroundURL) sendMessage(backgroundURL, type, target);
    }
    else if (/^\/(bg|background|wallpaper) http.+\.(jpg|jpeg|png|gif|tiff|bmp|webp)$/i.test(content)) {
        backgroundURL = /^\S+ (.+)$/.exec(content)[1];
        applyStyles();
        saveSettings();
    }
    else if (/^\/detect$/i.test(content)) {
        sendMessage(`invisible: ${playerDetection.invisible}`, type, target, true);
        sendMessage(`players: ${playerDetection.players.join(", ")}`, type, target, true);
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
    else if (/^\/countfriends$/i.test(content)) {
        sendMessage(getAllFriends().length, type, target);
    }
    else if (/^\/startvote .+,.+$/i.test(content)) {
        if (type !== "chat") return;
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter(Boolean);
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
    else if (/^\/alert ?hidden$/i.test(content)) {
        alertHidden = !alertHidden;
        saveSettings();
        sendMessage(`alert when players are hidden by moderator: ${alertHidden ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/print ?loot$/i.test(content)) {
        printLoot = !printLoot;
        saveSettings();
        sendMessage(`print loot ${printLoot ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/print ?online$/i.test(content)) {
        printOnline = !printOnline;
        saveSettings();
        sendMessage(`print when friends are online: ${printOnline ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/print ?offline$/i.test(content)) {
        printOffline = !printOffline;
        saveSettings();
        sendMessage(`print when friends are offline: ${printOffline ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/selfdm$/i.test(content)) {
        selfDM = !selfDM;
        saveSettings();
        sendMessage(`open self dm on log in: ${selfDM ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(profilebuttons|enableallprofilebuttons)$/i.test(content)) {
        enableAllProfileButtons = !enableAllProfileButtons;
        saveSettings();
        sendMessage(`profile buttons ${enableAllProfileButtons ? "are now clickable" : "have default behavior"}`, type, target, true);
    }
    else if (/^\/tabswitch$/i.test(content)) {
        tabSwitch = !tabSwitch;
        saveSettings();
        sendMessage(`switch text inputs with tab button: ${tabSwitch ? "enabled" : "disabled"}`, type, target, true);
    }
    else if (/^\/(hp|hideplayers)$/i.test(content)) {
        hidePlayers = !hidePlayers;
        if (hidePlayers) {
            if (lobby.inLobby) lobbyHidePlayers();
            else if (quiz.inQuiz) quizHidePlayers();
        }
        else {
            if (lobby.inLobby) lobbyUnhidePlayers();
            else if (quiz.inQuiz) quizUnhidePlayers();
        }
        applyStyles();
        sendMessage(`all players are now ${hidePlayers ? "hidden" : "shown"}`, type, target, true);
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
    else if (/^\/remove ?(popups?|popovers?)$/i.test(content)) {
        $(".popover").hide();
    }
    else if (/^\/selfcolor$/i.test(content)) {
        let data = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
        if (data) sendMessage(data.smColorSelfColor, type, target);
    }
    else if (/^\/friendcolor$/i.test(content)) {
        let data = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
        if (data) sendMessage(data.smColorFriendColor, type, target);
    }
    else if (/^\/genreid .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter(Boolean);
        if (list.length) sendMessage(list.map((x) => idTranslator.genreNames[x]).filter(Boolean).join(", "), type, target);
    }
    else if (/^\/tagid .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim()).filter(Boolean);
        if (list.length) sendMessage(list.map((x) => idTranslator.tagNames[x]).filter(Boolean).join(", "), type, target);
    }
    else if (/^\/(dq|daily|dailies|dailyquests?) detect$/i.test(content)) {
        let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b]: parseInt(a)})));
        let list = Object.values(qusetContainer.questMap).filter((x) => x.name.includes(" Fan") && x.state !== x.targetState).map((x) => genreDict[x.name.split(" Fan")[0]]);
        if (list.length) {
            sendMessage(`Detected: ${list.map((x) => idTranslator.genreNames[x]).join(", ")}`, type, target, true);
            let anime = genreLookup(list);
            if (anime) {
                sendMessage(anime, type, target);
                matchSettingsToAnime(anime);
            }
            else {
                sendMessage("no anime found for those genres", type, target, true);
            }
        }
        else {
            sendMessage("no incomplete genre quests detected", type, target, true);
        }
    }
    else if (/^\/(dq|daily|dailies|dailyquests?) .+$/i.test(content)) {
        let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b.toLowerCase()]: parseInt(a)})));
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => genreDict[x.trim()]);
        if (list.length && list.every(Boolean)) {
            let anime = genreLookup(list);
            if (anime) {
                sendMessage(anime, type, target);
                matchSettingsToAnime(anime);
            }
            else {
                sendMessage("no anime found for those genres", type, target, true);
            }
        }
        else {
            sendMessage("invalid genre", type, target, true);
        }
    }
    else if (/^\/(sd|ds|settings default|default ?settings)$/i.test(content)) {
        let currentSettings = hostModal.getSettings();
        let settings = hostModal.DEFUALT_SETTINGS;
        settings.roomName = currentSettings.roomName;
        settings.privateRoom = currentSettings.privateRoom;
        settings.password = currentSettings.password;
        changeGameSettings(settings);
    }
    else if (/^\/settings (a|ani|anilist) [0-9]+$/i.test(content)) {
        let id = /^\S+ \S+ ([0-9]+)$/.exec(content)[1];
        let data = await getAnimeFromAnilistId(id);
        if (data) {
            let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b]: a})));
            let seasonDict = {WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3};
            let settings = hostModal.getSettings();
            settings.songSelection.standardValue = 1;
            settings.songSelection.advancedValue = {random: settings.numberOfSongs, unwatched: 0, watched: 0};
            settings.songType.advancedValue = {openings: 0, endings: 0, inserts: 0, random: 20};
            settings.songType.standardValue = {openings: true, endings: true, inserts: true};
            settings.vintage.advancedValueList = [];
            settings.vintage.standardValue.years = [data.seasonYear, data.seasonYear];
            settings.vintage.standardValue.seasons = [seasonDict[data.season], seasonDict[data.season]];
            settings.genre = data.genres.map((x) => ({id: genreDict[x], state: 1}));
            //settings.tags = data.tags.map((x) => ({id: String(x.id), state: 1}));
            changeGameSettings(settings);
        }
        else {
            sendMessage("invalid anilist id", type, target);
        }
    }
    else if (/^\/anilist [0-9]+$/i.test(content)) {
        let id = /^\S+ ([0-9]+)$/.exec(content)[1];
        let data = await getAnimeFromAnilistId(id);
        if (data) {
            sendMessage(options.useRomajiNames ? data.title.romaji : (data.title.english || data.title.romaji), type, target);
        }
        else {
            sendMessage("invalid anilist id", type, target);
        }
    }
    else if (/^\/count (a|ani|anilist) \S+$/i.test(content)) {
        let username = /^\S+ \S+ (\S+)$/.exec(content)[1];
        let data = await getAnilistAnimeList(username);
        if (data.length) {
            sendMessage(data.length, type, target);
        }
        else {
            sendMessage("invalid username", type, target);
        }
    }
    else if (/^\/roll (a|ani|anilist) \S+$/i.test(content)) {
        let username = /^\S+ \S+ (\S+)$/.exec(content)[1];
        let data = await getAnilistAnimeList(username);
        if (data.length) {
            let result = data[Math.floor(Math.random() * data.length)].media.title;
            sendMessage(options.useRomajiNames ? result.romaji : (result.english || result.romaji), type, target);
        }
        else {
            sendMessage("invalid username", type, target);
        }
    }
    else if (/^\/count (m|mal|myanimelist) \S+$/i.test(content)) {
        if (malClientId) {
            let username = /^\S+ \S+ (\S+)$/.exec(content)[1];
            let data = await getMALAnimeList(username);
            if (data.length) {
                sendMessage(data.length, type, target);
            }
            else {
                sendMessage("invalid username", type, target);
            }
        }
        else {
            sendMessage("mal client id is not set", type, target);
        }
    }
    else if (/^\/roll (m|mal|myanimelist) \S+$/i.test(content)) {
        if (malClientId) {
            let username = /^\S+ \S+ (\S+)$/.exec(content)[1];
            let data = await getMALAnimeList(username);
            if (data.length) {
                let result = data[Math.floor(Math.random() * data.length)].node.title;
                sendMessage(result, type, target);
            }
            else {
                sendMessage("invalid username", type, target);
            }
        }
        else {
            sendMessage("mal client id is not set", type, target);
        }
    }
    else if (/^\/(malclientid|malapikey)$/i.test(content)) {
        sendMessage(malClientId ? malClientId : "mal client id is not set", type, target, true);
    }
    else if (/^\/(malclientid|malapikey) \w+$/i.test(content)) {
        malClientId = /^\S+ (\w+)$/.exec(content)[1];
        saveSettings();
        sendMessage("mal client id set", type, target, true);
    }
}

/**
 * parse incoming dm
 * @param {String} content message text
 * @param {String} sender name of player who sent the message
 */
function parseIncomingDM(content, sender) {
    if (commands) {
        if (socialTab.isFriend(sender)) {
            if (/^\/(fr|forceready)$/i.test(content) && lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
            else if (/^\/(fi|forceinvite)$/i.test(content) && inRoom()) {
                socket.sendCommand({type: "social", command: "invite to game", data: {target: sender}});
            }
            else if (/^\/(fp|fpw|forcepassword)$/i.test(content) && inRoom()) {
                sendMessage(`password: ${hostModal.$passwordInput.val()}`, "dm", sender);
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
            let room = Object.values(roomBrowser.activeRooms).find((r) => r._players.localeIncludes(name));
            if (Number.isInteger(room?.id)) {
                setTimeout(() => sendMessage(`${room._private ? "private" : "public"} room ${room.id}: ${room.settings.roomName}`, "dm", sender), 100);
                setTimeout(() => sendMessage(`host: ${room.host}, players: ${room._numberOfPlayers}, spectators: ${room._numberOfSpectators}`, "dm", sender), 300);
            }
            else {
                setTimeout(() => sendMessage("not found", "dm", sender), 100);
            }
        }
        else if (/^\/room [0-9]+$/i.test(content)) {
            if (Object.keys(roomBrowser.activeRooms).length === 0) return;
            let roomId = /^\S+ ([0-9]+)$/.exec(content)[1];
            if (roomId in roomBrowser.activeRooms) {
                let room = roomBrowser.activeRooms[roomId];
                setTimeout(() => sendMessage(`${room._private ? "private" : "public"} room: ${room.settings.roomName}`, "dm", sender), 100);
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
        sendMessage("0.88", type);
    }
    else if (/^\/forceall roll [0-9]+$/i.test(content)) {
        let number = parseInt(/^\S+ roll ([0-9]+)$/.exec(content)[1]);
        sendMessage(Math.floor(Math.random() * number) + 1, type);
    }
    else if (/^\/forceall roll -?[0-9]+ -?[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ \S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ \S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low), type);
    }
    else if (/^\/forceall mute ?status$/i.test(content)) {
        sendMessage(volumeController.muted ? "🔇" : "🔉 " + Math.round(volumeController.volume * 100) + "%", type);
    }
    else if (/^\/forceall (hide|hidden) ?status$/i.test(content)) {
        sendMessage(hidePlayers, type);
    }
    else if (/^\/forceall speed$/i.test(content)) {
        if (playbackSpeed === null) sendMessage("speed: default", type);
        else sendMessage("speed: " + (Array.isArray(playbackSpeed) ? `random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x` : `${playbackSpeed}x`), type);
    }
    else if (/^\/forceall skip$/i.test(content)) {
        if (!quiz.skipController._toggled) quiz.skipClicked();
    }
    else if (/^\/forceall share ?entries$/i.test(content)) {
        sendMessage(options.$MAl_SHARE_CHECKBOX.prop("checked"), type);
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
        for (let player of Object.values(lobby.players)) {
            let name = player._name;
            let team = player.lobbySlot.$TEAM_DISPLAY_TEXT.text();
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
    if (lobby.inLobby) {
        return Object.values(lobby.players).filter((player) => parseInt(player.lobbySlot.$TEAM_DISPLAY_TEXT.text()) === team).map((player) => player._name);
    }
    if (quiz.inQuiz) {
        return Object.values(quiz.players).filter((player) => player.teamNumber === team).map((player) => player._name);
    }
    if (battleRoyal.inView) {
        return Object.values(battleRoyal.players).filter((player) => player.teamNumber === team).map((player) => player._name);
    }
    return [];
}

// input player name, return their team number
function getTeamNumber(name) {
    if (lobby.inLobby) {
        for (let player of Object.values(lobby.players)) {
            if (player._name === name) {
                return parseInt(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
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
    if (gameChat.open) {
        setTimeout(() => { gameChat.systemMessage(String(message)) }, 1);
    }
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

// input text, return name that matches the closest
function getClosestNameInRoom(text) {
    let re = new RegExp(text, "i");
    let results = getPlayerList().concat(getSpectatorList()).filter((x) => re.test(x));
    return results.length === 1 ? results[0] : text;
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

// input number of milliseconds of delay, leave and rejoin the room you were in
function rejoinRoom(time) {
    if (isSoloMode() || isRankedMode()) return;
    setTimeout(() => {
        if (lobby.inLobby) {
            let id = lobby.gameId;
            let password = hostModal.$passwordInput.val();
            let spec = gameChat.spectators.includes(selfName);
            lobby.leave();
            setTimeout(() => { spec ? roomBrowser.fireSpectateGame(id, password) : roomBrowser.fireJoinLobby(id, password) }, time);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let password = hostModal.$passwordInput.val();
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
    if (autoThrow.text) list.push("Auto Throw: " + autoThrow.text);
    if (autoThrow.multichoice) list.push("Auto Throwing Multi Choice Option: " + autoThrow.multichoice);
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

// switch focus between answer box and chat
function toggleTextInputFocus() {
    setTimeout(() => {
        if (quiz.answerInput.typingInput.$input.is(":focus")) {
            gameChat.$chatInputField.focus();
        }
        else if (gameChat.$chatInputField.is(":focus")) {
            quiz.answerInput.typingInput.$input.focus();
        }
        else {
            gameChat.$chatInputField.focus();
        }
    }, 1);
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
const oldChangeView = ViewChanger.prototype.changeView;
ViewChanger.prototype.changeView = function(newView, arg) {
    oldChangeView.apply(this, arguments);
    if (newView === "lobby") {
        setTimeout(() => {
            checkAutoReady();
            checkAutoStart();
        }, 10);
    }
};

// override newList function for drop down disable
const oldNewList = AutoCompleteController.prototype.newList;
AutoCompleteController.prototype.newList = function() {
    if (this.list.length > 0) animeList = this.list;
    this.list = dropdown ? animeList : [];
    oldNewList.apply(this, arguments);
}

// hide player names and avatars in lobby
function lobbyHidePlayers() {
    $(".lobbyAvatarPlayerOptions").addClass("hide");
    for (let player of Object.values(lobby.players)) {
        if (player._name !== selfName && !player.hidden) {
            player.hidden = true;
            player.textColor = player.lobbySlot.$NAME_CONTAINER.css("color");
            player.lobbySlot.$IS_HOST_CONTAINER.addClass("hide");
            player.lobbySlot.$AVATAR_IMAGE.addClass("hide");
            player.lobbySlot.$NAME_CONTAINER.css("color", "inherit").text("player");
            player.lobbySlot.$LEVEL_CONTAINER.text("");
        }
    }    
}

// unhide player names and avatars in lobby
function lobbyUnhidePlayers() {
    $(".lobbyAvatarPlayerOptions").removeClass("hide");
    for (let player of Object.values(lobby.players)) {
        if (player._name !== selfName) {
            player.hidden = false;
            if (player._host) player.lobbySlot.$IS_HOST_CONTAINER.removeClass("hide");
            player.lobbySlot.$AVATAR_IMAGE.removeClass("hide");
            player.lobbySlot.$NAME_CONTAINER.css("color", player.textColor).text(player._name);
            player.lobbySlot.$LEVEL_CONTAINER.text(player.level);
        }
    }
}

// hide player names and avatars in quiz
function quizHidePlayers() {
    for (let player of Object.values(quiz.players)) {
        if (!player.isSelf && !player.hidden) {
            player.hidden = true;
            player.textColor = player.avatarSlot.$nameContainer.css("color");
            player.avatarSlot.$avatarImage.addClass("hide");
            player.avatarSlot.$backgroundContainer.addClass("hide");
            player.avatarSlot.$nameContainer.css("color", "inherit").text("player");
            player.avatarSlot.$pointContainer.css("color", "inherit");
            player.avatarSlot.$bottomContainer.removeClass("clickAble").off("click");
            player.avatarSlot.$bottomContainer.find(".qpAvatarLevelBar").addClass("hide");
        }
    }
    for (let entry of Object.values(quiz.scoreboard.playerEntries)) {
        if (!entry.isSelf && !entry.hidden) {
            entry.hidden = true;
            entry.name = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").text();
            entry.textColor = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css("color");
            entry.textShadow = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css("text-shadow");
            entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css({"color": "inherit", "text-shadow": "inherit"}).text("player");
        }
    }
}

// unhide player names and avatars in quiz
function quizUnhidePlayers() {
    for (let player of Object.values(quiz.players)) {
        if (!player.isSelf) {
            player.hidden = false;
            player.avatarSlot.$avatarImage.removeClass("hide");
            player.avatarSlot.$backgroundContainer.removeClass("hide");
            player.avatarSlot.$nameContainer.css("color", player.textColor).text(player._name);
            player.avatarSlot.$pointContainer.css("color", player.textColor);
            player.avatarSlot.$bottomContainer.find(".qpAvatarLevelBar").removeClass("hide");
        }
    }
    for (let entry of Object.values(quiz.scoreboard.playerEntries)) {
        if (!entry.isSelf) {
            entry.hidden = false;
            entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css({"color": entry.textColor, "text-shadow": entry.textShadow}).text(entry.name);
        }
    }
}

// input array of genre ids, return anime that satisfies all genres
function genreLookup(inputGenres) {
    for (let anime of Object.keys(dqMap)) {
        if (inputGenres.every((genre) => dqMap[anime].genre.includes(genre))) {
            return anime;
        }
    }
    return null;
}

// change quiz settings to only get a specific anime
function matchSettingsToAnime(anime) {
    if (lobby.inLobby && lobby.isHost && anime in dqMap) {
        let settings = hostModal.getSettings();
        let data = dqMap[anime];
        settings.songSelection.standardValue = 1;
        settings.songSelection.advancedValue = {random: settings.numberOfSongs, unwatched: 0, watched: 0};
        settings.songType.advancedValue = {openings: 0, endings: 0, inserts: 0, random: 20};
        settings.songType.standardValue = {openings: true, endings: true, inserts: true};
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = {seasons: data.seasons, years: data.years};
        settings.genre = data.genre.map((x) => ({id: String(x), state: 1}));
        settings.tags = data.tags ?? [];
        changeGameSettings(settings);
    }
}

// input anilist id, return info json
function getAnimeFromAnilistId(id) {
    let query = `
      query {
        Media (id: ${id}, type: ANIME) {
          title {
            romaji
            english
          }
          season
          seasonYear
          genres
          tags {
            id
            name
          }
        }
      }
    `;
    return fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({query: query})
    }).then((res) => res.json()).then((json) => json.data.Media);
}

// input anilist username, return list of all anime in list
function getAnilistAnimeList(username) {
    let query = `
      query {
        MediaListCollection(userName: "${username}", type: ANIME) {
          lists {
            entries {
              media {
                id
                title {
                  romaji
                  english
                }
              }
            status
            }
          }
        }
      }
    `;
    return fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({query: query})
    }).then((res) => res.json()).then((json) => {
        if (json.errors) return [];
        let list = [];
        for (let item of json.data.MediaListCollection.lists) {
            item.entries.forEach((anime) => { list.push(anime) });
        }
        return list;
    });
}

// input myanimelist username, return list of all anime in list
async function getMALAnimeList(username) {
    let list = [];
    let nextPage = "https://api.myanimelist.net/v2/users/" + username + "/animelist?offset=0&limit=1000&nsfw=true";
    while (nextPage) {
        let result = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: nextPage,
                headers: {"Content-Type": "application/json", "Accept": "application/json", "X-MAL-CLIENT-ID": malClientId},
                onload: (res) => resolve(JSON.parse(res.response)),
                onerror: (res) => reject(res)
            });
        });
        result.data.forEach((anime) => { list.push(anime) });
        nextPage = result.paging.next;
    }
    return list;
}

// apply styles
function applyStyles() {
    $("#megaCommandsStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "megaCommandsStyle";
    let text = "";
    if (backgroundURL) text += `
        #loadingScreen, #gameContainer {
            background-image: url("${backgroundURL}");
        }
        #gameChatPage .col-xs-9 {
            background-image: none;
        }
    `;
    if (hidePlayers) text += `
        .gcUserName:not(.self) {
            display: none;
        }
        .chatBadges:has(+ .gcUserName:not(.self)) {
            display: none;
        }
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}

// save settings
function saveSettings() {
    let settings = {};
    settings.alertHidden = alertHidden;
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
    settings.enableAllProfileButtons = enableAllProfileButtons;
    //settings.hidePlayers = hidePlayers;
    settings.lastUsedVersion = version;
    settings.malClientId = malClientId;
    //settings.muteReplay = muteReplay;
    //settings.muteSubmit = muteSubmit;
    //settings.playbackSpeed = playbackSpeed;
    settings.playerDetection = playerDetection;
    settings.printLoot = printLoot;
    settings.printOffline = printOffline;
    settings.printOnline = printOnline;
    settings.selfDM = selfDM;
    settings.tabSwitch = tabSwitch;
    localStorage.setItem("megaCommands", JSON.stringify(settings));
}
