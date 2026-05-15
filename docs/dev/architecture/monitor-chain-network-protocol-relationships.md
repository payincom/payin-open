# Monitor 术语关系：Chain、Network、Protocol

## 核心概念关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Protocol (协议)                               │
│              技术协议分类 (最顶层分类)                             │
│                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │     Protocol         │         │     Protocol         │     │
│  │       'evm'          │         │      'tron'          │     │
│  └──────────────────────┘         └──────────────────────┘     │
│           │                                   │                 │
│           ├─────────────┬─────────────┐       │                │
│           ▼             ▼             ▼       ▼                │
└───────────────────────────────────────────────────────────────┘
            │             │             │       │
            │             │             │       │
┌───────────▼─────────────▼─────────────▼───────▼────────────────┐
│                    Chain (链)                                    │
│            具体的区块链网络 (中间层标识)                           │
│                                                                  │
│  ethereum-mainnet  ethereum-sepolia  polygon-mainnet  tron-nile │
│  ────────────────  ────────────────  ──────────────  ────────── │
│   标准链标识符       标准链标识符      标准链标识符    标准链标识符 │
│                                                                  │
│  格式: {protocol}-{network-name}                                │
└──────────────────────────────────────────────────────────────────┘
            │
            │ networkMappings (映射)
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Network (网络)                                  │
│          RPC Provider 特定的网络标识符 (最底层)                    │
│                                                                   │
│  Provider    │  ethereum-mainnet  │  ethereum-sepolia            │
│  ─────────────────────────────────────────────────────────────   │
│  Alchemy     │  eth-mainnet       │  eth-sepolia                 │
│  Infura      │  mainnet           │  sepolia                     │
│  Ankr        │  eth               │  eth_sepolia                 │
│                                                                   │
│  用于构建实际的 RPC URL                                            │
└──────────────────────────────────────────────────────────────────┘
```

## 三个术语的定义

### 1. Protocol (协议)

**定义**: 区块链的技术协议分类

**类型**: `Protocol = 'evm' | 'tron' | 'bitcoin' | 'solana'`

**层级**: 最顶层 - 技术分类

**用途**:
- 选择正确的区块链适配器 (EVMAdapter vs TronAdapter)
- 按技术协议分组链
- 确定技术实现方式

**示例**:
```typescript
const config = getChainConfig('ethereum-sepolia');
config.protocol // 'evm'

const config2 = getChainConfig('tron-nile');
config2.protocol // 'tron'

// 按协议获取所有链
getChainsByProtocol('evm') // ['ethereum-mainnet', 'ethereum-sepolia', 'polygon-mainnet', ...]
```

**特点**:
- ✅ 技术层面的分类
- ✅ 决定使用哪个 Adapter
- ✅ 多个 Chain 可以共享同一个 Protocol

---

### 2. Chain (链) - Chain ID

**定义**: PayIn 系统的标准化链标识符

**类型**: `'ethereum-mainnet' | 'ethereum-sepolia' | 'polygon-mainnet' | ...`

**格式**: `{protocol}-{network-name}`

**层级**: 中间层 - 具体链标识

**用途**:
- 用户配置中的链标识
- 业务逻辑中的链标识
- 数据库中存储的链标识
- Monitor 目标地址的链标识

**示例**:
```typescript
// Chain 配置
const config: ChainConfig = {
  chain: 'ethereum-sepolia',  // ← Chain ID
  name: 'Ethereum Sepolia',
  protocol: 'evm',             // ← Protocol
  chainId: 11155111,
  isTestnet: true,
  nativeToken: 'ETH',
  blockTime: 12,
  safeBlockDistance: 3
}

// 使用 Chain ID 配置监控
monitor.addTarget({
  chain: 'ethereum-sepolia',   // ← 使用标准 Chain ID
  address: '0x123...',
  tokenContract: '0xabc...'
})
```

**特点**:
- ✅ PayIn 系统的标准命名
- ✅ 与具体的 RPC Provider 无关
- ✅ 人类可读且语义明确
- ✅ 包含 protocol 和 network 信息

---

### 3. Network (网络) - Provider-specific Network Name

**定义**: RPC Provider 使用的特定网络标识符

**类型**: 字符串 (每个 Provider 自定义)

**层级**: 最底层 - Provider 特定命名

**用途**:
- 构建 RPC URL
- 填充 Provider URL 模板中的 `{network}` 占位符

**示例**:
```typescript
// ProviderTemplate 定义
{
  urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}",
  supportedNetworks: ["eth-mainnet", "eth-sepolia"],  // ← Network names
  networkMappings: {
    "ethereum-mainnet": "eth-mainnet",  // Chain ID → Network Name
    "ethereum-sepolia": "eth-sepolia"
  }
}

// URL 构建过程
Chain ID: 'ethereum-sepolia'
   ↓ (查找 networkMappings)
Network Name: 'eth-sepolia'
   ↓ (替换 urlPattern 中的 {network})
Final URL: 'https://eth-sepolia.g.alchemy.com/v2/your-api-key'
```

**不同 Provider 的 Network 命名**:
```typescript
// 同一个 Chain: 'ethereum-sepolia'
Alchemy:  'eth-sepolia'     // 有前缀，用连字符
Infura:   'sepolia'          // 无前缀
Ankr:     'eth_sepolia'      // 有前缀，用下划线
```

**特点**:
- ❌ 每个 Provider 命名不统一
- ✅ 通过 networkMappings 自动转换
- ✅ 用户无需关心这些差异

## 三者的层次关系

```
Protocol (协议族)
    ↓ 1 对多
Chain (具体链)
    ↓ 1 对多 (通过 networkMappings)
Network (Provider 特定名称)
```

### 关系说明

1. **Protocol → Chain**: 一对多
   - 一个 Protocol 包含多个 Chain
   - 例如：`evm` 包含 `ethereum-mainnet`, `ethereum-sepolia`, `polygon-mainnet`, `base-mainnet`

2. **Chain → Network**: 一对多
   - 一个 Chain 对应多个 Network (每个 Provider 一个)
   - 例如：`ethereum-sepolia` 对应:
     - Alchemy: `eth-sepolia`
     - Infura: `sepolia`
     - Ankr: `eth_sepolia`

## 使用场景对比

| 场景 | 使用术语 | 示例 |
|-----|---------|------|
| 用户配置 Monitor | Chain | `chains: ['ethereum-sepolia', 'polygon-amoy']` |
| 用户配置 RPC | Chain | `ethereum-sepolia: { strategy: 'round_robin' }` |
| 数据库存储 | Chain | `INSERT INTO targets (chain, ...) VALUES ('ethereum-sepolia', ...)` |
| 业务逻辑判断 | Chain | `if (chain === 'ethereum-sepolia') { ... }` |
| 选择适配器 | Protocol | `AdapterFactory.registerAdapter('evm', EVMAdapter)` |
| 按协议分组 | Protocol | `getChainsByProtocol('evm')` |
| 构建 RPC URL | Network | `https://{network}.alchemy.com/v2/{key}` |
| Provider 内部 | Network | `supportedNetworks: ['eth-sepolia']` |

## 实际代码流程

### 用户配置 → RPC URL 的完整流程

```typescript
// 1. 用户配置 (使用 Chain ID)
const config = {
  chains: {
    'ethereum-sepolia': {          // ← Chain ID (用户层面)
      strategy: 'round_robin',
      availableProviders: ['alchemy', 'infura']
    }
  }
}

// 2. 系统内部处理
const chainConfig = getChainConfig('ethereum-sepolia');
chainConfig.protocol // 'evm'      // ← Protocol (选择适配器)

// 3. RPC 配置加载
const alchemyProvider = BUILTIN_PROVIDERS.alchemy;
alchemyProvider.networkMappings['ethereum-sepolia'] // 'eth-sepolia' ← Network

// 4. URL 构建
const networkName = 'eth-sepolia';  // ← Network (Provider 特定)
const url = `https://${networkName}.g.alchemy.com/v2/${apiKey}`;
// 最终: https://eth-sepolia.g.alchemy.com/v2/your-key
```

## 命名映射机制

### networkMappings 的作用

```typescript
// Provider 定义
{
  name: 'alchemy',
  urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}",
  supportedNetworks: ["eth-mainnet", "eth-sepolia"],     // ← Provider 原生网络名
  networkMappings: {
    "ethereum-mainnet": "eth-mainnet",  // Chain ID → Network Name
    "ethereum-sepolia": "eth-sepolia"
  }
}

// Config Loader 自动处理
const supportedChains = [
  ...supportedNetworks,                // ['eth-mainnet', 'eth-sepolia']
  ...Object.keys(networkMappings)      // ['ethereum-mainnet', 'ethereum-sepolia']
]
// 结果：同时支持 Chain ID 和 Network Name
```

### 为什么需要映射？

1. **统一用户体验**: 用户只需要知道标准 Chain ID
2. **Provider 独立性**: 每个 Provider 可以使用自己的命名
3. **自动转换**: 系统自动处理 Chain ID → Network Name 映射

## 总结

| 术语 | 层级 | 类型定义 | 示例 | 谁使用 |
|-----|------|---------|------|--------|
| **Protocol** | 顶层 | `Protocol = 'evm' \| 'tron' \| 'bitcoin' \| 'solana'` | `'evm'`, `'tron'` | Adapter Factory, 技术分组 |
| **Chain** | 中层 | `Chain = 'ethereum-sepolia' \| ...` | `'ethereum-sepolia'` | 用户配置, 业务逻辑, 数据库 |
| **Network** | 底层 | `string` (Provider 特定) | `'eth-sepolia'` (Alchemy) | RPC URL 构建, Provider 内部 |

**关键原则**:
- 👤 **用户**: 只需要知道 Chain (标准链标识符)
- 🔧 **Protocol**: 系统用于选择正确的技术实现
- 🌐 **Network**: Provider 内部使用，通过 networkMappings 自动转换
- 🤖 **系统**: 自动处理所有映射和转换

**数据流向**:
```
用户输入 Chain ID → 系统查找 Protocol → 选择 Adapter → 映射到 Network → 构建 RPC URL
```

**术语演进历史**:
- ❌ 旧术语: `ProtocolFamily` (Monitor), `ChainFamily` (Processor)
- ✅ 新术语: `Protocol` (统一使用，更简洁准确)
