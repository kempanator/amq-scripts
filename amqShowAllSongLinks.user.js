// ==UserScript==
// @name         AMQ Show All Song Links
// @namespace    https://github.com/kempanator
// @version      0.9
// @description  Show all song links in the song info container
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqShowAllSongLinks.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqShowAllSongLinks.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.9";

function setup() {
    new Listener("answer results", (data) => {
        setTimeout(() => {
            $("#qpSongInfoLinkRow b").remove();
            let urlAni = data.songInfo.siteIds.aniListId ? "https://anilist.co/anime/" + data.songInfo.siteIds.aniListId : "";
            let urlKit = data.songInfo.siteIds.kitsuId ? "https://kitsu.io/anime/" + data.songInfo.siteIds.kitsuId : "";
            let urlMal = data.songInfo.siteIds.malId ? "https://myanimelist.net/anime/" + data.songInfo.siteIds.malId : "";
            let urlAnn = data.songInfo.siteIds.annId ? "https://www.animenewsnetwork.com/encyclopedia/anime.php?id=" + data.songInfo.siteIds.annId : "";
            let url720 = formatURL(data.songInfo.videoTargetMap.catbox?.[720] ?? data.songInfo.videoTargetMap.openingsmoe?.[720]);
            let url480 = formatURL(data.songInfo.videoTargetMap.catbox?.[480] ?? data.songInfo.videoTargetMap.openingsmoe?.[480]);
            let urlMp3 = formatURL(data.songInfo.videoTargetMap.catbox?.[0] ?? data.songInfo.videoTargetMap.openingsmoe?.[0]);
            let $b = $(`<b></b>`);
            $b.append($("<a></a>").attr({href: urlAni, target: "_blank"}).addClass(urlAni ? "" : "disabled").text("ANI"));
            $b.append($("<a></a>").attr({href: urlKit, target: "_blank"}).addClass(urlKit ? "" : "disabled").text("KIT"));
            $b.append($("<a></a>").attr({href: urlMal, target: "_blank"}).addClass(urlMal ? "" : "disabled").text("MAL"));
            $b.append($("<a></a>").attr({href: urlAnn, target: "_blank"}).addClass(urlAnn ? "" : "disabled").text("ANN"));
            $b.append("<br>");
            $b.append($("<a></a>").attr({href: url720, target: "_blank"}).addClass(url720 ? "" : "disabled").text("720"));
            $b.append($("<a></a>").attr({href: url480, target: "_blank"}).addClass(url480 ? "" : "disabled").text("480"));
            $b.append($("<a></a>").attr({href: urlMp3, target: "_blank"}).addClass(urlMp3 ? "" : "disabled").text("MP3"));
            $("#qpSongInfoLinkRow").prepend($b);
        }, 0);
    }).bindListener();

    applyStyles();
    AMQ_addScriptData({
        name: "Show All Song Links",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqShowAllSongLinks.user.js",
        description: `
            <p>Show all song links in the song info container</p>
        `
    });
}

// format song url, handle bad data
function formatURL(url) {
    if (url) {
        if (url.startsWith("http")) {
            return url;
        }
        else {
            return videoResolver.formatUrl(url);
        }
    }
    return "";
}

// apply styles
function applyStyles() {
    //$("#showAllSongLinksStyle").remove();
    let css = /*css*/ `
        #qpSongInfoLinkRow b a {
            margin: 0 3px;
        }
        #qpExtraSongInfo {
            z-index: 1;
        }
    `;
    let style = document.createElement("style");
    style.id = "showAllSongLinksStyle";
    style.textContent = css.trim();
    document.head.appendChild(style);
}
