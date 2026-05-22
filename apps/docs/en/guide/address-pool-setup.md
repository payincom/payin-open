# Address Pool Setup

Quick start guide to using PayIn's address pool system - from generating addresses to importing and using them.

## Overview

**Address Pool** is the core design of PayIn's **non-custodial payment** system. Unlike traditional payment platforms, PayIn doesn't hold your funds - all payments go directly to wallet addresses that you control.

### 💎 Advantages of Non-Custodial Payment

- 🔐 **Full Control**: You own the private keys (mnemonic), you control the funds
- 💰 **Instant Settlement**: Payments go directly to your addresses, no platform transfers
- 🛡️ **Zero Risk**: PayIn cannot access your funds, eliminating platform risk
- 🚀 **Flexible Scale**: More business? Just prepare more addresses

::: tip What is an Address Pool?
**Address Pool** is a collection of blockchain receiving addresses that you pre-generate. PayIn dynamically allocates addresses from this pool for order payments and user deposits, but the private keys to these addresses are always under your control.

Benefits of using an address pool:
- ⚡ **Instant Allocation**: No waiting for address generation
- 🔄 **Address Reuse**: Addresses are automatically recycled after order completion (with cooldown protection)
- 🌐 **Multi-Chain Support**: Unified management of addresses across EVM, Tron, Solana chains
:::

### 🔑 Relationship Between Mnemonic and Wallet Addresses

A **mnemonic phrase** (typically 12 or 24 English words) is the "master key" to your wallet:

```
Mnemonic (1 set of 12 words)
    ↓
Can generate unlimited wallet addresses
    ↓
Address #0: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Address #1: 0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC
Address #2: 0x1234567890123456789012345678901234567890
Address #3: ...
Address #100: ...
    ↓
All address funds are under your control
```

**Key Concepts**:
- ✅ **One mnemonic** → can derive thousands of addresses
- ✅ **All address funds** → controlled by the same mnemonic
- ✅ **Backup mnemonic** → equals backing up all address private keys
- ⚠️ **Lose mnemonic** → funds in all addresses will be lost forever

::: warning Security Alert
Your mnemonic is the sole credential to all your funds. Please ensure:
- 📝 Write it on paper, store in a safe place (safe, bank vault)
- 🚫 Don't screenshot, don't save on computer or cloud
- 🚫 Don't tell anyone, including the PayIn team
- ✅ Recommended to keep multiple backups in different locations
:::

## Quick Start (Recommended)

If you're using PayIn for the first time, we recommend these quick ways to generate addresses:

### 🌐 Method 1: Use Online Tool (Fastest)

Visit **[wallet-tool.payin.com](https://wallet-tool.payin.com)** to generate addresses online:

1. **Open Browser Private Mode** (Recommended)
   - Chrome/Edge: `Ctrl+Shift+N` (Windows) or `⌘+Shift+N` (Mac)
   - Firefox: `Ctrl+Shift+P` (Windows) or `⌘+Shift+P` (Mac)
   - Safari: `⌘+Shift+N` (Mac)

2. **Visit the Tool Website**
   Open [https://wallet-tool.payin.com](https://wallet-tool.payin.com)

3. **Generate Mnemonic**
   - Click "Generate New Mnemonic" button
   - **Safely backup** the 12-word mnemonic (write on paper, store in a secure place)
   - Check "I have safely backed up my mnemonic"

4. **Select Protocol**
   - Choose the blockchain protocol you need (EVM / Tron / Solana)
   - EVM protocol supports: Ethereum, Polygon, BSC and other EVM-compatible chains

5. **Generate Addresses**
   - Set starting index (usually 0)
   - Set quantity to generate (recommended 50-100)
   - Click "Generate Addresses"

6. **Export CSV**
   - Click "Download CSV" button
   - Save file locally (e.g., `addresses-evm.csv`)

::: warning Security Reminder
- ⚠️ Online tool is for **test environment** only
- ⚠️ Mnemonic is generated locally in your browser, not sent to server
- ⚠️ Using private mode prevents browser from caching the mnemonic
- ⚠️ **For production use offline method** (see Method 2)
:::

### 💻 Method 2: Use Local Wallet Software (Most Secure)

Suitable for production environments, requires some technical knowledge:

#### MetaMask (Recommended for Testing)

1. **Install MetaMask Browser Extension**
   Download from [metamask.io](https://metamask.io)

2. **Create New Wallet**
   - Generate and backup 12-word mnemonic
   - Set password

3. **Export Addresses**
   - Create multiple accounts (click account avatar → Create Account)
   - Copy each account's address
   - Manually create CSV file

#### Hardware Wallet (Recommended for Production)

**Ledger / Trezor hardware wallets** provide the highest security level:

- ✅ **Private Key Security**: Private keys never leave the hardware device
- ✅ **Tamper-Proof**: Hardware-level protection
- ✅ **Production Ready**: Manage large funds
- ✅ **Multi-Chain**: EVM, Tron and other mainstream chains

For detailed instructions, refer to hardware wallet official documentation.

### 📱 Method 3: Use Mobile Wallets

**Trust Wallet**, **imToken** and other mobile wallets:

1. Download wallet app from app store
2. Create new wallet and backup mnemonic
3. Create multiple accounts
4. Export address list

::: tip Recommended Combinations
- **Test Environment**: Use wallet-tool.payin.com for quick generation
- **Small-Scale Production**: Use MetaMask or mobile wallets
- **Large-Scale Production**: Use Ledger/Trezor hardware wallets
:::

## Import Addresses to PayIn

Regardless of which method you use to generate addresses, import them into PayIn Open through the operator API/CLI, or through a self-hosted console you build on top of those APIs:

### Step 1: Prepare Address List

PayIn supports two ways to import addresses:

#### Method A: CSV File (Recommended)

Create a CSV file, can include derivation index information:

**Basic Format** (Address only):
```csv
address
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC
0x1234567890123456789012345678901234567890
```

**Complete Format** (HD Wallet - Including derivation index):
```csv
address,derivation_index
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,0
0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC,1
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,0
TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t,1
```

::: tip CSV Format Description

**Required Fields**:
- `address`: Wallet address (required)

**Optional Fields**:
- `derivation_index`: HD wallet derivation index (optional, recommended)
  - Tracks which index the address was derived from the mnemonic
  - Helps prevent duplicate address generation
  - Can be omitted if using independently generated addresses

**Format Support**:
- **Basic Format**: Address only (one per line)
- **Complete Format**: `address,derivation_index` (CSV with header)

**Other Notes**:
- If using CSV format, first line must be header (`address` or `address,derivation_index`)
- Starting from second line, one address per line
- Protocol is selected in the import request or CLI flags, not in the CSV file
- PayIn automatically validates address formats
:::

#### Method B: Copy and Paste

If you build a self-hosted console, you can also support pasting an address list, one address per line:

```
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC
0x1234567890123456789012345678901234567890
```

No header needed, just paste addresses directly. Addresses imported this way will not include derivation index information.

### Step 2: Authenticate as an Operator

1. Open your self-hosted console, or use the address-pool import API/CLI
2. Authenticate with an API key or operator session
3. Select the Open merchant/business scope for your deployment

### Step 3: Import Addresses

1. **Enter Address Pool Page**
   Sidebar navigation → Address Pool

2. **Select Protocol Type**
   Choose the protocol for addresses to import: EVM, Tron or Solana

3. **Choose Import Method**

   **Method A: Upload CSV File**
   - Click "Upload CSV" button
   - Select or drag your CSV file

   **Method B: Paste Addresses**
   - Click "Paste Addresses" button
   - Paste address list in text box (one per line)

4. **Check Preview**
   - View the list of addresses to be imported
   - Confirm protocol type and quantity
   - System will automatically validate address format

5. **Confirm Import**
   - Click "Confirm Import"
   - Wait for completion (large batches may take a few seconds)

6. **Verify Import**
   - Check address pool statistics
   - Confirm "Available" address count has increased

::: tip Import Success
After successful import, you'll see newly imported addresses in the Address Pool page with "available" status, ready to be used for order payments and user deposits.
:::

## Address Quantity Planning

Choosing the right number of addresses is important for ensuring stable payment system operation.

### Order Payment Business

For **Order Payment** scenarios, addresses are automatically reused:

| Address Count | Daily Order Capacity | Use Cases |
|--------------|---------------------|-----------|
| **5** | ~160 orders/day | Small tests, personal projects |
| **20** | ~640 orders/day | Small merchants, startups |
| **100** | ~3,200 orders/day | Medium e-commerce, gaming platforms |
| **500** | ~16,000 orders/day | Large platforms, high-frequency trading |

::: details Calculation Explanation
Address reuse mechanism:
- **Order lifecycle**: Payment window (10 mins) + Grace period (5 mins) = 15 mins
- **Cooldown period**: Need 30 mins cooldown after order completion before reallocation
- **Complete cycle**: 15 + 30 = 45 mins
- **Daily uses**: 1440 mins ÷ 45 mins = 32 times/day/address

Example: 5 addresses × 32 times/day = 160 orders/day

**Note**: Actual capacity may vary due to order completion speed, expired orders, etc. Recommended to keep 20% buffer.
:::

### User Deposit Business

For **User Deposit** scenarios, each user needs a permanent address:

| User Count | Required Addresses | Description |
|-----------|-------------------|-------------|
| 100 users | 100 addresses | Each user binds one deposit address |
| 1,000 users | 1,000 addresses | One-to-one mapping between addresses and users |
| 10,000 users | 10,000 addresses | Scale address pool as needed |

::: tip What is User Deposit?
**User Deposit** is a feature that permanently assigns a dedicated deposit address to each user of your external system. Users can transfer multiple times to this address for deposits, and each deposit is automatically recorded to the user's account.

Use cases:
- Game platform game coin deposits
- Exchange fund deposits
- Wallet application balance deposits

For detailed introduction, see: [User Deposit Service Guide](./deposit-service)
:::

### Mixed Business Scenarios

If running both order payment and user deposit businesses simultaneously:

**Example**: A medium-sized gaming platform
- **Order Payment**: 500 item purchase orders/day → Need ~20 addresses
- **User Deposits**: 5,000 active players → Need 5,000 addresses
- **Total**: ~5,020 addresses

::: warning Important Reminder
- Order addresses and deposit addresses are automatically allocated, no manual distinction needed
- Once deposit addresses are bound to users, they are permanently occupied and not released
- Recommended to reserve 10-20% address buffer for business growth
:::

## CSV Format Examples

### Basic Format (Address Only)

Suitable for addresses manually created from MetaMask, mobile wallets, etc.:

```csv
address
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC
0x1234567890123456789012345678901234567890
```

### Complete Format (Including Derivation Index)

Recommended, suitable for addresses generated from address-tool or HD wallet:

**EVM Address Example**:
```csv
address,derivation_index
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,0
0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC,1
0xdAC17F958D2ee523a2206206994597C13D831ec7,2
0x9876543210987654321098765432109876543210,3
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,4
```

**Tron Address Example**:
```csv
address,derivation_index
TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS,0
TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t,1
TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9,2
```

**Solana Address Example**:
```csv
address,derivation_index
7xVq3CzVvVx4Qn8h9kLQn8qZKq8KqVq3h7xVq3CzVvVx4,0
DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK,1
9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM,2
```

::: tip Why Include Derivation Index?
**Derivation index** records which position the address was derived from the mnemonic:

**Advantages**:
- ✅ **Traceability**: Know which index each address corresponds to in the mnemonic
- ✅ **Easy Management**: Can regenerate addresses in index order
- ✅ **Prevent Duplicates**: When generating new addresses next time, start from max index + 1
- ✅ **Disaster Recovery**: If wallet recovery is needed, can accurately reproduce all addresses

**Example**:
- First batch generates 100 addresses (index 0-99)
- Second batch starts from index 100, avoiding duplicates
:::

::: warning Note on Mixed Protocols
When importing addresses from multiple protocols, import them separately for each protocol:
1. First, select EVM protocol and import EVM addresses
2. Then, select Tron protocol and import Tron addresses
3. Finally, select Solana protocol and import Solana addresses

**Derivation index is protocol-specific**: Different protocols have different derivation paths, so:
- EVM address index 0 and Tron address index 0 are two different addresses
- Each protocol maintains its own independent index sequence
:::

## FAQ

### Q: How many addresses should I generate?

**Answer depends on your business type**:

**Order Payment Only**:
- Refer to the order payment table in "Address Quantity Planning" above
- Choose appropriate quantity based on estimated daily order volume
- Recommended to keep 20% buffer

**User Deposit Only**:
- Number of addresses = number of users
- Prepare addresses based on actual user scale
- Can import in batches, gradually supplement as users grow

**Mixed Business**:
- Order address quantity (reusable) + User deposit address quantity (permanently occupied)
- Refer to "Mixed Business Scenarios" example above

::: tip Dynamic Replenishment
PayIn supports importing new addresses anytime. Recommended to keep at least 20% available addresses in the pool, replenish promptly when available addresses are low.
:::

### Q: Can addresses be reused?

**Yes**, PayIn uses intelligent address reuse mechanism:

- ✅ **Order Addresses**: After order completion, addresses return to pool after 30-minute cooldown
- ✅ **Cooldown Protection**: Prevents immediate reuse, protecting privacy and security
- ✅ **Deposit Addresses**: Permanently bound to users, not recycled

### Q: How to ensure mnemonic security?

**Security Practices**:

1. ✅ **Offline Generation**: Use offline computer or hardware wallet for production
2. ✅ **Physical Backup**: Write mnemonic on paper, store in safe
3. ✅ **Multiple Backups**: Keep multiple backups in different locations
4. ❌ **Prohibit**: Don't screenshot, don't save on computer or cloud, don't tell anyone

::: danger Important Reminder
Mnemonic equals all address private keys. Anyone who gets the mnemonic can control funds in all addresses. Please keep it safe!
:::

### Q: Is wallet-tool.payin.com secure?

**Security Features**:

- ✅ All operations complete locally in browser, mnemonic not sent to server
- ✅ Open source code, can be audited
- ✅ Recommended to use private mode to prevent browser caching

**Limitations**:

- ⚠️ Only recommended for **test environment**
- ⚠️ Production environments should use **offline methods** or **hardware wallets**

### Q: Can I delete addresses after importing?

**Address Status and Deletion**:

- ✅ **available**: Can delete
- ⚠️ **allocated**: Wait for order completion before deleting
- ⚠️ **bound**: Need to unbind before deleting
- ❌ **Not Recommended**: Unless private key is lost or security issue

### Q: Can multiple business scopes share addresses?

**No**. Keep each business/API-key scope on its own address pool:

- ❌ Addresses should not be shared between scopes
- ✅ Each scope independently manages its own address pool
- ✅ Ensures business data and funds are completely isolated

## Next Steps

After address pool setup is complete, you can:

1. 📝 [Create Order Payment](./order-payment) - Start accepting cryptocurrency payments
2. 💰 [Configure User Deposits](./deposit-service) - Provide deposit service for users
3. 🔔 [Set Up Webhook Notifications](./webhooks) - Receive payment notifications
4. 🔗 [Payment Links](./payment-links) - Cloud-only hosted links, or build an Open link flow with the Order Payment API

## Advanced Topics

Want to learn more about the address management system? See:

- 📖 [Address Management In-Depth](./address-management) - Complete address pool concepts, state management and workflows
- 🔧 [API Integration](./api-integration) - Manage address pool via API
- 🔐 [Security Best Practices](./security) - Key management and security recommendations
