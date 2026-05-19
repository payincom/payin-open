import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager: any = {
    createOrder: vi.fn(),
    listOrders: vi.fn(),
    getOrderStatistics: vi.fn(),
    getOrder: vi.fn(),
  };
  manager.createOrderForRuntimeScope = vi.fn((runtimeContext, request) =>
    manager.createOrder({
      ...request,
      organizationId: runtimeContext.paymentScope.id,
    })
  );
  manager.listOrdersForRuntimeScope = vi.fn((runtimeContext, filters = {}) =>
    manager.listOrders({
      ...filters,
      organizationId: runtimeContext.paymentScope.id,
    })
  );
  manager.getOrderForRuntimeScope = vi.fn((orderId, runtimeContext) =>
    manager.getOrder(orderId, runtimeContext.paymentScope.id)
  );
  manager.getOrderStatisticsForRuntimeScope = vi.fn((runtimeContext, filters = {}) =>
    manager.getOrderStatistics({
      ...filters,
      organizationId: runtimeContext.paymentScope.id,
    })
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

const { default: ordersRoutes } = await import('../src/routes/orders.js');

function createOrdersApp() {
  const app = new Hono();
  app.route('/orders', ordersRoutes);
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

const validCreateOrderBody = {
  orderReference: 'order-1',
  amount: '10.50',
  currency: 'USDC',
  chainId: 'base-sepolia',
};

describe('orders route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.createOrder.mockResolvedValue({
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'pending',
    });
    mocks.manager.listOrders.mockResolvedValue({ orders: [], page: 1, limit: 20, total: 0 });
    mocks.manager.getOrderStatistics.mockResolvedValue({ total: 0 });
    mocks.manager.getOrder.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001' });
  });

  it('uses the default single-merchant scope in Open runtime when no organization id is authenticated', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createOrdersApp().request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateOrderBody),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: DEFAULT_OPEN_ORGANIZATION_ID })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createOrdersApp().request('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateOrderBody),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.createOrderForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createOrdersApp().request('/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-organization-id': authenticatedOrganizationId,
        },
        body: JSON.stringify(validCreateOrderBody),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: authenticatedOrganizationId })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('lists orders through the manager runtime-scope seam in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createOrdersApp().request(
        '/orders?status=pending&orderReference=order-1&page=2&limit=10'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listOrdersForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        expect.objectContaining({
          status: 'pending',
          orderReference: 'order-1',
          page: 2,
          limit: 10,
        })
      );
      expect(mocks.manager.listOrdersForRuntimeScope.mock.calls[0][1]).not.toHaveProperty(
        'organizationId'
      );
      expect(mocks.manager.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: DEFAULT_OPEN_ORGANIZATION_ID })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when listing orders in Cloud runtime without context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createOrdersApp().request('/orders');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.listOrdersForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('gets an order through the manager runtime-scope seam in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    const orderId = '550e8400-e29b-41d4-a716-446655440001';
    try {
      const response = await createOrdersApp().request(`/orders/${orderId}`);

      expect(response.status).toBe(200);
      expect(mocks.manager.getOrderForRuntimeScope).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        })
      );
      expect(mocks.manager.getOrder).toHaveBeenCalledWith(orderId, DEFAULT_OPEN_ORGANIZATION_ID);
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when getting an order in Cloud runtime without context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createOrdersApp().request(
        '/orders/550e8400-e29b-41d4-a716-446655440001'
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.getOrderForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('gets order statistics through the manager runtime-scope seam in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createOrdersApp().request('/orders/stats?chain=base-sepolia');

      expect(response.status).toBe(200);
      expect(mocks.manager.getOrderStatisticsForRuntimeScope).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeKind: 'single-tenant',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
        }),
        expect.objectContaining({ chain: 'base-sepolia' })
      );
      expect(mocks.manager.getOrderStatisticsForRuntimeScope.mock.calls[0][1]).not.toHaveProperty(
        'organizationId'
      );
      expect(mocks.manager.getOrderStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: DEFAULT_OPEN_ORGANIZATION_ID })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when getting stats in Cloud runtime without context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createOrdersApp().request('/orders/stats');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.getOrderStatisticsForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });
});
