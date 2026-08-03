/**
 * Game Engine & Core Logic
 */

import { gameState, saveStateToLocal } from './state.js';
import { saveCloudSave } from './auth.js';
import { updateEnemies } from './enemies.js';

let lastTickTime = Date.now();

export function startEngine(onTick) {
    lastTickTime = Date.now();

    // 30 FPS Battle Tick Loop
    setInterval(() => {
        const now = Date.now();
        const deltaSeconds = (now - lastTickTime) / 1000;
        lastTickTime = now;

        // Update active enemy AI state machines, movement & attacks
        updateEnemies(deltaSeconds);

        if (onTick) {
            onTick(deltaSeconds);
        }
    }, 1000 / 30);

    // Auto-save loop every 10 seconds
    setInterval(() => {
        saveStateToLocal();
        saveCloudSave();
    }, 10000);
}
