# @payin/manager

Configuration Management System for PayIn - 配置管理系统

## 概述

`@payin/manager` 是 PayIn 的配置管理模块，提供对技术配置和业务配置的统一管理。

### 核心特性

- ✅ **技术配置管理**：链、代币、RPC 提供商配置
- ✅ **业务配置管理**：订单规则、地址管理等运营参数
- ✅ **分层验证**：Layer 1 (不可变) / Layer 2 (有界) / Layer 3 (自由)
- ✅ **审计日志**：记录所有配置变更历史
- ✅ **数据库连接管理**：Manager 统一管理并传递给 Processor

## 新架构设计

### 构造方式变更

**之前**：
```typescript
const manager = new ConfigurationManager({
  db: pool,  // 可选
  yamlPath: './config/default.yaml'
});
```

**现在**：
```typescript
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,  // 必需
  yamlPath: './config/default.yaml',           // 可选
  autoInit: true
});
```

### 关键变更
1. ✅ **数据库连接必需** - Manager 现在要求显式提供数据库连接字符串
2. ✅ **Manager 管理连接** - Manager 自行管理数据库连接池
3. ✅ **连接传递给 Processor** - Manager 将数据库连接传递给 Processor（通过 buildProcessorConfig）

## 配置分层架构

### YAML 配置（技术/基础设施层）
存储在 `config/*.yaml` 文件中：
- 支持的链定义（chains）
- 代币合约地址（tokens）
- RPC 提供商密钥（monitor.rpcKeys，使用环境变量）
- Monitor 性能参数（blockRangeSize, scanInterval 等）
- 系统稳定性参数（限流、重试、错误处理）

### 数据库配置（业务运营层）
存储在 `config_values` 表中：

#### 业务规则 (business_rules)
- `orders.payment_window_minutes` - 订单支付窗口（分钟）
- `orders.grace_period_minutes` - 订单宽限期（分钟）
- `orders.max_total_timeout_minutes` - 订单最大超时（分钟）

#### 链管理 (chain_management)
- `chains.enabled` - 启用的链列表
- `monitor.chains` - Monitor 监控的链列表

#### 地址管理 (address_management)
- `deposits.pool_management.cooldown_minutes` - 地址冷却时间
- `deposits.pool_management.low_threshold` - 地址池告警阈值

### 配置优先级
```
数据库配置（config_values）
    ↓
运行时配置（Processor.create 参数）
    ↓
YAML 配置文件
    ↓
内置默认值
```

## 配置初始化策略（方案A：混合方式）

Manager 使用混合策略来初始化配置，确保与 Processor 的默认值保持一致：

### 配置元数据 (config_metadata)
- **来源**：Manager 内部定义 (`src/config/config-metadata.ts`)
- **内容**：UI 展示信息（displayName、description、validationRules、uiHints）
- **用途**：前端表单生成、配置验证、用户文档

### 配置值 (config_values)
- **来源**：Processor defaults (`@payin/processor/getDefaults()`)
- **映射逻辑**：
  - Manager 从 Processor 的 `default.yaml` 和 `defaults.ts` 提取配置值
  - 自动映射到 Manager 的配置键（如 `defaultPaymentWindowMinutes` → `orders.payment_window_minutes`）
- **好处**：
  - ✅ 单一数据源（Processor 的 YAML 配置）
  - ✅ 避免重复定义和不一致
  - ✅ Manager 和 Processor 配置自动同步

### 初始化流程
```typescript
// 1. Manager 定义 UI 元数据（displayName, description, etc）
const CONFIG_METADATA = [
  {
    key: 'orders.payment_window_minutes',
    displayName: 'Order Payment Window',
    description: '...',
    // ... UI hints
  }
];

// 2. Manager 从 Processor 提取默认值
const processorDefaults = await getDefaults();
// 提取: orders.defaultPaymentWindowMinutes = 10

// 3. 初始化 config_values 表
await setSystemSetting(
  'orders.payment_window_minutes',
  10  // ← 来自 Processor defaults
);
```

## 使用示例

### 数据库初始化

#### 自动初始化（推荐）

```typescript
import { ConfigurationManager } from '@payin/manager';

const manager = new ConfigurationManager({
  connectionString: 'postgresql://user:pass@host:5432/db',
  yamlPath: './config/production.yaml',
  autoInit: true  // 自动检查并初始化
});

// 自动完成：
// 1. 检查数据库结构
// 2. 创建缺失的表
// 3. 填充配置默认值（从 Processor.getDefaults）
// 4. 初始化业务设置
await manager.initialize();
```

#### 手动控制（生产环境推荐）

```typescript
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/production.yaml',
  autoInit: false  // 手动控制
});

// 1. 检查数据库状态
const schema = await manager.checkDatabaseSchema();

console.log('Database Status:');
console.log('- Is Complete:', schema.isComplete);
console.log('- Missing Tables:', schema.missingTables);

if (!schema.isComplete) {
  // 2. 显示缺失的表，等待管理员确认
  const confirmed = await askAdminConfirmation();

  if (confirmed) {
    // 3. 创建表结构
    await manager.createTables(schema.missingTables);

    // 4. 填充配置默认值
    await manager.initializeDefaults();

    // 5. 初始化业务设置
    await manager.initializeDefaultSystemSettings();
  }
}
```

#### 使用 Processor 初始化（仅结构）

```typescript
import { Processor } from '@payin/processor';

const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  }
});

// 检查数据库结构
const schema = await processor.checkDatabaseSchema();

if (!schema.isComplete) {
  // 只创建表结构，不填充数据
  await processor.initializeDatabaseSchema({
    dropExisting: false,
    onlyMissing: true,
    force: true
  });
}

// 注意：Processor 只创建结构，需要用 Manager 填充配置
```

### 管理业务配置

```typescript
// 设置业务配置
await manager.setSystemSetting('orders.payment_window_minutes', 15, {
  category: 'business_rules',
  description: '订单支付窗口时间（分钟）',
  updatedBy: 'admin@example.com',
  reason: 'Business requirement change'
});

// 查询配置
const setting = await manager.getSystemSetting('orders.payment_window_minutes');
console.log(setting.value); // 15

// 查看历史记录（审计）
const history = await manager.getSystemSettingHistory('orders.payment_window_minutes');
```

### 构建 Processor 配置

```typescript
// 从数据库构建完整配置
const config = await manager.buildProcessorConfig({
  includeDisabled: false
});

// 配置包含：
// - database.connectionString (来自 manager)
// - chains, tokens (来自数据库)
// - monitor.rpcKeys (来自数据库)
// - orders.payment_window_minutes (来自 config_values)
// - deposits.pool_management.* (来自 config_values)
```

### 创建 Processor

```typescript
import { Processor } from '@payin/processor';

// 使用 Manager 提供的配置创建 Processor
const processor = await Processor.create(
  config,
  'production.yaml'  // 可选：额外的 YAML 覆盖
);

await processor.start();
```

## 完整工作流程

```typescript
// 1. 创建 Manager
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/default.yaml'
});

await manager.initialize();

// 2. 管理业务配置（通过 UI）
await manager.setSystemSetting('orders.payment_window_minutes', 20, {
  category: 'business_rules',
  updatedBy: 'admin'
});

// 3. 构建 Processor 配置
const processorConfig = await manager.buildProcessorConfig();

// 4. 创建并启动 Processor
const processor = await Processor.create(processorConfig);
await processor.start();

// 5. Processor 使用相同的数据库连接
// - Manager 和 Processor 共享数据库
// - Processor 使用 Manager 提供的 connectionString
```

## API 文档

### 数据库初始化方法

#### `checkDatabaseSchema()`
检查数据库结构完整性

```typescript
const status = await manager.checkDatabaseSchema();
// 返回:
{
  isComplete: boolean;        // 是否完整
  missingTables: string[];    // 缺失的表
  existingTables: string[];   // 已存在的表
  requiredTables: string[];   // 需要的表
}
```

#### `initialize()`
完整初始化（结构 + 配置数据）

```typescript
await manager.initialize();
// 执行：
// 1. 检查数据库结构
// 2. 创建缺失的表
// 3. 填充配置默认值
// 4. 初始化业务设置
```

#### `createTables(tables)`
创建指定的表

```typescript
await manager.createTables(['processor_chains', 'processor_tokens']);
```

#### `initializeDefaults()`
填充配置默认值（从 Processor.getDefaults）

```typescript
await manager.initializeDefaults();
```

#### `initializeDefaultSystemSettings()`
初始化业务配置默认值

```typescript
await manager.initializeDefaultSystemSettings();
```

### System Settings 方法

#### `setSystemSetting(key, value, options)`
创建或更新业务配置

```typescript
await manager.setSystemSetting('orders.payment_window_minutes', 15, {
  category: 'business_rules',
  description: '订单支付窗口时间',
  updatedBy: 'admin@example.com',
  reason: 'Business requirement'
});
```

#### `getSystemSetting(key)`
获取业务配置

```typescript
const setting = await manager.getSystemSetting('orders.payment_window_minutes');
```

#### `listSystemSettings(filters?)`
列出业务配置

```typescript
const settings = await manager.listSystemSettings({
  category: 'business_rules'
});
```

#### `getSystemSettingHistory(key)`
查看配置变更历史

```typescript
const history = await manager.getSystemSettingHistory('orders.payment_window_minutes');
```

### 配置构建方法

#### `buildProcessorConfig(options?)`
从数据库构建 Processor 配置

```typescript
const config = await manager.buildProcessorConfig({
  includeDisabled: false  // 只包含启用的链/代币
});
```

#### `getConnectionString()`
获取数据库连接字符串（用于传递给 Processor）

```typescript
const connStr = manager.getConnectionString();
```

## 数据库 Schema

### 技术配置表
- `processor_chains` - 区块链网络配置
- `processor_tokens` - 代币配置
- `processor_token_chains` - 代币-链映射
- `processor_rpc_providers` - RPC 提供商
- `processor_rpc_chain_configs` - RPC 链级配置
- `processor_configs` - 运营参数配置（已废弃）
- `processor_config_history` - 配置变更历史

### 业务配置表（新增）
- `config_values` - 业务运营层配置
- `config_history` - 业务配置变更历史

#### config_values 表结构
```sql
CREATE TABLE config_values (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  editable_via_ui BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255)
);
```

## 迁移指南

### 从旧版本升级

1. **更新 Manager 构造**
   ```typescript
   // 旧版本
   const manager = new ConfigurationManager({ db: pool });

   // 新版本
   const manager = new ConfigurationManager({
     connectionString: process.env.DATABASE_URL
   });
   ```

2. **数据库会自动创建新表**
   - `config_values`
   - `config_history`

3. **默认配置会自动初始化**
   - 调用 `manager.initialize()` 会自动创建默认业务配置

## 最佳实践

1. **配置分离原则**
   - 技术配置（链、RPC）→ YAML + 环境变量
   - 业务配置（支付窗口、阈值）→ 数据库

2. **安全性**
   - 敏感信息（RPC 密钥）使用环境变量
   - 数据库密码使用环境变量

3. **审计**
   - 所有业务配置变更都有历史记录
   - 记录操作人和变更原因

4. **重启策略**
   - 业务配置修改后需要重启 Processor
   - 通过 Manager UI 提示用户重启

## 环境变量

```bash
# 数据库连接（必需）
DATABASE_URL=postgresql://user:pass@host:5432/db

# RPC 密钥（推荐）
ALCHEMY_API_KEY=your-key
INFURA_API_KEY=your-key
TRONGRID_API_KEY=your-key
ANKR_API_KEY=your-key
```

## License

MIT
