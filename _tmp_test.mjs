global.document = { querySelectorAll: () => [], getElementById: () => null, querySelector: () => null };
global.window = global;
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem: () => {} };

import * as state from './js/state.js';

const support = {
    id: 'support1', type: 'stone', specialization: 'support',
    maxHp: 100, hp: 100, critChance: 0,
    talents: { graft: true, stoneSupportTalent2: true, subTalents: { 0: null, 1: 0, 2: null } }
};
const ally = { id: 'ally1', type: 'fire', specialization: 'fighter', maxHp: 100, hp: 60, talents: {}, subTalents: { 0: null, 1: null, 2: null }, effects: {} };
global.gameState = { slimes: [support, ally], disableHealCrit: true };

console.log('hasStoneSkin=', state.hasStoneSkin(support));
console.log('stoneParams=', JSON.stringify(state.getStoneSkinParams(support)));

const liveSupport = support, liveTarget = ally;
const graftMult = state.getSlimeGraftMultipliers(liveSupport);
const sacrificedAmount = Math.ceil(liveSupport.maxHp * 0.2 * graftMult.cost);
const intendedHealing = sacrificedAmount * 2 * graftMult.heal;
const stoneParams = state.getStoneSkinParams(liveSupport);
if (stoneParams.mode === 'pct') liveTarget.reductionPct = Math.max(liveTarget.reductionPct || 0, stoneParams.pct);
else liveTarget.reduction = (liveTarget.reduction || 0) + Math.round(intendedHealing * stoneParams.flatMultiplier);
console.log('ally.reductionPct after graft=', liveTarget.reductionPct);

let damageAmount = 40;
if (damageAmount && (ally.reductionPct || 0) > 0) {
    damageAmount = Math.max(0, Math.round(damageAmount * (1 - ally.reductionPct)));
    ally.reductionPct = 0;
}
const before = ally.hp;
ally.hp = Math.max(0, ally.hp - damageAmount);
console.log('hit 40 -> ally.hp', before, '->', ally.hp, '(expected 50)');
