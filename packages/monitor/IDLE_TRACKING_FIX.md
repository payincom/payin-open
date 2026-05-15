# 空闲期间链高度追踪修复

## 问题描述

**问题**：在之前的实现中，当 Monitor 没有活动的监控目标（targets）时，会完全跳过区块扫描，导致 `lastProcessedBlock` 停止更新。

**影响**：
- 系统空闲时间越长，链高度记录越落后
- 创建新订单或充值地址时，需要扫描大量历史区块才能追上当前高度
- 可能导致支付检测延迟，影响用户体验

## 场景示例

### 修复前的问题场景

```
时间线：
00:00 - 系统启动，当前区块 #1000，lastProcessedBlock = 1000
00:05 - 所有订单完成，移除所有监控目标
00:05 - 00:60 - 系统空闲 55 分钟，当前区块已到 #1300
       ↳ lastProcessedBlock 仍然是 1000（未更新！）

01:00 - 新订单创建，分配地址并添加监控
       ↳ 需要扫描 1000-1300 共 300 个区块
       ↳ 扫描时间：300 块 × 100ms ≈ 30 秒延迟
       ↳ 用户转账可能在 01:00:05，但系统要到 01:00:35 才能检测到
```

### 修复后的行为

```
时间线：
00:00 - 系统启动，当前区块 #1000，lastProcessedBlock = 1000
00:05 - 所有订单完成，移除所有监控目标
00:05 - 00:60 - 系统空闲 55 分钟
       ✅ 每 3 秒自动更新链高度
       ✅ lastProcessedBlock 持续追踪到当前安全高度
       ✅ 到 01:00 时，lastProcessedBlock ≈ 1297

01:00 - 新订单创建，分配地址并添加监控
       ✅ 只需扫描最新 3 个区块（1297-1300）
       ✅ 扫描时间：< 1 秒
       ✅ 用户转账在 01:00:05，系统在 01:00:06 就能检测到
```

## 技术实现

### 核心修改

文件：`packages/monitor/src/monitor/monitor.ts`

**修改前逻辑**：
```typescript
// 没有目标时完全跳过扫描
if (chainTargets.length === 0) {
  continue; // 跳过，lastProcessedBlock 不更新
}
```

**修改后逻辑**：
```typescript
// 没有目标时只更新链高度，不执行实际扫描
if (shouldSkipScan) {
  const currentBlock = await scanner.getCurrentBlockNumber();
  const safeBlock = currentBlock - this.config.safeBlockDistance;

  // 更新链状态到安全高度
  this.processScanResult(chain, chainState, {
    scannedToBlock: safeBlock,
    transfers: []
  });

  // 继续发出 blockScanned 事件供其他服务使用
  this.emit('blockScanned', { chain, currentBlock, timestamp: Date.now() });
}
```

### 关键特性

1. **轻量级追踪**
   - 只调用 `getCurrentBlockNumber()`，不扫描区块内容
   - 不消费 RPC 配额（只是简单的高度查询）
   - 性能开销极小

2. **保持状态同步**
   - `lastProcessedBlock` 始终追踪安全高度
   - `chain_blocks` 数据库表持续更新
   - Recovery 模式下系统重启也能准确恢复

3. **事件完整性**
   - 继续发出 `blockScanned` 事件
   - DelayedConfirmationService 的区块缓存保持更新
   - 其他依赖链高度的服务正常运行

## 验证方法

### 方法 1：运行演示脚本

```bash
# 编译 monitor
npm run --prefix packages/monitor build

# 运行演示（需要约 30 秒）
tsx packages/monitor/examples/idle-tracking-demo.ts
```

**预期输出**：
```
🚀 Starting Monitor with NO active targets...
✅ Monitor started (no targets active)
⏳ Observing for 10 seconds (NO targets)...

📊 Block Update #1: Chain ethereum-sepolia at block 7234567
📊 Block Update #2: Chain ethereum-sepolia at block 7234569
📊 Block Update #3: Chain ethereum-sepolia at block 7234571

✅ SUCCESS: Chain height was updated 3 times during idle period!
```

### 方法 2：日志观察

启动 Processor 并观察日志：

```bash
npm run --prefix packages/processor build
npm run --prefix app dev
```

**查找日志**：
```
📊 Chain height updated (no targets) - chain: ethereum-sepolia, currentBlock: 7234567
⏭️  NO TARGETS - Updating chain height only - chain: ethereum-sepolia
```

## 对系统的影响

### 性能影响

- **CPU**: 可忽略（只是 RPC 高度查询）
- **内存**: 无额外开销
- **网络**: 每条链每 3 秒 1 次 RPC 调用（`eth_blockNumber`）
- **数据库**: 每条链每 3 秒 1 次 UPDATE 操作

### 用户体验改进

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 空闲 1 小时后创建订单 | 30-60 秒延迟 | < 1 秒延迟 |
| 支付检测响应时间 | 可能延迟数十秒 | 实时检测 |
| 系统可靠性 | 依赖持续业务流量 | 独立持续追踪 |

## 配置选项

可通过 Monitor 配置调整行为：

```yaml
monitor:
  scanInterval: 3000        # 扫描间隔（毫秒）
  safeBlockDistance: 3      # 安全区块距离
  blockRangeSize: 100       # 有目标时的扫描批次大小
```

**建议配置**：
- 测试网：`scanInterval: 3000`（3秒）
- 主网：`scanInterval: 5000`（5秒，降低 RPC 压力）

## 相关文件

- 核心实现：`packages/monitor/src/monitor/monitor.ts`
- 演示脚本：`packages/monitor/examples/idle-tracking-demo.ts`
- 测试用例：`packages/monitor/tests/idle-chain-height-update.test.ts`

## 总结

这个修复确保了 Monitor 系统能够：
✅ 持续追踪所有配置链的最新高度
✅ 即使没有活动监控任务也保持状态同步
✅ 新业务创建时无需长时间追赶历史区块
✅ 提供更好的用户支付体验

**核心原则**：监控系统应该始终了解区块链的当前状态，而不依赖于是否有业务需求。
