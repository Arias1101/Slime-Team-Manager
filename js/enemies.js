/**
 * Enemy Management & AI Behaviors
 */

import { gameState, addScraps, saveStateToLocal } from './state.js';
import { healAllSlimes } from './slimes.js';
import { updateUI } from './ui.js';

export const ENEMY_TYPES = {
    beggar: {
        id: 'beggar',
        name: 'Beggar',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 1,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1,         // Move speed (1 to 100) -> 25 px/sec
        sprite: 'images/ennemies/beggar.png',
        targetX: 130,         // Close melee range near the slimes
        loot_value: 1
    },
    farmer: {
        id: 'farmer',
        name: 'Farmer',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,         // Move speed (1 to 100) -> 25 px/sec
        sprite: 'images/ennemies/farmer.png',
        targetX: 140,         // Close melee range near the slimes
        loot_value: 2
    },
    fisher: {
        id: 'fisher',
        name: 'Fisher',
        type: 'melee',        // Melee attacker
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.3,         // Move speed (1 to 100) -> 25 px/sec
        sprite: 'images/ennemies/fisher.png',
        targetX: 130,         // Close melee range near the slimes
        loot_value: 3
    },
    tank: {
        id: 'tank',
        name: 'Shield Bearer',
        type: 'tank',         // Tank defender
        hp: 20,
        maxHp: 20,
        damage: 1,
        attackSpeed: 0.5,     // 0.5 attacks per second
        moveSpeed: 0.6,       // Slow move speed
        sprite: 'images/ennemies/beggar.png',
        targetX: 250,         // Center of battlefield
        loot: 'boot',
        loot_value: 1
    },
    ranged: {
        id: 'ranged',
        name: 'Archer',
        type: 'ranged',       // Ranged attacker
        hp: 5,
        maxHp: 5,
        damage: 2,            // 2 Damage per projectile
        attackSpeed: 0.8,     // 0.8 attacks per second
        moveSpeed: 1.2,
        sprite: 'images/ennemies/beggar.png',
        targetX: 380,         // Right boundary
        loot: 'boot',
        loot_value: 1
    }
};

export let activeEnemies = [];
export let activeProjectiles = [];
export let activeGroundLoots = [];

let isAutoPlay = false;
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
 * Generate wave enemy composition list
 */
function generateWaveComposition(waveNum) {
    if (waveNum === 1) return ['beggar'];
    if (waveNum === 2) return ['farmer'];
    if (waveNum === 3) return ['fisher', 'fisher'];
    else return generateWaveComposition(3);

    // TODO after wave 50 is done: generate random waves after wave 50
}

/**
 * Starts the next wave: Heals slimes & spawns enemies with staggered timing
 */
export function startNextWave() {
    if (autoWaveTimeoutId) {
        clearTimeout(autoWaveTimeoutId);
        autoWaveTimeoutId = null;
    }

    healAllSlimes();

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
    const comp = generateWaveComposition(gameState.currentWave);

    // Stagger enemy spawns 1.2 seconds apart
    comp.forEach((enemyType, idx) => {
        setTimeout(() => {
            spawnEnemy(enemyType);
        }, idx * 1200);
    });
}

/**
 * Reset action: Wipes scraps to 0, decrements wave (or stays at 1), clears ground loot & restarts battle
 */
export function resetWaveAndScraps() {
    // 1. Reset scraps to 0
    gameState.scraps = 0;

    // 2. Go back to previous wave (min wave 1)
    if (gameState.currentWave > 1) {
        gameState.currentWave -= 1;
    } else {
        gameState.currentWave = 1;
    }

    saveStateToLocal();

    // 3. Clear all ground loot items on battlefield
    activeGroundLoots.forEach(l => {
        if (l.el) l.el.remove();
    });
    activeGroundLoots = [];

    // 4. Restart the wave
    startNextWave();
    updateUI();
}

/**
 * Check if the last enemy of the current wave died
 */
function checkWaveCompletion() {
    if (isWaveActive && activeEnemies.length === 0) {
        isWaveActive = false;
        console.log('[WAVE CLEARED] Last enemy defeated!');

        // Advance to next wave
        gameState.currentWave += 1;
        saveStateToLocal();
        updateUI();

        // Heal slimes on wave completion
        healAllSlimes();

        if (isAutoPlay) {
            console.log('[AUTO PLAY] Waiting 1 second before starting next wave...');
            if (autoWaveTimeoutId) clearTimeout(autoWaveTimeoutId);
            autoWaveTimeoutId = setTimeout(() => {
                if (isAutoPlay) {
                    startNextWave();
                }
            }, 1000); // 1-second delay before auto-spawning next wave
        }
    }
}

/**
 * Trigger loot drop on enemy defeat (Drops boot.png sprite on ground under enemy)
 */
export function triggerLootDrop(enemy) {
    if (!enemy || !enemy.name || enemy.hasDroppedLoot) return;
    enemy.hasDroppedLoot = true;

    const lootKey = enemy.name.toLowerCase();
    const lootValue = enemy.loot_value || 1;

    const overlay = document.querySelector('.battlefield-overlay');
    if (overlay) {
        const lootImgSrc = `images/loots/${lootKey}.png`;

        const groundLootEl = document.createElement('div');
        groundLootEl.className = 'ground-loot-item';
        groundLootEl.style.left = `${enemy.x + 4}px`;
        groundLootEl.style.top = `${enemy.y + 12}px`;
        groundLootEl.title = `${enemy.name} (value: ${lootValue})`;

        groundLootEl.innerHTML = `
            <img src="${lootImgSrc}" 
                 onerror="this.onerror=null; this.src='images/loots/boot.png';" 
                 alt="${enemy.name}" 
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

        const lootObj = {
            id: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            key: lootKey,
            value: lootValue,
            x: enemy.x + 4,
            y: enemy.y + 12,
            el: groundLootEl,
            beingEaten: false
        };
        activeGroundLoots.push(lootObj);
    }
}

/**
 * Spawn an enemy instance of the given type
 */
export function spawnEnemy(typeId = 'beggar') {
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.beggar;

    const enemyInstance = {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: def.name,
        type: def.type,
        sprite: def.sprite,
        x: 520,
        y: 120 + (Math.random() * 16 - 8),
        speed: def.moveSpeed * 25,
        targetX: def.targetX,
        hp: def.hp,
        maxHp: def.maxHp,
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
        <img src="${enemy.sprite}" alt="${enemy.name}" class="enemy-sprite">
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
            enemy.effects = { burnTimer: 0, burnTickTimer: 0, freezeTimer: 0 };
        }

        // --- 1. Process Frost (Freeze / Immobilize) Effect ---
        let isFrozen = false;
        if (enemy.effects.freezeTimer > 0) {
            enemy.effects.freezeTimer -= deltaSeconds;
            isFrozen = true;
        }

        // --- 2. Process Fire (Burn DoT: 1 damage per second) Effect ---
        if (enemy.effects.burnTimer > 0) {
            enemy.effects.burnTimer -= deltaSeconds;
            enemy.effects.burnTickTimer += deltaSeconds;

            if (enemy.effects.burnTickTimer >= 1.0) {
                enemy.effects.burnTickTimer -= 1.0;
                enemy.hp -= 1; // 1 DoT damage per second

                // Flame flash on enemy sprite
                if (enemy.el) {
                    const sprite = enemy.el.querySelector('.enemy-sprite');
                    if (sprite) {
                        sprite.classList.add('hit-flash-white');
                        setTimeout(() => sprite.classList.remove('hit-flash-white'), 150);
                    }
                }
            }
        }

        // --- 3. Walking Phase (Moving left towards targetX if NOT frozen) ---
        if (!isFrozen && enemy.x > enemy.targetX) {
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

        // --- 4. State-Specific Attack Executions (Paused if frozen) ---
        if (!isFrozen) {
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

            if (enemy.effects.burnTimer > 0) {
                enemy.el.classList.add('is-burning');
            } else {
                enemy.el.classList.remove('is-burning');
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

    updateProjectiles(deltaSeconds);
}

/**
 * Fire Ranged Projectiles from right to left
 */
function fireProjectiles(enemy) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const projEl = document.createElement('div');
    projEl.className = 'enemy-projectile';
    projEl.style.left = `${enemy.x}px`;
    projEl.style.top = `${enemy.y + 10}px`;
    overlay.appendChild(projEl);

    activeProjectiles.push({
        x: enemy.x,
        y: enemy.y + 10,
        targetX: 100,
        speed: 180,
        damage: enemy.damage,
        el: projEl
    });
}

function updateProjectiles(deltaSeconds) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.x -= p.speed * deltaSeconds;
        if (p.el) p.el.style.left = `${p.x}px`;

        if (p.x <= p.targetX) {
            damageRandomSlime(p.damage);
            if (p.el) p.el.remove();
            activeProjectiles.splice(i, 1);
        }
    }
}

/**
 * Deals damage to one random alive slime in the army
 */
export function damageRandomSlime(damageAmount) {
    if (!gameState.slimes) return;

    const aliveSlimes = gameState.slimes.filter(s => s.hp > 0);
    if (aliveSlimes.length === 0) return;

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
        rosterItem.title = `${randomSlime.name}: ${randomSlime.hp}/${randomSlime.maxHp} HP`;
        rosterItem.classList.add('roster-hit-flash');
        setTimeout(() => rosterItem.classList.remove('roster-hit-flash'), 180);

        if (randomSlime.hp === 0) {
            rosterItem.style.opacity = '0.25';
            rosterItem.style.filter = 'grayscale(1)';
        }
    }

    const armyContainer = document.getElementById('armyContainer');
    if (armyContainer) {
        const unit = armyContainer.querySelector(`[data-slime-id="${randomSlime.id}"]`);
        if (unit) {
            const img = unit.querySelector('.slime-img');
            if (img) {
                img.classList.add('hit-flash-red');
                setTimeout(() => {
                    img.classList.remove('hit-flash-red');
                }, 180);
            }

            if (randomSlime.hp === 0) {
                const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
                unit.classList.add(ejectClass);
                setTimeout(() => {
                    unit.remove();
                    const aliveCount = gameState.slimes.filter(s => s.hp > 0).length;
                    gameState.armySize = aliveCount;
                    const armySizeCountEl = document.getElementById('armySizeCount');
                    const rosterCountEl = document.getElementById('rosterCount');
                    if (armySizeCountEl) armySizeCountEl.textContent = aliveCount;
                    if (rosterCountEl) rosterCountEl.textContent = `${aliveCount} Slimes`;
                }, 800);
            }
        }
    }
}
