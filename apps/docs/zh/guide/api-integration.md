# API 集成

本指南介绍如何在生产应用中直接集成 PayIn 的 REST API。如果你只是想探索 PayIn，我们建议先从 [MCP 快速入门](/zh/guide/quick-start-mcp) 开始。

## 何时使用直接 API

选择最适合你需求的集成方式：

| 方式 | 最适合场景 | 复杂度 | 设置时间 |
|------|-----------|--------|---------|
| **直接 API** | 生产应用、自定义集成、多种编程语言 | 中等 | 30-60 分钟 |
| **MCP 服务器** | 原型开发、AI 辅助开发、学习探索 | 低 | 5-10 分钟 |
| **支付链接** | 一次性支付、无代码场景、发票 | 非常低 | 2 分钟 |

**在以下情况使用直接 API：**
- 需要生产级别的集成和完全控制
- 使用 Node.js 之外的编程语言
- 需要自定义业务逻辑和工作流
- 大量交易处理
- 高级错误处理和重试逻辑

## API 基础

### 基础 URL

PayIn 为测试和生产提供独立的环境：

| 环境 | 基础 URL | 用途 |
|------|---------|------|
| **测试网** | `https://your-payin.example.com/api/v1` | 使用测试加密货币测试（免费） |
| **主网** | `https://your-payin.example.com/api/v1` | 使用真实加密货币的生产环境 |

::: tip 始终先测试
在处理真实交易之前，先使用测试网熟悉 PayIn。参见 [测试网 vs 主网](/zh/guide/testnet-vs-mainnet)。
:::

### 身份验证

所有 API 请求都需要使用从 PayIn 管理后台获取的 API 密钥进行身份验证。

#### 获取 API 密钥

1. 登录 [your-payin.example.com](https://your-payin.example.com)（主网使用 your-payin.example.com）
2. 导航到 **设置** → **API 密钥**
3. 点击 **创建 API 密钥**
4. 输入描述性名称（例如 "生产服务器密钥"）
5. 复制生成的密钥（格式：`pk_xxxxxxxxxxxxx`）

::: warning 保存你的 API 密钥
API 密钥仅在创建时显示一次。请安全保存 - 之后无法再次获取。
:::

#### 使用 API 密钥

在 `Authorization` 头中使用 Bearer 认证包含你的 API 密钥：

```http
Authorization: Bearer pk_your_api_key_here
```

**安全要求：**
- ✅ 始终使用 HTTPS（永远不要使用 HTTP）
- ✅ 将 API 密钥存储在环境变量中
- ✅ 永远不要将 API 密钥提交到版本控制
- ✅ 定期轮换密钥
- ❌ 永远不要在客户端代码中暴露密钥

### 请求格式

所有 API 请求必须：
- 使用 **HTTPS** 协议
- 对于 POST/PUT 请求包含 **Content-Type: application/json** 头
- 包含有效 API 密钥的 **Authorization** 头
- 对于数据操作将请求体作为 JSON 发送

**标准请求头：**

```http
POST /api/v1/orders HTTP/1.1
Host: your-payin.example.com
Authorization: Bearer pk_xxxxxxxxxxxxx
Content-Type: application/json
```

### 响应格式

所有 API 响应返回一致结构的 JSON：

**成功响应 (2xx)：**
```json
{
  "success": true,
  "data": { ... },
  "message": "Order created successfully"
}
```

**错误响应 (4xx/5xx)：**
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Required fields: amount, currency, chainId"
}
```

## 常见集成模式

### 模式 1: 订单支付流程

为一次性交易创建临时支付地址。

<details>
<summary><strong>示例：电商结账</strong></summary>

**步骤 1: 创建订单**

当用户进入结账页面时：

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderReference: `order_${Date.now()}`,
    amount: '49.99',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    successUrl: 'https://yourstore.com/order/success',
    cancelUrl: 'https://yourstore.com/order/cancelled',
    metadata: {
      cartId: 'cart_12345',
      itemCount: 3
    }
  })
});

const result = await response.json();

if (result.success) {
  // 向客户展示支付页面
  window.location.href = result.data.paymentUrl;
}
```

**步骤 2: 处理 Webhook 通知**

当支付确认时：

```typescript
// Webhook 端点: POST /webhooks/payin
app.post('/webhooks/payin', async (req, res) => {
  // 验证 webhook 签名（参见 Webhooks 指南）
  const signature = req.headers['x-payin-signature'];
  const isValid = verifySignature(req.body, signature);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.type === 'order.completed') {
    const { orderReference, amount, currency, txHash } = event.data;

    // 在数据库中更新订单状态
    await db.orders.update({
      where: { reference: orderReference },
      data: {
        status: 'paid',
        transactionHash: txHash,
        paidAt: new Date()
      }
    });

    // 履行订单（发货、授予访问权限等）
    await fulfillOrder(orderReference);
  }

  res.json({ received: true });
});
```

**步骤 3: 查询订单状态**（可选）

以编程方式检查订单状态：

```typescript
const orderId = 'ord_abcdef123456';
const response = await fetch(
  `https://your-payin.example.com/api/v1/orders/${orderId}`,
  {
    headers: {
      'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
    }
  }
);

const result = await response.json();
console.log('Order Status:', result.data.status); // pending, completed, expired
```

</details>

### 模式 2: 充值地址流程

为用户绑定永久地址以进行重复充值。

<details>
<summary><strong>示例：游戏钱包系统</strong></summary>

**步骤 1: 绑定充值地址**

当用户创建钱包时：

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    depositReference: `player_${userId}`,
    protocol: 'evm',  // 所有 EVM 链使用单个地址
    metadata: {
      playerId: userId,
      playerName: 'john_doe'
    }
  })
});

const result = await response.json();

if (result.success) {
  // 将充值地址保存到用户资料
  await db.users.update({
    where: { id: userId },
    data: {
      depositAddress: result.data.address,
      protocol: 'evm'
    }
  });

  // 向玩家显示地址
  console.log('Deposit Address:', result.data.address);
  console.log('Supported Chains:', result.data.monitoredChains);
}
```

**步骤 2: 处理充值 Webhook**

当玩家充值资金时：

```typescript
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'deposit.completed') {
    const { depositReference, amount, currency, chainId, txHash } = event.data;

    // 提取玩家 ID
    const playerId = depositReference.replace('player_', '');

    // 向玩家余额添加资金（幂等操作）
    await db.$transaction(async (tx) => {
      // 检查充值是否已处理
      const existing = await tx.deposits.findUnique({
        where: { txHash }
      });

      if (!existing) {
        // 记录充值
        await tx.deposits.create({
          data: {
            playerId,
            amount,
            currency,
            chainId,
            txHash,
            status: 'confirmed'
          }
        });

        // 原子性更新余额
        await tx.users.update({
          where: { id: playerId },
          data: {
            balance: {
              increment: parseFloat(amount)
            }
          }
        });

        // 通知玩家
        await notifyPlayer(playerId, 'Deposit confirmed', amount, currency);
      }
    });
  }

  res.json({ received: true });
});
```

**步骤 3: 查询充值历史**

查看用户的所有充值：

```typescript
const depositReference = `player_${userId}`;
const response = await fetch(
  `https://your-payin.example.com/api/v1/deposits?depositReference=${depositReference}`,
  {
    headers: {
      'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
    }
  }
);

const result = await response.json();
console.log('Deposits:', result.data.deposits);
```

</details>

### 模式 3: 支付链接流程

创建可分享的支付 URL 用于无代码支付收款。

<details>
<summary><strong>示例：发票生成器</strong></summary>

**创建支付链接：**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Web Design Services - Invoice #2025-001',
    description: 'Logo design + 5 landing pages',
    amount: '2500',
    currencies: [
      { currency: 'USDT', chainId: 'ethereum-sepolia' },
      { currency: 'USDC', chainId: 'polygon-amoy' }
    ],
    metadata: {
      invoiceNumber: 'INV-2025-001',
      clientId: 'client_456',
      services: ['logo_design', 'landing_pages']
    }
  })
});

const result = await response.json();

if (result.success) {
  // 通过电子邮件向客户发送支付链接
  const paymentUrl = `https://your-payin.example.com/checkout/${result.data.slug}`;
  await sendEmail({
    to: client.email,
    subject: 'Invoice #2025-001',
    body: `Please pay your invoice: ${paymentUrl}`
  });
}
```

</details>

## API 参考

### 身份验证端点

#### 健康检查

检查 API 可用性：

```bash
curl https://your-payin.example.com/health
```

**响应：**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-28T10:30:00Z",
  "version": "0.1.0"
}
```

### 订单端点

#### 创建订单

`POST /api/v1/orders`

**请求体：**
```typescript
{
  orderReference: string;      // 你的唯一订单 ID
  amount: string;              // 代币单位的金额（例如 "10.50"）
  currency: string;            // 代币符号（USDT、USDC、DAI）
  chainId: string;             // 链标识符（ethereum-sepolia、polygon-amoy）
  successUrl?: string;         // 支付后重定向 URL
  cancelUrl?: string;          // 过期时重定向 URL
  paymentWindowMinutes?: number;  // 支付超时（默认：10）
  graceMinutes?: number;       // 宽限期（默认：5）
  metadata?: Record<string, any>;  // 自定义数据
}
```

**响应：**
```typescript
{
  success: true,
  data: {
    orderId: string;           // PayIn 订单 ID
    orderReference: string;    // 你的订单引用
    status: 'pending',
    amount: string,
    currency: string,
    chainId: string,
    address: string,           // 支付地址
    paymentUrl: string,        // 托管支付页面
    expiresAt: string,         // ISO 8601 时间戳
    createdAt: string
  }
}
```

#### 获取订单

`GET /api/v1/orders/:orderId`

**响应：**
```typescript
{
  success: true,
  data: {
    orderId: string,
    orderReference: string,
    status: 'pending' | 'completed' | 'expired',
    amount: string,
    currency: string,
    chainId: string,
    address: string,
    txHash?: string,           // 交易哈希（如果已完成）
    completedAt?: string,      // 完成时间戳
    createdAt: string
  }
}
```

#### 列出订单

`GET /api/v1/orders`

**查询参数：**
- `status` - 按状态过滤（pending、completed、expired）
- `chainId` - 按链过滤
- `currency` - 按货币过滤
- `orderReference` - 按订单引用搜索
- `page` - 页码（默认：1）
- `limit` - 每页结果数（默认：20，最大：100）

**响应：**
```typescript
{
  success: true,
  data: {
    orders: Order[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
  }
}
```

### 充值端点

#### 绑定地址

`POST /api/v1/deposits/bind`

**请求体：**
```typescript
{
  depositReference: string;    // 唯一用户标识符
  protocol: 'evm' | 'tron';   // 协议族
  metadata?: Record<string, any>;
}
```

**响应：**
```typescript
{
  success: true,
  data: {
    depositReference: string,
    address: string,           // 充值地址
    protocol: string,
    monitoredChains: string[], // 所有监控的链
    createdAt: string
  }
}
```

#### 解绑地址

`POST /api/v1/deposits/unbind`

**请求体：**
```typescript
{
  depositReference: string;
}
```

#### 获取充值引用

`GET /api/v1/deposits/references/:depositReference`

**响应：**
```typescript
{
  success: true,
  data: {
    depositReference: string,
    address: string,
    protocol: string,
    totalDeposits: number,
    totalAmount: string,
    boundAt: string
  }
}
```

#### 列出充值

`GET /api/v1/deposits`

**查询参数：**
- `depositReference` - 按充值引用过滤
- `status` - 按状态过滤（pending、confirmed、completed）
- `chainId` - 按链过滤
- `currency` - 按货币过滤
- `page`, `limit` - 分页

**响应：**
```typescript
{
  success: true,
  data: {
    deposits: Deposit[],
    pagination: { ... }
  }
}
```

### 支付链接端点

#### 创建支付链接

`POST /api/v1/payment-links`

**请求体：**
```typescript
{
  title: string;               // 支付链接标题
  description?: string;        // 可选描述
  amount: string;              // 金额（"0" 表示自定义）
  currencies: Array<{          // 支持的货币
    currency: string,
    chainId: string
  }>,
  inventoryTotal?: number;     // 库存限制（可选）
  expiresAt?: string;          // 过期日期（可选）
  metadata?: Record<string, any>;
}
```

**响应：**
```typescript
{
  success: true,
  data: {
    id: string,
    slug: string,              // URL slug
    title: string,
    amount: string,
    status: 'draft',
    checkoutUrl: string,       // 公开支付 URL
    createdAt: string
  }
}
```

#### 发布支付链接

`POST /api/v1/payment-links/:id/publish`

使支付链接公开可访问。

#### 归档支付链接

`POST /api/v1/payment-links/:id/archive`

从活动状态中移除支付链接。

## 代码示例

### TypeScript / Node.js

使用原生 fetch 的完整集成示例：

```typescript
import crypto from 'crypto';

class PayInClient {
  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://your-payin.example.com/api/v1'
  ) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data.data;
  }

  // 创建订单
  async createOrder(params: {
    orderReference: string;
    amount: string;
    currency: string;
    chainId: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // 获取订单状态
  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  // 绑定充值地址
  async bindAddress(params: {
    depositReference: string;
    protocol: 'evm' | 'tron';
    metadata?: Record<string, any>;
  }) {
    return this.request('/deposits/bind', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // 验证 webhook 签名
  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// 使用
const payin = new PayInClient(process.env.PAYIN_API_KEY!);

// 创建订单
const order = await payin.createOrder({
  orderReference: 'order_123',
  amount: '100',
  currency: 'USDT',
  chainId: 'ethereum-sepolia',
});

console.log('Payment URL:', order.paymentUrl);
```

### Python

使用 `requests` 库：

```python
import requests
import hmac
import hashlib
from typing import Dict, Any

class PayInClient:
    def __init__(self, api_key: str, base_url: str = 'https://your-payin.example.com/api/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def create_order(self, order_reference: str, amount: str,
                     currency: str, chain_id: str, **kwargs) -> Dict[str, Any]:
        """创建新的支付订单"""
        payload = {
            'orderReference': order_reference,
            'amount': amount,
            'currency': currency,
            'chainId': chain_id,
            **kwargs
        }

        response = self.session.post(
            f'{self.base_url}/orders',
            json=payload
        )
        response.raise_for_status()
        return response.json()['data']

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """获取订单详情"""
        response = self.session.get(f'{self.base_url}/orders/{order_id}')
        response.raise_for_status()
        return response.json()['data']

    def bind_address(self, deposit_reference: str,
                     protocol: str, **kwargs) -> Dict[str, Any]:
        """为用户绑定充值地址"""
        payload = {
            'depositReference': deposit_reference,
            'protocol': protocol,
            **kwargs
        }

        response = self.session.post(
            f'{self.base_url}/deposits/bind',
            json=payload
        )
        response.raise_for_status()
        return response.json()['data']

    @staticmethod
    def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
        """验证 webhook 签名"""
        expected_signature = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected_signature)

# 使用
payin = PayInClient(api_key=os.environ['PAYIN_API_KEY'])

# 创建订单
order = payin.create_order(
    order_reference='order_123',
    amount='100',
    currency='USDT',
    chain_id='ethereum-sepolia'
)

print(f"Payment URL: {order['paymentUrl']}")
```

### PHP

使用 cURL：

```php
<?php

class PayInClient {
    private $apiKey;
    private $baseUrl;

    public function __construct($apiKey, $baseUrl = 'https://your-payin.example.com/api/v1') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }

    private function request($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json'
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception('API request failed: ' . $response);
        }

        $result = json_decode($response, true);
        return $result['data'];
    }

    public function createOrder($params) {
        return $this->request('POST', '/orders', $params);
    }

    public function getOrder($orderId) {
        return $this->request('GET', "/orders/$orderId");
    }

    public function bindAddress($params) {
        return $this->request('POST', '/deposits/bind', $params);
    }

    public function verifyWebhook($payload, $signature, $secret) {
        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        return hash_equals($signature, $expectedSignature);
    }
}

// 使用
$payin = new PayInClient($_ENV['PAYIN_API_KEY']);

// 创建订单
$order = $payin->createOrder([
    'orderReference' => 'order_123',
    'amount' => '100',
    'currency' => 'USDT',
    'chainId' => 'ethereum-sepolia'
]);

echo "Payment URL: " . $order['paymentUrl'];
```

### cURL（测试）

快速命令行测试：

```bash
# 创建订单
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Authorization: Bearer pk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "order_123",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'

# 获取订单状态
curl -X GET https://your-payin.example.com/api/v1/orders/ord_abc123 \
  -H "Authorization: Bearer pk_your_api_key"

# 绑定充值地址
curl -X POST https://your-payin.example.com/api/v1/deposits/bind \
  -H "Authorization: Bearer pk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "depositReference": "user_456",
    "protocol": "evm"
  }'
```

## 错误处理

### HTTP 状态码

PayIn 使用标准 HTTP 状态码：

| 代码 | 含义 | 常见原因 |
|------|------|---------|
| **200** | 成功 | 请求成功完成 |
| **201** | 已创建 | 资源创建成功 |
| **400** | 错误请求 | 无效的请求参数 |
| **401** | 未授权 | 无效或缺失的 API 密钥 |
| **403** | 禁止访问 | 权限不足 |
| **404** | 未找到 | 资源不存在 |
| **429** | 请求过多 | 超过速率限制（未来功能） |
| **500** | 内部服务器错误 | 服务器端错误 |
| **503** | 服务不可用 | 临时服务中断 |

### 常见错误类型

#### ValidationError

无效的请求参数：

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Required fields: amount, currency, chainId"
}
```

**解决方法：**确保所有必需字段都存在且有效。

#### AuthenticationError

无效的 API 密钥：

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

**解决方法：**检查你的 API 密钥是否正确且处于活动状态。

#### ResourceNotFoundError

资源不存在：

```json
{
  "success": false,
  "error": "NotFound",
  "message": "Order not found"
}
```

**解决方法：**验证资源 ID 是否正确。

#### InsufficientAddressesError

地址池中无可用地址：

```json
{
  "success": false,
  "error": "InsufficientAddresses",
  "message": "No available addresses in pool for protocol: evm"
}
```

**解决方法：**向地址池导入更多地址。参见 [地址池设置](/zh/guide/address-pool-setup)。

### 错误处理最佳实践

**1. 始终处理错误**

```typescript
try {
  const order = await payin.createOrder({ ... });
  // 成功逻辑
} catch (error) {
  if (error.message.includes('InsufficientAddresses')) {
    // 提醒管理员导入更多地址
    await alertAdmin('Address pool depleted');
  } else if (error.message.includes('Unauthorized')) {
    // API 密钥问题
    await rotateApiKey();
  } else {
    // 记录意外错误
    console.error('Order creation failed:', error);
  }
}
```

**2. 实现重试逻辑**

对临时错误使用指数退避：

```typescript
async function createOrderWithRetry(params: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await payin.createOrder(params);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable =
        error.message.includes('500') ||
        error.message.includes('503');

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // 指数退避：1s、2s、4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**3. 记录所有 API 交互**

```typescript
class LoggingPayInClient extends PayInClient {
  async createOrder(params: any) {
    const startTime = Date.now();

    try {
      const result = await super.createOrder(params);

      logger.info('Order created', {
        orderReference: params.orderReference,
        orderId: result.orderId,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Order creation failed', {
        orderReference: params.orderReference,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }
}
```

## Webhook 集成

Webhooks 是接收实时支付通知的推荐方式。

### 设置 Webhooks

1. 在管理后台配置 webhook URL：**设置** → **Webhooks**
2. 输入你的端点 URL（必须是 HTTPS）
3. 复制 webhook 密钥用于签名验证
4. 选择要接收的事件

### 事件类型

| 事件 | 描述 | 触发时机 |
|------|------|---------|
| `order.completed` | 订单支付确认 | 达到所需确认数后 |
| `order.expired` | 订单支付窗口过期 | 宽限期结束后 |
| `deposit.completed` | 充值已确认 | 达到所需区块链确认数后 |
| `deposit.address_bound` | 地址已分配 | 充值地址绑定给用户时 |
| `deposit.address_unbound` | 地址已释放 | 充值地址解绑时 |

### Webhook 负载

所有 webhooks 遵循以下格式：

```json
{
  "id": "evt_abc123",
  "type": "order.completed",
  "createdAt": "2025-01-28T10:30:00Z",
  "data": {
    "orderId": "ord_xyz789",
    "orderReference": "order_123",
    "status": "completed",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "txHash": "0xabc...",
    "completedAt": "2025-01-28T10:29:45Z"
  }
}
```

### 签名验证

**始终验证 webhook 签名**以防止未经授权的请求：

```typescript
import crypto from 'crypto';

app.post('/webhooks/payin', async (req, res) => {
  // 1. 从头部获取签名
  const signature = req.headers['x-payin-signature'];
  const secret = process.env.PAYIN_WEBHOOK_SECRET;

  // 2. 计算预期签名
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  // 3. 比较签名（时序安全）
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 4. 处理 webhook
  const event = req.body;
  await handleWebhookEvent(event);

  // 5. 快速响应
  res.json({ received: true });
});
```

### 幂等性

Webhooks 可能会被多次投递。使你的处理器具有幂等性：

```typescript
async function handleOrderCompleted(event: any) {
  const { orderId, txHash } = event.data;

  // 使用交易哈希作为幂等性键
  const existingPayment = await db.payments.findUnique({
    where: { txHash }
  });

  if (existingPayment) {
    console.log('Payment already processed:', txHash);
    return; // 跳过重复处理
  }

  // 原子性处理支付
  await db.$transaction(async (tx) => {
    await tx.payments.create({
      data: {
        orderId,
        txHash,
        processedAt: new Date()
      }
    });

    await tx.orders.update({
      where: { id: orderId },
      data: { status: 'fulfilled' }
    });
  });
}
```

有关完整的 webhook 文档，请参见 [Webhooks 指南](/zh/guide/webhooks)。

## 从 MCP 迁移

如果你从 MCP 原型开发开始，以下是如何迁移到生产 API 的方法：

### 1. 将 MCP 调用替换为 API 调用

**之前（MCP）：**
```
创建支付订单：
- 订单引用：ORDER-2025-001
- 金额：10 USDT
- 链：ethereum-sepolia
```

**之后（API）：**
```typescript
const order = await payin.createOrder({
  orderReference: 'ORDER-2025-001',
  amount: '10',
  currency: 'USDT',
  chainId: 'ethereum-sepolia'
});
```

### 2. 实现 Webhook 处理器

MCP 在聊天中提供即时反馈。在生产环境中，使用 webhooks 进行异步通知：

```typescript
// 替换："ORDER-2025-001 的状态是什么？"
// 使用：Webhook 处理器

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'order.completed') {
    // 你的业务逻辑
    await processOrder(event.data.orderReference);
  }

  res.json({ received: true });
});
```

### 3. 添加错误处理

MCP 优雅地处理错误。在生产环境中，实现全面的错误处理：

```typescript
try {
  const order = await payin.createOrder(params);
} catch (error) {
  // 记录错误
  logger.error('Order creation failed', { error });

  // 适当时重试
  if (isRetryable(error)) {
    await retryLater(params);
  }

  // 关键情况下提醒管理员
  if (isCritical(error)) {
    await alertAdmin(error);
  }
}
```

### 4. 环境变量

安全地存储配置：

```bash
# .env
PAYIN_API_KEY=pk_your_production_key
PAYIN_BASE_URL=https://your-payin.example.com/api/v1
PAYIN_WEBHOOK_SECRET=whsec_your_secret
```

## 最佳实践

### 安全性

1. **API 密钥安全**
   - ✅ 将密钥存储在环境变量中
   - ✅ 为测试网和主网使用不同的密钥
   - ✅ 定期轮换密钥（每 90 天）
   - ✅ 在可能的情况下限制密钥权限
   - ❌ 永远不要将密钥提交到版本控制
   - ❌ 永远不要在客户端代码中暴露密钥
   - ❌ 永远不要在应用日志中记录密钥

2. **仅使用 HTTPS**
   - 始终使用 HTTPS 进行 API 请求
   - 确保 webhook 端点使用 HTTPS
   - 使用有效的 SSL 证书

3. **Webhook 验证**
   - 始终验证 webhook 签名
   - 使用时序安全比较函数
   - 立即拒绝未签名的 webhooks

### 可靠性

1. **幂等性**
   - 使 webhook 处理器具有幂等性
   - 使用交易哈希作为去重键
   - 实现原子数据库操作

2. **重试逻辑**
   - 使用指数退避重试失败的 API 调用
   - 设置最大重试次数（3-5 次）
   - 不要重试客户端错误（4xx），仅重试服务器错误（5xx）

3. **超时**
   - 设置合理的请求超时（10-30 秒）
   - 优雅地处理超时错误
   - 考虑为列表操作设置更长的超时

### 性能

1. **连接池**
   ```typescript
   // 重用 HTTP 客户端实例
   const agent = new https.Agent({
     keepAlive: true,
     maxSockets: 50
   });
   ```

2. **缓存**
   ```typescript
   // 缓存链/代币配置
   const chains = await cache.getOrFetch('chains', async () => {
     return await payin.getChains();
   }, { ttl: 3600 }); // 缓存 1 小时
   ```

3. **分页**
   ```typescript
   // 始终对大数据集使用分页
   let page = 1;
   let hasMore = true;

   while (hasMore) {
     const result = await payin.listOrders({ page, limit: 100 });
     await processOrders(result.orders);
     hasMore = page < result.pagination.totalPages;
     page++;
   }
   ```

### 监控

1. **记录所有 API 调用**
   - 请求参数
   - 响应状态
   - 响应时间
   - 错误消息

2. **跟踪关键指标**
   - API 成功率
   - 平均响应时间
   - 订单完成率
   - Webhook 投递成功率

3. **设置告警**
   - API 失败率 > 5%
   - 响应时间 > 5 秒
   - 地址池 < 100 个可用
   - Webhook 投递失败

## 测试

### 使用测试网

在生产环境之前，始终在测试网上进行彻底测试：

```typescript
// 使用测试网基础 URL
const testnetClient = new PayInClient(
  process.env.PAYIN_TESTNET_KEY,
  'https://your-payin.example.com/api/v1'
);

// 测试订单创建
const order = await testnetClient.createOrder({
  orderReference: `test_${Date.now()}`,
  amount: '1',
  currency: 'USDT',
  chainId: 'ethereum-sepolia'
});

console.log('Test order created:', order.paymentUrl);
```

### 本地测试 Webhooks

使用 ngrok 暴露本地 webhook 端点：

```bash
# 启动 ngrok
ngrok http 3000

# 你的 webhook URL 变为：
# https://abc123.ngrok.io/webhooks/payin

# 在 PayIn 管理后台配置此 URL
```

### 测试场景

在测试网上验证这些场景：

- ✅ 订单创建和支付流程
- ✅ 超时后订单过期
- ✅ 充值地址绑定
- ✅ 同一地址的多次充值
- ✅ Webhook 签名验证
- ✅ Webhook 重试处理
- ✅ 错误场景（无效参数、地址不足）
- ✅ 并发订单创建

## 速率限制

::: tip 未来功能
速率限制目前未强制执行，但可能会在未来版本中添加。遵循最佳实践以为未来的限制做好准备。
:::

**推荐做法：**
- 为重试实现指数退避
- 缓存链/代币配置
- 对大数据集使用分页
- 避免轮询；使用 webhooks

**预期的未来限制：**
- 订单：每组织 100 次请求/分钟
- 充值：每组织 50 次请求/分钟
- 查询：每组织 300 次请求/分钟

## 下一步

### 必要集成

- **[Webhooks](/zh/guide/webhooks)** - 设置事件通知
- **[安全性](/zh/guide/security)** - 生产安全检查清单
- **[地址池设置](/zh/guide/address-pool-setup)** - 管理支付地址

### 核心功能

- **[订单支付服务](/zh/guide/order-payment)** - 详细订单流程
- **[充值服务](/zh/guide/deposit-service)** - 详细充值流程
- **[支付链接](/zh/guide/payment-links)** - 创建可分享的支付 URL

### 参考

- **[支持的网络](/zh/guide/supported-networks)** - 可用区块链
- **[支持的代币](/zh/guide/supported-tokens)** - 可用稳定币
- **[测试网 vs 主网](/zh/guide/testnet-vs-mainnet)** - 环境比较

## 获取帮助

- **API 问题**：加入 [Discord 社区](https://discord.gg/payin)
- **错误报告**：发送邮件至 support@payin.com

---

**准备好上线了吗？**在测试网上彻底测试后，通过以下步骤切换到主网：
1. 在 [your-payin.example.com](https://your-payin.example.com) 创建账户
2. 向主网地址池导入地址
3. 生成主网 API 密钥
4. 将 `PAYIN_BASE_URL` 更新为 `https://your-payin.example.com/api/v1`
