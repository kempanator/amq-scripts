// ==UserScript==
// @name            AMQ Show Room Players
// @namespace       https://github.com/kempanator
// @version         0.4
// @description     Adds extra functionality to room tiles
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.js
// ==/UserScript==

/*
New room tile features:
1. Click host name to open player profile
2. Mouse over the players bar to show full player list (friends are highlighted blue)
3. Invisible friends are no longer hidden
4. Bug fix for friends list and host avatar not getting updated
*/

if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    new Listener("New Rooms", (payload) => {
        payload.forEach(item => {
            setTimeout(() => { updateRoomTile(item.id, item.host) }, 1);
        });
    }).bindListener();
    new Listener("Room Change", (payload) => {
        if (payload.changeType === "players" || payload.changeType === "spectators") {
            setTimeout(() => {
                if (roomBrowser.activeRooms[payload.roomId]) {
                    roomBrowser.activeRooms[payload.roomId].updateFriends();
                    if (payload.newHost) {
                        roomBrowser.activeRooms[payload.roomId].updateAvatar(payload.newHost.avatar);
                        $(`#rbRoom-${payload.roomId} img.rbrRoomImage`).removeClass().addClass(`rbrRoomImage sizeMod${payload.newHost.avatar.avatar.sizeModifier}`);
                        updateRoomTile(payload.roomId, payload.newHost.name);
                    }
                    else {
                        updateRoomTile(payload.roomId);
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
            <p>1. Click host name to open player profile</p>
            <p>2. Mouse over the players bar to show full player list (friends are highlighted blue)</p>
            <p>3. Invisible friends are no longer hidden</p>
            <p>4. Bug fix for friends list and host avatar not getting updated</p>
        `
    });
}

// input room id number and host name (optional)
function updateRoomTile(roomId, host) {
    let $playerList = $("<ul></ul>");
    let players = roomBrowser.activeRooms[roomId]._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").text(player);
        if (roomBrowser.activeRooms[roomId]._friendsInGameMap[player]) li.css("color", "#4497EA");
        $playerList.append(li);
    }
    if (host) {
        $(`#rbRoom-${roomId} .rbrHost`).css("cursor", "pointer").unbind("click").click(() => {
            playerProfileController.loadProfile(host, $(`#rbRoom-${roomId}`), {}, () => {}, false, true);
        });
    }
    if ($(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover")) {
        $(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover").options.content = $playerList[0].outerHTML;
        $(`#rbRoom-${roomId} .rbrProgressContainer`).data("bs.popover").options.title = players.length + " Player" + (players.length === 1 ? "" : "s");
    }
    else {
        $(`#rbRoom-${roomId} .rbrFriendPopover`).data("bs.popover").options.placement = "bottom";
        $(`#rbRoom-${roomId} .rbrProgressContainer`).tooltip("destroy").removeAttr("data-original-title").attr("data-toggle", "popover").popover({
            container: "#roomBrowserPage",
            placement: "bottom",
            trigger: "hover",
            html: true,
            title: players.length + " Player" + (players.length === 1 ? "" : "s"),
            content: $playerList[0].outerHTML
        });
    }
}

// overload updateFriends function to also show invisible friends
RoomTile.prototype.updateFriends = function () {
    this._friendsInGameMap = {};
    this._players.forEach((player) => {
        if (socialTab.onlineFriends[player] || socialTab.offlineFriends[player]) {
            this._friendsInGameMap[player] = true;
        }
    });
    this.updateFriendInfo();
};

// updates the room tile avatar when a new host is promoted
RoomTile.prototype.updateAvatar = function (avatarInfo) {
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
