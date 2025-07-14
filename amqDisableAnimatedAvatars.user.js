// ==UserScript==
// @name         AMQ Disable Animated Avatars
// @namespace    https://github.com/kempanator
// @version      0.4
// @description  Disable animated avatars in AMQ
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqDisableAnimatedAvatars.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqDisableAnimatedAvatars.user.js
// ==/UserScript==

"use strict";
if (typeof Listener === "undefined") return;

SpineApp.prototype.render = function (canvas) {
    let renderer = canvas.renderer;
    if (!this.paused) {
        canvas.clear(0, 0, 0, 0);
        renderer.begin();
        renderer.drawSkeleton(this.skeleton, this.pma);
        renderer.end();
        this.paused = true;
    }
}

SpineApp.prototype.setAnimation = function (animationName, loop) {
    this.paused = false;
    if (this.animationState) this.animationState.setAnimation(0, animationName, loop);
}

SpineAnimation.prototype.updatePose = function (poseId) {
    this.poseId = poseId;
    this.spineApp.setAnimation(this.POSE_ID_ANIMATION_NAMES[this.poseId], true);
}

SimpleAnimationController.prototype.runAnimation = function () { }

AMQ_addScriptData({
    name: "Disable Animated Avatars",
    author: "kempanator",
    version: GM_info.script.version,
    link: "https://github.com/kempanator/amq-scripts/raw/main/amqDisableAnimatedAvatars.user.js",
    description: `<p>Disable animated avatars in lobby, quiz, and friends list</p>`
});
