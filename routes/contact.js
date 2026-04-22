const express = require('express');
const { Resend } = require('resend');

const router = express.Router();

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || null;
const FROM_EMAIL = 'no-reply@novdaunion.uz';
const FROM_NAME = 'CoinEd';

const createResendClient = () => new Resend(process.env.RESEND_API_KEY);

const isEmailConfigured = () => {
  return Boolean(
    SUPPORT_EMAIL &&
    process.env.RESEND_API_KEY &&
    !process.env.RESEND_API_KEY.includes('replace') &&
    !process.env.RESEND_API_KEY.includes('your_')
  );
};

// POST /api/contact/email - Send contact email
router.post('/email', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, subject, message'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const emailPayload = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [SUPPORT_EMAIL],
      replyTo: email,
      subject: `[CoinEd Contact] ${subject} - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0;">DevUp Support Request</h2>
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
            <p>This email was sent from the CoinEd Help & Support page</p>
          </div>
        </div>
      `,
      text: `CoinEd Support Request\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`
    };

    if (!isEmailConfigured()) {
      console.log('Email would be sent:', {
        to: SUPPORT_EMAIL || 'support-email-not-configured',
        from: FROM_EMAIL,
        replyTo: email,
        subject,
        message
      });

      return res.status(200).json({
        success: true,
        message: 'Email sent successfully! (Demo mode)',
        demo: true
      });
    }

    const resend = createResendClient();
    await resend.emails.send(emailPayload);

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
    email: SUPPORT_EMAIL,
    configured: Boolean(SUPPORT_EMAIL)
  });
});

module.exports = router;
