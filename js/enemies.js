/**
 * Enemy Management & AI Behaviors
 */

import { gameState, addScraps, saveStateToLocal, saveWaveSnapshot, restoreBestRoster, SLIME_TYPES, getSlimeTotalRegen, getSlimeSpecialization, setEquipmentDefinitionResolver, getSlimeSubTalentDef, getSlimeMaxHp, getSlimeHitEffects, getSlimeJumpSprite, hasSpicyBlock, getSpicyBlockParams, getBlockChanceBonus, getCounterParams, getPolishedSlimeParams, getIceBlockParams, getInterceptionParams, hasIceBlock, hasCounter, hasPolishedSlime, findInterceptorFor, processWaveEndResurrections } from './state.js';
import { healAllSlimes, initAscendedAutoAttacks, clearAscendedAutoAttacks, showFloatingDamageNumber, showFloatingHealingNumber, showFloatingHealingNumberFromUnit, showFloatingStatusTextAt, showBattlefieldWaveBanner, triggerSlimeEatLoot, applyHitEffectsToEnemy, playResurrectionAnimations } from './slimes.js';
import { updateUI, updateLootHUD, requestUIRefresh, playSlimeRainRespawnAnimation } from './ui.js';
import { openShopModal } from './shop.js';
import { isGamePaused, setGamePaused } from './engine.js';
import { notifyAchievementEvent, checkAchievements, grantAchievement } from './achievements.js';
import { playMainMusic, playVillageMusic, playKillSound, playDieSound } from './audio.js';
import { recordRunWipe, resetRunWipeTracking } from './state.js';
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
    // Tier 0 - Bonus
    car: {
        id: 'car',
        type: 'rush',
        projectile: 'none',
        tier: 0,
        controlImmune: true,
        hp: 1000,
        maxHp: 2000,
        damage: 50,
        attackSpeed: 0.1,
        moveSpeed: 12,
        targetX: 100,
        loot_name: 'Shiny Horse Badge',
        loot_effect: [{ stat: 'damage', value: 10 },
        { stat: 'stun', value: 1 }],
        loot_priority: 'fighter'
    },
    missingno: {
        id: 'missingno',
        type: 'melee',
        projectile: 'none',
        tier: 0,
        controlImmune: true,
        hp: 50000,
        maxHp: 50000,
        damage: 1000,
        attackSpeed: 2,
        moveSpeed: 1,
        targetX: 200,
        loot_name: 'Broken Pixels',
        loot_effect: { stat: 'hp', value: 404 },
        loot_priority: 'tank'
    },
    military: {
        id: 'military',
        type: 'range',
        projectile: 'bullet',
        tier: 0,
        controlImmune: false,
        hp: 1000,
        maxHp: 1000,
        damage: 1,
        attackSpeed: 4,
        moveSpeed: 3,
        targetX: 300,
        loot_name: 'AR-15 223R',
        loot_effect: [{ stat: 'damage', value: 10 },
        { stat: 'crit', value: 5 }],
        loot_priority: 'fighter'
    },
    char: {
        id: 'char',
        type: 'range',
        projectile: 'obus',
        tier: 0,
        controlImmune: true,
        hp: 10000,
        maxHp: 10000,
        damage: 1000,
        attackSpeed: 0.3,
        moveSpeed: 1,
        targetX: 300,
        loot_name: 'Obus',
        loot_effect: [{ stat: 'hp', value: 20 },
        { stat: 'damage', value: 5 }],
        loot_priority: 'tank'
    },



    // Tier 0 - Bosses ------------------------
    mage: {
        id: 'mage',
        type: 'range',
        projectile: 'fireball',
        tier: 0,
        hp: 250,
        maxHp: 250,
        controlImmune: true,
        damage: 5,            // Damage per projectile
        attackSpeed: 1,     // attacks per second
        moveSpeed: 2,
        targetX: 380,         // 400=right border, 100 = Slime army
        loot_name: 'Staff of Frostfire',
        loot_effect: [{ stat: 'freeze', value: 1 },
        { stat: 'burn', value: 1 }],
        loot_priority: 'fighter'
    },
    berserker: {
        id: 'berserker',
        type: 'melee',
        projectile: 'slash1',
        tier: 0,
        hp: 4000,
        maxHp: 4000,
        controlImmune: true,
        damage: 15,            // Damages
        attackSpeed: 1,     // attacks per second
        moveSpeed: 3,
        targetX: 190,         // 400=right border, 100 = Slime army
        loot_name: 'Berserker Greataxe',
        loot_effect: [{ stat: 'damage', value: 5 },
        { stat: 'hp', value: 5 }],
        loot_priority: 'tank'
    },
    alchemist: {
        id: 'alchemist',
        type: 'range',
        projectile: 'flask',
        tier: 0,
        hp: 3000,
        maxHp: 3000,
        damage: 1,
        attackSpeed: 0.6,
        moveSpeed: 1.5,
        targetX: 300,
        loot_name: 'Alchemical Flask',
        loot_effect: { stat: 'poison', value: 5 },
        loot_priority: 'fighter'
    },
    catapult: {
        id: 'catapult',
        type: 'range',
        projectile: 'boulder',
        controlImmune: true,
        tier: 0,
        hp: 15000,
        maxHp: 15000,
        damage: 15,
        attackSpeed: 0.5,
        moveSpeed: 0.6,
        targetX: 400,
        loot_name: 'Catapult Boulder',
        loot_effect: [{ stat: 'stun', value: 2 },
        { stat: 'hp', value: 5 }],
        loot_priority: 'tank'
    },
    stonegolem: {
        id: 'stonegolem',
        type: 'melee',
        projectile: 'slash1',
        tier: 0,
        hp: 25000,
        maxHp: 25000,
        damage: 15,            // Damages
        attackSpeed: 1,        // attacks per second
        moveSpeed: 1,
        targetX: 170,         // 400=right border, 100 = Slime army
        loot_name: 'Stone Golem Head',
        loot_effect: [{ stat: 'regen', value: 3 },
        { stat: 'stun', value: 1 }],
        loot_priority: 'support'
    },
    lich: {
        id: 'lich',
        type: 'support',
        projectile: 'heal1',
        tier: 0,
        hp: 10000,
        maxHp: 10000,
        damage: 100,
        attackSpeed: 2,
        moveSpeed: 1,
        targetX: 380,
        loot_name: 'Lich Mask',
        loot_effect: [{ stat: 'burn', value: 2 },
        { stat: 'poison', value: 2 },
        { stat: 'freeze', value: 2 }],
        loot_priority: 'fighter'
    },

    // Tier1 - Villagers ------------------------
    beggar: {
        id: 'beggar',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 3,                // 2 HP (requires 2 hits from base slime)
        maxHp: 3,
        damage: 1,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Beggar Cup',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank'
    },
    farmer: {
        id: 'farmer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 4,                // 2 HP (requires 2 hits from base slime)
        maxHp: 4,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Farmer Hat',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank'
    },
    torchfarmer: {
        id: 'torchfarmer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 5,                // 2 HP (requires 2 hits from base slime)
        maxHp: 5,
        damage: 3,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.2,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Burning Torch',
        loot_effect: [
            { stat: 'burn', value: 1 },
            { stat: 'damage', value: 1 }
        ],
        loot_priority: 'fighter'
    },
    fisher: {
        id: 'fisher',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 6,                // 2 HP (requires 2 hits from base slime)
        maxHp: 6,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 1.3,       // Move speed (1 to 100) -> 25 px/sec
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Smelly Fish',
        loot_effect: { stat: 'hp', value: 2 },
        loot_priority: 'tank'
    },
    thief: {
        id: 'thief',
        type: 'rush',        // Melee attacker
        projectile: 'slash1',
        tier: 1,
        hp: 5,                // 2 HP (requires 2 hits from base slime)
        maxHp: 5,
        damage: 2,            // 1 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 12,         // Move speed (1 to 100) -> 25 px/sec
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Thief Mask',
        loot_effect: { stat: 'crit', value: 10 },
        loot_priority: 'fighter'
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
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Guard Shield',
        loot_effect: { stat: 'hp', value: 2 },
        loot_priority: 'tank'
    },
    hunter: {
        id: 'hunter',
        type: 'range',       // Ranged attacker
        projectile: 'arrow',  // Arrow projectile type
        tier: 2,
        hp: 30,
        maxHp: 30,
        damage: 2,            // 2 Damage per projectile
        attackSpeed: 1.2,     // 0.8 attacks per second
        moveSpeed: 1.4,
        targetX: 380,         // Right boundary
        loot_name: 'Hunting Bow',
        loot_effect: { stat: 'crit', value: 5 },
        loot_priority: 'fighter'
    },
    adventurer: {
        id: 'adventurer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 40,                // 4 HP
        maxHp: 40,
        damage: 2,            // 3 Damage per attack
        attackSpeed: 1.0,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Backpack',
        loot_effect: { stat: 'regen', value: 2 },
        loot_priority: 'support'
    },
    assassin: {
        id: 'assassin',
        type: 'rush',        // Melee attacker
        projectile: '',
        tier: 2,
        hp: 30,                // 4 HP
        maxHp: 30,
        damage: 2,            // 3 Damage per attack
        attackSpeed: 1.5,     // 1 attack per second
        moveSpeed: 12,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Poison Dagger',
        loot_effect: { stat: 'poison', value: 1 },
        loot_priority: 'fighter'
    },
    lancer: {
        id: 'lancer',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 40,                // 4 HP
        maxHp: 40,
        damage: 1,            // 3 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 2.5,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Lance Tip',
        loot_effect: [{ stat: 'crit', value: 2 },
        { stat: 'damage', value: 1 }],
        loot_priority: 'fighter',
    },
    lumberjack: {
        id: 'lumberjack',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 2,
        hp: 50,                // 4 HP
        maxHp: 50,
        damage: 10,            // 3 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 2,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Woodcutter Axe',
        loot_effect: [{ stat: 'hp', value: 1 },
        { stat: 'damage', value: 2 }],
        loot_priority: 'fighter'
    },


    // Tier 3 - Army ~50 PV
    soldier: {
        id: 'soldier',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 120,                // 5 HP
        maxHp: 120,
        damage: 4,
        attackSpeed: 1.5,     // attack per second
        moveSpeed: 3,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Swag Helmet',
        loot_effect: [{ stat: 'hp', value: 3 },
        { stat: 'crit', value: 2 }],
        loot_priority: 'tank'
    },
    soldier2h: {
        id: 'soldier2h',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 100,                // 5 HP
        maxHp: 100,
        damage: 5,            // 4 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 3.5,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Greatsword',
        loot_effect: [{ stat: 'crit', value: 5 },
        { stat: 'damage', value: 2 }],
        loot_priority: 'fighter'
    },
    archer: {
        id: 'archer',
        type: 'range',       // Ranged attacker
        projectile: 'arrow',  // Arrow projectile type
        tier: 3,
        hp: 60,
        maxHp: 60,
        damage: 5,            // 2 Damage per projectile
        attackSpeed: 1.5,     // 0.8 attacks per second
        moveSpeed: 2,
        targetX: 410,         // Right boundary
        loot_name: 'Long Bow',
        loot_effect: { stat: 'crit', value: 5 },
        loot_priority: 'fighter',
    },
    tank: {
        id: 'tank',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 600,
        maxHp: 600,
        damage: 0,
        attackSpeed: 0,     // Attacks per second
        moveSpeed: 5,
        targetX: 250,         // Center of battlefield
        loot_name: 'Knight Shield',
        loot_effect: { stat: 'hp', value: 3 },
        loot_priority: 'tank',
    },
    halberdier: {
        id: 'halberdier',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: 3,
        hp: 110,                // 5 HP
        maxHp: 110,
        damage: 10,            // 4 Damage per attack
        attackSpeed: 1,     // 1 attack per second
        moveSpeed: 4,       // Move speed
        targetX: 190,         // Close melee range near the slimes
        loot_name: 'Halberd',
        loot_effect: [{ stat: 'crit', value: 10 },
        { stat: 'damage', value: 1 }],
        loot_priority: 'fighter',
    },


    // Tier 4 - Forest Enemies ---------------------
    redfairy: {
        id: 'redfairy',
        type: 'range',
        projectile: 'fireball',
        tier: 4,
        hp: 200,
        maxHp: 200,
        damage: 5,
        attackSpeed: 1.2,
        moveSpeed: 4,
        targetX: 370,
        loot_name: 'Red Fairy Core',
        loot_effect: { stat: 'burn', value: 3 },
        loot_priority: 'fighter',
    },
    elf: {
        id: 'elf',
        type: 'range',
        projectile: 'arrow',
        tier: 4,
        hp: 250,
        maxHp: 250,
        damage: 10,
        attackSpeed: 1.2,
        moveSpeed: 2,
        targetX: 400,
        loot_name: 'Elf Bandana',
        loot_effect: [{ stat: 'crit', value: 2 },
        { stat: 'damage', value: 1 },
        { stat: 'hp', value: 2 }],
        loot_priority: 'fighter',
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
        targetX: 190,
        loot_name: 'Wolf Tail',
        loot_effect: { stat: 'crit', value: 3 },
        loot_priority: 'fighter',
    },
    bear: {
        id: 'bear',
        type: 'melee',
        projectile: 'slash1',
        tier: 4,
        hp: 1800,
        maxHp: 1800,
        damage: 18,
        attackSpeed: 0.65,
        moveSpeed: 1.5,
        targetX: 190,
        loot_name: 'Bear Paw',
        loot_effect: [{ stat: 'hp', value: 1 },
        { stat: 'damage', value: 2 }],
        loot_priority: 'fighter',
    },
    ent: {
        id: 'ent',
        type: 'tank',
        projectile: 'none',
        tier: 4,
        hp: 2000,
        maxHp: 2000,
        damage: 0,
        attackSpeed: 0,
        moveSpeed: 6,
        targetX: 260,
        loot_name: 'Ent Branch',
        loot_effect: [{ stat: 'hp', value: 5 },
        { stat: 'damage', value: 1 }],
        loot_priority: 'tank',
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
        loot_effect: { stat: 'regen', value: 2 },
        loot_priority: 'support',
    },
    fairy: {
        id: 'fairy',
        // Support enemies heal allies instead of firing at the slime army.
        type: 'support',
        projectile: 'heal1',
        tier: 4,
        hp: 250,
        maxHp: 250,
        damage: 25,
        attackSpeed: 1.15,
        moveSpeed: 2,
        targetX: 370,
        loot_name: 'Fairy Core',
        loot_effect: [{ stat: 'regen', value: 2 }, { stat: 'hp', value: 3 }],
        loot_priority: 'support',
    },
    // Tier 5 - Undead Enemies ---------------------
    zombi: {
        id: 'zombi',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 3500,
        maxHp: 3500,
        damage: 16,
        attackSpeed: 0.8,
        moveSpeed: 1.2,
        targetX: 190,
        loot_name: 'Zombie Rags',
        loot_effect: { stat: 'hp', value: 2 },
        loot_priority: 'tank',
    },
    halfzombi: {
        id: 'halfzombi', type: 'melee', projectile: 'slash1', tier: 5,
        hp: 4000,
        maxHp: 4000,
        damage: 14,
        attackSpeed: 0.55,
        moveSpeed: 0.65,
        targetX: 190,
        loot_name: 'Talking Head',
        loot_effect: [{ stat: 'regen', value: 4 }, { stat: 'damage', value: 1 }],
        loot_priority: 'support',
    },
    bigzombi: {
        id: 'bigzombi',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 5500,
        maxHp: 5500,
        damage: 35,
        attackSpeed: 0.85,
        moveSpeed: 3,
        targetX: 190,
        loot_name: 'Ripped Shorts',
        loot_effect: [{ stat: 'hp', value: 10 }, { stat: 'damage', value: 2 }],
        loot_priority: 'tank'
    },
    skeleton: {
        id: 'skeleton',
        type: 'melee',
        projectile: 'slash1',
        tier: 5,
        hp: 350,
        maxHp: 350,
        damage: 12,
        attackSpeed: 1.3,
        moveSpeed: 9,
        targetX: 190,
        loot_name: 'Sword (Arm Included)',
        loot_effect: { stat: 'damage', value: 5 },
        loot_priority: 'fighter',
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
        loot_effect: [{ stat: 'crit', value: 3 }, { stat: 'damage', value: 1 }],
        loot_priority: 'fighter',
    },
    // Tier -1, Tests & Secrets ------------------------------------
    death: {
        id: 'death',
        type: 'melee',
        projectile: '',
        tier: -1,
        controlImmune: true,
        hp: 9999999999,
        maxHp: 9999999999,
        damage: 999,            // Damage per projectile
        attackSpeed: 60,     // attacks per second
        moveSpeed: 1,
        targetX: 150,         // 400=right border, 100 = Slime army
        loot_name: 'You Should Not See This',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank',
    },
    testmelee: {
        id: 'beggar',
        type: 'melee',        // Melee attacker
        projectile: 'slash1',
        tier: -1,
        hp: 9999999999,
        maxHp: 9999999999,
        damage: 10,
        attackSpeed: 0.5,     // 0.5 attacks per second
        moveSpeed: 5,       // Slow move speed
        targetX: 200,         // Center of battlefield
        loot_name: 'You Should Not See This',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank',
    },
    testtank: {
        id: 'beggar',
        type: 'tank',        // Melee attacker
        projectile: 'slash1',
        tier: -1,
        hp: 9999999999,
        maxHp: 9999999999,
        damage: 0,
        attackSpeed: 1,     // 0.5 attacks per second
        moveSpeed: 5,       // Slow move speed
        targetX: 300,         // Center of battlefield
        loot_name: 'You Should Not See This',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank',
    },
    testrange: {
        id: 'beggar',
        type: 'range',
        projectile: 'arrow',
        tier: -1,
        hp: 9999999999,
        maxHp: 9999999999,
        damage: 0,
        attackSpeed: 0.5,   // Attacks per second
        moveSpeed: 5,
        targetX: 400,       // 250 = Center of battlefield, 100 = Slimes, 400 = long range
        loot_name: 'You Should Not See This',
        loot_effect: { stat: 'hp', value: 1 },
        loot_priority: 'tank',
    },
};

setEquipmentDefinitionResolver((id) => ENEMY_TYPES[id] || null);

export const PROJECTILE_TYPES = {
    arrow: {
        id: 'arrow',
        sprite: 'images/projectiles/arrow.png',
        fallbackIcon: '??',
        size: 5, // Real sprite height (16x5)
        arcHeight: 25, // Curved arc height in px
        duration: 0.5, // Parabolic flight time in seconds
        rotationMode: 'tangent' // Follows smooth flight curve angle
    },
    fireball: {
        id: 'fireball',
        sprite: 'images/projectiles/fireball.png',
        fallbackIcon: '??',
        size: 12, // Real sprite height (27x12)
        arcHeight: 30, // Smooth arc height in px
        duration: 0.5, // Fast & snappy flight time matching arrows
        rotationMode: 'tangent' // Follows smooth flight curve angle
    },
    flask: {
        id: 'flask',
        sprite: 'images/projectiles/flask.png',
        fallbackIcon: '??',
        size: 17, // Real sprite height (12x17)
        arcHeight: 35, // Curved high arc height in px
        duration: 1.0, // 50% slower flight speed (1.0s vs 0.5s)
        rotationMode: 'spin' // Rotates on itself continuously during flight
    },
    heal1: {
        id: 'heal1',
        sprite: 'images/projectiles/heal1.png',
        fallbackIcon: '*',
        size: 50, // Real sprite height (600x50)
        arcHeight: 20,
        duration: 0.55,
        rotationMode: 'tangent'
    }, boulder: {
        id: 'boulder',
        sprite: 'images/projectiles/boulder.png',
        fallbackIcon: '??',
        size: 13, // Real sprite height (17x13)
        arcHeight: 35, // Curved high arc height in px
        duration: 1.0, // 50% slower flight speed like flask
        rotationMode: 'spin' // Rotates on itself continuously during flight
    },
    obus: {
        id: 'obus',
        sprite: 'images/projectiles/obus.png',
        fallbackIcon: '??',
        size: 5, // Real sprite height (12x5)
        arcHeight: 0, // Straight line, no arc
        straight: true, // Travel in a perfect straight line (no parabola)
        duration: 0.15, // Very fast travel
        rotationMode: 'straight' // Points along the straight flight vector
    },
    bullet: {
        id: 'bullet',
        sprite: 'images/projectiles/bullet.png',
        fallbackIcon: '??',
        size: 2, // Real sprite height (3x2)
        arcHeight: 0, // Straight line, no arc
        straight: true, // Travel in a perfect straight line (no parabola)
        duration: 0.15, // Very fast travel
        rotationMode: 'straight' // Points along the straight flight vector
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

/**
 * Briefly flash the inverted background while transitioning into a special
 * wave (bonus/death style), then run the provided callback.
 */
export function triggerInvertedTransition(callback) {
    const battlefield = document.querySelector('.battlefield-card');
    if (battlefield) battlefield.style.backgroundImage = "url('images/backgrounds/inverted.jpg')";
    setTimeout(() => {
        if (battlefield) battlefield.style.backgroundImage = '';
        if (typeof callback === 'function') callback();
    }, 250);
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
let waveSpawnTimers = [];
let nextWaveCountdownSec = 0;
// Tracks whether the current Boss wave (every 10th wave) has been cleared without
// any Slime dealing damage to an enemy (used by the "Self Defense" achievement).
let bossWaveNoAttack = false;

/**
 * Disarm the "no attack" Boss-wave flag. Called from the Slime attack pipeline
 * the instant a Slime deals damage to an enemy, so "Self Defense" only unlocks
 * when an entire Boss wave is cleared without a single Slime attack.
 */
export function markSlimeAttacked() {
    bossWaveNoAttack = false;
}

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
    //return [0.15, 'testtank:1', 'testmelee:1', 'testrange:1'];

    // 1-10, Manual play, Villagers
    if (waveNum === 1) return [0, 'beggar:1'];
    if (waveNum === 2) return [0.5, 'beggar:2', 'farmer'];
    if (waveNum === 3) return [0.5, 'farmer:3', 'fisher:2'];
    if (waveNum === 5) return [0.2, 'beggar:5', 'torchfarmer:1', 'farmer:1', 'fisher:1'];
    if (waveNum === 4) return [0.1, 'thief:2', 'guard:1'];
    if (waveNum === 6) return [0.2, 'fisher:10', 'torchfarmer:5'];
    if (waveNum === 7) return [0.4, 'farmer:15', 'torchfarmer:2'];
    if (waveNum === 8) return [0.8, 'beggar:8', 'farmer:2', 'torchfarmer:2', 'fisher:2'];
    if (waveNum === 9) return [0.8, 'torchfarmer3:9', 'farmer:3', 'beggar:2', 'fisher:3'];
    if (waveNum === 10) return [0, 'mage:1'];

    // 11-20 Autoplay, Adventurers
    if (waveNum === 11) return [0.1, 'adventurer:2', 'hunter:3'];
    if (waveNum === 12) return [0.1, 'adventurer:2', 'assassin:2', 'hunter:3'];
    if (waveNum === 13) return [0.1, 'assassin:3', 'lumberjack:2', 'hunter:3'];
    if (waveNum === 14) return [0.1, 'lumberjack:5', 'lancer:3', 'hunter:3'];
    if (waveNum === 15) return [0.1, 'lancer:3', 'guard:5', 'mage:1'];
    if (waveNum === 16) return [0.1, 'guard:10', 'hunter:6'];
    if (waveNum === 17) return [0.1, 'guard:6', 'lancer:5', 'adventurer:4', 'hunter:2'];
    if (waveNum === 18) return [0.1, 'guard:7', 'hunter:15'];
    if (waveNum === 19) return [0.1, 'assassin:4', 'guard:5', 'hunter:15'];
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
    if (waveNum === 30) return [0, 'catapult:1', 'tank:6', 'berserker:1', 'archer:4'];

    // 31-40 Forest Enemies: deliberately light introductory compositions.
    if (waveNum === 31) return [0.1, 'wolf:5'];
    if (waveNum === 32) return [0.1, 'wolf:5', 'bear:2'];
    if (waveNum === 33) return [0.2, 'ent:2', 'elf:4', 'rabbit:2'];
    if (waveNum === 34) return [0.1, 'wolf:10', 'rabbit:2'];
    if (waveNum === 35) return [0.1, 'ent:3', 'alchemist:2', 'fairy:2'];
    if (waveNum === 36) return [0.1, 'berserker:1', 'elf:5', 'fairy:2'];
    if (waveNum === 37) return [0.1, 'ent:2', 'redfairy:2', 'fairy:2'];
    if (waveNum === 38) return [0.1, 'bear:2', 'berserker:1', 'fairy:5'];
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
    if (waveNum === 50) return [0.4, 'lich:1', 'skeleton:25', 'skeletonarcher:5'];

    // Wave 900+ = Bonus Waves
    if (waveNum === 901) return [0, 'car:1'];
    if (waveNum === 902) return [0, 'missingno:1'];
    if (waveNum === 903) return [1, 'char:1', 'military:20'];

    // Death
    else {
        triggerPostWave50BackgroundTransition();
        return [0, 'death:1'];
    }
}

/**
 * Bonus waves are special waves (wave numbers >= 900) that can be entered
 * after clearing a boss wave (10/20/30/40/50) instead of going straight to
 * the next normal wave. More bonus waves can be appended here later.
 */
/**
 * Overall flat chance (0-1) that a cleared boss wave diverts into a bonus
 * stage. Independent of which bonus stage is then chosen.
 */
const BONUS_STAGE_CHANCE = 0.06; // 10% flat chance for any bonus stage

/**
 * Bonus stages and their relative apparition weight when a bonus stage is
 * triggered. Weights are normalized against each other, not against 1.0.
 */
const BONUS_WAVES = [
    { wave: 901, chance: 0.40 }, // Car wave: 40%
    { wave: 902, chance: 0.20 }, // Missingno wave: 20%
    { wave: 903, chance: 0.40 }   // Battleground wave: 40%
];

/**
 * Decide which wave follows a cleared boss wave, in two steps:
 *   1. Flat roll for whether ANY bonus stage occurs (BONUS_STAGE_CHANCE).
 *   2. If so, pick which bonus stage using each wave's relative weight.
 * Otherwise returns the normal next wave number.
 */
export function decideNextWaveAfterBoss(clearedWaveNum) {
    const normalNext = (clearedWaveNum || 0) + 1;
    if (!(clearedWaveNum > 0 && clearedWaveNum % 10 === 0)) return normalNext;
    // Bonus waves only appear once the player has entered New Game+ (any completed run).
    if (!(gameState.newGamePlusCompletions > 0)) return normalNext;

    if (Math.random() >= BONUS_STAGE_CHANCE) return normalNext;

    const totalWeight = BONUS_WAVES.reduce((sum, b) => sum + Math.max(0, b.chance), 0);
    if (totalWeight <= 0) return normalNext;

    let roll = Math.random() * totalWeight;
    for (const bonus of BONUS_WAVES) {
        roll -= Math.max(0, bonus.chance);
        if (roll < 0) return bonus.wave;
    }
    return normalNext;
}

/** Backgrounds used by special wave types. */
function getWaveBackground(waveNum) {
    if (waveNum === 901) return "url('images/backgrounds/road.jpg')";
    if (waveNum === 902) return "url('images/backgrounds/missingno.jpg')";
    if (waveNum === 903) return "url('images/backgrounds/battleground.png')";
    return '';
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
    // Cancel any pending per-enemy spawn timers from a previous wave.
    waveSpawnTimers.forEach(id => clearTimeout(id));
    waveSpawnTimers = [];

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

    // A Boss wave (every 10th) starts with the "no attack" flag armed for the
    // "Self Defense" achievement; it is disarmed the moment a Slime damages an enemy.
    bossWaveNoAttack = (gameState.currentWave > 0 && gameState.currentWave % 10 === 0);

    // Apply wave-specific battlefield background (bonus waves use special art).
    const battlefield = document.querySelector('.battlefield-card');
    if (battlefield) battlefield.style.backgroundImage = getWaveBackground(gameState.currentWave);

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
            const timerId = setTimeout(() => {
                spawnEnemy(enemyType, currentWaveHpMultiplier);
            }, idx * intervalMs);
            waveSpawnTimers.push(timerId);
        }
    });
}

/**
 * Full Reset action: Resets army to 1 base slime (no upgrades), scraps to 0, wave to 1, clears battlefield
 */
export function resetGameFull({ startWave = true, preserveUpgrades = false } = {}) {
    const newGamePlusCompletions = gameState.newGamePlusCompletions || 0;
    const savedUpgrades = {
        slimeDamage: gameState.slimeDamage,
        slimeRegen: gameState.slimeRegen,
        precisionLevel: gameState.precisionLevel,
        digestionLevel: gameState.digestionLevel,
        incubationLevel: gameState.incubationLevel,
        autoEatLevel: gameState.autoEatLevel,
        fortificationLevel: gameState.fortificationLevel,
        afkScrapCeilingLevel: gameState.afkScrapCeilingLevel,
        afkScrapLevel: gameState.afkScrapLevel,
        afkScrapCeilingPurchased: gameState.afkScrapCeilingPurchased,
        afkScrapPurchased: gameState.afkScrapPurchased,
        ignitionLevel: gameState.ignitionLevel,
        glaciationLevel: gameState.glaciationLevel,
        petrificationLevel: gameState.petrificationLevel,
        intoxicationLevel: gameState.intoxicationLevel,
        unlockedUpgrades: gameState.unlockedUpgrades,
        // Preserve the player's scrap & score economy when returning to the
        // village (New Game Plus intermission) so progress isn't wiped.
        scraps: gameState.scraps,
        score: gameState.score
    };
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
    // Cancel pending per-enemy spawn timers so no stray enemies appear later.
    waveSpawnTimers.forEach(id => clearTimeout(id));
    waveSpawnTimers = [];
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
    gameState.hasSlimeDied = false;
    gameState.hasUsedDivision = false;
    gameState.afkLastAwayAt = Date.now();
    if (preserveUpgrades) {
        Object.assign(gameState, {
            slimeDamage: savedUpgrades.slimeDamage,
            slimeRegen: savedUpgrades.slimeRegen,
            precisionLevel: savedUpgrades.precisionLevel,
            digestionLevel: savedUpgrades.digestionLevel,
            incubationLevel: savedUpgrades.incubationLevel,
            autoEatLevel: savedUpgrades.autoEatLevel,
            fortificationLevel: savedUpgrades.fortificationLevel,
            afkScrapCeilingLevel: savedUpgrades.afkScrapCeilingLevel,
            afkScrapLevel: savedUpgrades.afkScrapLevel,
            afkScrapCeilingPurchased: savedUpgrades.afkScrapCeilingPurchased,
            afkScrapPurchased: savedUpgrades.afkScrapPurchased,
            ignitionLevel: savedUpgrades.ignitionLevel,
            glaciationLevel: savedUpgrades.glaciationLevel,
            petrificationLevel: savedUpgrades.petrificationLevel,
            intoxicationLevel: savedUpgrades.intoxicationLevel,
            unlockedUpgrades: savedUpgrades.unlockedUpgrades,
            scraps: savedUpgrades.scraps,
            score: savedUpgrades.score
        });
    } else {
        gameState.slimeDamage = 1;
        gameState.slimeRegen = 0;
        gameState.precisionLevel = 0;
        gameState.digestionLevel = 0;
        gameState.incubationLevel = 0;
        gameState.autoEatLevel = 0;
        gameState.fortificationLevel = 0;
        gameState.afkScrapCeilingLevel = 0;
        gameState.afkScrapLevel = 0;
        gameState.afkScrapCeilingPurchased = false;
        gameState.afkScrapPurchased = false;
        gameState.ignitionLevel = 0;
        gameState.glaciationLevel = 0;
        gameState.petrificationLevel = 0;
        gameState.intoxicationLevel = 0;
        gameState.unlockedUpgrades = {
            division: false,
            ascension: false,
            augmentation: false,
            precision: false,
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
    }
    gameState.waveSnapshots = {};
    const initialName = 'Gooey';
    const permanentHp = 10 + (gameState.fortificationLevel || 0) + (gameState.alchemistEnduranceLevel || 0);
    const permanentCrit = (gameState.alchemistLuckLevel || 0) + (gameState.precisionLevel || 0);
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
    const villageCoinReward = completedRuns * 2;

    resetGameFull({ startWave: false, preserveUpgrades: true });
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
    // Evaluate run-finish achievements (roster composition, Iron Man, Paper Thin)
    // against the roster that completed the run, then reset per-run wipe tracking
    // for the next run.
    notifyAchievementEvent('runFinished', {
        roster: gameState.slimes,
        wipedTiers: (gameState.runWipedTiers || []).slice()
    });
    resetRunWipeTracking();
    saveStateToLocal();
    updateUI();
    playVillageMusic();
    isNewGamePlusTransition = false;
}

/**
 * Manually abandon the current run via the "Return to Village" battlefield button.
 * Kills the active army (clears the battlefield) and transitions to the village
 * intermission, exactly like a run ended by Death � without resetting to the
 * start of the tier.
 */
export function returnToVillage() {
    if (isNewGamePlusTransition || gameState.isInNewGamePlus) return;
    isNewGamePlusTransition = true;

    // Step 1: kill all slimes immediately and clear the active army.
    if (countdownTimerId) { clearInterval(countdownTimerId); countdownTimerId = null; }
    if (autoWaveTimeoutId) { clearTimeout(autoWaveTimeoutId); autoWaveTimeoutId = null; }
    // Cancel pending per-enemy spawn timers so no new enemies appear mid-transition.
    waveSpawnTimers.forEach(id => clearTimeout(id));
    waveSpawnTimers = [];
    isWaveActive = false;
    gameState.slimes = [];
    gameState.armySize = 0;
    const armyContainer = document.getElementById('armyContainer');
    if (armyContainer) armyContainer.innerHTML = '';

    // Step 2: after 1s, kill all enemies, then transition to the village.
    setTimeout(() => {
        activeEnemies.forEach(enemy => { if (enemy.el && enemy.el.remove) enemy.el.remove(); });
        activeEnemies.length = 0;

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
        resetGameFull({ startWave: false, preserveUpgrades: true });
        // Returning to the village via the button does NOT count as a completed
        // run (no NG+ increment, no village coin reward) � only a wipe to Death does.
        gameState.isInNewGamePlus = true;
        gameState.bestRoster = healedRoster.length > 0 ? healedRoster : gameState.bestRoster;
        gameState.slimes = gameState.bestRoster.map((slime, index) => ({
            ...JSON.parse(JSON.stringify(slime)),
            hp: slime.maxHp || 10,
            slotIndex: slime.slotIndex !== undefined ? slime.slotIndex : index
        }));
        gameState.armySize = gameState.slimes.length;

        clearAscendedAutoAttacks();
        const armyContainer2 = document.getElementById('armyContainer');
        if (armyContainer2) armyContainer2.innerHTML = '';
        applyNewGamePlusPresentation();
        // Returning to the village must fully clear any (manual) pause so the
        // battlefield card's grayscale "game-paused" state does not linger.
        setGamePaused(false, true);
        saveStateToLocal();
        updateUI();
        playVillageMusic();
        isNewGamePlusTransition = false;
    }, 1000);
}

/** Deploy the healed village roster and begin the next run. */
export function startNewGamePlusRun() {
    if (!gameState.isInNewGamePlus) return;
    gameState.isInNewGamePlus = false;
    applyNewGamePlusPresentation();
    saveStateToLocal();
    updateUI();
    playMainMusic();
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
                    // Regen only fills real HP up to maxHp; temporary HP is a separate pool.
                    s.hp = Math.min(s.maxHp, s.hp + regeneration);
                    updateSlimeHpBar(s);
                }
            });
        }

        // Support Resurrection: a Support above 80% HP sacrifices 80% to revive a
        // random dead Slime at half the sacrificed HP. Happens 4s after wave end
        // (after regen), before the roster advances to the next wave. The revived
        // Slime is pushed back into gameState.slimes, so updateUI() redeploys it
        // on the battlefield.
        setTimeout(() => {
            const { revived, resurrectors } = processWaveEndResurrections();
            updateUI();
            if (revived.length > 0) playResurrectionAnimations(resurrectors, revived);
        }, 2000);

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

        // "Self Defense": a Boss wave (every 10th) cleared while the "no attack" flag
        // is still armed means no Slime ever damaged an enemy this wave.
        if (clearedWaveNum > 0 && clearedWaveNum % 10 === 0 && bossWaveNoAttack) {
            grantAchievement('selfDefense');
        }

        // Clearing a boss wave (10/20/30/40/50) rewards 1 Village Coin.
        if (clearedWaveNum > 0 && clearedWaveNum % 10 === 0) {
            gameState.villageCoins = (gameState.villageCoins || 0) + 1;
        }

        // A cleared bonus wave returns to the normal progression wave that was
        // stashed when the bonus was entered (otherwise just advance by one).
        if (clearedWaveNum >= 900) {
            gameState.currentWave = gameState.bonusReturnWave || (clearedWaveNum + 1);
            gameState.bonusReturnWave = null;
        } else {
            gameState.currentWave += 1;
        }
        saveStateToLocal();
        updateUI();

        // Every 10th wave (10, 20, 30...) the Merchant arrives � unless No Merchant
        // Mode is active, in which case we skip the shop and go straight to the next wave.
        if (clearedWaveNum > 0 && clearedWaveNum % 10 === 0 && !gameState.noMerchant) {
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
            startNextWaveCountdown(gameState.isFastMode ? 5 : 10);
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
        updateLootHUD();
        requestUIRefresh();
    }
}

/**
 * Spawn an enemy instance of the given type with optional soft scaling HP multiplier
 */
export function spawnEnemy(typeId = 'beggar', hpMultiplier = 1.0) {
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.beggar;
    const enemyIdKey = def.id || typeId;
    const baseHp = def.hp || 2;
    // Each completed New Game+ run scales enemy stats multiplicatively (compounding):
    // HP +20%, Damage +10%. Move speed is left unchanged.
    const newGamePlusHpMultiplier = Math.pow(1.3, Math.max(0, gameState.newGamePlusCompletions || 0));
    const newGamePlusDmgMultiplier = Math.pow(1.2, Math.max(0, gameState.newGamePlusCompletions || 0));
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier * newGamePlusHpMultiplier));
    const scaledDamage = Math.max(0, Math.round((def.damage || 0) * newGamePlusDmgMultiplier));
    // Apply the Fast Mode multiplier to the base moveSpeed, then cap the
    // resulting effective moveSpeed at 15 so fast enemies never exceed it
    // (base moveSpeed is always under 15, so normal enemies are unaffected).
    const effectiveMoveSpeed = Math.min(15, (def.moveSpeed || 0) * (gameState.isFastMode ? 2 : 1));
    const scaledMoveSpeed = effectiveMoveSpeed * 25;

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
        el: null,
        spriteHeight: 28,
        flashUntil: 0,
        strikeUntil: 0
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
        enemy.spriteHeight = h;
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

    const now = performance.now();

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];

        if (enemy.hp <= 0) {
            playKillSound();
            triggerLootDrop(enemy);
            // Defeated enemy removal with cartoon jump plunge
            if (enemy.el && !enemy.el.classList.contains('cartoon-ko-eject') && !enemy.el.classList.contains('cartoon-ko-eject-left')) {
                const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
                enemy.el.classList.add(ejectClass);
                const elToRemove = enemy.el;
                setTimeout(() => { if (elToRemove) elToRemove.remove(); }, 800);
            }
            activeEnemies.splice(i, 1);
            notifyAchievementEvent('enemyDefeated', { enemyId: enemy.typeId, x: enemy.x });
            checkWaveCompletion();
            continue;
        }

        // Initialize status effects container
        if (!enemy.effects) {
            enemy.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, freezeTimer: 0, stunTimer: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0 };
        }

        // --- 1. Process Frost (Freeze) & Stone (Stun) Effects ---
        const isControlImmune = ENEMY_TYPES[enemy.typeId]?.controlImmune === true;
        if (isControlImmune) {
            enemy.effects.freezeTimer = 0;
            enemy.effects.stunTimer = 0;
        }
        let isStunned = false;
        if (!isControlImmune && enemy.effects.stunTimer > 0) {
            enemy.effects.stunTimer -= deltaSeconds;
            isStunned = true;
        }

        // Frost only slows movement to 20% speed (stun is what fully disables an enemy).
        const isFrozen = !isControlImmune && enemy.effects.freezeTimer > 0;
        if (isFrozen) enemy.effects.freezeTimer -= deltaSeconds;
        const moveSpeedMultiplier = isFrozen ? 0.2 : 1;

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
                    enemy.flashUntil = performance.now() + 150;
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
                    enemy.flashUntil = performance.now() + 150;
                }
            }

            if (enemy.effects.poisonTimer <= 0) {
                enemy.effects.poisonStacks = 0;
            }
        }

        // --- 3. Movement Phase ---
        // Rushs never stop: they run through the battlefield and leave from the left edge.
        if (!isStunned && enemy.type === 'rush') {
            enemy.x -= enemy.speed * moveSpeedMultiplier * deltaSeconds;
            if (enemy.x < -50) {
                if (enemy.el) enemy.el.remove();
                activeEnemies.splice(i, 1);
                checkWaveCompletion();
                continue;
            }
        } else if (!isStunned && enemy.x > enemy.targetX) {
            enemy.x -= enemy.speed * moveSpeedMultiplier * deltaSeconds;
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

        // --- 4. State-Specific Attack Executions (Paused only if stunned; frozen enemies still attack) ---
        if (!isStunned) {
            if (enemy.state === 'attacking') {
                enemy.attackTimer += deltaSeconds;
                if (enemy.attackTimer >= (1 / enemy.attackSpeed)) {
                    enemy.attackTimer = 0;
                    damageRandomSlime(enemy.damage, enemy);
                    spawnSlashEffect(enemy);
                    if (enemy.spriteEl) {
                        enemy.strikeUntil = performance.now() + 200;
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
            // Use the cached sprite height to avoid a forced layout read per frame.
            const enemyFootY = enemy.y + (enemy.spriteHeight || 28);
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

            // Timestamp-based hit-flash & strike-vibrate (replaces per-attack setTimeout).
            const spriteEl = enemy.spriteEl;
            if (spriteEl) {
                if (enemy.flashUntil && enemy.flashUntil <= now) enemy.flashUntil = 0;
                if (enemy.strikeUntil && enemy.strikeUntil <= now) enemy.strikeUntil = 0;
                spriteEl.classList.toggle('hit-flash-white', enemy.flashUntil > now);
                spriteEl.classList.toggle('enemy-strike-vibrate', enemy.strikeUntil > now);
            }
        }

        if (enemy.type === 'rush') damageSlimesTouchedByRush(enemy);
    }

    // --- Process Status Effects (Burn DoT, Poison DoT, Stun) & Status Icons on Slimes ---
    if (gameState.slimes) {
        const armyContainer = document.getElementById('armyContainer');

        gameState.slimes.forEach(slime => {
            if (slime.hp <= 0) {
                // Dead slimes skip status processing; just make sure any lingering
                // Ice Barrier shield sprite is removed from the (dying/dead) unit.
                if (slime.effects && (slime.effects.iceBarrierTimer > 0 || slime.effects.iceBarrierBonusHp > 0)) {
                    slime.effects.iceBarrierTimer = 0;
                    slime.effects.iceBarrierBonusHp = 0;
                    const armyContainer = document.getElementById('armyContainer');
                    const deadUnit = armyContainer ? armyContainer.querySelector(`[data-slime-id="${slime.id}"]`) : null;
                    updateSlimeIceBarrier(deadUnit, false);
                }
                return;
            }

            if (!slime.effects) {
                slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0, healOnTimeTimer: 0, healOnTimeTickTimer: 0, healOnTimePerTick: 0, iceBarrierTimer: 0, iceBarrierBonusHp: 0 };
            }

            // Resolve the live on-field unit ONCE per iteration (before any
            // floating-number / status rendering). A stale/detached slime.el would
            // make getOverlayPosition return bogus coords, hiding heal numbers.
            const unit = armyContainer ? armyContainer.querySelector(`[data-slime-id="${slime.id}"]`) : null;
            slime.el = unit;

            // 1. Process Burn Status DoT (1 damage per stack every 0.5s)
            if (slime.effects.burnTimer > 0) {
                slime.effects.burnTimer -= deltaSeconds;
                slime.effects.burnTickTimer = (slime.effects.burnTickTimer || 0) + deltaSeconds;

                if (slime.effects.burnTickTimer >= 0.5) {
                    slime.effects.burnTickTimer -= 0.5;
                    const burnDmg = Math.max(1, slime.effects.burnStacks || 1);
                    damageSpecificSlime(slime, burnDmg, 'slime-dmg', null, false);
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
                    damageSpecificSlime(slime, poisonDmg, 'poison-dmg', null, false);
                }

                if (slime.effects.poisonTimer <= 0) {
                    slime.effects.poisonStacks = 0;
                }
            }

            // 2.5 Process Heal on Time (Melting Mend): restore a flat amount every 0.5s for 3s
            if (slime.effects.healOnTimeTimer > 0) {
                slime.effects.healOnTimeTimer -= deltaSeconds;
                slime.effects.healOnTimeTickTimer = (slime.effects.healOnTimeTickTimer || 0) + deltaSeconds;

                if (slime.effects.healOnTimeTickTimer >= 0.5) {
                    slime.effects.healOnTimeTickTimer -= 0.5;
                    const healAmount = Math.max(0, slime.effects.healOnTimePerTick || 0);
                    slime.hp = Math.min(slime.maxHp, slime.hp + healAmount);
                    if (unit) showFloatingHealingNumberFromUnit(unit, healAmount);
                }

                if (slime.effects.healOnTimeTimer <= 0) {
                    slime.effects.healOnTimePerTick = 0;
                    slime.effects.healOnTimeTickTimer = 0;
                }
            }

            // 3. Process Stun Status Timer
            if (slime.effects.stunTimer > 0) {
                slime.effects.stunTimer -= deltaSeconds;
                if (slime.effects.stunTimer <= 0) {
                    slime.effects.stunTimer = 0;
                    // Ice Block stun ended: drop the flag and let the sprite restore.
                    slime.iceBlockStun = false;
                }
            }

            // 4. Update Slime Status Row Icons (?? ?? ?? ??) & CSS Filters
            if (unit) {
                // `unit` already resolved live (above) from armyContainer by id.
                const statusRow = unit.querySelector('.slime-status-row');
                slime.statusRowEl = statusRow;
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
                unit.classList.toggle('is-heal-on-time', slime.effects.healOnTimeTimer > 0);
                // Ice Block uses its own jump/vibrate style (toggled in the sprite
                // swap branch below) instead of the stun wobble, so skip is-stunned.
                unit.classList.toggle('is-stunned', slime.effects.stunTimer > 0 && !slime.iceBlockStun);
                unit.classList.toggle('is-ice-barrier', (slime.effects.iceBarrierBonusHp || 0) > 0);
                unit.classList.toggle('is-stone-skin', (slime.reduction || 0) > 0);

                // Ice Block: temporarily replace the Slime sprite with the ice block
                // image for the duration of the stun. The jump/vibrate animation plays
                // once, when the swap happens (not every frame).
                const slimeImgEl = unit.querySelector('.slime-img');
                if (slimeImgEl) {
                    if (slime.iceBlockStun && slime.effects.stunTimer > 0) {
                        if (slimeImgEl.dataset.iceBlockSwap !== 'true') {
                            slimeImgEl.dataset.iceBlockSwap = 'true';
                            slimeImgEl.dataset.prevSrc = slimeImgEl.src;
                            slimeImgEl.src = 'images/slimes/ice/iceBlock.png';
                            slimeImgEl.style.objectPosition = '0px 0px';
                            // Add the class now so the one-shot animation triggers once.
                            unit.classList.add('is-ice-block');
                        }
                    } else if (slimeImgEl.dataset.iceBlockSwap === 'true') {
                        slimeImgEl.dataset.iceBlockSwap = 'false';
                        slimeImgEl.src = getSlimeJumpSprite(slime);
                        unit.classList.remove('is-ice-block');
                    }
                }

                // Spawn / remove the Ice Barrier shield sprite on the target slime.
                // Tie visibility to the actual temporary-HP pool, not the timer, so the
                // sprite disappears the instant the pool is depleted (even mid-duration).
                updateSlimeIceBarrier(unit, (slime.effects.iceBarrierBonusHp || 0) > 0);

                const rosterItem = document.getElementById(`roster_item_${slime.id}`);
                if (rosterItem) {
                    rosterItem.classList.toggle('is-burning', slime.effects.burnTimer > 0);
                    rosterItem.classList.toggle('is-poisoned', slime.effects.poisonTimer > 0);
                    rosterItem.classList.toggle('is-frozen', (slime.effects.freezeTimer || 0) > 0);
                    rosterItem.classList.toggle('is-stunned', slime.effects.stunTimer > 0 && !(Boolean(slime.iceBlockStun) && slime.effects.stunTimer > 0));
                    rosterItem.classList.toggle('is-ice-block', Boolean(slime.iceBlockStun) && slime.effects.stunTimer > 0);
                    rosterItem.classList.toggle('is-heal-on-time', slime.effects.healOnTimeTimer > 0);
                    rosterItem.classList.toggle('is-ice-barrier', (slime.effects.iceBarrierBonusHp || 0) > 0);
                    rosterItem.classList.toggle('is-stone-skin', (slime.reduction || 0) > 0);
                    // Live-update the Ice Barrier secondary HP bar width every frame so
                    // the consumed temporary HP is reflected without a full roster rebuild.
                    const bonusHp = Number(slime.effects?.iceBarrierBonusHp || 0);
                    const bonusBar = rosterItem.querySelector('.roster-hp-bonus');
                    if (bonusHp > 0) {
                        if (!bonusBar) {
                            const bar = rosterItem.querySelector('.roster-grid-hp-bar');
                            if (bar) {
                                const sec = document.createElement('div');
                                sec.className = 'roster-grid-hp-bar roster-grid-hp-bar-secondary';
                                const fill = document.createElement('div');
                                fill.className = 'roster-hp-bonus';
                                sec.appendChild(fill);
                                bar.insertAdjacentElement('afterend', sec);
                            }
                        }
                        const fillEl = rosterItem.querySelector('.roster-hp-bonus');
                        if (fillEl) fillEl.style.width = `${Math.min(100, (bonusHp / Math.max(1, slime.maxHp)) * 100)}%`;
                    } else if (bonusBar) {
                        bonusBar.parentNode?.remove();
                    }
                }
            }
        }
        );
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
        fallbackIcon: '??',
        size: 18,
        arcHeight: 25,
        duration: 0.5,
        rotationMode: 'tangent'
    };

    const projEl = document.createElement('div');
    projEl.className = 'enemy-projectile-wrapper';
    projEl.style.left = `${enemy.x}px`;
    projEl.style.top = `${enemy.y + 10}px`;

    const spritePath = projType.sprite || `images/projectiles/${projKey}.png`;
    const fallback = projType.fallbackIcon || '??';
    const projSize = projType.size || 18;

    projEl.innerHTML = `
        <img src="${spritePath}" 
             alt="${projKey}" 
             class="projectile-sprite-img"
             style="height:${projSize}px; width:auto; max-width:none;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
        <span class="projectile-sprite-fallback" style="display:none; font-size:${Math.round(projSize * 0.78)}px;">${fallback}</span>
    `;

    overlay.appendChild(projEl);

    activeProjectiles.push({
        type: projType,
        key: projKey,
        size: projSize,
        startX: enemy.x,
        startY: enemy.y + 10,
        targetX: 105,
        targetY: enemy.y + 10,
        progress: 0,
        duration: projType.duration || 0.5,
        arcHeight: projType.arcHeight || 25,
        straight: projType.straight === true,
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
export function applyBurnEffectToSlime(slime, duration = 3.0, stacks = 1) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0, healOnTimeTimer: 0, healOnTimeTickTimer: 0, healOnTimePerTick: 0, iceBarrierTimer: 0, iceBarrierBonusHp: 0 };
    }

    const burnStacks = Math.max(1, Math.round(stacks));
    if (slime.effects.burnTimer > 0) {
        slime.effects.burnStacks = (slime.effects.burnStacks || 0) + burnStacks;
    } else {
        slime.effects.burnStacks = burnStacks;
    }
    slime.effects.burnTimer = duration;
}

/**
 * Apply Poison Status Effect to a slime (3 seconds DoT: 2 dmg per stack every 1.0s)
 */
export function applyPoisonEffectToSlime(slime, duration = 3.0, stacks = 2) {
    if (!slime || slime.hp <= 0) return;

    if (!slime.effects) {
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0, healOnTimeTimer: 0, healOnTimeTickTimer: 0, healOnTimePerTick: 0, iceBarrierTimer: 0, iceBarrierBonusHp: 0 };
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
        slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0, healOnTimeTimer: 0, healOnTimeTickTimer: 0, healOnTimePerTick: 0, iceBarrierTimer: 0, iceBarrierBonusHp: 0 };
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
                // Fireball AoE: Hits up to 2 unique slimes for damage and applies Burn DoT to both.
                // Burn stacks scale with NG+ so fireball bite grows deeper each cycle.
                const ngBurnStacks = Math.round(Math.pow(1.10, Math.max(0, gameState.newGamePlusCompletions || 0)));
                const hitSlimes = damageMultipleRandomSlimes(2, p.damage, p.sourceEnemy);
                hitSlimes.forEach(slime => {
                    applyBurnEffectToSlime(slime, 3.0, ngBurnStacks);
                });
            } else if (p.key === 'obus' || (p.type && p.type.id === 'obus')) {
                // Obus: very fast straight shot that detonates on the slime line,
                // striking up to 3 random targets for plain impact damage.
                damageMultipleRandomSlimes(3, p.damage, p.sourceEnemy);
            } else {
                damageRandomSlime(p.damage, p.sourceEnemy);
            }

            if (p.el) p.el.remove();
            activeProjectiles.splice(i, 1);
        } else {
            const t = p.progress;
            const curX = p.startX + (p.targetX - p.startX) * t;
            const arcOffset = p.straight ? 0 : (4 * p.arcHeight * t * (1 - t));
            const curY = p.startY + (p.targetY - p.startY) * t - arcOffset;

            let angleDeg = 0;
            if (p.rotationMode === 'spin') {
                // Continuous 360-degree rotation spinning fast as it travels
                angleDeg = (t * 1080) % 360;
            } else if (p.straight) {
                // Fixed angle along the straight flight vector (no curve tangent).
                const vx = p.targetX - p.startX;
                const vy = p.targetY - p.startY;
                angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);
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
 * Spawn the Intercept sprite over the Tank that just absorbed a redirected hit
 * (Tank Interception third talent).
 */
function spawnInterceptEffect(slime) {
    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;
    const unit = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
    if (!unit) return;

    const slimeX = parseFloat(unit.style.left) || 75;
    const slimeY = parseFloat(unit.style.top) || 120;

    const interceptEl = document.createElement('img');
    interceptEl.className = 'intercept-effect';
    interceptEl.src = 'images/projectiles/intercept.png';
    interceptEl.alt = 'Interception';
    interceptEl.style.left = `${slimeX + 8}px`;
    interceptEl.style.top = `${slimeY - 2}px`;
    interceptEl.style.zIndex = '9999';
    armyContainer.appendChild(interceptEl);

    // Small jump/vibrate on the absorbing Tank's unit, matching the Tank Block animation.
    unit.classList.remove('is-block-jump');
    void unit.offsetWidth;
    unit.classList.add('is-block-jump');

    setTimeout(() => {
        if (interceptEl && interceptEl.parentNode) interceptEl.remove();
    }, 500);
}

/**
 * Spawn the Block sprite over a Slime that just ignored damage (Tank Block talent).
 */
function spawnBlockEffect(slime) {
    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;
    const unit = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
    if (!unit) return;

    const slimeX = parseFloat(unit.style.left) || 75;
    const slimeY = parseFloat(unit.style.top) || 120;

    const blockEl = document.createElement('img');
    blockEl.className = 'block-shield-effect';
    blockEl.src = 'images/projectiles/block.png';
    blockEl.alt = 'Block';
    blockEl.style.left = `${slimeX + 8}px`;
    blockEl.style.top = `${slimeY - 2}px`;
    blockEl.style.zIndex = '9999';
    armyContainer.appendChild(blockEl);

    // Animate through the 7 frames (25x25 each) of the block spritesheet at 0.2s/frame.
    const frameCount = 7;
    const frameMs = 100;
    let frame = 0;
    blockEl.style.objectPosition = '0px 0px';
    const interval = setInterval(() => {
        frame = (frame + 1) % frameCount;
        blockEl.style.objectPosition = `${-frame * 25}px 0px`;
    }, frameMs);

    setTimeout(() => {
        clearInterval(interval);
        if (blockEl && blockEl.parentNode) blockEl.remove();
    }, frameCount * frameMs);
}

/**
 * Create / refresh / remove the Ice Barrier shield sprite on a slime unit.
 * The shield persists as long as the barrier is active (the per-frame status
 * loop calls this every frame). The real stacking is in iceBarrierBonusHp;
 * here we only toggle the visual overlay.
 */
function updateSlimeIceBarrier(unit, active) {
    if (!unit) return;
    let shield = unit.querySelector('.slime-ice-barrier');
    if (!active) {
        if (shield && shield.parentNode) shield.remove();
        return;
    }
    if (!shield) {
        shield = document.createElement('div');
        shield.className = 'slime-ice-barrier';
        const img = document.createElement('img');
        img.className = 'slime-ice-barrier-img';
        img.src = 'images/projectiles/icebarrier.png';
        img.alt = 'Ice Barrier';
        img.onerror = function () { this.style.display = 'none'; };
        shield.appendChild(img);
        unit.appendChild(shield);
    }
}

/**
 * Resolve a Tank's Block roll against an incoming hit. When the Block succeeds
 * the hit is ignored and the Tank's Block-linked talents fire (Perfect Block,
 * Spicy Block, Polished Slime reflection, and Counter). Returns true if the hit
 * was blocked, false if the Block roll missed (so the caller applies the damage).
 * Only direct hits (allowBlock) can Block.
 */
function resolveTankBlock(slime, damageAmount, dmgType, sourceEnemy) {
    if (!slime || getSlimeSpecialization(slime) !== 'tank' || !slime.talents?.block) return false;
    const baseBlockChance = getSlimeSubTalentDef(slime, 0)?.id === 'shieldWall' ? 0.2 : 0.1;
    const blockChance = baseBlockChance + getBlockChanceBonus(slime);
    if (Math.random() >= blockChance) return false;

    spawnBlockEffect(slime);
    // Every successful Tank Block plays a one-shot jump/vibrate on the
    // Slime's unit (the Counter talent additionally swaps the sprite).
    const blockUnit = document.querySelector(`[data-slime-id="${slime.id}"]`);
    if (blockUnit) {
        blockUnit.classList.remove('is-block-jump');
        void blockUnit.offsetWidth;
        blockUnit.classList.add('is-block-jump');
    }
    if (getSlimeSubTalentDef(slime, 0)?.id === 'perfectBlock') {
        slime.hp = getSlimeMaxHp(slime);
    }
    // Spicy Block (Fire Tank second talent): reflect the slime's own status
    // effect profile onto the attacker. Base applies burn 3 times (triple burn
    // Stacks); sub-talents can raise the count or also apply poison.
    if (hasSpicyBlock(slime) && sourceEnemy && sourceEnemy.effects !== undefined) {
        const hitEffects = getSlimeHitEffects(slime);
        const isControlImmune = ENEMY_TYPES[sourceEnemy.typeId]?.controlImmune === true;
        const spicyParams = getSpicyBlockParams(slime);
        const burnOnly = { burn: hitEffects.burn };
        for (let i = 0; i < spicyParams.burnApplications; i++) {
            applyHitEffectsToEnemy(sourceEnemy, burnOnly, slime, isControlImmune);
        }
        if (spicyParams.applyPoison) {
            const poisonOnly = { poison: hitEffects.poison };
            applyHitEffectsToEnemy(sourceEnemy, poisonOnly, slime, isControlImmune);
            applyHitEffectsToEnemy(sourceEnemy, poisonOnly, slime, isControlImmune);
            applyHitEffectsToEnemy(sourceEnemy, poisonOnly, slime, isControlImmune);
        }
        // Spicy Block: swap the Slime's sprite to the spicy block pose for a
        // second (the block jump animation is already playing), then revert.
        const spicyUnit = document.querySelector(`[data-slime-id="${slime.id}"]`);
        const spicyImg = spicyUnit ? spicyUnit.querySelector('.slime-img') : null;
        if (spicyImg) {
            spicyImg.dataset.prevSrc = spicyImg.src;
            spicyImg.src = 'images/slimes/fire/spicyBlock.png';
            spicyImg.style.objectPosition = '0px 0px';
            setTimeout(() => {
                spicyImg.src = getSlimeJumpSprite(slime);
            }, 1000);
        }
    }
    // Polished Slime (Stone Tank second talent): reflect the slime's own stun
    // Status onto the attacker. Base applies it once (nerfed from twice);
    // "Dazing Block" doubles it, "Pushback" also knocks the enemy back.
    if (hasPolishedSlime(slime) && sourceEnemy && sourceEnemy.effects !== undefined) {
        const hitEffects = getSlimeHitEffects(slime);
        const isControlImmune = ENEMY_TYPES[sourceEnemy.typeId]?.controlImmune === true;
        const polishedParams = getPolishedSlimeParams(slime);
        const stunOnly = { stun: hitEffects.stun * polishedParams.stunMultiplier };
        applyHitEffectsToEnemy(sourceEnemy, stunOnly, slime, isControlImmune);
        if (polishedParams.pushbackPx > 0 && sourceEnemy.type !== 'rush') {
            sourceEnemy.x = Math.min(450, sourceEnemy.x + polishedParams.pushbackPx);
            sourceEnemy.state = 'walking';
            sourceEnemy.attackTimer = 0;
            if (sourceEnemy.el) {
                sourceEnemy.el.style.left = `${sourceEnemy.x}px`;
                sourceEnemy.el.classList.remove('enemy-attacking', 'enemy-tanking', 'enemy-range', 'enemy-support');
                sourceEnemy.el.classList.add('enemy-walking');
            }
            showFloatingStatusText(sourceEnemy, String.fromCodePoint(0x1F4A5), 'pushback-text');
        }
        // Polished Slime: swap the Slime's sprite to the polished pose for
        // a second (the block jump animation is already playing), then revert.
        const polishedUnit = document.querySelector(`[data-slime-id="${slime.id}"]`);
        const polishedImg = polishedUnit ? polishedUnit.querySelector('.slime-img') : null;
        if (polishedImg) {
            polishedImg.dataset.prevSrc = polishedImg.src;
            polishedImg.src = 'images/slimes/stone/polishedStone.png';
            polishedImg.style.objectPosition = '0px 0px';
            setTimeout(() => {
                polishedImg.src = getSlimeJumpSprite(slime);
            }, 1000);
        }
    }
    // Counter (Poison Tank second talent): strike back at the attacker for
    // 25% of the Slime's damage (with its on-hit effects) and heal the
    // Slime for 25% of that counter damage.
    if (hasCounter(slime) && sourceEnemy && sourceEnemy.hp > 0) {
        const counterParams = getCounterParams(slime);
        const counterDamage = gameState.slimeDamage * counterParams.damageMultiplier;
        const damageToApply = Math.min(sourceEnemy.hp, counterDamage);
        sourceEnemy.hp -= damageToApply;
        const isControlImmune = ENEMY_TYPES[sourceEnemy.typeId]?.controlImmune === true;
        const counterEffects = getSlimeHitEffects(slime);
        for (let i = 0; i < counterParams.statusApplications; i++) {
            applyHitEffectsToEnemy(sourceEnemy, counterEffects, slime, isControlImmune);
        }
        showFloatingDamageNumber(sourceEnemy.x || 250, sourceEnemy.y || 130, damageToApply, 'enemy-dmg');
        // Counter: swap the Slime's sprite to the counter pose (the block
        // jump animation is already playing from the successful Block above),
        // then revert to its normal jump sprite.
        const counterUnit = document.querySelector(`[data-slime-id="${slime.id}"]`);
        const counterImg = counterUnit ? counterUnit.querySelector('.slime-img') : null;
        if (counterImg) {
            counterImg.dataset.prevSrc = counterImg.src;
            counterImg.src = 'images/slimes/poison/counter.png';
            counterImg.style.objectPosition = '0px 0px';
            setTimeout(() => {
                counterImg.src = getSlimeJumpSprite(slime);
            }, 600);
        }
        const healed = Math.min(slime.maxHp - slime.hp, Math.round(counterDamage * 0.25));
        if (healed > 0) {
            slime.hp += healed;
            showFloatingHealingNumberFromUnit(
                document.querySelector(`[data-slime-id="${slime.id}"]`),
                healed
            );
        }
        if (sourceEnemy.hp <= 0 && sourceEnemy.el) {
            sourceEnemy.el.classList.add(Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left');
            setTimeout(() => {
                if (sourceEnemy.el) sourceEnemy.el.remove();
                const idx = activeEnemies.indexOf(sourceEnemy);
                if (idx !== -1) activeEnemies.splice(idx, 1);
            }, 800);
        }
    }
    return true;
}

/**
 * Applies damage to a specific slime instance
 */
/**
 * Refresh the on-screen HP bars (battlefield unit + roster sidebar) for a
 * single slime from its current hp/maxHp. Used after any HP change that is not
 * routed through damageSpecificSlime (e.g. end-of-wave regeneration), so the
 * heal is visible immediately instead of waiting for the next unit rebuild.
 */
export function updateSlimeHpBar(slime) {
    if (!slime) return;
    const hpPct = Math.max(0, (slime.hp / slime.maxHp) * 100);

    const armyContainer = document.getElementById('armyContainer');
    if (armyContainer) {
        const unit = armyContainer.querySelector(`[data-slime-id="${slime.id}"]`);
        if (unit) {
            const hpFill = unit.querySelector('.slime-hp-fill');
            if (hpFill) hpFill.style.width = `${hpPct}%`;
        }
    }

    const rosterItem = document.getElementById(`roster_item_${slime.id}`);
    const rosterFill = rosterItem ? rosterItem.querySelector('.roster-hp-fill') : null;
    if (rosterFill) {
        rosterFill.style.width = `${hpPct}%`;
        if (hpPct < 35) rosterFill.style.background = '#ef4444';
        else if (hpPct < 65) rosterFill.style.background = '#f59e0b';
        else rosterFill.style.background = '#10b981';
    }
    if (rosterItem) {
        rosterItem.title = `${slime.type || 'Slime'}: ${slime.hp}/${slime.maxHp} HP`;
    }
}

export function damageSpecificSlime(slime, damageAmount, dmgType = 'slime-dmg', sourceEnemy = null, allowBlock = true) {
    if (!slime || slime.hp <= 0) return null;

    // Interception (Tank third talent): a wounded Tank (under 50% HP) has its
    // incoming damage redirected to another Tank that owns Interception and is
    // still above 50% HP. Only direct hits are intercepted — status DoT ticks
    // (burn/poison) pass allowBlock=false and stay on their own victim.
    // The original (wounded) Tank still resolves its OWN Block / Counter / etc.
    // first (so Counter keeps triggering); if it Blocks, no damage remains and
    // the interceptor takes nothing. Otherwise the leftover damage is routed to
    // the interceptor, which resolves it with its own mitigation/Block. This is
    // resolved up front so the rest of the function only ever applies to the
    // "real" recipient of the surviving damage.
    if (allowBlock) {
        const interceptor = findInterceptorFor(slime);
        if (interceptor) {
            // The wounded Tank still resolves its OWN Block / Counter / etc. first
            // (so Counter keeps triggering). If it Blocks, no damage remains and
            // the interceptor takes nothing. Otherwise the leftover damage is
            // routed to the interceptor with allowBlock=false so it does NOT chain
            // another interception lookup (it is the designated absorber).
            const blocked = resolveTankBlock(slime, damageAmount, dmgType, sourceEnemy);
            if (blocked) return slime;
            // Interception sub-talents applied to the redirected hit.
            const interceptParams = getInterceptionParams(interceptor);
            let interceptedDamage = damageAmount;
            if (interceptParams.damageReduction > 0) {
                interceptedDamage = Math.max(0, Math.round(interceptedDamage * (1 - interceptParams.damageReduction)));
            }
            // Avenge: the intercepting Tank reflects its own status onto the attacker.
            if (interceptParams.applyStatus && sourceEnemy && sourceEnemy.effects !== undefined) {
                const isControlImmune = ENEMY_TYPES[sourceEnemy.typeId]?.controlImmune === true;
                applyHitEffectsToEnemy(sourceEnemy, getSlimeHitEffects(interceptor), interceptor, isControlImmune);
            }
            spawnInterceptEffect(interceptor);
            return damageSpecificSlime(interceptor, interceptedDamage, dmgType, sourceEnemy, false);
        }
    }

    // Polished Slime (Stone Tank second talent): reduce ALL incoming damage by
    // 10% BEFORE any other flat absorption or reductions (Block, Stone Skin,
    // Ice Barrier, etc.). Applied to every hit, including status DoT ticks.
    if (hasPolishedSlime(slime)) {
        damageAmount = Math.max(0, Math.round(damageAmount * 0.9));
    }

    // Tank Block talent: base 10% chance to ignore incoming damage.
    // shieldWall increases it by 10 more %. Perfect Block heals to full on a successful block.
    // Status effect DoT ticks (burn/poison) pass allowBlock=false and can never be blocked.
    // Returns true when the hit was blocked (and Counter/Spicy/Polished fired), false otherwise.
    if (allowBlock) {
        const blocked = resolveTankBlock(slime, damageAmount, dmgType, sourceEnemy);
        if (blocked) return null;
    }

    // Stone Skin (Stone Support): consume the target's "reduction" pool against the
    // NEXT DIRECT hit only (status DoT passes allowBlock=false and is unaffected).
    // Damage is reduced by the reduction amount (never below 0) and the pool resets to 0.
    const wasReduced = (allowBlock && (slime.reduction || 0) > 0);
    if (wasReduced) {
        const reduced = Math.min(slime.reduction, damageAmount);
        slime.reduction = 0;
        damageAmount -= reduced;
    }
    // Stone Skin standardization sub-talent: a percentage damage reduction on the
    // next direct hit (independent of the graft/heal amount). Consumed once.
    if (allowBlock && (slime.reductionPct || 0) > 0) {
        damageAmount = Math.max(0, Math.round(damageAmount * (1 - slime.reductionPct)));
        slime.reductionPct = 0;
    }

    // Ice Barrier (Ice Support): temporary HP absorbs damage BEFORE real HP.
    // Remove from the separate iceBarrierBonusHp pool first; only the overflow
    // reaches slime.hp. The slime can only die once the temporary pool is gone.
    let remainingDamage = damageAmount;
    if (slime.effects && slime.effects.iceBarrierBonusHp > 0) {
        const absorbed = Math.min(slime.effects.iceBarrierBonusHp, remainingDamage);
        slime.effects.iceBarrierBonusHp -= absorbed;
        remainingDamage -= absorbed;
        if (slime.effects.iceBarrierBonusHp <= 0) {
            slime.effects.iceBarrierBonusHp = 0;
            slime.effects.iceBarrierTimer = 0;
        }
    }
    slime.hp = Math.max(0, slime.hp - remainingDamage);
    let slimeX = 75;
    let slimeY = 120;
    const armyContainerRef = document.getElementById('armyContainer');
    if (armyContainerRef) {
        const unitRef = armyContainerRef.querySelector(`[data-slime-id="${slime.id}"]`);
        if (unitRef) {
            slimeX = parseFloat(unitRef.style.left) || 75;
            slimeY = parseFloat(unitRef.style.top) || 120;
        }
    }

    // Ice Block (Ice Tank second talent): on the lethal blow, roll a chance to
    // instead survive at 10% of Max HP. Used as a death-substitute, so when it
    // triggers we skip all death handling and the unit death animation.
    if (slime.hp <= 0 && hasIceBlock(slime)) {
        const ICE_BLOCK_BASE_CHANCE = 0.20; // 20% base chance to survive at 10% HP
        const iceBlockChance = ICE_BLOCK_BASE_CHANCE + getIceBlockParams(slime).chanceBonus;
        if (Math.random() < iceBlockChance) {
            slime.hp = Math.max(1, Math.round(slime.maxHp * 0.10));
            if (!slime.effects) {
                slime.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0, healOnTimeTimer: 0, healOnTimeTickTimer: 0, healOnTimePerTick: 0, iceBarrierTimer: 0, iceBarrierBonusHp: 0 };
            }
            const iceCure = getSlimeSubTalentDef(slime, 1)?.id === 'iceCure';
            if (iceCure) {
                // Ice Cure: regenerate 100% of Max HP over 5s (10% per 0.5s tick).
                slime.effects.healOnTimeTimer = 5;
                slime.effects.healOnTimeTickTimer = 0;
                slime.effects.healOnTimePerTick = Math.max(1, Math.round(slime.maxHp * 0.10));
            }
            // Surviving via Ice Block leaves the Slime stunned for 5s and shows the
            // ice block sprite for the duration of that stun.
            slime.effects.stunTimer = 5;
            slime.iceBlockStun = true;
            const unitEl = armyContainerRef ? armyContainerRef.querySelector(`[data-slime-id="${slime.id}"]`) : null;
            if (unitEl) {
                const hpFill = unitEl.querySelector('.slime-hp-fill');
                if (hpFill) hpFill.style.width = `${(slime.hp / slime.maxHp) * 100}%`;
            }
            updateUI();
            return slime;
        }
    }
    updateSlimeHpBar(slime);

    const rosterItem = document.getElementById(`roster_item_${slime.id}`);
    if (rosterItem) {
        rosterItem.classList.add('roster-hit-flash');
        setTimeout(() => rosterItem.classList.remove('roster-hit-flash'), 180);
    }

    const armyContainer = armyContainerRef;
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
                            else wipeWaveState();
                        }
                    }
                });

                // Instantly refresh roster sidebar so dead slime slot displays ?? RIP icon immediately
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
                else wipeWaveState();
            }
        }
    }

    // Pop floating pixel art damage number over hit slime. Always show it, even
    // when the reduction attribute fully absorbed the hit (damageAmount === 0), so
    // a "-0" floats up to confirm the block rather than silently doing nothing.
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

    playDieSound();

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
    const targetWave = Math.max(1, (gameState.currentWave || 1) - 1);
    performWaveReset(targetWave);
}

/**
 * Test shortcut: jump forward to wave 51.
 */
export function forwardWaveState() {
    performWaveReset(51);
}

/**
 * Wipe: reset the run to the first wave of the current tier (e.g. wave 24 -> 21).
 * This is triggered when the entire army is wiped out.
 */
export function wipeWaveState() {
    const currentWave = gameState.currentWave || 1;
    // Wiping on the very first wave (the lone Beggar) unlocks "Poor Guy".
    if (currentWave === 1) grantAchievement('poorGuy');
    // Track the boss tier wiped (10/20/30/40/50) for Iron Man / Paper Thin.
    const wipedTier = Math.min(50, Math.floor((currentWave - 1) / 10) * 10 + 10);
    recordRunWipe(wipedTier);
    // Wiping on a bonus stage must return the player to the normal wave they
    // would have reached had they skipped the bonus (e.g. bonus after boss 10
    // -> back to wave 11), not the bogus bonus wave number.
    const targetWave = (currentWave >= 900 && gameState.bonusReturnWave)
        ? gameState.bonusReturnWave
        : (Math.floor((currentWave - 1) / 10) * 10 + 1);
    // A wipe consumes the bonus detour; clear the stashed return wave so it
    // cannot leak into a later normal-wave reset.
    gameState.bonusReturnWave = null;
    performWaveReset(targetWave);
}

/**
 * Shared reset pipeline: KO all active enemies/projectiles/loot, restore the best
 * roster, then sky-drop the slimes and start the given target wave.
 */
function performWaveReset(targetWave) {
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
        gameState.currentWave = Math.max(1, targetWave);
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
    const enemyHeight = (enemy.spriteHeight || enemy.el?.offsetHeight || 28) || 28;
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














