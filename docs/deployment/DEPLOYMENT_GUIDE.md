# PayIn Railway 部署完整指南

> 从零到生产的完整部署流程，包括 Test 和 Production 环境

---

## 📚 目录

1. [部署架构概览](#部署架构概览)
2. [前置准备](#前置准备)
3. [Test 环境部署](#test-环境部署)
4. [Production 环境部署](#production-环境部署)
5. [日常更新流程](#日常更新流程)
6. [数据库管理](#数据库管理)
7. [监控和维护](#监控和维护)
8. [故障排查](#故障排查)

---

## 部署架构概览

### 环境说明

PayIn 支持两个独立的部署环境：

| 环境 | 用途 | 数据库 | 区块链网络 | Processor 配置 |
|------|------|--------|-----------|---------------|
| **Test** | 开发测试 | 测试数据库 | Testnet（Sepolia, Amoy, Nile, Devnet） | `testnet.yaml` |
| **Production** | 生产环境 | 生产数据库 | Mainnet（Ethereum, Polygon, Tron, Solana） | `mainnet.yaml` |

### 部署流程

```
本地开发 → 构建 → 初始化数据库 → 部署到 Railway → 验证
```

### 关键组件

1. **apps/api** - API 服务器（Hono + Node.js）
2. **packages/** - 共享模块（processor, manager, auth, monitor, notification）
3. **Database** - PostgreSQL（推荐 Supabase）
4. **scripts/init-database.ts** - 独立数据库初始化脚本

---

## 前置准备

### 1. 必需工具

```bash
# Node.js 18+
node -v  # >= 18.0.0

# Railway CLI
npm i -g @railway/cli
railway --version

# Railway 登录
railway login
```

### 2. 外部服务

#### PostgreSQL 数据库（推荐 Supabase）

- 注册 [Supabase](https://supabase.com/)
- 创建新项目
- 获取 Connection String（使用 **Pooler** 连接）

```
格式：postgresql://postgres.xxx:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

#### RPC Provider API Keys

| Provider | 用途 | 获取地址 |
|----------|------|---------|
| **Alchemy** | Ethereum, Polygon, Arbitrum | [alchemy.com](https://www.alchemy.com/) |
| **Infura** | Ethereum (备用) | [infura.io](https://www.infura.io/) |
| **TronGrid** | Tron | [trongrid.io](https://www.trongrid.io/) |
| **Helius** | Solana | [helius.dev](https://www.helius.dev/) |

---

## Test 环境部署

### 场景 1: 创建全新项目（首次部署）

#### 步骤 1: 准备本地代码

```bash
# 克隆代码
git clone https://github.com/your-org/payin.git
cd payin

# 安装依赖
npm install

# 本地测试
npm run dev
```

#### 步骤 2: 创建 Railway 项目

```bash
# 创建新项目
railway init

# 或关联现有项目
railway link
```

#### 步骤 3: 配置环境变量

方式 A: 使用 Railway Dashboard（推荐）

1. 访问 [Railway Dashboard](https://railway.app/dashboard)
2. 选择项目 → Variables
3. 添加以下环境变量：

```bash
# === 基础配置 ===
NODE_ENV=test
PORT=3000

# === 数据库配置 ===
DB_CONNECTION_STRING=postgresql://postgres.xxx:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres

# === RPC Provider Keys ===
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key
TRONGRID_API_KEY=your_trongrid_key
HELIUS_API_KEY=your_helius_key
TATUM_API_KEY=your_tatum_key  # 可选
ANKR_API_KEY=your_ankr_key    # 可选

# === 认证配置 ===
JWT_SECRET=$(openssl rand -base64 32)  # 生成随机密钥
BASE_URL=https://your-app.up.railway.app

# === 邮件服务（可选）===
BREVO_SMTP_USER=your-smtp-user@example.com
BREVO_SMTP_PASSWORD=your_brevo_password
BREVO_FROM_EMAIL=noreply@payin.com

# === Supabase OAuth（可选）===
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

方式 B: 使用 CLI 批量导入

```bash
# 创建环境变量文件
cp .env.example .env.test

# 编辑配置
vim .env.test

# 批量导入（需要脚本支持）
./tools/import-railway-variables.sh .env.test
```

完整环境变量列表：[railway-test-env-vars.md](./railway-test-env-vars.md)

#### 步骤 4: 初始化数据库

**重要：在首次部署前必须初始化数据库！**

```bash
# 设置数据库连接
export DB_CONNECTION_STRING="postgresql://..."

# 初始化数据库 + 生成演示数据
npm run db:init:demo
```

这将创建：
- ✅ 所有数据库表（Auth, Manager, Processor）
- ✅ 3 个演示组织（TechCorp, GameStudio, ECommerce）
- ✅ 9 个测试用户（不同角色）
- ✅ 地址池（约 180 个地址）
- ✅ 演示订单和充值记录
- ✅ Payment Links 示例

#### 步骤 5: 构建和部署

```bash
# 使用一键部署脚本
./scripts/deployment/deploy-to-railway.sh test
```

脚本会自动：
1. 本地构建所有 packages 和 apps/api
2. 提交构建产物（dist 目录）
3. 推送到 Git
4. 触发 Railway 部署

或手动部署：

```bash
# 1. 本地构建
npm run build

# 2. 提交 dist 目录
git add -f packages/*/dist apps/api/dist
git commit -m "build: add dist for Railway deployment"
git push

# 3. Railway 会自动检测并部署
```

#### 步骤 6: 验证部署

```bash
# 1. 查看部署日志
railway logs

# 2. 测试健康检查
curl https://your-app.up.railway.app/health

# 期望响应
{
  "status": "healthy",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "environment": "test"
}

# 3. 测试登录
curl -X POST https://your-app.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_owner",
    "password": "Test1234!"
  }'
```

---

### 场景 2: 更新现有 Test 项目

```bash
# 1. 修改代码
git pull origin main

# 2. 本地测试
npm run dev

# 3. 一键部署
./scripts/deployment/deploy-to-railway.sh test

# 4. 查看部署状态
railway logs
```

**注意**：
- ❌ 不需要重新初始化数据库（除非 schema 有变更）
- ✅ Railway 会自动检测代码变更并重新部署
- ✅ 环境变量会保留

---

## Production 环境部署

### 关键区别

| 配置项 | Test | Production |
|--------|------|-----------|
| `NODE_ENV` | `test` | `production` |
| Processor Config | `testnet.yaml` | `mainnet.yaml` |
| Monitor Chains | Sepolia, Amoy, Nile, Devnet | Ethereum, Polygon, Tron, Solana |
| Demo Data | ✅ 生成 | ❌ 不生成 |
| 数据库 | 测试数据库 | 生产数据库 |

### 步骤 1: 创建生产 Railway 项目

```bash
# 创建新的 Railway 项目（与 Test 分离）
railway init --name payin-api-production
```

### 步骤 2: 配置生产环境变量

```bash
# === 基础配置 ===
NODE_ENV=production
PORT=3000

# === 生产数据库 ===
DB_CONNECTION_STRING=postgresql://[PRODUCTION_DB_URL]

# === RPC Provider Keys（生产级别）===
ALCHEMY_API_KEY=your_production_alchemy_key
INFURA_API_KEY=your_production_infura_key
QUICKNODE_API_KEY=your_quicknode_key  # 推荐添加
# ... 其他 Keys

# === 认证配置 ===
JWT_SECRET=$(openssl rand -base64 32)  # 使用不同的密钥
BASE_URL=https://api.yourdomain.com

# === 邮件服务 ===
BREVO_SMTP_USER=your_production_smtp_user
BREVO_SMTP_PASSWORD=your_production_smtp_password
BREVO_FROM_EMAIL=noreply@yourdomain.com
```

**重要提醒**：
- ✅ 使用独立的生产级 RPC Keys（更高限额）
- ✅ 使用不同的 JWT_SECRET（安全性）
- ✅ 使用生产数据库（与测试隔离）
- ❌ 不要设置 `DEMO_DATA=true`

### 步骤 3: 初始化生产数据库

```bash
# 设置生产数据库连接
export DB_CONNECTION_STRING="postgresql://[PRODUCTION_DB_URL]"
export NODE_ENV="production"

# 仅初始化 schema（不生成演示数据）
npm run db:init

# 验证
echo "Production database initialized successfully"
```

### 步骤 4: 部署到生产环境

```bash
# 使用生产配置部署
./scripts/deployment/deploy-to-railway.sh production

# 或手动
npm run build
git add -f packages/*/dist apps/api/dist
git commit -m "build: production deployment"
git push origin main

# 触发部署
railway up --environment production
```

### 步骤 5: 生产部署验证清单

```bash
# ✅ 1. 健康检查
curl https://api.yourdomain.com/health

# ✅ 2. 检查 NODE_ENV
railway logs | grep "NODE_ENV"
# 应显示: NODE_ENV=production

# ✅ 3. 检查监控链
railway logs | grep "Monitor chains"
# 应显示: ethereum-mainnet, polygon-mainnet, tron-mainnet, solana-mainnet

# ✅ 4. 验证 RPC 连接
railway logs | grep "RPC"
# 不应有 401 或连接错误

# ✅ 5. 检查数据库连接
railway logs | grep "Database"
# 应显示: Database connected successfully

# ✅ 6. 验证没有演示数据
# 登录后台，确认没有 TechCorp, GameStudio, ECommerce 演示组织
```

---

## 日常更新流程

### 代码更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 本地测试
npm install
npm run dev
npm run test

# 3. 部署到 Test 环境测试
./scripts/deployment/deploy-to-railway.sh test

# 4. 验证 Test 环境
railway logs --service payin-api-test

# 5. 部署到 Production 环境
./scripts/deployment/deploy-to-railway.sh production

# 6. 验证 Production 环境
railway logs --service payin-api-production
```

### 环境变量更新

```bash
# 1. 更新单个变量
railway variables set KEY=VALUE --service payin-api-test

# 2. 批量更新
./tools/import-railway-variables.sh .env.test

# 3. 重新部署使变量生效
railway up --service payin-api-test
```

### Schema 变更（需要数据库迁移）

```bash
# 1. 本地更新 schema
# 修改 packages/*/src/database/schema.ts

# 2. 在 Test 数据库测试迁移
export DB_CONNECTION_STRING="postgresql://[TEST_DB_URL]"
npm run db:init:force  # ⚠️ 仅测试环境使用

# 3. 验证无误后，在 Production 执行迁移
export DB_CONNECTION_STRING="postgresql://[PROD_DB_URL]"
export NODE_ENV="production"
# ⚠️ 生产环境建议手动执行 SQL，不要使用 --force
npm run db:init

# 4. 部署新代码
./scripts/deployment/deploy-to-railway.sh production
```

---

## 数据库管理

### 初始化命令

| 命令 | 用途 | 适用环境 |
|------|------|---------|
| `npm run db:init` | 仅创建表结构 | Production, Test |
| `npm run db:init:demo` | 创建表 + 演示数据 | Test 环境 |
| `npm run db:init:force` | 强制重置（删除所有数据） | ⚠️ 仅本地开发 |
| `npm run db:init:full` | 强制重置 + 演示数据 | ⚠️ 仅本地开发 |

### 数据库备份

```bash
# 备份 Test 数据库
railway run --service payin-api-test pg_dump > backup-test.sql

# 备份 Production 数据库（定期执行）
railway run --service payin-api-production pg_dump > backup-prod-$(date +%Y%m%d).sql
```

### 数据库恢复

```bash
# 恢复到 Test 数据库
railway run --service payin-api-test psql < backup-test.sql

# ⚠️ 恢复到 Production（谨慎操作）
railway run --service payin-api-production psql < backup-prod.sql
```

---

## 监控和维护

### 日志查看

```bash
# 实时日志
railway logs --service payin-api-test

# 过滤日志
railway logs --service payin-api-test | grep "ERROR"

# 导出日志
railway logs --service payin-api-test > logs.txt
```

### 性能监控

```bash
# 检查服务状态
railway status --service payin-api-test

# 查看资源使用
railway metrics --service payin-api-test
```

### 健康检查

```bash
# 定期执行健康检查
curl https://your-app.up.railway.app/health

# 配置 Railway Health Check
# Dashboard → Service Settings → Health Check Path: /health
```

---

## 故障排查

### 常见问题

#### 1. 部署失败：构建超时

**症状**：Railway 构建时间过长，超时失败

**解决方案**：使用本地构建

```bash
./scripts/deployment/deploy-to-railway.sh test
```

#### 2. 数据库连接失败

**症状**：`Error: connect ETIMEDOUT`

**检查步骤**：

```bash
# 1. 验证连接字符串
railway variables get DB_CONNECTION_STRING

# 2. 测试连接
psql "$DB_CONNECTION_STRING"

# 3. 检查 Supabase Pooler 是否启用
# 确保使用 pooler.supabase.com 而不是直接连接
```

**解决方案**：

- ✅ 使用 Supabase Pooler 连接
- ✅ 检查数据库白名单（允许 Railway IP）
- ✅ 增加连接超时时间

#### 3. Monitor 报 401 错误

**症状**：`RPC call failed with status 401`

**原因**：RPC API Key 无效或未设置

**解决方案**：

```bash
# 检查所有 RPC Keys
railway variables | grep API_KEY

# 更新无效的 Key
railway variables set ALCHEMY_API_KEY=new_valid_key

# 重新部署
railway up
```

#### 4. 健康检查失败

**症状**：Railway 显示服务不健康

**检查步骤**：

```bash
# 1. 查看启动日志
railway logs | head -100

# 2. 测试健康端点
curl https://your-app.up.railway.app/health

# 3. 检查端口配置
railway variables get PORT  # 应该是 3000
```

#### 5. Schema 不匹配

**症状**：`relation "xxx" does not exist`

**解决方案**：

```bash
# 重新初始化数据库
export DB_CONNECTION_STRING="postgresql://..."
npm run db:init

# 或连接数据库手动执行 SQL
```

### 调试技巧

```bash
# 1. 连接到 Railway 容器
railway shell --service payin-api-test

# 2. 检查环境变量
railway run --service payin-api-test env | grep NODE_ENV

# 3. 本地复现问题
export $(cat .env.test | xargs)
npm run dev

# 4. 查看详细日志
railway logs --service payin-api-test --follow
```

---

## 最佳实践

### 1. 环境隔离

- ✅ Test 和 Production 使用独立的 Railway 项目
- ✅ 使用不同的数据库
- ✅ 使用不同的 API Keys
- ✅ 使用不同的 JWT_SECRET

### 2. 安全配置

- ✅ 定期轮换 JWT_SECRET
- ✅ 使用强密码
- ✅ 限制 API Key 权限
- ✅ 启用数据库备份
- ✅ 配置 CORS 白名单

### 3. 部署流程

- ✅ 先在 Test 环境测试
- ✅ 验证无误后再部署到 Production
- ✅ 使用本地构建（避免 Railway 构建超时）
- ✅ 提交 dist 目录到 Git
- ✅ 定期备份数据库

### 4. 监控维护

- ✅ 配置健康检查
- ✅ 定期查看日志
- ✅ 监控资源使用
- ✅ 设置告警通知

---

## 相关文档

- [数据库初始化指南](./database-initialization.md) - 详细的数据库初始化说明
- [环境变量配置](./railway-test-env-vars.md) - 完整的环境变量列表
- [配置体系概览](./configuration-overview.md) - YAML 配置说明
- [快速开始](./railway-quickstart.md) - 5 分钟快速部署

---

## 总结

### Test 环境部署流程

```bash
1. railway init
2. 配置环境变量（Test）
3. npm run db:init:demo
4. ./scripts/deployment/deploy-to-railway.sh test
5. 验证部署
```

### Production 环境部署流程

```bash
1. railway init --name payin-api-production
2. 配置环境变量（Production）
3. npm run db:init  # 不生成演示数据
4. ./scripts/deployment/deploy-to-railway.sh production
5. 验证部署（更严格的检查）
```

### 日常更新流程

```bash
1. git pull
2. npm install && npm run dev  # 本地测试
3. ./scripts/deployment/deploy-to-railway.sh test  # 部署到 Test
4. 验证 Test 环境
5. ./scripts/deployment/deploy-to-railway.sh production  # 部署到 Production
6. 验证 Production 环境
```

---

**最后更新**：2025-11-01

**版本**：v0.2.0
