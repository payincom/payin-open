import type { Context, Next } from 'hono';
import {
  DEFAULT_OPEN_ORGANIZATION_ID,
  SingleTenantContextProvider,
  tenantPaymentScope,
  paymentScopeToOrganizationId,
  type PaymentScope,
  type RuntimeContext,
} from '@payin/processor';

export const PAYIN_RUNTIME_OPEN = 'open';

export function isOpenRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const runtime = (env.PAYIN_RUNTIME || env.PAYIN_EDITION || PAYIN_RUNTIME_OPEN).toLowerCase();
  return runtime === PAYIN_RUNTIME_OPEN || runtime === 'payin-open';
}

export function getOpenRuntimeOrganizationId(env: NodeJS.ProcessEnv = process.env): string {
  return env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_ORGANIZATION_ID;
}

export function createOpenRuntimeContextProvider(
  env: NodeJS.ProcessEnv = process.env
): SingleTenantContextProvider {
  return new SingleTenantContextProvider({
    scopeId: getOpenRuntimeOrganizationId(env),
  });
}

export function resolveBusinessPaymentScope(
  c: Context,
  env: NodeJS.ProcessEnv = process.env
): PaymentScope | undefined {
  const authenticatedOrganizationId = c.get('organizationId');
  if (
    typeof authenticatedOrganizationId === 'string' &&
    authenticatedOrganizationId.trim() !== ''
  ) {
    if (isOpenRuntime(env) && authenticatedOrganizationId === getOpenRuntimeOrganizationId(env)) {
      return createOpenRuntimeContextProvider(env).getPaymentScope();
    }

    return tenantPaymentScope(authenticatedOrganizationId);
  }

  const authType = c.get('authType');
  const authenticatedUserId = c.get('userId');
  if (authType === 'jwt' || authType === 'apikey' || typeof authenticatedUserId === 'string') {
    return undefined;
  }

  if (isOpenRuntime(env)) {
    return createOpenRuntimeContextProvider(env).getPaymentScope();
  }

  return undefined;
}

export function resolveRuntimeContext(
  c: Context,
  env: NodeJS.ProcessEnv = process.env
): RuntimeContext | undefined {
  const paymentScope = resolveBusinessPaymentScope(c, env);
  if (!paymentScope) return undefined;

  return {
    runtimeKind: paymentScope.kind === 'single-merchant' ? 'single-tenant' : 'multi-tenant',
    paymentScope,
    actor: {
      type: c.get('authType') === 'apikey' ? 'api-key' : c.get('userId') ? 'operator' : 'anonymous',
      id: c.get('apiKeyId') ?? c.get('userId'),
    },
    requestId: c.req.header('x-request-id') ?? undefined,
    source: 'apps/api',
  };
}

/**
 * Compatibility extractor for legacy service/repository calls.
 *
 * Route handlers should resolve a neutral RuntimeContext/PaymentScope at the
 * request boundary and only call this helper at the final boundary where the
 * current Open storage/service APIs still require organizationId.
 */
export function paymentScopeToLegacyOrganizationId(scope: PaymentScope): string {
  return paymentScopeToOrganizationId(scope);
}

export function runtimeContextToLegacyOrganizationId(context: RuntimeContext): string {
  return paymentScopeToLegacyOrganizationId(context.paymentScope);
}

/**
 * Resolve the business payment scope for API routes.
 *
 * In PayIn Open, business routes operate the single self-hosted merchant and
 * should not require callers to choose or understand an organization. In Cloud
 * mode, routes must keep using the authenticated tenant context.
 */
export function resolveBusinessOrganizationId(
  c: Context,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return resolveBusinessPaymentScope(c, env)?.id;
}

/**
 * Preserve already verified Open authorization context.
 *
 * PayIn Open has a single merchant scope, but JWT users must still prove they
 * are operators for that scope. The shared auth middleware verifies active
 * membership in the default Open merchant when JWT callers omit
 * X-Organization-Id, and API-key auth already carries a verified organization
 * context. This helper intentionally does not grant a default owner role to an
 * arbitrary JWT user, because public registration may be reachable during
 * bootstrap.
 */
export function injectOpenRuntimeAuthContext(
  c: Context,
  env: NodeJS.ProcessEnv = process.env
): void {
  const authenticatedOrganizationId = c.get('organizationId');
  if (
    typeof authenticatedOrganizationId === 'string' &&
    authenticatedOrganizationId.trim() !== ''
  ) {
    return;
  }

  if (!isOpenRuntime(env)) {
    return;
  }

  // Deliberately do not inject organizationId/owner here. Authorization for
  // JWT callers must come from membership verification in createAuthMiddleware.
}

export function openRuntimeAuthContextMiddleware(env: NodeJS.ProcessEnv = process.env) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    injectOpenRuntimeAuthContext(c, env);
    await next();
  };
}

export function organizationContextRequiredMessage(env: NodeJS.ProcessEnv = process.env): string {
  if (isOpenRuntime(env)) {
    return 'PayIn Open could not resolve a verified merchant context for this request. Business API-key calls are scoped automatically; JWT operator calls without X-Organization-Id are scoped to the default Open merchant only after active membership is verified.';
  }

  return 'Organization context is required for hosted multi-tenant operations.';
}

export function organizationContextRequiredSuggestions(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (isOpenRuntime(env)) {
    const openMerchantId = getOpenRuntimeOrganizationId(env);

    return [
      'For PayIn Open business API-key calls, omit X-Organization-Id; API keys auto-scope to the Open merchant.',
      `For PayIn Open JWT operator calls, omit X-Organization-Id to use the default merchant (${openMerchantId}) or send it explicitly for compatibility.`,
      'If this persists, run npm run open:init -- --check and confirm the Open merchant bootstrap completed.',
    ];
  }

  return [
    'In hosted Cloud mode, include X-Organization-Id for the target tenant or use an organization-scoped API key.',
    'Confirm the authenticated user or API key belongs to that hosted organization.',
  ];
}

export function organizationContextRequiredPayload(env: NodeJS.ProcessEnv = process.env) {
  return {
    success: false,
    error: 'Authorization failed',
    code: 'ORGANIZATION_CONTEXT_REQUIRED',
    message: organizationContextRequiredMessage(env),
    suggestions: organizationContextRequiredSuggestions(env),
  };
}

export function cloudOnlyRouteDisabledPayload(routeName: string) {
  return {
    success: false,
    error: 'Not Found',
    code: 'CLOUD_ONLY_ROUTE_DISABLED',
    message: `${routeName} is a hosted multi-tenant Cloud route and is not available in PayIn Open. Use the Open single-merchant API, CLI, or Agent operations instead.`,
  };
}

/**
 * Hide hosted Cloud-only APIs from PayIn Open.
 *
 * Cloud runtime keeps the original routes. Open runtime should not expose
 * tenant/organization administration as a merchant-facing surface.
 */
export function cloudOnlyRouteGuard(routeName: string, env: NodeJS.ProcessEnv = process.env) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (isOpenRuntime(env)) {
      return c.json(cloudOnlyRouteDisabledPayload(routeName), 404);
    }

    await next();
  };
}
