# 充值服务

充值服务为用户提供永久性支付地址，用于重复性充值。它非常适合游戏钱包、平台余额以及任何用户需要长期地址进行多次充值的场景。

## 什么是充值服务？

充值服务为每个用户绑定一个永久性支付地址。地址绑定后，系统会自动监控多个区块链网络，允许用户从协议族内的任何支持链进行充值。

**核心特性：**
- 🔐 **一个用户，一个地址** - 每个用户获得一个永久充值地址
- 🌐 **多链监控** - 单个地址监控整个协议族
- ∞ **永不过期** - 地址永久绑定
- ♻️ **重复充值** - 支持同一地址的无限次充值
- 🏢 **多租户** - 完整的组织隔离

## 充值 vs 订单

了解充值服务和订单服务之间的区别：

| 功能 | 充值服务 | 订单支付 |
|---------|-----------------|---------------|
| **地址** | 永久性（绑定用户） | 临时性（使用后回收） |
| **生命周期** | 长期（数月/数年） | 分钟到小时 |
| **监控** | 多链（协议族） | 创建时指定的单链 |
| **使用场景** | 用户钱包、重复充值 | 电商结账、发票 |
| **过期** | 不过期 | 是（支付窗口 + 宽限期） |
| **金额** | 任意金额、任意时间 | 预期特定金额 |

**何时使用充值服务：**
- 游戏钱包充值
- 用户余额充值
- 平台钱包地址
- 会员重复支付
- 积分充值
- SaaS订阅支付

## 快速入门

### 前置条件

创建充值引用前，请确保您已：

1. ✅ **PayIn账户** - 在 [your-payin.example.com](https://your-payin.example.com) 或 [your-payin.example.com](https://your-payin.example.com) 注册
2. ✅ **API密钥** - 从管理后台生成
3. ✅ **地址池** - 至少导入几个地址（参见 [地址池设置](/zh/guide/address-pool-setup)）
4. ✅ **支持的网络** - 选择协议族：EVM 或 Tron

::: tip 先检查地址池
如果您的地址池为空，充值绑定将失败并显示"地址池中没有可用地址"。请先导入地址再继续。
:::

### 示例 1：绑定您的第一个充值地址（MCP）

使用 PayIn 配合 Claude Desktop 或 Cline：

```
创建充值引用：
- 充值引用：user_12345
- 协议：evm
```

AI助手将：
1. 调用 `create_deposit_reference` 工具
2. 从您的地址池绑定一个永久地址
3. 开始监控所有 EVM 链（Ethereum、Polygon 等）
4. 返回充值地址和监控详情

**预期响应：**
```
✅ 充值地址绑定成功！

充值引用：user_12345
协议：evm
充值地址：0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1

监控中：
- ethereum-sepolia: USDT, USDC
- polygon-amoy: USDT, USDC

用户可以从这些链中的任何一个发送任何支持的代币。
地址将自动监控所有交易。
```

### 示例 2：通过 API 绑定充值地址

**使用 cURL：**

```bash
curl -X POST https://your-payin.example.com/api/v1/deposits/bind \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "depositReference": "user_12345",
    "protocol": "evm"
  }'
```

**使用 TypeScript：**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    depositReference: 'user_12345',
    protocol: 'evm'
  })
});

const result = await response.json();
console.log('充值地址已绑定：', result.data);
```

**响应：**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "monitoringTargets": [
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDC"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDC"
      }
    ],
    "bindingCreatedAt": "2025-01-28T14:30:00Z"
  },
  "message": "充值地址绑定成功"
}
```

### 示例 3：列出用户的充值历史

**通过 API：**

```bash
curl "https://your-payin.example.com/api/v1/deposits/references?depositReference=user_12345" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**通过 MCP：**

```
显示 user_12345 的充值历史
```

**响应：**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "totalDeposits": 5,
    "totalAmount": "127.50",
    "deposits": [
      {
        "id": "dep_123",
        "amount": "50.00",
        "currency": "USDT",
        "chain": "ethereum-sepolia",
        "status": "confirmed",
        "txHash": "0xabc...",
        "confirmedAt": "2025-01-28T10:15:00Z"
      },
      {
        "id": "dep_124",
        "amount": "77.50",
        "currency": "USDC",
        "chain": "polygon-amoy",
        "status": "confirmed",
        "txHash": "0xdef...",
        "confirmedAt": "2025-01-28T14:22:00Z"
      }
    ]
  }
}
```

## 充值生命周期

### 完整流程图

```
1. 绑定地址（到用户 ID）
   ↓
2. 开始多链监控（所有协议链）
   ↓
3. [用户从任意链充值]
   ↓
4. 检测交易（在任何被监控的链上）
   ↓
5. 创建转账记录
   ↓
6. 等待确认（链特定：3-10 个区块）
   ↓
7. 充值已确认
   ↓
8. 发送 Webhook 通知
   ↓
9. 继续监控（地址保持绑定）
```

### 状态转换

充值使用 3 状态确认流程：

```
pending → confirmed → completed
```

**状态含义：**

- **`pending`**：在区块链上检测到交易，等待确认
- **`confirmed`**：达到所需的区块确认数
- **`completed`**：充值已处理并存入用户账户

::: tip 无过期时间
与订单不同，充值永不过期。地址会无限期保持活跃状态，可以接收无限次充值。
:::

### 多链监控

当您将地址绑定到协议时，PayIn 会自动监控该协议族中的**所有链**：

**EVM 协议：**
- Ethereum（主网 + Sepolia）
- Polygon（主网 + Amoy）
- 所有支持的代币（USDT、USDC、DAI）

**Tron 协议：**
- Tron（主网 + Nile 测试网）
- 所有支持的代币（USDT、USDC）

**Solana 协议：**
- Solana（主网 + Devnet）
- 所有支持的代币（USDT、USDC）

**示例场景：**

```typescript
// 用户绑定 EVM 地址
const binding = await payin.deposits.bind({
  depositReference: 'user_12345',
  protocol: 'evm'
});
// 返回地址：0x742d35...

// 用户现在可以从以下网络充值：
// ✅ Ethereum Sepolia USDT
// ✅ Ethereum Sepolia USDC
// ✅ Polygon Amoy USDT
// ✅ Polygon Amoy USDC
// 全部发送到同一个地址：0x742d35...

// PayIn 自动监控所有链
// 无需创建单独的绑定
```

## API 参考

### 绑定充值地址

为用户绑定一个永久充值地址。

**接口：** `POST /api/v1/deposits/bind`

**必填字段：**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `depositReference` | string | 您系统的唯一用户标识符 |
| `protocol` | string | 协议族：`evm`、`tron` 或 `solana` |

**可选字段：**

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `metadata` | object | 附加到绑定的自定义数据 |

**请求示例：**

```json
{
  "depositReference": "user_12345",
  "protocol": "evm",
  "metadata": {
    "user_email": "player@example.com",
    "game_id": "game_xyz",
    "registration_date": "2025-01-15"
  }
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "monitoringTargets": [
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDC"
      }
    ],
    "bindingCreatedAt": "2025-01-28T14:30:00Z"
  }
}
```

::: tip 幂等操作
如果您使用已存在的 depositReference 调用绑定接口，PayIn 会返回现有绑定而不是创建新绑定。这确保每个用户在每个协议上只有一个地址。
:::

### 解绑充值地址

从用户解绑充值地址（停止监控）。

**接口：** `POST /api/v1/deposits/unbind`

**方法 1：通过充值引用**

解绑此充值引用的所有地址。

```json
{
  "depositReference": "user_12345"
}
```

**方法 2：通过地址和协议**

解绑特定地址。

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "protocol": "evm"
}
```

**响应：**

```json
{
  "success": true,
  "message": "充值地址解绑成功"
}
```

::: warning 解绑会停止监控
解绑后，PayIn 将不再监控该地址。发送到此地址的任何充值都不会被检测或记入。
:::

### 列出充值引用

列出所有充值引用及统计信息。

**接口：** `GET /api/v1/deposits/references`

**查询参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `depositReference` | string | 按特定充值引用过滤 |
| `protocol` | string | 按协议过滤：`evm`、`tron`、`solana` |
| `page` | number | 页码（默认：1） |
| `limit` | number | 每页项数（默认：20，最大：100） |
| `search` | string | 在充值引用中搜索 |

**请求示例：**

```bash
curl "https://your-payin.example.com/api/v1/deposits/references?protocol=evm&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**响应：**

```json
{
  "success": true,
  "data": {
    "references": [
      {
        "depositReference": "user_12345",
        "protocol": "evm",
        "depositAddress": "0x742d35...",
        "totalDeposits": 5,
        "totalAmount": "127.50",
        "lastDepositAt": "2025-01-28T14:22:00Z",
        "boundAt": "2025-01-20T09:00:00Z"
      },
      {
        "depositReference": "user_67890",
        "protocol": "evm",
        "depositAddress": "0x9a8b7c...",
        "totalDeposits": 12,
        "totalAmount": "543.20",
        "lastDepositAt": "2025-01-28T16:45:00Z",
        "boundAt": "2025-01-18T14:30:00Z"
      }
    ],
    "total": 250,
    "page": 1,
    "limit": 10
  }
}
```

### 获取充值详情

检索特定引用的详细充值历史。

**接口：** `GET /api/v1/deposits/references/:depositReference`

**响应：**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "boundAt": "2025-01-20T09:00:00Z",
    "totalDeposits": 5,
    "totalAmount": "127.50",
    "deposits": [
      {
        "id": "dep_123",
        "amount": "50.00",
        "currency": "USDT",
        "chain": "ethereum-sepolia",
        "status": "confirmed",
        "txHash": "0xabc123...",
        "blockNumber": 1234567,
        "confirmations": 12,
        "requiredConfirmations": 3,
        "detectedAt": "2025-01-28T10:13:45Z",
        "confirmedAt": "2025-01-28T10:15:00Z"
      }
    ]
  }
}
```

## 集成示例

### 游戏钱包系统

游戏平台的完整集成示例：

```typescript
import { PayInClient } from '@payin/sdk';

class GamingWalletService {
  private payin: PayInClient;

  constructor(apiKey: string) {
    this.payin = new PayInClient({
      apiKey,
      baseUrl: 'https://your-payin.example.com/api/v1',
    });
  }

  /**
   * 步骤 1：用户注册 - 创建充值地址
   */
  async onUserRegistration(userId: string, userEmail: string) {
    try {
      // 为新用户绑定充值地址
      const binding = await this.payin.deposits.bind({
        depositReference: `player_${userId}`,
        protocol: 'evm',
        metadata: {
          user_id: userId,
          email: userEmail,
          created_at: new Date().toISOString(),
          game_region: 'us-west',
        },
      });

      // 在数据库中存储充值地址
      await this.db.users.update(userId, {
        depositAddress: binding.depositAddress,
        depositProtocol: binding.protocol,
        depositAddressBoundAt: binding.bindingCreatedAt,
      });

      // 向用户显示充值地址
      await this.sendWelcomeEmail(userEmail, binding.depositAddress);

      return binding;
    } catch (error) {
      console.error('创建充值地址失败：', error);
      throw new Error('钱包设置失败。请重试。');
    }
  }

  /**
   * 步骤 2：用户想要充值 - 显示说明
   */
  async getDepositInstructions(userId: string) {
    const user = await this.db.users.findById(userId);

    if (!user.depositAddress) {
      throw new Error('用户没有充值地址。请联系客服。');
    }

    return {
      depositAddress: user.depositAddress,
      instructions: [
        '发送任意数量的 USDT 或 USDC 到上述地址',
        '支持的网络：Ethereum Sepolia、Polygon Amoy',
        '确认后您的余额将自动存入',
        '最低充值：1 USDT/USDC',
      ],
      supportedTokens: ['USDT', 'USDC'],
      supportedChains: ['ethereum-sepolia', 'polygon-amoy'],
      qrCode: this.generateQRCode(user.depositAddress),
    };
  }

  /**
   * 步骤 3：处理充值 webhook 通知
   */
  async handleDepositWebhook(event: PayInWebhookEvent) {
    // 验证 webhook 签名（对安全性很重要！）
    if (!this.payin.webhooks.verify(event)) {
      throw new Error('无效的 webhook 签名');
    }

    if (event.type === 'deposit.completed') {
      const { depositReference, amount, currency, chain, txHash } = event.data;

      // 从充值引用中提取用户 ID
      const userId = depositReference.replace('player_', '');

      // 记入用户游戏余额
      await this.db.transactions.create({
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        currency,
        chain,
        tx_hash: txHash,
        status: 'completed',
        created_at: new Date(),
      });

      // 更新用户余额
      await this.db.users.incrementBalance(userId, parseFloat(amount));

      // 发送确认通知
      const user = await this.db.users.findById(userId);
      await this.notificationService.send(userId, {
        title: '充值已确认',
        message: `${amount} ${currency} 已添加到您的钱包`,
        type: 'success',
      });

      // 发送邮件确认
      await this.emailService.sendDepositConfirmation(user.email, {
        amount,
        currency,
        chain,
        txHash,
        newBalance: user.balance + parseFloat(amount),
      });

      // 记录分析日志
      await this.analytics.track('deposit_completed', {
        user_id: userId,
        amount,
        currency,
        chain,
      });

      console.log('充值处理成功：', {
        userId,
        amount,
        currency,
        txHash,
      });
    }
  }

  /**
   * 步骤 4：用户想要提现 - 处理提现
   */
  async processWithdrawal(userId: string, amount: number, withdrawalAddress: string) {
    const user = await this.db.users.findById(userId);

    if (user.balance < amount) {
      throw new Error('余额不足');
    }

    // 从用户余额中扣除
    await this.db.users.decrementBalance(userId, amount);

    // 创建提现记录
    await this.db.transactions.create({
      user_id: userId,
      type: 'withdrawal',
      amount: -amount,
      currency: 'USDT',
      withdrawal_address: withdrawalAddress,
      status: 'pending',
    });

    // 通过您的支付处理器处理提现
    // ... 提现逻辑 ...
  }

  /**
   * 步骤 5：用户账户删除 - 解绑地址
   */
  async onUserDeletion(userId: string) {
    const user = await this.db.users.findById(userId);

    if (user.depositAddress) {
      // 解绑充值地址（停止监控）
      await this.payin.deposits.unbind({
        depositReference: `player_${userId}`,
      });

      console.log('已为删除的用户解绑充值地址：', userId);
    }
  }

  private generateQRCode(address: string): string {
    // 为充值地址生成二维码
    // 实现取决于您的二维码库
    return `data:image/png;base64,...`;
  }

  private async sendWelcomeEmail(email: string, depositAddress: string) {
    // 发送带有充值说明的欢迎邮件
    // ...
  }
}
```

### SaaS 订阅平台

基于订阅的服务示例：

```typescript
class SubscriptionPaymentService {
  async onSubscriptionCreated(customerId: string, plan: string) {
    // 为客户绑定充值地址
    const binding = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        depositReference: `customer_${customerId}`,
        protocol: 'evm',
        metadata: {
          customer_id: customerId,
          subscription_plan: plan,
          created_at: new Date().toISOString(),
        },
      }),
    });

    const result = await binding.json();

    if (!result.success) {
      throw new Error(`创建充值地址失败：${result.message}`);
    }

    // 存入数据库
    await this.db.customers.update(customerId, {
      cryptoDepositAddress: result.data.depositAddress,
      depositProtocol: result.data.protocol,
    });

    // 发送设置邮件和支付说明
    await this.sendSubscriptionSetupEmail(customerId, result.data);

    return result.data;
  }

  async handleSubscriptionPayment(event: PayInWebhookEvent) {
    if (event.type === 'deposit.completed') {
      const { depositReference, amount, currency } = event.data;
      const customerId = depositReference.replace('customer_', '');

      // 记入客户余额
      await this.db.customers.incrementBalance(customerId, parseFloat(amount));

      // 检查是否足够续订订阅
      const customer = await this.db.customers.findById(customerId);
      const subscriptionCost = this.getSubscriptionCost(customer.plan);

      if (customer.balance >= subscriptionCost) {
        // 自动续订订阅
        await this.renewSubscription(customerId, subscriptionCost);

        // 从余额中扣除
        await this.db.customers.decrementBalance(customerId, subscriptionCost);

        // 发送续订确认
        await this.emailService.sendRenewalConfirmation(customer.email, {
          plan: customer.plan,
          amount: subscriptionCost,
          nextRenewal: this.getNextRenewalDate(),
        });
      }
    }
  }

  private async sendSubscriptionSetupEmail(customerId: string, depositData: any) {
    const customer = await this.db.customers.findById(customerId);

    const emailContent = `
      欢迎使用 ${customer.plan} 计划！

      您的加密货币支付地址：
      ${depositData.depositAddress}

      激活订阅：
      1. 发送 USDT 或 USDC 到上述地址
      2. 支持的网络：Ethereum、Polygon
      3. 最低：${this.getSubscriptionCost(customer.plan)} USDT

      支付确认后，您的订阅将自动激活。
    `;

    await this.emailService.send(customer.email, emailContent);
  }

  private getSubscriptionCost(plan: string): number {
    const costs = {
      basic: 9.99,
      pro: 29.99,
      enterprise: 99.99,
    };
    return costs[plan] || 0;
  }

  private getNextRenewalDate(): Date {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  private async renewSubscription(customerId: string, cost: number) {
    await this.db.subscriptions.create({
      customer_id: customerId,
      renewal_date: new Date(),
      next_renewal: this.getNextRenewalDate(),
      amount_paid: cost,
      payment_method: 'crypto',
    });
  }
}
```

## 高级配置

### 充值引用设计

使用清晰、结构化的充值引用：

**良好示例：**
```
player_12345           // 游戏
customer_67890         // SaaS
user_alice_wallet      // 通用平台
member_premium_999     // 会员等级
```

**避免：**
```
12345                  // 无上下文
temp_user              // 非永久性
deposit_1              // 通用
user                   // 不唯一
```

::: tip 唯一性至关重要
充值引用在您的组织内必须唯一。每个 depositReference 在每个协议上只能有一个绑定。
:::

### 多币种策略

单个地址可以接收多种代币：

```typescript
// 用户有一个 EVM 地址
const binding = await payin.deposits.bind({
  depositReference: 'user_12345',
  protocol: 'evm'
});
// 地址：0x742d35...

// 此地址可以接收：
// ✅ Ethereum 上的 USDT
// ✅ Ethereum 上的 USDC
// ✅ Polygon 上的 USDT
// ✅ Polygon 上的 USDC
// 所有充值都记入同一个用户账户
```

**优势：**
- 简单的用户体验（只需记住一个地址）
- 统一的充值历史
- 自动多链支持
- 无需事先选择网络

### 最低充值金额

在应用程序中实现最低充值检查：

```typescript
async handleDepositWebhook(event: PayInWebhookEvent) {
  const { amount, currency } = event.data;
  const minDeposit = 1.0; // 最低 1 USDT/USDC

  if (parseFloat(amount) < minDeposit) {
    // 处理低于最低金额的充值
    await this.notifyUserBelowMinimum(event.data.depositReference, amount);

    // 选项 1：仍然记入（用户友好）
    await this.creditUserBalance(event.data);

    // 选项 2：保留直到用户充值更多
    await this.addToPendingBalance(event.data);

    return;
  }

  // 正常充值处理
  await this.creditUserBalance(event.data);
}
```

### 跳转 URL

配置充值确认后用户跳转的位置：

```typescript
// 组织级别的充值跳转 URL
// 在管理后台设置或通过 API 设置

// 充值确认后，PayIn 会附加参数：
// https://yourgame.com/wallet/success
//   ?deposit_reference=player_12345
//   &deposit_id=dep_123
//   &status=confirmed
//   &amount=50.00
//   &currency=USDT
//   &chain_id=ethereum-sepolia
//   &confirmed_at=2025-01-28T10:15:00Z
//   &tx_hash=0xabc123...
```

::: tip 仅配置级别
与订单不同，充值不支持单次交易的跳转 URL。在管理后台配置组织级别的跳转。
:::

## 最佳实践

### 地址绑定

**推荐做法：**
- ✅ 在用户注册时绑定地址
- ✅ 在数据库中存储充值地址
- ✅ 在用户钱包页面显著显示地址
- ✅ 提供二维码以便扫描
- ✅ 清楚显示支持的网络和代币

**避免：**
- ❌ 为同一用户创建多个绑定
- ❌ 删除用户的充值地址，除非账户被删除
- ❌ 向用户隐藏充值地址
- ❌ 忘记处理 webhook 通知

### Webhook 处理

**关键：幂等性**

```typescript
async handleDepositWebhook(event: PayInWebhookEvent) {
  // 必须：验证签名
  if (!verifySignature(event)) {
    throw new Error('无效的签名');
  }

  // 必须：检查重复处理
  const existing = await this.db.transactions.findByTxHash(event.data.txHash);
  if (existing) {
    console.log('充值已处理，跳过');
    return; // 幂等 - 多次处理是安全的
  }

  // 必须：使用数据库事务
  await this.db.transaction(async (trx) => {
    // 记入用户余额
    await trx.users.incrementBalance(userId, amount);

    // 创建交易记录
    await trx.transactions.create({
      tx_hash: event.data.txHash,
      user_id: userId,
      amount: amount,
      status: 'completed',
    });
  });

  // 快速返回 200（如需要可异步处理）
  return { success: true };
}
```

### 余额管理

**原子操作：**

```typescript
// ❌ 错误：竞态条件
const user = await db.users.findById(userId);
const newBalance = user.balance + depositAmount;
await db.users.update(userId, { balance: newBalance });

// ✅ 良好：原子递增
await db.users.increment(userId, 'balance', depositAmount);

// ✅ 更好：使用事务
await db.transaction(async (trx) => {
  await trx.users.increment(userId, 'balance', depositAmount);
  await trx.transactions.create({ /* ... */ });
});
```

### 监控和告警

**设置以下监控：**

```typescript
// 1. Webhook 失败
if (webhookFailed) {
  await alerting.critical('充值 webhook 失败', {
    depositReference,
    txHash,
    error,
  });
}

// 2. 大额充值
if (parseFloat(amount) > 10000) {
  await alerting.info('检测到大额充值', {
    depositReference,
    amount,
    currency,
  });
}

// 3. 异常活动
const recentDeposits = await getRecentDeposits(depositReference, '24h');
if (recentDeposits.length > 10) {
  await alerting.warning('充值频率异常', {
    depositReference,
    count: recentDeposits.length,
  });
}
```

### 测试策略

**1. 测试网测试：**

```typescript
// 所有开发使用测试网
const payin = new PayInClient({
  apiKey: process.env.PAYIN_TESTNET_API_KEY,
  baseUrl: 'https://your-payin.example.com/api/v1',
});

// 测试完整流程：
// 1. 绑定地址
// 2. 发送测试网代币
// 3. 验证收到 webhook
// 4. 检查余额已记入
```

**2. 测试场景：**

- ✅ 新用户的首次充值
- ✅ 同一地址的多次充值
- ✅ 来自不同链的充值
- ✅ 使用不同代币的充值
- ✅ 低于最低金额的充值
- ✅ 大额充值（>$1000）
- ✅ Webhook 重试机制
- ✅ 重复 webhook 处理

## 故障排查

### "地址池中没有可用地址"

**问题：** 绑定失败，地址池错误。

**解决方案：**
1. 在管理后台检查地址池状态
2. 按照 [地址池设置](/zh/guide/address-pool-setup) 导入更多地址
3. 确保为正确的协议（EVM/Tron）准备地址
4. 检查现有地址是否已绑定（充值不会自动释放）

```bash
# 通过 API 检查池状态
curl https://your-payin.example.com/api/v1/address-pool/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 充值未检测到

**问题：** 用户发送了充值但未收到 webhook。

**原因：**
- 错误的网络（例如，发送到 ETH 主网而不是 Sepolia）
- 错误的代币（例如，发送 ETH 而不是 USDT）
- 不支持的代币
- 交易仍在待处理

**解决方案：**
1. 在区块浏览器上检查交易
2. 验证正确的网络和代币
3. 等待所需的确认
4. 检查 PayIn 监控状态

### 重复充值记入

**问题：** 同一笔充值记入用户余额两次。

**原因：** webhook 处理程序中缺少幂等性检查。

**解决方案：**

```typescript
// 添加幂等性检查
async handleDeposit(event: PayInWebhookEvent) {
  const { txHash, depositReference } = event.data;

  // 检查是否已处理
  const existing = await this.db.transactions.findOne({
    tx_hash: txHash,
    deposit_reference: depositReference,
  });

  if (existing) {
    console.log('充值已处理：', txHash);
    return { success: true }; // 返回成功以确认 webhook
  }

  // 处理充值...
}
```

### 错误链充值

**问题：** 用户充值到不支持的链。

**预防：**
- 在充值页面上清楚列出支持的网络
- 显示网络名称（而不仅仅是 ID）
- 提供特定网络的说明

**如果发生：**
- 联系 PayIn 客服并提供交易哈希
- PayIn 可以帮助验证地址所有权
- 发送到错误链的资金可能无法恢复

## 下一步

### 必读指南
- [Webhooks](/zh/guide/webhooks) - 设置自动事件通知
- [API 集成](/zh/guide/api-integration) - 完整 API 文档
- [安全性](/zh/guide/security) - 保护您的集成

### 相关服务
- [订单支付服务](/zh/guide/order-payment) - 一次性支付地址
- [支付链接](/zh/guide/payment-links) - 无代码支付收款

### 技术参考
- [支持的网络](/zh/guide/supported-networks) - 可用的区块链
- [支持的代币](/zh/guide/supported-tokens) - 可用的稳定币
- [地址管理](/zh/guide/address-management) - 高级地址池管理

## 支持

需要充值服务帮助？

- 📧 **邮箱**：support@payin.com
- 💬 **Discord**：[加入我们的社区](https://discord.gg/payin)
- 🤖 **AI 助手**：询问您的 MCP 驱动的 AI 助手
