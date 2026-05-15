# Webhooks

Webhooks are HTTP callbacks that PayIn sends to your server when payment events occur. They enable real-time, event-driven automation for your payment workflows.

## What are Webhooks?

Webhooks allow PayIn to push real-time notifications to your application when important events happen:

- ✅ **Real-Time**: Get notified instantly when payments complete
- 🔄 **Asynchronous**: Don't poll for status - we push updates to you
- 🔐 **Secure**: HMAC signatures verify authenticity
- 🔁 **Reliable**: Automatic retries with exponential backoff
- 📊 **Auditable**: Complete delivery history and logs

**Why Use Webhooks?**

Without webhooks, you'd need to constantly poll PayIn's API to check for status changes. Webhooks eliminate this by notifying you immediately when events occur, reducing latency and server load.

## Webhooks vs Polling

| Approach | Latency | Server Load | Complexity | Recommended |
|----------|---------|-------------|------------|-------------|
| **Webhooks** | Real-time (< 1s) | Low | Medium | ✅ Yes (Production) |
| **Polling** | High (5-60s) | High | Low | ❌ No (Development only) |

## Supported Events

PayIn sends webhooks for these business events:

### Order Events

| Event | Description | When Fired |
|-------|-------------|------------|
| `order.completed` | Order payment confirmed | After required blockchain confirmations |
| `order.expired` | Order payment window expired | After grace period without payment |

### Deposit Events

| Event | Description | When Fired |
|-------|-------------|------------|
| `deposit.completed` | Deposit confirmed on-chain | After required blockchain confirmations |
| `deposit.address_bound` | Deposit address assigned to user | When `POST /deposits/bind` succeeds |
| `deposit.address_unbound` | Deposit address released | When `POST /deposits/unbind` succeeds |

::: tip Event Naming
Events follow the pattern `{resource}.{action}`. For example, `order.completed` means the Order resource has completed.
:::

## Setting Up Webhooks

### Step 1: Create Webhook Endpoint

Create an HTTPS endpoint in your application to receive webhooks:

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();

// IMPORTANT: Use express.raw() to preserve raw body for signature verification
app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // 1. Verify webhook signature
      const signature = req.headers['x-payin-signature'];
      const isValid = verifySignature(
        req.body,  // Raw body buffer
        signature,
        process.env.PAYIN_WEBHOOK_SECRET
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // 2. Parse event
      const event = JSON.parse(req.body.toString());

      // 3. Handle event
      await handleWebhookEvent(event);

      // 4. Respond quickly (< 10s)
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

app.listen(3000);
```

**Endpoint Requirements:**
- ✅ Must use HTTPS (not HTTP)
- ✅ Must return 200-299 status code on success
- ✅ Must respond within 30 seconds
- ✅ Should verify signature before processing
- ✅ Must handle idempotent delivery (may receive same event multiple times)

### Step 2: Configure in Admin Dashboard

1. Log in to PayIn Admin: [your-payin.example.com](https://your-payin.example.com)
2. Navigate to **Settings** → **Webhooks**
3. Click **Create Webhook Endpoint**
4. Enter your endpoint URL (e.g., `https://yourapp.com/webhooks/payin`)
5. Select events to subscribe to
6. Save and copy the **Webhook Secret**

### Step 3: Store Webhook Secret

Store the webhook secret securely in your environment variables:

```bash
# .env
PAYIN_WEBHOOK_SECRET=whsec_abc123xyz789...
```

::: warning Keep Secret Safe
The webhook secret is used to verify signatures. Never commit it to version control or expose it in client-side code.
:::

### Step 4: Test Your Endpoint

Use PayIn's test tool to verify your endpoint works:

1. In Admin dashboard, go to **Settings** → **Webhooks**
2. Click **Send Test Event**
3. Check your server logs to confirm receipt
4. Verify signature validation passed

## Webhook Payload Structure

All webhooks follow this standard structure:

```typescript
{
  id: string;              // Unique event ID (evt_...)
  type: string;            // Event type (order.completed, etc.)
  created_at: string;      // ISO 8601 timestamp
  data: {                  // Event-specific data
    // Varies by event type
  }
}
```

### Order Completed Event

```json
{
  "id": "evt_order_completed_ord_abc123",
  "type": "order.completed",
  "created_at": "2025-01-28T12:34:56Z",
  "data": {
    "orderId": "ord_abc123",
    "orderReference": "ORDER-2025-001",
    "status": "completed",
    "amount": "100",
    "currency": "USDT",
    "chainId": "ethereum-sepolia",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "txHash": "0xabcdef1234567890...",
    "confirmations": 3,
    "completedAt": "2025-01-28T12:34:45Z",
    "createdAt": "2025-01-28T12:30:00Z"
  }
}
```

### Order Expired Event

```json
{
  "id": "evt_order_expired_ord_xyz789",
  "type": "order.expired",
  "created_at": "2025-01-28T12:50:00Z",
  "data": {
    "orderId": "ord_xyz789",
    "orderReference": "ORDER-2025-002",
    "status": "expired",
    "amount": "50",
    "currency": "USDC",
    "chainId": "polygon-amoy",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "expiresAt": "2025-01-28T12:45:00Z",
    "createdAt": "2025-01-28T12:30:00Z"
  }
}
```

### Deposit Completed Event

```json
{
  "id": "evt_deposit_completed_0x1234567890abcdef",
  "type": "deposit.completed",
  "created_at": "2025-01-28T13:15:00Z",
  "data": {
    "depositReference": "user_123",
    "token": "USDT",
    "chain": "ethereum-sepolia",
    "amount": "250.500000",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "txHash": "0x1234567890abcdef...",
    "blockNumber": "12345678",
    "timestamp": "2025-01-28T13:14:45.000Z",
    "organizationId": "org_abc123"
  }
}
```

### Deposit Address Bound Event

```json
{
  "id": "evt_deposit_address_bound_user_123",
  "type": "deposit.address_bound",
  "created_at": "2025-01-28T12:00:00Z",
  "data": {
    "depositReference": "user_123",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
    "monitoringTargets": [
      { "chain": "ethereum-sepolia", "contract": "0x...", "token": "USDT" },
      { "chain": "polygon-amoy", "contract": "0x...", "token": "USDC" }
    ]
  }
}
```

## Signature Verification

**Always verify webhook signatures** to ensure the request came from PayIn and hasn't been tampered with.

### How PayIn Signs Webhooks

PayIn generates an HMAC-SHA256 signature using your webhook secret:

```
Signature = HMAC_SHA256(secret, timestamp + '.' + JSON_payload)
Format: t=<timestamp>,v1=<signature_hex>
```

The signature is sent in the `X-PayIn-Signature` header.

### Verification Implementation

#### TypeScript / Node.js

```typescript
import crypto from 'crypto';

function verifySignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    // 1. Parse signature header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      throw new Error('Invalid signature format');
    }

    const timestamp = parseInt(timestampPart.split('=')[1]);
    const signature = signaturePart.split('=')[1];

    // 2. Check timestamp tolerance (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 300; // 5 minutes

    if (now - timestamp > tolerance) {
      throw new Error('Signature timestamp expired');
    }

    // 3. Compute expected signature
    const payload = rawBody.toString('utf8');
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // 4. Compare signatures (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
```

**Usage with Express:**

```typescript
import express from 'express';

const app = express();

app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }), // Preserve raw body
  async (req, res) => {
    const signature = req.headers['x-payin-signature'] as string;
    const isValid = verifySignature(
      req.body,  // Raw buffer
      signature,
      process.env.PAYIN_WEBHOOK_SECRET!
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook...
    const event = JSON.parse(req.body.toString());
    await handleEvent(event);

    res.json({ received: true });
  }
);
```

#### Python

```python
import hmac
import hashlib
import time
from typing import Dict, Any

def verify_signature(
    raw_body: bytes,
    signature_header: str,
    secret: str,
    tolerance: int = 300
) -> bool:
    try:
        # 1. Parse signature header
        parts = signature_header.split(',')
        timestamp_part = next(p for p in parts if p.startswith('t='))
        signature_part = next(p for p in parts if p.startsWith('v1='))

        timestamp = int(timestamp_part.split('=')[1])
        signature = signature_part.split('=')[1]

        # 2. Check timestamp tolerance
        now = int(time.time())
        if now - timestamp > tolerance:
            raise ValueError('Signature timestamp expired')

        # 3. Compute expected signature
        payload = raw_body.decode('utf-8')
        signed_payload = f'{timestamp}.{payload}'
        expected_signature = hmac.new(
            secret.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        # 4. Compare signatures (timing-safe)
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        print(f'Signature verification failed: {e}')
        return False
```

#### PHP

```php
<?php

function verifySignature(
    string $rawBody,
    string $signatureHeader,
    string $secret,
    int $tolerance = 300
): bool {
    try {
        // 1. Parse signature header
        $parts = explode(',', $signatureHeader);
        $timestamp = null;
        $signature = null;

        foreach ($parts as $part) {
            if (str_starts_with($part, 't=')) {
                $timestamp = (int)substr($part, 2);
            } elseif (str_starts_with($part, 'v1=')) {
                $signature = substr($part, 3);
            }
        }

        if (!$timestamp || !$signature) {
            throw new Exception('Invalid signature format');
        }

        // 2. Check timestamp tolerance
        $now = time();
        if ($now - $timestamp > $tolerance) {
            throw new Exception('Signature timestamp expired');
        }

        // 3. Compute expected signature
        $signedPayload = $timestamp . '.' . $rawBody;
        $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);

        // 4. Compare signatures (timing-safe)
        return hash_equals($signature, $expectedSignature);
    } catch (Exception $e) {
        error_log('Signature verification failed: ' . $e->getMessage());
        return false;
    }
}
```

### Security Best Practices

1. **Always Verify Signatures**
   - Never skip signature verification in production
   - Reject webhooks with invalid signatures immediately

2. **Use Timing-Safe Comparison**
   - Use `crypto.timingSafeEqual()` (Node.js)
   - Use `hmac.compare_digest()` (Python)
   - Use `hash_equals()` (PHP)
   - Prevents timing attacks

3. **Check Timestamp Tolerance**
   - Default: 5 minutes
   - Prevents replay attacks
   - Adjustable based on your needs

4. **Preserve Raw Body**
   - Signature is computed on raw JSON string
   - Don't parse body before verification
   - Use `express.raw()` in Express

5. **HTTPS Only**
   - Only expose webhook endpoints over HTTPS
   - PayIn will reject HTTP endpoints

## Retry Mechanism

PayIn automatically retries failed webhook deliveries using exponential backoff.

### Retry Policy

| Attempt | Delay | Cumulative Time |
|---------|-------|-----------------|
| Initial | 0s | 0s |
| Retry 1 | 1s | 1s |
| Retry 2 | 2s | 3s |
| Retry 3 | 4s | 7s |
| Retry 4 | 8s | 15s |
| Retry 5 | 16s | 31s |

**Total: 5 retries over ~31 seconds**

### When PayIn Retries

PayIn retries webhooks that:
- ✅ Return HTTP 5xx (Server Error)
- ✅ Timeout (> 30 seconds)
- ✅ Network errors (connection refused, DNS failure, etc.)

PayIn does **NOT** retry webhooks that:
- ❌ Return HTTP 2xx (Success)
- ❌ Return HTTP 4xx (Client Error - bad endpoint URL, auth failure, etc.)

### Handling Retries: Idempotency

Webhooks may be delivered multiple times. Your endpoint must handle duplicate events idempotently.

**Problem:**
```typescript
// ❌ BAD: Processes webhook multiple times
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // If webhook retries, this credits balance twice!
  await db.users.update({
    where: { id: userId },
    data: { balance: { increment: event.data.amount } }
  });

  res.json({ received: true });
});
```

**Solution 1: Use Transaction Hash as Idempotency Key**

```typescript
// ✅ GOOD: Uses txHash to prevent duplicate processing
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;
  const txHash = event.data.txHash;

  // Check if already processed
  const existing = await db.payments.findUnique({
    where: { txHash }
  });

  if (existing) {
    console.log('Already processed:', txHash);
    return res.json({ received: true });
  }

  // Process atomically
  await db.$transaction(async (tx) => {
    await tx.payments.create({
      data: { txHash, amount: event.data.amount }
    });

    await tx.users.update({
      where: { id: userId },
      data: { balance: { increment: event.data.amount } }
    });
  });

  res.json({ received: true });
});
```

**Solution 2: Use Event ID as Idempotency Key**

```typescript
// ✅ GOOD: Uses event.id to prevent duplicate processing
const processedEvents = new Set<string>(); // In production: use Redis/DB

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (processedEvents.has(event.id)) {
    console.log('Already processed event:', event.id);
    return res.json({ received: true });
  }

  await handleEvent(event);
  processedEvents.add(event.id);

  res.json({ received: true });
});
```

### Manual Retry

If all automatic retries fail, you can manually retry from the Admin dashboard:

1. Go to **Settings** → **Webhooks** → **Delivery History**
2. Find the failed delivery
3. Click **Retry**
4. PayIn sends the webhook again immediately

## Event Handling Patterns

### Pattern 1: Order Completion

When a customer completes payment:

```typescript
async function handleOrderCompleted(event: any) {
  const { orderId, orderReference, amount, currency, txHash } = event.data;

  await db.$transaction(async (tx) => {
    // 1. Check if already processed (idempotency)
    const existing = await tx.orders.findUnique({
      where: { id: orderId }
    });

    if (existing?.status === 'fulfilled') {
      console.log('Order already fulfilled:', orderId);
      return;
    }

    // 2. Mark order as paid
    await tx.orders.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paidAmount: amount,
        paidCurrency: currency,
        txHash,
        paidAt: new Date()
      }
    });

    // 3. Fulfill order (ship products, grant access, etc.)
    await fulfillOrder(orderId);

    // 4. Send confirmation email
    await sendEmail({
      to: existing.customerEmail,
      subject: 'Payment Received',
      body: `Your payment of ${amount} ${currency} has been confirmed.`
    });
  });
}
```

### Pattern 2: Deposit Credit

When a user deposits funds:

```typescript
async function handleDepositCompleted(event: any) {
  const { depositReference, amount, token, chain, txHash, depositAddress } = event.data;

  // Extract user ID from deposit reference
  const userId = depositReference.replace('user_', '');

  await db.$transaction(async (tx) => {
    // 1. Check if deposit already processed (idempotency)
    const existing = await tx.deposits.findUnique({
      where: { txHash }
    });

    if (existing) {
      console.log('Deposit already credited:', txHash);
      return;
    }

    // 2. Record deposit
    await tx.deposits.create({
      data: {
        userId,
        amount,
        token,
        chain,
        txHash,
        depositAddress,
        status: 'completed',
        completedAt: new Date()
      }
    });

    // 3. Credit user balance atomically
    await tx.users.update({
      where: { id: userId },
      data: {
        balance: { increment: parseFloat(amount) }
      }
    });

    // 4. Notify user
    await notifyUser(userId, {
      type: 'deposit_completed',
      amount,
      token
    });
  });
}
```

### Pattern 3: Order Expiration

When an order expires without payment:

```typescript
async function handleOrderExpired(event: any) {
  const { orderId, orderReference } = event.data;

  // Mark order as expired
  await db.orders.update({
    where: { id: orderId },
    data: {
      status: 'expired',
      expiredAt: new Date()
    }
  });

  // Optional: Notify customer
  const order = await db.orders.findUnique({
    where: { id: orderId }
  });

  if (order.customerEmail) {
    await sendEmail({
      to: order.customerEmail,
      subject: 'Payment Window Expired',
      body: 'Your payment window has expired. Please create a new order.'
    });
  }
}
```

## Testing Webhooks

### Local Development with ngrok

Use ngrok to expose your local server to the internet for webhook testing:

```bash
# 1. Start your local server
npm run dev  # Running on http://localhost:3000

# 2. Start ngrok in another terminal
ngrok http 3000

# 3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)

# 4. Configure webhook in PayIn Admin
# URL: https://abc123.ngrok.io/webhooks/payin
```

**ngrok Benefits:**
- ✅ Real HTTPS endpoint
- ✅ Inspect webhook requests in ngrok dashboard
- ✅ Replay webhooks for debugging
- ✅ Works with any local port

### Testing with curl

Send test webhooks manually:

```bash
# 1. Generate valid signature
TIMESTAMP=$(date +%s)
PAYLOAD='{"id":"test_123","type":"order.completed","created_at":"2025-01-28T12:00:00Z","data":{}}'
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "your_webhook_secret" | cut -d' ' -f2)
HEADER="t=${TIMESTAMP},v1=${SIGNATURE}"

# 2. Send webhook
curl -X POST http://localhost:3000/webhooks/payin \
  -H "Content-Type: application/json" \
  -H "X-PayIn-Signature: ${HEADER}" \
  -H "X-PayIn-Event-Type: order.completed" \
  -H "X-PayIn-Event-Id: test_123" \
  -d "${PAYLOAD}"
```

### Integration Tests

Write automated tests for webhook handling:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSignature } from '@payin/notification';

describe('Webhook Handler', () => {
  it('should handle order.completed event', async () => {
    const event = {
      id: 'evt_test_123',
      type: 'order.completed',
      created_at: new Date().toISOString(),
      data: {
        orderId: 'ord_test',
        orderReference: 'ORDER-TEST-001',
        status: 'completed',
        amount: '100',
        currency: 'USDT',
        txHash: '0xabc123'
      }
    };

    const signature = generateSignature(event, 'test_secret');

    const response = await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    expect(response.status).toBe(200);

    // Verify order was processed
    const order = await db.orders.findUnique({
      where: { id: 'ord_test' }
    });
    expect(order.status).toBe('paid');
  });

  it('should reject webhooks with invalid signature', async () => {
    const event = {
      id: 'evt_test_456',
      type: 'order.completed',
      created_at: new Date().toISOString(),
      data: {}
    };

    const response = await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': 't=123,v1=invalid'
      },
      body: JSON.stringify(event)
    });

    expect(response.status).toBe(401);
  });

  it('should handle duplicate events idempotently', async () => {
    const event = {
      id: 'evt_test_789',
      type: 'deposit.completed',
      created_at: new Date().toISOString(),
      data: {
        depositReference: 'user_123',
        amount: '50.000000',
        token: 'USDT',
        chain: 'ethereum-sepolia',
        txHash: '0xdef456',
        depositAddress: '0x742d35Cc...',
        blockNumber: '12345678',
        timestamp: new Date().toISOString(),
        organizationId: 'org_abc123'
      }
    };

    const signature = generateSignature(event, 'test_secret');

    // Send webhook twice
    await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    await fetch('http://localhost:3000/webhooks/payin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayIn-Signature': signature
      },
      body: JSON.stringify(event)
    });

    // Balance should only be credited once
    const user = await db.users.findUnique({
      where: { id: 'user_123' }
    });
    expect(user.balance).toBe(50); // Not 100
  });
});
```

## Monitoring and Debugging

### Webhook Dashboard

Monitor webhook delivery in the Admin dashboard:

1. Go to **Settings** → **Webhooks** → **Delivery History**
2. View recent deliveries with status:
   - ✅ **Success**: HTTP 200-299 returned
   - ⏳ **Pending**: Scheduled for delivery
   - 🔄 **Retrying**: Failed, will retry
   - ❌ **Failed**: All retries exhausted

3. Click on any delivery to see:
   - Request payload
   - Response status and body
   - Response time
   - Retry history
   - Error messages (if any)

### Logging Best Practices

Log all webhook activity for debugging:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'webhooks.log' })
  ]
});

app.post('/webhooks/payin', async (req, res) => {
  const eventId = req.headers['x-payin-event-id'];
  const deliveryId = req.headers['x-payin-delivery-id'];

  logger.info('Webhook received', {
    eventId,
    deliveryId,
    type: req.body.type
  });

  try {
    await handleWebhook(req.body);

    logger.info('Webhook processed successfully', {
      eventId,
      deliveryId
    });

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', {
      eventId,
      deliveryId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({ error: 'Processing failed' });
  }
});
```

### Alerting

Set up alerts for webhook failures:

```typescript
async function checkWebhookHealth() {
  const failedCount = await db.webhookLogs.count({
    where: {
      status: 'failed',
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      }
    }
  });

  if (failedCount > 10) {
    await sendAlert({
      channel: 'slack',
      message: `🚨 Webhook Alert: ${failedCount} failed webhooks in last 15 minutes`,
      severity: 'high'
    });
  }
}

// Run every 5 minutes
setInterval(checkWebhookHealth, 5 * 60 * 1000);
```

## Troubleshooting

### Webhooks Not Received

**Symptoms:** No webhooks arriving at your endpoint

**Checklist:**
1. ✅ Endpoint uses HTTPS (not HTTP)
2. ✅ Endpoint is publicly accessible (not localhost)
3. ✅ Firewall allows incoming HTTPS traffic
4. ✅ Endpoint configured correctly in Admin dashboard
5. ✅ Events subscribed to in Admin dashboard
6. ✅ Check webhook delivery history in Admin for errors

**Testing:**
```bash
# Test if your endpoint is reachable from outside
curl -X POST https://yourapp.com/webhooks/payin \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

### Invalid Signature Errors

**Symptoms:** Webhooks rejected with 401 errors

**Common Causes:**
1. **Wrong secret**: Using API key instead of webhook secret
2. **Body modified**: Parsing JSON before verification
3. **Encoding issues**: Body encoding doesn't match UTF-8

**Fix:**
```typescript
// ❌ BAD: Body is parsed before verification
app.use(express.json()); // Parses all POST bodies
app.post('/webhooks/payin', async (req, res) => {
  // req.body is now an object, not raw string
  verifySignature(req.body, ...); // FAILS
});

// ✅ GOOD: Preserve raw body for signature verification
app.post('/webhooks/payin',
  express.raw({ type: 'application/json' }), // Keep raw buffer
  async (req, res) => {
    verifySignature(req.body, ...); // SUCCESS
    const event = JSON.parse(req.body.toString());
  }
);
```

### Duplicate Event Processing

**Symptoms:** Balance credited twice, orders fulfilled multiple times

**Cause:** Webhook retries not handled idempotently

**Fix:** Use transaction hash or event ID as deduplication key (see [Idempotency](#handling-retries-idempotency))

### Slow Response Times

**Symptoms:** Webhooks timing out, frequent retries

**Cause:** Synchronous processing blocking webhook response

**Fix: Process Asynchronously**

```typescript
// ❌ BAD: Blocks webhook response
app.post('/webhooks/payin', async (req, res) => {
  await sendEmail(); // Takes 3 seconds
  await processOrder(); // Takes 5 seconds
  await updateInventory(); // Takes 2 seconds
  res.json({ received: true }); // Responds after 10 seconds
});

// ✅ GOOD: Responds immediately, processes async
import Queue from 'bull';

const webhookQueue = new Queue('webhooks');

app.post('/webhooks/payin', async (req, res) => {
  // Enqueue for processing
  await webhookQueue.add(req.body);

  // Respond immediately
  res.json({ received: true }); // Responds in < 100ms
});

// Process webhooks in background
webhookQueue.process(async (job) => {
  const event = job.data;
  await sendEmail();
  await processOrder();
  await updateInventory();
});
```

## Best Practices

### Security

1. **Always Verify Signatures**
   - Never skip verification in production
   - Use timing-safe comparison
   - Check timestamp tolerance

2. **Use HTTPS Only**
   - PayIn requires HTTPS endpoints
   - Use valid SSL certificates
   - Don't expose HTTP endpoints

3. **Protect Webhook Secret**
   - Store in environment variables
   - Never commit to version control
   - Rotate periodically (every 90 days)

### Reliability

1. **Respond Quickly (< 10s)**
   - Acknowledge receipt immediately
   - Process asynchronously
   - Don't block webhook response

2. **Implement Idempotency**
   - Use txHash as deduplication key
   - Handle duplicate events gracefully
   - Use atomic database transactions

3. **Log Everything**
   - Log all received webhooks
   - Log processing outcomes
   - Include event ID and delivery ID
   - Set up log monitoring and alerts

### Performance

1. **Async Processing**
   ```typescript
   // Use job queue for heavy processing
   await queue.add('process-webhook', event);
   res.json({ received: true });
   ```

2. **Database Optimization**
   ```typescript
   // Use database transactions
   await db.$transaction(async (tx) => {
     // All operations atomic
   });
   ```

3. **Caching**
   ```typescript
   // Cache frequently accessed data
   const user = await cache.getOrFetch(`user:${userId}`, async () => {
     return await db.users.findUnique({ where: { id: userId } });
   });
   ```

## Next Steps

### Essential Integration

- **[API Integration](/en/guide/api-integration)** - REST API guide
- **[Security](/en/guide/security)** - Security best practices 
- **[Order Payment Service](/en/guide/order-payment)** - Order flow details

### Core Features

- **[Deposit Service](/en/guide/deposit-service)** - Deposit flow details
- **[Payment Links](/en/guide/payment-links)** - Create payment URLs

### Reference

- **[Supported Networks](/en/guide/supported-networks)** - Available blockchains
- **[Supported Tokens](/en/guide/supported-tokens)** - Available stablecoins

## Getting Help

- **Webhook Issues**: Check delivery history in Admin dashboard
- **Community Support**: [Discord Community](https://discord.gg/payin) 

---

**Production Checklist:**
- ✅ HTTPS endpoint configured
- ✅ Signature verification implemented
- ✅ Idempotency handling implemented
- ✅ Async processing for heavy operations
- ✅ Error logging and monitoring
- ✅ Alerts for failed webhooks
- ✅ Tested with ngrok locally
- ✅ Tested on testnet before mainnet
