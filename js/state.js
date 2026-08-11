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
        effect: null
    },
    fire: {
        id: 'fire',
        name: 'Fire Slime',
        folder: 'images/slimes/fire',
        prefix: 'slime',
        frameCount: 8,
        effect: 'burn',
        burnDamagePerSec: 1,
        burnDuration: 10 // 10 seconds DoT (1 damage per second)
    },
    ice: {
        id: 'ice',
        name: 'Ice Slime',
        folder: 'images/slimes/ice',
        prefix: 'slime',
        frameCount: 8,
        effect: 'freeze',
        freezeDuration: 1 // Base freeze duration; equipment values multiply this
    },
    stone: {
        id: 'stone',
        name: 'Stone Slime',
        folder: 'images/slimes/stone',
        prefix: 'slime',
        frameCount: 8,
        effect: 'stun',
        stunDuration: 0.3 // Base stun duration; equipment values multiply this
    },
    poison: {
        id: 'poison',
        name: 'Poison Slime',
        folder: 'images/slimes/poison',
        prefix: 'slime',
        frameCount: 8,
        effect: 'poison',
        poisonDamagePerSec: 2,
        poisonDuration: 10 // 10 seconds DoT (2 damage per stack per 1.0s tick)
    }
};

// Specializations currently inherit all gameplay values and sprites from their elemental base type.
[
    ['poison', 'poisonSupport', 'PoisonSupport Slime'],
    ['poison', 'poisonFighter', 'PoisonFighter Slime'],
    ['poison', 'poisonTank', 'PoisonTank Slime'],
    ['fire', 'fireSupport', 'FireSupport Slime'],
    ['fire', 'fireFighter', 'FireFighter Slime'],
    ['fire', 'fireTank', 'FireTank Slime'],
    ['ice', 'iceSupport', 'IceSupport Slime'],
    ['ice', 'iceFighter', 'IceFighter Slime'],
    ['ice', 'iceTank', 'IceTank Slime'],
    ['stone', 'stoneSupport', 'StoneSupport Slime'],
    ['stone', 'stoneFighter', 'StoneFighter Slime'],
    ['stone', 'stoneTank', 'StoneTank Slime']
].forEach(([baseType, id, name]) => {
    SLIME_TYPES[id] = { ...SLIME_TYPES[baseType], id, name, specialization: id.replace(/^(poison|fire|ice|stone)/, '') };
});

/** Hard ceiling for every upgrade cost: no upgrade may ever exceed this in scraps. */
export const MAX_UPGRADE_COST = 500;

/** Clamp an upgrade cost to the global hard ceiling. */
function clampUpgradeCost(cost) {
    return Math.min(MAX_UPGRADE_COST, cost);
}

const SLIME_NAME_POOL = [
    'Gooey', 'Bloop', 'Splat', 'Pudding', 'Blobby',
    'Glurp', 'Jelly', 'Slush', 'Gummy', 'Squish',
    'Bubble', 'Sticky', 'Slimey', 'Mochi', 'Splosh',
    'Slinky', 'Bouncy', 'Drip', 'Noodle', 'Plop',
    'Squeegee', 'Wobble', 'Ziggy', 'Pip', 'Fizzy',
    'Gizmo', 'Sprout', 'Bean', 'Peanut', 'Muffin',
    'Boop', 'Snack', 'Blobfish', 'Goober', 'Muck',
    'Sludge', 'Toxie', 'Spark', 'Frosty', 'Rocky',
    'Magma', 'Pebble', 'Clay', 'Cobble', 'Venom',
    'Splatter', 'Gloop', 'Blip', 'Ooze', 'Splurge',
    'John', 'Karim', 'Jean-François Petit', 'Pierre', 'Gimli',
    'Seigneur Blindax', 'Petit Flan', 'Michel Brouzouf', 'Raymond le Rincé', 'Rainman',
    'Flambino', 'Toxic Ex', 'Lord of the Rings', 'Squeaky Boy', 'Jello Mr Bean',
    'Jeeves', 'Steeve', 'Stephan', 'Stephen', 'The Rock',
    'Ice Cube', 'Fire Man', 'The Dude', 'Pelavius', 'Brutus Maximus',
    'Kebab', 'Bruscetta', 'La Porta', 'Small Brain', 'Big Brain',
    'Knuckles the Guide', 'Michael', 'Obama', 'GooBall',
    'Slay Queen', 'Jackson Five', 'Taxi Joe', 'The Chosen One', 'Bozu',
    'Sunny', 'Number Two', 'Big Mac', 'Chungus', 'Big Chungus',
    'Snorlax the Brave', 'Jean-Michel Apathique', 'Jupiter', 'Méluche', 'Marine',
    'Le Barde est là', 'Chéa Rome', 'They/Them', 'She/Her', 'He/Him',
    'Your Phobia', 'He HIS the Danger', 'Chicken Nugget', 'Cheese Maki', 'Chef Sushi',
    'KonNiChonHa', 'Baguette', 'Dragon Roll Guy', 'ARE YOU OK ?', 'Bello Bello',
    'Bella Dimende', 'Poltrone Sofa', 'Boudha', 'Jesus II', 'Bobby la Pointe',
    'K. Fried Chicken', 'Le Coq', 'Johnny McQueen', 'Bento Box', 'Jean-Eudes',
    'Gorgeous W. SHUB', 'La Kekette', 'HACKERMAN', 'Vegy Boy', 'Jojo',
    'La Super Nana', 'Blanche Neige', 'Snow White', 'Snowball', 'Billy Jean',
    'Chad', 'Super Chad', 'Giga Chad', 'Mega Chad', 'King',
    'Pikachu', 'Sacha', 'The Meat Grinder', 'McCain', 'McDonald',
    'Le Babouin', 'Chewbacca', 'Dark Vador', 'Frodo', 'Trolleybus',
    'Jesus Premier', 'Imbitable', 'John Travolta', 'Bob Le Magnifique',
    'Magnifique le Couvre-Chef', 'Couvre-Chef le Distingué', 'Saperlipopette', 'DAH SPINDLE', 'MASCARADE',
    'EXTRAVAGANZA', 'Che Guevara', 'Le Noble Mucus', 'Duc de Salade', 'Limule',
    'Une Loutre', 'Le Goinfre', 'Golon Golon', 'Poutré le Bien-Loti', 'Prédumur le Mal-Bercé',
    'Gérard Bouchard', 'Batman', 'Bruce Wayne', 'Omniboy', 'Loué Soit-Il',
    'Goku', 'Vegeta', 'Piccolo', 'Son Gohan', 'Trunks',
    'Boule de Poils', 'Boulazéro', 'Le Boulard', '404: Not Found', 'Null',
    'Le Rincé', 'Gros Tas', 'Bref le Vif', 'Ninja Gaiden', 'Mr. T',
    'Mr. Green', 'Mr. Pink', 'Mr. White', 'Mr. Orange', 'Mr. Blue',
    'Mr. Yellow', 'Mr. Purple', 'Mr. Brown', 'Mr. Black', 'Mr. White',
    'Mr. Orange', 'Mr. Madame', 'Trou Duluc', 'Lucky Luck', 'Luc le Chanceux',
    'Gaston Lagaffe', 'Asterix', 'Obelix', 'Idefix', 'Canabis',
    'M&M', 'Eminem', 'LA BANANA', 'Pomme Verte', 'Le Marseillais',
    'Boris Pare-Balle', 'John-John', 'Le Prolo', 'Tonton Marcel', 'Mimiboy',
    'Entrée-Plat-Dessert', 'Flan Caramel', 'Le Pudding', 'John Jelly', 'Sauce à la Sauce',
    'Bruyant le Furtif', 'Le Gitan', 'Magus', 'Salade-Tomate-Oignon', 'Samuraï Sauce',
    'Inspecteur le Blanco', 'Arpenteur Bolas', 'Jace', 'Judas le Loyal', 'Pine-de-Pomme',
    'Thé Vert', 'Thé à la Pêche', 'MicMac Padiwak', 'Rascar Capac', 'Diabolo Citron',
    'Monaco', 'La Sardine', 'La Bagarre', 'Paul Ichnel', 'Paul le Saumon',
    'Paradis Yack', 'Incroyable Hulk', 'Iron Blob', 'Godefroy de Montmirail', 'Jackouille la Fripouille',
    'Chaussée aux Moines', 'Martingale la Meringuée', 'Caprice des Dieux', 'Le Rock Fort', 'Tutti Frutti',
    'Seigneur Merguez', 'Chéa Rome le Romain', 'Goat Granny', 'Jonny McBravo', 'Bouffon des Ténèbres'
];

/**
 * Generate a unique slime name that does NOT exist in active slimes or bestRoster
 */
export function generateUniqueSlimeName(existingSlimes = []) {
    const usedNames = new Set();

    if (gameState.slimes) {
        gameState.slimes.forEach(s => { if (s && (s.name || s.id)) usedNames.add(s.name || String(s.id)); });
    }
    if (gameState.bestRoster) {
        gameState.bestRoster.forEach(s => { if (s && (s.name || s.id)) usedNames.add(s.name || String(s.id)); });
    }
    if (gameState.villageRoster) {
        gameState.villageRoster.forEach(s => { if (s && (s.name || s.id)) usedNames.add(s.name || String(s.id)); });
    }
    if (Array.isArray(existingSlimes)) {
        existingSlimes.forEach(s => { if (s && (s.name || s.id)) usedNames.add(s.name || String(s.id)); });
    }

    const unusedNames = SLIME_NAME_POOL.filter(n => !usedNames.has(n));
    if (unusedNames.length > 0) {
        return unusedNames[Math.floor(Math.random() * unusedNames.length)];
    }

    const baseName = SLIME_NAME_POOL[Math.floor(Math.random() * SLIME_NAME_POOL.length)];
    let counter = 2;
    while (usedNames.has(`${baseName} ${counter}`)) {
        counter++;
    }
    return `${baseName} ${counter}`;
}

export const defaultState = {
    scraps: 0,            // Scraps available to spend on upgrades
    score: 0,             // Total cumulative Scraps collected this run
    currentWave: 1,       // Current wave of adventurer enemies
    bonusReturnWave: null, // Normal wave to return to after a cleared bonus wave
    maxWaveCleared: 0,    // Highest wave cleared in current run (for unlocking upgrades)
    armySize: 1,          // 1 Base Slime
    maxSlimesReached: 1,  // Highest slime count achieved in army
    maxAscendedSlimesReached: 0, // Highest count of ascended slimes reached at once
    slimeDamage: 1,       // Bonus attack damage per slime
    slimeRegen: 0,        // Health regained per wave for all slimes
    precisionLevel: 0,    // Level of Precision upgrade (+1% base crit chance per level)
    hasSlimeDied: false,  // Unlocks Regeneration upgrade when true
    hasUsedDivision: false, // Unlocks Selection upgrade when true
    digestionLevel: 0,    // Level of Digestion upgrade (extra slimes going to eat)
    incubationLevel: 0,   // Legacy save field
    autoEatLevel: 0,
    fortificationLevel: 0,
    afkScrapCeilingLevel: 0,
    afkScrapLevel: 0,
    afkScrapCeilingPurchased: false,
    afkScrapPurchased: false,
    afkLastAwayAt: null,
    ignitionLevel: 0,     // Level of Ignition upgrade (0-10, 2% Fire Slime spawn chance per level)
    glaciationLevel: 0,   // Level of Glaciation upgrade (0-10, 2% Ice Slime spawn chance per level)
    petrificationLevel: 0,// Level of Petrification upgrade (0-10, 2% Stone Slime spawn chance per level)
    intoxicationLevel: 0, // Level of Intoxication upgrade (0-10, 2% Toxic Slime spawn chance per level)
    unlockedUpgrades: {   // Permanent upgrade unlock flags (once unlocked, never hidden except on full reset)
        division: false,
        ascension: false,
        augmentation: false,
        precision: false,
        regen: false,
        digestion: false,
        incubation: false,
        autoEat: false,
        fortification: false,
        selectionCard: false,
        selection: false,
        evolutionCard: false,
        evolution: false,
        ignition: false,
        glaciation: false,
        petrification: false,
        intoxication: false
    },
    bestRoster: [         // Persistent blueprint of highest slimes count obtained (with unique names, stats & ascension)
        { id: 'Gooey', name: 'Gooey', type: 'base', hp: 10, maxHp: 10, damage: 1, critChance: 0, regen: 0, ascended: false, slotIndex: 0, equipment: [] }
    ],
    waveSnapshots: {},    // Map of saved roster & state snapshots per cleared wave
    slimes: [
        { id: 'Gooey', name: 'Gooey', type: 'base', hp: 10, maxHp: 10, damage: 1, critChance: 0, regen: 0, ascended: false, slotIndex: 0, equipment: [] }
    ],
    newGamePlusCompletions: 0, // Times Death has ended a run
    villageCoins: 0,            // Permanent currency earned from completed runs
    disableHealCrit: true,      // TEST: disable heal crits/mega-crits for now
    villageInventory: [],       // Unequipped equipment stored at the Forge
    villageRoster: [],          // Reserve slimes stored at the Common House (max 180)
    alchemistLuckLevel: 0,
    alchemistRageLevel: 0,
    alchemistEnduranceLevel: 0,
    alchemistRegenLevel: 0,
    isInNewGamePlus: false,    // Village intermission after defeating/wiping to Death
    achievements: {},          // Map of unlocked achievement id -> true
    runWipedTiers: [],          // Tiers (10/20/30/40/50) wiped during the current run
    isFastMode: false,         // Fast Mode: +100% enemy move speed and 5s between-wave timer
    noMerchant: false,         // No Merchant Mode: skip the Merchant shop between waves
    lastSavedTimestamp: Date.now()
};

export let gameState = { ...defaultState };

/**
 * Increment Scraps counter and Score when slime eats ground loot
 */
export function addScraps(amount = 1) {
    gameState.scraps = (gameState.scraps || 0) + amount;
    gameState.score = (gameState.score || 0) + amount;
    saveStateToLocal();
}

export const ALCHEMIST_UPGRADES = Object.freeze({
    luck: { key: 'luck', field: 'alchemistLuckLevel', name: 'Flask of Fire', description: '+1 Base Burn /lvl', icon: 'firePotion.png' },
    rage: { key: 'rage', field: 'alchemistRageLevel', name: 'Vial of Frost', description: '+1 Base Freeze /lvl', icon: 'icePotion.png' },
    endurance: { key: 'endurance', field: 'alchemistEnduranceLevel', name: 'Brew of Venom', description: '+1 Base Poison /lvl', icon: 'poisonPotion.png' },
    regeneration: { key: 'regeneration', field: 'alchemistRegenLevel', name: 'Tonic of Stone', description: '+1 Base Stun /lvl', icon: 'stonePotion.png' }
});

export function getAlchemistUpgradeLevel(key) {
    const upgrade = ALCHEMIST_UPGRADES[key];
    return upgrade ? (gameState[upgrade.field] || 0) : 0;
}

export function getAlchemistUpgradeCost(key) {
    return clampUpgradeCost(getAlchemistUpgradeLevel(key) + 1);
}

export function buyAlchemistUpgrade(key) {
    const upgrade = ALCHEMIST_UPGRADES[key];
    if (!upgrade) return false;
    const cost = getAlchemistUpgradeCost(key);
    if ((gameState.villageCoins || 0) < cost) return false;

    gameState.villageCoins -= cost;
    gameState[upgrade.field] = getAlchemistUpgradeLevel(key) + 1;
    const apply = (slime) => {
        if (!slime) return;
        if (key === 'luck') slime.critChance = (slime.critChance || 0) + 1;
        if (key === 'rage') refreshSlimeDamage(slime);
        if (key === 'endurance') {
            slime.baseMaxHp = (slime.baseMaxHp ?? slime.maxHp ?? 10) + 1;
            refreshSlimeMaxHp(slime);
        }
        if (key === 'regeneration') slime.regen = (slime.regen || 0) + 1;
    };
    (gameState.slimes || []).forEach(apply);
    (gameState.bestRoster || []).forEach(apply);
    saveStateToLocal();
    return true;
}

/** Bulk-buy an Alchemist upgrade: shift+click unlocks up to 10 levels at once. */
export function buyAlchemistUpgradeBulk(key, max = 10) {
    let bought = 0;
    for (let i = 0; i < max; i++) {
        if (!buyAlchemistUpgrade(key)) break;
        bought++;
    }
    return bought;
}
/** Equipment quality ranges from base (0) through +4. */
export function getEquipmentQuality(item) {
    return Math.max(0, Math.min(4, Math.floor(Number(item?.quality) || 0)));
}

export function getEquipmentMultiplier(item) {
    return 1 + getEquipmentQuality(item);
}

/**
 * Live definition lookup. Equipment is stored as { id, quality } only; all
 * presentational and mechanical data is re-derived from the enemy definition
 * registered here (ENEMY_TYPES) so edits to enemies.js apply to saved items.
 */
let equipmentDefinitionResolver = null;
export function setEquipmentDefinitionResolver(resolver) {
    equipmentDefinitionResolver = resolver;
}

export function getEquipmentDefinition(item) {
    const id = item?.id || item?.enemyKey;
    if (!id || !equipmentDefinitionResolver) return null;
    return equipmentDefinitionResolver(id) || null;
}

/** Normalize a loot_effect value (array, single effect, or { effects: [...] }) to an array. */
export function getEquipmentEffects(item) {
    const def = getEquipmentDefinition(item);
    const raw = def?.loot_effect !== undefined ? def.loot_effect : item?.effects;
    if (Array.isArray(raw)) return raw;
    if (raw?.effects) return Array.isArray(raw.effects) ? raw.effects : [raw.effects];
    if (raw) return [raw];
    return [];
}

export function getScaledEquipmentEffects(item) {
    const rawEffects = getEquipmentEffects(item);
    const multiplier = getEquipmentMultiplier(item);
    return rawEffects.filter(Boolean).map(effect => ({
        ...effect,
        value: effect?.value === undefined ? effect?.value : Number(effect.value) * multiplier
    }));
}

export function getEquipmentSellMultiplier(item) {
    return Math.pow(5, getEquipmentQuality(item));
}

export function getEquipmentDisplayName(item) {
    const def = getEquipmentDefinition(item);
    const baseName = def?.loot_name || item?.name || item?.id || 'Equipment';
    const quality = getEquipmentQuality(item);
    return quality > 0 ? `${baseName} +${quality}` : baseName;
}

export function getEquipmentSprite(item) {
    const id = item?.id || item?.enemyKey;
    return item?.sprite || (id ? `images/loots/${id}.png` : 'images/loots/boot.png');
}
/**
 * Base status amount a Slime applies by its element, before equipment.
 * Defaults to 1, then gains +1 per level of the matching Alchemist upgrade
 * (Flask of Fire -> burn, Vial of Frost -> freeze, Brew of Venom -> poison,
 * Tonic of Stone -> stun). Base/unspecialized Slimes return 0.
 */
export function getSlimeBaseStatus(slime) {
    const slimeEffect = (SLIME_TYPES[slime?.type] || SLIME_TYPES.base).effect;
    if (!slimeEffect) return 0;
    const upgradeKeyByEffect = { burn: 'luck', freeze: 'rage', poison: 'endurance', stun: 'regeneration' };
    const upgradeKey = upgradeKeyByEffect[slimeEffect];
    if (!upgradeKey) return 0;
    return 1 + getAlchemistUpgradeLevel(upgradeKey);
}

/** Sum innate elemental effects and quality-scaled equipment effects for one hit. */
export function getSlimeHitEffects(slime) {
    const totals = { burn: 0, freeze: 0, poison: 0, stun: 0 };
    const slimeEffect = (SLIME_TYPES[slime?.type] || SLIME_TYPES.base).effect;
    if (slimeEffect && Object.prototype.hasOwnProperty.call(totals, slimeEffect)) {
        totals[slimeEffect] += getSlimeBaseStatus(slime);
    }

    (slime?.equipment || []).forEach(item => {
        getScaledEquipmentEffects(item).forEach(effect => {
            const type = Object.prototype.hasOwnProperty.call(totals, effect?.stat) ? effect.stat : effect?.effectType;
            if (!type) return;
            totals[type] += Math.max(1, Number(effect.value) || 1);
        });
    });
    // Immolation (Fire Fighter second talent): all burn this Slime applies is
    // doubled (or tripled with the Greek Fire sub-talent).
    if (hasImmolation(slime)) totals.burn *= getImmolationParams(slime).burnMultiplier;
    // Corrosive Poison (Poison Fighter) "Venom" sub-talent: doubles the poison
    // Stacks this Slime applies (does not affect damage).
    if (hasCorrosivePoison(slime)) totals.poison *= getCorrosivePoisonParams(slime).poisonMultiplier;
    return totals;
}
/** Resolve a Slime path from saved data or its specialized type. */
export function getSlimeSpecialization(slime) {
    return String(slime?.specialization || '').toLowerCase();
}

/**
 * The base elemental type of a Slime (e.g. 'poison' for a 'poisonFighter').
 * Specialized Slimes store their full combo type in `slime.type`, so the base
 * element is whatever prefix survives after dropping the specialization suffix.
 */
export function getSlimeElement(slime) {
    const type = String(slime?.type || '');
    // Specialized Slimes store their full combo type (e.g. 'poisonFighter'); the
    // base element is the leading known prefix. Order matters: check longer
    // prefixes first so 'stone' isn't matched inside 'stoneSupport', etc.
    const ELEMENTS = ['poison', 'fire', 'ice', 'stone'];
    for (const element of ELEMENTS) {
        if (type.indexOf(element) === 0) return element;
    }
    return type;
}

/** Build the element+specialization combo typeId used for second-talent keys. */
function getComboTypeId(slime) {
    const spec = getSlimeSpecialization(slime);
    if (!spec) return '';
    const element = getSlimeElement(slime);
    return `${element}${spec.charAt(0).toUpperCase()}${spec.slice(1)}`;
}

/**
 * Sub-talent definitions for each Specialization's Talent columns.
 * Keyed by specialization, then by Talent column index (0 = dedicated Talent,
 * 1 = Talent2, 2 = Talent3). Each column lists up to 3 selectable sub-talents.
 * The chosen sub-talent index for a Slime is stored on
 * `slime.talents.subTalents[talentIndex]` (or null when unchosen).
 */
/**
 * Second Talent (Talent2) definitions, unique per element+specialization combo.
 * Keyed by the combo typeId (e.g. 'fireSupport'). Each combo has a name and a
 * description used as its tooltip on the Common House and the Slime sheet.
 */
export const SECOND_TALENT = {
    fireSupport: { name: 'Melting Mend', description: 'Graft heals 30% more over 3 seconds. (Stacks)' },
    iceSupport: { name: 'Ice Barrier', description: 'Graft gives 20% of the heal as barrier. (Stacks)' },
    poisonSupport: { name: 'Leech', description: 'Self heal 25% of inflicted direct damages.' },
    stoneSupport: { name: 'Stone Skin', description: 'Graft reduces next direct damage by 50% of the heal. (Stacks)' },
    fireFighter: { name: 'Immolation', description: 'All burn Stacks applied are doubled.' },
    iceFighter: { name: 'Ice Burst', description: 'Cold damage equals the target\'s burn + poison Stacks instead of a flat 5.' },
    poisonFighter: { name: 'Corrosive Poison', description: 'Increase direct damage by the target\'s current poison stacks (%).' },
    stoneFighter: { name: 'Heavy Strike', description: 'Pushback ennemies.' },
    fireTank: { name: 'Spicy Block', description: 'On Block, apply triple Slime\'s burn to the attacker.' },
    iceTank: { name: 'Ice Block', description: 'On death, 20% chance to instead regain 10% HP, but suffer Stun 5.' },
    poisonTank: { name: 'Counter', description: 'Counter Attack on Block and heal for 25% of inflicted damage.' },
    stoneTank: { name: 'Polished Slime', description: 'On Block, apply Slime\'s stun to the attacker. Also reduce all incoming damage by 10%.' }
};

/** Dedicated second-talent button icons (keyed by combo typeId). */
export const SECOND_TALENT_ICON = {
    fireSupport: 'images/talents/supportMeltingMend.png',
    iceSupport: 'images/talents/supportIceBarrier.png',
    poisonSupport: 'images/talents/supportLeech.png',
    stoneSupport: 'images/talents/supportStoneSkin.png',
    fireFighter: 'images/talents/fighterImmolation.png',
    iceFighter: 'images/talents/fighterIceBurst.png',
    poisonFighter: 'images/talents/fighterCorrosivePoison.png',
    stoneFighter: 'images/talents/fighterHeavyStrike.png',
    stoneTank: 'images/talents/tankPolishedStone.png',
    fireTank: 'images/talents/tankSpicyBlock.png',
    iceTank: 'images/talents/tankIceBlock.png',
    poisonTank: 'images/talents/tankCounter.png'
};

/**
 * Sub-talent definitions for the unique second talents (Talent2), keyed by the
 * element+specialization combo typeId (e.g. 'fireSupport'). Each combo lists its
 * 3 selectable sub-talents. The chosen sub-talent index is stored on
 * `slime.talents.subTalents[1]` (see TALENT_SUBTALENTS column 1 convention).
 * Only the Support combos are filled for now; Fighter/Tank combos follow later.
 */
export const SECOND_TALENT_SUBTALENTS = {
    fireSupport: [
        { id: 'slowMend', name: 'Slow Mend', description: 'Increase HOT duration by 3s.' },
        { id: 'strongMend', name: 'Strong Mend', description: '50% HOT instead of 30%.' },
        { id: 'greassySlime', name: 'Greassy Slime', description: '+10% Max HP.' }
    ],
    iceSupport: [
        { id: 'thickIce', name: 'Thick Ice', description: 'Double temporary HP amount.' },
        { id: 'doubleBarrier', name: 'Twin Shields', description: 'Gives a second Ice Barrier to a random tank.' },
        { id: 'greassySlime', name: 'Greassy Slime', description: '+10% Max HP.' }
    ],
    poisonSupport: [
        { id: 'suckerSlime', name: 'Sucker Slime', description: 'Double Leech amount.' },
        { id: 'mindlessSupport', name: 'Mindless Support', description: 'No Graft, but Leech now heals the lowest HP Slime.' },
        { id: 'damageDealer', name: 'Damage Dealer', description: '+10% Damage.' }
    ],
    stoneSupport: [
        { id: 'standardization', name: 'Standardization', description: 'Reduces next damage by 75% regardless of graft amount.' },
        { id: 'emeraldSkin', name: 'Emerald Skin', description: 'Double Stone Skin amount.' },
        { id: 'greassySlime', name: 'Greassy Slime', description: '+10% Max HP.' }
    ],
    iceFighter: [
        { id: 'thermalShock', name: 'Thermal Shock', description: 'Cold damage uses 3x the target\'s burn Stacks instead of burn + poison.' },
        { id: 'paralysis', name: 'Paralysis', description: 'Cold damage uses 3x the target\'s poison Stacks instead of burn + poison.' },
        { id: 'damageDealer', name: 'Damage Dealer', description: '+10% Damage.' }
    ],
    fireFighter: [
        { id: 'greekFire', name: 'Greek Fire', description: 'Apply 3x burn Stacks instead of 2x.' },
        { id: 'oilCombustion', name: 'Oil Combustion', description: 'Transforms poison stacks on the target into burn stacks on hit.' },
        { id: 'damageDealer', name: 'Damage Dealer', description: '+10% Damage.' }
    ],
    poisonFighter: [
        { id: 'acidic', name: 'Acidic', description: 'Damage increased by 20% of the target\'s poison Stacks instead of 10%.' },
        { id: 'oilOnFire', name: 'Oil On Fire', description: 'Damage increased by 10% of poison Stacks + 10% of burn Stacks.' },
        { id: 'venom', name: 'Venom', description: 'No more damage increase, but doubles the poison Stacks applied.' }
    ],
    stoneFighter: [
        { id: 'penetration', name: 'Penetration', description: 'Halves pushback, but +20% Damage.' },
        { id: 'headbutt', name: 'Headbutt', description: 'Removes pushback, but applies double Stun.' },
        { id: 'damageDealer', name: 'Damage Dealer', description: '+10% Damage.' }
    ],
    fireTank: [
        { id: 'blazingShield', name: 'Blazing Shield', description: 'Apply Burn Status x6 instead of x3.' },
        { id: 'cursedShield', name: 'Cursed Shield', description: 'Also apply Poison Status x3.' },
        { id: 'blockMastery', name: 'Block Mastery', description: '+10% Block chance.' }
    ],
    poisonTank: [
        { id: 'doubleDamage', name: 'Double Damage', description: 'Counter attack deals double damage.' },
        { id: 'doubleStatus', name: 'Double Status', description: 'Counter attack applies double status.' },
        { id: 'blockMastery', name: 'Block Mastery', description: '+10% Block chance.' }
    ],
    stoneTank: [
        { id: 'pushback', name: 'Pushback', description: 'Also pushback the Blocked enemy.' },
        { id: 'dazingBlock', name: 'Dazing Block', description: 'Double the applied Stun.' },
        { id: 'blockMastery', name: 'Block Mastery', description: '+10% Block chance.' }
    ],
    iceTank: [
        { id: 'coldBlood', name: 'Cold Blood', description: '+20% chance to Ice Block (additive).' },
        { id: 'iceCure', name: 'Ice Cure', description: 'Regenerate 100% HP over 5s when Ice Block triggers.' },
        { id: 'blockMastery', name: 'Block Mastery', description: '+10% Block chance.' }
    ]
};

export const TALENT_SUBTALENTS = {
    support: [
        [
            { id: 'flashGraft', name: 'Flash Graft', description: 'Graft costs 25% less HP (heal unchanged).' },
            { id: 'megaGraft', name: 'Mega Graft', description: 'Graft cost and heal are doubled.' },
            { id: 'endurance', name: 'Endurance', description: '+10% Max HP, +10% HP Regen.' }
        ],
        [],
        [
            { id: 'lowBurden', name: 'Low Burden', description: 'Resurrection costs 40% HP instead of 80%.' },
            { id: 'reconstitution', name: 'Reconstitution', description: 'Resurrected target returns at full health.' },
            { id: 'abeasCorpus', name: 'Abeas Corpus', description: '+10% Max HP.' }
        ]
    ],
    tank: [
        [
            { id: 'shieldWall', name: 'Shield Wall', description: '+10% Block chance.' },
            { id: 'perfectBlock', name: 'Perfect Block', description: 'When Blocking, heal back to full life.' },
            { id: 'thickSlime', name: 'Thick Slime', description: '+20% Max HP.' }
        ],
        [],
        [
            { id: 'endurance', name: 'Endurance', description: '-10% damage received by Intercepting attacks.' },
            { id: 'avenge', name: 'Avenge', description: 'Apply your status to intercepted attackers.' },
            { id: 'defenseOrchestra', name: 'Defense Orchestra', description: '+10% Block chance (stacks).' }
        ]
    ],
    fighter: [
        [
            { id: 'chaos', name: 'Chaos', description: 'Rebound targets a random enemy.' },
            { id: 'momentum', name: 'Momentum', description: 'Rebound deals +20% damage to its target.' },
            { id: 'training', name: 'Training', description: '+10% Damage, +5% Crit Chance.' }
        ],
        [],
        [
            { id: 'chaos2', name: 'Chaos', description: 'Slide targets a random enemy.' },
            { id: 'cheapShot', name: 'Cheap Shot', description: '+20% Damage to Slide attacks.' },
            { id: 'sharpSlime', name: 'Sharp Slime', description: '+10% Damage.' }
        ]
    ]
};

/** Normalize a Slime's stored sub-talent choices, creating the map if missing. */
export function ensureSlimeSubTalents(slime) {
    if (!slime) return {};
    if (!slime.talents || typeof slime.talents !== 'object') slime.talents = {};
    if (!slime.talents.subTalents || typeof slime.talents.subTalents !== 'object') {
        slime.talents.subTalents = { 0: null, 1: null, 2: null };
    }
    return slime.talents.subTalents;
}

/** Index of the sub-talent chosen for a given Talent column, or null. */
export function getSlimeSubTalent(slime, talentIndex) {
    const subTalents = slime?.talents?.subTalents;
    if (!subTalents) return null;
    const value = subTalents[talentIndex];
    return (typeof value === 'number' || typeof value === 'string') ? Number(value) : null;
}

/**
 * The sub-talent column array for a Talent index. Column 0 (dedicated Talent)
 * and column 2 (third Talent) are keyed by specialization (TALENT_SUBTALENTS).
 * Column 1 (the unique second talent) is keyed by the element+specialization
 * combo typeId (SECOND_TALENT_SUBTALENTS). Returns an empty array when none.
 */
export function getSlimeSubTalentColumn(slime, talentIndex) {
    if (talentIndex === 1) {
        const comboTypeId = getComboTypeId(slime);
        return SECOND_TALENT_SUBTALENTS[comboTypeId] || [];
    }
    const specialization = getSlimeSpecialization(slime);
    return TALENT_SUBTALENTS[specialization]?.[talentIndex] || [];
}

/** The chosen sub-talent definition object for a Talent column, or null. */
export function getSlimeSubTalentDef(slime, talentIndex) {
    const chosen = getSlimeSubTalent(slime, talentIndex);
    if (chosen === null) return null;
    const column = getSlimeSubTalentColumn(slime, talentIndex);
    return column?.[chosen] || null;
}

/** Aggregate percentage bonuses (0-100 scale) granted by chosen sub-talents. */
export function getSlimeSubTalentBonus(slime) {
    const bonus = { maxHpPct: 0, regenPct: 0, damagePct: 0, critPct: 0 };
    const specialization = getSlimeSpecialization(slime);
    if (!specialization) return bonus;
    for (let talentIndex = 0; talentIndex < 3; talentIndex++) {
        const def = getSlimeSubTalentDef(slime, talentIndex);
        if (!def) continue;
        if (def.id === 'endurance') { bonus.maxHpPct += 10; bonus.regenPct += 10; }
        if (def.id === 'training') { bonus.damagePct += 10; bonus.critPct += 5; }
        if (def.id === 'thickSlime') { bonus.maxHpPct += 20; }
        if (def.id === 'greassySlime') { bonus.maxHpPct += 10; }
        if (def.id === 'damageDealer') { bonus.damagePct += 10; }
        if (def.id === 'sharpSlime') { bonus.damagePct += 10; }
        if (def.id === 'abeasCorpus') { bonus.maxHpPct += 10; }
    }
    return bonus;
}

/** Graft multipliers from chosen Support sub-talents: { cost, heal }. */
export function getSlimeGraftMultipliers(slime) {
    const def = getSlimeSubTalentDef(slime, 0);
    if (!def) return { cost: 1, heal: 1 };
    if (def.id === 'flashGraft') return { cost: 0.75, heal: 1 };
    if (def.id === 'megaGraft') return { cost: 2, heal: 2 };
    return { cost: 1, heal: 1 };
}

/** Whether a Slime owns the Melting Mend second talent (Fire Support). */
export function hasMeltingMend(slime) {
    if (!slime) return false;
    if (slime.talents?.meltingMend) return true;
    // Ownership is stored under the per-combo second talent flag (e.g. fireSupportTalent2),
    // which hasSecondTalent reads. It must NOT require the separate Graft first talent.
    // The combo typeId is derived from the slime's element (type) + capitalized specialization
    // (e.g. type 'fire' + spec 'support' => 'fireSupport'), NOT the raw slime.type.
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'fireSupport' && hasSecondTalent(slime);
}

/**
 * Melting Mend HOT (Heal on Time) parameters for a Fire Support slime, adjusted
 * by its chosen second-talent sub-talent (column 1). The base graft grants a HOT
 * of 5% of the intended healing per 0.5s tick over 3s (6 ticks = 30% total).
 *  - slowMend:      duration +3s (6s total instead of 3s).
 *  - strongMend:    50% total HOT instead of 30% (tick fraction scales up).
 *  - greassySlime:  +10% Max HP (handled by getSlimeSubTalentBonus, not here).
 * Returns { perTickFraction, duration }.
 */
export function getMeltingMendHotParams(slime) {
    const base = { perTickFraction: 0.05, duration: 3.0 };
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return base;
    if (def.id === 'slowMend') return { perTickFraction: 0.05, duration: 6.0 };
    if (def.id === 'strongMend') return { perTickFraction: 0.05 * (50 / 30), duration: 3.0 };
    return base;
}

/**
 * Ice Barrier parameters for an Ice Support slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base graft grants a temporary-HP
 * pool equal to 20% of the intended healing (capped at 60% of the target's Max
 * HP).
 *  - thickIce:      doubles the temporary HP amount (40% instead of 20%).
 *  - doubleBarrier: also grants a second barrier (same amount) to a random tank.
 *  - greassySlime:  +10% Max HP (handled by getSlimeSubTalentBonus, not here).
 * Returns { bonusMultiplier, extraBarrierToRandomTank }.
 */
export function getIceBarrierParams(slime) {
    const base = { bonusMultiplier: 0.20, extraBarrierToRandomTank: false };
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return base;
    if (def.id === 'thickIce') return { bonusMultiplier: 0.40, extraBarrierToRandomTank: false };
    if (def.id === 'doubleBarrier') return { bonusMultiplier: 0.20, extraBarrierToRandomTank: true };
    return base;
}

/** Whether a Slime owns the Ice Barrier second talent (Ice Support). */
export function hasIceBarrier(slime) {
    if (!slime) return false;
    if (slime.talents?.iceBarrier) return true;
    // Same combo flag convention as Melting Mend: element + capitalized specialization.
    // type 'ice' + spec 'support' => 'iceSupport'.
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'iceSupport' && hasSecondTalent(slime);
}

/** Whether a Slime owns the Stone Skin second talent (Stone Support). */
export function hasStoneSkin(slime) {
    if (!slime) return false;
    if (slime.talents?.stoneSkin) return true;
    // Same combo flag convention as the other second talents: element + capitalized specialization.
    // type 'stone' + spec 'support' => 'stoneSupport'.
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'stoneSupport' && hasSecondTalent(slime);
}

/** Whether a Slime owns the Leech second talent (Poison Support). */
export function hasLeech(slime) {
    if (!slime) return false;
    if (slime.talents?.leech) return true;
    // Same combo flag convention as the other second talents: element + capitalized specialization.
    // type 'poison' + spec 'support' => 'poisonSupport'.
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'poisonSupport' && hasSecondTalent(slime);
}

/**
 * Leech parameters for a Poison Support slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base leech heals the slime for 25%
 * of the direct damage it inflicts (main hit + freeze bonus).
 *  - suckerSlime:     doubles the leech amount (50% instead of 25%).
 *  - mindlessSupport: leech heals the lowest-HP ally instead of the slime itself.
 *  - damageDealer:    +10% Damage (handled by getSlimeSubTalentBonus, not here).
 * Returns { multiplier, healLowestAlly }.
 */
export function getLeechParams(slime) {
    const base = { multiplier: 0.25, healLowestAlly: false };
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return base;
    if (def.id === 'suckerSlime') return { multiplier: 0.50, healLowestAlly: false };
    if (def.id === 'mindlessSupport') return { multiplier: 0.25, healLowestAlly: true };
    return base;
}

/** Whether a Leech Poison Support has the mindlessSupport sub-talent (no Graft). */
export function isMindlessSupport(slime) {
    if (!hasLeech(slime)) return false;
    return getSlimeSubTalentDef(slime, 1)?.id === 'mindlessSupport';
}

/**
 * Stone Skin parameters for a Stone Support slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base graft grants a flat "reduction"
 * pool equal to 50% of the heal, applied to the next direct hit.
 *  - emeraldSkin:     doubles the reduction pool (100% of the heal).
 *  - standardization: instead grants a 75% damage reduction on the next direct
 *                      hit, independent of the graft/heal amount.
 *  - greassySlime:     +10% Max HP (handled by getSlimeSubTalentBonus, not here).
 * Returns { mode: 'flat' | 'pct', flatMultiplier, pct }.
 */
export function getStoneSkinParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { mode: 'flat', flatMultiplier: 0.50, pct: 0 };
    if (def.id === 'emeraldSkin') return { mode: 'flat', flatMultiplier: 1.0, pct: 0 };
    if (def.id === 'standardization') return { mode: 'pct', flatMultiplier: 0, pct: 0.75 };
    return { mode: 'flat', flatMultiplier: 0.50, pct: 0 };
}

/** Whether a Slime owns the Immolation second talent (Fire Fighter). */
export function hasImmolation(slime) {
    if (!slime) return false;
    // Same combo flag convention as the other second talents: element + capitalized specialization.
    // type 'fire' + spec 'fighter' => 'fireFighter'.
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'fireFighter' && hasSecondTalent(slime);
}

/**
 * Immolation parameters for a Fire Fighter slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base Immolation doubles all burn
 * Stacks this Slime applies.
 *  - greekFire:     triples the burn Stacks instead of doubling (3x).
 *  - oilCombustion: on hit, converts the target's poison Stacks into burn
 *                   Stacks (added to the burn applied this hit).
 *  - damageDealer:  +10% Damage (handled by getSlimeSubTalentBonus, not here).
 * Returns { burnMultiplier, convertPoisonToBurn }.
 */
export function getImmolationParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { burnMultiplier: 2, convertPoisonToBurn: false };
    if (def.id === 'greekFire') return { burnMultiplier: 3, convertPoisonToBurn: false };
    if (def.id === 'oilCombustion') return { burnMultiplier: 2, convertPoisonToBurn: true };
    return { burnMultiplier: 2, convertPoisonToBurn: false };
}

/** Whether a Slime owns the Ice Burst second talent (Ice Fighter). */
export function hasIceBurst(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'iceFighter' && hasSecondTalent(slime);
}

/**
 * Ice Burst parameters for an Ice Fighter slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base Ice Burst deals cold damage
 * equal to the target's burn + poison Stacks (per hitEffects.freeze stacks).
 *  - thermalShock: cold damage uses 3x the target's burn Stacks instead.
 *  - paralysis:    cold damage uses 3x the target's poison Stacks instead.
 *  - damageDealer: +10% Damage (handled by getSlimeSubTalentBonus, not here).
 * Returns { mode: 'sum' | 'burn' | 'poison', multiplier }.
 */
export function getIceBurstParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { mode: 'sum', multiplier: 1 };
    if (def.id === 'thermalShock') return { mode: 'burn', multiplier: 3 };
    if (def.id === 'paralysis') return { mode: 'poison', multiplier: 3 };
    return { mode: 'sum', multiplier: 1 };
}

/** Whether a Slime owns the Corrosive Poison second talent (Poison Fighter). */
export function hasCorrosivePoison(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'poisonFighter' && hasSecondTalent(slime);
}

/**
 * Corrosive Poison parameters for a Poison Fighter slime, adjusted by its chosen
 * second-talent sub-talent (column 1). Direct damage is boosted by a fraction of
 * the target's stacks as a percentage (poisonPct / burnPct are fractions, e.g.
 * 0.10 => 10% of the stacks). Base: 10% of poison stacks (50 poison => +5%).
 *  - acidic:    20% of poison stacks instead of 10%.
 *  - oilOnFire: 10% of poison stacks + 10% of burn stacks.
 *  - venom:     doesn't boost damage, but doubles the poison Stacks this Slime applies.
 * Returns { poisonPct, burnPct, poisonMultiplier }.
 */
export function getCorrosivePoisonParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { poisonPct: 0.10, burnPct: 0, poisonMultiplier: 1 };
    if (def.id === 'acidic') return { poisonPct: 0.20, burnPct: 0, poisonMultiplier: 1 };
    if (def.id === 'oilOnFire') return { poisonPct: 0.10, burnPct: 0.10, poisonMultiplier: 1 };
    if (def.id === 'venom') return { poisonPct: 0, burnPct: 0, poisonMultiplier: 2 };
    return { poisonPct: 0.10, burnPct: 0, poisonMultiplier: 1 };
}

/** Whether a Slime owns the Heavy Strike second talent (Stone Fighter). */
export function hasHeavyStrike(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'stoneFighter' && hasSecondTalent(slime);
}

/**
 * Heavy Strike parameters for a Stone Fighter slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base Heavy Strike knocks the target
 * back 10px to re-engage its walking state.
 *  - penetration: halves the pushback distance (5px) but +20% Damage.
 *  - headbutt:    removes pushback entirely, but doubles the Stun applied on hit.
 *  - damageDealer: +10% Damage (handled by getSlimeSubTalentBonus, not here).
 * Returns { pushbackPx, damagePct, stunMultiplier }.
 */
export function getHeavyStrikeParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { pushbackPx: 6, damagePct: 0, stunMultiplier: 1 };
    if (def.id === 'penetration') return { pushbackPx: 3, damagePct: 20, stunMultiplier: 1 };
    if (def.id === 'headbutt') return { pushbackPx: 0, damagePct: 0, stunMultiplier: 2 };
    return { pushbackPx: 10, damagePct: 0, stunMultiplier: 1 };
}

/** Whether a Slime owns the Polished Slime second talent (Stone Tank). */
export function hasPolishedSlime(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'stoneTank' && hasSecondTalent(slime);
}

/**
 * Polished Slime parameters for a Stone Tank slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The (nerfed) base Polished Slime reflects
 * the Slime's stun Status onto the attacker once.
 *  - pushback:     also knocks the Blocked enemy back 10px.
 *  - dazingBlock:  doubles the reflected Stun (stunMultiplier 2).
 *  - blockMastery: +10% Block chance (handled by getBlockChanceBonus, not here).
 * Returns { stunMultiplier, pushbackPx }.
 */
export function getPolishedSlimeParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { stunMultiplier: 1, pushbackPx: 0 };
    if (def.id === 'pushback') return { stunMultiplier: 1, pushbackPx: 10 };
    if (def.id === 'dazingBlock') return { stunMultiplier: 2, pushbackPx: 0 };
    return { stunMultiplier: 1, pushbackPx: 0 };
}

/** Whether a Slime owns the Spicy Block second talent (Fire Tank). */
export function hasSpicyBlock(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'fireTank' && hasSecondTalent(slime);
}

/**
 * Spicy Block parameters for a Fire Tank slime, adjusted by its chosen
 * second-talent sub-talent (column 1). The base Spicy Block reflects the Slime's
 * burn Status onto the attacker 3 times (triple burn Stacks).
 *  - blazingShield: applies burn 6 times instead of 3 (hexuple burn Stacks).
 *  - cursedShield:  also reflects the Slime's poison Status 3 times.
 *  - blockMastery:  +10% Block chance (handled by getBlockChanceBonus, not here).
 * Returns { burnApplications, applyPoison }.
 */
export function getSpicyBlockParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { burnApplications: 3, applyPoison: false };
    if (def.id === 'blazingShield') return { burnApplications: 6, applyPoison: false };
    if (def.id === 'cursedShield') return { burnApplications: 3, applyPoison: true };
    return { burnApplications: 3, applyPoison: false };
}

/**
 * Extra Block chance (0-1 scale) granted by Tank sub-talents, added on top of the
 * base 10% (or 20% with the Shield Wall column-0 sub-talent). Stacks additively:
 * Shield Wall (+10%) and the "Block Mastery" second-talent sub-talent (+10%,
 * available on Spicy Block / Counter) both contribute.
 */
export function getBlockChanceBonus(slime) {
    let bonus = 0;
    if (getSlimeSubTalentDef(slime, 0)?.id === 'shieldWall') bonus += 0.10;
    if (getSlimeSubTalentDef(slime, 1)?.id === 'blockMastery') bonus += 0.10;
    if (getSlimeSubTalentDef(slime, 2)?.id === 'defenseOrchestra') bonus += 0.10;
    return bonus;
}

/** Whether a Slime owns the Ice Block second talent (Ice Tank). */
export function hasIceBlock(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'iceTank' && hasSecondTalent(slime);
}

/**
 * Ice Block parameters for an Ice Tank slime, adjusted by its chosen second-talent
 * sub-talent (column 1). The base Ice Block rolls a 20% chance (see
 * ICE_BLOCK_BASE_CHANCE) to survive a lethal blow at 10% HP.
 *  - coldBlood: +20% Ice Block chance (additive, up to 40% with the base 20%).
 *  - iceCure:    when Ice Block triggers, regenerate 100% of Max HP over 5s
 *                (10% per 0.5s tick) via the Heal-on-Time system.
 *  - blockMastery: +10% Block chance (handled by getBlockChanceBonus, not here).
 * Returns { chanceBonus }.
 */
export function getIceBlockParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { chanceBonus: 0 };
    if (def.id === 'coldBlood') return { chanceBonus: 0.20 };
    return { chanceBonus: 0 };
}

/** Whether a Slime owns the Counter second talent (Poison Tank). */
export function hasCounter(slime) {
    if (!slime) return false;
    const spec = getSlimeSpecialization(slime);
    const comboTypeId = getComboTypeId(slime);
    return comboTypeId === 'poisonTank' && hasSecondTalent(slime);
}

/**
 * Counter parameters for a Poison Tank slime, adjusted by its chosen second-talent
 * sub-talent (column 1). The base Counter strikes back for 25% of the Slime's
 * damage and applies its on-hit status effects once.
 *  - doubleDamage: the Counter attack deals double damage.
 *  - doubleStatus: the Counter attack applies its status effects twice.
 *  - blockMastery: +10% Block chance (handled by getBlockChanceBonus, not here).
 * Returns { damageMultiplier, statusApplications }.
 */
export function getCounterParams(slime) {
    const def = getSlimeSubTalentDef(slime, 1);
    if (!def) return { damageMultiplier: 1, statusApplications: 1 };
    if (def.id === 'doubleDamage') return { damageMultiplier: 2, statusApplications: 1 };
    if (def.id === 'doubleStatus') return { damageMultiplier: 1, statusApplications: 2 };
    return { damageMultiplier: 1, statusApplications: 1 };
}

/** Whether a Slime owns the Resurrection third talent (Support, all elements). */
export function hasResurrection(slime) {
    if (!slime) return false;
    if ((gameState.newGamePlusCompletions || 0) <= 0) return false;
    if (getSlimeSpecialization(slime) !== 'support') return false;
    return Boolean(slime.talents?.resurrection);
}

/**
 * Resurrection (Support third talent) parameters, adjusted by its chosen third-talent
 * sub-talent (column 2). The base Resurrection sacrifices 80% of the Support's HP
 * and revives a dead Slime with half of that sacrificed HP.
 *  - lowBurden:      sacrifice cost is 40% of Max HP instead of 80% (revived HP is
 *                    still half of the sacrificed HP).
 *  - reconstitution:  the revived Slime returns at full health instead of half.
 *  - abeasCorpus:    +10% Max HP (handled by getSlimeSubTalentBonus, not here).
 * Returns { sacrificePct, fullHealthOnRevive }.
 */
export function getResurrectionParams(slime) {
    const def = getSlimeSubTalentDef(slime, 2);
    if (!def) return { sacrificePct: 0.80, fullHealthOnRevive: false };
    if (def.id === 'lowBurden') return { sacrificePct: 0.40, fullHealthOnRevive: false };
    if (def.id === 'reconstitution') return { sacrificePct: 0.80, fullHealthOnRevive: true };
    return { sacrificePct: 0.80, fullHealthOnRevive: false };
}

/**
 * At the end of a Wave, each Support with the Resurrection talent and more than
 * 80% of its life remaining may sacrifice 80% of its HP to bring one random dead
 * Slime back to life with half of the sacrificed HP.
 *
 * Dead Slimes live on in gameState.bestRoster even after they are removed from
 * the active army (gameState.slimes) at death time. We revive one of those
 * absent blueprints back into the active roster. Returns the revived Slime
 * objects (or an empty array when nothing happened).
 */
export function processWaveEndResurrections() {
    const revived = [];
    const resurrectors = [];
    if (!gameState.slimes || !gameState.bestRoster) return { revived, resurrectors };

    const activeIds = new Set(gameState.slimes.map(s => String(s.id || s.name)));
    const deadSlimes = gameState.bestRoster.filter(s => !activeIds.has(String(s.id || s.name)));

    if (deadSlimes.length === 0) return { revived, resurrectors };

    const eligibleResurrectors = gameState.slimes.filter(s => hasResurrection(s) && s.hp > s.maxHp * 0.8);
    for (const resurrector of eligibleResurrectors) {
        const stillDead = gameState.bestRoster.filter(s => !activeIds.has(String(s.id || s.name)));
        if (stillDead.length === 0) break;

        const resurrectParams = getResurrectionParams(resurrector);
        const chosen = stillDead[Math.floor(Math.random() * stillDead.length)];
        const targetMaxHp = chosen.maxHp || 10;
        const sacrificedHp = Math.ceil(resurrector.maxHp * resurrectParams.sacrificePct);
        const reviveHp = resurrectParams.fullHealthOnRevive
            ? targetMaxHp
            : Math.round(sacrificedHp / 2);
        resurrector.hp = Math.max(1, resurrector.hp - sacrificedHp);

        const revivedSlime = {
            id: chosen.id || chosen.name,
            name: chosen.name || String(chosen.id),
            type: chosen.type || 'base',
            hp: reviveHp,
            maxHp: chosen.maxHp || 10,
            baseMaxHp: chosen.baseMaxHp ?? chosen.maxHp ?? 10,
            damage: calculateSlimeDamage(chosen),
            critChance: chosen.critChance || 0,
            regen: chosen.regen || 0,
            ascended: !!chosen.ascended,
            specialization: getSlimeSpecialization(chosen),
            talents: chosen.talents ? JSON.parse(JSON.stringify(chosen.talents)) : {},
            slotIndex: chosen.slotIndex !== undefined ? chosen.slotIndex : getNextAvailableSlotIndex(),
            equipment: chosen.equipment ? JSON.parse(JSON.stringify(chosen.equipment)) : []
        };

        gameState.slimes.push(revivedSlime);
        activeIds.add(String(revivedSlime.id || revivedSlime.name));
        revived.push(revivedSlime);
        resurrectors.push(resurrector);
    }

    gameState.armySize = gameState.slimes.length;
    saveStateToLocal();
    return { revived, resurrectors };
}

/** Whether a Slime owns the Slide third talent (Fighter, all elements). */
export function hasSlide(slime) {
    if (!slime) return false;
    if ((gameState.newGamePlusCompletions || 0) <= 0) return false;
    if (getSlimeSpecialization(slime) !== 'fighter') return false;
    return Boolean(slime.talents?.slide);
}

/**
 * Slide (Fighter third talent) parameters, adjusted by its chosen third-talent
 * sub-talent (column 2). Base Slide dashes to the furthest enemy.
 *  - chaos2:      Slide targets a random valid enemy instead of the furthest.
 *  - cheapShot:   the Slide hit deals +20% damage.
 *  - sharpSlime:  +10% Base Damage (handled by getSlimeSubTalentBonus, not here).
 * Returns { randomTarget, slideDamagePct }.
 */
export function getSlideParams(slime) {
    const def = getSlimeSubTalentDef(slime, 2);
    if (!def) return { randomTarget: false, slideDamagePct: 0 };
    if (def.id === 'chaos2') return { randomTarget: true, slideDamagePct: 0 };
    if (def.id === 'cheapShot') return { randomTarget: false, slideDamagePct: 20 };
    return { randomTarget: false, slideDamagePct: 0 };
}

/** Per-combo flag key used to store ownership of a Slime's second talent. */
export function getSecondTalentFlag(typeId) {
    if (!SECOND_TALENT[typeId]) return null;
    return `${typeId}Talent2`;
}

/** Whether a Slime already owns the first Talent of its specialization. */
const FIRST_TALENT_FLAG = { support: 'graft', fighter: 'rebound', tank: 'block' };

/**
 * Third Talent definitions, shared by every element of a specialization.
 * `flag` is the ownership key stored on `slime.talents`; Tank's is not
 * implemented yet and is therefore absent from the map.
 */
export const THIRD_TALENT = {
    support: {
        flag: 'resurrection',
        name: 'Resurrection',
        icon: 'images/talents/supportResurection.png',
        shortDescription: 'At the end of a Wave, resurect a Slime at the cost of 80% HP.',
        description: 'At the end of a Wave, if another Slime is dead and this Support has more than 80% HP, it loses 80% of its HP to Resurrect one dead Slime at random (revived at half the sacrificed HP).'
    },
    fighter: {
        flag: 'slide',
        name: 'Slide',
        icon: 'images/talents/fighterSlide.png',
        shortDescription: '50% chance to Slide to attack the furthest ennemy after an attack.',
        description: '50% chance to Slide to the furthest ennemy after an attack and strike it. Slide and Rebound cannot trigger twice in a row, but they can chain into each other.'
    },
    tank: {
        flag: 'interception',
        name: 'Interception',
        icon: 'images/talents/tankInterception.png',
        shortDescription: 'Intercept attacks targeting Tanks under 50% HP.',
        description: 'When another Tank under 50% HP would take damage, this Tank intercepts the hit and takes it instead, as long as it has more than 50% HP.'
    }
};

/** Whether a Slime owns the Interception third talent (Tank, all elements). */
export function hasInterception(slime) {
    if (!slime) return false;
    if ((gameState.newGamePlusCompletions || 0) <= 0) return false;
    if (getSlimeSpecialization(slime) !== 'tank') return false;
    return Boolean(slime.talents?.interception);
}

/**
 * Interception (Tank third talent) parameters, adjusted by its chosen third-talent
 * sub-talent (column 2). The base Interception redirects a wounded Tank's hit to a
 * healthy Interception-owning Tank.
 *  - endurance:         the intercepting Slime takes 10% less damage from the
 *                       intercepted attack.
 *  - avenge:            the intercepting Slime applies its own status effects
 *                       (burn/poison/freeze/stun) to the attacker.
 *  - defenseOrchestra:  +10% Block chance (handled by getBlockChanceBonus, not here).
 * Returns { damageReduction, applyStatus }.
 */
export function getInterceptionParams(slime) {
    const def = getSlimeSubTalentDef(slime, 2);
    if (!def) return { damageReduction: 0, applyStatus: false };
    if (def.id === 'endurance') return { damageReduction: 0.10, applyStatus: false };
    if (def.id === 'avenge') return { damageReduction: 0, applyStatus: true };
    return { damageReduction: 0, applyStatus: false };
}

/**
 * Interception (Tank third talent): when a Tank drops under 50% HP, another Tank
 * owning Interception and holding more than 50% HP takes the hit in its place.
 * Returns the interceptor Slime, or null when nobody intercepts.
 */
export function findInterceptorFor(slime) {
    if (!slime || slime.hp <= 0) return null;
    if (getSlimeSpecialization(slime) !== 'tank') return null;
    // Only Tanks already under half of their maximum HP are protected.
    const maxHp = Math.max(1, Number(slime.maxHp || 1));
    if (slime.hp >= maxHp * 0.5) return null;
    const candidates = (gameState.slimes || []).filter(candidate => {
        if (!candidate || candidate === slime) return false;
        if (String(candidate.id) === String(slime.id)) return false;
        if (candidate.hp <= 0) return false;
        if (!hasInterception(candidate)) return false;
        // The interceptor must stay healthy enough to soak the hit.
        return candidate.hp > Math.max(1, Number(candidate.maxHp || 1)) * 0.5;
    });
    if (!candidates.length) return null;
    // Pick the healthiest interceptor so the damage lands on the sturdiest Tank.
    return candidates.reduce((best, current) => (current.hp > best.hp ? current : best), candidates[0]);
}

/** The third Talent definition for a Slime's specialization, or null. */
export function getThirdTalentDef(slimeOrSpec) {
    const spec = typeof slimeOrSpec === 'string' ? slimeOrSpec : getSlimeSpecialization(slimeOrSpec);
    return THIRD_TALENT[spec] || null;
}

/** Whether a Slime owns the third Talent of its specialization. */
export function hasThirdTalent(slime) {
    if (!slime) return false;
    const def = getThirdTalentDef(slime);
    return Boolean(def && slime.talents?.[def.flag]);
}

export function hasFirstTalent(slime) {
    const spec = getSlimeSpecialization(slime);
    const flag = FIRST_TALENT_FLAG[spec];
    return Boolean(flag && slime.talents?.[flag]);
}

/** Whether a Slime owns the second talent of its element+specialization combo. */
export function hasSecondTalent(slime) {
    if (!slime) return false;
    const comboTypeId = getComboTypeId(slime);
    const flag = getSecondTalentFlag(comboTypeId);
    return Boolean(flag && slime.talents?.[flag]);
}

/** Whether a Slime can purchase its next specialization talent (enough XP, not already bought). */
export function canSlimeBuyNextTalent(slime) {
    if ((gameState.newGamePlusCompletions || 0) <= 0) return false;
    const specialization = getSlimeSpecialization(slime);
    if (!['support', 'tank', 'fighter'].includes(specialization)) return false;
    if (Number(gameState.villageCoins || 0) < 1) return false;
    if (specialization === 'support' && slime?.talents?.graft) return false;
    if (specialization === 'tank' && slime?.talents?.block) return false;
    if (specialization === 'fighter' && slime?.talents?.rebound) return false;
    return true;
}

/** Returns the appropriate jump sheet for a Slime's elemental type and specialization. */
/** Death sheets remain elemental; specializations only alter jump sheets. */
export function getSlimeDeathSprite(slime) {
    const slimeData = typeof slime === 'string' ? { type: slime } : (slime || {});
    const config = SLIME_TYPES[slimeData.type] || SLIME_TYPES.base;
    return `${config.folder}/die.png`;
}
export function getSlimeJumpSprite(slime) {
    const slimeData = typeof slime === 'string' ? { type: slime } : (slime || {});
    const config = SLIME_TYPES[slimeData.type] || SLIME_TYPES.base;
    const specialization = getSlimeSpecialization(slimeData);
    const suffix = specialization === 'tank' ? 'tank' : specialization === 'fighter' ? 'fighter' : specialization === 'support' ? 'support' : '';
    return `${config.folder}/jump${suffix}.png`;
}
export function getSlimeMaxHp(slime) {
    const baseMaxHp = Math.max(1, Number(slime?.baseMaxHp ?? slime?.maxHp ?? 10));
    const subPct = getSlimeSubTalentBonus(slime).maxHpPct;
    const raw = baseMaxHp * (1 + subPct / 100);
    return getSlimeSpecialization(slime) === 'tank' ? Math.round(raw * 1.2) : Math.round(raw);
}

/** Refresh derived Tank HP while preserving any newly gained maximum HP as current HP. */
export function refreshSlimeMaxHp(slime) {
    if (!slime) return 10;
    const previousMaxHp = Math.max(1, Number(slime.maxHp || 10));
    if (slime.baseMaxHp === undefined) {
        // Legacy saves lack baseMaxHp; if the maxHp already includes the Tank
        // multiplier, reverse it so getSlimeMaxHp does not apply it twice.
        slime.baseMaxHp = getSlimeSpecialization(slime) === 'tank'
            ? Math.max(1, Math.round(previousMaxHp / 1.2))
            : previousMaxHp;
    }
    const nextMaxHp = getSlimeMaxHp(slime);
    slime.maxHp = nextMaxHp;
    if (slime.hp === undefined) slime.hp = nextMaxHp;
    else slime.hp = Math.min(nextMaxHp, Math.max(0, slime.hp + Math.max(0, nextMaxHp - previousMaxHp)));
    return nextMaxHp;
}

/** Total bonus granted by a Slime's equipped items for one stat (quality-scaled). */
export function getSlimeEquipmentStatBonus(slime, stat) {
    return (slime?.equipment || []).reduce((total, item) => {
        getScaledEquipmentEffects(item).forEach(effect => {
            if (effect?.stat === stat) total += Math.max(1, Number(effect.value) || 1);
        });
        return total;
    }, 0);
}

/** Total HP bonus granted by a Slime's equipped items (quality-scaled). */
export function getSlimeEquipmentHpBonus(slime) {
    return getSlimeEquipmentStatBonus(slime, 'hp');
}

/**
 * Recompute a Slime's maximum HP from the full formula:
 * base (10) + Alchemist Endurance + Fortification + equipped HP bonuses.
 * Used when loading a save to repair drifted/inflated HP.
 */
export function recalculateSlimeMaxHp(slime) {
    if (!slime) return 10;
    const baseHp = 10 + (gameState.alchemistEnduranceLevel || 0) + (gameState.fortificationLevel || 0);
    slime.baseMaxHp = Math.max(1, baseHp + getSlimeEquipmentHpBonus(slime));
    return refreshSlimeMaxHp(slime);
}

/**
 * Recompute every derived stat on the character sheet from its full formula:
 * base + global upgrades + Alchemist bonuses + equipped bonuses.
 * Used when loading a save to repair drifted/inflated stats.
 */
export function recalculateSlimeStats(slime) {
    if (!slime) return;
    recalculateSlimeMaxHp(slime);
    slime.critChance = Math.max(0, getBaseCritChance() + getSlimeEquipmentStatBonus(slime, 'crit') + getSlimeSubTalentBonus(slime).critPct);
    slime.regen = Math.max(0, (gameState.alchemistRegenLevel || 0) + getSlimeEquipmentStatBonus(slime, 'regen'));
    refreshSlimeDamage(slime);
}

/** Base crit chance from Alchemist luck + Precision upgrade. */
export function getBaseCritChance() {
    return (gameState.alchemistLuckLevel || 0) + (gameState.precisionLevel || 0);
}

/** Total per-wave regeneration, including the global upgrade and Support bonus. */
export function getSlimeTotalRegen(slime) {
    const total = (gameState.slimeRegen || 0) + (slime?.regen || 0);
    const subPct = getSlimeSubTalentBonus(slime).regenPct;
    const adjusted = total * (1 + subPct / 100);
    return getSlimeSpecialization(slime) === 'support' ? Math.round(adjusted * 1.2) : Math.round(adjusted);
}
/** Reassign persistent roster slots by battlefield role while preserving order within each role. */
export function sortRosterBySpecialization() {
    const active = gameState.slimes || [];
    const best = gameState.bestRoster || [];
    const entries = new Map();
    [...active, ...best].forEach(slime => {
        if (!slime) return;
        const key = String(slime.id || slime.name);
        if (!entries.has(key)) entries.set(key, slime);
    });
    // Element display order: Base > Fire > Ice > Poison > Stone.
    const elementOrder = { '': 0, base: 0, fire: 1, ice: 2, poison: 3, stone: 4 };
    const elementOf = (slime) => {
        const m = String(slime?.type || 'base').match(/^(poison|fire|ice|stone)/);
        return m ? m[1] : 'base';
    };
    // Roster follows battlefield direction: back line on the left, then middle, then front line on the right.
    const priority = { support: 0, fighter: 1, tank: 2 };
    const ordered = [...entries.values()].sort((a, b) => {
        const aElement = elementOrder[elementOf(a)] ?? 0;
        const bElement = elementOrder[elementOf(b)] ?? 0;
        if (aElement !== bElement) return aElement - bElement;
        const aPriority = priority[getSlimeSpecialization(a)] ?? 1;
        const bPriority = priority[getSlimeSpecialization(b)] ?? 1;
        return aPriority - bPriority || (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
    });
    ordered.forEach((slime, index) => {
        const key = String(slime.id || slime.name);
        const activeSlime = active.find(candidate => String(candidate.id || candidate.name) === key);
        const savedSlime = best.find(candidate => String(candidate.id || candidate.name) === key);
        if (activeSlime) activeSlime.slotIndex = index;
        if (savedSlime) savedSlime.slotIndex = index;
    });
}
/** Damage is always Augmentation's displayed value plus equipped damage bonuses. */
export function calculateSlimeDamage(slime) {
    const equipmentDamage = (slime?.equipment || []).reduce((total, item) => (
        total + getScaledEquipmentEffects(item).reduce((sum, effect) => (
            effect?.stat === 'damage' ? sum + (Number(effect.value) || 0) : sum
        ), 0)
    ), 0);
    const subPct = getSlimeSubTalentBonus(slime).damagePct;
    const totalDamage = (gameState.slimeDamage || 1) + (gameState.alchemistRageLevel || 0) + equipmentDamage;
    const withSub = totalDamage * (1 + subPct / 100);
    return Math.max(1, Math.round(withSub * (getSlimeSpecialization(slime) === 'fighter' ? 1.2 : 1)));
}

export function refreshSlimeDamage(slime) {
    if (slime) slime.damage = calculateSlimeDamage(slime);
    return slime?.damage || getSlimeDamage();
}

export function refreshAllSlimeDamage() {
    (gameState.slimes || []).forEach(refreshSlimeDamage);
    (gameState.bestRoster || []).forEach(refreshSlimeDamage);
}
/**
 * Ensures gameState.slimes contains array of slimes with unique slotIndex values
 */
export function syncSlimesArray() {
    if (!gameState.slimes) {
        gameState.slimes = [];
        gameState.armySize = 0;
        return;
    }
    if (gameState.slimes.length === 0) {
        gameState.armySize = 0;
        return;
    }
    const usedSlots = new Set();
    gameState.slimes.forEach((s) => {
        if (!s.name || s.name === 'Base Slime' || s.name === 'Fire Slime' || s.name === 'Ice Slime' || s.name === 'Stone Slime' || s.name === 'Toxic Slime' || s.name === 'Poison Slime') {
            s.name = generateUniqueSlimeName();
        }
        if (!s.id) s.id = s.name;
        if (!s.specialization && SLIME_TYPES[s.type]?.specialization) s.specialization = String(SLIME_TYPES[s.type].specialization).toLowerCase();
        refreshSlimeMaxHp(s);
        s.damage = calculateSlimeDamage(s);
        if (s.critChance === undefined) s.critChance = 0;
        if (s.regen === undefined) s.regen = 0;

        if (s.slotIndex === undefined || s.slotIndex === null || usedSlots.has(s.slotIndex)) {
            let nextSlot = 0;
            while (usedSlots.has(nextSlot)) nextSlot++;
            s.slotIndex = nextSlot;
        }
        usedSlots.add(s.slotIndex);
    });
    gameState.armySize = gameState.slimes.length;
    sortRosterBySpecialization();
}

/**
 * Get current cost for adding 1 slime to the army (4 + CurrentSlimes)
 */
export function getArmySizeUpgradeCost() {
    const currentSlimes = (gameState.slimes && gameState.slimes.length) ? gameState.slimes.length : (gameState.armySize || 1);
    return clampUpgradeCost(2 + currentSlimes);
}

/**
 * Finds the lowest available/vacant slotIndex (0, 1, 2, 3...) in order
 */
export function getNextAvailableSlotIndex() {
    syncSlimesArray();

    // Historical roster slots are reserved too, so a new Division can never replace a fallen Slime.
    const usedSlots = new Set();
    (gameState.slimes || []).forEach(slime => {
        if (slime.slotIndex !== undefined && slime.slotIndex !== null) usedSlots.add(slime.slotIndex);
    });
    (gameState.bestRoster || []).forEach(slime => {
        if (slime.slotIndex !== undefined && slime.slotIndex !== null) usedSlots.add(slime.slotIndex);
    });

    let slot = 0;
    while (usedSlots.has(slot)) slot++;
    return slot;
}
/**
 * Helper to calculate random Slime Type based on elemental upgrade levels
 */
export function getRandomSlimeType() {
    const ignitionChance = (gameState.ignitionLevel || 0) * 0.02;
    const glaciationChance = (gameState.glaciationLevel || 0) * 0.02;
    const petrificationChance = (gameState.petrificationLevel || 0) * 0.02;
    const intoxicationChance = (gameState.intoxicationLevel || 0) * 0.02;
    const roll = Math.random();

    if (roll < ignitionChance) {
        return 'fire';
    } else if (roll < (ignitionChance + glaciationChance)) {
        return 'ice';
    } else if (roll < (ignitionChance + glaciationChance + petrificationChance)) {
        return 'stone';
    } else if (roll < (ignitionChance + glaciationChance + petrificationChance + intoxicationChance)) {
        return 'poison';
    }
    return 'base';
}

/**
 * Purchase Army Size Upgrade: deducts scraps & adds 1 Slime into the lowest vacant slot
 */
export function buyArmySizeUpgrade() {
    if (!gameState.slimes) gameState.slimes = [];

    // Every known roster slot, alive or dead, remains reserved for its original Slime.
    const reservedSlots = new Set();
    (gameState.slimes || []).forEach(slime => { if (slime.slotIndex !== undefined && slime.slotIndex !== null) reservedSlots.add(slime.slotIndex); });
    (gameState.bestRoster || []).forEach(slime => { if (slime.slotIndex !== undefined && slime.slotIndex !== null) reservedSlots.add(slime.slotIndex); });
    if (reservedSlots.size >= 60) return false;

    const cost = getArmySizeUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;

    // Division only creates new Slimes. Resurrection is reserved for full wipes and future mechanics.
    const newSlimeType = getRandomSlimeType();
    const uniqueName = generateUniqueSlimeName();
    const slotIndex = getNextAvailableSlotIndex();
    const fortificationBonus = gameState.fortificationLevel || 0;
    const alchemistEndurance = gameState.alchemistEnduranceLevel || 0;

    gameState.slimes.push({
        id: uniqueName,
        name: uniqueName,
        type: newSlimeType,
        hp: 10 + fortificationBonus + alchemistEndurance,
        maxHp: 10 + fortificationBonus + alchemistEndurance,
        baseMaxHp: 10 + fortificationBonus + alchemistEndurance,
        damage: calculateSlimeDamage({ equipment: [] }),
        critChance: getBaseCritChance(),
        regen: gameState.alchemistRegenLevel || 0,
        ascended: false,
        slotIndex: slotIndex,
        equipment: []
    });

    updateBestRoster();
    gameState.armySize = gameState.slimes.length;
    gameState.maxSlimesReached = Math.max(gameState.maxSlimesReached || 1, (gameState.bestRoster || []).length);
    gameState.hasUsedDivision = true;

    saveStateToLocal();
    return true;
}
/**
 * Get current cost for Ascension Upgrade (10 + 3 * AscendedSlimes)
 */
export function getAscensionUpgradeCost() {
    const ascendedCount = getAscendedSlimeCount();
    return clampUpgradeCost(1 + (ascendedCount * 1));
}

/**
 * Get count of ascended slimes in army
 */
export function getAscendedSlimeCount() {
    if (!gameState.slimes) return 0;
    return gameState.slimes.filter(s => s.ascended === true).length;
}

/**
 * Purchase Ascension Upgrade: ascends one random un-ascended slime for 10 scraps
 */
export function buyAscensionUpgrade() {
    const cost = getAscensionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;
    if (!gameState.slimes || gameState.slimes.length === 0) return false;

    const unascended = gameState.slimes.filter(s => (s.hp === undefined || s.hp > 0) && !s.ascended);
    if (unascended.length === 0) return false;

    gameState.scraps -= cost;

    const targetSlime = unascended[Math.floor(Math.random() * unascended.length)];
    targetSlime.ascended = true;

    if (gameState.bestRoster) {
        const targetKey = targetSlime.name || targetSlime.id;
        const match = gameState.bestRoster.find(b => (b.name || b.id) === targetKey);
        if (match) match.ascended = true;
    }

    const currentAscended = getAscendedSlimeCount();
    gameState.maxAscendedSlimesReached = Math.max(gameState.maxAscendedSlimesReached || 0, currentAscended);

    saveStateToLocal();
    return true;
}

/**
 * Get current slime damage level (default 1)
 */
export function getSlimeDamage() {
    return gameState.slimeDamage || 1;
}

/**
 * Get current cost for Augmentation Upgrade (Exponential: 10 * 1.20^level)
 */
export function getAugmentationUpgradeCost() {
    const level = Math.max(0, getSlimeDamage() - 1);
    return clampUpgradeCost(Math.floor(10 * Math.pow(1.20, level)));
}

/**
 * Purchase Augmentation Upgrade: deducts exponential cost scraps & increases slime damage by 1
 */
export function buyAugmentationUpgrade() {
    const cost = getAugmentationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.slimeDamage = (gameState.slimeDamage || 1) + 1;

    refreshAllSlimeDamage();

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Get current Precision upgrade level (default 0)
 */
export function getPrecisionLevel() {
    return gameState.precisionLevel || 0;
}

/**
 * Get current cost for Precision Upgrade (Exponential: 10 * 1.20^level)
 */
export function getPrecisionUpgradeCost() {
    const level = Math.max(0, getPrecisionLevel());
    return clampUpgradeCost(Math.floor(10 * Math.pow(1.20, level)));
}

/**
 * Purchase Precision Upgrade: deducts exponential cost scraps & increases base crit chance by 1%
 */
export function buyPrecisionUpgrade() {
    const cost = getPrecisionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.precisionLevel = (gameState.precisionLevel || 0) + 1;

    const apply = (slime) => {
        if (!slime) return;
        slime.critChance = (slime.critChance || 0) + 1;
    };
    (gameState.slimes || []).forEach(apply);
    (gameState.bestRoster || []).forEach(apply);

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Get current slime regeneration per wave (default 0)
 */
export function getSlimeRegen() {
    return gameState.slimeRegen || 0;
}

/**
 * Get current cost for Regeneration Upgrade (Exponential: 8 * 1.25^level)
 */
export function getRegenUpgradeCost() {
    const level = Math.max(0, getSlimeRegen());
    return clampUpgradeCost(Math.floor(8 * Math.pow(1.25, level)));
}

/**
 * Purchase Regeneration Upgrade: deducts (3 + currentRegenLevel) scraps & increases HP regen per wave by 1
 */
export function buyRegenUpgrade() {
    if (getSlimeRegen() >= getRegenMax()) return false;
    const cost = getRegenUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.slimeRegen = (gameState.slimeRegen || 0) + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Get cost for Selection Upgrade (5 Scraps)
 */
export function getSelectionUpgradeCost() {
    return 5;
}

/**
 * Purchase Selection Upgrade: deducts 5 scraps & unlocks Slime Sacrifice on character sheets
 */
export function buySelectionUpgrade() {
    const cost = getSelectionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;
    if (gameState.unlockedUpgrades && gameState.unlockedUpgrades.selection) return false;

    gameState.scraps -= cost;
    if (!gameState.unlockedUpgrades) gameState.unlockedUpgrades = {};
    gameState.unlockedUpgrades.selection = true;

    saveStateToLocal();
    return true;
}

/**
 * Get current Incubation upgrade level (default 0)
 */
export function getIncubationLevel() {
    return gameState.autoEatLevel || 0;
}

/**
 * Get current cost for Incubation Upgrade (Exponential: 5 * 1.50^level)
 */
export function getIncubationUpgradeCost() {
    const level = Math.max(0, getIncubationLevel());
    return level > 0 ? Infinity : 15;
}

/**
 * Purchase Incubation Upgrade: deducts scraps & increases passive scraps per wave by 5
 */
export function buyIncubationUpgrade() {
    if ((gameState.autoEatLevel || 0) > 0) return false;
    const cost = 15; if ((gameState.scraps || 0) < cost) return false;
    gameState.scraps -= cost; gameState.autoEatLevel = 1; saveStateToLocal(); return true;
}

/**
 * Ignition Upgrade Functions (0-10 levels, 2% Fire Slime spawn chance per level)
 */
export function getIgnitionLevel() {
    return gameState.ignitionLevel || 0;
}

export function getIgnitionUpgradeCost() {
    const lvl = getIgnitionLevel();
    return clampUpgradeCost(10 + (3 * lvl));
}

export function buyIgnitionUpgrade() {
    const lvl = getIgnitionLevel();
    if (lvl >= 10) return false;

    const cost = getIgnitionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.ignitionLevel = lvl + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Glaciation Upgrade Functions (0-10 levels, 2% Ice Slime spawn chance per level)
 */
export function getGlaciationLevel() {
    return gameState.glaciationLevel || 0;
}

export function getGlaciationUpgradeCost() {
    const lvl = getGlaciationLevel();
    return clampUpgradeCost(10 + (3 * lvl));
}

export function buyGlaciationUpgrade() {
    const lvl = getGlaciationLevel();
    if (lvl >= 10) return false;

    const cost = getGlaciationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.glaciationLevel = lvl + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Petrification Upgrade Functions (0-10 levels, 2% Stone Slime spawn chance per level)
 */
export function getPetrificationLevel() {
    return gameState.petrificationLevel || 0;
}

export function getPetrificationUpgradeCost() {
    const lvl = getPetrificationLevel();
    return clampUpgradeCost(10 + (3 * lvl));
}

export function buyPetrificationUpgrade() {
    const lvl = getPetrificationLevel();
    if (lvl >= 10) return false;

    const cost = getPetrificationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.petrificationLevel = lvl + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Intoxication Upgrade Functions (0-10 levels, 2% Toxic Slime spawn chance per level)
 */
export function getIntoxicationLevel() {
    return gameState.intoxicationLevel || 0;
}

export function getIntoxicationUpgradeCost() {
    const lvl = getIntoxicationLevel();
    return clampUpgradeCost(10 + (3 * lvl));
}

export function buyIntoxicationUpgrade() {
    const lvl = getIntoxicationLevel();
    if (lvl >= 10) return false;

    const cost = getIntoxicationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.intoxicationLevel = lvl + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Digestion Upgrade Functions (1 + digestionLevel slimes eat per click)
 */
export function getDigestionLevel() {
    return gameState.digestionLevel || 0;
}

export function getDigestionUpgradeCost() {
    const lvl = getDigestionLevel();
    return clampUpgradeCost(1 + lvl);
}

export function buyDigestionUpgrade() {
    const digestionLvl = getDigestionLevel();
    const slimesCount = 1 + digestionLvl;
    const bestRosterCount = (gameState.bestRoster && gameState.bestRoster.length) ? gameState.bestRoster.length : (gameState.slimes ? gameState.slimes.length : 1);

    // Cannot upgrade Digestion if slimes sent to eat (1 + digestionLvl) already equals or exceeds bestRoster count
    if (slimesCount >= bestRosterCount) return false;

    const cost = getDigestionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.digestionLevel = digestionLvl + 1;

    updateBestRoster();
    saveStateToLocal();
    return true;
}

/**
 * Kill / Sacrifice a specific slime from the army and roster blueprint by unique ID
 */
export function killSlime(slimeId) {
    if (!gameState.slimes || gameState.slimes.length <= 1) return false;
    if (!slimeId) return false;

    const target = gameState.slimes.find(s => (s.id || s.name) === slimeId);
    if (!target) return false;

    // Send the sacrificed Slime's equipment to the Village Forge Inventory first.
    if (!Array.isArray(gameState.villageInventory)) gameState.villageInventory = [];
    (target.equipment || []).forEach(item => {
        gameState.villageInventory.push({ id: item.id, quality: getEquipmentQuality(item) });
    });

    // Remove targeted slime from active army
    gameState.slimes = gameState.slimes.filter(s => (s.id || s.name) !== slimeId);
    gameState.armySize = gameState.slimes.length;

    // Remove targeted slime from master blueprint bestRoster
    if (gameState.bestRoster) {
        gameState.bestRoster = gameState.bestRoster.filter(b => (b.id || b.name) !== slimeId);
    }

    saveStateToLocal();
    return true;
}

/**
 * Save deep snapshot of roster & state upon completing a wave.
 * Includes uncollected ground loot value added to saved scraps so no scrap is lost across rewinds!
 */
export function saveWaveSnapshot(waveNum, uncollectedLootValue = 0) {
    if (!gameState.waveSnapshots) gameState.waveSnapshots = {};

    const savedScraps = (gameState.scraps || 0) + uncollectedLootValue;
    const savedScore = (gameState.score || 0) + uncollectedLootValue;

    gameState.waveSnapshots[waveNum] = {
        wave: waveNum,
        scraps: savedScraps,
        score: savedScore,
        armySize: gameState.armySize || 1,
        maxSlimesReached: gameState.maxSlimesReached || 1,
        slimeDamage: gameState.slimeDamage || 1,
        slimeRegen: gameState.slimeRegen || 0,
        precisionLevel: gameState.precisionLevel || 0,
        hasSlimeDied: gameState.hasSlimeDied || false,
        digestionLevel: gameState.digestionLevel || 0,
        ignitionLevel: gameState.ignitionLevel || 0,
        glaciationLevel: gameState.glaciationLevel || 0,
        petrificationLevel: gameState.petrificationLevel || 0,
        intoxicationLevel: gameState.intoxicationLevel || 0,
        maxWaveCleared: gameState.maxWaveCleared || 0,
        unlockedUpgrades: gameState.unlockedUpgrades ? { ...gameState.unlockedUpgrades } : {},
        slimes: (gameState.slimes || []).map(s => ({
            id: s.id || s.name,
            name: s.name || String(s.id || 'Gooey'),
            type: s.type || 'base',
            hp: s.hp !== undefined ? s.hp : 10,
            maxHp: s.maxHp || 10,
            baseMaxHp: s.baseMaxHp ?? s.maxHp ?? 10,
            damage: calculateSlimeDamage(s),
            critChance: s.critChance || 0,
            regen: s.regen || 0,
            ascended: !!s.ascended,
            slotIndex: s.slotIndex !== undefined ? s.slotIndex : 0,
            equipment: s.equipment ? JSON.parse(JSON.stringify(s.equipment)) : []
        }))
    };

    saveStateToLocal();

    // Per-wave snapshots are never restored (rewind uses bestRoster), so keep
    // only a small recent window to prevent the save from growing unboundedly
    // and exceeding Firestore's document size limit.
    const WAVE_SNAPSHOT_CAP = 20;
    const waveKeys = Object.keys(gameState.waveSnapshots).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
    if (waveKeys.length > WAVE_SNAPSHOT_CAP) {
        waveKeys.slice(0, waveKeys.length - WAVE_SNAPSHOT_CAP).forEach(k => {
            delete gameState.waveSnapshots[k];
        });
        saveStateToLocal();
    }
}

/** Total Slimes owned: main roster + village reserve. */
export function getTotalSlimeCount() {
    return (gameState.slimes ? gameState.slimes.length : 0)
        + (gameState.villageRoster ? gameState.villageRoster.length : 0);
}

/** Record a wipe at the given tier (10/20/30/40/50) for the current run. */
export function recordRunWipe(tier) {
    if (!Array.isArray(gameState.runWipedTiers)) gameState.runWipedTiers = [];
    if (!gameState.runWipedTiers.includes(tier)) gameState.runWipedTiers.push(tier);
}

/** Clear per-run wipe tracking when a new run begins. */
export function resetRunWipeTracking() {
    gameState.runWipedTiers = [];
}

/** Count slimes of a given specialization in the current roster. */
export function countSlimesBySpecialization(spec) {
    const needle = String(spec || '').toLowerCase();
    return (gameState.slimes || []).filter(s => String(s.specialization || '').toLowerCase() === needle).length;
}

/**
 * Update the "Best Roster" blueprint.
 * Automatically saves the roster blueprint with the highest number of slimes ever obtained,
 * including elemental types (base, fire, frost) and ascension statuses.
 * Called whenever an upgrade is purchased or slimes change.
 */
export function updateBestRoster() {
    if (!gameState.slimes || gameState.slimes.length === 0) return;
    if (!gameState.bestRoster) gameState.bestRoster = [];

    // Preserve every historical slot. Active Slimes update their own blueprint entry or append a new one.
    gameState.slimes.forEach(activeSlime => {
        const activeKey = activeSlime.id || activeSlime.name;
        const snapshot = {
            id: activeKey,
            name: activeSlime.name || String(activeKey),
            type: activeSlime.type || 'base',
            hp: activeSlime.maxHp || 10,
            maxHp: activeSlime.maxHp || 10,
            baseMaxHp: activeSlime.baseMaxHp ?? activeSlime.maxHp ?? 10,
            damage: calculateSlimeDamage(activeSlime),
            critChance: activeSlime.critChance || 0,
            regen: activeSlime.regen || 0,
            ascended: !!activeSlime.ascended,
            specialization: getSlimeSpecialization(activeSlime),
            talents: activeSlime.talents ? JSON.parse(JSON.stringify(activeSlime.talents)) : {},
            slotIndex: activeSlime.slotIndex !== undefined ? activeSlime.slotIndex : getNextAvailableSlotIndex(),
            equipment: activeSlime.equipment ? JSON.parse(JSON.stringify(activeSlime.equipment)) : []
        };

        const index = gameState.bestRoster.findIndex(saved => (saved.id || saved.name) === activeKey);
        if (index >= 0) gameState.bestRoster[index] = snapshot;
        else gameState.bestRoster.push(snapshot);
    });

    gameState.bestRoster.sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
    saveStateToLocal();
}
/**
 * Respawns/Restores the "Best Roster" (highest amount of slimes ever obtained) at 100% full HP!
 * Preserves all scraps, score, and upgrade levels!
 */
export function restoreBestRoster() {
    if (!gameState.bestRoster || gameState.bestRoster.length === 0) {
        if (gameState.slimes && gameState.slimes.length > 0) {
            updateBestRoster();
        } else {
            const defaultName = 'Gooey';
            gameState.bestRoster = [
                { id: defaultName, name: defaultName, type: 'base', hp: 10, maxHp: 10, damage: 1, critChance: 0, regen: 0, ascended: false, slotIndex: 0, equipment: [] }
            ];
        }
    }

    // Respawn every slime from bestRoster with 100% full HP and exact individual stats
    gameState.slimes = gameState.bestRoster.map((s, idx) => ({
        id: s.id || s.name,
        name: s.name || String(s.id || 'Gooey'),
        type: s.type || 'base',
        hp: s.maxHp || 10,
        maxHp: s.maxHp || 10,
        baseMaxHp: s.baseMaxHp ?? s.maxHp ?? 10,
        damage: calculateSlimeDamage(s),
        critChance: s.critChance || 0,
        regen: s.regen || 0,
        ascended: !!s.ascended,
        specialization: getSlimeSpecialization(s),
        talents: s.talents ? JSON.parse(JSON.stringify(s.talents)) : {},
        slotIndex: s.slotIndex !== undefined ? s.slotIndex : idx,
        equipment: s.equipment ? JSON.parse(JSON.stringify(s.equipment)) : []
    }));

    gameState.armySize = gameState.slimes.length;
    saveStateToLocal();
}


/**
 * Legacy Exaltation exports retained temporarily while js/upgrades.js is externally locked.
 */
export function getExaltationUpgradeCost() {
    return 100;
}

export function buyExaltationUpgrade() {
    const cost = getExaltationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;
    gameState.scraps -= cost;
    if (!gameState.unlockedUpgrades) gameState.unlockedUpgrades = {};
    gameState.unlockedUpgrades.exaltation = true;
    saveStateToLocal();
    return true;
}
/**
 * Get cost for Evolution Upgrade (10 Scraps)
 */
export function getEvolutionUpgradeCost() {
    return 10;
}

/**
 * Purchase Evolution Upgrade: deducts 10 scraps & unlocks Slime Type Reroll on character sheets
 */
export function buyEvolutionUpgrade() {
    const cost = getEvolutionUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    if (!gameState.unlockedUpgrades) gameState.unlockedUpgrades = {};
    gameState.unlockedUpgrades.evolution = true;

    saveStateToLocal();
    return true;
}

/**
 * Reroll type of a specific slime for 50 scraps using elemental spawn probabilities
 */
export function rerollSlimeType(targetId) {
    if (!targetId || (gameState.scraps || 0) < 50) return false;
    if (!gameState.slimes) return false;

    const slime = gameState.slimes.find(s => (s.id === targetId || s.name === targetId));
    if (!slime) return false;

    gameState.scraps -= 50;

    const newType = getRandomSlimeType();
    slime.type = newType;
    refreshSlimeDamage(slime);

    if (gameState.bestRoster) {
        const match = gameState.bestRoster.find(b => (b.id === targetId || b.name === targetId));
        if (match) {
            match.type = newType;
            refreshSlimeDamage(match);
        }
    }

    saveStateToLocal();
    return true;
}

/**
 * Local Storage Save & Load Handlers
 */
export function saveStateToLocal() {
    gameState.lastSavedTimestamp = Date.now();
    localStorage.setItem('slm_army_save', JSON.stringify(gameState));
}

/** One-time save migration: specialize via a field, never via a composite type ID. */
export function migrateSpecializedSlimes() {
    const migrate = slime => {
        if (!slime) return;
        const match = String(slime.type || '').match(/^(poison|fire|ice|stone)(Support|Fighter|Tank)$/i);
        if (match) {
            slime.type = match[1].toLowerCase();
            slime.specialization = match[2].toLowerCase();
        }
        // Legacy rename: base poison slimes were stored as type 'toxic'.
        if (slime.type === 'toxic') slime.type = 'poison';
    };
    (gameState.slimes || []).forEach(migrate);
    (gameState.bestRoster || []).forEach(migrate);
    Object.values(gameState.waveSnapshots || {}).forEach(snapshot => (snapshot.slimes || []).forEach(migrate));

    // Repair older blueprints that were saved before specializations and talents
    // were included in bestRoster. Active Slimes are the authoritative source.
    (gameState.slimes || []).forEach(activeSlime => {
        if (!activeSlime?.specialization && !activeSlime?.talents) return;
        const savedSlime = (gameState.bestRoster || []).find(saved => String(saved.id || saved.name) === String(activeSlime.id || activeSlime.name));
        if (!savedSlime) return;
        savedSlime.specialization = getSlimeSpecialization(activeSlime);
        savedSlime.talents = activeSlime.talents ? JSON.parse(JSON.stringify(activeSlime.talents)) : {};
    });
}
/**
 * Strip legacy equipment entries to the canonical { id, quality } shape. All
 * display/mechanical data is re-derived live from the registered definition.
 */
function normalizeEquipmentList(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        const id = item?.id || item?.enemyKey;
        return { id, quality: getEquipmentQuality(item) };
    }).filter(item => item.id != null && item.id !== '');
}

export function loadStateFromLocal() {
    const saved = localStorage.getItem('slm_army_save');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState = { ...defaultState, ...parsed };
            if (!Array.isArray(gameState.slimes) || gameState.slimes.length === 0) {
                syncSlimesArray();
            }
        } catch (e) {
            gameState = { ...defaultState };
            syncSlimesArray();
        }
    } else {
        gameState = { ...defaultState };
        syncSlimesArray();
    }
    (gameState.slimes || []).forEach(slime => { slime.equipment = normalizeEquipmentList(slime.equipment); ensureSlimeSubTalents(slime); });
    (gameState.bestRoster || []).forEach(slime => { slime.equipment = normalizeEquipmentList(slime.equipment); ensureSlimeSubTalents(slime); });
    (gameState.villageRoster || []).forEach(slime => { slime.equipment = normalizeEquipmentList(slime.equipment); ensureSlimeSubTalents(slime); });
    gameState.villageInventory = normalizeEquipmentList(gameState.villageInventory);
    migrateSpecializedSlimes();
    // A Slime kept in the Village (Common House) is not part of the army. Prune
    // it from the historical roster so it is never rendered as a dead RIP slot.
    const villageKeys = new Set((gameState.villageRoster || []).map(s => s.id || s.name));
    if (gameState.bestRoster) {
        gameState.bestRoster = gameState.bestRoster.filter(s => !villageKeys.has(s.id || s.name));
    }
    if (!gameState.afkLastAwayAt) {
        gameState.afkLastAwayAt = saved ? (gameState.lastSavedTimestamp || Date.now()) : Date.now();
    }
    syncSlimesArray();
    (gameState.slimes || []).forEach(recalculateSlimeStats);
    (gameState.bestRoster || []).forEach(recalculateSlimeStats);
    saveStateToLocal();
}



export function getAfkScrapCeilingLevel() { return gameState.afkScrapCeilingLevel || 0; }
export function getAfkScrapLevel() { return gameState.afkScrapLevel || 0; }
export function getAfkScrapCeiling() { return 0 + (500 * getAfkScrapCeilingLevel()); }
export function getAfkScrapsPerMinute() { return 0 + (5 * getAfkScrapLevel()); }
export function getAfkScrapCeilingUpgradeCost() { return clampUpgradeCost(Math.floor(10 * Math.pow(1.45, getAfkScrapCeilingLevel()))); }
export function getAfkScrapUpgradeCost() { return clampUpgradeCost(Math.floor(10 * Math.pow(1.45, getAfkScrapLevel()))); }

export function buyAfkScrapCeilingUpgrade() {
    const cost = getAfkScrapCeilingUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;
    gameState.scraps -= cost;
    gameState.afkScrapCeilingLevel = getAfkScrapCeilingLevel() + 1;
    gameState.afkScrapCeilingPurchased = true;
    saveStateToLocal();
    return true;
}

export function buyAfkScrapUpgrade() {
    const cost = getAfkScrapUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;
    gameState.scraps -= cost;
    gameState.afkScrapLevel = getAfkScrapLevel() + 1;
    gameState.afkScrapPurchased = true;
    saveStateToLocal();
    return true;
}

/**
 * Bulk-purchase helper: repeats a single `buy` action up to `maxCount` times,
 * stopping early when a purchase fails (maxed or unaffordable). Returns the
 * number of successful purchases (0 = nothing bought).
 */
export function bulkBuyUpgrade(buy, maxCount = 10) {
    let bought = 0;
    for (let i = 0; i < maxCount; i++) {
        if (!buy()) break;
        bought++;
    }
    return bought;
}

/** Bulk-buy variants: shift+click unlocks up to 10 levels at once. */
export function buyArmySizeUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyArmySizeUpgrade, max); }
export function buyAscensionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyAscensionUpgrade, max); }
export function buyAugmentationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyAugmentationUpgrade, max); }
export function buyPrecisionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyPrecisionUpgrade, max); }
export function buyRegenUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyRegenUpgrade, max); }
export function buyDigestionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyDigestionUpgrade, max); }
export function buyIncubationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyIncubationUpgrade, max); }
export function buyIgnitionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyIgnitionUpgrade, max); }
export function buyGlaciationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyGlaciationUpgrade, max); }
export function buyPetrificationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyPetrificationUpgrade, max); }
export function buyIntoxicationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyIntoxicationUpgrade, max); }
export function buyAfkScrapCeilingUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyAfkScrapCeilingUpgrade, max); }
export function buyAfkScrapUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyAfkScrapUpgrade, max); }
export function buySelectionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buySelectionUpgrade, max); }
export function buyEvolutionUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyEvolutionUpgrade, max); }
export function buyExaltationUpgradeBulk(max = 10) { return bulkBuyUpgrade(buyExaltationUpgrade, max); }

export function markAfkStart(timestamp = Date.now()) {
    gameState.afkLastAwayAt = timestamp;
    saveStateToLocal();
}

export function previewAfkScraps(timestamp = Date.now()) {
    // Display levels alone do not activate AFK rewards; both upgrades must be bought.
    if (gameState.afkScrapCeilingPurchased !== true || gameState.afkScrapPurchased !== true) return { minutes: 0, scraps: 0 };
    const awaySince = Number(gameState.afkLastAwayAt);
    if (!Number.isFinite(awaySince) || timestamp <= awaySince) return { minutes: 0, scraps: 0 };
    const minutes = Math.floor((timestamp - awaySince) / 60000);
    return { minutes, scraps: minutes > 0 ? Math.min(getAfkScrapCeiling(), minutes * getAfkScrapsPerMinute()) : 0 };
}
export function claimAfkScraps(timestamp = Date.now(), expected = null) {
    if (gameState.afkScrapCeilingPurchased !== true || gameState.afkScrapPurchased !== true) return { minutes: 0, scraps: 0 };
    const awaySince = Number(gameState.afkLastAwayAt);
    if (!Number.isFinite(awaySince) || timestamp <= awaySince) return { minutes: 0, scraps: 0 };

    const minutes = Math.floor((timestamp - awaySince) / 60000);
    gameState.afkLastAwayAt = timestamp;
    if (minutes <= 0) {
        saveStateToLocal();
        return { minutes: 0, scraps: 0 };
    }

    // Use the amount already shown to the player when provided, so a stale
    // afkLastAwayAt (e.g. a deferred cloud save landing after the popup is shown)
    // cannot silently shrink or void the reward they were promised.
    const scraps = expected && expected.scraps > 0
        ? expected.scraps
        : Math.min(getAfkScrapCeiling(), minutes * getAfkScrapsPerMinute());
    gameState.scraps = (gameState.scraps || 0) + scraps;
    saveStateToLocal();
    return { minutes, scraps };
}
// Cap on Regeneration level temporarily disabled so it can be upgraded further than half base Slime HPs.
export function getRegenMax() { return Infinity; }
// Previous cap: 5 + Math.floor((gameState.fortificationLevel || 0) / 2)
export function getFortificationLevel() { return gameState.fortificationLevel || 0; }
export function getFortificationUpgradeCost() { return clampUpgradeCost(Math.floor(10 * Math.pow(1.20, getFortificationLevel()))); }
export function buyFortificationUpgrade() { const cost = getFortificationUpgradeCost(); if ((gameState.scraps || 0) < cost) return false; gameState.scraps -= cost; gameState.fortificationLevel = getFortificationLevel() + 1; (gameState.slimes || []).forEach(s => { s.baseMaxHp = (s.baseMaxHp ?? s.maxHp ?? 10) + 1; refreshSlimeMaxHp(s); }); updateBestRoster(); saveStateToLocal(); return true; }






