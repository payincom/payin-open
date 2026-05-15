# PayIn 部署工具

部署相关的可执行脚本。

---

## 📝 脚本列表

### 1. `deploy-fast.sh` ⭐️ 最常用

**用途**：日常代码部署到 Railway

**使用方法**：
```bash
./tools/deploy-fast.sh
```

**功能**：
- 检查 Railway CLI 和认证状态
- 本地构建项目（~1分钟）
- 上传到 Railway 并部署（~1-2分钟）
- 总耗时：2-3 分钟

**优势**：
- 比 Railway 自动构建快 60-70%
- 本地验证构建成功后再上传
- 使用 Nixpacks 快速部署

---

### 2. `setup-new-railway-project.sh`

**用途**：在全新的 Railway 项目中进行完整设置

**使用方法**：
```bash
./tools/setup-new-railway-project.sh
```

**功能**：
- 检查 Railway CLI 安装和登录状态
- 创建新项目或链接现有项目
- 导入环境变量（从 .env.production）
- 执行首次构建和部署
- 提供部署后配置提示

**使用场景**：
- 创建新的 Railway 环境（production/staging/test）
- 从零开始设置项目

---

### 3. `import-railway-variables.sh`

**用途**：从 .env 文件批量导入环境变量到 Railway

**使用方法**：
```bash
# 使用默认文件 (.env.production)
./tools/import-railway-variables.sh

# 使用自定义文件
./tools/import-railway-variables.sh .env.staging
```

**功能**：
- 读取 .env 文件（默认 .env.production）
- 跳过注释和空行
- 自动移除引号
- 使用 --skip-deploys 避免每个变量触发部署
- 显示导入统计信息

**使用场景**：
- 批量更新环境变量
- 新环境初始化
- 从备份恢复配置

---

## 🚀 快速开始

### 日常部署流程

```bash
# 1. 修改代码
# 2. 本地测试
# 3. 提交代码
git add .
git commit -m "your changes"

# 4. 部署到 Railway
./tools/deploy-fast.sh

# 5. 查看日志
railway logs
```

### 新项目设置流程

```bash
# 1. 准备环境变量文件
cp .env.example .env.production
vim .env.production  # 填入生产环境值

# 2. 运行自动化设置
./tools/setup-new-railway-project.sh

# 3. 按提示完成配置
# - 选择创建新项目或链接现有项目
# - 确认导入环境变量
# - 等待首次部署完成
```

---

## 📚 相关文档

完整的部署文档请参考：
- [docs/deployment/DEPLOYMENT.md](../docs/deployment/DEPLOYMENT.md) - 部署总览
- [docs/deployment/DATABASE_CONNECTION_OPTIMIZATION.md](../docs/deployment/DATABASE_CONNECTION_OPTIMIZATION.md) - 数据库优化

---

## ⚠️ 注意事项

### 环境变量管理

- ✅ 敏感信息只存储在 Railway 上
- ✅ 使用 .env.production 作为模板（不提交到 Git）
- ✅ 修改变量后需要重新部署
- ❌ 不要将 .env.production 提交到版本控制

### 部署最佳实践

- ✅ 部署前确保本地构建成功
- ✅ 部署后检查日志确认成功
- ✅ 使用 deploy-fast.sh 而不是直接 railway up
- ❌ 不要在生产环境测试未验证的代码

---

**最后更新**: 2025-11-01
