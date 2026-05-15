# Processor 配置指南

本文档详细介绍如何配置 PayIn Processor 系统。

## 目录

- [配置概述](#配置概述)
- [配置方式](#配置方式)
- [配置优先级](#配置优先级)
- [配置文件详解](#配置文件详解)
- [环境变量详解](#环境变量详解)
- [配置项说明](#配置项说明)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 配置概述

Processor 提供了灵活的多层配置系统，支持：

- 📁 **配置文件** - 使用 YAML 格式管理配置
- 🔑 **环境变量** - 覆盖敏感信息和环境特定设置
- 💻 **代码配置** - 在代码中直接提供配置
- 🎯 **环境自适应** - 根据 `NODE_ENV` 自动选择配置

配置文件位置：`packages/processor/config/`

---

## 配置方式

Processor 支持四种配置方式，可以灵活组合使用：

### 1. 配置文件（推荐）

使用 YAML 文件管理配置，支持多环境：

```bash
# 使用开发环境配置
NODE_ENV=development npm start

# 使用生产环境配置
NODE_ENV=production npm start

# 使用测试环境配置
NODE_ENV=test npm test
```

**优点**：
- ✅ 清晰的配置结构
- ✅ 支持注释和文档
- ✅ 版本控制友好
- ✅ 多环境管理方便

### 2. 自定义配置文件

创建 `config/custom.yaml` 用于本地覆盖（已加入 .gitignore）：

```bash
# 复制示例配置
cp config/config.example.yaml config/custom.yaml

# 编辑自定义配置
nano config/custom.yaml

# 启动（自动加载 custom.yaml）
npm start
```

**优点**：
- ✅ 本地开发灵活
- ✅ 不影响团队配置
- ✅ 不会提交到版本控制

### 3. 环境变量（生产推荐）

通过环境变量设置配置，适合生产环境：

```bash
# 设置环境变量
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export RPC_ALCHEMY_KEY="your_alchemy_key"
export NODE_ENV=production

# 启动
npm start
```

**优点**：
- ✅ 安全性高（不保存在文件中）
- ✅ CI/CD 友好
- ✅ 容器化部署友好
- ✅ 动态配置更新

### 4. 代码配置

在代码中直接提供配置：

```typescript
import { Processor } from '@payin/processor';

const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  },
  monitor: {
    chains: ['ethereum-sepolia', 'polygon-amoy']
  },
  orders: {
    defaultPaymentWindowMinutes: 15
  }
});

await processor.start();
```

**优点**：
- ✅ 完全控制配置
- ✅ 适合测试场景
- ✅ 向后兼容

---

## 配置优先级

配置加载顺序（后者覆盖前者）：

```
1. 内置默认值（代码中定义）
   ↓
2. config/default.yaml
   ↓
3. config/{environment}.yaml
   (development.yaml / production.yaml / test.yaml)
   ↓
4. config/custom.yaml
   (本地自定义配置)
   ↓
5. 代码提供的配置
   (Processor.create(config))
   ↓
6. 环境变量
   (DATABASE_URL, PROCESSOR_DB_*, RPC_*_KEY 等)
```

**环境变量优先级最高**，适合生产环境覆盖敏感配置。

---

## 配置文件详解

### 文件结构

```
packages/processor/config/
├── default.yaml           # 基础默认配置
├── development.yaml       # 开发环境配置
├── production.yaml        # 生产环境配置
├── test.yaml             # 测试环境配置
├── config.example.yaml   # 完整配置示例
├── custom.yaml           # 自定义配置（需自己创建）
└── README.md             # 配置说明
```

### default.yaml - 基础配置

包含所有配置项的默认值，适用于所有环境：

```yaml
database:
  host: localhost
  port: 5432
  database: payin
  username: postgres
  password: ""
  maxConnections: 10
  ssl: false

monitor:
  chains:
    - ethereum-sepolia
    - polygon-amoy
  targets: []

services:
  orders: true
  deposits: true

orders:
  defaultPaymentWindowMinutes: 10
  defaultGracePeriodMinutes: 5
  maxTotalTimeoutMinutes: 60
  maintenanceIntervalMs: 60000

# ... 更多配置项
```

### development.yaml - 开发环境

开发环境特定设置，适合本地开发：

```yaml
database:
  database: payin_dev

orders:
  defaultPaymentWindowMinutes: 30  # 更长的支付窗口方便测试
  defaultGracePeriodMinutes: 10

delayedConfirmation:
  checkInterval: 10000  # 更频繁的检查（10秒）

deposits:
  poolManagement:
    defaultCooldownMinutes: 5  # 更短的冷却期方便测试
```

### production.yaml - 生产环境

生产环境配置，注重性能和安全：

```yaml
database:
  maxConnections: 20  # 更多连接处理生产负载
  ssl: true          # 启用 SSL

monitor:
  chains:
    - ethereum-mainnet
    - polygon-mainnet
    - tron-mainnet

orders:
  maintenanceIntervalMs: 30000  # 更频繁的维护

delayedConfirmation:
  maxPendingTransactions: 5000  # 更高的限制

deposits:
  poolManagement:
    maxPoolSize: 100000         # 大型地址池
    lowPoolThreshold: 1000
```

### test.yaml - 测试环境

测试环境配置，快速执行测试：

```yaml
database:
  database: payin_test

orders:
  defaultPaymentWindowMinutes: 5  # 短时间窗口
  maintenanceIntervalMs: 5000

delayedConfirmation:
  checkInterval: 1000  # 每秒检查
  maxPendingTime: 60000

deposits:
  poolManagement:
    defaultCooldownMinutes: 1  # 极短冷却期
    maxPoolSize: 100
```

---

## 环境变量详解

### 数据库配置

#### 方式 1：连接字符串（推荐）

```bash
# 标准连接字符串
DATABASE_URL="postgresql://user:password@host:5432/database?ssl=true"

# 或使用 Processor 专用变量
PROCESSOR_DB_URL="postgresql://user:password@host:5432/database"
```

#### 方式 2：独立参数

```bash
PROCESSOR_DB_HOST=localhost
PROCESSOR_DB_PORT=5432
PROCESSOR_DB_NAME=payin
PROCESSOR_DB_USER=postgres
PROCESSOR_DB_PASSWORD=your_password
PROCESSOR_DB_MAX_CONNECTIONS=20
PROCESSOR_DB_SSL=true
```

**注意**：`DATABASE_URL` 或 `PROCESSOR_DB_URL` 优先级高于独立参数。

### RPC 提供商 API 密钥

```bash
# Alchemy (Ethereum, Polygon)
RPC_ALCHEMY_KEY=your_alchemy_api_key

# Infura (Ethereum, Polygon)
RPC_INFURA_KEY=your_infura_api_key

# Ankr (多链)
RPC_ANKR_KEY=your_ankr_api_key

# TronGrid (Tron)
RPC_TRONGRID_KEY=your_trongrid_api_key
```

### 应用设置

```bash
# 环境（development, production, test）
NODE_ENV=production

# 自定义配置文件（可选）
PROCESSOR_CONFIG_FILE=custom.yaml

# 跳过数据库初始化（测试用）
SKIP_INIT_DB=false
```

### 环境变量文件

推荐使用 `.env` 文件管理环境变量：

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
nano .env

# 启动（自动加载 .env）
npm start
```

**重要**：`.env` 文件已加入 `.gitignore`，不会被提交到版本控制。

---

## 配置项说明

### database - 数据库配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `connectionString` | string | - | PostgreSQL 连接字符串，优先级最高 |
| `host` | string | localhost | 数据库主机 |
| `port` | number | 5432 | 数据库端口 |
| `database` | string | payin | 数据库名称 |
| `username` | string | postgres | 数据库用户名 |
| `password` | string | "" | 数据库密码 |
| `maxConnections` | number | 10 | 最大连接数 |
| `ssl` | boolean | false | 是否启用 SSL |

### monitor - 监控配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `chains` | string[] | ['ethereum-sepolia', 'polygon-amoy'] | 监控的区块链网络 |
| `targets` | object[] | [] | 初始监控目标（通常为空，动态添加） |

### services - 服务配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `orders` | boolean | true | 启用订单支付服务 |
| `deposits` | boolean | true | 启用用户充值服务 |

### orders - 订单服务配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultPaymentWindowMinutes` | number | 10 | 默认支付窗口（分钟） |
| `defaultGracePeriodMinutes` | number | 5 | 支付窗口后的宽限期（分钟） |
| `maxTotalTimeoutMinutes` | number | 60 | 最大总超时时间（分钟） |
| `maintenanceIntervalMs` | number | 60000 | 维护任务间隔（毫秒） |

### delayedConfirmation - 延迟确认配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | true | 启用延迟确认服务 |
| `checkInterval` | number | 30000 | 检查间隔（毫秒） |
| `maxPendingTime` | number | 600000 | 最大待确认时间（毫秒） |
| `maxPendingTransactions` | number | 1000 | 最大待确认交易数 |
| `maxRetries` | number | 3 | 最大重试次数 |

### deposits - 充值服务配置

#### poolManagement - 地址池管理

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultCooldownMinutes` | number | 30 | 地址冷却期（分钟） |
| `maxPoolSize` | number | 10000 | 最大地址池大小 |
| `lowPoolThreshold` | number | 100 | 低地址池警告阈值 |

#### importValidation - 导入验证

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `validateDerivationPath` | boolean | true | 验证 HD 钱包派生路径 |
| `maxImportBatchSize` | number | 1000 | 最大批量导入数量 |

### tokens - 代币配置

定义支持的代币及其链上配置：

```yaml
tokens:
  USDC:
    decimals: 6
    chains:
      ethereum-mainnet:
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        confirmations: 12
      ethereum-sepolia:
        contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        confirmations: 3
```

---

## 使用示例

### 场景 1：本地开发

最简单的方式，使用默认配置：

```bash
# 1. 设置环境变量
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payin_dev"
export RPC_ALCHEMY_KEY="your_test_key"

# 2. 启动（自动使用 development.yaml）
NODE_ENV=development npm start
```

### 场景 2：自定义本地配置

需要特殊配置时：

```bash
# 1. 创建自定义配置
cp config/config.example.yaml config/custom.yaml

# 2. 编辑 custom.yaml
nano config/custom.yaml

# 3. 设置环境变量（敏感信息）
export DATABASE_URL="postgresql://..."
export RPC_ALCHEMY_KEY="..."

# 4. 启动
npm start
```

### 场景 3：生产部署（Docker）

使用环境变量部署：

```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

```bash
# docker-compose.yml
version: '3.8'
services:
  processor:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/payin
      - RPC_ALCHEMY_KEY=${RPC_ALCHEMY_KEY}
      - RPC_INFURA_KEY=${RPC_INFURA_KEY}
    depends_on:
      - db
```

```bash
# 启动
docker-compose up
```

### 场景 4：测试环境

测试自动使用 test.yaml 配置：

```bash
# 运行测试（自动使用 test.yaml）
npm test

# 运行特定测试
npm test -- tests/scenarios/order-single-payment.test.ts
```

### 场景 5：CI/CD 环境

在 CI/CD 中使用环境变量：

```yaml
# .github/workflows/test.yml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      RPC_ALCHEMY_KEY: ${{ secrets.RPC_ALCHEMY_KEY }}
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
```

### 场景 6：代码配置（高级）

完全控制配置：

```typescript
import { Processor } from '@payin/processor';

const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  },
  monitor: {
    chains: ['ethereum-mainnet', 'polygon-mainnet'],
    targets: []
  },
  services: {
    orders: true,
    deposits: true
  },
  orders: {
    defaultPaymentWindowMinutes: 15,
    defaultGracePeriodMinutes: 7
  },
  delayedConfirmation: {
    enabled: true,
    checkInterval: 20000
  },
  deposits: {
    poolManagement: {
      defaultCooldownMinutes: 45,
      maxPoolSize: 50000
    }
  }
});

await processor.start();
```

---

## 最佳实践

### 🔐 安全性

1. **永远不要提交敏感信息到版本控制**
   ```bash
   # ✅ 正确：使用环境变量
   export DATABASE_URL="postgresql://..."

   # ❌ 错误：硬编码在配置文件中
   database:
     connectionString: "postgresql://user:pass@..."
   ```

2. **使用 .env 文件管理本地环境变量**
   ```bash
   # ✅ .env 已在 .gitignore 中
   cp .env.example .env
   nano .env
   ```

3. **生产环境使用环境变量，不使用配置文件**
   ```bash
   # ✅ 生产环境
   export DATABASE_URL="..."
   export RPC_ALCHEMY_KEY="..."
   NODE_ENV=production npm start
   ```

### 🎯 环境管理

1. **开发环境**：使用 `development.yaml` + `.env`
2. **测试环境**：使用 `test.yaml` + CI 环境变量
3. **生产环境**：使用 `production.yaml` + 服务器/容器环境变量

### 📝 配置文件管理

1. **default.yaml** - 只包含非敏感默认值
2. **{environment}.yaml** - 环境特定设置（可提交）
3. **custom.yaml** - 本地覆盖（不提交，已在 .gitignore）

### 🔄 配置更新

1. **更新配置文件**：修改后需重启应用
2. **更新环境变量**：修改后需重启应用
3. **代码配置**：每次创建 Processor 实例时生效

---

## 常见问题

### Q1: 如何查看当前使用的配置？

配置加载时会在控制台输出：

```
✅ Loaded config from: default.yaml
✅ Loaded config from: development.yaml
✅ Loaded config from: custom.yaml
```

### Q2: 环境变量没有生效？

检查顺序：
1. 确认环境变量已正确设置：`echo $DATABASE_URL`
2. 确认在启动命令前导出：`export DATABASE_URL=...`
3. 确认没有被代码配置覆盖

### Q3: 如何在不同环境使用不同配置？

使用 `NODE_ENV` 环境变量：

```bash
# 开发
NODE_ENV=development npm start

# 生产
NODE_ENV=production npm start

# 测试
NODE_ENV=test npm test
```

### Q4: 配置文件找不到怎么办？

1. 确认配置文件在 `packages/processor/config/` 目录
2. 确认工作目录正确（应该在 processor 包目录）
3. 配置文件不是必需的，系统会使用内置默认值

### Q5: 如何覆盖部分配置？

配置会深度合并，只需提供要覆盖的部分：

```typescript
// 只覆盖订单配置，其他使用默认值
await Processor.create({
  orders: {
    defaultPaymentWindowMinutes: 15
  }
});
```

### Q6: 测试时如何跳过数据库初始化？

设置环境变量：

```bash
SKIP_INIT_DB=true npm test
```

### Q7: 如何添加新的代币配置？

在 `custom.yaml` 或代码中添加：

```yaml
tokens:
  DAI:
    decimals: 18
    chains:
      ethereum-mainnet:
        contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        confirmations: 12
```

### Q8: 如何查看所有可用的配置项？

查看 `config/config.example.yaml`，包含所有配置项的完整说明。

### Q9: 配置优先级是什么？

从低到高：
1. 内置默认值
2. default.yaml
3. {environment}.yaml
4. custom.yaml
5. 代码配置
6. 环境变量（最高）

### Q10: 如何在 Docker 中配置？

使用环境变量：

```yaml
# docker-compose.yml
services:
  processor:
    image: processor:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - RPC_ALCHEMY_KEY=${RPC_ALCHEMY_KEY}
```

---

## 相关文档

- [Processor 主文档](./processor-configuration.en.md)
- [Monitor RPC 配置](./rpc-configuration.zh-CN.md)
- [配置文件示例](../../packages/processor/config/default.yaml)
- [环境变量示例](../../packages/processor/.env.example)

---

## 技术支持

如有问题，请参考：
- GitHub Issues: https://github.com/your-repo/payin/issues
- 配置示例：`packages/processor/config/config.example.yaml`
- 快速开始：`packages/processor/config/README.md`