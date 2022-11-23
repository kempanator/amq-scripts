// ==UserScript==
// @name            AMQ Show Room Players
// @namespace       https://github.com/kempanator
// @version         0.7
// @description     Adds extra functionality to room tiles
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.user.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.user.js
// ==/UserScript==

/*
New room tile features:
1. Mouse over players bar to show full player list (friends are highlighted blue)
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

function setup() {
    new Listener("New Rooms", (payload) => {
        payload.forEach((item) => {
            setTimeout(() => {
                updateRoomTile(item.id);
                roomBrowser.activeRooms[item.id].clickHostName(item.host);
            }, 1);
        });
    }).bindListener();
    new Listener("Room Change", (payload) => {
        if (payload.changeType === "players" || payload.changeType === "spectators") {
            setTimeout(() => {
                if (roomBrowser.activeRooms[payload.roomId]) {
                    roomBrowser.activeRooms[payload.roomId].updateFriends();
                    updateRoomTile(payload.roomId);
                    if (payload.newHost) {
                        roomBrowser.activeRooms[payload.roomId].updateAvatar(payload.newHost.avatar);
                        roomBrowser.activeRooms[payload.roomId].clickHostName(payload.newHost.name);
                    }
                }
            }, 1);
        }
    }).bindListener();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        description: `
            <p>New room tile features:</p>
            <p>1. Mouse over players bar to show full player list (friends are highlighted blue)</p>
            <p>2. Click name in player list to open profile</p>
            <p>3. Click host name to open profile</p>
            <p>4. Invisible friends are no longer hidden</p>
            <p>5. Bug fix for friends list and host avatar not getting updated</p>
        `
    });
    AMQ_addStyle(`
        li.roomPlayersFriend {
            color: #4497EA;
            cursor: pointer;
        }
        li.roomPlayersNonFriend {
            color: unset;
            cursor: pointer;
        }
        li.roomPlayersFriend:hover, li.roomPlayersNonFriend:hover {
            text-shadow: 0 0 6px white;
        }
    `);
}

// input room id number
function updateRoomTile(roomId) {
    let $playerList = $("<ul></ul>");
    let players = roomBrowser.activeRooms[roomId]._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").text(player);
        if (roomBrowser.activeRooms[roomId]._friendsInGameMap[player]) li.addClass("roomPlayersFriend");
        else li.addClass("roomPlayersNonFriend");
        $playerList.append(li);
    }
    if ($(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover")) {
        $(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover").options.content = $playerList[0].outerHTML;
        $(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover").options.title = players.length + " Player" + (players.length === 1 ? "" : "s");
    }
    else {
        $(`#rbRoom-${roomId} .rbrFriendPopover`).data("bs.popover").options.placement = "bottom";
        $(`#rbRoom-${roomId} .rbrProgressContainer`).tooltip("destroy").removeAttr("data-toggle data-placement data-original-title")
        .popover({
            container: "#roomBrowserPage",
            placement: "bottom",
            trigger: "manual",
            html: true,
            title: players.length + " Player" + (players.length === 1 ? "" : "s"),
            content: $playerList[0].outerHTML
        })
        .off("mouseenter").on("mouseenter", function() {
            let _this = this;
            $(this).popover("show");
            $(".popover").off("mouseleave").on("mouseleave", function() {
                if (!roomBrowser.activeRooms[roomId]) $(".popover").off().remove();
                else if (!$(`#rbRoom-${roomId}:hover`).length) $(_this).popover("hide");
            });
            $(`#rbRoom-${roomId}`).off("mouseleave").on("mouseleave", function() {
                if (!$(".popover:hover").length) $(_this).popover("hide");
            });
            $(".popover").off("click").on("click", "li", function(e) {
                playerProfileController.loadProfile(e.target.innerText, $(`#rbRoom-${roomId}`), {}, () => {}, false, true);
            })
        })
    }
}

// overload updateFriends function to also show invisible friends
RoomTile.prototype.updateFriends = function() {
    this._friendsInGameMap = {};
    this._players.forEach((player) => {
        if (socialTab.onlineFriends[player] || socialTab.offlineFriends[player]) {
            this._friendsInGameMap[player] = true;
        }
    });
    this.updateFriendInfo();
};

// add click event to host name to open player profile
RoomTile.prototype.clickHostName = function(host) {
    this.$tile.find(".rbrHost").css("cursor", "pointer").unbind("click").click(() => {
        playerProfileController.loadProfile(host, $(`#rbRoom-${this.id}`), {}, () => {}, false, true);
    });
};

// updates the room tile avatar when a new host is promoted
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
