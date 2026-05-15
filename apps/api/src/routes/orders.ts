/**
 * Orders Management Routes
 * Provides order creation and query operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';
import { buildOrderPaymentUrl, getBaseUrl } from '../utils/url-builder.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'amount']);
const ALLOWED_SORT_ORDER = new Set(['asc', 'desc']);

const orders = new Hono();

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

/**
 * Create a new order
 * POST /orders
 * Body: { orderReference, amount, currency, chainId, successUrl?, cancelUrl?, metadata? }
 * Required permission: orders:write
 */
orders.post(
  '/',
  authMiddleware(),
  requirePermission('orders:write'),
  auditMiddleware('orders', 'create'),
  async (c) => {
  try {
    const manager = getManager();
    const body = await c.req.json();

    const missingFields: string[] = [];
    if (!body.orderReference || typeof body.orderReference !== 'string' || body.orderReference.trim() === '') {
      missingFields.push('orderReference');
    }
    if (!body.amount || typeof body.amount !== 'string' || body.amount.trim() === '') {
      missingFields.push('amount');
    }
    if (!body.currency || typeof body.currency !== 'string' || body.currency.trim() === '') {
      missingFields.push('currency');
    }
    if (!body.chainId || typeof body.chainId !== 'string' || body.chainId.trim() === '') {
      missingFields.push('chainId');
    }

    if (missingFields.length > 0) {
      return c.json({
        success: false,
        error: 'Validation failed',
        code: 'ORDER_VALIDATION_FAILED',
        message: `Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`,
        suggestions: [
          'Provide all required parameters when creating an order',
          'Amount must be a string literal, for example "10.50"',
          'Review docs://payin/examples/mcp-persona-scenarios#order-validation-checklist for the full checklist'
        ]
      }, 400);
    }

    if (!/^\d+(\.\d{1,18})?$/.test(body.amount)) {
      return c.json({
        success: false,
        error: 'Validation failed',
        code: 'ORDER_AMOUNT_FORMAT_INVALID',
        message: 'Amount must be a numeric string (e.g., "10.50") with up to 18 decimal places',
        suggestions: [
          'Convert numeric values to strings before calling the API',
          'Do not include thousands separators or currency symbols'
        ]
      }, 400);
    }

    // Get organizationId from auth context
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required to create orders',
        suggestions: [
          'When using JWT tokens, include the X-Organization-Id header',
          'Prefer API key authentication (Authorization: Bearer pk_...) to auto-set organization context'
        ]
      }, 401);
    }

    const order = await manager.createOrder({
      organizationId, // Pass organizationId for multi-tenant isolation
      orderReference: body.orderReference,
      amount: body.amount,
      currency: body.currency,
      chainId: body.chainId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      metadata: body.metadata
    });

    // Add payment URL
    // createOrder returns { orderId, ... } while DB objects use { id, ... }
    const baseUrl = getBaseUrl();
    const enrichedOrder = {
      ...order,
      url: buildOrderPaymentUrl(baseUrl, order.orderId || order.id),
    };

    return c.json({
      success: true,
      data: enrichedOrder,
      message: 'Order created successfully'
    }, 201);
  } catch (error) {
    console.error('Failed to create order:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (typeof message === 'string') {
      if (message.includes('No available addresses for chain family')) {
        const protocol = message.split(':').pop()?.trim() || 'specified';
        return c.json({
          success: false,
          error: 'Address pool exhausted',
          code: 'ADDRESS_POOL_EXHAUSTED',
          message: `The ${protocol.toUpperCase()} address pool has no available addresses.`,
          suggestions: [
            'Call POST /api/v1/address-pool/allocate to replenish capacity for this protocol',
            'Alternatively import fresh hot wallet addresses in Admin > Address Pool',
            'Retry order creation after the pool has been refilled'
          ]
        }, 409);
      }

      if (message.includes('Order service is disabled')) {
        return c.json({
          success: false,
          error: 'Service disabled',
          code: 'ORDER_SERVICE_DISABLED',
          message,
          suggestions: [
            'Enable the order service for this organization in Admin > Service Toggles',
            'If you cannot enable it, contact PayIn support for assistance'
          ]
        }, 403);
      }
    }

    return c.json({
      success: false,
      error: 'Failed to create order',
      code: 'ORDER_CREATION_FAILED',
      message,
      suggestions: [
        'Verify the request payload satisfies the API requirements',
        'If the issue persists, capture timestamp and organization ID then contact PayIn support'
      ]
    }, 500);
  }
});

/**
 * List orders with filtering and pagination
 * GET /orders
 * Query params: status, chain, token, orderReference, createdAfter, createdBefore, page, limit, sortBy, sortOrder
 * Required permission: orders:read
 */
orders.get(
  '/',
  authMiddleware(),
  requirePermission('orders:read'),
  async (c) => {
  try {
    const manager = getManager();

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required to view order statistics',
        suggestions: [
          'When using JWT tokens, include the X-Organization-Id header',
          'Prefer API key authentication (Authorization: Bearer pk_...) to auto-set organization context'
        ]
      }, 401);
    }

    // Parse query parameters
    const filters: any = {
      organizationId // Multi-tenant isolation - only show orders from user's organization
    };

    const status = c.req.query('status');
    if (status) {
      filters.status = status.includes(',') ? status.split(',') : status;
    }

    const chain = c.req.query('chain');
    if (chain) filters.chain = chain;

    const token = c.req.query('token');
    if (token) filters.token = token;

    const orderReference = c.req.query('orderReference');
    if (orderReference) filters.orderReference = orderReference;

    const createdAfter = c.req.query('createdAfter');
    if (createdAfter) {
      const parsed = new Date(createdAfter);
      if (Number.isNaN(parsed.getTime())) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_DATE',
          message: 'createdAfter must be a valid ISO 8601 date string',
          suggestions: [
            'Use a UTC timestamp such as 2025-01-15T08:00:00Z',
            'Avoid locale-specific formats like 01/15/2025'
          ]
        }, 400);
      }
      filters.createdAfter = parsed;
    }

    const createdBefore = c.req.query('createdBefore');
    if (createdBefore) {
      const parsed = new Date(createdBefore);
      if (Number.isNaN(parsed.getTime())) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_DATE',
          message: 'createdBefore must be a valid ISO 8601 date string',
          suggestions: [
            'Use a UTC timestamp such as 2025-01-15T18:00:00Z',
            'Avoid locale-specific formats like 01/15/2025'
          ]
        }, 400);
      }
      filters.createdBefore = parsed;
    }

    const page = c.req.query('page');
    if (page) {
      const parsedPage = Number(page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_PAGE',
          message: 'page must be a positive integer',
          suggestions: [
            'Use page=1 to request the first page',
            'Do not include decimals or non-numeric characters'
          ]
        }, 400);
      }
      filters.page = parsedPage;
    }

    const limit = c.req.query('limit');
    if (limit) {
      const parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_LIMIT',
          message: 'limit must be an integer between 1 and 100',
          suggestions: [
            'The recommended default is limit=20',
            'For large exports consider the analytics API or your own reporting pipeline'
          ]
        }, 400);
      }
      filters.limit = parsedLimit;
    }

    const sortBy = c.req.query('sortBy');
    if (sortBy) {
      if (!ALLOWED_SORT_FIELDS.has(sortBy)) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_SORT',
          message: `sortBy must be one of: ${Array.from(ALLOWED_SORT_FIELDS).join(', ')}`,
          suggestions: [
            'Use createdAt to sort chronologically',
            'Use amount when building revenue reports'
          ]
        }, 400);
      }
      filters.sortBy = sortBy as any;
    }

    const sortOrder = c.req.query('sortOrder');
    if (sortOrder) {
      const normalized = sortOrder.toLowerCase();
      if (!ALLOWED_SORT_ORDER.has(normalized)) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_FILTER_INVALID_SORT',
          message: 'sortOrder must be either asc or desc',
          suggestions: [
            'asc returns oldest records first',
            'desc returns newest records first'
          ]
        }, 400);
      }
      filters.sortOrder = normalized as any;
    }

    const result = await manager.listOrders(filters);

    // Add payment URLs to orders
    const baseUrl = getBaseUrl();
    const enrichedOrders = result.orders.map((order: any) => ({
      ...order,
      url: buildOrderPaymentUrl(baseUrl, order.id),
    }));

    return c.json({
      success: true,
      data: enrichedOrders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    console.error('Failed to list orders:', error);
    return c.json({
      success: false,
      error: 'Failed to list orders',
      code: 'ORDER_LIST_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestions: [
        'Confirm that filter parameters are valid ISO 8601 strings where required',
        'For bulk exports consider the analytics API or contact support'
      ]
    }, 500);
  }
});

/**
 * Get order statistics
 * GET /orders/stats
 * Query params: chain, token, createdAfter, createdBefore
 * Required permission: orders:read
 */
orders.get(
  '/stats',
  authMiddleware(),
  requirePermission('orders:read'),
  async (c) => {
  try {
    const manager = getManager();

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required to list orders',
        suggestions: [
          'When using JWT tokens, include the X-Organization-Id header',
          'Prefer API key authentication (Authorization: Bearer pk_...) to auto-set organization context'
        ]
      }, 401);
    }

    const filters: any = {
      organizationId // Multi-tenant isolation - only show stats from user's organization
    };

    const chain = c.req.query('chain');
    if (chain) filters.chain = chain;

    const token = c.req.query('token');
    if (token) filters.token = token;

    const createdAfter = c.req.query('createdAfter');
    if (createdAfter) {
      const parsed = new Date(createdAfter);
      if (Number.isNaN(parsed.getTime())) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_STATS_INVALID_DATE',
          message: 'createdAfter must be a valid ISO 8601 date string',
          suggestions: [
            'Use a UTC timestamp such as 2025-01-15T08:00:00Z',
            'Avoid locale-specific formats like 01/15/2025'
          ]
        }, 400);
      }
      filters.createdAfter = parsed;
    }

    const createdBefore = c.req.query('createdBefore');
    if (createdBefore) {
      const parsed = new Date(createdBefore);
      if (Number.isNaN(parsed.getTime())) {
        return c.json({
          success: false,
          error: 'Validation failed',
          code: 'ORDER_STATS_INVALID_DATE',
          message: 'createdBefore must be a valid ISO 8601 date string',
          suggestions: [
            'Use a UTC timestamp such as 2025-01-15T18:00:00Z',
            'Avoid locale-specific formats like 01/15/2025'
          ]
        }, 400);
      }
      filters.createdBefore = parsed;
    }

    const stats = await manager.getOrderStatistics(filters);

    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get order statistics:', error);
    return c.json({
      success: false,
      error: 'Failed to get order statistics',
      code: 'ORDER_STATS_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestions: [
        'Confirm the requested date range uses valid ISO 8601 strings',
        'For long-running analysis windows, consider offline reports or a data warehouse'
      ]
    }, 500);
  }
});

/**
 * Get order by ID
 * GET /orders/:id
 * Required permission: orders:read
 */
orders.get(
  '/:id',
  authMiddleware(),
  requirePermission('orders:read'),
  async (c) => {
  try {
    const manager = getManager();
    const orderId = c.req.param('id');

    if (!UUID_REGEX.test(orderId)) {
      return c.json({
        success: false,
        error: 'Validation failed',
        code: 'ORDER_ID_INVALID',
        message: `orderId "${orderId}" is not a valid UUID`,
        suggestions: [
          'Use the id value returned from POST /api/v1/orders',
          'If you only track orderReference, call GET /api/v1/orders?orderReference=... first'
        ]
      }, 400);
    }

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = c.get('organizationId');
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required to retrieve orders',
        suggestions: [
          'When using JWT tokens, include the X-Organization-Id header',
          'Prefer API key authentication (Authorization: Bearer pk_...) to auto-set organization context'
        ]
      }, 401);
    }

    const order = await manager.getOrder(orderId, organizationId);

    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND',
        message: `Order with ID "${orderId}" does not exist or you don't have permission to access it`,
        suggestions: [
          'Confirm the order belongs to the current organization',
          'If you only have the business order number, query by orderReference first'
        ]
      }, 404);
    }

    // Add payment URL
    const baseUrl = getBaseUrl();
    const enrichedOrder = {
      ...order,
      url: buildOrderPaymentUrl(baseUrl, order.id),
    };

    return c.json({
      success: true,
      data: enrichedOrder
    });
  } catch (error) {
    console.error(`Failed to get order ${c.req.param('id')}:`, error);
    return c.json({
      success: false,
      error: 'Failed to get order',
      code: 'ORDER_GET_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default orders;
