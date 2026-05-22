# 安全最佳实践

在处理加密货币支付时，安全性至关重要。本指南涵盖了将 PayIn 集成到您的应用程序中的关键安全实践。

## 安全基础

PayIn 在设计时将安全放在核心位置：

- 🔐 **资金非托管**：您通过助记词完全控制私钥
- 🔒 **端到端加密**：所有 API 通信使用 HTTPS
- 🛡️ **签名验证**：使用 HMAC-SHA256 对 Webhook 进行签名
- 📊 **完整审计日志**：所有操作都会记录并可追溯
- 🔑 **细粒度访问控制**：基于角色的权限管理（所有者、管理员、成员、查看者）

**您的责任：**
- 保护 API 密钥和 Webhook 密钥
- 安全存储助记词
- 验证所有 Webhook 签名
- 监控可疑活动
- 遵循生产环境安全最佳实践

## API 密钥安全

API 密钥是访问您 PayIn 账户的凭证。请像对待密码一样保护它们。

### 存储最佳实践

**✅ 应该做的：**
- 存储在环境变量中（`process.env.PAYIN_API_KEY`）
- 使用密钥管理系统（AWS Secrets Manager、HashiCorp Vault、Azure Key Vault）
- 加密存储静态密钥
- 为测试网和主网使用不同的密钥
- 为不同的服务/环境创建单独的密钥

```bash
# .env 文件
PAYIN_TESTNET_KEY=pk_test_abc123...
PAYIN_MAINNET_KEY=pk_live_xyz789...
```

**❌ 不应该做的：**
- 将密钥提交到版本控制系统（Git、SVN 等）
- 在应用程序代码中硬编码密钥
- 在应用程序日志中记录密钥
- 通过电子邮件或聊天工具分享密钥
- 在客户端代码中暴露密钥（JavaScript、移动应用）
- 在多个环境中使用相同的密钥

### 密钥轮换

定期轮换 API 密钥以最大程度降低密钥泄露时的风险。

**轮换计划：**
- 🔄 **每 90 天**：常规轮换
- ⚠️ **立即**：团队成员离职或怀疑密钥泄露
- 🚨 **24 小时内**：确认安全事件

**零停机轮换：**

```bash
# 步骤 1：通过 Open operator API/CLI 创建新的 API 密钥
NEW_KEY=pk_live_new123...

# 步骤 2：更新环境变量（暂时保留旧密钥）
PAYIN_API_KEY=$NEW_KEY
PAYIN_API_KEY_OLD=$OLD_KEY

# 步骤 3：部署双密钥支持
# 您的应用程序应该先尝试新密钥，如果需要则回退到旧密钥

# 步骤 4：24 小时后验证新密钥正常工作
# 检查日志中是否有使用旧密钥的情况

# 步骤 5：通过 Open operator API/CLI 删除旧密钥
```

**实现代码：**

```typescript
async function makeApiCall(endpoint: string, options: any) {
  // 首先尝试新密钥
  try {
    return await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        ...options.headers
      }
    });
  } catch (error) {
    // 过渡期间回退到旧密钥
    if (process.env.PAYIN_API_KEY_OLD) {
      console.warn('Falling back to old API key');
      return await fetch(endpoint, {
        ...options,
        headers: {
          'Authorization': `Bearer ${process.env.PAYIN_API_KEY_OLD}`,
          ...options.headers
        }
      });
    }
    throw error;
  }
}
```

### 密钥范围和权限

PayIn 使用基于角色的访问控制：

| 角色 | 权限 | 使用场景 |
|------|-------------|----------|
| **所有者** | 完全访问权限，可转让所有权 | 组织创始人 |
| **管理员** | 管理设置、成员、API 密钥 | 运营团队 |
| **成员** | 创建订单、充值、查看数据 | 应用后端 |
| **查看者** | 只读访问权限 | 监控、分析 |

**最佳实践：**
- ✅ 创建具有最小必要权限的密钥
- ✅ 为读取和写入操作使用单独的密钥
- ✅ 每个服务/应用程序使用一个密钥
- ✅ 通过日志、指标或自托管 operator 工具监控密钥使用情况

### 监控密钥使用

监控 API 密钥使用情况以发现可疑活动：

```typescript
// 记录所有 API 调用及密钥 ID
logger.info('API call', {
  endpoint: '/orders',
  keyId: extractKeyId(apiKey),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// 对异常模式发出警报
if (callsInLastHour > 1000) {
  await sendAlert({
    type: 'api_abuse',
    message: `异常 API 活动：最近一小时内有 ${callsInLastHour} 次调用`,
    keyId: extractKeyId(apiKey)
  });
}
```

## Webhook 安全

Webhook 是从 PayIn 到您服务器的 HTTP 回调。保护它们至关重要。

### 签名验证（必需）

**始终使用 HMAC-SHA256 验证 webhook 签名：**

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  const timestamp = parseInt(parts.find(p => p.startsWith('t='))!.split('=')[1]);
  const sig = parts.find(p => p.startsWith('v1='))!.split('=')[1];

  // 检查时间戳容差（5 分钟）
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 300) {
    throw new Error('Webhook timestamp expired');
  }

  // 计算预期签名
  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // 时间安全比较
  return crypto.timingSafeEqual(
    Buffer.from(sig, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

::: tip 完整的 Webhook 安全性
请参阅 [Webhooks 指南](/zh/guide/webhooks#signature-verification) 获取 TypeScript、Python 和 PHP 的完整签名验证实现。
:::

### 端点保护

1. **仅使用 HTTPS**
   - PayIn 要求使用 HTTPS webhook 端点
   - 使用有效的 SSL/TLS 证书
   - 生产环境中不要使用自签名证书

2. **身份验证**（可选）
   - 添加自定义身份验证头
   - 如果可行，实现 IP 白名单
   - 对于敏感的 webhook，使用 VPN 或私有网络

3. **速率限制**
   ```typescript
   import rateLimit from 'express-rate-limit';

   const webhookLimiter = rateLimit({
     windowMs: 1 * 60 * 1000, // 1 分钟
     max: 100, // 每分钟 100 个请求
     message: 'Too many webhook requests'
   });

   app.post('/webhooks/payin', webhookLimiter, handleWebhook);
   ```

4. **输入验证**
   ```typescript
   app.post('/webhooks/payin', async (req, res) => {
     // 验证事件结构
     const event = req.body;
     if (!event.id || !event.type || !event.data) {
       return res.status(400).json({ error: 'Invalid webhook structure' });
     }

     // 验证事件类型
     const validTypes = [
       'order.completed', 'order.expired',
       'deposit.completed', 'deposit.address_bound'
     ];
     if (!validTypes.includes(event.type)) {
       return res.status(400).json({ error: 'Unknown event type' });
     }

     // 处理 webhook...
   });
   ```

### 重放攻击防护

防止攻击者重放旧的 webhook：

```typescript
// 跟踪已处理的 webhook ID（生产环境中使用 Redis 或数据库）
const processedWebhooks = new Set<string>();

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // 检查是否已处理
  if (processedWebhooks.has(event.id)) {
    console.warn('Replay attack detected:', event.id);
    return res.status(200).json({ received: true }); // 仍然返回 200
  }

  // 验证签名（包括时间戳检查）
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 处理 webhook
  await handleWebhook(event);
  processedWebhooks.add(event.id);

  res.json({ received: true });
});
```

## 助记词安全

您的助记词是 PayIn 生成的所有地址的主密钥。**如果有人获得了您的助记词，他们就控制了您的资金。**

### 存储要求

**🔴 关键：**
- **永远不要在数据库中存储助记词**
- **永远不要记录助记词**
- **永远不要通过网络传输助记词**
- **永远不要将助记词提交到版本控制系统**

**推荐的存储方式：**
1. **硬件安全模块（HSM）** - 适用于高价值操作
2. **离线计算机** - 离线存储，永不连接互联网
3. **加密纸质备份** - 物理存储在安全位置
4. **加密 USB 驱动器** - 存储在银行保险箱中

### 生成地址

安全地使用 PayIn 的地址生成工具：

```bash
# 在离线计算机上生成地址
payin-address-tool generate \
  --mnemonic "your twelve word seed phrase..." \
  --protocol evm \
  --count 1000 \
  --output addresses.json

# 将 addresses.json 传输到在线计算机
# 通过管理 UI 或 API 导入到 PayIn

# ⚠️ 永远不要将助记词上传到任何在线服务
```

### 多重签名替代方案

对于高价值部署，考虑使用多重签名钱包：
- 提款需要多个批准
- 将控制权分配给多方
- 减少单点故障

## 支付验证

在完成订单之前始终验证支付。

### 金额验证

```typescript
async function verifyPayment(webhook: any) {
  const { amount, currency, orderId } = webhook.data;

  // 1. 获取原始订单
  const order = await db.orders.findUnique({ where: { id: orderId } });

  // 2. 验证精确金额（以最小单位计算）
  if (amount !== order.amount) {
    throw new Error(`金额不匹配：期望 ${order.amount}，实际 ${amount}`);
  }

  // 3. 验证货币
  if (currency !== order.currency) {
    throw new Error(`货币不匹配：期望 ${order.currency}，实际 ${currency}`);
  }

  // 4. 验证订单尚未完成
  if (order.status === 'fulfilled') {
    throw new Error('订单已完成');
  }

  return true;
}
```

### 交易验证

```typescript
async function verifyTransaction(txHash: string, chainId: string) {
  // 1. 检查交易是否存在于区块链上
  const tx = await blockchainProvider.getTransaction(txHash);
  if (!tx) {
    throw new Error('未找到交易');
  }

  // 2. 验证足够的确认数
  const confirmations = await blockchainProvider.getConfirmations(txHash);
  const required = getRequiredConfirmations(chainId); // 例如，Ethereum 需要 3 个确认
  if (confirmations < required) {
    throw new Error(`确认数不足：${confirmations}/${required}`);
  }

  // 3. 验证交易成功
  if (!tx.status) {
    throw new Error('交易失败');
  }

  return true;
}
```

### 地址验证

```typescript
async function verifyAddress(address: string, protocol: string) {
  // 1. 验证地址格式
  if (!isValidAddress(address, protocol)) {
    throw new Error('地址格式无效');
  }

  // 2. 验证地址所有权（属于您的地址池）
  const owned = await db.addressPool.findUnique({
    where: { address, protocol }
  });
  if (!owned) {
    throw new Error('地址不在地址池中');
  }

  // 3. 验证地址正确分配
  if (owned.status !== 'allocated' && owned.status !== 'bound') {
    throw new Error('地址未正确分配');
  }

  return true;
}
```

## 网络安全

### 全程使用 HTTPS

所有通信必须使用 HTTPS：

```typescript
// ❌ 错误：HTTP 端点
const API_BASE = 'http://<your-payin-open-api>'; // 不安全

// ✅ 正确：HTTPS 端点
const API_BASE = 'https://<your-payin-open-api>'; // 安全
```

**要求：**
- 使用 TLS 1.2 或更高版本
- 有效的 SSL/TLS 证书（生产环境中不使用自签名证书）
- 启用 HSTS 头
- 移动应用使用证书固定

### 防火墙配置

```bash
# 仅允许必要的端口
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 22/tcp   # SSH（限制特定 IP）
sudo ufw deny 80/tcp    # 阻止 HTTP
sudo ufw enable

# 限制数据库访问
sudo ufw allow from 10.0.1.0/24 to any port 5432  # PostgreSQL
```

### DDoS 防护

使用 DDoS 防护服务：
- Cloudflare
- AWS Shield
- Akamai
- Fastly

## 访问控制

### 基于角色的访问控制（RBAC）

实施最小权限原则：

```typescript
// 定义角色和权限
const ROLES = {
  owner: ['*'],  // 所有权限
  admin: ['orders:*', 'deposits:*', 'webhooks:*', 'keys:*'],
  member: ['orders:create', 'orders:read', 'deposits:create', 'deposits:read'],
  viewer: ['orders:read', 'deposits:read']
};

function checkPermission(user: User, permission: string): boolean {
  const userPermissions = ROLES[user.role];
  return userPermissions.includes('*') ||
         userPermissions.includes(permission) ||
         userPermissions.some(p => p.endsWith(':*') && permission.startsWith(p.split(':')[0]));
}

// 使用
if (!checkPermission(user, 'orders:create')) {
  throw new Error('权限不足');
}
```

### 多因素认证（MFA）

对于 PayIn Open，请使用身份提供商、VPN 或部署平台 MFA 保护 operator 访问。如果使用 PayIn Cloud，请在 **设置** → **安全** 中启用仪表板 MFA。

**强制执行 MFA：**
- ✅ 所有所有者账户
- ✅ 所有管理员账户
- ✅ 生产环境访问
- ✅ API 密钥创建

### 会话管理

```typescript
// 实施安全的会话处理
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // 仅 HTTPS
    httpOnly: true,    // 无法通过 JavaScript 访问
    sameSite: 'strict', // CSRF 保护
    maxAge: 3600000    // 1 小时
  }
};
```

## 日志和监控

### 全面的日志记录

记录所有关键操作：

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// 记录 API 调用
app.use((req, res, next) => {
  logger.info('API request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  next();
});

// 记录 webhook 交付
logger.info('Webhook received', {
  eventId: event.id,
  eventType: event.type,
  deliveryId: req.headers['x-payin-delivery-id'],
  timestamp: new Date().toISOString()
});

// 记录支付确认
logger.info('Payment confirmed', {
  orderId: order.id,
  amount: order.amount,
  currency: order.currency,
  txHash: payment.txHash,
  timestamp: new Date().toISOString()
});
```

**⚠️ 永远不要记录：**
- API 密钥或 webhook 密钥
- 助记词
- 私钥
- 完整的信用卡号（如果适用）
- 密码

### 实时监控

设置监控和警报：

```typescript
// 监控异常活动
async function monitorApiActivity() {
  const last10MinCalls = await db.auditLogs.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
    }
  });

  if (last10MinCalls > 1000) {
    await sendAlert({
      type: 'api_spike',
      message: `API 活动高峰：10 分钟内有 ${last10MinCalls} 次调用`,
      severity: 'high'
    });
  }
}

// 监控失败的 webhook
async function monitorWebhookFailures() {
  const failed = await db.webhookLogs.count({
    where: {
      status: 'failed',
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });

  if (failed > 10) {
    await sendAlert({
      type: 'webhook_failures',
      message: `15 分钟内有 ${failed} 个 webhook 失败`,
      severity: 'critical'
    });
  }
}

// 定期运行监控
setInterval(monitorApiActivity, 5 * 60 * 1000);  // 每 5 分钟
setInterval(monitorWebhookFailures, 5 * 60 * 1000);
```

## 数据安全

### 静态加密

加密数据库中的敏感数据：

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 字节
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// 使用
await db.users.create({
  data: {
    email: user.email,
    sensitiveData: encrypt(user.sensitiveData)
  }
});
```

### 数据库安全

```bash
# PostgreSQL 配置
# /etc/postgresql/postgresql.conf

# 加密连接
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'

# 强身份验证
password_encryption = scram-sha-256

# 连接限制
max_connections = 100
```

### 备份安全

```bash
# 加密数据库备份
pg_dump payindb | gzip | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out backup_$(date +%Y%m%d).sql.gz.enc

# 将加密备份存储在多个位置
aws s3 cp backup_*.enc s3://payinbackups/ --sse AES256
```

## 事件响应

### 准备

1. **创建事件响应计划**
   - 定义角色和职责
   - 记录升级程序
   - 建立沟通渠道
   - 准备常见场景的运行手册

2. **事件响应团队**
   - 事件指挥官
   - 技术负责人
   - 安全官
   - 沟通负责人

### 检测

监控安全事件：

```typescript
// 检测可疑模式
const suspiciousPatterns = {
  rapidApiCalls: { threshold: 100, window: 60 }, // 100 次调用/分钟
  failedLogins: { threshold: 5, window: 300 },   // 5 次失败/5分钟
  unusualIPs: { threshold: 10, window: 3600 },   // 10 个不同 IP/小时
  largeOrders: { threshold: 10000, currency: 'USDT' }
};

async function detectAnomalies() {
  // 检查单个 IP 的快速 API 调用
  const rapidCalls = await db.auditLogs.groupBy({
    by: ['ipAddress'],
    where: {
      createdAt: { gte: new Date(Date.now() - 60000) }
    },
    _count: true,
    having: {
      _count: { gte: 100 }
    }
  });

  if (rapidCalls.length > 0) {
    await triggerIncident({
      type: 'api_abuse',
      details: rapidCalls,
      severity: 'medium'
    });
  }
}
```

### 响应

检测到事件时：

1. **评估** - 确定范围和严重程度
2. **遏制** - 停止正在进行的攻击
3. **根除** - 移除威胁
4. **恢复** - 恢复正常运营
5. **审查** - 事后分析

**常见操作：**
```typescript
// 撤销受损的 API 密钥
await revokeApiKey(compromisedKeyId);

// 阻止可疑 IP
await addIpToBlocklist(suspiciousIp);

// 轮换 webhook 密钥
await rotateWebhookSecret(endpointId);

// 通知受影响的用户
await notifyUsers({
  type: 'security_incident',
  message: '我们检测到可疑活动...',
  actions: ['重置密码', '审查最近的交易']
});
```

### 恢复

事件发生后：

1. 记录事件时间线
2. 确定根本原因
3. 实施修复
4. 更新安全程序
5. 与团队分享经验教训

## 安全检查清单

### 开发阶段

- [ ] API 密钥存储在环境变量中
- [ ] 实现 Webhook 签名验证
- [ ] 所有端点使用 HTTPS
- [ ] 所有用户输入都进行输入验证
- [ ] 错误消息不泄露敏感信息
- [ ] 代码或版本控制中没有秘密
- [ ] 检查依赖漏洞（`npm audit`）
- [ ] 代码审查安全问题

### 测试阶段

- [ ] 执行安全测试
- [ ] 完成测试网测试
- [ ] 测试 Webhook 签名验证
- [ ] 测试支付验证逻辑
- [ ] 测试错误场景
- [ ] 测试速率限制
- [ ] 渗透测试（高价值项目）

### 上线前

- [ ] 从测试网密钥轮换 API 密钥
- [ ] 配置 Webhook 密钥
- [ ] HTTPS 证书有效
- [ ] 配置防火墙规则
- [ ] 数据库加密
- [ ] 配置并测试备份
- [ ] 设置监控和警报
- [ ] 记录事件响应计划
- [ ] 培训团队安全程序

### 生产环境

- [ ] 定期密钥轮换计划（90 天）
- [ ] 主动监控和警报
- [ ] 定期安全审计
- [ ] 每月测试备份程序
- [ ] 每季度进行事件响应演练
- [ ] 定期更新依赖项
- [ ] 每周审查审计日志
- [ ] 每季度审查访问控制

### 合规性（如适用）

- [ ] GDPR 合规（欧盟用户）
- [ ] CCPA 合规（加州用户）
- [ ] PCI DSS 合规（如果处理卡片）
- [ ] KYC/AML 程序（如果需要）
- [ ] 数据保留政策
- [ ] 发布隐私政策
- [ ] 发布服务条款

## 常见漏洞

### API 滥用

**问题：** 攻击者进行过多的 API 调用

**防护：**
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个窗口 100 个请求
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

### SQL 注入

**问题：** 攻击者注入恶意 SQL

**防护：**
```typescript
// ❌ 错误：字符串拼接
const query = `SELECT * FROM users WHERE email = '${userInput}'`;

// ✅ 正确：参数化查询
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [userInput]);
```

### 跨站脚本攻击（XSS）

**问题：** 攻击者注入恶意脚本

**防护：**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// 清理用户输入
const cleanInput = DOMPurify.sanitize(userInput);

// 设置 Content-Security-Policy 头
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  next();
});
```

### 不安全的依赖项

**问题：** 使用具有已知漏洞的包

**防护：**
```bash
# 检查漏洞
npm audit

# 自动修复漏洞
npm audit fix

# 安装前检查
npm install --audit=true

# 使用 Snyk 进行持续监控
npm install -g snyk
snyk test
```

## 安全资源

### 工具

- **依赖扫描**：`npm audit`、Snyk、Dependabot
- **秘密检测**：GitGuardian、TruffleHog
- **静态分析**：ESLint（带安全插件）、SonarQube
- **动态分析**：OWASP ZAP、Burp Suite
- **监控**：Datadog、New Relic、Sentry

### 学习资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Web Security Academy (PortSwigger)](https://portswigger.net/web-security)

## 报告安全问题

如果您在 PayIn 中发现安全漏洞：

**📧 邮箱：** security@payin.com

**请包含：**
- 漏洞描述
- 重现步骤
- 潜在影响
- 建议修复（如有）

**请：**
- ✅ 首先私下报告
- ✅ 给我们合理的修复时间（90 天）
- ✅ 不要利用漏洞
- ❌ 在解决之前不要公开披露

我们感谢负责任的披露，并可能认可帮助改进 PayIn 安全性的安全研究人员。

## 下一步

### 重要的安全指南

- **[Webhooks 安全](/zh/guide/webhooks#signature-verification)** - 完整的 webhook 安全实现
- **[API 集成](/zh/guide/api-integration#error-handling)** - 安全的 API 使用模式

### 设置指南

- **[地址池设置](/zh/guide/address-pool-setup)** - 安全的地址生成
- **[使用 MCP 快速开始](/zh/guide/quick-start-mcp)** - 安全地开始使用

---

**请记住：** 安全不是一次性设置。它是一个持续监控、更新和改进防御的过程。保持警惕！
