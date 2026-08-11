/**
 * Google Authentication Module (Firebase Auth & Firestore Cloud Sync)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './config.js';
import { gameState, defaultState, saveStateToLocal, syncSlimesArray, migrateSpecializedSlimes } from './state.js';

let auth = null;
let db = null;
let currentUser = null;

/** Remove runtime-only DOM references before sending game state to Firestore. */
function getCloudSaveData() {
    return JSON.parse(JSON.stringify(gameState, (key, value) => {
        if (key === 'el' || key === 'statusRowEl') return undefined;
        return value;
    }));
}

// Firestore enforces a 1 MiB (1,048,576 bytes) hard limit per document. If the
// serialized save ever exceeds that, the whole cloud write fails and the user
// silently loses cloud sync. We therefore trim heavy, non-essential data
// (per-wave roster snapshots, which are never restored) before uploading.
const CLOUD_SAVE_LIMIT = 1_048_576;
const CLOUD_SAFE_TARGET = 950_000;

/**
 * Build a Firestore-serializable copy of the save, shrinking it to fit under
 * the Firestore document limit. The local save always keeps the full state.
 */
function buildCloudSaveData() {
    let data = getCloudSaveData();

    const size = (obj) => new TextEncoder().encode(JSON.stringify(obj)).length;

    if (size(data) <= CLOUD_SAVE_LIMIT) return data;

    // 1. Drop per-wave snapshots first (unused for restore, biggest bloat).
    if (data.waveSnapshots && typeof data.waveSnapshots === 'object') {
        const snapshots = data.waveSnapshots;
        const pruned = { ...data, waveSnapshots: {} };
        // Keep only the most recent snapshots until the payload fits.
        const keys = Object.keys(snapshots).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
        while (keys.length && size(pruned) > CLOUD_SAFE_TARGET) {
            keys.shift(); // drop the oldest
            pruned.waveSnapshots = Object.fromEntries(keys.map(k => [k, snapshots[k]]));
        }
        data = pruned;
    }

    // 2. Last resort: drop snapshots entirely and trim dead slime history.
    if (size(data) > CLOUD_SAVE_LIMIT) {
        delete data.waveSnapshots;
    }

    return data;
}

export function initAuth(onUserStatusChanged, onFirebaseMissing) {
    if (!isFirebaseConfigured()) {
        console.warn('Firebase is not configured in js/config.js');
        if (onFirebaseMissing) onFirebaseMissing();
        onUserStatusChanged(false, null);
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                //console.log('User signed in:', user.displayName, user.uid);
                await loadCloudSave(user.uid);
                onUserStatusChanged(true, user);
            } else {
                //console.log('User signed out.');
                onUserStatusChanged(false, null);
            }
        });
    } catch (err) {
        console.error('Firebase Auth initialization error:', err);
        if (onFirebaseMissing) onFirebaseMissing();
        onUserStatusChanged(false, null);
    }
}

export async function loginWithGoogle() {
    if (!auth) {
        return false;
    }

    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        return true;
    } catch (err) {
        console.error('Google Sign-in failed:', err);
        alert('Google Sign-in failed: ' + err.message);
        return false;
    }
}

export async function logoutUser() {
    if (auth) {
        await signOut(auth);
    }
}

/**
 * Save player's specific army progress to Firestore under their UID
 */
export async function saveCloudSave() {
    saveStateToLocal(); // Always write local fallback

    if (!db || !currentUser) return;

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
            saveData: buildCloudSaveData(),
            lastUpdated: new Date()
        }, { merge: true });
        console.log('Cloud save successful for user:', currentUser.uid);
    } catch (err) {
        console.error('Cloud save failed:', err);
    }
}

/**
 * Load player's specific army progress from Firestore under their UID
 */
async function loadCloudSave(uid) {
    if (!db) return;
    try {
        const userRef = doc(db, 'users', uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.saveData) {
                // Prefer the most recently saved copy. A local claim/action can
                // happen before the async cloud load resolves, so never clobber a
                // newer local save with an older cloud snapshot.
                const cloudTime = Number(data.saveData.lastSavedTimestamp) || 0;
                const localTime = Number(gameState.lastSavedTimestamp) || 0;
                if (cloudTime > localTime) {
                    Object.assign(gameState, data.saveData);
                }
                console.log('Loaded cloud save data for user', uid, gameState);
            }
        } else {
            // New user initial save creation
            await saveCloudSave();
        }
        syncSlimesArray();
    } catch (err) {
        console.error('Error fetching cloud save for user:', err);
        syncSlimesArray();
    }
}
