# Deposits API

Manage user deposit addresses and track deposits.

## Overview

The Deposits API allows you to bind permanent deposit addresses to users, query deposit history, and manage deposit references. Unlike orders, deposit addresses are persistent and can receive multiple deposits over time.

**Base Endpoint:** `/api/v1/deposits`

**Authentication:** Required (API Key)

## Bind Deposit Address

Create a permanent deposit address for a user.

**Endpoint:**
```
POST /api/v1/deposits/references
```

**Request Body:**

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

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `depositReference` | string | Yes | Your unique user identifier (max 255 chars) |
| `currency` | string | Yes | Currency code (`USDT`, `USDC`, `DAI`) |
| `chainId` | string | Yes | Blockchain chain ID |
| `metadata` | object | No | Custom metadata (max 10 key-value pairs) |

**Response (201 Created):**

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

**Example (cURL):**

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

**Example (TypeScript):**

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

**Example (Python):**

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

## Get Deposit Reference

Retrieve deposit address information by reference.

**Endpoint:**
```
GET /api/v1/deposits/references/:depositReference
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `depositReference` | string | Your deposit reference (e.g., `user_alice_123`) |

**Response (200 OK):**

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

**Example (cURL):**

```bash
curl https://your-payin.example.com/api/v1/deposits/references/user_alice_123 \
  -H "X-API-Key: your-api-key"
```

**Example (TypeScript):**

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

## List Deposit References

Get a paginated list of all deposit references.

**Endpoint:**
```
GET /api/v1/deposits/references
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max: 100) |
| `search` | string | - | Search by deposit reference |

**Response (200 OK):**

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

**Example (cURL):**

```bash
# List all deposit references
curl "https://your-payin.example.com/api/v1/deposits/references?limit=50" \
  -H "X-API-Key: your-api-key"

# Search for specific user
curl "https://your-payin.example.com/api/v1/deposits/references?search=alice" \
  -H "X-API-Key": your-api-key"
```

## List Deposits

Get deposit transaction history.

**Endpoint:**
```
GET /api/v1/deposits
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max: 100) |
| `depositReference` | string | - | Filter by deposit reference |
| `status` | string | - | Filter by status: `pending`, `confirmed`, `completed` |
| `currency` | string | - | Filter by currency |
| `chainId` | string | - | Filter by chain |
| `sortBy` | string | `detectedAt` | Sort field |
| `sortOrder` | string | `desc` | Sort direction |

**Response (200 OK):**

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

**Example (cURL):**

```bash
# Get all deposits for a user
curl "https://your-payin.example.com/api/v1/deposits?depositReference=user_alice_123" \
  -H "X-API-Key: your-api-key"

# Get pending deposits
curl "https://your-payin.example.com/api/v1/deposits?status=pending" \
  -H "X-API-Key: your-api-key"
```

**Example (TypeScript):**

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

## Unbind Deposit Address

Remove a deposit address binding (optional, permanent addresses).

**Endpoint:**
```
DELETE /api/v1/deposits/references/:depositReference
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `depositReference` | string | Deposit reference to unbind |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chainId` | string | No | Specific chain to unbind (unbinds all if omitted) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Deposit reference unbound",
  "depositReference": "user_alice_123",
  "unboundAddresses": 2
}
```

**Example (cURL):**

```bash
# Unbind all addresses for a deposit reference
curl -X DELETE https://your-payin.example.com/api/v1/deposits/references/user_alice_123 \
  -H "X-API-Key: your-api-key"

# Unbind specific chain only
curl -X DELETE "https://your-payin.example.com/api/v1/deposits/references/user_alice_123?chainId=ethereum-sepolia" \
  -H "X-API-Key: your-api-key"
```

**Example (TypeScript):**

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

::: warning Address Recycling
After unbinding, addresses enter a 30-minute cooldown period before being returned to the pool for reuse.
:::

## Deposit Status Flow

Deposits transition through the following statuses:

```
pending → confirmed → completed
```

**Status Definitions:**

| Status | Description | Terminal |
|--------|-------------|----------|
| `pending` | Deposit detected, awaiting confirmations | No |
| `confirmed` | Required confirmations received | No |
| `completed` | Deposit fully processed | Yes |

::: tip Webhook Events
- `deposit.completed` - Fired after required blockchain confirmations
- `deposit.address_bound` - Fired when deposit address is assigned to a user
- `deposit.address_unbound` - Fired when deposit address is released

See [Webhooks Guide](/en/guide/webhooks) for details.
:::

## Multi-Chain Monitoring

When you bind a deposit address, PayIn automatically monitors **all chains** for that protocol:

**Example:**
```json
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",  // Bind on Sepolia
  // ...
}
```

**Automatic Monitoring:**
- ✅ Ethereum Sepolia (specified)
- ✅ Ethereum Mainnet (same protocol)
- ✅ Polygon Amoy (same protocol)
- ✅ Polygon Mainnet (same protocol)
- ✅ Base Sepolia (same protocol)
- ✅ Base Mainnet (same protocol)

Any USDT deposit to the address on **any EVM chain** will be detected and recorded.

::: tip Protocol Families
- **EVM**: Ethereum, Polygon, Base, etc.
- **Tron**: Tron Mainnet, Tron Nile
- **Solana**: Solana Mainnet, Solana Devnet
:::

## Metadata

Store custom data with deposit references:

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

**Use Cases:**
- Link to your user system
- Store user information
- Track account details
- Add internal notes

## Best Practices

### 1. Use Descriptive References

```typescript
// ✅ GOOD: Clear user identification
const depositReference = `user_${userId}`;
const depositReference = `customer_${customerId}_wallet`;

// ❌ BAD: Hard to track
const depositReference = `ref_${randomString()}`;
```

### 2. Handle Duplicate Bindings

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

### 3. Create on User Registration

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

### 4. Display to Users

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

### 5. Use Webhooks for Balance Updates

```typescript
// ❌ BAD: Polling for deposits
setInterval(async () => {
  const deposits = await getDeposits(depositReference);
  // Check for new deposits
}, 10000);

// ✅ GOOD: Webhook-driven updates
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

### 6. Handle Multiple Deposits

Deposit addresses can receive multiple deposits:

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

## Error Responses

### Duplicate Deposit Reference (409 Conflict)

```json
{
  "error": "Duplicate deposit reference",
  "message": "Deposit reference 'user_alice_123' already exists for chain 'ethereum-sepolia'",
  "code": "DUPLICATE_DEPOSIT_REFERENCE",
  "statusCode": 409
}
```

**Solution:** Use `GET /deposits/references/:ref` to fetch the existing address.

### No Available Addresses (503 Service Unavailable)

```json
{
  "error": "No available addresses",
  "message": "Address pool exhausted for protocol 'evm'",
  "code": "NO_AVAILABLE_ADDRESSES",
  "statusCode": 503
}
```

**Solution:** Import more addresses to the pool. See [Address Management](/en/guide/address-management).

### Deposit Reference Not Found (404 Not Found)

```json
{
  "error": "Deposit reference not found",
  "message": "No deposit reference found for 'user_unknown_456'",
  "code": "DEPOSIT_REFERENCE_NOT_FOUND",
  "statusCode": 404
}
```

**Solution:** Create the deposit reference first using `POST /deposits/references`.

## Next Steps

- [Learn about deposit service →](/en/guide/deposit-service)
- [Set up webhooks for deposits →](/en/guide/webhooks)
- [View deposit examples →](/en/examples/deposit-flow)
- [Understand address management →](/en/guide/address-management)
