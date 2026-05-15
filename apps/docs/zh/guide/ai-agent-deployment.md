# AI 辅助部署

PayIn Open 设计时就考虑了 AI Agent 的使用方式。商家可以让自己的 AI Agent 阅读公开文档和 PayIn Open skill，然后协助完成 sandbox 部署、webhook 接入和 production 准备。

## Agent 应该读取什么

建议把这些信息提供给你的 Agent：

1. PayIn Open repository：`https://github.com/payincom/payin-open`
2. `apps/docs/` 里的公众文档
3. PayIn Open skill：`skills/payin-open/SKILL.md`
4. `docs/deployment/` 里的部署文档

## 推荐 Prompt

```text
你正在帮我部署 PayIn Open，这是一个开源稳定币支付网关。

我的目标：
- 我是商家。
- 我想运行属于自己的支付系统。
- 先从 sandbox/testnet 开始。
- 除非我明确批准，否则不要触碰 production/mainnet。

规则：
- 用业务语言解释每一步。
- 不要打印 secrets。
- 不要提交 secrets 或 .env 文件。
- 任何写操作之前，先告诉我它影响 repo、sandbox 还是 production。
- 所有 production 命令执行前都要先展示给我确认。
- 部署后验证 health check。
- 验证创建订单、支付页面、链上监控和 webhook 通知。
```

## 必须先分类任务

Agent 在行动前应该先判断任务类型：

1. 开源 repository 变更
2. 公众文档变更
3. Sandbox 部署或维护
4. Production 部署或维护
5. 商家系统接入
6. 内部运维操作

如果目标环境不清楚，Agent 应该先询问，而不是直接执行。

## 安全部署顺序

1. 阅读 README 和 docs。
2. 确认目标环境是 sandbox/testnet。
3. 准备环境变量，但不要暴露 secret value。
4. 部署 API/admin 服务。
5. 在确认目标数据库后，再运行 migration 或初始化。
6. 验证 `/health`。
7. 创建测试订单。
8. 确认支付页面可用。
9. 验证链上监控。
10. 验证 webhook 通知。
11. 准备 production launch checklist。

## Production 规则

Production/mainnet 操作必须获得明确人工批准。

Agent 禁止：

- 打印私钥、API key、database URL 或 webhook secret。
- 提交 `.env` 文件。
- 在 sandbox 验证前启用 production payments。
- 在 production 设置破坏性数据库初始化参数。
- 只根据 API health 就声称 payment monitoring 已经可用。

## Skill 位置

Agent-facing skill 位于：

```text
skills/payin-open/SKILL.md
```

它应该作为部署、接入和排障的操作手册使用。
