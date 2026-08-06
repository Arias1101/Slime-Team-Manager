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
            saveData: getCloudSaveData(),
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
                Object.assign(gameState, data.saveData);
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
