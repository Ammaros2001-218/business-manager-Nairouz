/**
 * firebase-config.js
 * تهيئة Firebase v9+ مع Firebase Realtime Database (RTDB)
 * يدعم التخزين المحلي الاحتياطي والتبديل المرن للمفاتيح
 */

// إعدادات Firebase الافتراضية
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC3jVc_b0ZTbk2YmPxdCxT9YrijdIBFYZE",
  authDomain: "business-manager-nairouz.firebaseapp.com",
  databaseURL: "https://business-manager-nairouz-default-rtdb.firebaseio.com",
  projectId: "business-manager-nairouz",
  storageBucket: "business-manager-nairouz.firebasestorage.app",
  messagingSenderId: "228073113161",
  appId: "1:228073113161:web:02b262ad05de11a1542198"
};
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
</script>

function getFirebaseConfig() {
  const saved = localStorage.getItem('bm_firebase_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored firebase config', e);
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

let firebaseApp = null;
let firebaseAuth = null;
let realtimeDb = null;
let firebaseStorage = null;
let isFirebaseInitialized = false;

function initFirebase() {
  const config = getFirebaseConfig();
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseAuth = firebase.auth();

      // تهيئة Realtime Database
      if (firebase.database) {
        realtimeDb = firebase.database();
      }

      if (firebase.storage) {
        firebaseStorage = firebase.storage();
      }
      isFirebaseInitialized = true;
      console.log('Firebase Realtime Database initialized successfully with project:', config.projectId);
    } else {
      console.warn('Firebase SDK not loaded yet.');
    }
  } catch (error) {
    console.error('Error initializing Firebase Realtime Database:', error);
    isFirebaseInitialized = false;
  }
}

// تشغيل التهيئة
initFirebase();

window.FirebaseApp = {
  getApp: () => firebaseApp,
  getAuth: () => firebaseAuth,
  getDb: () => realtimeDb,
  getStorage: () => firebaseStorage,
  isInitialized: () => isFirebaseInitialized,
  getConfig: getFirebaseConfig,
  saveConfig: (newConfig) => {
    localStorage.setItem('bm_firebase_config', JSON.stringify(newConfig));
    window.location.reload();
  },
  resetConfig: () => {
    localStorage.removeItem('bm_firebase_config');
    window.location.reload();
  }
};
