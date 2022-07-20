// ==UserScript==
// @name        	AMQ Rule Script
// @namespace   	https://github.com/kempanator
// @version     	0.1
// @description 	send pastebin of game mode rules in AMQ chat, type /rules to see list
// @author      	kempanator
// @match       	https://animemusicquiz.com/*
// @grant       	none
// @require     	https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
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
                if (/^\/rules$/.test(message.message)) {
                    sendChatMessage(Object.keys(rules).join(", "));
                }
                if (/^\/rules .*$/.test(message.message)) {
                    let option = message.message.substring(7);
                    if (option in rules) sendChatMessage(rules[option]);
                }
                if (/^\/info$/.test(message.message)) {
                    sendChatMessage(Object.keys(info).join(", "));
                }
                if (/^\/info .*$/.test(message.message)) {
                    let option = message.message.substring(6);
                    if (option in info) sendChatMessage(info[option]);
                }
            }
        });
    }).bindListener();

    AMQ_addScriptData({
        name: "Rule Pastebins",
        author: "kempanator",
        description: `
            <p>Send pastebin of gamemode rules in chat</p>
            <p>example: /rules newgamemode</p>
            <p>type /rules for full list</p>
        `
    });
}

function sendChatMessage(message) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: {
            msg: message,
            teamMessage: false,
        },
    });
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
}

const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
}