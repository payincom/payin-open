# 订单支付示例

::: tip 开发中
完整的代码示例即将推出。本页面将包含电商订单支付的完整集成示例。
:::

## 快速示例

以下是创建支付订单的基本示例：

```typescript
// 创建支付订单
const response = await fetch('http://localhost:3000/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    orderReference: 'ORDER-2025-001',
    amount: '100.00',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    successUrl: 'https://yoursite.com/payment/success',
    cancelUrl: 'https://yoursite.com/payment/cancel'
  })
});

const order = await response.json();
console.log('支付地址:', order.data.paymentAddress);
```

## 即将推出

本示例页面将包含：

- 完整的 Node.js 集成示例
- 前端支付页面实现
- Webhook 处理
- 错误处理
- 测试网测试
- 生产环境部署指南

敬请期待完整文档！
