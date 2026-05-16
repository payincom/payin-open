import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import { OpenManager } from '../../src/open/open-manager.js';

function createFakeManager() {
  return {
    createOrder: vi.fn(async (request) => ({ id: 'order-id', ...request })),
    getOrder: vi.fn(async () => ({ id: 'order-id' })),
    listOrders: vi.fn(async () => ({ orders: [], total: 0, page: 1, limit: 20 })),
    getOrderStatistics: vi.fn(async () => ({})),
    bindDepositAddress: vi.fn(async (request) => ({ address: '0xabc', ...request })),
    getUserDepositAddress: vi.fn(async () => ({ address: '0xabc' })),
    listDepositReferences: vi.fn(async () => ({ references: [], total: 0, page: 1, limit: 20 })),
    listDepositAddresses: vi.fn(async () => ({ addresses: [], total: 0, page: 1, limit: 20 })),
    listTransfers: vi.fn(async () => ({ transfers: [], total: 0, page: 1, limit: 20 })),
    getAddressPoolAvailability: vi.fn(async () => ({ total: 0, available: 0, allocated: 0, bound: 0, coolingDown: 0, archived: 0 })),
    listAddresses: vi.fn(async () => ({ addresses: [], total: 0 })),
    addAddressesToPool: vi.fn(async () => ({ added: 1, skipped: 0, errors: [] })),
    archiveAddress: vi.fn(async () => undefined),
    unarchiveAddress: vi.fn(async () => undefined),
    createPaymentLink: vi.fn(async (request) => ({ id: 'plink-id', ...request })),
    updatePaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    publishPaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    unpublishPaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    archivePaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    restorePaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    listPaymentLinks: vi.fn(async () => ({ links: [], total: 0, page: 1, limit: 20 })),
    getPaymentLink: vi.fn(async () => ({ id: 'plink-id' })),
    listPaymentLinkOrders: vi.fn(async () => []),
    updatePaymentLinkCurrencies: vi.fn(async () => ({ id: 'plink-id' })),
  } as any;
}

describe('OpenManager', () => {
  it('injects the default Open organization for order operations', async () => {
    const fake = createFakeManager();
    const open = new OpenManager(fake);

    await open.createOrder({ orderReference: 'order-1', amount: '10', currency: 'USDC', chainId: 'ethereum-sepolia' });
    await open.getOrder('order-id');
    await open.listOrders({ status: 'pending' });

    expect(fake.createOrder).toHaveBeenCalledWith({
      orderReference: 'order-1',
      amount: '10',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    expect(fake.getOrder).toHaveBeenCalledWith('order-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.listOrders).toHaveBeenCalledWith({ status: 'pending', organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
  });

  it('injects the default Open organization for deposits and address pool', async () => {
    const fake = createFakeManager();
    const open = new OpenManager(fake);

    await open.bindDepositAddress({ depositReference: 'customer-1', protocol: 'evm' });
    await open.getUserDepositAddress('customer-1', 'evm');
    await open.getAddressPoolAvailability('evm');
    await open.addAddressesToPool([{ address: '0x0000000000000000000000000000000000000001', protocol: 'evm', derivationIndex: 1, masterPublicKey: 'xpub' }]);

    expect(fake.bindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'evm',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    expect(fake.getUserDepositAddress).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, 'customer-1', 'evm');
    expect(fake.getAddressPoolAvailability).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, 'evm');
    expect(fake.addAddressesToPool).toHaveBeenCalledWith([{
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
      address: '0x0000000000000000000000000000000000000001',
      protocol: 'evm',
      derivationIndex: 1,
      masterPublicKey: 'xpub',
    }]);
  });

  it('injects the default Open organization for payment link operations', async () => {
    const fake = createFakeManager();
    const open = new OpenManager(fake);
    const paymentLinkInput = {
      title: 'Test link',
      amount: '10',
      currencies: [{ currency: 'USDC', chain_options: ['ethereum-sepolia'] }],
    } as any;

    await open.createPaymentLink(paymentLinkInput);
    await open.updatePaymentLink('plink-id', { title: 'Updated' });
    await open.publishPaymentLink('plink-id', 'slug');
    await open.unpublishPaymentLink('plink-id');
    await open.archivePaymentLink('plink-id');
    await open.restorePaymentLink('plink-id');
    await open.listPaymentLinks({ status: 'draft' } as any);
    await open.getPaymentLink('plink-id');
    await open.listPaymentLinkOrders('plink-id');
    await open.updatePaymentLinkCurrencies('plink-id', { currencies: [] });

    expect(fake.createPaymentLink).toHaveBeenCalledWith({
      ...paymentLinkInput,
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    expect(fake.updatePaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID, { title: 'Updated' });
    expect(fake.publishPaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID, 'slug');
    expect(fake.unpublishPaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.archivePaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.restorePaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.listPaymentLinks).toHaveBeenCalledWith({ status: 'draft', organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
    expect(fake.getPaymentLink).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.listPaymentLinkOrders).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.updatePaymentLinkCurrencies).toHaveBeenCalledWith('plink-id', DEFAULT_OPEN_ORGANIZATION_ID, { currencies: [] });
  });
});
