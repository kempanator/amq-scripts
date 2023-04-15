// ==UserScript==
// @name         AMQ Show Room Players
// @namespace    https://github.com/kempanator
// @version      0.15
// @description  Adds extra functionality to room tiles
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.user.js
// ==/UserScript==

/*
New room tile features:
1. Mouse over players bar to show full player list (friends have color)
2. Click name in player list to open profile
3. Click host name to open profile
4. Invisible friends are no longer hidden
5. Bug fix for friends list and host avatar not getting updated
*/

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);
const version = "0.15";
//const saveData = JSON.parse(localStorage.getItem("showRoomPlayers")) || {};
const saveData2 = JSON.parse(localStorage.getItem("highlightFriendsSettings")) || {};
let selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
let friendColor = saveData2.smColorFriendColor ?? "#80ff80";

function setup() {
    new Listener("game chat update", (payload) => {
        for (let message of payload.messages) {
            if (message.sender === selfName && message.message === "/version") {
                setTimeout(() => { gameChat.systemMessage("Show Room Players - " + version) }, 1);
            }
        }
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        if (payload.sender === selfName && payload.message === "/version") {
            setTimeout(() => { gameChat.systemMessage("Show Room Players - " + version) }, 1);
        }
    }).bindListener();
    new Listener("New Rooms", (payload) => {
        payload.forEach((item) => {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[item.id];
                if (room) {
                    room.createRoomPlayers();
                    room.clickHostName(item.host);
                }
            }, 1);
        });
    }).bindListener();
    new Listener("Room Change", (payload) => {
        if (payload.changeType === "players" || payload.changeType === "spectators") {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[payload.roomId];
                if (room) {
                    room.updateFriends();
                    room.updateRoomPlayers();
                    if (payload.newHost) {
                        room.updateAvatar(payload.newHost.avatar);
                        room.clickHostName(payload.newHost.name);
                    }
                }
            }, 1);
        }
    }).bindListener();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <ul><b>New room tile features:</b>
                <li>1. Mouse over players bar to show full player list (friends have color)</li>
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
RoomTile.prototype.updateFriends = function() {
    this._friendsInGameMap = {};
    this._players.forEach((player) => { if (socialTab.isFriend(player)) this._friendsInGameMap[player] = true });
    this.updateFriendInfo();
};

// override removeRoomTile function to also remove room players popover
const oldRemoveRoomTile = RoomBrowser.prototype.removeRoomTile;
RoomBrowser.prototype.removeRoomTile = function(tileId) {
    $(`#rbRoom-${tileId} .rbrProgressContainer`).popover("destroy");
    oldRemoveRoomTile.apply(this, arguments);
};

// add click event to host name to open player profile
RoomTile.prototype.clickHostName = function(host) {
    this.$tile.find(".rbrHost").css("cursor", "pointer").off("click").click(() => {
        playerProfileController.loadProfile(host, $(`#rbRoom-${this.id}`), {}, () => {}, false, true);
    });
};

// create room players popover
RoomTile.prototype.createRoomPlayers = function() {
    let thisRoomTile = this;
    let $playerList = $("<ul></ul>");
    let players = this._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").addClass("srpPlayer").text(player);
        if (player === selfName) li.addClass("self");
        else if (this._friendsInGameMap[player]) li.addClass("friend");
        $playerList.append(li);
    }
    this.$tile.find(".rbrFriendPopover").data("bs.popover").options.placement = "bottom";
    this.$tile.find(".rbrProgressContainer").tooltip("destroy").removeAttr("data-toggle data-placement data-original-title")
    .popover({
        container: "#roomBrowserPage",
        placement: "bottom",
        trigger: "manual",
        html: true,
        title: players.length + " Player" + (players.length === 1 ? "" : "s"),
        content: $playerList[0].outerHTML
    })
    .off("mouseenter").on("mouseenter", function() {
        let thisProgressBar = this;
        $(this).popover("show");
        $(".popover").off("mouseleave").on("mouseleave", function() {
            if (!$(`#rbRoom-${thisRoomTile.id}:hover`).length) {
                $(thisRoomTile.$tile).off("mouseleave");
                $(".popover").off("mouseleave click");
                $(thisProgressBar).popover("hide");
            }
        });
        $(thisRoomTile.$tile).off("mouseleave").on("mouseleave", function() {
            if (!$(".popover:hover").length) {
                $(thisRoomTile.$tile).off("mouseleave");
                $(".popover").off("mouseleave click");
                $(thisProgressBar).popover("hide");
            }
        });
        $(".popover").off("click").on("click", "li", function(e) {
            playerProfileController.loadProfile(e.target.innerText, $(thisRoomTile.$tile), {}, () => {}, false, true);
        });
    });
};

// update room players popover
RoomTile.prototype.updateRoomPlayers = function() {
    let $playerList = $("<ul></ul>");
    let players = this._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").addClass("srpPlayer").text(player);
        if (player === selfName) li.addClass("self");
        else if (this._friendsInGameMap[player]) li.addClass("friend");
        $playerList.append(li);
    }
    this.$tile.find(".rbrProgressContainer").data("bs.popover").options.content = $playerList[0].outerHTML;
    this.$tile.find(".rbrProgressContainer").data("bs.popover").options.title = players.length + " Player" + (players.length === 1 ? "" : "s");
};

// update the room tile avatar when a new host is promoted
RoomTile.prototype.updateAvatar = function(avatarInfo) {
    this.avatarPreloadImage.cancel();
    this.$tile.find(".rbrRoomImage").removeAttr("src srcset sizes").removeClass().addClass(`rbrRoomImage sizeMod${avatarInfo.avatar.sizeModifier}`);
    let avatarSrc = cdnFormater.newAvatarSrc(
        avatarInfo.avatar.avatarName,
        avatarInfo.avatar.outfitName,
        avatarInfo.avatar.optionName,
        avatarInfo.avatar.optionActive,
        avatarInfo.avatar.colorName,
        cdnFormater.AVATAR_POSE_IDS.BASE
    );
    let avatarSrcSet = cdnFormater.newAvatarSrcSet(
        avatarInfo.avatar.avatarName,
        avatarInfo.avatar.outfitName,
        avatarInfo.avatar.optionName,
        avatarInfo.avatar.optionActive,
        avatarInfo.avatar.colorName,
        cdnFormater.AVATAR_POSE_IDS.BASE
    );
    this.avatarPreloadImage = new PreloadImage(
        this.$tile.find(".rbrRoomImage"),
        avatarSrc,
        avatarSrcSet,
        false,
        this.AVATAR_SIZE_MOD_SIZES[avatarInfo.avatar.sizeModifier],
        () => {
            let $imgContainer = this.$tile.find(".rbrRoomImageContainer");
            $imgContainer.css(
                "background-image",
                'url("' + cdnFormater.newAvatarBackgroundSrc(avatarInfo.background.backgroundHori, cdnFormater.BACKGROUND_ROOM_BROWSER_SIZE) + '")'
            );
        },
        false,
        $("#rbRoomHider"),
        false,
        this.$tile
    );
};

// apply styles
function applyStyles() {
    //$("#showRoomPlayersStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "showRoomPlayersStyle";
    style.appendChild(document.createTextNode(`
        li.srpPlayer {
            cursor: pointer;
        }
        li.srpPlayer:hover {
            text-shadow: 0 0 6px white;
        }
        li.srpPlayer.self {
            color: ${selfColor};
            cursor: pointer;
        }
        li.srpPlayer.friend {
            color: ${friendColor};
        }
    `));
    document.head.appendChild(style);
}
