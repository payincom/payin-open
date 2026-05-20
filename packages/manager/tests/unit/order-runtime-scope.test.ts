import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OPEN_ORGANIZATION_ID,
  SingleTenantContextProvider,
  tenantPaymentScope,
  type RuntimeContext,
} from '@payin/processor';
import { ConfigurationManager, orderRuntimeScopeToOrganizationId } from '../../src/manager.js';

describe('orderRuntimeScopeToOrganizationId', () => {
  it('maps the Open default single-merchant scope to DEFAULT_OPEN_ORGANIZATION_ID', () => {
    const provider = new SingleTenantContextProvider();

    expect(orderRuntimeScopeToOrganizationId(provider.getPaymentScope())).toBe(
      DEFAULT_OPEN_ORGANIZATION_ID
    );
  });

  it('maps authenticated tenant runtime context to its organization id', () => {
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-123'),
      actor: { type: 'api-key', id: 'key-123' },
      source: 'unit-test',
    };

    expect(orderRuntimeScopeToOrganizationId(runtimeContext)).toBe('tenant-org-123');
  });

  it('returns undefined for absent scope so legacy required-context handling is preserved', () => {
    expect(orderRuntimeScopeToOrganizationId(undefined)).toBeUndefined();
  });
});

describe('ConfigurationManager order runtime scope seams', () => {
  it('maps RuntimeContext to legacy organization id when getting an order', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getOrder = vi.fn(async () => ({ id: 'order-123' }));
    (manager as any).getOrder = getOrder;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-123'),
      actor: { type: 'api-key', id: 'key-123' },
      source: 'unit-test',
    };

    const result = await manager.getOrderForRuntimeScope('order-123', runtimeContext);

    expect(result).toEqual({ id: 'order-123' });
    expect(getOrder).toHaveBeenCalledWith('order-123', 'tenant-org-123');
  });

  it('maps RuntimeContext to legacy organization id when listing orders', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listOrders = vi.fn(async filters => ({ orders: [], total: 0, page: 2, limit: 10 }));
    (manager as any).listOrders = listOrders;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-456'),
      actor: { type: 'api-key', id: 'key-456' },
      source: 'unit-test',
    };

    const result = await manager.listOrdersForRuntimeScope(runtimeContext, {
      status: 'pending',
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({ orders: [], total: 0, page: 2, limit: 10 });
    expect(listOrders).toHaveBeenCalledWith({
      status: 'pending',
      page: 2,
      limit: 10,
      organizationId: 'tenant-org-456',
    });
  });

  it('maps the Open single-merchant scope when listing orders', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listOrders = vi.fn(async filters => ({ orders: [], total: 0, page: 1, limit: 20 }));
    (manager as any).listOrders = listOrders;
    const provider = new SingleTenantContextProvider();

    await manager.listOrdersForRuntimeScope(provider.getPaymentScope(), {
      orderReference: 'order-1',
    });

    expect(listOrders).toHaveBeenCalledWith({
      orderReference: 'order-1',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('maps RuntimeContext to legacy organization id when getting order statistics', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getOrderStatistics = vi.fn(async filters => ({
      totalOrders: 1,
      completedOrders: 0,
      pendingOrders: 1,
      expiredOrders: 0,
      totalAmount: '10',
      completedAmount: '0',
      avgPaymentTimeSeconds: 0,
      byStatus: { pending: 1 },
      byChain: { evm: 1 },
      byToken: { USDC: 1 },
      filters,
    }));
    (manager as any).getOrderStatistics = getOrderStatistics;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-789'),
      actor: { type: 'api-key', id: 'key-789' },
      source: 'unit-test',
    };

    await manager.getOrderStatisticsForRuntimeScope(runtimeContext, {
      chain: 'base-sepolia',
      token: 'USDC',
    });

    expect(getOrderStatistics).toHaveBeenCalledWith({
      chain: 'base-sepolia',
      token: 'USDC',
      organizationId: 'tenant-org-789',
    });
  });

  it('maps RuntimeContext to legacy organization id when getting address pool availability', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getAddressPoolAvailability = vi.fn(async () => ({
      total: 1,
      available: 1,
      allocated: 0,
      bound: 0,
      coolingDown: 0,
      archived: 0,
    }));
    (manager as any).getAddressPoolAvailability = getAddressPoolAvailability;
    const provider = new SingleTenantContextProvider();

    await manager.getAddressPoolAvailabilityForRuntimeScope(provider.getPaymentScope(), 'evm');

    expect(getAddressPoolAvailability).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, 'evm');
  });

  it('maps RuntimeContext to legacy organization id when binding a deposit address', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const bindDepositAddress = vi.fn(async request => ({
      depositReference: request.depositReference,
    }));
    (manager as any).bindDepositAddress = bindDepositAddress;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-bind'),
      actor: { type: 'api-key', id: 'key-bind' },
      source: 'unit-test',
    };

    await manager.bindDepositAddressForRuntimeScope(runtimeContext, {
      depositReference: 'customer-bind',
      protocol: 'evm',
      metadata: { tier: 'gold' },
    });

    expect(bindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-bind',
      protocol: 'evm',
      metadata: { tier: 'gold' },
      organizationId: 'tenant-org-bind',
    });
  });

  it('maps RuntimeContext to legacy organization id when unbinding a deposit address by address', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const unbindDepositAddressByAddress = vi.fn(async () => undefined);
    (manager as any).unbindDepositAddressByAddress = unbindDepositAddressByAddress;
    const provider = new SingleTenantContextProvider();

    await manager.unbindDepositAddressByAddressForRuntimeScope(provider.getPaymentScope(), {
      address: '0xabc',
      protocol: 'tron',
    });

    expect(unbindDepositAddressByAddress).toHaveBeenCalledWith({
      address: '0xabc',
      protocol: 'tron',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('maps RuntimeContext to legacy organization id when unbinding a deposit reference across supported protocols', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const unbindDepositAddress = vi.fn(async () => undefined);
    (manager as any).unbindDepositAddress = unbindDepositAddress;
    const provider = new SingleTenantContextProvider();

    await manager.unbindDepositAddressForRuntimeScope(provider.getPaymentScope(), {
      depositReference: 'customer-1',
    });

    expect(unbindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'evm',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    expect(unbindDepositAddress).toHaveBeenCalledWith({
      depositReference: 'customer-1',
      protocol: 'tron',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('maps RuntimeContext to legacy organization id when listing deposit references', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listDepositReferences = vi.fn(async filters => ({
      references: [],
      total: 0,
      page: 3,
      limit: 5,
      filters,
    }));
    (manager as any).listDepositReferences = listDepositReferences;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-deposits'),
      actor: { type: 'api-key', id: 'key-deposits' },
      source: 'unit-test',
    };

    await manager.listDepositReferencesForRuntimeScope(runtimeContext, {
      page: 3,
      limit: 5,
      search: 'customer',
    });

    expect(listDepositReferences).toHaveBeenCalledWith({
      page: 3,
      limit: 5,
      search: 'customer',
      organizationId: 'tenant-org-deposits',
    });
  });

  it('maps RuntimeContext to legacy organization id when getting a user deposit address', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getUserDepositAddress = vi.fn(async () => ({ address: '0xabc' }));
    (manager as any).getUserDepositAddress = getUserDepositAddress;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-address'),
      actor: { type: 'api-key', id: 'key-address' },
      source: 'unit-test',
    };

    await manager.getUserDepositAddressForRuntimeScope(runtimeContext, 'customer-123', 'tron');

    expect(getUserDepositAddress).toHaveBeenCalledWith(
      'tenant-org-address',
      'customer-123',
      'tron'
    );
  });

  it('maps the Open single-merchant scope when listing deposit addresses', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listDepositAddresses = vi.fn(async filters => ({
      addresses: [],
      total: 0,
      page: 1,
      limit: 20,
      filters,
    }));
    (manager as any).listDepositAddresses = listDepositAddresses;
    const provider = new SingleTenantContextProvider();

    await manager.listDepositAddressesForRuntimeScope(provider.getPaymentScope(), {
      protocol: 'evm',
      depositReference: 'customer-1',
    });

    expect(listDepositAddresses).toHaveBeenCalledWith({
      protocol: 'evm',
      depositReference: 'customer-1',
      organizationId: DEFAULT_OPEN_ORGANIZATION_ID,
    });
  });

  it('maps RuntimeContext to legacy organization id when listing transfers', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listTransfers = vi.fn(async filters => ({
      transfers: [],
      total: 0,
      page: 2,
      limit: 10,
      filters,
    }));
    (manager as any).listTransfers = listTransfers;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-transfers'),
      actor: { type: 'api-key', id: 'key-transfers' },
      source: 'unit-test',
    };

    await manager.listTransfersForRuntimeScope(runtimeContext, {
      businessType: 'deposit',
      page: 2,
      limit: 10,
    });

    expect(listTransfers).toHaveBeenCalledWith({
      businessType: 'deposit',
      page: 2,
      limit: 10,
      organizationId: 'tenant-org-transfers',
    });
  });

  it('maps the Open single-merchant scope when getting transfers by reference', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getTransfers = vi.fn(async () => [{ id: 'transfer-1' }]);
    (manager as any).getTransfers = getTransfers;
    const provider = new SingleTenantContextProvider();

    await manager.getTransfersForRuntimeScope(
      { depositReference: 'customer-1' },
      provider.getPaymentScope()
    );

    expect(getTransfers).toHaveBeenCalledWith(
      { depositReference: 'customer-1' },
      DEFAULT_OPEN_ORGANIZATION_ID
    );
  });

  it('maps RuntimeContext to legacy organization id when listing address-pool addresses', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listAddresses = vi.fn(async params => ({ addresses: [], total: 0, params }));
    (manager as any).listAddresses = listAddresses;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-pool'),
      actor: { type: 'api-key', id: 'key-pool' },
      source: 'unit-test',
    };

    await manager.listAddressesForRuntimeScope(runtimeContext, {
      protocol: 'tron',
      page: 2,
      pageSize: 10,
    });

    expect(listAddresses).toHaveBeenCalledWith({
      protocol: 'tron',
      page: 2,
      pageSize: 10,
      organizationId: 'tenant-org-pool',
    });
  });

  it('maps RuntimeContext to legacy organization id when getting address-pool summary', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getAddressPoolAvailability = vi
      .fn()
      .mockResolvedValueOnce({
        total: 2,
        available: 1,
        allocated: 1,
        bound: 0,
        coolingDown: 0,
        archived: 0,
      })
      .mockResolvedValueOnce({
        total: 1,
        available: 1,
        allocated: 0,
        bound: 0,
        coolingDown: 0,
        archived: 0,
      });
    (manager as any).getAddressPoolAvailability = getAddressPoolAvailability;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-pool-summary'),
      actor: { type: 'api-key', id: 'key-pool-summary' },
      source: 'unit-test',
    };

    const result = await manager.getAddressPoolSummaryForRuntimeScope(runtimeContext, [
      'evm',
      'tron',
    ]);

    expect(result).toMatchObject({
      totalAddresses: 3,
      totalAvailable: 2,
      hasAddresses: true,
      hasAvailableAddresses: true,
    });
    expect(getAddressPoolAvailability).toHaveBeenCalledWith('tenant-org-pool-summary', 'evm');
    expect(getAddressPoolAvailability).toHaveBeenCalledWith('tenant-org-pool-summary', 'tron');
  });

  it('maps RuntimeContext to legacy organization id when adding address-pool addresses', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const addAddressesToPool = vi.fn(async () => ({ added: 1, skipped: 0, errors: [] }));
    (manager as any).addAddressesToPool = addAddressesToPool;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-pool-add'),
      actor: { type: 'api-key', id: 'key-pool-add' },
      source: 'unit-test',
    };

    await manager.addAddressesToPoolForRuntimeScope(runtimeContext, [
      {
        address: '0xabc',
        protocol: 'evm',
        derivationIndex: 1,
        masterPublicKey: 'xpub',
      },
    ]);

    expect(addAddressesToPool).toHaveBeenCalledWith([
      {
        address: '0xabc',
        protocol: 'evm',
        derivationIndex: 1,
        masterPublicKey: 'xpub',
        organizationId: 'tenant-org-pool-add',
      },
    ]);
  });

  it('maps RuntimeContext to legacy organization id when archiving and unarchiving address-pool addresses', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const archiveAddress = vi.fn(async () => undefined);
    const unarchiveAddress = vi.fn(async () => undefined);
    (manager as any).archiveAddress = archiveAddress;
    (manager as any).unarchiveAddress = unarchiveAddress;
    const provider = new SingleTenantContextProvider();

    await manager.archiveAddressForRuntimeScope(provider.getPaymentScope(), '0xarchive');
    await manager.unarchiveAddressForRuntimeScope(provider.getPaymentScope(), '0xarchive');

    expect(archiveAddress).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, '0xarchive');
    expect(unarchiveAddress).toHaveBeenCalledWith(DEFAULT_OPEN_ORGANIZATION_ID, '0xarchive');
  });

  it('maps RuntimeContext to legacy organization id when creating a payment link', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const createPaymentLink = vi.fn(async request => ({ id: 'plink-create', request }));
    (manager as any).createPaymentLink = createPaymentLink;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-payment-links-create'),
      actor: { type: 'api-key', id: 'key-payment-links-create' },
      source: 'unit-test',
    };

    await manager.createPaymentLinkForRuntimeScope(runtimeContext, {
      title: 'Test link',
      amount: '10.00',
      currencies: [{ currency: 'USDC', chain_options: ['base-sepolia'] }] as any,
      createdBy: 'user-1',
    } as any);

    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'tenant-org-payment-links-create',
        title: 'Test link',
      })
    );
  });

  it('maps RuntimeContext to legacy organization id when listing payment links', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listPaymentLinks = vi.fn(async filters => ({
      links: [],
      total: 0,
      page: 1,
      limit: 20,
      filters,
    }));
    (manager as any).listPaymentLinks = listPaymentLinks;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-payment-links-list'),
      actor: { type: 'api-key', id: 'key-payment-links-list' },
      source: 'unit-test',
    };

    await manager.listPaymentLinksForRuntimeScope(runtimeContext, {
      status: 'published',
      page: 2,
      limit: 10,
    });

    expect(listPaymentLinks).toHaveBeenCalledWith({
      organizationId: 'tenant-org-payment-links-list',
      status: 'published',
      page: 2,
      limit: 10,
    });
  });

  it('maps the Open single-merchant scope when getting a payment link', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const getPaymentLink = vi.fn(async () => ({ id: 'plink-open' }));
    (manager as any).getPaymentLink = getPaymentLink;
    const provider = new SingleTenantContextProvider();

    await manager.getPaymentLinkForRuntimeScope('plink-open', provider.getPaymentScope());

    expect(getPaymentLink).toHaveBeenCalledWith('plink-open', DEFAULT_OPEN_ORGANIZATION_ID);
  });
  it('maps RuntimeContext to legacy organization id when updating payment links', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const updatePaymentLink = vi.fn(async () => ({ id: 'plink-123' }));
    (manager as any).updatePaymentLink = updatePaymentLink;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-payment-links'),
      actor: { type: 'api-key', id: 'key-payment-links' },
      source: 'unit-test',
    };

    await manager.updatePaymentLinkForRuntimeScope('plink-123', runtimeContext, {
      title: 'Updated payment link',
    });

    expect(updatePaymentLink).toHaveBeenCalledWith('plink-123', 'tenant-org-payment-links', {
      title: 'Updated payment link',
    });
  });

  it('maps the Open single-merchant scope when publishing payment links', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const publishPaymentLink = vi.fn(async () => ({ id: 'plink-123', status: 'published' }));
    (manager as any).publishPaymentLink = publishPaymentLink;
    const provider = new SingleTenantContextProvider();

    await manager.publishPaymentLinkForRuntimeScope(
      'plink-123',
      provider.getPaymentScope(),
      'open-link'
    );

    expect(publishPaymentLink).toHaveBeenCalledWith(
      'plink-123',
      DEFAULT_OPEN_ORGANIZATION_ID,
      'open-link'
    );
  });

  it('maps RuntimeContext to legacy organization id when listing payment-link orders', async () => {
    const manager = Object.create(ConfigurationManager.prototype) as ConfigurationManager;
    const listPaymentLinkOrders = vi.fn(async () => []);
    (manager as any).listPaymentLinkOrders = listPaymentLinkOrders;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-orders'),
      actor: { type: 'api-key', id: 'key-orders' },
      source: 'unit-test',
    };

    await manager.listPaymentLinkOrdersForRuntimeScope('plink-123', runtimeContext);

    expect(listPaymentLinkOrders).toHaveBeenCalledWith('plink-123', 'tenant-org-orders');
  });
});
