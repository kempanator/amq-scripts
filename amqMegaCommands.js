// ==UserScript==
// @name            AMQ Mega Commands
// @namespace       https://github.com/kempanator
// @version         0.19
// @description     Commands for AMQ Chat
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
// ==/UserScript==

/*
IMPORTANT: disable dice roller by thejoseph98 and chat commands by nyamu before installing

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
/autosubmit           automatically submit answer on each key press
/autothrow [text]     automatically send answer at the beginning of each song
/autocopy [name]      automatically copy a team member's answer
/automute [seconds]   automatically mute sound during quiz after # of seconds
/autounmute [seconds] automatically unmute sound during quiz after # of seconds
/autoready            automatically ready up in lobby
/autostart            automatically start the game when everyone is ready if you are host
/autohost [name]      automatically promote player to host if you are the current host
/autoinvite [name]    automatically invite a player to your room when they log in (only friends)
/autoaccept           automatically accept game invites if you aren't in a room (only friends)
/ready                ready/unready in lobby
/answer [text]        submit answer
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
/dropdown             enable/disable anime dropdown

OTHER
/roll                 roll number, player, playerteam, spectator
/rules                show list of gamemodes and rules
/info                 show list of external utilities
/clear                clear chat
/pm [name] [text]     private message a player
/profile [name]       show profile window of any player
/leaderboard          show the leaderboard
/password             reveal private room password
/invisible            show invisible friends (this command might be broken)
/logout               log out
/version              check the version of this script
/commands [on|off]    turn this script on or off
*/

if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.19";
let commands = true;
let auto_skip = false;
let auto_submit_answer;
let auto_throw = "";
let auto_copy_player = "";
let auto_mute_delay = 0;
let auto_ready;
let auto_start = false;
let auto_host = "";
let auto_invite = "";
let auto_accept_invite;
let auto_status;
let dropdown = true;
let anime_list;
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
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js",
    "1saudio": "https://github.com/xSardine/AMQ-Stuff/raw/main/1SecondAudio/1Second_Audio.user.js"
};
const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};

function setup() {
    auto_submit_answer = localStorage.getItem("mega_commands_auto_submit_answer") === "true";
    auto_ready = localStorage.getItem("mega_commands_auto_ready") === "true";
    auto_accept_invite = localStorage.getItem("mega_commands_auto_accept_invite") === "true";
    auto_status = localStorage.getItem("mega_commands_auto_status");
    if (auto_status === "do not disturb") socialTab.socialStatus.changeSocialStatus(2);
    if (auto_status === "away") socialTab.socialStatus.changeSocialStatus(3);
    if (auto_status === "invisible") socialTab.socialStatus.changeSocialStatus(4);
    new Listener("game chat update", (payload) => {
        payload.messages.forEach((message) => { parseChat(message) });
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        parseChat(payload);
    }).bindListener();
    new Listener("chat message", (payload) => {
        parseIncomingPM(payload);
    }).bindListener();
    new Listener("chat message response", (payload) => {
        parsePM(payload);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (auto_throw) quiz.answerInput.setNewAnswer(auto_throw);
            if (auto_skip) setTimeout(() => { quiz.skipClicked() }, 200);
        }
        if (auto_mute_delay) {
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, auto_mute_delay);
        }
        if (auto_unmute_delay) {
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(true);
            volumeController.adjustVolume();
            setTimeout(() => {
                document.querySelector("#qpVolume").classList.remove("disabled");
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }, auto_unmute_delay);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (auto_skip) sendSystemMessage("Auto Skip: Enabled");
        if (auto_submit_answer) sendSystemMessage("Auto Submit Answer: Enabled");
        if (auto_copy_player) sendSystemMessage("Auto Copy: " + auto_copy_player);
        if (auto_throw) sendSystemMessage("Auto Throw: " + auto_throw);
        if (auto_mute_delay) sendSystemMessage("Auto Mute: " + (auto_mute_delay / 1000) + "s");
        if (auto_unmute_delay) sendSystemMessage("Auto Unmute: " + (auto_unmute_delay / 1000) + "s");
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (auto_copy_player && auto_copy_player === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let current_text = document.querySelector("#qpAnswerInput").value;
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(current_text);
        }
    }).bindListener();
    new Listener("guess phase over", (payload) => {
        if (auto_mute_delay || auto_unmute_delay) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
	}).bindListener();
    new Listener("answer results", (payload) => {
        if (auto_mute_delay || auto_unmute_delay) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
    }).bindListener();
    new Listener("quiz over", (payload) => {
        document.querySelector("#qpVolume").classList.remove("disabled");
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.error) return;
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
        if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
        if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
        if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.error) return;
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
        if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
        if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
        if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
    }).bindListener();
    new Listener("New Player", (payload) => {
        setTimeout(() => {
            if (auto_host === payload.name.toLowerCase() && lobby.inLobby && lobby.isHost) {
                lobby.promoteHost(payload.name);
            }
        }, 1);
    }).bindListener();
    new Listener("New Spectator", (payload) => {
        setTimeout(() => {
            if (auto_host === payload.name.toLowerCase() && lobby.inLobby && lobby.isHost) {
                lobby.promoteHost(payload.name);
            }
        }, 1);
    }).bindListener();
    new Listener("Player Ready Change",  (payload) => {
        autoStart();
    }).bindListener();
    new Listener("Room Settings Changed", (payload) => {
        setTimeout(() => { autoReady() }, 1);
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (payload.name === selfName) {
            setTimeout(() => { autoReady(); autoStart(); }, 1);
        }
    }).bindListener();
    new Listener("Host Promotion", (payload) => {
        if (auto_host && payload.newHost === selfName) {
            if (auto_host === "{random}") {
                lobby.promoteHost(getRandomOtherPlayer());
            }
            else if (isInYourRoom(auto_host)) {
                lobby.promoteHost(getPlayerNameCorrectCase(auto_host));
            }
        }
        setTimeout(() => { autoReady() }, 1);
    }).bindListener();
    new Listener("game invite", (payload) => {
        if (auto_accept_invite && !inRoom() && isFriend(payload.sender)) {
            roomBrowser.fireSpectateGame(payload.gameId, undefined, true);
        }
    }).bindListener();
    new Listener("friend state change", (payload) => {
        if (payload.online && auto_invite === payload.name.toLowerCase() && inRoom() && !isInYourRoom(auto_invite) && !isSoloMode() && !isRankedMode()) {
            sendSystemMessage(payload.name + " online: auto inviting");
            setTimeOut(() => { socket.sendCommand({ type: "social", command: "invite to game", data: { target: payload.name } }), 1000 });
        }
    }).bindListener();
    document.querySelector("#qpAnswerInput").addEventListener("input", (event) => {
        let answer = event.target.value || " ";
        if (auto_submit_answer) {
            socket.sendCommand({ type: "quiz", command: "quiz answer", data: { answer, isPlaying: true, volumeAtMax: false } });
        }
    });
    const profile_element = document.querySelector("#playerProfileLayer");
    new MutationObserver(function() {
        if (profile_element.querySelector(".ppFooterOptionIcon, .startChat")) {
            profile_element.querySelector(".ppFooterOptionIcon, .startChat").classList.remove("disabled");
        }
    }).observe(profile_element, {childList: true});
    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        description: `<a href="https://kempanator.github.io/amq-mega-commands" target="_blank">https://kempanator.github.io/amq-mega-commands</a>`
    });
}

function parseChat(message) {
    if (message.sender !== selfName || isRankedMode()) return;
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
    else if (/^\/roll$/.test(content)) {
        sendSystemMessage("roll commands: #, player, playerteam, spectator");
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
    else if (/^\/roll (pt|playerteams?|teams?)$/.test(content)) {
        if (lobby.settings.teamSize > 1) {
            let teamDictionary = getTeamDictionary();
            if (Object.keys(teamDictionary).length > 0) {
                let teams = Object.keys(teamDictionary);
                teams.sort((a, b) => parseInt(a) - parseInt(b));
                for (let team of teams) {
                    let name = teamDictionary[team][Math.floor(Math.random() * teamDictionary[team].length)];
                    sendChatMessage(`Team ${team}: ${name}`, isTeamMessage);
                }
            }
        }
        else {
            sendSystemMessage("team size must be greater than 1");
        }
    }
    else if (/^\/roll (s|spectators?)$/.test(content)) {
        let list = getSpectatorList();
        sendChatMessage(list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators", isTeamMessage);
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
        socket.sendCommand({ type:"quiz", command:"quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause") });
    }
    else if (/^\/autoskip$/.test(content)) {
        auto_skip = !auto_skip;
        sendSystemMessage("auto skip " + (auto_skip ? "enabled" : "disabled"));
    }
    else if (/^\/autosubmit$/.test(content)) {
        auto_submit_answer = !auto_submit_answer;
        localStorage.setItem("mega_commands_auto_submit_answer", auto_submit_answer);
        sendSystemMessage("auto submit answer " + (auto_submit_answer ? "enabled" : "disabled"));
    }
    else if (/^\/(at|autothrow)$/.test(content)) {
        auto_throw = "";
        sendSystemMessage("auto throw disabled " + auto_copy_player);
    }
    else if (/^\/(at|autothrow) .+$/.test(content)) {
        auto_throw = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendSystemMessage("auto throwing: " + auto_throw);
    }
    else if (/^\/(ac|autocopy)$/.test(content)) {
        auto_copy_player = "";
        sendSystemMessage("auto copy disabled");
    }
    else if (/^\/(ac|autocopy) \w+$/.test(content)) {
        auto_copy_player = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto copying " + auto_copy_player);
    }
    else if (/^\/(am|automute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_mute_delay = 0;
        auto_unmute_delay = 0;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds) || seconds <= 0) return;
        auto_mute_delay = seconds * 1000;
        auto_unmute_delay = 0;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_unmute_delay = 0;
        auto_mute_delay = 0;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds) || seconds <= 0) return;
        auto_unmute_delay = seconds * 1000;
        auto_mute_delay = 0;
        sendSystemMessage("auto unmuting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/autoready$/.test(content)) {
        auto_ready = !auto_ready;
        localStorage.setItem("mega_commands_auto_ready", auto_ready);
        sendSystemMessage("auto ready " + (auto_ready ? "enabled" : "disabled"));
        autoReady();
    }
    else if (/^\/autostart$/.test(content)) {
        auto_start = !auto_start;
        sendSystemMessage("auto start game " + (auto_start ? "enabled" : "disabled"));
        autoStart();
    }
    else if (/^\/autohost$/.test(content)) {
        auto_host = "";
        sendSystemMessage("auto host disabled");
    }
    else if (/^\/autohost \S+$/.test(content)) {
        auto_host = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto hosting " + auto_host);
        if (lobby.inLobby && lobby.isHost && isInYourRoom(auto_host)) { 
            lobby.promoteHost(getPlayerNameCorrectCase(auto_host));
        }
    }
    else if (/^\/autoinvite$/.test(content)) {
        auto_invite = "";
        sendSystemMessage("auto invite disabled");
    }
    else if (/^\/autoinvite \w+$/.test(content)) {
        auto_invite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto inviting " + auto_invite);
    }
    else if (/^\/autoaccept$/.test(content)) {
        auto_accept_invite = !auto_accept_invite;
        localStorage.setItem("mega_commands_auto_accept_invite", auto_accept_invite);
        sendSystemMessage("auto accept invite " + (auto_accept_invite ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        sendSystemMessage("online, away, do not disturb, invisible");
    }
    else if (/^\/autostatus (online|away|do not disturb|invisible)$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        auto_status = option;
        localStorage.setItem("mega_commands_auto_status", auto_status);
        sendSystemMessage("auto status " + auto_status);
    }
    else if (/^\/ready$/.test(content)) {
        if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
            lobby.fireMainButtonEvent();
        }
    }
    else if (/^\/answer .+$/.test(content)) {
        let answer = /^\S+ (.+)$/.exec(content)[1];
        quiz.answerInput.setNewAnswer(answer);
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
        setTimeout(() => {
            for (let element of document.querySelector("#gcMessageContainer").querySelectorAll("li")) {
                element.remove();
            }
        }, 1);
    }
    else if (/^\/dropdown$/.test(content)) {
        dropdown = !dropdown;
        sendSystemMessage("dropdown " + (dropdown ? "enabled" : "disabled"));
        quiz.answerInput.autoCompleteController.newList();
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
    else if (/^\/(pm|dm)$/.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(pm|dm) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(pm|dm) \w+ .+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
    }
    else if (/^\/(prof|profile) \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/leaderboards?$/.test(content)) {
        leaderboardModule.show();
    }
    else if (/^\/rules$/.test(content)) {
        sendChatMessage(Object.keys(rules).join(", "), isTeamMessage);
    }
    else if (/^\/rules .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in rules) sendChatMessage(rules[option], isTeamMessage);
    }
    else if (/^\/scripts$/.test(content)) {
        sendChatMessage(Object.keys(scripts).join(", "), isTeamMessage);
    }
    else if (/^\/scripts .+$/.test(content)) {
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
    else if (/^\/commands$/.test(content)) {
        sendSystemMessage("on, off, help, link, version");
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
            sendChatMessage("https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js", isTeamMessage);
        }
        else if (option === "version") {
            sendChatMessage(version, isTeamMessage);
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
        if (Object.keys(lobby.players).length < n) { sendChatMessage("not enough people"); return; }
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
}

function parsePM(message) {
    if (message.msg === "/commands on") commands = true;
    if (!commands) return;
    let content = message.msg;
    if (/^\/roll [0-9]+$/.test(content)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(content)[1]);
        sendPM(message.target, "rolls " + (Math.floor(Math.random() * number) + 1));
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(content)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(content)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(content)[1]);
        sendPM(message.target, "rolls " + (Math.floor(Math.random() * (high - low + 1)) + low));
    }
    else if (/^\/autoskip$/.test(content)) {
        auto_skip = !auto_skip;
        sendSystemMessage("auto skip " + (auto_skip ? "enabled" : "disabled"));
    }
    else if (/^\/autosubmit$/.test(content)) {
        auto_submit_answer = !auto_submit_answer;
        localStorage.setItem("mega_commands_auto_submit_answer", auto_submit_answer);
        sendSystemMessage("auto submit answer " + (auto_submit_answer ? "enabled" : "disabled"));
    }
    else if (/^\/(at|autothrow)$/.test(content)) {
        auto_throw = "";
        sendSystemMessage("auto throw disabled " + auto_copy_player);
    }
    else if (/^\/(at|autothrow) .+$/.test(content)) {
        auto_throw = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(content)[1]).text;
        sendSystemMessage("auto throwing: " + auto_throw);
    }
    else if (/^\/(ac|autocopy)$/.test(content)) {
        auto_copy_player = "";
        sendSystemMessage("auto copy disabled");
    }
    else if (/^\/(ac|autocopy) \w+$/.test(content)) {
        auto_copy_player = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto copying " + auto_copy_player);
    }
    else if (/^\/(am|automute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_mute_delay = 0;
        auto_unmute_delay = 0;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds) || seconds <= 0) return;
        auto_mute_delay = seconds * 1000;
        auto_unmute_delay = 0;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_unmute_delay = 0;
        auto_mute_delay = 0;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds) || seconds <= 0) return;
        auto_unmute_delay = seconds * 1000;
        auto_mute_delay = 0;
        sendSystemMessage("auto unmuting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/autoready$/.test(content)) {
        auto_ready = !auto_ready;
        localStorage.setItem("mega_commands_auto_ready", auto_ready);
        sendSystemMessage("auto ready " + (auto_ready ? "enabled" : "disabled"));
        autoReady();
    }
    else if (/^\/autostart$/.test(content)) {
        auto_start = !auto_start;
        sendSystemMessage("auto start game " + (auto_start ? "enabled" : "disabled"));
        autoStart();
    }
    else if (/^\/autohost$/.test(content)) {
        auto_host = "";
        sendSystemMessage("auto host disabled");
    }
    else if (/^\/autohost \S+$/.test(content)) {
        auto_host = /^\S+ (\S+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto hosting " + auto_host);
        if (lobby.inLobby && lobby.isHost && isInYourRoom(auto_host)) { 
            lobby.promoteHost(getPlayerNameCorrectCase(auto_host));
        }
    }
    else if (/^\/autoinvite$/.test(content)) {
        auto_invite = "";
        sendSystemMessage("auto invite disabled");
    }
    else if (/^\/autoinvite \w+$/.test(content)) {
        auto_invite = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        sendSystemMessage("auto inviting " + auto_invite);
    }
    else if (/^\/autoaccept$/.test(content)) {
        auto_accept_invite = !auto_accept_invite;
        localStorage.setItem("mega_commands_auto_accept_invite", auto_accept_invite);
        sendSystemMessage("auto accept invite " + (auto_accept_invite ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        sendSystemMessage("online, away, do not disturb, invisible");
    }
    else if (/^\/autostatus (online|away|do not disturb|invisible)$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        auto_status = option;
        localStorage.setItem("mega_commands_auto_status", auto_status);
        sendSystemMessage("auto status " + auto_status);
    }
    else if (/^\/(pm|dm)$/.test(content)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(pm|dm) \w+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+)$/.exec(content)[1]);
        socialTab.startChat(name);
    }
    else if (/^\/(pm|dm) \w+ .+$/.test(content)) {
        let name = getPlayerNameCorrectCase(/^\S+ (\w+) .+$/.exec(content)[1]);
        let text = /^\S+ \w+ (.+)$/.exec(content)[1];
        socialTab.startChat(name);
        socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
    }
    else if (/^\/(prof|profile) \w+$/.test(content)) {
        let name = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        playerProfileController.loadProfile(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/leaderboards?$/.test(content)) {
        leaderboardModule.show();
    }
    else if (/^\/invisible$/.test(content)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = Object.keys(socialTab.offlineFriends).filter((name) => onlineUsers.includes(name));
            sendPM(message.target, list.length > 0 ? list.join(", ") : "no invisible friends detected");
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({ type: "social", command: "get online users" });
    }
    else if (/^\/rules$/.test(content)) {
        sendPM(message.target, Object.keys(rules).join(", "));
    }
    else if (/^\/rules .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in rules) sendPM(message.target, rules[option]);
    }
    else if (/^\/scripts$/.test(content)) {
        sendChatMessage(Object.keys(scripts).join(", "), isTeamMessage);
    }
    else if (/^\/scripts .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in scripts) sendChatMessage(scripts[option], isTeamMessage);
    }
    else if (/^\/info$/.test(content)) {
        sendPM(message.target, Object.keys(info).join(", "));
    }
    else if (/^\/info .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in info) sendPM(message.target, info[option]);
    }
    else if (/^\/leave$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
    }
    else if (/^\/(logout|logoff)$/.test(content)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
        setTimeout(() => { options.logout() }, 10);
    }
    else if (/^\/commands$/.test(content)) {
        sendPM(message.target, "on, off, help, link, version");
    }
    else if (/^\/commands \w+$/.test(content)) {
        let option = /^\S+ (\w+)$/.exec(content)[1].toLowerCase();
        if (option === "on") {
            commands = true;
            sendPM(message.target, "Mega Commands enabled");
        }
        else if (option === "off") {
            commands = false;
            sendPM(message.target, "Mega Commands disabled");
        }
        else if (option === "help") {
            sendPM(message.target, "https://kempanator.github.io/amq-mega-commands");
        }
        else if (option === "link") {
            sendPM(message.target, "https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js");
        }
        else if (option === "version") {
            sendPM(message.target, version);
        }
    }
    else if (/^\/version$/.test(content)) {
        sendPM(message.target, "Mega Commands version " + version);
    }
    if (inRoom()) {
        if (/^\/players$/.test(content)) {
            sendPM(message.target, getPlayerList().map((player) => player.toLowerCase()).join(", "));
        }
        else if (/^\/spectators$/.test(content)) {
            sendPM(message.target, getSpectatorList().map((player) => player.toLowerCase()).join(", "));
        }
        else if (/^\/roll (p|players?)$/.test(content)) {
            let list = getPlayerList();
            sendPM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no players");
        }
        else if (/^\/roll (pt|playerteams?|teams?)$/.test(content)) {
            if (lobby.settings.teamSize > 1) {
                let teamDictionary = getTeamDictionary();
                if (Object.keys(teamDictionary).length > 0) {
                    let teams = Object.keys(teamDictionary);
                    teams.sort((a, b) => parseInt(a) - parseInt(b));
                    for (let team of teams) {
                        let name = teamDictionary[team][Math.floor(Math.random() * teamDictionary[team].length)];
                        sendPM(message.target, `Team ${team}: ${name}`);
                    }
                }
            }
            else {
                sendPM(message.target, "team size must be greater than 1");
            }
        }
        else if (/^\/roll (s|spectators?)$/.test(content)) {
            let list = getSpectatorList();
            sendPM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators");
        }
        else if (/^\/ready$/.test(content)) {
            if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
        }
        else if (/^\/answer .+$/.test(content)) {
            let answer = /^\S+ (.+)$/.exec(content)[1];
            quiz.answerInput.setNewAnswer(answer);
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
        else if (/^\/dropdown$/.test(content)) {
            dropdown = !dropdown;
            sendPM(message.target, "dropdown " + (dropdown ? "enabled" : "disabled"));
            quiz.answerInput.autoCompleteController.newList();
        }
        else if (/^\/password$/.test(content)) {
            let password = hostModal.getSettings().password;
            if (password) sendPM(message.target, password);
        }
    }
}

function parseIncomingPM(message) {
    let content = message.message;
    if (isFriend(message.sender)) {
        if (content === "/forceversion") {
            sendPM(message.sender, version);
        }
        else if (content === "/forceinvite" && inRoom()) {
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: message.sender } });
        }
        else if (content === "/forcehost" && lobby.inLobby && lobby.isHost) {
            lobby.promoteHost(message.sender);
        }
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
    return lobby.inLobby || quiz.inQuiz || battleRoyal.inView;
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
            let name = lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner").querySelector("h2").innerText;
            let team = lobbyAvatar.querySelector(".lobbyAvatarTeamContainer").querySelector("h3").innerText;
            if (isNaN(parseInt(team))) {
                sendChatMessage("Error: can't get team number for " + name);
                return {};
            }
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

// return a random player name in the room besides yourself
function getRandomOtherPlayer() {
    let list = getPlayerList().filter((player) => player !== selfName);
    return list[Math.floor(Math.random() * list.length)];
}

// send a regular public message in game chat
function sendChatMessage(message, isTeamMessage) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: { msg: message, teamMessage: Boolean(isTeamMessage) }
    });
}

// send a client side message to game chat
function sendSystemMessage(message) {
    setTimeout(() => { gameChat.systemMessage(message) }, 1);
}

// send a private message
function sendPM(target, message) {
    setTimeout(() => {
        socket.sendCommand({
            type: "social",
            command: "chat message",
            data: { target: target, message: message }
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

// check conditions and ready up in lobby
function autoReady() {
    if (auto_ready && lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
        lobby.fireMainButtonEvent();
    }
}

// check conditions and start game
function autoStart() {
    setTimeout(() => {
        if (auto_start) {
            for (let player of Object.values(lobby.players)) {
                if (!player.ready) return;
            }
            lobby.fireMainButtonEvent();
        }
    }, 1);
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

// overload changeView function for auto ready
ViewChanger.prototype.changeView = (function() {
    let old = ViewChanger.prototype.changeView;
    return function() {
        old.apply(this, arguments);
        setTimeout(() => {
            if (viewChanger.currentView === "lobby") {
                autoReady();
                autoStart();
            }
        }, 1);
    }
})();

// overload newList function for drop down disable
const oldNewList = AutoCompleteController.prototype.newList;
AutoCompleteController.prototype.newList = function() {
    if (this.list.length > 0) anime_list = this.list;
    this.list = dropdown ? anime_list : [];
    oldNewList.apply(this, arguments);
}
