/**
 * Event Mapper
 * Maps Processor events to notification events
 */

import { NotificationEvent } from '../types/notification.js';
import { EVENT_TYPES } from '../types/events.js';
import { generateEventId } from './signature.js';

/**
 * Map order status event to notification event
 *
 * @param processorEvent - Event from Processor
 * @returns Notification event or null if should be ignored
 */
export function mapOrderStatusEvent(
  processorEvent: any
): NotificationEvent | null {
  const { orderId, newStatus, oldStatus, orderReference, amount, currency, chainId, paymentAddress, expiresAt, completedAt } = processorEvent;

  let eventType: string;
  switch (newStatus) {
    case 'pending':
      // Order just created (transition from 'created' to 'pending')
      if (oldStatus === undefined || oldStatus === null || oldStatus === 'created') {
        eventType = EVENT_TYPES.ORDER_CREATED;
      } else {
        return null; // Ignore other pending transitions
      }
      break;
    case 'completed':
      eventType = EVENT_TYPES.ORDER_COMPLETED;
      break;
    case 'expired':
      eventType = EVENT_TYPES.ORDER_EXPIRED;
      break;
    default:
      return null; // Unknown status
  }

  return {
    id: generateEventId(eventType, orderId),
    type: eventType,
    created_at: new Date().toISOString(),
    data: {
      order_id: orderId,
      order_reference: orderReference,
      amount,
      currency,
      chain_id: chainId,
      payment_address: paymentAddress,
      ...(expiresAt && { expires_at: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt }),
      ...(completedAt && { completed_at: completedAt instanceof Date ? completedAt.toISOString() : completedAt }),
      ...(newStatus === 'expired' && {
        expired_at: new Date().toISOString(),
        reason: 'timeout'
      }),
    },
  };
}

/**
 * Map deposit event to notification event
 */
export function mapDepositEvent(
  processorEvent: any,
  eventType: 'address_bound' | 'address_unbound' | 'completed'
): NotificationEvent {
  const typeMap = {
    address_bound: EVENT_TYPES.DEPOSIT_ADDRESS_BOUND,
    address_unbound: EVENT_TYPES.DEPOSIT_ADDRESS_UNBOUND,
    completed: EVENT_TYPES.DEPOSIT_COMPLETED,
  };

  const depositReference = processorEvent.depositReference || processorEvent.deposit_reference;
  const fullEventType = typeMap[eventType];

  // For deposit.completed, use txHash as unique identifier (each transfer is unique)
  // For address_bound/unbound, use depositReference (one-time operations)
  let uniqueId: string;
  if (eventType === 'completed') {
    // Each deposit completion is a separate transaction
    uniqueId = processorEvent.txHash || processorEvent.tx_hash || depositReference;
  } else {
    // Address binding/unbinding is one-time per user
    uniqueId = depositReference;
  }

  return {
    id: generateEventId(fullEventType, uniqueId),
    type: fullEventType,
    created_at: new Date().toISOString(),
    data: processorEvent,
  };
}

/**
 * Map transfer event to notification event
 */
export function mapTransferEvent(
  processorEvent: any,
  eventType: 'detected' | 'confirmed'
): NotificationEvent {
  const typeMap = {
    detected: EVENT_TYPES.TRANSFER_DETECTED,
    confirmed: EVENT_TYPES.TRANSFER_CONFIRMED,
  };

  const txHash = processorEvent.transfer?.transactionHash || processorEvent.tx_hash;
  const fullEventType = typeMap[eventType];

  return {
    id: generateEventId(fullEventType, txHash),
    type: fullEventType,
    created_at: new Date().toISOString(),
    data: processorEvent.transfer || processorEvent,
  };
}

