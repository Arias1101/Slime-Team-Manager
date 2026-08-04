/**
 * Shop Module - Mid-Game Merchant Market (Appears every 10 waves)
 */

import { gameState, saveStateToLocal, updateBestRoster, addScraps } from './state.js';
import { ENEMY_TYPES } from './enemies.js';
import { SLIME_TYPES } from './state.js';
import { updateUI } from './ui.js';
import { startNextWave } from './enemies.js';
import { setGamePaused } from './engine.js';

let selectedShopSlimeId = null;
let shopInventory = []; // Array of 3 items: [{ id, enemyKey, name, sprite, effectText, effectsList, price, lootValue, bought }]
let nextWaveNumber = 11;

/**
 * Initialize shop event listeners
 */
export function initShopModule() {
    const leaveBtn = document.getElementById('btnLeaveShop');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            closeShopModal();
        });
    }
}

/**
 * Generate 3 random shop items selected from ENEMY_TYPES
 */
function generateShopStock() {
    const enemyKeys = Object.keys(ENEMY_TYPES).filter(k => k !== 'test');
    if (enemyKeys.length === 0) return;

    shopInventory = [];

    // Pick 3 random unique enemy types
    const shuffled = [...enemyKeys].sort(() => 0.5 - Math.random());
    const selectedKeys = shuffled.slice(0, 3);

    selectedKeys.forEach((key, index) => {
        const def = ENEMY_TYPES[key];
        const lootVal = def.loot_value || 2;
        const buyPrice = lootVal * 2;

        const rawLootEffect = def.loot_effect || { stat: 'hp', value: 1, text: '+1 Max HP' };
        const effectsList = Array.isArray(rawLootEffect)
            ? rawLootEffect
            : (rawLootEffect.effects ? rawLootEffect.effects : [rawLootEffect]);

        const textParts = [];
        effectsList.forEach(eff => {
            if (eff.text) {
                textParts.push(eff.text);
            } else if (eff.stat === 'hp') {
                textParts.push(`${eff.value >= 0 ? '+' : ''}${eff.value} Max HP`);
            } else if (eff.stat === 'damage') {
                textParts.push(`${eff.value >= 0 ? '+' : ''}${eff.value} Damage`);
            } else if (eff.stat === 'regen') {
                textParts.push(`${eff.value >= 0 ? '+' : ''}${eff.value} HP Regen`);
            } else if (eff.stat === 'crit') {
                textParts.push(`${eff.value >= 0 ? '+' : ''}${eff.value}% Crit`);
            } else if (eff.stat === 'effect') {
                textParts.push(eff.effectType ? `✨ ${eff.effectType}` : '✨ Effect');
            }
        });

        shopInventory.push({
            shopItemId: `shop_item_${Date.now()}_${index}`,
            enemyKey: key,
            name: def.loot_name || key,
            sprite: `images/loots/${key}.png`,
            effectText: textParts.join(', ') || '+1 Max HP',
            effectsList: effectsList,
            price: buyPrice,
            lootValue: lootVal,
            bought: false
        });
    });
}

/**
 * Open the Shop Modal Popup (triggered on wave 10 / 20 / 30...)
 */
export function openShopModal(currentWaveNum) {
    nextWaveNumber = (currentWaveNum || 10) + 1;

    // Default select first slime in roster
    if (gameState.slimes && gameState.slimes.length > 0) {
        selectedShopSlimeId = gameState.slimes[0].id;
    }

    generateShopStock();

    const backdropEl = document.getElementById('shopModalBackdrop');
    const continueBtnEl = document.getElementById('btnLeaveShop');
    if (continueBtnEl) {
        continueBtnEl.textContent = `Continue to Wave ${nextWaveNumber} ⚔️`;
    }

    renderShopUI();

    if (backdropEl) {
        backdropEl.classList.remove('hidden');
        document.body.classList.add('modal-open');
        setGamePaused(true);
    }
}

/**
 * Close Shop Modal and resume gameplay
 */
export function closeShopModal() {
    const backdropEl = document.getElementById('shopModalBackdrop');
    if (backdropEl) {
        backdropEl.classList.add('hidden');
    }
    document.body.classList.remove('modal-open');
    setGamePaused(false);

    startNextWave();
}

/**
 * Render complete Shop UI
 */
export function renderShopUI() {
    const scrapsCountEl = document.getElementById('shopScrapsCount');
    if (scrapsCountEl) {
        scrapsCountEl.textContent = gameState.scraps || 0;
    }

    renderSlimeRosterBrowser();
    renderSelectedSlimeSheet();
    renderShopMarketItems();
}

/**
 * Render Left Column Section 1: Slime Roster Browser
 */
function renderSlimeRosterBrowser() {
    const container = document.getElementById('shopSlimeRoster');
    if (!container) return;

    container.innerHTML = '';

    if (!gameState.slimes || gameState.slimes.length === 0) {
        container.innerHTML = '<p class="shop-empty-text">No slimes in army.</p>';
        return;
    }

    gameState.slimes.forEach(slime => {
        const slimeConfig = SLIME_TYPES[slime.type] || SLIME_TYPES.base;
        const isSelected = slime.id === selectedShopSlimeId;
        const isAscended = slime.ascended === true;

        const card = document.createElement('div');
        card.className = `shop-slime-avatar ${isSelected ? 'selected' : ''} ${isAscended ? 'ascended' : ''}`;
        card.title = `${slime.name} (${slimeConfig.name}): ${slime.hp}/${slime.maxHp} HP`;

        card.innerHTML = `
            <img src="${slimeConfig.folder}/${slimeConfig.prefix}1.png" class="shop-avatar-img" alt="${slime.name}">
            <span class="shop-avatar-name">${slime.name}</span>
            ${isAscended ? '<span class="shop-avatar-sparkle">✨</span>' : ''}
        `;

        card.addEventListener('click', () => {
            selectedShopSlimeId = slime.id;
            renderShopUI();
        });

        container.appendChild(card);
    });
}

/**
 * Render Left Column Section 2: Selected Slime Details & Equipment Selling
 */
function renderSelectedSlimeSheet() {
    const container = document.getElementById('shopSelectedSlimeCard');
    if (!container) return;

    const selectedSlime = gameState.slimes ? gameState.slimes.find(s => s.id === selectedShopSlimeId) : null;

    if (!selectedSlime) {
        container.innerHTML = '<p class="shop-empty-text">Select a slime to manage equipment.</p>';
        return;
    }

    const slimeConfig = SLIME_TYPES[selectedSlime.type] || SLIME_TYPES.base;
    const isAscended = selectedSlime.ascended === true;

    let html = `
        <div class="shop-slime-info-header">
            <img src="${slimeConfig.folder}/${slimeConfig.prefix}1.png" class="shop-slime-portrait" alt="${selectedSlime.name}">
            <div class="shop-slime-info-text">
                <div class="shop-slime-info-name">
                    ${selectedSlime.name}
                    ${isAscended ? '<span class="ascended-badge">✨ Ascended</span>' : ''}
                </div>
                <div class="shop-slime-info-stats">
                    ❤️ ${selectedSlime.hp}/${selectedSlime.maxHp} HP | ⚔️ ${selectedSlime.damage} Dmg | ⚡ ${selectedSlime.critChance || 0}% Crit
                </div>
            </div>
        </div>
        <div class="shop-slime-equipment-title">Equipments (${selectedSlime.equipment ? selectedSlime.equipment.length : 0})</div>
        <div class="shop-slime-equipment-list">
    `;

    if (!selectedSlime.equipment || selectedSlime.equipment.length === 0) {
        html += '<p class="shop-empty-text">No equipment on this slime.</p>';
    } else {
        selectedSlime.equipment.forEach((eq, index) => {
            const enemyKey = eq.id;
            const enemyDef = ENEMY_TYPES[enemyKey];
            const lootVal = eq.lootValue || (enemyDef ? enemyDef.loot_value : 2) || 2;
            const sellPrice = Math.max(1, Math.floor(lootVal * 0.5));

            html += `
                <div class="shop-equipment-row">
                    <div class="shop-eq-left">
                        <img src="${eq.sprite || `images/loots/${eq.id}.png`}" class="shop-eq-icon" alt="${eq.name}">
                        <div class="shop-eq-details">
                            <span class="shop-eq-name">${eq.name}</span>
                            <span class="shop-eq-effect">${eq.effectText || '+1 Max HP'}</span>
                        </div>
                    </div>
                    <button class="btn-sell-equipment" data-eq-index="${index}">
                        Sell for ${sellPrice} 🍖
                    </button>
                </div>
            `;
        });
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach click listeners to Sell buttons
    const sellBtns = container.querySelectorAll('.btn-sell-equipment');
    sellBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.eqIndex, 10);
            sellSlimeEquipment(selectedSlime, index);
        });
    });
}

/**
 * Sell equipment from a slime for 50% scrap value
 */
function sellSlimeEquipment(slime, eqIndex) {
    if (!slime || !slime.equipment || eqIndex < 0 || eqIndex >= slime.equipment.length) return;

    const itemToSell = slime.equipment[eqIndex];
    const enemyKey = itemToSell.id;
    const enemyDef = ENEMY_TYPES[enemyKey];
    const lootVal = itemToSell.lootValue || (enemyDef ? enemyDef.loot_value : 2) || 2;
    const sellPrice = Math.max(1, Math.floor(lootVal * 0.5));

    // Remove item from slime equipment array
    slime.equipment.splice(eqIndex, 1);

    // Revert stat bonuses granted by item
    const effectsList = itemToSell.effects || [itemToSell];
    effectsList.forEach(eff => {
        const effectStat = eff.stat || 'hp';
        const effectValue = eff.value || 1;

        if (effectStat === 'hp') {
            slime.maxHp = Math.max(1, slime.maxHp - effectValue);
            slime.hp = Math.max(1, Math.min(slime.hp, slime.maxHp));
        } else if (effectStat === 'damage') {
            slime.damage = Math.max(1, slime.damage - effectValue);
        } else if (effectStat === 'regen') {
            slime.regen = Math.max(0, (slime.regen || 0) - effectValue);
        } else if (effectStat === 'crit') {
            slime.critChance = Math.max(0, (slime.critChance || 0) - effectValue);
        }
    });

    // Add scraps refund
    addScraps(sellPrice);
    updateBestRoster();
    saveStateToLocal();
    updateUI();

    renderShopUI();
}

/**
 * Render Right Column Section 3: Merchant Market (3 Items)
 */
function renderShopMarketItems() {
    const container = document.getElementById('shopMarketList');
    if (!container) return;

    container.innerHTML = '';

    shopInventory.forEach(item => {
        const selectedSlime = gameState.slimes ? gameState.slimes.find(s => s.id === selectedShopSlimeId) : null;
        const alreadyHasItem = selectedSlime && selectedSlime.equipment
            ? selectedSlime.equipment.some(eq => eq.id === item.enemyKey)
            : false;

        const canAfford = (gameState.scraps || 0) >= item.price;

        const card = document.createElement('div');
        card.className = `shop-market-card ${item.bought ? 'bought' : ''}`;

        card.innerHTML = `
            <div class="shop-market-card-left">
                <img src="${item.sprite}" class="shop-market-item-icon" alt="${item.name}">
                <div class="shop-market-item-info">
                    <div class="shop-market-item-name">${item.name}</div>
                    <div class="shop-market-item-effect">${item.effectText}</div>
                </div>
            </div>
            <div class="shop-market-card-right">
                ${item.bought ? `
                    <span class="badge-bought">✓ SOLD OUT</span>
                ` : `
                    <button class="btn-buy-shop-item" ${(!canAfford || alreadyHasItem) ? 'disabled' : ''}>
                        Buy for ${item.price} 🍖
                    </button>
                    ${alreadyHasItem ? '<span class="shop-owned-text">Already Owned</span>' : ''}
                `}
            </div>
        `;

        if (!item.bought) {
            const buyBtn = card.querySelector('.btn-buy-shop-item');
            if (buyBtn && canAfford && !alreadyHasItem) {
                buyBtn.addEventListener('click', () => {
                    buyShopItem(item);
                });
            }
        }

        container.appendChild(card);
    });
}

/**
 * Purchase item from shop and equip on selected slime
 */
function buyShopItem(item) {
    if (!item || item.bought) return;

    const currentScraps = gameState.scraps || 0;
    if (currentScraps < item.price) return;

    const selectedSlime = gameState.slimes ? gameState.slimes.find(s => s.id === selectedShopSlimeId) : null;
    if (!selectedSlime) return;

    if (!selectedSlime.equipment) selectedSlime.equipment = [];

    // Deduct scraps cost
    gameState.scraps -= item.price;
    item.bought = true;

    // Apply item stat bonuses
    item.effectsList.forEach(eff => {
        const effectStat = eff.stat || 'hp';
        const effectValue = eff.value || 1;

        if (effectStat === 'hp') {
            selectedSlime.maxHp = Math.max(1, (selectedSlime.maxHp || 10) + effectValue);
            selectedSlime.hp = Math.max(1, Math.min(selectedSlime.hp !== undefined ? selectedSlime.hp : 10, selectedSlime.maxHp));
        } else if (effectStat === 'damage') {
            selectedSlime.damage = Math.max(1, (selectedSlime.damage || 1) + effectValue);
        } else if (effectStat === 'regen') {
            selectedSlime.regen = Math.max(0, (selectedSlime.regen || 0) + effectValue);
        } else if (effectStat === 'crit') {
            selectedSlime.critChance = Math.max(0, (selectedSlime.critChance || 0) + effectValue);
        }
    });

    // Add item to equipment list
    selectedSlime.equipment.push({
        id: item.enemyKey,
        name: item.name,
        sprite: item.sprite,
        effectText: item.effectText,
        effects: item.effectsList,
        lootValue: item.lootValue
    });

    updateBestRoster();
    saveStateToLocal();
    updateUI();

    renderShopUI();
}
