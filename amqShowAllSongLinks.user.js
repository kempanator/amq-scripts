// ==UserScript==
// @name         AMQ Show All Song Links
// @namespace    https://github.com/kempanator
// @version      0.11
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
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const SCRIPT_VERSION = "0.11";
const SCRIPT_NAME = "Show All Song Links";
const LISTS = [
    { label: "ANI", key: "aniListId", url: "https://anilist.co/anime/" },
    { label: "KIT", key: "kitsuId", url: "https://kitsu.io/anime/" },
    { label: "MAL", key: "malId", url: "https://myanimelist.net/anime/" },
    { label: "ANN", key: "annId", url: "https://www.animenewsnetwork.com/encyclopedia/anime.php?id=" },
];
const SONG_LINKS = [
    { label: "720", key: "720" },
    { label: "480", key: "480" },
    { label: "MP3", key: "0" },
];
let $qpSongInfoLinkRow;

function setup() {
    $qpSongInfoLinkRow = $("#qpSongInfoLinkRow");
    new Listener("answer results", (data) => {
        setTimeout(() => {
            const $b = $("<b>");
            for (const item of LISTS) {
                $b.append(buildLink(getListSiteUrl(data, item.key, item.url), item.label));
            }
            $b.append("<br>");
            for (const item of SONG_LINKS) {
                $b.append(buildLink(getSongUrl(data, item.key), item.label));
            }
            $qpSongInfoLinkRow.find("b").remove();
            $qpSongInfoLinkRow.prepend($b);
        }, 0);
    }).bindListener();

    applyStyles();
    AMQ_addScriptData({
        name: SCRIPT_NAME,
        author: "kempanator",
        version: SCRIPT_VERSION,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqShowAllSongLinks.user.js",
        description: `
            <p>Show all song links in the song info container</p>
        `
    });
}

// get list site url
function getListSiteUrl(data, type, url) {
    const id = data.songInfo?.siteIds?.[type];
    if (!id) return "";
    return url + id;
}

// get song url from answer results data, handle bad data
function getSongUrl(data, type) {
    const url = data.songInfo?.videoTargetMap?.catbox?.[type] ?? data.songInfo?.videoTargetMap?.openingsmoe?.[type];
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return videoResolver.formatUrl(url);
}

// build link element in song info box
function buildLink(url, text) {
    return $(`<a href="${url}" target="_blank">${text}</a>`).toggleClass("disabled", !url);
}

// apply styles
function applyStyles() {
    let css = /*css*/ `
        #qpSongInfoLinkRow b a {
            margin: 0 3px;
        }
        #qpExtraSongInfo {
            z-index: 1;
        }
    `;
    let style = document.getElementById("showAllSongLinksStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "showAllSongLinksStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
