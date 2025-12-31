import nodemailer from 'nodemailer';
import { Appointment } from './scheduler';
import servicesConfig from '../config/services.json';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config = servicesConfig;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
      console.log('Using console logging for email previews instead.');
      this.isConfigured = false;
      return;
    }

    // Configure transporter with explicit STARTTLS settings for Brevo/SendGrid
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // Use SSL only for port 465
      auth: { user, pass },
      requireTLS: port === 587, // Force STARTTLS for port 587
      connectionTimeout: 10000, // 10 second connection timeout
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      }
    });

    this.isConfigured = true;
    console.log(`Email service configured: ${host}:${port}`);
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  private generateConfirmationEmail(appointment: Appointment): { subject: string; html: string; text: string } {
    const { business } = this.config;
    const formattedDate = this.formatDate(appointment.appointmentDate);
    const formattedTime = this.formatTime(appointment.appointmentTime);

    const subject = `Appointment Confirmed - ${business.name}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Appointment Confirmed!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Thank you for booking with us</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">
                Hi <strong>${appointment.customerName}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Your appointment has been successfully booked. Here are the details:
              </p>

              <!-- Appointment Details Card -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br>
                          <span style="color: #333; font-size: 16px; font-weight: 600;">${appointment.serviceName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br>
                          <span style="color: #333; font-size: 16px; font-weight: 600;">${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span><br>
                          <span style="color: #333; font-size: 16px; font-weight: 600;">${formattedTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Duration</span><br>
                          <span style="color: #333; font-size: 16px; font-weight: 600;">${appointment.duration} minutes</span>
                        </td>
                      </tr>
                      ${appointment.staffName ? `<tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Staff Member</span><br>
                          <span style="color: #333; font-size: 16px; font-weight: 600;">${appointment.staffName}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Confirmation #</span><br>
                          <span style="color: #667eea; font-size: 14px; font-weight: 600; font-family: monospace;">${appointment.id.substring(0, 8).toUpperCase()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Location -->
              <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">Location</h3>
                    <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">
                      ${business.name}<br>
                      ${business.address}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Contact Info -->
              <table role="presentation" style="width: 100%; background-color: #fff8e6; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #92690c; font-size: 14px; line-height: 1.6;">
                      <strong>Need to reschedule or cancel?</strong><br>
                      Please contact us at least 24 hours in advance.<br>
                      Phone: ${business.phone}<br>
                      Email: ${business.email}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">
                We look forward to seeing you!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #333; font-size: 14px; font-weight: 600;">${business.name}</p>
              <p style="margin: 0; color: #888; font-size: 13px;">
                ${business.phone} | ${business.email}
              </p>
              <p style="margin: 16px 0 0; color: #aaa; font-size: 12px;">
                This is an automated confirmation email. Please do not reply directly to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
APPOINTMENT CONFIRMED - ${business.name}

Hi ${appointment.customerName},

Your appointment has been successfully booked. Here are the details:

SERVICE: ${appointment.serviceName}
DATE: ${formattedDate}
TIME: ${formattedTime}
DURATION: ${appointment.duration} minutes${appointment.staffName ? `
STAFF MEMBER: ${appointment.staffName}` : ''}
CONFIRMATION #: ${appointment.id.substring(0, 8).toUpperCase()}

LOCATION:
${business.name}
${business.address}

Need to reschedule or cancel?
Please contact us at least 24 hours in advance.
Phone: ${business.phone}
Email: ${business.email}

We look forward to seeing you!

---
${business.name}
${business.phone} | ${business.email}
    `;

    return { subject, html, text };
  }

  async sendConfirmationEmail(appointment: Appointment): Promise<boolean> {
    const { subject, html, text } = this.generateConfirmationEmail(appointment);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';

    if (!this.isConfigured || !this.transporter) {
      // Log email preview to console when not configured
      console.log('\n========== EMAIL PREVIEW ==========');
      console.log(`To: ${appointment.customerEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('---');
      console.log(text);
      console.log('====================================\n');
      return true; // Return true so booking flow continues
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.config.business.name}" <${fromEmail}>`,
        to: appointment.customerEmail,
        subject,
        text,
        html
      });

      console.log(`Confirmation email sent to ${appointment.customerEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
