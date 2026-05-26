import { Processor } from '../processor.js';
import type { ProcessorConfig } from '../core/processor-config-manager.js';
import type { ConfigProvider } from '@payin/shared';
import type { CreateOrderRequest, CreateOrderResponse } from '../services/order-service.js';
import type {
  BindAddressRequest,
  BindAddressResponse,
  UnbindAddressRequest,
} from '../services/deposit-service.js';
import { paymentScopeToOrganizationId, type PaymentScope } from '../context/payment-scope.js';
import {
  SingleTenantContextProvider,
  type RuntimeContextProvider,
} from '../context/runtime-context.js';

/**
 * Built-in merchant organization id used by PayIn Open.
 *
 * The current processor persistence layer still stores organization_id for
 * compatibility with PayIn Cloud. PayIn Open hides that detail behind this
 * facade so self-hosted operators do not have to think in SaaS tenancy terms.
 */
export const DEFAULT_OPEN_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

export interface OpenProcessorOptions {
  /** Internal compatibility organization id. Defaults to the built-in Open merchant organization id. */
  organizationId?: string;
  /** Display name for the compatibility organization row. */
  organizationName?: string;
  /** Runtime context provider. Defaults to the PayIn Open single-tenant provider. */
  contextProvider?: RuntimeContextProvider;
  /** Slug for the compatibility organization row. */
  organizationSlug?: string;
}

export type OpenProtocol = 'evm' | 'tron' | 'solana';
export type OpenCreateOrderRequest = Omit<CreateOrderRequest, 'organizationId'>;
export type OpenBindAddressRequest = Omit<BindAddressRequest, 'organizationId'>;
export type OpenUnbindAddressRequest = Omit<UnbindAddressRequest, 'organizationId'>;

/**
 * Single-organization facade over Processor.
 *
 * This is the intended PayIn Open public surface for operations that currently
 * require organizationId in the lower-level Processor API. Cloud can continue
 * using Processor directly with explicit organization context.
 */
export class OpenProcessor {
  readonly organizationId: string;
  readonly paymentScope: PaymentScope;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly contextProvider: RuntimeContextProvider;

  constructor(
    private readonly processor: Processor,
    options: OpenProcessorOptions = {}
  ) {
    this.contextProvider =
      options.contextProvider ??
      new SingleTenantContextProvider({
        scopeId: options.organizationId ?? DEFAULT_OPEN_ORGANIZATION_ID,
        scopeLabel: options.organizationName,
      });
    this.paymentScope = this.contextProvider.getPaymentScope();
    this.organizationId = paymentScopeToOrganizationId(this.paymentScope);
    this.organizationName =
      options.organizationName ?? this.paymentScope.label ?? 'PayIn Open Merchant';
    this.organizationSlug = options.organizationSlug ?? 'payin-open-merchant';
  }

  static async create(
    config: ProcessorConfig = {},
    configFile?: string,
    configProvider?: ConfigProvider,
    options: OpenProcessorOptions = {}
  ): Promise<OpenProcessor> {
    const processor = await Processor.create(config, configFile, configProvider);
    return new OpenProcessor(processor, options);
  }

  get rawProcessor(): Processor {
    return this.processor;
  }

  getEventBus() {
    return this.processor.getEventBus();
  }

  start(): Promise<void> {
    return this.processor.start();
  }

  stop(): Promise<void> {
    return this.processor.stop();
  }

  /**
   * Ensure the internal compatibility organization exists.
   *
   * Call this after database schema initialization in self-hosted setup flows.
   * It is idempotent and intentionally keeps tenancy details internal to Open.
   */
  async ensureSingleMerchantOrganization(): Promise<void> {
    const database = this.processor.getDatabase();
    await database.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         updated_at = NOW()`,
      [this.organizationId, this.organizationName, this.organizationSlug]
    );
  }

  async checkDatabaseSchema(): Promise<{
    isComplete: boolean;
    missingTables: string[];
    existingTables: string[];
    requiredTables: string[];
  }> {
    return this.processor.checkDatabaseSchema();
  }

  async initializeDatabaseSchema(options?: {
    dropExisting?: boolean;
    onlyMissing?: boolean;
    seedData?: boolean;
    force?: boolean;
  }) {
    const result = await this.processor.initializeDatabaseSchema(options);
    if (result.success) {
      await this.ensureSingleMerchantOrganization();
    }
    return result;
  }

  createOrder(request: OpenCreateOrderRequest): Promise<CreateOrderResponse> {
    return this.processor.createOrder({
      ...request,
      organizationId: this.organizationId,
    });
  }

  getOrder(orderId: string): Promise<any | null> {
    return this.processor.getOrder(orderId, this.organizationId);
  }

  bindDepositAddress(request: OpenBindAddressRequest): Promise<BindAddressResponse> {
    return this.processor.bindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    });
  }

  unbindDepositAddress(request: OpenUnbindAddressRequest): Promise<void> {
    return this.processor.unbindDepositAddress({
      ...request,
      organizationId: this.organizationId,
    });
  }

  unbindDepositAddressByAddress(request: {
    address: string;
    protocol: OpenProtocol;
  }): Promise<void> {
    return this.processor.unbindDepositAddressByAddress({
      organizationId: this.organizationId,
      ...request,
    });
  }

  listDepositReferences(filters: { page?: number; limit?: number; search?: string } = {}) {
    return this.processor.listDepositReferences({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getUserDepositAddress(depositReference: string, protocol: OpenProtocol = 'evm'): Promise<any> {
    return this.processor.getUserDepositAddress(this.organizationId, depositReference, protocol);
  }

  listAddresses(params: { protocol?: OpenProtocol; page?: number; pageSize?: number } = {}) {
    return this.processor.listAddresses({
      organizationId: this.organizationId,
      ...params,
    });
  }

  getAddressPoolAvailability(protocol: OpenProtocol = 'evm') {
    return this.processor.getAddressPoolAvailability(this.organizationId, protocol);
  }

  addAddressesToPool(
    addresses: Array<{
      address: string;
      protocol: OpenProtocol;
      masterPublicKey?: string | null;
      derivationIndex?: number | null;
    }>
  ): Promise<void> {
    return this.processor.addAddressesToPool(
      addresses.map(address => ({
        organizationId: this.organizationId,
        ...address,
      }))
    );
  }

  archiveAddress(address: string): Promise<void> {
    return this.processor.archiveAddress(this.organizationId, address);
  }

  unarchiveAddress(address: string): Promise<void> {
    return this.processor.unarchiveAddress(this.organizationId, address);
  }

  getTransfers(reference: { orderId?: string; depositReference?: string }) {
    return this.processor.getTransfers(reference, this.organizationId);
  }

  getTransferByTxHash(txHash: string) {
    return this.processor.getTransferByTxHash(txHash, this.organizationId);
  }

  listOrders(filters: Parameters<Processor['listOrders']>[0] = {}) {
    return this.processor.listOrders({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getOrderStatistics(
    filters: { chain?: string; token?: string; createdAfter?: Date; createdBefore?: Date } = {}
  ) {
    return this.processor.getOrderStatistics({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  listTransfers(
    filters: {
      orderId?: string;
      depositReference?: string;
      businessType?: 'order' | 'deposit';
      chain?: string;
      token?: string;
      isConfirmed?: boolean;
      isFailed?: boolean;
      detectedAfter?: Date;
      detectedBefore?: Date;
      page?: number;
      limit?: number;
      sortBy?: 'detected_at' | 'confirmed_at' | 'amount';
      sortOrder?: 'ASC' | 'DESC';
    } = {}
  ) {
    return this.processor.listTransfers({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  listDepositAddresses(
    filters: {
      protocol?: 'evm' | 'tron';
      depositReference?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    return this.processor.listDepositAddresses({
      ...filters,
      organizationId: this.organizationId,
    });
  }

  getSystemStatus() {
    return this.processor.getSystemStatus();
  }
}
