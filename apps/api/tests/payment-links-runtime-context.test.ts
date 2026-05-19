import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager = {
    createPaymentLink: vi.fn(),
    createPaymentLinkForRuntimeScope: vi.fn(),
    updatePaymentLink: vi.fn(),
    updatePaymentLinkForRuntimeScope: vi.fn(),
    updatePaymentLinkCurrencies: vi.fn(),
    updatePaymentLinkCurrenciesForRuntimeScope: vi.fn(),
    getPaymentLink: vi.fn(),
    getPaymentLinkForRuntimeScope: vi.fn(),
    getPaymentLinkOrganizationIdForRuntimeScope: vi.fn(),
    listPaymentLinks: vi.fn(),
    listPaymentLinksForRuntimeScope: vi.fn(),
    publishPaymentLink: vi.fn(),
    publishPaymentLinkForRuntimeScope: vi.fn(),
    unpublishPaymentLink: vi.fn(),
    unpublishPaymentLinkForRuntimeScope: vi.fn(),
    archivePaymentLink: vi.fn(),
    archivePaymentLinkForRuntimeScope: vi.fn(),
    restorePaymentLink: vi.fn(),
    restorePaymentLinkForRuntimeScope: vi.fn(),
    listPaymentLinkOrders: vi.fn(),
    listPaymentLinkOrdersForRuntimeScope: vi.fn(),
  };

  const auth = {
    createPreviewToken: vi.fn(() => 'preview-token'),
  };

  return { manager, auth };
});

vi.mock('../src/manager-instance.js', () => ({
  getManager: () => mocks.manager,
}));

vi.mock('../src/auth-instance.js', () => ({
  getAuth: () => mocks.auth,
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

const { default: paymentLinksRoutes } = await import('../src/routes/payment-links.js');

function createPaymentLinksApp() {
  const app = new Hono();
  app.route('/payment-links', paymentLinksRoutes);
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

const validCreatePaymentLinkBody = {
  title: 'Test payment link',
  amount: '10.50',
  currencies: [
    {
      currency: 'USDC',
      chainOptions: ['base-sepolia'],
    },
  ],
};

const expectRuntimeScope = (organizationId: string) =>
  expect.objectContaining({
    paymentScope: expect.objectContaining({ id: organizationId }),
  });

describe('payment-links route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const paymentLink = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      status: 'draft',
      slug: null,
      is_archived: false,
      created_at: new Date().toISOString(),
    };
    mocks.manager.createPaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.updatePaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.updatePaymentLinkCurrenciesForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.getPaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.getPaymentLinkOrganizationIdForRuntimeScope.mockImplementation(
      runtimeContext => runtimeContext.paymentScope.id
    );
    mocks.manager.listPaymentLinksForRuntimeScope.mockResolvedValue({
      links: [],
      page: 1,
      limit: 20,
      total: 0,
    });
    mocks.manager.publishPaymentLinkForRuntimeScope.mockResolvedValue({
      ...paymentLink,
      status: 'published',
      slug: 'test-link',
    });
    mocks.manager.unpublishPaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.archivePaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.restorePaymentLinkForRuntimeScope.mockResolvedValue(paymentLink);
    mocks.manager.listPaymentLinkOrdersForRuntimeScope.mockResolvedValue([]);
  });

  it('uses the default single-merchant scope for payment-link creation in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createPaymentLinksApp().request('/payment-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreatePaymentLinkBody),
      });

      expect(response.status).toBe(201);
      expect(mocks.manager.createPaymentLinkForRuntimeScope).toHaveBeenCalledWith(
        expectRuntimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        expect.not.objectContaining({ organizationId: expect.anything() })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope for listing payment links in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createPaymentLinksApp().request('/payment-links');

      expect(response.status).toBe(200);
      expect(mocks.manager.listPaymentLinksForRuntimeScope).toHaveBeenCalledWith(
        expectRuntimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        expect.not.objectContaining({ organizationId: expect.anything() })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createPaymentLinksApp().request('/payment-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreatePaymentLinkBody),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
      expect(mocks.manager.createPaymentLinkForRuntimeScope).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createPaymentLinksApp().request('/payment-links', {
        headers: { 'x-test-organization-id': authenticatedOrganizationId },
      });

      expect(response.status).toBe(200);
      expect(mocks.manager.listPaymentLinksForRuntimeScope).toHaveBeenCalledWith(
        expectRuntimeScope(authenticatedOrganizationId),
        expect.not.objectContaining({ organizationId: expect.anything() })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope for getting a payment link in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createPaymentLinksApp().request(
        '/payment-links/550e8400-e29b-41d4-a716-446655440010'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.getPaymentLinkForRuntimeScope).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
        expectRuntimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('updates payment links through the runtime-scope manager seam', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createPaymentLinksApp().request(
        '/payment-links/550e8400-e29b-41d4-a716-446655440010',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Updated payment link' }),
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.updatePaymentLinkForRuntimeScope).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
        expectRuntimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        expect.objectContaining({ title: 'Updated payment link' })
      );
      expect(mocks.manager.updatePaymentLink).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('publishes payment links through the runtime-scope manager seam for authenticated organization scope', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createPaymentLinksApp().request(
        '/payment-links/550e8400-e29b-41d4-a716-446655440010/publish',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-test-organization-id': authenticatedOrganizationId,
          },
          body: JSON.stringify({ slug: 'test-link' }),
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.publishPaymentLinkForRuntimeScope).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
        expectRuntimeScope(authenticatedOrganizationId),
        'test-link'
      );
      expect(mocks.manager.publishPaymentLink).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('lists payment-link orders through the runtime-scope manager seam', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createPaymentLinksApp().request(
        '/payment-links/550e8400-e29b-41d4-a716-446655440010/orders'
      );

      expect(response.status).toBe(200);
      expect(mocks.manager.listPaymentLinkOrdersForRuntimeScope).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
        expectRuntimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.manager.listPaymentLinkOrders).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });
});
