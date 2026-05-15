/**
 * @payin/email - Email service module
 * Main entry point for the email service
 */

// Core service
export { EmailService } from './email-service';

// Providers
export { BrevoProvider } from './providers/brevo-provider';

// Types
export type {
  EmailAddress,
  EmailOptions,
  EmailTemplate,
  TemplateOptions,
  EmailProvider,
  EmailSendResult,
  BrevoConfig,
  EmailServiceConfig,
  EmailAttachment,
} from './types';

// Templates
export {
  welcomeTemplate,
  verifyEmailTemplate,
  passwordResetTemplate,
  type WelcomeTemplateData,
  type VerifyEmailTemplateData,
  type PasswordResetTemplateData,
} from './templates';
