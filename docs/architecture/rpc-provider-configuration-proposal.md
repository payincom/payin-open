# RPC Provider 配置架构提案

## 背景

当前 Monitor 的 RPC provider 配置存在以下限制：
- Provider templates 硬编码在代码中
- YAML 配置只能引用内置 providers
- 添加新 provider 需要修改代码

## 提案：混合配置方案

### 设计原则

1. **开箱即用**：常用 providers 内置，用户只需提供 API keys
2. **灵活扩展**：支持通过 YAML 添加自定义 providers
3. **渐进式复杂度**：简单场景简单配置，复杂场景支持高级定制

### 配置层级

```
代码传入的 providers（最高优先级）
    ↓ 覆盖
YAML customProviders（自定义 providers）
    ↓ 覆盖
内置 BUILTIN_PROVIDERS（常用 providers）
```

### 配置示例

#### 场景 1：简单用户（使用内置 providers）

```yaml
# config.yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura]  # 引用内置
```

**用户体验**：
- ✅ 只需提供 API keys
- ✅ 不需要了解 provider 的 URL 模板、认证方式
- ✅ 最简单的配置

#### 场景 2：企业用户（添加自定义 providers）

```yaml
# config.yaml
rpc:
  # 定义自定义 providers
  customProviders:
    my-enterprise-node:
      displayName: "My Enterprise Node"
      authType: header
      urlPattern: "https://rpc.mycompany.com/{network}"
      headerTemplate:
        Authorization: "Bearer {apiKey}"
      supportedNetworks: [ethereum-sepolia, ethereum-mainnet]
      defaultSettings:
        timeout: 2000
        weight: 500
        maxRequestsPerSecond: 100

    backup-node:
      displayName: "Backup Node"
      authType: none
      baseUrl: "https://backup.mycompany.com"
      supportedNetworks: [ethereum-sepolia]
      defaultSettings:
        timeout: 3000
        weight: 200
        maxRequestsPerSecond: 50

  chains:
    ethereum-sepolia:
      # 混合使用：自定义 + 内置
      preferredProviders: [my-enterprise-node, backup-node, alchemy]
      strategy: failover
```

**用户体验**：
- ✅ 添加私有节点
- ✅ 仍然可以使用内置 providers 作为 fallback
- ✅ 完全控制优先级

#### 场景 3：覆盖内置 providers

```yaml
# config.yaml
rpc:
  customProviders:
    # 覆盖内置 alchemy 配置
    alchemy:
      displayName: "Alchemy Custom"
      authType: url_path
      urlPattern: "https://custom-alchemy-url/{network}/{apiKey}"
      supportedNetworks: [ethereum-sepolia]
      defaultSettings:
        timeout: 10000  # 自定义超时
        weight: 150
```

**用户体验**：
- ✅ 可以修改内置 provider 的行为
- ✅ 适合特殊需求

#### 场景 4：Web 服务（代码配置）

```typescript
// 从数据库加载
const customProviders = await loadProvidersFromDB();

const processor = await Processor.create({
  monitor: {
    rpcConfig: {
      providers: {
        // 数据库中的 providers
        ...customProviders,
        // 也可以引用内置 providers（通过 rpcKeys）
      },
      chains: {...}
    }
  }
});
```

### 实现方案

#### 1. 修改 provider-templates.ts

```typescript
// src/rpc/config/provider-templates.ts

/**
 * Built-in provider templates
 * These are pre-configured providers that work out of the box
 */
export const BUILTIN_PROVIDERS: Record<string, Omit<ProviderTemplate, 'name'>> = {
  alchemy: {
    displayName: "Alchemy",
    authType: 'url_path',
    urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}",
    supportedNetworks: ["eth-mainnet", "eth-sepolia", "polygon-mainnet", "polygon-amoy"],
    defaultSettings: { timeout: 5000, weight: 100, maxRequestsPerSecond: 15 }
  },
  infura: {...},
  ankr: {...},
  // ... 其他内置 providers
};

/**
 * Get all provider templates (builtin + custom)
 */
export function mergeProviderTemplates(
  customProviders?: Record<string, Omit<ProviderTemplate, 'name'>>
): Record<string, ProviderTemplate> {
  const providers = { ...BUILTIN_PROVIDERS };

  // 合并自定义 providers（允许覆盖内置）
  if (customProviders) {
    Object.assign(providers, customProviders);
  }

  // 添加 name 字段
  return Object.entries(providers).reduce((acc, [name, template]) => {
    acc[name] = { name, ...template };
    return acc;
  }, {} as Record<string, ProviderTemplate>);
}
```

#### 2. 修改 ConfigFormat 接口

```typescript
// src/rpc/types/rpc-config.ts

export interface ConfigFormat {
  // 新增：自定义 providers
  customProviders?: Record<string, Omit<ProviderTemplate, 'name'>>;

  providers: Record<string, Omit<RPCProviderTemplate, 'name'>>;
  chains: Record<string, {...}>;
  settings: {...};
}
```

#### 3. 修改 config-loader.ts

```typescript
// src/rpc/config/config-loader.ts

private buildProviderTemplates(): void {
  this.availableProviders.clear();

  // 1. 加载内置 providers
  const providers = { ...BUILTIN_PROVIDERS };

  // 2. 合并 YAML 中的自定义 providers
  if (this.config.customProviders) {
    Object.assign(providers, this.config.customProviders);
  }

  // 3. 合并代码传入的 providers（最高优先级）
  if (this.config.providers) {
    Object.assign(providers, this.config.providers);
  }

  // 4. 转换为 ProviderTemplate
  for (const [name, template] of Object.entries(providers)) {
    this.availableProviders.set(name, { name, ...template });
  }
}
```

#### 4. 更新 YAML 配置示例

```yaml
# config/examples/custom-providers.yaml

# RPC Provider Configuration with Custom Providers
rpc:
  # Define custom providers (optional)
  customProviders:
    my-enterprise-rpc:
      displayName: "My Enterprise RPC"
      authType: header
      urlPattern: "https://rpc.mycompany.com/{network}"
      headerTemplate:
        Authorization: "Bearer {apiKey}"
      supportedNetworks: [ethereum-sepolia, ethereum-mainnet]
      defaultSettings:
        timeout: 2000
        weight: 500
        maxRequestsPerSecond: 100

    public-backup:
      displayName: "Public Backup"
      authType: none
      baseUrl: "https://eth-rpc.publicnode.com"
      supportedNetworks: [ethereum-mainnet]
      defaultSettings:
        timeout: 8000
        weight: 50
        maxRequestsPerSecond: 3

  # Chain configurations
  chains:
    ethereum-sepolia:
      # Mix custom and built-in providers
      preferredProviders: [my-enterprise-rpc, alchemy, infura]
      strategy: failover

    ethereum-mainnet:
      # Use only custom providers
      preferredProviders: [my-enterprise-rpc, public-backup]
      strategy: round_robin
```

### 迁移路径

#### Phase 1: 添加 customProviders 支持
- ✅ 修改 ConfigFormat 接口
- ✅ 修改 config-loader 合并逻辑
- ✅ 添加 YAML 配置示例
- ✅ 更新文档

#### Phase 2: 测试和验证
- ✅ 单元测试
- ✅ 集成测试
- ✅ 文档更新

#### Phase 3: 发布
- ✅ 发布新版本
- ✅ 更新示例
- ✅ 用户迁移指南

### 优势

1. **向后兼容**：
   - 现有配置无需修改
   - 现有代码无需修改

2. **渐进式采用**：
   - 用户可以继续使用内置 providers
   - 需要时再添加自定义 providers

3. **灵活性**：
   - 支持完全自定义
   - 支持覆盖内置 providers
   - 支持混合使用

4. **简单性**：
   - 90% 的用户只需简单配置
   - 10% 的用户可以深度定制

### 示例对比

#### 之前（硬编码）
```typescript
// 添加新 provider 需要修改代码
// provider-templates.ts
export const RPC_PROVIDERS = {
  alchemy: {...},
  mynewprovider: {...}  // ❌ 需要修改代码
}
```

#### 之后（YAML 配置）
```yaml
# config.yaml
rpc:
  customProviders:
    mynewprovider: {...}  # ✅ 只需修改配置
```

## 总结

这个方案：
- ✅ 保持简单性（内置常用 providers）
- ✅ 提供灵活性（支持自定义 providers）
- ✅ 向后兼容（现有配置无需修改）
- ✅ 适合不同场景（个人、企业、Web 服务）

建议采用此方案实现完全 YAML 配置的支持。