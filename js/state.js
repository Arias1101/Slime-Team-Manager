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
        burnDuration: 3.0 // 3 seconds DoT (1 damage per second)
    },
    ice: {
        id: 'ice',
        name: 'Ice Slime',
        folder: 'images/slimes/ice',
        prefix: 'slime',
        frameCount: 8,
        effect: 'freeze',
        freezeDuration: 0.5 // Base freeze duration; equipment values multiply this
    },
    stone: {
        id: 'stone',
        name: 'Stone Slime',
        folder: 'images/slimes/stone',
        prefix: 'slime',
        frameCount: 8,
        effect: 'stun',
        stunDuration: 0.4 // Base stun duration; equipment values multiply this
    },
    poison: {
        id: 'poison',
        name: 'Poison Slime',
        folder: 'images/slimes/poison',
        prefix: 'slime',
        frameCount: 8,
        effect: 'poison',
        poisonDamagePerSec: 2,
        poisonDuration: 3.0 // 3 seconds DoT (2 damage per stack per 1.0s tick)
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
    'Seigneur Merguez', 'Chéa Rome le Romain', 'Goat Granny'
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
    maxWaveCleared: 0,    // Highest wave cleared in current run (for unlocking upgrades)
    armySize: 1,          // 1 Base Slime
    maxSlimesReached: 1,  // Highest slime count achieved in army
    maxAscendedSlimesReached: 0, // Highest count of ascended slimes reached at once
    slimeDamage: 1,       // Bonus attack damage per slime
    slimeRegen: 0,        // Health regained per wave for all slimes
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
    villageInventory: [],       // Unequipped equipment stored at the Forge
    villageRoster: [],          // Reserve slimes stored at the Common House (max 180)
    alchemistLuckLevel: 0,
    alchemistRageLevel: 0,
    alchemistEnduranceLevel: 0,
    alchemistRegenLevel: 0,
    isInNewGamePlus: false,    // Village intermission after defeating/wiping to Death
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
    luck: { key: 'luck', field: 'alchemistLuckLevel', name: 'Philter of Luck', description: '+1% Base Crit /lvl', icon: 'luckpotion.png' },
    rage: { key: 'rage', field: 'alchemistRageLevel', name: 'Tincture of Rage', description: '+1 Base Damage /lvl', icon: 'ragepotion.png' },
    endurance: { key: 'endurance', field: 'alchemistEnduranceLevel', name: 'Elixir of Endurance', description: '+1 Base HP /lvl', icon: 'endurancepotion.png' },
    regeneration: { key: 'regeneration', field: 'alchemistRegenLevel', name: 'Potion of Regeneration', description: '+1 Base Regen /lvl', icon: 'regenerationpotion.png' }
});

export function getAlchemistUpgradeLevel(key) {
    const upgrade = ALCHEMIST_UPGRADES[key];
    return upgrade ? (gameState[upgrade.field] || 0) : 0;
}

export function getAlchemistUpgradeCost(key) {
    return getAlchemistUpgradeLevel(key) + 1;
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
/** Equipment quality ranges from base (0) through +4. */
export function getEquipmentQuality(item) {
    return Math.max(0, Math.min(4, Math.floor(Number(item?.quality) || 0)));
}

export function getEquipmentMultiplier(item) {
    return 1 + getEquipmentQuality(item);
}

export function getScaledEquipmentEffects(item) {
    const rawEffects = Array.isArray(item?.effects) ? item.effects : (item?.effects ? [item.effects] : [item]);
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
    const baseName = item?.name || item?.id || 'Equipment';
    const quality = getEquipmentQuality(item);
    return quality > 0 ? `${baseName} +${quality}` : baseName;
}
/** Sum innate elemental effects and quality-scaled equipment effects for one hit. */
export function getSlimeHitEffects(slime) {
    const totals = { burn: 0, freeze: 0, poison: 0, stun: 0 };
    const slimeEffect = (SLIME_TYPES[slime?.type] || SLIME_TYPES.base).effect;
    if (slimeEffect && Object.prototype.hasOwnProperty.call(totals, slimeEffect)) totals[slimeEffect] += 1;

    (slime?.equipment || []).forEach(item => {
        getScaledEquipmentEffects(item).forEach(effect => {
            const type = Object.prototype.hasOwnProperty.call(totals, effect?.stat) ? effect.stat : effect?.effectType;
            if (!type) return;
            totals[type] += Math.max(1, Number(effect.value) || 1);
        });
    });
    return totals;
}
/** Resolve a Slime path from saved data or its specialized type. */
export function getSlimeSpecialization(slime) {
    return String(slime?.specialization || '').toLowerCase();
}

/** Whether a Slime can purchase its next specialization talent (enough XP, not already bought). */
export function canSlimeBuyNextTalent(slime) {
    if ((gameState.newGamePlusCompletions || 0) <= 0) return false;
    const specialization = getSlimeSpecialization(slime);
    if (!['support', 'tank', 'fighter'].includes(specialization)) return false;
    const xp = Number(slime?.wavesClearedSinceDeath || 0);
    if (xp < 5) return false;
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
    return getSlimeSpecialization(slime) === 'tank' ? Math.round(baseMaxHp * 1.2) : baseMaxHp;
}

/** Refresh derived Tank HP while preserving any newly gained maximum HP as current HP. */
export function refreshSlimeMaxHp(slime) {
    if (!slime) return 10;
    const previousMaxHp = Math.max(1, Number(slime.maxHp || 10));
    if (slime.baseMaxHp === undefined) slime.baseMaxHp = previousMaxHp;
    const nextMaxHp = getSlimeMaxHp(slime);
    slime.maxHp = nextMaxHp;
    if (slime.hp === undefined) slime.hp = nextMaxHp;
    else slime.hp = Math.min(nextMaxHp, Math.max(0, slime.hp + Math.max(0, nextMaxHp - previousMaxHp)));
    return nextMaxHp;
}

/** Total per-wave regeneration, including the global upgrade and Support bonus. */
export function getSlimeTotalRegen(slime) {
    const total = (gameState.slimeRegen || 0) + (slime?.regen || 0);
    return getSlimeSpecialization(slime) === 'support' ? Math.round(total * 1.2) : total;
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
    // Roster follows battlefield direction: back line on the left, then middle, then front line on the right.
    const priority = { support: 0, fighter: 1, tank: 2 };
    const ordered = [...entries.values()].sort((a, b) => {
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
    const totalDamage = (gameState.slimeDamage || 1) + (gameState.alchemistRageLevel || 0) + equipmentDamage;
    return Math.max(1, Math.round(totalDamage * (getSlimeSpecialization(slime) === 'fighter' ? 1.2 : 1)));
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
        if (s.wavesClearedSinceDeath === undefined) s.wavesClearedSinceDeath = 0;

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
    return 2 + currentSlimes;
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
        critChance: gameState.alchemistLuckLevel || 0,
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
    return 1 + (ascendedCount * 1);
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
 * Get current cost for Augmentation Upgrade (Exponential: 10 * 1.45^level)
 */
export function getAugmentationUpgradeCost() {
    const level = Math.max(0, getSlimeDamage() - 1);
    return Math.floor(10 * Math.pow(1.45, level));
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
 * Get current slime regeneration per wave (default 0)
 */
export function getSlimeRegen() {
    return gameState.slimeRegen || 0;
}

/**
 * Get current cost for Regeneration Upgrade (Exponential: 8 * 1.60^level)
 */
export function getRegenUpgradeCost() {
    const level = Math.max(0, getSlimeRegen());
    return Math.floor(8 * Math.pow(1.60, level));
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
    return 10 + (3 * lvl);
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
    return 10 + (3 * lvl);
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
    return 10 + (3 * lvl);
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
    return 10 + (3 * lvl);
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
    return 1 + lvl;
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
            wavesClearedSinceDeath: Number(activeSlime.wavesClearedSinceDeath || 0),
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
        wavesClearedSinceDeath: Number(s.wavesClearedSinceDeath || 0),
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
        savedSlime.wavesClearedSinceDeath = Number(activeSlime.wavesClearedSinceDeath || 0);
    });
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
    refreshAllSlimeDamage();
    saveStateToLocal();
}



export function getAfkScrapCeilingLevel() { return gameState.afkScrapCeilingLevel || 0; }
export function getAfkScrapLevel() { return gameState.afkScrapLevel || 0; }
export function getAfkScrapCeiling() { return 0 + (500 * getAfkScrapCeilingLevel()); }
export function getAfkScrapsPerMinute() { return 0 + (5 * getAfkScrapLevel()); }
export function getAfkScrapCeilingUpgradeCost() { return Math.floor(10 * Math.pow(1.45, getAfkScrapCeilingLevel())); }
export function getAfkScrapUpgradeCost() { return Math.floor(10 * Math.pow(1.45, getAfkScrapLevel())); }

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
export function claimAfkScraps(timestamp = Date.now()) {
    if (gameState.afkScrapCeilingPurchased !== true || gameState.afkScrapPurchased !== true) return { minutes: 0, scraps: 0 };
    const awaySince = Number(gameState.afkLastAwayAt);
    if (!Number.isFinite(awaySince) || timestamp <= awaySince) return { minutes: 0, scraps: 0 };

    const minutes = Math.floor((timestamp - awaySince) / 60000);
    gameState.afkLastAwayAt = timestamp;
    if (minutes <= 0) {
        saveStateToLocal();
        return { minutes: 0, scraps: 0 };
    }

    const scraps = Math.min(getAfkScrapCeiling(), minutes * getAfkScrapsPerMinute());
    gameState.scraps = (gameState.scraps || 0) + scraps;
    saveStateToLocal();
    return { minutes, scraps };
}
export function getRegenMax() { return 5 + Math.floor((gameState.fortificationLevel || 0) / 2); }
export function getFortificationLevel() { return gameState.fortificationLevel || 0; }
export function getFortificationUpgradeCost() { return Math.floor(10 * Math.pow(1.45, getFortificationLevel())); }
export function buyFortificationUpgrade() { const cost = getFortificationUpgradeCost(); if ((gameState.scraps || 0) < cost) return false; gameState.scraps -= cost; gameState.fortificationLevel = getFortificationLevel() + 1; (gameState.slimes || []).forEach(s => { s.baseMaxHp = (s.baseMaxHp ?? s.maxHp ?? 10) + 1; refreshSlimeMaxHp(s); }); updateBestRoster(); saveStateToLocal(); return true; }






