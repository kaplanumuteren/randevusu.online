<?php
session_start();
header("Content-Type: text/html; charset=utf-8");

/* ============================================================
   PHP TARAFI: Session ayarlama (AJAX POST isteği ile çalışır)
============================================================ */
if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST["action"]) && $_POST["action"] === "setSession") {
    if (!empty($_POST["tenantId"])) {
        $_SESSION["tenantId"] = $_POST["tenantId"];
        echo json_encode(["success" => true]);
        exit;
    } else {
        echo json_encode(["success" => false, "message" => "tenantId eksik"]);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yönetim Paneli Girişi</title>
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="stylesheet" href="./assets/css/main.css">
  <link rel="stylesheet" href="./assets/css/auth.css">
</head>

<body>
  <div class="login-container">
    <h1>Yönetim Paneli</h1>
    <p class="subtitle">İşletmenize giriş yapın</p>

    <div id="errorMessage" class="error"></div>

    <form id="loginForm">
      <div class="form-group">
        <label for="tenantId">ID</label>
        <input type="text" id="tenantId" placeholder="ID" required>
      </div>

      <div class="form-group">
        <label for="password">Şifre</label>
        <input type="password" id="password" placeholder="Şifrenizi girin" required>
      </div>

      <button type="submit" class="btn-primary" id="submitBtn">Giriş Yap</button>
    </form>
  </div>

<script type="module">
/* Firebase Import */
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./assets/js/config/firebase.js";

const errorEl = document.getElementById('errorMessage');
const form = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

function hideError() {
  errorEl.style.display = 'none';
}

async function hashPassword(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

/* =============================================================
   FORM LOGIN – Firestore doğrulama + PHP session başlatma
============================================================= */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;
  submitBtn.textContent = "Giriş yapılıyor...";

  try {
    const tenantId = document.getElementById('tenantId').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    // Firestore tenant getir
    const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
    if (!tenantDoc.exists()) {
      showError("Bu tenant bulunamadı.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Giriş Yap";
      return;
    }

    const tenantData = tenantDoc.data();
    const hash = await hashPassword(password);

    if (hash !== tenantData.password) {
      showError("Şifre hatalı.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Giriş Yap";
      return;
    }

    // Login başarılı → PHP session başlat
    const response = await fetch("login.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `action=setSession&tenantId=${encodeURIComponent(tenantId)}`
    });

    const result = await response.json();

    if (!result.success) {
      showError("Session oluşturulamadı: " + (result.message || ""));
      submitBtn.disabled = false;
      submitBtn.textContent = "Giriş Yap";
      return;
    }

    // Her şey başarılı → yönlendir
    window.location.href = "/";

  } catch (err) {
    console.error("Login hata:", err);
    showError("Giriş başarısız: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Giriş Yap";
  }
});
</script>

</body>
</html>
