# PayIn 部署文档

Railway 部署相关的完整文档。

---

## 📚 文档列表

### 1. `DEPLOYMENT.md` ⭐️ 主文档

**内容**：
- 核心部署脚本使用指南
- Railway 常用命令快速参考
- 环境变量管理
- 数据库连接配置
- 故障排查指南
- 部署检查清单
- 最佳实践

**适用场景**：
- 首次部署设置
- 日常部署参考
- 问题排查

---

### 2. `DATABASE_CONNECTION_OPTIMIZATION.md`

**内容**：
- 数据库连接超时问题分析
- 连接池参数优化
- Supabase Pooler 配置
- TCP keepalive 设置
- 多种解决方案对比

**适用场景**：
- 出现连接超时错误
- 数据库性能优化
- 连接池调优

---

### 3. `DEPLOYMENT_README.md`

**内容**：
- 部署文件结构说明
- 清理记录
- 快速开始指南

**适用场景**：
- 了解项目部署文件组织
- 查找特定工具或文档

---

## 🚀 快速导航

### 我想...

**部署代码到 Railway**
→ 使用 `../../tools/deploy-fast.sh`
→ 参考 `DEPLOYMENT.md`

**设置新的 Railway 项目**
→ 使用 `../../tools/setup-new-railway-project.sh`
→ 参考 `DEPLOYMENT.md` 的"首次部署"部分

**配置数据库连接**
→ 参考 `DEPLOYMENT.md` 的"数据库连接"部分

**解决连接超时问题**
→ 参考 `DATABASE_CONNECTION_OPTIMIZATION.md`

**批量导入环境变量**
→ 使用 `../../tools/import-railway-variables.sh`

---

## 📋 部署流程概览

### 日常部署（已有项目）

```bash
# 1. 修改代码并测试
npm run dev
npm run test

# 2. 提交代码
git add .
git commit -m "your changes"

# 3. 部署到 Railway
./tools/deploy-fast.sh

# 4. 验证部署
railway logs
curl https://your-app.up.railway.app/health
```

### 首次部署（新项目）

```bash
# 1. 准备环境变量
cp .env.example .env.production
vim .env.production  # 填入生产环境配置

# 2. 运行自动化设置脚本
./tools/setup-new-railway-project.sh

# 3. 按提示完成配置

# 4. 验证部署
railway status
railway logs
```

---

## 🔍 常见问题

### Q: 如何更新环境变量？

```bash
# 方式1: 单个变量
railway variables --set "KEY=VALUE"

# 方式2: 批量导入
./tools/import-railway-variables.sh .env.production

# 重新部署使变量生效
./tools/deploy-fast.sh
```

### Q: 部署失败怎么办？

1. 查看构建日志：`railway logs`
2. 检查环境变量：`railway variables`
3. 验证本地构建：`npm run build`
4. 参考 `DEPLOYMENT.md` 故障排查部分

### Q: 如何连接 Railway Postgres？

```bash
# 设置数据库连接（使用变量引用）
railway variables --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}'

# 重新部署
./tools/deploy-fast.sh
```

详细说明参考 `DEPLOYMENT.md` 数据库配置部分。

### Q: 数据库连接超时怎么办？

参考 `DATABASE_CONNECTION_OPTIMIZATION.md` 获取完整解决方案。

---

## 🔗 相关资源

### 内部文档
- `../../tools/README.md` - 部署工具说明
- `../../CLAUDE.md` - 项目整体文档

### 外部资源
- [Railway 官方文档](https://docs.railway.app/)
- [Railway CLI 文档](https://docs.railway.app/develop/cli)
- [Nixpacks 构建器](https://nixpacks.com/)

---

## 📝 文档维护

- 所有部署相关文档统一放在 `docs/deployment/` 目录
- 所有部署相关脚本统一放在 `tools/` 目录
- 保持文档简洁、实用，避免冗余

**最后更新**: 2025-11-01
