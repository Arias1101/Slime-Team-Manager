import { gameState, saveStateToLocal, getTotalSlimeCount, getEquipmentQuality } from './state.js';

/**
 * Achievement definitions.
 *
 * Each achievement features:
 *  - icon:    left-side icon (same folder as the tooltip art)
 *  - title:   short title
 *  - desc:    longer description
 *  - reward:  Village Coins granted once, on first unlock
 *  - check:   (optional) state-based predicate evaluated by checkAchievements()
 *  - event:   (optional) 'enemyDefeated' triggers evaluate enemyId via matchesEnemy
 *  - matchesEnemy: (optional) enemy typeId that satisfies an event achievement
 */
export const ACHIEVEMENTS = [
    {
        id: 'runYouFools',
        icon: 'images/achievements/youShallPass.png',
        title: 'You Shall Pass',
        desc: 'Defeat the Mage.',
        reward: 1,
        event: 'enemyDefeated',
        matchesEnemy: 'mage'
    },
    {
        id: 'outnumbered',
        icon: 'images/achievements/outnumbered.png',
        title: 'Outnumbered',
        desc: 'Defeat the Alchemist & Berserker duo.',
        reward: 2,
        event: 'enemyDefeated',
        matchesEnemy: 'berserker'
    },
    {
        id: 'siegeEngines',
        icon: 'images/achievements/siegeEngines.png',
        title: "Siege Engines Won't Cut It",
        desc: 'Defeat the Catapult.',
        reward: 3,
        event: 'enemyDefeated',
        matchesEnemy: 'catapult'
    },
    {
        id: 'slimeHarderThanStone',
        icon: 'images/achievements/slimeHarderThanStone.png',
        title: 'Slime is Harder Than Stone',
        desc: 'Defeat the Stone Golem.',
        reward: 4,
        event: 'enemyDefeated',
        matchesEnemy: 'stonegolem'
    },
    {
        id: 'boneEaters',
        icon: 'images/achievements/boneEaters.png',
        title: 'Bone Eaters',
        desc: 'Defeat the Lich.',
        reward: 5,
        event: 'enemyDefeated',
        matchesEnemy: 'lich'
    },
    {
        id: 'iAmTheDanger',
        icon: 'images/achievements/iAmTheDanger.png',
        title: 'I Am The Danger',
        desc: 'Defeat Death.',
        reward: 10,
        event: 'enemyDefeated',
        matchesEnemy: 'death'
    },
    {
        id: 'fuego',
        icon: 'images/achievements/fuego.png',
        title: 'FUEGO !!',
        desc: 'Get a Fire Slime.',
        reward: 1,
        check: (s) => (s.slimes || []).some(sl => (sl.type || '').startsWith('fire'))
    },
    {
        id: 'iceCream',
        icon: 'images/achievements/iceCream.png',
        title: 'Ice Cream',
        desc: 'Get an Ice Slime.',
        reward: 1,
        check: (s) => (s.slimes || []).some(sl => (sl.type || '').startsWith('ice'))
    },
    {
        id: 'muksAndGrimers',
        icon: 'images/achievements/muksAndGrimers.png',
        title: 'Muks & Grimers',
        desc: 'Get a Poison Slime.',
        reward: 1,
        check: (s) => (s.slimes || []).some(sl => (sl.type || '').startsWith('poison'))
    },
    {
        id: 'rocksAndRolls',
        icon: 'images/achievements/rocksAndRolls.png',
        title: 'Rocks & Rolls',
        desc: 'Get a Stone Slime.',
        reward: 1,
        check: (s) => (s.slimes || []).some(sl => (sl.type || '').startsWith('stone'))
    },
    {
        id: 'itIsAlive',
        icon: 'images/achievements/itIsAlive.png',
        title: "It's Alive !",
        desc: 'Ascend your first Slime.',
        reward: 1,
        check: (s) => (s.slimes || []).some(sl => sl.ascended === true)
    },
    {
        id: 'fullHouse',
        icon: 'images/achievements/fullHouse.png',
        title: 'Full House',
        desc: 'Get 60 Slimes in your main Roster.',
        reward: 3,
        check: (s) => (s.slimes || []).length >= 60
    },
    {
        id: 'crowded',
        icon: 'images/achievements/crowded.png',
        title: 'Crowded',
        desc: 'Get 240 Slimes in total.',
        reward: 10,
        check: (s) => getTotalSlimeCount() >= 240
    },
    {
        id: 'legendary',
        icon: 'images/achievements/legendary.png',
        title: 'Legendary',
        desc: 'Get a +4 Item.',
        reward: 5,
        check: (s) => hasLegendaryItem()
    },
    {
        id: 'opposableThumbs',
        icon: 'images/achievements/opposableThumbs.png',
        title: 'Opposable Thumbs',
        desc: 'Merge equipments for the first time.',
        reward: 1
    },
    {
        id: 'holyTrinity',
        icon: 'images/achievements/holyTrinity.png',
        title: 'Holy Trinity',
        desc: 'Finish a Run with 20 Supports / 20 Fighters / 20 Tanks.',
        reward: 5
    },
    {
        id: 'theGreatWall',
        icon: 'images/achievements/theGreatWall.png',
        title: 'The Great Wall',
        desc: 'Finish a Run with 60 Tanks in your Roster.',
        reward: 10
    },
    {
        id: 'theBestDefense',
        icon: 'images/achievements/theBestDefense.png',
        title: 'The Best Defense',
        desc: 'Finish a Run with 60 Fighters in your Roster.',
        reward: 10
    },
    {
        id: 'whyNot',
        icon: 'images/achievements/whyNot.png',
        title: 'Why Not?',
        desc: 'Finish a Run with 60 Supports in your Roster.',
        reward: 10
    },
    {
        id: 'ironMan',
        icon: 'images/achievements/ironMan.png',
        title: 'Iron Man',
        desc: 'Finish a Run without wiping once.',
        reward: 20
    },
    {
        id: 'paperThin',
        icon: 'images/achievements/paperThin.png',
        title: 'Paper Thin',
        desc: 'Finish a Run in which you wiped at every Tier.',
        reward: 20
    },
    {
        id: 'imFastAsF',
        icon: 'images/achievements/imFastAsF.png',
        title: "I'm Fast As F",
        desc: 'Defeat the F40.',
        reward: 10,
        event: 'enemyDefeated',
        matchesEnemy: 'car'
    },
    {
        id: 'warWeapons',
        icon: 'images/achievements/warWeapons.png',
        title: 'War Weapons',
        desc: 'Defeat the Tank.',
        reward: 10,
        event: 'enemyDefeated',
        matchesEnemy: 'char'
    },
    {
        id: 'wildMissingno',
        icon: 'images/achievements/wildMissingno.png',
        title: 'A Wild Missingno Appears !',
        desc: 'Defeat Missingno.',
        reward: 10,
        event: 'enemyDefeated',
        matchesEnemy: 'missingno'
    },
    {
        id: 'poorGuy',
        icon: 'images/achievements/poorGuy.png',
        title: 'Poor Guy',
        desc: 'Wipe to the first Beggar.',
        reward: 1
    },
    {
        id: 'stunLocked',
        icon: 'images/achievements/stunLocked.png',
        title: 'Stun Locked',
        desc: 'Kill the Golem before it reaches the middle.',
        reward: 3,
        event: 'enemyDefeated',
        matchesEnemy: 'stonegolem',
        condition: (payload) => (payload.x === undefined || payload.x >= 250)
    },
    {
        id: 'winterIsComing',
        icon: 'images/achievements/winterIsComing.png',
        title: 'Winter is Coming',
        desc: 'Finish a Run with 60 Ice Slimes in your Roster.',
        reward: 5
    },
    {
        id: 'blazingHot',
        icon: 'images/achievements/blazingHot.png',
        title: 'Blazing Hot',
        desc: 'Finish a Run with 60 Fire Slimes in your Roster.',
        reward: 5
    },
    {
        id: 'stonehead',
        icon: 'images/achievements/stonehead.png',
        title: 'Stonehead',
        desc: 'Finish a Run with 60 Stone Slimes in your Roster.',
        reward: 5
    },
    {
        id: 'toxicity',
        icon: 'images/achievements/toxicity.png',
        title: 'Toxicity',
        desc: 'Finish a Run with 60 Poison Slimes in your Roster.',
        reward: 5
    },
    {
        id: 'selfDefense',
        icon: 'images/achievements/selfDefense.png',
        title: 'Self Defense',
        desc: 'Clear a Boss wave without your Slimes attacking once.',
        reward: 10
    }
];

const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

export function isAchievementUnlocked(id) {
    return Boolean(gameState.achievements && gameState.achievements[id]);
}

/**
 * Unlock an achievement (idempotent). Awards its coin reward once and notifies
 * the UI via a custom event so a toast can be shown.
 */
export function grantAchievement(id) {
    const def = ACHIEVEMENT_BY_ID[id];
    if (!def) return false;
    if (isAchievementUnlocked(id)) return false;
    if (!gameState.achievements) gameState.achievements = {};
    gameState.achievements[id] = true;
    if (def.reward) {
        gameState.villageCoins = (gameState.villageCoins || 0) + def.reward;
    }
    saveStateToLocal();
    window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: { id, def } }));
    return true;
}

/** True if any owned equipment (slimes, best roster, village inventory) is +4. */
function hasLegendaryItem() {
    const pools = [
        ...(gameState.slimes || []),
        ...(gameState.bestRoster || []),
        ...(gameState.villageInventory || [])
    ];
    return pools.some(item => {
        if (item && Array.isArray(item.equipment)) {
            return item.equipment.some(eq => getEquipmentQuality(eq) >= 4);
        }
        return getEquipmentQuality(item) >= 4;
    });
}

/** Count slimes of a specialization in a roster snapshot. */
function countSpec(roster, spec) {
    const needle = String(spec || '').toLowerCase();
    return (roster || []).filter(s => String(s.specialization || '').toLowerCase() === needle).length;
}

/** Count slimes of an element (ice/fire/stone/poison) in a roster snapshot. */
function countElement(roster, element) {
    const needle = String(element || '').toLowerCase();
    return (roster || []).filter(s => String(s.type || '').toLowerCase().startsWith(needle)).length;
}

/** Fire an event-based achievement trigger (e.g. an enemy was defeated). */
export function notifyAchievementEvent(event, payload = {}) {
    if (event === 'runFinished') {
        const roster = payload.roster || [];
        const supports = countSpec(roster, 'support');
        const fighters = countSpec(roster, 'fighter');
        const tanks = countSpec(roster, 'tank');
        const wipedTiers = (payload.wipedTiers || []).slice();
        const allTiers = [10, 20, 30, 40, 50];
        if (supports >= 20 && fighters >= 20 && tanks >= 20) grantAchievement('holyTrinity');
        if (tanks >= 60) grantAchievement('theGreatWall');
        if (fighters >= 60) grantAchievement('theBestDefense');
        if (supports >= 60) grantAchievement('whyNot');
        if (countElement(roster, 'ice') >= 60) grantAchievement('winterIsComing');
        if (countElement(roster, 'fire') >= 60) grantAchievement('blazingHot');
        if (countElement(roster, 'stone') >= 60) grantAchievement('stonehead');
        if (countElement(roster, 'poison') >= 60) grantAchievement('toxicity');
        if (wipedTiers.length === 0) grantAchievement('ironMan');
        if (allTiers.every(t => wipedTiers.includes(t))) grantAchievement('paperThin');
        return;
    }
    ACHIEVEMENTS.forEach(def => {
        if (def.event !== event) return;
        if (event === 'enemyDefeated' && def.matchesEnemy && payload.enemyId !== def.matchesEnemy) return;
        if (def.condition && !def.condition(payload)) return;
        grantAchievement(def.id);
    });
}

/** Evaluate every state-based achievement against the current game state. */
export function checkAchievements() {
    ACHIEVEMENTS.forEach(def => {
        if (!def.check) return;
        if (isAchievementUnlocked(def.id)) return;
        try {
            if (def.check(gameState)) grantAchievement(def.id);
        } catch (_) { /* ignore predicate errors */ }
    });
}

/**
 * Render the Achievements panel into #achievementsPanel if present. Locked
 * achievements are shown dimmed; unlocked ones use the full glass styling with
 * their coin reward visible.
 */
export function renderAchievementsPanel() {
    const container = document.getElementById('achievementsList');
    if (!container) return;
    const unlockedCount = ACHIEVEMENTS.filter(a => isAchievementUnlocked(a.id)).length;
    const counter = document.getElementById('achievementsCount');
    if (counter) counter.textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`;
    container.innerHTML = ACHIEVEMENTS.map(def => {
        const unlocked = isAchievementUnlocked(def.id);
        return `
            <div class="achievement-card${unlocked ? ' unlocked' : ' locked'}">
                <img class="achievement-icon" src="${def.icon}" alt="">
                <div class="achievement-body">
                    <span class="achievement-title">${def.title}</span>
                    <span class="achievement-desc">${def.desc}</span>
                </div>
                <span class="achievement-reward">+${def.reward}<img src="images/logos/coin.png" alt="" class="achievement-coin"></span>
            </div>`;
    }).join('');
}

/** Map a slime element to its corresponding "obtain" achievement id. */
const ELEMENT_ACHIEVEMENT = {
    fire: 'fuego',
    ice: 'iceCream',
    poison: 'muksAndGrimers',
    stone: 'rocksAndRolls'
};

/** Trigger the elemental "obtain" achievement for a given slime type, if any. */
export function triggerElementAchievement(type) {
    const element = String(type || '').replace(/(Support|Fighter|Tank)$/i, '').toLowerCase();
    const id = ELEMENT_ACHIEVEMENT[element];
    if (id) grantAchievement(id);
}

/** Show a brief toast when an achievement is unlocked. */
export function initAchievementToasts() {
    window.addEventListener('achievement-unlocked', (e) => {
        const def = e.detail && e.detail.def;
        if (!def) return;
        let toast = document.getElementById('achievementToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'achievementToast';
            toast.className = 'achievement-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `
            <img class="achievement-icon" src="${def.icon}" alt="">
            <div class="achievement-toast-body">
                <span class="achievement-toast-label">Achievement Unlocked</span>
                <span class="achievement-title">${def.title}</span>
                <span class="achievement-desc">${def.desc}</span>
                <span class="achievement-reward">+${def.reward}<img src="images/logos/coin.png" alt="" class="achievement-coin"></span>
            </div>`;
        toast.classList.add('show');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 4000);
    });
}

