# Railway Test 环境变量配置指南

> 本文档说明如何为 PayIn API 在 Railway 上配置 test 环境的环境变量

## 快速配置

### 使用 Railway CLI（推荐）

```bash
# 登录 Railway
railway login

# 选择或创建项目
railway init

# 选择 test 环境的 service
railway service

# 批量设置环境变量
railway variables set NODE_ENV=test
railway variables set DB_CONNECTION_STRING="postgresql://user:pass@host:5432/db"
railway variables set ALCHEMY_API_KEY="your_alchemy_key"
railway variables set INFURA_API_KEY="your_infura_key"
railway variables set TRONGRID_API_KEY="your_trongrid_key"
railway variables set ANKR_API_KEY="your_ankr_key"
railway variables set TATUM_API_KEY="your_tatum_key"
railway variables set HELIUS_API_KEY="your_helius_key"
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
railway variables set BREVO_SMTP_USER="your-smtp-user@example.com"
railway variables set BREVO_SMTP_PASSWORD="your_brevo_password"
railway variables set BREVO_FROM_EMAIL="noreply@payin.com"
railway variables set BASE_URL="https://your-app.up.railway.app"
railway variables set INIT_DB="true"
railway variables set DEMO_DATA="true"
```

### 使用 Railway Dashboard

1. 访问 [Railway Dashboard](https://railway.app/dashboard)
2. 选择你的项目和 service
3. 进入 **Variables** 标签
4. 逐个添加下表中的环境变量

---

## 完整环境变量清单

### 必需变量（Test 环境）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `test` | **必须设置为 test**，用于加载 `manager.test.yaml` |
| `DB_CONNECTION_STRING` | `postgresql://user:pass@host:5432/db` | PostgreSQL 数据库连接字符串（推荐使用 Supabase 或 Railway DB） |
| `ALCHEMY_API_KEY` | `your_alchemy_key` | Alchemy RPC API Key（Ethereum/Polygon 测试网） |
| `INFURA_API_KEY` | `your_infura_key` | Infura RPC API Key（Ethereum/Polygon 测试网） |
| `TRONGRID_API_KEY` | `your_trongrid_key` | TronGrid API Key（Tron Nile 测试网） |
| `ANKR_API_KEY` | `your_ankr_key` | Ankr API Key（多链支持） |
| `HELIUS_API_KEY` | `your_helius_key` | Helius API Key（Solana Devnet） |
| `TATUM_API_KEY` | `your_tatum_key` | Tatum API Key（Solana Devnet，可选） |
| `JWT_SECRET` | `$(openssl rand -base64 32)` | JWT 密钥，至少 32 字符（生产环境使用强随机值） |
| `BASE_URL` | `https://your-app.up.railway.app` | API 服务的外部访问 URL |

### 邮件服务（Brevo SMTP）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `BREVO_SMTP_USER` | `your-smtp-user@example.com` | Brevo SMTP 用户名 |
| `BREVO_SMTP_PASSWORD` | `your-smtp-password` | Brevo SMTP 密码 |
| `BREVO_FROM_EMAIL` | `noreply@payin.com` | 发件邮箱地址 |

### 初始化标志（Test 环境推荐）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `INIT_DB` | `true` | 首次部署时设置为 `true`，自动初始化数据库表结构 |
| `DEMO_DATA` | `true` | 是否生成演示数据（3个组织 + 地址池 + 订单 + 充值 + Payment Links） |

### 可选变量（覆盖默认配置）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SCAN_INTERVAL` | `5000` | Monitor 扫描间隔（毫秒） |
| `BLOCK_RANGE_SIZE` | `10` | 每次扫描的区块范围 |
| `MAX_CONCURRENT_SCANS` | `5` | 最大并发扫描数 |
| `SAFE_BLOCK_DISTANCE` | `1` | 安全区块距离（避免 reorg） |
| `LOG_LEVEL` | `info` | 日志级别（debug/info/warn/error） |

### 社交登录（可选）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase 项目 URL（用于 OAuth） |
| `SUPABASE_ANON_KEY` | `your_supabase_anon_key` | Supabase Anonymous Key |

---

## Test 环境配置说明

### 监控的区块链网络

根据 `apps/api/config/manager.test.yaml`，test 环境默认监控以下测试网：

- ✅ **Ethereum Sepolia** (`ethereum-sepolia`)
- ✅ **Polygon Amoy** (`polygon-amoy`)
- ✅ **Tron Nile** (`tron-nile`)
- ✅ **Solana Devnet** (`solana-devnet`)
- ✅ **Arbitrum Sepolia** (`arbitrum-sepolia`)

### RPC Provider 配置

每条链的首选 RPC Provider：

| 链 | 首选 Provider | 备用 Provider |
|----|--------------|--------------|
| Ethereum Sepolia | Alchemy | Infura |
| Polygon Amoy | Alchemy | - |
| Tron Nile | TronGrid | - |
| Solana Devnet | Helius | Tatum |
| Arbitrum Sepolia | Alchemy | PublicNode |

**注意**：确保为所使用的 Provider 设置相应的 API Key 环境变量。

### 确认数配置（Test 环境）

| 链 | 确认数 | 说明 |
|----|--------|------|
| Ethereum Sepolia | 2 | 测试网降低确认数以加快测试 |
| Polygon Amoy | 5 | 测试网降低确认数 |
| Tron Nile | 10 | Tron 测试网确认数 |
| Solana Devnet | 1 | Solana 快速确认 |

---

## 与 Development 环境的区别

| 配置项 | Development (本地) | Test (Railway) |
|--------|--------------------|----------------|
| `NODE_ENV` | `development` | `test` |
| 数据库 | 本地 PostgreSQL 或 Supabase | Supabase 或 Railway DB（云端） |
| `BASE_URL` | `http://localhost:3000` | `https://your-app.up.railway.app` |
| `INIT_DB` | `false`（手动初始化） | `true`（首次部署自动初始化） |
| `DEMO_DATA` | `false`（按需生成） | `true`（自动生成演示数据） |
| 监控链 | 相同（都是测试网） | 相同 |
| 确认数 | 相同 | 相同 |

**核心区别**：
- **Development**：用于本地开发，数据库和服务都在本地
- **Test**：用于 Railway 云端测试，使用云端数据库和服务，但仍然使用测试网络

---

## 安全最佳实践

### 1. 使用 Railway 密钥管理

Railway 支持密钥管理，推荐用于敏感信息：

```bash
railway variables set DB_CONNECTION_STRING="$(cat db_connection_string.txt)"
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
```

### 2. 定期轮换密钥

- JWT_SECRET：每 90 天轮换一次
- RPC API Keys：按 Provider 要求轮换
- SMTP Password：按需轮换

### 3. 最小权限原则

- 数据库用户只授予必要的权限
- RPC API Keys 设置请求速率限制
- SMTP 账户限制发送配额

---

## 部署后验证

### 1. 健康检查

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

### 2. 配置诊断（需要超级管理员登录）

```bash
curl https://your-app.up.railway.app/api/v1/config/diagnostics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

检查：
- ✅ `monitor.chains` 包含 5 条测试链
- ✅ `runtimeConfig.layers.monitor` 中的 RPC Keys 已正确替换（无 `${...}` 占位符）
- ✅ 数据库连接正常

### 3. Monitor 日志

在 Railway Logs 中查看：

```
Adapters creation completed { successCount: 5, totalCount: 5 }
```

如果看到失败或 401 错误，检查对应的 RPC API Key 环境变量。

---

## 故障排查

| 问题 | 排查步骤 |
|------|---------|
| Monitor 报 401 / 节点不可用 | 1. 检查环境变量是否正确设置<br>2. 验证 API Key 是否有效<br>3. 确认 API Key 对测试网有访问权限 |
| 数据库连接失败 | 1. 检查 `DB_CONNECTION_STRING` 格式<br>2. 确认数据库可从 Railway 访问<br>3. 检查数据库用户权限 |
| 健康检查超时 | 1. 增加 `healthcheckTimeout` 到 600 秒<br>2. 检查 Railway Logs 中的启动日志<br>3. 确认所有必需的环境变量都已设置 |
| 配置诊断显示 `${...}` | 1. 确认所有 RPC Key 环境变量都已设置<br>2. 重新部署服务<br>3. 检查 `manager.test.yaml` 中的占位符语法 |

---

## 相关文档

- [Railway 部署指南](./railway.md)
- [配置体系概览](./configuration-overview.md)
- [本地构建脚本](../../scripts/deployment/build-for-railway.sh)
- [部署脚本](../../scripts/deployment/deploy-to-railway.sh)
