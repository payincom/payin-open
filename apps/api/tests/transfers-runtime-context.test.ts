import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager = {
    listTransfers: vi.fn(),
    listTransfersForRuntimeScope: vi.fn(),
    getTransfers: vi.fn(),
    getTransfersForRuntimeScope: vi.fn(),
  };

  return { manager };
});

vi.mock('../src/manager-instance.js', () => ({
  getManager: () => mocks.manager,
}));

vi.mock('../src/auth-instance.js', () => ({
  getAuth: () => ({}),
}));

vi.mock('@payin/auth', () => ({
  createAuthMiddleware: () => async (c: any, next: any) => {
    const organizationId = c.req.header('x-test-organization-id');
    if (organizationId) c.set('organizationId', organizationId);
    c.set('authType', 'apikey');
    c.set('apiKeyId', 'test-api-key');
    await next();
  },
  createAuditMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
}));

const { default: transfersRoutes, createTransfersRoutes } =
  await import('../src/routes/transfers.js');

function createTransfersApp() {
  const app = new Hono();
  app.route('/transfers', transfersRoutes);
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

describe('transfers route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.listTransfers.mockResolvedValue({ transfers: [], page: 1, limit: 20, total: 0 });
    mocks.manager.listTransfersForRuntimeScope.mockImplementation((_runtimeContext, filters) =>
      mocks.manager.listTransfers({
        ...filters,
        organizationId: _runtimeContext.paymentScope.id,
      })
    );
    mocks.manager.getTransfers.mockResolvedValue([]);
    mocks.manager.getTransfersForRuntimeScope.mockImplementation((_reference, _runtimeContext) =>
      mocks.manager.getTransfers(_reference, _runtimeContext.paymentScope.id)
    );
  });

  it('uses the Open merchant-organization scope for transfer listing in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createTransfersApp().request('/transfers?businessType=order');

      expect(response.status).toBe(200);
      expect(mocks.manager.listTransfersForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        expect.objectContaining({
          businessType: 'order',
        })
      );
      expect(mocks.manager.listTransfers).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
          businessType: 'order',
        })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createTransfersApp().request('/transfers');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.listTransfersForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.manager.listTransfers).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createTransfersApp().request(
        '/transfers?depositReference=customer-1',
        {
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listTransfersForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'multi-tenant',
          paymentScope: expect.objectContaining({ id: authenticatedOrganizationId }),
        }),
        expect.objectContaining({
          depositReference: 'customer-1',
        })
      );
      expect(mocks.manager.listTransfers).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: authenticatedOrganizationId,
          depositReference: 'customer-1',
        })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the Open merchant-organization scope for transfer lookup by reference in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createTransfersApp().request(
        '/transfers/by-reference?depositReference=customer-1'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.getTransfersForRuntimeScope).toHaveBeenCalledWith(
        { depositReference: 'customer-1' },
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
      expect(mocks.manager.getTransfers).toHaveBeenCalledWith(
        { depositReference: 'customer-1' },
        DEFAULT_OPEN_ORGANIZATION_ID
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior for transfer lookup by reference when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createTransfersApp().request(
        '/transfers/by-reference?depositReference=customer-1'
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.getTransfersForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.manager.getTransfers).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope for transfer lookup by reference when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createTransfersApp().request(
        '/transfers/by-reference?depositReference=customer-1',
        {
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.getTransfersForRuntimeScope).toHaveBeenCalledWith(
        { depositReference: 'customer-1' },
        expect.objectContaining({
          runtimeKind: 'multi-tenant',
          paymentScope: expect.objectContaining({ id: authenticatedOrganizationId }),
        })
      );
      expect(mocks.manager.getTransfers).toHaveBeenCalledWith(
        { depositReference: 'customer-1' },
        authenticatedOrganizationId
      );
    } finally {
      restoreRuntime();
    }
  });

  it('can be composed as a factory with injected manager, middleware, and runtime dependencies', async () => {
    const runtimeContext = { paymentScope: { id: 'injected-org' } } as any;
    const injectedManager = {
      listTransfersForRuntimeScope: vi.fn().mockResolvedValue({
        transfers: [{ id: 'transfer-1' }],
        page: 1,
        limit: 20,
        total: 1,
      }),
    } as any;
    const getManager = vi.fn(() => injectedManager);
    const getAuth = vi.fn(() => ({ source: 'injected-auth' }) as any);
    const createAuthMiddleware = vi.fn((auth: any) => async (c: any, next: any) => {
      c.set('authType', `auth:${auth.source}`);
      await next();
    });
    const resolveRuntimeContext = vi.fn((c: any) => {
      expect(c.get('authType')).toBe('auth:injected-auth');
      return runtimeContext;
    });

    const app = new Hono();
    app.route(
      '/transfers',
      createTransfersRoutes({
        getManager,
        getAuth,
        createAuthMiddleware,
        resolveRuntimeContext,
      })
    );

    const response = await app.request('/transfers?businessType=order');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'transfer-1' }]);
    expect(createAuthMiddleware).toHaveBeenCalledWith({ source: 'injected-auth' });
    expect(injectedManager.listTransfersForRuntimeScope).toHaveBeenCalledWith(runtimeContext, {
      businessType: 'order',
    });
    expect(mocks.manager.listTransfersForRuntimeScope).not.toHaveBeenCalled();
  });
});
