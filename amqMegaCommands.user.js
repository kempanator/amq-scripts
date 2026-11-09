// ==UserScript==
// @name         AMQ Mega Commands
// @namespace    https://github.com/kempanator
// @version      0.178
// @description  Commands for AMQ Chat
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      catbox.video
// @connect      myanimelist.net
// @connect      animemusicquiz.com
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
- may the sample go on by einlar

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
/loot [size] [time]       change to looting mode with inventory size and looting time
/boss [lives] [powerups] [maxsongs]  change to boss mode
/hint                     change to hint mode
/year [low] [high]        change year filter
/season [text]            change season filter (winter, spring, summer, fall)
/ds                       reset to default settings

IN GAME/LOBBY
/autoskip                 automatically vote skip at the beginning of each song
/autoskip [seconds]       automatically vote skip after # of seconds
/autoskip valid           automatically vote skip after first valid team answer
/autokey                  automatically submit answer on each key press
/autothrow [text]         automatically send answer at the beginning of each song
/autocopy [name]          automatically copy a team member's answer
/automute [seconds]       automatically mute sound during quiz after # of seconds
/autounmute [seconds]     automatically unmute sound during quiz after # of seconds
/automutetoggle [list]    start unmuted and automatically toggle mute iterating over a list of # of seconds
/automuterandom [time]    automatically mute a random time interval during guess phase
/autounmuterandom [time]  automatically unmute a random time interval during guess phase
/autohint [type]          automatically request a hint in hint mode
/autoready                automatically ready up in lobby
/autostart                automatically start the game when everyone is ready if you are host
/autopause                automatically pause the quiz when a player leaves or disconnects if you are host
/autohost [name]          automatically promote player to host if you are the current host
/autoinvite [name]        automatically invite a player to your room when they log in (only friends)
/autoaccept [option]      automatically accept game invites (options: friends, all)
/autolobby                automatically vote return to lobby when host starts a vote
/autojoin [id] [password] automatically join a room by ID
/autodownloadsong [text]  automatically download songs (options: mp3, video)
/autodownloadjson [text]  automatically download quiz JSON files (options: solo, ranked, tour)
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
/video speed [number]     change client-side song playback speed (0.0625 - 16)
/mutereplay               auto mute during the replay phase
/mutesubmit               auto mute after answer submit
/continuesample           continue sample after answer reveal instead of resetting
/loopvideo                loop the video when it ends
/reverse                  reverse audio playback
/pitch [multiplier]       pitch shift audio (disable with no value)
/alien [number]           set # of aliens for alien gamemode

OTHER
/roll                     roll number, player, teammate, playerteam, spectator
/shuffle [list]           shuffle a list of anything (separate with commas)
/startvote [list]         start a vote with a list of options (separate with commas)
/stopvote                 stop the vote and print results
/calc [expression]        calculate a math expression
/list [a|m|k|o] [name]    change anime list
/list off                 clear anime list
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
// Handle automatic login separately from game initialization.
if (document.querySelector("#loginPage")) {
    handleCommandLogin();
    return;
}
if (typeof Listener === "undefined") return;

// === Settings and runtime state ===

const MAX_COMMAND_DELAY = 2147483647; // 2^31 - 1, larger values can overflow
const storedSettingSchema = {
    autoAcceptInvite: {
        default: "",
        decode: decodeSavedAutoAcceptInvite,
    },
    autoCopy: {
        default: "",
        decode: decodeSavedString,
    },
    autoDownloadSong: {
        default: [],
        decode: value => decodeSavedOptions(value, ["mp3", "video", "720", "480"]),
    },
    autoDownloadJson: {
        default: [],
        decode: value => decodeSavedOptions(value, ["all", "solo", "ranked", "tour"]),
    },
    autoHint: {
        default: "",
        decode: value => value === "" ? value : decodeSavedNumber(value, 1, 6, { integer: true }),
    },
    autoHost: {
        default: "",
        decode: decodeSavedString,
    },
    autoInvite: {
        default: "",
        decode: decodeSavedString,
    },
    autoJoinRoom: {
        default: false,
        decode: decodeSavedAutoJoinRoom,
    },
    autoKey: {
        default: false,
        decode: decodeSavedBoolean,
    },
    autoMute: {
        default: { mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: null },
        decode: decodeSavedAutoMute,
    },
    autoPause: {
        default: false,
        decode: decodeSavedBoolean,
    },
    autoReady: {
        default: false,
        decode: decodeSavedBoolean,
    },
    autoShareAnswer: {
        default: false,
        decode: decodeSavedBoolean,
    },
    autoStart: {
        default: { delay: 0, remaining: 0 },
        decode: decodeSavedAutoStart,
    },
    autoStatus: {
        default: "",
        decode: value => decodeSavedChoice(value, ["", "away", "do not disturb", "offline", "invisible"]),
    },
    autoSwitch: {
        default: { mode: "", temp: false },
        decode: decodeSavedAutoSwitch,
    },
    autoThrow: {
        default: { time: [], text: null, multichoice: null },
        decode: decodeSavedAutoThrow,
    },
    autoVoteLobby: {
        default: false,
        decode: decodeSavedBoolean,
    },
    autoVoteSkip: {
        default: [],
        decode: decodeSavedAutoVoteSkip,
    },
    backgroundURL: {
        default: "",
        decode: decodeSavedString,
    },
    commandPrefix: {
        default: "/",
        decode: value => validCommandPrefix(value) ? value : undefined,
    },
    commands: {
        default: true,
        decode: decodeSavedBoolean,
    },
    continueSample: {
        default: false,
        decode: decodeSavedBoolean,
    },
    coopPaste: {
        default: false,
        decode: decodeSavedBoolean,
    },
    dropdown: {
        default: true,
        decode: decodeSavedBoolean,
    },
    dropdownInSpec: {
        default: false,
        decode: decodeSavedBoolean,
    },
    enableAllProfileButtons: {
        default: false,
        decode: decodeSavedBoolean,
    },
    hidePlayers: {
        default: false,
        decode: decodeSavedBoolean,
    },
    lastUsedVersion: {
        default: null,
        decode: value => value === null ? null : decodeSavedString(value),
    },
    loopVideo: {
        default: false,
        decode: decodeSavedBoolean,
    },
    malClientId: {
        default: "",
        decode: decodeSavedString,
    },
    muteReplay: {
        default: false,
        decode: decodeSavedBoolean,
    },
    muteSubmit: {
        default: false,
        decode: decodeSavedBoolean,
    },
    playerDetection: {
        default: { invisible: false, players: [] },
        decode: decodeSavedPlayerDetection,
    },
    printLoot: {
        default: false,
        decode: decodeSavedBoolean,
    },
    reorder: {
        default: { quizBar: false, quizBarList: [], gearMenu: false, gearMenuList: [] },
        decode: decodeSavedReorder,
    },
    selfDM: {
        default: false,
        decode: decodeSavedBoolean,
    },
    videoBlur: {
        default: null,
        decode: value => value === null ? null : decodeSavedNumber(value, 0, Number.MAX_SAFE_INTEGER, { integer: true }),
    },
    videoCrop: {
        default: null,
        decode: value => value === null ? null : decodeSavedNumber(value, 0, 100, { exclusiveMin: true }),
    },
    videoScale: {
        default: null,
        decode: value => value === null ? null : decodeSavedNumber(value, 0, 10, { exclusiveMin: true, exclusiveMax: true }),
    },
    videoSpeed: {
        default: [],
        decode: decodeSavedVideoSpeed,
    },
    alerts: {
        default: {
            hiddenPlayers: { popout: false, chat: false, console: false },
            nameChange: { popout: false, chat: false, console: false },
            onlineFriends: { popout: false, chat: false, console: false },
            offlineFriends: { popout: false, chat: false, console: false },
            serverStatus: { popout: false, chat: false, console: false },
            donation: { popout: false, chat: false, console: false },
            rankedStarting: { popout: false, chat: false, console: false },
            quizStart: { popout: false, chat: false, console: false },
            quizEnd: { popout: false, chat: false, console: false },
            chat: { popout: false, chat: false, console: false },
            dm: { popout: false, chat: false, console: false },
            newVersion: { popout: false, chat: false, console: false },
        },
        decode: decodeSavedAlerts,
    },
    commandPersist: {
        default: {
            autoAcceptInvite: true,
            autoCopy: false,
            autoDownloadSong: false,
            autoDownloadJson: true,
            autoHint: false,
            autoHost: false,
            autoInvite: false,
            autoKey: true,
            autoMute: false,
            autoPause: true,
            autoReady: true,
            autoShareAnswer: false,
            autoStart: false,
            autoStatus: true,
            autoSwitch: false,
            autoThrow: false,
            autoVoteLobby: true,
            autoVoteSkip: false,
            continueSample: true,
            coopPaste: false,
            dropdown: true,
            dropdownInSpec: true,
            loopVideo: true,
            muteReplay: true,
            muteSubmit: true,
            videoBlur: false,
            videoCrop: false,
            videoScale: false,
            videoSpeed: false
        },
        decode: decodeSavedBooleanMap,
    },
    hotKeys: {
        default: Object.fromEntries([
            "autoKey",
            "dropdown",
            "mute",
            "ready",
            "joinSpectate",
            "start",
            "leave",
            "rejoin",
            "lobby",
            "pause",
            "voteSkip",
            "relog",
            "mcHelpWindow",
            "songHistoryWindow",
            "settingsWindow",
            "focusDropdown",
            "focusChat",
        ].map(action => [action, { key: "", ctrl: false, alt: false, shift: false }])),
        decode: decodeSavedHotkeys,
    },
};
let lastCommandStorageError = null;
const saveData = readCommandSettings();
let animeList = []; //temporary storage for dropdown
let animeListLower = []; //store lowercase version for faster compare speed
let autoAcceptInvite = restoreCommandSetting("autoAcceptInvite");
let autoCopy = restoreCommandSetting("autoCopy");
let autoDownloadSong = restoreCommandSetting("autoDownloadSong");
let autoDownloadJson = restoreCommandSetting("autoDownloadJson");
let autoHint = restoreCommandSetting("autoHint");
let autoHost = restoreCommandSetting("autoHost");
let autoInvite = restoreCommandSetting("autoInvite");
let autoJoinRoom = restoreCommandSetting("autoJoinRoom");
let autoKey = restoreCommandSetting("autoKey");
let autoMute = restoreCommandSetting("autoMute");
let autoPause = restoreCommandSetting("autoPause");
let autoReady = restoreCommandSetting("autoReady");
let autoShareAnswer = restoreCommandSetting("autoShareAnswer");
let autoStart = createAutoStartState(restoreCommandSetting("autoStart"));
let autoStartCheckTimer = null;
let autoStartGeneration = 0;
let rejoinOperation = null;
let rejoinActionDepth = 0;
let gameSettingsController = new AbortController();
let autoStatus = restoreCommandSetting("autoStatus");
let autoSwitch = restoreCommandSetting("autoSwitch");
let autoThrow = restoreCommandSetting("autoThrow");
let autoVoteLobby = restoreCommandSetting("autoVoteLobby");
let autoVoteSkip = restoreCommandSetting("autoVoteSkip");
let backgroundURL = restoreCommandSetting("backgroundURL");
let commandPrefix = restoreCommandSetting("commandPrefix");
let commands = restoreCommandSetting("commands");
let continueSample = restoreCommandSetting("continueSample");
let coopPaste = restoreCommandSetting("coopPaste");
let coopPrefix = "[CP] ";
let countdown = null;
let countdownInterval;
let dropdown = restoreCommandSetting("dropdown");
let dropdownInSpec = restoreCommandSetting("dropdownInSpec");
let enableAllProfileButtons = restoreCommandSetting("enableAllProfileButtons");
let hidePlayers = restoreCommandSetting("hidePlayers");
let lastUsedVersion = restoreCommandSetting("lastUsedVersion");
let loopVideo = restoreCommandSetting("loopVideo");
let malClientId = restoreCommandSetting("malClientId");
let muteReplay = restoreCommandSetting("muteReplay");
let muteSubmit = restoreCommandSetting("muteSubmit");
let playerDetection = restoreCommandSetting("playerDetection");
let printLoot = restoreCommandSetting("printLoot");
let reorder = restoreCommandSetting("reorder");
let selfDM = restoreCommandSetting("selfDM");
let videoBlur = restoreCommandSetting("videoBlur");
let videoCrop = restoreCommandSetting("videoCrop");
let videoScale = restoreCommandSetting("videoScale");
let videoSpeed = restoreCommandSetting("videoSpeed");
let voteOptions = Object.create(null);
let votes = Object.create(null);
const voteLabels = new Map();
let voteChannel = null;
let audioBuffers = {}; //{songNumber: {startPoint, audioBuffer}, ...}
let audioContext = new window.AudioContext();
let acPlaybackRate = null;
let acReverse = false;
let sourceNode = null;
let songAutomation = null;
const songTimers = new Map();
let commandRoomGeneration = 0;
const commandMuteReasons = new Map();
let commandUserMuted = false;
let commandAudioReady = false;
let commandAudioGain = null;
let commandAudioPlayback = null;
let commandAudioResumeToken = null;
const commandAudioRequests = new Map();
let committedCommandSettings = null;
let lastSavedCommandSettings = null;
let selfColor;
let friendColor;
let blockedColor;
let customColors;
let customColorMap;

let alerts = restoreCommandSetting("alerts");

const commandSettings = {
    autoAcceptInvite: { get: () => autoAcceptInvite },
    autoCopy: { get: () => autoCopy },
    autoDownloadSong: { get: () => autoDownloadSong, summary: () => autoDownloadSong.length ? `Auto Download Song: ${autoDownloadSong.join(", ")}` : undefined },
    autoDownloadJson: { get: () => autoDownloadJson, summary: () => autoDownloadJson.length ? `Auto Download JSON: ${autoDownloadJson.join(", ")}` : undefined },
    autoHint: { get: () => autoHint, summary: () => autoHint ? `Auto Hint: ${hintNames[autoHint]}` : undefined },
    autoHost: { get: () => autoHost },
    autoInvite: { get: () => autoInvite, summary: () => autoInvite ? `Auto Invite: ${autoInvite}` : undefined },
    autoKey: { get: () => autoKey },
    autoMute: { get: () => autoMute },
    autoPause: { get: () => autoPause },
    autoReady: { get: () => autoReady },
    autoShareAnswer: { get: () => autoShareAnswer },
    autoStart: { get: () => autoStart, serialize: () => ({ delay: autoStart.delay, remaining: autoStart.remaining }) },
    autoStatus: { get: () => autoStatus },
    autoSwitch: { get: () => autoSwitch, summary: () => autoSwitch.mode ? `Auto Switch: ${autoSwitch.mode}` : undefined },
    autoThrow: { get: () => autoThrow },
    autoVoteLobby: { get: () => autoVoteLobby },
    autoVoteSkip: { get: () => autoVoteSkip },
    continueSample: { get: () => continueSample },
    coopPaste: { get: () => coopPaste, summary: () => coopPaste ? "Co-op Auto Paste: Enabled" : undefined },
    dropdown: { get: () => dropdown },
    dropdownInSpec: { get: () => dropdownInSpec },
    loopVideo: { get: () => loopVideo },
    muteReplay: { get: () => muteReplay },
    muteSubmit: { get: () => muteSubmit },
    videoBlur: { get: () => videoBlur },
    videoCrop: { get: () => videoCrop },
    videoScale: { get: () => videoScale },
    videoSpeed: { get: () => videoSpeed, summary: () => videoSpeed.length ? `Song Playback Speed: ${videoSpeed.join("–")}x` : undefined },
    autoJoinRoom: { get: () => autoJoinRoom, summary: () => autoJoinRoom ? `Auto Join Room: ${autoJoinRoom.id || autoJoinRoom.type}` : undefined },
    acReverse: { get: () => acReverse },
    acPlaybackRate: { get: () => acPlaybackRate },
};
let commandPersist = restoreCommandSetting("commandPersist");
let hotKeys = restoreCommandSetting("hotKeys");

// === Stored setting validation and persistence ===

// Recognize JSON objects used by saved settings and storage import files.
function isStoredRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Validate saved timer arrays before any listener or UI reads their contents.
function validSavedCommandTimes(value, limit = 2, increasing = false) {
    return Array.isArray(value) && value.length <= limit && value.every(time => Number.isInteger(time) && time >= 0 && time <= MAX_COMMAND_DELAY)
        && (value.length !== 2 || !increasing || value[0] < value[1]);
}

// Decode a boolean without coercing strings or numbers.
function decodeSavedBoolean(value) {
    if (typeof value === "boolean") return value;
}

// Decode a string without coercing other JSON values.
function decodeSavedString(value) {
    if (typeof value === "string") return value;
}

// Decode one supported named or numeric option.
function decodeSavedChoice(value, choices) {
    if (choices.includes(value)) return value;
}

// Decode a finite number within the specified inclusive or exclusive bounds.
function decodeSavedNumber(value, min, max, { integer = false, exclusiveMin = false, exclusiveMax = false } = {}) {
    if (!Number.isFinite(value) || (integer && !Number.isSafeInteger(value))) return;
    if (exclusiveMin ? value <= min : value < min) return;
    if (exclusiveMax ? value >= max : value > max) return;
    return value;
}

// Decode string lists into independent arrays without changing identifier casing.
function decodeSavedStringList(value) {
    if (Array.isArray(value) && value.every(item => typeof item === "string")) return [...new Set(value)];
}

// Decode supported list options while discarding duplicate entries.
function decodeSavedOptions(value, options) {
    if (Array.isArray(value) && value.every(item => options.includes(item))) return [...new Set(value)];
}

// Decode one field, collecting invalid paths and giving defaults fresh object identities.
function decodeSavedValue(value, fallback, decode, issues, path) {
    if (value === undefined) return structuredClone(fallback);
    const result = decode(value, fallback, issues, path);
    if (result !== undefined) return result;
    issues.add(path);
    return structuredClone(fallback);
}

// Recover independently editable map entries and ignore properties outside the known defaults.
function decodeSavedMap(value, fallback, decode, issues, path) {
    if (!isStoredRecord(value)) return;
    const result = {};
    for (const [key, defaultValue] of Object.entries(fallback)) {
        const fieldPath = path + "." + key;
        result[key] = decodeSavedValue(value[key], defaultValue, decode, issues, fieldPath);
    }
    return result;
}

// Decode mutually exclusive mute modes and normalize toggle ordering.
function decodeSavedAutoMute(value, fallback) {
    if (!isStoredRecord(value)) return;
    const result = { ...fallback, ...value };
    if (
        !validSavedCommandTimes(result.mute, 2, true)
        || !validSavedCommandTimes(result.unmute, 2, true)
    ) {
        return;
    }
    if (!validSavedCommandTimes(result.toggle, Infinity)) return;
    for (const key of ["randomMute", "randomUnmute"]) {
        if (
            result[key] !== null
            && decodeSavedNumber(result[key], 1, MAX_COMMAND_DELAY, { integer: true }) === undefined
        ) {
            return;
        }
    }
    const toggle = [...new Set(result.toggle)].sort((a, b) => a - b);
    if (toggle.length === 1) return;
    if ([result.mute.length, result.unmute.length, toggle.length, result.randomMute, result.randomUnmute].filter(Boolean).length > 1) {
        return;
    }
    return { mute: [...result.mute], unmute: [...result.unmute], toggle, randomMute: result.randomMute, randomUnmute: result.randomUnmute };
}

// Decode an answer and its timing together so incomplete automation stays disabled.
function decodeSavedAutoThrow(value, fallback) {
    if (!isStoredRecord(value)) return;
    const { time, text, multichoice } = { ...fallback, ...value };
    if (!validSavedCommandTimes(time) || (time.length === 2 && time[0] > time[1])) return;
    if (text !== null && (typeof text !== "string" || !text.trim())) return;
    if (multichoice !== null && ![1, 2, 3, 4, "random"].includes(multichoice)) return;
    if (text && multichoice) return;
    if (time.length && !text && !multichoice) return;
    return time.length ? { time: [...time], text, multichoice } : structuredClone(fallback);
}

// Decode the saved auto-start configuration without restoring runtime timers.
function decodeSavedAutoStart(value) {
    if (!isStoredRecord(value)) return;
    if (decodeSavedNumber(value.delay, 0, MAX_COMMAND_DELAY, { integer: true }) === undefined) return;
    if (
        value.remaining !== null
        && decodeSavedNumber(value.remaining, 0, Number.MAX_SAFE_INTEGER, { integer: true }) === undefined
    ) {
        return;
    }
    return { delay: value.delay, remaining: value.remaining };
}

// Decode the target role and recover a malformed temporary flag independently.
function decodeSavedAutoSwitch(value, fallback, issues, path) {
    if (!isStoredRecord(value)) return;
    const mode = value.mode === undefined ? fallback.mode : decodeSavedChoice(value.mode, ["", "player", "spectator"]);
    if (mode === undefined) return;
    const temp = decodeSavedValue(value.temp, fallback.temp, decodeSavedBoolean, issues, path + ".temp");
    return { mode, temp };
}

// Accept only current invite modes or a normalized player list; booleans are unsupported.
function decodeSavedAutoAcceptInvite(value) {
    if (["", "all", "friends"].includes(value)) return value;
    if (Array.isArray(value) && value.every(name => typeof name === "string" && name.trim())) {
        return [...new Set(value.map(name => name.trim().toLowerCase()))];
    }
}

// Decode playback rates within the supported range and preserve ordered pairs.
function decodeSavedVideoSpeed(value) {
    if (!Array.isArray(value) || value.length > 2) return;
    if (value.some(speed => decodeSavedNumber(speed, 0.0625, 16) === undefined)) return;
    if (value.length === 2 && value[0] > value[1]) return;
    return [...value];
}

// Decode an answer-triggered skip mode or an ordered timer list.
function decodeSavedAutoVoteSkip(value) {
    if (["valid", "correct"].includes(value)) return value;
    if (validSavedCommandTimes(value, 2, true)) return [...value];
}

// Decode player detection flags and names independently.
function decodeSavedPlayerDetection(value, fallback, issues, path) {
    if (!isStoredRecord(value)) return;
    return {
        invisible: decodeSavedValue(value.invisible, fallback.invisible, decodeSavedBoolean, issues, path + ".invisible"),
        players: decodeSavedValue(value.players, fallback.players, decodeSavedStringList, issues, path + ".players"),
    };
}

// Recover quiz-bar and gear-menu preferences independently when one saved field is malformed.
function decodeSavedReorder(value, fallback, issues, path) {
    if (!isStoredRecord(value)) return;
    return Object.fromEntries(Object.entries(fallback).map(([key, defaultValue]) => [
        key, decodeSavedValue(value[key], defaultValue, Array.isArray(defaultValue) ? decodeSavedStringList : decodeSavedBoolean, issues, path + "." + key),
    ]));
}

// Decode the nested settings shapes and filter arrays consumed by the native host window.
function decodeSavedGameSettings(value, template = hostModal.DEFUALT_SETTINGS, path = "") {
    if (Array.isArray(template)) {
        return decodeSavedGameSettingsArray(value, template, path);
    }
    if (!isStoredRecord(template)) {
        if (typeof value !== typeof template) return;
        if (typeof value === "number" && !Number.isFinite(value)) return;
        return value;
    }
    if (!isStoredRecord(value)) return;

    const result = {};
    for (const [key, defaultValue] of Object.entries(template)) {
        if (!Object.hasOwn(value, key)) {
            result[key] = structuredClone(defaultValue);
            continue;
        }
        const fieldPath = path ? path + "." + key : key;
        const decoded = decodeSavedGameSettings(value[key], defaultValue, fieldPath);
        if (decoded === undefined) return;
        result[key] = decoded;
    }
    return result;
}

// Keep fixed-size setting tuples distinct from open-ended genre, tag, and vintage lists.
function decodeSavedGameSettingsArray(value, template, path) {
    if (!Array.isArray(value)) return;
    if (template.length) {
        if (value.length !== template.length) return;
        const result = value.map((item, index) => decodeSavedGameSettings(item, template[index]));
        if (result.some(item => item === undefined)) return;
        return result;
    }
    if (path === "genre" || path === "tags") {
        return decodeSavedGameFilters(value);
    }
    const vintageTemplate = { years: [0, 0], seasons: [0, 3] };
    const entries = value.map(entry => decodeSavedGameSettings(entry, vintageTemplate));
    if (entries.some(entry => entry === undefined)) return;
    return entries;
}

// Preserve filter IDs in either supported representation while discarding unknown fields.
function decodeSavedGameFilters(value) {
    const entries = [];
    for (const entry of value) {
        if (!isStoredRecord(entry) || ![1, 2, 3].includes(entry.state)) return;
        const numericString = typeof entry.id === "string" && /^\d+$/.test(entry.id);
        const numericId = Number.isSafeInteger(entry.id) && entry.id >= 0;
        if (!numericString && !numericId) return;
        entries.push({ id: entry.id, state: entry.state });
    }
    return entries;
}

// Decode room navigation state and validate solo settings before the host window reads them.
function decodeSavedAutoJoinRoom(value) {
    if (value === false) return false;
    if (!isStoredRecord(value)) return;
    const result = {};
    if (value.id !== undefined) {
        if (decodeSavedNumber(value.id, 1, Number.MAX_SAFE_INTEGER, { integer: true }) === undefined) return;
        result.id = value.id;
    }
    if (value.password !== undefined) {
        if (typeof value.password !== "string") return;
        result.password = value.password;
    }
    if (value.type !== undefined) {
        if (!["solo", "ranked novice", "ranked expert", "themed", "jam", "multiplayer", "nexus coop", "nexus solo"].includes(value.type)) {
            return;
        }
        result.type = value.type;
    }
    if (result.type === undefined && result.id === undefined && value.autoLogIn !== true) return;
    if (result.type === "multiplayer" && result.id === undefined) return;
    if (result.type === "solo") {
        const settings = decodeSavedGameSettings(value.settings);
        if (settings === undefined) return;
        result.settings = settings;
    }
    for (const key of ["temp", "rejoin", "autoLogIn", "joinAsPlayer"]) {
        if (value[key] === undefined) continue;
        if (typeof value[key] !== "boolean") return;
        result[key] = value[key];
    }
    return result;
}

// Normalize recorded keys consistently at load, capture, and dispatch boundaries.
function normalizeCommandHotkeyKey(value) {
    if (typeof value !== "string") return;
    if (!value) return "";
    const key = value.toUpperCase();
    if ([...value].length === 1) return [...key].length === 1 ? key : value;
    return key;
}

// Decode a hotkey field by field while retaining ctrlKey/altKey/shiftKey compatibility.
function decodeSavedHotkey(value, fallback, issues, path) {
    if (!isStoredRecord(value)) return;
    const key = decodeSavedValue(value.key, fallback.key, normalizeCommandHotkeyKey, issues, path + ".key");
    const result = { key };
    for (const modifier of ["ctrl", "alt", "shift"]) {
        result[modifier] = decodeSavedValue(value[modifier] ?? value[modifier + "Key"], fallback[modifier], decodeSavedBoolean, issues, path + "." + modifier);
    }
    return result;
}

// Recover individual boolean flags in alert deliveries and persistence preferences.
function decodeSavedBooleanMap(value, fallback, issues, path) {
    return decodeSavedMap(value, fallback, decodeSavedBoolean, issues, path);
}

// Recover each alert and each of its delivery channels independently.
function decodeSavedAlerts(value, fallback, issues, path) {
    return decodeSavedMap(value, fallback, decodeSavedBooleanMap, issues, path);
}

// Recover individual hotkey bindings without discarding other actions.
function decodeSavedHotkeys(value, fallback, issues, path) {
    return decodeSavedMap(value, fallback, decodeSavedHotkey, issues, path);
}

// Decode a complete startup snapshot or only the settings present in a save/import payload.
function decodeCommandSettings(value, issues, complete = true) {
    if (!isStoredRecord(value)) {
        issues.add("megaCommands");
        value = {};
    }
    const result = {};
    for (const [name, rule] of Object.entries(storedSettingSchema)) {
        if (!complete && !Object.hasOwn(value, name)) continue;
        result[name] = decodeSavedValue(value[name], rule.default, rule.decode, issues, name);
    }
    return result;
}

// Report a storage failure once until a subsequent write succeeds.
function reportCommandStorageError(action, error) {
    const message = action + ": " + (error.message || String(error));
    if (message === lastCommandStorageError) return;
    lastCommandStorageError = message;
    console.error("Mega Commands could not " + action + ".", error);
}

// Read and decode the saved configuration, reporting invalid paths once per startup.
function readCommandSettings() {
    let value;
    try {
        const text = localStorage.getItem("megaCommands");
        value = text === null ? {} : JSON.parse(text);
    }
    catch (error) {
        reportCommandStorageError("read saved settings", error);
        value = {};
    }
    const issues = new Set();
    const result = decodeCommandSettings(value, issues);
    if (issues.size) console.warn("Mega Commands reset invalid saved settings:", [...issues].sort());
    return result;
}

// Return an independent copy of a setting already decoded by the storage schema.
function restoreCommandSetting(name) {
    return structuredClone(saveData[name]);
}

// Validate every import entry and normalize this script's payload before any writes occur.
function prepareLocalStorageImport(value) {
    if (!isStoredRecord(value) || !Object.values(value).every(item => typeof item === "string")) {
        throw new Error("Expected an object containing string storage values.");
    }
    const entries = Object.entries(value);
    return entries.map(([key, text]) => {
        if (key !== "megaCommands") return [key, text];
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { throw new Error("Invalid Mega Commands JSON."); }
        const issues = new Set();
        const settings = decodeCommandSettings(parsed, issues, false);
        if (issues.size) throw new Error("Invalid Mega Commands settings: " + [...issues].sort().join(", "));
        return [key, JSON.stringify(settings)];
    });
}

// Import prevalidated entries and report how much was written if storage rejects a write.
function importLocalStorageEntries(value) {
    const entries = prepareLocalStorageImport(value);
    let written = 0;
    try {
        for (const [key, text] of entries) {
            localStorage.setItem(key, text);
            if (key === "megaCommands") lastSavedCommandSettings = null;
            written++;
        }
    }
    catch (error) {
        throw new Error("Import stopped after " + written + " of " + entries.length + " items: " + (error.message || String(error)));
    }
    return entries.length;
}

// Validate json data in local storage
function validateLocalStorage(item) {
    try {
        const json = JSON.parse(localStorage.getItem(item));
        if (!json || typeof json !== "object" || Array.isArray(json)) return {};
        return json;
    }
    catch {
        return {};
    }
}

// Save settings
function saveSettings() {
    try {
        const settings = {};
        settings.alerts = alerts;
        settings.autoJoinRoom = autoJoinRoom;
        settings.backgroundURL = backgroundURL;
        settings.commandPersist = commandPersist;
        settings.commandPrefix = commandPrefix;
        settings.enableAllProfileButtons = enableAllProfileButtons;
        settings.hotKeys = hotKeys;
        settings.lastUsedVersion = GM_info.script.version;
        settings.malClientId = malClientId;
        settings.playerDetection = playerDetection;
        settings.printLoot = printLoot;
        settings.reorder = reorder;
        settings.selfDM = selfDM;
        for (const [name, definition] of Object.entries(commandSettings)) {
            if (commandPersist[name]) {
                settings[name] = definition.serialize ? definition.serialize() : definition.get();
            }
        }
        const issues = new Set();
        const decoded = decodeCommandSettings(settings, issues, false);
        if (issues.size) throw new Error("Invalid settings: " + [...issues].sort().join(", "));
        const json = JSON.stringify(decoded);
        if (json === lastSavedCommandSettings) {
            lastCommandStorageError = null;
            return true;
        }
        localStorage.setItem("megaCommands", json);
        lastSavedCommandSettings = json;
        lastCommandStorageError = null;
        return true;
    }
    catch (error) {
        reportCommandStorageError("save settings", error);
        return false;
    }
}

// Export local storage
function exportLocalStorage() {
    const date = new Date();
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, 0);
    const day = String(date.getDate()).padStart(2, 0);
    const hour = String(date.getHours()).padStart(2, 0);
    const minute = String(date.getMinutes()).padStart(2, 0);
    const second = String(date.getSeconds()).padStart(2, 0);
    const storage = { ...localStorage };
    delete storage["__paypal_storage__"];
    const blob = new Blob([JSON.stringify(storage)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const fileName = `amq local storage export - ${selfName} ${year}-${month}-${day} ${hour}.${minute}.${second}.json`;
    try {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fileName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
}

// Describe enabled automations from their shared controls or non-window feature metadata.
function commandSettingSummary(name) {
    const control = commandControls[name];
    if (control) {
        if (!control.enabled()) return;
        const text = control.status();
        return text[0].toUpperCase() + text.slice(1);
    }
    return commandSettings[name].summary?.();
}

// Persist changes from commands/UI once and invalidate only the affected runtime work.
function commitCommandSettings() {
    const current = {};
    for (const [name, definition] of Object.entries(commandSettings)) {
        const value = definition.serialize ? definition.serialize() : definition.get();
        current[name] = JSON.stringify(value);
    }

    const previous = committedCommandSettings;
    const changedNames = Object.keys(current).filter(name => !previous || current[name] !== previous[name]);
    if (previous) {
        for (const name of changedNames) {
            handleCommandSettingChange(name);
        }
    }
    committedCommandSettings = current;
    if (changedNames.length || !previous || lastCommandStorageError) saveSettings();
}

// Release only the timers, mute claims, or audio work owned by a changed setting.
function handleCommandSettingChange(name) {
    if (["autoThrow", "autoVoteSkip", "autoMute"].includes(name)) cancelSongTimers(name);
    if (name === "autoMute") clearCommandMuteReason("autoMute");
    if (name === "muteSubmit" && !muteSubmit) clearCommandMuteReason("submit");
    if (name === "muteReplay") {
        if (muteReplay && songAutomation?.phase === "replay") {
            setCommandMuteReason("replay", true);
        }
        else {
            clearCommandMuteReason("replay");
        }
    }
    if (name === "acReverse" || name === "acPlaybackRate") {
        if (!acReverse && !acPlaybackRate) commandAudioRequests.clear();
        syncCommandAudio();
    }
}

// === Command reference data ===

const rules = {
    "alien": "https://pastebin.com/LxLMg1nA",
    "blackjack": "https://pastebin.com/kcq7hsJm",
    "dualraidboss": "https://pastebin.com/XkG7WWwj",
    "hotpotato": "https://pastebin.com/qdr4g6Jp",
    "newgamemode": "https://pastebin.com/TAyYVsii",
    "password": "https://pastebin.com/17vKE78J",
    "pgm": "https://pastebin.com/CEc0uSHp",
    "pictionary": "https://pastebin.com/qc3NQJdX",
    "raidboss": "https://pastebin.com/NE28GUPq",
    "reversepassword": "https://pastebin.com/S8cQahNA",
    "spy": "https://pastebin.com/Q1Z35czX",
    "warlords": "https://pastebin.com/zWNRFsC3",
};
const scripts = {
    "highlightfriends": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqHighlightFriends.user.js",
    "notificationsounds": "https://github.com/kempanator/amq-scripts/raw/main/amqNotificationSounds.user.js",
    "songlistui": "https://github.com/joske2865/AMQ-Scripts/raw/master/amqSongListUI.user.js",
    "answertime": "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js",
    "speedrun": "https://github.com/joske2865/AMQ-Scripts/raw/master/amqSpeedrun.user.js",
    "emojianswer": "https://github.com/nyamu-amq/amq_scripts/raw/master/amqEmojiAnswer.user.js",
    "answerstats": "https://github.com/kempanator/amq-scripts/raw/main/amqAnswerStats.user.js",
    "chatplus": "https://github.com/kempanator/amq-scripts/raw/main/amqChatPlus.user.js",
    "customsonglistgame": "https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js",
    "megacommands": "https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js",
    "newgamemodeui": "https://github.com/kempanator/amq-scripts/raw/main/amqNewGameModeUI.user.js",
    "quickloadlists": "https://github.com/kempanator/amq-scripts/raw/main/amqQuickLoadLists.user.js",
    "showroomplayers": "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js",
    "spy": "https://github.com/ayyu/amq-userscripts/raw/master/userscripts/amqHostSpyMode.user.js",
    "elodiestyle": "https://userstyles.world/style/1435",
};
const info = {
    "draw": "https://magma.com",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png",
};
const dqMap = {
    "Naruto": { genre: [1, 2, 3, 4, 6, 17], years: [2002, 2002], seasons: [3, 3] },
    "Neon Genesis Evangelion": { genre: [1, 4, 9, 11, 12, 14], years: [1995, 1995], seasons: [3, 3] },
    "Gintama": { genre: [1, 3, 4, 14], tags: [39], years: [2006, 2006], seasons: [1, 1] },
    "Detective Conan": { genre: [2, 3, 11, 12], years: [1996, 1996], seasons: [0, 0] },
    "BECK: Mongolian Chop Squad": { genre: [3, 4, 10, 15], years: [2004, 2004], seasons: [3, 3] },
    "Initial D": { genre: [1, 4, 16], years: [1998, 1998], seasons: [1, 1] },
    "Urusei Yatsura": { genre: [3, 4, 13, 14, 15], years: [1981, 1981], seasons: [3, 3] },
    "Touch": { genre: [4, 13, 15, 16], years: [1985, 1985], seasons: [0, 0] },
    "Code Geass: Lelouch of the Rebellion Remake Movies": { genre: [1, 4, 9, 14, 18], years: [2017, 2018], seasons: [3, 1] },
    "High School of the Dead": { genre: [1, 4, 5, 7, 13, 17], years: [2010, 2010], seasons: [2, 2] },
    "Senki Zesshou Symphogear GX": { genre: [1, 4, 8, 10, 14], years: [2015, 2015], seasons: [2, 2] },
    "Ojamajo Doremi Dokkaan!": { genre: [3, 4, 6, 8, 15], years: [2002, 2002], seasons: [0, 0] },
    "Macross Delta": { genre: [1, 9, 10, 13, 14], years: [2016, 2016], seasons: [1, 1] },
    "Macross 7": { genre: [1, 3, 4, 9, 10, 14], years: [1994, 1994], seasons: [3, 3] },
    "Mobile Suit Gundam Seed Destiny": { genre: [1, 4, 9, 13, 14], years: [2004, 2004], seasons: [3, 3] },
    "Zombie Land Saga Revenge": { genre: [3, 10, 17], years: [2021, 2021], seasons: [1, 1] },
    "Revue Starlight": { genre: [1, 4, 10, 12], years: [2018, 2018], seasons: [2, 2] },
    "Idoly Pride": { genre: [4, 10, 15, 17], years: [2021, 2021], seasons: [0, 0] },
    "Extra Olympia Kyklos": { genre: [3, 6, 15, 16], years: [2020, 2020], seasons: [1, 1] },
    "Japan Animator Expo": { genre: [1, 5, 6, 9, 10, 17], years: [2014, 2014], seasons: [3, 3] },
    "Persona 4 the Animation": { genre: [1, 2, 11, 14, 17], years: [2011, 2011], seasons: [3, 3] },
    "Ranma 1/2": { genre: [1, 3, 5, 13, 15], years: [1989, 1989], seasons: [1, 1] },
    "Re:Zero: Starting Life in Another World": { genre: [1, 2, 4, 6, 12, 13, 18], years: [2016, 2021], seasons: [1, 0] },
    "NieR:Automata Ver1.1a": { genre: [1, 4, 6, 12, 14], years: [2023, 2023], seasons: [0, 0] },
    "Guilty Crown": { genre: [1, 4, 9, 12, 13, 14], years: [2011, 2011], seasons: [3, 3] },
    ".hack//Sign": { genre: [2, 6, 11, 14], years: [2002, 2002], seasons: [1, 1] },
    "Heaven's Lost Property": { genre: [3, 5, 13, 14, 15, 17], years: [2009, 2009], seasons: [3, 3] },
    "White Album 2": { genre: [4, 10, 13, 15], years: [2013, 2013], seasons: [3, 3] },
    "Kimagure Orange★Road": { genre: [1, 3, 4, 6, 13], years: [1987, 1987], seasons: [1, 1] },
    "Cardcaptor Sakura": { genre: [3, 4, 6, 8, 13], years: [1998, 1998], seasons: [1, 1] },
    "Healer Girl": { genre: [10, 15, 17], years: [2022, 2022], seasons: [1, 1] },
    "Puella Magi Madoka Magica": { genre: [1, 4, 6, 8, 12, 18], years: [2011, 2011], seasons: [0, 0] },
    "Magic Knight Rayearth": { genre: [2, 4, 6, 8, 9], years: [1994, 1995], seasons: [3, 1] },
    "Fate/kaleid liner Prisma☆Illya 2wei Herz!": { genre: [1, 3, 5, 6, 8], years: [2015, 2015], seasons: [2, 2] },
    "Aquarion Evol": { genre: [1, 4, 6, 9, 13, 14], years: [2012, 2012], seasons: [0, 0] },
    "Wolf's Rain": { genre: [1, 2, 4, 6, 11, 14], years: [2003, 2003], seasons: [0, 0] },
    "Koyomimonogatari": { genre: [3, 11, 17], years: [2016, 2016], seasons: [0, 0] },
    "Beastars": { genre: [4, 11, 12, 13, 15], years: [2019, 2021], seasons: [3, 0] },
    "Vivy: Fluorite Eye's Song": { genre: [1, 4, 10, 14, 18], years: [2021, 2021], seasons: [1, 1] },
    "Monogatari Series Second Season": { genre: [3, 4, 11, 12, 13, 17], years: [2013, 2013], seasons: [2, 2] },
    "Hikaru no Go": { genre: [3, 16, 17], years: [2001, 2001], seasons: [3, 3] },
    "Dorohedoro": { genre: [1, 2, 3, 6, 7, 11], years: [2020, 2020], seasons: [0, 0] },
    "Negima!?": { genre: [2, 3, 5, 6, 13], years: [2006, 2006], seasons: [3, 3] },
    "Akame ga Kill!": { genre: [1, 2, 4, 6, 7, 12, 18], years: [2014, 2014], seasons: [2, 2] },
    "Magical Girl Site": { genre: [1, 4, 7, 8, 12, 17], years: [2018, 2018], seasons: [1, 1] },
    "Made in Abyss": { genre: [2, 4, 6, 7, 11, 14], years: [2017, 2017], seasons: [2, 2] },
    "Girls' Last Tour": { genre: [2, 14, 15], years: [2017, 2017], seasons: [3, 3] },
    "Mirai Nikki": { genre: [1, 7, 11, 12, 17, 18], years: [2011, 2011], seasons: [3, 3] },
    "MF Ghost 3rd Season": { genre: [16], tags: [10], years: [2026, 2026], seasons: [0, 0] },
};
const dqTypeMap = {
    "OP": "Detective Conan",
    "ED": "Detective Conan",
    "IN": "Initial D",
};
const socialStatusMap = {
    1: "online",
    2: "do not disturb",
    3: "away",
    4: "invisible",
};


// === Song automation and audio ===

// Sample a continuous range for playback rates without rounding outside its bounds.
function randomCommandNumber(low, high = low) {
    return low === high ? low : low + Math.random() * (high - low);
}

// Cancel one feature's song timers, or every timer at a song/phase boundary.
function cancelSongTimers(feature) {
    for (const [timer, task] of songTimers) {
        if (feature === undefined || task.feature === feature) {
            clearTimeout(timer);
            songTimers.delete(timer);
        }
    }
}

// Run deferred work only while its original song, phase, and player role remain current.
function scheduleSongTask(feature, callback, delay, phase = "guess", playerOnly = false) {
    const song = songAutomation;
    if (!song) return;
    const timer = setTimeout(() => {
        if (!songTimers.has(timer)) return;
        songTimers.delete(timer);
        if (songAutomation !== song || song.phase !== phase) return;
        if (!quiz.inQuiz || quiz.infoContainer.currentSongNumber !== song.number) return;
        if (playerOnly && quiz.isSpectator) return;
        callback();
    }, delay);
    songTimers.set(timer, { feature });
    return timer;
}

// Resolve mute claims; a scheduled unmute temporarily overrides the saved manual mute choice.
function commandMuteState() {
    const reasons = [...commandMuteReasons.values()];
    const unmuteWindow = commandMuteReasons.get("autoMute")?.muted === false;
    const automationMuted = reasons.some(reason => reason.muted);
    const manuallyMuted = commandUserMuted && !unmuteWindow;
    const locked = reasons.some(reason => reason.lock);
    return { muted: automationMuted || manuallyMuted, locked };
}

// Apply independent mute reasons while preserving the user's own volume and mute choice.
function applyCommandMute() {
    if (!commandAudioReady) return;
    const { muted, locked } = commandMuteState();
    volumeController.muted = muted;
    $("#qpVolume").toggleClass("disabled", locked);
    if (commandAudioGain) commandAudioGain.gain.value = muted ? 0 : Number(volumeController.volume);
    volumeController.adjustVolume();
}

// Change one automation's mute/lock claim without clearing another feature's claim.
function setCommandMuteReason(name, muted, lock = false) {
    commandMuteReasons.set(name, { muted, lock });
    applyCommandMute();
}

// Release a feature's temporary mute and volume-control lock.
function clearCommandMuteReason(name) {
    commandMuteReasons.delete(name);
    applyCommandMute();
}

// Observe manual mute/volume changes and route custom audio through the same volume choice.
function setupCommandAudio() {
    commandUserMuted = Boolean(volumeController.muted);
    commandAudioReady = true;
    const setMuted = volumeController.setMuted;
    volumeController.setMuted = function (muted) {
        commandUserMuted = Boolean(muted);
        if (commandMuteReasons.get("autoMute")?.muted === false) commandMuteReasons.delete("autoMute");
        const result = setMuted.call(this, muted);
        applyCommandMute();
        return result;
    };
    const adjustVolume = volumeController.adjustVolume;
    volumeController.adjustVolume = function (...args) {
        const result = adjustVolume.apply(this, args);
        if (sourceNode) quizVideoController.setVolume(0);
        if (commandAudioGain) {
            commandAudioGain.gain.value = commandMuteState().muted ? 0 : Number(this.volume);
        }
        return result;
    };
}

// Stop and disconnect the current one-shot source, then restore native audio routing.
function stopCommandAudio() {
    commandAudioResumeToken = null;
    const node = sourceNode;
    sourceNode = null;
    commandAudioPlayback = null;
    if (node) {
        node.onended = null;
        node.stop();
        node.disconnect();
    }
    applyCommandMute();
}

// Discard room-owned work so neither timers nor pending decoded audio can enter another room.
function resetCommandRoom() {
    commandRoomGeneration++;
    cancelSongTimers();
    songAutomation = null;
    commandMuteReasons.clear();
    stopCommandAudio();
    audioBuffers = {};
    commandAudioRequests.clear();
}

// Prepare audio under a captured room/song identity and ignore replaced or obsolete requests.
async function prepareCommandAudio(data) {
    if (!acReverse && !acPlaybackRate) return;
    const generation = commandRoomGeneration;
    const number = quiz.infoContainer.currentSongNumber + 1;
    const token = {};
    const url = formatURL(data.videoInfo.videoMap?.catbox?.[0]);
    if (!url) return;
    commandAudioRequests.set(number, token);
    try {
        const bytes = await urlToArrayBuffer(url);
        if (
            generation !== commandRoomGeneration
            || commandAudioRequests.get(number) !== token
            || (!acReverse && !acPlaybackRate)
        ) {
            return;
        }
        const buffer = await audioContext.decodeAudioData(bytes);
        if (
            generation !== commandRoomGeneration
            || commandAudioRequests.get(number) !== token
            || (!acReverse && !acPlaybackRate)
        ) {
            return;
        }
        if (songAutomation && number < songAutomation.number) return;
        audioBuffers[number] = { startPoint: data.startPoint, playLength: data.playLength, buffer };
        if (songAutomation?.number === number) startCommandAudio();
    }
    catch (error) {
        if (
            generation === commandRoomGeneration
            && commandAudioRequests.get(number) === token
        ) {
            console.error("Audio preparation failed", error);
        }
    }
    finally {
        if (commandAudioRequests.get(number) === token) commandAudioRequests.delete(number);
    }
}

// Play a cached song at the current elapsed position, retaining the original buffer for toggles.
function startCommandAudio() {
    stopCommandAudio();
    const song = songAutomation;
    if (!song || !quiz.inQuiz || (!acReverse && !acPlaybackRate)) return;
    const entry = audioBuffers[song.number];
    if (!entry) return;
    if (audioContext.state === "suspended") {
        const token = {};
        const generation = commandRoomGeneration;
        commandAudioResumeToken = token;
        audioContext.resume().then(() => {
            if (
                commandAudioResumeToken === token
                && commandRoomGeneration === generation
                && songAutomation === song
                && audioContext.state === "running"
            ) {
                startCommandAudio();
            }
        }).catch(error => {
            if (commandAudioResumeToken === token) commandAudioResumeToken = null;
            console.error("Audio resume failed", error);
        });
        return;
    }
    if (acReverse && !entry.reversed) {
        entry.reversed = audioContext.createBuffer(entry.buffer.numberOfChannels, entry.buffer.length, entry.buffer.sampleRate);
        for (let channel = 0; channel < entry.buffer.numberOfChannels; channel++) entry.reversed.getChannelData(channel).set(entry.buffer.getChannelData(channel));
        reverseAudioBuffer(entry.reversed);
    }
    const buffer = acReverse ? entry.reversed : entry.buffer;
    const rate = acPlaybackRate || 1;
    const elapsed = Math.max(0, (performance.now() - song.startedAt) / 1000);
    const start = Math.max(0, Math.min(entry.startPoint / 100 * buffer.duration, buffer.duration - rate * entry.playLength - 3));
    const offset = start + elapsed * rate;
    if (offset >= buffer.duration) return;
    if (!commandAudioGain) {
        commandAudioGain = audioContext.createGain();
        commandAudioGain.connect(audioContext.destination);
    }
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = rate;
    node.connect(commandAudioGain);
    node.onended = () => {
        node.disconnect();
        if (sourceNode !== node) return;
        sourceNode = null;
        commandAudioPlayback = null;
        applyCommandMute();
    };
    try { node.start(0, offset); }
    catch (error) {
        node.onended = null;
        node.disconnect();
        console.error("Audio start failed", error);
        return;
    }
    sourceNode = node;
    commandAudioPlayback = { reversed: acReverse };
    audioContext.resume().catch(error => {
        if (sourceNode === node) stopCommandAudio();
        console.error("Audio resume failed", error);
    });
    applyCommandMute();
}

// Reconcile reverse/pitch changes without restarting a source merely to change its rate.
function syncCommandAudio() {
    if (!acReverse && !acPlaybackRate) return stopCommandAudio();
    if (sourceNode && commandAudioPlayback.reversed === acReverse) sourceNode.playbackRate.value = acPlaybackRate || 1;
    else startCommandAudio();
}

// Schedule the current mute mode, clamping oversized random windows to the whole guess phase.
function startSongMute() {
    cancelSongTimers("autoMute");
    clearCommandMuteReason("autoMute");
    if (autoMute.mute.length || autoMute.unmute.length) {
        const unmute = autoMute.unmute.length > 0;
        setCommandMuteReason("autoMute", unmute, unmute);
        scheduleSongTask("autoMute", () => setCommandMuteReason("autoMute", !unmute, !unmute), randomIntInc(...(unmute ? autoMute.unmute : autoMute.mute)));
    }
    else if (autoMute.toggle.length) {
        setCommandMuteReason("autoMute", false, true);
        autoMute.toggle.forEach((time, index) => scheduleSongTask("autoMute", () => setCommandMuteReason("autoMute", index % 2 === 0, true), time));
    }
    else if (autoMute.randomMute || autoMute.randomUnmute) {
        const unmute = Boolean(autoMute.randomUnmute);
        const length = songAutomation.length;
        const duration = Math.min(length, autoMute.randomMute || autoMute.randomUnmute);
        const start = Math.floor(Math.random() * Math.max(0, length - duration));
        setCommandMuteReason("autoMute", unmute, unmute);
        if (start === 0) setCommandMuteReason("autoMute", !unmute, !unmute);
        else scheduleSongTask("autoMute", () => setCommandMuteReason("autoMute", !unmute, !unmute), start);
        scheduleSongTask("autoMute", () => setCommandMuteReason("autoMute", unmute, unmute), start + duration);
    }
}

// Start a fresh song scope and snapshot automatic answer/skip choices before scheduling them.
function startCommandSong(data) {
    cancelSongTimers();
    commandMuteReasons.clear();
    songAutomation = {
        number: data.songNumber,
        phase: "guess",
        startedAt: performance.now(),
        length: data.time * 1000
    };
    for (const number of Object.keys(audioBuffers)) {
        if (Number(number) < data.songNumber) delete audioBuffers[number];
    }
    startCommandAudio();
    if (autoHint && quiz.hintGameMode) {
        socket.sendCommand({ type: "quiz", command: "use hint", data: { hintId: autoHint } });
    }
    if (!quiz.isSpectator && autoThrow.time.length) {
        const { text, multichoice, time } = autoThrow;
        if (text) scheduleSongTask("autoThrow", () => {
            quiz.answerInput.setNewAnswer(text);
        }, randomIntInc(...time), "guess", true);
        else if (multichoice && quiz.answerInput.multipleChoice.displayed) {
            const index = multichoice === "random" ? randomIntInc(0, 3) : multichoice - 1;
            scheduleSongTask("autoThrow", () => {
                quiz.answerInput.multipleChoice.handleClick(quiz.answerInput.multipleChoice.answerOptions[index]);
            }, randomIntInc(...time), "guess", true);
        }
    }
    if (!quiz.isSpectator && Array.isArray(autoVoteSkip) && autoVoteSkip.length) {
        scheduleSongTask("autoVoteSkip", () => {
            if (!quiz.skipController._toggled) quiz.skipClicked();
        }, randomIntInc(...autoVoteSkip), "guess", true);
    }
    startSongMute();
    applyCommandMute();
}

// End guessing without letting delayed answer/mute work escape into replay.
function finishCommandGuess() {
    cancelSongTimers();
    if (songAutomation) songAutomation.phase = "replay";
    clearCommandMuteReason("autoMute");
}

// Run a deferred room action only if navigation has not invalidated its original room.
function scheduleCommandRoomAction(action, delay = 0) {
    const generation = commandRoomGeneration;
    return setTimeout(() => { if (generation === commandRoomGeneration) action(); }, delay);
}

// Share successful join/spectate initialization while retaining their distinct log labels.
function handleCommandRoomEntry(data, action) {
    if (data.error) {
        autoJoinRoom = false;
        saveSettings();
        return;
    }
    if (data.inLobby) {
        for (const name of ["autoReady", "autoStart", "autoPause", "autoHost", "autoInvite", "autoAcceptInvite"]) {
            const text = commandSettingSummary(name);
            if (text) sendSystemMessage(text);
        }
        if (autoSwitch.mode) scheduleCommandRoomAction(checkAutoSwitch, 100);
    }
    if (hidePlayers) scheduleCommandRoomAction(() => {
        if (lobby.inLobby) lobbyHidePlayers();
        else if (quiz.inQuiz) quizHidePlayers();
    });
}

// === Command argument parsing and lookup ===

// Resolve exact IDs/names or a unique partial name, preserving ambiguity for caller feedback.
function resolveCommandLookup(names, text) {
    const query = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (!query) return { state: "unknown", query };
    const id = parseCommandInteger(query, 1);
    if (!Number.isNaN(id)) return Object.hasOwn(names, id)
        ? { state: "resolved", id, name: names[id] }
        : { state: "unknown", query };
    const entries = Object.entries(names);
    const exact = entries.find(([, name]) => name.toLowerCase() === query);
    if (exact) return { state: "resolved", id: Number(exact[0]), name: exact[1] };
    const matches = entries.filter(([, name]) => name.toLowerCase().includes(query));
    return matches.length === 1
        ? { state: "resolved", id: Number(matches[0][0]), name: matches[0][1] }
        : { state: matches.length ? "ambiguous" : "unknown", query };
}

// Validate a whole lookup list before applying filters or performing a daily-quest action.
function resolveCommandLookupList(context, names) {
    const queries = context.argsText.split(",").map(value => value.trim()).filter(Boolean);
    const results = queries.map(query => resolveCommandLookup(names, query));
    const invalid = results.filter(result => result.state !== "resolved");
    if (!queries.length || invalid.length) {
        context.reply(invalid.length ? invalid.map(result => `${result.state}: ${result.query}`).join(", ") : "Specify at least one name or ID.", true);
        return;
    }
    return [...new Map(results.map(result => [result.id, result])).values()];
}

// Require a stable nonempty prefix that can be recognized again after reloading settings.
function validCommandPrefix(value) {
    return typeof value === "string" && value.length >= 1 && value.length <= 2 && !/\s/.test(value);
}

// Parse a complete finite number within the supplied bounds, or return NaN.
function parseCommandNumber(value, min = -Infinity, max = Infinity) {
    const text = String(value ?? "").trim();
    if (typeof value !== "number" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : NaN;
}

// Parse a complete safe integer within the supplied bounds, or return NaN.
function parseCommandInteger(value, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    if (!/^[+-]?\d+$/.test(String(value ?? "").trim())) return NaN;
    const number = parseCommandNumber(value, min, max);
    return Number.isSafeInteger(number) ? number : NaN;
}

// Convert valid seconds to milliseconds within the browser timer limit.
function parseCommandDelay(value, min = 0) {
    const seconds = parseCommandNumber(value, min, MAX_COMMAND_DELAY / 1000);
    return Number.isNaN(seconds) ? NaN : Math.floor(seconds * 1000);
}

// Parse and validate a time, an ordered range, or a list of times.
function parseCommandTimes(text, limit = 2, { range = true, min = 0 } = {}) {
    const parts = text.trim().split(/\s*(?:,|-|\s+)\s*/);
    if (parts.length > limit) return;
    const times = parts.map(value => parseCommandDelay(value, min));
    if (times.some(Number.isNaN) || (range && times.length === 2 && times[0] > times[1])) return;
    return times;
}

// Read one value or two endpoints separated by whitespace, a comma, or a dash.
function parseCommandEndpoints(text) {
    const match = /^([^\s,-]+)(?:(?:\s*[-,]\s*|\s+)([^\s,-]+))?$/.exec(text.trim());
    return match ? match.slice(1).filter(value => value !== undefined) : undefined;
}

// Validate a single integer or an ascending integer range without loose separators.
function parseIntegerRange(text, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parts = parseCommandEndpoints(text);
    if (!parts) return;
    const values = parts.map(value => parseCommandInteger(value, min, max));
    if (values.some(Number.isNaN) || (values.length === 2 && values[0] > values[1])) return;
    return values;
}

// Resolve the one-bound or two-bound numeric form shared by both roll commands.
function parseRollBounds(args) {
    if (args.length < 1 || args.length > 2) return;
    const values = args.map(value => parseCommandInteger(value));
    if (values.some(Number.isNaN)) return;
    const [low, high] = values.length === 1 ? [1, values[0]] : values;
    if (low > high || !Number.isSafeInteger(high - low + 1)) return;
    return [low, high];
}

// Preserve the original text after a requested number of whitespace-delimited arguments.
function commandArgumentTail(text, count = 1) {
    for (let index = 0; index < count; index++) text = text.replace(/^\S+(?:\s+|$)/, "");
    return text;
}

// Read a positive room ID and preserve the optional password exactly after its separator.
function parseCommandRoom(context) {
    const id = parseCommandInteger(context.args[0], 1);
    if (Number.isNaN(id)) return;
    return { id, password: context.argumentTail(1) };
}

// Normalize and deduplicate comma- or whitespace-separated option lists.
function commandOptionList(text) {
    return [...new Set(text.toLowerCase().split(/[\s,]+/).filter(Boolean))];
}

// Resolve a complete named option without accepting inherited object properties.
function commandAlias(aliases, text) {
    return Object.hasOwn(aliases, text) ? aliases[text] : undefined;
}

// Parse a named mode or the validated compact letters used by checkbox commands.
function parseCommandFlags(text, aliases, letters) {
    const named = commandAlias(aliases, text);
    if (named !== undefined) return named;
    return text && [...text].every(letter => letters.includes(letter)) ? text : undefined;
}

// Parse multichoice answers consistently in chat and the active-command window.
function parseMultichoiceAnswer(text) {
    return commandAlias(multichoiceValues, text.trim().toLowerCase());
}

// Separate timing from a literal answer while keeping numeric words in timed text intact.
function parseTimedAnswer(context, choice) {
    const { args, argsText } = context;
    let timing = args[0];
    let answer = context.argumentTail(1);
    const spacedRange = /^(\S+)\s+-\s+(\S+)\s+([\s\S]+)$/.exec(argsText);
    if (spacedRange) {
        timing = `${spacedRange[1]}-${spacedRange[2]}`;
        answer = spacedRange[3];
    }
    else if (choice && args.length === 3) {
        timing = `${args[0]} ${args[1]}`;
        answer = args[2];
    }
    const time = parseCommandTimes(timing);
    if (!time || !answer.trim()) return;
    return { time, answer: choice ? answer.trim() : answer };
}

// Validate one mute mode into the shared, mutually exclusive automation state.
function parseAutoMuteOptions(mode, text) {
    const value = { mute: [], unmute: [], toggle: [], randomMute: null, randomUnmute: null };
    if (!text.trim()) return value;

    if (mode === "randomMute" || mode === "randomUnmute") {
        const duration = parseCommandDelay(text, 0.001);
        if (Number.isNaN(duration)) return;
        value[mode] = duration;
        return value;
    }
    if (mode === "toggle") {
        const times = parseCommandTimes(text, Infinity, { range: false });
        if (!times) return;
        const distinctTimes = [...new Set(times)].sort((left, right) => left - right);
        if (distinctTimes.length < 2) return;
        value.toggle = distinctTimes;
        return value;
    }
    if (mode !== "mute" && mode !== "unmute") return;
    const times = parseCommandTimes(text);
    if (!times) return;
    if (times.length === 2 && times[0] === times[1]) return;
    value[mode] = times;
    return value;
}

// Apply a mute command only after its complete timing input has been validated.
function runAutoMuteCommand(context, mode) {
    const value = parseAutoMuteOptions(mode, context.argsText);
    if (!value) return context.reply(commandControls.autoMute.invalid, true);
    return applyCommandControl("autoMute", value, context);
}

// Compile underscore wildcards while treating every other regex character literally.
function createLookupPattern(query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + escaped.replaceAll("_", "\\S") + "$");
}

// Read the displayed media-host label using URL parsing rather than a hostname regex.
function getVideoHostLabel(url) {
    if (!url) return "?";
    return new URL(url, location.href).hostname.split(".")[0] || "?";
}

// Apply the user's title preference with the same English-to-romaji fallback everywhere.
function getPreferredAnimeTitle(title) {
    if (options.useRomajiNames) return title.romaji;
    return title.english || title.romaji;
}

// Fetch a provider list while preserving the distinction between empty lists and failures.
async function fetchProviderAnimeList(provider, username) {
    return provider === "anilist" ? getAnilistAnimeList(username) : getMALAnimeList(username);
}

// Select a player collection for roll and shuffle without changing its original array.
function commandPlayerCandidates(mode, team = getTeamNumber(selfName)) {
    if (mode === "player") return getPlayerList();
    if (mode === "otherplayer") return getPlayerList().filter(name => name !== selfName);
    if (mode === "spectator") return getSpectatorList();
    const names = getTeamList(team);
    return mode === "otherteammate" ? names.filter(name => name !== selfName) : names;
}

// Validate the auto-start delay and finite or unlimited repeat count.
function parseAutoStartOptions(delayText, remainingText, minimumRemaining = 0) {
    const delay = parseCommandDelay(delayText === "" ? "0" : delayText);
    const text = String(remainingText ?? "").trim().toLowerCase();
    const remaining = ["infinity", "inf", "∞", "null", ""].includes(text) ? null : parseCommandInteger(text, minimumRemaining);
    if (Number.isNaN(delay) || Number.isNaN(remaining)) return;
    return { delay, remaining };
}

// Restore valid auto-start settings with fresh runtime timer state.
function createAutoStartState({ delay, remaining }) {
    return { delay, remaining, timer: null, timerRunning: false };
}

// Clear scheduled auto-start work and invalidate callbacks already queued.
function cancelAutoStart() {
    clearTimeout(autoStartCheckTimer);
    clearTimeout(autoStart.timer);
    autoStartCheckTimer = null;
    autoStart.timer = null;
    autoStart.timerRunning = false;
    autoStartGeneration++;
}

// Deduct one auto-start use, save the count, and refresh its control.
function consumeAutoStart() {
    if (autoStart.remaining !== null) autoStart.remaining--;
    saveSettings();
    refreshActiveCommandRows("autoStart", false);
}

// Cancel pending rejoin timers and release their waiting operations.
function cancelRejoin() {
    if (rejoinActionDepth || !rejoinOperation) return;
    const operation = rejoinOperation;
    rejoinOperation = null;
    for (const [timer, resolve] of operation.timers) {
        clearTimeout(timer);
        resolve(false);
    }
    operation.timers.clear();
}

// Wait for a rejoin delay, resolving false if the operation is cancelled.
function waitForRejoin(operation, delay) {
    return new Promise(resolve => {
        if (rejoinOperation !== operation) return resolve(false);
        const timer = setTimeout(() => {
            operation.timers.delete(timer);
            resolve(rejoinOperation === operation);
        }, delay);
        operation.timers.set(timer, resolve);
    });
}

// Run a current rejoin action without treating its navigation as a manual override.
function runRejoinAction(operation, action) {
    if (rejoinOperation !== operation) return;
    rejoinActionDepth++;
    try { return action(); }
    finally { rejoinActionDepth--; }
}

// Invalidate pending room actions when the active view changes.
function handleCommandNavigation(view) {
    resetCommandRoom();
    invalidateGameSettings();
    cancelAutoStart();
    if (rejoinOperation?.expectedView === view) {
        rejoinOperation.expectedView = null;
        return;
    }
    cancelRejoin();
}

// Cancel pending room actions when navigation, hosting, or room state changes.
function setupCommandLifecycle() {
    for (const [owner, methods] of [
        [roomBrowser, ["fireJoinLobby", "fireSpectateGame", "host"]],
        [hostModal, ["displayHostSolo"]],
        [options, ["logout"]],
        [lobby, ["leave"]],
        [ranked, ["joinRankedLobby", "joinRankedGame"]],
    ]) {
        for (const name of methods) {
            const original = owner[name];
            if (typeof original !== "function") continue;
            owner[name] = function (...args) {
                resetCommandRoom();
                invalidateGameSettings();
                cancelRejoin();
                cancelAutoStart();
                return original.apply(this, args);
            };
        }
    }
    for (const event of ["Game Starting", "game closed"]) {
        new Listener(event, () => {
            resetCommandRoom();
            invalidateGameSettings();
            cancelAutoStart();
        }).bindListener();
    }
    for (const event of ["Join Game", "Spectate Game"]) {
        new Listener(event, data => {
            if (data.error) return;
            resetCommandRoom();
            invalidateGameSettings();
            cancelRejoin();
            cancelAutoStart();
            checkAutoStart();
        }).bindListener();
    }
    new Listener("Host Promotion", () => {
        invalidateGameSettings();
        cancelAutoStart();
        checkAutoStart();
    }).bindListener();
}

// === Command controls and task scheduling ===

// Keep the repeat-count display consistent between command responses and the Active tab.
function getAutoStartStatus() {
    if (autoStart.remaining === 0) return "auto start game disabled";
    const delay = autoStart.delay / 1000;
    const remaining = autoStart.remaining === null ? "∞" : autoStart.remaining;
    return `auto start game enabled (delay: ${delay}s, remaining: ${remaining})`;
}

// Explain the selected invite policy without changing its accepted storage representations.
function getAutoAcceptInviteStatus() {
    if (autoAcceptInvite === "all") return "auto accept invite from everyone";
    if (autoAcceptInvite === "friends") return "auto accept invite from friends";
    if (Array.isArray(autoAcceptInvite)) {
        return `auto accept invite only from ${autoAcceptInvite.join(", ")}`;
    }
    return "auto accept invite disabled";
}

// Include the replay-setting reminder only for correct-answer skipping.
function getAutoVoteSkipStatus() {
    if (autoVoteSkip === "valid") return "auto vote skip after first valid answer on team enabled";
    if (autoVoteSkip === "correct") {
        const reminder = options.autoVoteSkipReplay ? " (please disable replay phase skip in settings)" : "";
        return `auto vote skip correct answers only${reminder}`;
    }
    if (!autoVoteSkip.length) return "auto vote skip disabled";
    const seconds = autoVoteSkip.map(time => time / 1000).join("-");
    return `auto vote skip after ${seconds} seconds`;
}

// Active controls own state changes, status messages, and follow-up actions.
const commandControls = {
    autoReady: {
        enabled: () => Boolean(autoReady),
        set(value) {
            autoReady = value;
        },
        status: () => `auto ready ${autoReady ? "enabled" : "disabled"}`,
        afterChange: () => checkAutoReady(),
    },
    autoStart: {
        enabled: () => autoStart.remaining !== 0,
        set(value) {
            cancelAutoStart();
            Object.assign(autoStart, value);
        },
        status: getAutoStartStatus,
        afterChange: () => checkAutoStart(),
    },
    autoPause: {
        enabled: () => Boolean(autoPause),
        set(value) {
            autoPause = value;
        },
        status: () => `auto pause ${autoPause ? "enabled" : "disabled"}`,
    },
    autoAcceptInvite: {
        enabled: () => Boolean(autoAcceptInvite),
        set(value) {
            autoAcceptInvite = value;
        },
        status: getAutoAcceptInviteStatus,
    },
    autoStatus: {
        enabled: () => Boolean(autoStatus),
        set(value) {
            autoStatus = value === "offline" ? "invisible" : value;
        },
        status: () => autoStatus ? `auto status set to ${autoStatus}` : "auto status removed",
    },
    autoKey: {
        enabled: () => Boolean(autoKey),
        set(value) {
            autoKey = value;
        },
        status: () => `auto key ${autoKey ? "enabled" : "disabled"}`,
    },
    autoThrow: {
        enabled: () => autoThrow.time.length > 0,
        set(value) {
            autoThrow = value;
        },
        status: getAutoThrowStatus,
    },
    autoCopy: {
        enabled: () => Boolean(autoCopy),
        set(value) {
            autoCopy = value;
        },
        status: () => autoCopy ? `auto copying ${autoCopy}` : "auto copy disabled",
    },
    autoHost: {
        enabled: () => Boolean(autoHost),
        set(value) {
            autoHost = value;
        },
        status: () => autoHost ? `auto hosting ${autoHost}` : "auto host disabled",
        afterChange() {
            if (autoHost) checkAutoHost();
        },
    },
    autoVoteSkip: {
        enabled: () => autoVoteSkip.length > 0,
        set(value) {
            autoVoteSkip = value;
        },
        status: getAutoVoteSkipStatus,
    },
    autoVoteLobby: {
        enabled: () => Boolean(autoVoteLobby),
        set(value) {
            autoVoteLobby = value;
        },
        status: () => `auto vote lobby ${autoVoteLobby ? "enabled" : "disabled"}`,
    },
    autoMute: {
        description: "Automatically mute or unmute after a delay, toggle at listed times, or mute/unmute for a duration at a random point. Selecting a mode replaces the previous one.",
        enabled() {
            return autoMute.mute.length > 0
                || autoMute.unmute.length > 0
                || autoMute.toggle.length > 0
                || autoMute.randomMute !== null
                || autoMute.randomUnmute !== null;
        },
        set(value) {
            autoMute = value;
        },
        status: getAutoMuteStatus,
    },
    muteSubmit: {
        enabled: () => Boolean(muteSubmit),
        set(value) {
            muteSubmit = value;
        },
        status: () => `mute after answer submit ${muteSubmit ? "enabled" : "disabled"}`,
    },
    muteReplay: {
        enabled: () => Boolean(muteReplay),
        set(value) {
            muteReplay = value;
        },
        status: () => `mute during replay phase ${muteReplay ? "enabled" : "disabled"}`,
    },
    continueSample: {
        enabled: () => Boolean(continueSample),
        set(value) {
            continueSample = value;
        },
        status: () => `continue sample ${continueSample ? "enabled" : "disabled"}`,
    },
    loopVideo: {
        enabled: () => Boolean(loopVideo),
        set(value) {
            loopVideo = value;
        },
        status: () => `loop video ${loopVideo ? "enabled" : "disabled"}`,
    },
    dropdown: {
        enabled: () => Boolean(dropdown),
        set(value) {
            dropdown = value;
            quiz.answerInput.typingInput.autoCompleteController.newList();
        },
        status: () => `drop down ${dropdown ? "enabled" : "disabled"}`,
    }
};

// Each entry describes one command family; aliases share a handler.
// Keep original text and whitespace available for commands with their own syntax.
// Socket commands that share a response event are sent one at a time.
const commandTasks = new Map();
// Serialize operations by key and let later work proceed after a failure.
function queueCommandTask(key, operation) {
    const previous = commandTasks.get(key) || Promise.resolve();
    const task = previous.catch(() => { }).then(operation);
    commandTasks.set(key, task);
    // Remove the queue key only if no newer task has replaced this one.
    const cleanup = () => {
        if (commandTasks.get(key) === task) commandTasks.delete(key);
    };
    task.then(cleanup, cleanup);
    return task;
}

// Send requests one at a time per response event, with timeout and cancellation cleanup.
// A synchronous command callback returns false when no request was sent.
function requestCommand(event, command, { accept = () => true, timeout = 10000, signal } = {}) {
    return queueCommandTask("socket:" + event, () => new Promise((resolve, reject) => {
        let listener;
        let timer;
        let finished = false;
        // Settle cancellation through the normal request cleanup.
        const onAbort = () => finish(new Error(`Cancelled waiting for ${event}`));
        // Settle once and release the timer, abort handler, and response listener.
        const finish = (error, data) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            listener?.unbindListener();
            if (error) reject(error);
            else resolve(data);
        };
        try {
            if (signal?.aborted) return onAbort();
            signal?.addEventListener("abort", onAbort, { once: true });
            listener = new Listener(event, data => {
                try {
                    if (accept(data)) finish(null, data);
                }
                catch (error) { finish(error); }
            });
            timer = setTimeout(() => finish(new Error(`Timed out waiting for ${event}`)), timeout);
            listener.bindListener();
            if (typeof command === "function") {
                if (command() === false) finish(null, undefined);
            }
            else socket.sendCommand(command);
        }
        catch (error) { finish(error); }
    }));
}

// Request your current game invite and ignore invites from other players.
function requestOwnGameInvite() {
    return requestCommand("game invite", {
        type: "social", command: "invite to game", data: { target: selfName },
    }, { accept: data => data.sender === selfName });
}

// Fetch the online player list through the managed socket request lifecycle.
function requestOnlineUsers() {
    return requestCommand("all online users", { type: "social", command: "get online users" });
}

// Resolve status aliases, including multiword names, to a client status key.
function parseSocialStatus(text) {
    const alias = text.toLowerCase().replace(/\s+/g, "");
    return Object.hasOwn(socialStatusAliases, alias) ? socialStatusAliases[alias] : undefined;
}

const socialStatusAliases = {
    "1": "ONLINE", on: "ONLINE", online: "ONLINE",
    "2": "DO_NO_DISTURB", d: "DO_NO_DISTURB", dnd: "DO_NO_DISTURB", donotdisturb: "DO_NO_DISTURB",
    "3": "AWAY", a: "AWAY", away: "AWAY",
    "4": "INVISIBLE", off: "INVISIBLE", offline: "INVISIBLE", i: "INVISIBLE", inv: "INVISIBLE", invisible: "INVISIBLE",
};
const autoStatusValues = {
    ONLINE: "",
    DO_NO_DISTURB: "do not disturb",
    AWAY: "away",
    INVISIBLE: "invisible",
};
const hintAliases = {
    0: "", off: "", none: "", disable: "",
    1: 1, n: 1, name: 1,
    2: 2, i: 2, info: 2,
    3: 3, m: 3, mc: 3, multichoice: 3, multiplechoice: 3,
    4: 4, t: 4, tiny: 4, tinyvideo: 4,
    5: 5, b: 5, blur: 5, blurvideo: 5,
    6: 6, a: 6, audio: 6, sound: 6, song: 6,
};
const hintNames = {
    1: "name",
    2: "song info",
    3: "multiple choice",
    4: "tiny video",
    5: "blur video",
    6: "audio",
};
const seasonValues = {
    winter: 0, 0: 0,
    spring: 1, 1: 1,
    summer: 2, 2: 2,
    fall: 3, 3: 3,
};
const qualityAliases = {
    0: 0, mp3: 0, audio: 0, sound: 0,
    480: 480, "480p": 480,
    720: 720, "720p": 720,
};
const multichoiceValues = {
    1: 1, 2: 2, 3: 3, 4: 4,
    r: "random", random: "random",
};
const chatColorKeys = {
    self: "smColorSelfColor",
    friend: "smColorFriendColor",
    blocked: "smColorBlockedColor",
};
const autoThrowModes = {
    at: "text", autothrow: "text",
    att: "timedText", autothrowtime: "timedText",
    atmc: "choice", autothrowmc: "choice", autothrowmultichoice: "choice", autothrowmultiplechoice: "choice",
    attmc: "timedChoice", autothrowtimemc: "timedChoice", autothrowtimemultichoice: "timedChoice",
};
const nameFormatAliases = {
    l: "lower", low: "lower", lower: "lower", lowercase: "lower",
    u: "upper", up: "upper", upper: "upper", uppercase: "upper",
};
const playerModeAliases = {
    p: "player", player: "player", players: "player",
    op: "otherplayer", otherplayer: "otherplayer", otherplayers: "otherplayer",
    t: "teammate", teammate: "teammate", teammates: "teammate",
    ot: "otherteammate", otherteammate: "otherteammate", otherteammates: "otherteammate",
    s: "spectator", spec: "spectator", spectator: "spectator", spectators: "spectator",
};
const animeListModeAliases = {
    a: "anilist", ani: "anilist", anilist: "anilist",
    m: "mal", mal: "mal", myanimelist: "mal",
};

// Shuffle existing teams and format selected players or their complete relay order.
function buildExistingRollTeamLines(teams, count) {
    return teams.map(([team, names]) => {
        const shuffled = shuffleArray([...names]);
        const members = count === undefined ? shuffled.join(" ➜ ") : shuffled.slice(0, count).join(", ");
        return `Team ${team}: ${members}`;
    });
}

// Validate an existing-team roll, then queue its results at the mode's usual interval.
function rollCommandExistingTeams(context, mode) {
    const { args, reply } = context;
    const relay = mode === "relay";
    if (args.length > (relay ? 1 : 2)) return reply("Use playerteam [count] or relay.", true);
    const teams = Object.entries(getTeamMap()).sort(([a], [b]) => Number(a) - Number(b));
    if (!teams.length) return reply("no teams", true);
    const teamMode = quiz.inQuiz ? quiz.teamMode : lobby.settings.teamSize > 1;
    if (!teamMode) return reply("team size must be greater than 1", true);
    const count = parseCommandInteger(args[1] ?? 1, 1);
    if (Number.isNaN(count)) return reply("Use a positive player count.", true);
    if (!relay && teams.some(([, names]) => names.length < count)) {
        return reply("Every team must contain at least that many players.", true);
    }
    const lines = buildExistingRollTeamLines(teams, relay ? undefined : count);
    return replyCommandRollLines(context, lines, relay ? 100 : 200);
}

// Shuffle a copy of the player list into numbered teams of the requested size.
function buildRandomRollTeamLines(players, size) {
    const shuffled = shuffleArray([...players]);
    const lines = [];
    for (let index = 0; index < shuffled.length; index += size) {
        lines.push(`Team ${lines.length + 1}: ${shuffled.slice(index, index + size).join(", ")}`);
    }
    return lines;
}

const rollOperations = [
    ...Object.entries({ player: "players", otherplayer: "other players", teammate: "teammates", otherteammate: "other teammates", spectator: "spectators" }).map(([mode, label]) => ({
        aliases: Object.keys(playerModeAliases).filter(alias => playerModeAliases[alias] === mode),
        usage: mode,
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one player-selection option.", true);
            const names = commandPlayerCandidates(mode);
            context.reply(names.length ? randomItem(names) : `no ${label}`);
        },
    })),
    {
        aliases: ["pt", "playerteam", "playerteams", "warlord", "warlords"], usage: "playerteam [count]",
        run: context => rollCommandExistingTeams(context, "playerteam"),
    },
    {
        aliases: ["relay", "relays"], usage: "relay",
        run: context => rollCommandExistingTeams(context, "relay"),
    },
    {
        aliases: ["team", "teams"], usage: "team [size]",
        run(context) {
            const { args, reply } = context;
            const players = getPlayerList();
            const size = parseCommandInteger(args[1], 1, players.length);
            if (
                args.length !== 2
                || Number.isNaN(size)
            ) {
                return reply("Use a team size from 1 to the number of players.", true);
            }
            return replyCommandRollLines(context, buildRandomRollTeamLines(players, size), 200);
        },
    },
    ...["genre", "tag"].map(mode => ({
        aliases: [mode, mode + "s"], usage: `${mode} [count]`,
        run(context) {
            const { args, reply } = context;
            const names = Object.values(mode === "genre" ? idTranslator.genreNames : idTranslator.tagNames);
            const count = parseCommandInteger(args[1] ?? 1, 1, names.length);
            if (
                args.length > 2
                || Number.isNaN(count)
            ) {
                return reply(`Use a count from 1 to ${names.length}.`, true);
            }
            reply(shuffleArray(names).slice(0, count).join(", "));
        },
    })),
    ...["anilist", "mal"].map(provider => ({
        aliases: Object.keys(animeListModeAliases).filter(alias => animeListModeAliases[alias] === provider),
        usage: `${provider} [username]`,
        async run(context) {
            const { args, reply } = context;
            if (args.length !== 2) return reply(`Use ${provider} followed by a username.`, true);
            const entries = await fetchProviderAnimeList(provider, args[1]);
            if (!entries.length) return reply("anime list is empty", true);
            const entry = randomItem(entries);
            if (provider === "anilist") {
                reply(getPreferredAnimeTitle(entry.media.title));
                return;
            }
            reply(entry.node.title);
        },
    })),
];
const rollOptionMap = new Map(rollOperations.flatMap(operation => operation.aliases.map(alias => [alias, operation])));
const rollUsage = ["/roll [positive high]", "/roll [low] [high]", ...rollOperations.map(operation => `/roll ${operation.usage}`), "/roll [choice, choice, ...]"];
const rollHelp = "Use one positive upper bound, two ordered integers, a supported mode (" + rollOperations.map(operation => operation.usage).join(", ") + "), or comma-separated choices.";

const sampleAliases = {
    s: 1, start: 1,
    m: 2, medium: 2, middle: 2,
    e: 3, end: 3,
};
const difficultyAliases = {
    easy: "e",
    medium: "m",
    hard: "h",
    all: "emh",
};
const songTypeAliases = {
    op: "o", opening: "o", openings: "o",
    ed: "e", ending: "e", endings: "e",
    in: "i", insert: "i", inserts: "i",
    all: "oei",
};
const songTypeCountAliases = {
    o: "openings", op: "openings", opening: "openings", openings: "openings",
    e: "endings", ed: "endings", ending: "endings", endings: "endings",
    i: "inserts", in: "inserts", insert: "inserts", inserts: "inserts",
    r: "random", random: "random",
    all: "all",
};
const selectionAliases = {
    w: "watched", watched: "watched",
    u: "unwatched", unwatched: "unwatched",
    r: "random", random: "random",
    all: "all",
};
const autoSkipAliases = {
    v: "valid", tv: "valid", valid: "valid", "team valid": "valid", teamvalid: "valid",
    c: "correct", correct: "correct", right: "correct",
    g: "guess", guess: "guess", guessing: "guess",
    r: "replay", replay: "replay",
};
const autoMuteUIOptions = {
    mute: "mute",
    unmute: "unmute",
    toggle: "toggle",
    "random mute": "randomMute",
    "random unmute": "randomUnmute"
};
const downloadBooleanAliases = {
    on: true, all: true, true: true, enable: true, enabled: true,
    off: false, none: false, false: false, disable: false, disabled: false,
};

// Match a friend snapshot to the server's online names while preserving display order.
async function requestCommandFriendStatus() {
    const friends = getAllFriends();
    const offlineFriends = Object.keys(socialTab.offlineFriends);
    const friendSet = new Set(friends);
    const users = await requestOnlineUsers();
    const onlineSet = new Set(users);
    return {
        total: friends.length,
        online: users.filter(name => friendSet.has(name)),
        offline: friends.filter(name => !onlineSet.has(name)),
        invisible: offlineFriends.filter(name => onlineSet.has(name)),
    };
}

// Count friends using the same snapshot and online membership as the listing commands.
async function countCommandFriends(online) {
    const status = await requestCommandFriendStatus();
    return online ? status.total - status.offline.length : status.offline.length;
}

const countOperations = [
    {
        aliases: ["online friend", "online friends"],
        usage: "online friends",
        read: () => countCommandFriends(true)
    },
    {
        aliases: ["offline friend", "offline friends"],
        usage: "offline friends",
        read: () => countCommandFriends(false)
    },
    {
        aliases: ["friend", "friends"],
        usage: "friends",
        read: () => getAllFriends().length
    },
    {
        aliases: ["blocked"],
        usage: "blocked",
        read: () => socialTab.blockedPlayers.length
    },
    {
        aliases: ["script", "scripts"],
        usage: "scripts",
        read: () => $("#installedListContainer h4").length
    },
    {
        aliases: ["note", "notes"],
        usage: "notes",
        read: () => xpBar.currentCreditCount
    },
    {
        aliases: ["ticket", "tickets"],
        usage: "tickets",
        read: () => xpBar.currentTicketCount
    },
    {
        aliases: ["token", "tokens"],
        usage: "tokens",
        read: () => storeWindow._avatarTokens
    },
    {
        aliases: ["rhythm"],
        usage: "rhythm",
        read: () => storeWindow._rhythm
    },
    {
        aliases: ["currency"],
        usage: "currency",
        read: () => `${xpBar.currentCreditCount} notes, ${xpBar.currentTicketCount} tickets, ${storeWindow._avatarTokens} tokens, ${storeWindow._rhythm} rhythm`
    },
    {
        aliases: ["avatar", "avatars", "skin", "skins"],
        usage: "avatars",
        read: () => Object.values(storeWindow.characterUnlockCount).reduce((sum, value) => sum + value, 0)
    },
    {
        aliases: ["all", "total"].flatMap(prefix => ["avatar", "avatars", "skin", "skins"].map(name => `${prefix} ${name}`)),
        usage: "all avatars",
        read() {
            const characters = storeWindow.topBar.characters;
            const outfits = characters.flatMap(character => character.avatars);
            return `${characters.length} characters, ${outfits.length} outfits, ${outfits.reduce((sum, avatar) => sum + avatar.colors.length, 0)} colors`;
        },
    },
    {
        aliases: ["emote", "emotes"],
        usage: "emotes",
        read: () => storeWindow.unlockedEmoteIds.length
    },
    {
        aliases: ["all", "total"].flatMap(prefix => ["emote", "emotes"].map(name => `${prefix} ${name}`)),
        usage: "all emotes",
        read: () => Object.keys(storeWindow.topBar.emotes.emoteMap).length,
    },
    ...["anilist", "mal"].map(provider => ({
        aliases: Object.keys(animeListModeAliases).filter(alias => animeListModeAliases[alias] === provider),
        usage: `${provider} username`,
        argumentCount: 1,
        argumentError: `Use ${provider} followed by a username.`,
        read: async username => (await fetchProviderAnimeList(provider, username)).length,
    })),
];
const countOptionMap = new Map(countOperations.flatMap(operation => operation.aliases.map(alias => [alias.replace(/\s+/g, ""), operation])));
const countUsage = countOperations.map(operation => `/count ${operation.usage}`);
const countHelp = "Options: " + countOperations.map(operation => operation.usage).join(", ");

const dailyQuestAliases = {
    d: "detect", detect: "detect", auto: "detect",
    r: "random", random: "random",
    k: "kutd", kutd: "kutd", keepinguptodate: "kutd",
    op: "OP", ops: "OP",
    ed: "ED", eds: "ED",
    in: "IN", ins: "IN",
};

// Format a rounded playback time without losing the carry into the next minute.
function formatCommandVideoTime(seconds) {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const videoOperations = [
    {
        aliases: ["replay", "r"], usage: "replay [seconds]", player: true,
        run(context, player) {
            const { args, argsLower, reply } = context;
            const start = args.length === 1 ? undefined : parseCommandNumber(argsLower[1], 0);
            if (
                args.length > 2
                || (args.length > 1 && Number.isNaN(start))
            ) {
                return reply("Use a nonnegative replay start time.", true);
            }
            if (player && !player.encrypted) {
                player.pauseVideo();
                player.player.currentTime(start === undefined ? player.startPoint : start);
                player.player.play();
                player.updateVolume(player.videoVolume);
            }
        },
    },
    {
        aliases: ["pause", "stop"],
        usage: "pause", player: true,
        run(context, player) { if (player) player.pauseVideo(); }
    },
    {
        aliases: ["play", "start"],
        usage: "play", player: true,
        run(context, player) { if (player) player.player.play(); }
    },
    {
        aliases: ["loop"],
        usage: "loop",
        run(context) { applyCommandControl("loopVideo", !loopVideo, context); }
    },
    {
        aliases: ["speed"],
        usage: "speed [number or low high]",
        player: true,
        run(context, player) {
            const { args, reply } = context;
            if (args.length === 1) {
                videoSpeed = [];
                return reply("song playback speed set to default", true);
            }
            const speeds = args.slice(1).map(value => parseCommandNumber(value, 0.0625, 16));
            if (speeds.length > 2 || speeds.some(Number.isNaN) || (speeds.length === 2 && speeds[0] > speeds[1])) {
                return reply("Use one speed or an ordered pair between 0.0625 and 16.", true);
            }
            if (player?.encrypted) {
                videoSpeed = [];
                return reply("disabled for encrypted links", true);
            }
            videoSpeed = speeds;
            reply(speeds.length === 1 ? `song playback speed set to ${speeds[0]}` : `song playback speed set to random # between ${speeds[0]} - ${speeds[1]}`, true);
        },
    },
    {
        aliases: ["blur"],
        usage: "blur [pixels]",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 1) {
                videoBlur = null;
                reply("Blur mode: blur override disabled", true);
            }
            else if (args.length === 2) {
                const value = parseCommandInteger(argsLower[1]);
                if (
                    Number.isNaN(value)
                    || value < 0
                ) {
                    return reply("Blur must be a nonnegative whole number.", true);
                }
                videoBlur = value;
                reply(`Blur mode: gaussian blur set to ${value}px`, true);
            }
            else return;
            applyStyles();
        },
    },
    {
        aliases: ["crop"],
        usage: "crop [percentage]",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 1) {
                videoCrop = null;
                reply("Tiny video mode: hole size reset to default", true);
            }
            else if (args.length === 2) {
                const value = parseCommandNumber(argsLower[1]);
                if (
                    Number.isNaN(value)
                    || value <= 0
                    || value > 100
                ) {
                    return reply("Tiny video mode: hole size must be between 1 and 100", true);
                }
                videoCrop = value;
                reply(`Tiny video mode: hole size set to ${value}%`, true);
            }
            else return;
            applyStyles();
        },
    },
    {
        aliases: ["scale"],
        usage: "scale [multiplier]",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 1) {
                videoScale = null;
                reply("Tiny video mode: scale reset to default (2.5x)", true);
            }
            else if (args.length === 2) {
                const value = parseCommandNumber(argsLower[1]);
                if (
                    Number.isNaN(value)
                    || value <= 0
                    || value >= 10
                ) {
                    return reply("Tiny video mode: scale multiplier must be between 0x and 10x", true);
                }
                videoScale = value;
                reply(`Tiny video mode: scale multiplier set to ${value}x`, true);
            }
            else return;
            applyStyles();
        },
    },
    {
        aliases: ["startpoint", "sp"],
        usage: "startpoint",
        read: player => player.startPoint
    },
    {
        aliases: ["length", "len", "duration"],
        usage: "length",
        read: player => formatCommandVideoTime(player.$player[0].duration)
    },
    {
        aliases: ["link", "url", "src"],
        usage: "link",
        read: player => player.$player[0].src
    },
    {
        aliases: ["resolution", "res"],
        usage: "resolution",
        read: player => player.resolution || "mp3"
    },
    {
        aliases: ["host"],
        usage: "host",
        read: player => getVideoHostLabel(player.currentVideoUrl)
    },
    {
        aliases: ["info"],
        usage: "info",
        read(player) {
            const video = player.$player[0];
            return `${getVideoHostLabel(player.currentVideoUrl)} ${player.resolution || "mp3"} ${formatCommandVideoTime(video.currentTime)} / ${formatCommandVideoTime(video.duration)}`;
        },
    },
];
const videoOptionMap = new Map(videoOperations.flatMap(operation => operation.aliases.map(alias => [alias, operation])));
const videoUsage = videoOperations.map(operation => `/video ${operation.usage}`);
const videoHelp = "Options: " + videoOperations.map(operation => operation.usage).join(", ");
const persistSettingNames = new Map(Object.keys(commandPersist).map(name => [name.toLowerCase(), name]));
const persistBooleanAliases = {
    t: true, true: true, on: true, yes: true, 1: true,
    f: false, false: false, off: false, no: false, 0: false
};

const animeListProviders = {
    a: {
        aliases: ["a", "ani", "anilist"],
        label: "anilist",
        selector: "#aniListUserNameInput",
        updated: "#aniListLastUpdateDate",
        listType: "ANILIST"
    },
    m: {
        aliases: ["m", "mal", "myanimelist"],
        label: "myanimelist",
        selector: "#malUserNameInput",
        updated: "#malLastUpdateDate",
        listType: "MAL"
    },
    k: {
        aliases: ["k", "kitsu"],
        label: "kitsu",
        selector: "#kitsuUserNameInput",
        updated: "#kitsuLastUpdated",
        listType: "KITSU"
    },
    o: {
        aliases: ["o", "oshi", "animeoshi"],
        label: "animeoshi",
        selector: "#animeOshiUserNameInput",
        updated: "#animeOshiLastUpdateDate",
        listType: "ANIME_OSHI"
    },
};
const animeListProviderAliases = new Map(Object.entries(animeListProviders).flatMap(([key, provider]) => provider.aliases.map(alias => [alias, key])));
const animeListActionAliases = {
    s: "status", status: "status",
    off: "clear", clear: "clear", remove: "clear", delete: "clear"
};
const animeListUsage = ["/list [a|m|k|o] [username] [wchdp|all|none]", "/list [anilist|mal|kitsu|animeoshi] [username] [wchdp|all|none]", "/list status", "/list off"];
const animeListHelp = "Use " + animeListUsage.join(", ") + ".";

// Validate the provider, single username, and optional status flags before changing any lists.
function parseCommandAnimeList(context) {
    const { args, argsLower, reply } = context;
    const key = animeListProviderAliases.get(argsLower[0]);
    if (key === undefined) {
        reply("invalid list type", true);
        return;
    }
    if (args.length < 2 || args.length > 3) {
        reply(animeListHelp, true);
        return;
    }
    const states = argsLower[2];
    if (states !== undefined && states !== "all" && states !== "none" && !/^[wchdp]+$/.test(states)) {
        reply("Use status letters w, c, h, d, p, or all/none.", true);
        return;
    }
    return { key, username: args[1], states };
}

// Update one anime-list provider and its input after the server accepts the change.
async function setAnimeListProvider(key, username) {
    const provider = animeListProviders[key];
    const data = await requestCommand("anime list update result", {
        type: "library", command: "update anime list", data: { newUsername: username, listType: provider.listType },
    });
    if (!data.success) throw new Error(`${provider.label} list update failed`);
    $(provider.selector).val(username);
}

// Clear the requested anime-list providers one at a time.
async function clearAnimeListProviders(keys) {
    for (const key of keys) {
        const provider = animeListProviders[key];
        if ($(provider.selector).val() || $(provider.updated).text()) await setAnimeListProvider(key, "");
    }
}

// Set the new list successfully before clearing other providers and changing statuses.
function updateAnimeList(key, username, states, clear = Object.keys(animeListProviders).filter(other => other !== key)) {
    if (!Object.hasOwn(animeListProviders, key)) return Promise.reject(new Error("invalid list type"));
    return queueCommandTask("anime list transaction", async () => {
        await setAnimeListProvider(key, username);
        if (states) setAnimeListStatuses(states);
        try { await clearAnimeListProviders(clear); }
        catch (error) { throw new Error(`${animeListProviders[key].label} updated, but clearing other lists failed: ${error.message}`); }
    });
}

// Apply anime-list status flags from their shorthand letters or "all".
function setAnimeListStatuses(states) {
    const all = states === "all";
    setAllStatusCheckboxes(...["w", "c", "h", "d", "p"].map(state => all || states.includes(state)));
}

// Stop the active countdown and clear its timer and remaining time.
function stopCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdown = null;
}

// Replace the countdown and start the game only if the lobby is still ready.
function startCountdown(seconds, context) {
    stopCountdown();
    countdown = seconds;
    context.reply(`Game starting in ${countdown} seconds`);
    const interval = setInterval(() => {
        if (countdownInterval !== interval) return;
        if (!lobby.inLobby) return stopCountdown();
        if (countdown < 1) {
            stopCountdown();
            if (!lobby.isHost) context.reply("failed to start: not host");
            else if (!allPlayersReady()) context.reply("failed to start: not all players ready");
            else lobby.fireMainButtonEvent(true);
        }
        else {
            if (countdown % 10 === 0 || countdown <= 5) context.reply(countdown);
            countdown--;
        }
    }, 1000);
    countdownInterval = interval;
}

// Apply optional lowercase or uppercase formatting to a list of names.
function formatNameList(list, mode) {
    if (commandAlias(nameFormatAliases, mode) === "lower") return list.map(name => name.toLowerCase());
    if (commandAlias(nameFormatAliases, mode) === "upper") return list.map(name => name.toUpperCase());
    return list;
}

// Validate an artist/group ID and reply with the name returned by the shared hover endpoint.
async function replyCommandArtistHover(context, kind) {
    if (context.args.length !== 1) return context.reply(`Use one positive ${kind} ID.`, true);
    const id = parseCommandInteger(context.args[0], 1);
    if (Number.isNaN(id)) return context.reply("invalid number", true);
    const data = await requestCommand("artist hover information", {
        type: "library", command: "artist hover information", data: { [`${kind}Id`]: id },
    }, { timeout: 2000 });
    context.reply(data.hoverInfo.name);
}

// List lookup keys or reply with the value of a matching key.
function replyLookup(context, values) {
    if (!context.args.length) return context.reply(Object.keys(values).join(", "));
    const query = context.argsText.trim().toLowerCase();
    const key = Object.keys(values).find(key => key.toLowerCase() === query);
    if (key !== undefined) context.reply(values[key]);
}

// Configure the daily-quest answer to submit after a random 3-5 second delay.
function questAutoThrow(context, anime) {
    applyCommandControl("autoThrow", { time: [3000, 5000], text: anime, multichoice: null }, context,
        () => `auto throwing: ${anime} after 3-5 seconds`);
}

// Select a daily-quest anime and prepare its settings update without applying it yet.
function selectCommandDailyQuest(context) {
    const { args, argsLower, reply } = context;
    const mode = commandAlias(dailyQuestAliases, argsLower[0]);
    if (!args.length) {
        reply("Use detect, random count, kutd, op, ed, in, or comma-separated genres.", true);
        return;
    }
    if (mode !== undefined && args.length !== (mode === "random" ? 2 : 1)) {
        reply("Use one quest option, or random followed by a positive genre count.", true);
        return;
    }
    if (mode === "detect") return detectCommandDailyQuest(context);
    if (mode === "random") {
        const count = parseCommandInteger(argsLower[1], 1, Object.keys(idTranslator.genreNames).length);
        if (Number.isNaN(count)) {
            reply("invalid number", true);
            return;
        }
        const ids = shuffleArray(Object.keys(idTranslator.genreNames).map(id => parseCommandInteger(id))).slice(0, count);
        reply(`Genre: ${ids.map(id => idTranslator.genreNames[id]).join(", ")}`, true);
        const anime = findAnimeMatchingAllGenres(ids);
        if (!anime) {
            reply("no anime found for those genres", true);
            return;
        }
        reply(anime);
        return { anime, apply: () => matchSettingsToAnime(anime) };
    }
    if (mode === "kutd") {
        const anime = "MF Ghost 3rd Season";
        reply(anime);
        return { anime, apply: () => matchSettingsToAnime(anime) };
    }
    if (["OP", "ED", "IN"].includes(mode)) {
        return { anime: dqTypeMap[mode], apply: () => matchSettingsToType(mode) };
    }
    const matches = resolveCommandLookupList(context, idTranslator.genreNames);
    if (!matches) return;
    const anime = findAnimeMatchingAllGenres(matches.map(result => result.id));
    if (!anime) {
        reply("no anime found for those genres", true);
        return;
    }
    reply(anime);
    return { anime, apply: () => matchSettingsToAnime(anime) };
}

// Prefer incomplete genre quests, then fall back to the first incomplete song-type quest.
function detectCommandDailyQuest(context) {
    const { reply } = context;
    const genreIdsByName = {};
    for (const [id, name] of Object.entries(idTranslator.genreNames)) {
        genreIdsByName[name.toLowerCase()] = Number(id);
    }
    const genreQuests = Object.values(qusetContainer.questMap).filter(quest => {
        return quest.name.includes("_fan") && quest.state !== quest.targetState;
    });
    const genreIds = genreQuests.map(quest => {
        const genreName = quest.name.split(".")[2].replace("_fan", "").replaceAll("_", " ");
        return genreIdsByName[genreName];
    });
    if (genreIds.length) {
        const anime = findAnimeWithMostMatchingGenres(genreIds);
        if (!anime) {
            reply("no anime found for those genres", true);
            return;
        }
        const matchedGenres = dqMap[anime].genre.filter(id => genreIds.includes(id)).map(id => idTranslator.genreNames[id]);
        const remainingSongs = Math.max(...genreQuests.map(quest => quest.targetState - quest.state));
        reply(`Matched (${matchedGenres.length}/${genreIds.length}) ${matchedGenres.join(", ")}`, true);
        return { anime, apply: () => matchSettingsToAnime(anime, remainingSongs) };
    }
    const songTypeQuests = Object.values(qusetContainer.questMap).filter(quest => quest.name.includes("dont_skip") && quest.state !== quest.targetState);
    if (!songTypeQuests.length) {
        reply("no incomplete genre or type quests detected", true);
        return;
    }
    const songTypes = { openings: "OP", endings: "ED", inserts: "IN" };
    const type = songTypes[songTypeQuests[0].name.split(".")[2].split("_")[2]];
    const anime = dqTypeMap[type];
    if (anime) {
        const remainingSongs = songTypeQuests[0].targetState - songTypeQuests[0].state;
        reply("Quest type: " + type);
        return { anime, apply: () => matchSettingsToType(type, remainingSongs) };
    }
    return;
}

// Run a command and report failures through its original reply destination.
async function executeCommand(entry, context) {
    try { return await entry.run(context); }
    catch (error) {
        console.error(`Command ${context.command} failed`, error);
        context.reply(`Command failed: ${error.message || error}`, true);
    }
    finally { commitCommandSettings(); }
}

// === Command definitions and dispatch ===

const commandRegistry = [
    {
        aliases: ["players"],
        description: "List players, optionally in lowercase or uppercase.",
        run(context) {
            const { argsLower, reply } = context;
            reply(formatNameList(getPlayerList(), argsLower[0]).join(", "));
        },
    },
    {
        aliases: ["spectators"],
        description: "List spectators, optionally in lowercase or uppercase.",
        run(context) {
            const { argsLower, reply } = context;
            reply(formatNameList(getSpectatorList(), argsLower[0]).join(", "));
        },
    },
    {
        aliases: ["teammates"],
        description: "List teammates for yourself, a player, or a team number.",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length > 2) return reply("Use [player or team number] [lower or upper].", true);
            let team = getTeamNumber(selfName);
            let mode = argsLower[1];
            if (args.length === 1 && commandAlias(nameFormatAliases, argsLower[0])) mode = argsLower[0];
            else if (args.length) team = isPlayer(args[0]) ? getTeamNumber(args[0]) : parseCommandInteger(args[0]);
            if (!Number.isInteger(team)) return reply("player or team not found", true);
            if (
                mode !== undefined
                && !commandAlias(nameFormatAliases, mode)
            ) {
                return reply("Use lower or upper formatting.", true);
            }
            const names = getTeamList(team);
            reply(names.length ? formatNameList(names, mode).join(", ") : "no teammates");
        },
    },
    {
        aliases: ["teamnumber", "teamnum"],
        description: "Show the team number of a player.",
        run(context) {
            const { argsLower, reply } = context;
            reply(getTeamNumber(argsLower[0] || selfName));
        },
    },
    {
        aliases: ["roll"],
        description: "Roll integers, choose players or anime, sample genres/tags, or randomize teams and relay orders.",
        usage: rollUsage,
        async run(context) {
            const { args, argsLower, argsText, reply } = context;
            if (!args.length) return reply(rollHelp, true);
            if (argsText.includes(",")) {
                const choices = argsText.split(",").map(value => value.trim()).filter(Boolean);
                if (choices.length < 2) return reply("Use at least two comma-separated choices.", true);
                return reply(randomItem(choices));
            }
            const bounds = parseRollBounds(args);
            if (bounds) return reply(`rolls ${randomIntInc(...bounds)}`);
            const operation = rollOptionMap.get(argsLower[0]);
            if (operation) return operation.run(context);
            reply(rollHelp, true);
        },
    },
    {
        aliases: ["shuffle"],
        description: "Shuffle a list of anything (separate with commas).",
        usage: ["/shuffle [list]"],
        run(context) {
            const { args, argsLower, argsText, reply } = context;
            if (!args.length) return lobby.shuffleTeams();
            const mode = commandAlias(playerModeAliases, argsLower[0]);
            let names;
            if (["player", "spectator", "teammate"].includes(mode) && !argsText.includes(",")) {
                if (args.length > (mode === "teammate" ? 2 : 1)) {
                    return reply("Use players, spectators, teammates [team number], or comma-separated choices.", true);
                }
                const team = args.length === 2 ? parseCommandInteger(args[1]) : getTeamNumber(selfName);
                if (mode === "teammate" && !Number.isInteger(team)) return reply("invalid team number", true);
                names = commandPlayerCandidates(mode, team);
            }
            else names = argsText.split(",").map(value => value.trim()).filter(Boolean);
            if (!names.length) return reply("no candidates to shuffle", true);
            if (names.length === 1) return reply("Use at least two candidates to shuffle.", true);
            reply(shuffleArray(names).join(", "));
        },
    },
    {
        aliases: ["calc", "math"],
        description: "Calculate a math expression.",
        usage: ["/calc [expression]"],
        run(context) {
            const { argsText, reply } = context;
            reply(calc(argsText));
        },
    },
    {
        aliases: ["roomsize", "size"],
        description: "Change room size.",
        usage: ["/size [room size]"],
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one room size of at least 2.", true);
            const { argsLower } = context;
            const option = parseCommandInteger(argsLower[0], 2);
            if (Number.isNaN(option)) return context.reply("invalid number", true);
            return changeGameSettings({ roomSize: option });
        },
    },
    {
        aliases: ["loot", "looting"],
        description: "Change to looting mode with inventory size and looting time.",
        usage: ["/loot [size] [time]"],
        run(context) {
            if (context.args.length > 2) {
                return context.reply("Use /loot [inventory size] [looting time].", true);
            }
            const { args, argsLower } = context;
            if (args.length === 0) {
                return changeGameSettings({ showSelection: 2 });
            }
            else if (args.length === 1) {
                const inventorySize = parseCommandInteger(argsLower[0], 1);
                if (Number.isNaN(inventorySize)) return context.reply("invalid number", true);
                return changeGameSettings(settings => {
                    settings.showSelection = 2;
                    settings.inventorySize.randomOn = false;
                    settings.inventorySize.standardValue = inventorySize;
                    return { showSelection: settings.showSelection, inventorySize: settings.inventorySize };
                });
            }
            else if (args.length === 2) {
                const inventorySize = parseCommandInteger(argsLower[0], 1);
                if (Number.isNaN(inventorySize)) return context.reply("invalid number", true);
                const lootingTime = parseCommandInteger(argsLower[1], 1);
                if (Number.isNaN(lootingTime)) return context.reply("invalid number", true);
                return changeGameSettings(settings => {
                    settings.showSelection = 2;
                    settings.inventorySize.randomOn = false;
                    settings.inventorySize.standardValue = inventorySize;
                    settings.lootingTime.randomOn = false;
                    settings.lootingTime.standardValue = lootingTime;
                    return { showSelection: settings.showSelection, inventorySize: settings.inventorySize, lootingTime: settings.lootingTime };
                });
            }
        },
    },
    {
        aliases: ["t", "type", "types", "songtype", "songtypes"],
        description: "Change song types.",
        usage: ["/type [oei]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 1) {
                const flags = parseCommandFlags(argsLower[0], songTypeAliases, "oei");
                if (flags === undefined) {
                    return reply("Use openings, endings, inserts, all, or a combination of o/e/i.", true);
                }
                return changeGameSettings(settings => {
                    settings.songType.standardValue = { openings: flags.includes("o"), endings: flags.includes("e"), inserts: flags.includes("i") };
                    settings.songType.advancedValue = { openings: 0, endings: 0, inserts: 0, random: settings.numberOfSongs };
                    return { songType: settings.songType };
                });
            }
            const option = commandAlias(songTypeCountAliases, argsLower[0]);
            const count = parseCommandInteger(args[1], 0);
            if (args.length !== 2 || option === undefined || Number.isNaN(count)) {
                return reply("Use a song type and a nonnegative count, or a song-type selection.", true);
            }
            return changeGameSettings(settings => {
                const options = option === "all" ? ["openings", "endings", "inserts", "random"] : [option];
                for (const key of options) settings.songType.advancedValue[key] = count;
                return { songType: settings.songType };
            });
        },
    },
    {
        aliases: ["random"],
        description: "Change selection type to random.",
        usage: ["/random"],
        run(context) {
            return changeGameSettings(settings => {
                settings.songSelection.standardValue = 1;
                settings.songSelection.advancedValue = { random: settings.numberOfSongs, unwatched: 0, watched: 0 };
                return { songSelection: settings.songSelection };
            });
        },
    },
    {
        aliases: ["unwatched"],
        description: "Change selection type to unwatched.",
        usage: ["/unwatched"],
        run(context) {
            return changeGameSettings(settings => {
                settings.songSelection.standardValue = 2;
                settings.songSelection.advancedValue = { random: 0, unwatched: settings.numberOfSongs, watched: 0 };
                return { songSelection: settings.songSelection };
            });
        },
    },
    {
        aliases: ["watched"],
        description: "Change selection type to watched.",
        usage: ["/watched"],
        run(context) {
            return changeGameSettings(settings => {
                settings.songSelection.standardValue = 3;
                settings.songSelection.advancedValue = { random: 0, unwatched: 0, watched: settings.numberOfSongs };
                return { songSelection: settings.songSelection };
            });
        },
    },
    {
        aliases: ["songselection", "selection"],
        description: "Configure random, watched, and unwatched song selection.",
        run(context) {
            const option = commandAlias(selectionAliases, context.argsLower[0]);
            const count = parseCommandInteger(context.args[1], 0);
            if (
                context.args.length !== 2
                || option === undefined
                || Number.isNaN(count)
            ) {
                return context.reply("Use random, watched, unwatched, or all followed by a nonnegative count.", true);
            }
            return changeGameSettings(settings => {
                const options = option === "all" ? ["watched", "unwatched", "random"] : [option];
                for (const key of options) settings.songSelection.advancedValue[key] = count;
                return { songSelection: settings.songSelection };
            });
        },
    },
    {
        aliases: ["time", "guesstime"],
        description: "Change song guess time.",
        usage: ["/time [seconds or low-high]"],
        run(context) {
            const values = parseIntegerRange(context.optionsText, 1, Number.MAX_SAFE_INTEGER);
            if (!values) return context.reply("Use one valid integer or an ascending integer range.", true);
            return changeGameSettings(settings => {
                settings.guessTime.randomOn = values.length === 2;
                if (values.length === 1) settings.guessTime.standardValue = values[0];
                else settings.guessTime.randomValue = values;
                return { guessTime: settings.guessTime };
            });
        },
    },
    {
        aliases: ["etime", "extratime", "extraguesstime"],
        description: "Change song guess extra time.",
        usage: ["/extratime [seconds or low-high]"],
        run(context) {
            const values = parseIntegerRange(context.optionsText, 0, Number.MAX_SAFE_INTEGER);
            if (!values) return context.reply("Use one valid integer or an ascending integer range.", true);
            return changeGameSettings(settings => {
                settings.extraGuessTime.randomOn = values.length === 2;
                if (values.length === 1) settings.extraGuessTime.standardValue = values[0];
                else settings.extraGuessTime.randomValue = values;
                return { extraGuessTime: settings.extraGuessTime };
            });
        },
    },
    {
        aliases: ["sp", "sample", "samplepoint", "startpoint"],
        description: "Change start sample point.",
        usage: ["/sample [start|medium|end]", "/sample [percentage or low-high]"],
        run(context) {
            const named = commandAlias(sampleAliases, context.optionsText);
            const values = named === undefined ? parseIntegerRange(context.optionsText, 0, 100) : undefined;
            if (
                named === undefined
                && !values
            ) {
                return context.reply("Use start, medium, end, or an ascending percentage range from 0–100.", true);
            }
            return changeGameSettings(settings => {
                settings.samplePoint.randomOn = named === undefined;
                if (named !== undefined) settings.samplePoint.standardValue = named;
                else settings.samplePoint.randomValue = values.length === 1 ? [values[0], values[0]] : values;
                return { samplePoint: settings.samplePoint };
            });
        },
    },
    {
        aliases: ["lives", "life"],
        description: "Change number of lives.",
        usage: ["/lives [1-5]"],
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one life count from 1–5.", true);
            const { argsLower, reply } = context;
            const option = parseCommandInteger(argsLower[0]);
            if (
                !Number.isInteger(option)
                || option < 1
                || option > 5
            ) {
                return reply("lives must be 1-5", true);
            }
            return changeGameSettings({ scoreType: quiz.SCORE_TYPE_IDS.LIVES, lives: option });
        },
    },
    {
        aliases: ["boss"],
        description: "Change to boss mode.",
        usage: ["/boss [lives] [powerups] [maxsongs]"],
        run(context) {
            const { args, reply } = context;
            if (!args.length) return changeGameSettings({ scoreType: quiz.SCORE_TYPE_IDS.BOSS });
            const values = args.map(value => parseCommandInteger(value, 0));
            if (
                args.length !== 3
                || values.some(Number.isNaN)
                || values[0] < 1
                || values[2] < 1
            ) {
                return reply("Use positive lives and song counts, and nonnegative powerups: /boss lives powerups maxsongs.", true);
            }
            return changeGameSettings({ scoreType: quiz.SCORE_TYPE_IDS.BOSS, bossLives: values[0], bossPowerUps: values[1], bossMaxSongs: values[2] });
        },
    },
    {
        aliases: ["hint", "hints"],
        description: "Change to hint mode.",
        usage: ["/hint"],
        run(context) {
            const { args } = context;
            if (args.length === 0) {
                return changeGameSettings({ scoreType: quiz.SCORE_TYPE_IDS.HINT });
            }
        },
    },
    {
        aliases: ["team", "teams", "teamsize"],
        description: "Change team size.",
        usage: ["/team [team size]"],
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive team size.", true);
            const { argsLower, reply } = context;
            const option = parseCommandInteger(argsLower[0], 1);
            if (Number.isNaN(option)) return reply("invalid number", true);
            return changeGameSettings({ teamSize: option });
        },
    },
    {
        aliases: ["n", "songs", "numsongs"],
        description: "Change number of songs.",
        usage: ["/songs [song count]"],
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive song count.", true);
            const { argsLower, reply } = context;
            const option = parseCommandInteger(argsLower[0], 1);
            if (Number.isNaN(option)) return reply("invalid number", true);
            return changeGameSettings({ numberOfSongs: option });
        },
    },
    {
        aliases: ["d", "dif", "difficulty"],
        description: "Change difficulty.",
        usage: ["/dif [easy|medium|hard|emh]", "/dif [percentage or low-high]"],
        run(context) {
            const flags = parseCommandFlags(context.optionsText, difficultyAliases, "emh");
            const values = flags === undefined ? parseIntegerRange(context.optionsText, 0, 100) : undefined;
            if (
                flags === undefined
                && !values
            ) {
                return context.reply("Use easy, medium, hard, a combination of e/m/h, or an ascending percentage range from 0–100.", true);
            }
            return changeGameSettings(settings => {
                settings.songDifficulity.advancedOn = flags === undefined;
                if (flags !== undefined) {
                    settings.songDifficulity.standardValue = { easy: flags.includes("e"), medium: flags.includes("m"), hard: flags.includes("h") };
                }
                else settings.songDifficulity.advancedValue = values.length === 1 ? [values[0], values[0]] : values;
                return { songDifficulity: settings.songDifficulity };
            });
        },
    },
    {
        aliases: ["year", "years"],
        description: "Change year filter.",
        usage: ["/year [low] [high]"],
        run(context) {
            if (!context.args.length) {
                return changeGameSettings({ vintage: hostModal.DEFUALT_SETTINGS.vintage });
            }
            const values = parseIntegerRange(context.optionsText);
            if (!values) return context.reply("Use one year or an ascending year range.", true);
            return changeGameSettings(settings => {
                settings.vintage.advancedValueList = [];
                settings.vintage.standardValue = { years: values.length === 1 ? [values[0], values[0]] : values, seasons: [0, 3] };
                return { vintage: settings.vintage };
            });
        },
    },
    {
        aliases: ["season", "seasons"],
        description: "Change season filter (winter, spring, summer, fall).",
        usage: ["/season [text]"],
        run(context) {
            const parts = context.args.length ? parseCommandEndpoints(context.optionsText) : ["winter", "fall"];
            const values = parts?.map(value => commandAlias(seasonValues, value));
            if (
                !values
                || values.some(value => value === undefined)
            ) {
                return context.reply("Use winter, spring, summer, fall, or two season endpoints.", true);
            }
            return changeGameSettings(settings => {
                settings.vintage.advancedValueList = [];
                settings.vintage.standardValue.seasons = values.length === 1 ? [values[0], values[0]] : values;
                return { vintage: settings.vintage };
            });
        },
    },
    {
        aliases: ["vintage"],
        description: "Change vintage.",
        usage: ["/vintage [text]"],
        run(context) {
            if (!context.args.length) {
                return changeGameSettings({ vintage: hostModal.DEFUALT_SETTINGS.vintage });
            }
            const match = /^(\S+)\s+(\d+)(?:(?:\s*[-,]\s*|\s+)(\S+)\s+(\d+))?$/.exec(context.optionsText);
            if (!match) {
                return context.reply("Use season year, optionally followed by a second season year.", true);
            }
            const seasons = [commandAlias(seasonValues, match[1]), commandAlias(seasonValues, match[3] ?? match[1])];
            const years = [parseCommandInteger(match[2], 0), parseCommandInteger(match[4] ?? match[2], 0)];
            if (
                seasons.some(value => value === undefined)
                || years.some(Number.isNaN)
            ) {
                return context.reply("Use valid seasons and integer years.", true);
            }
            if (
                years[0] > years[1]
                || (years[0] === years[1] && seasons[0] > seasons[1])
            ) {
                return context.reply("Use an ascending vintage range.", true);
            }
            return changeGameSettings(settings => {
                settings.vintage.advancedValueList = [];
                settings.vintage.standardValue = { years, seasons };
                return { vintage: settings.vintage };
            });
        },
    },
    {
        aliases: ["genre", "genres"],
        description: "Change genre.",
        usage: ["/genre [text]"],
        run(context) {
            const matches = context.args.length ? resolveCommandLookupList(context, idTranslator.genreNames) : [];
            if (!matches) return;
            return changeGameSettings({ genre: matches.map(result => ({ id: String(result.id), state: 1 })) });
        },
    },
    {
        aliases: ["tag", "tags"],
        description: "Change tags.",
        usage: ["/tag [text]"],
        run(context) {
            const matches = context.args.length ? resolveCommandLookupList(context, idTranslator.tagNames) : [];
            if (!matches) return;
            return changeGameSettings({ tags: matches.map(result => ({ id: String(result.id), state: 1 })) });
        },
    },
    {
        aliases: ["pscore", "pscores", "playerscore", "playerscores"],
        description: "Change the player score filter.",
        run(context) {
            const values = parseIntegerRange(context.optionsText, 1, 10);
            if (!values) {
                return context.reply("Use one valid integer or an ascending integer range from 1–10.", true);
            }
            return changeGameSettings(settings => {
                settings.playerScore.advancedOn = false;
                settings.playerScore.standardValue = values.length === 1 ? [values[0], values[0]] : values;
                return { playerScore: settings.playerScore };
            });
        },
    },
    {
        aliases: ["ascore", "ascores", "animescore", "animescores"],
        description: "Change the anime score filter.",
        run(context) {
            const values = parseIntegerRange(context.optionsText, 1, 10);
            if (!values) {
                return context.reply("Use one valid integer or an ascending integer range from 1–10.", true);
            }
            return changeGameSettings(settings => {
                settings.animeScore.advancedOn = false;
                settings.animeScore.standardValue = values.length === 1 ? [values[0], values[0]] : values;
                return { animeScore: settings.animeScore };
            });
        },
    },
    {
        aliases: ["skip"],
        hotkey: { action: "voteSkip", title: "Vote Skip" },
        description: "Vote skip on current song.",
        usage: ["/skip"],
        run(context) {
            voteCommandSkip();
        },
    },
    {
        aliases: ["pause"],
        hotkey: { action: "pause", title: "Pause / Unpause" },
        description: "Pause/unpause game.",
        usage: ["/pause"],
        run(context) {
            if (!quiz.inQuiz) return;
            socket.sendCommand({ type: "quiz", command: `quiz ${quiz.pauseButton.pauseOn ? "unpause" : "pause"}` });
        },
    },
    {
        aliases: ["mutereplay", "mr"],
        description: "Mute song when the replay starts.",
        usage: ["/mutereplay"],
        controlName: "muteReplay",
        control: commandControls.muteReplay,
        run(context) {
            applyCommandControl("muteReplay", !muteReplay, context);
        },
    },
    {
        aliases: ["mutesubmit", "ms"],
        description: "Mute song when you submit your answer.",
        usage: ["/mutesubmit"],
        controlName: "muteSubmit",
        control: commandControls.muteSubmit,
        run(context) {
            applyCommandControl("muteSubmit", !muteSubmit, context);
        },
    },
    {
        aliases: ["avs", "asv", "autoskip", "autovoteskip"],
        description: "Automatically vote to skip based on time, correct answer, or team valid answer.",
        usage: ["/autoskip", "/autoskip [seconds]", "/autoskip valid"],
        controlName: "autoVoteSkip",
        control: commandControls.autoVoteSkip,
        run(context) {
            const { args, optionsText, reply } = context;
            const mode = commandAlias(autoSkipAliases, optionsText);
            if (args.length === 0) {
                applyCommandControl("autoVoteSkip", autoVoteSkip.length ? [] : [0], context, () => `auto vote skip ${autoVoteSkip.length ? "enabled" : "disabled"}`);
            }
            else if (mode === "valid") {
                applyCommandControl("autoVoteSkip", "valid", context, () => `auto vote skip after first valid answer on team enabled`);
            }
            else if (mode === "correct") {
                applyCommandControl("autoVoteSkip", "correct", context, () => `auto vote skip correct answers only${options.autoVoteSkipReplay ? " (please disable replay phase skip in settings)" : ""}`);
            }
            else if (mode === "guess") {
                const option = !options.$AUTO_VOTE_GUESS.prop("checked");
                options.$AUTO_VOTE_GUESS.prop("checked", option);
                options.updateAutoVoteSkipGuess();
                reply(`auto vote skip guess phase ${option ? "enabled" : "disabled"}`, true);
            }
            else if (mode === "replay") {
                const option = !options.$AUTO_VOTE_REPLAY.prop("checked");
                options.$AUTO_VOTE_REPLAY.prop("checked", option);
                options.updateAutoVoteSkipReplay();
                reply(`auto vote skip replay phase ${option ? "enabled" : "disabled"}`, true);
            }
            else {
                const time = parseCommandTimes(optionsText);
                if (
                    !time
                    || (time.length === 2 && time[0] === time[1])
                ) {
                    return reply("Use one nonnegative time or an increasing pair of times.", true);
                }
                applyCommandControl("autoVoteSkip", time, context, () => `auto vote skip after ${time.map(value => value / 1000).join("-")} seconds`);
            }
        },
    },
    {
        aliases: ["ak", "autokey", "autosubmit"],
        hotkey: { action: "autoKey", title: "Toggle Autokey" },
        description: "Automatically send quiz answer on each key press.",
        usage: ["/autokey"],
        controlName: "autoKey",
        control: commandControls.autoKey,
        run(context) {
            const { args } = context;
            if (!args.length) applyCommandControl("autoKey", !autoKey, context);
        },
    },
    {
        aliases: [
            "at",
            "att",
            "atmc",
            "attmc",
            "autothrow",
            "autothrowtime",
            "autothrowmc",
            "autothrowmultichoice",
            "autothrowmultiplechoice",
            "autothrowtimemc",
            "autothrowtimemultichoice",
        ],
        description: "Automatically send a quiz answer at a configured time each song.",
        usage: ["/autothrow [text]", "/att [seconds or low-high] [text]", "/atmc [1-4 or random]", "/attmc [seconds or low-high] [1-4 or random]"],
        controlName: "autoThrow",
        control: commandControls.autoThrow,
        run(context) {
            const { command, args, argsLower, argsText, reply } = context;
            if (!args.length) {
                return applyCommandControl("autoThrow", { time: [], text: null, multichoice: null }, context);
            }
            const mode = autoThrowModes[command];
            if (mode === "text") {
                const text = translateShortcodeToUnicode(argsText).text;
                return applyCommandControl("autoThrow", { time: [1], text, multichoice: null }, context, () => `auto throwing: ${text}`);
            }
            if (mode === "choice") {
                const multichoice = parseMultichoiceAnswer(argsText);
                if (
                    args.length !== 1
                    || multichoice === undefined
                ) {
                    return reply("Choose 1–4 or random.", true);
                }
                return applyCommandControl("autoThrow", { time: [100], text: null, multichoice }, context,
                    () => `auto throwing multichoice item: ${multichoice}`);
            }
            const parsed = parseTimedAnswer(context, mode === "timedChoice");
            if (!parsed) {
                return reply("Use one nonnegative time or an ordered range, followed by text or a choice.", true);
            }
            const { time, answer } = parsed;
            const seconds = time.map(value => value / 1000);
            if (mode === "timedText") {
                const text = translateShortcodeToUnicode(answer).text;
                applyCommandControl("autoThrow", { time, text, multichoice: null }, context,
                    () => `auto throwing: ${text} after ${seconds.join("-")} seconds`);
            }
            else if (mode === "timedChoice") {
                const multichoice = parseMultichoiceAnswer(answer);
                if (multichoice === undefined) return reply("Choose 1–4 or random.", true);
                applyCommandControl("autoThrow", { time, text: null, multichoice }, context,
                    () => `auto throwing multichoice item: ${multichoice} after ${seconds.join("-")} seconds`);
            }
        },
    },
    {
        aliases: ["autocopy", "ac"],
        description: "Automatically copy answer from the specified player on your team.",
        usage: ["/autocopy [name]"],
        controlName: "autoCopy",
        control: commandControls.autoCopy,
        run(context) {
            const { args, argsLower } = context;
            if (args.length === 0) {
                applyCommandControl("autoCopy", "", context);
            }
            else if (args.length === 1) {
                applyCommandControl("autoCopy", argsLower[0], context);
            }
        },
    },
    {
        aliases: ["automute", "am"],
        description: "Mute after a fixed delay or a random delay within a range. No arguments disable the shared mute automation.",
        usage: ["/automute [seconds or low-high]"],
        controlName: "autoMute",
        control: commandControls.autoMute,
        run(context) {
            return runAutoMuteCommand(context, "mute");
        },
    },
    {
        aliases: ["autounmute", "au"],
        description: "Unmute after a fixed delay or a random delay within a range. No arguments disable the shared mute automation.",
        usage: ["/autounmute [seconds or low-high]"],
        run(context) {
            return runAutoMuteCommand(context, "unmute");
        },
    },
    {
        aliases: ["automutetoggle", "amt"],
        description: "Toggle mute at each time in a list of at least two distinct times. No arguments disable the shared mute automation.",
        usage: ["/automutetoggle [seconds, seconds, ...]"],
        run(context) {
            return runAutoMuteCommand(context, "toggle");
        },
    },
    {
        aliases: ["automuterandom", "amr"],
        description: "Mute for a fixed duration at a random point in the song. No arguments disable the shared mute automation.",
        usage: ["/automuterandom [duration]"],
        run(context) {
            return runAutoMuteCommand(context, "randomMute");
        },
    },
    {
        aliases: ["autounmuterandom", "aur"],
        description: "Unmute for a fixed duration at a random point in the song. No arguments disable the shared mute automation.",
        usage: ["/autounmuterandom [duration]"],
        run(context) {
            return runAutoMuteCommand(context, "randomUnmute");
        },
    },
    {
        aliases: ["autohint"],
        description: "Automatically request a hint in hint mode.",
        usage: ["/autohint [type]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (!args.length) autoHint = "";
            else if (args.length === 1 && Object.hasOwn(hintAliases, argsLower[0])) autoHint = hintAliases[argsLower[0]];
            else return reply("Options: name, info, multichoice, tiny, blur, audio, off", true);
            reply(autoHint ? `auto hint set to ${hintNames[autoHint]}` : "auto hint disabled", true);
        },
    },
    {
        aliases: ["autoready"],
        description: "Automatically ready up when you join a lobby.",
        usage: ["/autoready"],
        controlName: "autoReady",
        control: commandControls.autoReady,
        run(context) {
            applyCommandControl("autoReady", !autoReady, context);
        },
    },
    {
        aliases: ["autostart", "astart", "ast"],
        description: "Automatically start the game when everyone is ready if you are host.",
        usage: ["/autostart"],
        controlName: "autoStart",
        control: commandControls.autoStart,
        run(context) {
            const { args, reply } = context;
            if (args.length > 2) return reply("Use a delay and an optional whole repeat count or ∞.", true);
            const value = args.length ? parseAutoStartOptions(args[0], args[1]) : { delay: 0, remaining: autoStart.remaining !== 0 ? 0 : null };
            if (!value) return reply("Use a finite nonnegative delay and a whole repeat count, or ∞.", true);
            applyCommandControl("autoStart", value, context);
        },
    },
    {
        aliases: ["autopause", "apause"],
        description: "Automatically pause the quiz when a player leaves or disconnects if you are host.",
        usage: ["/autopause"],
        controlName: "autoPause",
        control: commandControls.autoPause,
        run(context) {
            applyCommandControl("autoPause", !autoPause, context);
        },
    },
    {
        aliases: ["autohost", "ah"],
        description: "Automatically transfer host to the specified player.",
        usage: ["/autohost [name]"],
        controlName: "autoHost",
        control: commandControls.autoHost,
        run(context) {
            const { args, argsLower } = context;
            if (args.length === 0) {
                applyCommandControl("autoHost", "", context);
            }
            else if (args.length === 1) {
                applyCommandControl("autoHost", argsLower[0], context);
            }
        },
    },
    {
        aliases: ["autoinvite", "autoinv"],
        description: "Automatically invite a player to your room when they log in (only friends).",
        usage: ["/autoinvite [name]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                autoInvite = "";
                reply("auto invite disabled", true);
            }
            else if (args.length === 1) {
                autoInvite = argsLower[0];
                reply(`auto inviting ${autoInvite}`, true);
            }
        },
    },
    {
        aliases: ["autoacceptinvite", "autoaccept", "aai"],
        description: "Automatically accept room invites based on friends, everyone, or your custom list.",
        usage: ["/autoaccept [option]"],
        controlName: "autoAcceptInvite",
        control: commandControls.autoAcceptInvite,
        run(context) {
            const { args, argsLower, optionsText } = context;
            if (args.length === 0) {
                applyCommandControl("autoAcceptInvite", "", context);
            }
            else if (["a", "e", "all", "everyone"].includes(argsLower[0])) {
                applyCommandControl("autoAcceptInvite", "all", context);
            }
            else if (["f", "friend", "friends"].includes(argsLower[0])) {
                applyCommandControl("autoAcceptInvite", "friends", context);
            }
            else {
                applyCommandControl("autoAcceptInvite", optionsText.split(",").map((x) => x.trim()).filter(Boolean), context);
            }
        },
    },
    {
        aliases: ["autojoin"],
        description: "Automatically join a room by ID and optional password.",
        async run(context) {
            const { args, reply } = context;
            if (args.length === 0) {
                if (autoJoinRoom || isSoloMode() || isQuizOfTheDay()) {
                    autoJoinRoom = false;
                    saveSettings();
                    reply("auto join room disabled", true);
                }
                else if (lobby.inLobby) {
                    const password = hostModal.$passwordInput.val();
                    autoJoinRoom = { id: lobby.gameId, password: password };
                    saveSettings();
                    reply(`auto joining room ${lobby.gameId} ${password}`, true);
                }
                else if (quiz.inQuiz || battleRoyal.inView) {
                    const data = await requestOwnGameInvite();
                    const password = hostModal.$passwordInput.val();
                    autoJoinRoom = { id: data.gameId, password: password };
                    saveSettings();
                    reply(`auto joining room ${data.gameId} ${password}`, true);
                }
                else {
                    autoJoinRoom = false;
                    saveSettings();
                    reply("auto join room disabled", true);
                }
            }
            else {
                const room = parseCommandRoom(context);
                if (!room) return reply("Use a positive room ID followed by an optional password.", true);
                const { id, password } = room;
                autoJoinRoom = { id: id, password: password || "" };
                saveSettings();
                reply(`auto joining room ${id} ${password || ""}`, true);
            }
        },
    },
    {
        aliases: ["autoswitch"],
        description: "Automatically switch between player and spectator.",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                autoSwitch.mode = "";
                reply("auto switch disabled", true);
            }
            else {
                if (argsLower[0].startsWith("p")) {
                    autoSwitch.mode = "player";
                }
                else if (argsLower[0].startsWith("s")) {
                    autoSwitch.mode = "spectator";
                }
                else {
                    return reply("Options: player, spectator", true);
                }
                if (argsLower[1]) {
                    if (argsLower[1].startsWith("t")) {
                        autoSwitch.temp = true;
                    }
                    if (argsLower[1].startsWith("f")) {
                        autoSwitch.temp = false;
                    }
                }
                else {
                    autoSwitch.temp = false;
                }
                reply(`auto switching to ${autoSwitch.mode}`, true);
                checkAutoSwitch();
            }
        },
    },
    {
        aliases: ["autolobby", "autovotelobby", "avl"],
        description: "Automatically vote to return to lobby when the host starts a vote.",
        usage: ["/autolobby"],
        controlName: "autoVoteLobby",
        control: commandControls.autoVoteLobby,
        run(context) {
            applyCommandControl("autoVoteLobby", !autoVoteLobby, context);
        },
    },
    {
        aliases: ["autostatus"],
        description: "Automatically set your profile status to the selected state on log in.",
        controlName: "autoStatus",
        control: commandControls.autoStatus,
        run(context) {
            const { args, argsText, reply } = context;
            const status = args.length ? parseSocialStatus(argsText) : "ONLINE";
            if (status) applyCommandControl("autoStatus", autoStatusValues[status], context);
            else reply("Options: away, do not disturb, offline", true);
        },
    },
    {
        aliases: ["autodownloadsong", "autodownloadsongs", "ads"],
        description: "Automatically download songs (options: mp3, video).",
        usage: ["/autodownloadsong [text]"],
        run(context) {
            const { args, optionsText, reply } = context;
            if (!args.length) {
                if (!autoDownloadSong.length) return reply("Options: mp3, video, 480, 720", true);
                autoDownloadSong = [];
                return reply("auto download song disabled", true);
            }
            const formats = commandOptionList(optionsText);
            if (
                !formats.length
                || formats.some(value => !["720", "480", "mp3", "video"].includes(value))
            ) {
                return reply("Use only mp3, video, 480, or 720, separated by spaces or commas.", true);
            }
            autoDownloadSong = formats;
            reply(`auto downloading ${formats.join(", ")}`, true);
        },
    },
    {
        aliases: ["autodownloadjson", "autodownloadjsons", "adj"],
        description: "Automatically download quiz json files (options: solo, ranked, tour).",
        usage: ["/autodownloadjson [text]"],
        run(context) {
            const { args, optionsText, reply } = context;
            const enabled = commandAlias(downloadBooleanAliases, optionsText);
            if (!args.length || enabled !== undefined) {
                autoDownloadJson = enabled ? ["all"] : [];
                return reply(`auto download json ${enabled ? "enabled" : "disabled"}`, true);
            }
            const modes = commandOptionList(optionsText);
            if (
                !modes.length
                || modes.some(value => !["solo", "ranked", "tour"].includes(value))
            ) {
                return reply("Use on/off or solo, ranked, tour separated by spaces or commas.", true);
            }
            autoDownloadJson = modes;
            reply(`auto download json enabled for: ${modes.join(", ")}`, true);
        },
    },
    {
        aliases: ["autoshareanswer", "autoshare", "shareanswer", "asa"],
        description: "Configure automatic sharing of answers.",
        run(context) {
            const { reply } = context;
            autoShareAnswer = !autoShareAnswer;
            reply(`auto share answer in chat ${autoShareAnswer ? "enabled" : "disabled"}`, true);

        },
    },
    {
        aliases: ["countdown", "cd"],
        description: "Start game after # of seconds.",
        usage: ["/countdown [seconds]"],
        run(context) {
            const { args, type, reply } = context;
            if (type !== "chat") return;
            if (!args.length) {
                if (countdown === null) reply("Command: /countdown #", true);
                else {
                    stopCountdown();
                    reply("countdown stopped", true);
                }
                return;
            }
            if (args.length !== 1) return reply("Use one nonnegative countdown in seconds.", true);
            if (!lobby.inLobby) return;
            const seconds = parseCommandInteger(args[0], 0, Math.floor(MAX_COMMAND_DELAY / 1000));
            if (Number.isNaN(seconds)) return reply("invalid number", true);
            if (!lobby.isHost) return reply("countdown failed: not host", true);
            startCountdown(seconds, context);
        },
    },
    {
        aliases: ["ready"],
        hotkey: { action: "ready", title: "Ready" },
        description: "Ready/unready in lobby.",
        usage: ["/ready"],
        run(context) {
            toggleCommandReady();
        },
    },
    {
        aliases: ["answer"],
        description: "Submit an answer or fill the answer input.",
        run(context) {
            const { args, argsText } = context;
            if (args.length > 0) {
                quiz.answerInput.setNewAnswer(argsText);
            }
        },
    },
    {
        aliases: ["invite", "inv"],
        description: "Invite player to game.",
        usage: ["/invite [name]"],
        run(context) {
            const { args, optionsText, reply } = context;
            if (args.length === 0) {
                const name = resolveCommandTarget(context, { dm: true });
                if (name !== undefined) {
                    socket.sendCommand({ type: "social", command: "invite to game", data: { target: name } });
                }
            }
            else {
                const list = commandOptionList(optionsText);
                if (!list.length) return reply("Specify at least one player to invite.", true);
                list.forEach((name, i) => {
                    setTimeout(() => {
                        socket.sendCommand({ type: "social", command: "invite to game", data: { target: resolvePlayerNameCase(name) } });
                    }, i * 200);
                });
            }
        },
    },
    {
        aliases: ["spectate", "spec"],
        description: "Change to spectator.",
        usage: ["/spec"],
        run(context) {
            if (!lobby.inLobby && !quiz.inQuiz) return;
            if (context.args.length) {
                const name = resolveCommandRoomTarget(context);
                if (name !== undefined) lobby.changeToSpectator(name);
                return;
            }
            if (quiz.inQuiz) {
                if (!quiz.isSpectator) toggleTemporaryCommandSwitch(context, "spectator");
                return;
            }
            lobby.changeToSpectator(selfName);
        },
    },
    {
        aliases: ["join"],
        hotkey: { action: "joinSpectate", title: "Join / Spectate", command: () => (lobby.inLobby ? lobby.isSpectator : quiz.isSpectator) ? "join" : "spectate" },
        description: "Change from spectator to player in lobby.",
        usage: ["/join", "/join [room ID] [optional password]"],
        run(context) {
            if (context.args.length) {
                if (inRoom()) return;
                const room = parseCommandRoom(context);
                if (!room) {
                    return context.reply("Use a positive room ID followed by an optional password.", true);
                }
                return roomBrowser.fireSpectateGame(room.id, room.password);
            }
            if (lobby.inLobby) return socket.sendCommand({ type: "lobby", command: "change to player" });
            if (!quiz.inQuiz || !quiz.isSpectator) return;
            if (quiz.lateJoinButton.$body.is(":visible")) {
                socket.sendCommand({ type: "quiz", command: "late join game" });
            }
            else toggleTemporaryCommandSwitch(context, "player");
        },
    },
    {
        aliases: ["queue"],
        description: "Join/leave queue.",
        usage: ["/queue"],
        run(context) {
            gameChat.joinLeaveQueue();
        },
    },
    {
        aliases: ["host"],
        description: "Promote player to host.",
        usage: ["/host [name]"],
        run(context) {
            const name = resolveCommandRoomTarget(context, { dm: true });
            if (name !== undefined) promoteCommandHost(name);
        },
    },
    {
        aliases: ["kick"],
        description: "Kick player.",
        usage: ["/kick [name]"],
        run(context) {
            const name = resolveCommandRoomTarget(context);
            if (name === undefined) return;
            if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
                socket.sendCommand({ type: "lobby", command: "kick player", data: { playerName: name } });
            }
            else if (nexus.inCoopLobby || nexus.inNexusGame) {
                socket.sendCommand({ type: "nexus", command: "nexus kick player", data: { name } });
            }
        },
    },
    {
        aliases: ["lobby", "lobbyvote", "returntolobby", "lb"],
        hotkey: { action: "lobby", title: "Return To Lobby" },
        description: "Start return to lobby vote.",
        usage: ["/lobby"],
        run(context) {
            if (!quiz.inQuiz || !quiz.isHost) return;
            socket.sendCommand({ type: "quiz", command: "start return lobby vote" });
        },
    },
    {
        aliases: ["volume", "vol", "v"],
        hotkey: { action: "mute", title: "Toggle Mute", args: () => [volumeController.muted ? "unmute" : "mute"] },
        description: "Change volume.",
        usage: ["/volume [0-100]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length > 1) return reply("Use one volume from 0–100, mute, or unmute.", true);
            if (args.length === 0) {
                reply(commandVolumeText());
            }
            else if (["m", "mute"].includes(argsLower[0])) {
                volumeController.setMuted(true);
                volumeController.adjustVolume();
            }
            else if (["u", "unmute"].includes(argsLower[0])) {
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }
            else {
                const option = parseCommandNumber(argsLower[0], 0, 100) / 100;
                if (Number.isNaN(option)) return reply("Volume must be a number from 0–100.", true);
                volumeController.volume = option;
                volumeController.setMuted(false);
                volumeController.adjustVolume();
            }
        },
    },
    {
        aliases: ["quality", "q"],
        description: "Change video quality to mp3, 480, 720.",
        usage: ["/quality [text]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (!args.length) return reply(qualityController.targetResolution);
            if (!Object.hasOwn(qualityAliases, argsLower[0])) return;
            const resolution = qualityAliases[argsLower[0]];
            qualityController.newResolution(resolution);
            qualityController.resetSelected();
            qualityController[`_$${resolution}`].addClass("selected");
        },
    },
    {
        aliases: ["clear"],
        description: "Clear chat.",
        usage: ["/clear"],
        run(context) {
            const { type, target } = context;
            if (type === "chat" || type === "teamchat") {
                setTimeout(() => { $("#gcMessageContainer li").remove() }, 1);
            }
            else if (type === "nexus") {
                setTimeout(() => { $("#nexusCoopMainContainer .nexusCoopChatMessage").remove() }, 1);
            }
            else if (type === "dm") {
                setTimeout(() => { $(`#chatBox-${target} li`).remove() }, 1);
            }
        },
    },
    {
        aliases: ["cooppaste", "coop", "cp"],
        description: "Toggle automatic answer copying in Nexus co-op.",
        run(context) {
            const { reply } = context;
            coopPaste = !coopPaste;
            saveSettings();
            reply(`co-op auto answer copy/paste ${coopPaste ? "enabled" : "disabled"}`, true);
        },
    },
    {
        aliases: ["dropdown", "dd"],
        hotkey: { action: "dropdown", title: "Toggle Dropdown" },
        description: "Show/hide anime dropdown during quiz.",
        usage: ["/dropdown"],
        controlName: "dropdown",
        control: commandControls.dropdown,
        run(context) {
            applyCommandControl("dropdown", !dropdown, context, () => `dropdown ${dropdown ? "enabled" : "disabled"}`);
        },
    },
    {
        aliases: ["dropdownspectate", "dropdownspec", "dds"],
        description: "Enable dropdown while spectating.",
        usage: ["/dropdownspec"],
        run(context) {
            const { reply } = context;
            dropdownInSpec = !dropdownInSpec;
            if (dropdownInSpec) quiz.answerInput.typingInput.$input.removeAttr("disabled");
            saveSettings();
            reply(`dropdown while spectating ${dropdownInSpec ? "enabled" : "disabled"}`, true);
            $("#mcDropdownInSpecCheckbox").prop("checked", dropdownInSpec);
        },
    },
    {
        aliases: ["password", "pw"],
        description: "Reveal private room password.",
        usage: ["/password"],
        run(context) {
            const { reply } = context;
            reply(`password: ${hostModal.$passwordInput.val()}`);
        },
    },
    {
        aliases: ["roomid", "lobbyid"],
        description: "Show the current room ID.",
        async run(context) {
            const { reply } = context;
            if (lobby.inLobby) reply(lobby.gameId);
            else if (quiz.inQuiz || battleRoyal.inView) reply((await requestOwnGameInvite()).gameId);
        },
    },
    {
        aliases: ["quizid"],
        description: "Show the current quiz ID.",
        run(context) {
            const { reply } = context;
            reply(String(quiz.quizDescription?.quizId));
        },
    },
    {
        aliases: ["theme"],
        description: "Show the current room theme.",
        run(context) {
            const { args, reply } = context;
            if (args.length === 0) {
                const $active = $(".quizOfTheDayScheduleDay.active");
                if ($active.length) {
                    const theme = $active.find(".quizOfTheDayScheduleDayType").text().trim();
                    const description = $active.find(".quizOfTheDayScheduleDayDescription").text().trim();
                    reply(description ? `${theme} - ${description}` : theme);
                }
            }
        },
    },
    {
        aliases: ["teamcode", "tc"],
        description: "Show the current team code.",
        run(context) {
            const { reply } = context;
            if (lobby.inLobby) {
                reply($("#lnTeamCode").text());
            }
            else if (quiz.inQuiz) {
                reply($("#qpTeamCode").text());
            }
        },
    },
    {
        aliases: ["dm", "pm"],
        description: "Direct message a player.",
        usage: ["/dm [name] [text]"],
        run(context) {
            const { args, argsLower } = context;
            if (args.length === 0) {
                socialTab.startChat(selfName);
            }
            else if (args.length === 1) {
                const name = resolvePlayerNameCase(argsLower[0]);
                socialTab.startChat(name);
            }
            else {
                const name = resolvePlayerNameCase(argsLower[0]);
                const text = context.argumentTail(1);
                socialTab.startChat(name);
                socket.sendCommand({ type: "social", command: "chat message", data: { target: name, message: text } });
            }
        },
    },
    {
        aliases: ["status"],
        description: "Show or change your social status.",
        run(context) {
            const { args, argsText, reply } = context;
            if (!args.length) return reply(commandStatusText());
            const status = parseSocialStatus(argsText);
            if (status) socialTab.socialStatus.changeSocialStatus(socialTab.socialStatus.STATUS_IDS[status]);
            else reply("Options: online, away, do not disturb, offline", true);
        },
    },
    {
        aliases: ["profile", "prof"],
        description: "Show profile window of any player.",
        usage: ["/profile [name]"],
        run(context) {
            const { args } = context;
            if (args[0]) {
                playerProfileController.loadProfile(args[0], $("#gameChatContainer"), {}, () => { }, false, false);
            }
        },
    },
    {
        aliases: ["friend"],
        description: "Send a friend request.",
        run(context) {
            const name = resolveCommandTarget(context, { dm: true });
            if (name !== undefined) socialTab.sendFriendRequest(name);
        },
    },
    {
        aliases: ["unfriend"],
        description: "Remove a friend.",
        run(context) {
            const name = resolveCommandTarget(context, { dm: true });
            if (name === undefined) return;
            socket.sendCommand({ type: "social", command: "remove friend", data: { target: name } });
            socialTab.removeFriend(name);
        },
    },
    {
        aliases: ["block"],
        description: "Block a player.",
        run(context) {
            const name = resolveCommandTarget(context);
            if (name !== undefined) socialTab.blockPlayer(name);
        },
    },
    {
        aliases: ["unblock"],
        description: "Unblock a player.",
        run(context) {
            const name = resolveCommandTarget(context);
            if (name !== undefined) socialTab.unblockPlayer(name);
        },
    },
    {
        aliases: ["blocked"],
        description: "List blocked players.",
        run(context) {
            const { reply } = context;
            reply(socialTab.blockedPlayers.length ? socialTab.blockedPlayers.join(", ") : "(none)");
        },
    },
    {
        aliases: ["rules", "gamemode", "gamemodes"],
        description: "Show list of gamemodes and rules.",
        usage: ["/rules"],
        run(context) {
            replyLookup(context, rules);
        },
    },
    {
        aliases: ["script", "scripts"],
        description: "Find an install link for a userscript.",
        run(context) {
            replyLookup(context, scripts);
        },
    },
    {
        aliases: ["info"],
        description: "Show list of external utilities.",
        usage: ["/info"],
        run(context) {
            replyLookup(context, info);
        },
    },
    {
        aliases: ["start"],
        hotkey: { action: "start", title: "Start Quiz" },
        description: "Start the game or a Nexus dungeon.",
        run(context) {
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
        },
    },
    {
        aliases: ["leave"],
        hotkey: { action: "leave", title: "Leave Quiz" },
        description: "Leave room.",
        usage: ["/leave"],
        run(context) {
            if (!inRoom()) return;
            const view = isQuizOfTheDay() ? "main" : "roomBrowser";
            setTimeout(() => { viewChanger.changeView(view) }, 1);
        },
    },
    {
        aliases: ["rejoin"],
        hotkey: { action: "rejoin", title: "Rejoin Quiz" },
        description: "Leave and rejoin the room you're in after # of seconds.",
        usage: ["/rejoin [seconds]"],
        run(context) {
            if (context.args.length > 1) return context.reply("Use one nonnegative rejoin delay.", true);
            const { args, argsLower, reply } = context;
            if (!lobby.inLobby && !quiz.inQuiz && !battleRoyal.inView && !rejoinOperation) return;
            if (args.length === 0) {
                return rejoinRoom(100);
            }
            else if (args.length === 1) {
                const time = parseCommandDelay(argsLower[0]);
                if (Number.isNaN(time)) return reply("invalid time", true);
                return rejoinRoom(time);
            }
        },
    },
    {
        aliases: ["logout", "logoff"],
        description: "Log out.",
        usage: ["/logout"],
        run(context) {
            cancelRejoin();
            cancelAutoStart();
            unsafeWindow.onbeforeunload = null;
            setTimeout(() => { options.logout() }, 1);
        },
    },
    {
        aliases: ["relog"],
        hotkey: { action: "relog", title: "Relog" },
        description: "Log out, log in, and auto join the room you were in.",
        usage: ["/relog"],
        run(context) {
            return relog();
        },
    },
    {
        aliases: ["alien"],
        description: "Set # of aliens for alien gamemode.",
        usage: ["/alien [number]"],
        run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive alien count.", true);
            const { argsLower, reply } = context;
            if (!inRoom()) return;
            const alienCount = parseCommandInteger(argsLower[0]);
            if (Number.isNaN(alienCount) || alienCount < 1) return reply("invalid number", true);
            const players = getPlayerList();
            if (players.length < alienCount) return reply("not enough people");
            const aliens = shuffleArray(players).slice(0, alienCount);
            aliens.forEach((alien, index) => {
                setTimeout(() => {
                    socket.sendCommand({
                        type: "social",
                        command: "chat message",
                        data: { target: alien, message: `Aliens: ${aliens.join(", ")} (turn on your list and disable share entries)` }
                    });
                }, 500 * index);
            });
            setTimeout(() => { reply(`${alienCount} alien${alienCount === 1 ? "" : "s"} chosen`) }, 500 * alienCount);
        },
    },
    {
        aliases: ["background", "bg", "wallpaper"],
        description: "Change the background.",
        usage: ["/background [url]"],
        run(context) {
            const { args, argsLower, argsText, reply } = context;
            if (args.length === 0) {
                backgroundURL = "";
                applyStyles();
                saveSettings();
            }
            else if (argsLower[0] === "link" || argsLower[0] === "url") {
                if (backgroundURL) reply(backgroundURL);
            }
            else if (argsLower[0].startsWith("http")) {
                backgroundURL = argsText;
                applyStyles();
                saveSettings();
            }
        },
    },
    {
        aliases: ["nexus"],
        description: "Set the Nexus city background to automatic, daytime, or nighttime.",
        run(context) {
            const { args, argsLower } = context;
            if (args.length === 1) {
                if (argsLower[0] === "auto") {
                    nexus.cityController.NIGHT_START_HOUR = 18;
                    nexus.cityController.NIGHT_END_HOUR = 6;
                }
                else if (argsLower[0] === "day") {
                    nexus.cityController.NIGHT_START_HOUR = 24;
                    nexus.cityController.NIGHT_END_HOUR = 0;
                }
                else if (argsLower[0] === "night") {
                    nexus.cityController.NIGHT_START_HOUR = 0;
                    nexus.cityController.NIGHT_END_HOUR = 0;
                }
            }
        },
    },
    {
        aliases: ["detect"],
        description: "Configure room browser alerts for specific players and invisible friends.",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                reply(`invisible: ${playerDetection.invisible}`, true);
                reply(`players: ${playerDetection.players.join(", ")}`, true);
            }
            else if (args.length === 1) {
                if (argsLower[0] === "disable") {
                    playerDetection = { invisible: false, players: [] };
                    saveSettings();
                    reply("detection system disabled", true);
                }
                else if (argsLower[0] === "invisible") {
                    playerDetection.invisible = true;
                    saveSettings();
                    reply("now detecting invisible friends in the room browser", true);
                }
                else {
                    const name = argsLower[0];
                    if (playerDetection.players.includes(name)) {
                        playerDetection.players = playerDetection.players.filter((item) => item !== name);
                        reply(`${name} removed from detection system`, true);
                    }
                    else {
                        playerDetection.players.push(name);
                        reply(`now detecting ${name} in the room browser`, true);
                    }
                    saveSettings();
                }
            }
        },
    },
    {
        aliases: ["onlinefriends"],
        description: "List online friends.",
        async run(context) {
            const status = await requestCommandFriendStatus();
            context.reply(status.online.join(", "));
        },
    },
    {
        aliases: ["online"],
        description: "Show the online status of a player.",
        async run(context) {
            const { args, argsLower, reply } = context;
            if (args.length !== 1) return;
            const users = await requestOnlineUsers();
            reply(users.some(name => name.toLowerCase() === argsLower[0]) ? "online" : "offline");
        },
    },
    {
        aliases: ["invisible"],
        description: "Show invisible friends.",
        usage: ["/invisible"],
        async run(context) {
            const status = await requestCommandFriendStatus();
            context.reply(status.invisible.length ? status.invisible.join(", ") : "no invisible friends detected");
        },
    },
    {
        aliases: ["count"],
        description: "Count friends, scripts, currencies, avatars, emotes, languages, or anime list entries.",
        usage: countUsage,
        async run(context) {
            const { args, argsLower, optionsText, reply } = context;
            const first = countOptionMap.get(argsLower[0]);
            const operation = first?.argumentCount ? first : countOptionMap.get(optionsText.replace(/\s+/g, ""));
            if (!operation) return reply(countHelp, true);
            if (
                operation.argumentCount
                && args.length !== operation.argumentCount + 1
            ) {
                return reply(operation.argumentError, true);
            }
            reply(await operation.read(args[1]));
        },
    },
    {
        aliases: ["fil", "fiq", "fig", "fir", "friendsinlobby", "friendsinquiz", "friendsingame", "friendsinroom"],
        description: "List friends in a lobby, quiz, game, or room.",
        run(context) {
            const { reply } = context;
            if (lobby.inLobby) {
                const list = Object.values(lobby.players).map(p => p._name).filter(p => socialTab.isFriend(p));
                reply(list.length ? list.join(", ") : "(none)");
            }
            else if (quiz.inQuiz) {
                const list = Object.values(quiz.players).map(p => p._name).filter(p => socialTab.isFriend(p));
                reply(list.length ? list.join(", ") : "(none)");
            }
        },
    },
    {
        aliases: ["startvote"],
        description: "Start a vote with a list of options (separate with commas).",
        usage: ["/startvote [list]"],
        run(context) {
            const { args, argsText, type, reply } = context;
            if (type !== "chat" || args.length === 0) return;
            const list = argsText.split(",").map((x) => x.trim()).filter(Boolean);
            if (list.length >= 2) {
                reply("Voting started, to vote type /vote #");
                reply(`to stop vote type ${commandPrefix}stopvote`, true);
                startCommandVote(list, type);
                Object.entries(voteOptions).forEach(([id, label]) => reply(`${id}: ${label}`));
            }
            else {
                reply("need at least 2 options", true);
            }
        },
    },
    {
        aliases: ["stopvote", "endvote"],
        description: "Stop the vote and print results.",
        usage: ["/stopvote"],
        run(context) {
            const { reply } = context;
            if (Object.keys(voteOptions).length === 0) return;
            if (Object.keys(votes).length) {
                const results = {};
                Object.keys(voteOptions).forEach((x) => { results[x] = 0 });
                Object.values(votes).forEach((x) => { results[x] += 1 });
                const max = Math.max(...Object.values(results));
                const mostVotes = Object.keys(voteOptions).filter((x) => results[x] === max).map((x) => voteOptions[x]);
                reply(`Most votes: ${mostVotes.join(", ")} (${max} vote${max === 1 ? "" : "s"})`);
            }
            else {
                reply("no votes");
            }
            resetCommandVote();
        },
    },
    {
        aliases: ["alert", "alerts"],
        description: "Toggle alerts.",
        usage: ["/alerts", "/alerts [on|off]"],
        run(context) {
            const { args, argsLower, reply, local } = context;
            if (args.length === 0) {
                const rows = Object.entries(alerts).map(([action, value]) => `<tr><td>${action}</td><td class="mcAlertSummaryBool">${value.popout ? "✅" : "-"}</td><td class="mcAlertSummaryBool">${value.chat ? "✅" : "-"}</td><td class="mcAlertSummaryBool">${value.console ? "✅" : "-"}</td></tr>`).join("");
                const table = `<table class="mcAlertSummaryTable"><thead><tr><th>Action</th><th>Popout</th><th>Chat</th><th>Console</th></tr></thead><tbody>${rows}</tbody></table>`;
                local("Mega Commands Alerts:", table);
            }
            else if (["on", "off"].includes(argsLower[0])) {
                const enabled = argsLower[0] === "on";
                for (const value of Object.values(alerts)) {
                    for (const delivery of Object.keys(value)) value[delivery] = enabled;
                }
                saveSettings();
                reply(`all alerts ${enabled ? "enabled" : "disabled"}`, true);
                updateAlertCheckboxes();
            }
        },
    },
    {
        aliases: ["printloot"],
        description: "Toggle printing Nexus loot in chat.",
        run(context) {
            const { reply } = context;
            printLoot = !printLoot;
            saveSettings();
            reply(`print loot ${printLoot ? "enabled" : "disabled"}`, true);
            $("#mcPrintLootCheckbox").prop("checked", printLoot);
        },
    },
    {
        aliases: ["selfdm"],
        description: "Toggle opening your own DM on login.",
        run(context) {
            const { reply } = context;
            selfDM = !selfDM;
            saveSettings();
            reply(`open self dm on log in: ${selfDM ? "enabled" : "disabled"}`, true);
            $("#mcSelfDMCheckbox").prop("checked", selfDM);
        },
    },
    {
        aliases: ["profilebuttons", "enableallprofilebuttons"],
        description: "Toggle all player profile buttons.",
        run(context) {
            const { reply } = context;
            enableAllProfileButtons = !enableAllProfileButtons;
            saveSettings();
            reply(`profile buttons ${enableAllProfileButtons ? "are now clickable" : "have default behavior"}`, true);
            $("#mcProfileButtonsCheckbox").prop("checked", enableAllProfileButtons);
        },
    },
    {
        aliases: ["continuesample"],
        description: "Continue playing song sample point during replay phase",
        usage: ["/continuesample"],
        controlName: "continueSample",
        control: commandControls.continueSample,
        run(context) {
            applyCommandControl("continueSample", !continueSample, context);
        },
    },
    {
        aliases: ["loopvideo"],
        description: "Loop the current song indefinitely during quiz.",
        usage: ["/loopvideo"],
        controlName: "loopVideo",
        control: commandControls.loopVideo,
        run(context) {
            applyCommandControl("loopVideo", !loopVideo, context);
        },
    },
    {
        aliases: ["video"],
        description: "Control local video playback, speed, looping, and show video information.",
        usage: videoUsage,
        run(context) {
            if (!context.args.length) return context.reply(videoHelp, true);
            const operation = videoOptionMap.get(context.argsLower[0]);
            if (!operation) return;
            const player = operation.player || operation.read ? quizVideoController.getCurrentPlayer() : undefined;
            if (operation.read) {
                if (player) context.reply(operation.read(player));
            }
            else return operation.run(context, player);
        },
    },
    {
        aliases: ["hideplayers", "hp"],
        description: "Hide or show lobby and quiz players locally.",
        run(context) {
            const { reply } = context;
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
            reply(`all players are now ${hidePlayers ? "hidden" : "shown"}`, true);
        },
    },
    {
        aliases: ["localstorage", "ls"],
        description: "Inspect, set, remove, or download local storage data.",
        run(context) {
            const { args, argsLower, reply, local } = context;
            if (args.length === 0) {
                if (gameChat.open) {
                    setTimeout(() => {
                        local(`localStorage: ${Object.keys(localStorage).length} items`, Object.keys(localStorage).join("<br>"));
                    }, 1);
                }
            }
            else if (args.length === 1) {
                if (["import", "upload", "load"].includes(argsLower[0])) {
                    $("#mcLocalStorageImportFile").click();
                }
                else if (["export", "download", "save"].includes(argsLower[0])) {
                    exportLocalStorage();
                }
                else if (["clear", "delete", "remove"].includes(argsLower[0])) {
                    localStorage.clear();
                    reply("all local storage cleared", true);
                }
            }
        },
    },
    {
        aliases: ["persist"],
        description: "Configure which command settings persist between sessions.",
        usage: ["/persist", "/persist [setting]", "/persist [setting] [true|false]"],
        run(context) {
            const { args, argsLower, reply, local } = context;
            if (!args.length) {
                if (gameChat.open) {
                    setTimeout(() => {
                        const entries = Object.entries(commandPersist);
                        const text = entries.map(([key, value]) => `${key}: ${value}`).join("<br>");
                        local(`command persist: ${entries.length} items`, text);
                    }, 1);
                }
                return;
            }
            if (args.length > 2) return;
            const key = persistSettingNames.get(argsLower[0]);
            if (key === undefined) return;
            if (args.length === 1) return reply(String(commandPersist[key]));
            const value = commandAlias(persistBooleanAliases, argsLower[1]);
            if (value === undefined) return reply("Use true/false, on/off, yes/no, or 1/0.", true);
            commandPersist[key] = value;
            reply(`${key} persist set to ${value}`);
            saveSettings();
        },
    },
    {
        aliases: ["commands"],
        description: "Turn this script on or off.",
        usage: ["/commands [on|off]"],
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                reply("Options: on, off, help, link, version, clear, auto", true);
            }
            else if (argsLower[0] === "on") {
                commands = true;
                reply("Mega Commands enabled", true);
            }
            else if (argsLower[0] === "off") {
                commands = false;
                reply("Mega Commands disabled", true);
            }
            else if (argsLower[0] === "link") {
                reply("https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js");
            }
            else if (argsLower[0] === "version") {
                reply(GM_info.script.version);
            }
            else if (argsLower[0] === "clear") {
                localStorage.removeItem("megaCommands");
                reply("mega commands local storage cleared", true);
            }
            else if (argsLower[0] === "auto") {
                getEnabledAutomationSummaries().forEach((item) => reply(item, true));
            }
            else if (argsLower[0] === "prefix") {
                if (argsLower[1] && argsLower[1].length <= 2) {
                    commandPrefix = argsLower[1];
                    saveSettings();
                    reply(`Command prefix set to ${commandPrefix}`, true);
                }
            }
        },
    },
    {
        aliases: ["version"],
        description: "Check the version of this script.",
        usage: ["/version"],
        run(context) {
            const { args, optionsText, reply } = context;
            if (args.length === 0) {
                reply("Mega Commands - " + GM_info.script.version, true);
            }
            else {
                reply(getScriptVersion(optionsText));
            }
        },
    },
    {
        aliases: ["remove"],
        description: "Hide popovers.",
        run(context) {
            const { args, argsLower } = context;
            if (args.length === 1) {
                if (argsLower[0].startsWith("pop")) {
                    $(".popover").hide();
                }
            }
        },
    },
    {
        aliases: ["color", "colour"],
        description: "Show or change chat name colors.",
        run(context) {
            const { argsLower, reply } = context;
            if (!Object.hasOwn(chatColorKeys, argsLower[0])) return;
            const key = chatColorKeys[argsLower[0]];
            const data = JSON.parse(localStorage.getItem("highlightFriendsSettings"));
            if (data) reply(data[key]);
        },
    },
    {
        aliases: ["genreid"],
        description: "Look up a genre name by ID.",
        run(context) {
            const matches = resolveCommandLookupList(context, idTranslator.genreNames);
            if (matches) context.reply(matches.map(result => `${result.name}: ${result.id}`).join(", "));
        },
    },
    {
        aliases: ["tagid"],
        description: "Look up a tag name by ID.",
        run(context) {
            const matches = resolveCommandLookupList(context, idTranslator.tagNames);
            if (matches) context.reply(matches.map(result => `${result.name}: ${result.id}`).join(", "));
        },
    },
    {
        aliases: ["artistid"],
        description: "Look up a song artist by ID.",
        run(context) {
            return replyCommandArtistHover(context, "artist");
        },
    },
    {
        aliases: ["groupid"],
        description: "Look up a song group by ID.",
        run(context) {
            return replyCommandArtistHover(context, "group");
        },
    },
    {
        aliases: ["animeinfo"],
        description: "Log extended anime information for an ANN anime ID to the console.",
        async run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive ANN anime ID.", true);
            const { args } = context;
            const id = parseCommandInteger(args[0], 1);
            if (Number.isNaN(id)) return context.reply("invalid number", true);
            console.log(await requestCommand("get anime extended info", {
                type: "library", command: "get anime extended info", data: { annId: id },
            }));
        },
    },
    {
        aliases: ["songinfo", "annsongid"],
        description: "Log extended song information for an ANN song ID to the console.",
        async run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive ANN song ID.", true);
            const { args } = context;
            const id = parseCommandInteger(args[0], 1);
            if (Number.isNaN(id)) return context.reply("invalid number", true);
            console.log(await requestCommand("get song extended info", {
                type: "library", command: "get song extended info", data: { annSongId: id, includeFileNames: true },
            }));
        },
    },
    {
        aliases: ["list", "animelist"],
        description: "Change your AniList, MyAnimeList, Kitsu, or AnimeOshi list and optional included statuses.",
        usage: animeListUsage,
        async run(context) {
            const { args, argsLower, reply } = context;
            if (!args.length) return reply(animeListHelp, true);
            const action = commandAlias(animeListActionAliases, argsLower[0]);
            if (action !== undefined) {
                if (args.length !== 1) return reply(animeListHelp, true);
                if (action === "status") {
                    for (const provider of Object.values(animeListProviders)) {
                        const username = $(provider.selector).val();
                        if (username) return reply(`[${provider.label}] ${username} ${getAnimeListStatusFlags()}`);
                    }
                    return reply("[no list]");
                }
                await removeAllLists();
                return reply("all lists cleared", true);
            }
            const update = parseCommandAnimeList(context);
            if (!update) return;
            await updateAnimeList(update.key, update.username, update.states);
            reply(`${animeListProviders[update.key].label} set to ${update.username}`, true);
        },
    },
    {
        aliases: ["animestatuscheckbox", "animestatus", "asc"],
        description: "Show or set the included anime list statuses.",
        run(context) {
            const { args, argsLower, reply } = context;
            if (!args.length) {
                const statuses = [
                    ["W", options.$INCLUDE_WATCHING_CHECKBOX], ["C", options.$INCLUDE_COMPLETED_CHECKBOX],
                    ["H", options.$INCLUDE_ON_HOLD_CHECKBOX], ["D", options.$INCLUDE_DROPPED_CHECKBOX],
                    ["P", options.$INCLUDE_PLANNING_CHECKBOX],
                ];
                reply(statuses.filter(([, checkbox]) => checkbox.prop("checked")).map(([letter]) => letter).join("") || "none");
            }
            else setAnimeListStatuses(argsLower[0]);
        },
    },
    {
        aliases: ["dq", "daily", "dailies", "dailyquest", "dailyquests"],
        description: "Configure settings and auto throw for daily quests.",
        async run(context) {
            const quest = selectCommandDailyQuest(context);
            if (!quest || await quest.apply() === false) return;
            questAutoThrow(context, quest.anime);
        },
    },
    {
        aliases: ["dqg"],
        description: "Find an anime matching daily quest genres.",
        run(context) {
            const { args, optionsText, reply, local } = context;
            if (args.length === 0) {
                reply("Usage: find anime in dqMap by genre", true);
            }
            else {
                const matches = resolveCommandLookupList(context, idTranslator.genreNames);
                if (!matches) return;
                const genreList = matches.map(result => ({ genre: result.name, id: result.id }));
                let foundAnime = [];
                if (genreList.length) {
                    for (const anime of Object.keys(dqMap)) {
                        if (genreList.every((x) => dqMap[anime].genre.includes(x.id))) {
                            foundAnime.push(anime);
                        }
                    }
                    if (foundAnime.length) {
                        local(`Found ${foundAnime.length} anime for ${genreList.map((x) => x.genre).join(", ")}:`, foundAnime.join("<br>"));
                    }
                    else {
                        reply("no anime found for those genres", true);
                    }
                }
            }
        },
    },
    {
        aliases: ["dqa"],
        description: "Configure settings and auto throw for a specific anime.",
        async run(context) {
            const { args, optionsText, reply } = context;
            if (args.length === 0) {
                reply("Usage: change settings to an anime in dqMap", true);
            }
            else {
                const input = optionsText.toLowerCase();
                let foundAnime = [];
                for (const anime of Object.keys(dqMap)) {
                    const lower = anime.toLowerCase();
                    if (lower === input) {
                        foundAnime = [anime];
                        break;
                    }
                    else if (lower.includes(input)) {
                        foundAnime.push(anime);
                    }
                }
                if (foundAnime.length === 1) {
                    const anime = foundAnime[0];
                    if (await matchSettingsToAnime(anime) === false) return;
                    questAutoThrow(context, anime);
                }
                else if (foundAnime.length > 1) {
                    reply("too many results", true);
                }
                else {
                    reply("no anime found for that name", true);
                }
            }
        },
    },
    {
        aliases: ["ds", "sd"],
        description: "Reset to default settings.",
        usage: ["/ds"],
        run(context) {
            const settings = createDefaultGameSettingsPatch();
            return changeGameSettings(settings);
        },
    },
    {
        aliases: ["settings"],
        description: "Reset game settings or match them to an anime using its AniList ID.",
        async run(context) {
            if (context.args.length > 1) {
                return context.reply("Use /settings default or /settings [positive AniList ID].", true);
            }
            const { args, argsLower, reply } = context;
            if (!args.length) {
                reply("Options: /settings default or /settings [positive AniList ID]", true);
                return;
            }
            if (argsLower[0] === "default") {
                const settings = createDefaultGameSettingsPatch();
                return changeGameSettings(settings);
            }

            const animeId = parseCommandInteger(args[0], 1);
            if (Number.isNaN(animeId)) return reply("invalid anilist id", true);
            const room = captureGameSettingsRoom();
            const anime = await getAnimeFromAnilistId(animeId);
            if (!anime) return reply("invalid anilist id", true);
            const genreIdsByName = {};
            for (const [genreId, genreName] of Object.entries(idTranslator.genreNames)) {
                genreIdsByName[genreName] = genreId;
            }
            const seasonIndexes = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };
            return changeGameSettings(settings => {
                settings.songSelection.standardValue = 1;
                settings.songSelection.advancedValue = { random: settings.numberOfSongs, unwatched: 0, watched: 0 };
                settings.songType.advancedValue = { openings: 0, endings: 0, inserts: 0, random: 20 };
                settings.songType.standardValue = { openings: true, endings: true, inserts: true };
                settings.vintage.advancedValueList = [];
                settings.vintage.standardValue.years = [anime.seasonYear, anime.seasonYear];
                settings.vintage.standardValue.seasons = [seasonIndexes[anime.season], seasonIndexes[anime.season]];
                settings.genre = anime.genres.map(genreName => ({ id: genreIdsByName[genreName], state: 1 }));
                //settings.tags = anime.tags.map(tag => ({ id: String(tag.id), state: 1 }));
                return {
                    songSelection: settings.songSelection,
                    songType: settings.songType,
                    vintage: settings.vintage,
                    genre: settings.genre,
                };
            }, room);
        },
    },
    {
        aliases: ["anilist"],
        description: "Look up an AniList anime ID.",
        async run(context) {
            if (context.args.length !== 1) return context.reply("Use one positive AniList ID.", true);
            const { args, reply } = context;
            const id = parseCommandInteger(args[0], 1);
            if (Number.isNaN(id)) return reply("invalid anilist id", true);
            const data = await getAnimeFromAnilistId(id);
            if (!data) return reply("invalid anilist id", true);
            reply(getPreferredAnimeTitle(data.title));
        },
    },
    {
        aliases: ["malclientid", "malapikey"],
        description: "Configure the MyAnimeList API client ID.",
        run(context) {
            const { args, argsText, reply } = context;
            if (args.length === 0) {
                reply(malClientId || "mal client id is not set", true);
            }
            else if (args.length === 1) {
                malClientId = argsText;
                saveSettings();
                reply("mal client id set", true);
            }
        },
    },
    {
        aliases: ["lookup"],
        description: "Find anime names matching an underscore pattern.",
        run(context) {
            const { args, optionsText, reply } = context;
            if (args.length === 0) return;
            if (!animeListLower.length) return reply("missing autocomplete", true);
            const query = optionsText;
            if (!query.includes("_")) return;
            const re = createLookupPattern(query);
            const results = animeListLower.filter((anime) => re.test(anime));
            if (results.length === 0) {
                reply("no results");
            }
            else if (results.length === 1) {
                reply(results[0]);
                console.log(`Query: ${query} | 1 Result\n${results[0]}`);
            }
            else {
                reply(results.length + " results (see console)");
                console.log(`Query: ${query} | ${results.length} Results\n${results.join("\n")}`);
            }
        },
    },
    {
        aliases: ["sourcenode", "sn"],
        description: "Inspect, start, or stop the Web Audio source node.",
        run(context) {
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                reply(`source node ${sourceNode ? "exists" : "does not exist"}`);
            }
            else if (args.length === 1) {
                if (argsLower[0] === "start") {
                    startCommandAudio();
                    if (!sourceNode) reply("no prepared audio for this song", true);
                }
                else if (argsLower[0] === "stop") {
                    stopCommandAudio();
                }
            }
        },
    },
    {
        aliases: ["reverse", "reverseaudio"],
        description: "Reverse audio playback.",
        usage: ["/reverse"],
        run(context) {
            const { reply } = context;
            acReverse = !acReverse;
            reply(`reverse audio ${acReverse ? "enabled" : "disabled"}`, true);
        },
    },
    {
        aliases: ["pitch"],
        description: "Pitch shift audio (disable with no value).",
        usage: ["/pitch [multiplier]"],
        run(context) {
            if (context.args.length > 1) {
                return context.reply("Use one positive pitch multiplier, or no argument to disable.", true);
            }
            const { args, argsLower, reply } = context;
            if (args.length === 0) {
                acPlaybackRate = null;
                reply("pitch shift disabled", true);
            }
            else if (args.length === 1) {
                const option = parseCommandNumber(argsLower[0]);
                if (
                    !Number.isFinite(Math.fround(option))
                    || Math.fround(option) <= 0
                ) {
                    return reply("Use a finite positive pitch multiplier.", true);
                }
                acPlaybackRate = option;
                reply(`pitch shift set to ${option}`, true);
            }
        },
    }
];
const commandRouter = new Map(commandRegistry.flatMap(entry => entry.aliases.map(alias => [alias, entry])));

// === Hotkeys and incoming chat commands ===

// Some shortcuts have no chat command counterpart
const shortcutOnlyActions = [
    {
        action: "mcHelpWindow",
        title: "Open This Window",
        run() {
            $("#mcSettingsModal").modal("toggle");
        },
    },
    {
        action: "songHistoryWindow",
        title: "Open Song History",
        run() {
            songHistoryWindow.trigger();
        },
    },
    {
        action: "settingsWindow",
        title: "Open Settings",
        run() {
            options.$modal.modal("toggle");
        },
    },
    {
        action: "focusDropdown",
        title: "Focus Dropdown",
        run() {
            if (quiz.inQuiz) $("#qpAnswerInput").focus();
        },
    },
    {
        action: "focusChat",
        title: "Focus Chat",
        run() {
            if ($("#gcInput").is(":visible")) $("#gcInput").focus();
            else if ($("#nexusCoopChatInput").is(":visible")) $("#nexusCoopChatInput").focus();
        },
    },
];
const hotkeyRouter = new Map([
    ...commandRegistry.filter(entry => entry.hotkey).map(entry => [entry.hotkey.action, { ...entry.hotkey, entry }]),
    ...shortcutOnlyActions.map(hotkey => [hotkey.action, hotkey]),
]);

// Build parsed arguments and reply helpers for chat, hotkeys, and remote commands
function createCommandContext(messageText, type, target, source = "chat", { prefix = commandPrefix, sender } = {}) {
    const input = messageText.trimStart();
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input);
    const token = match?.[1] || "";
    const command = token.startsWith(prefix) ? token.slice(prefix.length).toLowerCase() : "";
    const argsText = match?.[2] || "";
    const args = argsText.trim() ? argsText.trim().split(/\s+/) : [];
    const argsLower = args.map(value => value.toLowerCase());
    const optionsText = argsLower.join(" ");
    return {
        messageText, command, args, argsLower, argsText, optionsText, type, target, source, sender,
        // Preserve literal bodies such as passwords and direct messages after positional arguments
        argumentTail: (count = 1) => commandArgumentTail(argsText, count),
        // Preserve the original debug command's local context
        content: messageText.toLowerCase(), split: [token.toLowerCase(), ...argsLower],
        reply: (message, system = false) => source === "hotkey"
            ? sendSystemMessage(message)
            : sendMessage(message, type, target, system),
        local: (message, details) => sendSystemMessage(message, details),
    };
}

// Resolve a saved shortcut to its local action or registered command
function executeHotkey(action) {
    const hotkey = hotkeyRouter.get(action);
    if (!hotkey) return;
    if (hotkey.run) return hotkey.run();
    const entry = hotkey.command ? commandRouter.get(hotkey.command()) : hotkey.entry;
    const messageText = [commandPrefix + entry.aliases[0], ...(hotkey.args?.() || [])].join(" ");
    return executeCommand(entry, createCommandContext(messageText, undefined, undefined, "hotkey"));
}

// Bind saved keyboard shortcuts and dispatch recognized actions
function setupHotkeys() {
    document.addEventListener("keydown", event => {
        if (!event.key || event.metaKey) return;
        const key = normalizeCommandHotkeyKey(event.key);
        if (key === undefined) return;
        for (const [action, binding] of Object.entries(hotKeys)) {
            if (!hotkeyRouter.has(action) || !binding?.key) continue;
            if (
                key !== binding.key
                || event.ctrlKey !== binding.ctrl
                || event.altKey !== binding.alt
                || event.shiftKey !== binding.shift
            ) {
                continue;
            }
            event.preventDefault();
            executeHotkey(action);
        }
    });
}

// Parse a personal command from chat, team chat, Nexus, or an outgoing DM
async function parseCommand(messageText, type, target) {
    if (!messageText.trimStart().startsWith(commandPrefix)) return;
    const context = createCommandContext(messageText, type, target);
    if (
        context.command === "commands"
        && context.argsLower.length === 1
        && context.argsLower[0] === "on"
    ) {
        commands = true;
    }
    if (!commands) return;
    const entry = commandRouter.get(context.command);
    if (entry && (!entry.matches || entry.matches(context))) return executeCommand(entry, context);
}

// Actions shared by personal commands and remote handlers
// Toggle ready only when you are a player in an eligible lobby
function toggleCommandReady() {
    if (lobby.inLobby && !lobby.isHost && !lobby.isSpectator && !isQuizOfTheDay()) {
        lobby.fireMainButtonEvent();
    }
}

// Vote to skip only during a quiz and when a vote has not already been sent
function voteCommandSkip() {
    if (quiz.inQuiz && !quiz.skipController._toggled) quiz.skipClicked();
}

// Resolve one explicit username, with DM fallback only for commands that opt into it
function resolveCommandTarget(context, { dm = false } = {}) {
    if (context.args.length === 1) return resolvePlayerNameCase(context.argsLower[0]);
    if (!context.args.length && dm && context.type === "dm") return context.target;
}

// Resolve an unambiguous room name or an opted-in DM target that is already in the room
function resolveCommandRoomTarget(context, { dm = false } = {}) {
    if (context.args.length === 1) {
        const name = resolveRoomPlayerName(context.argsLower[0]);
        if (isInYourRoom(name)) return resolvePlayerNameCase(name);
        return;
    }
    if (
        !context.args.length
        && dm
        && context.type === "dm"
        && isInYourRoom(context.target)
    ) {
        return context.target;
    }
}

// Toggle the single-use lobby switch shared by join and spectate during a quiz
function toggleTemporaryCommandSwitch(context, mode) {
    const enabled = !autoSwitch.temp;
    autoSwitch.mode = enabled ? mode : "";
    autoSwitch.temp = enabled;
    context.reply(enabled ? `auto switching to ${mode} on lobby (single use)` : "auto switch disabled", true);
}

// Send a host transfer through the current lobby or Nexus action
function promoteCommandHost(name) {
    if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
        lobby.promoteHost(name);
    }
    else if (nexus.inCoopLobby || nexus.inNexusLobby || nexus.inNexusGame) {
        socket.sendCommand({ type: "nexus", command: "nexus promote host", data: { name } });
    }
}

// Format the current mute state or volume percentage
function commandVolumeText() {
    return volumeController.muted ? "🔇" : `🔉 ${Math.round(volumeController.volume * 100)}%`;
}

// Return this script's version or look up a named installed script
function commandVersionText(context) {
    return context.args.length ? getScriptVersion(context.optionsText) : GM_info.script.version;
}

// Format the current social status in its full or abbreviated form
function commandStatusText(short = false) {
    return short ? socialStatusMap[socialTab.socialStatus.currentStatus] : socialTab.socialStatus.getSocialStatusInfo();
}

// Describe the configured default, fixed, or random playback speed
function commandSpeedText() {
    if (videoSpeed.length === 0) return "speed: default";
    if (videoSpeed.length === 1) return `speed: ${videoSpeed[0]}x`;
    return `speed: random ${videoSpeed[0]}x - ${videoSpeed[1]}x`;
}

// Send replies in sequence with an optional first delay and spacing
async function replyCommandLines(context, lines, delay = 0, interval = 200) {
    for (const [index, line] of lines.entries()) {
        const wait = index === 0 ? delay : interval;
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        context.reply(line);
    }
}

// Keep each roll's prepared team output together when commands overlap in one destination
function replyCommandRollLines(context, lines, interval) {
    const key = JSON.stringify(["roll replies", context.type, context.target]);
    return queueCommandTask(key, () => replyCommandLines(context, lines, interval, interval));
}

// Send paced room details or explain why the room cannot be found
function replyCommandRoom(context, room) {
    const lines = room ? [
        `${room._private ? "private" : "public"} room ${room.id}: ${room.settings.roomName}`,
        `host: ${room.host}, players: ${room._numberOfPlayers}, spectators: ${room._numberOfSpectators}`,
    ] : [Object.keys(roomBrowser.activeRooms).length ? "not found" : "room list unavailable"];
    return replyCommandLines(context, lines, 100);
}

const incomingDMRegistry = [
    {
        aliases: ["forceready", "fr"],
        description: "Toggle ready in the current lobby.",
        friendOnly: true,
        run(context) {
            toggleCommandReady();
        },
    },
    {
        aliases: ["forceinvite", "fi"],
        description: "Invite the sender to the current room.",
        friendOnly: true,
        run(context) {
            if (inRoom()) {
                socket.sendCommand({ type: "social", command: "invite to game", data: { target: context.sender } });
            }
        },
    },
    {
        aliases: ["forcepassword", "fpw", "fp"],
        description: "Send the current room password.",
        friendOnly: true,
        run(context) {
            if (inRoom()) context.reply(`password: ${hostModal.$passwordInput.val()}`);
        },
    },
    {
        aliases: ["forceteamcode", "ftc"],
        description: "Send the current Themed team code.",
        friendOnly: true,
        run(context) {
            if (lobby.inLobby && lobby.settings.gameMode === "Themed") context.reply($("#lnTeamCode").text());
            else if (quiz.inQuiz && quiz.gameMode === "Themed") context.reply($("#qpTeamCode").text());
        },
    },
    {
        aliases: ["forcehost", "fh"],
        description: "Transfer host to the sender or a named room member.",
        friendOnly: true,
        run(context) {
            const { args, sender } = context;
            if (args.length > 1) return;
            if (lobby.inLobby) {
                if (!lobby.isHost) return;
            }
            else if (!nexus.inCoopLobby || nexusCoopChat.hostName !== selfName) return;
            const members = lobby.inLobby ? getEveryoneInRoom() : Object.keys(nexusCoopChat.playerMap);
            const target = (args[0] || sender).toLowerCase();
            const name = members.find(member => member.toLowerCase() === target);
            if (name) promoteCommandHost(name);
        },
    },
    {
        aliases: ["forceautolist"],
        description: "List enabled automatic functions.",
        friendOnly: true,
        run(context) {
            return replyCommandLines(context, getEnabledAutomationSummaries());
        },
    },
    {
        aliases: ["forceversion", "fver", "fv"],
        description: "Show this script's version or look up another installed script.",
        run(context) {
            context.reply(commandVersionText(context));
        },
    },
    {
        aliases: ["forcecountscripts", "fcs"],
        description: "Count installed scripts.",
        run(context) {
            context.reply($("#installedListContainer h4").length);
        },
    },
    {
        aliases: ["forcestatus", "fs"],
        description: "Show the current social status.",
        run(context) {
            context.reply(commandStatusText(true));
        },
    },
    {
        aliases: ["forcevolume", "forcevol", "fvol"],
        description: "Show the current volume.",
        run(context) {
            context.reply(commandVolumeText());
        },
    },
    {
        aliases: ["whereis"],
        description: "Find a player in the room browser's current room list.",
        run(context) {
            if (context.args.length !== 1) return;
            const room = Object.values(roomBrowser.activeRooms).find(room =>
                room.getPlayersInGame().some(name => name.toLowerCase() === context.argsLower[0]));
            return replyCommandRoom(context, room);
        },
    },
    {
        aliases: ["room"],
        description: "Look up a room in the room browser's current room list.",
        run(context) {
            if (context.args.length !== 1) return;
            const id = context.args[0];
            const room = Object.hasOwn(roomBrowser.activeRooms, id) ? roomBrowser.activeRooms[id] : undefined;
            return replyCommandRoom(context, room);
        },
    },
];
const incomingDMRouter = new Map(incomingDMRegistry.flatMap(entry => entry.aliases.map(alias => [alias, entry])));

// Remote DM commands always use '/', independently of the personal command prefix
function parseIncomingDM(messageText, sender) {
    if (!commands || !messageText.trimStart().startsWith("/")) return;
    const context = createCommandContext(messageText, "dm", sender, "incomingDM", { prefix: "/", sender });
    const entry = incomingDMRouter.get(context.command);
    if (!entry || (entry.friendOnly && !socialTab.isFriend(sender))) return;
    return executeCommand(entry, context);
}

const forceAllRegistry = [
    {
        aliases: ["ver", "version"],
        description: "Show this script's version or look up another installed script.",
        acceptsArguments: true,
        run(context) {
            context.reply(commandVersionText(context));
        },
    },
    {
        aliases: ["countscripts", "count scripts"],
        description: "Count installed scripts.",
        run(context) {
            context.reply($("#installedListContainer h4").length);
        },
    },
    {
        aliases: ["roll"],
        description: "Roll from one to a positive integer, or between two ordered integers.",
        acceptsArguments: true,
        run(context) {
            const bounds = parseRollBounds(context.args);
            if (!bounds) return;
            const result = randomIntInc(...bounds);
            context.reply(context.args.length === 1 ? result : `rolls ${result}`);
        },
    },
    {
        aliases: ["status"],
        description: "Show the current social status.",
        run(context) {
            context.reply(commandStatusText());
        },
    },
    {
        aliases: ["volume"],
        description: "Show the current volume.",
        run(context) {
            context.reply(commandVolumeText());
        },
    },
    {
        aliases: ["hidestatus", "hide status", "hiddenstatus", "hidden status"],
        description: "Show whether player names are hidden.",
        run(context) {
            context.reply(hidePlayers);
        },
    },
    {
        aliases: ["speed"],
        description: "Show the configured playback speed.",
        run(context) {
            context.reply(commandSpeedText());
        },
    },
    {
        aliases: ["pitch"],
        description: "Show the configured pitch shift.",
        run(context) {
            context.reply(`pitch shift: ${acPlaybackRate || "disabled"}`);
        },
    },
    {
        aliases: ["reverse"],
        description: "Show whether audio playback is reversed.",
        run(context) {
            context.reply(`reverse: ${acReverse}`);
        },
    },
    {
        aliases: ["skip"],
        description: "Vote to skip the current song.",
        run(context) {
            voteCommandSkip();
        },
    },
    {
        aliases: ["shareentries", "share entries"],
        description: "Show whether list entries are shared.",
        run(context) {
            context.reply(options.$MAl_SHARE_CHECKBOX.prop("checked"));
        },
    },
    {
        aliases: ["dd", "dropdown"],
        description: "Show whether the dropdown is enabled.",
        run(context) {
            context.reply(`dropdown: ${dropdown ? "enabled" : "disabled"}`);
        },
    },
];
const forceAllRouter = new Map(forceAllRegistry.flatMap(entry => entry.aliases.map(alias => [alias, entry])));

// Dispatch the fixed '/forceall' protocol through its own limited command set
function parseForceAll(messageText, type, sender) {
    if (!commands || (type !== "nexus" && isQuizOfTheDay())) return;
    if (!messageText.trimStart().startsWith("/")) return;
    const request = createCommandContext(messageText, type, undefined, "forceall", { prefix: "/", sender });
    if (request.command !== "forceall") return;
    const context = createCommandContext(request.argsText, type, undefined, "forceall", { prefix: "", sender });
    const exactEntry = forceAllRouter.get(request.optionsText);
    const entry = exactEntry || forceAllRouter.get(context.command);
    if (!entry || (!exactEntry && !entry.acceptsArguments)) return;
    return executeCommand(entry, context);
}

// Normalize case and whitespace so option labels match consistently
function normalizeVoteLabel(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Clear the poll options, ballots, label lookup, and channel
function resetCommandVote() {
    voteOptions = Object.create(null);
    votes = Object.create(null);
    voteLabels.clear();
    voteChannel = null;
}

// Create a poll and mark duplicate labels as requiring a numeric option ID
function startCommandVote(list, type) {
    resetCommandVote();
    voteChannel = type;
    list.forEach((label, index) => {
        const id = String(index + 1);
        voteOptions[id] = label;
        const normalized = normalizeVoteLabel(label);
        // Ambiguous labels require a numeric option ID.
        voteLabels.set(normalized, voteLabels.has(normalized) ? null : id);
    });
}

// One valid vote per sender; invalid or ambiguous replacements keep the previous vote
function parseVote(messageText, sender, type) {
    if (voteChannel === null || type !== voteChannel || (type !== "nexus" && isQuizOfTheDay())) return;
    if (!messageText.trimStart().startsWith("/")) return;
    const context = createCommandContext(messageText, type, undefined, "vote", { prefix: "/", sender });
    if (context.command !== "vote") return;
    const option = normalizeVoteLabel(context.argsText);
    const id = Object.hasOwn(voteOptions, option) ? option : voteLabels.get(option);
    if (id) votes[sender] = id;
}

// Route exact remote tokens before personal commands, using the same policy for every chat event
function routeChatCommand(messageText, sender, type) {
    const context = createCommandContext(messageText, type, undefined, "chat", { prefix: "/", sender });
    if (context.command === "forceall") {
        parseForceAll(messageText, type, sender);
        return true;
    }
    if (context.command === "vote") {
        parseVote(messageText, sender, type);
        return true;
    }
    if (sender === selfName && messageText.trimStart().startsWith(commandPrefix)) {
        parseCommand(messageText, type);
        return true;
    }
    return false;
}

/**
 * Send a message
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
        setTimeout(() => { socket.sendCommand({ type: "social", command: "chat message", data: { target: target, message: content } }) }, 100);
    }
    else if (type === "chat") {
        if (sys) setTimeout(() => { gameChat.systemMessage(content) }, 1);
        else socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: content, teamMessage: false } });
    }
    else if (type === "teamchat") {
        if (sys) setTimeout(() => { gameChat.systemMessage(content) }, 1);
        else socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: content, teamMessage: true } });
    }
    else if (type === "nexus") {
        if (sys) setTimeout(() => { nexusCoopChat.displayServerMessage({ message: content }) }, 1);
        else socket.sendCommand({ type: "nexus", command: "coop chat message", data: { message: content } });
    }
}

// Get the color code that the player's name should be in the highlight friends script
function getPlayerColor(name) {
    const lower = name.toLowerCase();
    if (customColorMap.hasOwnProperty(lower)) return customColorMap[lower];
    if (name === selfName) return selfColor;
    if (socialTab.isFriend(name)) return friendColor;
    if (socialTab.isBlocked(name)) return blockedColor;
    return "";
}

// Load color variables from the highlight friends script
function refreshColors() {
    const hfData = validateLocalStorage("highlightFriendsSettings");
    selfColor = hfData.smColorSelfColor ?? "#80c7ff";
    friendColor = hfData.smColorFriendColor ?? "#80ff80";
    blockedColor = hfData.smColorBlockedColor ?? "#ff8080";
    customColors = hfData.customColors ?? [];
    customColorMap = {};
    for (const item of customColors) {
        for (const player of item.players) {
            customColorMap[player] = item.color;
        }
    }
}

// Set command status buttons to enabled or disabled
function toggleCommandButton($element, enabled) {
    $element.toggleClass("mcActiveButtonEnabled", Boolean(enabled))
        .attr("aria-pressed", String(Boolean(enabled)))
        .text(enabled ? "On" : "Off");
}

// Get auto throw status text
function getAutoThrowStatus() {
    if (!autoThrow.time.length) return "auto throw disabled";

    let action;
    if (autoThrow.text) {
        action = `auto throwing: ${autoThrow.text}`;
    }
    else if (autoThrow.multichoice) {
        action = `auto throwing multichoice item: ${autoThrow.multichoice}`;
    }
    else {
        return "auto throw disabled";
    }

    const seconds = autoThrow.time.map(time => time / 1000);
    if (seconds.length === 2) return `${action} after ${seconds[0]}-${seconds[1]} seconds`;
    if (seconds.length !== 1) return "auto throw disabled";
    const delay = seconds[0];
    if (delay === 0) return action;
    return `${action} after ${delay} second${delay === 1 ? "" : "s"}`;
}

// Get auto mute status text
function getAutoMuteStatus() {
    for (const [mode, action] of [["mute", "muting"], ["unmute", "unmuting"]]) {
        const seconds = autoMute[mode].map(time => time / 1000);
        if (seconds.length === 1) {
            const delay = seconds[0];
            return `auto ${action} after ${delay} second${delay === 1 ? "" : "s"}`;
        }
        if (seconds.length === 2) {
            return `auto ${action} after random # of seconds between ${seconds[0]} - ${seconds[1]}`;
        }
    }
    if (autoMute.toggle.length) {
        const seconds = autoMute.toggle.map(time => time / 1000).join(", ");
        return `auto mute toggle list set to ${seconds}`;
    }
    if (autoMute.randomMute !== null) {
        return `auto mute a random ${autoMute.randomMute / 1000} second interval`;
    }
    if (autoMute.randomUnmute !== null) {
        return `auto unmute a random ${autoMute.randomUnmute / 1000} second interval`;
    }
    return "auto mute system disabled";
}

// Apply a control value, save it, run follow-up checks, and refresh the UI
function applyCommandControl(name, value, context, message) {
    const control = commandControls[name];
    control.set(value);
    commitCommandSettings();
    context.reply(typeof message === "function" ? message() : message ?? control.status(), true);
    control.afterChange?.();
    refreshActiveCommandRows(name, context.source !== "ui");
}

// Read and validate timing input from an active-command control
function readCommandTimes($input, limit = 2, options) {
    const value = $input.val().trim();
    return parseCommandTimes(value || "0", limit, options);
}

// === Command window and Active-tab controls ===

// Build the command window, bind its controls, and apply its styles
function createCommandWindow() {
    $("#gameContainer").append($(commandWindowTemplate()));

    $("#mcDocumentationTab").on("click", () => { switchTab("mcDocumentation"); });
    $("#mcActiveTab").on("click", () => { switchTab("mcActive"); });
    $("#mcHotkeyTab").on("click", () => { switchTab("mcHotkey"); });
    $("#mcAlertsTab").on("click", () => { switchTab("mcAlerts"); });
    $("#mcOrderTab").on("click", () => { switchTab("mcOrder"); });
    $("#mcStorageTab").on("click", () => { createLocalStorageList(); switchTab("mcStorage"); });
    $("#mcInfoTab").on("click", () => { switchTab("mcInfo"); });
    switchTab("mcDocumentation");

    createActiveCommandWindow();

    createHotkeyTable();

    createAlertTable([
        { action: "hiddenPlayers", title: "Hidden Players", id: "mcAlertHiddenPlayers", popout: true, chat: true, console: true },
        { action: "nameChange", title: "Name Change", id: "mcAlertNameChange", popout: true, chat: true, console: true },
        { action: "onlineFriends", title: "Online Friends", id: "mcAlertOnlineFriends", popout: true, chat: true, console: true },
        { action: "offlineFriends", title: "Offline Friends", id: "mcAlertOfflineFriends", popout: true, chat: true, console: true },
        { action: "serverStatus", title: "Server Status", id: "mcAlertServerStatus", popout: true, chat: true, console: true },
        { action: "donation", title: "Donation", id: "mcAlertDonation", popout: false, chat: true, console: true },
        { action: "rankedStarting", title: "Ranked Starting", id: "mcAlertRankedStarting", popout: false, chat: true, console: true },
        { action: "quizStart", title: "Quiz Start", id: "mcAlertQuizStart", popout: false, chat: false, console: true },
        { action: "quizEnd", title: "Quiz End", id: "mcAlertQuizEnd", popout: false, chat: false, console: true },
        { action: "chat", title: "Chat", id: "mcAlertChat", popout: false, chat: false, console: true },
        { action: "dm", title: "DM", id: "mcAlertDM", popout: false, chat: false, console: true },
        { action: "newVersion", title: "New Version", id: "mcAlertNewVersion", popout: true, chat: false, console: true },
    ]);

    bindCommandStorageControls();

    $("#mcCommandPrefixInput").val(commandPrefix).on("change", function () {
        const option = $(this).val().trim();
        if (!validCommandPrefix(option)) {
            $(this).val(commandPrefix);
            sendSystemMessage("Use a command prefix of 1–2 non-whitespace characters.");
            return;
        }
        commandPrefix = option;
        saveSettings();
    });
    $("#mcMalClientIdInput").val(malClientId).on("change", function () {
        malClientId = $(this).val().trim();
        saveSettings();
    });
    $("#mcDropdownInSpecCheckbox").prop("checked", dropdownInSpec).on("click", () => {
        dropdownInSpec = !dropdownInSpec;
        saveSettings();
        sendSystemMessage(`drop down in spec ${dropdownInSpec ? "enabled" : "disabled"}`);
    });
    $("#mcProfileButtonsCheckbox").prop("checked", enableAllProfileButtons).on("click", () => {
        enableAllProfileButtons = !enableAllProfileButtons;
        saveSettings();
        sendSystemMessage(`profile buttons ${enableAllProfileButtons ? "are now clickable" : "have default behavior"}`);
    });
    $("#mcSelfDMCheckbox").prop("checked", selfDM).on("click", () => {
        selfDM = !selfDM;
        saveSettings();
        sendSystemMessage(`open self dm on log in: ${selfDM ? "enabled" : "disabled"}`);
    });

    $("#optionListSettings").before($("<li>", { id: "mcGearMenuCommands", class: "clickAble", text: "Commands" }).on("click", () => {
        $("#mcSettingsModal").modal("show");
    }));
    setupReorderWindow();

    refreshColors();
    applyStyles();
}

// Keep the modal markup together while its event bindings remain independently readable
function commandWindowTemplate() {
    return /*html*/`
        <div class="modal fade tab-modal" id="mcSettingsModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document" style="width: 800px">
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
                            <div id="mcStorageTab" class="tab clickAble">
                                <h5>Storage</h5>
                            </div>
                            <div id="mcInfoTab" class="tab clickAble" style="width: 45px; margin-right: -10px; padding-right: 8px; float: right;">
                                <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; max-height: calc(100vh - 150px);">
                        <div id="mcDocumentationContainer" class="tabSection" style="height: 500px; margin-top: 10px;">
                            <pre>${helpText}</pre>
                        </div>
                        <div id="mcActiveContainer" class="tabSection" style="margin: 10px 0;"></div>
                        <div id="mcHotkeyContainer" class="tabSection" style="margin: 10px 0;">
                            <table id="mcHotkeyTable">
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
                        <div id="mcAlertsContainer" class="tabSection" style="margin: 10px 0;">
                            <table id="mcAlertsTable">
                                <thead>
                                    <tr>
                                        <th>Alert</th>
                                        <th>Popout</th>
                                        <th>Chat</th>
                                        <th>Console</th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                        </div>
                        <div id="mcOrderContainer" class="tabSection">
                            <div class="mcOrderEditors">
                                <section class="mcOrderPanel" aria-labelledby="mcOrderQuizBarTitle">
                                    <h4 id="mcOrderQuizBarTitle">Quiz bar</h4>
                                    <div class="mcOrderToolbar">
                                        <div class="mcOrderToggle">
                                            <div class="customCheckbox"><input type="checkbox" id="mcOrderQuizBarCheckbox"><label for="mcOrderQuizBarCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>
                                            <label for="mcOrderQuizBarCheckbox">Use custom order</label>
                                        </div>
                                        <button type="button" id="mcOrderQuizBarRefreshButton" class="mcOrderAction" title="Find new options and reapply the current order">Refresh</button>
                                        <button type="button" id="mcOrderQuizBarResetButton" class="mcOrderAction" title="Clear the saved order and restore the default order">Reset</button>
                                    </div>
                                    <ul id="mcOrderQuizBarList" class="mcOrderList" aria-label="Quiz bar order"></ul>
                                </section>
                                <section class="mcOrderPanel" aria-labelledby="mcOrderGearMenuTitle">
                                    <h4 id="mcOrderGearMenuTitle">Gear menu</h4>
                                    <div class="mcOrderToolbar">
                                        <div class="mcOrderToggle">
                                            <div class="customCheckbox"><input type="checkbox" id="mcOrderGearMenuCheckbox"><label for="mcOrderGearMenuCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>
                                            <label for="mcOrderGearMenuCheckbox">Use custom order</label>
                                        </div>
                                        <button type="button" id="mcOrderGearMenuRefreshButton" class="mcOrderAction" title="Find new menu entries and reapply the current order">Refresh</button>
                                        <button type="button" id="mcOrderGearMenuResetButton" class="mcOrderAction" title="Clear the saved order and restore the default order">Reset</button>
                                    </div>
                                    <ul id="mcOrderGearMenuList" class="mcOrderList" aria-label="Gear menu order"></ul>
                                </section>
                            </div>
                            <p class="mcOrderHelp">Drag the items around to the desired order. Buttons added by other scripts are included automatically.</p>
                        </div>
                        <div id="mcStorageContainer" class="tabSection" style="margin: 10px 0;">
                            <h4 class="text-center">Local Storage</h4>
                            <div style="margin: 10px 0"><button id="mcLocalStorageImportButton" style="color: black; margin-right: 10px;">Import</button><button id="mcLocalStorageExportButton" style="color: black; margin-right: 10px;">Export</button><button id="mcLocalStorageClearButton" style="color: black;">Clear</button></div>
                            <input id="mcLocalStorageImportFile" type="file" accept=".json" aria-hidden="true" tabindex="-1" style="display: none;">
                            <ul id="mcStorageList"></ul>
                        </div>
                        <div id="mcInfoContainer" class="tabSection" style="text-align: center; margin: 20px 0;">
                            <h4>Script Info</h4>
                            <div>Created by: kempanator</div>
                            <div>Version: ${GM_info.script.version}</div>
                            <div><a href="https://github.com/kempanator/amq-scripts/blob/main/amqMegaCommands.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/amqMegaCommands.user.js" target="_blank">Install</a></div>
                            <div style="margin-top: 10px;"><span style="margin-right: 10px;">Command Prefix:</span><input id="mcCommandPrefixInput" type="text" maxlength="2" style="width: 30px; color: black;"></div>
                            <div style="margin-top: 10px;"><span style="margin-right: 10px;">MAL Client ID:</span><input id="mcMalClientIdInput" type="text" style="width: 300px; color: black;"></div>
                            <h4 style="margin-top: 20px;">Other</h4>
                            <div class="customCheckbox"><input type="checkbox" id="mcDropdownInSpecCheckbox"><label for="mcDropdownInSpecCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div><span style="margin: 0 10px 0 3px; vertical-align: 5px;">Dropdown in spectator</span>
                            <div class="customCheckbox"><input type="checkbox" id="mcProfileButtonsCheckbox"><label for="mcProfileButtonsCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div><span style="margin: 0 10px 0 3px; vertical-align: 5px;">All profile buttons</span>
                            <div class="customCheckbox"><input type="checkbox" id="mcSelfDMCheckbox"><label for="mcSelfDMCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div><span style="margin: 0 10px 0 3px; vertical-align: 5px;">Open self DM</span>
                            <div class="customCheckbox"><input type="checkbox" id="mcPrintLootCheckbox"><label for="mcPrintLootCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div><span style="margin: 0 0 0 3px; vertical-align: 5px;">Print loot</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="mcExitButton" class="btn btn-default" data-dismiss="modal">Exit</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Keep storage import, export, deletion, and confirmation behavior in one place
function bindCommandStorageControls() {
    $("#mcLocalStorageImportFile").on("change", async function () {
        const file = this.files?.[0];
        this.value = "";
        if (!file) return;
        try {
            const count = importLocalStorageEntries(JSON.parse(await file.text()));
            createLocalStorageList();
            messageDisplayer.displayMessage(`${count} item${count === 1 ? "" : "s"} loaded into local storage`);
        }
        catch (error) {
            console.error("Local storage import failed.", error);
            messageDisplayer.displayMessage("Upload Error: " + error.message);
        }
    });

    $("#mcLocalStorageImportButton").on("click", () => {
        $("#mcLocalStorageImportFile").click();
    });

    $("#mcLocalStorageExportButton").on("click", () => {
        exportLocalStorage();
    });

    $("#mcLocalStorageClearButton").on("click", () => {
        messageDisplayer.displayOption(
            "Confirm",
            "Clear AMQ local storage for all scripts?",
            "Clear",
            "Cancel",
            () => {
                localStorage.clear();
                messageDisplayer.displayMessage("All local storage cleared");
                createLocalStorageList();
            }
        );
    });

    $("#mcStorageList").on("click", ".toggle", function () {
        $(this).toggleClass("fa-caret-right fa-caret-down").parent().find("pre").toggle();
    }).on("click", ".delete", function () {
        const key = $(this).parent().data("key");
        localStorage.removeItem(key);
        createLocalStorageList();
    });
}

const activeCommandViews = new Map();

// Define the complete Active-tab layout and row order separately from command behavior
function activeCommandWindowTemplate() {
    return /*html*/`
        <div class="mcActiveRow" data-control="autoReady">
            <button id="mcAutoReadyButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoReadyInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Ready</span>
        </div>

        <div class="mcActiveRow" data-control="autoStart">
            <button id="mcAutoStartButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoStartInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Start</span>
            <input id="mcAutoStartDelayInput" type="text" placeholder="time" style="width: 50px;">
            <input id="mcAutoStartRemainingInput" type="text" placeholder="remaining" style="width: 80px;">
        </div>

        <div class="mcActiveRow" data-control="autoPause">
            <button id="mcAutoPauseButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoPauseInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Pause</span>
        </div>

        <div class="mcActiveRow" data-control="autoAcceptInvite">
            <button id="mcAutoAcceptInviteButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoAcceptInviteInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Accept Invite</span>
            <select id="mcAutoAcceptInviteSelect" style="padding: 3px 0;">
                <option>friends</option>
                <option>all</option>
                <option>list</option>
            </select>
            <input id="mcAutoAcceptInviteInput" type="text" placeholder="players" style="width: 250px;">
        </div>

        <div class="mcActiveRow" data-control="autoStatus">
            <button id="mcAutoStatusButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoStatusInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Status</span>
            <select id="mcAutoStatusSelect" style="padding: 3px 0;">
                <option>do not disturb</option>
                <option>away</option>
                <option>offline</option>
            </select>
        </div>

        <div class="mcActiveRow" data-control="autoKey">
            <button id="mcAutoKeyButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoKeyInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Key</span>
        </div>

        <div class="mcActiveRow" data-control="autoThrow">
            <button id="mcAutoThrowButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoThrowInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Throw</span>
            <select id="mcAutoThrowSelect" style="padding: 3px 0;">
                <option>text</option>
                <option>multichoice</option>
            </select>
            <input id="mcAutoThrowTimeInput" type="text" placeholder="time" style="width: 50px;">
            <input id="mcAutoThrowTextInput" type="text" placeholder="text" style="width: 250px;">
        </div>

        <div class="mcActiveRow" data-control="autoCopy">
            <button id="mcAutoCopyButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoCopyInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Copy</span>
            <input id="mcAutoCopyInput" type="text" placeholder="player" style="width: 150px;">
        </div>

        <div class="mcActiveRow" data-control="autoHost">
            <button id="mcAutoHostButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoHostInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Host</span>
            <input id="mcAutoHostInput" type="text" placeholder="player" style="width: 150px;">
        </div>

        <div class="mcActiveRow" data-control="autoVoteSkip">
            <button id="mcAutoVoteSkipButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoVoteSkipInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Vote Skip</span>
            <select id="mcAutoVoteSkipSelect" style="padding: 3px 0;">
                <option>time</option>
                <option>correct</option>
                <option>team valid</option>
            </select>
            <input id="mcAutoVoteSkipTimeInput" type="text" placeholder="time" style="width: 50px;">
        </div>

        <div class="mcActiveRow" data-control="autoVoteLobby">
            <button id="mcAutoVoteLobbyButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoVoteLobbyInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Vote Lobby</span>
        </div>

        <div class="mcActiveRow" data-control="autoMute">
            <button id="mcAutoMuteButton" type="button" class="mcActiveButton"></button>
            <i id="mcAutoMuteInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Auto Mute</span>
            <select id="mcAutoMuteSelect" style="padding: 3px 0;">
                <option>mute</option>
                <option>unmute</option>
                <option>toggle</option>
                <option>random mute</option>
                <option>random unmute</option>
            </select>
            <input id="mcAutoMuteTimeInput" type="text" placeholder="time" style="width: 50px;">
        </div>

        <div class="mcActiveRow" data-control="muteSubmit">
            <button id="mcMuteSubmitButton" type="button" class="mcActiveButton"></button>
            <i id="mcMuteSubmitInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Mute Submit</span>
        </div>

        <div class="mcActiveRow" data-control="muteReplay">
            <button id="mcMuteReplayButton" type="button" class="mcActiveButton"></button>
            <i id="mcMuteReplayInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Mute Replay</span>
        </div>

        <div class="mcActiveRow" data-control="continueSample">
            <button id="mcContinueSampleButton" type="button" class="mcActiveButton"></button>
            <i id="mcContinueSampleInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Continue Sample</span>
        </div>

        <div class="mcActiveRow" data-control="loopVideo">
            <button id="mcLoopVideoButton" type="button" class="mcActiveButton"></button>
            <i id="mcLoopVideoInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Loop Video</span>
        </div>

        <div class="mcActiveRow" data-control="dropdown">
            <button id="mcDropDownButton" type="button" class="mcActiveButton"></button>
            <i id="mcDropDownInfo" class="fa fa-info-circle mcActiveInfo" aria-hidden="true"></i>
            <span class="mcActiveTitle">Drop Down</span>
        </div>
    `;
}

// Cache a row's inputs and bind its UI-only reading, rendering, and select-change behavior
function createActiveCommandAdapter(name, $row) {
    switch (name) {
        case "autoStart":
            return createAutoStartCommandAdapter($row);
        case "autoAcceptInvite":
            return createAutoAcceptInviteCommandAdapter($row);
        case "autoStatus":
            return createAutoStatusCommandAdapter($row);
        case "autoThrow":
            return createAutoThrowCommandAdapter($row);
        case "autoCopy":
            return createPlayerCommandAdapter($row, "#mcAutoCopyInput", () => autoCopy);
        case "autoHost":
            return createPlayerCommandAdapter($row, "#mcAutoHostInput", () => autoHost);
        case "autoVoteSkip":
            return createAutoVoteSkipCommandAdapter($row);
        case "autoMute":
            return createAutoMuteCommandAdapter($row);
        default:
            return {};
    }
}

// Use the same delay and repeat-count validation as the Auto Start command
function createAutoStartCommandAdapter($row) {
    const $delay = $row.find("#mcAutoStartDelayInput");
    const $remaining = $row.find("#mcAutoStartRemainingInput");
    return {
        invalid: "Use a nonnegative delay and a positive whole repeat count, or ∞.",
        read(enabled) {
            if (enabled) return { delay: 0, remaining: 0 };
            return parseAutoStartOptions($delay.val(), $remaining.val(), 1);
        },
        render() {
            $delay.val(autoStart.delay / 1000);
            $remaining.val(autoStart.remaining || "∞");
        },
    };
}

// Keep the selected invite policy and its player-list input in sync
function createAutoAcceptInviteCommandAdapter($row) {
    const $mode = $row.find("#mcAutoAcceptInviteSelect");
    const $players = $row.find("#mcAutoAcceptInviteInput");
    $mode.on("change", () => {
        if ($mode.val() === "list") {
            $players.show();
        }
        else {
            $players.hide();
        }
    });
    return {
        read(enabled) {
            if (enabled) return "";
            const option = $mode.val();
            if (option !== "list") return option;
            const list = $players.val().toLowerCase().split(/[, ]+/).filter(Boolean);
            if (list.length) return list;
        },
        render() {
            if (autoAcceptInvite === "all") {
                $mode.val("all");
                $players.hide();
            }
            else if (autoAcceptInvite === "friends") {
                $mode.val("friends");
                $players.hide();
            }
            else if (Array.isArray(autoAcceptInvite)) {
                $mode.val("list");
                $players.show().val(autoAcceptInvite.join(", "));
            }
            else {
                $players.hide();
            }
        },
    };
}

// Render social status choices using the saved command value
function createAutoStatusCommandAdapter($row) {
    const $status = $row.find("#mcAutoStatusSelect");
    return {
        read(enabled) {
            return enabled ? "" : $status.val();
        },
        render() {
            if (autoStatus === "do not disturb") {
                $status.val("do not disturb");
            }
            else if (autoStatus === "away") {
                $status.val("away");
            }
            else {
                $status.val("offline");
            }
        },
    };
}

// Switch between text and multiple-choice answers without changing their validation
function createAutoThrowCommandAdapter($row) {
    const $mode = $row.find("#mcAutoThrowSelect");
    const $time = $row.find("#mcAutoThrowTimeInput");
    const $answer = $row.find("#mcAutoThrowTextInput");
    $mode.on("change", () => {
        if ($mode.val() === "text") {
            $answer.attr("placeholder", "text");
        }
        else if ($mode.val() === "multichoice") {
            $answer.attr("placeholder", "option (1-4)");
        }
    });
    return {
        invalid: "Use one nonnegative time or an ordered pair, plus text or a choice from 1–4 or random.",
        read(enabled) {
            if (enabled) return { time: [], text: null, multichoice: null };
            const text = $answer.val();
            if (!text) return;
            const time = readCommandTimes($time);
            if (!time) return;
            if ($mode.val() === "text") return { time, text, multichoice: null };
            const multichoice = parseMultichoiceAnswer(text);
            if (multichoice !== undefined) return { time, text: null, multichoice };
        },
        render() {
            $mode.val(autoThrow.multichoice ? "multichoice" : "text");
            $time.val(autoThrow.time.map((x) => x / 1000).join("-"));
            const answer = autoThrow.multichoice || autoThrow.text || "";
            const placeholder = autoThrow.multichoice ? "option (1-4)" : "text";
            $answer.val(answer).attr("placeholder", placeholder);
        },
    };
}

// Show a delay input only when vote skipping is time based
function createAutoVoteSkipCommandAdapter($row) {
    const $mode = $row.find("#mcAutoVoteSkipSelect");
    const $time = $row.find("#mcAutoVoteSkipTimeInput");
    $mode.on("change", () => {
        if ($mode.val() === "time") {
            $time.show();
        }
        else {
            $time.hide();
        }
    });
    return {
        invalid: "Use one nonnegative time or an ordered pair of times.",
        read(enabled) {
            if (enabled) return [];
            const option = $mode.val();
            if (option !== "time") {
                $time.val("");
                return commandAlias(autoSkipAliases, option);
            }
            const times = readCommandTimes($time);
            if (times && (times.length !== 2 || times[0] !== times[1])) return times;
        },
        render() {
            if (autoVoteSkip === "valid") {
                $mode.val("team valid");
                $time.hide();
            }
            else if (autoVoteSkip === "correct") {
                $mode.val("correct");
                $time.hide();
            }
            else if (Array.isArray(autoVoteSkip) && autoVoteSkip.length) {
                $mode.val("time");
                $time.show().val(autoVoteSkip.map((x) => x / 1000).join("-"));
            }
        },
    };
}

// Keep each exclusive mute mode paired with its existing time-input syntax
function createAutoMuteCommandAdapter($row) {
    const $mode = $row.find("#mcAutoMuteSelect");
    const $time = $row.find("#mcAutoMuteTimeInput");
    $mode.on("change", () => { configureAutoMuteTimeInput($time, $mode.val()); });
    return {
        invalid: "Use nonnegative ordered times; toggle needs two distinct times, and random mode needs one positive duration.",
        read(enabled) {
            if (enabled) return parseAutoMuteOptions("mute", "");
            const mode = autoMuteUIOptions[$mode.val()];
            const timeText = $time.val().trim() || "0";
            return parseAutoMuteOptions(mode, timeText);
        },
        render() {
            let mode;
            let timeText;
            if (autoMute.mute.length) {
                mode = "mute";
                timeText = autoMute.mute.map(time => time / 1000).join("-");
            }
            else if (autoMute.unmute.length) {
                mode = "unmute";
                timeText = autoMute.unmute.map(time => time / 1000).join("-");
            }
            else if (autoMute.toggle.length) {
                mode = "toggle";
                timeText = autoMute.toggle.map(time => time / 1000).join(", ");
            }
            else if (autoMute.randomMute !== null) {
                mode = "random mute";
                timeText = autoMute.randomMute / 1000;
            }
            else if (autoMute.randomUnmute !== null) {
                mode = "random unmute";
                timeText = autoMute.randomUnmute / 1000;
            }
            else {
                $time.val("");
                return;
            }
            $mode.val(mode);
            $time.val(timeText);
            configureAutoMuteTimeInput($time, mode);
        },
    };
}

// Keep toggle-list input styling identical after selection changes and saved-state rendering
function configureAutoMuteTimeInput($time, mode) {
    if (mode === "toggle") {
        $time.css("width", "150px").attr("placeholder", "time list");
        return;
    }
    $time.css("width", "50px").attr("placeholder", "time");
}

// Share player-name input behavior while reading the current feature value at render time
function createPlayerCommandAdapter($row, selector, getValue) {
    const $player = $row.find(selector);
    return {
        read(enabled) {
            if (enabled) return "";
            const playerName = $player.val().toLowerCase();
            if (playerName) return playerName;
        },
        render() {
            $player.val(getValue());
        },
    };
}

// Rebuild the layout and its cached adapters, cleaning up popovers owned by the previous rows
function createActiveCommandWindow() {
    for (const view of activeCommandViews.values()) view.$info.popover("destroy");
    activeCommandViews.clear();
    const $container = $("#mcActiveContainer").html(activeCommandWindowTemplate());
    const context = { source: "ui", reply: message => sendSystemMessage(message) };
    for (const row of $container.children(".mcActiveRow")) {
        const $row = $(row);
        const name = $row.attr("data-control");
        const control = commandControls[name];
        const entry = commandRegistry.find(entry => entry.controlName === name);
        const $button = $row.children(".mcActiveButton");
        const $info = $row.children(".mcActiveInfo");
        const title = $row.children(".mcActiveTitle").text();
        const adapter = createActiveCommandAdapter(name, $row);
        activeCommandViews.set(name, { $button, $info, ...adapter });
        $info.popover({ content: control.description || entry.description, trigger: "hover", placement: "bottom", container: "body" });
        $button.on("click", () => {
            const enabled = Boolean(control.enabled());
            const value = adapter.read ? adapter.read(enabled) : !enabled;
            if (value !== undefined) applyCommandControl(name, value, context);
            else context.reply(`Invalid ${title.toLowerCase()} options. ${adapter.invalid || "Check the input values."}`);
        });
    }
    refreshActiveCommandRows();
}

// Refresh cached views after state changes, preserving input drafts for UI-originated updates
function refreshActiveCommandRows(name, renderInputs = true) {
    const names = name ? [name] : activeCommandViews.keys();
    for (const key of names) {
        const view = activeCommandViews.get(key);
        if (!view) continue;
        toggleCommandButton(view.$button, commandControls[key].enabled());
        if (renderInputs) view.render?.();
    }
}

// Use the saved action order and registry titles for the hotkey editor
function createHotkeyTable() {
    const $tbody = $("#mcHotkeyTable tbody").empty();
    for (const action of Object.keys(hotKeys)) {
        const hotkey = hotkeyRouter.get(action);
        if (!hotkey) continue;
        const { title } = hotkey;
        const $input = $("<input>", { type: "text", class: "hk-input", readonly: true, "data-action": action })
            .val(formatHotkeyBinding(hotKeys[action]))
            .on("click", startHotkeyRecording);
        $tbody.append($("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>").append($input)));
    }
}

// Begin hotkey capture on click
function startHotkeyRecording() {
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
            const key = normalizeCommandHotkeyKey(e.key);
            if (key === undefined) return;
            hotKeys[action] = {
                key,
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
        $input.removeClass("recording").val(formatHotkeyBinding(hotKeys[action])).off("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    $input.addClass("recording").val("Press keys…").on("blur", finish);
}

// Input hotKeys[action] and convert the data to a string for the input field
function formatHotkeyBinding(b) {
    if (!b) return "";
    const keys = [];
    if (b.ctrl) keys.push("CTRL");
    if (b.alt) keys.push("ALT");
    if (b.shift) keys.push("SHIFT");
    if (b.key) keys.push(b.key === " " ? "SPACE" : b.key);
    return keys.join(" + ");
}

// Update hotkey rows in mc settings
function updateHotkeyTable() {
    const $table = $("#mcHotkeyTable");
    for (const action of Object.keys(hotKeys)) {
        $table.find(`input[data-action="${action}"]`).val(formatHotkeyBinding(hotKeys[action]));
    }
}

// Create alert element rows in mc settings
function createAlertTable(data) {
    const $tbody = $("#mcAlertsTable tbody");
    for (const { action, title, id, popout, chat, console } of data) {
        const $tr = $("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>", { style: "text-align: center;" }))
            .append($("<td>", { style: "text-align: center;" }))
            .append($("<td>", { style: "text-align: center;" }));
        if (popout) {
            $("<div>", { class: "customCheckbox" })
                .append($("<input>", { id: id + "PopoutCheckbox", type: "checkbox" })
                    .attr({ "data-action": action, "data-delivery": "popout" })
                    .prop("checked", alerts[action].popout)
                    .on("click", () => {
                        alerts[action].popout = !alerts[action].popout;
                        saveSettings();
                    }))
                .append(`<label for="${id}PopoutCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>`)
                .appendTo($tr.find("td:eq(1)"));
        }
        if (chat) {
            $("<div>", { class: "customCheckbox" })
                .append($("<input>", { type: "checkbox", id: id + "ChatCheckbox" })
                    .attr({ "data-action": action, "data-delivery": "chat" })
                    .prop("checked", alerts[action].chat)
                    .on("click", () => {
                        alerts[action].chat = !alerts[action].chat;
                        saveSettings();
                    }))
                .append(`<label for="${id}ChatCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>`)
                .appendTo($tr.find("td:eq(2)"));
        }
        if (console) {
            $("<div>", { class: "customCheckbox" })
                .append($("<input>", { type: "checkbox", id: id + "ConsoleCheckbox" })
                    .attr({ "data-action": action, "data-delivery": "console" })
                    .prop("checked", alerts[action].console)
                    .on("click", () => {
                        alerts[action].console = !alerts[action].console;
                        saveSettings();
                    }))
                .append(`<label for="${id}ConsoleCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label>`)
                .appendTo($tr.find("td:eq(3)"));
        }
        $tbody.append($tr);
    }
}

// Update all alert checkboxes in mc settings
function updateAlertCheckboxes() {
    for (const action of Object.keys(alerts)) {
        for (const delivery of Object.keys(alerts[action])) {
            const checked = alerts[action][delivery];
            $(`#mcAlertsTable input[data-action=${action}][data-delivery=${delivery}]`).prop("checked", checked);
        }
    }
}

// === Quiz-bar and gear-menu ordering ===

const reorderEditors = {
    quizBar: {
        container: "#qpOptionContainer > div",
        listId: "mcOrderQuizBarList",
        checkboxId: "mcOrderQuizBarCheckbox",
        prefix: "mcOrderQuizBar",
        setting: "quizBarList",
        reverse: true,
        defaults: [],
        items: new Map(),
        keys: new WeakMap()
    },
    gearMenu: {
        container:
            "#optionsContainer > ul",
        listId: "mcOrderGearMenuList",
        checkboxId: "mcOrderGearMenuCheckbox",
        prefix: "mcOrderGearMenu",
        setting: "gearMenuList",
        reverse: false, defaults: [],
        items: new Map(),
        keys: new WeakMap()
    },
};
let reorderDrag = null;
let reorderRefreshTimer = null;
let reorderRefreshPending = false;

// Keep the original short gear-menu names without replacing elements or their child controls
function shortenReorderMenuLabels(container) {
    const labels = { "Installed Userscripts": "Userscripts", "Blocked Players": "Blocked", "Change Password": "Password" };
    for (const item of container.children) {
        for (const node of item.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE) continue;
            const text = node.textContent.trim();
            if (Object.hasOwn(labels, text)) node.textContent = node.textContent.replace(text, labels[text]);
        }
    }
}

// Derive a persistent identity from native attributes before falling back to an item's label
function reorderItemIdentity(element, name) {
    if (element.id) return name === "quizBar" ? element.id : `id:${element.id}`;
    for (const attribute of ["data-i18n", "data-target", "href", "onclick"]) {
        const value = element.getAttribute(attribute);
        if (value) return `${attribute}:${value.trim().replace(/\s+/g, " ")}`;
    }
    return `text:${element.textContent.trim().replace(/\s+/g, " ")}`;
}

// Read a script button's Bootstrap popover as plain text without displaying or inserting its content
function reorderPopoverLabel(element) {
    const popover = $(element).data("bs.popover");
    let content = popover ? popover.getContent() : element.getAttribute("data-content");
    if (typeof content === "string") {
        if (popover ? popover.options.html : element.getAttribute("data-html") === "true") {
            const template = document.createElement("template");
            template.innerHTML = content;
            content = template.content.textContent;
        }
    }
    else if (content instanceof Node) content = content.textContent;
    else if (content?.jquery) content = content.text();
    else content = "";
    return content.trim().replace(/\s+/g, " ");
}

// Name built-in quiz controls directly and use other scripts' popover text or their unchanged IDs
function reorderItemLabel(element, name) {
    if (name === "gearMenu") return element.textContent.trim().replace(/\s+/g, " ");
    const labels = { qpVolume: "Volume", qpQuality: "Video quality", qpSettings: "Room settings", qpSongHistory: "Song history" };
    return (Object.hasOwn(labels, element.id) ? labels[element.id] : undefined) || reorderPopoverLabel(element) || element.id || "Quiz option";
}

// Preserve new scripts' native insertion positions while custom ordering is disabled
function mergeReorderDefaults(defaults, current, enabled) {
    const result = [...defaults];
    current.forEach((key, index) => {
        if (result.includes(key)) return;
        const next = enabled ? undefined : current.slice(index + 1).find(candidate => result.includes(candidate));
        const previous = enabled ? undefined : current.slice(0, index).reverse().find(candidate => result.includes(candidate));
        if (next !== undefined) result.splice(result.indexOf(next), 0, key);
        else if (previous !== undefined) result.splice(result.indexOf(previous) + 1, 0, key);
        else result.push(key);
    });
    return result;
}

// Discover current direct children while retaining each item's original session order and identity
function collectReorderItems(name) {
    const editor = reorderEditors[name];
    const container = document.querySelector(editor.container);
    if (name === "gearMenu") shortenReorderMenuLabels(container);
    const elements = [...container.children].filter(element => {
        if (name === "quizBar") return element.classList.contains("qpOption");
        return element.tagName === "LI" && element.textContent.trim();
    });
    if (editor.reverse) elements.reverse();
    const reserved = new Set(elements.map(element => editor.keys.get(element)).filter(Boolean));
    const items = new Map();
    for (const element of elements) {
        let key = editor.keys.get(element);
        if (!key) {
            const base = reorderItemIdentity(element, name);
            key = base;
            for (let suffix = 2; reserved.has(key); suffix++) key = `${base}::${suffix}`;
            editor.keys.set(element, key);
            reserved.add(key);
        }
        const label = reorderItemLabel(element, name);
        const aliases = [element.id, label];
        if (name === "gearMenu") {
            if (element.getAttribute("data-target") === "#installedModal") {
                aliases.push("Installed Userscripts", "Userscripts");
            }
            if (element.getAttribute("data-i18n") === "menu_bar.menu.blocked_players") {
                aliases.push("Blocked Players", "Blocked");
            }
            if (element.getAttribute("data-i18n") === "menu_bar.menu.change_password") {
                aliases.push("Change Password", "Password");
            }
        }
        items.set(key, { element, label, aliases });
    }
    editor.defaults = mergeReorderDefaults(editor.defaults, [...items.keys()], reorder[name]);
    editor.items = items;
    if (name === "quizBar") {
        editor.layoutObserver.disconnect();
        editor.layoutObserver.observe(container);
        for (const element of elements) editor.layoutObserver.observe(element);
    }
}

// Migrate old display-name entries to stable keys while retaining absent scripts' saved positions
function normalizeReorderKeys(saved, items) {
    const keys = saved.map(value => {
        if (items.has(value)) return value;
        const matches = [...items].filter(([, item]) => item.aliases.includes(value));
        return matches.length === 1 ? matches[0][0] : value;
    });
    return [...new Set(keys.filter(key => key.trim()))];
}

// Resolve a saved preference against today's items and append newly discovered options
function currentReorderKeys(name) {
    const editor = reorderEditors[name];
    return [...new Set([...reorder[editor.setting].filter(key => editor.items.has(key)), ...editor.defaults.filter(key => editor.items.has(key))])];
}

// Observe external additions, removals, and renamed labels without watching the editor itself
function observeReorderEditor(name) {
    const editor = reorderEditors[name];
    editor.observer.observe(document.querySelector(editor.container), { childList: true, subtree: true, characterData: true, attributeFilter: ["data-content", "data-html"] });
}

// Keep the quality popup under its button after moves, visibility changes, and quiz-bar resizing
function positionReorderQualityMenu() {
    const container = document.querySelector(reorderEditors.quizBar.container);
    if (!container.clientWidth) return;
    const quality = document.getElementById("qpQuality");
    document.getElementById("qpQualityList").style.right = `${container.clientWidth - quality.offsetLeft - quality.offsetWidth + 3}px`;
}

// Move existing game nodes into their original slots, leaving dropdowns, overlays, and handlers intact
function applyReorderEditor(name) {
    const editor = reorderEditors[name];
    const container = document.querySelector(editor.container);
    const keys = reorder[name] ? currentReorderKeys(name) : editor.defaults.filter(key => editor.items.has(key));
    const ordered = keys.map(key => editor.items.get(key).element).filter(element => element.parentNode === container);
    if (editor.reverse) ordered.reverse();
    const members = new Set(ordered);
    const actual = [...container.children].filter(element => members.has(element));
    if (actual.every((element, index) => element === ordered[index])) {
        if (name === "quizBar") positionReorderQualityMenu();
        return;
    }
    editor.observer.disconnect();
    try {
        const slots = actual.map(element => {
            const slot = document.createComment("mc-order-slot");
            container.insertBefore(slot, element);
            return slot;
        });
        slots.forEach((slot, index) => slot.replaceWith(ordered[index]));
    }
    finally { observeReorderEditor(name); }
    if (name === "quizBar") positionReorderQualityMenu();
}

// Keep position labels aligned with the current drag order.
function updateReorderPositions(list) {
    const rows = [...list.children];
    rows.forEach((row, index) => {
        row.querySelector(".mcOrderPosition").textContent = index + 1;
    });
}

// Copy a quiz option's actual icon into the editor without duplicating IDs or interactive behavior
function createReorderQuizIcon(element) {
    const source = element.querySelector("i, svg, img");
    if (!source) return null;
    const icon = source.cloneNode(true);
    for (const node of [icon, ...icon.querySelectorAll("*")]) {
        node.removeAttribute("id");
        node.removeAttribute("style");
        for (const attribute of [...node.attributes]) if (attribute.name.startsWith("on")) node.removeAttribute(attribute.name);
    }
    const wrapper = document.createElement("span");
    wrapper.className = "mcOrderIcon";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.append(icon);
    return wrapper;
}

// Render one saved draft in the same direction as its actual quiz bar or gear menu
function renderReorderEditor(name) {
    const editor = reorderEditors[name];
    const list = document.getElementById(editor.listId);
    const rows = currentReorderKeys(name).map(key => {
        const item = editor.items.get(key);
        const row = document.createElement("li");
        row.className = "mcOrderItem";
        row.dataset.orderKey = key;
        row.draggable = true;
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "mcOrderHandle";
        handle.title = "Drag to move";
        handle.setAttribute("aria-label", `Drag to move ${item.label}`);
        handle.textContent = "≡";
        const position = document.createElement("span");
        position.className = "mcOrderPosition";
        position.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "mcOrderLabel";
        label.textContent = item.label;
        row.append(handle, position);
        if (name === "quizBar") {
            const icon = createReorderQuizIcon(item.element);
            if (icon) row.append(icon);
        }
        row.append(label);
        return row;
    });
    list.replaceChildren(...rows);
    updateReorderPositions(list);
    document.getElementById(editor.checkboxId).checked = reorder[name];
}

// Restore focus to the same item after a drag rebuilds the editor rows
function focusReorderRow(name, key) {
    const list = document.getElementById(reorderEditors[name].listId);
    [...list.children].find(row => row.dataset.orderKey === key)?.querySelector(".mcOrderHandle").focus({ preventScroll: true });
}

// Reconcile live items with saved preferences; defer rebuilding a list during an active drag
function refreshReorderWindow() {
    if (reorderDrag) { reorderRefreshPending = true; return; }
    reorderRefreshPending = false;
    let migrated = false;
    for (const [name, editor] of Object.entries(reorderEditors)) {
        editor.observer.disconnect();
        try {
            collectReorderItems(name);
            const keys = normalizeReorderKeys(reorder[editor.setting], editor.items);
            migrated ||= JSON.stringify(keys) !== JSON.stringify(reorder[editor.setting]);
            reorder[editor.setting] = keys;
            applyReorderEditor(name);
            renderReorderEditor(name);
        }
        finally { observeReorderEditor(name); }
    }
    if (migrated) saveSettings();
}

// Coalesce mutations from other scripts into one refresh after their DOM updates finish
function scheduleReorderRefresh() {
    if (reorderRefreshTimer !== null) return;
    reorderRefreshTimer = setTimeout(() => {
        reorderRefreshTimer = null;
        refreshReorderWindow();
    }, 0);
}

// Save edited visible rows without losing the slots reserved for temporarily absent script items
function commitReorderRows(name, focusKey) {
    const editor = reorderEditors[name];
    const visible = [...document.getElementById(editor.listId).children].map(row => row.dataset.orderKey);
    let index = 0;
    const present = new Set(visible);
    reorder[editor.setting] = [...reorder[editor.setting].map(key => present.has(key) ? visible[index++] : key), ...visible.slice(index)];
    reorder[editor.setting] = [...new Set(reorder[editor.setting])];
    saveSettings();
    if (reorderRefreshPending) refreshReorderWindow();
    else { applyReorderEditor(name); renderReorderEditor(name); }
    if (focusKey) focusReorderRow(name, focusKey);
}

// Finish a drop or restore the saved draft when a native drag is canceled
function finishReorderDrag(commit) {
    const drag = reorderDrag;
    if (!drag) return;
    reorderDrag = null;
    drag.row.classList.remove("mcOrderDragging");
    drag.row.style.removeProperty("pointer-events");
    document.getElementById(reorderEditors[drag.name].listId).classList.remove("mcOrderDraggingList");
    if (commit) commitReorderRows(drag.name, drag.row.dataset.orderKey);
    else {
        if (reorderRefreshPending) refreshReorderWindow();
        else renderReorderEditor(drag.name);
        focusReorderRow(drag.name, drag.row.dataset.orderKey);
    }
}

// Bind one editor's settings and native drag controls once, independently of row rendering
function bindReorderEditor(name) {
    const editor = reorderEditors[name];
    const list = document.getElementById(editor.listId);
    document.getElementById(editor.checkboxId).addEventListener("change", event => {
        reorder[name] = event.target.checked;
        saveSettings();
        refreshReorderWindow();
    });
    document.getElementById(editor.prefix + "ResetButton").addEventListener("click", () => {
        reorder[editor.setting] = [];
        saveSettings();
        refreshReorderWindow();
    });
    document.getElementById(editor.prefix + "RefreshButton").addEventListener("click", refreshReorderWindow);
    list.addEventListener("dragstart", event => {
        const row = event.target.closest(".mcOrderItem");
        if (!row) { event.preventDefault(); return; }
        reorderDrag = { name, row };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.orderKey);
        row.classList.add("mcOrderDragging");
        list.classList.add("mcOrderDraggingList");
        setTimeout(() => { if (reorderDrag?.row === row) row.style.pointerEvents = "none"; }, 0);
    });
    list.addEventListener("dragover", event => {
        if (reorderDrag?.name !== name) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const row = event.target.closest(".mcOrderItem");
        const dragged = reorderDrag.row;
        if (row && row !== dragged) {
            const bounds = row.getBoundingClientRect();
            if (event.clientY < bounds.top + bounds.height / 2) row.before(dragged);
            else row.after(dragged);
        }
        else if (!row && event.clientY >= list.getBoundingClientRect().bottom - 12) list.append(dragged);
        updateReorderPositions(list);
    });
    list.addEventListener("drop", event => {
        if (reorderDrag?.name !== name) return;
        event.preventDefault();
        finishReorderDrag(true);
    });
    list.addEventListener("dragend", () => finishReorderDrag(false));
}

// Initialize both live reorder editors after adding this script's own gear-menu entry
function setupReorderWindow() {
    for (const [name, editor] of Object.entries(reorderEditors)) {
        editor.observer = new MutationObserver(scheduleReorderRefresh);
        if (name === "quizBar") editor.layoutObserver = new ResizeObserver(positionReorderQualityMenu);
        bindReorderEditor(name);
    }
    refreshReorderWindow();
    $("#mcOrderTab").on("click.mcReorder", refreshReorderWindow);
    $("#mcSettingsModal").on("shown.bs.modal.mcReorder", refreshReorderWindow);
}

// Create localStorage elements in mcStorageContainer
function createLocalStorageList() {
    const formatPre = (key) => {
        try { return JSON.stringify(JSON.parse(localStorage[key]), null, 2) }
        catch { return "bad formatting" }
    }
    const $mcStorageList = $("#mcStorageList").empty();
    const list = Object.keys(localStorage).sort((a, b) => a.localeCompare(b));
    let totalBytes = 0;
    for (const key of list) {
        const bytes = new TextEncoder().encode(localStorage[key]).length;
        totalBytes += bytes;
        $mcStorageList.append($("<li>", { "data-key": key })
            .append($("<i>", { class: "fa fa-caret-right clickAble toggle", "aria-hidden": "true" }))
            .append($("<span>", { class: "name", text: key }))
            .append($("<span>", { class: "size", text: bytes.toLocaleString() + " bytes" }))
            .append($("<i>", { class: "fa fa-trash clickAble delete", "aria-hidden": "true" }))
            .append($("<pre>", { text: formatPre(key) }).hide())
        );
    }
    $("#mcStorageContainer > h4").text(`Local Storage (${list.length} item${list.length === 1 ? "" : "s"}) - ${totalBytes.toLocaleString()} bytes`);
}

// Reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#mcSettingsModal");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
}

// Return true if you are in a solo lobby or quiz
function isSoloMode() {
    return (lobby.inLobby && lobby.soloMode) || (quiz.inQuiz && quiz.soloMode) || (battleRoyal.inView && battleRoyal.soloMode);
}

// Return true if you are in jam mode
function isJamMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Jam") || (quiz.inQuiz && quiz.gameMode === "Jam");
}

// Return true if you are in a ranked lobby or quiz
function isRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
}

// Return true if you are in a themed lobby or quiz
function isThemedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Themed") || (quiz.inQuiz && quiz.gameMode === "Themed");
}

// Return true if you are in ranked or themed
function isQuizOfTheDay() {
    return isRankedMode() || isThemedMode();
}

// Return true if player is your friend
function isFriend(name) {
    if (!name) return false;
    name = name.toLowerCase();
    for (const friend of getAllFriends()) {
        if (friend.toLowerCase() === name) return true;
    }
    return false;
}

// Return true if player is in lobby or quiz (not spectating)
function isPlayer(name) {
    if (!name) return false;
    name = name.toLowerCase();
    if (lobby.inLobby) {
        for (const player of Object.values(lobby.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (quiz.inQuiz) {
        for (const player of Object.values(quiz.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (battleRoyal.inView) {
        for (const player of Object.values(battleRoyal.players)) {
            if (player._name.toLowerCase() === name) return true;
        }
    }
    if (!nexus.inNexusLobby && !nexus.inNexusGame) return false;
    const playerNames = Object.keys(nexusCoopChat.playerMap);
    if (!playerNames.length) return selfName.toLowerCase() === name;
    return playerNames.some(player => player.toLowerCase() === name);
}

// Return true if player is spectator
function isSpectator(name) {
    if (!name) return false;
    name = name.toLowerCase();
    for (const player of gameChat.spectators) {
        if (player.name.toLowerCase() === name) return true;
    }
    return false;
}

// Return true if player is in your room
function isInYourRoom(name) {
    return isPlayer(name) || isSpectator(name);
}

// Return true if you are in a room
function inRoom() {
    return lobby.inLobby || quiz.inQuiz || battleRoyal.inView || nexus.inNexusLobby || nexus.inNexusGame;
}

// Return array of names of all friends
function getAllFriends() {
    return Object.keys(socialTab.onlineFriends).concat(Object.keys(socialTab.offlineFriends));
}

// Return array of names of players in game
function getPlayerList() {
    if (lobby.inLobby) {
        return Object.values(lobby.players).map(p => p._name);
    }
    if (quiz.inQuiz) {
        return Object.values(quiz.players).map(p => p._name);
    }
    if (battleRoyal.inView) {
        return Object.values(battleRoyal.players).map(p => p._name);
    }
    if (nexus.inNexusLobby || nexus.inNexusGame) {
        if (Object.keys(nexusCoopChat.playerMap).length) {
            return Object.keys(nexusCoopChat.playerMap);
        }
        else return [selfName];
    }
    return [];
}

// Return array of names of spectators
function getSpectatorList() {
    return gameChat.spectators.map(p => p.name);
}

// Return array of names of players and spectators
function getEveryoneInRoom() {
    return getPlayerList().concat(getSpectatorList());
}

// Return object with team numbers as keys and list of player names as each value
function getTeamMap() {
    const teams = {};
    if (lobby.inLobby) {
        for (const player of Object.values(lobby.players)) {
            const teamNumber = player.lobbySlot.$TEAM_DISPLAY_TEXT.text();
            if (Number.isNaN(parseInt(teamNumber))) continue;
            if (!Object.hasOwn(teams, teamNumber)) teams[teamNumber] = [];
            teams[teamNumber].push(player._name);
        }
        return teams;
    }

    let players = [];
    if (quiz.inQuiz) players = Object.values(quiz.players);
    else if (battleRoyal.inView) players = Object.values(battleRoyal.players);
    for (const player of players) {
        const teamNumber = player.teamNumber;
        if (!Object.hasOwn(teams, teamNumber)) teams[teamNumber] = [];
        teams[teamNumber].push(player._name);
    }
    return teams;
}

// Input team number, return list of names of players on team
function getTeamList(team) {
    if (!Number.isInteger(team)) return [];
    if (lobby.inLobby) {
        return Object.values(lobby.players).filter(player => {
            const teamNumber = parseInt(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
            return teamNumber === team;
        }).map(player => player._name);
    }
    let players;
    if (quiz.inQuiz) players = Object.values(quiz.players);
    else if (battleRoyal.inView) players = Object.values(battleRoyal.players);
    else return [];
    return players.filter(player => player.teamNumber === team).map(player => player._name);
}

// Input player name, return their team number
function getTeamNumber(name) {
    if (lobby.inLobby) {
        for (const player of Object.values(lobby.players)) {
            if (player._name.toLowerCase() === name.toLowerCase()) {
                return parseInt(player.lobbySlot.$TEAM_DISPLAY_TEXT.text());
            }
        }
    }
    if (quiz.inQuiz) {
        for (const player of Object.values(quiz.players)) {
            if (player._name.toLowerCase() === name.toLowerCase()) {
                return player.teamNumber;
            }
        }
    }
    if (battleRoyal.inView) {
        for (const player of Object.values(battleRoyal.players)) {
            if (player._name.toLowerCase() === name.toLowerCase()) {
                return player.teamNumber;
            }
        }
    }
}

// Return a random player name in the room besides yourself
function getRandomOtherPlayer() {
    const list = getPlayerList().filter(p => p !== selfName);
    return list[Math.floor(Math.random() * list.length)];
}

// Return a random player name on your team besides yourself
function getRandomOtherTeammate() {
    const list = getTeamList(getTeamNumber(selfName)).filter(p => p !== selfName);
    return list[Math.floor(Math.random() * list.length)];
}

// Send a regular public message in game chat
function sendChatMessage(message, isTeamMessage) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: { msg: String(message), teamMessage: Boolean(isTeamMessage) }
    });
}

// Send a client side message to game chat
function sendSystemMessage(message, message2) {
    setTimeout(() => {
        if (gameChat.open) {
            if (message2) {
                gameChat.systemMessage(String(message), String(message2));
            }
            else {
                gameChat.systemMessage(String(message));
            }
        }
        else if (nexus.inCoopLobby) {
            nexusCoopChat.displayServerMessage({ message: String(message) });
        }
    }, 0);
}

// Send a message in nexus chat
function sendNexusChatMessage(message) {
    socket.sendCommand({
        type: "nexus",
        command: "coop chat message",
        data: { message: String(message) }
    });
}

// Send a private message
function sendDM(target, message) {
    setTimeout(() => {
        socket.sendCommand({
            type: "social",
            command: "chat message",
            data: { target: target, message: String(message) }
        });
    }, 100);
}

// Show a standard popout message from the side of the screen
function popoutMessage(head, body) {
    const htmlBody = format(popoutMessages.STANDARD_TEMPLATE, escapeHtml(head), escapeHtml(body).replace(/\n/g, "<br>"));
    popoutMessages.displayPopoutMessage(htmlBody);
}

// === Room settings and navigation ===

// Abort settings operations tied to the previous room or host session
function invalidateGameSettings() {
    gameSettingsController.abort();
    gameSettingsController = new AbortController();
}

// Capture the room and cancellation signal for a settings operation
function captureGameSettingsRoom() {
    return { gameId: lobby.gameId, signal: gameSettingsController.signal };
}

// Check that a settings operation still targets the same hosted lobby
function isGameSettingsRoomCurrent(room) {
    return !room.signal.aborted && lobby.inLobby && lobby.isHost && lobby.gameId === room.gameId;
}

// Commit through the client and detect whether it sent a settings request
function submitGameSettings() {
    // The native commit returns no result. Observe its synchronous send to distinguish
    // a request from a no-op or validation failure without duplicating its validation
    const sendCommand = socket.sendCommand;
    let sent = false;
    // Forward requests unchanged while recording native settings submissions
    socket.sendCommand = function (command, ...args) {
        if (command?.type === "lobby" && command.command === "change game settings") sent = true;
        return sendCommand.call(this, command, ...args);
    };
    try {
        lobby.changeGameSettings();
        return sent;
    }
    finally { socket.sendCommand = sendCommand; }
}

// Reset gameplay settings without overwriting the current room name, privacy, or password
function createDefaultGameSettingsPatch() {
    const settings = JSON.parse(JSON.stringify(hostModal.DEFUALT_SETTINGS));
    delete settings.roomName;
    delete settings.privateRoom;
    delete settings.password;
    return settings;
}

// Accept a top-level patch, or a synchronous callback returning one from a fresh draft
// Nested settings are complete groups, matching hostModal.updateSetting()
// Resolve false if the room/host session changed; completion is not a server success guarantee
async function changeGameSettings(update, room = captureGameSettingsRoom()) {
    if (!isGameSettingsRoomCurrent(room)) return false;
    const patch = typeof update === "function" ? null : JSON.parse(JSON.stringify(update));
    try {
        return await queueCommandTask("game settings", async () => {
            if (!isGameSettingsRoomCurrent(room)) return false;
            // Native room-setting responses defer their form updates by one timer turn
            // Enter the next operation after those updates, then apply and commit together
            await new Promise(resolve => setTimeout(resolve, 1));
            if (!isGameSettingsRoomCurrent(room)) return false;
            const current = hostModal.getSettings(true);
            if (
                !current
                && typeof update === "function"
            ) {
                throw new Error("Current game settings are invalid; correct the form or reset defaults");
            }
            const changes = typeof update === "function" ? update(JSON.parse(JSON.stringify(current))) : patch;
            if (!changes) return true;
            if (typeof changes !== "object" || Array.isArray(changes) || typeof changes.then === "function") {
                throw new Error("Game settings updates must return a synchronous settings patch");
            }
            const entries = Object.entries(changes);
            const formChanges = entries.filter(([key, value]) => !current || JSON.stringify(current[key]) !== JSON.stringify(value));
            const roomChanges = entries.some(([key, value]) => JSON.stringify(lobby.settings[key]) !== JSON.stringify(value));
            if (!formChanges.length && !roomChanges) return true;
            // Song count updates redistribute song-type and selection counts synchronously
            formChanges.sort(([a], [b]) => a === b ? 0 : a === "numberOfSongs" ? -1 : b === "numberOfSongs" ? 1 : 0);
            for (const [key, value] of formChanges) {
                if (!isGameSettingsRoomCurrent(room)) return false;
                hostModal.updateSetting(key, value);
            }
            if (!isGameSettingsRoomCurrent(room)) return false;
            await requestCommand("Room Settings Changed", submitGameSettings, {
                signal: room.signal,
                accept: () => isGameSettingsRoomCurrent(room),
            });
            return true;
        });
    }
    catch (error) {
        if (!isGameSettingsRoomCurrent(room)) return false;
        throw error;
    }
}

// Input text, return name that matches the closest
function resolveRoomPlayerName(text) {
    const name = text.toLowerCase();
    const list = [];
    for (const player of getEveryoneInRoom()) {
        const lower = player.toLowerCase();
        if (lower === name) {
            return player;
        }
        else if (lower.includes(name)) {
            list.push(player);
        }
    }
    return list.length === 1 ? list[0] : text;
}

// Input text or id, return genre that matches the closest
function resolveGenre(text) {
    const result = resolveCommandLookup(idTranslator.genreNames, text);
    return { genre: result.name || text, id: result.state === "resolved" ? result.id : null, state: result.state };
}

// Input text or id, return tag that matches the closest
function resolveTag(text) {
    const result = resolveCommandLookup(idTranslator.tagNames, text);
    return { tag: result.name || text, id: result.state === "resolved" ? result.id : null, state: result.state };
}

// Input text, return script that matches the closest
function resolveScriptName(text) {
    text = text.toLowerCase().replace(/\s+/g, "");
    if (!text) return;
    const list = [];
    const $items = $("#installedListContainer h4");
    for (const item of $items) {
        const name = $(item).find(".name").text().toLowerCase().replace(/\s+/g, "");
        if (name.includes(text)) {
            const version = $(item).find(".version").text();
            const link = $(item).find(".link").attr("href");
            list.push({ name, version, link });
        }
    }
    if (list.length === 1) {
        return list[0];
    }
    //return list.length === 1 ? list[0] : text;
}

// Input full song type text, return shortened version
function shortenSongType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// Return string of checkbox statuses for anime lists
function getAnimeListStatusFlags() {
    let text = "";
    if (options.$INCLUDE_WATCHING_CHECKBOX.prop("checked")) {
        text += "W";
    }
    if (options.$INCLUDE_COMPLETED_CHECKBOX.prop("checked")) {
        text += "C";
    }
    if (options.$INCLUDE_ON_HOLD_CHECKBOX.prop("checked")) {
        text += "H";
    }
    if (options.$INCLUDE_DROPPED_CHECKBOX.prop("checked")) {
        text += "D";
    }
    if (options.$INCLUDE_PLANNING_CHECKBOX.prop("checked")) {
        text += "P";
    }
    return text;
}

// Check if all players are ready in lobby
function allPlayersReady() {
    return lobby.numberOfPlayersReady === Object.keys(lobby.players).length;
}

// Check conditions and ready up in lobby
function checkAutoReady() {
    if (autoReady && lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && !isQuizOfTheDay()) {
        lobby.fireMainButtonEvent();
    }
}

// Pause the quiz when a player leaves or disconnects
function checkAutoPause(change) {
    if (!autoPause || !quiz.inQuiz || quiz.pauseButton.pauseOn || change.kicked) return;
    const name = change.player.name;
    if (name === selfName) return;
    if (!quiz.isHost && change.newHost !== selfName) return;
    const mode = quiz.gameMode;
    if (
        mode === "Ranked"
        || mode === "Themed"
        || mode === "Jam"
        || mode === "event"
        || mode === "event-hosted"
    ) {
        return;
    }
    socket.sendCommand({ type: "quiz", command: "quiz pause" });
    sendSystemMessage(`paused: ${name} ${change.disconnect ? "disconnected" : "left"}`);
}

// Check conditions and start game
function checkAutoStart() {
    clearTimeout(autoStartCheckTimer);
    const generation = autoStartGeneration;
    const check = setTimeout(() => {
        if (autoStartCheckTimer !== check || autoStartGeneration !== generation) return;
        autoStartCheckTimer = null;
        if (autoStart.remaining === 0 || !lobby.inLobby || !lobby.isHost) return cancelAutoStart();
        if (autoStart.delay) {
            if (autoStart.timerRunning) return;
            const roomId = lobby.gameId;
            sendSystemMessage(`Auto starting in ${autoStart.delay / 1000}s`);
            autoStart.timerRunning = true;
            const timer = setTimeout(() => {
                if (autoStart.timer !== timer || autoStartGeneration !== generation) return;
                autoStart.timer = null;
                autoStart.timerRunning = false;
                if (
                    autoStart.remaining === 0
                    || !lobby.inLobby
                    || !lobby.isHost
                    || lobby.gameId !== roomId
                ) {
                    return;
                }
                socket.sendCommand({ type: "lobby", command: "start game" });
                consumeAutoStart();
            }, autoStart.delay);
            autoStart.timer = timer;
        }
        else if (allPlayersReady()) {
            lobby.fireMainButtonEvent(true);
            consumeAutoStart();
        }
    }, 1);
    autoStartCheckTimer = check;
}

// Check conditions and switch between player and spectator
function checkAutoSwitch() {
    if (lobby.inLobby) {
        if (autoSwitch.mode === "player" && lobby.isSpectator) {
            if (autoSwitch.temp) {
                autoSwitch.mode = "";
                autoSwitch.temp = false;
                commitCommandSettings();
            }
            socket.sendCommand({ type: "lobby", command: "change to player" });
        }
        else if (autoSwitch.mode === "spectator" && !lobby.isSpectator) {
            if (autoSwitch.temp) {
                autoSwitch.mode = "";
                autoSwitch.temp = false;
                commitCommandSettings();
            }
            lobby.changeToSpectator(selfName);
        }
    }
}

// Check conditions and promote host
function checkAutoHost() {
    if (!autoHost || autoHost === selfName.toLowerCase()) return;
    if (
        !(lobby.inLobby && lobby.isHost)
        && !(nexus.inCoopLobby && nexusCoopChat.hostName === selfName)
    ) {
        return;
    }
    const name = autoHost === "*" ? getRandomOtherPlayer() : resolvePlayerNameCase(autoHost);
    if (name && name !== selfName && isInYourRoom(name)) promoteCommandHost(name);
}

// Check conditions for auto accepting a game invite
function checkAutoInvite(name) {
    if (autoAcceptInvite === "all") return true;
    if (autoAcceptInvite === "friends" && socialTab.isFriend(name)) return true;
    if (Array.isArray(autoAcceptInvite) && autoAcceptInvite.includes(name.toLowerCase())) return true;
    return false;
}

// Join ranked, options: NOVICE, EXPERT  (themed is expert)
function joinRanked(type) {
    if (!type) return;
    const IDS = ranked.RANKED_STATE_IDS;
    if ([IDS.LOBBY, IDS.CHAMP_LOBBY, IDS.THEMED_LOBBY].includes(ranked.currentState)) {
        ranked.joinRankedLobby(ranked.RANKED_TYPE_IDS[type]);
    }
    else if ([IDS.RUNNING, IDS.CHAMP_RUNNING, IDS.THEMED_RUNNING].includes(ranked.currentState)) {
        ranked.joinRankedGame(ranked.RANKED_TYPE_IDS[type]);
    }
}

// Input number of milliseconds of delay, leave and rejoin the room you were in
async function rejoinRoom(time) {
    if (
        !Number.isInteger(time)
        || time < 0
        || time > MAX_COMMAND_DELAY
    ) {
        throw new Error("invalid rejoin delay");
    }
    const previous = rejoinOperation;
    let destination = previous?.destination;
    if (!destination) {
        if (isSoloMode()) destination = { type: "solo" };
        else if (isQuizOfTheDay()) destination = { type: "ranked", rankedType: hostModal.$roomName.val().includes("Novice") ? "NOVICE" : "EXPERT" };
        else if (lobby.inLobby) destination = { type: "lobby", id: lobby.gameId, password: hostModal.$passwordInput.val(), spectator: lobby.isSpectator };
        else if (quiz.inQuiz || battleRoyal.inView) destination = { type: "quiz", password: hostModal.$passwordInput.val() };
        else return;
    }
    cancelRejoin();
    const operation = { destination, departed: previous?.departed || false, expectedView: previous?.expectedView, timers: new Map() };
    rejoinOperation = operation;
    try {
        if (!await waitForRejoin(operation, 1)) return;
        if (!operation.departed) {
            if (destination.type === "quiz") {
                destination.inviteRequest ||= requestOwnGameInvite();
                const data = await destination.inviteRequest;
                if (rejoinOperation !== operation) return;
                destination.id = data.gameId;
            }
            const view = ["solo", "ranked"].includes(destination.type) ? "main" : "roomBrowser";
            operation.expectedView = view;
            runRejoinAction(operation, () => destination.type === "lobby" ? lobby.leave() : viewChanger.changeView(view));
            operation.departed = true;
        }
        if (!await waitForRejoin(operation, time)) return;
        if (destination.type === "solo") {
            runRejoinAction(operation, () => hostModal.displayHostSolo());
            if (!await waitForRejoin(operation, 100)) return;
            runRejoinAction(operation, () => roomBrowser.host());
        }
        else if (destination.type === "ranked") {
            runRejoinAction(operation, () => joinRanked(destination.rankedType));
        }
        else if (destination.type === "quiz" || destination.spectator) {
            runRejoinAction(operation, () => roomBrowser.fireSpectateGame(destination.id, destination.password));
        }
        else runRejoinAction(operation, () => roomBrowser.fireJoinLobby(destination.id, destination.password));
    }
    catch (error) {
        if (rejoinOperation === operation) throw error;
    }
    finally {
        if (rejoinOperation === operation) cancelRejoin();
    }
}

// Log out, log in, and rejoin the room you were in
async function relog() {
    cancelRejoin();
    cancelAutoStart();
    let destination = {};
    if (isSoloMode()) {
        destination = { type: "solo", rejoin: quiz.inQuiz, settings: hostModal.getSettings(true) };
    }
    else if (isRankedMode()) {
        destination = { type: hostModal.$roomName.val().toLowerCase(), rejoin: quiz.inQuiz && !quiz.isSpectator };
    }
    else if (isThemedMode()) {
        destination = { type: "themed", rejoin: quiz.inQuiz && !quiz.isSpectator };
    }
    else if (isJamMode()) {
        destination = { type: "jam" };
    }
    else if (lobby.inLobby) {
        destination = {
            type: "multiplayer",
            id: lobby.gameId,
            password: hostModal.$passwordInput.val(),
            joinAsPlayer: !lobby.isSpectator,
        };
    }
    else if (quiz.inQuiz || battleRoyal.inView) {
        const invite = await requestOwnGameInvite();
        destination = {
            type: "multiplayer",
            id: invite.gameId,
            password: hostModal.$passwordInput.val(),
            rejoin: !quiz.isSpectator,
        };
    }
    else if (nexus.inNexusLobby) {
        destination.type = "nexus solo";
        if (nexus.inCoopLobby) {
            destination.type = "nexus coop";
            if (Object.keys(nexusCoopChat.playerMap).length > 1) {
                destination.id = parseCommandInteger($("#ncdwPartySetupLobbyIdText").text(), 1);
            }
        }
    }
    else if (nexus.inNexusGame) {
        destination = { type: "nexus coop", rejoin: true };
    }

    autoJoinRoom = { ...destination, temp: true, autoLogIn: true };
    if (!saveSettings()) {
        sendSystemMessage("Could not save the relog destination. Check the console for details.");
        return;
    }
    unsafeWindow.onbeforeunload = null;
    setTimeout(() => { unsafeWindow.location = "/?forceLogin=True"; }, 1);
}

// Input name, return correct case sensitive name of player
function resolvePlayerNameCase(name) {
    if (!name) return "";
    const nameLowerCase = name.toLowerCase();
    if (inRoom()) {
        for (const player of getEveryoneInRoom()) {
            if (nameLowerCase === player.toLowerCase()) {
                return player;
            }
        }
    }
    for (const player of getAllFriends()) {
        if (nameLowerCase === player.toLowerCase()) {
            return player;
        }
    }
    for (const player of Object.keys(socialTab.allPlayerList._playerEntries)) {
        if (nameLowerCase === player.toLowerCase()) {
            return player;
        }
    }
    return name;
}

// Get current time string in HH:MM:SS format
function getTimeStamp() {
    return new Date().toLocaleTimeString().split(" ")[0];
}

// Return list of every auto function that is enabled
function getEnabledAutomationSummaries() {
    return Object.keys(commandSettings).filter(name => name.startsWith("auto") || name === "coopPaste").map(commandSettingSummary).filter(Boolean);
}

// Get the version of any script that uses joseph's script info
function getScriptVersion(input) {
    input = input.replace(/\s+/g, "").toLowerCase();
    if (/^(ess|elodie'?s?stylescript)$/.test(input)) {
        const style = getComputedStyle(document.documentElement);
        const essVersion = style.getPropertyValue("--elodieStyleScriptVersion");
        if (essVersion) return essVersion;
        if (style.getPropertyValue("--accentColor")) return "10.?";
        if (style.getPropertyValue("--bg")) return "< 10";
    }
    const $items = $("#installedListContainer h4");
    for (const item of $items) {
        const $item = $(item);
        const scriptName = $item.find(".name").text().replace(/\s+/g, "").toLowerCase();
        if (input === scriptName) {
            const scriptVersion = $item.find(".version").text();
            return scriptVersion || "installed, unknown version";
        }
    }
    return "not found";
}

// Return random integer between a and b, both inclusive
function randomIntInc(a, b) {
    if (a === undefined) return NaN;
    if (b === undefined) return a;
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

// Return random item from an array
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Calculate a math expression
function calc(input) {
    if (/^[0-9.+\-*/() ]+$/.test(input)) {
        try { return eval(input) }
        catch { return "ERROR" }
    }
    else return "ERROR";
}

// Install navigation, autocomplete, and replay overrides before client setup
function installCommandHooks() {
    // Override changeView function for auto ready
    const oldChangeView = ViewChanger.prototype.changeView;
    ViewChanger.prototype.changeView = function () {
        handleCommandNavigation(arguments[0]);
        const result = oldChangeView.apply(this, arguments);
        if (arguments[0] === "lobby") {
            setTimeout(() => {
                checkAutoReady();
                checkAutoStart();
            }, 1);
        }
        return result;
    };

    // Override newList function for drop down disable
    const oldNewList = AutoCompleteController.prototype.newList;
    AutoCompleteController.prototype.newList = function () {
        if (this.list.length > 0) animeList = this.list;
        this.list = dropdown ? animeList : [];
        return oldNewList.apply(this, arguments);
    };

    // Resume the current sample after extra guess time, or restart it when continuation is disabled
    QuizVideoController.prototype.replayVideo = function () {
        const player = this.getCurrentPlayer();
        continueSample ? player.unpauseVideo() : player.replayVideo();
        player.removeTinyVideoScale?.();
        player.removeBlurVideo?.();
        player.show();
    };
}

// Hide player names and avatars in lobby
function lobbyHidePlayers() {
    $(".lobbyAvatarPlayerOptions").addClass("hide");
    for (const player of Object.values(lobby.players)) {
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

// Unhide player names and avatars in lobby
function lobbyUnhidePlayers() {
    $(".lobbyAvatarPlayerOptions").removeClass("hide");
    for (const player of Object.values(lobby.players)) {
        if (player._name !== selfName) {
            player.hidden = false;
            if (player._host) player.lobbySlot.$IS_HOST_CONTAINER.removeClass("hide");
            player.lobbySlot.avatarIconDisplayHandler.$container.removeClass("hide");
            player.lobbySlot.$NAME_CONTAINER.css("color", player.textColor).text(player._name);
            player.lobbySlot.$LEVEL_CONTAINER.text(player.level);
        }
    }
}

// Hide player names and avatars in quiz
function quizHidePlayers() {
    for (const player of Object.values(quiz.players)) {
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
    for (const entry of Object.values(quiz.scoreboard.playerEntries)) {
        if (!entry.isSelf && !entry.hidden) {
            entry.hidden = true;
            entry.name = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").text();
            entry.textColor = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css("color");
            entry.textShadow = entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css("text-shadow");
            entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css({ "color": "inherit", "text-shadow": "inherit" }).text("player");
        }
    }
}

// Unhide player names and avatars in quiz
function quizUnhidePlayers() {
    for (const player of Object.values(quiz.players)) {
        if (!player.isSelf) {
            player.hidden = false;
            player.avatarSlot.$avatarImageContainer.removeClass("hide");
            player.avatarSlot.$backgroundContainer.removeClass("hide");
            player.avatarSlot.$nameContainer.css("color", player.textColor).text(player._name);
            player.avatarSlot.$pointContainer.css("color", player.textColor);
            player.avatarSlot.$bottomContainer.find(".qpAvatarLevelBar").removeClass("hide");
        }
    }
    for (const entry of Object.values(quiz.scoreboard.playerEntries)) {
        if (!entry.isSelf) {
            entry.hidden = false;
            entry.$scoreBoardEntryTextContainer.find(".qpsPlayerName").css({ "color": entry.textColor, "text-shadow": entry.textShadow }).text(entry.name);
        }
    }
}

// Remove anilist
function removeAnilist() {
    return queueCommandTask("anime list transaction", () => clearAnimeListProviders(["a"]));
}

// Remove myaniemlist
function removeMyanimelist() {
    return queueCommandTask("anime list transaction", () => clearAnimeListProviders(["m"]));
}

// Remove kitsu
function removeKitsu() {
    return queueCommandTask("anime list transaction", () => clearAnimeListProviders(["k"]));
}

// Remove animeoshi
function removeAnimeoshi() {
    return queueCommandTask("anime list transaction", () => clearAnimeListProviders(["o"]));
}

// Remove all lists
function removeAllLists() {
    return queueCommandTask("anime list transaction", () => clearAnimeListProviders(Object.keys(animeListProviders)));
}

// Set the status of the Anime Lists checkbox and send the command to the server
function setStatusCheckbox($checkbox, commandName, status) {
    if ($checkbox.prop("checked") !== status) {
        $checkbox.prop("checked", status);
        socket.sendCommand({
            type: "settings",
            command: "update use list entry " + commandName,
            data: { on: status }
        });
    }
}

// Set the status of all checkboxes in Anime Lists
function setAllStatusCheckboxes(watching, completed, hold, dropped, planning) {
    setStatusCheckbox(options.$INCLUDE_WATCHING_CHECKBOX, "watching", watching);
    setStatusCheckbox(options.$INCLUDE_COMPLETED_CHECKBOX, "completed", completed);
    setStatusCheckbox(options.$INCLUDE_ON_HOLD_CHECKBOX, "on hold", hold);
    setStatusCheckbox(options.$INCLUDE_DROPPED_CHECKBOX, "dropped", dropped);
    setStatusCheckbox(options.$INCLUDE_PLANNING_CHECKBOX, "planning", planning);
}

// Input array of genre ids, return anime that satisfies all genres
function findAnimeMatchingAllGenres(inputGenres) {
    for (const anime of Object.keys(dqMap)) {
        if (inputGenres.every((genre) => dqMap[anime].genre.includes(genre))) {
            return anime;
        }
    }
    return null;
}

// Input array of genre ids, return anime with highest overlap
function findAnimeWithMostMatchingGenres(inputGenres) {
    if (!inputGenres.length) return null;
    let best = null;
    for (const anime of Object.keys(dqMap)) {
        const matchCount = inputGenres.filter((genre) => dqMap[anime].genre.includes(genre)).length;
        if (matchCount === 0) continue;
        // Keep first anime in dqMap order when matchCount ties
        if (!best || matchCount > best.matchCount) {
            best = { anime, matchCount };
        }
    }
    return best ? best.anime : null;
}

// Change quiz settings to only get a specific anime
function matchSettingsToAnime(anime, numSongs) {
    if (lobby.inLobby && lobby.isHost && dqMap.hasOwnProperty(anime)) {
        return changeGameSettings(settings => {
            const data = dqMap[anime];
            if (!numSongs) numSongs = settings.numberOfSongs;
            settings.songSelection.standardValue = 1;
            settings.songSelection.advancedValue = { random: numSongs, unwatched: 0, watched: 0 };
            settings.songType.advancedValue = { openings: 0, endings: 0, inserts: 0, random: 20 };
            settings.songType.standardValue = { openings: true, endings: true, inserts: true };
            settings.vintage.advancedValueList = [];
            settings.vintage.standardValue = { seasons: data.seasons, years: data.years };
            settings.genre = data.genre.map((x) => ({ id: String(x), state: 1 }));
            settings.tags = data.tags ? data.tags.map((x) => ({ id: String(x), state: 1 })) : [];
            return { songSelection: settings.songSelection, songType: settings.songType, vintage: settings.vintage, genre: settings.genre, tags: settings.tags };
        });
    }
}

// Change quiz settings to only get a specific type of song
// Type options: OP ED IN
function matchSettingsToType(type, numSongs) {
    if (!dqTypeMap.hasOwnProperty(type)) return;
    const anime = dqTypeMap[type];
    if (!lobby.inLobby || !lobby.isHost) return;
    if (!dqMap.hasOwnProperty(anime)) return;
    return changeGameSettings(settings => {
        const data = dqMap[anime];
        if (!numSongs) numSongs = settings.numberOfSongs;
        settings.songSelection.standardValue = 1;
        settings.songSelection.advancedValue = { random: numSongs, unwatched: 0, watched: 0 };
        settings.songType.standardValue = { openings: type === "OP", endings: type === "ED", inserts: type === "IN" };
        settings.songType.advancedValue = { openings: 0, endings: 0, inserts: 0, random: numSongs };
        settings.vintage.advancedValueList = [];
        settings.vintage.standardValue = { seasons: data.seasons, years: data.years };
        settings.genre = data.genre.map((x) => ({ id: String(x), state: 1 }));
        settings.tags = data.tags ? data.tags.map((x) => ({ id: String(x), state: 1 })) : [];
        return { songSelection: settings.songSelection, songType: settings.songType, vintage: settings.vintage, genre: settings.genre, tags: settings.tags };
    });
}

// === External anime-list requests ===

// Request AniList data with typed variables, a timeout, and HTTP/GraphQL error reporting
async function requestAniList(query, variables) {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 15000);
    try {
        const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ query, variables }),
            signal: controller.signal,
        });
        const failure = `AniList request failed${response.ok ? "" : ` (${response.status})`}`;
        let result;
        try { result = await response.json(); }
        catch { throw new Error(response.ok ? "AniList returned invalid JSON" : failure); }
        const errors = result?.errors;
        if (!response.ok || errors?.length) {
            const message = Array.isArray(errors) ? errors.map(error => error?.message).filter(message => typeof message === "string").join("; ") : "";
            throw new Error(message ? `${failure}: ${message}` : failure);
        }
        if ((errors !== undefined && !Array.isArray(errors)) || !result?.data || typeof result.data !== "object" || Array.isArray(result.data)) {
            throw new Error("AniList returned invalid response data");
        }
        return result.data;
    }
    catch (error) {
        if (controller.signal.aborted) throw new Error("AniList request timed out");
        throw error;
    }
    finally { clearTimeout(timeout); }
}

// Fetch anime details while preserving a null result for a missing media record
async function getAnimeFromAnilistId(id) {
    const query = `
        query AnimeDetails($id: Int!) {
            Media(id: $id, type: ANIME) {
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
    const data = await requestAniList(query, { id });
    if (data.Media !== null && (!data.Media || typeof data.Media !== "object" || Array.isArray(data.Media))) {
        throw new Error("AniList returned invalid anime data");
    }
    return data.Media;
}

// Collect every status/custom list and return each anime once in its original entry shape
async function getAnilistAnimeList(username) {
    const query = `
        query UserAnimeList($username: String!) {
            MediaListCollection(userName: $username, type: ANIME) {
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
    const data = await requestAniList(query, { username });
    if (!Array.isArray(data.MediaListCollection?.lists)) {
        throw new Error("AniList returned invalid anime list data");
    }
    const entries = new Map();
    for (const list of data.MediaListCollection.lists) {
        if (!Array.isArray(list?.entries)) throw new Error("AniList returned invalid anime list entries");
        for (const entry of list.entries) {
            if (
                !Number.isInteger(entry?.media?.id)
                || entry.media.id < 1
            ) {
                throw new Error("AniList returned an invalid anime list entry");
            }
            if (!entries.has(entry.media.id)) entries.set(entry.media.id, entry);
        }
    }
    return [...entries.values()];
}

// Request one MAL page and reject HTTP, API, JSON, or pagination-shape failures
function requestMyAnimeList(url, clientId) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url,
            headers: { "Accept": "application/json", "X-MAL-CLIENT-ID": clientId },
            timeout: 15000,
            onload: (response) => {
                try {
                    const success = response.status >= 200 && response.status < 300;
                    const failure = `MyAnimeList request failed (${response.status})`;
                    let result;
                    try { result = JSON.parse(response.response); }
                    catch { throw new Error(success ? "MyAnimeList returned invalid JSON" : failure); }
                    if (!success || result?.error) {
                        const message = typeof result?.message === "string" ? result.message : typeof result?.error === "string" ? result.error : "";
                        throw new Error(message ? `${failure}: ${message}` : failure);
                    }
                    const paging = result?.paging;
                    if (!Array.isArray(result?.data) || !paging || typeof paging !== "object" || Array.isArray(paging)
                        || (paging.next != null && typeof paging.next !== "string")) {
                        throw new Error("MyAnimeList returned invalid anime list data");
                    }
                    resolve(result);
                }
                catch (error) { reject(error); }
            },
            onerror: () => reject(new Error("MyAnimeList request failed")),
            ontimeout: () => reject(new Error("MyAnimeList request timed out")),
            onabort: () => reject(new Error("MyAnimeList request aborted")),
        });
    });
}

// Fetch all MAL pages with one client ID, deduplicating anime and rejecting repeated page URLs
async function getMALAnimeList(username) {
    const clientId = malClientId;
    if (!clientId) throw new Error("mal client id is not set");
    const url = new URL(`https://api.myanimelist.net/v2/users/${encodeURIComponent(username)}/animelist`);
    url.search = new URLSearchParams({ offset: "0", limit: "1000", nsfw: "true" });
    let nextPage = url.href;
    const pages = new Set();
    const entries = new Map();
    while (nextPage) {
        if (pages.has(nextPage)) throw new Error("MyAnimeList returned a repeated page URL");
        pages.add(nextPage);
        const result = await requestMyAnimeList(nextPage, clientId);
        for (const entry of result.data) {
            if (
                !Number.isInteger(entry?.node?.id)
                || entry.node.id < 1
            ) {
                throw new Error("MyAnimeList returned an invalid anime list entry");
            }
            if (!entries.has(entry.node.id)) entries.set(entry.node.id, entry);
        }
        if (result.paging.next) {
            try { nextPage = new URL(result.paging.next, nextPage).href; }
            catch { throw new Error("MyAnimeList returned an invalid next-page URL"); }
        }
        else nextPage = null;
    }
    return [...entries.values()];
}

// Format song url, handle bad data
function formatURL(url) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return videoResolver.formatUrl(url);
}

// Input audio url, return array buffer data
async function urlToArrayBuffer(url) {
    if (!url) return;
    return await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            onload: (res) => resolve(res.response),
            onerror: (res) => reject(res)
        });
    });
}

// Guess MIME for media downloads (blob type is advisory for save dialog)
function mimeFromFileName(fileName) {
    const n = fileName.toLowerCase();
    if (n.endsWith(".mp3")) return "audio/mpeg";
    if (n.endsWith(".webm")) return "video/webm";
    if (n.endsWith(".mp4")) return "video/mp4";
    if (n.endsWith(".ogg")) return "audio/ogg";
    if (n.endsWith(".m4a")) return "audio/mp4";
    return "application/octet-stream";
}

// Download audio/video file from url
async function downloadSong(url) {
    if (!url) return;
    let objectUrl;
    try {
        const arrayBuffer = await urlToArrayBuffer(url);
        const raw = url.split("/").slice(-1)[0] || "download";
        const fileName = raw.split("?")[0];
        const blob = new Blob([arrayBuffer], { type: mimeFromFileName(fileName) });
        objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    catch (error) {
        console.error("downloadSong failed", error);
    }
    finally {
        if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
}

// Reverse audio buffer in place
function reverseAudioBuffer(audioBuffer) {
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const data = audioBuffer.getChannelData(channel);
        const len = data.length;
        const half = Math.floor(len / 2);
        for (let i = 0; i < half; i++) {
            const tmp = data[i];
            data[i] = data[len - 1 - i];
            data[len - 1 - i] = tmp;
        }
    }
    return audioBuffer;
}

// === Startup and game event binding ===

// Confirm the translated already-online prompt once when relog requests automatic login
function handleCommandLogin() {
    const loginState = validateLocalStorage("megaCommands").autoJoinRoom;
    if (!isStoredRecord(loginState) || loginState.autoLogIn !== true) return;

    localizationHandler.addOnSetupDoneCallback(() => {
        const observer = new MutationObserver(confirmLogin);
        function confirmLogin() {
            if (!Swal.isVisible()) return;
            const title = localizationHandler.translate("login_page.popout_messages.already_online.title");
            if (Swal.getTitle().textContent !== title) return;
            observer.disconnect();
            Swal.clickConfirm();
        }
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style"] });
        confirmLogin();
    });
}

// Install early hooks, then initialize once AMQ finishes loading
function startScript() {
    installCommandHooks();
    const loadingScreen = document.querySelector("#loadingScreen");
    if (loadingScreen.classList.contains("hidden")) {
        setup();
        return;
    }
    const observer = new MutationObserver(() => {
        if (!loadingScreen.classList.contains("hidden")) return;
        observer.disconnect();
        setup();
    });
    observer.observe(loadingScreen, { attributes: true, attributeFilter: ["class"] });
}

// Initialize features and UI before performing startup room navigation
function setup() {
    setupCommandAudio();
    commitCommandSettings();
    applyStartupPreferences();
    bindPlaybackEvents();
    setupHotkeys();
    setupCommandLifecycle();
    bindGameListeners();
    bindCommandInputs();
    createCommandWindow();
    registerCommandScript();
    joinStartupRoom();
}

// Apply saved login preferences and initialize the autocomplete cache
function applyStartupPreferences() {
    if (lastUsedVersion && GM_info.script.version !== lastUsedVersion) {
        if (alerts.newVersion.popout) {
            popoutMessage("Mega Commands", "updated to version " + GM_info.script.version);
        }
        if (alerts.newVersion.console) {
            console.log("Mega Commands updated to version " + GM_info.script.version);
        }
    }

    // Open dm chat box to yourself on login
    if (selfDM) {
        setTimeout(() => {
            socialTab.startChat(selfName);
            socialTab.chatBar.activeChats[0].object.close();
            socialTab.chatBar.activeChats[0].object.selected();
        }, 100);
    }

    // Automatically change social status on login
    if (autoStatus) {
        const statusMap = {
            "do not disturb": 2,
            "away": 3,
            "offline": 4,
            "invisible": 4,
        };
        const id = statusMap[autoStatus];
        if (id) {
            setTimeout(() => {
                socialTab.socialStatus.changeSocialStatus(id);
            }, 2000);
        }
    }

    const autocomplete = quiz.answerInput.typingInput.autoCompleteController;
    if (autocomplete.list.length) animeList = autocomplete.list;
    animeListLower = animeList.map(name => name.toLowerCase());
    if (!dropdown && autocomplete.list.length) autocomplete.newList();
}

// Loop finished videos while respecting the current loop setting
function bindPlaybackEvents() {
    // Loop video
    for (const videoPlayer of quizVideoController.moePlayers) {
        videoPlayer.player.on("ended", () => {
            if (loopVideo) {
                videoPlayer.allowSeeking = true;
                videoPlayer.player.currentTime(0);
            }
        });
    }
}

// Connect game and social events to command features
function bindGameListeners() {
    bindCommandChatListeners();
    bindCommandRoomListeners();
    bindCommandQuizListeners();
    bindCommandSocialListeners();
    bindCommandNexusListeners();
    bindCommandNotificationListeners();
}

// Route chat commands independently of optional console logging
function bindCommandChatListeners() {
    new Listener("game chat update", (data) => {
        for (const message of data.messages) {
            if (alerts.chat.console) {
                const color = getPlayerColor(message.sender);
                if (color) {
                    console.log(`${getTimeStamp()} 💬 %c${message.sender}%c${message.modMessage ? "Ⓜ️" : ""}: ${message.message}`, `color: ${color}`, "");
                }
                else {
                    console.log(`${getTimeStamp()} 💬 ${message.sender}${message.modMessage ? "Ⓜ️" : ""}: ${message.message}`);
                }
            }
            if (!routeChatCommand(message.message, message.sender, message.teamMessage ? "teamchat" : "chat")
                && coopPaste && message.sender !== selfName && message.message.startsWith(coopPrefix)) {
                if (quiz.inQuiz && !quiz.isSpectator && !isQuizOfTheDay()) {
                    quiz.answerInput.setNewAnswer(message.message.slice(coopPrefix.length));
                }
            }
        }
    }).bindListener();

    new Listener("Game Chat Message", (data) => {
        if (alerts.chat.console) {
            console.log(`${getTimeStamp()} 💬 ${data.sender}${data.modMessage ? "Ⓜ️" : ""}: ${data.message}`);
        }
        routeChatCommand(data.message, data.sender, data.teamMessage ? "teamchat" : "chat");
    }).bindListener();

    new Listener("chat message", (data) => {
        if (alerts.dm.console) {
            console.log(`${getTimeStamp()} 📩 from ${data.sender}${data.modMessage ? "Ⓜ️" : ""}: ${data.message}`);
        }
        parseIncomingDM(data.message, data.sender);
    }).bindListener();

    new Listener("chat message response", (data) => {
        if (alerts.dm.console) {
            console.log(`${getTimeStamp()} 📩 to ${data.target}: ${data.msg}`);
        }
        if (data.msg.trimStart().startsWith(commandPrefix)) {
            parseCommand(data.msg, "dm", data.target);
        }
    }).bindListener();

    new Listener("nexus coop chat message", (data) => {
        if (alerts.chat.console) {
            console.log(`${getTimeStamp()} 💬 ${data.sender}: ${data.message}`);
        }
        routeChatCommand(data.message, data.sender, "nexus");
    }).bindListener();
}

// Respond to room membership, settings, and host changes
function bindCommandRoomListeners() {
    new Listener("New Rooms", (data) => {
        for (const room of data.standard) {
            const players = [...room.allPlayers.players, ...room.allPlayers.spectators].map((player) => player.name);
            if (playerDetection.invisible) {
                const list = players.filter(p => socialTab.offlineFriends.hasOwnProperty(p));
                if (list.length) {
                    popoutMessage(`${list.join(", ")} (invisible)`, `Room ${room.id}: ${room.settings.roomName}`);
                }
            }
            if (playerDetection.players.length) {
                for (const player of playerDetection.players) {
                    if (players.includes(player)) {
                        popoutMessage(player, `Room ${room.id}: ${room.settings.roomName}`);
                    }
                }
            }
        }
    }).bindListener();

    new Listener("Join Game", data => {
        handleCommandRoomEntry(data, "Join");
    }).bindListener();

    new Listener("Spectate Game", data => {
        handleCommandRoomEntry(data, "Spectate");
    }).bindListener();

    new Listener("New Player", (data) => {
        scheduleCommandRoomAction(() => { checkAutoHost() }, 0);
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();

    new Listener("New Spectator", (data) => {
        scheduleCommandRoomAction(() => { checkAutoHost() }, 0);
    }).bindListener();

    new Listener("Player Left", (change) => {
        checkAutoPause(change);
    }).bindListener();

    new Listener("Player Ready Change", (data) => {
        checkAutoStart();
    }).bindListener();

    new Listener("Room Settings Changed", (data) => {
        cancelAutoStart();
        checkAutoStart();
        setTimeout(() => { checkAutoReady() }, 0);
    }).bindListener();

    new Listener("Player Changed To Spectator", (data) => {
        if (data.playerDescription.name === selfName) {
            for (const feature of ["autoThrow", "autoVoteSkip", "resultSkip"]) cancelSongTimers(feature);
            setTimeout(() => { checkAutoSwitch() }, 0);
        }
    }).bindListener();

    new Listener("Spectator Change To Player", (data) => {
        if (data.name === selfName) {
            setTimeout(() => {
                checkAutoReady();
                checkAutoStart();
                checkAutoSwitch();
            }, 0);
        }
        if (hidePlayers) setTimeout(() => { lobbyHidePlayers() }, 0);
    }).bindListener();

    new Listener("Host Promotion", (data) => {
        scheduleCommandRoomAction(() => {
            checkAutoHost();
            checkAutoReady();
            if (hidePlayers) lobbyHidePlayers();
        }, 0);
    }).bindListener();
}

// Keep song automation and quiz transitions in the same lifecycle order
function bindCommandQuizListeners() {
    new Listener("Game Starting", (data) => {
        for (const name of [
            "autoVoteSkip",
            "autoKey",
            "autoCopy",
            "autoHint",
            "autoThrow",
            "autoMute",
            "muteReplay",
            "muteSubmit",
            "videoSpeed",
            "autoDownloadSong",
            "autoDownloadJson",
            "autoShareAnswer",
            "coopPaste",
        ]) {
            const text = commandSettingSummary(name);
            if (text) sendSystemMessage(text);
        }
        if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
    }).bindListener();

    new Listener("quiz ready", (data) => {
        if (alerts.quizStart.console) {
            const mode = lobby.settings?.gameMode ?? quiz.gameMode;
            const songs = data.numberOfSongs;
            const players = Object.keys(quiz.players).length;
            console.log(`${getTimeStamp()} ${mode} Quiz Starting - ${songs} songs, ${players} player${players === 1 ? "" : "s"}`);
        }
    }).bindListener();

    new Listener("battle royal phase over", (data) => {
        if (printLoot && !battleRoyal.isSpectator) {
            const cc = battleRoyal.collectionController;
            const lootNames = cc.entries.map((entry) => entry.$entry.text().slice(2));
            sendSystemMessage(`Loot: ${cc.entries.length}/${cc.size}`, lootNames.join("<br>"));
        }
    }).bindListener();

    new Listener("quiz next video info", data => {
        prepareCommandAudio(data);
    }).bindListener();

    new Listener("play next song", (data) => {
        if (videoSpeed.length) {
            const speed = randomCommandNumber(...videoSpeed);
            for (const videoPlayer of quizVideoController.moePlayers) {
                if (!videoPlayer.encrypted) {
                    videoPlayer.playbackRate = speed;
                }
            }
        }
        startCommandSong(data);
        if (dropdownInSpec && quiz.isSpectator) {
            scheduleSongTask("dropdown", () => {
                if (!animeListLower.length) {
                    quiz.answerInput.typingInput.autoCompleteController.updateList();
                }
                quiz.answerInput.typingInput.$input.removeAttr("disabled").val("");
            }, 1);
        }
    }).bindListener();

    new Listener("team member answer", (data) => {
        if (autoCopy && autoCopy === quiz.players[data.gamePlayerId]._name.toLowerCase()) {
            const currentText = quiz.answerInput.typingInput.$input.val();
            quiz.answerInput.setNewAnswer(data.answer);
            quiz.answerInput.typingInput.$input.val(currentText);
        }
        if (autoVoteSkip === "valid" && !quiz.skipController._toggled && data.answer.length > 1 && animeListLower.includes(data.answer.toLowerCase())) {
            quiz.skipClicked();
        }
    }).bindListener();

    new Listener("guess phase over", (data) => {
        finishCommandGuess();
        if (dropdownInSpec && quiz.isSpectator) {
            scheduleSongTask("dropdown", () => {
                if (!animeListLower.length) {
                    quiz.answerInput.typingInput.autoCompleteController.updateList();
                }
                quiz.answerInput.typingInput.$input.removeAttr("disabled");
            }, 1, "replay");
        }
    }).bindListener();

    new Listener("answer results", (data) => {
        finishCommandGuess();
        if (muteReplay) setCommandMuteReason("replay", true);
        if (autoVoteSkip === "correct") {
            const player = data.players.find((x) => x.gamePlayerId === quiz.ownGamePlayerId);
            if (player?.correct) {
                scheduleSongTask("resultSkip", () => { if (autoVoteSkip === "correct" && !quiz.skipController._toggled) quiz.skipClicked(); }, 1, "replay", true);
            }
        }
        if (autoDownloadSong.length) {
            if (autoDownloadSong.includes("video")) {
                downloadSong(formatURL(data.songInfo.videoTargetMap.catbox?.[720] || data.songInfo.videoTargetMap.catbox?.[480]));
            }
            else {
                if (autoDownloadSong.includes("720")) {
                    downloadSong(formatURL(data.songInfo.videoTargetMap.catbox?.[720]));
                }
                if (autoDownloadSong.includes("480")) {
                    downloadSong(formatURL(data.songInfo.videoTargetMap.catbox?.[480]));
                }
            }
            if (autoDownloadSong.includes("mp3")) {
                downloadSong(formatURL(data.songInfo.videoTargetMap.catbox?.[0]));
            }
        }
    }).bindListener();

    new Listener("player late join", (data) => {
        if (hidePlayers) setTimeout(() => { quizHidePlayers() }, 0);
    }).bindListener();

    new Listener("player hidden", (data) => {
        if (alerts.hiddenPlayers.popout) {
            popoutMessage("Player Hidden", data.name);
        }
        if (alerts.hiddenPlayers.chat) {
            sendSystemMessage("Player Hidden: " + data.name);
        }
        if (alerts.hiddenPlayers.console) {
            console.log(`${getTimeStamp()} 🚫 player hidden: ${data.name}`);
        }
    }).bindListener();

    new Listener("return lobby vote start", (data) => {
        if (autoVoteLobby) {
            setTimeout(() => {
                quiz.returnVoteController.buttonSelected(quiz.returnVoteController.$VOTE_YES_BUTTON);
                quiz.returnVoteController.vote(true);
            }, 100);
        }
    }).bindListener();

    new Listener("return lobby vote result", (data) => {
        if (data.passed) {
            if (autoDownloadJson.includes("all") ||
                (autoDownloadJson.includes("solo") && quiz.soloMode) ||
                (autoDownloadJson.includes("ranked") && isQuizOfTheDay()) ||
                (autoDownloadJson.includes("tour") && hostModal.$roomName.val().toLowerCase().includes("tour"))) {
                $("#shHistoryTab").trigger("click");
                setTimeout(() => {
                    popoutMessage("Auto Download JSON", $(".shGameTitleInner").first().text().trim());
                    $(".shGameTitleInner .shGameDownloadIcon").first().trigger("click");
                }, 100);
            }
        }
    }).bindListener();

    new Listener("quiz end result", (data) => {
        if (alerts.quizEnd.console) {
            let text = `${getTimeStamp()} ${quiz.gameMode} Quiz End Result:`;
            const sortedEntries = Object.values(quiz.scoreboard.playerEntries).sort((a, b) => b.currentScore - a.currentScore);
            for (const entry of sortedEntries) {
                text += `\n${entry.name}: ${entry.currentScore}`;
            }
            console.log(text);
        }
        if (autoDownloadJson.includes("all") ||
            (autoDownloadJson.includes("solo") && quiz.soloMode) ||
            (autoDownloadJson.includes("ranked") && isQuizOfTheDay()) ||
            (autoDownloadJson.includes("tour") && hostModal.$roomName.val().toLowerCase().includes("tour"))) {
            $("#shHistoryTab").trigger("click");
            setTimeout(() => {
                const $title = $(".shGameTitleInner").first();
                popoutMessage("Auto Download JSON", $title.text().trim());
                $title.find(".shGameDownloadIcon").trigger("click");
            }, 100);
        }
    }).bindListener();

    new Listener("quiz over", (data) => {
        resetCommandRoom();
        scheduleCommandRoomAction(() => {
            checkAutoHost();
            checkAutoSwitch();
            if (hidePlayers) lobbyHidePlayers();
        }, 0);
    }).bindListener();
}

// Handle invites and friend changes using the current automation preferences
function bindCommandSocialListeners() {
    new Listener("game invite", (data) => {
        if (autoAcceptInvite && !inRoom() && checkAutoInvite(data.sender)) {
            roomBrowser.fireSpectateGame(data.gameId, undefined, true);
        }
    }).bindListener();

    new Listener("nexus game invite", (data) => {
        if (autoAcceptInvite && !inRoom() && checkAutoInvite(data.sender)) {
            socket.sendCommand({ type: "nexus", command: "join dungeon lobby", data: { lobbyId: data.lobbyId } });
        }
    }).bindListener();

    new Listener("friend state change", (data) => {
        if (alerts.onlineFriends.popout && data.online) {
            popoutMessage(`${data.name} online`, "");
        }
        else if (alerts.offlineFriends.popout && !data.online) {
            popoutMessage(`${data.name} offline`, "");
        }
        if (data.online && autoInvite === data.name.toLowerCase() && inRoom() && !isInYourRoom(autoInvite) && !isSoloMode() && !isQuizOfTheDay()) {
            sendSystemMessage(`${data.name} online: auto inviting`);
            scheduleCommandRoomAction(() => {
                if (
                    autoInvite === data.name.toLowerCase()
                    && Object.hasOwn(socialTab.onlineFriends, data.name)
                    && inRoom()
                    && !isInYourRoom(autoInvite)
                    && !isSoloMode()
                    && !isQuizOfTheDay()
                ) {
                    socket.sendCommand({ type: "social", command: "invite to game", data: { target: data.name } });
                }
            }, 1000);
        }
        else if (alerts.onlineFriends.chat && data.online) {
            sendSystemMessage(`${data.name} online`);
        }
        else if (alerts.offlineFriends.chat && !data.online) {
            sendSystemMessage(`${data.name} offline`);
        }
        if (alerts.onlineFriends.console && data.online) {
            console.log(`${getTimeStamp()} 🟢 ${data.name} online`);
        }
        else if (alerts.offlineFriends.console && !data.online) {
            console.log(`${getTimeStamp()} 🔴 ${data.name} offline`);
        }
    }).bindListener();

    new Listener("friend name change", (data) => {
        if (alerts.nameChange.popout) {
            popoutMessage("friend name change", `${data.oldName} => ${data.newName}`);
        }
        if (alerts.nameChange.chat) {
            sendSystemMessage(`friend name change: ${data.oldName} => ${data.newName}`);
        }
        if (alerts.nameChange.console) {
            console.log(`${getTimeStamp()} friend name change: ${data.oldName} => ${data.newName}`);
        }
    }).bindListener();
}

// Recheck Nexus host automation when the co-op party changes
function bindCommandNexusListeners() {
    new Listener("nexus lobby host change", (data) => {
        scheduleCommandRoomAction(() => { checkAutoHost() }, 0);
    }).bindListener();

    new Listener("new nexus player", (data) => {
        scheduleCommandRoomAction(() => { checkAutoHost() }, 0);
    }).bindListener();

    new Listener("nexus player leave", (data) => {
        scheduleCommandRoomAction(() => { checkAutoHost() }, 0);
    }).bindListener();
}

// Maintain autocomplete names and deliver configured server notifications
function bindCommandNotificationListeners() {
    new Listener("get all song names", (data) => {
        animeListLower = data.names.map(x => x.toLowerCase());
    }).bindListener();

    new Listener("update all song names", (data) => {
        if (data.deleted.length) {
            const deletedLower = data.deleted.map(x => x.toLowerCase());
            animeListLower = animeListLower.filter(name => !deletedLower.includes(name));
        }
        if (data.new.length) {
            const newLower = data.new.map(x => x.toLowerCase());
            animeListLower.push(...newLower);
        }
    }).bindListener();

    new Listener("popout message", (data) => {
        if (data.header?.key?.includes("quiz_of_the_day")) {
            if (alerts.rankedStarting.console) {
                const header = localizationHandler.translate(data.header.key, data.header.data, true);
                const message = localizationHandler.translate(data.message.key, data.message.data, true);
                console.log(`${getTimeStamp()} 📢 ${header}   ${message}`);
            }
        }
    }).bindListener();

    new Listener("new donation", (data) => {
        if (alerts.donation.console) {
            console.log(`${getTimeStamp()} 📢 ${data.donation.username} donated $${data.donation.amount} for ${data.donation.avatarName}`);
        }
    }).bindListener();

    new Listener("server restart", (data) => {
        if (alerts.serverStatus.console) {
            console.log(`${getTimeStamp()} 📢 ${data.msg}`);
        }
    }).bindListener();

    new Listener("server state change", (data) => {
        if (alerts.serverStatus.chat) {
            sendSystemMessage(`Server Status: ${data.name} ${data.online ? "online" : "offline"}`);
        }
        if (alerts.serverStatus.popout) {
            popoutMessage("Server Status", `${data.name} ${data.online ? "online" : "offline"}`);
        }
        if (alerts.serverStatus.console) {
            console.log(`${getTimeStamp()} Server Status: ${data.name} ${data.online ? "online" : "offline"}`);
        }
    }).bindListener();
}

// Connect answer inputs, loot popovers, and profile button behavior
function bindCommandInputs() {
    // Monitor the answer input box
    $("#qpAnswerInput").on("input", (event) => {
        if (autoKey) {
            socket.sendCommand({
                type: "quiz",
                command: "quiz answer",
                data: { answer: event.target.value || " " }
            });
            if (autoShareAnswer && !isQuizOfTheDay()) {
                sendMessage(event.target.value, "chat");
            }
        }
    }).on("keypress", (event) => {
        if (event.key === "Enter") {
            if (muteSubmit) setCommandMuteReason("submit", true);
            if (coopPaste && !isQuizOfTheDay()) {
                sendMessage(coopPrefix + event.target.value, "chat");
            }
            if (autoShareAnswer && !isQuizOfTheDay()) {
                sendMessage(event.target.value, "chat");
            }
        }
    });

    // Monitor the multiple choice container
    $("#qpMultipleChoiceContainer").on("click", (event) => {
        if (event.target.classList.contains("qpMultipleChoiceEntryText")) {
            if (muteSubmit) setCommandMuteReason("submit", true);
            if (coopPaste && !isQuizOfTheDay()) {
                sendMessage(coopPrefix + event.target.textContent, "chat");
            }
            if (autoShareAnswer && !isQuizOfTheDay()) {
                sendMessage(event.target.textContent, "chat");
            }
        }
    });

    // Battle royale popovers
    $("#brMap").on("keypress", (event) => {
        if (event.key === " " && printLoot && battleRoyal.inView) {
            $("#brMapContent .brMapObject").popover($(".popover").length ? "hide" : "show");
        }
    });

    // Enable all buttons in player profile
    new MutationObserver(function () {
        if (enableAllProfileButtons) {
            $("#playerProfileLayer .ppFooterOptionIcon").removeClass("disabled");
        }
    }).observe(document.querySelector("#playerProfileLayer"), { childList: true });
}

// Restore the saved room destination and clear one-time navigation
function joinStartupRoom() {
    const destination = autoJoinRoom;
    if (!destination) return;
    joinSavedCommandRoom(destination);
    if (destination.temp) {
        autoJoinRoom = false;
        saveSettings();
    }
}

// Dispatch a saved destination after the room listeners and UI are ready
function joinSavedCommandRoom(destination) {
    if (destination.rejoin) {
        $(".swal2-container button.swal2-confirm").click();
        return;
    }
    switch (destination.type) {
        case "solo":
            hostModal.changeSettings(destination.settings);
            hostModal.soloMode = true;
            setTimeout(() => { roomBrowser.host(); }, 1);
            return;
        case "ranked novice":
            joinRanked("NOVICE");
            return;
        case "ranked expert":
        case "themed":
            joinRanked("EXPERT");
            return;
        case "jam":
            roomBrowser.fireJoinJamGame();
            return;
        case "multiplayer":
            if (destination.joinAsPlayer) {
                roomBrowser.fireJoinLobby(destination.id, destination.password);
            }
            else {
                roomBrowser.fireSpectateGame(destination.id, destination.password);
            }
            return;
        case "nexus coop":
            if (destination.id) {
                socket.sendCommand({ type: "nexus", command: "join dungeon lobby", data: { lobbyId: destination.id } });
            }
            else {
                socket.sendCommand({ type: "nexus", command: "setup dungeon lobby", data: { typeId: 1, coop: true } });
            }
            return;
        case "nexus solo":
            socket.sendCommand({ type: "nexus", command: "setup dungeon lobby", data: { typeId: 1, coop: false } });
    }
}

// Register script information and its command-window shortcut
function registerCommandScript() {
    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        version: GM_info.script.version,
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

    $("#mcScriptDataHelpButton").on("click", () => {
        switchTab("mcDocumentation");
        $("#installedModal").modal("hide");
        $("#mcSettingsModal").modal("show");
    });
}

// Apply styles
function applyStyles() {
    let css = /*css*/ `
        #mcActiveContainer {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .mcActiveRow {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }
        .mcActiveTitle {
            flex-shrink: 0;
        }
        #mcActiveContainer .mcActiveButton {
            flex: 0 0 36px;
            width: 36px;
            height: 26px;
            padding: 0;
            border: none;
            border-radius: 2px;
            background-color: #d9534f;
            box-shadow: none;
            font: inherit;
            font-weight: bold;
            color: #ffffff;
            line-height: 1.4;
            cursor: pointer;
        }
        #mcActiveContainer .mcActiveButton:hover {
            opacity: 0.65;
        }
        #mcActiveContainer .mcActiveButtonEnabled {
            background-color: #5cb85c;
        }
        .mcActiveInfo {
            flex-shrink: 0;
        }
        .mcActiveRow select, .mcActiveRow input {
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
        #mcHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
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
        .mcAlertSummaryTable {
            border-collapse: collapse;
            text-align: left;
        }
        .mcAlertSummaryTable th {
            padding: 2px 8px;
            border-bottom: 1px solid #ccc;
        }
        .mcAlertSummaryTable td {
            padding: 2px 8px;
        }
        .mcAlertSummaryTable .mcAlertSummaryBool {
            text-align: center;
        }
        #mcSettingsModal > .modal-dialog {
            max-width: calc(100vw - 20px);
        }
        #mcOrderContainer {
            margin: 10px 0;
        }
        .mcOrderEditors {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }
        .mcOrderPanel {
            min-width: 0;
        }
        .mcOrderPanel h4 {
            margin: 4px 0 8px;
        }
        .mcOrderHelp {
            opacity: 0.75;
            font-size: 12px;
            margin: 10px 0;
        }
        .mcOrderToolbar, .mcOrderToggle {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .mcOrderToolbar {
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        .mcOrderToggle {
            margin-right: auto;
        }
        .mcOrderToggle > label {
            margin: 0;
            font-size: 12px;
            font-weight: normal;
            cursor: pointer;
        }
        .mcOrderToggle .customCheckbox {
            flex-shrink: 0;
        }
        .mcOrderAction, .mcOrderHandle {
            color: inherit;
            background: transparent;
            border: 1px solid #6d6d6d;
            border-radius: 0;
            cursor: pointer;
        }
        .mcOrderAction {
            padding: 3px 7px;
            font-size: 12px;
        }
        .mcOrderAction:hover, .mcOrderHandle:hover {
            background: rgba(255, 255, 255, 0.12);
        }
        .mcOrderAction:focus-visible, .mcOrderHandle:focus-visible {
            outline: 2px solid #80c7ff;
            outline-offset: 2px;
        }
        .mcOrderList {
            list-style: none;
            padding: 0;
            margin: 0;
            min-height: 26px;
            display: flex;
            flex-direction: column;
        }
        .mcOrderItem {
            box-sizing: border-box;
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 26px;
            padding: 0 4px;
        }
        .mcOrderHandle {
            box-sizing: border-box;
            font-size: 16px;
            width: 22px;
            height: 22px;
            padding: 0;
            flex-shrink: 0;
            cursor: grab;
            border: none;
        }
        .mcOrderPosition {
            min-width: 16px;
            text-align: center;
            opacity: 0.6;
            font-size: 12px;
            font-variant-numeric: tabular-nums;
        }
        .mcOrderIcon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            flex-shrink: 0;
            pointer-events: none;
        }
        .mcOrderIcon > i {
            font-size: 16px;
            line-height: 1;
            margin: 0;
            float: none;
        }
        .mcOrderIcon > svg, .mcOrderIcon > img {
            width: 16px;
            height: 16px;
            margin: 0;
            object-fit: contain;
        }
        .mcOrderLabel {
            flex: 1;
            min-width: 0;
            overflow-wrap: anywhere;
        }
        .mcOrderDragging {
            opacity: 0.35;
        }
        .mcOrderDraggingList {
            outline: 1px dashed rgba(128, 199, 255, 0.65);
            outline-offset: 3px;
        }
        @media (max-width: 650px) {
            .mcOrderEditors {
                grid-template-columns: minmax(0, 1fr);
            }
        }
        #mcDocumentationContainer pre {
            background-color: inherit;
            color: inherit;
            border: 0;
            margin: 0;
            padding: 0;
        }
        #mcStorageList li i.fa-caret-right, #mcStorageList li i.fa-caret-down {
            font-size: 20px;
        }
        #mcStorageList li span.name {
            margin-left: 10px;
        }
        #mcStorageList li span.size {
            margin-left: 10px;
            opacity: .5;
        }
        #mcStorageList li i.fa-trash {
            margin-left: 10px;
        }
        #mcStorageList li i.fa-trash:hover {
            color: #d9534f;
        }
        #mcStorageList pre {
            color: inherit;
            background-color: inherit;
            border: 0;
            border-radius: 0;
            font-size: 13px;
            margin: 0;
            padding: 0;
            opacity: .8;
        }
    `;
    if (backgroundURL) css += `
        #loadingScreen, #gameContainer {
            background-image: url("${backgroundURL}");
        }
        #gameChatPage .col-xs-9 {
            background-image: none;
        }
    `;
    if (hidePlayers) css += `
        .gcUserName:not(.self) {
            display: none;
        }
        .chatBadges:has(+ .gcUserName:not(.self)) {
            display: none;
        }
    `;
    if (videoBlur != null) css += `
        .qpVideoPlayer.blurVideo {
            filter: blur(${videoBlur}px);
        }
    `;
    if (videoCrop != null && videoScale != null) css += `
        .qpVideoPlayer.tinyVideo {
            clip-path: inset(${(100 - videoCrop) / 2}%);
            transform-origin: center center;
            transform: scale(${videoScale});
        }
    `;
    else if (videoCrop != null) css += `
        .qpVideoPlayer.tinyVideo {
            clip-path: inset(${(100 - videoCrop) / 2}%);
        }
    `;
    else if (videoScale != null) css += `
        .qpVideoPlayer.tinyVideo {
            transform-origin: center center;
            transform: scale(${videoScale});
        }
    `;
    if (videoCrop === 100) css += `
        .tinyModeVideoHider {
            clip-path: none;
            opacity: 0;
        }
    `;
    else if (videoCrop != null) {
        const a = (100 - videoCrop) / 2;
        const b = (100 + videoCrop) / 2;
        css += `
            .tinyModeVideoHider {
                clip-path: polygon(0% 0%, 0% 110%, ${a}% 110%, ${a}% ${a}%, ${b}% ${a}%, ${b}% ${b}%, ${a}% ${b}%, ${a}% 110%, 110% 110%, 110% 0%);
            }
        `;
    }
    let style = document.getElementById("megaCommandsStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "megaCommandsStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}

const helpText = `
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
/loot [size] [time]       change to looting mode with inventory size and looting time
/boss [lives] [powerups] [maxsongs]  change to boss mode
/hint                     change to hint mode
/year [low] [high]        change year filter
/season [text]            change season filter (winter, spring, summer, fall)
/ds                       reset to default settings

IN GAME/LOBBY
/autoskip                 automatically vote skip at the beginning of each song
/autoskip [seconds]       automatically vote skip after # of seconds
/autoskip valid           automatically vote skip after first valid team answer
/autokey                  automatically submit answer on each key press
/autothrow [text]         automatically send answer at the beginning of each song
/autocopy [name]          automatically copy a team member's answer
/automute [seconds]       automatically mute sound during quiz after # of seconds
/autounmute [seconds]     automatically unmute sound during quiz after # of seconds
/automutetoggle [list]    start unmuted and automatically toggle mute over a list of # of seconds
/automuterandom [time]    automatically mute a random time interval during guess phase
/autounmuterandom [time]  automatically unmute a random time interval during guess phase
/autohint [type]          automatically request a hint in hint mode
/autoready                automatically ready up in lobby
/autostart                automatically start the game when everyone is ready if you are host
/autopause                automatically pause the quiz when a player leaves or disconnects if you are host
/autohost [name]          automatically promote player to host if you are the current host
/autoinvite [name]        automatically invite a player to your room when they log in (only friends)
/autoaccept [option]      automatically accept game invites (options: friends, all)
/autolobby                automatically vote return to lobby when host starts a vote
/autojoin [id] [password] automatically join a room by ID
/autodownloadsong [text]  automatically download songs (options: mp3, video)
/autodownloadjson [text]  automatically download quiz JSON files (options: solo, ranked, tour)
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
/video speed [number]     change client-side song playback speed (0.0625 - 16)
/mutereplay               auto mute during the replay phase
/mutesubmit               auto mute after answer submit
/continuesample           continue sample after answer reveal instead of resetting
/loopvideo                loop the video when it ends
/reverse                  reverse audio playback
/pitch [multiplier]       pitch shift audio (disable with no value)
/alien [number]           set # of aliens for alien gamemode

OTHER
/roll                     roll number, player, teammate, playerteam, spectator
/shuffle [list]           shuffle a list of anything (separate with commas)
/startvote [list]         start a vote with a list of options (separate with commas)
/stopvote                 stop the vote and print results
/calc [expression]        calculate a math expression
/list [a|m|k|o] [name]    change anime list
/list off                 clear anime list
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
`;

startScript();
