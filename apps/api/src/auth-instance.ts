/**
 * Auth Instance Singleton
 * Provides global access to AuthManager instance
 */

import { AuthManager } from '@payin/auth';
import { EmailService, BrevoProvider, welcomeTemplate, verifyEmailTemplate } from '@payin/email';
import { loadAppConfig } from './config.js';

/**
 * Global Auth instance
 */
let authInstance: AuthManager | null = null;

/**
 * Initialize Email Service
 */
function initializeEmailService(): EmailService | undefined {
  const brevoUser = process.env.BREVO_SMTP_USER;
  const brevoPassword = process.env.BREVO_SMTP_PASSWORD;
  const brevoFrom = process.env.BREVO_FROM_EMAIL || 'noreply@payin.com';

  if (!brevoUser || !brevoPassword) {
    console.warn('⚠️  Email service not configured (BREVO_SMTP_USER or BREVO_SMTP_PASSWORD missing)');
    console.warn('⚠️  Registration emails will be disabled');
    return undefined;
  }

  try {
    // Create Brevo provider
    const brevoProvider = new BrevoProvider({
      user: brevoUser,
      password: brevoPassword,
      from: brevoFrom,
      fromName: 'PayIn',
    });

    // Create email service
    const emailService = new EmailService({
      provider: brevoProvider,
      defaultFrom: brevoFrom,
    });

    // Register templates
    emailService.registerTemplates([welcomeTemplate, verifyEmailTemplate]);

    console.log('✅ Email service initialized');
    return emailService;
  } catch (error) {
    console.error('❌ Failed to initialize email service:', error);
    return undefined;
  }
}

/**
 * Initialize Auth instance
 * This should be called once during application startup
 */
export async function initializeAuth(): Promise<AuthManager> {
  if (authInstance) {
    console.log('⚠️  Auth already initialized, returning existing instance');
    return authInstance;
  }

  console.log('🔐 Initializing AuthManager...');

  // Load application configuration
  const appConfig = loadAppConfig();

  // JWT secret from environment or default (for development only)
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production';

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set, using default (NOT for production!)');
  }

  // Initialize email service
  const emailService = initializeEmailService();

  // Base URL for email links
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // Create Auth instance (using same DB as Manager)
  authInstance = new AuthManager({
    connectionString: appConfig.database.connectionString,
    jwtSecret,
    tokenExpiration: '24h',
    emailService,
    baseUrl,
  });

  // Initialize Auth (creates schema if INIT_DB=true)
  await authInstance.initialize();

  console.log('✅ AuthManager initialized');

  return authInstance;
}

/**
 * Get Auth instance
 * Throws error if Auth not initialized
 */
export function getAuth(): AuthManager {
  if (!authInstance) {
    throw new Error('Auth not initialized. Call initializeAuth() first.');
  }
  return authInstance;
}

/**
 * Shutdown Auth instance
 * Closes database connections
 */
export async function shutdownAuth(): Promise<void> {
  if (authInstance) {
    console.log('🛑 Shutting down Auth...');
    await authInstance.close();
    authInstance = null;
    console.log('✅ Auth shutdown complete');
  }
}
