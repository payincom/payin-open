/**
 * Password reset email template
 * Sent when user requests password reset
 */

import type { EmailTemplate } from '../types';

export interface PasswordResetTemplateData {
  username: string;
  email: string;
  resetUrl: string;
  expiresIn?: string; // e.g., "1 hour", "30 minutes"
}

export const passwordResetTemplate: EmailTemplate = {
  name: 'password-reset',

  subject: (data: any) => {
    return 'Reset Your Password - PayIn';
  },

  text: (data: any) => {
    const expiresSection = data.expiresIn
      ? `\nThis reset link will expire in ${data.expiresIn}.`
      : '';

    return `Hello ${data.username},

We received a request to reset your password for your PayIn account.

Click the link below to reset your password:

${data.resetUrl}
${expiresSection}

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
PayIn Team`;
  },

  html: (data: any) => {
    const expiresSection = data.expiresIn
      ? `
        <p style="font-size: 14px; color: #666;">
          This reset link will expire in <strong>${data.expiresIn}</strong>.
        </p>
      `
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #1f2937; margin-bottom: 20px;">Reset Your Password</h1>

        <p>Hello ${data.username},</p>

        <p>We received a request to reset your password for your PayIn account.</p>

        <p>Click the button below to reset your password:</p>

        <p style="margin: 30px 0;">
          <a href="${data.resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        ${expiresSection}
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          Or copy and paste this link into your browser:<br>
          <a href="${data.resetUrl}" style="color: #2563eb; word-break: break-all;">${data.resetUrl}</a>
        </p>

        <p style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 3px;">
          <strong>Security tip:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
        </p>

        <p style="margin-top: 30px;">
          Best regards,<br>
          PayIn Team
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <p style="font-size: 12px; color: #999;">
          PayIn - Multi-Chain Stablecoin Payment System
        </p>
      </div>
    `;
  },
};
