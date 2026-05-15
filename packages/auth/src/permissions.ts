/**
 * Permission definitions and role-based access control
 */

import { OrganizationRole, type Permission, type User, type UserPublic } from './types/index.js';

/**
 * Organization role permissions mapping
 * This is the primary permission system for multi-tenant context
 */
export const ORGANIZATION_ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  [OrganizationRole.OWNER]: [
    // Full access to everything
    'auth:read', 'auth:write', 'auth:delete',
    'config:read', 'config:write', 'config:delete',
    'chains:read', 'chains:write',
    'tokens:read', 'tokens:write',
    'orders:read', 'orders:write', 'orders:delete',
    'deposits:read', 'deposits:write',
    'transfers:read',
    'address-pool:read', 'address-pool:write',
    'users:read', 'users:write', 'users:delete',
    'audit-logs:read',

    // Owner-exclusive permissions (only Owner can perform these)
    'organization:read', 'organization:write', 'organization:delete',  // Organization management
    'organization-transfer:write',       // Transfer ownership
    'billing:read', 'billing:write',     // Billing and payment management
    'members:read', 'members:write', 'members:delete',  // Member management including Admins
    'api-keys:read', 'api-keys:write', 'api-keys:delete',  // API key management
    'webhooks:read', 'webhooks:write', 'webhooks:delete',  // Webhook management
    'integrations:read', 'integrations:write',  // Third-party integrations
    'security:read', 'security:write',   // Security settings (2FA, IP whitelist)
    'audit-logs:write',                  // Audit log export
  ],

  [OrganizationRole.ADMIN]: [
    // Almost full access except Owner-exclusive operations
    'auth:read', 'auth:write',
    'config:read', 'config:write',
    'chains:read', 'chains:write',
    'tokens:read', 'tokens:write',
    'orders:read', 'orders:write',
    'deposits:read', 'deposits:write',
    'transfers:read',
    'address-pool:read', 'address-pool:write',
    'users:read', 'users:write',
    'audit-logs:read',

    // Admin can view organization info but not delete/transfer
    'organization:read', 'organization:write',

    // Admin can view billing but not manage payment methods
    'billing:read',

    // Admin can manage members but not Owners
    'members:read', 'members:write',  // Can add/remove Members and Viewers, but not Owners

    // Admin can manage API keys
    'api-keys:read', 'api-keys:write', 'api-keys:delete',

    // Admin can manage webhooks
    'webhooks:read', 'webhooks:write', 'webhooks:delete',

    // Admin can view integrations
    'integrations:read',

    // Admin can view security settings
    'security:read',
  ],

  [OrganizationRole.MEMBER]: [
    // Can create and manage own resources
    'config:read',
    'chains:read',
    'tokens:read',
    'orders:read', 'orders:write',
    'deposits:read', 'deposits:write',
    'transfers:read',
    'address-pool:read',
  ],

  [OrganizationRole.VIEWER]: [
    // Read-only access
    'config:read',
    'chains:read',
    'tokens:read',
    'orders:read',
    'deposits:read',
    'transfers:read',
    'address-pool:read',
  ],
};


/**
 * Check if an organization role has a specific permission
 */
export function hasOrganizationPermission(role: OrganizationRole | string, permission: Permission): boolean {
  const permissions = ORGANIZATION_ROLE_PERMISSIONS[role as OrganizationRole];
  if (!permissions) return false;

  return permissions.includes(permission);
}

/**
 * Check if an organization role has permission for a resource and action
 */
export function hasOrganizationResourcePermission(
  role: OrganizationRole | string,
  resource: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  const permission = `${resource}:${action}` as Permission;
  return hasOrganizationPermission(role, permission);
}

/**
 * Get all permissions for an organization role
 */
export function getOrganizationRolePermissions(role: OrganizationRole | string): Permission[] {
  return ORGANIZATION_ROLE_PERMISSIONS[role as OrganizationRole] || [];
}

/**
 * Check if a user is a super admin
 * Super admins have system-wide privileges including global config management
 */
export function isSuperAdmin(user: User | UserPublic): boolean {
  return user.isSuperadmin === true && user.isActive === true;
}

/**
 * Check if user can manage global configuration
 * Only super admins can manage global configs (organization_id = NULL)
 */
export function canManageGlobalConfig(user: User | UserPublic): boolean {
  return isSuperAdmin(user);
}

/**
 * Check if user can manage organization configuration
 * Organization owners and admins can manage org-specific configs
 * Super admins can also manage any organization's configs
 */
export function canManageOrganizationConfig(
  user: User | UserPublic,
  organizationRole?: OrganizationRole | string
): boolean {
  // Super admins can manage any organization's config
  if (isSuperAdmin(user)) {
    return true;
  }

  // Organization owners and admins can manage their org's config
  if (!organizationRole) {
    return false;
  }

  return (
    organizationRole === OrganizationRole.OWNER ||
    organizationRole === OrganizationRole.ADMIN
  );
}

/**
 * Check if user can view configuration
 * All authenticated users can view configs (global or organization)
 */
export function canViewConfig(user: User | UserPublic): boolean {
  return user.isActive === true;
}
