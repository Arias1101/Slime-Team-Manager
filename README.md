# 🧪 Slime Lives Matter (SLM) - Idle Game

A lightweight, modern hosted Slime Idle Game built with HTML5, CSS3 (Glassmorphism & animations), JavaScript (ES Modules), and Firebase Google Auth & Cloud Persistence.

---

## 🌟 Key Features

1. **Idle Offline Progress Engine**: Automatically calculates earned Jelly and resources while the player is offline using high-precision cloud timestamp math.
2. **Google Authentication & Cloud Sync**: Seamless 1-click Google Sign-In using Firebase Auth and Firestore cloud persistence.
3. **Local Storage Fallback**: Works 100% out of the box locally without setup required.
4. **Squishy Animated UI**: Slime bounce animations, floating harvest numbers, upgrade tabs, and statistics dashboard.
5. **Zero Infrastructure Cost**: Built for up to 10+ simultaneous players completely on free tiers.

---

## 📁 Project Architecture & Folder Structure

```
SLM - Slime Lives Matter/
├── index.html                 # Main Game View & Layout
├── css/
│   └── styles.css             # Neon Slime Theme & UI Design System
├── js/
│   ├── main.js                # App Initializer & Bootstrapper
│   ├── config.js              # Firebase API Keys Configuration
│   ├── auth.js                # Google Authentication & Firestore Cloud Save
│   ├── state.js               # Game State Data & Offline Progress Math
│   ├── engine.js              # Core Game Tick Loop & Producer Economics
│   └── ui.js                  # DOM Renderer, Floating Effects & Modal Popup
├── images/
│   └── slimes/                # Slime Sprites (slime1.png through slime8.png)
└── README.md                  # Documentation & Setup Guide
```

---

## 🚀 Quick Start (Local Play)

1. Simply open `index.html` in any web browser!
2. Click the central Slime to harvest **Slime Jelly**.
3. Hire **Slime Helpers** (Baby Slime, Spicy Fire Slime, Ocean Blue Slime, Royal King Slime, etc.) to automate production.
4. Leave the browser tab or close the browser - return later to collect your **Offline Earnings**!

---

## 🔐 Setting Up Google Authentication & Cloud Sync (5 Minutes)

To enable **Sign in with Google** and sync progress across devices:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Give your project a name (e.g. `slime-lives-matter`) and click **Create**.
3. Under **Authentication** -> **Sign-in method**, click **Add new provider** -> select **Google** -> click **Enable** & Save.
4. Under **Firestore Database**, click **Create Database** (Start in **Test Mode** or **Production Mode** with read/write access to user documents).
5. In Project Settings, under **Your apps**, register a Web App (`</>`).
6. Copy the `firebaseConfig` object and paste it into [`js/config.js`](file:///c:/Users/Ludovic/Desktop/SLM%20-%20Slime%20Lives%20Matter/js/config.js):

```javascript
export const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "slime-lives-matter.firebaseapp.com",
    projectId: "slime-lives-matter",
    storageBucket: "slime-lives-matter.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef..."
};
```

---

## 🌐 Hosting Your Game (100% Free)

Since this is a lightweight frontend WebApp using cloud database logic, hosting options are free and instant:

### Option A: Firebase Hosting (Recommended)
Run in your terminal:
```bash
npx firebase-tools login
npx firebase-tools init hosting
npx firebase-tools deploy
```

### Option B: Vercel or Netlify
Simply drag and drop the folder into [Vercel](https://vercel.com) or [Netlify](https://netlify.com) for an instant live URL (e.g. `https://slime-lives-matter.vercel.app`).

### Option C: GitHub Pages
Push this directory to a GitHub repository and enable GitHub Pages in Repository Settings!
