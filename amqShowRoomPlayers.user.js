// ==UserScript==
// @name         AMQ Show Room Players
// @namespace    https://github.com/kempanator
// @version      0.25
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
1. Mouse over players bar to show full player list (friends & blocked have color)
2. Click name in player list to open profile
3. Click host name to open profile
4. Invisible friends are no longer hidden
5. Bug fix for friends list and host avatar not getting updated
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.25";
//const saveData = validateLocalStorage("showRoomPlayers");
let showPlayerColors = true;
let showCustomColors = true;
let customColorMap = {};

function setup() {
    new Listener("New Rooms", (data) => {
        data.forEach((item) => {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[item.id];
                if (room) {
                    room.refreshRoomPlayers();
                    room.clickHostName(item.host);
                }
            }, 1);
        });
    }).bindListener();
    new Listener("Room Change", (data) => {
        if (data.changeType === "players" || data.changeType === "spectators") {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[data.roomId];
                if (room) {
                    room.updateFriends();
                    room.refreshRoomPlayers();
                    if (data.newHost) {
                        room.updateAvatar(data.newHost.avatar);
                        room.clickHostName(data.newHost.name);
                    }
                }
            }, 1);
        }
    }).bindListener();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js",
        description: `
            <ul><b>New room tile features:</b>
                <li>1. Mouse over players bar to show full player list (friends & blocked have color)</li>
                <li>2. Click name in player list to open profile</li>
                <li>3. Click host name to open profile</li>
                <li>4. Invisible friends are no longer hidden</li>
                <li>5. Bug fix for friends list and host avatar not getting updated</li>
            </ul>
        `
    });
    applyStyles();
}

// override updateFriends function to also show invisible friends
RoomTile.prototype.updateFriends = function () {
    this._friendsInGameMap = {};
    for (let player of this._players) {
        if (socialTab.isFriend(player)) {
            this._friendsInGameMap[player] = true;
        }
    }
    this.updateFriendInfo();
};

// override removeRoomTile function to also remove room players popover
const oldRemoveRoomTile = RoomBrowser.prototype.removeRoomTile;
RoomBrowser.prototype.removeRoomTile = function (tileId) {
    $(`#rbRoom-${tileId} .rbrProgressContainer`).popover("destroy");
    oldRemoveRoomTile.apply(this, arguments);
};

// add click event to host name to open player profile
RoomTile.prototype.clickHostName = function (host) {
    this.$tile.find(".rbrHost").css("cursor", "pointer").off("click").click(() => {
        playerProfileController.loadProfile(host, $(`#rbRoom-${this.id}`), {}, () => {}, false, true);
    });
};

// create or update room players popover
RoomTile.prototype.refreshRoomPlayers = function () {
    let $progress = this.$tile.find(".rbrProgressContainer");
    let players = [...this._players].sort((a, b) => a.localeCompare(b));
    let $list = $("<ul></ul>");
    for (let player of players) {
        let $li = $("<li></li>").addClass("srpPlayer").text(player);
        if (player === selfName) $li.addClass("self");
        else if (socialTab.isFriend(player)) $li.addClass("friend");
        else if (socialTab.isBlocked(player)) $li.addClass("blocked");
        if (customColorMap.hasOwnProperty(player.toLowerCase())) $li.addClass("customColor" + customColorMap[player.toLowerCase()]);
        $list.append($li);
    }

    let title = `${players.length} Player${players.length === 1 ? "" : "s"}`;
    let pop = $progress.data("bs.popover");

    if (pop) { //update existing pop-over
        pop.options.title = title;
        pop.options.content = $list.prop("outerHTML");
        let popId = $progress.attr("aria-describedby");
        if (popId) {
            let $popDom = $("#" + popId);
            $popDom.find(".popover-title, .popover-header").html(title);
            $popDom.find(".popover-content, .popover-body").html(pop.options.content);
        }
    }
    else { //create new pop-over (first time)
        $progress
            .tooltip("destroy")
            .removeAttr("data-toggle data-placement data-original-title")
            .popover({
                container: "#roomBrowserPage",
                placement: "bottom",
                trigger: "manual",
                html: true,
                title,
                content: $list.prop("outerHTML")
            })
            .off("mouseenter.srp")
            .on("mouseenter.srp", () => {
                if ($progress.attr("aria-describedby")) return;
                $progress.popover("show");
                let popId = $progress.attr("aria-describedby");
                if (!popId) return;
                let $pop = $("#" + popId);
                let $tile = this.$tile;

                let detach = () => {
                    $progress.off("mouseleave.srp");
                    $pop.off(".srp");
                    $tile.off(".srp");
                };
                let closePopover = () => {
                    if (!$pop.is(":hover") && !$tile.is(":hover") && !$progress.is(":hover")) {
                        detach();
                        $progress.popover("hide");
                    }
                };

                $progress.on("mouseleave.srp", closePopover);
                $pop.on("mouseleave.srp", closePopover);
                $tile.on("mouseleave.srp", closePopover);
                $pop.on("click.srp", "li", e => {
                    playerProfileController.loadProfile(
                        e.target.innerText,
                        $tile,
                        {},
                        () => {},
                        false,
                        true
                    );
                });
            });
    }
};

// update the room tile avatar when a new host is promoted
RoomTile.prototype.updateAvatar = function (avatarInfo) {
    if (!avatarInfo?.avatar) return;
    this.avatarDisplayHandler?.cancel();
    if (this.avatarPreloadImage) {
        this.avatarPreloadImage.cancel();
        this.avatarPreloadImage = null;
    }

    let sizeMod = avatarInfo.avatar.sizeModifier;
    this.$tile.find(".rbrRoomImage")
        .removeClass((i, c) => (c.match(/sizeMod\d+/g) || []).join(" ")) //remove old sizeMod
        .addClass(`sizeMod${sizeMod}`)
        .removeAttr("src srcset sizes");

    this.avatarDisplayHandler.setSizeMod(sizeMod);
    let bgUrl = cdnFormater.newAvatarBackgroundSrc(avatarInfo.background.backgroundHori, cdnFormater.BACKGROUND_ROOM_BROWSER_SIZE);
    let onLoadCb = () => {
        this.$tile
            .find(".rbrRoomImageContainer")
            .css("background-image", `url("${bgUrl}")`);
    };

    if (avatarInfo.avatar.animated) { // animated sprite
        this.avatarDisplayHandler.displayAvatarAnimated(
            cdnFormater.newAnimatedAvatarJsonSrc(avatarInfo.avatar.avatarName, avatarInfo.avatar.outfitName),
            cdnFormater.newAnimatedAvatarAtlasSrc(avatarInfo.avatar.avatarName, avatarInfo.avatar.outfitName),
            false,
            { $lazyLoadContainer: $("#rbRoomHider"), $lazyOffsetParent: this.$tile },
            onLoadCb,
            avatarInfo.avatar.optionActive
        );
    }
    else { // static base-pose image
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
};

// validate json data in local storage
function validateLocalStorage(name) {
    try {
        return JSON.parse(localStorage.getItem(name)) || {};
    }
    catch {
        return {};
    }
}

// apply styles
function applyStyles() {
    //$("#showRoomPlayersStyle").remove();
    const saveData2 = validateLocalStorage("highlightFriendsSettings");
    let selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
    let friendColor = saveData2.smColorFriendColor ?? "#80ff80";
    let blockedColor = saveData2.smColorBlockedColor ?? "#ff8080";
    let customColors = saveData2.customColors ?? [];
    customColorMap = {};
    customColors.forEach((item, index) => {
        for (let player of item.players) {
            customColorMap[player.toLowerCase()] = index;
        }
    });
    let css = /*css*/ `
        li.srpPlayer {
            cursor: pointer;
        }
        li.srpPlayer:hover {
            text-shadow: 0 0 6px white;
        }
    `;
    if (showPlayerColors) css += `
        li.srpPlayer.self {
            color: ${selfColor};
        }
        li.srpPlayer.friend {
            color: ${friendColor};
        }
        li.srpPlayer.blocked {
            color: ${blockedColor};
        }
    `;
    if (showCustomColors) {
        customColors.forEach((item, index) => {
            css += `
                li.srpPlayer.customColor${index} {
                    color: ${item.color};
                }
            `;
        });
    }
    let style = document.createElement("style");
    style.id = "showRoomPlayersStyle";
    style.textContent = css.trim();
    document.head.appendChild(style);
}
