# Railway 部署快速开始指南

> 5 分钟快速部署 PayIn API 到 Railway（Test 环境）

## 前置条件

- ✅ Railway 账号（[注册](https://railway.app/login)）
- ✅ PostgreSQL 数据库（推荐 [Supabase](https://supabase.com/)）
- ✅ RPC API Keys（Alchemy、Infura、TronGrid、Helius 等）
- ✅ Railway CLI（可选，用于命令行部署）

---

## 方式 1：一键自动部署（推荐）

### 步骤 1：安装 Railway CLI

```bash
npm i -g @railway/cli
railway login
```

### 步骤 2：配置环境变量

在 Railway Dashboard 或使用 CLI 配置环境变量：

```bash
# 关键环境变量（必需）
railway variables set NODE_ENV=test
railway variables set DB_CONNECTION_STRING="postgresql://user:pass@host:5432/db"
railway variables set ALCHEMY_API_KEY="your_alchemy_key"
railway variables set INFURA_API_KEY="your_infura_key"
railway variables set TRONGRID_API_KEY="your_trongrid_key"
railway variables set HELIUS_API_KEY="your_helius_key"
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
railway variables set BASE_URL="https://your-app.up.railway.app"

# 初始化标志
railway variables set INIT_DB=true
railway variables set DEMO_DATA=true

# 邮件服务（可选）
railway variables set BREVO_SMTP_USER="your-smtp-user@example.com"
railway variables set BREVO_SMTP_PASSWORD="your_brevo_password"
railway variables set BREVO_FROM_EMAIL="noreply@payin.com"
```

完整环境变量列表：[railway-test-env-vars.md](./railway-test-env-vars.md)

### 步骤 3：一键部署

```bash
./scripts/deployment/deploy-to-railway.sh test
```

脚本会自动完成：
- ✅ 本地构建所有 packages 和 apps/api
- ✅ 提示是否提交和推送代码变更
- ✅ 推送到 Git 仓库
- ✅ 触发 Railway 部署

### 步骤 4：验证部署

```bash
# 查看部署日志
railway logs --service payin-api-test

# 测试健康检查
curl https://your-app.up.railway.app/health
```

---

## 方式 2：手动分步部署

### 步骤 1：本地构建

```bash
./scripts/deployment/build-for-railway.sh
```

### 步骤 2：提交构建产物

```bash
# 强制添加 dist 目录（即使在 .gitignore 中）
git add -f packages/*/dist apps/api/dist

# 提交和推送
git commit -m "build: add dist for Railway deployment"
git push
```

### 步骤 3：Railway Dashboard 部署

1. 访问 [Railway Dashboard](https://railway.app/dashboard)
2. 创建新项目，选择 "Deploy from GitHub repo"
3. 配置环境变量（见上文）
4. 配置部署设置：
   - **Build Command**: `echo 'Using pre-built artifacts'`
   - **Start Command**: `NODE_ENV=test node apps/api/dist/index.js`
   - **Health Check Path**: `/health`
5. 触发部署

---

## 部署后验证清单

### 1. 健康检查 ✅

```bash
curl https://your-app.up.railway.app/health
```

期望响应：
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T12:00:00.000Z"
}
```

### 2. 配置诊断 ✅

登录超级管理员账号后：

```bash
curl https://your-app.up.railway.app/api/v1/config/diagnostics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

检查：
- ✅ `monitor.chains` 包含 5 条测试链
- ✅ RPC Keys 已正确替换（无 `${...}` 占位符）
- ✅ 数据库连接正常

### 3. Monitor 日志 ✅

在 Railway Logs 中查看：

```
Adapters creation completed { successCount: 5, totalCount: 5 }
```

### 4. 功能测试 ✅

使用演示数据测试核心功能：

```bash
# 登录测试账号
curl -X POST https://your-app.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.owner@techcorp.com","password":"Test1234!"}'

# 创建测试订单
curl -X POST https://your-app.up.railway.app/api/v1/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "test-order-001",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

---

## 监控链配置（Test 环境）

| 链 | Chain ID | 确认数 | 首选 Provider |
|----|----------|--------|--------------|
| Ethereum Sepolia | `ethereum-sepolia` | 2 | Alchemy, Infura |
| Polygon Amoy | `polygon-amoy` | 5 | Alchemy |
| Tron Nile | `tron-nile` | 10 | TronGrid |
| Solana Devnet | `solana-devnet` | 1 | Helius, Tatum |
| Arbitrum Sepolia | `arbitrum-sepolia` | 2 | Alchemy, PublicNode |

---

## 常见问题

### Q1: Railway 构建超时怎么办？

**A**: 使用本地构建方式，避免在 Railway 上构建：

```bash
./scripts/deployment/deploy-to-railway.sh test
```

### Q2: Monitor 报 401 / 节点不可用？

**A**: 检查 RPC API Key 环境变量：

```bash
railway variables
```

确认：
- ✅ `ALCHEMY_API_KEY` 已设置且有效
- ✅ `INFURA_API_KEY` 已设置且有效
- ✅ `TRONGRID_API_KEY` 已设置且有效
- ✅ `HELIUS_API_KEY` 已设置且有效

### Q3: 数据库连接失败？

**A**: 检查数据库连接字符串格式：

```bash
railway variables get DB_CONNECTION_STRING
```

正确格式：
```
postgresql://user:password@host:5432/database
```

### Q4: 健康检查超时？

**A**: 增加健康检查超时时间：

1. 进入 Railway Dashboard → Service Settings
2. Health Check Timeout 设置为 `600` 秒
3. 重新部署

### Q5: 如何更新部署？

**A**: 重新构建并推送：

```bash
./scripts/deployment/deploy-to-railway.sh test
```

或手动：

```bash
./scripts/deployment/build-for-railway.sh
git add -f packages/*/dist apps/api/dist
git commit -m "build: update dist"
git push
```

---

## 下一步

- 📖 [完整部署指南](./railway.md)
- 🔧 [环境变量配置详解](./railway-test-env-vars.md)
- 🏗️ [配置体系概览](./configuration-overview.md)
- 🚀 [生产环境部署](./railway.md#生产与测试的区分)

---

## 技术支持

遇到问题？

1. 查看 [完整部署文档](./railway.md)
2. 检查 [常见问题](./railway.md#常见问题)
3. 查看 Railway Logs：`railway logs --service payin-api-test`
4. 提交 Issue 到 GitHub 仓库
