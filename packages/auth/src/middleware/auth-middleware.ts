/**
 * Authentication middleware for Hono
 */

import type { Context, Next } from 'hono';
import type { AuthManager } from '../auth-manager.js';

/**
 * Create unified authentication middleware
 * Supports both JWT tokens and API keys
 * Automatically detects the type based on the token format
 *
 * For API Keys: Automatically sets organization context from the key
 * For JWT: Requires X-Organization-ID header and verifies membership
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

      // X-Organization-ID header is optional for JWT authentication
      // If provided, verify membership; if not, set basic user info only
      const orgId = c.req.header('X-Organization-ID');

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
