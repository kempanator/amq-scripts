// ==UserScript==
// @name         AMQ Anisongdb Search
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Adds a window to search anisongdb.com in game
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnisongdbSearch.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqAnisongdbSearch.user.js
// ==/UserScript==

/*
Features:
1. Add a window for anisongdb search results
2. Add anime and artist lookup buttons to song info container for quick search
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.1";
let anisongdbWindow;
let injectSearchButtons = true;
let anisongdbSort = {animeSortAscending: false, artistSortAscending: false, songSortAscending: false, typeSortAscending: false, vintageSortAscending: false};

function setup() {
    new Listener("answer results", (payload) => {
        if (injectSearchButtons) {
            setTimeout(() => {
                $("#anisongdbSearchButtonRow").remove();
                let $row = $(`<div id="anisongdbSearchButtonRow" class="row"></div>`);
                $row.append("<h5><b>AnisongDB Search</b></h5>");
                $row.append($("<button>Anime</button>").click(() => {
                    anisongdbWindow.open();
                    $("#anisongdbSearchMode").val("Anime");
                    $("#anisongdbSearchInput").val(payload.songInfo.animeNames.romaji);
                    getAnisongdbData("anime", payload.songInfo.animeNames.romaji, false);
                }));
                $row.append($("<button>Artist</button>").click(() => {
                    anisongdbWindow.open();
                    $("#anisongdbSearchMode").val("Artist");
                    $("#anisongdbSearchInput").val(payload.songInfo.artist);
                    getAnisongdbData("artist", payload.songInfo.artist, false);
                }));
                $("#qpSongInfoLinkRow").before($row);
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
    anisongdbWindow.panels[0].panel.append(`
        <div id="anisongdbSearchRow">
            <select id="anisongdbSearchMode">
                <option value="Anime">Anime</option>
                <option value="Artist">Artist</option>
                <option value="Song">Song</option>
                <option value="Composer">Composer</option>
            </select>
            <input id="anisongdbSearchInput" type="text">
            <button id="anisongdbSearchButtonGo">Go</button>
            <label class="clickable" style="padding: 0 4px 0 0; margin: 0 0 0 10px; vertical-align: middle;">Partial<input id="anisongdbSearchPartialCheckbox" type="checkbox"></label>
        </div>
    `);
    $("#anisongdbSearchButtonGo").click(() => {
        let mode = $("#anisongdbSearchMode").val().toLowerCase();
        let query = $("#anisongdbSearchInput").val();
        let partial = $("#anisongdbSearchPartialCheckbox").prop("checked");
        if (query.trim() === "") {
            $("#anisongdbLoading").remove();
            $("#anisongdbTable").remove();
        }
        else {
            getAnisongdbData(mode, query, partial);
        }
    });
    $("#anisongdbSearchInput").keypress((event) => {
        if (event.which === 13) {
            let mode = $("#anisongdbSearchMode").val().toLowerCase();
            let query = $("#anisongdbSearchInput").val();
            let partial = $("#anisongdbSearchPartialCheckbox").prop("checked");
            if (query.trim() === "") {
                $("#anisongdbLoading").remove();
                $("#anisongdbTable").remove();
            }
            else {
                getAnisongdbData(mode, query, partial);
            }
        }
    });
    $("#anisongdbSearchPartialCheckbox").prop("checked", true);
    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#anisongdbWindow').show()">AnisongDB</li>`);
    applyStyles();
    AMQ_addScriptData({
        name: "Anisongdb Search",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <p>Add a window to search anisongdb.com</p>
            <p>Add buttons to song info container for quick search</p>
        `
    });
}

// send anisongdb request
function getAnisongdbData(mode, query, partial) {
    $("#anisongdbTable").remove();
    anisongdbWindow.panels[0].panel.append(`<p id="anisongdbLoading">loading...</p>`);
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
        anisongdbSort = {animeSortAscending: false, artistSortAscending: false, songSortAscending: false, typeSortAscending: false, vintageSortAscending: false};
        $("#anisongdbLoading").remove();
        let $table = $(`<table id="anisongdbTable"></table>`);
        let $thead = $("<thead></thead>");
        let $tbody = $("<tbody></tbody>");
        let $row = $("<tr></tr>");
        $row.append($("<th></th>").addClass("anime").text("Anime"));
        $row.append($("<th></th>").addClass("artist").text("Artist"));
        $row.append($("<th></th>").addClass("song").text("Song"));
        $row.append($("<th></th>").addClass("type").text("Type"));
        $row.append($("<th></th>").addClass("vintage").text("Vintage"));
        $thead.append($row);
        for (let result of json) {
            let $row = $("<tr></tr>");
            $row.append($("<td></td>").addClass("anime").text(options.useRomajiNames ? result.animeJPName : result.animeENName));
            $row.append($("<td></td>").addClass("artist").text(result.songArtist));
            $row.append($("<td></td>").addClass("song").text(result.songName));
            $row.append($("<td></td>").addClass("type").text(shortenType(result.songType)));
            $row.append($("<td></td>").addClass("vintage").text(result.animeVintage));
            $tbody.append($row);
        }
        $thead.on("click", "th", (event) => {
            if (event.target.classList.contains("anime")) {
                sortAnisongdbTableEntries($tbody, "anime", anisongdbSort.animeSortAscending);
                anisongdbSort.animeSortAscending = !anisongdbSort.animeSortAscending;
                anisongdbSort.artistSortAscending = false;
                anisongdbSort.songSortAscending = false;
                anisongdbSort.typeSortAscending = false;
                anisongdbSort.vintageSortAscending = false;
            }
            else if (event.target.classList.contains("artist")) {
                sortAnisongdbTableEntries($tbody, "artist", anisongdbSort.artistSortAscending);
                anisongdbSort.animeSortAscending = false;
                anisongdbSort.artistSortAscending = !anisongdbSort.artistSortAscending;
                anisongdbSort.songSortAscending = false;
                anisongdbSort.typeSortAscending = false;
                anisongdbSort.vintageSortAscending = false;
            }
            else if (event.target.classList.contains("song")) {
                sortAnisongdbTableEntries($tbody, "song", anisongdbSort.songSortAscending);
                anisongdbSort.animeSortAscending = false;
                anisongdbSort.artistSortAscending = false;
                anisongdbSort.songSortAscending = !anisongdbSort.songSortAscending;
                anisongdbSort.typeSortAscending = false;
                anisongdbSort.vintageSortAscending = false;
            }
            else if (event.target.classList.contains("type")) {
                sortAnisongdbTableEntries($tbody, "type", anisongdbSort.typeSortAscending);
                anisongdbSort.animeSortAscending = false;
                anisongdbSort.artistSortAscending = false;
                anisongdbSort.songSortAscending = false;
                anisongdbSort.typeSortAscending = !anisongdbSort.typeSortAscending;
                anisongdbSort.vintageSortAscending = false;
            }
            else if (event.target.classList.contains("vintage")) {
                sortAnisongdbTableEntries($tbody, "vintage", anisongdbSort.vintageSortAscending);
                anisongdbSort.animeSortAscending = false;
                anisongdbSort.artistSortAscending = false;
                anisongdbSort.songSortAscending = false;
                anisongdbSort.typeSortAscending = false;
                anisongdbSort.vintageSortAscending = !anisongdbSort.vintageSortAscending;
            }
        });
        $tbody.on("click", "td", (event) => {
            if (event.target.classList.contains("anime")) {
                getAnisongdbData("anime", event.target.innerText);
            }
            else if (event.target.classList.contains("artist")) {
                getAnisongdbData("artist", event.target.innerText);
            }
            else if (event.target.classList.contains("song")) {
                getAnisongdbData("song", event.target.innerText);
            }
        });
        $table.append($thead).append($tbody);
        anisongdbWindow.panels[0].panel.append($table);
    });
}

// input table body element, column name, and sort ascending boolean
function sortAnisongdbTableEntries($tbody, column, sortAscending) {
    let sortedElements = sortAscending
        ? $tbody.find("tr").toArray().sort((a, b) => $(b).find("td." + column).text().localeCompare($(a).find("td." + column).text()))
        : $tbody.find("tr").toArray().sort((a, b) => $(a).find("td." + column).text().localeCompare($(b).find("td." + column).text()));
    sortedElements.forEach((element) => { $tbody.append(element) });
}

function shortenType(type) {
    return type.replace("Opening ", "OP").replace("Ending ", "ED").replace("Insert Song", "IN");
}

// apply styles
function applyStyles() {
    //$("#anisongdbSearchStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "anisongdbSearchStyle";
    style.appendChild(document.createTextNode(`
        #anisongdbSearchButtonRow {
            margin-bottom: 10px;
        }
        #anisongdbSearchButtonRow button {
            background: #D9D9D9;
            color: #1B1B1B;
            border: 1px solid #6D6D6D;
            border-radius: 4px;
            margin: 3px 2px 0 2px;
            padding: 2px 5px;
            font-weight: bold;
        }
        #anisongdbSearchButtonRow button:hover {
            opacity: .8;
        }
        
        #anisongdbWindow select {
            color: black;
            padding: 2px 0;
        }
        #anisongdbSearchInput {
            color: black;
            width: 300px;
            padding: 0 2px;
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
        #anisongdbTable {
            width: 100%;
        }
        #anisongdbTable th, #anisongdbTable td {
            padding: 0 2px;
        }
        #anisongdbTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        #anisongdbTable tbody tr:nth-child(even) {
            background-color: #353535;
        }
        #anisongdbTable thead tr {
            background-color: #282828;
            font-weight: bold;
            cursor: pointer;
            user-select: none;
        }
        #anisongdbTable tbody tr:hover {
            color: #70B7FF;
        }
        #anisongdbTable .anime {
            width: 25%;
        }
        #anisongdbTable .artist {
            width: 25%;
        }
        #anisongdbTable .song {
            width: 25%;
        }
        #anisongdbTable .type {
            width: 10%;
        }
        #anisongdbTable .vintage {
            width: 15%;
        }
    `));
    document.head.appendChild(style);
}
