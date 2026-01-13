/**
 * =====================================================
 * DR. DEVINI'S HOMEOPATHY CLINIC
 * Google Apps Script - Backend for Appointment Booking
 * =====================================================
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Copy this entire code and paste it
 * 4. Save the project (Ctrl+S)
 * 5. Click "Deploy" > "New deployment"
 * 6. Select type: "Web app"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click "Deploy" and copy the Web App URL
 * 10. Update the SCRIPT_URL in your website's script.js
 *
 * This script will:
 * - Save appointment data to Google Sheets
 * - Send email notification to the doctor
 * - Send confirmation email to the patient (optional)
 */

// ===== CONFIGURATION =====
const CONFIG = {
  // Doctor's email - CHANGE THIS to Dr. Devini's actual email
  DOCTOR_EMAIL: 'thiruna2394@gmail.com',

  // Clinic name
  CLINIC_NAME: "Dr. Devini's Homeopathy Clinic",

  // Sheet name for appointments
  SHEET_NAME: 'Appointments',

  // Send confirmation email to patient? (requires their email)
  SEND_PATIENT_EMAIL: true,

  // WhatsApp number for notifications (optional)
  WHATSAPP_NUMBER: '918144002155',

  // Admin credentials (SECURE - stored on server, not visible in browser)
  ADMIN_USERNAME: 'Devini',
  ADMIN_PASSWORD: 'Devini@2026'
};

/**
 * Handle GET requests (for testing and admin)
 */
function doGet(e) {
  const action = e.parameter ? e.parameter.action : null;

  // Handle login action
  if (action === 'login') {
    return handleLogin(e.parameter.username, e.parameter.password);
  }

  // If action is getAll, return all appointments for admin
  if (action === 'getAll') {
    return getAllAppointments();
  }

  // Handle confirm and WhatsApp action
  if (action === 'confirmWhatsApp') {
    return confirmAndWhatsApp(e.parameter);
  }

  // Default response
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Dr. Devini\'s Appointment API is running!',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Confirm appointment and redirect to WhatsApp
 */
function confirmAndWhatsApp(params) {
  try {
    const appointmentId = params.id;
    const phone = params.phone;
    const name = params.name;
    const date = params.date;
    const time = params.time;
    const service = params.service;

    // Find and update appointment status
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === appointmentId) {
          sheet.getRange(i + 1, 11).setValue('Confirmed');
          break;
        }
      }
    }

    // WhatsApp message
    const message = `Hello ${name},

This is Dr. Devini's Homeopathy Clinic.

Your appointment is CONFIRMED!

Appointment ID: ${appointmentId}
Date: ${date}
Time: ${time}
Service: ${service}

Address:
Dr. Devini's Homeopathy Clinic
Velachery Main Road, Velachery
Chennai - 600042

Contact: +91 8144002155

Please arrive 10 minutes early with any previous medical reports.

Thank you for choosing us!
Healing Naturally, Living Fully`;

    const whatsappUrl = `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    // Return HTML that redirects to WhatsApp
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to WhatsApp...</title>
  <style>
    body { font-family: Arial; text-align: center; padding: 50px; background: #E8F5E9; }
    .success { color: #2E7D32; font-size: 24px; margin-bottom: 20px; }
    .message { color: #555; margin-bottom: 30px; }
    a { background: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="success">Status Updated to CONFIRMED!</div>
  <div class="message">Redirecting to WhatsApp...</div>
  <a href="${whatsappUrl}">Click here if not redirected</a>
  <script>window.location.href = "${whatsappUrl}";</script>
</body>
</html>`;

    return HtmlService.createHtmlOutput(html);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle admin login (server-side authentication)
 */
function handleLogin(username, password) {
  try {
    if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: 'Login successful'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: 'Invalid username or password'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Login error: ' + error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all appointments for admin panel
 */
function getAllAppointments() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      return createResponse(false, 'No appointments sheet found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
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
      .createTextOutput(JSON.stringify({
        success: true,
        appointments: appointments.reverse()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return createResponse(false, 'Error fetching appointments: ' + error.message);
  }
}

/**
 * Handle POST requests (appointment submissions and admin updates)
 */
function doPost(e) {
  try {
    // Parse the incoming data
    let data;

    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error('No data received');
    }

    // Check if this is an admin update action
    if (data.action === 'update') {
      return updateAppointment(data);
    }

    // Otherwise, it's a new appointment booking
    // Validate required fields
    if (!data.name || !data.phone || !data.date || !data.service) {
      return createResponse(false, 'Missing required fields');
    }

    // Generate appointment ID
    const appointmentId = generateAppointmentId();

    // Save to Google Sheet
    const saved = saveToSheet(data, appointmentId);

    if (!saved) {
      return createResponse(false, 'Failed to save appointment');
    }

    // Send email notification to doctor
    sendDoctorNotification(data, appointmentId);

    // Send confirmation email to patient (if email provided)
    if (CONFIG.SEND_PATIENT_EMAIL && data.email) {
      sendPatientConfirmation(data, appointmentId);
    }

    // Return success response
    return createResponse(true, 'Appointment booked successfully!', {
      appointmentId: appointmentId,
      message: 'We will contact you shortly to confirm your appointment.'
    });

  } catch (error) {
    console.error('Error processing appointment:', error);
    return createResponse(false, 'Server error: ' + error.message);
  }
}

/**
 * Update appointment (admin function)
 */
function updateAppointment(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      return createResponse(false, 'Sheet not found');
    }

    const rowIndex = data.rowIndex;

    // Update status (column 11 - index K)
    if (data.status) {
      sheet.getRange(rowIndex, 11).setValue(data.status);
    }

    // Update notes (column 12 - index L)
    if (data.notes !== undefined) {
      sheet.getRange(rowIndex, 12).setValue(data.notes);
    }

    // Update consultation date (column 13 - index M)
    if (data.consultDate !== undefined) {
      sheet.getRange(rowIndex, 13).setValue(data.consultDate);
    }

    // Update diagnosis (column 14 - index N)
    if (data.diagnosis !== undefined) {
      sheet.getRange(rowIndex, 14).setValue(data.diagnosis);
    }

    // Update medicines (column 15 - index O)
    if (data.medicines !== undefined) {
      sheet.getRange(rowIndex, 15).setValue(data.medicines);
    }

    // Update follow-up date (column 16 - index P)
    if (data.followup !== undefined) {
      sheet.getRange(rowIndex, 16).setValue(data.followup);
    }

    return createResponse(true, 'Appointment updated successfully');

  } catch (error) {
    console.error('Error updating appointment:', error);
    return createResponse(false, 'Error updating: ' + error.message);
  }
}

/**
 * Generate unique appointment ID
 */
function generateAppointmentId() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APT${year}${month}${day}${random}`;
}

/**
 * Save appointment data to Google Sheet
 */
function saveToSheet(data, appointmentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      // Add headers
      const headers = [
        'Appointment ID',
        'Timestamp',
        'Name',
        'Phone',
        'Email',
        'Age',
        'Preferred Date',
        'Preferred Time',
        'Service',
        'Health Concern',
        'Status',
        'Notes'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#2E7D32');
      sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }

    // Prepare row data
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

    // Append the row
    sheet.appendRow(rowData);

    // Auto-resize columns
    sheet.autoResizeColumns(1, 12);

    return true;
  } catch (error) {
    console.error('Error saving to sheet:', error);
    return false;
  }
}

/**
 * Format date for display
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
 * Send email notification to doctor
 */
function sendDoctorNotification(data, appointmentId) {
  try {
    const subject = `[NEW APPOINTMENT] ${data.name} - ${appointmentId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .appointment-id { background: #E8F5E9; padding: 10px 20px; border-radius: 5px; display: inline-block; font-weight: bold; color: #2E7D32; margin-bottom: 20px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #2E7D32; display: block; margin-bottom: 5px; }
          .value { background: white; padding: 10px 15px; border-radius: 5px; border-left: 3px solid #4CAF50; }
          .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
          .urgent { background: #FFF3E0; border: 1px solid #FF9800; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .btn { display: inline-block; padding: 12px 25px; background: #2E7D32; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
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

            <div style="margin-top: 25px; text-align: center;">
              <a href="tel:${data.phone}" class="btn">Call Patient</a>
              <a href="${ScriptApp.getService().getUrl()}?action=confirmWhatsApp&id=${appointmentId}&phone=${data.phone}&name=${encodeURIComponent(data.name)}&date=${encodeURIComponent(formatDate(data.date))}&time=${encodeURIComponent(getTimeLabel(data.time))}&service=${encodeURIComponent(getServiceLabel(data.service))}" class="btn" style="background: #25D366;">WhatsApp + Confirm</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from your clinic website.</p>
            <p>Velachery, Chennai | +91 81440 02155</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const plainBody = `
New Appointment Request
=======================
Appointment ID: ${appointmentId}

Patient Details:
- Name: ${data.name}
- Phone: ${data.phone}
- Email: ${data.email || 'Not provided'}
- Age: ${data.age || 'Not provided'}

Appointment Details:
- Date: ${formatDate(data.date)}
- Time: ${getTimeLabel(data.time)}
- Service: ${getServiceLabel(data.service)}

Health Concern:
${data.message || 'Not specified'}

Please contact the patient to confirm this appointment.
    `;

    GmailApp.sendEmail(CONFIG.DOCTOR_EMAIL, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

    console.log('Doctor notification sent successfully');
  } catch (error) {
    console.error('Error sending doctor notification:', error);
  }
}

/**
 * Send confirmation email to patient
 */
function sendPatientConfirmation(data, appointmentId) {
  try {
    const subject = `Appointment Confirmed - ${CONFIG.CLINIC_NAME} [${appointmentId}]`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .success-icon { font-size: 50px; text-align: center; margin-bottom: 20px; }
          .appointment-id { background: #E8F5E9; padding: 15px 25px; border-radius: 5px; text-align: center; margin: 20px 0; }
          .appointment-id span { font-size: 24px; font-weight: bold; color: #2E7D32; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .details p { margin: 10px 0; }
          .footer { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
          .note { background: #FFF8E1; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #FFC107; }
          .contact { background: #E3F2FD; padding: 15px; border-radius: 5px; margin-top: 15px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Dr. Devini's Homeopathy Clinic</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Healing Naturally, Living Fully</p>
          </div>
          <div class="content">
            <div class="success-icon" style="color: #2E7D32; font-size: 40px; font-weight: bold;">&#10004;</div>
            <h2 style="text-align: center; color: #2E7D32; margin: 0;">Appointment Request Received!</h2>

            <div class="appointment-id">
              Your Appointment ID<br>
              <span>${appointmentId}</span>
            </div>

            <p>Dear <strong>${data.name}</strong>,</p>
            <p>Thank you for choosing Dr. Devini's Homeopathy Clinic. We have received your appointment request with the following details:</p>

            <div class="details">
              <p><strong>Preferred Date:</strong> ${formatDate(data.date)}</p>
              <p><strong>Preferred Time:</strong> ${getTimeLabel(data.time)}</p>
              <p><strong>Service:</strong> ${getServiceLabel(data.service)}</p>
            </div>

            <div class="note">
              <strong>What's Next?</strong><br>
              Our team will contact you within 24 hours to confirm your appointment time. Please keep your phone accessible.
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
      </html>
    `;

    const plainBody = `
Dear ${data.name},

Thank you for choosing Dr. Devini's Homeopathy Clinic!

Your appointment request has been received.

Appointment ID: ${appointmentId}

Details:
- Date: ${formatDate(data.date)}
- Time: ${getTimeLabel(data.time)}
- Service: ${getServiceLabel(data.service)}

Our team will contact you within 24 hours to confirm your appointment.

Contact Us:
Phone: +91 81440 02155
WhatsApp: +91 81440 02155

Address:
Velachery Main Road, Velachery, Chennai - 600042

Thank you,
Dr. Devini's Homeopathy Clinic
    `;

    GmailApp.sendEmail(data.email, subject, plainBody, {
      htmlBody: htmlBody,
      name: CONFIG.CLINIC_NAME
    });

    console.log('Patient confirmation sent successfully');
  } catch (error) {
    console.error('Error sending patient confirmation:', error);
  }
}

/**
 * Get human-readable service label
 */
function getServiceLabel(service) {
  const services = {
    'general': 'General Consultation',
    'pediatric': 'Pediatric Care',
    'women': 'Women\'s Health / PCOS',
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
 * Get human-readable time label
 */
function getTimeLabel(time) {
  const times = {
    'morning': 'Morning (9AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 4PM)',
    'evening': 'Evening (4PM - 7PM)'
  };
  return times[time] || time || 'Not specified';
}

/**
 * Create JSON response
 */
function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString(),
    ...data
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - Run this to test email sending
 */
function testEmailNotification() {
  const testData = {
    name: 'Test Patient',
    phone: '8144002155',
    email: 'test@example.com',
    age: '30',
    date: new Date().toISOString().split('T')[0],
    time: 'morning',
    service: 'general',
    message: 'This is a test appointment'
  };

  const appointmentId = generateAppointmentId();
  sendDoctorNotification(testData, appointmentId);
  console.log('Test email sent! Check your inbox.');
}

/**
 * Setup function - Run this once to create the spreadsheet
 */
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  const headers = [
    'Appointment ID',
    'Timestamp',
    'Name',
    'Phone',
    'Email',
    'Age',
    'Preferred Date',
    'Preferred Time',
    'Service',
    'Health Concern',
    'Status',
    'Notes',
    'Consultation Date',
    'Diagnosis',
    'Medicines Prescribed',
    'Next Follow-up'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#2E7D32');
  sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  console.log('Appointments sheet setup completed with medical columns!');
}

/**
 * Add new medical columns to existing sheet (run this to update)
 */
function addMedicalColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    console.log('Sheet not found. Run initialSetup first.');
    return;
  }

  // Check current headers
  const currentHeaders = sheet.getRange(1, 1, 1, 16).getValues()[0];

  // Add new headers if they don't exist
  const newHeaders = ['Consultation Date', 'Diagnosis', 'Medicines Prescribed', 'Next Follow-up'];

  // Set headers starting from column 13
  sheet.getRange(1, 13, 1, 4).setValues([newHeaders]);
  sheet.getRange(1, 13, 1, 4).setFontWeight('bold');
  sheet.getRange(1, 13, 1, 4).setBackground('#2E7D32');
  sheet.getRange(1, 13, 1, 4).setFontColor('#FFFFFF');
  sheet.autoResizeColumns(13, 4);

  console.log('Medical columns added successfully!');
}
