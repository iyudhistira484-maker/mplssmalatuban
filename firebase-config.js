// Firebase Configuration — SMAN 5 TUBAN Portal MPLS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyB3NGx_z2KvhCMeoyPdIVpgsOxgmDF_Yrc",
  authDomain: "mplssmala-90d68.firebaseapp.com",
  projectId: "mplssmala-90d68",
  storageBucket: "mplssmala-90d68.firebasestorage.app",
  messagingSenderId: "11122419322",
  appId: "1:11122419322:web:0396b3525ca8752a2c7dc3",
  measurementId: "G-4W0E7ZNXK4"
};

// === Konfigurasi Sekolah ===
export const SCHOOL_CONFIG = {
  name: "SMA Negeri 5 Tuban",
  lat: -6.97693,
  lng: 112.0620804,
  attendanceRadiusMeter: 300,
  groups: ["Gugus 1", "Gugus 2", "Gugus 3", "Gugus 4", "Gugus 5", "Gugus 6", "Gugus 7"]
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
