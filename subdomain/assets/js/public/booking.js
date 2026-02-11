/**
 * Booking Management Module
 * Handles appointment booking, time slot management, and staff availability
 */

import { db } from "../config/firebase.js";
import { collection, getDocs, query, where, addDoc, Timestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAllStaff, getStaffById } from "./staff.js";
import { getServiceById } from "./services.js";
import { getBusinessData } from "./business.js";
import { showError, showStep } from "./ui.js";

// Booking state
let selectedService = null;
let selectedStaff = null; // null = "Farketmez", string = staffId
let selectedDate = null;
let selectedTime = null; // { hour, minute } or time string

/**
 * Initialize booking state
 */
export function initBookingState() {
  selectedService = null;
  selectedStaff = null;
  selectedDate = null;
  selectedTime = null;
}

/**
 * Set selected service
 * @param {string} serviceId - Service ID
 */
export function setSelectedService(serviceId) {
  selectedService = serviceId;
}

/**
 * Get selected service
 * @returns {string|null} Selected service ID
 */
export function getSelectedService() {
  return selectedService;
}

/**
 * Set selected staff
 * @param {string|null} staffId - Staff ID or null for "any"
 */
export function setSelectedStaff(staffId) {
  selectedStaff = staffId;
}

/**
 * Get selected staff
 * @returns {string|null} Selected staff ID
 */
export function getSelectedStaff() {
  return selectedStaff;
}

/**
 * Set selected date
 * @param {string} date - Date string (YYYY-MM-DD)
 */
export function setSelectedDate(date) {
  selectedDate = date;
}

/**
 * Get selected date
 * @returns {string|null} Selected date
 */
export function getSelectedDate() {
  return selectedDate;
}

/**
 * Set selected time
 * @param {Object|string} time - Time object {hour, minute} or time string
 */
export function setSelectedTime(time) {
  selectedTime = time;
}

/**
 * Get selected time
 * @returns {Object|string|null} Selected time
 */
export function getSelectedTime() {
  return selectedTime;
}

/**
 * Initialize staff and date/time selection
 * @param {string} tenantId - Tenant ID
 */
export async function initializeStaffAndDateTime(tenantId) {
  // Set date to today by default
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateInput = document.getElementById('appointmentDate');
  if (dateInput) {
    dateInput.value = todayStr;
    dateInput.min = todayStr;
  }
  selectedDate = todayStr;
  selectedTime = null;
  selectedStaff = null;
  
  console.log('initializeStaffAndDateTime:', { selectedDate, selectedTime, selectedStaff });
  
  // Display staff
  await displayModalStaff(tenantId);
  
  // Load time slots for today
  await loadTimeSlots(tenantId);
  
  // Ensure button state is correct after initialization
  checkStep2Complete();
}

/**
 * Get staff availability for a specific time slot
 * @param {string} tenantId - Tenant ID
 * @param {string} timeStr - Time string (HH:MM)
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} serviceId - Service ID
 * @returns {Promise<Object>} Availability object (staffId -> boolean)
 */
async function getStaffAvailabilityForTime(tenantId, timeStr, dateStr, serviceId) {
  const availability = {};
  const [hours, minutes] = timeStr.split(':');
  const appointmentDateTime = new Date(dateStr + 'T' + timeStr + ':00');
  
  // Get service duration
  let serviceDuration = 30;
  if (serviceId) {
    try {
      const serviceDoc = await getDoc(doc(db, 'tenants', tenantId, 'services', serviceId));
      if (serviceDoc.exists()) {
        serviceDuration = serviceDoc.data().durationMin || 30;
      }
    } catch (e) {
      console.error('Service duration error:', e);
    }
  }

  const appointmentEnd = new Date(appointmentDateTime);
  appointmentEnd.setMinutes(appointmentEnd.getMinutes() + serviceDuration);

  try {
    const startOfSlot = Timestamp.fromDate(appointmentDateTime);
    const endOfSlot = Timestamp.fromDate(appointmentEnd);
    
    const q = query(
      collection(db, 'tenants', tenantId, 'appointments'),
      where('startAt', '<', endOfSlot),
      where('status', '!=', 'cancelled')
    );

    const snapshot = await getDocs(q);
    const busyStaffIds = new Set();
    
    snapshot.forEach(doc => {
      const appt = doc.data();
      if (appt.startAt && appt.staffId) {
        const apptStart = appt.startAt.toDate();
        const apptEnd = new Date(apptStart);
        const apptDuration = appt.serviceDuration || serviceDuration;
        apptEnd.setMinutes(apptEnd.getMinutes() + apptDuration);
        
        // Check if appointments overlap
        if (apptStart < appointmentEnd && apptEnd > appointmentDateTime) {
          busyStaffIds.add(appt.staffId);
        }
      }
    });

    // Check all staff
    const allStaff = getAllStaff();
    allStaff.forEach(staff => {
      availability[staff.id] = !busyStaffIds.has(staff.id);
    });
  } catch (e) {
    console.error('Error checking staff availability:', e);
    // If error, assume all staff are available
    const allStaff = getAllStaff();
    allStaff.forEach(staff => {
      availability[staff.id] = true;
    });
  }

  return availability;
}

/**
 * Display staff in booking modal
 * @param {string} tenantId - Tenant ID
 */
export async function displayModalStaff(tenantId) {
  const listEl = document.getElementById('staffList');
  const allStaff = getAllStaff();
  
  if (allStaff.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Henüz personel eklenmemiş.</div>';
    return;
  }

  // Get service staff requirements
  let availableStaffIds = [];
  if (selectedService) {
    try {
      const serviceDoc = await getDoc(doc(db, 'tenants', tenantId, 'services', selectedService));
      if (serviceDoc.exists()) {
        const serviceData = serviceDoc.data();
        availableStaffIds = serviceData.staffIds || [];
        // If no staffIds specified, all staff can do this service
        if (availableStaffIds.length === 0) {
          availableStaffIds = allStaff.map(s => s.id);
        }
      } else {
        availableStaffIds = allStaff.map(s => s.id);
      }
    } catch (e) {
      console.error('Service load error:', e);
      availableStaffIds = allStaff.map(s => s.id);
    }
  } else {
    availableStaffIds = allStaff.map(s => s.id);
  }

  // If a time is selected, filter staff by availability at that time
  let staffAvailability = {};
  if (selectedTime && selectedDate) {
    const timeStr = typeof selectedTime === 'string' 
      ? selectedTime 
      : `${String(selectedTime.hour).padStart(2, '0')}:${String(selectedTime.minute).padStart(2, '0')}`;
    staffAvailability = await getStaffAvailabilityForTime(tenantId, timeStr, selectedDate, selectedService);
  }

  let html = `
    <div class="staff-card-modal ${selectedStaff === null ? 'selected' : ''}" data-staff-id="any">
      <div class="staff-avatar-modal">?</div>
      <div class="staff-info-modal">
        <div class="staff-name-modal">Farketmez</div>
        <div class="staff-role-modal">Uygun personel otomatik seçilir</div>
      </div>
    </div>
  `;

  allStaff.forEach(staff => {
    if (!availableStaffIds.includes(staff.id)) return;
    const initial = staff.name ? staff.name.charAt(0).toUpperCase() : '?';
    const isAvailable = !selectedTime || staffAvailability[staff.id] !== false;
    const isSelected = selectedStaff === staff.id;
    html += `
      <div class="staff-card-modal ${!isAvailable ? 'disabled' : ''} ${isSelected ? 'selected' : ''}" 
           data-staff-id="${staff.id}" 
           ${!isAvailable ? 'title="Bu saatte müsait değil"' : ''}>
        <div class="staff-avatar-modal">${initial}</div>
        <div class="staff-info-modal">
          <div class="staff-name-modal">${staff.name}</div>
          ${!isAvailable && selectedTime ? '<div class="staff-role-modal" style="color: #ef4444; font-size: 12px;">Müsait değil</div>' : ''}
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Add click handlers
  listEl.querySelectorAll('.staff-card-modal:not(.disabled)').forEach(card => {
    card.addEventListener('click', async () => {
      listEl.querySelectorAll('.staff-card-modal').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const staffId = card.dataset.staffId;
      selectedStaff = staffId === 'any' ? null : staffId;
      
      // Reload time slots when staff changes
      if (selectedDate) {
        await loadTimeSlots(tenantId);
      }
      
      // Trigger step 2 check if available
      if (window.checkStep2Complete) {
        window.checkStep2Complete();
      }
    });
  });
}

/**
 * Load time slots based on selected staff and date
 * @param {string} tenantId - Tenant ID
 */
export async function loadTimeSlots(tenantId) {
  if (!selectedDate) {
    // If no date selected, set to today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
      dateInput.value = todayStr;
    }
    selectedDate = todayStr;
  }

  const date = new Date(selectedDate);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const now = new Date();
  
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0);
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0);
  
  // If today, start from current time (rounded to next 30 minutes)
  if (isToday) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nextSlotMinutes = Math.ceil(currentMinutes / 30) * 30;
    const nextSlotHours = Math.floor(nextSlotMinutes / 60);
    const nextSlotMins = nextSlotMinutes % 60;
    startOfDay.setHours(nextSlotHours, nextSlotMins, 0, 0);
    
    // If next slot is in the past (shouldn't happen, but safety check)
    if (startOfDay < now) {
      startOfDay.setMinutes(startOfDay.getMinutes() + 30);
    }
  }

  // Get business hours for selected day
  try {
    const businessData = await getBusinessData(tenantId);
    if (businessData) {
      const dayNames = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
      const dayOfWeek = date.getDay();
      const dayKey = dayNames[dayOfWeek];
      
      if (businessData.workingHours && businessData.workingHours[dayKey]) {
        const dayHours = businessData.workingHours[dayKey];
        if (dayHours.closed) {
          document.getElementById('timeSlots').innerHTML = '<div class="empty-state">Bu gün kapalı.</div>';
          return;
        }
        if (dayHours.open) {
          const [hour, minute] = dayHours.open.split(':');
          startOfDay.setHours(parseInt(hour), parseInt(minute), 0);
        }
        if (dayHours.close) {
          const [hour, minute] = dayHours.close.split(':');
          endOfDay.setHours(parseInt(hour), parseInt(minute), 0);
        }
      } else {
        // Fallback to old format
        if (businessData.openTime) {
          const [hour, minute] = businessData.openTime.split(':');
          startOfDay.setHours(parseInt(hour), parseInt(minute), 0);
        }
        if (businessData.closeTime) {
          const [hour, minute] = businessData.closeTime.split(':');
          endOfDay.setHours(parseInt(hour), parseInt(minute), 0);
        }
      }
    }
  } catch (e) {
    console.error('Business hours error:', e);
  }
  
  // After business hours are set, if today, ensure startOfDay is not in the past
  if (isToday && startOfDay < now) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nextSlotMinutes = Math.ceil(currentMinutes / 30) * 30;
    const nextSlotHours = Math.floor(nextSlotMinutes / 60);
    const nextSlotMins = nextSlotMinutes % 60;
    const adjustedStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), nextSlotHours, nextSlotMins, 0, 0);
    
    // Only adjust if adjusted time is later than business opening time
    if (adjustedStart > startOfDay) {
      startOfDay.setHours(nextSlotHours, nextSlotMins, 0);
    }
    
    // Ensure startOfDay is not in the past
    if (startOfDay < now) {
      startOfDay.setMinutes(startOfDay.getMinutes() + 30);
    }
  }

  // Get service duration
  let serviceDuration = 30;
  if (selectedService) {
    const service = getServiceById(selectedService);
    if (service) {
      serviceDuration = service.durationMin || 30;
    }
  }

  // Get existing appointments for the day
  const staffAppointments = new Map(); // Map of staffId -> Set of busy time slots
  const allAppointments = new Map(); // Map of time -> Set of busy staff IDs
  
  try {
    const q = query(
      collection(db, 'tenants', tenantId, 'appointments'),
      where('startAt', '>=', Timestamp.fromDate(startOfDay)),
      where('startAt', '<', Timestamp.fromDate(endOfDay)),
      where('status', '!=', 'cancelled')
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      const appt = doc.data();
      if (appt.startAt) {
        const time = appt.startAt.toDate();
        const timeMinutes = time.getHours() * 60 + time.getMinutes();
        const apptStaffId = appt.staffId || null;
        const apptDuration = appt.serviceDuration || serviceDuration;
        
        // Mark all time slots for this appointment as busy
        for (let i = 0; i < apptDuration; i += 30) {
          const slotTime = timeMinutes + i;
          const timeStr = `${String(Math.floor(slotTime / 60)).padStart(2, '0')}:${String(slotTime % 60).padStart(2, '0')}`;
          
          if (!allAppointments.has(slotTime)) {
            allAppointments.set(slotTime, new Set());
          }
          
          if (apptStaffId) {
            allAppointments.get(slotTime).add(apptStaffId);
            
            if (!staffAppointments.has(apptStaffId)) {
              staffAppointments.set(apptStaffId, new Set());
            }
            staffAppointments.get(apptStaffId).add(slotTime);
          }
        }
      }
    });
  } catch (e) {
    console.error('Error loading appointments:', e);
  }

  // Generate time slots
  const slots = [];
  const slotStart = new Date(startOfDay);
  const allStaff = getAllStaff();
  
  while (slotStart < endOfDay) {
    // Skip if this slot is in the past (for today)
    if (isToday && slotStart <= now) {
      slotStart.setMinutes(slotStart.getMinutes() + 30);
      continue;
    }
    
    const hour = slotStart.getHours();
    const minute = slotStart.getMinutes();
    const slotMinutes = hour * 60 + minute;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    // Check if this slot is available
    let isAvailable = true;
    if (selectedStaff !== null) {
      // Specific staff selected - check if they're busy
      const busySlots = staffAppointments.get(selectedStaff);
      isAvailable = !busySlots || !busySlots.has(slotMinutes);
    } else {
      // "Any" staff selected - check if at least one staff is available
      // Slot is available if not all staff are busy at this time
      const busyStaffAtTime = allAppointments.get(slotMinutes);
      if (busyStaffAtTime && busyStaffAtTime.size >= allStaff.length) {
        isAvailable = false;
      } else {
        isAvailable = true;
      }
    }
    
    slots.push({
      time: timeStr,
      available: isAvailable,
      slotMinutes: slotMinutes
    });
    
    // Move to next 30-minute slot
    slotStart.setMinutes(slotStart.getMinutes() + 30);
  }

  const slotsEl = document.getElementById('timeSlots');
  if (slots.length === 0) {
    slotsEl.innerHTML = '<div class="empty-state">Bu gün için uygun saat bulunmuyor.</div>';
    return;
  }

  const selectedTimeStr = selectedTime 
    ? (typeof selectedTime === 'string' 
        ? selectedTime 
        : `${String(selectedTime.hour).padStart(2, '0')}:${String(selectedTime.minute).padStart(2, '0')}`) 
    : null;

  slotsEl.innerHTML = slots.map(slot => `
    <button class="time-slot ${slot.available ? '' : 'disabled'} ${selectedTimeStr === slot.time ? 'selected' : ''}" 
            data-time="${slot.time}"
            ${slot.available ? '' : 'disabled'}>
      ${slot.time}
    </button>
  `).join('');

  // Add click handlers
  slotsEl.querySelectorAll('.time-slot:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const time = btn.dataset.time;
      await selectTimeSlot(tenantId, time);
    });
  });
}

/**
 * Select time slot and update staff list
 * @param {string} tenantId - Tenant ID
 * @param {string} time - Time string (HH:MM)
 */
export async function selectTimeSlot(tenantId, time) {
  console.log('selectTimeSlot called:', { time, selectedDate });
  
  // Ensure selectedDate is set
  if (!selectedDate) {
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput && dateInput.value) {
      selectedDate = dateInput.value;
      console.log('selectedDate set from input:', selectedDate);
    } else {
      // Fallback to today
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      selectedDate = todayStr;
      if (dateInput) {
        dateInput.value = todayStr;
      }
      console.log('selectedDate set to today:', selectedDate);
    }
  }
  
  const [hours, minutes] = time.split(':');
  selectedTime = { hour: parseInt(hours), minute: parseInt(minutes) };
  
  console.log('Time selected:', { selectedTime, selectedDate });
  
  // Update time slot UI
  document.querySelectorAll('.time-slot').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.dataset.time === time) {
      btn.classList.add('selected');
    }
  });
  
  // Update staff list to show availability for this time
  await displayModalStaff(tenantId);
  
  // Trigger step 2 check if available
  if (window.checkStep2Complete) {
    window.checkStep2Complete();
  }
}

/**
 * Submit booking
 * @param {string} tenantId - Tenant ID
 */
export async function submitBooking(tenantId) {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();

  if (!name || !phone) {
    showError('Lütfen tüm alanları doldurun.');
    return;
  }

  if (!selectedService || !selectedDate || !selectedTime) {
    showError('Lütfen hizmet, tarih ve saat seçin.');
    return;
  }

  const appointmentDate = new Date(selectedDate);
  const timeHour = typeof selectedTime === 'object' ? selectedTime.hour : parseInt(selectedTime.split(':')[0]);
  const timeMinute = typeof selectedTime === 'object' ? selectedTime.minute : parseInt(selectedTime.split(':')[1]);
  appointmentDate.setHours(timeHour, timeMinute, 0, 0);

  // If "any" staff selected, choose an available staff
  let finalStaffId = selectedStaff;
  const allStaff = getAllStaff();
  
  if (selectedStaff === null && allStaff.length > 0) {
    // Find available staff for this time slot
    const availableStaff = [];
    for (const staff of allStaff) {
      try {
        const service = getServiceById(selectedService);
        let serviceStaffIds = [];
        if (service) {
          serviceStaffIds = service.staffIds || [];
          if (serviceStaffIds.length === 0) {
            serviceStaffIds = allStaff.map(s => s.id);
          }
        } else {
          serviceStaffIds = allStaff.map(s => s.id);
        }

        if (!serviceStaffIds.includes(staff.id)) continue;

        // Check if this staff has an appointment at this time
        const slotStart = Timestamp.fromDate(appointmentDate);
        const slotEnd = new Date(appointmentDate);
        let serviceDuration = 30;
        if (service) {
          serviceDuration = service.durationMin || 30;
        }
        slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration);

        const q = query(
          collection(db, 'tenants', tenantId, 'appointments'),
          where('staffId', '==', staff.id),
          where('startAt', '<', Timestamp.fromDate(slotEnd)),
          where('status', '!=', 'cancelled')
        );
        
        const snapshot = await getDocs(q);
        let isAvailable = true;
        
        snapshot.forEach(doc => {
          const appt = doc.data();
          if (appt.startAt) {
            const apptStart = appt.startAt.toDate();
            const apptEnd = new Date(apptStart);
            const apptDuration = appt.serviceDuration || serviceDuration;
            apptEnd.setMinutes(apptEnd.getMinutes() + apptDuration);
            
            // Check if appointments overlap
            if (apptStart < slotEnd && apptEnd > appointmentDate) {
              isAvailable = false;
            }
          }
        });
        
        if (isAvailable) {
          availableStaff.push(staff.id);
        }
      } catch (e) {
        console.error('Error checking staff availability:', e);
      }
    }
    
    if (availableStaff.length > 0) {
      // Randomly select from available staff
      finalStaffId = availableStaff[Math.floor(Math.random() * availableStaff.length)];
    } else if (allStaff.length > 0) {
      // If all staff are busy, select randomly anyway
      finalStaffId = allStaff[Math.floor(Math.random() * allStaff.length)].id;
    }
  }

  // Get service duration
  let serviceDuration = 30;
  const service = getServiceById(selectedService);
  if (service) {
    serviceDuration = service.durationMin || 30;
  }

  // Check auto-confirm setting
  let initialStatus = 'pending';
  try {
    const businessData = await getBusinessData(tenantId);
    if (businessData && businessData.autoConfirm === true) {
      initialStatus = 'confirmed';
    }
  } catch (e) {
    console.error('Auto-confirm check error:', e);
  }

  try {
    const appointmentData = {
      serviceId: selectedService,
      customerName: name,
      customerPhone: phone,
      startAt: Timestamp.fromDate(appointmentDate),
      status: initialStatus,
      createdAt: Timestamp.now(),
      serviceDuration: serviceDuration
    };

    if (finalStaffId) {
      appointmentData.staffId = finalStaffId;
    }

    await addDoc(collection(db, 'tenants', tenantId, 'appointments'), appointmentData);

    // Show success
    let staffName = 'Uygun personel';
    if (finalStaffId) {
      const staff = getStaffById(finalStaffId);
      if (staff) {
        staffName = staff.name;
      }
    }

    showStep(4);
    const statusText = initialStatus === 'confirmed' ? 'Onaylandı' : 'Beklemede';
    document.getElementById('successDetails').innerHTML = `
      <strong>${name}</strong><br>
      ${appointmentDate.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>
      ${String(timeHour).padStart(2, '0')}:${String(timeMinute).padStart(2, '0')}<br>
      <small style="color: #666;">Personel: ${staffName}</small><br>
      <small style="color: ${initialStatus === 'confirmed' ? '#16a34a' : '#f59e0b'}; font-weight: 600;">Durum: ${statusText}</small>
    `;
  } catch (e) {
    showError('Randevu oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    console.error(e);
  }
}

