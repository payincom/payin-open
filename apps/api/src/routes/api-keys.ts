/**
 * API Keys Management Routes
 * Provides API key creation, listing, and revocation operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';

const apiKeys = new Hono();

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
 * Create a new API key
 * POST /api-keys
 * Body: { name, expiresAt? }
 * Required permission: auth:write
 */
apiKeys.post(
  '/',
  authMiddleware(),
  requirePermission('api-keys:write'),
  auditMiddleware('api-keys', 'create'),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.get('userId');
      const organizationId = c.get('organizationId');
      const body = await c.req.json();

      // Validate organizationId
      if (typeof organizationId !== 'string' || organizationId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authorization failed',
          message: 'Organization context is required'
        }, 401);
      }

      if (typeof userId !== 'string' || userId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authentication failed',
          message: 'User context is required'
        }, 401);
      }

      // Validate input
      if (!body.name || typeof body.name !== 'string') {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Name is required and must be a string'
        }, 400);
      }

      // Parse expiresAt if provided
      let expiresAt: Date | undefined;
      if (body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
        if (isNaN(expiresAt.getTime())) {
          return c.json({
            success: false,
            error: 'Validation failed',
            message: 'Invalid expiresAt date format'
          }, 400);
        }
      }

      // Create API key with organization context
      const result = await authManager.createApiKey(userId, organizationId, {
        name: body.name,
        expiresAt,
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Create API key error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Return 403 for permission-related errors instead of 500
      if (message.includes('Insufficient permissions') || message.includes('not a member')) {
        return c.json({
          success: false,
          error: 'Forbidden',
          message
        }, 403);
      }

      return c.json({
        success: false,
        error: 'Internal server error',
        message
      }, 500);
    }
  }
);

/**
 * List all API keys for current user
 * GET /api-keys
 * Required permission: auth:read
 */
apiKeys.get(
  '/',
  authMiddleware(),
  requirePermission('api-keys:read'),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.get('userId');
      const organizationId = c.get('organizationId');

      // Validate organizationId
      if (typeof organizationId !== 'string' || organizationId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authorization failed',
          message: 'Organization context is required'
        }, 401);
      }

      if (typeof userId !== 'string' || userId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authentication failed',
          message: 'User context is required'
        }, 401);
      }

      const keys = await authManager.listApiKeys(organizationId, userId);

      return c.json({
        success: true,
        data: keys
      });
    } catch (error) {
      console.error('List API keys error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get API key by ID
 * GET /api-keys/:id
 * Required permission: auth:read
 */
apiKeys.get(
  '/:id',
  authMiddleware(),
  requirePermission('api-keys:read'),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.get('userId');
      const keyId = c.req.param('id');

      if (typeof userId !== 'string' || userId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authentication failed',
          message: 'User context is required'
        }, 401);
      }

      const key = await authManager.getApiKeyById(keyId);

      if (!key) {
        return c.json({
          success: false,
          error: 'Not found',
          message: 'API key not found'
        }, 404);
      }

      // Check ownership
      if (key.userId !== userId) {
        return c.json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to access this API key'
        }, 403);
      }

      return c.json({
        success: true,
        data: key
      });
    } catch (error) {
      console.error('Get API key error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Update API key
 * PATCH /api-keys/:id
 * Body: { name?, isActive?, expiresAt? }
 * Required permission: auth:write
 */
apiKeys.patch(
  '/:id',
  authMiddleware(),
  requirePermission('api-keys:write'),
  auditMiddleware('api-keys', 'update'),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.get('userId');
      const keyId = c.req.param('id');
      const body = await c.req.json();

      if (typeof userId !== 'string' || userId.trim() === '') {
        return c.json({
          success: false,
          error: 'Authentication failed',
          message: 'User context is required'
        }, 401);
      }

      // Check ownership
      const existingKey = await authManager.getApiKeyById(keyId);
      if (!existingKey) {
        return c.json({
          success: false,
          error: 'Not found',
          message: 'API key not found'
        }, 404);
      }

      if (existingKey.userId !== userId) {
        return c.json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to update this API key'
        }, 403);
      }

      // Parse expiresAt if provided
      let expiresAt: Date | undefined;
      if (body.expiresAt !== undefined) {
        if (body.expiresAt === null) {
          expiresAt = undefined;
        } else {
          expiresAt = new Date(body.expiresAt);
          if (isNaN(expiresAt.getTime())) {
            return c.json({
              success: false,
              error: 'Validation failed',
              message: 'Invalid expiresAt date format'
            }, 400);
          }
        }
      }

      // Update API key
      const updated = await authManager.updateApiKey(keyId, {
        name: body.name,
        isActive: body.isActive,
        expiresAt,
      });

      return c.json({
        success: true,
        data: updated
      });
    } catch (error) {
      console.error('Update API key error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Revoke (delete) API key
 * DELETE /api-keys/:id
 * Required permission: auth:delete
 */
apiKeys.delete(
  '/:id',
  authMiddleware(),
  requirePermission('api-keys:write'),
  auditMiddleware('api-keys', 'delete'),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.get('userId');
      const keyId = c.req.param('id');

      // Check ownership
      const existingKey = await authManager.getApiKeyById(keyId);
      if (!existingKey) {
        return c.json({
          success: false,
          error: 'Not found',
          message: 'API key not found'
        }, 404);
      }

      if (existingKey.userId !== userId) {
        return c.json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to delete this API key'
        }, 403);
      }

      // Revoke API key
      await authManager.revokeApiKey(keyId);

      return c.json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error) {
      console.error('Revoke API key error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

export default apiKeys;
