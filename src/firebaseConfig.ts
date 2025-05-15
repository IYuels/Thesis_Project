// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA8_jFlMTLX1SBht44aVf3W2QvmLCKmuXQ",
  authDomain: "thesis-388fc.firebaseapp.com",
  projectId: "thesis-388fc",
  storageBucket: "thesis-388fc.firebasestorage.app",
  messagingSenderId: "727034371386",
  appId: "1:727034371386:web:5a83aadb04b78e28ef4403",
  measurementId: "G-CX885Q0086"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
