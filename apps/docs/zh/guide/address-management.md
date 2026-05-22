# 地址管理

PayIn 地址池系统中管理区块链地址的综合指南。

## 概述

PayIn 的**地址池**是一个复杂的地址管理系统，可以预生成并动态分配区块链地址用于支付处理。这种方法实现了：

- **即时地址分配**：无需按需生成地址
- **地址可重用性**：通过冷却保护实现高效回收
- **多链支持**：统一管理 EVM、Tron 和 Solana
- **安全性**：正确的密钥管理和地址隔离
- **可扩展性**：处理大量支付操作

::: tip 为什么需要地址池？
传统支付系统按需生成地址，会造成延迟。PayIn 的地址池预先生成地址，实现即时支付地址分配，提升用户体验。
:::

## 地址池概念

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                      地址池系统                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  分配    ┌──────────────┐               │
│  │  可用地址    │  ────────→  │  已分配      │             │
│  │              │             │  (订单)      │             │
│  │              │             │              │             │
│  │  1000 地址   │  ←────────  │  50 地址     │             │
│  └──────────────┘   释放     └──────────────┘             │
│        ↑                                                    │
│        │                                                    │
│        │ 冷却后                                             │
│        │                                                    │
│  ┌──────────────┐             ┌──────────────┐             │
│  │  冷却中      │             │    已绑定    │             │
│  │  (30分钟)    │             │  (充值)      │             │
│  │              │             │              │             │
│  │  100 地址    │             │  200 地址    │             │
│  └──────────────┘             └──────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**核心概念**：

1. **预生成**：地址在需要之前批量生成
2. **动态分配**：从池中按需分配地址
3. **状态管理**：地址通过定义的状态转换
4. **自动回收**：订单地址在完成后返回池中
5. **冷却保护**：防止立即重用，保护隐私和安全

### 地址状态

PayIn 通过四种状态管理地址：

| 状态 | 描述 | 用途 | 返回池中 |
|-------|-------------|----------|----------------|
| **available（可用）** | 准备分配 | 在池中等待 | 不适用 |
| **allocated（已分配）** | 临时分配 | 活跃订单 | 是（完成后） |
| **bound（已绑定）** | 永久分配 | 用户充值 | 可选（手动解绑） |
| **cooldown（冷却中）** | 最近释放 | 临时保留 | 是（30分钟后） |

::: details 状态转换图

```
               分配                  完成/过期
  available  ─────────→  allocated  ──────────────→  cooldown
      ↑                                                   │
      │                                                   │
      └───────────────── 30分钟后 ─────────────────────────┘

               绑定                      解绑
  available  ─────────→   bound    ─────────────→  cooldown
      ↑                                                   │
      │                                                   │
      └───────────────── 30分钟后 ─────────────────────────┘
```

:::

### 为什么冷却很重要

**冷却期**（默认：30分钟）提供：

1. **隐私保护**：防止立即将不同订单链接到同一地址
2. **结算窗口**：为区块链最终确认留出时间
3. **用户信心**：避免地址重用造成的混淆
4. **监控清理**：确保监控任务正确完成

::: tip 可配置的冷却期
冷却期可以通过 `address_pool.cooldown_minutes` 配置参数按 Open 商户/业务范围调整。
:::

## 地址管理模式

PayIn 支持两种地址管理方式，以适应不同的安全模型和操作偏好。

### 对比表

| 功能 | HD 钱包模式 | 自管理模式 |
|---------|---------------|-------------------|
| **密钥管理** | 用户控制助记词 | 用户控制私钥 |
| **地址生成** | PayIn CLI 工具 | 用户自己的工具 |
| **可追溯性** | 完整（派生索引） | 有限 |
| **备份** | 单个助记词 | 每个密钥分别备份 |
| **工具** | PayIn 提供工具 | 用户提供工具 |
| **推荐用于** | 大多数用户 | 高级用户 |
| **安全责任** | 用户（助记词） | 用户（所有密钥） |

::: tip 推荐
我们强烈推荐大多数用例使用 **HD 钱包模式**。它提供更好的可追溯性、更简单的备份和 PayIn 的完整工具支持。
:::

### HD 钱包模式（推荐）

**HD 钱包模式**使用 BIP44 分层确定性钱包标准从单个主种子（助记词）派生地址。

**优势**：
- ✅ **单一备份**：一个 12/24 词助记词备份无限地址
- ✅ **确定性**：可以使用助记词 + 派生索引重新生成任何地址
- ✅ **完全可追溯**：跟踪哪些地址属于您的钱包
- ✅ **PayIn 工具**：完整的 CLI 工具支持生成和验证
- ✅ **基于标准**：使用行业标准 BIP44 路径

**工作原理**：

1. 生成 BIP39 助记词（12 或 24 个单词）
2. 使用 PayIn 地址工具从助记词派生地址
3. 导出地址到 CSV（包括派生索引）
4. 通过操作员 API/CLI 或您自建的自托管控制台将 CSV 导入 PayIn
5. PayIn 从池中分配地址

**派生路径**：

```
EVM 链:    m/44'/60'/0'/0/{index}   (Ethereum, Polygon 等)
Tron 链:   m/44'/195'/0'/0/{index}
Solana 链: m/44'/501'/{index}'/0'   (强化派生)
```

::: warning Solana 限制
Solana 使用带强化派生的 Ed25519 加密（SLIP-0010），这意味着：
- ❌ 无法从主公钥派生子地址
- ✅ 地址生成需要完整助记词
- ✅ 地址仍通过派生索引跟踪
- ✅ 完全兼容 PayIn 的地址池

这是 Ed25519 的基本加密属性，不是 PayIn 的限制。
:::

### 自管理模式

**自管理模式**允许您导入由自己的工具或钱包生成的地址。

**优势**：
- ✅ **完全控制**：使用您喜欢的钱包软件
- ✅ **灵活性**：从任何来源导入地址
- ✅ **自定义工作流**：与现有密钥管理集成
- ✅ **无派生**：不绑定到任何特定派生方案

**注意事项**：
- ⚠️ **手动备份**：必须分别备份每个地址/密钥
- ⚠️ **有限可追溯性**：PayIn 不知道地址关系
- ⚠️ **您的责任**：必须确保地址有效且安全

**工作原理**：

1. 使用钱包软件生成地址
2. 导出为 CSV 格式
3. 通过操作员 API/CLI 或您自建的自托管控制台将 CSV 导入 PayIn
4. PayIn 从池中分配地址

**CSV 格式**：

```csv
address,protocol,derivation_index,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,evm,,
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,tron,,
```

::: tip 可选字段
对于自管理地址，`derivation_index` 和 `master_public_key` 是可选的。如果不适用，请留空。
:::

## HD 钱包地址生成

本节介绍使用 PayIn 官方工具在 HD 钱包模式下生成地址的完整工作流程。

### 前提条件

1. **安全环境**：使用离线计算机或气隙系统以获得最大安全性
2. **Node.js**：18 或更高版本
3. **PayIn 地址工具**：官方 CLI 工具
4. **安全存储**：助记词备份的物理位置（保险箱、金库等）

### 步骤 1：安装地址工具

```bash
# 导航到 PayIn 仓库
cd payin/apps/address-tool

# 安装依赖
npm install

# 构建工具
npm run build
```

::: tip 全局安装
为了更方便访问，您可以全局安装：
```bash
npm install -g @payin/address-tool
```
然后运行：`payin-address-tool`
:::

### 步骤 2：生成助记词

启动工具并选择生成新助记词：

```bash
npm start
```

**交互流程**：

```
? Select an action: Generate New Addresses
? Select protocol: EVM (Ethereum, Polygon, etc.)
? Do you have an existing mnemonic? No, generate new mnemonic

🔐 Your Mnemonic Phrase (WRITE THIS DOWN IMMEDIATELY!):

    witch collapse practice feed shame open despair creek road again ice least

⚠️  WARNING:
   - Write down this mnemonic on paper
   - Store it in a secure, offline location
   - Anyone with this phrase can access your funds
   - This tool does NOT save it for you

? Have you written down the mnemonic? (yes/no): yes
```

**安全检查清单**：
- ✅ 在纸上写下助记词（而非数字方式）
- ✅ 仔细检查每个单词是否正确
- ✅ 存储在安全位置（保险箱、银行保险箱）
- ✅ 考虑在不同位置创建多个备份
- ❌ 永远不要保存到计算机、手机或云存储
- ❌ 永远不要拍摄助记词的照片
- ❌ 永远不要与任何人分享

### 步骤 3：生成地址

配置地址生成参数：

```
? Starting derivation index: 0
? How many addresses to generate: 1000

Generating addresses...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% | 1000/1000

✅ Generated 1000 addresses successfully!

Protocol: evm
Derivation Path: m/44'/60'/0'/0/{index}
Range: 0 - 999
```

**生成提示**：

- **批量大小**：每批生成 1000-5000 个地址
- **起始索引**：第一批使用 0，然后 1000、2000 等
- **多协议**：分别为 EVM、Tron 和 Solana 生成

### 步骤 4：导出到 CSV

```
? Export to CSV? Yes
? Output file name: evm-addresses-2025-01-20

Exporting to CSV...
✅ Exported to: output/evm-addresses-2025-01-20-full.csv

CSV Format: Full (HD Wallet Mode)
Columns: address, derivation_index, protocol, master_public_key
Rows: 1000
```

**CSV 内容示例**：

```csv
address,derivation_index,protocol,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,0,evm,xpub6CUGRUonZSQ4TWUJKy...
0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE,1,evm,xpub6CUGRUonZSQ4TWUJKy...
0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B,2,evm,xpub6CUGRUonZSQ4TWUJKy...
```

::: warning CSV 文件安全
CSV 文件包含您的**扩展公钥（xpub）**，任何人都可以用它来：
- 查看您的所有地址
- 跟踪您的支付历史
- 派生未来地址（仅 EVM/Tron）

**不要**：
- 公开分享 CSV 文件
- 上传到不受信任的系统
- 提交到版本控制

**安全存储 CSV 文件**，仅上传到受信任的 PayIn 实例。
:::

### 步骤 5：验证地址（可选）

验证地址是否属于您的钱包：

```bash
npm start
```

```
? Select an action: Verify Address Ownership
? Select protocol: EVM
? Do you have an existing mnemonic? Yes, use existing

? Enter your mnemonic phrase: [输入您的 12/24 个单词]

? Enter address to verify: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
? Search range (max derivation index): 1000

Searching for address...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%

✅ ADDRESS FOUND!

Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Derivation Index: 0
Derivation Path: m/44'/60'/0'/0/0
```

**验证用例**：
- 确认地址属于您的钱包
- 查找已知地址的派生索引
- 审计导入的地址
- 恢复地址信息

## 将地址导入 PayIn

生成地址后，通过操作员 API/CLI 将其导入 PayIn 的地址池，或通过您基于这些 API 自建的自托管控制台导入。

### 通过操作员 API/CLI 导入（推荐）

PayIn Open 不随附 `apps/admin` 控制台。请直接使用地址池导入 API/CLI，或将相同操作接入您自建的自托管控制台。

**分步指南**：

1. **以操作员身份认证**
   - 使用当前部署的 operator API key 或 CLI 凭据
   - 将 CLI 或脚本指向您的 PayIn Open API 地址

2. **准备导入请求**
   - 在请求或 CLI 参数中选择目标 Open 商户/业务范围和协议
   - 不要把协议选择写入 CSV 文件

3. **选择导入模式**
   - 如果 CSV 包含 `derivation_index` 和 `master_public_key`，使用 **HD Wallet Import**
   - 对于来自外部钱包的地址，使用 **Self-Managed Import**

4. **提交 CSV 内容**
   - 将导出的 CSV 发送到地址池导入端点或 CLI 命令
   - 等待验证完成

5. **查看结果**
   ```
   Import Summary:
   - Protocol: EVM
   - Total Addresses: 1000
   - Derivation Range: 0 - 999
   - Master Public Key: xpub6CUG...

   ✓ All addresses are valid
   ✓ No duplicates found
   ✓ Format validation passed
   ```

6. **确认导入完成**
   - 如果工作流返回导入任务/结果 ID，请保存它
   - 确认已导入数量和重复跳过数量

::: tip 重复处理
PayIn 在导入期间自动跳过重复地址。如果地址已存在于池中，则不会再次导入。
:::

### 通过 API 导入

对于自动化或编程导入，使用地址池 API。

**端点**：`POST /api/v1/address-pool/import`

**认证**：需要当前部署的 operator API key 或 CLI 凭据

**请求**：

```typescript
import fs from 'fs';

const csvContent = fs.readFileSync('evm-addresses-2025-01-20-full.csv', 'utf8');

const response = await fetch('https://your-payin.example.com/api/v1/address-pool/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  },
  body: JSON.stringify({
    protocol: 'evm',
    mode: 'hd_wallet', // or 'self_managed'
    addresses: csvContent
  })
});

const result = await response.json();
console.log('Import result:', result);
```

**响应**：

```json
{
  "success": true,
  "imported": 1000,
  "skipped": 0,
  "errors": [],
  "summary": {
    "protocol": "evm",
    "mode": "hd_wallet",
    "derivation_range": {
      "start": 0,
      "end": 999
    },
    "master_public_key": "xpub6CUGRUonZSQ4TWUJKy..."
  }
}
```

**错误响应**（400 Bad Request）：

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "line": 42,
      "address": "0xinvalid",
      "error": "Invalid EVM address format"
    }
  ]
}
```

**Python 示例**：

```python
import requests

with open('evm-addresses-2025-01-20-full.csv', 'r') as f:
    csv_content = f.read()

response = requests.post(
    'https://your-payin.example.com/api/v1/address-pool/import',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {os.getenv("PAYIN_API_KEY")}'
    },
    json={
        'protocol': 'evm',
        'mode': 'hd_wallet',
        'addresses': csv_content
    }
)

result = response.json()
print(f"Imported: {result['imported']} addresses")
```

### 批量导入策略

对于大型地址池（10,000+ 地址），使用批量导入：

**策略**：

1. **分批生成**：创建每个包含 1000-5000 个地址的 CSV 文件
2. **顺序导入**：按顺序导入批次以避免超时
3. **每批后验证**：每批后检查池统计信息
4. **跟踪进度**：维护已导入批次的日志

**批量工作流示例**：

```bash
# 批次 1：地址 0-999
npm start
# 生成：start=0, count=1000
# 导出：evm-batch-1.csv

# 批次 2：地址 1000-1999
npm start
# 生成：start=1000, count=1000
# 导出：evm-batch-2.csv

# 批次 3：地址 2000-2999
npm start
# 生成：start=2000, count=1000
# 导出：evm-batch-3.csv

# 通过操作员 API/CLI 导入每个批次
```

## 地址生命周期管理

了解地址如何在不同状态之间移动，有助于您有效管理池。

### 订单支付生命周期

**场景**：用户创建订单支付 100 USDT

```
步骤 1：订单创建
─────────────────────────────────────────────────────────────
POST /api/v1/orders
{
  "orderReference": "ORDER-2025-001",
  "amount": "100",
  "currency": "USDT",
  "chainId": "ethereum-sepolia"
}

↓ PayIn 从池中分配地址

Response:
{
  "orderId": "ord_abc123",
  "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending"
}

地址状态：available → allocated
```

```
步骤 2：用户支付
─────────────────────────────────────────────────────────────
用户发送 100 USDT 到 0x742d35...

↓ PayIn 监控检测到交易
↓ 等待确认（默认：3 个区块）
↓ 订单完成

Webhook 事件：order.completed

地址状态：allocated（仍然保留）
```

```
步骤 3：地址释放
─────────────────────────────────────────────────────────────
订单完成后，PayIn 自动：
1. 从订单释放地址
2. 设置冷却期（30 分钟）
3. 地址进入冷却状态

地址状态：allocated → cooldown
```

```
步骤 4：返回池中
─────────────────────────────────────────────────────────────
冷却期过期后（30 分钟）：
- 地址再次变为可用
- 可以分配给新订单
- 按 LRU（最近最少使用）优先

地址状态：cooldown → available
```

**时间线**：

```
订单创建 ────→ 支付发送 ────→ 订单完成 ────→ 冷却过期
     ↓                    ↓                    ↓                     ↓
  allocated          allocated             cooldown              available
     0s               ~3 分钟              ~3 分 30 秒           ~33 分 30 秒
```

### 充值地址生命周期

**场景**：用户想要永久充值地址

```
步骤 1：地址绑定
─────────────────────────────────────────────────────────────
POST /api/v1/deposits/references
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "polygon-amoy"
}

↓ PayIn 分配并绑定地址

Response:
{
  "depositReference": "user_alice_123",
  "address": "0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B",
  "protocol": "evm"
}

地址状态：available → bound
```

```
步骤 2：多次充值
─────────────────────────────────────────────────────────────
用户可以多次向同一地址充值：

充值 1：50 USDT  → 创建充值记录
充值 2：100 USDT → 创建另一个充值记录
充值 3：25 USDT  → 创建另一个充值记录

每次充值：
- 触发 webhook：deposit.completed（达到确认数后）
- 记录金额和交易
- 地址保持绑定

地址状态：bound（永久）
```

```
步骤 3：地址解绑（可选）
─────────────────────────────────────────────────────────────
如果用户关闭账户或停止使用服务：

DELETE /api/v1/deposits/references/user_alice_123

↓ PayIn 解绑地址
↓ 设置冷却期（30 分钟）

地址状态：bound → cooldown → available
```

**时间线**：

```
绑定 ────→ 充值 1 ────→ 充值 2 ────→ ... ────→ 解绑 ────→ 冷却 ────→ 可用
   ↓             ↓                ↓                           ↓            ↓              ↓
 bound         bound            bound                     cooldown      cooldown      available
   0s           小时             天                         ~0s         ~30 分钟       ~30 分钟
```

### LRU 分配策略

PayIn 使用**最近最少使用（LRU）**算法高效分配地址。

**分配优先级**：

```sql
-- 1. 新地址（从未使用）
WHERE recycled_at IS NULL
ORDER BY created_at ASC

-- 2. 回收地址（之前使用过，已冷却）
WHERE recycled_at IS NOT NULL
  AND cooldown_until <= NOW()
ORDER BY recycled_at ASC
```

**为什么使用 LRU？**

1. **公平性**：所有地址随时间获得平等使用
2. **隐私**：最大化重用之间的时间
3. **分布**：防止热门地址
4. **监控**：确保旧监控任务清理

**分配序列示例**：

```
池状态：
- 地址 A：recycled_at = NULL（新）
- 地址 B：recycled_at = 2025-01-20 10:00（2 小时前使用）
- 地址 C：recycled_at = 2025-01-20 11:30（30 分钟前使用）
- 地址 D：recycled_at = NULL（新）

分配顺序：
1. 地址 A（新地址，最先创建）
2. 地址 D（新地址，第二个创建）
3. 地址 B（回收，最旧）
4. 地址 C（回收，最新）
```

## 地址池监控

监控您的地址池健康状况，确保顺畅的支付操作。

### 池状态 API

获取实时池统计信息：

**端点**：`GET /api/v1/address-pool/status`

**请求**：

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/address-pool/status', {
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  }
});

const status = await response.json();
console.log('Pool Status:', status);
```

**响应**：

```json
{
  "evm": {
    "total": 5000,
    "available": 4200,
    "allocated": 500,
    "bound": 250,
    "coolingDown": 50
  },
  "tron": {
    "total": 2000,
    "available": 1800,
    "allocated": 150,
    "bound": 40,
    "coolingDown": 10
  },
  "solana": {
    "total": 1000,
    "available": 950,
    "allocated": 30,
    "bound": 15,
    "coolingDown": 5
  }
}
```

### 池监控

通过操作员 API/CLI、指标系统或您为操作员自建的控制台监控地址池：

1. **查询地址池统计**
   - 获取实时统计信息
   - 将分配数据接入您的观测系统或控制台

2. **池健康指标**
   ```
   EVM 地址池                              ● 健康
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   总计：        5,000 地址
   可用：        4,200 (84%)  ▓▓▓▓▓▓▓▓░░
   已分配：        500 (10%)  ▓▓░░░░░░░░
   已绑定：        250 ( 5%)  ▓░░░░░░░░░
   冷却中：         50 ( 1%)  ░░░░░░░░░░
   ```

3. **库存不足警告**
   ```
   ⚠️ 警告：地址库存不足

   EVM 池仅有 120 个可用地址（2.4%）

   建议操作：
   1. 立即生成更多地址
   2. 将新批次导入池中
   3. 检查地址分配率
   ```

### 监控指标

**要跟踪的关键指标**：

| 指标 | 描述 | 健康范围 | 操作阈值 |
|--------|-------------|---------------|-----------------|
| **可用 %** | 可用地址的百分比 | > 50% | < 20% |
| **分配率** | 每小时分配的地址数 | 不定 | 急剧上升趋势 |
| **冷却 %** | 冷却中的百分比 | < 5% | > 10% |
| **绑定增长** | 充值绑定率 | 不定 | 意外峰值 |

### 库存不足警报

配置警报，在池库存不足时通知您。

**操作员配置**：

1. **配置地址池设置**
2. **设置警报阈值**：
   ```
   库存不足警报：
   ┌─────────────────────────────────┐
   │ EVM:    [200] 地址              │
   │ Tron:   [100] 地址              │
   │ Solana: [50]  地址              │
   └─────────────────────────────────┘

   通知方式：
   ☑ 邮件
   ☑ Webhook
   ☐ 短信
   ```

3. **测试警报**：
   - 点击 "Send Test Alert"
   - 验证您收到通知

**邮件警报示例**：

```
主题：[PayIn 警报] 地址池库存不足

亲爱的 PayIn 用户，

您的 EVM 地址池库存不足：

当前状态：
- 可用：180 地址（3.6%）
- 总池：5,000 地址
- 阈值：200 地址（4%）

建议操作：
1. 使用 PayIn 地址工具生成 1,000+ 个新地址
2. 通过操作员 API/CLI 导入地址
3. 检查分配模式

查看详情：https://your-payin.example.com/address-pool

—
PayIn 警报系统
```

**Webhook 警报负载**：

```json
{
  "type": "alert.address_pool_low",
  "timestamp": "2025-01-20T15:30:00Z",
  "data": {
    "protocol": "evm",
    "available": 180,
    "total": 5000,
    "percentage": 3.6,
    "threshold": 200
  }
}
```

### 主动池管理

**最佳实践**：

1. **每日监控**：至少每天检查一次池状态
2. **维持缓冲**：保持 50%+ 可用地址
3. **批量生成**：每批生成 1000+ 地址
4. **预测性扩展**：监控分配趋势，主动添加地址
5. **协议平衡**：确保每个协议都有足够的地址

**监控脚本示例**：

```typescript
// check-pool-health.ts
import { PayInClient } from '@payin/sdk';

const client = new PayInClient({
  apiKey: process.env.PAYIN_API_KEY,
  baseUrl: 'https://your-payin.example.com'
});

async function checkPoolHealth() {
  const status = await client.addressPool.getStatus();

  for (const [protocol, stats] of Object.entries(status)) {
    const availablePercent = (stats.available / stats.total) * 100;

    if (availablePercent < 20) {
      console.error(`❌ 严重：${protocol} 池在 ${availablePercent.toFixed(1)}%`);
      // 发送警报
    } else if (availablePercent < 50) {
      console.warn(`⚠️  警告：${protocol} 池在 ${availablePercent.toFixed(1)}%`);
      // 考虑生成更多
    } else {
      console.log(`✅ 正常：${protocol} 池在 ${availablePercent.toFixed(1)}%`);
    }
  }
}

// 每小时运行一次
setInterval(checkPoolHealth, 60 * 60 * 1000);
checkPoolHealth();
```

**Cron 作业设置**：

```bash
# 添加到 crontab（每 4 小时运行一次）
0 */4 * * * cd /path/to/scripts && node check-pool-health.js
```

## 自管理地址导入

对于希望在 HD 钱包系统之外管理自己的密钥和地址的用户。

### 准备自管理地址

**步骤 1：生成地址**

使用您喜欢的钱包软件：

```bash
# 使用 ethers.js（EVM）
import { Wallet } from 'ethers';

const addresses = [];
for (let i = 0; i < 1000; i++) {
  const wallet = Wallet.createRandom();
  addresses.push({
    address: wallet.address,
    privateKey: wallet.privateKey // 安全存储，不要包含在 CSV 中！
  });
}

# 安全保存私钥（加密文件、硬件钱包等）
# 仅将地址导出到 CSV
```

```bash
# 使用 TronWeb（Tron）
import TronWeb from 'tronweb';

const addresses = [];
for (let i = 0; i < 1000; i++) {
  const account = await TronWeb.createAccount();
  addresses.push({
    address: account.address.base58,
    privateKey: account.privateKey // 安全存储！
  });
}
```

**步骤 2：创建 CSV 文件**

自管理地址的格式：

```csv
address,protocol,derivation_index,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,evm,,
0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE,evm,,
0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B,evm,,
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,tron,,
TPJRnELdwXLWVvokPJyT3CHPF4YPKVkrSU,tron,,
```

**关键点**：
- 将 `derivation_index` 和 `master_public_key` 留空
- 仅包含公共地址（永远不要包含私钥！）
- 每行一个地址
- 协议必须是 `evm`、`tron` 或 `solana`

**步骤 3：验证地址**

导入前，在本地验证地址：

```typescript
// validate-addresses.ts
import { isAddress } from 'ethers';
import fs from 'fs';
import csv from 'csv-parse/sync';

const content = fs.readFileSync('self-managed-addresses.csv', 'utf8');
const records = csv.parse(content, { columns: true });

let errors = 0;
for (const [index, record] of records.entries()) {
  if (record.protocol === 'evm' && !isAddress(record.address)) {
    console.error(`行 ${index + 2}：无效的 EVM 地址：${record.address}`);
    errors++;
  }
  // 为 Tron 和 Solana 地址添加验证
}

if (errors === 0) {
  console.log('✅ 所有地址均有效');
} else {
  console.error(`❌ 发现 ${errors} 个无效地址`);
  process.exit(1);
}
```

### 导入流程

**通过操作员 API/CLI**：

1. 调用地址池导入端点或 CLI 命令
2. 将导入模式设为 **"Self-Managed Import"**
3. 上传 CSV 文件
4. 审查导入摘要
5. 确认导入

**通过 API**：

```typescript
const csvContent = fs.readFileSync('self-managed-addresses.csv', 'utf8');

const response = await fetch('https://your-payin.example.com/api/v1/address-pool/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  },
  body: JSON.stringify({
    protocol: 'evm',
    mode: 'self_managed',
    addresses: csvContent
  })
});

const result = await response.json();
console.log(`导入了 ${result.imported} 个自管理地址`);
```

### 安全注意事项

**自管理模式责任**：

1. **私钥管理**
   - 安全存储私钥（硬件钱包、加密存储）
   - 永远不要在 CSV 导入中包含私钥
   - 实施密钥轮换策略
   - 在多个安全位置备份密钥

2. **地址跟踪**
   - 维护您自己的地址到密钥的映射
   - 记录地址生成方法
   - 跟踪哪些地址已导入 PayIn

3. **恢复规划**
   - 记录密钥恢复程序
   - 定期测试恢复流程
   - 确保继任者在需要时可以访问密钥

::: danger 关键：私钥安全
PayIn 永远不会要求或存储您的私钥。如果有人声称来自 PayIn 并要求您的私钥，那是诈骗。仅将公共地址导入 PayIn。
:::

## 最佳实践

### HD 钱包模式

**安全最佳实践**：

1. **助记词存储**
   - ✅ 写在纸上，存放在保险箱/金库中
   - ✅ 在不同位置创建多个备份
   - ✅ 使用金属备份板以防火/水
   - ✅ 企业考虑 Shamir 秘密共享
   - ❌ 永远不要数字存储（计算机、手机、云）
   - ❌ 永远不要拍照
   - ❌ 永远不要与任何人分享

2. **生成环境**
   - ✅ 使用离线/气隙计算机生成
   - ✅ 验证工具完整性（校验和、签名）
   - ✅ 生成期间断开网络
   - ❌ 不要在共享/公共计算机上生成

3. **验证**
   - ✅ 导入后验证前几个地址
   - ✅ 在生产使用前测试小额支付
   - ✅ 记录使用的派生路径

**操作最佳实践**：

4. **批量管理**
   - 分批生成地址（1000-5000）
   - 跟踪派生范围（0-999、1000-1999 等）
   - 用日期记录批量导入
   - 维护批量生成日志

5. **池大小**
   - 维持 50%+ 可用地址
   - 主动生成新批次
   - 监控分配率趋势
   - 在不足之前扩展

6. **可追溯性**
   - 保留所有导入记录（批次文件、日期）
   - 记录主公钥
   - 跟踪派生索引范围
   - 定期审计池

### 自管理模式

**密钥管理**：

1. **私钥安全**
   - 尽可能使用硬件钱包
   - 加密私钥存储
   - 实施访问控制
   - 定期安全审计

2. **地址生成**
   - 使用信誉良好的钱包软件
   - 导入前验证地址格式
   - 检查重复
   - 记录生成方法

3. **备份策略**
   - 多个安全备份
   - 地理分布
   - 定期备份验证
   - 记录恢复程序

**导入最佳实践**：

4. **验证**
   - 导入前验证所有地址
   - 检查格式错误
   - 验证无重复
   - 先测试小批次

5. **文档**
   - 维护地址到密钥的映射
   - 记录导入日期和批次
   - 跟踪哪些地址在 PayIn 中
   - 记录任何地址轮换

### 一般最佳实践

**池管理**：

1. **监控**
   - 每天检查池状态
   - 设置库存不足警报
   - 监控分配模式
   - 跟踪冷却率

2. **维护**
   - 定期池审计
   - 检查地址状态
   - 清理过时绑定
   - 根据需要更新冷却配置

3. **扩展**
   - 监控业务增长
   - 主动扩展
   - 为高峰期做计划
   - 维持足够缓冲

**安全**：

4. **访问控制**
   - 限制谁可以导入地址
   - 使用具有适当权限的 API 密钥
   - 审计导入活动
   - 监控未授权访问尝试

5. **地址隐私**
   - 不要不必要地重用地址
   - 尊重冷却期
   - 考虑解绑未使用的充值地址
   - 定期轮换地址池

**操作**：

6. **测试**
   - 先在测试网上测试地址分配
   - 验证导入流程正确工作
   - 测试池耗尽场景
   - 练习紧急程序

7. **文档**
   - 记录您的地址管理流程
   - 保留导入日志
   - 维护常见任务的运行手册
   - 培训团队成员

## 安全注意事项

### 助记词安全

**关键**：您的助记词是从中生成的所有地址的主密钥。

**威胁模型**：

| 威胁 | 影响 | 缓解措施 |
|--------|--------|------------|
| **物理盗窃** | 攻击者获得完全访问权限 | 多个安全位置、分割存储 |
| **数字暴露** | 恶意软件/黑客访问 | 永远不要数字存储、离线生成 |
| **社会工程** | 被骗透露 | 教育、验证程序 |
| **丢失/销毁** | 永久失去访问权限 | 多个备份、金属板 |

**纵深防御**：

```
第 1 层：离线生成
- 在气隙计算机上生成
- 使用经过验证的开源工具
- 生成期间断开网络

第 2 层：物理安全
- 存放在保险箱/金库中
- 多个地理位置
- 防火/防水容器

第 3 层：访问控制
- 限制知道助记词存储位置的人
- 多人访问要求（企业）
- 定期安全审查

第 4 层：备份策略
- 多个副本
- 不同格式（纸、金属）
- 不同位置
- 定期验证
```

### 地址验证

**导入验证**：

PayIn 在地址导入期间执行全面验证：

1. **格式验证**
   - EVM：校验和地址格式（0x + 40 个十六进制字符）
   - Tron：以 'T' 开头的 Base58 格式
   - Solana：Base58 格式（32-44 个字符）

2. **重复检测**
   - 检查现有池地址
   - 防止重复导入
   - 在 CSV 文件内验证

3. **协议一致性**
   - 确保地址与指定协议匹配
   - 检测格式不匹配
   - 验证派生数据一致性

**黑名单检查**：

::: tip 未来功能
PayIn 计划添加对已知恶意地址的地址黑名单检查支持。这将有助于防止导入受损地址。
:::

目前，实施您自己的黑名单检查：

```typescript
// check-blacklist.ts
import fs from 'fs';
import csv from 'csv-parse/sync';

// 从公共来源加载黑名单
const blacklist = new Set([
  '0x...',  // 已知诈骗地址
  // 添加更多
]);

const addresses = csv.parse(
  fs.readFileSync('addresses.csv', 'utf8'),
  { columns: true }
);

for (const record of addresses) {
  if (blacklist.has(record.address.toLowerCase())) {
    console.error(`❌ 发现黑名单地址：${record.address}`);
    process.exit(1);
  }
}

console.log('✅ 未发现黑名单地址');
```

### 导入验证

导入地址后，验证导入是否成功：

**验证步骤**：

1. **检查池统计信息**
   ```typescript
   const status = await client.addressPool.getStatus();
   console.log(`总 EVM 地址：${status.evm.total}`);
   // 应该匹配预期计数
   ```

2. **抽查地址**
   ```typescript
   // 验证导入中的随机地址存在于池中
   const response = await client.addressPool.listAddresses({
     protocol: 'evm',
     page: 1,
     pageSize: 10
   });

   // 检查 CSV 中的地址是否出现
   ```

3. **测试分配**
   ```typescript
   // 创建测试订单以验证分配有效
   const order = await client.orders.create({
     orderReference: 'TEST-VERIFICATION',
     amount: '1',
     currency: 'USDT',
     chainId: 'ethereum-sepolia'
   });

   // 验证分配的地址来自您导入的集合
   console.log(`分配的地址：${order.paymentAddress}`);
   ```

### 审计日志

PayIn 为地址池操作维护全面的审计日志：

**记录的事件**：

- 地址导入（谁、何时、多少）
- 地址分配（订单/充值）
- 地址释放
- 地址绑定/解绑
- 池配置更改

**访问审计日志**：

```typescript
const logs = await client.addressPool.getAuditLogs({
  startDate: '2025-01-20',
  endDate: '2025-01-21',
  eventType: 'import'
});

for (const log of logs.entries) {
  console.log(`${log.timestamp}：${log.eventType} 由 ${log.user} - ${log.count} 地址`);
}
```

## 故障排除

### 常见问题

#### 1. 导入失败："Invalid address format"

**原因**：地址与协议的预期格式不匹配。

**解决方案**：

```bash
# 验证 EVM 地址
import { isAddress } from 'ethers';
console.log(isAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')); // true

# 确保地址是校验和格式
import { getAddress } from 'ethers';
const checksummed = getAddress('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
console.log(checksummed); // 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
```

#### 2. 导入失败："Duplicate addresses found"

**原因**：地址已存在于池中或在 CSV 中多次出现。

**解决方案**：

```typescript
// 检查 CSV 中的重复
const addresses = records.map(r => r.address.toLowerCase());
const unique = new Set(addresses);
if (addresses.length !== unique.size) {
  console.error('CSV 包含重复地址');
}

// 检查现有池
const existing = await client.addressPool.checkAddresses(addresses);
console.log(`${existing.duplicates.length} 地址已在池中`);
```

#### 3. "No available addresses in pool"

**原因**：所有地址都已分配、绑定或处于冷却中。

**解决方案**：

1. **检查池状态**：
   ```typescript
   const status = await client.addressPool.getStatus();
   console.log(status);
   ```

2. **生成并导入更多地址**（立即修复）

3. **检查分配模式**（长期修复）：
   - 订单是否正确过期？
   - 地址是否正在释放？
   - 冷却期是否太长？
   - 分配率是否高于预期？

#### 4. 地址工具："Invalid mnemonic phrase"

**原因**：助记词有拼写错误、单词数量错误或无效单词。

**解决方案**：

```bash
# 验证助记词单词数（12 或 24）
echo "your mnemonic words here" | wc -w

# 检查单词拼写错误（使用 BIP39 单词列表）

# 常见错误：
# - 单词之间有多余空格
# - 单词顺序错误
# - 单词不在 BIP39 列表中
```

#### 5. 验证："Address not found in wallet"

**原因**：地址不属于助记词，或搜索范围太小。

**解决方案**：

```bash
# 增加搜索范围
? Search range: 5000  # 而不是默认的 1000

# 验证您使用的是正确的：
# - 助记词
# - 协议（EVM vs Tron vs Solana）
# - 派生路径
```

#### 6. 池性能低下

**原因**：冷却中地址过多，频繁的分配/释放周期。

**解决方案**：

1. **增加池大小**：更多地址 = 更好的性能
2. **调整冷却期**：如果您的用例不需要，可以减少
   ```typescript
   await client.config.update({
     'address_pool.cooldown_minutes': 15  // 从 30 减少到 15
   });
   ```
3. **检查分配策略**：您是否创建了太多短期订单？

### 获取帮助

如果您遇到此处未涵盖的问题：

1. **检查 API 日志**：
   - 审查错误响应
   - 检查 HTTP 状态码
   - 查找详细错误消息

2. **操作员诊断**：
   - 通过 API/CLI 查询地址池状态
   - 检查池健康指标
   - 审查最近的活动日志

3. **联系支持**：
   - 邮箱：support@payin.com
   - 包括：池统计信息、错误消息、CSV 样本
   - 指定：协议、导入模式、环境（测试网/主网）

4. **社区**：
   - Discord：[discord.gg/payin](https://discord.gg/payin)

## 后续步骤

现在您了解了地址管理，探索这些相关主题：

### 必读内容

- [订单支付服务](/zh/guide/order-payment) - 了解订单如何使用地址池
- [充值服务](/zh/guide/deposit-service) - 了解充值如何使用绑定地址
- [安全指南](/zh/guide/security) - 助记词和密钥安全最佳实践

### API 参考

- [API 概览](/zh/api/overview) - 可用 API surface，包括地址池端点
- [订单 API](/zh/api/orders) - 订单如何分配地址
- [充值 API](/zh/api/deposits) - 充值如何绑定地址

### 高级主题

- [多链策略](/zh/guide/multi-chain-strategy) - 跨链管理地址
- [高可用性](/zh/guide/high-availability) - 规模化的池管理
- [监控和警报](/zh/guide/monitoring) - 生产监控设置

### 工具

- [地址池设置](/zh/guide/address-pool-setup) - Headless 地址池准备与导入流程
- [CLI 工具](/zh/guide/cli-tools) - 命令行地址管理

## 总结

**关键要点**：

✅ **地址池**实现即时支付地址分配和高效重用

✅ **HD 钱包模式**（推荐）使用 BIP44 标准，提供完整工具支持

✅ **自管理模式**为高级用户提供灵活性

✅ **LRU 分配**确保公平分布和隐私保护

✅ **冷却期**（30 分钟）保护隐私并允许结算

✅ **监控**至关重要 - 维持 50%+ 可用地址

✅ **安全**需要正确的助记词存储和验证

**快速参考**：

| 任务 | 工具/方法 | 所需时间 |
|------|------------|---------------|
| 生成 1000 个地址 | PayIn 地址工具 | ~2 分钟 |
| 导入地址 | 操作员 API/CLI | ~1 分钟 |
| 检查池状态 | 操作员 API/CLI | 即时 |
| 分配地址 | 自动（API 调用） | < 100ms |
| 释放地址 | 自动（订单完成） | < 100ms |

**生产检查清单**：

- [ ] 助记词已生成并安全存储（多个备份）
- [ ] 为所有需要的协议生成地址（EVM、Tron、Solana）
- [ ] 地址已导入 PayIn（通过池状态验证）
- [ ] 已配置库存不足警报
- [ ] 已设置池监控（每日检查或自动化）
- [ ] 团队已培训地址生成流程
- [ ] 已记录紧急程序
- [ ] 已建立备份生成能力

您现在已准备好为 PayIn 支付基础设施高效管理地址！
