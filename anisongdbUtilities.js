// ==UserScript==
// @name         Anisongdb Utilities
// @namespace    https://github.com/kempanator
// @version      0.2
// @description  some extra functions for anisongdb.com
// @author       kempanator
// @match        https://anisongdb.com/*
// @grant        none
// ==/UserScript==

"use strict";
const autoPlayMP3 = true; //auto play audio when you click the mp3 button for a song
const jsonDownloadRename = true; //force your json file name to match your search query

let loadInterval = setInterval(() => {
    if (document.querySelector("#table")) {
        setup();
        clearInterval(loadInterval);
    }
}, 200);

function setup() {
    if (autoPlayMP3) {
        new MutationObserver(() => {
            let audioInterval = setInterval(() => {
                if (document.querySelector("audio")) {
                    document.querySelector("audio").addEventListener("canplay", function() {
                        this.play();
                        clearInterval(audioInterval);
                    });
                }
            }, 10);
        }).observe(document.querySelector("#video-player"), {attributes: true});
    }
    if (jsonDownloadRename) {
        document.querySelector("a.showFilter").addEventListener("click", function() {
            let name;
            for (let input of document.querySelectorAll(`input.textInputFilter[placeholder*="Search"]`)) {
                if (input.value !== "") {
                    name = input.value;
                    break;
                }
            }
            this.setAttribute("download", name + ".json");
        });
    }
    document.body.addEventListener("keypress", (event) => {
        if (event.ctrlKey && event.code === "KeyB") {
            document.querySelector("a.showFilter").click();
        }
    });
}
