import { gameState } from './state.js';
import { ACHIEVEMENTS, isAchievementUnlocked } from './achievements.js';

let popupEl = null;

function closeAchievementsPopup() {
    const backdrop = document.getElementById('achievementsPopupBackdrop');
    if (backdrop) backdrop.remove();
    document.body.classList.remove('modal-open');
    popupEl = null;
}

/**
 * Open the Tavern popup listing every unlocked achievement (locked ones are
 * shown dimmed). Reuses the shared village popup CSS classes.
 */
export function openAchievementsPopup() {
    closeAchievementsPopup();

    const backdrop = document.createElement('div');
    backdrop.id = 'achievementsPopupBackdrop';
    backdrop.className = 'village-building-backdrop';

    const unlockedCount = ACHIEVEMENTS.filter(a => isAchievementUnlocked(a.id)).length;

    const popup = document.createElement('div');
    popup.className = 'village-building-popup pixel-popup achievements-popup';
    popup.innerHTML = `
        <button class="village-popup-close" aria-label="Close">&times;</button>
        <h3 class="common-house-title"><img class="common-house-title-icon" src="images/logos/achievement.png" alt="Tavern" onerror="this.onerror=null; this.src='images/achievements/runYouFools.png';"> Tavern — Achievements</h3>
        <p class="achievements-popup-count">${unlockedCount} / ${ACHIEVEMENTS.length} unlocked</p>
        <div class="achievements-list achievements-popup-list shop-scrollbar">
            ${ACHIEVEMENTS.map(def => {
                const unlocked = isAchievementUnlocked(def.id);
                return `
                    <div class="achievement-card${unlocked ? ' unlocked' : ' locked'}">
                        <img class="achievement-icon" src="${def.icon}" alt="">
                        <div class="achievement-body">
                            <span class="achievement-title">${def.title}</span>
                            <span class="achievement-desc">${def.desc}</span>
                        </div>
                        <span class="achievement-reward">+${def.reward}<img src="images/logos/coin.png" alt="" class="achievement-coin"></span>
                    </div>`;
            }).join('')}
        </div>`;

    popup.querySelector('.village-popup-close').addEventListener('click', closeAchievementsPopup);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeAchievementsPopup(); });
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    popupEl = popup;
}
