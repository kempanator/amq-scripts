// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.4
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// ==/UserScript==

/*
Features:
- replace all links with different catbox host
- hide "This database is built upon the database of AMQ..."
- auto play audio when you click the mp3 button for a song
- enable english titles on page load
- switch to advanced filters on page load
- force your json file name to match your search query
- press a hotkey to download json file
*/

"use strict";
const version = "0.4";
const saveData = validateLocalStorage("anisongdbUtilities");
const catboxHostDict = {1: "files.catbox.moe", 2: "nl.catbox.moe", 3: "nl.catbox.video", 4: "ladist1.catbox.video", 5: "vhdist1.catbox.video"};
let catboxHost = saveData.catboxHost ?? "0";
if (!(catboxHost in catboxHostDict)) catboxHost = "0";
let autoPlayMP3 = saveData.autoPlayMP3 ?? true;
let jsonDownloadRename = saveData.jsonDownloadRename ?? true;
let jsonDownloadHotkey = saveData.jsonDownloadHotkey ?? {altKey: false, ctrlKey: true, key: "b"};
let hideAmqText = saveData.hideAmqText ?? false;
let defaultAdvanced = saveData.defaultAdvanced ?? false;
let defaultEnglish = saveData.defaultEnglish ?? false;

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
    i.onclick = () => { toggleSettingsModal(); };
    i.style.cursor = "pointer";
    i.style.fontSize = "28px";
    i.style.margin = "0 12px 0 0";
    banner.insertBefore(i, languageButton);
    
    // create catbox host select
    let select = document.createElement("select");
    select.style.margin = "0 12px 0 0";
    select.style.padding = "7px 3px";
    select.style.borderRadius = "5px";
    select.onchange = (event) => {
        catboxHost = event.target.value;
        saveSettings();
    }
    let dict = Object.assign({}, {0: "default link"}, catboxHostDict);
    for (let key of Object.keys(dict)) {
        let option = document.createElement("option");
        option.value = key;
        option.textContent = dict[key];
        select.appendChild(option);
    }
    select.value = catboxHost;
    banner.insertBefore(select, languageButton);

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
                    let newLink = linkElement720.href.replace(/^https:\/\/[a-z0-9]+\.catbox\.[a-z0-9]+/i, "https://" + catboxHostDict[catboxHost]);
                    linkElement720.textContent = newLink;
                    linkElement720.href = newLink;
                }
                if (linkElement480) {
                    let newLink = linkElement480.href.replace(/^https:\/\/[a-z0-9]+\.catbox\.[a-z0-9]+/i, "https://" + catboxHostDict[catboxHost]);
                    linkElement480.textContent = newLink;
                    linkElement480.href = newLink;
                }
                if (linkElementMP3) {
                    let newLink = linkElementMP3.href.replace(/^https:\/\/[a-z0-9]+\.catbox\.[a-z0-9]+/i, "https://" + catboxHostDict[catboxHost]);
                    linkElementMP3.textContent = newLink;
                    linkElementMP3.href = newLink;
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
            if (autoPlayMP3 && document.querySelector("audio")) {
                document.querySelector("audio").addEventListener("canplay", function() {
                    this.play();
                    clearInterval(audioInterval);
                });
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
            <p><select id="auDownloadJsonSelect" style="padding: 5px 3px;"><option>CTRL</option><option>ALT</option></select><input id="auDownloadJsonInput" type="text" maxlength="1" style="width: 20px; margin: 0 5px; padding: 5px 3px">Download JSON</p>
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

    hideTextCheckbox.checked = hideAmqText;
    autoPlayCheckbox.checked = autoPlayMP3;
    englishCheckbox.checked = defaultEnglish;
    advancedCheckbox.checked = defaultAdvanced;
    renameJsonCheckbox.checked = jsonDownloadRename;
    if (jsonDownloadHotkey.altKey) downloadJsonSelect.value = "ALT";
    else if (jsonDownloadHotkey.ctrlKey) downloadJsonSelect.value = "CTRL";
    downloadJsonInput.value = jsonDownloadHotkey.key;

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
        if (event.target.value === "ALT") {
            jsonDownloadHotkey.altKey = true;
            jsonDownloadHotkey.ctrlKey = false;
        }
        else if (event.target.value === "CTRL") {
            jsonDownloadHotkey.altKey = false;
            jsonDownloadHotkey.ctrlKey = true;
        }
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
        catboxHost: catboxHost,
        autoPlayMP3: autoPlayMP3,
        jsonDownloadRename: jsonDownloadRename,
        jsonDownloadHotkey: jsonDownloadHotkey,
        hideAmqText: hideAmqText,
        defaultAdvanced: defaultAdvanced,
        defaultEnglish: defaultEnglish
    };
    localStorage.setItem("anisongdbUtilities", JSON.stringify(settings));
}

// apply styles
function applyStyles() {
    //$("#anisongdbUtilitiesStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "megaCommandsStyle";
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
