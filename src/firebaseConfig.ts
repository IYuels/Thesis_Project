// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKn966BtnSVKNURsUXPbU4ev9kuez1Uf4",
  authDomain: "thesis-542d9.firebaseapp.com",
  projectId: "thesis-542d9",
  storageBucket: "thesis-542d9.firebasestorage.app",
  messagingSenderId: "494724540345",
  appId: "1:494724540345:web:97cd4b4351d622b80ef868"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
