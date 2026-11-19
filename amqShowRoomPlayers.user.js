// ==UserScript==
// @name         AMQ Show Room Players
// @namespace    https://github.com/kempanator
// @version      0.35
// @description  Adds extra functionality to room tiles
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js
// ==/UserScript==

/*
New room tile features:
1. Friend, blocked, self, and custom colors on the player list
2. Player/spectator counts in list headers
3. Click host name to open profile
4. Invisible friends are no longer hidden
5. Bug fix for friends list and host avatar not getting updated
*/

"use strict";
if (typeof Listener === "undefined") return;

let showPlayerColors;
let showCustomColors;
let showPlayerLevels;
let playerListMaxHeight;
let customColorMap = Object.create(null);

// Initialize once AMQ finishes loading
function startScript() {
    initializeState();
    installHooks();
    const loadingScreen = document.querySelector("#loadingScreen");
    if (loadingScreen.classList.contains("hidden")) {
        setup();
        return;
    }
    const observer = new MutationObserver(() => {
        if (!loadingScreen.classList.contains("hidden")) return;
        observer.disconnect();
        setup();
    });
    observer.observe(loadingScreen, { attributes: true, attributeFilter: ["class"] });
}

// Restore preferences and create runtime state before startup
function initializeState() {
    const settings = loadSettings();
    showPlayerColors = settings.showPlayerColors;
    showCustomColors = settings.showCustomColors;
    showPlayerLevels = settings.showPlayerLevels;
    playerListMaxHeight = settings.playerListMaxHeight;
}

// Install game method overrides before AMQ's initial rendering
function installHooks() {
    // Override updateFriends function to also show invisible friends
    RoomTile.prototype.updateFriends = function () {
        this._friendsInGameMap = {};
        for (const player of this._friendNames) {
            if (socialTab.isFriend(player)) {
                this._friendsInGameMap[player] = true;
            }
        }
        this.updateFriendInfo();
    };
    // Override player list build for count headers, localeCompare sort, colors, optional levels
    RoomTile.prototype.buildPlayerList = function (list, $container) {
        const $header = $container.prev(".rbrPlayerListHeader");
        const isSpectators = $container.is(this.$spectatorList);
        if (list.length === 0) {
            $header.addClass("hidden").css("margin-top", "");
        }
        else {
            const labelKey = isSpectators
                ? "room_browser.room_tile.player_list.spectators"
                : "room_browser.room_tile.player_list.players";
            let label = localizationHandler.translate(labelKey);
            if (list.length === 1) {
                label = label.replace(/s$/, "");
            }
            $header
                .removeClass("hidden")
                .removeAttr("data-i18n")
                .css("margin-top", isSpectators && this.allPlayers.players.length > 0 ? "5px" : "")
                .text(`${list.length} ${label}`);
        }

        list.sort((a, b) => a.name.localeCompare(b.name)).forEach(({ name, level }) => {
            const $entry = $(format(this.PLAYER_ROW_TEMPLATE, name, level));
            applyPlayerColorClasses($entry, name);

            $entry.click(() => {
                this.$playerListContainer.addClass("open");
                playerProfileController.loadProfile(
                    name,
                    $entry,
                    {},
                    () => { this.$playerListContainer.removeClass("open") },
                    false,
                    true,
                );
            });

            $container.append($entry);
        });
    };
    // Add click event to host name to open player profile
    RoomTile.prototype.clickHostName = function (host) {
        this.$tile.find(".rbrHost")
            .css("cursor", "pointer")
            .off("click.srp")
            .on("click.srp", () => {
                playerProfileController.loadProfile(host, $(`#rbRoom-${this.id}`), {}, () => { }, false, true);
            });
    };
    // Update the room tile avatar when a new host is promoted
    RoomTile.prototype.updateAvatar = function (avatarInfo) {
        if (!avatarInfo?.avatar) return;
        this.avatarDisplayHandler.cancel();

        const sizeMod = avatarInfo.avatar.sizeModifier;
        this.avatarDisplayHandler.setSizeMod(sizeMod);
        const bgUrl = cdnFormater.newAvatarBackgroundSrc(avatarInfo.background.backgroundHori, cdnFormater.BACKGROUND_ROOM_BROWSER_SIZE);
        const onLoadCb = () => {
            this.$tile
                .find(".rbrRoomImageContainer")
                .css("background-image", `url("${bgUrl}")`);
        };

        if (avatarInfo.avatar.animated) {
            this.avatarDisplayHandler.displayAvatarAnimated(
                cdnFormater.newAnimatedAvatarJsonSrc(avatarInfo.avatar.avatarName, avatarInfo.avatar.outfitName),
                cdnFormater.newAnimatedAvatarAtlasSrc(avatarInfo.avatar.avatarName, avatarInfo.avatar.outfitName),
                false,
                { $lazyLoadContainer: $("#rbRoomHider"), $lazyOffsetParent: this.$tile },
                onLoadCb,
                avatarInfo.avatar.optionActive
            );
        }
        else {
            this.avatarDisplayHandler.displayAvatarImage(
                cdnFormater.newAvatarSrc(
                    avatarInfo.avatar.avatarName,
                    avatarInfo.avatar.outfitName,
                    avatarInfo.avatar.optionName,
                    avatarInfo.avatar.optionActive,
                    avatarInfo.avatar.colorName,
                    cdnFormater.AVATAR_POSE_IDS.BASE
                ),
                cdnFormater.newAvatarSrcSet(
                    avatarInfo.avatar.avatarName,
                    avatarInfo.avatar.outfitName,
                    avatarInfo.avatar.optionName,
                    avatarInfo.avatar.optionActive,
                    avatarInfo.avatar.colorName,
                    cdnFormater.AVATAR_POSE_IDS.BASE
                ),
                {
                    triggerLoad: true,
                    defaultSize: this.AVATAR_SIZE_MOD_SIZES[sizeMod],
                    onloadCallback: onLoadCb,
                    $lazyLoadContainer: $("#rbRoomHider"),
                    $lazyOffsetParent: this.$tile,
                }
            );
        }
        this.avatarDisplayHandler.lazyLoadEvent();
    };
}

// Build the script UI and bind its events
function setup() {
    createGraphicsSettings();
    window.addEventListener("amq:highlight-friends-changed", refreshHighlightColors);
    new Listener("New Rooms", (data) => {
        for (const item of data.standard) {
            setTimeout(() => {
                const room = roomBrowser.activeRooms[item.id];
                if (room) {
                    room.clickHostName(item.host);
                }
            }, 1);
        }
    }).bindListener();
    new Listener("Room Change", (data) => {
        if (data.newHost) {
            setTimeout(() => {
                const room = roomBrowser.activeRooms[data.roomId];
                if (room) {
                    room.updateAvatar(data.newHost.avatar);
                    room.clickHostName(data.newHost.name);
                }
            }, 1);
        }
    }).bindListener();

    applyStyles();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js",
        description: `
            <ul><b>New room tile features:</b>
                <li>1. Friend, blocked, self, and custom colors on the player list</li>
                <li>2. Player/spectator counts in list headers</li>
                <li>3. Click host name to open profile</li>
                <li>4. Invisible friends are no longer hidden</li>
                <li>5. Bug fix for friends list and host avatar not getting updated</li>
            </ul>
        `
    });
}

// Add room-list preferences to a collapsible Graphics settings section
function createGraphicsSettings() {
    $("#settingsGraphicContainer").append(/*html*/`
        <div class="row srpGraphicsSettings">
            <div id="srpSettings" class="col-xs-12">
                <h3 id="srpSettingsTitle" class="clickAble">Show Room Players <i class="fa fa-fw fa-caret-right"></i></h3>
                <div id="srpSettingsContent">
                    <div class="srpSettingsRow">
                        <div class="customCheckbox">
                            <input type="checkbox" id="srpShowPlayerLevelsCheckbox">
                            <label for="srpShowPlayerLevelsCheckbox"><i class="fa fa-check"></i></label>
                        </div>
                        <label for="srpShowPlayerLevelsCheckbox">Show player levels</label>
                    </div>
                    <div class="srpSettingsRow">
                        <label for="srpPlayerListMaxHeightInput">Player list max height (px)</label>
                        <input id="srpPlayerListMaxHeightInput" class="form-control" type="number" min="1" step="1">
                    </div>
                </div>
            </div>
        </div>
    `);
    $("#srpSettingsContent").hide();
    $("#srpSettingsTitle").on("click", event => {
        $(event.currentTarget).find("i").toggleClass("fa-caret-down fa-caret-right");
        $("#srpSettingsContent").stop(true, true).slideToggle(150);
    });
    $("#srpShowPlayerLevelsCheckbox").prop("checked", showPlayerLevels).on("change", function () {
        showPlayerLevels = this.checked;
        saveSettings();
        applyStyles();
    });
    $("#srpPlayerListMaxHeightInput").val(playerListMaxHeight).on("change", function () {
        const value = this.valueAsNumber;
        if (!Number.isInteger(value) || value <= 0) {
            this.value = playerListMaxHeight;
            return;
        }
        playerListMaxHeight = value;
        saveSettings();
        applyStyles();
    });
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
        showPlayerColors: true,
        showCustomColors: true,
        showPlayerLevels: true,
        playerListMaxHeight: 300
    };
    const savedSettings = readStorageObject("showRoomPlayers");

    if (typeof savedSettings.showPlayerColors === "boolean") {
        settings.showPlayerColors = savedSettings.showPlayerColors;
    }
    if (typeof savedSettings.showCustomColors === "boolean") {
        settings.showCustomColors = savedSettings.showCustomColors;
    }
    if (typeof savedSettings.showPlayerLevels === "boolean") {
        settings.showPlayerLevels = savedSettings.showPlayerLevels;
    }
    if (Number.isInteger(savedSettings.playerListMaxHeight) && savedSettings.playerListMaxHeight > 0) {
        settings.playerListMaxHeight = savedSettings.playerListMaxHeight;
    }
    return settings;
}

// Load the Highlight Friends preferences used by this script
function loadHighlightSettings() {
    const settings = {
        smColorSelfColor: "#80c7ff",
        smColorFriendColor: "#80ff80",
        smColorBlockedColor: "#ff8080",
        customColors: []
    };
    const savedSettings = readStorageObject("highlightFriendsSettings");

    for (const key of [
        "smColorSelfColor", "smColorFriendColor", "smColorBlockedColor"
    ]) {
        if (typeof savedSettings[key] === "string") settings[key] = savedSettings[key];
    }
    settings.customColors = normalizeCustomColors(savedSettings.customColors);
    return settings;
}

// Normalize saved color groups before building player lookups or CSS
function normalizeCustomColors(value) {
    if (!Array.isArray(value)) return [];
    const colors = [];
    for (const group of value) {
        if (!group || typeof group !== "object" || Array.isArray(group)) continue;
        const players = Array.isArray(group.players)
            ? group.players.filter(player => typeof player === "string")
            : [];
        colors.push({
            enabled: typeof group.enabled === "boolean" ? group.enabled : true,
            color: typeof group.color === "string" ? group.color : "#80c7ff",
            shadow: typeof group.shadow === "string" ? group.shadow : "#228dff",
            players
        });
    }
    return colors;
}

// Save settings
function saveSettings() {
    localStorage.setItem("showRoomPlayers", JSON.stringify({
        showPlayerColors,
        showCustomColors,
        showPlayerLevels,
        playerListMaxHeight
    }));
}

// Recolor existing room entries after palette or group membership changes
function refreshHighlightColors() {
    applyStyles();
    $(".rbrPlayerListEntry[data-srp-player-name]").each(function () {
        applyPlayerColorClasses($(this), this.getAttribute("data-srp-player-name"));
    });
}

// Preserve unrelated classes while replacing this script's player-color markers
function removePlayerColorClasses(index, className) {
    return className.split(/\s+/)
        .filter(name => /^(self|friend|blocked|customColor\d+)$/.test(name))
        .join(" ");
}

// Retain each entry's player identity so existing lists can be recolored in place
function applyPlayerColorClasses($entry, name) {
    const classes = [];
    if (name === selfName) classes.push("self");
    else if (socialTab.isFriend(name)) classes.push("friend");
    else if (socialTab.isBlocked(name)) classes.push("blocked");
    const key = name.toLowerCase();
    if (Object.hasOwn(customColorMap, key)) classes.push("customColor" + customColorMap[key]);
    $entry.attr("data-srp-player-name", name)
        .removeClass(removePlayerColorClasses)
        .addClass(classes.join(" "));
}

// Refresh membership and compose the fixed and configurable room-list styles
function applyStyles() {
    const hfSettings = loadHighlightSettings();
    rebuildCustomColorMap(hfSettings.customColors);
    const css = [createBaseStyles(), createPlayerListStyles(hfSettings)].join("\n");
    let style = document.getElementById("showRoomPlayersStyle");
    if (!style) {
        style = document.createElement("style");
        style.id = "showRoomPlayersStyle";
        document.head.appendChild(style);
    }
    style.textContent = css.trim();
}

// Retain later-group priority even when that group's color is disabled
function rebuildCustomColorMap(customColors) {
    customColorMap = Object.create(null);
    customColors.forEach((group, index) => {
        for (const player of group.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
}

// Keep fixed settings and room-tile layout separate from saved preferences
function createBaseStyles() {
    return /*css*/`
        #settingsGraphicContainer .srpGraphicsSettings {
            padding-top: 10px;
        }
        #srpSettingsTitle {
            margin: 0;
            padding: 0;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            cursor: pointer;
        }
        #srpSettingsContent {
            margin: 0;
            padding: 5px 0 0;
        }
        #srpSettings .srpSettingsRow {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
        }
        #srpSettings .srpSettingsRow + .srpSettingsRow {
            margin-top: 10px;
        }
        #srpSettings .srpSettingsRow > label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }
        #srpPlayerListMaxHeightInput {
            width: 78px;
            height: 28px;
            padding: 2px 6px;
            color: black;
        }
        .rbRoom {
            overflow: visible;
        }
        .rbrPlayerListContainer {
            padding: 10px;
            transition: opacity .2s linear;
        }
    `;
}

// Build level visibility, height, and palette rules from the current settings
function createPlayerListStyles(hfSettings) {
    const rules = [/*css*/`
        .rbrPlayerListContainer {
            max-height: ${playerListMaxHeight}px;
        }
    `];
    if (!showPlayerLevels) rules.push(/*css*/`
        .rbrPlayerListEntry {
            justify-content: center;
        }
        .rbrPlayerListEntryLevel {
            display: none;
        }
    `);
    if (showPlayerColors) rules.push(/*css*/`
        .rbrPlayerListEntry.self .rbrPlayerListEntryName {
            color: ${hfSettings.smColorSelfColor};
        }
        .rbrPlayerListEntry.friend .rbrPlayerListEntryName {
            color: ${hfSettings.smColorFriendColor};
        }
        .rbrPlayerListEntry.blocked .rbrPlayerListEntryName {
            color: ${hfSettings.smColorBlockedColor};
        }
    `);
    if (showCustomColors) {
        hfSettings.customColors.forEach((group, index) => {
            if (!group.enabled) return;
            rules.push(/*css*/`
                .rbrPlayerListEntry.customColor${index} .rbrPlayerListEntryName {
                    color: ${group.color};
                }
            `);
        });
    }
    return rules.join("\n");
}

startScript();
