# 数据库初始化指南

## 职责划分

### Processor - 结构初始化

**职责**：
- ✅ 创建数据库表结构（schema）
- ✅ 检查数据库完整性
- ❌ **不**填充配置数据

**方法**：
```typescript
// 检查数据库结构
await processor.checkDatabaseSchema();

// 初始化数据库结构（仅创建表）
await processor.initializeDatabaseSchema({
  dropExisting: false,
  onlyMissing: true,
  force: true
});
```

### Manager - 完整初始化

**职责**：
- ✅ 创建数据库表结构（schema）
- ✅ 填充配置默认值（chains, tokens, RPC providers）
- ✅ 初始化业务设置（orders, deposits 参数）
- ✅ 检查数据库完整性

**方法**：
```typescript
// 检查数据库结构
await manager.checkDatabaseSchema();

// 完整初始化（结构 + 配置数据）
await manager.initialize();
```

## API 对比

### 检查数据库结构

两者接口完全一致：

```typescript
// Processor
const status = await processor.checkDatabaseSchema();

// Manager
const status = await manager.checkDatabaseSchema();

// 返回结果相同
{
  isComplete: boolean;
  missingTables: string[];
  existingTables: string[];
  requiredTables: string[];
}
```

### 初始化数据库

#### Processor - 仅创建结构

```typescript
const result = await processor.initializeDatabaseSchema({
  dropExisting: false,  // 不删除现有表（推荐）
  onlyMissing: true,    // 只创建缺失的表
  force: true           // 强制执行
});

// 结果
{
  success: true,
  errors: [],
  warnings: ['Note: Schema initialized successfully. Use Manager to populate configuration defaults.'],
  createdTables: ['orders', 'transfers', ...],
  upgradedTables: [],
  seedDataResults: [],
  summary: '✅ Schema initialized: 8 tables created, 0 tables upgraded'
}
```

#### Manager - 完整初始化

```typescript
await manager.initialize();

// 执行步骤：
// 1. 检查数据库结构
// 2. 创建缺失的表（包括 Processor 表 + Manager 表）
// 3. 从 Processor.getDefaults() 加载配置
// 4. 初始化业务设置

// 日志输出示例：
// 🔍 Checking database schema...
// 📊 Schema incomplete. Missing tables: processor_chains, processor_tokens, ...
// 🏗️  Creating database schema...
// 📦 Populating configuration defaults from Processor...
// ⚙️  Initializing business settings...
// ✅ Manager initialization completed successfully!
```

## 使用场景

### 场景 1: 新部署（推荐）

使用 Manager 自动初始化：

```typescript
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/production.yaml',
  autoInit: true  // 自动初始化
});

await manager.initialize();
// ✅ 数据库结构已创建
// ✅ 配置默认值已填充
// ✅ 业务设置已初始化
```

### 场景 2: 只需要业务逻辑（Processor）

如果配置已经由其他方式管理，只需要 Processor：

```typescript
const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  }
});

// 检查数据库
const schema = await processor.checkDatabaseSchema();
if (!schema.isComplete) {
  // 初始化结构
  await processor.initializeDatabaseSchema({ force: true });
}

// 注意：需要手动填充配置数据或使用 Manager
```

### 场景 3: 生产环境手动控制

分步骤执行，更安全：

```typescript
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/production.yaml',
  autoInit: false  // 禁用自动初始化
});

// 1. 检查状态
const schema = await manager.checkDatabaseSchema();

if (!schema.isComplete) {
  console.log('Missing tables:', schema.missingTables);

  // 2. 管理员确认
  const confirmed = await askUserConfirmation();

  if (confirmed) {
    // 3. 创建表结构
    await manager.createTables(schema.missingTables);

    // 4. 填充配置
    await manager.initializeDefaults();

    // 5. 初始化业务设置
    await manager.initializeDefaultSystemSettings();
  }
}
```

### 场景 4: 分离部署

先用 Processor 创建结构，再用 Manager 填充配置：

```typescript
// 步骤 1: Processor 创建表结构
const processor = await Processor.create({
  database: { connectionString: process.env.DATABASE_URL }
});
await processor.initializeDatabaseSchema({ force: true });
await processor.stop();

// 步骤 2: Manager 填充配置
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/production.yaml'
});
await manager.initializeDefaults();
await manager.initializeDefaultSystemSettings();
await manager.close();
```

## 数据库表分类

### Processor 表（业务数据）
- `address_pool` - 地址池
- `orders` - 订单
- `transfers` - 转账记录
- `deposits` - 充值记录
- `chain_blocks` - 区块链扫描状态
- `address_logs` - 地址操作日志

### Manager 表（配置数据）
- `processor_chains` - 链配置
- `processor_tokens` - 代币配置
- `processor_token_chains` - 代币-链映射
- `processor_rpc_providers` - RPC 提供商
- `processor_rpc_chain_configs` - RPC 链配置
- `processor_configs` - 运营配置（已废弃）
- `processor_config_history` - 配置变更历史
- `config_values` - 业务设置
- `config_history` - 业务设置历史

## 配置数据来源

### Processor.getDefaults()

Manager 从 Processor 的 YAML 配置文件中读取默认值：

```yaml
# config/default.yaml
chains:
  ethereum-sepolia:
    protocol: evm
    name: Ethereum Sepolia Testnet
    network: testnet
  polygon-amoy:
    protocol: evm
    name: Polygon Amoy Testnet
    network: testnet

tokens:
  USDC:
    symbol: USDC
    name: USD Coin
    decimals: 6
    contracts:
      ethereum-sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
      polygon-amoy: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
```

### 业务设置默认值

Manager 自动初始化的业务配置：

```typescript
const defaults = [
  {
    key: 'orders.payment_window_minutes',
    value: 10,
    category: 'business_rules',
    description: '订单默认支付窗口时间（分钟）'
  },
  {
    key: 'orders.grace_period_minutes',
    value: 5,
    category: 'business_rules',
    description: '订单支付宽限期（分钟）'
  },
  {
    key: 'deposits.pool_management.cooldown_minutes',
    value: 30,
    category: 'address_management',
    description: '地址释放后冷却时间（分钟）'
  }
];
```

## 最佳实践

### ✅ 推荐做法

1. **新部署使用 Manager**
   ```typescript
   const manager = new ConfigurationManager({
     connectionString: process.env.DATABASE_URL,
     autoInit: true
   });
   await manager.initialize();
   ```

2. **生产环境手动确认**
   ```typescript
   const manager = new ConfigurationManager({
     connectionString: process.env.DATABASE_URL,
     autoInit: false
   });

   const schema = await manager.checkDatabaseSchema();
   if (!schema.isComplete) {
     // 显示缺失的表，要求管理员确认
     await confirmAndInitialize(manager, schema);
   }
   ```

3. **定期检查数据库状态**
   ```typescript
   // 应用启动时检查
   const status = await manager.checkDatabaseSchema();
   if (!status.isComplete) {
     throw new Error('Database schema incomplete!');
   }
   ```

### ❌ 不推荐做法

1. **使用 Processor 初始化配置**
   ```typescript
   // ❌ 错误：Processor 不会填充配置数据
   await processor.initializeDatabaseSchema();
   // 结果：表已创建，但没有配置数据
   ```

2. **忘记检查数据库状态**
   ```typescript
   // ❌ 错误：直接启动可能失败
   await processor.start();  // 如果表不存在会失败
   ```

3. **生产环境使用 dropExisting**
   ```typescript
   // ❌ 危险：会删除所有数据！
   await processor.initializeDatabaseSchema({
     dropExisting: true,
     force: true
   });
   ```

## 故障排查

### 问题 1: "表不存在"错误

```
Error: relation "orders" does not exist
```

**原因**: 数据库结构未初始化

**解决**:
```typescript
await manager.initialize();
// 或
await processor.initializeDatabaseSchema({ force: true });
```

### 问题 2: "配置数据为空"

```
Error: No chains configured
```

**原因**: 使用了 Processor 初始化，但未填充配置

**解决**:
```typescript
await manager.initializeDefaults();
await manager.initializeDefaultSystemSettings();
```

### 问题 3: "部分表缺失"

**检查**:
```typescript
const status = await manager.checkDatabaseSchema();
console.log('Missing:', status.missingTables);
```

**解决**:
```typescript
await manager.createTables(status.missingTables);
```

## 总结

| 场景 | 使用工具 | 方法 | 结果 |
|------|---------|------|------|
| 新部署 | Manager | `initialize()` | 结构 + 配置 |
| 只需结构 | Processor | `initializeDatabaseSchema()` | 仅结构 |
| 生产部署 | Manager | `checkDatabaseSchema()` + 手动确认 | 可控初始化 |
| 状态检查 | 两者均可 | `checkDatabaseSchema()` | 状态报告 |

**推荐**: 大多数情况下使用 Manager，因为它提供完整的初始化功能。
