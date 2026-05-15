# Payment Pages Documentation

## Overview

已为 PayIn 系统添加了两个公开支付页面，用于用户进行支付和充值操作。

## 新增路由

### 1. 订单支付页面
- **路径**: `/pay/order/:orderId`
- **方法**: GET
- **权限**: 公开访问（无需认证）
- **功能**: 显示订单支付信息和二维码

#### 显示内容
- 订单标题和描述（从 metadata 中获取）
- 订单号
- 支付金额和代币
- 支付链信息
- 支付地址二维码
- 订单状态（等待支付/已完成/已过期）

#### 特性
- 自动刷新（每5秒）检查支付状态
- 一键复制支付地址
- 响应式设计（支持移动端）
- 状态实时更新
- 美观的渐变背景和卡片设计

### 2. 充值页面
- **路径**: `/pay/deposit/:depositReference`
- **方法**: GET
- **查询参数**: `protocol` (可选, 默认: evm)
- **权限**: 公开访问（无需认证）
- **功能**: 显示用户充值地址和支持的网络

#### 显示内容
- 用户标识
- 协议类型（EVM/Tron）
- 支持的区块链网络列表
- 充值地址二维码
- 充值说明

#### 特性
- 协议切换（EVM ⇄ Tron）
- 显示所有支持的网络
- 网络状态标识（mainnet/testnet）
- 一键复制充值地址
- 响应式设计（支持移动端）
- 详细的充值说明

## 文件结构

```
apps/api/src/routes/
├── pay-order.ts      # 订单支付页面路由
└── pay-deposit.ts    # 充值页面路由
```

## 技术实现

### 技术栈
- **框架**: Hono.js
- **模板引擎**: Hono HTML
- **二维码生成**: qrcode.js (CDN)
- **样式**: 内联 CSS (无需外部依赖)

### 设计特点
1. **零依赖**: 除了二维码库，所有功能都使用原生 JavaScript 实现
2. **服务端渲染**: 完整的 HTML 从服务器返回
3. **响应式设计**: 移动端和桌面端自适应
4. **用户友好**: 清晰的视觉层次和操作指引

## 使用示例

### 订单支付页面
```
访问: http://localhost:3000/pay/order/{order_id}

示例: http://localhost:3000/pay/order/order_2024_001
```

### 充值页面
```
访问: http://localhost:3000/pay/deposit/{deposit_reference}?protocol={evm|tron}

示例:
- http://localhost:3000/pay/deposit/user_123
- http://localhost:3000/pay/deposit/user_123?protocol=tron
```

## 集成说明

### 在订单创建后返回支付链接

```javascript
// 创建订单后
const order = await manager.createOrder({...});

// 生成支付链接
const paymentUrl = `https://your-domain.com/pay/order/${order.orderId}`;

// 返回给用户或通过回调通知
return {
  orderId: order.orderId,
  paymentUrl: paymentUrl
};
```

### 在用户绑定充值地址后返回充值链接

```javascript
// 绑定充值地址后
const result = await manager.bindDepositAddress({
  depositReference: 'user_123',
  protocol: 'evm'
});

// 生成充值链接
const depositUrl = `https://your-domain.com/pay/deposit/user_123?protocol=evm`;

// 返回给用户
return {
  depositReference: 'user_123',
  depositUrl: depositUrl
};
```

## 注意事项

1. **状态刷新**: 订单支付页面会每5秒自动刷新，检查支付状态
2. **网络选择**: 充值页面支持协议切换，但地址对于同一协议的所有链是相同的
3. **移动端优化**: 页面在移动设备上有特殊的布局优化
4. **错误处理**: 所有页面都包含完善的错误处理和用户友好的错误提示

## 样式定制

如需定制页面样式，可以修改 `getStyles()` 函数中的 CSS 代码。主要的可定制元素：

- 颜色方案（渐变背景、按钮颜色等）
- 字体和字号
- 卡片圆角和阴影
- 响应式断点

## 后续改进建议

1. **国际化**: 添加多语言支持
2. **主题**: 支持深色/浅色主题切换
3. **WebSocket**: 使用 WebSocket 代替轮询，实时更新状态
4. **分享功能**: 添加二维码下载和分享功能
5. **支付倒计时**: 在订单页面显示支付倒计时
6. **交易记录**: 在充值页面显示历史充值记录
