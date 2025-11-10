import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initialize email transporter
 * Supports multiple email providers (Gmail, SendGrid, custom SMTP)
 */
const createTransporter = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';

  if (emailProvider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use app-specific password
      },
    });
  } else if (emailProvider === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else if (emailProvider === 'custom') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else {
    throw new Error(`Unsupported email provider: ${emailProvider}`);
  }
};

/**
 * Send emergency alert email to contact
 * @param {Object} user - User object with id, full_name, email
 * @param {Object} contact - Emergency contact with contact_name, contact_email, contact_phone
 * @param {string} emotion - Detected emotion (e.g., 'sad', 'angry', 'distressed')
 * @param {Date} timestamp - Time of detection
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export async function sendEmergencyAlert(user, contact, emotion, timestamp) {
  try {
    // Validate inputs
    if (!user || !contact || !emotion) {
      console.warn('⚠️  Missing required parameters for emergency alert');
      return false;
    }

    if (!contact.contact_email) {
      console.warn('⚠️  Emergency contact has no email address');
      return false;
    }

    const transporter = createTransporter();

    const formattedTime = timestamp
      ? new Date(timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        })
      : new Date().toLocaleString();

    const userName = user.full_name || 'A user';
    const contactName = contact.contact_name || 'Emergency Contact';

    // Create email content
    const mailOptions = {
      from: process.env.GMAIL_USER || process.env.SMTP_USER,
      to: contact.contact_email,
      subject: `🚨 Emotional Safety Alert for ${userName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🚨 Emotional Safety Alert</h1>
          </div>

          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p style="margin-top: 0; font-size: 16px; color: #333;">
              Hello <strong>${contactName}</strong>,
            </p>

            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              This is an automated safety message from <strong>EmotionSense AI (MantrAI)</strong>.
            </p>

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;">
                Our system detected possible emotional distress during <strong>${userName}'s</strong> recent session.
              </p>
              <p style="margin: 10px 0 0 0; color: #856404; font-weight: bold;">
                ⏰ Time: ${formattedTime}
              </p>
              <p style="margin: 10px 0 0 0; color: #856404; font-weight: bold;">
                😔 Detected Emotion: ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}
              </p>
            </div>

            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              This message is only a precaution so you can reach out and check in with them.
              If you believe they're in immediate danger, please contact them directly or reach out to professional mental health services.
            </p>

            <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1565c0; font-size: 14px;">
                <strong>💡 Next Steps:</strong>
              </p>
              <ul style="margin: 10px 0 0 0; color: #1565c0; font-size: 14px; padding-left: 20px;">
                <li>Reach out to ${userName} for a friendly check-in</li>
                <li>Offer to listen or provide support</li>
                <li>Share helpful resources if needed</li>
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; margin: 10px 0;">
              <em>This is an automated message sent with the user's consent. MantrAI prioritizes your privacy and only sends alerts when emotional distress is detected.</em>
            </p>

            <div style="background-color: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 20px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                MantrAI - Emotional Intelligence Companion
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Emergency Safety Alert for ${userName}

Hello ${contactName},

This is an automated safety message from EmotionSense AI (MantrAI).

Our system detected possible emotional distress during ${userName}'s recent session.
Time: ${formattedTime}
Detected Emotion: ${emotion}

This message is only a precaution so you can reach out and check in with them.
If you believe they're in immediate danger, please contact them directly or reach out to professional mental health services.

Next Steps:
- Reach out to ${userName} for a friendly check-in
- Offer to listen or provide support
- Share helpful resources if needed

---
This is an automated message sent with the user's consent.

MantrAI - Emotional Intelligence Companion
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Emergency alert email sent successfully');
    console.log(`   To: ${contact.contact_email}`);
    console.log(`   Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to send emergency alert email:', error.message);
    return false;
  }
}

/**
 * Send test email to verify configuration
 * @param {string} recipientEmail - Email to send test message to
 * @returns {Promise<boolean>} - True if test email sent successfully
 */
export async function sendTestEmail(recipientEmail) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.GMAIL_USER || process.env.SMTP_USER,
      to: recipientEmail,
      subject: '✅ MantrAI Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">✅ Email Configuration Test</h2>
          <p>This is a test email to verify that your MantrAI email configuration is working correctly.</p>
          <p>If you received this email, your email service is properly configured!</p>
          <p style="color: #999; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully to:', recipientEmail);
    return true;
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    return false;
  }
}

/**
 * Verify email transporter configuration
 * @returns {Promise<boolean>} - True if transporter is working
 */
export async function verifyEmailConfig() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email configuration verification failed:', error.message);
    return false;
  }
}

export default {
  sendEmergencyAlert,
  sendTestEmail,
  verifyEmailConfig,
};
