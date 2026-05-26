import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import { createAuthMiddleware } from '../../src/middleware/auth-middleware.js';

function createContext(headers: Record<string, string> = {}) {
  const values = new Map<string, unknown>();
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    req: {
      header: (name: string) => normalizedHeaders.get(name.toLowerCase()),
    },
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
    json: (body: unknown, status = 200) => ({ body, status }),
  } as any;
}

function createAuthManager(membership = { valid: true, role: 'owner', status: 'active' }) {
  return {
    verifyToken: vi.fn(async () => ({ valid: true, userId: 'user-1', username: 'operator' })),
    verifyApiKey: vi.fn(),
    updateApiKeyUsage: vi.fn(),
    organizations: {
      verifyMembership: vi.fn(async () => membership),
    },
  } as any;
}

describe('Open runtime JWT organization context', () => {
  afterEach(() => {
    delete process.env.PAYIN_RUNTIME;
    delete process.env.PAYIN_EDITION;
    delete process.env.PAYIN_OPEN_ORGANIZATION_ID;
  });

  it('verifies Open merchant-organization membership when JWT omits organization header', async () => {
    process.env.PAYIN_RUNTIME = 'open';
    const authManager = createAuthManager();
    const context = createContext({ Authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    await createAuthMiddleware(authManager)(context, next);

    expect(authManager.organizations.verifyMembership).toHaveBeenCalledWith(
      'user-1',
      DEFAULT_OPEN_ORGANIZATION_ID
    );
    expect(context.get('organizationId')).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
    expect(context.get('organizationRole')).toBe('owner');
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses PAYIN_OPEN_ORGANIZATION_ID for omitted Open JWT organization header', async () => {
    process.env.PAYIN_RUNTIME = 'open';
    process.env.PAYIN_OPEN_ORGANIZATION_ID = '55555555-5555-5555-5555-555555555555';
    const authManager = createAuthManager();
    const context = createContext({ Authorization: 'Bearer jwt-token' });

    await createAuthMiddleware(authManager)(context, vi.fn());

    expect(authManager.organizations.verifyMembership).toHaveBeenCalledWith(
      'user-1',
      '55555555-5555-5555-5555-555555555555'
    );
    expect(context.get('organizationId')).toBe('55555555-5555-5555-5555-555555555555');
  });

  it('preserves explicit organization header compatibility in Open runtime', async () => {
    process.env.PAYIN_RUNTIME = 'open';
    const authManager = createAuthManager();
    const explicitOrgId = '33333333-3333-4333-8333-333333333333';
    const context = createContext({
      Authorization: 'Bearer jwt-token',
      'X-Organization-ID': explicitOrgId,
    });

    await createAuthMiddleware(authManager)(context, vi.fn());

    expect(authManager.organizations.verifyMembership).toHaveBeenCalledWith('user-1', explicitOrgId);
    expect(context.get('organizationId')).toBe(explicitOrgId);
  });

  it('does not infer organization context when runtime is not Open', async () => {
    process.env.PAYIN_RUNTIME = 'cloud';
    const authManager = createAuthManager();
    const context = createContext({ Authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    await createAuthMiddleware(authManager)(context, next);

    expect(authManager.organizations.verifyMembership).not.toHaveBeenCalled();
    expect(context.get('organizationId')).toBeUndefined();
    expect(context.get('organizationRole')).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects omitted organization header when default Open membership is inactive', async () => {
    process.env.PAYIN_RUNTIME = 'open';
    const authManager = createAuthManager({
      valid: false,
      role: 'owner',
      status: 'inactive',
      error: 'Membership status is inactive',
    });
    const context = createContext({ Authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    const response = await createAuthMiddleware(authManager)(context, next);

    expect(response).toEqual({
      status: 403,
      body: { error: 'Forbidden', message: 'Membership status is inactive' },
    });
    expect(context.get('organizationId')).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});
