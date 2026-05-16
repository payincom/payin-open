# PayIn Open 集成快速入门

> 本文面向准备自托管 PayIn Open 并通过 Agent / Skill / API 集成稳定币收款的商家和技术团队。PayIn Open 默认是 headless / Agent-operated：不内置 Admin UI，也不要求商家管理 Cloud-style organizations。

## 基础准备

1. **部署 API 服务**：准备 PostgreSQL、RPC provider、域名、Webhook endpoint，并启动 PayIn Open API。
2. **运行 Agent 预检**：使用 `npm run open:doctor`、`npm run open:init -- --check`、`npm run open:smoke` 验证本地配置和部署状态。
3. **初始化 Open merchant scope**：配置 `DB_CONNECTION_STRING` 后运行 `npm run open:init`。初始化脚本会创建内部默认 Open merchant scope；调用方不需要选择 organization。
4. **用 sandbox/testnet 验证**：在进入 production/mainnet 前，使用 `open:doctor --strict` 和 `open:smoke --require-live` 跑完整 sandbox gate。

## API Key 申请/创建流程 <a id="api-authentication"></a>

PayIn Open 不通过 Admin UI 创建 API Key。使用 Open Agent/Skill、API，或后续提供的 operator automation 创建和轮换密钥。

建议流程：

1. 先注册第一个本地 Open operator。Open runtime 只允许首个 operator 通过公开 `/auth/register` bootstrap；创建后公开注册会锁定。
2. 用该 operator 创建一个最小权限 API Key，例如 `backend-orders-service`。使用 JWT 调用 operator API 时传入 `X-Organization-Id: 00000000-0000-0000-0000-000000000001`（或你的 `PAYIN_OPEN_ORGANIZATION_ID`）；切换到 API Key 后 scope 会自动携带。
3. 只授予所需权限，例如：
   - 订单读写：`orders:read`、`orders:write`
   - 充值读写：`deposits:read`、`deposits:write`
   - 地址池读：`address-pool:read`
4. 记录一次性展示的密钥，妥善保存到 secret manager 或部署平台的环境变量中。
5. 为不同环境分别创建独立 API Key：local/sandbox/production 不要共用。
6. 如果计划通过 MCP Server 或 Agent 使用 API Key：
   - 设置 `X-API-Key` Header。
   - 可选：指定 `X-PayIn-API-URL` 指向 sandbox 或 production API。

**常见问题提醒**

- PayIn Open API Key 会自动绑定内部默认 Open merchant scope；API Key 调用不需要传 `X-Organization-Id`。
- 使用 JWT 登录态直接调用 operator API 时，需要传 `X-Organization-Id`，且用户必须是该 Open merchant scope 的 operator/owner。PayIn Open 不会把任意 JWT 用户自动提升为默认 merchant owner。
- 如果返回 `ORGANIZATION_CONTEXT_REQUIRED`，先检查 `open:init` 是否已完成默认 merchant bootstrap，以及 JWT 请求是否传入正确的 Open merchant id。
- 不要在聊天、日志、工单或文档中粘贴真实 API Key。

## 角色视角速览

- **业务新手（不熟悉加密）**：优先使用 PayIn Open Skill / Agent runbook，让 Agent 引导完成配置、链路选择、测试订单和 webhook 验证。
- **技术负责人**：结合 API 文档与工具 `list_chains`、`list_tokens`，在 sandbox/testnet 环境先跑通创建订单、支付页、订单状态、webhook 回调。
- **运营/风控团队**：通过 Agent 命令、API 查询和导出的运营数据制作每日指标；Open 版本不依赖 Cloud admin dashboard。

## 下一步

- 阅读 [Agent operations runbook](./agent-operations.md)，按 CI、本地、sandbox、production pre-check 的顺序执行。
- 在 [environment separation](./environments.md) 中确认 local/sandbox/production 隔离。
- 在 [troubleshooting](./troubleshooting.md) 查阅通用错误与处理步骤。
