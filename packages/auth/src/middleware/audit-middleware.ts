/**
 * Audit middleware for Hono
 * Records all API calls to audit_logs table
 */

import type { Context, Next } from 'hono';
import type { AuthManager } from '../auth-manager.js';

export interface AuditMiddlewareOptions {
  /** Resource being accessed (e.g., 'config', 'orders', 'deposits') */
  resource: string;
  /** Action being performed (e.g., 'create', 'update', 'delete', 'read') */
  action: string;
  /** Whether to include request body in audit log */
  includeRequest?: boolean;
  /** Whether to include response body in audit log */
  includeResponse?: boolean;
}

/**
 * Create audit middleware
 * Records operation details to audit_logs table
 */
export function createAuditMiddleware(
  authManager: AuthManager,
  options: AuditMiddlewareOptions
) {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    // Get user info from context (set by auth middleware)
    const userId = c.get('userId');
    const username = c.get('username');

    // Capture request info
    const method = c.req.method;
    const path = c.req.path;
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '';
    const userAgent = c.req.header('user-agent') || '';

    // Get resource ID from URL params (if available)
    const resourceId = c.req.param('key') || c.req.param('id') || c.req.param('orderId');

    // Capture request body if needed
    let requestBody: any = null;
    if (options.includeRequest && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      try {
        requestBody = await c.req.json().catch(() => null);
      } catch (error) {
        // Ignore error, request body might not be JSON
      }
    }

    let responseStatus: number | undefined;
    let responseBody: any = null;
    let error: string | undefined;

    try {
      // Execute the route handler
      await next();

      // Capture response
      responseStatus = c.res.status;

      // Capture response body if needed
      if (options.includeResponse) {
        try {
          const clonedResponse = c.res.clone();
          responseBody = await clonedResponse.json().catch(() => null);
        } catch (err) {
          // Ignore error, response might not be JSON
        }
      }
    } catch (err: any) {
      error = err?.message || 'Unknown error';
      responseStatus = 500;
      throw err; // Re-throw to let error handler deal with it
    } finally {
      // Record audit log
      const duration = Date.now() - startTime;

      // Don't await to avoid blocking response
      authManager.recordAuditLog({
        userId: userId || 'unknown',
        username: username || 'anonymous',
        action: `${options.resource}:${options.action}`,
        resource: options.resource,
        resourceId,
        method,
        path,
        requestBody,
        responseBody,
        responseStatus: responseStatus || undefined,
        duration,
        error,
        ipAddress,
        userAgent,
      }).catch((err) => {
        console.error('Failed to record audit log:', err);
      });
    }
  };
}
