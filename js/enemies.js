/**
 * Enemy Management & AI Behaviors
 */

import { gameState, addScraps, saveStateToLocal, saveWaveSnapshot, restoreBestRoster, SLIME_TYPES, getSlimeTotalRegen } from './state.js';
import { healAllSlimes, initAscendedAutoAttacks, clearAscendedAutoAttacks, showFloatingDamageNumber, showFloatingHealingNumber, showFloatingStatusTextAt, showBattlefieldWaveBanner, triggerSlimeEatLoot } from './slimes.js';
import { updateUI, playSlimeRainRespawnAnimation } from './ui.js';
import { openShopModal } from './shop.js';
import { isGamePaused } from './engine.js';
/**
 * Scrap value contributed by one point of each loot attribute.
 * Ice and stun are binary effects, so each occurrence always contributes one point.
 */
export const LOOT_STAT_WEIGHTS = Object.freeze({
    hp: 2,
    damage: 5,
    regen: 10,
    crit: 10,
    burn: 20,
    poison: 20,
    ice: 40,
    stun: 50
});

/** Calculate an item's scrap value from the effects granted by its source enemy. */
export function calculateLootValue(lootEffect) {
    const effects = Array.isArray(lootEffect)
        ? lootEffect
        : (lootEffect?.effects ? lootEffect.effects : (lootEffect ? [lootEffect] : []));

    const total = effects.reduce((value, effect) => {
        const rawStat = effect?.stat || effect?.effectType;
        const stat = rawStat === 'freeze' ? 'ice' : rawStat;
        const weight = LOOT_STAT_WEIGHTS[stat];
        if (!weight) return value;

        const points = stat === 'ice' || stat === 'stun' ? 1 : Number(effect.value ?? 1);
        return value + (weight * (Number.isFinite(points) ? points : 1));
    }, 0);

    return Math.max(1, Math.round(total));
}

/** Build display labels from loot data; loot definitions never store presentation text. */
export function formatLootEffect(effect) {
    const stat = effect?.stat || effect?.effectType || 'hp';
    const value = Number(effect?.value ?? 1);
    const amount = Number.isFinite(value) ? value : 1;
    const signed = (amount >= 0 ? '+' : '') + amount;

    switch (stat) {
        case 'hp': return signed + ' Max HP';
        case 'damage': return signed + ' Damage';
        case 'regen': return signed + ' HP Regen';
        case 'crit': return signed + '% Crit';
        case 'burn': return String.fromCodePoint(0x1F525) + ' Burn ' + amount;
        case 'poison': return String.fromCodePoint(0x1F9EA) + ' Poison ' + amount;
        case 'freeze':
        case 'ice': return String.fromCodePoint(0x2744, 0xFE0F) + ' Freeze ' + amount;
        case 'stun': return String.fromCodePoint(0x1F4AB) + ' Stun ' + amount;
        default: return signed + ' ' + stat;
    }
}

export function formatLootEffects(lootEffect) {
    const effects = Array.isArray(lootEffect)
        ? lootEffect
        : (lootEffect?.effects ? lootEffect.effects : (lootEffect ? [lootEffect] : []));
    return effects.map(formatLootEffect).join(', ') || '+1 Max HP';
}
export const ENEMY_TYPES = {
    // Tier 0 - Bosses ------------------------
    mage: {
        id: 'mage',
        type: 'range',
        projectile: 'fireball',
        tier: 0,
        hp: 200,
        maxHp: 200,
        damage: 5,            // Damage per projectile
        attackSpeed: 1,     // attacks per second
        moveSpeed: 2,
        targetX: 380,         // 400=right border, 100 = Slime army
        loot_name: 'Staff of Frostfire',
        loot_effect: [{ stat: 'freeze', value: 1 },
        { stat: 'burn', value: 1 }]
    },
    berserker: {
        id: 'berserker',
        type: 'melee',
        projectile: 'slash1',
        tier: 0,
        hp: 5000,
        maxHp: 5000,
        damage: 15,            // Damages
        attackSpeed: 1.2,     // attacks per second
        moveSpeed: 3,
        targetX: 160,         // 400=right border, 100 = Slime army
        loot_name: 'Berserker Greataxe',
        loot_effect: [{ stat: 'damage', value: 5 },
        { stat: 'hp', value: 5 }]
    },
    alchemist: {
        id: 'alchemist',
        type: 'range',
        projectile: 'flask',
        tier: 0,
        hp: 2000,
        maxHp: 2000,
        damage: 1,
        attackSpeed: 0.6,
        moveSpeed: 1.5,
        targetX: 300,
        loot_name: 'Alchemical Flask',
        loot_effect: { stat: 'poison', value: 5 }
    },
    catapult: {
        id: 'catapult',
        type: 'range',
        projectile: 'boulder',
        tier: 0,
        hp: 10000,
        maxHp: 10000,
        damage: 15,
        attackSpeed: 0.5,
        moveSpeed: 0.4,
        targetX: 400,
        loot_name: 'Catapult Boulder',
        loot_effect: { stat: 'stun', value: 1 }
    },
    car: {
        id: 'car',
        type: 'melee',
        projectile: 'none',
        tier: 0,
        hp: 10000,
        maxHp: 10000,
        damage: 50,
        attackSpeed: 0.1,
        moveSpeed: 20,
        targetX: 100,
        loot_name: 'Shiny Horse Badge',
        loot_effect: [{ stat: 'damage', value: 10 },
        { stat: 'stun', value: 1 }]
    },
    stonegolem: {
        id: 'stonegolem',
        type: 'melee',
        projectile: 'slash1',
        tier: 0,
        hp: 20000,
        maxHp: 20000,
        damage: 15,            // Damages
        attackSpeed: 1,        // attacks per second
        moveSpeed: 1,
        targetX: 170,         // 400=right border, 100 = Slime army
        loot_name: 'Stone Golem Head',
        loot_effect: [{ stat: 'hp', value: 5 },
        { stat: 'stun', value: 1 }]
    },
    lich: {
        id: 'lich',
        type: 'support',
        projectile: 'heal1',
        tier: 0,
        hp: 5000,
        maxHp: 5000,
        damage: 100,
        attackSpeed: 2,
        moveSpeed: 1,
        targetX: 380,
        loot_name: 'Lich Mask',
        loot_effect: [{ stat: 'burn', value: 2 },
        { stat: 'poison', value: 2 },
        { stat: 'freeze', value: 2 }]
    },

    // Tier1 - Villagers ------------------------
    beggar: {
        id: 'beggar',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 2,                // 2 HP (requires 2 hits from base slime)
        maxHp: 2,
        damage: 1,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 130,         // Close melee range near the slimes
        loot_name: 'Beggar Cup',
        loot_effect: { stat: 'hp', value: 1 }
    },
    farmer: {
        id: 'farmer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 3,                // 2 HP (requires 2 hits from base slime)
        maxHp: 3,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 140,         // Close melee range near the slimes
        loot_name: 'Farmer Hat',
        loot_effect: { stat: 'hp', value: 1 }
    },
    torchfarmer: {
        id: 'torchfarmer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 4,                // 2 HP (requires 2 hits from base slime)
        maxHp: 4,
        damage: 3,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 110,         // Close melee range near the slimes
        loot_name: 'Burning Torch',
        loot_effect: [
            { stat: 'burn', value: 1 },
            { stat: 'hp', value: -3 }
        ]
    },
    fisher: {
        id: 'fisher',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 5,                // 2 HP (requires 2 hits from base slime)
        maxHp: 5,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.3,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 130,         // Close melee range near the slimes
        loot_name: 'Smelly Fish',
        loot_effect: { stat: 'hp', value: 2 }
    },
    thief: {
        id: 'thief',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 5,                // 2 HP (requires 2 hits from base slime)
        maxHp: 5,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 10,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 100,         // Close melee range near the slimes
        loot_name: 'Thief Mask',
        loot_effect: { stat: 'crit', value: 10 }
    },

    // Tier2 - Adventurers -------------------------
    guard: {
        id: 'guard',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 30,                // 5 HP
        maxHp: 30,
        damage: 3,            // 4 Damage per attack
        attackSpeed: 0.8,     // 1 attack per second
        moveSpeed: 1.5,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Guard Shield',
        loot_effect: { stat: 'hp', value: 2 }
    },
    hunter: {
        id: 'hunter',
        type: 'range',       // Ranged attacker
        projectile: 'arrow',  // Arrow projectile type
        tier: 2,
        hp: 20,
        maxHp: 20,
        damage: 2,            // 2 Damage per projectile
        attackSpeed: 1.2,     // 0.8 attacks per second
        moveSpeed: 1.4,
        targetX: 380,         // Right boundary
        loot_name: 'Hunting Bow',
        loot_effect: { stat: 'crit', value: 5 }
    },
    adventurer: {
        id: 'adventurer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 25,                // 4 HP
        maxHp: 25,
        damage: 2,            // 3 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Backpack',
        loot_effect: { stat: 'regen', value: 1 }
    },
    assassin: {
        id: 'assassin',
        type: 'rush',        // Melee attacker
        projectile: '',
        tier: 2,
        hp: 30,                // 4 HP
        maxHp: 30,
        damage: 1,            // 3 Damage per attack
        attackSpeed: 1.5,     // 1 attack per second
        moveSpeed: 12,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Poison Dagger',
        loot_effect: { stat: 'poison', value: 1 }
    },
    lancer: {
        id: 'lancer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 25,                // 4 HP
        maxHp: 25,
        damage: 1,            // 3 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 2.5,       // Move speed
        targetX: 180,         // Close melee range near the slimes
        loot_name: 'Lance Tip',
        loot_effect: [{ stat: 'crit', value: 2 },
        { stat: 'damage', value: 1 }]
    },
    lumberjack: {
        id: 'lumberjack',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 35,                // 4 HP
        maxHp: 35,
        damage: 10,            // 3 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Woodcutter Axe',
        loot_effect: [{ stat: 'hp', value: 1 },
        { stat: 'damage', value: 2 }]
    },


    // Tier 3 - Army ~50 PV
    soldier: {
        id: 'soldier',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 100,                // 5 HP
        maxHp: 100,
        damage: 4,
        attackSpeed: 1.5,     // attack per second
        moveSpeed: 3,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Swag Helmet',
        loot_effect: [{ stat: 'hp', value: 3 },
        { stat: 'crit', value: 2 }]
    },
    soldier2h: {
        id: 'soldier2h',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 80,                // 5 HP
        maxHp: 80,
        damage: 5,            // 4 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 3.5,       // Move speed
        targetX: 160,         // Close melee range near the slimes
        loot_name: 'Greatsword',
        loot_effect: [{ stat: 'crit', value: 5 },
        { stat: 'damage', value: 2 }]
    },
    archer: {
        id: 'archer',
        type: 'range',       // Ranged attacker
        projectile: 'arrow',  // Arrow projectile type
        tier: 3,
        hp: 45,
        maxHp: 45,
        damage: 5,            // 2 Damage per projectile
        attackSpeed: 1.5,     // 0.8 attacks per second
        moveSpeed: 2,
        targetX: 380,         // Right boundary
        loot_name: 'Long Bow',
        loot_effect: { stat: 'crit', value: 5 }
    },
    tank: {
        id: 'tank',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 500,
        maxHp: 500,
        damage: 0,
        attackSpeed: 0,     // Attacks per second
        moveSpeed: 5,
        targetX: 250,         // Center of battlefield
        loot_name: 'Knight Shield',
        loot_effect: { stat: 'hp', value: 3 }
    },
    halberdier: {
        id: 'halberdier',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 90,                // 5 HP
        maxHp: 90,
        damage: 10,            // 4 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 4,       // Move speed
        targetX: 180,         // Close melee range near the slimes
        loot_name: 'Halberd',
        loot_effect: [{ stat: 'crit', value: 10 },
        { stat: 'damage', value: 1 }]
    },


    // Tier 4 - Forest Enemies ---------------------
    redfairy: {
        id: 'redfairy',
        type: 'range',
        projectile: 'fireball',
        tier: 4,
        hp: 100,
        maxHp: 100,
        damage: 5,
        attackSpeed: 1.2,
        moveSpeed: 4,
        targetX: 370,
        loot_name: 'Red Fairy Core',
        loot_effect: { stat: 'burn', value: 3 }
    },
    elf: {
        id: 'elf',
        type: 'range',
        projectile: 'arrow',
        tier: 4,
        hp: 300,
        maxHp: 300,
        damage: 10,
        attackSpeed: 1.2,
        moveSpeed: 2,
        targetX: 400,
        loot_name: 'Elf Bandana',
        loot_effect: [{ stat: 'crit', value: 2 },
        { stat: 'damage', value: 1 },
        { stat: 'hp', value: 2 }]
    },
    wolf: {
        id: 'wolf',
        type: 'melee',
        projectile: 'slash1',
        tier: 4,
        hp: 350,
        maxHp: 350,
        damage: 15,
        attackSpeed: 1.4,
        moveSpeed: 7,
        targetX: 160,
        loot_name: 'Wolf Tail',
        loot_effect: { stat: 'crit', value: 3 }
    },
    bear: {
        id: 'bear',
        type: 'melee',
        projectile: 'slash1',
        tier: 4,
        hp: 2000,
        maxHp: 2000,
        damage: 18,
        attackSpeed: 0.65,
        moveSpeed: 1.5,
        targetX: 160,
        loot_name: 'Bear Paw',
        loot_effect: [{ stat: 'hp', value: 1 },
        { stat: 'damage', value: 2 }]
    },
    ent: {
        id: 'ent',
        type: 'tank',
        projectile: 'none',
        tier: 4,
        hp: 2400,
        maxHp: 2400,
        damage: 0,
        attackSpeed: 0,
        moveSpeed: 6,
        targetX: 260,
        loot_name: 'Ent Branch',
        loot_effect: [{ stat: 'hp', value: 5 },
        { stat: 'damage', value: 1 }]
    },
    rabbit: {
        id: 'rabbit',
        type: 'rush',
        projectile: 'slash1',
        tier: 4,
        hp: 50,
        maxHp: 50,
        damage: 1,
        attackSpeed: 2,
        moveSpeed: 12,
        targetX: 135,
        loot_name: 'Carrot',
        loot_effect: { stat: 'regen', value: 1 }
    },
    fairy: {
        id: 'fairy',
        // Support enemies heal allies instead of firing at the slime army.
        type: 'support',
        projectile: 'heal1',
        tier: 4,
        hp: 200,
        maxHp: 200,
        damage: 25,
        attackSpeed: 1.15,
        moveSpeed: 2,
        targetX: 370,
        loot_name: 'Fairy Core',
        loot_effect: { stat: 'regen', value: 2 }
    },
    // Tier 5 - Undead Enemies ---------------------
    zombi: {
        id: 'zombi',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 3000,
        maxHp: 3000,
        damage: 16,
        attackSpeed: 0.8,
        moveSpeed: 1.2,
        targetX: 160,
        loot_name: 'Zombie Rags',
        loot_effect: { stat: 'hp', value: 2 }
    },
    halfzombi: {
        id: 'halfzombi', type: 'melee', projectile: 'slash1', tier: 5,
        hp: 4000,
        maxHp: 4000,
        damage: 14,
        attackSpeed: 0.55,
        moveSpeed: 0.65,
        targetX: 160,
        loot_name: 'Talking Head',
        loot_effect: [{ stat: 'regen', value: 3 }, { stat: 'hp', value: -5 }]
    },
    bigzombi: {
        id: 'bigzombi',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 6000,
        maxHp: 6000,
        damage: 35,
        attackSpeed: 0.85,
        moveSpeed: 3,
        targetX: 160,
        loot_name: 'Ripped Shorts',
        loot_effect: [{ stat: 'hp', value: 10 }, { stat: 'damage', value: 2 }]
    },
    skeleton: {
        id: 'skeleton',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 350,
        maxHp: 350,
        damage: 14,
        attackSpeed: 1.6,
        moveSpeed: 9,
        targetX: 145,
        loot_name: 'Sword (Arm Included)',
        loot_effect: { stat: 'damage', value: 5 }
    },
    skeletonarcher: {
        id: 'skeletonarcher',
        type: 'range',
        projectile: 'arrow',
        tier: 5,
        hp: 450,
        maxHp: 450,
        damage: 14,
        attackSpeed: 1.3,
        moveSpeed: 3,
        targetX: 390,
        loot_name: 'Bow (Arm Included)',
        loot_effect: [{ stat: 'crit', value: 3 }, { stat: 'damage', value: 1 }]
    },
    // Tier -1, Tests & Secrets ------------------------------------
    death: {
        id: 'death',
        type: 'melee',
        projectile: '',
        tier: 0,
        hp: 9999999999,
        maxHp: 9999999999,
        damage: 999,            // Damage per projectile
        attackSpeed: 60,     // attacks per second
        moveSpeed: 1,
        targetX: 150,         // 400=right border, 100 = Slime army
        loot_name: '',
        loot_effect: []
    },
    testtank: {
        id: 'tank',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: -1,
        hp: 10,
        maxHp: 10,
        damage: 1,
        attackSpeed: 0,     // 0.5 attacks per second
        moveSpeed: 0.6,       // Slow move speed
        targetX: 250,         // Center of battlefield
        loot_name: 'Test Knight Shield',
        loot_effect: { stat: 'hp', value: 1 }
    },
    testrange: {
        id: 'catapult',
        type: 'range',
        projectile: 'boulder',
        tier: -1,
        hp: 99999,
        maxHp: 99999,
        damage: 1,
        attackSpeed: 0.5,   // Attacks per second
        moveSpeed: 0.3,
        targetX: 400,       // 250 = Center of battlefield, 100 = Slimes, 400 = long range
        loot_name: 'Test Range Shield',
        loot_effect: { stat: 'hp', value: 1 }
    },
};

export const PROJECTILE_TYPES = {
    arrow: {
        id: 'arrow',
        sprite: 'images/projectiles/arrow.png',
        fallbackIcon: '🏹',
        arcHeight: 25, // Curved arc height in px
        duration: 0.5, // Parabolic flight time in seconds
        rotationMode: 'tangent' // Follows smooth flight curve angle
    },
    fireball: {
        id: 'fireball',
        sprite: 'images/projectiles/fireball.png',
        fallbackIcon: '🔥',
        arcHeight: 30, // Smooth arc height in px
        duration: 0.5, // Fast & snappy flight time matching arrows
        rotationMode: 'tangent' // Follows smooth flight curve angle
    },
    flask: {
        id: 'flask',
        sprite: 'images/projectiles/flask.png',
        fallbackIcon: '🧪',
        arcHeight: 35, // Curved high arc height in px
        duration: 1.0, // 50% slower flight speed (1.0s vs 0.5s)
        rotationMode: 'spin' // Rotates on itself continuously during flight
    },
    heal1: {
        id: 'heal1',
        sprite: 'images/projectiles/heal1.png',
        fallbackIcon: '*',
        arcHeight: 20,
        duration: 0.55,
        rotationMode: 'tangent'
    }, boulder: {
        id: 'boulder',
        sprite: 'images/projectiles/boulder.png',
        fallbackIcon: '🪨',
        arcHeight: 35, // Curved high arc height in px
        duration: 1.0, // 50% slower flight speed like flask
        rotationMode: 'spin' // Rotates on itself continuously during flight
    }
};

export let activeEnemies = [];
export let activeProjectiles = [];
export let activeGroundLoots = [];

export let waveTotalEnemies = 0;
export let waveSpawnedEnemies = 0;

let postWave50BackgroundTimerId = null;
let hasEnteredPostWave50 = false;

function triggerPostWave50BackgroundTransition() {
    const battlefield = document.querySelector('.battlefield-card');
    if (!battlefield || hasEnteredPostWave50) return;

    hasEnteredPostWave50 = true;
    if (postWave50BackgroundTimerId) clearTimeout(postWave50BackgroundTimerId);

    battlefield.style.backgroundImage = "url('images/backgrounds/inverted.jpg')";
    postWave50BackgroundTimerId = setTimeout(() => {
        battlefield.style.backgroundImage = "url('images/backgrounds/black.jpg')";
        postWave50BackgroundTimerId = null;
    }, 250);
}

function resetBattlefieldBackground() {
    if (postWave50BackgroundTimerId) clearTimeout(postWave50BackgroundTimerId);
    postWave50BackgroundTimerId = null;
    hasEnteredPostWave50 = false;

    const battlefield = document.querySelector('.battlefield-card');
    if (battlefield) battlefield.style.backgroundImage = '';
}

export function updateWaveCountdownUI() {
    const el = document.getElementById('enemyWaveCount');
    if (el) {
        el.textContent = `Wave ${gameState.currentWave}: ${waveSpawnedEnemies}/${waveTotalEnemies}`;
    }
}

export function startNextWaveCountdown(seconds = 10) {
    if (countdownTimerId) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
    }

    nextWaveCountdownSec = seconds;
    updateWaveCountdownText();

    countdownTimerId = setInterval(() => {
        if (isGamePaused) return;

        nextWaveCountdownSec--;
        updateWaveCountdownText();

        if (nextWaveCountdownSec <= 0) {
            clearInterval(countdownTimerId);
            countdownTimerId = null;
            startNextWave();
        }
    }, 1000);
}

function updateWaveCountdownText() {
    const el = document.getElementById('enemyWaveCount');
    if (el) {
        el.textContent = `Wave ${gameState.currentWave} in ${nextWaveCountdownSec}s`;
    }
}

let isAutoPlay = true; // Game is always playing by default
let isWaveActive = false;
let autoWaveTimeoutId = null;
let countdownTimerId = null;
let nextWaveCountdownSec = 0;

function applyNewGamePlusPresentation() {
    const isVillage = gameState.isInNewGamePlus === true;
    document.body.classList.toggle('new-game-plus', isVillage);
    const battlefield = document.querySelector('.battlefield-card');
    if (battlefield) battlefield.style.backgroundImage = isVillage ? "url('images/backgrounds/village.png')" : '';
}

export function initEnemiesModule() {
    applyNewGamePlusPresentation();
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
 * with Tier 0 enemies spawning first, then randomizing all remaining enemies.
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

    // Tier 0 enemies (bosses/special introductions) always lead the wave in composition order.
    // Everything else keeps the normal randomized spawn order.
    const tierZeroEnemies = expanded.filter(typeId => ENEMY_TYPES[typeId]?.tier === 0);
    const remainingEnemies = expanded.filter(typeId => ENEMY_TYPES[typeId]?.tier !== 0);
    return [...tierZeroEnemies, ...shuffleArray(remainingEnemies)];
}

/**
 * Generate wave enemy composition list
 * First element is the spawn interval in seconds between enemies in the wave.
 * Enemy entries support 'type:count' syntax (e.g., 'archer:10', 'soldier:3').
 */
function generateWaveComposition(waveNum) {
    // Tests
    //return [0.15, 'assassin:10'];

    // 1-10, Manual play, Villagers
    if (waveNum === 1) return [0, 'beggar:1'];
    if (waveNum === 2) return [0.5, 'beggar:2', 'farmer'];
    if (waveNum === 3) return [0.5, 'farmer:3', 'fisher:2'];
    if (waveNum === 5) return [0.2, 'beggar:5', 'torchfarmer:1', 'farmer:1', 'fisher:1'];
    if (waveNum === 4) return [0.1, 'thief:1', 'guard:1'];
    if (waveNum === 6) return [0.2, 'fisher:10', 'torchfarmer:5'];
    if (waveNum === 7) return [0.4, 'farmer:15', 'torchfarmer:2'];
    if (waveNum === 8) return [0.8, 'beggar:8', 'farmer:2', 'torchfarmer:2', 'fisher:2'];
    if (waveNum === 9) return [0.8, 'torchfarmer3:9', 'farmer:3', 'beggar:2', 'fisher:3'];
    if (waveNum === 10) return [0, 'mage:1'];

    // 11-20 Autoplay, Adventurers
    if (waveNum === 11) return [0.1, 'adventurer:2', 'hunter:3'];
    if (waveNum === 12) return [0.1, 'adventurer:2', 'assassin:2', 'hunter:3'];
    if (waveNum === 13) return [0.1, 'assassin:4', 'lumberjack:2', 'hunter:3'];
    if (waveNum === 14) return [0.1, 'lumberjack:5', 'lancer:3', 'hunter:3'];
    if (waveNum === 15) return [0.1, 'lancer:3', 'guard:5', 'mage:1'];
    if (waveNum === 16) return [0.1, 'guard:10', 'hunter:6'];
    if (waveNum === 17) return [0.1, 'guard:6', 'lancer:5', 'adventurer:4', 'hunter:2'];
    if (waveNum === 18) return [0.1, 'guard:7', 'hunter:15'];
    if (waveNum === 19) return [0.1, 'assassin:15', 'hunter:15'];
    if (waveNum === 20) return [0, 'berserker:1', 'alchemist:1'];

    // 21-30 Soldiers TODO
    if (waveNum === 21) return [0.1, 'soldier:1', 'tank:1', 'archer:1'];
    if (waveNum === 22) return [0.1, 'tank:2', 'halberdier:3', 'soldier:2', 'archer:1'];
    if (waveNum === 23) return [0.1, 'tank:2', 'halberdier:2', 'archer:5'];
    if (waveNum === 24) return [0.1, 'tank:1', 'soldier2h:5', 'archer:2', , 'berserker:1'];
    if (waveNum === 25) return [0.1, 'tank:3', 'alchemist:1', 'mage:2'];
    if (waveNum === 26) return [0.1, 'soldier2h:15'];
    if (waveNum === 27) return [0.1, 'guard:8', 'halberdier:4', 'archer:4'];
    if (waveNum === 28) return [0.1, 'guard:10', 'halberdier:10'];
    if (waveNum === 29) return [0.1, 'tank:5', 'archer:10'];
    if (waveNum === 30) return [0, 'catapult:1', 'tank:6', 'berserker:1'];

    // 31-40 Forest Enemies: deliberately light introductory compositions.
    if (waveNum === 31) return [0.1, 'wolf:5'];
    if (waveNum === 32) return [0.1, 'wolf:5', 'bear:2'];
    if (waveNum === 33) return [0.2, 'ent:2', 'elf:4', 'rabbit:2'];
    if (waveNum === 34) return [0.1, 'wolf:10', 'rabbit:2'];
    if (waveNum === 35) return [0.1, 'ent:3', 'alchemist:2', 'fairy:2'];
    if (waveNum === 36) return [0.1, 'berserker:2', 'elf:5', 'fairy:2'];
    if (waveNum === 37) return [0.1, 'ent:2', 'redfairy:2', 'fairy:2'];
    if (waveNum === 38) return [0.1, 'bear:2', 'berserker:2', 'fairy:5'];
    if (waveNum === 39) return [0.1, 'bear:3', 'ent:2', 'redfairy:2'];
    if (waveNum === 40) return [0.2, 'ent:2', 'stonegolem:1', 'fairy:5', 'redfairy:3'];

    // 41-50 Undeads: introductory compositions, building from slow walkers into mixed formations.
    if (waveNum === 41) return [0.2, 'zombi:4'];
    if (waveNum === 42) return [0.2, 'zombi:5', 'skeleton:3'];
    if (waveNum === 43) return [0.15, 'skeleton:8', 'skeletonarcher:2'];
    if (waveNum === 44) return [0.2, 'halfzombi:2', 'zombi:5', 'skeletonarcher:4'];
    if (waveNum === 45) return [0.15, 'bigzombi:1', 'skeleton:6', 'skeletonarcher:3'];
    if (waveNum === 46) return [0.2, 'zombi:8', 'halfzombi:3', 'skeletonarcher:3'];
    if (waveNum === 47) return [0.12, 'skeleton:10', 'skeletonarcher:5'];
    if (waveNum === 48) return [0.15, 'bigzombi:1', 'zombi:6', 'skeleton:6'];
    if (waveNum === 49) return [0.12, 'halfzombi:4', 'skeleton:8', 'skeletonarcher:4'];
    if (waveNum === 50) return [0.2, 'lich:1', 'skeleton:25', 'skeletonarcher:5'];

    // Death
    else {
        triggerPostWave50BackgroundTransition();
        return [0, 'death:1'];
    }
}

/**
 * Starts the next wave: Spawns enemies with dynamic wave spawn timing
 */
export function startNextWave() {
    if (gameState.isInNewGamePlus) return;
    if (autoWaveTimeoutId) {
        clearTimeout(autoWaveTimeoutId);
        autoWaveTimeoutId = null;
    }
    if (countdownTimerId) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
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
    showBattlefieldWaveBanner(`${String.fromCodePoint(0x26A1, 0xFE0F)} WAVE ${gameState.currentWave}`);
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

    waveTotalEnemies = enemyList.length;
    waveSpawnedEnemies = 0;
    updateWaveCountdownUI();

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
export function resetGameFull({ startWave = true } = {}) {
    const newGamePlusCompletions = gameState.newGamePlusCompletions || 0;
    document.body.classList.remove('new-game-plus');
    resetBattlefieldBackground();
    if (countdownTimerId) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
    }
    if (autoWaveTimeoutId) {
        clearTimeout(autoWaveTimeoutId);
        autoWaveTimeoutId = null;
    }
    isWaveActive = false;
    // 1. Reset state: Scraps 0, Score 0, Wave 1, Army back to 1 Base Slime with no upgrades
    gameState.scraps = 0;
    gameState.score = 0;
    gameState.currentWave = 1;
    gameState.newGamePlusCompletions = newGamePlusCompletions;
    gameState.isInNewGamePlus = false;
    gameState.maxWaveCleared = 0;
    gameState.armySize = 1;
    gameState.maxSlimesReached = 1;
    gameState.maxAscendedSlimesReached = 0;
    gameState.slimeDamage = 1;
    gameState.slimeRegen = 0;
    gameState.hasSlimeDied = false;
    gameState.hasUsedDivision = false;
    gameState.digestionLevel = 0;
    gameState.incubationLevel = 0;
    gameState.autoEatLevel = 0;
    gameState.fortificationLevel = 0;
    gameState.afkScrapCeilingLevel = 0;
    gameState.afkScrapLevel = 0;
    gameState.afkScrapCeilingPurchased = false;
    gameState.afkScrapPurchased = false;
    gameState.afkLastAwayAt = Date.now();
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
        incubation: false,
        selectionCard: false,
        selection: false,
        evolutionCard: false,
        evolution: false,
        ignition: false,
        glaciation: false,
        petrification: false,
        intoxication: false
    };
    gameState.waveSnapshots = {};
    const initialName = 'Gooey';
    const permanentHp = 10 + (gameState.fortificationLevel || 0) + (gameState.alchemistEnduranceLevel || 0);
    const permanentCrit = gameState.alchemistLuckLevel || 0;
    const permanentRegen = gameState.alchemistRegenLevel || 0;
    const permanentDamage = 1 + (gameState.alchemistRageLevel || 0);
    gameState.bestRoster = [
        { id: initialName, name: initialName, type: 'base', hp: permanentHp, maxHp: permanentHp, damage: permanentDamage, critChance: permanentCrit, regen: permanentRegen, ascended: false, equipment: [] }
    ];
    gameState.slimes = [
        { id: initialName, name: initialName, type: 'base', hp: permanentHp, maxHp: permanentHp, damage: permanentDamage, critChance: permanentCrit, regen: permanentRegen, ascended: false, equipment: [] }
    ];
    saveStateToLocal();

    // 2. Reset ascended auto-attack timers
    initAscendedAutoAttacks();

    // 3. Clear ground loots, active enemies & projectiles from DOM & memory state
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

    const overlay = document.querySelector('.battlefield-overlay');
    if (overlay) {
        const leftoverLoots = overlay.querySelectorAll('.ground-loot-item');
        leftoverLoots.forEach(el => el.remove());
    }

    const enemiesContainerEl = document.getElementById('enemiesContainer');
    if (enemiesContainerEl) enemiesContainerEl.innerHTML = '';

    // 4. Force DOM army container to clear and re-render 1 Base Slime
    const armyContainerEl = document.getElementById('armyContainer');
    if (armyContainerEl) armyContainerEl.innerHTML = '';

    waveTotalEnemies = 0;
    waveSpawnedEnemies = 0;
    updateWaveCountdownUI();

    // 5. Update UI and optionally restart Wave 1
    updateUI();
    if (startWave) startNextWave();
}

/**
 * Ends a run when Death wipes the army. Run progression resets, while the
 * healed roster remains visible at the village without being deployed.
 */
export function enterNewGamePlus() {
    if (isNewGamePlusTransition || gameState.isInNewGamePlus) return;
    isNewGamePlusTransition = true;

    const rosterSource = (gameState.bestRoster && gameState.bestRoster.length > 0)
        ? gameState.bestRoster
        : (gameState.slimes || []);
    const healedRoster = rosterSource.map((slime, index) => ({
        ...JSON.parse(JSON.stringify(slime)),
        id: slime.id || slime.name || `Slime ${index + 1}`,
        name: slime.name || slime.id || `Slime ${index + 1}`,
        hp: slime.maxHp || 10,
        maxHp: slime.maxHp || 10,
        slotIndex: slime.slotIndex !== undefined ? slime.slotIndex : index
    }));
    const completedRuns = (gameState.newGamePlusCompletions || 0) + 1;
    const villageCoinReward = completedRuns;

    resetGameFull({ startWave: false });
    gameState.newGamePlusCompletions = completedRuns;
    gameState.villageCoins = (gameState.villageCoins || 0) + villageCoinReward;
    gameState.isInNewGamePlus = true;
    gameState.bestRoster = healedRoster.length > 0 ? healedRoster : gameState.bestRoster;
    gameState.slimes = gameState.bestRoster.map((slime, index) => ({
        ...JSON.parse(JSON.stringify(slime)),
        hp: slime.maxHp || 10,
        slotIndex: slime.slotIndex !== undefined ? slime.slotIndex : index
    }));
    gameState.armySize = gameState.slimes.length;

    clearAscendedAutoAttacks();
    const armyContainer = document.getElementById('armyContainer');
    if (armyContainer) armyContainer.innerHTML = '';
    applyNewGamePlusPresentation();
    saveStateToLocal();
    updateUI();
    isNewGamePlusTransition = false;
}

/** Deploy the healed village roster and begin the next run. */
export function startNewGamePlusRun() {
    if (!gameState.isInNewGamePlus) return;
    gameState.isInNewGamePlus = false;
    applyNewGamePlusPresentation();
    saveStateToLocal();
    updateUI();
    playSlimeRainRespawnAnimation(() => startNextWave());
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

        // Apply run and permanent Slime Regeneration per wave.
        if (gameState.slimes) {
            gameState.slimes.forEach(s => {
                const regeneration = getSlimeTotalRegen(s);
                if (s.hp > 0 && regeneration > 0) {
                    s.hp = Math.min(s.maxHp, s.hp + regeneration);
                }
            });
        }

        // XP is the number of waves survived since this Slime last died.
        (gameState.slimes || []).forEach(s => { s.wavesClearedSinceDeath = (s.wavesClearedSinceDeath || 0) + 1; });
        // Give airborne slimes time to land before sending one to eat.
        if ((gameState.autoEatLevel || 0) > 0) {
            setTimeout(() => {
                if (activeGroundLoots.length > 0) triggerSlimeEatLoot();
            }, 2000);
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
            const checkLootInterval = setInterval(() => {
                const hasRemainingLoot = activeGroundLoots && activeGroundLoots.length > 0;

                if (!hasRemainingLoot) {
                    clearInterval(checkLootInterval);

                    // Re-save wave snapshot & update UI with newly collected scraps
                    const finalUncollectedLootValue = (activeGroundLoots || []).reduce((sum, loot) => sum + (loot.value || 1), 0);
                    saveWaveSnapshot(clearedWaveNum, finalUncollectedLootValue);
                    saveStateToLocal();
                    updateUI();
                    showBattlefieldWaveBanner(`${String.fromCodePoint(0x1F389)} WAVE ${clearedWaveNum} CLEARED!<br><span style="font-size: 0.9rem; color: #cbd5e1; font-weight: 600;">${String.fromCodePoint(0x1F6D2)} Merchant Arriving...</span>`);

                    setTimeout(() => {
                        openShopModal(clearedWaveNum);
                    }, 2000);
                }
            }, 150);
        } else if (isAutoPlay) {
            console.log('[AUTO PLAY] Triggering next wave countdown...');
            startNextWaveCountdown(10);
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
    const enemyDef = ENEMY_TYPES[enemy.typeId] || {};
    const lootValue = calculateLootValue(enemyDef.loot_effect);

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
        const lootName = enemyDef.loot_name || enemy.typeId || 'Loot';
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
    // Each completed run raises the next New Game+ tier by 10% from base values.
    const newGamePlusMultiplier = 1 + 0.10 * Math.max(0, gameState.newGamePlusCompletions || 0);
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier * newGamePlusMultiplier));
    const scaledDamage = Math.max(0, Math.round((def.damage || 0) * newGamePlusMultiplier));
    const scaledMoveSpeed = (def.moveSpeed || 0) * 25 * newGamePlusMultiplier;

    // Add a small -10 to +10 stop offset to reduce overlapping.
    const baseTargetX = def.targetX !== undefined ? def.targetX : 300;
    const randomOffset = (Math.random() * 20) - 10;
    const finalTargetX = Math.round(baseTargetX + randomOffset);

    const enemyInstance = {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        typeId: enemyIdKey,
        type: def.type,
        projectile: def.projectile || null,
        sprite: `images/ennemies/${enemyIdKey}.png`,
        x: 520,
        y: 120 + (Math.random() * 30 - 15),
        speed: scaledMoveSpeed,
        targetX: finalTargetX,
        hp: scaledHp,
        maxHp: scaledHp,
        damage: scaledDamage,
        // A small per-enemy variance stops range/support volleys from staying synchronized.
        attackSpeed: (def.type === 'range' || def.type === 'support')
            ? Math.max(0.01, def.attackSpeed + (Math.random() * 0.2 - 0.1))
            : def.attackSpeed,
        state: 'walking',
        attackTimer: 0,
        hasDroppedLoot: false,
        el: null
    };

    activeEnemies.push(enemyInstance);
    renderNewEnemyDOM(enemyInstance);

    // Update wave countdown
    waveSpawnedEnemies = Math.min(waveTotalEnemies, waveSpawnedEnemies + 1);
    updateWaveCountdownUI();

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
    enemy.spriteEl = unit.querySelector('.enemy-sprite');
    enemy.statusRowEl = unit.querySelector('.enemy-status-row');

    // Dynamically detect source image dimensions and adjust enemy size & shadow
    const spriteEl = enemy.spriteEl;
    const shadowEl = unit.querySelector('.enemy-shadow');

    const adaptEnemyDimensions = () => {
        const w = spriteEl.naturalWidth || 28;
        const h = spriteEl.naturalHeight || 28;
        spriteEl.style.width = `${w}px`;
        spriteEl.style.height = `${h}px`;
        unit.style.width = `${w}px`;
        unit.style.height = `${h}px`;

        // Keep every sprite taller than the normal 28px enemy on the same battlefield baseline.
        // This adapts continuously to the source sprite height instead of relying on a fixed tall-sprite cutoff.
        const baselineOffset = Math.max(0, h - 28);
        const usesTallEnemyMotion = h >= 50;
        unit.classList.toggle('enemy-tall', usesTallEnemyMotion);
        if (baselineOffset > 0 && !enemy.tallSpriteAdjusted) {
            enemy.y -= baselineOffset;
            unit.style.top = `${enemy.y}px`;
            enemy.tallSpriteAdjusted = true;
        }

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

/** Damage each Slime once when a Rush sprite physically runs through it. */
function damageSlimesTouchedByRush(enemy) {
    const armyContainer = document.getElementById('armyContainer');
    const sprite = enemy.spriteEl || enemy.el?.querySelector('.enemy-sprite');
    if (!armyContainer || !sprite) return;

    const enemyRect = sprite.getBoundingClientRect();
    if (enemyRect.width <= 0 || enemyRect.height <= 0) return;
    if (!enemy.RushHitSlimeIds) enemy.RushHitSlimeIds = new Set();

    armyContainer.querySelectorAll('.slime-unit[data-slime-id]').forEach(unit => {
        const slimeId = unit.dataset.slimeId;
        if (enemy.RushHitSlimeIds.has(slimeId)) return;

        const slimeRect = unit.getBoundingClientRect();
        const overlaps = enemyRect.left < slimeRect.right && enemyRect.right > slimeRect.left
            && enemyRect.top < slimeRect.bottom && enemyRect.bottom > slimeRect.top;
        if (!overlaps) return;

        const slime = (gameState.slimes || []).find(candidate => String(candidate.id) === String(slimeId));
        if (!slime || slime.hp <= 0) return;
        enemy.RushHitSlimeIds.add(slimeId);
        damageSpecificSlime(slime, enemy.damage, 'slime-dmg', enemy);
    });
}
/**
 * Update Enemy Positions, Attacks & AI State Machine Loop
 */
export function updateEnemies(deltaSeconds) {
    // Safety auto-recovery: If wave is active with 0 enemies and no pending timeouts for over 3 seconds, recover flow!
    if (isAutoPlay && isWaveActive && activeEnemies.length === 0 && !autoWaveTimeoutId && !isRewinding && !isGamePaused) {
        if (!window._emptyWaveSafetyTicks) window._emptyWaveSafetyTicks = 0;
        window._emptyWaveSafetyTicks++;
        if (window._emptyWaveSafetyTicks > 90) { // ~3 seconds at 30 FPS
            window._emptyWaveSafetyTicks = 0;
            console.warn('[SAFETY RECOVERY] Active wave stuck with 0 enemies. Restarting next wave...');
            isWaveActive = false;
            startNextWave();
        }
    } else {
        window._emptyWaveSafetyTicks = 0;
    }

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
        const isControlImmune = enemy.typeId === 'death';
        if (isControlImmune) {
            enemy.effects.freezeTimer = 0;
            enemy.effects.stunTimer = 0;
        }
        let isFrozen = false;
        if (!isControlImmune && enemy.effects.freezeTimer > 0) {
            enemy.effects.freezeTimer -= deltaSeconds;
            isFrozen = true;
        }

        let isStunned = false;
        if (!isControlImmune && enemy.effects.stunTimer > 0) {
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
                if (enemy.spriteEl) {
                    enemy.spriteEl.classList.add('hit-flash-white');
                    setTimeout(() => { if (enemy.spriteEl) enemy.spriteEl.classList.remove('hit-flash-white'); }, 150);
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
                if (enemy.spriteEl) {
                    enemy.spriteEl.classList.add('hit-flash-white');
                    setTimeout(() => { if (enemy.spriteEl) enemy.spriteEl.classList.remove('hit-flash-white'); }, 150);
                }
            }

            if (enemy.effects.poisonTimer <= 0) {
                enemy.effects.poisonStacks = 0;
            }
        }

        // --- 3. Movement Phase ---
        // Rushs never stop: they run through the battlefield and leave from the left edge.
        if (!isDisabled && enemy.type === 'rush') {
            enemy.x -= enemy.speed * deltaSeconds;
            if (enemy.x < -50) {
                if (enemy.el) enemy.el.remove();
                activeEnemies.splice(i, 1);
                checkWaveCompletion();
                continue;
            }
        } else if (!isDisabled && enemy.x > enemy.targetX) {
            enemy.x -= enemy.speed * deltaSeconds;
            if (enemy.x <= enemy.targetX) {
                enemy.x = enemy.targetX;
                const attackInterval = enemy.attackSpeed > 0 ? 1 / enemy.attackSpeed : 0;
                // Ranged/support units also get a short unique opening delay, so their first volley is not synchronized.
                enemy.attackTimer = (enemy.type === 'range' || enemy.type === 'support')
                    ? Math.max(0, attackInterval - Math.random() * 0.1)
                    : attackInterval;
                if (enemy.type === 'melee') {
                    enemy.state = 'attacking';
                } else if (enemy.type === 'tank') {
                    enemy.state = 'tanking';
                } else if (enemy.type === 'range') {
                    enemy.state = 'range_attack';
                } else if (enemy.type === 'support') {
                    enemy.state = 'support_attack';
                }
            }
        }

        // --- 4. State-Specific Attack Executions (Paused if disabled) ---
        if (!isDisabled) {
            if (enemy.state === 'attacking') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    damageRandomSlime(enemy.damage, enemy);
                    spawnSlashEffect(enemy);
                    if (enemy.spriteEl) {
                        enemy.spriteEl.classList.add('enemy-strike-vibrate');
                        const spr = enemy.spriteEl;
                        setTimeout(() => {
                            if (spr) spr.classList.remove('enemy-strike-vibrate');
                        }, 200);
                    }
                }
            } else if (enemy.state === 'range_attack') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    fireProjectiles(enemy);
                }
            } else if (enemy.state === 'support_attack') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    healFrontmostEnemy(enemy);
                }
            }
        }

        // --- 5. Update Visual Position & Status Effect Overlay Filters ---
        if (enemy.el) {
            enemy.el.style.left = `${enemy.x}px`;
            // Lower feet sit in front, matching the depth ordering used by slimes.
            const enemyFootY = enemy.y + (enemy.spriteEl?.offsetHeight || 28);
            enemy.el.style.zIndex = `${Math.floor(enemyFootY)}`;

            const statusRow = enemy.statusRowEl;
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
                if (statusRow.innerHTML !== statusHTML) {
                    statusRow.innerHTML = statusHTML;
                }
            }

            enemy.el.classList.toggle('is-burning', enemy.effects.burnTimer > 0);
            enemy.el.classList.toggle('is-poisoned', enemy.effects.poisonTimer > 0);
            enemy.el.classList.toggle('is-frozen', isFrozen);

            const isAttacking = enemy.state === 'attacking';
            const isTanking = enemy.state === 'tanking';
            const isRanged = enemy.state === 'range_attack';
            const isSupport = enemy.state === 'support_attack';

            enemy.el.classList.toggle('enemy-attacking', isAttacking);
            enemy.el.classList.toggle('enemy-tanking', isTanking);
            enemy.el.classList.toggle('enemy-range', isRanged || isSupport);
            enemy.el.classList.toggle('enemy-walking', !isAttacking && !isTanking && !isRanged && !isSupport);
        }

        if (enemy.type === 'rush') damageSlimesTouchedByRush(enemy);
    }

    // --- Process Status Effects (Burn DoT, Poison DoT, Stun) & Status Icons on Slimes ---
    if (gameState.slimes) {
        const armyContainer = document.getElementById('armyContainer');

        gameState.slimes.forEach(slime => {
            if (slime.hp <= 0) return;

            if (!slime.effects) {
                slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
            }

            // 1. Process Burn Status DoT (1 damage per stack every 0.5s)
            if (slime.effects.burnTimer > 0) {
                slime.effects.burnTimer -= deltaSeconds;
                slime.effects.burnTickTimer = (slime.effects.burnTickTimer || 0) + deltaSeconds;

                if (slime.effects.burnTickTimer >= 0.5) {
                    slime.effects.burnTickTimer -= 0.5;
                    const burnDmg = Math.max(1, slime.effects.burnStacks || 1);
                    damageSpecificSlime(slime, burnDmg);
                }

                if (slime.effects.burnTimer <= 0) {
                    slime.effects.burnStacks = 0;
                }
            }

            // 2. Process Poison Status DoT (2 damage per stack every 1.0s)
            if (slime.effects.poisonTimer > 0) {
                slime.effects.poisonTimer -= deltaSeconds;
                slime.effects.poisonTickTimer = (slime.effects.poisonTickTimer || 0) + deltaSeconds;

                if (slime.effects.poisonTickTimer >= 1.0) {
                    slime.effects.poisonTickTimer -= 1.0;
                    const poisonDmg = Math.max(2, (slime.effects.poisonStacks || 1) * 2);
                    damageSpecificSlime(slime, poisonDmg, 'poison-dmg');
                }

                if (slime.effects.poisonTimer <= 0) {
                    slime.effects.poisonStacks = 0;
                }
            }

            // 3. Process Stun Status Timer
            if (slime.effects.stunTimer > 0) {
                slime.effects.stunTimer -= deltaSeconds;
                if (slime.effects.stunTimer <= 0) {
                    slime.effects.stunTimer = 0;
                }
            }

            // 4. Update Slime Status Row Icons (🔥 🧪 💫) & CSS Filters
            if (armyContainer) {
                if (!slime.el || typeof slime.el.querySelector !== 'function') {
                    slime.el = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
                    slime.statusRowEl = null;
                }
                const unit = slime.el;
                if (unit) {
                    if (!slime.statusRowEl) {
                        slime.statusRowEl = unit.querySelector('.slime-status-row');
                    }
                    const statusRow = slime.statusRowEl;
                    if (statusRow) {
                        let statusHTML = '';
                        if (slime.effects.burnTimer > 0) {
                            statusHTML += '<span class="status-icon burn-icon">🔥</span>';
                        }
                        if (slime.effects.poisonTimer > 0) {
                            statusHTML += '<span class="status-icon poison-icon">🧪</span>';
                        }
                        if (slime.effects.stunTimer > 0) {
                            statusHTML += '<span class="status-icon stun-icon">💫</span>';
                        }
                        if (statusRow.innerHTML !== statusHTML) {
                            statusRow.innerHTML = statusHTML;
                        }
                    }

                    unit.classList.toggle('is-burning', slime.effects.burnTimer > 0);
                    unit.classList.toggle('is-poisoned', slime.effects.poisonTimer > 0);
                    unit.classList.toggle('is-stunned', slime.effects.stunTimer > 0);

                    const rosterItem = document.getElementById(`roster_item_${slime.id}`);
                    if (rosterItem) {
                        rosterItem.classList.toggle('is-burning', slime.effects.burnTimer > 0);
                        rosterItem.classList.toggle('is-poisoned', slime.effects.poisonTimer > 0);
                        rosterItem.classList.toggle('is-frozen', (slime.effects.freezeTimer || 0) > 0);
                        rosterItem.classList.toggle('is-stunned', slime.effects.stunTimer > 0);
                    }
                }
            }
        });
    }

    updateProjectiles(deltaSeconds);
}

/**
 * Heal the ally furthest left on the battlefield (the lowest current x coordinate).
 * Supports heal the frontmost living enemy, including themselves when they are frontmost.
 */
function healFrontmostEnemy(support) {
    const target = activeEnemies
        .filter(enemy => enemy.hp > 0)
        .sort((a, b) => a.x - b.x)[0];

    if (!target) return;

    const healedAmount = Math.min(target.maxHp - target.hp, Math.max(0, support.damage || 0));
    target.hp += healedAmount;
    playSupportCastRay(support);
    playSupportHealAnimation(target);
    if (healedAmount > 0) showFloatingHealingNumber(target.x + 8, target.y - 14, healedAmount);

    if (support.el) {
        support.el.classList.remove('enemy-shoot-recoil');
        void support.el.offsetWidth;
        support.el.classList.add('enemy-shoot-recoil');
        setTimeout(() => support.el?.classList.remove('enemy-shoot-recoil'), 200);
    }
}

/** Brief vertical light ray emitted by a support at the moment of its cast. */
function playSupportCastRay(support) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const rayEl = document.createElement('div');
    rayEl.className = 'enemy-support-cast-ray';
    rayEl.style.left = `${support.x + 10}px`;
    rayEl.style.top = `${support.y - 24}px`;
    overlay.appendChild(rayEl);
    setTimeout(() => rayEl.remove(), 200);
}
/** Play the 12-frame, 50px-per-frame heal1 spritesheet directly over an ally. */
function playSupportHealAnimation(target) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const healEl = document.createElement('div');
    healEl.className = 'enemy-support-heal';
    healEl.style.left = `${target.x - 10}px`;
    healEl.style.top = `${target.y - 18}px`;
    healEl.style.width = '50px';
    healEl.style.height = '50px';
    healEl.style.backgroundImage = "url('images/projectiles/heal1.png')";
    healEl.style.backgroundRepeat = 'no-repeat';
    healEl.style.backgroundSize = '600px 50px';
    healEl.style.imageRendering = 'pixelated';
    healEl.style.pointerEvents = 'none';
    healEl.style.position = 'absolute';
    healEl.style.zIndex = '900';
    overlay.appendChild(healEl);

    const frameDurationMs = 400 / 12;
    for (let frame = 0; frame < 12; frame++) {
        setTimeout(() => {
            if (healEl.isConnected) healEl.style.backgroundPosition = `-${frame * 50}px 0`;
        }, frame * frameDurationMs);
    }
    setTimeout(() => healEl.remove(), 12 * frameDurationMs);
}
/**
 * Fire Ranged Projectiles using sprite images from images/projectiles/${id}.png
 * with parabolic arc trajectory & dynamic flight rotation / spinning
 */
function fireProjectiles(enemy) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const projKey = (enemy.projectile || '').toLowerCase();
    if (!projKey || projKey === 'none') return;
    const projType = PROJECTILE_TYPES[projKey] || {
        id: projKey,
        sprite: `images/projectiles/${projKey}.png`,
        fallbackIcon: '💥',
        arcHeight: 25,
        duration: 0.5,
        rotationMode: 'tangent'
    };

    const projEl = document.createElement('div');
    projEl.className = 'enemy-projectile-wrapper';
    projEl.style.left = `${enemy.x}px`;
    projEl.style.top = `${enemy.y + 10}px`;

    const spritePath = projType.sprite || `images/projectiles/${projKey}.png`;
    const fallback = projType.fallbackIcon || '💥';

    projEl.innerHTML = `
        <img src="${spritePath}" 
             alt="${projKey}" 
             class="projectile-sprite-img"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
        <span class="projectile-sprite-fallback" style="display:none;">${fallback}</span>
    `;

    overlay.appendChild(projEl);

    activeProjectiles.push({
        type: projType,
        key: projKey,
        startX: enemy.x,
        startY: enemy.y + 10,
        targetX: 105,
        targetY: enemy.y + 10,
        progress: 0,
        duration: projType.duration || 0.5,
        arcHeight: projType.arcHeight || 25,
        rotationMode: projType.rotationMode || 'tangent',
        damage: enemy.damage,
        sourceEnemy: enemy,
        el: projEl
    });

    // Trigger shoot recoil vibration animation on firing enemy
    if (enemy.el) {
        enemy.el.classList.remove('enemy-shoot-recoil');
        void enemy.el.offsetWidth; // Force reflow for rapid attacks
        enemy.el.classList.add('enemy-shoot-recoil');
        const enemyRef = enemy.el;
        setTimeout(() => {
            if (enemyRef) enemyRef.classList.remove('enemy-shoot-recoil');
        }, 200);
    }
}

/**
 * Apply Burn Status Effect to a slime (3 seconds DoT with stackable burn)
 */
export function applyBurnEffectToSlime(slime, duration = 3.0) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
    }

    if (slime.effects.burnTimer > 0) {
        slime.effects.burnStacks = (slime.effects.burnStacks || 1) + 1;
    } else {
        slime.effects.burnStacks = 1;
    }
    slime.effects.burnTimer = duration;
}

/**
 * Apply Poison Status Effect to a slime (3 seconds DoT: 2 dmg per stack every 1.0s)
 */
export function applyPoisonEffectToSlime(slime, duration = 3.0, stacks = 2) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
    }

    if (slime.effects.poisonTimer > 0) {
        slime.effects.poisonStacks = (slime.effects.poisonStacks || 0) + stacks;
    } else {
        slime.effects.poisonStacks = stacks;
    }
    slime.effects.poisonTimer = duration;
}

/**
 * Apply Stun Status Effect to a slime (cannot attack or eat while stunned)
 */
export function applyStunEffectToSlime(slime, duration = 2.5) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
    }

    slime.effects.stunTimer = Math.max(slime.effects.stunTimer || 0, duration);
}

function updateProjectiles(deltaSeconds) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.progress += deltaSeconds / p.duration;

        if (p.progress >= 1.0) {
            if (p.key === 'boulder' || (p.type && p.type.id === 'boulder')) {
                // Boulder AoE: Hits up to 3 unique slimes for damage and applies Stun to all 3
                const hitSlimes = damageMultipleRandomSlimes(3, p.damage, p.sourceEnemy);
                hitSlimes.forEach(slime => {
                    applyStunEffectToSlime(slime, 2.5);
                });
            } else if (p.key === 'flask' || (p.type && p.type.id === 'flask')) {
                // Flask AoE: Hits up to 3 unique slimes for 2 damage and applies 2 stacks of Poison each
                const hitSlimes = damageMultipleRandomSlimes(3, p.damage || 2, p.sourceEnemy);
                hitSlimes.forEach(slime => {
                    applyPoisonEffectToSlime(slime, 3.0, 2);
                });
            } else if (p.key === 'fireball' || (p.type && p.type.id === 'fireball')) {
                // Fireball AoE: Hits up to 2 unique slimes for damage and applies Burn DoT to both
                const hitSlimes = damageMultipleRandomSlimes(2, p.damage, p.sourceEnemy);
                hitSlimes.forEach(slime => {
                    applyBurnEffectToSlime(slime, 3.0);
                });
            } else {
                damageRandomSlime(p.damage, p.sourceEnemy);
            }

            if (p.el) p.el.remove();
            activeProjectiles.splice(i, 1);
        } else {
            const t = p.progress;
            const curX = p.startX + (p.targetX - p.startX) * t;
            const curY = p.startY + (p.targetY - p.startY) * t - 4 * p.arcHeight * t * (1 - t);

            let angleDeg = 0;
            if (p.rotationMode === 'spin') {
                // Continuous 360-degree rotation spinning fast as it travels
                angleDeg = (t * 1080) % 360;
            } else {
                // Calculate instantaneous tangent flight vector for rotation angle
                const vx = p.targetX - p.startX;
                const vy = (p.targetY - p.startY) - 4 * p.arcHeight * (1 - 2 * t);
                angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);
            }

            if (p.el) {
                p.el.style.left = `${curX}px`;
                p.el.style.top = `${curY}px`;
                p.el.style.transform = `rotate(${angleDeg}deg)`;
            }
        }
    }
}

/** Return combat targeting priority: Tank, middle/unassigned, then Support. */
function getSlimeCombatTargetPriority(slime) {
    const typeSpecialization = SLIME_TYPES[slime.type]?.specialization || '';
    const specialization = String(slime.specialization || typeSpecialization).toLowerCase();
    if (specialization === 'tank') return 0;
    if (specialization === 'support') return 2;
    return 1;
}

function pickPrioritySlimeTargets(aliveSlimes, count) {
    const targets = [];
    for (const priority of [0, 1, 2]) {
        const candidates = aliveSlimes
            .filter(slime => getSlimeCombatTargetPriority(slime) === priority)
            .sort(() => Math.random() - 0.5);
        targets.push(...candidates.slice(0, Math.max(0, count - targets.length)));
        if (targets.length >= count) break;
    }
    return targets;
}

/**
 * Deals damage to one random alive slime in the army
 */
export function damageRandomSlime(damageAmount, sourceEnemy = null) {
    if (!gameState.slimes) return null;

    const aliveSlimes = gameState.slimes.filter(s => s.hp > 0);
    if (aliveSlimes.length === 0) {
        return null;
    }

    const targetPool = sourceEnemy?.type === 'rush'
        ? aliveSlimes
        : pickPrioritySlimeTargets(aliveSlimes, 1);
    const targetSlime = targetPool[Math.floor(Math.random() * targetPool.length)];
    return damageSpecificSlime(targetSlime, damageAmount, 'slime-dmg', sourceEnemy);
}

/**
 * Deals damage to up to `count` unique alive slimes in the army (AoE impact)
 */
export function damageMultipleRandomSlimes(count = 3, damageAmount = 2, sourceEnemy = null) {
    if (!gameState.slimes) return [];

    const aliveSlimes = gameState.slimes.filter(s => s.hp > 0);
    if (aliveSlimes.length === 0) {
        return [];
    }

    // Non-rush attacks exhaust the front line before targeting the middle, then supports.
    const targetSlimes = sourceEnemy?.type === 'rush'
        ? [...aliveSlimes].sort(() => 0.5 - Math.random()).slice(0, Math.min(count, aliveSlimes.length))
        : pickPrioritySlimeTargets(aliveSlimes, Math.min(count, aliveSlimes.length));

    const hitSlimes = [];
    targetSlimes.forEach(slime => {
        const hit = damageSpecificSlime(slime, damageAmount, 'slime-dmg', sourceEnemy);
        if (hit) hitSlimes.push(hit);
    });

    return hitSlimes;
}

/**
 * Applies damage to a specific slime instance
 */
export function damageSpecificSlime(slime, damageAmount, dmgType = 'slime-dmg', sourceEnemy = null) {
    if (!slime || slime.hp <= 0) return null;

    slime.hp = Math.max(0, slime.hp - damageAmount);

    const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);
    const rosterItem = document.getElementById(`roster_item_${slime.id}`);
    const hpFill = rosterItem ? rosterItem.querySelector('.roster-hp-fill') : null;

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
                setTimeout(() => {
                    img.classList.remove('hit-flash-red');
                }, 180);
            }

            if (slime.hp <= 0) {
                gameState.hasSlimeDied = true;
                slime.wavesClearedSinceDeath = 0;
                // Instantly remove dead slime from memory array
                gameState.slimes = gameState.slimes.filter(s => s.id !== slime.id);
                gameState.armySize = gameState.slimes.length;
                saveStateToLocal();

                const remainingAlive = gameState.slimes.filter(s => s.hp > 0);

                playSlimeDeathAnimation(unit, slime, () => {
                    const remainingAlive = gameState.slimes ? gameState.slimes.filter(s => s.hp > 0) : [];
                    if (remainingAlive.length === 0) {
                        const remainingDying = document.querySelectorAll('.slime-unit[data-is-dying="true"]');
                        if (remainingDying.length === 0) {
                            if (sourceEnemy?.typeId === 'death') enterNewGamePlus();
                            else rewindWaveState();
                        }
                    }
                });

                // Instantly refresh roster sidebar so dead slime slot displays 💀 RIP icon immediately
                updateUI();
            }
        } else if (slime.hp <= 0) {
            gameState.slimes = gameState.slimes.filter(s => s.id !== slime.id);
            gameState.armySize = gameState.slimes.length;
            saveStateToLocal();
            updateUI();

            const remainingAlive = gameState.slimes.filter(s => s.hp > 0);
            if (remainingAlive.length === 0) {
                if (sourceEnemy?.typeId === 'death') enterNewGamePlus();
                else rewindWaveState();
            }
        }
    }

    // Pop floating pixel art damage number over hit slime
    showFloatingDamageNumber(slimeX + (Math.random() * 16 - 8), slimeY - 14, damageAmount, dmgType);
    return slime;
}

/**
 * Play 3-Stage Slime Hero Death Animation (using die.png spritesheet):
 * 1. Frame 1 (0px) (1.0s): Vibrates and immobilizes slime where it stands
 * 2. Frame 2 (-19px) (1.0s): Completely still/frozen in place
 * 3. Frame 3 (-38px): Ascends slowly towards the sky until out of bounds
 */
export function playSlimeDeathAnimation(unit, slime, onDeathComplete = null) {
    if (!unit) {
        if (onDeathComplete) onDeathComplete();
        return;
    }

    const typeId = slime ? (slime.type || unit.dataset.slimeType || 'base') : (unit.dataset.slimeType || 'base');
    const slimeConfig = SLIME_TYPES[typeId] || SLIME_TYPES.base;
    const folder = slimeConfig.folder || `images/slimes/${typeId}`;
    const imgEl = unit.querySelector('.slime-img');
    const shadowEl = unit.querySelector('.slime-shadow-sm');

    // Immobilize unit where it stands & mark as dying to prevent renderSlimeArmy DOM cleanup
    unit.dataset.isDying = 'true';
    unit.dataset.isAttacking = 'true';
    unit.dataset.isEating = 'true';
    unit.style.zIndex = '450';

    if (imgEl) {
        imgEl.style.transform = 'none';
        imgEl.style.transition = 'none';
        imgEl.style.animation = 'none';
        imgEl.classList.remove('hit-flash-red');
    }

    if (shadowEl) {
        shadowEl.style.transform = 'none';
        shadowEl.style.transition = 'none';
        shadowEl.style.opacity = '0.3';
    }

    // --- PHASE 1 (1.0s): die.png Frame 1 (0px) + Vibration ---
    if (imgEl) {
        imgEl.src = `${folder}/die.png`;
        imgEl.style.objectPosition = '0px 0px';
    }
    unit.classList.add('slime-dying-vibrate');

    // --- PHASE 2 (1.0s): die.png Frame 2 (-19px) + Frozen in place ---
    setTimeout(() => {
        unit.classList.remove('slime-dying-vibrate');
        if (imgEl) {
            imgEl.src = `${folder}/die.png`;
            imgEl.style.objectPosition = '-19px 0px';
        }

        // --- PHASE 3: die.png Frame 3 (-38px) + Ascend to the Sky ---
        setTimeout(() => {
            if (imgEl) {
                imgEl.src = `${folder}/die.png`;
                imgEl.style.objectPosition = '-38px 0px';
            }
            if (shadowEl) {
                shadowEl.style.transition = 'opacity 1.5s ease-out';
                shadowEl.style.opacity = '0';
            }

            unit.classList.add('slime-dying-ascend');

            // Remove unit once out of bounds in the sky (~2.8s) & trigger onDeathComplete
            setTimeout(() => {
                unit.remove();
                if (onDeathComplete) {
                    onDeathComplete();
                }
            }, 2800);
        }, 1000);
    }, 1000);
}

let isRewinding = false;
let isNewGamePlusTransition = false;

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
    if (countdownTimerId) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
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

    // Clear all leftover ground loots from DOM & memory state
    activeGroundLoots.forEach(l => {
        if (l.el) l.el.remove();
    });
    activeGroundLoots = [];

    const overlay = document.querySelector('.battlefield-overlay');
    if (overlay) {
        const leftoverLoots = overlay.querySelectorAll('.ground-loot-item');
        leftoverLoots.forEach(el => el.remove());
    }

    // 2. Play cartoon KO animation for 850ms, then trigger Slime Rain Sky-Drop!
    setTimeout(() => {
        const tierStartWave = Math.floor((gameState.currentWave - 1) / 10) * 10 + 1;
        gameState.currentWave = Math.max(1, tierStartWave);
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

/**
 * Spawn a temporary melee slash effect image in front of the attacking enemy
 */
export function spawnSlashEffect(enemy) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const projName = enemy.projectile;
    if (!projName || projName === 'none') return; // No projectile attribute means no attack visual.

    const imgPath = `images/projectiles/${projName}.png`;

    const slashEl = document.createElement('div');
    slashEl.className = 'slash-melee-effect';

    // Position centering: 32x32 spritesheet frame centered vertically on the enemy
    // and positioned in front (to the left) of the enemy
    const enemyHeight = (enemy.el ? enemy.el.offsetHeight : 28) || 28;
    const slashLeft = enemy.x - 24;
    const slashTop = enemy.y + (enemyHeight / 2) - 16;

    slashEl.style.position = 'absolute';
    slashEl.style.left = `${slashLeft}px`;
    slashEl.style.top = `${slashTop}px`;
    slashEl.style.width = '32px';
    slashEl.style.height = '32px';
    slashEl.style.backgroundImage = `url('${imgPath}')`;
    slashEl.style.backgroundRepeat = 'no-repeat';
    slashEl.style.backgroundSize = '160px 64px';
    slashEl.style.pointerEvents = 'none';
    slashEl.style.zIndex = '150';
    slashEl.style.imageRendering = 'pixelated';

    // Set initial frame (Frame 0)
    slashEl.style.backgroundPosition = '0px 0px';
    overlay.appendChild(slashEl);

    // Play 10 frames of 32x32 spritesheet (5 per row, 2 rows total) every 0.05 seconds
    let frame = 0;
    const frameInterval = setInterval(() => {
        frame++;
        if (frame >= 10) {
            clearInterval(frameInterval);
            slashEl.remove();
        } else {
            const col = frame % 5;
            const row = Math.floor(frame / 5);
            slashEl.style.backgroundPosition = `${-col * 32}px ${-row * 32}px`;
        }
    }, 50);
}













