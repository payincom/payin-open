# Supported Tokens

PayIn supports major stablecoins across multiple blockchain networks. All supported tokens are USD-pegged stablecoins, providing price stability for payment transactions.

## Overview

| Token | Full Name | Decimals | Supported Networks | Status |
|-------|-----------|----------|-------------------|--------|
| **USDC** | USD Coin | 6 | Ethereum, Polygon, Solana | ✅ Active |
| **USDT** | Tether USD | 6 | Ethereum, Polygon, Tron | ✅ Active |
| **DAI** | Dai Stablecoin | 18 | Ethereum, Polygon | 🚧 Coming Soon |
| **USD1** | USD1 | 18 | Multiple chains | 🚧 Coming Soon |

## Token Details

### USDC (USD Coin)

USD Coin is a fully-reserved stablecoin issued by Circle, pegged 1:1 to the US Dollar.

**Key Features:**
- 🏦 Issued by Circle (regulated financial institution)
- ✅ Monthly attestations by independent auditors
- 🌐 Wide adoption across DeFi and CEXs
- 💰 Backed by cash and short-term US Treasury bonds

**Decimals:** 6 (1 USDC = 1,000,000 units)

#### Testnet Contracts

| Network | Contract Address | Get Test Tokens |
|---------|-----------------|-----------------|
| **Ethereum Sepolia** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [Circle Testnet Faucet](https://faucet.circle.com/) |
| **Polygon Amoy** | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | [Polygon Faucet](https://faucet.polygon.technology/) |
| **Solana Devnet** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | [Solana Faucet](https://faucet.solana.com/) |

#### Mainnet Contracts

| Network | Contract Address | Block Explorer |
|---------|-----------------|----------------|
| **Ethereum** | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | [Etherscan](https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) |
| **Polygon** | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | [Polygonscan](https://polygonscan.com/token/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359) |
| **Solana** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | [Solscan](https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) |

**When to Use USDC:**
- Maximum regulatory compliance
- Institutional-grade transparency
- Multi-chain DeFi integrations
- Users who prefer Circle-backed stablecoins

---

### USDT (Tether USD)

Tether is the most widely circulated stablecoin, especially popular in Asia-Pacific markets.

**Key Features:**
- 🌏 Largest stablecoin by market cap and circulation
- 🔄 High liquidity on all major exchanges
- 💼 Popular for remittances and trading
- 🌐 Available on 10+ blockchain networks

**Decimals:** 6 (1 USDT = 1,000,000 units)

#### Testnet Contracts

| Network | Contract Address | Get Test Tokens |
|---------|-----------------|-----------------|
| **Tron Nile** | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` | [TronGrid Faucet](https://nileex.io/join/getJoinPage) |

::: tip Getting Testnet USDT
Most testnets don't have official USDT faucets. You may need to:
1. Get test native tokens (ETH, MATIC) from faucets
2. Use testnet DEXs to swap for test USDT
3. Or deploy your own test USDT contract for development
:::

#### Mainnet Contracts

| Network | Contract Address | Block Explorer |
|---------|-----------------|----------------|
| **Ethereum** | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | [Etherscan](https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7) |
| **Polygon** | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | [Polygonscan](https://polygonscan.com/token/0xc2132d05d31c914a87c6611c10748aeb04b58e8f) |
| **Tron** | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | [Tronscan](https://tronscan.org/#/token20/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t) |

**When to Use USDT:**
- Asia-Pacific markets
- Maximum liquidity requirements
- Tron network (most popular USDT chain)
- Users familiar with Tether

---

### DAI 

Decentralized stablecoin governed by MakerDAO.

**Key Features:**
- 🏛️ Fully decentralized and transparent
- 🔗 Collateralized by crypto assets
- 📊 On-chain transparency
- 🗳️ Community-governed

**Decimals:** 18

**Planned Support:**
- Ethereum Mainnet
- Polygon Mainnet
- Ethereum Sepolia (testnet)
- Polygon Amoy (testnet)

---

### USD1 

Next-generation stablecoin with enhanced features.

**Status:** Integration in progress

---

## Token Selection Guide

### By Use Case

| Use Case | Recommended Token | Reason |
|----------|------------------|---------|
| **General Payments** | USDC | Best balance of trust and adoption |
| **Asia-Pacific** | USDT | Most popular in the region |
| **DeFi Integration** | USDC or DAI | Wide DeFi support |
| **Low Fees** | USDT on Tron | Lowest transaction costs |
| **Institutional** | USDC | Regulated and audited |
| **Decentralization** | DAI | Community-governed |

### By Network

| Network | Available Tokens | Best Choice |
|---------|-----------------|-------------|
| **Ethereum** | USDC, USDT, DAI* | USDC (for high-value), USDT (for liquidity) |
| **Polygon** | USDC, USDT, DAI* | USDC (low fees + trusted) |
| **Tron** | USDT | USDT (only option, very popular) |
| **Solana** | USDC | USDC (only option, ultra-low fees) |

*DAI: Coming Soon

## Using Tokens in Your Integration

### With MCP Server

Simply specify the token symbol when creating orders or deposits:

```
Create a payment order:
- Amount: 100 USDC
- Chain: polygon-mainnet
```

```
Create a deposit address:
- User ID: user_12345
- Currency: USDT
- Chain: tron-mainnet
```

### With Direct API

**TypeScript Example:**

```typescript
// Create USDC order on Polygon
const orderResponse = await fetch(`${PAYIN_API_URL}/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    orderReference: 'ORDER-001',
    amount: '100.50',
    currency: 'USDC',           // Token symbol
    chainId: 'polygon-mainnet', // Network
    successUrl: 'https://yoursite.com/success',
    cancelUrl: 'https://yoursite.com/cancel'
  })
});

// Create USDT deposit on Tron
const depositResponse = await fetch(`${PAYIN_API_URL}/deposits`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    depositReference: 'user_12345',
    currency: 'USDT',        // Token symbol
    chainId: 'tron-mainnet'  // Network
  })
});
```

## Token Amounts and Decimals

### Understanding Decimals

Each token has a specific number of decimals:
- **USDC/USDT**: 6 decimals (1.000000)
- **DAI**: 18 decimals (1.000000000000000000)

**Important:** PayIn handles decimal conversion automatically. Always specify amounts in human-readable format (e.g., "100.50" for 100.50 USDC).

### Amount Format Examples

✅ **Correct:**
```typescript
amount: "100.50"    // 100.50 USDC/USDT
amount: "0.01"      // 0.01 USDC/USDT (1 cent)
amount: "1000"      // 1000 USDC/USDT
amount: "10.123456" // Maximum 6 decimals for USDC/USDT
```

❌ **Incorrect:**
```typescript
amount: 100.50        // Must be string, not number
amount: "100.5000001" // Too many decimals for USDC/USDT (max 6)
amount: "$100.50"     // No currency symbols
amount: "100,50"      // Use dot, not comma
```

### Minimum and Maximum Amounts

| Token | Minimum Amount | Maximum Amount | Notes |
|-------|---------------|----------------|-------|
| **USDC** | 0.01 (1 cent) | No limit | Practical limit depends on gas/fees |
| **USDT** | 0.01 (1 cent) | No limit | Tron has very high limits |
| **DAI** | 0.01 (1 cent) | No limit | Coming Soon |

::: tip Best Practice
For production, set your own minimum amounts based on your business logic and transaction costs. For example, setting a $5 minimum helps cover transaction fees.
:::

## Getting Tokens for Testing

### Testnet Tokens (Free)

1. **Get Native Tokens First:**
   - Ethereum Sepolia: [Get test ETH](https://sepoliafaucet.com/)
   - Polygon Amoy: [Get test MATIC](https://faucet.polygon.technology/)
   - Tron Nile: [Get test TRX](https://nileex.io/join/getJoinPage)
   - Solana Devnet: Use `solana airdrop` command

2. **Get Stablecoin Test Tokens:**
   - **USDC**: Use [Circle Testnet Faucet](https://faucet.circle.com/)
   - **USDT**: Swap test native tokens on testnet DEXs
   - **Or**: Deploy your own test ERC20 contract

### Mainnet Tokens (Real Money)

::: danger Real Money Required
Mainnet tokens have real value. You must purchase them from exchanges or receive them from others.
:::

**How to Get Mainnet Tokens:**

1. **Buy from Centralized Exchanges:**
   - Coinbase, Binance, Kraken, etc.
   - Buy USDC/USDT with fiat currency
   - Withdraw to your wallet on the desired network

2. **Use DEXs (Decentralized Exchanges):**
   - Uniswap (Ethereum)
   - QuickSwap (Polygon)
   - JustSwap (Tron)
   - Raydium (Solana)
   - Swap native tokens for stablecoins

3. **Peer-to-Peer:**
   - Receive from other wallets
   - Ensure correct network!

::: warning Network Verification
Always verify you're buying/receiving tokens on the **correct network**. USDC on Ethereum is different from USDC on Polygon. Sending to wrong network = lost funds.
:::

## Token Contract Verification

### How to Verify Contracts

Before integrating, verify token contracts on block explorers:

**Ethereum/Polygon (EVM):**
1. Visit Etherscan or Polygonscan
2. Search for contract address
3. Check "Contract" tab
4. Verify it's the official token contract
5. Check for verified source code

**Tron:**
1. Visit Tronscan
2. Search for contract address
3. Check token information
4. Verify it matches official Tether USDT

**Solana:**
1. Visit Solscan
2. Search for mint address
3. Verify it's the official Circle USDC mint

### Official Token Resources

- **USDC**: [circle.com/usdc](https://www.circle.com/en/usdc)
- **USDT**: [tether.to](https://tether.to/)
- **DAI**: [makerdao.com](https://makerdao.com/)

## Multi-Token Strategy

### For Order Payments

Let users **choose their preferred token and network**:

```typescript
// Present options to user
const paymentOptions = [
  { token: 'USDC', network: 'polygon-mainnet', fee: '$0.01' },
  { token: 'USDT', network: 'tron-mainnet', fee: '$1.00' },
  { token: 'USDC', network: 'ethereum-mainnet', fee: '$5-20' }
];

// Create order with user's selection
const order = await createOrder({
  orderReference: 'ORDER-001',
  amount: '100.00',
  currency: userSelectedToken,   // User's choice
  chainId: userSelectedNetwork    // User's choice
});
```

### For Deposit Services

Users can bind **multiple deposit addresses** for different tokens:

```typescript
// Bind USDT on Tron for user
await createDepositReference({
  depositReference: 'user_12345',
  currency: 'USDT',
  chainId: 'tron-mainnet'
});

// Bind USDC on Polygon for same user
await createDepositReference({
  depositReference: 'user_12345',
  currency: 'USDC',
  chainId: 'polygon-mainnet'
});

// Now user has 2 deposit addresses for different tokens
```

## Next Steps

- [API Integration Guide](/en/guide/api-integration) - Integrate with code
- [Quick Start with MCP](/en/guide/quick-start-mcp) - Use AI assistant
- [Supported Networks](/en/guide/supported-networks) - View all networks

## FAQs

**Q: What's the difference between USDC and USDT?**
USDC is issued by Circle (regulated US company) with monthly attestations. USDT is issued by Tether with the largest circulation. Both are pegged 1:1 to USD.

**Q: Can I accept multiple tokens for the same order?**
No, each order is for a specific token on a specific network. Users must pay exactly as specified. To support multiple options, create separate orders or let users choose before order creation.

**Q: What happens if a user sends the wrong token?**
If a user sends a different token to the payment address, those funds cannot be automatically credited. Manual recovery may be possible but is complex. Always display clear payment instructions.

**Q: What happens if a user sends the wrong amount?**
PayIn uses exact amount matching. If the amount doesn't match exactly, the order will not complete automatically. The user would need to contact support.

**Q: Do you support native tokens (ETH, MATIC, TRX)?**
No, PayIn currently only supports stablecoins (USDC, USDT, DAI). Native tokens are not supported.

**Q: When will DAI and USD1 be supported?**

**Q: Can I request support for a specific stablecoin?**
