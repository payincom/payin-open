# 环境配置指引（更新版）

> 2025-10-30 更新：本文延续最初的 “Monitor NaN & 环境变量混乱” 案例，给出当前统一配置方案，确保在开发、测试、生产环境都能稳定加载 RPC/链/Token 配置。

## 1. 为什么要统一加载方式？

早期各模块（Monitor / Processor / Manager / API）各自 `dotenv.config()`，并在 YAML 里写 `${ALCHEMY_API_KEY}` 等占位符，一旦有进程忘记加载根 `.env`，Monitor 就会拿到原样的 `${...}` 字符串，引发：

1. RPC 请求携带占位符 → Provider 返回 401 → 端点被判定 unhealthy；
2. 甚至解析到 `NaN`，导致数据库更新 `bigint` 失败。

现在我们使用 `@payin/shared` 提供的 `loadRootEnv(['.env'], { rootDir })`：

- 先加载仓库根目录 `.env`（存放共享密钥、数据库连接等）；
- 再加载服务自身目录的 `.env`（可选），用于局部覆盖；
- 这样 Monitor/Processor/Manager/API 都能一致拿到同一套环境变量。

## 2. 根目录 `.env` 最低需求

```bash
# Database
DB_CONNECTION_STRING=postgresql://username:password@host:5432/database

# EVM RPC keys
ALCHEMY_API_KEY=...
INFURA_API_KEY=...
ANKR_API_KEY=...

# Tron
TRONGRID_API_KEY=...

# Solana
TATUM_API_KEY=...
HELIUS_API_KEY=...

# Optional: QuickNode 等其它 provider
QUICKNODE_API_KEY=...
```

> **注意**：`.env.test` 仍可保留，用于本地测试/预发；部署到云平台时推荐改用平台环境变量，避免泄露。

> 小贴士：2025-10 版本后，monitor 默认模板已经包含 `helius` 与 `tatum`。如果只是上线 Solana Mainnet/Devnet，无需在 manager YAML 的 `monitor.customProviders` 中重复定义。

## 3. 配置在各模块的生效路径

| 配置项 | 默认位置 | 可覆盖途径 | 说明 |
|--------|----------|------------|------|
| Provider 模板（URL、认证方式） | `packages/monitor/config/default.yaml` | `monitor.customProviders`（manager YAML）或自定义 monitor YAML | 默认已内置 alchemy / infura / ankr / trongrid / helius / tatum / publicnode / cloudflare / solana-public；只有当需要 QuickNode 等额外供应商时才需要自定义 |
| Provider API Keys | 环境变量 | `.env` / 云平台 env | manager YAML 仅引用 `${ALCHEMY_API_KEY}` 等，占位符会被 loadRootEnv 替换 |
| 监控链列表 / 扫描参数 | manager YAML 中的 `monitor.chains`、`monitor.chainSettings` | manager YAML / DB | 只要列入 `monitor.chains`，Monitor 就会监控；默认 YAML 只提供兜底数值 |
| 链元数据（协议/确认数） | `packages/processor/config/default.yaml` | 修改默认 YAML 或扩展 Processor | 目前集中在 Processor 默认文件，按需调整 |
| Token 合约地址 | `packages/processor/config/default.yaml` | 同上 | 生产和测试的地址可在此文件维护 |
| 业务配置（orders/delays 等） | manager YAML + `config_values` | 数据库 `config_values` 优先级最高 | manager YAML 提供默认，数据库可运行时覆盖 |

## 4. 如何新增 / 调整 RPC Provider、链、Token

### 4.1 新增或调整 RPC Provider

内置模板已覆盖：

| Provider | URL 模板 | 备注 |
|----------|----------|------|
| `helius` | `https://{network}.helius-rpc.com/?api-key={apiKey}` | `networkMappings`：`solana-mainnet → mainnet`、`solana-devnet → devnet` |
| `tatum` | `https://solana-{network}.gateway.tatum.io/` | `networkMappings`：`solana-mainnet → solana-mainnet`、`solana-devnet → solana-devnet` |
| `alchemy` | `https://{network}.g.alchemy.com/v2/{apiKey}` | 支持 Ethereum / Polygon / Arbitrum（`arb-mainnet`、`arb-sepolia`） |
| `publicnode` | `https://{network}-rpc.publicnode.com` | 支持 Ethereum、Polygon、Arbitrum（主网/测试网）等 |
| 其它默认 | 详见 `default.yaml` | — |

若需要新增（例如 QuickNode），才需要在 manager YAML 自定义：
   ```yaml
   monitor:
     customProviders:
       quicknode:
         displayName: "QuickNode"
         authType: url_path
         urlPattern: "https://{network}.quiknode.pro/{apiKey}"
         supportedNetworks: []
         networkMappings:
           ethereum-mainnet: ethereum-mainnet
           polygon-mainnet: polygon-mainnet
         defaultSettings:
           timeout: 5000
           weight: 95
           maxRequestsPerSecond: 15
   ```
2. 在 `monitor.rpc.chains.<chain>.preferredProviders` 中把 `quicknode` 加进去；未覆盖的链会继续使用默认优先级。
3. 在环境变量里设置 `QUICKNODE_API_KEY=...`。

### 4.2 启用或切换链

> **重要**：Monitor/Processor 仍有少量硬编码的链清单。新增或移除链时，以下文件与构建步骤都要更新，否则会出现 “Unknown chain” 或 “Required providers” 类错误。

1. **Monitor 链定义**
   - `packages/monitor/src/types/chains.ts`（以及编译后的 `dist/types/chains.js`）：追加新的链枚举及默认参数。
   - `packages/monitor/src/config/config-validator.ts` 的 `knownChains` / `getProvidersForChain` 映射需要同步调整。
   - 修改后运行 `npm run build -w packages/monitor` 生成最新 dist。
2. **Processor 默认配置**
   - 在 `packages/processor/config/default.yaml` 的 `chains` 增加链条目（协议、确认数、explorer 地址），并在 `tokens` 中为该链配置 Token 合约。
   - 若 Processor 内部工具（如 `ChainUtils`）针对特定链做了硬编码，也需检视是否要更新。
   - 变更完成后运行 `npm run build -w packages/processor`。
3. **Monitor RPC & 扫描配置**
   - 在 `packages/monitor/config/default.yaml` 或 manager YAML (`monitor.rpc.chains` / `monitor.chainSettings`) 定义该链的首选 provider、batchSize、确认数等。
4. **上层启用链条**
   - 在 `apps/api/config/manager.*.yaml` 的 `monitor.chains` 数组里加入新链（例如 `arbitrum-sepolia`），并配置对应 `chainSettings` 与 `rpc.chains`。
   - 注意 provider 列表要与 Monitor 支持的模板一致；例如 `solana-devnet` 建议只使用 `helius`、`tatum` 等可用节点（Solana 公共节点经常宕机，建议不要放进首选列表），不要混入 `publicnode` 这类不支持 Solana 的模板，否则 adapter 初始化会直接失败。
5. **环境变量**
   - 为该链所需的 provider 配置 API key（如 `ALCHEMY_API_KEY`、`TRONGRID_API_KEY`、`TATUM_API_KEY`、`HELIUS_API_KEY` 等），并在 manager YAML 的 `monitor.rpcKeys` 中引用占位符，否则构建出来的配置会把这些 provider 视为“无可用端点”。
6. **重启服务**
   - 重新运行 `npm run dev:server` 或部署脚本，Monitor 应会打印包含新链的 adapter 初始化日志。

### 4.3 更新 Token 地址

目前 Token 地址集中在 Processor 默认 YAML：

- 直接修改 `packages/processor/config/default.yaml` 的 `tokens.<TOKEN>.contracts.<chain>`。目前默认已提供：
  - `USDC`：Ethereum Sepolia、Polygon Amoy、Arbitrum Sepolia、Solana Mainnet/Devnet；
  - `USDT`：Tron Nile；
  - `PYUSD`：Ethereum Sepolia、Solana Devnet。
- 若不同环境地址不同，可以采用“不同 YAML + 构建时拷贝”或在 CI 中用模板替换；
- 长远考虑，也可扩展 Manager 通过数据库存储 Token 映射，再由 Processor 注入。

## 5. 调试与诊断

- **启动**：运行 `npm run dev` 会并行 `watch:monitor`、`watch:processor` 与 API 服务，任何源码改动都会重编译 `dist`。  
- **独立测试**：`npm --workspace packages/monitor run run [config]`、`npm --workspace packages/processor run run [config]`。  
- **配置诊断**：登录超级管理员后访问 `GET /api/v1/config/diagnostics`，即可看到 Manager 合成的最终配置（包括 Monitor/Processor 默认层）。这可用于部署后核对是否读取了正确的密钥和链集合。

## 6. 快速排查 checklist

1. 是否所有服务都调用了 `loadRootEnv`（看启动日志的 `Loaded env files`）？  
2. `GET /api/v1/config/diagnostics` 是否显示了预期的 monitor/processor 配置？  
3. 日志中是否出现 `${...}` 字样？若有说明环境变量仍未注入。  
4. Monitor 初始化是否打印 `Adapters creation completed { successCount: N, totalCount: N }`？若有链缺失，请检查 `monitor.chains` 与 API key。

通过以上改造，配置来源已经统一：默认值在 YAML，敏感值通过环境变量注入，Manager 控制业务/链启用，Processor 与 Monitor 分别负责链元数据和 RPC 调度。后续只需按照本文的步骤扩展链或 provider，即可在不同环境中稳定部署。*** End Patch
