/**
 * Slime Types & Dynamic Enemy-Targeting 60 FPS Jump Attack System
 */

import { activeEnemies, triggerLootDrop, activeGroundLoots } from './enemies.js';
import { gameState, SLIME_TYPES, addScraps } from './state.js';
import { updateUI } from './ui.js';

/**
 * Show floating status effect text over enemy head
 */
export function showFloatingStatusText(enemy, text, extraClass = '') {
    if (!enemy) return;

    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const floatEl = document.createElement('div');
    floatEl.className = `floating-text ${extraClass}`;
    floatEl.style.left = `${enemy.x + 4}px`;
    floatEl.style.top = `${enemy.y - 14}px`;
    floatEl.textContent = text;
    overlay.appendChild(floatEl);

    setTimeout(() => {
        floatEl.remove();
    }, 800);
}

/**
 * Fully heals all slimes in the army back to full health (10 HP max)
 */
export function healAllSlimes() {
    if (!gameState.slimes) return;

    gameState.slimes.forEach((slime) => {
        slime.hp = slime.maxHp;
    });

    gameState.armySize = gameState.slimes.length;
    updateUI();
}

/**
 * Triggers a random available slime from the army to perform a targeted jump attack
 */
export function triggerRandomSlimeAttack(overrideTypeId = null) {
    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    const slimeUnits = Array.from(armyContainer.querySelectorAll('.slime-unit'));
    if (slimeUnits.length === 0) return;

    const availableSlimes = slimeUnits.filter(unit => unit.dataset.isAttacking !== 'true' && unit.dataset.isEating !== 'true');
    if (availableSlimes.length === 0) return;

    const randomSlimeEl = availableSlimes[Math.floor(Math.random() * availableSlimes.length)];
    
    // Read exact slime object from gameState.slimes array using slimeId dataset
    const slimeId = parseInt(randomSlimeEl.dataset.slimeId);
    const slimeObj = gameState.slimes ? gameState.slimes.find(s => s.id === slimeId) : null;
    const chosenType = overrideTypeId || (slimeObj ? slimeObj.type : null) || randomSlimeEl.dataset.slimeType || 'base';

    executeSlimeJumpAttack(randomSlimeEl, chosenType);
}

/**
 * Executes a 60 FPS parabolic jump attack animation dynamically targeting the closest enemy
 */
function executeSlimeJumpAttack(unitEl, typeId) {
    const slimeConfig = SLIME_TYPES[typeId] || SLIME_TYPES.base;
    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');
    if (!imgEl) return;

    unitEl.dataset.isAttacking = 'true';
    unitEl.style.zIndex = '500';
    imgEl.style.animation = 'none';
    imgEl.style.transition = 'none';
    if (shadowEl) shadowEl.style.transition = 'none';

    // Dynamic Enemy Target Tracking
    let targetEnemy = null;
    let targetImpactX = 220;

    if (activeEnemies && activeEnemies.length > 0) {
        const aliveEnemies = activeEnemies.filter(e => e.hp > 0).sort((a, b) => a.x - b.x);
        if (aliveEnemies.length > 0) {
            targetEnemy = aliveEnemies[0];
            targetImpactX = targetEnemy.x - 4;
        }
    }

    const startX = parseFloat(unitEl.style.left) || 95;
    const maxDx = Math.max(35, targetImpactX - startX);
    const maxAltitude = Math.min(65, Math.max(35, 25 + maxDx * 0.16));
    const jumpDuration = Math.min(750, Math.max(480, 450 + maxDx * 0.75));

    const startTime = performance.now();
    let hasDealtDamage = false;

    function animateJumpFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / jumpDuration);

        const dx = maxDx * progress;
        const dy = -4 * maxAltitude * progress * (1.0 - progress);

        imgEl.style.transform = `translate(${dx}px, ${dy}px)`;

        if (shadowEl) {
            const shadowScale = Math.max(0.3, 1.0 - (Math.abs(dy) / (maxAltitude * 1.2)));
            shadowEl.style.transform = `translateX(${dx}px) scale(${shadowScale})`;
            shadowEl.style.opacity = shadowScale;
        }

        let spriteFrame = 1;
        if (progress < 0.08) spriteFrame = 1;
        else if (progress < 0.18) spriteFrame = 2;
        else if (progress < 0.32) spriteFrame = 3;
        else if (progress < 0.48) spriteFrame = 4;
        else if (progress < 0.62) spriteFrame = 5;
        else if (progress < 0.76) spriteFrame = 6;
        else if (progress < 0.90) spriteFrame = 7;
        else spriteFrame = 8;

        imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}${spriteFrame}.png`;

        if (progress >= 0.90 && !hasDealtDamage) {
            hasDealtDamage = true;
            if (targetEnemy && targetEnemy.hp > 0) {
                dealTargetEnemyDamage(targetEnemy, slimeConfig.attackDamage, slimeConfig);
            } else {
                dealImpactDamage(dx, slimeConfig.attackDamage, slimeConfig);
            }
        }

        if (progress < 1.0) {
            requestAnimationFrame(animateJumpFrame);
        } else {
            setTimeout(() => {
                startSmoothReturnWalk(unitEl, imgEl, shadowEl, slimeConfig, maxDx);
            }, 90);
        }
    }

    requestAnimationFrame(animateJumpFrame);
}

/**
 * Deal damage & apply elemental status effects (Fire Burn / Frost Freeze) to target enemy
 */
function dealTargetEnemyDamage(targetEnemy, damageAmount, slimeConfig) {
    if (!targetEnemy || targetEnemy.hp <= 0) return;

    // 1. Direct Impact Damage
    targetEnemy.hp -= damageAmount;

    // 2. Elemental Status Effects Application
    if (!targetEnemy.effects) {
        targetEnemy.effects = { burnTimer: 0, burnTickTimer: 0, freezeTimer: 0 };
    }

    if (slimeConfig && slimeConfig.effect === 'burn') {
        targetEnemy.effects.burnTimer = slimeConfig.burnDuration || 3.0;
        targetEnemy.effects.burnTickTimer = 0;
        showFloatingStatusText(targetEnemy, '🔥 BURN!', 'burn-text');
    } else if (slimeConfig && slimeConfig.effect === 'freeze') {
        targetEnemy.effects.freezeTimer = slimeConfig.freezeDuration || 1.0;
        showFloatingStatusText(targetEnemy, '❄️ FROZEN!', 'freeze-text');
    }

    // Visual WHITE hit flash on enemy sprite
    if (targetEnemy.el) {
        const sprite = targetEnemy.el.querySelector('.enemy-sprite');
        if (sprite) {
            sprite.classList.add('hit-flash-white');
            setTimeout(() => {
                sprite.classList.remove('hit-flash-white');
            }, 180);
        }

        if (targetEnemy.hp <= 0) {
            triggerLootDrop(targetEnemy);
            const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
            targetEnemy.el.classList.add(ejectClass);
            showFloatingStatusText(targetEnemy, '💥 KO!', 'burn-text');
            setTimeout(() => {
                if (targetEnemy.el) targetEnemy.el.remove();
            }, 800);
        }
    }
}

/**
 * Smooth walking return from impact landing point back to origin position in horde
 */
function startSmoothReturnWalk(unitEl, imgEl, shadowEl, slimeConfig, maxDx = 100) {
    imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}1.png`;

    const returnDuration = Math.round(Math.max(650, 400 + maxDx * 3.6));

    imgEl.style.transition = `transform ${returnDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    if (shadowEl) shadowEl.style.transition = `transform ${returnDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    imgEl.style.transform = 'translate(0px, 0px)';
    if (shadowEl) {
        shadowEl.style.transform = 'translate(0px, 0px) scale(1)';
        shadowEl.style.opacity = '1';
    }

    setTimeout(() => {
        imgEl.style.transition = '';
        if (shadowEl) shadowEl.style.transition = '';
        
        const originalZ = unitEl.dataset.originalZ || '1';
        unitEl.style.zIndex = originalZ;
        unitEl.dataset.isAttacking = 'false';
        
        imgEl.style.animation = '';
    }, returnDuration);
}

/**
 * Deal damage to any active enemy in range of impact point
 */
function dealImpactDamage(impactDx, damage, slimeConfig) {
    if (!activeEnemies || activeEnemies.length === 0) return;

    const targetEnemy = activeEnemies[0];
    if (targetEnemy && targetEnemy.hp > 0) {
        dealTargetEnemyDamage(targetEnemy, damage, slimeConfig);
    }
}

/**
 * Show floating text popup at arbitrary x, y coordinates
 */
export function showFloatingStatusTextAt(x, y, text, extraClass = '') {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const floatEl = document.createElement('div');
    floatEl.className = `floating-text ${extraClass}`;
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y - 12}px`;
    floatEl.textContent = text;
    overlay.appendChild(floatEl);

    setTimeout(() => {
        floatEl.remove();
    }, 800);
}

/**
 * Triggers a random slime to slide across the battlefield to eat the nearest available ground loot
 */
export function triggerSlimeEatLoot() {
    const availableLoots = activeGroundLoots.filter(l => !l.beingEaten && l.el && l.el.parentNode);
    if (availableLoots.length === 0) return;

    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    const slimeUnits = Array.from(armyContainer.querySelectorAll('.slime-unit'))
        .filter(u => u.dataset.isAttacking !== 'true' && u.dataset.isEating !== 'true');

    if (slimeUnits.length === 0) return;

    const unitEl = slimeUnits[Math.floor(Math.random() * slimeUnits.length)];
    unitEl.dataset.isEating = 'true';

    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');

    // Use getBoundingClientRect for 100% viewport accuracy in straight-line calculations
    const slimeRect = imgEl.getBoundingClientRect();

    let targetLoot = availableLoots[0];
    let minDistSq = Infinity;

    availableLoots.forEach(loot => {
        if (!loot.el) return;
        const lRect = loot.el.getBoundingClientRect();
        const dX = lRect.left - slimeRect.left;
        const dY = lRect.top - slimeRect.top;
        const distSq = dX * dX + dY * dY;
        if (distSq < minDistSq) {
            minDistSq = distSq;
            targetLoot = loot;
        }
    });

    targetLoot.beingEaten = true;

    const lootRect = targetLoot.el.getBoundingClientRect();
    const dx = lootRect.left - slimeRect.left;
    const dy = lootRect.top - slimeRect.top;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Disable CSS transition & CSS idle bounce animation during 60 FPS manual slide
    imgEl.style.transition = 'none';
    if (shadowEl) shadowEl.style.transition = 'none';
    imgEl.style.animation = 'none';

    const originalZ = unitEl.style.zIndex || '1';
    unitEl.dataset.originalZ = originalZ;
    unitEl.style.zIndex = '500';

    const slimeType = unitEl.dataset.slimeType || 'base';
    const slimeConfig = SLIME_TYPES[slimeType] || SLIME_TYPES.base;

    // Use sprite 2 of the corresponding slime during the loot animation
    imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}2.png`;

    const slideDuration = Math.round(Math.max(450, distance * 3.8));
    const startSlideTime = performance.now();

    // --- PHASE 1: 60 FPS Forward Slide to Loot ---
    function animateForwardSlide(now) {
        const elapsed = now - startSlideTime;
        const progress = Math.min(1.0, elapsed / slideDuration);

        // Smooth cubic easing
        const easeProgress = 1.0 - Math.pow(1.0 - progress, 3);
        const curX = dx * easeProgress;
        const curY = dy * easeProgress;

        imgEl.style.transform = `translate(${curX}px, ${curY}px)`;
        if (shadowEl) {
            shadowEl.style.transform = `translate(${curX}px, 0px) scale(${1.0 - 0.15 * easeProgress})`;
            shadowEl.style.opacity = `${1.0 - 0.15 * easeProgress}`;
        }

        if (progress < 1.0) {
            requestAnimationFrame(animateForwardSlide);
        } else {
            eatLootAndReturn();
        }
    }

    function eatLootAndReturn() {
        // Switch to sprite 4 (eating pose) when stopping on top of the loot!
        imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}4.png`;

        if (targetLoot.el) {
            targetLoot.el.style.transition = 'transform 0.15s ease-in, opacity 0.15s ease-in';
            targetLoot.el.style.transform = 'scale(0) translateY(-6px)';
            targetLoot.el.style.opacity = '0';
            setTimeout(() => {
                if (targetLoot.el) targetLoot.el.remove();
            }, 150);
        }

        const lootIdx = activeGroundLoots.indexOf(targetLoot);
        if (lootIdx !== -1) activeGroundLoots.splice(lootIdx, 1);

        addScraps(targetLoot.value);
        updateUI();

        showFloatingStatusTextAt(targetLoot.x, targetLoot.y, `+${targetLoot.value} Scraps!`, 'loot-text');

        // Short 200ms eating pose pause before returning
        setTimeout(() => {
            // Switch back to sprite 2 for the return slide
            imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}2.png`;

            // --- PHASE 2: 60 FPS Return Walk back to Pyramid ---
            const returnDuration = Math.round(Math.max(500, distance * 4.0));
            const startReturnTime = performance.now();

            function animateReturnWalk(now) {
                const elapsed = now - startReturnTime;
                const progress = Math.min(1.0, elapsed / returnDuration);

                const easeProgress = 1.0 - Math.pow(1.0 - progress, 3);
                const curX = dx * (1.0 - easeProgress);
                const curY = dy * (1.0 - easeProgress);

                imgEl.style.transform = `translate(${curX}px, ${curY}px)`;
                if (shadowEl) {
                    shadowEl.style.transform = `translate(${curX}px, 0px) scale(${0.85 + 0.15 * easeProgress})`;
                    shadowEl.style.opacity = `${0.85 + 0.15 * easeProgress}`;
                }

                if (progress < 1.0) {
                    requestAnimationFrame(animateReturnWalk);
                } else {
                    // Return complete! Clean up & reset idle state with sprite 1
                    imgEl.src = `${slimeConfig.folder}/${slimeConfig.prefix}1.png`;
                    imgEl.style.transform = '';
                    imgEl.style.transition = '';
                    imgEl.style.animation = '';

                    if (shadowEl) {
                        shadowEl.style.transform = '';
                        shadowEl.style.transition = '';
                        shadowEl.style.opacity = '';
                    }

                    unitEl.style.zIndex = originalZ;
                    unitEl.dataset.isEating = 'false';
                }
            }

            requestAnimationFrame(animateReturnWalk);
        }, 200);
    }

    requestAnimationFrame(animateForwardSlide);
}
