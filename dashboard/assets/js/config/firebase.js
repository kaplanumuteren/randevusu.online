import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "randevusu-5d7de.firebaseapp.com",
  projectId: "randevusu-5d7de",
  storageBucket: "randevusu-5d7de.appspot.com",
  messagingSenderId: "552102713631",
  appId: "1:552102713631:web:c6fcafd196a314dfd7782a",
  measurementId: "G-852Z6EKJ66"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ImgBB API Configuration
export const IMGBB_API_KEY = "54470a6e2e3b759b187ad674f4c2d8f2";
export const IMGBB_API_URL = "https://api.imgbb.com/1/upload";


// Tenant ID Management
export function getTenantId() {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) {
    console.error('Tenant ID bulunamadı. Lütfen giriş yapın.');
    // For public pages (index.html), return null instead of throwing
    if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
      return null;
    }
    throw new Error('Tenant ID bulunamadı');
  }
  return tenantId;
}



export function setTenantId(id) {
  localStorage.setItem('tenantId', id);
}

// Session Management (for dashboard)
export function setSession() {
  const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('sessionToken', sessionToken);
  localStorage.setItem('sessionTime', Date.now().toString());
  // Set cookie as well (expires in 24 hours)
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  document.cookie = `sessionToken=${sessionToken};expires=${expires.toUTCString()};path=/`;
}

export function getSession() {
  const sessionToken = localStorage.getItem('sessionToken');
  const sessionTime = localStorage.getItem('sessionTime');
  
  if (!sessionToken || !sessionTime) {
    return null;
  }
  
  // Check if session is expired (24 hours)
  const now = Date.now();
  const sessionAge = now - parseInt(sessionTime);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  if (sessionAge > maxAge) {
    clearSession();
    return null;
  }
  
  return sessionToken;
}

export function clearSession() {
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('sessionTime');
  localStorage.removeItem('tenantId');
  // Clear cookie
  document.cookie = 'sessionToken=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
}

export function isLoggedIn() {
  try {
    const tenantId = localStorage.getItem('tenantId');
    const session = getSession();
    const result = !!(tenantId && session);
    console.log('isLoggedIn check:', { tenantId: !!tenantId, session: !!session, result });
    return result;
  } catch (error) {
    console.error('isLoggedIn error:', error);
    return false;
  }
}

