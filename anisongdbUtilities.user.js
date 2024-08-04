// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.8
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
- auto play audio when you click the mp3 button for a song
- enable english titles on page load
- switch to advanced filters on page load
- force your json file name to match your search query
- press a hotkey to download json file
*/

"use strict";
const version = "0.8";
const saveData = validateLocalStorage("anisongdbUtilities");
const catboxHostDict = {1: "nl.catbox.video", 2: "ladist1.catbox.video", 3: "vhdist1.catbox.video"};
let catboxHost = saveData.catboxHost ?? "0";
if (!(catboxHost in catboxHostDict)) catboxHost = "0";
let autoPlayMP3 = saveData.autoPlayMP3 ?? true;
let jsonDownloadRename = saveData.jsonDownloadRename ?? true;
let jsonDownloadHotkey = saveData.jsonDownloadHotkey ?? {altKey: false, ctrlKey: true, key: "b"};
let hideAmqText = saveData.hideAmqText ?? false;
let defaultAdvanced = saveData.defaultAdvanced ?? false;
let defaultEnglish = saveData.defaultEnglish ?? false;
let loop = saveData.loop ?? "0"; //0:none, 1:repeat, 2:loop all
let volume = saveData.volume ?? .5;

let settingsModal;
let banner;
let languageButton;
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
    let key = Object.values(document.querySelector("app-root").attributes).map((x) => x.name).find((x) => x.startsWith("_nghost")).split("-")[1];
    banner = document.querySelector(`div[role="banner"]`);
    downloadJsonButton = document.querySelector("a.showFilter");
    toggleAdvancedButton = document.querySelector("span.showFilter");
    languageButton = document.querySelector(`label[title="Anime title displaying"]`);

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
    if (defaultEnglish) {
        languageButton.querySelector("span .left-span").click();
    }

    // create settings icon
    let i = document.createElement("i");
    i.setAttribute(`_ngcontent-${key}-c10`, "");
    i.classList.add("fa", "fa-cog");
    i.setAttribute("aria-hidden", "true");
    i.onclick = () => { toggleSettingsModal() };
    i.style.cursor = "pointer";
    i.style.fontSize = "28px";
    i.style.margin = "0 12px 0 0";
    banner.insertBefore(i, languageButton);

    // create catbox host select
    let hostSelect = document.createElement("select");
    hostSelect.style.margin = "0 12px 0 0";
    hostSelect.style.padding = "7px 3px";
    hostSelect.style.borderRadius = "5px";
    hostSelect.onchange = (event) => {
        catboxHost = event.target.value;
        saveSettings();
    }
    let dict = Object.assign({}, {0: "default link"}, catboxHostDict);
    for (let key of Object.keys(dict)) {
        let option = document.createElement("option");
        option.value = key;
        option.textContent = dict[key];
        hostSelect.appendChild(option);
    }
    hostSelect.value = catboxHost;
    banner.insertBefore(hostSelect, languageButton);

    // create song loop select
    let loopSelect = document.createElement("select");
    loopSelect.style.margin = "0 12px 0 0";
    loopSelect.style.padding = "7px 3px";
    loopSelect.style.borderRadius = "5px";
    loopSelect.onchange = (event) => {
        loop = event.target.value;
        saveSettings();
    }
    ["none", "repeat", "loop all"].forEach((x, i) => {
        let option = document.createElement("option");
        option.value = i;
        option.textContent = x;
        loopSelect.appendChild(option);
    });
    loopSelect.value = loop;
    banner.insertBefore(loopSelect, hostSelect);

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
            if (catboxHost !== "0" && document.querySelector("#myModal")) {
                let linkElement720 = document.querySelector("#modal-720-link");
                let linkElement480 = document.querySelector("#modal-480-link");
                let linkElementMP3 = document.querySelector("#modal-mp3-link");
                if (linkElement720) {
                    let newLink = linkElement720.href.replace(/^https:\/\/\w+\.catbox\.\w+/, "https://" + catboxHostDict[catboxHost]);
                    linkElement720.textContent = newLink;
                    linkElement720.href = newLink;
                    linkElement720.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
                if (linkElement480) {
                    let newLink = linkElement480.href.replace(/^https:\/\/\w+\.catbox\.\w+/, "https://" + catboxHostDict[catboxHost]);
                    linkElement480.textContent = newLink;
                    linkElement480.href = newLink;
                    linkElement480.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
                if (linkElementMP3) {
                    let newLink = linkElementMP3.href.replace(/^https:\/\/\w+\.catbox\.\w+/, "https://" + catboxHostDict[catboxHost]);
                    linkElementMP3.textContent = newLink;
                    linkElementMP3.href = newLink;
                    linkElementMP3.parentElement.querySelector("p").onclick = () => navigator.clipboard.writeText(newLink);
                }
            }
        }, 1)
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

    // watch audio player
    new MutationObserver(() => {
        let audioInterval = setInterval(() => {
            let audioElement = document.querySelector("audio");
            if (audioElement) {
                clearInterval(audioInterval);
                if (catboxHost !== "0") {
                    let oldLink = document.querySelector("audio source").src;
                    let newLink = oldLink.replace(/^https:\/\/\w+\.catbox\.\w+/, "https://" + catboxHostDict[catboxHost]);
                    if (oldLink !== newLink) {
                        let sourceElement = document.querySelector("audio source");
                        sourceElement.setAttribute("src", newLink);
                        sourceElement.setAttribute("data-vs", newLink);
                        audioElement.load();
                    }
                }
                if (autoPlayMP3) {
                    audioElement.addEventListener("canplay", function() {
                        if (volume >= 0 && volume <= 1) {
                            audioElement.volume = volume;
                        }
                        this.play();
                        audioElement.onended = function() {
                            if (loop === "1") {
                                this.play();
                            }
                            else if (loop === "2") {
                                let tdList = document.querySelectorAll(`td[title="Listen to mp3"]:has(i.fa-music)`);
                                let index = Array.from(tdList).findIndex(e => e.style.color === "rgb(226, 148, 4)");
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
                    });
                }
            }
        }, 10);
    }).observe(document.querySelector("#video-player"), {attributes: true});

    /*
    // watch table
    new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length) {
                //console.log(mutation.addedNodes[0]);
            }
        }
    }).observe(document.querySelector("#table"), {childList: true});
    */

    // create settings modal
    settingsModal = document.createElement("div");
    settingsModal.id = "auModal";
    settingsModal.style.display = "none";
    settingsModal.innerHTML = `
        <div class="modal-content">
            <h2 style="text-align: center;">AnisongDB Utilities Script Settings</h2>
            <p style="text-align: center;">By: kempanator<br>Version: ${version}<br><a href="https://github.com/kempanator/amq-scripts/blob/main/anisongdbUtilities.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js" target="_blank">Install</a></p>
            <p><label><input id="auHideTextCheckbox" type="checkbox">Hide AMQ text</label></p>
            <p><label><input id="auAutoPlayCheckbox" type="checkbox">Auto play mp3</label></p>
            <p><label><input id="auEnglishCheckbox" type="checkbox">English title by default</label></p>
            <p><label><input id="auAdvancedCheckbox" type="checkbox">Advanced view by default</label></p>
            <p><label><input id="auRenameJsonCheckbox" type="checkbox">Rename JSON to search input</label></p>
            <p><select id="auDownloadJsonSelect" style="padding: 5px 3px;"><option>ALT</option><option>CTRL</option><option>CTRL ALT</option><option>-</option></select><input id="auDownloadJsonInput" type="text" maxlength="1" style="width: 20px; margin: 0 5px; padding: 5px 3px">Download JSON</p>
            <p><input id="auVolumeInput" type="text" style="width: 40px; margin: 0 5px 0 0; padding: 5px 3px">Default Volume</p>
        </div>
    `;
    document.body.appendChild(settingsModal);

    let hideTextCheckbox = document.querySelector("#auHideTextCheckbox");
    let autoPlayCheckbox = document.querySelector("#auAutoPlayCheckbox");
    let englishCheckbox = document.querySelector("#auEnglishCheckbox");
    let advancedCheckbox = document.querySelector("#auAdvancedCheckbox");
    let renameJsonCheckbox = document.querySelector("#auRenameJsonCheckbox");
    let downloadJsonSelect = document.querySelector("#auDownloadJsonSelect");
    let downloadJsonInput = document.querySelector("#auDownloadJsonInput");
    let volumeInput = document.querySelector("#auVolumeInput");

    hideTextCheckbox.checked = hideAmqText;
    autoPlayCheckbox.checked = autoPlayMP3;
    englishCheckbox.checked = defaultEnglish;
    advancedCheckbox.checked = defaultAdvanced;
    renameJsonCheckbox.checked = jsonDownloadRename;
    if (jsonDownloadHotkey.altKey && jsonDownloadHotkey.ctrlKey) downloadJsonSelect.value = "CTRL ALT";
    else if (jsonDownloadHotkey.altKey) downloadJsonSelect.value = "ALT";
    else if (jsonDownloadHotkey.ctrlKey) downloadJsonSelect.value = "CTRL";
    else downloadJsonSelect.value = "-";
    downloadJsonInput.value = jsonDownloadHotkey.key;
    volumeInput.value = volume;

    hideTextCheckbox.onclick = () => {
        hideAmqText = !hideAmqText;
        let amqText = document.querySelector("app-search-bar h5");
        if (amqText && amqText.textContent.startsWith(" This database")) {
            amqText.style.display = hideAmqText ? "none" : "block";
        }
        saveSettings();
    }
    autoPlayCheckbox.onclick = () => {
        autoPlayMP3 = !autoPlayMP3;
        saveSettings();
    }
    englishCheckbox.onclick = () => {
        defaultEnglish = !defaultEnglish;
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
    downloadJsonSelect.onchange = (event) => {
        jsonDownloadHotkey.altKey = event.target.value.includes("ALT");
        jsonDownloadHotkey.ctrlKey = event.target.value.includes("CTRL");
        saveSettings();
    }
    downloadJsonInput.onchange = (event) => {
        jsonDownloadHotkey.key = event.target.value.toLowerCase();
        saveSettings();
    }
    volumeInput.onchange = (event) => {
        volume = parseFloat(event.target.value);
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
        autoPlayMP3,
        jsonDownloadRename,
        jsonDownloadHotkey,
        hideAmqText,
        defaultAdvanced,
        defaultEnglish,
        loop,
        volume
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
