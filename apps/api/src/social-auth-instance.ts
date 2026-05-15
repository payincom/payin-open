/**
 * Social Auth Instance Singleton
 * Provides global access to SocialAuthService instance
 */

import { SocialAuthService } from '@payin/auth';
import { loadAppConfig } from './config.js';
import { getAuth } from './auth-instance.js';

/**
 * Global SocialAuth instance
 */
let socialAuthInstance: SocialAuthService | null = null;

/**
 * Initialize SocialAuth instance
 * This should be called after AuthManager is initialized
 */
export async function initializeSocialAuth(): Promise<SocialAuthService> {
  if (socialAuthInstance) {
    console.log('⚠️  SocialAuth already initialized, returning existing instance');
    return socialAuthInstance;
  }

  console.log('🔐 Initializing SocialAuthService...');

  // Load application configuration
  const appConfig = loadAppConfig();

  // Get environment variables
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
  }

  // Get AuthManager to share database connection
  const authManager = getAuth();

  // Create SocialAuth instance
  socialAuthInstance = new SocialAuthService({
    db: authManager['db'], // Access private db property
    jwtSecret,
    supabaseUrl,
    supabaseAnonKey,
    tokenExpiration: '24h'
  });

  console.log('✅ SocialAuthService initialized');

  return socialAuthInstance;
}

/**
 * Get SocialAuth instance
 * Throws error if SocialAuth not initialized
 */
export function getSocialAuth(): SocialAuthService {
  if (!socialAuthInstance) {
    throw new Error('SocialAuth not initialized. Call initializeSocialAuth() first.');
  }
  return socialAuthInstance;
}
