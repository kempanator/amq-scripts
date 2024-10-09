// ==UserScript==
// @name         AMQ Catbox Host Switch
// @namespace    https://github.com/kempanator
// @version      0.14
// @description  Switch your catbox host
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCatboxHostSwitch.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCatboxHostSwitch.user.js
// ==/UserScript==

/*
Settings are located in: bottom right gear icon > settings > video hosts > catbox link

Features:
 - Modify all incoming catbox song links
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.14";
const saveData = validateLocalStorage("catboxHostSwitch");
const hostDict = {1: "eudist.animemusicquiz.com", 2: "nawdist.animemusicquiz.com", 3: "naedist.animemusicquiz.com"};
let catboxHost = parseInt(saveData.catboxHost);
if (!hostDict.hasOwnProperty(catboxHost)) catboxHost = 0;
let catboxDownFlagRaised = false;

//setup
function setup() {
    $("#settingsVideoHostsContainer .col-xs-6").first()
    .append($(`<h4>Catbox Link</h4>`))
    .append($(`<select id="chsSelect" class="form-control"><option value="0">default link</option><option value="1">eudist.animemusicquiz.com</option><option value="2">nawdist.animemusicquiz.com</option><option value="3">naedist.animemusicquiz.com</option></select>`).val(catboxHost).on("change", function() {
        catboxHost = parseInt(this.value);
        saveSettings();
    }));

    QuizVideoController.prototype.nextVideoInfo = function(songInfo, playLength, startPoint, firstVideo, startTime, playbackSpeed, fullSongRange, forceBuffering) {
        if (songInfo.videoMap.catbox) {
            catboxDownFlagRaised = false;
            if (catboxHost) {
                for (let key of Object.keys(songInfo.videoMap.catbox)) {
                    let url = songInfo.videoMap.catbox[key];
                    if (url) {
                        if (/^https:\/\/\w+\.animemusicquiz\.com\/\w+\.\w{3,4}$/i.test(url)) {
                            songInfo.videoMap.catbox[key] = url.replace(/^https:\/\/\w+\.animemusicquiz\.com/, `https://${hostDict[catboxHost]}`);
                        }
                        else if (/^\w+\.\w{3,4}$/i.test(url)) { //normal quiz
                            songInfo.videoMap.catbox[key] = `https://${hostDict[catboxHost]}/${url}`;
                        }
                        else if (/^\w+:\w+$/i.test(url)) { //encrypted lobby (ranked, event, tournament)
                            songInfo.videoMap.catbox[key] = `https://${hostDict[catboxHost]}/internals/dist.php?enc=${url}`;
                        }
                    }
                }
            }
        }
        /*else if (songInfo.videoMap.openingsmoe) {
            if (!catboxDownFlagRaised && options.getHostPriorityList()[0] === "catbox") {
                popoutMessages.displayPopoutMessage(`<h4 class="text-center">Catbox Host Switch</h4><h5 class="text-center">openings.moe link detected<br>catbox might be down</h5>`);
                catboxDownFlagRaised = true;
            }
        }*/
        this._nextVideoInfo = {
            songInfo: songInfo,
            playLength: playLength,
            startPoint: startPoint,
            playbackSpeed: playbackSpeed,
            firstVideo: firstVideo,
            startTime: startTime,
            fullSongRange: fullSongRange
        };
        if (forceBuffering) {
            this.loadNextVideo();
        }
        else if (firstVideo) {
            this.readyToBufferNextVideo = false;
        }
        else if (this.readyToBufferNextVideo) {
            this.loadNextVideo();
        }
    };

    applyStyles();
    AMQ_addScriptData({
        name: "Catbox Host Switch",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqCatboxHostSwitch.user.js",
        description: `
            <p>Modify all incoming catbox song links</p>
            <p>Alert when openingsmoe link is given instead of catbox</p>
            <p>Settings are located in: bottom right gear icon > settings > video hosts > catbox link</p>
        `
    });
}

// save settings
function saveSettings() {
    localStorage.setItem("catboxHostSwitch", JSON.stringify({catboxHost: catboxHost}));
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

// apply styles
function applyStyles() {
    //$("#catboxHostSwitchStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "catboxHostSwitchStyle";
    let text = `
        #chsSelect {
            width: 180px;
            padding: 6px 6px;
            margin: auto;
        }
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
