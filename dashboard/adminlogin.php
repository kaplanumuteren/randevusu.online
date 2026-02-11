<?php
session_start();
header("Content-Type: application/json; charset=utf-8");

// ======================================
// 1) token.js DOSYASINDAN TOKEN OKU
// ======================================
$tokenFile = __DIR__ . "../../admin/token.js";

if (!file_exists($tokenFile)) {
    echo json_encode([
        "success" => false,
        "message" => "token.js bulunamadı"
    ]);
    exit;
}

$tokenJsContent = file_get_contents($tokenFile);

// window.ADMIN_TOKEN = "xxxxx"
if (!preg_match('/window\.ADMIN_TOKEN\s*=\s*"([^"]+)"/', $tokenJsContent, $matches)) {
    echo json_encode([
        "success" => false,
        "message" => "token.js içinde ADMIN_TOKEN bulunamadı"
    ]);
    exit;
}

$REAL_ADMIN_TOKEN = $matches[1];

// ======================================
// 2) GET PARAMETRELERİNİ AL
// ======================================
$tenantId   = isset($_GET["tenantId"]) ? trim($_GET["tenantId"]) : "";
$admintoken = isset($_GET["admintoken"]) ? trim($_GET["admintoken"]) : "";

if ($tenantId === "" || $admintoken === "") {
    echo json_encode([
        "success" => false,
        "message" => "tenantId ve admintoken gerekli"
    ]);
    exit;
}

// ======================================
// 3) TOKEN DOĞRULA
// ======================================
if ($admintoken !== $REAL_ADMIN_TOKEN) {
    echo json_encode([
        "success" => false,
        "message" => "Token yanlış"
    ]);
    exit;
}

// ======================================
// 4) FIRESTORE TENANT DOĞRULAMA
// ======================================
$projectId = "randevusu-5d7de";
$url = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/tenants/$tenantId";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 404) {
    echo json_encode([
        "success" => false,
        "message" => "Tenant bulunamadı"
    ]);
    exit;
}

if ($httpCode !== 200) {
    echo json_encode([
        "success" => false,
        "message" => "Firestore bağlantı hatası"
    ]);
    exit;
}

// ======================================
// 5) SESSION AÇ
// ======================================
$_SESSION["tenantId"] = $tenantId;
$_SESSION["admin"]    = true;

file_put_contents("session_log.txt", "ADMIN LOGIN: $tenantId\n", FILE_APPEND);


// ======================================
// 6) JSON CEVAP
// ======================================
echo json_encode([
    "success" => true,
    "tenant"  => $tenantId,
    "message" => "Admin login başarılı"
]);
header("Location: /");
exit;
 