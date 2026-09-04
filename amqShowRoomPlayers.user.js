// ==UserScript==
// @name         AMQ Show Room Players
// @namespace    https://github.com/kempanator
// @version      0.34
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
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("showRoomPlayers");
let showPlayerColors = saveData.showPlayerColors ?? true;
let showCustomColors = saveData.showCustomColors ?? true;
let showPlayerLevels = saveData.showPlayerLevels ?? true;
let customColorMap = {};

function setup() {
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
                <li>2. Player/spectator counts in list headers (hidden when empty)</li>
                <li>3. Alphabetical player list sort</li>
                <li>4. Optional player levels (showPlayerLevels)</li>
                <li>5. Click host name to open profile</li>
                <li>6. Invisible friends are no longer hidden</li>
                <li>7. Bug fix for friends list and host avatar not getting updated</li>
            </ul>
        `
    });
}

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
        if (name === selfName) {
            $entry.addClass("self");
        }
        else if (socialTab.isFriend(name)) {
            $entry.addClass("friend");
        }
        else if (socialTab.isBlocked(name)) {
            $entry.addClass("blocked");
        }
        if (customColorMap.hasOwnProperty(name.toLowerCase())) {
            $entry.addClass("customColor" + customColorMap[name.toLowerCase()]);
        }

        $entry.click(() => {
            this.$playerListContainer.addClass("open");
            playerProfileController.loadProfile(
                name,
                $entry,
                {},
                () => {
                    this.$playerListContainer.removeClass("open");
                },
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
    localStorage.setItem("showRoomPlayers", JSON.stringify({
        showPlayerColors,
        showCustomColors,
        showPlayerLevels
    }));
}

// Apply styles
function applyStyles() {
    const saveDataHF = validateLocalStorage("highlightFriendsSettings");
    const selfColor = saveDataHF.smColorSelfColor ?? "#80c7ff";
    const friendColor = saveDataHF.smColorFriendColor ?? "#80ff80";
    const blockedColor = saveDataHF.smColorBlockedColor ?? "#ff8080";
    const customColors = saveDataHF.customColors ?? [];
    customColorMap = {};
    customColors.forEach((item, index) => {
        for (const player of item.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
    let css = `
        .rbrPlayerListContainer {
            max-height: 205px;
            padding: 10px;
            transition: opacity .2s linear;
        }
    `;
    if (!showPlayerLevels) css += `
        .rbrPlayerListEntry {
            justify-content: center;
        }
        .rbrPlayerListEntryLevel {
            display: none;
        }
    `;
    if (showPlayerColors) css += `
        .rbrPlayerListEntry.self .rbrPlayerListEntryName {
            color: ${selfColor};
        }
        .rbrPlayerListEntry.friend .rbrPlayerListEntryName {
            color: ${friendColor};
        }
        .rbrPlayerListEntry.blocked .rbrPlayerListEntryName {
            color: ${blockedColor};
        }
    `;
    if (showCustomColors) {
        customColors.forEach((item, index) => {
            css += `
                .rbrPlayerListEntry.customColor${index} .rbrPlayerListEntryName {
                    color: ${item.color};
                }
            `;
        });
    }
    let style = document.getElementById("showRoomPlayersStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "showRoomPlayersStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}

window.setShowPlayerLevels = function (value) {
    showPlayerLevels = Boolean(value);
    saveSettings();
    applyStyles();
};
