// ==UserScript==
// @name            AMQ Show Room Players
// @namespace       https://github.com/kempanator
// @version         0.2
// @description     Mouse over the players bar on a room tile to show full player list
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowRoomPlayers.js
// ==/UserScript==

if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    new Listener("New Rooms", (payload) => {
        payload.forEach(item => {
            setTimeout(() => {
                updateRoomTile(item.id);
            }, 10);
        });
    }).bindListener();
    new Listener("Room Change", (payload) => {
        if (payload.changeType === "players" || payload.changeType === "spectators") {
            setTimeout(() => {
                updateRoomTile(payload.roomId);
            }, 10);
        }
    }).bindListener();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        description: `<p>Mouse over the players bar on a room tile to show full player list</p>`
    });
}

function updateRoomTile(roomId) {
    if (!roomBrowser.activeRooms[roomId]) return;
    let roomSelector = "#rbRoom-" + roomId;
    let $playerList = $("<ul></ul>");
    let players = roomBrowser.activeRooms[roomId]._players.sort((a, b) => a.localeCompare(b));
    players.forEach(player => { $playerList.append($("<li></li>").text(player)) });
    if ($(roomSelector).find(".rbrProgressContainer").data("bs.popover")) {
        $(roomSelector).find(".rbrProgressContainer").data("bs.popover").options.content = $playerList[0].outerHTML;
    }
    else {
        $(roomSelector).find(".rbrProgressContainer").tooltip("destroy");
        $(roomSelector).find(".rbrProgressContainer").attr("data-toggle", "popover");
        $(roomSelector).find(".rbrProgressContainer").popover({
            container: "#roomBrowserPage",
            placement: "auto top",
            trigger: "hover",
            html: true,
            title: "Players",
            content: $playerList[0].outerHTML
        });
    }
}
