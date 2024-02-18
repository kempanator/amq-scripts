// ==UserScript==
// @name         AMQ Mega Commands
// @namespace    https://github.com/kempanator
// @version      0.108
// @description  Commands for AMQ Chat
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      myanimelist.net
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js
// ==/UserScript==

/*
IMPORTANT: disable these scripts before installing
- dice roller by thejoseph98/joske2865
- chat commands by nyamu
- auto ready by nyamu
- auto answer on keypress by (unknown)
- command invite by minigamer42
- no dropdown by juvian
- no sample reset by miyuki

GAME SETTINGS
/size [2-40]              change room size
/type [oei]               change song types
/random                   change selection type to random
/unwatched                change selection type to unwatched
/watched                  change selection type to watched
/time [1-60]              change song guess time
/extratime [0-15]         change song guess extra time
/sample [low] [high]      change start sample point
/lives [1-5]              change number of lives
/team [1-8]               change team size
/songs [5-100]            change number of songs
/dif [low] [high]         change difficulty
/vintage [text]           change vintage
/genre [text]             change genre
/tag [text]               change tags

IN GAME/LOBBY
/autoskip                 automatically vote skip at the beginning of each song
/autokey                  automatically submit answer on each key press
/autothrow [text]         automatically send answer at the beginning of each song
/autocopy [name]          automatically copy a team member's answer
/automute [seconds]       automatically mute sound during quiz after # of seconds
/autounmute [seconds]     automatically unmute sound during quiz after # of seconds
/automutetoggle [list]    start unmuted and automatically toggle mute iterating over a list of # of seconds
/automuterandom [time]    automatically mute a random time interval during guess phase
/autounmuterandom [time]  automatically unmute a random time interval during guess phase
/autoready                automatically ready up in lobby
/autostart                automatically start the game when everyone is ready if you are host
/autohost [name]          automatically promote player to host if you are the current host
/autoinvite [name]        automatically invite a player to your room when they log in (only friends)
/autoaccept               automatically accept game invites if you aren't in a room
/autolobby                automatically vote return to lobby when host starts a vote
/ready                    ready/unready in lobby
/invite [name]            invite player to game
/host [name]              promote player to host
/kick [name]              kick player
/skip                     vote skip on current song
/pause                    pause/unpause game
/lobby                    start return to lobby vote
/leave                    leave room
/rejoin [seconds]         leave and rejoin the room you're in after # of seconds
/spec                     change to spectator
/join                     change from spectator to player in lobby
/queue                    join/leave queue
/volume [0-100]           change volume
/quality [text]           change video quality to mp3, 480, 720
/countdown [seconds]      start game after # of seconds
/dropdown                 enable/disable anime dropdown
/dropdownspec             enable dropdown while spectating
/speed [number]           change client-side song playback speed (0.0625 - 16)
/mutereplay               auto mute during the replay phase
/mutesubmit               auto mute after answer submit
/continuesample           continue sample after answer reveal instead of resetting
/loopvideo                loop the video when it ends

OTHER
/roll                     roll number, player, teammate, playerteam, spectator
/shuffle [list]           shuffle a list of anything (separate with commas)
/startvote [list]         start a vote with a list of options (separate with commas)
/stopvote                 stop the vote and print results
/calc [expression]        calculate a math expression
/list [a|m|k] [name]      change anime list
/rules                    show list of gamemodes and rules
/info                     show list of external utilities
/clear                    clear chat
/dm [name] [text]         direct message a player
/profile [name]           show profile window of any player
/password                 reveal private room password
/invisible                show invisible friends
/background [url]         change the background
/logout                   log out
/relog                    log out, log in, and auto join the room you were in
/alerts [type]            toggle alerts
/version                  check the version of this script
/commands [on|off]        turn this script on or off
*/

"use strict";
if (typeof Listener === "undefined") return;
const version = "0.108";
const saveData = validateLocalStorage("megaCommands");
const originalOrder = {qb: [], gm: []};
if (typeof saveData.alerts?.hiddenPlayers === "boolean") delete saveData.alerts;
let alerts = saveData.alerts ?? {};
let animeList;
let animeAutoCompleteLowerCase = [];
let autoAcceptInvite = saveData.autoAcceptInvite ?? false;
if (autoAcceptInvite === true) autoAcceptInvite = "friends";
let autoCopy = saveData.autoCopy ?? "";
let autoDownloadSong = saveData ?? [];
let autoHost = saveData.autoHost ?? "";
let autoInvite = saveData.autoInvite ?? "";
let autoJoinRoom = saveData.autoJoinRoom ?? false;
let autoKey = saveData.autoKey ?? false;
let autoMute = saveData.autoMute ?? {mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: null};
let autoReady = saveData.autoReady ?? false;
let autoStart = saveData.autoStart ?? false;
let autoStatus = saveData.autoStatus ?? "";
let autoSwitch = saveData.autoSwitch ?? "";
let autoThrow = saveData.autoThrow ?? {time: [], text: null, multichoice: null};
let autoVoteLobby = saveData.autoVoteLobby ?? false;
let autoVoteSkip = saveData.autoVoteSkip ?? [];
let backgroundURL = saveData.backgroundURL ?? "";
let commandPersist = saveData.commandPersist ?? {};
let commands = saveData.commands ?? true;
let continueSample = saveData.continueSample ?? false;
let countdown = null;
let countdownInterval;
let dropdown = saveData.dropdown ?? true;
let dropdownInSpec = saveData.dropdownInSpec ?? false;
let enableAllProfileButtons = saveData.enableAllProfileButtons ?? true;
let hidePlayers = saveData.hidePlayers ?? false;
let hotKeys = saveData.hotKeys ?? {};
let lastUsedVersion = saveData.lastUsedVersion ?? null;
let loopVideo = saveData.loopVideo ?? false;
let malClientId = saveData.malClientId ?? "";
let muteReplay = saveData.muteReplay ?? false;
let muteSubmit = saveData.muteSubmit ?? false;
let playbackSpeed = saveData.playbackSpeed ?? [];
let playerDetection = saveData.playerDetection ?? {invisible: false, players: []};
let printLoot = saveData.printLoot ?? false;
let reorder = saveData.reorder ?? {quizBar: false, quizBarList: [], gearMenu: false, gearMenuList: []};
let selfDM = saveData.selfDM ?? false;
let tabSwitch = saveData.tabSwitch ?? 0; //0: off, 1: chat first, 2: answerbox first, 3: only chat, 4: only answerbox
let voteOptions = {};
let votes = {};

alerts.hiddenPlayers = saveData.alerts?.hiddenPlayers ?? {chat: true, popout: true};
alerts.nameChange = saveData.alerts?.nameChange ?? {chat: true, popout: true};
alerts.onlineFriends = saveData.alerts?.onlineFriends ?? {chat: false, popout: false};
alerts.offlineFriends = saveData.alerts?.offlineFriends ?? {chat: false, popout: false};
alerts.serverStatus = saveData.alerts?.serverStatus ?? {chat: false, popout: false};

commandPersist.autoAcceptInvite = saveData.commandPersist?.autoAcceptInvite ?? true;
commandPersist.autoCopy = saveData.commandPersist?.autoCopy ?? false;
commandPersist.autoDownloadSong = saveData.commandPersist?.autoDownloadSong ?? false;
commandPersist.autoHost = saveData.commandPersist?.autoHost ?? false;
commandPersist.autoInvite = saveData.commandPersist?.autoInvite ?? false;
commandPersist.autoKey = saveData.commandPersist?.autoKey ?? true;
commandPersist.autoMute = saveData.commandPersist?.autoMute ?? false;
commandPersist.autoReady = saveData.commandPersist?.autoReady ?? true;
commandPersist.autoStart = saveData.commandPersist?.autoStart ?? false;
commandPersist.autoStatus = saveData.commandPersist?.autoStatus ?? true;
commandPersist.autoSwitch = saveData.commandPersist?.autoSwitch ?? false;
commandPersist.autoThrow = saveData.commandPersist?.autoThrow ?? false;
commandPersist.autoVoteLobby = saveData.commandPersist?.autoVoteLobby ?? true;
commandPersist.autoVoteSkip = saveData.commandPersist?.autoVoteSkip ?? false;
commandPersist.continueSample = saveData.commandPersist?.continueSample ?? true;
commandPersist.dropdown = saveData.commandPersist?.dropdown ?? true;
commandPersist.dropdownInSpec = saveData.commandPersist?.dropdownInSpec ?? true;
commandPersist.loopVideo = saveData.commandPersist?.loopVideo ?? true;
commandPersist.muteReplay = saveData.commandPersist?.muteReplay ?? true;
commandPersist.muteSubmit = saveData.commandPersist?.muteSubmit ?? true;
commandPersist.playbackSpeed = saveData.commandPersist?.playbackSpeed ?? false;

hotKeys.autoKey = saveData.hotKeys?.autoKey ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.dropdown = saveData.hotKeys?.dropdown ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.mute = saveData.hotKeys?.mute ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.ready = saveData.hotKeys?.ready ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.joinSpectate = saveData.hotKeys?.joinSpectate ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.start = saveData.hotKeys?.start ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.leave = saveData.hotKeys?.leave ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.rejoin = saveData.hotKeys?.rejoin ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.lobby = saveData.hotKeys?.lobby ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.pause = saveData.hotKeys?.pause ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.voteSkip = saveData.hotKeys?.voteSkip ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.relog = saveData.hotKeys?.relog ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.mcHelpWindow = saveData.hotKeys?.mcHelpWindow ?? {altKey: false, ctrlKey: false, key: ""};
hotKeys.songHistoryWindow = saveData.hotKeys?.songHistoryWindow ?? {altKey: false, ctrlKey: false, key: ""};

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
    "highlightfriends": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqHighlightFriends.user.js",
    "notificationsounds": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqNotificationSounds.user.js",
    "songlistui": "https://github.com/joske2865/AMQ-Scripts/raw/master/amqSongListUI.user.js",
    "answertime": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js",
    "speedrun": "https://github.com/joske2865/AMQ-Scripts/raw/master/amqSpeedrun.user.js",
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js",
    "answerstats": "https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js",
    "chatplus": "https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js",
    "customsonglistgame" : "https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js",
    "megacommands": "https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js",
    "newgamemodeui": "https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js",
    "quickloadlists": "https://github.com/kempanator/amq-scripts/raw/main/amqQuickLoadLists.user.js",
    "showroomplayers": "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js",
    "elodiestyle": "https://userstyles.world/style/1435"
};
const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};
const dqMap = {
    "Naruto": {genre: [1, 2, 3, 4, 6, 17], years: [2002, 2002], seasons: [3, 3]},
    "Neon Genesis Evangelion": {genre: [1, 4, 9, 11, 12, 14], years: [1995, 1995], seasons: [3, 3]},
    "Gintama": {genre: [1, 3, 4, 14], tags: [39], years: [2006, 2006], seasons: [1, 1]},
    "Detective Conan": {genre: [2, 3, 11, 12], years: [1996, 1996], seasons: [0, 0]},
    "BECK: Mongolian Chop Squad": {genre: [3, 4, 10, 15], years: [2004, 2004], seasons: [3, 3]},
    "Initial D": {genre: [1, 4, 16], years: [1998, 1998], seasons: [1, 1]},
    "Negima!?": {genre: [2, 3, 5, 6, 13], years: [2006, 2006], seasons: [3, 3]},
    "Urusei Yatsura": {genre: [3, 4, 13, 14, 15], years: [1981, 1981], seasons: [3, 3]},
    "Touch": {genre: [4, 13, 15, 16], years: [1985, 1985], seasons: [1, 1]},
    "Code Geass: Lelouch of the Rebellion Remake Movies": {genre: [1, 4, 9, 14, 18], years: [2017, 2018], seasons: [3, 1]},
    "Chainsaw Man": {genre: [1, 4, 7, 17], tags: [1090], years: [2022, 2022], seasons: [3, 3]},
    "Senki Zesshou Symphogear GX": {genre: [1, 4, 8, 10, 14], years: [2015, 2015], seasons: [2, 2]},
    "Ojamajo Doremi Dokkaan!": {genre: [3, 4, 6, 8, 15], years: [2002, 2002], seasons: [0, 0]},
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
    "NieR:Automata Ver1.1a": {genre: [1, 4, 6, 12, 14], years: [2023, 2023], seasons: [0, 0]},
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
    "Hikaru no Go": {genre: [3, 16, 17], years: [2001, 2001], seasons: [3, 3]},
    "Akame ga Kill!": {genre: [1, 2, 4, 6, 7, 12, 18], years: [2014, 2014], seasons: [2, 2]},
    "Magical Girl Site": {genre: [1, 4, 7, 8, 12, 17], years: [2018, 2018], seasons: [1, 1]},
    "Made in Abyss": {genre: [2, 4, 6, 7, 11, 14], years: [2017, 2017], seasons: [2, 2]},
    "Girls' Last Tour": {genre: [2, 14, 15], years: [2017, 2017], seasons: [3, 3]},
    "Mirai Nikki": {genre: [1, 7, 11, 12, 17, 18], years: [2011, 2011], seasons: [3, 3]},
    "MF Ghost": {genre: [14, 16], years: [2023, 2023], seasons: [3, 3]}
};

if (document.querySelector("#loginPage")) {
    if (autoJoinRoom.autoLogIn && $(".swal2-title").text() === "Account Already Online") {
        setTimeout(() => { $(".swal2-confirm").trigger("click") }, 100);
    }
    return;
}
else if (typeof Listener === "undefined") {
    return;
}
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
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
    if (loopVideo) {
        for (let videoPlayer of quizVideoController.moePlayers) {
            videoPlayer.$player[0].loop = true;
        }
    }
    if (autoStatus === "do not disturb") socialTab.socialStatus.changeSocialStatus(2);
    else if (autoStatus === "away") socialTab.socialStatus.changeSocialStatus(3);
    else if (autoStatus === "offline" || autoStatus === "invisible") socialTab.socialStatus.changeSocialStatus(4);
    document.body.addEventListener("keydown", (event) => {
        const key = event.key;
        const which = event.which;
        const altKey = event.altKey;
        const ctrlKey = event.ctrlKey;
        if (which === 9) {
            if (tabSwitch && quiz.inQuiz) {
                toggleTextInputFocus();
            }
        }
        if (testHotkey("autoKey", key, altKey, ctrlKey)) {
            autoKey = !autoKey;
            saveSettings();
            sendSystemMessage(`auto key ${autoKey ? "enabled" : "disabled"}`);
        }
        if (testHotkey("dropdown", key, altKey, ctrlKey)) {
            dropdown = !dropdown;
            saveSettings();
            sendSystemMessage(`dropdown ${dropdown ? "enabled" : "disabled"}`);
            quiz.answerInput.typingInput.autoCompleteController.newList();
        }
        if (testHotkey("mute", key, altKey, ctrlKey)) {
            volumeController.setMuted(!volumeController.muted);
            volumeController.adjustVolume();
        }
        if (testHotkey("ready", key, altKey, ctrlKey)) {
            if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
        }
        if (testHotkey("joinSpectate", key, altKey, ctrlKey)) {
            if (lobby.inLobby) {
                if (lobby.isSpectator) {
                    socket.sendCommand({type: "lobby", command: "change to player"});
                }
                else {
                    lobby.changeToSpectator(selfName);
                }
            }
        }
        if (testHotkey("start", key, altKey, ctrlKey)) {
            if (lobby.inLobby && lobby.isHost) {
                lobby.fireMainButtonEvent(true);
            }
            else if (nexus.inNexusLobby) {
                socket.sendCommand({
                    type: "nexus",
                    command: "start dungeon lobby",
                    data: nexus.cityController.dungeonSelectionWindow.dungeonSetupTab.settingDescription
                });
            }
        }
        if (testHotkey("leave", key, altKey, ctrlKey)) {
            if (lobby.inLobby || quiz.inQuiz) {
                if (isRankedMode()) {
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                }
                else {
                    setTimeout(() => { viewChanger.changeView("roomBrowser") }, 1);
                }
            }
        }
        if (testHotkey("rejoin", key, altKey, ctrlKey)) {
            if (lobby.inLobby || quiz.inQuiz) {
                rejoinRoom(100);
            }
        }
        if (testHotkey("lobby", key, altKey, ctrlKey)) {
            if (quiz.inQuiz && quiz.isHost) {
                socket.sendCommand({type: "quiz", command: "start return lobby vote"});
            }
        }
        if (testHotkey("pause", key, altKey, ctrlKey)) {
            if (quiz.inQuiz) {
                socket.sendCommand({type: "quiz", command: "quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause")});
            }
        }
        if (testHotkey("voteSkip", key, altKey, ctrlKey)) {
            if (quiz.inQuiz && !quiz.skipController._toggled) {
                quiz.skipClicked();
            }
        }
        if (testHotkey("relog", key, altKey, ctrlKey)) {
            relog();
        }
        if (testHotkey("mcHelpWindow", key, altKey, ctrlKey)) {
            $("#mcSettingsModal").is(":visible") ? $("#mcSettingsModal").modal("hide") : $("#mcSettingsModal").modal("show");
        }
        if (testHotkey("songHistoryWindow", key, altKey, ctrlKey)) {
            songHistoryWindow.trigger();
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
        if (playbackSpeed.length) {
            let speed = playbackSpeed.length === 1 ? playbackSpeed[0] : Math.random() * (playbackSpeed[1] - playbackSpeed[0]) + playbackSpeed[0];
            quizVideoController.moePlayers.forEach((moePlayer) => { moePlayer.playbackRate = speed });
        }
        if (muteReplay || muteSubmit) {
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (autoThrow.time.length) {
                if (autoThrow.text) {
                    if (autoThrow.time.length === 1) {
                        setTimeout(() => { quiz.answerInput.setNewAnswer(autoThrow.text) }, autoThrow.time[0]);
                    }
                    else if (autoThrow.time.length === 2) {
                        setTimeout(() => { quiz.answerInput.setNewAnswer(autoThrow.text) }, Math.floor(Math.random() * (autoThrow.time[1] - autoThrow.time[0] + 1)) + autoThrow.time[0]);
                    }
                }
                else if (autoThrow.multichoice && quiz.answerInput.multipleChoice.displayed) {
                    let index = autoThrow.multichoice === "random" ? Math.floor(Math.random() * 4) : autoThrow.multichoice - 1;
                    if (autoThrow.time.length === 1) {
                        setTimeout(() => { quiz.answerInput.multipleChoice.handleClick(quiz.answerInput.multipleChoice.answerOptions[index]) }, autoThrow.time[0]);
                    }
                    else if (autoThrow.time.length === 2) {
                        setTimeout(() => { quiz.answerInput.multipleChoice.handleClick(quiz.answerInput.multipleChoice.answerOptions[index]) }, Math.floor(Math.random() * (autoThrow.time[1] - autoThrow.time[0] + 1)) + autoThrow.time[0]);
                    }
                }
            }
            if (Array.isArray(autoVoteSkip)) {
                if (autoVoteSkip.length === 1) {
                    setTimeout(() => { if (!quiz.skipController._toggled) quiz.skipClicked() }, autoVoteSkip[0]);
                }
                else if (autoVoteSkip.length === 2) {
                    setTimeout(() => { if (!quiz.skipController._toggled) quiz.skipClicked() }, Math.floor(Math.random() * (autoVoteSkip[1] - autoVoteSkip[0] + 1)) + autoVoteSkip[0]);
                }
            }
        }
        if (autoMute.mute.length) {
            let time = autoMute.mute.length === 1 ? autoMute.mute[0] : Math.floor(Math.random() * (autoMute.mute[1] - autoMute.mute[0] + 1)) + autoMute.mute[0];
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                $("#qpVolume").addClass("disabled");
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, time);
        }
        else if (autoMute.unmute.length) {
            let time = autoMute.unmute.length === 1 ? autoMute.unmute[0] : Math.floor(Math.random() * (autoMute.unmute[1] - autoMute.unmute[0] + 1)) + autoMute.unmute[0];
            $("#qpVolume").addClass("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            setTimeout(() => {
                $("#qpVolume").removeClass("disabled");
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }, time);
        }
        else if (autoMute.toggle.length) {
            $("#qpVolume").addClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            autoMute.toggle.forEach((value, index) => {
                if (index % 2 === 0) {
                    setTimeout(() => {
                        volumeController.setMuted(true);
                        volumeController.adjustVolume();
                    }, value);
                }
                else {
                    setTimeout(() => {
                        volumeController.setMuted(false);
                        volumeController.adjustVolume();
                    }, value);
                }
            });
        }
        else if (autoMute.randomMute) {
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            let maxTime = (payload.time * 1000) - autoMute.randomMute;
            let time = Math.floor(Math.random() * maxTime);
            if (maxTime > 0) {
                setTimeout(() => {
                    $("#qpVolume").addClass("disabled");
                    volumeController.setMuted(true);
                    volumeController.adjustVolume();
                }, time);
                setTimeout(() => {
                    $("#qpVolume").removeClass("disabled");
                    volumeController.setMuted(false);
                    volumeController.adjustVolume();
                }, time + autoMute.randomMute);
            }
        }
        else if (autoMute.randomUnmute) {
            $("#qpVolume").addClass("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            let maxTime = (payload.time * 1000) - autoMute.randomUnmute;
            let time = Math.floor(Math.random() * maxTime);
            if (maxTime > 0) {
                setTimeout(() => {
                    $("#qpVolume").removeClass("disabled");
                    volumeController.setMuted(false);
                    volumeController.adjustVolume();
                }, time);
                setTimeout(() => {
                    $("#qpVolume").addClass("disabled");
                    volumeController.setMuted(true);
                    volumeController.adjustVolume();
                }, time + autoMute.randomUnmute);
            }
        }
        if (dropdownInSpec && quiz.isSpectator) {
            setTimeout(() => {
                if (!quiz.answerInput.typingInput.autoCompleteController.list.length) quiz.answerInput.typingInput.autoCompleteController.updateList();
                $("#qpAnswerInput").removeAttr("disabled").val("");
            }, 1);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (autoVoteSkip === "valid") sendSystemMessage("Auto Vote Skip: on first valid answer");
        else if (autoVoteSkip.length) sendSystemMessage("Auto Vote Skip: Enabled");
        if (autoKey) sendSystemMessage("Auto Key: Enabled");
        if (autoCopy) sendSystemMessage("Auto Copy: " + autoCopy);
        if (autoThrow.text) sendSystemMessage("Auto Throw: " + autoThrow.text);
        if (autoThrow.multichoice) sendSystemMessage("Auto Throwing Multi Choice Option: " + autoThrow.multichoice);
        if (autoMute.mute.length === 1) sendSystemMessage(`Auto Mute: ${autoMute.mute[0] / 1000}s`);
        else if (autoMute.mute.length === 2) sendSystemMessage(`Auto Mute: random ${autoMute.mute[0] / 1000}s - ${autoMute.mute[1] / 1000}s`);
        else if (autoMute.unmute.length === 1) sendSystemMessage(`Auto Unmute: ${autoMute.unmute[0] / 1000}s`);
        else if (autoMute.unmute.length === 2) sendSystemMessage(`Auto Unmute: random ${autoMute.unmute[0] / 1000}s - ${autoMute.unmute[1] / 1000}s`);
        else if (autoMute.toggle.length) sendSystemMessage(`Auto Mute Toggle: ${autoMute.toggle.map((x) => x / 1000).join(", ")}`);
        else if (autoMute.randomMute) sendSystemMessage(`Auto Mute Random: ${autoMute.randomMute / 1000}s`);
        else if (autoMute.randomUnmute) sendSystemMessage(`Auto Unmute Random: ${autoMute.randomUnmute / 1000}s`);
        if (muteReplay) sendSystemMessage("Mute During Replay Phase: Enabled");
        if (muteSubmit) sendSystemMessage("Mute After Submit: Enabled");
        if (playbackSpeed.length === 1) sendSystemMessage(`Song Playback Speed: ${playbackSpeed[0]}x`);
        else if (playbackSpeed.length === 2) sendSystemMessage(`Song Playback Speed: random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x`);
        if (autoDownloadSong.length) sendSystemMessage("Auto Download Song: " + autoDownloadSong.join(", "));
        if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (autoCopy && autoCopy === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let currentText = $("#qpAnswerInput").val();
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(currentText);
        }
        if (autoVoteSkip === "valid" && !quiz.skipController._toggled && animeAutoCompleteLowerCase.includes(payload.answer.toLowerCase())) {
            quiz.skipClicked();
        }
    }).bindListener();
    new Listener("guess phase over", (payload) => {
        if (autoMute.mute.length || autoMute.unmute.length || autoMute.toggle.length || autoMute.randomMute || autoMute.randomUnmute) {
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
        if (autoMute.mute.length || autoMute.unmute.length || autoMute.toggle.length || autoMute.randomMute || autoMute.randomUnmute) {
            $("#qpVolume").removeClass("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
        if (muteReplay) {
            volumeController.setMuted(true);
            volumeController.adjustVolume();
        }
        if (autoDownloadSong.length) {
            if (autoDownloadSong.includes("video")) {
                downloadSong(formatURL(payload.songInfo.videoTargetMap.catbox?.[720] || payload.songInfo.videoTargetMap.catbox?.[480]));
            }
            else {
                if (autoDownloadSong.includes("720")) {
                    downloadSong(formatURL(payload.songInfo.videoTargetMap.catbox?.[720]));
                }
                if (autoDownloadSong.includes("480")) {
                    downloadSong(formatURL(payload.songInfo.videoTargetMap.catbox?.[480]));
                }
            }
            if (autoDownloadSong.includes("mp3")) {
                downloadSong(formatURL(payload.songInfo.videoTargetMap.catbox?.[0]));
            }
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
            let lootNames = battleRoyal.collectionController.entries.map((entry) => entry.$entry.text().substring(2));
            sendSystemMessage(`Loot: ${battleRoyal.collectionController.entries.length}/${battleRoyal.collectionController.size}`, lootNames.join("<br>"));
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
        if (alerts.hiddenPlayers.chat) {
            sendSystemMessage("Player Hidden: " + payload.name);
        }
        if (alerts.hiddenPlayers.popout) {
            popoutMessages.displayStandardMessage("Player Hidden", payload.name);
        }
    }).bindListener();
    new Listener("Player Ready Change", (payload) => {
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
        if (autoAcceptInvite && !inRoom()) {
            if (autoAcceptInvite === "all") {
                roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
            }
            else if (autoAcceptInvite === "friends" && socialTab.isFriend(payload.sender)) {
                roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
            }
            else if (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())) {
                roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
            }
        }
    }).bindListener();
    new Listener("friend state change", (payload) => {
        if (payload.online && autoInvite === payload.name.toLowerCase() && inRoom() && !isInYourRoom(autoInvite) && !isSoloMode() && !isRankedMode()) {
            sendSystemMessage(payload.name + " online: auto inviting");
            setTimeout(() => { socket.sendCommand({type: "social", command: "invite to game", data: {target: payload.name}}) }, 1000);
        }
        else if (alerts.onlineFriends.chat && payload.online) {
            sendSystemMessage(payload.name + " online");
        }
        else if (alerts.offlineFriends.chat && !payload.online) {
            sendSystemMessage(payload.name + " offline");
        }
        if (alerts.onlineFriends.popout && payload.online) {
            popoutMessages.displayStandardMessage(payload.name + " online", "");
        }
        else if (alerts.offlineFriends.popout && !payload.online) {
            popoutMessages.displayStandardMessage(payload.name + " offline", "");
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
        if (autoAcceptInvite && !inRoom()) {
            if (autoAcceptInvite === "all") {
                socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: payload.lobbyId}});
            }
            else if (autoAcceptInvite === "friends" && socialTab.isFriend(payload.sender)) {
                socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: payload.lobbyId}});
            }
            else if (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(payload.sender.toLowerCase())) {
                socket.sendCommand({type: "nexus", command: "join dungeon lobby", data: {lobbyId: payload.lobbyId}});
            }
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
        if (alerts.nameChange.chat) {
            sendSystemMessage(`friend name change: ${payload.oldName} => ${payload.newName}`);
        }
        if (alerts.nameChange.popout) {
            popoutMessages.displayStandardMessage("friend name change", payload.oldName + " => " + payload.newName);
        }
    }).bindListener();
    new Listener("get all song names", () => {
        setTimeout(() => {
            animeAutoCompleteLowerCase = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 10);
    }).bindListener();
    new Listener("update all song names", () => {
        setTimeout(() => {
            animeAutoCompleteLowerCase = quiz.answerInput.typingInput.autoCompleteController.list.map(x => x.toLowerCase());
        }, 10);
    }).bindListener();
    new Listener("server state change", (payload) => {
        if (alerts.serverStatus.chat) {
            sendSystemMessage(`Server Status: ${payload.name} ${payload.online ? "online" : "offline"}`);
        }
        if (alerts.serverStatus.popout) {
            popoutMessages.displayStandardMessage("Server Status", `${payload.name} ${payload.online ? "online" : "offline"}`);
        }
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

    $("#gameContainer").append($(`
        <div class="modal fade tab-modal" id="mcSettingsModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header" style="padding: 3px 0 0 0">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">×</span>
                        </button>
                        <h4 class="modal-title">Mega Commands</h4>
                        <div class="tabContainer">
                            <div id="mcDocumentationTab" class="tab clickAble">
                                <h5>Commands</h5>
                            </div>
                            <div id="mcActiveTab" class="tab clickAble selected">
                                <h5>Active</h5>
                            </div>
                            <div id="mcHotkeyTab" class="tab clickAble">
                                <h5>Hotkey</h5>
                            </div>
                            <div id="mcAlertsTab" class="tab clickAble">
                                <h5>Alerts</h5>
                            </div>
                            <div id="mcOrderTab" class="tab clickAble">
                                <h5>Order</h5>
                            </div>
                            <div id="mcInfoTab" class="tab clickAble" style="width: 45px; margin-right: -10px; padding-right: 8px; float: right;">
                                <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; max-height: calc(100vh - 150px);">
                        <div id="mcDocumentationContainer" style="height: 500px; margin-top: 10px;">
                        </div>
                        <div id="mcActiveContainer" style="margin: 10px 0;">
                            <div class="mcCommandRow">
                                <button id="mcAutoReadyButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Ready</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoStartButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Start</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoAcceptInviteButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Accept Invite</span>
                                <select id="mcAutoAcceptInviteSelect" style="padding: 3px 0;">
                                    <option>friends</option>
                                    <option>all</option>
                                    <option>list</option>
                                </select>
                                <input id="mcAutoAcceptInviteInput" type="text" placeholder="players" style="width: 250px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoStatusButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Status</span>
                                <select id="mcAutoStatusSelect" style="padding: 3px 0;">
                                    <option>do not disturb</option>
                                    <option>away</option>
                                    <option>offline</option>
                                </select>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoKeyButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Key</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoThrowButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Throw</span>
                                <select id="mcAutoThrowSelect" style="padding: 3px 0;">
                                    <option>text</option>
                                    <option>multichoice</option>
                                </select>
                                <input id="mcAutoThrowTimeInput" type="text" placeholder="time" style="width: 50px;">
                                <input id="mcAutoThrowTextInput" type="text" placeholder="text" style="width: 250px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoCopyButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Copy</span>
                                <input id="mcAutoCopyInput" type="text" placeholder="player" style="width: 150px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoHostButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Host</span>
                                <input id="mcAutoHostInput" type="text" placeholder="player" style="width: 150px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoVoteSkipButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Vote Skip</span>
                                <select id="mcAutoVoteSkipSelect" style="padding: 3px 0;">
                                    <option>time</option>
                                    <option>valid</option>
                                </select>
                                <input id="mcAutoVoteSkipTimeInput" type="text" placeholder="time" style="width: 50px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoVoteLobbyButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Vote Lobby</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcAutoMuteButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Auto Mute</span>
                                <select id="mcAutoMuteSelect" style="padding: 3px 0;">
                                    <option>mute</option>
                                    <option>unmute</option>
                                    <option>toggle</option>
                                    <option>random mute</option>
                                    <option>random unmute</option>
                                </select>
                                <input id="mcAutoMuteTimeInput" type="text" placeholder="time" style="width: 50px;">
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcMuteSubmitButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Mute Submit</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcMuteReplayButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Mute Replay</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcContinueSampleButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Continue Sample</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcLoopVideoButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Loop Video</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcDropDownButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Drop Down</span>
                            </div>
                            <div class="mcCommandRow">
                                <button id="mcDropDownInSpecButton" class="btn mcCommandButton"></button>
                                <span class="mcCommandTitle">Drop Down In Spec</span>
                            </div>
                        </div>
                        <div id="mcHotkeyContainer" style="margin: 10px 0;">
                            <table id="mcHotkeyTable">
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
                        <div id="mcAlertsContainer" style="margin: 10px 0;">
                        <table id="mcAlertsTable">
                            <thead>
                                <tr>
                                    <th>Alert</th>
                                    <th>Popout</th>
                                    <th>Chat</th>
                                </tr>
                            </thead>
                            <tbody>
                            </tbody>
                        </table>
                        </div>
                        <div id="mcOrderContainer" style="margin: 10px 0;">
                            <h4 class="text-center">Reorganize Icons/Settings</h4>
                            <table id="mcOrderTable" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th>
                                            <span style="font-size: 18px; font-weight: bold; margin-right: 10px;">Quiz Bar</span>
                                            <div class="customCheckbox"><input type="checkbox" id="mcOrderQuizBarCheckbox"><label for="mcOrderQuizBarCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>
                                            <button id="mcOrderQuizBarResetButton" class="btn btn-danger" style="margin: 0 0 0 7px; padding: 0 5px; vertical-align: top;"><i class="fa fa-trash" aria-hidden="true"></i></button>
                                        </th>
                                        <th>
                                            <span style="font-size: 18px; font-weight: bold; margin-right: 10px;">Gear Menu</span>
                                            <div class="customCheckbox"><input type="checkbox" id="mcOrderGearMenuCheckbox"><label for="mcOrderGearMenuCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>
                                            <button id="mcOrderGearMenuResetButton" class="btn btn-danger" style="margin: 0 0 0 7px; padding: 0 5px; vertical-align: top;"><i class="fa fa-trash" aria-hidden="true"></i></button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><ul id="mcOrderQuizBarList"></ul>
                                        <td><ul id="mcOrderGearMenuList"></ul>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div id="mcInfoContainer" style="text-align: center; margin: 20px 0;">
                            <h4>Script Info</h4>
                            <div>Created by: kempanator</div>
                            <div>Version: ${version}</div>
                            <div><a href="https://github.com/kempanator/amq-scripts/blob/main/amqMegaCommands.user.js" target="blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js" target="blank">Install</a></div>
                            <h4 style="margin-top: 20px;">Local Storage</h4>
                            <div style="margin: 10px 0"><button id="mcLocalStorageImportButton" style="color: black; margin-right: 10px;">Import</button><button id="mcLocalStorageExportButton" style="color: black; margin-right: 10px;">Export</button><button id="mcLocalStorageClearButton" style="color: black;">Clear</button></div>
                            <h4 style="margin-top: 20px;">MAL Client ID</h4>
                            <div style="margin: 10px 0"><input id="mcMalClientIdInput" type="text" style="width: 300px; color: black;"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="mcExitButton" class="btn btn-default" data-dismiss="modal">Exit</button>
                    </div>
                </div>
            </div>
        </div>
    `));

    $("#mcActiveTab").click(() => {
        tabReset();
        $("#mcActiveTab").addClass("selected");
        $("#mcActiveContainer").show();
    });
    $("#mcHotkeyTab").click(() => {
        tabReset();
        $("#mcHotkeyTab").addClass("selected");
        $("#mcHotkeyContainer").show();
    });
    $("#mcDocumentationTab").click(() => {
        tabReset();
        $("#mcDocumentationTab").addClass("selected");
        $("#mcDocumentationContainer").show();
    });
    $("#mcAlertsTab").click(() => {
        tabReset();
        $("#mcAlertsTab").addClass("selected");
        $("#mcAlertsContainer").show();
    });
    $("#mcOrderTab").click(() => {
        tabReset();
        $("#mcOrderTab").addClass("selected");
        $("#mcOrderContainer").show();
    });
    $("#mcInfoTab").click(() => {
        tabReset();
        $("#mcInfoTab").addClass("selected");
        $("#mcInfoContainer").show();
    });

    $("#mcAutoReadyButton").click(function() {
        autoReady = !autoReady;
        saveSettings();
        sendSystemMessage(`auto ready ${autoReady ? "enabled" : "disabled"}`);
        checkAutoReady();
        toggleCommandButton($(this), autoReady);
    });
    $("#mcAutoStartButton").click(function() {
        autoStart = !autoStart;
        sendSystemMessage(`auto start game ${autoStart ? "enabled" : "disabled"}`);
        checkAutoStart();
        toggleCommandButton($(this), autoStart);
    });
    $("#mcAutoAcceptInviteButton").click(function() {
        if ($(this).text() === "Off") {
            let option = $("#mcAutoAcceptInviteSelect").val();
            if (option === "all") {
                autoAcceptInvite = "all";
                saveSettings();
                sendSystemMessage("auto accept invite from everyone");
                toggleCommandButton($(this), autoAcceptInvite);
            }
            else if (option === "friends") {
                autoAcceptInvite = "friends";
                saveSettings();
                sendSystemMessage("auto accept invite from friends");
                toggleCommandButton($(this), autoAcceptInvite);
            }
            else if (option === "list") {
                let list = $("#mcAutoAcceptInviteInput").val().toLowerCase().split(/[, ]+/).filter(Boolean);
                if (list.length) {
                    autoAcceptInvite = list;
                    saveSettings();
                    sendSystemMessage(`auto accept invite only from ${autoAcceptInvite.join(", ")}`);
                    toggleCommandButton($(this), autoAcceptInvite);
                }
            }
        }
        else {
            autoAcceptInvite = false;
            saveSettings();
            sendSystemMessage("auto accept invite disabled");
            toggleCommandButton($(this), autoAcceptInvite);
        }
    });
    $("#mcAutoAcceptInviteSelect").on("change", function() {
        if ($(this).val() === "list") {
            $("#mcAutoAcceptInviteInput").show();
        }
        else {
            $("#mcAutoAcceptInviteInput").hide();
        }
    });
    $("#mcAutoStatusButton").click(function() {
        if ($(this).text() === "Off") {
            autoStatus = $("#mcAutoStatusSelect").val();
            sendSystemMessage(`auto status set to ${autoStatus}`);
        }
        else {
            autoStatus = "";
            sendSystemMessage(`auto status removed`);
        }
        saveSettings();
        toggleCommandButton($(this), autoStatus);
    });
    $("#mcAutoKeyButton").click(function() {
        autoKey = !autoKey;
        saveSettings();
        sendSystemMessage(`auto key ${autoKey ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), autoKey);
    });
    $("#mcAutoThrowButton").click(function() {
        if ($(this).text() === "Off") {
            let option = $("#mcAutoThrowSelect").val();
            let time = $("#mcAutoThrowTimeInput").val();
            let text = $("#mcAutoThrowTextInput").val();
            if (!text) return;
            if (time) {
                time = time.split(/[ ,-]+/).map((x) => parseFloat(x));
                if (!time.length || time.some((x) => isNaN(x))) return;
            }
            else {
                $("#mcAutoThrowTimeInput").val("0");
                time = [0];
            }
            let milliseconds = time.map((x) => Math.floor(x * 1000));
            if (option === "text") {
                autoThrow = {time: milliseconds, text: text, multichoice: null};
                sendSystemMessage(getAutoThrowStatus());
                toggleCommandButton($(this), true);
            }
            else if (option === "multichoice") {
                if (/^(r|random)$/i.test(text)) {
                    autoThrow = {time: milliseconds, text: null, multichoice: "random"};
                    sendSystemMessage(getAutoThrowStatus());
                    toggleCommandButton($(this), true);
                }
                else if (/^[1-4]$/i.test(text)) {
                    autoThrow = {time: milliseconds, text: null, multichoice: parseInt(text)};
                    sendSystemMessage(getAutoThrowStatus());
                    toggleCommandButton($(this), true);
                }
            }
        }
        else {
            autoThrow = {time: [], text: null, multichoice: null};
            sendSystemMessage("auto throw disabled");
            toggleCommandButton($(this), false);
        }
    });
    $("#mcAutoThrowSelect").on("change", function() {
        if ($(this).val() === "text") {
            $("#mcAutoThrowTextInput").attr("placeholder", "text");
        }
        else if ($(this).val() === "multichoice") {
            $("#mcAutoThrowTextInput").attr("placeholder", "option (1-4)");
        }
    });
    $("#mcAutoCopyButton").click(function() {
        if ($(this).text() === "Off") {
            let text = $("#mcAutoCopyInput").val().toLowerCase();
            if (text) {
                autoCopy = text;
                sendSystemMessage(`auto copying ${text}`);
                toggleCommandButton($(this), true);
            }
        }
        else {
            autoCopy = "";
            sendSystemMessage("auto copy disabled");
            toggleCommandButton($(this), false);
        }
    });
    $("#mcAutoHostButton").click(function() {
        if ($(this).text() === "Off") {
            let text = $("#mcAutoHostInput").val().toLowerCase();
            if (text) {
                autoHost = text;
                sendSystemMessage(`auto hosting ${text}`);
                toggleCommandButton($(this), true);
            }
        }
        else {
            autoHost = "";
            sendSystemMessage("auto host disabled");
            toggleCommandButton($(this), false);
        }
    });
    $("#mcAutoVoteSkipButton").click(function() {
        if ($(this).text() === "Off") {
            let option = $("#mcAutoVoteSkipSelect").val();
            if (option === "time") {
                let time = $("#mcAutoVoteSkipTimeInput").val();
                if (time) {
                    time = time.split(/[ ,-]+/).map((x) => parseFloat(x));
                    if (!time.length || time.some((x) => isNaN(x))) return;
                }
                else {
                    $("#mcAutoVoteSkipTimeInput").val("0");
                    time = [0];
                }
                if (time.length === 1) {
                    autoVoteSkip = [Math.floor(time[0] * 1000)];
                    saveSettings();
                    sendSystemMessage(`auto vote skip after ${time[0]} seconds`);
                    toggleCommandButton($(this), true);
                }
                else if (time.length === 2) {
                    autoVoteSkip = [Math.floor(time[0] * 1000), Math.floor(time[1] * 1000)];
                    saveSettings();
                    sendSystemMessage(`auto vote skip after ${time[0]}-${time[1]} seconds`);
                    toggleCommandButton($(this), true);
                }
            }
            else if (option === "valid") {
                autoVoteSkip = "valid";
                saveSettings();
                sendSystemMessage("auto vote skip after first valid answer on team enabled");
                toggleCommandButton($(this), true);
                $("#mcAutoVoteSkipTimeInput").val("");
            }
        }
        else {
            autoVoteSkip = [];
            saveSettings();
            sendSystemMessage("auto vote skip disabled");
            toggleCommandButton($(this), false);
        }
    });
    $("#mcAutoVoteSkipSelect").on("change", function() {
        if ($(this).val() === "time") {
            $("#mcAutoVoteSkipTimeInput").show();
        }
        else {
            $("#mcAutoVoteSkipTimeInput").hide();
        }
    });
    $("#mcAutoVoteLobbyButton").click(function() {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendSystemMessage(`auto vote lobby ${autoVoteLobby ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), autoVoteLobby);
    });
    $("#mcAutoMuteButton").click(function() {
        if ($("#mcAutoMuteButton").text() === "Off") {
            let option = $("#mcAutoMuteSelect").val();
            let time = $("#mcAutoMuteTimeInput").val();
            if (time) {
                time = time.split(/[ ,-]+/).map((x) => parseFloat(x));
            }
            else {
                $("#mcAutoMuteTimeInput").val("0");
                time = [0];
            }
            if (time.length && time.every((x) => !isNaN(x))) {
                let milliseconds = time.map((x) => Math.floor(x * 1000));
                if (option === "mute") {
                    autoMute = {mute: milliseconds, unmute: [], toggle: [], randomMute: null, randomUnmute: null};
                    saveSettings();
                    sendSystemMessage(getAutoMuteStatus());
                    toggleCommandButton($(this), true);
                }
                else if (option === "unmute") {
                    autoMute = {mute: [], unmute: milliseconds, toggle: [], randomMute: null, randomUnmute: null};
                    saveSettings();
                    sendSystemMessage(getAutoMuteStatus());
                    toggleCommandButton($(this), true);
                }
                else if (option === "toggle") {
                    autoMute = {mute: [], unmute: [], toggle: milliseconds, randomMute: null, randomUnmute: null};
                    saveSettings();
                    sendSystemMessage(getAutoMuteStatus());
                    toggleCommandButton($(this), true);
                }
                else if (option === "random mute") {
                    autoMute = {mute: [], unmute: [], toggle: [], randomMute: milliseconds[0], randomUnmute: null};
                    saveSettings();
                    sendSystemMessage(getAutoMuteStatus());
                    toggleCommandButton($(this), true);
                }
                else if (option === "random unmute") {
                    autoMute = {mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: milliseconds[0]};
                    saveSettings();
                    sendSystemMessage(getAutoMuteStatus());
                    toggleCommandButton($(this), true);
                }
            }
        }
        else {
            autoMute = {mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: null};
            saveSettings();
            sendSystemMessage("auto mute system disabled");
            toggleCommandButton($(this), false);
        }
    });
    $("#mcAutoMuteSelect").on("change", function() {
        if ($(this).val() === "toggle") {
            $("#mcAutoMuteTimeInput").css("width", "150px").attr("placeholder", "time list");
        }
        else {
            $("#mcAutoMuteTimeInput").css("width", "50px").attr("placeholder", "time");
        }
    });
    $("#mcMuteSubmitButton").click(function() {
        muteSubmit = !muteSubmit;
        saveSettings();
        sendSystemMessage(`mute after answer submit ${muteSubmit ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), muteSubmit);
    });
    $("#mcMuteReplayButton").click(function() {
        muteReplay = !muteReplay;
        saveSettings();
        sendSystemMessage(`mute during replay phase ${muteReplay ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), muteReplay);
    });
    $("#mcContinueSampleButton").click(function() {
        continueSample = !continueSample;
        saveSettings();
        sendSystemMessage(`continue sample ${continueSample ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), continueSample);
    });
    $("#mcLoopVideoButton").click(function() {
        loopVideo = !loopVideo;
        for (let videoPlayer of quizVideoController.moePlayers) {
            videoPlayer.$player[0].loop = loopVideo;
        }
        saveSettings();
        sendSystemMessage(`loop video ${loopVideo ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), loopVideo);
    });
    $("#mcDropDownButton").click(function() {
        dropdown = !dropdown;
        saveSettings();
        sendSystemMessage(`drop down ${dropdown ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), dropdown);
    });
    $("#mcDropDownInSpecButton").click(function() {
        dropdownInSpec = !dropdownInSpec;
        saveSettings();
        sendSystemMessage(`drop down in spec ${dropdownInSpec ? "enabled" : "disabled"}`);
        toggleCommandButton($(this), dropdownInSpec);
    });

    createHotkeyElement("Toggle Autokey", "autoKey", "mcAutokeyHotkeySelect", "mcAutokeyHotkeyInput");
    createHotkeyElement("Toggle Dropdown", "dropdown", "mcDropdownHotkeySelect", "mcDropdownHotkeyInput");
    createHotkeyElement("Toggle Mute", "mute", "mcMuteHotkeySelect", "mcMuteHotkeyInput");
    createHotkeyElement("Ready", "ready", "mcReadyHotkeySelect", "mcReadyHotkeyInput");
    createHotkeyElement("Join / Spectate", "joinSpectate", "mcJoinSpectateHotkeySelect", "mcJoinSpectateHotkeyInput");
    createHotkeyElement("Start Quiz", "start", "mcStartHotkeySelect", "mcStartHotkeyInput");
    //createHotkeyElement("Leave Quiz", "leave", "mcLeaveHotkeySelect", "mcLeaveHotkeyInput");
    createHotkeyElement("Rejoin Quiz", "rejoin", "mcRejoinHotkeySelect", "mcRejoinHotkeyInput");
    createHotkeyElement("Return To Lobby", "lobby", "mcLobbyHotkeySelect", "mcLobbyHotkeyInput");
    createHotkeyElement("Pause / Unpause", "pause", "mcPauseHotkeySelect", "mcPauseHotkeyInput");
    createHotkeyElement("Vote Skip", "voteSkip", "mcSkipHotkeySelect", "mcSkipHotkeyInput");
    createHotkeyElement("Relog", "relog", "mcRelogHotkeySelect", "mcRelogHotkeyInput");
    createHotkeyElement("Open This Window", "mcHelpWindow", "mcHelpWindowSelect", "mcHelpWindowInput");
    createHotkeyElement("Open Song History", "songHistoryWindow", "mcSongHistoryWindowSelect", "mcSongHistoryWindowInput");

    createAlertElement("Online Friends", "onlineFriends", "mcAlertOnlineFriends");
    createAlertElement("Offline Friends", "offlineFriends", "mcAlertOfflineFriends");
    createAlertElement("Server Status", "serverStatus", "mcAlertServerStatus");
    createAlertElement("Hidden Players", "hiddenPlayers", "mcAlertHiddenPlayers");
    createAlertElement("Name Change", "nameChange", "mcAlertNameChange");

    $("#mcLocalStorageImportButton").click(() => {
        importLocalStorage();
    });
    $("#mcLocalStorageExportButton").click(() => {
        exportLocalStorage();
    });
    $("#mcLocalStorageClearButton").click(() => {
        displayOption(
            "Confirm",
            "Clear AMQ local storage for all scripts?",
            "Clear",
            "Cancel",
            () => {
                localStorage.clear();
                displayMessage("All local storage cleared");
            }
        );
    });
    $("#mcMalClientIdInput").val(malClientId || "").blur(() => {
        malClientId = $(this).val().trim();
    });
    
    $("#mcOrderTab").hide();
    tabReset();
    updateCommandListWindow();
    $("#mcDocumentationTab").addClass("selected");
    $("#mcDocumentationContainer").show();
    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#mcSettingsModal').modal('show')">Commands</li>`);

    $("#mcDocumentationContainer").append(`<h4 class="text-center">Soon™</h4>`);

    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js",
        description: `
            <p>A large collection of commands for quality of life improvements and automation utilities</p>
            <ul><b>Disable these scripts if you have them</b>
                <li>- dice roller by thejoseph98/joske2865</li>
                <li>- chat commands by nyamu</li>
                <li>- auto ready by nyamu</li>
                <li>- auto answer on keypress by (unknown)</li>
                <li>- command invite by minigamer42</li>
                <li>- no dropdown by juvian</li>
                <li>- no sample reset by miyuki</li>
            </ul>
            <p>See all commands: <button id="mcScriptDataHelpButton" style="color: black">Help</button></p>
        `
    });
    
    $("#mcScriptDataHelpButton").click(() => {
        $("#installedModal").modal("hide");
        tabReset();
        $("#mcDocumentationTab").addClass("selected");
        $("#mcDocumentationContainer").show();
        $("#mcSettingsModal").modal("show");
    });
}

// set command status buttons to enabled or disabled
function toggleCommandButton($element, enabled) {
    if (enabled) {
        $element.removeClass("btn-danger").addClass("btn-success").text("On");
    }
    else {
        $element.removeClass("btn-success").addClass("btn-danger").text("Off");
    }
}

// get auto throw status text
function getAutoThrowStatus() {
    if (autoThrow.time.length) {
        let time = autoThrow.time.map((x) => x / 1000);
        if (autoThrow.text) {
            if (time.length === 1) {
                if (time[0] === 0) {
                    return `auto throwing: ${autoThrow.text}`;
                }
                else {
                    return `auto throwing: ${autoThrow.text} after ${time[0]} second${time[0] === 1 ? "" : "s"}`;
                }
            }
            else if (time.length === 2) {
                return `auto throwing: ${autoThrow.text} after ${time[0]}-${time[1]} seconds`;
            }
        }
        else if (autoThrow.multichoice) {
            if (time.length === 1) {
                if (time[0] === 0) {
                    return `auto throwing multichoice item: ${autoThrow.multichoice}`;
                }
                else {
                    return `auto throwing multichoice item: ${autoThrow.multichoice} after ${time[0]} second${time[0] === 1 ? "" : "s"}`;
                }
            }
            else if (time.length === 2) {
                return `auto throwing multichoice item: ${autoThrow.multichoice} after ${time[0]}-${time[1]} seconds`;
            }
        }
    }
    return "auto throw disabled";
}

// get auto mute status text
function getAutoMuteStatus() {
    if (autoMute.mute.length === 1) {
        let time = autoMute.mute.map((x) => x / 1000);
        return `auto muting after ${time[0]} second${time[0] === 1 ? "" : "s"}`;
    }
    else if (autoMute.mute.length === 2) {
        let time = autoMute.mute.map((x) => x / 1000);
        return `auto muting after random # of seconds between ${time[0]} - ${time[1]}`;
    }
    else if (autoMute.unmute.length === 1) {
        let time = autoMute.unmute.map((x) => x / 1000);
        return `auto unmuting after ${time[0]} second${time[0] === 1 ? "" : "s"}`;
    }
    else if (autoMute.unmute.length === 2) {
        let time = autoMute.unmute.map((x) => x / 1000);
        return `auto unmuting after random # of seconds between ${time[0]} - ${time[1]}`;
    }
    else if (autoMute.toggle.length) {
        return `auto mute toggle list set to ${autoMute.toggle.map((x) => x / 1000).join(", ")}`;
    }
    else if (autoMute.randomMute !== null) {
        return `auto mute a random ${autoMute.randomMute / 1000} second interval`;
    }
    else if (autoMute.randomUnmute !== null) {
        return `auto unmute a random ${autoMute.randomUnmute / 1000} second interval`;
    }
    return "auto mute system disabled";
}

// update command status in the command window user interface
function updateCommandListWindow(type) {
    if (!type || type === "autoReady") {
        toggleCommandButton($("#mcAutoReadyButton"), autoReady);
    }
    if (!type || type === "autoStart") {
        toggleCommandButton($("#mcAutoStartButton"), autoStart);
    }
    if (!type || type === "autoAcceptInvite") {
        toggleCommandButton($("#mcAutoAcceptInviteButton"), autoAcceptInvite);
        if (autoAcceptInvite === "all") {
            $("#mcAutoAcceptInviteSelect").val("all");
            $("#mcAutoAcceptInviteInput").hide();
        }
        else if (autoAcceptInvite === "friends") {
            $("#mcAutoAcceptInviteSelect").val("friends");
            $("#mcAutoAcceptInviteInput").hide();
        }
        else if (Array.isArray(autoAcceptInvite)) {
            $("#mcAutoAcceptInviteSelect").val("list");
            $("#mcAutoAcceptInviteInput").show();
        }
        else {
            $("#mcAutoAcceptInviteInput").hide();
        }
    }
    if (!type || type === "autoStatus") {
        toggleCommandButton($("#mcAutoStatusButton"), autoStatus);
        if (autoStatus === "do not disturb") {
            $("#mcAutoStatusSelect").val("do not disturb");
        }
        if (autoStatus === "away") {
            $("#mcAutoStatusSelect").val("away");
        }
        else {
            $("#mcAutoStatusSelect").val("offline");
        }
    }
    if (!type || type === "autoKey") {
        toggleCommandButton($("#mcAutoKeyButton"), autoKey);
    }
    if (!type || type === "autoThrow") {
        toggleCommandButton($("#mcAutoThrowButton"), autoThrow.time.length);
        $("#mcAutoThrowSelect").val(autoThrow.multichoice ? "multichoice" : "text");
        $("#mcAutoThrowTimeInput").val(autoThrow.time.map((x) => x / 1000).join("-"));
        $("#mcAutoThrowTextInput").val(autoThrow.multichoice || autoThrow.text || "").attr("placeholder", autoThrow.multichoice ? "option (1-4)": "text");
    }
    if (!type || type === "autoCopy") {
        toggleCommandButton($("#mcAutoCopyButton"), autoCopy);
        $("#mcAutoCopyInput").val(autoCopy);
    }
    if (!type || type === "autoHost") {
        toggleCommandButton($("#mcAutoHostButton"), autoHost);
        $("#mcAutoHostInput").val(autoHost);
    }
    if (!type || type === "autoVoteSkip") {
        if (autoVoteSkip === "valid") {
            toggleCommandButton($("#mcAutoVoteSkipButton"), true);
            $("#mcAutoVoteSkipSelect").val("valid");
            $("#mcAutoVoteSkipTimeInput").hide("");
        }
        else if (Array.isArray(autoVoteSkip) && autoVoteSkip.length) {
            toggleCommandButton($("#mcAutoVoteSkipButton"), true);
            $("#mcAutoVoteSkipSelect").val("time");
            $("#mcAutoVoteSkipTimeInput").show().val(autoVoteSkip.map((x) => x / 1000).join("-"));
        }
        else {
            toggleCommandButton($("#mcAutoVoteSkipButton"), false);
        }
    }
    if (!type || type === "autoVoteLobby") {
        $("#mcAutoVoteLobbyButton").addClass(autoVoteLobby ? "btn-success" : "btn-danger").text(autoVoteLobby ? "On" : "Off");
    }
    if (!type || type === "autoMute") {
        if (autoMute.mute.length) {
            toggleCommandButton($("#mcAutoMuteButton"), true);
            $("#mcAutoMuteSelect").val("mute");
            $("#mcAutoMuteTimeInput").val(autoMute.mute.map((x) => x / 1000).join("-")).css("width", "50px").attr("placeholder", "time");
        }
        else if (autoMute.unmute.length) {
            toggleCommandButton($("#mcAutoMuteButton"), true);
            $("#mcAutoMuteSelect").val("unmute");
            $("#mcAutoMuteTimeInput").val(autoMute.unmute.map((x) => x / 1000).join("-")).css("width", "50px").attr("placeholder", "time");
        }
        else if (autoMute.toggle.length) {
            toggleCommandButton($("#mcAutoMuteButton"), true);
            $("#mcAutoMuteSelect").val("toggle");
            $("#mcAutoMuteTimeInput").val(autoMute.toggle.map((x) => x / 1000).join(", ")).css("width", "150px").attr("placeholder", "time list");
        }
        else if (autoMute.randomMute !== null) {
            toggleCommandButton($("#mcAutoMuteButton"), true);
            $("#mcAutoMuteSelect").val("random mute");
            $("#mcAutoMuteTimeInput").val(autoMute.randomMute / 1000).css("width", "50px").attr("placeholder", "time");
        }
        else if (autoMute.randomUnmute !== null) {
            toggleCommandButton($("#mcAutoMuteButton"), true);
            $("#mcAutoMuteSelect").val("random unmute");
            $("#mcAutoMuteTimeInput").val(autoMute.randomUnmute / 1000).css("width", "50px").attr("placeholder", "time");
        }
        else {
            toggleCommandButton($("#mcAutoMuteButton"), false);
            $("#mcAutoMuteTimeInput").val("");
        }
    }
    if (!type || type === "muteSubmit") {
        toggleCommandButton($("#mcMuteSubmitButton"), muteSubmit);
    }
    if (!type || type === "muteReplay") {
        toggleCommandButton($("#mcMuteReplayButton"), muteReplay);
    }
    if (!type || type === "continueSample") {
        toggleCommandButton($("#mcContinueSampleButton"), continueSample);
    }
    if (!type || type === "loopVideo") {
        toggleCommandButton($("#mcLoopVideoButton"), loopVideo);
    }
    if (!type || type === "dropdown") {
        toggleCommandButton($("#mcDropDownButton"), dropdown);
    }
    if (!type || type === "dropdownInSpec") {
        toggleCommandButton($("#mcDropDownInSpecButton"), dropdownInSpec);
    }
}

// test hotkey
function testHotkey(action, key, altKey, ctrlKey) {
    let hotkey = hotKeys[action];
    return key === hotkey.key && altKey === hotkey.altKey && ctrlKey === hotkey.ctrlKey;
}

// create hotkey element
function createHotkeyElement(title, key, selectID, inputID) {
    let $tr = $(`<tr></tr>`);
    let $select = $(`<select id="${selectID}" style="padding: 3px 0;"></select>`).append(`<option>ALT</option>`).append(`<option>CTRL</option>`).append(`<option>CTRL ALT</option>`);
    let $input = $(`<input id="${inputID}" type="text" maxlength="1" style="width: 40px;">`).val(hotKeys[key].key);
    $select.on("change", () => {
        hotKeys[key] = {
            "altKey": $select.val().includes("ALT"),
            "ctrlKey": $select.val().includes("CTRL"),
            "key": $input.val().toLowerCase()
        }
        saveSettings();
    });
    $input.blur(() => {
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
    $tr.append($(`<td></td>`).text(title));
    $tr.append($(`<td></td>`).append($select));
    $tr.append($(`<td></td>`).append($input));
    $("#mcHotkeyTable tbody").append($tr);
}

// create alert element
function createAlertElement(title, key, id) {
    let $tr = $(`<tr></tr>`);
    let $popoutCheckbox = $(`<div class="customCheckbox"></div>`);
    let $chatCheckbox = $(`<div class="customCheckbox"></div>`);
    $popoutCheckbox.append($(`<input type="checkbox" id="${id}PopoutCheckbox">`).prop("checked", alerts[key].popout).click(() => {
        alerts[key].popout = !alerts[key].popout;
        saveSettings();
    }));
    $chatCheckbox.append($(`<input type="checkbox" id="${id}ChatCheckbox">`).prop("checked", alerts[key].chat).click(() => {
        alerts[key].chat = !alerts[key].chat;
        saveSettings();
    }));
    $popoutCheckbox.append(`<label for="${id}PopoutCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>`);
    $chatCheckbox.append(`<label for="${id}ChatCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>`);
    $tr.append($(`<td></td>`).text(title));
    $tr.append($(`<td style="text-align: center"></td>`).append($popoutCheckbox));
    $tr.append($(`<td style="text-align: center"></td>`).append($chatCheckbox));
    $("#mcAlertsTable tbody").append($tr);
}

// update all checkboxes in the alerts user interface
function updateAlertCheckboxes() {
    $("#mcAlertOnlineFriendsChatCheckbox").prop("checked", alerts.onlineFriends.chat);
    $("#mcAlertOnlineFriendsPopoutCheckbox").prop("checked", alerts.onlineFriends.popout);
    $("#mcAlertOfflineFriendsChatCheckbox").prop("checked", alerts.offlineFriends.chat);
    $("#mcAlertOfflineFriendsPopoutCheckbox").prop("checked", alerts.offlineFriends.popout);
    $("#mcAlertServerStatusChatCheckbox").prop("checked", alerts.serverStatus.chat);
    $("#mcAlertServerStatusPopoutCheckbox").prop("checked", alerts.serverStatus.popout);
    $("#mcAlertHiddenPlayersChatCheckbox").prop("checked", alerts.hiddenPlayers.chat);
    $("#mcAlertHiddenPlayersPopoutCheckbox").prop("checked", alerts.hiddenPlayers.popout);
    $("#mcAlertNameChangeChatCheckbox").prop("checked", alerts.nameChange.chat);
    $("#mcAlertNameChangePopoutCheckbox").prop("checked", alerts.nameChange.popout);
}

// reset all tabs
function tabReset() {
    $("#mcActiveTab").removeClass("selected");
    $("#mcHotkeyTab").removeClass("selected");
    $("#mcDocumentationTab").removeClass("selected");
    $("#mcAlertsTab").removeClass("selected");
    $("#mcOrderTab").removeClass("selected");
    $("#mcInfoTab").removeClass("selected");
    $("#mcActiveContainer").hide();
    $("#mcHotkeyContainer").hide();
    $("#mcDocumentationContainer").hide();
    $("#mcAlertsContainer").hide();
    $("#mcOrderContainer").hide();
    $("#mcInfoContainer").hide();
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
    else if (/^\/roll genres?$/i.test(content)) {
        let list = Object.values(idTranslator.genreNames);
        sendMessage(list[Math.floor(Math.random() * list.length)], type, target);
    }
    else if (/^\/roll genres? [0-9]+$/i.test(content)) {
        let number = parseInt(/^\S+ \S+ ([0-9]+)$/.exec(content)[1]);
        let list = Object.values(idTranslator.genreNames);
        if (number <= list.length) sendMessage(shuffleArray(list).slice(0, number).join(", "), type, target);
    }
    else if (/^\/roll tags?$/i.test(content)) {
        let list = Object.values(idTranslator.tagNames);
        sendMessage(list[Math.floor(Math.random() * list.length)], type, target);
    }
    else if (/^\/roll tags? [0-9]+$/i.test(content)) {
        let number = parseInt(/^\S+ \S+ ([0-9]+)$/.exec(content)[1]);
        let list = Object.values(idTranslator.tagNames);
        if (number <= list.length) sendMessage(shuffleArray(list).slice(0, number).join(", "), type, target);
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
    else if (/^\/(loot|looting)$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.showSelection = 2;
        changeGameSettings(settings);
    }
    else if (/^\/(loot|looting) [0-9]+$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.showSelection = 2;
        settings.inventorySize.randomOn = false;
        settings.inventorySize.standardValue = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        changeGameSettings(settings);
    }
    else if (/^\/(loot|looting) [0-9]+ [0-9]+$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.showSelection = 2;
        settings.inventorySize.randomOn = false;
        settings.inventorySize.standardValue = parseInt(/^\S+ ([0-9]+) [0-9]+$/.exec(content)[1]);
        settings.lootingTime.randomOn = false;
        settings.lootingTime.standardValue = parseInt(/^\S+ [0-9]+ ([0-9]+)$/.exec(content)[1]);
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
    else if (/^\/boss$/i.test(content)) {
        let settings = hostModal.getSettings();
        settings.scoreType = 4;
        changeGameSettings(settings);
    }
    else if (/^\/boss [0-9]+ [0-9]+ [0-9]+$/i.test(content)) {
        let regex = /^\S+ ([0-9]+) ([0-9]+) ([0-9]+)$/.exec(content);
        let settings = hostModal.getSettings();
        settings.scoreType = 4;
        settings.bossLives = parseInt(regex[1]);
        settings.bossPowerUps = parseInt(regex[2]);
        settings.bossMaxSongs = parseInt(regex[3]);
        changeGameSettings(settings);
    }
    else if (/^\/(teams?|teamsize) [0-9]+$/i.test(content)) {
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
    else if (/^\/(pscores?|playerscores?) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        if (option < 1 || option > 10) return;
        let settings = hostModal.getSettings();
        settings.playerScore.advancedOn = false;
        settings.playerScore.standardValue = [option, option];
        changeGameSettings(settings);
    }
    else if (/^\/(pscores?|playerscores?) [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        if (low < 1 || high > 10 || low > high) return;
        let settings = hostModal.getSettings();
        settings.playerScore.advancedOn = false;
        settings.playerScore.standardValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/(ascores?|animescores?) [0-9]+$/i.test(content)) {
        let option = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        if (option < 1 || option > 10) return;
        let settings = hostModal.getSettings();
        settings.animeScore.advancedOn = false;
        settings.animeScore.standardValue = [option, option];
        changeGameSettings(settings);
    }
    else if (/^\/(ascores?|animescores?) [0-9]+[ ,-]+[0-9]+$/i.test(content)) {
        let low = parseInt(/^\S+ ([0-9]+)[ ,-]+[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ [0-9]+[ ,-]+([0-9]+)$/.exec(content)[1]);
        if (low < 1 || high > 10 || low > high) return;
        let settings = hostModal.getSettings();
        settings.animeScore.advancedOn = false;
        settings.animeScore.standardValue = [low, high];
        changeGameSettings(settings);
    }
    else if (/^\/skip$/i.test(content)) {
        quiz.skipClicked();
    }
    else if (/^\/pause$/i.test(content)) {
        socket.sendCommand({type: "quiz", command: "quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause")});
    }
    else if (/^\/(mr|mutereplay)$/i.test(content)) {
        muteReplay = !muteReplay;
        sendMessage(`mute during replay phase ${muteReplay ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("muteReplay");
    }
    else if (/^\/(ms|mutesubmit)$/i.test(content)) {
        muteSubmit = !muteSubmit;
        sendMessage(`mute after answer submit ${muteSubmit ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("muteSubmit");
    }
    else if (/^\/(avs|autoskip|autovoteskip)$/i.test(content)) {
        autoVoteSkip = autoVoteSkip.length ? [] : [0];
        sendMessage(`auto vote skip ${autoVoteSkip.length ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("autoVoteSkip");
    }
    else if (/^\/(avs|autoskip|autovoteskip) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoVoteSkip = [Math.floor(seconds * 1000)];
        sendMessage(`auto vote skip after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
        updateCommandListWindow("autoVoteSkip");
    }
    else if (/^\/(avs|autoskip|autovoteskip) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoVoteSkip = [Math.floor(low * 1000), Math.floor(high * 1000)];
        sendMessage(`auto vote skip after ${low}-${high} seconds`, type, target, true);
        updateCommandListWindow("autoVoteSkip");
    }
    else if (/^\/(avs|autoskip|autovoteskip) (v|valid|onvalid)$/i.test(content)) {
        autoVoteSkip = "valid";
        sendMessage(`auto vote skip after first valid answer on team enabled`, type, target, true);
        updateCommandListWindow("autoVoteSkip");
    }
    else if (/^\/(ak|autokey|autosubmit)$/i.test(content)) {
        autoKey = !autoKey;
        saveSettings();
        sendMessage(`auto key ${autoKey ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("autoKey");
    }
    else if (/^\/(at|att|atmc|attmc|autothrow|autothrowtime|autothrowmc|autothrowmultichoice|autothrowmultiplechoice|autothrowtimemc|autothrowtimemultichoice)$/i.test(content)) {
        autoThrow = {time: [], text: null, multichoice: null};
        sendMessage("auto throw disabled", type, target, true);
        updateCommandListWindow("autoThrow");
    }
    else if (/^\/(at|autothrow) .+$/i.test(content)) {
        autoThrow.time = [1];
        autoThrow.text = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text}`, type, target, true);
        updateCommandListWindow("autoThrow");
    }
    else if (/^\/(att|autothrowtime) [0-9.]+ .+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+) .+$/.exec(content)[1]);
        if (isNaN(time1)) return;
        autoThrow.time = [Math.floor(time1 * 1000)];
        autoThrow.text = translateShortcodeToUnicode(/^\S+ [0-9.]+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text} after ${time1} seconds`, type, target, true);
        updateCommandListWindow("autoThrow");
    }
    else if (/^\/(att|autothrowtime) [0-9.]+[ -][0-9.]+ .+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+ .+$/.exec(content)[1]);
        let time2 = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+) .+$/.exec(content)[1]);
        if (isNaN(time1) || isNaN(time2)) return;
        autoThrow.time = [Math.floor(time1 * 1000), Math.floor(time2 * 1000)];
        autoThrow.text = translateShortcodeToUnicode(/^\S+ [0-9.]+[ -][0-9.]+ (.+)$/.exec(content)[1]).text;
        autoThrow.multichoice = null;
        sendMessage(`auto throwing: ${autoThrow.text} after ${time1}-${time2} seconds`, type, target, true);
        updateCommandListWindow("autoThrow");
    }
    else if (/^\/(atmc|autothrowmc|autothrowmultichoice|autothrowmultiplechoice) \S+$/i.test(content)) {
        let option = /^\S+ (\S+)$/.exec(content)[1];
        let atmcDict = {"1": 1, "2": 2, "3": 3, "4": 4, "r": "random", "random": "random"};
        if (option in atmcDict) {
            autoThrow.time = [100];
            autoThrow.text = null;
            autoThrow.multichoice = atmcDict[option];
            sendMessage(`auto throwing multichoice item: ${autoThrow.multichoice}`, type, target, true);
            updateCommandListWindow("autoThrow");
        }
    }
    else if (/^\/(attmc|autothrowtimemc|autothrowtimemultichoice) [0-9.]+ \S+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+) \S+$/.exec(content)[1]);
        if (isNaN(time1)) return;
        let option = /^\S+ [0-9.]+ (\S+)$/.exec(content)[1].toLowerCase();
        let atmcDict = {"1": 1, "2": 2, "3": 3, "4": 4, "r": "random", "random": "random"};
        if (option in atmcDict) {
            autoThrow.time = [Math.floor(time1 * 1000)];
            autoThrow.text = null;
            autoThrow.multichoice = atmcDict[option];
            sendMessage(`auto throwing multichoice item: ${autoThrow.multichoice} after ${time1} seconds`, type, target, true);
            updateCommandListWindow("autoThrow");
        }
    }
    else if (/^\/(attmc|autothrowtimemc|autothrowtimemultichoice) [0-9.]+[ -][0-9.]+ \S+$/i.test(content)) {
        let time1 = parseFloat(/^\S+ ([0-9.]+)[ -][0-9.]+ \S+$/.exec(content)[1]);
        let time2 = parseFloat(/^\S+ [0-9.]+[ -]([0-9.]+) \S+$/.exec(content)[1]);
        if (isNaN(time1) || isNaN(time2)) return;
        let option = /^\S+ [0-9.]+[ -][0-9.]+ (\S+)$/.exec(content)[1].toLowerCase();
        let atmcDict = {"1": 1, "2": 2, "3": 3, "4": 4, "r": "random", "random": "random"};
        if (option in atmcDict) {
            autoThrow.time = [Math.floor(time1 * 1000), Math.floor(time2 * 1000)];
            autoThrow.text = null;
            autoThrow.multichoice = atmcDict[option];
            sendMessage(`auto throwing multichoice item: ${autoThrow.multichoice} after ${time1}-${time2} seconds`, type, target, true);
            updateCommandListWindow("autoThrow");
        }
    }
    else if (/^\/(ac|autocopy)$/i.test(content)) {
        autoCopy = "";
        sendMessage("auto copy disabled", type, target, true);
        updateCommandListWindow("autoCopy");
    }
    else if (/^\/(ac|autocopy) \w+$/i.test(content)) {
        autoCopy = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto copying ${autoCopy}`, type, target, true);
        updateCommandListWindow("autoCopy");
    }
    else if (/^\/(am|au|amt|amr|aur|automute|autounmute|automutetoggle|automuterandom|autounmuterandom)$/i.test(content)) {
        $("#qpVolume").removeClass("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        autoMute = {mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: null};
        sendMessage("auto mute system disabled", type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(am|automute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = {mute: [Math.floor(seconds * 1000)], unmute: [], toggle: [], randomMute: null, randomUnmute: null};
        sendMessage(`auto muting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(am|automute) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoMute = {mute: [Math.floor(low * 1000), Math.floor(high * 1000)], unmute: [], toggle: [], randomMute: null, randomUnmute: null};
        sendMessage(`auto muting after random # of seconds between ${low} - ${high}`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/i.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        autoMute = {mute: [], unmute: [Math.floor(seconds * 1000)], toggle: [], randomMute: null, randomUnmute: null};
        sendMessage(`auto unmuting after ${seconds} second${seconds === 1 ? "" : "s"}`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(au|autounmute) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        autoMute = {mute: [], unmute: [Math.floor(low * 1000), Math.floor(high * 1000)], toggle: [], randomMute: null, randomUnmute: null};
        sendMessage(`auto unmuting after random # of seconds between ${low} - ${high}`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(amt|automutetoggle) .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(/[, ]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x) && x >= 0);
        list = [...new Set(list)].sort((a, b) => a - b);
        if (list.length < 2) return;
        autoMute = {mute: [], unmute: [], toggle: list.map((x) => Math.floor(x * 1000)), randomMute: null, randomUnmute: null};
        sendMessage(`auto mute toggle list set to ${list.join(", ")}`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(amr|automuterandom) [0-9.]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(option) || option === 0) return;
        autoMute = {mute: [], unmute: [], toggle: [], randomMute: Math.floor(option * 1000), randomUnmute: null};
        sendMessage(`auto mute a random ${option} second interval`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/(aur|autounmuterandom) [0-9.]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(option) || option === 0) return;
        autoMute = {mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: Math.floor(option * 1000)};
        sendMessage(`auto unmute a random ${option} second interval`, type, target, true);
        updateCommandListWindow("autoMute");
    }
    else if (/^\/autoready$/i.test(content)) {
        autoReady = !autoReady;
        saveSettings();
        sendMessage(`auto ready ${autoReady ? "enabled" : "disabled"}`, type, target, true);
        checkAutoReady();
        updateCommandListWindow("autoReady");
    }
    else if (/^\/autostart$/i.test(content)) {
        autoStart = !autoStart;
        sendMessage(`auto start game ${autoStart ? "enabled" : "disabled"}`, type, target, true);
        checkAutoStart();
        updateCommandListWindow("autoStart");
    }
    else if (/^\/(ah|autohost)$/i.test(content)) {
        autoHost = "";
        sendMessage("auto host disabled", type, target, true);
        updateCommandListWindow("autoHost");
    }
    else if (/^\/(ah|autohost) \S+$/i.test(content)) {
        autoHost = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto hosting ${autoHost}`, type, target, true);
        checkAutoHost();
        updateCommandListWindow("autoHost");
    }
    else if (/^\/autoinvite$/i.test(content)) {
        autoInvite = "";
        sendMessage("auto invite disabled", type, target, true);
    }
    else if (/^\/autoinvite \w+$/i.test(content)) {
        autoInvite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendMessage(`auto inviting ${autoInvite}`, type, target, true);
    }
    else if (/^\/(aai|autoaccept|autoacceptinvite)$/i.test(content)) {
        autoAcceptInvite = false;
        saveSettings();
        sendMessage("auto accept invite disabled", type, target, true);
        updateCommandListWindow("autoAcceptInvite");
    }
    else if (/^\/(aai|autoaccept|autoacceptinvite) (a|e|all|everyone)$/i.test(content)) {
        autoAcceptInvite = "all";
        saveSettings();
        sendMessage("auto accept invite from everyone", type, target, true);
        updateCommandListWindow("autoAcceptInvite");
    }
    else if (/^\/(aai|autoaccept|autoacceptinvite) (f|friends?)$/i.test(content)) {
        autoAcceptInvite = "friends";
        saveSettings();
        sendMessage("auto accept invite from friends", type, target, true);
        updateCommandListWindow("autoAcceptInvite");
    }
    else if (/^\/(aai|autoaccept|autoacceptinvite) .+$/i.test(content)) {
        autoAcceptInvite = /^\S+ (.+)$/.exec(content)[1].split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
        saveSettings();
        sendMessage(`auto accept invite only from ${autoAcceptInvite.join(", ")}`, type, target, true);
        updateCommandListWindow("autoAcceptInvite");
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
    else if (/^\/(avl|autovotelobby|autolobby)$/i.test(content)) {
        autoVoteLobby = !autoVoteLobby;
        saveSettings();
        sendMessage(`auto vote lobby ${autoVoteLobby ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("autoVoteLobby");
    }
    else if (/^\/autostatus$/i.test(content)) {
        autoStatus = "";
        saveSettings();
        sendMessage("auto status removed", type, target, true);
        updateCommandListWindow("autoStatus");
    }
    else if (/^\/autostatus .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1].toLowerCase();
        if (option.startsWith("on") || option === "1") {
            autoStatus = "";
            saveSettings();
            sendMessage("auto status removed", type, target, true);
            updateCommandListWindow("autoStatus");
        }
        if (option.startsWith("d") || option === "2") {
            autoStatus = "do not disturb";
            saveSettings();
            sendMessage(`auto status set to ${autoStatus}`, type, target, true);
            updateCommandListWindow("autoStatus");
        }
        if (option.startsWith("a") || option === "3") {
            autoStatus = "away";
            saveSettings();
            sendMessage(`auto status set to ${autoStatus}`, type, target, true);
            updateCommandListWindow("autoStatus");
        }
        if (option.startsWith("off") || option.startsWith("i") || option === "4") {
            autoStatus = "invisible";
            saveSettings();
            sendMessage(`auto status set to ${autoStatus}`, type, target, true);
            updateCommandListWindow("autoStatus");
        }
        else {
            sendMessage("Options: away, do not disturb, offline", type, target, true);
        }
    }
    else if (/^\/(ads|autodownloadsongs?)$/i.test(content)) {
        if (autoDownloadSong.length) {
            autoDownloadSong = [];
            sendMessage("auto download song disabled", type, target, true);
        }
        else {
            sendMessage("Options: 720, 480, mp3, video", type, target, true);
        }
    }
    else if (/^\/(ads|autodownloadsongs?) .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(/[, ]+/).map((x) => x.trim()).filter((x) => x === "720" || x === "480" || x === "mp3" || x === "video");
        if (option.length) {
            autoDownloadSong = option;
            sendMessage(`auto downloading ${autoDownloadSong.join(", ")}`, type, target, true);
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
                else lobby.fireMainButtonEvent(true);
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
    else if (/^\/(inv|invite) .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].split(/[ ,]+/).filter(Boolean);
        list.forEach((name, i) => {
            setTimeout(() => {
                socket.sendCommand({type: "social", command: "invite to game", data: {target: getPlayerNameCorrectCase(name)}});
            }, i * 200);
        });
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
    else if (/^\/(v|vol|volume)$/i.test(content)) {
        sendMessage(volumeController.muted ? "🔇" : `🔉 ${Math.round(volumeController.volume * 100)}%`, type, target);
    }
    else if (/^\/(v|vol|volume) [0-9]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9]+)$/.exec(content)[1]) / 100;
        volumeController.volume = option;
        volumeController.setMuted(false);
        volumeController.adjustVolume();
    }
    else if (/^\/(v|vol|volume) (m|mute)$/i.test(content)) {
        volumeController.setMuted(true);
        volumeController.adjustVolume();
    }
    else if (/^\/(v|vol|volume) (u|unmute)$/i.test(content)) {
        volumeController.setMuted(false);
        volumeController.adjustVolume();
    }
    else if (/^\/(q|quality)$/i.test(content)) {
        sendMessage(qualityController.targetResolution, type, target);
    }
    else if (/^\/(q|quality) \S+$/i.test(content)) {
        let option = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        if (option === "0" || option === "mp3" || option === "sound") {
            qualityController.newResolution(0);
            qualityController.resetSelected();
            qualityController._$0.addClass("selected");
        }
        else if (option === "480") {
            qualityController.newResolution(480);
            qualityController.resetSelected();
            qualityController._$480.addClass("selected");
        }
        else if (option === "720") {
            qualityController.newResolution(720);
            qualityController.resetSelected();
            qualityController._$720.addClass("selected");
        }
    }
    else if (/^\/clear$/i.test(content)) {
        if (type === "chat" || type === "teamchat") {
            setTimeout(() => { $("#gcMessageContainer li").remove() }, 1);
        }
        else if (type === "nexus") {
            setTimeout(() => { $("#nexusCoopMainContainer .nexusCoopChatMessage").remove() }, 1);
        }
        else if (type === "dm") {
            setTimeout(() => { $(`#chatBox-${target} li`).remove() }, 1);
        }
    }
    else if (/^\/(dd|dropdown)$/i.test(content)) {
        dropdown = !dropdown;
        saveSettings();
        sendMessage(`dropdown ${dropdown ? "enabled" : "disabled"}`, type, target, true);
        quiz.answerInput.typingInput.autoCompleteController.newList();
        updateCommandListWindow("dropdown");
    }
    else if (/^\/(dds|dropdownspec|dropdownspectate)$/i.test(content)) {
        dropdownInSpec = !dropdownInSpec;
        saveSettings();
        if (dropdownInSpec) $("#qpAnswerInput").removeAttr("disabled");
        sendMessage(`dropdown while spectating ${dropdownInSpec ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("dropdownInSpec");
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
        let handleAllOnlineMessage = new Listener("all online users", (onlineUsers) => {
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
    else if (/^\/start$/i.test(content)) {
        if (lobby.inLobby && lobby.isHost) {
            lobby.fireMainButtonEvent(true);
        }
        else if (nexus.inNexusLobby) {
            socket.sendCommand({
                type: "nexus",
                command: "start dungeon lobby",
                data: nexus.cityController.dungeonSelectionWindow.dungeonSetupTab.settingDescription
            });
        }
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
    else if (/^\/relog$/i.test(content)) {
        relog();
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
                    data: {target: alien, message: `Aliens: ${aliens.join(", ")} (turn on your list and disable share entries)`}
                });
            }, 500 * i);
        });
        setTimeout(() => { sendMessage(`${n} alien${n === 1 ? "" : "s"} chosen`, type, target) }, 500 * n);
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
    else if (/^\/nexus auto$/i.test(content)) {
        nexus.cityController.NIGHT_START_HOUR = 18;
        nexus.cityController.NIGHT_END_HOUR = 6;
    }
    else if (/^\/nexus day$/i.test(content)) {
        nexus.cityController.NIGHT_START_HOUR = 24;
        nexus.cityController.NIGHT_END_HOUR = 0;
    }
    else if (/^\/nexus night$/i.test(content)) {
        nexus.cityController.NIGHT_START_HOUR = 0;
        nexus.cityController.NIGHT_END_HOUR = 0;
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
    else if (/^\/count ?friends$/i.test(content)) {
        sendMessage(getAllFriends().length, type, target);
    }
    else if (/^\/count ?scripts$/i.test(content)) {
        sendMessage($("#installedListContainer h4").length, type, target);
    }
    else if (/^\/friendsin(lobby|quiz|game|room)$/i.test(content)) {
        if (lobby.inLobby) {
            let list = Object.values(lobby.players).map((player) => player._name).filter((player) => socialTab.isFriend(player));
            sendMessage(list.length ? list.join(", ") : "(none)", type, target);
        }
        else if (quiz.inQuiz) {
            let list = Object.values(quiz.players).map((player) => player._name).filter((player) => socialTab.isFriend(player));
            sendMessage(list.length ? list.join(", ") : "(none)", type, target);
        }
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
    else if (/^\/alerts?$/i.test(content)) {
        sendMessage(Object.keys(alerts).map((key) => `${key}: ${alerts[key]}`).join(", "), type, target, true);
    }
    else if (/^\/alerts? on$/i.test(content)) {
        alerts.hiddenPlayers = {chat: true, popout: true};
        alerts.nameChange = {chat: true, popout: true};
        alerts.onlineFriends = {chat: true, popout: true};
        alerts.offlineFriends = {chat: true, popout: true};
        alerts.serverStatus = {chat: true, popout: true};
        saveSettings();
        sendMessage("all alerts enabled", type, target, true);
        updateAlertCheckboxes();
    }
    else if (/^\/alerts? off$/i.test(content)) {
        alerts.hiddenPlayers = {chat: false, popout: false};
        alerts.nameChange = {chat: false, popout: false};
        alerts.onlineFriends = {chat: false, popout: false};
        alerts.offlineFriends = {chat: false, popout: false};
        alerts.serverStatus = {chat: false, popout: false};
        saveSettings();
        sendMessage("all alerts disabled", type, target, true);
        updateAlertCheckboxes();
    }
    else if (/^\/print ?loot$/i.test(content)) {
        printLoot = !printLoot;
        saveSettings();
        sendMessage(`print loot ${printLoot ? "enabled" : "disabled"}`, type, target, true);
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
        sendMessage("0: off, 1: chat first, 2: answerbox first, 3: only chat, 4: only answerbox", type, target, true);
    }
    else if (/^\/tabswitch [0-4]$/i.test(content)) {
        tabSwitch = parseInt(/^\S+ ([0-4])$/.exec(content)[1]);
        saveSettings();
        if (tabSwitch === 0) {
            sendMessage("tab switch disabled", type, target, true);
        }
        else if (tabSwitch === 1) {
            sendMessage("tab switch set to chat first", type, target, true);
        }
        else if (tabSwitch === 2) {
            sendMessage("tab switch set to answerbox first", type, target, true);
        }
        else if (tabSwitch === 3) {
            sendMessage("tab switch set to only chat", type, target, true);
        }
        else if (tabSwitch === 4) {
            sendMessage("tab switch set to only answerbox", type, target, true);
        }
    }
    else if (/^\/(cs|continue ?sample)$/i.test(content)) {
        continueSample = !continueSample;
        saveSettings();
        sendMessage(`continue sample ${continueSample ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("continueSample");
    }
    else if (/^\/video$/i.test(content)) {
        sendMessage("Options: pause, play, replay, loop", type, target, true);
    }
    else if (/^\/(rv|replay ?video|video replay)$/i.test(content)) {
        let currentVideoPlayer = quizVideoController.getCurrentPlayer();
        currentVideoPlayer.pauseVideo();
        currentVideoPlayer.player.currentTime(currentVideoPlayer.startPoint);
        currentVideoPlayer.player.play();
        currentVideoPlayer.updateVolume(currentVideoPlayer.videoVolume);
    }
    else if (/^\/(rv|replay ?video|video replay) [0-9]+$/i.test(content)) {
        let startPoint = parseInt(/^\/(rv|replay ?video|video replay) ([0-9]+)$/.exec(content)[2]);
        let currentVideoPlayer = quizVideoController.getCurrentPlayer();
        currentVideoPlayer.pauseVideo();
        currentVideoPlayer.player.currentTime(startPoint);
        currentVideoPlayer.player.play();
        currentVideoPlayer.updateVolume(currentVideoPlayer.videoVolume);
    }
    else if (/^\/(pause ?video|stop ?video|video pause|video stop)$/i.test(content)) {
        quizVideoController.getCurrentPlayer().pauseVideo();
    }
    else if (/^\/(play ?video|video play)$/i.test(content)) {
        quizVideoController.getCurrentPlayer().player.play();
    }
    else if (/^\/(lv|loop ?video|video loop)$/i.test(content)) {
        loopVideo = !loopVideo;
        for (let videoPlayer of quizVideoController.moePlayers) {
            videoPlayer.$player[0].loop = loopVideo;
        }
        saveSettings();
        sendMessage(`loop video ${loopVideo ? "enabled" : "disabled"}`, type, target, true);
        updateCommandListWindow("loopVideo");
    }
    else if (/^\/(vs|speed|video speed)( d| default)?$/i.test(content)) {
        playbackSpeed = [];
        sendMessage("song playback speed set to default", type, target, true);
    }
    else if (/^\/(vs|speed|video speed) [0-9.]+$/i.test(content)) {
        let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(option) || option === 0) return;
        playbackSpeed = [option];
        sendMessage(`song playback speed set to ${option}`, type, target, true);
    }
    else if (/^\/(vs|speed|video speed) [0-9.]+[ ,-]+[0-9.]+$/i.test(content)) {
        let low = parseFloat(/^\S+ ([0-9.]+)[ ,-]+[0-9.]+$/.exec(content)[1]);
        let high = parseFloat(/^\S+ [0-9.]+[ ,-]+([0-9.]+)$/.exec(content)[1]);
        if (isNaN(low) || isNaN(high) || low >= high) return;
        playbackSpeed = [low, high];
        sendMessage(`song playback speed set to random # between ${low} - ${high}`, type, target, true);
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
    else if (/^\/(ls|localstorage)$/i.test(content)) {
        if (gameChat.open) {
            setTimeout(() => {
                gameChat.systemMessage(`localStorage: ${Object.keys(localStorage).length} items`, Object.keys(localStorage).join("<br>"));
            }, 1);
        }
    }
    else if (/^\/(ls|localstorage) (import|upload|load)$/i.test(content)) {
        importLocalStorage();
    }
    else if (/^\/(ls|localstorage) (export|download|save)$/i.test(content)) {
        exportLocalStorage();
    }
    else if (/^\/(ls|localstorage) (clear|delete|remove)$/i.test(content)) {
        localStorage.clear();
        sendMessage("all local storage cleared", type, target, true);
    }
    else if (/^\/persist \S+$/i.test(content)) {
        let option = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        for (let key of Object.keys(commandPersist)) {
            if (key.toLowerCase() === option) {
                sendMessage(String(commandPersist[key]), type, target);
            }
        }
    }
    else if (/^\/persist \S+ (t|f|true|false)$/i.test(content)) {
        let option = /^\S+ (\S+) \S+$/.exec(content)[1].toLowerCase();
        let value = /^\S+ \S+ (\S+)$/.exec(content)[1].toLowerCase();
        for (let key of Object.keys(commandPersist)) {
            if (key.toLowerCase() === option) {
                commandPersist[key] = value[0] === "t" ? true : false;
                sendMessage(`${key} persist set to ${commandPersist[key]}`, type, target);
            }
        }
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
        sendMessage("https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js", type, target);
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
    else if (/^\/version .+$/i.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        sendMessage(getScriptVersion(option), type, target);
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
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
        let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b.toLowerCase()]: a})));
        sendMessage(list.map((x) => isNaN(parseInt(x)) ? genreDict[x] : idTranslator.genreNames[x]).filter(Boolean).join(", "), type, target);
    }
    else if (/^\/tagid .+$/i.test(content)) {
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
        let tagDict = Object.assign({}, ...Object.entries(idTranslator.tagNames).map(([a, b]) => ({[b.toLowerCase()]: a})));
        sendMessage(list.map((x) => isNaN(parseInt(x)) ? tagDict[x] : idTranslator.tagNames[x]).filter(Boolean).join(", "), type, target);
    }
    else if (/^\/list \S+ \S+$/i.test(content)) {
        let option = /^\S+ (\S+) \S+$/.exec(content)[1].toLowerCase();
        let username = /^\S+ \S+ (\S+)$/.exec(content)[1].toLowerCase();
        if (option.startsWith("a")) {
            let listener = new Listener("anime list update result", (payload) => {
                listener.unbindListener();
                if (payload.success) {
                    $("#aniListUserNameInput").val(username);
                    sendMessage("anilist set to " + username, type, target, true);
                }
                else {
                    sendMessage("list update failed", type, target, true);
                }
                removeMyanimelist();
                removeKitsu();
            });
            listener.bindListener();
            socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "ANILIST"}});
        }
        else if (option.startsWith("m")) {
            let listener = new Listener("anime list update result", (payload) => {
                listener.unbindListener();
                if (payload.success) {
                    $("#malUserNameInput").val(username);
                    sendMessage("myanimelist set to " + username, type, target, true);
                }
                else {
                    sendMessage("list update failed", type, target, true);
                }
                removeAnilist();
                removeKitsu();
            });
            listener.bindListener();
            socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "MAL"}});
        }
        else if (option.startsWith("k")) {
            let listener = new Listener("anime list update result", (payload) => {
                listener.unbindListener();
                if (payload.success) {
                    $("#kitsuUserNameInput").val(username);
                    sendMessage("kitsu set to " + username, type, target, true);
                }
                else {
                    sendMessage("list update failed", type, target, true);
                }
                removeAnilist();
                removeMyanimelist();
            });
            listener.bindListener();
            socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "KITSU"}});
        }
    }
    else if (/^\/list (off|clear|remove)$/i.test(content)) {
        removeAllLists();
        sendMessage("all lists cleared", type, target, true);
    }
    else if (/^\/(dq|daily|dailies|dailyquests?) (d|detect|auto)$/i.test(content)) {
        let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b]: parseInt(a)})));
        let list = Object.values(qusetContainer.questMap).filter((x) => x.name.includes(" Fan") && x.state !== x.targetState).map((x) => genreDict[x.name.split(" Fan")[0]]);
        if (list.length) {
            sendMessage(`Detected: ${list.map((x) => idTranslator.genreNames[x]).join(", ")}`, type, target, true);
            let anime = genreLookup(list);
            if (anime) {
                sendMessage(anime, type, target);
                matchSettingsToAnime(anime);
                autoThrow = {time: [3000, 5000], text: anime, multichoice: null};
                sendMessage(`auto throwing: ${anime} after 3-5 seconds`, type, target, true);
                updateCommandListWindow("autoThrow");
            }
            else {
                sendMessage("no anime found for those genres", type, target, true);
            }
        }
        else {
            sendMessage("no incomplete genre quests detected", type, target, true);
        }
    }
    else if (/^\/(dq|daily|dailies|dailyquests?) (k|kutd|keepinguptodate)+$/i.test(content)) {
        let anime = "MF Ghost";
        sendMessage(anime, type, target);
        matchSettingsToAnime(anime);
        autoThrow = {time: [3000, 5000], text: anime, multichoice: null};
        sendMessage(`auto throwing: ${anime} after 3-5 seconds`, type, target, true);
        updateCommandListWindow("autoThrow");
    }
    else if (/^\/(dq|daily|dailies|dailyquests?) .+$/i.test(content)) {
        let genreDict = Object.assign({}, ...Object.entries(idTranslator.genreNames).map(([a, b]) => ({[b.toLowerCase()]: parseInt(a)})));
        let list = /^\S+ (.+)$/.exec(content)[1].toLowerCase().split(",").map((x) => genreDict[x.trim()]);
        if (list.length && list.every(Boolean)) {
            let anime = genreLookup(list);
            if (anime) {
                sendMessage(anime, type, target);
                matchSettingsToAnime(anime);
                autoThrow = {time: [3000, 5000], text: anime, multichoice: null};
                sendMessage(`auto throwing: ${anime} after 3-5 seconds`, type, target, true);
                updateCommandListWindow("autoThrow");
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
        let settings = JSON.parse(JSON.stringify(hostModal.DEFUALT_SETTINGS));
        settings.roomName = hostModal.$roomName.val();
        settings.privateRoom = hostModal.$privateCheckbox.is(":checked");
        settings.password = hostModal.$passwordInput.val();
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
    else if (/^\/lookup/i.test(content)) {
        if (!animeAutoCompleteLowerCase.length) return sendMessage("missing autocomplete", type, target, true);;
        let query = /^\/lookup .+$/i.test(content)
            ? /^\S+ (.+)$/.exec(content)[1].toLowerCase()
            : $("#qpAnimeName").text().split("    ").map((x) => x.replaceAll(/\s/g, "")).join(" ").toLowerCase();
        if (!query.includes("_")) return;
        let re = new RegExp("^" + query.split("").map((x) => x === "_" ? "\\S" : x).join("") + "$");
        let results = animeAutoCompleteLowerCase.filter((anime) => re.test(anime));
        if (results.length === 0) {
            sendMessage("no results", type, target);
        }
        else if (results.length === 1) {
            sendMessage(results[0], type, target);
            console.log(`Query: ${query} | 1 Result\n${results[0]}`);
        }
        else {
            sendMessage(results.length + " results (see console)", type, target);
            console.log(`Query: ${query} | ${results.length} Results\n${results.join("\n")}`);
        }
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
        else if (/^\/(fv|forceversion) .+$/i.test(content)) {
            let option = /^\S+ (.+)$/.exec(content)[1];
            sendMessage(getScriptVersion(option), "dm", sender);
        }
        else if (/^\/(fcs|forcecountscripts)$/i.test(content)) {
            sendMessage($("#installedListContainer h4").length, "dm", sender);
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
    if (commands) {
        if (/^\/forceall version$/i.test(content)) {
            sendMessage("0.108", type);
        }
        else if (/^\/forceall version .+$/i.test(content)) {
            let option = /^\S+ \S+ (.+)$/.exec(content)[1];
            sendMessage(getScriptVersion(option), type);
        }
        else if (/^\/forceall count ?scripts$/i.test(content)) {
            sendMessage($("#installedListContainer h4").length, type);
        }
        else if (/^\/forceall roll [0-9]+$/i.test(content)) {
            let number = parseInt(/^\S+ \S+ ([0-9]+)$/.exec(content)[1]);
            sendMessage(Math.floor(Math.random() * number) + 1, type);
        }
        else if (/^\/forceall roll -?[0-9]+ -?[0-9]+$/i.test(content)) {
            let low = parseInt(/^\S+ \S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
            let high = parseInt(/^\S+ \S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
            sendMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low), type);
        }
        else if (/^\/forceall volume$/i.test(content)) {
            sendMessage(volumeController.muted ? "🔇" : `🔉 ${Math.round(volumeController.volume * 100)}%`, type);
        }
        else if (/^\/forceall (hide|hidden) ?status$/i.test(content)) {
            sendMessage(hidePlayers, type);
        }
        else if (/^\/forceall speed$/i.test(content)) {
            if (playbackSpeed.length === 0) sendMessage("speed: default", type);
            else if (playbackSpeed.length === 1) sendMessage(`speed: ${playbackSpeed[0]}x`, type);
            else if (playbackSpeed.length === 2) sendMessage(`speed: random ${playbackSpeed[0]}x - ${playbackSpeed[1]}x`, type);
        }
        else if (/^\/forceall skip$/i.test(content)) {
            if (!quiz.skipController._toggled) quiz.skipClicked();
        }
        else if (/^\/forceall share ?entries$/i.test(content)) {
            sendMessage(options.$MAl_SHARE_CHECKBOX.prop("checked"), type);
        }
        else if (/^\/forceall (dd|dropdown)$/i.test(content)) {
            sendMessage(`dropdown: ${dropdown ? "enabled" : "disabled"}`, type);
        }
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
function sendSystemMessage(message, message2) {
    if (gameChat.open) {
        if (message2) {
            setTimeout(() => { gameChat.systemMessage(String(message), String(message2)) }, 1);
        }
        else {
            setTimeout(() => { gameChat.systemMessage(String(message)) }, 1);
        }
    }
    else if (nexus.inCoopLobby) {
        setTimeout(() => { nexusCoopChat.displayServerMessage({message: String(message)}) }, 1);
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
        if (autoHost === "*") {
            lobby.promoteHost(getRandomOtherPlayer());
        }
        else if (isInYourRoom(autoHost)) {
            lobby.promoteHost(getPlayerNameCorrectCase(autoHost));
        }
    }
    else if (nexus.inCoopLobby && nexusCoopChat.hostName === selfName && Object.keys(nexusCoopChat.playerMap).length > 1) {
        if (autoHost === "*") {
            socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: getRandomOtherPlayer()}});
        }
        else if (isInYourRoom(autoHost)) {
            socket.sendCommand({type: "nexus", command: "nexus promote host", data: {name: getPlayerNameCorrectCase(autoHost)}});
        }
    }
}

// input number of milliseconds of delay, leave and rejoin the room you were in
function rejoinRoom(time) {
    setTimeout(() => {
        if (isSoloMode()) {
            viewChanger.changeView("main");
            setTimeout(() => { hostModal.displayHostSolo() }, time);
            setTimeout(() => { roomBrowser.host() }, time + 100);
        }
        else if (isRankedMode()) {
            let type = hostModal.$roomName.val().split(" ")[1].toUpperCase();
            viewChanger.changeView("main");
            setTimeout(() => {
                if (ranked.currentState === ranked.RANKED_STATE_IDS.LOBBY || ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_LOBBY) {
                    ranked.joinRankedLobby(ranked.RANKED_TYPE_IDS[type]);
                }
                else if (ranked.currentState === ranked.RANKED_STATE_IDS.RUNNING || ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_RUNNING) {
                    ranked.joinRankedGame(ranked.RANKED_TYPE_IDS[type]);
                }
            }, time);
        }
        else if (lobby.inLobby) {
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

// log out, log in, and rejoin the room you were in
function relog() {
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
    if (autoVoteSkip === "valid") list.push("Auto Vote Skip: on first valid answer");
    else if (autoVoteSkip.length) list.push("Auto Vote Skip: Enabled");
    if (autoKey) list.push("Auto Key: Enabled");
    if (autoCopy) list.push("Auto Copy: " + autoCopy);
    if (autoThrow.text) list.push("Auto Throw: " + autoThrow.text);
    if (autoThrow.multichoice) list.push("Auto Throwing Multi Choice Option: " + autoThrow.multichoice);
    if (autoMute.mute.length === 1) list.push(`Auto Mute: ${autoMute.mute[0] / 1000}s`);
    else if (autoMute.mute.length === 2) list.push(`Auto Mute: random ${autoMute.mute[0] / 1000}s - ${autoMute.mute[1] / 1000}s`);
    else if (autoMute.unmute.length === 1) list.push(`Auto Unmute: ${autoMute.unmute[0] / 1000}s`);
    else if (autoMute.unmute.length === 2) list.push(`Auto Unmute: random ${autoMute.unmute[0] / 1000}s - ${autoMute.unmute[1] / 1000}s`);
    else if (autoMute.toggle.length) list.push(`Auto Mute Toggle: ${autoMute.toggle.map((x) => x / 1000).join(", ")}`);
    else if (autoMute.randomMute) list.push(`Auto Mute Random: ${autoMute.randomMute / 1000}s`);
    else if (autoMute.randomUnmute) list.push(`Auto Unmute Random: ${autoMute.randomUnmute / 1000}s`);
    if (autoReady) list.push("Auto Ready: Enabled");
    if (autoStart) list.push("Auto Start: Enabled");
    if (autoHost) list.push("Auto Host: " + autoHost);
    if (autoInvite) list.push("Auto Invite: " + autoInvite);
    if (autoAcceptInvite) list.push("Auto Accept Invite: Enabled");
    if (autoVoteLobby) list.push("Auto Vote Lobby: Enabled");
    if (autoSwitch) list.push("Auto Switch: " + autoSwitch);
    if (autoStatus) list.push("Auto Status: " + autoStatus);
    if (autoJoinRoom) list.push("Auto Join Room: " + autoJoinRoom.id);
    if (autoDownloadSong.length) list.push("Auto Download Song: " + autoDownloadSong.join(", "));
    return list;
}

// get the version of any script that uses joseph's script info
function getScriptVersion(input) {
    input = input.toLowerCase();
    let $items = $("#installedListContainer h4");
    for (let item of $items) {
        let scriptName = $(item).find(".name").text().toLowerCase();
        if (input === scriptName) {
            let scriptVersion = $(item).find(".version").text();
            return scriptVersion ? scriptVersion : "installed, unknown version";
        }
    }
    return "not found";
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
        if (tabSwitch === 1) {
            if (quiz.answerInput.typingInput.$input.is(":focus")) {
                gameChat.$chatInputField.focus();
            }
            else if (gameChat.$chatInputField.is(":focus")) {
                quiz.answerInput.typingInput.$input.focus();
            }
            else {
                gameChat.$chatInputField.focus();
            }
        }
        else if (tabSwitch === 2) {
            if (quiz.answerInput.typingInput.$input.is(":focus")) {
                gameChat.$chatInputField.focus();
            }
            else if (gameChat.$chatInputField.is(":focus")) {
                quiz.answerInput.typingInput.$input.focus();
            }
            else {
                quiz.answerInput.typingInput.$input.focus();
            }
        }
        else if (tabSwitch === 3) {
            gameChat.$chatInputField.focus();
        }
        else if (tabSwitch === 4) {
            quiz.answerInput.typingInput.$input.focus();
        }
    }, 10);
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

// override replayVideo function for sample continue
QuizVideoController.prototype.replayVideo = function() {
    if (!continueSample) {
        this.getCurrentPlayer().replayVideo();
    }
    this.getCurrentPlayer().show();
};

// hide player names and avatars in lobby
function lobbyHidePlayers() {
    $(".lobbyAvatarPlayerOptions").addClass("hide");
    for (let player of Object.values(lobby.players)) {
        if (player._name !== selfName && !player.hidden) {
            player.hidden = true;
            player.textColor = player.lobbySlot.$NAME_CONTAINER.css("color");
            player.lobbySlot.$IS_HOST_CONTAINER.addClass("hide");
            player.lobbySlot.avatarIconDisplayHandler.$container.addClass("hide");
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
            player.lobbySlot.avatarIconDisplayHandler.$container.removeClass("hide");
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
            player.avatarSlot.$avatarImageContainer.addClass("hide");
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
            player.avatarSlot.$avatarImageContainer.removeClass("hide");
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

// remove anilist
function removeAnilist() {
    if ($("#aniListLastUpdateDate").text()) {
        $("#aniListUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "ANILIST"}});
    }
}

// remove myaniemlist
function removeMyanimelist() {
    if ($("#malLastUpdateDate").text()) {
        $("#malUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "MAL"}});
    }
}

// remove kitsu
function removeKitsu() {
    if ($("#kitsuLastUpdated").text()) {
        $("#kitsuUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "KITSU"}});
    }
}

// remove all lists
function removeAllLists() {
    removeAnilist();
    removeMyanimelist();
    removeKitsu();
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

// format song url, handle bad data
function formatURL(url) {
    if (url) {
        if (url.startsWith("http")) {
            return url;
        }
        else {
            return videoResolver.formatUrl(url);
        }
    }
    else {
        return "";
    }
}

// download audio/video file from url
async function downloadSong(url) {
    if (!url) return;
    let blob = await fetch(url).then(response => response.blob()).then(blob => window.URL.createObjectURL(blob));
    let fileName = url.split("/").slice(-1)[0];
    let element = document.createElement("a");
    element.setAttribute("href", blob);
    element.setAttribute("download", fileName);
    document.body.appendChild(element);
    element.click();
    element.remove();
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

// import local storage
function importLocalStorage() {
    $("body").remove("#uploadLocalStorageInput").append($(`<input type="file" id="uploadLocalStorageInput" style="display: none"></input>`).on("change", function() {
        if (this.files.length) {
            this.files[0].text().then((data) => {
                try {
                    let json = JSON.parse(data);
                    if (typeof json !== "object" || !Object.values(json).every((x) => typeof x === "string")) {
                        displayMessage("Upload Error");
                    }
                    else {
                        let keys = Object.keys(json);
                        for (let key of keys) {
                            localStorage.setItem(key, json[key]);
                        }
                        displayMessage(`${keys.length} item${keys.length === 1 ? "" : "s"} loaded into local storage`);
                    }
                }
                catch {
                    displayMessage("Upload Error");
                }
                finally {
                    $(this).remove();
                }
            });
        }
    }));
    $("#uploadLocalStorageInput").trigger("click");
}

// export local storage
function exportLocalStorage() {
    let storage = {};
    for (let key of Object.keys(localStorage)) {
        storage[key] = localStorage[key];
    }
    delete storage["__paypal_storage__"];
    let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storage));
    let $element = $("<a></a>").attr("href", data).attr("download", "amq local storage backup.json");
    $("body").append($element);
    $element.trigger("click").remove();
}

// apply styles
function applyStyles() {
    $("#megaCommandsStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "megaCommandsStyle";
    let text = `
        .mcCommandTitle {
            margin: 0 5px;
            display: inline-block;
        }
        .mcCommandButton {
            width: 36px;
            padding: 4px 0;
            display: inline-block;
        }
        .mcCommandRow select, .mcCommandRow input {
            color: black;
        }
        .mcDocumentationRow {
            padding-bottom: 5px;
            line-height: normal;
        }
        .mcDocumentationHeading {
            font-size: 22px;
            font-weight: bold;
            text-align: center;
        }
        .mcDocumentationCommand {
            font-size: 18px;
            cursor: pointer;
            user-select: none;
        }
        .mcDocumentationAlias {
            margin: 0 10px;
        }
        .mcDocumentationParameters {
            margin: 0 10px;
        }
        .mcDocumentationDescription {
            opacity: .8;
            margin-left: 20px;
        }
        #mcHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #mcHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #mcHotkeyTable select, #mcHotkeyTable input {
            color: black;
        }
        #mcAlertsTable th {
            font-weight: bold;
            padding: 0px 20px 5px 0;
        }
        #mcAlertsTable td {
            padding: 5px 20px 5px 0;
        }
        #mcAlertsTable .customCheckbox {
            vertical-align: middle;
        }
    `;
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
    settings.alerts = alerts;
    settings.autoJoinRoom = autoJoinRoom;
    settings.backgroundURL = backgroundURL;
    settings.commandPersist = commandPersist;
    //settings.commands = commands;
    //settings.hidePlayers = hidePlayers;
    settings.enableAllProfileButtons = enableAllProfileButtons;
    settings.hotKeys = hotKeys;
    settings.lastUsedVersion = version;
    settings.malClientId = malClientId;
    settings.playerDetection = playerDetection;
    settings.printLoot = printLoot;
    settings.reorder = reorder;
    settings.selfDM = selfDM;
    settings.tabSwitch = tabSwitch;
    if (commandPersist.autoAcceptInvite) settings.autoAcceptInvite = autoAcceptInvite;
    if (commandPersist.autoCopy) settings.autoCopy = autoCopy;
    if (commandPersist.autoDownloadSong) settings.autoDownloadSong = autoDownloadSong;
    if (commandPersist.autoHost) settings.autoHost = autoHost;
    if (commandPersist.autoInvite) settings.autoInvite = autoInvite;
    if (commandPersist.autoKey) settings.autoKey = autoKey;
    if (commandPersist.autoMute) settings.autoMute = autoMute;
    if (commandPersist.autoReady) settings.autoReady = autoReady;
    if (commandPersist.autoStart) settings.autoStart = autoStart;
    if (commandPersist.autoStatus) settings.autoStatus = autoStatus;
    if (commandPersist.autoSwitch) settings.autoSwitch = autoSwitch;
    if (commandPersist.autoThrow) settings.autoThrow = autoThrow;
    if (commandPersist.autoVoteLobby) settings.autoVoteLobby = autoVoteLobby;
    if (commandPersist.autoVoteSkip) settings.autoVoteSkip = autoVoteSkip;
    if (commandPersist.continueSample) settings.continueSample = continueSample;
    if (commandPersist.dropdown) settings.dropdown = dropdown;
    if (commandPersist.dropdownInSpec) settings.dropdownInSpec = dropdownInSpec;
    if (commandPersist.loopVideo) settings.loopVideo = loopVideo;
    if (commandPersist.muteReplay) settings.muteReplay = muteReplay;
    if (commandPersist.muteSubmit) settings.muteSubmit = muteSubmit;
    if (commandPersist.playbackSpeed) settings.playbackSpeed = playbackSpeed;
    localStorage.setItem("megaCommands", JSON.stringify(settings));
}
