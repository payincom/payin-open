/**
 * Notification Management API Routes
 * Provides endpoints for managing notification endpoints and logs
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, requirePermission } from '@payin/auth';

const app = new Hono();

// Lazy auth middleware - only gets Auth instance when request comes in
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};

// ==================== Endpoints CRUD ====================

/**
 * Create notification endpoint
 * POST /api/v1/notifications/endpoints
 *
 * Body:
 * {
 *   endpoint_name: string;
 *   endpoint_type: 'webhook' | 'email' | 'telegram';
 *   config: {
 *     url?: string;  // for webhook
 *     secret?: string;  // for webhook
 *     to?: string[];  // for email
 *     chat_id?: string;  // for telegram
 *     bot_token?: string;  // for telegram
 *   };
 *   subscribed_events: string[];  // ["order.created", "order.completed", ...]
 *   max_retries?: number;
 *   timeout_ms?: number;
 *   description?: string;
 *   is_enabled?: boolean;
 * }
 */
app.post('/endpoints', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const body = await c.req.json();
    // Add organization_id to the request
    const endpoint = await notification.createEndpoint({
      ...body,
      organization_id: organizationId
    });
    return c.json(endpoint, 201);
  } catch (error) {
    return c.json({
      error: 'Failed to create endpoint',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400);
  }
});

/**
 * List notification endpoints
 * GET /api/v1/notifications/endpoints
 *
 * Query params:
 * - endpoint_type?: 'webhook' | 'email' | 'telegram'
 * - is_enabled?: 'true' | 'false'
 */
app.get('/endpoints', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const endpointType = c.req.query('endpoint_type');
    const isEnabled = c.req.query('is_enabled');

    const filters: any = {
      organization_id: organizationId  // CRITICAL: Filter by organization
    };
    if (endpointType) filters.endpoint_type = endpointType;
    if (isEnabled !== undefined) filters.is_enabled = isEnabled === 'true';

    const endpoints = await notification.listEndpoints(filters);
    return c.json({ endpoints, total: endpoints.length });
  } catch (error) {
    return c.json({
      error: 'Failed to list endpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get notification endpoint by ID
 * GET /api/v1/notifications/endpoints/:id
 */
app.get('/endpoints/:id', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');
    const endpoint = await notification.getEndpoint(id);

    if (!endpoint) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    // Verify endpoint belongs to user's organization
    if (endpoint.organization_id !== organizationId) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    return c.json(endpoint);
  } catch (error) {
    return c.json({
      error: 'Failed to get endpoint',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Update notification endpoint
 * PUT /api/v1/notifications/endpoints/:id
 *
 * Body: Partial<CreateEndpointRequest>
 */
app.put('/endpoints/:id', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');

    // Verify endpoint belongs to user's organization
    const existing = await notification.getEndpoint(id);
    if (!existing || existing.organization_id !== organizationId) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    const updates = await c.req.json();
    const endpoint = await notification.updateEndpoint(id, updates);
    return c.json(endpoint);
  } catch (error) {
    return c.json({
      error: 'Failed to update endpoint',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400);
  }
});

/**
 * Delete notification endpoint
 * DELETE /api/v1/notifications/endpoints/:id
 */
app.delete('/endpoints/:id', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');

    // Verify endpoint belongs to user's organization
    const existing = await notification.getEndpoint(id);
    if (!existing || existing.organization_id !== organizationId) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    await notification.deleteEndpoint(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: 'Failed to delete endpoint',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400);
  }
});

/**
 * Test notification endpoint
 * POST /api/v1/notifications/endpoints/:id/test
 */
app.post('/endpoints/:id/test', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');

    // Verify endpoint belongs to user's organization
    const existing = await notification.getEndpoint(id);
    if (!existing || existing.organization_id !== organizationId) {
      return c.json({ error: 'Endpoint not found' }, 404);
    }

    const success = await notification.testEndpoint(id);
    return c.json({ success });
  } catch (error) {
    return c.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400);
  }
});

// ==================== Notification Logs ====================

/**
 * Get notification logs
 * GET /api/v1/notifications/logs
 *
 * Query params:
 * - endpoint_id?: string
 * - event_type?: string
 * - status?: 'pending' | 'sending' | 'success' | 'failed' | 'cancelled'
 * - business_type?: 'order' | 'deposit' | 'transfer'
 * - business_id?: string
 * - page?: number
 * - limit?: number
 */
app.get('/logs', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const filters = {
      organization_id: organizationId,  // CRITICAL: Filter by organization
      endpoint_id: c.req.query('endpoint_id'),
      event_type: c.req.query('event_type'),
      status: c.req.query('status'),
      business_type: c.req.query('business_type'),
      business_id: c.req.query('business_id'),
      page: parseInt(c.req.query('page') || '1'),
      limit: parseInt(c.req.query('limit') || '50'),
    };

    const result = await notification.getNotificationLogs(filters);
    return c.json(result);
  } catch (error) {
    return c.json({
      error: 'Failed to get logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get notification log by ID
 * GET /api/v1/notifications/logs/:id
 */
app.get('/logs/:id', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');
    const log = await notification.getNotificationLog(id);

    if (!log) {
      return c.json({ error: 'Notification log not found' }, 404);
    }

    // Verify log belongs to user's organization
    if (log.organization_id !== organizationId) {
      return c.json({ error: 'Notification log not found' }, 404);
    }

    return c.json(log);
  } catch (error) {
    return c.json({
      error: 'Failed to get log',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Retry notification
 * POST /api/v1/notifications/logs/:id/retry
 */
app.post('/logs/:id/retry', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const id = c.req.param('id');

    // Verify log belongs to user's organization
    const log = await notification.getNotificationLog(id);
    if (!log || log.organization_id !== organizationId) {
      return c.json({ error: 'Notification log not found' }, 404);
    }

    await notification.retryNotification(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: 'Retry failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400);
  }
});

/**
 * Batch retry failed notifications
 * POST /api/v1/notifications/retry-failed
 *
 * Body:
 * {
 *   endpoint_id?: string;
 *   event_type?: string;
 *   failed_after?: string;  // ISO 8601 timestamp
 * }
 */
app.post('/retry-failed', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const body = await c.req.json();

    // If endpoint_id is provided, verify it belongs to user's organization
    if (body.endpoint_id) {
      const endpoint = await notification.getEndpoint(body.endpoint_id);
      if (!endpoint || endpoint.organization_id !== organizationId) {
        return c.json({ error: 'Endpoint not found' }, 404);
      }
    }

    const retried = await notification.retryFailedNotifications(body);
    return c.json({ success: true, retried });
  } catch (error) {
    return c.json({
      error: 'Batch retry failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==================== Statistics ====================

/**
 * Get notification statistics
 * GET /api/v1/notifications/statistics
 *
 * Query params:
 * - endpoint_id?: string
 * - start_date?: string (YYYY-MM-DD)
 * - end_date?: string (YYYY-MM-DD)
 */
app.get('/statistics', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const endpointId = c.req.query('endpoint_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    // If endpoint_id is provided, verify it belongs to user's organization
    if (endpointId) {
      const endpoint = await notification.getEndpoint(endpointId);
      if (!endpoint || endpoint.organization_id !== organizationId) {
        return c.json({ error: 'Endpoint not found' }, 404);
      }
    }

    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

    // CRITICAL: Pass organizationId for multi-tenant isolation
    const stats = await notification.getStatistics(organizationId, endpointId, dateRange);
    return c.json(stats);
  } catch (error) {
    return c.json({
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get queue status
 * GET /api/v1/notifications/queue/status
 */
app.get('/queue/status', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();

  if (!notification) {
    return c.json({ error: 'Notification service not available' }, 503);
  }

  try {
    // Queue status is a system-wide metric, but still require authentication
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const status = notification.getQueueStatus();
    return c.json(status);
  } catch (error) {
    return c.json({
      error: 'Failed to get queue status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==================== Webhook Aliases ====================
// Map /webhooks/* to /endpoints/* for API discoverability
// QA and external docs reference /notifications/webhooks, so we alias them

app.post('/webhooks', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  // Forward to endpoints handler
  const manager = getManager();
  const notification = manager.getNotificationService();
  if (!notification) {
    return c.json({ error: 'Notification service not initialized' }, 503);
  }
  try {
    const body = await c.req.json();
    const organizationId = c.get('organizationId');
    const endpoint = await notification.createEndpoint({
      ...body,
      organizationId,
    });
    return c.json({ success: true, data: endpoint }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create webhook', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.get('/webhooks', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();
  if (!notification) {
    return c.json({ error: 'Notification service not initialized' }, 503);
  }
  try {
    const organizationId = c.get('organizationId');
    const endpoints = await notification.listEndpoints({ organizationId });
    return c.json({ success: true, data: endpoints });
  } catch (error) {
    return c.json({ error: 'Failed to list webhooks', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.get('/webhooks/:id', authMiddleware(), requirePermission('webhooks:read'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();
  if (!notification) {
    return c.json({ error: 'Notification service not initialized' }, 503);
  }
  try {
    const id = c.req.param('id');
    const endpoint = await notification.getEndpoint(id);
    if (!endpoint) {
      return c.json({ error: 'Webhook not found' }, 404);
    }
    return c.json({ success: true, data: endpoint });
  } catch (error) {
    return c.json({ error: 'Failed to get webhook', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.put('/webhooks/:id', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();
  if (!notification) {
    return c.json({ error: 'Notification service not initialized' }, 503);
  }
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const endpoint = await notification.updateEndpoint(id, body);
    return c.json({ success: true, data: endpoint });
  } catch (error) {
    return c.json({ error: 'Failed to update webhook', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.delete('/webhooks/:id', authMiddleware(), requirePermission('webhooks:write'), async (c) => {
  const manager = getManager();
  const notification = manager.getNotificationService();
  if (!notification) {
    return c.json({ error: 'Notification service not initialized' }, 503);
  }
  try {
    const id = c.req.param('id');
    await notification.deleteEndpoint(id);
    return c.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    return c.json({ error: 'Failed to delete webhook', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

export default app;
