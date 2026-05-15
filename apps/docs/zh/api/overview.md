# API 参考

完整的 PayIn 多链稳定币支付基础设施 REST API 参考。

## Base URL

**生产环境：**
```
https://app.payin.com/api/v1
```

**测试网络：**
```
https://testnet.payin.com/api/v1
```

**本地开发：**
```
http://localhost:3000/api/v1
```

::: tip 优先使用测试网络
我们强烈建议在投入生产之前先在测试网络上测试您的集成。测试网络使用没有实际价值的测试代币。
:::

## 身份验证

所有 API 请求都需要在请求头中使用 API 密钥进行身份验证：

```http
X-API-Key: your-api-key-here
```

### 生成 API 密钥

1. 登录 [PayIn 管理后台](https://testnet.payin.com)
2. 导航至 **设置 → API 密钥**
3. 点击 **创建 API 密钥**
4. 给它一个描述性的名称
5. 复制密钥（仅显示一次！）

### API 密钥权限

| 角色 | 创建订单 | 创建充值 | 查看数据 | 管理设置 |
|------|---------|---------|---------|---------|
| **Owner** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅（除所有权外） |
| **Member** | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | ❌ | ❌ | ✅ | ❌ |

::: warning API 密钥安全
- 切勿将 API 密钥提交到版本控制系统
- 定期轮换密钥
- 为测试网络和生产环境使用不同的密钥
- 参阅 [安全指南](/zh/guide/security) 了解最佳实践
:::

## 请求格式

### 请求头

所有请求都应包含：

```http
Content-Type: application/json
X-API-Key: your-api-key-here
```

### 请求体

POST 和 PUT 请求使用 JSON 格式：

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia"
}
```

## 响应格式

### 成功响应

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending",
  "createdAt": "2025-01-20T10:30:00Z",
  "expiresAt": "2025-01-20T10:40:00Z"
}
```

### 错误响应

```json
{
  "error": "Invalid amount",
  "message": "Amount must be a positive number",
  "code": "INVALID_AMOUNT",
  "statusCode": 400
}
```

### HTTP 状态码

| 状态码 | 描述 | 含义 |
|------|------|------|
| **200** | OK | 请求成功 |
| **201** | Created | 资源创建成功 |
| **400** | Bad Request | 无效的请求参数 |
| **401** | Unauthorized | 缺少或无效的 API 密钥 |
| **403** | Forbidden | API 密钥缺少所需权限 |
| **404** | Not Found | 资源不存在 |
| **409** | Conflict | 资源已存在（重复） |
| **429** | Too Many Requests | 超过速率限制 |
| **500** | Internal Server Error | 服务器错误（联系支持） |

## 速率限制

API 请求受速率限制以防止滥用：

**默认限制：**
- 每分钟每个 API 密钥 100 次请求
- 每小时每个 API 密钥 1000 次请求
- 每天每个 API 密钥 10000 次请求

**响应头：**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642680000
```

当受到速率限制时，您将收到：
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "statusCode": 429,
  "retryAfter": 60
}
```

::: tip 企业计划
需要更高的限制？联系我们获取具有自定义速率限制的企业计划。
:::

## 分页

列表端点支持分页：

**查询参数：**
```
GET /api/v1/orders?page=1&limit=20
```

**响应：**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**分页参数：**

| 参数 | 类型 | 默认值 | 最大值 | 描述 |
|------|------|-------|-------|------|
| `page` | integer | 1 | - | 页码（从 1 开始） |
| `limit` | integer | 20 | 100 | 每页项数 |

## 过滤和排序

许多列表端点支持过滤和排序：

**过滤：**
```
GET /api/v1/orders?status=pending&currency=USDT
```

**排序：**
```
GET /api/v1/orders?sortBy=createdAt&sortOrder=desc
```

**常用过滤器：**

| 端点 | 支持的过滤器 |
|------|-------------|
| Orders | `status`, `currency`, `chainId`, `orderReference` |
| Deposits | `status`, `currency`, `depositReference` |
| Transfers | `status`, `currency`, `chainId`, `txHash` |

**排序选项：**
- `sortBy`: 排序字段（`createdAt`、`amount` 等）
- `sortOrder`: `asc` 或 `desc`（默认：`desc`）

## 幂等性

创建资源的 POST 请求支持幂等性密钥以防止重复创建：

```http
Idempotency-Key: unique-key-123
```

**行为：**
- 24 小时内使用相同的幂等性密钥返回原始响应
- 使用相同密钥但不同的请求体返回 `409 Conflict`
- 密钥在 24 小时后过期

**示例：**
```bash
curl -X POST https://testnet.payin.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "Idempotency-Key: order-2025-001-retry-1" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "100.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

## Webhooks

PayIn 通过 webhooks 发送实时事件通知。详见 [Webhooks 指南](/zh/guide/webhooks)。

**事件类型：**
- `order.completed` - 订单支付已接收并确认
- `order.expired` - 订单已过期且未支付
- `deposit.completed` - 达到所需区块链确认数后触发
- `deposit.address_bound` - 充值地址分配给用户时触发
- `deposit.address_unbound` - 充值地址释放时触发

**Webhook 配置：**
```bash
POST /api/v1/webhooks/endpoints
{
  "url": "https://your-api.com/webhooks/payin",
  "events": ["order.completed", "deposit.completed"],
  "secret": "webhook_secret_key"
}
```

## API 端点

### 📦 订单 API

创建和管理支付订单。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/orders` | [创建订单](/zh/api/orders) |
| GET | `/orders/:id` | [获取订单详情](/zh/api/orders) |
| GET | `/orders` | [列出订单](/zh/api/orders) |

### 💰 充值 API

管理用户充值地址和充值。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/deposits/references` | [绑定充值地址](/zh/api/deposits) |
| GET | `/deposits/references/:ref` | [获取充值地址](/zh/api/deposits) |
| GET | `/deposits/references` | [列出充值引用](/zh/api/deposits) |
| GET | `/deposits` | [列出充值](/zh/api/deposits) |
| DELETE | `/deposits/references/:ref` | [解绑地址](/zh/api/deposits) |

### 🔄 转账 API

查询区块链交易。

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/transfers` | [列出转账](/zh/api/transfers) |
| GET | `/transfers/:id` | [获取转账详情](/zh/api/transfers) |

### 📬 Webhooks API

配置 webhook 端点。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/webhooks/endpoints` | [创建端点](/zh/api/webhooks) |
| GET | `/webhooks/endpoints` | [列出端点](/zh/api/webhooks) |
| PUT | `/webhooks/endpoints/:id` | [更新端点](/zh/api/webhooks) |
| DELETE | `/webhooks/endpoints/:id` | [删除端点](/zh/api/webhooks) |
| GET | `/webhooks/events` | [列出事件](/zh/api/webhooks) |

### 💳 支付链接 API

创建无代码支付链接。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/payment-links` | [创建链接](/zh/api/payment-links) |
| GET | `/payment-links` | [列出链接](/zh/api/payment-links) |
| GET | `/payment-links/:id` | [获取链接详情](/zh/api/payment-links) |
| PUT | `/payment-links/:id` | [更新链接](/zh/api/payment-links) |
| DELETE | `/payment-links/:id` | [删除链接](/zh/api/payment-links) |

### 🏦 地址池 API

管理地址池（仅管理员）。

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/address-pool/import` | [导入地址](/zh/api/address-pool) |
| GET | `/address-pool/status` | [获取地址池状态](/zh/api/address-pool) |
| GET | `/address-pool/addresses` | [列出地址](/zh/api/address-pool) |

### ⚙️ 配置 API

管理组织设置（仅管理员）。

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/config` | [获取所有配置](/zh/api/config) |
| GET | `/config/:key` | [获取配置值](/zh/api/config) |
| PUT | `/config/:key` | [更新配置](/zh/api/config) |

### 🔐 组织和 API 密钥

管理组织和 API 密钥（仅管理员）。

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/organizations` | [列出组织](/zh/api/organizations) |
| POST | `/organizations/:id/api-keys` | [创建 API 密钥](/zh/api/organizations) |
| GET | `/organizations/:id/api-keys` | [列出 API 密钥](/zh/api/organizations) |
| DELETE | `/api-keys/:keyId` | [删除 API 密钥](/zh/api/organizations) |

## 错误处理

### 常见错误码

| 错误码 | HTTP 状态码 | 描述 | 解决方案 |
|--------|------------|------|---------|
| `INVALID_API_KEY` | 401 | API 密钥缺失或无效 | 检查 API 密钥是否正确 |
| `INSUFFICIENT_PERMISSIONS` | 403 | API 密钥缺少所需权限 | 使用具有适当角色的密钥 |
| `RESOURCE_NOT_FOUND` | 404 | 请求的资源不存在 | 验证 ID 是否正确 |
| `DUPLICATE_ORDER_REFERENCE` | 409 | 订单引用已存在 | 使用唯一的订单引用 |
| `NO_AVAILABLE_ADDRESSES` | 503 | 地址池已耗尽 | 导入更多地址 |
| `INVALID_AMOUNT` | 400 | 金额无效或为负数 | 提供有效的正数金额 |
| `INVALID_CHAIN` | 400 | 不支持的链 ID | 使用支持的链 ID |
| `INVALID_CURRENCY` | 400 | 链上不支持的币种 | 使用该链的有效币种 |
| `ORDER_EXPIRED` | 400 | 无法支付已过期的订单 | 创建新订单 |
| `ORDER_ALREADY_PAID` | 400 | 订单已完成 | 检查订单状态 |

### 错误响应结构

```typescript
{
  error: string;          // 简短的错误消息
  message: string;        // 详细的错误描述
  code: string;          // 用于编程处理的错误码
  statusCode: number;    // HTTP 状态码
  details?: any;         // 附加错误上下文（可选）
}
```

### 错误处理示例

**TypeScript:**
```typescript
try {
  const response = await fetch('https://testnet.payin.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PAYIN_API_KEY!
    },
    body: JSON.stringify({
      orderReference: 'ORDER-2025-001',
      amount: '100.00',
      currency: 'USDT',
      chainId: 'ethereum-sepolia'
    })
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.code) {
      case 'DUPLICATE_ORDER_REFERENCE':
        console.log('Order already exists, fetching existing order');
        // Fetch existing order
        break;
      case 'NO_AVAILABLE_ADDRESSES':
        console.error('Address pool exhausted, alerting admin');
        // Send alert to admin
        break;
      default:
        console.error('API Error:', error.message);
        throw new Error(error.message);
    }
  }

  const order = await response.json();
  console.log('Order created:', order);
} catch (error) {
  console.error('Request failed:', error);
}
```

**Python:**
```python
import requests

try:
    response = requests.post(
        'https://testnet.payin.com/api/v1/orders',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': os.getenv('PAYIN_API_KEY')
        },
        json={
            'orderReference': 'ORDER-2025-001',
            'amount': '100.00',
            'currency': 'USDT',
            'chainId': 'ethereum-sepolia'
        }
    )

    response.raise_for_status()
    order = response.json()
    print(f"Order created: {order['orderId']}")

except requests.exceptions.HTTPError as e:
    error = e.response.json()

    if error['code'] == 'DUPLICATE_ORDER_REFERENCE':
        print('Order already exists')
    elif error['code'] == 'NO_AVAILABLE_ADDRESSES':
        print('Address pool exhausted')
    else:
        print(f"API Error: {error['message']}")
```

## 版本控制

PayIn API 使用 URL 版本控制：

```
https://testnet.payin.com/api/v1/...
```

**当前版本：** `v1`

**弃用策略：**
- 新 API 版本提前 6 个月公布
- 旧版本在弃用后支持 12 个月
- 仅在新主要版本中进行破坏性更改
- 非破坏性更改添加到当前版本

## SDK 和库

官方 SDK：
- **TypeScript/Node.js**
- **Python**
- **PHP**

**社区 SDK：**

## 测试

### 测试模式

使用测试网络进行测试：
- Base URL: `https://testnet.payin.com/api/v1`
- 免费测试代币
- 与生产环境相同的 API
- 可安全实验

### 测试链和地址

**测试网络链：**
- Ethereum Sepolia
- Polygon Amoy
- Tron Nile
- Solana Devnet

**获取测试代币：**
- Sepolia USDT: [Sepolia Faucet](https://sepoliafaucet.com)
- Amoy USDT: [Polygon Faucet](https://faucet.polygon.technology)
- Solana Devnet: 使用 `solana airdrop`

### 示例测试流程

```bash
# 1. 在测试网络上创建订单
curl -X POST https://testnet.payin.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-testnet-key" \
  -d '{
    "orderReference": "TEST-001",
    "amount": "10.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'

# 2. 将测试 USDT 发送到支付地址

# 3. 检查订单状态
curl https://testnet.payin.com/api/v1/orders/ord_xxx \
  -H "X-API-Key: your-testnet-key"

# 4. 验证是否收到 webhook（如果已配置）
```

## 支持和资源

### 文档
- [快速入门指南](/zh/guide/quick-start-mcp)
- [订单支付服务](/zh/guide/order-payment)
- [充值服务](/zh/guide/deposit-service)
- [Webhooks 指南](/zh/guide/webhooks)
- [安全指南](/zh/guide/security)

### API 状态
- [状态页面](https://status.payin.com)
- 检查当前 API 可用性
- 订阅故障通知

### 获取帮助
- **电子邮件**: support@payin.com
- **文档**: 浏览本网站
- **API 问题**: 包含错误响应中的请求 ID

### 提高速率限制
对于需要更高速率限制的企业使用：
- 电子邮件: enterprise@payin.com
- 包含：预期流量、用例、时间线

## 下一步

- [创建您的第一个订单 →](/zh/api/orders)
- [设置充值地址 →](/zh/api/deposits)
- [配置 webhooks →](/zh/api/webhooks)
- [探索示例 →](/zh/examples/order-payment)
