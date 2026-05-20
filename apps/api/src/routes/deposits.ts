/**
 * Deposits Management Routes
 * Provides deposit address binding and management operations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';
import { buildDepositPageUrl, getBaseUrl } from '../utils/url-builder.js';
import {
  organizationContextRequiredMessage,
  resolveRuntimeContext as defaultResolveRuntimeContext,
} from '../open-runtime.js';

const ALLOWED_PROTOCOLS = ['evm', 'tron'] as const;
const MAX_PAGE_SIZE = 100;

export interface DepositsRouteDependencies {
  getManager?: typeof getManager;
  getAuth?: typeof getAuth;
  createAuthMiddleware?: typeof createAuthMiddleware;
  createAuditMiddleware?: typeof createAuditMiddleware;
  requirePermission?: typeof requirePermission;
  resolveRuntimeContext?: typeof defaultResolveRuntimeContext;
  organizationContextRequiredMessage?: typeof organizationContextRequiredMessage;
  getBaseUrl?: typeof getBaseUrl;
  buildDepositPageUrl?: typeof buildDepositPageUrl;
}

export function createDepositsRoutes(deps: DepositsRouteDependencies = {}) {
  const deposits = new Hono();
  const getManagerInstance = deps.getManager ?? getManager;
  const getAuthManager = deps.getAuth ?? getAuth;
  const authMiddlewareFactory = deps.createAuthMiddleware ?? createAuthMiddleware;
  const auditMiddlewareFactory = deps.createAuditMiddleware ?? createAuditMiddleware;
  const requirePermissionMiddleware = deps.requirePermission ?? requirePermission;
  const resolveRuntimeContext = deps.resolveRuntimeContext ?? defaultResolveRuntimeContext;
  const getOrganizationContextRequiredMessage =
    deps.organizationContextRequiredMessage ?? organizationContextRequiredMessage;
  const getBaseUrlHelper = deps.getBaseUrl ?? getBaseUrl;
  const buildDepositPageUrlHelper = deps.buildDepositPageUrl ?? buildDepositPageUrl;

  // Lazy middleware factories - only get Auth instance when request comes in
  const authMiddleware = () => {
    return async (c: Context, next: Next) => {
      const middleware = authMiddlewareFactory(getAuthManager());
      return await middleware(c, next);
    };
  };

  const organizationContextRequiredResponse = (c: Context) =>
    c.json(
      {
        success: false,
        error: 'Authorization failed',
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: getOrganizationContextRequiredMessage(),
        suggestions: [
          'In PayIn Open, verify the default merchant bootstrap completed successfully',
          'In hosted Cloud mode, include the X-Organization-Id header or use an organization-scoped API key',
        ],
      },
      401
    );

  const auditMiddleware = (resource: string, action: string) => {
    return async (c: Context, next: Next) => {
      const middleware = auditMiddlewareFactory(getAuthManager(), { resource, action });
      return await middleware(c, next);
    };
  };

  /**
   * Bind deposit address for user
   * POST /deposits/bind
   * Body: { depositReference, protocol, metadata? }
   * Required permission: deposits:write
   */
  deposits.post(
    '/bind',
    authMiddleware(),
    requirePermissionMiddleware('deposits:write'),
    auditMiddleware('deposits', 'bind'),
    async c => {
      try {
        const manager = getManagerInstance();
        const body = await c.req.json();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        // Validate required fields
        if (!body.depositReference || !body.protocol) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_VALIDATION_FAILED',
              message: 'Required fields: depositReference, protocol',
              suggestions: [
                'Provide a unique depositReference string for the end user',
                'Use protocol values "evm" or "tron"',
                'Review docs://payin/examples/mcp-persona-scenarios#deposit-binding-checklist before retrying',
              ],
            },
            400
          );
        }

        // Validate protocol
        if (!ALLOWED_PROTOCOLS.includes(body.protocol)) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
              message: 'Protocol must be either "evm" or "tron"',
              suggestions: [
                'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                'Solana deposits are currently unavailable; monitor release notes for updates',
              ],
            },
            400
          );
        }

        const result = await manager.bindDepositAddressForRuntimeScope(runtimeContext, {
          depositReference: body.depositReference,
          protocol: body.protocol,
          metadata: body.metadata,
        });

        // Add deposit page URL
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url: buildDepositPageUrlHelper(baseUrl, body.depositReference, body.protocol),
        };

        return c.json(
          {
            success: true,
            data: enrichedResult,
            message: 'Deposit address bound successfully',
          },
          201
        );
      } catch (error) {
        console.error('Failed to bind deposit address:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to bind deposit address',
            code: 'DEPOSIT_BIND_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Ensure the address pool for the requested protocol has available capacity',
              'If the issue persists, contact PayIn support with timestamp and organization ID',
            ],
          },
          500
        );
      }
    }
  );

  /**
   * Unbind deposit address
   * POST /deposits/unbind
   * Body: { depositReference } OR { address, protocol }
   * Required permission: deposits:write
   */
  deposits.post(
    '/unbind',
    authMiddleware(),
    requirePermissionMiddleware('deposits:write'),
    auditMiddleware('deposits', 'unbind'),
    async c => {
      try {
        const manager = getManagerInstance();
        const body = await c.req.json();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        // Support two unbinding methods:
        // 1. By depositReference (unbinds all addresses for that reference)
        // 2. By address + protocol (unbinds specific address)

        if (body.depositReference) {
          // Method 1: Unbind by depositReference
          if (body.protocol && !ALLOWED_PROTOCOLS.includes(body.protocol)) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
                message: 'Protocol must be either "evm" or "tron"',
                suggestions: [
                  'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                  'Omit protocol to unbind all supported protocol bindings for the depositReference',
                ],
              },
              400
            );
          }

          await manager.unbindDepositAddressForRuntimeScope(runtimeContext, {
            depositReference: body.depositReference,
            protocol: body.protocol,
          });

          return c.json({
            success: true,
            message: 'Deposit address(es) unbound successfully',
          });
        } else if (body.address && body.protocol) {
          // Method 2: Unbind by address + protocol

          // Validate protocol
          if (!ALLOWED_PROTOCOLS.includes(body.protocol)) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
                message: 'Protocol must be either "evm" or "tron"',
                suggestions: [
                  'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                  'Solana deposits are currently unavailable; monitor release notes for updates',
                ],
              },
              400
            );
          }

          await manager.unbindDepositAddressByAddressForRuntimeScope(runtimeContext, {
            address: body.address,
            protocol: body.protocol,
          });

          return c.json({
            success: true,
            message: 'Deposit address unbound successfully',
          });
        } else {
          // Neither method provided
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_UNBIND_INVALID_PAYLOAD',
              message: 'Required fields: depositReference OR (address + protocol)',
              suggestions: [
                'Provide depositReference to remove all bindings for a user',
                'Or provide address and protocol to remove a single binding',
                'Review docs://payin/examples/mcp-persona-scenarios#deposit-unbind-decision-tree for guidance',
              ],
            },
            400
          );
        }
      } catch (error) {
        console.error('Failed to unbind deposit address:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to unbind deposit address',
            code: 'DEPOSIT_UNBIND_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Retry the request with confirmed parameters',
              'If the address remains bound, contact PayIn support with the depositReference',
            ],
          },
          500
        );
      }
    }
  );

  /**
   * List deposit references with statistics
   * GET /deposits/references
   * Query params: page, limit, search
   * Required permission: deposits:read
   */
  deposits.get(
    '/references',
    authMiddleware(),
    requirePermissionMiddleware('deposits:read'),
    async c => {
      try {
        const manager = getManagerInstance();

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const filters: any = {};

        const page = c.req.query('page');
        if (page) {
          const parsedPage = Number(page);
          if (!Number.isInteger(parsedPage) || parsedPage < 1) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_FILTER_INVALID_PAGE',
                message: 'page must be a positive integer',
                suggestions: [
                  'Use page=1 to request the first page',
                  'Avoid decimals or non-numeric characters in the page parameter',
                ],
              },
              400
            );
          }
          filters.page = parsedPage;
        }

        const limit = c.req.query('limit');
        if (limit) {
          const parsedLimit = Number(limit);
          if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_FILTER_INVALID_LIMIT',
                message: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}`,
                suggestions: [
                  `The recommended default is limit=20`,
                  'For bulk exports contact PayIn support or use the analytics pipeline',
                ],
              },
              400
            );
          }
          filters.limit = parsedLimit;
        }

        const search = c.req.query('search');
        if (search) filters.search = search;

        const result = await manager.listDepositReferencesForRuntimeScope(runtimeContext, filters);

        return c.json({
          success: true,
          data: result.references,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        });
      } catch (error) {
        console.error('Failed to list deposit references:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to list deposit references',
            code: 'DEPOSIT_REFERENCES_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Retry with a narrower date or search window',
              'If the error repeats, provide the timestamp to PayIn support',
            ],
          },
          500
        );
      }
    }
  );

  /**
   * Get deposit statistics
   * GET /deposits/stats
   * Query params: protocol, detectedAfter, detectedBefore
   * Required permission: deposits:read
   */
  deposits.get(
    '/stats',
    authMiddleware(),
    requirePermissionMiddleware('deposits:read'),
    async c => {
      try {
        const manager = getManagerInstance();

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const protocolParam = c.req.query('protocol');
        let protocol: 'evm' | 'tron' | undefined;
        if (protocolParam) {
          const normalized = protocolParam.toString().toLowerCase();
          if (!ALLOWED_PROTOCOLS.includes(normalized as (typeof ALLOWED_PROTOCOLS)[number])) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
                message: 'Protocol must be either "evm" or "tron"',
                suggestions: [
                  'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                  'Solana deposits are currently unavailable; monitor release notes for updates',
                ],
              },
              400
            );
          }
          protocol = normalized as 'evm' | 'tron';
        }

        const detectedAfter = c.req.query('detectedAfter');
        const detectedBefore = c.req.query('detectedBefore');

        if (detectedAfter) {
          const parsed = new Date(detectedAfter);
          if (Number.isNaN(parsed.getTime())) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_STATS_INVALID_DATE',
                message: 'detectedAfter must be a valid ISO 8601 date string',
                suggestions: [
                  'Use a UTC timestamp such as 2025-01-15T08:00:00Z',
                  'Avoid locale-specific formats like 01/15/2025',
                ],
              },
              400
            );
          }
        }

        if (detectedBefore) {
          const parsed = new Date(detectedBefore);
          if (Number.isNaN(parsed.getTime())) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                code: 'DEPOSIT_STATS_INVALID_DATE',
                message: 'detectedBefore must be a valid ISO 8601 date string',
                suggestions: [
                  'Use a UTC timestamp such as 2025-01-15T18:00:00Z',
                  'Avoid locale-specific formats like 01/15/2025',
                ],
              },
              400
            );
          }
        }

        // Get all deposit addresses for the organization
        const addressesResult = await manager.listDepositAddressesForRuntimeScope(runtimeContext, {
          protocol,
          limit: 10000,
        });

        const addresses = addressesResult.addresses;
        const boundAddressCount = addresses.length;

        // Get unique deposit references
        const uniqueReferences = new Set(
          addresses.map((addr: any) => addr.deposit_reference).filter(Boolean)
        );
        const activeReferences = uniqueReferences.size;

        // For deposit transaction stats, we need to query transfers
        // This is a placeholder - you'll need to implement getDepositTransfers in manager
        // or use listTransfers from api
        let totalDeposits = 0;
        let totalVolume: Record<string, number> = {};

        // This endpoint currently returns address-derived statistics only. Deposit
        // transfer counting/volume can be added behind a runtime-scope manager seam
        // when the processor exposes aggregate transfer statistics.

        return c.json({
          success: true,
          data: {
            boundAddressCount,
            activeReferences,
            totalDeposits,
            totalVolume,
          },
        });
      } catch (error) {
        console.error('Failed to get deposit statistics:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to get deposit statistics',
            code: 'DEPOSIT_STATS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Retry the request after a short delay',
              'If statistics consistently fail, provide timestamps and filters to PayIn support',
            ],
          },
          500
        );
      }
    }
  );

  /**
   * Get user deposit address
   * GET /deposits/:depositReference
   * Query params: protocol (default: evm)
   * Required permission: deposits:read
   */
  deposits.get(
    '/:depositReference',
    authMiddleware(),
    requirePermissionMiddleware('deposits:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const depositReference = c.req.param('depositReference')!;
        const protocolParam = (c.req.query('protocol') || 'evm').toString().toLowerCase();

        if (!ALLOWED_PROTOCOLS.includes(protocolParam as (typeof ALLOWED_PROTOCOLS)[number])) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
              message: 'Protocol must be either "evm" or "tron"',
              suggestions: [
                'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                'Solana deposits are currently unavailable; monitor release notes for updates',
              ],
            },
            400
          );
        }

        const protocol = protocolParam as 'evm' | 'tron';

        const runtimeContext = resolveRuntimeContext(c);
        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const address = await manager.getUserDepositAddressForRuntimeScope(
          runtimeContext,
          depositReference,
          protocol
        );

        if (!address) {
          return c.json(
            {
              success: false,
              error: 'Deposit address not found',
              code: 'DEPOSIT_ADDRESS_NOT_FOUND',
              message: `No deposit address found for "${depositReference}" with protocol "${protocol}"`,
              suggestions: [
                'Confirm the depositReference is spelled correctly',
                'Verify that the protocol matches the original binding',
                'List bindings first with GET /api/v1/deposits?depositReference=...',
              ],
            },
            404
          );
        }

        // Add deposit page URL
        const baseUrl = getBaseUrlHelper();
        const enrichedAddress = {
          ...address,
          url: buildDepositPageUrlHelper(baseUrl, depositReference, protocol),
        };

        return c.json({
          success: true,
          data: enrichedAddress,
        });
      } catch (error) {
        console.error(
          `Failed to get deposit address for ${c.req.param('depositReference')!}:`,
          error
        );
        return c.json(
          {
            success: false,
            error: 'Failed to get deposit address',
            code: 'DEPOSIT_GET_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Retry the request after a short delay',
              'If the error persists, contact PayIn support with the depositReference and protocol',
            ],
          },
          500
        );
      }
    }
  );

  /**
   * List deposit addresses with filtering
   * GET /deposits
   * Query params: protocol, depositReference, page, limit
   * Required permission: deposits:read
   */
  deposits.get('/', authMiddleware(), requirePermissionMiddleware('deposits:read'), async c => {
    try {
      const manager = getManagerInstance();

      const runtimeContext = resolveRuntimeContext(c);
      if (!runtimeContext) {
        return organizationContextRequiredResponse(c);
      }

      const filters: any = {};

      const protocol = c.req.query('protocol');
      if (protocol) {
        const normalized = protocol.toString().toLowerCase();
        if (!ALLOWED_PROTOCOLS.includes(normalized as (typeof ALLOWED_PROTOCOLS)[number])) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_PROTOCOL_UNSUPPORTED',
              message: 'Protocol must be either "evm" or "tron"',
              suggestions: [
                'Use "evm" for Ethereum-compatible chains or "tron" for Tron-compatible chains',
                'Solana deposits are currently unavailable; monitor release notes for updates',
              ],
            },
            400
          );
        }
        filters.protocol = normalized as 'evm' | 'tron';
      }

      const depositReference = c.req.query('depositReference');
      if (depositReference) filters.depositReference = depositReference;

      const page = c.req.query('page');
      if (page) {
        const parsedPage = Number(page);
        if (!Number.isInteger(parsedPage) || parsedPage < 1) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_FILTER_INVALID_PAGE',
              message: 'page must be a positive integer',
              suggestions: [
                'Use page=1 to request the first page',
                'Avoid decimals or non-numeric characters in the page parameter',
              ],
            },
            400
          );
        }
        filters.page = parsedPage;
      }

      const limit = c.req.query('limit');
      if (limit) {
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              code: 'DEPOSIT_FILTER_INVALID_LIMIT',
              message: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}`,
              suggestions: [
                `The recommended default is limit=20`,
                'For bulk exports contact PayIn support or use the analytics pipeline',
              ],
            },
            400
          );
        }
        filters.limit = parsedLimit;
      }

      const result = await manager.listDepositAddressesForRuntimeScope(runtimeContext, filters);

      // Add deposit page URLs
      const baseUrl = getBaseUrlHelper();
      const enrichedAddresses = result.addresses.map((addr: any) => ({
        ...addr,
        url: buildDepositPageUrlHelper(baseUrl, addr.deposit_reference, addr.protocol),
      }));

      return c.json({
        success: true,
        data: enrichedAddresses,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      console.error('Failed to list deposit addresses:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to list deposit addresses',
          code: 'DEPOSIT_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          suggestions: [
            'Retry the request with validated filters',
            'If the error persists, share the timestamp and filters with PayIn support',
          ],
        },
        500
      );
    }
  });

  return deposits;
}

export default createDepositsRoutes();
