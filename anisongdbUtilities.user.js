// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.16
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
const saveData = validateLocalStorage("anisongdbUtilities");
const hostDict = { 1: "eudist", 2: "nawdist", 3: "naedist" };
let catboxHost = parseInt(saveData.catboxHost);
if (!hostDict.hasOwnProperty(catboxHost)) catboxHost = 0;
let jsonDownloadRename = saveData.jsonDownloadRename ?? true;
let hideAmqText = saveData.hideAmqText ?? false;
let defaultAdvanced = saveData.defaultAdvanced ?? false;
let loop = parseInt(saveData.loop) || 0; //0:none, 1:repeat, 2:loop all
let hotKeys = {
    downloadJson: loadHotkey("downloadJson", "B", true, false, false),
    prevSong: loadHotkey("prevSong"),
    nextSong: loadHotkey("nextSong")
};

let settingsModal;
let banner;
let languageButton;
let composerButton;
let toggleAdvancedButton;
let downloadJsonButton;

const loadInterval = setInterval(() => {
    if (document.querySelector("#table")) {
        clearInterval(loadInterval);
        setup();
    }
}, 200);

// begin setup after the first table loads in
function setup() {
    applyStyles();
    const ngId = Object.values(document.querySelector("app-root").attributes).map((x) => x.name).find((x) => x.startsWith("_nghost")).split("-")[2];
    banner = document.querySelector(`div[role="banner"]`);
    downloadJsonButton = document.querySelector("a.showFilter");
    toggleAdvancedButton = document.querySelector("span.showFilter");
    languageButton = document.querySelector(`label[title="Anime title displaying"]`);
    composerButton = document.querySelector(`label[title="Composer displaying"]`);

    // alter the page on load
    if (hideAmqText) {
        const amqTextElement = document.querySelector("app-search-bar h5");
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
    const i = document.createElement("i");
    i.setAttribute(`_ngcontent-ng-${ngId}`, "");
    i.setAttribute("aria-hidden", "true");
    i.onclick = () => { toggleSettingsModal() };
    i.classList.add("fa", "fa-cog");
    i.style.cursor = "pointer";
    i.style.fontSize = "28px";
    i.style.margin = "0 18px 0 0";
    languageButton.insertAdjacentElement("afterend", i);

    // define hotkey actions
    const hotkeyActions = {
        downloadJson: () => {
            downloadJsonButton.click();
        },
        prevSong: () => {
            stepSong(-1);
        },
        nextSong: () => {
            stepSong(1);
        }
    };

    // keyboard and mouse events
    document.addEventListener("keydown", (event) => {
        const key = event.key.toUpperCase();
        const ctrl = event.ctrlKey;
        const alt = event.altKey;
        const shift = event.shiftKey;
        const match = (b) => {
            if (!b.key) return false;
            if (key !== b.key) return false;
            if (ctrl !== b.ctrl) return false;
            if (alt !== b.alt) return false;
            if (shift !== b.shift) return false;
            return true;
        }
        for (const [action, bind] of Object.entries(hotKeys)) {
            if (match(bind)) {
                event.preventDefault();
                hotkeyActions[action]();
            }
        }
    });
    document.addEventListener("click", (event) => {
        if (event.target === settingsModal || event.target === banner) {
            toggleSettingsModal(false);
        }
        setTimeout(() => {
            if (catboxHost && document.querySelector("#myModal")) {
                const link720 = document.querySelector("#modal-720-link");
                const link480 = document.querySelector("#modal-480-link");
                const linkMP3 = document.querySelector("#modal-mp3-link");
                const text = `https://${hostDict[catboxHost]}.animemusicquiz.com`;
                if (link720) {
                    const newLink = link720.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, text);
                    link720.href = newLink;
                    link720.parentElement.querySelector("p").onclick = () => {
                        navigator.clipboard.writeText(newLink);
                    }
                }
                if (link480) {
                    const newLink = link480.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, text);
                    link480.href = newLink;
                    link480.parentElement.querySelector("p").onclick = () => {
                        navigator.clipboard.writeText(newLink);
                    }
                }
                if (linkMP3) {
                    const newLink = linkMP3.href.replace(/^https:\/\/\w+\.animemusicquiz\.com/, text);
                    linkMP3.href = newLink;
                    linkMP3.parentElement.querySelector("p").onclick = () => {
                        navigator.clipboard.writeText(newLink);
                    }
                }
            }
        }, 1)
        if (event.target.attributes.title?.value === "Listen to mp3") {
            setTimeout(() => {
                const audio = document.querySelector("audio");
                audio.onended = function () {
                    if (loop === 1) {
                        this.play();
                    }
                    else if (loop === 2) {
                        stepSong(1);
                    }
                };
            }, 1);
        }
    });
    downloadJsonButton.addEventListener("click", () => {
        if (jsonDownloadRename) {
            const inputs = document.querySelectorAll('input.textInputFilter[placeholder*="Search"]');
            const found = Array.from(inputs).find(e => e.value !== "");
            const name = found?.value || "anisongdb";
            downloadJsonButton.setAttribute("download", name + ".json");
        }
    });

    // step through song list by certain amount
    function stepSong(amount) {
        const tdList = document.querySelectorAll("i.fa-music");
        const len = tdList.length;
        if (!len) return;
        const index = Array.from(tdList).findIndex(e => getComputedStyle(e).color === "rgb(226, 148, 4)");
        const newIndex = index === -1 ? 0 : (((index + amount) % len) + len) % len;
        tdList[newIndex].click();
    }

    // create settings modal
    settingsModal = document.createElement("div");
    settingsModal.id = "auModal";
    settingsModal.style.display = "none";
    settingsModal.innerHTML = /*html*/`
        <div class="modal-content">
            <h2 style="text-align: center;">AnisongDB Utilities Script Settings</h2>
            <p style="text-align: center;">By: kempanator<br>Version: ${GM_info.script.version}<br><a href="https://github.com/kempanator/amq-scripts/blob/main/anisongdbUtilities.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js" target="_blank">Install</a></p>
            <p><label><input id="auHideTextCheckbox" type="checkbox">Hide AMQ text</label></p>
            <p><label><input id="auAdvancedCheckbox" type="checkbox">Advanced view by default</label></p>
            <p><label><input id="auRenameJsonCheckbox" type="checkbox">Rename JSON to search input</label></p>
            <p><select id="auRadioSelect" style="margin-right: 5px; padding: 4px 2px;"><option value="0">none</option><option value="1">repeat</option><option value="2">loop all</option></select>Radio loop mode</p>
            <p><select id="auHostChangeSelect" style="margin-right: 5px; padding: 4px 2px;"><option value="0">default</option><option value="1">eudist</option><option value="2">nawdist</option><option value="3">naedist</option></select>Change host</p>
            <table id="auHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>
        </div>
    `;
    document.body.append(settingsModal);

    const hideTextCheckbox = document.querySelector("#auHideTextCheckbox");
    const advancedCheckbox = document.querySelector("#auAdvancedCheckbox");
    const renameJsonCheckbox = document.querySelector("#auRenameJsonCheckbox");
    const radioSelect = document.querySelector("#auRadioSelect");
    const hostChangeSelect = document.querySelector("#auHostChangeSelect");

    hideTextCheckbox.checked = hideAmqText;
    advancedCheckbox.checked = defaultAdvanced;
    renameJsonCheckbox.checked = jsonDownloadRename;
    radioSelect.value = loop;
    hostChangeSelect.value = catboxHost;

    hideTextCheckbox.onclick = () => {
        hideAmqText = !hideAmqText;
        const amqText = document.querySelector("app-search-bar h5");
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

    createHotkeyTable([
        { action: "downloadJson", title: "Download JSON" },
        { action: "prevSong", title: "Previous Song" },
        { action: "nextSong", title: "Next Song" },
    ]);
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

// load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false) {
    const item = saveData.hotKeys?.[action];
    return {
        key: (item?.key ?? key).toUpperCase(),
        ctrl: item?.ctrl ?? item?.ctrlKey ?? ctrl,
        alt: item?.alt ?? item?.altKey ?? alt,
        shift: item?.shift ?? item?.shiftKey ?? shift
    }
}

// create hotkey rows and add to table
function createHotkeyTable(data) {
    const tbody = document.querySelector("#auHotkeyTable tbody");
    if (!tbody) return;
    data.forEach(({ action, title }) => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "hk-input";
        input.readOnly = true;
        input.dataset.action = action;
        input.value = bindingToText(hotKeys[action]);
        input.addEventListener("click", startHotkeyRecord);
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        td1.textContent = title;
        td2.append(input);
        tr.append(td1, td2);
        tbody.append(tr);
    });
}

// begin hotkey capture on click
function startHotkeyRecord(event) {
    const input = event.currentTarget;
    if (input.classList.contains("recording")) return;
    const action = input.dataset.action;
    const capture = e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.key || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        if ((["Delete", "Backspace", "Escape"].includes(e.key)) && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            hotKeys[action] = {
                key: "",
                ctrl: false,
                alt: false,
                shift: false
            };
        }
        else {
            hotKeys[action] = {
                key: e.key.toUpperCase(),
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
        input.classList.remove("recording");
        input.value = bindingToText(hotKeys[action]);
        input.removeEventListener("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    input.classList.add("recording");
    input.value = "Press keys…";
    input.addEventListener("blur", finish);
}

// input hotKeys[action] and convert the data to a string for the input field
function bindingToText(b) {
    if (!b) return "";
    const keys = [];
    if (b.ctrl) keys.push("CTRL");
    if (b.alt) keys.push("ALT");
    if (b.shift) keys.push("SHIFT");
    if (b.key) keys.push(b.key === " " ? "SPACE" : b.key);
    return keys.join(" + ");
}

// validate json data in local storage
function validateLocalStorage(item) {
    try {
        const json = JSON.parse(localStorage.getItem(item));
        if (!json || typeof json !== "object") return {};
        return json;
    }
    catch {
        return {};
    }
}

// save settings
function saveSettings() {
    localStorage.setItem("anisongdbUtilities", JSON.stringify({
        catboxHost,
        jsonDownloadRename,
        hideAmqText,
        defaultAdvanced,
        loop,
        hotKeys
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
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
        #auHotkeyTable th {
            text-align: left;
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #auHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #auHotkeyTable input.hk-input {
            width: 200px;
            padding: 4px 2px;
            cursor: pointer;
            user-select: none;
        }
    `;
    const style = document.createElement("style");
    style.id = "anisongdbUtilitiesStyle";
    style.textContent = css.trim();
    document.head.appendChild(style);
}
