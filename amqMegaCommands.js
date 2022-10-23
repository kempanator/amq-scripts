// ==UserScript==
// @name            AMQ Mega Commands
// @namespace       https://github.com/kempanator
// @version         0.28
// @description     Commands for AMQ Chat
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
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
/dropdown             enable/disable anime dropdown

OTHER
/roll                 roll number, player, playerteam, spectator
/rules                show list of gamemodes and rules
/info                 show list of external utilities
/clear                clear chat
/dm [name] [text]     direct message a player
/profile [name]       show profile window of any player
/leaderboard          show the leaderboard
/password             reveal private room password
/invisible            show invisible friends (this command might be broken)
/logout               log out
/relog                log out, log in, and auto join the room you were in
/version              check the version of this script
/commands [on|off]    turn this script on or off
*/

if (document.querySelector("#startPage")) {
    if (JSON.parse(localStorage.getItem("mega_commands_auto_join_room")) && document.querySelector(".loginMainForm h1").innerText === "Account Already Online") {
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

const version = "0.28";
let commands = true;
let auto_vote_skip = null;
let auto_submit_answer;
let auto_throw = "";
let auto_copy_player = "";
let auto_mute_delay = null;
let auto_unmute_delay = null;
let auto_ready;
let auto_start = false;
let auto_host = "";
let auto_invite = "";
let auto_accept_invite;
let auto_join_room;
let auto_switch = "";
let auto_vote_lobby;
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
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js"
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
    auto_join_room = JSON.parse(localStorage.getItem("mega_commands_auto_join_room"));
    auto_vote_lobby = localStorage.getItem("mega_commands_auto_vote_lobby") === "true";
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
            if (auto_vote_skip !== null) setTimeout(() => { quiz.skipClicked() }, auto_vote_skip);
        }
        if (auto_mute_delay !== null) {
            document.querySelector("#qpVolume").classList.add("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
            setTimeout(() => {
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }, auto_mute_delay);
        }
        if (auto_unmute_delay !== null) {
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
        if (auto_vote_skip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
        if (auto_submit_answer) sendSystemMessage("Auto Submit Answer: Enabled");
        if (auto_copy_player) sendSystemMessage("Auto Copy: " + auto_copy_player);
        if (auto_throw) sendSystemMessage("Auto Throw: " + auto_throw);
        if (auto_mute_delay !== null) sendSystemMessage("Auto Mute: " + (auto_mute_delay / 1000) + "s");
        if (auto_unmute_delay !== null) sendSystemMessage("Auto Unmute: " + (auto_unmute_delay / 1000) + "s");
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (auto_copy_player && auto_copy_player === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let current_text = document.querySelector("#qpAnswerInput").value;
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(current_text);
        }
    }).bindListener();
    new Listener("guess phase over", (payload) => {
        if (auto_mute_delay !== null || auto_unmute_delay !== null) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
	}).bindListener();
    new Listener("answer results", (payload) => {
        if (auto_mute_delay !== null || auto_unmute_delay !== null) {
            document.querySelector("#qpVolume").classList.remove("disabled");
            volumeController.setMuted(false);
            volumeController.adjustVolume();
        }
    }).bindListener();
    new Listener("return lobby vote start", (payload) => {
        if (auto_vote_lobby) setTimeout(() => { quiz.returnVoteController.vote(true) }, 100);
    }).bindListener();
    new Listener("quiz over", (payload) => {
        document.querySelector("#qpVolume").classList.remove("disabled");
        if (auto_switch) setTimeout(() => { autoSwitch() }, 10);
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.error) {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            return;
        }
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
        if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
        if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
        if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
        if (auto_switch) setTimeout(() => { autoSwitch() }, 100);
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.error) {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            return;
        }
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
        if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
        if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
        if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
        if (auto_switch) setTimeout(() => { autoSwitch() }, 100);
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
    new Listener("Player Changed To Spectator", (payload) => {
        if (payload.playerDescription.name === selfName) {
            setTimeout(() => { autoSwitch() }, 1);
        }
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (payload.name === selfName) {
            setTimeout(() => { autoReady(); autoStart(); autoSwitch(); }, 1);
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
            socket.sendCommand({ type: "quiz", command: "quiz answer", data: { answer: answer, isPlaying: true, volumeAtMax: false } });
        }
    });
    if (auto_join_room) {
        if (auto_join_room.id === "solo") {
            hostModal.changeSettings(auto_join_room.settings);
            hostModal.soloMode = true;
            setTimeout(() => { roomBrowser.host() }, 10);
        }
        else if (auto_join_room.id === "ranked") {
            document.querySelector("#mpRankedButton").click();
        }
        else if (auto_join_room.joinAsPlayer){
            roomBrowser.fireJoinLobby(auto_join_room.id, auto_join_room.password);
        }
        else {
            roomBrowser.fireSpectateGame(auto_join_room.id, auto_join_room.password);
        }
        if (auto_join_room.temp) {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
        }
    }
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
    else if (/^\/teammates$/.test(content)) {
        sendChatMessage(getTeamList(getTeamNumber(selfName)).join(", "), isTeamMessage);
    }
    else if (/^\/roll$/.test(content)) {
        sendSystemMessage("roll commands: #, player, otherplayer, teammate, otherteammate, playerteam, spectator");
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
    else if (/^\/roll (pt|playerteams?|teams?)$/.test(content)) {
        if (hostModal.getSettings().teamSize === 1) { sendChatMessage("team size must be greater than 1", isTeamMessage); return; }
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
        socket.sendCommand({ type: "quiz", command: "quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause") });
    }
    else if (/^\/(autoskip|autovoteskip)$/.test(content)) {
        if (auto_vote_skip === null) auto_vote_skip = 100;
        else auto_vote_skip = null;
        sendSystemMessage("auto vote skip " + (auto_vote_skip ? "enabled" : "disabled"));
    }
    else if (/^\/(autoskip|autovoteskip) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_vote_skip = seconds * 1000;
        sendSystemMessage(`auto vote skip after ${seconds} seconds`);     
    }
    else if (/^\/(ak|autokey|autosubmit)$/.test(content)) {
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
        auto_mute_delay = null;
        auto_unmute_delay = null;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_mute_delay = seconds * 1000;
        auto_unmute_delay = null;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_unmute_delay = null;
        auto_mute_delay = null;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_unmute_delay = seconds * 1000;
        auto_mute_delay = null;
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
    else if (/^\/autojoin$/.test(content)) {
        if (auto_join_room || isSoloMode() || isRankedMode()) {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            sendSystemMessage("auto join room disabled");
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            auto_join_room = {id: lobby.gameId, password: password};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            sendSystemMessage(`auto joining room ${lobby.gameId} ${password}`);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    auto_join_room = {id: payload.gameId, password: password};
                    localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
                    sendSystemMessage(`auto joining room ${payload.gameId} ${password}`);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            sendSystemMessage("auto join room disabled");
        }
    }
    else if (/^\/autojoin [0-9]+/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        auto_join_room = {id: id, password: password ? password : ""};
        localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
        sendSystemMessage(`auto joining room ${id} ${password}`);
    }
    else if (/^\/autoswitch$/.test(content)) {
        auto_switch = "";
        sendSystemMessage("auto switch disabled");
    }
    else if (/^\/autoswitch (p|s)/.test(content)) {
        let option = /^\S+ (p|s)/.exec(content)[1];
        if (option === "p") auto_switch = "player";
        else if (option === "s") auto_switch = "spectator";
        sendSystemMessage("auto switching to " + auto_switch);
        autoSwitch();
    }
    else if (/^\/autolobby$/.test(content)) {
        auto_vote_lobby = !auto_vote_lobby;
        localStorage.setItem("mega_commands_auto_vote_lobby", auto_vote_lobby);
        sendSystemMessage("auto vote lobby " + (auto_vote_lobby ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        sendSystemMessage("online, away, do not disturb, invisible");
    }
    else if (/^\/autostatus (online|away|do not disturb|invisible)$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        auto_status = option;
        localStorage.setItem("mega_commands_auto_status", auto_status);
        sendSystemMessage("auto status set to " + auto_status);
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
        if (isSoloMode()) {
            auto_join_room = {id: "solo", temp: true, settings: hostModal.getSettings()};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (isRankedMode()) {
            auto_join_room = {id: "ranked", temp: true};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            auto_join_room = {id: lobby.gameId, password: password, joinAsPlayer: !lobby.isSpectator, temp: true};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    auto_join_room = {id: payload.gameId, password: password, temp: true};
                    localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                    setTimeout(() => { window.location = "/" }, 10);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            localStorage.setItem("mega_commands_auto_join_room", false);
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
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
            sendChatMessage("https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js", isTeamMessage);
        }
        else if (option === "version") {
            sendChatMessage(version, isTeamMessage);
        }
        else if (option === "clear") {
            localStorage.removeItem("mega_commands_auto_submit_answer");
            localStorage.removeItem("mega_commands_auto_ready");
            localStorage.removeItem("mega_commands_auto_accept_invite");
            localStorage.removeItem("mega_commands_auto_join_room");
            localStorage.removeItem("mega_commands_auto_vote_lobby");
            localStorage.removeItem("mega_commands_auto_status");
            sendSystemMessage("mega commands local storage cleared");
        }
        else if (option === "auto") {
            if (auto_vote_skip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
            if (auto_submit_answer) sendSystemMessage("Auto Submit Answer: Enabled");
            if (auto_copy_player) sendSystemMessage("Auto Copy: " + auto_copy_player);
            if (auto_throw) sendSystemMessage("Auto Throw: " + auto_throw);
            if (auto_mute_delay !== null) sendSystemMessage("Auto Mute: " + (auto_mute_delay / 1000) + "s");
            if (auto_unmute_delay !== null) sendSystemMessage("Auto Unmute: " + (auto_unmute_delay / 1000) + "s");
            if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
            if (auto_start) sendSystemMessage("Auto Start: Enabled");
            if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
            if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
            if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
            if (auto_vote_lobby) sendSystemMessage("Auto Vote Lobby: Enabled");
            if (auto_switch) sendSystemMessage("Auto Switch: " + auto_switch);
            if (auto_status) sendSystemMessage("Auto Status: " + auto_status);
            if (auto_join_room) sendSystemMessage("Auto Join Room: " + auto_join_room.id);
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
    else if (/^\/(autoskip|autovoteskip)$/.test(content)) {
        if (auto_vote_skip === null) auto_vote_skip = 100;
        else auto_vote_skip = null;
        sendSystemMessage("auto vote skip " + (auto_vote_skip ? "enabled" : "disabled"));
    }
    else if (/^\/(autoskip|autovoteskip) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_vote_skip = seconds * 1000;
        sendSystemMessage(`auto vote skip after ${seconds} seconds`);     
    }
    else if (/^\/(ak|autokey|autosubmit)$/.test(content)) {
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
        auto_mute_delay = null;
        auto_unmute_delay = null;
        sendSystemMessage("auto mute disabled");
    }
    else if (/^\/(am|automute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_mute_delay = seconds * 1000;
        auto_unmute_delay = null;
        sendSystemMessage("auto muting after " + seconds + " second" + (seconds === 1 ? "" : "s"));
    }
    else if (/^\/(au|autounmute)$/.test(content)) {
        document.querySelector("#qpVolume").classList.remove("disabled");
        volumeController.setMuted(false);
        volumeController.adjustVolume();
        auto_unmute_delay = null;
        auto_mute_delay = null;
        sendSystemMessage("auto unmute disabled");
    }
    else if (/^\/(au|autounmute) [0-9.]+$/.test(content)) {
        let seconds = parseFloat(/^\S+ ([0-9.]+)$/.exec(content)[1]);
        if (isNaN(seconds)) return;
        auto_unmute_delay = seconds * 1000;
        auto_mute_delay = null;
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
    else if (/^\/autojoin$/.test(content)) {
        if (auto_join_room || isSoloMode() || isRankedMode()) {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            sendSystemMessage("auto join room disabled");
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            auto_join_room = {id: lobby.gameId, password: password};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            sendSystemMessage(`auto joining room ${lobby.gameId} ${password}`);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    auto_join_room = {id: payload.gameId, password: password};
                    localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
                    sendSystemMessage(`auto joining room ${payload.gameId} ${password}`);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            auto_join_room = false;
            localStorage.setItem("mega_commands_auto_join_room", auto_join_room);
            sendSystemMessage("auto join room disabled");
        }
    }
    else if (/^\/autojoin [0-9]+/.test(content)) {
        let id = parseInt(/^\S+ ([0-9]+)/.exec(content)[1]);
        let password = /^\S+ [0-9]+ (.+)$/.exec(content)[1];
        auto_join_room = {id: id, password: password ? password : ""};
        localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
        sendSystemMessage(`auto joining room ${id} ${password}`);
    }
    else if (/^\/autoswitch$/.test(content)) {
        auto_switch = "";
        sendSystemMessage("auto switch disabled");
    }
    else if (/^\/autoswitch (p|s)/.test(content)) {
        let option = /^\S+ (p|s)/.exec(content)[1];
        if (option === "p") auto_switch = "player";
        else if (option === "s") auto_switch = "spectator";
        sendSystemMessage("auto switching to " + auto_switch);
        autoSwitch();
    }
    else if (/^\/autolobby$/.test(content)) {
        auto_vote_lobby = !auto_vote_lobby;
        localStorage.setItem("mega_commands_auto_vote_lobby", auto_vote_lobby);
        sendSystemMessage("auto vote lobby " + (auto_vote_lobby ? "enabled" : "disabled"));
    }
    else if (/^\/autostatus$/.test(content)) {
        sendSystemMessage("online, away, do not disturb, invisible");
    }
    else if (/^\/autostatus (online|away|do not disturb|invisible)$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        auto_status = option;
        localStorage.setItem("mega_commands_auto_status", auto_status);
        sendSystemMessage("auto status set to " + auto_status);
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
    else if (/^\/scripts?$/.test(content)) {
        sendPM(message.target, Object.keys(scripts).join(", "));
    }
    else if (/^\/scripts? .+$/.test(content)) {
        let option = /^\S+ (.+)$/.exec(content)[1];
        if (option in scripts) sendPM(message.target, scripts[option]);
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
    else if (/^\/(relog|logout rejoin|loggoff rejoin)$/.test(content)) {
        if (isSoloMode()) {
            auto_join_room = {id: "solo", temp: true, settings: hostModal.getSettings()};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (isRankedMode()) {
            auto_join_room = {id: "ranked", temp: true};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (lobby.inLobby) {
            let password = hostModal.getSettings().password;
            auto_join_room = {id: lobby.gameId, password: password, joinAsPlayer: !lobby.isSpectator, temp: true};
            localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
        else if (quiz.inQuiz || battleRoyal.inView) {
            let gameInviteListener = new Listener("game invite", (payload) => {
                if (payload.sender === selfName) {
                    gameInviteListener.unbindListener();
                    let password = hostModal.getSettings().password;
                    auto_join_room = {id: payload.gameId, password: password, temp: true};
                    localStorage.setItem("mega_commands_auto_join_room", JSON.stringify(auto_join_room));
                    setTimeout(() => { viewChanger.changeView("main") }, 1);
                    setTimeout(() => { window.location = "/" }, 10);
                }
            });
            gameInviteListener.bindListener();
            socket.sendCommand({ type: "social", command: "invite to game", data: { target: selfName } });
        }
        else {
            localStorage.setItem("mega_commands_auto_join_room", false);
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { window.location = "/" }, 10);
        }
    }
    else if (/^\/commands$/.test(content)) {
        sendPM(message.target, "/commands on off help link version clear auto");
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
        else if (option === "clear") {
            localStorage.removeItem("mega_commands_auto_submit_answer");
            localStorage.removeItem("mega_commands_auto_ready");
            localStorage.removeItem("mega_commands_auto_accept_invite");
            localStorage.removeItem("mega_commands_auto_join_room");
            localStorage.removeItem("mega_commands_auto_vote_lobby");
            localStorage.removeItem("mega_commands_auto_status");
            sendPM(message.target, "mega commands local storage cleared");
        }
        else if (option === "auto") {
            if (auto_vote_skip !== null) sendSystemMessage("Auto Vote Skip: Enabled");
            if (auto_submit_answer) sendSystemMessage("Auto Submit Answer: Enabled");
            if (auto_copy_player) sendSystemMessage("Auto Copy: " + auto_copy_player);
            if (auto_throw) sendSystemMessage("Auto Throw: " + auto_throw);
            if (auto_mute_delay !== null) sendSystemMessage("Auto Mute: " + (auto_mute_delay / 1000) + "s");
            if (auto_unmute_delay !== null) sendSystemMessage("Auto Unmute: " + (auto_unmute_delay / 1000) + "s");
            if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
            if (auto_start) sendSystemMessage("Auto Start: Enabled");
            if (auto_host) sendSystemMessage("Auto Host: " + auto_host);
            if (auto_invite) sendSystemMessage("Auto Invite: " + auto_invite);
            if (auto_accept_invite) sendSystemMessage("Auto Accept Invite: Enabled");
            if (auto_vote_lobby) sendSystemMessage("Auto Vote Lobby: Enabled");
            if (auto_switch) sendSystemMessage("Auto Switch: " + auto_switch);
            if (auto_status) sendSystemMessage("Auto Status: " + auto_status);
            if (auto_join_room) sendSystemMessage("Auto Join Room: " + auto_join_room.id);
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
        else if (/^\/teammates$/.test(content)) {
            sendPM(message.target, getTeamList(getTeamNumber(selfName)).join(", "));
        }
        else if (/^\/roll (p|players?)$/.test(content)) {
            let list = getPlayerList();
            sendPM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no players");
        }
        else if (/^\/roll (op|otherplayers?)$/.test(content)) {
            let name = getRandomOtherPlayer();
            if (name) sendPM(message.target, name);
        }
        else if (/^\/roll (t|teammates?)$/.test(content)) {
            let list = getTeamList(getTeamNumber(selfName));
            sendPM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no teammates");
        }
        else if (/^\/roll (ot|otherteammates?)$/.test(content)) {
            let name = getRandomOtherTeammate();
            if (name) sendPM(message.target, name);
        }
        else if (/^\/roll (pt|playerteams?|teams?)$/.test(content)) {
            if (hostModal.getSettings().teamSize === 1) { sendPM(message.target, "team size must be greater than 1"); return; }
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
        else if (/^\/roll (s|spectators?)$/.test(content)) {
            let list = getSpectatorList();
            sendPM(message.target, list.length ? list[Math.floor(Math.random() * list.length)] : "no spectators");
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
    if (commands && isFriend(message.sender)) {
        let content = message.message;
        if (content === "/forceversion") {
            sendPM(message.sender, version);
        }
        else if (content === "/forceready" && lobby.inLobby && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
            lobby.fireMainButtonEvent();
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

// check if all players are ready in lobby
function allPlayersReady() {
    if (!lobby.inLobby) return false;
    for (let player of Object.values(lobby.players)) {
        if (!player._ready) return false;
    }
    return true;
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
        if (auto_start && allPlayersReady() && lobby.isHost) {
            lobby.fireMainButtonEvent();
        }
    }, 1);
}

// check conditions and switch between player and spectator
function autoSwitch() {
    if (lobby.inLobby) {
        if (auto_switch === "player" && lobby.isSpectator) socket.sendCommand({ type: "lobby", command: "change to player" });
        else if (auto_switch === "spectator" && !lobby.isSpectator) lobby.changeToSpectator(selfName);
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
