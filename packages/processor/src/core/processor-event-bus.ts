/**
 * Processor Event Bus
 * Handles all event management and routing for the Processor
 */

import { EventEmitter } from 'events';
import { createLogger, LogCategory } from '@payin/shared';
import type { OrderStatusEvent } from '../services/order-service.js';
import type { DepositEvent } from '../services/deposit-service.js';
import type { TransferEvent, BlockProgressEvent } from '@payin/monitor';

/**
 * Event names used throughout the processor
 */
export enum ProcessorEventName {
  // System events
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',

  // Order events
  ORDER_STATUS_CHANGED = 'orderStatusChanged',
  ORDER_COMPLETED = 'orderCompleted',

  // Deposit events
  DEPOSIT_RECEIVED = 'depositReceived',
  ADDRESS_BOUND = 'addressBound',

  // Transfer events
  TRANSFER_DETECTED = 'transfer',
  TRANSFER_CONFIRMED = 'transferConfirmed',

  // Monitor events
  BLOCK_PROGRESS = 'blockProgress',
  CHAIN_TARGET_REACHED = 'chainTargetReached',
  SYNC_STATUS_CHANGED = 'syncStatusChanged',

  // Delayed confirmation events
  INITIAL_PROCESSING = 'initialProcessing',
  CONFIRMATION_PROGRESS = 'confirmationProgress',
  TRANSACTION_CONFIRMED = 'transactionConfirmed',
  TRANSACTION_INVALID = 'transactionInvalid',
  TRANSACTION_FAILED = 'transactionFailed',
  TRANSACTION_TIMEOUT = 'transactionTimeout',
  TRANSACTION_DROPPED = 'transactionDropped'
}

/**
 * Event data interfaces
 */
export interface SystemEvent {
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ErrorEvent extends SystemEvent {
  error: Error;
  category?: string;
  severity?: string;
}

export interface TransferDetectedEvent extends SystemEvent {
  transfer: TransferEvent;
  businessContext?: any;
}

export interface TransferConfirmedEvent extends SystemEvent {
  transfer: TransferEvent;
  confirmations: number;
  businessContext?: any;
}

/**
 * Address bound event data
 */
export interface AddressBoundEvent {
  depositReference: string;
  protocol: string;
  depositAddress: string;
  monitoringTargets: Array<{
    chain: string;
    contract: string;
    token: string;
  }>;
  bindingCreatedAt: Date;
}

/**
 * Event handler type definitions
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventName: string;
  handler: EventHandler;
  once?: boolean;
}

/**
 * Processor Event Bus implementation
 */
export class ProcessorEventBus extends EventEmitter {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private subscriptions = new Map<string, EventSubscription>();
  private subscriptionCounter = 0;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow more listeners for complex setups
  }

  /**
   * Subscribe to an event with automatic subscription management
   * @param eventName - Event name to listen to
   * @param handler - Event handler function
   * @param options - Subscription options
   * @returns Subscription ID for unsubscribing
   */
  subscribe<T = any>(
    eventName: ProcessorEventName | string,
    handler: EventHandler<T>,
    options: { once?: boolean } = {}
  ): string {
    const subscriptionId = `sub_${++this.subscriptionCounter}_${Date.now()}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventName,
      handler,
      once: options.once
    };

    this.subscriptions.set(subscriptionId, subscription);

    const wrappedHandler = async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        this.logger.error(`Error in event handler for ${eventName}:`, error);
        this.emit(ProcessorEventName.ERROR, {
          error: error as Error,
          timestamp: new Date(),
          context: { eventName, subscriptionId }
        } as ErrorEvent);
      }

      if (subscription.once) {
        this.unsubscribe(subscriptionId);
      }
    };

    if (options.once) {
      this.once(eventName, wrappedHandler);
    } else {
      this.on(eventName, wrappedHandler);
    }

    this.logger.debug(`Subscribed to event: ${eventName}`, { subscriptionId });
    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   * @param subscriptionId - Subscription ID returned by subscribe
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.removeListener(subscription.eventName, subscription.handler);
    this.subscriptions.delete(subscriptionId);

    this.logger.debug(`Unsubscribed from event: ${subscription.eventName}`, { subscriptionId });
    return true;
  }

  /**
   * Emit a system event
   * @param eventName - Event name
   * @param data - Event data
   */
  emitSystemEvent(eventName: ProcessorEventName, data?: SystemEvent): void {
    const eventData: SystemEvent = {
      timestamp: new Date(),
      ...data
    };

    this.emit(eventName, eventData);
    this.logger.debug(`Emitted system event: ${eventName}`, eventData);
  }

  /**
   * Emit an error event
   * @param error - Error that occurred
   * @param context - Additional context
   */
  emitError(error: Error, context?: Record<string, any>): void {
    const errorEvent: ErrorEvent = {
      error,
      timestamp: new Date(),
      context
    };

    this.emit(ProcessorEventName.ERROR, errorEvent);
    this.logger.error('Error event emitted:', errorEvent);
  }

  /**
   * Emit an order status change event
   * @param event - Order status event
   */
  emitOrderStatusChanged(event: OrderStatusEvent): void {
    this.emit(ProcessorEventName.ORDER_STATUS_CHANGED, event);

    if (event.newStatus === 'completed') {
      this.emit(ProcessorEventName.ORDER_COMPLETED, {
        orderId: event.orderId,
        timestamp: event.timestamp
      });
    }

    this.logger.debug(`Order status changed: ${event.orderId} (${event.oldStatus} → ${event.newStatus})`);
  }

  /**
   * Emit a deposit received event
   * @param event - Deposit event
   */
  emitDepositReceived(event: DepositEvent): void {
    this.emit(ProcessorEventName.DEPOSIT_RECEIVED, event);

    // Also emit specific deposit event
    const specificEventName = `deposit:${event.depositReference}`;
    this.emit(specificEventName, event);

    this.logger.debug(`Deposit received: ${event.depositReference} (${event.amount} ${event.token})`);
  }

  /**
   * Emit an address bound event
   * @param event - Address bound event
   */
  emitAddressBound(event: AddressBoundEvent): void {
    this.emit(ProcessorEventName.ADDRESS_BOUND, event);
    this.logger.debug(`Address bound: ${event.depositReference} -> ${event.depositAddress}`);
  }

  /**
   * Emit a transfer detected event
   * @param transfer - Transfer data
   * @param businessContext - Business context
   */
  emitTransferDetected(transfer: TransferEvent, businessContext?: any): void {
    const event: TransferDetectedEvent = {
      transfer,
      businessContext,
      timestamp: new Date()
    };

    this.emit(ProcessorEventName.TRANSFER_DETECTED, event);
    this.logger.debug(`Transfer detected: ${transfer.transactionHash}`, {
      chain: transfer.chain,
      amount: transfer.amount
    });
  }

  /**
   * Emit a transfer confirmed event
   * @param transfer - Transfer data
   * @param confirmations - Number of confirmations
   * @param businessContext - Business context
   */
  emitTransferConfirmed(transfer: TransferEvent, confirmations: number, businessContext?: any): void {
    const event: TransferConfirmedEvent = {
      transfer,
      confirmations,
      businessContext,
      timestamp: new Date()
    };

    this.emit(ProcessorEventName.TRANSFER_CONFIRMED, event);
    this.logger.debug(`Transfer confirmed: ${transfer.transactionHash}`, {
      chain: transfer.chain,
      confirmations
    });
  }

  /**
   * Emit a block progress event
   * @param data - Block progress data
   */
  emitBlockProgress(data: any): void {
    this.emit(ProcessorEventName.BLOCK_PROGRESS, {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit a chain target reached event
   * @param data - Chain target data
   */
  emitChainTargetReached(data: any): void {
    this.emit(ProcessorEventName.CHAIN_TARGET_REACHED, {
      ...data,
      timestamp: new Date()
    });
    this.logger.info(`Chain recovery target reached: ${data.chain}`);
  }

  /**
   * Emit a sync status changed event
   * @param data - Sync status data
   */
  emitSyncStatusChanged(data: any): void {
    this.emit(ProcessorEventName.SYNC_STATUS_CHANGED, {
      ...data,
      timestamp: new Date()
    });
    this.logger.info(`Sync status changed: isAllChainsSynced=${data.isAllChainsSynced}`);
  }

  /**
   * Get active subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscription details
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    this.removeAllListeners();
    this.subscriptions.clear();
    this.logger.debug('Event bus cleaned up');
  }

  /**
   * Get event statistics
   */
  getEventStats(): {
    totalSubscriptions: number;
    eventNames: string[];
    listenerCounts: Record<string, number>;
  } {
    const eventNames = this.eventNames();
    const listenerCounts: Record<string, number> = {};

    for (const eventName of eventNames) {
      listenerCounts[String(eventName)] = this.listenerCount(eventName);
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      eventNames: eventNames.map(String),
      listenerCounts
    };
  }
}