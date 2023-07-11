// ==UserScript==
// @name         AMQ Play Button Shortcuts
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Add Solo, Multiplayer, Nexus shortcuts to the play button
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqPlayButtonShortcuts.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqPlayButtonShortcuts.user.js
// ==/UserScript==

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.1";
$("#mpPlayButton").removeAttr("data-toggle data-target").empty().append(`
    <div id="mpPlayButtonPlay" data-toggle="modal" data-target="#gameModeSelector">Play</div>
    <ul>
        <li class="clickAble gameModeShortcut" onclick="hostModal.displayHostSolo()">Solo</li>
        <li class="clickAble gameModeShortcut" onclick="viewChanger.changeView('roomBrowser')">Multiplayer</li>
        <li class="clickAble gameModeShortcut" onclick="viewChanger.changeView('nexus')">Nexus</li>
    </ul>
`);
applyStyles();

function setup() {
    AMQ_addScriptData({
        name: "Play Button Shortcuts",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <p>Add Solo, Multiplayer, Nexus shortcuts to the play button</p>
        `
    });
}

// apply styles
function applyStyles() {
    //$("#playButtonShortcutsStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "playButtonShortcutsStyle";
    style.appendChild(document.createTextNode(`
        #mpPlayButton {
            height: 120px;
        }
        #mpPlayButtonPlay {
            font-size: 50px;
        }
        #mpPlayButtonPlay:hover {
            color: #4497EA;
        }
        #mpPlayButton .gameModeShortcut {
            font-size: 25px;
            text-align: center;
            width: 33.33%;
            padding-top: 6px;
            float: left;
        }
        #mpPlayButton .gameModeShortcut:hover {
            color: #4497EA;
        }
    `));
    document.head.appendChild(style);
}
