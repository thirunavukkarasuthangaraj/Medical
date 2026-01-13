/**
 * =====================================================
 * DR. DEVINI'S HOMEOPATHY CLINIC
 * Google Apps Script - Backend for Appointment Booking
 * =====================================================
 */

// ===== CONFIGURATION =====
const CONFIG = {
  DOCTOR_EMAIL: 'thiruna2394@gmail.com',
  CLINIC_NAME: "Dr. Devini's Homeopathy Clinic",
  SHEET_NAME: 'Appointments',
  SEND_PATIENT_EMAIL: true,
  WHATSAPP_NUMBER: '918144002155',
  ADMIN_USERNAME: 'Devini',
  ADMIN_PASSWORD: 'Devini@2026',

  // MSG91 SMS Configuration
  MSG91_AUTH_KEY: 'YOUR_AUTH_KEY_HERE',        // Replace with your MSG91 Auth Key
  MSG91_SENDER_ID: 'NAMMAO',                    // Sender ID from DLT
  MSG91_TEMPLATE_ID: '1207176226012464195',     // Current template (change after new approval)
  SEND_SMS: true                                // Set to false to disable SMS
};

/**
 * Send SMS via MSG91
 * @param {string} phone - Mobile number (10 digits)
 * @param {object} variables - Template variables {name, date, time, appointmentId}
 */
function sendSMS(phone, variables) {
  if (!CONFIG.SEND_SMS) {
    console.log('SMS disabled in config');
    return { success: false, message: 'SMS disabled' };
  }

  try {
    // Clean phone number - remove all non-digits
    let cleanPhone = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;  // Add country code
    } else if (cleanPhone.startsWith('0')) {
      cleanPhone = '91' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('91')) {
      cleanPhone = '91' + cleanPhone;
    }

    console.log('Sending SMS to:', cleanPhone);

    // MSG91 Flow API
    const url = 'https://control.msg91.com/api/v5/flow/';

    // Build payload based on template
    // Current OTP template has 1 variable - combine all info for testing
    // After new template approved, update to use separate variables
    const combinedInfo = `${variables.name} - ${variables.appointmentId} - ${variables.date} ${variables.time}`;

    const payload = {
      flow_id: CONFIG.MSG91_TEMPLATE_ID,
      mobiles: cleanPhone,
      VAR1: combinedInfo
      // Uncomment below after new template is approved:
      // VAR1: variables.name || '',
      // VAR2: variables.appointmentId || '',
      // VAR3: variables.dateTime || ''  // Combined date+time
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'authkey': CONFIG.MSG91_AUTH_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    console.log('MSG91 Response:', JSON.stringify(result));

    if (result.type === 'success') {
      return { success: true, message: 'SMS sent successfully' };
    } else {
      return { success: false, message: result.message || 'SMS failed' };
    }

  } catch (error) {
    console.error('SMS Error:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter ? e.parameter.action : null;

  if (action === 'login') {
    return handleLogin(e.parameter.username, e.parameter.password);
  }

  if (action === 'getAll') {
    return getAllAppointments();
  }

  if (action === 'confirmWhatsApp') {
    return confirmAndWhatsApp(e.parameter);
  }

  if (action === 'checkSlots') {
    return checkSlotAvailability(e.parameter.date);
  }

  // PAYMENT FEATURE - COMMENTED OUT FOR FUTURE USE
  // if (action === 'paymentPage') {
  //   return showPaymentPage(e.parameter);
  // }

  // if (action === 'confirmPayment') {
  //   return processPaymentConfirmation(e.parameter);
  // }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', message: 'API running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Check slot availability for a given date
 * Returns available spots for each time slot (max 3 per slot)
 */
function checkSlotAvailability(dateStr) {
  try {
    const MAX_PER_SLOT = 3;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // All time slots
    const allSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00'
    ];

    // Initialize slot counts
    const slotCounts = {};
    allSlots.forEach(slot => slotCounts[slot] = 0);

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rowDate = data[i][7]; // Preferred Date column
        const rowTime = data[i][8]; // Preferred Time column
        const status = data[i][12]; // Status column

        // Skip cancelled appointments
        if (status && status.toLowerCase() === 'cancelled') continue;

        // Check if date matches
        let dateMatches = false;
        if (rowDate) {
          const rowDateStr = rowDate instanceof Date
            ? rowDate.toISOString().split('T')[0]
            : String(rowDate);

          // Try to match the date
          if (rowDateStr.includes(dateStr) || dateStr.includes(rowDateStr.split('T')[0])) {
            dateMatches = true;
          }
          // Also check formatted date
          if (String(rowDate).includes(dateStr.split('-').reverse().join('/'))) {
            dateMatches = true;
          }
        }

        if (dateMatches && rowTime && slotCounts.hasOwnProperty(rowTime)) {
          slotCounts[rowTime]++;
        }
      }
    }

    // Calculate available spots
    const availability = {};
    allSlots.forEach(slot => {
      availability[slot] = {
        booked: slotCounts[slot],
        available: MAX_PER_SLOT - slotCounts[slot],
        full: slotCounts[slot] >= MAX_PER_SLOT
      };
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, date: dateStr, slots: availability, maxPerSlot: MAX_PER_SLOT }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Confirm appointment and open WhatsApp to PATIENT
 */
function confirmAndWhatsApp(params) {
  console.log('=== CONFIRM AND WHATSAPP START ===');
  console.log('Params received:', JSON.stringify(params));

  try {
    const appointmentId = params.id;
    const phone = params.phone;
    const name = decodeURIComponent(params.name || '');
    const date = decodeURIComponent(params.date || '');
    const time = decodeURIComponent(params.time || '');
    const service = decodeURIComponent(params.service || '');

    console.log('Appointment ID:', appointmentId);
    console.log('Phone:', phone);
    console.log('Name:', name);
    console.log('Date:', date);
    console.log('Time:', time);
    console.log('Service:', service);

    // Update status in sheet and get email
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    let patientEmail = '';
    let debugInfo = 'Debug: ';

    let consultationType = 'offline'; // default

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      // Find column indexes dynamically
      let emailColIndex = -1;
      let statusColIndex = -1;
      let consultTypeColIndex = -1;
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c].toString().toLowerCase();
        if (header.includes('email')) emailColIndex = c;
        if (header === 'status') statusColIndex = c;
        if (header.includes('consultation type')) consultTypeColIndex = c;
      }

      debugInfo += `EmailCol:${emailColIndex}, StatusCol:${statusColIndex}, ConsultTypeCol:${consultTypeColIndex}. `;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === appointmentId) {
          // Update status
          if (statusColIndex >= 0) {
            sheet.getRange(i + 1, statusColIndex + 1).setValue('Confirmed');
          }
          // Get email
          if (emailColIndex >= 0) {
            patientEmail = data[i][emailColIndex];
          }
          // Get consultation type
          if (consultTypeColIndex >= 0) {
            const ct = data[i][consultTypeColIndex].toString().toLowerCase();
            consultationType = ct.includes('online') ? 'online' : 'offline';
          }
          debugInfo += `Found row ${i+1}, Email: ${patientEmail}, Type: ${consultationType}. `;

          // Send SMS on confirmation
          try {
            const smsResult = sendSMS(phone, {
              name: name,
              appointmentId: appointmentId,
              date: date,
              time: time
            });
            debugInfo += `SMS: ${smsResult.success ? 'Sent' : smsResult.message}. `;
          } catch (smsErr) {
            debugInfo += `SMS Error: ${smsErr.message}. `;
          }

          break;
        }
      }
    }

    const isOnline = consultationType === 'online';

    // Create calendar event
    let meetLink = '';
    let calendarError = '';
    let calendarCreated = false;

    if (patientEmail) {
      try {
        const calResult = createCalendarEvent(appointmentId, name, patientEmail, date, time, service, isOnline);
        if (calResult.success) {
          calendarCreated = true;
          meetLink = calResult.meetLink || '';
          debugInfo += `Calendar created (${isOnline ? 'Online' : 'Offline'}). Meet: ${meetLink || 'N/A'}. `;
        } else {
          calendarError = calResult.error || 'Unknown error';
          debugInfo += `Calendar error: ${calendarError}. `;
        }
      } catch (calErr) {
        calendarError = calErr.message;
        debugInfo += `Calendar exception: ${calErr.message}. `;
      }
    } else {
      debugInfo += 'No email found - skipping calendar. ';
    }

    // WhatsApp message TO PATIENT - different for Online vs Offline
    const consultLabel = isOnline ? 'ONLINE VIDEO CONSULTATION' : 'IN-PERSON CLINIC VISIT';

    let message = `Hello ${name},

This is Dr. Devini's Homeopathy Clinic.

Your appointment is CONFIRMED!

*Appointment Details:*
ID: ${appointmentId}
Date: ${date}
Time: ${time}
Service: ${service}
Type: ${consultLabel}`;

    if (isOnline && meetLink) {
      message += `

*Online Consultation Link:*
Google Meet: ${meetLink}

Please join the video call 5 minutes before your scheduled time.`;
    } else if (isOnline && !meetLink) {
      message += `

*Online Consultation:*
You will receive the Google Meet link in your email calendar invite.`;
    } else {
      message += `

*Clinic Address:*
Dr. Devini's Homeopathy Clinic
Velachery Main Road, Velachery
Chennai - 600042

Please arrive 10 minutes early with any previous medical reports.`;
    }

    message += `

Contact: +91 8144002155

Thank you for choosing us!
Healing Naturally, Living Fully`;

    // Clean phone number and create WhatsApp URL TO PATIENT
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Return HTML page with WhatsApp button
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Appointment Confirmed!</title>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; text-align: center; padding: 30px; background: linear-gradient(135deg, #E8F5E9, #C8E6C9); min-height: 100vh; margin: 0; }
    .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .check { width: 80px; height: 80px; background: #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .check svg { width: 40px; height: 40px; fill: white; }
    .success { color: #2E7D32; font-size: 24px; margin-bottom: 10px; font-weight: bold; }
    .info { color: #666; font-size: 16px; margin-bottom: 8px; }
    .phone-box { background: #E3F2FD; padding: 15px; border-radius: 10px; margin: 20px 0; }
    .phone { color: #1976D2; font-size: 22px; font-weight: bold; margin: 0; }
    .btn { display: block; width: 100%; padding: 18px; background: #25D366; color: white; text-decoration: none; border-radius: 12px; font-size: 18px; font-weight: bold; margin: 15px 0; border: none; cursor: pointer; }
    .btn:hover { background: #1DA851; }
    .meet-btn { background: #1a73e8; }
    .meet-btn:hover { background: #1557b0; }
    .close-btn { background: #9E9E9E; font-size: 14px; padding: 12px; }
    .close-btn:hover { background: #757575; }
  </style>
</head>
<body>
  <div class="container">
    <div class="check">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <div class="success">Appointment Confirmed!</div>
    <div class="info">ID: ${appointmentId}</div>
    <div class="info">Patient: ${name}</div>
    <div class="info" style="background:${isOnline ? '#E3F2FD' : '#FFF3E0'};padding:8px 15px;border-radius:5px;color:${isOnline ? '#1565C0' : '#E65100'};font-weight:bold;">
      ${isOnline ? 'ONLINE VIDEO CONSULTATION' : 'IN-PERSON CLINIC VISIT'}
    </div>
    <div class="phone-box">
      <p class="phone">+91 ${cleanPhone}</p>
    </div>
    ${calendarCreated ? '<div class="info" style="color:#2E7D32;">Calendar Event Created</div>' : ''}
    ${meetLink ? '<div class="info" style="color:#1a73e8;">Google Meet Link Generated</div>' : ''}
    ${calendarError ? '<div class="info" style="color:#e53935;">Calendar Error: ' + calendarError + '</div>' : ''}
    <a href="${whatsappUrl}" target="_blank" class="btn">Send WhatsApp Message</a>
    ${isOnline && meetLink ? '<a href="' + meetLink + '" target="_blank" class="btn meet-btn">Open Google Meet</a>' : ''}
    <button onclick="window.close()" class="btn close-btn">Close This Window</button>
    <div style="margin-top:15px;padding:10px;background:#f5f5f5;border-radius:8px;font-size:11px;color:#666;text-align:left;word-break:break-all;">${debugInfo}</div>
  </div>
</body>
</html>`;

    return HtmlService.createHtmlOutput(html);

  } catch (error) {
    const errorHtml = `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body style="font-family:Arial;text-align:center;padding:50px;">
  <h1 style="color:red;">Error Occurred</h1>
  <p>${error.message}</p>
  <p>Please try again or contact support.</p>
</body>
</html>`;
    return HtmlService.createHtmlOutput(errorHtml);
  }
}

/**
 * Create Google Calendar event
 * @param {boolean} isOnline - If true, create with Google Meet link; if false, just reminder
 */
function createCalendarEvent(appointmentId, patientName, patientEmail, dateStr, timeStr, service, isOnline) {
  console.log('=== CREATE CALENDAR EVENT START ===');
  console.log('Appointment ID:', appointmentId);
  console.log('Patient:', patientName);
  console.log('Email:', patientEmail);
  console.log('Date:', dateStr);
  console.log('Time:', timeStr);
  console.log('Service:', service);
  console.log('Is Online:', isOnline);

  try {
    let eventDate = new Date(dateStr);
    if (isNaN(eventDate)) {
      const parts = dateStr.match(/(\d+)/g);
      if (parts && parts.length >= 3) {
        eventDate = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        eventDate = new Date();
        eventDate.setDate(eventDate.getDate() + 1);
      }
    }

    let startHour = 10;
    let startMinute = 0;

    // Handle new format (HH:MM like "09:00", "14:30")
    if (timeStr && timeStr.includes(':')) {
      const [h, m] = timeStr.split(':');
      startHour = parseInt(h);
      startMinute = parseInt(m);
    }
    // Handle old format
    else if (timeStr) {
      const t = timeStr.toLowerCase();
      if (t.includes('morning')) startHour = 10;
      else if (t.includes('afternoon')) startHour = 14;
      else if (t.includes('evening')) startHour = 17;
    }

    const startTime = new Date(eventDate);
    startTime.setHours(startHour, startMinute, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const consultType = isOnline ? 'Online Video Consultation' : 'In-Person Visit';
    const calendar = CalendarApp.getDefaultCalendar();

    let description = `Appointment ID: ${appointmentId}
Patient: ${patientName}
Service: ${service}
Type: ${consultType}

Dr. Devini's Homeopathy Clinic
Velachery Main Road, Chennai - 600042
Contact: +91 8144002155`;

    if (!isOnline) {
      description += `

CLINIC VISIT REMINDER
Please arrive 10 minutes early with previous medical reports.`;
    }

    console.log('Creating calendar event...');
    console.log('Start Time:', startTime);
    console.log('End Time:', endTime);

    // Add both doctor and patient as attendees
    const attendees = patientEmail ? `${patientEmail},${CONFIG.DOCTOR_EMAIL}` : CONFIG.DOCTOR_EMAIL;

    const event = calendar.createEvent(
      `Dr. Devini Clinic - ${patientName} (${consultType})`,
      startTime,
      endTime,
      {
        description: description,
        guests: attendees,
        sendInvites: true
      }
    );

    console.log('✅ CALENDAR EVENT CREATED!');
    console.log('Event ID:', event.getId());

    event.addPopupReminder(60);
    event.addPopupReminder(15);

    let meetLink = '';

    // Only create Google Meet link for ONLINE consultations
    if (isOnline) {
      console.log('Creating Google Meet link for online consultation...');
      try {
        const eventId = event.getId().split('@')[0];
        const calendarId = calendar.getId();
        console.log('Event ID:', eventId);
        console.log('Calendar ID:', calendarId);

        const resource = Calendar.Events.get(calendarId, eventId);
        resource.conferenceData = {
          createRequest: {
            requestId: appointmentId,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
        const updatedEvent = Calendar.Events.patch(resource, calendarId, eventId, { conferenceDataVersion: 1 });
        if (updatedEvent.conferenceData && updatedEvent.conferenceData.entryPoints) {
          meetLink = updatedEvent.conferenceData.entryPoints[0].uri;
          console.log('✅ GOOGLE MEET LINK CREATED:', meetLink);
        }
      } catch (meetError) {
        console.log('❌ Meet link creation failed:', meetError.message);
      }
    } else {
      console.log('Offline consultation - no Meet link needed');
    }

    console.log('=== CREATE CALENDAR EVENT END ===');
    return { success: true, meetLink: meetLink, isOnline: isOnline };
  } catch (error) {
    console.error('❌ CALENDAR ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle admin login
 */
function handleLogin(username, password) {
  const success = (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD);
  return ContentService
    .createTextOutput(JSON.stringify({
      success: success,
      message: success ? 'Login successful' : 'Invalid credentials'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get all appointments for admin panel
 */
function getAllAppointments() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'No sheet found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    const appointments = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      appointments.push({
        rowIndex: i + 1,
        id: row[0] || '',
        timestamp: row[1] || '',
        name: row[2] || '',
        phone: row[3] || '',
        email: row[4] || '',
        gender: row[5] || '',
        age: row[6] || '',
        preferredDate: row[7] || '',
        preferredTime: row[8] || '',
        service: row[9] || '',
        consultationType: row[10] || '',
        healthConcern: row[11] || '',
        status: row[12] || 'Pending',
        notes: row[13] || '',
        consultDate: row[14] || '',
        diagnosis: row[15] || '',
        medicines: row[16] || '',
        followup: row[17] || ''
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, appointments: appointments.reverse() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error('No data received');
    }

    if (data.action === 'update') {
      return updateAppointment(data);
    }

    if (!data.name || !data.phone || !data.date || !data.service) {
      return createResponse(false, 'Missing required fields');
    }

    const appointmentId = generateAppointmentId();

    saveToSheet(data, appointmentId);
    sendDoctorNotification(data, appointmentId);

    // Send confirmation email to patient
    if (CONFIG.SEND_PATIENT_EMAIL && data.email) {
      sendPatientConfirmation(data, appointmentId);
    }

    return createResponse(true, 'Appointment booked successfully! We will contact you soon to confirm.', { appointmentId: appointmentId });

  } catch (error) {
    return createResponse(false, error.message);
  }
}

/**
 * Update appointment
 */
function updateAppointment(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return createResponse(false, 'Sheet not found');

    const row = data.rowIndex;
    if (data.status) sheet.getRange(row, 13).setValue(data.status);
    if (data.notes !== undefined) sheet.getRange(row, 14).setValue(data.notes);
    if (data.consultDate !== undefined) sheet.getRange(row, 15).setValue(data.consultDate);
    if (data.diagnosis !== undefined) sheet.getRange(row, 16).setValue(data.diagnosis);
    if (data.medicines !== undefined) sheet.getRange(row, 17).setValue(data.medicines);
    if (data.followup !== undefined) sheet.getRange(row, 18).setValue(data.followup);

    return createResponse(true, 'Appointment updated successfully');
  } catch (error) {
    return createResponse(false, error.message);
  }
}

/**
 * Generate appointment ID
 */
function generateAppointmentId() {
  const d = new Date();
  const year = d.getFullYear().toString().slice(-2);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APT${year}${month}${day}${random}`;
}

/**
 * Save to Google Sheet
 */
function saveToSheet(data, appointmentId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    const headers = ['Appointment ID', 'Timestamp', 'Name', 'Phone', 'Email', 'Gender', 'Age', 'Preferred Date', 'Preferred Time', 'Service', 'Consultation Type', 'Health Concern', 'Status', 'Notes', 'Consultation Date', 'Diagnosis', 'Medicines Prescribed', 'Next Follow-up'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2E7D32').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const consultType = data.consultationType === 'online' ? 'Online (Video)' : 'In-Person (Clinic)';

  const rowData = [
    appointmentId,
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    data.name || '',
    data.phone || '',
    data.email || '',
    data.gender || '',
    data.age || '',
    formatDate(data.date),
    data.time || 'Not specified',
    data.service || '',
    consultType,
    data.message || '',
    'Pending',
    ''
  ];

  sheet.appendRow(rowData);
  sheet.autoResizeColumns(1, 12);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get service label
 */
function getServiceLabel(service) {
  const services = {
    'general': 'General Consultation',
    'pediatric': 'Pediatric Care',
    'women': "Women's Health / PCOS",
    'skin': 'Skin & Allergies',
    'respiratory': 'Respiratory Care',
    'mental': 'Mental Wellness',
    'chronic': 'Chronic Disease Management',
    'followup': 'Follow-up Consultation',
    'other': 'Other'
  };
  return services[service] || service;
}

/**
 * Get time label
 */
function getTimeLabel(time) {
  if (!time) return 'Not specified';

  // Handle old format
  const oldTimes = {
    'morning': 'Morning (9AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 4PM)',
    'evening': 'Evening (4PM - 7PM)'
  };
  if (oldTimes[time]) return oldTimes[time];

  // Handle new format (HH:MM)
  if (time.includes(':')) {
    const [hours, mins] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hour12}:${mins} ${ampm}`;
  }

  return time;
}

/**
 * Create JSON response
 */
function createResponse(success, message, data = {}) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, message, timestamp: new Date().toISOString(), ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Send email to doctor
 */
function sendDoctorNotification(data, appointmentId) {
  try {
    const subject = `[NEW APPOINTMENT] ${data.name} - ${appointmentId}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f0f0f0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1B5E20, #2E7D32); color: white; padding: 25px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">New Appointment Request</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${CONFIG.CLINIC_NAME}</p>
    </div>

    <!-- Content -->
    <div style="padding: 25px;">

      <!-- Appointment ID -->
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background: #E8F5E9; padding: 8px 20px; border-radius: 20px; font-weight: bold; color: #2E7D32; font-size: 14px;">ID: ${appointmentId}</span>
      </div>

      <!-- Calendar Style Date/Time Box -->
      <div style="background: linear-gradient(135deg, #E3F2FD, #BBDEFB); border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center; border: 2px solid #1976D2;">
        <p style="margin: 0; color: #1565C0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Appointment Schedule</p>
        <p style="margin: 10px 0 5px 0; font-size: 24px; font-weight: 700; color: #0D47A1;">${formatDate(data.date)}</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1976D2;">${getTimeLabel(data.time)}</p>
      </div>

      <!-- Patient Details -->
      <div style="background: #FAFAFA; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 15px 0; font-weight: 600; color: #2E7D32; font-size: 14px; border-bottom: 2px solid #E8F5E9; padding-bottom: 8px;">Patient Details</p>
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #666;">Name</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.phone}</td></tr>
          ${data.email ? `<tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.email}</td></tr>` : ''}
          ${data.gender ? `<tr><td style="padding: 6px 0; color: #666;">Gender</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.gender}</td></tr>` : ''}
          ${data.age ? `<tr><td style="padding: 6px 0; color: #666;">Age</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.age} years</td></tr>` : ''}
          <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${getServiceLabel(data.service)}</td></tr>
        </table>
      </div>

      ${data.message ? `
      <div style="background: #FFF8E1; border-radius: 10px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #FFC107;">
        <p style="margin: 0 0 5px 0; font-weight: 600; color: #F57C00; font-size: 13px;">Health Concern</p>
        <p style="margin: 0; color: #666; font-size: 14px;">${data.message}</p>
      </div>
      ` : ''}

      <!-- Action Required -->
      <div style="background: #FFEBEE; border-radius: 10px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #F44336;">
        <p style="margin: 0; color: #C62828; font-size: 14px;"><strong>ACTION REQUIRED:</strong> Contact patient to confirm appointment.</p>
      </div>

      <!-- Buttons -->
      <div style="text-align: center;">
        <a href="tel:${data.phone}" style="display: inline-block; background: #1976D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 5px; font-weight: bold; font-size: 14px;">📞 Call Patient</a>
        <a href="${ScriptApp.getService().getUrl()}?action=confirmWhatsApp&id=${appointmentId}&phone=${data.phone}&name=${encodeURIComponent(data.name)}&date=${encodeURIComponent(formatDate(data.date))}&time=${encodeURIComponent(getTimeLabel(data.time))}&service=${encodeURIComponent(getServiceLabel(data.service))}" style="display: inline-block; background: #25D366; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 5px; font-weight: bold; font-size: 14px;">💬 WhatsApp + Confirm</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #263238; color: white; padding: 15px; text-align: center; font-size: 12px;">
      <p style="margin: 0;">Automated notification from clinic website</p>
    </div>
  </div>
</body>
</html>`;

    const plainBody = `New Appointment Request
Appointment ID: ${appointmentId}
Patient: ${data.name}
Phone: ${data.phone}
Email: ${data.email || 'Not provided'}
Date: ${formatDate(data.date)}
Time: ${getTimeLabel(data.time)}
Service: ${getServiceLabel(data.service)}
Concern: ${data.message || 'Not specified'}

Please contact the patient to confirm.`;

    GmailApp.sendEmail(CONFIG.DOCTOR_EMAIL, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

  } catch (error) {
    console.error('Email error:', error);
  }
}

/**
 * Send confirmation email to patient
 */
function sendPatientConfirmation(data, appointmentId) {
  try {
    const subject = `Appointment Received - ${CONFIG.CLINIC_NAME} [${appointmentId}]`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f0f0f0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1B5E20, #2E7D32, #43A047); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">${CONFIG.CLINIC_NAME}</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Healing Naturally, Living Fully</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px; text-align: center;">

      <h2 style="color: #2E7D32; margin: 0 0 20px 0; font-size: 20px;">Appointment Request Received!</h2>

      <!-- Appointment ID -->
      <div style="background: #E8F5E9; padding: 15px 25px; border-radius: 10px; margin-bottom: 25px; display: inline-block;">
        <p style="margin: 0; color: #666; font-size: 12px;">Your Appointment ID</p>
        <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: 700; color: #2E7D32;">${appointmentId}</p>
      </div>

      <p style="font-size: 16px; color: #555; margin: 0 0 20px 0;">
        Dear <strong style="color: #2E7D32;">${data.name}</strong>,<br>
        Thank you for choosing us!
      </p>

      <!-- Calendar Style Date/Time Box -->
      <div style="background: linear-gradient(135deg, #E3F2FD, #BBDEFB); border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center; border: 2px solid #1976D2;">
        <p style="margin: 0; color: #1565C0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Appointment</p>
        <p style="margin: 10px 0 5px 0; font-size: 22px; font-weight: 700; color: #0D47A1;">${formatDate(data.date)}</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1976D2;">${getTimeLabel(data.time)}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${getServiceLabel(data.service)}</p>
      </div>

      <!-- What's Next -->
      <div style="background: #FFF8E1; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #FFC107; text-align: left;">
        <p style="margin: 0; font-size: 14px; color: #F57C00;">
          <strong>What's Next?</strong><br>
          We will contact you within 24 hours to confirm your appointment.
        </p>
      </div>

      <!-- Contact -->
      <div style="background: #E8F5E9; padding: 15px; border-radius: 10px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #2E7D32;">
          <strong>Need immediate assistance?</strong><br>
          📞 +91 81440 02155 &nbsp;|&nbsp; 💬 WhatsApp
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #263238; color: white; padding: 20px; text-align: center; font-size: 12px;">
      <p style="margin: 0; font-weight: 600;">${CONFIG.CLINIC_NAME}</p>
      <p style="margin: 5px 0 0 0; opacity: 0.8;">Velachery Main Road, Chennai - 600042</p>
      <p style="margin: 3px 0 0 0; opacity: 0.8;">Mon-Sat: 9:00 AM - 7:00 PM</p>
    </div>
  </div>
</body>
</html>`;

    const plainBody = `Dear ${data.name},

Thank you for choosing Dr. Devini's Homeopathy Clinic!

Your appointment request has been received.
Appointment ID: ${appointmentId}

Details:
- Date: ${formatDate(data.date)}
- Time: ${getTimeLabel(data.time)}
- Service: ${getServiceLabel(data.service)}

We will contact you within 24 hours to confirm.

Contact: +91 81440 02155

Dr. Devini's Homeopathy Clinic
Velachery Main Road, Chennai - 600042`;

    GmailApp.sendEmail(data.email, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

  } catch (error) {
    console.error('Patient email error:', error);
  }
}

/* =====================================================
 * PAYMENT FEATURES - COMMENTED OUT FOR FUTURE USE
 * Uncomment these functions when you want to enable payment
 * =====================================================

/**
 * Send payment link email for online consultations
 *
function sendPaymentLinkEmail(data, appointmentId) {
  try {
    const paymentAmount = 250;
    // Payment link - Replace with actual Razorpay/payment gateway link later
    const paymentLink = `${ScriptApp.getService().getUrl()}?action=paymentPage&id=${appointmentId}&amount=${paymentAmount}&email=${encodeURIComponent(data.email)}&name=${encodeURIComponent(data.name)}`;

    const subject = `Payment Required - Online Consultation [${appointmentId}] - ${CONFIG.CLINIC_NAME}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1B5E20, #2E7D32, #43A047); color: white; padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Complete Your Payment</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Online Video Consultation Booking</p>
    </div>

    <!-- Content -->
    <div style="padding: 35px 30px; text-align: center;">
      <p style="font-size: 16px; color: #555; margin: 0 0 25px 0;">
        Dear <strong style="color: #2E7D32;">${data.name}</strong>,<br>
        Thank you for choosing Dr. Devini's Homeopathy Clinic!
      </p>

      <!-- Amount Box -->
      <div style="background: linear-gradient(135deg, #E8F5E9, #C8E6C9); padding: 30px; border-radius: 12px; margin: 25px 0;">
        <p style="margin: 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Consultation Fee</p>
        <p style="margin: 10px 0 0 0; font-size: 48px; color: #1B5E20; font-weight: 700;">₹${paymentAmount}</p>
      </div>

      <!-- Appointment Details -->
      <div style="background: #FAFAFA; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: left; border: 1px solid #E0E0E0;">
        <p style="margin: 0 0 15px 0; font-weight: 600; color: #2E7D32; font-size: 16px; border-bottom: 2px solid #E8F5E9; padding-bottom: 10px;">Appointment Details</p>
        <table style="width: 100%; font-size: 15px;">
          <tr><td style="padding: 8px 0; color: #888;">Appointment ID</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${appointmentId}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Date</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatDate(data.date)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Time</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${getTimeLabel(data.time)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Service</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${getServiceLabel(data.service)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Type</td><td style="padding: 8px 0; font-weight: 600; color: #1565C0; text-align: right;">Online Video Call</td></tr>
        </table>
      </div>

      <!-- Pay Button -->
      <div style="margin: 30px 0;">
        <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #43A047, #2E7D32, #1B5E20); color: white; padding: 20px 50px; text-decoration: none; border-radius: 50px; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(46,125,50,0.4);">
          COMPLETE PAYMENT
        </a>
        <p style="margin: 15px 0 0 0; color: #888; font-size: 13px;">Click the button above to pay ₹${paymentAmount}</p>
      </div>

      <!-- Note -->
      <div style="background: #FFF8E1; padding: 20px; border-radius: 10px; margin-top: 25px; border-left: 4px solid #FFC107; text-align: left;">
        <p style="margin: 0; font-size: 14px; color: #F57C00;">
          <strong>What happens next?</strong><br>
          After payment, your Google Meet video call link will be sent to this email. Please complete payment at least 1 hour before your appointment.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #263238; color: white; padding: 25px; text-align: center;">
      <p style="margin: 0; font-weight: 600; font-size: 16px;">${CONFIG.CLINIC_NAME}</p>
      <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 13px;">Velachery Main Road, Chennai - 600042</p>
      <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 13px;">📞 +91 81440 02155</p>
    </div>
  </div>
</body>
</html>`;

    const plainBody = `Dear ${data.name},

Thank you for booking an online consultation with Dr. Devini's Homeopathy Clinic.

Appointment ID: ${appointmentId}
Date: ${formatDate(data.date)}
Time: ${getTimeLabel(data.time)}
Service: ${getServiceLabel(data.service)}
Type: Online Video Consultation

PAYMENT REQUIRED: Rs ${paymentAmount}

Please click the link below to complete payment:
${paymentLink}

Your Google Meet link will be sent after successful payment.

Contact: +91 81440 02155

Dr. Devini's Homeopathy Clinic
Velachery Main Road, Chennai - 600042`;

    GmailApp.sendEmail(data.email, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

    console.log('Payment link email sent to:', data.email);

  } catch (error) {
    console.error('Payment link email error:', error);
  }
}

/**
 * Show payment page (placeholder until payment gateway is integrated)
 */
function showPaymentPage(params) {
  const appointmentId = params.id;
  const amount = params.amount || 250;
  const email = decodeURIComponent(params.email || '');
  const name = decodeURIComponent(params.name || '');

  // Get appointment details from sheet
  let appointmentDetails = {};
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === appointmentId) {
          appointmentDetails = {
            date: data[i][7],
            time: data[i][8],
            service: data[i][9]
          };
          break;
        }
      }
    }
  } catch (e) {
    console.log('Error fetching appointment:', e.message);
  }

  // For now, show manual payment instructions
  // Later this will be replaced with Razorpay/UPI payment gateway
  const confirmPaymentUrl = `${ScriptApp.getService().getUrl()}?action=confirmPayment&id=${appointmentId}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Payment - ${CONFIG.CLINIC_NAME}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #E8F5E9, #C8E6C9); min-height: 100vh; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 25px; text-align: center; }
    .header h1 { font-size: 20px; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 25px; }
    .amount-box { background: #E8F5E9; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
    .amount { font-size: 40px; color: #2E7D32; font-weight: bold; }
    .amount-label { color: #666; margin-bottom: 5px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
    .details p { margin: 8px 0; font-size: 14px; }
    .details strong { color: #2E7D32; }
    .payment-methods { margin-bottom: 20px; }
    .payment-methods h3 { color: #2E7D32; margin-bottom: 15px; font-size: 16px; }
    .upi-box { background: #FFF3E0; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #FF9800; }
    .upi-id { font-size: 18px; font-weight: bold; color: #E65100; text-align: center; padding: 10px; background: white; border-radius: 5px; margin: 10px 0; }
    .bank-details { background: #E3F2FD; padding: 15px; border-radius: 10px; }
    .bank-details p { margin: 5px 0; font-size: 13px; }
    .confirm-btn { display: block; width: 100%; padding: 18px; background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; text-decoration: none; text-align: center; margin-top: 20px; }
    .confirm-btn:hover { background: linear-gradient(135deg, #2E7D32, #1B5E20); }
    .note { background: #FFEBEE; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 12px; color: #C62828; }
    .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${CONFIG.CLINIC_NAME}</h1>
      <p>Online Consultation Payment</p>
    </div>
    <div class="content">
      <div class="amount-box">
        <div class="amount-label">Amount to Pay</div>
        <div class="amount">₹${amount}</div>
      </div>

      <div class="details">
        <p><strong>Appointment ID:</strong> ${appointmentId}</p>
        <p><strong>Patient:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${appointmentDetails.date ? '<p><strong>Date:</strong> ' + appointmentDetails.date + '</p>' : ''}
        ${appointmentDetails.time ? '<p><strong>Time:</strong> ' + appointmentDetails.time + '</p>' : ''}
      </div>

      <div class="payment-methods">
        <h3>Payment Methods</h3>

        <div class="upi-box">
          <p style="font-weight: bold; color: #E65100;">UPI Payment</p>
          <div class="upi-id">drdevini@upi</div>
          <p style="font-size: 12px; color: #666;">Scan QR or use UPI ID to pay</p>
        </div>

        <div class="bank-details">
          <p style="font-weight: bold; color: #1565C0; margin-bottom: 10px;">Bank Transfer</p>
          <p><strong>Account Name:</strong> Dr. Devini</p>
          <p><strong>Account No:</strong> XXXXXXXXXXXX</p>
          <p><strong>IFSC:</strong> XXXXXXXXXXX</p>
          <p><strong>Bank:</strong> Bank Name</p>
        </div>
      </div>

      <a href="${confirmPaymentUrl}" class="confirm-btn">I Have Made the Payment</a>

      <div class="note">
        <strong>Note:</strong> After payment, click the button above. Your Google Meet link will be sent to your email once payment is verified.
      </div>
    </div>
    <div class="footer">
      <p>Contact: +91 81440 02155</p>
      <p>Velachery Main Road, Chennai - 600042</p>
    </div>
  </div>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html);
}

/**
 * Process payment confirmation - Update sheet and create calendar event
 */
function processPaymentConfirmation(params) {
  const appointmentId = params.id;
  const email = decodeURIComponent(params.email || '');
  const name = decodeURIComponent(params.name || '');

  console.log('=== PAYMENT CONFIRMATION START ===');
  console.log('Appointment ID:', appointmentId);
  console.log('Email:', email);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error('Sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find column indexes
    let paymentStatusColIndex = -1;
    let statusColIndex = -1;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c].toString().toLowerCase();
      if (header.includes('payment status')) paymentStatusColIndex = c;
      if (header === 'status') statusColIndex = c;
    }

    // If Payment Status column doesn't exist, add it
    if (paymentStatusColIndex === -1) {
      paymentStatusColIndex = headers.length;
      sheet.getRange(1, paymentStatusColIndex + 1).setValue('Payment Status');
      sheet.getRange(1, paymentStatusColIndex + 1).setFontWeight('bold').setBackground('#2E7D32').setFontColor('#FFFFFF');
    }

    let appointmentData = null;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === appointmentId) {
        rowIndex = i + 1;
        appointmentData = {
          name: data[i][2],
          phone: data[i][3],
          email: data[i][4],
          date: data[i][7],
          time: data[i][8],
          service: data[i][9]
        };

        // Update Payment Status to PAID
        sheet.getRange(rowIndex, paymentStatusColIndex + 1).setValue('PAID');
        sheet.getRange(rowIndex, paymentStatusColIndex + 1).setBackground('#C8E6C9').setFontColor('#2E7D32');

        console.log('Payment status updated for row:', rowIndex);
        break;
      }
    }

    if (!appointmentData) {
      throw new Error('Appointment not found');
    }

    // Create calendar event with Google Meet link
    const calResult = createCalendarEvent(
      appointmentId,
      appointmentData.name,
      appointmentData.email,
      appointmentData.date,
      appointmentData.time,
      appointmentData.service,
      true // isOnline = true
    );

    const meetLink = calResult.meetLink || '';

    // Send confirmation email with Meet link
    if (meetLink && appointmentData.email) {
      sendMeetLinkEmail(appointmentData, appointmentId, meetLink);
    }

    // Success page
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Payment Confirmed!</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #E8F5E9, #C8E6C9); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; margin: 0; }
    .container { background: white; max-width: 500px; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); text-align: center; }
    .check { width: 80px; height: 80px; background: #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .check svg { width: 40px; height: 40px; fill: white; }
    .title { color: #2E7D32; font-size: 24px; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 25px; }
    .meet-box { background: #E3F2FD; padding: 20px; border-radius: 10px; margin: 20px 0; }
    .meet-link { font-size: 14px; word-break: break-all; color: #1565C0; }
    .meet-btn { display: inline-block; background: #1a73e8; color: white; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; margin: 15px 0; }
    .meet-btn:hover { background: #1557b0; }
    .info { background: #FFF3E0; padding: 15px; border-radius: 8px; font-size: 14px; color: #E65100; margin-top: 20px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left; }
    .details p { margin: 5px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="check">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <div class="title">Payment Received!</div>
    <div class="subtitle">Your online consultation is confirmed</div>

    <div class="details">
      <p><strong>Appointment ID:</strong> ${appointmentId}</p>
      <p><strong>Patient:</strong> ${appointmentData.name}</p>
      <p><strong>Date:</strong> ${appointmentData.date}</p>
      <p><strong>Time:</strong> ${appointmentData.time}</p>
    </div>

    ${meetLink ? `
    <div class="meet-box">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565C0;">Your Google Meet Link</p>
      <p class="meet-link">${meetLink}</p>
      <a href="${meetLink}" target="_blank" class="meet-btn">Join Google Meet</a>
    </div>
    ` : '<p style="color: #E65100;">Calendar invite has been sent to your email.</p>'}

    <div class="info">
      <strong>Important:</strong><br>
      A calendar invite with the Meet link has been sent to <strong>${appointmentData.email}</strong>.<br>
      Please join 5 minutes before your scheduled time.
    </div>
  </div>
</body>
</html>`;

    return HtmlService.createHtmlOutput(html);

  } catch (error) {
    console.error('Payment confirmation error:', error.message);
    const errorHtml = `<!DOCTYPE html>
<html>
<head><title>Error</title>
<style>
  body { font-family: Arial; text-align: center; padding: 50px; background: #FFEBEE; }
  .container { background: white; padding: 40px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
  h1 { color: #C62828; }
</style>
</head>
<body>
  <div class="container">
    <h1>Something went wrong</h1>
    <p>${error.message}</p>
    <p>Please contact the clinic at +91 81440 02155</p>
  </div>
</body>
</html>`;
    return HtmlService.createHtmlOutput(errorHtml);
  }
}

/**
 * Send email with Google Meet link after payment
 */
function sendMeetLinkEmail(data, appointmentId, meetLink) {
  try {
    const subject = `Your Online Consultation is Confirmed! [${appointmentId}] - ${CONFIG.CLINIC_NAME}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; text-align: center; }
    .meet-box { background: #E3F2FD; padding: 25px; border-radius: 10px; margin: 20px 0; }
    .meet-link { font-size: 14px; word-break: break-all; color: #1565C0; background: white; padding: 10px; border-radius: 5px; display: block; margin: 15px 0; }
    .meet-btn { display: inline-block; background: #1a73e8; color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; }
    .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: left; }
    .paid-badge { background: #C8E6C9; color: #2E7D32; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 15px; }
    .tips { background: #FFF3E0; padding: 15px; border-radius: 5px; text-align: left; margin-top: 20px; }
    .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Online Consultation Confirmed!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${CONFIG.CLINIC_NAME}</p>
    </div>
    <div class="content">
      <div class="paid-badge">✓ PAYMENT RECEIVED</div>

      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Thank you! Your payment has been received and your online consultation is now confirmed.</p>

      <div class="meet-box">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565C0; font-size: 18px;">Your Google Meet Link</p>
        <span class="meet-link">${meetLink}</span>
        <a href="${meetLink}" class="meet-btn">Join Video Call</a>
      </div>

      <div class="details">
        <p><strong>Appointment ID:</strong> ${appointmentId}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time}</p>
        <p><strong>Service:</strong> ${data.service}</p>
      </div>

      <div class="tips">
        <strong>Before your consultation:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Join 5 minutes before your scheduled time</li>
          <li>Ensure stable internet connection</li>
          <li>Find a quiet, well-lit space</li>
          <li>Keep your previous medical reports ready</li>
          <li>Test your camera and microphone</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p><strong>${CONFIG.CLINIC_NAME}</strong></p>
      <p>Contact: +91 81440 02155</p>
      <p>Velachery Main Road, Chennai - 600042</p>
    </div>
  </div>
</body>
</html>`;

    const plainBody = `Dear ${data.name},

Your payment has been received and your online consultation is confirmed!

Appointment ID: ${appointmentId}
Date: ${data.date}
Time: ${data.time}
Service: ${data.service}

GOOGLE MEET LINK:
${meetLink}

Please join 5 minutes before your scheduled time.

Tips:
- Ensure stable internet
- Find a quiet, well-lit space
- Keep medical reports ready
- Test camera and microphone

Contact: +91 81440 02155

${CONFIG.CLINIC_NAME}
Velachery Main Road, Chennai - 600042`;

    GmailApp.sendEmail(data.email, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

    console.log('Meet link email sent to:', data.email);

  } catch (error) {
    console.error('Meet link email error:', error);
  }
}

// END OF PAYMENT FEATURES */

/**
 * TEST FUNCTION - Run this to grant Calendar permission
 * Select this function and click Run
 */
function testCalendarPermission() {
  // This will trigger the Calendar permission prompt
  const calendar = CalendarApp.getDefaultCalendar();
  const calendarName = calendar.getName();
  console.log('Calendar access granted!');
  console.log('Calendar name:', calendarName);

  // Try to create a test event
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 60 * 1000);
  const testEvent = calendar.createEvent('TEST - Delete This', now, later);
  console.log('Test event created:', testEvent.getId());

  // Delete the test event
  testEvent.deleteEvent();
  console.log('Test event deleted');
  console.log('SUCCESS! Calendar permission is working!');
}

/**
 * Initial setup - Run once
 */
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  const headers = [
    'Appointment ID', 'Timestamp', 'Name', 'Phone', 'Email', 'Age',
    'Preferred Date', 'Preferred Time', 'Service', 'Health Concern',
    'Status', 'Notes', 'Consultation Date', 'Diagnosis', 'Medicines Prescribed', 'Next Follow-up'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2E7D32').setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  console.log('Setup completed!');
}
