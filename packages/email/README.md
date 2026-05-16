# @payin/email

Email service module for PayIn - Multi-chain stablecoin payment system.

## Features

- ✅ **Provider abstraction**: Easy to switch between email providers
- ✅ **Template system**: Pre-built templates for common use cases
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Flexible**: Support for plain text, HTML, and attachments
- ✅ **Tested**: Comprehensive unit tests

## Installation

```bash
cd packages/email
npm install
```

## Quick Start

### Basic Usage

```typescript
import { EmailService, BrevoProvider } from '@payin/email';

// 1. Create provider
const provider = new BrevoProvider({
  user: 'your-smtp-user',
  password: 'your-smtp-password',
  from: 'noreply@payin.com',
  fromName: 'PayIn',
});

// 2. Create email service
const emailService = new EmailService({
  provider,
  defaultFrom: 'noreply@payin.com',
});

// 3. Send email
await emailService.send({
  to: 'user@example.com',
  subject: 'Hello from PayIn',
  text: 'Hello! This is a test email.',
  html: '<p>Hello! This is a test email.</p>',
});
```

### Using Templates

```typescript
import { welcomeTemplate } from '@payin/email';

// Register template
emailService.registerTemplate(welcomeTemplate);

// Send email using template
await emailService.sendTemplate('welcome', {
  to: 'user@example.com',
  data: {
    username: 'john_doe',
    email: 'user@example.com',
    loginUrl: 'https://your-payin.example.com/login',
  },
});
```

### Preview Template (Development/Testing)

```typescript
// Preview template without sending
const preview = emailService.previewTemplate('welcome', {
  username: 'john_doe',
  email: 'user@example.com',
  loginUrl: 'https://your-payin.example.com/login',
});

console.log('Subject:', preview.subject);
console.log('Text:', preview.text);
console.log('HTML:', preview.html);
```

## Built-in Templates

### Welcome Email

Sent when a new user registers.

```typescript
import { welcomeTemplate, type WelcomeTemplateData } from '@payin/email';

emailService.registerTemplate(welcomeTemplate);

await emailService.sendTemplate('welcome', {
  to: 'user@example.com',
  data: {
    username: 'john_doe',
    email: 'user@example.com',
    loginUrl: 'https://your-payin.example.com/login', // optional
  },
});
```

### Verify Email

Sent to verify user's email address.

```typescript
import { verifyEmailTemplate, type VerifyEmailTemplateData } from '@payin/email';

emailService.registerTemplate(verifyEmailTemplate);

await emailService.sendTemplate('verify-email', {
  to: 'user@example.com',
  data: {
    username: 'john_doe',
    email: 'user@example.com',
    verificationUrl: 'https://your-payin.example.com/verify/abc123',
    expiresIn: '24 hours', // optional
  },
});
```

### Password Reset

Sent when user requests password reset.

```typescript
import { passwordResetTemplate, type PasswordResetTemplateData } from '@payin/email';

emailService.registerTemplate(passwordResetTemplate);

await emailService.sendTemplate('password-reset', {
  to: 'user@example.com',
  data: {
    username: 'john_doe',
    email: 'user@example.com',
    resetUrl: 'https://your-payin.example.com/reset/abc123',
    expiresIn: '1 hour', // optional
  },
});
```

## Creating Custom Templates

```typescript
import { EmailTemplate } from '@payin/email';

const customTemplate: EmailTemplate = {
  name: 'custom-notification',
  subject: (data) => `Notification: ${data.title}`,
  text: (data) => `Hello ${data.username},\n\n${data.message}`,
  html: (data) => `
    <div>
      <p>Hello ${data.username},</p>
      <p>${data.message}</p>
    </div>
  `,
};

emailService.registerTemplate(customTemplate);
```

## Configuration

### Brevo Provider

```typescript
const provider = new BrevoProvider({
  user: 'your-smtp-user',           // Required: SMTP username
  password: 'your-smtp-password',   // Required: SMTP password
  from: 'noreply@payin.com',        // Required: Default sender email
  fromName: 'PayIn',                // Optional: Default sender name
  host: 'smtp-relay.brevo.com',     // Optional: SMTP host (default)
  port: 587,                        // Optional: SMTP port (default)
});
```

### Email Service

```typescript
const emailService = new EmailService({
  provider: provider,                     // Required: Email provider
  defaultFrom: 'noreply@payin.com',       // Optional: Default sender
  defaultReplyTo: 'support@payin.com',    // Optional: Default reply-to
});
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the package
npm run build
```

## Development

```bash
# Watch mode for development
npm run dev

# Run example
npx tsx examples/send-welcome-email.ts
```

## API Reference

### EmailService

- `send(options: EmailOptions): Promise<EmailSendResult>` - Send an email
- `sendTemplate(name: string, options: TemplateOptions): Promise<EmailSendResult>` - Send using template
- `registerTemplate(template: EmailTemplate): void` - Register a template
- `registerTemplates(templates: EmailTemplate[]): void` - Register multiple templates
- `previewTemplate(name: string, data: Record<string, any>): { subject, text, html }` - Preview template
- `getTemplate(name: string): EmailTemplate | undefined` - Get template by name
- `getTemplateNames(): string[]` - Get all registered template names

### BrevoProvider

- `send(options: EmailOptions): Promise<EmailSendResult>` - Send email via Brevo SMTP
- `verify(): Promise<boolean>` - Verify SMTP connection
- `close(): void` - Close SMTP connection

## License

MIT
