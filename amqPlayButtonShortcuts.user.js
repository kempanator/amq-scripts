// ==UserScript==
// @name         AMQ Play Button Shortcuts
// @namespace    https://github.com/kempanator
// @version      0.6
// @description  Add Solo, Multiplayer, Nexus shortcuts to the play button
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqPlayButtonShortcuts.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqPlayButtonShortcuts.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.6";
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
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqPlayButtonShortcuts.user.js",
        description: `
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
