// ==UserScript==
// @name        	AMQ Show Looted Shows
// @namespace   	https://github.com/kempanator
// @version     	0.1
// @description 	When the looting phase ends, send full list to chat (only visible to you)
// @author      	kempanator
// @match       	https://animemusicquiz.com/*
// @grant       	none
// @require     	https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL 	https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowLootedShows.js
// ==/UserScript==

if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    new Listener("battle royal phase over", (payload) => {
        if (!battleRoyal.isSpectator) {
            for (let item of document.querySelector("#brCollectedList").querySelectorAll("li")) {
                gameChat.systemMessage(item.innerText.substring(2));
            }
        }
    }).bindListener();
}
