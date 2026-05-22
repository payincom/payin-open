# Address Management

Comprehensive guide to managing blockchain addresses in PayIn's address pool system.

## Overview

PayIn's **Address Pool** is a sophisticated address management system that pre-generates and dynamically allocates blockchain addresses for payment processing. This approach enables:

- **Instant Address Assignment**: No need to generate addresses on-demand
- **Address Reusability**: Efficient recycling with cooldown protection
- **Multi-Chain Support**: Unified management across EVM, Tron, and Solana
- **Security**: Proper key management and address isolation
- **Scalability**: Handle high-volume payment operations

::: tip Why Address Pool?
Traditional payment systems generate addresses on-demand, causing delays. PayIn's address pool pre-generates addresses, enabling instant payment address assignment and improving user experience.
:::

## Address Pool Concept

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Address Pool System                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  Allocate  ┌──────────────┐             │
│  │  Available   │  ────────→  │  Allocated   │             │
│  │  Addresses   │             │  (Order)     │             │
│  │              │             │              │             │
│  │  1000 addrs  │  ←────────  │  50 addrs    │             │
│  └──────────────┘   Release   └──────────────┘             │
│        ↑                                                    │
│        │                                                    │
│        │ After cooldown                                     │
│        │                                                    │
│  ┌──────────────┐             ┌──────────────┐             │
│  │  Cooldown    │             │    Bound     │             │
│  │  (30 min)    │             │  (Deposit)   │             │
│  │              │             │              │             │
│  │  100 addrs   │             │  200 addrs   │             │
│  └──────────────┘             └──────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Concepts**:

1. **Pre-Generation**: Addresses are generated in bulk before being needed
2. **Dynamic Allocation**: Addresses are assigned on-demand from the pool
3. **State Management**: Addresses transition through defined states
4. **Automatic Recycling**: Order addresses return to the pool after completion
5. **Cooldown Protection**: Prevents immediate reuse for privacy and security

### Address States

PayIn manages addresses through four states:

| State | Description | Used For | Returns to Pool |
|-------|-------------|----------|----------------|
| **available** | Ready for allocation | Waiting in pool | N/A |
| **allocated** | Temporarily assigned | Active orders | Yes (after completion) |
| **bound** | Permanently assigned | User deposits | Optional (manual unbind) |
| **cooldown** | Recently released | Temporary hold | Yes (after 30 min) |

::: details State Transition Diagram

```
               allocate                complete/expire
  available  ─────────→  allocated  ──────────────→  cooldown
      ↑                                                   │
      │                                                   │
      └───────────────── after 30 min ────────────────────┘

               bind                      unbind
  available  ─────────→   bound    ─────────────→  cooldown
      ↑                                                   │
      │                                                   │
      └───────────────── after 30 min ────────────────────┘
```

:::

### Why Cooldown Matters

**Cooldown Period** (default: 30 minutes) provides:

1. **Privacy Protection**: Prevents linking different orders to the same address immediately
2. **Settlement Window**: Allows time for blockchain finalization
3. **User Confidence**: Avoids confusion from address reuse
4. **Monitoring Cleanup**: Ensures monitoring tasks complete properly

::: tip Configurable Cooldown
The cooldown period can be adjusted for the Open merchant/business scope via the `address_pool.cooldown_minutes` configuration parameter.
:::

## Address Management Modes

PayIn supports two address management approaches to fit different security models and operational preferences.

### Comparison Table

| Feature | HD Wallet Mode | Self-Managed Mode |
|---------|---------------|-------------------|
| **Key Management** | User controls mnemonic | User controls private keys |
| **Address Generation** | PayIn CLI tool | User's own tools |
| **Traceability** | Full (derivation index) | Limited |
| **Backup** | Single mnemonic | Each key separately |
| **Tooling** | PayIn provides tools | User provides tools |
| **Recommended For** | Most users | Advanced users |
| **Security Responsibility** | User (mnemonic) | User (all keys) |

::: tip Recommendation
We strongly recommend **HD Wallet Mode** for most use cases. It provides better traceability, easier backup, and full tooling support from PayIn.
:::

### HD Wallet Mode (Recommended)

**HD Wallet Mode** uses BIP44 hierarchical deterministic wallet standard to derive addresses from a single master seed (mnemonic phrase).

**Advantages**:
- ✅ **Single Backup**: One 12/24-word mnemonic backs up unlimited addresses
- ✅ **Deterministic**: Can regenerate any address with mnemonic + derivation index
- ✅ **Full Traceability**: Track which addresses belong to your wallet
- ✅ **PayIn Tooling**: Complete CLI tool support for generation and verification
- ✅ **Standards-Based**: Uses industry-standard BIP44 paths

**How It Works**:

1. Generate a BIP39 mnemonic phrase (12 or 24 words)
2. Use PayIn Address Tool to derive addresses from the mnemonic
3. Export addresses to CSV (includes derivation index)
4. Import CSV to PayIn via the operator API/CLI or your self-hosted console
5. PayIn assigns addresses from the pool

**Derivation Paths**:

```
EVM Chains:    m/44'/60'/0'/0/{index}   (Ethereum, Polygon, etc.)
Tron Chain:    m/44'/195'/0'/0/{index}
Solana Chain:  m/44'/501'/{index}'/0'   (Hardened derivation)
```

::: warning Solana Limitations
Solana uses Ed25519 cryptography with hardened derivation (SLIP-0010), which means:
- ❌ Cannot derive child addresses from master public key
- ✅ Address generation requires full mnemonic
- ✅ Addresses are still tracked via derivation index
- ✅ Fully compatible with PayIn's address pool

This is a fundamental cryptographic property of Ed25519, not a limitation of PayIn.
:::

### Self-Managed Mode

**Self-Managed Mode** allows you to import addresses generated by your own tools or wallets.

**Advantages**:
- ✅ **Full Control**: Use your preferred wallet software
- ✅ **Flexibility**: Import addresses from any source
- ✅ **Custom Workflows**: Integrate with existing key management
- ✅ **No Derivation**: Not tied to any specific derivation scheme

**Considerations**:
- ⚠️ **Manual Backup**: Must backup each address/key separately
- ⚠️ **Limited Traceability**: PayIn doesn't know address relationships
- ⚠️ **Your Responsibility**: Must ensure addresses are valid and secure

**How It Works**:

1. Generate addresses using your wallet software
2. Export to CSV format
3. Import CSV to PayIn via the operator API/CLI or your self-hosted console
4. PayIn assigns addresses from the pool

**CSV Format**:

```csv
address,protocol,derivation_index,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,evm,,
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,tron,,
```

::: tip Optional Fields
For self-managed addresses, `derivation_index` and `master_public_key` are optional. Leave them empty if not applicable.
:::

## HD Wallet Address Generation

This section covers the complete workflow for generating addresses in HD Wallet Mode using PayIn's official tools.

### Prerequisites

1. **Secure Environment**: Use an offline computer or air-gapped system for maximum security
2. **Node.js**: Version 18 or higher
3. **PayIn Address Tool**: Official CLI tool
4. **Secure Storage**: Physical location for mnemonic backup (safe, vault, etc.)

### Step 1: Install Address Tool

```bash
# Navigate to PayIn repository
cd payin/apps/address-tool

# Install dependencies
npm install

# Build the tool
npm run build
```

::: tip Global Installation
For easier access, you can install globally:
```bash
npm install -g @payin/address-tool
```
Then run with: `payin-address-tool`
:::

### Step 2: Generate Mnemonic

Start the tool and choose to generate a new mnemonic:

```bash
npm start
```

**Interactive Flow**:

```
? Select an action: Generate New Addresses
? Select protocol: EVM (Ethereum, Polygon, etc.)
? Do you have an existing mnemonic? No, generate new mnemonic

🔐 Your Mnemonic Phrase (WRITE THIS DOWN IMMEDIATELY!):

    witch collapse practice feed shame open despair creek road again ice least

⚠️  WARNING:
   - Write down this mnemonic on paper
   - Store it in a secure, offline location
   - Anyone with this phrase can access your funds
   - This tool does NOT save it for you

? Have you written down the mnemonic? (yes/no): yes
```

**Security Checklist**:
- ✅ Write mnemonic on paper (not digitally)
- ✅ Double-check each word is correct
- ✅ Store in secure location (safe, safety deposit box)
- ✅ Consider creating multiple backups in separate locations
- ❌ NEVER save to computer, phone, or cloud storage
- ❌ NEVER take a photo of the mnemonic
- ❌ NEVER share with anyone

### Step 3: Generate Addresses

Configure address generation parameters:

```
? Starting derivation index: 0
? How many addresses to generate: 1000

Generating addresses...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% | 1000/1000

✅ Generated 1000 addresses successfully!

Protocol: evm
Derivation Path: m/44'/60'/0'/0/{index}
Range: 0 - 999
```

**Generation Tips**:

- **Batch Size**: Generate 1000-5000 addresses per batch
- **Starting Index**: Use 0 for first batch, then 1000, 2000, etc.
- **Multiple Protocols**: Generate separately for EVM, Tron, and Solana

### Step 4: Export to CSV

```
? Export to CSV? Yes
? Output file name: evm-addresses-2025-01-20

Exporting to CSV...
✅ Exported to: output/evm-addresses-2025-01-20-full.csv

CSV Format: Full (HD Wallet Mode)
Columns: address, derivation_index, protocol, master_public_key
Rows: 1000
```

**CSV Content Example**:

```csv
address,derivation_index,protocol,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,0,evm,xpub6CUGRUonZSQ4TWUJKy...
0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE,1,evm,xpub6CUGRUonZSQ4TWUJKy...
0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B,2,evm,xpub6CUGRUonZSQ4TWUJKy...
```

::: warning CSV File Security
The CSV file contains your **extended public key (xpub)**, which allows anyone to:
- View all your addresses
- Track your payment history
- Derive future addresses (EVM/Tron only)

**Do NOT**:
- Share CSV files publicly
- Upload to untrusted systems
- Commit to version control

**Store CSV files securely** and only upload to trusted PayIn instances.
:::

### Step 5: Verify Addresses (Optional)

Verify that an address belongs to your wallet:

```bash
npm start
```

```
? Select an action: Verify Address Ownership
? Select protocol: EVM
? Do you have an existing mnemonic? Yes, use existing

? Enter your mnemonic phrase: [enter your 12/24 words]

? Enter address to verify: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
? Search range (max derivation index): 1000

Searching for address...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%

✅ ADDRESS FOUND!

Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Derivation Index: 0
Derivation Path: m/44'/60'/0'/0/0
```

**Verification Use Cases**:
- Confirm an address belongs to your wallet
- Find the derivation index of a known address
- Audit imported addresses
- Recover address information

## Importing Addresses to PayIn

After generating addresses, import them into PayIn's address pool via the operator API/CLI, or through a self-hosted console you build on top of those APIs.

### Import via Operator API/CLI (Recommended)

PayIn Open does not ship an `apps/admin` console. Use the address-pool import API/CLI directly, or wire these same operations into your own self-hosted console.

**Step-by-Step**:

1. **Authenticate as an operator**
   - Use an operator API key or CLI credentials for your deployment
   - Point your CLI or script at your PayIn Open API base URL

2. **Prepare the import request**
   - Select the target Open merchant/business scope and protocol in your request or CLI flags
   - Keep protocol selection outside the CSV file

3. **Select Import Mode**
   - Use **HD Wallet Import** if your CSV includes `derivation_index` and `master_public_key`
   - Use **Self-Managed Import** for addresses from external wallets

4. **Submit CSV Content**
   - Send the exported CSV to the address-pool import endpoint or CLI command
   - Wait for validation to complete

5. **Review the Result**
   ```
   Import Summary:
   - Protocol: EVM
   - Total Addresses: 1000
   - Derivation Range: 0 - 999
   - Master Public Key: xpub6CUG...

   ✓ All addresses are valid
   ✓ No duplicates found
   ✓ Format validation passed
   ```

6. **Confirm Import Completion**
   - Store the import job/result ID if your workflow returns one
   - Confirm the imported address count and duplicate-skip count

::: tip Duplicate Handling
PayIn automatically skips duplicate addresses during import. If an address already exists in the pool, it won't be imported again.
:::

### Import via API

For automation or programmatic imports, use the Address Pool API.

**Endpoint**: `POST /api/v1/address-pool/import`

**Authentication**: Requires an operator API key or CLI credentials for your deployment

**Request**:

```typescript
import fs from 'fs';

const csvContent = fs.readFileSync('evm-addresses-2025-01-20-full.csv', 'utf8');

const response = await fetch('https://your-payin.example.com/api/v1/address-pool/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  },
  body: JSON.stringify({
    protocol: 'evm',
    mode: 'hd_wallet', // or 'self_managed'
    addresses: csvContent
  })
});

const result = await response.json();
console.log('Import result:', result);
```

**Response**:

```json
{
  "success": true,
  "imported": 1000,
  "skipped": 0,
  "errors": [],
  "summary": {
    "protocol": "evm",
    "mode": "hd_wallet",
    "derivation_range": {
      "start": 0,
      "end": 999
    },
    "master_public_key": "xpub6CUGRUonZSQ4TWUJKy..."
  }
}
```

**Error Response** (400 Bad Request):

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "line": 42,
      "address": "0xinvalid",
      "error": "Invalid EVM address format"
    }
  ]
}
```

**Python Example**:

```python
import requests

with open('evm-addresses-2025-01-20-full.csv', 'r') as f:
    csv_content = f.read()

response = requests.post(
    'https://your-payin.example.com/api/v1/address-pool/import',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {os.getenv("PAYIN_API_KEY")}'
    },
    json={
        'protocol': 'evm',
        'mode': 'hd_wallet',
        'addresses': csv_content
    }
)

result = response.json()
print(f"Imported: {result['imported']} addresses")
```

### Batch Import Strategy

For large address pools (10,000+ addresses), use batch imports:

**Strategy**:

1. **Generate in Batches**: Create CSV files with 1000-5000 addresses each
2. **Sequential Import**: Import batches sequentially to avoid timeout
3. **Verify After Each**: Check pool statistics after each batch
4. **Track Progress**: Maintain a log of imported batches

**Example Batch Workflow**:

```bash
# Batch 1: Addresses 0-999
npm start
# Generate: start=0, count=1000
# Export: evm-batch-1.csv

# Batch 2: Addresses 1000-1999
npm start
# Generate: start=1000, count=1000
# Export: evm-batch-2.csv

# Batch 3: Addresses 2000-2999
npm start
# Generate: start=2000, count=1000
# Export: evm-batch-3.csv

# Import each batch via operator API/CLI
```

## Address Lifecycle Management

Understanding how addresses move through different states helps you manage the pool effectively.

### Order Payment Lifecycle

**Scenario**: User creates an order to pay 100 USDT

```
Step 1: Order Creation
─────────────────────────────────────────────────────────────
POST /api/v1/orders
{
  "orderReference": "ORDER-2025-001",
  "amount": "100",
  "currency": "USDT",
  "chainId": "ethereum-sepolia"
}

↓ PayIn allocates address from pool

Response:
{
  "orderId": "ord_abc123",
  "paymentAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "status": "pending"
}

Address State: available → allocated
```

```
Step 2: User Pays
─────────────────────────────────────────────────────────────
User sends 100 USDT to 0x742d35...

↓ PayIn monitor detects transaction
↓ Waits for confirmations (default: 3 blocks)
↓ Order completes

Webhook Event: order.completed

Address State: allocated (still held)
```

```
Step 3: Address Release
─────────────────────────────────────────────────────────────
After order completion, PayIn automatically:
1. Releases address from order
2. Sets cooldown period (30 minutes)
3. Address enters cooldown state

Address State: allocated → cooldown
```

```
Step 4: Return to Pool
─────────────────────────────────────────────────────────────
After cooldown expires (30 minutes):
- Address becomes available again
- Can be allocated to new orders
- Prioritized by LRU (least recently used)

Address State: cooldown → available
```

**Timeline**:

```
Order Created ────→ Payment Sent ────→ Order Completed ────→ Cooldown Expires
     ↓                    ↓                    ↓                     ↓
  allocated          allocated             cooldown              available
     0s               ~3 min              ~3 min 30s            ~33 min 30s
```

### Deposit Address Lifecycle

**Scenario**: User wants a permanent deposit address

```
Step 1: Address Binding
─────────────────────────────────────────────────────────────
POST /api/v1/deposits/references
{
  "depositReference": "user_alice_123",
  "currency": "USDT",
  "chainId": "polygon-amoy"
}

↓ PayIn allocates and binds address

Response:
{
  "depositReference": "user_alice_123",
  "address": "0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B",
  "protocol": "evm"
}

Address State: available → bound
```

```
Step 2: Multiple Deposits
─────────────────────────────────────────────────────────────
User can deposit multiple times to the same address:

Deposit 1: 50 USDT  → Creates deposit record
Deposit 2: 100 USDT → Creates another deposit record
Deposit 3: 25 USDT  → Creates another deposit record

Each deposit:
- Triggers webhook: deposit.completed (after required confirmations)
- Records amount and transaction
- Address remains bound

Address State: bound (permanent)
```

```
Step 3: Address Unbinding (Optional)
─────────────────────────────────────────────────────────────
If user closes account or stops using service:

DELETE /api/v1/deposits/references/user_alice_123

↓ PayIn unbinds address
↓ Sets cooldown period (30 minutes)

Address State: bound → cooldown → available
```

**Timeline**:

```
Binding ────→ Deposit 1 ────→ Deposit 2 ────→ ... ────→ Unbind ────→ Cooldown ────→ Available
   ↓             ↓                ↓                           ↓            ↓              ↓
 bound         bound            bound                     cooldown      cooldown      available
   0s           Hours           Days                       ~0s         ~30 min        ~30 min
```

### LRU Allocation Strategy

PayIn uses **Least Recently Used (LRU)** algorithm to allocate addresses efficiently.

**Allocation Priority**:

```sql
-- 1. NEW ADDRESSES (never used)
WHERE recycled_at IS NULL
ORDER BY created_at ASC

-- 2. RECYCLED ADDRESSES (used before, cooled down)
WHERE recycled_at IS NOT NULL
  AND cooldown_until <= NOW()
ORDER BY recycled_at ASC
```

**Why LRU?**

1. **Fairness**: All addresses get equal usage over time
2. **Privacy**: Maximizes time between reuses
3. **Distribution**: Prevents hot addresses
4. **Monitoring**: Ensures old monitoring tasks clean up

**Example Allocation Sequence**:

```
Pool State:
- Address A: recycled_at = NULL (new)
- Address B: recycled_at = 2025-01-20 10:00 (used 2 hours ago)
- Address C: recycled_at = 2025-01-20 11:30 (used 30 min ago)
- Address D: recycled_at = NULL (new)

Allocation Order:
1. Address A (new address, created first)
2. Address D (new address, created second)
3. Address B (recycled, oldest)
4. Address C (recycled, newest)
```

## Address Pool Monitoring

Monitor your address pool health to ensure smooth payment operations.

### Pool Status API

Get real-time pool statistics:

**Endpoint**: `GET /api/v1/address-pool/status`

**Request**:

```typescript
const response = await fetch('https://your-payin.example.com/api/v1/address-pool/status', {
  headers: {
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  }
});

const status = await response.json();
console.log('Pool Status:', status);
```

**Response**:

```json
{
  "evm": {
    "total": 5000,
    "available": 4200,
    "allocated": 500,
    "bound": 250,
    "coolingDown": 50
  },
  "tron": {
    "total": 2000,
    "available": 1800,
    "allocated": 150,
    "bound": 40,
    "coolingDown": 10
  },
  "solana": {
    "total": 1000,
    "available": 950,
    "allocated": 30,
    "bound": 15,
    "coolingDown": 5
  }
}
```

### Pool Monitoring

Monitor the pool through the operator API/CLI, metrics, or a self-hosted console you build for your operators:

1. **Query Address Pool Stats**
   - Retrieve real-time statistics
   - Feed allocation data into your observability stack or console

2. **Pool Health Indicators**
   ```
   EVM Address Pool                          ● Healthy
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Total:        5,000 addresses
   Available:    4,200 (84%)  ▓▓▓▓▓▓▓▓░░
   Allocated:      500 (10%)  ▓▓░░░░░░░░
   Bound:          250 ( 5%)  ▓░░░░░░░░░
   Cooldown:        50 ( 1%)  ░░░░░░░░░░
   ```

3. **Low Inventory Warning**
   ```
   ⚠️ WARNING: Low Address Inventory

   EVM pool has only 120 available addresses (2.4%)

   Recommended actions:
   1. Generate more addresses immediately
   2. Import new batch to pool
   3. Review address allocation rate
   ```

### Monitoring Metrics

**Key Metrics to Track**:

| Metric | Description | Healthy Range | Action Threshold |
|--------|-------------|---------------|-----------------|
| **Available %** | Percentage of available addresses | > 50% | < 20% |
| **Allocation Rate** | Addresses allocated per hour | Varies | Trending up sharply |
| **Cooldown %** | Percentage in cooldown | < 5% | > 10% |
| **Bound Growth** | Rate of deposit binding | Varies | Unexpected spike |

### Low Inventory Alerts

Configure alerts to notify you when pool inventory is low.

**Operator Configuration**:

1. **Configure Address Pool Settings**
2. **Set Alert Thresholds through config/API**:
   ```
   Low Inventory Alert:
   ┌─────────────────────────────────┐
   │ EVM:    [200] addresses         │
   │ Tron:   [100] addresses         │
   │ Solana: [50]  addresses         │
   └─────────────────────────────────┘

   Notification Methods:
   ☑ Email
   ☑ Webhook
   ☐ SMS 
   ```

3. **Test Alert**:
   - Click "Send Test Alert"
   - Verify you receive notification

**Email Alert Example**:

```
Subject: [PayIn Alert] Low Address Pool Inventory

Dear PayIn User,

Your EVM address pool is running low:

Current Status:
- Available: 180 addresses (3.6%)
- Total Pool: 5,000 addresses
- Threshold: 200 addresses (4%)

Recommended Actions:
1. Generate 1,000+ new addresses using PayIn Address Tool
2. Import addresses via operator API/CLI
3. Review allocation patterns

View Details: https://your-payin.example.com/address-pool

—
PayIn Alert System
```

**Webhook Alert Payload**:

```json
{
  "type": "alert.address_pool_low",
  "timestamp": "2025-01-20T15:30:00Z",
  "data": {
    "protocol": "evm",
    "available": 180,
    "total": 5000,
    "percentage": 3.6,
    "threshold": 200
  }
}
```

### Proactive Pool Management

**Best Practices**:

1. **Monitor Daily**: Check pool status at least once per day
2. **Maintain Buffer**: Keep 50%+ addresses available
3. **Batch Generation**: Generate 1000+ addresses per batch
4. **Predictive Scaling**: Monitor allocation trends, add addresses proactively
5. **Protocol Balance**: Ensure adequate addresses for each protocol

**Monitoring Script Example**:

```typescript
// check-pool-health.ts
import { PayInClient } from '@payin/sdk';

const client = new PayInClient({
  apiKey: process.env.PAYIN_API_KEY,
  baseUrl: 'https://your-payin.example.com'
});

async function checkPoolHealth() {
  const status = await client.addressPool.getStatus();

  for (const [protocol, stats] of Object.entries(status)) {
    const availablePercent = (stats.available / stats.total) * 100;

    if (availablePercent < 20) {
      console.error(`❌ CRITICAL: ${protocol} pool at ${availablePercent.toFixed(1)}%`);
      // Send alert
    } else if (availablePercent < 50) {
      console.warn(`⚠️  WARNING: ${protocol} pool at ${availablePercent.toFixed(1)}%`);
      // Consider generating more
    } else {
      console.log(`✅ OK: ${protocol} pool at ${availablePercent.toFixed(1)}%`);
    }
  }
}

// Run every hour
setInterval(checkPoolHealth, 60 * 60 * 1000);
checkPoolHealth();
```

**Cron Job Setup**:

```bash
# Add to crontab (runs every 4 hours)
0 */4 * * * cd /path/to/scripts && node check-pool-health.js
```

## Self-Managed Address Import

For users who prefer to manage their own keys and addresses outside of the HD wallet system.

### Preparing Self-Managed Addresses

**Step 1: Generate Addresses**

Use your preferred wallet software:

```bash
# Using ethers.js (EVM)
import { Wallet } from 'ethers';

const addresses = [];
for (let i = 0; i < 1000; i++) {
  const wallet = Wallet.createRandom();
  addresses.push({
    address: wallet.address,
    privateKey: wallet.privateKey // Store securely, don't include in CSV!
  });
}

# Save private keys securely (encrypted file, hardware wallet, etc.)
# Export only addresses to CSV
```

```bash
# Using TronWeb (Tron)
import TronWeb from 'tronweb';

const addresses = [];
for (let i = 0; i < 1000; i++) {
  const account = await TronWeb.createAccount();
  addresses.push({
    address: account.address.base58,
    privateKey: account.privateKey // Store securely!
  });
}
```

**Step 2: Create CSV File**

Format for self-managed addresses:

```csv
address,protocol,derivation_index,master_public_key
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,evm,,
0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE,evm,,
0x9FF4e4b8a0451F7c8F7a1D8c1C6b5C2d3E4f5A6B,evm,,
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,tron,,
TPJRnELdwXLWVvokPJyT3CHPF4YPKVkrSU,tron,,
```

**Key Points**:
- Leave `derivation_index` and `master_public_key` empty
- Include only public addresses (never private keys!)
- One address per line
- Protocol must be `evm`, `tron`, or `solana`

**Step 3: Validate Addresses**

Before import, validate addresses locally:

```typescript
// validate-addresses.ts
import { isAddress } from 'ethers';
import fs from 'fs';
import csv from 'csv-parse/sync';

const content = fs.readFileSync('self-managed-addresses.csv', 'utf8');
const records = csv.parse(content, { columns: true });

let errors = 0;
for (const [index, record] of records.entries()) {
  if (record.protocol === 'evm' && !isAddress(record.address)) {
    console.error(`Line ${index + 2}: Invalid EVM address: ${record.address}`);
    errors++;
  }
  // Add validation for Tron and Solana addresses
}

if (errors === 0) {
  console.log('✅ All addresses are valid');
} else {
  console.error(`❌ Found ${errors} invalid addresses`);
  process.exit(1);
}
```

### Import Process

**Via Operator API/CLI**:

1. Call the address-pool import endpoint or CLI command
2. Set import mode to **"Self-Managed Import"**
3. Submit the CSV file or CSV content
4. Review the import summary
5. Confirm imported and skipped counts

**Via API**:

```typescript
const csvContent = fs.readFileSync('self-managed-addresses.csv', 'utf8');

const response = await fetch('https://your-payin.example.com/api/v1/address-pool/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`
  },
  body: JSON.stringify({
    protocol: 'evm',
    mode: 'self_managed',
    addresses: csvContent
  })
});

const result = await response.json();
console.log(`Imported ${result.imported} self-managed addresses`);
```

### Security Considerations

**Self-Managed Mode Responsibilities**:

1. **Private Key Management**
   - Store private keys securely (hardware wallet, encrypted storage)
   - Never include private keys in CSV imports
   - Implement key rotation strategy
   - Backup keys in multiple secure locations

2. **Address Tracking**
   - Maintain your own mapping of addresses to keys
   - Document address generation method
   - Track which addresses are imported to PayIn

3. **Recovery Planning**
   - Document key recovery procedures
   - Test recovery process regularly
   - Ensure successors can access keys if needed

::: danger Critical: Private Key Security
PayIn NEVER asks for or stores your private keys. If someone asks for your private keys claiming to be from PayIn, it's a scam. Only import public addresses to PayIn.
:::

## Best Practices

### For HD Wallet Mode

**Security Best Practices**:

1. **Mnemonic Storage**
   - ✅ Write on paper, store in safe/vault
   - ✅ Create multiple backups in separate locations
   - ✅ Use metal backup plates for fire/water resistance
   - ✅ Consider Shamir's Secret Sharing for enterprise
   - ❌ Never store digitally (computer, phone, cloud)
   - ❌ Never take photos
   - ❌ Never share with anyone

2. **Generation Environment**
   - ✅ Use offline/air-gapped computer for generation
   - ✅ Verify tool integrity (checksum, signature)
   - ✅ Disconnect network during generation
   - ❌ Don't generate on shared/public computers

3. **Verification**
   - ✅ Verify first few addresses after import
   - ✅ Test small payment before production use
   - ✅ Document derivation paths used

**Operational Best Practices**:

4. **Batch Management**
   - Generate addresses in batches (1000-5000)
   - Track derivation ranges (0-999, 1000-1999, etc.)
   - Document batch imports with dates
   - Maintain batch generation logs

5. **Pool Sizing**
   - Maintain 50%+ available addresses
   - Generate new batches proactively
   - Monitor allocation rate trends
   - Scale before running low

6. **Traceability**
   - Keep records of all imports (batch files, dates)
   - Document master public keys
   - Track derivation index ranges
   - Audit pool regularly

### For Self-Managed Mode

**Key Management**:

1. **Private Key Security**
   - Use hardware wallets when possible
   - Encrypt private key storage
   - Implement access controls
   - Regular security audits

2. **Address Generation**
   - Use reputable wallet software
   - Verify address formats before import
   - Check for duplicates
   - Document generation method

3. **Backup Strategy**
   - Multiple secure backups
   - Geographic distribution
   - Regular backup verification
   - Documented recovery procedures

**Import Best Practices**:

4. **Validation**
   - Validate all addresses before import
   - Check for format errors
   - Verify no duplicates
   - Test small batch first

5. **Documentation**
   - Maintain address-to-key mapping
   - Document import dates and batches
   - Track which addresses are in PayIn
   - Record any address rotation

### General Best Practices

**Pool Management**:

1. **Monitoring**
   - Check pool status daily
   - Set up low inventory alerts
   - Monitor allocation patterns
   - Track cooldown rates

2. **Maintenance**
   - Regular pool audits
   - Review address states
   - Clean up stale bindings
   - Update cooldown configuration as needed

3. **Scaling**
   - Monitor business growth
   - Scale proactively
   - Plan for peak periods
   - Maintain adequate buffer

**Security**:

4. **Access Control**
   - Limit who can import addresses
   - Use API keys with appropriate permissions
   - Audit import activities
   - Monitor unauthorized access attempts

5. **Address Privacy**
   - Don't reuse addresses unnecessarily
   - Respect cooldown periods
   - Consider unbinding unused deposit addresses
   - Rotate address pools periodically

**Operational**:

6. **Testing**
   - Test address allocation on testnet first
   - Verify import process works correctly
   - Test pool exhaustion scenarios
   - Practice emergency procedures

7. **Documentation**
   - Document your address management process
   - Keep import logs
   - Maintain runbooks for common tasks
   - Train team members

## Security Considerations

### Mnemonic Security

**Critical**: Your mnemonic phrase is the master key to all addresses generated from it.

**Threat Model**:

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Physical Theft** | Attacker gains full access | Multiple secure locations, split storage |
| **Digital Exposure** | Malware/hacking access | Never store digitally, offline generation |
| **Social Engineering** | Tricked into revealing | Education, verification procedures |
| **Loss/Destruction** | Permanent loss of access | Multiple backups, metal plates |

**Defense in Depth**:

```
Layer 1: Offline Generation
- Generate on air-gapped computer
- Use verified, open-source tools
- Disconnect network during generation

Layer 2: Physical Security
- Store in safe/vault
- Multiple geographic locations
- Fire/water resistant containers

Layer 3: Access Control
- Limit who knows where mnemonic is stored
- Multi-person access requirements (for enterprises)
- Regular security reviews

Layer 4: Backup Strategy
- Multiple copies
- Different formats (paper, metal)
- Different locations
- Regular verification
```

### Address Validation

**Import Validation**:

PayIn performs comprehensive validation during address import:

1. **Format Validation**
   - EVM: Checksummed address format (0x + 40 hex chars)
   - Tron: Base58 format starting with 'T'
   - Solana: Base58 format (32-44 chars)

2. **Duplicate Detection**
   - Checks against existing pool addresses
   - Prevents duplicate imports
   - Validates within CSV file

3. **Protocol Consistency**
   - Ensures address matches specified protocol
   - Detects format mismatches
   - Validates derivation data consistency

**Blacklist Checking**:

::: tip Future Feature
PayIn is planning to add support for address blacklist checking against known malicious addresses. This will help prevent importing compromised addresses.
:::

For now, implement your own blacklist checking:

```typescript
// check-blacklist.ts
import fs from 'fs';
import csv from 'csv-parse/sync';

// Load blacklist from public sources
const blacklist = new Set([
  '0x...',  // Known scam addresses
  // Add more
]);

const addresses = csv.parse(
  fs.readFileSync('addresses.csv', 'utf8'),
  { columns: true }
);

for (const record of addresses) {
  if (blacklist.has(record.address.toLowerCase())) {
    console.error(`❌ Blacklisted address found: ${record.address}`);
    process.exit(1);
  }
}

console.log('✅ No blacklisted addresses found');
```

### Import Verification

After importing addresses, verify the import was successful:

**Verification Steps**:

1. **Check Pool Statistics**
   ```typescript
   const status = await client.addressPool.getStatus();
   console.log(`Total EVM addresses: ${status.evm.total}`);
   // Should match expected count
   ```

2. **Spot Check Addresses**
   ```typescript
   // Verify random addresses from your import exist in pool
   const response = await client.addressPool.listAddresses({
     protocol: 'evm',
     page: 1,
     pageSize: 10
   });

   // Check if addresses from your CSV appear
   ```

3. **Test Allocation**
   ```typescript
   // Create a test order to verify allocation works
   const order = await client.orders.create({
     orderReference: 'TEST-VERIFICATION',
     amount: '1',
     currency: 'USDT',
     chainId: 'ethereum-sepolia'
   });

   // Verify allocated address is from your imported set
   console.log(`Allocated address: ${order.paymentAddress}`);
   ```

### Audit Logging

PayIn maintains comprehensive audit logs for address pool operations:

**Logged Events**:

- Address imports (who, when, how many)
- Address allocations (order/deposit)
- Address releases
- Address bindings/unbindings
- Pool configuration changes

**Accessing Audit Logs**:

```typescript
const logs = await client.addressPool.getAuditLogs({
  startDate: '2025-01-20',
  endDate: '2025-01-21',
  eventType: 'import'
});

for (const log of logs.entries) {
  console.log(`${log.timestamp}: ${log.eventType} by ${log.user} - ${log.count} addresses`);
}
```

## Troubleshooting

### Common Issues

#### 1. Import Failed: "Invalid address format"

**Cause**: Address doesn't match the expected format for the protocol.

**Solution**:

```bash
# Validate EVM addresses
import { isAddress } from 'ethers';
console.log(isAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')); // true

# Ensure addresses are checksummed
import { getAddress } from 'ethers';
const checksummed = getAddress('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
console.log(checksummed); // 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
```

#### 2. Import Failed: "Duplicate addresses found"

**Cause**: Addresses already exist in the pool or appear multiple times in CSV.

**Solution**:

```typescript
// Check for duplicates in CSV
const addresses = records.map(r => r.address.toLowerCase());
const unique = new Set(addresses);
if (addresses.length !== unique.size) {
  console.error('CSV contains duplicate addresses');
}

// Check against existing pool
const existing = await client.addressPool.checkAddresses(addresses);
console.log(`${existing.duplicates.length} addresses already in pool`);
```

#### 3. "No available addresses in pool"

**Cause**: All addresses are allocated, bound, or in cooldown.

**Solution**:

1. **Check Pool Status**:
   ```typescript
   const status = await client.addressPool.getStatus();
   console.log(status);
   ```

2. **Generate and Import More Addresses** (immediate fix)

3. **Review Allocation Pattern** (long-term fix):
   - Are orders expiring properly?
   - Are addresses being released?
   - Is cooldown period too long?
   - Is allocation rate higher than expected?

#### 4. Address Tool: "Invalid mnemonic phrase"

**Cause**: Mnemonic has typos, wrong word count, or invalid words.

**Solution**:

```bash
# Verify mnemonic word count (12 or 24)
echo "your mnemonic words here" | wc -w

# Check for typos in words (use BIP39 word list)

# Common mistakes:
# - Extra spaces between words
# - Wrong word order
# - Words not in BIP39 list
```

#### 5. Verification: "Address not found in wallet"

**Cause**: Address doesn't belong to the mnemonic, or search range is too small.

**Solution**:

```bash
# Increase search range
? Search range: 5000  # Instead of default 1000

# Verify you're using correct:
# - Mnemonic phrase
# - Protocol (EVM vs Tron vs Solana)
# - Derivation path
```

#### 6. Low Pool Performance

**Cause**: Too many addresses in cooldown, frequent allocation/release cycles.

**Solution**:

1. **Increase Pool Size**: More addresses = better performance
2. **Adjust Cooldown**: Reduce if not needed for your use case
   ```typescript
   await client.config.update({
     'address_pool.cooldown_minutes': 15  // Reduce from 30 to 15
   });
   ```
3. **Review Allocation Strategy**: Are you creating too many short-lived orders?

### Getting Help

If you encounter issues not covered here:

1. **Check API Logs**:
   - Review error responses
   - Check HTTP status codes
   - Look for detailed error messages

2. **Operator Diagnostics**:
   - Query address-pool status through the API/CLI
   - Check pool-health metrics
   - Review recent activity logs

3. **Contact Support**:
   - Email: support@payin.com
   - Include: pool statistics, error messages, CSV sample
   - Specify: protocol, import mode, environment (testnet/mainnet)

4. **Community**:
   - Discord: [discord.gg/payin](https://discord.gg/payin) 

## Next Steps

Now that you understand address management, explore these related topics:

### Essential Reading

- [Order Payment Service](/en/guide/order-payment) - Learn how orders use address pool
- [Deposit Service](/en/guide/deposit-service) - Learn how deposits use bound addresses
- [Security Guide](/en/guide/security) - Mnemonic and key security best practices

### API References

- [API Overview](/en/api/overview) - Available API surface, including address-pool endpoints
- [Orders API](/en/api/orders) - How orders allocate addresses
- [Deposits API](/en/api/deposits) - How deposits bind addresses

### Advanced Topics

- [Multi-Chain Strategy](/en/guide/multi-chain-strategy) - Managing addresses across chains
- [High Availability](/en/guide/high-availability) - Pool management for scale
- [Monitoring and Alerts](/en/guide/monitoring) - Production monitoring setup

### Tools

- [Address Pool Setup](/en/guide/address-pool-setup) - Headless address pool preparation and import workflow
- [CLI Tools](/en/guide/cli-tools) - Command-line address management

## Summary

**Key Takeaways**:

✅ **Address Pool** enables instant payment address assignment and efficient reuse

✅ **HD Wallet Mode** (recommended) uses BIP44 standard with full tooling support

✅ **Self-Managed Mode** provides flexibility for advanced users

✅ **LRU Allocation** ensures fair distribution and privacy protection

✅ **Cooldown Period** (30 min) protects privacy and allows settlement

✅ **Monitoring** is critical - maintain 50%+ available addresses

✅ **Security** requires proper mnemonic storage and validation

**Quick Reference**:

| Task | Tool/Method | Time Required |
|------|------------|---------------|
| Generate 1000 addresses | PayIn Address Tool | ~2 minutes |
| Import addresses | Operator API/CLI | ~1 minute |
| Check pool status | Operator API/CLI | Instant |
| Allocate address | Automatic (API call) | < 100ms |
| Release address | Automatic (order completion) | < 100ms |

**Production Checklist**:

- [ ] Mnemonic generated and securely stored (multiple backups)
- [ ] Addresses generated for all needed protocols (EVM, Tron, Solana)
- [ ] Addresses imported to PayIn (verified via pool status)
- [ ] Low inventory alerts configured
- [ ] Pool monitoring set up (daily checks or automated)
- [ ] Team trained on address generation process
- [ ] Emergency procedures documented
- [ ] Backup generation capability established

You're now ready to manage addresses efficiently for your PayIn payment infrastructure!
