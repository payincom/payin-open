/**
 * Email templates unit tests
 */

import { describe, it, expect } from 'vitest';
import { welcomeTemplate, verifyEmailTemplate, passwordResetTemplate } from '../src/templates';

describe('Email Templates', () => {
  describe('welcomeTemplate', () => {
    it('should have correct name', () => {
      expect(welcomeTemplate.name).toBe('welcome');
    });

    it('should render subject with username', () => {
      const subject = welcomeTemplate.subject({
        username: 'john',
        email: 'john@example.com',
      });

      expect(subject).toBe('Welcome to PayIn, john!');
    });

    it('should render text content', () => {
      const text = welcomeTemplate.text({
        username: 'john',
        email: 'john@example.com',
      });

      expect(text).toContain('Hello john');
      expect(text).toContain('Welcome to PayIn');
    });

    it('should render html content', () => {
      const html = welcomeTemplate.html({
        username: 'alice',
        email: 'alice@example.com',
      });

      expect(html).toContain('Hello alice');
      expect(html).toContain('Welcome to PayIn');
    });

    it('should include login URL if provided', () => {
      const html = welcomeTemplate.html({
        username: 'bob',
        email: 'bob@example.com',
        loginUrl: 'https://payin.com/login',
      });

      expect(html).toContain('https://payin.com/login');
      expect(html).toContain('Get Started');
    });
  });

  describe('verifyEmailTemplate', () => {
    it('should have correct name', () => {
      expect(verifyEmailTemplate.name).toBe('verify-email');
    });

    it('should render subject', () => {
      const subject = verifyEmailTemplate.subject({
        username: 'john',
        email: 'john@example.com',
        verificationUrl: 'https://payin.com/verify/abc123',
      });

      expect(subject).toBe('Verify Your Email Address - PayIn');
    });

    it('should render text content with verification URL', () => {
      const text = verifyEmailTemplate.text({
        username: 'john',
        email: 'john@example.com',
        verificationUrl: 'https://payin.com/verify/abc123',
      });

      expect(text).toContain('Hello john');
      expect(text).toContain('https://payin.com/verify/abc123');
    });

    it('should render html content with verification URL', () => {
      const html = verifyEmailTemplate.html({
        username: 'alice',
        email: 'alice@example.com',
        verificationUrl: 'https://payin.com/verify/def456',
      });

      expect(html).toContain('Hello alice');
      expect(html).toContain('https://payin.com/verify/def456');
      expect(html).toContain('Verify Email Address');
    });

    it('should include expiration time if provided', () => {
      const html = verifyEmailTemplate.html({
        username: 'bob',
        email: 'bob@example.com',
        verificationUrl: 'https://payin.com/verify/xyz',
        expiresIn: '24 hours',
      });

      expect(html).toContain('24 hours');
      expect(html).toContain('expire');
    });
  });

  describe('passwordResetTemplate', () => {
    it('should have correct name', () => {
      expect(passwordResetTemplate.name).toBe('password-reset');
    });

    it('should render subject', () => {
      const subject = passwordResetTemplate.subject({
        username: 'john',
        email: 'john@example.com',
        resetUrl: 'https://payin.com/reset/abc123',
      });

      expect(subject).toBe('Reset Your Password - PayIn');
    });

    it('should render text content with reset URL', () => {
      const text = passwordResetTemplate.text({
        username: 'john',
        email: 'john@example.com',
        resetUrl: 'https://payin.com/reset/abc123',
      });

      expect(text).toContain('Hello john');
      expect(text).toContain('https://payin.com/reset/abc123');
      expect(text).toContain('password reset');
    });

    it('should render html content with reset URL', () => {
      const html = passwordResetTemplate.html({
        username: 'alice',
        email: 'alice@example.com',
        resetUrl: 'https://payin.com/reset/def456',
      });

      expect(html).toContain('Hello alice');
      expect(html).toContain('https://payin.com/reset/def456');
      expect(html).toContain('Reset Password');
    });

    it('should include expiration time if provided', () => {
      const html = passwordResetTemplate.html({
        username: 'bob',
        email: 'bob@example.com',
        resetUrl: 'https://payin.com/reset/xyz',
        expiresIn: '1 hour',
      });

      expect(html).toContain('1 hour');
      expect(html).toContain('expire');
    });

    it('should include security warning', () => {
      const html = passwordResetTemplate.html({
        username: 'charlie',
        email: 'charlie@example.com',
        resetUrl: 'https://payin.com/reset/xyz',
      });

      expect(html).toContain('Security tip');
      expect(html).toContain('didn\'t request');
    });
  });
});
