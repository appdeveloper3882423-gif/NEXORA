
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFXYYPpSruHpV52vNJaiJTNDrBZYZOOhs",
  authDomain: "nexora-ac0e4.firebaseapp.com",
  projectId: "nexora-ac0e4",
  storageBucket: "nexora-ac0e4.firebasestorage.app",
  messagingSenderId: "546360209593",
  appId: "1:546360209593:web:e038ded0191c2245c62b68"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

