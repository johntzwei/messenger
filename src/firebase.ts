import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCSES83g4zWqbqkPYAd_MzaCHiVBalw_K0",
  authDomain: "messenger-5064b.firebaseapp.com",
  projectId: "messenger-5064b",
  storageBucket: "messenger-5064b.firebasestorage.app",
  messagingSenderId: "115388448794",
  appId: "1:115388448794:web:ac9180f8513034201c51a3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// FCM — lazy init since messaging isn't supported in all browsers
export const messagingPromise = isSupported().then((yes) =>
  yes ? getMessaging(app) : null,
);
