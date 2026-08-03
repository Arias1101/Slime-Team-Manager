/**
 * Enemy Management & AI Behaviors
 */

import { gameState, addScraps, saveStateToLocal, saveWaveSnapshot, restoreBestRoster } from './state.js';
import { healAllSlimes, initAscendedAutoAttacks, clearAscendedAutoAttacks, showFloatingDamageNumber, showFloatingStatusTextAt, showBattlefieldWaveBanner } from './slimes.js';
import { updateUI, playSlimeRainRespawnAnimation } from './ui.js';
import { openShopModal } from './shop.js';

export const ENEMY_TYPES = {
    // Tier X - Bosses ------------------------
    mage: {
        id: 'mage',
        name: 'Elemental Mage',
        type: 'ranged',
        projectile: 'fireball',
        hp: 150,
        maxHp: 150,
        damage: 7,            // Damage per projectile
        attackSpeed: 0.5,     // attacks per second
        moveSpeed: 1,
        targetX: 380,         // 400=right border, 100 = Slime army
        loot_value: 100,
        loot_effect: [{ stat: 'effect', effectType: 'freeze', text: '❄️ Freeze' },
        { stat: 'effect', effectType: 'burn', value: 1, text: '🔥 Burn' }]
    },
    berserker: {
        id: 'berserker',
        name: 'Berserker',
        type: 'melee',
        hp: 500,
        maxHp: 500,
        damage: 15,            // Damages
        attackSpeed: 1,     // attacks per second
        moveSpeed: 5,
        targetX: 100,         // 400=right border, 100 = Slime army
        loot_value: 200,
        loot_effect: [{ stat: 'damage', value: 5, text: '+5 Damage' },
        { stat: 'hp', value: 5, text: '+5 Max HP' }]
    },

    // Tier1 - Villagers ------------------------
    beggar: {
        id: 'beggar',
        name: 'Beggar',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 1,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 130,         // Close melee range near the slimes
        loot_value: 2,
        loot_effect: { stat: 'hp', value: 1, text: '+1 Max HP' }
    },
    farmer: {
        id: 'farmer',
        name: 'Farmer',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 140,         // Close melee range near the slimes
        loot_value: 2,
        loot_effect: { stat: 'hp', value: 1, text: '+1 Max HP' }
    },
    torchfarmer: {
        id: 'torchfarmer',
        name: 'Torch Farmer',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 3,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 110,         // Close melee range near the slimes
        loot_value: 10,
        loot_effect: [
            { stat: 'effect', effectType: 'burn', value: 1, text: '🔥 Burn' },
            { stat: 'hp', value: -3, text: '-3 Max HP' }
        ]
    },
    fisher: {
        id: 'fisher',
        name: 'Fisherman',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.3,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 130,         // Close melee range near the slimes
        loot_value: 6,
        loot_effect: { stat: 'hp', value: 2, text: '+2 Max HP' }
    },
    thief: {
        id: 'thief',
        name: 'Thief',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 7,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 100,         // Close melee range near the slimes
        loot_value: 10,
        loot_effect: { stat: 'crit', value: 10, text: '+10% Crit' }
    },

    // Tier2 - Adventurers -------------------------
    guard: {
        id: 'guard',
        name: 'Guard',
        type: 'melee',        // Melee attacker
        hp: 20,                // 5 HP
        maxHp: 20,
        damage: 3,            // 4 Damage per attack
        attackSpeed: 0.5,     // 1 attack per second
        moveSpeed: 1.5,       // Move speed
        targetX: 130,         // Close melee range near the slimes
        loot_value: 10,
        loot_effect: { stat: 'hp', value: 2, text: '+2 Max HP' }
    },
    archer: {
        id: 'archer',
        name: 'Archer',
        type: 'ranged',       // Ranged attacker
        projectile: 'arrow',  // Arrow projectile type
        hp: 12,
        maxHp: 12,
        damage: 2,            // 2 Damage per projectile
        attackSpeed: 0.5,     // 0.8 attacks per second
        moveSpeed: 1.4,
        targetX: 380,         // Right boundary
        loot_value: 8,
        loot_effect: { stat: 'crit', value: 5, text: '+5% Crit' }
    },
    adventurer: {
        id: 'adventurer',
        name: 'Adventurer',
        type: 'melee',        // Melee attacker
        hp: 14,                // 4 HP
        maxHp: 14,
        damage: 2,            // 3 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.7,       // Move speed
        targetX: 130,         // Close melee range near the slimes
        loot_value: 10,
        loot_effect: { stat: 'regen', value: 1, text: '+1 HP Regen' }
    },
    assassin: {
        id: 'assassin',
        name: 'Assassin',
        type: 'melee',        // Melee attacker
        hp: 14,                // 4 HP
        maxHp: 14,
        damage: 1,            // 3 Damage per attack
        attackSpeed: 0.5,     // 1 attack per second
        moveSpeed: 10,       // Move speed
        targetX: 130,         // Close melee range near the slimes
        loot_value: 20,
        loot_effect: { stat: 'effect', effectType: 'poison', value: 1, text: '🧪 Poison' }
    },
    lancer: {
        id: 'lancer',
        name: 'Lancer',
        type: 'melee',        // Melee attacker
        hp: 15,                // 4 HP
        maxHp: 15,
        damage: 1,            // 3 Damage per attack
        attackSpeed: 0.8,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 150,         // Close melee range near the slimes
        loot_value: 10,
        loot_effect: [{ stat: 'crit', value: 2, text: '+2% Crit' },
        { stat: 'damage', value: 1, text: '+1 Damage' }]
    },
    lumberjack: {
        id: 'lumberjack',
        name: 'Lumberjack',
        type: 'melee',        // Melee attacker
        hp: 20,                // 4 HP
        maxHp: 20,
        damage: 10,            // 3 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 100,         // Close melee range near the slimes
        loot_value: 6,
        loot_effect: [{ stat: 'hp', value: 2, text: '+2 Max HP' },
        { stat: 'damage', value: 1, text: '+1 Damage' }]
    },


    // Tier 3 - Army
    soldier: {
        id: 'soldier',
        name: 'Soldier',
        type: 'melee',        // Melee attacker
        hp: 27,                // 5 HP
        maxHp: 27,
        damage: 2,
        attackSpeed: 0.6,     // attack per second
        moveSpeed: 1.8,       // Move speed
        targetX: 130,         // Close melee range near the slimes
        loot_value: 20,
        loot_effect: { stat: 'damage', value: 2, text: '+2 Damage' }
    },
    soldier2h: {
        id: 'soldier2h',
        name: 'Greatsword Soldier',
        type: 'melee',        // Melee attacker
        hp: 15,                // 5 HP
        maxHp: 15,
        damage: 5,            // 4 Damage per attack
        attackSpeed: 0.6,     // 1 attack per second
        moveSpeed: 5,       // Move speed
        targetX: 130,         // Close melee range near the slimes
        loot_value: 30,
        loot_effect: { stat: 'damage', value: 2, text: '+2 Damage' }
    },
    tank: {
        id: 'tank',
        name: 'Knight',
        type: 'tank',         // Tank defender
        hp: 35,
        maxHp: 35,
        damage: 1,
        attackSpeed: 0.5,     // 0.5 attacks per second
        moveSpeed: 1.5,
        targetX: 250,         // Center of battlefield
        loot_value: 20,
        loot_effect: { stat: 'hp', value: 3, text: '+10 Max HP' }
    },

    // Tests
    test: {
        id: 'tank',
        name: 'Test Knight',
        type: 'tank',         // Tank defender
        hp: 99999,
        maxHp: 99999,
        damage: 1,
        attackSpeed: 0,     // 0.5 attacks per second
        moveSpeed: 0.6,       // Slow move speed
        targetX: 250,         // Center of battlefield
        loot_value: 100,
        loot_effect: { stat: 'hp', value: 1, text: '+1 Max HP' }
    }
};

export const PROJECTILE_TYPES = {
    arrow: {
        id: 'arrow',
        className: 'projectile-arrow',
        arcHeight: 25, // Curved arc height in px
        duration: 0.5  // Parabolic flight time in seconds
    },
    fireball: {
        id: 'fireball',
        className: 'projectile-fireball',
        arcHeight: 30, // Smooth arc height in px
        duration: 0.5  // Fast & snappy flight time matching arrows
    }
};

export let activeEnemies = [];
export let activeProjectiles = [];
export let activeGroundLoots = [];

let isAutoPlay = true; // Game is always playing by default
let isWaveActive = false;
let autoWaveTimeoutId = null;

export function initEnemiesModule() {
    updateControlButtonsUI();
}

export function setAutoPlay(enabled) {
    isAutoPlay = enabled;
    updateControlButtonsUI();

    if (isAutoPlay) {
        if (!isWaveActive && activeEnemies.length === 0) {
            startNextWave();
        }
    } else {
        if (autoWaveTimeoutId) {
            clearTimeout(autoWaveTimeoutId);
            autoWaveTimeoutId = null;
        }
    }
}

export function updateControlButtonsUI() {
    const btnPlay = document.getElementById('btnPlay');
    const btnPause = document.getElementById('btnPause');

    if (btnPlay && btnPause) {
        if (isAutoPlay) {
            btnPlay.className = 'btn btn-success btn-md btn-auto-play active';
            btnPause.className = 'btn btn-outline btn-md btn-auto-pause';
        } else {
            btnPlay.className = 'btn btn-outline btn-md btn-auto-play';
            btnPause.className = 'btn btn-outline btn-md btn-auto-pause active';
        }
    }
}

/**
 * Fisher-Yates shuffle array utility to randomize wave spawn order
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Parse raw wave composition list, expanding 'type:count' entries (e.g. 'archer:10' -> 10 archers)
 * and randomizing their spawn order for maximum wave diversity.
 */
export function parseEnemyList(rawList) {
    const expanded = [];
    if (!Array.isArray(rawList)) return expanded;

    rawList.forEach(item => {
        if (typeof item === 'string') {
            if (item.includes(':')) {
                const parts = item.split(':');
                const typeId = parts[0].trim();
                const count = parseInt(parts[1], 10) || 1;
                for (let i = 0; i < count; i++) {
                    expanded.push(typeId);
                }
            } else {
                expanded.push(item.trim());
            }
        } else if (typeof item === 'object' && item !== null) {
            const typeId = item.type || item.id;
            const count = item.count || 1;
            for (let i = 0; i < count; i++) {
                expanded.push(typeId);
            }
        }
    });

    // Shuffle the expanded list to randomize spawn order
    return shuffleArray(expanded);
}

/**
 * Generate wave enemy composition list
 * First element is the spawn interval in seconds between enemies in the wave.
 * Enemy entries support 'type:count' syntax (e.g., 'archer:10', 'soldier:3').
 */
function generateWaveComposition(waveNum) {
    // 1-10, Manual play, Villagers
    if (waveNum === 1) return [0, 'beggar:1'];
    if (waveNum === 2) return [0, 'beggar:2', 'farmer'];
    if (waveNum === 3) return [0.5, 'farmer:3', 'fisher:2'];
    if (waveNum === 4) return [0.1, 'thief:1', 'guard:1'];
    if (waveNum === 5) return [0.2, 'beggar:7', 'torchfarmer:1'];
    if (waveNum === 6) return [0.2, 'fisher:10', 'torchfarmer:5'];
    if (waveNum === 7) return [0.4, 'farmer:15', 'torchfarmer:2'];
    if (waveNum === 8) return [0.8, 'beggar:8', 'farmer:2', 'torchfarmer:2', 'fisher:2'];
    if (waveNum === 9) return [0.8, 'torchfarmer3:9', 'farmer:3', 'beggar:2', 'fisher:3'];
    if (waveNum === 10) return [0, 'mage:1'];

    // 11-20 Autoplay, Adventurers
    if (waveNum === 11) return [0.1, 'adventurer:2', 'archer:3'];
    if (waveNum === 12) return [0.1, 'adventurer:2', 'assassin:2', 'archer:3'];
    if (waveNum === 13) return [0.1, 'assassin:4', 'lumberjack:2', 'archer:3'];
    if (waveNum === 14) return [0.1, 'lumberjack:5', 'lancer:3', 'archer:3'];
    if (waveNum === 15) return [0.1, 'lancer:3', 'guard:5', 'archer:5'];
    if (waveNum === 16) return [0.1, 'guard:10', 'archer:6'];
    if (waveNum === 17) return [0.1, 'guard:10', 'lancer:5', 'adventurer:2', 'archer:2'];
    if (waveNum === 18) return [0.1, 'guard:7', 'archer:15'];
    if (waveNum === 19) return [0.1, 'assassin:15', 'archer:15'];
    if (waveNum === 20) return [0.1, 'berserker:1', 'archer:5'];

    // Infinite mode: Soft HP % Multiplier scaling (+10% per wave beyond wave 11: +10% wave 12, +20% wave 13, +30% wave 14...)
    else {
        // Test tank
        return [0, 'test:1'];

        // Infinite scaling waves
        const hpMultiplier = 1.0 + Math.max(0, waveNum - 11) * 0.10;
        return {
            interval: 0.5,
            hpMultiplier: hpMultiplier,
            enemies: ['tank:5', 'adventurer:5', 'soldier2h:' + waveNum, 'archer:5']
        };
    }
}

/**
 * Starts the next wave: Spawns enemies with dynamic wave spawn timing
 */
export function startNextWave() {
    if (autoWaveTimeoutId) {
        clearTimeout(autoWaveTimeoutId);
        autoWaveTimeoutId = null;
    }

    // Clear existing active enemies and projectiles
    activeEnemies.forEach(e => {
        if (e.el) e.el.remove();
    });
    activeEnemies = [];
    activeProjectiles.forEach(p => {
        if (p.el) p.el.remove();
    });
    activeProjectiles = [];

    isWaveActive = true;
    const waveData = generateWaveComposition(gameState.currentWave);

    let spawnIntervalSec = 1.2;
    let rawEnemyList = [];
    let currentWaveHpMultiplier = 1.0;

    if (Array.isArray(waveData)) {
        if (typeof waveData[0] === 'number') {
            spawnIntervalSec = waveData[0];
            rawEnemyList = waveData.slice(1);
        } else {
            rawEnemyList = waveData;
        }
    } else if (typeof waveData === 'object' && waveData !== null) {
        spawnIntervalSec = waveData.interval !== undefined ? waveData.interval : 1.2;
        rawEnemyList = waveData.enemies || [];
        currentWaveHpMultiplier = waveData.hpMultiplier !== undefined ? waveData.hpMultiplier : 1.0;
    }

    const enemyList = parseEnemyList(rawEnemyList);
    const intervalMs = Math.max(0, spawnIntervalSec * 1000);

    // Spawn enemies based on configured interval (0 = instant spawn)
    enemyList.forEach((enemyType, idx) => {
        if (intervalMs === 0) {
            spawnEnemy(enemyType, currentWaveHpMultiplier);
        } else {
            setTimeout(() => {
                spawnEnemy(enemyType, currentWaveHpMultiplier);
            }, idx * intervalMs);
        }
    });
}

/**
 * Full Reset action: Resets army to 1 base slime (no upgrades), scraps to 0, wave to 1, clears battlefield
 */
export function resetGameFull() {
    // 1. Reset state: Scraps 0, Score 0, Wave 1, Army back to 1 Base Slime with no upgrades
    gameState.scraps = 0;
    gameState.score = 0;
    gameState.currentWave = 1;
    gameState.maxWaveCleared = 0;
    gameState.armySize = 1;
    gameState.maxSlimesReached = 1;
    gameState.slimeDamage = 1;
    gameState.slimeRegen = 0;
    gameState.hasSlimeDied = false;
    gameState.digestionLevel = 0;
    gameState.ignitionLevel = 0;
    gameState.glaciationLevel = 0;
    gameState.petrificationLevel = 0;
    gameState.intoxicationLevel = 0;
    gameState.unlockedUpgrades = {
        division: false,
        ascension: false,
        augmentation: false,
        regen: false,
        digestion: false,
        selection: false,
        ignition: false,
        glaciation: false,
        petrification: false,
        intoxication: false
    };
    gameState.waveSnapshots = {};
    const initialName = 'Gooey';
    gameState.bestRoster = [
        { id: initialName, name: initialName, type: 'base', hp: 10, maxHp: 10, damage: 1, ascended: false, equipment: [] }
    ];
    gameState.slimes = [
        { id: initialName, name: initialName, type: 'base', hp: 10, maxHp: 10, damage: 1, ascended: false, equipment: [] }
    ];
    saveStateToLocal();

    // 2. Reset ascended auto-attack timers
    initAscendedAutoAttacks();

    // 3. Clear ground loots, active enemies & projectiles
    activeGroundLoots.forEach(l => {
        if (l.el) l.el.remove();
    });
    activeGroundLoots = [];

    activeEnemies.forEach(e => {
        if (e.el) e.el.remove();
    });
    activeEnemies = [];

    activeProjectiles.forEach(p => {
        if (p.el) p.el.remove();
    });
    activeProjectiles = [];

    // 4. Force DOM army container to clear and re-render 1 Base Slime
    const armyContainerEl = document.getElementById('armyContainer');
    if (armyContainerEl) armyContainerEl.innerHTML = '';

    // 5. Update UI & restart Wave 1
    updateUI();
    startNextWave();
}

/**
 * Check if the last enemy of the current wave died
 */
function checkWaveCompletion() {
    if (isWaveActive && activeEnemies.length === 0) {
        isWaveActive = false;
        console.log('[WAVE CLEARED] Last enemy defeated!');

        // Clear all status effects (like burning) on slimes when wave ends
        if (gameState.slimes) {
            gameState.slimes.forEach(s => {
                if (s.effects) {
                    s.effects.burnTimer = 0;
                    s.effects.burnTickTimer = 0;
                }
            });

            const armyContainer = document.getElementById('armyContainer');
            if (armyContainer) {
                const burningUnits = armyContainer.querySelectorAll('.slime-unit.is-burning');
                burningUnits.forEach(unit => unit.classList.remove('is-burning'));
            }
        }

        // Apply Slime Regeneration per wave
        if (gameState.slimeRegen > 0 && gameState.slimes) {
            gameState.slimes.forEach(s => {
                if (s.hp > 0) {
                    s.hp = Math.min(s.maxHp, s.hp + gameState.slimeRegen);
                }
            });
        }

        // Sum total scrap value of uncollected ground loots on battlefield
        const uncollectedLootValue = (activeGroundLoots || []).reduce((sum, loot) => sum + (loot.value || 1), 0);

        // Track cleared wave number, save roster snapshot (including uncollected ground loots), & advance to next wave
        const clearedWaveNum = gameState.currentWave;
        gameState.maxWaveCleared = Math.max(gameState.maxWaveCleared || 0, clearedWaveNum);
        saveWaveSnapshot(clearedWaveNum, uncollectedLootValue);

        gameState.currentWave += 1;
        saveStateToLocal();
        updateUI();

        // Every 10th wave (10, 20, 30...), wait for slimes to eat ALL ground loots, then trigger congrats banner + 2s break!
        if (clearedWaveNum > 0 && clearedWaveNum % 10 === 0) {
            console.log(`[MERCHANT SHOP] Wave ${clearedWaveNum} cleared! Waiting for slimes to eat all ground loots...`);

            let waitTicks = 0;
            const maxWaitTicks = 80; // Max 12 seconds safety timeout

            const checkLootInterval = setInterval(() => {
                waitTicks++;
                const hasRemainingLoot = activeGroundLoots && activeGroundLoots.length > 0;

                if (!hasRemainingLoot || waitTicks >= maxWaitTicks) {
                    clearInterval(checkLootInterval);

                    // Re-save wave snapshot & update UI with newly collected scraps
                    const finalUncollectedLootValue = (activeGroundLoots || []).reduce((sum, loot) => sum + (loot.value || 1), 0);
                    saveWaveSnapshot(clearedWaveNum, finalUncollectedLootValue);
                    saveStateToLocal();
                    updateUI();

                    showBattlefieldWaveBanner(`🎉 WAVE ${clearedWaveNum} CLEARED!<br><span style="font-size: 0.9rem; color: #cbd5e1; font-weight: 600;">🛒 Merchant Arriving...</span>`);

                    setTimeout(() => {
                        openShopModal(clearedWaveNum);
                    }, 2000);
                }
            }, 150);
        } else if (isAutoPlay) {
            console.log('[AUTO PLAY] Waiting 4 seconds before starting next wave...');
            if (autoWaveTimeoutId) clearTimeout(autoWaveTimeoutId);
            autoWaveTimeoutId = setTimeout(() => {
                if (isAutoPlay) {
                    startNextWave();
                }
            }, 4000); // 4-second delay before auto-spawning next wave
        }
    }
}

/**
 * Trigger loot drop on enemy defeat (Drops boot.png sprite on ground under enemy)
 */
export function triggerLootDrop(enemy) {
    if (!enemy || enemy.hasDroppedLoot) return;
    enemy.hasDroppedLoot = true;

    const lootKey = (enemy.typeId || 'beggar').toLowerCase();
    const lootValue = enemy.loot_value || 1;

    const overlay = document.querySelector('.battlefield-overlay');
    if (overlay) {
        const lootImgSrc = `images/loots/${lootKey}.png`;

        const groundLootEl = document.createElement('div');
        groundLootEl.className = 'ground-loot-item';
        groundLootEl.style.left = `${enemy.x + 4}px`;
        groundLootEl.style.top = `${enemy.y + 12}px`;
        groundLootEl.title = `${lootKey} (value: ${lootValue})`;

        groundLootEl.innerHTML = `
            <img src="${lootImgSrc}" 
                 onerror="this.onerror=null; this.src='images/loots/boot.png';" 
                 alt="${lootKey}" 
                 class="ground-loot-sprite">
            <div class="ground-loot-shadow"></div>
        `;
        overlay.appendChild(groundLootEl);

        // Dynamically detect source image dimensions and adjust size & ground shadow
        const imgEl = groundLootEl.querySelector('.ground-loot-sprite');
        const shadowEl = groundLootEl.querySelector('.ground-loot-shadow');

        const adaptDimensions = () => {
            const w = imgEl.naturalWidth || 6;
            const h = imgEl.naturalHeight || 6;
            imgEl.style.width = `${w}px`;
            imgEl.style.height = `${h}px`;
            groundLootEl.style.width = `${w + 2}px`;
            groundLootEl.style.height = `${h + 2}px`;
            if (shadowEl) {
                shadowEl.style.width = `${Math.max(4, w)}px`;
            }
        };

        if (imgEl.complete && imgEl.naturalWidth) {
            adaptDimensions();
        } else {
            imgEl.addEventListener('load', adaptDimensions);
        }

        const enemyDef = ENEMY_TYPES[enemy.typeId] || {};
        const lootName = enemyDef.name || enemy.typeId || 'Enemy';
        const lootEffect = enemyDef.loot_effect || { hpBonus: 1 };

        const lootObj = {
            id: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            key: lootKey,
            name: lootName,
            value: lootValue,
            effect: lootEffect,
            sprite: lootImgSrc,
            x: enemy.x + 4,
            y: enemy.y + 12,
            el: groundLootEl,
            beingEaten: false
        };
        activeGroundLoots.push(lootObj);
        updateUI();
    }
}

/**
 * Spawn an enemy instance of the given type with optional soft scaling HP multiplier
 */
export function spawnEnemy(typeId = 'beggar', hpMultiplier = 1.0) {
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.beggar;
    const enemyIdKey = def.id || typeId;
    const baseHp = def.hp || 2;
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier));

    const enemyInstance = {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        typeId: enemyIdKey,
        type: def.type,
        projectile: def.projectile || 'arrow',
        sprite: `images/ennemies/${enemyIdKey}.png`,
        x: 520,
        y: 120 + (Math.random() * 30 - 15),
        speed: def.moveSpeed * 25,
        targetX: def.targetX,
        hp: scaledHp,
        maxHp: scaledHp,
        damage: def.damage,
        attackSpeed: def.attackSpeed,
        state: 'walking',
        attackTimer: 0,
        loot_value: def.loot_value || 1,
        hasDroppedLoot: false,
        el: null
    };

    activeEnemies.push(enemyInstance);
    renderNewEnemyDOM(enemyInstance);
    return enemyInstance;
}

/**
 * Create DOM element for newly spawned enemy
 */
function renderNewEnemyDOM(enemy) {
    const enemiesContainer = document.getElementById('enemiesContainer');
    if (!enemiesContainer) return;

    const unit = document.createElement('div');
    unit.className = 'enemy-unit';
    unit.id = enemy.id;
    unit.style.left = `${enemy.x}px`;
    unit.style.top = `${enemy.y}px`;

    unit.innerHTML = `
        <div class="enemy-status-row"></div>
        <img src="${enemy.sprite}" alt="${enemy.typeId}" class="enemy-sprite">
        <div class="enemy-shadow"></div>
    `;

    const overlay = document.querySelector('.battlefield-overlay');
    if (overlay) {
        overlay.appendChild(unit);
    } else {
        enemiesContainer.appendChild(unit);
    }

    enemy.el = unit;

    // Dynamically detect source image dimensions and adjust enemy size & shadow
    const spriteEl = unit.querySelector('.enemy-sprite');
    const shadowEl = unit.querySelector('.enemy-shadow');

    const adaptEnemyDimensions = () => {
        const w = spriteEl.naturalWidth || 28;
        const h = spriteEl.naturalHeight || 28;
        spriteEl.style.width = `${w}px`;
        spriteEl.style.height = `${h}px`;
        unit.style.width = `${w}px`;
        unit.style.height = `${h}px`;
        if (shadowEl) {
            shadowEl.style.width = `${Math.max(12, Math.round(w * 0.7))}px`;
        }
    };

    if (spriteEl.complete && spriteEl.naturalWidth) {
        adaptEnemyDimensions();
    } else {
        spriteEl.addEventListener('load', adaptEnemyDimensions);
    }
}

/**
 * Update Enemy Positions, Attacks & AI State Machine Loop
 */
export function updateEnemies(deltaSeconds) {
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];

        if (enemy.hp <= 0) {
            triggerLootDrop(enemy);
            // Defeated enemy removal with cartoon jump plunge
            if (enemy.el && !enemy.el.classList.contains('cartoon-ko-eject') && !enemy.el.classList.contains('cartoon-ko-eject-left')) {
                const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
                enemy.el.classList.add(ejectClass);
                const elToRemove = enemy.el;
                setTimeout(() => { if (elToRemove) elToRemove.remove(); }, 800);
            }
            activeEnemies.splice(i, 1);
            checkWaveCompletion();
            continue;
        }

        // Initialize status effects container
        if (!enemy.effects) {
            enemy.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, freezeTimer: 0, stunTimer: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0 };
        }

        // --- 1. Process Frost (Freeze) & Stone (Stun) Effects ---
        let isFrozen = false;
        if (enemy.effects.freezeTimer > 0) {
            enemy.effects.freezeTimer -= deltaSeconds;
            isFrozen = true;
        }

        let isStunned = false;
        if (enemy.effects.stunTimer > 0) {
            enemy.effects.stunTimer -= deltaSeconds;
            isStunned = true;
        }

        const isDisabled = isFrozen || isStunned;

        // --- 2. Process Fire (Stackable Burn DoT: 1 damage per stack per 0.5s) Effect ---
        if (enemy.effects.burnTimer > 0) {
            enemy.effects.burnTimer -= deltaSeconds;
            enemy.effects.burnTickTimer += deltaSeconds;

            if (enemy.effects.burnTickTimer >= 0.5) {
                enemy.effects.burnTickTimer -= 0.5;
                const burnDmg = Math.max(1, enemy.effects.burnStacks || 1);
                enemy.hp -= burnDmg;

                // Pop floating ORANGE pixel art damage number for total stacked burn damage
                showFloatingDamageNumber(enemy.x + 8, enemy.y - 12, burnDmg, 'burn-dmg');

                // Flame flash on enemy sprite
                if (enemy.el) {
                    const sprite = enemy.el.querySelector('.enemy-sprite');
                    if (sprite) {
                        sprite.classList.add('hit-flash-white');
                        setTimeout(() => sprite.classList.remove('hit-flash-white'), 150);
                    }
                }
            }

            if (enemy.effects.burnTimer <= 0) {
                enemy.effects.burnStacks = 0;
            }
        }

        // --- 2b. Process Toxic (Stackable Poison DoT: 2 damage per stack per 1.0s) Effect ---
        if (enemy.effects.poisonTimer > 0) {
            enemy.effects.poisonTimer -= deltaSeconds;
            enemy.effects.poisonTickTimer = (enemy.effects.poisonTickTimer || 0) + deltaSeconds;

            if (enemy.effects.poisonTickTimer >= 1.0) {
                enemy.effects.poisonTickTimer -= 1.0;
                const poisonDmg = Math.max(2, (enemy.effects.poisonStacks || 1) * 2);
                enemy.hp -= poisonDmg;

                // Pop floating GREEN pixel art damage number for total stacked poison damage
                showFloatingDamageNumber(enemy.x - 12, enemy.y - 14, poisonDmg, 'poison-dmg');

                // Toxic flash on enemy sprite
                if (enemy.el) {
                    const sprite = enemy.el.querySelector('.enemy-sprite');
                    if (sprite) {
                        sprite.classList.add('hit-flash-white');
                        setTimeout(() => sprite.classList.remove('hit-flash-white'), 150);
                    }
                }
            }

            if (enemy.effects.poisonTimer <= 0) {
                enemy.effects.poisonStacks = 0;
            }
        }

        // --- 3. Walking Phase (Moving left towards targetX if NOT disabled) ---
        if (!isDisabled && enemy.x > enemy.targetX) {
            enemy.x -= enemy.speed * deltaSeconds;
            if (enemy.x <= enemy.targetX) {
                enemy.x = enemy.targetX;
                enemy.attackTimer = 1 / enemy.attackSpeed;
                if (enemy.type === 'melee') {
                    enemy.state = 'attacking';
                } else if (enemy.type === 'tank') {
                    enemy.state = 'tanking';
                } else if (enemy.type === 'ranged') {
                    enemy.state = 'ranged_attack';
                }
            }
        }

        // --- 4. State-Specific Attack Executions (Paused if disabled) ---
        if (!isDisabled) {
            if (enemy.state === 'attacking') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    damageRandomSlime(enemy.damage);
                }
            } else if (enemy.state === 'ranged_attack') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    fireProjectiles(enemy);
                }
            }
        }

        // --- 5. Update Visual Position & Status Effect Overlay Filters ---
        if (enemy.el) {
            enemy.el.style.left = `${enemy.x}px`;

            const statusRow = enemy.el.querySelector('.enemy-status-row');
            if (statusRow) {
                let statusHTML = '';
                if (enemy.effects.burnTimer > 0) {
                    statusHTML += '<span class="status-icon burn-icon">🔥</span>';
                }
                if (enemy.effects.poisonTimer > 0) {
                    statusHTML += '<span class="status-icon poison-icon">🧪</span>';
                }
                if (isFrozen) {
                    statusHTML += '<span class="status-icon freeze-icon">❄️</span>';
                }
                if (isStunned) {
                    statusHTML += '<span class="status-icon stun-icon">💫</span>';
                }
                statusRow.innerHTML = statusHTML;
            }

            if (enemy.effects.burnTimer > 0) {
                enemy.el.classList.add('is-burning');
            } else {
                enemy.el.classList.remove('is-burning');
            }

            if (enemy.effects.poisonTimer > 0) {
                enemy.el.classList.add('is-poisoned');
            } else {
                enemy.el.classList.remove('is-poisoned');
            }

            if (isFrozen) {
                enemy.el.classList.add('is-frozen');
            } else {
                enemy.el.classList.remove('is-frozen');
            }

            if (enemy.state === 'attacking') {
                enemy.el.classList.add('enemy-attacking');
                enemy.el.classList.remove('enemy-walking');
            } else if (enemy.state === 'tanking') {
                enemy.el.classList.add('enemy-tanking');
                enemy.el.classList.remove('enemy-walking');
            } else if (enemy.state === 'ranged_attack') {
                enemy.el.classList.add('enemy-ranged');
                enemy.el.classList.remove('enemy-walking');
            } else {
                enemy.el.classList.add('enemy-walking');
            }
        }
    }

    // --- Process Burn Status (1 damage per stack per 0.5s DoT) on burning slimes ---
    if (gameState.slimes) {
        gameState.slimes.forEach(slime => {
            if (slime.hp > 0 && slime.effects && slime.effects.burnTimer > 0) {
                slime.effects.burnTimer -= deltaSeconds;
                slime.effects.burnTickTimer += deltaSeconds;

                if (slime.effects.burnTickTimer >= 0.5) {
                    slime.effects.burnTickTimer -= 0.5;
                    const burnDmg = Math.max(1, slime.effects.burnStacks || 1);
                    slime.hp = Math.max(0, slime.hp - burnDmg);

                    const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);
                    const hpFill = document.getElementById(`roster_hp_fill_${slime.id}`);
                    const rosterItem = document.getElementById(`roster_item_${slime.id}`);

                    if (hpFill) {
                        hpFill.style.width = `${hpPct}%`;
                        if (hpPct < 35) hpFill.style.background = '#ef4444';
                        else if (hpPct < 65) hpFill.style.background = '#f59e0b';
                        else hpFill.style.background = '#10b981';
                    }

                    if (rosterItem) {
                        rosterItem.title = `${slime.type || 'Slime'}: ${slime.hp}/${slime.maxHp} HP`;
                        rosterItem.classList.add('roster-hit-flash');
                        setTimeout(() => rosterItem.classList.remove('roster-hit-flash'), 180);
                    }

                    saveStateToLocal();
                    updateUI();

                    const armyContainer = document.getElementById('armyContainer');
                    let slimeX = 75;
                    let slimeY = 120;

                    if (armyContainer) {
                        const unit = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
                        if (unit) {
                            slimeX = parseFloat(unit.style.left) || 75;
                            slimeY = parseFloat(unit.style.top) || 120;
                            const img = unit.querySelector('.slime-img');
                            if (img) {
                                img.classList.add('hit-flash-red');
                                setTimeout(() => img.classList.remove('hit-flash-red'), 180);
                            }

                            if (slime.hp <= 0) {
                                gameState.hasSlimeDied = true;
                                const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
                                unit.classList.add(ejectClass);
                                setTimeout(() => {
                                    unit.remove();
                                    gameState.slimes = gameState.slimes.filter(s => s.id !== slime.id);
                                    gameState.armySize = gameState.slimes.length;
                                    saveStateToLocal();
                                    updateUI();

                                    if (gameState.slimes.length === 0) {
                                        rewindWaveState();
                                    }
                                }, 800);
                            }
                        }
                    }

                    // Pop floating ORANGE pixel art damage number on slime burn tick for total stacked burn damage
                    showFloatingDamageNumber(slimeX + 10, slimeY - 14, burnDmg, 'burn-dmg');
                }

                if (slime.effects.burnTimer <= 0) {
                    slime.effects.burnStacks = 0;
                }

                // Toggle is-burning class on slime DOM element
                const armyContainer = document.getElementById('armyContainer');
                if (armyContainer) {
                    const unit = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
                    if (unit) {
                        if (slime.effects.burnTimer > 0) unit.classList.add('is-burning');
                        else unit.classList.remove('is-burning');
                    }
                }
            }
        });
    }

    updateProjectiles(deltaSeconds);
}

/**
 * Fire Ranged Projectiles with parabolic arc trajectory & dynamic flight rotation
 */
function fireProjectiles(enemy) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const projKey = enemy.projectile || 'arrow';
    const projType = PROJECTILE_TYPES[projKey] || PROJECTILE_TYPES.arrow;

    const projEl = document.createElement('div');
    projEl.className = `enemy-projectile ${projType.className}`;
    projEl.style.left = `${enemy.x}px`;
    projEl.style.top = `${enemy.y + 10}px`;
    overlay.appendChild(projEl);

    activeProjectiles.push({
        type: projType,
        startX: enemy.x,
        startY: enemy.y + 10,
        targetX: 105,
        targetY: enemy.y + 10,
        progress: 0,
        duration: projType.duration,
        arcHeight: projType.arcHeight,
        damage: enemy.damage,
        el: projEl
    });
}

/**
 * Apply Burn Status Effect to a slime (3 seconds DoT with stackable burn)
 */
export function applyBurnEffectToSlime(slime, duration = 3.0) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0 };
    }

    if (slime.effects.burnTimer > 0) {
        slime.effects.burnStacks = (slime.effects.burnStacks || 1) + 1;
    } else {
        slime.effects.burnStacks = 1;
    }
    slime.effects.burnTimer = duration;
}

function updateProjectiles(deltaSeconds) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.progress += deltaSeconds / p.duration;

        if (p.progress >= 1.0) {
            const hitSlime = damageRandomSlime(p.damage);
            if (hitSlime && p.type && p.type.id === 'fireball') {
                applyBurnEffectToSlime(hitSlime, 3.0);
            }
            if (p.el) p.el.remove();
            activeProjectiles.splice(i, 1);
        } else {
            const t = p.progress;
            const curX = p.startX + (p.targetX - p.startX) * t;
            const curY = p.startY + (p.targetY - p.startY) * t - 4 * p.arcHeight * t * (1 - t);

            // Calculate instantaneous tangent flight vector for rotation angle
            const vx = p.targetX - p.startX;
            const vy = (p.targetY - p.startY) - 4 * p.arcHeight * (1 - 2 * t);
            const angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);

            if (p.el) {
                p.el.style.left = `${curX}px`;
                p.el.style.top = `${curY}px`;
                p.el.style.transform = `rotate(${angleDeg}deg)`;
            }
        }
    }
}

/**
 * Deals damage to one random alive slime in the army
 */
export function damageRandomSlime(damageAmount) {
    if (!gameState.slimes) return null;

    const aliveSlimes = gameState.slimes.filter(s => s.hp > 0);
    if (aliveSlimes.length === 0) {
        rewindWaveState();
        return null;
    }

    const randomSlime = aliveSlimes[Math.floor(Math.random() * aliveSlimes.length)];
    randomSlime.hp = Math.max(0, randomSlime.hp - damageAmount);

    const hpPct = Math.max(0, (randomSlime.hp / randomSlime.maxHp) * 100);
    const hpFill = document.getElementById(`roster_hp_fill_${randomSlime.id}`);
    const rosterItem = document.getElementById(`roster_item_${randomSlime.id}`);

    if (hpFill) {
        hpFill.style.width = `${hpPct}%`;
        if (hpPct < 35) hpFill.style.background = '#ef4444';
        else if (hpPct < 65) hpFill.style.background = '#f59e0b';
        else hpFill.style.background = '#10b981';
    }

    if (rosterItem) {
        rosterItem.title = `${randomSlime.type || 'Slime'}: ${randomSlime.hp}/${randomSlime.maxHp} HP`;
        rosterItem.classList.add('roster-hit-flash');
        setTimeout(() => rosterItem.classList.remove('roster-hit-flash'), 180);
    }

    const armyContainer = document.getElementById('armyContainer');
    let slimeX = 75;
    let slimeY = 120;

    if (armyContainer) {
        const unit = armyContainer.querySelector(`[data-slime-id="${randomSlime.id}"]`);
        if (unit) {
            slimeX = parseFloat(unit.style.left) || 75;
            slimeY = parseFloat(unit.style.top) || 120;

            const img = unit.querySelector('.slime-img');
            if (img) {
                img.classList.add('hit-flash-red');
                setTimeout(() => {
                    img.classList.remove('hit-flash-red');
                }, 180);
            }

            if (randomSlime.hp <= 0) {
                gameState.hasSlimeDied = true;
                const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
                unit.classList.add(ejectClass);
                setTimeout(() => {
                    unit.remove();
                    // Permanently remove dead slime from gameState.slimes
                    gameState.slimes = gameState.slimes.filter(s => s.id !== randomSlime.id);
                    gameState.armySize = gameState.slimes.length;
                    saveStateToLocal();
                    updateUI();

                    // If all slimes in army died, trigger auto-rewind to previous wave state
                    if (gameState.slimes.length === 0) {
                        rewindWaveState();
                    }
                }, 800);
            }
        } else if (randomSlime.hp <= 0) {
            // Permanently remove dead slime if unit element is not found
            gameState.slimes = gameState.slimes.filter(s => s.id !== randomSlime.id);
            gameState.armySize = gameState.slimes.length;
            saveStateToLocal();
            updateUI();

            if (gameState.slimes.length === 0) {
                rewindWaveState();
            }
        }
    }

    // Pop floating RED pixel art damage number over hit slime
    showFloatingDamageNumber(slimeX + 10, slimeY - 14, damageAmount, 'slime-dmg');
    return randomSlime;
}

let isRewinding = false;

/**
 * Rewind wave state for farming:
 * Immediately kills all enemies & flying projectiles, waits 1 second,
 * then moves back 1 wave and respawns the "Best Roster" blueprint with 100% full HP!
 */
export function rewindWaveState() {
    if (isRewinding) return;
    isRewinding = true;

    if (autoWaveTimeoutId) {
        clearTimeout(autoWaveTimeoutId);
        autoWaveTimeoutId = null;
    }

    // 1. Play cartoon KO death eject animation on all active enemies & clear flying projectiles
    activeEnemies.forEach(e => {
        if (e.el) {
            const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
            e.el.classList.add(ejectClass);
            const enemyEl = e.el;
            setTimeout(() => {
                if (enemyEl) enemyEl.remove();
            }, 800);
        }
    });
    activeEnemies = [];

    activeProjectiles.forEach(p => {
        if (p.el) p.el.remove();
    });
    activeProjectiles = [];

    // 2. Play cartoon KO animation for 850ms, then trigger Slime Rain Sky-Drop!
    setTimeout(() => {
        gameState.currentWave = Math.max(1, gameState.currentWave - 1);
        restoreBestRoster();
        clearAscendedAutoAttacks();
        updateUI();

        // Slimes drop from the sky 1 by 1 every 0.05s. Next wave starts ONLY when all slimes are idling on the ground!
        playSlimeRainRespawnAnimation(() => {
            isRewinding = false;
            startNextWave();
        });
    }, 850);
}
