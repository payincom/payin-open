# Railway 部署快速参考手册

> 一页纸快速查阅所有部署命令和流程

---

## 🎯 核心概念

### 环境对比

| 项目 | Test 环境 | Production 环境 |
|------|----------|----------------|
| **Railway Service** | `payin-api-test` | `payin-api-production` |
| **NODE_ENV** | `test` | `production` |
| **区块链网络** | Testnet（Sepolia, Amoy） | Mainnet（Ethereum, Polygon） |
| **Processor 配置** | `testnet.yaml` | `mainnet.yaml` |
| **数据库** | 测试数据库 | 生产数据库 |
| **演示数据** | ✅ 生成 | ❌ 不生成 |

---

## 📋 部署场景速查

### 场景 1：创建全新 Test 项目

**方式 A：自动化脚本（推荐）**

```bash
# 1. 一键创建项目和数据库
./scripts/deployment/setup-railway-project.sh test

# 2. 初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init:demo

# 3. 部署
./scripts/deployment/deploy-to-railway.sh test

# 4. 验证
curl https://your-app.up.railway.app/health
```

**方式 B：手动创建**

```bash
# 1. 创建 Railway 项目和数据库
railway init --name payin-api-test
railway add --database postgres

# 2. 配置环境变量
railway variables set NODE_ENV=test --service payin-api-test
railway variables set ALCHEMY_API_KEY=your_alchemy_key --service payin-api-test
railway variables set INFURA_API_KEY=your_infura_key --service payin-api-test
railway variables set TRONGRID_API_KEY=your_trongrid_key --service payin-api-test
railway variables set HELIUS_API_KEY=your_helius_key --service payin-api-test
railway variables set JWT_SECRET=$(openssl rand -base64 32) --service payin-api-test

# 3. 初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init:demo

# 4. 部署
./scripts/deployment/deploy-to-railway.sh test

# 5. 验证
curl https://your-app.up.railway.app/health
```

**时间**：约 10-15 分钟（自动化） / 15-20 分钟（手动）

---

### 场景 2：创建全新 Production 项目

**方式 A：自动化脚本（推荐）**

```bash
# 1. 一键创建项目和数据库
./scripts/deployment/setup-railway-project.sh production

# 2. ⚠️ 在 Railway Dashboard 配置生产 API Keys
# - ALCHEMY_API_KEY（生产 Key）
# - INFURA_API_KEY（生产 Key）
# - TRONGRID_API_KEY（生产 Key）
# - HELIUS_API_KEY（生产 Key）
# - BASE_URL（生产域名）

# 3. 初始化数据库（仅 schema，无演示数据）
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production
npm run db:init

# 4. 部署
./scripts/deployment/deploy-to-railway.sh production

# 5. 验证
curl https://api.yourdomain.com/health
railway logs --service payin-api-production | grep "ethereum-mainnet"
```

**方式 B：手动创建**

```bash
# 1. 创建 Railway 项目和数据库
railway init --name payin-api-production
railway add --database postgres

# 2. 配置环境变量（⚠️ 使用生产 Keys）
railway variables set NODE_ENV=production --service payin-api-production
railway variables set JWT_SECRET=$(openssl rand -base64 32) --service payin-api-production
# 在 Dashboard 配置其他生产 Keys

# 3. 初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production
npm run db:init

# 4. 部署
./scripts/deployment/deploy-to-railway.sh production

# 5. 验证
curl https://api.yourdomain.com/health
railway logs --service payin-api-production | grep "ethereum-mainnet"
```

**时间**：约 15-20 分钟（自动化） / 20-30 分钟（手动）

---

### 场景 3：更新现有项目（日常）

```bash
# 快速更新流程
git pull
npm run dev           # 本地测试
./scripts/deployment/deploy-to-railway.sh test        # 部署到 Test
# 验证 Test 环境
./scripts/deployment/deploy-to-railway.sh production  # 部署到 Production
# 验证 Production 环境
```

**时间**：约 5-10 分钟

---

### 场景 4：仅更新环境变量（不重新部署）

```bash
# 单个变量
railway variables set KEY=VALUE --service payin-api-test

# 批量更新
./tools/import-railway-variables.sh .env.test

# 重启服务使变量生效
railway restart --service payin-api-test
```

**时间**：约 1-2 分钟

---

### 场景 5：数据库 Schema 变更

```bash
# 1. 在 Test 环境测试
export DB_CONNECTION_STRING="postgresql://[TEST_DB]"
npm run db:init:force  # ⚠️ 会删除所有数据

# 2. 验证 Test 环境
./scripts/deployment/deploy-to-railway.sh test

# 3. 在 Production 执行（谨慎）
export DB_CONNECTION_STRING="postgresql://[PROD_DB]"
export NODE_ENV="production"
# ⚠️ 建议手动执行 SQL 而不是使用 --force
npm run db:init

# 4. 部署 Production
./scripts/deployment/deploy-to-railway.sh production
```

**时间**：约 10-15 分钟

---

## 🛠️ 常用命令速查

### 数据库管理

```bash
# 初始化数据库（仅 schema）
npm run db:init

# 初始化 + 演示数据（仅开发/测试）
npm run db:init:demo

# 强制重置（⚠️ 删除所有数据）
npm run db:init:force

# 完整重置 + 演示数据
npm run db:init:full
```

### Railway 操作

```bash
# 查看日志
railway logs --service payin-api-test

# 实时日志
railway logs --service payin-api-test --follow

# 查看环境变量
railway variables --service payin-api-test

# 设置环境变量
railway variables set KEY=VALUE --service payin-api-test

# 查看服务状态
railway status --service payin-api-test

# 重启服务
railway restart --service payin-api-test

# 连接到容器
railway shell --service payin-api-test
```

### 本地构建

```bash
# 构建所有 packages + apps/api
npm run build

# 仅构建 packages
npm run build:packages

# 仅构建 apps/api
npm run build -w apps/api

# Railway 部署脚本（含构建）
./scripts/deployment/build-for-railway.sh
```

### Git 操作

```bash
# 提交 dist 目录（Railway 需要）
git add -f packages/*/dist apps/api/dist
git commit -m "build: update dist"
git push

# 查看未提交的变更
git status -s
```

---

## 🔍 故障排查速查

### 问题 1：部署失败 - 构建超时

**解决**：使用本地构建
```bash
./scripts/deployment/deploy-to-railway.sh test
```

### 问题 2：数据库连接失败

**检查**：
```bash
railway variables get DB_CONNECTION_STRING
# 确保使用 Supabase Pooler：pooler.supabase.com
```

### 问题 3：Monitor 报 401

**检查**：
```bash
railway variables | grep API_KEY
# 确认所有 RPC Keys 有效
```

### 问题 4：健康检查失败

**检查**：
```bash
railway logs | head -50
curl https://your-app.up.railway.app/health
```

### 问题 5：Schema 不匹配

**解决**：
```bash
export DB_CONNECTION_STRING="postgresql://..."
npm run db:init
```

---

## 🗄️ 数据库环境管理

### 三环境数据库配置

| 环境 | 数据库提供商 | 创建方式 | 演示数据 | 用途 |
|------|-------------|---------|---------|------|
| **Local** | Supabase | 手动配置 | ✅ 生成 | 本地开发 |
| **Test** | Railway PostgreSQL | `setup-railway-project.sh test` | ✅ 生成 | 测试部署 |
| **Production** | Railway PostgreSQL | `setup-railway-project.sh production` | ❌ 不生成 | 生产环境 |

### Railway 数据库自动配置

Railway 会在项目中**自动**：
- ✅ 创建 PostgreSQL 数据库实例
- ✅ 生成 `DATABASE_URL` 环境变量
- ✅ 配置连接池和限制
- ✅ 提供数据库管理界面

### 快速命令

```bash
# 查看数据库 URL
railway variables get DATABASE_URL --service payin-api-test

# 添加数据库到现有项目
railway add --database postgres

# 连接数据库
railway run psql --service payin-api-test

# 数据库备份
railway run pg_dump > backup.sql --service payin-api-test
```

---

## 📊 部署检查清单

### Test 环境部署前

- [ ] 环境变量已配置（Dashboard 或 CLI）
- [ ] 数据库已初始化（`npm run db:init:demo`）
- [ ] 本地测试通过（`npm run dev`）
- [ ] Railway 项目已创建

### Production 环境部署前

- [ ] 使用独立的 Railway 项目
- [ ] 使用独立的生产数据库
- [ ] 使用生产级 RPC Keys
- [ ] 使用不同的 JWT_SECRET
- [ ] 数据库已初始化（`npm run db:init`，无演示数据）
- [ ] 在 Test 环境充分测试

### 部署后验证

- [ ] 健康检查通过（`/health`）
- [ ] Monitor 正常启动（日志）
- [ ] 数据库连接正常
- [ ] RPC 连接正常（无 401 错误）
- [ ] 正确的环境（NODE_ENV）
- [ ] 正确的区块链网络（testnet/mainnet）

---

## 📚 文档导航

| 文档 | 用途 |
|------|------|
| **本文档** | 快速参考手册（一页纸速查） |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 完整部署指南（详细步骤） |
| [database-environments.md](./database-environments.md) | 数据库环境配置（Local/Test/Production） |
| [database-initialization.md](./database-initialization.md) | 数据库初始化详解 |
| [configuration-overview.md](./configuration-overview.md) | 配置体系说明 |

---

## 💡 最佳实践

1. **环境隔离**
   - Test 和 Production 使用独立的 Railway 项目
   - 使用独立的数据库
   - 使用不同的 API Keys

2. **部署流程**
   - 总是先部署到 Test 环境测试
   - 使用本地构建（避免 Railway 超时）
   - 提交 dist 目录到 Git

3. **安全配置**
   - 定期轮换 JWT_SECRET
   - 使用强密码和有效的 API Keys
   - 配置数据库白名单

4. **监控维护**
   - 定期查看日志（`railway logs`）
   - 配置健康检查
   - 定期备份数据库

---

**最后更新**：2025-11-01
