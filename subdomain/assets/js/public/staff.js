/**
 * Staff Management Module
 * Handles loading and displaying staff information
 */

import { db } from "../config/firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// State
let allStaff = [];

/**
 * Load staff from Firestore
 * @param {string} tenantId - Tenant ID
 */
export async function loadStaff(tenantId) {
  try {
    const staffSnap = await getDocs(collection(db, 'tenants', tenantId, 'staff'));
    allStaff = [];
    staffSnap.forEach(doc => {
      allStaff.push({ id: doc.id, ...doc.data() });
    });

    displayStaff();
  } catch (e) {
    console.error('Staff load error:', e);
  }
}

/**
 * Display staff in the main grid
 */
function displayStaff() {
  const gridEl = document.getElementById('staffGrid');
  if (!gridEl) return;

  if (allStaff.length === 0) {
    gridEl.innerHTML = '<div class="empty-state">Henüz personel eklenmemiş.</div>';
    return;
  }

  gridEl.innerHTML = '';
  allStaff.forEach(staff => {
    const initial = staff.name ? staff.name.charAt(0).toUpperCase() : '?';
    const card = document.createElement('div');
    card.className = 'staff-card';
    card.innerHTML = `
      <div class="staff-avatar">${initial}</div>
      <div class="staff-name">${staff.name}</div>
    `;
    gridEl.appendChild(card);
  });
}

/**
 * Get all staff
 * @returns {Array} Array of all staff
 */
export function getAllStaff() {
  return allStaff;
}

/**
 * Get staff by ID
 * @param {string} staffId - Staff ID
 * @returns {Object|null} Staff object or null
 */
export function getStaffById(staffId) {
  return allStaff.find(s => s.id === staffId) || null;
}

