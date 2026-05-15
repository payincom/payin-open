# PayIn API Railway 部署指南（2025-10 更新）

> 本文基于最新的配置体系（详见《configuration-overview.md》），说明如何在 Railway 上部署 PayIn API，并在不同环境（测试 / 生产）下配置链、RPC Provider、Token。

## 目录
1. [总体流程](#总体流程)
2. [准备工作](#准备工作)
3. [环境变量清单](#环境变量清单)
4. [自定义链 / Provider / Token](#自定义链--provider--token)
5. [部署步骤](#部署步骤)
6. [部署后验证](#部署后验证)
7. [常见问题](#常见问题)

---

## 总体流程

### 推荐方式：本地构建 + Railway 部署（快速）

1. **本地构建**：执行 `./scripts/deployment/build-for-railway.sh`，在本地生成 `dist`。
2. **推送代码**：将代码（含 `dist` 目录）推送到 Git 仓库。
3. **配置环境变量**：在 Railway Variables 中设置数据库、RPC Key、应用参数等（详见 [railway-test-env-vars.md](./railway-test-env-vars.md)）。
4. **部署**：Railway 使用 `railway.test.toml` 配置，跳过构建直接启动服务（节省构建时间）。
5. **验证**：启动后使用 `GET /api/v1/config/diagnostics` 验证最终配置。

### 替代方式：Railway 云端构建（慢，不推荐）

1. 推送代码到 Git 仓库。
2. Railway 通过 `railway.toml` 自动执行 `npm run build:packages && npm run build -w apps/api`。
3. 配置环境变量并启动服务。

**注意**：由于 Railway 构建较慢且可能超时，**强烈推荐使用本地构建方式**。

---

## 准备工作

### 外部服务
- **PostgreSQL**：推荐使用 Supabase 或 Railway 的托管数据库。
- **RPC Provider**：
  - Ethereum / Polygon：Alchemy、Infura、Ankr、QuickNode（可选）
  - Tron：TronGrid
  - Solana：Helius、Tatum、公共节点
- **邮件**：Brevo SMTP（或替换为其他 SMTP 服务）
- **可选**：Supabase OAuth（用于社交登录）

### 仓库文件
- `apps/api/config/manager.development.yaml`（开发 / 测试）
- `apps/api/config/manager.production.yaml`（生产）
- 如需修改链/Token，可编辑 `packages/processor/config/default.yaml`

### 重要：关于 dist 目录的 Git 处理

**问题**：项目的 `.gitignore` 默认忽略 `dist/` 目录，但 Railway 本地构建部署需要提交 `dist/` 到 Git。

**解决方案**（选择其一）：

#### 方案 1：使用 git add -f 强制添加（推荐）

```bash
# 本地构建
./scripts/deployment/build-for-railway.sh

# 强制添加 dist 目录
git add -f packages/*/dist apps/api/dist

# 提交和推送
git commit -m "build: add dist for Railway deployment"
git push
```

#### 方案 2：创建部署分支（推荐用于生产环境）

```bash
# 创建 railway-deploy 分支
git checkout -b railway-deploy

# 临时修改 .gitignore（移除 dist/ 相关行）
sed -i.bak '/^dist\//d; /^packages\/\*\/dist\//d; /^apps\/\*\/dist\//d' .gitignore

# 本地构建
./scripts/deployment/build-for-railway.sh

# 添加所有变更
git add .
git commit -m "build: Railway deployment build"
git push origin railway-deploy

# Railway 配置使用 railway-deploy 分支进行部署

# 切换回主分支
git checkout main
```

#### 方案 3：修改项目 .gitignore（不推荐）

如果团队决定始终提交 `dist/` 目录，可以从 `.gitignore` 中移除以下行：

```diff
# Build output
-dist/
 build/
 coverage/
-packages/*/dist/
-apps/*/dist/
```

**注意**：此方案会增加 Git 仓库大小，且每次本地开发都需要提交构建产物。

---

## 环境变量清单

| 分类 | 变量名 | 示例/说明 | 备注 |
|------|--------|-----------|------|
| 基础 | `NODE_ENV` | `production` / `test` | 决定加载 `manager.production.yaml` 或 `manager.test.yaml` |
| 基础 | `DB_CONNECTION_STRING` | `postgresql://user:pwd@host:5432/db` | Manager / Processor 共用 |
| RPC | `ALCHEMY_API_KEY` | `xxx` | Ethereum/Polygon |
| RPC | `INFURA_API_KEY` | `xxx` | Ethereum/Polygon |
| RPC | `ANKR_API_KEY` | `xxx` | Ethereum/Polygon |
| RPC | `TRONGRID_API_KEY` | `xxx` | Tron |
| RPC | `TATUM_API_KEY` | `xxx` | Solana（可选） |
| RPC | `HELIUS_API_KEY` | `xxx` | Solana |
| RPC | `QUICKNODE_API_KEY` | `xxx` | 可选，高级 provider |
| 应用 | `JWT_SECRET` | `openssl rand -base64 32` | 至少 32 字符 |
| 应用 | `BREVO_SMTP_USER` / `BREVO_SMTP_PASSWORD` | - | 邮件通知 |
| 应用 | `BREVO_FROM_EMAIL` | `noreply@payin.com` | 发信邮箱 |
| 应用 | `BASE_URL` | `https://payin-api.up.railway.app` | API 外网域名 |
| 可选 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` | - | 社交登录 |
| 可选 | `SCAN_INTERVAL` / `MAX_CONCURRENT_SCANS` | - | 覆盖 monitor 扫描参数 |

> Railway 支持直接在 Dashboard → Variables 中逐项填写，也可使用 CLI `railway variables set KEY=VALUE`。

---

## 自定义链 / Provider / Token

### 1. 选择监控哪些链
- 在 `apps/api/config/manager.<env>.yaml` 的 `monitor.chains` 中列出需要的链（例如测试环境只写 `ethereum-sepolia`、`polygon-amoy` 等）。
- 如需启用主网，修改 `manager.production.yaml` 的 `monitor.chains`，并同步调整 `monitor.chainSettings`。

### 2. 自定义 Provider
- 默认已提供 Alchemy / Infura / Ankr / TronGrid / Helius / Tatum / PublicNode / Cloudflare / Solana Public。Helius URL 模板为 `https://{network}.helius-rpc.com/?api-key={apiKey}`，Tatum 为 `https://solana-{network}.gateway.tatum.io/`。只要设置好环境变量，manager YAML 中无需再定义 `customProviders`。  
- 若需要新增（如 QuickNode），可在 `monitor.customProviders` 写入模板，然后在 `monitor.rpc.chains.<chain>.preferredProviders` 中引用。  
- 将新 provider 的密钥写入环境变量（例如 `QUICKNODE_API_KEY`）。

### 3. 修改链元数据或 Token
- 链的协议、确认数、 explorer URL 存放在 `packages/processor/config/default.yaml` 的 `chains` 部分。  
- Token 合约地址同样在该文件的 `tokens` 字段。  
- 如需为不同环境使用不同地址，可考虑：
  1. 在 CI 中基于模板生成环境特定文件；  
  2. 或扩展 Manager/Processor，使其读取数据库/外部 YAML。

### 4. 生产与测试的区分
- **测试环境**：`NODE_ENV=test`，默认加载 `manager.test.yaml`，其中 `monitor.chains` 仅包含测试链。确保 RPC Key 使用测试网络的额度。  
- **生产环境**：`NODE_ENV=production`，加载 `manager.production.yaml`，链列表通常包含主网链，必须提供稳定的 RPC 服务（建议同时配置多个 Provider，如 Alchemy+QuickNode）。

---

## 部署步骤

### 推荐方式：本地构建 + 自动部署（一键脚本）

```bash
# 1. 执行一键部署脚本（包含构建、提交、推送、部署）
./scripts/deployment/deploy-to-railway.sh test

# 脚本会自动完成：
# - 本地构建所有 packages 和 apps/api
# - 提示是否提交和推送代码变更
# - 推送到 Git 仓库
# - 触发 Railway 部署
```

### 方式 1：手动本地构建 + Railway CLI 部署

```bash
# 1. 安装 Railway CLI（如果未安装）
npm i -g @railway/cli

# 2. 登录 Railway
railway login

# 3. 本地构建
./scripts/deployment/build-for-railway.sh

# 4. 配置环境变量（首次部署时）
railway init         # 选择现有项目或新建
railway variables set NODE_ENV=test
railway variables set DB_CONNECTION_STRING="postgresql://user:pass@host:5432/db"
# ... 设置其他环境变量（详见 railway-test-env-vars.md）

# 5. 提交构建产物到 Git
git add .
git commit -m "build: add dist for Railway deployment"
git push

# 6. 部署到 Railway
railway up --service payin-api-test
```

### 方式 2：Railway Dashboard（图形界面）

#### 首次设置

1. **创建项目**
   - 访问 [Railway Dashboard](https://railway.app/dashboard)
   - 选择 "Deploy from GitHub repo"
   - 指向你的 PayIn 仓库

2. **创建 Service**
   - 点击 "New Service"
   - 选择你的 GitHub 仓库
   - 命名为 `payin-api-test`

3. **配置环境变量**
   - 进入 Service 的 **Variables** 标签
   - 逐个添加环境变量（详见 [railway-test-env-vars.md](./railway-test-env-vars.md)）
   - 或使用 CLI 批量导入：
     ```bash
     railway link  # 关联到已创建的 service
     railway variables set NODE_ENV=test
     # ... 设置其他变量
     ```

4. **配置部署设置**
   - 进入 Service 的 **Settings** 标签
   - 在 **Deploy** 部分设置：
     - **Root Directory**: `/`（monorepo 根目录）
     - **Build Command**: `echo 'Using pre-built artifacts'`（跳过构建）
     - **Start Command**: `NODE_ENV=test node apps/api/dist/index.js`
   - 在 **Health Check** 部分设置：
     - **Path**: `/health`
     - **Timeout**: `300` 秒

5. **本地构建并推送**
   ```bash
   ./scripts/deployment/build-for-railway.sh
   git add .
   git commit -m "build: add dist for Railway deployment"
   git push
   ```

6. **触发部署**
   - 推送后 Railway 会自动检测到代码变更并部署
   - 或在 Dashboard 中手动点击 "Deploy"

#### 后续部署

```bash
# 本地构建
./scripts/deployment/build-for-railway.sh

# 提交并推送
git add .
git commit -m "build: update dist for Railway"
git push

# Railway 会自动检测并部署
```

### 方式 3：Railway CLI（完全自动化）

**一键部署脚本**（推荐）：
```bash
./scripts/deployment/deploy-to-railway.sh test
```

**手动步骤**：
```bash
# 1. 安装和登录（首次）
npm i -g @railway/cli
railway login
railway link  # 关联到已创建的 service

# 2. 本地构建
./scripts/deployment/build-for-railway.sh

# 3. 部署
railway up --service payin-api-test
```

---

## 部署后验证

1. **健康检查**：访问 `https://<your-app>.up.railway.app/health`，期望返回 `status: healthy`。  
2. **配置诊断**：登录超级管理员账号后访问 `GET /api/v1/config/diagnostics`，确认：
   - `monitor.chains` 包含预期链；
   - `runtimeConfig.layers` 中的 `monitor` / `processor` 与 YAML / 环境变量一致；
   - `_databaseOverrides` 显示数据库中的业务配置。
3. **Monitor 日志**：在 Railway Logs 或自有日志系统中查看是否出现 `Adapters creation completed { successCount: N, totalCount: N }`。如果有链缺失或 401 错误，回查环境变量与 provider 列表。

---

## 常见问题

| 问题 | 排查项 |
|------|--------|
| Monitor 报 401 / 节点不可用 | 检查环境变量是否为真实 key；确认 provider URL 是否含 `${...}` 占位符 |
| Monitor 未监控主网链 | 查看 `manager.production.yaml` 的 `monitor.chains` 是否包含主网链；是否在部署前更新了 YAML |
| Token 地址不正确 | 修改 `packages/processor/config/default.yaml` 的 `tokens` 字段后重新构建 |
| 需要扩展链/Provider | 参照上文第 4 节，修改 manager YAML 与 Processor 默认配置；重建后部署 |
| ENV 未生效 | 检查 `npm run dev` 或 Railway 日志中 `Loaded env files` 输出；确认没有遗留 `.env` 占位符 |

如需更深入的配置说明，请参考：
- `docs/deployment/configuration-overview.md`
- `packages/monitor/config/default.yaml`
- `packages/processor/config/default.yaml`

通过上述流程，可以在 Railway 上安全地部署不同环境的 PayIn API，并灵活地调整链、Provider、Token 配置。*** End Patch
