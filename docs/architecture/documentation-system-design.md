# PayIn 文档管理系统架构设计

## 文档元信息

- **创建时间**: 2025-10-27
- **最后更新**: 2025-10-27
- **状态**: 实施中
- **版本**: v1.0

---

## 1. 目标与需求

### 1.1 业务目标

提供完整的文档管理系统，支持：

1. **开发者集成指导** - 帮助外部开发者快速集成 PayIn API
2. **运营人员问题排查** - 帮助运营人员诊断和解决问题
3. **AI 辅助服务** - 通过 MCP Server 提供 AI 驱动的文档查询和操作

### 1.2 核心需求

- ✅ 多渠道发布：网站、MCP、搜索
- ✅ 单一数据源：避免文档不一致
- ✅ 自动化部署：文档更新自动同步
- ✅ 智能检索：支持全文搜索和语义查询
- ✅ 多语言支持：中英文双语
- ✅ 低成本运营：尽量使用免费服务

### 1.3 当前状态

```
现有文档：9个文件，126KB
- docs/monitor/          (RPC配置文档，中英双语)
- docs/processor/        (处理器配置文档，中英双语)
- docs/architecture/     (架构设计文档)
- docs/examples/         (示例文档)

现有 MCP Server：
- 硬编码摘要 Resources (5个，约500行)
- API Tools (18个，运营能力)
- Integration Prompts (2个)
```

---

## 2. 整体架构设计

### 2.1 数据流架构

```
┌─────────────────────────────────────────────────────┐
│              单一数据源 (Source of Truth)             │
│                   docs/**/*.md                       │
│              (Git 仓库管理，Markdown 格式)             │
└────────────────┬───────────────────────────────────┘
                 │
                 │ Git Push 触发
                 │
        ┌────────┼────────┬────────┐
        ▼        ▼        ▼        ▼
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │ViteP│  │MCP  │  │搜索 │  │PDF  │
    │ress │  │生成 │  │索引 │  │导出 │
    └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘
       │        │        │        │
       ▼        ▼        ▼        ▼
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │文档 │  │Worker│  │搜索 │  │下载 │
    │网站 │  │Bundle│  │服务 │  │中心 │
    └─────┘  └─────┘  └─────┘  └─────┘
```

### 2.2 技术栈选型

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| **文档编写** | Markdown + Frontmatter | 简单、标准、Git 友好 |
| **网站生成** | VitePress | 快速、现代、Vue 组件支持 |
| **网站托管** | Cloudflare Pages | 免费、快速、全球 CDN |
| **MCP 数据源** | 编译时嵌入 | 零延迟、高可靠 |
| **搜索服务** | VitePress 本地搜索 | 免费、零配置、离线可用 |
| **自动化部署** | GitHub Actions | 免费、易用、集成好 |

### 2.3 文档目录结构

```
payin/
├── docs/                           # 📚 技术文档（单一数据源）
│   ├── guide/                      # 📘 用户指南
│   │   ├── getting-started.md      #   - 快速开始
│   │   ├── order-payment.md        #   - 订单支付集成
│   │   ├── user-deposit.md         #   - 用户充值集成
│   │   ├── webhooks.md             #   - Webhook 配置
│   │   └── troubleshooting.md      #   - 故障排查
│   ├── api/                        # 📗 API 参考
│   │   ├── authentication.md       #   - 认证
│   │   ├── orders.md               #   - 订单 API
│   │   ├── deposits.md             #   - 充值 API
│   │   ├── address-pool.md         #   - 地址池 API
│   │   ├── config.md               #   - 配置 API
│   │   └── errors.md               #   - 错误码参考
│   ├── architecture/               # 📙 架构设计（已有）
│   │   ├── overview.md
│   │   ├── multi-chain.md
│   │   └── ...
│   ├── monitor/                    # 📕 监控系统（已有）
│   ├── processor/                  # 📓 处理器（已有）
│   └── examples/                   # 📔 示例代码（已有）
│
├── apps/docs/                      # 📄 VitePress 文档站点
│   ├── .vitepress/
│   │   ├── config.ts               #   - VitePress 配置
│   │   └── theme/                  #   - 自定义主题
│   ├── en/                         #   - 英文文档
│   │   ├── index.md
│   │   ├── guide/ → ../../docs/guide/  (软链接)
│   │   └── api/ → ../../docs/api/
│   ├── zh/                         #   - 中文文档
│   │   └── ...
│   └── package.json
│
├── apps/mcp-server/                # 🤖 MCP Server
│   ├── src/
│   │   ├── generated/              #   - 自动生成的文档模块
│   │   │   └── docs-content.ts     #   - 编译嵌入的文档内容
│   │   ├── resources/
│   │   │   └── docs.ts             #   - 文档 Resources
│   │   └── tools/
│   │       └── docs-search.ts      #   - 文档搜索 Tool
│   ├── scripts/
│   │   └── generate-docs.js        #   - 文档生成脚本
│   └── package.json
│
└── CLAUDE.md                       # AI 记忆文档（保留）
```

---

## 3. MCP Server 资源与工具消歧设计

### 3.1 问题分析

同时提供**文档 Resources** 和 **API Tools** 时，可能出现歧义：

| 用户提问 | 可能理解 A | 可能理解 B |
|---------|-----------|-----------|
| "如何创建订单？" | 学习集成方法（读文档） | 执行创建操作（调用Tool） |
| "创建订单需要什么参数？" | 查看API文档（读文档） | 尝试创建并看错误（调用Tool） |

### 3.2 解决方案：清晰描述 + 智能消歧

#### 3.2.1 Resources 描述规范

**要点**：强调"学习"、"了解"、"集成"

```typescript
// ✅ 好的 Resource 描述
{
  uri: 'docs://payin/guide/order-payment',
  name: 'Order Payment Integration Guide',
  description: '📚 INTEGRATION GUIDE: Learn how to integrate PayIn order payment into your application. Covers API usage, code examples, webhook setup, and error handling. Read this if you want to understand how to build order payment functionality into your own system.',
  mimeType: 'text/markdown'
}

// ❌ 不好的描述（容易混淆）
{
  uri: 'docs://payin/api/orders',
  description: 'Orders API'  // 太简单，不明确
}
```

**描述模板**：
```
📚 [文档类型]: [学习目标]. [涵盖内容]. Read this if you want to [使用场景].
```

#### 3.2.2 Tools 描述规范

**要点**：强调"执行"、"操作"、"实际"，并添加消歧提示

```typescript
// ✅ 好的 Tool 描述
{
  name: 'create_order',
  description: '🔧 OPERATION: Create a new payment order in the PayIn system. This will ACTUALLY allocate a payment address and create an order record. Use this when you want to create a real test order or perform order management operations through AI. IMPORTANT: If user asks "how to create order", they probably want documentation instead.',
  inputSchema: { ... }
}

// ❌ 不好的描述（容易混淆）
{
  name: 'create_order',
  description: 'Create order'  // 太简单
}
```

**描述模板**：
```
🔧 OPERATION: [操作动作]. This will ACTUALLY [实际效果]. Use this when you want to [使用场景]. IMPORTANT: If user asks "how to...", they probably want documentation instead.
```

#### 3.2.3 图标约定

| 图标 | 类型 | 含义 |
|------|------|------|
| 📚 | Resource | 学习指南、教程 |
| 📖 | Resource | API 参考文档 |
| 🔧 | Tool | 执行操作 |
| 🔍 | Tool | 查询数据 |
| 📊 | Tool | 生成报告 |
| 🎓 | Prompt | 学习模式 |
| ⚙️ | Prompt | 运营模式 |

### 3.3 Claude 判断机制

#### 3.3.1 基于措辞判断

| 用户意图 | 关键词 | Claude 选择 |
|---------|--------|------------|
| 学习集成 | "如何"、"怎么"、"什么是"、"集成"、"了解" | **Resources** |
| 执行操作 | "帮我"、"请"、"创建一个"、具体参数值 | **Tools** |

#### 3.3.2 示例对话流程

**场景 1: 学习模式**
```
用户: "如何在我的应用中集成订单支付？"
  ↓
Claude 判断:
  - 关键词 "如何" + "集成" → 学习意图
  - 匹配 Resource: "📚 Learn how to integrate..."
  ↓
Claude 行为: 读取 docs://payin/guide/order-payment
  ↓
Claude 回答: "要集成订单支付，分3步：
1. 调用 API 创建订单...
2. 展示支付信息...
3. 监听 Webhook...

这是示例代码：
```js
const order = await createOrder({...})
```

想测试一下吗？我可以帮你创建一个真实的测试订单。"
```

**场景 2: 执行模式**
```
用户: "帮我创建一个测试订单，0.01 USDT，Sepolia"
  ↓
Claude 判断:
  - 关键词 "帮我" + 具体参数 → 执行意图
  - 匹配 Tool: "🔧 OPERATION: This will ACTUALLY create..."
  ↓
Claude 行为: 调用 create_order Tool
  ↓
Claude 回答: "✅ 测试订单创建成功！

支付地址: 0x1234...
金额: 0.01 USDT

需要我解释如何在你的代码中实现同样的功能吗？"
```

**场景 3: 混合模式（完美体验）**
```
用户: "如何创建订单？"
Claude: [读文档] "创建订单需要调用 POST /api/v1/orders..."

用户: "我理解了，帮我创建一个试试"
Claude: [调用 Tool] "订单已创建，地址是..."

用户: "如果地址池不足会怎样？"
Claude: [搜索文档] "会返回错误码 ADDRESS_POOL_EXHAUSTED..."
```

---

## 4. 实施计划

### Phase 1: 基础搭建（本次实施）

#### 4.1 创建文档生成脚本
- [ ] 创建 `apps/mcp-server/scripts/generate-docs.js`
- [ ] 实现 Markdown 文件读取
- [ ] 生成 TypeScript 模块
- [ ] 提供搜索功能

#### 4.2 更新 MCP Server API Tools
- [ ] 检查 `apps/api` 的最新接口定义
- [ ] 对比 `apps/mcp-server/src/tools` 的实现
- [ ] 更新不一致的接口
- [ ] 优化描述文本（消歧）

#### 4.3 集成文档到 MCP Server
- [ ] 更新 Resources 描述
- [ ] 添加文档搜索 Tool
- [ ] 更新构建流程
- [ ] 本地测试验证

### Phase 2: 文档网站（后续实施）

- [ ] 创建 VitePress 配置
- [ ] 迁移现有文档
- [ ] 编写用户指南
- [ ] 编写 API 参考
- [ ] 配置多语言

### Phase 3: 自动化部署（后续实施）

- [ ] 配置 Cloudflare Pages
- [ ] 编写 GitHub Actions
- [ ] 测试自动部署

---

## 5. 实施记录

### 2025-10-27: 初始化 + API 审计 + Tools 修复

- ✅ 创建架构设计文档
- ✅ 检查 apps/api 的最新接口定义
- ✅ 检查 apps/mcp-server 的 API Tools 定义
- ✅ 创建 API 审计报告 (docs/architecture/mcp-api-tools-audit.md)
- ✅ 修复 MCP Server API Tools
  - ✅ create_order 参数修复 (添加 successUrl/cancelUrl，移除 callbackUrl)
  - ✅ 所有 Orders Tools 描述优化 (符合消歧规范)
  - ✅ 所有 Deposits Tools 描述优化 (符合消歧规范)
- ⏸️ Payment Links Tools（暂缓，作为后续任务）

**修复详情**:
1. **create_order 参数对齐**:
   - 添加 `successUrl` 参数（订单完成后跳转URL）
   - 添加 `cancelUrl` 参数（订单过期后跳转URL）
   - 移除 `callbackUrl` 参数（API 中不存在）

2. **描述优化**（所有 9 个 Tools）:
   - 添加图标：🔧 (OPERATION)、🔍 (QUERY)、📊 (ANALYTICS)
   - 强调实际操作："This will ACTUALLY..."
   - 添加消歧提示："IMPORTANT: If user asks 'how to'..."
   - 明确使用场景："Use this when you want to..."

3. **受影响文件**:
   - `apps/mcp-server/src/tools/orders.ts` (4个工具)
   - `apps/mcp-server/src/tools/deposits.ts` (5个工具)

---

## 6. 参考资料

- [MCP 协议规范](https://modelcontextprotocol.io)
- [VitePress 文档](https://vitepress.dev)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [PayIn CLAUDE.md](../../CLAUDE.md)

---

## 7. 附录

### 7.1 成本分析

| 项目 | 服务 | 成本 |
|------|------|------|
| 文档站点托管 | Cloudflare Pages | 免费 |
| MCP Server | Cloudflare Workers | 免费（10万请求/天） |
| 搜索服务 | VitePress 本地搜索 | 免费 |
| CI/CD | GitHub Actions | 免费（2000分钟/月） |
| **总计** | | **$0/月** |

### 7.2 预期效果

**文档访问**：
- 网站访问速度: < 100ms
- MCP 响应时间: < 50ms
- 搜索响应时间: < 100ms

**用户体验**：
- 开发者可通过网站快速查找文档
- AI 助手可准确理解用户意图
- 学习和操作模式无缝切换

**维护成本**：
- 文档更新：Git commit 即可
- 自动部署：无需人工干预
- 零运营成本
