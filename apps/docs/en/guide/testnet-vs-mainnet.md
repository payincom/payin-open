# Testnet vs Mainnet

PayIn provides two separate environments to support your development and production needs: **Testnet** and **Mainnet**. Understanding the differences helps you develop safely and deploy confidently.

## Overview

| Aspect | Testnet | Mainnet |
|--------|---------|---------|
| **URL** | [testnet.payin.com](https://testnet.payin.com) | [app.payin.com](https://app.payin.com) |
| **Purpose** | Development & Testing | Production Operations |
| **Tokens** | Test tokens (no value) | Real cryptocurrencies |
| **Blockchain** | Test networks (Sepolia, Amoy, Shasta) | Main networks (Ethereum, Polygon, Tron) |
| **Cost** | Free test tokens from faucets | Real transaction fees |
| **Data** | Separate test data | Production data |
| **API Keys** | Testnet API keys | Mainnet API keys (separate) |

## Testnet Environment

### What is Testnet?

Testnet is a **risk-free sandbox environment** where you can:
- Test PayIn integration without financial risk
- Experiment with different payment flows
- Debug and troubleshoot issues
- Train your team on PayIn operations
- Perform load testing

### When to Use Testnet

✅ **Always use Testnet when:**
- First integrating PayIn into your application
- Developing new features that involve payments
- Testing payment flows and edge cases
- Learning how PayIn works
- Training new developers
- Running automated integration tests

### Testnet Characteristics

**Test Tokens**
- Tokens have no real-world value
- Get free tokens from blockchain faucets
- Unlimited testing without cost concerns

**Test Blockchains**
- Ethereum Sepolia (Ethereum testnet)
- Polygon Amoy (Polygon testnet)
- Tron Shasta (Tron testnet)
- Solana Devnet (Solana testnet)

**Faster Confirmations**
- Test networks often have faster block times
- Lower confirmation requirements for testing
- May have occasional downtime or resets

### Getting Test Tokens

#### Ethereum Sepolia

**Official Faucets:**
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- [Chainlink Faucet](https://faucets.chain.link/sepolia)

**Steps:**
1. Visit a faucet website
2. Connect your wallet or enter your address
3. Request test ETH
4. Use test ETH to get test USDT/USDC from testnet DEXs

#### Polygon Amoy

**Official Faucets:**
- [Polygon Faucet](https://faucet.polygon.technology/)
- [Alchemy Polygon Faucet](https://www.alchemy.com/faucets/polygon-amoy)

**Steps:**
1. Visit the Polygon faucet
2. Select "Amoy Testnet"
3. Enter your wallet address
4. Receive test MATIC tokens

#### Tron Shasta

**Official Faucet:**
- [TronGrid Shasta Faucet](https://www.trongrid.io/shasta/)

**Steps:**
1. Visit TronGrid Shasta faucet
2. Enter your Tron address
3. Complete CAPTCHA
4. Receive test TRX

#### Solana Devnet

**Getting Test SOL:**
```bash
# Using Solana CLI
solana airdrop 2 <YOUR_ADDRESS> --url devnet

# Or use online faucet
# Visit: https://faucet.solana.com/
```

## Mainnet Environment

### What is Mainnet?

Mainnet is the **production environment** where:
- Real cryptocurrency transactions occur
- Actual funds are transferred
- Production data is stored
- Your business operates live

### When to Use Mainnet

✅ **Use Mainnet when:**
- You've thoroughly tested on testnet
- Ready to accept real payments
- Launching to production
- Processing actual customer transactions

⚠️ **Prerequisites before Mainnet:**
- Complete integration testing on testnet
- Security review of your implementation
- Proper error handling and monitoring
- Webhook endpoints configured and tested
- Team training completed

### Mainnet Characteristics

**Real Cryptocurrencies**
- USDT, USDC, DAI on real blockchains
- Actual financial value
- Real transaction fees apply
- Irreversible transactions

**Main Blockchains**
- Ethereum Mainnet
- Polygon Mainnet
- Tron Mainnet
- Solana Mainnet

**Production Security**
- Requires thorough testing
- Implement proper error handling
- Use monitoring and alerts
- Follow security best practices

## Switching Between Environments

### For MCP Server

Change the `X-PayIn-API-URL` header in your MCP configuration:

**Testnet:**
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-testnet-api-key",
        "X-PayIn-API-URL": "https://testnet.payin.com"
      }
    }
  }
}
```

**Mainnet:**
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-mainnet-api-key",
        "X-PayIn-API-URL": "https://app.payin.com"
      }
    }
  }
}
```

### For Direct API Integration

Change the base URL in your code:

**TypeScript Example:**
```typescript
// Testnet
const PAYIN_API_URL = 'https://testnet.payin.com/api/v1';
const API_KEY = process.env.PAYIN_TESTNET_API_KEY;

// Mainnet
const PAYIN_API_URL = 'https://app.payin.com/api/v1';
const API_KEY = process.env.PAYIN_MAINNET_API_KEY;
```

## Best Practices

### Development Workflow

1. **Start with Testnet**
   - Register testnet account
   - Generate testnet API key
   - Develop and test all features
   - Validate webhook handling

2. **Thorough Testing**
   - Test happy path scenarios
   - Test error scenarios (insufficient funds, expired orders)
   - Test webhook delivery and retries
   - Perform load testing

3. **Staging Environment** (Optional)
   - Create separate testnet account for staging
   - Mirror production configuration
   - Run final integration tests

4. **Move to Mainnet**
   - Register mainnet account
   - Generate mainnet API key
   - Update configuration
   - Start with small test transaction
   - Monitor closely

### API Key Management

::: danger Separate API Keys
Testnet and Mainnet use **completely separate API keys**. Never use a mainnet API key on testnet or vice versa.
:::

**Recommendations:**
- Store API keys in environment variables
- Use different keys for development/staging/production
- Rotate API keys regularly
- Never commit API keys to version control

```typescript
// Good practice
const config = {
  apiUrl: process.env.NODE_ENV === 'production'
    ? 'https://app.payin.com/api/v1'
    : 'https://testnet.payin.com/api/v1',
  apiKey: process.env.NODE_ENV === 'production'
    ? process.env.PAYIN_MAINNET_API_KEY
    : process.env.PAYIN_TESTNET_API_KEY
};
```

### Environment Variables

```bash
# .env.development
PAYIN_API_URL=https://testnet.payin.com/api/v1
PAYIN_API_KEY=your-testnet-api-key

# .env.production
PAYIN_API_URL=https://app.payin.com/api/v1
PAYIN_API_KEY=your-mainnet-api-key
```

## Data Isolation

::: warning Complete Data Separation
Testnet and Mainnet are **completely isolated** environments:
- Separate user accounts
- Separate organizations
- Separate API keys
- Separate payment data
- Separate database systems
:::

You cannot transfer:
- Orders from testnet to mainnet
- API keys between environments
- User accounts or organizations
- Any configuration or data

## Monitoring and Support

### Testnet
- May have occasional downtime
- Best effort support
- Community forums

### Mainnet
- High availability (99.9% uptime SLA)
- Priority support
- 24/7 incident monitoring
- Status page: [status.payin.com](https://status.payin.com) (Coming Soon)

## Next Steps

- [Supported Networks](/en/guide/supported-networks) - See all blockchain networks
- [Supported Tokens](/en/guide/supported-tokens) - View available stablecoins
- [API Integration Guide](/en/guide/api-integration) - Direct API integration
- [Quick Start with MCP](/en/guide/quick-start-mcp) - Get started quickly

## FAQs

**Q: Can I use the same API key for testnet and mainnet?**
No, testnet and mainnet have separate API keys. You must generate separate keys for each environment.

**Q: Will my testnet orders appear on mainnet?**
No, testnet and mainnet are completely separate. Data created on testnet stays on testnet.

**Q: How do I migrate from testnet to mainnet?**
You don't migrate data. Instead, you switch your application's configuration to use mainnet URLs and API keys, then create new orders on mainnet.

**Q: Are testnet tokens real money?**
No, testnet tokens have no real-world value. They are only for testing purposes.

**Q: Can I skip testnet and go straight to mainnet?**
While technically possible, we **strongly discourage** this. Always test thoroughly on testnet to avoid costly mistakes with real funds.
