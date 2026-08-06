/**
 * Slime Types & Dynamic Enemy-Targeting 60 FPS Jump Attack System
 */

import { activeEnemies, triggerLootDrop, activeGroundLoots, formatLootEffects } from './enemies.js';
import { gameState, SLIME_TYPES, addScraps, updateBestRoster, saveStateToLocal, calculateSlimeDamage, getScaledEquipmentEffects } from './state.js';
import { updateUI } from './ui.js';
/**
 * Convert viewport measurements back into the battlefield's native 500px coordinate space.
 * The wide layout scales the battlefield element as a whole, while gameplay coordinates stay native.
 */
function getBattlefieldRenderScale() {
    const battlefield = document.querySelector('.battlefield-card');
    if (!battlefield || !battlefield.offsetWidth) return 1;
    const renderedWidth = battlefield.getBoundingClientRect().width;
    return renderedWidth > 0 ? renderedWidth / battlefield.offsetWidth : 1;
}

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
 * Show floating pixel art damage numbers (white for enemies, red for slimes)
 */
export function showFloatingDamageNumber(x, y, damageVal, type = 'enemy-dmg') {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay) return;

    const floatEl = document.createElement('div');
    floatEl.className = `floating-damage-num ${type}`;
    const jitterX = (Math.random() * 8 - 4);
    floatEl.style.left = `${x + jitterX}px`;
    floatEl.style.top = `${y}px`;

    if (type === 'burn-dmg') {
        floatEl.textContent = `🔥 ${damageVal}`;
    } else if (type === 'poison-dmg') {
        floatEl.textContent = `🧪 ${damageVal}`;
    } else if (type === 'crit-dmg') {
        floatEl.textContent = `💥 ${damageVal}`;
    } else if (type === 'heal') {
        floatEl.textContent = '+' + damageVal;
    } else {
        floatEl.textContent = `-${damageVal}`;
    }

    overlay.appendChild(floatEl);

    const durationMs = (type === 'burn-dmg' || type === 'poison-dmg' || type === 'crit-dmg') ? 800 : 600;
    setTimeout(() => {
        if (floatEl && floatEl.parentNode) floatEl.remove();
    }, durationMs);
}

/** Show a green floating healing amount. Reusable for enemies and slimes. */
export function showFloatingHealingNumber(x, y, healingAmount) {
    if (healingAmount > 0) showFloatingDamageNumber(x, y, healingAmount, 'heal');
}
/**
 * Display a centered battlefield banner message (e.g. "🎉 WAVE 10 CLEARED!")
 */
export function showBattlefieldWaveBanner(text) {
    const cardEl = document.querySelector('.battlefield-card') || document.querySelector('.battlefield-overlay') || document.getElementById('gameScreen');
    if (!cardEl) return;

    // Remove any existing active banner to prevent overlap
    const existing = cardEl.querySelector('.battlefield-congratulations-banner');
    if (existing) existing.remove();

    const bannerEl = document.createElement('div');
    bannerEl.className = 'battlefield-congratulations-banner';
    bannerEl.innerHTML = text;

    cardEl.appendChild(bannerEl);

    setTimeout(() => {
        if (bannerEl && bannerEl.parentNode) {
            bannerEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            bannerEl.style.opacity = '0';
            bannerEl.style.transform = 'translate(-50%, -50%) scale(0.85)';
            setTimeout(() => bannerEl.remove(), 250);
        }
    }, 1800);
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

    const availableSlimes = slimeUnits.filter(unit => unit.dataset.isAttacking !== 'true' && unit.dataset.isEating !== 'true' && !unit.classList.contains('is-stunned'));
    if (availableSlimes.length === 0) return;

    const randomSlimeEl = availableSlimes[Math.floor(Math.random() * availableSlimes.length)];

    // Read exact slime object from gameState.slimes array using slimeId dataset
    const rawSlimeId = randomSlimeEl.dataset.slimeId;
    const slimeObj = gameState.slimes ? gameState.slimes.find(s => s.id === rawSlimeId || String(s.id) === String(rawSlimeId) || s.name === rawSlimeId) : null;
    const chosenType = overrideTypeId || (slimeObj ? slimeObj.type : null) || randomSlimeEl.dataset.slimeType || 'base';

    executeSlimeJumpAttack(randomSlimeEl, chosenType, slimeObj);
}

/**
 * Executes a 60 FPS parabolic jump attack animation dynamically targeting the closest enemy
 */
function executeSlimeJumpAttack(unitEl, typeId, slimeObj = null) {
    const slimeConfig = SLIME_TYPES[typeId] || SLIME_TYPES.base;
    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');
    if (!imgEl) return;

    unitEl.dataset.isAttacking = 'true';
    unitEl.style.zIndex = '500';
    imgEl.style.animation = 'none';
    imgEl.style.transition = 'none';
    if (shadowEl) shadowEl.style.transition = 'none';

    // Find frontmost candidate enemy in range (lowest X <= 450)
    let candidateEnemies = activeEnemies
        .filter(e => e.hp > 0 && e.x <= 450)
        .sort((a, b) => a.x - b.x);

    let targetEnemy = candidateEnemies[0] || null;

    let startX = 20;
    const parentPos = unitEl.parentElement ? unitEl.parentElement.getBoundingClientRect() : null;
    const unitPos = unitEl.getBoundingClientRect();
    if (parentPos && unitPos) {
        startX = (unitPos.left - parentPos.left) / getBattlefieldRenderScale();
    }

    let targetImpactX = startX + 160;
    if (targetEnemy) {
        const estDurationSec = 0.5;
        const stopBufferPx = 10;
        const targetX = targetEnemy.targetX || 100;
        const remainingDistance = targetEnemy.x - targetX;
        const isFrozen = (targetEnemy.effects?.freezeTimer || 0) > 0;
        const isStillWalking = targetEnemy.state === 'walking' && !isFrozen && remainingDistance > stopBufferPx;
        let predictedX = targetEnemy.x;

        // Only lead targets that are still moving and not already within their stop buffer.
        if (isStillWalking) {
            const enemyTravel = (targetEnemy.speed || 0) * estDurationSec;
            predictedX = Math.max(targetX, targetEnemy.x - enemyTravel);
        }

        targetImpactX = Math.min(450, Math.max(startX + 20, predictedX - 4));
    }

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

        imgEl.src = `${slimeConfig.folder}/jump.png`;
        imgEl.style.objectPosition = `${-(spriteFrame - 1) * 19}px 0px`;

        if (progress >= 0.90 && !hasDealtDamage) {
            hasDealtDamage = true;
            let currentDamage = slimeObj ? calculateSlimeDamage(slimeObj) : (gameState.slimeDamage || 1);
            let isCrit = false;

            const critChance = slimeObj ? (slimeObj.critChance || 0) : 0;
            if (critChance > 0) {
                const roll = Math.random() * 100;
                if (roll < critChance) {
                    isCrit = true;
                    currentDamage = currentDamage * 2;
                }
            }

            dealTargetEnemyDamage(targetEnemy, currentDamage, slimeConfig, isCrit, slimeObj);
            // If no target enemies are in range (x <= 450), slime performs jump animation without dealing damage
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
 * Deal damage & apply elemental status effects (Fire Burn / Frost Freeze) to target enemy.
 */
function dealTargetEnemyDamage(targetEnemy, damageAmount, slimeConfig, isCrit = false, slimeObj = null) {
    // If the jump attack was launched without a target in range, deal no damage
    if (!targetEnemy) return;

    // Get sorted list of alive enemies currently in range (closest to slimes first: lowest X <= 450)
    let candidateEnemies = activeEnemies
        .filter(e => e.hp > 0 && e.x <= 450)
        .sort((a, b) => a.x - b.x);

    // If initial target is still alive and in range (x <= 450), start with it;
    // Otherwise (if initial target died mid-air before landing - i.e. slime hit nothing), pick frontmost candidate in range
    let currentTarget = (targetEnemy.hp > 0 && targetEnemy.x <= 450)
        ? targetEnemy
        : (candidateEnemies[0] || null);

    if (!currentTarget || currentTarget.hp <= 0 || currentTarget.x > 450) return;

    // Apply damage to currentTarget (excess damage beyond currentTarget.hp is lost!)
    const damageToApply = Math.min(currentTarget.hp, damageAmount);

    currentTarget.hp -= damageToApply;

    // Pop floating pixel art damage number on currentTarget (golden glowing crit-dmg for critical hits)
    if (isCrit) {
        showFloatingDamageNumber(currentTarget.x + 8, currentTarget.y - 14, damageToApply, 'crit-dmg');
    } else {
        showFloatingDamageNumber(currentTarget.x + 8, currentTarget.y - 12, damageToApply, 'enemy-dmg');
    }

    // Apply elemental status effects (Innate Slime Effect)
    if (!currentTarget.effects) {
        currentTarget.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, freezeTimer: 0, stunTimer: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0 };
    }

    const isControlImmune = currentTarget.typeId === 'death';
    if (slimeConfig && slimeConfig.effect === 'burn') {
        if (currentTarget.effects.burnTimer > 0) {
            currentTarget.effects.burnStacks = (currentTarget.effects.burnStacks || 1) + 1;
        } else {
            currentTarget.effects.burnStacks = 1;
        }
        currentTarget.effects.burnTimer = slimeConfig.burnDuration || 3.0;
    } else if (slimeConfig && slimeConfig.effect === 'poison') {
        if (currentTarget.effects.poisonTimer > 0) {
            currentTarget.effects.poisonStacks = (currentTarget.effects.poisonStacks || 1) + 1;
        } else {
            currentTarget.effects.poisonStacks = 1;
        }
        currentTarget.effects.poisonTimer = slimeConfig.poisonDuration || 3.0;
    } else if (slimeConfig && slimeConfig.effect === 'freeze' && !isControlImmune) {
        currentTarget.effects.freezeTimer = slimeConfig.freezeDuration || 0.5;
        showFloatingStatusText(currentTarget, '❄️', 'freeze-text');
    } else if (slimeConfig && slimeConfig.effect === 'stun' && !isControlImmune) {
        currentTarget.effects.stunTimer = slimeConfig.stunDuration || 0.4;
        showFloatingStatusText(currentTarget, '💫', 'stun-text');
    }

    // Apply Equipment Status Effects (Burn, Poison, Freeze, Stun from equipment!)
    if (slimeObj && slimeObj.equipment && slimeObj.equipment.length > 0) {
        slimeObj.equipment.forEach(eq => {
            const effectsToProcess = getScaledEquipmentEffects(eq);
            effectsToProcess.forEach(eff => {
                if (eff.stat === 'effect' || eff.effectType) {
                    const type = eff.effectType;
                    const val = eff.value || 1;

                    if (type === 'burn') {
                        if (currentTarget.effects.burnTimer > 0) {
                            currentTarget.effects.burnStacks = (currentTarget.effects.burnStacks || 1) + val;
                        } else {
                            currentTarget.effects.burnStacks = val;
                        }
                        currentTarget.effects.burnTimer = 3.0;
                    } else if (type === 'poison') {
                        if (currentTarget.effects.poisonTimer > 0) {
                            currentTarget.effects.poisonStacks = (currentTarget.effects.poisonStacks || 1) + val;
                        } else {
                            currentTarget.effects.poisonStacks = val;
                        }
                        currentTarget.effects.poisonTimer = 3.0;
                    } else if (type === 'freeze' && !isControlImmune) {
                        currentTarget.effects.freezeTimer = 0.5 * Math.max(1, Number(val) || 1);
                        showFloatingStatusText(currentTarget, '❄️', 'freeze-text');
                    } else if (type === 'stun' && !isControlImmune) {
                        currentTarget.effects.stunTimer = 0.4 * Math.max(1, Number(val) || 1);
                        showFloatingStatusText(currentTarget, '💫', 'stun-text');
                    }
                }
            });
        });
    }

    // Visual WHITE hit flash on currentTarget sprite
    if (currentTarget.el) {
        const sprite = currentTarget.el.querySelector('.enemy-sprite');
        if (sprite) {
            sprite.classList.add('hit-flash-white');
            const spriteEl = sprite;
            setTimeout(() => {
                if (spriteEl) spriteEl.classList.remove('hit-flash-white');
            }, 180);
        }

        if (currentTarget.hp <= 0) {
            triggerLootDrop(currentTarget);
            const ejectClass = Math.random() > 0.5 ? 'cartoon-ko-eject' : 'cartoon-ko-eject-left';
            currentTarget.el.classList.add(ejectClass);
            setTimeout(() => {
                if (currentTarget.el) currentTarget.el.remove();
                const idx = activeEnemies.indexOf(currentTarget);
                if (idx !== -1) activeEnemies.splice(idx, 1);
            }, 800);
        }
    }
}

/**
 * Smooth walking return from impact landing point back to origin position in horde
 */
function startSmoothReturnWalk(unitEl, imgEl, shadowEl, slimeConfig, maxDx = 100) {
    imgEl.src = `${slimeConfig.folder}/jump.png`;
    imgEl.style.objectPosition = '0px 0px';

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
 * Helper function to dispatch a single slime to eat ground loot
 */
function dispatchSingleSlimeToEat() {
    const availableLoots = activeGroundLoots.filter(l => !l.beingEaten && l.el && l.el.parentNode);
    if (availableLoots.length === 0) return;

    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    const slimeUnits = Array.from(armyContainer.querySelectorAll('.slime-unit'))
        .filter(u => u.dataset.isAttacking !== 'true' && u.dataset.isEating !== 'true' && !u.classList.contains('is-stunned'));

    if (slimeUnits.length === 0) return;

    const unitEl = slimeUnits[Math.floor(Math.random() * slimeUnits.length)];
    unitEl.dataset.isEating = 'true';

    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');

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
    const renderScale = getBattlefieldRenderScale();
    const dx = (lootRect.left - slimeRect.left) / renderScale;
    const dy = (lootRect.top - slimeRect.top) / renderScale;
    const distance = Math.sqrt(dx * dx + dy * dy);

    imgEl.style.transition = 'none';
    if (shadowEl) {
        shadowEl.style.transition = 'none';
        shadowEl.style.opacity = '0';
    }
    imgEl.style.animation = 'none';

    const originalZ = unitEl.style.zIndex || '1';
    unitEl.style.zIndex = '500';

    const rawSlimeId = unitEl.dataset.slimeId;
    const slimeObj = gameState.slimes ? gameState.slimes.find(s => s.id === rawSlimeId || String(s.id) === String(rawSlimeId) || s.name === rawSlimeId) : null;
    const slimeType = slimeObj ? slimeObj.type : 'base';
    const slimeConfig = SLIME_TYPES[slimeType] || SLIME_TYPES.base;

    // Use sprite 2 of the corresponding slime during the loot animation
    imgEl.src = `${slimeConfig.folder}/jump.png`;
    imgEl.style.objectPosition = '-19px 0px';

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
            shadowEl.style.opacity = '0';
        }

        if (progress < 1.0) {
            requestAnimationFrame(animateForwardSlide);
        } else {
            eatLootAndReturn();
        }
    }

    function eatLootAndReturn() {
        // Switch to sprite 4 (eating pose) when stopping on top of the loot!
        imgEl.src = `${slimeConfig.folder}/jump.png`;
        imgEl.style.objectPosition = '-57px 0px';

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

        // 1. Immediately pop +N 🍖 food scrap floating text (floats straight up)
        showFloatingStatusTextAt(targetLoot.x, targetLoot.y, `+${targetLoot.value} 🍖`, 'loot-text');

        // 2. Character Sheet & Equipment Unique Effect Logic
        if (slimeObj) {
            if (!slimeObj.equipment) slimeObj.equipment = [];

            const lootKey = targetLoot.key || 'beggar';
            const alreadyHasLoot = slimeObj.equipment.some(eq => eq.id === lootKey);

            if (!alreadyHasLoot) {
                const rawLootEffect = targetLoot.effect || { stat: 'hp', value: 1 };
                const effectsList = Array.isArray(rawLootEffect)
                    ? rawLootEffect
                    : (rawLootEffect.effects ? rawLootEffect.effects : [rawLootEffect]);
                effectsList.forEach(eff => {
                    const effectStat = eff.stat || 'hp';
                    const effectValue = Number(eff.value ?? 1);

                    if (effectStat === 'hp') {
                        slimeObj.maxHp = Math.max(1, (slimeObj.maxHp || 10) + effectValue);
                        slimeObj.hp = Math.max(1, Math.min(slimeObj.hp !== undefined ? slimeObj.hp : 10, slimeObj.maxHp));
                    } else if (effectStat === 'regen') {
                        slimeObj.regen = Math.max(0, (slimeObj.regen || 0) + effectValue);
                    } else if (effectStat === 'crit') {
                        slimeObj.critChance = Math.max(0, (slimeObj.critChance || 0) + effectValue);
                    }
                });

                const combinedText = formatLootEffects(effectsList);

                slimeObj.equipment.push({
                    id: lootKey,
                    name: targetLoot.name || lootKey,
                    sprite: targetLoot.sprite || `images/loots/${lootKey}.png`,
                    effectText: combinedText,
                    effects: effectsList
                });

                slimeObj.damage = calculateSlimeDamage(slimeObj);
                updateBestRoster();
                saveStateToLocal();

                const lootDisplayName = targetLoot.name || lootKey;

                // Staggered 300ms delay & leftward arc curve so equipment popup floats AFTER food popup without overlapping!
                setTimeout(() => {
                    showFloatingStatusTextAt(targetLoot.x - 10, targetLoot.y - 12, `🎒 ${lootDisplayName} (${combinedText})!`, 'equipment-loot-text');
                }, 300);
            }
        }

        // Short 200ms eating pose pause before returning
        setTimeout(() => {
            // Switch back to sprite 2 for the return slide
            imgEl.src = `${slimeConfig.folder}/jump.png`;
            imgEl.style.objectPosition = '-19px 0px';

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
                    shadowEl.style.opacity = '0';
                }

                if (progress < 1.0) {
                    requestAnimationFrame(animateReturnWalk);
                } else {
                    // Return complete! Clean up & reset idle state with sprite 1
                    imgEl.src = `${slimeConfig.folder}/jump.png`;
                    imgEl.style.objectPosition = '0px 0px';
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

/**
 * Triggers slimes to slide across the battlefield to eat available ground loots.
 * Digestion upgrade determines how many slimes go to eat in quick succession!
 */
export function triggerSlimeEatLoot() {
    const countToDispatch = 1 + (gameState.digestionLevel || 0);

    for (let i = 0; i < countToDispatch; i++) {
        if (i === 0) {
            dispatchSingleSlimeToEat();
        } else {
            setTimeout(() => {
                dispatchSingleSlimeToEat();
            }, i * 140);
        }
    }
}

const ascendedTimeouts = new Map();

/**
 * Clear all active ascended auto-attack timers (e.g. on rewind or full reset)
 */
export function clearAscendedAutoAttacks() {
    ascendedTimeouts.forEach(timerId => clearTimeout(timerId));
    ascendedTimeouts.clear();
}

/**
 * Initialize individual randomized (0.9s - 1.1s) auto-attack loops for ascended slimes
 */
export function initAscendedAutoAttacks() {
    clearAscendedAutoAttacks();

    // Check periodically for newly ascended slimes and maintain their attack loops
    setInterval(() => {
        updateAscendedSlimeTimers();
    }, 200);
}

function updateAscendedSlimeTimers() {
    if (!gameState.slimes || gameState.slimes.length === 0) {
        clearAscendedAutoAttacks();
        return;
    }

    // Clean up stale timers for dead or non-existent slimes
    for (const [id, timerId] of ascendedTimeouts.entries()) {
        const livingAscendedSlime = gameState.slimes.find(s => s.id === id && (s.hp === undefined || s.hp > 0) && s.ascended);
        if (!livingAscendedSlime) {
            clearTimeout(timerId);
            ascendedTimeouts.delete(id);
        }
    }

    // Schedule auto-attack timers for living ascended slimes that don't have an active timer
    gameState.slimes.forEach(slimeObj => {
        if (slimeObj.ascended && (slimeObj.hp === undefined || slimeObj.hp > 0) && !ascendedTimeouts.has(slimeObj.id)) {
            scheduleSingleAscendedAttack(slimeObj);
        }
    });
}

function scheduleSingleAscendedAttack(slimeObj) {
    // Randomized interval between 0.9s (900ms) and 1.1s (1100ms)
    const randomDelay = Math.round(900 + Math.random() * 200);

    const timerId = setTimeout(() => {
        attemptAscendedSlimeAttack(slimeObj);
        // Reschedule next attack with a fresh random 0.9s - 1.1s delay
        scheduleSingleAscendedAttack(slimeObj);
    }, randomDelay);

    ascendedTimeouts.set(slimeObj.id, timerId);
}

function attemptAscendedSlimeAttack(slimeObj) {
    if (!slimeObj.ascended || (slimeObj.hp !== undefined && slimeObj.hp <= 0)) return;
    if (slimeObj.effects && slimeObj.effects.stunTimer > 0) return;
    if (!activeEnemies || activeEnemies.length === 0) return;

    // Only attack enemies within visible screen bounds (x <= 450)
    const hitableEnemies = activeEnemies.filter(e => e.hp > 0 && e.x <= 450);
    if (hitableEnemies.length === 0) return;

    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    const unitEl = armyContainer.querySelector(`.slime-unit[data-slime-id="${slimeObj.id}"]`);
    if (unitEl && unitEl.dataset.isAttacking !== 'true' && unitEl.dataset.isEating !== 'true') {
        const slimeType = slimeObj.type || unitEl.dataset.slimeType || 'base';
        executeSlimeJumpAttack(unitEl, slimeType, slimeObj);
    }
}

