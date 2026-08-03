/**
 * User Interface & Authentication Screen Renderer
 */

import { gameState, SLIME_TYPES } from './state.js';

const scrapsCountEl = document.getElementById('scrapsCount');
const waveCountEl = document.getElementById('waveCount');
const armySizeCountEl = document.getElementById('armySizeCount');
const armyContainerEl = document.getElementById('armyContainer');
const authGateEl = document.getElementById('authGate');
const gameScreenEl = document.getElementById('gameScreen');
const firebaseNoticeEl = document.getElementById('firebaseNotice');

// Primary Slime Image path
const SLIME_IMG_SRC = 'images/slimes/base/slime1.png';
const SLIME_FALLBACK_SRC = 'images/slimes/army.png';

let lastRenderedArmySize = -1;

/**
 * Main UI Update Function
 */
export function updateUI() {
    if (scrapsCountEl) scrapsCountEl.textContent = gameState.scraps || 0;
    if (waveCountEl) waveCountEl.textContent = gameState.currentWave || 1;
    if (armySizeCountEl) armySizeCountEl.textContent = gameState.armySize || 0;

    if (!armyContainerEl || armyContainerEl.children.length === 0 || lastRenderedArmySize !== gameState.armySize) {
        lastRenderedArmySize = gameState.armySize;
        renderSlimeArmy();
    }

    updateSlimeRoster();
}

/**
 * Render Slime Health Status Array on the left side of the main window
 */
function updateSlimeRoster() {
    const rosterListEl = document.getElementById('slimeRosterList') || document.getElementById('rosterList');
    const rosterCountEl = document.getElementById('rosterCount');
    if (!rosterListEl) return;

    if (rosterCountEl) {
        rosterCountEl.textContent = `${gameState.slimes ? gameState.slimes.length : 0} Slimes`;
    }

    if (!gameState.slimes) return;

    rosterListEl.innerHTML = '';
    gameState.slimes.forEach((slime) => {
        const item = document.createElement('div');
        item.className = 'roster-grid-item';
        item.id = `roster_item_${slime.id}`;
        item.title = `${slime.name}: ${slime.hp}/${slime.maxHp} HP`;
        
        const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);
        const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
        const iconSrc = `${slimeConfig.folder}/${slimeConfig.prefix}1.png`;

        item.innerHTML = `
            <img src="${iconSrc}" alt="${slime.name}" class="roster-grid-icon">
            <div class="roster-grid-hp-bar">
                <div class="roster-hp-fill" id="roster_hp_fill_${slime.id}" style="width: ${hpPct}%"></div>
            </div>
        `;
        rosterListEl.appendChild(item);
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
 * Render Slime Army Pyramid Stack in 3D Perspective
 */
function renderSlimeArmy() {
    if (!armyContainerEl) return;

    armyContainerEl.innerHTML = '';
    
    const centerX = 95;
    const centerY = 92;

    // Definition of the 3 Pyramid Layers
    const layers = [
        {
            maxSlimes: 30,
            yOffset: 0,
            zBase: 0,
            rings: [
                { count: 1,  radiusX: 0,  radiusY: 0 },
                { count: 6,  radiusX: 16, radiusY: 9 },
                { count: 11, radiusX: 30, radiusY: 16 },
                { count: 12, radiusX: 44, radiusY: 23 }
            ]
        },
        {
            maxSlimes: 20,
            yOffset: -12, // Stacked 12px higher in 3D vertical space
            zBase: 100,  // Always renders ON TOP of Layer 1
            rings: [
                { count: 1,  radiusX: 0,  radiusY: 0 },
                { count: 6,  radiusX: 14, radiusY: 8 },
                { count: 13, radiusX: 28, radiusY: 15 }
            ]
        },
        {
            maxSlimes: 10,
            yOffset: -24, // Stacked 24px higher in 3D vertical space
            zBase: 200,   // Always renders ON TOP of Layer 2 & 1
            rings: [
                { count: 1, radiusX: 0,  radiusY: 0 },
                { count: 9, radiusX: 16, radiusY: 9 }
            ]
        }
    ];

    let globalSlimeIndex = 0;

    for (let l = 0; l < layers.length && globalSlimeIndex < gameState.armySize; l++) {
        const layer = layers[l];
        const slimesInThisLayer = Math.min(layer.maxSlimes, gameState.armySize - globalSlimeIndex);
        let layerSlimeCount = 0;

        for (let r = 0; r < layer.rings.length && layerSlimeCount < slimesInThisLayer; r++) {
            const ring = layer.rings[r];
            const countInRing = Math.min(ring.count, slimesInThisLayer - layerSlimeCount);
            for (let k = 0; k < countInRing; k++) {
                const i = globalSlimeIndex;
                const slimeObj = gameState.slimes && gameState.slimes[i] ? gameState.slimes[i] : { type: 'base' };
                const slimeConfig = SLIME_TYPES[slimeObj.type] || SLIME_TYPES.base;
                const slimeImgSrc = `${slimeConfig.folder}/${slimeConfig.prefix}1.png`;

                const unit = document.createElement('div');
                unit.className = 'slime-unit';
                unit.dataset.layer = `${l + 1}`;
                unit.dataset.slimeId = `${i + 1}`;
                unit.dataset.slimeType = slimeObj.type;

                const angleOffset = (r % 2 === 1) ? 0.3 : 0;
                const angle = (k / ring.count) * 2 * Math.PI + angleOffset;

                const jitterX = pseudoRandom(i, 1) * 2.5;
                const jitterY = pseudoRandom(i, 2) * 2;

                const posX = Math.floor(centerX + Math.cos(angle) * ring.radiusX + jitterX);
                const posY = Math.floor(centerY + Math.sin(angle) * ring.radiusY + jitterY + layer.yOffset);

                unit.style.position = 'absolute';
                unit.style.left = `${posX}px`;
                unit.style.top = `${posY}px`;
                
                // 3D Depth Sorting: Layer zBase + Y position
                unit.style.zIndex = `${layer.zBase + Math.floor(posY)}`;

                // Asynchronous bounce delay
                const animDelay = (Math.abs(pseudoRandom(i, 3)) * 2.5).toFixed(2);
                
                // Ground shadow only for base layer slimes (layer 0)
                const shadowHTML = (l === 0) ? '<div class="slime-shadow-sm"></div>' : '';

                unit.innerHTML = `
                    <img src="${slimeImgSrc}" 
                         onerror="this.onerror=null; this.src='${SLIME_FALLBACK_SRC}';" 
                         alt="${slimeConfig.name}" 
                         class="slime-img" 
                         style="animation-delay: ${animDelay}s">
                    ${shadowHTML}
                `;
                armyContainerEl.appendChild(unit);

                layerSlimeCount++;
                globalSlimeIndex++;
            }
        }
    }
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
