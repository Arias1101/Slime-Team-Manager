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
    getRegenUpgradeCost,
    buyRegenUpgrade,
    getDigestionLevel,
    getDigestionUpgradeCost,
    buyDigestionUpgrade,
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
    buyIntoxicationUpgrade
} from './state.js';
import { updateUI } from './ui.js';

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
    if ((gameState.maxWaveCleared || 0) >= 7) gameState.unlockedUpgrades.digestion = true;
    if (gameState.hasUsedDivision === true || (gameState.maxSlimesReached || 1) >= 2) gameState.unlockedUpgrades.selectionCard = true;

    if ((gameState.maxWaveCleared || 0) >= 10) {
        gameState.unlockedUpgrades.ignition = true;
        gameState.unlockedUpgrades.glaciation = true;
    }

    if ((gameState.maxWaveCleared || 0) >= 20) {
        gameState.unlockedUpgrades.intoxication = true;
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

    const upgradeSelectionCardEl = document.getElementById('upgradeSelectionCard');
    if (upgradeSelectionCardEl) {
        if (gameState.unlockedUpgrades.selectionCard) upgradeSelectionCardEl.classList.remove('hidden');
        else upgradeSelectionCardEl.classList.add('hidden');
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

        upgradeSlimeCountEl.textContent = currentSlimes;

        if (currentSlimes >= 60) {
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

    // Upgrade 5: Digestion
    const upgradeDigestionValueEl = document.getElementById('upgradeDigestionValue');
    const upgradeDigestionCostEl = document.getElementById('upgradeDigestionCost');
    const btnUpgradeDigestionEl = document.getElementById('btnUpgradeDigestion');

    if (upgradeDigestionValueEl && upgradeDigestionCostEl && btnUpgradeDigestionEl) {
        const digestionLvl = getDigestionLevel();
        const slimesCount = 1 + digestionLvl;
        const bestRosterCount = (gameState.bestRoster && gameState.bestRoster.length) ? gameState.bestRoster.length : (gameState.slimes ? gameState.slimes.length : 1);
        const costDigestion = getDigestionUpgradeCost();

        upgradeDigestionValueEl.textContent = slimesCount;
        upgradeDigestionCostEl.textContent = `${costDigestion} 🍖`;

        const canUpgradeDigestion = slimesCount < bestRosterCount;
        const canAffordDigestion = (gameState.scraps || 0) >= costDigestion && canUpgradeDigestion;

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

    // Upgrade 6: Selection
    const upgradeSelectionCostEl = document.getElementById('upgradeSelectionCost');
    const btnUpgradeSelectionEl = document.getElementById('btnUpgradeSelection');

    if (upgradeSelectionCostEl && btnUpgradeSelectionEl) {
        const isBought = gameState.unlockedUpgrades && gameState.unlockedUpgrades.selection;
        if (isBought) {
            upgradeSelectionCostEl.textContent = 'UNLOCKED';
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

    // Upgrade 7: Ignition
    const upgradeIgnitionValueEl = document.getElementById('upgradeIgnitionValue');
    const upgradeIgnitionCostEl = document.getElementById('upgradeIgnitionCost');
    const btnUpgradeIgnitionEl = document.getElementById('btnUpgradeIgnition');

    if (upgradeIgnitionValueEl && upgradeIgnitionCostEl && btnUpgradeIgnitionEl) {
        const ignitionLvl = getIgnitionLevel();
        const ignitionChancePct = ignitionLvl * 2;
        upgradeIgnitionValueEl.textContent = `${ignitionChancePct}%`;

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

    // Upgrade 9: Petrification (Hidden until further notice)
    const upgradePetrificationCardEl = document.getElementById('upgradePetrificationCard');
    if (upgradePetrificationCardEl) upgradePetrificationCardEl.style.display = 'none';

    // Upgrade 10: Intoxication
    const upgradeIntoxicationValueEl = document.getElementById('upgradeIntoxicationValue');
    const upgradeIntoxicationCostEl = document.getElementById('upgradeIntoxicationCost');
    const btnUpgradeIntoxicationEl = document.getElementById('btnUpgradeIntoxication');

    if (upgradeIntoxicationValueEl && upgradeIntoxicationCostEl && btnUpgradeIntoxicationEl) {
        const intoxicationLvl = getIntoxicationLevel();
        const intoxicationChancePct = intoxicationLvl * 2;
        upgradeIntoxicationValueEl.textContent = `${intoxicationChancePct}%`;

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

    const btnUpgradeSelectionEl = document.getElementById('btnUpgradeSelection');
    if (btnUpgradeSelectionEl) {
        btnUpgradeSelectionEl.addEventListener('click', () => {
            const success = buySelectionUpgrade();
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

    updateUpgradesUI();
}
