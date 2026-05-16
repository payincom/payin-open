import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import type { ConfigurationManager } from '../manager.js';

export interface OpenManagerOptions {
  /** Internal compatibility organization id. Defaults to DEFAULT_OPEN_ORGANIZATION_ID. */
  organizationId?: string;
}

export type OpenCreateOrderInput = {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
};

export type OpenBindDepositAddressInput = {
  depositReference: string;
  protocol: 'evm' | 'tron' | 'solana';
  callbackUrl?: string;
  metadata?: Record<string, any>;
};

/**
 * PayIn Open-facing manager facade.
 *
 * The underlying ConfigurationManager still supports Cloud-style explicit
 * organizations for compatibility. This facade is the Open boundary for
 * single-merchant self-hosted API/Skill/CLI code: it injects the internal
 * Open merchant scope and keeps SaaS tenant concepts out of Open callers.
 */
export class OpenManager {
  readonly organizationId: string;

  constructor(
    private readonly manager: ConfigurationManager,
    options: OpenManagerOptions = {}
  ) {
    this.organizationId = options.organizationId ?? DEFAULT_OPEN_ORGANIZATION_ID;
  }

  get rawManager(): ConfigurationManager {
    return this.manager;
  }

  createOrder(request: OpenCreateOrderInput): Promise<any> {
    return this.manager.createOrder({
      ...request,
      organizationId: this.organizationId,
    });
  }

  getOrder(orderId: string): Promise<any> {
    return this.manager.getOrder(orderId, this.organizationId);
  }

  listOrders(filters: Omit<Parameters<ConfigurationManager['listOrders']>[0], 'organizationId'> = {}) {
    return this.manager.listOrders({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getOrderStatistics(filters: Omit<Parameters<ConfigurationManager['getOrderStatistics']>[0], 'organizationId'> = {}) {
    return this.manager.getOrderStatistics({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  bindDepositAddress(request: OpenBindDepositAddressInput): Promise<any> {
    return this.manager.bindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    } as any);
  }

  getUserDepositAddress(depositReference: string, protocol: 'evm' | 'tron' | 'solana' = 'evm'): Promise<any> {
    return this.manager.getUserDepositAddress(this.organizationId, depositReference, protocol);
  }

  listDepositReferences(filters: Omit<Parameters<ConfigurationManager['listDepositReferences']>[0], 'organizationId'> = {}) {
    return this.manager.listDepositReferences({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  listDepositAddresses(filters: Omit<Parameters<ConfigurationManager['listDepositAddresses']>[0], 'organizationId'> = {}) {
    return this.manager.listDepositAddresses({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  listTransfers(filters: Omit<Parameters<ConfigurationManager['listTransfers']>[0], 'organizationId'> = {}) {
    return this.manager.listTransfers({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getAddressPoolAvailability(protocol: 'evm' | 'tron' | 'solana' = 'evm') {
    return this.manager.getAddressPoolAvailability(this.organizationId, protocol);
  }

  listAddresses(params: Omit<Parameters<ConfigurationManager['listAddresses']>[0], 'organizationId'> = {}) {
    return this.manager.listAddresses({
      ...params,
      organizationId: this.organizationId,
    });
  }

  addAddressesToPool(addresses: Array<{
    address: string;
    derivationIndex: number;
    protocol: 'evm' | 'tron' | 'solana';
    masterPublicKey: string;
  }>) {
    return this.manager.addAddressesToPool(addresses.map((address) => ({
      ...address,
      organizationId: this.organizationId,
    })));
  }

  archiveAddress(address: string): Promise<void> {
    return this.manager.archiveAddress(this.organizationId, address);
  }

  unarchiveAddress(address: string): Promise<void> {
    return this.manager.unarchiveAddress(this.organizationId, address);
  }

  createPaymentLink(request: Parameters<ConfigurationManager['createPaymentLink']>[0]) {
    return this.manager.createPaymentLink({
      ...request,
      organizationId: this.organizationId,
    } as any);
  }

  updatePaymentLink(
    paymentLinkId: string,
    updates: Parameters<ConfigurationManager['updatePaymentLink']>[2]
  ) {
    return this.manager.updatePaymentLink(paymentLinkId, this.organizationId, updates);
  }

  publishPaymentLink(paymentLinkId: string, slug?: string) {
    return this.manager.publishPaymentLink(paymentLinkId, this.organizationId, slug);
  }

  unpublishPaymentLink(paymentLinkId: string) {
    return this.manager.unpublishPaymentLink(paymentLinkId, this.organizationId);
  }

  archivePaymentLink(paymentLinkId: string) {
    return this.manager.archivePaymentLink(paymentLinkId, this.organizationId);
  }

  restorePaymentLink(paymentLinkId: string) {
    return this.manager.restorePaymentLink(paymentLinkId, this.organizationId);
  }

  listPaymentLinks(filters: Omit<Parameters<ConfigurationManager['listPaymentLinks']>[0], 'organizationId'> = {}) {
    return this.manager.listPaymentLinks({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getPaymentLink(paymentLinkId: string) {
    return this.manager.getPaymentLink(paymentLinkId, this.organizationId);
  }

  listPaymentLinkOrders(paymentLinkId: string) {
    return this.manager.listPaymentLinkOrders(paymentLinkId, this.organizationId);
  }

  updatePaymentLinkCurrencies(
    paymentLinkId: string,
    input: Parameters<ConfigurationManager['updatePaymentLinkCurrencies']>[2]
  ) {
    return this.manager.updatePaymentLinkCurrencies(paymentLinkId, this.organizationId, input);
  }
}
