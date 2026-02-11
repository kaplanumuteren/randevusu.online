/**
 * Tenant ID Management Module
 * Handles tenant ID retrieval from subdomain or URL parameter
 */

import { db } from "../config/firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Get tenant ID from subdomain or URL parameter
 * @returns {Promise<string|null>} Tenant ID or null if not found
 */
export async function getTenantIdFromSubdomain() {
  try {
    // Get subdomain from hostname
    
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let subdomain = null;

    // If hostname has at least 3 parts (subdomain.domain.com), get subdomain
    if (parts.length >= 3) {
      subdomain = parts[0];
    } else if (parts.length === 2 && parts[0] !== 'www') {
      // For localhost or single domain setups
      subdomain = parts[0];
    }

    // If no subdomain found, try URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = urlParams.get('tenant');
    
    if (tenantParam) {
      // If tenant parameter exists, use it directly
      return tenantParam;
    }

    if (!subdomain) {
      console.error('Subdomain bulunamadı');
      return null;
    }

  
    
    // Search in Firestore for tenant with matching subdomain
    const tenantsRef = collection(db, 'tenants');
    const q = query(tenantsRef, where('subdomain', '==', subdomain));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Get the first matching document's ID
      const tenantDoc = querySnapshot.docs[0];
      return tenantDoc.id;
    } else {
      console.error(`Subdomain '${subdomain}' için işletme bulunamadı`);
      return null;
    }
  } catch (error) {
    console.error('Subdomain arama hatası:', error);
    return null;
  }
}

/**
 * Show error message when tenant is not found
 */
export function showTenantNotFoundError() {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); color: var(--text);">
      <div style="text-align: center; padding: 40px;">
        <h1 style="color: var(--error); margin-bottom: 20px;">İşletme Bulunamadı</h1>
        <p style="color: var(--text-muted);">Bu subdomain için kayıtlı bir işletme bulunamadı.</p>
        <p style="color: var(--text-muted); margin-top: 10px; font-size: 14px;">Lütfen doğru URL'yi kullandığınızdan emin olun.</p>
      </div>
    </div>
  `;
}

/**
 * Show generic error message
 */
export function showInitializationError() {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); color: var(--text);">
      <div style="text-align: center; padding: 40px;">
        <h1 style="color: var(--error); margin-bottom: 20px;">Hata</h1>
        <p style="color: var(--text-muted);">Sayfa yüklenirken bir hata oluştu.</p>
      </div>
    </div>
  `;
}

