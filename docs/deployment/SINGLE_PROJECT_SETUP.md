# 单项目多环境部署架构

## 概述

PayIn 现在使用**单一 Railway 项目**架构，通过环境变量区分 test 和 production 环境。

## 架构设计

```
Railway Project: payin-api
├── Service: payin-api (应用服务)
└── Service: postgres (数据库服务)

环境切换：通过 NODE_ENV 环境变量
- NODE_ENV=test → 使用 testnet 区块链网络
- NODE_ENV=production → 使用 mainnet 区块链网络
```

## 优势

✅ **资源节省**：只需一个 Railway 项目
✅ **简化管理**：所有配置在一个地方
✅ **灵活切换**：通过环境变量快速切换环境
✅ **成本降低**：适合 Railway 免费计划

## 部署流程

### 首次部署（仅一次）

```bash
# 1. 创建 Railway 项目和数据库（仅执行一次）
./scripts/deployment/setup-railway-project.sh test

# 2. 获取数据库连接字符串
export DB_CONNECTION_STRING=$(railway variables --service payin-api --json | grep -o '"DATABASE_URL":"[^"]*"' | cut -d'"' -f4)

# 3. 初始化数据库
npm run db:init:demo

# 4. 首次部署（test 环境）
./scripts/deployment/deploy-to-railway.sh test
```

### 日常更新部署

```bash
# 更新代码后，部署到 test 环境
./scripts/deployment/deploy-to-railway.sh test

# 或部署到 production 环境
./scripts/deployment/deploy-to-railway.sh production
```

## 环境切换

### Test → Production 切换

```bash
# 1. 在 Railway Dashboard 修改环境变量
# https://railway.app → payin-api → payin-api → Variables
# 修改：
NODE_ENV=production

# 2. 更新为生产级 API Keys
ALCHEMY_API_KEY=<PRODUCTION_KEY>
INFURA_API_KEY=<PRODUCTION_KEY>
TRONGRID_API_KEY=<PRODUCTION_KEY>
HELIUS_API_KEY=<PRODUCTION_KEY>
JWT_SECRET=<NEW_PRODUCTION_SECRET>
BASE_URL=https://api.yourdomain.com

# 3. 重新部署（使用 production 配置）
./scripts/deployment/deploy-to-railway.sh production
```

### Production → Test 切换

```bash
# 1. 在 Railway Dashboard 修改环境变量
NODE_ENV=test

# 2. 恢复测试环境 API Keys
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key
TRONGRID_API_KEY=your_trongrid_key
HELIUS_API_KEY=your_helius_key

# 3. 重新部署（使用 test 配置）
./scripts/deployment/deploy-to-railway.sh test
```

## 配置文件说明

| 文件 | 用途 | 何时使用 |
|------|------|---------|
| `railway.test.toml` | Test 环境配置 | `deploy-to-railway.sh test` |
| `railway.production.toml` | Production 环境配置 | `deploy-to-railway.sh production` |
| `railway.toml` | 默认配置（未使用） | - |

## 部署脚本说明

### deploy-to-railway.sh

**用途**：日常更新部署

**语法**：
```bash
./scripts/deployment/deploy-to-railway.sh [test|production]
```

**功能**：
1. 本地构建代码
2. 提交并推送 Git
3. 根据参数选择配置文件：
   - `test` → 使用 `railway.test.toml`
   - `production` → 使用 `railway.production.toml`
4. 部署到 `payin-api` 服务

**示例**：
```bash
# 部署到 test 环境
./scripts/deployment/deploy-to-railway.sh test

# 部署到 production 环境
./scripts/deployment/deploy-to-railway.sh production

# 默认部署到 test 环境
./scripts/deployment/deploy-to-railway.sh
```

### setup-railway-project.sh

**用途**：首次创建项目（仅运行一次）

**注意**：⚠️ 如果项目已存在，请使用 `deploy-to-railway.sh`

## 环境变量管理

### Test 环境必需变量

```bash
NODE_ENV=test
DATABASE_URL=<自动生成>
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key
TRONGRID_API_KEY=your_trongrid_key
HELIUS_API_KEY=your_helius_key
JWT_SECRET=<自动生成>
```

### Production 环境必需变量

```bash
NODE_ENV=production
DATABASE_URL=<自动生成>
ALCHEMY_API_KEY=<PRODUCTION_KEY>
INFURA_API_KEY=<PRODUCTION_KEY>
TRONGRID_API_KEY=<PRODUCTION_KEY>
HELIUS_API_KEY=<PRODUCTION_KEY>
JWT_SECRET=<PRODUCTION_SECRET>
BASE_URL=https://api.yourdomain.com
```

## 数据库管理

### Test 数据

```bash
# 重置数据库 + 演示数据
export DB_CONNECTION_STRING=$(railway variables --service payin-api --json | grep -o '"DATABASE_URL":"[^"]*"' | cut -d'"' -f4)
npm run db:init:full
```

### Production 数据

```bash
# ⚠️ 谨慎操作！仅更新 schema
export DB_CONNECTION_STRING=$(railway variables --service payin-api --json | grep -o '"DATABASE_URL":"[^"]*"' | cut -d'"' -f4)
export NODE_ENV=production
npm run db:init
```

## 监控和日志

```bash
# 查看部署日志
railway logs --service payin-api

# 实时日志
railway logs --service payin-api --follow

# 查看当前环境
railway variables --service payin-api | grep NODE_ENV

# 查看服务状态
railway status --service payin-api
```

## 常见问题

### Q: 如何确认当前是什么环境？

**A**: 检查 NODE_ENV 环境变量
```bash
railway variables --service payin-api | grep NODE_ENV
```

### Q: Test 和 Production 使用同一个数据库吗？

**A**: 是的，使用同一个 Railway PostgreSQL 数据库实例。如果需要完全隔离，建议使用不同的数据库（需要手动创建）。

### Q: 如何避免误操作生产环境？

**A**:
1. 部署前检查 NODE_ENV：`railway variables --service payin-api | grep NODE_ENV`
2. 部署时明确指定环境：`./scripts/deployment/deploy-to-railway.sh production`
3. 为 production 设置不同的 JWT_SECRET

### Q: 部署失败如何回滚？

**A**:
```bash
# 查看部署历史
railway deployments --service payin-api

# 在 Dashboard 回滚到之前的版本
railway open
```

### Q: 如何切换到完全独立的 test 和 production 项目？

**A**:
1. 创建新的 Railway 项目（例如 `payin-api-production`）
2. 修改脚本的 `SERVICE_NAME` 逻辑
3. 不推荐：增加管理复杂度和成本

## 最佳实践

1. **环境隔离**
   - 使用不同的 API Keys
   - 使用不同的 JWT_SECRET
   - Production 不生成演示数据

2. **部署策略**
   - 总是先部署到 test 环境测试
   - 验证通过后再部署到 production
   - 使用明确的环境参数（不依赖默认值）

3. **数据库管理**
   - Test：可以随时重置
   - Production：只更新 schema，不删除数据

4. **监控**
   - 部署后检查日志
   - 验证健康检查：`curl https://your-app.railway.app/health`
   - 确认区块链网络正确（testnet/mainnet）

## 相关文档

- [快速参考手册](./QUICK_REFERENCE.md)
- [数据库环境配置](./database-environments.md)
- [完整部署指南](./DEPLOYMENT_GUIDE.md)

---

**最后更新**：2025-11-01
