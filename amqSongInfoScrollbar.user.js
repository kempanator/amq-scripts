// ==UserScript==
// @name         AMQ Song Info Scrollbar
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Set a maximum height for the song info box and add a scrollbar if it is too big
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqSongInfoScrollbar.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqSongInfoScrollbar.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

let height = "350px";
let $scrollContainer;

function setup() {
    const $infoHider = $("#qpInfoHider");
    $infoHider.css({
        "height": "100%",
        "display": "flex",
        "align-items": "center",
        "justify-content": "center",
        "padding": "0"
    });

    const $songInfo = $("#qpSongInfoContainer");
    $songInfo.css("padding", "0");
    $songInfo.find(".row").css("margin", "0");
    $songInfo.children("#qpRateOuterContainer, #qpReportFeedbackContainer").wrapAll('<div id="qpSongInfoBottomContainer"></div>');
    $songInfo.children().not("#qpSongInfoBottomContainer").wrapAll('<div id="qpSongInfoScrollContainer"></div>');
    $scrollContainer = $songInfo.children("#qpSongInfoScrollContainer");
    $scrollContainer.css({ "max-height": height, "position": "relative" });
    $scrollContainer.perfectScrollbar({ suppressScrollX: true });
    quiz.infoContainer.$extraAnimeSongInfo.css("margin-top", "-20px");
    quiz.infoContainer.$extraAnimeSongInfo.prependTo("#qpSongInfoBottomContainer");
    quiz.infoContainer.$extraAnimeSongInfo.data("bs.popover").options.container = "#qpSongInfoContainer";

    new Listener("answer results", () => {
        setTimeout(() => {
            $scrollContainer.perfectScrollbar({ suppressScrollX: true });
            $scrollContainer.scrollTop(0);
            $scrollContainer.perfectScrollbar("update");
        }, 0);
    }).bindListener();

    new Listener("play next song", () => {
        //people might have a script to disable the info hider and see the previous song
        setTimeout(() => {
            if ($infoHider.is(":visible")) {
                $scrollContainer.scrollTop(0);
                $scrollContainer.perfectScrollbar("update");
                $scrollContainer.perfectScrollbar("destroy");
            }
        }, 0);
    }).bindListener();

    AMQ_addScriptData({
        name: "Song Info Scrollbar",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqSongInfoScrollbar.user.js",
        description: `<p>Set a maximum height for the song info box and add a scrollbar if it is too big</p>`
    });
}
