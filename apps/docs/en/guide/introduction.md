# Introduction to PayIn

::: tip Status
📝 This page is a skeleton - detailed content to be added after structure review
:::

## What is PayIn?

**PayIn** is a non-custodial multi-chain stablecoin payment processor that enables businesses to accept cryptocurrency payments without holding user funds.

### Key Features

- 🌐 **Multi-Chain Support**: Ethereum, Polygon, Tron, Solana
- 💰 **Stablecoin Focus**: USDC, USDT, DAI
- 🔒 **Non-Custodial**: Funds go directly to your wallet
- ⚡ **Real-Time Monitoring**: Automatic payment detection
- 🔔 **Webhooks**: Event-driven notifications
- 🤖 **AI-Powered**: MCP Server for integration assistance

## Getting Started Options

Choose the path that fits your needs:

### Option 1: AI Assistant with MCP Server (Recommended)

Use AI to integrate PayIn through natural conversation.

**Best For:**
- Quick exploration and learning
- Developers who want AI assistance
- Rapid prototyping

**What You Get:**
- Natural language integration
- AI-guided setup
- Interactive troubleshooting
- No code required for testing

[Quick Start with MCP →](/en/guide/quick-start-mcp)

### Option 2: Cloud Payment Links or Open Link Flow

PayIn Cloud includes hosted Payment Links. PayIn Open does not ship a hosted dashboard or no-code link builder; self-hosted users can create the same customer experience with the Order Payment API and their own UI.

**Best For:**
- Small businesses
- Freelancers
- Event organizers
- Non-technical users

**What You Get:**
- Cloud-only hosted link creation
- Open-compatible API building blocks
- Shareable URL or QR-code flows
- Payment tracking through API queries and webhooks

[Payment Links Guide →](/en/guide/payment-links)

### Option 3: Direct API Integration

Traditional REST API integration.

**Best For:**
- Production applications
- Custom implementations
- Full programmatic control
- Advanced integrations

**What You Get:**
- Complete API control
- Custom business logic
- Production-ready
- All features available

[API Integration Guide →](/en/guide/api-integration)

## Core Services

PayIn provides three core services for different payment scenarios:

### 1. Order Payment Service

One-time payment addresses for individual transactions.

**How It Works:**
- Create order with amount and currency
- Get unique payment address
- User pays to address
- Order completes automatically
- Address released back to pool

**Use Cases:**
- E-commerce checkout
- Service payments
- Invoice payments
- One-time transactions

[Learn more →](/en/guide/order-payment)

### 2. Deposit Service

Permanent addresses for recurring user payments.

**How It Works:**
- Bind address to user ID
- User gets permanent deposit address
- Monitor multiple chains automatically
- All deposits credited to user
- Address remains bound

**Use Cases:**
- Gaming wallets
- User balance top-ups
- Membership payments
- Platform wallets

[Learn more →](/en/guide/deposit-service)

### 3. Cloud Payment Links or Open Link Flow

Shareable payment flows. Hosted Payment Links are a PayIn Cloud feature; PayIn Open users should build links on top of the Order Payment API.

**How It Works:**
- Create a hosted Payment Link in PayIn Cloud, or create an order-payment flow through the API in PayIn Open
- Set amount and details
- Share link or QR code
- User pays via link
- Track with API queries and webhooks, or in your own console

**Use Cases:**
- Event registration
- Consulting invoices
- Course enrollment
- Freelancer payments

[Learn more →](/en/guide/payment-links)

## How It Works

### Simple Flow

```
Your Application → PayIn API/MCP → Payment Address (Your Wallet)
                                           ↑
                                    User Payment
                                           ↓
                      PayIn Monitor ← Blockchain
                                           ↓
                           Webhook → Your Application
```

### Non-Custodial Model

**You control your funds:**
- Payments go directly to YOUR wallet addresses
- PayIn only monitors blockchain transactions
- You hold the private keys
- You can withdraw funds anytime
- Optional: Use PayIn's address management tools

## Supported Technologies

### Blockchains
- **Ethereum** (Mainnet + Sepolia Testnet)
- **Polygon** (Mainnet + Amoy Testnet)
- **Tron** (Mainnet + Nile Testnet)
- **Solana** (Mainnet + Devnet)

### Stablecoins
- **USDC** - Circle's USD stablecoin
- **USDT** - Tether USD
- **DAI** - MakerDAO stablecoin 

### Integration Methods
- **MCP Server** - AI-powered integration assistant
- **REST API** - Traditional HTTP API
- **Payment Links** - Cloud-only hosted links; use the Order Payment API for Open-built link flows
- **SDKs** - TypeScript, Python, PHP, Go 

## Use Cases

### E-Commerce
Accept cryptocurrency payments in your online store with automatic order processing.

### Gaming
Allow players to top up in-game currency using stablecoins from any supported blockchain.

### SaaS
Process subscription payments in cryptocurrency with recurring deposit addresses.

### Freelancing
Send Cloud Payment Links to clients, or generate your own Open payment pages with the Order Payment API.

### Events
Sell tickets or registrations using Cloud Payment Links or a self-built Open checkout page with QR codes.

### Web3 Apps
Native cryptocurrency payment processing for decentralized applications.

## Next Steps

### 1. Choose Your Integration Path

Select one of the three options above based on your needs.

### 2. Understand Core Concepts

- [Testnet vs Mainnet](/en/guide/testnet-vs-mainnet) - Testing and production environments
- [Supported Networks](/en/guide/supported-networks) - Blockchain network details
- [Supported Tokens](/en/guide/supported-tokens) - Stablecoin information

### 3. Set Up Your System

- [Address Pool Setup](/en/guide/address-pool-setup) - Configure payment addresses
- [Webhooks](/en/guide/webhooks) - Event notifications
- [Security](/en/guide/security) - Best practices

## Community and Support

- 📧 **Email**: support@payin.com
- 💬 **Discord**: [Join our community](https://discord.gg/payin) 
- 📚 **Documentation**: You're reading it!

## License

PayIn is MIT licensed.
