# Webhooks

Webhook 是 PayIn 在支付事件发生时发送到您服务器的 HTTP 回调。它们支持实时、事件驱动的支付工作流自动化。

## 什么是 Webhook？

Webhook 允许 PayIn 在重要事件发生时向您的应用程序推送实时通知：

- ✅ **实时**：支付完成时立即获得通知
- 🔄 **异步**：无需轮询状态 - 我们主动推送更新
- 🔐 **安全**：HMAC 签名验证真实性
- 🔁 **可靠**：自动重试，采用指数退避策略
- 📊 **可审计**：完整的交付历史和日志

**为什么使用 Webhook？**

如果没有 Webhook，您需要持续轮询 PayIn 的 API 来检查状态变化。Webhook 通过在事件发生时立即通知您来消除这一需求，减少延迟和服务器负载。

## Webhook vs 轮询

| 方式 | 延迟 | 服务器负载 | 复杂度 | 推荐 |
|----------|---------|-------------|------------|-------------|
| **Webhook** | 实时 (< 1秒) | 低 | 中等 | ✅ 是（生产环境） |
| **轮询** | 高 (5-60秒) | 高 | 低 | ❌ 否（仅开发环境） |

## 支持的事件

PayIn 为这些业务事件发送 Webhook：

### 订单事件

| 事件 | 描述 | 触发时机 |
|-------|-------------|------------|
| `order.completed` | 订单支付已确认 | 达到所需的区块链确认数后 |
| `order.expired` | 订单支付窗口已过期 | 宽限期结束后仍未收到支付 |

### 充值事件

| 事件 | 描述 | 触发时机 |
|-------|-------------|------------|
| `deposit.completed` | 充值已确认 | 达到所需的区块链确认数后 |
| `deposit.address_bound` | 充值地址已分配给用户 | `POST /deposits/bind` 成功时 |
| `deposit.address_unbound` | 充值地址已释放 | `POST /deposits/unbind` 成功时 |

::: tip 事件命名
事件遵循 `{资源}.{操作}` 的模式。例如，`order.completed` 表示 Order 资源已完成。
:::

## 设置 Webhook

### 步骤 1：创建 Webhook 端点

在您的应用程序中创建一个 HTTPS 端点来接收 Webhook：

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();

// 重要：使用 express.raw() 保留原始 body 用于签名验证
app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // 1. 验证 Webhook 签名
      const signature = req.headers['x-payin-signature'];
      const isValid = verifySignature(
        req.body,  // 原始 body buffer
        signature,
        process.env.PAYIN_WEBHOOK_SECRET
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 2. 解析事件
      const event = JSON.parse(req.body.toString());

      // 3. 处理事件
      await handleWebhookEvent(event);

      // 4. 快速响应 (< 10秒)
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

app.listen(3000);
```

**端点要求：**
- ✅ 必须使用 HTTPS（不是 HTTP）
- ✅ 成功时必须返回 200-299 状态码
- ✅ 必须在 30 秒内响应
- ✅ 应在处理前验证签名
- ✅ 必须处理幂等交付（可能多次接收同一事件）

### 步骤 2：在 PayIn Open 中注册端点

PayIn Open 是 headless。请通过 notification endpoint API 注册和管理 webhook 投递端点：

```bash
curl -X POST https://<your-payin-open-api>/api/v1/notifications/endpoints \
  -H "Authorization: Bearer <operator-jwt-or-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_name": "orders-webhook",
    "endpoint_type": "webhook",
    "config": {
      "url": "https://yourapp.com/webhooks/payin",
      "secret": "whsec_replace_with_random_secret"
    },
    "subscribed_events": ["order.completed", "order.expired"],
    "is_enabled": true
  }'
```

管理路径为 `POST/GET /api/v1/notifications/endpoints`、`GET/PUT/DELETE /api/v1/notifications/endpoints/:id` 和 `POST /api/v1/notifications/endpoints/:id/test`。兼容别名 `/api/v1/notifications/webhooks` 映射到同一组 endpoint records。

### 步骤 3：存储 Webhook 密钥

将 Webhook 密钥安全地存储在您的环境变量中：

```bash
# .env
PAYIN_WEBHOOK_SECRET=whsec_abc123xyz789...
```

::: warning 妥善保管密钥
Webhook 密钥用于验证签名。切勿将其提交到版本控制或在客户端代码中暴露。
:::

### 步骤 4：测试您的端点

使用 notification endpoint test API 验证您的端点是否正常工作：

```bash
curl -X POST https://<your-payin-open-api>/api/v1/notifications/endpoints/<endpoint-id>/test \
  -H "Authorization: Bearer <operator-jwt-or-api-key>"
```

然后检查服务器日志并确认签名验证通过。

## Webhook 载荷结构

所有 Webhook 都遵循此标准结构：

```typescript
{
  id: string;              // 唯一事件 ID (evt_...)
  type: string;            // 事件类型 (order.completed 等)
  created_at: string;      // ISO 8601 时间戳
  data: {                  // 特定于事件的数据
    // 根据事件类型而变化
  }
}
```

### 订单完成事件

```json
{
  "id": "evt_order_completed_ord_abc123",
  "type": "order.completed",
  "created_at": "2025-01-28T12:34:56Z",
  "data": {
    "orderId": "ord_abc123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "txHash": "0xabcdef1234567890...",
    "confirmations": 3,
    "completedAt": "2025-01-28T12:34:45Z",
    "createdAt": "2025-01-28T12:30:00Z"
  }
}
```

### 订单过期事件

```json
{
  "id": "evt_order_expired_ord_xyz789",
  "type": "order.expired",
  "created_at": "2025-01-28T12:50:00Z",
  "data": {
    "orderId": "ord_xyz789",
    "orderReference": "ORDER-2025-002",
    "status": "expired",
    "amount": "50",
    "currency": "USDC",
    "chainId": "polygon-amoy",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "expiresAt": "2025-01-28T12:45:00Z",
    "createdAt": "2025-01-28T12:30:00Z"
  }
}
```

### 充值完成事件

```json
{
  "id": "evt_deposit_completed_0x1234567890abcdef",
  "type": "deposit.completed",
  "created_at": "2025-01-28T13:15:00Z",
  "data": {
    "depositReference": "user_123",
    "token": "USDT",
    "chain": "ethereum-sepolia",
    "amount": "250.500000",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "txHash": "0x1234567890abcdef...",
    "blockNumber": "12345678",
    "timestamp": "2025-01-28T13:14:45.000Z",
    "organizationId": "org_abc123"
  }
}
```

### 充值地址绑定事件

```json
{
  "id": "evt_deposit_address_bound_user_123",
  "type": "deposit.address_bound",
  "created_at": "2025-01-28T12:00:00Z",
  "data": {
    "depositReference": "user_123",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "monitoringTargets": [
      { "chain": "ethereum-sepolia", "contract": "0x...", "token": "USDT" },
      { "chain": "polygon-amoy", "contract": "0x...", "token": "USDC" }
    ]
  }
}
```

## 签名验证

**始终验证 Webhook 签名**以确保请求来自 PayIn 且未被篡改。

### PayIn 如何签名 Webhook

PayIn 使用您的 Webhook 密钥生成 HMAC-SHA256 签名：

```
签名 = HMAC_SHA256(密钥, 时间戳 + '.' + JSON_载荷)
格式: t=<时间戳>,v1=<签名十六进制>
```

签名在 `X-PayIn-Signature` 头中发送。

### 验证实现

#### TypeScript / Node.js

```typescript
import crypto from 'crypto';

function verifySignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    // 1. 解析签名头
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      throw new Error('Invalid signature format');
    }

    const timestamp = parseInt(timestampPart.split('=')[1]);
    const signature = signaturePart.split('=')[1];

    // 2. 检查时间戳容差（防止重放攻击）
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 300; // 5 分钟

    if (now - timestamp > tolerance) {
      throw new Error('Signature timestamp expired');
    }

    // 3. 计算预期签名
    const payload = rawBody.toString('utf8');
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // 4. 比较签名（时间安全）
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
```

**与 Express 一起使用：**

```typescript
import express from 'express';

const app = express();

app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }), // 保留原始 body
  async (req, res) => {
    const signature = req.headers['x-payin-signature'] as string;
    const isValid = verifySignature(
      req.body,  // 原始 buffer
      signature,
      process.env.PAYIN_WEBHOOK_SECRET!
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 处理 Webhook...
    const event = JSON.parse(req.body.toString());
    await handleEvent(event);

    res.json({ received: true });
  }
);
```

#### Python

```python
import hmac
import hashlib
import time
from typing import Dict, Any

def verify_signature(
    raw_body: bytes,
    signature_header: str,
    secret: str,
    tolerance: int = 300
) -> bool:
    try:
        # 1. 解析签名头
        parts = signature_header.split(',')
        timestamp_part = next(p for p in parts if p.startswith('t='))
        signature_part = next(p for p in parts if p.startswith('v1='))

        timestamp = int(timestamp_part.split('=')[1])
        signature = signature_part.split('=')[1]

        # 2. 检查时间戳容差
        now = int(time.time())
        if now - timestamp > tolerance:
            raise ValueError('Signature timestamp expired')

        # 3. 计算预期签名
        payload = raw_body.decode('utf-8')
        signed_payload = f'{timestamp}.{payload}'
        expected_signature = hmac.new(
            secret.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        # 4. 比较签名（时间安全）
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        print(f'Signature verification failed: {e}')
        return False
```

#### PHP

```php
<?php

function verifySignature(
    string $rawBody,
    string $signatureHeader,
    string $secret,
    int $tolerance = 300
): bool {
    try {
        // 1. 解析签名头
        $parts = explode(',', $signatureHeader);
        $timestamp = null;
        $signature = null;

        foreach ($parts as $part) {
            if (str_starts_with($part, 't=')) {
                $timestamp = (int)substr($part, 2);
            } elseif (str_starts_with($part, 'v1=')) {
                $signature = substr($part, 3);
            }
        }

        if (!$timestamp || !$signature) {
            throw new Exception('Invalid signature format');
        }

        // 2. 检查时间戳容差
        $now = time();
        if ($now - $timestamp > $tolerance) {
            throw new Exception('Signature timestamp expired');
        }

        // 3. 计算预期签名
        $signedPayload = $timestamp . '.' . $rawBody;
        $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);

        // 4. 比较签名（时间安全）
        return hash_equals($signature, $expectedSignature);
    } catch (Exception $e) {
        error_log('Signature verification failed: ' . $e->getMessage());
        return false;
    }
}
```

### 安全最佳实践

1. **始终验证签名**
   - 在生产环境中切勿跳过签名验证
   - 立即拒绝签名无效的 Webhook

2. **使用时间安全比较**
   - 使用 `crypto.timingSafeEqual()`（Node.js）
   - 使用 `hmac.compare_digest()`（Python）
   - 使用 `hash_equals()`（PHP）
   - 防止时序攻击

3. **检查时间戳容差**
   - 默认：5 分钟
   - 防止重放攻击
   - 可根据需要调整

4. **保留原始 Body**
   - 签名是基于原始 JSON 字符串计算的
   - 验证前不要解析 body
   - 在 Express 中使用 `express.raw()`

5. **仅使用 HTTPS**
   - 仅通过 HTTPS 暴露 Webhook 端点
   - PayIn 将拒绝 HTTP 端点

## 重试机制

PayIn 使用指数退避策略自动重试失败的 Webhook 交付。

### 重试策略

| 尝试 | 延迟 | 累计时间 |
|---------|-------|-----------------|
| 初始 | 0秒 | 0秒 |
| 重试 1 | 1秒 | 1秒 |
| 重试 2 | 2秒 | 3秒 |
| 重试 3 | 4秒 | 7秒 |
| 重试 4 | 8秒 | 15秒 |
| 重试 5 | 16秒 | 31秒 |

**总计：5 次重试，约 31 秒**

### PayIn 何时重试

PayIn 重试以下情况的 Webhook：
- ✅ 返回 HTTP 5xx（服务器错误）
- ✅ 超时（> 30 秒）
- ✅ 网络错误（连接被拒绝、DNS 失败等）

PayIn **不会**重试以下情况的 Webhook：
- ❌ 返回 HTTP 2xx（成功）
- ❌ 返回 HTTP 4xx（客户端错误 - 错误的端点 URL、认证失败等）

### 处理重试：幂等性

Webhook 可能会被多次交付。您的端点必须幂等地处理重复事件。

**问题：**
```typescript
// ❌ 错误：多次处理 Webhook
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // 如果 Webhook 重试，这会两次增加余额！
  await db.users.update({
    where: { id: userId },
    data: { balance: { increment: event.data.amount } }
  });

  res.json({ received: true });
});
```

**解决方案 1：使用交易哈希作为幂等键**

```typescript
// ✅ 正确：使用 txHash 防止重复处理
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;
  const txHash = event.data.txHash;

  // 检查是否已处理
  const existing = await db.payments.findUnique({
    where: { txHash }
  });

  if (existing) {
    console.log('Already processed:', txHash);
    return res.json({ received: true });
  }

  // 原子处理
  await db.$transaction(async (tx) => {
    await tx.payments.create({
      data: { txHash, amount: event.data.amount }
    });

    await tx.users.update({
      where: { id: userId },
      data: { balance: { increment: event.data.amount } }
    });
  });

  res.json({ received: true });
});
```

**解决方案 2：使用事件 ID 作为幂等键**

```typescript
// ✅ 正确：使用 event.id 防止重复处理
const processedEvents = new Set<string>(); // 生产环境：使用 Redis/数据库

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (processedEvents.has(event.id)) {
    console.log('Already processed event:', event.id);
    return res.json({ received: true });
  }

  await handleEvent(event);
  processedEvents.add(event.id);

  res.json({ received: true });
});
```

### 手动重试

如果所有自动重试都失败，可以通过 notification logs/API 重试：

1. 前往 **设置** → **Webhooks** → **交付历史**
2. 找到失败的交付
3. 点击 **重试**
4. PayIn 立即再次发送 Webhook

## 事件处理模式

### 模式 1：订单完成

当客户完成支付时：

```typescript
async function handleOrderCompleted(event: any) {
  const { orderId, orderReference, amount, currency, txHash } = event.data;

  await db.$transaction(async (tx) => {
    // 1. 检查是否已处理（幂等性）
    const existing = await tx.orders.findUnique({
      where: { id: orderId }
    });

    if (existing?.status === 'fulfilled') {
      console.log('Order already fulfilled:', orderId);
      return;
    }

    // 2. 标记订单为已支付
    await tx.orders.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paidAmount: amount,
        paidCurrency: currency,
        txHash,
        paidAt: new Date()
      }
    });

    // 3. 履行订单（发货、授予访问权限等）
    await fulfillOrder(orderId);

    // 4. 发送确认邮件
    await sendEmail({
      to: existing.customerEmail,
      subject: 'Payment Received',
      body: `Your payment of ${amount} ${currency} has been confirmed.`
    });
  });
}
```

### 模式 2：充值到账

当用户充值资金时：

```typescript
async function handleDepositCompleted(event: any) {
  const { depositReference, amount, token, chain, txHash, depositAddress } = event.data;

  // 从充值引用中提取用户 ID
  const userId = depositReference.replace('user_', '');

  await db.$transaction(async (tx) => {
    // 1. 检查充值是否已处理（幂等性）
    const existing = await tx.deposits.findUnique({
      where: { txHash }
    });

    if (existing) {
      console.log('Deposit already credited:', txHash);
      return;
    }

    // 2. 记录充值
    await tx.deposits.create({
      data: {
        userId,
        amount,
        token,
        chain,
        txHash,
        depositAddress,
        status: 'completed',
        completedAt: new Date()
      }
    });

    // 3. 原子地增加用户余额
    await tx.users.update({
      where: { id: userId },
      data: {
        balance: { increment: parseFloat(amount) }
      }
    });

    // 4. 通知用户
    await notifyUser(userId, {
      type: 'deposit_completed',
      amount,
      token
    });
  });
}
```

### 模式 3：订单过期

当订单未支付而过期时：

```typescript
async function handleOrderExpired(event: any) {
  const { orderId, orderReference } = event.data;

  // 标记订单为已过期
  await db.orders.update({
    where: { id: orderId },
    data: {
      status: 'expired',
      expiredAt: new Date()
    }
  });

  // 可选：通知客户
  const order = await db.orders.findUnique({
    where: { id: orderId }
  });

  if (order.customerEmail) {
    await sendEmail({
      to: order.customerEmail,
      subject: 'Payment Window Expired',
      body: 'Your payment window has expired. Please create a new order.'
    });
  }
}
```

## 测试 Webhook

### 使用 ngrok 进行本地开发

使用 ngrok 将您的本地服务器暴露到互联网以进行 Webhook 测试：

```bash
# 1. 启动您的本地服务器
npm run dev  # 运行在 http://localhost:3000

# 2. 在另一个终端启动 ngrok
ngrok http 3000

# 3. 复制 HTTPS URL（例如：https://abc123.ngrok.io）

# 4. 通过 /api/v1/notifications/endpoints 配置 Webhook
# URL: https://abc123.ngrok.io/webhooks/payin
```

**ngrok 优势：**
- ✅ 真实的 HTTPS 端点
- ✅ 在 ngrok 仪表板中检查 Webhook 请求
- ✅ 重放 Webhook 以便调试
- ✅ 适用于任何本地端口

### 使用 curl 测试

手动发送测试 Webhook：

```bash
# 1. 生成有效签名
TIMESTAMP=$(date +%s)
PAYLOAD='{"id":"test_123","type":"order.completed","created_at":"2025-01-28T12:00:00Z","data":{}}'
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "your_webhook_secret" | cut -d' ' -f2)
HEADER="t=${TIMESTAMP},v1=${SIGNATURE}"

# 2. 发送 Webhook
curl -X POST http://localhost:3000/webhooks/payin \
  -H "Content-Type: application/json" \
  -H "X-PayIn-Signature: ${HEADER}" \
  -H "X-PayIn-Event-Type: order.completed" \
  -H "X-PayIn-Event-Id: test_123" \
  -d "${PAYLOAD}"
```

### 集成测试

为 Webhook 处理编写自动化测试：

```typescript
import { describe, it, expect } from 'vitest';
import { generateSignature } from '@payin/notification';

describe('Webhook Handler', () => {
  it('should handle order.completed event', async () => {
    const event = {
      id: 'evt_test_123',
      type: 'order.completed',
      created_at: new Date().toISOString(),
      data: {
        orderId: 'ord_test',
        orderReference: 'ORDER-TEST-001',
        status: 'completed',
        amount: '100',
        currency: 'USDT',
        txHash: '0xabc123'
      }
    };

    const signature = generateSignature(event, 'test_secret');

    const response = await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    expect(response.status).toBe(200);

    // 验证订单已处理
    const order = await db.orders.findUnique({
      where: { id: 'ord_test' }
    });
    expect(order.status).toBe('paid');
  });

  it('should reject webhooks with invalid signature', async () => {
    const event = {
      id: 'evt_test_456',
      type: 'order.completed',
      created_at: new Date().toISOString(),
      data: {}
    };

    const response = await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': 't=123,v1=invalid'
      },
      body: JSON.stringify(event)
    });

    expect(response.status).toBe(401);
  });

  it('should handle duplicate events idempotently', async () => {
    const event = {
      id: 'evt_test_789',
      type: 'deposit.completed',
      created_at: new Date().toISOString(),
      data: {
        depositReference: 'user_123',
        amount: '50',
        currency: 'USDT',
        txHash: '0xdef456'
      }
    };

    const signature = generateSignature(event, 'test_secret');

    // 发送两次 Webhook
    await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    // 余额应该只增加一次
    const user = await db.users.findUnique({
      where: { id: 'user_123' }
    });
    expect(user.balance).toBe(50); // 不是 100
  });
});
```

## 监控和调试

### Webhook 仪表板

通过 notification logs/API 监控 Webhook 交付：

1. 前往 **设置** → **Webhooks** → **交付历史**
2. 查看最近的交付及其状态：
   - ✅ **成功**：返回 HTTP 200-299
   - ⏳ **待处理**：已安排交付
   - 🔄 **重试中**：失败，将重试
   - ❌ **失败**：所有重试已用尽

3. 点击任何交付以查看：
   - 请求载荷
   - 响应状态和 body
   - 响应时间
   - 重试历史
   - 错误消息（如有）

### 日志记录最佳实践

记录所有 Webhook 活动以便调试：

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'webhooks.log' })
  ]
});

app.post('/webhooks/payin', async (req, res) => {
  const eventId = req.headers['x-payin-event-id'];
  const deliveryId = req.headers['x-payin-delivery-id'];

  logger.info('Webhook received', {
    eventId,
    deliveryId,
    type: req.body.type
  });

  try {
    await handleWebhook(req.body);

    logger.info('Webhook processed successfully', {
      eventId,
      deliveryId
    });

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', {
      eventId,
      deliveryId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({ error: 'Processing failed' });
  }
});
```

### 告警

为 Webhook 失败设置告警：

```typescript
async function checkWebhookHealth() {
  const failedCount = await db.webhookLogs.count({
    where: {
      status: 'failed',
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000) // 最近 15 分钟
      }
    }
  });

  if (failedCount > 10) {
    await sendAlert({
      channel: 'slack',
      message: `🚨 Webhook 告警：最近 15 分钟内 ${failedCount} 个 Webhook 失败`,
      severity: 'high'
    });
  }
}

// 每 5 分钟运行一次
setInterval(checkWebhookHealth, 5 * 60 * 1000);
```

## 故障排除

### 未收到 Webhook

**症状：** 没有 Webhook 到达您的端点

**检查清单：**
1. ✅ 端点使用 HTTPS（不是 HTTP）
2. ✅ 端点可公开访问（不是 localhost）
3. ✅ 防火墙允许传入 HTTPS 流量
4. ✅ 端点已通过 `/api/v1/notifications/endpoints` 正确配置
5. ✅ 已在 endpoint 的 `subscribed_events` 中订阅事件
6. ✅ 检查 notification delivery logs 是否有错误

**测试：**
```bash
# 测试您的端点是否可从外部访问
curl -X POST https://yourapp.com/webhooks/payin \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

### 签名无效错误

**症状：** Webhook 被 401 错误拒绝

**常见原因：**
1. **错误的密钥**：使用 API 密钥而不是 Webhook 密钥
2. **Body 被修改**：验证前解析 JSON
3. **编码问题**：Body 编码与 UTF-8 不匹配

**修复：**
```typescript
// ❌ 错误：验证前解析 Body
app.use(express.json()); // 解析所有 POST body
app.post('/webhooks/payin', async (req, res) => {
  // req.body 现在是对象，不是原始字符串
  verifySignature(req.body, ...); // 失败
});

// ✅ 正确：保留原始 body 用于签名验证
app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }), // 保持原始 buffer
  async (req, res) => {
    verifySignature(req.body, ...); // 成功
    const event = JSON.parse(req.body.toString());
  }
);
```

### 重复事件处理

**症状：** 余额被增加两次，订单被履行多次

**原因：** Webhook 重试未幂等处理

**修复：** 使用交易哈希或事件 ID 作为去重键（参见[幂等性](#处理重试幂等性)）

### 响应时间慢

**症状：** Webhook 超时，频繁重试

**原因：** 同步处理阻塞 Webhook 响应

**修复：异步处理**

```typescript
// ❌ 错误：阻塞 Webhook 响应
app.post('/webhooks/payin', async (req, res) => {
  await sendEmail(); // 需要 3 秒
  await processOrder(); // 需要 5 秒
  await updateInventory(); // 需要 2 秒
  res.json({ received: true }); // 10 秒后响应
});

// ✅ 正确：立即响应，异步处理
import Queue from 'bull';

const webhookQueue = new Queue('webhooks');

app.post('/webhooks/payin', async (req, res) => {
  // 入队处理
  await webhookQueue.add(req.body);

  // 立即响应
  res.json({ received: true }); // < 100ms 响应
});

// 在后台处理 Webhook
webhookQueue.process(async (job) => {
  const event = job.data;
  await sendEmail();
  await processOrder();
  await updateInventory();
});
```

## 最佳实践

### 安全

1. **始终验证签名**
   - 在生产环境中切勿跳过验证
   - 使用时间安全比较
   - 检查时间戳容差

2. **仅使用 HTTPS**
   - PayIn 要求 HTTPS 端点
   - 使用有效的 SSL 证书
   - 不要暴露 HTTP 端点

3. **保护 Webhook 密钥**
   - 存储在环境变量中
   - 切勿提交到版本控制
   - 定期轮换（每 90 天）

### 可靠性

1. **快速响应（< 10秒）**
   - 立即确认收到
   - 异步处理
   - 不要阻塞 Webhook 响应

2. **实现幂等性**
   - 使用 txHash 作为去重键
   - 优雅地处理重复事件
   - 使用原子数据库事务

3. **记录所有内容**
   - 记录所有收到的 Webhook
   - 记录处理结果
   - 包含事件 ID 和交付 ID
   - 设置日志监控和告警

### 性能

1. **异步处理**
   ```typescript
   // 使用作业队列进行重处理
   await queue.add('process-webhook', event);
   res.json({ received: true });
   ```

2. **数据库优化**
   ```typescript
   // 使用数据库事务
   await db.$transaction(async (tx) => {
     // 所有操作都是原子的
   });
   ```

3. **缓存**
   ```typescript
   // 缓存频繁访问的数据
   const user = await cache.getOrFetch(`user:${userId}`, async () => {
     return await db.users.findUnique({ where: { id: userId } });
   });
   ```

## 下一步

### 必要集成

- **[API 集成](/zh/guide/api-integration)** - REST API 指南
- **[安全](/zh/guide/security)** - 安全最佳实践
- **[订单支付服务](/zh/guide/order-payment)** - 订单流程详情

### 核心功能

- **[充值服务](/zh/guide/deposit-service)** - 充值流程详情
- **[支付链接](/zh/guide/payment-links)** - 创建支付 URL

### 参考

- **[支持的网络](/zh/guide/supported-networks)** - 可用的区块链
- **[支持的代币](/zh/guide/supported-tokens)** - 可用的稳定币

## 获取帮助

- **Webhook 问题**：检查 notification delivery logs
- **社区支持**：[Discord 社区](https://discord.gg/payin)

---

**生产检查清单：**
- ✅ 已配置 HTTPS 端点
- ✅ 已实现签名验证
- ✅ 已实现幂等性处理
- ✅ 重操作的异步处理
- ✅ 错误日志和监控
- ✅ 失败 Webhook 的告警
- ✅ 本地使用 ngrok 测试
- ✅ 在主网前在测试网测试
