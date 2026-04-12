import { initializeApp, getApps, getApp } from "firebase/app"

export const firebaseConfig = {
  apiKey: "AIzaSyDgFoIJl4kOc2HJ4dvJ2WSuGcc7M0Xeydk",
  authDomain: "booking-turath.firebaseapp.com",
  projectId: "booking-turath",
  storageBucket: "booking-turath.firebasestorage.app",
  messagingSenderId: "357011796124",
  appId: "1:357011796124:web:8069f20a7768e1b090bd59",
}

// منع تكرار التهيئة (مهم في Next.js)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)