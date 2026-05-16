import type { Context, Next } from 'hono';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

export const PAYIN_RUNTIME_OPEN = 'open';

export function isOpenRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const runtime = (env.PAYIN_RUNTIME || env.PAYIN_EDITION || PAYIN_RUNTIME_OPEN).toLowerCase();
  return runtime === PAYIN_RUNTIME_OPEN || runtime === 'payin-open';
}

export function getOpenRuntimeOrganizationId(env: NodeJS.ProcessEnv = process.env): string {
  return env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_ORGANIZATION_ID;
}

/**
 * Resolve the business payment scope for API routes.
 *
 * In PayIn Open, business routes operate the single self-hosted merchant and
 * should not require callers to choose or understand an organization. In Cloud
 * mode, routes must keep using the authenticated tenant context.
 */
export function resolveBusinessOrganizationId(c: Context, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const authenticatedOrganizationId = c.get('organizationId');
  if (typeof authenticatedOrganizationId === 'string' && authenticatedOrganizationId.trim() !== '') {
    return authenticatedOrganizationId;
  }

  if (isOpenRuntime(env)) {
    return getOpenRuntimeOrganizationId(env);
  }

  return undefined;
}

/**
 * Preserve already verified Open authorization context.
 *
 * PayIn Open has a single merchant scope, but JWT users must still prove they
 * are operators for that scope. The shared auth middleware verifies that proof
 * when callers pass X-Organization-Id. This helper intentionally does not grant
 * a default owner role to an arbitrary JWT user, because public registration may
 * be reachable during bootstrap.
 *
 * API-key auth already carries a verified organization context. JWT operator
 * calls should pass X-Organization-Id with the Open merchant id returned by
 * open:init/registration.
 */
export function injectOpenRuntimeAuthContext(c: Context, env: NodeJS.ProcessEnv = process.env): void {
  const authenticatedOrganizationId = c.get('organizationId');
  if (typeof authenticatedOrganizationId === 'string' && authenticatedOrganizationId.trim() !== '') {
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
    return 'Open runtime could not resolve the default merchant context. Check PAYIN_OPEN_ORGANIZATION_ID or database bootstrap.';
  }

  return 'Organization context is required for hosted multi-tenant operations.';
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
