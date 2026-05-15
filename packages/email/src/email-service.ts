/**
 * Email service core implementation
 * Provides high-level API for sending emails with template support
 */

import type {
  EmailProvider,
  EmailOptions,
  EmailSendResult,
  EmailServiceConfig,
  EmailTemplate,
  TemplateOptions,
  EmailAddress,
} from './types';

/**
 * EmailService - Main email service class
 * Provides methods for sending emails and rendering templates
 */
export class EmailService {
  private provider: EmailProvider;
  private templates: Map<string, EmailTemplate>;
  private defaultFrom?: string | EmailAddress;
  private defaultReplyTo?: string | EmailAddress;

  /**
   * Create an email service instance
   * @param config Email service configuration
   */
  constructor(config: EmailServiceConfig) {
    if (!config.provider) {
      throw new Error('EmailService requires a provider');
    }

    this.provider = config.provider;
    this.templates = new Map();
    this.defaultFrom = config.defaultFrom;
    this.defaultReplyTo = config.defaultReplyTo;
  }

  /**
   * Send an email
   * @param options Email options
   * @returns Send result with message ID
   */
  async send(options: EmailOptions): Promise<EmailSendResult> {
    // Apply defaults if not provided
    const emailOptions: EmailOptions = {
      ...options,
      from: options.from || this.defaultFrom,
      replyTo: options.replyTo || this.defaultReplyTo,
    };

    // Validate required fields
    if (!emailOptions.to) {
      throw new Error('Email recipient (to) is required');
    }
    if (!emailOptions.subject) {
      throw new Error('Email subject is required');
    }
    if (!emailOptions.text && !emailOptions.html) {
      throw new Error('Email must have either text or html content');
    }

    // Send via provider
    return await this.provider.send(emailOptions);
  }

  /**
   * Register an email template
   * @param template Email template
   */
  registerTemplate(template: EmailTemplate): void {
    if (!template.name) {
      throw new Error('Template must have a name');
    }
    if (this.templates.has(template.name)) {
      throw new Error(`Template "${template.name}" is already registered`);
    }
    this.templates.set(template.name, template);
  }

  /**
   * Register multiple email templates
   * @param templates Array of email templates
   */
  registerTemplates(templates: EmailTemplate[]): void {
    templates.forEach((template) => this.registerTemplate(template));
  }

  /**
   * Send an email using a registered template
   * @param templateName Template name
   * @param options Template options
   * @returns Send result with message ID
   */
  async sendTemplate(templateName: string, options: TemplateOptions): Promise<EmailSendResult> {
    // Get template
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found. Did you forget to register it?`);
    }

    // Render template
    const subject = template.subject(options.data);
    const text = template.text(options.data);
    const html = template.html(options.data);

    // Send email with rendered content
    return await this.send({
      to: options.to,
      from: options.from || this.defaultFrom,
      replyTo: options.replyTo || this.defaultReplyTo,
      subject,
      text,
      html,
    });
  }

  /**
   * Get a registered template (useful for testing/preview)
   * @param templateName Template name
   * @returns Template or undefined
   */
  getTemplate(templateName: string): EmailTemplate | undefined {
    return this.templates.get(templateName);
  }

  /**
   * Get all registered template names
   * @returns Array of template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Preview a template with data (renders but doesn't send)
   * @param templateName Template name
   * @param data Template data
   * @returns Rendered email content
   */
  previewTemplate(
    templateName: string,
    data: Record<string, any>
  ): { subject: string; text: string; html: string } {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    return {
      subject: template.subject(data),
      text: template.text(data),
      html: template.html(data),
    };
  }
}
