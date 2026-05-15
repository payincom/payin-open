# 🚀 PayIn 部署文件说明

清理后保留的核心部署工具和文档。

---

## 📝 可执行脚本（3个）

### 1. `deploy-fast.sh` ⭐️ 最常用
**用途**：日常代码部署  
**使用频率**：每次代码更新  
**命令**：`./deploy-fast.sh`

### 2. `setup-new-railway-project.sh`
**用途**：新 Railway 项目完整设置  
**使用频率**：仅首次设置  
**命令**：`./setup-new-railway-project.sh`

### 3. `import-railway-variables.sh`
**用途**：批量导入环境变量  
**使用频率**：新项目设置或批量更新变量  
**命令**：`./import-railway-variables.sh [.env文件]`

---

## 📚 文档文件（3个 + 1个总览）

### 1. `DEPLOYMENT.md` ⭐️ 总览文档
所有部署相关的快速参考、命令、检查清单

### 2. `RAILWAY_POSTGRES_SETUP.md`
Railway Postgres 数据库配置专门指南

### 3. `DATABASE_CONNECTION_OPTIMIZATION.md`
数据库连接超时问题解决方案

---

## 🗑️ 已删除的冗余文件（7个）

- ❌ `deploy-railway.sh` - 被 deploy-fast.sh 替代
- ❌ `RAILWAY_DEPLOYMENT.md` - 整合到 DEPLOYMENT.md
- ❌ `RAILWAY_ENVIRONMENT_VARIABLES.md` - 整合到其他文档
- ❌ `RAILWAY_NEW_PROJECT_SETUP.md` - 重复
- ❌ `DEPLOYMENT_OPTIONS.md` - 过时
- ❌ `DEPLOYMENT_SUMMARY.md` - 冗余

---

## 💡 快速开始

### 日常部署
```bash
./deploy-fast.sh
```

### 新项目设置
```bash
./setup-new-railway-project.sh
```

### 查看完整文档
```bash
cat DEPLOYMENT.md
```

---

**保持简洁，只留必需！** 🎯
