# PayIn 部署指南

本项目使用 Railway 进行部署。以下是核心工具和文档。

---

## 🚀 核心部署脚本

### 1. 日常部署

```bash
./deploy-fast.sh
```

**用途**：日常代码更新部署
- 本地构建（~1分钟）
- 上传到 Railway（~1-2分钟）
- 总耗时：2-3 分钟

### 2. 新项目设置

```bash
./setup-new-railway-project.sh
```

**用途**：在全新的 Railway 项目中进行完整设置
- 检查 Railway CLI
- 创建/链接项目
- 导入环境变量
- 首次部署

### 3. 批量导入环境变量

```bash
./import-railway-variables.sh [env-file]
```

**用途**：从 `.env` 文件批量导入变量到 Railway
- 默认读取 `.env.production`
- 跳过注释和空行
- 自动处理引号

**示例**：
```bash
# 使用默认文件
./import-railway-variables.sh

# 使用自定义文件
./import-railway-variables.sh .env.staging
```

---

## 📚 配置文档

### 1. Railway Postgres 配置

**文件**：`RAILWAY_POSTGRES_SETUP.md`

**内容**：
- 如何在 Railway 项目中添加 Postgres
- 使用变量引用语法：`${{Postgres.DATABASE_URL}}`
- 内部网络连接优势
- 故障排查指南

**适用场景**：
- 首次配置数据库
- 切换到 Railway Postgres
- 数据库连接问题排查

### 2. 数据库连接优化

**文件**：`DATABASE_CONNECTION_OPTIMIZATION.md`

**内容**：
- 连接超时问题解决方案
- 连接池参数优化
- Supabase Pooler 配置
- TCP keepalive 设置

**适用场景**：
- 出现连接超时错误
- 需要优化数据库性能
- 调整连接池参数

---

## 🔧 快速参考

### 常用 Railway 命令

```bash
# 查看状态
railway status

# 查看日志
railway logs

# 查看环境变量
railway variables
railway variables --kv

# 设置环境变量
railway variables --set "KEY=VALUE"

# 打开 Web 控制台
railway open
```

### 环境变量管理

```bash
# 查看当前变量
railway variables

# 设置单个变量
railway variables --set "NODE_ENV=production"

# 设置多个变量
railway variables \
  --set "NODE_ENV=production" \
  --set "LOG_LEVEL=info"

# 使用变量引用（引用其他服务）
railway variables --set 'DB_URL=${{Postgres.DATABASE_URL}}'

# 重新部署使变量生效
./deploy-fast.sh
```

### 数据库连接

```bash
# Railway Postgres（内部网络，推荐）
railway variables --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}'

# Supabase（外部数据库）
railway variables --set "DB_CONNECTION_STRING=postgresql://user:pass@host:5432/db"
```

---

## 🔍 故障排查

### 部署失败

```bash
# 查看构建日志
railway logs

# 检查环境变量
railway variables

# 验证本地构建
npm run build
```

### 数据库连接问题

```bash
# 检查连接字符串
railway variables --kv | grep DB_CONNECTION_STRING

# 查看数据库日志
railway logs | grep -i database

# 查看优化文档
cat DATABASE_CONNECTION_OPTIMIZATION.md
```

### 首次部署

```bash
# 1. 确保已登录
railway login

# 2. 链接项目
railway link

# 3. 设置环境变量
./import-railway-variables.sh

# 4. 部署
./deploy-fast.sh
```

---

## 📝 部署检查清单

### 首次部署

- [ ] Railway CLI 已安装并登录
- [ ] 项目已链接到 Railway
- [ ] 环境变量已设置（数据库、API Keys 等）
- [ ] 数据库已配置（Railway Postgres 或 Supabase）
- [ ] 本地构建成功（`npm run build`）
- [ ] 首次部署完成（`./deploy-fast.sh`）
- [ ] 健康检查通过（`curl <URL>/health`）
- [ ] `INIT_DB` 已设为 `false`（首次运行后）

### 日常更新

- [ ] 代码已提交到 Git
- [ ] 本地测试通过
- [ ] 运行 `./deploy-fast.sh`
- [ ] 检查部署日志（`railway logs`）
- [ ] 验证应用运行正常

---

## 🎯 最佳实践

### 1. 环境变量

- ✅ 使用 `.env.example` 作为模板
- ✅ 敏感信息只存储在 Railway 上
- ✅ 使用变量引用连接 Railway 服务
- ❌ 不要将 `.env.production` 提交到 Git

### 2. 部署流程

- ✅ 使用 `deploy-fast.sh` 进行日常部署
- ✅ 本地构建后再上传（节省时间）
- ✅ 部署后检查日志确认成功
- ❌ 不要直接使用 `railway up`（会重新构建）

### 3. 数据库配置

- ✅ 优先使用 Railway Postgres（内部网络更快）
- ✅ 使用 `${{Postgres.DATABASE_URL}}` 引用
- ✅ 配置合适的超时和连接池参数
- ❌ 不要硬编码连接字符串

---

## 🔗 相关资源

- [Railway 官方文档](https://docs.railway.app/)
- [Railway CLI 文档](https://docs.railway.app/develop/cli)
- [Nixpacks 构建器](https://nixpacks.com/)
- [项目 GitHub](https://github.com/your-org/payin)

---

## 💡 提示

- 修改环境变量后**必须**重新部署
- Railway 每月有免费额度，超出后按量计费
- 使用内部网络连接数据库可节省流量费用
- 定期检查日志排查潜在问题

---

**最后更新**: 2025-11-01
