---
layout: home

hero:
  name: PayIn Open
  text: 运行属于你自己的稳定币支付系统
  tagline: 面向商家的开源稳定币支付网关，帮助你自建、接入并运营自己的支付基础设施
  actions:
    - theme: brand
      text: 从 Sandbox 开始
      link: /zh/guide/quick-start-mcp
    - theme: alt
      text: 使用 AI Agent 部署
      link: /zh/guide/ai-agent-deployment
    - theme: alt
      text: API 参考
      link: /zh/api/overview

features:
  - icon: 🏪
    title: 商家优先
    details: 面向想拥有自己支付系统、支付数据和基础设施的商家，而不仅仅是开发者。
  - icon: 🤖
    title: AI 辅助部署
    details: 让你的 AI Agent 使用 PayIn Open skills 和 playbooks，帮助完成 sandbox 部署、webhook 接入和生产准备。
  - icon: 🌐
    title: 多链支持
    details: 通过统一 API 支持 Ethereum、Polygon、Tron、Solana 等已配置的区块链网络。
  - icon: 💰
    title: 稳定币支付
    details: 支持 USDT、USDC、DAI、PYUSD 等已配置稳定币，并自动检测链上付款。
  - icon: 🔄
    title: 订单与充值服务
    details: 订单支付适合 checkout 和 invoice，充值地址适合账户余额和平台充值。
  - icon: 🔐
    title: 资金非托管
    details: PayIn Open 负责监控和确认付款，商家仍然负责资金托管、密钥和生产风险管理。
---

## 选择你的路径

| 目标 | 从这里开始 |
| --- | --- |
| 我是商家，想试用 PayIn Open | [MCP 快速开始](/zh/guide/quick-start-mcp) |
| 我想让 AI Agent 帮我部署 | [AI 辅助部署](/zh/guide/ai-agent-deployment) |
| 我想接入 API / Webhook | [API 集成](/zh/guide/api-integration) |
| 我需要 API 细节 | [API 参考](/zh/api/overview) |

## 产品关系

PayIn Open 是 PayIn 产品体系里的开源支付网关。

PayIn Go 是另一个面向小商家的面对面支付产品，基于 X402 协议，目前暂时保持 private，等商业化策略进一步明确后再整理公开关系。

## 推荐第一步

先从 sandbox/testnet 开始。完成创建订单、支付页面、链上监控、webhook 通知验证之后，再准备 production/mainnet。
