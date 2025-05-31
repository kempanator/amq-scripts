// ==UserScript==
// @name         AMQ Anisongdb Search
// @namespace    https://github.com/kempanator
// @version      0.20
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

const SCRIPT_VERSION = "0.20";
const SCRIPT_NAME = "Anisongdb Search";
const saveData = validateLocalStorage("anisongdbSearch");
let rankedRunningIds;
let anisongdbWindow;
let injectSearchButtons = saveData.injectSearchButtons ?? true;
let tableSort = { mode: "anime", ascending: true };
let hotKeys = {
    adbsWindow: loadHotkey("adbsWindow")
}

function setup() {
    new Listener("answer results", (data) => {
        if (injectSearchButtons) {
            setTimeout(() => {
                $("#adbsSearchButtonRow").remove();
                $("#qpSongInfoLinkRow").before($(`<div id="adbsSearchButtonRow" class="row"></div>`)
                    .append("<h5><b>AnisongDB Search</b></h5>")
                    .append($("<button>Anime</button>").click(() => {
                        anisongdbWindow.open();
                        $("#adbsQueryMode").val("Anime");
                        $("#adbsQueryInput").val(data.songInfo.animeNames.romaji);
                        getAnisongdbData("anime", data.songInfo.animeNames.romaji, false);
                    }))
                    .append($("<button>Artist</button>").click(() => {
                        anisongdbWindow.open();
                        $("#adbsQueryMode").val("Artist");
                        $("#adbsQueryInput").val(data.songInfo.artist);
                        getAnisongdbData("artist", data.songInfo.artist, false);
                    }))
                );
            }, 0);
        }
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
        .append($(`<i class="fa fa-times clickAble" style="font-size: 25px; top: 8px; right: 15px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            anisongdbWindow.close();
        }))
        .append($(`<i class="fa fa-globe clickAble" style="font-size: 22px; top: 11px; right: 42px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            window.open("https://anisongdb.com", "_blank");
        }))
        .append(`<h2>AnisongDB Search</h2>`)
        .append($(`<div class="tabContainer">`)
            .append($(`<div id="adbsSearchTab" class="tab clickAble"><span>Search</span></div>`).click(() => {
                switchTab("adbsSearch");
            }))
            .append($(`<div id="adbsSettingsTab" class="tab clickAble"><span>Settings</span></div>`).click(() => {
                switchTab("adbsSettings");
            }))
        );

    anisongdbWindow.panels[0].panel
        .append($(`<div id="adbsSearchContainer" class="tabSection"></div>`)
            .append($(`<div id="anisongdbSearchRow"></div>`)
                .append($(`<select id="adbsQueryMode" style="padding: 2px 0;"></select>`)
                    .append("<option>Anime</option>")
                    .append("<option>Artist</option>")
                    .append("<option>Song</option>")
                    .append("<option>Composer</option>")
                    .append("<option>Season</option>")
                    .append("<option>Ann Id</option>")
                    .append("<option>Mal Id</option>")
                )
                .append($(`<input id="adbsQueryInput" type="text" style="width: 300px; padding: 0 2px;">`).keypress((event) => {
                    if (event.key === "Enter") {
                        doSearch();
                    }
                }))
                .append($(`<button id="anisongdbSearchButtonGo">Go</button>`).click(() => {
                    doSearch();
                }))
                .append($(`<label class="clickable" style="padding: 0 4px 0 0; margin: 0 0 0 10px; vertical-align: middle;">Partial<input id="adbsPartialCheckbox" type="checkbox"></label>`))
            )
            .append($(`<table id="adbsTable" class="styledTable"></table>`)
                .append($(`<thead><tr><th class="anime">Anime</th><th class="artist">Artist</th><th class="song">Song</th><th class="type">Type</th><th class="vintage">Vintage</th></tr></thead>`)
                    .on("click", "th", (event) => {
                        for (const className of ["anime", "artist", "song", "type", "vintage"]) {
                            if (event.target.classList.contains(className)) {
                                tableSortChange(className);
                                sortAnisongdbTableEntries();
                                break;
                            }
                        }
                    })
                )
                .append($(`<tbody></tbody>`)
                    .on("click", "td", (event) => {
                        for (const className of ["anime", "artist", "song"]) {
                            if (event.target.classList.contains(className)) {
                                getAnisongdbData(className, event.target.innerText);
                                break;
                            }
                        }
                    })
                )
            )
        )
        .append($(`<div id="adbsSettingsContainer" class="tabSection" style="padding: 10px;"></div>`)
            .append(`<table id="adbsHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>`)
            .append($(`<div style="margin-top: 10px;"></div>`)
                .append($(`<span>Song info Box Buttons</span>`))
                .append($(`<div class="customCheckbox" style="margin: 0 0 0 8px; vertical-align: middle;"><input type="checkbox" id="adbsButtonsCheckbox"><label for="adbsButtonsCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>`))
            )
        );

    const hotkeyActions = {
        adbsWindow: () => {
            anisongdbWindow.isVisible() ? anisongdbWindow.close() : anisongdbWindow.open();
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

    createHotkeyRows([
        { action: "adbsWindow", title: "AnisongDB Window" }
    ]);
    switchTab("adbsSearch");
    $("#adbsButtonsCheckbox").prop("checked", injectSearchButtons).click(function () {
        injectSearchButtons = !injectSearchButtons;
        $(this).prop("checked", injectSearchButtons);
        saveSettings();
    });
    $("#adbsPartialCheckbox").prop("checked", true);
    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#anisongdbWindow').show()">AnisongDB</li>`);
    applyStyles();
    AMQ_addScriptData({
        name: SCRIPT_NAME,
        author: "kempanator",
        version: SCRIPT_VERSION,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqAnisongdbSearch.user.js",
        description: `
            <p>Add a window to search anisongdb.com</p>
            <p>Add buttons to song info container for quick search</p>
        `
    });
}

// send anisongdb request
function getAnisongdbData(mode, query, partial) {
    $("#adbsInfoText").remove();
    anisongdbWindow.panels[0].panel.append(`<p id="adbsInfoText">loading...</p>`);
    let url, data;
    let json = {
        and_logic: false,
        ignore_duplicate: false,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true
    };
    if (mode === "anime") {
        url = "https://anisongdb.com/api/search_request";
        json.anime_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "artist") {
        url = "https://anisongdb.com/api/search_request";
        json.artist_search_filter = {
            search: query,
            partial_match: partial,
            group_granularity: 0,
            max_other_artist: 99
        };
    }
    else if (mode === "song") {
        url = "https://anisongdb.com/api/search_request";
        json.song_name_search_filter = {
            search: query,
            partial_match: partial
        };
    }
    else if (mode === "composer") {
        url = "https://anisongdb.com/api/search_request";
        json.composer_search_filter = {
            search: query,
            partial_match: partial,
            arrangement: false
        };
    }
    else if (mode === "season") {
        query = query.trim();
        query = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
        url = `https://anisongdb.com/api/filter_season?${new URLSearchParams({ season: query })}`;
    }
    else if (mode === "ann id") {
        url = "https://anisongdb.com/api/annId_request";
        json.annId = parseInt(query);
    }
    else if (mode === "mal id") {
        url = "https://anisongdb.com/api/malIDs_request";
        json.malIds = query.split(/[, ]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
    }
    if (mode === "season") {
        data = {
            method: "GET",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
        };
    }
    else {
        data = {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(json)
        };
    }
    fetch(url, data).then(res => res.json()).then(json => {
        if (!Array.isArray(json)) {
            $("#adbsTable tbody").empty();
            $("#adbsInfoText").remove();
            anisongdbWindow.panels[0].panel.append($(`<p id="adbsInfoText"></p>`).text(JSON.stringify(json)));
        }
        else if (json.length === 0 && isRankedRunning()) {
            $("#adbsTable tbody").empty();
            $("#adbsInfoText").remove();
            anisongdbWindow.panels[0].panel.append(`<p id="adbsInfoText">AnisongDB is not available during ranked</p>`);
        }
        else {
            createTable(json);
        }
    }).catch(res => {
        $("#adbsInfoText").remove();
        anisongdbWindow.panels[0].panel.append($(`<p id="adbsInfoText"></p>`).text(res.toString()));
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
        $("#adbsInfoText").remove();
        $("#adbsTable tbody").empty();
    }
    else {
        getAnisongdbData(mode, query, partial);
    }
}

// create anisongdb results table
function createTable(json) {
    $("#adbsInfoText").remove();
    $("#adbsTable tbody").empty().append(json.map((result) => $("<tr>")
        .append($("<td>", { class: "anime", text: options.useRomajiNames ? result.animeJPName : result.animeENName }))
        .append($("<td>", { class: "artist", text: result.songArtist }))
        .append($("<td>", { class: "song", text: result.songName }))
        .append($("<td>", { class: "type", text: result.songType }))
        .append($("<td>", { class: "vintage", text: result.animeVintage }))
    ));
}

// sort table rows that already exist
function sortAnisongdbTableEntries() {
    const rows = $("#adbsTable tbody tr").toArray();
    if (tableSort.mode === "anime") {
        rows.sort((a, b) => $(a).find("td.anime").text().localeCompare($(b).find("td.anime").text()));
    }
    else if (tableSort.mode === "artist") {
        rows.sort((a, b) => $(a).find("td.artist").text().localeCompare($(b).find("td.artist").text()));
    }
    else if (tableSort.mode === "song") {
        rows.sort((a, b) => $(a).find("td.song").text().localeCompare($(b).find("td.song").text()));
    }
    else if (tableSort.mode === "type") {
        rows.sort((a, b) => songTypeSortValue(translateTypeText($(a).find("td.type").text()), translateTypeText($(b).find("td.type").text())));
    }
    else if (tableSort.mode === "vintage") {
        rows.sort((a, b) => vintageSortValue($(a).find("td.vintage").text(), $(b).find("td.vintage").text()));
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
function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// translate song type text to amq values (input example: Opening 1, ED2)
function translateTypeText(text) {
    const songType = ({ "O": 1, "E": 2, "I": 3 })[text[0]] || null;
    const songTypeNumber = parseInt(text.match(/([0-9]+)/)) || null;
    return { songType, songTypeNumber };
}

// get sorting value for song type
function songTypeSortValue(a, b) {
    if (a.songType !== b.songType) {
        return a.songType - b.songType;
    }
    if (a.songType !== 3 && b.songType !== 3) {
        return (a.songTypeNumber || 0) - (b.songTypeNumber || 0);
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
function createHotkeyRows(data) {
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
    let keys = [];
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
