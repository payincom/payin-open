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

PayIn Open is headless by default. Create the first operator during your self-hosted setup, then create business API keys through the Open operator API, your deployment's CLI wrapper, or a self-hosted console if you install one.

Operator API flow:

```bash
curl -X POST https://your-payin.example.com/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <operator-jwt>" \
  -H "X-Organization-Id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "name": "checkout-service",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

Copy the returned key immediately; secret values are shown only once. After switching to the business API key, send `X-API-Key` and do not send `X-Organization-Id`.

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
POST /api/v1/notifications/endpoints
{
  "endpoint_name": "checkout-webhook",
  "endpoint_type": "webhook",
  "config": {
    "url": "https://your-api.com/webhooks/payin",
    "secret": "webhook_secret_key"
  },
  "subscribed_events": ["order.completed", "deposit.completed"]
}
```

The compatibility alias `/api/v1/notifications/webhooks` maps to the same webhook endpoint records when you need webhook-named paths.

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
| GET | `/transfers` | List transfers with filters |
| GET | `/transfers/by-reference` | List transfers for an order or deposit reference |

### 📬 Notifications API

Configure webhook notification endpoints. See [Webhooks Guide](/en/guide/webhooks).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/notifications/endpoints` | Create endpoint |
| GET | `/notifications/endpoints` | List endpoints |
| GET | `/notifications/endpoints/:id` | Get endpoint details |
| PUT | `/notifications/endpoints/:id` | Update endpoint |
| DELETE | `/notifications/endpoints/:id` | Delete endpoint |
| POST | `/notifications/endpoints/:id/test` | Send test delivery |

### 💳 Payment Links

No-code Payment Links are a hosted PayIn Cloud feature and are not advertised as part of the PayIn Open public API. In PayIn Open, create hosted checkout flows with the Orders API.

### 🏦 Address Pool API

Manage the self-hosted address pool. See [Address Pool Setup](/en/guide/address-pool-setup).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/address-pool/availability` | Get pool availability |
| GET | `/address-pool/summary` | Get pool summary |
| GET | `/address-pool/addresses` | List addresses |
| POST | `/address-pool/addresses` | Add addresses |
| PATCH | `/address-pool/addresses/:address/archive` | Archive address |
| PATCH | `/address-pool/addresses/:address/unarchive` | Unarchive address |

### 🔐 Operator API Keys

Create and manage API keys for the self-hosted Open business scope.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api-keys` | Create API key |
| GET | `/api-keys` | List API keys |
| GET | `/api-keys/:id` | Get API key details |
| PUT | `/api-keys/:id` | Update API key |
| DELETE | `/api-keys/:id` | Revoke API key |

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
- [Configure webhooks →](/en/guide/webhooks)
- [Explore examples →](/en/examples/order-payment)
