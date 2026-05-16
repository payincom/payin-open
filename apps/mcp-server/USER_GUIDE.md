# PayIn MCP Server 使用指南

## 部署后配置和使用完整指南

---

## 📝 目录

1. [部署](#部署)
2. [配置 MCP Client](#配置-mcp-client)
3. [功能介绍](#功能介绍)
4. [使用场景示例](#使用场景示例)
5. [高级用法](#高级用法)

---

## 部署

### 部署到 Cloudflare Workers

```bash
# 1. 登录 Cloudflare
wrangler login

# 2. 部署到生产环境
wrangler deploy --env production

# 3. 记录部署后的 URL
# 输出示例：
# Published payin-mcp-server-prod
# https://payin-mcp-server-prod.your-subdomain.workers.dev
```

**部署后你会得到一个 URL**：
```
https://payin-mcp-server-prod.your-subdomain.workers.dev
```

---

## 配置 MCP Client

### Claude Desktop 配置

#### 1. 找到配置文件

**macOS**:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux**:
```bash
~/.config/Claude/claude_desktop_config.json
```

#### 2. 添加 PayIn MCP Server 配置

编辑配置文件，添加：

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://payin-mcp-server-prod.your-subdomain.workers.dev/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "你的PayIn API Key",
        "X-PayIn-API-URL": "https://api.your-payin.example.com"
      }
    }
  }
}
```

**配置说明**：
- `url`: 你的 MCP Server 地址（加 `/mcp` 路径）
- `X-API-Key`: 在 PayIn Admin 中创建的 API Key
- `X-PayIn-API-URL`: PayIn API 服务器地址

#### 3. 重启 Claude Desktop

配置完成后，**重启 Claude Desktop** 使配置生效。

#### 4. 验证连接

重启后，在 Claude Desktop 中输入：

```
PayIn MCP Server 是否已连接？
```

Claude 会检查连接状态。如果成功，你可以开始使用了！

---

## 功能介绍

PayIn MCP Server 提供两大类功能：

### 1. AI 集成助手（开发者模式）

**目标用户**：想要集成 PayIn 的开发者

**功能**：
- 📚 访问 PayIn 文档
- 💡 生成集成代码
- 🔍 查看 API 示例
- 🐛 诊断集成问题

**特点**：AI 帮助学习和理解，但**你自己的代码直接调用 PayIn API**

### 2. AI 自动化运营（运营者模式）

**目标用户**：PayIn 系统的运营人员

**功能**：
- 📊 查询订单和统计
- 👥 管理用户充值地址
- 🔍 监控地址池状态
- 📈 生成分析报告

**特点**：AI **直接通过 MCP Server 操作 PayIn**，无需手动执行

---

## 使用场景示例

### 场景 1：开发者学习集成（推荐新用户）

#### 示例 1.1：了解 PayIn

**你对 Claude 说**：
```
我想了解 PayIn 支付系统，它能做什么？
```

**Claude 会**：
1. 访问 `docs://payin/getting-started` 资源
2. 阅读 PayIn 介绍
3. 向你解释 PayIn 的功能和使用场景

**Claude 的回答示例**：
```
PayIn 是一个多链稳定币支付系统，提供两种服务：

1. **订单支付服务**：适合电商、票务等一次性支付场景
   - 为每个订单分配临时支付地址
   - 支付完成后地址自动释放

2. **用户充值服务**：适合游戏、钱包等需要多次充值的场景
   - 为用户绑定永久充值地址
   - 支持多次充值到同一地址

支持的区块链：Ethereum、Polygon、Tron 等
支持的代币：USDT、USDC、DAI 等

想了解如何集成吗？
```

---

#### 示例 1.2：获取集成代码

**你对 Claude 说**：
```
我想在我的 Node.js 电商网站中集成订单支付，帮我生成代码
```

**Claude 会**：
1. 调用 `integration_wizard` Prompt
2. 访问 `docs://payin/examples/curl` 资源
3. 生成 TypeScript/JavaScript 代码

**Claude 提供的代码示例**：
```typescript
// 1. 创建订单
async function createPaymentOrder(orderData) {
  const response = await fetch('https://api.your-payin.example.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderReference: orderData.orderId,
      amount: orderData.amount,
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      callbackUrl: 'https://your-site.com/webhook/payin'
    })
  });

  return await response.json();
}

// 2. 展示支付页面
app.get('/checkout/:orderId', async (req, res) => {
  const order = await createPaymentOrder({
    orderId: req.params.orderId,
    amount: '10.50'
  });

  res.render('payment', {
    address: order.data.address,
    amount: order.data.amount,
    currency: order.data.currency,
    chainName: 'Ethereum Sepolia',
    expiresAt: order.data.expiresAt
  });
});

// 3. Webhook 回调处理
app.post('/webhook/payin', async (req, res) => {
  const { orderId, status, txHash } = req.body;

  if (status === 'completed') {
    // 订单支付成功，发货
    await fulfillOrder(orderId, txHash);
  }

  res.json({ received: true });
});
```

**关键点**：
- ✅ 代码由你的应用直接调用 PayIn API
- ✅ 不经过 MCP Server
- ✅ AI 只是帮助生成代码和提供指导

---

#### 示例 1.3：故障排查

**你对 Claude 说**：
```
我创建订单后，订单状态一直是 pending，但用户说已经转账了，怎么办？
```

**Claude 会**：
1. 调用 `troubleshoot` Prompt
2. 访问 `docs://payin/troubleshooting` 资源
3. 提供诊断步骤

**Claude 的诊断**：
```
让我帮你诊断这个问题。订单一直 pending 可能有以下原因：

1. **支付金额不匹配**
   - PayIn 要求金额完全匹配（Wei 级精度）
   - 用户可能发送了 10.499999 而不是 10.50

2. **支付到错误的链**
   - 用户可能在 Polygon 转账，但订单是 Ethereum

3. **等待区块确认**
   - Ethereum 需要 3 个确认，可能需要几分钟

4. **支付了错误的代币**
   - 用户可能发送了 USDC 而订单要求 USDT

**诊断步骤**：

我可以帮你检查。请提供：
- 订单 ID
- 用户声称的交易哈希

或者你可以自己检查：
1. 在区块链浏览器查询交易哈希
2. 确认接收地址、金额、代币都正确
3. 检查交易是否已确认

需要我帮你查询订单状态吗？
```

---

### 场景 2：运营人员自动化管理

#### 示例 2.1：查询今日订单统计

**运营人员对 Claude 说**：
```
帮我查看今天的订单统计
```

**Claude 会**：
1. 自动调用 `get_order_stats` 工具
2. 传入今天的日期范围
3. 展示结果

**实际执行**：
```
Claude 调用：
- Tool: get_order_stats
- 参数: {
    createdAfter: "2025-10-16T00:00:00Z",
    createdBefore: "2025-10-16T23:59:59Z"
  }

MCP Server 执行：
- 调用 PayIn API: GET /api/v1/orders/stats
```

**Claude 的回答**：
```
今天的订单统计（2025-10-16）：

📊 订单总数：125 笔
✅ 已完成：98 笔（78.4%）
⏳ 待支付：22 笔（17.6%）
❌ 已过期：5 笔（4.0%）
💰 总金额：$12,450.00

完成率较高，运营正常！

需要查看详细订单列表吗？
```

**关键点**：
- ✅ 运营人员无需手动调用 API
- ✅ 无需编写代码或执行 curl 命令
- ✅ AI 自动完成查询并展示结果

---

#### 示例 2.2：创建测试订单

**运营人员对 Claude 说**：
```
帮我创建一个测试订单，金额 0.01 USDT，用 Sepolia 测试网
```

**Claude 会**：
1. 调用 `create_order` 工具
2. 自动生成 orderReference
3. 返回支付信息

**实际执行**：
```
Claude 调用：
- Tool: create_order
- 参数: {
    orderReference: "test_order_1729072800",
    amount: "0.01",
    currency: "USDT",
    chainId: "ethereum-sepolia"
  }

MCP Server 执行：
- 调用 PayIn API: POST /api/v1/orders
```

**Claude 的回答**：
```
✅ 测试订单创建成功！

📋 订单信息：
- 订单 ID: 550e8400-e29b-41d4-a716-446655440000
- 订单号: test_order_1729072800
- 支付金额: 0.01 USDT
- 区块链: Ethereum Sepolia

💳 支付地址：
0x1234567890abcdef1234567890abcdef12345678

⏰ 有效期至：
2025-10-16 18:30:00（还有 10 分钟）

你可以使用测试网的 USDT 向这个地址转账 0.01 USDT 来测试支付流程。

需要我继续监控订单状态吗？
```

---

#### 示例 2.3：监控地址池状态

**运营人员对 Claude 说**：
```
检查一下地址池状态，确保有足够的地址
```

**Claude 会**：
1. 调用 `check_address_pool_availability` 工具（EVM）
2. 调用 `check_address_pool_availability` 工具（Tron）
3. 分析结果并给出建议

**实际执行**：
```
Claude 调用：
- Tool: check_address_pool_availability
- 参数: { protocol: "evm" }

- Tool: check_address_pool_availability
- 参数: { protocol: "tron" }

MCP Server 执行：
- 调用 PayIn API: GET /api/v1/address-pool/availability?protocol=evm
- 调用 PayIn API: GET /api/v1/address-pool/availability?protocol=tron
```

**Claude 的回答**：
```
📊 地址池状态检查：

🔷 **EVM 地址池**：
- 可用地址：85 个 ✅
- 已分配（订单）：15 个
- 已绑定（充值）：20 个
- 总管理地址：120 个
- 状态：正常

🔶 **Tron 地址池**：
- 可用地址：8 个 ⚠️
- 已分配（订单）：5 个
- 已绑定（充值）：12 个
- 总管理地址：25 个
- 状态：**即将耗尽！**

⚠️ **建议**：
Tron 地址池只剩 8 个可用地址，建议尽快补充至少 20-50 个地址。

需要我提供地址补充指南吗？
```

---

#### 示例 2.4：查看特定用户的充值记录

**运营人员对 Claude 说**：
```
查看用户 user_12345 的充值情况
```

**Claude 会**：
1. 调用 `get_user_deposit_address` 工具获取地址
2. 调用 `list_transfers` 工具查询该地址的转账记录

**Claude 的回答**：
```
👤 用户 user_12345 的充值信息：

📍 **充值地址**：
- EVM: 0xabcdef1234567890abcdef1234567890abcdef12
- 绑定时间: 2025-09-15 10:30:00

📊 **充值记录**（最近 10 笔）：

1. ✅ 2025-10-15 14:23:00
   - 金额: 100.00 USDT
   - 链: Ethereum Sepolia
   - 交易: 0xabc123...
   - 状态: 已完成

2. ✅ 2025-10-10 09:15:00
   - 金额: 50.00 USDT
   - 链: Polygon Amoy
   - 交易: 0xdef456...
   - 状态: 已完成

3. ✅ 2025-10-05 16:45:00
   - 金额: 200.00 USDC
   - 链: Ethereum Sepolia
   - 交易: 0xghi789...
   - 状态: 已完成

📈 **统计**：
- 总充值次数: 15 次
- 总充值金额: $1,250.00
- 最近充值: 1 天前

该用户充值活跃，一切正常！
```

---

#### 示例 2.5：生成周报

**运营人员对 Claude 说**：
```
生成本周的运营报告
```

**Claude 会**：
1. 调用 `generate_analytics_report` 工具
2. 指定本周的日期范围
3. 格式化输出

**Claude 的回答**：
```
📊 PayIn 运营周报
🗓️ 2025-10-10 至 2025-10-16

## 订单业务

📦 **订单统计**：
- 总订单：856 笔
- 已完成：672 笔（78.5%）
- 待支付：156 笔（18.2%）
- 已过期：28 笔（3.3%）

💰 **交易金额**：
- 总金额：$85,420.00
- 平均订单：$99.79
- 最大订单：$5,000.00
- 最小订单：$0.01

📈 **趋势分析**：
- 较上周增长：+12.5%
- 完成率提升：+2.3%
- 过期率下降：-0.5%

## 充值业务

👥 **用户充值**：
- 活跃用户：234 人
- 新增用户：45 人
- 总充值次数：1,203 次
- 总充值金额：$124,560.00

## 技术指标

🏊 **地址池健康度**：
- EVM 池：正常（85/120 可用）
- Tron 池：需补充（8/25 可用）⚠️

⚡ **系统性能**：
- API 响应时间：平均 120ms
- 区块确认时间：平均 3.2 分钟
- 系统可用性：99.98%

## 建议

1. ✅ 业务增长良好，建议继续保持
2. ⚠️ 尽快补充 Tron 地址池
3. 💡 考虑为高频用户提供专属优惠

需要导出详细数据吗？
```

---

### 场景 3：混合使用（最常见）

#### 示例 3.1：开发者边学边测

**开发者对 Claude 说**：
```
我想测试一下订单支付流程，帮我创建一个测试订单，然后告诉我如何在我的代码中实现相同的功能
```

**Claude 会**：
1. **先操作**：调用 `create_order` 工具创建测试订单
2. **再教学**：访问文档，生成集成代码

**Claude 的回答**：
```
好的！我先帮你创建一个测试订单，然后展示如何在你的代码中实现。

## 1. 测试订单已创建

✅ 订单信息：
- 支付地址: 0x1234...
- 金额: 0.01 USDT
- 有效期: 10 分钟

## 2. 在你的代码中实现

这是创建订单的完整代码：

```javascript
// 方式 1: 使用 fetch（推荐）
async function createOrder(orderData) {
  const response = await fetch('https://api.your-payin.example.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderReference: orderData.id,
      amount: orderData.amount,
      currency: 'USDT',
      chainId: 'ethereum-sepolia'
    })
  });

  const result = await response.json();
  return result.data;
}

// 使用示例
const order = await createOrder({
  id: 'order_123',
  amount: '10.50'
});

console.log('支付地址:', order.address);
console.log('订单状态:', order.status);
```

## 3. 下一步

你可以：
1. 向测试地址转账 0.01 USDT 测试支付
2. 将上面的代码集成到你的应用
3. 配置 Webhook 接收支付通知

需要我解释 Webhook 配置吗？
```

---

## 高级用法

### 1. 自动化巡检脚本

**场景**：每天定时检查系统状态

**与 Claude 对话**：
```
帮我每天早上检查：
1. 地址池是否充足
2. 昨天的订单统计
3. 是否有异常订单
```

**Claude 可以**：
- 立即执行一次检查
- 教你如何设置定时任务（cron）
- 生成自动化脚本

---

### 2. 批量操作

**场景**：为多个用户批量绑定充值地址

**与 Claude 对话**：
```
我有 100 个新用户需要绑定充值地址，用户 ID 从 user_1001 到 user_1100
```

**Claude 会**：
- 询问确认（避免误操作）
- 循环调用 `bind_deposit_address` 工具
- 报告成功和失败情况

**注意**：这种批量操作 AI 会执行得比较慢（每次调用都需要时间），对于大批量建议还是用脚本。

---

### 3. 数据分析

**场景**：分析支付行为

**与 Claude 对话**：
```
分析一下本月的订单数据：
- 哪条链最受欢迎？
- 平均订单金额是多少？
- 过期率高吗？
```

**Claude 会**：
- 调用 `list_orders` 获取数据
- 调用 `get_order_stats` 获取统计
- 分析数据并给出洞察

---

## 总结对比

### 开发者集成模式 vs 运营自动化模式

| 特性 | 开发者集成模式 | 运营自动化模式 |
|------|---------------|---------------|
| **目标** | 学习如何集成 PayIn | 直接操作 PayIn 系统 |
| **AI 角色** | 导师、代码生成器 | 自动化执行者 |
| **实际调用 API** | 你的应用代码 | MCP Server |
| **适用场景** | 新用户学习、集成开发 | 日常运营、数据查询 |
| **输出** | 代码、文档、指导 | 直接结果、报告 |
| **优势** | 学习效率高、代码可定制 | 无需编码、即问即答 |

---

## 快速开始检查清单

✅ **部署完成**
- [ ] 已部署到 Cloudflare Workers
- [ ] 记录了部署 URL

✅ **MCP Client 配置**
- [ ] 编辑了 Claude Desktop 配置文件
- [ ] 填入了正确的 URL 和 API Key
- [ ] 重启了 Claude Desktop

✅ **测试连接**
- [ ] 向 Claude 确认连接状态
- [ ] 测试访问文档（"打开 PayIn 快速开始指南"）
- [ ] 测试查询功能（"查看支持的区块链"）

✅ **开始使用**
- [ ] 根据需求选择使用模式
- [ ] 参考本指南的示例开始对话

---

## 获取帮助

**遇到问题？**

1. 向 Claude 寻求帮助：
   ```
   PayIn 集成遇到了问题：[描述问题]
   ```

2. 使用故障排查 Prompt：
   ```
   帮我排查这个错误：[错误信息]
   ```

3. 访问完整文档：
   ```
   打开 PayIn 故障排查指南
   ```

---

**享受 AI 驱动的 PayIn 集成体验！** 🎉
