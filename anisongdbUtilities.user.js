// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.19
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// ==/UserScript==

/*
Features:
- Press a hotkey to download json file / step songs
- Change accent color
*/

"use strict";
const saveData = validateLocalStorage("anisongdbUtilities");
let accentColor = normalizeHexColor(saveData.accentColor);
let hotKeys = {
    downloadJson: loadHotkey("downloadJson", "B", true, false, false),
    prevSong: loadHotkey("prevSong"),
    nextSong: loadHotkey("nextSong")
};

const TEST_SEARCHES = {
    "no-links": {
        kind: "random",
        body: {
            n: 500,
            filters: {
                media_links: {
                    exclude: ["audio", "mq", "hq"]
                }
            }
        }
    },
    "ann-ids-over-1m": {
        kind: "ann-ids",
        body: {
            ann_ids: Array.from({ length: 500 }, (_, i) => 1000000 + i)
        }
    },
    "no-difficulty": {
        kind: "random",
        body: {
            n: 500,
            filters: {
                difficulty: {
                    include_no_difficulty: true
                }
            }
        }
    },
    "no-performance": {
        kind: "random",
        body: {
            n: 500,
            filters: {
                song_categories: ["other"]
            }
        }
    },
    "no-anime-type": {
        kind: "random",
        body: {
            n: 500,
            filters: {
                anime_types: ["other"]
            }
        }
    }
};

const ARTIST_COUNT_COLUMN_STORAGE_KEY = "utilitiesArtistCountColumn";

let downloadJsonButton;
let api;
let artistCountColumnCleanup = null;

applyStyles();

const loadInterval = setInterval(() => {
    if (window.AnisongDB) {
        clearInterval(loadInterval);
        setup();
    }
}, 200);

// Begin setup after AnisongDB API is ready
function setup() {
    api = window.AnisongDB;
    downloadJsonButton = document.querySelector("#search-download-json");

    api.services.settingsTabs.registerTab({
        id: "utilities",
        label: "Utilities",
        render: renderSettingsTab
    });
    syncArtistCountColumn(isArtistCountColumnEnabled());

    // Define hotkey actions
    const hotkeyActions = {
        downloadJson: () => {
            downloadJsonButton.click();
        },
        prevSong: () => {
            api.services.playback.previous();
        },
        nextSong: () => {
            api.services.playback.next();
        }
    };

    // Keyboard events
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
}

// Build settings tab contents inside AnisongDB's settings dialog
function renderSettingsTab(panel) {
    const root = document.createElement("div");
    root.id = "auSettings";
    root.innerHTML = /*html*/`
        <section class="au-section">
            <h3>AnisongDB Utilities</h3>
            <p class="au-info">By kempanator · Version ${GM_info.script.version}</p>
            <p class="au-info">
                <a href="https://github.com/kempanator/amq-scripts/blob/main/anisongdbUtilities.user.js" target="_blank" rel="noopener">Github</a>
                ·
                <a href="https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js" target="_blank" rel="noopener">Install</a>
            </p>
        </section>
        <section class="au-section">
            <h3>Test Searches</h3>
            <div class="au-test-search-row">
                <select id="auTestSearchSelect" class="app-select" aria-label="Test search">
                    <option value="no-links">Songs with no links</option>
                    <option value="no-difficulty">Songs with no difficulty</option>
                    <option value="no-performance">Songs with no performance</option>
                    <option value="no-anime-type">Songs with no anime type</option>
                    <option value="ann-ids-over-1m">ANN IDs over 1 million</option>
                </select>
                <button id="auTestSearchButton" type="button" class="app-button app-button--accent">Search</button>
            </div>
        </section>
        <section class="au-section">
            <h3>Columns</h3>
            <label class="app-checkbox"><input id="auArtistCountColumn" type="checkbox">Artist Count</label>
        </section>
        <section class="au-section">
            <h3>Accent Color</h3>
            <div class="au-accent-row">
                <input id="auAccentColorPicker" type="color"${accentColor ? ` value="${accentColor}"` : ""}>
                <button id="auAccentColorClear" type="button" class="app-button app-button--compact" title="Reset accent color">Reset</button>
            </div>
        </section>
        <section class="au-section">
            <h3>Hotkeys</h3>
            <table id="auHotkeyTable">
                <thead><tr><th>Action</th><th>Keybind</th></tr></thead>
                <tbody></tbody>
            </table>
        </section>
    `;
    panel.append(root);

    const testSearchSelect = root.querySelector("#auTestSearchSelect");
    const testSearchButton = root.querySelector("#auTestSearchButton");
    const artistCountColumnCheckbox = root.querySelector("#auArtistCountColumn");
    const accentColorPicker = root.querySelector("#auAccentColorPicker");
    const accentColorClear = root.querySelector("#auAccentColorClear");
    artistCountColumnCheckbox.checked = isArtistCountColumnEnabled();
    artistCountColumnCheckbox.onchange = () => {
        api.services.storage.update({ [ARTIST_COUNT_COLUMN_STORAGE_KEY]: artistCountColumnCheckbox.checked });
        syncArtistCountColumn(artistCountColumnCheckbox.checked);
    };
    testSearchButton.onclick = () => {
        const command = TEST_SEARCHES[testSearchSelect.value];
        if (!command) return;
        api.services.searches.runSearch(command);
        api.services.modals.close();
    };
    if (accentColor) accentColorPicker.value = accentColor;
    accentColorPicker.oninput = (event) => {
        accentColor = event.target.value;
        applyStyles();
        saveSettings();
    };
    accentColorClear.onclick = () => {
        accentColor = null;
        accentColorPicker.value = "#000000";
        applyStyles();
        saveSettings();
    };
    createHotkeyTable(root.querySelector("#auHotkeyTable tbody"), [
        { action: "downloadJson", title: "Download JSON" },
        { action: "prevSong", title: "Previous Song" },
        { action: "nextSong", title: "Next Song" },
    ]);

    return () => {
        root.querySelectorAll("input.hk-input.recording").forEach((input) => input.blur());
    };
}

function isArtistCountColumnEnabled() {
    return api.services.storage.get(ARTIST_COUNT_COLUMN_STORAGE_KEY) !== false;
}

function syncArtistCountColumn(enabled) {
    if (enabled) {
        if (artistCountColumnCleanup) return;
        artistCountColumnCleanup = api.services.table.registerColumn({
            id: "artist-count",
            header: "Artist Count",
            defaultVisible: true,
            centered: true,
            display: (song) => song.artists?.length ?? 0,
            copy: (song) => String(song.artists?.length ?? 0),
            sort: (left, right) => (left.artists?.length ?? 0) - (right.artists?.length ?? 0)
        }, { after: "artist" });
        return;
    }
    artistCountColumnCleanup?.();
    artistCountColumnCleanup = null;
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
function createHotkeyTable(tbody, data) {
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

// Apply styles
function applyStyles() {
    let css = "";
    if (accentColor) {
        css += /*css*/ `
            :root {
                --accent: ${accentColor};
                --accent-hover: color-mix(in srgb, var(--accent) 85%, white);
                --accent-glow: color-mix(in srgb, var(--accent) 35%, transparent);
            }
        `;
    }
    css += /*css*/ `
        #auSettings .au-section {
            padding: 0 0 16px;
        }
        #auSettings .au-section h3 {
            margin: 0 0 8px;
            color: var(--text);
            font-size: 15px;
            line-height: 1.2;
        }
        #auSettings .au-info {
            margin: 0 0 6px;
            color: var(--text-muted, var(--text));
            font-size: 13px;
            line-height: 1.35;
        }
        #auSettings .au-info a {
            color: var(--accent);
            font-weight: 600;
            text-decoration: none;
        }
        #auSettings .au-info a:hover {
            opacity: .7;
        }
        #auSettings .app-checkbox {
            display: flex;
            margin: 0 0 8px;
        }
        #auSettings .au-test-search-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }
        #auSettings .au-test-search-row .app-select {
            min-width: 220px;
        }
        #auSettings .au-accent-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #auSettings input[type="color"] {
            width: 100px;
            height: 32px;
            padding: 0;
            border: 1px solid var(--border, #7e7e7e);
            background-color: var(--surface-2, var(--songTableImpairColor));
            cursor: pointer;
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
            box-sizing: border-box;
            width: 200px;
            min-height: 30px;
            padding: 4px 8px;
            border: 1px solid var(--border, #7e7e7e);
            background: var(--surface-2, transparent);
            color: var(--text);
            cursor: pointer;
            user-select: none;
        }
        #auHotkeyTable input.hk-input.recording {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
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
