/**
 * Event Subscription Example
 *
 * This example demonstrates how to use the Processor event system
 * to listen for order and deposit events.
 */

import { Processor, ProcessorEventName } from '@payin/processor';
import type { OrderStatusEvent, DepositEvent } from '@payin/processor';
import { loadRootEnv } from '@payin/shared';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') });

async function main() {
  // Create and start processor
  const processor = await Processor.create({
    database: {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/payin'
    }
  });

  // ==================== Basic Event Subscription ====================

  // Subscribe to order completion events
  const orderCompletedSubId = processor.on(ProcessorEventName.ORDER_COMPLETED, (event: any) => {
    console.log('✅ Order completed:', {
      orderId: event.orderId,
      timestamp: event.timestamp
    });
  });

  // Subscribe to order status changes
  processor.on(ProcessorEventName.ORDER_STATUS_CHANGED, (event: OrderStatusEvent) => {
    console.log('📝 Order status changed:', {
      orderId: event.orderId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus
    });
  });

  // Subscribe to deposit events
  processor.on(ProcessorEventName.DEPOSIT_RECEIVED, (event: DepositEvent) => {
    console.log('💰 Deposit received:', {
      depositReference: event.depositReference,
      amount: event.amount,
      token: event.token,
      chain: event.chain
    });
  });

  // ==================== Advanced: Async Event Handlers ====================

  // Subscribe with async handler (e.g., for sending notifications)
  processor.on(ProcessorEventName.ORDER_COMPLETED, async (event: any) => {
    try {
      // Simulate sending webhook notification
      console.log('📤 Sending webhook notification for order:', event.orderId);

      // Example: await sendWebhook(event);
      // Example: await sendEmail(event);

      console.log('✅ Notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
    }
  });

  // ==================== One-time Event Subscription ====================

  // Listen for processor start event (fires only once)
  processor.once(ProcessorEventName.STARTED, () => {
    console.log('🚀 Processor has started!');
  });

  // ==================== System Events ====================

  // Subscribe to error events
  processor.on(ProcessorEventName.ERROR, (event: any) => {
    console.error('❌ Processor error:', {
      error: event.error,
      timestamp: event.timestamp,
      context: event.context
    });
  });

  // Subscribe to transfer detection events
  processor.on(ProcessorEventName.TRANSFER_DETECTED, (event: any) => {
    console.log('🔍 Transfer detected:', {
      txHash: event.transfer.transactionHash,
      chain: event.transfer.chain,
      amount: event.transfer.amount,
      to: event.transfer.to
    });
  });

  // Subscribe to transfer confirmation events
  processor.on(ProcessorEventName.TRANSFER_CONFIRMED, (event: any) => {
    console.log('✅ Transfer confirmed:', {
      txHash: event.transfer.transactionHash,
      confirmations: event.confirmations
    });
  });

  // ==================== Block Progress Monitoring ====================

  // Subscribe to block progress events
  processor.on(ProcessorEventName.BLOCK_PROGRESS, (event: any) => {
    console.log('📦 Block progress:', {
      chain: event.chain,
      blockNumber: event.blockNumber
    });
  });

  // ==================== Start Processor ====================

  await processor.start();
  console.log('✅ Processor started and listening for events...\n');

  // ==================== Example: Create Order ====================

  // Create a test order (this will trigger events)
  const order = await processor.createOrder({
    orderReference: `example_order_${Date.now()}`,
    amount: '10.00',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    metadata: {
      description: 'Example order for event subscription demo'
    }
  });

  console.log('📝 Order created:', {
    orderId: order.orderId,
    address: order.address,
    amount: order.amount,
    token: order.token
  });

  // ==================== Unsubscribe Example ====================

  // Later, you can unsubscribe from events
  setTimeout(() => {
    console.log('\n📌 Unsubscribing from order completion events...');
    const success = processor.off(orderCompletedSubId);
    console.log(success ? '✅ Unsubscribed successfully' : '❌ Subscription not found');
  }, 5000);

  // ==================== Advanced: Event Bus Access ====================

  // Get event bus for advanced usage
  const eventBus = processor.getEventBus();

  // Get event statistics
  const stats = eventBus.getEventStats();
  console.log('\n📊 Event bus statistics:', {
    totalSubscriptions: stats.totalSubscriptions,
    eventNames: stats.eventNames,
    listenerCounts: stats.listenerCounts
  });

  // Keep the process running
  console.log('\n🔄 Process will keep running. Press Ctrl+C to stop.\n');
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
