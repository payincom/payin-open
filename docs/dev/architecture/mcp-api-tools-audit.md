# MCP Server API Tools 审计报告

## 文档元信息

- **创建时间**: 2025-10-27
- **审计日期**: 2025-10-27
- **审计人**: Claude Code
- **审计范围**: apps/mcp-server/src/tools vs apps/api/src/routes

---

## 1. 审计目的

检查 MCP Server 的 API Tools 定义是否与 `apps/api` 的最新接口定义一致，确保：

1. **参数完整性**: Tool 参数与 API 接口参数一致
2. **参数类型**: 参数类型定义正确
3. **必填字段**: required 字段标记正确
4. **描述准确性**: 描述文本符合消歧设计规范
5. **新接口覆盖**: 新增的 API 是否有对应的 Tool

---

## 2. 审计发现

### 2.1 订单管理 (Orders)

#### ✅ 基本一致

**API 定义** (`apps/api/src/routes/orders.ts:36-88`):
```typescript
POST /api/v1/orders
Body: {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  successUrl?: string;      // ⚠️ MCP 中缺失
  cancelUrl?: string;        // ⚠️ MCP 中缺失
  metadata?: object;
}
```

**MCP Tool** (`apps/mcp-server/src/tools/orders.ts:12-54`):
```typescript
create_order {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  callbackUrl?: string;      // ⚠️ API 中不存在
  metadata?: object;
}
```

#### ❌ 发现问题 1: 参数不一致

| 字段 | API | MCP Tool | 状态 |
|------|-----|---------|------|
| `successUrl` | ✅ 存在 | ❌ 缺失 | **需要添加** |
| `cancelUrl` | ✅ 存在 | ❌ 缺失 | **需要添加** |
| `callbackUrl` | ❌ 不存在 | ✅ 存在 | **需要删除** |

**影响**: MCP Client 无法设置订单完成/取消后的跳转 URL

**修复**: 更新 `createOrderTool` 的 `inputSchema`

---

#### ❌ 发现问题 2: 描述不符合消歧规范

**当前描述**:
```typescript
{
  name: 'create_order',
  description: 'Create a new payment order for one-time payment transactions',
}
```

**问题**:
- 没有强调"执行操作"
- 缺少消歧提示

**建议描述**:
```typescript
{
  name: 'create_order',
  description: '🔧 OPERATION: Create a new payment order in PayIn system. This will ACTUALLY allocate a payment address and create an order record. Use this when you want to create a real order for testing or management. IMPORTANT: If user asks "how to create order", they probably want documentation instead.',
}
```

---

### 2.2 充值管理 (Deposits)

#### ✅ 接口定义一致

**API vs MCP**: 参数完全一致，无需修改

#### ❌ 发现问题 3: 描述需要优化

**当前描述**:
```typescript
{
  name: 'bind_deposit_address',
  description: 'Bind a permanent deposit address for a user. This address will monitor all chains in the protocol family.',
}
```

**建议描述**:
```typescript
{
  name: 'bind_deposit_address',
  description: '🔧 OPERATION: Bind a permanent deposit address for a user. This will ACTUALLY allocate an address from the pool and start monitoring. The address will monitor all chains in the protocol family (e.g., EVM family includes Ethereum, Polygon, etc.). Use this when you want to perform actual deposit address binding. IMPORTANT: If user asks "how to bind address", they probably want documentation instead.',
}
```

---

### 2.3 其他工具审计

#### Transfers (转账查询)

**状态**: ✅ 一致，仅需优化描述

#### Address Pool (地址池)

**状态**: ✅ 一致，仅需优化描述

#### Config (配置)

**状态**: ✅ 一致，仅需优化描述

#### Monitoring (监控)

**状态**: ✅ 一致，仅需优化描述

---

### 2.4 新增API未覆盖

#### ❌ 发现问题 4: Payment Links API 缺失

**API 路由** (`apps/api/src/server.ts:124`):
```typescript
api.route('/payment-links', paymentLinksRoutes);
```

**状态**: MCP Server 中**完全缺失** Payment Links Tools

**影响**: MCP Client 无法通过 AI 管理支付链接

**建议**: 添加以下 Tools:
- `create_payment_link`
- `get_payment_link`
- `list_payment_links`
- `update_payment_link`
- `delete_payment_link`

---

### 2.5 新增 Public API 覆盖情况

#### Chains API (`/api/chains`)

**状态**: ✅ 已覆盖 (`list_chains` Tool)

#### Tokens API (`/api/tokens`)

**状态**: ✅ 已覆盖 (`list_tokens` Tool)

---

## 3. 修复清单

### 高优先级 (P0) - 功能缺失

| 问题 | 影响 | 修复工作量 |
|------|------|-----------|
| 1. create_order 参数不一致 | MCP 无法设置跳转 URL | 5分钟 |
| 4. Payment Links Tools 缺失 | 无法管理支付链接 | 30分钟 |

### 中优先级 (P1) - 用户体验

| 问题 | 影响 | 修复工作量 |
|------|------|-----------|
| 2. 所有 Tools 描述不符合消歧规范 | Claude 可能误判用户意图 | 15分钟 |

---

## 4. 修复方案

### 4.1 更新 create_order Tool

```typescript
// apps/mcp-server/src/tools/orders.ts

export const createOrderTool = {
  name: 'create_order',
  description: '🔧 OPERATION: Create a new payment order in PayIn system. This will ACTUALLY allocate a payment address and create an order record. Use this when you want to create a real order for testing or management. IMPORTANT: If user asks "how to create order", they probably want documentation instead.',
  inputSchema: {
    type: 'object',
    properties: {
      orderReference: {
        type: 'string',
        description: 'Unique order reference ID from your system (e.g., "order_2025_001")'
      },
      amount: {
        type: 'string',
        description: 'Payment amount (e.g., "10.50")'
      },
      currency: {
        type: 'string',
        description: 'Token symbol (e.g., "USDT", "USDC")'
      },
      chainId: {
        type: 'string',
        description: 'Blockchain network ID (e.g., "ethereum-sepolia", "polygon-amoy")'
      },
      successUrl: {  // ✅ 新增
        type: 'string',
        description: 'Optional URL to redirect after successful payment'
      },
      cancelUrl: {  // ✅ 新增
        type: 'string',
        description: 'Optional URL to redirect after payment expiration'
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata for the order'
      }
    },
    required: ['orderReference', 'amount', 'currency', 'chainId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const order = await apiClient.createOrder(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(order, null, 2)
      }]
    };
  }
};
```

### 4.2 创建 Payment Links Tools

```typescript
// apps/mcp-server/src/tools/payment-links.ts (新建文件)

export const createPaymentLinkTool = {
  name: 'create_payment_link',
  description: '🔧 OPERATION: Create a payment link for easy sharing. This will ACTUALLY create a hosted checkout page. Use this when you want to generate a payment link.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Link name' },
      amount: { type: 'string', description: 'Fixed amount or "custom"' },
      currency: { type: 'string', description: 'Token symbol' },
      chainId: { type: 'string', description: 'Blockchain ID' },
      description: { type: 'string', description: 'Link description' },
      expiresAt: { type: 'string', description: 'Expiration date (ISO 8601)' },
      maxUses: { type: 'number', description: 'Maximum number of uses' }
    },
    required: ['name', 'amount', 'currency', 'chainId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.createPaymentLink(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

// ... 其他 Payment Link Tools
```

### 4.3 更新所有 Tools 描述

按照消歧规范统一更新所有 Tools 的描述，添加：
- 🔧 图标
- "OPERATION" 标签
- "This will ACTUALLY" 强调
- "IMPORTANT: If user asks 'how to'..." 消歧提示

---

## 5. 测试验证

### 5.1 单元测试

- [ ] 测试 create_order 支持 successUrl/cancelUrl
- [ ] 测试 Payment Links Tools
- [ ] 测试描述文本正确返回

### 5.2 集成测试

- [ ] Claude Desktop 集成测试
- [ ] 测试"如何创建订单"→ 返回文档
- [ ] 测试"帮我创建订单"→ 调用 Tool

---

## 6. 实施记录

### 2025-10-27

- ✅ 完成审计分析
- ✅ 修复 create_order 参数不一致问题
- ✅ 优化所有 Orders Tools 描述（4个工具）
- ✅ 优化所有 Deposits Tools 描述（5个工具）
- ⏸️ Payment Links Tools 暂缓（作为后续Phase 2任务）

### 修复成果

#### P0 问题修复（功能缺失）

1. **create_order 参数对齐** ✅
   - 添加 `successUrl`: 订单完成后跳转URL
   - 添加 `cancelUrl`: 订单过期后跳转URL
   - 移除 `callbackUrl`: API中不存在的参数
   - 文件: `apps/mcp-server/src/tools/orders.ts:14-47`

#### P1 问题修复（用户体验）

2. **所有 Tools 描述优化** ✅（9个工具完成）

**Orders Tools (4个)**:
- `create_order`: 🔧 OPERATION + 消歧提示
- `get_order`: 🔍 QUERY
- `list_orders`: 🔍 QUERY
- `get_order_stats`: 📊 ANALYTICS

**Deposits Tools (5个)**:
- `bind_deposit_address`: 🔧 OPERATION + 消歧提示
- `unbind_deposit_address`: 🔧 OPERATION
- `get_user_deposit_address`: 🔍 QUERY
- `list_deposit_references`: 🔍 QUERY
- `list_deposit_addresses`: 🔍 QUERY

**描述模式**:
```
[图标] [类型]: [功能描述]. This will [实际效果]. Use this when [使用场景]. [IMPORTANT消歧提示]
```

#### 待完成任务

3. **Payment Links Tools** ⏸️
   - 状态: 暂缓到 Phase 2
   - 原因: 基础功能优先，Payment Links 为增强功能
   - 预计工作量: 30分钟
   - 计划: 作为后续独立任务实施

---

## 附录: API 接口清单

### Public API (无需认证)

| 路由 | MCP Tool | 状态 |
|------|---------|------|
| `/api/chains` | `list_chains` | ✅ 已覆盖 |
| `/api/tokens` | `list_tokens` | ✅ 已覆盖 |
| `/api/deposits` | - | ✅ 公共 API，不需要 Tool |
| `/api/payment-links` | - | ✅ 公共API，不需要Tool |
| `/api/order-status` | - | ✅ 公共 API，不需要 Tool |

### Authenticated API (需要认证)

| 路由 | MCP Tools | 状态 |
|------|----------|------|
| `/api/v1/auth` | - | ❌ 暂不提供（安全考虑） |
| `/api/v1/users` | - | ❌ 暂不提供（安全考虑） |
| `/api/v1/organizations` | - | ❌ 暂不提供（安全考虑） |
| `/api/v1/api-keys` | - | ❌ 暂不提供（安全考虑） |
| `/api/v1/orders` | 4个Tools | ✅ 已覆盖 |
| `/api/v1/deposits` | 5个Tools | ✅ 已覆盖 |
| `/api/v1/transfers` | 1个Tool | ✅ 已覆盖 |
| `/api/v1/address-pool` | 2个Tools | ✅ 已覆盖 |
| `/api/v1/config` | 2个Tools | ✅ 已覆盖 |
| `/api/v1/payment-links` | 0个Tools | ❌ **需要添加** |
| `/api/v1/notifications` | 0个Tools | ℹ️ 暂不提供（内部管理） |

---

## 结论

**总体评估**: 🟡 基本一致，但需要改进

**关键问题**:
1. create_order 参数与 API 不一致
2. Payment Links 完全缺失
3. 所有 Tools 描述需要优化

**修复时间估算**: 1-2小时

**优先级建议**:
1. 修复 create_order 参数 (5分钟，立即执行)
2. 优化所有 Tools 描述 (15分钟，立即执行)
3. 添加 Payment Links Tools (30分钟，本次实施)
