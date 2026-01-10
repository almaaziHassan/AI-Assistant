import nodemailer from 'nodemailer';
import { Appointment } from './scheduler';
import servicesConfig from '../config/services.json';

// Import Brevo SDK
import * as brevo from '@getbrevo/brevo';

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
  private brevoApi: brevo.TransactionalEmailsApi | null = null;
  private config = servicesConfig;
  private isConfigured: boolean = false;
  private useBrevoApi: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    // First try Brevo API (preferred - no port issues)
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (brevoApiKey) {
      const apiInstance = new brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
      this.brevoApi = apiInstance;
      this.isConfigured = true;
      this.useBrevoApi = true;
      console.log('Email service configured: Brevo API');
      return;
    }

    // Fallback to SMTP
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('Email service not configured. Set BREVO_API_KEY or SMTP_* in .env');
      console.log('Using console logging for email previews instead.');
      this.isConfigured = false;
      return;
    }

    // Configure transporter with explicit STARTTLS settings
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      requireTLS: port === 587,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      }
    });

    this.isConfigured = true;
    console.log(`Email service configured: SMTP ${host}:${port}`);
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
    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const fromName = process.env.BREVO_FROM_NAME || this.config.business.name;

    if (!this.isConfigured) {
      // Log email preview to console when not configured
      console.log('\n========== EMAIL PREVIEW ==========');
      console.log(`To: ${appointment.customerEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('---');
      console.log(text);
      console.log('====================================\n');
      return true; // Return true so booking flow continues
    }

    // Use Brevo API if available (preferred - no port blocking issues)
    if (this.useBrevoApi && this.brevoApi) {
      try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.textContent = text;
        sendSmtpEmail.sender = { name: fromName, email: fromEmail };
        sendSmtpEmail.to = [{ email: appointment.customerEmail, name: appointment.customerName }];

        await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        console.log(`Confirmation email sent via Brevo API to ${appointment.customerEmail}`);
        return true;
      } catch (error) {
        console.error('Failed to send confirmation email via Brevo API:', error);
        return false;
      }
    }

    // Fallback to SMTP
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: appointment.customerEmail,
          subject,
          text,
          html
        });

        console.log(`Confirmation email sent via SMTP to ${appointment.customerEmail}`);
        return true;
      } catch (error) {
        console.error('Failed to send confirmation email via SMTP:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Send a generic email
   * Used for verification emails, password reset, etc.
   */
  async sendEmail(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    const { to, subject, html, text } = options;
    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const fromName = process.env.BREVO_FROM_NAME || this.config.business.name;

    if (!this.isConfigured) {
      // Log email preview to console when not configured
      console.log('\n========== EMAIL PREVIEW ==========');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('---');
      console.log(text || 'HTML email - see html content');
      console.log('====================================\n');
      return true;
    }

    // Use Brevo API if available
    if (this.useBrevoApi && this.brevoApi) {
      try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        if (text) sendSmtpEmail.textContent = text;
        sendSmtpEmail.sender = { name: fromName, email: fromEmail };
        sendSmtpEmail.to = [{ email: to }];

        await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        console.log(`Email sent via Brevo API to ${to}`);
        return true;
      } catch (error) {
        console.error('Failed to send email via Brevo API:', error);
        return false;
      }
    }

    // Fallback to SMTP
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          text: text || '',
          html
        });

        console.log(`Email sent via SMTP to ${to}`);
        return true;
      } catch (error) {
        console.error('Failed to send email via SMTP:', error);
        return false;
      }
    }

    return false;
  }

  private generateCancellationEmail(appointment: Appointment): { subject: string; html: string; text: string } {
    const { business } = this.config;
    const formattedDate = this.formatDate(appointment.appointmentDate);
    const formattedTime = this.formatTime(appointment.appointmentTime);

    const subject = `Appointment Cancelled - ${business.name}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Cancellation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Appointment Cancelled</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">We're sorry to see you cancel</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">
                Hi <strong>${appointment.customerName}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Your appointment has been cancelled as requested. Here are the details of the cancelled appointment:
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
                          <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Confirmation #</span><br>
                          <span style="color: #ef4444; font-size: 14px; font-weight: 600; font-family: monospace;">${appointment.id.substring(0, 8).toUpperCase()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Contact Info -->
              <table role="presentation" style="width: 100%; background-color: #fff8e6; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #92690c; font-size: 14px; line-height: 1.6;">
                      <strong>Want to reschedule?</strong><br>
                      You can book a new appointment online or contact us directly.<br>
                      Phone: ${business.phone}<br>
                      Email: ${business.email}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">
                We hope to see you again soon!
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
                This is an automated message. Please do not reply directly to this email.
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
APPOINTMENT CANCELLED - ${business.name}

Hi ${appointment.customerName},

Your appointment has been cancelled as requested. Here are the details:

SERVICE: ${appointment.serviceName}
DATE: ${formattedDate}
TIME: ${formattedTime}
CONFIRMATION #: ${appointment.id.substring(0, 8).toUpperCase()}

Want to reschedule?
You can book a new appointment online or contact us directly.
Phone: ${business.phone}
Email: ${business.email}

We hope to see you again soon!

---
${business.name}
${business.phone} | ${business.email}
    `;

    return { subject, html, text };
  }

  async sendCancellationEmail(appointment: Appointment): Promise<boolean> {
    const { subject, html, text } = this.generateCancellationEmail(appointment);
    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const fromName = process.env.BREVO_FROM_NAME || this.config.business.name;

    if (!this.isConfigured) {
      // Log email preview to console when not configured
      console.log('\n========== EMAIL PREVIEW (CANCELLATION) ==========');
      console.log(`To: ${appointment.customerEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('---');
      console.log(text);
      console.log('====================================\n');
      return true;
    }

    // Use Brevo API if available
    if (this.useBrevoApi && this.brevoApi) {
      try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.textContent = text;
        sendSmtpEmail.sender = { name: fromName, email: fromEmail };
        sendSmtpEmail.to = [{ email: appointment.customerEmail, name: appointment.customerName }];

        await this.brevoApi.sendTransacEmail(sendSmtpEmail);
        console.log(`Cancellation email sent via Brevo API to ${appointment.customerEmail}`);
        return true;
      } catch (error) {
        console.error('Failed to send cancellation email via Brevo API:', error);
        return false;
      }
    }

    // Fallback to SMTP
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: \`"\${fromName}" <\${fromEmail}>\`,
          to: appointment.customerEmail,
          subject,
          text,
          html
        });

        console.log(`Cancellation email sent via SMTP to ${ appointment.customerEmail }`);
        return true;
      } catch (error) {
        console.error('Failed to send cancellation email via SMTP:', error);
        return false;
      }
    }

    return false;
  }
}

export const emailService = new EmailService();
