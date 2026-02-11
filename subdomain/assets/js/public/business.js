/**
 * Business Info Management Module
 * Handles loading and displaying business information
 */

import { db } from "../config/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { changeMainImage } from "./ui.js";
import { updatePageTitle, uiLog } from "./ui.js";


/**
 * Load and display business information
 * @param {string} tenantId - Tenant ID
 * @param {Function} loadStaffCallback - Callback to load staff when needed
 */
export async function loadBusinessInfo(tenantId, loadStaffCallback) {
  try {
    const businessDoc = await getDoc(doc(db, 'tenants', tenantId));
    if (businessDoc.exists()) {
      const data = businessDoc.data();
      document.getElementById('businessName').textContent = data.name || 'İşletme';
    
      uiLog("info", "Business info loaded", data);

      // title güncelle
      updatePageTitle(data.name);



      // Gallery
      const showGallery = data.showGallery === true || data.showGallery === undefined;
      if (showGallery) {
        loadGallery(data.galleryImages || []);
        document.getElementById('gallerySection').style.display = 'block';
      } else {
        document.getElementById('gallerySection').style.display = 'none';
      }

      // About Us
      const showAbout = data.showAbout === true || data.showAbout === undefined;
      if (showAbout) {
        loadAbout(data.description);
        document.getElementById('aboutSection').style.display = 'block';
      } else {
        document.getElementById('aboutSection').style.display = 'none';
      }

      // Phone
      const showPhone = data.showPhone === true || data.showPhone === undefined;
      if (showPhone) {
        loadPhone(data.phone, data.phones);
        document.getElementById('phoneCard').style.display = 'block';
      } else {
        document.getElementById('phoneCard').style.display = 'none';
      }

      // Address
      const showAddress = data.showAddress === true || data.showAddress === undefined;
      if (showAddress) {
        loadAddress(data.address);
        document.getElementById('addressCard').style.display = 'block';
      } else {
        document.getElementById('addressCard').style.display = 'none';
      }

      // Working Hours
      const showWorkingHours = data.showWorkingHours === true || data.showWorkingHours === undefined;
      if (showWorkingHours) {
        loadWorkingHours(data.workingHours);
        document.getElementById('workingHoursCard').style.display = 'block';
      } else {
        document.getElementById('workingHoursCard').style.display = 'none';
      }

      // Staff
      const showStaff = data.showStaff === true || data.showStaff === undefined;
      if (showStaff) {
        document.getElementById('staffSection').style.display = 'block';
        if (loadStaffCallback) {
          loadStaffCallback();
        }
      } else {
        document.getElementById('staffSection').style.display = 'none';
      }

      // Reviews
      const showReviews = data.showReviews === true || data.showReviews === undefined;
      if (showReviews) {
        document.getElementById('reviewsSection').style.display = 'block';
      } else {
        document.getElementById('reviewsSection').style.display = 'none';
      }

      // Show info cards section if at least one is visible
      const infoCardsSection = document.getElementById('infoCardsSection');
      if (showWorkingHours || showPhone || showAddress) {
        infoCardsSection.style.display = 'grid';
      } else {
        infoCardsSection.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Business info error:', e);
  }
}

/**
 * Load and display gallery
 * @param {Array<string>} galleryImages - Array of image URLs
 */
function loadGallery(galleryImages) {
  const galleryMainEl = document.getElementById('galleryMain');
  const firstImage = galleryImages.length > 0 ? galleryImages[0] : null;
  
  if (firstImage) {
    galleryMainEl.innerHTML = `<img src="${firstImage}" alt="Galeri" id="galleryMainImage">`;
  } else {
    galleryMainEl.innerHTML = `
      <div class="gallery-placeholder">
        <div class="gallery-placeholder-icon">🖼️</div>
        <div>Galeri görseli bulunmuyor.</div>
      </div>
    `;
  }
  
  const gallerySection = document.getElementById('gallerySection');
  const existingGrid = document.getElementById('galleryGrid');
  if (existingGrid) {
    existingGrid.remove();
  }
  
  if (galleryImages.length > 1) {
    const galleryGrid = document.createElement('div');
    galleryGrid.id = 'galleryGrid';
    galleryGrid.className = 'gallery-thumbnails';
    
    galleryImages.forEach((imgUrl, index) => {
      const imgDiv = document.createElement('div');
      const isActive = index === 0;
      imgDiv.className = 'gallery-thumbnail' + (isActive ? ' active' : '');
      imgDiv.onclick = function() { 
        changeMainImage(imgUrl);
        document.querySelectorAll('.gallery-thumbnail').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      };
      imgDiv.innerHTML = `<img src="${imgUrl}" alt="Galeri ${index + 1}">`;
      galleryGrid.appendChild(imgDiv);
    });
    
    gallerySection.appendChild(galleryGrid);
  }
}

/**
 * Load and display about section
 * @param {string} description - Business description
 */
function loadAbout(description) {
  const aboutContentEl = document.getElementById('aboutContent');
  if (description) {
    aboutContentEl.textContent = description;
    aboutContentEl.className = '';
  } else {
    aboutContentEl.textContent = 'Henüz bilgi eklenmemiş.';
    aboutContentEl.className = 'empty-state';
  }
}

/**
 * Load and display phone information
 * @param {string} phone - Single phone number
 * @param {Array<string>} phones - Array of phone numbers
 */
function loadPhone(phone, phones) {
  const phoneEl = document.getElementById('phoneNumber');
  const phoneNumbers = Array.isArray(phones)
    ? phones
    : phone
    ? [phone]
    : [];

  if (phoneNumbers.length > 0) {
    if (phoneNumbers.length === 1) {
      phoneEl.textContent = phoneNumbers[0];
      phoneEl.className = '';
      document.getElementById('phoneLink').href = `tel:${phoneNumbers[0]}`;
      document.getElementById('phoneLink').style.display = 'flex';
    } else {
      phoneEl.innerHTML = phoneNumbers
        .map(phone => `<div style="margin-bottom: 8px; text-align: center;"><a href="tel:${phone}" style="color: var(--primary); text-decoration: none; font-weight: 500;">${phone}</a></div>`)
        .join('');
      document.getElementById('phoneLink').style.display = 'none';
    }
  } else {
    phoneEl.innerHTML = 'Telefon numarası henüz eklenmemiş.';
    phoneEl.className = 'empty-state';
    document.getElementById('phoneLink').style.display = 'none';
  }
}

/**
 * Load and display address
 * @param {string} address - Business address
 */
function loadAddress(address) {
  const addressTextEl = document.getElementById('addressText');
  if (address) {
    addressTextEl.textContent = address;
    addressTextEl.className = '';
    const addressLink = document.getElementById('addressLink');
    addressLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    addressLink.style.display = 'flex';
  } else {
    addressTextEl.textContent = 'Adres henüz eklenmemiş.';
    addressTextEl.className = 'empty-state';
    document.getElementById('addressLink').style.display = 'none';
  }
}

/**
 * Load and display working hours
 * @param {Object} workingHours - Working hours object
 */
function loadWorkingHours(workingHours) {
  const hoursEl = document.getElementById('workingHours');
  if (workingHours) {
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    let hoursHtml = '';
    
    Object.keys(workingHours).forEach(dayKey => {
      const dayHours = workingHours[dayKey];
      const dayIndex = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'].indexOf(dayKey);
      if (dayHours && dayHours.closed) {
        hoursHtml += `<div style="margin-bottom: 8px;"><strong>${dayNames[dayIndex] || dayKey}:</strong> Kapalı</div>`;
      } else if (dayHours && dayHours.open && dayHours.close) {
        hoursHtml += `<div style="margin-bottom: 8px;"><strong>${dayNames[dayIndex] || dayKey}:</strong> ${dayHours.open} - ${dayHours.close}</div>`;
      }
    });
    
    if (hoursHtml) {
      hoursEl.innerHTML = hoursHtml;
      hoursEl.className = '';
    } else {
      hoursEl.innerHTML = 'Çalışma saatleri henüz belirlenmemiş.';
      hoursEl.className = 'empty-state';
    }
  } else {
    hoursEl.innerHTML = 'Çalışma saatleri henüz belirlenmemiş.';
    hoursEl.className = 'empty-state';
  }
}

/**
 * Get business data (for booking module)
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object|null>} Business data or null
 */
export async function getBusinessData(tenantId) {
  try {
    const businessDoc = await getDoc(doc(db, 'tenants', tenantId));
    if (businessDoc.exists()) {
      return businessDoc.data();
    }
    return null;
  } catch (e) {
    console.error('Business data error:', e);
    return null;
  }
}

