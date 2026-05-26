import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const auth = {
    createApiKey: vi.fn(),
    createApiKeyForRuntimeScope: vi.fn(),
    listApiKeys: vi.fn(),
    listApiKeysForRuntimeScope: vi.fn(),
    getApiKeyById: vi.fn(),
    getApiKeyByIdForRuntimeScope: vi.fn(),
    updateApiKey: vi.fn(),
    updateApiKeyForRuntimeScope: vi.fn(),
    revokeApiKey: vi.fn(),
    revokeApiKeyForRuntimeScope: vi.fn(),
  };

  return { auth };
});

vi.mock('../src/auth-instance.js', () => ({
  getAuth: () => mocks.auth,
}));

vi.mock('@payin/auth', () => ({
  createAuthMiddleware: () => async (c: any, next: any) => {
    const organizationId = c.req.header('x-test-organization-id');
    if (organizationId) c.set('organizationId', organizationId);
    c.set('authType', 'jwt');
    c.set('userId', 'test-user');
    await next();
  },
  createAuditMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => {
    await next();
  },
}));

const { default: apiKeysRoutes, createApiKeysRoutes } = await import('../src/routes/api-keys.js');

function createApiKeysApp() {
  const app = new Hono();
  app.route('/api-keys', apiKeysRoutes);
  return app;
}

function setRuntime(runtime: string) {
  const previous = process.env.PAYIN_RUNTIME;
  process.env.PAYIN_RUNTIME = runtime;
  return () => {
    if (previous === undefined) delete process.env.PAYIN_RUNTIME;
    else process.env.PAYIN_RUNTIME = previous;
  };
}

describe('api-keys route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.createApiKey.mockResolvedValue({
      apiKey: 'pk_test_secret',
      metadata: { id: 'key-1', organizationId: DEFAULT_OPEN_ORGANIZATION_ID },
    });
    mocks.auth.createApiKeyForRuntimeScope.mockImplementation((userId, runtimeContext, input) =>
      mocks.auth.createApiKey(userId, runtimeContext.paymentScope.id, input)
    );
    mocks.auth.listApiKeys.mockResolvedValue([]);
    mocks.auth.listApiKeysForRuntimeScope.mockImplementation((runtimeContext, userId) =>
      mocks.auth.listApiKeys(runtimeContext.paymentScope.id, userId)
    );
    mocks.auth.getApiKeyById.mockResolvedValue({
      id: 'key-1',
      userId: 'test-user',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    mocks.auth.getApiKeyByIdForRuntimeScope.mockImplementation((keyId, runtimeContext) =>
      mocks.auth.getApiKeyById(`${keyId}:${runtimeContext.paymentScope.id}`)
    );
    mocks.auth.updateApiKey.mockResolvedValue({
      id: 'key-1',
      userId: 'test-user',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      name: 'Updated key',
    });
    mocks.auth.updateApiKeyForRuntimeScope.mockImplementation((keyId, runtimeContext, input) =>
      mocks.auth.updateApiKey(`${keyId}:${runtimeContext.paymentScope.id}`, input)
    );
    mocks.auth.revokeApiKey.mockResolvedValue(undefined);
    mocks.auth.revokeApiKeyForRuntimeScope.mockImplementation((keyId, runtimeContext) =>
      mocks.auth.revokeApiKey(`${keyId}:${runtimeContext.paymentScope.id}`)
    );
  });

  it('uses the Open merchant-organization scope for API key listing in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createApiKeysApp().request('/api-keys');

      expect(response.status).toBe(200);
      expect(mocks.auth.listApiKeysForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        'test-user'
      );
      expect(mocks.auth.listApiKeys).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        'test-user'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createApiKeysApp().request('/api-keys');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.auth.listApiKeysForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.auth.listApiKeys).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createApiKeysApp().request('/api-keys', {
        headers: { 'x-test-organization-id': authenticatedOrganizationId },
      });

      expect(response.status).toBe(200);
      expect(mocks.auth.listApiKeysForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'multi-tenant',
          paymentScope: expect.objectContaining({ id: authenticatedOrganizationId }),
        }),
        'test-user'
      );
      expect(mocks.auth.listApiKeys).toHaveBeenCalledWith(authenticatedOrganizationId, 'test-user');
    } finally {
      restoreRuntime();
    }
  });

  it('creates API keys with the Open merchant-organization scope in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createApiKeysApp().request('/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Open key' }),
      });

      expect(response.status).toBe(200);
      expect(mocks.auth.createApiKeyForRuntimeScope).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        {
          name: 'Open key',
          expiresAt: undefined,
        }
      );
      expect(mocks.auth.createApiKey).toHaveBeenCalledWith(
        'test-user',
        DEFAULT_OPEN_ORGANIZATION_ID,
        {
          name: 'Open key',
          expiresAt: undefined,
        }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('does not create API keys when Cloud runtime has no organization context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createApiKeysApp().request('/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Cloud key' }),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
      });
      expect(mocks.auth.createApiKeyForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.auth.createApiKey).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('gets API keys with the Open merchant-organization scope in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createApiKeysApp().request('/api-keys/key-1');

      expect(response.status).toBe(200);
      expect(mocks.auth.getApiKeyByIdForRuntimeScope).toHaveBeenCalledWith(
        'key-1',
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
      expect(mocks.auth.getApiKeyById).toHaveBeenCalledWith(
        `key-1:${DEFAULT_OPEN_ORGANIZATION_ID}`
      );
    } finally {
      restoreRuntime();
    }
  });

  it('does not get API keys when Cloud runtime has no organization context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createApiKeysApp().request('/api-keys/key-1');

      expect(response.status).toBe(401);
      expect(mocks.auth.getApiKeyByIdForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('updates API keys with the Open merchant-organization scope in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createApiKeysApp().request('/api-keys/key-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated key' }),
      });

      expect(response.status).toBe(200);
      expect(mocks.auth.getApiKeyByIdForRuntimeScope).toHaveBeenCalledWith(
        'key-1',
        expect.objectContaining({
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
      expect(mocks.auth.updateApiKeyForRuntimeScope).toHaveBeenCalledWith(
        'key-1',
        expect.objectContaining({
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { name: 'Updated key', isActive: undefined, expiresAt: undefined }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('revokes API keys with the Open merchant-organization scope in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createApiKeysApp().request('/api-keys/key-1', {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      expect(mocks.auth.getApiKeyByIdForRuntimeScope).toHaveBeenCalledWith(
        'key-1',
        expect.objectContaining({
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
      expect(mocks.auth.revokeApiKeyForRuntimeScope).toHaveBeenCalledWith(
        'key-1',
        expect.objectContaining({
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('can be composed with injected auth, middleware, and runtime dependencies', async () => {
    const injectedAuth = {
      listApiKeysForRuntimeScope: vi.fn(async () => [{ id: 'injected-key' }]),
    };
    const app = new Hono();
    app.route(
      '/api-keys',
      createApiKeysRoutes({
        getAuth: () => injectedAuth as any,
        createAuthMiddleware: () => async (c: any, next: any) => {
          c.set('authType', 'jwt');
          c.set('userId', 'injected-user');
          await next();
        },
        createAuditMiddleware: () => async (_c: any, next: any) => {
          await next();
        },
        requirePermission: () => async (_c: any, next: any) => {
          await next();
        },
        resolveRuntimeContext: () => ({
          runtimeKind: 'single-tenant',
          paymentScope: { id: 'injected-scope', kind: 'single-merchant' },
          actor: { type: 'operator', id: 'injected-user' },
          source: 'test-overlay',
        }),
      })
    );

    const response = await app.request('/api-keys');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: [{ id: 'injected-key' }],
    });
    expect(injectedAuth.listApiKeysForRuntimeScope).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentScope: expect.objectContaining({ id: 'injected-scope' }),
        source: 'test-overlay',
      }),
      'injected-user'
    );
  });
});
