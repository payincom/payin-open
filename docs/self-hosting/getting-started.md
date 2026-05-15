# PayIn 集成快速入门

> 本文面向准备通过 MCP Server 或直接 API 集成 PayIn 的客户。内容覆盖账号准备、API Key 管理以及 AI 协作提示，帮助不同角色在 Day 0 搭建正确的环境。

## 基础准备

1. **注册 PayIn Admin 账号**：访问 `https://admin.payin.com`（开发环境使用本地或测试域名），完成邮箱验证。
2. **创建组织**：首个登录用户会自动生成个人组织；如需团队协作，在“Settings → Organizations”中新建组织并邀请成员。
3. **分配角色**：常见角色包括 `owner`、`admin`、`member`、`viewer`；确保运营及技术成员拥有所需权限。

## API Key 申请流程 <a id="api-authentication"></a>

1. 在 PayIn Admin 进入 **API Keys** 页面，点击「Create API Key」。
2. 设置名称并选择用途（例如 `backend-orders-service`、`data-team-reports`）。
3. 勾选最小权限集合：
   - 订单读写：`orders:read`、`orders:write`
   - 充值读写：`deposits:read`、`deposits:write`
   - 地址池读：`address-pool:read`
4. 记录一次性展示的密钥（以 `pk_` 开头），妥善保存并配置在安全的密钥管理系统。
5. 如果计划通过 MCP Server 使用 API Key：
   - 在 Claude / OpenAI Desktop 的配置文件中设置 `X-API-Key` Header。
   - 可选：指定 `X-PayIn-API-URL` 指向测试或生产 API。

**常见问题提醒**

- 使用 JWT 登录态调用 API 时，必须额外传入 `X-Organization-Id`，否则后端将返回 `ORGANIZATION_CONTEXT_REQUIRED`。
- API Key 自动绑定生成者所在的组织，跨组织调用会被拒绝。
- 建议为不同环境（开发 / 测试 / 生产）分别创建独立 API Key。

## 角色视角速览

- **业务新手（不熟悉加密）**：优先使用 MCP Server 的“流程向导”提示词，逐步完成 API Key 申请、链路选择与支付页面上线。遇到名词不理解时，可输入“帮我解释 Tron 链的手续费影响？”由 AI 解释。
- **技术负责人**：结合 `docs://payin/api-reference` 与工具 `list_chains`、`list_tokens`，在 Sandbox 环境先跑通创建订单与绑定充值地址的集成测试。
- **运营/风控团队**：通过 `get_order_stats`、`list_deposit_references` 等工具拉取每日指标，结合“运营指挥面板”提示词制作汇总。

## 下一步

- 参考《docs/examples/mcp-persona-scenarios.md》中的提示词设计常用操作脚本。
- 在 `docs/self-hosting/troubleshooting.md` 查阅通用错误与处理步骤，确保 API 返回错误时能快速定位并修复。

