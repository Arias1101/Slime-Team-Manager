/**
 * Application Main Initializer
 */

import { loadStateFromLocal, addScraps, gameState, getFortificationLevel, getFortificationUpgradeCost, buyFortificationUpgrade, getSlimeRegen, getRegenMax } from './state.js';
import { initAuth, loginWithGoogle, logoutUser } from './auth.js';
import { startEngine, setGamePaused, isGamePaused } from './engine.js';
import { updateUI, setAuthScreenState, showFirebaseNotice, playSlimeRainRespawnAnimation, initSlimeModalListeners, initMainTabsListeners, openSlimeInspectorModal } from './ui.js';
import { initEnemiesModule, startNextWave, setAutoPlay, resetGameFull, rewindWaveState } from './enemies.js';
import { triggerRandomSlimeAttack, triggerSlimeEatLoot, initAscendedAutoAttacks } from './slimes.js';
import { initUpgradesModule } from './upgrades.js';
import { initShopModule } from './shop.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Local State
    loadStateFromLocal();

    // 2. Initialize Enemies, Upgrades, Shop, Ascended Auto-Attacks, Main Tabs & Modal Listeners
    initEnemiesModule();
    initUpgradesModule();
    initShopModule();
    initAscendedAutoAttacks();
    initSlimeModalListeners();
    initMainTabsListeners();
    const updateSelectionStateUI = () => {
        const valueEl = document.getElementById('upgradeSelectionValue');
        const selectionValue = gameState.unlockedUpgrades?.selection ? 'ON' : 'OFF';
        if (valueEl && valueEl.textContent !== selectionValue) valueEl.textContent = selectionValue;
    };

    const updateRegenCapUI = () => {
        const currentRegen = getSlimeRegen();
        const maxRegen = getRegenMax();
        if (currentRegen < maxRegen) return;

        const costEl = document.getElementById('upgradeRegenCost');
        const buttonEl = document.getElementById('btnUpgradeRegen');
        if (costEl && costEl.textContent !== 'MAX') costEl.textContent = 'MAX';
        if (buttonEl) {
            if (!buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
            if (!buttonEl.classList.contains('disabled')) buttonEl.classList.add('disabled');
            if (buttonEl.classList.contains('affordable')) buttonEl.classList.remove('affordable');
        }
    };
    const updateFortificationUI = () => {
        const cardEl = document.getElementById('upgradeFortificationCard');
        const valueEl = document.getElementById('upgradeFortificationValue');
        const costEl = document.getElementById('upgradeFortificationCost');
        const buttonEl = document.getElementById('btnUpgradeFortification');
        if (!cardEl || !valueEl || !costEl || !buttonEl) return;

        const isUnlocked = (gameState.maxWaveCleared || 0) >= 30;
        cardEl.classList.toggle('hidden', !isUnlocked);
        if (!isUnlocked) return;

        const level = getFortificationLevel();
        const cost = getFortificationUpgradeCost();
        const canAfford = (gameState.scraps || 0) >= cost;
        const valueText = `+${level} HP`;
        const costText = `${cost} ${String.fromCodePoint(0x1F356)}`;
        if (valueEl.textContent !== valueText) valueEl.textContent = valueText;
        if (costEl.textContent !== costText) costEl.textContent = costText;
        cardEl.classList.toggle('level-zero', level === 0);
        buttonEl.classList.toggle('disabled', !canAfford);
        buttonEl.classList.toggle('affordable', canAfford);
        if (canAfford && buttonEl.hasAttribute('disabled')) buttonEl.removeAttribute('disabled');
        else if (!canAfford && !buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
    };

    const fortificationButtonEl = document.getElementById('btnUpgradeFortification');
    if (fortificationButtonEl) {
        fortificationButtonEl.addEventListener('click', () => {
            if (buyFortificationUpgrade()) updateUI();
        });
    }
    let isApplyingAscensionMax = false;
    const moveMaxedUpgradesToBottom = () => {
        const container = document.getElementById('upgradesContainer');
        if (!container) return;
        const upgrades = Array.from(container.querySelectorAll(':scope > .upgrade-card'));
        const orderedUpgrades = [
            ...upgrades.filter(card => card.querySelector('.upgrade-cost')?.textContent.trim() !== 'MAX'),
            ...upgrades.filter(card => card.querySelector('.upgrade-cost')?.textContent.trim() === 'MAX')
        ];
        if (upgrades.some((card, index) => card !== orderedUpgrades[index])) {
            orderedUpgrades.forEach(card => container.appendChild(card));
        }
    };

    const updateAscensionMaxState = () => {
        if (isApplyingAscensionMax) return;
        const currentAscendedCount = (gameState.slimes || []).filter(slime => slime.ascended === true).length;
        gameState.maxAscendedSlimesReached = Math.max(gameState.maxAscendedSlimesReached || 0, currentAscendedCount);
        const ascendedCountEl = document.getElementById('upgradeAscendedCount');
        if (ascendedCountEl && ascendedCountEl.textContent !== String(gameState.maxAscendedSlimesReached)) {
            ascendedCountEl.textContent = String(gameState.maxAscendedSlimesReached);
        }

        const rosterSlimes = (gameState.bestRoster && gameState.bestRoster.length > 0) ? gameState.bestRoster : (gameState.slimes || []);
        const allRosterSlimesAscended = rosterSlimes.length > 0 && rosterSlimes.every(slime => slime.ascended === true);
        moveMaxedUpgradesToBottom();
        if (!allRosterSlimesAscended) return;

        isApplyingAscensionMax = true;
        const costEl = document.getElementById('upgradeAscensionCost');
        const buttonEl = document.getElementById('btnUpgradeAscension');
        if (costEl && costEl.textContent !== 'MAX') costEl.textContent = 'MAX';
        if (buttonEl) {
            if (!buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
            if (!buttonEl.classList.contains('disabled')) buttonEl.classList.add('disabled');
            if (buttonEl.classList.contains('affordable')) buttonEl.classList.remove('affordable');
        }
        moveMaxedUpgradesToBottom();
        isApplyingAscensionMax = false;
    };

    const upgradesContainerEl = document.getElementById('upgradesContainer');
    if (upgradesContainerEl) {
        new MutationObserver(() => { updateFortificationUI(); updateSelectionStateUI(); updateRegenCapUI(); updateAscensionMaxState(); }).observe(upgradesContainerEl, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        updateFortificationUI();
        updateSelectionStateUI();
        updateRegenCapUI();
        updateAscensionMaxState();
    }

    document.addEventListener('click', (event) => {
        const ripSlot = event.target.closest('.roster-grid-item.empty-slot');
        const rosterSlot = event.target.closest('.roster-grid-item');
        if (!rosterSlot) return;
        if (!ripSlot) {
            const portraitEl = document.getElementById('slimeModalPortrait');
            if (portraitEl) {
                portraitEl.classList.remove('is-dead');
                portraitEl.style.animation = '';
            }
            return;
        }

        const slotMatch = ripSlot.id.match(/roster_item_empty_(\d+)/);
        const slotIndex = slotMatch ? Number(slotMatch[1]) : -1;
        const fallenSlime = (gameState.bestRoster || []).find(slime => (slime.slotIndex || 0) === slotIndex);
        if (!fallenSlime) return;

        openSlimeInspectorModal({ ...fallenSlime, hp: 0, isDead: true });
        const portraitEl = document.getElementById('slimeModalPortrait');
        const type = fallenSlime.type || 'base';
        const folder = `images/slimes/${type === 'toxic' ? 'poison' : type}`;
        if (portraitEl) {
            portraitEl.src = `${folder}/die.png`;
            portraitEl.style.objectPosition = '-19px 0px';
            portraitEl.classList.add('is-dead');
            portraitEl.style.animation = 'none';
        }
        const rerollEl = document.getElementById('slimeModalRerollType');
        const killEl = document.getElementById('slimeModalKill');
        if (rerollEl) rerollEl.style.display = 'none';
        if (killEl) killEl.style.display = 'none';
    });

    let hasStartedGameAnimation = false;

    function startGameWithSkyDrop() {
        if (hasStartedGameAnimation) return;
        hasStartedGameAnimation = true;

        updateUI();
        playSlimeRainRespawnAnimation(() => {
            startNextWave();
        });
    }

    // 3. Bind Auth & Battle Control Buttons
    const gateBtnLogin = document.getElementById('gateBtnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const btnDemoMode = document.getElementById('btnDemoMode');

    const btnEat = document.getElementById('btnEat');
    const btnRewindWave = document.getElementById('btnRewindWave');
    const btnFeedCheat = document.getElementById('btnFeedCheat');
    const btnNextWave = document.getElementById('btnNextWave');
    const battlefieldCard = document.querySelector('.battlefield-card');

    const btnPlayAnonymous = document.getElementById('btnPlayAnonymous');

    if (gateBtnLogin) {
        gateBtnLogin.addEventListener('click', async () => {
            const success = await loginWithGoogle();
            if (!success) {
                showFirebaseNotice();
            }
        });
    }
    if (btnLogout) btnLogout.addEventListener('click', logoutUser);

    if (btnPlayAnonymous) {
        btnPlayAnonymous.addEventListener('click', () => {
            setAuthScreenState(true, { displayName: 'Anonymous Player', photoURL: null });
            startGameWithSkyDrop();
        });
    }

    if (btnDemoMode) {
        btnDemoMode.addEventListener('click', () => {
            setAuthScreenState(true, { displayName: 'Demo Player', photoURL: null });
            startGameWithSkyDrop();
        });
    }

    // Eat Ground Loot Button Listener
    if (btnEat) {
        btnEat.addEventListener('click', () => {
            triggerSlimeEatLoot();
        });
    }

    if (btnFeedCheat) {
        btnFeedCheat.addEventListener('click', () => {
            addScraps(1000);
            updateUI();
        });
    }

    // Rewind Wave Button Listener: Restores previous wave snapshot
    if (btnRewindWave) {
        btnRewindWave.addEventListener('click', () => {
            rewindWaveState();
        });
    }

    // Reset Button Listener: Wipes scraps to 0, wave to 1, army to 1 base slime (no upgrades)
    if (btnNextWave) {
        btnNextWave.addEventListener('click', () => {
            resetGameFull();
        });
    }

    // Battlefield Window Click -> Trigger Slime Jump Attack!
    if (battlefieldCard) {
        battlefieldCard.addEventListener('click', (e) => {
            // Ignore click if clicking directly on a button inside the card
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            if (isGamePaused) return;
            triggerRandomSlimeAttack();
        });
    }

    // Manual Pause/Play Button Click Handler
    const btnPauseGame = document.getElementById('btnPauseGame');
    if (btnPauseGame) {
        btnPauseGame.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering battlefield click
            const isPausedNow = !isGamePaused;
            setGamePaused(isPausedNow, true); // Set manual pause!
            btnPauseGame.textContent = isPausedNow ? '▶️' : '⏸️';
            btnPauseGame.title = isPausedNow ? 'Resume' : 'Pause';
            btnPauseGame.classList.toggle('paused', isPausedNow);
            updateUI(); // Force Eat button state check!
        });
    }

    // 4. Initialize Mandatory Auth Handler
    initAuth(
        (isAuthenticated, user) => {
            setAuthScreenState(isAuthenticated, user);
            if (isAuthenticated) {
                startGameWithSkyDrop();
            }
        },
        () => {
            showFirebaseNotice();
        }
    );

    // 5. Start Engine Loop
    startEngine();
});












