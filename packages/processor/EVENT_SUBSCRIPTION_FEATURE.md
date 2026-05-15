# Processor 事件订阅功能实现总结

## ✅ 已完成

### 1. 核心接口实现

在 `Processor` 类中添加了以下公共方法：

```typescript
// 订阅事件
on<T>(eventName: ProcessorEventName | string, handler: EventHandler<T>, options?: { once?: boolean }): string

// 一次性订阅
once<T>(eventName: ProcessorEventName | string, handler: EventHandler<T>): string

// 取消订阅
off(subscriptionId: string): boolean

// 获取事件总线（高级用法）
getEventBus(): ProcessorEventBus
```

### 2. 类型导出

通过 `@payin/processor` 包导出以下类型：

```typescript
// 事件枚举
export { ProcessorEventName }

// 事件处理器类型
export type { EventHandler }

// 事件数据类型
export type {
  SystemEvent,
  ErrorEvent,
  TransferDetectedEvent,
  TransferConfirmedEvent,
  EventSubscription
}

// 业务事件类型
export type { OrderStatusEvent, DepositEvent }
```

### 3. 可监听的事件

| 事件名 | 枚举值 | 说明 |
|--------|--------|------|
| ORDER_STATUS_CHANGED | `orderStatusChanged` | 订单状态变更 |
| ORDER_COMPLETED | `orderCompleted` | 订单完成 |
| DEPOSIT_RECEIVED | `depositReceived` | 充值到账 |
| ADDRESS_BOUND | `addressBound` | 地址绑定 |
| TRANSFER_DETECTED | `transfer` | 转账检测 |
| TRANSFER_CONFIRMED | `transferConfirmed` | 转账确认 |
| BLOCK_PROGRESS | `blockProgress` | 区块进度 |
| CHAIN_TARGET_REACHED | `chainTargetReached` | 链恢复目标达成 |
| SYNC_STATUS_CHANGED | `syncStatusChanged` | 同步状态变更 |
| STARTED | `started` | Processor 启动 |
| STOPPED | `stopped` | Processor 停止 |
| ERROR | `error` | 错误事件 |

### 4. 文档和示例

创建了以下文件：

- ✅ `docs/event-system.md` - 完整使用指南
- ✅ `examples/event-subscription-example.ts` - 示例代码
- ✅ `tests/event-subscription.test.ts` - 单元测试

## 📦 使用方式

### 基础用法

```typescript
import { Processor, ProcessorEventName } from '@payin/processor';

const processor = await Processor.create(config);

// 订阅事件
const subId = processor.on(ProcessorEventName.ORDER_COMPLETED, (event) => {
  console.log('Order completed:', event.orderId);
});

await processor.start();

// 取消订阅
processor.off(subId);
```

### 在 Manager 中使用

```typescript
import { ConfigurationManager } from '@payin/manager';
import { ProcessorEventName } from '@payin/processor';

export class Manager extends ConfigurationManager {
  private eventSubscriptions: string[] = [];

  async startProcessor(config?: any): Promise<void> {
    await super.startProcessor(config);

    // 监听订单完成事件
    const processor = this.getProcessor();
    const subId = processor.on(
      ProcessorEventName.ORDER_COMPLETED,
      async (event) => {
        await this.handleOrderCompleted(event);
      }
    );

    this.eventSubscriptions.push(subId);
  }

  private async handleOrderCompleted(event: any): Promise<void> {
    // 发送 webhook 通知
    await this.notifier.send({
      channel: 'webhook',
      url: this.config.webhookUrl,
      payload: {
        type: 'order.completed',
        orderId: event.orderId,
        timestamp: event.timestamp
      }
    });
  }

  async stopProcessor(): Promise<void> {
    const processor = this.getProcessor();

    // 清理订阅
    for (const subId of this.eventSubscriptions) {
      processor.off(subId);
    }

    await super.stopProcessor();
  }
}
```

## 🎯 下一步建议

现在 Processor 已经支持事件监听，可以继续实现：

### Phase 1: 创建 Notifier 包 ✨

```bash
# 创建 notifier 包
mkdir -p packages/notifier
cd packages/notifier
npm init -y
```

**核心功能**：
- Webhook 通道
- Email 通道
- Telegram 通道
- 重试机制
- 通知记录

### Phase 2: Manager 集成 Notifier 🔗

在 Manager 中：
1. 集成 notifier 包
2. 监听 processor 事件
3. 根据配置发送通知

### Phase 3: 配置管理 ⚙️

在 Manager 的 config_values 中添加：
- 通知开关配置
- Webhook URL 配置
- Email 配置
- Telegram bot 配置

## 📋 实现清单

- [x] 在 Processor facade 添加事件接口
- [x] 导出事件相关类型
- [x] 编写使用文档
- [x] 创建示例代码
- [x] 编写单元测试
- [x] 编译验证通过
- [ ] 创建 @payin/notifier 包
- [ ] Manager 集成通知功能
- [ ] 添加通知配置

## 🔍 技术细节

### 事件流转

```
OrderService/DepositService
    ↓ emit event
ProcessorCore.setupEventHandlers()
    ↓ forward to
ProcessorEventBus.emit()
    ↓ notify
External Subscribers (Manager, etc.)
```

### 订阅管理

- 每个订阅返回唯一 ID：`sub_{counter}_{timestamp}`
- 支持同一事件多个处理器
- 支持一次性订阅（once）
- 错误处理：事件处理器抛出的异常会被捕获并通过 ERROR 事件发出

### 线程安全

- 基于 Node.js EventEmitter（单线程）
- 事件处理器按订阅顺序同步调用
- 支持异步处理器（返回 Promise）

## ✨ 亮点

1. **完整的 TypeScript 类型支持** - 所有事件和数据都有类型定义
2. **简洁的 API** - on/off/once 符合直觉
3. **详细的文档和示例** - 易于上手
4. **错误隔离** - 事件处理器错误不会影响 Processor 运行
5. **灵活的订阅管理** - 支持动态订阅和取消订阅

## 🎉 总结

Processor 的事件系统已经完全准备好供 Manager 和 Notifier 使用。架构清晰，接口简单，文档完善。现在可以开始实现 Notifier 包和 Manager 的通知集成了！
