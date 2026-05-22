# API Integration

This guide covers direct integration with PayIn's REST API for production applications. If you're just exploring PayIn, we recommend starting with [Quick Start with MCP](/en/guide/quick-start-mcp) instead.

## When to Use Direct API

Choose the integration method that best fits your needs:

| Method | Best For | Complexity | Setup Time |
|--------|----------|------------|------------|
| **Direct API** | Production applications, custom integrations, multiple languages | Medium | 30-60 min |
| **MCP Server** | Prototyping, AI-assisted development, learning | Low | 5-10 min |
| **Payment Links** | One-off payments, no-code scenarios, invoices | Very Low | 2 min |

**Use Direct API when you need:**
- Production-ready integration with full control
- Integration in languages beyond Node.js
- Custom business logic and workflows
- High transaction volume
- Advanced error handling and retry logic

## API Basics

### Base URLs

PayIn provides separate environments for testing and production:

| Environment | Base URL | Purpose |
|------------|----------|---------|
| **Testnet** | `https://your-payin.example.com/api/v1` | Testing with test cryptocurrencies (free) |
| **Mainnet** | `https://your-payin.example.com/api/v1` | Production with real cryptocurrencies |

::: tip Always Test First
Start with testnet to familiarize yourself with PayIn before handling real transactions. See [Testnet vs Mainnet](/en/guide/testnet-vs-mainnet).
:::

### Authentication

All API requests require authentication using an API key created by your PayIn Open operator flow.

#### Getting Your API Key

1. Register the first local operator after `open:init`.
2. Create an API key through the Open API or operator automation.
3. Use a descriptive name such as `production-server-key`.
4. Copy the generated key (format: `pk_xxxxxxxxxxxxx`).

::: warning Save Your API Key
API keys are only shown once during creation. Store it securely - you cannot retrieve it later.
:::

#### Using API Keys

Include your API key in the `Authorization` header using Bearer authentication:

```http
Authorization: Bearer pk_your_api_key_here
```

**Security Requirements:**
- ✅ Always use HTTPS (never HTTP)
- ✅ Store API keys in environment variables
- ✅ Never commit API keys to version control
- ✅ Rotate keys periodically
- ❌ Never expose keys in client-side code

### Request Format

All API requests must:
- Use **HTTPS** protocol
- Include **Content-Type: application/json** header for POST/PUT requests
- Include **Authorization** header with valid API key
- Send request body as JSON for data operations

**Standard Request Headers:**

```http
POST /api/v1/orders HTTP/1.1
Host: your-payin.example.com
Authorization: Bearer pk_xxxxxxxxxxxxx
Content-Type: application/json
```

### Response Format

All API responses return JSON with a consistent structure:

**Success Response (2xx):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Order created successfully"
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Required fields: amount, currency, chainId"
}
```

## Common Integration Patterns

### Pattern 1: Order Payment Flow

Create a temporary payment address for a one-time transaction.

<details>
<summary><strong>Example: E-Commerce Checkout</strong></summary>

**Step 1: Create Order**

When user proceeds to checkout:

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderReference: `order_${Date.now()}`,
    amount: '49.99',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    successUrl: 'https://yourstore.com/order/success',
    cancelUrl: 'https://yourstore.com/order/cancelled',
    metadata: {
      cartId: 'cart_12345',
      itemCount: 3
    }
  })
});

const result = await response.json();

if (result.success) {
  // Show payment page to customer
  window.location.href = result.data.paymentUrl;
}
```

**Step 2: Handle Webhook Notification**

When payment is confirmed:

```typescript
// Webhook endpoint: POST /webhooks/payin
app.post('/webhooks/payin', async (req, res) => {
  // Verify webhook signature (see Webhooks guide)
  const signature = req.headers['x-payin-signature'];
  const isValid = verifySignature(req.body, signature);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.type === 'order.completed') {
    const { orderReference, amount, currency, txHash } = event.data;

    // Update order status in your database
    await db.orders.update({
      where: { reference: orderReference },
      data: {
        status: 'paid',
        transactionHash: txHash,
        paidAt: new Date()
      }
    });

    // Fulfill the order (ship products, grant access, etc.)
    await fulfillOrder(orderReference);
  }

  res.json({ received: true });
});
```

**Step 3: Query Order Status** (Optional)

Check order status programmatically:

```typescript
const orderId = 'ord_abcdef123456';
const response = await fetch(
  `https://your-payin.example.com/api/v1/orders/${orderId}`,
  {
    headers: {
      'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
    }
  }
);

const result = await response.json();
console.log('Order Status:', result.data.status); // pending, completed, expired
```

</details>

### Pattern 2: Deposit Address Flow

Bind a permanent address to a user for recurring deposits.

<details>
<summary><strong>Example: Gaming Wallet System</strong></summary>

**Step 1: Bind Deposit Address**

When user creates wallet:

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    depositReference: `player_${userId}`,
    protocol: 'evm',  // Single address for all EVM chains
    metadata: {
      playerId: userId,
      playerName: 'john_doe'
    }
  })
});

const result = await response.json();

if (result.success) {
  // Save deposit address to user profile
  await db.users.update({
    where: { id: userId },
    data: {
      depositAddress: result.data.address,
      protocol: 'evm'
    }
  });

  // Show address to player
  console.log('Deposit Address:', result.data.address);
  console.log('Supported Chains:', result.data.monitoredChains);
}
```

**Step 2: Handle Deposit Webhook**

When player deposits funds:

```typescript
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'deposit.completed') {
    const { depositReference, amount, currency, chainId, txHash } = event.data;

    // Extract player ID
    const playerId = depositReference.replace('player_', '');

    // Add funds to player balance (idempotent operation)
    await db.$transaction(async (tx) => {
      // Check if deposit already processed
      const existing = await tx.deposits.findUnique({
        where: { txHash }
      });

      if (!existing) {
        // Record deposit
        await tx.deposits.create({
          data: {
            playerId,
            amount,
            currency,
            chainId,
            txHash,
            status: 'confirmed'
          }
        });

        // Update balance atomically
        await tx.users.update({
          where: { id: playerId },
          data: {
            balance: {
              increment: parseFloat(amount)
            }
          }
        });

        // Notify player
        await notifyPlayer(playerId, 'Deposit confirmed', amount, currency);
      }
    });
  }

  res.json({ received: true });
});
```

**Step 3: Query Deposit History**

View all deposits for a user:

```typescript
const depositReference = `player_${userId}`;
const response = await fetch(
  `https://your-payin.example.com/api/v1/deposits?depositReference=${depositReference}`,
  {
    headers: {
      'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
    }
  }
);

const result = await response.json();
console.log('Deposits:', result.data.deposits);
```

</details>

### Pattern 3: Payment Link Flow

Create shareable payment URLs for no-code payment collection.

<details>
<summary><strong>Example: Invoice Generator</strong></summary>

**Create Payment Link:**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Web Design Services - Invoice #2025-001',
    description: 'Logo design + 5 landing pages',
    amount: '2500',
    currencies: [
      { currency: 'USDT', chainId: 'ethereum-sepolia' },
      { currency: 'USDC', chainId: 'polygon-amoy' }
    ],
    metadata: {
      invoiceNumber: 'INV-2025-001',
      clientId: 'client_456',
      services: ['logo_design', 'landing_pages']
    }
  })
});

const result = await response.json();

if (result.success) {
  // Send payment link to client via email
  const paymentUrl = `https://your-payin.example.com/checkout/${result.data.slug}`;
  await sendEmail({
    to: client.email,
    subject: 'Invoice #2025-001',
    body: `Please pay your invoice: ${paymentUrl}`
  });
}
```

</details>

## API Reference

### Authentication Endpoints

#### Health Check

Check API availability:

```bash
curl https://your-payin.example.com/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-28T10:30:00Z",
  "version": "0.1.0"
}
```

### Order Endpoints

#### Create Order

`POST /api/v1/orders`

**Request Body:**
```typescript
{
  orderReference: string;      // Your unique order ID
  amount: string;              // Amount in token units (e.g., "10.50")
  currency: string;            // Token symbol (USDT, USDC, DAI)
  chainId: string;             // Chain identifier (ethereum-sepolia, polygon-amoy)
  successUrl?: string;         // Redirect URL after payment
  cancelUrl?: string;          // Redirect URL if expired
  paymentWindowMinutes?: number;  // Payment timeout (default: 10)
  graceMinutes?: number;       // Grace period (default: 5)
  metadata?: Record<string, any>;  // Custom data
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    orderId: string;           // PayIn order ID
    orderReference: string;    // Your order reference
    status: 'pending',
    amount: string,
    currency: string,
    chainId: string,
    address: string,           // Payment address
    paymentUrl: string,        // Hosted payment page
    expiresAt: string,         // ISO 8601 timestamp
    createdAt: string
  }
}
```

#### Get Order

`GET /api/v1/orders/:orderId`

**Response:**
```typescript
{
  success: true,
  data: {
    orderId: string,
    orderReference: string,
    status: 'pending' | 'completed' | 'expired',
    amount: string,
    currency: string,
    chainId: string,
    address: string,
    txHash?: string,           // Transaction hash (if completed)
    completedAt?: string,      // Completion timestamp
    createdAt: string
  }
}
```

#### List Orders

`GET /api/v1/orders`

**Query Parameters:**
- `status` - Filter by status (pending, completed, expired)
- `chainId` - Filter by chain
- `currency` - Filter by currency
- `orderReference` - Search by order reference
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

**Response:**
```typescript
{
  success: true,
  data: {
    orders: Order[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
  }
}
```

### Deposit Endpoints

#### Bind Address

`POST /api/v1/deposits/bind`

**Request Body:**
```typescript
{
  depositReference: string;    // Unique user identifier
  protocol: 'evm' | 'tron';   // Protocol family
  metadata?: Record<string, any>;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    depositReference: string,
    address: string,           // Deposit address
    protocol: string,
    monitoredChains: string[], // All monitored chains
    createdAt: string
  }
}
```

#### Unbind Address

`POST /api/v1/deposits/unbind`

**Request Body:**
```typescript
{
  depositReference: string;
}
```

#### Get Deposit Reference

`GET /api/v1/deposits/references/:depositReference`

**Response:**
```typescript
{
  success: true,
  data: {
    depositReference: string,
    address: string,
    protocol: string,
    totalDeposits: number,
    totalAmount: string,
    boundAt: string
  }
}
```

#### List Deposits

`GET /api/v1/deposits`

**Query Parameters:**
- `depositReference` - Filter by deposit reference
- `status` - Filter by status (pending, confirmed, completed)
- `chainId` - Filter by chain
- `currency` - Filter by currency
- `page`, `limit` - Pagination

**Response:**
```typescript
{
  success: true,
  data: {
    deposits: Deposit[],
    pagination: { ... }
  }
}
```

### Payment Link Endpoints

#### Create Payment Link

`POST /api/v1/payment-links`

**Request Body:**
```typescript
{
  title: string;               // Payment link title
  description?: string;        // Optional description
  amount: string;              // Amount ("0" for custom)
  currencies: Array<{          // Supported currencies
    currency: string,
    chainId: string
  }>,
  inventoryTotal?: number;     // Stock limit (optional)
  expiresAt?: string;          // Expiration date (optional)
  metadata?: Record<string, any>;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string,
    slug: string,              // URL slug
    title: string,
    amount: string,
    status: 'draft',
    checkoutUrl: string,       // Public payment URL
    createdAt: string
  }
}
```

#### Publish Payment Link

`POST /api/v1/payment-links/:id/publish`

Makes the payment link publicly accessible.

#### Archive Payment Link

`POST /api/v1/payment-links/:id/archive`

Removes the payment link from active status.

## Code Examples

### TypeScript / Node.js

Complete integration example using native fetch:

```typescript
import crypto from 'crypto';

class PayInClient {
  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://your-payin.example.com/api/v1'
  ) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data.data;
  }

  // Create order
  async createOrder(params: {
    orderReference: string;
    amount: string;
    currency: string;
    chainId: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Get order status
  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  // Bind deposit address
  async bindAddress(params: {
    depositReference: string;
    protocol: 'evm' | 'tron';
    metadata?: Record<string, any>;
  }) {
    return this.request('/deposits/bind', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Verify webhook signature
  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// Usage
const payin = new PayInClient(process.env.PAYIN_API_KEY!);

// Create order
const order = await payin.createOrder({
  orderReference: 'order_123',
  amount: '100',
  currency: 'USDT',
  chainId: 'ethereum-sepolia',
});

console.log('Payment URL:', order.paymentUrl);
```

### Python

Using `requests` library:

```python
import requests
import hmac
import hashlib
from typing import Dict, Any

class PayInClient:
    def __init__(self, api_key: str, base_url: str = 'https://your-payin.example.com/api/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def create_order(self, order_reference: str, amount: str,
                     currency: str, chain_id: str, **kwargs) -> Dict[str, Any]:
        """Create a new payment order"""
        payload = {
            'orderReference': order_reference,
            'amount': amount,
            'currency': currency,
            'chainId': chain_id,
            **kwargs
        }

        response = self.session.post(
            f'{self.base_url}/orders',
            json=payload
        )
        response.raise_for_status()
        return response.json()['data']

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get order details"""
        response = self.session.get(f'{self.base_url}/orders/{order_id}')
        response.raise_for_status()
        return response.json()['data']

    def bind_address(self, deposit_reference: str,
                     protocol: str, **kwargs) -> Dict[str, Any]:
        """Bind a deposit address to a user"""
        payload = {
            'depositReference': deposit_reference,
            'protocol': protocol,
            **kwargs
        }

        response = self.session.post(
            f'{self.base_url}/deposits/bind',
            json=payload
        )
        response.raise_for_status()
        return response.json()['data']

    @staticmethod
    def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        expected_signature = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected_signature)

# Usage
payin = PayInClient(api_key=os.environ['PAYIN_API_KEY'])

# Create order
order = payin.create_order(
    order_reference='order_123',
    amount='100',
    currency='USDT',
    chain_id='ethereum-sepolia'
)

print(f"Payment URL: {order['paymentUrl']}")
```

### PHP

Using cURL:

```php
<?php

class PayInClient {
    private $apiKey;
    private $baseUrl;

    public function __construct($apiKey, $baseUrl = 'https://your-payin.example.com/api/v1') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }

    private function request($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json'
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception('API request failed: ' . $response);
        }

        $result = json_decode($response, true);
        return $result['data'];
    }

    public function createOrder($params) {
        return $this->request('POST', '/orders', $params);
    }

    public function getOrder($orderId) {
        return $this->request('GET', "/orders/$orderId");
    }

    public function bindAddress($params) {
        return $this->request('POST', '/deposits/bind', $params);
    }

    public function verifyWebhook($payload, $signature, $secret) {
        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        return hash_equals($signature, $expectedSignature);
    }
}

// Usage
$payin = new PayInClient($_ENV['PAYIN_API_KEY']);

// Create order
$order = $payin->createOrder([
    'orderReference' => 'order_123',
    'amount' => '100',
    'currency' => 'USDT',
    'chainId' => 'ethereum-sepolia'
]);

echo "Payment URL: " . $order['paymentUrl'];
```

### cURL (Testing)

Quick command-line testing:

```bash
# Create order
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Authorization: Bearer pk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "order_123",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'

# Get order status
curl -X GET https://your-payin.example.com/api/v1/orders/ord_abc123 \
  -H "Authorization: Bearer pk_your_api_key"

# Bind deposit address
curl -X POST https://your-payin.example.com/api/v1/deposits/bind \
  -H "Authorization: Bearer pk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "depositReference": "user_456",
    "protocol": "evm"
  }'
```

## Error Handling

### HTTP Status Codes

PayIn uses standard HTTP status codes:

| Code | Meaning | Common Causes |
|------|---------|---------------|
| **200** | Success | Request completed successfully |
| **201** | Created | Resource created successfully |
| **400** | Bad Request | Invalid request parameters |
| **401** | Unauthorized | Invalid or missing API key |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource does not exist |
| **429** | Too Many Requests | Rate limit exceeded (future) |
| **500** | Internal Server Error | Server-side error |
| **503** | Service Unavailable | Temporary service disruption |

### Common Error Types

#### ValidationError

Invalid request parameters:

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Required fields: amount, currency, chainId"
}
```

**Fix:** Ensure all required fields are present and valid.

#### AuthenticationError

Invalid API key:

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

**Fix:** Check your API key is correct and active.

#### ResourceNotFoundError

Resource doesn't exist:

```json
{
  "success": false,
  "error": "NotFound",
  "message": "Order not found"
}
```

**Fix:** Verify the resource ID is correct.

#### InsufficientAddressesError

No available addresses in pool:

```json
{
  "success": false,
  "error": "InsufficientAddresses",
  "message": "No available addresses in pool for protocol: evm"
}
```

**Fix:** Import more addresses to your address pool. See [Address Pool Setup](/en/guide/address-pool-setup).

### Error Handling Best Practices

**1. Always Handle Errors**

```typescript
try {
  const order = await payin.createOrder({ ... });
  // Success logic
} catch (error) {
  if (error.message.includes('InsufficientAddresses')) {
    // Alert admin to import more addresses
    await alertAdmin('Address pool depleted');
  } else if (error.message.includes('Unauthorized')) {
    // API key issue
    await rotateApiKey();
  } else {
    // Log unexpected errors
    console.error('Order creation failed:', error);
  }
}
```

**2. Implement Retry Logic**

Use exponential backoff for transient errors:

```typescript
async function createOrderWithRetry(params: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await payin.createOrder(params);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable =
        error.message.includes('500') ||
        error.message.includes('503');

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**3. Log All API Interactions**

```typescript
class LoggingPayInClient extends PayInClient {
  async createOrder(params: any) {
    const startTime = Date.now();

    try {
      const result = await super.createOrder(params);

      logger.info('Order created', {
        orderReference: params.orderReference,
        orderId: result.orderId,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Order creation failed', {
        orderReference: params.orderReference,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }
}
```

## Webhook Integration

Webhooks are the recommended way to receive real-time payment notifications.

### Setting Up Webhooks

Register delivery endpoints through `POST /api/v1/notifications/endpoints` with `endpoint_type: "webhook"`, your HTTPS URL, webhook secret, and subscribed events. Manage them through `GET/PUT/DELETE /api/v1/notifications/endpoints/:id` and test delivery with `POST /api/v1/notifications/endpoints/:id/test`. The documented compatibility alias `/api/v1/notifications/webhooks` maps to the same endpoint records.

### Event Types

| Event | Description | When Fired |
|-------|-------------|------------|
| `order.completed` | Order payment confirmed | After required confirmations |
| `order.expired` | Order payment window expired | After grace period |
| `deposit.completed` | Deposit confirmed | After required blockchain confirmations |
| `deposit.address_bound` | Address assigned | When deposit address is bound to user |
| `deposit.address_unbound` | Address released | When deposit address is unbound |

### Webhook Payload

All webhooks follow this format:

```json
{
  "id": "evt_abc123",
  "type": "order.completed",
  "createdAt": "2025-01-28T10:30:00Z",
  "data": {
    "orderId": "ord_xyz789",
    "orderReference": "order_123",
    "status": "completed",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "txHash": "0xabc...",
    "completedAt": "2025-01-28T10:29:45Z"
  }
}
```

### Signature Verification

**Always verify webhook signatures** to prevent unauthorized requests:

```typescript
import crypto from 'crypto';

app.post('/webhooks/payin', async (req, res) => {
  // 1. Get signature from headers
  const signature = req.headers['x-payin-signature'];
  const secret = process.env.PAYIN_WEBHOOK_SECRET;

  // 2. Compute expected signature
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  // 3. Compare signatures (timing-safe)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 4. Process webhook
  const event = req.body;
  await handleWebhookEvent(event);

  // 5. Respond quickly
  res.json({ received: true });
});
```

### Idempotency

Webhooks may be delivered multiple times. Make your handlers idempotent:

```typescript
async function handleOrderCompleted(event: any) {
  const { orderId, txHash } = event.data;

  // Use transaction hash as idempotency key
  const existingPayment = await db.payments.findUnique({
    where: { txHash }
  });

  if (existingPayment) {
    console.log('Payment already processed:', txHash);
    return; // Skip duplicate processing
  }

  // Process payment atomically
  await db.$transaction(async (tx) => {
    await tx.payments.create({
      data: {
        orderId,
        txHash,
        processedAt: new Date()
      }
    });

    await tx.orders.update({
      where: { id: orderId },
      data: { status: 'fulfilled' }
    });
  });
}
```

For complete webhook documentation, see [Webhooks Guide](/en/guide/webhooks) .

## Migrating from MCP

If you started with MCP for prototyping, here's how to migrate to production API:

### 1. Replace MCP Calls with API Calls

**Before (MCP):**
```
Create a payment order:
- Order Reference: ORDER-2025-001
- Amount: 10 USDT
- Chain: ethereum-sepolia
```

**After (API):**
```typescript
const order = await payin.createOrder({
  orderReference: 'ORDER-2025-001',
  amount: '10',
  currency: 'USDT',
  chainId: 'ethereum-sepolia'
});
```

### 2. Implement Webhook Handlers

MCP provides immediate feedback in chat. In production, use webhooks for async notifications:

```typescript
// Replace: "What's the status of order ORDER-2025-001?"
// With: Webhook handler

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'order.completed') {
    // Your business logic here
    await processOrder(event.data.orderReference);
  }

  res.json({ received: true });
});
```

### 3. Add Error Handling

MCP handles errors gracefully. In production, implement comprehensive error handling:

```typescript
try {
  const order = await payin.createOrder(params);
} catch (error) {
  // Log error
  logger.error('Order creation failed', { error });

  // Retry if appropriate
  if (isRetryable(error)) {
    await retryLater(params);
  }

  // Alert admin if critical
  if (isCritical(error)) {
    await alertAdmin(error);
  }
}
```

### 4. Environment Variables

Store configuration securely:

```bash
# .env
PAYIN_API_KEY=pk_your_production_key
PAYIN_BASE_URL=https://your-payin.example.com/api/v1
PAYIN_WEBHOOK_SECRET=whsec_your_secret
```

## Best Practices

### Security

1. **API Key Security**
   - ✅ Store keys in environment variables
   - ✅ Use different keys for testnet and mainnet
   - ✅ Rotate keys periodically (every 90 days)
   - ✅ Limit key permissions when possible
   - ❌ Never commit keys to version control
   - ❌ Never expose keys in client-side code
   - ❌ Never log keys in application logs

2. **HTTPS Only**
   - Always use HTTPS for API requests
   - Ensure webhook endpoints use HTTPS
   - Use valid SSL certificates

3. **Webhook Verification**
   - Always verify webhook signatures
   - Use timing-safe comparison functions
   - Reject unsigned webhooks immediately

### Reliability

1. **Idempotency**
   - Make webhook handlers idempotent
   - Use transaction hashes as deduplication keys
   - Implement atomic database operations

2. **Retry Logic**
   - Retry failed API calls with exponential backoff
   - Set maximum retry attempts (3-5)
   - Don't retry client errors (4xx), only server errors (5xx)

3. **Timeouts**
   - Set reasonable request timeouts (10-30 seconds)
   - Handle timeout errors gracefully
   - Consider longer timeouts for list operations

### Performance

1. **Connection Pooling**
   ```typescript
   // Reuse HTTP client instances
   const agent = new https.Agent({
     keepAlive: true,
     maxSockets: 50
   });
   ```

2. **Caching**
   ```typescript
   // Cache chain/token configurations
   const chains = await cache.getOrFetch('chains', async () => {
     return await payin.getChains();
   }, { ttl: 3600 }); // Cache for 1 hour
   ```

3. **Pagination**
   ```typescript
   // Always use pagination for large datasets
   let page = 1;
   let hasMore = true;

   while (hasMore) {
     const result = await payin.listOrders({ page, limit: 100 });
     await processOrders(result.orders);
     hasMore = page < result.pagination.totalPages;
     page++;
   }
   ```

### Monitoring

1. **Log All API Calls**
   - Request parameters
   - Response status
   - Response time
   - Error messages

2. **Track Key Metrics**
   - API success rate
   - Average response time
   - Order completion rate
   - Webhook delivery success

3. **Set Up Alerts**
   - API failure rate > 5%
   - Response time > 5 seconds
   - Address pool < 100 available
   - Webhook delivery failures

## Testing

### Using Testnet

Always test thoroughly on testnet before production:

```typescript
// Use testnet base URL
const testnetClient = new PayInClient(
  process.env.PAYIN_TESTNET_KEY,
  'https://your-payin.example.com/api/v1'
);

// Test order creation
const order = await testnetClient.createOrder({
  orderReference: `test_${Date.now()}`,
  amount: '1',
  currency: 'USDT',
  chainId: 'ethereum-sepolia'
});

console.log('Test order created:', order.paymentUrl);
```

### Testing Webhooks Locally

Use ngrok to expose local webhook endpoint:

```bash
# Start ngrok
ngrok http 3000

# Your webhook URL becomes:
# https://abc123.ngrok.io/webhooks/payin

# Register this URL with /api/v1/notifications/endpoints
```

### Test Scenarios

Verify these scenarios on testnet:

- ✅ Order creation and payment flow
- ✅ Order expiration after timeout
- ✅ Deposit address binding
- ✅ Multiple deposits to same address
- ✅ Webhook signature verification
- ✅ Webhook retry handling
- ✅ Error scenarios (invalid params, insufficient addresses)
- ✅ Concurrent order creation

## Rate Limiting

::: tip Future Feature
Rate limiting is not currently enforced but may be added in future versions. Follow best practices to prepare for future limits.
:::

**Recommended Practices:**
- Implement exponential backoff for retries
- Cache chain/token configurations
- Use pagination for large datasets
- Avoid polling; use webhooks instead

**Expected Future Limits:**
- Orders: 100 requests/minute per organization
- Deposits: 50 requests/minute per organization
- Queries: 300 requests/minute per organization

## Next Steps

### Essential Integration

- **[Webhooks](/en/guide/webhooks)** - Set up event notifications 
- **[Security](/en/guide/security)** - Production security checklist 
- **[Address Pool Setup](/en/guide/address-pool-setup)** - Manage payment addresses

### Core Features

- **[Order Payment Service](/en/guide/order-payment)** - Detailed order flow
- **[Deposit Service](/en/guide/deposit-service)** - Detailed deposit flow
- **[Payment Links](/en/guide/payment-links)** - Create shareable payment URLs

### Reference

- **[Supported Networks](/en/guide/supported-networks)** - Available blockchains
- **[Supported Tokens](/en/guide/supported-tokens)** - Available stablecoins
- **[Testnet vs Mainnet](/en/guide/testnet-vs-mainnet)** - Environment comparison

## Getting Help

- **API Questions**: Join [Discord Community](https://discord.gg/payin) 
- **Bug Reports**: Email support@payin.com 

---

**Ready to go live?** Once you've tested thoroughly on testnet, switch to mainnet by:
1. Creating account at [your-payin.example.com](https://your-payin.example.com)
2. Importing addresses to mainnet address pool
3. Generating mainnet API key
4. Updating `PAYIN_BASE_URL` to `https://your-payin.example.com/api/v1`
