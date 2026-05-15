/**
 * Welcome email template
 * Sent when a new user registers
 */

import type { EmailTemplate } from '../types';

export interface WelcomeTemplateData {
  username: string;
  email: string;
  loginUrl?: string;
}

export const welcomeTemplate: EmailTemplate = {
  name: 'welcome',

  subject: (data: any) => {
    return `Welcome to PayIn, ${data.username}!`;
  },

  text: (data: any) => {
    const loginSection = data.loginUrl ? `\nGet started: ${data.loginUrl}\n` : '';

    return `Hello ${data.username},

Welcome to PayIn! We're excited to have you on board.

PayIn is a multi-chain stablecoin payment system that makes it easy to accept and manage cryptocurrency payments.
${loginSection}
If you have any questions, feel free to reach out to our support team.

Best regards,
PayIn Team`;
  },

  html: (data: any) => {
    const loginSection = data.loginUrl
      ? `
        <p style="margin: 30px 0;">
          <a href="${data.loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Get Started
          </a>
        </p>
      `
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #1f2937; margin-bottom: 20px;">Welcome to PayIn!</h1>

        <p>Hello ${data.username},</p>

        <p>Welcome to PayIn! We're excited to have you on board.</p>

        <p>PayIn is a multi-chain stablecoin payment system that makes it easy to accept and manage cryptocurrency payments.</p>
        ${loginSection}
        <p>If you have any questions, feel free to reach out to our support team.</p>

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
