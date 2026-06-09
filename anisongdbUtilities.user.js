// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.17
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// ==/UserScript==

/*
Features:
- Loop songs in a radio playlist
- Replace all links with different host
- Switch to advanced filters on page load
- Force your json file name to match your search query
- Press a hotkey to download json file
- Change accent color
*/

"use strict";
const saveData = validateLocalStorage("anisongdbUtilities");
const hostDict = { 1: "eudist", 2: "nawdist", 3: "naedist" };
let fileHost = parseInt(saveData.fileHost);
if (!hostDict.hasOwnProperty(fileHost)) fileHost = 0;
let jsonDownloadRename = saveData.jsonDownloadRename ?? true;
let defaultAdvanced = saveData.defaultAdvanced ?? false;
let accentColor = normalizeHexColor(saveData.accentColor);
let loop = parseInt(saveData.loop) || 0; //0:none, 1:repeat, 2:loop all
let hotKeys = {
    downloadJson: loadHotkey("downloadJson", "B", true, false, false),
    prevSong: loadHotkey("prevSong"),
    nextSong: loadHotkey("nextSong")
};

let settingsModal;
let banner;
let languageButton;
let toggleAdvancedButton;
let downloadJsonButton;

const loadInterval = setInterval(() => {
    if (document.querySelector("#table")) {
        clearInterval(loadInterval);
        setup();
    }
}, 200);

// Begin setup after the first table loads in
function setup() {
    applyStyles();
    const ngId = Object.values(document.querySelector("app-root").attributes).map((x) => x.name).find((x) => x.startsWith("_nghost")).split("-")[2];
    banner = document.querySelector(`div[role="banner"]`);
    downloadJsonButton = document.querySelector("#search-download-json");
    toggleAdvancedButton = document.querySelector("#search-toggle-advanced");
    languageButton = document.querySelector("#anime-name-lang-toggle-label");

    // Alter the page on load
    if (defaultAdvanced) {
        toggleAdvancedButton.click();
    }

    // Create settings icon
    const i = document.createElement("i");
    i.setAttribute(`_ngcontent-ng-${ngId}`, "");
    i.setAttribute("aria-hidden", "true");
    i.onclick = () => { toggleSettingsModal() };
    i.classList.add("fa", "fa-cog");
    i.style.cursor = "pointer";
    i.style.fontSize = "28px";
    i.style.margin = "0 18px 0 0";
    languageButton.insertAdjacentElement("afterend", i);

    // Define hotkey actions
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

    // Keyboard and mouse events
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
            if (document.querySelector("#myModal")) {
                applyFileHostLinks();
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

    // Create settings modal
    settingsModal = document.createElement("div");
    settingsModal.id = "auModal";
    settingsModal.style.display = "none";
    settingsModal.innerHTML = /*html*/`
        <div class="modal-content">
            <h2 style="text-align: center;">AnisongDB Utilities Script Settings</h2>
            <p style="text-align: center;">By: kempanator<br>Version: ${GM_info.script.version}<br><a href="https://github.com/kempanator/amq-scripts/blob/main/anisongdbUtilities.user.js" target="_blank">Github</a> <a href="https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js" target="_blank">Install</a></p>
            <p><label class="check"><input id="auAdvancedCheckbox" type="checkbox">Advanced view by default</label></p>
            <p><label class="check"><input id="auRenameJsonCheckbox" type="checkbox">Rename JSON to search input</label></p>
            <p><select id="auRadioSelect" class="selectFilter"><option value="0">none</option><option value="1">repeat</option><option value="2">loop all</option></select>Radio loop mode</p>
            <p><select id="auHostChangeSelect" class="selectFilter"><option value="0">default</option><option value="1">eudist</option><option value="2">nawdist</option><option value="3">naedist</option></select>Change host</p>
            <p><input id="auAccentColorPicker" type="color"${accentColor ? ` value="${accentColor}"` : ""}>Accent Color<i id="auAccentColorClear" class="fa fa-trash" aria-hidden="true" title="Reset accent color"></i></p>
            <table id="auHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>
        </div>
    `;
    document.body.append(settingsModal);
    inheritSearchBarScope(settingsModal);

    const advancedCheckbox = document.querySelector("#auAdvancedCheckbox");
    const renameJsonCheckbox = document.querySelector("#auRenameJsonCheckbox");
    const radioSelect = document.querySelector("#auRadioSelect");
    const hostChangeSelect = document.querySelector("#auHostChangeSelect");
    const accentColorPicker = document.querySelector("#auAccentColorPicker");
    const accentColorClear = document.querySelector("#auAccentColorClear");
    advancedCheckbox.checked = defaultAdvanced;
    renameJsonCheckbox.checked = jsonDownloadRename;
    radioSelect.value = loop;
    hostChangeSelect.value = fileHost;
    if (accentColor) accentColorPicker.value = accentColor;
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
        fileHost = parseInt(event.target.value);
        applyFileHostLinks();
        saveSettings();
    }
    accentColorPicker.oninput = (event) => {
        accentColor = event.target.value;
        applyStyles();
        saveSettings();
    }
    accentColorClear.onclick = () => {
        accentColor = null;
        accentColorPicker.value = "#000000";
        applyStyles();
        saveSettings();
    }
    createHotkeyTable([
        { action: "downloadJson", title: "Download JSON" },
        { action: "prevSong", title: "Previous Song" },
        { action: "nextSong", title: "Next Song" },
    ]);
    watchSongTableLinks();
    applyFileHostLinks();
}

// Step through song list by certain amount
function stepSong(amount) {
    const tdList = document.querySelectorAll("i.fa-music");
    const len = tdList.length;
    if (!len) return;
    const index = Array.from(tdList).findIndex(e => e.classList.contains("active"));
    const newIndex = index === -1 ? 0 : (((index + amount) % len) + len) % len;
    tdList[newIndex].click();
}

// Toggle settings modal or input boolean to force state
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

// Load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false) {
    const item = saveData.hotKeys?.[action];
    return {
        key: (item?.key ?? key).toUpperCase(),
        ctrl: item?.ctrl ?? item?.ctrlKey ?? ctrl,
        alt: item?.alt ?? item?.altKey ?? alt,
        shift: item?.shift ?? item?.shiftKey ?? shift
    }
}

// Create hotkey rows and add to table
function createHotkeyTable(data) {
    const tbody = document.querySelector("#auHotkeyTable tbody");
    if (!tbody) return;
    data.forEach(({ action, title }) => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "textInputFilter hk-input";
        input.readOnly = true;
        input.dataset.action = action;
        input.value = bindingToText(hotKeys[action]);
        input.addEventListener("click", startHotkeyRecord);
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        td1.textContent = title;
        td2.append(input);
        inheritSearchBarScope(input);
        tr.append(td1, td2);
        tbody.append(tr);
    });
}

// Begin hotkey capture on click
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

// Input hotKeys[action] and convert the data to a string for the input field
function bindingToText(b) {
    if (!b) return "";
    const keys = [];
    if (b.ctrl) keys.push("CTRL");
    if (b.alt) keys.push("ALT");
    if (b.shift) keys.push("SHIFT");
    if (b.key) keys.push(b.key === " " ? "SPACE" : b.key);
    return keys.join(" + ");
}

// Validate json data in local storage
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

// Save settings
function saveSettings() {
    localStorage.setItem("anisongdbUtilities", JSON.stringify({
        fileHost,
        jsonDownloadRename,
        defaultAdvanced,
        loop,
        hotKeys,
        accentColor
    }));
}

function normalizeHexColor(color) {
    if (!color) return null;
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    const match = String(color).match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (match) {
        return "#" + match.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, "0")).join("");
    }
    return null;
}

function rewriteAnimemusicquizUrl(url) {
    if (!fileHost) return url;
    return url.replace(/^https:\/\/\w+\.animemusicquiz\.com/, `https://${hostDict[fileHost]}.animemusicquiz.com`);
}

function applyFileHostLinks() {
    if (!fileHost) return;
    document.querySelectorAll("a.table-song-link").forEach(link => {
        link.href = rewriteAnimemusicquizUrl(link.href);
    });
    for (const id of ["modal-720-link", "modal-480-link", "modal-mp3-link"]) {
        const link = document.querySelector(`#${id}`);
        if (!link) continue;
        const newLink = rewriteAnimemusicquizUrl(link.href);
        link.href = newLink;
        const copyLabel = link.parentElement.querySelector("p");
        if (copyLabel) {
            copyLabel.onclick = () => navigator.clipboard.writeText(newLink);
        }
    }
}

function watchSongTableLinks() {
    const table = document.querySelector("#table");
    if (!table) return;
    new MutationObserver(() => applyFileHostLinks()).observe(table, { childList: true, subtree: true });
}

// Copy Angular emulated encapsulation scope so site component styles apply to script UI
function inheritSearchBarScope(container) {
    const ref = document.querySelector("app-search-bar select.selectFilter, app-search-bar input.textInputFilter, app-search-bar label.check");
    if (!ref) return;
    const attr = [...ref.attributes].find(a => a.name.startsWith("_ngcontent"));
    if (!attr) return;
    const apply = (el) => el.setAttribute(attr.name, "");
    apply(container);
    container.querySelectorAll("*").forEach(apply);
}

// Apply styles
function applyStyles() {
    let css = "";
    if (accentColor) {
        css += /*css*/ `
            :root {
                --accentColor: ${accentColor};
                --accentColorHover: color-mix(in srgb, var(--accentColor) 85%, white);
                --accentColorGlow: color-mix(in srgb, var(--accentColor) 35%, transparent);
                --accentColorTint: color-mix(in srgb, var(--accentColor) 10%, transparent);
            }
        `;
    }
    css += /*css*/ `
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
            border: 3px solid #7e7e7e;
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
        #auModal select.selectFilter {
            width: 100px;
            margin-right: 5px;
        }
        #auModal input[type="color"] {
            width: 100px;
            height: 32px;
            margin-right: 5px;
            padding: 0;
            border: 1px solid #7e7e7e;
            background-color: var(--songTableImpairColor);
            cursor: pointer;
            vertical-align: middle;
        }
        #auModal #auAccentColorClear {
            cursor: pointer;
            margin-left: 8px;
        }
        #auModal #auAccentColorClear:hover {
            opacity: .7;
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
            cursor: pointer;
            user-select: none;
        }
    `;
    let style = document.querySelector("#anisongdbUtilitiesStyle");
    if (!style) {
        style = document.createElement("style");
        style.id = "anisongdbUtilitiesStyle";
        document.head.appendChild(style);
    }
    style.textContent = css.trim();
}
