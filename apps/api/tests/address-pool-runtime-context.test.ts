import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager: any = {
    getAddressPoolAvailability: vi.fn(),
    getAddressPoolSummaryForRuntimeScope: vi.fn(),
    listAddresses: vi.fn(),
    listAddressesForRuntimeScope: vi.fn(),
    addAddressesToPool: vi.fn(),
    addAddressesToPoolForRuntimeScope: vi.fn(),
    archiveAddress: vi.fn(),
    archiveAddressForRuntimeScope: vi.fn(),
    unarchiveAddress: vi.fn(),
    unarchiveAddressForRuntimeScope: vi.fn(),
  };
  manager.getAddressPoolAvailabilityForRuntimeScope = vi.fn((runtimeContext, protocol) =>
    manager.getAddressPoolAvailability(runtimeContext.paymentScope.id, protocol)
  );
  manager.getAddressPoolSummaryForRuntimeScope = vi.fn(async runtimeContext => {
    await manager.getAddressPoolAvailability(runtimeContext.paymentScope.id, 'evm');
    return {
      protocols: [],
      totalAddresses: 0,
      totalAvailable: 0,
      hasAddresses: false,
      hasAvailableAddresses: false,
    };
  });
  manager.listAddressesForRuntimeScope = vi.fn((runtimeContext, params) =>
    manager.listAddresses({ ...params, organizationId: runtimeContext.paymentScope.id })
  );
  manager.addAddressesToPoolForRuntimeScope = vi.fn((runtimeContext, addresses) =>
    manager.addAddressesToPool(
      addresses.map((address: any) => ({
        ...address,
        organizationId: runtimeContext.paymentScope.id,
      }))
    )
  );
  manager.archiveAddressForRuntimeScope = vi.fn((runtimeContext, address) =>
    manager.archiveAddress(runtimeContext.paymentScope.id, address)
  );
  manager.unarchiveAddressForRuntimeScope = vi.fn((runtimeContext, address) =>
    manager.unarchiveAddress(runtimeContext.paymentScope.id, address)
  );

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
  requirePermission: () => async (_c: any, next: any) => {
    await next();
  },
}));

const { default: addressPoolRoutes, createAddressPoolRoutes } =
  await import('../src/routes/address-pool.js');

function createAddressPoolApp() {
  const app = new Hono();
  app.route('/address-pool', addressPoolRoutes);
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

describe('address-pool route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.getAddressPoolAvailability.mockResolvedValue({
      total: 0,
      available: 0,
      allocated: 0,
      bound: 0,
      coolingDown: 0,
      archived: 0,
    });
    mocks.manager.listAddresses.mockResolvedValue({
      addresses: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    mocks.manager.addAddressesToPool.mockResolvedValue(undefined);
    mocks.manager.archiveAddress.mockResolvedValue(undefined);
    mocks.manager.unarchiveAddress.mockResolvedValue(undefined);
  });

  it('uses the default single-merchant scope for availability in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createAddressPoolApp().request(
        '/address-pool/availability?protocol=evm'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.getAddressPoolAvailabilityForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        'evm'
      );
      expect(mocks.manager.getAddressPoolAvailability).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        'evm'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createAddressPoolApp().request(
        '/address-pool/availability?protocol=evm'
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.getAddressPoolAvailabilityForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createAddressPoolApp().request(
        '/address-pool/availability?protocol=tron',
        {
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.getAddressPoolAvailabilityForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'multi-tenant',
          paymentScope: expect.objectContaining({ id: authenticatedOrganizationId }),
        }),
        'tron'
      );
      expect(mocks.manager.getAddressPoolAvailability).toHaveBeenCalledWith(
        authenticatedOrganizationId,
        'tron'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when listing address-pool addresses', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createAddressPoolApp().request(
        '/address-pool/addresses?protocol=evm&page=2&pageSize=10'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listAddressesForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { protocol: 'evm', page: 2, pageSize: 10 }
      );
      expect(mocks.manager.listAddresses).toHaveBeenCalledWith({
        protocol: 'evm',
        page: 2,
        pageSize: 10,
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope for summary in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createAddressPoolApp().request('/address-pool/summary');

      expect(response.status).toBe(200);
      expect(mocks.manager.getAddressPoolSummaryForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        ['evm', 'tron', 'solana']
      );
      expect(mocks.manager.getAddressPoolAvailability).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        'evm'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior for summary when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createAddressPoolApp().request('/address-pool/summary');

      expect(response.status).toBe(401);
      expect(mocks.manager.getAddressPoolSummaryForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when adding address-pool addresses in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    const payload = {
      addresses: [
        {
          address: '0xabc',
          protocol: 'evm',
          derivationIndex: 1,
          masterPublicKey: 'xpub',
        },
      ],
    };
    try {
      const response = await createAddressPoolApp().request('/address-pool/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.addAddressesToPoolForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        payload.addresses
      );
      expect(mocks.manager.addAddressesToPool).toHaveBeenCalledWith([
        { ...payload.addresses[0], organizationId: DEFAULT_OPEN_ORGANIZATION_ID },
      ]);
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when adding addresses in Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createAddressPoolApp().request('/address-pool/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          addresses: [
            {
              address: '0xabc',
              protocol: 'evm',
              derivationIndex: 1,
              masterPublicKey: 'xpub',
            },
          ],
        }),
      });

      expect(response.status).toBe(401);
      expect(mocks.manager.addAddressesToPoolForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when archiving and unarchiving in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const archiveResponse = await createAddressPoolApp().request(
        '/address-pool/addresses/0xabc/archive',
        { method: 'PATCH' }
      );
      const unarchiveResponse = await createAddressPoolApp().request(
        '/address-pool/addresses/0xabc/unarchive',
        { method: 'PATCH' }
      );

      expect(archiveResponse.status).toBe(200);
      expect(unarchiveResponse.status).toBe(200);
      expect(mocks.manager.archiveAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        '0xabc'
      );
      expect(mocks.manager.unarchiveAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        '0xabc'
      );
      expect(mocks.manager.archiveAddress).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        '0xabc'
      );
      expect(mocks.manager.unarchiveAddress).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        '0xabc'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when archive routes in Cloud runtime have no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const archiveResponse = await createAddressPoolApp().request(
        '/address-pool/addresses/0xabc/archive',
        { method: 'PATCH' }
      );
      const unarchiveResponse = await createAddressPoolApp().request(
        '/address-pool/addresses/0xabc/unarchive',
        { method: 'PATCH' }
      );

      expect(archiveResponse.status).toBe(401);
      expect(unarchiveResponse.status).toBe(401);
      expect(mocks.manager.archiveAddressForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.manager.unarchiveAddressForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('can be composed as a factory with injected manager, middleware, and runtime dependencies', async () => {
    const runtimeContext = { paymentScope: { id: 'injected-org' } } as any;
    const injectedManager = {
      listAddressesForRuntimeScope: vi.fn().mockResolvedValue([{ address: '0xabc' }]),
    } as any;
    const getManager = vi.fn(() => injectedManager);
    const getAuth = vi.fn(() => ({}) as any);
    const createAuthMiddleware = vi.fn(() => async (_c: any, next: any) => {
      await next();
    });
    const createAuditMiddleware = vi.fn(() => async (_c: any, next: any) => {
      await next();
    });
    const requirePermission = vi.fn((permission: string) => async (c: any, next: any) => {
      c.set('permission', permission);
      await next();
    });
    const resolveRuntimeContext = vi.fn((c: any) => {
      expect(c.get('permission')).toBe('address-pool:read');
      return runtimeContext;
    });

    const app = new Hono();
    app.route(
      '/address-pool',
      createAddressPoolRoutes({
        getManager,
        getAuth,
        createAuthMiddleware,
        createAuditMiddleware,
        requirePermission,
        resolveRuntimeContext,
      })
    );

    const response = await app.request('/address-pool/addresses?protocol=evm&pageSize=5');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: [{ address: '0xabc' }] });
    expect(injectedManager.listAddressesForRuntimeScope).toHaveBeenCalledWith(runtimeContext, {
      protocol: 'evm',
      page: 1,
      pageSize: 5,
    });
    expect(mocks.manager.listAddressesForRuntimeScope).not.toHaveBeenCalled();
  });
});
