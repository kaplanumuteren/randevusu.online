import { db, getTenantId, IMGBB_API_KEY, IMGBB_API_URL } from "../config/firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { convertTableToCards } from "./mobile-table.js";

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// Upload image to ImgBB
async function uploadImageToImgBB(file, businessName, imageType = 'gallery') {
  try {
    const base64Image = await fileToBase64(file);
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const imageName = `${sanitizedBusinessName}-${imageType}-${timestamp}.${fileExtension}`;
    
    const params = new URLSearchParams();
    params.append('key', IMGBB_API_KEY);
    params.append('image', base64Image);
    params.append('name', imageName);
    
    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.url) {
      return data.data.url;
    } else {
      throw new Error(data.error?.message || 'Upload failed - invalid response');
    }
  } catch (error) {
    console.error('ImgBB upload error:', error);
    throw error;
  }
}

export async function loadWorkplaceSettings(container) {
  const tenantId = getTenantId();
  
  // Global drawer functions (defined before HTML is inserted)
  function openServiceDrawerGlobal() {
    const serviceDrawer = document.getElementById("serviceDrawer");
    const serviceOverlay = document.getElementById("serviceDrawerOverlay");
    if (serviceDrawer && serviceOverlay) {
      serviceDrawer.classList.add("active");
      serviceOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
      return true;
    }
    return false;
  }
  
  function closeServiceDrawerGlobal() {
    const serviceDrawer = document.getElementById("serviceDrawer");
    const serviceOverlay = document.getElementById("serviceDrawerOverlay");
    if (serviceDrawer && serviceOverlay) {
      serviceDrawer.classList.remove("active");
      serviceOverlay.classList.remove("active");
      document.body.style.overflow = "";
      return true;
    }
    return false;
  }
  
  function openStaffDrawerGlobal() {
    const staffDrawer = document.getElementById("staffDrawer");
    const staffOverlay = document.getElementById("staffDrawerOverlay");
    if (staffDrawer && staffOverlay) {
      staffDrawer.classList.add("active");
      staffOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
      return true;
    }
    return false;
  }
  
  function closeStaffDrawerGlobal() {
    const staffDrawer = document.getElementById("staffDrawer");
    const staffOverlay = document.getElementById("staffDrawerOverlay");
    if (staffDrawer && staffOverlay) {
      staffDrawer.classList.remove("active");
      staffOverlay.classList.remove("active");
      document.body.style.overflow = "";
      return true;
    }
    return false;
  }
  
  container.innerHTML = `
    <!-- Tabs Navigation -->
    <div class="settings-tabs-container">
      <div class="settings-tabs" id="settingsTabs">
        <button class="settings-tab active" data-tab="business-info">
          <span>🏢</span>
          <span>Genel Ayarlar</span>
        </button>
        <button class="settings-tab" data-tab="visibility">
          <span>👁️</span>
          <span>Görünürlük</span>
        </button>
        <button class="settings-tab" data-tab="working-hours">
          <span>⏰</span>
          <span>Çalışma Saatleri</span>
        </button>
        <button class="settings-tab" data-tab="gallery">
          <span>🖼️</span>
          <span>Galeri</span>
        </button>
        <button class="settings-tab" data-tab="services-staff">
          <span>💇</span>
          <span>Hizmetler & Personel</span>
        </button>
      </div>
      <!-- Mobile Dropdown -->
      <select class="settings-tabs-mobile" id="settingsTabsMobile">
        <option value="business-info">🏢 Genel Ayarlar</option>
        <option value="visibility">👁️ Görünürlük</option>
        <option value="working-hours">⏰ Çalışma Saatleri</option>
        <option value="gallery">🖼️ Galeri</option>
        <option value="services-staff">💇 Hizmetler & Personel</option>
      </select>
    </div>

    <!-- Tab Contents -->
    <div class="settings-tab-content active" id="tab-business-info">
      <div class="settings-tab-panel">
        <h3 class="settings-tab-title">Genel Ayarlar</h3>
        <form id="businessInfoForm">
          <div class="form-group-modern">
            <label>İşletme Adı *</label>
            <input type="text" id="bizName" placeholder="İşletme adınız" required>
          </div>
          <div class="form-group-modern">
            <label>Telefon Numaraları</label>
            <div id="phoneNumbersList">
              <div class="form-row" style="margin-bottom: 8px;">
                <input type="tel" class="phone-input" placeholder="05XX XXX XX XX" style="flex: 1;">
                <button type="button" class="btn-danger btn-small remove-phone" style="display: none;">Sil</button>
              </div>
            </div>
            <button type="button" id="addPhoneBtn" class="btn-secondary btn-small" style="margin-top: 8px;">+ Telefon Ekle</button>
          </div>
          <div class="form-group-modern">
            <label>E-posta</label>
            <input type="email" id="email" placeholder="email@example.com">
          </div>
          <div class="form-group-modern">
            <label>Adres</label>
            <textarea id="address" rows="3" placeholder="İşletme adresi"></textarea>
          </div>
          <div class="form-group-modern">
            <label>Açıklama</label>
            <textarea id="description" rows="4" placeholder="İşletme hakkında kısa açıklama"></textarea>
          </div>
          <div class="form-group-modern">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="autoConfirm" style="width: auto; cursor: pointer;">
              <span>Randevu isteklerini otomatik onayla</span>
            </label>
            <small style="color: var(--muted); font-size: 13px; display: block; margin-top: 5px;">
              Açık olduğunda, müşterilerin randevu talepleri otomatik olarak onaylanır.
            </small>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <div class="settings-tab-content" id="tab-visibility">
      <div class="settings-tab-panel">
        <h3 class="settings-tab-title">Sayfa Görünürlük Ayarları</h3>
        <p class="settings-tab-description">
          Müşteri randevu sayfasında hangi bölümlerin görüneceğini seçebilirsiniz:
        </p>
        <form id="visibilityForm">
          <div class="visibility-toggles">
            <label class="visibility-toggle">
              <input type="checkbox" id="showAbout">
              <span class="toggle-label">Hakkımızda bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showPhone">
              <span class="toggle-label">Telefon bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showAddress">
              <span class="toggle-label">Adres bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showWorkingHours">
              <span class="toggle-label">Çalışma Saatleri bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showStaff">
              <span class="toggle-label">Personeller bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showGallery">
              <span class="toggle-label">Galeri bölümünü göster</span>
            </label>
            <label class="visibility-toggle">
              <input type="checkbox" id="showReviews">
              <span class="toggle-label">Müşteri Yorumları bölümünü göster</span>
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <div class="settings-tab-content" id="tab-working-hours">
      <div class="settings-tab-panel">
        <h3 class="settings-tab-title">Çalışma Saatleri</h3>
        <form id="workingHoursForm">
          <div class="working-hours-list" id="workingHoursContainer">
            ${['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day, idx) => `
              <div class="working-hour-item">
                <div class="working-hour-day">${day}</div>
                <div class="working-hour-times">
                  <input type="time" id="openTime_${idx}" value="09:00" class="time-input">
                  <span class="time-separator">-</span>
                  <input type="time" id="closeTime_${idx}" value="18:00" class="time-input">
                </div>
                <label class="working-hour-closed">
                  <input type="checkbox" id="closed_${idx}">
                  <span>Kapalı</span>
                </label>
              </div>
            `).join('')}
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <div class="settings-tab-content" id="tab-gallery">
      <div class="settings-tab-panel">
        <h3 class="settings-tab-title">Galeri</h3>
        <p class="settings-tab-description">
          Yüklediğiniz ilk resim büyük galeri görseli olarak gösterilecektir.
        </p>
        <div class="gallery-upload-section">
          <input type="file" id="galleryImagesInput" accept="image/*" multiple style="display: none;">
          <button type="button" id="uploadGalleryImagesBtn" class="btn-primary">+ Resim Ekle</button>
          <div id="galleryUploadProgress" style="display: none; margin-top: 10px;">
            <div class="progress-bar">
              <div id="galleryProgressBar" class="progress-bar-fill"></div>
            </div>
            <small style="color: var(--muted); font-size: 12px;">Yükleniyor...</small>
          </div>
        </div>
        <div id="galleryImagesPreview" class="gallery-grid">
        </div>
      </div>
    </div>

    <div class="settings-tab-content" id="tab-services-staff">
      <div class="settings-tab-panel">
        <!-- Categories Section -->
        <div class="categories-section">
          <div class="section-header">
            <h4>Kategoriler</h4>
            <button id="addCategoryBtn" class="btn-secondary btn-small">+ Yeni Kategori</button>
          </div>
          <div id="categoriesList" class="category-tags">
            <div class="loading">Kategoriler yükleniyor...</div>
          </div>
        </div>

        <!-- Services Section -->
        <div class="services-section">
          <div class="section-header">
            <h4>Hizmetler</h4>
            <button id="addServiceBtn" class="btn-primary btn-small">+ Yeni Hizmet</button>
          </div>
          <div class="table-wrapper" style="margin-top: 0; padding: 0; box-shadow: none; border: none;">
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kategori</th>
                  <th>Personeller</th>
                  <th>Süre</th>
                  <th>Fiyat</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody id="servicesTable"></tbody>
            </table>
          </div>
        </div>

        <!-- Staff Section -->
        <div class="staff-section">
          <div class="section-header">
            <h4>Personel</h4>
            <button id="addStaffBtn" class="btn-primary btn-small">+ Yeni Personel</button>
          </div>
          <div class="table-wrapper" style="margin-top: 0; padding: 0; box-shadow: none; border: none;">
            <table>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody id="staffTable"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Drawer -->
    <div class="drawer-overlay" id="categoryDrawerOverlay"></div>
    <div class="drawer" id="categoryDrawer">
      <div class="drawer-header">
        <h4 id="categoryFormTitle">Yeni Kategori Ekle</h4>
        <button class="drawer-close" id="closeCategoryDrawer">&times;</button>
      </div>
      <div class="drawer-body">
        <div class="form-group-modern">
          <label>Kategori Adı</label>
          <input type="text" id="catName" placeholder="Örn: Saç Hizmetleri" autofocus>
        </div>
      </div>
      <div class="drawer-footer">
        <button id="cancelCategory" class="btn-secondary">İptal</button>
        <button id="saveCategory" class="btn-primary">Kaydet</button>
      </div>
    </div>

    <!-- Service Drawer -->
    <div class="drawer-overlay" id="serviceDrawerOverlay"></div>
    <div class="drawer" id="serviceDrawer" style="width: 600px;">
      <div class="drawer-header">
        <h4 id="serviceFormTitle">Yeni Hizmet Ekle</h4>
        <button class="drawer-close" id="closeServiceDrawer">&times;</button>
      </div>
      <div class="drawer-body">
        <div class="form-group-modern">
          <label>Hizmet Adı *</label>
          <input type="text" id="serviceName" placeholder="Örn: Saç Kesimi" required>
        </div>
        <div class="form-row">
          <div class="form-group-modern">
            <label>Fiyat (₺) *</label>
            <input type="number" id="servicePrice" placeholder="0" min="0" step="0.01" required>
          </div>
          <div class="form-group-modern">
            <label>Süre (dakika) *</label>
            <input type="number" id="serviceDuration" placeholder="30" min="5" step="5" required>
          </div>
        </div>
        <div class="form-group-modern">
          <label>Kategori</label>
          <select id="serviceCategory">
            <option value="">Kategori Seçin (İsteğe Bağlı)</option>
          </select>
        </div>
        <div class="form-group-modern">
          <label>Bu Hizmeti Yapabilecek Personeller</label>
          <div id="staffCheckboxes" class="staff-checkboxes-modern">
            <div class="loading">Personeller yükleniyor...</div>
          </div>
          <small style="color: var(--muted); margin-top: 8px; display: block;">
            Hiçbir personel seçilmezse, tüm personeller bu hizmeti yapabilir.
          </small>
        </div>
        <div class="form-group-modern">
          <label>Açıklama</label>
          <textarea id="serviceDescription" rows="3" placeholder="Hizmet açıklaması (isteğe bağlı)"></textarea>
        </div>
      </div>
      <div class="drawer-footer">
        <button id="cancelService" class="btn-secondary">İptal</button>
        <button id="saveService" class="btn-primary">Kaydet</button>
      </div>
    </div>

    <!-- Staff Drawer -->
    <div class="drawer-overlay" id="staffDrawerOverlay"></div>
    <div class="drawer" id="staffDrawer">
      <div class="drawer-header">
        <h4 id="staffFormTitle">Yeni Personel Ekle</h4>
        <button class="drawer-close" id="closeStaffDrawer">&times;</button>
      </div>
      <div class="drawer-body">
        <div class="form-group-modern">
          <label>Ad Soyad *</label>
          <input type="text" id="staffName" placeholder="Örn: Ahmet Yılmaz" required>
        </div>
      </div>
      <div class="drawer-footer">
        <button id="cancelStaff" class="btn-secondary">İptal</button>
        <button id="saveStaff" class="btn-primary">Kaydet</button>
      </div>
    </div>
  `;

  // Variables
  let currentGalleryImages = [];
  let editingServiceId = null;
  let editingCategoryId = null;
  let editingStaffId = null;
  let allCategories = [];
  let allStaff = [];

  // Define global edit functions (will be set up after DOM is ready and data is loaded)
  // These functions will be defined after loadCategories and loadStaffTable are called

  // Wait for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 50));

  // Tab switching
  setupTabSwitching();

  // Load business information
  await loadBusinessInfo(tenantId);
  
  // Load categories and staff first (services table needs these)
  await loadCategories(tenantId);
  await loadStaffTable(tenantId);
  // Then load services (which depends on categories and staff)
  await loadServicesTable(tenantId);

  // Define helper functions that are needed by edit functions
  function updateCategorySelect() {
    const select = document.getElementById("serviceCategory");
    if (!select) return;
    select.innerHTML = '<option value="">Kategori Seçin (İsteğe Bağlı)</option>';
    allCategories.forEach(cat => {
      select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }

  function updateStaffCheckboxes() {
    const box = document.getElementById("staffCheckboxes");
    if (!box) return;
    if (allStaff.length === 0) {
      box.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--muted);">Henüz personel eklenmemiş. Personel eklemek için aşağıdaki butona tıklayın.</div>';
      return;
    }
    box.innerHTML = allStaff.map(staff => `
      <div class="staff-checkbox-item">
        <input type="checkbox" value="${staff.id}" class="staff-checkbox" id="staff-${staff.id}">
        <label for="staff-${staff.id}">${staff.name}</label>
      </div>
    `).join('');
  }

  // Define global edit functions AFTER data is loaded and helper functions are defined
  window.editService = async (id) => {
    try {
      // Ensure categories are loaded
      await loadCategories(tenantId);
      
      const serviceDoc = await getDoc(doc(db, "tenants", tenantId, "services", id));
      if (serviceDoc.exists()) {
        const data = serviceDoc.data();
        editingServiceId = id;
        
        const titleEl = document.getElementById("serviceFormTitle");
        const nameEl = document.getElementById("serviceName");
        const priceEl = document.getElementById("servicePrice");
        const durationEl = document.getElementById("serviceDuration");
        const categoryEl = document.getElementById("serviceCategory");
        const descriptionEl = document.getElementById("serviceDescription");
        
        if (!titleEl || !nameEl || !priceEl || !durationEl || !categoryEl || !descriptionEl) {
          console.error("Service form elements not found");
          return;
        }
        
        // Update category select before opening drawer
        updateCategorySelect();
        updateStaffCheckboxes();
        
        titleEl.textContent = "Hizmet Düzenle";
        nameEl.value = data.name || "";
        priceEl.value = data.price || "";
        durationEl.value = data.durationMin || "";
        categoryEl.value = data.categoryId || "";
        descriptionEl.value = data.description || "";
        
        document.querySelectorAll(".staff-checkbox").forEach(cb => {
          cb.checked = data.staffIds && data.staffIds.includes(cb.value);
        });
        
        // Open drawer using global function
        if (!openServiceDrawerGlobal()) {
          console.error("Service drawer elements not found");
          alert("Drawer açılamadı. Sayfayı yenileyin.");
          return;
        }
        
        setTimeout(() => {
          nameEl.focus();
        }, 100);
      }
    } catch (e) {
      console.error("Error editing service:", e);
      alert("Hata: " + e.message);
    }
  };

  window.editStaff = async (id) => {
    try {
      const staffDoc = await getDoc(doc(db, "tenants", tenantId, "staff", id));
      if (staffDoc.exists()) {
        const data = staffDoc.data();
        editingStaffId = id;
        
        const titleEl = document.getElementById("staffFormTitle");
        const nameEl = document.getElementById("staffName");
        
        if (!titleEl || !nameEl) {
          console.error("Staff form elements not found");
          return;
        }
        
        titleEl.textContent = "Personel Düzenle";
        nameEl.value = data.name || "";
        
        // Open drawer using global function
        if (!openStaffDrawerGlobal()) {
          console.error("Staff drawer elements not found");
          alert("Drawer açılamadı. Sayfayı yenileyin.");
          return;
        }
        
        setTimeout(() => {
          nameEl.focus();
        }, 100);
      }
    } catch (e) {
      console.error("Error editing staff:", e);
      alert("Hata: " + e.message);
    }
  };

  // Business info form handlers
  setupBusinessInfoForm(tenantId);
  
  // Visibility form handlers
  setupVisibilityForm(tenantId);

  // Working hours form handlers
  setupWorkingHoursForm(tenantId);
  
  // Category handlers
  // Wait for DOM to be ready before setting up handlers
  setTimeout(() => {
    try {
      setupCategoryHandlers(tenantId);
      setupServiceHandlers(tenantId);
      setupStaffHandlers(tenantId);
      setupGalleryHandlers(tenantId);
    } catch (error) {
      console.error("Error setting up workplace settings handlers:", error);
    }
  }, 50);

  function setupTabSwitching() {
    const tabs = document.querySelectorAll('.settings-tab');
    const mobileSelect = document.getElementById('settingsTabsMobile');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    // Desktop tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update mobile select
        mobileSelect.value = targetTab;
        
        // Show/hide tab content
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `tab-${targetTab}`) {
            content.classList.add('active');
          }
        });
      });
    });

    // Mobile dropdown switching
    mobileSelect.addEventListener('change', (e) => {
      const targetTab = e.target.value;
      
      // Update active tab
      tabs.forEach(t => {
        t.classList.remove('active');
        if (t.dataset.tab === targetTab) {
          t.classList.add('active');
        }
      });
      
      // Show/hide tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  }

  async function loadBusinessInfo(tenantId) {
    try {
      const tenantRef = doc(db, "tenants", tenantId);
      const tenantSnap = await getDoc(tenantRef);
      
      if (tenantSnap.exists()) {
        const tenantData = tenantSnap.data();
        const bizNameEl = document.getElementById("bizName");
        if (bizNameEl) {
          bizNameEl.value = tenantData.name || "";
        }
        
        // Load phone numbers
        const phoneNumbers = tenantData.phones || (tenantData.phone ? [tenantData.phone] : []);
        const phoneListEl = document.getElementById("phoneNumbersList");
        if (phoneListEl) {
          phoneListEl.innerHTML = "";
          if (phoneNumbers.length === 0) {
            phoneNumbers.push("");
          }
          phoneNumbers.forEach((phone) => {
            const phoneRow = document.createElement("div");
            phoneRow.className = "form-row";
            phoneRow.style.marginBottom = "8px";
            phoneRow.innerHTML = `
              <input type="tel" class="phone-input" placeholder="05XX XXX XX XX" value="${phone || ''}" style="flex: 1;">
              <button type="button" class="btn-danger btn-small remove-phone" ${phoneNumbers.length <= 1 ? 'style="display: none;"' : ''}>Sil</button>
            `;
            phoneListEl.appendChild(phoneRow);
          });
          
          // Add remove handlers
          phoneListEl.querySelectorAll('.remove-phone').forEach(btn => {
            btn.addEventListener('click', function() {
              this.closest('.form-row').remove();
              updatePhoneRemoveButtons();
            });
          });
        }
        
        const emailEl = document.getElementById("email");
        if (emailEl) emailEl.value = tenantData.email || "";
        
        const addressEl = document.getElementById("address");
        if (addressEl) addressEl.value = tenantData.address || "";
        
        const descriptionEl = document.getElementById("description");
        if (descriptionEl) descriptionEl.value = tenantData.description || "";
        
        // Load auto confirm setting
        const autoConfirmEl = document.getElementById("autoConfirm");
        if (autoConfirmEl) {
          autoConfirmEl.checked = tenantData.autoConfirm === true;
        }
        
        // Load gallery images
        if (tenantData.galleryImages && Array.isArray(tenantData.galleryImages)) {
          currentGalleryImages = tenantData.galleryImages;
          // Display gallery images if gallery handlers are set up
          const galleryPreview = document.getElementById('galleryImagesPreview');
          if (galleryPreview) {
            displayGalleryImagesInElement(currentGalleryImages, tenantId);
          }
        }
        
        // Working hours
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        const workingHours = tenantData.workingHours || {};
        days.forEach((day, idx) => {
          const dayKey = day.toLowerCase();
          const hours = workingHours[dayKey] || { open: "09:00", close: "18:00", closed: false };
          const openTimeEl = document.getElementById(`openTime_${idx}`);
          const closeTimeEl = document.getElementById(`closeTime_${idx}`);
          const closedEl = document.getElementById(`closed_${idx}`);
          if (openTimeEl) openTimeEl.value = hours.open || "09:00";
          if (closeTimeEl) closeTimeEl.value = hours.close || "18:00";
          if (closedEl) closedEl.checked = hours.closed || false;
        });
      }
    } catch (e) {
      console.error("Business info load error:", e);
    }
  }

  function setupBusinessInfoForm(tenantId) {
    const addPhoneBtn = document.getElementById("addPhoneBtn");
    const businessInfoForm = document.getElementById("businessInfoForm");
    
    if (!addPhoneBtn || !businessInfoForm) {
      console.error("Business info form elements not found");
      return;
    }

    // Add phone button
    addPhoneBtn.addEventListener("click", () => {
      const phoneListEl = document.getElementById("phoneNumbersList");
      if (!phoneListEl) return;
      
      const phoneRow = document.createElement("div");
      phoneRow.className = "form-row";
      phoneRow.style.marginBottom = "8px";
      phoneRow.innerHTML = `
        <input type="tel" class="phone-input" placeholder="05XX XXX XX XX" style="flex: 1;">
        <button type="button" class="btn-danger btn-small remove-phone">Sil</button>
      `;
      phoneListEl.appendChild(phoneRow);
      
      phoneRow.querySelector('.remove-phone').addEventListener('click', function() {
        this.closest('.form-row').remove();
        updatePhoneRemoveButtons();
      });
      
      updatePhoneRemoveButtons();
    });

    function updatePhoneRemoveButtons() {
      const phoneInputs = document.querySelectorAll('.phone-input');
      phoneInputs.forEach((input) => {
        const row = input.closest('.form-row');
        if (row) {
          const removeBtn = row.querySelector('.remove-phone');
          if (removeBtn) {
            if (phoneInputs.length <= 1) {
              removeBtn.style.display = 'none';
            } else {
              removeBtn.style.display = 'block';
            }
          }
        }
      });
    }

    // Save business info
    businessInfoForm.onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        const tenantRef = doc(db, "tenants", tenantId);
        const phones = Array.from(document.querySelectorAll('.phone-input'))
          .map(input => input.value.trim())
          .filter(phone => phone.length > 0);
        
        const bizNameEl = document.getElementById("bizName");
        const emailEl = document.getElementById("email");
        const addressEl = document.getElementById("address");
        const descriptionEl = document.getElementById("description");
        const autoConfirmEl = document.getElementById("autoConfirm");
        
        const settingsData = {
          name: bizNameEl ? bizNameEl.value.trim() : "",
          phones: phones.length > 0 ? phones : null,
          phone: phones.length > 0 ? phones[0] : null,
          email: emailEl ? emailEl.value.trim() || null : null,
          address: addressEl ? addressEl.value.trim() || null : null,
          description: descriptionEl ? descriptionEl.value.trim() || null : null,
          autoConfirm: autoConfirmEl ? autoConfirmEl.checked : false,
          updatedAt: new Date()
        };

        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          await updateDoc(tenantRef, settingsData);
        } else {
          settingsData.createdAt = new Date();
          await setDoc(tenantRef, settingsData);
        }

        // Update business name in header
        const businessNameEl = document.getElementById("businessName");
        if (businessNameEl) {
          businessNameEl.textContent = settingsData.name || "İşletme Adı";
        }

        alert("✅ İşletme bilgileri kaydedildi!");
      } catch (error) {
        alert("Hata: " + error.message);
        console.error("Business info save error:", error);
      }
    };
  }

  function setupVisibilityForm(tenantId) {
    const visibilityForm = document.getElementById("visibilityForm");
    if (!visibilityForm) {
      console.error("Visibility form not found");
      return;
    }

    // Load visibility settings
    async function loadVisibilitySettings() {
      try {
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);
        
        const showAbout = document.getElementById("showAbout");
        const showPhone = document.getElementById("showPhone");
        const showAddress = document.getElementById("showAddress");
        const showWorkingHours = document.getElementById("showWorkingHours");
        const showStaff = document.getElementById("showStaff");
        const showGallery = document.getElementById("showGallery");
        const showReviews = document.getElementById("showReviews");

        if (!showAbout || !showPhone || !showAddress || !showWorkingHours || !showStaff || !showGallery || !showReviews) {
          console.error("Visibility toggle elements not found");
          return;
        }
        
        if (tenantSnap.exists()) {
          const tenantData = tenantSnap.data();
          // Default to true if not set
          showAbout.checked = tenantData.showAbout !== false;
          showPhone.checked = tenantData.showPhone !== false;
          showAddress.checked = tenantData.showAddress !== false;
          showWorkingHours.checked = tenantData.showWorkingHours !== false;
          showStaff.checked = tenantData.showStaff !== false;
          showGallery.checked = tenantData.showGallery !== false;
          showReviews.checked = tenantData.showReviews !== false;
        } else {
          // Default all to true for new tenants
          showAbout.checked = true;
          showPhone.checked = true;
          showAddress.checked = true;
          showWorkingHours.checked = true;
          showStaff.checked = true;
          showGallery.checked = true;
          showReviews.checked = true;
        }
      } catch (e) {
        console.error("Visibility settings load error:", e);
      }
    }

    // Save visibility settings
    visibilityForm.onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        const tenantRef = doc(db, "tenants", tenantId);
        const showAbout = document.getElementById("showAbout");
        const showPhone = document.getElementById("showPhone");
        const showAddress = document.getElementById("showAddress");
        const showWorkingHours = document.getElementById("showWorkingHours");
        const showStaff = document.getElementById("showStaff");
        const showGallery = document.getElementById("showGallery");
        const showReviews = document.getElementById("showReviews");

        if (!showAbout || !showPhone || !showAddress || !showWorkingHours || !showStaff || !showGallery || !showReviews) {
          alert("Görünürlük ayarları yüklenemedi.");
          return;
        }

        const settingsData = {
          showAbout: showAbout.checked,
          showPhone: showPhone.checked,
          showAddress: showAddress.checked,
          showWorkingHours: showWorkingHours.checked,
          showStaff: showStaff.checked,
          showGallery: showGallery.checked,
          showReviews: showReviews.checked,
          updatedAt: new Date()
        };

        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          await updateDoc(tenantRef, settingsData);
        } else {
          settingsData.createdAt = new Date();
          await setDoc(tenantRef, settingsData);
        }

        alert("✅ Görünürlük ayarları kaydedildi!");
      } catch (error) {
        alert("Hata: " + error.message);
        console.error("Visibility settings save error:", error);
      }
    };

    loadVisibilitySettings();
  }

  function setupWorkingHoursForm(tenantId) {
    const workingHoursForm = document.getElementById("workingHoursForm");
    if (!workingHoursForm) {
      console.error("Working hours form not found");
      return;
    }

    // Save working hours
    workingHoursForm.onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        const tenantRef = doc(db, "tenants", tenantId);
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        const hours = {};
        days.forEach((day, idx) => {
          const openTimeEl = document.getElementById(`openTime_${idx}`);
          const closeTimeEl = document.getElementById(`closeTime_${idx}`);
          const closedEl = document.getElementById(`closed_${idx}`);
          if (openTimeEl && closeTimeEl && closedEl) {
            hours[day.toLowerCase()] = {
              open: openTimeEl.value,
              close: closeTimeEl.value,
              closed: closedEl.checked
            };
          }
        });

        const settingsData = {
          workingHours: hours,
          updatedAt: new Date()
        };

        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          await updateDoc(tenantRef, settingsData);
        } else {
          settingsData.createdAt = new Date();
          await setDoc(tenantRef, settingsData);
        }

        alert("✅ Çalışma saatleri kaydedildi!");
      } catch (error) {
        alert("Hata: " + error.message);
        console.error("Working hours save error:", error);
      }
    };
  }

  // Helper function to display gallery images (can be called from anywhere)
  function displayGalleryImagesInElement(urls, tenantIdParam) {
    const galleryEl = document.getElementById('galleryImagesPreview');
    if (!galleryEl) {
      return;
    }
    
    currentGalleryImages = urls || [];
    galleryEl.innerHTML = '';
    
    if (currentGalleryImages.length === 0) {
      galleryEl.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 40px;">Henüz resim eklenmemiş.</p>';
      return;
    }
    
    currentGalleryImages.forEach((url, index) => {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'gallery-item';
      imgDiv.innerHTML = `
        <img src="${url}" alt="Galeri resmi ${index + 1}">
        <button type="button" class="gallery-remove-btn" data-index="${index}">×</button>
        ${index === 0 ? '<div class="gallery-hero-badge">Ana Görsel</div>' : ''}
      `;
      galleryEl.appendChild(imgDiv);
    });
    
    // Save function for gallery images
    async function saveGalleryImagesLocal(tenantIdLocal) {
      try {
        const tenantRef = doc(db, "tenants", tenantIdLocal);
        const tenantSnap = await getDoc(tenantRef);
        const updateData = {
          galleryImages: currentGalleryImages.length > 0 ? currentGalleryImages : null,
          updatedAt: new Date()
        };

        if (tenantSnap.exists()) {
          await updateDoc(tenantRef, updateData);
        } else {
          updateData.createdAt = new Date();
          await setDoc(tenantRef, updateData);
        }
      } catch (error) {
        console.error("Gallery save error:", error);
        throw error;
      }
    }
    
    galleryEl.querySelectorAll('.gallery-remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu resmi kaldırmak istediğinize emin misiniz?')) return;
        const index = parseInt(btn.dataset.index);
        currentGalleryImages.splice(index, 1);
        if (tenantIdParam) {
          await saveGalleryImagesLocal(tenantIdParam);
        }
        displayGalleryImagesInElement(currentGalleryImages, tenantIdParam);
      });
    });
  }

  function setupGalleryHandlers(tenantId) {

    async function saveGalleryImages(tenantId) {
      try {
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);
        const updateData = {
          galleryImages: currentGalleryImages.length > 0 ? currentGalleryImages : null,
          updatedAt: new Date()
        };

        if (tenantSnap.exists()) {
          await updateDoc(tenantRef, updateData);
        } else {
          updateData.createdAt = new Date();
          await setDoc(tenantRef, updateData);
        }
      } catch (error) {
        console.error("Gallery save error:", error);
        throw error;
      }
    }

    const uploadGalleryImagesBtn = document.getElementById('uploadGalleryImagesBtn');
    const galleryImagesInput = document.getElementById('galleryImagesInput');
    
    if (!uploadGalleryImagesBtn || !galleryImagesInput) {
      console.error("Gallery upload elements not found");
      return;
    }

    uploadGalleryImagesBtn.addEventListener('click', () => {
      galleryImagesInput.click();
    });

    galleryImagesInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          alert('Lütfen sadece resim dosyaları seçin.');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          alert('Resim boyutu 10MB\'dan küçük olmalıdır.');
          return;
        }
      }

      try {
        const progressEl = document.getElementById('galleryUploadProgress');
        const progressBar = document.getElementById('galleryProgressBar');
        progressEl.style.display = 'block';
        progressBar.style.width = '0%';

        const bizNameEl = document.getElementById('bizName');
        const businessName = bizNameEl ? bizNameEl.value.trim() : tenantId;
        const sanitizedBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        const uploadPromises = files.map(async (file, index) => {
          try {
            const imageUrl = await uploadImageToImgBB(file, sanitizedBusinessName, 'gallery');
            const progress = ((index + 1) / files.length) * 100;
            progressBar.style.width = progress + '%';
            return imageUrl;
          } catch (error) {
            console.error(`Upload error for file ${index + 1}:`, error);
            throw error;
          }
        });

        const urls = await Promise.all(uploadPromises);
        currentGalleryImages = [...currentGalleryImages, ...urls];
        await saveGalleryImages(tenantId);
        displayGalleryImagesInElement(currentGalleryImages, tenantId);
        
        setTimeout(() => {
          progressEl.style.display = 'none';
          progressBar.style.width = '0%';
        }, 500);
        
        alert(`✅ ${files.length} resim başarıyla yüklendi!`);
      } catch (error) {
        console.error('Upload error:', error);
        alert('Resimler yüklenirken bir hata oluştu: ' + error.message);
        document.getElementById('galleryUploadProgress').style.display = 'none';
      }
    });

    // Initialize display - will be called after business info is loaded
    // Gallery images are loaded in loadBusinessInfo, so we'll display them there
  }

  async function loadCategories(tenantId) {
    const categoriesSnap = await getDocs(collection(db, "tenants", tenantId, "categories"));
    allCategories = [];
    categoriesSnap.forEach(doc => allCategories.push({ id: doc.id, ...doc.data() }));
    displayCategories();
    updateCategorySelect();
  }

  function displayCategories() {
    const listEl = document.getElementById("categoriesList");
    if (!listEl) {
      console.error("Categories list element not found");
      return;
    }
    if (allCategories.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="width: 100%; padding: 20px; text-align: center; color: var(--muted);">Henüz kategori eklenmemiş.</div>';
      return;
    }
    listEl.innerHTML = allCategories.map(cat => `
      <div class="category-tag">
        <span>${cat.name}</span>
        <button data-category-id="${cat.id}" data-action="edit" title="Düzenle">✏️</button>
        <button data-category-id="${cat.id}" data-action="delete" title="Sil">🗑️</button>
      </div>
    `).join('');
    
    // Attach event listeners to category buttons
    listEl.querySelectorAll('[data-category-id]').forEach(btn => {
      const categoryId = btn.getAttribute('data-category-id');
      const action = btn.getAttribute('data-action');
      
      btn.addEventListener('click', () => {
        if (action === 'edit' && window.editCategory) {
          window.editCategory(categoryId);
        } else if (action === 'delete' && window.deleteCategory) {
          window.deleteCategory(categoryId);
        }
      });
    });
  }

  function updateCategorySelect() {
    const select = document.getElementById("serviceCategory");
    select.innerHTML = '<option value="">Kategori Seçin (İsteğe Bağlı)</option>';
    allCategories.forEach(cat => {
      select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }

  // Category drawer functions (accessible globally)
  let openCategoryDrawer, closeCategoryDrawerFunc;
  
  function setupCategoryHandlers(tenantId) {
    const categoryDrawer = document.getElementById("categoryDrawer");
    const categoryOverlay = document.getElementById("categoryDrawerOverlay");
    const addCategoryBtn = document.getElementById("addCategoryBtn");
    const closeCategoryDrawerBtn = document.getElementById("closeCategoryDrawer");
    const cancelCategory = document.getElementById("cancelCategory");
    const saveCategory = document.getElementById("saveCategory");
    
    if (!categoryDrawer || !categoryOverlay || !addCategoryBtn || !closeCategoryDrawerBtn || !cancelCategory || !saveCategory) {
      console.error("Category drawer elements not found");
      return;
    }
    
    openCategoryDrawer = function() {
      categoryDrawer.classList.add("active");
      categoryOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    };
    
    closeCategoryDrawerFunc = function() {
      categoryDrawer.classList.remove("active");
      categoryOverlay.classList.remove("active");
      document.body.style.overflow = "";
      editingCategoryId = null;
    };
    
    addCategoryBtn.addEventListener("click", () => {
      editingCategoryId = null;
      const titleEl = document.getElementById("categoryFormTitle");
      const nameEl = document.getElementById("catName");
      if (titleEl) titleEl.textContent = "Yeni Kategori Ekle";
      if (nameEl) nameEl.value = "";
      openCategoryDrawer();
      setTimeout(() => {
        if (nameEl) nameEl.focus();
      }, 100);
    });

    closeCategoryDrawerBtn.addEventListener("click", closeCategoryDrawerFunc);
    cancelCategory.addEventListener("click", closeCategoryDrawerFunc);
    
    categoryOverlay.addEventListener("click", closeCategoryDrawerFunc);

    saveCategory.addEventListener("click", async () => {
      const nameEl = document.getElementById("catName");
      if (!nameEl) return;
      
      const name = nameEl.value.trim();
      if (!name) {
        alert("Kategori adı boş olamaz.");
        return;
      }

      try {
        if (editingCategoryId) {
          await updateDoc(doc(db, "tenants", tenantId, "categories", editingCategoryId), {
            name,
            updatedAt: new Date()
          });
          alert("✅ Kategori güncellendi!");
        } else {
          await addDoc(collection(db, "tenants", tenantId, "categories"), {
            name,
            createdAt: new Date()
          });
          alert("✅ Kategori eklendi!");
        }
        closeCategoryDrawerFunc();
        await loadCategories(tenantId);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    });

    // Make functions globally available
    window.editCategory = async (id) => {
      try {
        const catDoc = await getDoc(doc(db, "tenants", tenantId, "categories", id));
        if (catDoc.exists()) {
          editingCategoryId = id;
          const titleEl = document.getElementById("categoryFormTitle");
          const nameEl = document.getElementById("catName");
          if (titleEl) titleEl.textContent = "Kategori Düzenle";
          if (nameEl) nameEl.value = catDoc.data().name || "";
          openCategoryDrawer();
          setTimeout(() => {
            if (nameEl) nameEl.focus();
          }, 100);
        }
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };

    window.deleteCategory = async (id) => {
      if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?\n\nBu kategoriye ait hizmetler kategorisiz kalacaktır.")) {
        return;
      }
      try {
        await deleteDoc(doc(db, "tenants", tenantId, "categories", id));
        alert("✅ Kategori silindi!");
        await loadCategories(tenantId);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };
  }

  async function loadServicesTable(tenantId) {
    const snap = await getDocs(collection(db, "tenants", tenantId, "services"));
    const tableEl = document.getElementById("servicesTable");
    if (!tableEl) {
      console.error("Services table element not found");
      return;
    }

    // Build maps from loaded data
    const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
    const staffMap = Object.fromEntries(allStaff.map(s => [s.id, s.name]));

    if (snap.empty) {
      tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding: 40px;">Henüz hizmet yok. Yeni hizmet eklemek için yukarıdaki butona tıklayın.</td></tr>`;
      return;
    }

    tableEl.innerHTML = snap.docs.map(docSnap => {
      const s = docSnap.data();
      const serviceId = docSnap.id;
      
      // Get staff names - if staffIds is empty or undefined, show "Tüm personeller"
      let staffNames = "Tüm personeller";
      if (s.staffIds && Array.isArray(s.staffIds) && s.staffIds.length > 0) {
        const names = s.staffIds
          .map(id => staffMap[id])
          .filter(name => name !== undefined);
        staffNames = names.length > 0 ? names.join(", ") : "Tüm personeller";
      }
      
      return `
        <tr>
          <td><strong>${s.name || ''}</strong></td>
          <td>${s.categoryId ? (catMap[s.categoryId] || '-') : '<span style="color: var(--muted);">Kategori yok</span>'}</td>
          <td><small style="color: var(--muted);">${staffNames}</small></td>
          <td>${s.durationMin || 0} dk</td>
          <td><strong style="color: var(--accent);">${(s.price || 0).toFixed(2)} ₺</strong></td>
          <td style="white-space: nowrap;">
            <button class="btn-edit btn-small" data-service-id="${serviceId}">Düzenle</button>
            <button class="btn-danger btn-small" data-service-id="${serviceId}" data-action="delete">Sil</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners to buttons
    tableEl.querySelectorAll('[data-service-id]').forEach(btn => {
      const serviceId = btn.getAttribute('data-service-id');
      const action = btn.getAttribute('data-action');
      
      if (action === 'delete') {
        btn.addEventListener('click', () => {
          if (window.deleteService) {
            window.deleteService(serviceId);
          }
        });
      } else {
        btn.addEventListener('click', () => {
          if (window.editService) {
            window.editService(serviceId);
          }
        });
      }
    });

    setTimeout(() => {
      convertTableToCards();
    }, 100);
  }

  async function loadStaffTable(tenantId) {
    const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
    allStaff = [];
    staffSnap.forEach(doc => allStaff.push({ id: doc.id, ...doc.data() }));
    updateStaffCheckboxes();
    
    const tableEl = document.getElementById("staffTable");
    if (!tableEl) {
      console.error("Staff table element not found");
      return;
    }

    if (staffSnap.empty) {
      tableEl.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--muted); padding: 40px;">Henüz personel eklenmemiş.</td></tr>`;
      return;
    }

    tableEl.innerHTML = "";
    staffSnap.forEach((docSnap) => {
      const s = docSnap.data();
      const staffId = docSnap.id;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.name || ''}</strong></td>
        <td style="white-space: nowrap;">
          <button class="btn-edit btn-small" data-staff-id="${staffId}">Düzenle</button>
          <button class="btn-danger btn-small" data-staff-id="${staffId}" data-action="delete">Sil</button>
        </td>
      `;
      
      // Attach event listeners
      const editBtn = tr.querySelector('[data-staff-id]:not([data-action])');
      const deleteBtn = tr.querySelector('[data-action="delete"]');
      
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (window.editStaff) {
            window.editStaff(staffId);
          }
        });
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (window.deleteStaff) {
            window.deleteStaff(staffId);
          }
        });
      }
      
      tableEl.appendChild(tr);
    });

    setTimeout(() => {
      convertTableToCards();
    }, 100);
  }

  // updateStaffCheckboxes is now defined earlier in loadWorkplaceSettings

  // Service drawer functions (accessible globally)
  let openServiceDrawer, closeServiceDrawerFunc;
  
  // Global function to open service drawer (can be called from anywhere)
  function openServiceDrawerGlobal() {
    const serviceDrawer = document.getElementById("serviceDrawer");
    const serviceOverlay = document.getElementById("serviceDrawerOverlay");
    if (serviceDrawer && serviceOverlay) {
      serviceDrawer.classList.add("active");
      serviceOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
      return true;
    }
    return false;
  }
  
  // Global function to close service drawer
  function closeServiceDrawerGlobal() {
    const serviceDrawer = document.getElementById("serviceDrawer");
    const serviceOverlay = document.getElementById("serviceDrawerOverlay");
    if (serviceDrawer && serviceOverlay) {
      serviceDrawer.classList.remove("active");
      serviceOverlay.classList.remove("active");
      document.body.style.overflow = "";
      editingServiceId = null;
      return true;
    }
    return false;
  }
  
  function setupServiceHandlers(tenantId) {
    const serviceDrawer = document.getElementById("serviceDrawer");
    const serviceOverlay = document.getElementById("serviceDrawerOverlay");
    const addServiceBtn = document.getElementById("addServiceBtn");
    const closeServiceDrawerBtn = document.getElementById("closeServiceDrawer");
    const cancelService = document.getElementById("cancelService");
    const saveService = document.getElementById("saveService");
    
    if (!serviceDrawer || !serviceOverlay || !addServiceBtn || !closeServiceDrawerBtn || !cancelService || !saveService) {
      console.error("Service drawer elements not found");
      return;
    }
    
    openServiceDrawer = openServiceDrawerGlobal;
    closeServiceDrawerFunc = closeServiceDrawerGlobal;
    
    addServiceBtn.addEventListener("click", () => {
      editingServiceId = null;
      
      // Ensure categories and staff are loaded
      updateCategorySelect();
      updateStaffCheckboxes();
      
      const titleEl = document.getElementById("serviceFormTitle");
      const nameEl = document.getElementById("serviceName");
      const priceEl = document.getElementById("servicePrice");
      const durationEl = document.getElementById("serviceDuration");
      const categoryEl = document.getElementById("serviceCategory");
      const descriptionEl = document.getElementById("serviceDescription");
      
      if (titleEl) titleEl.textContent = "Yeni Hizmet Ekle";
      if (nameEl) nameEl.value = "";
      if (priceEl) priceEl.value = "";
      if (durationEl) durationEl.value = "";
      if (categoryEl) categoryEl.value = "";
      if (descriptionEl) descriptionEl.value = "";
      document.querySelectorAll(".staff-checkbox").forEach(cb => cb.checked = false);
      
      openServiceDrawerGlobal();
      setTimeout(() => {
        if (nameEl) nameEl.focus();
      }, 100);
    });

    closeServiceDrawerBtn.addEventListener("click", () => {
      closeServiceDrawerGlobal();
      editingServiceId = null;
    });
    cancelService.addEventListener("click", () => {
      closeServiceDrawerGlobal();
      editingServiceId = null;
    });
    serviceOverlay.addEventListener("click", () => {
      closeServiceDrawerGlobal();
      editingServiceId = null;
    });

    if (saveService) {
      saveService.addEventListener("click", async () => {
        const nameEl = document.getElementById("serviceName");
        const priceEl = document.getElementById("servicePrice");
        const durationEl = document.getElementById("serviceDuration");
        const categoryEl = document.getElementById("serviceCategory");
        const descriptionEl = document.getElementById("serviceDescription");
        
        if (!nameEl || !priceEl || !durationEl) {
          alert("Form alanları bulunamadı!");
          return;
        }
        
        const name = nameEl.value.trim();
        const price = Number(priceEl.value);
        const duration = Number(durationEl.value);
        const categoryId = categoryEl ? categoryEl.value : "";
        const description = descriptionEl ? descriptionEl.value.trim() : "";
        const staffIds = Array.from(document.querySelectorAll(".staff-checkbox:checked")).map(cb => cb.value);

        if (!name || !price || !duration) {
          alert("Ad, fiyat ve süre alanları zorunludur!");
          return;
        }

        if (price < 0) {
          alert("Fiyat negatif olamaz!");
          return;
        }

        if (duration < 5) {
          alert("Süre en az 5 dakika olmalıdır!");
          return;
        }

        try {
          const data = {
            name,
            price,
            durationMin: duration,
            description: description || null,
            categoryId: categoryId || null,
            staffIds: staffIds.length > 0 ? staffIds : [],
            updatedAt: new Date()
          };

          if (editingServiceId) {
            await updateDoc(doc(db, "tenants", tenantId, "services", editingServiceId), data);
            alert("✅ Hizmet güncellendi!");
          } else {
            data.createdAt = new Date();
            await addDoc(collection(db, "tenants", tenantId, "services"), data);
            alert("✅ Hizmet eklendi!");
          }

          closeServiceDrawerGlobal();
          editingServiceId = null;
          await loadServicesTable(tenantId);
        } catch (e) {
          alert("Hata: " + e.message);
        }
      });
    }


    window.deleteService = async (id) => {
      if (!confirm("Bu hizmeti silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.")) {
        return;
      }
      try {
        await deleteDoc(doc(db, "tenants", tenantId, "services", id));
        alert("✅ Hizmet silindi!");
        await loadServicesTable(tenantId);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };
  }

  // Staff drawer functions (accessible globally)
  let openStaffDrawer, closeStaffDrawerFunc;
  
  function setupStaffHandlers(tenantId) {
    const staffDrawer = document.getElementById("staffDrawer");
    const staffOverlay = document.getElementById("staffDrawerOverlay");
    const addStaffBtn = document.getElementById("addStaffBtn");
    const closeStaffDrawerBtn = document.getElementById("closeStaffDrawer");
    const cancelStaff = document.getElementById("cancelStaff");
    const saveStaff = document.getElementById("saveStaff");
    
    if (!staffDrawer || !staffOverlay || !addStaffBtn || !closeStaffDrawerBtn || !cancelStaff || !saveStaff) {
      console.error("Staff drawer elements not found");
      return;
    }
    
    openStaffDrawer = openStaffDrawerGlobal;
    closeStaffDrawerFunc = () => {
      closeStaffDrawerGlobal();
      editingStaffId = null;
    };
    
    addStaffBtn.addEventListener("click", () => {
      editingStaffId = null;
      const titleEl = document.getElementById("staffFormTitle");
      const nameEl = document.getElementById("staffName");
      
      if (titleEl) titleEl.textContent = "Yeni Personel Ekle";
      if (nameEl) nameEl.value = "";
      
      openStaffDrawerGlobal();
      setTimeout(() => {
        if (nameEl) nameEl.focus();
      }, 100);
    });

    closeStaffDrawerBtn.addEventListener("click", () => {
      closeStaffDrawerGlobal();
      editingStaffId = null;
    });
    cancelStaff.addEventListener("click", () => {
      closeStaffDrawerGlobal();
      editingStaffId = null;
    });
    staffOverlay.addEventListener("click", () => {
      closeStaffDrawerGlobal();
      editingStaffId = null;
    });

    if (saveStaff) {
      saveStaff.addEventListener("click", async () => {
        const nameEl = document.getElementById("staffName");
        if (!nameEl) {
          alert("Form alanı bulunamadı!");
          return;
        }
        
        const name = nameEl.value.trim();

        if (!name) {
          alert("Ad soyad boş olamaz.");
          return;
        }

        try {
          const staffData = {
            name,
            updatedAt: new Date()
          };

          if (editingStaffId) {
            await updateDoc(doc(db, "tenants", tenantId, "staff", editingStaffId), staffData);
            alert("✅ Personel güncellendi!");
          } else {
            staffData.createdAt = new Date();
            await addDoc(collection(db, "tenants", tenantId, "staff"), staffData);
            alert("✅ Personel eklendi!");
          }

          closeStaffDrawerGlobal();
          editingStaffId = null;
          await loadStaffTable(tenantId);
          updateStaffCheckboxes();
        } catch (e) {
          alert("Hata: " + e.message);
        }
      });
    }


    window.deleteStaff = async (id) => {
      if (!confirm("Bu personeli silmek istediğinize emin misiniz?")) {
        return;
      }
      try {
        await deleteDoc(doc(db, "tenants", tenantId, "staff", id));
        await loadStaffTable(tenantId);
        updateStaffCheckboxes();
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };
  }
}
