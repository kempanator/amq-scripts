// ==UserScript==
// @name         AMQ Quick Load Lists
// @namespace    https://github.com/kempanator
// @version      0.18
// @description  Adds a window for saving and quick loading anime lists
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqQuickLoadLists.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqQuickLoadLists.user.js
// ==/UserScript==

/*
How to open the window:
    bottom right gear icon > click "Load Lists"
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const SCRIPT_VERSION = "0.18";
const SCRIPT_NAME = "Quick Load Lists";
const saveData = validateLocalStorage("quickLoadLists");
let quickLoadListsWindow;
let savedLists = saveData.savedLists ?? [];
let selectedColor = saveData.selectedColor ?? "#4497ea";
let hotKeys = {
    qllWindow: loadHotkey("qllWindow", "q", false, true, false),
    animeListModal: loadHotkey("animeListModal"),
    removeList: loadHotkey("removeList"),
};

// setup
function setup() {
    new Listener("anime list update result", () => {
        setTimeout(checkSelectedList, 1);
    }).bindListener();

    quickLoadListsWindow = new AMQWindow({
        id: "quickLoadListsWindow",
        title: "Quick Load Lists",
        width: 740,
        height: 350,
        minWidth: 0,
        minHeight: 0,
        zIndex: 1010,
        resizable: true,
        draggable: true
    });
    quickLoadListsWindow.addPanel({
        id: "quickLoadListsPanel",
        width: 1.0,
        height: "100%",
        scrollable: { x: false, y: true }
    });

    $("#settingsAnimeListContainer > div .row:eq(2)")
        .append($("<div>", { class: "col-xs-6" })
            .append("<label>", { text: "Quick Load Lists Script" })
            .append($("<div>")
                .append($("<button>", { class: "btn btn-primary", text: "Open" }).click(() => {
                    quickLoadListsWindow.open();
                }))
                .append($("<button>", { class: "btn btn-danger", text: "Clear", style: "margin-left: 8px;" }).click(() => {
                    $("#qllTable .qllRow").removeClass("selected");
                    removeAllLists();
                    messageDisplayer.displayMessage("Current List Cleared");
                }))
            )
        );
    quickLoadListsWindow.window.find(".modal-header").empty()
        .append($(`<i class="fa fa-times clickAble" style="font-size: 25px; top: 8px; right: 15px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            quickLoadListsWindow.close();
        }))
        .append($(`<i class="fa fa-list-alt clickAble" style="font-size: 22px; top: 11px; right: 42px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            $("#settingModal").modal("show");
            options.selectTab("settingsAnimeListContainer", $("#smAnimeListTab"));
        }))
        .append($(`<i class="fa fa-trash clickAble" style="font-size: 23px; top: 8px; right: 73px; position: absolute;" aria-hidden="true"></i>`).click(() => {
            $("#qllTable .qllRow").removeClass("selected");
            removeAllLists();
            messageDisplayer.displayMessage("Current List Cleared");
        }))
        .append(`<h2>Quick Load Lists</h2>`)
        .append($("<div>", { class: "tabContainer" })
            .append($(`<div id="qllUseTab" class="tab clickAble"><span>Use</span></div>`).click(() => {
                switchTab("qllUse");
            }))
            .append($(`<div id="qllEditTab" class="tab clickAble"><span>Edit</span></div>`).click(() => {
                switchTab("qllEdit");
            }))
            .append($(`<div id="qllSettingsTab" class="tab clickAble"><span>Settings</span></div>`).click(() => {
                switchTab("qllSettings");
            }))
        );
    quickLoadListsWindow.panels[0].panel
        .append($("<div>", { id: "qllUseContainer", class: "tabSection" })
            .append(`<table id="qllTable"><thead></thead><tbody></tbody></table>`)
        )
        .append($("<div>", { id: "qllEditContainer", class: "tabSection" })
            .append($("<button>", { class: "btn btn-success", text: "Save", style: "margin: 5px 2px 2px 5px" }).click(() => {
                saveEditTable();
                createListTable();
                saveSettings();
            }))
            .append($("<button>", { class: "btn btn-default", style: "width: 34px; margin: 6px 2px 2px 2px; padding: 6px 0;" })
                .append(`<i class="fa fa-plus" aria-hidden="true"></i>`)
                .click(() => {
                    createEditRow($("#qllEditTable"), "", "anilist", true, true, true, true, true, "");
                }))
        )
        .append($("<div>", { id: "qllSettingsContainer", class: "tabSection" })
            .append(`<table id="qllHotkeyTable"><thead><tr><th>Action</th><th>Keybind</th></tr></thead><tbody></tbody></table>`)
            .append($("<div>")
                .append(`<span>Selected Color:</span>`)
                .append($("<input>", { id: "qllSelectedColor", type: "color", val: selectedColor }).on("change", function () {
                    selectedColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            )
            .append($("<div>")
                .append($("<label>", { class: "btn btn-default", text: "Import" })
                    .append($("<input>", { type: "file", accept: ".json", style: "display: none;" }).on("change", function () {
                        handleImport(this);
                    }))
                )
                .append($("<button>", { class: "btn btn-default", text: "Export", style: "margin-left: 5px;" }).click(function () {
                    handleExport();
                }))
            )
        );

    createHotkeyTable([
        { action: "qllWindow", title: "Open This Window" },
        { action: "animeListModal", title: "Open Anime List Modal" },
        { action: "removeList", title: "Remove List" }
    ]);

    const hotkeyActions = {
        qllWindow: () => {
            quickLoadListsWindow.isVisible() ? quickLoadListsWindow.close() : quickLoadListsWindow.open();
        },
        animeListModal: () => {
            $("#settingModal").modal("show");
            options.selectTab("settingsAnimeListContainer", $("#smAnimeListTab"));
        },
        removeList: () => {
            removeAllLists();
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

    options.$INCLUDE_WATCHING_CHECKBOX.click(checkSelectedList);
    options.$INCLUDE_COMPLETED_CHECKBOX.click(checkSelectedList);
    options.$INCLUDE_ON_HOLD_CHECKBOX.click(checkSelectedList);
    options.$INCLUDE_DROPPED_CHECKBOX.click(checkSelectedList);
    options.$INCLUDE_PLANNING_CHECKBOX.click(checkSelectedList);

    $("#optionListSettings").before($("<li>", { class: "clickAble", text: "Load Lists" }).click(() => {
        quickLoadListsWindow.open();
    }));
    switchTab("qllUse");
    createListTable();
    createEditTable();
    applyStyles();
    AMQ_addScriptData({
        name: SCRIPT_NAME,
        author: "kempanator",
        version: SCRIPT_VERSION,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqQuickLoadLists.user.js",
        description: `
            <p>Adds a window for saving and quick loading anime lists</p>
            <p>To open the window: bottom right gear icon > click "Load Lists"</p>
        `
    });
}

// reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#quickLoadListsWindow");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
}

// prompt import method with SweetAlert modal
function askImportMode() {
    return swal({
        title: "Select Import Method",
        input: "select",
        inputOptions: {
            1: "Append to current lists",
            2: "Replace all lists",
            3: "Replace lists & settings",
        },
        inputPlaceholder: " ",
        showCancelButton: true,
        cancelButtonText: "Cancel",
        allowOutsideClick: true
    }).then(res => res.value);
}

// handle settings file import
async function handleImport(fileInput) {
    if (!fileInput.files.length) return;
    try {
        const text = await fileInput.files[0].text();
        const json = JSON.parse(text);
        if (!Array.isArray(json.savedLists) || !json.savedLists.every(x => x.username && x.type)) throw new Error();
        $(fileInput).val("");
        const mode = await askImportMode();
        if (!mode) return;
        switch (mode) {
            case "1":
                savedLists = savedLists.concat(json.savedLists);
                break;
            case "2":
                savedLists = json.savedLists;
                break;
            case "3":
                savedLists = json.savedLists ?? [];
                hotKeys = {
                    qllWindow: loadHotkey("qllWindow", "Q", false, true, false, json),
                    animeListModal: loadHotkey("animeListModal", "", false, false, false, json),
                    removeList: loadHotkey("removeList", "", false, false, false, json),
                }
                selectedColor = json.selectedColor ?? "#4497ea";
                updateSettingsUI();
                applyStyles();
                break;
        }
        createListTable();
        createEditTable();
        saveSettings();
        messageDisplayer.displayMessage(`Imported ${json.savedLists.length} list${json.savedLists.length === 1 ? "" : "s"}`);
    }
    catch (error) {
        console.error(error);
        messageDisplayer.displayMessage("Upload Error");
    }
}

// handle settings file export
function handleExport() {
    if (savedLists.length) {
        const settings = { savedLists, hotKeys, selectedColor };
        const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
        const element = document.createElement("a");
        element.setAttribute("href", data);
        element.setAttribute("download", "amq quick load lists backup.json");
        document.body.appendChild(element);
        element.click();
        element.remove();
    }
    else {
        messageDisplayer.displayMessage("Nothing to export");
    }
}

// shorten anime list type in the table
function shortenListType(type) {
    if (type === "anilist") return "ANI";
    if (type === "myanimelist") return "MAL";
    if (type === "kitsu") return "KIT";
}

// get the full URL for a given username and list type
function getListURL(username, type) {
    if (type === "anilist") return "https://anilist.co/user/" + username;
    if (type === "myanimelist") return "https://myanimelist.net/profile/" + username;
    if (type === "kitsu") return "https://kitsu.io/users/" + username;
}

// when you click a username in the table
function loadList($row, username, type, watching, completed, hold, dropped, planning) {
    const listTypeMap = { anilist: "ANILIST", myanimelist: "MAL", kitsu: "KITSU" };
    const userNameInputMap = { anilist: "#aniListUserNameInput", myanimelist: "#malUserNameInput", kitsu: "#kitsuUserNameInput" };
    const listener = new Listener("anime list update result", (data) => {
        listener.unbindListener();
        $("#qllTable .qllRow").removeClass("selected");
        if (data.success) {
            $(userNameInputMap[type]).val(username);
            setAllStatusCheckboxes(watching, completed, hold, dropped, planning);
            $row.addClass("selected");
        }
        else {
            messageDisplayer.displayMessage("Update Unsuccessful", data.message);
            checkSelectedList();
        }
        if (type !== "anilist") removeAnilist();
        if (type !== "myanimelist") removeMyanimelist();
        if (type !== "kitsu") removeKitsu();
        $row.find("i.fa-spinner").hide();
    });
    listener.bindListener();
    $row.find("i.fa-spinner").show();
    socket.sendCommand({
        type: "library",
        command: "update anime list",
        data: { newUsername: username, listType: listTypeMap[type] }
    });
}

// remove anilist list
function removeAnilist() {
    if ($("#aniListLastUpdateDate").text()) {
        $("#aniListUserNameInput").val("");
        socket.sendCommand({
            type: "library",
            command: "update anime list",
            data: { newUsername: "", listType: "ANILIST" }
        });
    }
}

// remove myanimelist list
function removeMyanimelist() {
    if ($("#malLastUpdateDate").text()) {
        $("#malUserNameInput").val("");
        socket.sendCommand({
            type: "library",
            command: "update anime list",
            data: { newUsername: "", listType: "MAL" }
        });
    }
}

// remove kitsu list
function removeKitsu() {
    if ($("#kitsuLastUpdated").text()) {
        $("#kitsuUserNameInput").val("");
        socket.sendCommand({
            type: "library",
            command: "update anime list",
            data: { newUsername: "", listType: "KITSU" }
        });
    }
}

// remove all lists
function removeAllLists() {
    removeAnilist();
    removeMyanimelist();
    removeKitsu();
}

// check if your current list settings match any saved lists and mark the found list as selected
function checkSelectedList() {
    const $rows = $("#qllTable .qllRow").removeClass("selected");
    if (!$rows.length) return;
    const usernames = {
        anilist: $("#aniListUserNameInput").val().trim().toLowerCase(),
        myanimelist: $("#malUserNameInput").val().trim().toLowerCase(),
        kitsu: $("#kitsuUserNameInput").val().trim().toLowerCase()
    };
    const flags = {
        watching: options.$INCLUDE_WATCHING_CHECKBOX.prop("checked"),
        completed: options.$INCLUDE_COMPLETED_CHECKBOX.prop("checked"),
        hold: options.$INCLUDE_ON_HOLD_CHECKBOX.prop("checked"),
        dropped: options.$INCLUDE_DROPPED_CHECKBOX.prop("checked"),
        planning: options.$INCLUDE_PLANNING_CHECKBOX.prop("checked")
    };
    savedLists.forEach((list, index) => {
        const nameMatches = list.username.toLowerCase() === usernames[list.type];
        const flagsMatch = Object.entries(flags).every(([key, val]) => list[key] === val);
        if (nameMatches && flagsMatch) {
            $rows.eq(index).addClass("selected");
        }
    });
}

// set the status of the Anime Lists checkbox and send the command to the server
function setStatusCheckbox($checkbox, commandName, status) {
    if ($checkbox.prop("checked") !== status) {
        $checkbox.prop("checked", status);
        socket.sendCommand({
            type: "settings",
            command: "update use list entry " + commandName,
            data: { on: status }
        });
    }
}

// set the status of all checkboxes in Anime Lists
function setAllStatusCheckboxes(watching, completed, hold, dropped, planning) {
    setStatusCheckbox(options.$INCLUDE_WATCHING_CHECKBOX, "watching", watching);
    setStatusCheckbox(options.$INCLUDE_COMPLETED_CHECKBOX, "completed", completed);
    setStatusCheckbox(options.$INCLUDE_ON_HOLD_CHECKBOX, "on hold", hold);
    setStatusCheckbox(options.$INCLUDE_DROPPED_CHECKBOX, "dropped", dropped);
    setStatusCheckbox(options.$INCLUDE_PLANNING_CHECKBOX, "planning", planning);
}

// create the table that shows all saved lists
function createListTable() {
    const $tbody = $("#qllTable tbody").empty();
    for (const list of savedLists) {
        const { username, type, watching, completed, hold, dropped, planning, comment } = list;
        const $row = $("<tr>", { class: "qllRow" })
            .append($("<td>", { class: "username", text: username }).click(() => {
                loadList($row, username, type, watching, completed, hold, dropped, planning);
            }))
            .append($("<td>", { class: "type" })
                .append($("<a>", { href: getListURL(username, type), target: "_blank", text: shortenListType(type) }))
            )
            .append($("<td>", { class: "status" })
                .append($("<span>", { text: "W" }).toggleClass("disabled", !watching))
                .append($("<span>", { text: "C" }).toggleClass("disabled", !completed))
                .append($("<span>", { text: "H" }).toggleClass("disabled", !hold))
                .append($("<span>", { text: "D" }).toggleClass("disabled", !dropped))
                .append($("<span>", { text: "P" }).toggleClass("disabled", !planning))
            )
            .append($("<td>", { class: "comment", text: comment })
                .append($("<i>", { class: "fa fa-spinner fa-spin" }).hide())
            );
        $tbody.append($row);
    };
    checkSelectedList();
}

// create the table where you edit lists
function createEditTable() {
    $("#qllEditTable").remove();
    const $table = $("<div>", { id: "qllEditTable" });
    for (const list of savedLists) {
        createEditRow($table, list.username, list.type, list.watching, list.completed, list.hold, list.dropped, list.planning, list.comment);
    }
    $("#qllEditContainer").append($table);
}

// create new row in list edit table
function createEditRow($table, username, type, watching, completed, hold, dropped, planning, comment) {
    // list row
    const $row = $("<div>", { class: "qllEditRow" });

    // move-up arrow
    $("<i>", { class: "fa fa-chevron-up arrow clickAble", "aria-hidden": "true" })
        .on("click", () => { $row.prev().insertAfter($row); })
        .appendTo($row);

    // move-down arrow
    $("<i>", { class: "fa fa-chevron-down arrow clickAble", "aria-hidden": "true" })
        .on("click", () => { $row.next().insertBefore($row); })
        .appendTo($row);

    // username input
    $("<input>", { class: "form-control username", type: "text", placeholder: "username" })
        .val(username)
        .appendTo($row);

    // list database select
    $("<select>", { class: "form-control type" })
        .append("<option>anilist</option>")
        .append("<option>myanimelist</option>")
        .append("<option>kitsu</option>")
        .val(type)
        .appendTo($row);

    // watching button
    $("<button>", { class: "btn btn-default status watching", text: "W" })
        .toggleClass("off", !watching)
        .click(function () { $(this).toggleClass("off"); })
        .appendTo($row);

    // completed button
    $("<button>", { class: "btn btn-default status completed", text: "C" })
        .toggleClass("off", !completed)
        .click(function () { $(this).toggleClass("off"); })
        .appendTo($row);

    // hold button
    $("<button>", { class: "btn btn-default status hold", text: "H" })
        .toggleClass("off", !hold)
        .click(function () { $(this).toggleClass("off"); })
        .appendTo($row);

    // dropped button
    $("<button>", { class: "btn btn-default status dropped", text: "D" })
        .toggleClass("off", !dropped)
        .click(function () { $(this).toggleClass("off"); })
        .appendTo($row);

    // planning button
    $("<button>", { class: "btn btn-default status planning", text: "P" })
        .toggleClass("off", !planning)
        .click(function () { $(this).toggleClass("off"); })
        .appendTo($row);

    // comment input
    $("<input>", { class: "form-control comment", type: "text", placeholder: "comment" })
        .val(comment)
        .appendTo($row);

    // delete button
    $("<button>", { class: "btn btn-danger delete" })
        .append($("<i>", { class: "fa fa-minus", "aria-hidden": "true" }))
        .on("click", () => {
            $row.remove();
        })
        .appendTo($row);

    $table.append($row);
}

// load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false, data) {
    const item = data?.hotKeys?.[action] ?? saveData.hotKeys?.[action];
    return {
        key: (item?.key ?? key).toUpperCase(),
        ctrl: item?.ctrl ?? item?.ctrlKey ?? ctrl,
        alt: item?.alt ?? item?.altKey ?? alt,
        shift: item?.shift ?? item?.shiftKey ?? shift
    }
}

// create hotkey rows and add to table
function createHotkeyTable(data) {
    const $tbody = $("#qllHotkeyTable tbody");
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

// update settings window inputs on import
function updateSettingsUI() {
    for (const action of Object.keys(hotKeys)) {
        $(`#qllHotkeyTable input[data-action="${action}"]`).val(bindingToText(hotKeys[action]));
    }
    $("#qllSelectedColor").val(selectedColor);
}

// save edit table
function saveEditTable() {
    savedLists = $("#qllEditTable .qllEditRow").toArray().map(row => {
        const $row = $(row);
        return {
            username: $row.find(".username").val(),
            type: $row.find(".type").val(),
            watching: !$row.find(".watching").hasClass("off"),
            completed: !$row.find(".completed").hasClass("off"),
            hold: !$row.find(".hold").hasClass("off"),
            dropped: !$row.find(".dropped").hasClass("off"),
            planning: !$row.find(".planning").hasClass("off"),
            comment: $row.find(".comment").val()
        };
    });
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
    localStorage.setItem("quickLoadLists", JSON.stringify({
        savedLists,
        hotKeys,
        selectedColor
    }));
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
        #quickLoadListsWindow .modal-header {
            padding: 0;
            height: 74px;
        }
        #quickLoadListsWindow .modal-header h2 {
            font-size: 22px;
            text-align: left;
            height: 45px;
            margin: 0;
            padding: 10px;
            display: block;
        }
        #quickLoadListsWindow .modal-header .tabContainer {
            border-bottom: none;
        }
        #quickLoadListsWindow .modal-header .tabContainer .tab::before {
            box-shadow: none;
        }
        #quickLoadListsWindow .modal-header i.fa:hover {
            opacity: .7;
        }
        #qllTable {
            margin-top: 8px;
        }
        #qllTable .qllRow {
            height: 18px;
            line-height: normal;
            white-space: nowrap;
        }
        #qllTable .username {
            padding-left: 10px;
            cursor: pointer;
        }
        #qllTable .username:hover {
            text-shadow: 0 0 5px ${selectedColor};
        }
        #qllTable .qllRow.selected .username {
            color: ${selectedColor};
        }
        #qllTable .type {
            font-weight: bold;
            padding-left: 15px;
        }
        #qllTable .status {
            padding-left: 10px;
        }
        #qllTable .status span {
            font-weight: bold;
            padding-left: 5px;
        }
        #qllTable .comment {
            padding-left: 15px;
        }
        #qllTable i.fa-spinner {
            margin-left: 10px;
        }
        #qllEditTable .qllEditRow {
            margin: 4px;
            clear: both;
        }
        #qllEditTable i.arrow {
            padding: 0 4px;
        }
        #qllEditTable i.arrow:hover {
            opacity: .7;
        }
        #qllEditTable input.username {
            color: black;
            width: 120px;
            margin: 0 2px;
            padding: 6px 8px;
            display: inline-block;
        }
        #qllEditTable select.type {
            color: black;
            width: 120px;
            margin: 0 2px;
            padding: 6px 4px;
            display: inline-block;
        }
        #qllEditTable input.comment {
            color: black;
            width: 200px;
            margin: 0 2px;
            padding: 6px 8px;
            display: inline-block;
        }
        #qllEditTable button {
            display: inline-block;
            margin: 0 2px;
            vertical-align: baseline;
        }
        #qllEditTable button.status {
            width: 30px;
            padding: 6px 0;
        }
        #qllEditTable button.delete {
            width: 34px;
            padding: 6px 0;
        }
        #qllEditTable button.status.off {
            opacity: .5;
        }
        #qllSettingsContainer > div {
            margin: 10px 0 0 10px;
        }
        #qllHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #qllHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #qllHotkeyTable input.hk-input {
            width: 200px;
            color: black;
            cursor: pointer;
            user-select: none;
        }
        #qllSelectedColor {
            width: 60px;
            margin-left: 10px;
            display: inline-block;
            vertical-align: middle;
        }
    `;
    let style = document.getElementById("quickLoadListsStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "quickLoadListsStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
