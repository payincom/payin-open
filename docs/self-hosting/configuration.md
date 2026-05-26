# PayIn 配置体系概览（2025-10）

## 总体思路

PayIn 各子服务（Monitor → Processor → Manager → API）保持 **单向反向依赖**：  
上层负责收集配置，实例化下层时将结构化配置下发。  
每一层都不直接读取其它层的文件 / 环境变量，而是遵循约定的输入输出。

## 环境变量加载（所有服务）

1. 统一调用 `@payin/shared` 提供的 `loadRootEnv`：  
   ```ts
   loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') })
   ```  
   - 优先加载仓库根目录 `.env`（提供共享密钥 / URL）。  
   - 之后加载当前服务目录下的 `.env`，允许局部覆盖。  
   - 保持对生产环境透明：线上直接通过系统环境变量即可。
2. 若某服务还需要额外的 `.env.*`，在 `additionalFiles` 中显式传入，避免路径猜测。

## Open runtime/profile baseline

PayIn Open self-hosted deployments should run with the Open runtime profile:

```bash
PAYIN_RUNTIME=open
```

The Open profile is single-tenant by default. `open:init` prepares schemas and the internal Open merchant organization, using `PAYIN_OPEN_ORGANIZATION_ID` when an operator intentionally overrides the built-in merchant-organization id. It does not create `admin` / `admin123`, does not create an implicit operator, and does not bundle a Cloud Admin UI. After initialization, the first local operator bootstraps through `/auth/register`; public registration locks after that first operator.

Keep local, sandbox, and production as separate profiles with separate databases, secrets, API keys, webhook endpoints, and RPC provider credentials. API-key business calls are scoped by the key and should not send `X-Organization-Id`. JWT operator calls may need `X-Organization-Id: ${PAYIN_OPEN_ORGANIZATION_ID}` or the built-in Open merchant organization id until the workflow switches to API-key auth. Hosted organization/user/OAuth/config-management/superadmin diagnostics surfaces are Cloud-only and hidden in Open runtime.

## 各层配置来源与优先级

| 服务 | 默认值 | 文件配置 | 动态数据 | 环境变量 | 说明 |
| ---- | ------ | -------- | -------- | -------- | ---- |
| **Monitor** | `packages/monitor/config/default.yaml` | `MONITOR_CONFIG_FILE`（可选） | Processor 传入的 `monitor` 配置 | RPC 密钥等 | Monitor 只关注链与 RPC 细节 |
| **Processor** | `packages/processor/config/default.yaml` | `processor.create(configFile?)` 指定文件 | Manager `startProcessor({ monitor })` 注入 | 数据库连接、feature flag | Processor 负责把 monitor 配置与业务配置整合 |
| **Manager** | `apps/api/config/manager.*.yaml` | YAML 中定义的业务默认值 | 数据库 `config_values`（最高优先） | 连接串、开关类 | Manager 负责业务层参数与 Processor 交互 |
| **API Server** | `apps/api/config/app.yaml` | `app.yaml` 中的路径信息 | — | 根 `.env` + `apps/api/.env` | API 负责装配 Manager 并启动 Processor |

> 约定：下层组件**不回读**上层文件，只接受实例化时传入的配置对象。

## 关键实现细节

### 1. 统一环境变量加载
- 新增 `packages/shared/src/config/env-loader.ts`，提供：
  - `loadEnvFiles(options)`：按顺序加载多个 `.env`。
  - `loadRootEnv(additionalFiles)`：默认加载仓库根 `.env`，再加载传入的局部文件。
- `apps/api/src/index.ts` 已改为调用 `loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') })`，并在开发模式下打印实际加载的文件，方便排查。

### 2. RPC Manager 缓存与重建
- `packages/processor/src/core/processor-core.ts`：
  - 若已有全局 RPCManager，则校验其配置：是否覆盖了所需链、是否还有 `${...}` 占位符。
  - 若不匹配则停掉旧实例并重建，确保热重载后不会继续使用残留的假配置。
  - 日志中输出 `🔧 RPC config chains` 便于确认链覆盖情况。

### 3. Health Checker 修正
- `packages/monitor/src/rpc/manager/health-checker.ts`：
  - 只有连续失败达到 `maxFailures` 时才把 endpoint 标记为 unhealthy，并发出 `endpoint-failed` 事件；恢复后会 emit `endpoint-recovered`。
  - 避免某一次网络抖动就触发全链路降级。

### 4. Adapter 错误链路追踪
- `packages/monitor/dist/adapters/adapter-factory.js` 额外记录 `reason`, `originalError`, `stack`，出现故障时可直接在日志中看到底层 HTTP 错误（例：401 未授权）。

## 推荐开发流程

1. 在任何独立运行的服务入口（monitor/processor/manager/api）都调用 `loadRootEnv`。  
   - 单独跑某个服务时只要根 `.env` 和本地 `.env` 存在即可。
2. 修改配置时遵循层级：
   - RPC 相关 → Monitor defaults + 环境变量；
   - 业务阈值/开关 → Manager YAML + 数据库；
   - Processor 只负责 orchestrate，不直接硬编码 key。
3. 调试时使用 `LOG_LEVEL=4` 启动，以便观察 `request-failure`, `Adapters creation completed` 等关键日志。

## RPC 默认策略

- PayIn Open 的 testnet/demo 默认优先使用无需 key 的 public RPC（例如 `publicnode`），保证新用户和 Agent 可以开箱即用完成演示。
- Public RPC 适合 demo、sandbox、低频自测；不要把它当成有 SLA 的生产依赖。
- 商户可以在 Manager/Processor 配置中添加 Alchemy、Infura、Ankr、QuickNode 或自定义 RPC provider 的 key，并通过 `preferredProviders` 调整优先级：
  - 想让第三方 provider 做主力：把它放在数组第一位，例如 `[alchemy, publicnode]`。
  - 想让 public RPC 做主力、第三方 provider 做 fallback：使用 `[publicnode, alchemy]`。
  - 想禁用某 provider：使用 `excludeProviders` 或从 `preferredProviders` 移除。
- 空 key、`${...}` 占位符、`***` 脱敏值、`your_*` 示例值不会被视为有效 key；对应 provider 会被跳过，避免错误地向占位符 endpoint 发请求。

## 部署注意事项

- 打包前运行：
  ```
  npm --workspace packages/monitor run build
  npm --workspace packages/processor run build
  ```
  确保 `dist/` 与源代码同步。
- 线上环境通过平台环境变量（或密钥管理系统）注入 RPC/API keys，不再依赖 `.env` 文件。
- Manager 数据库中的 `config_values` 为最高优先级；发布前确认与 YAML 一致性，避免未知覆盖。

## 配置诊断

- PayIn Open 使用 `npm run open:doctor`、`npm run open:init -- --check` 和配置文件审查来排查环境加载问题。
- `GET /api/v1/config/diagnostics` 是托管 Cloud 的超级管理员诊断接口；在 Open runtime 中会被隐藏，避免暴露 Cloud 风格的 super-admin surface。

## 快速启动脚本

- `npm --workspace packages/monitor run run [config]`: 加载根/本地 .env 后启动 monitor，支持可选 YAML
- `npm --workspace packages/processor run run [config]`: 同理，启动 processor

## 后续待办

1. 为 demo/example 文档补充“如何读取配置”说明，降低新人上手成本。
2. 在 CI 中增加 `${...}` 占位符检测，保障发布包配置有效。
3. 评估提供只读配置仪表板（结合 diagnostics API），方便运维查看环境状态。
