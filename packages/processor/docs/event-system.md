# Processor 事件系统使用指南

## 概述

Processor 提供了完整的事件系统，允许外部应用（如 Manager、Notifier）监听支付订单和充值相关的事件。

## 核心概念

### 事件总线架构

```
Processor (Facade)
    ↓
ProcessorCore (Internal)
    ↓
ProcessorEventBus (EventEmitter)
    ↓
外部订阅者 (Manager, Notifier, etc.)
```

### 可用事件

| 事件名 | 说明 | 事件数据 |
|--------|------|----------|
| `orderStatusChanged` | 订单状态变更 | `{ orderId, oldStatus, newStatus, timestamp }` |
| `orderCompleted` | 订单完成 | `{ orderId, timestamp }` |
| `depositReceived` | 充值到账 | `{ depositReference, amount, token, chain, ... }` |
| `addressBound` | 地址绑定 | `{ depositReference, address, protocol }` |
| `transfer` | 转账检测 | `{ transfer, businessContext, timestamp }` |
| `transferConfirmed` | 转账确认 | `{ transfer, confirmations, businessContext }` |
| `blockProgress` | 区块进度 | `{ chain, blockNumber, timestamp }` |
| `chainTargetReached` | 链恢复目标达成 | `{ chain, timestamp }` |
| `syncStatusChanged` | 同步状态变更 | `{ isAllChainsSynced, timestamp }` |
| `started` | Processor 启动 | `{ timestamp }` |
| `stopped` | Processor 停止 | `{ timestamp }` |
| `error` | 错误事件 | `{ error, timestamp, context }` |

## 基础用法

### 1. 订阅事件

```typescript
import { Processor, ProcessorEventName } from '@payin/processor';

const processor = await Processor.create(config);
await processor.start();

// 订阅订单完成事件
const subscriptionId = processor.on(
  ProcessorEventName.ORDER_COMPLETED,
  (event) => {
    console.log('Order completed:', event.orderId);
  }
);
```

### 2. 取消订阅

```typescript
// 使用返回的 subscriptionId 取消订阅
processor.off(subscriptionId);
```

### 3. 一次性订阅

```typescript
// 只触发一次的事件订阅
processor.once(ProcessorEventName.STARTED, () => {
  console.log('Processor started!');
});
```

## 在 Manager 中集成

### 场景：订单完成后发送通知

```typescript
// packages/manager/src/manager.ts

import { Processor, ProcessorEventName } from '@payin/processor';
import { Notifier } from '@payin/notifier';

export class ConfigurationManager {
  private processor?: Processor;
  private notifier?: Notifier;
  private eventSubscriptions: string[] = [];

  async startProcessor(config?: any): Promise<void> {
    const { Processor } = await import('@payin/processor');

    // Build and create Processor
    const processorConfig = await this.buildProcessorConfig();
    this.processor = await Processor.create({
      ...processorConfig,
      ...config,
    });

    // Setup event listeners BEFORE starting
    this.setupEventListeners();

    // Start Processor
    await this.processor.start();
    console.log('✅ Processor started successfully');
  }

  private setupEventListeners(): void {
    if (!this.processor) return;

    // Listen for order completion
    const orderCompletedSub = this.processor.on(
      ProcessorEventName.ORDER_COMPLETED,
      async (event: any) => {
        await this.handleOrderCompleted(event);
      }
    );
    this.eventSubscriptions.push(orderCompletedSub);

    // Listen for deposit received
    const depositReceivedSub = this.processor.on(
      ProcessorEventName.DEPOSIT_RECEIVED,
      async (event: any) => {
        await this.handleDepositReceived(event);
      }
    );
    this.eventSubscriptions.push(depositReceivedSub);

    // Listen for errors
    const errorSub = this.processor.on(
      ProcessorEventName.ERROR,
      async (event: any) => {
        await this.handleProcessorError(event);
      }
    );
    this.eventSubscriptions.push(errorSub);
  }

  private async handleOrderCompleted(event: any): Promise<void> {
    console.log('🎉 Order completed event received:', event.orderId);

    try {
      // Get full order details
      const order = await this.processor!.getOrder(event.orderId);

      // Send webhook notification
      if (this.notifier) {
        await this.notifier.send({
          channel: 'webhook',
          url: order.callbackUrl || this.config.defaultWebhookUrl,
          payload: {
            type: 'order.completed',
            orderId: order.id,
            orderReference: order.order_reference,
            amount: order.amount,
            token: order.token,
            chain: order.chain,
            address: order.address,
            status: order.status,
            completedAt: new Date().toISOString()
          }
        });

        // Optional: Send email notification
        if (this.config.emailNotificationsEnabled) {
          await this.notifier.send({
            channel: 'email',
            to: this.config.notificationEmail,
            subject: 'Order Completed',
            template: 'order-completed',
            data: order
          });
        }
      }
    } catch (error) {
      console.error('Failed to handle order completion:', error);
    }
  }

  private async handleDepositReceived(event: any): Promise<void> {
    console.log('💰 Deposit received event:', event);

    try {
      // Send notification
      if (this.notifier) {
        await this.notifier.send({
          channel: 'webhook',
          url: this.config.depositWebhookUrl,
          payload: {
            type: 'deposit.received',
            depositReference: event.depositReference,
            amount: event.amount,
            token: event.token,
            chain: event.chain,
            transactionHash: event.transactionHash,
            receivedAt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Failed to handle deposit:', error);
    }
  }

  private async handleProcessorError(event: any): Promise<void> {
    console.error('⚠️ Processor error event:', event);

    // Log to monitoring system, send alert, etc.
    // Example: await sendAlert(event.error);
  }

  async stopProcessor(): Promise<void> {
    if (this.processor) {
      // Unsubscribe all events
      for (const subId of this.eventSubscriptions) {
        this.processor.off(subId);
      }
      this.eventSubscriptions = [];

      await this.processor.stop();
      this.processor = undefined;
      console.log('✅ Processor stopped');
    }
  }
}
```

## 高级用法

### 1. 访问事件总线

```typescript
const eventBus = processor.getEventBus();

// 获取事件统计
const stats = eventBus.getEventStats();
console.log('Active subscriptions:', stats.totalSubscriptions);
console.log('Event types:', stats.eventNames);
```

### 2. 异步事件处理

```typescript
processor.on(ProcessorEventName.ORDER_COMPLETED, async (event) => {
  // 异步处理
  await sendWebhook(event);
  await updateDatabase(event);
  await sendEmail(event);
});
```

### 3. 错误处理

```typescript
processor.on(ProcessorEventName.ORDER_COMPLETED, async (event) => {
  try {
    await sendNotification(event);
  } catch (error) {
    // 事件处理器内的错误会被捕获并通过 ERROR 事件发出
    console.error('Failed to send notification:', error);
  }
});

// 监听错误事件
processor.on(ProcessorEventName.ERROR, (event) => {
  console.error('Processor error:', event.error);
  // 发送告警
});
```

## 事件数据结构

### OrderStatusEvent

```typescript
interface OrderStatusEvent {
  orderId: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  timestamp: Date;
}
```

### DepositEvent

```typescript
interface DepositEvent {
  depositReference: string;
  amount: string;
  token: string;
  chain: string;
  transactionHash: string;
  timestamp: Date;
}
```

### TransferDetectedEvent

```typescript
interface TransferDetectedEvent {
  transfer: TransferEvent;
  businessContext?: {
    type: 'order' | 'deposit';
    id: string;
  };
  timestamp: Date;
}
```

## 最佳实践

### 1. 在 start() 之前订阅事件

```typescript
const processor = await Processor.create(config);

// ✅ 正确：在启动前订阅
processor.on(ProcessorEventName.ORDER_COMPLETED, handler);

await processor.start();
```

### 2. 清理订阅

```typescript
// 保存订阅 ID
const subscriptions: string[] = [];
subscriptions.push(processor.on(...));
subscriptions.push(processor.on(...));

// 停止时清理
async function cleanup() {
  for (const subId of subscriptions) {
    processor.off(subId);
  }
  await processor.stop();
}
```

### 3. 异步处理要加错误处理

```typescript
processor.on(ProcessorEventName.ORDER_COMPLETED, async (event) => {
  try {
    await sendWebhook(event);
  } catch (error) {
    // 必须捕获错误，否则可能影响其他事件处理器
    console.error('Webhook failed:', error);
  }
});
```

### 4. 避免阻塞事件处理器

```typescript
// ❌ 不推荐：长时间阻塞
processor.on(ProcessorEventName.ORDER_COMPLETED, async (event) => {
  await heavyProcessing(); // 可能阻塞其他事件
});

// ✅ 推荐：后台处理
processor.on(ProcessorEventName.ORDER_COMPLETED, async (event) => {
  // 立即返回，后台处理
  processInBackground(event).catch(console.error);
});
```

## 调试

### 查看活跃订阅

```typescript
const eventBus = processor.getEventBus();
const subscriptions = eventBus.getSubscriptions();

console.log('Active subscriptions:', subscriptions.length);
subscriptions.forEach(sub => {
  console.log(`  - ${sub.eventName} (${sub.id})`);
});
```

### 查看事件统计

```typescript
const stats = eventBus.getEventStats();
console.log('Event statistics:', {
  total: stats.totalSubscriptions,
  events: stats.eventNames,
  listeners: stats.listenerCounts
});
```

## 常见问题

### Q: 事件会丢失吗？

A: 不会。所有事件都是同步发出的，只要在事件发生前订阅即可。

### Q: 事件处理顺序是什么？

A: 按照订阅的顺序依次执行。如果有异步处理，建议使用后台队列。

### Q: 可以在事件处理器中修改 Processor 状态吗？

A: 可以，但要小心避免循环触发。建议将复杂逻辑移到后台处理。

### Q: 事件处理器崩溃会影响 Processor 吗？

A: 不会。事件处理器的错误会被捕获并通过 ERROR 事件发出，不会影响 Processor 运行。
