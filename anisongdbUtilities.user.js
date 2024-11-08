// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.13
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// ==/UserScript==

/*
Features:
- loop songs in a radio playlist
- replace all links with different catbox host
- hide "This database is built upon the database of AMQ..."
- switch to advanced filters on page load
- force your json file name to match your search query
- press a hotkey to download json file
*/

"use strict";
const version = "0.13";
const saveData = validateLocalStorage("anisongdbUtilities");
const hostDict = {1: "eudist", 2: "nawdist", 3: "naedist"};
let catboxHost = parseInt(saveData.catboxHost);
if (!hostDict.hasOwnProperty(catboxHost)) catboxHost = 0;
let jsonDownloadRename = saveData.jsonDownloadRename ?? true;
let jsonDownloadHotkey = saveData.jsonDownloadHotkey ?? {altKey: false, ctrlKey: true, key: "b"};
let hideAmqText = saveData.hideAmqText ?? false;
let defaultAdvanced = saveData.defaultAdvanced ?? false;
let loop = parseInt(saveData.loop) || 0; //0:none, 1:repeat, 2:loop all

let settingsModal;
let banner;
let languageButton;
let composerButton;
let toggleAdvancedButton;
let downloadJsonButton;

let loadInterval = setInterval(() => {
    if (document.querySelector("#table")) {
        clearInterval(loadInterval);
        setup();
    }
}, 200);

// begin setup after the first table loads in
function setup() {
    applyStyles();
    let ngKey = Object.values(document.querySelector("app-root").attributes).map((x) => x.name).find((x) => x.startsWith("_nghost")).split("-")[2];
    banner = document.querySelector(`div[role="banner"]`);
    downloadJsonButton = document.querySelector("a.showFilter");
    toggleAdvancedButton = document.querySelector("span.showFilter");
    languageButton = document.querySelector(`label[title="Anime title displaying"]`);
    composerButton = document.querySelector(`label[title="Composer displaying"]`);

    // alter the page on load
    if (hideAmqText) {
        let amqTextElement = document.querySelector("app-search-bar h5");
        if (amqTextElement && amqTextElement.textContent.startsWith(" This database")) {
            amqTextElement.style.display = "none";
        }
    }
    if (defaultAdvanced) {
        if (toggleAdvancedButton) { //disappears during ranked
            toggleAdvancedButton.click();
        }
    }

    // create settings icon
    let i = document.createElement("i");
    i.setAttribute(`_ngcontent-ng-${ngKey}`, "");
    i.classList.add("fa", "fa-cog");
    i.setAttribute("aria-hidden", "true");
    i.onclick = () => { toggleSettingsModal() };
    i.style.cursor = "pointer";
    i.style.fontSize = "28px";
    i.style.margin = "0 18px 0 0";
    languageButton.insertAdjacentElement("afterend", i);

    // keyboard and mouse events
    document.body.addEventListener("keydown", (event) => {
        if (event.altKey === jsonDownloadHotkey.altKey && event.ctrlKey === jsonDownloadHotkey.ctrlKey && event.key === jsonDownloadHotkey.key) {
            downloadJsonButton.click();
        }
    });
    document.body.addEventListener("click", (event) => {
        if (event.target === settingsModal || event.target === banner) {
            toggleSettingsModal(false);
        }
        setTimeout(() => {
            if (catboxHost && document.querySelector("#myModal")) {
                let linkElement720 = document.querySelector("#modal-720-link");
                let linkElement480 = document.querySelector("#modal-480-link");
                let linkElementMP3 = document.querySelector("#modal-mp3-link");
                if (linkElement720) {
                    let newLink = linkElement720.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, `https://${hostDict[catboxHost]}.animemusicquiz.com`);
                    linkElement720.href = newLink;
                    linkElement720.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
                if (linkElement480) {
                    let newLink = linkElement480.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, `https://${hostDict[catboxHost]}.animemusicquiz.com`);
                    linkElement480.href = newLink;
                    linkElement480.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
                if (linkElementMP3) {
                    let newLink = linkElementMP3.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, `https://${hostDict[catboxHost]}.animemusicquiz.com`);
                    linkElementMP3.href = newLink;
                    linkElementMP3.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
            }
        }, 1)
        if (event.target.attributes.title?.value === "Listen to mp3") {
            setTimeout(() => {
                let audio = document.querySelector("audio");
                audio.onended = function() {
                    if (loop === 1) {
                        this.play();
                    }
                    else if (loop === 2) {
                        let tdList = document.querySelectorAll("i.fa-music");
                        let index = Array.from(tdList).findIndex(e => getComputedStyle(e).color === "rgb(226, 148, 4)");
                        if (index >= 0) {
                            if (index === tdList.length - 1) {
                                tdList[0].click();
                            }
                            else {
                                tdList[index + 1].click();
                            }
                        }
                    }
                };
            }, 1);
        }
    });
    downloadJsonButton.addEventListener("click", function() {
        if (jsonDownloadRename) {
            let name;
            for (let input of document.querySelectorAll(`input.textInputFilter[placeholder*="Search"]`)) {
                if (input.value !== "") {
                    name = input.value;
                    break;
                }
            }
            this.setAttribute("download", name + ".json");
        }
    });

    // create settings modal
    settingsModal = document.createElement("div");
    settingsModal.id = "auModal";
    settingsModal.style.display = "none";
    settingsModal.innerHTML = `
        <div class="modal-content">
            <h2 style="text-align: center;">AnisongDB Utilities Script Settings</h2>
            <p style="text-align: center;">By: kempanator<br>Version: ${version}<br><a href="https://github.com/kempanator/amq-scripts/blob/main/anisongdbUtilities.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js" target="_blank">Install</a></p>
            <p><label><input id="auHideTextCheckbox" type="checkbox">Hide AMQ text</label></p>
            <p><label><input id="auAdvancedCheckbox" type="checkbox">Advanced view by default</label></p>
            <p><label><input id="auRenameJsonCheckbox" type="checkbox">Rename JSON to search input</label></p>
            <p><select id="auRadioSelect" style="margin-right: 5px; padding: 5px 3px;"><option value="0">none</option><option value="1">repeat</option><option value="2">loop all</option></select>Radio loop mode</p>
            <p><select id="auHostChangeSelect" style="margin-right: 5px; padding: 5px 3px;"><option value="0">default</option><option value="1">eudist</option><option value="2">nawdist</option><option value="3">naedist</option></select>Change host</p>
            <p><select id="auDownloadJsonSelect" style="padding: 5px 3px;"><option>ALT</option><option>CTRL</option><option>CTRL ALT</option><option>-</option></select><input id="auDownloadJsonInput" type="text" maxlength="1" style="width: 20px; margin: 0 5px; padding: 5px 3px">Download JSON</p>
        </div>
    `;
    document.body.appendChild(settingsModal);

    let hideTextCheckbox = document.querySelector("#auHideTextCheckbox");
    let advancedCheckbox = document.querySelector("#auAdvancedCheckbox");
    let renameJsonCheckbox = document.querySelector("#auRenameJsonCheckbox");
    let radioSelect = document.querySelector("#auRadioSelect");
    let hostChangeSelect = document.querySelector("#auHostChangeSelect");
    let downloadJsonSelect = document.querySelector("#auDownloadJsonSelect");
    let downloadJsonInput = document.querySelector("#auDownloadJsonInput");

    hideTextCheckbox.checked = hideAmqText;
    advancedCheckbox.checked = defaultAdvanced;
    renameJsonCheckbox.checked = jsonDownloadRename;
    radioSelect.value = loop;
    hostChangeSelect.value = catboxHost;
    if (jsonDownloadHotkey.altKey && jsonDownloadHotkey.ctrlKey) downloadJsonSelect.value = "CTRL ALT";
    else if (jsonDownloadHotkey.altKey) downloadJsonSelect.value = "ALT";
    else if (jsonDownloadHotkey.ctrlKey) downloadJsonSelect.value = "CTRL";
    else downloadJsonSelect.value = "-";
    downloadJsonInput.value = jsonDownloadHotkey.key;

    hideTextCheckbox.onclick = () => {
        hideAmqText = !hideAmqText;
        let amqText = document.querySelector("app-search-bar h5");
        if (amqText && amqText.textContent.startsWith(" This database")) {
            amqText.style.display = hideAmqText ? "none" : "block";
        }
        saveSettings();
    }
    advancedCheckbox.onclick = () => {
        defaultAdvanced = !defaultAdvanced;
        saveSettings();
    }
    renameJsonCheckbox.onclick = () => {
        jsonDownloadRename = !jsonDownloadRename;
        saveSettings();
    }
    radioSelect.onchange = (event) => {
        loop = parseInt(event.target.value);
        saveSettings();
    }
    hostChangeSelect.onchange = (event) => {
        catboxHost = parseInt(event.target.value);
        saveSettings();
    }
    downloadJsonSelect.onchange = (event) => {
        jsonDownloadHotkey.altKey = event.target.value.includes("ALT");
        jsonDownloadHotkey.ctrlKey = event.target.value.includes("CTRL");
        saveSettings();
    }
    downloadJsonInput.onchange = (event) => {
        jsonDownloadHotkey.key = event.target.value.toLowerCase();
        saveSettings();
    }
}

// toggle settings modal or input boolean to force state
function toggleSettingsModal(option) {
    if (option === undefined) {
        if (settingsModal.style.display === "none") {
            settingsModal.style.display = "block";
        }
        else {
            settingsModal.style.display = "none";
        }
    }
    else {
        if (option) {
            settingsModal.style.display = "block";
        }
        else {
            settingsModal.style.display = "none";
        }
    }
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

// save settings
function saveSettings() {
    let settings = {
        catboxHost,
        jsonDownloadRename,
        jsonDownloadHotkey,
        hideAmqText,
        defaultAdvanced,
        loop,
    };
    localStorage.setItem("anisongdbUtilities", JSON.stringify(settings));
}

// apply styles
function applyStyles() {
    //$("#anisongdbUtilitiesStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "anisongdbUtilitiesStyle";
    let text = `
        #auModal {
            background-color: #00000070;
            width: 100%;
            height: 100%;
            padding-top: 100px;
            left: 0;
            top: 0;
            position: fixed;
            z-index: 1;
            overflow: auto;
        }
        #auModal .modal-content {
            background-color: var(--background);
            border: 3px solid #888888;
            width: 800px;
            margin: auto;
            padding: 20px;
        }
        #auModal a {
            color: white;
            font-weight: bold;
        }
        #auModal a:hover {
            opacity: .7;
        }
        #auModal input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin: 0 7px 0 0;
            vertical-align: -4px;
        }
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
