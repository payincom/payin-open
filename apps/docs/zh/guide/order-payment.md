# 订单支付服务

订单支付服务为每笔交易提供一次性支付地址。它非常适合电商结账、服务付费以及任何需要为每笔交易提供唯一支付地址的场景。

## 什么是订单支付服务？

订单支付服务为每个订单分配一个临时支付地址。当收到并确认付款后，订单会自动完成，地址会被释放回地址池以供将来使用。

**核心特性：**
- 🎯 **一单一地址** - 每个订单获得唯一的支付地址
- ⏱️ **限时支付** - 订单有支付窗口和宽限期
- ♻️ **地址回收** - 订单完成后地址返回地址池
- 🔗 **单链监控** - 每个订单监控一条特定的区块链
- 🏢 **多租户** - 完整的组织隔离

## 订单 vs 充值

了解订单和充值服务的区别：

| 特性 | 订单支付 | 充值服务 |
|---------|---------------|-----------------|
| **地址** | 临时（使用后回收） | 永久（绑定用户） |
| **生命周期** | 几分钟到几小时 | 长期（几个月/几年） |
| **监控** | 创建时指定的单条链 | 多条链（协议族） |
| **使用场景** | 电商结账、发票 | 用户钱包、定期充值 |
| **过期** | 是（支付窗口 + 宽限期） | 无过期 |

**何时使用订单支付：**
- 电商产品结账
- 服务费支付
- 发票支付
- 活动门票购买
- 一次性捐赠

## 快速开始

### 前置条件

在创建订单之前，请确保您已：

1. ✅ **PayIn 账户** - 在 [testnet.payin.com](https://testnet.payin.com) 或 [app.payin.com](https://app.payin.com) 注册
2. ✅ **API 密钥** - 从管理后台生成
3. ✅ **地址池** - 至少导入几个地址（参见 [地址池设置](/zh/guide/address-pool-setup)）
4. ✅ **支持的网络** - 从[支持的网络](/zh/guide/supported-networks)中选择

::: tip 先检查地址池
如果您的地址池为空，订单创建将失败并提示"地址池中无可用地址"。请在继续之前导入地址。
:::

### 示例 1：创建您的第一个订单（MCP）

使用 PayIn 配合 Claude Desktop 或 Cline：

```
创建一个支付订单：
- 订单编号：ORDER-2025-001
- 金额：10 USDT
- 链：ethereum-sepolia
```

AI 助手将：
1. 调用 `create_order` 工具
2. 从您的地址池分配一个支付地址
3. 启动区块链监控
4. 返回带二维码的支付详情

**预期响应：**
```
✅ 订单创建成功！

订单 ID：550e8400-e29b-41d4-a716-446655440123
支付地址：0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1
金额：10 USDT
链：ethereum-sepolia
状态：pending
过期时间：2025-01-28T14:45:00Z

买家应向上述地址发送正好 10 USDT。
支付窗口：10 分钟
宽限期：5 分钟（总计 15 分钟）
```

### 示例 2：通过 API 创建订单

**使用 cURL：**

```bash
curl -X POST https://testnet.payin.com/api/v1/orders \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

**使用 TypeScript：**

```typescript
const response = await fetch('https://testnet.payin.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderReference: 'ORDER-2025-001',
    amount: '10',
    currency: 'USDT',
    chainId: 'ethereum-sepolia'
  })
});

const result = await response.json();
console.log('Order created:', result.data);
```

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "status": "pending",
    "expiresAt": "2025-01-28T14:45:00Z",
    "qrCode": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1:10:USDT"
  },
  "message": "Order created successfully"
}
```

### 示例 3：查询订单状态

**通过 API：**

```bash
curl https://testnet.payin.com/api/v1/orders/550e8400-e29b-41d4-a716-446655440123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**通过 MCP：**

```
订单 550e8400-e29b-41d4-a716-446655440123 的状态是什么？
```

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "confirmedReceived": "10.000000",
    "completedAt": "2025-01-28T14:38:25Z",
    "transactionHash": "0xabc123..."
  }
}
```

## 订单生命周期

### 完整流程图

```
1. 创建订单
   ↓
2. 分配地址（从地址池）
   ↓
3. 启动监控（区块链 + 支付地址）
   ↓
4. 支付窗口（默认：10 分钟）
   ↓ [检测到支付]
5. 等待确认（链特定：3-10 个区块）
   ↓ [足够的确认]
6. 订单完成
   ↓
7. 停止监控
   ↓
8. 释放地址（冷却后返回地址池）
```

### 状态转换

PayIn 使用简单的 3 状态机：

```
pending → completed  (收到支付并确认)
        ↓
        → expired    (超时未收到足够支付)
```

**状态含义：**

- **`pending`**：订单已创建，等待支付和区块确认
- **`completed`**：支付已收到并成功确认
- **`expired`**：超时未收到足够支付

::: tip 终态
`completed` 和 `expired` 都是终态 - 订单无法从这些状态转换出去。
:::

### 超时机制

订单使用**双超时**机制以确保可靠性：

**1. 支付窗口（默认：10 分钟）**
- 用户完成支付的主要时间
- 此窗口后，不应发起新支付
- 系统在宽限期内继续监控

**2. 宽限期（默认：5 分钟）**
- 为待确认交易提供的额外时间
- 确保在超时前发起的支付仍可完成
- 宽限期后，如支付不足订单变为 `expired`

**总超时 = 支付窗口 + 宽限期**

```typescript
// 示例：自定义超时
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "paymentWindowMinutes": 15,  // 自定义：15 分钟
  "gracePeriodMinutes": 10     // 自定义：10 分钟
}
```

::: warning 最大超时
总超时不能超过系统最大值（默认：60 分钟）。请检查您的 PayIn 配置。
:::

## API 参考

### 创建订单

使用唯一支付地址创建新的支付订单。

**端点：** `POST /api/v1/orders`

**必填字段：**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `orderReference` | string | 您系统的唯一订单标识符 |
| `amount` | string | 支付金额（例如 "10", "99.50"） |
| `currency` | string | 代币符号（例如 "USDT", "USDC"） |
| `chainId` | string | 区块链标识符（例如 "ethereum-sepolia"） |

**可选字段：**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `paymentWindowMinutes` | number | 自定义支付窗口（默认：10） |
| `gracePeriodMinutes` | number | 自定义宽限期（默认：5） |
| `successUrl` | string | 订单完成时的跳转 URL |
| `cancelUrl` | string | 订单过期时的跳转 URL |
| `metadata` | object | 附加到订单的自定义数据 |

**请求示例：**

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "successUrl": "https://myshop.com/orders/ORDER-2025-001/success",
  "cancelUrl": "https://myshop.com/orders/ORDER-2025-001/cancel",
  "metadata": {
    "customer_id": "user_12345",
    "product_id": "prod_xyz",
    "source": "web_checkout"
  }
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "status": "pending",
    "expiresAt": "2025-01-28T14:45:00Z",
    "qrCode": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1:10:USDT"
  }
}
```

### 获取订单

通过订单 ID 获取订单详情。

**端点：** `GET /api/v1/orders/:orderId`

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "confirmedReceived": "10.000000",
    "requiredConfirmations": 3,
    "paymentWindowEndsAt": "2025-01-28T14:40:00Z",
    "gracePeriodEndsAt": "2025-01-28T14:45:00Z",
    "createdAt": "2025-01-28T14:30:00Z",
    "completedAt": "2025-01-28T14:38:25Z",
    "metadata": {
      "customer_id": "user_12345",
      "product_id": "prod_xyz",
      "source": "web_checkout"
    }
  }
}
```

### 列出订单

列出所有订单，支持筛选和分页。

**端点：** `GET /api/v1/orders`

**查询参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `status` | string | 按状态筛选：`pending`, `completed`, `expired` |
| `chain` | string | 按链 ID 筛选 |
| `token` | string | 按代币符号筛选 |
| `orderReference` | string | 按订单编号搜索 |
| `createdAfter` | ISO8601 | 按创建日期筛选（之后） |
| `createdBefore` | ISO8601 | 按创建日期筛选（之前） |
| `page` | number | 页码（默认：1） |
| `limit` | number | 每页数量（默认：20，最大：100） |
| `sortBy` | string | 排序字段：`created_at`, `updated_at`, `amount` |
| `sortOrder` | string | 排序方向：`ASC` 或 `DESC` |

**请求示例：**

```bash
curl "https://testnet.payin.com/api/v1/orders?status=completed&chain=ethereum-sepolia&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**响应：**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "550e8400-e29b-41d4-a716-446655440123",
        "orderReference": "ORDER-2025-001",
        "status": "completed",
        "amount": "10",
        "currency": "USDT",
        "chainId": "ethereum-sepolia",
        "completedAt": "2025-01-28T14:38:25Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 10
  }
}
```

### 获取订单统计

获取订单的聚合统计信息。

**端点：** `GET /api/v1/orders/stats`

**查询参数：** 与列出订单相同（用于筛选）

**响应：**

```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "completedOrders": 120,
    "pendingOrders": 5,
    "expiredOrders": 25,
    "totalAmount": "15234.50",
    "completedAmount": "14120.00",
    "avgPaymentTimeSeconds": 342,
    "byStatus": {
      "completed": 120,
      "pending": 5,
      "expired": 25
    },
    "byChain": {
      "ethereum-sepolia": 80,
      "polygon-amoy": 70
    },
    "byToken": {
      "USDT": 100,
      "USDC": 50
    }
  }
}
```

## 集成示例

### 电商结账流程

在线商店的完整集成示例：

```typescript
import { PayInClient } from '@payin/sdk'; // 假设的 SDK

class CheckoutService {
  private payin: PayInClient;

  constructor(apiKey: string) {
    this.payin = new PayInClient({
      apiKey,
      baseUrl: 'https://testnet.payin.com/api/v1',
    });
  }

  /**
   * 步骤 1：用户在结账时点击"加密货币支付"
   */
  async createPaymentOrder(checkoutData: {
    orderId: string;
    totalAmount: number;
    currency: string;
    chain: string;
    customerId: string;
    items: any[];
  }) {
    try {
      // 创建 PayIn 订单
      const order = await this.payin.orders.create({
        orderReference: checkoutData.orderId,
        amount: checkoutData.totalAmount.toString(),
        currency: checkoutData.currency,
        chainId: checkoutData.chain,
        successUrl: `https://myshop.com/checkout/success?order=${checkoutData.orderId}`,
        cancelUrl: `https://myshop.com/checkout/cancel?order=${checkoutData.orderId}`,
        metadata: {
          customer_id: checkoutData.customerId,
          items: checkoutData.items,
          total_items: checkoutData.items.length,
        },
      });

      // 在您的数据库中存储 PayIn 订单 ID
      await this.db.orders.update(checkoutData.orderId, {
        payinOrderId: order.orderId,
        paymentAddress: order.paymentAddress,
        paymentStatus: 'awaiting_payment',
        expiresAt: order.expiresAt,
      });

      return {
        orderId: order.orderId,
        paymentAddress: order.paymentAddress,
        amount: order.amount,
        currency: order.currency,
        chain: order.chainId,
        expiresAt: order.expiresAt,
        qrCode: this.generateQRCode(order.paymentAddress, order.amount, order.currency),
      };
    } catch (error) {
      console.error('Failed to create payment order:', error);
      throw new Error('Payment creation failed. Please try again.');
    }
  }

  /**
   * 步骤 2：向用户显示支付页面
   */
  renderPaymentPage(order: any) {
    return {
      paymentAddress: order.paymentAddress,
      amount: order.amount,
      currency: order.currency,
      chain: order.chainId,
      qrCode: order.qrCode,
      expiresAt: order.expiresAt,
      instructions: [
        `向上述地址发送正好 ${order.amount} ${order.currency}`,
        `网络：${order.chainId}`,
        `支付将在 ${this.getTimeRemaining(order.expiresAt)} 分钟后过期`,
      ],
    };
  }

  /**
   * 步骤 3：轮询订单状态（webhook 的替代方案）
   */
  async pollOrderStatus(orderId: string): Promise<OrderStatus> {
    const order = await this.payin.orders.get(orderId);

    // 更新您的数据库
    await this.db.orders.updateByPayinOrderId(orderId, {
      paymentStatus: order.status,
      confirmedAmount: order.confirmedReceived,
      completedAt: order.completedAt,
    });

    return order.status;
  }

  /**
   * 步骤 4：处理 webhook 通知（推荐）
   */
  async handleWebhook(event: PayInWebhookEvent) {
    // 验证 webhook 签名（对安全性很重要！）
    if (!this.payin.webhooks.verify(event)) {
      throw new Error('Invalid webhook signature');
    }

    if (event.type === 'order.completed') {
      const orderReference = event.data.orderReference;

      // 更新您的订单状态
      await this.db.orders.update(orderReference, {
        paymentStatus: 'paid',
        paidAt: event.data.completedAt,
        transactionHash: event.data.transactionHash,
      });

      // 触发订单履行
      await this.fulfillmentService.processOrder(orderReference);

      // 发送确认邮件
      await this.emailService.sendPaymentConfirmation(orderReference);
    } else if (event.type === 'order.expired') {
      const orderReference = event.data.orderReference;

      // 标记为已过期
      await this.db.orders.update(orderReference, {
        paymentStatus: 'expired',
      });

      // 发送过期通知
      await this.emailService.sendPaymentExpired(orderReference);
    }
  }

  private generateQRCode(address: string, amount: string, currency: string): string {
    // 使用支付详情生成二维码
    // 实现取决于您的二维码库
    return `data:image/png;base64,...`;
  }

  private getTimeRemaining(expiresAt: Date): number {
    return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000);
  }
}
```

### 服务支付（咨询发票）

服务型企业的示例：

```typescript
class InvoicePaymentService {
  async createInvoicePayment(invoice: {
    invoiceNumber: string;
    clientId: string;
    amount: number;
    description: string;
    dueDate: Date;
  }) {
    // 为发票创建 PayIn 订单，使用更长的支付窗口
    const order = await fetch('https://testnet.payin.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderReference: invoice.invoiceNumber,
        amount: invoice.amount.toString(),
        currency: 'USDT',
        chainId: 'ethereum-sepolia',
        paymentWindowMinutes: 4320, // 3 天（72 小时）
        gracePeriodMinutes: 1440,   // 1 天（24 小时）
        successUrl: `https://consulting.com/invoices/${invoice.invoiceNumber}/paid`,
        metadata: {
          client_id: invoice.clientId,
          description: invoice.description,
          due_date: invoice.dueDate.toISOString(),
          invoice_type: 'consulting_services',
        },
      }),
    });

    const result = await order.json();

    if (!result.success) {
      throw new Error(`Failed to create payment order: ${result.message}`);
    }

    // 发送带支付说明的发票邮件
    await this.sendInvoiceEmail(invoice, result.data);

    return result.data;
  }

  private async sendInvoiceEmail(invoice: any, paymentOrder: any) {
    const emailContent = `
      发票：${invoice.invoiceNumber}
      应付金额：${paymentOrder.amount} ${paymentOrder.currency}

      支付说明：
      1. 向以下地址发送 ${paymentOrder.amount} ${paymentOrder.currency}：
         ${paymentOrder.paymentAddress}
      2. 网络：${paymentOrder.chainId}
      3. 支付过期时间：${new Date(paymentOrder.expiresAt).toLocaleString()}

      附带二维码以便快速支付。
    `;

    // 发送带支付详情的邮件
    // ...
  }
}
```

## 高级配置

### 自定义支付窗口

根据您的使用场景调整超时时间：

```typescript
// 快速支付（活动门票）
{
  "paymentWindowMinutes": 5,  // 5 分钟支付
  "gracePeriodMinutes": 3     // 3 分钟宽限期
}

// 标准电商
{
  "paymentWindowMinutes": 10,  // 默认
  "gracePeriodMinutes": 5      // 默认
}

// 发票支付
{
  "paymentWindowMinutes": 4320,  // 3 天
  "gracePeriodMinutes": 1440     // 1 天
}
```

::: tip 选择支付窗口
- **短期（5-10 分钟）**：时效性商品（活动门票、限量库存）
- **中期（15-30 分钟）**：标准电商结账
- **长期（小时/天）**：发票、B2B 支付、高价值商品
:::

### 跳转 URL

配置用户支付后的跳转位置：

```typescript
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",

  // 带订单信息的跳转 URL
  "successUrl": "https://myshop.com/orders/ORDER-2025-001/success",
  "cancelUrl": "https://myshop.com/orders/ORDER-2025-001/cancel"
}
```

**PayIn 添加的 URL 参数：**

跳转时，PayIn 会附加这些参数：

```
?order_reference=ORDER-2025-001
&status=completed
&amount=10
&currency=USDT
&chain_id=ethereum-sepolia
&completed_at=2025-01-28T14:38:25Z
&tx_hash=0xabc123...
```

**完整跳转示例：**

```
https://myshop.com/orders/ORDER-2025-001/success?order_reference=ORDER-2025-001&status=completed&amount=10&currency=USDT&chain_id=ethereum-sepolia&completed_at=2025-01-28T14:38:25Z&tx_hash=0xabc123...
```

::: tip 默认跳转 URL
您可以在 PayIn 管理后台配置组织级别的默认跳转 URL。订单级 URL 优先于默认值。
:::

### 订单元数据

为订单附加自定义数据：

```typescript
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "metadata": {
    // 客户信息
    "customer_id": "user_12345",
    "customer_email": "buyer@example.com",

    // 订单详情
    "product_ids": ["prod_abc", "prod_xyz"],
    "shipping_address_id": "addr_789",
    "discount_code": "SAVE10",

    // 内部跟踪
    "source": "web_checkout",
    "campaign": "summer_sale_2025",
    "referrer": "google_ads",

    // 任何自定义字段
    "notes": "Gift wrapping requested"
  }
}
```

元数据：
- ✅ 与订单一起存储
- ✅ 在 API 响应中返回
- ✅ 包含在 webhook 事件中
- ✅ 通过 API 完全可搜索

## 最佳实践

### 订单编号设计

使用结构化、唯一的订单编号：

**好的示例：**
```
ORDER-2025-001
INV-2025-Q1-12345
TICKET-EVENT789-SEAT42
```

**避免：**
```
order1          // 不够唯一
12345          // 无上下文
tmp_order      // 非永久性
```

::: tip 唯一性至关重要
订单编号在您的组织内必须唯一。PayIn 会拒绝重复的订单编号以防止意外重复收费。
:::

### 金额精度

始终使用字符串格式表示金额以避免浮点错误：

**正确：**
```typescript
{
  "amount": "10.50"      // ✅ 字符串
  "amount": "99.99"      // ✅ 字符串
  "amount": "1000.000"   // ✅ 带额外精度的字符串
}
```

**错误：**
```typescript
{
  "amount": 10.50       // ❌ 数字（可能丢失精度）
  "amount": 0.1 + 0.2   // ❌ JavaScript 浮点错误（0.30000000000000004）
}
```

### 错误处理

处理所有错误场景：

```typescript
try {
  const order = await payin.orders.create(orderData);
  return order;
} catch (error) {
  if (error.code === 'INSUFFICIENT_ADDRESSES') {
    // 地址池中无可用地址
    return {
      error: '支付系统暂时不可用。请几分钟后再试。',
      shouldRetry: true,
    };
  } else if (error.code === 'DUPLICATE_ORDER_REFERENCE') {
    // 订单编号已存在
    return {
      error: '此订单已创建。',
      shouldRetry: false,
    };
  } else if (error.code === 'INVALID_CHAIN_TOKEN_COMBINATION') {
    // 所选链上不支持该代币
    return {
      error: '所选支付方式不可用。请选择其他选项。',
      shouldRetry: false,
    };
  } else {
    // 未知错误
    console.error('Order creation failed:', error);
    return {
      error: '创建支付订单失败。请联系支持。',
      shouldRetry: false,
    };
  }
}
```

### 监控订单状态

**选项 1：Webhook（推荐）**

```typescript
// 在管理后台配置 webhook 端点
// https://myshop.com/webhooks/payin

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // 验证签名（关键！）
  const signature = req.headers['x-payin-signature'];
  if (!verifySignature(event, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // 处理事件
  if (event.type === 'order.completed') {
    await handleOrderCompleted(event.data);
  } else if (event.type === 'order.expired') {
    await handleOrderExpired(event.data);
  }

  res.status(200).send('OK');
});
```

**选项 2：轮询（后备方案）**

```typescript
// 每 10 秒轮询订单状态
async function pollOrderStatus(orderId: string) {
  const maxAttempts = 90; // 15 分钟（90 * 10 秒）
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    try {
      const order = await payin.orders.get(orderId);

      if (order.status === 'completed') {
        clearInterval(interval);
        await handleOrderCompleted(order);
      } else if (order.status === 'expired') {
        clearInterval(interval);
        await handleOrderExpired(order);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('Max polling attempts reached for order:', orderId);
      }
    } catch (error) {
      console.error('Failed to fetch order status:', error);
    }
  }, 10000); // 10 秒
}
```

::: warning Webhook vs 轮询
Webhook 是生产系统的推荐方法。轮询应仅用作后备方案或在开发期间使用。
:::

### 测试策略

**1. 测试网测试：**

```typescript
// 在所有开发和测试中使用测试网
const payin = new PayInClient({
  apiKey: process.env.PAYIN_TESTNET_API_KEY,
  baseUrl: 'https://testnet.payin.com/api/v1',
});

// 从水龙头获取测试网代币
// Ethereum Sepolia: https://sepolia-faucet.pk910.de/
// Polygon Amoy: https://faucet.polygon.technology/
```

**2. 测试场景：**

- ✅ 成功支付（精确金额）
- ✅ 支付超时（未发送支付）
- ✅ 部分支付（金额不足）
- ✅ 超额支付（超过所需金额）
- ✅ 多次支付（累计金额）
- ✅ 网络故障和重试
- ✅ Webhook 交付和签名验证

**3. 主网迁移：**

```typescript
// 仅在充分的测试网测试后切换到主网
const payin = new PayInClient({
  apiKey: process.env.PAYIN_MAINNET_API_KEY,
  baseUrl: 'https://app.payin.com/api/v1', // 生产 URL
});
```

## 故障排除

### "地址池中无可用地址"

**问题：** 订单创建失败，提示地址池错误。

**解决方案：**
1. 在管理后台检查地址池状态
2. 按照[地址池设置](/zh/guide/address-pool-setup)导入更多地址
3. 确保地址适用于正确的协议（EVM/Tron）

```bash
# 通过 API 检查池状态
curl https://testnet.payin.com/api/v1/address-pool/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 订单已过期但已发送支付

**问题：** 用户已发送支付但订单在确认前过期。

**原因：**
- 网络拥堵（区块确认慢）
- 用户在过期时间临近时发送支付
- 错误的网络 gas 设置（gas 价格太低）

**解决方案：**
1. **增加宽限期**以处理高价值订单
2. **联系支持**并提供交易哈希 - PayIn 可以手动核对
3. **退款给客户**如果支付到达太晚（您已收到资金）

### 错误的链或代币

**问题：** 用户发送了错误的代币或在错误的网络上。

**预防：**
- 在支付页面上清楚显示网络和代币
- 显示网络名称（不仅是链 ID）
- 包含关于正确网络的警告

**如果发生：**
- 发送到错误地址的资金无法自动恢复
- 用户必须联系您的支持并提供交易详情
- PayIn 支持可以协助地址验证

### 重复订单编号

**问题：** API 返回关于重复订单编号的错误。

**原因：** 尝试使用已使用的编号创建订单。

**解决方案：**
```typescript
// 生成唯一编号
const orderReference = `ORDER-${Date.now()}-${generateRandomId()}`;

// 或先检查是否存在订单
const existing = await payin.orders.list({
  orderReference: proposedReference,
});

if (existing.total > 0) {
  throw new Error('Order reference already exists');
}
```

## 下一步

### 必读指南
- [Webhook](/zh/guide/webhooks) - 设置自动事件通知
- [API 集成](/zh/guide/api-integration) - 完整 API 文档
- [安全性](/zh/guide/security) - 保护您的集成

### 相关服务
- [充值服务](/zh/guide/deposit-service) - 用于定期支付的永久用户地址
- [支付链接](/zh/guide/payment-links) - 无代码支付收款

### 技术参考
- [支持的网络](/zh/guide/supported-networks) - 可用的区块链
- [支持的代币](/zh/guide/supported-tokens) - 可用的稳定币
- [地址管理](/zh/guide/address-management) - 高级地址池管理

## 支持

需要订单支付服务的帮助？

- 📧 **邮箱**：support@payin.com
- 💬 **Discord**：[加入我们的社区](https://discord.gg/payin)
- 🤖 **AI 助手**：向您支持 MCP 的 AI 助手提问
