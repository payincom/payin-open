/**
 * Direct OAuth Instance Singleton
 */

import { DirectOAuthService } from '@payin/auth';
import { getAuth } from './auth-instance.js';

let instance: DirectOAuthService | null = null;

export function initializeDirectOAuth(): DirectOAuthService {
  if (instance) return instance;

  const authManager = getAuth();
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production';

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

  instance = new DirectOAuthService({
    db: authManager['db'],
    jwtSecret,
    tokenExpiration: '24h',
    google: googleClientId && googleClientSecret
      ? { clientId: googleClientId, clientSecret: googleClientSecret }
      : undefined,
    github: githubClientId && githubClientSecret
      ? { clientId: githubClientId, clientSecret: githubClientSecret }
      : undefined,
  });

  const providers = [];
  if (googleClientId) providers.push('Google');
  if (githubClientId) providers.push('GitHub');
  console.log(`✅ DirectOAuthService initialized (providers: ${providers.join(', ') || 'none'})`);

  return instance;
}

export function getDirectOAuth(): DirectOAuthService {
  if (!instance) throw new Error('DirectOAuth not initialized');
  return instance;
}
