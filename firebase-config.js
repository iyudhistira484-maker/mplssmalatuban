// ============================================================
// Firebase Configuration — SMAN 5 TUBAN Portal MPLS
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDh5iioG5-a_dO0VJF_3_wSWwBfYgaPY4U",
  authDomain: "mplsnew-fb91c.firebaseapp.com",
  projectId: "mplsnew-fb91c",
  storageBucket: "mplsnew-fb91c.firebasestorage.app",
  messagingSenderId: "865259068640",
  appId: "1:865259068640:web:abbdac421cbd2b56e10485"
};

// === Konfigurasi Sekolah ===
export const SCHOOL_CONFIG = {
  name: "SMA Negeri 5 Tuban",
  // Koordinat default SMA Negeri 5 Tuban (perkiraan, ganti sesuai lokasi pasti sekolah)
  lat: -6.9349898,
  lng: 112.0566788,
  attendanceRadiusMeter: 300,
  groups: ["Gugus 1", "Gugus 2", "Gugus 3", "Gugus 4", "Gugus 5"]
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
