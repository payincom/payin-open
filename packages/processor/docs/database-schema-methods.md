# Payment模块数据库管理方法

## 概述

Payment模块新增了两个重要的数据库管理方法，用于检查和初始化数据库表结构。这些方法提供了完整的数据库完整性验证和自动化初始化功能。

## 新增方法

### 1. `checkDatabaseSchema()` - 数据库模式检查

**功能**: 检查数据库表和其数据结构是否正确和完备

**返回值**:
```typescript
{
  isValid: boolean;                    // 整体模式有效性
  errors: string[];                    // 严重错误列表
  warnings: string[];                  // 警告信息列表
  missingTables: string[];             // 缺失的表
  missingColumns: Array<{              // 缺失的列
    table: string;
    columns: string[];
  }>;
  missingIndexes: Array<{              // 缺失的索引
    table: string;
    indexes: string[];
  }>;
  tablesInfo: Array<{                  // 详细表信息
    name: string;
    exists: boolean;
    rowCount: number;
    columns: string[];
    indexes: string[];
  }>;
  summary: string;                     // 检查结果摘要
}
```

**检查内容**:
- **表存在性**: 验证所有必需的表是否存在
- **列完整性**: 检查每个表的必需列是否存在
- **索引优化**: 验证关键索引是否创建
- **数据统计**: 统计每个表的记录数量
- **结构完整性**: 验证表结构是否符合最新的模式定义

**支持的表结构**:
- `orders` - 订单表 (19个必需列, 2个必需索引)
- `address_pool` - 统一地址池表 (11个必需列, 4个必需索引)
- `transfers` - 交易记录表 (13个必需列, 2个必需索引)
- `address_logs` - 地址使用日志表

### 2. `initializeDatabaseSchema(options)` - 数据库模式初始化

**功能**: 初始化或重建数据库表结构

**参数**:
```typescript
{
  dropExisting?: boolean;      // 是否删除现有表后重建 (默认: false)
  onlyMissing?: boolean;       // 只创建缺失的表 (默认: true)
  seedData?: boolean;          // 是否填充种子数据 (默认: false)
  force?: boolean;             // 强制执行，跳过确认 (默认: false)
}
```

**返回值**:
```typescript
{
  success: boolean;                           // 操作成功状态
  errors: string[];                           // 错误信息
  warnings: string[];                         // 警告信息
  createdTables: string[];                    // 新创建的表
  upgradedTables: string[];                   // 升级的表
  seedDataResults: Array<{                    // 种子数据结果
    table: string;
    inserted: number;
  }>;
  summary: string;                            // 操作结果摘要
}
```

**执行流程**:
1. **安全检查**: 验证参数安全性
2. **事务开始**: 开启原子操作事务
3. **表删除**: 如果设置`dropExisting=true`，按依赖顺序删除表
4. **表创建**: 按依赖顺序创建缺失的表
5. **表升级**: 升级现有表结构到最新版本
6. **种子数据**: 如果启用，填充初始数据
7. **事务提交**: 提交所有更改

## 使用示例

### 基础健康检查
```typescript
import { PostgreSQLDatabase } from '@payin/payment';

const db = new PostgreSQLDatabase(connectionString);
await db.initialize();

// 检查数据库模式
const checkResult = await db.checkDatabaseSchema();

if (checkResult.isValid) {
  console.log('✅ Database schema is healthy');
} else {
  console.log('⚠️ Database schema needs attention:');
  checkResult.errors.forEach(error => console.log(`  • ${error}`));
}
```

### 自动修复缺失组件
```typescript
// 只创建缺失的表和升级现有表
const initResult = await db.initializeDatabaseSchema({
  onlyMissing: true,    // 只处理缺失的组件
  seedData: false,      // 不填充种子数据
  force: false          // 安全模式
});

if (initResult.success) {
  console.log(`✅ Schema updated: ${initResult.createdTables.length} created, ${initResult.upgradedTables.length} upgraded`);
}
```

### 开发环境重置 (⚠️ 危险操作)
```typescript
// 完全重建数据库结构 - 仅用于开发环境!
const resetResult = await db.initializeDatabaseSchema({
  dropExisting: true,   // 删除所有现有表
  onlyMissing: false,   // 重建所有表
  seedData: true,       // 填充种子数据
  force: true           // 强制执行
});
```

### 应用启动时的健康检查
```typescript
async function startupHealthCheck() {
  const db = new PostgreSQLDatabase(connectionString);
  await db.initialize();
  
  const check = await db.checkDatabaseSchema();
  if (!check.isValid) {
    console.error('Database schema issues detected:', check.errors);
    
    // 自动修复
    const fix = await db.initializeDatabaseSchema({ onlyMissing: true });
    if (!fix.success) {
      console.error('Failed to fix database schema');
      process.exit(1);
    }
  }
  
  console.log('✅ Database schema is healthy');
}
```

## 安全特性

### 1. 事务安全
- 所有初始化操作在事务中执行
- 失败时自动回滚，保证数据一致性
- 不会造成部分完成的破坏性状态

### 2. 依赖关系管理
- 自动处理表的依赖关系
- 按正确顺序创建和删除表
- 避免外键约束冲突

### 3. 安全确认机制
- 危险操作需要 `force=true` 确认
- `dropExisting=true` 必须与 `force=true` 配合使用
- 防止意外的破坏性操作

### 4. 兼容性保护
- 支持渐进式升级，不影响现有数据
- 自动处理新增列和索引
- 向后兼容旧版本结构

## 监控和日志

### 日志输出示例
```
🔍 Checking Payment module database schema...
✅ Payment module database schema is valid. 5 tables checked, 2 warnings.
🟡 Warnings:
   • Table 'address_pool' missing indexes: idx_address_pool_cooldown

📊 Schema Check Results:
   Valid: true
   Errors: 0
   Warnings: 1
   Missing Tables: 0
   Missing Columns: 0

📋 Tables Information:
   ✅ orders: 35 rows, 19 columns, 2 indexes
   ✅ address_pool: 77 rows, 11 columns, 4 indexes
   ✅ transfers: 19 rows, 13 columns, 2 indexes
   ✅ address_logs: 25 rows, 6 columns, 1 indexes
```

### 性能监控
- 自动记录慢查询 (>100ms)
- 显示操作执行时间
- 提供详细的操作统计信息

## 最佳实践

### 1. 生产环境部署
```typescript
// 生产环境安全检查流程
async function productionDeploy() {
  // 1. 只检查，不修改
  const preCheck = await db.checkDatabaseSchema();
  console.log('Pre-deployment schema status:', preCheck.summary);
  
  // 2. 如果有问题，只升级不删除
  if (!preCheck.isValid) {
    const upgrade = await db.initializeDatabaseSchema({
      onlyMissing: true,
      dropExisting: false,  // 绝不删除生产数据
      seedData: false,      // 生产环境不要种子数据
      force: false
    });
    
    if (!upgrade.success) {
      throw new Error('Failed to upgrade schema safely');
    }
  }
  
  // 3. 验证升级结果
  const postCheck = await db.checkDatabaseSchema();
  if (!postCheck.isValid) {
    throw new Error('Schema still invalid after upgrade');
  }
}
```

### 2. 开发环境快速重置
```typescript
// 开发环境快速重置 (仅限开发!)
async function devReset() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Never run this in production!');
  }
  
  await db.initializeDatabaseSchema({
    dropExisting: true,
    force: true,
    seedData: true
  });
  
  console.log('🔄 Development database reset completed');
}
```

### 3. CI/CD集成
```typescript
// 持续集成中的数据库验证
async function ciDatabaseTest() {
  const check = await db.checkDatabaseSchema();
  
  // CI环境要求完美的模式
  if (!check.isValid || check.warnings.length > 0) {
    console.error('Database schema validation failed in CI');
    console.error('Errors:', check.errors);
    console.error('Warnings:', check.warnings);
    process.exit(1);
  }
  
  console.log('✅ Database schema validation passed');
}
```

## 测试覆盖

### 运行测试
```bash
# 运行数据库模式测试
npx tsx packages/payment/tests/database-schema-test.ts
```

### 测试内容
- ✅ 数据库连接建立
- ✅ 模式检查功能验证
- ✅ 表结构完整性验证  
- ✅ 索引存在性检查
- ✅ 模式初始化功能
- ✅ 事务安全性验证
- ✅ 错误处理和恢复

## 故障排查

### 常见问题

**Q: checkDatabaseSchema()报告缺失索引**
A: 这通常是警告而非错误。可以通过运行 `initializeDatabaseSchema({ onlyMissing: true })` 来创建缺失的索引。

**Q: initializeDatabaseSchema()事务失败**
A: 检查数据库连接、权限和磁盘空间。所有更改会自动回滚，数据安全。

**Q: 升级后仍有模式问题**
A: 某些复杂的结构变更可能需要手动干预。检查日志中的具体错误信息。

**Q: 生产环境安全性**
A: 绝不在生产环境使用 `dropExisting: true`。始终先在测试环境验证升级脚本。

## 架构设计

### 代码复用和单一数据源原则

两个新方法遵循良好的软件工程实践：

#### 🎯 **单一数据源 (Single Source of Truth)**
```typescript
// Schema定义的单一数据源
private getExpectedTables() {
  return {
    'orders': {
      requiredColumns: [...],
      requiredIndexes: [...]
    },
    // ... 其他表定义
  };
}
```

#### 🔄 **代码复用 (Code Reuse)**  
- ✅ `checkDatabaseSchema()` 使用 `getExpectedTables()` 获取schema定义
- ✅ `initializeDatabaseSchema()` 复用现有的 `createMissingTables()` 和 `upgradeExistingTables()` 方法
- ✅ 避免了schema定义的重复，确保一致性

#### 🏗️ **架构层次**
```
数据库管理架构
├── getExpectedTables() - Schema定义单一数据源
├── createTables() - 原有初始化逻辑 (database.ts:139)
├── createMissingTables() - 表创建实现 (database.ts:219)
├── upgradeExistingTables() - 表升级实现 (database.ts:170) 
├── checkDatabaseSchema() - 新增：复用getExpectedTables()
└── initializeDatabaseSchema() - 新增：复用create/upgrade方法
```

## 更新日志

**v1.1.0 (2025-09-12) - 架构优化版**
- 🔧 重构代码架构，保持schema定义的唯一性
- ✨ `checkDatabaseSchema()` 复用现有的表结构检查逻辑
- ✨ `initializeDatabaseSchema()` 复用现有的 `createMissingTables()` 和 `upgradeExistingTables()` 方法
- 🎯 新增 `getExpectedTables()` 私有方法作为schema定义的单一数据源
- ♻️ 消除了重复的schema定义，提高代码可维护性
- ✅ 保持所有现有功能不变，向后兼容

**v1.0.0 (2025-09-12)**
- ✨ 新增 `checkDatabaseSchema()` 方法
- ✨ 新增 `initializeDatabaseSchema()` 方法
- ✅ 支持完整的Payment模块表结构检查
- ✅ 支持事务安全的模式初始化
- ✅ 包含完整的测试覆盖
- 📚 提供详细的使用文档和示例