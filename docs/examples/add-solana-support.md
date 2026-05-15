# 添加 Solana 支持完整示例

本文档演示如何向 PayIn 系统添加新的区块链支持（以 Solana 为例）。

## 步骤概览

1. ✅ 定义标准 Chain ID
2. ✅ 添加 RPC Provider 支持
3. ✅ 配置 Chain 策略
4. ✅ 使用配置

---

## 1. 定义标准 Chain ID

**文件**: `packages/monitor/src/types/chains.ts`

```typescript
// 添加新的 Chain 类型
export type Chain =
  | 'ethereum-mainnet'
  | 'ethereum-sepolia'
  | 'polygon-mainnet'
  | 'polygon-amoy'
  | 'tron-mainnet'
  | 'tron-nile'
  | 'base-mainnet'
  | 'base-sepolia'
  | 'solana-mainnet'    // ✅ 新增
  | 'solana-devnet'     // ✅ 新增

// 添加新的 Protocol Family
export type ProtocolFamily = 'evm' | 'tron' | 'solana'  // ✅ 新增

// 添加 Chain 配置
export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  // ... 现有配置 ...

  'solana-mainnet': {
    chain: 'solana-mainnet',
    name: 'Solana Mainnet',
    protocol: 'solana',
    isTestnet: false,
    nativeToken: 'SOL',
    blockTime: 0.4,
    safeBlockDistance: 32
  },

  'solana-devnet': {
    chain: 'solana-devnet',
    name: 'Solana Devnet',
    protocol: 'solana',
    isTestnet: true,
    nativeToken: 'SOL',
    blockTime: 0.4,
    safeBlockDistance: 1
  }
}
```

**命名规范**：
- Chain ID 格式：`{protocol}-{network}` (如 `solana-mainnet`)
- 这是 PayIn 的标准化标识符，全系统统一使用

---

## 2. 添加 RPC Provider 支持

**文件**: `packages/monitor/src/rpc/config/provider-templates.ts`

```typescript
export const BUILTIN_PROVIDERS: Record<string, Omit<ProviderTemplate, 'name'>> = {
  // ... 现有 providers ...

  // ✅ 新增：Helius (Solana 专用 RPC)
  helius: {
    displayName: "Helius",
    authType: 'url_path',
    urlPattern: "https://{network}.helius-rpc.com/?api-key={apiKey}",
    supportedNetworks: ["mainnet", "devnet"],
    networkMappings: {
      "solana-mainnet": "mainnet",
      "solana-devnet": "devnet"
    },
    defaultSettings: { timeout: 5000, weight: 100, maxRequestsPerSecond: 10 }
  },

  // ✅ 新增：QuickNode (也支持 Solana)
  quicknode: {
    displayName: "QuickNode",
    authType: 'url_path',
    urlPattern: "https://solana-{network}.quiknode.pro/{apiKey}",
    supportedNetworks: ["mainnet", "devnet"],
    networkMappings: {
      "solana-mainnet": "mainnet",
      "solana-devnet": "devnet"
    },
    defaultSettings: { timeout: 5000, weight: 90, maxRequestsPerSecond: 8 }
  },

  // ✅ 更新：Ankr 也支持 Solana
  ankr: {
    displayName: "Ankr",
    authType: 'url_path',
    urlPattern: "https://rpc.ankr.com/{network}/{apiKey}",
    supportedNetworks: [
      "eth", "eth_sepolia",
      "polygon", "polygon_amoy",
      "solana", "solana_devnet"  // ✅ 添加 Solana
    ],
    networkMappings: {
      "ethereum-mainnet": "eth",
      "ethereum-sepolia": "eth_sepolia",
      "polygon-mainnet": "polygon",
      "polygon-amoy": "polygon_amoy",
      "solana-mainnet": "solana",       // ✅ 添加映射
      "solana-devnet": "solana_devnet"
    },
    defaultSettings: { timeout: 5000, weight: 85, maxRequestsPerSecond: 12 }
  }
}
```

**关键字段说明**：
- `authType`: 认证方式（`none`/`url_path`/`header`/`query_param`）
- `urlPattern`: RPC URL 模板，支持 `{network}` 和 `{apiKey}` 占位符
- `supportedNetworks`: Provider 自己的网络命名列表
- `networkMappings`: 映射 PayIn Chain ID → Provider Network Name

**网络名称映射示例**：
```
PayIn Chain ID       Helius      QuickNode    Ankr
─────────────────    ─────────   ──────────   ──────────
solana-mainnet   →   mainnet     mainnet      solana
solana-devnet    →   devnet      devnet       solana_devnet
```

---

## 3. 配置 Chain 策略

**文件**: `packages/monitor/config/default.yaml`

```yaml
rpc:
  chains:
    # ✅ Solana 主网配置
    solana-mainnet:
      preferredProviders: [helius, quicknode, ankr]
      timeout: 8000
      strategy: round_robin
      healthCheck:
        enabled: true
        interval: 30000
        maxFailures: 3
      retry:
        maxRetries: 3
        initialDelay: 1000

    # ✅ Solana 测试网配置
    solana-devnet:
      preferredProviders: [helius, quicknode]
      timeout: 8000
      strategy: priority
```

---

## 4. 使用配置

### 方式 A：YAML 配置文件（推荐）

**config/processor.yaml**:
```yaml
chains:
  solana-mainnet:     # ✅ 使用标准 Chain ID
    strategy: round_robin
    availableProviders: [helius, quicknode, ankr]

  solana-devnet:
    strategy: priority
    availableProviders: [helius]
```

### 方式 B：代码配置

```typescript
import { Monitor } from '@payin/monitor'

const monitor = new Monitor({
  rpcKeys: {
    helius: process.env.HELIUS_API_KEY,
    quicknode: process.env.QUICKNODE_API_KEY,
    ankr: process.env.ANKR_API_KEY
  },
  rpcConfig: {
    chains: {
      'solana-mainnet': {  // ✅ 使用标准 Chain ID
        strategy: 'round_robin',
        availableProviders: ['helius', 'quicknode', 'ankr'],
        defaultSettings: {
          timeout: 8000,
          weight: 100,
          maxRequestsPerSecond: 10
        }
      }
    }
  }
})

// 开始监控 Solana 地址
monitor.startMonitoring({
  chain: 'solana-mainnet',  // ✅ 使用标准 Chain ID
  address: 'YourSolanaAddressHere',
  tokenContract: 'USDC-SPL-Token-Address'
})
```

### 方式 C：自定义 Provider

如果你有自己的 Solana RPC 节点：

```typescript
const monitor = new Monitor({
  rpcKeys: {
    mynode: 'my-secret-key'
  },
  rpcConfig: {
    // ✅ 通过 customProviders 添加自定义节点
    customProviders: {
      mynode: {
        displayName: "My Solana Node",
        authType: 'header',
        urlPattern: "https://my-solana-rpc.com/v1",
        headerTemplate: {
          "Authorization": "Bearer {apiKey}"
        },
        supportedNetworks: ["mainnet-beta", "devnet"],
        networkMappings: {
          "solana-mainnet": "mainnet-beta",
          "solana-devnet": "devnet"
        },
        defaultSettings: {
          timeout: 5000,
          weight: 100,
          maxRequestsPerSecond: 20
        }
      }
    },
    chains: {
      'solana-mainnet': {
        strategy: 'priority',
        availableProviders: ['mynode']
      }
    }
  }
})
```

---

## 系统如何工作

### 自动网络名称转换

```
用户配置
    ↓
Chain ID: "solana-mainnet"
    ↓
查找 networkMappings
    ↓
┌─────────────┬──────────────┬─────────────┐
│   Helius    │  QuickNode   │    Ankr     │
│  mainnet    │   mainnet    │   solana    │
└─────────────┴──────────────┴─────────────┘
    ↓              ↓              ↓
构建 RPC URL
    ↓
https://mainnet.helius-rpc.com/?api-key={key}
https://solana-mainnet.quiknode.pro/{key}
https://rpc.ankr.com/solana/{key}
```

### Provider 优先级

系统支持三层 Provider 配置，优先级为：

1. **代码 providers**（最高优先级）
2. **YAML customProviders**
3. **BUILTIN_PROVIDERS**（最低优先级）

后面的配置可以覆盖前面的配置。

---

## 测试验证

创建测试文件验证 Solana 支持：

```typescript
// tests/solana-support.test.ts
import { describe, it, expect } from 'vitest'
import { RPCConfigLoader } from '../src/rpc/config/config-loader'

describe('Solana Support', () => {
  it('should support solana-mainnet chain', async () => {
    const loader = new RPCConfigLoader(undefined, {
      helius: 'test-key',
      quicknode: 'test-key'
    }, {
      chains: {
        'solana-mainnet': {
          strategy: 'round_robin',
          availableProviders: ['helius', 'quicknode'],
          defaultSettings: { timeout: 8000, weight: 100, maxRequestsPerSecond: 10 }
        }
      }
    })

    const config = await loader.loadGlobalConfig()

    expect(config.chains['solana-mainnet']).toBeDefined()
    expect(config.chains['solana-mainnet'].endpoints).toHaveLength(2)
    expect(config.chains['solana-mainnet'].endpoints[0].chain).toBe('solana-mainnet')
  })

  it('should correctly map chain IDs to provider networks', async () => {
    const loader = new RPCConfigLoader()
    const templates = await loader.loadProviderTemplates()

    const helius = templates.find(p => p.name === 'helius')
    expect(helius?.supportedChains).toContain('solana-mainnet')
    expect(helius?.supportedChains).toContain('solana-devnet')
  })
})
```

运行测试：
```bash
npm test tests/solana-support.test.ts
```

---

## 总结

添加新链支持的三个核心概念：

1. **Chain ID**（链标识符）
   - PayIn 的标准化命名
   - 格式：`{protocol}-{network}`
   - 用于：用户配置、业务逻辑、数据库

2. **Network Name**（网络标识符）
   - RPC Provider 的特定命名
   - 格式：各 Provider 自定义
   - 用于：RPC URL 构建

3. **Network Mapping**（网络映射）
   - 连接 Chain ID 和 Network Name
   - 系统自动转换
   - 用户无需关心

**核心原则**：
- ✅ 用户只使用标准 Chain ID
- ✅ Provider 使用自己的 Network Name
- ✅ 系统自动处理映射转换
