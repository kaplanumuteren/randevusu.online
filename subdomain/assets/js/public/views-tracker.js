/**
 * Views Tracker Module
 * Tracks page views for tenants
 */

import { db } from "../config/firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Track a page view for a tenant
 * @param {string} tenantId - Tenant ID
 */
export async function trackPageView(tenantId) {
  if (!tenantId) {
    console.warn('Cannot track view: tenantId is missing');
    return;
  }

  try {
    const now = new Date();
    const dateKey = formatDateKey(now);
    
    // Update total views
    const statsRef = doc(db, 'tenants', tenantId, 'stats', 'views');
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      await updateDoc(statsRef, {
        total: increment(1),
        lastView: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } else {
      await setDoc(statsRef, {
        total: 1,
        lastView: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }

    // Track daily views
    const dailyRef = doc(db, 'tenants', tenantId, 'stats', 'views', 'daily', dateKey);
    const dailyDoc = await getDoc(dailyRef);
    
    if (dailyDoc.exists()) {
      await updateDoc(dailyRef, {
        count: increment(1),
        updatedAt: Timestamp.now()
      });
    } else {
      await setDoc(dailyRef, {
        count: 1,
        date: dateKey,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }

    console.log(`Page view tracked for tenant: ${tenantId}`);
  } catch (error) {
    console.error('Error tracking page view:', error);
    // Don't throw error - tracking should not break the page
  }
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

