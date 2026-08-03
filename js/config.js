/**
 * Firebase & Application Configuration
 * 
 * To enable Cloud Saves & Google Authentication:
 * 1. Create a free project at https://console.firebase.google.com/
 * 2. Enable "Google" under Authentication > Sign-in method.
 * 3. Create a Firestore Database in production mode.
 * 4. Copy your web app's firebaseConfig values into the object below.
 * 
 * NOTE: If firebaseConfig fields are left as placeholders, the game will
 * seamlessly operate in "Local Storage Mode" so you can test immediately!
 */

export const firebaseConfig = {
    apiKey: "AIzaSyA1PK2CoCXDmGh6tKzCFo37YhuzMeZoclo",
    authDomain: "slime-lives-matter.firebaseapp.com",
    projectId: "slime-lives-matter",
    storageBucket: "slime-lives-matter.firebasestorage.app",
    messagingSenderId: "802646062137",
    appId: "1:802646062137:web:2cc7876bc09462692449e8",
    measurementId: "G-F67ERY2697"
};

// Check if valid Firebase credentials exist
export const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";
};
