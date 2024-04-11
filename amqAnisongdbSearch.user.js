// ==UserScript==
// @name         AMQ Anisongdb Search
// @namespace    https://github.com/kempanator
// @version      0.8
// @description  Adds a window to search anisongdb.com in game
// @author       kempanator
// @match        https://animemusicquiz.com/*
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
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.8";
const saveData = validateLocalStorage("anisongdbSearch");
let anisongdbWindow;
let injectSearchButtons = saveData.injectSearchButtons ?? true;
let windowHotKey = saveData.windowHotKey ?? {key: "", altKey: false, ctrlKey: false};
let tableSort = ["anime", true]; // [mode, ascending]

function setup() {
    new Listener("answer results", (payload) => {
        if (injectSearchButtons) {
            setTimeout(() => {
                $("#adbsSearchButtonRow").remove();
                $("#qpSongInfoLinkRow").before($(`<div id="adbsSearchButtonRow" class="row"></div>`)
                    .append("<h5><b>AnisongDB Search</b></h5>")
                    .append($("<button>Anime</button>").click(() => {
                        anisongdbWindow.open();
                        $("#adbsQueryMode").val("Anime");
                        $("#adbsQueryInput").val(payload.songInfo.animeNames.romaji);
                        getAnisongdbData("anime", payload.songInfo.animeNames.romaji, false);
                    }))
                    .append($("<button>Artist</button>").click(() => {
                        anisongdbWindow.open();
                        $("#adbsQueryMode").val("Artist");
                        $("#adbsQueryInput").val(payload.songInfo.artist);
                        getAnisongdbData("artist", payload.songInfo.artist, false);
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
        scrollable: {x: false, y: true}
    });
    anisongdbWindow.window.find(".modal-header").empty()
        .append($(`<i class="fa fa-times clickAble" style="font-size: 25px; top: 8px; right: 15px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            anisongdbWindow.close();
        }))
        .append($(`<i class="fa fa-globe clickAble" style="font-size: 22px; top: 11px; right: 42px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            window.open("https://anisongdb.com","_blank");
        }))
        .append(`<h2>AnisongDB Search</h2>`)
        .append($(`<div class="tabContainer">`)
            .append($(`<div id="adbsSearchTab" class="tab clickAble"><span>Search</span></div>`).click(function() {
                tabReset();
                $(this).addClass("selected");
                $("#adbsSearchContainer").show();
            }))
            .append($(`<div id="adbsSettingsTab" class="tab clickAble"><span>Settings</span></div>`).click(function() {
                tabReset();
                $(this).addClass("selected");
                $("#adbsSettingsContainer").show();
            }))
        );

    anisongdbWindow.panels[0].panel
        .append($(`<div id="adbsSearchContainer"></div>`)
            .append($(`<div id="anisongdbSearchRow"></div>`)
                .append($(`<select id="adbsQueryMode" style="padding: 2px 0;"><option value="Anime">Anime</option><option value="Artist">Artist</option><option value="Song">Song</option><option value="Composer">Composer</option></select>`))
                .append($(`<input id="adbsQueryInput" type="text" style="width: 300px; padding: 0 2px;">`).keypress((event) => {
                    if (event.which === 13) {
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
                        if (event.target.classList.contains("anime")) {
                            tableSort = ["anime", tableSort[0] === "anime" ? !tableSort[1] : true];
                            sortAnisongdbTableEntries();
                        }
                        else if (event.target.classList.contains("artist")) {
                            tableSort = ["artist", tableSort[0] === "artist" ? !tableSort[1] : true];
                            sortAnisongdbTableEntries();
                        }
                        else if (event.target.classList.contains("song")) {
                            tableSort = ["song", tableSort[0] === "song" ? !tableSort[1] : true];
                            sortAnisongdbTableEntries();
                        }
                        else if (event.target.classList.contains("type")) {
                            tableSort = ["type", tableSort[0] === "type" ? !tableSort[1] : true];
                            sortAnisongdbTableEntries();
                        }
                        else if (event.target.classList.contains("vintage")) {
                            tableSort = ["vintage", tableSort[0] === "vintage" ? !tableSort[1] : true];
                            sortAnisongdbTableEntries();
                        }
                    })
                )
                .append($(`<tbody></tbody>`)
                    .on("click", "td", (event) => {
                        if (event.target.classList.contains("anime")) {
                            getAnisongdbData("anime", event.target.innerText);
                        }
                        else if (event.target.classList.contains("artist")) {
                            getAnisongdbData("artist", event.target.innerText);
                        }
                        else if (event.target.classList.contains("song")) {
                            getAnisongdbData("song", event.target.innerText);
                        }
                    })
                )
            )
        )
        .append($(`<div id="adbsSettingsContainer" style="padding: 10px;"></div>`)
            .append($(`<div></div>`)
                .append($(`<span>Open this window</span>`))
                .append($(`<select id="adbsWindowHotkeySelect" style="margin-left: 10px; padding: 3px 0;"><option>ALT</option><option>CTRL</option><option>CTRL ALT</option></select>`).on("change", function() {
                    windowHotKey.altKey = this.value.includes("ALT");
                    windowHotKey.ctrlKey = this.value.includes("CTRL");
                    saveSettings();
                }))
                .append($(`<input type="text" maxlength="1" style="width: 40px; margin-left: 10px;">`).val(windowHotKey.key).on("change", function() {
                    windowHotKey.key = this.value.toLowerCase();
                    saveSettings();
                }))
            )
            .append($(`<div style="margin-top: 10px;"></div>`)
                .append($(`<span>Song info Box Buttons</span>`))
                .append($(`<div class="customCheckbox" style="margin: 0 0 0 8px; vertical-align: middle;"><input type="checkbox" id="adbsButtonsCheckbox"><label for="adbsButtonsCheckbox"><i class="fa fa-check" aria-hidden="true"></i></label></div>`))
            )
        );

    document.body.addEventListener("keydown", (event) => {
        const key = event.key;
        const altKey = event.altKey;
        const ctrlKey = event.ctrlKey;
        if (key === windowHotKey.key && altKey === windowHotKey.altKey && ctrlKey === windowHotKey.ctrlKey) {
            anisongdbWindow.isVisible() ? anisongdbWindow.close() : anisongdbWindow.open();
        }
    });

    tabReset();
    $("#adbsButtonsCheckbox").prop("checked", injectSearchButtons).click(function() {
        injectSearchButtons = !injectSearchButtons;
        $(this).prop("checked", injectSearchButtons);
    });
    $("#adbsSearchTab").addClass("selected");
    $("#adbsSearchContainer").show();
    $("#adbsPartialCheckbox").prop("checked", true);
    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#anisongdbWindow').show()">AnisongDB</li>`);
    applyStyles();
    AMQ_addScriptData({
        name: "Anisongdb Search",
        author: "kempanator",
        version: version,
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
    let json = {};
    json.and_logic = false;
    json.ignore_duplicate = false;
    json.opening_filter = true;
    json.ending_filter = true;
    json.insert_filter = true;
    if (mode === "anime") json.anime_search_filter = {search: query, partial_match: partial};
    else if (mode === "artist") json.artist_search_filter = {search: query, partial_match: partial, group_granularity: 0, max_other_artist: 99};
    else if (mode === "song") json.song_name_search_filter = {search: query, partial_match: partial};
    else if (mode === "composer") json.composer_search_filter = {search: query, partial_match: partial, arrangement: false};
    fetch("https://anisongdb.com/api/search_request", {
        method: "POST",
        headers: {"Accept": "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(json)
    }).then(res => res.json()).then(json => {
        if (json.length === 0 && (ranked.currentState === ranked.RANKED_STATE_IDS.RUNNING || ranked.currentState === ranked.RANKED_STATE_IDS.CHAMP_RUNNING)) {
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

// go button press
function doSearch() {
    let mode = $("#adbsQueryMode").val().toLowerCase();
    let query = $("#adbsQueryInput").val();
    let partial = $("#adbsPartialCheckbox").prop("checked");
    if (query.trim() === "") {
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
    $("#adbsTable tbody").empty().append(json.map((result) => $("<tr></tr>")
        .append($("<td></td>").addClass("anime").text(options.useRomajiNames ? result.animeJPName : result.animeENName))
        .append($("<td></td>").addClass("artist").text(result.songArtist))
        .append($("<td></td>").addClass("song").text(result.songName))
        .append($("<td></td>").addClass("type").text(shortenType(result.songType)))
        .append($("<td></td>").addClass("vintage").text(result.animeVintage))
    ));
}

// sort table rows that already exist
function sortAnisongdbTableEntries() {
    let rows = $("#adbsTable tbody tr").toArray();
    if (tableSort[0] === "anime") {
        rows.sort((a, b) => $(a).find("td.anime").text().localeCompare($(b).find("td.anime").text()));
    }
    else if (tableSort[0] === "artist") {
        rows.sort((a, b) => $(a).find("td.artist").text().localeCompare($(b).find("td.artist").text()));
    }
    else if (tableSort[0] === "song") {
        rows.sort((a, b) => $(a).find("td.song").text().localeCompare($(b).find("td.song").text()));
    }
    else if (tableSort[0] === "type") {
        rows.sort((a, b) => songTypeSortValue($(a).find("td.type").text()) - songTypeSortValue($(b).find("td.type").text()));
    }
    else if (tableSort[0] === "vintage") {
        rows.sort((a, b) => vintageSortValue($(a).find("td.vintage").text()) - vintageSortValue($(b).find("td.vintage").text()));
    }
    if (!tableSort[1]) rows.reverse();
    $("#adbsTable tbody").append(rows);
}

// reset tabs
function tabReset() {
    $("#adbsSearchTab").removeClass("selected");
    $("#adbsSettingsTab").removeClass("selected");
    $("#adbsSearchContainer").hide();
    $("#adbsSettingsContainer").hide();
}

// input full song type text, return shortened version
function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// get sorting value for song type
function songTypeSortValue(songType) {
    if (!songType) return 0;
    let type = Object({"O": 0, "E": 1, "I": 2})[songType[0]];
    let number = parseInt(songType.substring(2));
    return (type || 0) * 1000 + (number || 0);
}

// get sorting value for anime vintage
function vintageSortValue(vintage) {
    if (!vintage) return 0;
    let split = vintage.split(" ");
    let year = parseInt(split[1]);
    if (isNaN(year)) return 0;
    let season = Object({"Winter": .1, "Spring": .2, "Summer": .3, "Fall": .4})[split[0]];
    if (!season) return 0;
    return year + season;
}

// save settings
function saveSettings() {
    let settings = {
        injectSearchButtons: injectSearchButtons,
        windowHotKey: windowHotKey
    };
    localStorage.setItem("anisongdbSearch", JSON.stringify(settings));
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
    //$("#anisongdbSearchStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "anisongdbSearchStyle";
    style.appendChild(document.createTextNode(`
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
    `));
    document.head.appendChild(style);
}
