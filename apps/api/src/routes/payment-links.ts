/**
 * Payment Links Management Routes
 * Provides CRUD and lifecycle operations for Payment Links
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { PaymentLinkStatus } from '@payin/manager';
import { getAuth } from '../auth-instance.js';
import { getManager } from '../manager-instance.js';
import { createAuthMiddleware, createAuditMiddleware, requirePermission } from '@payin/auth';
import { buildPaymentLinkCheckoutUrl, getBaseUrl } from '../utils/url-builder.js';
import {
  allowAllPaymentLinkPolicy,
  noOpPaymentLinkEventSink,
  type PaymentLinkCreatePolicyRequest,
  type PaymentLinkEventSink,
  type PaymentLinkPolicy,
  type PaymentLinkPublishPolicyRequest,
  type PaymentLinkUpdatePolicyRequest,
} from '../payment-link-seam.js';
import {
  organizationContextRequiredMessage,
  organizationContextRequiredPayload,
  resolveRuntimeContext as defaultResolveRuntimeContext,
} from '../open-runtime.js';

const PAYMENT_LINK_STATUSES: readonly PaymentLinkStatus[] = ['draft', 'published'];

const isPaymentLinkStatus = (value: string): value is PaymentLinkStatus =>
  (PAYMENT_LINK_STATUSES as readonly string[]).includes(value);

interface CurrencyConfig {
  currency: string;
  chainOptions: string[];
  amount?: string | number;
  is_primary?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface CreatePaymentLinkRequest {
  title: string;
  description?: string | null;
  amount: string | number;
  currencies: CurrencyConfig[];
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

interface UpdatePaymentLinkRequest {
  title?: string;
  description?: string | null;
  amount?: string | number;
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

interface UpdatePaymentLinkCurrenciesRequest {
  currencies: CurrencyConfig[];
}

interface PublishPaymentLinkRequest {
  slug?: string;
}

export interface PaymentLinksRouteDependencies {
  getManager?: typeof getManager;
  getAuth?: typeof getAuth;
  createAuthMiddleware?: typeof createAuthMiddleware;
  createAuditMiddleware?: typeof createAuditMiddleware;
  requirePermission?: typeof requirePermission;
  resolveRuntimeContext?: typeof defaultResolveRuntimeContext;
  organizationContextRequiredMessage?: typeof organizationContextRequiredMessage;
  getBaseUrl?: typeof getBaseUrl;
  buildPaymentLinkCheckoutUrl?: typeof buildPaymentLinkCheckoutUrl;
  paymentLinkPolicy?: PaymentLinkPolicy;
  paymentLinkEventSink?: PaymentLinkEventSink;
}

export function createPaymentLinksRoutes(deps: PaymentLinksRouteDependencies = {}) {
  const paymentLinks = new Hono();
  const getManagerInstance = deps.getManager ?? getManager;
  const getAuthManager = deps.getAuth ?? getAuth;
  const authMiddlewareFactory = deps.createAuthMiddleware ?? createAuthMiddleware;
  const auditMiddlewareFactory = deps.createAuditMiddleware ?? createAuditMiddleware;
  const requirePermissionMiddleware = deps.requirePermission ?? requirePermission;
  const resolveRuntimeContext = deps.resolveRuntimeContext ?? defaultResolveRuntimeContext;
  const getOrganizationContextRequiredMessage =
    deps.organizationContextRequiredMessage ?? organizationContextRequiredMessage;
  const getBaseUrlHelper = deps.getBaseUrl ?? getBaseUrl;
  const buildPaymentLinkCheckoutUrlHelper =
    deps.buildPaymentLinkCheckoutUrl ?? buildPaymentLinkCheckoutUrl;
  const paymentLinkPolicy = deps.paymentLinkPolicy ?? allowAllPaymentLinkPolicy;
  const paymentLinkEventSink = deps.paymentLinkEventSink ?? noOpPaymentLinkEventSink;

  const authMiddleware = () => {
    return async (c: Context, next: Next) => {
      const middleware = authMiddlewareFactory(getAuthManager());
      return await middleware(c, next);
    };
  };

  const auditMiddleware = (action: string) => {
    return async (c: Context, next: Next) => {
      const middleware = auditMiddlewareFactory(getAuthManager(), {
        resource: 'payment_links',
        action,
      });
      return await middleware(c, next);
    };
  };

  const organizationContextRequiredResponse = (c: Context) =>
    c.json(
      {
        ...organizationContextRequiredPayload(),
        message: getOrganizationContextRequiredMessage(),
      },
      401
    );

  const policyDeniedResponse = (
    c: Context,
    decision: Awaited<ReturnType<PaymentLinkPolicy['check']>>
  ) =>
    c.json(
      {
        success: false,
        error: 'Payment link operation not allowed',
        code: decision.code ?? 'PAYMENT_LINK_OPERATION_NOT_ALLOWED',
        message: decision.message ?? 'Payment link operation is not allowed for this request.',
        suggestions: ['Review the request context and try again if it is valid'],
      },
      decision.status ?? 403
    );

  paymentLinks.post(
    '/',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('create'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);
        const userId = c.get('userId') ?? null;

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const body = await c.req.json<CreatePaymentLinkRequest>();
        const { title, amount, currencies } = body;

        // Validate title
        if (typeof title !== 'string' || title.trim() === '') {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Title is required',
            },
            400
          );
        }

        // Validate amount
        if (
          (typeof amount !== 'string' && typeof amount !== 'number') ||
          Number.isNaN(Number(amount))
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Amount must be a numeric string or number',
            },
            400
          );
        }

        // Validate currencies array
        if (!Array.isArray(currencies) || currencies.length === 0) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'At least one currency must be specified',
            },
            400
          );
        }

        // Validate each currency configuration
        for (const curr of currencies) {
          if (typeof curr.currency !== 'string' || curr.currency.trim() === '') {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: 'Each currency must have a valid currency code',
              },
              400
            );
          }

          if (
            !Array.isArray(curr.chainOptions) ||
            curr.chainOptions.length === 0 ||
            !curr.chainOptions.every(opt => typeof opt === 'string' && opt.trim() !== '')
          ) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: `Currency ${curr.currency} must have at least one chain option`,
              },
              400
            );
          }

          if (
            curr.amount !== undefined &&
            curr.amount !== null &&
            ((typeof curr.amount !== 'string' && typeof curr.amount !== 'number') ||
              Number.isNaN(Number(curr.amount)))
          ) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: `Currency ${curr.currency} amount must be numeric when provided`,
              },
              400
            );
          }
        }

        if (
          body.description !== undefined &&
          body.description !== null &&
          typeof body.description !== 'string'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Description must be a string or null',
            },
            400
          );
        }

        if (
          body.metadata !== undefined &&
          body.metadata !== null &&
          typeof body.metadata !== 'object'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Metadata must be an object when provided',
            },
            400
          );
        }

        if (
          body.inventoryTotal !== undefined &&
          body.inventoryTotal !== null &&
          typeof body.inventoryTotal !== 'number'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Inventory total must be a number or null',
            },
            400
          );
        }

        if (
          body.expiresAt !== undefined &&
          body.expiresAt !== null &&
          typeof body.expiresAt !== 'string'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'expiresAt must be an ISO timestamp string',
            },
            400
          );
        }

        const normalizedAmount = typeof amount === 'number' ? amount.toString() : amount;
        const normalizedInventory = body.inventoryTotal ?? null;
        const normalizedExpiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        if (normalizedExpiresAt && Number.isNaN(normalizedExpiresAt.getTime())) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'expiresAt must be a valid ISO timestamp',
            },
            400
          );
        }

        const normalizedCurrencies = currencies.map(curr => ({
          currency: curr.currency.trim(),
          chain_options: curr.chainOptions.map(opt => opt.trim()),
          amount: curr.amount
            ? typeof curr.amount === 'number'
              ? curr.amount.toString()
              : curr.amount
            : undefined,
          is_primary: curr.is_primary,
          metadata: curr.metadata,
        })) as any[];

        const createPolicyRequest: PaymentLinkCreatePolicyRequest = {
          title: title.trim(),
          description: body.description ?? null,
          amount: normalizedAmount,
          currencies: body.currencies,
          inventoryTotal: normalizedInventory,
          expiresAt: body.expiresAt ?? null,
          metadata: body.metadata ?? null,
          amountType: body.amountType ?? 'fixed',
          ctaText: body.ctaText ?? null,
          theme: body.theme ?? 'dark',
        };

        const policyDecision = await paymentLinkPolicy.check({
          runtimeContext,
          operation: 'create',
          request: createPolicyRequest,
        });

        if (!policyDecision.allowed) {
          return policyDeniedResponse(c, policyDecision);
        }

        const result = await manager.createPaymentLinkForRuntimeScope(runtimeContext, {
          title: title.trim(),
          description: body.description ?? null,
          amount: normalizedAmount,
          currencies: normalizedCurrencies,
          inventoryTotal: normalizedInventory,
          expiresAt: normalizedExpiresAt,
          metadata: body.metadata ?? null,
          createdBy: userId,
          amount_type: body.amountType ?? 'fixed',
          cta_text: body.ctaText ?? null,
          theme: body.theme ?? 'dark',
        } as any);

        try {
          await paymentLinkEventSink.record({
            name: 'payment_link.created',
            occurredAt: new Date().toISOString(),
            paymentScope: runtimeContext.paymentScope,
            actor: runtimeContext.actor,
            requestId: runtimeContext.requestId,
            source: runtimeContext.source,
            operation: 'create',
            paymentLink: {
              id: result.id,
              status: result.status,
              slug: result.slug,
            },
          });
        } catch (eventError) {
          console.warn('Failed to record payment-link-created event:', eventError);
        }

        // Add URL if payment link is published and has a slug
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url:
            result.status === 'published' && result.slug
              ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug)
              : null,
        };

        return c.json(
          {
            success: true,
            data: enrichedResult,
          },
          201
        );
      } catch (error) {
        console.error('Failed to create payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to create payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.put(
    '/:id',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('update'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);
        const userId = c.get('userId') ?? null;

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const body = await c.req.json<UpdatePaymentLinkRequest>();
        const paymentLinkId = c.req.param('id')!;

        if (
          body.metadata !== undefined &&
          body.metadata !== null &&
          typeof body.metadata !== 'object'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Metadata must be an object when provided',
            },
            400
          );
        }

        // Note: chainOptions/currency updates are now handled via PUT /:id/currencies endpoint

        if (
          body.inventoryTotal !== undefined &&
          body.inventoryTotal !== null &&
          typeof body.inventoryTotal !== 'number'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Inventory total must be a number or null',
            },
            400
          );
        }

        if (
          body.expiresAt !== undefined &&
          body.expiresAt !== null &&
          typeof body.expiresAt !== 'string'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'expiresAt must be an ISO timestamp string',
            },
            400
          );
        }

        const normalizedAmount =
          body.amount === undefined
            ? undefined
            : typeof body.amount === 'number'
              ? body.amount.toString()
              : body.amount;

        let normalizedExpiresAt: Date | null | undefined = undefined;
        if (body.expiresAt !== undefined) {
          if (body.expiresAt === null) {
            normalizedExpiresAt = null;
          } else {
            const parsedDate = new Date(body.expiresAt);
            if (Number.isNaN(parsedDate.getTime())) {
              return c.json(
                {
                  success: false,
                  error: 'Validation failed',
                  message: 'expiresAt must be a valid ISO timestamp',
                },
                400
              );
            }
            normalizedExpiresAt = parsedDate;
          }
        }

        if (
          body.title !== undefined &&
          (typeof body.title !== 'string' || body.title.trim() === '')
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Title must be a non-empty string',
            },
            400
          );
        }

        if (
          body.description !== undefined &&
          body.description !== null &&
          typeof body.description !== 'string'
        ) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Description must be a string or null',
            },
            400
          );
        }

        const updatePolicyRequest: PaymentLinkUpdatePolicyRequest = {
          title: typeof body.title === 'string' ? body.title.trim() : body.title,
          description: body.description === undefined ? undefined : body.description,
          amount: normalizedAmount,
          inventoryTotal: body.inventoryTotal,
          expiresAt: body.expiresAt,
          metadata: body.metadata === undefined ? undefined : body.metadata,
          amountType: body.amountType,
          ctaText: body.ctaText,
          theme: body.theme,
        };

        const policyDecision = await paymentLinkPolicy.check({
          runtimeContext,
          operation: 'update',
          paymentLinkId,
          request: updatePolicyRequest,
        });

        if (!policyDecision.allowed) {
          return policyDeniedResponse(c, policyDecision);
        }

        const result = await manager.updatePaymentLinkForRuntimeScope(
          paymentLinkId,
          runtimeContext,
          {
            title: typeof body.title === 'string' ? body.title.trim() : body.title,
            description: body.description === undefined ? undefined : body.description,
            amount: normalizedAmount,
            inventoryTotal: body.inventoryTotal,
            expiresAt: normalizedExpiresAt,
            metadata: body.metadata === undefined ? undefined : body.metadata,
            updatedBy: userId,
            amountType: body.amountType,
            ctaText: body.ctaText,
            theme: body.theme,
          }
        );

        try {
          await paymentLinkEventSink.record({
            name: 'payment_link.updated',
            occurredAt: new Date().toISOString(),
            paymentScope: runtimeContext.paymentScope,
            actor: runtimeContext.actor,
            requestId: runtimeContext.requestId,
            source: runtimeContext.source,
            operation: 'update',
            paymentLink: {
              id: result.id,
              status: result.status,
              slug: result.slug,
            },
          });
        } catch (eventError) {
          console.warn('Failed to record payment-link-updated event:', eventError);
        }

        // Add URL if payment link is published and has a slug
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url:
            result.status === 'published' && result.slug
              ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug)
              : null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to update payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to update payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  /**
   * Update payment link currencies configuration
   */
  paymentLinks.put(
    '/:id/currencies',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('update_currencies'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const body = await c.req.json<UpdatePaymentLinkCurrenciesRequest>();

        // Validate currencies array
        if (!Array.isArray(body.currencies) || body.currencies.length === 0) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'At least one currency must be specified',
            },
            400
          );
        }

        // Validate each currency configuration
        for (const curr of body.currencies) {
          if (typeof curr.currency !== 'string' || curr.currency.trim() === '') {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: 'Each currency must have a valid currency code',
              },
              400
            );
          }

          if (
            !Array.isArray(curr.chainOptions) ||
            curr.chainOptions.length === 0 ||
            !curr.chainOptions.every(opt => typeof opt === 'string' && opt.trim() !== '')
          ) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: `Currency ${curr.currency} must have at least one chain option`,
              },
              400
            );
          }

          if (
            curr.amount !== undefined &&
            curr.amount !== null &&
            ((typeof curr.amount !== 'string' && typeof curr.amount !== 'number') ||
              Number.isNaN(Number(curr.amount)))
          ) {
            return c.json(
              {
                success: false,
                error: 'Validation failed',
                message: `Currency ${curr.currency} amount must be numeric when provided`,
              },
              400
            );
          }
        }

        const normalizedCurrencies = body.currencies.map(curr => ({
          currency: curr.currency.trim(),
          chain_options: curr.chainOptions.map(opt => opt.trim()),
          amount: curr.amount
            ? typeof curr.amount === 'number'
              ? curr.amount.toString()
              : curr.amount
            : undefined,
          is_primary: curr.is_primary,
          metadata: curr.metadata,
        })) as any[];

        const result = await manager.updatePaymentLinkCurrenciesForRuntimeScope(
          paymentLinkId,
          runtimeContext,
          {
            currencies: normalizedCurrencies,
          }
        );

        // Add URL if payment link is published and has a slug
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url:
            result.status === 'published' && result.slug
              ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug)
              : null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to update payment link currencies:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to update payment link currencies',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.post(
    '/:id/preview-url',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    async c => {
      try {
        const manager = getManagerInstance();
        const authManager = getAuthManager();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const link = await manager.getPaymentLinkForRuntimeScope(paymentLinkId, runtimeContext);

        if (!link) {
          return c.json(
            {
              success: false,
              error: 'Not Found',
              message: 'Payment Link not found',
            },
            404
          );
        }

        const previewToken = authManager.createPreviewToken(
          {
            linkId: paymentLinkId,
            organizationId: manager.getPaymentLinkOrganizationIdForRuntimeScope(runtimeContext),
          },
          '10m'
        );

        const forwardedProto = c.req.header('x-forwarded-proto');
        const requestUrl = new URL(c.req.url);
        const protocol = forwardedProto ?? requestUrl.protocol.replace(/:$/, '');
        const hostHeader =
          c.req.header('x-forwarded-host') ??
          c.req.header('host') ??
          requestUrl.host ??
          'localhost:3000';
        const requestOrigin = `${protocol}://${hostHeader}`.replace(/\/$/, '');

        const url = `${requestOrigin}/checkout/preview/${paymentLinkId}?token=${encodeURIComponent(previewToken)}`;

        return c.json({
          success: true,
          data: {
            url,
            expiresIn: '10m',
          },
        });
      } catch (error) {
        console.error('Failed to generate preview URL:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to generate preview URL',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.post(
    '/:id/publish',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('publish'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        let body: PublishPaymentLinkRequest = {};
        try {
          body = await c.req.json<PublishPaymentLinkRequest>();
        } catch {
          body = {};
        }
        const slug = body.slug;

        if (slug !== undefined && (typeof slug !== 'string' || slug.trim() === '')) {
          return c.json(
            {
              success: false,
              error: 'Validation failed',
              message: 'Slug must be a non-empty string when provided',
            },
            400
          );
        }

        const publishPolicyRequest: PaymentLinkPublishPolicyRequest = { slug: slug?.trim() };

        const policyDecision = await paymentLinkPolicy.check({
          runtimeContext,
          operation: 'publish',
          paymentLinkId,
          request: publishPolicyRequest,
        });

        if (!policyDecision.allowed) {
          return policyDeniedResponse(c, policyDecision);
        }

        const result = await manager.publishPaymentLinkForRuntimeScope(
          paymentLinkId,
          runtimeContext,
          publishPolicyRequest.slug
        );

        try {
          await paymentLinkEventSink.record({
            name: 'payment_link.published',
            occurredAt: new Date().toISOString(),
            paymentScope: runtimeContext.paymentScope,
            actor: runtimeContext.actor,
            requestId: runtimeContext.requestId,
            source: runtimeContext.source,
            operation: 'publish',
            paymentLink: {
              id: result.id,
              status: result.status,
              slug: result.slug,
            },
          });
        } catch (eventError) {
          console.warn('Failed to record payment-link-published event:', eventError);
        }

        // Add URL (published links always have a slug)
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url: result.slug ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug) : null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to publish payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to publish payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.post(
    '/:id/unpublish',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('unpublish'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const result = await manager.unpublishPaymentLinkForRuntimeScope(
          paymentLinkId,
          runtimeContext
        );

        // Unpublished links don't have accessible URLs
        const enrichedResult = {
          ...result,
          url: null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to unpublish payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to unpublish payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.post(
    '/:id/archive',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('archive'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const result = await manager.archivePaymentLinkForRuntimeScope(
          paymentLinkId,
          runtimeContext
        );

        // Archived links don't have accessible URLs
        const enrichedResult = {
          ...result,
          url: null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to archive payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to archive payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.post(
    '/:id/restore',
    authMiddleware(),
    requirePermissionMiddleware('orders:write'),
    auditMiddleware('restore'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const result = await manager.restorePaymentLinkForRuntimeScope(
          paymentLinkId,
          runtimeContext
        );

        // Add URL if restored link is published and has a slug
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url:
            result.status === 'published' && result.slug
              ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug)
              : null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to restore payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to restore payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.get('/', authMiddleware(), requirePermissionMiddleware('orders:read'), async c => {
    try {
      const manager = getManagerInstance();
      const runtimeContext = resolveRuntimeContext(c);

      if (!runtimeContext) {
        return organizationContextRequiredResponse(c);
      }

      const statusParam = c.req.query('status');
      let status: PaymentLinkStatus | PaymentLinkStatus[] | undefined;
      if (statusParam) {
        if (statusParam.includes(',')) {
          const parsedStatuses = statusParam
            .split(',')
            .map(s => s.trim())
            .filter((s): s is PaymentLinkStatus => isPaymentLinkStatus(s));
          status = parsedStatuses.length > 0 ? parsedStatuses : undefined;
        } else if (isPaymentLinkStatus(statusParam)) {
          status = statusParam;
        }
      }

      const page = c.req.query('page');
      const limit = c.req.query('limit');
      const search = c.req.query('search');
      const includeArchivedParam = c.req.query('includeArchived');
      const archivedParam = c.req.query('archived');

      const parsedPage = page ? Number.parseInt(page, 10) : undefined;
      const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
      const includeArchived = includeArchivedParam === 'true';
      const archivedOnly = archivedParam === 'true';

      if (
        (parsedPage !== undefined && Number.isNaN(parsedPage)) ||
        (parsedLimit !== undefined && Number.isNaN(parsedLimit))
      ) {
        return c.json(
          {
            success: false,
            error: 'Validation failed',
            message: 'page and limit must be numbers when provided',
          },
          400
        );
      }

      const result = await manager.listPaymentLinksForRuntimeScope(runtimeContext, {
        status,
        search: search ?? undefined,
        page: parsedPage,
        limit: parsedLimit,
        includeArchived,
        archivedOnly,
      });

      // Add URLs to payment links
      const baseUrl = getBaseUrlHelper();
      const enrichedLinks = result.links.map((link: any) => ({
        ...link,
        url:
          link.status === 'published' && link.slug
            ? buildPaymentLinkCheckoutUrlHelper(baseUrl, link.slug)
            : null,
      }));

      return c.json({
        success: true,
        data: enrichedLinks,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.limit > 0 ? Math.ceil(result.total / result.limit) : 0,
        },
      });
    } catch (error) {
      console.error('Failed to list payment links:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to list payment links',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  /**
   * Get payment link statistics
   * GET /payment-links/stats
   * Query params: status, createdAfter, createdBefore
   * Required permission: payment_links:read
   *
   * IMPORTANT: This route MUST be defined before /:id route to avoid path collision
   */
  paymentLinks.get(
    '/stats',
    authMiddleware(),
    requirePermissionMiddleware('orders:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const createdAfter = c.req.query('createdAfter');
        const createdBefore = c.req.query('createdBefore');
        const statusParam = c.req.query('status');

        let status: PaymentLinkStatus | PaymentLinkStatus[] | undefined;
        if (statusParam) {
          if (statusParam.includes(',')) {
            const parsedStatuses = statusParam
              .split(',')
              .map(s => s.trim())
              .filter((s): s is PaymentLinkStatus => isPaymentLinkStatus(s));
            status = parsedStatuses.length > 0 ? parsedStatuses : undefined;
          } else if (isPaymentLinkStatus(statusParam)) {
            status = statusParam;
          }
        }

        // Get all payment links for the runtime payment scope
        const linksResult = await manager.listPaymentLinksForRuntimeScope(runtimeContext, {
          status,
          includeArchived: true,
          limit: 10000,
        });

        // Note: We do NOT filter links by date here!
        // The time range filter should apply to orders, not to payment links themselves.
        // A payment link created 3 months ago can still receive orders today.
        const allLinks = linksResult.links;

        // Get all orders for these payment links
        const orderPromises = allLinks.map(link =>
          manager.listPaymentLinkOrdersForRuntimeScope(link.id, runtimeContext).catch(() => [])
        );
        const allOrdersResults = await Promise.all(orderPromises);
        const allOrders = allOrdersResults.flat();

        // Filter orders by date if specified
        let filteredOrders = allOrders;
        if (createdAfter) {
          const afterDate = new Date(createdAfter);
          filteredOrders = filteredOrders.filter(order => new Date(order.created_at) >= afterDate);
        }
        if (createdBefore) {
          const beforeDate = new Date(createdBefore);
          filteredOrders = filteredOrders.filter(order => new Date(order.created_at) <= beforeDate);
        }

        // For link-level statistics, still filter links by date if needed for link count metrics
        let filteredLinks = allLinks;
        if (createdAfter) {
          const afterDate = new Date(createdAfter);
          filteredLinks = filteredLinks.filter(link => new Date(link.created_at) >= afterDate);
        }
        if (createdBefore) {
          const beforeDate = new Date(createdBefore);
          filteredLinks = filteredLinks.filter(link => new Date(link.created_at) <= beforeDate);
        }

        // Calculate statistics
        const totalLinks = filteredLinks.length;
        const publishedLinks = filteredLinks.filter(
          link => link.status === 'published' && !link.is_archived
        ).length;
        const totalOrders = filteredOrders.length;
        const completedOrders = filteredOrders.filter(order => order.status === 'completed');
        const pendingOrders = filteredOrders.filter(order => order.status === 'pending');

        // Calculate revenue by currency
        const revenue: Record<string, number> = {};
        completedOrders.forEach((order: any) => {
          const currency = order.selected_currency || 'USDC';
          const amount = parseFloat(order.amount || '0');
          revenue[currency] = (revenue[currency] || 0) + amount;
        });

        // Calculate conversion rate
        const conversionRate =
          totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0;

        return c.json({
          success: true,
          data: {
            totalLinks,
            publishedLinks,
            totalOrders,
            completedOrders: completedOrders.length,
            pendingOrders: pendingOrders.length,
            revenue,
            conversionRate,
          },
        });
      } catch (error) {
        console.error('Failed to get payment link statistics:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to get payment link statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.get(
    '/:id',
    authMiddleware(),
    requirePermissionMiddleware('orders:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const result = await manager.getPaymentLinkForRuntimeScope(paymentLinkId, runtimeContext);

        if (!result) {
          return c.json(
            {
              success: false,
              error: 'Not Found',
              message: 'Payment Link not found',
            },
            404
          );
        }

        // Add URL if payment link is published and has a slug
        const baseUrl = getBaseUrlHelper();
        const enrichedResult = {
          ...result,
          url:
            result.status === 'published' && result.slug
              ? buildPaymentLinkCheckoutUrlHelper(baseUrl, result.slug)
              : null,
        };

        return c.json({
          success: true,
          data: enrichedResult,
        });
      } catch (error) {
        console.error('Failed to get payment link:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to get payment link',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  paymentLinks.get(
    '/:id/orders',
    authMiddleware(),
    requirePermissionMiddleware('orders:read'),
    async c => {
      try {
        const manager = getManagerInstance();
        const runtimeContext = resolveRuntimeContext(c);

        if (!runtimeContext) {
          return organizationContextRequiredResponse(c);
        }

        const paymentLinkId = c.req.param('id')!;
        const result = await manager.listPaymentLinkOrdersForRuntimeScope(
          paymentLinkId,
          runtimeContext
        );

        return c.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('Failed to list payment link orders:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to list payment link orders',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }
  );

  return paymentLinks;
}

export default createPaymentLinksRoutes();
