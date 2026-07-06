// Authentication & Role Management
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function registerStudent({ name, email, password, nis, gugus }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'student',
    name, email, nis, gugus,
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export async function loginEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  return cred.user;
}

export async function logout() { await signOut(auth); }

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

// Route guard
export function guardRoute(requiredRole, redirect = 'login.html') {
  return new Promise((resolve) => {
    const unsub = onAuth(async (user) => {
      if (!user) { window.location.href = redirect; unsub(); return; }
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        await logout();
        window.location.href = redirect; unsub(); return;
      }
      if (requiredRole && profile.role !== requiredRole) {
        window.location.href = 'access-denied.html'
        unsub(); return;
      }
      if (profile.role === 'student' && !window.__skipAttendanceCheck) {
        const today = new Date().toISOString().slice(0,10);
        const attRef = doc(db, 'attendance', `${user.uid}_${today}`);
        const att = await getDoc(attRef);
        if (!att.exists()) {
          if (!location.pathname.endsWith('attendance.html')) {
            window.location.href = 'attendance.html'; unsub(); return;
          }
        } else {
          const st = att.data().status;
          if (st === 'hadir') {
            if (location.pathname.endsWith('attendance.html')) {
              window.location.href = 'student.html'; unsub(); return;
            }
          } else {
            if (location.pathname.endsWith('student.html')) {
              window.location.href = 'access-denied.html'; unsub(); return;
            }
          }
        }
      }
      resolve(profile);
      unsub();
    });
  });
}
