/**
 * Refactored Processor - Facade over ProcessorCore
 * This class provides the same external API as the original Processor
 * while using the new modular architecture internally.
 */

import { ProcessorCore, type SystemStatus } from './core/processor-core.js';
import { type ProcessorConfig } from './core/processor-config-manager.js';
import { loadConfig, deepMerge } from './core/config-loader.js';
import type { CreateOrderRequest, CreateOrderResponse } from './services/order-service.js';
import type { BindAddressRequest, BindAddressResponse, UnbindAddressRequest } from './services/deposit-service.js';
import { PostgreSQLDatabase } from './database/database.js';
import { ValidationUtils, ValidationError, ServiceUnavailableError } from './shared/index.js';
import { type ConfigProvider } from '@payin/shared';
import { ProcessorEventBus, ProcessorEventName, type EventHandler } from './core/processor-event-bus.js';
import { AddressPoolRepository } from './repositories/address-pool.repository.js';

// Export types
export type { ProcessorConfig, SystemStatus };
export { ProcessorEventName };
export type { EventHandler };

/**
 * Processor class - Facade over ProcessorCore
 */
export class Processor {
  private processorCore?: ProcessorCore;
  private readonly originalConfig: ProcessorConfig;

  private constructor(config: ProcessorConfig) {
    this.originalConfig = config;
  }

  /**
   * Create a new Processor instance
   *
   * Configuration priority (low to high):
   * 1. Built-in defaults (in ProcessorConfigManager)
   * 2. Default config file (config/default.yaml)
   * 3. Custom config file (if configFile provided)
   * 4. Provided config parameter (highest priority)
   *
   * @param config - Processor configuration
   * @param configFile - Optional path to custom config file
   * @param configProvider - Optional ConfigProvider for dynamic business configuration
   */
  static async create(
    config: ProcessorConfig = {},
    configFile?: string,
    configProvider?: ConfigProvider
  ): Promise<Processor> {
    // Load configuration from files
    const fileConfig = await loadConfig({ configFile });

    // Merge file config with provided config (provided config takes precedence)
    const mergedConfig: ProcessorConfig = {
      ...fileConfig,
      ...config,
      // Deep merge nested objects
      database: deepMerge(fileConfig.database, config.database),
      monitor: deepMerge(fileConfig.monitor, config.monitor),
      orders: deepMerge(fileConfig.orders, config.orders),
      delayedConfirmation: deepMerge(fileConfig.delayedConfirmation, config.delayedConfirmation),
      deposits: deepMerge(fileConfig.deposits, config.deposits),
      // Shallow merge for chains and tokens - custom config completely replaces defaults
      // This allows environment-specific configs to define only the chains/tokens they need
      chains: config.chains || fileConfig.chains,
      tokens: config.tokens || fileConfig.tokens
    };

    const processor = new Processor(mergedConfig);
    processor.processorCore = await ProcessorCore.create(mergedConfig, configProvider);
    return processor;
  }


  /**
   * Start the processor
   */
  async start(): Promise<void> {
    this.validateProcessorCore();
    await this.processorCore!.start();
  }

  /**
   * Stop the processor
   */
  async stop(): Promise<void> {
    this.validateProcessorCore();
    await this.processorCore!.stop();
  }

  /**
   * Create a new order
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    this.validateProcessorCore();

    const systemStatus = this.processorCore!.getSystemStatus();

    if (!systemStatus.isStarted) {
      throw new ServiceUnavailableError('Processor', { reason: 'not_started' });
    }

    if (systemStatus.isRecovering) {
      throw new ServiceUnavailableError('OrderService', {
        reason: 'recovery_mode',
        message: 'Order creation disabled during monitor recovery. Please wait for recovery to complete.'
      });
    }

    // Validate request
    const validationResults = [
      ValidationUtils.validateRequired(request.orderReference, 'orderReference'),
      ValidationUtils.validateAmount(request.amount),
      ValidationUtils.validateRequired(request.currency, 'currency'),
      ValidationUtils.validateRequired(request.chainId, 'chainId')
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid order request: ${combinedValidation.errors.join(', ')}`);
    }

    const orderService = this.processorCore!.getOrderService();
    return await orderService.createOrder(request, 'system');
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, organizationId?: string): Promise<any | null> {
    this.validateProcessorCore();

    const validation = ValidationUtils.validateUUID(orderId);
    if (!validation.isValid) {
      throw new ValidationError(`Invalid order ID: ${validation.errors.join(', ')}`);
    }

    const orderService = this.processorCore!.getOrderService();
    return await orderService.getOrder(orderId, organizationId);
  }

  /**
   * Bind address for user deposits
   */
  async bindDepositAddress(request: BindAddressRequest): Promise<BindAddressResponse> {
    this.validateProcessorCore();

    const systemStatus = this.processorCore!.getSystemStatus();

    if (systemStatus.isRecovering) {
      throw new ServiceUnavailableError('DepositService', {
        reason: 'recovery_mode',
        message: 'Address binding disabled during monitor recovery.'
      });
    }

    // Validate request
    const validationResults = [
      ValidationUtils.validateRequired(request.depositReference, 'depositReference'),
      ValidationUtils.validateRequired(request.protocol, 'protocol')
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid bind request: ${combinedValidation.errors.join(', ')}`);
    }

    if (!['evm', 'tron', 'solana'].includes(request.protocol)) {
      throw new ValidationError('Chain family must be either "evm", "tron", or "solana"');
    }

    const depositService = this.processorCore!.getDepositService();
    return await depositService.bindDepositAddress(request);
  }

  /**
   * Unbind address for user deposits
   */
  async unbindDepositAddress(request: UnbindAddressRequest): Promise<void> {
    this.validateProcessorCore();

    const validation = ValidationUtils.validateRequired(request.depositReference, 'depositReference');
    if (!validation.isValid) {
      throw new ValidationError(`Invalid unbind request: ${validation.errors.join(', ')}`);
    }

    const depositService = this.processorCore!.getDepositService();
    return await depositService.unbindDepositAddress(request);
  }

  /**
   * Unbind address by address (not by depositReference)
   */
  async unbindDepositAddressByAddress(request: {
    organizationId: string;
    address: string;
    protocol: 'evm' | 'tron' | 'solana';
  }): Promise<void> {
    this.validateProcessorCore();

    const validationResults = [
      ValidationUtils.validateRequired(request.organizationId, 'organizationId'),
      ValidationUtils.validateRequired(request.address, 'address'),
      ValidationUtils.validateRequired(request.protocol, 'protocol')
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid unbind request: ${combinedValidation.errors.join(', ')}`);
    }

    if (!['evm', 'tron', 'solana'].includes(request.protocol)) {
      throw new ValidationError('Protocol must be either "evm", "tron", or "solana"');
    }

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.unbindAddressByAddress(request.organizationId, request.address, request.protocol);
  }

  /**
   * List deposit references with statistics
   */
  async listDepositReferences(filters: {
    organizationId?: string; // Multi-tenant filtering
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{
    references: Array<{
      depositReference: string;
      protocols: string[];
      addressCount: number;
      totalDeposits: number;
      totalAmount: Record<string, number>;
      lastDepositAt: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    this.validateProcessorCore();

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.listDepositReferences(filters);
  }

  /**
   * Get transfers for order or deposit reference
   */
  async getTransfers(reference: { orderId?: string; depositReference?: string }, organizationId?: string): Promise<any[]> {
    this.validateProcessorCore();

    const repository = this.processorCore!.getTransferRepository();

    if (reference.orderId) {
      const validation = ValidationUtils.validateUUID(reference.orderId);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid order ID: ${validation.errors.join(', ')}`);
      }

      return await repository.findByOrderId(reference.orderId, organizationId);
    }

    if (reference.depositReference) {
      const validation = ValidationUtils.validateRequired(reference.depositReference, 'depositReference');
      if (!validation.isValid) {
        throw new ValidationError(`Invalid deposit reference: ${validation.errors.join(', ')}`);
      }

      return await repository.findByDepositReference(reference.depositReference, organizationId);
    }

    return [];
  }

  /**
   * Get transfer by transaction hash
   */
  async getTransferByTxHash(txHash: string, organizationId?: string): Promise<any | null> {
    this.validateProcessorCore();

    const validation = ValidationUtils.validateRequired(txHash, 'transactionHash');
    if (!validation.isValid) {
      throw new ValidationError(`Invalid transaction hash: ${validation.errors.join(', ')}`);
    }

    const repository = this.processorCore!.getTransferRepository();
    const transfers = await repository.findByTransactionHash(txHash, organizationId);

    // Return the first transfer (usually there's only one per tx hash)
    return transfers.length > 0 ? transfers[0] : null;
  }

  /**
   * Get user deposit address
   * @param organizationId - Organization ID for multi-tenant filtering
   * @param depositReference - Deposit reference ID
   * @param protocol - Protocol (evm, tron, or solana)
   */
  async getUserDepositAddress(organizationId: string, depositReference: string, protocol: 'evm' | 'tron' | 'solana' = 'evm'): Promise<any> {
    this.validateProcessorCore();

    const validationResults = [
      ValidationUtils.validateRequired(organizationId, 'organizationId'),
      ValidationUtils.validateRequired(depositReference, 'depositReference'),
      ValidationUtils.validateRequired(protocol, 'protocol')
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid request: ${combinedValidation.errors.join(', ')}`);
    }

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.getUserDepositAddress(organizationId, depositReference, protocol);
  }

  /**
   * Get deposit address by address (for public endpoints)
   * Address is globally unique and serves as natural identifier for deposits
   * @param address - Blockchain address
   * @returns Address pool record with deposit information
   */
  async getDepositByAddress(address: string): Promise<any> {
    this.validateProcessorCore();

    const validationResult = ValidationUtils.validateRequired(address, 'address');
    if (!validationResult.isValid) {
      throw new ValidationError(`Invalid request: ${validationResult.errors.join(', ')}`);
    }

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.getDepositByAddress(address);
  }

  /**
   * List addresses from address pool with pagination
   */
  async listAddresses(params: {
    organizationId: string;
    protocol?: 'evm' | 'tron' | 'solana';
    page?: number;
    pageSize?: number;
  }): Promise<{
    addresses: Array<{
      address: string;
      protocol: 'evm' | 'tron' | 'solana';
      status: 'available' | 'allocated' | 'bound';
      type: 'order' | 'deposit' | null;
      externalId: string | null;
      allocatedAt: Date | null;
      recycledAt: Date | null;
      cooldownUntil: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    this.validateProcessorCore();

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.listAddresses(params);
  }

  /**
   * Get address pool availability information
   */
  async getAddressPoolAvailability(organizationId: string, protocol: 'evm' | 'tron' | 'solana' = 'evm'): Promise<{
    total: number;
    available: number;
    allocated: number;
    bound: number;
    coolingDown: number;
    archived: number;
  }> {
    this.validateProcessorCore();

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    return await addressPoolRepo.getAddressPoolStats(organizationId, protocol);
  }

  /**
   * Add addresses to address pool
   */
  async addAddressesToPool(addresses: Array<{
    organizationId: string;
    address: string;
    protocol: 'evm' | 'tron' | 'solana';
    masterPublicKey?: string | null;
    derivationIndex?: number | null;
  }>): Promise<void> {
    this.validateProcessorCore();

    if (!addresses || addresses.length === 0) {
      throw new ValidationError('Addresses array cannot be empty');
    }

    // Validate each address
    for (const addr of addresses) {
      const validationResults = [
        ValidationUtils.validateRequired(addr.organizationId, 'organizationId'),
        ValidationUtils.validateRequired(addr.address, 'address'),
        ValidationUtils.validateRequired(addr.protocol, 'protocol'),
        ValidationUtils.validateAddressByChain(addr.address, addr.protocol)
      ];

      const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
      if (!combinedValidation.isValid) {
        throw new ValidationError(`Invalid address data: ${combinedValidation.errors.join(', ')}`);
      }
    }

    const database = this.processorCore!.getDatabase();

    // Convert to database format with organization_id
    const addressData = addresses.map(addr => ({
      organizationId: addr.organizationId,
      address: addr.address,
      derivationIndex: addr.derivationIndex ?? null,
      protocol: addr.protocol,
      masterPublicKey: addr.masterPublicKey ?? null
    }));

    // Use a transaction to ensure atomicity
    await database.query('BEGIN');
    try {
      for (const data of addressData) {
        await database.query(`
          INSERT INTO address_pool (organization_id, address, derivation_index, protocol, master_public_key, state)
          VALUES ($1, $2, $3, $4, $5, 'idle')
          ON CONFLICT (address) DO NOTHING
        `, [data.organizationId, data.address, data.derivationIndex, data.protocol, data.masterPublicKey]);
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Archive an address (soft delete)
   * Archived addresses cannot be allocated or bound until unarchived
   * @param organizationId - Organization ID for multi-tenant isolation
   * @param address - Address to archive
   */
  async archiveAddress(organizationId: string, address: string): Promise<void> {
    this.validateProcessorCore();

    const validationResults = [
      ValidationUtils.validateRequired(organizationId, 'organizationId'),
      ValidationUtils.validateRequired(address, 'address'),
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid archive request: ${combinedValidation.errors.join(', ')}`);
    }

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    await addressPoolRepo.archiveAddress(organizationId, address);
  }

  /**
   * Unarchive an address (restore to available state)
   * @param organizationId - Organization ID for multi-tenant isolation
   * @param address - Address to unarchive
   */
  async unarchiveAddress(organizationId: string, address: string): Promise<void> {
    this.validateProcessorCore();

    const validationResults = [
      ValidationUtils.validateRequired(organizationId, 'organizationId'),
      ValidationUtils.validateRequired(address, 'address'),
    ];

    const combinedValidation = ValidationUtils.combineValidationResults(validationResults);
    if (!combinedValidation.isValid) {
      throw new ValidationError(`Invalid unarchive request: ${combinedValidation.errors.join(', ')}`);
    }

    const addressPoolRepo = this.processorCore!.getAddressPoolRepository();
    await addressPoolRepo.unarchiveAddress(organizationId, address);
  }

  /**
   * Check database schema completeness
   * Returns information about missing tables and schema status
   */
  async checkDatabaseSchema(): Promise<{
    isComplete: boolean;
    missingTables: string[];
    existingTables: string[];
    requiredTables: string[];
  }> {
    this.validateProcessorCore();

    const database = this.processorCore!.getDatabase();
    return await database.checkDatabaseSchema();
  }

  /**
   * Initialize database schema (structure only, no data)
   *
   * Note: Processor only initializes database structure.
   * Use ConfigurationManager to populate configuration defaults.
   *
   * @param options Configuration options
   * @param options.dropExisting - Drop existing tables before creating (default: false)
   * @param options.onlyMissing - Only create missing tables (default: true)
   * @param options.force - Force execution without confirmation (default: false)
   */
  async initializeDatabaseSchema(options?: {
    dropExisting?: boolean;
    onlyMissing?: boolean;
    seedData?: boolean;  // Deprecated, will be ignored
    force?: boolean;
  }): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    createdTables: string[];
    upgradedTables: string[];
    seedDataResults: { table: string; inserted: number }[];
    summary: string;
  }> {
    this.validateProcessorCore();

    const database = this.processorCore!.getDatabase();
    return await database.initializeDatabaseSchema(options);
  }

  /**
   * Get database instance for advanced usage
   */
  getDatabase(): PostgreSQLDatabase {
    this.validateProcessorCore();
    return this.processorCore!.getDatabase();
  }

  /**
   * Get system status
   */
  getSystemStatus(): SystemStatus {
    this.validateProcessorCore();
    return this.processorCore!.getSystemStatus();
  }

  // ==================== Advanced Query Methods ====================

  /**
   * List orders with filtering, pagination and sorting
   */
  async listOrders(filters: {
    organizationId?: string; // Multi-tenant filtering
    status?: string | string[];
    chain?: string;
    token?: string;
    orderReference?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'updated_at' | 'amount';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ orders: any[]; total: number; page: number; limit: number }> {
    this.validateProcessorCore();
    const repository = this.processorCore!.getOrderRepository();
    return await repository.findAll(filters);
  }

  /**
   * Get order statistics
   */
  async getOrderStatistics(filters: {
    organizationId?: string; // Multi-tenant filtering
    chain?: string;
    token?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  } = {}): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    expiredOrders: number;
    totalAmount: string;
    completedAmount: string;
    avgPaymentTimeSeconds: number;
    byStatus: Record<string, number>;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
  }> {
    this.validateProcessorCore();
    const repository = this.processorCore!.getOrderRepository();
    return await repository.getStatistics(filters);
  }

  /**
   * List transfers with filtering, pagination and sorting
   */
  async listTransfers(filters: {
    organizationId?: string; // Multi-tenant filtering
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
  } = {}): Promise<{ transfers: any[]; total: number; page: number; limit: number }> {
    this.validateProcessorCore();
    const repository = this.processorCore!.getTransferRepository();
    return await repository.findAll(filters);
  }

  /**
   * List deposit addresses with filtering
   */
  async listDepositAddresses(filters: {
    organizationId?: string;
    protocol?: 'evm' | 'tron';
    depositReference?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ addresses: any[]; total: number; page: number; limit: number }> {
    this.validateProcessorCore();
    const database = this.processorCore!.getDatabase();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Only get bound addresses
    conditions.push(`state = 'bound'`);

    // Multi-tenant isolation
    if (filters.organizationId) {
      conditions.push(`organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.protocol) {
      conditions.push(`protocol = $${paramIndex++}`);
      params.push(filters.protocol);
    }

    if (filters.depositReference) {
      conditions.push(`deposit_reference ILIKE $${paramIndex++}`);
      params.push(`%${filters.depositReference}%`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM address_pool ${whereClause}`;
    const countResult = await database.query(countSql, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Get addresses (order by most recently bound first)
    const sql = `
      SELECT * FROM address_pool
      ${whereClause}
      ORDER BY allocated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const addresses = await database.query(sql, [...params, limit, offset]);

    return { addresses, total, page, limit };
  }

  /**
   * Get chain sync status for all chains
   */
  async getAllChainsSyncStatus(): Promise<Array<{
    chain: string;
    latest_processed_block: number;
    sync_status?: string;
    is_healthy?: boolean;
    behind_blocks?: number;
    updated_at: Date;
  }>> {
    this.validateProcessorCore();
    const database = this.processorCore!.getDatabase();

    const result = await database.query(`
      SELECT
        chain,
        latest_processed_block,
        sync_status,
        is_healthy,
        behind_blocks,
        updated_at
      FROM chain_blocks
      ORDER BY chain
    `);

    return result;
  }

  /**
   * Get chain sync status for a specific chain
   */
  async getChainSyncStatus(chainId: string): Promise<{
    chain: string;
    latest_processed_block: number;
    sync_status?: string;
    is_healthy?: boolean;
    behind_blocks?: number;
    updated_at: Date;
  } | null> {
    this.validateProcessorCore();
    const database = this.processorCore!.getDatabase();

    const result = await database.query(`
      SELECT
        chain,
        latest_processed_block,
        sync_status,
        is_healthy,
        behind_blocks,
        updated_at
      FROM chain_blocks
      WHERE chain = $1
    `, [chainId]);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Internal validation helper
   */
  private validateProcessorCore(): void {
    if (!this.processorCore) {
      throw new ServiceUnavailableError('ProcessorCore', {
        reason: 'not_initialized',
        message: 'Processor core not initialized. Call Processor.create() first.'
      });
    }
  }

  // ==================== Event Subscription Methods ====================

  /**
   * Subscribe to processor events
   *
   * Available events:
   * - orderStatusChanged: Fired when order status changes
   * - orderCompleted: Fired when order is completed
   * - depositReceived: Fired when deposit is received and confirmed
   * - addressBound: Fired when address is bound for deposits
   * - transfer: Fired when transfer is detected
   * - transferConfirmed: Fired when transfer is confirmed
   * - blockProgress: Fired on block progress updates
   * - chainTargetReached: Fired when chain recovery target is reached
   * - syncStatusChanged: Fired when sync status changes
   * - started: Fired when processor starts
   * - stopped: Fired when processor stops
   * - error: Fired when an error occurs
   *
   * @param eventName - Event name to listen to (use ProcessorEventName enum)
   * @param handler - Event handler function
   * @param options - Subscription options
   * @returns Subscription ID for unsubscribing
   *
   * @example
   * ```typescript
   * const processor = await Processor.create();
   * await processor.start();
   *
   * // Subscribe to order completion events
   * const subscriptionId = processor.on(ProcessorEventName.ORDER_COMPLETED, (event) => {
   *   console.log('Order completed:', event.orderId);
   * });
   *
   * // Subscribe to deposit events
   * processor.on(ProcessorEventName.DEPOSIT_RECEIVED, async (event) => {
   *   await notifyUser(event.depositReference, event.amount);
   * });
   *
   * // Unsubscribe when done
   * processor.off(subscriptionId);
   * ```
   */
  on<T = any>(
    eventName: ProcessorEventName | string,
    handler: EventHandler<T>,
    options: { once?: boolean } = {}
  ): string {
    this.validateProcessorCore();
    const eventBus = this.processorCore!.getEventBus();
    return eventBus.subscribe(eventName, handler, options);
  }

  /**
   * Subscribe to a processor event that fires only once
   *
   * @param eventName - Event name to listen to
   * @param handler - Event handler function
   * @returns Subscription ID for unsubscribing
   *
   * @example
   * ```typescript
   * processor.once(ProcessorEventName.STARTED, () => {
   *   console.log('Processor started!');
   * });
   * ```
   */
  once<T = any>(
    eventName: ProcessorEventName | string,
    handler: EventHandler<T>
  ): string {
    return this.on(eventName, handler, { once: true });
  }

  /**
   * Unsubscribe from a processor event
   *
   * @param subscriptionId - Subscription ID returned by on() or once()
   * @returns true if unsubscribed successfully, false if subscription not found
   *
   * @example
   * ```typescript
   * const subId = processor.on(ProcessorEventName.ORDER_COMPLETED, handler);
   * // ... later
   * processor.off(subId);
   * ```
   */
  off(subscriptionId: string): boolean {
    this.validateProcessorCore();
    const eventBus = this.processorCore!.getEventBus();
    return eventBus.unsubscribe(subscriptionId);
  }

  /**
   * Get the event bus for advanced usage
   *
   * This provides direct access to the underlying event bus for advanced use cases.
   * Most users should use the on() and off() methods instead.
   *
   * @returns The processor event bus instance
   *
   * @example
   * ```typescript
   * const eventBus = processor.getEventBus();
   * const stats = eventBus.getEventStats();
   * console.log('Active subscriptions:', stats.totalSubscriptions);
   * ```
   */
  getEventBus(): ProcessorEventBus {
    this.validateProcessorCore();
    return this.processorCore!.getEventBus();
  }

}