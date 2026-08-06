/**
 * User Interface & Authentication Screen Renderer
 */

import { gameState, SLIME_TYPES, killSlime, syncSlimesArray, rerollSlimeType, calculateSlimeDamage } from './state.js';
import { updateUpgradesUI } from './upgrades.js';
import { activeGroundLoots, formatLootEffects } from './enemies.js';
import { setGamePaused, isGamePaused } from './engine.js';

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
let currentInspectedSlime = null;
let isRainAnimating = false;

/**
 * Main UI Update Function
 */
export function updateUI() {
    if (scrapsCountEl) scrapsCountEl.textContent = gameState.scraps || 0;
    if (scoreCountEl) scoreCountEl.textContent = gameState.score || 0;
    if (waveCountEl) waveCountEl.textContent = gameState.currentWave || 1;
    if (armySizeCountEl) armySizeCountEl.textContent = gameState.armySize || 0;

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
    const eatLootCountEl = document.getElementById('eatLootCount');
    if (eatBtnEl && eatLootCountEl) {
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

    if (!armyContainerEl || armyContainerEl.children.length === 0 || lastRenderedArmySize !== gameState.armySize) {
        lastRenderedArmySize = gameState.armySize;
        renderSlimeArmy();
    }

    updateSlimeRoster();
    updateUpgradesUI();
}

/**
 * Render Slime Health Status Array on the left side of the main window
 */
function updateSlimeRoster() {
    const rosterListEl = document.getElementById('slimeRosterList') || document.getElementById('rosterList');
    const rosterCountEl = document.getElementById('rosterCount');
    if (!rosterListEl) return;

    const activeCount = gameState.slimes ? gameState.slimes.length : 0;
    if (rosterCountEl) {
        rosterCountEl.textContent = `${activeCount} Slimes`;
    }

    // Map active slimes by slotIndex
    const slimesBySlot = new Map();
    let maxSlotIndex = 0;

    if (gameState.slimes) {
        gameState.slimes.forEach(s => {
            const slot = s.slotIndex !== undefined ? s.slotIndex : 0;
            slimesBySlot.set(slot, s);
            if (slot > maxSlotIndex) maxSlotIndex = slot;
        });
    }

    // Check bestRoster so slimes at the end of the roster also render as vacant slots when dead
    if (gameState.bestRoster) {
        gameState.bestRoster.forEach(b => {
            const slot = b.slotIndex !== undefined ? b.slotIndex : 0;
            if (slot > maxSlotIndex) maxSlotIndex = slot;
        });
    }

    const currentNodes = Array.from(rosterListEl.children);

    // Render slots 0 through maxSlotIndex in numerical order
    for (let s = 0; s <= maxSlotIndex; s++) {
        const slime = slimesBySlot.get(s);
        const existingNode = currentNodes[s];

        if (slime) {
            const isAscended = slime.ascended === true;
            const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
            const displayName = slime.name || slime.id || slimeConfig.name;
            const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);

            let barColor = '#10b981';
            if (hpPct < 35) barColor = '#ef4444';
            else if (hpPct < 65) barColor = '#f59e0b';

            // Check if we can reuse the existing node
            if (existingNode &&
                existingNode.classList.contains('roster-grid-item') &&
                !existingNode.classList.contains('empty-slot') &&
                existingNode.dataset.slimeId === String(slime.id)) {

                // Only update HP bar fill style and title without resetting innerHTML!
                existingNode.title = `[Slot #${s + 1}] ${displayName} (${slimeConfig.name})${isAscended ? ' ✨' : ''}: ${slime.hp}/${slime.maxHp} HP`;
                existingNode.classList.toggle('ascended', isAscended);

                const rosterIcon = existingNode.querySelector('.roster-grid-icon');
                const iconSrc = `${slimeConfig.folder}/jump.png`;
                if (rosterIcon && rosterIcon.getAttribute('src') !== iconSrc) {
                    rosterIcon.src = iconSrc;
                    rosterIcon.alt = displayName;
                }

                const hpFill = existingNode.querySelector('.roster-hp-fill');
                if (hpFill) {
                    hpFill.style.width = `${hpPct}%`;
                    hpFill.style.background = barColor;
                }
            } else {
                const item = document.createElement('div');
                item.className = isAscended ? 'roster-grid-item ascended' : 'roster-grid-item';
                item.id = `roster_item_${slime.id}`;
                item.dataset.slimeId = String(slime.id);
                item.title = `[Slot #${s + 1}] ${displayName} (${slimeConfig.name})${isAscended ? ' ✨' : ''}: ${slime.hp}/${slime.maxHp} HP`;

                const iconSrc = `${slimeConfig.folder}/jump.png`;
                item.innerHTML = `
                    <img src="${iconSrc}" alt="${displayName}" class="roster-grid-icon">
                    <div class="roster-grid-hp-bar">
                        <div class="roster-hp-fill" style="width: ${hpPct}%; background: ${barColor};"></div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    openSlimeInspectorModal(slime);
                });

                if (existingNode) {
                    existingNode.replaceWith(item);
                } else {
                    rosterListEl.appendChild(item);
                }
            }
        } else {
            // Vacant/empty slot placeholder in roster
            const fallenSlime = (gameState.bestRoster || []).find(b => b.slotIndex === s);
            const fallenName = fallenSlime ? (fallenSlime.name || fallenSlime.id) : null;
            const ripTitle = fallenName ? `RIP ${fallenName}...` : `RIP Slot #${s + 1}...`;

            if (existingNode && existingNode.classList.contains('empty-slot') && existingNode.title === ripTitle) {
                // Already RIP and matches - do nothing!
            } else {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'roster-grid-item empty-slot';
                emptyItem.id = `roster_item_empty_${s}`;
                emptyItem.title = ripTitle;
                emptyItem.innerHTML = `
                    <div class="roster-empty-icon">💀</div>
                `;

                if (existingNode) {
                    existingNode.replaceWith(emptyItem);
                } else {
                    rosterListEl.appendChild(emptyItem);
                }
            }
        }
    }

    // Remove any extra trailing slots if maxSlotIndex has shrunk
    while (rosterListEl.children.length > maxSlotIndex + 1) {
        rosterListEl.lastElementChild.remove();
    }

    // Update --roster-height CSS variable dynamically so upgrades container fits viewport perfectly
    const rosterPanelEl = document.querySelector('.slime-status-panel');
    if (rosterPanelEl) {
        requestAnimationFrame(() => {
            const height = rosterPanelEl.offsetHeight || 60;
            document.documentElement.style.setProperty('--roster-height', `${height}px`);
        });
    }
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
 * Render Slime Army Stack in 3D Perspective with Fixed Slot Indexing
 */
function renderSlimeArmy() {
    if (!armyContainerEl || isRainAnimating) return;
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
        const coords = getSlimeSlotCoordinates(slot);

        const existingUnit = armyContainerEl.querySelector(`.slime-unit[data-slime-id="${slimeId}"]`);
        if (existingUnit) {
            slimeObj.el = existingUnit;
            slimeObj.statusRowEl = existingUnit.querySelector('.slime-status-row');
            if (existingUnit.dataset.isAttacking !== 'true' && existingUnit.dataset.isEating !== 'true') {
                existingUnit.style.left = `${coords.posX}px`;
                existingUnit.style.top = `${coords.posY}px`;
                existingUnit.style.zIndex = `${coords.calculatedZ}`;
                existingUnit.dataset.originalZ = `${coords.calculatedZ}`;
            }
            return;
        }

        const slimeConfig = SLIME_TYPES[slimeObj.type] || SLIME_TYPES.base;
        const slimeImgSrc = `${slimeConfig.folder}/jump.png`;

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
        userAvatarEl.src = user.photoURL || 'https://via.placeholder.com/32';
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

    const slimePositions = [];
    let globalSlimeIndex = 0;

    for (let l = 0; l < layers.length && globalSlimeIndex < totalSlimes; l++) {
        const layer = layers[l];
        const slimesInThisLayer = Math.min(layer.maxSlimes, totalSlimes - globalSlimeIndex);
        let layerSlimeCount = 0;

        for (let r = 0; r < layer.rings.length && layerSlimeCount < slimesInThisLayer; r++) {
            const ring = layer.rings[r];
            const countInRing = Math.min(ring.count, slimesInThisLayer - layerSlimeCount);
            for (let k = 0; k < countInRing; k++) {
                const i = globalSlimeIndex;
                const slimeObj = gameState.slimes && gameState.slimes[i] ? gameState.slimes[i] : { id: i + 1, type: 'base' };
                const slimeId = String(slimeObj.id);

                const angleOffset = (r % 2 === 1) ? 0.3 : 0;
                const angle = (k / ring.count) * 2 * Math.PI + angleOffset;

                const jitterX = pseudoRandom(i, 1) * 2.5;
                const jitterY = pseudoRandom(i, 2) * 2;

                const posX = Math.floor(centerX + Math.cos(angle) * ring.radiusX + jitterX);
                const posY = Math.floor(centerY + Math.sin(angle) * ring.radiusY + jitterY + layer.yOffset);
                const zIndex = Math.floor(posY + 10);
                const animDelay = (Math.abs(pseudoRandom(i, 3)) * 2.5).toFixed(2);
                const shadowHTML = (l === 0) ? '<div class="slime-shadow-sm"></div>' : '';

                slimePositions.push({
                    index: i,
                    slimeObj,
                    slimeId,
                    posX,
                    posY,
                    zIndex,
                    layerIndex: l,
                    animDelay,
                    shadowHTML
                });

                layerSlimeCount++;
                globalSlimeIndex++;
            }
        }
    }

    // Drop slimes 1 by 1 every 0.05s (50ms)
    slimePositions.forEach((pos, idx) => {
        const dropDelay = idx * 50;

        setTimeout(() => {
            if (!armyContainerEl) return;

            const slimeConfig = SLIME_TYPES[pos.slimeObj.type] || SLIME_TYPES.base;
            const sheetUrl = `${slimeConfig.folder}/jump.png`;

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

    if (portraitEl) {
        portraitEl.src = `${slimeConfig.folder}/jump.png`;
        portraitEl.style.objectPosition = '0px 0px';
    }
    if (nameEl) nameEl.textContent = slime.name || slimeConfig.name || 'Slime';
    if (badgeEl) {
        badgeEl.textContent = isAscended ? `${slimeConfig.name} ✨` : slimeConfig.name;
    }

    const currentHp = slime.hp !== undefined ? slime.hp : 10;
    const maxHp = slime.maxHp || 10;
    if (hpEl) hpEl.textContent = `${currentHp} / ${maxHp} HP`;

    if (hpBarEl) {
        const hpPct = Math.max(0, (currentHp / maxHp) * 100);
        hpBarEl.style.width = `${hpPct}%`;
        if (hpPct < 35) hpBarEl.style.background = '#ef4444';
        else if (hpPct < 65) hpBarEl.style.background = '#f59e0b';
        else hpBarEl.style.background = '#10b981';
    }

    const baseDmg = calculateSlimeDamage(slime);
    if (damageEl) damageEl.textContent = `${baseDmg} ⚔️`;

    const critEl = document.getElementById('slimeModalCrit');
    const regenEl = document.getElementById('slimeModalRegen');
    const xpEl = document.getElementById('slimeModalXp');

    const critChance = slime.critChance || 0;
    if (critEl) critEl.textContent = `${critChance}% ⚡`;

    const regenVal = slime.regen || 0;
    if (regenEl) regenEl.textContent = `${regenVal} 💚`;

    if (xpEl) xpEl.textContent = `${slime.wavesClearedSinceDeath || 0}`;

    const activeEffects = [];
    if (slimeConfig.effect === 'burn') activeEffects.push('🔥 Burn');
    else if (slimeConfig.effect === 'freeze') activeEffects.push('❄️ Freeze');
    else if (slimeConfig.effect === 'stun') activeEffects.push('💫 Stun');
    else if (slimeConfig.effect === 'poison') activeEffects.push('🧪 Poison');

    if (slime.equipment && slime.equipment.length > 0) {
        slime.equipment.forEach(eq => {
            if (eq.stat === 'effect' || eq.effectType) {
                if (eq.effectType === 'burn' && !activeEffects.includes('🔥 Burn')) activeEffects.push('🔥 Burn');
                else if (eq.effectType === 'poison' && !activeEffects.includes('🧪 Poison')) activeEffects.push('🧪 Poison');
                else if (eq.effectType === 'freeze' && !activeEffects.includes('❄️ Freeze')) activeEffects.push('❄️ Freeze');
                else if (eq.effectType === 'stun' && !activeEffects.includes('💫 Stun')) activeEffects.push('💫 Stun');
            }
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
                const effectText = formatLootEffects(item.effects || item);
                badge.title = item.name + ': ' + effectText;

                badge.innerHTML = `
                    <img src="${item.sprite}" alt="${item.name}" class="equipment-icon-img"
                         onerror="this.onerror=null; this.src='images/loots/boot.png';">
                    <div class="equipment-item-info">
                        <span class="equipment-item-name">${item.name}</span>
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
        if (gameState.unlockedUpgrades && gameState.unlockedUpgrades.evolution) {
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
                    portraitEl.src = `${currentConfig.folder}/jump.png`;
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

