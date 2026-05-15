# 数据库连接超时问题解决方案

## 🔍 问题分析

### 错误信息
```
Connection terminated due to connection timeout
Connection terminated unexpectedly
```

### 原因分析

1. **Supabase Pooler 的特性**
   - Pooler 会在空闲一段时间后关闭连接
   - 默认空闲超时约 60 秒
   - Railway 和 Supabase 之间可能有网络延迟

2. **当前配置存在的问题**
   - `CONNECTION_TIMEOUT_MS = 5000` (5秒) - **太短**
   - `IDLE_TIMEOUT_MS = 30000` (30秒) - 可能小于 Supabase Pooler 的超时
   - `STATEMENT_TIMEOUT_MS = 30000` (30秒) - 对于复杂查询可能不够

3. **连接池配置不足**
   - 没有配置连接保活（keepalive）
   - 没有配置重连策略
   - 没有处理连接失败的重试机制

---

## ✅ 解决方案

### 方案 1：优化环境变量（推荐，无需修改代码）

通过环境变量配置数据库连接池参数：

```bash
# 添加以下环境变量到 Railway
railway variables \
  --set "DB_POOL_MAX=20" \
  --set "DB_POOL_MIN=2" \
  --set "DB_CONNECTION_TIMEOUT=30000" \
  --set "DB_IDLE_TIMEOUT=60000" \
  --set "DB_STATEMENT_TIMEOUT=60000" \
  --set "DB_KEEPALIVE=true" \
  --set "DB_KEEPALIVE_INITIAL_DELAY=10000"

# 重新部署
./deploy-fast.sh
```

#### 推荐值说明

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `DB_POOL_MAX` | `20` | 最大连接数 |
| `DB_POOL_MIN` | `2` | 最小保持连接数 |
| `DB_CONNECTION_TIMEOUT` | `30000` (30秒) | 获取连接超时 |
| `DB_IDLE_TIMEOUT` | `60000` (60秒) | 空闲连接保持时间 |
| `DB_STATEMENT_TIMEOUT` | `60000` (60秒) | SQL 执行超时 |
| `DB_KEEPALIVE` | `true` | 启用 TCP keepalive |
| `DB_KEEPALIVE_INITIAL_DELAY` | `10000` (10秒) | keepalive 初始延迟 |

---

### 方案 2：在连接字符串中添加参数（最简单）

修改 `DB_CONNECTION_STRING` 环境变量，添加 Supabase Pooler 优化参数：

```bash
railway variables --set "DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/payin_test?connect_timeout=30&pool_timeout=30&statement_timeout=60000&idle_in_transaction_session_timeout=60000&keepalives=1&keepalives_idle=10&keepalives_interval=5&keepalives_count=5"

# 重新部署
./deploy-fast.sh
```

#### 连接字符串参数说明

| 参数 | 值 | 说明 |
|------|---|------|
| `connect_timeout` | `30` | 连接超时（秒）|
| `pool_timeout` | `30` | 连接池超时（秒）|
| `statement_timeout` | `60000` | 语句超时（毫秒）|
| `idle_in_transaction_session_timeout` | `60000` | 事务空闲超时（毫秒）|
| `keepalives` | `1` | 启用 TCP keepalive |
| `keepalives_idle` | `10` | keepalive 开始前的空闲时间（秒）|
| `keepalives_interval` | `5` | keepalive 探测间隔（秒）|
| `keepalives_count` | `5` | keepalive 探测次数 |

---

### 方案 3：修改代码配置（需要代码更改）

更新 `packages/processor/src/database/database.ts` 中的默认值：

```typescript
// 更新这些常量
private readonly DEFAULT_POOL_SIZE = 10;
private readonly MAX_POOL_SIZE = 20;
private readonly CONNECTION_TIMEOUT_MS = 30000;  // 从 5000 改为 30000
private readonly IDLE_TIMEOUT_MS = 60000;        // 从 30000 改为 60000
private readonly STATEMENT_TIMEOUT_MS = 60000;   // 从 30000 改为 60000
```

并添加 keepalive 配置：

```typescript
const poolConfig = {
  max: this.MAX_POOL_SIZE,
  min: 2,
  idleTimeoutMillis: this.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: this.CONNECTION_TIMEOUT_MS,
  statement_timeout: this.STATEMENT_TIMEOUT_MS,
  query_timeout: this.STATEMENT_TIMEOUT_MS,
  allowExitOnIdle: true,

  // 添加 keepalive 配置
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};
```

---

## 🚀 快速修复步骤

### 推荐做法（无需修改代码）

#### 步骤 1：更新数据库连接字符串

```bash
railway variables --set "DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/payin_test?connect_timeout=30&statement_timeout=60000&keepalives=1&keepalives_idle=10&keepalives_interval=5"
```

#### 步骤 2：重新部署

```bash
./deploy-fast.sh
```

#### 步骤 3：验证

```bash
# 检查日志
railway logs

# 验证 API
curl https://payin-api-test.up.railway.app/health
```

---

## 🔧 其他优化建议

### 1. 使用 pgBouncer 模式

Supabase Pooler 支持两种模式：

**Transaction 模式（推荐）**：
```
postgresql://postgres.example-project-ref:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**Session 模式**（如果需要更长的连接）：
```
postgresql://postgres.example-project-ref:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

端口说明：
- `5432` - Transaction 模式（默认，推荐）
- `6543` - Session 模式（更长连接时间）

### 2. 添加连接重试逻辑

在应用层添加重试机制（代码层面）：

```typescript
// 示例：带重试的查询
async function queryWithRetry(sql: string, params: any[], maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.message.includes('Connection terminated')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. 监控连接池状态

添加连接池监控（代码层面）：

```typescript
pool.on('connect', () => {
  logger.debug('New client connected to pool');
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});

pool.on('error', (err) => {
  logger.error('Unexpected pool error:', err);
});
```

### 4. 定期健康检查

确保连接池保持活跃：

```typescript
// 每 30 秒执行一次简单查询保持连接活跃
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    logger.error('Health check failed:', error);
  }
}, 30000);
```

---

## 📊 不同场景的推荐配置

### 场景 1：低流量应用（测试环境）

```bash
DB_POOL_MAX=10
DB_POOL_MIN=1
DB_CONNECTION_TIMEOUT=20000
DB_IDLE_TIMEOUT=60000
DB_STATEMENT_TIMEOUT=30000
```

### 场景 2：中等流量应用（生产环境）

```bash
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=60000
DB_STATEMENT_TIMEOUT=60000
```

### 场景 3：高流量应用

```bash
DB_POOL_MAX=50
DB_POOL_MIN=5
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=120000
DB_STATEMENT_TIMEOUT=90000
```

---

## ⚠️ Supabase Pooler 限制

### 免费计划限制
- 最大连接数：100
- 每个连接的空闲超时：约 60 秒
- Transaction 模式推荐用于大多数应用

### 付费计划
- 更高的连接数限制
- 更长的空闲超时
- 更好的性能保证

---

## 🧪 测试验证

### 1. 测试连接

```bash
# 使用 psql 测试连接
psql "postgresql://postgres:postgres@localhost:5432/payin_test?connect_timeout=30"
```

### 2. 压力测试

```bash
# 模拟多个并发请求
for i in {1..10}; do
  curl https://payin-api-test.up.railway.app/api/v1/orders &
done
wait

# 检查是否有连接错误
```

### 3. 监控日志

```bash
# 实时查看日志
railway logs

# 过滤连接错误
railway logs | grep "Connection terminated"
```

---

## 📝 实施检查清单

- [ ] 更新 `DB_CONNECTION_STRING` 添加连接参数
- [ ] 设置适当的超时值
- [ ] 启用 TCP keepalive
- [ ] 重新部署应用
- [ ] 验证健康检查端点
- [ ] 监控日志查看是否还有错误
- [ ] 进行压力测试验证
- [ ] 根据实际情况调整参数

---

## 🔍 故障排查

### 如果问题依然存在

1. **检查 Supabase 状态**
   - 访问 Supabase 控制台
   - 查看数据库活动连接数
   - 检查是否达到连接限制

2. **切换到 Session 模式**
   ```bash
   # 改用端口 6543（Session 模式）
   railway variables --set "DB_CONNECTION_STRING=postgresql://...@...pooler.supabase.com:6543/postgres"
   ```

3. **考虑使用直连**
   ```bash
   # 如果 Pooler 持续有问题，临时使用直连
   railway variables --set "DB_CONNECTION_STRING=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
   ```

4. **联系 Supabase 支持**
   - 如果是 Pooler 本身的问题
   - 可能需要升级到付费计划

---

## 📚 相关资源

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [node-postgres Pool 配置](https://node-postgres.com/apis/pool)
- [PostgreSQL Connection Parameters](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS)

---

## 🎯 推荐立即执行

```bash
# 1. 更新连接字符串（添加优化参数）
railway variables --set "DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/payin_test?connect_timeout=30&statement_timeout=60000&idle_in_transaction_session_timeout=60000&keepalives=1&keepalives_idle=10&keepalives_interval=5"

# 2. 重新部署
./deploy-fast.sh

# 3. 验证
curl https://payin-api-test.up.railway.app/health
railway logs
```

这应该能解决大部分连接超时问题！
