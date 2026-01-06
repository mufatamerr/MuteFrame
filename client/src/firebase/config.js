// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBK1vGEKbmwk7a6misAJN7TLxH1kcj-BM",
  authDomain: "yt-censor-988e9.firebaseapp.com",
  projectId: "yt-censor-988e9",
  storageBucket: "yt-censor-988e9.firebasestorage.app",
  messagingSenderId: "983869589294",
  appId: "1:983869589294:web:342dd0664e7a0221ae9cbf",
  measurementId: "G-GW26TCMHZH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;

