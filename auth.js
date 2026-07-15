// Authentication & Role Management
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, authStateReady
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function registerStudent({ name, email, password, nis, gugus }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      role: 'student',
      name, email, nis, gugus,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    await cred.user.delete().catch(() => {});
    throw err;
  }
  return cred.user;
}

export async function loginEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  return cred.user;
}

export async function logout() { await signOut(auth); }

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch {
    return null;
  }
}

export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

// Route guard
export async function guardRoute(requiredRole, redirect = 'login.html') {
  try { await authStateReady(auth); } catch (_) {}
  const user = auth.currentUser;
  if (!user) { window.location.href = redirect; return null; }
  const profile = await getUserProfile(user.uid);
  if (!profile) {
    await logout();
    window.location.href = redirect; return null;
  }
  if (requiredRole && profile.role !== requiredRole) {
    window.location.href = 'access-denied.html'
    return null;
  }
  if (profile.role === 'student' && !window.__skipAttendanceCheck) {
    try {
      const today = new Date().toISOString().slice(0,10);
      const attRef = doc(db, 'attendance', `${user.uid}_${today}`);
      const att = await getDoc(attRef);
      if (!att.exists()) {
        if (!location.pathname.endsWith('attendance.html')) {
          window.location.href = 'attendance.html'; return null;
        }
      } else {
        const st = att.data().status;
        if (st === 'hadir') {
          if (location.pathname.endsWith('attendance.html')) {
            window.location.href = 'student.html'; return null;
          }
        } else {
          if (location.pathname.endsWith('student.html')) {
            window.location.href = 'access-denied.html'; return null;
          }
        }
      }
    } catch (_) {
      console.warn('[guardRoute] attendance check failed, proceeding', _);
    }
  }
  return profile;
}
