import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

/**
 * Firebase Web SDK (npm + Vite). Config comes from VITE_FIREBASE_* in .env.local — see .env.example.
 * Do not put secrets you need to hide from the client here; web API keys are public by design (restrict domains in Firebase Console).
 */
function env(name) {
  const v = import.meta.env[name];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
  measurementId: env('VITE_FIREBASE_MEASUREMENT_ID'),
};

const missing = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].filter(
  (k) => !firebaseConfig[k],
);
if (missing.length > 0) {
  console.warn(
    `[firebase] Missing VITE_FIREBASE_* env vars (${missing.join(', ')}). Copy frontend/.env.example to frontend/.env.local and add your Firebase web config.`,
  );
}

export const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

/** Resolved when Analytics is available (skipped if measurementId missing or not supported). */
export const analyticsPromise =
  app && firebaseConfig.measurementId
    ? isSupported().then((ok) => (ok ? getAnalytics(app) : null))
    : Promise.resolve(null);
