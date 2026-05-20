import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager = {
    bindDepositAddress: vi.fn(),
    bindDepositAddressForRuntimeScope: vi.fn(),
    unbindDepositAddress: vi.fn(),
    unbindDepositAddressForRuntimeScope: vi.fn(),
    unbindDepositAddressByAddress: vi.fn(),
    unbindDepositAddressByAddressForRuntimeScope: vi.fn(),
    listDepositReferences: vi.fn(),
    listDepositReferencesForRuntimeScope: vi.fn(),
    getUserDepositAddress: vi.fn(),
    getUserDepositAddressForRuntimeScope: vi.fn(),
    listDepositAddresses: vi.fn(),
    listDepositAddressesForRuntimeScope: vi.fn(),
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
  requirePermission: () => async (_c: any, next: any) => {
    await next();
  },
}));

const { default: depositsRoutes } = await import('../src/routes/deposits.js');

function createDepositsApp() {
  const app = new Hono();
  app.route('/deposits', depositsRoutes);
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

const validBindDepositBody = {
  depositReference: 'customer-1',
  protocol: 'evm',
};

describe('deposits route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.bindDepositAddress.mockResolvedValue({
      depositReference: 'customer-1',
      protocol: 'evm',
      depositAddress: '0xabc',
      monitoringTargets: [],
      bindingCreatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    mocks.manager.bindDepositAddressForRuntimeScope.mockImplementation((_runtimeContext, request) =>
      mocks.manager.bindDepositAddress({
        ...request,
        organizationId: _runtimeContext.paymentScope.id,
      })
    );
    mocks.manager.unbindDepositAddress.mockResolvedValue(undefined);
    mocks.manager.unbindDepositAddressForRuntimeScope.mockImplementation(
      (_runtimeContext, request) =>
        mocks.manager.unbindDepositAddress({
          ...request,
          organizationId: _runtimeContext.paymentScope.id,
        })
    );
    mocks.manager.unbindDepositAddressByAddress.mockResolvedValue(undefined);
    mocks.manager.unbindDepositAddressByAddressForRuntimeScope.mockImplementation(
      (_runtimeContext, request) =>
        mocks.manager.unbindDepositAddressByAddress({
          ...request,
          organizationId: _runtimeContext.paymentScope.id,
        })
    );
    mocks.manager.listDepositReferences.mockResolvedValue({
      references: [],
      page: 1,
      limit: 20,
      total: 0,
    });
    mocks.manager.listDepositReferencesForRuntimeScope.mockImplementation(
      (_runtimeContext, filters) =>
        mocks.manager.listDepositReferences({
          ...filters,
          organizationId: _runtimeContext.paymentScope.id,
        })
    );
    mocks.manager.getUserDepositAddress.mockResolvedValue({
      deposit_reference: 'customer-1',
      protocol: 'evm',
      address: '0xabc',
    });
    mocks.manager.getUserDepositAddressForRuntimeScope.mockImplementation(
      (_runtimeContext, depositReference, protocol) =>
        mocks.manager.getUserDepositAddress(
          _runtimeContext.paymentScope.id,
          depositReference,
          protocol
        )
    );
    mocks.manager.listDepositAddresses.mockResolvedValue({
      addresses: [],
      page: 1,
      limit: 20,
      total: 0,
    });
    mocks.manager.listDepositAddressesForRuntimeScope.mockImplementation(
      (_runtimeContext, filters) =>
        mocks.manager.listDepositAddresses({
          ...filters,
          organizationId: _runtimeContext.paymentScope.id,
        })
    );
  });

  it('uses the default single-merchant scope for deposit binding in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request('/deposits/bind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBindDepositBody),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.bindDepositAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        validBindDepositBody
      );
      expect(mocks.manager.bindDepositAddress).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: DEFAULT_OPEN_ORGANIZATION_ID })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createDepositsApp().request('/deposits/bind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBindDepositBody),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.bindDepositAddressForRuntimeScope).not.toHaveBeenCalled();
      expect(mocks.manager.bindDepositAddress).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createDepositsApp().request('/deposits/bind', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-organization-id': authenticatedOrganizationId,
        },
        body: JSON.stringify(validBindDepositBody),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.bindDepositAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentScope: expect.objectContaining({ id: authenticatedOrganizationId }),
        }),
        validBindDepositBody
      );
      expect(mocks.manager.bindDepositAddress).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: authenticatedOrganizationId })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when listing deposit references', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request(
        '/deposits/references?page=2&limit=10&search=customer'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listDepositReferencesForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { page: 2, limit: 10, search: 'customer' }
      );
      expect(mocks.manager.listDepositReferences).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'customer',
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when getting a deposit address', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request('/deposits/customer-1?protocol=evm');

      expect(response.status).toBe(200);
      expect(mocks.manager.getUserDepositAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        'customer-1',
        'evm'
      );
      expect(mocks.manager.getUserDepositAddress).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        'customer-1',
        'evm'
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when listing deposit addresses', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request(
        '/deposits?protocol=evm&depositReference=customer-1&page=2&limit=10'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listDepositAddressesForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { protocol: 'evm', depositReference: 'customer-1', page: 2, limit: 10 }
      );
      expect(mocks.manager.listDepositAddresses).toHaveBeenCalledWith({
        protocol: 'evm',
        depositReference: 'customer-1',
        page: 2,
        limit: 10,
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when unbinding by address in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request('/deposits/unbind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: '0xabc', protocol: 'evm' }),
      });

      expect(response.status).toBe(200);
      expect(mocks.manager.unbindDepositAddressByAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { address: '0xabc', protocol: 'evm' }
      );
      expect(mocks.manager.unbindDepositAddressByAddress).toHaveBeenCalledWith({
        address: '0xabc',
        protocol: 'evm',
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when unbinding by deposit reference in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createDepositsApp().request('/deposits/unbind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ depositReference: 'customer-1' }),
      });

      expect(response.status).toBe(200);
      expect(mocks.manager.unbindDepositAddressForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { depositReference: 'customer-1', protocol: undefined }
      );
      expect(mocks.manager.unbindDepositAddress).toHaveBeenCalledWith({
        depositReference: 'customer-1',
        protocol: undefined,
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      });
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior for unbind-by-reference when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createDepositsApp().request('/deposits/unbind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ depositReference: 'customer-1' }),
      });

      expect(response.status).toBe(401);
      expect(mocks.manager.unbindDepositAddressForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior for unbind-by-address when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createDepositsApp().request('/deposits/unbind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: '0xabc', protocol: 'evm' }),
      });

      expect(response.status).toBe(401);
      expect(mocks.manager.unbindDepositAddressByAddressForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses the runtime-scope manager seam when getting deposit stats in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    mocks.manager.listDepositAddresses.mockResolvedValueOnce({
      addresses: [
        { deposit_reference: 'customer-1', protocol: 'evm', address: '0xabc' },
        { deposit_reference: 'customer-2', protocol: 'evm', address: '0xdef' },
      ],
      page: 1,
      limit: 10000,
      total: 2,
    });
    try {
      const response = await createDepositsApp().request('/deposits/stats?protocol=evm');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({ boundAddressCount: 2, activeReferences: 2 });
      expect(mocks.manager.listDepositAddressesForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        { protocol: 'evm', limit: 10000 }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior for deposit stats when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createDepositsApp().request('/deposits/stats');

      expect(response.status).toBe(401);
      expect(mocks.manager.listDepositAddressesForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });
});
