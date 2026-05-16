/**
 * Example: Send welcome email using @payin/email
 * This example shows how to use the EmailService with Brevo provider
 */

import { EmailService, BrevoProvider, welcomeTemplate } from '../src';

async function main() {
  // 1. Create Brevo provider with configuration
  const brevoProvider = new BrevoProvider({
    user: process.env.BREVO_SMTP_USER || 'your-smtp-user@example.com',
    password: process.env.BREVO_SMTP_PASSWORD || 'your-smtp-password',
    from: process.env.BREVO_FROM_EMAIL || 'noreply@example.com',
    fromName: 'PayIn',
  });

  // 2. Create email service
  const emailService = new EmailService({
    provider: brevoProvider,
    defaultFrom: 'noreply@payin.com',
  });

  // 3. Register welcome template
  emailService.registerTemplate(welcomeTemplate);

  // 4. Preview template (optional, for testing)
  console.log('\n📧 Preview welcome email template:\n');
  const preview = emailService.previewTemplate('welcome', {
    username: 'john_doe',
    email: 'john@example.com',
    loginUrl: 'https://your-payin.example.com/login',
  });

  console.log('Subject:', preview.subject);
  console.log('\nText content:');
  console.log(preview.text);
  console.log('\n' + '='.repeat(60) + '\n');

  // 5. Send welcome email
  try {
    console.log('📧 Sending welcome email to developer@example.com...\n');

    const result = await emailService.sendTemplate('welcome', {
      to: 'developer@example.com',
      data: {
        username: 'john_doe',
        email: 'developer@example.com',
        loginUrl: 'https://your-payin.example.com/login',
      },
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\n🎉 Check your inbox at developer@example.com\n');
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    process.exit(1);
  }
}

main();
