# Database Initialization Guide

本文档说明如何在不同环境中初始化 PayIn 数据库。

## 概述

从版本 v0.2.0 开始，PayIn 采用**独立初始化脚本**的架构设计：

- ✅ **清晰分离**：数据库初始化与应用运行时解耦
- ✅ **灵活部署**：可在部署前/后独立执行
- ✅ **环境隔离**：生产部署不依赖测试工具包
- ✅ **CI/CD 友好**：作为部署流程的一部分

## 快速开始

### 开发环境

```bash
# 1. 初始化数据库（仅创建表结构）
npm run db:init

# 2. 初始化数据库 + 生成演示数据
npm run db:init:demo

# 3. 强制重置数据库（删除所有数据）
npm run db:init:force

# 4. 完整重置 + 演示数据
npm run db:init:full
```

### 生产环境

```bash
# 设置数据库连接
export DB_CONNECTION_STRING="postgresql://user:pass@host:5432/payin"
export NODE_ENV="production"

# 初始化数据库（仅创建表结构，无演示数据）
npm run db:init

# 或使用 tsx 直接运行
tsx scripts/init-database.ts
```

## 脚本说明

### init-database.ts

独立的数据库初始化脚本，不依赖应用运行时。

**功能**：
- 初始化 Auth 模块 schema（users, sessions, audit_logs）
- 初始化 Manager 模块 schema（organizations, api_keys, config_values）
- 初始化 Processor 模块 schema（orders, deposits, transfers, address_pool）
- 可选生成演示数据（仅非生产环境）

**用法**：
```bash
tsx scripts/init-database.ts [options]
```

**选项**：
- `--demo-data` - 生成演示数据
- `--force` - 强制重置（删除现有表）
- `--help` - 显示帮助信息

**环境变量**：
- `DB_CONNECTION_STRING` - 数据库连接字符串（必需）
- `NODE_ENV` - 环境（development/test/production）

## 部署场景

### 场景 1：新项目部署

#### Railway / Render / Fly.io

```bash
# 1. 设置环境变量
export DB_CONNECTION_STRING="postgresql://..."
export NODE_ENV="production"

# 2. 构建应用
npm run build

# 3. 初始化数据库
npm run db:init

# 4. 启动应用
npm start
```

#### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

RUN npm ci --omit=dev
RUN npm run build

# 启动脚本
CMD ["sh", "-c", "npm run db:init && npm start"]
```

### 场景 2：本地开发环境

```bash
# 方式 1: 使用 npm 脚本（推荐）
npm run db:init:demo

# 方式 2: 使用 tsx 直接运行
tsx scripts/init-database.ts --demo-data

# 方式 3: 使用 INIT_DB 环境变量（已废弃）
# INIT_DB=true npm run dev  # ❌ 不再支持
```

### 场景 3: CI/CD 流程

#### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Initialize Database
        env:
          DB_CONNECTION_STRING: ${{ secrets.DB_CONNECTION_STRING }}
          NODE_ENV: production
        run: npm run db:init

      - name: Deploy
        run: npm run deploy
```

## 与旧版本的区别

### 旧版本（v0.1.x）- ❌ 已废弃

```typescript
// apps/api/src/index.ts
if (process.env.INIT_DB === 'true') {
  // 在应用启动时初始化数据库
  await initializeAuth();
  await initializeManager();
  await generateDemoData(); // 依赖 test-utils
}
```

**问题**：
- ❌ 应用运行时依赖 test-utils
- ❌ 生产部署需要打包测试工具
- ❌ 无法独立执行初始化
- ❌ 初始化逻辑分散在多个模块

### 新版本（v0.2.0+）- ✅ 推荐

```typescript
// scripts/init-database.ts
async function main() {
  await initializeAuthSchema();
  await initializeManagerSchema();
  await initializeProcessorSchema();
  if (demoData) await generateDemoData();
}
```

**优势**：
- ✅ 独立脚本，不污染应用运行时
- ✅ 生产部署不依赖 test-utils
- ✅ 可在部署前/后独立执行
- ✅ CI/CD 友好

## FAQ

### Q: 为什么要分离初始化逻辑？

**A**:
1. **生产安全**：生产环境不应依赖测试工具
2. **职责分离**：初始化是部署时操作，不是运行时操作
3. **灵活性**：可以在任何时候独立执行
4. **可维护性**：所有初始化逻辑集中在一个脚本

### Q: 我可以在生产环境生成演示数据吗？

**A**: 不可以。脚本会自动检测 `NODE_ENV=production` 并跳过演示数据生成。

### Q: 如何在现有数据库上运行初始化？

**A**: 默认情况下，脚本只会创建缺失的表，不会删除现有数据。如果需要完全重置，使用 `--force` 选项。

### Q: INIT_DB 环境变量还支持吗？

**A**: 从 v0.2.0 开始，`INIT_DB` 环境变量已废弃。请使用独立的初始化脚本。

### Q: 如何迁移到新的初始化方式？

**A**:
```bash
# 旧方式（废弃）
INIT_DB=true DEMO_DATA=true npm run dev

# 新方式
npm run db:init:demo && npm run dev
```

### Q: 能否在应用启动时自动初始化？

**A**: 不推荐。在生产环境中，数据库初始化应该是部署流程的一部分，而不是应用启动的一部分。这样可以：
- 避免应用启动时的延迟
- 防止多实例同时初始化导致的冲突
- 保持应用运行时的轻量级

## 最佳实践

### 1. 开发环境

```bash
# 首次设置
npm run db:init:demo

# 日常开发
npm run dev

# 重置数据库
npm run db:init:full
```

### 2. 生产环境

```bash
# 部署前
npm run build
npm run db:init

# 部署后
npm start
```

### 3. CI/CD

```bash
# 在 CI/CD 流水线中
npm run build
npm run db:init  # 作为部署步骤的一部分
npm run deploy
```

## 相关文档

- [Deployment Guide](./README.md) - 完整部署指南
- [Environment Configuration](./configuration-overview.md) - 环境配置说明
- [Database Schema](../../packages/processor/docs/database-schema-methods.md) - 数据库 Schema 文档

## 总结

| 场景 | 命令 | 说明 |
|------|------|------|
| **开发环境初始化** | `npm run db:init:demo` | 创建表 + 演示数据 |
| **开发环境重置** | `npm run db:init:full` | 强制重置 + 演示数据 |
| **生产环境初始化** | `npm run db:init` | 仅创建表结构 |
| **测试环境初始化** | `npm run db:init` | 仅创建表结构 |
| **CI/CD 部署** | `npm run db:init` | 作为部署步骤执行 |

---

**注意**：从 v0.2.0 开始，应用运行时不再自动初始化数据库。请在部署前使用独立脚本完成初始化。
