/**
 * Shop Module - Mid-Game Merchant Market (Appears every 10 waves)
 */

import { gameState, saveStateToLocal, updateBestRoster, addScraps, calculateSlimeDamage, getScaledEquipmentEffects, getEquipmentDisplayName, getEquipmentSprite, getEquipmentSellMultiplier, getEquipmentQuality, refreshSlimeMaxHp, getSlimeJumpSprite } from './state.js';
import { ENEMY_TYPES, calculateLootValue, formatLootEffects } from './enemies.js';
import { SLIME_TYPES } from './state.js';
import { updateUI, renderSlimeRosterLanes } from './ui.js';
import { startNextWave } from './enemies.js';
import { setGamePaused } from './engine.js';

let selectedShopSlimeId = null;
let shopInventory = []; // Array of 5 items: [{ id, enemyKey, name, sprite, effectText, effectsList, price, lootValue, bought }]
let nextWaveNumber = 11;
let shopHighlightItem = null; // Shop item whose eligibility is currently highlighted on the roster

/** Roll the quality for a merchant item: normal through legendary (+4). */
function rollShopEquipmentQuality() {
    const roll = Math.random();
    if (roll < 0.50) return 0;
    if (roll < 0.75) return 1;
    if (roll < 0.90) return 2;
    if (roll < 0.98) return 3;
    return 4;
}

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
    const closeBtn = document.querySelector('#shopModal .village-popup-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeShopModal();
        });
    }
}

/**
 * Generate 5 random shop items selected from ENEMY_TYPES
 */
function generateShopStock() {
    const enemyKeys = Object.keys(ENEMY_TYPES).filter(k => k !== 'test' && ENEMY_TYPES[k].tier !== -1);
    if (enemyKeys.length === 0) return;

    shopInventory = [];

    // Pick 5 random unique enemy types
    const shuffled = [...enemyKeys].sort(() => 0.5 - Math.random());
    const selectedKeys = shuffled.slice(0, 5);

    selectedKeys.forEach((key, index) => {
        const def = ENEMY_TYPES[key];
        const lootVal = calculateLootValue(def.loot_effect);
        const quality = rollShopEquipmentQuality();
        const buyPrice = lootVal * 2 * Math.pow(5, quality);

        const rawLootEffect = def.loot_effect || { stat: 'hp', value: 1 };
        const effectsList = Array.isArray(rawLootEffect)
            ? rawLootEffect
            : (rawLootEffect.effects ? rawLootEffect.effects : [rawLootEffect]);
        const equipment = { name: def.loot_name || key, effects: effectsList, quality };
        const effectText = formatLootEffects(getScaledEquipmentEffects(equipment));

        shopInventory.push({
            shopItemId: `shop_item_${Date.now()}_${index}`,
            enemyKey: key,
            name: def.loot_name || key,
            sprite: `images/loots/${key}.png`,
            effectText: effectText,
            effectsList: effectsList,
            price: buyPrice,
            lootValue: lootVal,
            quality,
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
    shopHighlightItem = null;

    const backdropEl = document.getElementById('shopModalBackdrop');
    const continueBtnEl = document.getElementById('btnLeaveShop');
    if (continueBtnEl) {
        continueBtnEl.textContent = `Continue to Wave ${nextWaveNumber} ⚔️`;
    }

    if (backdropEl) {
        backdropEl.classList.remove('hidden');
        document.body.classList.add('modal-open');
        setGamePaused(true);
    }

    renderShopUI();
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

    if (!gameState.slimes || gameState.slimes.length === 0) {
        container.innerHTML = '<p class="shop-empty-text">No slimes in army.</p>';
        return;
    }

    renderSlimeRosterLanes(container, gameState.slimes.map(slime => ({ slime })), {
        itemClassName: 'shop-roster-grid-item',
        extraClassFor: slime => {
            const classes = [];
            if (slime.id === selectedShopSlimeId) classes.push('selected');
            if (shopHighlightItem && !shopHighlightItem.bought) {
                const ownedItem = (slime.equipment || []).find(eq => eq.id === shopHighlightItem.enemyKey);
                const canEquip = !ownedItem || (ownedItem.quality || 0) < (shopHighlightItem.quality || 0);
                classes.push(canEquip ? 'can-equip' : 'cannot-equip');
            }
            return classes.join(' ');
        },
        onItemClick: slime => {
            selectedShopSlimeId = slime.id;
            renderShopUI();
        }
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
            <div class="shop-slime-portrait-box">
                <img src="${getSlimeJumpSprite(selectedSlime)}" class="shop-slime-portrait" alt="${selectedSlime.name}">
            </div>
            <div class="shop-slime-info-text">
                <div class="shop-slime-info-name">
                    ${selectedSlime.name}
                    ${isAscended ? '<span class="ascended-badge">✨ Ascended</span>' : ''}
                </div>
                <div class="shop-slime-info-stats">
                    <span title="Health Points (HP) - Slime dies if this hits 0.">❤️ ${selectedSlime.hp}/${selectedSlime.maxHp} HP</span> | 
                    <span title="Damage - Base power dealt to enemies during collisions.">⚔️ ${selectedSlime.damage} Dmg</span> | 
                    <span title="Critical Chance - Probability to deal double damage on hits.">⚡ ${selectedSlime.critChance || 0}% Crit</span>
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
            const lootVal = calculateLootValue(enemyDef?.loot_effect);
            const sellPrice = Math.max(1, Math.floor(lootVal * getEquipmentSellMultiplier(eq) * 0.5));
            const displayName = getEquipmentDisplayName(eq);

            html += `
                <div class="shop-equipment-row equipment-item-card">
                    <div class="shop-eq-left">
                        <img src="${getEquipmentSprite(eq)}" class="shop-eq-icon equipment-icon-img" alt="${displayName}">
                        <div class="shop-eq-details equipment-item-info">
                            <span class="shop-eq-name equipment-item-name equipment-quality-${getEquipmentQuality(eq)}">${displayName}</span>
                            <span class="shop-eq-effect equipment-item-effect">${formatLootEffects(getScaledEquipmentEffects(eq))}</span>
                        </div>
                    </div>
                    <button class="btn-sell-equipment pixel-btn" data-eq-index="${index}">
                        <img class="shop-scrap-icon" src="images/logos/scrap.png" alt="Scraps"> Sell for ${sellPrice}
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
    const lootVal = calculateLootValue(enemyDef?.loot_effect);
    const sellPrice = Math.max(1, Math.floor(lootVal * getEquipmentSellMultiplier(itemToSell) * 0.5));

    // Remove item from slime equipment array
    slime.equipment.splice(eqIndex, 1);

    // Revert stat bonuses granted by item
    const effectsList = getScaledEquipmentEffects(itemToSell);
    effectsList.forEach(eff => {
        const effectStat = eff.stat || 'hp';
        const effectValue = eff.value || 1;

        if (effectStat === 'hp') {
            slime.baseMaxHp = Math.max(1, (slime.baseMaxHp ?? slime.maxHp ?? 10) - effectValue);
            refreshSlimeMaxHp(slime);
        } else if (effectStat === 'damage') {
            // Damage is derived from Augmentation and current equipment below.
        } else if (effectStat === 'regen') {
            slime.regen = Math.max(0, (slime.regen || 0) - effectValue);
        } else if (effectStat === 'crit') {
            slime.critChance = Math.max(0, (slime.critChance || 0) - effectValue);
        }
    });

    slime.damage = calculateSlimeDamage(slime);

    // Add scraps refund
    addScraps(sellPrice);
    updateBestRoster();
    saveStateToLocal();
    updateUI();

    renderShopUI();
}

/**
 * Render Right Column Section 3: Merchant Market (5 Items)
 */
function renderShopMarketItems() {
    const container = document.getElementById('shopMarketList');
    if (!container) return;

    container.innerHTML = '';

    shopInventory.forEach(item => {
        const selectedSlime = gameState.slimes ? gameState.slimes.find(s => s.id === selectedShopSlimeId) : null;
        const ownedItem = selectedSlime && selectedSlime.equipment
            ? selectedSlime.equipment.find(eq => eq.id === item.enemyKey)
            : null;
        const replacesLowerQuality = ownedItem && (item.quality || 0) > (ownedItem.quality || 0);
        const alreadyHasEqualOrBetterItem = ownedItem && !replacesLowerQuality;

        const canAfford = (gameState.scraps || 0) >= item.price;
        const displayName = getEquipmentDisplayName(item);

        const card = document.createElement('div');
        const isSelected = shopHighlightItem && !item.bought && shopHighlightItem.enemyKey === item.enemyKey;
        card.className = `shop-market-card shop-quality-${item.quality || 0} ${item.bought ? 'bought' : ''}${isSelected ? ' selected' : ''}`;

        card.innerHTML = `
            <div class="shop-market-card-left">
                <img src="${item.sprite}" class="shop-market-item-icon" alt="${displayName}">
                <div class="shop-market-item-info">
                    <div class="shop-market-item-name">${displayName}</div>
                    <div class="shop-market-item-effect">${item.effectText}</div>
                </div>
            </div>
            <div class="shop-market-card-right">
                ${item.bought ? `
                    <span class="badge-bought">✓ SOLD OUT</span>
                ` : `
                    <button class="btn-buy-shop-item pixel-btn" ${(!canAfford || alreadyHasEqualOrBetterItem) ? 'disabled' : ''}>
                        <img class="shop-scrap-icon" src="images/logos/scrap.png" alt="Scraps"> Buy for ${item.price}
                    </button>
                    ${alreadyHasEqualOrBetterItem ? '<span class="shop-owned-text">Already Owned</span>' : (replacesLowerQuality ? `<span class="shop-owned-text">Replaces ${getEquipmentDisplayName(ownedItem)}</span>` : '')}
                `}
            </div>
        `;

        if (!item.bought) {
            const buyBtn = card.querySelector('.btn-buy-shop-item');
            if (buyBtn && canAfford && !alreadyHasEqualOrBetterItem) {
                buyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    buyShopItem(item);
                });
            }
        }

        card.addEventListener('click', () => {
            shopHighlightItem = (shopHighlightItem && shopHighlightItem.enemyKey === item.enemyKey) ? null : item;
            renderShopUI();
        });

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

    // A better shop item replaces the same equipment; equal or lower quality cannot be bought.
    const existingIndex = selectedSlime.equipment.findIndex(eq => eq.id === item.enemyKey);
    const existingItem = existingIndex >= 0 ? selectedSlime.equipment[existingIndex] : null;
    if (existingItem && (item.quality || 0) <= (existingItem.quality || 0)) return;

    if (existingItem) {
        getScaledEquipmentEffects(existingItem).forEach(eff => {
            const effectStat = eff.stat || 'hp';
            const effectValue = eff.value || 1;
            if (effectStat === 'hp') {
                selectedSlime.baseMaxHp = Math.max(1, (selectedSlime.baseMaxHp ?? selectedSlime.maxHp ?? 10) - effectValue);
                refreshSlimeMaxHp(selectedSlime);
            } else if (effectStat === 'regen') {
                selectedSlime.regen = Math.max(0, (selectedSlime.regen || 0) - effectValue);
            } else if (effectStat === 'crit') {
                selectedSlime.critChance = Math.max(0, (selectedSlime.critChance || 0) - effectValue);
            }
        });
        selectedSlime.equipment.splice(existingIndex, 1);
    }

    // Deduct scraps cost
    gameState.scraps -= item.price;
    item.bought = true;

    // Apply item stat bonuses
    const scaledEffects = getScaledEquipmentEffects({ id: item.enemyKey, quality: item.quality || 0 });
    scaledEffects.forEach(eff => {
        const effectStat = eff.stat || 'hp';
        const effectValue = eff.value || 1;

        if (effectStat === 'hp') {
            selectedSlime.baseMaxHp = Math.max(1, (selectedSlime.baseMaxHp ?? selectedSlime.maxHp ?? 10) + effectValue);
            refreshSlimeMaxHp(selectedSlime);
        } else if (effectStat === 'damage') {
            // Damage is derived after the item is added below.
        } else if (effectStat === 'regen') {
            selectedSlime.regen = Math.max(0, (selectedSlime.regen || 0) + effectValue);
        } else if (effectStat === 'crit') {
            selectedSlime.critChance = Math.max(0, (selectedSlime.critChance || 0) + effectValue);
        }
    });

    // Add item to equipment list
    selectedSlime.equipment.push({
        id: item.enemyKey,
        quality: item.quality || 0
    });

    selectedSlime.damage = calculateSlimeDamage(selectedSlime);
    updateBestRoster();
    saveStateToLocal();
    updateUI();

    shopHighlightItem = null;
    renderShopUI();
}
