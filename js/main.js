/**
 * Application Main Initializer
 */

import { loadStateFromLocal, addScraps, gameState, getFortificationLevel, getFortificationUpgradeCost, buyFortificationUpgrade, getSlimeRegen, getRegenMax, markAfkStart, claimAfkScraps, previewAfkScraps, updateBestRoster, calculateSlimeDamage, saveStateToLocal, getScaledEquipmentEffects, getEquipmentQuality, getEquipmentDisplayName, getEquipmentSprite, refreshSlimeMaxHp, ALCHEMIST_UPGRADES, getAlchemistUpgradeLevel, getAlchemistUpgradeCost, buyAlchemistUpgrade, getSlimeDeathSprite, getSlimeJumpSprite, getSlimeSpecialization } from './state.js';
import { initAuth, loginWithGoogle, logoutUser } from './auth.js';
import { startEngine, setGamePaused, isGamePaused } from './engine.js';
import { updateUI, setAuthScreenState, showFirebaseNotice, playSlimeRainRespawnAnimation, initSlimeModalListeners, initMainTabsListeners, openSlimeInspectorModal, renderSlimeRosterLanes } from './ui.js';
import { initEnemiesModule, startNextWave, setAutoPlay, resetGameFull, rewindWaveState, forwardWaveState, startNewGamePlusRun, formatLootEffects, ENEMY_TYPES } from './enemies.js';
import { triggerRandomSlimeAttack, triggerSlimeEatLoot, initAscendedAutoAttacks } from './slimes.js';
import { initUpgradesModule, sortMaxedUpgradeCardsOnPageLoad } from './upgrades.js';
import { initShopModule } from './shop.js';
import { openCommonHousePopup } from './commonhouse.js';

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
    const showAfkRewardPopup = (reward) => {
        if (!reward || reward.scraps <= 0 || document.getElementById('afkRewardPopup')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'afkRewardPopup';
        backdrop.className = 'afk-reward-backdrop';
        const popup = document.createElement('div');
        popup.className = 'afk-reward-popup';
        const title = document.createElement('h3');
        title.textContent = 'Welcome back !';
        const text = document.createElement('p');
        text.textContent = 'Slimes struggled without you, but they found some Scraps nonetheless.';
        const claim = document.createElement('button');
        claim.className = 'afk-reward-claim';
        claim.innerHTML = `<span aria-hidden="true">🍖</span> Claim ${reward.scraps} scraps`;
        claim.addEventListener('click', () => {
            const claimed = claimAfkScraps();
            if (claimed.scraps > 0) updateUI();
            backdrop.remove();
        });
        popup.append(title, text, claim);
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
    };

    const checkAfkReward = () => showAfkRewardPopup(previewAfkScraps());

    checkAfkReward();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) markAfkStart();
        else checkAfkReward();
    });
    window.addEventListener('pagehide', () => markAfkStart());
    const updateSelectionStateUI = () => {
        const valueEl = document.getElementById('upgradeSelectionValue');
        const selectionValue = gameState.unlockedUpgrades?.selection ? 'ON' : 'OFF';
        if (valueEl && valueEl.textContent !== selectionValue) valueEl.textContent = selectionValue;
    };

    const updateRegenCapUI = () => {
        const currentRegen = getSlimeRegen();
        const maxRegen = getRegenMax();
        if (currentRegen < maxRegen) return;

        const costEl = document.getElementById('upgradeRegenCost');
        const buttonEl = document.getElementById('btnUpgradeRegen');
        if (costEl && costEl.textContent !== 'MAX') costEl.textContent = 'MAX';
        if (buttonEl) {
            if (!buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
            if (!buttonEl.classList.contains('disabled')) buttonEl.classList.add('disabled');
            if (buttonEl.classList.contains('affordable')) buttonEl.classList.remove('affordable');
        }
    };
    const updateFortificationUI = () => {
        const cardEl = document.getElementById('upgradeFortificationCard');
        const valueEl = document.getElementById('upgradeFortificationValue');
        const costEl = document.getElementById('upgradeFortificationCost');
        const buttonEl = document.getElementById('btnUpgradeFortification');
        if (!cardEl || !valueEl || !costEl || !buttonEl) return;

        const isUnlocked = (gameState.maxWaveCleared || 0) >= 30 || (gameState.newGamePlusCompletions || 0) > 0;
        cardEl.classList.toggle('hidden', !isUnlocked);
        if (!isUnlocked) return;

        const level = getFortificationLevel();
        const cost = getFortificationUpgradeCost();
        const canAfford = (gameState.scraps || 0) >= cost;
        const valueText = `${10 + level}`;
        const scrapIcon = '<img class="upgrade-scrap-icon" src="images/logos/scrap.png" alt="Scraps">';
        const costText = `${cost} ${scrapIcon}`;
        if (valueEl.textContent !== valueText) valueEl.textContent = valueText;
        if (costEl.innerHTML !== costText) costEl.innerHTML = costText;
        cardEl.classList.toggle('level-zero', level === 0);
        buttonEl.classList.toggle('disabled', !canAfford);
        buttonEl.classList.toggle('affordable', canAfford);
        if (canAfford && buttonEl.hasAttribute('disabled')) buttonEl.removeAttribute('disabled');
        else if (!canAfford && !buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
    };

    const fortificationButtonEl = document.getElementById('btnUpgradeFortification');
    if (fortificationButtonEl) {
        fortificationButtonEl.addEventListener('click', () => {
            if (buyFortificationUpgrade()) updateUI();
        });
    }
    let isApplyingAscensionMax = false;
    const updateAscensionMaxState = () => {
        if (isApplyingAscensionMax) return;
        const currentAscendedCount = (gameState.slimes || []).filter(slime => slime.ascended === true).length;
        gameState.maxAscendedSlimesReached = Math.max(gameState.maxAscendedSlimesReached || 0, currentAscendedCount);
        const ascendedCountEl = document.getElementById('upgradeAscendedCount');
        if (ascendedCountEl && ascendedCountEl.textContent !== String(gameState.maxAscendedSlimesReached)) {
            ascendedCountEl.textContent = String(gameState.maxAscendedSlimesReached);
        }

        const rosterSlimes = (gameState.bestRoster && gameState.bestRoster.length > 0) ? gameState.bestRoster : (gameState.slimes || []);
        const allRosterSlimesAscended = rosterSlimes.length > 0 && rosterSlimes.every(slime => slime.ascended === true);
        if (!allRosterSlimesAscended) return;

        isApplyingAscensionMax = true;
        const costEl = document.getElementById('upgradeAscensionCost');
        const buttonEl = document.getElementById('btnUpgradeAscension');
        if (costEl && costEl.textContent !== 'MAX') costEl.textContent = 'MAX';
        if (buttonEl) {
            if (!buttonEl.hasAttribute('disabled')) buttonEl.setAttribute('disabled', 'disabled');
            if (!buttonEl.classList.contains('disabled')) buttonEl.classList.add('disabled');
            if (buttonEl.classList.contains('affordable')) buttonEl.classList.remove('affordable');
        }
        isApplyingAscensionMax = false;
    };

    const upgradesContainerEl = document.getElementById('upgradesContainer');
    if (upgradesContainerEl) {
        new MutationObserver(() => { updateFortificationUI(); updateSelectionStateUI(); updateRegenCapUI(); updateAscensionMaxState(); }).observe(upgradesContainerEl, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        updateFortificationUI();
        updateSelectionStateUI();
        updateRegenCapUI();
        updateAscensionMaxState();
        sortMaxedUpgradeCardsOnPageLoad();
    }

    document.addEventListener('click', (event) => {
        const ripSlot = event.target.closest('.roster-grid-item.empty-slot');
        const rosterSlot = event.target.closest('.roster-grid-item');
        if (!rosterSlot) return;
        if (!ripSlot) {
            const portraitEl = document.getElementById('slimeModalPortrait');
            if (portraitEl) {
                portraitEl.classList.remove('is-dead');
                portraitEl.style.animation = '';
            }
            return;
        }

        const slotMatch = ripSlot.id.match(/roster_item_empty_(\d+)/);
        const slotIndex = slotMatch ? Number(slotMatch[1]) : -1;
        const fallenSlime = (gameState.bestRoster || []).find(slime => (slime.slotIndex || 0) === slotIndex);
        if (!fallenSlime) return;

        openSlimeInspectorModal({ ...fallenSlime, hp: 0, isDead: true });
        const portraitEl = document.getElementById('slimeModalPortrait');
        if (portraitEl) {
            portraitEl.src = getSlimeDeathSprite(fallenSlime);
            portraitEl.style.objectPosition = '-19px 0px';
            portraitEl.classList.add('is-dead');
            portraitEl.style.animation = 'none';
        }
        const rerollEl = document.getElementById('slimeModalRerollType');
        const killEl = document.getElementById('slimeModalKill');
        if (rerollEl) rerollEl.style.display = 'none';
        if (killEl) killEl.style.display = 'none';
    });

    let hasStartedGameAnimation = false;

    function startGameWithSkyDrop() {
        if (hasStartedGameAnimation) return;
        hasStartedGameAnimation = true;

        updateUI();
        if (gameState.isInNewGamePlus) return;
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
    const btnForwardWave = document.getElementById('btnForwardWave');
    const btnFeedCheat = document.getElementById('btnFeedCheat');
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

    const closeVillageBuildingPopup = () => {
        document.getElementById('villageBuildingPopup')?.remove();
        document.body.classList.remove('modal-open');
    };
    const getVillageInventory = () => {
        if (!Array.isArray(gameState.villageInventory)) gameState.villageInventory = [];
        return gameState.villageInventory;
    };
    const getVillageItemKey = (item) => JSON.stringify([item.id, getEquipmentQuality(item)]);
    const getVillageMergeKey = (item) => String(item.id);
    const canMergeVillageInventory = (inventory) => {
        const counts = new Map();
        inventory.forEach(item => {
            const quality = getEquipmentQuality(item);
            if (quality >= 4) return;
            const key = `${getVillageMergeKey(item)}|${quality}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return [...counts.values()].some(count => count >= 5);
    };
    const mergeVillageInventory = (inventory) => {
        const families = new Map();
        inventory.forEach(item => {
            const key = getVillageMergeKey(item);
            if (!families.has(key)) families.set(key, [[], [], [], [], []]);
            families.get(key)[getEquipmentQuality(item)].push(item);
        });
        const merged = [];
        families.forEach(qualities => {
            for (let quality = 0; quality < 4; quality++) {
                while (qualities[quality].length >= 5) {
                    const source = qualities[quality].shift();
                    qualities[quality].splice(0, 4);
                    qualities[quality + 1].push({ id: source.id, quality: quality + 1 });
                }
            }
            qualities.forEach(items => merged.push(...items));
        });
        return merged;
    };
    const flashEquipmentRecipient = (slimeId) => {
        const targets = [
            document.getElementById(`roster_item_${slimeId}`),
            ...document.querySelectorAll(`[data-forge-slime-id="${slimeId}"]`)
        ].filter(Boolean);
        targets.forEach(target => {
            target.classList.remove('roster-equipment-flash');
            void target.offsetWidth;
            target.classList.add('roster-equipment-flash');
            setTimeout(() => target.classList.remove('roster-equipment-flash'), 260);
        });
    };
    const equipVillageItemToSlime = (slime, item) => {
        if (!slime || !item) return false;
        if (!slime.equipment) slime.equipment = [];
        if (slime.equipment.some(equipment => equipment.id === item.id)) return false;

        const equippedItem = { id: item.id, quality: getEquipmentQuality(item) };
        const effects = getScaledEquipmentEffects(equippedItem);
        effects.forEach(effect => {
            const value = Number(effect?.value ?? 1);
            if (effect?.stat === 'hp') {
                slime.baseMaxHp = Math.max(1, (slime.baseMaxHp ?? slime.maxHp ?? 10) + value);
                refreshSlimeMaxHp(slime);
            } else if (effect?.stat === 'regen') {
                slime.regen = Math.max(0, (slime.regen || 0) + value);
            } else if (effect?.stat === 'crit') {
                slime.critChance = Math.max(0, (slime.critChance || 0) + value);
            }
        });
        slime.equipment.push(equippedItem);
        slime.damage = calculateSlimeDamage(slime);
        return true;
    };
    const renderForgePopup = (popup) => {
        const rosterEl = popup.querySelector('.forge-roster-list');
        const inventoryEl = popup.querySelector('.forge-inventory-list');
        const inventory = getVillageInventory();
        const roster = gameState.slimes || [];
        const totalEquipped = roster.reduce((count, slime) => count + (slime.equipment || []).length, 0);
        if (!roster.length) {
            rosterEl.innerHTML = '<p class="forge-empty-text">No Slimes in the current roster.</p>';
        } else {
            renderSlimeRosterLanes(rosterEl, roster.map(slime => ({ slime })), {
                itemClassName: 'forge-roster-grid-item',
                dataAttrsFor: slime => ({ 'data-forge-slime-id': String(slime.id) }),
                titleFor: slime => {
                    const specialization = getSlimeSpecialization(slime);
                    const equipmentCount = (slime.equipment || []).length;
                    return `${slime.name}: ${slime.hp}/${slime.maxHp} HP${specialization ? `, ${specialization}` : ''}, ${equipmentCount} equipment`;
                },
                onItemClick: slime => openSlimeInspectorModal(slime)
            });
        }
        const groupedInventory = new Map();
        inventory.forEach(item => {
            const key = getVillageItemKey(item);
            const group = groupedInventory.get(key) || { item, count: 0 };
            group.count++;
            groupedInventory.set(key, group);
        });
        const groupedItems = [...groupedInventory.entries()]
            .map(([key, group]) => ({ key, ...group }))
            .sort((a, b) => String(a.item.name || a.item.id || '').localeCompare(String(b.item.name || b.item.id || '')));
        inventoryEl.innerHTML = groupedItems.length ? groupedItems.map(({ item, count }, groupIndex) => {
            const effectText = formatLootEffects(getScaledEquipmentEffects(item));
            const icon = getEquipmentSprite(item);
            const quality = getEquipmentQuality(item);
            const displayName = getEquipmentDisplayName(item);
            const lootPriority = item.loot_priority || ENEMY_TYPES[item.id]?.loot_priority || '';
            const specBtn = (spec, label) => `<button class="btn-forge-spec-priority ${lootPriority === spec ? 'selected' : ''}" data-forge-item-id="${item.id}" data-forge-priority="${spec}" title="Equip ${label}s in priority"><img src="images/logos/${spec}.png" alt="${label}"></button>`;
            const actions = `<div class="forge-item-actions forge-item-actions-spec">${specBtn('support', 'Support')}${specBtn('fighter', 'Fighter')}${specBtn('tank', 'Tank')}</div>`;
            return `<article class="forge-inventory-item"><img src="${icon}" alt="${displayName}"><div class="forge-item-details"><strong class="forge-item-quality-${quality}">${displayName}</strong><span>${effectText}</span></div><b class="forge-item-count">x${count}</b>${actions}</article>`;
        }).join('') : '<p class="forge-empty-text">No equipment is stored in the Village Inventory.</p>';
        inventoryEl.querySelectorAll('.btn-forge-spec-priority').forEach(button => {
            button.addEventListener('click', () => {
                const itemId = button.dataset.forgeItemId;
                const spec = button.dataset.forgePriority;
                getVillageInventory().forEach(invItem => {
                    if (invItem.id === itemId) invItem.loot_priority = spec;
                });
                saveStateToLocal();
                renderForgePopup(popup);
            });
        });
        const unequipButton = popup.querySelector('.btn-forge-unequip-all');
        unequipButton.textContent = `Unequip All (${totalEquipped})`;
        unequipButton.disabled = totalEquipped === 0;
        const autoEquipAllButton = popup.querySelector('.btn-forge-auto-equip-all');
        autoEquipAllButton.disabled = inventory.length === 0 || roster.length === 0;
        const mergeAllButton = popup.querySelector('.btn-forge-merge-all');
        mergeAllButton.disabled = !canMergeVillageInventory(inventory);
    };
    const renderAlchemistPopup = (popup) => {
        const coinsEl = popup.querySelector('.alchemist-coins strong');
        if (coinsEl) coinsEl.textContent = gameState.villageCoins || 0;
        const cardsEl = popup.querySelector('.alchemist-upgrades-list');
        cardsEl.innerHTML = Object.values(ALCHEMIST_UPGRADES).map(upgrade => {
            const level = getAlchemistUpgradeLevel(upgrade.key);
            const cost = getAlchemistUpgradeCost(upgrade.key);
            const affordable = (gameState.villageCoins || 0) >= cost;
            return `<article class="upgrade-card alchemist-upgrade-card ${level === 0 ? 'level-zero' : ''}"><div class="upgrade-info"><img src="images/upgrades/${upgrade.icon}" alt="${upgrade.name}" class="upgrade-icon-img"><div class="upgrade-details"><h4 class="upgrade-card-title">${upgrade.name} <span class="upgrade-current">(Current: <strong>${level}</strong>)</span></h4><span class="upgrade-text">${upgrade.description}</span></div></div><div class="upgrade-action"><button class="btn-plus btn-alchemist-upgrade pixel-btn ${affordable ? 'affordable' : 'disabled'}" data-alchemist-upgrade="${upgrade.key}" ${affordable ? '' : 'disabled'}>+</button><span class="upgrade-cost">${cost} <img src="images/logos/coin.png" alt="Village Coin" class="village-coin-icon"></span></div></article>`;
        }).join('');
        cardsEl.querySelectorAll('[data-alchemist-upgrade]').forEach(button => {
            button.addEventListener('click', () => {
                if (!buyAlchemistUpgrade(button.dataset.alchemistUpgrade)) return;
                updateUI();
                renderAlchemistPopup(popup);
            });
        });
    };
    const openAlchemistPopup = () => {
        if (!gameState.isInNewGamePlus || document.getElementById('villageBuildingPopup')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'villageBuildingPopup';
        backdrop.className = 'village-building-backdrop';
        const popup = document.createElement('div');
        popup.className = 'village-building-popup alchemist-building-popup pixel-popup';
        popup.innerHTML = `<button class="village-popup-close" aria-label="Close">&times;</button><h3 class="common-house-title"><img class="common-house-title-icon" src="images/logos/potion.png" alt="Alchemist"> Alchemist Shop</h3><p class="alchemist-coins">Village Coins: <strong>${gameState.villageCoins || 0}</strong> <img src="images/logos/coin.png" alt="Village Coin" class="village-coin-icon"></p><div class="alchemist-upgrades-list"></div>`;
        popup.querySelector('.village-popup-close').addEventListener('click', closeVillageBuildingPopup);
        backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeVillageBuildingPopup(); });
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        document.body.classList.add('modal-open');
        renderAlchemistPopup(popup);
    };
    const openForgePopup = () => {
        if (!gameState.isInNewGamePlus || document.getElementById('villageBuildingPopup')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'villageBuildingPopup';
        backdrop.className = 'village-building-backdrop';
        backdrop.style.zIndex = '9000';
        const popup = document.createElement('div');
        popup.className = 'village-building-popup forge-building-popup pixel-popup';
        popup.innerHTML = `<button class="village-popup-close" aria-label="Close">&times;</button><h3 class="common-house-title"><img class="common-house-title-icon" src="images/logos/anvil.png" alt="Forge"> Forge</h3><div class="forge-section-header forge-roster-header"><h4>Current Slime Roster</h4></div><section class="forge-roster-section"><div class="forge-roster-list slime-roster-list"></div></section><section class="forge-inventory-section"><div class="forge-section-header"><h4>Village Inventory</h4><div><button class="btn-forge-unequip-all pixel-btn">Unequip All</button><button class="btn-forge-merge-all pixel-btn" title="Merge five matching items into one higher-quality item">Merge All</button><button class="btn-forge-auto-equip-all pixel-btn" title="Equip every available item across the roster">Auto Equip All</button></div></div><div class="forge-inventory-list"></div></section>`;

        popup.querySelector('.village-popup-close').addEventListener('click', closeVillageBuildingPopup);
        popup.querySelector('.btn-forge-unequip-all').addEventListener('click', () => {
            const inventory = getVillageInventory();
            (gameState.slimes || []).forEach(slime => {
                (slime.equipment || []).forEach(item => inventory.push(JSON.parse(JSON.stringify(item))));
                slime.equipment = [];
                slime.baseMaxHp = 10 + (gameState.fortificationLevel || 0) + (gameState.alchemistEnduranceLevel || 0);
                slime.maxHp = slime.baseMaxHp;
                slime.hp = slime.maxHp;
                slime.regen = gameState.alchemistRegenLevel || 0;
                slime.critChance = (gameState.alchemistLuckLevel || 0) + (gameState.precisionLevel || 0);
                slime.damage = calculateSlimeDamage(slime);
            });
            updateBestRoster();
            saveStateToLocal();
            updateUI();
            renderForgePopup(popup);
        });
        popup.querySelector('.btn-forge-auto-equip-all').addEventListener('click', () => {
            const roster = gameState.slimes || [];
            const LOOT_PRIORITY_ORDER = {
                support: ['support', 'tank', 'fighter', 'basic'],
                tank: ['tank', 'support', 'fighter', 'basic'],
                fighter: ['fighter', 'tank', 'support', 'basic']
            };
            const defaultOrder = LOOT_PRIORITY_ORDER.tank;
            const matchesSpec = (slime, spec) => {
                const s = getSlimeSpecialization(slime);
                return spec === 'basic' ? s === '' : s === spec;
            };
            const findTarget = (item) => {
                const priority = String(item.loot_priority || ENEMY_TYPES[item.id]?.loot_priority || '').toLowerCase();
                const order = LOOT_PRIORITY_ORDER[priority] || defaultOrder;
                for (const spec of order) {
                    const target = roster.find(slime =>
                        matchesSpec(slime, spec) &&
                        !(slime.equipment || []).some(eq => eq.id === item.id)
                    );
                    if (target) return target;
                }
                return null;
            };
            const remainingInventory = [];
            const equippedSlimeIds = [];
            getVillageInventory().forEach(item => {
                const targetSlime = findTarget(item);
                if (!targetSlime || !equipVillageItemToSlime(targetSlime, item)) remainingInventory.push(item);
                else equippedSlimeIds.push(targetSlime.id);
            });
            gameState.villageInventory = remainingInventory;
            updateBestRoster();
            saveStateToLocal();
            updateUI();
            renderForgePopup(popup);
            equippedSlimeIds.forEach(flashEquipmentRecipient);
        });
        popup.querySelector('.btn-forge-merge-all').addEventListener('click', () => {
            gameState.villageInventory = mergeVillageInventory(getVillageInventory());
            saveStateToLocal();
            renderForgePopup(popup);
        });
        backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeVillageBuildingPopup(); });
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        document.body.classList.add('modal-open');
        renderForgePopup(popup);
    };
    const openVillageBuildingPopup = (buildingName) => {
        if (!gameState.isInNewGamePlus || document.getElementById('villageBuildingPopup')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'villageBuildingPopup';
        backdrop.className = 'village-building-backdrop';
        const popup = document.createElement('div');
        popup.className = 'village-building-popup';
        popup.innerHTML = `<button class="village-popup-close" aria-label="Close">&times;</button><h3>${buildingName}</h3><p>This building is not ready yet.</p>`;
        popup.querySelector('.village-popup-close').addEventListener('click', closeVillageBuildingPopup);
        backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeVillageBuildingPopup(); });
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        document.body.classList.add('modal-open');
    };
    document.querySelectorAll('[data-village-building]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.villageBuilding === 'Forge') openForgePopup();
            else if (button.dataset.villageBuilding === 'Alchemist Shop') openAlchemistPopup();
            else if (button.dataset.villageBuilding === 'Common House') openCommonHousePopup();
            else openVillageBuildingPopup(button.dataset.villageBuilding);
        });
    });
    // Eat Ground Loot Button Listener
    if (btnEat) {
        btnEat.addEventListener('click', () => {
            if (gameState.isInNewGamePlus) startNewGamePlusRun();
            else triggerSlimeEatLoot();
        });
    }

    if (btnFeedCheat) {
        btnFeedCheat.addEventListener('click', () => {
            addScraps(1000);
            updateUI();
        });
    }

    // Rewind Wave Button Listener: Restores previous wave snapshot
    if (btnRewindWave) {
        btnRewindWave.addEventListener('click', () => {
            rewindWaveState();
        });
    }

    // Forward Wave Button Listener: Test shortcut to jump to wave 51
    if (btnForwardWave) {
        btnForwardWave.addEventListener('click', () => {
            forwardWaveState();
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
            if (isGamePaused) return;
            triggerRandomSlimeAttack();
        });
    }

    // Manual Pause/Play Button Click Handler
    const btnPauseGame = document.getElementById('btnPauseGame');
    if (btnPauseGame) {
        btnPauseGame.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering battlefield click
            const isPausedNow = !isGamePaused;
            setGamePaused(isPausedNow, true); // Set manual pause!
            btnPauseGame.textContent = isPausedNow ? '▶️' : '⏸️';
            btnPauseGame.title = isPausedNow ? 'Resume' : 'Pause';
            btnPauseGame.classList.toggle('paused', isPausedNow);
            updateUI(); // Force Eat button state check!
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












