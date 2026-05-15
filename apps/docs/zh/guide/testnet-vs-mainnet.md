# 测试网 vs 主网

PayIn 提供两个独立的环境来支持你的开发和生产需求：**测试网（Testnet）** 和 **主网（Mainnet）**。理解两者的差异有助于你安全开发和自信部署。

## 概览

| 方面 | 测试网 | 主网 |
|------|--------|------|
| **URL** | [your-payin.example.com](https://your-payin.example.com) | [your-payin.example.com](https://your-payin.example.com) |
| **用途** | 开发与测试 | 生产运营 |
| **代币** | 测试代币（无价值） | 真实加密货币 |
| **区块链** | 测试网络（Sepolia、Amoy、Shasta） | 主网络（Ethereum、Polygon、Tron） |
| **成本** | 从水龙头获取免费测试代币 | 真实交易费用 |
| **数据** | 独立测试数据 | 生产数据 |
| **API Key** | 测试网 API key | 主网 API key（独立） |

## 测试网环境

### 什么是测试网？

测试网是一个**无风险的沙盒环境**，你可以：
- 无财务风险地测试 PayIn 集成
- 尝试不同的支付流程
- 调试和排查问题
- 培训团队使用 PayIn
- 进行负载测试

### 何时使用测试网

✅ **始终在以下情况使用测试网：**
- 首次将 PayIn 集成到应用中
- 开发涉及支付的新功能
- 测试支付流程和边缘情况
- 学习 PayIn 工作原理
- 培训新开发人员
- 运行自动化集成测试

### 测试网特点

**测试代币**
- 代币无真实价值
- 从区块链水龙头获取免费代币
- 无成本顾虑，无限测试

**测试区块链**
- Ethereum Sepolia（以太坊测试网）
- Polygon Amoy（Polygon 测试网）
- Tron Shasta（Tron 测试网）
- Solana Devnet（Solana 测试网）

**更快的确认**
- 测试网络通常有更快的出块时间
- 测试时确认要求较低
- 可能偶尔停机或重置

### 获取测试代币

#### Ethereum Sepolia

**官方水龙头：**
- [Alchemy Sepolia 水龙头](https://sepoliafaucet.com/)
- [Infura Sepolia 水龙头](https://www.infura.io/faucet/sepolia)
- [Chainlink 水龙头](https://faucets.chain.link/sepolia)

**步骤：**
1. 访问水龙头网站
2. 连接钱包或输入地址
3. 请求测试 ETH
4. 使用测试 ETH 从测试网 DEX 获取测试 USDT/USDC

#### Polygon Amoy

**官方水龙头：**
- [Polygon 水龙头](https://faucet.polygon.technology/)
- [Alchemy Polygon 水龙头](https://www.alchemy.com/faucets/polygon-amoy)

**步骤：**
1. 访问 Polygon 水龙头
2. 选择 "Amoy Testnet"
3. 输入钱包地址
4. 接收测试 MATIC 代币

#### Tron Shasta

**官方水龙头：**
- [TronGrid Shasta 水龙头](https://www.trongrid.io/shasta/)

**步骤：**
1. 访问 TronGrid Shasta 水龙头
2. 输入 Tron 地址
3. 完成验证码
4. 接收测试 TRX

#### Solana Devnet

**获取测试 SOL：**
```bash
# 使用 Solana CLI
solana airdrop 2 <YOUR_ADDRESS> --url devnet

# 或使用在线水龙头
# 访问: https://faucet.solana.com/
```

## 主网环境

### 什么是主网？

主网是**生产环境**，在此：
- 发生真实的加密货币交易
- 转移实际资金
- 存储生产数据
- 你的业务实际运营

### 何时使用主网

✅ **在以下情况使用主网：**
- 已在测试网上充分测试
- 准备接受真实支付
- 启动到生产环境
- 处理实际客户交易

⚠️ **主网前的先决条件：**
- 在测试网上完成集成测试
- 对实现进行安全审查
- 适当的错误处理和监控
- Webhook 端点已配置和测试
- 团队培训完成

### 主网特点

**真实加密货币**
- 真实区块链上的 USDT、USDC、DAI
- 实际财务价值
- 适用真实交易费用
- 不可逆转的交易

**主区块链**
- Ethereum 主网
- Polygon 主网
- Tron 主网
- Solana 主网

**生产安全**
- 需要彻底测试
- 实现适当的错误处理
- 使用监控和告警
- 遵循安全最佳实践

## 环境切换

### 对于 MCP Server

在 MCP 配置中更改 `X-PayIn-API-URL` 头部：

**测试网：**
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-testnet-api-key",
        "X-PayIn-API-URL": "https://your-payin.example.com"
      }
    }
  }
}
```

**主网：**
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-mainnet-api-key",
        "X-PayIn-API-URL": "https://your-payin.example.com"
      }
    }
  }
}
```

### 对于直接 API 集成

在代码中更改基础 URL：

**TypeScript 示例：**
```typescript
// 测试网
const PAYIN_API_URL = 'https://your-payin.example.com/api/v1';
const API_KEY = process.env.PAYIN_TESTNET_API_KEY;

// 主网
const PAYIN_API_URL = 'https://your-payin.example.com/api/v1';
const API_KEY = process.env.PAYIN_MAINNET_API_KEY;
```

## 最佳实践

### 开发工作流

1. **从测试网开始**
   - 注册测试网账号
   - 生成测试网 API key
   - 开发和测试所有功能
   - 验证 webhook 处理

2. **彻底测试**
   - 测试正常路径场景
   - 测试错误场景（余额不足、订单过期）
   - 测试 webhook 传递和重试
   - 进行负载测试

3. **预发布环境**（可选）
   - 为预发布创建独立测试网账号
   - 镜像生产配置
   - 运行最终集成测试

4. **迁移到主网**
   - 注册主网账号
   - 生成主网 API key
   - 更新配置
   - 从小额测试交易开始
   - 密切监控

### API Key 管理

::: danger 独立 API Key
测试网和主网使用**完全独立的 API key**。永远不要在测试网上使用主网 API key，反之亦然。
:::

**建议：**
- 将 API key 存储在环境变量中
- 为开发/预发布/生产使用不同的 key
- 定期轮换 API key
- 永远不要将 API key 提交到版本控制

```typescript
// 良好实践
const config = {
  apiUrl: process.env.NODE_ENV === 'production'
    ? 'https://your-payin.example.com/api/v1'
    : 'https://your-payin.example.com/api/v1',
  apiKey: process.env.NODE_ENV === 'production'
    ? process.env.PAYIN_MAINNET_API_KEY
    : process.env.PAYIN_TESTNET_API_KEY
};
```

### 环境变量

```bash
# .env.development
PAYIN_API_URL=https://your-payin.example.com/api/v1
PAYIN_API_KEY=your-testnet-api-key

# .env.production
PAYIN_API_URL=https://your-payin.example.com/api/v1
PAYIN_API_KEY=your-mainnet-api-key
```

## 数据隔离

::: warning 完全数据分离
测试网和主网是**完全隔离**的环境：
- 独立的用户账号
- 独立的组织
- 独立的 API key
- 独立的支付数据
- 独立的数据库系统
:::

你不能转移：
- 测试网的订单到主网
- 环境之间的 API key
- 用户账号或组织
- 任何配置或数据

## 监控和支持

### 测试网
- 可能偶尔停机
- 尽力支持
- 社区论坛

### 主网
- 高可用性（99.9% 正常运行时间 SLA）
- 优先支持
- 7×24 事件监控
- 状态页面：[status.payin.com](https://status.payin.com)（即将推出）

## 下一步

- [支持的网络](/zh/guide/supported-networks) - 查看所有区块链网络
- [支持的代币](/zh/guide/supported-tokens) - 查看可用的稳定币
- [API 集成指南](/zh/guide/api-integration) - 直接 API 集成
- [MCP 快速开始](/zh/guide/quick-start-mcp) - 快速开始

## 常见问题

**问：我能在测试网和主网使用相同的 API key 吗？**
不能，测试网和主网有独立的 API key。你必须为每个环境生成独立的 key。

**问：我的测试网订单会出现在主网上吗？**
不会，测试网和主网是完全独立的。在测试网上创建的数据会留在测试网上。

**问：如何从测试网迁移到主网？**
你不迁移数据。相反，你切换应用程序的配置以使用主网 URL 和 API key，然后在主网上创建新订单。

**问：测试网代币是真钱吗？**
不是，测试网代币没有真实价值。它们仅用于测试目的。

**问：我能跳过测试网直接使用主网吗？**
虽然技术上可行，但我们**强烈不建议**这样做。始终在测试网上彻底测试，以避免在真实资金上犯代价高昂的错误。
