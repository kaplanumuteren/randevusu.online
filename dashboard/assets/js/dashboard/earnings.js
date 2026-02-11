import { db, getTenantId } from "../config/firebase.js";
import {
  collection,
  getDocs,
  where,
  orderBy,
  query,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { convertTableToCards } from "./mobile-table.js";

export async function loadEarnings(container) {
  const tenantId = getTenantId();

  container.innerHTML = `
    <!-- Filter Bar -->
    <div class="earnings-filters">
      <div class="earnings-filters-row">
        <div class="filter-group-item">
          <label>Tarih Aralığı</label>
          <select id="dateRangeFilter" class="filter-input">
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month" selected>Bu Ay</option>
            <option value="last30">Son 30 Gün</option>
            <option value="custom">Özel</option>
          </select>
        </div>
        <div class="filter-group-item" id="customDateRange" style="display: none;">
          <label>Başlangıç</label>
          <input type="date" id="customStartDate" class="filter-input">
        </div>
        <div class="filter-group-item" id="customDateRangeEnd" style="display: none;">
          <label>Bitiş</label>
          <input type="date" id="customEndDate" class="filter-input">
        </div>
        <div class="filter-group-item">
          <label>Personel</label>
          <select id="staffFilter" class="filter-input">
            <option value="all">Tümü</option>
          </select>
        </div>
        <div class="filter-group-item">
          <label>Hizmet</label>
          <select id="serviceFilter" class="filter-input">
            <option value="all">Tümü</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Stat Cards (KPI) -->
    <div class="earnings-stats-grid">
      <div class="stat-card stat-success">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-label">Toplam Kazanç</div>
          <div class="stat-value" id="totalEarnings">-</div>
        </div>
      </div>
      <div class="stat-card stat-info">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">Tamamlanan Randevu</div>
          <div class="stat-value" id="completedCount">-</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">Ortalama Fiyat</div>
          <div class="stat-value" id="averagePrice">-</div>
        </div>
      </div>
      <div class="stat-card stat-secondary">
        <div class="stat-icon">⭐</div>
        <div class="stat-content">
          <div class="stat-label">En Çok Kazandıran Hizmet</div>
          <div class="stat-value" id="topService">-</div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="earnings-charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <h3>Zaman İçinde Kazanç</h3>
        </div>
        <div class="chart-container">
          <canvas id="earningsBarChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <h3>Hizmetlere Göre Kazanç Dağılımı</h3>
        </div>
        <div class="chart-container">
          <canvas id="earningsDonutChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Detailed Report Table -->
    <div class="table-wrapper">
      <h3>Detaylı Rapor</h3>
      <table id="earningsTable">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Saat</th>
            <th>Müşteri</th>
            <th>Hizmet</th>
            <th>Fiyat</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody id="earningsTableBody">
          <tr>
            <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted);">
              Yükleniyor...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Appointment Details Drawer -->
    <div class="calendar-drawer" id="earningsAppointmentDrawer">
      <div class="calendar-drawer-header">
        <h3>Randevu Detayları</h3>
        <button class="calendar-drawer-close" id="closeEarningsDrawer">&times;</button>
      </div>
      <div class="calendar-drawer-body" id="earningsAppointmentDetails">
        <!-- Appointment details will be loaded here -->
      </div>
    </div>
    <div class="calendar-drawer-overlay" id="earningsDrawerOverlay"></div>
  `;

  let servicesCache = {};
  let staffCache = {};
  let barChart = null;
  let donutChart = null;

  // Load services and staff for filters
  async function loadFilters() {
    try {
      // Load services
      const servicesSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
      servicesCache = {};
      const serviceSelect = document.getElementById("serviceFilter");
      servicesSnap.forEach(doc => {
        const serviceData = { id: doc.id, ...doc.data() };
        servicesCache[doc.id] = serviceData;
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = serviceData.name;
        serviceSelect.appendChild(option);
      });

      // Load staff
      const staffSnap = await getDocs(collection(db, "tenants", tenantId, "staff"));
      staffCache = {};
      const staffSelect = document.getElementById("staffFilter");
      staffSnap.forEach(doc => {
        const staffData = { id: doc.id, ...doc.data() };
        staffCache[doc.id] = staffData;
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = staffData.name;
        staffSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading filters:", error);
    }
  }

  // Get date range based on filter
  function getDateRange() {
    const filter = document.getElementById("dateRangeFilter").value;
    const now = new Date();
    let start, end;

    if (filter === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (filter === "week") {
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);
      start = weekStart;
      end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
    } else if (filter === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (filter === "last30") {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (filter === "custom") {
      const startDate = document.getElementById("customStartDate").value;
      const endDate = document.getElementById("customEndDate").value;
      if (startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      } else {
        // Default to this month if custom dates not set
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
    }

    return { start, end };
  }

  // Load earnings data
  async function loadEarningsData() {
    try {
      const { start, end } = getDateRange();
      const staffFilter = document.getElementById("staffFilter").value;
      const serviceFilter = document.getElementById("serviceFilter").value;

      // Show loading
      document.getElementById("totalEarnings").textContent = "-";
      document.getElementById("completedCount").textContent = "-";
      document.getElementById("averagePrice").textContent = "-";
      document.getElementById("topService").textContent = "-";
      document.getElementById("earningsTableBody").innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted);">
            Yükleniyor...
          </td>
        </tr>
      `;

      // Query appointments
      let q;
      try {
        q = query(
          collection(db, "tenants", tenantId, "appointments"),
          where("status", "==", "completed"),
          where("startAt", ">=", Timestamp.fromDate(start)),
          where("startAt", "<=", Timestamp.fromDate(end)),
          orderBy("startAt", "asc")
        );
      } catch (error) {
        // Fallback if composite index is missing
        console.warn("Composite index may be needed. Loading all completed appointments:", error);
        q = query(
          collection(db, "tenants", tenantId, "appointments"),
          where("status", "==", "completed")
        );
      }

      const appointmentsSnap = await getDocs(q);
      let appointments = [];

      appointmentsSnap.forEach(docSnap => {
        const apt = docSnap.data();
        const aptDate = apt.startAt?.toDate ? apt.startAt.toDate() : new Date(apt.startAt);

        // Filter by date range (if query didn't include it)
        if (aptDate < start || aptDate > end) {
          return;
        }

        // Filter by staff
        if (staffFilter !== "all" && apt.staffId !== staffFilter) {
          return;
        }

        // Filter by service
        if (serviceFilter !== "all" && apt.serviceId !== serviceFilter) {
          return;
        }

        const service = apt.serviceId && servicesCache[apt.serviceId]
          ? servicesCache[apt.serviceId]
          : null;

        appointments.push({
          id: docSnap.id,
          ...apt,
          appointmentDate: aptDate,
          service: service,
          price: service ? (service.price || 0) : 0
        });
      });

      // Calculate statistics
      const totalEarnings = appointments.reduce((sum, apt) => sum + apt.price, 0);
      const completedCount = appointments.length;
      const averagePrice = completedCount > 0 ? totalEarnings / completedCount : 0;

      // Find top service
      const serviceEarnings = {};
      appointments.forEach(apt => {
        if (apt.serviceId && apt.service) {
          serviceEarnings[apt.serviceId] = (serviceEarnings[apt.serviceId] || 0) + apt.price;
        }
      });
      
      let topServiceName = "-";
      if (Object.keys(serviceEarnings).length > 0) {
        const topServiceId = Object.keys(serviceEarnings).reduce((a, b) =>
          serviceEarnings[a] > serviceEarnings[b] ? a : b);
        topServiceName = topServiceId && servicesCache[topServiceId]
          ? servicesCache[topServiceId].name
          : "-";
      }

      // Update stat cards
      document.getElementById("totalEarnings").textContent = `${totalEarnings.toFixed(2)} ₺`;
      document.getElementById("completedCount").textContent = completedCount;
      document.getElementById("averagePrice").textContent = `${averagePrice.toFixed(2)} ₺`;
      document.getElementById("topService").textContent = topServiceName;

      // Prepare data for charts
      prepareChartsData(appointments, start, end);
      
      // Update table
      updateTable(appointments);

    } catch (error) {
      console.error("Error loading earnings data:", error);
      document.getElementById("earningsTableBody").innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
            Veriler yüklenirken bir hata oluştu.
          </td>
        </tr>
      `;
    }
  }

  // Prepare data for charts
  function prepareChartsData(appointments, start, end) {
    // Bar chart data (earnings over time)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const barChartData = {};
    const barChartLabels = [];
    const barChartValues = [];

    // Limit to 30 days for better readability, group by week if more
    let groupBy = "day";
    if (daysDiff > 30) {
      groupBy = "week";
    }

    if (groupBy === "day") {
      // Group by day
      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const dateKey = date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
        barChartData[dateKey] = 0;
        barChartLabels.push(dateKey);
      }

      appointments.forEach(apt => {
        const dateKey = apt.appointmentDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
        if (barChartData.hasOwnProperty(dateKey)) {
          barChartData[dateKey] += apt.price;
        }
      });

      barChartLabels.forEach(label => {
        barChartValues.push(barChartData[label] || 0);
      });
    } else {
      // Group by week
      const weeks = {};
      for (let i = 0; i < daysDiff; i += 7) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + i);
        const weekKey = `Hafta ${Math.floor(i / 7) + 1}`;
        weeks[weekKey] = 0;
        barChartLabels.push(weekKey);
      }

      appointments.forEach(apt => {
        const weekIndex = Math.floor((apt.appointmentDate - start) / (1000 * 60 * 60 * 24 * 7));
        const weekKey = `Hafta ${weekIndex + 1}`;
        if (weeks.hasOwnProperty(weekKey)) {
          weeks[weekKey] += apt.price;
        }
      });

      barChartLabels.forEach(label => {
        barChartValues.push(weeks[label] || 0);
      });
    }

    // Donut chart data (earnings by service)
    const donutChartData = {};
    appointments.forEach(apt => {
      if (apt.serviceId && apt.service) {
        const serviceName = apt.service.name;
        donutChartData[serviceName] = (donutChartData[serviceName] || 0) + apt.price;
      }
    });

    const donutLabels = Object.keys(donutChartData);
    const donutValues = Object.values(donutChartData);

    // Update charts
    updateBarChart(barChartLabels, barChartValues);
    updateDonutChart(donutLabels, donutValues);
  }

  // Update bar chart
  function updateBarChart(labels, values) {
    const ctx = document.getElementById("earningsBarChart");
    if (!ctx) return;

    if (barChart) {
      barChart.destroy();
    }

    // If no data, show empty state
    if (values.length === 0 || values.every(v => v === 0)) {
      const container = ctx.parentElement;
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; color: var(--muted);">
          <p>Veri bulunamadı</p>
        </div>
      `;
      // Re-create canvas for next update
      const newCanvas = document.createElement("canvas");
      newCanvas.id = "earningsBarChart";
      setTimeout(() => {
        container.innerHTML = "";
        container.appendChild(newCanvas);
      }, 100);
      return;
    }

    barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Kazanç (₺)",
          data: values,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.parsed.y.toFixed(2)} ₺`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: labels.length > 10 ? 45 : 0,
              minRotation: 0
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toFixed(0) + " ₺";
              }
            }
          }
        }
      }
    });
  }

  // Update donut chart
  function updateDonutChart(labels, values) {
    const ctx = document.getElementById("earningsDonutChart");
    if (!ctx) return;

    if (donutChart) {
      donutChart.destroy();
    }

    // If no data, show empty state
    if (labels.length === 0 || values.every(v => v === 0)) {
      const container = ctx.parentElement;
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; color: var(--muted);">
          <p>Veri bulunamadı</p>
        </div>
      `;
      // Re-create canvas for next update
      const newCanvas = document.createElement("canvas");
      newCanvas.id = "earningsDonutChart";
      setTimeout(() => {
        container.innerHTML = "";
        container.appendChild(newCanvas);
      }, 100);
      return;
    }

    // Generate colors (extend if needed)
    const baseColors = [
      "rgba(59, 130, 246, 0.8)",
      "rgba(16, 185, 129, 0.8)",
      "rgba(245, 158, 11, 0.8)",
      "rgba(239, 68, 68, 0.8)",
      "rgba(139, 92, 246, 0.8)",
      "rgba(236, 72, 153, 0.8)",
      "rgba(14, 165, 233, 0.8)",
      "rgba(34, 197, 94, 0.8)"
    ];

    // Repeat colors if we have more services than colors
    const colors = [];
    for (let i = 0; i < labels.length; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }

    donutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              font: {
                size: 12
              },
              boxWidth: 12,
              boxHeight: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || "";
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value.toFixed(2)} ₺ (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Update table
  function updateTable(appointments) {
    const tbody = document.getElementById("earningsTableBody");

    if (appointments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted);">
            Bu kriterlere uygun randevu bulunamadı.
          </td>
        </tr>
      `;
      convertTableToCards();
      return;
    }

    tbody.innerHTML = appointments.map(apt => {
      const dateStr = apt.appointmentDate.toLocaleDateString("tr-TR");
      const timeStr = apt.appointmentDate.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const serviceName = apt.service ? apt.service.name : "-";

      return `
        <tr class="earnings-table-row" data-appointment-id="${apt.id}" style="cursor: pointer;">
          <td>${dateStr}</td>
          <td>${timeStr}</td>
          <td>${apt.customerName || "-"}</td>
          <td>${serviceName}</td>
          <td><strong>${apt.price.toFixed(2)} ₺</strong></td>
          <td><span class="status-badge status-completed">Tamamlandı</span></td>
        </tr>
      `;
    }).join('');

    // Add click listeners to table rows
    tbody.querySelectorAll(".earnings-table-row").forEach(row => {
      row.addEventListener("click", () => {
        const appointmentId = row.dataset.appointmentId;
        openAppointmentDrawer(appointmentId);
      });
    });

    convertTableToCards();
  }

  // Open appointment details drawer
  async function openAppointmentDrawer(appointmentId) {
    try {
      const drawer = document.getElementById("earningsAppointmentDrawer");
      const overlay = document.getElementById("earningsDrawerOverlay");
      const detailsEl = document.getElementById("earningsAppointmentDetails");

      // Show drawer
      drawer.classList.add("active");
      overlay.classList.add("active");

      detailsEl.innerHTML = '<div class="calendar-loading">Yükleniyor...</div>';

      // Load appointment details
      const appointmentsSnap = await getDocs(
        query(collection(db, "tenants", tenantId, "appointments"))
      );

      let appointment = null;
      appointmentsSnap.forEach(docSnap => {
        if (docSnap.id === appointmentId) {
          appointment = { id: docSnap.id, ...docSnap.data() };
        }
      });

      if (!appointment) {
        detailsEl.innerHTML = '<div class="calendar-drawer-empty"><p>Randevu bulunamadı.</p></div>';
        return;
      }

      const aptDate = appointment.startAt?.toDate ? appointment.startAt.toDate() : new Date(appointment.startAt);
      const serviceName = appointment.serviceId && servicesCache[appointment.serviceId]
        ? servicesCache[appointment.serviceId].name
        : "-";
      const servicePrice = appointment.serviceId && servicesCache[appointment.serviceId]
        ? servicesCache[appointment.serviceId].price || 0
        : 0;
      const staffName = appointment.staffId && staffCache[appointment.staffId]
        ? staffCache[appointment.staffId].name
        : "-";
      const statusText = getStatusText(appointment.status || "completed");

      detailsEl.innerHTML = `
        <div class="earnings-appointment-details">
          <div class="earnings-detail-item">
            <strong>Tarih:</strong>
            <span>${aptDate.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Saat:</strong>
            <span>${aptDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Müşteri:</strong>
            <span>${appointment.customerName || "-"}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Telefon:</strong>
            <span>${appointment.customerPhone || "-"}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Hizmet:</strong>
            <span>${serviceName}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Personel:</strong>
            <span>${staffName}</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Fiyat:</strong>
            <span>${servicePrice.toFixed(2)} ₺</span>
          </div>
          <div class="earnings-detail-item">
            <strong>Durum:</strong>
            <span class="status-badge status-${appointment.status || "completed"}">${statusText}</span>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error loading appointment details:", error);
      document.getElementById("earningsAppointmentDetails").innerHTML = `
        <div class="calendar-drawer-empty">
          <p>Randevu detayları yüklenirken bir hata oluştu.</p>
        </div>
      `;
    }
  }

  // Close drawer
  function closeDrawer() {
    const drawer = document.getElementById("earningsAppointmentDrawer");
    const overlay = document.getElementById("earningsDrawerOverlay");
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  }

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
  document.getElementById("dateRangeFilter").addEventListener("change", (e) => {
    const isCustom = e.target.value === "custom";
    document.getElementById("customDateRange").style.display = isCustom ? "flex" : "none";
    document.getElementById("customDateRangeEnd").style.display = isCustom ? "flex" : "none";
    loadEarningsData();
  });

  document.getElementById("staffFilter").addEventListener("change", loadEarningsData);
  document.getElementById("serviceFilter").addEventListener("change", loadEarningsData);
  document.getElementById("customStartDate").addEventListener("change", loadEarningsData);
  document.getElementById("customEndDate").addEventListener("change", loadEarningsData);
  document.getElementById("closeEarningsDrawer").addEventListener("click", closeDrawer);
  document.getElementById("earningsDrawerOverlay").addEventListener("click", closeDrawer);

  // Initialize
  await loadFilters();
  await loadEarningsData();
}
