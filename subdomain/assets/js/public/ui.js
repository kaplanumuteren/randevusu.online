/**
 * UI Management Module
 * Handles modal, theme toggle, gallery, and other UI interactions
 */


/**
 * Logs messages with a consistent and themed format
 * @param {string} type - info | warn | error | success
 * @param {string} message
 * @param {any} data
 */
export function uiLog(type, message, data = null) {
  const styles = {
    info:    "color:#3b82f6;font-weight:600;",
    warn:    "color:#f59e0b;font-weight:600;",
    error:   "color:#ef4444;font-weight:600;",
    success: "color:#10b981;font-weight:600;"
  };

  console.log(
    `%c[UI] ${type.toUpperCase()} › ${message}`,
    styles[type] || styles.info,
    data || ""
  );
}


/**
 * Updates document title dynamically
 * @param {string} businessName 
 */
export function updatePageTitle(businessName) {
  if (!businessName) {
    document.title = 'Randevu Sistemi';
    uiLog("warn", "Business name not found. Using default title.");
    return;
  }

  const newTitle = `${businessName} - Randevu Al`;
  document.title = newTitle;

  uiLog("success", "Sayfa başlığı güncellendi", { title: newTitle });
}









/**
 * Show modal step
 * @param {number} stepNum - Step number (1-4)
 */
export function showStep(stepNum) {
  document.querySelectorAll('.step').forEach((step, idx) => {
    step.style.display = idx + 1 === stepNum ? 'block' : 'none';
  });
}

/**
 * Show error message
 * @param {string} message - Error message
 */
export function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }
}

/**
 * Change main gallery image
 * @param {string} url - Image URL
 */
export function changeMainImage(url) {
  const galleryMainEl = document.getElementById('galleryMain');
  if (galleryMainEl) {
    galleryMainEl.innerHTML = `<img src="${url}" alt="Galeri" id="galleryMainImage">`;
    // Update active thumbnail
    document.querySelectorAll('.gallery-thumbnail').forEach(thumb => {
      const thumbImg = thumb.querySelector('img');
      if (thumbImg && thumbImg.src === url) {
        thumb.classList.add('active');
      } else {
        thumb.classList.remove('active');
      }
    });
  }
}

/**
 * Make changeMainImage available globally for gallery thumbnails
 */
window.changeMainImage = changeMainImage;

/**
 * Check if step 2 is complete (time selected)
 */
export function checkStep2Complete() {
  // This will be set by booking module
  const nextBtn = document.getElementById('nextToStep3');
  if (nextBtn) {
    // Check will be done by booking module state
    // This is a placeholder that booking module will call
  }
}

/**
 * Initialize theme toggle
 */
export function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    }
  });
}

/**
 * Setup step 2 complete checker
 * @param {Function} checker - Function that returns boolean if step 2 is complete
 */
export function setupStep2Checker(checker) {
  const checkStep2Complete = () => {
    const isComplete = checker();
    const nextBtn = document.getElementById('nextToStep3');
    if (nextBtn) {
      nextBtn.disabled = !isComplete;
    }
    console.log('Step 2 complete check:', { isComplete });
  };
  
  // Export for use by booking module
  window.checkStep2Complete = checkStep2Complete;
  return checkStep2Complete;
}

