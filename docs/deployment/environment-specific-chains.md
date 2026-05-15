# 环境特定链配置指南

## 概述

PayIn 支持通过环境特定的配置文件来控制不同环境中可用的区块链网络。这允许开发环境只显示测试网链，而生产环境显示主网链。

## 配置架构

### 配置层次

```
API Server (apps/api)
    ↓ 读取 manager.*.yaml
    ↓ 提取 processor.configFile
    ↓
Manager (@payin/manager)
    ↓ 传递 processorConfigFile 参数
    ↓
Processor (@payin/processor)
    ↓ 加载 config/{configFile}.yaml
    ↓ 定义可用的 chains 和 tokens
```

### 配置文件映射

| 环境 | Manager 配置文件 | Processor 配置文件 | 包含的链 |
|------|------------------|-------------------|----------|
| 开发环境 | `apps/api/config/manager.development.yaml` | `packages/processor/config/development.yaml` | 仅测试网 |
| 测试环境 | `apps/api/config/manager.test.yaml` | `packages/processor/config/development.yaml` | 仅测试网 |
| 默认环境 | `apps/api/config/manager.yaml` | `packages/processor/config/development.yaml` | 仅测试网 |
| 生产环境 | `apps/api/config/manager.production.yaml` | `packages/processor/config/default.yaml` (默认) | 所有链 |

## 配置文件详解

### 1. Processor 配置文件

#### `packages/processor/config/default.yaml`
- 包含所有链（mainnet + testnet）
- 作为完整的参考配置
- 生产环境默认使用

#### `packages/processor/config/development.yaml`
- 只包含测试网链：
  - `ethereum-sepolia`
  - `polygon-amoy`
  - `tron-nile`
  - `solana-devnet`
  - `arbitrum-sepolia`
- 开发和测试环境使用

### 2. Manager 配置文件

在 `apps/api/config/manager.*.yaml` 中指定 Processor 配置文件：

```yaml
# Processor Configuration
processor:
  configFile: development.yaml  # 使用测试网配置

# Monitor Configuration
monitor:
  chains:
    - ethereum-sepolia
    - polygon-amoy
    # ...
```

**重要说明**：
- `processor.configFile` - 决定 Processor 加载哪些链和 token
- `monitor.chains` - 决定 Monitor 监控哪些链（必须是 processor.chains 的子集）

## 使用场景

### 场景1：开发环境只显示测试网链

**需求**：创建订单时，前端只显示测试网链和对应的 token。

**配置**：
1. `apps/api/config/manager.development.yaml`:
   ```yaml
   processor:
     configFile: development.yaml
   ```

2. API 启动时会自动加载 `development.yaml`，只包含测试网链。

3. 前端调用 `GET /api/tokens` 时，只返回测试网链和 token。

### 场景2：生产环境显示所有链

**需求**：生产环境需要支持 mainnet 和 testnet。

**配置**：
1. `apps/api/config/manager.production.yaml`:
   ```yaml
   # 不指定 processor.configFile，使用默认的 default.yaml
   monitor:
     chains:
       - ethereum
       - polygon
       # ...
   ```

2. API 启动时 Processor 使用 `default.yaml`，包含所有链。

### 场景3：自定义链集合

**需求**：创建自定义的链集合（如只支持特定主网链）。

**步骤**：
1. 创建自定义配置文件 `packages/processor/config/custom.yaml`：
   ```yaml
   chains:
     ethereum-mainnet:
       protocol: evm
       name: Ethereum Mainnet
       network: mainnet
       confirmations: 12
     polygon-mainnet:
       protocol: evm
       name: Polygon Mainnet
       network: mainnet
       confirmations: 128

   tokens:
     USDC:
       symbol: USDC
       name: USD Coin
       decimals: 6
       contracts:
         ethereum-mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
         polygon-mainnet: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
   ```

2. 在 Manager 配置中指定：
   ```yaml
   processor:
     configFile: custom.yaml
   ```

## 配置验证

### 验证 Processor 配置加载

启动 API 服务器时，查看日志：

```
✅ Loaded config from: default.yaml
✅ Loaded config from: development.yaml
🚀 Starting Processor via Manager...
✅ Processor started successfully via Manager
```

### 验证可用链

调用 API 端点：

```bash
# 获取所有 token 和链
curl http://localhost:3000/api/tokens

# 响应示例（开发环境）
{
  "success": true,
  "tokens": [
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "chains": [
        {
          "chainId": "ethereum-sepolia",
          "contractAddress": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        },
        {
          "chainId": "polygon-amoy",
          "contractAddress": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
        }
        // 只有测试网链
      ]
    }
  ]
}
```

## 故障排查

### 问题1：前端仍然显示 mainnet 链

**可能原因**：
1. Manager 配置文件中没有指定 `processor.configFile`
2. 指定的配置文件不存在
3. 配置文件路径错误

**解决方法**：
1. 确认 `manager.*.yaml` 中有 `processor.configFile` 配置
2. 确认配置文件存在于 `packages/processor/config/` 目录
3. 查看启动日志，确认加载了正确的配置文件

### 问题2：Monitor 报错 "Invalid chains"

**错误信息**：
```
Invalid chains in monitor configuration: ethereum
```

**原因**：`monitor.chains` 包含的链不在 `processor.chains` 中。

**解决方法**：
确保 `monitor.chains` 是 `processor.chains` 的子集：

```yaml
# ❌ 错误示例（development.yaml 不包含 ethereum）
processor:
  configFile: development.yaml
monitor:
  chains:
    - ethereum  # 错误！development.yaml 只有 ethereum-sepolia

# ✅ 正确示例
processor:
  configFile: development.yaml
monitor:
  chains:
    - ethereum-sepolia  # 正确
```

### 问题3：TypeScript 编译错误

**错误信息**：
```
Types of property 'chains' are incompatible
```

**解决方法**：
已在 `packages/manager/src/manager.ts` 中添加类型注解 `: any` 解决。

## 最佳实践

1. **开发环境**：始终使用 `development.yaml`，避免误操作主网资源。

2. **测试环境**：使用 `development.yaml` 或创建专用的 `test.yaml`。

3. **生产环境**：
   - 如果只支持主网，创建 `production.yaml` 只包含主网链
   - 如果需要支持所有链，使用 `default.yaml`（省略 `processor.configFile`）

4. **配置文件命名**：
   - 使用描述性名称：`development.yaml`, `production.yaml`, `staging.yaml`
   - 避免使用 `custom.yaml` 等模糊名称

5. **版本控制**：
   - 将所有配置文件提交到版本控制
   - 敏感信息使用环境变量（如 RPC keys）

## 相关文档

- [配置体系概览](./configuration-overview.md)
- [Processor 配置指南](../../packages/processor/config/README.md)
- [Manager 配置指南](../../apps/api/config/manager.example.yaml)
