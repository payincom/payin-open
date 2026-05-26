/**
 * Authentication middleware for Hono
 */

import type { Context, Next } from 'hono';
import type { AuthManager } from '../auth-manager.js';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const PAYIN_RUNTIME_OPEN = 'open';

function isExplicitOpenRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const runtime = (env.PAYIN_RUNTIME || env.PAYIN_EDITION || '').toLowerCase();
  return runtime === PAYIN_RUNTIME_OPEN || runtime === 'payin-open';
}

function getOpenRuntimeOrganizationId(env: NodeJS.ProcessEnv = process.env): string {
  return env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_ORGANIZATION_ID;
}

/**
 * Create unified authentication middleware
 * Supports both JWT tokens and API keys
 * Automatically detects the type based on the token format
 *
 * For API Keys: Automatically sets organization context from the key
 * For JWT: Verifies membership for X-Organization-ID, or for the default
 * Open merchant when PAYIN_RUNTIME=open and the header is omitted
 */
export function createAuthMiddleware(authManager: AuthManager) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    // Get token from Authorization header
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Detect authentication type based on token format
    if (token.startsWith('pk_')) {
      // ==================== API Key Authentication ====================
      const verification = await authManager.verifyApiKey(token);

      if (!verification.valid) {
        return c.json({ error: 'Unauthorized', message: verification.error || 'Invalid API key' }, 401);
      }

      // Update last used timestamp asynchronously (don't block request)
      authManager.updateApiKeyUsage(verification.apiKeyId!).catch(err =>
        console.error('Failed to update API key usage:', err)
      );

      // Set user info and organization context
      c.set('authType', 'apikey');
      c.set('apiKeyId', verification.apiKeyId!);
      c.set('userId', verification.userId!);
      c.set('username', verification.username!);
      c.set('organizationId', verification.organizationId!);  // Auto-inject from API key
      c.set('organizationRole', 'owner');  // API keys have full org access
    } else {
      // ==================== JWT Token Authentication ====================
      const verification = await authManager.verifyToken(token);

      if (!verification.valid) {
        return c.json({ error: 'Unauthorized', message: verification.error || 'Invalid token' }, 401);
      }

      // X-Organization-ID header is optional for JWT authentication.
      // In explicit PayIn Open runtime, omitted headers resolve to the default
      // merchant only after active membership has been verified below.
      const orgId = c.req.header('X-Organization-ID') ||
        (isExplicitOpenRuntime() ? getOpenRuntimeOrganizationId() : undefined);

      if (orgId) {
        // Verify user membership in the organization
        const membership = await authManager.organizations.verifyMembership(
          verification.userId!,
          orgId
        );

        if (!membership.valid) {
          return c.json({
            error: 'Forbidden',
            message: membership.error || 'Not a member of this organization'
          }, 403);
        }

        // Set user info with organization context
        c.set('authType', 'jwt');
        c.set('userId', verification.userId!);
        c.set('username', verification.username!);
        c.set('organizationRole', membership.role!);  // Use organization role
        c.set('organizationId', orgId);
        c.set('token', token);
      } else {
        // Set user info without organization context (for /auth/me initial call)
        c.set('authType', 'jwt');
        c.set('userId', verification.userId!);
        c.set('username', verification.username!);
        c.set('token', token);
      }
    }

    await next();
  };
}

/**
 * Optional authentication middleware
 * Does not fail if token is missing, just sets user info if available
 */
export function createOptionalAuthMiddleware(authManager: AuthManager) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verification = await authManager.verifyToken(token);

      if (verification.valid) {
        c.set('userId', verification.userId!);
        c.set('username', verification.username!);
        c.set('token', token);
      }
    }

    await next();
  };
}
