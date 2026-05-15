# 订单 API

创建和管理一次性支付订单。

## 概述

订单 API 允许您创建带有临时地址的支付订单、查询订单状态和列出所有订单。每个订单都会分配一个唯一的支付地址，该地址在可配置的支付窗口后过期。

**基础端点：** `/api/v1/orders`

**身份验证：** 必需（API 密钥）

## 创建订单

创建一个带有临时支付地址的新支付订单。

**端点：**
```
POST /api/v1/orders
```

**请求体：**

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "productSku": "PROD-123"
  },
  "successUrl": "https://yoursite.com/order/success",
  "cancelUrl": "https://yoursite.com/order/cancel"
}
```

**参数：**

| 参数 | 类型 | 必需 | 描述 |
|-----------|------|----------|-------------|
| `orderReference` | string | 是 | 您的唯一订单标识符（最多 255 个字符） |
| `amount` | string | 是 | 支付金额（十进制字符串，例如 "100.00"） |
| `currency` | string | 是 | 货币代码（`USDT`、`USDC`、`DAI`） |
| `chainId` | string | 是 | 区块链链 ID（参见[支持的网络](/zh/guide/supported-networks)） |
| `metadata` | object | 否 | 自定义元数据（最多 10 个键值对） |
| `successUrl` | string | 否 | 支付成功后的重定向 URL |
| `cancelUrl` | string | 否 | 订单过期后的重定向 URL |

**响应（201 Created）：**

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "protocol": "evm",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "productSku": "PROD-123"
  },
  "successUrl": "https://yoursite.com/order/success",
  "cancelUrl": "https://yoursite.com/order/cancel",
  "createdAt": "2025-01-20T10:30:00.000Z",
  "expiresAt": "2025-01-20T10:40:00.000Z"
}
```

**示例（cURL）：**

```bash
curl -X POST https://testnet.payin.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "100.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

**示例（TypeScript）：**

```typescript
const response = await fetch('https://testnet.payin.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.PAYIN_API_KEY!
  },
  body: JSON.stringify({
    orderReference: `ORDER-${Date.now()}`,
    amount: '100.00',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    metadata: {
      userId: 'user_123',
      productId: 'prod_456'
    },
    successUrl: 'https://yoursite.com/payment/success',
    cancelUrl: 'https://yoursite.com/payment/cancel'
  })
});

const order = await response.json();
console.log('Order created:', order.orderId);
console.log('Payment address:', order.address);
```

**示例（Python）：**

```python
import requests
import time

response = requests.post(
    'https://testnet.payin.com/api/v1/orders',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': os.getenv('PAYIN_API_KEY')
    },
    json={
        'orderReference': f'ORDER-{int(time.time())}',
        'amount': '100.00',
        'currency': 'USDT',
        'chainId': 'ethereum-sepolia',
        'metadata': {
            'userId': 'user_123',
            'productId': 'prod_456'
        }
    }
)

order = response.json()
print(f"Order ID: {order['orderId']}")
print(f"Payment address: {order['address']}")
```

## 获取订单

检索特定订单的详细信息。

**端点：**
```
GET /api/v1/orders/:orderId
```

**路径参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `orderId` | string | 订单 ID（例如 `ord_abc123def456`） |

**响应（200 OK）：**

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "protocol": "evm",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "completed",
  "metadata": {
    "customerName": "John Doe"
  },
  "successUrl": "https://yoursite.com/order/success",
  "createdAt": "2025-01-20T10:30:00.000Z",
  "expiresAt": "2025-01-20T10:40:00.000Z",
  "completedAt": "2025-01-20T10:35:22.000Z",
  "txHash": "0xabc123...",
  "blockNumber": 1234567,
  "confirmations": 12
}
```

**示例（cURL）：**

```bash
curl https://testnet.payin.com/api/v1/orders/ord_abc123def456 \
  -H "X-API-Key: your-api-key"
```

**示例（TypeScript）：**

```typescript
const response = await fetch(
  `https://testnet.payin.com/api/v1/orders/${orderId}`,
  {
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY!
    }
  }
);

const order = await response.json();
console.log('Order status:', order.status);

if (order.status === 'completed') {
  console.log('Payment confirmed!');
  console.log('Transaction:', order.txHash);
}
```

## 通过订单编号获取订单

使用您自己的订单编号检索订单。

**端点：**
```
GET /api/v1/orders/by-reference/:orderReference
```

**路径参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `orderReference` | string | 您的订单编号 |

**响应：** 与"获取订单"相同

**示例：**

```bash
curl https://testnet.payin.com/api/v1/orders/by-reference/ORDER-2025-001 \
  -H "X-API-Key: your-api-key"
```

## 列出订单

获取所有订单的分页列表。

**端点：**
```
GET /api/v1/orders
```

**查询参数：**

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `page` | integer | 1 | 页码 |
| `limit` | integer | 20 | 每页项目数（最大：100） |
| `status` | string | - | 按状态过滤：`pending`、`completed`、`expired` |
| `currency` | string | - | 按货币过滤：`USDT`、`USDC`、`DAI` |
| `chainId` | string | - | 按链过滤 |
| `orderReference` | string | - | 按订单编号搜索 |
| `sortBy` | string | `createdAt` | 排序字段 |
| `sortOrder` | string | `desc` | 排序方向：`asc`、`desc` |

**响应（200 OK）：**

```json
{
  "data": [
    {
      "orderId": "ord_abc123def456",
      "orderReference": "ORDER-2025-001",
      "amount": "100.00",
      "currency": "USDT",
      "chainId": "ethereum-sepolia",
      "address": "0x742d35...",
      "status": "completed",
      "createdAt": "2025-01-20T10:30:00.000Z",
      "completedAt": "2025-01-20T10:35:22.000Z"
    },
    // ... 更多订单
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**示例（cURL）：**

```bash
# 获取待处理订单
curl "https://testnet.payin.com/api/v1/orders?status=pending&limit=10" \
  -H "X-API-Key: your-api-key"

# 获取按金额排序的 USDT 订单
curl "https://testnet.payin.com/api/v1/orders?currency=USDT&sortBy=amount&sortOrder=desc" \
  -H "X-API-Key: your-api-key"
```

**示例（TypeScript）：**

```typescript
// 获取所有待处理订单
const response = await fetch(
  'https://testnet.payin.com/api/v1/orders?status=pending',
  {
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY!
    }
  }
);

const { data: orders, pagination } = await response.json();

console.log(`Found ${pagination.total} pending orders`);
orders.forEach(order => {
  console.log(`${order.orderReference}: ${order.amount} ${order.currency}`);
});
```

## 订单状态流转

订单通过以下状态转换：

```
pending → completed（收到并确认付款）
pending → expired（支付窗口过期且未收到付款）
```

**状态定义：**

| 状态 | 描述 | 终态 |
|--------|-------------|----------|
| `pending` | 订单已创建，等待付款 | 否 |
| `completed` | 收到并确认付款 | 是 |
| `expired` | 支付窗口过期且未收到有效付款 | 是 |

::: tip Webhook 事件
- `order.completed` - 当订单收到已确认的付款时触发
- `order.expired` - 当订单过期且未收到付款时触发

详见 [Webhooks 指南](/zh/guide/webhooks)。
:::

## 支付窗口

订单有一个可配置的支付窗口（默认：10 分钟）：

**时间线：**
```
订单创建 → 支付窗口（10 分钟）→ 宽限期（5 分钟）→ 过期
     ↓                                                ↓
  pending                                         expired
```

- **支付窗口**：用户应在此时间内发送付款
- **宽限期**：交易确认的额外时间
- **过期后**：订单无法支付，需创建新订单

**配置：**
```bash
# 将支付窗口设置为 15 分钟
PUT /api/v1/config/payment_window_minutes
{
  "value": 15
}
```

## 元数据

在订单中存储自定义数据（最多 10 个键值对）：

```json
{
  "metadata": {
    "userId": "user_123",
    "productId": "prod_456",
    "productName": "Premium Subscription",
    "customerEmail": "user@example.com",
    "internalNotes": "VIP customer"
  }
}
```

**用例：**
- 将订单链接到您的内部系统
- 存储客户信息
- 跟踪产品详细信息
- 添加内部备注

::: warning 元数据隐私
元数据会在 API 响应和 webhook 中返回。不要存储敏感信息，如密码或完整的信用卡号。
:::

## 重定向 URL

配置付款后将用户发送到何处：

```json
{
  "successUrl": "https://yoursite.com/order/success?orderId={{orderId}}",
  "cancelUrl": "https://yoursite.com/order/cancel?orderId={{orderId}}"
}
```

**添加的 URL 参数：**
- `orderReference` - 您的订单编号
- `status` - 订单状态
- `amount` - 支付金额
- `currency` - 支付货币
- `chainId` - 区块链链
- `txHash` - 交易哈希（成功时）

**示例重定向：**
```
https://yoursite.com/order/success
  ?orderReference=ORDER-2025-001
  &status=completed
  &amount=100.00
  &currency=USDT
  &chainId=ethereum-sepolia
  &txHash=0xabc123...
```

**回退到全局配置：**
如果未指定，使用全局默认值：
- `default_order_success_url`
- `default_order_cancel_url`

## 错误响应

### 重复订单编号（409 Conflict）

```json
{
  "error": "Duplicate order reference",
  "message": "Order with reference 'ORDER-2025-001' already exists",
  "code": "DUPLICATE_ORDER_REFERENCE",
  "statusCode": 409,
  "existingOrderId": "ord_abc123"
}
```

**解决方案：** 使用唯一的订单编号或获取现有订单。

### 无可用地址（503 Service Unavailable）

```json
{
  "error": "No available addresses",
  "message": "Address pool exhausted for protocol 'evm'",
  "code": "NO_AVAILABLE_ADDRESSES",
  "statusCode": 503
}
```

**解决方案：** 向地址池导入更多地址。参见[地址管理](/zh/guide/address-management)。

### 无效金额（400 Bad Request）

```json
{
  "error": "Invalid amount",
  "message": "Amount must be a positive number",
  "code": "INVALID_AMOUNT",
  "statusCode": 400
}
```

**解决方案：** 提供有效的正十进制字符串（例如 "100.00"）。

### 无效链（400 Bad Request）

```json
{
  "error": "Invalid chain",
  "message": "Chain 'invalid-chain' is not supported",
  "code": "INVALID_CHAIN",
  "statusCode": 400
}
```

**解决方案：** 使用来自[支持的网络](/zh/guide/supported-networks)的有效链 ID。

## 最佳实践

### 1. 使用唯一的订单编号

```typescript
// ✅ 好：基于时间戳的编号
const orderReference = `ORDER-${Date.now()}-${userId}`;

// ✅ 好：基于 UUID 的编号
import { v4 as uuidv4 } from 'uuid';
const orderReference = `ORDER-${uuidv4()}`;

// ❌ 坏：顺序数字（可能冲突）
const orderReference = `ORDER-${orderCount}`;
```

### 2. 优雅地处理错误

```typescript
try {
  const response = await createOrder(orderData);
  return response;
} catch (error) {
  if (error.code === 'DUPLICATE_ORDER_REFERENCE') {
    // 获取现有订单
    return await getOrderByReference(orderData.orderReference);
  }
  throw error;
}
```

### 3. 存储订单 ID

```typescript
// 将 PayIn 订单 ID 保存到您的数据库
await db.orders.update({
  where: { id: yourOrderId },
  data: {
    payinOrderId: order.orderId,
    paymentAddress: order.address,
    paymentStatus: 'pending'
  }
});
```

### 4. 使用 Webhook

不要轮询订单状态。改用 webhook：

```typescript
// ❌ 坏：轮询
setInterval(async () => {
  const order = await getOrder(orderId);
  if (order.status === 'completed') {
    // 处理完成
  }
}, 5000);

// ✅ 好：Webhook
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'order.completed') {
    await handleOrderCompletion(event.data);
  }

  res.json({ received: true });
});
```

### 5. 设置适当的支付窗口

```typescript
// 短期项目（结账）
const order = await createOrder({
  ...orderData,
  // 使用全局配置（默认 10 分钟）
});

// 高价值项目（考虑更长的窗口）
// 通过配置 API 全局配置
```

## 下一步

- [设置 webhook →](/zh/guide/webhooks)
- [了解充值 →](/zh/api/deposits)
- [查看集成示例 →](/zh/examples/order-payment)
- [阅读安全最佳实践 →](/zh/guide/security)
