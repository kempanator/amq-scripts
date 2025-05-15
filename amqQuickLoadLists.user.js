// ==UserScript==
// @name         AMQ Quick Load Lists
// @namespace    https://github.com/kempanator
// @version      0.10
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
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.10";
const saveData = validateLocalStorage("quickLoadLists");
let savedLists = saveData.savedLists ?? [];
let selectedColor = saveData.selectedColor ?? "#4497ea";
let quickLoadListsWindow;
let hotKeys = {
    qllWindow: loadHotkey("qllWindow", "q", false, true, false),
    animeListModal: loadHotkey("animeListModal"),
    removeList: loadHotkey("removeList"),
};

// setup
function setup() {
    new Listener("anime list update result", (data) => {
        setTimeout(() => { checkSelectedList() }, 10);
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
        .append($(`<div class="col-xs-6"></div>`)
            .append($(`<label>Quick Load Lists Script</label>`))
            .append($(`<div></div>`)
                .append($(`<button class="btn btn-primary">Open</button>`).click(() => {
                    quickLoadListsWindow.open();
                }))
                .append($(`<button class="btn btn-danger" style="margin-left: 8px">Clear</button>`).click(() => {
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
        .append($(`<div class="tabContainer">`)
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
        .append($(`<div id="qllUseContainer" class="tabSection"></div>`)
            .append(`<table id="qllTable"><thead></thead><tbody></tbody></table>`)
        )
        .append($(`<div id="qllEditContainer" class="tabSection"></div>`)
            .append($(`<button class="btn btn-success" style="margin: 5px 2px 2px 5px">Save</button>`).click(() => {
                saveEditTable();
                createListTable();
                saveSettings();
            }))
            .append($(`<button class="btn btn-default" style="width: 34px; margin: 6px 2px 2px 2px; padding: 6px 0;"><i class="fa fa-plus" aria-hidden="true"></i></button>`).click(() => {
                createEditRow($("#qllEditTable"), "", "anilist", true, true, true, true, true);
            }))
        )
        .append($(`<div id="qllSettingsContainer" class="tabSection"></div>`)
            .append(`<div id="qllHotkeyContainer">
                <table id="qllHotkeyTable">
                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>Key</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>`)
            .append($(`<div></div>`)
                .append($(`<span>Selected Color:</span>`))
                .append($(`<input id="qllSelectedColor" type="color">`).val(selectedColor).on("change", function () {
                    selectedColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            )
            .append($(`<div></div>`)
                .append($(`<label class="btn btn-default">Import</label>`)
                    .append($(`<input type="file" style="display: none">`).on("change", function () {
                        if (this.files.length) {
                            this.files[0].text().then((data) => {
                                try {
                                    const json = JSON.parse(data);
                                    if (Array.isArray(json.savedLists) && json.savedLists.every((x) => x.username !== undefined && x.type !== undefined)) {
                                        $(this).val("");
                                        swal({
                                            title: "Select Import Method",
                                            input: "select",
                                            inputPlaceholder: " ",
                                            inputOptions: { 1: "Append to current lists", 2: "Replace all lists", 3: "Replace lists & settings" },
                                            showCancelButton: true,
                                            cancelButtonText: "Cancel",
                                            allowOutsideClick: true
                                        }).then((result) => {
                                            if (result.value) {
                                                if (result.value === "1") {
                                                    savedLists = savedLists.concat(json.savedLists);
                                                }
                                                else if (result.value === "2") {
                                                    savedLists = json.savedLists;
                                                }
                                                else if (result.value === "3") {
                                                    savedLists = json.savedLists ?? [];
                                                    hotKeys = {
                                                        qllWindow: json.hotKeys?.qllWindow ?? { key: "q", ctrl: false, alt: true, shift: false },
                                                        animeListModal: json.hotKeys?.animeListModal ?? { key: "", ctrl: false, alt: false, shift: false },
                                                        removeList: json.hotKeys?.removeList ?? { key: "", ctrl: false, alt: false, shift: false },
                                                    }
                                                    selectedColor = json.selectedColor ?? "#4497ea";
                                                    updateSettingsUI();
                                                    applyStyles();
                                                }
                                                createListTable();
                                                createEditTable();
                                                saveSettings();
                                                messageDisplayer.displayMessage(`Imported ${json.savedLists.length} list${json.savedLists.length === 1 ? "" : "s"}`);
                                            }
                                        });
                                    }
                                    else {
                                        messageDisplayer.displayMessage("Upload Error");
                                    }
                                }
                                catch {
                                    messageDisplayer.displayMessage("Upload Error");
                                }
                            });
                        }
                    }))
                )
                .append($(`<button class="btn btn-default" style="margin-left: 5px">Export</button>`).click(function () {
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
                }))
            )
        );
    switchTab("qllUse");
    createListTable();
    createEditTable();
    createHotkeyRow("Open This Window", "qllWindow");
    createHotkeyRow("Open Anime List Modal", "animeListModal");
    createHotkeyRow("Remove List", "removeList");

    $("#optionListSettings").before($(`<li class="clickAble">Load Lists</li>`).click(() => {
        quickLoadListsWindow.open();
    }));

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
            if (match(bind) && hotkeyActions.hasOwnProperty(action)) {
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

    applyStyles();
    AMQ_addScriptData({
        name: "Quick Load Lists",
        author: "kempanator",
        version: version,
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

// shorten anime list type in the table
function shortenListType(type) {
    if (type === "anilist") return "ANI";
    if (type === "myanimelist") return "MAL";
    if (type === "kitsu") return "KIT";
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
    socket.sendCommand({ type: "library", command: "update anime list", data: { newUsername: username, listType: listTypeMap[type] } });
}

function removeAnilist() {
    if ($("#aniListLastUpdateDate").text()) {
        $("#aniListUserNameInput").val("");
        socket.sendCommand({ type: "library", command: "update anime list", data: { newUsername: "", listType: "ANILIST" } });
    }
}

function removeMyanimelist() {
    if ($("#malLastUpdateDate").text()) {
        $("#malUserNameInput").val("");
        socket.sendCommand({ type: "library", command: "update anime list", data: { newUsername: "", listType: "MAL" } });
    }
}

function removeKitsu() {
    if ($("#kitsuLastUpdated").text()) {
        $("#kitsuUserNameInput").val("");
        socket.sendCommand({ type: "library", command: "update anime list", data: { newUsername: "", listType: "KITSU" } });
    }
}

function removeAllLists() {
    removeAnilist();
    removeMyanimelist();
    removeKitsu();
}

// check if your current list settings match any saved lists and mark the found list as selected
function checkSelectedList() {
    const $rows = $("#qllTable .qllRow");
    if ($rows.length) {
        $rows.removeClass("selected");
        savedLists.forEach((list, index) => {
            if (((list.type === "anilist" && list.username.toLowerCase() === $("#aniListUserNameInput").val().toLowerCase()) ||
                (list.type === "myanimelist" && list.username.toLowerCase() === $("#malUserNameInput").val().toLowerCase()) ||
                (list.type === "kitsu" && list.username.toLowerCase() === $("#kitsuUserNameInput").val().toLowerCase())) &&
                list.watching === options.$INCLUDE_WATCHING_CHECKBOX.prop("checked") &&
                list.completed === options.$INCLUDE_COMPLETED_CHECKBOX.prop("checked") &&
                list.hold === options.$INCLUDE_ON_HOLD_CHECKBOX.prop("checked") &&
                list.dropped === options.$INCLUDE_DROPPED_CHECKBOX.prop("checked") &&
                list.planning === options.$INCLUDE_PLANNING_CHECKBOX.prop("checked")) {
                $rows.eq(index).addClass("selected");
            }
        });
    }
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
        $tbody.append($(`<tr class="qllRow"></tr>`)
            .append($(`<td class="username"></td>`).text(list.username).click(() => {
                loadList($row, list.username, list.type, list.watching, list.completed, list.hold, list.dropped, list.planning);
            }))
            .append($(`<td class="type"></td>`)
                .append($(`<a href="${getListURL(list.username, list.type)}" target="_blank"></a>`).text(shortenListType(list.type)))
            )
            .append($(`<td class="status"></td>`)
                .append($(`<span>W</span>`).addClass(list.watching ? "" : "disabled"))
                .append($(`<span>C</span>`).addClass(list.completed ? "" : "disabled"))
                .append($(`<span>H</span>`).addClass(list.hold ? "" : "disabled"))
                .append($(`<span>D</span>`).addClass(list.dropped ? "" : "disabled"))
                .append($(`<span>P</span>`).addClass(list.planning ? "" : "disabled"))
            )
            .append($(`<td class="comment"></td>`).text(list.comment)
                .append($(`<i class="fa fa-spinner fa-spin"></i>`).hide())
            )
        );
    };
    checkSelectedList();
}

// create the table where you edit lists
function createEditTable() {
    $("#qllEditTable").remove();
    const $table = $(`<div id="qllEditTable"></div>`)
    for (const list of savedLists) {
        createEditRow($table, list.username, list.type, list.watching, list.completed, list.hold, list.dropped, list.planning, list.comment);
    }
    $("#qllEditContainer").append($table);
}

// create new row in list edit table
function createEditRow($table, username, type, watching, completed, hold, dropped, planning, comment) {
    $table.append($(`<div class="qllEditRow"></div>`)
        .append($(`<i class="fa fa-chevron-up arrow clickAble" aria-hidden="true"></i>`).click(function () {
            $(this).parent().prev().insertAfter($(this).parent());
        }))
        .append($(`<i class="fa fa-chevron-down arrow clickAble" aria-hidden="true"></i>`).click(function () {
            $(this).parent().next().insertBefore($(this).parent());
        }))
        .append($(`<input class="form-control username" type="text" placeholder="username">`).val(username))
        .append($(`<select class="form-control type"></select>`)
            .append(`<option>aniList</option>`)
            .append(`<option>myanimelist</option>`)
            .append(`<option>kitsu</option>`)
            .val(type)
        )
        .append($(`<button class="btn btn-default status watching">W</button>`).addClass(watching ? "" : "off").click(function () {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status completed">C</button>`).addClass(completed ? "" : "off").click(function () {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status hold">H</button>`).addClass(hold ? "" : "off").click(function () {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status dropped">D</button>`).addClass(dropped ? "" : "off").click(function () {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status planning">P</button>`).addClass(planning ? "" : "off").click(function () {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<input class="form-control comment" type="text" placeholder="comment">`).val(comment))
        .append($(`<button class="btn btn-danger delete"><i class="fa fa-minus" aria-hidden="true"></i></button>`).click(function () {
            $(this).parent().remove();
            saveSettings();
        }))
    );
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

// create hotkey row and add to table
function createHotkeyRow(title, action) {
    let $input = $(`<input type="text" class="hk-input" readonly data-action="${action}">`)
        .val(bindingToText(hotKeys[action]))
        .on("click", startHotkeyRecord);
    $("#qllHotkeyTable tbody").append($(`<tr></tr>`)
        .append($(`<td></td>`).text(title))
        .append($(`<td></td>`).append($input)));
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

// update settings window inputs on import
function updateSettingsUI() {
    for (let action of Object.keys(hotKeys)) {
        $(`#qllHotkeyTable input[data-action="${action}"]`).val(bindingToText(hotKeys[action]));
    }
    $("#qllSelectedColor").val(selectedColor);
}

// save edit table
function saveEditTable() {
    savedLists = [];
    for (let row of $("#qllEditTable .qllEditRow")) {
        let username = $(row).find(".username").val().trim();
        let type = $(row).find(".type").val();
        let watching = $(row).find(".watching").hasClass("off") ? false : true;
        let completed = $(row).find(".completed").hasClass("off") ? false : true;
        let hold = $(row).find(".hold").hasClass("off") ? false : true;
        let dropped = $(row).find(".dropped").hasClass("off") ? false : true;
        let planning = $(row).find(".planning").hasClass("off") ? false : true;
        let comment = $(row).find(".comment").val().trim();
        savedLists.push({ username, type, watching, completed, hold, dropped, planning, comment });
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

function getListURL(username, type) {
    if (type === "anilist") return "https://anilist.co/user/" + username;
    if (type === "myanimelist") return "https://myanimelist.net/profile/" + username;
    if (type === "kitsu") return "https://kitsu.io/users/" + username;
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
    $("#quickLoadListsStyle").remove();
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
    let style = document.createElement("style");
    style.id = "quickLoadListsStyle";
    style.textContent = css.trim();
    document.head.appendChild(style);
}
