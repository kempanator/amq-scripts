// ==UserScript==
// @name         Force Song Link Redirect
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Force redirects on all animemusicquiz.com song links
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/forceSongLinkRedirect.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/forceSongLinkRedirect.user.js
// ==/UserScript==

/*
This is for opening song links in a new tab
(not for AMQ)
*/

let host = 1; //only change this for different host
let hostMap = {1: "eudist", 2: "nawdist", 3: "naedist"};

let regex = /^https:\/\/(\w+)\.animemusicquiz\.com/.exec(window.location.href);
if (regex && Object.values(hostMap).includes(regex[1]) && hostMap[host] !== regex[1]) {
    let newURL = window.location.href.replace(/^https:\/\/\w+/, "https://" + hostMap[host]);
    window.location.replace(newURL);
}
