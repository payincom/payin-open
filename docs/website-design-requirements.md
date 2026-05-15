# PayIn 官网设计需求文档

## 产品定位
Non-custodial Stablecoin Payment Processor

## 设计原则

### 视觉风格
- **参考对象**: Stripe, Coinbase
- **色彩方案**: 黑色主色调 + 白色背景 + 灰色层次
- **字体**: IBM Plex Sans
- **图标**: Lucide React + 官方品牌图标
- **设计元素**: 色块、卡片、图标，避免渐变色和 emoji

### 技术栈
- **框架**: Next.js 14 (App Router)
- **UI 库**: shadcn/ui (React)
- **样式**: Tailwind CSS
- **国际化**: 中英文切换
- **响应式**: 移动端优化

## 页面结构

### 1. Hero Section
**核心信息**:
- 大标题: 突出 "Non-custodial Stablecoin Processor"
- 副标题: 简短描述核心价值
- CTA 按钮: "Try on Testnet" → testnet.payin.com
- **视觉元素**: Admin 后台截图展示位（待补充）

### 2. Quick Start Section
**主题**: 三种快速开始方式

**方式一: MCP Server 集成**
- 安装 MCP Server 到 AI 客户端
- AI 辅助快速集成到业务系统
- **交互形式**: 模拟 AI 对话展示
  - 场景 1: 系统集成对话（创建订单、配置 webhook）
  - 场景 2: 运营分析对话（查询数据、生成报表）

**方式二: Payment Link**
- 无需集成，直接生成收款链接
- 适用场景: 活动报名、咨询服务、门票销售

**方式三: 管理运营**
- 通过后台查看业务数据
- 管理订单和充值记录

### 3. Multi-Chain & Multi-Coin Section
**核心价值**: 丰富的支付选择，免去兑换麻烦

**支持的稳定币**:
- USDT, USDC, DAI, USD1 等

**支持的区块链**:
- Ethereum
- Polygon (Layer 2)
- Tron
- Solana

**视觉呈现**:
- 币种和链的官方图标展示
- 图标资源: 从网络下载官方 Logo

### 4. Non-Custodial Section
**核心价值**: 资金安全，用户掌控

**关键信息**:
- 资金直达用户钱包，不经过 PayIn
- 钱包地址由客户提供
- PayIn 不掌控私钥
- PayIn 提供地址管理工具（生成地址、资金归集）

**视觉呈现**:
- 可视化展示资金流向
- 突出"直达"和"安全"概念

### 5. Payment Link Section
**核心价值**: 便捷收款，无需系统集成

**功能说明**:
- 生成收款链接
- 直接向用户收款
- 无需技术集成

**应用场景**:
- 活动报名
- 咨询服务
- 门票销售
- 课程培训
- 小额交易

**视觉元素**: Payment Link 界面截图位（待补充）

### 6. Deposit Service Section
**核心价值**: 为每个用户提供专属充值地址

**功能说明**:
- 每个用户一个唯一充值地址
- 自动检测到账
- Webhook 通知业务系统

**应用场景**:
- 游戏充值
- 会员系统
- 平台钱包
- 积分充值

### 7. HTTP402 Protocol Section
**核心价值**: Pay-as-you-go，无需注册订阅

**协议说明**:
- HTTP 402 Payment Required 标准
- 按需付费模式
- 无需用户注册

**应用场景**:
- API 服务付费
- AI Agent 按次计费
- 内容按需购买

**视觉呈现**:
- 协议工作流程可视化
- 突出"即用即付"概念

### 8. Call to Action Section
**核心信息**:
- 鼓励用户在测试网试用
- 链接: testnet.payin.com
- 说明需要注册账号
- 强调免费试用

## 待准备资源

### 截图
- [ ] Admin 后台界面截图
- [ ] Payment Link 界面截图

### 图标资源
- [ ] USDT Logo
- [ ] USDC Logo
- [ ] DAI Logo
- [ ] USD1 Logo
- [ ] Ethereum Logo
- [ ] Polygon Logo
- [ ] Tron Logo
- [ ] Solana Logo

### 内容
- [ ] HTTP402 协议调研报告
- [ ] 中英文文案

## 开发计划

### 阶段性开发
1. **Phase 1**: 建立技术框架和设计规范
2. **Phase 2**: 逐个 Section 开发
   - 每个 Section 独立完成后再进行下一个
   - 保持灵活性和创造性
3. **Phase 3**: 整体优化和细节调整

### 设计规范
- 统一的间距系统
- 一致的动效规范
- 响应式断点定义
- 颜色系统定义
- 排版规范

## 注意事项

- 保持专业、简洁的视觉风格
- 避免过度设计
- 重视用户体验和信息传达
- SEO 友好的内容结构
- 移动端优先的响应式设计
