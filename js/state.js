/**
 * Game State & Core Definitions
 */

export const SLIME_TYPES = {
    base: {
        id: 'base',
        name: 'Base Slime',
        folder: 'images/slimes/base',
        prefix: 'slime',
        frameCount: 8,
        attackDamage: 1,
        effect: null
    },
    fire: {
        id: 'fire',
        name: 'Fire Slime',
        folder: 'images/slimes/fire',
        prefix: 'slime',
        frameCount: 8,
        attackDamage: 1,
        effect: 'burn',
        burnDamagePerSec: 1,
        burnDuration: 3.0 // 3 seconds DoT (1 damage per second)
    },
    ice: {
        id: 'ice',
        name: 'Ice Slime',
        folder: 'images/slimes/ice',
        prefix: 'slime',
        frameCount: 8,
        attackDamage: 1,
        effect: 'freeze',
        freezeDuration: 1.0 // Freezes/immobilizes enemy for 1 second
    }
};

export const defaultState = {
    scraps: 0,            // Scraps won from eating defeated enemy loot
    currentWave: 1,       // Current wave of adventurer enemies
    armySize: 1,          // 1 Base Slime
    slimes: [
        { id: 1, type: 'base', name: 'Base Slime', hp: 10, maxHp: 10 }
    ],
    lastSavedTimestamp: Date.now()
};

export let gameState = { ...defaultState };

/**
 * Increment Scraps counter when slime eats ground loot
 */
export function addScraps(amount = 1) {
    gameState.scraps = (gameState.scraps || 0) + amount;
    saveStateToLocal();
}

/**
 * Synchronize individual slime status objects (1 Base Slime)
 */
export function syncSlimesArray() {
    gameState.armySize = 1;
    gameState.slimes = [
        { id: 1, type: 'base', name: 'Base Slime', hp: 10, maxHp: 10 }
    ];
}

/**
 * Local Storage Save & Load Handlers
 */
export function saveStateToLocal() {
    gameState.lastSavedTimestamp = Date.now();
    localStorage.setItem('slm_army_save', JSON.stringify(gameState));
}

export function loadStateFromLocal() {
    localStorage.removeItem('slm_army_save');
    gameState = { ...defaultState };
    syncSlimesArray();
    saveStateToLocal();
}
