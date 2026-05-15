# E2E 端到端测试

这些测试通过 Web Server API 进行端到端测试，使用真实的区块链交易验证完整的支付流程。

## 前置条件

1. **Web Server 必须运行**：测试会连接到 `http://localhost:3000`
2. **数据库已初始化**：Manager 和 Processor 的数据库表已创建
3. **Processor 和 Monitor 正在运行**：通过 Web Server 启动

## 启动 Web Server

在运行测试之前，先启动 Web Server：

```bash
# 在 app 目录下
cd app

# 首次运行需要初始化数据库
INIT_DB=true npm run dev

# 后续运行不需要初始化
npm run dev
```

确保看到以下输出表示服务器成功启动：

```
✅ Server is running!
   Health check: http://localhost:3000/health
   API base URL: http://localhost:3000/api/v1
```

## 运行测试

在**另一个终端窗口**运行测试：

```bash
# 在 app 目录下
cd app

# 运行所有 E2E 测试
npm run test

# 运行特定测试文件
npx vitest run tests/e2e-order-payment.test.ts

# 以 watch 模式运行（开发时使用）
npx vitest tests/e2e-order-payment.test.ts
```

## 测试说明

### e2e-order-payment.test.ts

完整的订单支付流程测试：

1. **初始化地址池**：通过 API 添加测试地址到地址池
2. **创建订单**：通过 API 创建一个新订单
3. **发送支付**：使用测试工具发送真实的测试网转账
4. **等待确认**：轮询 API 等待订单状态变为 completed
5. **验证结果**：检查订单状态、转账记录、统计数据

测试使用真实的 Ethereum Sepolia 测试网交易，所以需要：
- 测试助记词有足够的 testnet USDC
- 网络连接正常
- 有足够的 testnet ETH 支付 gas

### 测试工具

`test-utils.ts` 提供了两个主要工具类：

1. **ApiClient**: HTTP 客户端，封装了所有 Web Server API 调用
2. **E2ETestUtils**: 测试工具函数，包括：
   - 地址生成和初始化
   - 发送测试网支付
   - 等待订单/转账状态
   - 金额比较等辅助函数

## 测试数据

测试使用硬编码的测试助记词（仅包含测试网资金，安全提交到代码库）：

```
prepare panel behind window cram series basket exhibit topple icon solve gate
```

所有测试地址和支付都基于这个助记词生成。

## 故障排查

### Web Server 未运行

```
Error: Web Server is not running
```

**解决方案**: 先启动 Web Server: `cd app && npm run dev`

### 地址池为空

```
Error: No available addresses for chain family: evm
```

**解决方案**: 测试会自动初始化地址池。如果失败，检查 Web Server 日志。

### 超时错误

```
Error: Timeout waiting for order status completed
```

**可能原因**:
1. 区块链网络延迟
2. Monitor 未正常运行
3. 测试网拥堵

**解决方案**:
- 检查 Web Server 日志中 Monitor 的运行状态
- 增加超时时间
- 等待测试网恢复正常

### 交易失败

```
Error: Failed to send payment
```

**可能原因**:
1. 测试账户余额不足
2. Gas 价格过低
3. 网络问题

**解决方案**:
- 检查测试账户余额
- 从 testnet faucet 获取测试币
- 检查网络连接

## 调试

启用详细日志输出：

```bash
# 运行测试时查看详细输出
npx vitest run tests/e2e-order-payment.test.ts --reporter=verbose
```

查看 Web Server 日志输出，了解 Processor 和 Monitor 的运行情况。

## 持续集成

在 CI 环境运行这些测试：

1. 启动 Web Server（后台运行）
2. 等待健康检查通过
3. 运行测试
4. 关闭 Web Server

示例脚本：

```bash
#!/bin/bash
cd app
npm run dev &
SERVER_PID=$!

# 等待服务器启动
sleep 10

# 运行测试
npm run test

# 清理
kill $SERVER_PID
```
