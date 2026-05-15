# PayIn Open 文档结构规划

基于 PayIn 产品体系和 PayIn Open 商家部署定位，为 docs.payin.com / GitHub Pages (VitePress) 规划的文档结构。

## 设计原则

1. **用户视角优先** - 从用户关注的问题出发
2. **分层递进** - 从概念 → 配置 → 集成 → 进阶
3. **实用为主** - 提供可操作的步骤和示例
4. **与主站呼应** - 承接 payin.com 的 "View More" 链接

---

## 一、文档结构设计

### Level 1: Getting Started（快速开始）

**目标用户**: 第一次接触 PayIn Open 的商家、AI-assisted deployer 和开发者

#### 1.1 Introduction（介绍）
✅ 已完成
- PayIn 是什么
- 核心特性
- 架构概览
- 使用场景

#### 1.2 Quick Start with MCP Server（通过 MCP Server 快速开始）⭐ 优先
🆕 待创建
**推荐的 Onboarding 方式**

**步骤 1: 注册账号**
- 访问 testnet.payin.com
- 注册账号并登录

**步骤 2: 生成 API Key**
- 进入 Admin 后台
- 导航到 Settings → API Keys
- 创建新的 API Key
- 复制保存 API Key

**步骤 3: 配置 MCP Client**
- 安装 Claude Desktop（或其他 MCP Client）
- 添加 PayIn MCP Server 配置：
  ```json
  {
    "mcpServers": {
      "payin": {
        "url": "https://mcp.payin.com",
        "transport": {
          "type": "sse"
        },
        "headers": {
          "X-API-Key": "your-api-key-here"
        }
      }
    }
  }
  ```

**步骤 4: 开始对话**
- 打开 Claude Desktop
- 开始与 AI 对话，询问关于 PayIn 的问题
- AI 将通过 MCP Server 获取实时信息

**无 API Key 模式**：
- 即使不配置 API Key，也可以对话
- 只读模式：可以了解 PayIn 功能、查看文档
- 无法执行操作：不能创建订单、查询数据等
- 适合评估和学习阶段

**示例对话**：
```
你: 如何创建一个订单？
AI: [读取 MCP Resources] 创建订单需要调用 POST /api/v1/orders...
    [如果有 API Key] 我可以帮你创建一个测试订单，需要什么配置？
```

#### 1.3 Quick Start (Traditional)（传统快速开始）
🆕 待创建
**适合不使用 MCP 的开发者**

- 注册账号（testnet.payin.com）
- 获取 API Key
- 第一个 API 调用
- 第一笔测试支付

#### 1.4 Testnet vs Mainnet（测试网与主网）
🆕 待创建
- 测试网系统：testnet.payin.com
- 主网系统：app.payin.com（占位）
- 何时使用测试网
- 何时切换到主网
- 两套系统的差异

#### 1.5 Supported Networks（支持的网络）
🆕 待创建
- **测试网络**：
  - Ethereum Sepolia
  - Polygon Amoy
  - Tron Shasta
  - Solana Devnet
- **主网络**：
  - Ethereum Mainnet
  - Polygon Mainnet
  - Tron Mainnet
  - Solana Mainnet
- 每个网络的 Chain ID
- RPC 端点
- 区块浏览器链接

#### 1.6 Supported Tokens（支持的代币）
🆕 待创建
- **稳定币列表**：USDT, USDC, DAI, USD1
- **测试网合约地址表格**：
  ```
  | Token | Ethereum Sepolia | Polygon Amoy | Tron Shasta | Solana Devnet |
  |-------|-----------------|--------------|-------------|---------------|
  | USDT  | 0x...           | 0x...        | T...        | ...           |
  | USDC  | 0x...           | 0x...        | T...        | ...           |
  ```
- **主网合约地址表格**（同上）
- **如何获取测试币**：
  - Sepolia Faucet 链接
  - Polygon Faucet 链接
  - Tron Faucet 链接
  - Solana Faucet 链接
  - 如何通过 Faucet 获得测试 USDT/USDC

---

### Level 2: Core Features（核心特性）

**目标**: 对应 payin.com 的特性章节，提供深度内容

#### 2.1 Non-Custodial Architecture（资金非托管架构）
🆕 待创建
**对应主站**: Non-Custodial Section

**内容**：
- **什么是 Non-Custodial**
  - 资金直达用户钱包
  - PayIn 不存储私钥
  - 用户完全掌控资金

- **地址管理方案**
  - HD 钱包模式（推荐）
  - 自管理模式
  - 两种模式的对比

- **Address Pool 工作原理**
  - 地址池的作用
  - 地址分配机制（LRU）
  - 地址冷却期
  - 地址回收复用

- **如何配置 Address Pool**
  - 使用 address-tool 生成地址
  - 导入地址到 PayIn
  - 批量管理地址

- **资金归集**
  - 为什么需要归集
  - 如何使用 address-tool 归集资金
  - 归集策略建议

- **下载 Address Tool**
  - 下载链接（占位）
  - 安装指南
  - 基本使用教程

#### 2.2 Multi-Chain & Multi-Coin（多链多币）
🆕 待创建
**对应主站**: Multi-Chain & Multi-Coin Section

**内容**：
- **为什么支持多链**
  - 降低交易费用
  - 提高交易速度
  - 满足不同用户偏好

- **支持的区块链**
  - Ethereum（安全性高，gas 贵）
  - Polygon（Layer 2，快速便宜）
  - Tron（低费用，亚洲流行）
  - Solana（高性能）

- **支持的稳定币**
  - USDT（最流行）
  - USDC（Circle 发行）
  - DAI（去中心化）
  - USD1（新兴）

- **如何选择链和币**
  - 用户群体考虑
  - 费用考虑
  - 速度考虑
  - 实际案例

#### 2.3 Payment Link（支付链接）
🆕 待创建
**对应主站**: Payment Link Section

**内容**：
- **什么是 Payment Link**
  - 无需集成的收款方式
  - 生成链接直接收款
  - 适合非技术用户

- **使用场景**
  - 活动报名
  - 咨询服务
  - 门票销售
  - 课程培训
  - 小额交易

- **如何创建 Payment Link**
  - 通过 Admin 后台创建
  - API 方式创建
  - 配置选项说明

- **Payment Link 的工作流程**
  - 用户访问链接
  - 选择支付方式（链+币）
  - 扫码/复制地址支付
  - 自动确认到账
  - 跳转回商户页面（可选）

- **自定义 Payment Link**
  - 自定义金额
  - 自定义描述
  - 自定义成功页面
  - Logo 和品牌

#### 2.4 Deposit Service（充值服务）
🆕 待创建
**对应主站**: Deposit Service Section

**内容**：
- **什么是 Deposit Service**
  - 为每个用户分配专属充值地址
  - 自动检测到账
  - 支持多次充值

- **使用场景**
  - 游戏平台充值
  - 会员系统
  - 平台钱包
  - 积分充值

- **如何集成 Deposit Service**
  - 为用户绑定充值地址
  - 展示充值地址给用户
  - 接收 Webhook 通知
  - 更新用户余额

- **Deposit vs Order Payment**
  - 两种服务的区别
  - 何时用哪种服务
  - 能否同时使用

#### 2.5 HTTP 402 Protocol（按需付费协议）
🆕 待创建（可选，看是否真正支持）
**对应主站**: HTTP402 Protocol Section

**内容**：
- **什么是 HTTP 402**
  - Pay-as-you-go 模式
  - 无需注册订阅
  - 即用即付

- **工作流程**
  - Client 请求资源
  - Server 返回 402 + Payment Info
  - Client 支付
  - Server 验证支付并返回资源

- **适用场景**
  - API 服务按次计费
  - AI Agent 调用 API
  - 内容按需购买

- **如何实现**
  - Server 端集成
  - Client 端集成
  - 完整示例代码

---

### Level 3: Integration Guide（集成指南）

**目标**: 帮助开发者完成技术集成

#### 3.1 MCP Server Advanced Usage（MCP Server 进阶用法）
🆕 待创建
**对应主站**: MCP Server Quick Start

**内容**：
- **AI 辅助开发场景**
  - **场景 1**: 系统集成咨询
    - 询问如何创建订单
    - AI 提供代码示例
    - AI 帮助配置 webhook
    - AI 解释最佳实践

  - **场景 2**: 实时测试和调试
    - 通过对话创建测试订单
    - 查询订单状态
    - 模拟支付流程
    - 验证 webhook 配置

- **AI 辅助运营场景**
  - **场景 3**: 数据查询和分析
    - 查询今日订单数据
    - 生成收入报表
    - 分析支付成功率
    - 对比不同链的表现

  - **场景 4**: 问题排查
    - 查询失败订单
    - 分析失败原因
    - 获取解决方案建议

- **MCP Server 架构说明**
  - Tools（操作能力）
  - Resources（文档和数据）
  - 认证和权限

#### 3.2 Order Payment Integration（订单支付集成）
🆕 待创建

**内容**：
- **集成流程**
  1. 创建订单
  2. 展示支付地址/QR码
  3. 等待支付
  4. 接收 Webhook 通知
  5. 标记订单完成

- **完整代码示例**
  - Node.js 示例
  - Python 示例
  - 前端展示页面

- **最佳实践**
  - 订单超时处理
  - 重复支付处理
  - 金额精度处理

#### 3.3 Deposit Service Integration（充值服务集成）
🆕 待创建

**内容**：
- **集成流程**
  1. 用户注册时绑定充值地址
  2. 展示充值地址给用户
  3. 接收充值 Webhook
  4. 更新用户余额

- **完整代码示例**
  - 后端集成
  - 前端展示

- **最佳实践**
  - 地址持久化
  - 余额更新策略
  - 充值历史记录

#### 3.4 Webhook Configuration（Webhook 配置）
🆕 待创建

**内容**：
- **什么是 Webhook**
  - 事件通知机制
  - 推送 vs 拉取

- **支持的事件类型**
  - order.completed（订单完成）
  - order.expired（订单过期）
  - deposit.completed（充值完成）

- **配置 Webhook**
  - 设置 Webhook URL
  - 选择订阅的事件
  - 测试 Webhook

- **Webhook 安全**
  - HMAC 签名验证
  - 重放攻击防护
  - IP 白名单（可选）

- **错误处理和重试**
  - 自动重试机制
  - 指数退避策略
  - 最大重试次数

- **完整示例代码**
  - 验证签名
  - 处理事件
  - 幂等性保证

---

### Level 4: API Reference（API 参考）

**目标**: 完整的 API 文档

#### 4.1 Authentication（认证）
🆕 待创建
- 获取 API Key
- API Key 管理
- 请求头格式
- 错误码

#### 4.2 Orders API（订单 API）
🆕 待创建
- POST /api/v1/orders - 创建订单
- GET /api/v1/orders/:id - 获取订单
- GET /api/v1/orders - 订单列表
- 请求/响应示例
- 参数说明

#### 4.3 Deposits API（充值 API）
🆕 待创建
- POST /api/v1/deposits/bind - 绑定充值地址
- GET /api/v1/deposits - 充值列表
- 请求/响应示例
- 参数说明

#### 4.4 Payment Links API（支付链接 API）
🆕 待创建
- POST /api/v1/payment-links - 创建支付链接
- GET /api/v1/payment-links/:id - 获取支付链接
- PUT /api/v1/payment-links/:id - 更新支付链接
- DELETE /api/v1/payment-links/:id - 删除支付链接

#### 4.5 Other APIs（其他 API）
🆕 待创建
- Chains API
- Tokens API
- Transfers API
- Notifications API

---

### Level 5: Admin Guide（管理后台指南）

**目标**: 帮助非技术用户使用管理后台

#### 5.1 Dashboard Overview（仪表板概览）
🆕 待创建
- 登录管理后台
- 仪表板布局
- 关键指标说明

#### 5.2 Managing Orders（管理订单）
🆕 待创建
- 查看订单列表
- 订单详情
- 订单筛选

#### 5.3 Managing Deposits（管理充值）
🆕 待创建
- 查看充值记录
- 用户充值历史
- 充值统计

#### 5.4 Address Pool Management（地址池管理）
🆕 待创建
- 查看地址池状态
- 导入新地址
- 地址使用情况

#### 5.5 Payment Links（支付链接）
🆕 待创建
- 创建支付链接
- 管理支付链接
- 查看支付记录

---

### Level 6: Advanced Topics（进阶主题）

#### 6.1 Security Best Practices（安全最佳实践）
🆕 待创建
- API Key 安全
- Webhook 安全
- 地址管理安全
- 常见安全问题

#### 6.2 Performance Optimization（性能优化）
🆕 待创建
- Webhook 处理优化
- 并发请求处理
- 缓存策略

#### 6.3 Troubleshooting（故障排查）
🆕 待创建
- 常见问题 FAQ
- 支付未到账
- Webhook 未收到
- API 错误排查

#### 6.4 Migration Guide（迁移指南）
🆕 待创建
- 从测试网迁移到主网
- 配置清单
- 注意事项

---

## 二、优先级排序

### Phase 1: MCP Onboarding 核心文档（1 周）⭐ 最高优先级
1. **Quick Start with MCP Server**（通过 MCP Server 快速开始）
   - 注册 → 生成 API Key → 配置 MCP Client → 开始对话
   - 无 API Key 模式说明
   - 示例对话展示
2. **Testnet vs Mainnet**（测试网与主网）
3. **Supported Networks**（支持的网络）
4. **Supported Tokens**（支持的代币）

### Phase 2: 传统集成文档（1-2 周）
1. Quick Start (Traditional)（传统快速开始）
2. Order Payment Integration（订单支付集成）
3. Webhook Configuration（Webhook 配置）
4. Authentication（API 认证）

### Phase 3: 特性深度文档（2-3 周）
1. Non-Custodial Architecture（资金非托管架构）
2. Payment Link（支付链接）
3. Deposit Service Integration（充值服务集成）
4. MCP Server Advanced Usage（MCP Server 进阶用法）

### Phase 4: 完整 API 参考（1-2 周）
1. Authentication
2. Orders API
3. Deposits API
4. Payment Links API
5. Other APIs

### Phase 5: 管理和进阶（按需）
1. Admin Guide
2. Advanced Topics
3. Multi-Chain & Multi-Coin（深度）

---

## 三、待讨论的问题

### 1. MCP Server 部署和配置
**问题**: MCP Server 的部署信息？
- URL: `mcp.payin.com` 是最终地址吗？
- Transport: 使用 SSE (Server-Sent Events) 协议
- 认证方式: HTTP Header `X-API-Key`
- 当前是否已部署？还是占位符？
- 无 API Key 模式是否已实现？

### 2. 网络和合约地址
**问题**: 测试网和主网的具体合约地址是什么？
- 我需要准确的合约地址填写到文档中
- 或者暂时使用占位符，后续补充？
- 建议格式：创建一个完整的合约地址表格

### 3. Address Tool 下载
**问题**: address-tool 的发布方式？
- 是否会发布到 npm？
- 还是提供二进制下载？
- 下载链接是什么？
- 文档中需要提供安装和使用指南

### 4. HTTP 402 支持
**问题**: 系统是否真正实现了 HTTP 402 协议？
- 如果还未实现，是否需要在文档中保留？
- 还是标记为"Coming Soon"？
- 建议：如果未实现，暂时移除或标记为 Roadmap

### 5. 测试币获取
**问题**: 是否提供官方的测试币 Faucet？
- 还是引导用户使用第三方 Faucet？
- 是否需要提供详细的获取步骤？
- 建议：提供第三方 Faucet 链接 + 详细图文教程

### 6. 文档示例代码
**问题**: 示例代码使用什么语言？
- Node.js + TypeScript（优先）
- Python（可选）
- 其他语言？
- 建议：优先 TypeScript，因为与项目技术栈一致

---

## 四、建议的下一步

### 立即开始（推荐）
基于 MCP Server Onboarding 优先策略，建议从 **Phase 1** 开始：

1. **Quick Start with MCP Server** ⭐ 最高优先级
   - 创建完整的 MCP onboarding 流程文档
   - 包含注册、API Key 生成、配置、使用示例
   - 强调 MCP 作为推荐的入门方式

2. **Testnet vs Mainnet**
   - 说明两套系统的差异
   - 何时使用哪个系统

3. **Supported Networks & Tokens**
   - 创建完整的网络和代币表格
   - 需要你提供准确的合约地址

### 等待确认
在开始编写前，需要你确认：
1. MCP Server 的部署状态（是否已部署到 mcp.payin.com）
2. 合约地址信息（测试网和主网）
3. 文档优先级是否同意（MCP onboarding 优先）

### 实施计划
1. **审阅规划** - 你确认文档结构
2. **回答问题** - 提供缺失的技术信息
3. **开始编写** - 我按 Phase 1 → Phase 2 → Phase 3 顺序创建文档
4. **迭代优化** - 根据反馈调整和完善

---

## 五、文档架构亮点

### 1. MCP Server First 策略
- **降低门槛**: 通过对话了解系统，无需先学习 API
- **AI 辅助**: 从咨询到集成，全程 AI 协助
- **渐进式**: 从对话 → 代码示例 → 实际集成

### 2. 分层设计
- **Level 1**: 快速开始（MCP 优先）
- **Level 2**: 特性深度（对应主站章节）
- **Level 3**: 集成指南（实际开发）
- **Level 4**: API 参考（完整文档）
- **Level 5**: 管理指南（运营人员）
- **Level 6**: 进阶主题（专家用户）

### 3. 双轨并行
- **MCP 轨道**: 适合快速评估和 AI 辅助开发
- **传统轨道**: 适合标准 API 集成

### 4. 实用导向
- 所有文档都包含实际示例
- 提供可复制的代码
- 强调最佳实践和常见陷阱

---

**注**: 这个规划将 MCP Server 提升为最高优先级，作为 PayIn 推荐的 onboarding 方式。所有文档都会提供中英文双语版本。
