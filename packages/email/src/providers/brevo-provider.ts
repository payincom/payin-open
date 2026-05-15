/**
 * Brevo (formerly Sendinblue) email provider implementation
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type {
  EmailProvider,
  EmailOptions,
  EmailSendResult,
  BrevoConfig,
  EmailAddress,
} from '../types';

/**
 * Brevo SMTP email provider
 * Uses Brevo's SMTP relay to send transactional emails
 */
export class BrevoProvider implements EmailProvider {
  private transporter: Transporter;
  private defaultFrom: string;

  /**
   * Create a Brevo provider instance
   * @param config Brevo configuration
   */
  constructor(config: BrevoConfig) {
    // Validate config
    if (!config.user || !config.password) {
      throw new Error('BrevoProvider requires user and password');
    }
    if (!config.from) {
      throw new Error('BrevoProvider requires default from address');
    }

    // Create nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: config.host || 'smtp-relay.brevo.com',
      port: config.port || 587,
      secure: false, // Use STARTTLS
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Set default from address
    this.defaultFrom = config.fromName
      ? `"${config.fromName}" <${config.from}>`
      : config.from;
  }

  /**
   * Send an email via Brevo SMTP
   * @param options Email options
   * @returns Send result with message ID
   */
  async send(options: EmailOptions): Promise<EmailSendResult> {
    try {
      // Prepare mail options
      const mailOptions = {
        from: this.formatAddress(options.from) || this.defaultFrom,
        to: this.formatAddresses(options.to),
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo ? this.formatAddress(options.replyTo) : undefined,
        cc: options.cc ? this.formatAddresses(options.cc) : undefined,
        bcc: options.bcc ? this.formatAddresses(options.bcc) : undefined,
        headers: options.headers,
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      return {
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      throw new Error(
        `Failed to send email via Brevo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Format a single email address
   * @param address Email address string or object
   * @returns Formatted address string
   */
  private formatAddress(address: string | EmailAddress | undefined): string | undefined {
    if (!address) {
      return undefined;
    }

    if (typeof address === 'string') {
      return address;
    }

    return address.name ? `"${address.name}" <${address.email}>` : address.email;
  }

  /**
   * Format multiple email addresses
   * @param addresses Email addresses
   * @returns Formatted addresses string or array
   */
  private formatAddresses(
    addresses: string | string[] | EmailAddress | EmailAddress[]
  ): string | string[] {
    if (typeof addresses === 'string') {
      return addresses;
    }

    if (Array.isArray(addresses)) {
      return addresses.map((addr) =>
        typeof addr === 'string'
          ? addr
          : addr.name
            ? `"${addr.name}" <${addr.email}>`
            : addr.email
      );
    }

    // Single EmailAddress object
    return addresses.name ? `"${addresses.name}" <${addresses.email}>` : addresses.email;
  }

  /**
   * Verify SMTP connection (optional, for testing)
   * @returns True if connection is successful
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw new Error(
        `Brevo SMTP verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Close the transporter connection
   */
  close(): void {
    this.transporter.close();
  }
}
