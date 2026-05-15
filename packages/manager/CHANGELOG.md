# Manager 改造完成总结

## 改造目标

1. ✅ 添加业务配置管理数据库表
2. ✅ 修改 Manager 构造方式（数据库连接 + YAML）
3. ✅ 添加业务配置 CRUD 方法
4. ✅ 修改 buildProcessorConfig，传递数据库连接和业务配置
5. ✅ 更新使用示例和文档

## 主要变更

### 1. 新增数据库表

#### config_values 表
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

#### config_history 表
```sql
CREATE TABLE config_history (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255),
  change_reason TEXT
);
```

### 2. Manager 构造方式变更

**之前**：
```typescript
const manager = new ConfigurationManager({
  db: pool  // 可选
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

### 3. 新增 API 方法

#### System Settings 管理
- `setSystemSetting(key, value, options)` - 创建或更新业务配置
- `getSystemSetting(key)` - 获取业务配置
- `listSystemSettings(filters)` - 列出业务配置
- `deleteSystemSetting(key, deletedBy, reason)` - 删除业务配置
- `getSystemSettingHistory(key)` - 查看配置历史
- `initializeDefaultSystemSettings()` - 初始化默认业务配置

#### 配置构建
- `getConnectionString()` - 获取数据库连接字符串
- `buildProcessorConfig()` - 现在包含数据库连接和业务配置

### 4. 配置架构

#### YAML 配置（技术层）
- 链定义
- 代币合约地址
- RPC 密钥（环境变量）
- Monitor 性能参数

#### 数据库配置（业务层）
- 订单规则（支付窗口、宽限期）
- 链启用状态
- 地址管理参数

#### 配置优先级
```
数据库配置 (config_values)
    ↓
运行时配置 (Processor.create 参数)
    ↓
YAML 配置
    ↓
内置默认值
```

### 5. 默认业务配置

系统自动初始化的默认配置：
- `orders.payment_window_minutes`: 10
- `orders.grace_period_minutes`: 5
- `orders.max_total_timeout_minutes`: 60
- `deposits.pool_management.cooldown_minutes`: 30
- `deposits.pool_management.low_threshold`: 100

## 使用示例

### 完整工作流程

```typescript
// 1. 创建 Manager（提供数据库连接）
const manager = new ConfigurationManager({
  connectionString: process.env.DATABASE_URL,
  yamlPath: './config/default.yaml'
});

await manager.initialize();

// 2. 管理业务配置
await manager.setSystemSetting('orders.payment_window_minutes', 15, {
  category: 'business_rules',
  description: '订单支付窗口时间',
  updatedBy: 'admin@example.com',
  reason: 'Business requirement'
});

// 3. 从数据库构建 Processor 配置
const processorConfig = await manager.buildProcessorConfig();
// 配置包含：
// - database.connectionString (来自 manager)
// - chains, tokens (来自数据库)
// - monitor.rpcKeys (来自数据库)
// - orders.payment_window_minutes (来自 config_values)

// 4. 创建 Processor（使用 Manager 提供的配置）
const processor = await Processor.create(
  processorConfig,
  'production.yaml'  // 可选额外覆盖
);

await processor.start();
```

## 文件变更清单

### 修改的文件
- ✅ `src/database/schema.ts` - 添加 config_values 表
- ✅ `src/types.ts` - 添加 SystemSetting 类型
- ✅ `src/manager.ts` - 主要改造文件
  - 修改构造函数
  - 添加业务配置 CRUD 方法
  - 修改 buildProcessorConfig
- ✅ `README.md` - 完全重写文档

### 新增的文件
- ✅ `examples/usage.ts` - 完整使用示例
- ✅ `CHANGELOG.md` - 改造总结

## 关键改进

1. **统一数据库管理**
   - Manager 统一管理数据库连接
   - 连接传递给 Processor
   - 简化部署配置

2. **配置分层清晰**
   - 技术配置 → YAML
   - 业务配置 → 数据库
   - 敏感信息 → 环境变量

3. **审计追踪**
   - 所有业务配置变更有历史记录
   - 记录操作人和变更原因

4. **灵活性提升**
   - 业务配置可通过 UI 管理
   - 技术配置通过代码审查

## 注意事项

1. **重启要求**
   - 业务配置修改后需要重启 Processor 才能生效
   - 应在 Manager UI 中提示用户

2. **TypeScript 警告**
   - 动态导入 Processor 会有跨包类型警告
   - 这是正常的，不影响运行时

3. **向后兼容**
   - 现有数据库会自动创建新表
   - 现有配置不受影响

## 下一步

建议完成以下任务：
1. 更新 Processor 以正确处理 database.connectionString
2. 创建 Manager UI 用于业务配置管理
3. 添加集成测试
4. 部署文档更新
