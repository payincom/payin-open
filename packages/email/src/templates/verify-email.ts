/**
 * Email verification template
 * Sent to verify user's email address
 */

import type { EmailTemplate } from '../types';

export interface VerifyEmailTemplateData {
  username: string;
  email: string;
  verificationUrl: string;
  expiresIn?: string; // e.g., "24 hours", "1 hour"
}

export const verifyEmailTemplate: EmailTemplate = {
  name: 'verify-email',

  subject: (data: any) => {
    return 'Verify Your Email Address - PayIn';
  },

  text: (data: any) => {
    const expiresSection = data.expiresIn
      ? `\nThis verification link will expire in ${data.expiresIn}.`
      : '';

    return `Hello ${data.username},

Thank you for registering with PayIn. Please verify your email address by clicking the link below:

${data.verificationUrl}
${expiresSection}

If you didn't create an account with PayIn, please ignore this email.

Best regards,
PayIn Team`;
  },

  html: (data: any) => {
    const expiresSection = data.expiresIn
      ? `
        <p style="font-size: 14px; color: #666;">
          This verification link will expire in <strong>${data.expiresIn}</strong>.
        </p>
      `
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #1f2937; margin-bottom: 20px;">Verify Your Email Address</h1>

        <p>Hello ${data.username},</p>

        <p>Thank you for registering with PayIn. Please verify your email address by clicking the button below:</p>

        <p style="margin: 30px 0;">
          <a href="${data.verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Verify Email Address
          </a>
        </p>
        ${expiresSection}
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          Or copy and paste this link into your browser:<br>
          <a href="${data.verificationUrl}" style="color: #2563eb; word-break: break-all;">${data.verificationUrl}</a>
        </p>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          If you didn't create an account with PayIn, please ignore this email.
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
