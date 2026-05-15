# 数据库环境配置指南

## 概述

PayIn 系统支持三个独立的数据库环境：

| 环境 | 数据库提供商 | 用途 | 区块链网络 |
|------|-------------|------|-----------|
| **Local** | Supabase | 本地开发 | Testnet |
| **Test** | Railway PostgreSQL | 测试部署 | Testnet |
| **Production** | Railway PostgreSQL | 生产环境 | Mainnet |

## 环境配置

### Local 环境 - Supabase

**连接配置**：
```bash
# apps/api/.env
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/payin_test
NODE_ENV=development
```

**特点**：
- ✅ 使用 Supabase 托管数据库
- ✅ 支持 testnet 区块链网络
- ✅ 自动生成演示数据
- ✅ 支持快速重置（`npm run db:init:full`）

**数据库初始化**：
```bash
# 完整重置 + 演示数据
npm run db:init:full

# 仅演示数据
npm run db:init:demo
```

---

### Test 环境 - Railway PostgreSQL

**创建步骤**：

#### 1. 创建 Railway 项目和数据库
```bash
# 使用自动化脚本
./scripts/deployment/setup-railway-project.sh test

# 或手动创建
railway init --name payin-api-test
railway add --database postgres
```

#### 2. 配置环境变量
Railway 会自动创建 `DATABASE_URL` 环境变量，您需要额外设置：

```bash
# 通过 CLI
railway variables set NODE_ENV=test --service payin-api-test
railway variables set ALCHEMY_API_KEY=your_alchemy_key --service payin-api-test
railway variables set INFURA_API_KEY=your_infura_key --service payin-api-test
railway variables set TRONGRID_API_KEY=your_trongrid_key --service payin-api-test
railway variables set HELIUS_API_KEY=your_helius_key --service payin-api-test
railway variables set JWT_SECRET=$(openssl rand -base64 32) --service payin-api-test

# 或通过 Dashboard
# Railway Dashboard → payin-api-test → Variables
```

#### 3. 初始化数据库
```bash
# 获取数据库连接字符串
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)

# 初始化 + 演示数据
npm run db:init:demo
```

#### 4. 部署应用
```bash
./scripts/deployment/deploy-to-railway.sh test
```

**特点**：
- ✅ Railway 托管的 PostgreSQL
- ✅ 使用 testnet 区块链网络
- ✅ 自动生成演示数据
- ✅ 独立于 local 环境，便于测试部署流程

---

### Production 环境 - Railway PostgreSQL

**创建步骤**：

#### 1. 创建 Railway 项目和数据库
```bash
# 使用自动化脚本
./scripts/deployment/setup-railway-project.sh production

# 或手动创建
railway init --name payin-api-production
railway add --database postgres
```

#### 2. 配置环境变量（⚠️ 使用生产 Keys）
```bash
# 通过 Dashboard（推荐）
# Railway Dashboard → payin-api-production → Variables

NODE_ENV=production
DATABASE_URL=<自动生成>

# ⚠️ 以下需要使用生产级 API Keys
ALCHEMY_API_KEY=<YOUR_PRODUCTION_KEY>
INFURA_API_KEY=<YOUR_PRODUCTION_KEY>
TRONGRID_API_KEY=<YOUR_PRODUCTION_KEY>
HELIUS_API_KEY=<YOUR_PRODUCTION_KEY>

# 生成强 JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# 生产域名
BASE_URL=https://api.yourdomain.com
```

#### 3. 初始化数据库（⚠️ 无演示数据）
```bash
# 获取数据库连接字符串
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production

# 仅初始化 schema，不生成演示数据
npm run db:init
```

#### 4. 部署应用
```bash
./scripts/deployment/deploy-to-railway.sh production
```

**特点**：
- ✅ Railway 托管的 PostgreSQL
- ✅ 使用 mainnet 区块链网络（真实资产）
- ❌ **不生成**演示数据
- ✅ 独立的生产级 API Keys
- ✅ 独立的 JWT Secret

---

## Railway 数据库管理

### 自动配置

Railway 会自动：
1. ✅ 创建 PostgreSQL 实例
2. ✅ 生成 `DATABASE_URL` 环境变量
3. ✅ 配置到您的服务
4. ✅ 处理连接池和连接限制

### 手动检查

```bash
# 查看数据库 URL
railway variables get DATABASE_URL --service payin-api-test

# 连接到数据库
railway run psql --service payin-api-test

# 查看数据库状态
railway status --service payin-api-test
```

### 数据库备份

```bash
# 导出数据库
railway run pg_dump > backup.sql --service payin-api-test

# 导入数据库
railway run psql < backup.sql --service payin-api-test
```

---

## 常见场景

### 场景 1：本地开发
```bash
# 使用 Supabase 数据库
export DB_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/payin_test"
npm run db:init:demo
npm run dev
```

### 场景 2：首次创建 Test 环境
```bash
# 1. 创建项目和数据库
./scripts/deployment/setup-railway-project.sh test

# 2. 初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init:demo

# 3. 部署
./scripts/deployment/deploy-to-railway.sh test
```

### 场景 3：首次创建 Production 环境
```bash
# 1. 创建项目和数据库
./scripts/deployment/setup-railway-project.sh production

# 2. 在 Railway Dashboard 配置生产 API Keys

# 3. 初始化数据库（无演示数据）
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production
npm run db:init

# 4. 部署
./scripts/deployment/deploy-to-railway.sh production
```

### 场景 4：重置 Test 数据库
```bash
# 获取数据库连接
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)

# 强制重置 + 演示数据
npm run db:init:full
```

### 场景 5：Production Schema 更新
```bash
# ⚠️ 谨慎操作！建议先在 Test 环境验证

# 1. 在 Test 环境测试
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init:force  # 测试迁移脚本

# 2. 验证 Test 部署
./scripts/deployment/deploy-to-railway.sh test

# 3. 在 Production 执行（建议手动 SQL）
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production
# 手动执行 SQL 迁移，而不是 --force

# 4. 部署 Production
./scripts/deployment/deploy-to-railway.sh production
```

---

## 环境隔离检查清单

### Local 环境
- [ ] 使用 Supabase 数据库
- [ ] NODE_ENV=development
- [ ] 包含演示数据
- [ ] 使用测试网 API Keys

### Test 环境
- [ ] 使用 Railway PostgreSQL（独立实例）
- [ ] NODE_ENV=test
- [ ] 包含演示数据
- [ ] 使用测试网 API Keys
- [ ] 独立的 Railway 项目（payin-api-test）

### Production 环境
- [ ] 使用 Railway PostgreSQL（独立实例）
- [ ] NODE_ENV=production
- [ ] **不包含**演示数据
- [ ] 使用生产级 API Keys
- [ ] 独立的 Railway 项目（payin-api-production）
- [ ] 独立的 JWT_SECRET
- [ ] 配置生产域名

---

## 故障排查

### 问题 1：Railway 数据库连接失败

**检查**：
```bash
# 确认数据库是否已创建
railway services --service payin-api-test

# 检查 DATABASE_URL 是否存在
railway variables get DATABASE_URL --service payin-api-test

# 测试连接
railway run psql --service payin-api-test
```

**解决**：
```bash
# 如果数据库不存在，添加
railway add --database postgres
```

### 问题 2：数据库 Schema 不匹配

**检查**：
```bash
# 查看应用日志
railway logs --service payin-api-test

# 常见错误：relation "users" does not exist
```

**解决**：
```bash
# 重新初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init
```

### 问题 3：演示数据未生成

**检查**：
```bash
# 确认 NODE_ENV
railway variables get NODE_ENV --service payin-api-test
```

**解决**：
```bash
# 演示数据只在 development/test 环境生成
# Production 环境不会生成演示数据（安全保护）
```

---

## 最佳实践

1. **环境严格隔离**
   - 三个环境使用完全独立的数据库实例
   - 不要在生产数据库运行测试
   - 不要共享 DATABASE_URL

2. **API Keys 分离**
   - Local/Test 使用测试网 Keys
   - Production 使用生产级 Keys
   - 定期轮换 JWT_SECRET

3. **数据库备份**
   - 定期备份 Production 数据库
   - 测试备份恢复流程
   - 使用 Railway 的自动备份功能

4. **Schema 迁移**
   - 总是先在 Test 环境测试
   - Production 迁移谨慎使用 --force
   - 保留 SQL 迁移脚本

5. **演示数据管理**
   - Local/Test 环境可以随时重置
   - Production 永远不生成演示数据
   - 使用 `DEMO_DATA=false` 明确禁用

---

## 相关文档

- [数据库初始化指南](./database-initialization.md)
- [Railway 部署指南](./DEPLOYMENT_GUIDE.md)
- [快速参考手册](./QUICK_REFERENCE.md)

---

**最后更新**：2025-11-01
