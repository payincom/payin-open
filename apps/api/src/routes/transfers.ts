/**
 * Transfers Query Routes
 * Provides transfer record query operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware } from '@payin/auth';
import { resolveBusinessOrganizationId } from '../open-runtime.js';

const transfers = new Hono();

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
 * List transfers with filtering and pagination
 * GET /transfers
 * Query params: orderId, depositReference, businessType, chain, token, isConfirmed, isFailed,
 *               detectedAfter, detectedBefore, page, limit, sortBy, sortOrder
 * Required permission: transfers:read
 */
transfers.get(
  '/',
  authMiddleware(),
  async (c) => {
  try {
    const manager = getManager();

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = resolveBusinessOrganizationId(c);
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const filters: any = {
      organizationId // Multi-tenant isolation - only show transfers from user's organization
    };

    const orderId = c.req.query('orderId');
    if (orderId) filters.orderId = orderId;

    const depositReference = c.req.query('depositReference');
    if (depositReference) filters.depositReference = depositReference;

    const businessType = c.req.query('businessType');
    if (businessType) filters.businessType = businessType as 'order' | 'deposit';

    const chain = c.req.query('chain');
    if (chain) filters.chain = chain;

    const token = c.req.query('token');
    if (token) filters.token = token;

    const isConfirmed = c.req.query('isConfirmed');
    if (isConfirmed !== undefined) filters.isConfirmed = isConfirmed === 'true';

    const isFailed = c.req.query('isFailed');
    if (isFailed !== undefined) filters.isFailed = isFailed === 'true';

    const detectedAfter = c.req.query('detectedAfter');
    if (detectedAfter) filters.detectedAfter = new Date(detectedAfter);

    const detectedBefore = c.req.query('detectedBefore');
    if (detectedBefore) filters.detectedBefore = new Date(detectedBefore);

    const page = c.req.query('page');
    if (page) filters.page = parseInt(page);

    const limit = c.req.query('limit');
    if (limit) filters.limit = parseInt(limit);

    const sortBy = c.req.query('sortBy');
    if (sortBy) filters.sortBy = sortBy as any;

    const sortOrder = c.req.query('sortOrder');
    if (sortOrder) filters.sortOrder = sortOrder as any;

    const result = await manager.listTransfers(filters);

    return c.json({
      success: true,
      data: result.transfers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    console.error('Failed to list transfers:', error);
    return c.json({
      success: false,
      error: 'Failed to list transfers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get transfers for specific order or deposit
 * GET /transfers/by-reference
 * Query params: orderId OR depositReference (one required)
 * Required permission: transfers:read
 */
transfers.get(
  '/by-reference',
  authMiddleware(),
  async (c) => {
  try {
    const manager = getManager();
    const orderId = c.req.query('orderId');
    const depositReference = c.req.query('depositReference');

    if (!orderId && !depositReference) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Either orderId or depositReference is required'
      }, 400);
    }

    const reference: any = {};
    if (orderId) reference.orderId = orderId;
    if (depositReference) reference.depositReference = depositReference;

    const transfersList = await manager.getTransfers(reference);

    return c.json({
      success: true,
      data: transfersList,
      total: transfersList.length
    });
  } catch (error) {
    console.error('Failed to get transfers:', error);
    return c.json({
      success: false,
      error: 'Failed to get transfers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default transfers;
