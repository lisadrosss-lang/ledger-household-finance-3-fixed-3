import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase web config comes from env vars (see .env.example) rather than a
// committed JSON file, so real project values never land in version control.
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(firebaseApp);

// Setup Google Auth Provider with Google Calendar scopes
export const googleCalendarProvider = new GoogleAuthProvider();
googleCalendarProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleCalendarProvider.setCustomParameters({
  prompt: "consent",
  access_type: "offline",
});
