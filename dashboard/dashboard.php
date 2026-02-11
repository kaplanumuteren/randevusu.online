<?php
session_start();

/* ============================================
   1) JSON API: SESSION CHECK / LOGOUT
   ============================================ */
if (isset($_GET['action'])) {
    header("Content-Type: application/json");

    // SESSION CHECK
    if ($_GET['action'] === 'sessionCheck') {
        if (!isset($_SESSION["tenantId"])) {
            echo json_encode([
                "loggedIn" => false,
                "reason"   => "session_invalid"
            ]);
            exit;
        }

        echo json_encode([
            "loggedIn" => true,
            "tenantId" => $_SESSION["tenantId"],
            "admin"    => $_SESSION["admin"] ?? false
        ]);
        exit;
    }

    // LOGOUT
    if ($_GET['action'] === 'logout') {
        // PHP session'ı temizle
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }
        session_destroy();

        echo json_encode([
            "success" => true
        ]);
        exit;
    }

    // Geçersiz action
    echo json_encode([
        "success" => false,
        "message" => "Geçersiz action"
    ]);
    exit;
}

/* ============================================
   2) DASHBOARD SAYFASI (HTML)
   ============================================ */
if (!isset($_SESSION["tenantId"])) {
    header("Location: /login.php?reason=session_miss");
    exit;
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yönetim Paneli</title>

  <link rel="stylesheet" href="./assets/css/main.css" />
  <link rel="stylesheet" href="./assets/css/dashboard.css" />
  <link rel="stylesheet" href="./assets/css/home.css" id="page-css" />
  <link rel="icon" type="image/png" href="favicon.png">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    body:not(.session-valid) { display: none !important; }
    #sessionCheck {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; position: fixed; top: 0; left: 0; width: 100%;
      background: #f8f8f8; z-index: 9999;
    }
    .spinner {
      width: 40px; height: 40px; border: 4px solid #ccc;
      border-top-color: #6366F1; border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>

<body>

<div id="sessionCheck">
  <div style="text-align:center;">
    <div class="spinner"></div>
    <p>Session kontrol ediliyor...</p>
  </div>
</div>

<aside class="sidebar" id="sidebar">
  <div class="logo">💈 Randevusu<span>.online</span></div>
  <nav>
      <button data-page="home" class="active">🏠 Ana Sayfa</button>
      <button data-page="appointments">📋 Randevular</button>
      <button data-page="workplace-settings">🏢 İş Yeri Ayarları</button>
      <button data-page="calendar">📅 Takvim</button>
      <button data-page="earnings">💰 Kazançlar</button>
  </nav>
</aside>

<main class="content">
  <header class="topbar">
    <button class="mobile-menu-btn" id="mobileMenuBtn">☰</button>
    <h2 id="pageTitle">Ana Sayfa</h2>
    <div class="user-info">
        <button id="themeToggle">🌓</button>
        <span id="businessName">İşletme Hesabınız</span>
        <button id="logoutBtn">Çıkış</button>
    </div>
  </header>

  <section id="pageContent"></section>
</main>

<script type="module">
import { loadHome } from "./assets/js/dashboard/home.js";
import { loadCalendar } from "./assets/js/dashboard/calendar.js";
import { loadEarnings } from "./assets/js/dashboard/earnings.js";
import { loadWorkplaceSettings } from "./assets/js/dashboard/workplace-settings.js";
import { loadAppointments } from "./assets/js/dashboard/appointments.js";
import { getTenantId, clearSession } from "./assets/js/config/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./assets/js/config/firebase.js";


/* ========== BACKEND SESSION CHECK ========== */
(async function checkSession() {
  try {
    const resp = await fetch("/dashboard.php?action=sessionCheck", {
      credentials: "include"
    });
    const data = await resp.json();

    if (!data.loggedIn) {
      const reason = data.reason || "session_invalid";
      clearSession();
      window.location.replace("/login.php?reason=" + reason);
      return;
    }

    if (!getTenantId()) {
      localStorage.setItem("tenantId", data.tenantId);
      localStorage.setItem("session", "true");
    }

    document.body.classList.add("session-valid");
    const sc = document.getElementById("sessionCheck");
    if (sc) sc.style.display = "none";

    initializeDashboard();

  } catch (error) {
    console.error("Session check error:", error);
    clearSession();
    window.location.replace("/login.php?reason=session_invalid");
  }
})();

/* ========== DASHBOARD INIT ========== */
function initializeDashboard() {
  // ========== Firestore işletme adı yükleme ==========
  (async function loadBusinessInfo() {
      try {
          const tenantId = getTenantId();
          if (!tenantId) return;

          const tenantRef = doc(db, "tenants", tenantId);
          const tenantDoc = await getDoc(tenantRef);

          if (tenantDoc.exists()) {
              const data = tenantDoc.data();

              const nameEl = document.getElementById("businessName");
              nameEl.textContent = data.name || "İşletme Hesabınız";
          }
      } catch (err) {
          console.error("İşletme adı yükleme hatası:", err);
      }
  })();


  const titleEl = document.getElementById("pageTitle");
  const contentEl = document.getElementById("pageContent");
  const menuBtns = document.querySelectorAll(".sidebar nav button");
  const themeToggle = document.getElementById("themeToggle");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("sidebar");

  // Tema
  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  // Mobile menu
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (!confirm("Çıkış yapmak istediğinize emin misiniz?")) return;

      try {
        await fetch("/dashboard.php?action=logout", {
          method: "POST",
          credentials: "include"
        });
      } catch (e) {
        console.error("Logout error:", e);
      } finally {
        clearSession();
        window.location.replace("/login.php?reason=logged_out");
      }
    });
  }

  // Menü tıklama
  menuBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      menuBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const page = btn.dataset.page;
      loadPage(page);
    });
  });

  async function loadPage(page) {
    titleEl.textContent = getTitle(page);
    contentEl.innerHTML = `<div class="loader"></div>`;

    const cssMap = {
      home: './assets/css/home.css',
      appointments: './assets/css/appointments.css',
      calendar: './assets/css/calendar.css',
      earnings: './assets/css/earnings.css',
      'workplace-settings': './assets/css/workplace-settings.css'
    };

    const pageCss = document.getElementById("page-css");
    if (pageCss && cssMap[page]) pageCss.href = cssMap[page];

    try {
      switch (page) {
        case "home": await loadHome(contentEl); break;
        case "appointments": await loadAppointments(contentEl); break;
        case "calendar": await loadCalendar(contentEl); break;
        case "earnings": await loadEarnings(contentEl); break;
        case "workplace-settings": await loadWorkplaceSettings(contentEl); break;
        default: contentEl.innerHTML = "Sayfa bulunamadı.";
      }
    } catch (err) {
      console.error("Page load error:", err);
      contentEl.innerHTML = `<div class="error">Sayfa yüklenirken hata oluştu.</div>`;
    }
  }

  function getTitle(page) {
    return {
      home: "Ana Sayfa",
      appointments: "Randevular",
      calendar: "Takvim",
      earnings: "Kazançlar",
      "workplace-settings": "İş Yeri Ayarları"
    }[page] || "Panel";
  }

  // Varsayılan sayfa
  loadPage("home");
}

</script>

</body>
</html>