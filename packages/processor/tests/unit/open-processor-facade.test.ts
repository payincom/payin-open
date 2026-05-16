import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID, OpenProcessor } from '../../src/open/open-processor.js';

function createFakeProcessor() {
  return {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    createOrder: vi.fn(async (request) => ({ id: 'order-id', ...request })),
    getOrder: vi.fn(async () => ({ id: 'order-id' })),
    bindDepositAddress: vi.fn(async (request) => ({ address: '0xabc', ...request })),
    unbindDepositAddress: vi.fn(async () => undefined),
    unbindDepositAddressByAddress: vi.fn(async () => undefined),
    listDepositReferences: vi.fn(async () => ({ references: [], total: 0, page: 1, limit: 20 })),
    getUserDepositAddress: vi.fn(async () => ({ address: '0xabc' })),
    listAddresses: vi.fn(async () => ({ addresses: [], total: 0 })),
    getAddressPoolAvailability: vi.fn(async () => ({ total: 0, available: 0, allocated: 0, bound: 0, coolingDown: 0, archived: 0 })),
    addAddressesToPool: vi.fn(async () => undefined),
    archiveAddress: vi.fn(async () => undefined),
    unarchiveAddress: vi.fn(async () => undefined),
    getTransfers: vi.fn(async () => []),
    getTransferByTxHash: vi.fn(async () => null),
    listOrders: vi.fn(async () => ({ orders: [], total: 0, page: 1, limit: 20 })),
    getOrderStatistics: vi.fn(async () => ({})),
    listTransfers: vi.fn(async () => ({ transfers: [], total: 0, page: 1, limit: 20 })),
    listDepositAddresses: vi.fn(async () => ({ addresses: [], total: 0, page: 1, limit: 20 })),
    getSystemStatus: vi.fn(() => ({ isStarted: true })),
    getDatabase: vi.fn(() => ({ query: vi.fn(async () => []) })),
    checkDatabaseSchema: vi.fn(async () => ({ isComplete: true, missingTables: [], existingTables: [], requiredTables: [] })),
    initializeDatabaseSchema: vi.fn(async () => ({ success: true, errors: [], warnings: [], createdTables: [], upgradedTables: [], seedDataResults: [], summary: 'ok' })),
  } as any;
}

describe('OpenProcessor', () => {
  it('uses the default single-merchant organization id', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    expect(open.organizationId).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
    expect(open.paymentScope).toEqual({
      id: DEFAULT_OPEN_ORGANIZATION_ID,
      kind: 'single-merchant',
      label: 'PayIn Open Merchant',
    });

    await open.getUserDepositAddress('user-123', 'evm');
    expect(fake.getUserDepositAddress).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, 'user-123', 'evm');
  });

  it('allows a custom internal organization id without exposing it in method signatures', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake, { organizationId: '11111111-1111-1111-1111-111111111111' });

    await open.getAddressPoolAvailability('tron');

    expect(fake.getAddressPoolAvailability).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'tron');
  });

  it('injects organization id when adding address pool entries', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    await open.addAddressesToPool([
      { address: '0x0000000000000000000000000000000000000001', protocol: 'evm', derivationIndex: 7 },
    ]);

    expect(fake.addAddressesToPool).toHaveBeenCalledWith([
      {
        organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
        address: '0x0000000000000000000000000000000000000001',
        protocol: 'evm',
        derivationIndex: 7,
      },
    ]);
  });

  it('injects organization id into listing and stats filters', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    await open.listDepositReferences({ search: 'alice' });
    await open.listAddresses({ protocol: 'evm', page: 2 });
    await open.getOrderStatistics({ chain: 'ethereum-sepolia' });
    await open.listTransfers({ businessType: 'order', limit: 10 });
    await open.listDepositAddresses({ protocol: 'tron' });

    expect(fake.listDepositReferences).toHaveBeenCalledWith({ search: 'alice', organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
    expect(fake.listAddresses).toHaveBeenCalledWith({ organizationId: DEFAULT_OPEN_ORGANIZATION_ID, protocol: 'evm', page: 2 });
    expect(fake.getOrderStatistics).toHaveBeenCalledWith({ chain: 'ethereum-sepolia', organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
    expect(fake.listTransfers).toHaveBeenCalledWith({ businessType: 'order', limit: 10, organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
    expect(fake.listDepositAddresses).toHaveBeenCalledWith({ protocol: 'tron', organizationId: DEFAULT_OPEN_ORGANIZATION_ID });
  });


  it('initializes schema and ensures the default merchant organization', async () => {
    const fake = createFakeProcessor();
    const db = { query: vi.fn(async () => []) };
    fake.getDatabase.mockReturnValue(db);
    const open = new OpenProcessor(fake);

    await open.initializeDatabaseSchema({ onlyMissing: true });

    expect(fake.initializeDatabaseSchema).toHaveBeenCalledWith({ onlyMissing: true });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organizations'),
      [DEFAULT_OPEN_ORGANIZATION_ID, 'PayIn Open Merchant', 'payin-open-merchant']
    );
  });

  it('does not seed organization when schema initialization fails', async () => {
    const fake = createFakeProcessor();
    const db = { query: vi.fn(async () => []) };
    fake.getDatabase.mockReturnValue(db);
    fake.initializeDatabaseSchema.mockResolvedValueOnce({ success: false, errors: ['boom'], warnings: [], createdTables: [], upgradedTables: [], seedDataResults: [], summary: 'failed' });
    const open = new OpenProcessor(fake);

    await open.initializeDatabaseSchema();

    expect(db.query).not.toHaveBeenCalled();
  });

  it('injects organization id when creating orders', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    await open.createOrder({
      orderReference: 'order-1',
      amount: '10',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
    });

    expect(fake.createOrder).toHaveBeenCalledWith({
      orderReference: 'order-1',
      amount: '10',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('injects organization id when binding and unbinding deposit addresses', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    await open.bindDepositAddress({ depositReference: 'customer-1', protocol: 'evm' });
    await open.unbindDepositAddress({ depositReference: 'customer-1', protocol: 'evm' });

    expect(fake.bindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'evm',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    expect(fake.unbindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'evm',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('forwards tenant-neutral operations directly', async () => {
    const fake = createFakeProcessor();
    const open = new OpenProcessor(fake);

    await open.getTransfers({ orderId: 'order-id' });
    await open.getTransferByTxHash('0xtx');
    open.getSystemStatus();

    expect(fake.getTransfers).toHaveBeenCalledWith({ orderId: 'order-id' }, DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.getTransferByTxHash).toHaveBeenCalledWith('0xtx', DEFAULT_OPEN_ORGANIZATION_ID);
    expect(fake.getSystemStatus).toHaveBeenCalledOnce();
  });
});
