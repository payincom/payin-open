# Order Payment Service

Order Payment Service provides one-time payment addresses for individual transactions. It's ideal for e-commerce checkouts, service payments, and any scenario where you need a unique payment address for each transaction.

## What is Order Payment Service?

Order Payment Service allocates a temporary payment address for each order. When payment is received and confirmed, the order completes automatically and the address is released back to the pool for future use.

**Key Characteristics:**
- 🎯 **One order, one address** - Each order gets a unique payment address
- ⏱️ **Time-limited** - Orders have a payment window with grace period
- ♻️ **Address recycling** - Addresses return to pool after order completion
- 🔗 **Single-chain** - Each order monitors one specific blockchain
- 🏢 **Multi-tenant** - Complete organization isolation

## Order vs Deposit

Understanding the difference between Order and Deposit services:

| Feature | Order Payment | Deposit Service |
|---------|---------------|-----------------|
| **Address** | Temporary (recycled after use) | Permanent (bound to user) |
| **Lifetime** | Minutes to hours | Long-term (months/years) |
| **Monitoring** | Single chain specified at creation | Multiple chains (protocol family) |
| **Use Case** | E-commerce checkout, invoices | User wallets, recurring top-ups |
| **Expiration** | Yes (payment window + grace period) | No expiration |

**When to use Order Payment:**
- E-commerce product checkout
- Service fee payments
- Invoice payments
- Event ticket purchases
- One-time donations

## Quick Start

### Prerequisites

Before creating orders, ensure you have:

1. ✅ **PayIn Account** - Registered at [your-payin.example.com](https://your-payin.example.com) or [your-payin.example.com](https://your-payin.example.com)
2. ✅ **API Key** - Generated from Admin dashboard
3. ✅ **Address Pool** - At least a few addresses imported (see [Address Pool Setup](/en/guide/address-pool-setup))
4. ✅ **Supported Network** - Choose from [supported networks](/en/guide/supported-networks)

::: tip Check Address Pool First
If your address pool is empty, order creation will fail with "No available addresses in pool". Import addresses before proceeding.
:::

### Example 1: Create Your First Order (MCP)

Using PayIn with Claude Desktop or Cline:

```
Create a payment order:
- Order Reference: ORDER-2025-001
- Amount: 10 USDT
- Chain: ethereum-sepolia
```

The AI assistant will:
1. Call the `create_order` tool
2. Allocate a payment address from your pool
3. Start monitoring the blockchain
4. Return payment details with QR code

**Expected Response:**
```
✅ Order created successfully!

Order ID: 550e8400-e29b-41d4-a716-446655440123
Payment Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1
Amount: 10 USDT
Chain: ethereum-sepolia
Status: pending
Expires At: 2025-01-28T14:45:00Z

The buyer should send exactly 10 USDT to the address above.
Payment window: 10 minutes
Grace period: 5 minutes (total 15 minutes)
```

### Example 2: Create Order via API

**Using cURL:**

```bash
curl -X POST https://your-payin.example.com/api/v1/orders \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderReference": "ORDER-2025-001",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia"
  }'
```

**Using TypeScript:**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderReference: 'ORDER-2025-001',
    amount: '10',
    currency: 'USDT',
    chainId: 'ethereum-sepolia'
  })
});

const result = await response.json();
console.log('Order created:', result.data);
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "status": "pending",
    "expiresAt": "2025-01-28T14:45:00Z",
    "qrCode": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1:10:USDT"
  },
  "message": "Order created successfully"
}
```

### Example 3: Check Order Status

**Via API:**

```bash
curl https://your-payin.example.com/api/v1/orders/550e8400-e29b-41d4-a716-446655440123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Via MCP:**

```
What's the status of order 550e8400-e29b-41d4-a716-446655440123?
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "confirmedReceived": "10.000000",
    "completedAt": "2025-01-28T14:38:25Z",
    "transactionHash": "0xabc123..."
  }
}
```

## Order Lifecycle

### Complete Flow Diagram

```
1. Create Order
   ↓
2. Allocate Address (from pool)
   ↓
3. Start Monitoring (blockchain + payment address)
   ↓
4. Payment Window (default: 10 minutes)
   ↓ [payment detected]
5. Wait for Confirmations (chain-specific: 3-10 blocks)
   ↓ [sufficient confirmations]
6. Order Completed
   ↓
7. Stop Monitoring
   ↓
8. Release Address (back to pool after cooldown)
```

### Status Transitions

PayIn uses a simple 3-state machine:

```
pending → completed  (payment received and confirmed)
        ↓
        → expired    (timeout without sufficient payment)
```

**Status Meanings:**

- **`pending`**: Order created, waiting for payment AND block confirmations
- **`completed`**: Payment received and confirmed successfully
- **`expired`**: Timeout reached without sufficient payment

::: tip Terminal States
Both `completed` and `expired` are terminal states - orders cannot transition out of these states.
:::

### Timeout Mechanism

Orders use a **dual-timeout** mechanism for reliability:

**1. Payment Window (Default: 10 minutes)**
- The primary time for user to complete payment
- After this window, no new payments should be initiated
- System continues monitoring during grace period

**2. Grace Period (Default: 5 minutes)**
- Extra time for pending transactions to confirm
- Ensures payments initiated before timeout can still complete
- After grace period, order becomes `expired` if insufficient payment

**Total Timeout = Payment Window + Grace Period**

```typescript
// Example: Custom timeouts
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "paymentWindowMinutes": 15,  // Custom: 15 minutes
  "gracePeriodMinutes": 10     // Custom: 10 minutes
}
```

::: warning Maximum Timeout
Total timeout cannot exceed system maximum (default: 60 minutes). Check with your PayIn configuration.
:::

## API Reference

### Create Order

Create a new payment order with a unique payment address.

**Endpoint:** `POST /api/v1/orders`

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `orderReference` | string | Your system's unique order identifier |
| `amount` | string | Payment amount (e.g., "10", "99.50") |
| `currency` | string | Token symbol (e.g., "USDT", "USDC") |
| `chainId` | string | Blockchain identifier (e.g., "ethereum-sepolia") |

**Optional Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `paymentWindowMinutes` | number | Custom payment window (default: 10) |
| `gracePeriodMinutes` | number | Custom grace period (default: 5) |
| `successUrl` | string | Redirect URL on order completion |
| `cancelUrl` | string | Redirect URL on order expiration |
| `metadata` | object | Custom data to attach to order |

**Example Request:**

```json
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "successUrl": "https://myshop.com/orders/ORDER-2025-001/success",
  "cancelUrl": "https://myshop.com/orders/ORDER-2025-001/cancel",
  "metadata": {
    "customer_id": "user_12345",
    "product_id": "prod_xyz",
    "source": "web_checkout"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "status": "pending",
    "expiresAt": "2025-01-28T14:45:00Z",
    "qrCode": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1:10:USDT"
  }
}
```

### Get Order

Retrieve order details by order ID.

**Endpoint:** `GET /api/v1/orders/:orderId`

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "10",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "confirmedReceived": "10.000000",
    "requiredConfirmations": 3,
    "paymentWindowEndsAt": "2025-01-28T14:40:00Z",
    "gracePeriodEndsAt": "2025-01-28T14:45:00Z",
    "createdAt": "2025-01-28T14:30:00Z",
    "completedAt": "2025-01-28T14:38:25Z",
    "metadata": {
      "customer_id": "user_12345",
      "product_id": "prod_xyz",
      "source": "web_checkout"
    }
  }
}
```

### List Orders

List all orders with filtering and pagination.

**Endpoint:** `GET /api/v1/orders`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `completed`, `expired` |
| `chain` | string | Filter by chain ID |
| `token` | string | Filter by token symbol |
| `orderReference` | string | Search by order reference |
| `createdAfter` | ISO8601 | Filter by creation date (after) |
| `createdBefore` | ISO8601 | Filter by creation date (before) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `sortBy` | string | Sort field: `created_at`, `updated_at`, `amount` |
| `sortOrder` | string | Sort direction: `ASC` or `DESC` |

**Example Request:**

```bash
curl "https://your-payin.example.com/api/v1/orders?status=completed&chain=ethereum-sepolia&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "550e8400-e29b-41d4-a716-446655440123",
        "orderReference": "ORDER-2025-001",
        "status": "completed",
        "amount": "10",
        "currency": "USDT",
        "chainId": "ethereum-sepolia",
        "completedAt": "2025-01-28T14:38:25Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 10
  }
}
```

### Get Order Statistics

Get aggregated statistics for orders.

**Endpoint:** `GET /api/v1/orders/stats`

**Query Parameters:** Same as List Orders (for filtering)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "completedOrders": 120,
    "pendingOrders": 5,
    "expiredOrders": 25,
    "totalAmount": "15234.50",
    "completedAmount": "14120.00",
    "avgPaymentTimeSeconds": 342,
    "byStatus": {
      "completed": 120,
      "pending": 5,
      "expired": 25
    },
    "byChain": {
      "ethereum-sepolia": 80,
      "polygon-amoy": 70
    },
    "byToken": {
      "USDT": 100,
      "USDC": 50
    }
  }
}
```

## Integration Examples

### E-Commerce Checkout Flow

Complete integration example for an online store:

```typescript
import { PayInClient } from '@payin/sdk'; // Hypothetical SDK

class CheckoutService {
  private payin: PayInClient;

  constructor(apiKey: string) {
    this.payin = new PayInClient({
      apiKey,
      baseUrl: 'https://your-payin.example.com/api/v1',
    });
  }

  /**
   * Step 1: User clicks "Pay with Crypto" at checkout
   */
  async createPaymentOrder(checkoutData: {
    orderId: string;
    totalAmount: number;
    currency: string;
    chain: string;
    customerId: string;
    items: any[];
  }) {
    try {
      // Create PayIn order
      const order = await this.payin.orders.create({
        orderReference: checkoutData.orderId,
        amount: checkoutData.totalAmount.toString(),
        currency: checkoutData.currency,
        chainId: checkoutData.chain,
        successUrl: `https://myshop.com/checkout/success?order=${checkoutData.orderId}`,
        cancelUrl: `https://myshop.com/checkout/cancel?order=${checkoutData.orderId}`,
        metadata: {
          customer_id: checkoutData.customerId,
          items: checkoutData.items,
          total_items: checkoutData.items.length,
        },
      });

      // Store PayIn order ID in your database
      await this.db.orders.update(checkoutData.orderId, {
        payinOrderId: order.orderId,
        paymentAddress: order.paymentAddress,
        paymentStatus: 'awaiting_payment',
        expiresAt: order.expiresAt,
      });

      return {
        orderId: order.orderId,
        paymentAddress: order.paymentAddress,
        amount: order.amount,
        currency: order.currency,
        chain: order.chainId,
        expiresAt: order.expiresAt,
        qrCode: this.generateQRCode(order.paymentAddress, order.amount, order.currency),
      };
    } catch (error) {
      console.error('Failed to create payment order:', error);
      throw new Error('Payment creation failed. Please try again.');
    }
  }

  /**
   * Step 2: Display payment page to user
   */
  renderPaymentPage(order: any) {
    return {
      paymentAddress: order.paymentAddress,
      amount: order.amount,
      currency: order.currency,
      chain: order.chainId,
      qrCode: order.qrCode,
      expiresAt: order.expiresAt,
      instructions: [
        `Send exactly ${order.amount} ${order.currency} to the address above`,
        `Network: ${order.chainId}`,
        `Payment expires in ${this.getTimeRemaining(order.expiresAt)} minutes`,
      ],
    };
  }

  /**
   * Step 3: Poll for order status (alternative to webhooks)
   */
  async pollOrderStatus(orderId: string): Promise<OrderStatus> {
    const order = await this.payin.orders.get(orderId);

    // Update your database
    await this.db.orders.updateByPayinOrderId(orderId, {
      paymentStatus: order.status,
      confirmedAmount: order.confirmedReceived,
      completedAt: order.completedAt,
    });

    return order.status;
  }

  /**
   * Step 4: Handle webhook notification (recommended)
   */
  async handleWebhook(event: PayInWebhookEvent) {
    // Verify webhook signature (important for security!)
    if (!this.payin.webhooks.verify(event)) {
      throw new Error('Invalid webhook signature');
    }

    if (event.type === 'order.completed') {
      const orderReference = event.data.orderReference;

      // Update your order status
      await this.db.orders.update(orderReference, {
        paymentStatus: 'paid',
        paidAt: event.data.completedAt,
        transactionHash: event.data.transactionHash,
      });

      // Trigger fulfillment
      await this.fulfillmentService.processOrder(orderReference);

      // Send confirmation email
      await this.emailService.sendPaymentConfirmation(orderReference);
    } else if (event.type === 'order.expired') {
      const orderReference = event.data.orderReference;

      // Mark as expired
      await this.db.orders.update(orderReference, {
        paymentStatus: 'expired',
      });

      // Send expiration notice
      await this.emailService.sendPaymentExpired(orderReference);
    }
  }

  private generateQRCode(address: string, amount: string, currency: string): string {
    // Generate QR code with payment details
    // Implementation depends on your QR library
    return `data:image/png;base64,...`;
  }

  private getTimeRemaining(expiresAt: Date): number {
    return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000);
  }
}
```

### Service Payment (Consulting Invoice)

Example for service-based businesses:

```typescript
class InvoicePaymentService {
  async createInvoicePayment(invoice: {
    invoiceNumber: string;
    clientId: string;
    amount: number;
    description: string;
    dueDate: Date;
  }) {
    // Create PayIn order with longer payment window for invoices
    const order = await fetch('https://your-payin.example.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderReference: invoice.invoiceNumber,
        amount: invoice.amount.toString(),
        currency: 'USDT',
        chainId: 'ethereum-sepolia',
        paymentWindowMinutes: 4320, // 3 days (72 hours)
        gracePeriodMinutes: 1440,   // 1 day (24 hours)
        successUrl: `https://consulting.com/invoices/${invoice.invoiceNumber}/paid`,
        metadata: {
          client_id: invoice.clientId,
          description: invoice.description,
          due_date: invoice.dueDate.toISOString(),
          invoice_type: 'consulting_services',
        },
      }),
    });

    const result = await order.json();

    if (!result.success) {
      throw new Error(`Failed to create payment order: ${result.message}`);
    }

    // Send invoice email with payment instructions
    await this.sendInvoiceEmail(invoice, result.data);

    return result.data;
  }

  private async sendInvoiceEmail(invoice: any, paymentOrder: any) {
    const emailContent = `
      Invoice: ${invoice.invoiceNumber}
      Amount Due: ${paymentOrder.amount} ${paymentOrder.currency}

      Payment Instructions:
      1. Send ${paymentOrder.amount} ${paymentOrder.currency} to:
         ${paymentOrder.paymentAddress}
      2. Network: ${paymentOrder.chainId}
      3. Payment expires: ${new Date(paymentOrder.expiresAt).toLocaleString()}

      QR Code attached for easy payment.
    `;

    // Send email with payment details
    // ...
  }
}
```

## Advanced Configuration

### Custom Payment Window

Adjust timeouts based on your use case:

```typescript
// Quick payment (event tickets)
{
  "paymentWindowMinutes": 5,  // 5 minutes to pay
  "gracePeriodMinutes": 3     // 3 minutes grace
}

// Standard e-commerce
{
  "paymentWindowMinutes": 10,  // Default
  "gracePeriodMinutes": 5      // Default
}

// Invoice payment
{
  "paymentWindowMinutes": 4320,  // 3 days
  "gracePeriodMinutes": 1440     // 1 day
}
```

::: tip Choosing Payment Window
- **Short (5-10 min)**: Time-sensitive items (event tickets, limited stock)
- **Medium (15-30 min)**: Standard e-commerce checkout
- **Long (hours/days)**: Invoices, B2B payments, high-value items
:::

### Redirect URLs

Configure where users go after payment:

```typescript
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",

  // Redirect URLs with order information
  "successUrl": "https://myshop.com/orders/ORDER-2025-001/success",
  "cancelUrl": "https://myshop.com/orders/ORDER-2025-001/cancel"
}
```

**URL Parameters Added by PayIn:**

When redirecting, PayIn appends these parameters:

```
?order_reference=ORDER-2025-001
&status=completed
&amount=10
&currency=USDT
&chain_id=ethereum-sepolia
&completed_at=2025-01-28T14:38:25Z
&tx_hash=0xabc123...
```

**Full Redirect Example:**

```
https://myshop.com/orders/ORDER-2025-001/success?order_reference=ORDER-2025-001&status=completed&amount=10&currency=USDT&chain_id=ethereum-sepolia&completed_at=2025-01-28T14:38:25Z&tx_hash=0xabc123...
```

::: tip Default Redirect URLs
You can configure organization-wide default redirect URLs in PayIn Admin dashboard. Order-level URLs take precedence over defaults.
:::

### Order Metadata

Attach custom data to orders:

```typescript
{
  "orderReference": "ORDER-2025-001",
  "amount": "10",
  "currency": "USDT",
  "chainId": "ethereum-sepolia",
  "metadata": {
    // Customer information
    "customer_id": "user_12345",
    "customer_email": "buyer@example.com",

    // Order details
    "product_ids": ["prod_abc", "prod_xyz"],
    "shipping_address_id": "addr_789",
    "discount_code": "SAVE10",

    // Internal tracking
    "source": "web_checkout",
    "campaign": "summer_sale_2025",
    "referrer": "google_ads",

    // Any custom fields
    "notes": "Gift wrapping requested"
  }
}
```

Metadata is:
- ✅ Stored with the order
- ✅ Returned in API responses
- ✅ Included in webhook events
- ✅ Fully searchable via API

## Best Practices

### Order Reference Design

Use structured, unique order references:

**Good Examples:**
```
ORDER-2025-001
INV-2025-Q1-12345
TICKET-EVENT789-SEAT42
```

**Avoid:**
```
order1          // Not unique enough
12345          // No context
tmp_order      // Not permanent
```

::: tip Uniqueness is Critical
Order references must be unique within your organization. PayIn will reject duplicate order references to prevent accidental double-charging.
:::

### Amount Precision

Always use string format for amounts to avoid floating-point errors:

**Correct:**
```typescript
{
  "amount": "10.50"      // ✅ String
  "amount": "99.99"      // ✅ String
  "amount": "1000.000"   // ✅ String with extra precision
}
```

**Incorrect:**
```typescript
{
  "amount": 10.50       // ❌ Number (may lose precision)
  "amount": 0.1 + 0.2   // ❌ JavaScript floating-point error (0.30000000000000004)
}
```

### Error Handling

Handle all error scenarios:

```typescript
try {
  const order = await payin.orders.create(orderData);
  return order;
} catch (error) {
  if (error.code === 'INSUFFICIENT_ADDRESSES') {
    // No available addresses in pool
    return {
      error: 'Payment system temporarily unavailable. Please try again in a few minutes.',
      shouldRetry: true,
    };
  } else if (error.code === 'DUPLICATE_ORDER_REFERENCE') {
    // Order reference already exists
    return {
      error: 'This order has already been created.',
      shouldRetry: false,
    };
  } else if (error.code === 'INVALID_CHAIN_TOKEN_COMBINATION') {
    // Token not available on selected chain
    return {
      error: 'Selected payment method not available. Please choose another option.',
      shouldRetry: false,
    };
  } else {
    // Unknown error
    console.error('Order creation failed:', error);
    return {
      error: 'Failed to create payment order. Please contact support.',
      shouldRetry: false,
    };
  }
}
```

### Monitoring Order Status

**Option 1: Webhooks (Recommended)**

```typescript
// Configure webhook endpoint in Admin dashboard
// https://myshop.com/webhooks/payin

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // Verify signature (critical!)
  const signature = req.headers['x-payin-signature'];
  if (!verifySignature(event, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // Process event
  if (event.type === 'order.completed') {
    await handleOrderCompleted(event.data);
  } else if (event.type === 'order.expired') {
    await handleOrderExpired(event.data);
  }

  res.status(200).send('OK');
});
```

**Option 2: Polling (Fallback)**

```typescript
// Poll order status every 10 seconds
async function pollOrderStatus(orderId: string) {
  const maxAttempts = 90; // 15 minutes (90 * 10 seconds)
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    try {
      const order = await payin.orders.get(orderId);

      if (order.status === 'completed') {
        clearInterval(interval);
        await handleOrderCompleted(order);
      } else if (order.status === 'expired') {
        clearInterval(interval);
        await handleOrderExpired(order);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('Max polling attempts reached for order:', orderId);
      }
    } catch (error) {
      console.error('Failed to fetch order status:', error);
    }
  }, 10000); // 10 seconds
}
```

::: warning Webhooks vs Polling
Webhooks are the recommended approach for production systems. Polling should only be used as a fallback or during development.
:::

### Testing Strategy

**1. Testnet Testing:**

```typescript
// Use testnet for all development and testing
const payin = new PayInClient({
  apiKey: process.env.PAYIN_TESTNET_API_KEY,
  baseUrl: 'https://your-payin.example.com/api/v1',
});

// Get testnet tokens from faucets
// Ethereum Sepolia: https://sepolia-faucet.pk910.de/
// Polygon Amoy: https://faucet.polygon.technology/
```

**2. Test Scenarios:**

- ✅ Successful payment (exact amount)
- ✅ Payment timeout (no payment sent)
- ✅ Partial payment (insufficient amount)
- ✅ Overpayment (more than required)
- ✅ Multiple payments (cumulative amount)
- ✅ Network failures and retries
- ✅ Webhook delivery and signature verification

**3. Mainnet Migration:**

```typescript
// Only switch to mainnet after thorough testnet testing
const payin = new PayInClient({
  apiKey: process.env.PAYIN_MAINNET_API_KEY,
  baseUrl: 'https://your-payin.example.com/api/v1', // Production URL
});
```

## Troubleshooting

### "No available addresses in pool"

**Problem:** Order creation fails with address pool error.

**Solution:**
1. Check address pool status in Admin dashboard
2. Import more addresses following [Address Pool Setup](/en/guide/address-pool-setup)
3. Ensure addresses for the correct protocol (EVM/Tron)

```bash
# Check pool status via API
curl https://your-payin.example.com/api/v1/address-pool/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Order Expired but Payment Sent

**Problem:** User sent payment but order expired before confirmation.

**Causes:**
- Network congestion (slow block confirmations)
- User sent payment very close to expiration
- Wrong network gas settings (too low gas price)

**Solutions:**
1. **Increase grace period** for high-value orders
2. **Contact support** with transaction hash - PayIn can manually reconcile
3. **Refund customer** if payment arrived too late (you have the funds)

### Wrong Chain or Token

**Problem:** User sent wrong token or on wrong network.

**Prevention:**
- Clearly display network and token on payment page
- Show network name (not just chain ID)
- Include warnings about correct network

**If it happens:**
- Funds sent to wrong address cannot be recovered automatically
- User must contact your support with transaction details
- PayIn support can assist with address verification

### Duplicate Order Reference

**Problem:** API returns error about duplicate order reference.

**Cause:** Attempting to create order with already-used reference.

**Solution:**
```typescript
// Generate unique references
const orderReference = `ORDER-${Date.now()}-${generateRandomId()}`;

// Or check for existing orders first
const existing = await payin.orders.list({
  orderReference: proposedReference,
});

if (existing.total > 0) {
  throw new Error('Order reference already exists');
}
```

## Next Steps

### Essential Guides
- [Webhooks](/en/guide/webhooks) - Set up automated event notifications
- [API Integration](/en/guide/api-integration) - Complete API documentation
- [Security](/en/guide/security) - Secure your integration

### Related Services
- [Deposit Service](/en/guide/deposit-service) - Permanent user addresses for recurring payments
- [Payment Links](/en/guide/payment-links) - No-code payment collection

### Technical References
- [Supported Networks](/en/guide/supported-networks) - Available blockchains
- [Supported Tokens](/en/guide/supported-tokens) - Available stablecoins
- [Address Management](/en/guide/address-management) - Advanced address pool management

## Support

Need help with Order Payment Service?

- 📧 **Email**: support@payin.com
- 💬 **Discord**: [Join our community](https://discord.gg/payin) 
- 🤖 **AI Assistant**: Ask your MCP-enabled AI assistant
