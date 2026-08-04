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
    },
    stone: {
        id: 'stone',
        name: 'Stone Slime',
        folder: 'images/slimes/stone',
        prefix: 'slime',
        frameCount: 8,
        attackDamage: 2, // Heavy stone impact damage
        effect: 'stun',
        stunDuration: 0.8 // Stuns/dazes enemy for 0.8 seconds
    },
    toxic: {
        id: 'toxic',
        name: 'Toxic Slime',
        folder: 'images/slimes/poison',
        prefix: 'slime',
        frameCount: 8,
        attackDamage: 1,
        effect: 'poison',
        poisonDamagePerSec: 2,
        poisonDuration: 3.0 // 3 seconds DoT (2 damage per stack per 1.0s tick)
    }
};

const SLIME_NAME_POOL = [
    'Gooey', 'Bloop', 'Splat', 'Pudding', 'Blobby', 'Glurp', 'Jelly', 'Slush',
    'Gummy', 'Squish', 'Bubble', 'Sticky', 'Slimey', 'Mochi', 'Splosh', 'Slinky',
    'Bouncy', 'Drip', 'Noodle', 'Plop', 'Squeegee', 'Wobble', 'Ziggy', 'Pip',
    'Fizzy', 'Gizmo', 'Sprout', 'Bean', 'Peanut', 'Muffin', 'Boop', 'Snack',
    'Blobfish', 'Goober', 'Muck', 'Sludge', 'Toxie', 'Spark', 'Frosty', 'Rocky',
    'Magma', 'Pebble', 'Clay', 'Cobble', 'Venom', 'Splatter', 'Gloop', 'Blip',
    'Ooze', 'Splurge', 'John', 'Karim', 'Jean-François Petit', 'Pierre', 'Gimli',
    'Seigneur Blindax', 'Petit Flan', 'Michel Brouzouf', 'Raymond le Rincé',
    'Rainman', 'Flambino', 'Toxic Ex', 'Lord of the Rings',
    'Squeaky Boy', 'Jello Mr Bean',
    'Jeeves', 'Steeve', 'Stephan', 'Stephen',
    'The Rock', 'Ice Cube', 'Fire Man', 'The Dude',
    'Pelavius', 'Brutus Maximus', 'Kebab', 'Bruscetta', 'La Porta',
    'Small Brain', 'Big Brain', 'Knuckles the Guide',
    'Michael', 'Obama', 'GooBall', 'Slay Queen', 'Jackson Five', 'Taxi Joe',
    'The Chosen One', 'Bozu', 'Sunny', 'Number Two', 'Big Mac', 'Chungus', 'Big Chungus',
    'Snorlax the Brave', 'Jean-Michel Apathique', 'Jupiter', 'Méluche', 'Marine', 'Le Barde est là',
    'Chéa Rome', 'They/Them', 'She/Her', 'He/Him', 'Your Phobia', 'He HIS the Danger', 'Chicken Nugget',
    'Cheese Maki', 'Chef Sushi', 'KonNiChonHa', 'Baguette', 'Dragon Roll Guy',
    'ARE YOU OK ?', 'Bello Bello', 'Bella Dimende', 'Poltrone Sofa', 'Boudha', 'Jesus II'
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
    incubationLevel: 0,   // Level of Incubation upgrade (passive scraps & score per wave)
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
        selectionCard: false,
        selection: false,
        evolutionCard: false,
        evolution: false,
        exaltationCard: false,
        exaltation: false,
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
        if (!s.name || s.name === 'Base Slime' || s.name === 'Fire Slime' || s.name === 'Ice Slime' || s.name === 'Stone Slime' || s.name === 'Toxic Slime') {
            s.name = generateUniqueSlimeName();
        }
        if (!s.id) s.id = s.name;
        const slimeConfig = SLIME_TYPES[s.type || 'base'] || SLIME_TYPES.base;
        if (!s.damage) s.damage = (slimeConfig.attackDamage || 1) + ((gameState.slimeDamage || 1) - 1);
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
    if (!gameState.slimes || gameState.slimes.length === 0) return 0;
    const usedSlots = new Set(gameState.slimes.map(s => s.slotIndex).filter(idx => idx !== undefined && idx !== null));
    let slot = 0;
    while (usedSlots.has(slot)) {
        slot++;
    }
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
        return 'toxic';
    }
    return 'base';
}

/**
 * Purchase Army Size Upgrade: deducts scraps & adds 1 Slime into the lowest vacant slot
 */
export function buyArmySizeUpgrade() {
    const currentSlimes = (gameState.slimes && gameState.slimes.length) ? gameState.slimes.length : (gameState.armySize || 1);
    if (currentSlimes >= 60) return false;

    const cost = getArmySizeUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    if (!gameState.slimes) gameState.slimes = [];

    const newSlimeType = getRandomSlimeType();
    const isExalted = gameState.unlockedUpgrades && gameState.unlockedUpgrades.exaltation === true;

    const uniqueName = generateUniqueSlimeName();
    const slimeConfig = SLIME_TYPES[newSlimeType] || SLIME_TYPES.base;
    const baseDamage = (slimeConfig.attackDamage || 1) + ((gameState.slimeDamage || 1) - 1);
    const slotIndex = getNextAvailableSlotIndex();

    const newSlime = {
        id: uniqueName,
        name: uniqueName,
        type: newSlimeType,
        hp: 10,
        maxHp: 10,
        damage: baseDamage,
        critChance: 0,
        regen: 0,
        ascended: isExalted,
        slotIndex: slotIndex,
        equipment: []
    };

    gameState.slimes.push(newSlime);
    updateBestRoster();

    gameState.armySize = gameState.slimes.length;
    gameState.maxSlimesReached = Math.max(gameState.maxSlimesReached || 1, gameState.bestRoster.length);
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

    // Increment individual attack damage of all active slimes
    if (gameState.slimes) {
        gameState.slimes.forEach(s => {
            s.damage = (s.damage || 1) + 1;
        });
    }

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
    return gameState.incubationLevel || 0;
}

/**
 * Get current cost for Incubation Upgrade (Exponential: 5 * 1.50^level)
 */
export function getIncubationUpgradeCost() {
    const level = Math.max(0, getIncubationLevel());
    return Math.floor(5 * Math.pow(1.50, level));
}

/**
 * Purchase Incubation Upgrade: deducts scraps & increases passive scraps per wave by 5
 */
export function buyIncubationUpgrade() {
    const cost = getIncubationUpgradeCost();
    if ((gameState.scraps || 0) < cost) return false;

    gameState.scraps -= cost;
    gameState.incubationLevel = (gameState.incubationLevel || 0) + 1;

    saveStateToLocal();
    return true;
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
            damage: s.damage || (SLIME_TYPES[s.type || 'base']?.attackDamage || 1),
            critChance: s.critChance || 0,
            regen: s.regen || 0,
            ascended: !!s.ascended,
            slotIndex: s.slotIndex !== undefined ? s.slotIndex : 0,
            equipment: s.equipment ? JSON.parse(JSON.stringify(s.equipment)) : []
        }))
    };

    saveStateToLocal();
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

    // If current slimes in active army exceeds or equals bestRoster length, update bestRoster blueprint!
    if (gameState.slimes.length >= gameState.bestRoster.length) {
        gameState.bestRoster = gameState.slimes.map(s => ({
            id: s.id || s.name,
            name: s.name || String(s.id || 'Gooey'),
            type: s.type || 'base',
            hp: s.maxHp || 10,
            maxHp: s.maxHp || 10,
            damage: s.damage || (SLIME_TYPES[s.type || 'base']?.attackDamage || 1),
            critChance: s.critChance || 0,
            regen: s.regen || 0,
            ascended: !!s.ascended,
            slotIndex: s.slotIndex !== undefined ? s.slotIndex : 0,
            equipment: s.equipment ? JSON.parse(JSON.stringify(s.equipment)) : []
        }));
    } else {
        // Also sync any newly ascended or upgraded slimes into the bestRoster blueprint by unique name
        gameState.slimes.forEach(activeSlime => {
            const activeKey = activeSlime.name || activeSlime.id;
            const bestMatch = gameState.bestRoster.find(b => (b.name || b.id) === activeKey);
            if (bestMatch) {
                bestMatch.ascended = activeSlime.ascended || bestMatch.ascended;
                if (activeSlime.slotIndex !== undefined) bestMatch.slotIndex = activeSlime.slotIndex;
                if (activeSlime.damage) bestMatch.damage = activeSlime.damage;
                if (activeSlime.maxHp) bestMatch.maxHp = activeSlime.maxHp;
                if (activeSlime.critChance) bestMatch.critChance = activeSlime.critChance;
                if (activeSlime.regen) bestMatch.regen = activeSlime.regen;
                if (activeSlime.equipment) bestMatch.equipment = JSON.parse(JSON.stringify(activeSlime.equipment));
            }
        });
    }

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
        damage: s.damage || (SLIME_TYPES[s.type || 'base']?.attackDamage || 1),
        critChance: s.critChance || 0,
        regen: s.regen || 0,
        ascended: !!s.ascended,
        slotIndex: s.slotIndex !== undefined ? s.slotIndex : idx,
        equipment: s.equipment ? JSON.parse(JSON.stringify(s.equipment)) : []
    }));

    gameState.armySize = gameState.slimes.length;
    saveStateToLocal();
}

/**
 * Get cost for Exaltation Upgrade (100 Scraps)
 */
export function getExaltationUpgradeCost() {
    return 100;
}

/**
 * Purchase Exaltation Upgrade: deducts 100 scraps & makes all newly created slimes ascended
 */
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

    const slimeConfig = SLIME_TYPES[newType] || SLIME_TYPES.base;
    const damageBonus = (gameState.slimeDamage || 1) - 1;
    slime.damage = (slimeConfig.attackDamage || 1) + damageBonus;

    if (gameState.bestRoster) {
        const match = gameState.bestRoster.find(b => (b.id === targetId || b.name === targetId));
        if (match) {
            match.type = newType;
            match.damage = slime.damage;
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
    saveStateToLocal();
}
