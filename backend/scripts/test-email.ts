import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

import { emailService } from '../src/services/email';

const toEmail = process.argv[2];

if (!toEmail) {
    console.error('\nUsage: npm run test:email <email-address>');
    console.error('Example: npm run test:email myemail@example.com\n');
    process.exit(1);
}

console.log(`\n📧 Attempting to send test email to: ${toEmail}`);
console.log('Using configuration from .env file...');

async function run() {
    try {
        const success = await emailService.sendEmail({
            to: toEmail,
            subject: 'Test Email from AI Receptionist',
            html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
          <h1 style="color: #4F46E5;">Email Integration Test</h1>
          <p>This is a test email to verify your email service configuration.</p>
          <p><strong>Status:</strong> ✅ Operational</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
            text: 'This is a test email to verify your email service configuration. Status: Operational.'
        });

        if (success) {
            console.log('\n✅ Email sent successfully!');
            console.log('Check your inbox (and spam folder).If using Ethereal/Console, check the logs above.');
            process.exit(0);
        } else {
            console.error('\n❌ Failed to send email.');
            console.error('Please check your .env configuration (BREVO_API_KEY or SMTP_*).');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Unexpected error:', error);
        process.exit(1);
    }
}

run();
