import { db, getTenantId } from "../config/firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { convertTableToCards } from "./mobile-table.js";

export async function loadServices(container) {
  const tenantId = getTenantId();

  container.innerHTML = `
    <div class="page-header">
      <h3>💇 Hizmetler</h3>
      <button id="addServiceBtn" class="btn-primary">+ Yeni Hizmet</button>
    </div>

    <!-- Categories Section -->
    <div class="modern-card" style="margin-bottom: 30px;">
      <div class="card-header">
        <h3>📂 Kategoriler</h3>
        <button id="addCategoryBtn" class="btn-primary btn-small">+ Yeni Kategori</button>
      </div>
      <div id="categoriesList" class="category-tags">
        <div class="loading">Kategoriler yükleniyor...</div>
      </div>
    </div>

    <!-- Services Table -->
    <div class="modern-card">
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

    <!-- Category Modal -->
    <div class="modal-overlay" id="categoryModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h4 id="categoryFormTitle">Yeni Kategori Ekle</h4>
          <button class="modal-close" id="closeCategoryModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group-modern">
            <label>Kategori Adı</label>
            <input type="text" id="catName" placeholder="Örn: Saç Hizmetleri" autofocus>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancelCategory" class="btn-secondary">İptal</button>
          <button id="saveCategory" class="btn-primary">Kaydet</button>
        </div>
      </div>
    </div>

    <!-- Service Modal -->
    <div class="modal-overlay" id="serviceModalOverlay">
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">
          <h4 id="formTitle">Yeni Hizmet Ekle</h4>
          <button class="modal-close" id="closeServiceModal">&times;</button>
        </div>
        <div class="modal-body">
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
        <div class="modal-footer">
          <button id="cancelService" class="btn-secondary">İptal</button>
          <button id="saveService" class="btn-primary">Kaydet</button>
        </div>
      </div>
    </div>
  `;

  // Variables
  const categoryModal = document.getElementById("categoryModalOverlay");
  const serviceModal = document.getElementById("serviceModalOverlay");
  const tableEl = document.getElementById("servicesTable");
  let editingId = null;
  let editingCategoryId = null;
  let allCategories = [];
  let allStaff = [];

  // Modal close handlers
  function closeCategoryModal() {
    categoryModal.classList.remove("active");
    editingCategoryId = null;
  }

  function closeServiceModal() {
    serviceModal.classList.remove("active");
    editingId = null;
  }

  document.getElementById("closeCategoryModal").addEventListener("click", closeCategoryModal);
  document.getElementById("closeServiceModal").addEventListener("click", closeServiceModal);
  categoryModal.addEventListener("click", (e) => {
    if (e.target === categoryModal) closeCategoryModal();
  });
  serviceModal.addEventListener("click", (e) => {
    if (e.target === serviceModal) closeServiceModal();
  });

  // Load Categories
  async function loadCategories() {
    const categoriesSnap = await getDocs(collection(db, "tenants", tenantId, "categories"));
    allCategories = [];
    categoriesSnap.forEach(doc => allCategories.push({ id: doc.id, ...doc.data() }));
    displayCategories();
    updateCategorySelect();
  }

  function displayCategories() {
    const listEl = document.getElementById("categoriesList");
    if (allCategories.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="width: 100%; padding: 20px; text-align: center; color: var(--muted);">Henüz kategori eklenmemiş.</div>';
      return;
    }
    listEl.innerHTML = allCategories.map(cat => `
      <div class="category-tag">
        <span>${cat.name}</span>
        <button onclick="editCategory('${cat.id}')" title="Düzenle">✏️</button>
        <button onclick="deleteCategory('${cat.id}')" title="Sil">🗑️</button>
      </div>
    `).join('');
  }

  function updateCategorySelect() {
    const select = document.getElementById("serviceCategory");
    select.innerHTML = '<option value="">Kategori Seçin (İsteğe Bağlı)</option>';
    allCategories.forEach(cat => {
      select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }

  // Load Staff
  async function loadStaff() {
    const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
    allStaff = [];
    staffSnap.forEach(doc => allStaff.push({ id: doc.id, ...doc.data() }));
    updateStaffCheckboxes();
  }

  function updateStaffCheckboxes() {
    const box = document.getElementById("staffCheckboxes");
    if (allStaff.length === 0) {
      box.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--muted);">Henüz personel eklenmemiş. Personel eklemek için Personel menüsüne gidin.</div>';
      return;
    }
    box.innerHTML = allStaff.map(staff => `
      <div class="staff-checkbox-item">
        <input type="checkbox" value="${staff.id}" class="staff-checkbox" id="staff-${staff.id}">
        <label for="staff-${staff.id}">${staff.name}</label>
      </div>
    `).join('');
  }

  await loadCategories();
  await loadStaff();

  // Category Buttons
  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    editingCategoryId = null;
    document.getElementById("categoryFormTitle").textContent = "Yeni Kategori Ekle";
    document.getElementById("catName").value = "";
    categoryModal.classList.add("active");
    setTimeout(() => document.getElementById("catName").focus(), 100);
  });

  document.getElementById("cancelCategory").addEventListener("click", closeCategoryModal);

  document.getElementById("saveCategory").addEventListener("click", async () => {
    const name = document.getElementById("catName").value.trim();
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
      closeCategoryModal();
      await loadCategories();
    } catch (e) {
      alert("Hata: " + e.message);
    }
  });

  // Service Buttons
  document.getElementById("addServiceBtn").addEventListener("click", () => {
    editingId = null;
    document.getElementById("formTitle").textContent = "Yeni Hizmet Ekle";
    document.getElementById("serviceName").value = "";
    document.getElementById("servicePrice").value = "";
    document.getElementById("serviceDuration").value = "";
    document.getElementById("serviceCategory").value = "";
    document.getElementById("serviceDescription").value = "";
    document.querySelectorAll(".staff-checkbox").forEach(cb => cb.checked = false);
    serviceModal.classList.add("active");
    setTimeout(() => document.getElementById("serviceName").focus(), 100);
  });

  document.getElementById("cancelService").addEventListener("click", closeServiceModal);

  // Save Service
  document.getElementById("saveService").addEventListener("click", async () => {
    const name = document.getElementById("serviceName").value.trim();
    const price = Number(document.getElementById("servicePrice").value);
    const duration = Number(document.getElementById("serviceDuration").value);
    const categoryId = document.getElementById("serviceCategory").value;
    const description = document.getElementById("serviceDescription").value.trim();
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

      if (editingId) {
        await updateDoc(doc(db, "tenants", tenantId, "services", editingId), data);
        alert("✅ Hizmet güncellendi!");
      } else {
        data.createdAt = new Date();
        await addDoc(collection(db, "tenants", tenantId, "services"), data);
        alert("✅ Hizmet eklendi!");
      }

      closeServiceModal();
      await loadServicesTable();
    } catch (e) {
      alert("Hata: " + e.message);
    }
  });

  // Load Services Table
  async function loadServicesTable() {
    const snap = await getDocs(collection(db, "tenants", tenantId, "services"));
    const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
    const staffMap = Object.fromEntries(allStaff.map(s => [s.id, s.name]));

    if (snap.empty) {
      tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding: 40px;">Henüz hizmet yok. Yeni hizmet eklemek için yukarıdaki butona tıklayın.</td></tr>`;
      return;
    }

    tableEl.innerHTML = snap.docs.map(docSnap => {
      const s = docSnap.data();
      const staffNames = (s.staffIds || []).length > 0
        ? (s.staffIds || []).map(id => staffMap[id] || id).join(", ")
        : "Tüm personeller";
      return `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.categoryId ? (catMap[s.categoryId] || '-') : '<span style="color: var(--muted);">Kategori yok</span>'}</td>
          <td><small style="color: var(--muted);">${staffNames}</small></td>
          <td>${s.durationMin || 0} dk</td>
          <td><strong style="color: var(--accent);">${s.price.toFixed(2)} ₺</strong></td>
          <td style="white-space: nowrap;">
            <button class="btn-edit btn-small" onclick="editService('${docSnap.id}')">Düzenle</button>
            <button class="btn-danger btn-small" onclick="deleteService('${docSnap.id}')">Sil</button>
          </td>
        </tr>
      `;
    }).join('');

    setTimeout(() => {
      convertTableToCards();
    }, 100);
  }

  // Global Functions
  window.editCategory = async (id) => {
    try {
      const catDoc = await getDoc(doc(db, "tenants", tenantId, "categories", id));
      if (catDoc.exists()) {
        editingCategoryId = id;
        document.getElementById("categoryFormTitle").textContent = "Kategori Düzenle";
        document.getElementById("catName").value = catDoc.data().name || "";
        categoryModal.classList.add("active");
        setTimeout(() => document.getElementById("catName").focus(), 100);
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
      await loadCategories();
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  window.editService = async (id) => {
    try {
      const serviceDoc = await getDoc(doc(db, "tenants", tenantId, "services", id));
      if (serviceDoc.exists()) {
        const data = serviceDoc.data();
        editingId = id;
        document.getElementById("formTitle").textContent = "Hizmet Düzenle";
        document.getElementById("serviceName").value = data.name || "";
        document.getElementById("servicePrice").value = data.price || "";
        document.getElementById("serviceDuration").value = data.durationMin || "";
        document.getElementById("serviceCategory").value = data.categoryId || "";
        document.getElementById("serviceDescription").value = data.description || "";
        
        document.querySelectorAll(".staff-checkbox").forEach(cb => {
          cb.checked = data.staffIds && data.staffIds.includes(cb.value);
        });
        
        serviceModal.classList.add("active");
        setTimeout(() => document.getElementById("serviceName").focus(), 100);
      }
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  window.deleteService = async (id) => {
    if (!confirm("Bu hizmeti silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "services", id));
      alert("✅ Hizmet silindi!");
      await loadServicesTable();
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  // Initial load
  await loadServicesTable();
}
