// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.21
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/anisongdbUtilities.user.js
// ==/UserScript==

/*
Features:
- Press a hotkey to download JSON, step through songs, or cycle themes
- Change accent color
*/

"use strict";

let accentColor;
let searchServices;
let utilitySettings;
let utilitiesTabCleanup;
let artistCountColumnCleanup = null;
let copySongArtistColumnCleanup = null;
let hotkeyController;

const hotkeyActions = {
    downloadJson: {
        label: "Download JSON",
        defaultBinding: { key: "B", ctrl: true, alt: false, shift: false },
        enabled: () => Boolean(searchServices),
        run: () => searchServices.workspace.downloadJson()
    },
    prevSong: {
        label: "Previous Song",
        enabled: () => Boolean(searchServices),
        run: () => searchServices.playback.previous()
    },
    nextSong: {
        label: "Next Song",
        enabled: () => Boolean(searchServices),
        run: () => searchServices.playback.next()
    },
    cycleTheme: {
        label: "Cycle Theme",
        enabled: () => Boolean(window.AnisongDB?.theme),
        run: () => window.AnisongDB.theme.cycle()
    }
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
    "video-no-audio": {
        kind: "random",
        body: {
            n: 500,
            filters: {
                media_links: {
                    require_any: ["mq", "hq"],
                    exclude: ["audio"]
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

// Start keyboard handling on every route and track the Search page separately
function startScript() {
    initializeState();
    applyStyles();
    hotkeyController.start();
    window.addEventListener("anisongdb:search-change", syncSearchUtilities);
    syncSearchUtilities();
}

// Restore preferences and create runtime state before startup
function initializeState() {
    const settings = loadSettings();
    accentColor = settings.accentColor;
    hotkeyController = new HotkeyController({
        actions: hotkeyActions,
        savedBindings: settings.hotKeys,
        onChange: saveSettings
    });
}

// Release registrations when leaving Search and rebuild them with each new Search instance
function syncSearchUtilities() {
    const services = window.AnisongDB?.services;
    if (services === searchServices) return;

    utilitiesTabCleanup?.();
    utilitiesTabCleanup = undefined;
    syncArtistCountColumn(false);
    syncCopySongArtistColumn(false);
    utilitySettings = undefined;
    searchServices = services;
    if (searchServices) setup();
}

// Register the settings tab and columns with the current Search page
function setup() {
    utilitySettings = searchServices.storage.record({
        key: "anisongdb-utilities",
        label: "AnisongDB Utilities",
        policy: "settings",
        defaults: defaultUtilitySettings,
        parse: parseUtilitySettings
    });

    utilitiesTabCleanup = searchServices.settingsTabs.registerTab({
        id: "utilities",
        label: "Utilities",
        render: renderSettingsTab
    });
    syncArtistCountColumn(isUtilityColumnEnabled("artistCountColumn"));
    syncCopySongArtistColumn(isUtilityColumnEnabled("copySongArtistColumn"));
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
                <select id="auTestSearchSelect" class="app-select">
                    <option value="no-links">Songs with no links</option>
                    <option value="video-no-audio">Songs with video but no audio</option>
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
            <label class="app-checkbox"><input id="auCopySongArtistColumn" type="checkbox">Copy "Song" by Artist</label>
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
    const copySongArtistColumnCheckbox = root.querySelector("#auCopySongArtistColumn");
    const accentColorPicker = root.querySelector("#auAccentColorPicker");
    const accentColorClear = root.querySelector("#auAccentColorClear");
    artistCountColumnCheckbox.checked = isUtilityColumnEnabled("artistCountColumn");
    copySongArtistColumnCheckbox.checked = isUtilityColumnEnabled("copySongArtistColumn");
    artistCountColumnCheckbox.onchange = () => {
        utilitySettings.update((current) => ({
            ...current,
            artistCountColumn: artistCountColumnCheckbox.checked
        }));
        syncArtistCountColumn(artistCountColumnCheckbox.checked);
    };
    copySongArtistColumnCheckbox.onchange = () => {
        utilitySettings.update((current) => ({
            ...current,
            copySongArtistColumn: copySongArtistColumnCheckbox.checked
        }));
        syncCopySongArtistColumn(copySongArtistColumnCheckbox.checked);
    };
    testSearchButton.onclick = () => {
        const command = TEST_SEARCHES[testSearchSelect.value];
        if (!command) return;
        searchServices.searches.runSearch(command);
        searchServices.modals.close();
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
    hotkeyController.renderTable(root.querySelector("#auHotkeyTable tbody"));

    return () => {
        hotkeyController.cancelRecording();
    };
}

function defaultUtilitySettings() {
    return {
        artistCountColumn: true,
        copySongArtistColumn: true
    };
}

function parseUtilitySettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Expected an object.");
    }
    const keys = ["artistCountColumn", "copySongArtistColumn"];
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
        throw new Error("Unexpected or missing fields.");
    }
    if (typeof value.artistCountColumn !== "boolean" || typeof value.copySongArtistColumn !== "boolean") {
        throw new Error("Expected a boolean.");
    }
    return {
        artistCountColumn: value.artistCountColumn,
        copySongArtistColumn: value.copySongArtistColumn
    };
}

function isUtilityColumnEnabled(field) {
    return utilitySettings.value()[field] !== false;
}

function syncArtistCountColumn(enabled) {
    if (enabled) {
        if (artistCountColumnCleanup) return;
        artistCountColumnCleanup = searchServices.table.registerColumn({
            id: "artist-count",
            header: "Artist Count",
            defaultVisible: false,
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

function syncCopySongArtistColumn(enabled) {
    if (enabled) {
        if (copySongArtistColumnCleanup) return;
        copySongArtistColumnCleanup = searchServices.table.registerColumn({
            id: "copy-song-artist",
            header: "Copy",
            visibilityLabel: "Copy Song/Artist",
            defaultVisible: false,
            centered: true,
            renderCell: renderCopySongArtistCell
        }, { after: "info" });
        return;
    }
    copySongArtistColumnCleanup?.();
    copySongArtistColumnCleanup = null;
}

function renderCopySongArtistCell(container, { song }) {
    const text = `"${song.songName || ""}" by ${song.songArtist || ""}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-icon-button";
    button.title = text;
    button.innerHTML = "<i class=\"fa fa-clone\" aria-hidden=\"true\"></i>";
    const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        void navigator.clipboard.writeText(text);
    };
    button.addEventListener("click", onClick);
    container.replaceChildren(button);
    return () => button.removeEventListener("click", onClick);
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

// Manage hotkey bindings, recording, and settings editor
class HotkeyController {
    static bindingTypes = { key: "string", ctrl: "boolean", alt: "boolean", shift: "boolean" };

    static normalizeKey(key) {
        const uppercase = key.toUpperCase();
        if ([...key].length === 1 && [...uppercase].length !== 1) return key;
        return uppercase;
    }

    // Keep valid fields and silently replace invalid values with defaults
    static normalizeBinding(value, fallback = { key: "", ctrl: false, alt: false, shift: false }) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return { ...fallback };
        }

        const binding = {};
        for (const [field, type] of Object.entries(HotkeyController.bindingTypes)) {
            const savedValue = value[field];
            if (typeof savedValue !== type) {
                binding[field] = fallback[field];
                continue;
            }
            binding[field] = field === "key" ? HotkeyController.normalizeKey(savedValue) : savedValue;
        }
        return binding;
    }

    // Restore known actions and discard unrecognized saved entries
    static normalizeBindings(value, defaults) {
        const bindings = {};
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            value = {};
        }
        for (const [action, fallback] of Object.entries(defaults)) {
            bindings[action] = HotkeyController.normalizeBinding(value[action], fallback);
        }
        return bindings;
    }

    static getDefaults(actions) {
        const defaults = {};
        for (const [action, definition] of Object.entries(actions)) {
            defaults[action] = HotkeyController.normalizeBinding(definition.defaultBinding);
        }
        return defaults;
    }

    constructor({ actions, savedBindings, onChange }) {
        this.actions = actions;
        this.entries = Object.entries(actions);
        this.onChange = onChange;
        this.defaults = HotkeyController.getDefaults(actions);
        this.editors = new Map();
        this.recording = null;

        this.bindings = HotkeyController.normalizeBindings(savedBindings, this.defaults);
    }

    formatBinding(binding) {
        if (!binding.key) return "";
        const parts = [];
        if (binding.ctrl) parts.push("CTRL");
        if (binding.alt) parts.push("ALT");
        if (binding.shift) parts.push("SHIFT");
        parts.push(binding.key === " " ? "SPACE" : binding.key);
        return parts.join(" + ");
    }

    isSupportedEvent(event) {
        if (!event.key || event.metaKey || event.isComposing || event.getModifierState("AltGraph")) return false;
        const key = HotkeyController.normalizeKey(event.key);
        return !["SHIFT", "CONTROL", "ALT", "META", "ALTGRAPH", "DEAD", "PROCESS", "UNIDENTIFIED"].includes(key);
    }

    start() {
        document.addEventListener("keydown", this.handleKeydown);
    }

    destroy() {
        this.cancelRecording();
        document.removeEventListener("keydown", this.handleKeydown);
        this.editors.clear();
    }

    setBindings(value) {
        const imported = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        this.stopRecording();

        for (const [action] of this.entries) {
            this.bindings[action] = Object.hasOwn(imported, action)
                ? HotkeyController.normalizeBinding(imported[action])
                : { ...this.defaults[action] };
        }
        this.refreshEditors();
    }

    handleKeydown = event => {
        if (this.recording || !this.isSupportedEvent(event)) return;
        const key = HotkeyController.normalizeKey(event.key);

        // All matches intentionally run, including while typing and on repeated keydowns
        for (const [action, definition] of this.entries) {
            const binding = this.bindings[action];
            if (!binding.key || binding.key !== key) continue;
            if (binding.ctrl !== event.ctrlKey) continue;
            if (binding.alt !== event.altKey) continue;
            if (binding.shift !== event.shiftKey) continue;
            if (definition.enabled && !definition.enabled()) continue;

            event.preventDefault();
            definition.run();
        }
    };

    refreshEditors() {
        for (const [action, editor] of this.editors) {
            const text = this.formatBinding(this.bindings[action]);
            editor.button.textContent = text || "—";
            editor.button.classList.remove("recording");
            editor.button.classList.toggle("unset", !this.bindings[action].key);
            editor.clear.hidden = !this.bindings[action].key;
        }
    }

    stopRecording() {
        if (!this.recording) return false;
        document.removeEventListener("keydown", this.captureKeydown, true);
        this.recording.button.removeEventListener("blur", this.cancelRecording);
        window.removeEventListener("blur", this.cancelRecording);
        this.recording = null;
        return true;
    }

    cancelRecording = () => {
        if (this.stopRecording()) this.refreshEditors();
    };

    commitBinding(action, binding) {
        this.stopRecording();
        this.bindings[action] = binding;
        this.refreshEditors();
        this.onChange();
    }

    captureKeydown = event => {
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        event.preventDefault();

        const unmodified = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
        if (unmodified && event.key === "Escape") {
            this.cancelRecording();
            return;
        }
        if (unmodified && ["Delete", "Backspace"].includes(event.key)) {
            this.commitBinding(this.recording.action, HotkeyController.normalizeBinding());
            return;
        }
        if (!this.isSupportedEvent(event)) return;

        this.commitBinding(this.recording.action, {
            key: HotkeyController.normalizeKey(event.key),
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey
        });
    };

    startRecording(action) {
        this.cancelRecording();
        const editor = this.editors.get(action);
        this.recording = { action, button: editor.button };
        editor.button.focus();
        editor.button.classList.remove("unset");
        editor.button.classList.add("recording");
        editor.button.textContent = "Press keys…";
        editor.button.addEventListener("blur", this.cancelRecording);
        window.addEventListener("blur", this.cancelRecording);
        document.addEventListener("keydown", this.captureKeydown, true);
    }

    renderTable(tbody) {
        this.stopRecording();
        this.editors.clear();
        tbody.replaceChildren();

        for (const [action, definition] of this.entries) {
            const row = document.createElement("tr");
            const label = document.createElement("td");
            label.textContent = definition.label;
            const controls = document.createElement("td");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "hk-input";
            button.dataset.hotkeyAction = action;
            button.addEventListener("click", () => this.startRecording(action));

            const clear = document.createElement("button");
            clear.type = "button";
            clear.className = "hk-clear";
            clear.title = "Clear shortcut";
            clear.addEventListener("click", () => this.commitBinding(action, HotkeyController.normalizeBinding()));

            const icon = document.createElement("i");
            icon.className = "fa fa-trash";
            icon.setAttribute("aria-hidden", "true");
            clear.append(icon);

            controls.append(button, clear);
            row.append(label, controls);
            tbody.append(row);
            this.editors.set(action, { button, clear });
        }
        this.refreshEditors();
    }
}

// Read a JSON object from localStorage, returning an empty object if invalid
function readStorageObject(key) {
    let value;
    try {
        value = JSON.parse(localStorage.getItem(key));
    }
    catch {
        return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

// Load validated preferences without changing runtime state
function loadSettings() {
    const settings = {
        accentColor: null,
    };
    const savedSettings = readStorageObject("anisongdbUtilities");

    settings.accentColor = normalizeHexColor(savedSettings.accentColor);
    settings.hotKeys = savedSettings.hotKeys;
    return settings;
}

// Save settings
function saveSettings() {
    localStorage.setItem("anisongdbUtilities", JSON.stringify({
        hotKeys: hotkeyController.bindings,
        accentColor
    }));
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
        #auHotkeyTable button.hk-clear {
            margin-left: 6px;
            padding: 0;
            border: 0;
            background: transparent;
            box-shadow: none;
            cursor: pointer;
        }
        #auHotkeyTable button.hk-clear:hover {
            opacity: 0.7;
        }
        #auHotkeyTable button.hk-input {
            box-sizing: border-box;
            width: 200px;
            min-height: 30px;
            padding: 4px 8px;
            border: 1px solid var(--border, #7e7e7e);
            background: var(--surface-2, transparent);
            cursor: pointer;
            user-select: none;
        }
        #auHotkeyTable button.hk-input.unset {
            color: gray;
        }
        #auHotkeyTable button.hk-input.recording {
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

startScript();
