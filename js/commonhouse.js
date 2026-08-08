/**
 * Common House Module - Village Building to swap Slimes between the Main and Village Rosters.
 *
 * Layout mirrors the Shop popup:
 *  1) Top-left  : Main Slime Roster
 *  2) Top-right : Village Roster (up to 180 slimes), selectable
 *  3) Middle    : Control column with ">" and "<" swap buttons (wired up later)
 *  4) Bottom    : Single shared "Selected Slime" card (Name / Specialization / Type).
 *                 Only slimes from one side can be selected at once.
 */

import { gameState, SLIME_TYPES, getSlimeJumpSprite, saveStateToLocal, updateBestRoster, getEquipmentQuality } from './state.js';
import { renderSlimeRosterLanes, updateUI } from './ui.js';

const MAX_MAIN_ROSTER = 60;
const MAX_VILLAGE_ROSTER = 180;

let selectedSide = null;       // 'main' | 'village' | null
let selectedIds = new Set();   // ids of selected slimes on the active side (Ctrl+Click multiselect)
let primarySlimeId = null;     // representative shown in the bottom card

/**
 * Open the Common House popup (village intermission building).
 */
export function openCommonHousePopup() {
    if (document.getElementById('commonHousePopup')) return;
    if (!Array.isArray(gameState.villageRoster)) gameState.villageRoster = [];

    selectedSide = gameState.slimes?.length ? 'main' : (gameState.villageRoster?.length ? 'village' : null);
    const initialId = selectedSide === 'main'
        ? gameState.slimes[0].id
        : (selectedSide === 'village' ? gameState.villageRoster[0].id : null);
    selectedIds = new Set(initialId ? [initialId] : []);
    primarySlimeId = initialId;

    const backdrop = document.createElement('div');
    backdrop.id = 'commonHousePopup';
    backdrop.className = 'village-building-backdrop';
    const popup = document.createElement('div');
    popup.className = 'common-house-popup pixel-popup';
    popup.innerHTML = `
        <button class="village-popup-close" aria-label="Close">&times;</button>
        <h3 class="common-house-title"><img class="common-house-title-icon" src="images/slimes/army.png" alt="Common House"> Common House</h3>
        <div class="common-house-body">
            <div class="common-house-col">
                <div class="shop-section-title" id="chMainRosterTitle">Main Roster (${(gameState.slimes || []).length}/${MAX_MAIN_ROSTER})</div>
                <div class="common-house-toolbar">
                    <div class="common-house-toolbar-row">
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAll" title="Select all" aria-label="Select all"><img class="ch-slime-icon" src="images/slimes/army.png" alt="Basic"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllBasic" title="MainRosterSelectAllBasic" aria-label="Select all Basic"><img class="ch-slime-icon" src="images/slimes/base/sprites/slime1.png" alt="Basic"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllFire" title="MainRosterSelectAllFire" aria-label="Select all Fire"><img class="ch-slime-icon" src="images/slimes/fire/sprites/slime1.png" alt="Fire"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllPoison" title="MainRosterSelectAllPoison" aria-label="Select all Poison"><img class="ch-slime-icon" src="images/slimes/poison/sprites/slime1.png" alt="Poison"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllIce" title="MainRosterSelectAllIce" aria-label="Select all Ice"><img class="ch-slime-icon" src="images/slimes/ice/sprites/slime1.png" alt="Ice"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllStone" title="MainRosterSelectAllStone" aria-label="Select all Stone"><img class="ch-slime-icon" src="images/slimes/stone/sprites/slime1.png" alt="Stone"></button>
                    </div>
                    <div class="common-house-toolbar-row">
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllSupport" title="MainRosterSelectAllSupport" aria-label="Select all Support"><img class="ch-logo-icon" src="images/logos/support.png" alt="Support"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllFighter" title="MainRosterSelectAllFighter" aria-label="Select all Fighter"><img class="ch-logo-icon" src="images/logos/fighter.png" alt="Fighter"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllTank" title="MainRosterSelectAllTank" aria-label="Select all Tank"><img class="ch-logo-icon" src="images/logos/tank.png" alt="Tank"></button>
                    </div>
                    <div class="common-house-toolbar-divider"></div>
                </div>
                <div id="chMainRoster" class="common-house-roster shop-scrollbar"></div>
            </div>
            <div class="common-house-control" aria-label="Roster swap controls">
                <button class="common-house-btn pixel-btn" id="chSwapRight" title="Move selected slime to the Village">&gt;</button>
                <button class="common-house-btn pixel-btn" id="chSwapLeft" title="Move selected slime to the Main">&lt;</button>
            </div>
            <div class="common-house-col">
                <div class="shop-section-title" id="chVillageRosterTitle">Village Roster (${gameState.villageRoster.length}/${MAX_VILLAGE_ROSTER})</div>
                <div class="common-house-toolbar">
                    <div class="common-house-toolbar-row">
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAll" title="Select all" aria-label="Select all"><img class="ch-slime-icon" src="images/slimes/army.png" alt="Basic"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllBasic" title="VillageRosterSelectAllBasic" aria-label="Select all Basic"><img class="ch-slime-icon" src="images/slimes/base/sprites/slime1.png" alt="Basic"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllFire" title="VillageRosterSelectAllFire" aria-label="Select all Fire"><img class="ch-slime-icon" src="images/slimes/fire/sprites/slime1.png" alt="Fire"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllPoison" title="VillageRosterSelectAllPoison" aria-label="Select all Poison"><img class="ch-slime-icon" src="images/slimes/poison/sprites/slime1.png" alt="Poison"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllIce" title="VillageRosterSelectAllIce" aria-label="Select all Ice"><img class="ch-slime-icon" src="images/slimes/ice/sprites/slime1.png" alt="Ice"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllStone" title="VillageRosterSelectAllStone" aria-label="Select all Stone"><img class="ch-slime-icon" src="images/slimes/stone/sprites/slime1.png" alt="Stone"></button>
                    </div>
                    <div class="common-house-toolbar-row">
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllSupport" title="VillageRosterSelectAllSupport" aria-label="Select all Support"><img class="ch-logo-icon" src="images/logos/support.png" alt="Support"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllFighter" title="VillageRosterSelectAllFighter" aria-label="Select all Fighter"><img class="ch-logo-icon" src="images/logos/fighter.png" alt="Fighter"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllTank" title="VillageRosterSelectAllTank" aria-label="Select all Tank"><img class="ch-logo-icon" src="images/logos/tank.png" alt="Tank"></button>
                    </div>
                    <div class="common-house-toolbar-divider"></div>
                </div>
                <div id="chVillageRoster" class="common-house-roster shop-scrollbar"></div>
            </div>
        </div>
        <div class="common-house-selected">
            <div class="shop-section-title">Selected Slime</div>
            <div id="chSelectedSlimeCard" class="common-house-selected-card"></div>
        </div>
    `;
    popup.querySelector('.village-popup-close').addEventListener('click', () => closeCommonHousePopup());
    popup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        const action = btn?.dataset?.action;
        if (typeof action === 'string' && /^(Main|Village)RosterSelectAll/.test(action)) selectAllBy(action);
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeCommonHousePopup(); });
    popup.querySelector('#chSwapRight')?.addEventListener('click', moveSelectedSlimesToVillage);
    popup.querySelector('#chSwapLeft')?.addEventListener('click', moveSelectedSlimesToMain);
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');

    renderCommonHouse();
}

/**
 * Close the Common House popup.
 */
export function closeCommonHousePopup() {
    document.getElementById('commonHousePopup')?.remove();
    document.body.classList.remove('modal-open');
}

/**
 * Move every selected Main Roster slime to the Village Roster. Each slime's
 * equipment is stripped and sent to the Village Forge Inventory first.
 */
function moveSelectedSlimesToVillage() {
    if (selectedSide !== 'main' || selectedIds.size === 0) return;
    if (!Array.isArray(gameState.villageRoster)) gameState.villageRoster = [];
    if (!Array.isArray(gameState.villageInventory)) gameState.villageInventory = [];

    const selected = (gameState.slimes || []).filter(s => selectedIds.has(s.id));
    const space = MAX_VILLAGE_ROSTER - gameState.villageRoster.length;
    const toMove = selected.slice(0, Math.max(0, space));

    toMove.forEach(slime => {
        (slime.equipment || []).forEach(item => {
            gameState.villageInventory.push({ id: item.id, quality: getEquipmentQuality(item) });
        });
        slime.equipment = [];
        gameState.villageRoster.push(slime);
    });

    if (toMove.length > 0) {
        const movedKeys = new Set(toMove.map(s => s.id || s.name));
        gameState.slimes = (gameState.slimes || []).filter(s => !toMove.includes(s));
        // Drop moved Slimes from the historical roster so they are not shown as
        // dead RIP slots (nor resurrected) in the main Slime Roster.
        gameState.bestRoster = (gameState.bestRoster || []).filter(s => !movedKeys.has(s.id || s.name));
        gameState.armySize = gameState.slimes.length;
        saveStateToLocal();
        updateUI();
    }

    selectedSide = null;
    selectedIds = new Set();
    primarySlimeId = null;
    renderCommonHouse();
}

/**
 * Move every selected Village Roster slime back to the Main Roster.
 */
function moveSelectedSlimesToMain() {
    if (selectedSide !== 'village' || selectedIds.size === 0) return;

    const selected = (gameState.villageRoster || []).filter(s => selectedIds.has(s.id));
    const space = MAX_MAIN_ROSTER - (gameState.slimes || []).length;
    const toMove = selected.slice(0, Math.max(0, space));

    if (toMove.length > 0) {
        gameState.villageRoster = (gameState.villageRoster || []).filter(s => !toMove.includes(s));
        gameState.slimes.push(...toMove);
        // Re-register the returned Slimes in the historical roster so they are
        // recognised as alive members of the army again.
        updateBestRoster();
        gameState.armySize = gameState.slimes.length;
        saveStateToLocal();
        updateUI();
    }

    selectedSide = null;
    selectedIds = new Set();
    primarySlimeId = null;
    renderCommonHouse();
}

/**
 * Re-render the whole Common House UI.
 */
function renderCommonHouse() {
    renderMainRoster();
    renderVillageRoster();
    renderSelectedSlimeCard();
}

/**
 * Render the Main (deployed) Slime Roster.
 */
function renderMainRoster() {
    const container = document.getElementById('chMainRoster');
    if (!container) return;

    const titleEl = document.getElementById('chMainRosterTitle');
    if (titleEl) titleEl.textContent = `Main Roster (${(gameState.slimes || []).length}/${MAX_MAIN_ROSTER})`;

    if (!gameState.slimes || gameState.slimes.length === 0) {
        container.innerHTML = '<p class="shop-empty-text">No slimes in the main roster.</p>';
        return;
    }

    renderSlimeRosterLanes(container, gameState.slimes.map(slime => ({ slime })), {
        itemClassName: 'common-house-roster-item',
        extraClassFor: slime => (selectedSide === 'main' && selectedIds.has(slime.id) ? 'selected' : ''),
        onItemClick: (slime, item, event) => selectSlime('main', slime, event?.ctrlKey === true)
    });
}

/**
 * Render the Village Roster (up to 180 slimes).
 */
function renderVillageRoster() {
    const container = document.getElementById('chVillageRoster');
    if (!container) return;

    const titleEl = document.getElementById('chVillageRosterTitle');
    if (titleEl) titleEl.textContent = `Village Roster (${gameState.villageRoster.length}/${MAX_VILLAGE_ROSTER})`;

    if (!gameState.villageRoster || gameState.villageRoster.length === 0) {
        container.innerHTML = '<p class="shop-empty-text">No slimes in the village roster.</p>';
        return;
    }

    renderSlimeRosterLanes(container, gameState.villageRoster.map(slime => ({ slime })), {
        itemClassName: 'common-house-roster-item',
        extraClassFor: slime => (selectedSide === 'village' && selectedIds.has(slime.id) ? 'selected' : ''),
        onItemClick: (slime, item, event) => selectSlime('village', slime, event?.ctrlKey === true)
    });
}

/**
 * Elemental type of a Slime (fire | poison | ice | stone | '') derived from its type id.
 */
function elementOf(slime) {
    const type = String(slime?.type || 'base');
    const m = type.match(/^(poison|fire|ice|stone)/);
    if (m) return m[1];
    return '';
}

/**
 * Roster toolbar action lookup: canonical name -> filter kind.
 * Element actions filter by elemental type; spec actions filter by specialization.
 */
const TOOLBAR_ACTIONS = {
    Basic: 'element:base',
    Fire: 'element:fire',
    Poison: 'element:poison',
    Ice: 'element:ice',
    Stone: 'element:stone',
    Support: 'spec:support',
    Fighter: 'spec:fighter',
    Tank: 'spec:tank'
};

/**
 * Handle a roster toolbar "Select All" action (Main or Village). Filters the
 * target roster by the requested element (Basic/Fire/Poison/Ice/Stone) or
 * specialization (Support/Fighter/Tank) and selects every matching slime.
 */
function selectAllBy(action) {
    const match = action.match(/^(Main|Village)RosterSelectAll(.+)?$/);
    if (!match) return;

    const side = match[1] === 'Main' ? 'main' : 'village';
    const list = side === 'main'
        ? (Array.isArray(gameState.slimes) ? gameState.slimes : [])
        : (Array.isArray(gameState.villageRoster) ? gameState.villageRoster : []);

    const suffix = match[2];
    const matches = !suffix
        ? list
        : (() => {
            const kind = TOOLBAR_ACTIONS[suffix];
            if (!kind) return [];
            const [filterType, value] = kind.split(':');
            return filterType === 'spec'
                ? list.filter(s => String(s.specialization || SLIME_TYPES[s.type]?.specialization || '').toLowerCase() === value)
                : (value === 'base'
                    ? list.filter(s => elementOf(s) === '')
                    : list.filter(s => elementOf(s) === value));
        })();

    selectedSide = side;
    selectedIds = new Set(matches.map(s => s.id));
    primarySlimeId = selectedIds.size ? selectedIds.values().next().value : null;

    renderCommonHouse();
}

/**
 * Handle a roster click: plain click selects a single slime; Ctrl+Click toggles
 * multiple selection. Only one side can be active at a time.
 */
function selectSlime(side, slime, isMulti) {
    if (selectedSide !== side) {
        selectedSide = side;
        selectedIds = new Set();
    }

    if (isMulti) {
        if (selectedIds.has(slime.id)) {
            selectedIds.delete(slime.id);
            if (selectedIds.size === 0) {
                selectedSide = null;
                primarySlimeId = null;
            } else if (primarySlimeId === slime.id) {
                primarySlimeId = selectedIds.values().next().value;
            }
        } else {
            selectedIds.add(slime.id);
            primarySlimeId = slime.id;
        }
    } else {
        selectedIds = new Set([slime.id]);
        primarySlimeId = slime.id;
    }

    renderCommonHouse();
}

/**
 * The currently selected slime (from either roster), or null.
 */
function getSelectedSlime() {
    if (!primarySlimeId) return null;
    if (selectedSide === 'main') {
        return gameState.slimes ? gameState.slimes.find(s => s.id === primarySlimeId) : null;
    }
    if (selectedSide === 'village') {
        return gameState.villageRoster ? gameState.villageRoster.find(s => s.id === primarySlimeId) : null;
    }
    return null;
}

/**
 * Render the single shared stats card for the selected slime.
 * Uses the same character-sheet portrait style (first jump-sheet frame + idle bounce).
 */
function renderSelectedSlimeCard() {
    const container = document.getElementById('chSelectedSlimeCard');
    if (!container) return;

    const slime = getSelectedSlime();
    if (!slime) {
        container.innerHTML = `
            <div class="slime-modal-portrait-wrapper common-house-portrait-wrapper common-house-portrait-empty"></div>
            <div class="common-house-slime-info">
                <p class="shop-empty-text">Select a slime to view its stats.</p>
            </div>
        `;
        return;
    }

    const specialization = String(
        slime.specialization || SLIME_TYPES[slime.type]?.specialization || 'base'
    ).toLowerCase();
    const specLabel = specialization.charAt(0).toUpperCase() + specialization.slice(1);
    const typeName = (SLIME_TYPES[slime.type] || SLIME_TYPES.base).name || slime.type || 'Slime';

    container.innerHTML = `
        <div class="slime-modal-portrait-wrapper common-house-portrait-wrapper">
            <img src="${getSlimeJumpSprite(slime)}" class="slime-modal-portrait common-house-portrait"
                alt="${slime.name}" style="object-position: 0px 0px;">
        </div>
        <div class="common-house-slime-info">
            <div class="common-house-slime-name">${slime.name}</div>
            <div class="common-house-slime-stat"><span class="ch-stat-label">Specialization:</span> ${specLabel}</div>
            <div class="common-house-slime-stat"><span class="ch-stat-label">Type:</span> ${typeName}</div>
        </div>
    `;
}
