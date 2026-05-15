# API Reference

Complete REST API reference for PayIn multi-chain stablecoin payment infrastructure.

## Base URL

**Production:**
```
https://your-payin.example.com/api/v1
```

**Testnet:**
```
https://your-payin.example.com/api/v1
```

**Local Development:**
```
http://localhost:3000/api/v1
```

::: tip Testnet First
We strongly recommend testing your integration on testnet before going to production. Testnet uses test tokens with no real value.
:::

## Authentication

All API requests require authentication using an API key in the request header:

```http
X-API-Key: your-api-key-here
```

### Generating API Keys

1. Log in to [PayIn Admin Dashboard](https://your-payin.example.com)
2. Navigate to **Settings → API Keys**
3. Click **Create API Key**
4. Give it a descriptive name
5. Copy the key (shown only once!)

### API Key Permissions

| Role | Create Orders | Create Deposits | View Data | Manage Settings |
|------|---------------|-----------------|-----------|-----------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ (except ownership) |
| **Member** | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | ❌ | ❌ | ✅ | ❌ |

::: warning API Key Security
- Never commit API keys to version control
- Rotate keys regularly
- Use different keys for testnet and production
- See [Security Guide](/en/guide/security) for best practices
:::

## Request Format

### Headers

All requests should include:

```http
Content-Type: application/json
X-API-Key: your-api-key-here
```

### Request Body

POST and PUT requests use JSON format:

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia"
}
```

## Response Format

### Success Response

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending",
  "createdAt": "2025-01-20T10:30:00Z",
  "expiresAt": "2025-01-20T10:40:00Z"
}
```

### Error Response

```json
{
  "error": "Invalid amount",
  "message": "Amount must be a positive number",
  "code": "INVALID_AMOUNT",
  "statusCode": 400
}
```

### HTTP Status Codes

| Code | Description | Meaning |
|------|-------------|---------|
| **200** | OK | Request succeeded |
| **201** | Created | Resource created successfully |
| **400** | Bad Request | Invalid request parameters |
| **401** | Unauthorized | Missing or invalid API key |
| **403** | Forbidden | API key lacks required permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource already exists (duplicate) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error (contact support) |

## Rate Limiting

API requests are rate-limited to prevent abuse:

**Default Limits:**
- 100 requests per minute per API key
- 1000 requests per hour per API key
- 10000 requests per day per API key

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642680000
```

When rate limited, you'll receive:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "statusCode": 429,
  "retryAfter": 60
}
```

::: tip Enterprise Plans
Need higher limits? Contact us for enterprise plans with custom rate limits.
:::

## Pagination

List endpoints support pagination:

**Query Parameters:**
```
GET /api/v1/orders?page=1&limit=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**Pagination Parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |

## Filtering & Sorting

Many list endpoints support filtering and sorting:

**Filtering:**
```
GET /api/v1/orders?status=pending&currency=USDT
```

**Sorting:**
```
GET /api/v1/orders?sortBy=createdAt&sortOrder=desc
```

**Common Filters:**

| Endpoint | Supported Filters |
|----------|-------------------|
| Orders | `status`, `currency`, `chainId`, `orderReference` |
| Deposits | `status`, `currency`, `depositReference` |
| Transfers | `status`, `currency`, `chainId`, `txHash` |

**Sort Options:**
- `sortBy`: Field to sort by (`createdAt`, `amount`, etc.)
- `sortOrder`: `asc` or `desc` (default: `desc`)

## Idempotency

POST requests that create resources support idempotency keys to prevent duplicate creation:

```http
Idempotency-Key: unique-key-123
```

**Behavior:**
- Same idempotency key within 24 hours returns the original response
- Different request body with same key returns `409 Conflict`
- Keys expire after 24 hours

**Example:**
```bash
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "Idempotency-Key: order-2025-001-retry-1" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "100.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

## Webhooks

PayIn sends real-time event notifications via webhooks. See [Webhooks Guide](/en/guide/webhooks) for details.

**Event Types:**
- `order.completed` - Order payment received and confirmed
- `order.expired` - Order expired without payment
- `deposit.completed` - Deposit confirmed after required blockchain confirmations
- `deposit.address_bound` - Deposit address assigned to a user
- `deposit.address_unbound` - Deposit address released

**Webhook Configuration:**
```bash
POST /api/v1/webhooks/endpoints
{
  "url": "https://your-api.com/webhooks/payin",
  "events": ["order.completed", "deposit.completed"],
  "secret": "webhook_secret_key"
}
```

## API Endpoints

### 📦 Orders API

Create and manage payment orders.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | [Create order](/en/api/orders) |
| GET | `/orders/:id` | [Get order details](/en/api/orders) |
| GET | `/orders` | [List orders](/en/api/orders) |

### 💰 Deposits API

Manage user deposit addresses and deposits.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deposits/references` | [Bind deposit address](/en/api/deposits) |
| GET | `/deposits/references/:ref` | [Get deposit address](/en/api/deposits) |
| GET | `/deposits/references` | [List deposit references](/en/api/deposits) |
| GET | `/deposits` | [List deposits](/en/api/deposits) |
| DELETE | `/deposits/references/:ref` | [Unbind address](/en/api/deposits) |

### 🔄 Transfers API

Query blockchain transactions.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transfers` | [List transfers](/en/api/transfers) |
| GET | `/transfers/:id` | [Get transfer details](/en/api/transfers) |

### 📬 Webhooks API

Configure webhook endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/endpoints` | [Create endpoint](/en/api/webhooks) |
| GET | `/webhooks/endpoints` | [List endpoints](/en/api/webhooks) |
| PUT | `/webhooks/endpoints/:id` | [Update endpoint](/en/api/webhooks) |
| DELETE | `/webhooks/endpoints/:id` | [Delete endpoint](/en/api/webhooks) |
| GET | `/webhooks/events` | [List events](/en/api/webhooks) |

### 💳 Payment Links API

Create no-code payment links.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payment-links` | [Create link](/en/api/payment-links) |
| GET | `/payment-links` | [List links](/en/api/payment-links) |
| GET | `/payment-links/:id` | [Get link details](/en/api/payment-links) |
| PUT | `/payment-links/:id` | [Update link](/en/api/payment-links) |
| DELETE | `/payment-links/:id` | [Delete link](/en/api/payment-links) |

### 🏦 Address Pool API

Manage address pool (admin only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/address-pool/import` | [Import addresses](/en/api/address-pool) |
| GET | `/address-pool/status` | [Get pool status](/en/api/address-pool) |
| GET | `/address-pool/addresses` | [List addresses](/en/api/address-pool) |

### ⚙️ Configuration API

Manage organization settings (admin only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | [Get all config](/en/api/config) |
| GET | `/config/:key` | [Get config value](/en/api/config) |
| PUT | `/config/:key` | [Update config](/en/api/config) |

### 🔐 Organizations & API Keys

Manage organizations and API keys (admin only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | [List organizations](/en/api/organizations) |
| POST | `/organizations/:id/api-keys` | [Create API key](/en/api/organizations) |
| GET | `/organizations/:id/api-keys` | [List API keys](/en/api/organizations) |
| DELETE | `/api-keys/:keyId` | [Delete API key](/en/api/organizations) |

## Error Handling

### Common Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `INVALID_API_KEY` | 401 | API key is missing or invalid | Check API key is correct |
| `INSUFFICIENT_PERMISSIONS` | 403 | API key lacks required permissions | Use key with appropriate role |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist | Verify ID is correct |
| `DUPLICATE_ORDER_REFERENCE` | 409 | Order reference already exists | Use unique order reference |
| `NO_AVAILABLE_ADDRESSES` | 503 | Address pool exhausted | Import more addresses |
| `INVALID_AMOUNT` | 400 | Amount is invalid or negative | Provide valid positive amount |
| `INVALID_CHAIN` | 400 | Chain ID not supported | Use supported chain ID |
| `INVALID_CURRENCY` | 400 | Currency not supported on chain | Use valid currency for chain |
| `ORDER_EXPIRED` | 400 | Cannot pay expired order | Create new order |
| `ORDER_ALREADY_PAID` | 400 | Order already completed | Check order status |

### Error Response Structure

```typescript
{
  error: string;          // Short error message
  message: string;        // Detailed error description
  code: string;          // Error code for programmatic handling
  statusCode: number;    // HTTP status code
  details?: any;         // Additional error context (optional)
}
```

### Example Error Handling

**TypeScript:**
```typescript
try {
  const response = await fetch('https://your-payin.example.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.PAYIN_API_KEY!
    },
    body: JSON.stringify({
      orderReference: 'ORDER-2025-001',
      amount: '100.00',
      currency: 'USDT',
      chainId: 'ethereum-sepolia'
    })
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.code) {
      case 'DUPLICATE_ORDER_REFERENCE':
        console.log('Order already exists, fetching existing order');
        // Fetch existing order
        break;
      case 'NO_AVAILABLE_ADDRESSES':
        console.error('Address pool exhausted, alerting admin');
        // Send alert to admin
        break;
      default:
        console.error('API Error:', error.message);
        throw new Error(error.message);
    }
  }

  const order = await response.json();
  console.log('Order created:', order);
} catch (error) {
  console.error('Request failed:', error);
}
```

**Python:**
```python
import requests

try:
    response = requests.post(
        'https://your-payin.example.com/api/v1/orders',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': os.getenv('PAYIN_API_KEY')
        },
        json={
            'orderReference': 'ORDER-2025-001',
            'amount': '100.00',
            'currency': 'USDT',
            'chainId': 'ethereum-sepolia'
        }
    )

    response.raise_for_status()
    order = response.json()
    print(f"Order created: {order['orderId']}")

except requests.exceptions.HTTPError as e:
    error = e.response.json()

    if error['code'] == 'DUPLICATE_ORDER_REFERENCE':
        print('Order already exists')
    elif error['code'] == 'NO_AVAILABLE_ADDRESSES':
        print('Address pool exhausted')
    else:
        print(f"API Error: {error['message']}")
```

## Versioning

The PayIn API uses URL versioning:

```
https://your-payin.example.com/api/v1/...
```

**Current Version:** `v1`

**Deprecation Policy:**
- New API versions announced 6 months in advance
- Old versions supported for 12 months after deprecation
- Breaking changes only in new major versions
- Non-breaking changes added to current version

## SDKs & Libraries

Official SDKs:
- **TypeScript/Node.js** 
- **Python** 
- **PHP** 

**Community SDKs:**

## Testing

### Test Mode

Use testnet for testing:
- Base URL: `https://your-payin.example.com/api/v1`
- Free test tokens
- Same API as production
- Safe to experiment

### Test Cards & Addresses

**Testnet Chains:**
- Ethereum Sepolia
- Polygon Amoy
- Tron Nile
- Solana Devnet

**Getting Test Tokens:**
- Sepolia USDT: [Sepolia Faucet](https://sepoliafaucet.com)
- Amoy USDT: [Polygon Faucet](https://faucet.polygon.technology)
- Solana Devnet: Use `solana airdrop`

### Example Test Flow

```bash
# 1. Create order on testnet
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-testnet-key" \
  -d '{
    "orderReference": "TEST-001",
    "amount": "10.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'

# 2. Send test USDT to the payment address

# 3. Check order status
curl https://your-payin.example.com/api/v1/orders/ord_xxx \
  -H "X-API-Key: your-testnet-key"

# 4. Verify webhook received (if configured)
```

## Support & Resources

### Documentation
- [Quick Start Guide](/en/guide/quick-start-mcp)
- [Order Payment Service](/en/guide/order-payment)
- [Deposit Service](/en/guide/deposit-service)
- [Webhooks Guide](/en/guide/webhooks)
- [Security Guide](/en/guide/security)

### API Status
- [Status Page](https://status.payin.com) 
- Check current API availability
- Subscribe to incident notifications

### Getting Help
- **Email**: support@payin.com
- **Documentation**: Browse this site
- **API Issues**: Include request ID from error response

### Rate Limit Increases
For enterprise usage with higher rate limits:
- Email: enterprise@payin.com
- Include: Expected volume, use case, timeline

## Next Steps

- [Create your first order →](/en/api/orders)
- [Set up deposit addresses →](/en/api/deposits)
- [Configure webhooks →](/en/api/webhooks)
- [Explore examples →](/en/examples/order-payment)
