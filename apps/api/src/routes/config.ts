/**
 * Configuration Management Routes
 * Provides CRUD operations for database config and read-only runtime config
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager, getManagerYamlPath } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware } from '@payin/auth';
import * as configHelpers from '../utils/config-helpers.js';

const config = new Hono();

// Lazy middleware factories - only get Auth instance when request comes in
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

// ==================== Configuration Metadata ====================
// Put metadata routes first to avoid being captured by /:key

/**
 * List all configuration metadata
 * GET /config/metadata
 * Query params: ?category=business_rules
 */
config.get(
  '/metadata',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const category = c.req.query('category') as any;

      const filters: any = {};
      if (category) {
        filters.category = category;
      }

      const metadata = await configHelpers.listConfigMetadata(manager, filters);

      return c.json({
        success: true,
        data: metadata,
        total: metadata.length
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
 * Get metadata for specific configuration
 * GET /config/metadata/:key
 */
config.get(
  '/metadata/:key',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;

      const metadata = await configHelpers.getConfigMetadata(manager, key);

      if (!metadata) {
        return c.json({
          success: false,
          error: 'Metadata not found',
          message: `Metadata for key "${key}" does not exist`
        }, 404);
      }

      return c.json({
        success: true,
        data: metadata
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

// ==================== Runtime Configuration (Read-only) ====================

/**
 * Get complete runtime configuration (merged)
 * GET /config/runtime
 */
config.get(
  '/runtime',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const yamlPath = getManagerYamlPath();
      const runtimeConfig = await configHelpers.getRuntimeConfig(manager, yamlPath || undefined);

      return c.json({
        success: true,
        data: runtimeConfig
      });
    } catch (error) {
      console.error('Failed to get runtime configuration:', error);
      return c.json({
        success: false,
        error: 'Failed to get runtime configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get Manager YAML configuration
 * GET /config/runtime/manager
 */
config.get(
  '/runtime/manager',
  authMiddleware(),
  async (c) => {
    try {
      const yamlPath = getManagerYamlPath();
      const managerConfig = await configHelpers.getManagerYamlConfig(yamlPath || undefined);

      return c.json({
        success: true,
        source: 'manager.yaml',
        data: managerConfig
      });
    } catch (error) {
      console.error('Failed to get Manager configuration:', error);
      return c.json({
        success: false,
        error: 'Failed to get Manager configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get Processor default configuration
 * GET /config/runtime/processor
 */
config.get(
  '/runtime/processor',
  authMiddleware(),
  async (c) => {
    try {
      const processorConfig = await configHelpers.getProcessorDefaultConfig();

      return c.json({
        success: true,
        source: 'processor/default.yaml',
        data: processorConfig
      });
    } catch (error) {
      console.error('Failed to get Processor configuration:', error);
      return c.json({
        success: false,
        error: 'Failed to get Processor configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get Monitor default configuration
 * GET /config/runtime/monitor
 */
config.get(
  '/runtime/monitor',
  authMiddleware(),
  async (c) => {
    try {
      const monitorConfig = await configHelpers.getMonitorDefaultConfig();

      return c.json({
        success: true,
        source: 'monitor/default.yaml',
        data: monitorConfig
      });
    } catch (error) {
      console.error('Failed to get Monitor configuration:', error);
      return c.json({
        success: false,
        error: 'Failed to get Monitor configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// ==================== Database Configuration (CRUD) ====================

/**
 * List all configuration values from database
 * GET /config
 * Query params: ?category=business_rules
 */
config.get(
  '/',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const category = c.req.query('category') as any;

      const filters: any = {};
      if (category) {
        filters.category = category;
      }

      const settings = await manager.listSystemSettings(filters);

      return c.json({
        success: true,
        data: settings,
        total: settings.length
      });
    } catch (error) {
      console.error('Failed to list configurations:', error);
      return c.json({
        success: false,
        error: 'Failed to list configurations',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get specific configuration with metadata
 * GET /config/:key
 */
config.get(
  '/:key',
  authMiddleware(),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;

      // Get configuration value
      const setting = await manager.getSystemSetting(key);
      if (!setting) {
        return c.json({
          success: false,
          error: 'Configuration not found',
          message: `Configuration key "${key}" does not exist`
        }, 404);
      }

      // Get metadata
      const metadata = await configHelpers.getConfigMetadata(manager, key);

      return c.json({
        success: true,
        data: {
          ...setting,
          metadata
        }
      });
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
 * Update configuration value
 * PUT /config/:key
 * Body: { value }
 */
config.put(
  '/:key',
  authMiddleware(),
  auditMiddleware('config', 'update'),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;
      const body = await c.req.json();

      if (!body || body.value === undefined) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Request body must include "value" field'
        }, 400);
      }

      // Get metadata to determine category and validate type
      const metadata = await configHelpers.getConfigMetadata(manager, key);
      if (!metadata) {
        return c.json({
          success: false,
          error: 'Configuration not found',
          message: `Configuration key "${key}" does not exist in metadata`
        }, 404);
      }

      // Validate and convert type based on metadata
      let validatedValue = body.value;

      if (metadata.type === 'number') {
        // Convert to number if it's a string
        if (typeof validatedValue === 'string') {
          validatedValue = Number(validatedValue);
        }
        // Validate it's a valid number
        if (typeof validatedValue !== 'number' || isNaN(validatedValue)) {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a valid number for "${key}"`
          }, 400);
        }
        // Validate range if specified
        if (metadata.validationRules) {
          if (metadata.validationRules.min !== undefined && validatedValue < metadata.validationRules.min) {
            return c.json({
              success: false,
              error: 'Validation failed',
              message: `Value must be at least ${metadata.validationRules.min} for "${key}"`
            }, 400);
          }
          if (metadata.validationRules.max !== undefined && validatedValue > metadata.validationRules.max) {
            return c.json({
              success: false,
              error: 'Validation failed',
              message: `Value must be at most ${metadata.validationRules.max} for "${key}"`
            }, 400);
          }
        }
      } else if (metadata.type === 'boolean') {
        // Convert to boolean if it's a string
        if (typeof validatedValue === 'string') {
          validatedValue = validatedValue === 'true';
        }
        // Validate it's a boolean
        if (typeof validatedValue !== 'boolean') {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a boolean for "${key}"`
          }, 400);
        }
      } else if (metadata.type === 'string') {
        // Validate it's a string
        if (typeof validatedValue !== 'string') {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: `Value must be a string for "${key}"`
          }, 400);
        }
      }

      // Update configuration with validated value
      const updated = await manager.setSystemSetting(key, validatedValue);

      return c.json({
        success: true,
        data: updated,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error(`Failed to update configuration ${c.req.param('key')!}:`, error);
      return c.json({
        success: false,
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Delete configuration (revert to default)
 * DELETE /config/:key
 */
config.delete(
  '/:key',
  authMiddleware(),
  auditMiddleware('config', 'delete'),
  async (c) => {
    try {
      const manager = getManager();
      const key = c.req.param('key')!;

      // Delete configuration
      await manager.deleteSystemSetting(key);

      return c.json({
        success: true,
        message: 'Configuration deleted and reverted to default'
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

export default config;
