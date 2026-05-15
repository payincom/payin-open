# Processor 数据库自动初始化功能

## 概述

Processor 现在支持基于环境的数据库自动初始化。这个功能让开发更简单，同时保持生产环境的安全性。

## 行为说明

### 开发环境 (NODE_ENV=development)

**默认行为**: 自动初始化数据库
- **删除**所有现有表
- **创建**所有需要的表
- 每次 Processor 启动时都会执行

**覆盖**: 设置 `INIT_DB=false` 跳过自动初始化

### 生产环境 (NODE_ENV=production)

**默认行为**: 跳过自动初始化
- 假设数据库已经正确设置
- 不会自动修改数据库结构

**覆盖**: 设置 `INIT_DB=true` 强制初始化（谨慎使用）

## 环境变量

### NODE_ENV
- `development` (默认): 启用自动初始化
- `production`: 禁用自动初始化

### INIT_DB
显式控制数据库初始化：
- `true`: 无论 NODE_ENV 如何，都强制初始化
- `false`: 无论 NODE_ENV 如何，都跳过初始化
- `undefined`: 使用基于 NODE_ENV 的默认行为

## 使用示例

### 开发环境（默认行为）
```bash
# 启动时自动初始化数据库
npm run dev
```

### 开发环境（跳过初始化）
```bash
# 在开发环境中跳过自动初始化
INIT_DB=false npm run dev
```

### 生产环境（默认行为）
```bash
# 不会自动初始化
NODE_ENV=production npm start
```

### 生产环境（强制初始化）
```bash
# 在生产环境强制初始化（谨慎使用！）
NODE_ENV=production INIT_DB=true npm start
```

## 初始化内容

自动初始化运行时会：

### 开发环境
1. **删除表**: Drop 所有现有的 Processor 表
2. **创建表**: 创建所有需要的表：
   - `orders` - 订单数据
   - `transfers` - 转账记录
   - `address_pool` - 地址池
   - `user_addresses` - 用户地址绑定
   - `chain_blocks` - 链区块记录

### 生产环境（如果启用）
1. **只创建缺失的表**（不删除现有表）
2. **升级现有表**（添加缺失的列）

## 安全特性

- **生产保护**: 生产环境默认关闭自动初始化
- **显式覆盖**: 需要 `INIT_DB=true` 才能在生产环境强制初始化
- **事务安全**: 所有数据库结构变更在事务中执行
- **错误处理**: 如果初始化失败，启动会失败

## 与测试集成

集成测试可以控制初始化行为：

```typescript
// 测试前强制清空数据库
process.env.NODE_ENV = 'development';
process.env.INIT_DB = 'true';
const processor = await Processor.create(config);

// 跳过初始化（使用现有数据库）
process.env.INIT_DB = 'false';
const processor = await Processor.create(config);
```

## 日志输出

### 自动初始化启用时

```
✅ Database initialized
🔧 Auto-initializing database schema (development mode)...
   dropExisting: true
   onlyMissing: false
✅ Database schema auto-initialized
   createdTables: 5
   upgradedTables: 0
```

### 自动初始化跳过时

```
⏭️  Skipping database auto-initialization (production mode or INIT_DB=false)
```

## 手动数据库管理

你仍然可以手动管理数据库初始化：

```typescript
const processor = await Processor.create(config);

// 检查数据库结构
const status = await processor.checkDatabaseSchema();
console.log('缺失的表:', status.missingTables);

// 手动初始化
const result = await processor.initializeDatabaseSchema({
  dropExisting: true,
  force: true
});
```

## 与 Manager 配合使用

在完整的系统中：

1. **Manager 管理**:
   - `config_metadata` - 配置元数据
   - `system_settings` - 业务设置
   - `system_settings_history` - 设置历史

2. **Processor 自动初始化**:
   - `orders` - 订单表
   - `transfers` - 转账表
   - `address_pool` - 地址池
   - `user_addresses` - 用户地址
   - `chain_blocks` - 链区块

这样开发环境可以完全自动化，生产环境保持安全。

## 常见问题

### Q: 为什么开发环境每次都删除所有表？
A: 这确保每次启动都从干净的状态开始，避免测试数据污染，让开发更可预测。

### Q: 如果我想在开发环境保留数据怎么办？
A: 设置 `INIT_DB=false` 跳过自动初始化。

### Q: 生产环境可以使用这个功能吗？
A: 可以，但需要显式设置 `INIT_DB=true`。强烈建议只在初次部署时使用，之后应该通过数据库迁移脚本管理结构变更。

### Q: 如何在 CI/CD 中使用？
A: CI/CD 环境通常应该像开发环境一样配置（NODE_ENV=development），让每次测试都从干净的数据库开始。
