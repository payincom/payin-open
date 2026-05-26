# PayIn 故障排查手册

> 本文按错误类型整理 PayIn API 与 MCP Server 常见问题，提供定位步骤、修复建议以及可复用的 AI 提示词。章节使用显式锚点，供 MCP Server 在返回错误时精准链接到对应内容。

## 认证问题 <a id="authentication"></a>

- **症状**：返回 `AUTHENTICATION_FAILED`、`Missing or invalid Authorization header`。
- **排查**：
  1. 确认 Header 是否为 `Authorization: Bearer pk_xxx`（API Key）或有效 JWT。
  2. 使用 `curl $PAYIN_API_URL/health -H "Authorization: Bearer …"` 检验密钥。
  3. MCP 客户端需要在 Profile 中保存 `X-API-Key` 与 `X-PayIn-API-URL`。
- **AI 提示词**：`请检查我当前 MCP 会话的 X-API-Key 配置是否为空，并提醒我如何补充。`

## 权限问题 <a id="permissions"></a>

- **症状**：返回 `PERMISSION_DENIED` 或错误信息包含 `Insufficient permissions`。
- **排查**：
  1. 通过 operator API/CLI 确认 API Key 已授予目标权限。PayIn Open 不内置 Admin UI。
  2. 对运营侧查询，可考虑单独生成只读 Key。
  3. 若提示 `requiredPermission: unknown`，说明服务被关闭，参考后文“订单服务关闭”章节。

## 订单参数校验 <a id="orders-validation"></a>

- **症状**：`ORDER_VALIDATION_FAILED`、`ORDER_AMOUNT_FORMAT_INVALID`、`ORDER_ID_INVALID`。
- **排查**：
  1. 订单金额必须是字符串（`"10.50"`），最多 18 位小数。
  2. 使用 `<a id="order-validation-checklist"></a>` *订单创建校验清单* 逐项检查。
  3. 订单 ID 必须是创建成功响应里的 `id`，不要使用业务订单号。
- **AI 提示词**：`请使用订单创建校验清单检查我传入的参数，并列出缺失项。`

## 订单筛选与统计 <a id="orders-filters"></a>

- **症状**：`ORDER_FILTER_INVALID_DATE`、`ORDER_FILTER_INVALID_LIMIT`、`ORDER_STATS_INVALID_DATE`。
- **排查**：
  1. 将所有日期转换成 UTC ISO 8601（例如 `2025-01-15T08:00:00Z`）。
  2. `limit` 建议控制在 1～100；更大数据量改用统计接口或数据仓库。
  3. `sortBy` 仅支持 `createdAt`、`updatedAt`、`amount`。

## 订单运行时异常 <a id="orders-runtime"></a>

- **症状**：`ORDER_CREATION_FAILED`、`ORDER_LIST_FAILED`、`ORDER_STATS_FAILED`、`ORDER_GET_FAILED`。
- **排查**：
  1. 查看返回的 `suggestions`，通常包含恢复步骤。
  2. 如遇地址池耗尽或服务关闭，请参考对应章节。
  3. 记录报错时间和 Open merchant organization，方便本地 operator 排查；API-key 调用不要额外传 `X-Organization-Id`。

## 地址池耗尽 <a id="address-pool-exhausted"></a>

- **症状**：`ADDRESS_POOL_EXHAUSTED`。
- **解决**：
  1. 执行 `POST /api/v1/address-pool/allocate` 或通过 operator CLI/API 导入新地址。
  2. 复用 AI 提示词：`请指导我如何补充 EVM 地址池，并检查补充后的可用数量。`

## 订单服务关闭 <a id="order-service-disabled"></a>

- **症状**：`ORDER_SERVICE_DISABLED`。
- **解决**：
  1. 检查本地 Manager/Processor 配置和数据库配置值，确认 `orders` 服务在 Open profile 中启用。
  2. 若操作受限，使用本地 operator API/CLI 或部署配置修正；不要依赖 Cloud Admin UI。

## 充值参数校验 <a id="deposits-validation"></a>

- **症状**：`DEPOSIT_VALIDATION_FAILED`、`DEPOSIT_UNBIND_INVALID_PAYLOAD`。
- **排查**：
  1. `depositReference` 必须为非空字符串，建议与业务用户 ID 对齐。
  2. 参考 `<a id="deposit-binding-checklist"></a>` *充值绑定校验清单*。
  3. 解绑时至少提供 `depositReference` 或 `address + protocol` 之一。

## 协议限制 <a id="deposits-protocols"></a>

- **症状**：`DEPOSIT_PROTOCOL_UNSUPPORTED`。
- **说明**：当前仅开放 `evm`、`tron`；Solana 充值暂未启用。
- **建议**：监控版本公告，并在地址绑定前确定目标链。

## 充值运行时异常 <a id="deposits-runtime"></a>

- **症状**：`DEPOSIT_BIND_FAILED`、`DEPOSIT_UNBIND_FAILED`、`DEPOSIT_GET_FAILED`、`DEPOSIT_LIST_FAILED`、`DEPOSIT_REFERENCES_FAILED`、`DEPOSIT_STATS_FAILED`。
- **排查**：
  1. 关注返回的 `suggestions`；大多与地址池容量、过滤条件或服务状态相关。
  2. 记录 Open merchant organization 与报错时间；必要时附上 `depositReference`。

## 充值筛选与统计 <a id="deposits-filters"></a>

- **症状**：`DEPOSIT_FILTER_INVALID_PAGE`、`DEPOSIT_FILTER_INVALID_LIMIT`、`DEPOSIT_STATS_INVALID_DATE`。
- **排查**：
  1. `page`、`limit` 必须为正整数，`limit` 建议 ≤ 100。
  2. 日期使用 UTC ISO 8601。

## 充值记录未找到 <a id="deposits-not-found"></a>

- **症状**：`DEPOSIT_ADDRESS_NOT_FOUND`。
- **排查**：
  1. 使用 `GET /api/v1/deposits?depositReference=...` 列出所有绑定。
  2. 核对 protocol 是否与绑定时一致。

## 速率限制 <a id="rate-limits"></a>

- **症状**：`RATE_LIMIT_EXCEEDED`。
- **建议**：实现指数退避重试，并评估是否需要提高额度。

## 平台状态 <a id="platform-status"></a>

- **症状**：`SERVER_ERROR`。
- **建议**：查询状态页，并观察是否为短暂波动；持续异常时联系支持。

## 其他 API 错误 <a id="general-api-errors"></a>

- **症状**：`API_ERROR`、`CONFLICT` 等未分类错误。
- **建议**：详细阅读 `details.apiMessage`、`suggestions`；必要时附带响应体与请求参数递交支持工单。
