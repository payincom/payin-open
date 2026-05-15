# Supported Networks

PayIn supports multiple blockchain networks across different protocols, providing flexibility for your payment integration. Each network has both testnet (for development) and mainnet (for production) versions.

## Network Overview

PayIn currently supports **4 blockchain protocols** across **8 networks**:

| Protocol | Testnet | Mainnet | Status |
|----------|---------|---------|--------|
| **EVM** | Ethereum Sepolia, Polygon Amoy | Ethereum, Polygon | ✅ Active |
| **Tron** | Tron Nile | Tron Mainnet | ✅ Active |
| **Solana** | Solana Devnet | Solana Mainnet | ✅ Active |
| **Bitcoin** | - | - | 🚧 Coming Soon |

## Testnet Networks

Testnet networks use test cryptocurrencies with no real value. Perfect for development and testing.

### Ethereum Sepolia

The official Ethereum testnet, replacing Goerli and Rinkeby.

| Property | Value |
|----------|-------|
| **Chain ID** | `ethereum-sepolia` |
| **Protocol** | EVM |
| **Network Type** | Testnet |
| **Block Confirmations** | 3 blocks (~36 seconds) |
| **Block Time** | ~12 seconds |
| **Block Explorer** | [sepolia.etherscan.io](https://sepolia.etherscan.io) |
| **Native Token** | Sepolia ETH (test token) |

**Getting Test ETH:**
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- [Chainlink Faucet](https://faucets.chain.link/sepolia)

**Supported Tokens:**
- USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

**RPC Providers:**
- Alchemy, Infura, PublicNode

**When to Use:**
- Testing Ethereum-based integrations
- Developing smart contract interactions
- Load testing with EVM transactions

---

### Polygon Amoy

The new Polygon testnet, replacing Mumbai.

| Property | Value |
|----------|-------|
| **Chain ID** | `polygon-amoy` |
| **Protocol** | EVM |
| **Network Type** | Testnet |
| **Block Confirmations** | 10 blocks (~20 seconds) |
| **Block Time** | ~2 seconds |
| **Block Explorer** | [amoy.polygonscan.com](https://amoy.polygonscan.com) |
| **Native Token** | Test MATIC |

**Getting Test MATIC:**
- [Polygon Faucet](https://faucet.polygon.technology/)
- [Alchemy Polygon Faucet](https://www.alchemy.com/faucets/polygon-amoy)

**Supported Tokens:**
- USDC: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

**RPC Providers:**
- Alchemy, Ankr, PublicNode

**When to Use:**
- Testing Layer 2 performance
- Low-cost high-volume testing
- Fast confirmation testing

---

### Tron Nile

Tron's official testnet for developers.

| Property | Value |
|----------|-------|
| **Chain ID** | `tron-nile` |
| **Protocol** | Tron |
| **Network Type** | Testnet |
| **Block Confirmations** | 3 blocks (~9 seconds) |
| **Block Time** | ~3 seconds |
| **Block Explorer** | [nile.tronscan.org](https://nile.tronscan.org) |
| **Native Token** | Test TRX |

**Getting Test TRX:**
- [TronGrid Nile Faucet](https://www.trongrid.io/shasta/)
- Note: Faucet may have daily limits

**Supported Tokens:**
- USDT: `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`

**RPC Providers:**
- TronGrid

**When to Use:**
- Testing Tron-based integrations
- USDT on Tron testing
- Energy/bandwidth optimization testing

---

### Solana Devnet

Solana's development network with fast finality.

| Property | Value |
|----------|-------|
| **Chain ID** | `solana-devnet` |
| **Protocol** | Solana |
| **Network Type** | Testnet |
| **Block Confirmations** | 1 block (~400ms) |
| **Block Time** | ~400ms |
| **Block Explorer** | [explorer.solana.com](https://explorer.solana.com) |
| **Native Token** | Test SOL |

**Getting Test SOL:**
```bash
# Using Solana CLI
solana airdrop 2 <YOUR_ADDRESS> --url devnet

# Or use web faucet
# Visit: https://faucet.solana.com/
```

**Supported Tokens:**
- USDC: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

**RPC Providers:**
- PublicNode, Official Solana RPC

**When to Use:**
- Testing ultra-fast confirmations
- High-throughput testing
- Solana-specific features

---

## Mainnet Networks

Mainnet networks use real cryptocurrencies with actual value. Use only for production.

::: danger Real Money Warning
Mainnet transactions involve **real cryptocurrency** with actual financial value. Always test thoroughly on testnet first.
:::

### Ethereum Mainnet

The primary Ethereum network.

| Property | Value |
|----------|-------|
| **Chain ID** | `ethereum-mainnet` |
| **Protocol** | EVM |
| **Network Type** | Mainnet |
| **Block Confirmations** | 12 blocks (~2.4 minutes) |
| **Block Time** | ~12 seconds |
| **Block Explorer** | [etherscan.io](https://etherscan.io) |
| **Native Token** | ETH |

**Supported Tokens:**
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- DAI: Coming Soon

**RPC Providers:**
- Alchemy, Infura, PublicNode

**Transaction Fees:**
- Gas prices vary: typically 20-50 Gwei
- Average transaction cost: $5-20 USD
- High during network congestion

**When to Use:**
- Production Ethereum payments
- Maximum security requirements
- Large transaction volumes

---

### Polygon Mainnet

High-performance Layer 2 Ethereum scaling solution.

| Property | Value |
|----------|-------|
| **Chain ID** | `polygon-mainnet` |
| **Protocol** | EVM |
| **Network Type** | Mainnet |
| **Block Confirmations** | 128 blocks (~4.3 minutes) |
| **Block Time** | ~2 seconds |
| **Block Explorer** | [polygonscan.com](https://polygonscan.com) |
| **Native Token** | MATIC |

**Supported Tokens:**
- USDT: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- DAI: Coming Soon

**RPC Providers:**
- Alchemy, Ankr, PublicNode

**Transaction Fees:**
- Extremely low: $0.01-0.10 USD per transaction
- Predictable costs
- Fast finality

**When to Use:**
- Cost-sensitive applications
- High-frequency microtransactions
- Fast confirmation requirements

---

### Tron Mainnet

High-throughput blockchain optimized for USDT transfers.

| Property | Value |
|----------|-------|
| **Chain ID** | `tron-mainnet` |
| **Protocol** | Tron |
| **Network Type** | Mainnet |
| **Block Confirmations** | 19 blocks (~57 seconds) |
| **Block Time** | ~3 seconds |
| **Block Explorer** | [tronscan.org](https://tronscan.org) |
| **Native Token** | TRX |

**Supported Tokens:**
- USDT: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

**RPC Providers:**
- TronGrid

**Transaction Fees:**
- Very low: ~$1 USD for most transactions
- Energy/bandwidth optimization available
- Popular for USDT transfers

**When to Use:**
- USDT-focused applications
- Asia-Pacific market
- Cost-effective transfers

---

### Solana Mainnet

Ultra-fast blockchain with sub-second finality.

| Property | Value |
|----------|-------|
| **Chain ID** | `solana-mainnet` |
| **Protocol** | Solana |
| **Network Type** | Mainnet |
| **Block Confirmations** | 1 block (~400ms) |
| **Block Time** | ~400ms |
| **Block Explorer** | [explorer.solana.com](https://explorer.solana.com) |
| **Native Token** | SOL |

**Supported Tokens:**
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

**RPC Providers:**
- PublicNode, Official Solana RPC

**Transaction Fees:**
- Ultra-low: $0.00025 USD per transaction
- Fastest finality
- High throughput

**When to Use:**
- Ultra-fast payment confirmation
- Gaming and real-time applications
- Maximum cost efficiency

---

## Choosing the Right Network

### Decision Matrix

| Use Case | Recommended Network | Reason |
|----------|---------------------|---------|
| **Development & Testing** | Ethereum Sepolia or Polygon Amoy | Well-supported testnets, easy to get test tokens |
| **Cost-Sensitive Production** | Polygon or Solana | Very low transaction fees |
| **Maximum Security** | Ethereum Mainnet | Most established and secure |
| **USDT Focus** | Tron Mainnet | Largest USDT circulation |
| **Speed Priority** | Solana | Sub-second finality |
| **Asia-Pacific Market** | Tron | Popular in the region |
| **General Purpose** | Polygon Mainnet | Good balance of cost, speed, security |

### Cost Comparison

| Network | Avg. Transaction Cost | Speed | Security |
|---------|---------------------|-------|----------|
| Ethereum | $5-20 | Medium | Highest |
| Polygon | $0.01-0.10 | Fast | High |
| Tron | ~$1 | Fast | High |
| Solana | $0.00025 | Fastest | High |

## Using Networks in Your Code

### With MCP Server

Specify the chain ID when creating orders or deposits:

```
Create a payment order:
- Amount: 10 USDT
- Chain: polygon-amoy  // Use chain ID from the tables above
```

### With Direct API

**TypeScript Example:**

```typescript
const response = await fetch(`${PAYIN_API_URL}/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    orderReference: 'ORDER-001',
    amount: '10.00',
    currency: 'USDT',
    chainId: 'polygon-amoy',  // Specify chain ID here
    successUrl: 'https://yoursite.com/success',
    cancelUrl: 'https://yoursite.com/cancel'
  })
});
```

## Multi-Chain Strategy

### For Order Payments (Single-Chain)

Orders are created on a **specific chain** at creation time:
- User selects chain during checkout
- Payment address is chain-specific
- Only monitors the selected chain

**Example Flow:**
```
1. User selects "Pay with USDT on Polygon"
2. Create order with chainId: 'polygon-mainnet'
3. System monitors only Polygon for this payment
4. Payment completed on Polygon
```

### For Deposit Services (Multi-Chain)

Deposits support **multiple chains** within the same protocol:
- User receives one address per protocol
- PayIn monitors all protocol chains automatically
- User can deposit from any supported chain

**Example Flow:**
```
1. User binds USDT deposit address (EVM protocol)
2. System monitors: Ethereum + Polygon (all EVM chains)
3. User can deposit USDT from either Ethereum or Polygon
4. All deposits are credited to the same user account
```

## Network Status & Health

### Monitoring Network Health

Check real-time network status through MCP or API:

**With MCP:**
```
What's the current status of ethereum-sepolia network?
```

**With API:**
```typescript
const response = await fetch(`${PAYIN_API_URL}/monitoring/status`, {
  headers: { 'X-API-Key': API_KEY }
});
const status = await response.json();
console.log(status.chains['ethereum-sepolia']);
```

### Common Network Issues

**Slow Confirmations:**
- Check block explorer for network congestion
- Wait for additional blocks if needed
- Consider using faster network (Polygon/Solana)

**High Fees (Ethereum):**
- Use Polygon or Solana for cost-sensitive transactions
- Wait for off-peak hours
- Batch transactions when possible

**RPC Issues:**
- PayIn automatically switches between RPC providers
- No action needed in most cases
- Check status page if persistent issues

## Next Steps

- [Supported Tokens](/en/guide/supported-tokens) - View available stablecoins
- [API Integration](/en/guide/api-integration) - Integrate directly with APIs
- [Quick Start](/en/guide/quick-start-mcp) - Get started with MCP

## FAQs

**Q: Can I change the network after creating an order?**
No, the network is fixed when an order is created. Users must pay on the specified network.

**Q: Which network is fastest?**
Solana has the fastest finality (~400ms), followed by Polygon (~2 seconds), Tron (~3 seconds), and Ethereum (~12 seconds).

**Q: Which network is cheapest?**
Solana is the cheapest ($0.00025), followed by Polygon ($0.01-0.10), Tron (~$1), and Ethereum ($5-20).

**Q: Can users deposit from multiple networks to the same address?**
Yes, for deposit services. The same address can receive payments from all chains within the same protocol family (e.g., Ethereum + Polygon for EVM).

**Q: What happens if a user sends to the wrong network?**
Funds sent to the wrong network cannot be recovered. Always verify the network matches the payment address protocol. PayIn's payment pages include clear network warnings.

**Q: Do you support testnets and mainnets for all networks?**
Yes, all networks have both testnet and mainnet versions available.
