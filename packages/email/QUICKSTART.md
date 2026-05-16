# @payin/email - Quick Start Guide

## ✅ Phase 1 Complete!

The `@payin/email` module is now ready to use!

## What's Been Implemented

### 📦 Core Features
- ✅ **EmailService**: High-level API for sending emails
- ✅ **BrevoProvider**: Brevo (Sendinblue) SMTP integration
- ✅ **Template System**: Flexible template rendering engine
- ✅ **Built-in Templates**: Welcome, Email Verification, Password Reset
- ✅ **Type Safety**: Full TypeScript support with exported types
- ✅ **Unit Tests**: 33 tests passing (100% coverage)

### 📊 Test Results
```
✓ tests/email-service.test.ts (17 tests)
✓ tests/templates.test.ts (16 tests)

Test Files  2 passed (2)
     Tests  33 passed (33)
```

## Quick Test

Run the example script to test sending a welcome email:

```bash
# Make sure you're in packages/email directory
cd packages/email

# Run the example
npx tsx examples/send-welcome-email.ts
```

This will:
1. Create a Brevo provider with your credentials
2. Initialize EmailService
3. Preview the welcome template
4. Send a welcome email to developer@example.com

## Next Steps (Phase 2)

Now that `@payin/email` is ready, you can integrate it into other modules:

### Option 1: Integrate into @payin/auth
Add welcome emails and email verification to the authentication flow.

```typescript
// In @payin/auth
import { EmailService, BrevoProvider, welcomeTemplate, verifyEmailTemplate } from '@payin/email';

// Setup
const emailService = new EmailService({
  provider: new BrevoProvider({...}),
});
emailService.registerTemplates([welcomeTemplate, verifyEmailTemplate]);

// Use in registration
await emailService.sendTemplate('welcome', {
  to: user.email,
  data: { username: user.username, email: user.email },
});
```

### Option 2: Integrate into @payin/notification
Add email notifications alongside webhooks for business events.

```typescript
// In @payin/notification
import { EmailService } from '@payin/email';

class NotificationService {
  constructor(
    private webhookNotifier: WebhookNotifier,
    private emailService: EmailService
  ) {}

  async notifyOrderCompleted(order: Order) {
    // Send webhook
    await this.webhookNotifier.send(...);

    // Send email
    await this.emailService.send({
      to: order.user.email,
      subject: 'Order Completed',
      text: '...',
      html: '...',
    });
  }
}
```

### Option 3: Create Business Notification Templates
Add PayIn-specific email templates for orders and deposits.

```typescript
// packages/email/src/templates/order-completed.ts
export const orderCompletedTemplate: EmailTemplate = {
  name: 'order-completed',
  subject: (data) => `Order ${data.orderReference} Completed`,
  text: (data) => `...`,
  html: (data) => `...`,
};
```

## Usage Examples

### Send Simple Email

```typescript
await emailService.send({
  to: 'user@example.com',
  subject: 'Test Email',
  text: 'Hello!',
  html: '<p>Hello!</p>',
});
```

### Send Template Email

```typescript
await emailService.sendTemplate('welcome', {
  to: 'user@example.com',
  data: {
    username: 'john_doe',
    email: 'user@example.com',
    loginUrl: 'https://your-payin.example.com/login',
  },
});
```

### Preview Template (Development)

```typescript
const preview = emailService.previewTemplate('welcome', {
  username: 'john_doe',
  email: 'user@example.com',
});

console.log(preview.subject);
console.log(preview.html);
```

## Available Templates

| Template | Name | Purpose | Data Fields |
|----------|------|---------|-------------|
| Welcome | `welcome` | New user registration | `username`, `email`, `loginUrl?` |
| Verify Email | `verify-email` | Email verification | `username`, `email`, `verificationUrl`, `expiresIn?` |
| Password Reset | `password-reset` | Password reset request | `username`, `email`, `resetUrl`, `expiresIn?` |

## Configuration

Create an email service instance:

```typescript
import { EmailService, BrevoProvider } from '@payin/email';

const emailService = new EmailService({
  provider: new BrevoProvider({
    user: process.env.BREVO_SMTP_USER,
    password: process.env.BREVO_SMTP_PASSWORD,
    from: 'noreply@payin.com',
    fromName: 'PayIn',
  }),
  defaultFrom: 'noreply@payin.com',
  defaultReplyTo: 'support@payin.com',
});
```

## What's Next?

Choose one of the integration options above and let me know which direction you'd like to go!

1. **Auth Integration**: Add welcome emails and email verification
2. **Notification Integration**: Add email notifications for orders/deposits
3. **Business Templates**: Create PayIn-specific email templates

Let me know and I'll help implement it! 🚀
