// ==UserScript==
// @name         AMQ Avatar Store Plus
// @namespace    https://github.com/kempanator
// @version      0.4
// @description  More features for the avatar store
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqAvatarStorePlus.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqAvatarStorePlus.user.js
// ==/UserScript==

/*
IMPORTANT: disable these scripts before installing
- skin plus by mxyuki

New Features:
- Search avatar colors, jump to the next match 
- Bulk buy multiple skins on the current page
- Wishlist for individual skins (click a heart on a tile)
- Set a custom size for the store avatar tiles
- Randomize your current avatar and background
- Unhide and fix filtering for event skins
*/

"use strict";
if (typeof Listener === "undefined") return;
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const saveData = validateLocalStorage("avatarStorePlus");
let avatarTileWidth = saveData.avatarTileWidth ?? "";
let avatarTileGap = saveData.avatarTileGap ?? "";
let avatarInfoLogging = saveData.avatarInfoLogging ?? false;
let disableBulkBuy = saveData.disableBulkBuy ?? false;
let legacyAvatarStoreFilters = saveData.legacyAvatarStoreFilters ?? false;
let wishlist = normalizeWishlistFromStorage(saveData.wishlist);
let wishlistSort = normalizeWishlistSort(saveData.wishlistSort);
let hotKeys = {
    prevPage: loadHotkey("prevPage"),
    nextPage: loadHotkey("nextPage"),
}

let $modernFilters;
let $legacyFilters;
let $searchInput;
let $wishlist;
let aspStoreColorCatalogRankMap = new Map();

CURRENCY_BASE_URL = "https://cdn.animemusicquiz.com/v1/ui/currency/30px/";
TIER_MAP = {
    0: {
        name: "Standard",
        title: "Note-priced skins",
        icon: { type: "img", src: `/img/ui/currency/Icon_Normal.svg` },
        amount: null,
    },
    1: {
        name: "Common",
        title: "Common ticket tier",
        icon: { type: "img", src: `${CURRENCY_BASE_URL}ticket1.webp` },
        amount: 20,
    },
    2: {
        name: "Rare",
        title: "Rare ticket tier",
        icon: { type: "img", src: `${CURRENCY_BASE_URL}ticket2.webp` },
        amount: 60,
    },
    3: {
        name: "Epic",
        title: "Epic ticket tier",
        icon: { type: "img", src: `${CURRENCY_BASE_URL}ticket3.webp` },
        amount: 200,
    },
    4: {
        name: "Legendary",
        title: "Legendary ticket tier",
        icon: { type: "img", src: `${CURRENCY_BASE_URL}ticket4.webp` },
        amount: 700,
    },
    5: {
        name: "Unique",
        title: "Unique skin",
        icon: { type: "fa", classes: "fa fa-question-circle-o" },
        amount: null,
    },
}

// setup
function setup() {
    // Build legacy and modern store top filters
    const $top = $("#swRightColumnTop");
    $modernFilters = $(`
        <div id="aspModernStoreTopFilters">
            <div class="asp-stf-heading-row">
                <div class="asp-stf-heading">Filters</div>
                <span id="aspStfFilterCount" class="asp-stf-heading-count" title=""></span>
                <button type="button" id="aspModernFiltersReset" class="asp-stf-reset" title="Reset filters to defaults">Reset</button>
            </div>
            <div class="asp-stf-row" data-asp-stf-axis="ownership">
                <span class="asp-stf-label" style="margin-left: 30px;">Ownership</span>
                <div class="asp-stf-segs">
                    <button type="button" class="asp-stf-seg active" data-asp-stf-value="all">All</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="unlocked">Unlocked</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="locked">Locked</button>
                </div>
            </div>
            <div class="asp-stf-row" data-asp-stf-axis="release">
                <span class="asp-stf-label" style="margin-left: 18px;">Release</span>
                <div class="asp-stf-segs">
                    <button type="button" class="asp-stf-seg active" data-asp-stf-value="all">All</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="available">Available</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="unavailable">Unavailable</button>
                </div>
            </div>
            <div class="asp-stf-row" data-asp-stf-axis="rotation">
                <span class="asp-stf-label" style="margin-left: 5px;">Rotation</span>
                <div class="asp-stf-segs">
                    <button type="button" class="asp-stf-seg active" data-asp-stf-value="all">All</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="limited">Limited</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="permanent">Permanent</button>
                </div>
            </div>
            <div class="asp-stf-row" data-asp-stf-axis="type">
                <span class="asp-stf-label" style="margin-left: -8px;">Type</span>
                <div class="asp-stf-segs">
                    <button type="button" class="asp-stf-seg active" data-asp-stf-value="all">All</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="exclusive">Exclusive</button>
                    <span class="asp-stf-sep" aria-hidden="true">|</span>
                    <button type="button" class="asp-stf-seg" data-asp-stf-value="standard">Standard</button>
                </div>
            </div>
            <div class="asp-stf-row" data-asp-stf-axis="ticketTier">
                <span class="asp-stf-label" style="margin-left: -20px;">Ticket tier</span>
                <div class="asp-stf-tiers-cluster">
                    <div class="asp-stf-tiers">
                        <button type="button" class="asp-stf-tier active" data-asp-tier="1">
                            <img class="asp-stf-tier-img" src="${CURRENCY_BASE_URL}ticket1.webp" decoding="async"></button>
                        <button type="button" class="asp-stf-tier active" data-asp-tier="2">
                            <img class="asp-stf-tier-img" src="${CURRENCY_BASE_URL}ticket2.webp" decoding="async"></button>
                        <button type="button" class="asp-stf-tier active" data-asp-tier="3">
                            <img class="asp-stf-tier-img" src="${CURRENCY_BASE_URL}ticket3.webp" decoding="async"></button>
                        <button type="button" class="asp-stf-tier active" data-asp-tier="4">
                            <img class="asp-stf-tier-img" src="${CURRENCY_BASE_URL}ticket4.webp" decoding="async"></button>
                    </div>
                    <div id="aspStfTicketTierInfo" class="asp-info-icon" title="">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                    </div>
                </div>
            </div>
        </div>`);
    $legacyFilters = $(`<div id="aspLegacyStoreTopFilters"></div>`);
    $top.children().appendTo($legacyFilters);
    legacyAvatarStoreFilters ? $modernFilters.hide() : $legacyFilters.hide();
    $top.append($legacyFilters, $modernFilters);

    // Create tab container (tab buttons)
    const $tabContainer = $(`
        <div id="aspAvatarTabContainer" class="tabContainer">
            <div id="aspAvatarTab" class="tab clickAble selected"><h5>Avatar</h5></div>
            <div id="aspSearchTab" class="tab clickAble"><h5>Search</h5></div>
            <div id="aspWishlistTab" class="tab clickAble"><h5>Wishlist</h5></div>
            <div id="aspSettingsTab" class="tab clickAble"><h5>Settings</h5></div>
        </div>
    `);

    // Create avatar container and move existing children into it
    const $avatarContainer = $(`<div id="aspAvatarContainer" class="tabSection"></div>`);
    const $bottomInner = $("#swRightColumnBottomInner");
    $bottomInner
        .children()
        .not(".ps__scrollbar-x-rail, .ps__scrollbar-y-rail")
        .appendTo($avatarContainer);
    $avatarContainer.find("#swRightColumnActionButtonContainer").after($(`
        <div id="aspAvatarButtonRow">
            <div class="asp-goto-group">
                <span style="font-size: 20px;">Find</span>
                <div class="btn-group" role="group">
                    <button type="button" id="aspGoToAvatarBtn" class="btn btn-default asp-goto-btn" title="Open the current avatar in the store">
                        <i class="fa fa-user" aria-hidden="true"></i>
                    </button>
                    <button type="button" id="aspGoToBackgroundBtn" class="btn btn-default asp-goto-btn" title="Open the current background in the store">
                        <i class="fa fa-picture-o" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
            <div class="btn-group" role="group">
                <button type="button" id="aspRandomizeButton" class="btn btn-primary" title="Randomize the current avatar/background (obeys filters)">Randomize</button>
                <button type="button" id="aspRandomizeOptionsToggle" class="btn btn-primary asp-randomize-options-caret-btn" title="Show or hide randomize options">
                    <i id="aspRandomizeOptionsCaret" class="fa fa-caret-down" aria-hidden="true"></i>
                </button>
            </div>
        </div>
        <div id="aspRandomizeOptionsPanel" class="asp-randomize-options-panel" style="display: none;">
            <div class="asp-randomize-options-inner">
                <label class="aspRandLabel">
                    <input type="checkbox" id="aspRandPartAvatar" checked> Avatar
                </label>
                <label class="aspRandLabel">
                    <input type="checkbox" id="aspRandPartBackground" checked> Background
                </label>
                <label class="aspRandLabel">
                    <input type="checkbox" id="aspRandPartAccessory"> Accessory
                </label>
            </div>
        </div>
    `));

    // Search tab panel
    const $searchContainer = $(`
        <div id="aspSearchContainer" class="tabSection">
            <div id="aspSearchRow">
                <input type="search" id="aspSearchInput" class="form-control" placeholder="Search avatar list…" autocomplete="off" spellcheck="false">
                <button type="button" id="aspSearchPrevBtn" class="btn btn-default asp-search-button" title="Previous outfit page (filtered by search if active) — Shift+Enter">
                    <i class="fa fa-arrow-left" aria-hidden="true"></i>
                </button>
                <button type="button" id="aspSearchNextBtn" class="btn btn-default asp-search-button" title="Next outfit page (filtered by search if active) — Enter">
                    <i class="fa fa-arrow-right" aria-hidden="true"></i>
                </button>
            </div>
            <div id="aspSearchSummary" class="asp-search-summary">
                <div id="aspSearchMatches" class="asp-search-summary-line"></div>
                <div id="aspSearchPage" class="asp-search-summary-line"></div>
            </div>
            <div id="aspContextPanel" class="asp-context-panel">
                <div id="aspContextName" class="asp-context-name">—</div>
                <div id="aspContextOwned" class="asp-context-owned">
                    <span class="asp-context-owned-label">Owned:</span>
                    <div class="asp-progress" title="Unlocked / total in this view">
                        <div id="aspContextProgressBar" class="asp-progress-bar"></div>
                        <span id="aspContextProgressText" class="asp-progress-text">0%</span>
                    </div>
                    <span id="aspContextOwnedFraction" class="asp-context-owned-fraction">0/0</span>
                </div>
                <div id="aspContextBreakdown" class="asp-context-breakdown"></div>
            </div>
            <h4>Bulk Buy</h4>
            <p class="asp-bulk-note">Top-of-store filters apply</p>
            <button type="button" id="aspBuyAllBtn" class="btn btn-default" title="Buy all skins on this page">Buy</button>
        </div>
    `);

    // Wishlist panel
    const $wishlistContainer = $(`
        <div id="aspWishlistContainer" class="tabSection">
            <div class="asp-wishlist-sort-bar">
                <label class="asp-wishlist-sort-label" for="aspWishlistSortMode">Sort by</label>
                <select id="aspWishlistSortMode" class="form-control asp-wishlist-sort-select" title="Wishlist sort order">
                    <option value="catalog">Catalog order</option>
                    <option value="alpha">Alphabetical</option>
                    <option value="tier">Tier</option>
                </select>
                <button type="button" id="aspWishlistSortDir" class="btn btn-default asp-wishlist-sort-dir" title="Ascending / descending">
                    <i class="fa fa-sort-amount-asc" aria-hidden="true"></i>
                </button>
            </div>
            <div id="aspWishlistList" class="asp-wishlist-list"></div>
        </div>
    `);

    // Settings panel with details and controls
    const $settingsContainer = $(`
        <div id="aspSettingsContainer" class="tabSection" style="padding: 5px;">
            <div style="text-align: center;">
                <h4 style="margin: 5px 0;"><b>Avatar Store Plus</b></h4>
                <div>Created by: kempanator</div>
                <div>Version: ${GM_info.script.version}</div>
                <div>
                    <a href="https://github.com/kempanator/amq-scripts/blob/main/amqAvatarStorePlus.user.js" target="_blank" rel="noopener noreferrer">GitHub</a>
                    ·
                    <a href="https://github.com/kempanator/amq-scripts/raw/main/amqAvatarStorePlus.user.js" target="_blank" rel="noopener noreferrer">Install</a>
                </div>
            </div>
            <div class="asp-settings-h4-row">
                <h4>CSS</h4>
                <div id="aspCssSettingsInfo" class="asp-info-icon" title="">
                    <i class="fa fa-info-circle" aria-hidden="true"></i>
                </div>
            </div>
            <table class="asp-settings-tile-table">
                <tbody>
                    <tr>
                        <td><label for="aspAvatarTileWidth">Avatar tile width</label></td>
                        <td class="asp-settings-tile-value"><input type="text" id="aspAvatarTileWidth"></td>
                    </tr>
                    <tr>
                        <td><label for="aspAvatarTileGap">Avatar tile gap</label></td>
                        <td class="asp-settings-tile-value"><input type="text" id="aspAvatarTileGap"></td>
                    </tr>
                </tbody>
            </table>
            <h4>Hotkeys</h4>
            <table id="aspHotkeyTable" class="asp-settings-tile-table">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Keybind</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
            <h4>Backup</h4>
            <div class="asp-settings-backup-row">
                <button type="button" id="aspSettingsImport" class="btn btn-default" title="Load wishlist and settings from a JSON file">Import</button>
                <button type="button" id="aspSettingsExport" class="btn btn-default" title="Download wishlist and settings as JSON">Export</button>
            </div>
            <input type="file" id="aspSettingsImportFile" accept=".json" aria-hidden="true" tabindex="-1" style="display: none;">
            <h4>Debug</h4>
            <div class="asp-settings-checkbox-row">
                <label for="aspLegacyFiltersToggle">
                    <input type="checkbox" id="aspLegacyFiltersToggle" title="Show the game’s original checkbox filters in the store header">
                    Use legacy avatar filters
                </label>
            </div>
            <div class="asp-settings-checkbox-row">
                <label for="aspAvatarInfoLogging">
                    <input type="checkbox" id="aspAvatarInfoLogging" title="Log store tile info on click">
                    Log store tile info on click
                </label>
            </div>
            <div class="asp-settings-checkbox-row">
                <label for="aspDisableBulkBuy">
                    <input type="checkbox" id="aspDisableBulkBuy" title="Log bulk purchases to the console, do not spend currency">
                    Disable bulk purchases
                </label>
            </div>
            <button type="button" id="aspApplyStylesButton" class="btn btn-default">Apply Styles</button>
        </div>
    `);

    // Insert all containers in order
    $bottomInner.prepend($tabContainer, $avatarContainer, $searchContainer, $wishlistContainer, $settingsContainer);

    // Slot a color-name strip above the pose row showing the active avatar and background colors.
    $(/*html*/`
        <div id="aspColorNames">
            <div class="asp-color-names-row">
                <span class="asp-color-names-label">Avatar:</span>
                <span class="asp-color-names-value" data-asp-target="avatar">—</span>
            </div>
            <div class="asp-color-names-row">
                <span class="asp-color-names-label">Background:</span>
                <span class="asp-color-names-value" data-asp-target="background">—</span>
            </div>
        </div>
    `).insertBefore("#swRightColumnBonusContainer");
    const origDisplayAvatar = StoreAvatarColumn.prototype.displayAvatar;
    StoreAvatarColumn.prototype.displayAvatar = function () {
        origDisplayAvatar.apply(this, arguments);
        updateAspColorNames();
    };
    const origDisplayBackground = StoreAvatarColumn.prototype.displayBackground;
    StoreAvatarColumn.prototype.displayBackground = function () {
        origDisplayBackground.apply(this, arguments);
        updateAspColorNames();
    };
    updateAspColorNames();

    // Setup tab handlers
    $("#aspAvatarTab").on("click", () => switchTab("aspAvatar"));
    $("#aspSearchTab").on("click", () => switchTab("aspSearch"));
    $("#aspWishlistTab").on("click", () => switchTab("aspWishlist"));
    $("#aspSettingsTab").on("click", () => switchTab("aspSettings"));
    switchTab("aspAvatar");

    // Global variables
    $searchInput = $("#aspSearchInput");
    $wishlist = $("#aspWishlistList");

    // Setup modern filters handlers
    $("#aspModernFiltersReset").on("click", function () {
        $modernFilters.find(".asp-stf-row").each(function () {
            const $row = $(this);
            if ($row.attr("data-asp-stf-axis") === "ticketTier") {
                $row.find(".asp-stf-tier").addClass("active");
            }
            else {
                $row.find(".asp-stf-seg").removeClass("active");
                $row.find('.asp-stf-seg[data-asp-stf-value="all"]').addClass("active");
            }
        });
        applyAspStoreTopFilters();
    });
    $modernFilters.on("click", ".asp-stf-seg", function () {
        const $btn = $(this);
        const $row = $btn.closest(".asp-stf-row");
        $row.find(".asp-stf-seg").removeClass("active");
        $btn.addClass("active");
        applyAspStoreTopFilters();
    });
    $modernFilters.on("click", ".asp-stf-tier", function () {
        const $btn = $(this);
        $btn.toggleClass("active");
        applyAspStoreTopFilters();
    });
    $("#aspCssSettingsInfo").popover({
        trigger: "hover",
        delay: { show: 100, hide: 0 },
        placement: "auto",
        container: "#swRightColumn",
        html: true,
        content:
            `<p>Use valid CSS <strong>length</strong> values with a unit. For example:</p>` +
            `<ul><li>Avatar tile width: <code>200px</code></li><li>Avatar tile gap: <code>20px</code></li></ul>`,
    });
    $("#aspStfTicketTierInfo").popover({
        trigger: "hover",
        delay: { show: 100, hide: 0 },
        placement: "auto",
        container: "#swRightColumn",
        html: true,
        title: "Ticket tier info",
        content: () => {
            const cells = [1, 2, 3, 4].map((tier) => {
                return (
                    `<div class="asp-pop-tier-cell">` +
                    `<img class="asp-pop-tier-ticket" src="${TIER_MAP[tier].icon.src}">` +
                    `<div class="asp-pop-tier-rarity">${TIER_MAP[tier].name}</div>` +
                    `<div class="asp-pop-tier-rhythm">` +
                    `<img class="asp-pop-tier-rhythm-icon" src="${CURRENCY_BASE_URL}rhythm.webp">` +
                    `<span class="asp-pop-tier-rhythm-amt">${TIER_MAP[tier].amount}</span>` +
                    `</div></div>`
                );
            }).join("");
            return (
                `<div class="asp-pop-tier-wrap">${cells}</div>` +
                `<p class="asp-pop-tier-note">` +
                `Ticket tiers are used for skins that cost <strong>rhythm</strong> instead of notes. ` +
                `An avatar's outfit and skin can be in separate tiers. ` +
                `The filter keeps the tile visible if at least one of those tiers is still selected. ` +
                `Skins that are only note-priced (standard type) do not use these tiers.</p>`
            );
        },
    });

    // Setup utility buttons
    $("#aspRandomizeOptionsToggle").on("click", () => {
        $("#aspRandomizeOptionsPanel").slideToggle(100, () => {
            const open = $("#aspRandomizeOptionsPanel").is(":visible");
            $("#aspRandomizeOptionsCaret").removeClass("fa-caret-down fa-caret-up").addClass(open ? "fa-caret-up" : "fa-caret-down");
        });
    });
    $("#aspRandomizeButton").on("click", () => randomizeSelectedParts());
    $("#aspGoToAvatarBtn").on("click", () => {
        const ad = storeWindow.avatarColumn.currentAvatar;
        if (!ad) return;
        const av = storeWindow.getAvatarFromAvatarId(ad.avatarId);
        if (av) openOutfitInStore(av.parentCharacter, av);
    });
    $("#aspGoToBackgroundBtn").on("click", () => {
        const bg = storeWindow.avatarColumn.currentBackground;
        if (!bg) return;
        // Unique backgrounds aren't owned by a character; toggle background-select mode where they live.
        if (bg.backgroundUniqueId) {
            if (!storeWindow.inBackgroundMode) storeWindow.toggleBackgroundSelect();
            return;
        }
        const av = storeWindow.getAvatarFromAvatarId(bg.avatarId);
        if (av) openOutfitInStore(av.parentCharacter, av);
    });
    $("#aspBuyAllBtn").on("click", () => {
        bulkBuy(storeWindow.mainContainer.currentContent);
    });

    // Setup avatar search filter
    $searchInput.on("input", applyAvatarSearchFilter);
    $("#aspSearchPrevBtn").on("click", () => navigateOutfitPage(-1));
    $("#aspSearchNextBtn").on("click", () => navigateOutfitPage(1));
    $searchInput.on("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            navigateOutfitPage(e.shiftKey ? -1 : 1);
        }
    });
    storeWindow.mainContainer.addContentChangeListener(() => {
        setTimeout(() => {
            applyAvatarSearchFilter();
            refreshWishlistTileButtons();
        }, 0);
    });
    updateSearchPanel();

    // Setup wishlist
    buildAspStoreColorCatalogRankMap();
    syncWishlistSortUi();
    renderWishlist();
    $("#aspWishlistSortMode").on("change", function () {
        wishlistSort = { ...wishlistSort, mode: this.value };
        if (!["catalog", "alpha", "tier"].includes(wishlistSort.mode)) wishlistSort.mode = "catalog";
        saveSettings();
        renderWishlist();
    });
    $("#aspWishlistSortDir").on("click", () => {
        wishlistSort = { ...wishlistSort, ascending: !wishlistSort.ascending };
        saveSettings();
        syncWishlistSortUi();
        renderWishlist();
    });
    $("#swContentAvatarContainer").on("click", ".asp-tile-wishlist-btn", function (e) {
        const $tile = $(this).closest(".swAvatarTile");
        if (!isWishlistableAvatarSkinTile($tile)) return;
        const m = resolveStoreModelFromAvatarTile($tile);
        const entry = { avatarId: m.avatar.avatarId, colorId: m.colorId };
        const i = wishlistIndexOf(entry.avatarId, entry.colorId);
        if (i >= 0) {
            wishlist.splice(i, 1);
            removeWishlistRowInDom(entry.avatarId, entry.colorId);
        } else {
            wishlist.push(entry);
            insertWishlistRowAtSortedPosition(entry.avatarId, entry.colorId);
        }
        saveSettings();
        refreshWishlistTileButtons();
    });
    $("#aspWishlistList").on("click", ".asp-wishlist-row-head", function () {
        const $row = $(this).closest(".asp-wishlist-row");
        const avatarId = Number($row.data("avatar-id"));
        const colorId = Number($row.data("color-id"));
        openWishlistSkinInStore(avatarId, colorId);
    });
    $("#aspWishlistList").on("click", ".asp-wishlist-buy", function (e) {
        const $row = $(this).closest(".asp-wishlist-row");
        const avatarId = Number($row.data("avatar-id"));
        const colorId = Number($row.data("color-id"));
        buyWishlistSkin(avatarId, colorId);
    });
    $("#aspWishlistList").on("click", ".asp-wishlist-remove", function (e) {
        const $row = $(this).closest(".asp-wishlist-row");
        const avatarId = Number($row.data("avatar-id"));
        const colorId = Number($row.data("color-id"));
        const index = wishlistIndexOf(avatarId, colorId);
        if (index >= 0) {
            wishlist.splice(index, 1);
            saveSettings();
            removeWishlistRowInDom(avatarId, colorId);
            refreshWishlistTileButtons();
        }
    });

    // Setup settings
    $("#aspAvatarTileWidth").val(avatarTileWidth ?? "").on("change", function () {
        avatarTileWidth = this.value;
        saveSettings();
        applyStyles();
    });
    $("#aspAvatarTileGap").val(avatarTileGap ?? "").on("change", function () {
        avatarTileGap = this.value;
        saveSettings();
        applyStyles();
    });
    $("#aspAvatarInfoLogging")
        .prop("checked", avatarInfoLogging)
        .on("change", function () {
            avatarInfoLogging = this.checked;
            saveSettings();
        });
    $("#aspDisableBulkBuy")
        .prop("checked", disableBulkBuy)
        .on("change", function () {
            disableBulkBuy = this.checked;
            saveSettings();
        });
    $("#aspApplyStylesButton").on("click", () => {
        applyStyles();
    });
    $("#aspLegacyFiltersToggle")
        .prop("checked", legacyAvatarStoreFilters)
        .on("change", function () {
            legacyAvatarStoreFilters = this.checked;
            saveSettings();
            applyAspStoreTopPanelsMode();
        });
    $("#aspSettingsExport").on("click", () => {
        exportAvatarStorePlusData();
    });
    $("#aspSettingsImport").on("click", () => {
        $("#aspSettingsImportFile").click();
    });
    $("#aspSettingsImportFile").on("change", async function () {
        const file = this.files?.[0];
        this.value = "";
        if (!file) return;
        try {
            const json = JSON.parse(await file.text());
            const r = applyAvatarStorePlusImportData(json);
            if (!r.ok) throw new Error(r.message);
            Swal.fire({ title: "Import complete", text: "Settings and wishlist were updated from the file.", icon: "success" });
        }
        catch (e) {
            Swal.fire({ title: "Import failed", text: e.message || "Could not import the file.", icon: "error" });
        }
    });

    // Setup click on store tiles to log info when enabled
    $("#swContentAvatarContainer").on("click", ".swAvatarTile", function () {
        if (!avatarInfoLogging) return;
        const model = resolveStoreModelFromAvatarTile($(this));
        if (!model) return;
        const avatarName = model.avatar?.avatarName;
        const outfitName = model.avatar?.outfitName;
        const colorName = model.name;
        const typeName = model.typeName;
        const characterId = model.avatar?.parentCharacter?.characterId;
        const avatarId = model.avatar?.avatarId;
        const outfitId = model.avatar?.outfitId;
        const colorId = model.colorId;
        const backgroundId = model.backgroundId;
        const title = `${avatarName} · ${outfitName} · ${colorName} · ${typeName}`;
        const ids = `characterId: ${characterId}, avatarId: ${avatarId}, outfitId: ${outfitId}, colorId: ${colorId}, backgroundId: ${backgroundId}`;
        console.log(title + "\n" + ids + "\n", model);
    });

    // Setup event listeners
    new Listener("unlock avatar", () => {
        syncWishlistBuyButtonsOwnedState();
        updateSearchPanel();
        legacyAvatarStoreFilters ? storeWindow.filterChangeEvent() : applyAspStoreTopFilters();
    }).bindListener();
    new Listener("emote unlocked", () => updateSearchPanel()).bindListener();
    new Listener("emote locked", () => updateSearchPanel()).bindListener();
    new Listener("background unlocked", () => updateSearchPanel()).bindListener();
    new Listener("background locked", () => updateSearchPanel()).bindListener();
    new Listener("decoration unlocked", () => updateSearchPanel()).bindListener();
    new Listener("decoration locked", () => updateSearchPanel()).bindListener();

    // Show event-locked colors in the color grid (client filters them out of displayContent)
    StoreAvatar.prototype.displayColors = function () {
        this.mainContainer.displayContent(this.colors);
        if (!this.colorsLoaded) {
            this.colors.forEach((color) => color.tile.imagePreload.lazyLoadEvent());
            this.colorsLoaded = true;
        }
        this.iconSelected = true;
        this.parentCharacter.active = false;
    };

    createHotkeyTable([
        { action: "prevPage", title: "Prev Page" },
        { action: "nextPage", title: "Next Page" },
    ]);

    const hotkeyActions = {
        prevPage: () => {
            navigateOutfitPage(-1);
        },
        nextPage: () => {
            navigateOutfitPage(1);
        },
    };

    document.addEventListener("keydown", (event) => {
        const key = event.key.toUpperCase();
        const ctrl = event.ctrlKey;
        const alt = event.altKey;
        const shift = event.shiftKey;
        const match = (b) => {
            if (!b.key) return false;
            if (key !== b.key) return false;
            if (ctrl !== b.ctrl) return false;
            if (alt !== b.alt) return false;
            if (shift !== b.shift) return false;
            return true;
        }
        for (const [action, bind] of Object.entries(hotKeys)) {
            if (match(bind)) {
                event.preventDefault();
                hotkeyActions[action]();
            }
        }
    });

    applyStyles();
    AMQ_addScriptData({
        name: "Avatar Store Plus",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqAvatarStorePlus.user.js",
        description: `
            <p>More features for the avatar store</p>
        `
    });
}

// Switches between the original game's filter header and the Avatar Store Plus custom header
function applyAspStoreTopPanelsMode() {
    if (legacyAvatarStoreFilters) {
        $legacyFilters.show();
        $modernFilters.hide();
        storeWindow.filterChangeEvent();
    }
    else {
        $legacyFilters.hide();
        $modernFilters.show();
        applyAspStoreTopFilters();
    }
}

// Reads the current filter UI state from the ASP top-level filters
function readAspStoreTopFilterState() {
    const axisValue = (axis) =>
        $modernFilters.find(`.asp-stf-row[data-asp-stf-axis="${axis}"] .asp-stf-seg.active`).attr("data-asp-stf-value") || "all";
    const tiers = new Set();
    $modernFilters.find('.asp-stf-row[data-asp-stf-axis="ticketTier"] .asp-stf-tier.active').each(function () {
        const t = Number($(this).attr("data-asp-tier"));
        if (t >= 1 && t <= 4) tiers.add(t);
    });
    return {
        ownership: axisValue("ownership"),
        release: axisValue("release"),
        rotation: axisValue("rotation"),
        type: axisValue("type"),
        ticketTiers: tiers,
    };
}

/**
 * Returns whether this store color matches the current ASP top-level filters.
 * @param {object} c - StoreColor to test
 * @param {object} s - Filter state object as returned by readAspStoreTopFilterState
 */
function storeColorMatchesAspTopFilters(c, s) {
    const a = c.avatar;
    if (!a) return false;
    if (s.ownership === "unlocked" && !c.unlocked) return false;
    if (s.ownership === "locked" && c.unlocked) return false;
    if (s.release === "available" && (!c.active || !a.active)) return false;
    if (s.release === "unavailable" && c.active && a.active) return false;
    if (s.rotation === "limited" && !c.limited && !a.limited) return false;
    if (s.rotation === "permanent" && (c.limited || a.limited)) return false;
    if (s.type === "exclusive" && !c.exclusive && !a.exclusive) return false;
    if (s.type === "standard" && (c.exclusive || a.exclusive)) return false;
    const ticketTiersOnSkin = [Number(c?.ticketTier), Number(a?.ticketTier)].filter((t) => t >= 1 && t <= 4);
    if (s.ticketTiers.size === 0) {
        if (ticketTiersOnSkin.length) return false;
    }
    else if (s.ticketTiers.size < 4) {
        if (ticketTiersOnSkin.length && !ticketTiersOnSkin.some((t) => s.ticketTiers.has(t))) {
            return false;
        }
    }
    return true;
}

/**
 * Refreshes the #aspColorNames strip from `storeWindow.avatarColumn`. Avatar color comes straight
 * off `currentAvatar.colorName` (StoreColor.fullDescription includes it). Background color is more
 * involved: normal `backgroundDescription` from StoreColor carries `avatarId/colorId` but no name,
 * so we resolve through the catalog. Unique backgrounds have their own `name`.
 */
function updateAspColorNames() {
    const ac = storeWindow.avatarColumn;
    const a = ac.currentAvatar;
    const b = ac.currentBackground;

    const avatarText = a?.colorName ? capitalizeMajorWords(a.colorName) : "—";

    let bgText = "—";
    if (b) {
        if (b.backgroundUniqueId != null) {
            bgText = b.name ?? b.backgroundName ?? "—";
        } else if (b.avatarId != null && b.colorId != null) {
            const av = storeWindow.getAvatarFromAvatarId(b.avatarId);
            const c = av?.colorMap[b.colorId];
            if (c?.name) {
                bgText = capitalizeMajorWords(c.name);
                // When the background's source outfit differs from the worn avatar, surface it in
                // parentheses (e.g. "Red (Winter Hibiki)"). Standard outfits collapse to just the avatar.
                if (av && a && a.avatarId !== b.avatarId) {
                    const source = av.outfitName === "Standard" ? av.avatarName : `${av.outfitName} ${av.avatarName}`;
                    bgText += ` (${source})`;
                }
            }
        }
    }

    $('#aspColorNames [data-asp-target="avatar"]').text(avatarText);
    $('#aspColorNames [data-asp-target="background"]').text(bgText);
}

// Sets StoreColor/StoreAvatar/StoreCharacter inFilter (drives client storeFade on tiles/top icons)
function applyAspStoreTopFilters() {
    if (legacyAvatarStoreFilters) return;
    const state = readAspStoreTopFilterState();
    let matchCount = 0;
    for (const character of storeWindow.topBar.characters) {
        let anyAvatarIn = false;
        for (const avatar of character.avatars) {
            let anyColorGateChanged = false;
            let anyColorIn = false;
            for (const color of avatar.colors) {
                const next = storeColorMatchesAspTopFilters(color, state);
                if (next) {
                    matchCount++;
                    anyColorIn = true;
                }
                if (next !== color.inFilter) {
                    color.inFilter = next;
                    anyColorGateChanged = true;
                }
            }
            if (anyColorGateChanged) avatar.sortColors();
            if (anyColorIn !== avatar.inFilter) avatar.inFilter = anyColorIn;
            if (anyColorIn) anyAvatarIn = true;
        }
        // StoreCharacter.inFilter has no getter
        character.inFilter = anyAvatarIn;
    }
    $("#aspStfFilterCount").text(matchCount).attr("title", `${matchCount} skins match the current filters`);
}

// Trims and lowercases user text for search and filter matching
function normalizeSearchQuery(raw) {
    return String(raw ?? "").trim().toLowerCase();
}

// Same text+class haystack as used for filtering tiles (keeps view vs filter in sync)
function tileSearchHaystack($tile) {
    return `${$tile.text()} ${$tile.attr("class") ?? ""}`
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// Data-only match for counting the full catalog (mirrors tile classes + names; no DOM)
function storeColorSearchHaystack(c) {
    const a = c.avatar;
    const parts = [
        c.name,
        a.avatarName,
        a.outfitName,
        a.optionName,
        c.typeName,
        a.world,
        a.artist,
        a.badgeName,
        c.sizeModifierClass,
    ];
    return parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// Counts StoreColor entries in the full catalog whose haystack contains the query
function countAllStoreSearchMatches(query) {
    let count = 0;
    for (const character of storeWindow.topBar.characters) {
        for (const avatar of character.avatars) {
            if (!query) {
                count += avatar.colors.length;
                continue;
            }
            for (const color of avatar.colors) {
                if (storeColorSearchHaystack(color).includes(query)) {
                    count++;
                }
            }
        }
    }
    return count;
}

/**
 * Ordered list of { character, avatar } outfit pages.
 * With a query, only outfits whose colors match are included; without a query, every outfit is a page.
 * Prev/next steps between outfits (sub-pages), not only between characters.
 */
function getOutfitPages(query) {
    query = normalizeSearchQuery(query);
    const pages = [];
    for (const character of storeWindow.topBar.characters) {
        for (const avatar of character.avatars) {
            if (!query) {
                pages.push({ character, avatar });
                continue;
            }
            for (const color of avatar.colors) {
                if (storeColorSearchHaystack(color).includes(query)) {
                    pages.push({ character, avatar });
                    break;
                }
            }
        }
    }
    return pages;
}

// Opens the character and drills into this outfit’s color grid (not the main outfit preview page)
function openOutfitInStore(character, storeAvatar, scroll) {
    storeWindow.topBar.handleCategorySelected(character.topIcon, true);
    character.topIcon.open = true;
    character.intPreviewTiles();
    storeAvatar.displayColors();
    storeWindow.topBar.updateLayout();
    if (scroll) {
        const el = storeAvatar.$topIcon[0];
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    kickStoreLazyLoadsAfterLayout();
}

/**
 * Store skin tiles lazy-load images when Perfect Scrollbar scroll events fire (`ps-scroll-y`) or via a
 * manual `lazyLoadEvent`. After swapping grid content `handleRemoved` cancels handlers, but if the outfit
 * was opened before (`colorsLoaded`) the client does not always call `lazyLoadEvent()` again — tiles stay
 * on the spinner until a real wheel scroll fires. Refresh layout and re-trigger loads for visible colors.
 */
function kickStoreLazyLoadsAfterLayout() {
    const mc = storeWindow.mainContainer;
    if (!mc.currentContent.length) return;
    const run = () => {
        mc.updateScroll();
        for (const entry of mc.currentContent) {
            entry.tile?.imagePreload?.lazyLoadEvent?.();
        }
        mc.$mainContainer.trigger("ps-scroll-y");
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
}

// Prev/next: opens another outfit’s color grid (filtered by search if active) and reapplies the search filter
function navigateOutfitPage(delta) {
    const pages = getOutfitPages($searchInput.val());
    if (!pages.length) return;
    const index = pages.findIndex((p) => p.avatar.$topIcon?.hasClass?.("selected"));
    if (index < 0) {
        const p = delta > 0 ? pages[0] : pages[pages.length - 1];
        openOutfitInStore(p.character, p.avatar);
    } else {
        const nextIdx = (index + delta + pages.length) % pages.length;
        const { character, avatar } = pages[nextIdx];
        openOutfitInStore(character, avatar);
    }
    setTimeout(() => {
        applyAvatarSearchFilter();
        kickStoreLazyLoadsAfterLayout();
    }, 0);
}

// `StoreColor` (skin color swatch) in model form — not preview/outfit, not background mode
function isAvatarSkinColorRow(model) {
    if (!model || model.colorId == null || !model.avatar) return false;
    if (storeWindow.inBackgroundMode) return false;
    return true;
}

// Heart control only on `StoreAvatarTile` color swatches (excludes `previewTile`, `emoteLayout`, backgrounds, decorations)
function isWishlistableAvatarSkinTile($tile) {
    if (!$tile?.length) return false;
    if (storeWindow.inBackgroundMode) return false;
    if ($tile.hasClass("emoteLayout") || $tile.hasClass("previewTile")) return false;
    if (!$tile.hasClass("avatarTile")) return false;
    return isAvatarSkinColorRow(resolveStoreModelFromAvatarTile($tile));
}

/**
 * Injects/updates one heart per color swatch; keeps wishlisted in sync.
 * Wishlist-row buy-button state is not touched here; it only changes on unlock,
 * which is handled by the "unlock avatar" listener.
 */
function refreshWishlistTileButtons() {
    $("#swContentAvatarContainer .swAvatarTile").each(function () {
        const $tile = $(this);
        if (!isWishlistableAvatarSkinTile($tile)) {
            $tile.find(".asp-tile-wishlist-btn").remove();
            return;
        }
        let $btn = $tile.find(".asp-tile-wishlist-btn");
        if (!$btn.length) {
            $btn = $(/*html*/`
                <div class="asp-tile-wishlist-btn clickAble" title="Add to wishlist">
                    <i class="fa fa-heart" aria-hidden="true"></i>
                </div>
            `);
            $tile.append($btn);
        }
        const model = resolveStoreModelFromAvatarTile($tile);
        const on = wishlistIndexOf(model.avatar.avatarId, model.colorId) >= 0;
        $btn
            .toggleClass("wishlisted", on)
            .attr("title", on ? "Remove from wishlist" : "Add to wishlist");
    });
}

// Returns the StoreColor object for an avatar+colorId from the live store catalog, or null if missing
function findStoreColorInCatalog(avatarId, colorId) {
    avatarId = Number(avatarId);
    colorId = Number(colorId);
    if (isNaN(avatarId) || isNaN(colorId)) return null;
    const avatar = storeWindow.getAvatarFromAvatarId(avatarId);
    return avatar?.colorMap[colorId] ?? null;
}

// Returns a string explaining why a skin can't be bought, or empty string if purchasable
function wishlistBuyBlockReason(color) {
    if (!color?.avatar) return "Skin not in catalog";
    if (color.unlocked) return "Already owned";
    if (!color.active || !color.avatar.active) return "Unavailable in store";
    return "";
}

/**
 * Disables each row’s buy control when the catalog `StoreColor` is unlocked; re-enables if not.
 * Call after wishlist row DOM changes and when the store may have updated lock state.
 */
function syncWishlistBuyButtonsOwnedState() {
    $("#aspWishlistList .asp-wishlist-row").each(function () {
        const $row = $(this);
        const avatarId = Number($row.data("avatar-id"));
        const colorId = Number($row.data("color-id"));
        const color = findStoreColorInCatalog(avatarId, colorId);
        const reason = wishlistBuyBlockReason(color);
        const $buy = $row.find(".asp-wishlist-buy");
        $buy.prop("disabled", Boolean(reason));
        $buy.attr("title", reason || "Buy this skin");
    });
}

// Array index in `wishlist` for a skin, or -1 if not saved
function wishlistIndexOf(avatarId, colorId) {
    return wishlist.findIndex((e) => e.avatarId === avatarId && e.colorId === colorId);
}

// Programmatically opens that outfit’s color list in the game store (no tab or scroll change from script)
function openWishlistSkinInStore(avatarId, colorId) {
    const storeColor = findStoreColorInCatalog(avatarId, colorId);
    const avatar = storeColor.avatar;
    const parent = avatar.parentCharacter;
    openOutfitInStore(parent, avatar);
}

// v1 static head: `…/v1/avatars/{avatar}/{outfit}/{option}/{color}/100px/Head.webp` (matches CDN layout)
function avatarHeadUrl(a, colorName) {
    if (!a) return "";
    const segs = [a.avatarName, a.outfitName, a.optionName, colorName ?? a.defaultColorName, "100px", "Head.webp"];
    return `https://cdn.animemusicquiz.com/v1/avatars/${segs.map(encodeURIComponent).join("/")}`;
}

/**
 * Build `priceItems` like `storeAvatarColumn` unlock (avatar + this color only), for `storePriceModal.showAvatar`.
 * @returns {{ priceItems: object[], avatarId: number, colorId: number } | null}
 */
function buildAvatarUnlockPriceItemsFromStoreColor(c) {
    const a = c.avatar;
    const ch = a.parentCharacter;
    if (!ch) return null;
    const av = storeWindow.getAvatar(ch.characterId, a.avatarId);
    if (!av) return null;
    const priceItems = [];
    let avatarId;
    let colorId;

    if (!av.unlocked) {
        priceItems.push({
            name: av.outfitName + " " + av.avatarName,
            hidePrice: true,
            bold: true,
        });

        if (av.ticketTier || !c.ticketTier) {
            priceItems.push({
                name: localizationHandler.translate("avatar_window.unlock_checkout.skin_entry", { name: capitalizeMajorWords(av.defaultColorName) }),
                notePrice: av.notePrice,
                realMoneyPrice: av.realMoneyPrice,
                patreonTierToUnlock: av.patreonTierToUnlock,
                rhythmPrice: TICKET_TIER_RHYTHM_PRICES[av.ticketTier],
            });
        }
        if (!c.defaultColor) {
            priceItems.push({
                name: localizationHandler.translate("avatar_window.unlock_checkout.version_entry", { name: capitalizeMajorWords(c.name) }),
                notePrice: c.colorPrice,
                rhythmPrice: TICKET_TIER_RHYTHM_PRICES[c.ticketTier],
            });
        }
        avatarId = a.avatarId;
        colorId = c.colorId;
    }
    else if (!av.getColorUnlocked(c.colorId)) {
        priceItems.push({
            name: av.outfitName + " " + av.avatarName,
            hidePrice: true,
            bold: true,
        });
        priceItems.push({
            name: localizationHandler.translate("avatar_window.unlock_checkout.version_entry", { name: capitalizeMajorWords(c.name) }),
            notePrice: c.colorPrice,
            rhythmPrice: TICKET_TIER_RHYTHM_PRICES[c.ticketTier],
        });
        avatarId = a.avatarId;
        colorId = c.colorId;
    }
    else {
        return null;
    }

    if (!priceItems.length) return null;
    return { priceItems, avatarId, colorId };
}

// Shows the default AMQ price modal for a wishlist row’s unlock (or errors if not purchasable).
function buyWishlistSkin(avatarId, colorId) {
    const c = findStoreColorInCatalog(avatarId, colorId);
    const reason = wishlistBuyBlockReason(c);
    if (reason) {
        Swal.fire({ title: reason, icon: "info" });
        return;
    }
    const built = buildAvatarUnlockPriceItemsFromStoreColor(c);
    storePriceModal.showAvatar(built.priceItems, built.avatarId, built.colorId);
}

const WISHLIST_EMPTY_HTML = '<p class="asp-wishlist-empty">No skins saved yet. Click the heart on an avatar tile to save.</p>';

/**
 * Given a StoreColor, returns the label strings for the wishlist row: outfit + avatar name, and color name.
 * @param {StoreColor} c
 */
function wishlistSkinStringsFromColor(c) {
    const avatarName = c?.avatar?.avatarName;
    const outfitName = c?.avatar?.outfitName;
    const nameText = outfitName === "Standard" ? avatarName : `${outfitName} ${avatarName}`;
    const colorText = capitalizeMajorWords(c?.name ?? "");
    return { nameText, colorText };
}

/**
 * Returns the HTML string for a wishlist row
 * @param {number} avatarId
 * @param {number} colorId
 * @returns {string}
 */
function wishlistRowHtmlFromIds(avatarId, colorId) {
    const c = findStoreColorInCatalog(avatarId, colorId);
    const { nameText, colorText } = wishlistSkinStringsFromColor(c);
    const k = `${avatarId}:${colorId}`; // unique key for the wishlist row
    const reason = wishlistBuyBlockReason(c);
    const buyTitle = reason || "Buy this skin";
    const buyDisabled = reason ? " disabled" : "";
    // Head is mounted post-insertion by attachWishlistRowHead() so animated skins can use AvatarHeadDisplayHandler.
    return /*html*/`
        <div class="asp-wishlist-row" data-wishlist-key="${k}" data-avatar-id="${avatarId}" data-color-id="${colorId}">
            <div class="asp-wishlist-row-head"></div>
            <div class="asp-wishlist-row-text">
                <span class="asp-wishlist-name" title="Outfit + avatar">${escapeHtml(nameText)}</span>
                <span class="asp-wishlist-color-wrap" title="Color">
                    ${wishlistTierIconHtml(c)}<span class="asp-wishlist-color">${escapeHtml(colorText)}</span>
                </span>
            </div>
            <div class="asp-wishlist-row-actions" role="group">
                <button type="button" class="btn btn-default asp-wishlist-action-btn asp-wishlist-buy"${buyDisabled} title="${buyTitle}">
                    <i class="fa fa-shopping-cart" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-default asp-wishlist-action-btn asp-wishlist-remove" title="Remove from wishlist">
                    <i class="fa fa-trash" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;
}

// Locate the row element for a given entry (used by attach/detach helpers)
function findWishlistRow(avatarId, colorId) {
    return $wishlist.find(`.asp-wishlist-row[data-avatar-id="${avatarId}"][data-color-id="${colorId}"]`);
}

// Full "skin + color" label for wishlist sorting (e.g. "Winter Hibiki Red")
function getWishlistAlphaSortKey(entry) {
    const c = findStoreColorInCatalog(entry.avatarId, entry.colorId);
    const { nameText, colorText } = wishlistSkinStringsFromColor(c);
    return `${nameText} ${colorText}`.trim();
}

// Populates aspStoreColorCatalogRankMap with color catalog order for quick lookup
function buildAspStoreColorCatalogRankMap() {
    let i = 0;
    for (const character of storeWindow.topBar.characters) {
        for (const avatar of character.avatars) {
            const id = avatar.avatarId;
            for (const c of avatar.colors) {
                aspStoreColorCatalogRankMap.set(`${id}:${c.colorId}`, i++);
            }
        }
    }
}

// In-catalog rows before missing; rank order respects `ascending`
function wishlistCompareCatalogRank(a, b, ascending) {
    const keyA = `${a.avatarId}:${a.colorId}`;
    const keyB = `${b.avatarId}:${b.colorId}`;
    const aIn = aspStoreColorCatalogRankMap.has(keyA);
    const bIn = aspStoreColorCatalogRankMap.has(keyB);
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (!aIn) return 0;
    const ra = aspStoreColorCatalogRankMap.get(keyA);
    const rb = aspStoreColorCatalogRankMap.get(keyB);
    if (ra !== rb) return ascending ? ra - rb : rb - ra;
    return 0;
}

// Compare two wishlist entries for sorting
function compareWishlistEntries(a, b) {
    const { mode, ascending } = wishlistSort;
    const dir = ascending ? 1 : -1;
    if (mode === "alpha") {
        const alphaCmp = getWishlistAlphaSortKey(a).localeCompare(getWishlistAlphaSortKey(b), undefined, { sensitivity: "base" });
        if (alphaCmp !== 0) return alphaCmp * dir;
        if (a.avatarId !== b.avatarId) return (a.avatarId - b.avatarId) * dir;
        return (a.colorId - b.colorId) * dir;
    }
    if (mode === "tier") {
        const ca = findStoreColorInCatalog(a.avatarId, a.colorId);
        const cb = findStoreColorInCatalog(b.avatarId, b.colorId);
        const ta = storeColorTierBucket(ca);
        const tb = storeColorTierBucket(cb);
        if (ta !== tb) return (ta - tb) * dir;
        return wishlistCompareCatalogRank(a, b, ascending);
    }
    const rankCmp = wishlistCompareCatalogRank(a, b, ascending);
    if (rankCmp !== 0) return rankCmp;
    const alphaCmp = getWishlistAlphaSortKey(a).localeCompare(getWishlistAlphaSortKey(b), undefined, { sensitivity: "base" });
    if (alphaCmp !== 0) return alphaCmp;
    if (a.avatarId !== b.avatarId) return a.avatarId - b.avatarId;
    return a.colorId - b.colorId;
}

// Syncs the wishlist sort UI with the current sort settings
function syncWishlistSortUi() {
    $("#aspWishlistSortMode").val(wishlistSort.mode);
    const $btn = $("#aspWishlistSortDir");
    const asc = wishlistSort.ascending;
    $btn.attr("title", asc ? "Ascending (click for descending)" : "Descending (click for ascending)");
    $btn.find("i").toggleClass("fa-sort-amount-asc", asc).toggleClass("fa-sort-amount-desc", !asc);
}

/**
 * Fill a row's head mount: spine canvas for animated skins (when WebGL is available) or a static
 * head image otherwise. The static path mirrors the client's quiz/nexus pattern
 * (`animated ? animatedHeadColorName : name`) rather than calling `StoreColor.getAvatarHeadSrc`,
 * which unconditionally prefers `animatedHeadColorName` and therefore returns the default-color
 * head URL for any static color that has the field populated.
 * Spines pause when the wishlist tab isn't currently selected (resumed by switchTab).
 */
function attachWishlistRowHead($row, c) {
    const $head = $row.find(".asp-wishlist-row-head");
    if (!c?.avatar) {
        $head.addClass("asp-wishlist-row-head--empty").attr("title", "Skin not in catalog").html('<i class="fa fa-user"></i>');
        return;
    }
    $head.removeClass("asp-wishlist-row-head--empty").attr("title", "Open this skin in the store").addClass("clickAble");
    const a = c.avatar;
    const handler = new AvatarHeadDisplayHandler($head);
    if (c.animated && webGlEnabled()) {
        const jsonSrc = cdnFormater.newAnimatedAvatarJsonSrc(a.avatarName, a.outfitName);
        const atlasSrc = cdnFormater.newAnimatedAvatarAtlasSrc(a.avatarName, a.outfitName);
        handler.displayAvatarAnimated(jsonSrc, atlasSrc, true, null, null, true);
    } else {
        const colorName = c.animated ? c.animatedHeadColorName : c.name;
        const src = cdnFormater.newAvatarHeadSrc(a.avatarName, a.outfitName, a.optionName, true, colorName);
        const srcSet = cdnFormater.newAvatarHeadSrcSet(a.avatarName, a.outfitName, a.optionName, true, colorName);
        handler.displayAvatarImage(src, srcSet, { triggerLoad: true, defaultSizes: "40px" });
    }
    $row.data("aspHeadHandler", handler);
    if (!$("#aspWishlistTab").hasClass("selected")) {
        handler.handleDetatched();
    }
}

// Tear down a row's head handler (destroys the spine animator if any). Safe to call on rows that never had one.
function detachWishlistRowHead($row) {
    const handler = $row.data("aspHeadHandler");
    if (!handler) return;
    handler.handleRemoved();
    $row.removeData("aspHeadHandler");
}

// Removes one wishlist row from the DOM, or restores the empty placeholder when the last row is removed.
function removeWishlistRowInDom(avatarId, colorId) {
    const $row = findWishlistRow(avatarId, colorId);
    detachWishlistRowHead($row);
    $row.remove();
    if ($wishlist.find(".asp-wishlist-row").length === 0) {
        $wishlist.html(WISHLIST_EMPTY_HTML);
    }
}

// Inserts one row in DOM order matching the current sort
function insertWishlistRowAtSortedPosition(avatarId, colorId) {
    const html = wishlistRowHtmlFromIds(avatarId, colorId);
    const color = findStoreColorInCatalog(avatarId, colorId);
    if ($wishlist.find(".asp-wishlist-empty").length) {
        $wishlist.html(html);
        attachWishlistRowHead(findWishlistRow(avatarId, colorId), color);
        return;
    }
    const sorted = wishlist.slice().sort(compareWishlistEntries);
    const idx = sorted.findIndex((e) => e.avatarId === avatarId && e.colorId === colorId);
    const next = sorted[idx + 1];
    const $newRow = $(html);
    if (!next) {
        $wishlist.append($newRow);
    } else {
        $newRow.insertBefore(findWishlistRow(next.avatarId, next.colorId));
    }
    attachWishlistRowHead(findWishlistRow(avatarId, colorId), color);
}

// Rebuilds the full wishlist panel from `wishlist` (used on load, sort changes, import; remove uses incremental DOM).
function renderWishlist() {
    $wishlist.find(".asp-wishlist-row").each(function () {
        detachWishlistRowHead($(this));
    });
    if (!wishlist.length) {
        $wishlist.html(WISHLIST_EMPTY_HTML);
        refreshWishlistTileButtons();
        return;
    }
    const sorted = wishlist.slice().sort(compareWishlistEntries);
    $wishlist.html(sorted.map((entry) => wishlistRowHtmlFromIds(entry.avatarId, entry.colorId)).join(""));
    for (const entry of sorted) {
        attachWishlistRowHead(findWishlistRow(entry.avatarId, entry.colorId), findStoreColorInCatalog(entry.avatarId, entry.colorId));
    }
    refreshWishlistTileButtons();
}

// Cost-tier bucket for a color: 0 = Standard (note-priced), 1-4 = Common/Rare/Epic/Legendary, 5 = Unique.
function storeColorTierBucket(c) {
    if (!c) return 0;
    if (c.unique) return 5;
    return Number(c.defaultColor ? c.avatar?.ticketTier : c.ticketTier) || 0;
}

// Small tier glyph for wishlist rows (same assets as context panel)
function wishlistTierIconHtml(c) {
    const tier = storeColorTierBucket(c);
    const icon = TIER_MAP[tier].icon;
    const title = escapeHtml(TIER_MAP[tier].title ?? "");
    if (icon.type === "img") {
        return `<img class="asp-wishlist-tier-icon" src="${escapeHtml(icon.src)}" alt="" title="${title}" decoding="async">`;
    }
    return `<i class="${escapeHtml(icon.classes)} asp-wishlist-tier-icon" aria-hidden="true" title="${title}"></i>`;
}

// Per-tier breakdown rows for an outfit's colors.
// Cost-tier bucket for a color: 0 = Standard (note-priced), 1-4 = Common/Rare/Epic/Legendary, 5 = Unique.
// Default colors use the avatar's ticketTier since the unlock cost is the avatar's; other colors use their own.
function tierBreakdownRows(avatar) {
    const owned = [0, 0, 0, 0, 0, 0];
    const total = [0, 0, 0, 0, 0, 0];
    for (const color of avatar.colors) {
        const t = storeColorTierBucket(color);
        total[t]++;
        if (color.unlocked) owned[t]++;
    }
    return Object.entries(TIER_MAP).map(([t, tier]) => ({
        icon: tier.icon,
        label: tier.name,
        owned: owned[t],
        total: total[t],
        title: tier.title,
    }));
}

// Per-outfit breakdown rows for a character preview page. Each row uses the outfit's default-color head as its icon.
function outfitBreakdownRows(character) {
    return character.avatars.map((avatar) => {
        const total = avatar.colors.length;
        const owned = avatar.colors.filter((c) => c.unlocked).length;
        const headUrl = avatarHeadUrl(avatar);
        const icon = headUrl
            ? { type: "img", src: headUrl }
            : { type: "fa", classes: "fa fa-question-circle-o" };
        return { icon, label: avatar.outfitName || `Outfit #${avatar.outfitId}`, owned, total };
    });
}

// Per-character (group) breakdown rows for the emotes view. Group name maps to a StoreCharacter's defaultAvatar for a head icon
function emoteBreakdownRows(groups) {
    return groups.map((group) => {
        const total = group.emotes.length;
        const owned = group.emotes.filter((e) => e.unlocked).length;
        const character = storeWindow.topBar.characters.find((c) => c.defaultAvatar?.avatarName === group.name);
        const headUrl = avatarHeadUrl(character?.defaultAvatar);
        const icon = headUrl
            ? { type: "img", src: headUrl }
            : { type: "fa", classes: "fa fa-question-circle-o" };
        return { icon, label: group.name || "(unnamed)", owned, total };
    });
}

// Full-catalog skin counts for #aspContextPanel when not on avatar / emote / background / decoration views
function catalogAllSkinsContext() {
    const all = getAllStoreColors();
    return {
        name: "All Skins",
        owned: all.filter((c) => c.unlocked).length,
        total: all.length,
        breakdown: null,
    };
}

// Builds the right-side context block (name + owned + breakdown) based on current store view.
function readSearchContext() {
    const first = storeWindow.mainContainer.currentContent[0];
    if (!first || storeWindow.topBar.tickets.displayed || storeWindow.topBar.favorites.open) {
        return catalogAllSkinsContext();
    }
    if (storeWindow.topBar.emotes.open) {
        const groups = storeWindow.mainContainer.currentContent;
        const emotes = groups.flatMap((g) => g.emotes);
        return {
            name: "Emotes",
            owned: emotes.filter((e) => e.unlocked).length,
            total: emotes.length,
            breakdown: emoteBreakdownRows(groups),
        };
    }
    if (storeWindow.topBar.backgrounds.open) {
        const backgrounds = storeWindow.topBar.backgrounds.backgrounds;
        return {
            name: "Backgrounds",
            owned: backgrounds.filter((b) => b.unlocked).length,
            total: backgrounds.length,
            breakdown: null
        };
    }
    // Store Decorations page is missing addContentChangeListener, so .open fails
    if (first.constructor.name === "StoreDecorationTypeSelectionButton") {
        const decorations = storeWindow.topBar.decorations.decorations;
        return {
            name: "Decorations",
            owned: decorations.filter((d) => d.unlocked).length,
            total: decorations.length,
            breakdown: null
        };
    }
    if (first.constructor.name === "StoreAvatar") {
        const breakdown = outfitBreakdownRows(first.parentCharacter);
        return {
            name: first.avatarName || `Character #${first.parentCharacter.characterId}`,
            owned: breakdown.reduce((s, r) => s + r.owned, 0),
            total: breakdown.reduce((s, r) => s + r.total, 0),
            breakdown: breakdown,
        };
    }
    if (first.constructor.name === "StoreColor") {
        const breakdown = tierBreakdownRows(first.avatar);
        return {
            name: `${first.avatar.outfitName} ${first.avatar.avatarName}`.trim(),
            owned: breakdown.reduce((s, r) => s + r.owned, 0),
            total: breakdown.reduce((s, r) => s + r.total, 0),
            breakdown: breakdown,
        }
    }
    return catalogAllSkinsContext();
}

// Renders breakdown rows into #aspContextBreakdown. Each row: { icon?: {type:"img",src} | {type:"fa",classes}, label, owned, total, title? }
function renderContextBreakdown(breakdown) {
    const $container = $("#aspContextBreakdown");
    $container.empty();
    if (!breakdown?.length) {
        $container.hide();
        return;
    }
    $container.show();
    for (const row of breakdown) {
        const $row = $('<div class="asp-breakdown-row"></div>');
        if (row.title) $row.attr("title", row.title);
        if (row.icon?.type === "img") {
            $('<img class="asp-breakdown-icon" alt="">').attr("src", row.icon.src).appendTo($row);
        }
        else if (row.icon?.type === "fa") {
            $(`<i class="${row.icon.classes} asp-breakdown-icon" aria-hidden="true"></i>`).appendTo($row);
        }
        else {
            $('<span class="asp-breakdown-icon" aria-hidden="true"></span>').appendTo($row);
        }
        $('<span class="asp-breakdown-label"></span>').text(row.label).appendTo($row);
        $('<span class="asp-breakdown-fraction"></span>').text(`${row.owned}/${row.total}`).appendTo($row);
        $container.append($row);
    }
}

// Refreshes match counts, page indicator, nav button enabled state, and the context (name + owned + breakdown) panel
function updateSearchPanel() {
    const query = normalizeSearchQuery($searchInput.val());
    const pages = getOutfitPages(query);
    const $tiles = $("#swContentAvatarContainer .swAvatarTile");

    // Matches / skins line
    if (query) {
        const visibleMatches = $tiles.not(".asp-search-hidden").length;
        const storeMatches = countAllStoreSearchMatches(query);
        $("#aspSearchMatches").html(`Matches: <b>${visibleMatches}</b> here · <b>${storeMatches}</b> in store`);
    }
    else {
        const catalogTotal = getAllStoreColors().length;
        $("#aspSearchMatches").html(`Skins: <b>${$tiles.length}</b> here · <b>${catalogTotal}</b> in store`);
    }

    // Page line
    const index = pages.findIndex((p) => p.avatar.$topIcon.hasClass("selected"));
    const current = index >= 0 ? index + 1 : "–";
    $("#aspSearchPage").html(`Page <b>${current}</b> / <b>${pages.length || 0}</b>`);

    // Prev/Next enabled state
    $("#aspSearchPrevBtn, #aspSearchNextBtn").prop("disabled", !pages.length);

    // Context: name + owned bar + breakdown
    const ctx = readSearchContext();
    $("#aspContextName").text(ctx.name);
    const pct = ctx.total > 0 ? Math.round((ctx.owned / ctx.total) * 100) : 0;
    $("#aspContextProgressBar").css("width", `${pct}%`);
    $("#aspContextProgressText").text(`${pct}%`);
    $("#aspContextOwnedFraction").text(`${ctx.owned}/${ctx.total}`);
    renderContextBreakdown(ctx.breakdown);
}

// Substring match on tile footer text + class names (avatar / outfit / color from store tiles)
function applyAvatarSearchFilter() {
    const query = normalizeSearchQuery($searchInput.val());
    const $tiles = $("#swContentAvatarContainer .swAvatarTile");
    if (!query) {
        $tiles.removeClass("asp-search-hidden");
        updateSearchPanel();
        return;
    }
    $tiles.each(function () {
        const $tile = $(this);
        const hay = tileSearchHaystack($tile);
        $tile.toggleClass("asp-search-hidden", !hay.includes(query));
    });
    updateSearchPanel();
}

// Flattens every outfit’s `colors` from `storeWindow.getAllAvatars()` into one array
function getAllStoreColors() {
    return storeWindow.getAllAvatars().flatMap((avatar) => avatar.colors);
}

/**
 * Notes + rhythm for one bulk step (recolor-only when outfit already “bought” in sim).
 */
function noteAndRhythmCostForSingleUnlock(av, c, outfitUnlocked) {
    let notes = 0;
    let rhythm = 0;
    if (!outfitUnlocked) {
        if (av.ticketTier || !c.ticketTier) {
            notes += Number(av.notePrice) || 0;
            rhythm += TICKET_TIER_RHYTHM_PRICES[av.ticketTier] || 0;
        }
        if (!c.defaultColor) {
            notes += Number(c.colorPrice) || 0;
            rhythm += TICKET_TIER_RHYTHM_PRICES[c.ticketTier] || 0;
        }
    }
    else {
        notes += Number(c.colorPrice) || 0;
        rhythm += TICKET_TIER_RHYTHM_PRICES[c.ticketTier] || 0;
    }
    return { notes, rhythm };
}

/**
 * Minimum notes + rhythm if you always pick notes when that checkout line has a note price.
 * Lines with 0 notes but a rhythm price require rhythm — both minima apply across the batch.
 */
function minNotesAndRhythmPreferNotesPerUnlock(av, c, outfitUnlocked) {
    let minN = 0;
    let minR = 0;
    const addLine = (notePrice, tierId) => {
        const n = Number(notePrice) || 0;
        const r = TICKET_TIER_RHYTHM_PRICES[tierId] || 0;
        if (n > 0) minN += n;
        else if (r > 0) minR += r;
    };
    if (!outfitUnlocked) {
        if (av.ticketTier || !c.ticketTier) {
            addLine(av.notePrice, av.ticketTier);
        }
        if (!c.defaultColor) {
            addLine(c.colorPrice, c.ticketTier);
        }
    }
    else {
        addLine(c.colorPrice, c.ticketTier);
    }
    return { minN, minR };
}

/**
 * Sends one `unlock avatar` command and resolves after the matching `unlock avatar` socket payload
 * (so bulk buys don’t stack commands before the server / client finish the previous unlock).
 */
function sendUnlockAvatarAndWait(avatarId, colorId, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        let listener;
        const timer = setTimeout(() => {
            if (listener?.bound) listener.unbindListener();
            reject(new Error("Timed out waiting for unlock confirmation"));
        }, timeoutMs);

        listener = new Listener("unlock avatar", (payload) => {
            if (!payload.succ) {
                clearTimeout(timer);
                listener.unbindListener();
                reject(new Error(String(payload.error ?? "Unlock failed")));
                return;
            }
            const unlocked = payload.unlockedAvatars || [];
            const inPayload = unlocked.some((u) => u.avatarId === avatarId && u.colorId === colorId);
            const storeColor = findStoreColorInCatalog(avatarId, colorId);
            if (inPayload || storeColor?.unlocked) {
                clearTimeout(timer);
                listener.unbindListener();
                resolve(payload);
            }
        });
        listener.bindListener();

        socket.sendCommand({
            type: "avatar",
            command: "unlock avatar",
            data: { avatarId, colorId },
        });
    });
}

/**
 * Bulk-unlock every `candidates` row in an order that matches client pricing.
 * `candidates` are StoreColors on one outfit’s grid.
 */
function bulkBuy(candidates) {
    if (!candidates) return;
    candidates = candidates.filter((c) => c.unlocked === false && c.inFilter && c.active && c.avatar?.active);
    if (!candidates.length) {
        const inColorGridView = storeWindow.mainContainer.currentContent[0]?.constructor?.name === "StoreColor";
        Swal.fire({
            title: "Nothing to buy",
            text: inColorGridView
                ? "Everything here is already owned, marked unavailable, or hidden by filters."
                : "You are not viewing an outfit's color list.",
            icon: "info",
        });
        return;
    }
    const avatar = candidates[0].avatar; // StoreAvatar object for the outfit on this page
    if (!avatar) return;
    let ordered;

    if (avatar.unlocked) { // default color is already unlocked
        ordered = [...candidates];
    }
    else { // ensures the default color is bought first
        const defaultColor = candidates.find((c) => c.colorId === avatar.defaultColorId);
        if (!defaultColor) {
            console.error("[Avatar Store Plus] bulkBuy: default color not in candidates", {
                avatarId: avatar.avatarId,
                defaultColorId: avatar.defaultColorId,
                colorIds: candidates.map((c) => c.colorId),
            });
            return;
        }
        const others = candidates.filter((c) => c.colorId !== avatar.defaultColorId);
        ordered = [defaultColor, ...others];
    }

    let outfitUnlocked = avatar.unlocked;
    let noteTotal = 0;
    let rhythmTotal = 0;
    let minNotesNeed = 0;
    let minRhythmNeed = 0;
    for (const c of ordered) {
        const { notes, rhythm } = noteAndRhythmCostForSingleUnlock(avatar, c, outfitUnlocked);
        noteTotal += notes;
        rhythmTotal += rhythm;
        const { minN, minR } = minNotesAndRhythmPreferNotesPerUnlock(avatar, c, outfitUnlocked);
        minNotesNeed += minN;
        minRhythmNeed += minR;
        if (!outfitUnlocked) outfitUnlocked = true;
    }

    const notesBal = xpBar.currentCreditCount || 0;
    const rhythmBal = storeWindow.rhythm || 0;
    const shortNotes = minNotesNeed > 0 && notesBal < minNotesNeed;
    const shortRhythm = minRhythmNeed > 0 && rhythmBal < minRhythmNeed;
    if (shortNotes || shortRhythm) {
        const need = [];
        if (shortNotes) {
            need.push(
                `<p>You need at least <b>${minNotesNeed.toLocaleString()}</b> notes for this purchase<br>(you have <b>${notesBal.toLocaleString()}</b>).</p>`
            );
        }
        if (shortRhythm) {
            need.push(
                `<p>You need at least <b>${minRhythmNeed.toLocaleString()}</b> rhythm for this purchase<br>(you have <b>${rhythmBal.toLocaleString()}</b>).</p>`
            );
        }
        Swal.fire({
            title: "Not enough notes or rhythm",
            html: `<p>Unlocks: <b>${candidates.length} skins</b></p>` + need.join(""),
            icon: "error",
        });
        return;
    }

    const costLines = [];
    if (noteTotal > 0) costLines.push(`Total notes: <b>${noteTotal.toLocaleString()}</b>`);
    if (rhythmTotal > 0) costLines.push(`Total rhythm: <b>${rhythmTotal.toLocaleString()}</b>`);
    if (!costLines.length) costLines.push(`Total: <b>0</b> notes / rhythm`);

    const balLines = [];
    if (noteTotal > 0) balLines.push(`Your notes: <b>${notesBal.toLocaleString()}</b>`);
    if (rhythmTotal > 0) balLines.push(`Your rhythm: <b>${rhythmBal.toLocaleString()}</b>`);

    const summaryHtml =
        `<p>Unlocks: <b>${candidates.length} skins</b></p>` +
        costLines.map((line) => `<p>${line}</p>`).join("") +
        balLines.map((line) => `<p>${line}</p>`).join("") +
        (disableBulkBuy ? `<p class="asp-sw-warn"><b>Bulk buy disabled (dry run):</b> this will only log to the console.</p>` : "");

    Swal.fire({
        title: "Buy all on this page?",
        html: summaryHtml,
        icon: "warning",
        showCancelButton: true,
        focusCancel: true,
        confirmButtonText: "Confirm",
        cancelButtonText: "Cancel",
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        if (disableBulkBuy) {
            console.log("[Avatar Store Plus] Bulk buy dry run");
            ordered.forEach((color, index) => {
                const a = color.avatar;
                console.log(`  ${index + 1}. ${a.avatarName} · ${a.outfitName} · ${color.name}`, {
                    avatarId: a.avatarId,
                    colorId: color.colorId,
                    notePrice: color.notePrice,
                    colorPrice: color.colorPrice,
                    ticketTier: color.ticketTier,
                });
            });
            console.log("Estimated totals — notes:", noteTotal, "rhythm:", rhythmTotal);
            return;
        }

        for (const color of ordered) {
            const avatarId = color.avatar.avatarId;
            const colorId = color.colorId;
            try {
                await sendUnlockAvatarAndWait(avatarId, colorId);
            } catch (err) {
                Swal.fire({
                    title: "Bulk buy stopped",
                    text: String(err?.message ?? err),
                    icon: "error",
                });
                return;
            }
        }
    });
}

// Random `StoreColor` among skins currently allowed by filters
function getRandomFilteredStoreColor() {
    const pool = getAllStoreColors().filter((c) => c.inFilter);
    if (!pool.length) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
}

// Filtered outfit default backgrounds + unlocked unique backgrounds, each passing the skin-bonus gate
function getFilteredBackgroundDescriptionsForAvatar(avatarDesc) {
    const fromSkins = getAllStoreColors()
        .filter((c) => c.inFilter)
        .map((c) => c.backgroundDescription)
        .filter((bd) => comboPassesSkinBonusGate(avatarDesc, bd));
    const uniq = storeWindow
        .getAllUniqueBackgrounds()
        .filter((b) => b.unlocked)
        .map((b) => b.backgroundDescription)
        .filter((bd) => comboPassesSkinBonusGate(avatarDesc, bd));
    return fromSkins.concat(uniq);
}

/**
 * True if this avatar + background preview would not hit the disabled "Missing Skin Bonus" state.
 * Mirrors storeAvatarColumn: paired default BG, unique BG, or 10+ unlocks on the background’s source outfit.
 */
function comboPassesSkinBonusGate(avatarDesc, bgDesc) {
    if (!avatarDesc || !bgDesc) return false;
    if (avatarDesc.avatarId === bgDesc.avatarId && avatarDesc.colorId === bgDesc.colorId) {
        return true;
    }
    if (bgDesc.backgroundUniqueId) {
        return true;
    }
    if (bgDesc.avatarId == null) {
        return true;
    }
    return storeWindow.getAvatarBonusUnlocked(bgDesc.avatarId);
}

// Sets randomized accessory (option) on/off on a copied avatar description when randomize asks for it.
function applyAccessoryToAvatarDesc(avatarDesc, curA, randAvatar, randAccessory) {
    if (randAvatar && !randAccessory) {
        avatarDesc.optionActive = curA.optionActive;
    }
    else if (randAvatar && randAccessory) {
        if (avatarDesc.optionName === "None") {
            avatarDesc.optionActive = false;
        }
        else {
            avatarDesc.optionActive = Math.random() < 0.5;
        }
    }
    else if (!randAvatar && randAccessory && avatarDesc.optionName !== "None") {
        avatarDesc.optionActive = Math.random() < 0.5;
    }
}

/**
 * Applies random picks to the store preview per checkbox: avatar skin, background art, and outfit accessory toggle
 * (option on/off — same control as #swRightColumnAvatarToggleButton; see storeAvatarColumn toggle + optionActive).
 * Preserves front/back decoration tile selections by passing current decoration ids into handleAvatarSelected.
 * Skins use `StoreColor.inFilter` (modern ASP top filters or legacy store filters). Skin-bonus rules still apply when mixing BGs.
 */
function randomizeSelectedParts() {
    const randAvatar = $("#aspRandPartAvatar").prop("checked");
    const randBg = $("#aspRandPartBackground").prop("checked");
    const randAccessory = $("#aspRandPartAccessory").prop("checked");
    if (!randAvatar && !randBg && !randAccessory) return;

    const col = storeWindow.avatarColumn;
    const curA = col.currentAvatar;
    const curB = col.currentBackground;
    if (!curA || !curB) return;

    const needFullColumn = randAvatar || randAccessory;
    if (needFullColumn && storeWindow.inBackgroundMode) {
        storeWindow.toggleBackgroundSelect();
    }

    let avatarDesc;
    let bgDesc;

    if (randAvatar && randBg) {
        const skinA = getRandomFilteredStoreColor();
        if (!skinA) return;
        avatarDesc = { ...skinA.fullDescription };
        applyAccessoryToAvatarDesc(avatarDesc, curA, true, randAccessory);
        const pool = getFilteredBackgroundDescriptionsForAvatar(avatarDesc);
        bgDesc = pool.length
            ? pool[Math.floor(Math.random() * pool.length)]
            : skinA.backgroundDescription;
    }
    else if (randAvatar && !randBg) {
        const compatible = getAllStoreColors().filter(
            (c) => c.inFilter && comboPassesSkinBonusGate(c.fullDescription, curB)
        );
        let skin;
        let usePairedBg = false;
        if (compatible.length) {
            skin = compatible[Math.floor(Math.random() * compatible.length)];
        }
        else {
            skin = getRandomFilteredStoreColor();
            if (!skin) return;
            usePairedBg = true;
        }
        avatarDesc = { ...skin.fullDescription };
        applyAccessoryToAvatarDesc(avatarDesc, curA, true, randAccessory);
        bgDesc = usePairedBg ? skin.backgroundDescription : curB;
    }
    else if (!randAvatar && randBg) {
        avatarDesc = { ...curA };
        applyAccessoryToAvatarDesc(avatarDesc, curA, false, randAccessory);
        const pool = getFilteredBackgroundDescriptionsForAvatar(avatarDesc);
        if (!pool.length) return;
        bgDesc = pool[Math.floor(Math.random() * pool.length)];
    }
    else {
        avatarDesc = { ...curA };
        applyAccessoryToAvatarDesc(avatarDesc, curA, false, randAccessory);
        bgDesc = curB;
    }

    const frontId = col.currentFrontDecoration?.decorationId;
    const backId = col.currentBackDecoration?.decorationId;
    storeWindow.handleAvatarSelected(avatarDesc, bgDesc, frontId, backId);
}

/**
 * Maps a visible .swAvatarTile to mainContainer.currentContent[i] (same order as tiles in #swContentAvatarContainer).
 */
function resolveStoreModelFromAvatarTile($tile) {
    const content = storeWindow.mainContainer.currentContent;
    if (!content.length) return null;
    const index = $("#swContentAvatarContainer .swAvatarTile").index($tile);
    if (index < 0) return null;
    return content[index] ?? null;
}

// Short tier label from amq-client `typeKey` (avatar_window.avatar_states.*)
function tierShortLabelFromTypeKey(typeKey) {
    if (!typeKey || typeof typeKey !== "string") return "?";
    if (typeKey.includes("unique")) return "unique";
    if (typeKey.includes("unavailable")) return "unavailable";
    if (typeKey.includes("limited")) return "limited";
    if (typeKey.includes("exclusive")) return "exclusive";
    if (typeKey.includes("standard")) return "standard";
    return typeKey;
}

// reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#swRightColumnBottomInner");
    const wasWishlist = $w.find("#aspWishlistTab").hasClass("selected");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
    if (tab === "aspSearch") {
        queueMicrotask(updateSearchPanel);
    }
    // Pause/resume any wishlist spine animators based on whether the tab is currently visible.
    const isWishlist = tab === "aspWishlist";
    if (isWishlist !== wasWishlist) {
        const method = isWishlist ? "handleDisplayed" : "handleDetatched";
        $wishlist?.find(".asp-wishlist-row").each(function () {
            $(this).data("aspHeadHandler")?.[method]();
        });
    }
}

// load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false) {
    const item = saveData.hotKeys?.[action];
    if (!item || typeof item !== "object") return { key, ctrl, alt, shift };
    return {
        key: String(item.key ?? key).toUpperCase(),
        ctrl: Boolean(item.ctrl ?? item.ctrlKey ?? ctrl),
        alt: Boolean(item.alt ?? item.altKey ?? alt),
        shift: Boolean(item.shift ?? item.shiftKey ?? shift)
    }
}

// create hotkey rows and add to table
function createHotkeyTable(data) {
    const $tbody = $("#aspHotkeyTable tbody");
    for (const { action, title } of data) {
        const $input = $("<input>", { type: "text", class: "hk-input", readonly: true, "data-action": action })
            .val(bindingToText(hotKeys[action]))
            .on("click", startHotkeyRecord);
        $tbody.append($("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>", { class: "asp-settings-tile-value" }).append($input)));
    }
}

// begin hotkey capture on click
function startHotkeyRecord() {
    const $input = $(this);
    if ($input.hasClass("recording")) return;
    const action = $input.data("action");
    const capture = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!e.key) return;
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        if ((e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            hotKeys[action] = {
                key: "",
                ctrl: false,
                alt: false,
                shift: false
            };
        }
        else {
            hotKeys[action] = {
                key: e.key.toUpperCase(),
                ctrl: e.ctrlKey,
                alt: e.altKey,
                shift: e.shiftKey
            };
        }
        saveSettings();
        finish();
    };
    const finish = () => {
        document.removeEventListener("keydown", capture, true);
        $input.removeClass("recording").val(bindingToText(hotKeys[action])).off("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    $input.addClass("recording").val("Press keys…").on("blur", finish);
}

// input hotKeys[action] and convert the data to a string for the input field
function bindingToText(b) {
    if (!b) return "";
    const keys = [];
    if (b.ctrl) keys.push("CTRL");
    if (b.alt) keys.push("ALT");
    if (b.shift) keys.push("SHIFT");
    if (b.key) keys.push(b.key === " " ? "SPACE" : b.key);
    return keys.join(" + ");
}

// Normalize and validate wishlist entries loaded from storage
function normalizeWishlistFromStorage(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const e of raw) {
        if (!e || e.avatarId == null || e.colorId == null) continue;
        const avatarId = Number(e.avatarId);
        const colorId = Number(e.colorId);
        if (Number.isNaN(avatarId) || Number.isNaN(colorId)) continue;
        if (out.some((x) => x.avatarId === avatarId && x.colorId === colorId)) continue;
        out.push({ avatarId, colorId });
    }
    return out;
}

// Normalize and validate wishlist sort data loaded from storage
function normalizeWishlistSort(raw) {
    if (!raw || typeof raw !== "object") return { mode: "catalog", ascending: true };
    const mode = ["catalog", "alpha", "tier"].includes(raw.mode) ? raw.mode : "catalog";
    const ascending = raw.ascending !== false;
    return { mode, ascending };
}

// validate json data in local storage
function validateLocalStorage(item) {
    try {
        const json = JSON.parse(localStorage.getItem(item));
        if (!json || typeof json !== "object") return {};
        return json;
    }
    catch {
        return {};
    }
}

// save settings
function saveSettings() {
    localStorage.setItem("avatarStorePlus", JSON.stringify({
        hotKeys,
        avatarTileWidth,
        avatarTileGap,
        avatarInfoLogging,
        disableBulkBuy,
        legacyAvatarStoreFilters,
        wishlistSort,
        wishlist,
    }));
}

function exportAvatarStorePlusData() {
    const json = JSON.stringify({
        exportedAt: new Date().toISOString(),
        hotKeys,
        avatarTileWidth,
        avatarTileGap,
        avatarInfoLogging,
        disableBulkBuy,
        legacyAvatarStoreFilters,
        wishlistSort,
        wishlist,
    }, null, 2);
    const time = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `avatarStorePlus-backup-${time}.json`;
    a.style.display = "none";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function applyAvatarStorePlusImportData(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, message: "File must be a single JSON object." };
    }
    if (data.hotKeys != null) {
        if (typeof data.hotKeys !== "object" || data.hotKeys === null || Array.isArray(data.hotKeys)) {
            return { ok: false, message: "Property \"hotKeys\" must be an object." };
        }
        const next = {};
        for (const [action, b] of Object.entries(data.hotKeys)) {
            if (b == null) continue;
            if (typeof b !== "object" || Array.isArray(b)) {
                return { ok: false, message: `Invalid hotkey binding for "${String(action)}".` };
            }
            const key = (b.key || "").toUpperCase();
            next[action] = {
                key,
                ctrl: Boolean(b.ctrl ?? b.ctrlKey),
                alt: Boolean(b.alt ?? b.altKey),
                shift: Boolean(b.shift ?? b.shiftKey),
            };
        }
        hotKeys = next;
    }
    if (data.avatarTileWidth != null) {
        avatarTileWidth = String(data.avatarTileWidth);
    }
    if (data.avatarTileGap != null) {
        avatarTileGap = String(data.avatarTileGap);
    }
    if (data.avatarInfoLogging != null) {
        avatarInfoLogging = Boolean(data.avatarInfoLogging);
    }
    if (data.disableBulkBuy != null) {
        disableBulkBuy = Boolean(data.disableBulkBuy);
    }
    if (data.legacyAvatarStoreFilters != null) {
        legacyAvatarStoreFilters = Boolean(data.legacyAvatarStoreFilters);
    }
    if (data.wishlist != null) {
        if (!Array.isArray(data.wishlist)) {
            return { ok: false, message: "wishlist must be an array." };
        }
        wishlist = normalizeWishlistFromStorage(data.wishlist);
    }
    if (data.wishlistSort != null) {
        wishlistSort = normalizeWishlistSort(data.wishlistSort);
    }
    saveSettings();
    $("#aspAvatarTileWidth").val(avatarTileWidth);
    $("#aspAvatarTileGap").val(avatarTileGap);
    $("#aspAvatarInfoLogging").prop("checked", avatarInfoLogging);
    $("#aspDisableBulkBuy").prop("checked", disableBulkBuy);
    $("#aspLegacyFiltersToggle").prop("checked", legacyAvatarStoreFilters);
    applyAspStoreTopPanelsMode();
    $(`#aspHotkeyTable input.hk-input[data-action]`).each(function () {
        const action = $(this).data("action");
        $(this).val(bindingToText(hotKeys[action]));
    });
    renderWishlist();
    syncWishlistSortUi();
    applyStyles();
    return { ok: true };
}

// apply styles
function applyStyles() {
    const cs = getComputedStyle(document.documentElement);
    let css = /*css*/ `
        #aspAvatarTabContainer {
            display: flex;
            height: auto;
        }
        #aspAvatarTabContainer > .tab {
            flex: 1 1 0;
            width: auto;
            margin: 0;
            padding: 0;
        }
        #aspAvatarTabContainer .tab::before {
            transform: none;
        }
        #swContentAvatarContainer {
            padding-top: 135px;
        }
        #swRightColumnTop {
            overflow: hidden;
        }
        #swRightColumnTop h1 {
            margin: -2px 0 2px 67px;
        }
        .swFilterColumn {
            transform: translate(-40px);
        }
        #aspModernStoreTopFilters {
            font-size: 12px;
        }
        .asp-stf-heading-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 4px 0 2px 50px;
            line-height: 1;
            flex-wrap: wrap;
        }
        .asp-stf-heading-left {
            display: flex;
            align-items: baseline;
            gap: 8px;
            flex-wrap: wrap;
            min-width: 0;
        }
        .asp-stf-heading {
            font-size: 20px;
            font-weight: bold;
            margin: 0;
            line-height: 1;
        }
        .asp-stf-heading-count {
            font-size: 12px;
            font-weight: bold;
            opacity: 0.7;
        }
        .asp-stf-reset {
            flex-shrink: 0;
            padding: 0;
            font-size: 11px;
            opacity: 0.7;
            background: transparent;
            border: none;
            cursor: pointer;
            margin-right: 55px;
        }
        .asp-stf-reset:hover {
            opacity: 1;
        }
        .asp-stf-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 1px;
        }
        .asp-stf-label {
            text-align: right;
            font-weight: bold;
            opacity: 0.7;
        }
        .asp-stf-segs {
            flex: 1 1 auto;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 0 3px;
            min-width: 0;
            justify-content: flex-start;
        }
        .asp-stf-sep {
            color: rgba(255, 255, 255, 0.25);
            user-select: none;
            pointer-events: none;
            padding: 0 1px;
        }
        .asp-stf-seg {
            background: none;
            border: none;
            margin: 0;
            padding: 1px 3px;
            cursor: pointer;
            line-height: 1.2;
            border-radius: 2px;
            opacity: .7;
        }
        .asp-stf-seg:hover {
            opacity: 1;
        }
        .asp-stf-seg.active {
            background: ${cs.getPropertyValue("--accentColor") || "#006ab7"};
            color: #ffffff;
            font-weight: 700;
            padding: 2px 5px;
            opacity: 1;
        }
        .asp-stf-tiers-cluster {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            flex: 1 1 auto;
            min-width: 0;
        }
        .asp-stf-tiers {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-wrap: wrap;
        }
        .asp-info-icon {
            flex: 0 0 auto;
            padding: 0 3px;
            margin: 0;
            cursor: pointer;
            line-height: 1;
            opacity: .7;
        }
        .asp-info-icon:hover {
            opacity: 1;
        }
        .asp-info-icon .fa {
            font-size: 14px;
            vertical-align: middle;
        }
        .asp-stf-tier {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: none;
            border: none;
            border-radius: 2px;
            padding: 2px;
            margin: 0;
            cursor: pointer;
            line-height: 0;
        }
        .asp-stf-tier-img {
            width: 20px;
            height: 20px;
        }
        .asp-stf-tier .asp-stf-tier-img {
            opacity: 0.5;
        }
        .asp-stf-tier.active .asp-stf-tier-img {
            opacity: 1;
        }
        .asp-stf-tier:hover .asp-stf-tier-img {
            filter: drop-shadow(0 0 2px gray);
        }
        #swRightColumn .popover .asp-pop-tier-wrap {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            gap: 5px;
            margin: 0;
        }
        #swRightColumn .popover .asp-pop-tier-cell {
            flex: 0 0 auto;
            text-align: center;
            min-width: 56px;
            max-width: 72px;
        }
        #swRightColumn .popover .asp-pop-tier-ticket {
            width: 28px;
            height: 28px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }
        #swRightColumn .popover .asp-pop-tier-rarity {
            margin-top: 2px;
            font-size: 13px;
            line-height: 1.2;
            opacity: 0.9;
            word-break: break-word;
        }
        #swRightColumn .popover .asp-pop-tier-rhythm {
            margin-top: 4px;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1px;
        }
        #swRightColumn .popover .asp-pop-tier-rhythm-icon {
            width: 20px;
            height: 20px;
        }
        #swRightColumn .popover .asp-pop-tier-rhythm-amt {
            font-variant-numeric: tabular-nums;
        }
        #swRightColumn .popover .asp-pop-tier-note {
            margin: 0.55em 0 0 0;
            font-size: 11px;
            line-height: 1.35;
            opacity: 0.92;
        }
        #swRightColumnBottomInner input {
            color: black;
        }
        #aspSettingsContainer .asp-settings-tile-table {
            width: 100%;
            border-collapse: collapse;
        }
        #aspSettingsContainer .asp-settings-tile-table td,
        #aspSettingsContainer .asp-settings-tile-table th {
            padding: 4px 8px 4px 0;
            vertical-align: middle;
        }
        #aspSettingsContainer .asp-settings-tile-table thead th {
            font-weight: bold;
        }
        #aspSettingsContainer .asp-settings-tile-table td:first-child,
        #aspSettingsContainer .asp-settings-tile-table th:first-child {
            white-space: nowrap;
        }
        #swRightColumnBottomInner #aspSettingsContainer .asp-settings-tile-table .asp-settings-tile-value input[type="text"] {
            width: 100%;
            max-width: 120px;
            min-width: 60px;
            box-sizing: border-box;
        }
        #aspSettingsContainer .asp-settings-checkbox-row input[type="checkbox"] {
            width: auto;
            margin-right: 5px;
        }
        #aspSettingsContainer h4 {
            margin: 15px 0 5px 0;
        }
        #aspSettingsContainer .asp-settings-h4-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 15px 0 5px 0;
        }
        #aspSettingsContainer .asp-settings-h4-row h4 {
            margin: 0;
        }
        #aspSettingsContainer .asp-settings-backup-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            margin-bottom: 6px;
        }
        #aspSearchRow {
            display: flex;
            gap: 4px;
        }
        .asp-search-button {
            padding: 6px 10px;
        }
        .asp-search-summary {
            margin-top: 8px;
            font-size: 12px;
            line-height: 1.45;
        }
        .asp-search-summary-line {
            margin: 2px 0;
        }
        .asp-context-panel {
            margin-top: 12px;
            padding: 8px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 4px;
        }
        .asp-context-name {
            font-size: 18px;
            font-weight: 700;
            line-height: 1.2;
            text-align: center;
            word-break: break-word;
            margin-bottom: 6px;
        }
        .asp-context-owned {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            margin: 0 30px 6px 30px;
        }
        .asp-context-owned-label {
            opacity: 0.75;
            flex: 0 0 auto;
        }
        .asp-progress {
            position: relative;
            flex: 1 1 auto;
            min-width: 60px;
            height: 14px;
            border-radius: 3px;
            background: ${cs.getPropertyValue("--secondaryColor") || "#424242"};
            overflow: hidden;
        }
        .asp-progress-bar {
            position: absolute;
            inset: 0 auto 0 0;
            width: 0%;
            background: ${cs.getPropertyValue("--accentColor") || "#006ab7"};
            transition: width .2s ease-out;
        }
        .asp-progress-text {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            color: #ffffff;
            text-shadow: 0 0 2px rgba(0, 0, 0, 0.7);
            pointer-events: none;
        }
        .asp-context-owned-fraction {
            flex: 0 0 auto;
            font-variant-numeric: tabular-nums;
        }
        .asp-context-breakdown {
            display: grid;
            grid-template-columns: auto auto auto;
            justify-content: center;
            row-gap: 2px;
            column-gap: 6px;
            font-size: 12px;
        }
        .asp-breakdown-row {
            display: contents;
        }
        .asp-breakdown-icon {
            width: 16px;
            height: 16px;
            object-fit: contain;
            align-self: center;
            font-size: 14px;
            line-height: 16px;
            text-align: center;
        }
        .asp-breakdown-label {
            opacity: 0.85;
            align-self: center;
            word-break: break-word;
        }
        .asp-breakdown-fraction {
            font-variant-numeric: tabular-nums;
            align-self: center;
            text-align: right;
        }
        .asp-bulk-note {
            margin: 2px 0 8px 0;
            font-size: 11px;
            opacity: 0.75;
            line-height: 1.35;
        }
        #aspAvatarButtonRow {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            padding: 0 10px;
        }
        #aspColorNames {
            padding: 0 10px 6px 10px;
            font-size: 12px;
            line-height: 1.3;
        }
        .asp-color-names-row {
            display: flex;
            gap: 8px;
        }
        .asp-color-names-label {
            opacity: 0.6;
        }
        .asp-goto-group {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .asp-goto-btn {
            width: 34px;
            padding: 6px 0;
        }
        .asp-randomize-options-caret-btn {
            padding-left: 10px;
            padding-right: 10px;
        }
        .asp-randomize-options-inner {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 3px 12px;
        }
        .aspRandLabel {
            margin: 0;
        }
        #aspBulkBuyRow {
            margin-top: 10px;
            flex-shrink: 0;
            width: 100%;
        }
        .asp-sw-warn {
            margin-top: 10px;
            font-size: 12px;
            color: #c0392b;
        }
        #swContentAvatarContainer .swAvatarTile.asp-search-hidden {
            display: none;
        }
        /* unhide event colors */
        .swAvatarTile.eventColor {
            opacity: 1;
        }
        /* bug fix for event colors being stuck at opacity 1 */
        .swAvatarTile.eventColor.storeFade {
            opacity: .5;
        }
        .swAvatarTile .asp-tile-wishlist-btn {
            position: absolute;
            left: 0;
            top: 0;
            z-index: 6;
            margin: 0;
            padding: 2px 0 0 4px;
        }
        .swAvatarTile .asp-tile-wishlist-btn.wishlisted {
            color: #d9534f;
        }
        .asp-wishlist-sort-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .asp-wishlist-sort-label {
            margin: 0;
        }
        .asp-wishlist-sort-select {
            width: 140px;
            padding: 0 5px;
        }
        .asp-wishlist-sort-dir {
            flex: 0 0 auto;
            padding: 6px 10px;
        }
        .asp-wishlist-list {
            margin-top: 4px;
        }
        .asp-wishlist-empty {
            margin: 0;
            font-size: 12px;
        }
        .asp-wishlist-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 4px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .asp-wishlist-row-head {
            flex: 0 0 auto;
            width: 40px;
            height: 40px;
            border-radius: 4px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.08);
            cursor: pointer;
            pointer-events: auto;
        }
        .asp-wishlist-row-head--empty {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: default;
        }
        .asp-wishlist-row-head-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .asp-wishlist-row-text {
            flex: 1 1 auto;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 12px;
        }
        .asp-wishlist-name {
            font-weight: 600;
        }
        .asp-wishlist-color-wrap {
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .asp-wishlist-color {
            opacity: .7;
        }
        .asp-wishlist-tier-icon {
            width: 14px;
            height: 14px;
            object-fit: contain;
            flex-shrink: 0;
        }
        i.asp-wishlist-tier-icon {
            width: 14px;
            height: 14px;
            font-size: 14px;
            line-height: 14px;
            text-align: center;
        }
        .asp-wishlist-row-actions {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            gap: 4px;
            margin-right: 8px;
        }
        .asp-wishlist-row-actions .asp-wishlist-action-btn {
            width: 25px;
            height: 25px;
            padding: 0;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #aspWishlistList .asp-wishlist-buy:disabled {
            opacity: 0.5;
            cursor: default;
        }
        #aspHotkeyTable input.hk-input {
            cursor: pointer;
            user-select: none;
        }
    `;
    if (avatarTileWidth) css += `
        .swAvatarTile {
            width: ${avatarTileWidth};
        }
    `;
    if (avatarTileGap) css += `
        #swContentAvatarContainer {
            column-gap: ${avatarTileGap};
        }
        .swAvatarTile {
            margin-bottom: ${avatarTileGap};
        }
    `;
    let style = document.getElementById("avatarStorePlusStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "avatarStorePlusStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
