# Auth Email Integration - Quick Start

## 🎉 Implementation Complete!

The Auth module now has full email integration for registration and verification!

## ✅ What's Been Implemented

### 1. Database Schema
- ✅ `email_verifications` table for tracking verification tokens
- ✅ Automatic schema creation in Auth initialization

### 2. AuthManager Enhancements
- ✅ Email service integration
- ✅ Automatic welcome email on registration
- ✅ Automatic verification email with secure token
- ✅ `verifyEmail(token)` method
- ✅ `isEmailVerified(userId)` method
- ✅ `resendVerificationEmail(userId)` method

### 3. API Endpoints
- ✅ `GET /api/v1/auth/verify-email/:token` - Verify email
- ✅ `POST /api/v1/auth/resend-verification` - Resend verification
- ✅ `GET /api/v1/auth/email-verification-status` - Check status

### 4. Email Templates
- ✅ Welcome email template
- ✅ Email verification template
- ✅ Professional, simple design

### 5. Configuration
- ✅ Environment variable support
- ✅ Brevo SMTP integration
- ✅ Graceful degradation (works without email config)

## 🚀 Quick Setup

### Step 1: Install Dependencies

```bash
cd packages/auth
npm install
```

The `@payin/email` dependency is already added to `package.json`.

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Brevo SMTP Configuration
BREVO_SMTP_USER=your-smtp-user@example.com
BREVO_SMTP_PASSWORD=your-smtp-password
BREVO_FROM_EMAIL=noreply@payin.com

# Application Base URL
BASE_URL=http://localhost:3000
```

### Step 3: Initialize Database

The `email_verifications` table will be created automatically when you run:

```bash
INIT_DB=true npm run dev
```

### Step 4: Test Registration

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "your-email@gmail.com",
    "password": "Test1234!"
  }'
```

You should receive:
1. ✅ Welcome email
2. ✅ Verification email with link

### Step 5: Verify Email

Extract the token from the verification email URL and verify:

```bash
curl http://localhost:3000/api/v1/auth/verify-email/<token>
```

## 📊 Registration Flow

```
1. User registers
   POST /api/v1/auth/register
   ↓
2. User created in database
   ↓
3. Welcome email sent (if email service configured)
   ↓
4. Verification token generated
   ↓
5. Verification email sent
   ↓
6. User clicks verification link
   GET /api/v1/auth/verify-email/:token
   ↓
7. Email verified ✅
```

## 🧪 Testing Without Email

If you don't configure email credentials:
- ✅ Registration still works normally
- ⚠️  Warning logged: "Email service not configured"
- ❌ No emails sent
- ✅ All other features work

This is perfect for development/testing!

## 📧 Email Templates

### Welcome Email
- Subject: "Welcome to PayIn, {username}!"
- Content: Simple welcome message
- Link: Login page (optional)

### Verification Email
- Subject: "Verify Your Email Address - PayIn"
- Content: Verification instructions
- Link: Verification URL with token
- Expiration: 24 hours

## 🔒 Security Features

1. **Secure Tokens**:
   - 32-byte random hex (256-bit security)
   - One-time use
   - 24-hour expiration

2. **Database Tracking**:
   - All verifications logged
   - Timestamps for audit trail
   - User association

3. **Graceful Errors**:
   - Email failures don't block registration
   - Clear error messages
   - Logging for debugging

## 🔧 Configuration Options

### AuthManager Options

```typescript
new AuthManager({
  connectionString: string,    // Required: Database URL
  jwtSecret: string,           // Required: JWT secret
  tokenExpiration?: string,    // Optional: Default '24h'
  emailService?: EmailService, // Optional: Email service
  baseUrl?: string,            // Optional: For email links
})
```

### Email Service Setup

```typescript
import { EmailService, BrevoProvider, welcomeTemplate, verifyEmailTemplate } from '@payin/email';

const emailService = new EmailService({
  provider: new BrevoProvider({
    user: process.env.BREVO_SMTP_USER!,
    password: process.env.BREVO_SMTP_PASSWORD!,
    from: 'noreply@payin.com',
    fromName: 'PayIn',
  }),
});

emailService.registerTemplates([welcomeTemplate, verifyEmailTemplate]);
```

## 📝 API Usage Examples

### Check Verification Status

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/auth/email-verification-status
```

Response:
```json
{
  "success": true,
  "isVerified": true
}
```

### Resend Verification

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/auth/resend-verification
```

Response:
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

## 🐛 Troubleshooting

### "Email service not configured"
- Check environment variables are set
- Verify Brevo credentials are correct

### "Verification token expired"
- Token expires after 24 hours
- Use resend verification endpoint

### Emails go to spam
- Verify domain in Brevo dashboard
- Add SPF/DKIM/DMARC DNS records

## 📚 Full Documentation

For complete details, see:
- **EMAIL_INTEGRATION.md** - Full integration guide
- **@payin/email README** - Email module documentation
- **API Routes** - apps/api/src/routes/auth.ts

## 🎯 Next Steps

Now that email integration is complete, you can:

1. **Test the full flow** with real email
2. **Add email verification requirement** to protected routes
3. **Customize email templates** for your brand
4. **Add password reset email** (future enhancement)
5. **Implement email change** with verification

## ✨ Success Checklist

- [x] Email module created and tested
- [x] Database schema updated
- [x] AuthManager integration
- [x] API routes added
- [x] Environment variables configured
- [x] Documentation complete
- [ ] Test with real registration
- [ ] Verify emails received
- [ ] Test verification flow

Ready to test! 🚀
