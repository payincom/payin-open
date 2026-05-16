/**
 * Address Pool Management Routes
 * Provides address pool status and management operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';
import { resolveBusinessOrganizationId } from '../open-runtime.js';

const addressPool = new Hono();

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
 * Get address pool availability status
 * GET /address-pool/availability
 * Query params: protocol (evm or tron, default: evm)
 * Required permission: address-pool:read
 */
addressPool.get(
  '/availability',
  authMiddleware(),
  requirePermission('address-pool:read'),
  async (c) => {
  try {
    const manager = getManager();
    const protocol = (c.req.query('protocol') || 'evm') as 'evm' | 'tron' | 'solana';

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = resolveBusinessOrganizationId(c);
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const availability = await manager.getAddressPoolAvailability(organizationId, protocol);

    return c.json({
      success: true,
      data: {
        protocol,
        ...availability
      }
    });
  } catch (error) {
    console.error('Failed to get address pool availability:', error);
    return c.json({
      success: false,
      error: 'Failed to get address pool availability',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

const SUPPORTED_PROTOCOLS: Array<'evm' | 'tron' | 'solana'> = ['evm', 'tron', 'solana'];

/**
 * Get aggregated address pool summary across protocols
 * GET /address-pool/summary
 * Required permission: address-pool:read
 */
addressPool.get(
  '/summary',
  authMiddleware(),
  requirePermission('address-pool:read'),
  async (c) => {
  try {
    const manager = getManager();

    // Enforce organization scope
    const organizationId = resolveBusinessOrganizationId(c);
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const protocolSummaries: Array<{
      protocol: 'evm' | 'tron' | 'solana';
      total: number;
      available: number;
      allocated: number;
      bound: number;
      coolingDown: number;
      archived: number;
      error?: string;
    }> = [];

    for (const protocol of SUPPORTED_PROTOCOLS) {
      try {
        const stats = await manager.getAddressPoolAvailability(organizationId, protocol);
        protocolSummaries.push({
          protocol,
          total: stats.total,
          available: stats.available,
          allocated: stats.allocated,
          bound: stats.bound,
          coolingDown: stats.coolingDown,
          archived: stats.archived ?? 0,
        });
      } catch (error) {
        console.warn(
          `Failed to fetch address pool summary for protocol ${protocol}:`,
          error instanceof Error ? error.message : error
        );
        protocolSummaries.push({
          protocol,
          total: 0,
          available: 0,
          allocated: 0,
          bound: 0,
          coolingDown: 0,
          archived: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalAddresses = protocolSummaries.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalAvailable = protocolSummaries.reduce((acc, item) => acc + (item.available || 0), 0);

    return c.json({
      success: true,
      data: {
        protocols: protocolSummaries,
        totalAddresses,
        totalAvailable,
        hasAddresses: totalAddresses > 0,
        hasAvailableAddresses: totalAvailable > 0,
      },
    });
  } catch (error) {
    console.error('Failed to get address pool summary:', error);
    return c.json({
      success: false,
      error: 'Failed to get address pool summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * List addresses from address pool
 * GET /address-pool/addresses
 * Query params: protocol (optional), page (default: 1), pageSize (default: 20)
 * Required permission: address-pool:read
 */
addressPool.get(
  '/addresses',
  authMiddleware(),
  requirePermission('address-pool:read'),
  async (c) => {
  try {
    const manager = getManager();
    const protocol = c.req.query('protocol') as 'evm' | 'tron' | 'solana' | undefined;
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = resolveBusinessOrganizationId(c);
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    const result = await manager.listAddresses({
      organizationId, // Multi-tenant isolation - only show addresses from user's organization
      protocol,
      page,
      pageSize,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to list addresses:', error);
    return c.json({
      success: false,
      error: 'Failed to list addresses',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Add addresses to address pool
 * POST /address-pool/addresses
 * Body: { addresses: [{ address, protocol, masterPublicKey?, derivationIndex }] }
 * Required permission: address-pool:write
 */
addressPool.post(
  '/addresses',
  authMiddleware(),
  requirePermission('address-pool:write'),
  auditMiddleware('address-pool', 'add-addresses'),
  async (c) => {
  try {
    const manager = getManager();
    const body = await c.req.json();

    // Get organizationId from auth context for multi-tenant isolation
    const organizationId = resolveBusinessOrganizationId(c);
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'Authorization failed',
        message: 'Organization context is required'
      }, 401);
    }

    // Validate request body
    if (!body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Request body must include non-empty "addresses" array'
      }, 400);
    }

    // Validate each address entry and add organizationId
    const addressesWithOrg = [];
    for (const addr of body.addresses) {
      if (!addr.address || !addr.protocol || addr.derivationIndex === undefined) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Each address entry must include: address, protocol, derivationIndex'
        }, 400);
      }

      if (!['evm', 'tron', 'solana'].includes(addr.protocol)) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Protocol must be either "evm", "tron", or "solana"'
        }, 400);
      }

      // Add organizationId to each address entry for multi-tenant isolation
      addressesWithOrg.push({
        ...addr,
        organizationId
      });
    }

    await manager.addAddressesToPool(addressesWithOrg);

    return c.json({
      success: true,
      message: `Successfully added ${body.addresses.length} addresses to pool`
    }, 201);
  } catch (error) {
    console.error('Failed to add addresses to pool:', error);
    return c.json({
      success: false,
      error: 'Failed to add addresses to pool',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Archive an address (soft delete)
 * PATCH /address-pool/addresses/:address/archive
 * Required permission: address-pool:write
 */
addressPool.patch(
  '/addresses/:address/archive',
  authMiddleware(),
  requirePermission('address-pool:write'),
  auditMiddleware('address-pool', 'archive-address'),
  async (c) => {
    try {
      const manager = getManager();
      const address = c.req.param('address')!;

      // Get organizationId from auth context
      const organizationId = resolveBusinessOrganizationId(c);
      if (!organizationId) {
        return c.json({
          success: false,
          error: 'Authorization failed',
          message: 'Organization context is required'
        }, 401);
      }

      await manager.archiveAddress(organizationId, address);

      return c.json({
        success: true,
        message: `Address ${address} has been archived`
      });
    } catch (error) {
      console.error('Failed to archive address:', error);
      return c.json({
        success: false,
        error: 'Failed to archive address',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Unarchive an address (restore)
 * PATCH /address-pool/addresses/:address/unarchive
 * Required permission: address-pool:write
 */
addressPool.patch(
  '/addresses/:address/unarchive',
  authMiddleware(),
  requirePermission('address-pool:write'),
  auditMiddleware('address-pool', 'unarchive-address'),
  async (c) => {
    try {
      const manager = getManager();
      const address = c.req.param('address')!;

      // Get organizationId from auth context
      const organizationId = resolveBusinessOrganizationId(c);
      if (!organizationId) {
        return c.json({
          success: false,
          error: 'Authorization failed',
          message: 'Organization context is required'
        }, 401);
      }

      await manager.unarchiveAddress(organizationId, address);

      return c.json({
        success: true,
        message: `Address ${address} has been restored`
      });
    } catch (error) {
      console.error('Failed to unarchive address:', error);
      return c.json({
        success: false,
        error: 'Failed to unarchive address',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

export default addressPool;
