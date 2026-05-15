/**
 * Email service types and interfaces
 */

/**
 * Email address with optional name
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Base email options for sending emails
 */
export interface EmailOptions {
  /** Recipient email address(es) */
  to: string | string[] | EmailAddress | EmailAddress[];
  /** Sender email address (optional, uses default if not provided) */
  from?: string | EmailAddress;
  /** Email subject line */
  subject: string;
  /** Plain text content */
  text: string;
  /** HTML content */
  html: string;
  /** Reply-to address */
  replyTo?: string | EmailAddress;
  /** CC recipients */
  cc?: string | string[] | EmailAddress | EmailAddress[];
  /** BCC recipients */
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  /** Custom headers */
  headers?: Record<string, string>;
  /** Attachments (future enhancement) */
  attachments?: EmailAttachment[];
}

/**
 * Email attachment (future enhancement)
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Email template data structure
 */
export interface EmailTemplate {
  /** Unique template name */
  name: string;
  /** Generate subject line from data */
  subject: (data: Record<string, any>) => string;
  /** Generate plain text content from data */
  text: (data: Record<string, any>) => string;
  /** Generate HTML content from data */
  html: (data: Record<string, any>) => string;
}

/**
 * Template rendering options
 */
export interface TemplateOptions {
  /** Recipient email address */
  to: string | EmailAddress;
  /** Template data for rendering */
  data: Record<string, any>;
  /** Optional sender override */
  from?: string | EmailAddress;
  /** Optional reply-to override */
  replyTo?: string | EmailAddress;
}

/**
 * Email provider interface
 * All email service providers must implement this interface
 */
export interface EmailProvider {
  /**
   * Send an email
   * @param options Email options
   * @returns Promise with message ID
   */
  send(options: EmailOptions): Promise<EmailSendResult>;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  /** Message ID from the email provider */
  messageId: string;
  /** Additional response data from provider */
  response?: any;
}

/**
 * Email provider configuration for Brevo
 */
export interface BrevoConfig {
  /** SMTP username */
  user: string;
  /** SMTP password */
  password: string;
  /** Default sender email address */
  from: string;
  /** Default sender name */
  fromName?: string;
  /** SMTP host (default: smtp-relay.brevo.com) */
  host?: string;
  /** SMTP port (default: 587) */
  port?: number;
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  /** Email provider instance */
  provider: EmailProvider;
  /** Default sender email */
  defaultFrom?: string | EmailAddress;
  /** Default reply-to email */
  defaultReplyTo?: string | EmailAddress;
}
