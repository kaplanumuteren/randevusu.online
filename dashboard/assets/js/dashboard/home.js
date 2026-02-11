import { db, getTenantId } from "../config/firebase.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function loadHome(container) {
  const tenantId = getTenantId();
  
  container.innerHTML = `
    <!-- Statistics Cards -->
    <div class="stats-grid">
      <!-- Row 1: Kalan, Tamamlanan -->
      <div class="stat-card stat-warning">
        <div class="stat-icon">⏳</div>
        <div class="stat-content">
          <div class="stat-label">Kalan</div>
          <div class="stat-value" id="todayRemaining">-</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">Tamamlanan</div>
          <div class="stat-value" id="todayCompleted">-</div>
        </div>
      </div>
      <!-- Row 2: Toplam, Kazanç -->
      <div class="stat-card stat-primary">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">Toplam</div>
          <div class="stat-value" id="todayTotal">-</div>
        </div>
      </div>
      <div class="stat-card stat-info">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-label">Kazanç</div>
          <div class="stat-value" id="todayEarnings">-</div>
        </div>
      </div>
    </div>

    <!-- Today's Appointments -->
    <div class="home-main-row">
      <div class="home-appointments-column">
        <div class="modern-card">
          <div class="card-header">
            <h3>Bugünkü Randevular</h3>
          </div>
          <div class="today-appointments-list" id="todayAppointmentsList">
            <div style="text-align: center; padding: 40px; color: var(--muted);">
              <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
              <div>Yükleniyor...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load today's statistics and appointments
  await loadStatistics(tenantId);
  await loadTodayAppointments(tenantId);
}

async function loadStatistics(tenantId) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Load all appointments
    const appointmentsSnap = await getDocs(
      collection(db, "tenants", tenantId, "appointments")
    );

    // Load services for earnings calculation
    const servicesMap = {};
    const servicesSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
    servicesSnap.forEach(doc => {
      servicesMap[doc.id] = doc.data();
    });

    let todayTotal = 0;
    let todayRemaining = 0;
    let todayCompleted = 0;
    let todayEarnings = 0;

    appointmentsSnap.forEach(docSnap => {
      const apt = docSnap.data();
      const aptDate = apt.startAt?.toDate ? apt.startAt.toDate() : new Date(apt.createdAt?.toDate ? apt.createdAt.toDate() : new Date());
      
      // Today's appointments
      if (aptDate >= todayStart && aptDate < todayEnd) {
        todayTotal++;
        if (apt.status === "completed") {
          todayCompleted++;
          // Calculate earnings for completed appointments
          if (apt.serviceId && servicesMap[apt.serviceId]) {
            todayEarnings += servicesMap[apt.serviceId].price || 0;
          }
        } else if (apt.status === "pending" || apt.status === "confirmed") {
          todayRemaining++;
        }
      }
    });

    document.getElementById("todayTotal").textContent = todayTotal;
    document.getElementById("todayRemaining").textContent = todayRemaining;
    document.getElementById("todayCompleted").textContent = todayCompleted;
    document.getElementById("todayEarnings").textContent = `${todayEarnings.toFixed(2)} ₺`;
  } catch (error) {
    console.error("Statistics load error:", error);
  }
}

// Load today's appointments
async function loadTodayAppointments(tenantId) {
  try {
    const listContainer = document.getElementById("todayAppointmentsList");
    if (!listContainer) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Load appointments
    const appointmentsSnap = await getDocs(
      collection(db, "tenants", tenantId, "appointments")
    );

    // Load staff and services
    const staffMap = {};
    const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
    staffSnap.forEach(doc => {
      staffMap[doc.id] = doc.data().name;
    });

    const servicesMap = {};
    const servicesSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
    servicesSnap.forEach(doc => {
      servicesMap[doc.id] = doc.data();
    });

    const appointments = [];
    appointmentsSnap.forEach(docSnap => {
      const apt = docSnap.data();
      const aptDate = apt.startAt?.toDate ? apt.startAt.toDate() : new Date();
      
      // Only show pending and confirmed appointments (operational queue)
      // Completed/cancelled appointments are removed from the queue permanently
      if (aptDate >= todayStart && aptDate < todayEnd) {
        const status = apt.status || 'pending';
        // Only include pending and confirmed appointments
        if (status === 'pending' || status === 'confirmed') {
          appointments.push({
            id: docSnap.id,
            ...apt,
            appointmentDate: aptDate
          });
        }
      }
    });

    // Sort by time (earliest first)
    appointments.sort((a, b) => {
      const timeA = a.appointmentDate.getHours() * 60 + a.appointmentDate.getMinutes();
      const timeB = b.appointmentDate.getHours() * 60 + b.appointmentDate.getMinutes();
      return timeA - timeB;
    });

    if (appointments.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
          <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Bugün randevu yok</div>
          <div style="font-size: 14px;">Bugün için kayıtlı randevu bulunmamaktadır.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = appointments.map(apt => {
      const timeStr = apt.appointmentDate.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      });
      
      const serviceName = apt.serviceId && servicesMap[apt.serviceId] 
        ? servicesMap[apt.serviceId].name 
        : "-";
      const customerName = apt.customerName || "-";
      const staffName = apt.staffId && staffMap[apt.staffId] 
        ? staffMap[apt.staffId] 
        : "-";
      
      // Single action button based on status
      let actionButton = "";
      if (apt.status === "pending") {
        actionButton = `<button class="btn-action btn-confirm" onclick="handleAppointmentAction('${apt.id}', 'confirmed', '${tenantId}')">Onayla</button>`;
      } else if (apt.status === "confirmed") {
        actionButton = `<button class="btn-action btn-complete" onclick="handleAppointmentAction('${apt.id}', 'completed', '${tenantId}')">Tamamlandı</button>`;
      }

      return `
        <div class="today-appointment-item" data-appointment-id="${apt.id}" data-status="${apt.status || 'pending'}">
          <div class="today-appointment-time">${timeStr}</div>
          <div class="today-appointment-details">
            <div class="today-appointment-service">${serviceName}</div>
            <div class="today-appointment-meta">
              <span class="today-appointment-staff">${staffName}</span>
              <span class="today-appointment-customer">${customerName}</span>
            </div>
          </div>
          <div class="today-appointment-action">
            ${actionButton}
          </div>
        </div>
      `;
    }).join('');

    // Global function to handle appointment actions with animation
    window.handleAppointmentAction = async (appointmentId, newStatus, tenantId) => {
      const appointmentItem = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
      if (!appointmentItem) return;

      try {
        // Update status in database
        await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
          status: newStatus
        });

        // Animate removal for all status changes (operational workflow)
        // When "Onayla" is pressed (pending → confirmed), button changes to "Tamamlandı"
        // When "Tamamlandı" is pressed (confirmed → completed), item is removed with animation
        
        if (newStatus === "completed") {
          // Completed: animate removal with fade-out + slide-down
          const itemHeight = appointmentItem.offsetHeight;
          appointmentItem.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
          appointmentItem.style.opacity = '0';
          appointmentItem.style.transform = 'translateY(-20px)';
          appointmentItem.style.maxHeight = itemHeight + 'px';
          appointmentItem.style.overflow = 'hidden';
          
          // Force reflow to start animation
          void appointmentItem.offsetHeight;
          
          // Start collapse animation
          appointmentItem.style.maxHeight = '0';
          appointmentItem.style.paddingTop = '0';
          appointmentItem.style.paddingBottom = '0';
          appointmentItem.style.marginBottom = '0';
          appointmentItem.style.borderBottom = 'none';
          
          // Wait for animation to complete, then remove and reload
          setTimeout(async () => {
            if (appointmentItem.parentNode) {
              appointmentItem.remove();
            }
            
            // Update statistics
            await loadStatistics(tenantId);
            
            // Reload appointments list
            await loadTodayAppointments(tenantId);
          }, 400);
        } else if (newStatus === "confirmed") {
          // Confirmed: Update button in place (smooth transition)
          // Reload to show "Tamamlandı" button
          await loadStatistics(tenantId);
          await loadTodayAppointments(tenantId);
        }
        
      } catch (e) {
        console.error("Error updating appointment:", e);
        alert("Hata: " + e.message);
      }
    };
  } catch (error) {
    console.error("Today appointments load error:", error);
    const listContainer = document.getElementById("todayAppointmentsList");
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--error);">
          Veriler yüklenirken bir hata oluştu.
        </div>
      `;
    }
  }
}

