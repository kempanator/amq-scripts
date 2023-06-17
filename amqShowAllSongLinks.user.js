// ==UserScript==
// @name         AMQ Show All Song Links
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Show all song links in the song info container
// @author       kempanator
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL  https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowAllSongLinks.user.js
// @updateURL    https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqShowAllSongLinks.user.js
// ==/UserScript==

"use strict";
if (document.querySelector("#startPage")) return;
let loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

const version = "0.1";

function setup() {
    new Listener("answer results", (payload) => {
        setTimeout(() => {
            $("#qpSongInfoLinkRow b").remove();
            let urlAni = payload.songInfo.siteIds.aniListId ? "https://anilist.co/anime/" + payload.songInfo.siteIds.aniListId : "";
            let urlKit = payload.songInfo.siteIds.kitsuId ? "https://kitsu.io/anime/" + payload.songInfo.siteIds.kitsuId : "";
            let urlMal = payload.songInfo.siteIds.malId ? "https://myanimelist.net/anime/" + payload.songInfo.siteIds.malId : "";
            let urlAnn = payload.songInfo.siteIds.annId ? "https://www.animenewsnetwork.com/encyclopedia/anime.php?id=" + payload.songInfo.siteIds.annId : "";
            let url720 = payload.songInfo.urlMap.catbox?.[720] ?? payload.songInfo.urlMap.openingsmoe?.[720] ?? "";
            let url480 = payload.songInfo.urlMap.catbox?.[480] ?? payload.songInfo.urlMap.openingsmoe?.[480] ?? "";
            let urlmp3 = payload.songInfo.urlMap.catbox?.[0] ?? payload.songInfo.urlMap.openingsmoe?.[0] ?? "";
            let $b = $(`<b></b>`);
            $b.append($("<a></a>").attr({href: urlAni, target: "_blank"}).addClass(urlAni ? "" : "disabled").text("ANI"));
            $b.append($("<a></a>").attr({href: urlKit, target: "_blank"}).addClass(urlKit ? "" : "disabled").text("KIT"));
            $b.append($("<a></a>").attr({href: urlMal, target: "_blank"}).addClass(urlMal ? "" : "disabled").text("MAL"));
            $b.append($("<a></a>").attr({href: urlAnn, target: "_blank"}).addClass(urlAnn ? "" : "disabled").text("ANN"));
            $b.append("<br>");
            $b.append($("<a></a>").attr({href: url720, target: "_blank"}).addClass(url720 ? "" : "disabled").text("720"));
            $b.append($("<a></a>").attr({href: url480, target: "_blank"}).addClass(url480 ? "" : "disabled").text("480"));
            $b.append($("<a></a>").attr({href: urlmp3, target: "_blank"}).addClass(urlmp3 ? "" : "disabled").text("MP3"));
            $("#qpSongInfoLinkRow").prepend($b);
        }, 0);
    }).bindListener();

    applyStyles();
    AMQ_addScriptData({
        name: "Show All Song Links",
        author: "kempanator",
        description: `
            <p>Version: ${version}</p>
            <p>Show all song links in the song info container</p>
        `
    });
}

// apply styles
function applyStyles() {
    //$("#showAllSongLinksStyle").remove();
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "showAllSongLinksStyle";
    style.appendChild(document.createTextNode(`
        #qpSongInfoLinkRow b a {
            margin: 0 3px;
        }
        #qpExtraSongInfo {
            z-index: 1;
        }
    `));
    document.head.appendChild(style);
}
