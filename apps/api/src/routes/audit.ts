/**
 * Audit Logs Routes
 * Provides read-only access to audit logs
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware } from '@payin/auth';

const audit = new Hono();

// Lazy middleware factories - only get Auth instance when request comes in
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};


// ==================== Audit Log Routes ====================

/**
 * Get audit logs
 * GET /audit?userId=xxx&resource=xxx&action=xxx&limit=100&offset=0
 * Required permission: audit-logs:read
 */
audit.get(
  '/',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();

      // Parse query parameters
      const userId = c.req.query('userId');
      const resource = c.req.query('resource');
      const action = c.req.query('action');
      const limit = parseInt(c.req.query('limit') || '100', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const logs = await authManager.getAuditLogs({
        userId,
        resource,
        action,
        limit,
        offset
      });

      return c.json({
        success: true,
        data: logs,
        pagination: {
          limit,
          offset,
          count: logs.length
        }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

export default audit;
