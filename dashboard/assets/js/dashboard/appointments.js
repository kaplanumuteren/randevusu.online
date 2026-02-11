import { db, getTenantId } from "../config/firebase.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { convertTableToCards } from "./mobile-table.js";

export async function loadAppointments(container) {
  const tenantId = getTenantId();

  // Set default date range (today → +7 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  container.innerHTML = `
    <!-- Filters Bar -->
    <div class="appointments-filters">
      <div class="filters-row">
        <div class="filter-group-item">
          <label>Tarih Başlangıç</label>
          <input type="date" id="dateStart" class="filter-input" value="${today.toISOString().split('T')[0]}">
        </div>
        <div class="filter-group-item">
          <label>Tarih Bitiş</label>
          <input type="date" id="dateEnd" class="filter-input" value="${nextWeek.toISOString().split('T')[0]}">
        </div>
        <div class="filter-group-item">
          <label>Durum</label>
          <select id="statusFilter" class="filter-input">
            <option value="all">Tümü</option>
            <option value="pending">Bekliyor</option>
            <option value="confirmed">Onaylandı</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal Edildi</option>
          </select>
        </div>
        <div class="filter-group-item">
          <label>Personel</label>
          <select id="staffFilter" class="filter-input">
            <option value="all">Tümü</option>
          </select>
        </div>
        <div class="filter-group-item filter-search">
          <label>Arama</label>
          <input type="text" id="searchInput" class="filter-input" placeholder="Müşteri adı veya telefon...">
        </div>
        <div class="filter-group-item filter-actions">
          <button id="resetFilters" class="btn-secondary">Filtreleri Sıfırla</button>
        </div>
      </div>
    </div>

    <!-- Appointments Table -->
    <div class="table-wrapper">
      <table id="appointmentsTable">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Saat</th>
            <th>Müşteri</th>
            <th>Telefon</th>
            <th>Hizmet</th>
            <th>Personel</th>
            <th>Durum</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody id="appointmentsTableBody">
          <tr>
            <td colspan="8" style="text-align: center; padding: 40px; color: var(--muted);">
              Yükleniyor...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Appointment Drawer -->
    <div class="drawer-overlay" id="editAppointmentDrawerOverlay"></div>
    <div class="drawer" id="editAppointmentDrawer" style="width: 600px;">
      <div class="drawer-header">
        <h4>Randevu Düzenle</h4>
        <button class="drawer-close" id="closeEditDrawer">&times;</button>
      </div>
      <div class="drawer-body">
        <form id="editAppointmentForm">
          <div class="form-group-modern">
            <label>Müşteri Adı *</label>
            <input type="text" id="editCustomerName" required>
          </div>
          <div class="form-group-modern">
            <label>Telefon Numarası *</label>
            <input type="tel" id="editCustomerPhone" required>
          </div>
          <div class="form-group-modern">
            <label>Hizmet *</label>
            <select id="editServiceId" required>
              <option value="">Hizmet Seçin</option>
            </select>
          </div>
          <div class="form-group-modern">
            <label>Personel</label>
            <select id="editStaffId">
              <option value="">Personel Seçin</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group-modern">
              <label>Tarih *</label>
              <input type="date" id="editDate" required>
            </div>
            <div class="form-group-modern">
              <label>Saat *</label>
              <input type="time" id="editTime" required>
            </div>
          </div>
          <div class="form-group-modern">
            <label>Durum *</label>
            <select id="editStatus" required>
              <option value="pending">Bekliyor</option>
              <option value="confirmed">Onaylandı</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>
        </form>
      </div>
      <div class="drawer-footer">
        <button id="deleteAppointmentBtn" class="btn-danger">Sil</button>
        <button id="cancelEditBtn" class="btn-secondary">İptal</button>
        <button id="saveAppointmentBtn" class="btn-primary">Kaydet</button>
      </div>
    </div>
  `;

  // Load staff and services for filters
  let staffMap = {};
  let servicesMap = {};
  let allStaff = [];
  let allServices = [];

  await loadStaffAndServices(tenantId);

  // Wait for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 50));

  // Load appointments
  await loadAppointmentsList(tenantId);

  // Event listeners
  setupEventListeners(tenantId);

  async function loadStaffAndServices(tenantId) {
    try {
      // Load staff
      const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
      allStaff = [];
      staffMap = {};
      staffSnap.forEach(doc => {
        const staffData = { id: doc.id, ...doc.data() };
        allStaff.push(staffData);
        staffMap[doc.id] = staffData.name;
      });

      // Populate staff filter
      const staffFilter = document.getElementById("staffFilter");
      allStaff.forEach(staff => {
        const option = document.createElement("option");
        option.value = staff.id;
        option.textContent = staff.name;
        staffFilter.appendChild(option);
      });

      // Load services
      const servicesSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
      allServices = [];
      servicesMap = {};
      servicesSnap.forEach(doc => {
        const serviceData = { id: doc.id, ...doc.data() };
        allServices.push(serviceData);
        servicesMap[doc.id] = serviceData;
      });
    } catch (error) {
      console.error("Error loading staff and services:", error);
    }
  }

  async function loadAppointmentsList(tenantId) {
    try {
      const tbody = document.getElementById("appointmentsTableBody");
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Yükleniyor...</td></tr>';

      // Get filter values
      const dateStart = document.getElementById("dateStart").value;
      const dateEnd = document.getElementById("dateEnd").value;
      const statusFilter = document.getElementById("statusFilter").value;
      const staffFilter = document.getElementById("staffFilter").value;
      const searchInput = document.getElementById("searchInput").value.toLowerCase().trim();

      // Convert dates to Timestamp
      const startDate = new Date(dateStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateEnd);
      endDate.setHours(23, 59, 59, 999);

      // Try to build query with date range and orderBy
      // If composite index is missing, we'll catch and load all appointments
      let appointmentsSnap;
      try {
        let q = query(
          collection(db, "tenants", tenantId, "appointments"),
          where("startAt", ">=", Timestamp.fromDate(startDate)),
          where("startAt", "<=", Timestamp.fromDate(endDate)),
          orderBy("startAt", "desc")
        );
        appointmentsSnap = await getDocs(q);
      } catch (error) {
        // If composite index error, load all appointments and filter client-side
        console.warn("Composite index may be needed. Loading all appointments and filtering client-side:", error);
        appointmentsSnap = await getDocs(collection(db, "tenants", tenantId, "appointments"));
      }

      let appointments = [];

      appointmentsSnap.forEach(docSnap => {
        const apt = docSnap.data();
        const aptDate = apt.startAt?.toDate ? apt.startAt.toDate() : new Date();
        
        // Apply date range filter (if query didn't include it due to index error)
        if (aptDate < startDate || aptDate > endDate) {
          return;
        }
        
        // Apply status filter
        if (statusFilter !== "all" && apt.status !== statusFilter) {
          return;
        }

        // Apply staff filter
        if (staffFilter !== "all" && apt.staffId !== staffFilter) {
          return;
        }

        // Apply search filter
        if (searchInput) {
          const customerName = (apt.customerName || "").toLowerCase();
          const customerPhone = (apt.customerPhone || "").toLowerCase();
          if (!customerName.includes(searchInput) && !customerPhone.includes(searchInput)) {
            return;
          }
        }

        appointments.push({
          id: docSnap.id,
          ...apt,
          appointmentDate: aptDate
        });
      });

      // Sort by createdAt (newest first) if available, otherwise by startAt (newest first)
      appointments.sort((a, b) => {
        // Prefer createdAt for sorting (newest created first)
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : a.appointmentDate;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : b.appointmentDate;
        return dateB - dateA; // Newest first
      });

      if (appointments.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 40px; color: var(--muted);">
              Belirtilen filtrelere uygun randevu bulunamadı.
            </td>
          </tr>
        `;
        convertTableToCards();
        return;
      }

      // Render appointments
      tbody.innerHTML = appointments.map(apt => {
        const dateStr = apt.appointmentDate.toLocaleDateString("tr-TR");
        const timeStr = apt.appointmentDate.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        });
        
        const serviceName = apt.serviceId && servicesMap[apt.serviceId] 
          ? servicesMap[apt.serviceId].name 
          : "-";
        const staffName = apt.staffId && staffMap[apt.staffId] 
          ? staffMap[apt.staffId] 
          : "-";
        const status = apt.status || "pending";
        const statusText = getStatusText(status);
        const statusClass = `status-${status}`;

        // Action buttons based on status - use data attributes
        let actions = "";
        if (status === "pending") {
          actions = `
            <button class="btn-edit btn-small" data-appointment-id="${apt.id}" data-action="confirm">Onayla</button>
            <button class="btn-danger btn-small" data-appointment-id="${apt.id}" data-action="cancel">İptal</button>
            <button class="btn-secondary btn-small" data-appointment-id="${apt.id}" data-action="edit">Düzenle</button>
          `;
        } else if (status === "confirmed") {
          actions = `
            <button class="btn-edit btn-small" data-appointment-id="${apt.id}" data-action="complete">Tamamlandı</button>
            <button class="btn-danger btn-small" data-appointment-id="${apt.id}" data-action="cancel">İptal</button>
            <button class="btn-secondary btn-small" data-appointment-id="${apt.id}" data-action="edit">Düzenle</button>
          `;
        } else {
          // Completed or cancelled - only show edit button
          actions = `
            <button class="btn-secondary btn-small" data-appointment-id="${apt.id}" data-action="edit">Düzenle</button>
          `;
        }

        return `
          <tr>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${apt.customerName || "-"}</td>
            <td>${apt.customerPhone || "-"}</td>
            <td>${serviceName}</td>
            <td>${staffName}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td style="white-space: nowrap;" class="appointment-actions">${actions}</td>
          </tr>
        `;
      }).join('');

      convertTableToCards();
      
      // Attach event listeners to action buttons (after convertTableToCards)
      // This handles both table and card views
      setTimeout(() => {
        const allActionButtons = document.querySelectorAll('[data-appointment-id]');
        allActionButtons.forEach(btn => {
          // Remove existing listeners by cloning
          const newBtn = btn.cloneNode(true);
          btn.parentNode.replaceChild(newBtn, btn);
          
          const appointmentId = newBtn.getAttribute('data-appointment-id');
          const action = newBtn.getAttribute('data-action');
          
          newBtn.addEventListener('click', () => {
            if (action === 'edit' && window.editAppointment) {
              window.editAppointment(appointmentId, tenantId);
            } else if (action === 'confirm' && window.confirmAppointment) {
              window.confirmAppointment(appointmentId, tenantId);
            } else if (action === 'cancel' && window.cancelAppointment) {
              window.cancelAppointment(appointmentId, tenantId);
            } else if (action === 'complete' && window.completeAppointment) {
              window.completeAppointment(appointmentId, tenantId);
            }
          });
        });
      }, 150);
    } catch (error) {
      console.error("Error loading appointments:", error);
      const tbody = document.getElementById("appointmentsTableBody");
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">
            Randevular yüklenirken bir hata oluştu.
          </td>
        </tr>
      `;
    }
  }

  function setupEventListeners(tenantId) {
    // Filter change listeners
    const dateStart = document.getElementById("dateStart");
    const dateEnd = document.getElementById("dateEnd");
    const statusFilter = document.getElementById("statusFilter");
    const staffFilter = document.getElementById("staffFilter");
    const searchInput = document.getElementById("searchInput");
    const resetFilters = document.getElementById("resetFilters");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const saveAppointmentBtn = document.getElementById("saveAppointmentBtn");
    const deleteAppointmentBtn = document.getElementById("deleteAppointmentBtn");

    if (!dateStart || !dateEnd || !statusFilter || !staffFilter || !searchInput || !resetFilters) {
      console.error("Appointments: Filter elements not found");
      return;
    }

    dateStart.addEventListener("change", () => loadAppointmentsList(tenantId));
    dateEnd.addEventListener("change", () => loadAppointmentsList(tenantId));
    statusFilter.addEventListener("change", () => loadAppointmentsList(tenantId));
    staffFilter.addEventListener("change", () => loadAppointmentsList(tenantId));
    searchInput.addEventListener("input", () => loadAppointmentsList(tenantId));

    // Reset filters
    resetFilters.addEventListener("click", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      dateStart.value = today.toISOString().split('T')[0];
      dateEnd.value = nextWeek.toISOString().split('T')[0];
      statusFilter.value = "all";
      staffFilter.value = "all";
      searchInput.value = "";
      loadAppointmentsList(tenantId);
    });

    // Drawer close handlers
    const editAppointmentDrawer = document.getElementById("editAppointmentDrawer");
    const editAppointmentOverlay = document.getElementById("editAppointmentDrawerOverlay");
    const closeEditDrawer = document.getElementById("closeEditDrawer");
    
    function closeEditAppointmentDrawer() {
      if (editAppointmentDrawer) {
        editAppointmentDrawer.classList.remove("active");
      }
      if (editAppointmentOverlay) {
        editAppointmentOverlay.classList.remove("active");
      }
      document.body.style.overflow = "";
    }
    
    if (closeEditDrawer) {
      closeEditDrawer.addEventListener("click", closeEditAppointmentDrawer);
    }
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", closeEditAppointmentDrawer);
    }
    if (editAppointmentOverlay) {
      editAppointmentOverlay.addEventListener("click", closeEditAppointmentDrawer);
    }

    // Save appointment
    if (saveAppointmentBtn) {
      saveAppointmentBtn.addEventListener("click", async () => {
        await saveAppointment(tenantId);
      });
    }

    // Delete appointment
    if (deleteAppointmentBtn) {
      deleteAppointmentBtn.addEventListener("click", async () => {
        const form = document.getElementById("editAppointmentForm");
        if (form) {
          const appointmentId = form.dataset.appointmentId;
          if (appointmentId && confirm("Bu randevuyu silmek istediğinize emin misiniz?")) {
            await deleteAppointment(appointmentId, tenantId);
          }
        }
      });
    }
  }

  // Global functions for action buttons
  window.confirmAppointment = async (appointmentId, tenantId) => {
    try {
      await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
        status: "confirmed"
      });
      await loadAppointmentsList(tenantId);
    } catch (error) {
      alert("Hata: " + error.message);
    }
  };

  window.cancelAppointment = async (appointmentId, tenantId) => {
    if (!confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?")) {
      return;
    }
    try {
      await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
        status: "cancelled"
      });
      await loadAppointmentsList(tenantId);
    } catch (error) {
      alert("Hata: " + error.message);
    }
  };

  window.completeAppointment = async (appointmentId, tenantId) => {
    try {
      await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
        status: "completed"
      });
      await loadAppointmentsList(tenantId);
    } catch (error) {
      alert("Hata: " + error.message);
    }
  };

  window.editAppointment = async (appointmentId, tenantId) => {
    try {
      // Load appointment data using doc()
      const aptDoc = await getDoc(doc(db, "tenants", tenantId, "appointments", appointmentId));

      if (!aptDoc.exists()) {
        alert("Randevu bulunamadı.");
        return;
      }

      const apt = { id: appointmentId, ...aptDoc.data() };
      const aptDate = apt.startAt?.toDate ? apt.startAt.toDate() : new Date();

      // Get form elements
      const customerNameEl = document.getElementById("editCustomerName");
      const customerPhoneEl = document.getElementById("editCustomerPhone");
      const dateEl = document.getElementById("editDate");
      const timeEl = document.getElementById("editTime");
      const statusEl = document.getElementById("editStatus");
      const serviceSelect = document.getElementById("editServiceId");
      const staffSelect = document.getElementById("editStaffId");
      const formEl = document.getElementById("editAppointmentForm");

      if (!customerNameEl || !customerPhoneEl || !dateEl || !timeEl || !statusEl || !serviceSelect || !staffSelect || !formEl) {
        console.error("Edit appointment form elements not found");
        alert("Form elementleri bulunamadı. Sayfayı yenileyin.");
        return;
      }

      // Populate form
      customerNameEl.value = apt.customerName || "";
      customerPhoneEl.value = apt.customerPhone || "";
      dateEl.value = aptDate.toISOString().split('T')[0];
      timeEl.value = aptDate.toTimeString().slice(0, 5);
      statusEl.value = apt.status || "pending";

      // Populate service dropdown
      serviceSelect.innerHTML = '<option value="">Hizmet Seçin</option>';
      allServices.forEach(service => {
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = service.name;
        if (service.id === apt.serviceId) {
          option.selected = true;
        }
        serviceSelect.appendChild(option);
      });

      // Populate staff dropdown
      staffSelect.innerHTML = '<option value="">Personel Seçin</option>';
      allStaff.forEach(staff => {
        const option = document.createElement("option");
        option.value = staff.id;
        option.textContent = staff.name;
        if (staff.id === apt.staffId) {
          option.selected = true;
        }
        staffSelect.appendChild(option);
      });

      // Store appointment ID
      formEl.dataset.appointmentId = appointmentId;

      // Open drawer
      const drawer = document.getElementById("editAppointmentDrawer");
      const overlay = document.getElementById("editAppointmentDrawerOverlay");
      if (drawer && overlay) {
        drawer.classList.add("active");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
      } else {
        console.error("Edit appointment drawer elements not found");
        alert("Drawer açılamadı. Sayfayı yenileyin.");
        return;
      }
    } catch (error) {
      console.error("Error loading appointment:", error);
      alert("Randevu yüklenirken bir hata oluştu: " + error.message);
    }
  };

  async function saveAppointment(tenantId) {
    try {
      const form = document.getElementById("editAppointmentForm");
      const appointmentId = form.dataset.appointmentId;

      if (!appointmentId) {
        alert("Randevu ID bulunamadı.");
        return;
      }

      const customerName = document.getElementById("editCustomerName").value.trim();
      const customerPhone = document.getElementById("editCustomerPhone").value.trim();
      const serviceId = document.getElementById("editServiceId").value;
      const staffId = document.getElementById("editStaffId").value || null;
      const date = document.getElementById("editDate").value;
      const time = document.getElementById("editTime").value;
      const status = document.getElementById("editStatus").value;

      if (!customerName || !customerPhone || !serviceId || !date || !time) {
        alert("Lütfen tüm zorunlu alanları doldurun.");
        return;
      }

      // Combine date and time
      const dateTime = new Date(`${date}T${time}`);
      const startAt = Timestamp.fromDate(dateTime);

      // Update appointment
      await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
        customerName,
        customerPhone,
        serviceId,
        staffId,
        startAt,
        status
      });

      // Close drawer
      const drawer = document.getElementById("editAppointmentDrawer");
      const overlay = document.getElementById("editAppointmentDrawerOverlay");
      if (drawer && overlay) {
        drawer.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      }

      // Reload list
      await loadAppointmentsList(tenantId);
    } catch (error) {
      console.error("Error saving appointment:", error);
      alert("Randevu kaydedilirken bir hata oluştu: " + error.message);
    }
  }

  async function deleteAppointment(appointmentId, tenantId) {
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "appointments", appointmentId));
      const drawer = document.getElementById("editAppointmentDrawer");
      const overlay = document.getElementById("editAppointmentDrawerOverlay");
      if (drawer && overlay) {
        drawer.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      }
      await loadAppointmentsList(tenantId);
    } catch (error) {
      console.error("Error deleting appointment:", error);
      alert("Randevu silinirken bir hata oluştu: " + error.message);
    }
  }

  function getStatusText(status) {
    const statusMap = {
      pending: "Bekliyor",
      confirmed: "Onaylandı",
      completed: "Tamamlandı",
      cancelled: "İptal Edildi"
    };
    return statusMap[status] || status;
  }
}

