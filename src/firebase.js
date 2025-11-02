import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBd7y1447dqwXQUjoBypLWa4BuORFeZ3s0",
  authDomain: "gestionale-tornei-2025.firebaseapp.com",
  projectId: "gestionale-tornei-2025",
  storageBucket: "gestionale-tornei-2025.firebasestorage.app",
  messagingSenderId: "138966224551",
  appId: "1:138966224551:web:1c5fc18d8aee6667d69582",
  measurementId: "G-4TMJJF6WQ9"
};
// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Firestore (database)
export const db = getFirestore(app);