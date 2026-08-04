/**
 * Application Main Initializer
 */

import { loadStateFromLocal } from './state.js';
import { initAuth, loginWithGoogle, logoutUser } from './auth.js';
import { startEngine } from './engine.js';
import { updateUI, setAuthScreenState, showFirebaseNotice, playSlimeRainRespawnAnimation, initSlimeModalListeners, initMainTabsListeners } from './ui.js';
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
            triggerRandomSlimeAttack();
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
