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
  ADMIN_PASSWORD: 'Devini@2026'
};

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

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', message: 'API running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Confirm appointment and open WhatsApp to PATIENT
 */
function confirmAndWhatsApp(params) {
  try {
    const appointmentId = params.id;
    const phone = params.phone;
    const name = decodeURIComponent(params.name || '');
    const date = decodeURIComponent(params.date || '');
    const time = decodeURIComponent(params.time || '');
    const service = decodeURIComponent(params.service || '');

    // Update status in sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    let patientEmail = '';

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === appointmentId) {
          sheet.getRange(i + 1, 11).setValue('Confirmed');
          patientEmail = data[i][4];
          break;
        }
      }
    }

    // Create calendar event
    let meetLink = '';
    if (patientEmail) {
      meetLink = createCalendarEvent(appointmentId, name, patientEmail, date, time, service);
    }

    // WhatsApp message TO PATIENT
    let message = `Hello ${name},

This is Dr. Devini's Homeopathy Clinic.

Your appointment is CONFIRMED!

Appointment ID: ${appointmentId}
Date: ${date}
Time: ${time}
Service: ${service}`;

    if (meetLink) {
      message += `

For Online Consultation:
Google Meet: ${meetLink}`;
    }

    message += `

For In-Person Visit:
Dr. Devini's Homeopathy Clinic
Velachery Main Road, Velachery
Chennai - 600042

Contact: +91 8144002155

Please arrive 10 minutes early with any previous medical reports.

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
    <div class="phone-box">
      <p class="phone">+91 ${cleanPhone}</p>
    </div>
    ${meetLink ? '<div class="info" style="color:#1a73e8;">Calendar Event Created with Meet Link</div>' : ''}
    <a href="${whatsappUrl}" target="_blank" class="btn">Send WhatsApp Message</a>
    ${meetLink ? '<a href="' + meetLink + '" target="_blank" class="btn meet-btn">Open Google Meet</a>' : ''}
    <button onclick="window.close()" class="btn close-btn">Close This Window</button>
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
 * Create Google Calendar event with Meet link
 */
function createCalendarEvent(appointmentId, patientName, patientEmail, dateStr, timeStr, service) {
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

    const calendar = CalendarApp.getDefaultCalendar();
    const event = calendar.createEvent(
      `Dr. Devini Clinic - ${patientName} (${service})`,
      startTime,
      endTime,
      {
        description: `Appointment ID: ${appointmentId}\nPatient: ${patientName}\nService: ${service}\n\nDr. Devini's Homeopathy Clinic\nVelachery Main Road, Chennai - 600042\nContact: +91 8144002155`,
        guests: patientEmail,
        sendInvites: true
      }
    );

    event.addPopupReminder(60);
    event.addPopupReminder(15);

    let meetLink = '';
    try {
      const eventId = event.getId().split('@')[0];
      const calendarId = calendar.getId();
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
      }
    } catch (meetError) {
      console.log('Meet link creation failed');
    }

    return meetLink;
  } catch (error) {
    console.error('Calendar error:', error);
    return '';
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
        age: row[5] || '',
        preferredDate: row[6] || '',
        preferredTime: row[7] || '',
        service: row[8] || '',
        healthConcern: row[9] || '',
        status: row[10] || 'Pending',
        notes: row[11] || '',
        consultDate: row[12] || '',
        diagnosis: row[13] || '',
        medicines: row[14] || '',
        followup: row[15] || ''
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

    if (CONFIG.SEND_PATIENT_EMAIL && data.email) {
      sendPatientConfirmation(data, appointmentId);
    }

    return createResponse(true, 'Appointment booked successfully!', { appointmentId: appointmentId });

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
    if (data.status) sheet.getRange(row, 11).setValue(data.status);
    if (data.notes !== undefined) sheet.getRange(row, 12).setValue(data.notes);
    if (data.consultDate !== undefined) sheet.getRange(row, 13).setValue(data.consultDate);
    if (data.diagnosis !== undefined) sheet.getRange(row, 14).setValue(data.diagnosis);
    if (data.medicines !== undefined) sheet.getRange(row, 15).setValue(data.medicines);
    if (data.followup !== undefined) sheet.getRange(row, 16).setValue(data.followup);

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
    const headers = ['Appointment ID', 'Timestamp', 'Name', 'Phone', 'Email', 'Age', 'Preferred Date', 'Preferred Time', 'Service', 'Health Concern', 'Status', 'Notes', 'Consultation Date', 'Diagnosis', 'Medicines Prescribed', 'Next Follow-up'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2E7D32').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const rowData = [
    appointmentId,
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    data.name || '',
    data.phone || '',
    data.email || '',
    data.age || '',
    formatDate(data.date),
    data.time || 'Not specified',
    data.service || '',
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
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
    .appointment-id { background: #E8F5E9; padding: 10px 20px; border-radius: 5px; display: inline-block; font-weight: bold; color: #2E7D32; margin-bottom: 20px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #2E7D32; display: block; margin-bottom: 5px; }
    .value { background: white; padding: 10px 15px; border-radius: 5px; border-left: 3px solid #4CAF50; }
    .urgent { background: #FFF3E0; border: 1px solid #FF9800; padding: 15px; border-radius: 5px; margin-top: 20px; }
    .buttons { margin-top: 25px; text-align: center; }
    .btn { display: inline-block; padding: 14px 30px; text-decoration: none; border-radius: 8px; margin: 8px; font-weight: bold; font-size: 15px; color: #ffffff !important; }
    .btn-call { background: #1976D2; }
    .btn-whatsapp { background: #25D366; }
    .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Appointment Request</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Dr. Devini's Homeopathy Clinic</p>
    </div>
    <div class="content">
      <div class="appointment-id">ID: ${appointmentId}</div>

      <div class="field">
        <span class="label">Patient Name</span>
        <div class="value">${data.name}</div>
      </div>

      <div class="field">
        <span class="label">Phone Number</span>
        <div class="value">${data.phone}</div>
      </div>

      ${data.email ? `
      <div class="field">
        <span class="label">Email</span>
        <div class="value">${data.email}</div>
      </div>
      ` : ''}

      ${data.age ? `
      <div class="field">
        <span class="label">Age</span>
        <div class="value">${data.age} years</div>
      </div>
      ` : ''}

      <div class="field">
        <span class="label">Preferred Date</span>
        <div class="value">${formatDate(data.date)}</div>
      </div>

      <div class="field">
        <span class="label">Preferred Time</span>
        <div class="value">${getTimeLabel(data.time)}</div>
      </div>

      <div class="field">
        <span class="label">Service Required</span>
        <div class="value">${getServiceLabel(data.service)}</div>
      </div>

      ${data.message ? `
      <div class="field">
        <span class="label">Health Concern</span>
        <div class="value">${data.message}</div>
      </div>
      ` : ''}

      <div class="urgent">
        <strong>ACTION REQUIRED:</strong><br>
        Please contact the patient to confirm this appointment.
      </div>

      <div class="buttons">
        <a href="tel:${data.phone}" class="btn btn-call">Call Patient</a>
        <a href="${ScriptApp.getService().getUrl()}?action=confirmWhatsApp&id=${appointmentId}&phone=${data.phone}&name=${encodeURIComponent(data.name)}&date=${encodeURIComponent(formatDate(data.date))}&time=${encodeURIComponent(getTimeLabel(data.time))}&service=${encodeURIComponent(getServiceLabel(data.service))}" class="btn btn-whatsapp">WhatsApp + Confirm</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated notification from your clinic website.</p>
      <p>Velachery, Chennai | +91 81440 02155</p>
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
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; text-align: center; }
    .appointment-id { background: #E8F5E9; padding: 15px 25px; border-radius: 5px; margin: 20px 0; display: inline-block; }
    .appointment-id span { font-size: 24px; font-weight: bold; color: #2E7D32; }
    .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: left; }
    .note { background: #FFF8E1; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #FFC107; }
    .contact { background: #E3F2FD; padding: 15px; border-radius: 5px; margin-top: 15px; }
    .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Dr. Devini's Homeopathy Clinic</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Healing Naturally, Living Fully</p>
    </div>
    <div class="content">
      <h2 style="color: #2E7D32;">Appointment Request Received!</h2>

      <div class="appointment-id">
        Your Appointment ID<br>
        <span>${appointmentId}</span>
      </div>

      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Thank you for choosing Dr. Devini's Homeopathy Clinic.</p>

      <div class="details">
        <p><strong>Preferred Date:</strong> ${formatDate(data.date)}</p>
        <p><strong>Preferred Time:</strong> ${getTimeLabel(data.time)}</p>
        <p><strong>Service:</strong> ${getServiceLabel(data.service)}</p>
      </div>

      <div class="note">
        <strong>What's Next?</strong><br>
        We will contact you within 24 hours to confirm your appointment.
      </div>

      <div class="contact">
        <strong>Need immediate assistance?</strong><br>
        Call: +91 81440 02155<br>
        WhatsApp: +91 81440 02155
      </div>
    </div>
    <div class="footer">
      <p><strong>${CONFIG.CLINIC_NAME}</strong></p>
      <p>Velachery Main Road, Velachery, Chennai - 600042</p>
      <p>Mon-Sat: 9:00 AM - 7:00 PM</p>
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
