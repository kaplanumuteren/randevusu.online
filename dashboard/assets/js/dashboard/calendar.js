import { db, getTenantId } from "../config/firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function loadCalendar(container) {
  const tenantId = getTenantId();

  container.innerHTML = `
    <!-- Calendar Header -->
    <div class="calendar-page-header">
      <div class="calendar-nav-controls">
        <button id="prevMonth" class="calendar-nav-btn" title="Önceki Ay">←</button>
        <button id="todayBtn" class="calendar-nav-btn calendar-today-btn">Bugün</button>
        <button id="nextMonth" class="calendar-nav-btn" title="Sonraki Ay">→</button>
      </div>
      <h2 class="calendar-month-title" id="calendarMonthTitle">Kasım 2025</h2>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-container" id="calendarContainer">
      <div class="calendar-grid">
        <!-- Calendar will be rendered here -->
      </div>
    </div>

    <!-- Day Appointments Drawer (Right Side Panel) -->
    <div class="calendar-drawer" id="dayAppointmentsDrawer">
      <div class="calendar-drawer-header">
        <h3 id="drawerDateTitle">15 Kasım 2025</h3>
        <button class="calendar-drawer-close" id="closeDrawer">&times;</button>
      </div>
      <div class="calendar-drawer-body" id="drawerAppointmentsList">
        <!-- Appointments will be loaded here -->
      </div>
    </div>
    <div class="calendar-drawer-overlay" id="drawerOverlay"></div>
  `;

  let currentDate = new Date();
  let appointmentCountsCache = {}; // Cache for appointment counts by date
  let servicesCache = {};
  let staffCache = {};

  // Load services and staff cache
  async function loadCaches() {
    try {
      // Load services
      const servicesSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
      servicesCache = {};
      servicesSnap.forEach(doc => {
        servicesCache[doc.id] = doc.data();
      });

      // Load staff
      const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
      staffCache = {};
      staffSnap.forEach(doc => {
        staffCache[doc.id] = doc.data().name;
      });
    } catch (error) {
      console.error("Error loading caches:", error);
    }
  }

  // Get date key in YYYY-MM-DD format
  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if two dates are the same day
  function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  // Format month title (e.g., "Kasım 2025")
  function formatMonthTitle(date) {
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }

  // Format date for drawer title (e.g., "15 Kasım 2025")
  function formatDrawerDate(date) {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Get heatmap color class based on appointment count
  function getHeatmapClass(count) {
    if (count === 0) return '';
    if (count <= 2) return 'heatmap-light';
    return 'heatmap-heavy';
  }

  // Load appointment counts for the visible month (lightweight query)
  async function loadAppointmentCounts(year, month) {
    try {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Query for appointments in this month
      let q;
      try {
        q = query(
          collection(db, "tenants", tenantId, "appointments"),
          where("startAt", ">=", Timestamp.fromDate(monthStart)),
          where("startAt", "<=", Timestamp.fromDate(monthEnd)),
          orderBy("startAt", "asc")
        );
      } catch (error) {
        // If composite index error, load all appointments and filter client-side
        console.warn("Composite index may be needed. Loading all appointments:", error);
        q = query(collection(db, "tenants", tenantId, "appointments"));
      }

      const appointmentsSnap = await getDocs(q);
      const counts = {};

      appointmentsSnap.forEach(doc => {
        const appt = doc.data();
        const apptDate = appt.startAt?.toDate ? appt.startAt.toDate() : new Date(appt.startAt);
        const dateKey = getDateKey(apptDate);

        // Only count appointments within the month
        if (apptDate >= monthStart && apptDate <= monthEnd) {
          counts[dateKey] = (counts[dateKey] || 0) + 1;
        }
      });

      // Update cache
      Object.keys(counts).forEach(key => {
        appointmentCountsCache[key] = counts[key];
      });

      return counts;
    } catch (error) {
      console.error("Error loading appointment counts:", error);
      return {};
    }
  }

  // Render calendar grid
  async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    const calendarGrid = calendarContainer.querySelector('.calendar-grid');
    const monthTitle = document.getElementById('calendarMonthTitle');
    
    if (!calendarGrid) {
      console.error("Calendar grid not found");
      return;
    }

    monthTitle.textContent = formatMonthTitle(currentDate);

    calendarGrid.innerHTML = '<div class="calendar-loading" style="grid-column: 1 / -1; text-align: center; padding: 40px;">Yükleniyor...</div>';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Load appointment counts for this month
    const counts = await loadAppointmentCounts(year, month);

    // Calculate calendar dates
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const firstDayOfWeek = monthStart.getDay();
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0

    let html = '';

    // Day headers
    html += '<div class="calendar-day-header">Pzt</div>';
    html += '<div class="calendar-day-header">Sal</div>';
    html += '<div class="calendar-day-header">Çar</div>';
    html += '<div class="calendar-day-header">Per</div>';
    html += '<div class="calendar-day-header">Cum</div>';
    html += '<div class="calendar-day-header">Cmt</div>';
    html += '<div class="calendar-day-header">Paz</div>';

    // Previous month's trailing days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - (i + 1));
      const dateKey = getDateKey(date);
      const count = counts[dateKey] || 0;
      const heatmapClass = getHeatmapClass(count);

      html += `
        <div class="calendar-day calendar-day-other ${heatmapClass}" data-date="${dateKey}">
          <div class="calendar-day-number">${date.getDate()}</div>
          ${count > 0 ? `<div class="calendar-day-count">${count}</div>` : ''}
        </div>
      `;
    }

    // Current month's days
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateKey = getDateKey(date);
      const isToday = isSameDay(date, new Date());
      const count = counts[dateKey] || 0;
      const heatmapClass = getHeatmapClass(count);

      html += `
        <div class="calendar-day ${isToday ? 'calendar-day-today' : ''} ${heatmapClass}" data-date="${dateKey}">
          <div class="calendar-day-number">${day}</div>
          ${count > 0 ? `<div class="calendar-day-count">${count}</div>` : ''}
        </div>
      `;
    }

    // Next month's leading days (to fill the grid)
    const totalCells = adjustedFirstDay + monthEnd.getDate();
    const remainingCells = 42 - totalCells; // 6 rows * 7 days = 42 cells

    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      const dateKey = getDateKey(date);
      const count = counts[dateKey] || 0;
      const heatmapClass = getHeatmapClass(count);

      html += `
        <div class="calendar-day calendar-day-other ${heatmapClass}" data-date="${dateKey}">
          <div class="calendar-day-number">${i}</div>
          ${count > 0 ? `<div class="calendar-day-count">${count}</div>` : ''}
        </div>
      `;
    }

    calendarGrid.innerHTML = html;

    // Add click listeners to day cells
    calendarGrid.querySelectorAll('.calendar-day').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateKey = dayEl.dataset.date;
        openDrawer(dateKey);
      });
    });
  }

  // Open drawer with appointments for a specific day
  async function openDrawer(dateKey) {
    const drawer = document.getElementById('dayAppointmentsDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const drawerTitle = document.getElementById('drawerDateTitle');
    const appointmentsList = document.getElementById('drawerAppointmentsList');

    // Parse date
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    drawerTitle.textContent = formatDrawerDate(date);

    // Show drawer
    drawer.classList.add('active');
    overlay.classList.add('active');

    // Load appointments for this day
    appointmentsList.innerHTML = '<div class="calendar-loading">Yükleniyor...</div>';

    try {
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

      let q;
      try {
        q = query(
          collection(db, "tenants", tenantId, "appointments"),
          where("startAt", ">=", Timestamp.fromDate(dayStart)),
          where("startAt", "<=", Timestamp.fromDate(dayEnd)),
          orderBy("startAt", "asc")
        );
      } catch (error) {
        // Fallback if composite index is missing
        q = query(collection(db, "tenants", tenantId, "appointments"));
      }

      const appointmentsSnap = await getDocs(q);
      let appointments = [];

      appointmentsSnap.forEach(docSnap => {
        const appt = docSnap.data();
        const apptDate = appt.startAt?.toDate ? appt.startAt.toDate() : new Date(appt.startAt);

        // Filter by day (if query didn't include it)
        if (apptDate >= dayStart && apptDate <= dayEnd) {
          appointments.push({
            id: docSnap.id,
            ...appt,
            appointmentDate: apptDate
          });
        }
      });

      // Sort by time
      appointments.sort((a, b) => a.appointmentDate - b.appointmentDate);

      if (appointments.length === 0) {
        appointmentsList.innerHTML = `
          <div class="calendar-drawer-empty">
            <p>Bu gün için randevu bulunmuyor.</p>
          </div>
        `;
        return;
      }

      // Ensure caches are loaded
      if (Object.keys(servicesCache).length === 0 || Object.keys(staffCache).length === 0) {
        await loadCaches();
      }

      // Render appointments
      appointmentsList.innerHTML = appointments.map(apt => {
        const timeStr = apt.appointmentDate.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        });

        const serviceName = apt.serviceId && servicesCache[apt.serviceId]
          ? servicesCache[apt.serviceId].name
          : "-";

        const status = apt.status || "pending";
        const statusText = getStatusText(status);
        const statusClass = `status-${status}`;

        // Action buttons based on status
        let actions = "";
        if (status === "pending") {
          actions = `
            <button class="btn-action btn-confirm" onclick="handleCalendarAction('${apt.id}', 'confirmed', '${tenantId}', '${dateKey}')">Onayla</button>
            <button class="btn-action btn-cancel" onclick="handleCalendarAction('${apt.id}', 'cancelled', '${tenantId}', '${dateKey}')">İptal</button>
          `;
        } else if (status === "confirmed") {
          actions = `
            <button class="btn-action btn-complete" onclick="handleCalendarAction('${apt.id}', 'completed', '${tenantId}', '${dateKey}')">Tamamlandı</button>
            <button class="btn-action btn-cancel" onclick="handleCalendarAction('${apt.id}', 'cancelled', '${tenantId}', '${dateKey}')">İptal</button>
          `;
        } else {
          // Completed or cancelled - no actions
          actions = `<span class="status-badge ${statusClass}">${statusText}</span>`;
        }

        return `
          <div class="calendar-appointment-item">
            <div class="calendar-appointment-time">${timeStr}</div>
            <div class="calendar-appointment-details">
              <div class="calendar-appointment-customer">${apt.customerName || "-"}</div>
              <div class="calendar-appointment-service">${serviceName}</div>
            </div>
            <div class="calendar-appointment-actions">
              ${actions}
            </div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error("Error loading appointments:", error);
      appointmentsList.innerHTML = `
        <div class="calendar-drawer-empty">
          <p>Randevular yüklenirken bir hata oluştu.</p>
        </div>
      `;
    }
  }

  // Close drawer
  function closeDrawer() {
    const drawer = document.getElementById('dayAppointmentsDrawer');
    const overlay = document.getElementById('drawerOverlay');
    drawer.classList.remove('active');
    overlay.classList.remove('active');
  }

  // Handle appointment action (confirm, complete, cancel)
  window.handleCalendarAction = async (appointmentId, newStatus, tenantId, dateKey) => {
    try {
      if (newStatus === "cancelled") {
        if (!confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?")) {
          return;
        }
      }

      await updateDoc(doc(db, "tenants", tenantId, "appointments", appointmentId), {
        status: newStatus
      });

      // Reload drawer and calendar
      await openDrawer(dateKey);
      await renderCalendar();
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Randevu güncellenirken bir hata oluştu: " + error.message);
    }
  };

  // Get status text
  function getStatusText(status) {
    const statusMap = {
      pending: "Bekliyor",
      confirmed: "Onaylandı",
      completed: "Tamamlandı",
      cancelled: "İptal Edildi"
    };
    return statusMap[status] || status;
  }

  // Event listeners
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    currentDate = new Date();
    renderCalendar();
  });

  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
  document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

  // Initialize
  await loadCaches();
  await renderCalendar();
}
