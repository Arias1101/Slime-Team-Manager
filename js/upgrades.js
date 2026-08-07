/**
 * Upgrades Module - Handles Upgrade Definitions, Rendering, Unlocking & Purchase Actions
 */

import {
    gameState,
    getArmySizeUpgradeCost,
    buyArmySizeUpgrade,
    getAscensionUpgradeCost,
    getAscendedSlimeCount,
    buyAscensionUpgrade,
    getSlimeDamage,
    getAugmentationUpgradeCost,
    buyAugmentationUpgrade,
    getSlimeRegen,
    getRegenMax,
    getRegenUpgradeCost,
    buyRegenUpgrade,
    getDigestionLevel,
    getDigestionUpgradeCost,
    buyDigestionUpgrade,
    getIncubationLevel,
    getIncubationUpgradeCost,
    buyIncubationUpgrade,
    getSelectionUpgradeCost,
    buySelectionUpgrade,
    getIgnitionLevel,
    getIgnitionUpgradeCost,
    buyIgnitionUpgrade,
    getGlaciationLevel,
    getGlaciationUpgradeCost,
    buyGlaciationUpgrade,
    getPetrificationLevel,
    getPetrificationUpgradeCost,
    buyPetrificationUpgrade,
    getIntoxicationLevel,
    getIntoxicationUpgradeCost,
    buyIntoxicationUpgrade,
    getAfkScrapCeilingLevel,
    getAfkScrapCeiling,
    getAfkScrapCeilingUpgradeCost,
    buyAfkScrapCeilingUpgrade,
    getAfkScrapLevel,
    getAfkScrapsPerMinute,
    getAfkScrapUpgradeCost,
    buyAfkScrapUpgrade,
    getEvolutionUpgradeCost,
    buyEvolutionUpgrade,
    getExaltationUpgradeCost,
    buyExaltationUpgrade
} from './state.js';
import { updateUI } from './ui.js';

let upgradeCardOrderInitialized = false;
const seenVisibleUpgradeCards = new Set();

function isVisibleUpgradeCard(card) {
    return !card.classList.contains('hidden') && card.style.display !== 'none';
}

function isMaxedUpgradeCard(card) {
    return Array.from(card.querySelectorAll('.upgrade-cost')).some(cost => cost.textContent.trim() === 'MAX');
}

// Called once at startup, after every persisted MAX state has been rendered.
export function sortMaxedUpgradeCardsOnPageLoad() {
    const container = document.getElementById('upgradesContainer');
    if (!container) return;
    const cards = Array.from(container.children).filter(card => card.classList.contains('upgrade-card'));
    const activeCards = cards.filter(card => !isVisibleUpgradeCard(card) || !isMaxedUpgradeCard(card));
    const maxedCards = cards.filter(card => isVisibleUpgradeCard(card) && isMaxedUpgradeCard(card));
    [...activeCards, ...maxedCards].forEach(card => container.appendChild(card));
}
// Keep the live upgrade grid stable: only new unlocks are inserted, before the maxed-card tail.
function stabilizeUpgradeCardOrder() {
    const container = document.getElementById('upgradesContainer');
    if (!container) return;
    const cards = Array.from(container.children).filter(card => card.classList.contains('upgrade-card'));
    const visibleCards = cards.filter(isVisibleUpgradeCard);

    if (!upgradeCardOrderInitialized) {
        const activeCards = visibleCards.filter(card => !isMaxedUpgradeCard(card));
        const maxedCards = visibleCards.filter(isMaxedUpgradeCard);
        [...activeCards, ...maxedCards].forEach(card => container.appendChild(card));
        visibleCards.forEach(card => seenVisibleUpgradeCards.add(card.id));
        upgradeCardOrderInitialized = true;
        return;
    }

    visibleCards.filter(card => !seenVisibleUpgradeCards.has(card.id)).forEach(card => {
        const firstVisibleMaxedCard = Array.from(container.children).find(candidate =>
            candidate.classList.contains('upgrade-card') && isVisibleUpgradeCard(candidate) && isMaxedUpgradeCard(candidate)
        );
        if (firstVisibleMaxedCard) container.insertBefore(card, firstVisibleMaxedCard);
        else container.appendChild(card);
        seenVisibleUpgradeCards.add(card.id);
    });
}

/**
 * Toggle yellow/orange border for upgrades that have never been purchased (level 0)
 */
function setUpgradeLevelZero(cardEl, isLevelZero) {
    if (!cardEl) return;
    cardEl.classList.toggle('level-zero', !!isLevelZero);
}

/**
 * Update the display state of all active upgrades (visibility, labels, costs, affordable button states)
 */
export function updateUpgradesUI() {
    const upgradesSectionEl = document.getElementById('upgradesSection');
    const upgradeArmySizeCardEl = document.getElementById('upgradeArmySizeCard');
    const upgradeAscensionCardEl = document.getElementById('upgradeAscensionCard');
    const upgradeAugmentationCardEl = document.getElementById('upgradeAugmentationCard');
    const upgradeRegenCardEl = document.getElementById('upgradeRegenCard');
    const upgradeDigestionCardEl = document.getElementById('upgradeDigestionCard');
    const upgradeIgnitionCardEl = document.getElementById('upgradeIgnitionCard');
    const upgradeGlaciationCardEl = document.getElementById('upgradeGlaciationCard');

    if (!gameState.unlockedUpgrades) {
        gameState.unlockedUpgrades = {
            division: false,
            ascension: false,
            augmentation: false,
            regen: false,
            digestion: false,
            ignition: false,
            glaciation: false
        };
    }

    const totalScore = gameState.score || 0;

    // Check & permanently activate upgrade unlock flags
    if (totalScore >= 1) gameState.unlockedUpgrades.division = true;

    const currentSlimeCount = gameState.slimes ? gameState.slimes.length : 1;
    if (currentSlimeCount > (gameState.maxSlimesReached || 1)) {
        gameState.maxSlimesReached = currentSlimeCount;
    }
    if ((gameState.maxSlimesReached || 1) >= 5) gameState.unlockedUpgrades.ascension = true;

    if (totalScore >= 10) gameState.unlockedUpgrades.augmentation = true;
    if (gameState.hasSlimeDied === true) gameState.unlockedUpgrades.regen = true;
    if ((gameState.maxWaveCleared || 0) >= 7) {
        gameState.unlockedUpgrades.digestion = true;
        gameState.unlockedUpgrades.incubation = true;
    }
    // Selection appears permanently once the army has reached its full 60-slime roster for the first time.
    if ((gameState.maxSlimesReached || 1) >= 60) gameState.unlockedUpgrades.selectionCard = true;

    if ((gameState.maxWaveCleared || 0) >= 10) {
        gameState.unlockedUpgrades.ignition = true;
        gameState.unlockedUpgrades.glaciation = true;
        gameState.unlockedUpgrades.evolutionCard = true;
    }

    const currentAscendedCount = getAscendedSlimeCount();
    gameState.maxAscendedSlimesReached = Math.max(gameState.maxAscendedSlimesReached || 0, currentAscendedCount);
    if ((gameState.maxAscendedSlimesReached || 0) >= 60) {
        gameState.unlockedUpgrades.exaltationCard = true;
    }

    if ((gameState.maxWaveCleared || 0) >= 20) {
        gameState.unlockedUpgrades.intoxication = true;
    }
    if ((gameState.maxWaveCleared || 0) >= 40) {
        gameState.unlockedUpgrades.petrification = true;
    }

    // Render upgrade card visibility based on permanent unlock flags
    if (upgradeArmySizeCardEl) {
        if (gameState.unlockedUpgrades.division) upgradeArmySizeCardEl.classList.remove('hidden');
        else upgradeArmySizeCardEl.classList.add('hidden');
    }

    if (upgradeAscensionCardEl) {
        if (gameState.unlockedUpgrades.ascension) upgradeAscensionCardEl.classList.remove('hidden');
        else upgradeAscensionCardEl.classList.add('hidden');
    }

    if (upgradeAugmentationCardEl) {
        if (gameState.unlockedUpgrades.augmentation) upgradeAugmentationCardEl.classList.remove('hidden');
        else upgradeAugmentationCardEl.classList.add('hidden');
    }

    if (upgradeRegenCardEl) {
        if (gameState.unlockedUpgrades.regen) upgradeRegenCardEl.classList.remove('hidden');
        else upgradeRegenCardEl.classList.add('hidden');
    }

    if (upgradeDigestionCardEl) {
        if (gameState.unlockedUpgrades.digestion) upgradeDigestionCardEl.classList.remove('hidden');
        else upgradeDigestionCardEl.classList.add('hidden');
    }

    const upgradeIncubationCardEl = document.getElementById('upgradeIncubationCard');
    if (upgradeIncubationCardEl) {
        if (gameState.unlockedUpgrades.incubation) upgradeIncubationCardEl.classList.remove('hidden');
        else upgradeIncubationCardEl.classList.add('hidden');
    }

    const upgradeSelectionCardEl = document.getElementById('upgradeSelectionCard');
    if (upgradeSelectionCardEl) {
        if (gameState.unlockedUpgrades.selectionCard) upgradeSelectionCardEl.classList.remove('hidden');
        else upgradeSelectionCardEl.classList.add('hidden');
    }

    const upgradeEvolutionCardEl = document.getElementById('upgradeEvolutionCard');
    if (upgradeEvolutionCardEl) {
        if (gameState.unlockedUpgrades.evolutionCard) upgradeEvolutionCardEl.classList.remove('hidden');
        else upgradeEvolutionCardEl.classList.add('hidden');
    }

    const upgradeExaltationCardEl = document.getElementById('upgradeExaltationCard');
    if (upgradeExaltationCardEl) {
        if (gameState.unlockedUpgrades.exaltationCard) upgradeExaltationCardEl.classList.remove('hidden');
        else upgradeExaltationCardEl.classList.add('hidden');
    }

    if (upgradeIgnitionCardEl) {
        if (gameState.unlockedUpgrades.ignition) upgradeIgnitionCardEl.classList.remove('hidden');
        else upgradeIgnitionCardEl.classList.add('hidden');
    }

    if (upgradeGlaciationCardEl) {
        if (gameState.unlockedUpgrades.glaciation) upgradeGlaciationCardEl.classList.remove('hidden');
        else upgradeGlaciationCardEl.classList.add('hidden');
    }

    const upgradeIntoxicationCardEl = document.getElementById('upgradeIntoxicationCard');
    if (upgradeIntoxicationCardEl) {
        if (gameState.unlockedUpgrades.intoxication) upgradeIntoxicationCardEl.classList.remove('hidden');
        else upgradeIntoxicationCardEl.classList.add('hidden');
    }

    // Upgrades Section Visibility (Appears under main window if at least 1 upgrade is permanently unlocked)
    const anyUnlocked = Object.values(gameState.unlockedUpgrades).some(val => val === true);
    if (upgradesSectionEl) {
        if (anyUnlocked) {
            upgradesSectionEl.classList.remove('hidden');
        } else {
            upgradesSectionEl.classList.add('hidden');
        }
    }

    // Upgrade 1: Army Size (Division)
    const upgradeSlimeCountEl = document.getElementById('upgradeSlimeCount');
    const upgradeArmySizeCostEl = document.getElementById('upgradeArmySizeCost');
    const btnUpgradeArmySizeEl = document.getElementById('btnUpgradeArmySize');

    if (upgradeSlimeCountEl && upgradeArmySizeCostEl && btnUpgradeArmySizeEl) {
        const currentSlimes = gameState.slimes ? gameState.slimes.length : (gameState.armySize || 1);
        const cost1 = getArmySizeUpgradeCost();
        const reservedSlots = new Set();
        (gameState.slimes || []).forEach(slime => { if (slime.slotIndex !== undefined && slime.slotIndex !== null) reservedSlots.add(slime.slotIndex); });
        (gameState.bestRoster || []).forEach(slime => { if (slime.slotIndex !== undefined && slime.slotIndex !== null) reservedSlots.add(slime.slotIndex); });

        upgradeSlimeCountEl.textContent = currentSlimes;
        setUpgradeLevelZero(upgradeArmySizeCardEl, gameState.hasUsedDivision !== true);

        if (reservedSlots.size >= 60) {
            upgradeArmySizeCostEl.textContent = 'MAX';
            btnUpgradeArmySizeEl.setAttribute('disabled', 'disabled');
            btnUpgradeArmySizeEl.classList.add('disabled');
            btnUpgradeArmySizeEl.classList.remove('affordable');
        } else {
            upgradeArmySizeCostEl.textContent = `${cost1} 🍖`;
            const canAfford1 = (gameState.scraps || 0) >= cost1;
            if (canAfford1) {
                btnUpgradeArmySizeEl.removeAttribute('disabled');
                btnUpgradeArmySizeEl.classList.remove('disabled');
                btnUpgradeArmySizeEl.classList.add('affordable');
            } else {
                btnUpgradeArmySizeEl.setAttribute('disabled', 'disabled');
                btnUpgradeArmySizeEl.classList.add('disabled');
                btnUpgradeArmySizeEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade 2: Ascension
    const upgradeAscendedCountEl = document.getElementById('upgradeAscendedCount');
    const upgradeAscensionCostEl = document.getElementById('upgradeAscensionCost');
    const btnUpgradeAscensionEl = document.getElementById('btnUpgradeAscension');

    if (upgradeAscendedCountEl && upgradeAscensionCostEl && btnUpgradeAscensionEl) {
        const ascendedCount = getAscendedSlimeCount();
        const cost2 = getAscensionUpgradeCost();
        const unascendedCount = gameState.slimes ? gameState.slimes.filter(s => !s.ascended).length : 0;

        upgradeAscendedCountEl.textContent = ascendedCount;
        setUpgradeLevelZero(upgradeAscensionCardEl, (gameState.maxAscendedSlimesReached || 0) === 0 && ascendedCount === 0);
        upgradeAscensionCostEl.textContent = `${cost2} 🍖`;

        const canAfford2 = (gameState.scraps || 0) >= cost2 && unascendedCount > 0;
        if (canAfford2) {
            btnUpgradeAscensionEl.removeAttribute('disabled');
            btnUpgradeAscensionEl.classList.remove('disabled');
            btnUpgradeAscensionEl.classList.add('affordable');
        } else {
            btnUpgradeAscensionEl.setAttribute('disabled', 'disabled');
            btnUpgradeAscensionEl.classList.add('disabled');
            btnUpgradeAscensionEl.classList.remove('affordable');
        }
    }

    // Upgrade 3: Augmentation
    const upgradeDamageValueEl = document.getElementById('upgradeDamageValue');
    const upgradeAugmentationCostEl = document.getElementById('upgradeAugmentationCost');
    const btnUpgradeAugmentationEl = document.getElementById('btnUpgradeAugmentation');

    if (upgradeDamageValueEl && upgradeAugmentationCostEl && btnUpgradeAugmentationEl) {
        const currentDamage = getSlimeDamage();
        const cost3 = getAugmentationUpgradeCost();

        upgradeDamageValueEl.textContent = currentDamage;
        setUpgradeLevelZero(upgradeAugmentationCardEl, currentDamage <= 1);
        upgradeAugmentationCostEl.textContent = `${cost3} 🍖`;

        const canAfford3 = (gameState.scraps || 0) >= cost3;
        if (canAfford3) {
            btnUpgradeAugmentationEl.removeAttribute('disabled');
            btnUpgradeAugmentationEl.classList.remove('disabled');
            btnUpgradeAugmentationEl.classList.add('affordable');
        } else {
            btnUpgradeAugmentationEl.setAttribute('disabled', 'disabled');
            btnUpgradeAugmentationEl.classList.add('disabled');
            btnUpgradeAugmentationEl.classList.remove('affordable');
        }
    }

    // Upgrade 4: Regeneration
    const upgradeRegenValueEl = document.getElementById('upgradeRegenValue');
    const upgradeRegenCostEl = document.getElementById('upgradeRegenCost');
    const btnUpgradeRegenEl = document.getElementById('btnUpgradeRegen');

    if (upgradeRegenValueEl && upgradeRegenCostEl && btnUpgradeRegenEl) {
        const currentRegen = getSlimeRegen();
        const cost4 = getRegenUpgradeCost();

        upgradeRegenValueEl.textContent = currentRegen;
        setUpgradeLevelZero(upgradeRegenCardEl, currentRegen <= 0);

        const isRegenMaxed = currentRegen >= getRegenMax();
        if (isRegenMaxed) {
            upgradeRegenCostEl.textContent = 'MAX';
            btnUpgradeRegenEl.setAttribute('disabled', 'disabled');
            btnUpgradeRegenEl.classList.add('disabled');
            btnUpgradeRegenEl.classList.remove('affordable');
        } else {
            upgradeRegenCostEl.textContent = `${cost4} 🍖`;

            const canAfford4 = (gameState.scraps || 0) >= cost4;
            if (canAfford4) {
                btnUpgradeRegenEl.removeAttribute('disabled');
                btnUpgradeRegenEl.classList.remove('disabled');
                btnUpgradeRegenEl.classList.add('affordable');
            } else {
                btnUpgradeRegenEl.setAttribute('disabled', 'disabled');
                btnUpgradeRegenEl.classList.add('disabled');
                btnUpgradeRegenEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade 5: Digestion
    const upgradeDigestionValueEl = document.getElementById('upgradeDigestionValue');
    const upgradeDigestionCostEl = document.getElementById('upgradeDigestionCost');
    const btnUpgradeDigestionEl = document.getElementById('btnUpgradeDigestion');

    // Upgrade 5: Digestion
    if (upgradeDigestionValueEl && upgradeDigestionCostEl && btnUpgradeDigestionEl) {
        const digestionLvl = getDigestionLevel();
        const slimesCount = 1 + digestionLvl;
        const bestRosterCount = (gameState.bestRoster && gameState.bestRoster.length) ? gameState.bestRoster.length : (gameState.slimes ? gameState.slimes.length : 1);

        upgradeDigestionValueEl.textContent = slimesCount;
        setUpgradeLevelZero(upgradeDigestionCardEl, digestionLvl <= 0);

        if (slimesCount >= 60) {
            upgradeDigestionCostEl.textContent = 'MAX';
            btnUpgradeDigestionEl.setAttribute('disabled', 'disabled');
            btnUpgradeDigestionEl.classList.add('disabled');
            btnUpgradeDigestionEl.classList.remove('affordable');
        } else if (slimesCount >= bestRosterCount) {
            const costDigestion = getDigestionUpgradeCost();
            upgradeDigestionCostEl.textContent = `${costDigestion} 🍖`;
            btnUpgradeDigestionEl.setAttribute('disabled', 'disabled');
            btnUpgradeDigestionEl.classList.add('disabled');
            btnUpgradeDigestionEl.classList.remove('affordable');
        } else {
            const costDigestion = getDigestionUpgradeCost();
            upgradeDigestionCostEl.textContent = `${costDigestion} 🍖`;

            const canAffordDigestion = (gameState.scraps || 0) >= costDigestion;
            if (canAffordDigestion) {
                btnUpgradeDigestionEl.removeAttribute('disabled');
                btnUpgradeDigestionEl.classList.remove('disabled');
                btnUpgradeDigestionEl.classList.add('affordable');
            } else {
                btnUpgradeDigestionEl.setAttribute('disabled', 'disabled');
                btnUpgradeDigestionEl.classList.add('disabled');
                btnUpgradeDigestionEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade: Incubation
    const upgradeIncubationValueEl = document.getElementById('upgradeIncubationValue');
    const upgradeIncubationCostEl = document.getElementById('upgradeIncubationCost');
    const btnUpgradeIncubationEl = document.getElementById('btnUpgradeIncubation');

    if (upgradeIncubationValueEl && upgradeIncubationCostEl && btnUpgradeIncubationEl) {
        const autoEatLevel = getIncubationLevel();
        upgradeIncubationValueEl.textContent = autoEatLevel > 0 ? 'ON' : 'OFF';
        setUpgradeLevelZero(upgradeIncubationCardEl, autoEatLevel <= 0);

        if (autoEatLevel > 0) {
            upgradeIncubationCostEl.textContent = 'MAX';
            btnUpgradeIncubationEl.setAttribute('disabled', 'disabled');
            btnUpgradeIncubationEl.classList.add('disabled');
            btnUpgradeIncubationEl.classList.remove('affordable');
        } else {
            const costIncub = getIncubationUpgradeCost();
            upgradeIncubationCostEl.textContent = `${costIncub} 🍖`;
            const canAffordIncub = (gameState.scraps || 0) >= costIncub;
            btnUpgradeIncubationEl.toggleAttribute('disabled', !canAffordIncub);
            btnUpgradeIncubationEl.classList.toggle('disabled', !canAffordIncub);
            btnUpgradeIncubationEl.classList.toggle('affordable', canAffordIncub);
        }
    }
    // Upgrade 6: Selection
    const upgradeSelectionCostEl = document.getElementById('upgradeSelectionCost');
    const btnUpgradeSelectionEl = document.getElementById('btnUpgradeSelection');

    if (upgradeSelectionCostEl && btnUpgradeSelectionEl) {
        const isBought = gameState.unlockedUpgrades && gameState.unlockedUpgrades.selection;
        setUpgradeLevelZero(upgradeSelectionCardEl, !isBought);
        if (isBought) {
            upgradeSelectionCostEl.textContent = 'MAX';
            btnUpgradeSelectionEl.setAttribute('disabled', 'disabled');
            btnUpgradeSelectionEl.classList.add('disabled');
            btnUpgradeSelectionEl.classList.remove('affordable');
        } else {
            const costSelection = getSelectionUpgradeCost();
            upgradeSelectionCostEl.textContent = `${costSelection} 🍖`;

            const canAffordSelection = (gameState.scraps || 0) >= costSelection;
            if (canAffordSelection) {
                btnUpgradeSelectionEl.removeAttribute('disabled');
                btnUpgradeSelectionEl.classList.remove('disabled');
                btnUpgradeSelectionEl.classList.add('affordable');
            } else {
                btnUpgradeSelectionEl.setAttribute('disabled', 'disabled');
                btnUpgradeSelectionEl.classList.add('disabled');
                btnUpgradeSelectionEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade: Evolution
    const upgradeEvolutionCostEl = document.getElementById('upgradeEvolutionCost');
    const btnUpgradeEvolutionEl = document.getElementById('btnUpgradeEvolution');

    if (upgradeEvolutionCostEl && btnUpgradeEvolutionEl) {
        const isBoughtEvo = gameState.unlockedUpgrades && gameState.unlockedUpgrades.evolution;
        setUpgradeLevelZero(upgradeEvolutionCardEl, !isBoughtEvo);
        if (isBoughtEvo) {
            upgradeEvolutionCostEl.textContent = 'MAX';
            btnUpgradeEvolutionEl.setAttribute('disabled', 'disabled');
            btnUpgradeEvolutionEl.classList.add('disabled');
            btnUpgradeEvolutionEl.classList.remove('affordable');
        } else {
            const costEvo = getEvolutionUpgradeCost();
            upgradeEvolutionCostEl.textContent = `${costEvo} 🍖`;

            const canAffordEvo = (gameState.scraps || 0) >= costEvo;
            if (canAffordEvo) {
                btnUpgradeEvolutionEl.removeAttribute('disabled');
                btnUpgradeEvolutionEl.classList.remove('disabled');
                btnUpgradeEvolutionEl.classList.add('affordable');
            } else {
                btnUpgradeEvolutionEl.setAttribute('disabled', 'disabled');
                btnUpgradeEvolutionEl.classList.add('disabled');
                btnUpgradeEvolutionEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade: Exaltation
    const upgradeExaltationCostEl = document.getElementById('upgradeExaltationCost');
    const btnUpgradeExaltationEl = document.getElementById('btnUpgradeExaltation');

    if (upgradeExaltationCostEl && btnUpgradeExaltationEl) {
        const isBoughtExalt = gameState.unlockedUpgrades && gameState.unlockedUpgrades.exaltation;
        setUpgradeLevelZero(upgradeExaltationCardEl, !isBoughtExalt);
        if (isBoughtExalt) {
            upgradeExaltationCostEl.textContent = 'MAX';
            btnUpgradeExaltationEl.setAttribute('disabled', 'disabled');
            btnUpgradeExaltationEl.classList.add('disabled');
            btnUpgradeExaltationEl.classList.remove('affordable');
        } else {
            const costExalt = getExaltationUpgradeCost();
            upgradeExaltationCostEl.textContent = `${costExalt} 🍖`;

            const canAffordExalt = (gameState.scraps || 0) >= costExalt;
            if (canAffordExalt) {
                btnUpgradeExaltationEl.removeAttribute('disabled');
                btnUpgradeExaltationEl.classList.remove('disabled');
                btnUpgradeExaltationEl.classList.add('affordable');
            } else {
                btnUpgradeExaltationEl.setAttribute('disabled', 'disabled');
                btnUpgradeExaltationEl.classList.add('disabled');
                btnUpgradeExaltationEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade 7: Ignition
    const upgradeIgnitionValueEl = document.getElementById('upgradeIgnitionValue');
    const upgradeIgnitionCostEl = document.getElementById('upgradeIgnitionCost');
    const btnUpgradeIgnitionEl = document.getElementById('btnUpgradeIgnition');

    if (upgradeIgnitionValueEl && upgradeIgnitionCostEl && btnUpgradeIgnitionEl) {
        const ignitionLvl = getIgnitionLevel();
        const ignitionChancePct = ignitionLvl * 2;
        upgradeIgnitionValueEl.textContent = `${ignitionChancePct}%`;
        setUpgradeLevelZero(upgradeIgnitionCardEl, ignitionLvl <= 0);

        if (ignitionLvl >= 10) {
            upgradeIgnitionCostEl.textContent = 'MAX';
            btnUpgradeIgnitionEl.setAttribute('disabled', 'disabled');
            btnUpgradeIgnitionEl.classList.add('disabled');
            btnUpgradeIgnitionEl.classList.remove('affordable');
        } else {
            const cost5 = getIgnitionUpgradeCost();
            upgradeIgnitionCostEl.textContent = `${cost5} 🍖`;

            const canAfford5 = (gameState.scraps || 0) >= cost5;
            if (canAfford5) {
                btnUpgradeIgnitionEl.removeAttribute('disabled');
                btnUpgradeIgnitionEl.classList.remove('disabled');
                btnUpgradeIgnitionEl.classList.add('affordable');
            } else {
                btnUpgradeIgnitionEl.setAttribute('disabled', 'disabled');
                btnUpgradeIgnitionEl.classList.add('disabled');
                btnUpgradeIgnitionEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade 8: Glaciation
    const upgradeGlaciationValueEl = document.getElementById('upgradeGlaciationValue');
    const upgradeGlaciationCostEl = document.getElementById('upgradeGlaciationCost');
    const btnUpgradeGlaciationEl = document.getElementById('btnUpgradeGlaciation');

    if (upgradeGlaciationValueEl && upgradeGlaciationCostEl && btnUpgradeGlaciationEl) {
        const glaciationLvl = getGlaciationLevel();
        const glaciationChancePct = glaciationLvl * 2;
        upgradeGlaciationValueEl.textContent = `${glaciationChancePct}%`;
        setUpgradeLevelZero(upgradeGlaciationCardEl, glaciationLvl <= 0);

        if (glaciationLvl >= 10) {
            upgradeGlaciationCostEl.textContent = 'MAX';
            btnUpgradeGlaciationEl.setAttribute('disabled', 'disabled');
            btnUpgradeGlaciationEl.classList.add('disabled');
            btnUpgradeGlaciationEl.classList.remove('affordable');
        } else {
            const cost6 = getGlaciationUpgradeCost();
            upgradeGlaciationCostEl.textContent = `${cost6} 🍖`;

            const canAfford6 = (gameState.scraps || 0) >= cost6;
            if (canAfford6) {
                btnUpgradeGlaciationEl.removeAttribute('disabled');
                btnUpgradeGlaciationEl.classList.remove('disabled');
                btnUpgradeGlaciationEl.classList.add('affordable');
            } else {
                btnUpgradeGlaciationEl.setAttribute('disabled', 'disabled');
                btnUpgradeGlaciationEl.classList.add('disabled');
                btnUpgradeGlaciationEl.classList.remove('affordable');
            }
        }
    }

    // Upgrade 9: Petrification
    const upgradePetrificationCardEl = document.getElementById('upgradePetrificationCard');
    if (upgradePetrificationCardEl) {
        if (gameState.unlockedUpgrades.petrification) upgradePetrificationCardEl.classList.remove('hidden');
        else upgradePetrificationCardEl.classList.add('hidden');
    }

    const upgradePetrificationValueEl = document.getElementById('upgradePetrificationValue');
    const upgradePetrificationCostEl = document.getElementById('upgradePetrificationCost');
    const btnUpgradePetrificationEl = document.getElementById('btnUpgradePetrification');

    if (upgradePetrificationValueEl && upgradePetrificationCostEl && btnUpgradePetrificationEl) {
        const petrificationLvl = getPetrificationLevel();
        const petrificationChancePct = petrificationLvl * 2;
        upgradePetrificationValueEl.textContent = String(petrificationChancePct) + '%';
        setUpgradeLevelZero(upgradePetrificationCardEl, petrificationLvl <= 0);

        if (petrificationLvl >= 10) {
            upgradePetrificationCostEl.textContent = 'MAX';
            btnUpgradePetrificationEl.setAttribute('disabled', 'disabled');
            btnUpgradePetrificationEl.classList.add('disabled');
            btnUpgradePetrificationEl.classList.remove('affordable');
        } else {
            const cost7 = getPetrificationUpgradeCost();
            upgradePetrificationCostEl.textContent = String(cost7) + ' ' + String.fromCodePoint(0x1F356);
            const canAfford7 = (gameState.scraps || 0) >= cost7;
            if (canAfford7) {
                btnUpgradePetrificationEl.removeAttribute('disabled');
                btnUpgradePetrificationEl.classList.remove('disabled');
                btnUpgradePetrificationEl.classList.add('affordable');
            } else {
                btnUpgradePetrificationEl.setAttribute('disabled', 'disabled');
                btnUpgradePetrificationEl.classList.add('disabled');
                btnUpgradePetrificationEl.classList.remove('affordable');
            }
        }
    }
    // Upgrade 10: Intoxication
    const upgradeIntoxicationValueEl = document.getElementById('upgradeIntoxicationValue');
    const upgradeIntoxicationCostEl = document.getElementById('upgradeIntoxicationCost');
    const btnUpgradeIntoxicationEl = document.getElementById('btnUpgradeIntoxication');

    if (upgradeIntoxicationValueEl && upgradeIntoxicationCostEl && btnUpgradeIntoxicationEl) {
        const intoxicationLvl = getIntoxicationLevel();
        const intoxicationChancePct = intoxicationLvl * 2;
        upgradeIntoxicationValueEl.textContent = `${intoxicationChancePct}%`;
        setUpgradeLevelZero(upgradeIntoxicationCardEl, intoxicationLvl <= 0);

        if (intoxicationLvl >= 10) {
            upgradeIntoxicationCostEl.textContent = 'MAX';
            btnUpgradeIntoxicationEl.setAttribute('disabled', 'disabled');
            btnUpgradeIntoxicationEl.classList.add('disabled');
            btnUpgradeIntoxicationEl.classList.remove('affordable');
        } else {
            const cost8 = getIntoxicationUpgradeCost();
            upgradeIntoxicationCostEl.textContent = `${cost8} 🍖`;

            const canAfford8 = (gameState.scraps || 0) >= cost8;
            if (canAfford8) {
                btnUpgradeIntoxicationEl.removeAttribute('disabled');
                btnUpgradeIntoxicationEl.classList.remove('disabled');
                btnUpgradeIntoxicationEl.classList.add('affordable');
            } else {
                btnUpgradeIntoxicationEl.setAttribute('disabled', 'disabled');
                btnUpgradeIntoxicationEl.classList.add('disabled');
                btnUpgradeIntoxicationEl.classList.remove('affordable');
            }
        }
    }

    // AFK reward upgrades
    const afkUpgrades = [
        [document.getElementById('upgradeAfkScrapCeilingCard'), document.getElementById('upgradeAfkScrapCeilingValue'), document.getElementById('upgradeAfkScrapCeilingCost'), document.getElementById('btnUpgradeAfkScrapCeiling'), getAfkScrapCeilingLevel(), getAfkScrapCeiling(), getAfkScrapCeilingUpgradeCost(), ''],
        [document.getElementById('upgradeAfkScrapCard'), document.getElementById('upgradeAfkScrapValue'), document.getElementById('upgradeAfkScrapCost'), document.getElementById('btnUpgradeAfkScrap'), getAfkScrapLevel(), getAfkScrapsPerMinute(), getAfkScrapUpgradeCost(), '/min']
    ];
    afkUpgrades.forEach(([card, value, cost, button, level, current, nextCost, suffix]) => {
        if (!card || !value || !cost || !button) return;
        const afkUnlocked = getIncubationLevel() > 0;
        card.classList.toggle('hidden', !afkUnlocked);
        if (!afkUnlocked) return;
        value.textContent = String(current) + suffix;
        cost.textContent = String(nextCost) + ' ' + String.fromCodePoint(0x1F356);
        setUpgradeLevelZero(card, level === 0);
        const canAfford = (gameState.scraps || 0) >= nextCost;
        button.classList.toggle('disabled', !canAfford);
        button.classList.toggle('affordable', canAfford);
        if (canAfford) button.removeAttribute('disabled');
        else button.setAttribute('disabled', 'disabled');
    });
    // Update Upgrades Tab button label with affordable count badge: "🧪 Upgrades (X)" or "🧪 Upgrades"
    // Only count visible, unlocked, enabled, affordable upgrade cards.
    const allUpgradeButtons = document.querySelectorAll('#upgradesContainer .upgrade-card .btn-plus');
    let affordableCount = 0;
    allUpgradeButtons.forEach(btn => {
        const card = btn.closest('.upgrade-card');
        if (!card || !isVisibleUpgradeCard(card)) return;
        if (btn.hasAttribute('disabled') || btn.classList.contains('disabled')) return;
        if (!btn.classList.contains('affordable')) return;
        affordableCount++;
    });

    const tabBtnUpgradesEl = document.getElementById('tabBtnUpgrades');
    if (tabBtnUpgradesEl) {
        tabBtnUpgradesEl.textContent = affordableCount > 0 ? `🧪 Upgrades (${affordableCount})` : `🧪 Upgrades`;
    }


    document.querySelectorAll('#upgradesContainer .upgrade-card').forEach(card => {
        if (isMaxedUpgradeCard(card)) card.classList.remove('level-zero');
    });
}

/**
 * Initialize Upgrade Button Click Listeners
 */
export function initUpgradesModule() {
    const btnUpgradeArmySizeEl = document.getElementById('btnUpgradeArmySize');
    if (btnUpgradeArmySizeEl) {
        btnUpgradeArmySizeEl.addEventListener('click', () => {
            const success = buyArmySizeUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeAscensionEl = document.getElementById('btnUpgradeAscension');
    if (btnUpgradeAscensionEl) {
        btnUpgradeAscensionEl.addEventListener('click', () => {
            const success = buyAscensionUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeAugmentationEl = document.getElementById('btnUpgradeAugmentation');
    if (btnUpgradeAugmentationEl) {
        btnUpgradeAugmentationEl.addEventListener('click', () => {
            const success = buyAugmentationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeRegenEl = document.getElementById('btnUpgradeRegen');
    if (btnUpgradeRegenEl) {
        btnUpgradeRegenEl.addEventListener('click', () => {
            const success = buyRegenUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeDigestionEl = document.getElementById('btnUpgradeDigestion');
    if (btnUpgradeDigestionEl) {
        btnUpgradeDigestionEl.addEventListener('click', () => {
            const success = buyDigestionUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeIncubationEl = document.getElementById('btnUpgradeIncubation');
    if (btnUpgradeIncubationEl) {
        btnUpgradeIncubationEl.addEventListener('click', () => {
            const success = buyIncubationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeSelectionEl = document.getElementById('btnUpgradeSelection');
    if (btnUpgradeSelectionEl) {
        btnUpgradeSelectionEl.addEventListener('click', () => {
            const success = buySelectionUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeEvolutionEl = document.getElementById('btnUpgradeEvolution');
    if (btnUpgradeEvolutionEl) {
        btnUpgradeEvolutionEl.addEventListener('click', () => {
            const success = buyEvolutionUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeExaltationEl = document.getElementById('btnUpgradeExaltation');
    if (btnUpgradeExaltationEl) {
        btnUpgradeExaltationEl.addEventListener('click', () => {
            const success = buyExaltationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }



    const btnUpgradeIgnitionEl = document.getElementById('btnUpgradeIgnition');
    if (btnUpgradeIgnitionEl) {
        btnUpgradeIgnitionEl.addEventListener('click', () => {
            const success = buyIgnitionUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeGlaciationEl = document.getElementById('btnUpgradeGlaciation');
    if (btnUpgradeGlaciationEl) {
        btnUpgradeGlaciationEl.addEventListener('click', () => {
            const success = buyGlaciationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradePetrificationEl = document.getElementById('btnUpgradePetrification');
    if (btnUpgradePetrificationEl) {
        btnUpgradePetrificationEl.addEventListener('click', () => {
            const success = buyPetrificationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeIntoxicationEl = document.getElementById('btnUpgradeIntoxication');
    if (btnUpgradeIntoxicationEl) {
        btnUpgradeIntoxicationEl.addEventListener('click', () => {
            const success = buyIntoxicationUpgrade();
            if (success) {
                updateUI();
            }
        });
    }

    const btnUpgradeAfkScrapCeilingEl = document.getElementById('btnUpgradeAfkScrapCeiling');
    if (btnUpgradeAfkScrapCeilingEl) btnUpgradeAfkScrapCeilingEl.addEventListener('click', () => { if (buyAfkScrapCeilingUpgrade()) updateUI(); });
    const btnUpgradeAfkScrapEl = document.getElementById('btnUpgradeAfkScrap');
    if (btnUpgradeAfkScrapEl) btnUpgradeAfkScrapEl.addEventListener('click', () => { if (buyAfkScrapUpgrade()) updateUI(); });
    updateUpgradesUI();
}






