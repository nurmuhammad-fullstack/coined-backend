const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Create transporter for sending emails
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Check if email is properly configured
const isEmailConfigured = () => {
  return process.env.EMAIL_USER && 
         process.env.EMAIL_PASS && 
         !process.env.EMAIL_USER.includes('your-email');
};

// POST /api/contact/email - Send contact email
router.post('/email', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required: name, email, subject, message' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }

    // Support email
const SUPPORT_EMAIL = 'rahmatullayevnurmuhammad9@gmail.com';
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'support@coined.edu',
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `[CoinEd Contact] ${subject} - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">CoinEd Support Request</h2>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Name:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Email:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Subject:</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${subject}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #475569; vertical-align: top;">Message:</td>
                <td style="padding: 10px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
            <p>This email was sent from CoinEd Help & Support page</p>
          </div>
        </div>
      `,
      text: `CoinEd Support Request\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`
    };

    // Check if email credentials are configured
    if (!isEmailConfigured()) {
      // Demo mode - log email
      console.log('📧 Email would be sent:', {
        to: SUPPORT_EMAIL,
        from: email,
        subject: subject,
        message: message
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Email sent successfully! (Demo mode)',
        demo: true
      });
    }

    // Send the email
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully!' 
    });

  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email. Please try again.' 
    });
  }
});

// GET /api/contact - Health check
router.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Contact API is running',
email: 'rahmatullayevnurmuhammad9@gmail.com'
  });
});

module.exports = router;

