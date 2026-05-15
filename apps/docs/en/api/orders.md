# Orders API

Create and manage one-time payment orders.

## Overview

The Orders API allows you to create payment orders with temporary addresses, query order status, and list all orders. Each order is assigned a unique payment address that expires after a configurable payment window.

**Base Endpoint:** `/api/v1/orders`

**Authentication:** Required (API Key)

## Create Order

Create a new payment order with a temporary payment address.

**Endpoint:**
```
POST /api/v1/orders
```

**Request Body:**

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "productSku": "PROD-123"
  },
  "successUrl": "https://yoursite.com/order/success",
  "cancelUrl": "https://yoursite.com/order/cancel"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderReference` | string | Yes | Your unique order identifier (max 255 chars) |
| `amount` | string | Yes | Payment amount (decimal string, e.g. "100.00") |
| `currency` | string | Yes | Currency code (`USDT`, `USDC`, `DAI`) |
| `chainId` | string | Yes | Blockchain chain ID (see [Supported Networks](/en/guide/supported-networks)) |
| `metadata` | object | No | Custom metadata (max 10 key-value pairs) |
| `successUrl` | string | No | Redirect URL after successful payment |
| `cancelUrl` | string | No | Redirect URL after order expiration |

**Response (201 Created):**

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "protocol": "evm",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "productSku": "PROD-123"
  },
  "successUrl": "https://yoursite.com/order/success",
  "cancelUrl": "https://yoursite.com/order/cancel",
  "createdAt": "2025-01-20T10:30:00.000Z",
  "expiresAt": "2025-01-20T10:40:00.000Z"
}
```

**Example (cURL):**

```bash
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "100.00",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

**Example (TypeScript):**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.PAYIN_API_KEY!
  },
  body: JSON.stringify({
    orderReference: `ORDER-${Date.now()}`,
    amount: '100.00',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    metadata: {
      userId: 'user_123',
      productId: 'prod_456'
    },
    successUrl: 'https://yoursite.com/payment/success',
    cancelUrl: 'https://yoursite.com/payment/cancel'
  })
});

const order = await response.json();
console.log('Order created:', order.orderId);
console.log('Payment address:', order.address);
```

**Example (Python):**

```python
import requests
import time

response = requests.post(
    'https://your-payin.example.com/api/v1/orders',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': os.getenv('PAYIN_API_KEY')
    },
    json={
        'orderReference': f'ORDER-{int(time.time())}',
        'amount': '100.00',
        'currency': 'USDT',
        'chainId': 'ethereum-sepolia',
        'metadata': {
            'userId': 'user_123',
            'productId': 'prod_456'
        }
    }
)

order = response.json()
print(f"Order ID: {order['orderId']}")
print(f"Payment address: {order['address']}")
```

## Get Order

Retrieve details of a specific order.

**Endpoint:**
```
GET /api/v1/orders/:orderId
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderId` | string | Order ID (e.g., `ord_abc123def456`) |

**Response (200 OK):**

```json
{
  "orderId": "ord_abc123def456",
  "orderReference": "ORDER-2025-001",
  "amount": "100.00",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "protocol": "evm",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "completed",
  "metadata": {
    "customerName": "John Doe"
  },
  "successUrl": "https://yoursite.com/order/success",
  "createdAt": "2025-01-20T10:30:00.000Z",
  "expiresAt": "2025-01-20T10:40:00.000Z",
  "completedAt": "2025-01-20T10:35:22.000Z",
  "txHash": "0xabc123...",
  "blockNumber": 1234567,
  "confirmations": 12
}
```

**Example (cURL):**

```bash
curl https://your-payin.example.com/api/v1/orders/ord_abc123def456 \
  -H "X-API-Key: your-api-key"
```

**Example (TypeScript):**

```typescript
const response = await fetch(
  `https://your-payin.example.com/api/v1/orders/${orderId}`,
  {
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY!
    }
  }
);

const order = await response.json();
console.log('Order status:', order.status);

if (order.status === 'completed') {
  console.log('Payment confirmed!');
  console.log('Transaction:', order.txHash);
}
```

## Get Order by Reference

Retrieve order using your own order reference.

**Endpoint:**
```
GET /api/v1/orders/by-reference/:orderReference
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderReference` | string | Your order reference |

**Response:** Same as "Get Order"

**Example:**

```bash
curl https://your-payin.example.com/api/v1/orders/by-reference/ORDER-2025-001 \
  -H "X-API-Key: your-api-key"
```

## List Orders

Get a paginated list of all orders.

**Endpoint:**
```
GET /api/v1/orders
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max: 100) |
| `status` | string | - | Filter by status: `pending`, `completed`, `expired` |
| `currency` | string | - | Filter by currency: `USDT`, `USDC`, `DAI` |
| `chainId` | string | - | Filter by chain |
| `orderReference` | string | - | Search by order reference |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | Sort direction: `asc`, `desc` |

**Response (200 OK):**

```json
{
  "data": [
    {
      "orderId": "ord_abc123def456",
      "orderReference": "ORDER-2025-001",
      "amount": "100.00",
      "currency": "USDT",
      "chainId": "ethereum-sepolia",
      "address": "0x742d35...",
      "status": "completed",
      "createdAt": "2025-01-20T10:30:00.000Z",
      "completedAt": "2025-01-20T10:35:22.000Z"
    },
    // ... more orders
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**Example (cURL):**

```bash
# Get pending orders
curl "https://your-payin.example.com/api/v1/orders?status=pending&limit=10" \
  -H "X-API-Key: your-api-key"

# Get USDT orders sorted by amount
curl "https://your-payin.example.com/api/v1/orders?currency=USDT&sortBy=amount&sortOrder=desc" \
  -H "X-API-Key: your-api-key"
```

**Example (TypeScript):**

```typescript
// Get all pending orders
const response = await fetch(
  'https://your-payin.example.com/api/v1/orders?status=pending',
  {
    headers: {
      'X-API-Key': process.env.PAYIN_API_KEY!
    }
  }
);

const { data: orders, pagination } = await response.json();

console.log(`Found ${pagination.total} pending orders`);
orders.forEach(order => {
  console.log(`${order.orderReference}: ${order.amount} ${order.currency}`);
});
```

## Order Status Flow

Orders transition through the following statuses:

```
pending → completed (payment received and confirmed)
pending → expired (payment window expired without payment)
```

**Status Definitions:**

| Status | Description | Terminal |
|--------|-------------|----------|
| `pending` | Order created, awaiting payment | No |
| `completed` | Payment received and confirmed | Yes |
| `expired` | Payment window expired without valid payment | Yes |

::: tip Webhook Events
- `order.completed` - Fired when order receives confirmed payment
- `order.expired` - Fired when order expires without payment

See [Webhooks Guide](/en/guide/webhooks) for details.
:::

## Payment Window

Orders have a configurable payment window (default: 10 minutes):

**Timeline:**
```
Order Created → Payment Window (10 min) → Grace Period (5 min) → Expiration
     ↓                                                                  ↓
  pending                                                           expired
```

- **Payment Window**: User should send payment within this time
- **Grace Period**: Extra time for transaction confirmation
- **After Expiration**: Order cannot be paid, create a new order

**Configuration:**
```bash
# Set payment window to 15 minutes
PUT /api/v1/config/payment_window_minutes
{
  "value": 15
}
```

## Metadata

Store custom data with orders (max 10 key-value pairs):

```json
{
  "metadata": {
    "userId": "user_123",
    "productId": "prod_456",
    "productName": "Premium Subscription",
    "customerEmail": "user@example.com",
    "internalNotes": "VIP customer"
  }
}
```

**Use Cases:**
- Link order to your internal systems
- Store customer information
- Track product details
- Add internal notes

::: warning Metadata Privacy
Metadata is returned in API responses and webhooks. Don't store sensitive information like passwords or full credit card numbers.
:::

## Redirect URLs

Configure where to send users after payment:

```json
{
  "successUrl": "https://yoursite.com/order/success?orderId={{orderId}}",
  "cancelUrl": "https://yoursite.com/order/cancel?orderId={{orderId}}"
}
```

**URL Parameters Added:**
- `orderReference` - Your order reference
- `status` - Order status
- `amount` - Payment amount
- `currency` - Payment currency
- `chainId` - Blockchain chain
- `txHash` - Transaction hash (on success)

**Example Redirect:**
```
https://yoursite.com/order/success
  ?orderReference=ORDER-2025-001
  &status=completed
  &amount=100.00
  &currency=USDT
  &chainId=ethereum-sepolia
  &txHash=0xabc123...
```

**Fallback to Global Config:**
If not specified, uses global defaults:
- `default_order_success_url`
- `default_order_cancel_url`

## Error Responses

### Duplicate Order Reference (409 Conflict)

```json
{
  "error": "Duplicate order reference",
  "message": "Order with reference 'ORDER-2025-001' already exists",
  "code": "DUPLICATE_ORDER_REFERENCE",
  "statusCode": 409,
  "existingOrderId": "ord_abc123"
}
```

**Solution:** Use a unique order reference or fetch the existing order.

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

### Invalid Amount (400 Bad Request)

```json
{
  "error": "Invalid amount",
  "message": "Amount must be a positive number",
  "code": "INVALID_AMOUNT",
  "statusCode": 400
}
```

**Solution:** Provide a valid positive decimal string (e.g., "100.00").

### Invalid Chain (400 Bad Request)

```json
{
  "error": "Invalid chain",
  "message": "Chain 'invalid-chain' is not supported",
  "code": "INVALID_CHAIN",
  "statusCode": 400
}
```

**Solution:** Use a valid chain ID from [Supported Networks](/en/guide/supported-networks).

## Best Practices

### 1. Use Unique Order References

```typescript
// ✅ GOOD: Timestamp-based reference
const orderReference = `ORDER-${Date.now()}-${userId}`;

// ✅ GOOD: UUID-based reference
import { v4 as uuidv4 } from 'uuid';
const orderReference = `ORDER-${uuidv4()}`;

// ❌ BAD: Sequential numbers (can collide)
const orderReference = `ORDER-${orderCount}`;
```

### 2. Handle Errors Gracefully

```typescript
try {
  const response = await createOrder(orderData);
  return response;
} catch (error) {
  if (error.code === 'DUPLICATE_ORDER_REFERENCE') {
    // Fetch existing order instead
    return await getOrderByReference(orderData.orderReference);
  }
  throw error;
}
```

### 3. Store Order ID

```typescript
// Save PayIn order ID to your database
await db.orders.update({
  where: { id: yourOrderId },
  data: {
    payinOrderId: order.orderId,
    paymentAddress: order.address,
    paymentStatus: 'pending'
  }
});
```

### 4. Use Webhooks

Don't poll for order status. Use webhooks instead:

```typescript
// ❌ BAD: Polling
setInterval(async () => {
  const order = await getOrder(orderId);
  if (order.status === 'completed') {
    // Handle completion
  }
}, 5000);

// ✅ GOOD: Webhook
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'order.completed') {
    await handleOrderCompletion(event.data);
  }

  res.json({ received: true });
});
```

### 5. Set Appropriate Payment Windows

```typescript
// Short-lived items (checkout)
const order = await createOrder({
  ...orderData,
  // Use global config (10 min default)
});

// High-value items (consider longer window)
// Configure globally via config API
```

## Next Steps

- [Set up webhooks →](/en/guide/webhooks)
- [Learn about deposits →](/en/api/deposits)
- [View integration examples →](/en/examples/order-payment)
- [Read security best practices →](/en/guide/security)
