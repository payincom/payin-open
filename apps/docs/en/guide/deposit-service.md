# Deposit Service

Deposit Service provides permanent payment addresses for recurring user payments. It's ideal for gaming wallets, platform balances, and any scenario where users need a long-term address to deposit funds multiple times.

## What is Deposit Service?

Deposit Service binds a permanent payment address to each user. Once bound, the address monitors multiple blockchain networks automatically, allowing users to deposit from any supported chain within the protocol family.

**Key Characteristics:**
- 🔐 **One user, one address** - Each user gets a permanent deposit address
- 🌐 **Multi-chain monitoring** - Single address monitors entire protocol family
- ∞ **No expiration** - Address remains bound indefinitely
- ♻️ **Recurring deposits** - Support unlimited deposits to same address
- 🏢 **Open merchant scope** - Uses the internal default Open merchant/business scope

## Deposit vs Order

Understanding the difference between Deposit and Order services:

| Feature | Deposit Service | Order Payment |
|---------|-----------------|---------------|
| **Address** | Permanent (bound to user) | Temporary (recycled after use) |
| **Lifetime** | Long-term (months/years) | Minutes to hours |
| **Monitoring** | Multiple chains (protocol family) | Single chain specified at creation |
| **Use Case** | User wallets, recurring top-ups | E-commerce checkout, invoices |
| **Expiration** | No expiration | Yes (payment window + grace period) |
| **Amount** | Any amount, any time | Specific amount expected |

**When to use Deposit Service:**
- Gaming wallet top-ups
- User balance recharges
- Platform wallet addresses
- Membership recurring payments
- Loyalty program deposits
- SaaS subscription payments

## Quick Start

### Prerequisites

Before creating deposit references, ensure you have:

1. ✅ **PayIn Account** - Registered at [your-payin.example.com](https://your-payin.example.com) or [your-payin.example.com](https://your-payin.example.com)
2. ✅ **API Key** - Created through the Open operator API/CLI or self-hosted console
3. ✅ **Address Pool** - At least a few addresses imported (see [Address Pool Setup](/en/guide/address-pool-setup))
4. ✅ **Supported Network** - Choose protocol family: EVM or Tron

::: tip Check Address Pool First
If your address pool is empty, deposit binding will fail with "No available addresses in pool". Import addresses before proceeding.
:::

### Example 1: Bind Your First Deposit Address (MCP)

Using PayIn with Claude Desktop or Cline:

```
Create a deposit reference:
- Deposit Reference: user_12345
- Protocol: evm
```

The AI assistant will:
1. Call the `create_deposit_reference` tool
2. Bind a permanent address from your pool
3. Start monitoring all EVM chains (Ethereum, Polygon, etc.)
4. Return deposit address and monitoring details

**Expected Response:**
```
✅ Deposit address bound successfully!

Deposit Reference: user_12345
Protocol: evm
Deposit Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1

Monitoring:
- ethereum-sepolia: USDT, USDC
- polygon-amoy: USDT, USDC

Users can deposit any supported token from any of these chains.
The address will monitor all transactions automatically.
```

### Example 2: Bind Deposit Address via API

**Using cURL:**

```bash
curl -X POST https://your-payin.example.com/api/v1/deposits/bind \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "depositReference": "user_12345",
    "protocol": "evm"
  }'
```

**Using TypeScript:**

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    depositReference: 'user_12345',
    protocol: 'evm'
  })
});

const result = await response.json();
console.log('Deposit address bound:', result.data);
```

**Response:**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "monitoringTargets": [
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDC"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDC"
      }
    ],
    "bindingCreatedAt": "2025-01-28T14:30:00Z"
  },
  "message": "Deposit address bound successfully"
}
```

### Example 3: List User's Deposit History

**Via API:**

```bash
curl "https://your-payin.example.com/api/v1/deposits/references?depositReference=user_12345" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Via MCP:**

```
Show deposit history for user_12345
```

**Response:**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "totalDeposits": 5,
    "totalAmount": "127.50",
    "deposits": [
      {
        "id": "dep_123",
        "amount": "50.00",
        "currency": "USDT",
        "chain": "ethereum-sepolia",
        "status": "confirmed",
        "txHash": "0xabc...",
        "confirmedAt": "2025-01-28T10:15:00Z"
      },
      {
        "id": "dep_124",
        "amount": "77.50",
        "currency": "USDC",
        "chain": "polygon-amoy",
        "status": "confirmed",
        "txHash": "0xdef...",
        "confirmedAt": "2025-01-28T14:22:00Z"
      }
    ]
  }
}
```

## Deposit Lifecycle

### Complete Flow Diagram

```
1. Bind Address (to user ID)
   ↓
2. Start Multi-Chain Monitoring (all protocol chains)
   ↓
3. [User deposits from any chain]
   ↓
4. Detect Transaction (on any monitored chain)
   ↓
5. Create Transfer Record
   ↓
6. Wait for Confirmations (chain-specific: 3-10 blocks)
   ↓
7. Deposit Confirmed
   ↓
8. Send Webhook Notification
   ↓
9. Continue Monitoring (address stays bound)
```

### Status Transitions

Deposits use a 3-state confirmation flow:

```
pending → confirmed → completed
```

**Status Meanings:**

- **`pending`**: Transaction detected on blockchain, waiting for confirmations
- **`confirmed`**: Required block confirmations reached
- **`completed`**: Deposit processed and credited to user account

::: tip No Expiration
Unlike orders, deposits never expire. The address remains active indefinitely and can receive unlimited deposits.
:::

### Multi-Chain Monitoring

When you bind an address to a protocol, PayIn automatically monitors **all chains** in that protocol family:

**EVM Protocol:**
- Ethereum (Mainnet + Sepolia)
- Polygon (Mainnet + Amoy)
- All supported tokens (USDT, USDC, DAI)

**Tron Protocol:**
- Tron (Mainnet + Nile Testnet)
- All supported tokens (USDT, USDC)

**Solana Protocol:**
- Solana (Mainnet + Devnet)
- All supported tokens (USDT, USDC)

**Example Scenario:**

```typescript
// User binds EVM address
const binding = await payin.deposits.bind({
  depositReference: 'user_12345',
  protocol: 'evm'
});
// Returns address: 0x742d35...

// User can now deposit from:
// ✅ Ethereum Sepolia USDT
// ✅ Ethereum Sepolia USDC
// ✅ Polygon Amoy USDT
// ✅ Polygon Amoy USDC
// All to the SAME address: 0x742d35...

// PayIn monitors all chains automatically
// No need to create separate bindings
```

## API Reference

### Bind Deposit Address

Bind a permanent deposit address to a user.

**Endpoint:** `POST /api/v1/deposits/bind`

**Required Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `depositReference` | string | Your system's unique user identifier |
| `protocol` | string | Protocol family: `evm`, `tron`, or `solana` |

**Optional Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `metadata` | object | Custom data to attach to binding |

**Example Request:**

```json
{
  "depositReference": "user_12345",
  "protocol": "evm",
  "metadata": {
    "user_email": "player@example.com",
    "game_id": "game_xyz",
    "registration_date": "2025-01-15"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "monitoringTargets": [
      {
        "chain": "ethereum-sepolia",
        "contract": "0x...",
        "token": "USDT"
      },
      {
        "chain": "polygon-amoy",
        "contract": "0x...",
        "token": "USDC"
      }
    ],
    "bindingCreatedAt": "2025-01-28T14:30:00Z"
  }
}
```

::: tip Idempotent Operation
If you call bind with an existing depositReference, PayIn returns the existing binding instead of creating a new one. This ensures each user has only one address per protocol.
:::

### Unbind Deposit Address

Unbind a deposit address from a user (stops monitoring).

**Endpoint:** `POST /api/v1/deposits/unbind`

**Method 1: By Deposit Reference**

Unbinds all addresses for this deposit reference.

```json
{
  "depositReference": "user_12345"
}
```

**Method 2: By Address and Protocol**

Unbinds a specific address.

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "protocol": "evm"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Deposit address unbound successfully"
}
```

::: warning Unbinding Stops Monitoring
After unbinding, PayIn will no longer monitor the address. Any deposits sent to this address will not be detected or credited.
:::

### List Deposit References

List all deposit references with statistics.

**Endpoint:** `GET /api/v1/deposits/references`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `depositReference` | string | Filter by specific deposit reference |
| `protocol` | string | Filter by protocol: `evm`, `tron`, `solana` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `search` | string | Search in deposit references |

**Example Request:**

```bash
curl "https://your-payin.example.com/api/v1/deposits/references?protocol=evm&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "references": [
      {
        "depositReference": "user_12345",
        "protocol": "evm",
        "depositAddress": "0x742d35...",
        "totalDeposits": 5,
        "totalAmount": "127.50",
        "lastDepositAt": "2025-01-28T14:22:00Z",
        "boundAt": "2025-01-20T09:00:00Z"
      },
      {
        "depositReference": "user_67890",
        "protocol": "evm",
        "depositAddress": "0x9a8b7c...",
        "totalDeposits": 12,
        "totalAmount": "543.20",
        "lastDepositAt": "2025-01-28T16:45:00Z",
        "boundAt": "2025-01-18T14:30:00Z"
      }
    ],
    "total": 250,
    "page": 1,
    "limit": 10
  }
}
```

### Get Deposit Details

Retrieve detailed deposit history for a specific reference.

**Endpoint:** `GET /api/v1/deposits/references/:depositReference`

**Response:**

```json
{
  "success": true,
  "data": {
    "depositReference": "user_12345",
    "protocol": "evm",
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "boundAt": "2025-01-20T09:00:00Z",
    "totalDeposits": 5,
    "totalAmount": "127.50",
    "deposits": [
      {
        "id": "dep_123",
        "amount": "50.00",
        "currency": "USDT",
        "chain": "ethereum-sepolia",
        "status": "confirmed",
        "txHash": "0xabc123...",
        "blockNumber": 1234567,
        "confirmations": 12,
        "requiredConfirmations": 3,
        "detectedAt": "2025-01-28T10:13:45Z",
        "confirmedAt": "2025-01-28T10:15:00Z"
      }
    ]
  }
}
```

## Integration Examples

### Gaming Wallet System

Complete integration example for a gaming platform:

```typescript
import { PayInClient } from '@payin/sdk';

class GamingWalletService {
  private payin: PayInClient;

  constructor(apiKey: string) {
    this.payin = new PayInClient({
      apiKey,
      baseUrl: 'https://your-payin.example.com/api/v1',
    });
  }

  /**
   * Step 1: User registers - create deposit address
   */
  async onUserRegistration(userId: string, userEmail: string) {
    try {
      // Bind deposit address for new user
      const binding = await this.payin.deposits.bind({
        depositReference: `player_${userId}`,
        protocol: 'evm',
        metadata: {
          user_id: userId,
          email: userEmail,
          created_at: new Date().toISOString(),
          game_region: 'us-west',
        },
      });

      // Store deposit address in your database
      await this.db.users.update(userId, {
        depositAddress: binding.depositAddress,
        depositProtocol: binding.protocol,
        depositAddressBoundAt: binding.bindingCreatedAt,
      });

      // Show deposit address to user
      await this.sendWelcomeEmail(userEmail, binding.depositAddress);

      return binding;
    } catch (error) {
      console.error('Failed to create deposit address:', error);
      throw new Error('Wallet setup failed. Please try again.');
    }
  }

  /**
   * Step 2: User wants to deposit - show instructions
   */
  async getDepositInstructions(userId: string) {
    const user = await this.db.users.findById(userId);

    if (!user.depositAddress) {
      throw new Error('User has no deposit address. Please contact support.');
    }

    return {
      depositAddress: user.depositAddress,
      instructions: [
        'Send any amount of USDT or USDC to the address above',
        'Supported networks: Ethereum Sepolia, Polygon Amoy',
        'Your balance will be credited automatically after confirmation',
        'Minimum deposit: 1 USDT/USDC',
      ],
      supportedTokens: ['USDT', 'USDC'],
      supportedChains: ['ethereum-sepolia', 'polygon-amoy'],
      qrCode: this.generateQRCode(user.depositAddress),
    };
  }

  /**
   * Step 3: Handle deposit webhook notification
   */
  async handleDepositWebhook(event: PayInWebhookEvent) {
    // Verify webhook signature (important for security!)
    if (!this.payin.webhooks.verify(event)) {
      throw new Error('Invalid webhook signature');
    }

    if (event.type === 'deposit.completed') {
      const { depositReference, amount, currency, chain, txHash } = event.data;

      // Extract user ID from deposit reference
      const userId = depositReference.replace('player_', '');

      // Credit user's game balance
      await this.db.transactions.create({
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        currency,
        chain,
        tx_hash: txHash,
        status: 'completed',
        created_at: new Date(),
      });

      // Update user balance
      await this.db.users.incrementBalance(userId, parseFloat(amount));

      // Send confirmation notification
      const user = await this.db.users.findById(userId);
      await this.notificationService.send(userId, {
        title: 'Deposit Confirmed',
        message: `${amount} ${currency} has been added to your wallet`,
        type: 'success',
      });

      // Send email confirmation
      await this.emailService.sendDepositConfirmation(user.email, {
        amount,
        currency,
        chain,
        txHash,
        newBalance: user.balance + parseFloat(amount),
      });

      // Log for analytics
      await this.analytics.track('deposit_completed', {
        user_id: userId,
        amount,
        currency,
        chain,
      });

      console.log('Deposit processed successfully:', {
        userId,
        amount,
        currency,
        txHash,
      });
    }
  }

  /**
   * Step 4: User wants to withdraw - process withdrawal
   */
  async processWithdrawal(userId: string, amount: number, withdrawalAddress: string) {
    const user = await this.db.users.findById(userId);

    if (user.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from user balance
    await this.db.users.decrementBalance(userId, amount);

    // Create withdrawal record
    await this.db.transactions.create({
      user_id: userId,
      type: 'withdrawal',
      amount: -amount,
      currency: 'USDT',
      withdrawal_address: withdrawalAddress,
      status: 'pending',
    });

    // Process withdrawal through your payment processor
    // ... withdrawal logic ...
  }

  /**
   * Step 5: User account deletion - unbind address
   */
  async onUserDeletion(userId: string) {
    const user = await this.db.users.findById(userId);

    if (user.depositAddress) {
      // Unbind deposit address (stops monitoring)
      await this.payin.deposits.unbind({
        depositReference: `player_${userId}`,
      });

      console.log('Deposit address unbound for deleted user:', userId);
    }
  }

  private generateQRCode(address: string): string {
    // Generate QR code for deposit address
    // Implementation depends on your QR library
    return `data:image/png;base64,...`;
  }

  private async sendWelcomeEmail(email: string, depositAddress: string) {
    // Send welcome email with deposit instructions
    // ...
  }
}
```

### SaaS Subscription Platform

Example for subscription-based services:

```typescript
class SubscriptionPaymentService {
  async onSubscriptionCreated(customerId: string, plan: string) {
    // Bind deposit address for customer
    const binding = await fetch('https://your-payin.example.com/api/v1/deposits/bind', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        depositReference: `customer_${customerId}`,
        protocol: 'evm',
        metadata: {
          customer_id: customerId,
          subscription_plan: plan,
          created_at: new Date().toISOString(),
        },
      }),
    });

    const result = await binding.json();

    if (!result.success) {
      throw new Error(`Failed to create deposit address: ${result.message}`);
    }

    // Store in database
    await this.db.customers.update(customerId, {
      cryptoDepositAddress: result.data.depositAddress,
      depositProtocol: result.data.protocol,
    });

    // Send setup email with payment instructions
    await this.sendSubscriptionSetupEmail(customerId, result.data);

    return result.data;
  }

  async handleSubscriptionPayment(event: PayInWebhookEvent) {
    if (event.type === 'deposit.completed') {
      const { depositReference, amount, currency } = event.data;
      const customerId = depositReference.replace('customer_', '');

      // Credit customer's balance
      await this.db.customers.incrementBalance(customerId, parseFloat(amount));

      // Check if enough for subscription renewal
      const customer = await this.db.customers.findById(customerId);
      const subscriptionCost = this.getSubscriptionCost(customer.plan);

      if (customer.balance >= subscriptionCost) {
        // Auto-renew subscription
        await this.renewSubscription(customerId, subscriptionCost);

        // Deduct from balance
        await this.db.customers.decrementBalance(customerId, subscriptionCost);

        // Send renewal confirmation
        await this.emailService.sendRenewalConfirmation(customer.email, {
          plan: customer.plan,
          amount: subscriptionCost,
          nextRenewal: this.getNextRenewalDate(),
        });
      }
    }
  }

  private async sendSubscriptionSetupEmail(customerId: string, depositData: any) {
    const customer = await this.db.customers.findById(customerId);

    const emailContent = `
      Welcome to ${customer.plan} Plan!

      Your Crypto Payment Address:
      ${depositData.depositAddress}

      To activate your subscription:
      1. Send USDT or USDC to the address above
      2. Supported networks: Ethereum, Polygon
      3. Minimum: ${this.getSubscriptionCost(customer.plan)} USDT

      Your subscription will activate automatically after payment confirmation.
    `;

    await this.emailService.send(customer.email, emailContent);
  }

  private getSubscriptionCost(plan: string): number {
    const costs = {
      basic: 9.99,
      pro: 29.99,
      enterprise: 99.99,
    };
    return costs[plan] || 0;
  }

  private getNextRenewalDate(): Date {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  private async renewSubscription(customerId: string, cost: number) {
    await this.db.subscriptions.create({
      customer_id: customerId,
      renewal_date: new Date(),
      next_renewal: this.getNextRenewalDate(),
      amount_paid: cost,
      payment_method: 'crypto',
    });
  }
}
```

## Advanced Configuration

### Deposit Reference Design

Use clear, structured deposit references:

**Good Examples:**
```
player_12345           // Gaming
customer_67890         // SaaS
user_alice_wallet      // Generic platform
member_premium_999     // Membership tier
```

**Avoid:**
```
12345                  // No context
temp_user              // Not permanent
deposit_1              // Generic
user                   // Not unique
```

::: tip Uniqueness is Critical
Deposit references must be unique within your Open merchant/business scope. Each depositReference can only have one binding per protocol.
:::

### Multi-Currency Strategy

Single address can receive multiple tokens:

```typescript
// User has ONE EVM address
const binding = await payin.deposits.bind({
  depositReference: 'user_12345',
  protocol: 'evm'
});
// Address: 0x742d35...

// This address can receive:
// ✅ USDT on Ethereum
// ✅ USDC on Ethereum
// ✅ USDT on Polygon
// ✅ USDC on Polygon
// All deposits credited to same user account
```

**Benefits:**
- Simple user experience (one address to remember)
- Unified deposit history
- Automatic multi-chain support
- No need to choose network beforehand

### Minimum Deposit Amounts

Implement minimum deposit checks in your application:

```typescript
async handleDepositWebhook(event: PayInWebhookEvent) {
  const { amount, currency } = event.data;
  const minDeposit = 1.0; // Minimum 1 USDT/USDC

  if (parseFloat(amount) < minDeposit) {
    // Handle below-minimum deposit
    await this.notifyUserBelowMinimum(event.data.depositReference, amount);

    // Option 1: Still credit it (user-friendly)
    await this.creditUserBalance(event.data);

    // Option 2: Hold until user deposits more
    await this.addToPendingBalance(event.data);

    return;
  }

  // Normal deposit processing
  await this.creditUserBalance(event.data);
}
```

### Redirect URLs

Configure where users go after deposit confirmation:

```typescript
// Organization-wide deposit redirect URL
// Set through the Open operator API/CLI or self-hosted console

// When deposit confirmed, PayIn appends parameters:
// https://yourgame.com/wallet/success
//   ?deposit_reference=player_12345
//   &deposit_id=dep_123
//   &status=confirmed
//   &amount=50.00
//   &currency=USDT
//   &chain_id=ethereum-sepolia
//   &confirmed_at=2025-01-28T10:15:00Z
//   &tx_hash=0xabc123...
```

::: tip Configuration-Level Only
Unlike orders, deposits don't support per-transaction redirect URLs. Configure the merchant/business-scope redirect through the Open operator API/CLI or self-hosted console.
:::

## Best Practices

### Address Binding

**Do:**
- ✅ Bind address during user registration
- ✅ Store deposit address in your database
- ✅ Display address prominently in user's wallet page
- ✅ Provide QR code for easy scanning
- ✅ Show supported networks and tokens clearly

**Don't:**
- ❌ Create multiple bindings for same user
- ❌ Delete user's deposit address unless account deleted
- ❌ Hide the deposit address from users
- ❌ Forget to handle webhook notifications

### Webhook Processing

**Critical: Idempotency**

```typescript
async handleDepositWebhook(event: PayInWebhookEvent) {
  // MUST: Verify signature
  if (!verifySignature(event)) {
    throw new Error('Invalid signature');
  }

  // MUST: Check for duplicate processing
  const existing = await this.db.transactions.findByTxHash(event.data.txHash);
  if (existing) {
    console.log('Deposit already processed, skipping');
    return; // Idempotent - safe to process multiple times
  }

  // MUST: Use database transaction
  await this.db.transaction(async (trx) => {
    // Credit user balance
    await trx.users.incrementBalance(userId, amount);

    // Create transaction record
    await trx.transactions.create({
      tx_hash: event.data.txHash,
      user_id: userId,
      amount: amount,
      status: 'completed',
    });
  });

  // Return 200 quickly (process async if needed)
  return { success: true };
}
```

### Balance Management

**Atomic Operations:**

```typescript
// ❌ Bad: Race condition
const user = await db.users.findById(userId);
const newBalance = user.balance + depositAmount;
await db.users.update(userId, { balance: newBalance });

// ✅ Good: Atomic increment
await db.users.increment(userId, 'balance', depositAmount);

// ✅ Better: With transaction
await db.transaction(async (trx) => {
  await trx.users.increment(userId, 'balance', depositAmount);
  await trx.transactions.create({ /* ... */ });
});
```

### Monitoring and Alerts

**Set up monitoring for:**

```typescript
// 1. Webhook failures
if (webhookFailed) {
  await alerting.critical('Deposit webhook failed', {
    depositReference,
    txHash,
    error,
  });
}

// 2. Large deposits
if (parseFloat(amount) > 10000) {
  await alerting.info('Large deposit detected', {
    depositReference,
    amount,
    currency,
  });
}

// 3. Unusual activity
const recentDeposits = await getRecentDeposits(depositReference, '24h');
if (recentDeposits.length > 10) {
  await alerting.warning('Unusual deposit frequency', {
    depositReference,
    count: recentDeposits.length,
  });
}
```

### Testing Strategy

**1. Testnet Testing:**

```typescript
// Use testnet for all development
const payin = new PayInClient({
  apiKey: process.env.PAYIN_TESTNET_API_KEY,
  baseUrl: 'https://your-payin.example.com/api/v1',
});

// Test complete flow:
// 1. Bind address
// 2. Send testnet tokens
// 3. Verify webhook received
// 4. Check balance credited
```

**2. Test Scenarios:**

- ✅ First deposit for new user
- ✅ Multiple deposits to same address
- ✅ Deposits from different chains
- ✅ Deposits with different tokens
- ✅ Below-minimum deposits
- ✅ Large deposits (>$1000)
- ✅ Webhook retry mechanism
- ✅ Duplicate webhook handling

## Troubleshooting

### "No available addresses in pool"

**Problem:** Binding fails with address pool error.

**Solution:**
1. Check address pool status with the operator API, CLI, or self-hosted console
2. Import more addresses following [Address Pool Setup](/en/guide/address-pool-setup)
3. Ensure addresses for the correct protocol (EVM/Tron)
4. Check if existing addresses are already bound (deposits don't auto-release)

```bash
# Check pool status via API
curl https://your-payin.example.com/api/v1/address-pool/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Deposit Not Detected

**Problem:** User sent deposit but webhook not received.

**Causes:**
- Wrong network (e.g., sent ETH mainnet instead of Sepolia)
- Wrong token (e.g., sent ETH instead of USDT)
- Unsupported token
- Transaction still pending

**Solutions:**
1. Check transaction on block explorer
2. Verify correct network and token
3. Wait for required confirmations
4. Check PayIn monitoring status

### Duplicate Deposit Credits

**Problem:** User balance credited twice for same deposit.

**Cause:** Missing idempotency check in webhook handler.

**Solution:**

```typescript
// Add idempotency check
async handleDeposit(event: PayInWebhookEvent) {
  const { txHash, depositReference } = event.data;

  // Check if already processed
  const existing = await this.db.transactions.findOne({
    tx_hash: txHash,
    deposit_reference: depositReference,
  });

  if (existing) {
    console.log('Deposit already processed:', txHash);
    return { success: true }; // Return success to acknowledge webhook
  }

  // Process deposit...
}
```

### Wrong Chain Deposit

**Problem:** User deposited on unsupported chain.

**Prevention:**
- Clearly list supported networks on deposit page
- Show network names (not just IDs)
- Provide network-specific instructions

**If it happens:**
- Contact PayIn support with transaction hash
- PayIn can help verify address ownership
- Funds sent to wrong chain may not be recoverable

## Next Steps

### Essential Guides
- [Webhooks](/en/guide/webhooks) - Set up automated event notifications
- [API Integration](/en/guide/api-integration) - Complete API documentation
- [Security](/en/guide/security) - Secure your integration

### Related Services
- [Order Payment Service](/en/guide/order-payment) - One-time payment addresses
- [Payment Links](/en/guide/payment-links) - Cloud-only hosted links, or build an Open link flow with the Order Payment API

### Technical References
- [Supported Networks](/en/guide/supported-networks) - Available blockchains
- [Supported Tokens](/en/guide/supported-tokens) - Available stablecoins
- [Address Management](/en/guide/address-management) - Advanced address pool management

## Support

Need help with Deposit Service?

- 📧 **Email**: support@payin.com
- 💬 **Discord**: [Join our community](https://discord.gg/payin) 
- 🤖 **AI Assistant**: Ask your MCP-enabled AI assistant
