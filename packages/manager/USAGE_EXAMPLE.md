# Manager 使用示例

## 核心功能：从数据库构建 Processor 配置

Manager 的核心价值是提供数据库驱动的配置管理，让 Processor 从数据库读取配置而非硬编码的 YAML 文件。

## 使用流程

### 1. 初始化 Manager

```typescript
import { Pool } from 'pg';
import { ConfigurationManager } from '@payin/manager';

const db = new Pool({
  connectionString: 'postgresql://user:pass@host:5432/dbname'
});

const manager = new ConfigurationManager({ db });
```

### 2. 管理配置数据

```typescript
// 创建链配置
await manager.createChain({
  chain_id: 'ethereum-sepolia',
  protocol: 'evm',
  network: 'testnet',
  name: 'Ethereum Sepolia Testnet',
  is_enabled: true,
});

// 创建代币
await manager.createToken({
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  is_active: true,
});

// 创建代币-链映射
await manager.createTokenChain({
  symbol: 'USDC',
  chain_id: 'ethereum-sepolia',
  contract_address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  confirmations: 3,
});

// 创建 RPC 提供商配置
await manager.createRPCProvider({
  provider_name: 'alchemy',
  display_name: 'Alchemy',
  provider_type: 'commercial',
  is_active: true,
});

await manager.createRPCChainConfig({
  chain_id: 'ethereum-sepolia',
  provider_name: 'alchemy',
  priority: 1,
  timeout_ms: 5000,
  max_requests_per_second: 10,
});
```

### 3. 从数据库构建 Processor 配置

```typescript
// 🌟 核心功能：从数据库读取配置构建 Processor
const processorConfig = await manager.buildProcessorConfig({
  databaseUrl: 'postgresql://user:pass@host:5432/dbname',
  includeDisabled: false,  // 只包含启用的链和代币
});

// processorConfig 包含：
// - chains: 从 processor_chains 表读取
// - tokens: 从 processor_tokens 和 processor_token_chains 表读取
// - monitor.rpcConfig: 从 processor_rpc_providers 和 processor_rpc_chain_configs 表读取
```

### 4. 使用数据库配置创建 Processor

```typescript
import { Processor } from '@payin/processor';

// 使用从数据库构建的配置创建 Processor
const processor = await Processor.create({
  ...processorConfig,
  skipMonitorRecovery: true,
});

await processor.start();

// 现在 Processor 使用的是数据库配置！
const order = await processor.createOrder({
  orderReference: 'order-001',
  amount: '100.00',
  currency: 'USDC',
  chainId: 'ethereum-sepolia',
});
```

## 关键优势

### 1. 数据库驱动配置
- ✅ 配置存储在数据库中，易于管理和更新
- ✅ 支持运行时配置变更（无需重启）
- ✅ 配置历史和审计日志

### 2. 三层验证系统
- **Layer 0**: 系统保护（builtin 资源不可删除）
- **Layer 1**: 不可变字段（创建后不可修改）
- **Layer 2**: 有界字段（范围验证）
- **Layer 3**: 自由字段（完全可修改）

### 3. 引用完整性
- ✅ 自动检查外键引用
- ✅ 防止删除被引用的配置
- ✅ 确保配置一致性

## buildProcessorConfig() 返回格式

```typescript
interface ProcessorConfigFromDB {
  database?: {
    connectionString?: string;
  };
  chains?: {
    [chainId: string]: {
      protocol: string;
      name: string;
      network: 'mainnet' | 'testnet';
    };
  };
  tokens?: {
    [symbol: string]: {
      symbol: string;
      name: string;
      decimals: number;
      contracts: {
        [chainId: string]: string;  // 合约地址
      };
    };
  };
  monitor?: {
    rpcConfig?: {
      providers: {
        [providerName: string]: {
          apiKeys?: string[];
        };
      };
      chains?: {
        [chainId: string]: Array<{
          provider: string;
          priority: number;
          config?: {
            timeout?: number;
            maxRequestsPerSecond?: number;
          };
        }>;
      };
    };
  };
}
```

## 完整示例

参考测试文件：
- **基础功能测试**: `tests/manager-to-processor-integration.test.ts`
- **端到端流程测试**: `tests/manager-processor-payment-flow.test.ts`

端到端测试演示了：
1. Manager 初始化数据库配置
2. 使用 `buildProcessorConfig()` 从数据库读取配置
3. 用数据库配置创建 Processor
4. 执行完整的支付流程（真实区块链交易）
5. 验证 Order 和 Transfer 记录

## 注意事项

### 配置优先级

当同时存在 YAML 配置和数据库配置时：
- **推荐**: 只使用数据库配置，传入完整的 `processorConfig`
- Processor 会将提供的配置（数据库）与 YAML 配置合并
- 对于 `chains` 和 `tokens`，后传入的配置会覆盖前面的

### 字段兼容性

`processor_token_chains` 表使用 `token_id` 字段，但 API 也支持 `symbol`：
- 数据库返回: `token_id`
- API 参数: `symbol`
- `buildProcessorConfig()` 会自动处理两者的兼容性

### RPC API 密钥

- Manager 不存储 API 密钥（安全考虑）
- API 密钥应通过环境变量提供：
  - `RPC_ALCHEMY_KEY`
  - `RPC_INFURA_KEY`
  等
