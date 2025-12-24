
// Use compat import to ensure broad compatibility with the CDN-based environment in Google AI Studio
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getFirestore } from 'firebase/firestore';
import 'firebase/compat/storage';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB8sVZCmZfdhrZsxVv9a6NpW9CQksKuHwA",
  authDomain: "cine-guard.firebaseapp.com",
  projectId: "cine-guard",
  storageBucket: "cine-guard.firebasestorage.app", // Endereço correto do bucket
  messagingSenderId: "26658934292",
  appId: "1:26658934292:web:9d33f06250ba49dc68e101"
};

// Initialize Firebase (check if already initialized to prevent errors in hot-reload environments)
const app = firebase.apps.length > 0 ? firebase.app() : firebase.initializeApp(firebaseConfig);

// Export modular instances using the initialized app
// We cast to unknown first to avoid direct type conflicts in strict environments
export const auth = app.auth();
export const db = getFirestore(app as unknown as any);
export const storage = app.storage();
