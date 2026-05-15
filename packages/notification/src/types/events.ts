/**
 * Event Type Definitions
 * Maps Processor events to notification events
 */

/**
 * All supported event types
 */
export const EVENT_TYPES = {
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_COMPLETED: 'order.completed',
  ORDER_EXPIRED: 'order.expired',

  // Deposit events
  DEPOSIT_ADDRESS_BOUND: 'deposit.address_bound',
  DEPOSIT_ADDRESS_UNBOUND: 'deposit.address_unbound',
  DEPOSIT_COMPLETED: 'deposit.completed',

  // Transfer events
  TRANSFER_DETECTED: 'transfer.detected',
  TRANSFER_CONFIRMED: 'transfer.confirmed',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

/**
 * Order event payloads
 */
export interface OrderCreatedEventData {
  order_id: string;
  order_reference: string;
  amount: string;
  currency: string;
  chain_id: string;
  payment_address: string;
  expires_at: string;
  metadata?: Record<string, any>;
}

export interface OrderCompletedEventData {
  order_id: string;
  order_reference: string;
  amount: string;
  currency: string;
  chain_id: string;
  payment_address: string;
  completed_at: string;
}

export interface OrderExpiredEventData {
  order_id: string;
  order_reference: string;
  expired_at: string;
  reason: 'timeout' | 'cancelled';
}

/**
 * Deposit event payloads
 */
export interface DepositAddressBoundEventData {
  deposit_reference: string;
  protocol: 'evm' | 'tron';
  deposit_address: string;
  monitoring_targets: Array<{
    chain: string;
    contract: string;
    token: string;
  }>;
}

export interface DepositAddressUnboundEventData {
  deposit_reference: string;
  protocol: 'evm' | 'tron';
  deposit_address: string;
}

export interface DepositCompletedEventData {
  deposit_reference: string;
  deposit_address: string;
  amount: string;
  currency: string;
  chain_id: string;
  tx_hash: string;
  completed_at: string;
}

/**
 * Transfer event payloads
 */
export interface TransferDetectedEventData {
  tx_hash: string;
  chain_id: string;
  from_address: string;
  to_address: string;
  amount: string;
  currency: string;
  block_number: number;
  business_type?: 'order' | 'deposit';
  business_id?: string;
}

export interface TransferConfirmedEventData {
  tx_hash: string;
  chain_id: string;
  confirmations: number;
  confirmed_at: string;
  business_type?: 'order' | 'deposit';
  business_id?: string;
}
