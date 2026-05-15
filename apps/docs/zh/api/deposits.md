# 充值 API

管理用户充值地址和追踪充值记录。

## 概述

充值 API 允许您为用户绑定永久充值地址、查询充值历史和管理充值引用。与订单不同，充值地址是持久的，可以随时间接收多次充值。

**基础端点：** `/api/v1/deposits`

**身份验证：** 必需（API 密钥）

## 绑定充值地址

为用户创建永久充值地址。

**端点：**
```
POST /api/v1/deposits/references
```

**请求体：**

```json
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "metadata": {
    "userId": "alice_123",
    "userName": "Alice Smith",
    "email": "alice@example.com"
  }
}
```

**参数：**

| 参数 | 类型 | 必需 | 描述 |
|-----------|------|----------|-------------|
| `depositReference` | string | 是 | 您的唯一用户标识符（最多 255 字符） |
| `currency` | string | 是 | 货币代码（`USDT`、`USDC`、`DAI`） |
| `chainId` | string | 是 | 区块链链 ID |
| `metadata` | object | 否 | 自定义元数据（最多 10 个键值对） |

**响应（201 Created）：**

```json
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "protocol": "evm",
  "address": "0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B",
  "metadata": {
    "userId": "alice_123",
    "userName": "Alice Smith",
    "email": "alice@example.com"
  },
  "createdAt": "2025-01-20T10:30:00.000Z"
}
```

**示例（cURL）：**

```bash
curl -X POST https://your-payin.example.com/api/v1/deposits/references \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "depositReference": "user_alice_123",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

**示例（TypeScript）：**

```typescript
async function createDepositAddress(userId: string) {
  const response = await fetch(
    'https://your-payin.example.com/api/v1/deposits/references',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.PAYIN_API_KEY!
      },
      body: JSON.stringify({
        depositReference: `user_${userId}`,
        currency: 'USDT',
        chainId: 'polygon-amoy',
        metadata: {
          userId,
          createdFrom: 'web-app'
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    if (error.code === 'DUPLICATE_DEPOSIT_REFERENCE') {
      // Address already exists, fetch it
      return await getDepositAddress(`user_${userId}`);
    }
    throw error;
  }

  const depositRef = await response.json();
  console.log('Deposit address:', depositRef.address);

  // Save to your database
  await db.users.update({
    where: { id: userId },
    data: {
      depositAddress: depositRef.address,
      depositChain: depositRef.chainId
    }
  });

  return depositRef;
}
```

**示例（Python）：**

```python
def create_deposit_address(user_id: str):
    response = requests.post(
        'https://your-payin.example.com/api/v1/deposits/references',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': os.getenv('PAYIN_API_KEY')
        },
        json={
            'depositReference': f'user_{user_id}',
            'currency': 'USDT',
            'chainId': 'polygon-amoy',
            'metadata': {
                'userId': user_id
            }
        }
    )

    if response.status_code == 409:  # Duplicate
        return get_deposit_address(f'user_{user_id}')

    response.raise_for_status()
    deposit_ref = response.json()

    print(f"Deposit address: {deposit_ref['address']}")
    return deposit_ref
```

## 获取充值引用

通过引用检索充值地址信息。

**端点：**
```
GET /api/v1/deposits/references/:depositReference
```

**路径参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `depositReference` | string | 您的充值引用（例如 `user_alice_123`） |

**响应（200 OK）：**

```json
{
  "depositReference": "user_alice_123",
  "addresses": [
    {
      "currency": "USDT",
      "chainId": "ethereum-sepolia",
      "protocol": "evm",
      "address": "0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B",
      "createdAt": "2025-01-20T10:30:00.000Z"
    },
    {
      "currency": "USDT",
      "chainId": "polygon-amoy",
      "protocol": "evm",
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "createdAt": "2025-01-20T11:00:00.000Z"
    }
  ],
  "totalDeposits": 5,
  "totalAmount": {
    "USDT": "523.45"
  },
  "metadata": {
    "userId": "alice_123",
    "userName": "Alice Smith"
  }
}
```

**示例（cURL）：**

```bash
curl https://your-payin.example.com/api/v1/deposits/references/user_alice_123 \
  -H "X-API-Key: your-api-key"
```

**示例（TypeScript）：**

```typescript
async function getDepositAddress(depositReference: string) {
  const response = await fetch(
    `https://your-payin.example.com/api/v1/deposits/references/${depositReference}`,
    {
      headers: {
        'X-API-Key': process.env.PAYIN_API_KEY!
      }
    }
  );

  if (!response.ok) {
    throw new Error('Deposit reference not found');
  }

  const depositRef = await response.json();

  console.log('User deposit addresses:');
  depositRef.addresses.forEach(addr => {
    console.log(`- ${addr.chainId}: ${addr.address}`);
  });

  console.log(`Total deposits: ${depositRef.totalDeposits}`);
  console.log(`Total amount: ${depositRef.totalAmount.USDT} USDT`);

  return depositRef;
}
```

## 列出充值引用

获取所有充值引用的分页列表。

**端点：**
```
GET /api/v1/deposits/references
```

**查询参数：**

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `page` | integer | 1 | 页码 |
| `limit` | integer | 20 | 每页条目数（最大：100） |
| `search` | string | - | 按充值引用搜索 |

**响应（200 OK）：**

```json
{
  "data": [
    {
      "depositReference": "user_alice_123",
      "protocols": ["evm"],
      "addressCount": 2,
      "totalDeposits": 5,
      "totalAmount": {
        "USDT": "523.45"
      },
      "lastDepositAt": "2025-01-20T15:30:00.000Z"
    },
    // ... more deposit references
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1523,
    "totalPages": 77,
    "hasMore": true
  }
}
```

**示例（cURL）：**

```bash
# List all deposit references
curl "https://your-payin.example.com/api/v1/deposits/references?limit=50" \
  -H "X-API-Key: your-api-key"

# Search for specific user
curl "https://your-payin.example.com/api/v1/deposits/references?search=alice" \
  -H "X-API-Key": your-api-key"
```

## 列出充值记录

获取充值交易历史。

**端点：**
```
GET /api/v1/deposits
```

**查询参数：**

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `page` | integer | 1 | 页码 |
| `limit` | integer | 20 | 每页条目数（最大：100） |
| `depositReference` | string | - | 按充值引用过滤 |
| `status` | string | - | 按状态过滤：`pending`、`confirmed`、`completed` |
| `currency` | string | - | 按货币过滤 |
| `chainId` | string | - | 按链过滤 |
| `sortBy` | string | `detectedAt` | 排序字段 |
| `sortOrder` | string | `desc` | 排序方向 |

**响应（200 OK）：**

```json
{
  "data": [
    {
      "depositId": "dep_xyz789abc123",
      "depositReference": "user_alice_123",
      "amount": "100.50",
      "currency": "USDT",
      "chainId": "ethereum-sepolia",
      "address": "0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B",
      "txHash": "0xabc123def456...",
      "blockNumber": 1234567,
      "status": "completed",
      "confirmations": 25,
      "detectedAt": "2025-01-20T15:30:00.000Z",
      "confirmedAt": "2025-01-20T15:32:15.000Z",
      "completedAt": "2025-01-20T15:32:15.000Z"
    },
    // ... more deposits
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasMore": true
  }
}
```

**示例（cURL）：**

```bash
# Get all deposits for a user
curl "https://your-payin.example.com/api/v1/deposits?depositReference=user_alice_123" \
  -H "X-API-Key: your-api-key"

# Get pending deposits
curl "https://your-payin.example.com/api/v1/deposits?status=pending" \
  -H "X-API-Key: your-api-key"
```

**示例（TypeScript）：**

```typescript
async function getUserDepositHistory(depositReference: string) {
  const response = await fetch(
    `https://your-payin.example.com/api/v1/deposits?depositReference=${depositReference}&sortBy=detectedAt&sortOrder=desc`,
    {
      headers: {
        'X-API-Key': process.env.PAYIN_API_KEY!
      }
    }
  );

  const { data: deposits, pagination } = await response.json();

  console.log(`Total deposits: ${pagination.total}`);

  let totalAmount = 0;
  deposits.forEach(deposit => {
    console.log(`${deposit.detectedAt}: ${deposit.amount} ${deposit.currency} (${deposit.status})`);
    if (deposit.status === 'completed') {
      totalAmount += parseFloat(deposit.amount);
    }
  });

  console.log(`Total completed: ${totalAmount.toFixed(2)} USDT`);

  return deposits;
}
```

## 解绑充值地址

移除充值地址绑定（可选，永久地址）。

**端点：**
```
DELETE /api/v1/deposits/references/:depositReference
```

**路径参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `depositReference` | string | 要解绑的充值引用 |

**查询参数：**

| 参数 | 类型 | 必需 | 描述 |
|-----------|------|----------|-------------|
| `chainId` | string | 否 | 要解绑的特定链（如果省略则解绑所有链） |

**响应（200 OK）：**

```json
{
  "success": true,
  "message": "Deposit reference unbound",
  "depositReference": "user_alice_123",
  "unboundAddresses": 2
}
```

**示例（cURL）：**

```bash
# Unbind all addresses for a deposit reference
curl -X DELETE https://your-payin.example.com/api/v1/deposits/references/user_alice_123 \
  -H "X-API-Key: your-api-key"

# Unbind specific chain only
curl -X DELETE "https://your-payin.example.com/api/v1/deposits/references/user_alice_123?chainId=ethereum-sepolia" \
  -H "X-API-Key: your-api-key"
```

**示例（TypeScript）：**

```typescript
async function closeUserAccount(userId: string) {
  const depositReference = `user_${userId}`;

  // Unbind all deposit addresses
  const response = await fetch(
    `https://your-payin.example.com/api/v1/deposits/references/${depositReference}`,
    {
      method: 'DELETE',
      headers: {
        'X-API-Key': process.env.PAYIN_API_KEY!
      }
    }
  );

  const result = await response.json();
  console.log(`Unbound ${result.unboundAddresses} addresses`);

  // Update your database
  await db.users.update({
    where: { id: userId },
    data: {
      depositAddress: null,
      accountClosed: true
    }
  });
}
```

::: warning 地址回收
解绑后，地址进入 30 分钟冷却期，然后才会返回地址池进行复用。
:::

## 充值状态流程

充值按以下状态转换：

```
pending → confirmed → completed
```

**状态定义：**

| 状态 | 描述 | 终态 |
|--------|-------------|----------|
| `pending` | 检测到充值，等待确认 | 否 |
| `confirmed` | 收到所需确认数 | 否 |
| `completed` | 充值完全处理完成 | 是 |

::: tip Webhook 事件
- `deposit.completed` - 达到所需区块链确认数后触发
- `deposit.address_bound` - 充值地址分配给用户时触发
- `deposit.address_unbound` - 充值地址释放时触发

详见 [Webhooks 指南](/zh/guide/webhooks)。
:::

## 多链监控

当您绑定充值地址时，PayIn 自动监控该协议的**所有链**：

**示例：**
```json
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",  // Bind on Sepolia
  // ...
}
```

**自动监控：**
- ✅ Ethereum Sepolia（指定的）
- ✅ Ethereum Mainnet（相同协议）
- ✅ Polygon Amoy（相同协议）
- ✅ Polygon Mainnet（相同协议）
- ✅ Base Sepolia（相同协议）
- ✅ Base Mainnet（相同协议）

该地址在**任何 EVM 链**上的任何 USDT 充值都将被检测和记录。

::: tip 协议族
- **EVM**：Ethereum、Polygon、Base 等
- **Tron**：Tron Mainnet、Tron Nile
- **Solana**：Solana Mainnet、Solana Devnet
:::

## 元数据

在充值引用中存储自定义数据：

```json
{
  "metadata": {
    "userId": "alice_123",
    "userName": "Alice Smith",
    "email": "alice@example.com",
    "accountType": "premium",
    "createdFrom": "mobile-app",
    "region": "US"
  }
}
```

**用例：**
- 关联到您的用户系统
- 存储用户信息
- 追踪账户详情
- 添加内部备注

## 最佳实践

### 1. 使用描述性引用

```typescript
// ✅ 好：清晰的用户标识
const depositReference = `user_${userId}`;
const depositReference = `customer_${customerId}_wallet`;

// ❌ 差：难以追踪
const depositReference = `ref_${randomString()}`;
```

### 2. 处理重复绑定

```typescript
async function ensureDepositAddress(userId: string) {
  try {
    const depositRef = await createDepositAddress(userId);
    return depositRef;
  } catch (error) {
    if (error.code === 'DUPLICATE_DEPOSIT_REFERENCE') {
      // Address already exists, fetch it
      return await getDepositAddress(`user_${userId}`);
    }
    throw error;
  }
}
```

### 3. 在用户注册时创建

```typescript
async function registerUser(userData: any) {
  // Create user in your database
  const user = await db.users.create({ data: userData });

  // Immediately create deposit address
  const depositRef = await createDepositAddress(user.id);

  // Save to user record
  await db.users.update({
    where: { id: user.id },
    data: {
      depositAddress: depositRef.address,
      depositChain: depositRef.chainId
    }
  });

  return user;
}
```

### 4. 向用户显示

```typescript
// Show deposit address in user dashboard
function DepositAddressCard({ userId }: { userId: string }) {
  const [depositRef, setDepositRef] = useState(null);

  useEffect(() => {
    getDepositAddress(`user_${userId}`)
      .then(setDepositRef)
      .catch(console.error);
  }, [userId]);

  if (!depositRef) return <div>Loading...</div>;

  return (
    <div>
      <h3>Your Deposit Address</h3>
      <p>Send USDT to this address on any supported chain:</p>
      <code>{depositRef.addresses[0].address}</code>
      <QRCode value={depositRef.addresses[0].address} />

      <p>Supported chains:</p>
      <ul>
        <li>Ethereum (Mainnet & Sepolia)</li>
        <li>Polygon (Mainnet & Amoy)</li>
        <li>Base (Mainnet & Sepolia)</li>
      </ul>
    </div>
  );
}
```

### 5. 使用 Webhooks 更新余额

```typescript
// ❌ 差：轮询充值
setInterval(async () => {
  const deposits = await getDeposits(depositReference);
  // Check for new deposits
}, 10000);

// ✅ 好：Webhook 驱动更新
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'deposit.completed') {
    const { depositReference, amount, currency } = event.data;

    // Update user balance atomically
    await db.users.update({
      where: { depositReference },
      data: {
        balance: { increment: parseFloat(amount) }
      }
    });

    // Notify user
    await notifyUser(depositReference, `Deposit received: ${amount} ${currency}`);
  }

  res.json({ received: true });
});
```

### 6. 处理多次充值

充值地址可以接收多次充值：

```typescript
async function processDeposit(event: DepositConfirmedEvent) {
  const { depositReference, depositId, amount, txHash } = event.data;

  // Check if already processed (idempotency)
  const existing = await db.deposits.findUnique({
    where: { txHash }
  });

  if (existing) {
    console.log('Deposit already processed:', txHash);
    return;
  }

  // Process atomically
  await db.$transaction(async (tx) => {
    // Record deposit
    await tx.deposits.create({
      data: {
        depositId,
        txHash,
        amount,
        depositReference
      }
    });

    // Update balance
    await tx.users.update({
      where: { depositReference },
      data: {
        balance: { increment: parseFloat(amount) }
      }
    });

    // Create transaction log
    await tx.transactions.create({
      data: {
        type: 'deposit',
        amount,
        depositReference,
        txHash
      }
    });
  });

  console.log(`Processed deposit: ${amount} USDT`);
}
```

## 错误响应

### 重复的充值引用（409 Conflict）

```json
{
  "error": "Duplicate deposit reference",
  "message": "Deposit reference 'user_alice_123' already exists for chain 'ethereum-sepolia'",
  "code": "DUPLICATE_DEPOSIT_REFERENCE",
  "statusCode": 409
}
```

**解决方案：** 使用 `GET /deposits/references/:ref` 获取现有地址。

### 无可用地址（503 Service Unavailable）

```json
{
  "error": "No available addresses",
  "message": "Address pool exhausted for protocol 'evm'",
  "code": "NO_AVAILABLE_ADDRESSES",
  "statusCode": 503
}
```

**解决方案：** 向地址池导入更多地址。参见 [地址管理](/zh/guide/address-management)。

### 充值引用未找到（404 Not Found）

```json
{
  "error": "Deposit reference not found",
  "message": "No deposit reference found for 'user_unknown_456'",
  "code": "DEPOSIT_REFERENCE_NOT_FOUND",
  "statusCode": 404
}
```

**解决方案：** 首先使用 `POST /deposits/references` 创建充值引用。

## 下一步

- [了解充值服务 →](/zh/guide/deposit-service)
- [为充值设置 webhooks →](/zh/guide/webhooks)
- [查看充值示例 →](/zh/examples/deposit-flow)
- [理解地址管理 →](/zh/guide/address-management)
