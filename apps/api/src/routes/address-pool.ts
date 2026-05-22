/**
 * Address Pool Management Routes
 * Provides address pool status and management operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';
import {
  organizationContextRequiredMessage,
  organizationContextRequiredPayload,
  resolveRuntimeContext as defaultResolveRuntimeContext,
} from '../open-runtime.js';

export interface AddressPoolRouteDependencies {
  getManager?: typeof getManager;
  getAuth?: typeof getAuth;
  createAuthMiddleware?: typeof createAuthMiddleware;
  createAuditMiddleware?: typeof createAuditMiddleware;
  requirePermission?: typeof requirePermission;
  resolveRuntimeContext?: typeof defaultResolveRuntimeContext;
  organizationContextRequiredMessage?: typeof organizationContextRequiredMessage;
}

export function createAddressPoolRoutes(deps: AddressPoolRouteDependencies = {}) {
  const addressPool = new Hono();
  const getManagerInstance = deps.getManager ?? getManager;
  const getAuthManager = deps.getAuth ?? getAuth;
  const authMiddlewareFactory = deps.createAuthMiddleware ?? createAuthMiddleware;
  const auditMiddlewareFactory = deps.createAuditMiddleware ?? createAuditMiddleware;
  const requirePermissionMiddleware = deps.requirePermission ?? requirePermission;
  const resolveRuntimeContext = deps.resolveRuntimeContext ?? defaultResolveRuntimeContext;
  const getOrganizationContextRequiredMessage =
    deps.organizationContextRequiredMessage ?? organizationContextRequiredMessage;

  const organizationContextRequiredResponse = (c: Context) =>
    c.json(
      {
        ...organizationContextRequiredPayload(),
        message: getOrganizationContextRequiredMessage(),
      },
      401
    );

  // Lazy middleware factories - only get Auth instance when request comes in
  const authMiddleware = () => {
    return async (c: Context, next: Next) => {
      const middleware = authMiddlewareFactory(getAuthManager());
      return await middleware(c, next);
    };
  };

  const auditMiddleware = (resource: string, action: string) => {
    return async (c: Context, next: Next) => {
      const middleware = auditMiddlewareFactory(getAuthManager(), { resource, action });
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
    requirePermissionMiddleware('address-pool:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const protocol = (c.req.query('protocol') || 'evm') as 'evm' | 'tron' | 'solana';

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const availability = await manager.getAddressPoolAvailabilityForRuntimeScope(
          runtimeContext,
          protocol
        );

        return c.json({
          success: true,
          data: {
            protocol,
            ...availability,
          },
        });
      } catch (error) {
        console.error('Failed to get address pool availability:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to get address pool availability',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  const SUPPORTED_PROTOCOLS: Array<'evm' | 'tron' | 'solana'> = ['evm', 'tron', 'solana'];

  /**
   * Get aggregated address pool summary across protocols
   * GET /address-pool/summary
   * Required permission: address-pool:read
   */
  addressPool.get(
    '/summary',
    authMiddleware(),
    requirePermissionMiddleware('address-pool:read'),
    async c => {
      try {
        const manager = getManagerInstance();

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const summary = await manager.getAddressPoolSummaryForRuntimeScope(
          runtimeContext,
          SUPPORTED_PROTOCOLS
        );

        return c.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        console.error('Failed to get address pool summary:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to get address pool summary',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  /**
   * List addresses from address pool
   * GET /address-pool/addresses
   * Query params: protocol (optional), page (default: 1), pageSize (default: 20)
   * Required permission: address-pool:read
   */
  addressPool.get(
    '/addresses',
    authMiddleware(),
    requirePermissionMiddleware('address-pool:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const protocol = c.req.query('protocol') as 'evm' | 'tron' | 'solana' | undefined;
        const page = parseInt(c.req.query('page') || '1');
        const pageSize = parseInt(c.req.query('pageSize') || '20');

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const result = await manager.listAddressesForRuntimeScope(runtimeContext, {
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
        return c.json(
          {
            success: false,
            error: 'Failed to list addresses',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  /**
   * Add addresses to address pool
   * POST /address-pool/addresses
   * Body: { addresses: [{ address, protocol, masterPublicKey?, derivationIndex }] }
   * Required permission: address-pool:write
   */
  addressPool.post(
    '/addresses',
    authMiddleware(),
    requirePermissionMiddleware('address-pool:write'),
    auditMiddleware('address-pool', 'add-addresses'),
    async c => {
      try {
        const manager = getManagerInstance();
        const body = await c.req.json();

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        // Validate request body
        if (!body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Request body must include non-empty "addresses" array',
            },
            400
          );
        }

        // Validate each address entry before passing runtime scope to the manager seam.
        const addresses = [];
        for (const addr of body.addresses) {
          if (!addr.address || !addr.protocol || addr.derivationIndex === undefined) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: 'Each address entry must include: address, protocol, derivationIndex',
              },
              400
            );
          }

          if (!['evm', 'tron', 'solana'].includes(addr.protocol)) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: 'Protocol must be either "evm", "tron", or "solana"',
              },
              400
            );
          }

          addresses.push(addr);
        }

        await manager.addAddressesToPoolForRuntimeScope(runtimeContext, addresses);

        return c.json(
          {
            success: true,
            message: `Successfully added ${body.addresses.length} addresses to pool`,
          },
          201
        );
      } catch (error) {
        console.error('Failed to add addresses to pool:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to add addresses to pool',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  /**
   * Archive an address (soft delete)
   * PATCH /address-pool/addresses/:address/archive
   * Required permission: address-pool:write
   */
  addressPool.patch(
    '/addresses/:address/archive',
    authMiddleware(),
    requirePermissionMiddleware('address-pool:write'),
    auditMiddleware('address-pool', 'archive-address'),
    async c => {
      try {
        const manager = getManagerInstance();
        const address = c.req.param('address')!;

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        await manager.archiveAddressForRuntimeScope(runtimeContext, address);

        return c.json({
          success: true,
          message: `Address ${address} has been archived`,
        });
      } catch (error) {
        console.error('Failed to archive address:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to archive address',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
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
    requirePermissionMiddleware('address-pool:write'),
    auditMiddleware('address-pool', 'unarchive-address'),
    async c => {
      try {
        const manager = getManagerInstance();
        const address = c.req.param('address')!;

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        await manager.unarchiveAddressForRuntimeScope(runtimeContext, address);

        return c.json({
          success: true,
          message: `Address ${address} has been restored`,
        });
      } catch (error) {
        console.error('Failed to unarchive address:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to unarchive address',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  return addressPool;
}

export default createAddressPoolRoutes();
