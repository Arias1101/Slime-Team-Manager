/**
 * User Interface & Authentication Screen Renderer
 */

import { gameState, SLIME_TYPES, killSlime, syncSlimesArray, rerollSlimeType, calculateSlimeDamage, getScaledEquipmentEffects, getEquipmentDisplayName, getEquipmentSprite, saveStateToLocal, getSlimeHitEffects, getEquipmentQuality, getSlimeTotalRegen, sortRosterBySpecialization, updateBestRoster, getSlimeJumpSprite, canSlimeBuyNextTalent, TALENT_SUBTALENTS, SECOND_TALENT, SECOND_TALENT_ICON, getSecondTalentFlag, hasSecondTalent, ensureSlimeSubTalents, getSlimeSubTalent, getSlimeSubTalentColumn, recalculateSlimeStats, getThirdTalentDef } from './state.js';
import { updateUpgradesUI } from './upgrades.js';
import { activeGroundLoots, formatLootEffects } from './enemies.js';
import { setGamePaused, isGamePaused } from './engine.js';
import { checkAchievements, renderAchievementsPanel, triggerElementAchievement } from './achievements.js';

const scrapsCountEl = document.getElementById('scrapsCount');
const scoreCountEl = document.getElementById('scoreCount');
const waveCountEl = document.getElementById('waveCount');
const armySizeCountEl = document.getElementById('armySizeCount');
const armyContainerEl = document.getElementById('armyContainer');
const authGateEl = document.getElementById('authGate');
const gameScreenEl = document.getElementById('gameScreen');
const firebaseNoticeEl = document.getElementById('firebaseNotice');

// Primary Slime Image path
const SLIME_IMG_SRC = 'images/slimes/base/jump.png';
const SLIME_FALLBACK_SRC = 'images/slimes/army.png';

let lastRenderedArmySize = -1;
let lastArmyTypeSig = '';
/** Signature of every Slime's id+type+specialization, used to detect when the
 *  army's composition (not just its size) changed and needs a re-render. */
function armyTypeSignature() {
    return (gameState.slimes || []).map(s => `${s.id}|${s.type}|${s.specialization || ''}`).join(',');
}
let currentInspectedSlime = null;
let activeSlimeSheetTab = 'stats';
let isRainAnimating = false;

/**
 * Show the decorative village fountain (4-frame sprite loop) only while the
 * player is in the village intermission; hide it once a run starts.
 */
function updateVillageFountain() {
    const fountainEl = document.getElementById('villageFountain');
    if (!fountainEl) return;
    const inVillage = gameState.isInNewGamePlus === true;
    fountainEl.classList.toggle('hidden', !inVillage);
}

/**
 * Main UI Update Function
 */
export function updateUI() {
    updateVillageFountain();
    if (scrapsCountEl) scrapsCountEl.textContent = gameState.scraps || 0;
    if (scoreCountEl) scoreCountEl.textContent = gameState.score || 0;
    if (waveCountEl) waveCountEl.textContent = gameState.currentWave || 1;
    if (armySizeCountEl) armySizeCountEl.textContent = gameState.armySize || 0;
    const villageCoinsStatEl = document.getElementById('villageCoinsStat');
    const villageCoinsCountEl = document.getElementById('villageCoinsCount');
    const hasEndedGame = (gameState.newGamePlusCompletions || 0) > 0;
    if (villageCoinsStatEl) villageCoinsStatEl.classList.toggle('hidden', !hasEndedGame);
    if (villageCoinsCountEl) villageCoinsCountEl.textContent = gameState.villageCoins || 0;

    const newGamePlusStatEl = document.getElementById('newGamePlusStat');
    const newGamePlusCountEl = document.getElementById('newGamePlusCount');
    if (newGamePlusStatEl) newGamePlusStatEl.classList.toggle('hidden', !hasEndedGame);
    if (newGamePlusCountEl) newGamePlusCountEl.textContent = `+${gameState.newGamePlusCompletions || 0}`;

    checkAchievements();
    renderAchievementsPanel();

    const enemyBadgeEl = document.getElementById('enemyBadge');
    if (enemyBadgeEl) {
        const wave = gameState.currentWave || 1;
        if (wave <= 10) {
            enemyBadgeEl.textContent = '🌾 Villagers';
        } else if (wave <= 20) {
            enemyBadgeEl.textContent = '🧭️ Adventurers';
        } else if (wave <= 30) {
            enemyBadgeEl.textContent = '⚔️ Soldiers';
        } else if (wave <= 40) {
            enemyBadgeEl.textContent = '🌱 Sylvans';
        } else if (wave <= 50) {
            enemyBadgeEl.textContent = '🧟 Undeads';
        } else {
            enemyBadgeEl.textContent = '💀 Death';
        }
    }

    // Update Eat Button loot count & responsive states
    const eatBtnEl = document.getElementById('btnEat');
    let eatLootCountEl = document.getElementById('eatLootCount');
    if (eatBtnEl && gameState.isInNewGamePlus) {
        eatBtnEl.textContent = 'Start Run';
        eatBtnEl.classList.add('village-start-action');
        eatBtnEl.classList.remove('state-empty', 'state-moderate', 'state-abundant', 'pulse-eat-btn');
        eatBtnEl.removeAttribute('disabled');
    } else if (eatBtnEl) {
        if (!eatLootCountEl) {
            eatBtnEl.innerHTML = `<img class="eat-icon" src="images/logos/scrap.png" alt=""> Eat (<span id="eatLootCount">0</span>)`;
            eatLootCountEl = document.getElementById('eatLootCount');
        }
        eatBtnEl.classList.remove('village-start-action');
        if (!eatLootCountEl) return;
        const lootCount = activeGroundLoots ? activeGroundLoots.length : 0;
        eatLootCountEl.textContent = lootCount;

        eatBtnEl.classList.remove('state-empty', 'state-moderate', 'state-abundant', 'pulse-eat-btn');

        if (lootCount === 0 || isGamePaused) {
            eatBtnEl.classList.add('state-empty');
            eatBtnEl.setAttribute('disabled', 'disabled');
        } else {
            eatBtnEl.removeAttribute('disabled');
            if (lootCount >= 1 && lootCount <= 9) {
                eatBtnEl.classList.add('state-moderate');
            } else {
                eatBtnEl.classList.add('state-abundant');
                eatBtnEl.classList.add('pulse-eat-btn');
            }
        }
    }

    const btnRewindWave = document.getElementById('btnRewindWave');
    if (btnRewindWave) {
        if ((gameState.currentWave || 1) <= 1) {
            btnRewindWave.setAttribute('disabled', 'disabled');
            btnRewindWave.classList.add('disabled');
        } else {
            btnRewindWave.removeAttribute('disabled');
            btnRewindWave.classList.remove('disabled');
        }
    }

    const btnForwardWave = document.getElementById('btnForwardWave');
    if (btnForwardWave) {
        if ((gameState.currentWave || 1) >= 51) {
            btnForwardWave.setAttribute('disabled', 'disabled');
            btnForwardWave.classList.add('disabled');
        } else {
            btnForwardWave.removeAttribute('disabled');
            btnForwardWave.classList.remove('disabled');
        }
    }

    if (!armyContainerEl || armyContainerEl.children.length === 0 || lastRenderedArmySize !== gameState.armySize || armyTypeSignature() !== lastArmyTypeSig) {
        lastRenderedArmySize = gameState.armySize;
        lastArmyTypeSig = armyTypeSignature();
        renderSlimeArmy();
    }

    // Keep an open Slime Inspector's Talent tree in sync with state changes made
    // elsewhere (e.g. specializing / buying Talents / picking sub-talents from the
    // Common House). Without this the sheet's sub-talents stay stale until a full
    // page reload.
    if (currentInspectedSlime && !document.getElementById('slimeModalBackdrop')?.classList.contains('hidden')) {
        const liveSlime = (gameState.slimes || []).find(s => s.id === currentInspectedSlime.id || s.name === currentInspectedSlime.name)
            || (gameState.villageRoster || []).find(s => s.id === currentInspectedSlime.id || s.name === currentInspectedSlime.name)
            || (gameState.bestRoster || []).find(s => s.id === currentInspectedSlime.id || s.name === currentInspectedSlime.name);
        if (liveSlime) {
            currentInspectedSlime = liveSlime;
            renderSlimeTalentTree(liveSlime);
        }
    }

    updateSlimeRoster();
    updateUpgradesUI();
}

let uiRefreshScheduled = false;

/**
 * Batch a full UI refresh onto the next animation frame. Multiple calls within
 * the same frame (e.g. many loot drops/eats at once) collapse into a single
 * updateUI(), avoiding the layout/reflow cost of rebuilding the roster and the
 * upgrades panel for every single loot.
 */
export function requestUIRefresh() {
    if (uiRefreshScheduled) return;
    uiRefreshScheduled = true;
    requestAnimationFrame(() => {
        uiRefreshScheduled = false;
        updateUI();
    });
}

/**
 * Lightweight, immediate update of the counters that change on every loot
 * (scraps, score, and the Eat button count). This avoids the expensive full
 * UI rebuild in the per-loot hot path.
 */
export function updateLootHUD() {
    if (scrapsCountEl) scrapsCountEl.textContent = gameState.scraps || 0;
    if (scoreCountEl) scoreCountEl.textContent = gameState.score || 0;

    const eatBtnEl = document.getElementById('btnEat');
    if (eatBtnEl && !gameState.isInNewGamePlus) {
        const eatLootCountEl = document.getElementById('eatLootCount');
        if (eatLootCountEl) {
            eatLootCountEl.textContent = activeGroundLoots ? activeGroundLoots.length : 0;
        }
    }
}

/**
 * Shared roster renderer: lays out slimes into three responsive lanes
 * (back / middle / front) inside the given container. Entries may carry
 * `{ slime, dead: true }` to render a fallen-slot placeholder instead.
 * Returns the lane elements.
 */
export function renderSlimeRosterLanes(container, entries, {
    itemClassName = '',
    extraClassFor = null,
    titleFor = null,
    dataAttrsFor = null,
    onItemClick = null,
    byLine = false
} = {}) {
    if (!container) return;

    const allEntries = entries || [];

    // Build a single flat, display-ordered array: slimes are grouped by
    // specialization, then interleaved line-by-line so every visual line holds
    // a balanced mix (e.g. 1 support + 9 fighters on line 1, 10 fighters on line
    // 2) instead of three rigid columns with gaps. The stored roster order is
    // never mutated — only the rendered sequence is derived here.
    const groups = { support: [], fighter: [], tank: [], basic: [] };
    allEntries.forEach(entry => {
        const slime = entry.slime || entry;
        const specialization = String(slime?.specialization || SLIME_TYPES[slime?.type]?.specialization || '').toLowerCase();
        const key = ['support', 'fighter', 'tank'].includes(specialization) ? specialization : 'basic';
        groups[key].push(entry);
    });
    const groupOrder = ['support', 'fighter', 'tank', 'basic'];

    container.replaceChildren();

    const renderWith = (capacity) => {
        container.replaceChildren();
        const ordered = interleaveGroups(groups, groupOrder, capacity);
        ordered.forEach(entry => container.appendChild(buildRosterItem(entry, { itemClassName, extraClassFor, titleFor, dataAttrsFor, onItemClick })));
    };

    const renderLines = (capacity) => {
        container.replaceChildren();
        const lines = interleaveGroupsToLines(groups, groupOrder, capacity);
        lines.forEach(lineEntries => {
            const line = document.createElement('div');
            line.className = 'roster-line';
            lineEntries.forEach(entry => line.appendChild(buildRosterItem(entry, { itemClassName, extraClassFor, titleFor, dataAttrsFor, onItemClick })));
            container.appendChild(line);
        });
    };

    if (byLine) {
        // Wrap each visual line in a centered flex row so rows stay aligned and
        // the (possibly short) last line is centered like the others. Capacity is
        // measured from the container's real width, which isn't settled yet on the
        // first synchronous render (panel not laid out, or still hidden behind the
        // auth screen). Recompute the line grouping repeatedly until the container
        // reports a stable, non-zero width, then keep observing its size so the
        // layout self-corrects the instant it is revealed or resized — no manual
        // page resize required.
        let lastCapacity = -1;
        const draw = () => {
            const capacity = computeRosterCapacity(container);
            // A 0 capacity means the panel isn't laid out yet (zero width while
            // still hidden). Defer rather than collapsing the roster into single
            // items per line.
            if (capacity <= 0) return;
            if (capacity === lastCapacity) return;
            lastCapacity = capacity;
            renderLines(capacity);
        };
        draw();
        requestAnimationFrame(() => requestAnimationFrame(draw));
        trackRosterForResize(container, draw);
    } else {
        renderWith(computeRosterCapacity(container));
    }

    return container;
}

/**
 * Compute how many slimes fit on one visual line inside `container`, from its
 * real rendered (inner) width. N items need N*itemW + (N-1)*gap, so the max N
 * is floor((innerWidth + gap) / (itemW + gap)). The container's horizontal
 * padding is subtracted first so we never pack more slimes than the visible
 * area can hold (which previously let a line overflow to 11 when only 10 fit).
 * Clamped to a sane minimum so narrow panels still wrap cleanly.
 */
function computeRosterCapacity(container) {
    // Measure a single roster item's real rendered width from a DETACHED probe,
    // not from `container.querySelector('.roster-grid-item')`. The renderer calls
    // computeRosterCapacity() right after container.replaceChildren() has emptied
    // the container, so the live-query fallback (a hard-coded 27) measured a
    // DIFFERENT width than the real items (33px at >=1260px, etc.). That mismatch
    // made the first draw() compute a larger capacity (e.g. 34) than every
    // subsequent measure (30), flipping the layout on every rebuild -> the
    // "roster glitches while fighting" bug. We now measure the item width from a
    // probe placed INSIDE the container (so it inherits the same scoped +
    // media-query rules as the live items, e.g. 33px at >=1260px) rather than a
    // detached <body> probe that would miss those rules and under-report the
    // width (causing capacity to be off by one and overflow).
    const itemW = measureRosterItemWidth(container);
    const gap = 4; // matches --roster-spec-gap
    const cs = getComputedStyle(container);
    // clientWidth is the padding-box width: it INCLUDES padding but EXCLUDES the
    // border and any reserved scrollbar gutter (scrollbar-gutter: stable). So the
    // true content area where items sit is clientWidth minus the horizontal
    // padding.
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const measuredInner = container.clientWidth - padX;
    // While the panel is still hidden or not laid out, clientWidth is 0; falling
    // back to 1 here would permanently collapse the roster into one-per-line.
    // Instead return 0 as a sentinel so callers (and the ResizeObserver) can
    // defer the real measurement until the panel has a proper width.
    if (measuredInner <= 0) return 0;
    const innerWidth = measuredInner;
    if (innerWidth < itemW) return 1;
    // N items need N*itemW + (N-1)*gap <= innerWidth, so the max N is
    // floor((innerWidth - itemW)/(itemW+gap)) + 1.
    const capacity = Math.max(1, Math.floor((innerWidth - itemW) / (itemW + gap)) + 1);
    return capacity;
}

// Measure a real roster item's width from WITHIN the actual container, so it
// inherits the same scoped + media-query styles (e.g. .desktop-left-col
// .roster-grid-item { width: 33px } at >=1260px) as the live items. A detached
// probe appended to <body> would NOT pick up those descendant/media-query rules
// and would return the wrong width, causing capacity to be off by one (overflow).
// If the container already has a rendered item we read it directly; otherwise we
// drop in a hidden probe, measure, then remove it.
function measureRosterItemWidth(container) {
    const existing = container.querySelector('.roster-grid-item');
    if (existing) return existing.offsetWidth || 27;
    const probe = document.createElement('div');
    probe.className = 'roster-grid-item';
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.pointerEvents = 'none';
    container.appendChild(probe);
    const w = probe.offsetWidth || 27;
    container.removeChild(probe);
    return w;
}

/**
 * Distribute grouped entries into `lines` balanced rows. Each group is spread
 * as evenly as possible across the lines: every line (except the last, when the
 * count isn't a multiple of the line count) receives the same number of that
 * group, and any remainder is spilled onto the first `count % lines` lines.
 *
 * For example, 29 tanks across 3 lines → 10, 10, 9. The returned array holds one
 * entry-array per line; groups are concatenated within each line in `groupOrder`
 * (support → fighter → tank → basic), so every line reads the same way. This is
 * fully deterministic — adding or removing slimes only changes the counts, never
 * the layout logic, so groups never "jump" sides between renders.
 */
function interleaveGroupsToLines(groups, groupOrder, capacity) {
    const counts = groupOrder.map(key => ({ key, list: groups[key] || [], i: 0 })).filter(g => g.list.length > 0);
    const total = counts.reduce((s, g) => s + g.list.length, 0);
    if (total === 0) return [];
    const lines = Math.max(1, Math.ceil(total / capacity));

    // Fill each line up to `capacity`, pulling the next items from each group in
    // groupOrder (support -> fighter -> tank -> basic). Capping every line at
    // Each line shows the lanes in order (support = back, fighter = mid, tank =
    // front): a support block, then a fighter block, then a tank block. Within a
    // line we take a BALANCED share from each lane — ceil(remainingInLane /
    // remainingLines) — so every line carries the same proportion of each lane
    // (your original "15 supports / 10 fighters / 5 tanks per line" spec), and
    // the per-line total is capped at `capacity` so it can never overflow (the
    // old even-split overflowed when several lanes' remainders landed on the same
    // first lines).
    const result = [];
    for (let l = 0; l < lines; l++) {
        const remainingLines = lines - l;
        const line = [];
        let slotsLeft = capacity;
        for (const key of groupOrder) {
            const g = counts.find(c => c.key === key);
            if (!g || slotsLeft <= 0 || g.i >= g.list.length) continue;
            const take = Math.min(slotsLeft, Math.ceil((g.list.length - g.i) / remainingLines));
            for (let n = 0; n < take; n++) line.push(g.list[g.i++]);
            slotsLeft -= take;
        }
        result.push(line);
    }
    return result;
}

/** Flat variant (no line wrappers): concatenate every line in order. */
function interleaveGroups(groups, groupOrder, capacity) {
    return interleaveGroupsToLines(groups, groupOrder, capacity).flat();
}

/** Build one roster DOM item (live slime or dead/RIP slot). */
function buildRosterItem(entry, { itemClassName, extraClassFor, titleFor, dataAttrsFor, onItemClick }) {
    const slime = entry.slime || entry;
    const isDead = entry.dead === true;

    if (isDead) {
        const slot = slime.slotIndex ?? 0;
        const emptyItem = document.createElement('div');
        emptyItem.className = 'roster-grid-item empty-slot';
        emptyItem.id = `roster_item_empty_${slot}`;
        emptyItem.title = `RIP ${slime.name || slime.id || `Slot #${slot + 1}`}...`;
        emptyItem.innerHTML = '<div class="roster-empty-icon">💀</div>';
        return emptyItem;
    }

    const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
    const specialization = String(slime.specialization || slimeConfig.specialization || '').toLowerCase();
    const specializationClass = ['tank', 'fighter', 'support'].includes(specialization) ? `specialization-${specialization}` : '';
    const displayName = slime.name || slime.id || slimeConfig.name;
    const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);
    const hpColor = hpPct < 35 ? '#ef4444' : hpPct < 65 ? '#f59e0b' : '#10b981';

    const extraClass = extraClassFor ? extraClassFor(slime) || '' : '';
    const talentAvailable = canSlimeBuyNextTalent(slime);
    const item = document.createElement('div');
    item.className = `roster-grid-item${slime.ascended ? ' ascended' : ''}${specializationClass ? ` ${specializationClass}` : ''}${itemClassName ? ` ${itemClassName}` : ''}${extraClass ? ` ${extraClass}` : ''}${talentAvailable ? ' talent-available' : ''}`;
    item.id = `roster_item_${slime.id}`;
    item.dataset.slimeId = String(slime.id);
    const bonusHp = Number(slime.effects?.iceBarrierBonusHp || 0);
    item.title = titleFor ? titleFor(slime) : `[Slot #${(slime.slotIndex ?? 0) + 1}] ${displayName} (${slimeConfig.name})${slime.ascended ? ' ✨' : ''}: ${slime.hp}/${slime.maxHp} HP${bonusHp > 0 ? ` (+${bonusHp} barrier)` : ''}`;
    if (dataAttrsFor) Object.entries(dataAttrsFor(slime) || {}).forEach(([k, v]) => item.setAttribute(k, v));

    // Main HP bar shows current HP (green) vs maxHp. A separate secondary bar (below)
    // shows the Ice Barrier temporary HP on the SAME scale (full width = maxHp), filled
    // from the left and invisible when empty. e.g. 50/100 + 20 => main 50% green,
    // secondary 20% white (and 30% empty on each). 100/100 + 20 => main 100% green,
    // secondary 20% white.
    const mainMax = Math.max(1, slime.maxHp);
    let greenPct = Math.min(100, (slime.hp / mainMax) * 100);
    let secondaryPct = Math.min(100, (bonusHp / mainMax) * 100);
    greenPct = Math.max(0, greenPct);
    secondaryPct = Math.max(0, secondaryPct);

    if (slime.effects?.burnTimer > 0) item.classList.add('is-burning');
    if (slime.effects?.poisonTimer > 0) item.classList.add('is-poisoned');
    if (slime.effects?.freezeTimer > 0) item.classList.add('is-frozen');
    if (slime.effects?.stunTimer > 0) item.classList.add('is-stunned');
    if (slime.effects?.iceBarrierTimer > 0) item.classList.add('is-ice-barrier');
    item.innerHTML = `<img src="${getSlimeJumpSprite(slime)}" alt="${displayName}" class="roster-grid-icon"><div class="roster-grid-hp-bar"><div class="roster-hp-fill" style="width:${greenPct}%;background:${hpColor};"></div></div>${secondaryPct > 0 ? `<div class="roster-grid-hp-bar roster-grid-hp-bar-secondary"><div class="roster-hp-bonus" style="width:${secondaryPct}%;"></div></div>` : ''}`;
    if (onItemClick) item.addEventListener('click', (e) => onItemClick(slime, item, e));
    return item;
}

/**
 * Render Slime Health Status Array on the left side of the main window
 */
let lastRosterSignature = '';
function updateSlimeRoster() {
    const rosterListEl = document.getElementById('slimeRosterList') || document.getElementById('rosterList');
    const rosterCountEl = document.getElementById('rosterCount');
    if (!rosterListEl) return;

    const activeSlimes = gameState.slimes || [];
    if (rosterCountEl) rosterCountEl.textContent = `${activeSlimes.length}/60 Slimes`;

    const activeById = new Map(activeSlimes.map(slime => [String(slime.id || slime.name), slime]));
    const knownSlimes = [...(gameState.bestRoster || [])]
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
    activeSlimes.forEach(slime => {
        if (!knownSlimes.some(saved => String(saved.id || saved.name) === String(slime.id || slime.name))) knownSlimes.push(slime);
    });

    const entries = knownSlimes.map(savedSlime => {
        const slime = activeById.get(String(savedSlime.id || savedSlime.name));
        return slime ? { slime } : { slime: savedSlime, dead: true };
    });

    // Skip rebuilding the DOM when nothing that affects the rendered items changed,
    // so the talent-available pulse animation isn't restarted on every UI refresh.
    const signature = entries.map(e => {
        const s = e.slime || {};
        const spec = String(s.specialization || SLIME_TYPES[s.type]?.specialization || '').toLowerCase();
        return `${s.id || s.name}|${s.type}|${spec}|${s.hp}|${s.maxHp}|${s.effects?.iceBarrierBonusHp || 0}|${e.dead ? 'dead' : ''}|${s.ascended ? 'a' : ''}|${canSlimeBuyNextTalent(s) ? 't' : ''}`;
    }).join(',');
    if (signature === lastRosterSignature) return;
    lastRosterSignature = signature;

    renderSlimeRosterLanes(rosterListEl, entries, {
        byLine: true,
        titleFor: slime => {
            const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
            const displayName = slime.name || slime.id || slimeConfig.name;
            return `[Slot #${(slime.slotIndex ?? 0) + 1}] ${displayName} (${slimeConfig.name})${slime.ascended ? ' ✨' : ''}: ${slime.hp}/${slime.maxHp} HP`;
        },
        onItemClick: slime => openSlimeInspectorModal(slime)
    });

    const rosterPanelEl = document.querySelector('.slime-status-panel');
    if (rosterPanelEl) requestAnimationFrame(() => {
        const h = rosterPanelEl.offsetHeight || 60;
        document.documentElement.style.setProperty('--roster-height', `${h}px`);
    });
}

// Track every rendered roster container so the flat, interleaved line layout is
// recomputed when the window is resized (the slime-status-panel width changes
// between breakpoints). On resize we invalidate the render cache and dispatch a
// relayout event so popups (Shop, Common House) that render their own rosters can
// re-render too.
//
// When `redraw` is provided (byLine rosters), we also watch the container itself
// with a ResizeObserver. This is the key fix for the "roster not formed on page
// load until I resize" bug: the panel's real width is only known after the auth
// screen is dismissed / fonts load, so the observer re-lays-out automatically the
// moment the container gets a non-zero width — no manual resize needed.
let rosterResizeBound = false;
const observedRosterContainers = new Set();
function trackRosterForResize(container, redraw = null) {
    if (!container) return;

    if (redraw && !observedRosterContainers.has(container)) {
        observedRosterContainers.add(container);
        const observer = new ResizeObserver(() => {
            // Re-measure now that the container has a settled size. Guard against a
            // 0-width transient (still hidden) which would collapse the layout.
            const cap = computeRosterCapacity(container);
            if (cap > 0) redraw();
        });
        observer.observe(container);
        // A few deferred retries in case the observer's first callback fires while
        // the panel is still in a transitional (zero-width) state.
        requestAnimationFrame(redraw);
        setTimeout(redraw, 150);
        setTimeout(redraw, 500);
    }

    if (rosterResizeBound) return;
    rosterResizeBound = true;
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            lastRosterSignature = '';
            updateSlimeRoster();
            window.dispatchEvent(new CustomEvent('roster:relayout'));
        }, 100);
    });
}

/**
 * Deterministic pseudo-random offset [-1 to 1] based on slime index
 */
function pseudoRandom(i, seed = 1) {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Calculates 3D battlefield coordinates (posX, posY, calculatedZ) for a given slotIndex
 */
export function getSlimeSlotCoordinates(slotIndex) {
    const centerX = 95;
    const centerY = 92;

    const layers = [
        {
            maxSlimes: 30,
            yOffset: 0,
            zBase: 0,
            rings: [
                { count: 1, radiusX: 0, radiusY: 0 },
                { count: 6, radiusX: 16, radiusY: 9 },
                { count: 11, radiusX: 30, radiusY: 16 },
                { count: 12, radiusX: 44, radiusY: 23 }
            ]
        },
        {
            maxSlimes: 20,
            yOffset: -2,
            zBase: 100,
            rings: [
                { count: 1, radiusX: 0, radiusY: 0 },
                { count: 6, radiusX: 14, radiusY: 8 },
                { count: 13, radiusX: 28, radiusY: 15 }
            ]
        },
        {
            maxSlimes: 10,
            yOffset: -14,
            zBase: 200,
            rings: [
                { count: 1, radiusX: 0, radiusY: 0 },
                { count: 9, radiusX: 16, radiusY: 9 }
            ]
        }
    ];

    let remainingIndex = slotIndex;
    for (let l = 0; l < layers.length; l++) {
        const layer = layers[l];
        if (remainingIndex < layer.maxSlimes) {
            let countAccumulator = 0;
            for (let r = 0; r < layer.rings.length; r++) {
                const ring = layer.rings[r];
                if (remainingIndex < countAccumulator + ring.count) {
                    const k = remainingIndex - countAccumulator;
                    const angleOffset = (r % 2 === 1) ? 0.3 : 0;
                    const angle = (k / ring.count) * 2 * Math.PI + angleOffset;

                    const jitterX = pseudoRandom(slotIndex, 1) * 2.5;
                    const jitterY = pseudoRandom(slotIndex, 2) * 2;

                    const posX = Math.floor(centerX + Math.cos(angle) * ring.radiusX + jitterX);
                    const posY = Math.floor(centerY + Math.sin(angle) * ring.radiusY + jitterY + layer.yOffset);
                    const calculatedZ = Math.floor(posY + 10);

                    return { slotIndex, layer: l, posX, posY, calculatedZ, isBaseLayer: (l === 0) };
                }
                countAccumulator += ring.count;
            }
        }
        remainingIndex -= layer.maxSlimes;
    }

    const fallbackX = centerX + (slotIndex % 5) * 10;
    const fallbackY = centerY + Math.floor(slotIndex / 5) * 8;
    return { slotIndex, layer: 0, posX: fallbackX, posY: fallbackY, calculatedZ: fallbackY + 10, isBaseLayer: true };
}

/**
 * Returns the horizontal formation offset for a Slime's chosen Talent Tree path.
 * The battlefield faces right: tanks hold the front, while supports stay behind the pack.
 */
function getSlimeSpecialization(slime) {
    const typeSpecialization = SLIME_TYPES[slime.type]?.specialization || '';
    return String(slime.specialization || typeSpecialization).toLowerCase();
}

function getSlimeFormationLane(slime) {
    const specialization = getSlimeSpecialization(slime);
    if (specialization === 'tank') return 'front';
    if (specialization === 'support') return 'back';
    if (specialization === 'fighter') return 'middle';
    return 'unassigned';
}

function getSlimeFormationOffsetX(slime) {
    const lane = getSlimeFormationLane(slime);
    if (lane === 'front') return 50;
    if (lane === 'back') return -50;
    return 0;
}

/**
 * Specialized Slimes occupy two tidy, parallel diagonal lines per zone.
 * Higher sprites sit slightly right; lower sprites step left for the battlefield perspective.
 */
function getSpecializedLaneCoordinates(slime, laneIndex, laneCount) {
    const lane = laneIndex % 2;
    const row = Math.floor(laneIndex / 2);
    const rowCount = Math.ceil(laneCount / 2);
    const centerRow = (rowCount - 1) / 2;
    const centerY = 92;
    const rowSpacing = 5;
    const diagonalStep = 2;
    const laneOffsetX = laneCount === 1 ? 0 : (lane === 0 ? -6 : 6);
    const zoneCenterX = 95 + getSlimeFormationOffsetX(slime);
    const rowFromCenter = row - centerRow;
    const posY = Math.round(centerY + rowFromCenter * rowSpacing);
    const posX = Math.round(zoneCenterX + laneOffsetX - rowFromCenter * diagonalStep);
    return {
        slotIndex: slime.slotIndex ?? laneIndex,
        layer: 0,
        posX,
        posY,
        calculatedZ: Math.floor(posY + 10),
        isBaseLayer: true
    };
}

function getSlimeFormationCoordinates(slime) {
    const lane = getSlimeFormationLane(slime);
    // Non-specialized Slimes deliberately keep the loose, shared army formation.
    if (lane === 'unassigned') return getSlimeSlotCoordinates(slime.slotIndex ?? 0);

    const laneRoster = (gameState.slimes || [])
        .filter(candidate => getSlimeFormationLane(candidate) === lane)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
    const laneIndex = laneRoster.findIndex(candidate => String(candidate.id) === String(slime.id));
    return getSpecializedLaneCoordinates(slime, laneIndex >= 0 ? laneIndex : 0, laneRoster.length);
}
/**
 * Render Slime Army Stack in 3D Perspective with Fixed Slot Indexing
 */
export function renderSlimeArmy() {
    if (!armyContainerEl || isRainAnimating) return;
    if (gameState.isInNewGamePlus) {
        armyContainerEl.innerHTML = '';
        return;
    }
    syncSlimesArray();

    // Collect set of current valid slime IDs from state
    const currentSlimeIds = new Set(
        gameState.slimes ? gameState.slimes.map(s => String(s.id)) : []
    );

    // Remove any DOM unit in armyContainerEl whose slime ID is no longer in gameState.slimes
    // (unless currently playing hero death animation or cartoon KO eject)
    const existingNodes = Array.from(armyContainerEl.querySelectorAll('.slime-unit'));
    existingNodes.forEach(node => {
        const id = node.dataset.slimeId;
        if (!currentSlimeIds.has(id) && node.dataset.isDying !== 'true' && !node.classList.contains('cartoon-ko-eject') && !node.classList.contains('cartoon-ko-eject-left')) {
            node.remove();
        }
    });

    if (!gameState.slimes || gameState.slimes.length === 0) return;

    gameState.slimes.forEach(slimeObj => {
        const slimeId = String(slimeObj.id);
        const slot = slimeObj.slotIndex !== undefined ? slimeObj.slotIndex : 0;
        const coords = getSlimeFormationCoordinates(slimeObj);

        const existingUnit = armyContainerEl.querySelector(`.slime-unit[data-slime-id="${slimeId}"]`);
        if (existingUnit) {
            slimeObj.el = existingUnit;
            let statusRow = existingUnit.querySelector('.slime-status-row');
            if (!statusRow) {
                statusRow = document.createElement('div');
                statusRow.className = 'slime-status-row';
                existingUnit.insertBefore(statusRow, existingUnit.firstChild);
            }
            slimeObj.statusRowEl = statusRow;
            // Refresh the sprite when the Slime's type or specialization changed
            // (e.g. rerolling a type or choosing a specialization while in-game),
            // so the battlefield shows the correct artwork without a full reload.
            const imgEl = existingUnit.querySelector('.slime-img');
            if (imgEl) {
                const expectedSrc = getSlimeJumpSprite(slimeObj);
                // Compare resolved (absolute) URLs: a reroll may keep the same
                // filename (jump.png) but change only the folder, so a bare
                // filename check would wrongly skip the update.
                const resolvedExpected = new URL(expectedSrc, document.baseURI).href;
                if (imgEl.src !== resolvedExpected) {
                    imgEl.src = expectedSrc;
                }
            }
            if (existingUnit.dataset.isAttacking !== 'true' && existingUnit.dataset.isEating !== 'true') {
                existingUnit.style.left = `${coords.posX}px`;
                existingUnit.style.top = `${coords.posY}px`;
                existingUnit.style.zIndex = `${coords.calculatedZ}`;
                existingUnit.dataset.originalZ = `${coords.calculatedZ}`;
            }
            return;
        }

        const slimeConfig = SLIME_TYPES[slimeObj.type] || SLIME_TYPES.base;
        const slimeImgSrc = getSlimeJumpSprite(slimeObj);

        const unit = document.createElement('div');
        unit.className = 'slime-unit';
        unit.dataset.layer = `${coords.layer + 1}`;
        unit.dataset.slimeId = slimeId;
        unit.dataset.slimeType = slimeObj.type;

        unit.style.position = 'absolute';
        unit.style.left = `${coords.posX}px`;
        unit.style.top = `${coords.posY}px`;
        unit.style.zIndex = `${coords.calculatedZ}`;
        unit.dataset.originalZ = `${coords.calculatedZ}`;

        const animDelay = (Math.abs(pseudoRandom(slot, 3)) * 2.5).toFixed(2);
        const shadowHTML = coords.isBaseLayer ? '<div class="slime-shadow-sm"></div>' : '';

        unit.innerHTML = `
            <div class="slime-status-row"></div>
            <img src="${slimeImgSrc}" 
                 onerror="this.onerror=null; this.src='${SLIME_FALLBACK_SRC}';" 
                 alt="${slimeConfig.name}" 
                 class="slime-img" 
                 style="animation-delay: ${animDelay}s">
            ${shadowHTML}
        `;
        armyContainerEl.appendChild(unit);
        slimeObj.el = unit;
        slimeObj.statusRowEl = unit.querySelector('.slime-status-row');
    });
}

/**
 * Toggle Authentication Gate vs Game Screen
 */
export function setAuthScreenState(isAuthenticated, user = null) {
    if (isAuthenticated && user) {
        if (authGateEl) authGateEl.classList.add('hidden');
        if (gameScreenEl) gameScreenEl.classList.remove('hidden');
        renderUserProfile(user);
    } else {
        if (authGateEl) authGateEl.classList.remove('hidden');
        if (gameScreenEl) gameScreenEl.classList.add('hidden');
    }
}

/**
 * Show notice if Firebase is not configured in js/config.js
 */
export function showFirebaseNotice() {
    if (firebaseNoticeEl) {
        firebaseNoticeEl.classList.remove('hidden');
    }
}

/**
 * Render user profile info in navbar header
 */
function renderUserProfile(user) {
    const userProfileEl = document.getElementById('userProfile');
    const userAvatarEl = document.getElementById('userAvatar');
    const userNameEl = document.getElementById('userName');

    if (userProfileEl) userProfileEl.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = user.displayName || 'Player';
    if (userAvatarEl) {
        userAvatarEl.src = user.photoURL || 'images/slimes/base/jump.png';
    }
}

/**
 * Play Slime Rain Sky-Drop Respawn Animation:
 * Slimes drop from the sky 1 by 1 every 0.05s (50ms).
 * - Airborne fall: jump.png frame 3
 * - Ground impact: jump.png frame 8
 * - Idle: jump.png frame 1
 * Triggers onComplete callback when ALL slimes have landed and are idling on the ground!
 */
export function playSlimeRainRespawnAnimation(onComplete) {
    if (!armyContainerEl) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    isRainAnimating = true;

    // Clear army container for fresh sky drop
    armyContainerEl.innerHTML = '';

    const totalSlimes = (gameState.slimes && gameState.slimes.length > 0)
        ? gameState.slimes.length
        : (gameState.armySize || 1);

    if (totalSlimes === 0) {
        isRainAnimating = false;
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Each Talent Tree lane gets its own spiral around its formation anchor.
    // The falling order makes the front line arrive first, followed by the middle and back lines.
    const activeSlimes = (gameState.slimes && gameState.slimes.length > 0)
        ? [...gameState.slimes]
        : Array.from({ length: totalSlimes }, (_, index) => ({ id: index + 1, type: 'base', slotIndex: index }));
    const laneOrder = ['front', 'middle', 'unassigned', 'back'];
    const respawnOrder = laneOrder.flatMap(lane => activeSlimes
        .filter(slime => getSlimeFormationLane(slime) === lane)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
    );
    const slimePositions = respawnOrder.map((slimeObj, index) => {
        const coords = getSlimeFormationCoordinates(slimeObj);
        return {
            index,
            slimeObj,
            slimeId: String(slimeObj.id),
            posX: coords.posX,
            posY: coords.posY,
            zIndex: coords.calculatedZ,
            layerIndex: coords.layer,
            animDelay: (Math.abs(pseudoRandom(index, 3)) * 2.5).toFixed(2),
            shadowHTML: coords.isBaseLayer ? '<div class="slime-shadow-sm"></div>' : ''
        };
    });
    // Drop slimes 1 by 1 every 0.05s (50ms)
    slimePositions.forEach((pos, idx) => {
        const dropDelay = idx * 50;

        setTimeout(() => {
            if (!armyContainerEl) return;

            const slimeConfig = SLIME_TYPES[pos.slimeObj.type] || SLIME_TYPES.base;
            const sheetUrl = getSlimeJumpSprite(pos.slimeObj);

            const unit = document.createElement('div');
            unit.className = 'slime-unit';
            unit.dataset.layer = `${pos.layerIndex + 1}`;
            unit.dataset.slimeId = pos.slimeId;
            unit.dataset.slimeType = pos.slimeObj.type;
            unit.dataset.isFalling = 'true';
            unit.dataset.originalZ = `${pos.zIndex}`;

            const startY = -40; // High in the sky
            unit.style.position = 'absolute';
            unit.style.left = `${pos.posX}px`;
            unit.style.top = `${startY}px`;
            unit.style.zIndex = `${pos.zIndex}`;

            // Initial falling frame is frame 3 (-38px)
            unit.innerHTML = `
                <div class="slime-status-row"></div>
                <img src="${sheetUrl}" 
                     onerror="this.onerror=null; this.src='${SLIME_FALLBACK_SRC}';" 
                     alt="${slimeConfig.name}" 
                     class="slime-img slime-sky-falling"
                     style="object-position: -38px 0px;">
                ${pos.shadowHTML}
            `;
            armyContainerEl.appendChild(unit);

            const imgEl = unit.querySelector('.slime-img');
            const fallDuration = 220;
            const startTime = performance.now();

            function stepFall(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1.0, elapsed / fallDuration);
                const currentY = startY + (pos.posY - startY) * (progress * progress);
                unit.style.top = `${currentY}px`;

                if (progress < 1.0) {
                    requestAnimationFrame(stepFall);
                } else {
                    // 2. Impact Ground: switch to impact frame (Frame 8 = -133px)
                    unit.style.top = `${pos.posY}px`;
                    unit.dataset.isFalling = 'false';
                    if (imgEl) {
                        imgEl.src = sheetUrl;
                        imgEl.style.objectPosition = '-133px 0px';
                        imgEl.classList.remove('slime-sky-falling');
                        imgEl.classList.add('slime-impact-squish');
                    }

                    // 3. After 120ms squish impact, switch to idle frame (Frame 1 = 0px)
                    setTimeout(() => {
                        if (imgEl) {
                            imgEl.src = sheetUrl;
                            imgEl.style.objectPosition = '0px 0px';
                            imgEl.classList.remove('slime-impact-squish');
                            imgEl.style.animationDelay = `${pos.animDelay}s`;
                        }

                        // If this is the last slime, finish rain animation & trigger onComplete!
                        if (idx === slimePositions.length - 1) {
                            isRainAnimating = false;
                            if (typeof onComplete === 'function') {
                                onComplete();
                            }
                        }
                    }, 120);
                }
            }

            requestAnimationFrame(stepFall);
        }, dropDelay);
    });
}

/**
 * Open Slime Inspector Modal Popup
 */
function setSlimeSheetTab(tabName) {
    activeSlimeSheetTab = tabName;
    const statsTab = document.getElementById('slimeSheetStatsTab');
    const talentTab = document.getElementById('slimeSheetTalentTab');
    const statsContent = document.getElementById('slimeSheetStatsContent');
    const talentContent = document.getElementById('slimeSheetTalentContent');
    const showTalent = tabName === 'talent' && talentTab && !talentTab.disabled;

    if (statsTab) { statsTab.classList.toggle('active', !showTalent); statsTab.setAttribute('aria-selected', String(!showTalent)); }
    if (talentTab) { talentTab.classList.toggle('active', showTalent); talentTab.setAttribute('aria-selected', String(showTalent)); }
    if (statsContent) statsContent.classList.toggle('hidden', showTalent);
    if (talentContent) talentContent.classList.toggle('hidden', !showTalent);
}

function renderSlimeTalentTree(slime) {
    const talentTab = document.getElementById('slimeSheetTalentTab');
    const gateMessage = document.getElementById('slimeTalentGateMessage');
    const baseMessage = document.getElementById('slimeTalentBaseMessage');
    const choices = document.getElementById('slimeTalentChoices');
    const chosenMessage = document.getElementById('slimeTalentChosenMessage');
    const specializationWarning = document.getElementById('slimeTalentSpecializationWarning');
    const specializationTalents = document.getElementById('slimeSpecializationTalents');
    const unlocked = (gameState.newGamePlusCompletions || 0) > 0;
    const isBase = (slime.type || 'base') === 'base';
    const specialization = slime.specialization || '';
    const isSpecialized = Boolean(specialization);
    const canSpecialize = !isBase && !isSpecialized;
    // Show the Talent sheet for specialized Slimes even without a New Game+ run,
    // so their Talent columns (and sub-talent placeholders) are always visible.
    const showTalentSheet = unlocked || isSpecialized;

    if (talentTab) {
        talentTab.disabled = !showTalentSheet;
        talentTab.classList.toggle('disabled', !showTalentSheet);
        const talentAvailable = canSlimeBuyNextTalent(slime);
        talentTab.textContent = unlocked
            ? (talentAvailable ? 'Specialization (1)' : 'Specialization')
            : (isSpecialized ? 'Specialization' : 'Specialization (Available in New Game+)');
        talentTab.title = unlocked || isSpecialized ? 'Specialization' : 'Available in New Game+';
    }
    if (gateMessage) gateMessage.classList.toggle('hidden', showTalentSheet);
    if (baseMessage) baseMessage.classList.toggle('hidden', showTalentSheet || canSpecialize || Boolean(specialization));
    if (choices) {
        // The 3 specialization choice buttons stay visible whenever the Slime has
        // not yet specialized (so the player can pick one). They hide only once a
        // specialization is chosen, at which point the Talent columns take over.
        choices.classList.toggle('hidden', Boolean(specialization));
        choices.querySelectorAll('.slime-talent-choice').forEach(choice => {
            choice.disabled = !canSpecialize;
        });
    }
    if (specializationWarning) specializationWarning.classList.toggle('hidden', showTalentSheet || !canSpecialize || Boolean(specialization));
    if (chosenMessage) {
        chosenMessage.classList.toggle('hidden', !showTalentSheet || !specialization);
        const specializationBonuses = { tank: '(+20% HP 💗)', support: '(+20% Regen 💚)', fighter: '(+20% Damage ⚔️)' };
        const specializationLabel = String(specialization).toLowerCase();
        chosenMessage.textContent = specialization ? `${specializationLabel} ${specializationBonuses[specializationLabel] || ''}`.trim() : '';
    }
    if (specializationTalents) {
        const normalizedSpecialization = String(specialization).toLowerCase();
        const icon = normalizedSpecialization ? `images/talents/${normalizedSpecialization}Spec.png` : 'images/talents/supportSpec.png';
        // Talent purchases are paid from Village Coins (the New Game+ currency),
        // consistent with the Common House — not the Slime's per-run personal coins.
        const coins = Number(gameState.villageCoins || 0);
        const costs = [1, 2, 3];
        // Talent columns (and their sub-talent placeholders) only appear once the
        // Slime is actually specialized — otherwise the sheet shows just the 3
        // specialization choice buttons.
        specializationTalents.classList.toggle('hidden', !isSpecialized);
        const talentNames = { support: 'Graft', fighter: 'Rebound', tank: 'Block' };
        const genericTalentNames = ['Talent1', 'Talent2', 'Talent3'];
        const talentDescriptions = {
            support: 'Sacrifice 20% of HP to Heal twice that amount to a Slime in need (Can\'t target other Support Slimes).',
            fighter: '50% chance to re-jump on the second closest ennemy when dealing damage.',
            tank: '10% chance to ignore incoming damage.'
        };
        const talentFlag = { support: 'graft', fighter: 'rebound', tank: 'block' };
        const subTalentsPerTalent = 3;
        // A Talent column is "unlocked" once its main Talent has been purchased
        // (only the first, dedicated Talent can be bought for now). Locked Talent
        // columns hide their sub-talent buttons entirely.
        const dedicatedUnlocked = normalizedSpecialization ? Boolean(slime.talents?.[talentFlag[normalizedSpecialization]]) : false;
        // Third Talent (shared by every element of a specialization): Support
        // Resurrection / Fighter Slide / Tank Interception.
        const thirdDef = getThirdTalentDef(normalizedSpecialization);
        const columns = costs.map((cost, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const elementMatch = (slime.type || '').match(/^(poison|fire|ice|stone)/);
            const elementCap = elementMatch ? elementMatch[0].charAt(0).toUpperCase() + elementMatch[0].slice(1) : '';
            const dedicatedIcon = isFirst && normalizedSpecialization ? talentNames[normalizedSpecialization]?.toLowerCase() : null;
            const comboTypeId = elementMatch ? `${elementMatch[0]}${normalizedSpecialization.charAt(0).toUpperCase()}${normalizedSpecialization.slice(1)}` : '';
            const secondIcon = isSecond ? SECOND_TALENT_ICON[comboTypeId] : null;
            const iconSource = dedicatedIcon
                ? `images/talents/${normalizedSpecialization}${dedicatedIcon}.png`
                : (isSecond ? (secondIcon || `images/talents/${normalizedSpecialization}Talent${index + 1}.png`) : (thirdDef?.icon || `images/talents/${normalizedSpecialization}Talent3.png`));
            const talentName = normalizedSpecialization
                ? (isFirst ? (talentNames[normalizedSpecialization] || 'Talent1') : `Talent${index + 1}`)
                : genericTalentNames[index];
            const secondFlag = isSecond ? getSecondTalentFlag(comboTypeId) : null;
            const secondOwned = Boolean(secondFlag && slime.talents?.[secondFlag]);
            const isThird = index === 2;
            const thirdOwned = Boolean(isThird && thirdDef && slime.talents?.[thirdDef.flag]);
            const secondAvailable = isSecond && dedicatedUnlocked && secondFlag && coins >= cost;
            const isOwned = isFirst ? dedicatedUnlocked : (isSecond ? secondOwned : (isThird ? thirdOwned : false));
            const thirdAvailable = isThird && Boolean(thirdDef) && dedicatedUnlocked && coins >= cost;
            const buttonState = isOwned
                ? ''
                : (isFirst
                    ? (normalizedSpecialization && coins >= cost ? '' : 'disabled')
                    : (isSecond ? (secondAvailable ? '' : 'disabled') : (isThird ? (thirdAvailable ? '' : 'disabled') : 'disabled')));
            const buttonClass = `slime-specialization-talent ${isOwned ? 'unlocked' : ''} ${isFirst && normalizedSpecialization && coins >= cost && !isOwned ? 'available' : ''}${isSecond && secondAvailable ? ' available' : ''}${isThird && thirdAvailable ? ' available' : ''}`;
            const badgeHtml = normalizedSpecialization
                ? (secondOwned || thirdOwned || (isFirst && dedicatedUnlocked) ? '✔️' : `${cost}<img src="images/logos/coin.png" alt="" class="talent-cost-coin">`)
                : '🔒';
            const button = `<button type="button" class="${buttonClass}" title="${normalizedSpecialization ? '' : 'Specialize to unlock'}" ${buttonState}><img src="${iconSource}" alt="${talentName}"><span>${badgeHtml}</span></button>`;
            const columnUnlocked = isFirst ? dedicatedUnlocked : (isSecond ? secondOwned : (isThird ? thirdOwned : false));
            // Sub-talent icon: Talent 1 & 3 share the per-spec sprite
            // (support/tank/fighterSubtalents.png); Talent 2 uses the unique
            // per-type sprite (e.g. supportFireSubtalents.png) keyed on element.
            const secondTalentDef = index === 1 ? SECOND_TALENT[`${elementMatch ? elementMatch[0] : ''}${normalizedSpecialization.charAt(0).toUpperCase()}${normalizedSpecialization.slice(1)}`] : null;
            const thirdTalentDef = (index === 2 && thirdDef)
                ? { name: thirdDef.name, description: thirdDef.description }
                : null;
            const firstTalentDef = isFirst && (normalizedSpecialization === 'support' || normalizedSpecialization === 'tank' || normalizedSpecialization === 'fighter')
                ? { name: talentNames[normalizedSpecialization], description: talentDescriptions[normalizedSpecialization] }
                : null;
            const tooltipDef = secondTalentDef || thirdTalentDef || firstTalentDef;
            const hasTooltip = Boolean(tooltipDef);
            const tooltipTitle = tooltipDef ? tooltipDef.name : '';
            const tooltipText = tooltipDef ? tooltipDef.description : '';
            const mainButton = hasTooltip
                ? `<span class="talent-tooltip-glass">${button}<span class="talent-tooltip-glass-box"><strong>${tooltipTitle}</strong><br>${tooltipText}</span></span>`
                : button;
            const subtalentIcon = (index === 1 && elementCap)
                ? `images/talents/subtalents/${normalizedSpecialization}${elementCap}Subtalents.png`
                : `images/talents/subtalents/${normalizedSpecialization}Subtalents.png`;
            const subButtons = columnUnlocked
                ? Array.from({ length: subTalentsPerTalent }, (_, subIndex) => {
                    const subLabel = `${talentName} sub-talent ${subIndex + 1}`;
                    const subDef = getSlimeSubTalentColumn(slime, index)?.[subIndex];
                    const selected = columnUnlocked && getSlimeSubTalent(slime, index) === subIndex;
                    const selectedClass = selected ? ' selected' : '';
                    const subButton = `<button type="button" class="slime-specialization-subtalent${selectedClass}" aria-label="${subLabel}" data-talent-index="${index}" data-subtalent-index="${subIndex}" ${columnUnlocked ? '' : 'disabled'}><img src="${subtalentIcon}" alt="${talentName}"></button>`;
                    return subDef
                        ? `<span class="talent-tooltip-glass">${subButton}<span class="talent-tooltip-glass-box"><strong>${subDef.name}</strong><br>${subDef.description}</span></span>`
                        : subButton;
                }).join('')
                : '';
            return `<div class="slime-specialization-talent-column">${mainButton}<div class="slime-specialization-subtalents">${subButtons}</div></div>`;
        }).join('');
        specializationTalents.innerHTML = isSpecialized ? columns : '';
        // Wire sub-talent selection (only available once the Talent column is unlocked).
        specializationTalents.querySelectorAll('.slime-specialization-subtalent:not([disabled])').forEach(subButton => {
            subButton.addEventListener('click', () => {
                const talentIndex = Number(subButton.dataset.talentIndex);
                const subIndex = Number(subButton.dataset.subtalentIndex);
                const subTalents = ensureSlimeSubTalents(slime);
                subTalents[talentIndex] = subTalents[talentIndex] === subIndex ? null : subIndex;
                // Sub-talents can change Max HP, Regen, Damage and Crit; recompute all.
                recalculateSlimeStats(slime);
                updateBestRoster();
                saveStateToLocal();
                openSlimeInspectorModal(slime);
            });
        });
        if (normalizedSpecialization === 'support' || normalizedSpecialization === 'tank' || normalizedSpecialization === 'fighter') {
            const elementMatch = (slime.type || '').match(/^(poison|fire|ice|stone)/);
            const comboTypeId = `${elementMatch ? elementMatch[0] : ''}${normalizedSpecialization.charAt(0).toUpperCase()}${normalizedSpecialization.slice(1)}`;
            const firstFlag = talentFlag[normalizedSpecialization];
            const secondFlag = getSecondTalentFlag(comboTypeId);
            const buttons = specializationTalents.querySelectorAll('.slime-specialization-talent');
            // First Talent (index 0)
            const firstButton = buttons[0];
            if (slime.talents?.[firstFlag]) {
                if (firstButton) { firstButton.classList.add('unlocked'); firstButton.disabled = false; const progress = firstButton.querySelector('span'); if (progress) progress.textContent = '✔️'; }
            } else if (firstButton) {
                    firstButton.addEventListener('click', () => {
                    if (coins < costs[0]) return;
                    gameState.villageCoins = coins - costs[0];
                    slime.talents = { ...(slime.talents || {}), [firstFlag]: true };
                    updateBestRoster();
                    saveStateToLocal();
                    updateUI();
                    openSlimeInspectorModal(slime);
                });
            }
            // Second Talent (index 1)
            const secondButton = buttons[1];
            if (secondFlag) {
                if (slime.talents?.[secondFlag]) {
                    if (secondButton) { secondButton.classList.add('unlocked'); secondButton.disabled = false; const progress = secondButton.querySelector('span'); if (progress) progress.textContent = '✔️'; }
                } else if (secondButton) {
                    secondButton.addEventListener('click', () => {
                        if (!slime.talents?.[firstFlag] || coins < costs[1]) return;
                        gameState.villageCoins = coins - costs[1];
                        slime.talents = { ...(slime.talents || {}), [secondFlag]: true };
                        updateBestRoster();
                        saveStateToLocal();
                        updateUI();
                        openSlimeInspectorModal(slime);
                    });
                }
            }
            // Third Talent (index 2): shared per-spec Talent (Support Resurrection,
            // Fighter Slide, Tank Interception). Requires the first Talent as prerequisite.
            const thirdButton = buttons[2];
            if (thirdDef && thirdButton) {
                if (slime.talents?.[thirdDef.flag]) {
                    thirdButton.classList.add('unlocked');
                    thirdButton.disabled = false;
                    const progress = thirdButton.querySelector('span');
                    if (progress) progress.textContent = '✔️';
                } else {
                    thirdButton.addEventListener('click', () => {
                        if (!slime.talents?.[firstFlag] || coins < costs[2]) return;
                        gameState.villageCoins = coins - costs[2];
                        slime.talents = { ...(slime.talents || {}), [thirdDef.flag]: true };
                        updateBestRoster();
                        saveStateToLocal();
                        updateUI();
                        openSlimeInspectorModal(slime);
                    });
                }
            }
        }
    }
    if (!showTalentSheet) activeSlimeSheetTab = 'stats';
}

function specializeInspectedSlime(specialization) {
    if (!currentInspectedSlime || (gameState.newGamePlusCompletions || 0) <= 0) return;
    const target = (gameState.slimes || []).find(s => s.id === currentInspectedSlime.id || s.name === currentInspectedSlime.name);
    if (!target || (target.type || 'base') === 'base' || target.specialization) return;
    const elementalPrefix = ['poison', 'fire', 'ice', 'stone'].includes(target.type) ? target.type : null;
    const typeId = elementalPrefix ? `${elementalPrefix}${specialization[0].toUpperCase()}${specialization.slice(1)}` : null;
    if (!typeId || !SLIME_TYPES[typeId]) return;
    target.type = elementalPrefix || target.type;
    triggerElementAchievement(target.type);
    target.specialization = specialization;
    ensureSlimeSubTalents(target);
    sortRosterBySpecialization();
    updateBestRoster();
    // Force the existing battlefield units to take their new formation immediately.
    lastRenderedArmySize = -1;
    currentInspectedSlime = target;
    saveStateToLocal();
    updateUI();
    activeSlimeSheetTab = 'talent';
    openSlimeInspectorModal(target);
}
export function openSlimeInspectorModal(slime) {
    if (!slime) return;
    currentInspectedSlime = slime;

    const backdropEl = document.getElementById('slimeModalBackdrop');
    const portraitEl = document.getElementById('slimeModalPortrait');
    const nameEl = document.getElementById('slimeModalName');
    const badgeEl = document.getElementById('slimeModalBadge');
    const hpEl = document.getElementById('slimeModalHp');
    const hpBarEl = document.getElementById('slimeModalHpBar');
    const damageEl = document.getElementById('slimeModalDamage');
    const effectEl = document.getElementById('slimeModalEffect');
    const ascendedEl = document.getElementById('slimeModalAscended');
    const killBtnEl = document.getElementById('slimeModalKill');

    if (!backdropEl) return;

    if (killBtnEl) {
        if (gameState.slimes && gameState.slimes.length <= 1) {
            killBtnEl.setAttribute('disabled', 'disabled');
            killBtnEl.classList.add('disabled');
            killBtnEl.title = 'Cannot sacrifice the last remaining slime!';
        } else {
            killBtnEl.removeAttribute('disabled');
            killBtnEl.classList.remove('disabled');
            killBtnEl.title = 'Sacrifice / Kill Slime';
        }
    }

    const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
    const isAscended = slime.ascended === true;

    renderSlimeTalentTree(slime);
    setSlimeSheetTab(activeSlimeSheetTab);

    if (portraitEl) {
        portraitEl.src = getSlimeJumpSprite(slime);
        portraitEl.style.objectPosition = '0px 0px';
    }
    if (nameEl) nameEl.textContent = slime.name || slimeConfig.name || 'Slime';
    if (badgeEl) {
        badgeEl.textContent = isAscended ? `${slimeConfig.name} ✨` : slimeConfig.name;
    }

    const currentHp = slime.hp !== undefined ? slime.hp : 10;
    const maxHp = slime.maxHp || 10;
    if (hpEl) hpEl.textContent = `${currentHp} / ${maxHp}`;

    if (hpBarEl) {
        const hpPct = Math.max(0, (currentHp / maxHp) * 100);
        hpBarEl.style.width = `${hpPct}%`;
        if (hpPct < 35) hpBarEl.style.background = '#ef4444';
        else if (hpPct < 65) hpBarEl.style.background = '#f59e0b';
        else hpBarEl.style.background = '#10b981';
    }

    const baseDmg = calculateSlimeDamage(slime);
    if (damageEl) damageEl.textContent = `${baseDmg}`;

    const critEl = document.getElementById('slimeModalCrit');
    const regenEl = document.getElementById('slimeModalRegen');

    const critChance = slime.critChance || 0;
    if (critEl) critEl.textContent = `${critChance}%`;

    const regenVal = getSlimeTotalRegen(slime);
    if (regenEl) regenEl.textContent = `${regenVal}`;
    const hitEffects = getSlimeHitEffects(slime);
    const hitEffectElements = {
        burn: document.getElementById('slimeModalBurn'),
        freeze: document.getElementById('slimeModalFreeze'),
        poison: document.getElementById('slimeModalPoison'),
        stun: document.getElementById('slimeModalStun')
    };
    Object.entries(hitEffectElements).forEach(([type, element]) => {
        if (element) element.textContent = String(hitEffects[type] || 0);
    });

    const activeEffects = [];
    if (slimeConfig.effect === 'burn') activeEffects.push('🔥 Burn');
    else if (slimeConfig.effect === 'freeze') activeEffects.push('❄️ Freeze');
    else if (slimeConfig.effect === 'stun') activeEffects.push('💫 Stun');
    else if (slimeConfig.effect === 'poison') activeEffects.push('🧪 Poison');

    if (slime.equipment && slime.equipment.length > 0) {
        slime.equipment.forEach(eq => {
            getScaledEquipmentEffects(eq).forEach(effect => {
                const effectType = effect?.stat === 'effect' ? effect?.effectType : effect?.stat;
                if (effectType === 'burn' && !activeEffects.includes('🔥 Burn')) activeEffects.push('🔥 Burn');
                else if (effectType === 'poison' && !activeEffects.includes('🧪 Poison')) activeEffects.push('🧪 Poison');
                else if (effectType === 'freeze' && !activeEffects.includes('❄️ Freeze')) activeEffects.push('❄️ Freeze');
                else if (effectType === 'stun' && !activeEffects.includes('💫 Stun')) activeEffects.push('💫 Stun');
            });
        });
    }

    if (effectEl) {
        effectEl.textContent = activeEffects.length > 0 ? activeEffects.join(', ') : 'None';
    }

    if (ascendedEl) {
        ascendedEl.textContent = isAscended ? '✨ Ascended (auto attack)' : 'Standard Slime';
        ascendedEl.style.color = isAscended ? '#f59e0b' : '#94a3b8';
    }

    const equipmentEl = document.getElementById('slimeModalEquipment');
    if (equipmentEl) {
        if (slime.equipment && slime.equipment.length > 0) {
            equipmentEl.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'equipment-grid';

            slime.equipment.forEach(item => {
                const badge = document.createElement('div');
                badge.className = 'equipment-item-card';
                const effectText = formatLootEffects(getScaledEquipmentEffects(item));
                badge.title = getEquipmentDisplayName(item) + ': ' + effectText;

                badge.innerHTML = `
                    <img src="${getEquipmentSprite(item)}" alt="${getEquipmentDisplayName(item)}" class="equipment-icon-img"
                         onerror="this.onerror=null; this.src='images/loots/boot.png';">
                    <div class="equipment-item-info">
                        <span class="equipment-item-name equipment-quality-${getEquipmentQuality(item)}">${getEquipmentDisplayName(item)}</span>
                        <span class="equipment-item-effect">${effectText}</span>
                    </div>
                `;
                grid.appendChild(badge);
            });

            equipmentEl.appendChild(grid);
        } else {
            equipmentEl.innerHTML = '<p class="equipment-empty-text">No loot collected yet. Slimes collect unique loot when eating scraps from defeated enemies!</p>';
        }
    }

    const rerollBtnEl = document.getElementById('slimeModalRerollType');
    if (rerollBtnEl) {
        if (gameState.unlockedUpgrades && gameState.unlockedUpgrades.evolution && !slime.specialization) {
            rerollBtnEl.style.display = 'inline-flex';
            const canAffordReroll = (gameState.scraps || 0) >= 50;
            if (canAffordReroll) {
                rerollBtnEl.removeAttribute('disabled');
                rerollBtnEl.classList.remove('disabled');
            } else {
                rerollBtnEl.setAttribute('disabled', 'disabled');
                rerollBtnEl.classList.add('disabled');
            }
        } else {
            rerollBtnEl.style.display = 'none';
        }
    }

    if (killBtnEl) {
        if (gameState.unlockedUpgrades && gameState.unlockedUpgrades.selection) {
            killBtnEl.style.display = '';
        } else {
            killBtnEl.style.display = 'none';
        }
    }

    backdropEl.classList.remove('hidden');
    document.body.classList.add('modal-open');
    setGamePaused(true);
}

export function closeSlimeInspectorModal() {
    const backdropEl = document.getElementById('slimeModalBackdrop');
    if (backdropEl) backdropEl.classList.add('hidden');
    document.body.classList.remove('modal-open');
    setGamePaused(false);
}

/**
 * Initialize Slime Inspector Modal Event Listeners
 */
export function initSlimeModalListeners() {
    const backdropEl = document.getElementById('slimeModalBackdrop');
    const closeBtnEl = document.getElementById('slimeModalClose');
    const rerollBtnEl = document.getElementById('slimeModalRerollType');
    const killBtnEl = document.getElementById('slimeModalKill');
    const confirmBackdropEl = document.getElementById('slimeKillConfirmBackdrop');
    const confirmTextEl = document.getElementById('slimeKillConfirmText');
    const btnCancelKill = document.getElementById('btnCancelKillSlime');
    const btnConfirmKill = document.getElementById('btnConfirmKillSlime');
    const statsTabEl = document.getElementById('slimeSheetStatsTab');
    const talentTabEl = document.getElementById('slimeSheetTalentTab');
    const talentChoiceEls = document.querySelectorAll('.slime-talent-choice');
    if (statsTabEl) statsTabEl.addEventListener('click', () => setSlimeSheetTab('stats'));
    if (talentTabEl) talentTabEl.addEventListener('click', () => setSlimeSheetTab('talent'));
    talentChoiceEls.forEach(choice => choice.addEventListener('click', () => specializeInspectedSlime(choice.dataset.specialization)));

    if (closeBtnEl) {
        closeBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSlimeInspectorModal();
        });
    }

    if (rerollBtnEl) {
        rerollBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentInspectedSlime) return;
            const targetId = currentInspectedSlime.id || currentInspectedSlime.name;
            if ((gameState.scraps || 0) < 50) return;

            // 1. Highlight button yellow/orange & disable button during animation
            rerollBtnEl.classList.add('is-active');
            rerollBtnEl.setAttribute('disabled', 'disabled');

            // 2. Play 1s vibrating die.png portrait animation
            const portraitEl = document.getElementById('slimeModalPortrait');
            const currentSlimeType = currentInspectedSlime.type || 'base';
            const currentConfig = SLIME_TYPES[currentSlimeType] || SLIME_TYPES.base;

            if (portraitEl) {
                portraitEl.src = `${currentConfig.folder}/die.png`;
                portraitEl.style.objectPosition = '0px 0px';
                portraitEl.classList.add('slime-dying-vibrate');
            }

            // 3. After 1.0 second, execute reroll, update modal & UI, and restore portrait state
            setTimeout(() => {
                rerollBtnEl.classList.remove('is-active');

                const success = rerollSlimeType(targetId);

                if (portraitEl) {
                    portraitEl.classList.remove('slime-dying-vibrate');
                }

                if (success) {
                    const updatedSlime = gameState.slimes ? gameState.slimes.find(s => (s.id === targetId || s.name === targetId)) : currentInspectedSlime;
                    openSlimeInspectorModal(updatedSlime || currentInspectedSlime);
                    updateUI();
                } else {
                    portraitEl.src = getSlimeJumpSprite(currentInspectedSlime);
                    portraitEl.style.objectPosition = '0px 0px';
                    openSlimeInspectorModal(currentInspectedSlime);
                }
            }, 1000);
        });
    }

    if (killBtnEl) {
        killBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentInspectedSlime || (gameState.slimes && gameState.slimes.length <= 1)) return;
            if (confirmTextEl) {
                confirmTextEl.textContent = `Are you sure you want to sacrifice "${currentInspectedSlime.name || 'this slime'}"?`;
            }
            if (confirmBackdropEl) {
                confirmBackdropEl.classList.remove('hidden');
            }
        });
    }

    if (btnCancelKill) {
        btnCancelKill.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirmBackdropEl) confirmBackdropEl.classList.add('hidden');
        });
    }

    if (confirmBackdropEl) {
        confirmBackdropEl.addEventListener('click', (e) => {
            if (e.target === confirmBackdropEl) {
                confirmBackdropEl.classList.add('hidden');
            }
        });
    }

    if (btnConfirmKill) {
        btnConfirmKill.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentInspectedSlime) return;
            const targetId = currentInspectedSlime.id || currentInspectedSlime.name;
            const success = killSlime(targetId);
            if (confirmBackdropEl) confirmBackdropEl.classList.add('hidden');
            if (success) {
                closeSlimeInspectorModal();
                updateUI();
            }
        });
    }

    if (backdropEl) {
        backdropEl.addEventListener('click', (e) => {
            if (e.target === backdropEl) {
                closeSlimeInspectorModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (confirmBackdropEl && !confirmBackdropEl.classList.contains('hidden')) {
                confirmBackdropEl.classList.add('hidden');
            } else {
                closeSlimeInspectorModal();
            }
        }
    });
}

/**
 * Initialize Main Navigation Tab Listeners (Battlefield vs Upgrades)
 */
export function initMainTabsListeners() {
    const btnBattlefield = document.getElementById('tabBtnBattlefield');
    const btnUpgrades = document.getElementById('tabBtnUpgrades');
    const contentBattlefield = document.getElementById('tabContentBattlefield');
    const contentUpgrades = document.getElementById('tabContentUpgrades');

    const switchTab = (activeTab) => {
        const isDesktop = window.innerWidth > 900;
        if (activeTab === 'upgrades' && !isDesktop) {
            if (btnUpgrades) btnUpgrades.classList.add('active');
            if (btnBattlefield) btnBattlefield.classList.remove('active');
            if (contentUpgrades) contentUpgrades.classList.remove('hidden');
            if (contentBattlefield) contentBattlefield.classList.add('hidden');

            // Pause game while on Upgrades tab on mobile
            setGamePaused(true);
            updateUpgradesUI();
        } else {
            if (btnBattlefield) btnBattlefield.classList.add('active');
            if (btnUpgrades) btnUpgrades.classList.remove('active');
            if (contentBattlefield) contentBattlefield.classList.remove('hidden');
            if (contentUpgrades) contentUpgrades.classList.add('hidden');

            // Unpause game when on Battlefield tab or desktop view
            setGamePaused(false);
        }
    };

    if (btnBattlefield) {
        btnBattlefield.addEventListener('click', () => switchTab('battlefield'));
    }
    if (btnUpgrades) {
        btnUpgrades.addEventListener('click', () => switchTab('upgrades'));
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            setGamePaused(false);
            updateUpgradesUI();
        }
    });
}

