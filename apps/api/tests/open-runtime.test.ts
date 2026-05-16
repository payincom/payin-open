import { describe, expect, it } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import { getOpenRuntimeOrganizationId, injectOpenRuntimeAuthContext, isOpenRuntime, organizationContextRequiredMessage, resolveBusinessOrganizationId } from '../src/open-runtime.js';
import { createApp } from '../src/server.js';

function contextWithOrganizationId(value?: string) {
  const values = new Map<string, unknown>();
  if (value !== undefined) values.set('organizationId', value);

  return {
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
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), { PAYIN_RUNTIME: 'open' } as any);

    expect(org).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
  });

  it('supports custom Open merchant context for compatibility migrations', () => {
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), {
      PAYIN_RUNTIME: 'open',
      PAYIN_OPEN_ORGANIZATION_ID: '44444444-4444-4444-4444-444444444444',
    } as any);

    expect(org).toBe('44444444-4444-4444-4444-444444444444');
    expect(getOpenRuntimeOrganizationId({ PAYIN_OPEN_ORGANIZATION_ID: '44444444-4444-4444-4444-444444444444' } as any))
      .toBe('44444444-4444-4444-4444-444444444444');
  });

  it('does not inject default context in Cloud runtime', () => {
    const org = resolveBusinessOrganizationId(contextWithOrganizationId(undefined), { PAYIN_RUNTIME: 'cloud' } as any);

    expect(org).toBeUndefined();
    expect(organizationContextRequiredMessage({ PAYIN_RUNTIME: 'cloud' } as any)).toContain('hosted multi-tenant');
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
});
