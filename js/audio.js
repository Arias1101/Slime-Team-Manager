/**
 * Background music controller.
 *
 * Plays a looping track chosen at random from a pool. Two pools exist:
 *   - "main"    : used while a run is live on the battlefield
 *   - "village" : used during the New Game+ village intermission
 *
 * A single shared <audio> element is reused so switching mode cleanly stops the
 * previous track and starts the new one. All playback is best-effort: browsers
 * block autoplay before a user gesture, so a rejected play() promise is simply
 * swallowed (the track will start on the next mode switch after interaction).
 */

const MUSIC_BASE_PATH = 'images/sounds/musics/';

const MUSIC_POOLS = {
    main: ['main1.mp3', 'main2.mp3', 'main3.mp3'],
    village: ['village1.mp3', 'village2.mp3', 'village3.mp3']
};

let audioEl = null;
let currentMode = null;
let currentSrc = null;
let pendingMode = null;       // Mode requested while autoplay was blocked.
let gestureUnlockBound = false;
let musicMuted = false;       // Master mute for background music.
let musicPausedByGame = false; // Paused because the game itself is paused.

function ensureAudioElement() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.volume = 0.5;
    return audioEl;
}

/**
 * Browsers block audio until the first user gesture. If a play() was rejected,
 * remember the desired mode and resume it on the first click/keypress. Bound once.
 */
function bindGestureUnlock() {
    if (gestureUnlockBound) return;
    gestureUnlockBound = true;
    const resume = () => {
        if (pendingMode && audioEl && audioEl.paused) {
            const mode = pendingMode;
            pendingMode = null;
            // Re-issue as a fresh play so it isn't skipped by the same-mode no-op guard.
            internalPlay(mode, true);
        }
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
}

function pickRandomTrack(mode) {
    const pool = MUSIC_POOLS[mode] || MUSIC_POOLS.main;
    if (pool.length === 0) return null;
    // Avoid repeating the exact same track twice in a row when alternatives exist.
    let index = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && currentSrc) {
        const currentFile = currentSrc.split('/').pop();
        let guard = 0;
        while (pool[index] === currentFile && guard < 8) {
            index = Math.floor(Math.random() * pool.length);
            guard++;
        }
    }
    return pool[index];
}

/**
 * Internal playback: load + play the given mode. `force` bypasses the "same mode
 * already playing" no-op so a deferred (gesture-unlock) replay always restarts.
 */
function internalPlay(mode, force = false) {
    const pool = MUSIC_POOLS[mode];
    if (!pool || !pool.length) return;
    if (musicMuted) return;   // Music muted: don't start (or resume) any track.
    if (!force && currentMode === mode && audioEl && !audioEl.paused) return;

    const track = pickRandomTrack(mode);
    if (!track) return;
    const src = MUSIC_BASE_PATH + track;

    const el = ensureAudioElement();
    // If the chosen track is already loaded and we are just switching back to the
    // same source, keep playing rather than restarting from 0.
    if (el.src !== window.location.href + src && !el.src.endsWith(src)) {
        el.src = src;
        el.currentTime = 0;
    }
    currentMode = mode;
    currentSrc = src;

    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
            // Autoplay blocked: remember the intent and retry on first gesture.
            pendingMode = mode;
            bindGestureUnlock();
        });
    }
}

/**
 * Play a looping track for the given mode ("main" or "village"). If the same mode
 * is already playing, this is a no-op. Switching modes stops the current track
 * and starts a fresh random pick for the new mode.
 */
export function playMusic(mode) {
    internalPlay(mode, false);
}

/** Stop any currently playing track and clear the active mode. */
export function stopMusic() {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.currentTime = 0;
    currentMode = null;
    currentSrc = null;
}

export function playMainMusic() {
    playMusic('main');
}

export function playVillageMusic() {
    playMusic('village');
}

/**
 * Single source of truth for the <audio> element's play/pause state.
 * Music is silenced whenever it is muted OR the game is paused; otherwise the
 * current mode (or a deferred one) is (re)started.
 */
function applyAudioState() {
    if (!audioEl) return;
    const shouldPlay = !musicMuted && !musicPausedByGame && (currentMode || pendingMode);
    if (!shouldPlay) {
        audioEl.pause();
        return;
    }
    // Already playing the right thing: nothing to do.
    if (!audioEl.paused) return;
    // Resume the track already loaded in the element (preserves the paused song
    // rather than picking a brand-new random one). internalPlay() is only used for
    // genuine mode switches.
    const mode = pendingMode || currentMode;
    if (!audioEl.src || !audioEl.src.endsWith((currentSrc || '').split('/').pop() || '___')) {
        // Element has no track loaded yet (e.g. first unlock) -> pick one now.
        internalPlay(mode, true);
        pendingMode = null;
        return;
    }
    const resumePromise = audioEl.play();
    if (resumePromise && typeof resumePromise.catch === 'function') {
        resumePromise.catch(() => {
            pendingMode = pendingMode || currentMode;
            bindGestureUnlock();
        });
    }
    pendingMode = null;
}

/** Toggle the background music mute. Returns the new muted state. */
export function toggleMusicMute() {
    musicMuted = !musicMuted;
    applyAudioState();
    return musicMuted;
}

export function isMusicMuted() {
    return musicMuted;
}

/**
 * One-shot sound effects (e.g. enemy death). Each call creates a fresh <audio>
 * element so overlapping effects are not cut off, and the element is released
 * once finished. Playback is best-effort: a rejected play() is swallowed.
 */

const EFFECTS_BASE_PATH = 'images/sounds/effects/';

const EFFECT_FILES = {
    kill: ['kill1.mp3', 'kill2.mp3'],
    jump: ['jump1.mp3', 'jump2.mp3', 'jump3.mp3', 'jump4.mp3', 'jump5.mp3', 'jump6.mp3', 'jump7.mp3', 'jump8.mp3', 'jump9.mp3'],
    loot: ['loot1.mp3', 'loot2.mp3', 'loot3.mp3', 'loot4.mp3', 'loot5.mp3', 'loot6.mp3', 'loot7.mp3', 'loot8.mp3', 'loot9.mp3', 'loot10.mp3', 'loot11.mp3'],
    die: ['die1.mp3', 'die2.mp3', 'die3.mp3', 'die4.mp3', 'die5.mp3', 'die6.mp3', 'die7.mp3', 'die8.mp3', 'die9.mp3', 'die10.mp3', 'die11.mp3']
};

let effectsMuted = false; // Master mute for sound effects.

/** Play a randomly chosen file from the named effect pool (e.g. "kill"). */
export function playSoundEffect(name, volume = 0.5) {
    if (effectsMuted) return;
    const pool = EFFECT_FILES[name];
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random() * pool.length)];
    const el = new Audio(EFFECTS_BASE_PATH + file);
    el.volume = volume;
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
    }
    el.addEventListener('ended', () => { el.src = ''; });
}

/** Convenience wrapper: play a random "kill" sound effect (kill1 / kill2). */
export function playKillSound() {
    playSoundEffect('kill');
}

/** Convenience wrapper: play a random "jump" sound effect (jump1..jump6) at 10% volume. */
export function playJumpSound() {
    playSoundEffect('jump', 0.1);
}

/** Convenience wrapper: play a random "loot" sound effect (loot1..loot11) at 10% volume. */
export function playLootSound() {
    playSoundEffect('loot', 0.1);
}

/** Convenience wrapper: play a random "die" sound effect (die1..die11) at 10% volume. */
export function playDieSound() {
    playSoundEffect('die', 0.1);
}

/** Toggle the sound effects mute. Returns the new muted state. */
export function toggleEffectsMute() {
    effectsMuted = !effectsMuted;
    return effectsMuted;
}

export function isEffectsMuted() {
    return effectsMuted;
}

/** Pause/resume the background music in response to the game's pause state. */
export function setMusicPaused(paused) {
    musicPausedByGame = paused;
    applyAudioState();
}

