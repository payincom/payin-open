# 支付链接

支付链接让您无需编写任何代码即可接受加密货币支付。创建一个可分享的链接，发送给您的客户，然后收款 - 就是这么简单。

## 什么是支付链接？

支付链接是您通过 PayIn 管理后台创建的无代码支付 URL。通过电子邮件、即时通讯应用或社交媒体分享链接，客户可以立即使用加密货币支付。

**主要特性：**
- 🚫 **无需代码** - 通过管理界面创建链接
- 🔗 **随处分享** - 电子邮件、WhatsApp、社交媒体、二维码
- 💰 **灵活定价** - 固定金额或自定义金额
- 🌐 **多链支持** - 支持多个网络和代币
- 📊 **追踪支付** - 在仪表板中监控所有支付
- 📦 **库存控制** - 限制门票/产品数量

## 支付链接 vs 订单 API

了解何时使用支付链接：

| 功能 | 支付链接 | 订单支付 API |
|---------|---------------|-------------------|
| **设置** | 无需代码 - 仅管理界面 | 需要开发 |
| **分享** | 公开 URL/二维码 | 程序化集成 |
| **使用场景** | 手动分享、简单需求 | 自动化系统、电子商务 |
| **自定义** | 有限（通过界面） | 完全控制（通过代码） |
| **支付追踪** | 仅仪表板 | 仪表板 + Webhook + API |
| **最适合** | 自由职业者、小型企业 | 开发者、有系统的企业 |

**何时使用支付链接：**
- 自由职业者开票
- 活动门票销售
- 课程报名费
- 咨询服务付款
- 捐赠收集
- 小型企业支付
- 一次性产品销售

## 快速开始

### 步骤 1：创建您的第一个支付链接

1. 登录到 [PayIn 管理后台](https://your-payin.example.com)
2. 在侧边栏导航到 **支付链接**
3. 点击 **创建支付链接**
4. 填写详细信息：
   - **标题**: "咨询服务 - 1 小时"
   - **金额**: 50 USDT
   - **货币**: 选择 USDT
   - **链**: 选择 ethereum-sepolia、polygon-amoy
5. 点击 **创建草稿**

### 步骤 2：自定义（可选）

- 添加 **描述**: 解释支付的用途
- 设置 **库存**: 限制为特定数量（例如 10 张门票）
- 设置 **过期时间**: 在某个日期后自动过期
- 添加 **元数据**: 追踪内部信息

### 步骤 3：发布

1. 在您的支付链接上点击 **发布**
2. 生成唯一的 URL（例如 `payin.com/p/abc123XYZ`）
3. 复制链接或二维码

### 步骤 4：分享

通过以下方式分享您的支付链接：
- 📧 **电子邮件**: 复制并粘贴链接
- 💬 **即时通讯**: WhatsApp、Telegram 等
- 📱 **二维码**: 下载并打印
- 🌐 **网站**: 将链接添加到您的网站
- 📱 **社交媒体**: 在 Twitter、Facebook 上分享

### 步骤 5：收款

1. 客户点击您的链接
2. 客户选择链并支付
3. 您收到通知
4. 支付显示在仪表板中

::: tip 先测试
在向客户分享主网链接之前，使用测试网链接测试完整流程。
:::

## 创建支付链接

### 基础支付链接

**最少必填字段：**

```json
{
  "title": "咨询服务 - 1 小时",
  "amount": "50",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**客户看到的内容：**
- 标题："咨询服务 - 1 小时"
- 价格：50 USDT
- 可用链：Ethereum Sepolia、Polygon Amoy
- 客户选择链并支付

### 带描述的支付链接

```json
{
  "title": "Web 开发课程",
  "description": "完整的 12 周课程，包括：\n• 前端开发\n• 后端 API\n• 部署指南\n• 终身访问",
  "amount": "299",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**优势：**
- 清楚地解释他们支付的内容
- 建立信任并减少困惑
- 支持 markdown 格式

### 多货币支付链接

```json
{
  "title": "高级会员",
  "amount": "99",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "amount": "99"
    }
  ]
}
```

**客户看到的内容：**
- 可以在 USDT 或 USDC 之间选择
- 两种货币价格相同
- 所有支持的链都可用

### 限量库存支付链接

```json
{
  "title": "VIP 活动门票",
  "description": "2025 年度技术大会\n日期：6 月 15-17 日\n地点：旧金山",
  "amount": "500",
  "inventoryTotal": 100,
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia"],
      "is_primary": true
    }
  ]
}
```

**功能：**
- 限制为 100 张门票
- 向客户显示"剩余 X 张"
- 售罄时自动停止接受支付
- 追踪预留（待支付）与已售（已完成）

### 限时支付链接

```json
{
  "title": "早鸟折扣",
  "description": "限时优惠 - 截止至 2025 年 12 月 31 日",
  "amount": "79",
  "expiresAt": "2025-12-31T23:59:59Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**功能：**
- 在指定的日期/时间自动过期
- 过期后客户无法支付
- 在支付页面显示倒计时

### 自定义金额支付链接

```json
{
  "title": "捐赠",
  "description": "支持我们的开源项目",
  "amount": "0",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**功能：**
- 客户输入自己的金额
- 适用于捐赠、小费、可变定价
- 设置金额为"0"表示自定义金额

::: warning 自定义金额验证
在支付页面设置最小金额验证，以避免可能无法覆盖交易成本的极小支付。
:::

## 管理支付链接

### 链接状态

支付链接有两种状态：

**1. 草稿** (`draft`)
- 不可公开访问
- 可以自由编辑
- 尚未分配 slug/URL
- 用于准备和测试

**2. 已发布** (`published`)
- 可通过唯一 URL 公开访问
- 编辑受限（无法更改定价基础）
- 有唯一的 slug（例如 `abc123XYZ`）
- 准备给客户使用

::: tip 发布工作流程
创建草稿链接 → 内部测试 → 准备就绪时发布 → 与客户分享
:::

### 编辑支付链接

**始终可以编辑：**
- ✅ 标题
- ✅ 描述
- ✅ 库存总数（可以增加或减少）
- ✅ 过期日期
- ✅ 元数据

**发布后不能编辑：**
- ❌ 金额（改为创建新链接）
- ❌ 货币
- ❌ 链选项
- ❌ Slug（发布时自动生成）

**进行重大更改：**
1. 归档旧链接
2. 创建包含更新详细信息的新链接
3. 发布并分享新链接

### 归档链接

归档不再需要的支付链接：

**何时归档：**
- 活动已结束
- 产品永久售罄
- 促销已结束
- 不再提供服务

**归档的影响：**
- 链接变得不可访问
- 现有支付保留在历史记录中
- 如果需要可以恢复
- 帮助保持仪表板整洁

### 查看支付历史

**针对特定链接：**
1. 转到支付链接仪表板
2. 点击一个支付链接
3. 查看 **订单** 标签
4. 查看此链接的所有支付

**显示的统计数据：**
- 总订单数：所有支付尝试
- 已完成订单：成功的支付
- 待处理订单：等待支付/确认
- 已过期订单：超时或过期
- 总收入：已完成支付的总和
- 预留库存：待处理的支付
- 已售库存：已完成的支付

## 使用场景

### 自由职业者发票

**场景：** Web 开发者为完成的工作向客户开票。

```json
{
  "title": "网站开发 - Alpha 项目",
  "description": "交付项目：\n• 首页设计\n• 5 个内容页面\n• 联系表单\n• 2 轮修订\n\n7 天内付款",
  "amount": "2500",
  "expiresAt": "2025-02-07T23:59:59Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
      "amount": "2500"
    }
  ],
  "metadata": {
    "project_id": "proj_alpha_2025",
    "client_name": "Acme Corp",
    "invoice_number": "INV-2025-001"
  }
}
```

**工作流程：**
1. 为项目创建支付链接
2. 通过电子邮件将链接发送给客户："通过加密货币支付发票：[链接]"
3. 客户使用他们首选的链支付
4. 付款后收到通知
5. 在您的系统中将发票标记为已付款

### 活动门票销售

**场景：** 技术大会销售 500 张 VIP 门票。

```json
{
  "title": "TechConf 2025 - VIP 通行证",
  "description": "包括：\n• 所有会议环节\n• VIP 社交活动\n• 演讲者晚宴\n• 会议礼品袋\n\n日期：2025 年 6 月 15-17 日\n地点：旧金山会议中心",
  "amount": "499",
  "inventoryTotal": 500,
  "expiresAt": "2025-06-01T00:00:00Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"],
      "is_primary": true
    }
  ],
  "metadata": {
    "event_id": "techconf_2025",
    "ticket_type": "vip",
    "venue": "SF Convention Center"
  }
}
```

**工作流程：**
1. 为门票创建支付链接
2. 将链接添加到活动网站
3. 在社交媒体上分享
4. 在仪表板中监控销售
5. 发送门票履行电子邮件（手动或自动）

### 在线课程注册

**场景：** 教育平台销售课程访问权限。

```json
{
  "title": "完整 Python 训练营",
  "description": "从零到英雄学习 Python！\n\n✓ 60 小时视频内容\n✓ 200+ 编码练习\n✓ 12 个真实世界项目\n✓ 完成证书\n✓ 终身访问\n✓ 退款保证",
  "amount": "149",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon", "tron"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
      "amount": "149"
    }
  ],
  "metadata": {
    "course_id": "python_bootcamp",
    "platform": "learn.example.com",
    "access_duration": "lifetime"
  }
}
```

**工作流程：**
1. 为课程创建支付链接
2. 添加到课程着陆页
3. 客户点击"立即注册" → 重定向到支付链接
4. 支付后，收到 webhook（如果已配置）
5. 通过 webhook 处理程序自动授予课程访问权限

### 捐赠收集

**场景：** 开源项目接受捐赠。

```json
{
  "title": "支持 PayIn 开发",
  "description": "帮助我们构建更好的加密支付基础设施！\n\n您的捐赠帮助我们：\n• 维护和改进 PayIn\n• 添加对更多链的支持\n• 为小型企业保持服务免费\n• 构建开发者友好的工具\n\n每一份贡献都很重要。谢谢！🙏",
  "amount": "0",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon", "tron"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
    }
  ],
  "metadata": {
    "campaign": "open_source_support",
    "project": "payin"
  }
}
```

**功能：**
- 自定义金额（捐赠者选择金额）
- 多个链选项以便利
- 真诚的描述以鼓励捐赠

## 最佳实践

### 链接命名

使用清晰、描述性的标题：

**好的例子：**
```
咨询电话 - 30 分钟
网页设计服务 - 首页套餐
会议门票 - 早鸟价
Python 课程 - 完整访问
```

**避免：**
```
支付          // 太通用
链接 1        // 没有上下文
服务          // 含糊
产品 A        // 不清楚
```

### 描述指南

**要做的：**
- ✅ 清楚地解释他们支付的内容
- ✅ 列出具体的交付成果或功能
- ✅ 包括相关的日期/截止日期
- ✅ 如果需要，添加条款或条件
- ✅ 使用项目符号以提高可读性

**不要做的：**
- ❌ 留空描述
- ❌ 使用过于技术性的术语
- ❌ 写大段文字
- ❌ 忘记重要细节

### 定价策略

**固定金额：**
```json
{
  "amount": "99.00",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"]
    }
  ]
}
```
- **适用于**：产品、服务、固定定价的门票
- **好处**：明确的期望，没有困惑

**自定义金额：**
```json
{
  "amount": "0",
  "currencies": [...]
}
```
- **适用于**：捐赠、小费、可变定价
- **好处**：为客户提供灵活性
- **警告**：设置最小金额以避免微额支付

### 多链策略

**提供多个链以便利：**

```json
{
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": [
        "ethereum",      // 高安全性
        "polygon",       // 低费用
        "tron"          // 非常低的费用
      ],
      "is_primary": true
    }
  ]
}
```

**好处：**
- 客户根据自己的偏好选择
- 某些链上的费用更低 = 客户更满意
- 更高的转化率

**建议：**
- 至少包括 2 个链
- Polygon/Tron 用于小额支付（< $100）
- Ethereum 用于大额支付（> $1000）

### 库存管理

**对于有限的可用性：**

```json
{
  "inventoryTotal": 50,
  "title": "早鸟特惠 - 限 50 名"
}
```

**实时监控：**
- 检查仪表板中的可用/预留/已售数量
- 如果增加容量，请更新库存
- 售罄时归档

**最佳实践：**
- 设置现实的库存数量
- 在标题/描述中提及稀缺性
- 如果售罄，更新客户

### 测试链接

**分享前始终测试：**

1. **创建测试网链接** - 首先使用测试网环境
2. **测试支付流程** - 自己完成测试支付
3. **验证通知** - 检查仪表板更新
4. **检查移动端** - 在移动设备上测试
5. **内部分享** - 在公开发布前让团队测试

::: warning 用真实金额测试
用实际金额测试以确保用户体验良好。用 $0.01 测试无法揭示 $1000 支付的问题。
:::

### 链接分享

**电子邮件模板：**

```
您好 [客户姓名]，

感谢您对 [产品/服务] 的兴趣！

要完成您的支付，请点击以下链接：
[支付链接 URL]

或扫描此二维码：
[二维码图片]

支付详情：
• 金额：$X USDT/USDC
• 支持的网络：Ethereum、Polygon
• 支付窗口：[如果有时间限制]

有问题吗？回复此电子邮件。

最好的问候，
[您的姓名]
```

**社交媒体帖子：**

```
🎉 现在接受加密货币支付！

使用 USDT/USDC 获取 [产品/服务名称]：
[支付链接]

✅ 即时确认
✅ 支持多链
✅ 安全透明

名额有限！👇
```

## 故障排查

### "链接未找到"错误

**问题：** 客户访问链接时出错。

**原因：**
- 链接仍处于草稿状态（未发布）
- 链接已被归档
- URL 中有拼写错误

**解决方案：**
1. 在仪表板中验证链接状态（应为"已发布"）
2. 检查链接是否已归档（如需要可恢复）
3. 从仪表板复制新的 URL

### 未检测到支付

**问题：** 客户已支付但支付未显示在仪表板中。

**原因：**
- 错误的网络（在与所选不同的链上支付）
- 错误的代币（支付了 ETH 而不是 USDT）
- 交易仍在待处理
- 支付到错误的地址

**解决方案：**
1. 在区块浏览器上检查交易
2. 验证正确的网络和代币
3. 等待所需的确认
4. 带交易哈希联系支持

### 库存未更新

**问题：** 支付后库存计数未更新。

**预期行为：**
- **预留**：创建订单时增加（支付待处理）
- **已售**：支付确认时增加
- **可用**：预留时减少

**如果卡住：**
- 检查订单状态（可能仍在待处理）
- 等待区块链确认
- 刷新仪表板

### 无法编辑已发布的链接

**问题：** 需要更改金额但链接已发布。

**解决方案：**
1. 归档当前链接
2. 创建包含更新金额的新链接
3. 发布新链接
4. 与客户分享新 URL
5. 通知现有客户更改

::: tip 保持旧链接活动
如果客户已经有旧链接，请保持其活动状态直到过渡完成。然后在宽限期后归档。
:::

### 二维码不工作

**问题：** 扫描二维码无法打开支付页面。

**原因：**
- 二维码包含错误的 URL
- URL 对于二维码来说太长
- 二维码图像质量太低

**解决方案：**
1. 从仪表板重新生成二维码
2. 如果需要，使用 URL 缩短器
3. 使用多个应用测试二维码
4. 增加二维码大小/质量

## 高级功能

### 用于追踪的元数据

将自定义数据附加到支付链接：

```json
{
  "title": "咨询服务",
  "amount": "500",
  "metadata": {
    "client_id": "client_12345",
    "project_code": "PROJ-2025-Q1",
    "service_category": "consulting",
    "sales_rep": "john@example.com",
    "campaign": "email_blast_jan_2025"
  }
}
```

**元数据的用途：**
- 内部追踪和报告
- 客户/项目关联
- 销售归因
- 营销活动追踪
- 与您的系统集成

**访问元数据：**
- 在支付链接详情中查看
- 包含在 webhook 事件中
- 可通过 API 搜索

### Webhook 集成

配置 webhook 以自动履行：

**事件类型：**
- `paymentlink.order.completed` - 支付已确认
- `paymentlink.order.expired` - 订单过期未支付

**示例 webhook 处理程序：**

```typescript
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'paymentlink.order.completed') {
    const { paymentLinkId, buyerEmail, amount } = event.data;

    // 根据支付链接自动履行
    if (paymentLinkId === 'link_course_python') {
      await grantCourseAccess(buyerEmail);
      await sendWelcomeEmail(buyerEmail);
    } else if (paymentLinkId === 'link_ticket_conference') {
      await generateTicket(buyerEmail);
      await sendTicketEmail(buyerEmail);
    }
  }

  res.status(200).send('OK');
});
```

### API 访问

以编程方式管理支付链接：

**通过 API 创建：**
```bash
curl -X POST https://your-payin.example.com/api/v1/payment-links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "产品名称",
    "amount": "99",
    "currencies": [...]
  }'
```

**列出所有链接：**
```bash
curl https://your-payin.example.com/api/v1/payment-links \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**适用于：**
- 批量创建链接
- 与您的 CMS 集成
- 动态链接生成
- 自动化报告

## 下一步

### 增强您的设置
- [Webhooks](/zh/guide/webhooks) - 自动化履行
- [API 集成](/zh/guide/api-integration) - 程序化控制
- [安全性](/zh/guide/security) - 保护您的集成

### 面向开发者
- [订单支付服务](/zh/guide/order-payment) - 完整 API 控制
- [充值服务](/zh/guide/deposit-service) - 循环支付
- [地址池设置](/zh/guide/address-pool-setup) - 地址管理

### 资源
- [支持的网络](/zh/guide/supported-networks) - 可用的区块链
- [支持的代币](/zh/guide/supported-tokens) - 可用的稳定币

## 支持

需要有关支付链接的帮助？

- 📧 **电子邮件**: support@payin.com
- 💬 **Discord**: [加入我们的社区](https://discord.gg/payin)
- 📚 **管理仪表板**: 内置帮助和教程
