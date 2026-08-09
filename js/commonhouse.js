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

import { gameState, SLIME_TYPES, getSlimeJumpSprite, getSlimeSpecialization, calculateSlimeDamage, getBaseCritChance, generateUniqueSlimeName, getNextAvailableSlotIndex, saveStateToLocal, updateBestRoster, getEquipmentQuality, sortRosterBySpecialization, TALENT_SUBTALENTS, SECOND_TALENT, SECOND_TALENT_ICON, getSecondTalentFlag, hasFirstTalent, ensureSlimeSubTalents, getSlimeSubTalent, recalculateSlimeStats } from './state.js';
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
        <h3 class="common-house-title"><img class="common-house-title-icon" src="images/slimes/army.png" alt="Common House"> Common House<span class="common-house-coins" id="chCoinsDisplay"><img src="images/logos/coin.png" alt="Village Coin" class="village-coin-icon"> <strong>${gameState.villageCoins || 0}</strong></span></h3>
        <div class="common-house-half">
            <div class="shop-section-title">Rosters</div>
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
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllSupport" title="MainRosterSelectAllSupport" aria-label="Select all Support"><img class="ch-logo-icon" src="images/talents/supportSpec.png" alt="Support"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllFighter" title="MainRosterSelectAllFighter" aria-label="Select all Fighter"><img class="ch-logo-icon" src="images/talents/fighterSpec.png" alt="Fighter"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="MainRosterSelectAllTank" title="MainRosterSelectAllTank" aria-label="Select all Tank"><img class="ch-logo-icon" src="images/talents/tankSpec.png" alt="Tank"></button>
                        <span class="common-house-toolbar-spacer"></span>
                        <button type="button" class="common-house-toolbar-btn common-house-create-btn" data-action="MainRosterCreate" title="Create a Basic Slime" aria-label="Create a Basic Slime"><img class="ch-slime-icon" src="images/slimes/createSlime.png" alt="Create"></button>
                    </div>
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
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllSupport" title="VillageRosterSelectAllSupport" aria-label="Select all Support"><img class="ch-logo-icon" src="images/talents/supportSpec.png" alt="Support"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllFighter" title="VillageRosterSelectAllFighter" aria-label="Select all Fighter"><img class="ch-logo-icon" src="images/talents/fighterSpec.png" alt="Fighter"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllTank" title="VillageRosterSelectAllTank" aria-label="Select all Tank"><img class="ch-logo-icon" src="images/talents/tankSpec.png" alt="Tank"></button>
                        <span class="common-house-toolbar-spacer"></span>
                        <button type="button" class="common-house-toolbar-btn common-house-create-btn" data-action="VillageRosterCreate" title="Create a Basic Slime" aria-label="Create a Basic Slime"><img class="ch-slime-icon" src="images/slimes/createSlime.png" alt="Create"></button>
                    </div>
                </div>
                <div id="chVillageRoster" class="common-house-roster shop-scrollbar"></div>
            </div>
        </div>
        </div>
        <div class="common-house-half">
            <div class="shop-section-title">Selected Slime</div>
            <div id="chSelectedSlimeCard" class="common-house-selected-card"></div>
        </div>
    `;
    popup.querySelector('.village-popup-close').addEventListener('click', () => closeCommonHousePopup());
    popup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        const action = btn?.dataset?.action;
        if (typeof action !== 'string') return;
        if (/^(Main|Village)RosterSelectAll/.test(action)) selectAllBy(action);
        else if (/^(Main|Village)RosterCreate$/.test(action)) createBasicSlime(action.startsWith('Main') ? 'main' : 'village');
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeCommonHousePopup(); });
    popup.querySelector('#chSwapRight')?.addEventListener('click', moveSelectedSlimesToVillage);
    popup.querySelector('#chSwapLeft')?.addEventListener('click', moveSelectedSlimesToMain);
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');

    renderCommonHouse();
}

// Re-render the roster grids on window resize (line capacity changes).
window.addEventListener('roster:relayout', () => {
    if (document.getElementById('commonHousePopup')) renderCommonHouse();
});

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
 * Create a new Basic Slime (always type 'base', never specialized) with a random
 * unique name and add it to the requested roster. Respects the roster capacity;
 * does nothing if the target roster is already full.
 */
function createBasicSlime(side) {
    const list = side === 'main' ? gameState.slimes : gameState.villageRoster;
    const max = side === 'main' ? MAX_MAIN_ROSTER : MAX_VILLAGE_ROSTER;
    if (!Array.isArray(list)) return;
    if (list.length >= max) return;

    const uniqueName = generateUniqueSlimeName();
    const slotIndex = getNextAvailableSlotIndex();
    const fortificationBonus = gameState.fortificationLevel || 0;
    const alchemistEndurance = gameState.alchemistEnduranceLevel || 0;

    const newSlime = {
        id: uniqueName,
        name: uniqueName,
        type: 'base',
        hp: 10 + fortificationBonus + alchemistEndurance,
        maxHp: 10 + fortificationBonus + alchemistEndurance,
        baseMaxHp: 10 + fortificationBonus + alchemistEndurance,
        damage: calculateSlimeDamage({ equipment: [] }),
        critChance: getBaseCritChance(),
        regen: gameState.alchemistRegenLevel || 0,
        ascended: false,
        slotIndex: slotIndex,
        equipment: []
    };

    if (side === 'main') {
        gameState.slimes.push(newSlime);
        gameState.armySize = gameState.slimes.length;
        updateBestRoster();
    } else {
        gameState.villageRoster.push(newSlime);
    }

    saveStateToLocal();
    updateUI();
    renderCommonHouse();
}

/**
 * Re-render the whole Common House UI.
 */
function renderCommonHouse() {
    renderMainRoster();
    renderVillageRoster();
    renderSelectedSlimeCard();
    updateCreateButtons();
    const coinsEl = document.getElementById('chCoinsDisplay');
    if (coinsEl) coinsEl.querySelector('strong').textContent = gameState.villageCoins || 0;

    // Re-measure the roster line capacities after the popup has fully laid out
    // (the 1fr grid columns resolve, scrollbars appear, fonts load). The first
    // synchronous render can measure a too-narrow column and pack fewer slimes
    // per line than fit, leaving short trailing lines (e.g. 2-2-2 instead of
    // 3-3-3). A short timeout catches the final settled width after everything
    // (including web-font layout) has resolved.
    const settle = () => {
        if (!document.getElementById('commonHousePopup')) return;
        renderMainRoster();
        renderVillageRoster();
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));
    setTimeout(settle, 80);
}

/** Disable each toolbar's Create button when its roster is at max capacity. */
function updateCreateButtons() {
    const mainFull = (gameState.slimes || []).length >= MAX_MAIN_ROSTER;
    const villageFull = (gameState.villageRoster || []).length >= MAX_VILLAGE_ROSTER;
    const mainBtn = document.querySelector('[data-action="MainRosterCreate"]');
    const villageBtn = document.querySelector('[data-action="VillageRosterCreate"]');
    if (mainBtn) mainBtn.disabled = mainFull;
    if (villageBtn) villageBtn.disabled = villageFull;
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
        byLine: true,
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
        byLine: true,
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
 * Every currently selected slime (from the active roster side).
 */
function getSelectedSlimes() {
    const list = selectedSide === 'main'
        ? (gameState.slimes || [])
        : selectedSide === 'village'
            ? (gameState.villageRoster || [])
            : [];
    return list.filter(s => selectedIds.has(s.id));
}

/**
 * Human-readable group label for a Slime used when summarizing a multi-selection.
 * Combines its element (Fire/Poison/Ice/Stone) with its specialization
 * (Support/Fighter/Tank). A plain Basic Slime (no element, no specialization)
 * reads simply as "Basic".
 */
function slimeGroupLabel(slime) {
    const element = elementOf(slime);            // 'fire' | 'poison' | 'ice' | 'stone' | ''
    const spec = getSlimeSpecialization(slime);  // 'support' | 'fighter' | 'tank' | ''
    if (!element && !spec) return 'Basic';
    const parts = [];
    if (element) parts.push(element.charAt(0).toUpperCase() + element.slice(1));
    if (spec) parts.push(spec.charAt(0).toUpperCase() + spec.slice(1));
    return parts.join(' ');
}

/** The four elemental Type buttons shown for non-specialized selections. */
const TYPE_BUTTONS = [
    { id: 'fire', label: 'Fire', icon: 'images/upgrades/ignition.png' },
    { id: 'ice', label: 'Ice', icon: 'images/upgrades/glaciation.png' },
    { id: 'poison', label: 'Poison', icon: 'images/upgrades/Intoxication.png' },
    { id: 'stone', label: 'Stone', icon: 'images/upgrades/petrification.png' }
];

/** The three Specialization buttons shown for non-specialized selections. */
const SPEC_BUTTONS = [
    { id: 'support', label: 'Support', icon: 'images/talents/supportSpec.png' },
    { id: 'fighter', label: 'Fighter', icon: 'images/talents/fighterSpec.png' },
    { id: 'tank', label: 'Tank', icon: 'images/talents/tankSpec.png' }
];

/** Talent display data, reused from the character-sheet Talent sheet. */
const TALENT_NAMES = { support: 'Graft', fighter: 'Rebound', tank: 'Block' };
const TALENT_DESCRIPTIONS = {
    support: 'Sacrifice 20% of HP to Heal twice that amount to a Slime in need (Can\'t target other Support Slimes).',
    fighter: '10% chance to re-jump on the second closest ennemy when dealing damage.',
    tank: '10% chance to ignore incoming damage.'
};
const TALENT_FLAG = { support: 'graft', fighter: 'rebound', tank: 'block' };

/**
 * The 12 possible element+specialization class combos, in display order. Each
 * Talent row shows the 3 Talent buttons for that combo (placeholder spec icon).
 */
const TALENT_COMBOS = [
    { element: 'fire',    spec: 'support', typeId: 'fireSupport' },
    { element: 'fire',    spec: 'fighter', typeId: 'fireFighter' },
    { element: 'fire',    spec: 'tank',    typeId: 'fireTank' },
    { element: 'ice',     spec: 'support', typeId: 'iceSupport' },
    { element: 'ice',     spec: 'fighter', typeId: 'iceFighter' },
    { element: 'ice',     spec: 'tank',    typeId: 'iceTank' },
    { element: 'poison',  spec: 'support', typeId: 'poisonSupport' },
    { element: 'poison',  spec: 'fighter', typeId: 'poisonFighter' },
    { element: 'poison',  spec: 'tank',    typeId: 'poisonTank' },
    { element: 'stone',   spec: 'support', typeId: 'stoneSupport' },
    { element: 'stone',   spec: 'fighter', typeId: 'stoneFighter' },
    { element: 'stone',   spec: 'tank',    typeId: 'stoneTank' }
];

/** Per Talent row: 3 talent buttons, each with 3 sub-talent buttons. */
const TALENT_VISIBLE = 3;
const SUBTALENTS_PER_TALENT = 3;
/** Per-talent coin price (first = 1, second = 2, third = 3). */
const TALENT_PRICE = [1, 2, 3];

/**
 * Build the single 4-column action grid for the Selected Slime area. Rows:
 *   0: 4 elemental Type buttons   (non-specialized selection)
 *   1: 3 Specialize buttons        (non-specialized selection)
 *   2-13: 12 Talent rows (one per element+spec combo) for specialized slimes.
 * Rows are shown/hidden per the current selection; non-matching rows get the
 * `hidden-row` class. The matching element Type button is marked "selected" only
 * when every selected Slime shares one element. The Spec row is disabled when any
 * selected Slime is Basic. Talent rows appear only when all selected Slimes share
 * the same exact type+specialization combo.
 */
function getActionButtonsHtml(selectedSlimes) {
    const anySpecialized = selectedSlimes.some(s => getSlimeSpecialization(s) !== '');
    const allSpecialized = selectedSlimes.length > 0 && selectedSlimes.every(s => getSlimeSpecialization(s) !== '');

    const elements = new Set(
        selectedSlimes.map(s => elementOf(s)).filter(el => el === 'fire' || el === 'ice' || el === 'poison' || el === 'stone')
    );
    const selectedType = (!anySpecialized && elements.size === 1) ? [...elements][0] : null;

    const hasBasic = selectedSlimes.some(s => elementOf(s) === '');
    const specDisabled = hasBasic ? ' disabled' : '';

    const sameType = selectedSlimes.length > 0 && selectedSlimes.every(s => (s.type || 'base') === (selectedSlimes[0].type || 'base'));
    const sameSpec = selectedSlimes.length > 0 && selectedSlimes.every(s => getSlimeSpecialization(s) === getSlimeSpecialization(selectedSlimes[0]));
    const activeCombo = (allSpecialized && sameType && sameSpec)
        ? `${elementOf(selectedSlimes[0])}${getSlimeSpecialization(selectedSlimes[0]).charAt(0).toUpperCase()}${getSlimeSpecialization(selectedSlimes[0]).slice(1)}`
        : null;

    const typeRowHidden = anySpecialized ? ' hidden-row' : '';
    const specRowHidden = anySpecialized ? ' hidden-row' : '';

    const typeRow = `
        <div class="common-house-grid-row common-house-type-row${typeRowHidden}" data-row="type">
            ${TYPE_BUTTONS.map(t => `
                <button type="button" class="common-house-type-btn${selectedType === t.id ? ' selected' : ''}" data-type="${t.id}" title="${t.label}" aria-label="${t.label}"><img src="${t.icon}" alt="${t.label}"></button>
            `).join('')}
        </div>
    `;

    const specRow = `
        <div class="common-house-grid-row common-house-spec-row${specRowHidden}" data-row="spec">
            ${SPEC_BUTTONS.map(s => `
                <button type="button" class="common-house-spec-btn" data-spec="${s.id}" title="${s.label}" aria-label="${s.label}"${specDisabled}><img src="${s.icon}" alt="${s.label}"></button>
            `).join('')}
        </div>
    `;

    const talentRows = TALENT_COMBOS.map(combo => {
        const spec = combo.spec;
        const specDef = SPEC_BUTTONS.find(s => s.id === spec) || SPEC_BUTTONS[0];
        const specLabel = specDef.label;
        const talentName = TALENT_NAMES[spec] || 'Talent';
        const talentDesc = TALENT_DESCRIPTIONS[spec] || '';
        const hidden = activeCombo === combo.typeId ? '' : ' hidden-row';
        const talentCols = Array.from({ length: TALENT_VISIBLE }, (_, t) => {
            // Main Talent icon: first Talent uses its dedicated file
            // (e.g. supportGraft.png); Talents 2/3 use ${spec}Talent${n}.png.
            const talentIcon = t === 0
                ? `images/talents/${spec}${talentName.toLowerCase()}.png`
                : (SECOND_TALENT_ICON[combo.typeId] || `images/talents/${spec}Talent${t + 1}.png`);
            const secondTalent = t === 1 ? SECOND_TALENT[combo.typeId] : null;
            const secondFlag = t === 1 ? getSecondTalentFlag(combo.typeId) : null;
            const talentLabel = t === 1 && secondTalent ? secondTalent.name : `${talentName} (Talent ${t + 1})`;
            const talentTooltip = t === 1 && secondTalent
                ? `${secondTalent.name}: ${secondTalent.description}`
                : `${talentName} (Talent ${t + 1}): ${talentDesc}`;

            // First Talent: show the cost (slimes still needing it) bottom-right,
            // or a ✔️ when every selected Slime already owns it (then unlocked+disabled).
            let talentBadge = '';
            let talentExtraClass = '';
            let talentDisabled = '';
            if (t === 0) {
                const ownedCount = selectedSlimes.filter(hasFirstTalent).length;
                const cost = (selectedSlimes.length - ownedCount) * TALENT_PRICE[t];
                if (cost === 0) {
                    talentBadge = '✔️';
                    talentExtraClass = ' unlocked';
                    talentDisabled = ' disabled';
                } else {
                    talentBadge = `${cost}<img src="images/logos/coin.png" alt="" class="talent-cost-coin">`;
                }
            } else if (t === 1 && secondFlag) {
                // Second Talent: purchasable for every selected Slime that already
                // owns the combo's first Talent. The button enables as long as at
                // least one selected Slime qualifies (mass-buy applies per Slime).
                const ownedCount = secondFlag ? selectedSlimes.filter(s => s.talents?.[secondFlag]).length : 0;
                const firstOwnedSome = selectedSlimes.some(s => hasFirstTalent(s));
                const eligible = selectedSlimes.filter(s => hasFirstTalent(s) && !s.talents?.[secondFlag]).length;
                const cost = eligible * TALENT_PRICE[t];
                if (ownedCount === selectedSlimes.length) {
                    talentBadge = '✔️';
                    talentExtraClass = ' unlocked';
                    talentDisabled = ' disabled';
                } else if (firstOwnedSome) {
                    talentBadge = `${cost}<img src="images/logos/coin.png" alt="" class="talent-cost-coin">`;
                } else {
                    talentBadge = '🔒';
                    talentExtraClass = ' locked';
                    talentDisabled = ' disabled';
                }
            } else {
                // Talent 3 is not implemented yet: lock the button and its sub-talents.
                talentExtraClass = ' locked';
                talentDisabled = ' disabled';
                talentBadge = '🔒';
            }

            const subDisabled = t === 0 ? '' : ' disabled';
            // A sub-talent is "selected" only when every selected Slime already
            // has the same one enabled (otherwise none are highlighted).
            const sharedSub = (() => {
                if (t !== 0 || !selectedSlimes.length) return null;
                const first = getSlimeSubTalent(selectedSlimes[0], t);
                const allSame = selectedSlimes.every(s => getSlimeSubTalent(s, t) === first);
                return allSame ? first : null;
            })();
            // Sub-talent icon: Talent 1 & 3 use the shared per-spec sprite
            // (support/tank/fighterSubtalents.png); Talent 2 uses the unique
            // per-type sprite (e.g. supportFireSubtalents.png) keyed on element.
            const elementCap = selectedSlimes.length
                ? elementOf(selectedSlimes[0]).charAt(0).toUpperCase() + elementOf(selectedSlimes[0]).slice(1)
                : '';
            const subtalentIcon = t === 1 && elementCap
                ? `images/talents/subtalents/${spec}${elementCap}Subtalents.png`
                : `images/talents/subtalents/${spec}Subtalents.png`;
            const subtalents = Array.from({ length: SUBTALENTS_PER_TALENT }, (_, s) => {
                const subDef = TALENT_SUBTALENTS[spec]?.[t]?.[s];
                const subTitle = subDef ? `${subDef.name}: ${subDef.description}` : `${talentName} Sub-talent ${t + 1}.${s + 1}`;
                const subSelected = sharedSub === s ? ' selected' : '';
                return `
                    <button type="button" class="common-house-subtalent-btn${subSelected}" data-talent="${t}" data-subtalent="${s}" data-combo="${combo.typeId}" title="${subTitle}" aria-label="${subTitle}" tabindex="-1"${subDisabled}><img src="${subtalentIcon}" alt="${specLabel}"></button>
                `;
            }).join('');
            const glassTooltip = (t === 1 && secondTalent)
                ? { name: secondTalent.name, description: secondTalent.description }
                : (t === 0 && talentDesc ? { name: talentName, description: talentDesc } : null);
            const talentButtonHtml = `<button type="button" class="common-house-talent-btn${talentExtraClass}" data-talent="${t}" data-combo="${combo.typeId}" title="${glassTooltip ? '' : talentTooltip}" aria-label="${talentTooltip}"${talentDisabled}><img src="${talentIcon}" alt="${talentLabel}"><span class="common-house-talent-cost">${talentBadge}</span></button>`;
            const talentButtonWrapped = glassTooltip
                ? `<span class="talent-tooltip-glass">${talentButtonHtml}<span class="talent-tooltip-glass-box"><strong>${glassTooltip.name}</strong><br>${glassTooltip.description}</span></span>`
                : talentButtonHtml;
            return `
                <div class="common-house-talent-col">
                    ${talentButtonWrapped}
                    <div class="common-house-subtalent-row">${subtalents}</div>
                </div>
            `;
        }).join('');
        return `
            <div class="common-house-grid-row common-house-talent-row${hidden}" data-row="talent" data-combo="${combo.typeId}">
                ${talentCols}
            </div>
        `;
    }).join('');

    return `
        <div class="common-house-action-buttons">
            ${typeRow}
            ${specRow}
            ${talentRows}
        </div>
    `;
}

/**
 * Wire the elemental Type buttons so clicking one re-types every selected
 * (non-specialized) Slime to that element. Only basic/elemental types are
 * reassigned — a Slime already specialized keeps its current type.
 */
function wireTypeButtons(container) {
    const buttons = container.querySelectorAll('.common-house-type-btn');
    if (!buttons.length) return;
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newElement = btn.dataset.type;
            const selectedSlimes = getSelectedSlimes();
            if (!selectedSlimes.length || !newElement) return;

            selectedSlimes.forEach(slime => {
                // Never re-type a specialized Slime.
                if (getSlimeSpecialization(slime) !== '') return;
                if (elementOf(slime) === newElement) return;
                const typeId = newElement === '' ? 'base' : newElement;
                if (SLIME_TYPES[typeId]) {
                    slime.type = typeId;
                    slime.specialization = '';
                }
            });

            saveStateToLocal();
            updateUI();
            renderCommonHouse();
        });
    });

    const specButtons = container.querySelectorAll('.common-house-spec-btn:not([disabled])');
    specButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newSpec = btn.dataset.spec;
            const selectedSlimes = getSelectedSlimes();
            if (!selectedSlimes.length || !newSpec) return;

            selectedSlimes.forEach(slime => {
                // Only typed (non-basic, non-specialized) Slimes can specialize.
                if (getSlimeSpecialization(slime) !== '') return;
                const element = elementOf(slime);
                if (!element) return;
                const typeId = `${element}${newSpec.charAt(0).toUpperCase()}${newSpec.slice(1)}`;
                if (SLIME_TYPES[typeId]) {
                    slime.type = typeId;
                    slime.specialization = newSpec;
                }
            });

            sortRosterBySpecialization();
            updateBestRoster();
            saveStateToLocal();
            updateUI();
            renderCommonHouse();
        });
    });

    const talentButtons = container.querySelectorAll('.common-house-talent-btn:not([disabled])');
    talentButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const talentIndex = Number(btn.dataset.talent);
            // Only the first and second Talents are purchasable (mass-buy for the whole selection).
            if (talentIndex !== 0 && talentIndex !== 1) return;
            const selectedSlimes = getSelectedSlimes();
            if (!selectedSlimes.length) return;
            const spec = getSlimeSpecialization(selectedSlimes[0]);
            const comboTypeId = `${elementOf(selectedSlimes[0])}${spec.charAt(0).toUpperCase()}${spec.slice(1)}`;
            const flag = talentIndex === 0 ? TALENT_FLAG[spec] : getSecondTalentFlag(comboTypeId);
            if (!flag) return;
            // First Talent: grant to every selected Slime lacking it, charging the
            // village coin pool per Slime (1/2/3 by tier).
            // Second Talent: only grant to selected Slimes that already own the first
            // Talent (never bypass the prerequisite); charge per eligible Slime.
            if (talentIndex === 1) {
                const eligible = selectedSlimes.filter(s => hasFirstTalent(s) && !s.talents?.[flag]);
                if (!eligible.length) return;
                const totalCost = eligible.length * TALENT_PRICE[talentIndex];
                if ((gameState.villageCoins || 0) < totalCost) return;
                gameState.villageCoins -= totalCost;
                eligible.forEach(slime => {
                    if (!slime.talents || typeof slime.talents !== 'object') slime.talents = {};
                    slime.talents[flag] = true;
                });
            } else {
                const needy = selectedSlimes.filter(s => !s.talents?.[flag]);
                if (!needy.length) return;
                const totalCost = needy.length * TALENT_PRICE[talentIndex];
                if ((gameState.villageCoins || 0) < totalCost) return;
                gameState.villageCoins -= totalCost;
                needy.forEach(slime => {
                    if (!slime.talents || typeof slime.talents !== 'object') slime.talents = {};
                    slime.talents[flag] = true;
                });
            }
            updateBestRoster();
            saveStateToLocal();
            updateUI();
            renderCommonHouse();
        });
    });

    const subtalentButtons = container.querySelectorAll('.common-house-subtalent-btn:not([disabled])');
    subtalentButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const talentIndex = Number(btn.dataset.talent);
            if (talentIndex !== 0) return;
            const subIndex = Number(btn.dataset.subtalent);
            const selectedSlimes = getSelectedSlimes();
            if (!selectedSlimes.length) return;
            // Enable this sub-talent for every selected Slime (toggle off if all already have it).
            const allHave = selectedSlimes.every(s => getSlimeSubTalent(s, talentIndex) === subIndex);
            selectedSlimes.forEach(slime => {
                const subTalents = ensureSlimeSubTalents(slime);
                subTalents[talentIndex] = allHave ? null : subIndex;
                recalculateSlimeStats(slime);
            });
            updateBestRoster();
            saveStateToLocal();
            updateUI();
            renderCommonHouse();
        });
    });
}

/**
 * Render the shared stats card for the selected slime(s).
 * With a single selection it shows that Slime's portrait, specialization and
 * type. With multiple selections it swaps the portrait for the army icon and
 * lists grouped "Element Specialization xN" counts (e.g. "Fire Support x3").
 */
function renderSelectedSlimeCard() {
    const container = document.getElementById('chSelectedSlimeCard');
    if (!container) return;

    const selectedSlimes = getSelectedSlimes();
    if (selectedSlimes.length === 0) {
        container.innerHTML = `
            <div class="slime-modal-portrait-wrapper common-house-portrait-wrapper common-house-portrait-empty"></div>
            <div class="common-house-slime-info">
                <p class="shop-empty-text">Select a slime to view its stats.</p>
            </div>
        `;
        return;
    }

    const actionButtonsHtml = getActionButtonsHtml(selectedSlimes);

    if (selectedSlimes.length === 1) {
        const slime = selectedSlimes[0];
        const specialization = String(
            slime.specialization || SLIME_TYPES[slime.type]?.specialization || 'base'
        ).toLowerCase();
        const specLabel = specialization.charAt(0).toUpperCase() + specialization.slice(1);
        const typeName = (SLIME_TYPES[slime.type] || SLIME_TYPES.base).name || slime.type || 'Slime';
        const roster = selectedSide === 'main' ? gameState.slimes : gameState.villageRoster;
        // The Main roster must always keep at least one Slime; the Village roster
        // can be emptied entirely.
        const canSacrifice = selectedSide === 'village' ? (roster || []).length > 0 : (roster || []).length > 1;

        container.innerHTML = `
            <button type="button" class="modal-kill-btn common-house-kill-btn${canSacrifice ? '' : ' disabled'}" title="${canSacrifice ? 'Sacrifice / Kill Slime' : 'Cannot sacrifice the last remaining slime!'}"${canSacrifice ? '' : ' disabled'}>💀</button>
            <div class="slime-modal-portrait-wrapper common-house-portrait-wrapper">
                <img src="${getSlimeJumpSprite(slime)}" class="slime-modal-portrait common-house-portrait"
                    alt="${slime.name}" style="object-position: 0px 0px;">
            </div>
            <div class="common-house-slime-info">
                <div class="common-house-slime-name">${slime.name}</div>
                <div class="common-house-slime-stat"><span class="ch-stat-label">Specialization:</span> ${specLabel}</div>
                <div class="common-house-slime-stat"><span class="ch-stat-label">Type:</span> ${typeName}</div>
            </div>
            <div class="common-house-action-buttons">
                ${actionButtonsHtml}
            </div>
        `;

        const killBtn = container.querySelector('.common-house-kill-btn');
        if (killBtn && canSacrifice) {
            killBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmSacrificeSlime(slime);
            });
        }
        wireTypeButtons(container);
        return;
    }

    // Multiple selection: army icon + grouped "Element Specialization xN" counts.
    const counts = new Map();
    selectedSlimes.forEach(slime => {
        const label = slimeGroupLabel(slime);
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    const lines = [...counts.entries()].map(([label, n]) => `${label} x${n}`);

    const roster = selectedSide === 'main' ? gameState.slimes : gameState.villageRoster;
    // The Main roster must keep at least one Slime; the Village roster can be fully emptied.
    const canSacrifice = selectedSide === 'village'
        ? (roster || []).length >= selectedSlimes.length && selectedSlimes.length > 0
        : (roster || []).length > selectedSlimes.length;

    container.innerHTML = `
        <button type="button" class="modal-kill-btn common-house-kill-btn${canSacrifice ? '' : ' disabled'}" title="${canSacrifice ? `Sacrifice / Kill ${selectedSlimes.length} Slimes` : 'Cannot sacrifice the last remaining slime!'}"${canSacrifice ? '' : ' disabled'}>💀</button>
        <div class="slime-modal-portrait-wrapper common-house-portrait-wrapper">
            <img src="images/slimes/army.png" class="slime-modal-portrait common-house-portrait" alt="Army">
        </div>
        <div class="common-house-slime-info">
            <div class="common-house-slime-name">Selected (${selectedSlimes.length})</div>
            ${lines.map(line => `<div class="common-house-slime-stat">${line}</div>`).join('')}
        </div>
        <div class="common-house-action-buttons">
            ${actionButtonsHtml}
        </div>
    `;

    const killBtn = container.querySelector('.common-house-kill-btn');
    if (killBtn && canSacrifice) {
        killBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmSacrificeSlime(selectedSlimes);
        });
    }
    wireTypeButtons(container);
}

/**
 * Remove one or more Slimes from whichever roster they belong to (Main or
 * Village), plus the historical best roster. Mirrors the character-sheet
 * Sacrifice but scoped to the active Common House roster side. Refuses to empty
 * a roster completely (keeps at least one Slime).
 */
function sacrificeSlimeFromRoster(slimes) {
    const list = Array.isArray(slimes) ? slimes : [slimes];
    if (list.length === 0) return false;

    const roster = selectedSide === 'main' ? gameState.slimes : gameState.villageRoster;
    // The Main roster must always keep at least one Slime; the Village roster may
    // be emptied entirely.
    if (!Array.isArray(roster)) return false;
    if (selectedSide === 'main' && roster.length <= list.length) return false;
    if (selectedSide === 'village' && list.length === 0) return false;

    const removeIds = new Set(list.map(s => s.id || s.name).filter(Boolean));
    // Send each sacrificed Slime's equipment to the Village Forge Inventory first.
    if (!Array.isArray(gameState.villageInventory)) gameState.villageInventory = [];
    list.forEach(slime => {
        (slime.equipment || []).forEach(item => {
            gameState.villageInventory.push({ id: item.id, quality: getEquipmentQuality(item) });
        });
    });
    gameState[selectedSide === 'main' ? 'slimes' : 'villageRoster'] =
        roster.filter(s => !removeIds.has(s.id || s.name));
    if (gameState.bestRoster) {
        gameState.bestRoster = gameState.bestRoster.filter(b => !removeIds.has(b.id || b.name));
    }

    if (selectedSide === 'main') gameState.armySize = gameState.slimes.length;
    saveStateToLocal();
    updateUI();

    // Drop the sacrificed slimes from the active selection.
    removeIds.forEach(id => selectedIds.delete(id));
    if (primarySlimeId && removeIds.has(primarySlimeId)) {
        primarySlimeId = selectedIds.size ? selectedIds.values().next().value : null;
    }
    if (selectedIds.size === 0) selectedSide = null;
    return true;
}

/**
 * Show a self-contained confirmation modal (scoped to the Common House popup) and,
 * on confirm, sacrifice the selected Slime(s) from their roster.
 */
function confirmSacrificeSlime(slimes) {
    const list = Array.isArray(slimes) ? slimes : [slimes];
    const popup = document.querySelector('#commonHousePopup .common-house-popup') || document.getElementById('commonHousePopup');
    if (!popup) return;

    const count = list.length;
    const subject = count === 1 ? `<strong>${list[0].name}</strong>` : `<strong>${count} Slimes</strong>`;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop common-house-sacrifice-confirm';
    backdrop.innerHTML = `
        <div class="slime-confirm-modal">
            <h3>💀 Sacrifice ${count === 1 ? 'Slime' : 'Slimes'}?</h3>
            <p class="confirm-modal-text">Are you sure you want to sacrifice ${subject}? This cannot be undone.</p>
            <div class="confirm-modal-actions">
                <button class="btn-confirm-cancel">Cancel</button>
                <button class="btn-confirm-danger">💀 Kill Slime${count === 1 ? '' : 's'}</button>
            </div>
        </div>
    `;
    popup.appendChild(backdrop);

    backdrop.querySelector('.btn-confirm-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('.btn-confirm-danger').addEventListener('click', () => {
        sacrificeSlimeFromRoster(list);
        backdrop.remove();
        renderCommonHouse();
    });
}
