/**
 * Slime Types & Dynamic Enemy-Targeting 60 FPS Jump Attack System
 */

import { activeEnemies, triggerLootDrop, activeGroundLoots, formatLootEffects, markSlimeAttacked } from './enemies.js';
import { gameState, SLIME_TYPES, addScraps, updateBestRoster, saveStateToLocal, calculateSlimeDamage, getScaledEquipmentEffects, getSlimeHitEffects, refreshSlimeMaxHp, getSlimeJumpSprite, getSlimeSpecialization, getSlimeGraftMultipliers, getSlimeSubTalentDef, getMeltingMendHotParams, getIceBarrierParams, getLeechParams, getStoneSkinParams, getIceBurstParams, getImmolationParams, getCorrosivePoisonParams, getHeavyStrikeParams, getSlideParams, isMindlessSupport, hasMeltingMend, hasIceBarrier, hasLeech, hasStoneSkin, hasIceBurst, hasImmolation, hasCorrosivePoison, hasHeavyStrike, hasSlide, getInflationBonusScraps } from './state.js';
import { updateUI, requestUIRefresh, updateLootHUD, renderSlimeArmy } from './ui.js';
import { isGamePaused } from './engine.js';
import { playJumpSound, playLootSound } from './audio.js';

/**
 * Synchronous mutual-exclusion lock over Slime units. A Slime may be either
 * attacking (jump/Rebound/Slide) or eating loot, but never both at once — and a
 * unit that is busy must not be picked up by the other system. The dataset
 * `isAttacking`/`isEating` flags can race (a loot dispatch can read a unit as
 * "free" in the same tick its attack starts), so we track liveness here
 * synchronously at dispatch time to make the exclusion bulletproof.
 */
const busySlimeIds = new Set();
function isUnitBusy(unitEl) {
    const id = unitEl?.dataset?.slimeId;
    return Boolean(id) && busySlimeIds.has(id);
}
function markUnitBusy(unitEl) {
    const id = unitEl?.dataset?.slimeId;
    if (id) busySlimeIds.add(id);
}
function markUnitFree(unitEl) {
    const id = unitEl?.dataset?.slimeId;
    if (id) busySlimeIds.delete(id);
}

/**
 * During a Slide, the slime performs a 360° spin on its striking (frame 5) pose
 * for this many milliseconds. This tail is added to the slide's travel time so
 * the whole Slide attack reads a touch slower.
 */
const SLIDE_SPIN_MS = 300;

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

    if (type === 'heal' || type === 'crit-heal' || type === 'mega-crit-heal') {
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
export function showFloatingHealingNumber(x, y, healingAmount, isCrit = false, isMegaCrit = false) {
    const type = isMegaCrit ? 'mega-crit-heal' : isCrit ? 'crit-heal' : 'heal';
    showFloatingDamageNumber(x, y, healingAmount, type);
}

/** Show a green floating healing amount anchored to a battlefield unit element. */
export function showFloatingHealingNumberFromUnit(unitEl, healingAmount, isCrit = false, isMegaCrit = false) {
    if (unitEl === undefined || unitEl === null) return;
    const position = getOverlayPosition(unitEl);
    if (position) showFloatingHealingNumber(position.x + position.width / 2, position.y - 12, healingAmount, isCrit, isMegaCrit);
}
/**
 * Display a centered battlefield banner message (e.g. "🎉 WAVE 10 CLEARED!")
 */
let lastBannerText = '';
let lastBannerAt = 0;

export function showBattlefieldWaveBanner(text) {
    const cardEl = document.querySelector('.battlefield-card') || document.querySelector('.battlefield-overlay') || document.getElementById('gameScreen');
    if (!cardEl) return;

    // De-duplicate rapid repeat calls (e.g. the car bonus wave's delayed
    // spawn path or an inverted-transition re-entry firing startNextWave
    // twice for the same wave) so we never stack two identical banners.
    const now = Date.now();
    if (text === lastBannerText && now - lastBannerAt < 1500) return;
    lastBannerText = text;
    lastBannerAt = now;

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
    if (slimeUnits.length === 0) {
        //console.log('[ATTACK] no .slime-unit elements in armyContainer');
        return;
    }

    const availableSlimes = slimeUnits.filter(unit => !isUnitBusy(unit) && unit.dataset.isEating !== 'true' && !unit.classList.contains('is-stunned'));
    //console.log(`[ATTACK] units=${slimeUnits.length} available=${availableSlimes.length} paused=${isGamePaused}`);
    if (availableSlimes.length === 0) {
        //console.log('[ATTACK] NO available slimes (all attacking/eating/stunned) -> click ignored');
        return;
    }

    const graftNeeded = (gameState.slimes || []).some(slime => slime.hp > 0 && slime.hp < slime.maxHp * 0.75);
    const graftSupportEl = graftNeeded ? availableSlimes.find(unit => {
        const slime = (gameState.slimes || []).find(candidate => String(candidate.id) === String(unit.dataset.slimeId));
        return slime?.talents?.graft && !isMindlessSupport(slime) && getSlimeSpecialization(slime) === 'support' && slime.hp >= slime.maxHp * 0.5;
    }) : null;
    const randomSlimeEl = graftSupportEl || availableSlimes[Math.floor(Math.random() * availableSlimes.length)];
    //console.log(`[ATTACK] chosen slimeId=${randomSlimeEl.dataset.slimeId} graft=${Boolean(graftSupportEl)}`);

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
    if (!support?.talents?.graft || isMindlessSupport(support) || getSlimeSpecialization(support) !== 'support' || support.hp < support.maxHp * 0.5) return false;
    // Prefer a non-Support ally in need. If only Support Slimes remain alive in
    // the roster, fall back to grafting another wounded Support instead.
    const woundedNonSupport = (gameState.slimes || []).filter(s => s.id !== support.id && getSlimeSpecialization(s) !== 'support' && s.hp > 0 && s.hp < s.maxHp * .75);
    const woundedSupport = (gameState.slimes || []).filter(s => s.id !== support.id && getSlimeSpecialization(s) === 'support' && s.hp > 0 && s.hp < s.maxHp * .75);
    const allAliveAreSupport = (gameState.slimes || []).filter(s => s.id !== support.id && s.hp > 0).every(s => getSlimeSpecialization(s) === 'support');
    const candidatePool = woundedNonSupport.length > 0 ? woundedNonSupport : (allAliveAreSupport ? woundedSupport : []);
    const target = candidatePool.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
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
        // Re-resolve the live slime objects from gameState.slimes by id. The
        // captured references can go stale if the army array is rebuilt (e.g.
        // wave restart / NG+ transition), which would silently drop the HOT.
        const liveSupport = gameState.slimes.find(s => String(s.id) === String(support.id)) || support;
        const liveTarget = gameState.slimes.find(s => String(s.id) === String(target.id)) || target;
        const graftMult = getSlimeGraftMultipliers(liveSupport);
        const sacrificedAmount = Math.ceil(liveSupport.maxHp * .2 * graftMult.cost);

        // Critical Heal: the graft's healing rolls for a crit using the grafting
        // slime's crit chance (same tiers as attack crits). A crit doubles the
        // intended healing. This roll MUST happen before any support talents are
        // applied, since Melting Mend / Ice Barrier / Stone Skin all scale off the
        // (possibly crit-doubled) intended healing.
        const graftCritChance = (gameState.disableHealCrit ? 0 : (liveSupport.critChance || 0));
        let isHealCrit = false;
        let isHealMegaCrit = false;
        let healCritMultiplier = 1;
        if (graftCritChance > 0) {
            const critTier = Math.floor(graftCritChance / 100);
            const overflowChance = graftCritChance % 100;
            healCritMultiplier = Math.pow(2, critTier);
            if (overflowChance > 0 && Math.random() * 100 < overflowChance) {
                healCritMultiplier *= 2;
            }
            // Only overflow beyond a guaranteed 100% tier is a mega crit (x4+).
            isHealMegaCrit = healCritMultiplier >= 4;
            isHealCrit = healCritMultiplier > 1;
        }
        const intendedHealing = sacrificedAmount * 2 * graftMult.heal * healCritMultiplier;
        const restoredAmount = Math.min(liveTarget.maxHp - liveTarget.hp, intendedHealing);
        const overhealAmount = Math.max(0, intendedHealing - restoredAmount);
        // Half of the overflow is refunded to the grafting slime (graft doubles the
        // sacrificed HP into healing). The refund is capped to the original sacrificed
        // amount so crits/mega-crits can never return more HP than was spent.
        const overhealRecovery = Math.min(sacrificedAmount, Math.round(overhealAmount / 2));
        liveSupport.hp = Math.min(liveSupport.maxHp, Math.max(1, liveSupport.hp - sacrificedAmount) + overhealRecovery);
        liveTarget.hp += restoredAmount;

        // Melting Mend (Fire Support second talent): the grafted ally gains a
        // "Heal on Time" status that restores a fraction of the INTENDED (theoretical)
        // healing every 0.5s. The base is 5% per tick over 3s (30% total). Sub-talents
        // adjust this via getMeltingMendHotParams: slowMend extends duration to 6s,
        // strongMend raises the per-tick fraction (50% total). Reapplying RESETS the
        // timer (it never extends). Only the per-tick heal value accumulates across
        // repeated grafts. Ticks can show +0 when rounding down.
        if (hasMeltingMend(liveSupport)) {
            if (!liveTarget.effects) {
                liveTarget.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
            }
            const hotParams = getMeltingMendHotParams(liveSupport);
            const perTick = Math.max(0, Math.round(intendedHealing * hotParams.perTickFraction));
            const HOT_DURATION = hotParams.duration;
            // Timer resets to a fixed 3s (never stacks in length).
            liveTarget.effects.healOnTimeTimer = HOT_DURATION;
            liveTarget.effects.healOnTimeTickTimer = (liveTarget.effects.healOnTimeTickTimer || 0);
            // Only the per-tick heal amount accumulates.
            liveTarget.effects.healOnTimePerTick = (liveTarget.effects.healOnTimePerTick || 0) + perTick;
        }

        // Ice Barrier (Ice Support second talent): the grafted ally gains a separate
        // pool of temporary HP equal to 20% of the heal provided (intended/theoretical
        // healing, consistent with Melting Mend). Temporary HP absorbs damage BEFORE
        // the slime's real HP. It is NEVER added to slime.hp (so the main HP bar only
        // ever shows real HP). There is NO time limit — the barrier lasts until its
        // temporary HP is fully depleted by damage. Stackable: repeated grafts add 20%
        // of the heal. Total temporary HP is capped at 60% of the target's Max HP.
        if (hasIceBarrier(liveSupport)) {
            const iceBarrierParams = getIceBarrierParams(liveSupport);
            const applyBarrier = (target) => {
                if (!target || target.hp <= 0) return;
                if (!target.effects) {
                    target.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0, stunTimer: 0 };
                }
                const bonus = Math.round(intendedHealing * iceBarrierParams.bonusMultiplier);
                const MAX_BARRIER_BONUS = Math.round(target.maxHp * 0.60);
                const current = target.effects.iceBarrierBonusHp || 0;
                target.effects.iceBarrierBonusHp = Math.min(MAX_BARRIER_BONUS, current + bonus);
                target.effects.iceBarrierTimer = 0;
            };
            applyBarrier(liveTarget);
            // doubleBarrier: also grant a second barrier (same amount) to a random
            // OTHER alive tank.
            if (iceBarrierParams.extraBarrierToRandomTank) {
                const tanks = (gameState.slimes || []).filter(s =>
                    s.hp > 0 && s !== liveTarget && getSlimeSpecialization(s) === 'tank');
                if (tanks.length) {
                    const randomTank = tanks[Math.floor(Math.random() * tanks.length)];
                    applyBarrier(randomTank);
                }
            }
        }

        // Stone Skin (Stone Support second talent): the grafted ally gains a damage
        // reduction on the next direct hit. Base is a flat pool equal to 50% of the
        // heal (stackable). Sub-talents change this via getStoneSkinParams:
        // emeraldSkin doubles the flat pool; standardization grants a 75% damage
        // reduction on the next direct hit regardless of the graft/heal amount.
        if (hasStoneSkin(liveSupport)) {
            const stoneParams = getStoneSkinParams(liveSupport);
            if (stoneParams.mode === 'pct') {
                liveTarget.reductionPct = Math.max(liveTarget.reductionPct || 0, stoneParams.pct);
            } else {
                const reductionGain = Math.round(intendedHealing * stoneParams.flatMultiplier);
                liveTarget.reduction = (liveTarget.reduction || 0) + reductionGain;
            }
        }

        const targetEl = Array.from(document.querySelectorAll('.slime-unit')).find(el => String(el.dataset.slimeId) === String(liveTarget.id));
        if (targetEl) {
            playSlimeSupportHealAnimation(targetEl);
            showSlimeSupportHealingNumber(targetEl, restoredAmount, isHealCrit, isHealMegaCrit);
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

/**
 * Spawn the tall (24x250px) light ray over the resurrecting Support. Its base sits
 * on the Slime and the rest of the image extends upward, out of frame.
 */
function playResurrectionLightRay(unitEl) {
    const position = getOverlayPosition(unitEl);
    if (!position) return;
    const rayEl = document.createElement('div');
    rayEl.className = 'slime-resurrection-ray';
    // The ray art sits at the bottom-LEFT of its 24px-wide canvas, so we shift the
    // box right by 12px to center the visible beam on the Slime, and drop the base
    // near the Slime's feet so the 250px column rises out of the top of the frame.
    rayEl.style.left = `${position.x + position.width / 2 - 11 + 3 - 1}px`;
    rayEl.style.top = `${position.y + position.height - 2 - 250 + 2}px`;
    // Match the ray's stacking to the resurrecting Support's own z-index.
    rayEl.style.zIndex = unitEl.style.zIndex || '1';
    position.overlay.appendChild(rayEl);
    setTimeout(() => rayEl.remove(), 3000);
}

/** Same ray, but using lightRay2.png (40px wide), aligned identically on the revived target. */
function playResurrectionLightRayTarget(unitEl) {
    const position = getOverlayPosition(unitEl);
    if (!position) return;
    const rayEl = document.createElement('div');
    rayEl.className = 'slime-resurrection-ray slime-resurrection-ray-target';
    // 40px-wide canvas: offset by 20px (half width) to keep it centered on the same point.
    rayEl.style.left = `${position.x + position.width / 2 - 20 + 3 - 1}px`;
    rayEl.style.top = `${position.y + position.height - 2 - 250 + 2}px`;
    // Match the ray's stacking to the revived target's own z-index.
    rayEl.style.zIndex = unitEl.style.zIndex || '1';
    position.overlay.appendChild(rayEl);
    setTimeout(() => rayEl.remove(), 3000);
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

function showSlimeSupportHealingNumber(targetEl, restoredAmount, isCrit = false, isMegaCrit = false) {
    if (restoredAmount <= 0) return;
    const position = getOverlayPosition(targetEl);
    if (position) showFloatingHealingNumber(position.x + position.width / 2, position.y - 12, restoredAmount, isCrit, isMegaCrit);
}

/**
 * Play the Resurrection transition animations:
 * - Each revived Slime appears in its death sprite "dying2" frame (-19px) for 1s,
 *   then "dying1" frame (0px) for 2s, then returns to its idle jump sprite.
 * - The Support that performed the Resurrection briefly switches to the death
 *   sprite "dying1" frame (0px) for 1s, then returns to its idle jump sprite.
 */
export function playResurrectionAnimations(resurrectors, revivedSlimes) {
    const dieSheetFor = (slimeObj) => {
        const config = SLIME_TYPES[slimeObj?.type] || SLIME_TYPES.base;
        return `${config.folder}/die.png`;
    };

    // Lock every involved Slime (revived + resurrector) from acting during the
    // whole 3s animation.
    const unlockUnit = (unit) => {
        if (!unit) return;
        unit.dataset.isAttacking = 'false';
        unit.dataset.isEating = 'false';
    };

    // A revived Slime reuses the same id as its prior (dying) DOM unit. If that
    // unit is still mid death-animation, it will be removed by the pending death
    // cleanup setTimeout and vanish from the battlefield. Drop any stale unit
    // first, then re-render the army so a fresh, stable unit is created.
    (revivedSlimes || []).forEach(slimeObj => {
        const stale = document.querySelector(`.slime-unit[data-slime-id="${String(slimeObj.id)}"]`);
        if (stale) stale.remove();
    });
    renderSlimeArmy();

    const lockUnit = (slimeObj) => {
        const unit = document.querySelector(`.slime-unit[data-slime-id="${String(slimeObj.id)}"]`);
        if (!unit) return null;
        unit.dataset.isAttacking = 'true';
        unit.dataset.isEating = 'true';
        return unit;
    };

    (revivedSlimes || []).forEach(slimeObj => {
        const unit = lockUnit(slimeObj);
        if (!unit) return;
        const img = unit.querySelector('.slime-img');
        const shadow = unit.querySelector('.slime-shadow-sm');
        if (!img) { unlockUnit(unit); return; }

        img.style.animation = 'none';
        img.style.transition = 'none';
        img.style.transform = 'none';
        img.src = dieSheetFor(slimeObj);
        // Dying2 frame (3s) + vibrate, then back to idle
        img.style.objectPosition = '-19px 0px';
        unit.classList.add('slime-dying-vibrate');
        if (shadow) shadow.style.opacity = '0.3';
        playResurrectionLightRayTarget(unit);

        // Back to idle jump sprite
        setTimeout(() => {
            img.src = getSlimeJumpSprite(slimeObj);
            img.style.objectPosition = '0px 0px';
            if (shadow) shadow.style.opacity = '';
            img.style.transition = '';
            unit.classList.remove('slime-dying-vibrate');
            unlockUnit(unit);
        }, 3000);
    });

    (resurrectors || []).forEach(slimeObj => {
        const unit = lockUnit(slimeObj);
        if (!unit) return;
        const img = unit.querySelector('.slime-img');
        if (!img) { unlockUnit(unit); return; }

        img.style.animation = 'none';
        img.style.transition = 'none';
        img.src = dieSheetFor(slimeObj);
        // dying1 frame for 3s + vibrate
        img.style.animation = 'none';
        img.style.objectPosition = '0px 0px';
        unit.classList.add('slime-dying-vibrate');
        playResurrectionLightRay(unit);

        setTimeout(() => {
            img.src = getSlimeJumpSprite(slimeObj);
            img.style.objectPosition = '0px 0px';
            img.style.transition = '';
            unit.classList.remove('slime-dying-vibrate');
            unlockUnit(unit);
        }, 3000);
    });
}
function executeSlimeJumpAttack(unitEl, typeId, slimeObj = null) {
    if (trySupportGraft(unitEl, slimeObj)) {
        //console.log(`[ATTACK] ${unitEl.dataset.slimeId}: support graft consumed the click (no jump)`);
        return;
    }
    // Never start an attack on a unit that is already mid-attack or eating loot.
    if (isUnitBusy(unitEl)) {
        //console.log(`[ATTACK] ${unitEl.dataset.slimeId}: unit busy (already attacking/eating) -> jump skipped`);
        return;
    }
    markUnitBusy(unitEl);
    //console.log(`[ATTACK] ${unitEl.dataset.slimeId}: jump attack started`);
    playJumpSound();
    const slimeConfig = SLIME_TYPES[typeId] || SLIME_TYPES.base;
    const imgEl = unitEl.querySelector('.slime-img');
    const shadowEl = unitEl.querySelector('.slime-shadow-sm');
    if (!imgEl) return;

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
    // Slide (Fighter third talent) turns the tail of the animation into a flat
    // ground dash instead of an arc. `lastSpecialMove` tracks which of
    // Rebound/Slide fired last so the same one never triggers twice in a row
    // (they can still alternate indefinitely).
    let isSliding = false;
    let lastSpecialMove = null;

    function animateJumpFrame(now) {
        // While the game is paused, freeze the jump animation in place (and shift
        // the clock forward so it resumes seamlessly) instead of letting the
        // wall-clock timer keep advancing and land a hit mid-pause.
        if (isGamePaused) {
            startTime += 16;
            requestAnimationFrame(animateJumpFrame);
            return;
        }
        const elapsed = now - startTime;
        let progress = Math.min(1.0, elapsed / jumpDuration);

        // A Slide's duration includes a tail (SLIDE_SPIN_MS) for the striking
        // 360° spin, so its travel occupies only the leading portion of the
        // timeline. `slideTravelRatio` is the progress at which it reaches the
        // target and the spin begins.
        const slideTravelRatio = isSliding
            ? Math.max(0, Math.min(1, (jumpDuration - SLIDE_SPIN_MS) / jumpDuration))
            : 1;
        // Position uses travel progress (clamped to 1) so the dash finishes at
        // the target and the slime stays put while it spins.
        const travelProgress = Math.min(1.0, progress / slideTravelRatio);
        const dx = baseX + maxDx * travelProgress;
        // A Slide stays glued to the ground: no altitude arc, only horizontal travel.
        const dy = isSliding ? baseY : baseY - 4 * maxAltitude * progress * (1.0 - progress);

        // A jump/Rebound deals its hit at 90% of the arc (just before landing),
        // but a Slide must travel the FULL distance first — its hit only lands
        // once the slime has actually reached the furthest enemy, otherwise the
        // damage fires mid-dash and the slime rushes into the next action.
        const impactThreshold = isSliding ? slideTravelRatio : 0.90;

        // During the Slide's striking tail, spin a full 360° over SLIDE_SPIN_MS
        // while doing a small hop (like the Blocking slime's jump) for a more
        // natural, lively strike.
        let slideSpinDeg = 0;
        let slideHopPx = 0;
        if (isSliding && progress >= slideTravelRatio) {
            const spinProgress = Math.min(1.0, (progress - slideTravelRatio) / (1.0 - slideTravelRatio));
            slideSpinDeg = spinProgress * 360;
            // One small hop peaking mid-spin: up then back down to the ground.
            slideHopPx = -Math.sin(spinProgress * Math.PI) * 6;
        }

        imgEl.style.transform = `translate(${dx}px, ${dy + slideHopPx}px)${slideSpinDeg ? ` rotate(${slideSpinDeg}deg)` : ''}`;
        // Center the rotation pivot (the sprite normally pivots from the bottom
        // for squish/impact effects) so the Slide spin spins in place.
        imgEl.style.transformOrigin = slideSpinDeg ? 'center center' : '';

        // Keep the Ice Barrier shield glued to the jumping slime image.
        const barrierEl = unitEl.querySelector('.slime-ice-barrier');
        if (barrierEl) {
            barrierEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }

        if (shadowEl) {
            // While the Slide hops during its spin, shrink/fade the shadow like a
            // real jump so the hop reads as a small leap off the ground.
            const effHop = isSliding ? Math.abs(slideHopPx) : Math.abs(dy);
            const hopRef = isSliding ? 6 : (maxAltitude * 1.2);
            const shadowScale = Math.max(0.3, 1.0 - (effHop / hopRef));
            shadowEl.style.transform = `translateX(${dx}px) scale(${shadowScale})`;
            shadowEl.style.opacity = shadowScale;
        }

        // A Slide dashes holding frame 8, then performs its striking 360° spin on
        // frame 5 (the "striking" pose) for the slide tail before returning.
        let spriteFrame = 1;
        if (isSliding) spriteFrame = progress >= slideTravelRatio ? 5 : 8;
        else if (progress < 0.08) spriteFrame = 1;
        else if (progress < 0.18) spriteFrame = 2;
        else if (progress < 0.32) spriteFrame = 3;
        else if (progress < 0.48) spriteFrame = 4;
        else if (progress < 0.62) spriteFrame = 5;
        else if (progress < 0.76) spriteFrame = 6;
        else if (progress < 0.90) spriteFrame = 7;
        else spriteFrame = 8;

        imgEl.src = getSlimeJumpSprite(slimeObj);
        imgEl.style.objectPosition = `${-(spriteFrame - 1) * 19}px 0px`;

        if (progress >= 1 && !hasDealtDamage) {
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

            // Momentum (Rebound sub-talent): the hit landed by a Rebound deals +20%.
            if (lastSpecialMove === 'rebound' && getSlimeSubTalentDef(slimeObj, 0)?.id === 'momentum') {
                currentDamage = currentDamage * 1.2;
            }

            dealTargetEnemyDamage(targetEnemy, currentDamage, slimeConfig, isCrit, slimeObj, isMegaCrit, lastSpecialMove);

            const phase = isSliding ? 'SLIDE' : (lastSpecialMove === 'rebound' ? 'REBOUND' : 'JUMP');
            // If no target enemies are in range (x <= 450), slime performs jump animation without dealing damage

            // Fighter follow-up moves. Rebound rejumps at the second closest target;
            // Slide dashes along the ground to the furthest one. Each has a 50%
            // chance, and neither can trigger twice in a row — but they may
            // alternate indefinitely (Rebound -> Slide -> Rebound -> ...).
            const isFighter = getSlimeSpecialization(slimeObj) === 'fighter';
            const canRebound = isFighter && Boolean(slimeObj?.talents?.rebound) && lastSpecialMove !== 'rebound';
            const canSlide = isFighter && hasSlide(slimeObj) && lastSpecialMove !== 'slide';
            const currentArmyX = startX + dx;

            let followUp = null;
            if (canRebound) {
                const reboundTarget = pickReboundTarget(slimeObj, currentArmyX, targetEnemy);
                if (reboundTarget && Math.random() < 0.5) {
                    followUp = { move: 'rebound', target: reboundTarget };
                }
            }
            if (!followUp && canSlide) {
                const slideTarget = pickSlideTarget(currentArmyX, slimeObj, targetEnemy);
                // Don't Slide into the enemy we just hit — the same target can't be
                // attacked twice in a row, and Slide must reach a further one.
                if (slideTarget && slideTarget !== targetEnemy && Math.random() < 0.5) {
                    followUp = { move: 'slide', target: slideTarget };
                }
            }

            if (followUp) {
                const isSlideMove = followUp.move === 'slide';
                const trajectory = isSlideMove
                    ? computeSlideTrajectory(currentArmyX, followUp.target)
                    : computeReboundTrajectory(currentArmyX, followUp.target);
                baseX = dx;
                // A Slide starts from the ground, so drop any leftover altitude.
                baseY = isSlideMove ? 0 : dy;
                targetEnemy = followUp.target;
                maxDx = trajectory.maxDx;
                maxAltitude = trajectory.maxAltitude;
                jumpDuration = trajectory.jumpDuration;
                startTime = now;
                progress = 0;
                hasDealtDamage = false;
                isSliding = isSlideMove;
                lastSpecialMove = followUp.move;
                // Slide holds frame 8 while dashing; Rebound restarts the jump at frame 2.
                spriteFrame = isSlideMove ? 8 : 2;
                imgEl.style.objectPosition = `${-(spriteFrame - 1) * 19}px 0px`;
                showFloatingStatusText(
                    followUp.target,
                    String.fromCodePoint(isSlideMove ? 0x21E2 : 0x21AA),
                    isSlideMove ? 'slide-text' : 'rebound-text'
                );
            }
        }

        if (progress < 1.0) {
            requestAnimationFrame(animateJumpFrame);
        } else {
            // Keep the Ice Barrier glued to the landing position (don't snap it back
            // to the origin) so it doesn't teleport ahead of the returning sprite.
            const barrierEl = unitEl.querySelector('.slime-ice-barrier');
            if (barrierEl) {
                const finalDx = baseX + maxDx;
                barrierEl.style.transform = `translate(calc(-50% + ${finalDx}px), -50%)`;
            }
            setTimeout(() => {
                // Return over the TOTAL travelled distance (baseX accumulates every
                // chained Rebound/Slide leg), not just the last leg's maxDx.
                startSmoothReturnWalk(unitEl, imgEl, shadowEl, slimeConfig, baseX + maxDx);
            }, 90);
        }
    }

    requestAnimationFrame(animateJumpFrame);
}

/**
 * Apply a single combined set of elemental hit-effects to an enemy.
 * Mirrors the status application previously inlined in dealTargetEnemyDamage so a
 * Slime's hit profile can be reused (and stacked/repeated) elsewhere, e.g. Spicy Block.
 * Returns the freeze bonus damage dealt (used by Leech).
 */
export function applyHitEffectsToEnemy(enemy, hitEffects, sourceSlime = null, isControlImmune = false) {
    if (!enemy) return 0;
    if (!enemy.effects) {
        enemy.effects = { burnTimer: 0, burnTickTimer: 0, burnStacks: 0, freezeTimer: 0, stunTimer: 0, poisonTimer: 0, poisonTickTimer: 0, poisonStacks: 0 };
    }
    const effects = enemy.effects;
    let freezeDmgDealt = 0;

    if (hitEffects.burn > 0) {
        effects.burnStacks = effects.burnTimer > 0
            ? (effects.burnStacks || 0) + hitEffects.burn
            : hitEffects.burn;
        effects.burnTimer = 5.0;
    }
    if (hitEffects.poison > 0) {
        effects.poisonStacks = effects.poisonTimer > 0
            ? (effects.poisonStacks || 0) + hitEffects.poison
            : hitEffects.poison;
        effects.poisonTimer = 5.0;
    }
    // Immolation (Fire Fighter) "Oil Combustion" sub-talent: convert the target's
    // current poison Stacks into burn Stacks on hit (poison is cleared, burn added).
    if (sourceSlime && hasImmolation(sourceSlime) && getImmolationParams(sourceSlime).convertPoisonToBurn) {
        const converted = effects.poisonStacks || 0;
        if (converted > 0) {
            effects.burnStacks = effects.burnTimer > 0
                ? (effects.burnStacks || 0) + converted
                : converted;
            effects.burnTimer = 5.0;
            effects.poisonStacks = 0;
            effects.poisonTimer = 0;
        }
    }
    if (hitEffects.freeze > 0 && !isControlImmune) {
        effects.freezeTimer = 1 * hitEffects.freeze;
        let baseFreeze = 5;
        if (hasIceBurst(sourceSlime)) {
            const iceBurstParams = getIceBurstParams(sourceSlime);
            if (iceBurstParams.mode === 'burn') {
                baseFreeze = (effects.burnStacks || 0) * iceBurstParams.multiplier;
            } else if (iceBurstParams.mode === 'poison') {
                baseFreeze = (effects.poisonStacks || 0) * iceBurstParams.multiplier;
            } else {
                baseFreeze = ((effects.burnStacks || 0) + (effects.poisonStacks || 0));
            }
        }
        const freezeDmg = baseFreeze * hitEffects.freeze;
        freezeDmgDealt = Math.min(enemy.hp, freezeDmg);
        if (freezeDmgDealt > 0) {
            enemy.hp -= freezeDmgDealt;
            showFloatingDamageNumber(enemy.x - 8, enemy.y - 20, freezeDmgDealt, 'freeze-dmg');
            showFloatingStatusText(enemy, String.fromCodePoint(0x2744, 0xFE0F), 'freeze-text');
        }
    }
    if (hitEffects.stun > 0 && !isControlImmune) {
        // Stun fully disables the enemy's attack for the duration. Heavy Strike
        // "Headbutt" sub-talent doubles the applied Stun.
        let stunMultiplier = 1;
        if (sourceSlime && hasHeavyStrike(sourceSlime)) {
            stunMultiplier = getHeavyStrikeParams(sourceSlime).stunMultiplier;
        }
        const stunDuration = (SLIME_TYPES[sourceSlime?.type]?.stunDuration || 0.3) * hitEffects.stun * stunMultiplier;
        effects.stunTimer = Math.max(effects.stunTimer || 0, stunDuration);
        showFloatingStatusText(enemy, String.fromCodePoint(0x1F4AB), 'stun-text');
    }
    return freezeDmgDealt;
}

/**
 * Deal damage & apply elemental status effects (Fire Burn / Frost Freeze) to target enemy.
 */
function dealTargetEnemyDamage(targetEnemy, damageAmount, slimeConfig, isCrit = false, slimeObj = null, isMegaCrit = false, move = 'jump') {
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
    // Corrosive Poison (Poison Fighter second talent): direct damage is boosted by
    // a fraction of the target's current stacks as a percentage (base: 10% of poison
    // stacks, e.g. 50 poison => +5% damage).
    let effectiveDamage = damageAmount;
    if (slimeObj && hasCorrosivePoison(slimeObj) && currentTarget.effects) {
        const corrosiveParams = getCorrosivePoisonParams(slimeObj);
        const poisonStacks = currentTarget.effects.poisonStacks || 0;
        const burnStacks = currentTarget.effects.burnStacks || 0;
        const bonusPct = (poisonStacks * corrosiveParams.poisonPct + burnStacks * corrosiveParams.burnPct) / 100;
        if (bonusPct > 0) effectiveDamage = effectiveDamage * (1 + bonusPct);
    }
    // Cheap Shot (Slide sub-talent): the Slide hit deals +20% damage. Only applies
    // when this hit was dealt by a Slide follow-up (move === 'slide').
    if (slimeObj && move === 'slide' && getSlideParams(slimeObj).slideDamagePct > 0) {
        effectiveDamage = effectiveDamage * (1 + getSlideParams(slimeObj).slideDamagePct / 100);
    }
    // Heavy Strike (Stone Fighter second talent): "Penetration" sub-talent adds a
    // +20% damage bonus (applied here, before the single damage resolution below).
    if (slimeObj && hasHeavyStrike(slimeObj)) {
        const heavyParams = getHeavyStrikeParams(slimeObj);
        if (heavyParams.damagePct > 0) effectiveDamage = effectiveDamage * (1 + heavyParams.damagePct / 100);
    }
    const damageToApply = Math.min(currentTarget.hp, Math.round(effectiveDamage));

    currentTarget.hp -= damageToApply;
    // Any Slime damage to an enemy disarms the "Self Defense" Boss-wave flag.
    markSlimeAttacked();

    // Heavy Strike (Stone Fighter second talent): knock the target back and force
    // it to re-approach its targetX before it can attack again. Sub-talents can
    // halve/remove the pushback ("Penetration" -> 5px, "Headbutt" -> none).
    if (slimeObj && hasHeavyStrike(slimeObj) && currentTarget.type !== 'rush') {
        const heavyParams = getHeavyStrikeParams(slimeObj);
        if (heavyParams.pushbackPx > 0) {
            currentTarget.x = Math.min(450, currentTarget.x + heavyParams.pushbackPx);
            // Re-engage the walking state so the movement phase makes it walk back to
            // targetX (and only resumes attacking once it arrives).
            currentTarget.state = 'walking';
            currentTarget.attackTimer = 0;
            if (currentTarget.el) {
                currentTarget.el.style.left = `${currentTarget.x}px`;
                currentTarget.el.classList.remove('enemy-attacking', 'enemy-tanking', 'enemy-range', 'enemy-support');
                currentTarget.el.classList.add('enemy-walking');
            }
            showFloatingStatusText(currentTarget, String.fromCodePoint(0x1F4A5), 'pushback-text');
        }
    }

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
    const freezeDmgDealt = applyHitEffectsToEnemy(currentTarget, getSlimeHitEffects(sourceSlime), sourceSlime, isControlImmune);
    // direct damage it inflicts (main hit + freeze bonus damage), up to the target's Max HP.
    if (slimeObj && hasLeech(slimeObj)) {
        const leechParams = getLeechParams(slimeObj);
        const leechAmount = Math.round(((damageToApply || 0) + (typeof freezeDmgDealt === 'number' ? freezeDmgDealt : 0)) * leechParams.multiplier);
        if (leechAmount > 0) {
            // mindlessSupport: redirect the heal to the lowest-HP living ally
            // (the leeching slime itself excluded) instead of self.
            let healTarget = slimeObj;
            if (leechParams.healLowestAlly) {
                const allies = (gameState.slimes || []).filter(s => s !== slimeObj && s.hp > 0 && s.hp < s.maxHp);
                let lowest = null;
                for (const a of allies) {
                    if (!lowest || (a.hp / a.maxHp) < (lowest.hp / lowest.maxHp)) lowest = a;
                }
                if (lowest) healTarget = lowest;
            }
            if (healTarget.hp > 0) {
                const healed = Math.min(healTarget.maxHp - healTarget.hp, leechAmount);
                healTarget.hp += healed;
                const healUnit = document.querySelector(`.slime-unit[data-slime-id="${healTarget.id}"]`);
                if (healUnit) showFloatingHealingNumberFromUnit(healUnit, healed);
            }
        }
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

    // Glue the Ice Barrier to the returning slime so it walks back with it
    // instead of snapping to the origin ahead of the sprite.
    const barrierEl = unitEl.querySelector('.slime-ice-barrier');
    if (barrierEl) {
        barrierEl.style.transition = `transform ${returnDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
        barrierEl.style.transform = 'translate(-50%, -50%)';
    }

    imgEl.style.transform = 'translate(0px, 0px)';
    if (shadowEl) {
        shadowEl.style.transform = 'translate(0px, 0px) scale(1)';
        shadowEl.style.opacity = '1';
    }

    setTimeout(() => {
        imgEl.style.transition = '';
        if (shadowEl) shadowEl.style.transition = '';
        if (barrierEl) barrierEl.style.transition = '';

        const originalZ = unitEl.dataset.originalZ || '1';
        unitEl.style.zIndex = originalZ;
        unitEl.dataset.isAttacking = 'false';
        markUnitFree(unitEl);

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
 * Pick the second closest alive enemy in range, relative to the slime's current
 * airborne X. Unlike the original "second closest to the slimes" rule, this lets
 * a Rebound come back leftward onto a nearer enemy — it ranks every valid enemy
 * by distance from refX (smallest first) and returns the second one.
 */
function pickReboundTarget(slimeObj, refX = 20, excludeTarget = null) {
    const candidates = activeEnemies
        .filter(e => e.hp > 0 && e.x >= 90 && e.x <= 450 && e !== excludeTarget)
        .map(e => ({ e, d: Math.abs(e.x - refX) }))
        .sort((a, b) => a.d - b.d)
        .map(o => o.e);
    if (candidates.length < 1) return null;
    if (getSlimeSubTalentDef(slimeObj, 0)?.id === 'chaos') {
        // Chaos: hit a random valid enemy (never the one just struck) instead of
        // the second closest.
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return candidates[1] || candidates[0];
}

/**
 * Pick the furthest alive enemy for the Fighter Slide talent.
 * Slide reaches into the backlane but never past X 420, and it must actually
 * move forward, so anything at or behind the slime's current position is skipped.
 */
function pickSlideTarget(refX, slimeObj, excludeTarget = null) {
    const candidates = activeEnemies
        .filter(e => e.hp > 0 && e.x >= 90 && e.x <= 420 && e.x > refX && e !== excludeTarget);
    if (candidates.length === 0) return null;
    // Chaos (Slide sub-talent): target a random valid enemy instead of the furthest.
    if (slimeObj && getSlideParams(slimeObj).randomTarget) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return candidates.sort((a, b) => b.x - a.x)[0];
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
    // Stop just short of the target (4px). The impact must be allowed to land near
    // the target even when it is far away — the old ±20px clamp around the launch
    // point was only meant for the tiny initial hop and silently capped Rebound/
    // Slide travel at 20px, so the slime "impacted" without ever reaching the
    // enemy. Clamp instead to the band between launch and target.
    const desired = predictedX - 4;
    const bandLow = Math.min(refStartX, predictedX) - 20;
    const bandHigh = Math.max(refStartX, predictedX) + 20;
    return Math.min(450, Math.max(bandLow, Math.min(bandHigh, desired)));
}

/**
 * Recompute jump trajectory for a Rebound rejump from the current airborne position.
 */
function computeReboundTrajectory(refX, target) {
    const targetImpactX = computeJumpImpactX(refX, target);
    // Signed travel distance: positive = right, negative = left (a back-track
    // Rebound onto a closer enemy). Keep a minimum arc length so a short hop onto
    // a near enemy still reads as a jump, but allow it to go negative.
    const rawDx = targetImpactX - refX;
    const travel = Math.abs(rawDx);
    const minTravel = 35;
    const maxDx = travel < minTravel ? (rawDx >= 0 ? minTravel : -minTravel) : rawDx;
    const maxAltitude = Math.min(65, Math.max(35, 25 + travel * 0.16));
    const jumpDuration = Math.min(750, Math.max(480, 450 + travel * 0.75));
    return { maxDx, maxAltitude, jumpDuration };
}

/**
 * Recompute the trajectory for a Fighter Slide from the current landing position.
 * A Slide is a flat ground dash (no altitude) toward the furthest enemy, capped
 * at X 420, and it travels noticeably faster than a jump of the same length.
 */
function computeSlideTrajectory(refX, target) {
    // Clamp the destination to 420 first, then derive the travel distance from it
    // so the slide can never overshoot the cap (even when the slime is already
    // close to it and the generic impact helper would push it further out).
    const targetImpactX = Math.min(420, computeJumpImpactX(refX, target));
    const maxDx = Math.max(0, targetImpactX - refX);
    const jumpDuration = Math.min(600, Math.max(280, 220 + maxDx * 0.5)) + SLIDE_SPIN_MS;
    return { maxDx, maxAltitude: 0, jumpDuration };
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
        .filter(u => u.dataset.isAttacking !== 'true' && u.dataset.isEating !== 'true' && !u.classList.contains('is-stunned') && !isUnitBusy(u));

    if (slimeUnits.length === 0) return;

    const unitEl = slimeUnits[Math.floor(Math.random() * slimeUnits.length)];
    unitEl.dataset.isEating = 'true';
    markUnitBusy(unitEl);
    playLootSound();

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

        // Inflation upgrade adds a +X% scraps bonus on top of the base loot value.
        const inflationBonus = getInflationBonusScraps(targetLoot.value);
        const totalScraps = (targetLoot.value || 0) + inflationBonus;
        addScraps(totalScraps);
        updateLootHUD();
        requestUIRefresh();

        // 1. Immediately pop +N food scrap floating text (floats straight up)
        showFloatingStatusTextAt(targetLoot.x, targetLoot.y, `+${totalScraps} <img src="images/logos/scrap.png" alt="scrap" class="loot-text-icon">`, 'loot-text');

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
                    markUnitFree(unitEl);
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
    const armyContainer = document.getElementById('armyContainer');
    if (!armyContainer) return;

    // Count slimes that are currently free to eat (not attacking, not already
    // eating, not stunned). Never dispatch more than are actually available —
    // e.g. with a high Digestion level but only one free Slime, send just one.
    const isFree = (u) =>
        u.dataset.isAttacking !== 'true' &&
        u.dataset.isEating !== 'true' &&
        !u.classList.contains('is-stunned');
    const availableCount = Array.from(armyContainer.querySelectorAll('.slime-unit')).filter(isFree).length;
    if (availableCount === 0) return;

    const countToDispatch = Math.min(1 + (gameState.digestionLevel || 0), availableCount);

    for (let i = 0; i < countToDispatch; i++) {
        if (i === 0) {
            dispatchSingleSlimeToEat();
        } else {
            // Re-check availability at fire time so we never send a Slime that
            // became busy, and so each dispatch picks from the still-free pool.
            setTimeout(() => {
                const stillFree = Array.from(armyContainer.querySelectorAll('.slime-unit')).filter(isFree).length;
                if (stillFree > 0) dispatchSingleSlimeToEat();
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
    if (isGamePaused) return;
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

