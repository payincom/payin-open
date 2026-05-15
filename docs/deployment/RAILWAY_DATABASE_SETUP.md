# Railway 数据库自动创建指南

## 快速回答

**Q: Railway 能否自动创建数据库？**

✅ **是的**！Railway 提供了非常方便的数据库管理功能。

## 自动化脚本

我们提供了一键创建脚本：`scripts/deployment/setup-railway-project.sh`

### 使用方法

```bash
# 创建 Test 环境（自动创建项目 + 数据库 + 配置）
./scripts/deployment/setup-railway-project.sh test

# 创建 Production 环境（自动创建项目 + 数据库 + 部分配置）
./scripts/deployment/setup-railway-project.sh production
```

### 脚本会自动完成

1. ✅ 创建 Railway 项目（`payin-api-test` 或 `payin-api-production`）
2. ✅ 添加 PostgreSQL 数据库（`railway add --database postgres`）
3. ✅ 配置 `NODE_ENV` 环境变量
4. ✅ Test 环境：自动配置所有测试网 API Keys
5. ✅ Production 环境：提示手动配置生产 Keys

### 脚本输出示例

```
============================================================
  PayIn Railway Project Setup
  Environment: test
  Project Name: payin-api-test
============================================================

📦 Step 1/4: Creating Railway project...
✅ Project created: payin-api-test

🗄️  Step 2/4: Adding PostgreSQL database...
✅ PostgreSQL database added

⚙️  Step 3/4: Configuring environment variables...
✅ Test environment variables configured

📊 Step 4/4: Getting database connection string...
✅ Database URL configured

Next steps:
1. Initialize database schema:
   export DB_CONNECTION_STRING="$DATABASE_URL"
   npm run db:init:demo

2. Deploy your application:
   ./scripts/deployment/deploy-to-railway.sh test
```

## Railway 数据库管理

### 通过 CLI

```bash
# 添加数据库到现有项目
railway add --database postgres

# 查看数据库连接字符串
railway variables get DATABASE_URL --service payin-api-test

# 连接到数据库
railway run psql --service payin-api-test

# 查看数据库状态
railway status --service payin-api-test
```

### 通过 Dashboard

1. 登录 [Railway Dashboard](https://railway.app)
2. 选择您的项目
3. 点击 "New" → "Database" → "PostgreSQL"
4. Railway 自动创建并配置 `DATABASE_URL`

## 完整部署流程

### Test 环境（首次创建）

```bash
# 1. 一键创建项目和数据库
./scripts/deployment/setup-railway-project.sh test

# 2. 初始化数据库
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-test)
npm run db:init:demo

# 3. 部署应用
./scripts/deployment/deploy-to-railway.sh test

# 4. 验证
railway logs --service payin-api-test
curl https://your-app.up.railway.app/health
```

**时间**：约 10-15 分钟

### Production 环境（首次创建）

```bash
# 1. 一键创建项目和数据库
./scripts/deployment/setup-railway-project.sh production

# 2. ⚠️ 在 Railway Dashboard 配置生产 API Keys
# - ALCHEMY_API_KEY（生产 Key）
# - INFURA_API_KEY（生产 Key）
# - TRONGRID_API_KEY（生产 Key）
# - HELIUS_API_KEY（生产 Key）
# - BASE_URL（生产域名）

# 3. 初始化数据库（无演示数据）
export DB_CONNECTION_STRING=$(railway variables get DATABASE_URL --service payin-api-production)
export NODE_ENV=production
npm run db:init

# 4. 部署应用
./scripts/deployment/deploy-to-railway.sh production

# 5. 验证
railway logs --service payin-api-production
curl https://api.yourdomain.com/health
```

**时间**：约 15-20 分钟

## 三环境数据库对比

| 环境 | 数据库提供商 | 创建方式 | 演示数据 | 区块链网络 |
|------|-------------|---------|---------|-----------|
| **Local** | Supabase | 手动配置 | ✅ 生成 | Testnet |
| **Test** | Railway PostgreSQL | 自动化脚本 | ✅ 生成 | Testnet |
| **Production** | Railway PostgreSQL | 自动化脚本 | ❌ 不生成 | Mainnet |

## 常见问题

### Q1: 我需要手动创建 Production 项目吗？

**A**: 不需要！使用 `./scripts/deployment/setup-railway-project.sh production` 自动创建。

### Q2: 数据库会自动创建吗？

**A**: 是的！脚本会自动调用 `railway add --database postgres`。

### Q3: 数据库 URL 在哪里？

**A**: Railway 自动创建 `DATABASE_URL` 环境变量，可以通过以下方式获取：
```bash
railway variables get DATABASE_URL --service payin-api-test
```

### Q4: 如何检查数据库是否创建成功？

**A**:
```bash
# 方法 1: 查看服务列表
railway services --service payin-api-test

# 方法 2: 尝试连接
railway run psql --service payin-api-test

# 方法 3: 查看环境变量
railway variables | grep DATABASE_URL
```

### Q5: 如果数据库创建失败怎么办？

**A**: 手动添加：
```bash
railway add --database postgres
```

## 相关文档

- [数据库环境配置详解](./database-environments.md) - 完整的三环境数据库管理
- [快速参考手册](./QUICK_REFERENCE.md) - 一页纸速查所有命令
- [完整部署指南](./DEPLOYMENT_GUIDE.md) - 详细的部署步骤

---

**最后更新**：2025-11-01
