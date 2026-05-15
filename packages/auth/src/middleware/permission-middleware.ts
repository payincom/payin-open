/**
 * Permission middleware for Hono
 * Checks if the authenticated user has the required permission based on their organization role
 */

import type { Context, Next } from 'hono';
import { hasOrganizationPermission } from '../permissions.js';
import type { Permission } from '../types/index.js';

/**
 * Create a middleware that requires a specific permission
 * Must be used AFTER authMiddleware (which sets organizationRole on context)
 *
 * @param permission - Required permission (e.g., 'orders:write', 'deposits:read')
 * @returns Hono middleware
 */
export function requirePermission(permission: Permission) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const organizationRole = c.get('organizationRole');

    // If no organization context, the user hasn't specified an organization
    if (!organizationRole) {
      return c.json({
        error: 'Forbidden',
        message: 'Organization context required. Provide X-Organization-Id header.',
      }, 403);
    }

    // Check if the role has the required permission
    if (!hasOrganizationPermission(organizationRole, permission)) {
      return c.json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required: ${permission}. Your role: ${organizationRole}`,
        suggestions: [
          'Contact your organization admin to request elevated access',
          `The '${permission}' permission is not available for the '${organizationRole}' role`
        ]
      }, 403);
    }

    await next();
  };
}

/**
 * Create a middleware that requires ANY of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const organizationRole = c.get('organizationRole');

    if (!organizationRole) {
      return c.json({
        error: 'Forbidden',
        message: 'Organization context required. Provide X-Organization-Id header.',
      }, 403);
    }

    const hasAny = permissions.some(p => hasOrganizationPermission(organizationRole, p));
    if (!hasAny) {
      return c.json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required one of: ${permissions.join(', ')}. Your role: ${organizationRole}`,
      }, 403);
    }

    await next();
  };
}
