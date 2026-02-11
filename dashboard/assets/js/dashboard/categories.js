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

export async function loadCategories(container) {
  const tenantId = getTenantId();
  
  container.innerHTML = `
    <div class="page-header">
      <h3>📂 Hizmet Kategorileri</h3>
      <button id="addCategoryBtn" class="btn-primary">+ Yeni Kategori</button>
    </div>

    <div id="addCategoryForm" class="form-popup" style="display:none;">
      <h4 id="formTitle">Yeni Kategori Ekle</h4>
      <div class="form-group">
        <label>Kategori Adı</label>
        <input type="text" id="catName" placeholder="Örn: Saç Hizmetleri">
      </div>
      <div class="form-group">
        <label>Açıklama (isteğe bağlı)</label>
        <textarea id="catDescription" rows="2" placeholder="Kategori açıklaması"></textarea>
      </div>
      <div class="form-actions">
        <button id="saveCategory" class="btn-primary">Kaydet</button>
        <button id="cancelCategory" class="btn-secondary">İptal</button>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Kategori Adı</th>
            <th>Açıklama</th>
            <th>Oluşturulma</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="catTable"></tbody>
      </table>
    </div>
  `;

  const formEl = document.getElementById("addCategoryForm");
  const tableEl = document.getElementById("catTable");
  let editingId = null;

  document.getElementById("addCategoryBtn").onclick = () => {
    editingId = null;
    document.getElementById("formTitle").textContent = "Yeni Kategori Ekle";
    formEl.style.display = formEl.style.display === "none" ? "block" : "none";
    document.getElementById("catName").value = "";
    document.getElementById("catDescription").value = "";
  };

  document.getElementById("cancelCategory").onclick = () => {
    formEl.style.display = "none";
    editingId = null;
  };

  document.getElementById("saveCategory").onclick = async () => {
    const name = document.getElementById("catName").value.trim();
    const description = document.getElementById("catDescription").value.trim();

    if (!name) {
      alert("Kategori adı boş olamaz.");
      return;
    }

    try {
      const categoryData = {
        name,
        description: description || null,
        updatedAt: new Date()
      };

      if (editingId) {
        await updateDoc(doc(db, "tenants", tenantId, "categories", editingId), categoryData);
        alert("✅ Kategori güncellendi!");
      } else {
        categoryData.createdAt = new Date();
        await addDoc(collection(db, "tenants", tenantId, "categories"), categoryData);
        alert("✅ Kategori eklendi!");
      }

      formEl.style.display = "none";
      editingId = null;
      loadCategories(container);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  try {
    const snap = await getDocs(collection(db, "tenants", tenantId, "categories"));
    tableEl.innerHTML = "";

    if (snap.empty) {
      tableEl.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted);">Henüz kategori eklenmemiş.</td></tr>`;
      return;
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString("tr-TR") : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${data.name}</strong></td>
        <td>${data.description || '-'}</td>
        <td>${createdAt}</td>
        <td>
          <button class="btn-edit" onclick="editCategory('${docSnap.id}')">Düzenle</button>
          <button class="btn-danger btn-small" onclick="deleteCategory('${docSnap.id}')">Sil</button>
        </td>
      `;
      tableEl.appendChild(tr);
    });

    // Make functions available globally
    window.editCategory = async (id) => {
      try {
        const categoryDoc = await getDoc(doc(db, "tenants", tenantId, "categories", id));
        if (categoryDoc.exists()) {
          const data = categoryDoc.data();
          editingId = id;
          document.getElementById("formTitle").textContent = "Kategori Düzenle";
          document.getElementById("catName").value = data.name || "";
          document.getElementById("catDescription").value = data.description || "";
          formEl.style.display = "block";
        }
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };

    window.deleteCategory = async (id) => {
      if (confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) {
        try {
          await deleteDoc(doc(db, "tenants", tenantId, "categories", id));
          loadCategories(container);
        } catch (e) {
          alert("Hata: " + e.message);
        }
      }
    };
  } catch (e) {
    tableEl.innerHTML = `<tr><td colspan="4" class="error">Kategoriler yüklenirken bir hata oluştu.</td></tr>`;
    console.error("Categories load error:", e);
  }
}

