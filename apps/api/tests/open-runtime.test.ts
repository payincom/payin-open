import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import {
  getOpenRuntimeOrganizationId,
  injectOpenRuntimeAuthContext,
  isOpenRuntime,
  organizationContextRequiredMessage,
  organizationContextRequiredPayload,
  organizationContextRequiredSuggestions,
  resolveBusinessOrganizationId,
  resolveBusinessPaymentScope,
  resolveRuntimeContext,
} from '../src/open-runtime.js';
import { createApp } from '../src/server.js';

function contextWithOrganizationId(value?: string) {
  const values = new Map<string, unknown>();
  if (value !== undefined) values.set('organizationId', value);

  return {
    req: {
      header: (name: string) => (name.toLowerCase() === 'x-request-id' ? 'req-1' : undefined),
    },
    get(key: string) {
      return values.get(key);
    },
    set(key: string, nextValue: unknown) {
      values.set(key, nextValue);
    },
  } as any;
}

describe('Open runtime API context', () => {
  it('defaults to Open runtime in payin-open', () => {
    expect(isOpenRuntime({} as any)).toBe(true);
    expect(isOpenRuntime({ PAYIN_RUNTIME: 'open' } as any)).toBe(true);
    expect(isOpenRuntime({ PAYIN_EDITION: 'payin-open' } as any)).toBe(true);
  });

  it('uses authenticated organization when present', () => {
    const org = resolveBusinessOrganizationId(
      contextWithOrganizationId('33333333-3333-3333-3333-333333333333'),
      { PAYIN_RUNTIME: 'open' } as any
    );

    expect(org).toBe('33333333-3333-3333-3333-333333333333');
  });

  it('injects default Open merchant context when auth has no organization', () => {
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), {
      PAYIN_RUNTIME: 'open',
    } as any);

    expect(org).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
  });

  it('supports custom Open merchant context for compatibility migrations', () => {
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), {
      PAYIN_RUNTIME: 'open',
      PAYIN_OPEN_ORGANIZATION_ID: '44444444-4444-4444-4444-444444444444',
    } as any);

    expect(org).toBe('44444444-4444-4444-4444-444444444444');
    expect(
      getOpenRuntimeOrganizationId({
        PAYIN_OPEN_ORGANIZATION_ID: '44444444-4444-4444-4444-444444444444',
      } as any)
    ).toBe('44444444-4444-4444-4444-444444444444');
  });

  it('resolves neutral payment and runtime context for Open API routes', () => {
    const context = contextWithOrganizationId(undefined);
    context.set('userId', 'operator-1');
    context.set('authType', 'jwt');

    const scope = resolveBusinessPaymentScope(context, { PAYIN_RUNTIME: 'open' } as any);
    const runtimeContext = resolveRuntimeContext(context, { PAYIN_RUNTIME: 'open' } as any);

    expect(scope).toEqual({
      id: DEFAULT_OPEN_ORGANIZATION_ID,
      kind: 'single-merchant',
      label: 'PayIn Open Merchant',
    });
    expect(runtimeContext).toMatchObject({
      runtimeKind: 'single-tenant',
      paymentScope: scope,
      actor: { type: 'operator', id: 'operator-1' },
      requestId: 'req-1',
      source: 'apps/api',
    });
  });

  it('describes Open organization-context recovery without hosted organization management', () => {
    const env = {
      PAYIN_RUNTIME: 'open',
      PAYIN_OPEN_ORGANIZATION_ID: '44444444-4444-4444-4444-444444444444',
    } as any;

    expect(organizationContextRequiredMessage(env)).toContain('Business API-key calls');
    expect(organizationContextRequiredMessage(env)).toContain('JWT operator calls');
    expect(organizationContextRequiredSuggestions(env)).toEqual([
      'For PayIn Open business API-key calls, omit X-Organization-Id; API keys auto-scope to the Open merchant.',
      'For JWT operator calls after /auth/register bootstrap, send X-Organization-Id: 44444444-4444-4444-4444-444444444444 until you switch to API-key auth.',
      'If this persists, run npm run open:init -- --check and confirm the Open merchant bootstrap completed.',
    ]);
    expect(organizationContextRequiredPayload(env)).toMatchObject({
      code: 'ORGANIZATION_CONTEXT_REQUIRED',
      suggestions: expect.arrayContaining([expect.stringContaining('/auth/register')]),
    });
    expect(organizationContextRequiredPayload(env).message).not.toContain('hosted organization');
  });

  it('does not inject default context in Cloud runtime', () => {
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), {
      PAYIN_RUNTIME: 'cloud',
    } as any);

    expect(org).toBeUndefined();
    const cloudEnv = { PAYIN_RUNTIME: 'cloud' } as any;
    expect(organizationContextRequiredMessage(cloudEnv)).toContain('hosted multi-tenant');
    expect(organizationContextRequiredSuggestions(cloudEnv)).toEqual([
      'In hosted Cloud mode, include X-Organization-Id for the target tenant or use an organization-scoped API key.',
      'Confirm the authenticated user or API key belongs to that hosted organization.',
    ]);
  });

  it('does not grant default owner authorization to arbitrary JWT users in Open runtime', () => {
    const context = contextWithOrganizationId(undefined);
    context.set('authType', 'jwt');
    context.set('userId', 'untrusted-user');

    injectOpenRuntimeAuthContext(context, { PAYIN_RUNTIME: 'open' } as any);

    expect(context.get('organizationId')).toBeUndefined();
    expect(context.get('organizationRole')).toBeUndefined();
  });

  it('preserves verified organization context in Open runtime', () => {
    const context = contextWithOrganizationId(DEFAULT_OPEN_ORGANIZATION_ID);
    context.set('organizationRole', 'owner');

    injectOpenRuntimeAuthContext(context, { PAYIN_RUNTIME: 'open' } as any);

    expect(context.get('organizationId')).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
    expect(context.get('organizationRole')).toBe('owner');
  });

  it('does not inject authorization context in Cloud runtime', () => {
    const context = contextWithOrganizationId(undefined);

    injectOpenRuntimeAuthContext(context, { PAYIN_RUNTIME: 'cloud' } as any);

    expect(context.get('organizationId')).toBeUndefined();
    expect(context.get('organizationRole')).toBeUndefined();
  });

  it('hides hosted organization and multi-tenant config routes in Open runtime', async () => {
    const previousRuntime = process.env.PAYIN_RUNTIME;
    process.env.PAYIN_RUNTIME = 'open';
    try {
      const app = createApp();

      const orgResponse = await app.request('/api/v1/organizations');
      const configResponse = await app.request('/api/v1/config-management');

      expect(orgResponse.status).toBe(404);
      expect(await orgResponse.json()).toMatchObject({ code: 'CLOUD_ONLY_ROUTE_DISABLED' });
      expect(configResponse.status).toBe(404);
      expect(await configResponse.json()).toMatchObject({ code: 'CLOUD_ONLY_ROUTE_DISABLED' });
    } finally {
      if (previousRuntime === undefined) delete process.env.PAYIN_RUNTIME;
      else process.env.PAYIN_RUNTIME = previousRuntime;
    }
  });

  it('keeps hosted organization routes available in Cloud runtime', async () => {
    const previousRuntime = process.env.PAYIN_RUNTIME;
    process.env.PAYIN_RUNTIME = 'cloud';
    try {
      const app = createApp();
      const response = await app.request('/api/v1/organizations');

      expect(response.status).not.toBe(404);
    } finally {
      if (previousRuntime === undefined) delete process.env.PAYIN_RUNTIME;
      else process.env.PAYIN_RUNTIME = previousRuntime;
    }
  });

  it('allows overlays to compose additional API routes without copying Open route files', async () => {
    const app = createApp({
      extendApiRoutes: api => {
        api.get('/overlay-health', c => c.json({ ok: true, source: 'overlay' }));
      },
    });

    const response = await app.request('/api/v1/overlay-health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, source: 'overlay' });
  });

  it('allows composed runtimes to override infrastructure dependencies', async () => {
    const app = createApp({
      getManager: () => {
        throw new Error('manager unavailable');
      },
    });

    const response = await app.request('/health');

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'unhealthy',
      error: 'manager unavailable',
    });
  });

  it('injects business route dependencies through the app composition layer', async () => {
    const runtimeContext = {
      runtimeKind: 'single-tenant',
      paymentScope: {
        id: '55555555-5555-4555-8555-555555555555',
        kind: 'single-merchant',
        label: 'Injected Merchant',
      },
      actor: { type: 'api-key', id: 'test-key' },
      requestId: 'req-composed',
      source: 'test',
    };
    const listOrdersForRuntimeScope = vi.fn().mockResolvedValue({
      orders: [{ id: '550e8400-e29b-41d4-a716-446655440001', amount: '10.00' }],
      page: 1,
      limit: 20,
      total: 1,
    });

    const app = createApp({
      routeDependencies: {
        orders: {
          getManager: () => ({ listOrdersForRuntimeScope }) as any,
          getAuth: () => ({}) as any,
          createAuthMiddleware: () => async (_c: any, next: any) => next(),
          requirePermission: () => async (_c: any, next: any) => next(),
          resolveRuntimeContext: () => runtimeContext as any,
          getBaseUrl: () => 'https://pay.example.test',
          buildOrderPaymentUrl: (baseUrl: string, orderId: string) => `${baseUrl}/pay/${orderId}`,
        },
      },
    });

    const response = await app.request('/api/v1/orders');

    expect(response.status).toBe(200);
    expect(listOrdersForRuntimeScope).toHaveBeenCalledWith(runtimeContext, {});
    expect(await response.json()).toMatchObject({
      success: true,
      data: [{ id: '550e8400-e29b-41d4-a716-446655440001', url: expect.stringContaining('/pay/') }],
    });
  });

  it('allows built-in business route factories to be overridden without remounting paths', async () => {
    const orders = new Hono();
    orders.get('/', c => c.json({ success: true, source: 'custom-orders-factory' }));
    const createOrdersRoutes = vi.fn(() => orders);

    const app = createApp({
      routeFactories: {
        orders: createOrdersRoutes as any,
      },
    });

    const response = await app.request('/api/v1/orders');

    expect(createOrdersRoutes).toHaveBeenCalledWith(undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, source: 'custom-orders-factory' });
  });
});
