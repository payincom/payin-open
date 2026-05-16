/**
 * Configuration Management Routes with Multi-tenant Support
 * Provides CRUD operations for global and organization-specific configurations
 *
 * Permission model:
 * - Super admin: Can manage global configs (organization_id = NULL)
 * - Organization owner/admin: Can manage organization configs
 * - All users: Can view configs (with organization context)
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, isSuperAdmin, canManageOrganizationConfig } from '@payin/auth';
import type { UserPublic } from '@payin/auth';

const configManagement = new Hono();

// Lazy middleware factories
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};

const auditMiddleware = (resource: string, action: string) => {
  return async (c: Context, next: Next) => {
    const middleware = createAuditMiddleware(getAuth(), { resource, action });
    return await middleware(c, next);
  };
};

/**
 * Permission check helper
 */
function checkConfigPermission(
  user: UserPublic,
  organizationId: string | null,
  organizationRole?: string
): { allowed: boolean; error?: string } {
  // Global config: superadmin only
  if (organizationId === null) {
    if (!isSuperAdmin(user)) {
      return {
        allowed: false,
        error: 'Only superadmin can modify global configuration'
      };
    }
    return { allowed: true };
  }

  // Organization config: owner/admin (or superadmin)
  if (!canManageOrganizationConfig(user, organizationRole)) {
    return {
      allowed: false,
      error: 'Only organization owner/admin can modify organization configuration'
    };
  }

  return { allowed: true };
}

// ==================== Configuration Values API ====================

/**
 * List configuration values
 * GET /config-management/values
 *
 * Query params:
 * - scope: 'global' | 'organization' | 'all' (default: 'all')
 * - organization_id: UUID (required for scope=organization)
 * - show_source: boolean (default: true) - show config source (global/organization/metadata)
 */
configManagement.get(
  '/values',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const user = c.get('user') as UserPublic;

      const scope = c.req.query('scope') || 'all'; // 'global' | 'organization' | 'all'
      const organizationId = c.req.query('organization_id');
      const showSource = c.req.query('show_source') !== 'false';

      // Validate scope
      if (!['global', 'organization', 'all'].includes(scope)) {
        return c.json({
          success: false,
          error: 'Invalid scope',
          message: 'Scope must be: global, organization, or all'
        }, 400);
      }

      // Validate organization_id if scope is organization
      if (scope === 'organization' && !organizationId) {
        return c.json({
          success: false,
          error: 'Missing organization_id',
          message: 'organization_id is required when scope=organization'
        }, 400);
      }

      // Query database based on scope
      let query = 'SELECT cv.*, cm.display_name, cm.description, cm.type, cm.default_value FROM config_values cv LEFT JOIN config_metadata cm ON cv.key = cm.key WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      if (scope === 'global') {
        query += ' AND cv.organization_id IS NULL';
      } else if (scope === 'organization') {
        query += ` AND cv.organization_id = $${paramIndex++}`;
        values.push(organizationId);
      }
      // scope='all': no organization_id filter

      query += ' ORDER BY cv.key ASC';

      const result = await manager['db'].query(query, values);
      const configs = result.rows;

      // Add source information if requested
      if (showSource && organizationId) {
        for (const config of configs) {
          if (config.organization_id === null) {
            config.source = 'global';
          } else if (config.organization_id === organizationId) {
            config.source = 'organization';
          } else {
            config.source = 'other_organization';
          }
        }
      }

      return c.json({
        success: true,
        data: configs,
        total: configs.length,
        scope,
        organization_id: organizationId || null
      });
    } catch (error) {
      console.error('Failed to list configuration values:', error);
      return c.json({
        success: false,
        error: 'Failed to list configuration values',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get specific configuration value with inheritance
 * GET /config-management/values/:key
 *
 * Query params:
 * - organization_id: UUID (optional) - get effective value for organization
 * - show_inheritance: boolean (default: true) - show config sources
 */
configManagement.get(
  '/values/:key',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;
      const organizationId = c.req.query('organization_id');
      const showInheritance = c.req.query('show_inheritance') !== 'false';

      // Get metadata
      const metadataResult = await manager['db'].query(
        'SELECT * FROM config_metadata WHERE key = $1',
        [key]
      );
      const metadata = metadataResult.rows[0];

      if (!metadata) {
        return c.json({
          success: false,
          error: 'Configuration not found',
          message: `Configuration key "${key}" does not exist`
        }, 404);
      }

      // Build inheritance chain
      const inheritance: any = {
        key,
        metadata: {
          display_name: metadata.display_name,
          description: metadata.description,
          type: metadata.type,
          default_value: metadata.default_value
        }
      };

      // Get organization-specific value (if organizationId provided)
      if (organizationId) {
        const orgResult = await manager['db'].query(
          'SELECT * FROM config_values WHERE key = $1 AND organization_id = $2',
          [key, organizationId]
        );
        if (orgResult.rows.length > 0) {
          inheritance.organization_value = orgResult.rows[0].value;
          inheritance.organization_source = 'organization';
          inheritance.effective_value = orgResult.rows[0].value;
          inheritance.effective_source = 'organization';
        }
      }

      // Get global value
      const globalResult = await manager['db'].query(
        'SELECT * FROM config_values WHERE key = $1 AND organization_id IS NULL',
        [key]
      );
      if (globalResult.rows.length > 0) {
        inheritance.global_value = globalResult.rows[0].value;
        if (!inheritance.effective_value) {
          inheritance.effective_value = globalResult.rows[0].value;
          inheritance.effective_source = 'global';
        }
      }

      // Use metadata default if no value set
      if (!inheritance.effective_value) {
        inheritance.effective_value = metadata.default_value;
        inheritance.effective_source = 'metadata';
      }

      if (showInheritance) {
        return c.json({
          success: true,
          data: inheritance
        });
      } else {
        return c.json({
          success: true,
          data: {
            key,
            value: inheritance.effective_value,
            source: inheritance.effective_source
          }
        });
      }
    } catch (error) {
      console.error(`Failed to get configuration ${c.req.param('key')!}:`, error);
      return c.json({
        success: false,
        error: 'Failed to get configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Create or update configuration value
 * POST /config-management/values
 *
 * Body:
 * {
 *   key: string,
 *   value: any,
 *   organization_id?: string | null (null for global)
 * }
 */
configManagement.post(
  '/values',
  authMiddleware(),
  auditMiddleware('config', 'write'),
  async (c) => {
    try {
      const manager = getManager();
      const auth = getAuth();

      // Get user from userId set by auth middleware
      const userId = c.get('userId') as string;
      if (!userId) {
        return c.json({ error: 'Unauthorized', message: 'User not authenticated' }, 401);
      }

      const user = await auth.getUserById(userId);
      if (!user) {
        return c.json({ error: 'Unauthorized', message: 'User not found' }, 401);
      }
      const body = await c.req.json();

      // Validate request body
      if (!body.key || body.value === undefined) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Request body must include "key" and "value" fields'
        }, 400);
      }

      const { key, value, organization_id } = body;

      // Get metadata
      const metadataResult = await manager['db'].query(
        'SELECT * FROM config_metadata WHERE key = $1',
        [key]
      );
      const metadata = metadataResult.rows[0];

      if (!metadata) {
        return c.json({
          success: false,
          error: 'Configuration not found',
          message: `Configuration key "${key}" does not exist in metadata`
        }, 404);
      }

      // Check permissions
      let organizationRole: string | undefined;
      if (organization_id) {
        // Get user's role in the organization
        const memberResult = await auth['db'].query(
          'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = $3',
          [organization_id, user.id, 'active']
        );
        if (memberResult.rows.length > 0) {
          organizationRole = memberResult.rows[0].role;
        }
      }

      const permission = checkConfigPermission(user, organization_id || null, organizationRole);
      if (!permission.allowed) {
        return c.json({
          success: false,
          error: 'Permission denied',
          message: permission.error
        }, 403);
      }

      // Validate value type
      let validatedValue = value;

      if (metadata.type === 'number') {
        if (typeof validatedValue === 'string') {
          validatedValue = Number(validatedValue);
        }
        if (typeof validatedValue !== 'number' || isNaN(validatedValue)) {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a valid number for "${key}"`
          }, 400);
        }
        // Range validation
        if (metadata.validation_rules) {
          if (metadata.validation_rules.min !== undefined && validatedValue < metadata.validation_rules.min) {
            return c.json({
              success: false,
              error: 'Validation failed',
              message: `Value must be at least ${metadata.validation_rules.min} for "${key}"`
            }, 400);
          }
          if (metadata.validation_rules.max !== undefined && validatedValue > metadata.validation_rules.max) {
            return c.json({
              success: false,
              error: 'Validation failed',
              message: `Value must be at most ${metadata.validation_rules.max} for "${key}"`
            }, 400);
          }
        }
      } else if (metadata.type === 'boolean') {
        if (typeof validatedValue === 'string') {
          validatedValue = validatedValue === 'true';
        }
        if (typeof validatedValue !== 'boolean') {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a boolean for "${key}"`
          }, 400);
        }
      } else if (metadata.type === 'string') {
        if (typeof validatedValue !== 'string') {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a string for "${key}"`
          }, 400);
        }
      }

      // Insert or update configuration
      const jsonValue = JSON.stringify(validatedValue);
      const orgIdValue = organization_id || null;

      // Check if configuration exists
      const existingResult = await manager['db'].query(
        'SELECT id FROM config_values WHERE key = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))',
        [key, orgIdValue]
      );

      let result;
      if (existingResult.rows.length > 0) {
        // Update existing
        result = await manager['db'].query(
          `UPDATE config_values
           SET value = $1::jsonb, updated_at = NOW()
           WHERE key = $2 AND (organization_id = $3 OR (organization_id IS NULL AND $3 IS NULL))
           RETURNING *`,
          [jsonValue, key, orgIdValue]
        );
      } else {
        // Insert new
        result = await manager['db'].query(
          `INSERT INTO config_values (key, value, organization_id)
           VALUES ($1, $2::jsonb, $3)
           RETURNING *`,
          [key, jsonValue, orgIdValue]
        );
      }

      // Clear cache
      manager.clearConfigCache();

      return c.json({
        success: true,
        data: result.rows[0],
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error('Failed to update configuration:', error);
      return c.json({
        success: false,
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Delete configuration value
 * DELETE /config-management/values/:key
 *
 * Query params:
 * - organization_id: UUID (optional, omit for global)
 */
configManagement.delete(
  '/values/:key',
  authMiddleware(),
  auditMiddleware('config', 'delete'),
  async (c) => {
    try {
      const manager = getManager();
      const auth = getAuth();

      // Get user from userId set by auth middleware
      const userId = c.get('userId') as string;
      if (!userId) {
        return c.json({ error: 'Unauthorized', message: 'User not authenticated' }, 401);
      }

      const user = await auth.getUserById(userId);
      if (!user) {
        return c.json({ error: 'Unauthorized', message: 'User not found' }, 401);
      }
      const key = c.req.param('key')!;
      const organization_id = c.req.query('organization_id');

      // Check permissions
      let organizationRole: string | undefined;
      if (organization_id) {
        const memberResult = await auth['db'].query(
          'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = $3',
          [organization_id, user.id, 'active']
        );
        if (memberResult.rows.length > 0) {
          organizationRole = memberResult.rows[0].role;
        }
      }

      const permission = checkConfigPermission(user, organization_id || null, organizationRole);
      if (!permission.allowed) {
        return c.json({
          success: false,
          error: 'Permission denied',
          message: permission.error
        }, 403);
      }

      // Delete configuration
      const orgIdValue = organization_id || null;
      const result = await manager['db'].query(
        'DELETE FROM config_values WHERE key = $1 AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL)) RETURNING *',
        [key, orgIdValue]
      );

      if (result.rows.length === 0) {
        return c.json({
          success: false,
          error: 'Configuration not found',
          message: `Configuration key "${key}" not found for specified scope`
        }, 404);
      }

      // Clear cache
      manager.clearConfigCache();

      return c.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } catch (error) {
      console.error(`Failed to delete configuration ${c.req.param('key')!}:`, error);
      return c.json({
        success: false,
        error: 'Failed to delete configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get configuration metadata
 * GET /config-management/metadata
 *
 * Query params:
 */
configManagement.get(
  '/metadata',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();

      let query = 'SELECT * FROM config_metadata WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      query += ' ORDER BY key ASC';

      const result = await manager['db'].query(query, values);

      return c.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Failed to list configuration metadata:', error);
      return c.json({
        success: false,
        error: 'Failed to list configuration metadata',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get specific configuration metadata
 * GET /config-management/metadata/:key
 */
configManagement.get(
  '/metadata/:key',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;

      const result = await manager['db'].query(
        'SELECT * FROM config_metadata WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return c.json({
          success: false,
          error: 'Metadata not found',
          message: `Metadata for key "${key}" does not exist`
        }, 404);
      }

      return c.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error(`Failed to get metadata for ${c.req.param('key')!}:`, error);
      return c.json({
        success: false,
        error: 'Failed to get configuration metadata',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

export default configManagement;
