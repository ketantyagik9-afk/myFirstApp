import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";


// 🔴 IMPORTANT: Replace with YOUR Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAzxE2gMOkUKkCzNfmX3zbyfRl2kmxrofA",
  authDomain: "dating-app-test-56352.firebaseapp.com",
  projectId: "dating-app-test-56352",
  storageBucket: "dating-app-test-56352.firebasestorage.app",
  messagingSenderId: "415363874451",
  appId: "1:415363874451:web:2d3f5ebadc6d4bc0ec5766"
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (_e) {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
