# 演示数据生成指南

## 📊 概述

PayIn 系统包含完整的演示数据生成器，可以快速填充测试环境，方便开发和演示使用。

### 生成的数据

演示数据包括：
- **3个组织**: TechCorp, GameStudio, ECommerce
- **9个测试用户**: 不同角色（owner, admin, member, viewer）
- **Admin 用户**: 可访问所有演示组织的管理员账户
- **约180个地址**: 覆盖所有协议（EVM, Solana, Tron）
- **约24个订单**: 不同状态（pending, completed, expired）
- **约15个充值绑定**: 包含转账历史记录
- **约9个 Payment Links**: 已发布和草稿状态
- **约27个 Payment Link 订单**: 完成、待处理和过期状态

---

## 方法 1: 本地脚本生成（推荐）

### 步骤 1: 获取 Railway 数据库连接

```bash
# 方法 1a: 通过 Railway CLI 获取
railway variables --service payin-api --environment test | grep DB_CONNECTION_STRING

# 方法 1b: 从 Railway UI 复制
# 打开 Railway → payin-api → Variables → DB_CONNECTION_STRING
```

### 步骤 2: 设置环境变量

```bash
# 替换为你的实际数据库连接字符串
export DB_CONNECTION_STRING="postgresql://postgres:password@host:5432/database"
```

### 步骤 3: 运行脚本

```bash
# 从项目根目录运行
tsx scripts/seed-demo-data.ts
```

**预期输出**:
```
🎭 Generating Demo Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Creating organizations and users...
✅ Created 3 organizations
✅ Created 9 users across organizations

👤 Adding admin user to demo organizations...
✅ Admin user added to 3 organizations

📮 Generating address pools...
✅ Generated 60 addresses for tech-corp
✅ Generated 60 addresses for game-studio
✅ Generated 60 addresses for e-commerce

🛒 Creating sample orders...
✅ Generated 8 orders for tech-corp
✅ Generated 8 orders for game-studio
✅ Generated 8 orders for e-commerce

💰 Creating deposit bindings...
✅ Generated 5 deposits for tech-corp
✅ Generated 5 deposits for game-studio
✅ Generated 5 deposits for e-commerce

🔗 Creating payment links...
✅ Generated 3 payment links for tech-corp
✅ Generated 3 payment links for game-studio
✅ Generated 3 payment links for e-commerce

📋 Creating payment link orders...
✅ Generated 9 orders for payment links

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Demo data generated successfully in 3245ms

📊 Demo Data Summary:
   • 3 organizations (tech-corp, game-studio, e-commerce)
   • 9 users with different roles (owner, admin, member, viewer)
   • Admin user added to all demo organizations
   • ~180 addresses across all protocols and organizations
   • ~24 orders (pending, completed, expired)
   • ~15 deposit bindings with transfer history
   • ~9 payment links (published, draft)
   • ~27 payment link orders (completed, pending, expired)

🔐 Demo Login Credentials:
   Admin: admin / admin123 (access all demo organizations)
   Demo users: alice_owner, bob_owner, carol_owner / Test1234!
```

### 单行命令（推荐）

```bash
# 将数据库连接和命令合并为一行
DB_CONNECTION_STRING="postgresql://..." tsx scripts/seed-demo-data.ts
```

---

## 方法 2: 通过 Railway 环境变量

### 步骤 1: 配置环境变量

在 Railway UI 中添加：
```
INIT_DB=true
```

### 步骤 2: 重启服务

```bash
railway restart --service payin-api --environment test

# 或者重新部署
railway up --service payin-api --environment test
```

### 注意事项

**优点**:
- 自动化，服务启动时生成
- 适合 CI/CD 流程

**缺点**:
- 每次重启都会尝试生成（如果数据已存在会报错）
- 不够灵活

---

## 测试用户账号

### Admin 用户（可访问所有组织）

| 用户名 | 密码 | 权限 |
|--------|------|------|
| admin | admin123 | 访问所有3个演示组织 |

### TechCorp 组织用户

| 用户名 | 邮箱 | 密码 | 角色 |
|--------|------|------|------|
| alice_owner | alice.owner@techcorp.com | Test1234! | owner |
| alice_admin | alice.admin@techcorp.com | Test1234! | admin |
| alice_member | alice.member@techcorp.com | Test1234! | member |
| alice_viewer | alice.viewer@techcorp.com | Test1234! | viewer |

### GameStudio 组织用户

| 用户名 | 邮箱 | 密码 | 角色 |
|--------|------|------|------|
| bob_owner | bob.owner@gamestudio.com | Test1234! | owner |
| bob_admin | bob.admin@gamestudio.com | Test1234! | admin |
| bob_member | bob.member@gamestudio.com | Test1234! | member |

### ECommerce 组织用户

| 用户名 | 邮箱 | 密码 | 角色 |
|--------|------|------|------|
| carol_owner | carol.owner@ecommerce.com | Test1234! | owner |
| carol_viewer | carol.viewer@ecommerce.com | Test1234! | viewer |

---

## 验证演示数据

### 检查组织

```bash
# 通过 API 检查
curl https://payin-api-test.up.railway.app/api/v1/organizations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 检查用户登录

访问管理后台并使用上述账号登录：
```
https://payin-api-test.up.railway.app/login
```

### 检查地址池

```sql
-- 连接到数据库
psql "postgresql://..."

-- 查看地址池统计
SELECT
  organization_id,
  protocol,
  status,
  COUNT(*) as count
FROM address_pool
GROUP BY organization_id, protocol, status
ORDER BY organization_id, protocol, status;
```

### 检查订单

```sql
-- 查看订单统计
SELECT
  organization_id,
  status,
  COUNT(*) as count,
  SUM(amount::numeric) as total_amount
FROM orders
GROUP BY organization_id, status
ORDER BY organization_id, status;
```

---

## 常见问题

### Q: 如何重新生成演示数据？

**A**: 先清空现有数据，然后重新运行脚本：

```sql
-- ⚠️ 警告：这会删除所有数据！
DELETE FROM payment_link_orders;
DELETE FROM payment_links;
DELETE FROM transfers;
DELETE FROM deposits;
DELETE FROM orders;
DELETE FROM address_pool;
DELETE FROM organization_members;
DELETE FROM api_keys;
DELETE FROM sessions;
DELETE FROM users;
DELETE FROM organizations;
```

然后重新运行：
```bash
tsx scripts/seed-demo-data.ts
```

### Q: 可以只生成部分数据吗？

**A**: 可以，通过修改脚本传递 `skip` 选项：

```typescript
// 编辑 scripts/seed-demo-data.ts
await generateDemoData({
  connectionString,
  skip: {
    orders: true,        // 跳过订单
    deposits: true,      // 跳过充值
    paymentLinks: true,  // 跳过 Payment Links
  }
});
```

### Q: 生成的地址是真实的吗？

**A**: 是的，地址是通过 HD 钱包生成的真实区块链地址，但**不包含私钥**，仅用于展示。

### Q: 订单和充值有真实的区块链交易吗？

**A**: 没有。演示数据只在数据库中创建记录，不会真实发送区块链交易。

### Q: 可以在生产环境使用吗？

**A**: ⚠️ **不推荐**！演示数据包含固定的测试账号和密码，仅用于开发和测试环境。

---

## 脚本源码位置

- **主脚本**: `scripts/seed-demo-data.ts`
- **生成器**: `packages/test-utils/src/demo-data/`
  - `index.ts` - 主入口
  - `organizations.ts` - 组织和用户
  - `addresses.ts` - 地址池
  - `orders.ts` - 订单数据
  - `deposits.ts` - 充值数据
  - `payment-links.ts` - Payment Links
  - `payment-link-orders.ts` - Payment Link 订单
  - `constants.ts` - 固定配置

---

## 相关文档

- [测试账号配置](../CLAUDE.md#测试账号配置)
- [多租户架构](../docs/multi-tenant-migration.md)
- [Address Management System](../docs/address-management-system.md)

---

**更新时间**: 2025-11-02
**适用环境**: test, development
**不适用于**: production
