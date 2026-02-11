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

export async function loadStaff(container) {
  const tenantId = getTenantId();
  
  container.innerHTML = `
    <div class="page-header">
      <h3>👤 Personel Yönetimi</h3>
      <button id="addStaffBtn" class="btn-primary">+ Yeni Personel</button>
    </div>

    <div id="addStaffForm" class="form-popup" style="display:none;">
      <h4 id="formTitle">Yeni Personel Ekle</h4>
      <div class="form-group">
        <label>Ad Soyad</label>
        <input type="text" id="staffName" placeholder="Örn: Ahmet Yılmaz">
      </div>
      <div class="form-actions">
        <button id="saveStaff" class="btn-primary">Kaydet</button>
        <button id="cancelStaff" class="btn-secondary">İptal</button>
      </div>
    </div>

    <div class="table-wrapper">
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
  `;

  const formEl = document.getElementById("addStaffForm");
  const tableEl = document.getElementById("staffTable");
  let editingId = null;

  document.getElementById("addStaffBtn").onclick = () => {
    editingId = null;
    document.getElementById("formTitle").textContent = "Yeni Personel Ekle";
    formEl.style.display = formEl.style.display === "none" ? "block" : "none";
    document.getElementById("staffName").value = "";
  };

  document.getElementById("cancelStaff").onclick = () => {
    formEl.style.display = "none";
    editingId = null;
  };

  document.getElementById("saveStaff").onclick = async () => {
    const name = document.getElementById("staffName").value.trim();

    if (!name) {
      alert("Ad soyad boş olamaz.");
      return;
    }

    try {
      const staffData = {
        name,
        updatedAt: new Date()
      };

      if (editingId) {
        await updateDoc(doc(db, "tenants", tenantId, "staff", editingId), staffData);
        alert("✅ Personel güncellendi!");
      } else {
        staffData.createdAt = new Date();
        await addDoc(collection(db, "tenants", tenantId, "staff"), staffData);
        alert("✅ Personel eklendi!");
      }

      formEl.style.display = "none";
      editingId = null;
      loadStaff(container);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  try {
    const snap = await getDocs(collection(db, "tenants", tenantId, "staff"));
    tableEl.innerHTML = "";

    if (snap.empty) {
      tableEl.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--muted);">Henüz personel eklenmemiş.</td></tr>`;
      return;
    }

    snap.forEach((docSnap) => {
      const s = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td>
          <button class="btn-edit" onclick="editStaff('${docSnap.id}')">Düzenle</button>
          <button class="btn-danger btn-small" onclick="deleteStaff('${docSnap.id}')">Sil</button>
        </td>
      `;
      tableEl.appendChild(tr);
    });

    // Make functions available globally
    window.editStaff = async (id) => {
      try {
        const staffDoc = await getDoc(doc(db, "tenants", tenantId, "staff", id));
        if (staffDoc.exists()) {
          const data = staffDoc.data();
          editingId = id;
          document.getElementById("formTitle").textContent = "Personel Düzenle";
          document.getElementById("staffName").value = data.name || "";
          formEl.style.display = "block";
        }
      } catch (e) {
        alert("Hata: " + e.message);
      }
    };

    window.deleteStaff = async (id) => {
      if (confirm("Bu personeli silmek istediğinize emin misiniz?")) {
        try {
          await deleteDoc(doc(db, "tenants", tenantId, "staff", id));
          loadStaff(container);
        } catch (e) {
          alert("Hata: " + e.message);
        }
      }
    };

    // Convert table to cards on mobile
    setTimeout(() => {
      convertTableToCards();
    }, 100);
  } catch (e) {
    tableEl.innerHTML = `<tr><td colspan="2" class="error">Personel yüklenirken bir hata oluştu.</td></tr>`;
    console.error("Staff load error:", e);
  }
}
