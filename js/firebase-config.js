/**
 * firebase-config.js
 * تهيئة Firebase v9+ باستخدام نمط Compatibility / Modular CDN
 * يدعم التخزين المحلي الاحتياطي والتبديل المرن للمفاتيح
 */

// إعدادات Firebase الافتراضية
// يمكن للمستخدم تحديث هذه الإعدادات مباشرة من نافذة "الإعدادات" في الموقع وحفظها في localStorage
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDummyKey_ReplaceWithYourActualFirebaseApiKey",
  authDomain: "business-manager-f.firebaseapp.com",
  projectId: "business-manager-f",
  storageBucket: "business-manager-f.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

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
let firestoreDb = null;
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
      firestoreDb = firebase.firestore();
      
      // إتاحة العمل مع التخزين المؤقت المحلي لـ Firestore عند توفر مشروع حقيقي
      const isConfigValid = config.apiKey && !config.apiKey.includes('DummyKey');
      if (isConfigValid && window.location.protocol.startsWith('http')) {
        try {
          firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
            // Silently catch persistence errors
          });
        } catch (persErr) {
          // ignore persistence errors
        }
      }

      if (firebase.storage) {
        firebaseStorage = firebase.storage();
      }
      isFirebaseInitialized = true;
      console.log('Firebase initialized successfully with project:', config.projectId);
    } else {
      console.warn('Firebase SDK not loaded yet.');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    isFirebaseInitialized = false;
  }
}

// تشغيل التهيئة
initFirebase();

window.FirebaseApp = {
  getApp: () => firebaseApp,
  getAuth: () => firebaseAuth,
  getDb: () => firestoreDb,
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
