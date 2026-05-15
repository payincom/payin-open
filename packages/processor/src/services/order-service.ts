import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PostgreSQLDatabase, DatabaseTransaction } from '../database/database.js';
import { MonitoringTargetManager, type MonitoringTarget } from '../core/monitoring-target-manager.js';
import { AmountAccumulator } from '../core/amount-accumulator.js';
// Define types locally and export them
export type OrderStatus = 'pending' | 'expired' | 'completed';

export interface CreateOrderRequest {
  organizationId: string; // Organization ID for multi-tenant isolation
  amount: string;
  currency: string;
  chainId: string;
  orderReference: string;
  paymentWindowMinutes?: number;
  gracePeriodMinutes?: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentAddress: string;
  amount: string;
  currency: string;
  chainId: string;
  status: string;
  expiresAt: Date;
  qrCode?: string;
  deepLink?: string;
}
import { OrderStateMachine } from '../core/order-state-machine.js';
import type { Monitor, TransferEvent, Chain } from '@payin/monitor';
import type { TokenConfig } from '../config/token-config.js';
import { getTokenContract } from '../config/token-config.js';
import { ChainUtils, AmountUtils, ValidationUtils } from '../shared/index.js';
import { createLogger, LogCategory, type ConfigProvider } from '@payin/shared';
import { OrderRepository, CreateOrderData, OrderDbObject } from '../repositories/order.repository.js';
import { TransferRepository } from '../repositories/transfer.repository.js';
import { AddressPoolRepository } from '../repositories/address-pool.repository.js';

export interface OrderStatusEvent {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: Date;
  context?: Record<string, any>;

  // Complete order information for notifications (added for @payin/notification)
  orderReference?: string;
  amount?: string;
  currency?: string;
  chainId?: string;
  paymentAddress?: string;
  expiresAt?: Date;
  completedAt?: Date;

  // Redirect URL for user navigation (added for redirect feature)
  redirectUrl?: string;
}

export class OrderService extends EventEmitter {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private isStarted = false;
  private maintenanceTimer?: NodeJS.Timeout;
  private targetManager: MonitoringTargetManager;
  private amountAccumulator: AmountAccumulator;
  private stateMachine: OrderStateMachine;
  private paymentWindowTimers = new Map<string, NodeJS.Timeout>();
  private gracePeriodTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private orderRepository: OrderRepository,
    private transferRepository: TransferRepository,
    private addressPoolRepository: AddressPoolRepository,
    private database: PostgreSQLDatabase, // Kept for other non-entity operations
    private monitor: Monitor,
    private config: {
      defaultPaymentWindowMinutes: number;
      defaultGracePeriodMinutes: number;
      maxTotalTimeoutMinutes: number;
      maintenanceIntervalMs: number;
    },
    private tokenConfig: Record<string, TokenConfig> = {},
    private configProvider?: ConfigProvider
  ) {
    super();
    this.targetManager = new MonitoringTargetManager();
    this.amountAccumulator = new AmountAccumulator();
    this.stateMachine = new OrderStateMachine();
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.setupMonitorEventHandlers();
    this.startMaintenanceTask();
    this.isStarted = true;
    this.logger.info('OrderService started');
    this.emit('started', { timestamp: new Date() });
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    this.clearAllTimers();
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }
    this.isStarted = false;
    this.logger.info('OrderService stopped');
    this.emit('stopped', { timestamp: new Date() });
  }

  async createOrder(request: CreateOrderRequest, userId: string): Promise<CreateOrderResponse> {
    if (!this.isStarted) {
      throw new Error('OrderService not started');
    }

    if (!request.orderReference || request.orderReference.trim() === '') {
      throw new Error('orderReference is required and cannot be empty');
    }

    const orderId = uuidv4();

    // Get timeout configurations with organization isolation
    // Priority: request parameter > organization config > global config > static default
    let paymentWindowMinutes = request.paymentWindowMinutes;
    let gracePeriodMinutes = request.gracePeriodMinutes;

    if (!paymentWindowMinutes && this.configProvider) {
      paymentWindowMinutes = await this.configProvider.getConfig(
        'orders.payment_window_minutes',
        request.organizationId
      ) || this.config.defaultPaymentWindowMinutes;
    } else if (!paymentWindowMinutes) {
      paymentWindowMinutes = this.config.defaultPaymentWindowMinutes;
    }

    if (!gracePeriodMinutes && this.configProvider) {
      gracePeriodMinutes = await this.configProvider.getConfig(
        'orders.grace_period_minutes',
        request.organizationId
      ) || this.config.defaultGracePeriodMinutes;
    } else if (!gracePeriodMinutes) {
      gracePeriodMinutes = this.config.defaultGracePeriodMinutes;
    }

    const totalTimeoutMinutes = paymentWindowMinutes + gracePeriodMinutes;
    
    if (totalTimeoutMinutes > this.config.maxTotalTimeoutMinutes) {
      throw new Error(`Total timeout (${totalTimeoutMinutes}min) exceeds maximum (${this.config.maxTotalTimeoutMinutes}min)`);
    }

    const now = new Date();
    const paymentWindowEndsAt = new Date(now.getTime() + paymentWindowMinutes * 60 * 1000);
    const gracePeriodEndsAt = new Date(now.getTime() + totalTimeoutMinutes * 60 * 1000);

    const protocol = this.getChainFamily(String(request.chainId));
    const standardChain = this.standardizeChainName(String(request.chainId)) as Chain;
    const tokenConfig = this.tokenConfig[request.currency];

    if (!tokenConfig) {
      const availableTokens = Object.keys(this.tokenConfig);
      throw new Error(
        `Token '${request.currency}' is not enabled. ` +
        `Available tokens: ${availableTokens.join(', ') || 'none'}`
      );
    }

    const contractAddress = tokenConfig.contracts[standardChain];

    if (!contractAddress) {
      const availableChains = Object.keys(tokenConfig.contracts);
      throw new Error(
        `${request.currency} is not available on ${standardChain}. ` +
        `This token is only available on: ${availableChains.join(', ')}`
      );
    }

    try {
      // Prepare order data (address will be set in transaction)
      const orderData: CreateOrderData = {
        id: orderId,
        organization_id: request.organizationId, // Multi-tenant isolation
        order_reference: request.orderReference,
        amount: request.amount,
        token: request.currency,
        chain: String(request.chainId),
        address: 'pending', // Placeholder, will be replaced in transaction
        required_confirmations: this.getRequiredConfirmations(standardChain),
        status: 'pending',
        payment_window_ends_at: paymentWindowEndsAt,
        grace_period_ends_at: gracePeriodEndsAt,
        payment_window_minutes: paymentWindowMinutes,
        grace_period_minutes: gracePeriodMinutes,
        confirmed_received: '0.000000',
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        metadata: {
          ...request.metadata,
          user_id: userId,
          chainId: String(request.chainId),
          contractAddress: contractAddress
        },
      };

      // Execute atomic transaction: allocate address + create order + log allocation
      const { paymentAddress } = await this.createOrderWithTransaction(
        orderId,
        orderData,
        protocol as 'evm' | 'tron' | 'solana'
      );

      // Transaction successful - continue with post-creation operations
      const monitoringTarget: MonitoringTarget = this.targetManager.createTarget(
        standardChain,
        contractAddress,
        paymentAddress
      );
      await this.monitor.watch([monitoringTarget]);

      this.logger.info('Started monitoring for order', { orderId, address: paymentAddress });

      this.scheduleTimeoutChecks(orderId, paymentWindowEndsAt, gracePeriodEndsAt);

      this.emitStatusChange(orderId, 'created', 'pending', { address: paymentAddress });

      return {
        orderId,
        paymentAddress,
        amount: request.amount,
        currency: request.currency,
        chainId: request.chainId,
        status: 'pending',
        expiresAt: gracePeriodEndsAt,
        qrCode: `${paymentAddress}:${request.amount}:${request.currency}`,
        deepLink: `payment://${paymentAddress}?amount=${request.amount}&currency=${request.currency}`
      };

    } catch (error) {
      this.logger.error('Failed to create order', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getOrder(orderId: string, organizationId?: string): Promise<OrderDbObject | null> {
    const order = await this.orderRepository.findById(orderId);

    // Multi-tenant isolation: validate organization ownership if organizationId provided
    if (order && organizationId && order.organization_id !== organizationId) {
      return null; // Return null if order belongs to different organization
    }

    return order;
  }

  private scheduleTimeoutChecks(orderId: string, paymentWindowEndsAt: Date, gracePeriodEndsAt: Date): void {
    const now = Date.now();
    const paymentWindowDelay = Math.max(0, paymentWindowEndsAt.getTime() - now);
    const gracePeriodDelay = Math.max(0, gracePeriodEndsAt.getTime() - now);

    if (paymentWindowDelay > 0) {
      const timer = setTimeout(() => this.handlePaymentWindowTimeout(orderId), paymentWindowDelay);
      this.paymentWindowTimers.set(orderId, timer);
    }

    if (gracePeriodDelay > 0) {
      const timer = setTimeout(() => this.handleGracePeriodTimeout(orderId), gracePeriodDelay);
      this.gracePeriodTimers.set(orderId, timer);
    }
  }

  private async handlePaymentWindowTimeout(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.status !== 'pending') return;

    this.logger.info('Payment window expired for order, continuing monitoring during grace period', { orderId });
    this.emitStatusChange(orderId, order.status, order.status, { reason: 'payment_window_timeout', inGracePeriod: true });
  }

  private async handleGracePeriodTimeout(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.status !== 'pending') return;

    const confirmedAmount = parseFloat(order.confirmed_received || '0');
    const requiredAmount = parseFloat(order.amount);
    const isSufficient = confirmedAmount >= requiredAmount;

    const finalStatus = isSufficient ? 'completed' : 'expired';
    await this.transitionToStatus(orderId, finalStatus);
    await this.stopOrderMonitoring(orderId);
    this.clearOrderTimers(orderId);
  }

  public convertWeiToDecimal(weiAmount: string, currency: string): string {
    return AmountUtils.convertWeiToDecimalByToken(weiAmount, currency);
  }

  private async processTransferAmount(orderId: string, transfer: TransferEvent): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) return;

    const existingTransfer = await this.transferRepository.findByTxHashAndEventIndex(transfer.transactionHash, transfer.eventIndex || 0);
    if (existingTransfer) {
      this.logger.debug('Transfer event already processed, skipping.', { orderId, txHash: transfer.transactionHash });
      return;
    }

    const transferAmountDecimal = this.convertWeiToDecimal(transfer.amount, order.token);

    await this.transferRepository.create({
      id: uuidv4(),
      organization_id: order.organization_id, // Multi-tenant isolation - inherit from order
      order_id: orderId,
      deposit_reference: null,
      business_type: 'order',
      transaction_hash: transfer.transactionHash,
      block_number: transfer.blockNumber,
      event_index: transfer.eventIndex || 0,
      chain: order.chain,
      token: order.token,
      amount: transferAmountDecimal,
      from_address: transfer.from || '',
      to_address: transfer.to || order.address,
      last_checked_confirmations: 0,
      required_confirmations: order.required_confirmations,
      is_confirmed: false,
      is_failed: false,
    });
  }

  async processConfirmedTransfer(orderId: string, totalConfirmedAmount: number): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) return;

    // 首先更新 confirmed_received 字段
    await this.orderRepository.update(orderId, {
      confirmed_received: totalConfirmedAmount.toString()
    });

    const requiredAmount = parseFloat(order.amount);
    if (totalConfirmedAmount >= requiredAmount) {
      await this.transitionToStatus(orderId, 'completed');
      await this.stopOrderMonitoring(orderId);
      this.clearOrderTimers(orderId);
    }
  }

  private setupMonitorEventHandlers(): void {
    this.monitor.on('error', (error: any) => {
      this.logger.error('Monitor error', { error: error.message, stack: error.stack });
      this.emit('monitorError', error);
    });
  }

  async recordTransferOnly(event: TransferEvent, businessContext: any): Promise<void> {
    if (businessContext?.type !== 'order') return;
    const order = await this.orderRepository.findById(businessContext.id);
    if (!order) return;
    await this.processTransferAmount(businessContext.id, event);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.transitionToStatus(orderId, 'expired');
    await this.stopOrderMonitoring(orderId);
    this.clearOrderTimers(orderId);
    this.logger.info('Order cancelled/expired', { orderId });
  }

  private async stopOrderMonitoring(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) return;

    try {
      const chainId = order.metadata?.chainId || order.chain;
      const contractAddress = order.metadata?.contractAddress || getTokenContract(order.token, chainId);
      if (contractAddress) {
        const unwatchTarget = this.targetManager.createTarget(chainId, contractAddress, order.address);
        await this.monitor.unwatch([unwatchTarget]);
      }
    } catch (error) {
      this.logger.warn('Failed to remove monitoring target', { error: error.message });
    }

    try {
      await this.addressPoolRepository.releaseOrderAddress(order.address);
    } catch (error) {
      this.logger.warn('Failed to release order address', { address: order.address, error: error.message });
    }
  }

  private clearOrderTimers(orderId: string): void {
    [this.paymentWindowTimers, this.gracePeriodTimers].forEach(timerMap => {
      const timer = timerMap.get(orderId);
      if (timer) {
        clearTimeout(timer);
        timerMap.delete(orderId);
      }
    });
  }

  private clearAllTimers(): void {
    [this.paymentWindowTimers, this.gracePeriodTimers].forEach(timerMap => {
      timerMap.forEach(timer => clearTimeout(timer));
      timerMap.clear();
    });
  }

  private async transitionToStatus(orderId: string, newStatus: OrderStatus, context?: Record<string, any>): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn('Order not found for status transition', { orderId });
      return;
    }

    if (!this.stateMachine.isValidTransition(order.status as OrderStatus, newStatus)) {
      this.logger.warn('Invalid status transition for order', { orderId, oldStatus: order.status, newStatus });
      return;
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completed_at = new Date();
    }

    await this.orderRepository.update(orderId, updateData);
    await this.emitStatusChange(orderId, order.status, newStatus, context);
  }

  private async emitStatusChange(orderId: string, oldStatus: string, newStatus: string, context?: Record<string, any>): Promise<void> {
    // Fetch complete order information for event
    const order = await this.orderRepository.findById(orderId);

    // Get redirect URL with priority: order-level > config > undefined
    const redirectUrl = await this.getOrderRedirectUrl(order, newStatus as OrderStatus);

    const event: OrderStatusEvent = {
      orderId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
      context,
      // Add complete order information for notifications
      orderReference: order?.order_reference,
      amount: order?.amount,
      currency: order?.token,  // OrderDbObject uses 'token' field
      chainId: order?.chain,   // OrderDbObject uses 'chain' field
      paymentAddress: order?.address,
      expiresAt: order?.payment_window_ends_at,  // OrderDbObject uses 'payment_window_ends_at'
      completedAt: order?.completed_at,
      // Add redirect URL for user navigation
      redirectUrl,
    };

    this.emit('orderStatusChanged', event);
    if (newStatus === 'completed') {
      this.emit('orderCompleted', { orderId: event.orderId, status: newStatus });
    }
    this.logger.info('Order status changed', { orderId, oldStatus, newStatus, redirectUrl });
  }

  /**
   * Get redirect URL for order based on status with validation
   *
   * Priority:
   * 1. Order-level URL (success_url/cancel_url in orders table)
   * 2. Organization/Global configuration (via ConfigProvider)
   * 3. undefined (no redirect)
   *
   * @param order - Order object
   * @param status - Order status (completed or expired)
   * @returns Valid HTTP(S) URL or undefined
   */
  private async getOrderRedirectUrl(order: OrderDbObject | null, status: OrderStatus): Promise<string | undefined> {
    if (!order) return undefined;

    // Determine which URL field to use based on status
    const isSuccess = status === 'completed';
    const orderLevelUrl = isSuccess ? order.success_url : order.cancel_url;
    const configKey = isSuccess
      ? 'redirect.default_order_success_url'
      : 'redirect.default_order_cancel_url';

    // 1. Check order-level URL (highest priority)
    if (orderLevelUrl) {
      if (ValidationUtils.isValidHttpUrl(orderLevelUrl)) {
        return orderLevelUrl;
      } else {
        // Invalid format, log warning
        this.logger.warn('Invalid order-level redirect URL, ignoring', {
          orderId: order.id,
          status,
          url: orderLevelUrl,
          urlType: isSuccess ? 'success_url' : 'cancel_url'
        });
      }
    }

    // 2. Check configuration (organization/global fallback)
    if (this.configProvider) {
      try {
        const configUrl = await this.configProvider.getConfig(configKey, order.organization_id);

        if (configUrl) {
          if (ValidationUtils.isValidHttpUrl(configUrl)) {
            return configUrl;
          } else {
            // Invalid format, log warning
            this.logger.warn('Invalid configured redirect URL, ignoring', {
              orderId: order.id,
              organizationId: order.organization_id,
              status,
              configKey,
              url: configUrl
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to fetch redirect URL from config', {
          orderId: order.id,
          organizationId: order.organization_id,
          configKey,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 3. No valid redirect URL found
    return undefined;
  }

  private startMaintenanceTask(): void {
    this.maintenanceTimer = setInterval(() => this.performMaintenance(), this.config.maintenanceIntervalMs);
  }

  private async performMaintenance(): Promise<void> {}

  private getChainFamily(chainId: string): string {
    return ChainUtils.getChainFamily(chainId);
  }

  private standardizeChainName(chainId: string): string {
    return ChainUtils.normalizeChainId(chainId);
  }

  private getRequiredConfirmations(chain: Chain): number {
    return ChainUtils.getRequiredConfirmations(chain);
  }

  async restoreOrderMonitoring(order: any): Promise<void> {
    try {
      if (!order.address || order.address === 'pending' || order.address.length < 10) return;

      const standardChain = this.standardizeChainName(order.chain) as Chain;
      const contractAddress = order.metadata?.contractAddress || getTokenContract(order.token, order.chain);

      if (!contractAddress) {
        this.logger.warn('Contract address not found for order monitoring restoration', { orderId: order.id });
        return;
      }

      const monitoringTarget: MonitoringTarget = this.targetManager.createTarget(standardChain, contractAddress, order.address);
      await this.monitor.watch([monitoringTarget]);

      if (order.status === 'pending') {
        const now = new Date();
        const gracePeriodEndsAt = new Date(order.grace_period_ends_at);
        if (gracePeriodEndsAt > now) {
          this.scheduleTimeoutChecks(order.id, new Date(order.payment_window_ends_at), gracePeriodEndsAt);
        } else {
          await this.handleGracePeriodTimeout(order.id);
        }
      }
      this.logger.info('Order monitoring restored successfully', { orderId: order.id });
    } catch (error) {
      this.logger.error('Failed to restore order monitoring', { orderId: order.id, error: error.message });
    }
  }

  /**
   * Private method: Allocate address within a transaction
   * Extracted from AddressPoolRepository.allocateOrderAddress to support transaction context
   */
  private async allocateAddressInTx(
    tx: DatabaseTransaction,
    protocol: 'evm' | 'tron' | 'solana',
    orderId: string,
    organizationId: string
  ): Promise<{ address: string; allocated_at: Date } | null> {
    const result = await tx.query(`
      UPDATE address_pool
      SET state = 'allocated',
          order_id = $2,
          organization_id = $3,
          allocated_at = NOW(),
          recycled_at = NULL,
          cooldown_until = NULL
      WHERE address = (
        SELECT address
        FROM address_pool
        WHERE protocol = $1
          AND state = 'idle'
          AND order_id IS NULL
          AND deposit_reference IS NULL
          AND organization_id = $3
          AND (cooldown_until IS NULL OR cooldown_until <= NOW())
        ORDER BY recycled_at NULLS FIRST, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING address, allocated_at
    `, [protocol, orderId, organizationId]);

    if (result.length > 0) {
      return {
        address: result[0].address,
        allocated_at: new Date(result[0].allocated_at)
      };
    }

    return null;
  }

  /**
   * Private method: Create order within a transaction
   * Extracted from OrderRepository.create to support transaction context
   */
  private async createOrderInTx(tx: DatabaseTransaction, data: CreateOrderData): Promise<void> {
    const sql = `
      INSERT INTO orders (
        id, organization_id, order_reference, amount, token, chain, address, required_confirmations,
        status, payment_window_ends_at, grace_period_ends_at, payment_window_minutes,
        grace_period_minutes, confirmed_received, success_url, cancel_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;
    const params = [
      data.id,
      data.organization_id, // Multi-tenant isolation
      data.order_reference,
      data.amount,
      data.token,
      data.chain,
      data.address,
      data.required_confirmations,
      data.status,
      data.payment_window_ends_at,
      data.grace_period_ends_at,
      data.payment_window_minutes,
      data.grace_period_minutes,
      data.confirmed_received,
      data.success_url,
      data.cancel_url,
      data.metadata,
    ];

    await tx.query(sql, params);
  }

  /**
   * Private method: Log address allocation within a transaction
   * Extracted from AddressLogsRepository.logOrderAllocation to support transaction context
   */
  private async logAllocationInTx(tx: DatabaseTransaction, address: string, orderId: string): Promise<void> {
    await tx.query(`
      INSERT INTO address_logs (address, order_id, action, business_type, created_at)
      VALUES ($1, $2, 'allocate', 'order', NOW())
    `, [address, orderId]);
  }

  /**
   * Private method: Create order with transaction wrapper
   * Ensures atomic operation of address allocation, order creation, and logging
   */
  private async createOrderWithTransaction(
    orderId: string,
    orderData: CreateOrderData,
    protocol: 'evm' | 'tron' | 'solana'
  ): Promise<{ paymentAddress: string }> {
    return await this.database.transaction(async (tx) => {
      // Step 1: Allocate address (with FOR UPDATE SKIP LOCKED for concurrency safety)
      const addressResult = await this.allocateAddressInTx(tx, protocol, orderId, orderData.organization_id);

      if (!addressResult) {
        throw new Error(`No available addresses for chain family: ${protocol}`);
      }

      // Step 2: Create order with allocated address
      const orderDataWithAddress = {
        ...orderData,
        address: addressResult.address
      };
      await this.createOrderInTx(tx, orderDataWithAddress);

      // Step 3: Log the allocation
      await this.logAllocationInTx(tx, addressResult.address, orderId);

      // Transaction will auto-commit if no errors, or rollback on any exception
      return { paymentAddress: addressResult.address };
    });
  }
}