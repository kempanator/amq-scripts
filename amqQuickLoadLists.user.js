// ==UserScript==
// @name         AMQ Quick Load Lists
// @namespace    https://github.com/kempanator
// @version      0.3
// @description  Adds a window for saving and quick loading anime lists
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://github.com/TheJoseph98/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/TheJoseph98/AMQ-Scripts/raw/master/common/amqWindows.js
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

const version = "0.3";
const saveData = validateLocalStorage("quickLoadLists");
let savedLists = saveData.savedLists ?? [];
let windowHotKey = saveData.windowHotKey ?? {key: "q", altKey: true, ctrlKey: false};
let animeListModalHotKey = saveData.animeListModalHotKey ?? {key: "", altKey: true, ctrlKey: false};
let removeListHotKey = saveData.removeListHotKey ?? {key: "", altKey: true, ctrlKey: false};
let selectedColor = saveData.selectedColor ?? "#4497ea";
let quickLoadListsWindow;

// setup
function setup() {
    new Listener("anime list update result", (payload) => {
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
        id: "anisongdbPanel",
        width: 1.0,
        height: "100%",
        scrollable: {x: false, y: true}
    });

    $("#settingsAnimeListContainer > div .row:eq(2)")
        .append($(`<div class="col-xs-6"></div>`)
            .append($(`<label for="qllSettingsButton">Quick Load Lists Script</label>`))
            .append($(`<div></div>`)
                .append($(`<button id="qllSettingsButton" class="btn btn-primary">Open</button>`).click(() => {
                    quickLoadListsWindow.open();
                }))
                .append($(`<button id="qllSettingsButton" class="btn btn-danger" style="margin-left: 8px">Clear</button>`).click(() => {
                    $("#qllTable .qllRow").removeClass("selected");
                    removeAllLists();
                    displayMessage("Current List Cleared");
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
            displayMessage("Current List Cleared");
        }))
        .append(`<h2>Quick Load Lists</h2>`)
        .append($(`<div class="tabContainer">`)
            .append($(`<div id="qllUseTab" class="tab clickAble"><span>Use</span></div>`).click(function() {
                tabReset();
                $(this).addClass("selected");
                $("#qllUseContainer").show();
            }))
            .append($(`<div id="qllEditTab" class="tab clickAble"><span>Edit</span></div>`).click(function() {
                tabReset();
                $(this).addClass("selected");
                $("#qllEditContainer").show();
            }))
            .append($(`<div id="qllSettingsTab" class="tab clickAble"><span>Settings</span></div>`).click(function() {
                tabReset();
                $(this).addClass("selected");
                $("#qllSettingsContainer").show();
            }))
        );
    quickLoadListsWindow.panels[0].panel
        .append($(`<div id="qllUseContainer"></div>`))
        .append($(`<div id="qllEditContainer"></div>`)
            .append($(`<button class="btn btn-success" style="margin: 5px 2px 2px 5px">Save</button>`).click(() => {
                saveEditTable();
                createListTable();
                saveSettings();
            }))
            .append($(`<button class="btn btn-default" style="width: 34px; margin: 6px 2px 2px 2px; padding: 6px 0;"><i class="fa fa-plus" aria-hidden="true"></i></button></button>`).click(() => {
                createEditRow($("#qllEditTable"), "", "anilist", true, true, true, true, true);
            }))
        )
        .append($(`<div id="qllSettingsContainer"></div>`)
            .append($(`<div></div>`)
                .append($(`<span>Open This Window Hotkey:</span>`))
                .append($(`<select id="qllSettingsWindowHotkeyModifier" class="form-control"><option value="alt">ALT</option><option value="ctrl">CTRL</option></select>`).on("change", function() {
                    if (this.value === "alt") {
                        windowHotKey.altKey = true;
                        windowHotKey.ctrlKey = false;
                    }
                    else if (this.value === "ctrl") {
                        windowHotKey.altKey = false;
                        windowHotKey.ctrlKey = true;
                    }
                    saveSettings();
                }))
                .append($(`<input id="qllSettingsWindowHotkeyKey" class="form-control key" type="text" maxlength="1" value="${windowHotKey.key}">`).blur(function() {
                    windowHotKey.key = this.value.toLowerCase();
                    saveSettings();
                }))
            )
            .append($(`<div></div>`)
                .append($(`<span>Open Anime List Modal Hotkey:</span>`))
                .append($(`<select id="qllSettingsAnimeListModalHotkeyModifier" class="form-control"><option value="alt">ALT</option><option value="ctrl">CTRL</option></select>`).on("change", function() {
                    if (this.value === "alt") {
                        animeListModalHotKey.altKey = true;
                        animeListModalHotKey.ctrlKey = false;
                    }
                    else if (this.value === "ctrl") {
                        animeListModalHotKey.altKey = false;
                        animeListModalHotKey.ctrlKey = true;
                    }
                    saveSettings();
                }))
                .append($(`<input id="qllSettingsAnimeListModalHotkeyKey" class="form-control key" type="text" maxlength="1" value="${animeListModalHotKey.key}">`).blur(function() {
                    animeListModalHotKey.key = this.value.toLowerCase();
                    saveSettings();
                }))
            )
            .append($(`<div></div>`)
                .append($(`<span>Remove List Hotkey:</span>`))
                .append($(`<select id="qllSettingsRemoveListHotkeyModifier" class="form-control"><option value="alt">ALT</option><option value="ctrl">CTRL</option></select>`).on("change", function() {
                    if (this.value === "alt") {
                        removeListHotKey.altKey = true;
                        removeListHotKey.ctrlKey = false;
                    }
                    else if (this.value === "ctrl") {
                        removeListHotKey.altKey = false;
                        removeListHotKey.ctrlKey = true;
                    }
                    saveSettings();
                }))
                .append($(`<input id="qllSettingsRemoveListHotkeyKey" class="form-control key" type="text" maxlength="1" value="${removeListHotKey.key}">`).blur(function() {
                    removeListHotKey.key = this.value.toLowerCase();
                    saveSettings();
                }))
            )
            .append($(`<div></div>`)
                .append($(`<span>Selected Color:</span>`))
                .append($(`<input id="qllSettingsSelectedColor" class="form-control color" type="color" value="${selectedColor}">`).blur(function() {
                    selectedColor = this.value;
                    saveSettings();
                    applyStyles();
                }))
            )
            .append($(`<div></div>`)
                .append($(`<label class="btn btn-default">Import</label>`)
                    .append($(`<input type="file" style="display: none">`).on("change", function() {
                        if (this.files.length) {
                            this.files[0].text().then((data) => {
                                try {
                                    let json = JSON.parse(data);
                                    if (Array.isArray(json.savedLists) && json.savedLists.every((x) => x.username !== undefined && x.type !== undefined)) {
                                        $(this).val("");
                                        swal({
                                            title: "Select Import Method",
                                            input: "select",
                                            inputPlaceholder: " ",
                                            inputOptions: {1: "Append to current lists", 2: "Replace all lists", 3: "Replace lists & settings"},
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
                                                    windowHotKey = json.windowHotKey ?? {key: "", altKey: true, ctrlKey: false};
                                                    animeListModalHotKey = json.animeListModalHotKey ?? {key: "", altKey: true, ctrlKey: false};
                                                    removeListHotKey = json.removeListHotKey ?? {key: "", altKey: true, ctrlKey: false};
                                                    selectedColor = json.selectedColor ?? "#4497ea";
                                                    updateSettings();
                                                    applyStyles();
                                                }
                                                createListTable();
                                                createEditTable();
                                                saveSettings();
                                                displayMessage(`Imported ${json.savedLists.length} list${json.savedLists.length === 1 ? "" : "s"}`);
                                            }
                                        });
                                    }
                                    else {
                                        displayMessage("Upload Error");
                                    }
                                }
                                catch {
                                    displayMessage("Upload Error");
                                }
                            });
                        }
                    }))
                )
                .append($(`<button class="btn btn-default" style="margin-left: 5px">Export</button>`).click(function() {
                    if (savedLists.length) {
                        let settings = {
                            savedLists: savedLists,
                            windowHotKey: windowHotKey,
                            animeListModalHotKey: animeListModalHotKey,
                            removeListHotKey: removeListHotKey,
                            selectedColor: selectedColor
                        };
                        let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
                        let element = document.createElement("a");
                        element.setAttribute("href", data);
                        element.setAttribute("download", "amq quick load lists backup.json");
                        document.body.appendChild(element);
                        element.click();
                        element.remove();
                    }
                    else {
                        displayMessage("Nothing to export");
                    }
                }))
            )
        );
    tabReset();
    $("#qllUseTab").addClass("selected");
    $("#qllUseContainer").show();
    createListTable();
    createEditTable();

    $("#optionListSettings").before(`<li class="clickAble" onclick="$('#quickLoadListsWindow').show()">Load Lists</li>`);

    document.querySelector("body").addEventListener("keydown", (event) => {
        if (event.key === windowHotKey.key && event.altKey === windowHotKey.altKey && event.ctrlKey === windowHotKey.ctrlKey) {
            quickLoadListsWindow.isVisible() ? quickLoadListsWindow.close() : quickLoadListsWindow.open();
        }
        if (event.key === animeListModalHotKey.key && event.altKey === animeListModalHotKey.altKey && event.ctrlKey === animeListModalHotKey.ctrlKey) {
            $("#settingModal").modal("show");
            options.selectTab("settingsAnimeListContainer", $("#smAnimeListTab"));
        }
        if (event.key === removeListHotKey.key && event.altKey === removeListHotKey.altKey && event.ctrlKey === removeListHotKey.ctrlKey) {
            removeAllLists();
        }
    });

    options.$INCLUDE_WATCHING_CHECKBOX.click(() => { checkSelectedList() });
    options.$INCLUDE_COMPLETED_CHECKBOX.click(() => { checkSelectedList() });
    options.$INCLUDE_ON_HOLD_CHECKBOX.click(() => { checkSelectedList() });
    options.$INCLUDE_DROPPED_CHECKBOX.click(() => { checkSelectedList() });
    options.$INCLUDE_PLANNING_CHECKBOX.click(() => { checkSelectedList() });

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

function tabReset() {
    $("#qllUseTab").removeClass("selected");
    $("#qllEditTab").removeClass("selected");
    $("#qllSettingsTab").removeClass("selected");
    $("#qllUseContainer").hide();
    $("#qllEditContainer").hide();
    $("#qllSettingsContainer").hide();
}

function shortenType(type) {
    if (type === "anilist") return "ANI";
    if (type === "myanimelist") return "MAL";
    if (type === "kitsu") return "KIT";
}

function loadList($row, username, type, watching, completed, hold, dropped, planning) {
    if (type === "anilist") {
        let listener = new Listener("anime list update result", (payload) => {
            listener.unbindListener();
            $("#qllTable .qllRow").removeClass("selected");
            if (payload.success) {
                $("#aniListUserNameInput").val(username);
                setAllStatusCheckboxes(watching, completed, hold, dropped, planning);
                $row.addClass("selected");
            }
            else {
                displayMessage("Update Unsuccessful", payload.message);
                checkSelectedList();
            }
            removeMyanimelist();
            removeKitsu();
            $row.find("i.fa-spinner").hide();
        });
        listener.bindListener();
        $row.find("i.fa-spinner").show();
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "ANILIST"}});
    }
    else if (type === "myanimelist") {
        let listener = new Listener("anime list update result", (payload) => {
            listener.unbindListener();
            $("#qllTable .qllRow").removeClass("selected");
            if (payload.success) {
                $("#malUserNameInput").val(username);
                setAllStatusCheckboxes(watching, completed, hold, dropped, planning);
                $row.addClass("selected");
            }
            else {
                displayMessage("Update Unsuccessful", payload.message);
                checkSelectedList();
            }
            removeAnilist();
            removeKitsu();
            $row.find("i.fa-spinner").hide();
        });
        listener.bindListener();
        $row.find("i.fa-spinner").show();
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "MAL"}});
    }
    else if (type === "kitsu") {
        let listener = new Listener("anime list update result", (payload) => {
            listener.unbindListener();
            $("#qllTable .qllRow").removeClass("selected");
            if (payload.success) {
                $("#kitsuUserNameInput").val(username);
                setAllStatusCheckboxes(watching, completed, hold, dropped, planning);
                $row.addClass("selected");
            }
            else {
                displayMessage("Update Unsuccessful", payload.message);
                checkSelectedList();
            }
            removeAnilist();
            removeMyanimelist();
            $row.find("i.fa-spinner").hide();
        });
        listener.bindListener();
        $row.find("i.fa-spinner").show();
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: username, listType: "KITSU"}});
    }
}

function removeAnilist() {
    if ($("#aniListLastUpdateDate").text()) {
        $("#aniListUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "ANILIST"}});
    }
}

function removeMyanimelist() {
    if ($("#malLastUpdateDate").text()) {
        $("#malUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "MAL"}});
    }
}

function removeKitsu() {
    if ($("#kitsuLastUpdated").text()) {
        $("#kitsuUserNameInput").val("");
        socket.sendCommand({type: "library", command: "update anime list", data: {newUsername: "", listType: "KITSU"}});
    }
}

function removeAllLists() {
    removeAnilist();
    removeMyanimelist();
    removeKitsu();
}

// check if your current list settings match any saved lists and mark the found list as selected
function checkSelectedList() {
    let $rows = $("#qllTable .qllRow");
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
                $($rows.get(index)).addClass("selected");
            }
        });
    }
}

function setStatusCheckbox($checkbox, commandName, status) {
    if ($checkbox.prop("checked") !== status) {
        $checkbox.prop("checked", status);
        socket.sendCommand({
            type: "settings",
            command: "update use list entry " + commandName,
            data: {on: status}
        });
    }
}

function setAllStatusCheckboxes(watching, completed, hold, dropped, planning) {
    setStatusCheckbox(options.$INCLUDE_WATCHING_CHECKBOX, "watching", watching);
    setStatusCheckbox(options.$INCLUDE_COMPLETED_CHECKBOX, "completed", completed);
    setStatusCheckbox(options.$INCLUDE_ON_HOLD_CHECKBOX, "on hold", hold);
    setStatusCheckbox(options.$INCLUDE_DROPPED_CHECKBOX, "dropped", dropped);
    setStatusCheckbox(options.$INCLUDE_PLANNING_CHECKBOX, "planning", planning);
}

function createListTable() {
    $("#qllTable").remove();
    let $table = $(`<table id="qllTable"></table>`);
    let $thead = $("<thead></thead>");
    let $tbody = $("<tbody></tbody>");
    savedLists.forEach((list, i) => {
        let $row = $(`<tr class="qllRow"></tr>`)
            .append($(`<td class="username"></td>`).text(list.username).click(() => {
                loadList($row, list.username, list.type, list.watching, list.completed, list.hold, list.dropped, list.planning);
            }))
            .append($(`<td class="type"></td>`)
                .append($(`<a href="${getListURL(list.username, list.type)}" target="_blank"></a>`).text(shortenType(list.type)))
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
            );
        $tbody.append($row);
    });
    $table.append($thead).append($tbody);
    $("#qllUseContainer").append($table);
    checkSelectedList();
}

function createEditTable() {
    $("#qllEditTable").remove();
    let $table = $(`<div id="qllEditTable"></div>`)
    for (let list of savedLists) {
        createEditRow($table, list.username, list.type, list.watching, list.completed, list.hold, list.dropped, list.planning, list.comment);
    }
    $("#qllEditContainer").append($table);
}

// create new row in list edit table
function createEditRow($table, username, type, watching, completed, hold, dropped, planning, comment) {
    let $row = $(`<div class="qllEditRow"></div>`)
        .append($(`<i class="fa fa-chevron-up arrow clickAble" aria-hidden="true"></i>`).click(function() {
            $(this).parent().prev().insertAfter($(this).parent());
        }))
        .append($(`<i class="fa fa-chevron-down arrow clickAble" aria-hidden="true"></i>`).click(function() {
            $(this).parent().next().insertBefore($(this).parent());
        }))
        .append($(`<input class="form-control username" type="text" placeholder="username">`).val(username))
        .append($(`<select class="form-control type"><option value="anilist">anilist</option><option value="myanimelist">myanimelist</option><option value="kitsu">kitsu</option></select>`))
        .append($(`<button class="btn btn-default status watching">W</button>`).addClass(watching ? "" : "off").click(function() {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status completed">C</button>`).addClass(completed ? "" : "off").click(function() {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status hold">H</button>`).addClass(hold ? "" : "off").click(function() {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status dropped">D</button>`).addClass(dropped ? "" : "off").click(function() {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<button class="btn btn-default status planning">P</button>`).addClass(planning ? "" : "off").click(function() {
            $(this).hasClass("off") ? $(this).removeClass("off") : $(this).addClass("off");
        }))
        .append($(`<input class="form-control comment" type="text" placeholder="comment">`).val(comment))
        .append($(`<button class="btn btn-danger delete"><i class="fa fa-minus" aria-hidden="true"></i></button>`).click(function() {
            $(this).parent().remove();
            saveSettings();
        }))
    $row.find("select").val(type);
    $table.append($row);
}

// update settings window with new imported settings
function updateSettings() {
    if (windowHotKey.altKey) $("#qllSettingsWindowHotkeyModifier").val("alt");
    else if (windowHotKey.ctrlKey) $("#qllSettingsWindowHotkeyModifier").val("ctrl");
    $("#qllSettingsWindowHotkeyKey").val(windowHotKey.key);
    if (animeListModalHotKey.altKey) $("#qllSettingsAnimeListModalHotkeyModifier").val("alt");
    else if (animeListModalHotKey.ctrlKey) $("#qllSettingsAnimeListModalHotkeyModifier").val("ctrl");
    $("#qllSettingsAnimeListModalHotkeyKey").val(animeListModalHotKey.key);
    if (removeListHotKey.altKey) $("#qllSettingsRemoveListHotkeyModifier").val("alt");
    else if (removeListHotKey.ctrlKey) $("#qllSettingsRemoveListHotkeyModifier").val("ctrl");
    $("#qllSettingsRemoveListHotkeyKey").val(removeListHotKey.key);
    $("#qllSettingsSelectedColor").val(selectedColor);
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
        savedLists.push({username, type, watching, completed, hold, dropped, planning, comment});
    }
}

// save settings
function saveSettings() {
    let settings = {
        savedLists: savedLists,
        windowHotKey: windowHotKey,
        animeListModalHotKey: animeListModalHotKey,
        removeListHotKey: removeListHotKey,
        selectedColor: selectedColor
    };
    localStorage.setItem("quickLoadLists", JSON.stringify(settings));
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
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "quickLoadListsStyle";
    let text = `
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
        #quickLoadListsWindow .modal-header .close {
            top: 15px;
            right: 15px;
            position: absolute;
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
        #qllSettingsContainer select.form-control {
            width: 62px;
            margin-left: 10px;
            padding: 6px 0;
            display: inline-block;
        }
        #qllSettingsContainer input.key {
            width: 34px;
            text-align: center;
            margin-left: 5px;
            padding: 6px 0;
            display: inline-block;
        }
        #qllSettingsContainer input.color {
            width: 60px;
            margin-left: 10px;
            padding: 2px 4px;
            display: inline-block;
            vertical-align: middle;
        }
    `;
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
