/**
 * Services and Categories Management Module
 * Handles loading and displaying services and categories
 */

import { db } from "../config/firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// State
let allServices = [];
let allCategories = [];
let selectedCategory = '';

/**
 * Load categories from Firestore
 * @param {string} tenantId - Tenant ID
 * @param {Function} onCategoryChange - Callback when category changes
 */
export async function loadCategories(tenantId, onCategoryChange) {
  try {
    const categoriesSnap = await getDocs(collection(db, 'tenants', tenantId, 'categories'));
    allCategories = [];
    categoriesSnap.forEach(doc => {
      allCategories.push({ id: doc.id, ...doc.data() });
    });

    const filtersEl = document.getElementById('serviceFilters');
    filtersEl.innerHTML = '<button class="filter-btn active" data-category="" id="allServicesBtn">Tüm</button>';
    
    // Add click handler for "Tümü" button
    const allBtn = document.getElementById('allServicesBtn');
    if (allBtn) {
      allBtn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        selectedCategory = '';
        if (onCategoryChange) onCategoryChange();
      });
    }
    
    allCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = cat.name;
      btn.dataset.category = cat.id;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = cat.id;
        if (onCategoryChange) onCategoryChange();
      });
      filtersEl.appendChild(btn);
    });
  } catch (e) {
    console.error('Categories load error:', e);
  }
}

/**
 * Load services from Firestore
 * @param {string} tenantId - Tenant ID
 * @param {Function} onServiceSelect - Callback when service is selected
 */
export async function loadServices(tenantId, onServiceSelect) {
  try {
    const servicesSnap = await getDocs(collection(db, 'tenants', tenantId, 'services'));
    allServices = [];
    servicesSnap.forEach(doc => {
      allServices.push({ id: doc.id, ...doc.data() });
    });
    displayServices(onServiceSelect);
    displayModalServices(onServiceSelect);
  } catch (e) {
    console.error('Services load error:', e);
    document.getElementById('servicesGrid').innerHTML = '<div class="empty-state">Hizmetler yüklenirken bir hata oluştu.</div>';
  }
}

/**
 * Display services in main grid
 * @param {Function} onServiceSelect - Callback when service is selected
 */
function displayServices(onServiceSelect) {
  const filtered = selectedCategory 
    ? allServices.filter(s => s.categoryId === selectedCategory)
    : allServices;

  const gridEl = document.getElementById('servicesGrid');
  if (filtered.length === 0) {
    gridEl.innerHTML = '<div class="empty-state">Bu kategoride hizmet bulunmuyor.</div>';
    return;
  }

  gridEl.innerHTML = filtered.map(service => `
    <div class="service-card" data-id="${service.id}">
      <div>
        <h3>${service.name}</h3>
        ${service.description ? `<p>${service.description}</p>` : ''}
        <div class="service-meta">
          <span class="service-duration">${service.categoryId ? (allCategories.find(c => c.id === service.categoryId)?.name || '') + ' • ' : ''}${service.durationMin || 30} dk</span>
        </div>
      </div>
      <span class="service-price">₺${service.price || 0}</span>
    </div>
  `).join('');

  // Add click handlers
  gridEl.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      if (onServiceSelect) {
        onServiceSelect(card.dataset.id);
      }
    });
  });
}

/**
 * Display services in modal
 * @param {Function} onServiceSelect - Callback when service is selected
 */
function displayModalServices(onServiceSelect) {
  const listEl = document.getElementById('modalServicesList');
  if (allServices.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Henüz hizmet bulunmuyor.</div>';
    return;
  }

  listEl.innerHTML = allServices.map(service => `
    <div class="service-card" data-id="${service.id}">
      <div>
        <h3>${service.name}</h3>
        ${service.description ? `<p>${service.description}</p>` : ''}
        <div class="service-meta">
          <span class="service-duration">${service.categoryId ? (allCategories.find(c => c.id === service.categoryId)?.name || '') + ' • ' : ''}${service.durationMin || 30} dk</span>
        </div>
      </div>
      <span class="service-price">₺${service.price || 0}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#modalServicesList .service-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      if (onServiceSelect) {
        onServiceSelect(card.dataset.id);
      }
      document.getElementById('nextToStep2').disabled = false;
    });
  });
}

/**
 * Get all services
 * @returns {Array} Array of all services
 */
export function getAllServices() {
  return allServices;
}

/**
 * Get service by ID
 * @param {string} serviceId - Service ID
 * @returns {Object|null} Service object or null
 */
export function getServiceById(serviceId) {
  return allServices.find(s => s.id === serviceId) || null;
}

/**
 * Refresh services display
 * @param {Function} onServiceSelect - Callback when service is selected
 */
export function refreshServices(onServiceSelect) {
  displayServices(onServiceSelect);
  displayModalServices(onServiceSelect);
}

