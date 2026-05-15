# Monitor RPC 配置完整指南

## 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [配置方式](#配置方式)
- [配置文件格式](#配置文件格式)
- [环境变量](#环境变量)
- [内置提供商](#内置提供商)
- [自定义提供商](#自定义提供商)
- [认证方式](#认证方式)
- [高级配置](#高级配置)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 概述

Monitor RPC配置系统提供了灵活、类型安全的方式来管理多链区块链RPC端点。它支持：

- 🌐 **多链支持**: Ethereum、Polygon、Tron等主流区块链
- 🔑 **多种认证方式**: URL路径、HTTP Header、查询参数、无认证
- ⚖️ **负载均衡**: 轮询(Round Robin)、故障转移(Failover)、最快响应(Fastest)
- 🏥 **健康检查**: 自动检测和恢复故障端点
- 🚦 **速率限制**: 防止超出提供商限制
- 📊 **零配置启动**: 通过环境变量快速启动

---

## 快速开始

### 最简单的方式（环境变量）

```bash
# 设置API密钥
export RPC_ALCHEMY_KEY="your_alchemy_key"
export RPC_INFURA_KEY="your_infura_key"

# 运行你的应用
npm start
```

```typescript
import { createRPCManager } from '@payin/monitor';

// API密钥会自动从环境变量中发现
const rpcManager = await createRPCManager({
  alchemy: process.env.RPC_ALCHEMY_KEY!,
  infura: process.env.RPC_INFURA_KEY!,
});

await rpcManager.initialize();
```

### 使用配置文件

```yaml
# config/monitor.yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
      timeout: 5000
    polygon-amoy:
      preferredProviders: [alchemy, ankr]
      timeout: 6000
```

```typescript
const rpcManager = await createRPCManager(
  rpcKeys,
  './config/monitor.yaml'
);
```

---

## 配置方式

Monitor支持多种配置方式，按优先级从高到低：

### 1. 代码直接传递配置（优先级最高）

```typescript
import { RPCManager } from '@payin/monitor';

const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      chain: 'ethereum-sepolia',
      strategy: 'round_robin',
      endpoints: [{
        name: 'alchemy',
        provider: 'alchemy',
        url: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
        weight: 100,
        timeout: 5000,
        maxRequestsPerSecond: 15,
        enabled: true
      }],
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        maxFailures: 3
      },
      retry: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    }
  },
  settings: {
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      maxFailures: 3
    },
    retry: {
      maxRetries: 3,
      backoffMultiplier: 1.5,
      initialDelay: 1000
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      timeWindow: 1000
    }
  }
};

const rpcManager = new RPCManager({ rpcConfig });
await rpcManager.initialize();
```

### 2. 使用配置构建器

```typescript
import { RPCConfigBuilder } from '@payin/monitor';

const builder = new RPCConfigBuilder({
  apiKeys: {
    alchemy: process.env.RPC_ALCHEMY_KEY!,
    infura: process.env.RPC_INFURA_KEY!,
  }
});

const rpcConfig = await builder.buildForChains([
  'ethereum-sepolia',
  'polygon-amoy',
  'tron-mainnet'
]);

const rpcManager = new RPCManager({ rpcConfig });
await rpcManager.initialize();
```

### 3. 自定义配置文件路径

```typescript
const rpcManager = await createRPCManager(
  rpcKeys,
  process.env.MONITOR_CONFIG_FILE || './config/custom.yaml'
);
```

### 4. 默认配置文件

Monitor会自动尝试加载 `packages/monitor/config/default.yaml`（优先级最低）

---

## 配置文件格式

### 完整配置示例

```yaml
# Monitor配置文件
rpc:
  # 全局默认设置
  defaults:
    timeout: 5000
    maxRetries: 3
    healthCheckInterval: 30000

  # 链默认配置（所有链的默认值）
  chainDefaults:
    strategy: round_robin  # 负载均衡策略: round_robin | failover | fastest
    healthCheck:
      enabled: true
      interval: 30000      # 健康检查间隔(毫秒)
      timeout: 5000        # 健康检查超时(毫秒)
      maxFailures: 3       # 最大连续失败次数
    retry:
      maxRetries: 3        # 最大重试次数
      backoffMultiplier: 1.5  # 退避乘数
      initialDelay: 1000   # 初始延迟(毫秒)

  # 自定义提供商定义（可选）
  providers:
    my-custom-rpc:
      displayName: "My Custom RPC"
      authType: 'url_path'
      urlPattern: "https://my-rpc.com/{network}/{apiKey}"
      supportedNetworks: ["ethereum-sepolia", "polygon-amoy"]
      networkMappings:
        ethereum-sepolia: "eth-sepolia"
      defaultSettings:
        timeout: 5000
        weight: 100
        maxRequestsPerSecond: 10

  # 链特定配置（覆盖chainDefaults）
  chains:
    ethereum-mainnet:
      preferredProviders: [alchemy, infura, publicnode]
      strategy: fastest    # 覆盖默认策略
      timeout: 5000
      healthCheck:
        maxFailures: 5     # 覆盖默认值

    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
      timeout: 5000

    polygon-mainnet:
      preferredProviders: [alchemy, ankr, publicnode]
      timeout: 6000

    polygon-amoy:
      preferredProviders: [alchemy, ankr]
      timeout: 6000

    tron-mainnet:
      preferredProviders: [trongrid]
      timeout: 8000

monitor:
  # 扫描设置
  scanning:
    defaultConfirmations: 3
    maxBlockRange: 1000
    scanInterval: 10000

  # 事件处理
  events:
    maxListeners: 100
    errorRetryInterval: 5000

  # 性能设置
  performance:
    enableCache: true
    cacheSize: 1000
    concurrentRequests: 5
```

### 最小配置示例

```yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
    polygon-amoy:
      preferredProviders: [alchemy]
```

---

## 环境变量

### RPC API密钥自动发现

Monitor会自动识别 `RPC_*_KEY` 格式的环境变量：

```bash
# 格式: RPC_{PROVIDER_NAME}_KEY
export RPC_ALCHEMY_KEY="your_alchemy_key"
export RPC_INFURA_KEY="your_infura_key"
export RPC_ANKR_KEY="your_ankr_key"
export RPC_TRONGRID_KEY="your_trongrid_key"

# 自定义提供商
export RPC_QUICKNODE_KEY="your_quicknode_key"
export RPC_BLAST_KEY="your_blast_key"
```

**命名规则：**
- 前缀必须是 `RPC_`
- 后缀必须是 `_KEY`
- 中间是提供商名称（大写，下划线分隔）
- 提供商名称会自动转换为小写

**示例：**
```bash
RPC_ALCHEMY_KEY      → alchemy
RPC_INFURA_KEY       → infura
RPC_MY_CUSTOM_KEY    → my_custom（注意：会保留下划线）
```

### 配置文件路径

```bash
# 指定自定义配置文件
export MONITOR_CONFIG_FILE="./config/production.yaml"
```

### 代码中使用环境变量

```typescript
// 自动提取环境变量中的RPC密钥
function extractRpcKeysFromEnv(): Record<string, string> {
  const rpcKeys: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('RPC_') && key.endsWith('_KEY') && typeof value === 'string') {
      // RPC_ALCHEMY_KEY -> alchemy
      const providerName = key.slice(4, -4).toLowerCase();
      rpcKeys[providerName] = value;
    }
  }

  return rpcKeys;
}

// 使用
const rpcKeys = extractRpcKeysFromEnv();
console.log(rpcKeys);
// { alchemy: 'xxx', infura: 'xxx', ankr: 'xxx', ... }
```

---

## 内置提供商

Monitor内置了以下RPC提供商模板：

### 需要API密钥的提供商

| 提供商 | 认证方式 | 支持的链 | 默认速率限制 |
|--------|----------|----------|--------------|
| **Alchemy** | URL路径 | Ethereum, Polygon | 15 req/s |
| **Infura** | URL路径 | Ethereum, Polygon | 10 req/s |
| **Ankr** | URL路径 | Ethereum, Polygon | 12 req/s |
| **TronGrid** | HTTP Header | Tron | 8 req/s |

### 公共提供商（无需API密钥）

| 提供商 | 支持的链 | 默认速率限制 |
|--------|----------|--------------|
| **PublicNode** | Ethereum, Polygon | 3 req/s |
| **Cloudflare** | Ethereum Mainnet | 3 req/s |

### 提供商详细配置

#### Alchemy
```typescript
{
  displayName: "Alchemy",
  authType: 'url_path',
  urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}",
  supportedNetworks: ["eth-mainnet", "eth-sepolia", "polygon-mainnet", "polygon-amoy"],
  networkMappings: {
    "ethereum-mainnet": "eth-mainnet",
    "ethereum-sepolia": "eth-sepolia"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 100,
    maxRequestsPerSecond: 15
  }
}
```

#### Infura
```typescript
{
  displayName: "Infura",
  authType: 'url_path',
  urlPattern: "https://{network}.infura.io/v3/{apiKey}",
  supportedNetworks: ["mainnet", "sepolia", "polygon-mainnet", "polygon-amoy"],
  networkMappings: {
    "ethereum-mainnet": "mainnet",
    "ethereum-sepolia": "sepolia"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 90,
    maxRequestsPerSecond: 10
  }
}
```

#### Ankr
```typescript
{
  displayName: "Ankr",
  authType: 'url_path',
  urlPattern: "https://rpc.ankr.com/{network}/{apiKey}",
  supportedNetworks: ["eth", "eth_sepolia", "polygon", "polygon_amoy"],
  networkMappings: {
    "ethereum-mainnet": "eth",
    "ethereum-sepolia": "eth_sepolia",
    "polygon-mainnet": "polygon",
    "polygon-amoy": "polygon_amoy"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 85,
    maxRequestsPerSecond: 12
  }
}
```

#### TronGrid
```typescript
{
  displayName: "TronGrid",
  authType: 'header',
  urlPattern: "https://api.trongrid.io/jsonrpc",
  headerTemplate: {
    "TRON-PRO-API-KEY": "{apiKey}"
  },
  supportedNetworks: ["tron-mainnet", "tron-nile"],
  defaultSettings: {
    timeout: 8000,
    weight: 80,
    maxRequestsPerSecond: 8
  }
}
```

---

## 自定义提供商

### 方法1：在配置文件中定义

```yaml
rpc:
  # 定义自定义提供商
  providers:
    quicknode:
      displayName: "QuickNode"
      authType: 'url_path'
      urlPattern: "https://{network}.quiknode.pro/{apiKey}"
      supportedNetworks: ["eth-mainnet", "eth-sepolia"]
      networkMappings:
        ethereum-mainnet: "eth-mainnet"
        ethereum-sepolia: "eth-sepolia"
      defaultSettings:
        timeout: 3000
        weight: 100
        maxRequestsPerSecond: 25

    blast:
      displayName: "Blast API"
      authType: 'url_path'
      urlPattern: "https://{network}.blastapi.io/{apiKey}"
      supportedNetworks: ["eth-mainnet", "polygon-mainnet"]
      networkMappings:
        ethereum-mainnet: "eth-mainnet"
        polygon-mainnet: "polygon-mainnet"
      defaultSettings:
        timeout: 5000
        weight: 90
        maxRequestsPerSecond: 15

  chains:
    ethereum-sepolia:
      preferredProviders: [quicknode, alchemy, infura]
```

### 方法2：直接提供完整端点配置

```typescript
const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      chain: 'ethereum-sepolia',
      strategy: 'round_robin',
      endpoints: [
        {
          name: 'my-custom-endpoint',
          provider: 'custom',
          url: 'https://my-rpc.com/ethereum/sepolia',  // 完整URL
          headers: {  // 可选：自定义headers
            'Authorization': 'Bearer YOUR_TOKEN',
            'X-API-Key': 'YOUR_KEY'
          },
          weight: 100,
          timeout: 5000,
          maxRequestsPerSecond: 10,
          enabled: true
        }
      ],
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        maxFailures: 3
      },
      retry: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    }
  },
  settings: {
    healthCheck: { enabled: true, interval: 30000, timeout: 5000, maxFailures: 3 },
    retry: { maxRetries: 3, backoffMultiplier: 1.5, initialDelay: 1000 },
    rateLimit: { enabled: true, maxRequests: 100, timeWindow: 1000 }
  }
};
```

### 方法3：扩展内置提供商模板

**编辑 `packages/monitor/src/rpc/config/provider-templates.ts`：**

```typescript
export const RPC_PROVIDERS: Record<string, Omit<ProviderTemplate, 'name'>> = {
  // ... 现有提供商

  // 添加新提供商
  'getblock': {
    displayName: "GetBlock",
    authType: 'url_path',
    urlPattern: "https://{network}.getblock.io/{apiKey}/mainnet/",
    supportedNetworks: ["eth", "matic"],
    networkMappings: {
      "ethereum-mainnet": "eth",
      "polygon-mainnet": "matic"
    },
    defaultSettings: {
      timeout: 6000,
      weight: 85,
      maxRequestsPerSecond: 12
    }
  }
} as const;
```

---

## 认证方式

Monitor支持4种RPC提供商认证方式：

### 1. URL路径认证 (`url_path`)

API密钥嵌入在URL路径中。

```yaml
providers:
  my-provider:
    authType: 'url_path'
    urlPattern: "https://{network}.provider.com/v2/{apiKey}"
```

**生成的URL示例：**
```
https://eth-mainnet.provider.com/v2/YOUR_API_KEY
```

**适用场景：** Alchemy, Infura, Ankr 等

### 2. HTTP Header认证 (`header`)

API密钥通过HTTP请求头传递。

```yaml
providers:
  my-provider:
    authType: 'header'
    urlPattern: "https://api.provider.com/jsonrpc"
    headerTemplate:
      Authorization: "Bearer {apiKey}"
      X-API-Key: "{apiKey}"
      X-Custom-Header: "static-value"
```

**生成的HTTP请求：**
```http
POST https://api.provider.com/jsonrpc
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
X-Custom-Header: static-value
Content-Type: application/json
```

**适用场景：** TronGrid, 需要Bearer Token的提供商

### 3. 查询参数认证 (`query_param`)

API密钥作为URL查询参数。

```yaml
providers:
  my-provider:
    authType: 'query_param'
    urlPattern: "https://api.provider.com/rpc"
    queryTemplate:
      apikey: "{apiKey}"
      network: "{network}"
      format: "json"
```

**生成的URL示例：**
```
https://api.provider.com/rpc?apikey=YOUR_KEY&network=eth-mainnet&format=json
```

**适用场景：** 使用查询参数的RESTful API

### 4. 无认证 (`none`)

公共RPC端点，无需API密钥。

```yaml
providers:
  public-rpc:
    authType: 'none'
    urlPattern: "https://public-rpc.example.com"
```

**生成的URL示例：**
```
https://public-rpc.example.com
```

**适用场景：** PublicNode, Cloudflare Web3, 公共测试网RPC

---

## 高级配置

### 负载均衡策略

Monitor支持3种负载均衡策略：

#### 1. 轮询 (Round Robin) - 默认

按权重轮流使用所有健康的端点。

```yaml
chains:
  ethereum-sepolia:
    strategy: round_robin
    preferredProviders: [alchemy, infura, ankr]
```

**特点：**
- ✅ 均匀分布请求
- ✅ 考虑端点权重
- ✅ 自动跳过不健康的端点

#### 2. 故障转移 (Failover)

优先使用权重最高的端点，失败时切换到下一个。

```yaml
chains:
  ethereum-mainnet:
    strategy: failover
    preferredProviders: [alchemy, infura, publicnode]
```

**特点：**
- ✅ 优先级明确
- ✅ 快速故障切换
- ✅ 适合有主备RPC的场景

#### 3. 最快响应 (Fastest)

选择平均响应时间最快的端点。

```yaml
chains:
  polygon-mainnet:
    strategy: fastest
    preferredProviders: [alchemy, ankr, publicnode]
```

**特点：**
- ✅ 自动优化性能
- ✅ 动态调整
- ✅ 适合对延迟敏感的应用

### 健康检查配置

```yaml
rpc:
  chainDefaults:
    healthCheck:
      enabled: true        # 是否启用健康检查
      interval: 30000      # 检查间隔(毫秒)
      timeout: 5000        # 超时时间(毫秒)
      maxFailures: 3       # 标记为不健康前的最大失败次数

  chains:
    ethereum-sepolia:
      healthCheck:
        interval: 15000    # 更频繁的检查
        maxFailures: 5     # 更宽容的失败容忍
```

### 重试配置

```yaml
rpc:
  chainDefaults:
    retry:
      maxRetries: 3              # 最大重试次数
      backoffMultiplier: 1.5     # 退避乘数（每次重试延迟 * 1.5）
      initialDelay: 1000         # 初始延迟(毫秒)

  chains:
    tron-mainnet:
      retry:
        maxRetries: 5            # Tron可能需要更多重试
        backoffMultiplier: 2.0   # 更激进的退避
```

**重试延迟计算：**
```
第1次重试: 1000ms
第2次重试: 1000ms * 1.5 = 1500ms
第3次重试: 1500ms * 1.5 = 2250ms
```

### 速率限制配置

```yaml
rpc:
  settings:
    rateLimit:
      enabled: true
      maxRequests: 100     # 最大请求数
      timeWindow: 1000     # 时间窗口(毫秒)
```

**每个端点可以独立配置：**

```typescript
{
  name: 'alchemy',
  provider: 'alchemy',
  url: 'https://eth-sepolia.g.alchemy.com/v2/key',
  maxRequestsPerSecond: 15,  // 此端点的速率限制
  // ...
}
```

### 端点权重配置

权重影响负载均衡时的选择频率。权重越高，被选中的概率越大。

```yaml
# 在提供商模板中设置默认权重
providers:
  high-priority-rpc:
    defaultSettings:
      weight: 100  # 高权重

  backup-rpc:
    defaultSettings:
      weight: 50   # 较低权重
```

```typescript
// 或在端点配置中覆盖
{
  name: 'alchemy',
  weight: 100,  // 优先使用
}
{
  name: 'publicnode',
  weight: 30,   // 较少使用
}
```

---

## 最佳实践

### 1. 生产环境配置

```yaml
# config/production.yaml
rpc:
  chainDefaults:
    strategy: fastest  # 使用最快响应策略
    healthCheck:
      enabled: true
      interval: 30000
      timeout: 5000
      maxFailures: 3
    retry:
      maxRetries: 3
      backoffMultiplier: 1.5
      initialDelay: 1000

  chains:
    ethereum-mainnet:
      preferredProviders: [alchemy, infura, blast]  # 多个可靠提供商
      timeout: 5000

    polygon-mainnet:
      preferredProviders: [alchemy, ankr, quicknode]
      timeout: 6000
```

```bash
# 环境变量
export RPC_ALCHEMY_KEY="prod_alchemy_key"
export RPC_INFURA_KEY="prod_infura_key"
export RPC_BLAST_KEY="prod_blast_key"
export MONITOR_CONFIG_FILE="./config/production.yaml"
```

### 2. 开发/测试环境配置

```yaml
# config/development.yaml
rpc:
  chainDefaults:
    strategy: round_robin
    healthCheck:
      enabled: true
      interval: 60000  # 较长的检查间隔
      maxFailures: 5   # 更宽容
    retry:
      maxRetries: 5    # 更多重试

  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura, publicnode]  # 包括免费选项

    polygon-amoy:
      preferredProviders: [alchemy, publicnode]
```

### 3. CI/CD环境配置

```yaml
# config/ci.yaml
rpc:
  chainDefaults:
    strategy: failover  # 简单的故障转移
    healthCheck:
      enabled: false    # 禁用健康检查以加快测试
    retry:
      maxRetries: 1     # 快速失败

  chains:
    ethereum-sepolia:
      preferredProviders: [publicnode]  # 仅使用公共RPC
```

### 4. 推荐的提供商组合

**Ethereum Mainnet：**
```yaml
preferredProviders: [alchemy, infura, blast, publicnode]
```

**Ethereum Sepolia (测试网)：**
```yaml
preferredProviders: [alchemy, infura, publicnode]
```

**Polygon Mainnet：**
```yaml
preferredProviders: [alchemy, ankr, quicknode, publicnode]
```

**Polygon Amoy (测试网)：**
```yaml
preferredProviders: [alchemy, ankr, publicnode]
```

**Tron Mainnet：**
```yaml
preferredProviders: [trongrid]
```

### 5. 安全最佳实践

**❌ 不要做：**
```yaml
# 不要在配置文件中硬编码API密钥
providers:
  alchemy:
    apiKey: "sk_12345..."  # ❌ 危险！
```

**✅ 应该做：**
```bash
# 使用环境变量
export RPC_ALCHEMY_KEY="sk_12345..."
```

```yaml
# 配置文件只包含结构
chains:
  ethereum-sepolia:
    preferredProviders: [alchemy]  # ✅ 密钥来自环境变量
```

**✅ 使用密钥管理服务：**
```typescript
import { getSecret } from './secrets';

const rpcKeys = {
  alchemy: await getSecret('RPC_ALCHEMY_KEY'),
  infura: await getSecret('RPC_INFURA_KEY'),
};
```

### 6. 监控和日志

**启用详细日志：**
```typescript
import { createLogger, LogLevel } from '@payin/shared';

const logger = createLogger('RPC', LogLevel.DEBUG);
```

**监听RPC事件：**
```typescript
rpcManager.on('endpoint-failed', (endpoint, error) => {
  console.error(`Endpoint ${endpoint.name} failed:`, error);
  // 发送告警
});

rpcManager.on('endpoint-recovered', (endpoint) => {
  console.log(`Endpoint ${endpoint.name} recovered`);
});

rpcManager.on('configuration-reloaded', () => {
  console.log('RPC configuration reloaded');
});
```

### 7. 性能优化

**连接池配置：**
```typescript
const rpcConfig = {
  // ...
  settings: {
    connectionPool: {
      maxConnections: 10,
      idleTimeout: 30000,
      keepAlive: true
    }
  }
};
```

**缓存配置：**
```yaml
monitor:
  performance:
    enableCache: true
    cacheSize: 1000  # 缓存1000个最近的区块
    cacheTTL: 60000  # 缓存1分钟
```

---

## 故障排查

### 问题1：No chains could be configured

**错误信息：**
```
Error: No chains could be configured. Please provide valid RPC provider keys.
```

**原因：**
- 没有提供任何API密钥
- 环境变量名称格式错误
- 配置文件中没有定义任何链

**解决方案：**

1. 检查环境变量：
```bash
# 确保设置了正确格式的环境变量
echo $RPC_ALCHEMY_KEY
echo $RPC_INFURA_KEY

# 格式必须是 RPC_*_KEY
export RPC_ALCHEMY_KEY="your_key"
```

2. 检查配置文件：
```yaml
rpc:
  chains:
    ethereum-sepolia:  # 至少定义一条链
      preferredProviders: [alchemy]
```

3. 在代码中显式提供密钥：
```typescript
const rpcManager = await createRPCManager({
  alchemy: 'your_alchemy_key',
  infura: 'your_infura_key',
});
```

### 问题2：Unknown provider

**错误信息：**
```
Unknown provider: my-custom-provider
```

**原因：**
- 提供商名称在配置中未定义
- 提供商模板不存在

**解决方案：**

1. 在配置文件中定义提供商：
```yaml
rpc:
  providers:
    my-custom-provider:
      displayName: "My Provider"
      authType: 'url_path'
      urlPattern: "https://..."
      supportedNetworks: [...]
```

2. 或使用直接端点配置：
```typescript
const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      endpoints: [{
        name: 'custom',
        provider: 'custom',
        url: 'https://my-rpc.com/...',  // 提供完整URL
        // ...
      }]
    }
  }
};
```

### 问题3：Failed to initialize any adapters

**错误信息：**
```
Error: Failed to initialize any adapters
```

**原因：**
- 所有RPC端点都无法连接
- API密钥无效
- 网络问题

**解决方案：**

1. 验证API密钥是否有效：
```bash
# 测试Alchemy
curl https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

2. 检查网络连接：
```bash
# 测试连接性
ping eth-sepolia.g.alchemy.com
```

3. 增加超时和重试：
```yaml
rpc:
  chainDefaults:
    retry:
      maxRetries: 5
    timeout: 10000  # 增加超时
```

4. 启用调试日志：
```typescript
import { createLogger, LogLevel } from '@payin/shared';
const logger = createLogger('RPC', LogLevel.DEBUG);
```

### 问题4：Rate limit exceeded

**错误信息：**
```
Error: Rate limit exceeded for endpoint alchemy
```

**原因：**
- 超过了RPC提供商的速率限制
- `maxRequestsPerSecond` 设置过高

**解决方案：**

1. 降低速率限制：
```yaml
providers:
  alchemy:
    defaultSettings:
      maxRequestsPerSecond: 10  # 降低限制
```

2. 添加更多提供商：
```yaml
chains:
  ethereum-sepolia:
    preferredProviders: [alchemy, infura, ankr]  # 分散负载
```

3. 使用更高级的API计划

### 问题5：Configuration file not found

**错误信息：**
```
Custom config file not found: ./config/monitor.yaml
```

**原因：**
- 配置文件路径错误
- 文件不存在

**解决方案：**

1. 检查文件是否存在：
```bash
ls -la ./config/monitor.yaml
```

2. 使用绝对路径：
```typescript
const configPath = path.join(__dirname, '../config/monitor.yaml');
const rpcManager = await createRPCManager(rpcKeys, configPath);
```

3. 或使用默认配置：
```typescript
// 不指定配置文件路径，使用默认配置
const rpcManager = await createRPCManager(rpcKeys);
```

### 调试技巧

**启用详细日志：**
```typescript
import { createLogger, LogCategory, LogLevel } from '@payin/shared';

// 为RPC启用DEBUG级别日志
const logger = createLogger(LogCategory.RPC, LogLevel.DEBUG);
```

**监听所有事件：**
```typescript
rpcManager.on('*', (event, data) => {
  console.log('RPC Event:', event, data);
});
```

**检查配置状态：**
```typescript
const config = rpcManager.getConfiguration();
console.log('Current RPC Config:', JSON.stringify(config, null, 2));

console.log('Available chains:', Object.keys(config.chains));
console.log('Endpoints per chain:');
for (const [chain, chainConfig] of Object.entries(config.chains)) {
  console.log(`  ${chain}:`, chainConfig.endpoints.map(e => e.name));
}
```

**测试单个端点：**
```typescript
const endpoint = rpcManager.getEndpoint('ethereum-sepolia', 'alchemy');
const response = await rpcManager.executeRequest('ethereum-sepolia', {
  method: 'eth_blockNumber',
  params: [],
});
console.log('Block number:', parseInt(response.result, 16));
```

---

## 相关文档

- [Monitor 架构文档](./monitor.md)
- [RPC Provider Templates](../../packages/monitor/src/rpc/config/provider-templates.ts)
- [Environment Variables Guide](../../packages/monitor/config/environment-variables.md)
- [Configuration Examples](../../packages/monitor/config/examples/)

---

## 更新日志

- **2025-09-30**: 初始版本
  - 添加完整的RPC配置指南
  - 包含环境变量自动发现功能
  - 支持自定义提供商配置
  - 添加故障排查指南