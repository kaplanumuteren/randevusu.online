/**
 * Main Application Module
 * Initializes and coordinates all modules
 */

import { getTenantIdFromSubdomain, showTenantNotFoundError, showInitializationError } from "./tenant.js";
import { loadBusinessInfo } from "./business.js";
import { loadCategories, loadServices, refreshServices, getAllServices } from "./services.js";
import { loadStaff, getAllStaff } from "./staff.js";
import { 
  initBookingState, 
  setSelectedService, 
  getSelectedService,
  setSelectedStaff,
  setSelectedDate,
  setSelectedTime,
  getSelectedDate,
  getSelectedTime,
  initializeStaffAndDateTime,
  displayModalStaff,
  loadTimeSlots,
  selectTimeSlot,
  submitBooking
} from "./booking.js";
import { showStep, showError, initThemeToggle, setupStep2Checker } from "./ui.js";
import { trackPageView } from "./views-tracker.js";

// Global state
let tenantId = null;

/**
 * Initialize the application
 */
async function init() {
  try {
    // Get tenant ID
    tenantId = await getTenantIdFromSubdomain();
    
    if (!tenantId) {
      showTenantNotFoundError();
      return;
    }

    // Track page view
    await trackPageView(tenantId);

    // Initialize theme toggle
    initThemeToggle();

    // Setup step 2 checker
    const step2Checker = setupStep2Checker(() => {
      return getSelectedTime() !== null && getSelectedDate() !== null;
    });
    
    // Make it globally available for booking module
    window.checkStep2Complete = step2Checker;

    // Setup booking modal event listeners (before loading data)
    setupBookingModalListeners(tenantId, step2Checker);

    // Setup date change listener
    setupDateChangeListener(tenantId, step2Checker);

    // Setup customer info form listeners
    setupCustomerInfoListeners();

    // Load business info with staff callback
    await loadBusinessInfo(tenantId, async () => {
      await loadStaff(tenantId);
    });

    // Load categories and services
    await loadCategories(tenantId, () => {
      refreshServices((serviceId) => handleServiceSelect(serviceId, tenantId, step2Checker));
    });

    await loadServices(tenantId, (serviceId) => handleServiceSelect(serviceId, tenantId, step2Checker));
    
    // Load staff
    await loadStaff(tenantId);

  } catch (error) {
    console.error('Initialization error:', error);
    showInitializationError();
  }
}

/**
 * Handle service selection
 * @param {string} serviceId - Selected service ID
 * @param {string} tenantId - Tenant ID
 * @param {Function} step2Checker - Step 2 checker function
 */
function handleServiceSelect(serviceId, tenantId, step2Checker) {
  setSelectedService(serviceId);
  
  // If service card is clicked, open modal and go to step 2
  const serviceCard = document.querySelector(`.service-card[data-id="${serviceId}"]`);
  if (serviceCard && serviceCard.closest('#servicesGrid')) {
    // Service card in main grid was clicked
    document.getElementById('openBookingModal').click();
    setTimeout(async () => {
      const allStaff = getAllStaff();
      if (allStaff.length === 0) {
        await loadStaff(tenantId);
      }
      initBookingState();
      setSelectedService(serviceId);
      await initializeStaffAndDateTime(tenantId);
      showStep(2);
      if (step2Checker) step2Checker();
    }, 100);
  }
}

/**
 * Setup booking modal event listeners
 * @param {string} tenantId - Tenant ID
 * @param {Function} step2Checker - Step 2 checker function
 */
function setupBookingModalListeners(tenantId, step2Checker) {
  // Open booking modal
  document.getElementById('openBookingModal').addEventListener('click', async () => {
    document.getElementById('bookingModal').classList.add('active');
    
    const selectedServiceId = getSelectedService();
    
    // If service is already selected (from clicking service card), go directly to staff/date/time selection
    if (selectedServiceId) {
      const allStaff = getAllStaff();
      if (allStaff.length === 0) {
        await loadStaff(tenantId);
      }
      // Reset selections except service
      setSelectedStaff(null);
      setSelectedTime(null);
      await initializeStaffAndDateTime(tenantId);
      showStep(2);
      step2Checker();
    } else {
      // No service selected, show service selection
      showStep(1);
      initBookingState();
      document.getElementById('nextToStep2').disabled = true;
      document.getElementById('nextToStep3').disabled = true;
      document.getElementById('submitBooking').disabled = true;
    }
  });

  // Close modal
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('bookingModal').classList.remove('active');
  });

  // Step 1 -> Step 2
  document.getElementById('nextToStep2').addEventListener('click', async () => {
    const allStaff = getAllStaff();
    if (allStaff.length === 0) {
      await loadStaff(tenantId);
    }
    await initializeStaffAndDateTime(tenantId);
    showStep(2);
    step2Checker();
  });

  // Step 2 -> Step 1
  document.getElementById('backToStep1Staff').addEventListener('click', () => {
    showStep(1);
  });

  // Step 2 -> Step 3
  document.getElementById('nextToStep3').addEventListener('click', () => {
    if (getSelectedTime() && getSelectedDate()) {
      showStep(3);
    }
  });

  // Step 3 -> Step 2
  document.getElementById('backToStep2FromInfo').addEventListener('click', () => {
    showStep(2);
  });

  // Submit booking
  document.getElementById('submitBooking').addEventListener('click', () => {
    submitBooking(tenantId);
  });
}

/**
 * Setup date change listener
 * @param {string} tenantId - Tenant ID
 * @param {Function} step2Checker - Step 2 checker function
 */
function setupDateChangeListener(tenantId, step2Checker) {
  document.getElementById('appointmentDate').addEventListener('change', async (e) => {
    setSelectedDate(e.target.value);
    setSelectedTime(null); // Reset time when date changes
    await loadTimeSlots(tenantId);
    await displayModalStaff(tenantId); // Update staff list based on new date
    if (step2Checker) step2Checker();
  });
}

/**
 * Setup customer info form listeners
 */
function setupCustomerInfoListeners() {
  const nameInput = document.getElementById('customerName');
  const phoneInput = document.getElementById('customerPhone');
  const submitBtn = document.getElementById('submitBooking');

  const updateSubmitButton = () => {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    submitBtn.disabled = !(name && phone);
  };

  nameInput.addEventListener('input', updateSubmitButton);
  phoneInput.addEventListener('input', updateSubmitButton);
}

/**
 * Make selectTimeSlot available globally for time slot buttons
 * @param {string} tenantId - Tenant ID
 */
window.selectTimeSlot = async function(time) {
  await selectTimeSlot(tenantId, time);
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

