/**
 * EmailService unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '../src/email-service';
import type { EmailProvider, EmailOptions, EmailSendResult, EmailTemplate } from '../src/types';

// Mock provider
class MockProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<EmailSendResult> {
    return {
      messageId: 'mock-message-id',
      response: 'Mock email sent',
    };
  }
}

describe('EmailService', () => {
  let emailService: EmailService;
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    emailService = new EmailService({
      provider: mockProvider,
      defaultFrom: 'noreply@payin.com',
    });
  });

  describe('constructor', () => {
    it('should create an EmailService instance', () => {
      expect(emailService).toBeInstanceOf(EmailService);
    });

    it('should throw error if provider is missing', () => {
      expect(() => new EmailService({} as any)).toThrow('EmailService requires a provider');
    });
  });

  describe('send', () => {
    it('should send an email', async () => {
      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'Test content',
        html: '<p>Test content</p>',
      });

      expect(result.messageId).toBe('mock-message-id');
    });

    it('should use default from address if not provided', async () => {
      const sendSpy = vi.spyOn(mockProvider, 'send');

      await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      });

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@payin.com',
        })
      );
    });

    it('should throw error if to is missing', async () => {
      await expect(
        emailService.send({
          to: '',
          subject: 'Test',
          text: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Email recipient (to) is required');
    });

    it('should throw error if subject is missing', async () => {
      await expect(
        emailService.send({
          to: 'test@example.com',
          subject: '',
          text: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Email subject is required');
    });

    it('should throw error if both text and html are missing', async () => {
      await expect(
        emailService.send({
          to: 'test@example.com',
          subject: 'Test',
          text: '',
          html: '',
        })
      ).rejects.toThrow('Email must have either text or html content');
    });
  });

  describe('template management', () => {
    const testTemplate: EmailTemplate = {
      name: 'test',
      subject: (data) => `Hello ${data.name}`,
      text: (data) => `Hello ${data.name}, this is a test email.`,
      html: (data) => `<p>Hello ${data.name}, this is a test email.</p>`,
    };

    it('should register a template', () => {
      emailService.registerTemplate(testTemplate);
      expect(emailService.getTemplate('test')).toEqual(testTemplate);
    });

    it('should throw error if template name is missing', () => {
      expect(() => emailService.registerTemplate({} as any)).toThrow('Template must have a name');
    });

    it('should throw error if template is already registered', () => {
      emailService.registerTemplate(testTemplate);
      expect(() => emailService.registerTemplate(testTemplate)).toThrow(
        'Template "test" is already registered'
      );
    });

    it('should register multiple templates', () => {
      const templates = [
        testTemplate,
        { ...testTemplate, name: 'test2' },
        { ...testTemplate, name: 'test3' },
      ];

      emailService.registerTemplates(templates);
      expect(emailService.getTemplateNames()).toEqual(['test', 'test2', 'test3']);
    });

    it('should get template names', () => {
      emailService.registerTemplate(testTemplate);
      emailService.registerTemplate({ ...testTemplate, name: 'test2' });

      expect(emailService.getTemplateNames()).toEqual(['test', 'test2']);
    });
  });

  describe('sendTemplate', () => {
    const testTemplate: EmailTemplate = {
      name: 'test',
      subject: (data) => `Hello ${data.name}`,
      text: (data) => `Hello ${data.name}, this is a test email.`,
      html: (data) => `<p>Hello ${data.name}, this is a test email.</p>`,
    };

    beforeEach(() => {
      emailService.registerTemplate(testTemplate);
    });

    it('should send email using template', async () => {
      const result = await emailService.sendTemplate('test', {
        to: 'test@example.com',
        data: { name: 'John' },
      });

      expect(result.messageId).toBe('mock-message-id');
    });

    it('should render template with data', async () => {
      const sendSpy = vi.spyOn(mockProvider, 'send');

      await emailService.sendTemplate('test', {
        to: 'test@example.com',
        data: { name: 'Alice' },
      });

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello Alice',
          text: 'Hello Alice, this is a test email.',
          html: '<p>Hello Alice, this is a test email.</p>',
        })
      );
    });

    it('should throw error if template not found', async () => {
      await expect(
        emailService.sendTemplate('nonexistent', {
          to: 'test@example.com',
          data: {},
        })
      ).rejects.toThrow('Template "nonexistent" not found');
    });
  });

  describe('previewTemplate', () => {
    const testTemplate: EmailTemplate = {
      name: 'test',
      subject: (data) => `Hello ${data.name}`,
      text: (data) => `Hello ${data.name}, this is a test email.`,
      html: (data) => `<p>Hello ${data.name}, this is a test email.</p>`,
    };

    beforeEach(() => {
      emailService.registerTemplate(testTemplate);
    });

    it('should preview template without sending', () => {
      const preview = emailService.previewTemplate('test', { name: 'Bob' });

      expect(preview).toEqual({
        subject: 'Hello Bob',
        text: 'Hello Bob, this is a test email.',
        html: '<p>Hello Bob, this is a test email.</p>',
      });
    });

    it('should throw error if template not found', () => {
      expect(() => emailService.previewTemplate('nonexistent', {})).toThrow(
        'Template "nonexistent" not found'
      );
    });
  });
});
