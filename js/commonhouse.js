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

import { gameState, SLIME_TYPES, getSlimeJumpSprite, getSlimeSpecialization, calculateSlimeDamage, getBaseCritChance, generateUniqueSlimeName, getNextAvailableSlotIndex, saveStateToLocal, updateBestRoster, getEquipmentQuality } from './state.js';
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
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllSupport" title="VillageRosterSelectAllSupport" aria-label="Select all Support"><img class="ch-logo-icon" src="images/logos/support.png" alt="Support"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllFighter" title="VillageRosterSelectAllFighter" aria-label="Select all Fighter"><img class="ch-logo-icon" src="images/logos/fighter.png" alt="Fighter"></button>
                        <button type="button" class="common-house-toolbar-btn" data-action="VillageRosterSelectAllTank" title="VillageRosterSelectAllTank" aria-label="Select all Tank"><img class="ch-logo-icon" src="images/logos/tank.png" alt="Tank"></button>
                        <span class="common-house-toolbar-spacer"></span>
                        <button type="button" class="common-house-toolbar-btn common-house-create-btn" data-action="VillageRosterCreate" title="Create a Basic Slime" aria-label="Create a Basic Slime"><img class="ch-slime-icon" src="images/slimes/createSlime.png" alt="Create"></button>
                    </div>
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

/**
 * Build the row of elemental Type buttons for the Selected Slime area.
 * - Hidden entirely if ANY selected Slime is specialized.
 * - Otherwise shown for the non-specialized selection; the matching element button
 *   is marked "selected" only when every selected Slime shares that single element
 *   (otherwise none are selected, e.g. multiple types or Basic slimes).
 */
function getTypeButtonsHtml(selectedSlimes) {
    const anySpecialized = selectedSlimes.some(s => getSlimeSpecialization(s) !== '');
    if (anySpecialized) return '';

    const elements = new Set(
        selectedSlimes
            .map(s => elementOf(s))
            .filter(el => el === 'fire' || el === 'ice' || el === 'poison' || el === 'stone')
    );
    const selectedType = elements.size === 1 ? [...elements][0] : null;

    return `
        <div class="common-house-type-buttons">
            ${TYPE_BUTTONS.map(t => `
                <button type="button" class="common-house-type-btn${selectedType === t.id ? ' selected' : ''}" data-type="${t.id}" title="${t.label}" aria-label="${t.label}"><img src="${t.icon}" alt="${t.label}"></button>
            `).join('')}
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

    const typeButtonsHtml = getTypeButtonsHtml(selectedSlimes);

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
            ${typeButtonsHtml}
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
        ${typeButtonsHtml}
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
