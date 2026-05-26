import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const manager = {
    getDepositByAddress: vi.fn(),
    getUserDepositAddress: vi.fn(),
  };

  return { manager };
});

vi.mock('../src/manager-instance.js', () => ({
  getManager: () => mocks.manager,
}));

const { default: payDepositRoutes } = await import('../src/routes/pay-deposit.js');

function createApp() {
  const app = new Hono();
  app.route('/pay/deposit', payDepositRoutes);
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

function boundDeposit(overrides: Record<string, unknown> = {}) {
  return {
    address: '0x6B53b9959905D6E1F7970213A0A103E2826F81d8',
    protocol: 'evm',
    state: 'bound',
    deposit_reference: 'customer-123',
    metadata: { title: 'Customer deposit' },
    ...overrides,
  };
}

describe('pay deposit hosted page route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.getDepositByAddress.mockResolvedValue(null);
    mocks.manager.getUserDepositAddress.mockResolvedValue(null);
  });

  it('serves the hosted page by globally unique address', async () => {
    mocks.manager.getDepositByAddress.mockResolvedValue(boundDeposit());

    const response = await createApp().request('/pay/deposit/0x6B53b9959905D6E1F7970213A0A103E2826F81d8');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.manager.getDepositByAddress).toHaveBeenCalledWith('0x6B53b9959905D6E1F7970213A0A103E2826F81d8');
    expect(mocks.manager.getUserDepositAddress).not.toHaveBeenCalled();
    expect(html).toContain('deposit-payment-root');
    expect(html).toContain('customer-123');
  });

  it('serves PayIn Open hosted page by deposit reference and protocol query', async () => {
    const restoreRuntime = setRuntime('open');
    mocks.manager.getUserDepositAddress.mockResolvedValue(boundDeposit());

    try {
      const response = await createApp().request('/pay/deposit/customer-123?protocol=evm');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(mocks.manager.getDepositByAddress).toHaveBeenCalledWith('customer-123');
      expect(mocks.manager.getUserDepositAddress).toHaveBeenCalledWith(
        DEFAULT_OPEN_ORGANIZATION_ID,
        'customer-123',
        'evm'
      );
      expect(html).toContain('deposit-payment-root');
      expect(html).toContain('0x6B53b9959905D6E1F7970213A0A103E2826F81d8');
    } finally {
      restoreRuntime();
    }
  });

  it('does not resolve reference-style URLs in non-Open runtime', async () => {
    const restoreRuntime = setRuntime('cloud');

    try {
      const response = await createApp().request('/pay/deposit/customer-123?protocol=evm');

      expect(response.status).toBe(404);
      expect(mocks.manager.getDepositByAddress).toHaveBeenCalledWith('customer-123');
      expect(mocks.manager.getUserDepositAddress).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });
});
