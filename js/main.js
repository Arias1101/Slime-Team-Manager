/**
 * Application Main Initializer
 */

import { loadStateFromLocal } from './state.js';
import { initAuth, loginWithGoogle, logoutUser } from './auth.js';
import { startEngine } from './engine.js';
import { updateUI, setAuthScreenState, showFirebaseNotice } from './ui.js';
import { initEnemiesModule, startNextWave, setAutoPlay, resetWaveAndScraps } from './enemies.js';
import { triggerRandomSlimeAttack, triggerSlimeEatLoot } from './slimes.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Local State
    loadStateFromLocal();

    // 2. Initialize Enemies Module
    initEnemiesModule();

    // 3. Bind Auth & Battle Control Buttons
    const gateBtnLogin = document.getElementById('gateBtnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const btnDemoMode = document.getElementById('btnDemoMode');

    const btnPlay = document.getElementById('btnPlay');
    const btnPause = document.getElementById('btnPause');
    const btnEat = document.getElementById('btnEat');
    const btnNextWave = document.getElementById('btnNextWave');
    const battlefieldCard = document.querySelector('.battlefield-card');

    if (gateBtnLogin) {
        gateBtnLogin.addEventListener('click', async () => {
            const success = await loginWithGoogle();
            if (!success) {
                showFirebaseNotice();
            }
        });
    }
    if (btnLogout) btnLogout.addEventListener('click', logoutUser);

    if (btnDemoMode) {
        btnDemoMode.addEventListener('click', () => {
            setAuthScreenState(true, { displayName: 'Demo Player', photoURL: null });
            updateUI();
        });
    }

    // Play & Pause Control Button Listeners
    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            setAutoPlay(true);
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            setAutoPlay(false);
        });
    }

    // Eat Ground Loot Button Listener
    if (btnEat) {
        btnEat.addEventListener('click', () => {
            triggerSlimeEatLoot();
        });
    }

    // Reset Button Listener: Wipes scraps to 0 & decrements wave (min 1)
    if (btnNextWave) {
        btnNextWave.addEventListener('click', () => {
            resetWaveAndScraps();
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
                updateUI();
            }
        },
        () => {
            showFirebaseNotice();
        }
    );

    // 5. Start Engine Loop
    startEngine();
});
