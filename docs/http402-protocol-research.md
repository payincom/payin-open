# HTTP 402 Payment Required 协议调研

## 协议概述

HTTP 402 Payment Required 是 HTTP 状态码标准中预留的支付协议状态码，最初在 RFC 7231 中定义，但长期未被广泛实现。近年来随着微支付和 API 经济的兴起，该协议重新获得关注。

## 核心概念

### 工作原理
1. **请求资源**: 客户端请求需要付费的资源或服务
2. **返回 402**: 服务器返回 402 状态码，附带支付信息
3. **完成支付**: 客户端完成支付
4. **获取资源**: 服务器验证支付后返回资源

### 响应头标准
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
Payment-Required: amount=0.01 currency=USDT chain=ethereum address=0x...
```

## 应用场景

### 1. API 按次计费
- **问题**: 传统 API 需要月付订阅，用量少的用户不划算
- **解决**: 每次调用时按需付费，精确到单次请求
- **示例**: AI API、地图 API、数据查询 API

### 2. AI Agent 服务
- **问题**: AI Agent 运行成本难以预测，订阅制不灵活
- **解决**: 按实际使用量付费，Agent 自动完成支付
- **示例**: GPT API 调用、图像生成、语音合成

### 3. 内容按需购买
- **问题**: 用户不想订阅整个内容库，只需要单篇文章
- **解决**: 按文章、视频、音频单独付费
- **示例**: 新闻文章、学术论文、音乐单曲

### 4. 物联网微支付
- **问题**: 设备间微额交易需要低成本支付方案
- **解决**: 设备自动完成小额支付，无需人工干预
- **示例**: 共享充电、智能电表、车联网

## PayIn 的 HTTP402 实现

### 技术优势
1. **即时支付**: 基于区块链的快速确认
2. **低手续费**: 使用 Layer 2 和 Solana 降低成本
3. **自动化**: 无需用户注册，智能合约自动验证
4. **透明**: 所有交易链上可查

### 集成流程

```typescript
// 1. 客户端请求
const response = await fetch('https://api.example.com/data');

if (response.status === 402) {
  // 2. 解析支付信息
  const paymentInfo = response.headers.get('Payment-Required');

  // 3. 调用 PayIn 完成支付
  const payment = await payin.pay(paymentInfo);

  // 4. 重新请求资源
  const data = await fetch('https://api.example.com/data', {
    headers: { 'Payment-Receipt': payment.receipt }
  });
}
```

### 与传统方案对比

| 特性 | 传统订阅 | HTTP402 + PayIn |
|------|---------|-----------------|
| 注册流程 | 需要注册账号 | 无需注册 |
| 计费方式 | 月付/年付 | 按次付费 |
| 最小金额 | $5-$10 | $0.01+ |
| 支付延迟 | 1-3 天 | 秒级确认 |
| 适用场景 | 高频使用 | 低频/不确定使用 |

## 行业案例

### Lightning Network
- Bitcoin Layer 2 微支付网络
- 用于小额内容付费

### Coil
- Web Monetization 标准
- 浏览器自动向内容创作者付费

### L402 Protocol
- Lightning Network + HTTP 402
- 用于 API 和内容服务

## PayIn 的差异化

1. **多链支持**: 不局限于比特币，支持 EVM、Solana、Tron
2. **稳定币**: 使用稳定币避免价格波动
3. **开发友好**: 简单的 SDK 和 API
4. **非托管**: 资金直达商户钱包

## 市场机会

### 目标客户
- API 服务提供商
- AI 服务提供商
- 内容创作平台
- 物联网设备商

### 市场规模
- API 经济: $2.2 万亿（2023）
- AI 服务市场: $1500 亿（2023）
- 微支付市场: 快速增长

## 参考资料

- RFC 7231: HTTP/1.1 Semantics and Content
- Web Monetization Specification
- L402 Protocol Documentation
- Lightning Network Whitepaper

## 总结

HTTP 402 协议为按需付费提供了标准化解决方案，PayIn 通过多链稳定币支持，为该协议提供了实用的支付基础设施，特别适合 API 服务和 AI Agent 等新兴场景。
