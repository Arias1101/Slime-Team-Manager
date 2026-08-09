/**
 * Slime Types & Dynamic Enemy-Targeting 60 FPS Jump Attack System
 */

import { activeEnemies, triggerLootDrop, activeGroundLoots, formatLootEffects } from './enemies.js';
import { gameState, SLIME_TYPES, addScraps, updateBestRoster, saveStateToLocal, calculateSlimeDamage, getScaledEquipmentEffects, getSlimeHitEffects, refreshSlimeMaxHp, getSlimeJumpSprite, getSlimeSpecialization, getSlimeGraftMultipliers, getSlimeSubTalentDef, hasMeltingMend } from './state.js';
import { updateUI, requestUIRefresh, updateLootHUD } from './ui.js';
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

    if (type === 'heal') {
        floatEl.textContent = '+' + damageVal;
    } else {
        floatEl.textContent = `-${damageVal}`;
    }

    overlay.appendChild(floatEl);

    const durationMs = (type === 'burn-dmg' || type === 'poison-dmg' || type === 'crit-dmg' || type === 'mega-crit-dmg') ? 800 : 600;
    setTimeout(() => {
        if (floatEl && floatEl.parentNode) floatEl.remove();
    }, durationMs);
}

/** Show a green floating healing amount. Reusable for enemies and slimes. */
export function showFloatingHealingNumber(x, y, healingAmount) {
    if (healingAmount > 0) showFloatingDamageNumber(x, y, healingAmount, 'heal');
}

/** Show a green floating healing amount anchored to a battlefield unit element. */
export function showFloatingHealingNumberFromUnit(unitEl, healingAmount) {
    if (healingAmount <= 0 || !unitEl) return;
    const position = getOverlayPosition(unitEl);
    if (position) showFloatingHealingNumber(position.x + position.width / 2, position.y - 12, healingAmount);
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

    const graftNeeded = (gameState.slimes || []).some(slime => slime.hp > 0 && slime.hp < slime.maxHp * 0.75);
    const graftSupportEl = graftNeeded ? availableSlimes.find(unit => {
        const slime = (gameState.slimes || []).find(candidate => String(candidate.id) === String(unit.dataset.slimeId));
        return slime?.talents?.graft && getSlimeSpecialization(slime) === 'support' && slime.hp >= slime.maxHp * 0.5;
    }) : null;
    const randomSlimeEl = graftSupportEl || availableSlimes[Math.floor(Math.random() * availableSlimes.length)];

    // Read exact slime object from gameState.slimes array using slimeId dataset
    const rawSlimeId = randomSlimeEl.dataset.slimeId;
    const slimeObj = gameState.slimes ? gameState.slimes.find(s => s.id === rawSlimeId || String(s.id) === String(rawSlimeId) || s.name === rawSlimeId) : null;
    const chosenType = overrideTypeId || (slimeObj ? slimeObj.type : null) || randomSlimeEl.dataset.slimeType || 'base';

    if (trySupportGraft(randomSlimeEl, slimeObj)) return;
    executeSlimeJumpAttack(randomSlimeEl, chosenType, slimeObj);
}

/**
 * Executes a 60 FPS parabolic jump attack animation dynamically targeting the closest enemy
 */
function trySupportGraft(unitEl, support) {
    if (!support?.talents?.graft || getSlimeSpecialization(support) !== 'support' || support.hp < support.maxHp * 0.5) return false;
    const target = (gameState.slimes || []).filter(s => s.id !== support.id && getSlimeSpecialization(s) !== 'support' && s.hp > 0 && s.hp < s.maxHp * .75).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!target) return false;

    const img = unitEl.querySelector('.slime-img');
    const config = SLIME_TYPES[support.type] || SLIME_TYPES.base;
    unitEl.dataset.isAttacking = 'true';
    playSlimeSupportCastRay(unitEl);
    // Graft uses the first frame of the elemental die sheet as its casting pose.
    if (img) {
        img.src = `${config.folder}/die.png`;
        img.style.objectPosition = '0px 0px';
    }

    setTimeout(() => {
        const graftMult = getSlimeGraftMultipliers(support);
        const sacrificedAmount = Math.ceil(support.maxHp * .2 * graftMult.cost);
        const intendedHealing = sacrificedAmount * 2 * graftMult.heal;
        const restoredAmount = Math.min(target.maxHp - target.hp, intendedHealing);
        const overhealAmount = Math.max(0, intendedHealing - restoredAmount);
        const overhealRecovery = Math.round(overhealAmount / 2);
        support.hp = Math.min(support.maxHp, Math.max(1, support.hp - sacrificedAmount) + overhealRecovery);
        target.hp += restoredAmount;

        // Melting Mend (Fire Support second talent): the grafted ally gains a
        // "Heal on Time" status that restores 10% of the intended healing every
        // second for 5 seconds, regardless of how much HP was actually restored.
        if (hasMeltingMend(support)) {
            if (!target.effects) {
                target.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
            }
            target.effects.healOnTimeTimer = 5.0;
            target.effects.healOnTimeTickTimer = 0;
            target.effects.healOnTimePerTick = Math.max(1, Math.round(intendedHealing * 0.1));
        }

        const targetEl = Array.from(document.querySelectorAll('.slime-unit')).find(el => String(el.dataset.slimeId) === String(target.id));
        if (targetEl) {
            playSlimeSupportHealAnimation(targetEl);
            showSlimeSupportHealingNumber(targetEl, restoredAmount);
        }

        unitEl.dataset.isAttacking = 'false';
        if (img) {
            img.src = getSlimeJumpSprite(support);
            img.style.objectPosition = '0px 0px';
        }
        updateUI();
    }, 500);
    return true;
}

function getOverlayPosition(element) {
    const overlay = document.querySelector('.battlefield-overlay');
    if (!overlay || !element) return null;
    const overlayRect = overlay.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scale = getBattlefieldRenderScale();
    return {
        overlay,
        x: (elementRect.left - overlayRect.left) / scale,
        y: (elementRect.top - overlayRect.top) / scale,
        width: elementRect.width / scale,
        height: elementRect.height / scale
    };
}

function playSlimeSupportCastRay(unitEl) {
    const position = getOverlayPosition(unitEl);
    if (!position) return;
    const rayEl = document.createElement('div');
    rayEl.className = 'slime-support-cast-ray';
    rayEl.style.left = `${position.x + position.width / 2 - 1.5}px`;
    rayEl.style.top = `${position.y - 24}px`;
    position.overlay.appendChild(rayEl);
    setTimeout(() => rayEl.remove(), 200);
}

function playSlimeSupportHealAnimation(targetEl) {
    const position = getOverlayPosition(targetEl);
    if (!position) return;
    const healEl = document.createElement('div');
    healEl.className = 'slime-support-heal';
    healEl.style.left = `${position.x + position.width / 2 - 25}px`;
    healEl.style.top = `${position.y + position.height / 2 - 25}px`;
    position.overlay.appendChild(healEl);

    const frameDurationMs = 400 / 12;
    for (let frame = 0; frame < 12; frame++) {
        setTimeout(() => {
            if (healEl.isConnected) healEl.style.backgroundPosition = `-${frame * 50}px 0`;
        }, frame * frameDurationMs);
    }
    setTimeout(() => healEl.remove(), 400);
}

function showSlimeSupportHealingNumber(targetEl, restoredAmount) {
    if (restoredAmount <= 0) return;
    const position = getOverlayPosition(targetEl);
    if (position) showFloatingHealingNumber(position.x + position.width / 2, position.y - 12, restoredAmount);
}
function executeSlimeJumpAttack(unitEl, typeId, slimeObj = null) {
    if (trySupportGraft(unitEl, slimeObj)) return;
    const slimeConfig = SLIME_TYPES[typeId] || SLIME_TYPES.base;
    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');
    if (!imgEl) return;

    unitEl.dataset.isAttacking = 'true';
    unitEl.style.zIndex = '500';
    imgEl.style.animation = 'none';
    imgEl.style.transition = 'none';
    if (shadowEl) shadowEl.style.transition = 'none';

    // Find frontmost candidate enemy in range (90 <= X <= 450)
    let candidateEnemies = activeEnemies
        .filter(e => e.hp > 0 && e.x >= 90 && e.x <= 450)
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
        const isRush = targetEnemy.type === 'rush';
        const isStunned = (targetEnemy.effects?.stunTimer || 0) > 0;
        const isStillWalking = targetEnemy.state === 'walking' && !isStunned && (isRush || remainingDistance > stopBufferPx);
        let predictedX = targetEnemy.x;

        // Only lead targets that are still moving; Rushs have no stopping point.
        if (isStillWalking) {
            const enemyTravel = (targetEnemy.speed || 0) * (isFrozen ? 0.2 : 1) * estDurationSec;
            predictedX = isRush ? Math.max(90, targetEnemy.x - enemyTravel) : Math.max(targetX, targetEnemy.x - enemyTravel);
        }

        targetImpactX = Math.min(450, Math.max(startX + 20, predictedX - 4));
    }

    let maxDx = Math.max(35, targetImpactX - startX);
    let maxAltitude = Math.min(65, Math.max(35, 25 + maxDx * 0.16));
    let jumpDuration = Math.min(750, Math.max(480, 450 + maxDx * 0.75));

    let startTime = performance.now();
    let hasDealtDamage = false;
    let baseX = 0;
    let baseY = 0;

    function animateJumpFrame(now) {
        const elapsed = now - startTime;
        let progress = Math.min(1.0, elapsed / jumpDuration);

        const dx = baseX + maxDx * progress;
        const dy = baseY - 4 * maxAltitude * progress * (1.0 - progress);

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

        imgEl.src = getSlimeJumpSprite(slimeObj);
        imgEl.style.objectPosition = `${-(spriteFrame - 1) * 19}px 0px`;

        if (progress >= 0.90 && !hasDealtDamage) {
            hasDealtDamage = true;
            let currentDamage = slimeObj ? calculateSlimeDamage(slimeObj) : (gameState.slimeDamage || 1);
            let isCrit = false;
            let isMegaCrit = false;

            const critChance = slimeObj ? (slimeObj.critChance || 0) : 0;
            if (critChance > 0) {
                // Crit beyond 100% grants a guaranteed multiplier tier plus an overflow
                // chance for the next tier: 110% => always x2, 10% chance of x4; 210% => always x4, 10% chance of x8.
                const critTier = Math.floor(critChance / 100);
                const overflowChance = critChance % 100;
                let critMultiplier = Math.pow(2, critTier);
                if (overflowChance > 0 && Math.random() * 100 < overflowChance) {
                    critMultiplier *= 2;
                }
                // Only overflow beyond a guaranteed 100% tier is a mega crit (x4+).
                isMegaCrit = critMultiplier >= 4;
                isCrit = critMultiplier > 1;
                if (isCrit) {
                    currentDamage = currentDamage * critMultiplier;
                }
            }

            dealTargetEnemyDamage(targetEnemy, currentDamage, slimeConfig, isCrit, slimeObj, isMegaCrit);
            // If no target enemies are in range (x <= 450), slime performs jump animation without dealing damage

            // Rebound talent: Fighter slimes get a 10% chance to interrupt this jump and immediately
            // rejump at the second closest target, looping back to frame 2 of the jump spritesheet.
            // Only roll when there is actually a second target available.
            if (getSlimeSpecialization(slimeObj) === 'fighter' && slimeObj?.talents?.rebound) {
                const reboundTarget = pickReboundTarget(slimeObj);
                if (reboundTarget && Math.random() < 0.1) {
                    const momentum = getSlimeSubTalentDef(slimeObj, 0)?.id === 'momentum' ? 1.5 : 1;
                    const currentArmyX = startX + dx;
                    const rebound = computeReboundTrajectory(currentArmyX, reboundTarget);
                    baseX = dx;
                    baseY = dy;
                    targetEnemy = reboundTarget;
                    maxDx = rebound.maxDx;
                    maxAltitude = rebound.maxAltitude;
                    jumpDuration = rebound.jumpDuration;
                    startTime = now;
                    progress = 0;
                    hasDealtDamage = false;
                    spriteFrame = 2;
                    imgEl.style.objectPosition = `${-(2 - 1) * 19}px 0px`;
                    showFloatingStatusText(reboundTarget, String.fromCodePoint(0x21AA), 'rebound-text');
                    if (momentum !== 1) currentDamage = currentDamage * momentum;
                }
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
 * Deal damage & apply elemental status effects (Fire Burn / Frost Freeze) to target enemy.
 */
function dealTargetEnemyDamage(targetEnemy, damageAmount, slimeConfig, isCrit = false, slimeObj = null, isMegaCrit = false) {
    // If the jump attack was launched without a target in range, deal no damage
    if (!targetEnemy) return;

    // Get sorted list of alive enemies currently in range (closest to slimes first: 90 <= X <= 450)
    let candidateEnemies = activeEnemies
        .filter(e => e.hp > 0 && e.x >= 90 && e.x <= 450)
        .sort((a, b) => a.x - b.x);

    // If initial target is still alive and in range (x <= 450), start with it;
    // Otherwise (if initial target died mid-air before landing - i.e. slime hit nothing), pick frontmost candidate in range
    // A Rush consumes the attack that targeted it: a dead or escaped Rush never redirects that hit to another enemy.
    const isRushTarget = targetEnemy.type === 'rush';
    let currentTarget = (targetEnemy.hp > 0 && targetEnemy.x >= 90 && targetEnemy.x <= 450)
        ? targetEnemy
        : (isRushTarget ? null : (candidateEnemies[0] || null));

    if (!currentTarget || currentTarget.hp <= 0 || currentTarget.x < 90 || currentTarget.x > 450) return;

    // Apply damage to currentTarget (excess damage beyond currentTarget.hp is lost!)
    const damageToApply = Math.min(currentTarget.hp, damageAmount);

    currentTarget.hp -= damageToApply;

    // Pop floating pixel art damage number on currentTarget (golden glowing crit-dmg for critical hits)
    if (isMegaCrit) {
        showFloatingDamageNumber(currentTarget.x + 8, currentTarget.y - 14, damageToApply, 'mega-crit-dmg');
    } else if (isCrit) {
        showFloatingDamageNumber(currentTarget.x + 8, currentTarget.y - 14, damageToApply, 'crit-dmg');
    } else {
        showFloatingDamageNumber(currentTarget.x + 8, currentTarget.y - 12, damageToApply, 'enemy-dmg');
    }

    // Apply one combined set of effects: innate elemental power plus all equipment effects.
    if (!currentTarget.effects) {
        currentTarget.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, freezeTimer: 0, stunTimer: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0 };
    }

    const isControlImmune = currentTarget.typeId === 'death';
    const sourceSlime = slimeObj || { type: slimeConfig?.id || 'base', equipment: [] };
    const hitEffects = getSlimeHitEffects(sourceSlime);

    if (hitEffects.burn > 0) {
        currentTarget.effects.burnStacks = currentTarget.effects.burnTimer > 0
            ? (currentTarget.effects.burnStacks || 0) + hitEffects.burn
            : hitEffects.burn;
        currentTarget.effects.burnTimer = 3.0;
    }
    if (hitEffects.poison > 0) {
        currentTarget.effects.poisonStacks = currentTarget.effects.poisonTimer > 0
            ? (currentTarget.effects.poisonStacks || 0) + hitEffects.poison
            : hitEffects.poison;
        currentTarget.effects.poisonTimer = 3.0;
    }
    if (hitEffects.freeze > 0 && !isControlImmune) {
        currentTarget.effects.freezeTimer = 1 * hitEffects.freeze;
        const freezeDmg = 5 * hitEffects.freeze;
        const freezeDmgDealt = Math.min(currentTarget.hp, freezeDmg);
        if (freezeDmgDealt > 0) {
            currentTarget.hp -= freezeDmgDealt;
            showFloatingDamageNumber(currentTarget.x - 8, currentTarget.y - 20, freezeDmgDealt, 'freeze-dmg');
            showFloatingStatusText(currentTarget, String.fromCodePoint(0x2744, 0xFE0F), 'freeze-text');
        }
    }
    if (hitEffects.stun > 0 && !isControlImmune) {
        currentTarget.effects.stunTimer = 0.5 * hitEffects.stun;
        showFloatingStatusText(currentTarget, String.fromCodePoint(0x1F4AB), 'stun-text');
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
    const returnSlime = (gameState.slimes || []).find(slime => String(slime.id) === String(unitEl.dataset.slimeId));
    imgEl.src = getSlimeJumpSprite(returnSlime || { type: slimeConfig.id });
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
 * Pick the second closest alive enemy in range (closest to the slimes first).
 * Used by the Fighter Rebound talent to rejump at the next target after a hit.
 */
function pickReboundTarget(slimeObj) {
    const candidates = activeEnemies
        .filter(e => e.hp > 0 && e.x >= 90 && e.x <= 450)
        .sort((a, b) => a.x - b.x);
    if (candidates.length < 2) return null;
    if (getSlimeSubTalentDef(slimeObj, 0)?.id === 'chaos') {
        // Chaos: hit a random valid enemy instead of the second closest.
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return candidates[1];
}

/**
 * Compute the horizontal impact X for a jump launched from refX toward a target.
 */
function computeJumpImpactX(refStartX, target) {
    const estDurationSec = 0.5;
    const stopBufferPx = 10;
    const targetX = target.targetX || 100;
    const remainingDistance = target.x - targetX;
    const isFrozen = (target.effects?.freezeTimer || 0) > 0;
    const isRush = target.type === 'rush';
    const isStunned = (target.effects?.stunTimer || 0) > 0;
    const isStillWalking = target.state === 'walking' && !isStunned && (isRush || remainingDistance > stopBufferPx);
    let predictedX = target.x;
    if (isStillWalking) {
        const enemyTravel = (target.speed || 0) * (isFrozen ? 0.2 : 1) * estDurationSec;
        predictedX = isRush ? Math.max(90, target.x - enemyTravel) : Math.max(targetX, target.x - enemyTravel);
    }
    return Math.min(450, Math.max(refStartX + 20, predictedX - 4));
}

/**
 * Recompute jump trajectory for a Rebound rejump from the current airborne position.
 */
function computeReboundTrajectory(refX, target) {
    const targetImpactX = computeJumpImpactX(refX, target);
    const maxDx = Math.max(35, targetImpactX - refX);
    const maxAltitude = Math.min(65, Math.max(35, 25 + maxDx * 0.16));
    const jumpDuration = Math.min(750, Math.max(480, 450 + maxDx * 0.75));
    return { maxDx, maxAltitude, jumpDuration };
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
    floatEl.innerHTML = text;
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

    // Use the loot's stored battlefield coordinates instead of calling
    // getBoundingClientRect() on every loot element (avoids layout thrash).
    // Convert the slime's viewport rect into the overlay's native coordinate
    // space by subtracting the overlay origin and dividing by the render scale.
    const renderScale = getBattlefieldRenderScale();
    const overlayEl = document.querySelector('.battlefield-overlay');
    const overlayRect = overlayEl ? overlayEl.getBoundingClientRect() : { left: 0, top: 0 };
    const slimeRect = imgEl.getBoundingClientRect();
    const slimeBX = (slimeRect.left - overlayRect.left) / renderScale;
    const slimeBY = (slimeRect.top - overlayRect.top) / renderScale;

    let targetLoot = availableLoots[0];
    let minDistSq = Infinity;

    for (let i = 0; i < availableLoots.length; i++) {
        const loot = availableLoots[i];
        const dX = (loot.x || 0) - slimeBX;
        const dY = (loot.y || 0) - slimeBY;
        const distSq = dX * dX + dY * dY;
        if (distSq < minDistSq) {
            minDistSq = distSq;
            targetLoot = loot;
        }
    }

    targetLoot.beingEaten = true;

    const dx = (targetLoot.x || 0) - slimeBX;
    const dy = (targetLoot.y || 0) - slimeBY;
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
    imgEl.src = getSlimeJumpSprite(slimeObj);
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
        imgEl.src = getSlimeJumpSprite(slimeObj);
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
        updateLootHUD();
        requestUIRefresh();

        // 1. Immediately pop +N food scrap floating text (floats straight up)
        showFloatingStatusTextAt(targetLoot.x, targetLoot.y, `+${targetLoot.value} <img src="images/logos/scrap.png" alt="scrap" class="loot-text-icon">`, 'loot-text');

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
                        slimeObj.baseMaxHp = Math.max(1, (slimeObj.baseMaxHp ?? slimeObj.maxHp ?? 10) + effectValue);
                        refreshSlimeMaxHp(slimeObj);
                    } else if (effectStat === 'regen') {
                        slimeObj.regen = Math.max(0, (slimeObj.regen || 0) + effectValue);
                    } else if (effectStat === 'crit') {
                        slimeObj.critChance = Math.max(0, (slimeObj.critChance || 0) + effectValue);
                    }
                });

                const combinedText = formatLootEffects(effectsList);

                slimeObj.equipment.push({
                    id: lootKey,
                    quality: 0
                });

                slimeObj.damage = calculateSlimeDamage(slimeObj);
                updateBestRoster();
                saveStateToLocal();

                const lootDisplayName = targetLoot.name || lootKey;

                // Staggered 300ms delay & leftward arc curve so equipment popup floats AFTER food popup without overlapping!
                setTimeout(() => {
                    showFloatingStatusTextAt(targetLoot.x - 10, targetLoot.y - 12, `<img src="images/logos/whiteEquipment.png" alt="forge" class="loot-text-icon"> ${lootDisplayName} (${combinedText})!`, 'equipment-loot-text');
                }, 300);
            }
        }

        // Short 200ms eating pose pause before returning
        setTimeout(() => {
            // Switch back to sprite 2 for the return slide
            imgEl.src = getSlimeJumpSprite(slimeObj);
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
                    imgEl.src = getSlimeJumpSprite(slimeObj);
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

    // Only attack enemies within the Slime target zone (90 <= x <= 450)
    const hitableEnemies = activeEnemies.filter(e => e.hp > 0 && e.x >= 90 && e.x <= 450);
    if (hitableEnemies.length === 0) return;

    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    const unitEl = armyContainer.querySelector(`.slime-unit[data-slime-id="${slimeObj.id}"]`);
    if (unitEl && unitEl.dataset.isAttacking !== 'true' && unitEl.dataset.isEating !== 'true') {
        const slimeType = slimeObj.type || unitEl.dataset.slimeType || 'base';
        executeSlimeJumpAttack(unitEl, slimeType, slimeObj);
    }
}

