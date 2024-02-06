// ==UserScript==
// @name         Force Catbox Redirect
// @namespace    https://github.com/kempanator
// @version      0.1
// @description  Force redirects on all catbox.video links
// @author       kempanator
// @match        https://*.catbox.video/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/forceCatboxRedirect.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/forceCatboxRedirect.user.js
// ==/UserScript==

/*
This is for opening catbox links in a new tab
(not for AMQ)
*/

let host = "ladist1"; //nl, ladist1, vhdist1
let url = window.location.href;

if (/^https:\/\/[a-z0-9]+\.catbox\.video/.test(url) && !url.includes(host + ".catbox.video")) {
    window.location.replace(url.replace(/^https:\/\/[a-z0-9]+/, "https://" + host));
}
