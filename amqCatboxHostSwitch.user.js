// ==UserScript==
// @name         AMQ Catbox Host Switch
// @namespace    https://github.com/kempanator
// @version      0.3
// @description  Switch your catbox host
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/TheJoseph98/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCatboxHostSwitch.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCatboxHostSwitch.user.js
// ==/UserScript==

/*
Settings are located in: bottom right gear icon > settings > video hosts > catbox link

Features:
 - Modify all incoming catbox song links
 - Alert when openingsmoe link is given instead of catbox
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.3";
const saveData = validateLocalStorage("catboxHostSwitch");
const catboxHostDict = {0: "lb1.catbox.moe", 1: "files.catbox.moe", 2: "nl.catbox.moe", 3: "ladist1.catbox.video", 4: "abdist1.catbox.video", 5: "nl.catbox.video"};
let catboxHost = saveData.catboxHost ?? "0"; //0: default link, 1: files.catbox.moe, 2: nl.catbox.moe, 3: ladist1.catbox, 4: abdist1.catbox.video, 5: nl.catbox.video
let catboxDownFlagRaised = false;

//setup
function setup() {
    $("#settingsVideoHostsContainer .col-xs-6").first()
    .append($(`<h4>Catbox Link</h4>`))
    .append($(`<select id="chsSelect" class="form-control"><option value="0">default link</option><option value="1">files.catbox.moe</option><option value="2">nl.catbox.moe</option><option value="3">ladist1.catbox.video</option><option value="4">abdist1.catbox.video</option><option value="5">nl.catbox.video</option></select>`).val(catboxHost).on("change", function() {
        catboxHost = this.value;
        saveSettings();
    }));

    QuizVideoController.prototype.nextVideoInfo = function(songInfo, playLength, startPoint, firstVideo, startTime, playbackSpeed, fullSongRange) {
        //console.log({songInfo, playLength, startPoint, firstVideo, startTime, playbackSpeed, fullSongRange})
        if (songInfo.videoMap.catbox) {
            if (catboxHost !== "0") {
                for (let key of Object.keys(songInfo.videoMap.catbox)) {
                    let url = songInfo.videoMap.catbox[key];
                    if (url) {
                        if (url.startsWith("http")) {
                            songInfo.videoMap.catbox[key] = url.replace(/^https:\/\/[a-zA-Z0-9]+\.catbox\.[a-zA-Z0-9]+/, "https://" + catboxHostDict[catboxHost]);
                        }
                        else {
                            songInfo.videoMap.catbox[key] = `https://${catboxHostDict[catboxHost]}/${url}`;
                        }
                    }
                }
            }
        }
        else if (songInfo.videoMap.openingsmoe) {
            if (!catboxDownFlagRaised && options.getHostPriorityList()[0] === "catbox") {
                popoutMessages.displayStandardMessage("Openings.moe link detected", "catbox might be down");
                catboxDownFlagRaised = true;
            }
        }
        this._nextVideoInfo = {
            songInfo: songInfo,
            playLength: playLength,
            startPoint: startPoint,
            playbackSpeed: playbackSpeed,
            firstVideo: firstVideo,
            startTime: startTime,
            fullSongRange: fullSongRange
        };
        if (firstVideo) {
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
