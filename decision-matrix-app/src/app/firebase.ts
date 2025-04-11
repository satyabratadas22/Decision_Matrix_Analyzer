import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDxREoBIW1pa9Z5ZpP07TG5Qbzvr2-nurQ",
  authDomain: "decision-matrix-app-66c27.firebaseapp.com",
  projectId: "decision-matrix-app-66c27",
  storageBucket: "decision-matrix-app-66c27.firebasestorage.app",
  messagingSenderId: "989218596652",
  appId: "1:989218596652:web:542f17d1cfbb7d51e06e89",
  measurementId: "G-BB3CQLLZJ2"
};

const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null; // Safe SSR handling