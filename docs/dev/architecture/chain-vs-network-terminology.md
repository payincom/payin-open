# Chain vs Network 术语说明

## 问题背景

在 PayIn 系统中，存在两个容易混淆的概念：**Chain** 和 **Network**。这两个术语在不同的上下文中有不同的含义，导致命名不一致。

## 当前术语使用情况

### 1. Chain (链标识符) - PayIn 系统的标准化命名

**定义位置**: `packages/monitor/src/types/chains.ts`

**用途**: PayIn 系统内部的**标准化链标识符**

**命名格式**: `{protocol}-{network-name}`

**标准链标识符列表**:
```typescript
type Chain = 
  | 'ethereum-mainnet'    // 以太坊主网
  | 'ethereum-sepolia'    // 以太坊 Sepolia 测试网
  | 'polygon-mainnet'     // Polygon 主网
  | 'polygon-amoy'        // Polygon Amoy 测试网
  | 'tron-mainnet'        // Tron 主网
  | 'tron-nile'           // Tron Nile 测试网
  | 'base-mainnet'        // Base 主网
  | 'base-sepolia'        // Base Sepolia 测试网
```

**使用场景**:
- Processor 配置中的 `chains` 字段
- Monitor 配置中的 `chains` 字段
- 数据库表中的 `chain` 字段
- 业务逻辑中的链标识

**示例**:
```yaml
# Processor config
chains:
  ethereum-sepolia:
    family: evm
    name: Ethereum Sepolia Testnet
    network: testnet
```

### 2. Network (网络标识符) - RPC Provider 的特定命名

**定义位置**: `packages/monitor/src/rpc/config/provider-templates.ts`

**用途**: RPC Provider (如 Alchemy, Infura) 使用的**特定网络标识符**

**命名格式**: **每个 Provider 自己定义，不统一**

**不同 Provider 的 Network 命名对比**:

| PayIn Chain ID | Alchemy Network | Infura Network | Ankr Network |
|---------------|-----------------|----------------|--------------|
| ethereum-mainnet | eth-mainnet | mainnet | eth |
| ethereum-sepolia | eth-sepolia | sepolia | eth_sepolia |
| polygon-mainnet | polygon-mainnet | polygon-mainnet | polygon |
| polygon-amoy | polygon-amoy | polygon-amoy | polygon_amoy |

**使用场景**:
- RPC Provider URL 模板中的 `{network}` 占位符
- Provider 的 `supportedNetworks` 列表
- URL 构建时的网络名称替换

**示例**:
```typescript
// Alchemy provider
urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}"
supportedNetworks: ["eth-mainnet", "eth-sepolia", "polygon-mainnet"]

// Infura provider  
urlPattern: "https://{network}.infura.io/v3/{apiKey}"
supportedNetworks: ["mainnet", "sepolia", "polygon-mainnet"]

// Ankr provider
urlPattern: "https://rpc.ankr.com/{network}/{apiKey}"
supportedNetworks: ["eth", "eth_sepolia", "polygon"]
```

## 命名映射机制

### NetworkMappings (网络映射)

为了解决 PayIn 标准化 Chain ID 与各 Provider 特定 Network 名称之间的差异，使用 `networkMappings` 进行映射：

```typescript
// Alchemy
networkMappings: {
  "ethereum-mainnet": "eth-mainnet",    // Chain ID → Network Name
  "ethereum-sepolia": "eth-sepolia"
}

// Infura
networkMappings: {
  "ethereum-mainnet": "mainnet",
  "ethereum-sepolia": "sepolia"
}

// Ankr
networkMappings: {
  "ethereum-mainnet": "eth",
  "ethereum-sepolia": "eth_sepolia",
  "polygon-mainnet": "polygon",
  "polygon-amoy": "polygon_amoy"
}
```

### 映射工作流程

```
用户配置 (使用 Chain ID)
    ↓
ethereum-sepolia
    ↓
networkMappings 查找
    ↓
┌─────────────┬──────────────┬─────────────┐
│   Alchemy   │    Infura    │    Ankr     │
│ eth-sepolia │   sepolia    │ eth_sepolia │
└─────────────┴──────────────┴─────────────┘
    ↓              ↓              ↓
URL 构建
    ↓
https://eth-sepolia.g.alchemy.com/v2/{key}
https://sepolia.infura.io/v3/{key}
https://rpc.ankr.com/eth_sepolia/{key}
```

## 术语使用规范

### ✅ 正确用法

**1. 用户配置 (YAML/Code) - 使用 Chain ID**
```yaml
# ✅ 使用标准 Chain ID
chains:
  ethereum-sepolia:
    strategy: round_robin
    availableProviders: [alchemy, infura, ankr]
```

**2. Provider 配置 - 混合使用**
```typescript
// ✅ supportedNetworks 使用 Provider 特定名称
// ✅ networkMappings 定义 Chain ID → Network Name 映射
{
  supportedNetworks: ["eth-sepolia", "polygon-mainnet"],
  networkMappings: {
    "ethereum-sepolia": "eth-sepolia"  // Chain ID → Network
  }
}
```

**3. Config Loader - 自动处理映射**
```typescript
// ✅ 自动将 networkMappings 的 keys 添加到 supportedChains
const supportedChains = [
  ...supportedNetworks,           // Provider 特定名称
  ...Object.keys(networkMappings) // Chain IDs
]
```

### ❌ 错误用法

**1. 配置中混用 Network 名称**
```yaml
# ❌ 不要在用户配置中使用 Provider 特定的 Network 名称
chains:
  eth-sepolia:  # ❌ 这是 Alchemy 的 Network 名称,不是标准 Chain ID
    strategy: round_robin
```

**2. Provider 定义中使用 Chain ID**
```typescript
// ❌ supportedNetworks 不应该使用标准 Chain ID
{
  supportedNetworks: ["ethereum-sepolia"]  // ❌ 应该使用 Provider 的 Network 名称
}
```

## 命名一致性问题

### 当前不一致情况

1. **Alchemy**: 使用 `eth-sepolia` (相对接近标准)
2. **Infura**: 使用 `sepolia` (省略协议前缀)
3. **Ankr**: 使用 `eth_sepolia` (下划线分隔)

### 解决方案

通过 `networkMappings` 实现统一:
- **用户侧**: 始终使用标准 Chain ID (`ethereum-sepolia`)
- **Provider 侧**: 保留各自的 Network 命名 (`eth-sepolia`, `sepolia`, `eth_sepolia`)
- **系统**: 自动处理映射和转换

## 代码示例

### 用户配置示例
```typescript
// ✅ 使用标准 Chain ID
const config = {
  chains: {
    'ethereum-sepolia': {  // 标准 Chain ID
      strategy: 'round_robin',
      availableProviders: ['alchemy', 'infura', 'ankr']
    }
  }
}
```

### 自定义 Provider 示例
```typescript
// ✅ 自定义 Provider 也应该提供 networkMappings
customProviders: {
  'my-node': {
    displayName: 'My Enterprise Node',
    urlPattern: 'https://rpc.mycompany.com/{network}',
    supportedNetworks: ['sepolia-testnet'],  // Provider 特定命名
    networkMappings: {
      'ethereum-sepolia': 'sepolia-testnet'  // Chain ID → Network
    }
  }
}
```

## 总结

| 术语 | 定义 | 命名格式 | 使用场景 |
|-----|------|---------|---------|
| **Chain** | PayIn 标准化链标识符 | `{protocol}-{network}` | 用户配置、业务逻辑、数据库 |
| **Network** | Provider 特定网络标识符 | 各 Provider 自定义 | RPC URL 构建、Provider 配置 |

**关键规则**:
- 👤 **用户**: 只使用标准 Chain ID
- 🔧 **Provider**: 使用自己的 Network 命名 + 提供 networkMappings
- 🤖 **系统**: 自动处理映射和转换

**命名映射流程**:
```
Chain ID (标准) → networkMappings → Network Name (Provider 特定) → RPC URL
```
