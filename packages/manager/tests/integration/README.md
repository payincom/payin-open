# Manager + Processor 集成测试

## 概述

这个集成测试展示了 Manager 和 Processor 的完整集成流程，包括：

1. ✅ 使用 Supabase 数据库连接创建 Manager
2. ✅ 使用自定义 YAML 配置文件
3. ✅ 初始化 Manager 数据库（结构 + 配置默认值 + 业务设置）
4. ✅ 从数据库读取配置
5. ✅ 使用 Manager 构建 Processor 配置
6. ✅ 初始化并启动 Processor
7. ✅ 执行订单支付业务场景
8. ✅ 发送真实区块链转账

## 运行测试

### 前置条件

- Supabase 数据库已配置（测试中硬编码）
- 测试助记词已配置（测试中硬编码，仅包含测试网资金）
- Alchemy/Infura RPC 密钥已配置

### 执行命令

```bash
# 在 manager 包目录下运行
cd packages/manager
npm run test:integration
```

或者在项目根目录：

```bash
npm run test:integration -w @payin/manager
```

## 测试流程

### Step 1: 创建和初始化 Manager

- 使用 Supabase 数据库连接字符串
- 使用自定义 YAML 配置文件 (`config/manager-test.yaml`)
- 设置 `autoInit: true` 启用自动初始化
- 调用 `manager.initialize()` 执行初始化
  - 检查数据库 schema 完整性
  - 如果缺失表，自动创建并填充默认值
  - **始终检查并初始化 config_values 默认值**

**重要提示**:
- `autoInit: true` 时，`initialize()` 才会执行初始化逻辑
- 如果 `autoInit: false`，即使手动调用 `initialize()` 也不会执行（这是当前设计）

### Step 2: 读取数据库配置

- 列出所有启用的链
- 列出所有配置的代币
- 列出所有业务设置（config_values）

### Step 3: 构建 Processor 配置

- 使用 `manager.buildProcessorConfig()` 从数据库构建配置
- 配置包含：
  - 数据库连接字符串（来自 Manager）
  - 链配置（来自数据库）
  - 代币配置（来自数据库）
  - 业务规则（来自 config_values）
  - Monitor 配置（RPC 密钥和监控的链）

### Step 4: 创建和初始化 Processor

- 使用 Manager 提供的配置创建 Processor
- 检查 Processor 数据库 schema
- 如果需要，初始化缺失的表
- 启动 Processor
- 初始化地址池

### Step 5: 执行订单支付场景

- 创建测试订单（0.05 USDC）
- 验证订单状态为 `pending`
- 获取支付地址

### Step 6: 发送真实区块链交易

- 使用测试工具发送真实 USDC 转账
- **自动使用配置的 MNEMONIC 环境变量**
- 发送到订单的支付地址

### Step 7: 等待订单完成

- 等待 Monitor 检测到转账
- 等待区块确认
- 等待订单状态变为 `completed`
- 验证转账记录

## 配置文件

### manager-test.yaml

位于 `packages/manager/config/manager-test.yaml`

主要配置：
- Monitor 监控的链：`ethereum-sepolia`, `polygon-amoy`
- 订单支付窗口：10 分钟
- 订单宽限期：5 分钟
- 延迟确认检查间隔：1 秒
- 地址冷却时间：30 分钟

## 数据库初始化

Manager 会自动初始化以下内容：

### 表结构（如果缺失）
- `processor_chains` - 链配置
- `processor_tokens` - 代币配置
- `processor_token_chains` - 代币-链映射
- `processor_rpc_providers` - RPC 提供商
- `processor_rpc_chain_configs` - RPC 链配置
- `config_values` - 业务设置
- `config_history` - 业务设置历史
- `processor_configs` - 配置历史（已废弃）
- `processor_config_history` - 配置变更历史

### 配置默认值（如果表为空）

从 `Processor.getDefaults()` 加载：
- 链配置（ethereum-sepolia, polygon-amoy, tron-nile 等）
- 代币配置（USDC）
- 代币-链合约地址映射

### 业务设置默认值（始终检查）

config_values 表：
- `orders.payment_window_minutes` = 10
- `orders.grace_period_minutes` = 5
- `orders.max_total_timeout_minutes` = 60
- `deposits.pool_management.cooldown_minutes` = 30
- `deposits.pool_management.low_threshold` = 100

**注意**: 即使表已存在，Manager 也会检查并填充缺失的默认业务设置。

## 测试环境变量

以下环境变量由测试工具自动配置（无需手动设置）：

```typescript
// 测试助记词 - 在 IntegrationTestUtils 中硬编码
// 仅包含测试网资金，安全提交到代码库
const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate';
```

**工作原理**：
- `IntegrationTestUtils.getPaymentSender()` 在第一次调用时自动设置 `process.env.MNEMONIC`
- `MultiChainAddressGenerator` 直接使用硬编码的 `TEST_MNEMONIC`
- 无需配置 `.env` 文件或设置环境变量，测试即可运行

## 预期输出

测试成功时会看到：

```
🚀 Starting Manager + Processor Integration Test
================================================================================

📋 Step 1: Create and Initialize Manager
--------------------------------------------------------------------------------
🔍 Checking database schema...
✅ Database schema is complete. All tables exist.
⚙️  Checking business settings...
✅ Initialized 5 default system settings
✅ Manager initialization completed successfully!

📋 Step 2: Read Configuration from Database
--------------------------------------------------------------------------------
✅ Enabled chains: 6
   - ethereum-sepolia (Ethereum Sepolia Testnet)
   - polygon-amoy (Polygon Amoy Testnet)
   ...
✅ Configured tokens: 1
   - USDC (USD Coin)
✅ System settings: 5
   - orders.payment_window_minutes = 10
   ...

📋 Step 3: Build Processor Config from Manager
--------------------------------------------------------------------------------
✅ Processor config built from Manager
   Database connection: ✓
   Chains configured: 6
   Tokens configured: 1

📋 Step 4: Create and Initialize Processor
--------------------------------------------------------------------------------
✅ Processor created from Manager config
✅ Processor started successfully
✅ Added 9 addresses to pool

📋 Step 5: Execute Order Payment Business Scenario
--------------------------------------------------------------------------------
✅ Order created: [order-id], Payment Address: [address]

📋 Step 6: Send Real Blockchain Transaction
--------------------------------------------------------------------------------
💸 Sending payment: 0.050000 USDC to [address] on ethereum-sepolia
✅ Payment transaction sent

📋 Step 7: Wait for Order Completion
--------------------------------------------------------------------------------
✅ Order status confirmed: completed
🎉 Order payment flow completed successfully!
✅ Transfers detected: 1
================================================================================
```

## 超时时间

测试总超时：5 分钟（300000ms）

包括：
- Manager 初始化：~5 秒
- Processor 启动：~20 秒
- 订单创建：~1 秒
- 交易发送：~10 秒
- 交易确认等待：最多 3 分钟

## 故障排查

### 数据库连接失败

检查 Supabase 数据库是否可访问：
```bash
psql "postgresql://postgres:postgres@localhost:5432/payin_test"
```

### RPC 调用失败

检查 RPC 密钥是否有效：
- Alchemy Key
- Infura Key

### 交易发送失败

检查：
- MNEMONIC 是否正确设置
- 测试账户是否有足够的 ETH（gas）
- 测试账户是否有 USDC

### 订单超时

如果订单长时间未完成，检查：
- Monitor 是否正常运行
- 区块链网络是否拥堵
- 交易是否成功上链（在区块浏览器查看）
