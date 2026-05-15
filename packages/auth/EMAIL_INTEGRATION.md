# Email Integration for Auth Module

## Overview

The Auth module now supports email notifications for user registration, including:
- ✅ Welcome emails when users register
- ✅ Email verification with secure tokens
- ✅ Resend verification email functionality
- ✅ Email verification status checking

## Features

### 1. Welcome Email
Automatically sent when a user registers successfully.
- Welcomes the user to PayIn
- Includes a login link (if configured)
- Uses simple, professional design

### 2. Email Verification
Secure email verification flow with token-based system.
- 24-hour expiration for security
- One-time use tokens
- Automatic database tracking

### 3. API Endpoints

#### Verify Email
```
GET /api/v1/auth/verify-email/:token
```
Verifies user's email address with the provided token.

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "userId": "user-uuid"
}
```

#### Resend Verification Email
```
POST /api/v1/auth/resend-verification
```
Resends verification email to authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

#### Check Verification Status
```
GET /api/v1/auth/email-verification-status
```
Checks if the authenticated user's email is verified.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "isVerified": true
}
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Brevo SMTP Configuration
BREVO_SMTP_USER=your-smtp-user@smtp-brevo.com
BREVO_SMTP_PASSWORD=your-smtp-password
BREVO_FROM_EMAIL=noreply@payin.com

# Application Base URL (for email links)
BASE_URL=https://payin.com
# Or for development:
# BASE_URL=http://localhost:3000
```

### Getting Brevo Credentials

1. **Sign up for Brevo**: https://www.brevo.com
2. **Navigate to SMTP & API** → **SMTP**
3. **Get your credentials**:
   - SMTP Server: `smtp-relay.brevo.com`
   - Login (Username): Your SMTP login email
   - Password: Your SMTP password

### Verify Your Domain (Optional but Recommended)

1. **Go to Brevo Dashboard** → **Senders & IP** → **Domains**
2. **Add your domain** (e.g., `payin.com`)
3. **Add DNS records**:
   - SPF: `v=spf1 include:spf.brevo.com ~all`
   - DKIM: (provided by Brevo)
   - DMARC: `v=DMARC1; p=none; rua=mailto:noreply@payin.com`

## Database Schema

A new table `email_verifications` tracks verification tokens:

```sql
CREATE TABLE email_verifications (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

## Usage Examples

### Backend Integration

```typescript
import { AuthManager } from '@payin/auth';
import { EmailService, BrevoProvider, welcomeTemplate, verifyEmailTemplate } from '@payin/email';

// Initialize email service
const emailService = new EmailService({
  provider: new BrevoProvider({
    user: process.env.BREVO_SMTP_USER!,
    password: process.env.BREVO_SMTP_PASSWORD!,
    from: 'noreply@payin.com',
    fromName: 'PayIn',
  }),
});

emailService.registerTemplates([welcomeTemplate, verifyEmailTemplate]);

// Initialize AuthManager with email service
const authManager = new AuthManager({
  connectionString: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  emailService,
  baseUrl: 'https://payin.com',
});

// Register a user (emails sent automatically)
const user = await authManager.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
});
```

### Frontend Integration

#### Registration Flow

```typescript
// 1. Register user
const response = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'john_doe',
    email: 'john@example.com',
    password: 'SecurePass123!',
  }),
});

// User receives welcome email and verification email
```

#### Email Verification Page

```typescript
// 2. User clicks link in email, frontend extracts token from URL
const token = window.location.pathname.split('/verify-email/')[1];

// 3. Verify email
const response = await fetch(`/api/v1/auth/verify-email/${token}`);
const result = await response.json();

if (result.success) {
  console.log('Email verified!');
  // Redirect to login or dashboard
}
```

#### Resend Verification

```typescript
// Resend verification email
const response = await fetch('/api/v1/auth/resend-verification', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
  },
});

const result = await response.json();
console.log(result.message); // "Verification email sent"
```

## Testing

### Manual Testing

1. **Start the API server** with email configuration:
   ```bash
   BREVO_SMTP_USER=your-user \
   BREVO_SMTP_PASSWORD=your-password \
   BREVO_FROM_EMAIL=noreply@payin.com \
   BASE_URL=http://localhost:3000 \
   npm run dev
   ```

2. **Register a new user**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "email": "your-email@gmail.com",
       "password": "Test1234!"
     }'
   ```

3. **Check your email** for:
   - Welcome email
   - Verification email with link

4. **Click verification link** or use the API:
   ```bash
   curl http://localhost:3000/api/v1/auth/verify-email/<token>
   ```

### Email Disabled Mode

If email credentials are not configured, the system will:
- ✅ Still allow user registration
- ⚠️  Log a warning about email being disabled
- ❌ Not send welcome or verification emails
- ✅ Continue to function normally

This allows development without email configuration.

## Troubleshooting

### Emails Not Sending

1. **Check environment variables are set**:
   ```bash
   echo $BREVO_SMTP_USER
   echo $BREVO_SMTP_PASSWORD
   ```

2. **Check logs** for email initialization:
   ```
   ✅ Email service initialized
   ```
   Or warning:
   ```
   ⚠️  Email service not configured
   ```

3. **Verify Brevo account** is active and not in sandbox mode

4. **Check sender email** is verified in Brevo dashboard

### Verification Token Expired

Tokens expire after 24 hours. Users can:
- Request a new verification email via `/api/v1/auth/resend-verification`
- The system will generate a new token

### Email Goes to Spam

To improve deliverability:
1. ✅ Verify your domain in Brevo
2. ✅ Set up SPF, DKIM, and DMARC records
3. ✅ Use a professional "from" email (noreply@yourdomain.com)
4. ✅ Keep email content simple and professional
5. ✅ Avoid promotional language

## Security Considerations

1. **Token Security**:
   - Tokens are 32-byte random hex strings (256-bit security)
   - One-time use (marked as verified after first use)
   - 24-hour expiration

2. **Email Verification**:
   - Not required for login (optional verification flow)
   - Can be enforced in future by checking `isEmailVerified()`

3. **Rate Limiting** (Recommended):
   - Implement rate limiting on resend verification endpoint
   - Prevent abuse of email sending

## Future Enhancements

Potential additions:
- [ ] Password reset via email
- [ ] Email change with verification
- [ ] Login notification emails
- [ ] Suspicious activity alerts
- [ ] Email templates customization UI
- [ ] Multiple email providers (SendGrid, AWS SES)

## License

MIT
