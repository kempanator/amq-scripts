// ==UserScript==
// @name         AMQ Anisongdb Search
// @namespace    https://github.com/kempanator
// @version      0.31
// @description  Adds a window to search anisongdb.com in game
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqAnisongdbSearch.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqAnisongdbSearch.user.js
// ==/UserScript==

/*
Features:
1. Add a window for anisongdb search results
2. Add anime and artist lookup buttons to song info container for quick search
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("anisongdbSearch");
const apiBase = "https://anisongdb.com/api/";
let anisongdbWindow;
let injectSearchButtons = saveData.injectSearchButtons ?? true;
let tableSort = { mode: "anime", ascending: true };
let hotKeys = {
    adbsWindow: loadHotkey("adbsWindow"),
    doAnimeSearch: loadHotkey("doAnimeSearch"),
    doArtistSearch: loadHotkey("doArtistSearch"),
    doComposerSearch: loadHotkey("doComposerSearch")
}

function setup() {
    new Listener("answer results", (data) => {
        if (!injectSearchButtons) return;
        setTimeout(() => {
            $("#adbsSearchButtonRow").remove();
            $("#qpSongInfoLinkRow").before($("<div>", { id: "adbsSearchButtonRow", class: "row" })
                .append("<h5><b>AnisongDB Search</b></h5>")
                .append($("<button>", { text: "Anime" }).on("click", () => {
                    anisongdbWindow.open();
                    $("#adbsQueryMode").val("Anime");
                    $("#adbsQueryInput").val(data.songInfo.animeNames.romaji);
                    getAnisongdbData("anime", data.songInfo.animeNames.romaji, false);
                }))
                .append($("<button>", { text: "Artist" }).on("click", () => {
                    anisongdbWindow.open();
                    $("#adbsQueryMode").val("Artist");
                    $("#adbsQueryInput").val(data.songInfo.artist);
                    getAnisongdbData("artist", data.songInfo.artist, false);
                }))
            );
        }, 0);
    }).bindListener();

    anisongdbWindow = new AMQWindow({
        id: "anisongdbWindow",
        title: "AnisongDB Search",
        width: 600,
        height: 400,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1005,
        resizable: true,
        draggable: true
    });
    anisongdbWindow.addPanel({
        id: "anisongdbPanel",
        width: 1.0,
        height: "100%",
        scrollable: { x: false, y: true }
    });
    anisongdbWindow.window.find(".modal-header").empty()
        .append($("<i>", { class: "fa fa-times clickAble", "aria-hidden": "true", style: "font-size: 25px; top: 8px; right: 15px; position: absolute;" })
            .on("click", () => {
                anisongdbWindow.close();
            }))
        .append($("<i>", { class: "fa fa-globe clickAble", "aria-hidden": "true", style: "font-size: 22px; top: 11px; right: 42px; position: absolute;" })
            .on("click", () => {
                open("https://anisongdb.com", "_blank", "noreferrer");
            }))
        .append($("<h2>", { text: "AnisongDB Search" }))
        .append($("<div>", { class: "tabContainer" })
            .append($("<div>", { id: "adbsSearchTab", class: "tab clickAble" })
                .append($("<span>", { text: "Search" }))
                .on("click", () => {
                    switchTab("adbsSearch");
                }))
            .append($("<div>", { id: "adbsSettingsTab", class: "tab clickAble" })
                .append($("<span>", { text: "Settings" }))
                .on("click", () => {
                    switchTab("adbsSettings");
                }))
        );

    anisongdbWindow.panels[0].panel
        .append($("<div>", { id: "adbsSearchContainer", class: "tabSection" })
            .append($("<div>", { id: "adbsSearchRow" })
                .append($("<select>", { id: "adbsQueryMode", style: "padding: 2px 0;" })
                    .append($("<option>", { text: "Anime" }))
                    .append($("<option>", { text: "Artist" }))
                    .append($("<option>", { text: "Song" }))
                    .append($("<option>", { text: "Composer" }))
                    .append($("<option>", { text: "Season" }))
                    .append($("<option>", { text: "Ann Id" }))
                    .append($("<option>", { text: "Mal Id" }))
                    .append($("<option>", { text: "Ann Song Id" }))
                    .append($("<option>", { text: "Amq Song Id" }))
                )
                .append($("<input>", { id: "adbsQueryInput", type: "text", style: "width: 300px; padding: 0 2px;" })
                    .on("keypress", (event) => {
                        if (event.key === "Enter") {
                            doSearch();
                        }
                    }))
                .append($("<button>", { id: "anisongdbSearchButtonGo", text: "Go" })
                    .on("click", () => {
                        doSearch();
                    }))
                .append($("<label>", { class: "clickable", style: "padding: 0 4px 0 0; margin: 0 0 0 10px; vertical-align: middle;" })
                    .append("Partial")
                    .append($("<input>", { id: "adbsPartialCheckbox", type: "checkbox", checked: true }))
                )
            )
            .append($("<table>", { id: "adbsTable", class: "styledTable" })
                .append($("<thead>")
                    .append($("<tr>")
                        .append($("<th>", { class: "anime", text: "Anime", "data-sort": "anime" }))
                        .append($("<th>", { class: "artist", text: "Artist", "data-sort": "artist" }))
                        .append($("<th>", { class: "song", text: "Song", "data-sort": "song" }))
                        .append($("<th>", { class: "type", text: "Type", "data-sort": "type" }))
                        .append($("<th>", { class: "vintage", text: "Vintage", "data-sort": "vintage" }))
                    )
                    .on("click", "th", (event) => {
                        const sortKey = event.currentTarget.getAttribute("data-sort");
                        tableSortChange(sortKey);
                        sortAnisongdbTableEntries();
                    })
                )
                .append($("<tbody>")
                    .on("click", "td", (event) => {
                        for (const className of ["anime", "artist", "song"]) {
                            if (event.currentTarget.classList.contains(className)) {
                                getAnisongdbData(className, event.currentTarget.innerText, false);
                                break;
                            }
                        }
                    })
                )
            )
            .append("<p>", { id: "adbsInfoText", style: "margin: 0;" })
        )
        .append($("<div>", { id: "adbsSettingsContainer", class: "tabSection", style: "padding: 10px;" })
            .append(`<table id="adbsHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>`)
            .append($("<div>", { style: "margin-top: 10px;" })
                .append($("<span>", { text: "Song info Box Buttons" }))
                .append($("<div>", { class: "customCheckbox", style: "margin: 0 0 0 8px; vertical-align: middle;" })
                    .append($("<input>", { type: "checkbox", id: "adbsButtonsCheckbox", checked: injectSearchButtons })
                        .on("click", () => {
                            injectSearchButtons = !injectSearchButtons;
                            saveSettings();
                        }))
                    .append($("<label>", { for: "adbsButtonsCheckbox" })
                        .append($("<i>", { class: "fa fa-check", "aria-hidden": "true" }))
                    )
                )
            )
        );

    const hotkeyActions = {
        adbsWindow: () => {
            anisongdbWindow.isVisible() ? anisongdbWindow.close() : anisongdbWindow.open();
        },
        doAnimeSearch: () => {
            const query = quiz.infoContainer.$name.text().trim();
            if (!query) return;
            anisongdbWindow.open();
            $("#adbsQueryMode").val("Anime");
            $("#adbsQueryInput").val(query);
            getAnisongdbData("anime", query, false);
        },
        doArtistSearch: () => {
            const query = quiz.infoContainer.artistInformation?.name;
            if (!query) return;
            anisongdbWindow.open();
            $("#adbsQueryMode").val("Artist");
            $("#adbsQueryInput").val(query);
            getAnisongdbData("artist", query, false);
        },
        doComposerSearch: () => {
            const query = quiz.infoContainer.composerInformation?.name;
            if (!query) return;
            anisongdbWindow.open();
            $("#adbsQueryMode").val("Composer");
            $("#adbsQueryInput").val(query);
            getAnisongdbData("composer", query, false);
        }
    };

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

    createHotkeyTable([
        { action: "adbsWindow", title: "Open this window" },
        { action: "doAnimeSearch", title: "Do anime search" },
        { action: "doArtistSearch", title: "Do artist search" },
        { action: "doComposerSearch", title: "Do composer search" }
    ]);
    switchTab("adbsSearch");
    $("#optionListSettings").before($("<li>", { class: "clickAble", text: "AnisongDB" }).on("click", () => {
        anisongdbWindow.open();
    }));

    applyStyles();
    AMQ_addScriptData({
        name: "Anisongdb Search",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqAnisongdbSearch.user.js",
        description: `
            <p>Add a window to search anisongdb.com</p>
            <p>Add buttons to song info container for quick search</p>
        `
    });
}

// send anisongdb request
function getAnisongdbData(mode, query, partial) {
    $("#adbsInfoText").text("Loading...");
    let url, data;
    let json = {
        and_logic: false,
        ignore_duplicate: false,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        normal_broadcast: true,
        dub: true,
        rebroadcast: true,
        standard: true,
        character: true,
        chanting: true,
        instrumental: true
    };
    if (mode === "anime") {
        url = apiBase + "search_request";
        json.anime_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "artist") {
        url = apiBase + "search_request";
        json.artist_search_filter = {
            search: query,
            partial_match: partial,
            group_granularity: 0,
            max_other_artist: 99
        };
    }
    else if (mode === "song") {
        url = apiBase + "search_request";
        json.song_name_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "composer") {
        url = apiBase + "search_request";
        json.composer_search_filter = {
            search: query,
            partial_match: partial,
            arrangement: false
        };
    }
    else if (mode === "season") {
        json.season = query;
        url = apiBase + "season_request";
    }
    else if (mode === "ann id") {
        url = apiBase + "ann_ids_request";
        json.ann_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "mal id") {
        url = apiBase + "mal_ids_request";
        json.mal_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "ann song id") {
        url = apiBase + "ann_song_ids_request";
        json.ann_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "amq song id") {
        url = apiBase + "amq_song_ids_request";
        json.amq_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    data = {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(json)
    };
    fetch(url, data)
        .then(res => res.json())
        .then(json => {
            if (!Array.isArray(json)) {
                $("#adbsTable tbody").empty();
                $("#adbsInfoText").text(JSON.stringify(json));
            }
            else if (json.length === 0 && isRankedRunning()) {
                $("#adbsTable tbody").empty();
                $("#adbsInfoText").text("AnisongDB is not available during ranked");
            }
            else {
                createTable(json);
            }
        })
        .catch(res => {
            $("#adbsTable tbody").empty();
            $("#adbsInfoText").text(res.toString());
        })
}

// return true if ranked/themed is running
function isRankedRunning() {
    if (ranked.currentState === ranked.RANKED_STATE_IDS.RUNNING) return true;
    if (ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_RUNNING) return true;
    if (ranked.currentState === ranked.RANKED_STATE_IDS.THEMED_RUNNING) return true;
    return false;
}

// go button press
function doSearch() {
    const mode = $("#adbsQueryMode").val().toLowerCase();
    const query = $("#adbsQueryInput").val();
    const partial = $("#adbsPartialCheckbox").prop("checked");
    if (query === "") {
        $("#adbsInfoText").text("");
        $("#adbsTable tbody").empty();
    }
    else {
        getAnisongdbData(mode, query, partial);
    }
}

// create anisongdb results table
function createTable(json) {
    const language = options.useRomajiNames ? "animeJPName" : "animeENName";
    $("#adbsInfoText").text("");
    $("#adbsTable tbody").empty().append(json.map((result) => $("<tr>")
        .append($("<td>", { class: "anime", text: result[language] }))
        .append($("<td>", { class: "artist", text: result.songArtist }))
        .append($("<td>", { class: "song", text: result.songName }))
        .append($("<td>", { class: "type", text: shortenType(result.songType) }))
        .append($("<td>", { class: "vintage", text: result.animeVintage }))
    ));
}

// sort table rows that already exist
function sortAnisongdbTableEntries() {
    const rows = $("#adbsTable tbody tr").toArray();
    if (tableSort.mode === "anime") {
        rows.sort((a, b) => $(".anime", a).text().localeCompare($(".anime", b).text()));
    }
    else if (tableSort.mode === "artist") {
        rows.sort((a, b) => $(".artist", a).text().localeCompare($(".artist", b).text()));
    }
    else if (tableSort.mode === "song") {
        rows.sort((a, b) => $(".song", a).text().localeCompare($(".song", b).text()));
    }
    else if (tableSort.mode === "type") {
        rows.sort((a, b) => songTypeSortValue($(".type", a).text(), $(".type", b).text()));
    }
    else if (tableSort.mode === "vintage") {
        rows.sort((a, b) => vintageSortValue($(".vintage", a).text(), $(".vintage", b).text()));
    }
    if (!tableSort.ascending) rows.reverse();
    $("#adbsTable tbody").append(rows);
}

// reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#anisongdbWindow");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
}

// input full song type text, return shortened version
function shortenType(type = "") {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// get sorting value for song type (input text example: Opening 1)
function songTypeSortValue(a = "", b = "") {
    const typeMap = { O: 1, E: 2, I: 3 };
    const typeA = typeMap[a.charAt(0)];
    const typeB = typeMap[b.charAt(0)];
    if (typeA !== typeB) {
        return typeA - typeB;
    }
    const numberA = parseInt(a.match(/([0-9]+)/)) || 0;
    const numberB = parseInt(b.match(/([0-9]+)/)) || 0;
    if (typeA !== 3 && typeB !== 3) {
        return numberA - numberB;
    }
    return 0;
}

// get sorting value for anime vintage
function vintageSortValue(vintageA, vintageB) {
    if (!vintageA && !vintageB) return 0;
    if (!vintageA) return 1;
    if (!vintageB) return -1;
    const [seasonA, yearA] = vintageA.split(" ");
    const [seasonB, yearB] = vintageB.split(" ");
    if (yearA !== yearB) {
        return yearA - yearB;
    }
    const seasonOrder = { "Winter": 1, "Spring": 2, "Summer": 3, "Fall": 4 };
    return seasonOrder[seasonA] - seasonOrder[seasonB];
}

// used for sorting table contents when you click a header
function tableSortChange(mode) {
    if (tableSort.mode === mode) {
        tableSort.ascending = !tableSort.ascending;
    }
    else {
        tableSort.mode = mode;
        tableSort.ascending = true;
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
    const $tbody = $("#adbsHotkeyTable tbody");
    for (const { action, title } of data) {
        const $input = $("<input>", { type: "text", class: "hk-input", readonly: true, "data-action": action })
            .val(bindingToText(hotKeys[action]))
            .on("click", startHotkeyRecord);
        $tbody.append($("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>").append($input)));
    }
}

// begin hotkey capture on click
function startHotkeyRecord() {
    const $input = $(this);
    if ($input.hasClass("recording")) return;
    const action = $input.data("action");
    const capture = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!e.key) return;
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        if ((e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
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
        $input.removeClass("recording").val(bindingToText(hotKeys[action])).off("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    $input.addClass("recording").val("Press keys…").on("blur", finish);
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
    localStorage.setItem("anisongdbSearch", JSON.stringify({
        injectSearchButtons,
        hotKeys
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
        #anisongdbWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #anisongdbWindow .modal-header h2 {
            font-size: 22px;
            text-align: left;
            height: 45px;
            margin: 0;
            padding: 10px;
            display: block;
        }
        #anisongdbWindow .modal-header .tabContainer {
            border-bottom: none;
        }
        #anisongdbWindow .modal-header .tabContainer .tab::before {
            box-shadow: none;
        }
        #anisongdbWindow .modal-header i.fa:hover {
            opacity: .7;
        }
        #anisongdbWindow select, #anisongdbWindow input {
            color: black;
        }
        #adbsSearchButtonRow {
            margin-bottom: 10px;
        }
        #adbsSearchButtonRow button {
            background: #D9D9D9;
            color: #1B1B1B;
            border: 1px solid #6D6D6D;
            border-radius: 4px;
            margin: 3px 2px 0 2px;
            padding: 2px 5px;
            font-weight: bold;
        }
        #adbsSearchButtonRow button:hover {
            opacity: .8;
        }
        #anisongdbWindow input[type="checkbox"] {
            width: 17px;
            height: 17px;
            margin: 0 0 0 3px;
            vertical-align: -4px;
        }
        #anisongdbWindow button {
            color: black;
            padding: 0 5px;
        }
        #anisongdbSearchRow {
            margin: 2px;
        }
        #adbsTable {
            width: 100%;
        }
        #adbsTable th, #adbsTable td {
            padding: 0 2px;
        }
        #adbsTable thead tr {
            font-weight: bold;
            cursor: pointer;
            user-select: none;
        }
        #adbsTable tbody tr:hover {
            color: #70B7FF;
        }
        #adbsTable .anime {
            width: 25%;
        }
        #adbsTable .artist {
            width: 25%;
        }
        #adbsTable .song {
            width: 25%;
        }
        #adbsTable .type {
            width: 10%;
        }
        #adbsTable .vintage {
            width: 15%;
        }
        table.styledTable thead tr {
            background-color: #282828;
        }
        table.styledTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        table.styledTable tbody tr:nth-child(even) {
            background-color: #353535;
        }
        #adbsHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #adbsHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #adbsHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
        }
    `;
    let style = document.getElementById("anisongdbSearchStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "anisongdbSearchStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
