# Processor Test Utils

## 概述

测试工具提供硬编码的测试凭证和自动化配置，无需手动设置环境变量。

## 硬编码测试凭证

```typescript
// Test MNEMONIC (hardcoded - only contains testnet funds, safe to commit)
const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate';
```

**安全性说明**：
- ✅ 该助记词仅包含测试网资金
- ✅ 安全提交到代码库
- ✅ 不包含任何主网资金
- ✅ 专门用于自动化测试

## 自动配置

### 1. 数据库配置

```typescript
TestUtils.setupTestDatabase();
// 自动设置:
// - process.env.DATABASE_URL
// - process.env.MNEMONIC
```

### 2. 地址生成

```typescript
// 使用硬编码的 TEST_MNEMONIC
private static addressGenerator = new MultiChainAddressGenerator(TEST_MNEMONIC);
```

### 3. 支付发送

```typescript
// 自动确保 MNEMONIC 已设置
private static getPaymentSender(): MultiChainPaymentSender {
  if (!this.paymentSender) {
    if (!process.env.MNEMONIC) {
      process.env.MNEMONIC = TEST_MNEMONIC;
    }
    this.paymentSender = new MultiChainPaymentSender();
  }
  return this.paymentSender;
}
```

## 使用方法

### 创建测试 Processor

```typescript
import { createTestProcessor, TestUtils } from './test-utils.js';

// 创建 processor（自动配置环境）
const processor = await createTestProcessor();

// 初始化地址池
await TestUtils.initializeAddressPool(processor);
```

### 创建测试订单

```typescript
const order = await TestUtils.createTestOrder(processor, '0.05');
```

### 发送测试支付

```typescript
// 自动使用 TEST_MNEMONIC
await TestUtils.sendPayment({
  toAddress: order.paymentAddress,
  amount: order.amount,
  token: 'USDC',
  chain: 'ethereum-sepolia'
});
```

### 等待订单完成

```typescript
const completedOrder = await TestUtils.waitForOrderStatus(
  processor,
  order.orderId,
  'completed',
  180000  // 3 minutes timeout
);
```

## 完整测试示例

```typescript
import { describe, test, expect } from 'vitest';
import { createTestProcessor, TestUtils } from '../test-utils.js';

describe('Order Payment Test', () => {
  test('complete payment flow', async () => {
    // 1. Create processor
    const processor = await createTestProcessor();
    await processor.start();

    // 2. Initialize address pool
    await TestUtils.initializeAddressPool(processor);

    // 3. Create order
    const order = await TestUtils.createTestOrder(processor, '0.05');

    // 4. Send payment (uses TEST_MNEMONIC automatically)
    await TestUtils.sendPayment({
      toAddress: order.paymentAddress,
      amount: order.amount,
      token: 'USDC',
      chain: 'ethereum-sepolia'
    });

    // 5. Wait for completion
    const completed = await TestUtils.waitForOrderStatus(
      processor,
      order.orderId,
      'completed',
      180000
    );

    expect(completed.status).toBe('completed');

    // 6. Cleanup
    await processor.stop();
    await TestUtils.cleanup();
  });
});
```

## 可用方法

### Processor 创建
- `createTestProcessor(config?)` - 创建测试 Processor

### 地址管理
- `initializeAddressPool(processor)` - 初始化地址池
- `getAddressPoolStats(processor, protocol?)` - 获取地址池统计

### 订单操作
- `createTestOrder(processor, amount, protocol?)` - 创建测试订单
- `waitForOrderStatus(processor, orderId, status, timeout?)` - 等待订单状态

### 充值操作
- `bindDepositAddress(processor, depositReference, protocol?)` - 绑定充值地址
- `unbindDepositAddress(processor, depositReference, protocol?)` - 解绑充值地址
- `getUserDepositAddress(processor, depositReference, protocol?)` - 获取用户充值地址

### 支付操作
- `sendPayment({toAddress, amount, token, chain})` - 发送测试支付

### 转账查询
- `getTransfers(processor, reference)` - 获取转账记录
- `waitForTransfersConfirmed(processor, reference, count, timeout?)` - 等待转账确认

### 辅助方法
- `setupTestDatabase()` - 设置测试环境
- `setupEventListener(processor, eventName, callback)` - 设置事件监听
- `waitForRecovery(processor, timeout?)` - 等待恢复完成
- `cleanup()` - 清理资源
- `isAmountEqual(amount1, amount2, tolerance?)` - 金额比较

## 环境变量（自动设置）

测试工具会自动设置以下环境变量，无需手动配置：

- `DATABASE_URL` - Supabase 测试数据库
- `MNEMONIC` - 测试助记词

## 注意事项

1. **无需配置**: 不需要创建 `.env` 文件或手动设置环境变量
2. **自动清理**: 使用 `TestUtils.cleanup()` 清理测试资源
3. **测试网专用**: 所有测试都在测试网络上运行（Sepolia, Amoy, Nile）
4. **真实交易**: 测试会发送真实的区块链交易（使用测试网代币）
