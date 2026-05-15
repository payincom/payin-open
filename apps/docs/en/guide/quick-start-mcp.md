# Quick Start with MCP Server

The fastest way to get started with PayIn is through our **MCP (Model Context Protocol) Server**. This allows you to integrate PayIn into your business using AI assistants like Claude Desktop, Cline, or any MCP-compatible client.

## What is MCP Server?

PayIn MCP Server provides an AI-powered interface to PayIn's payment infrastructure. Instead of reading documentation and writing code manually, you can simply have a conversation with your AI assistant to:

- Create payment orders and deposit addresses
- Query transaction status and payment history
- Configure webhooks and system settings
- Get integration guidance and troubleshooting help

## Prerequisites

To get started, you need:

1. **PayIn Account** - Register at [your-payin.example.com](https://your-payin.example.com) (for testing) or [your-payin.example.com](https://your-payin.example.com) (for production)
2. **API Key** - Generate from the Admin dashboard

::: tip Testnet vs Mainnet
We strongly recommend starting with **testnet** to familiarize yourself with PayIn before handling real transactions. See [Testnet vs Mainnet](/en/guide/testnet-vs-mainnet) for details.
:::

## Step 1: Register and Get API Key

### 1.1 Register Your Account

Visit [your-payin.example.com](https://your-payin.example.com) and create an account:

- **Option 1**: Register with email and password
- **Option 2**: Sign in with GitHub or Google

After registration, PayIn automatically creates a personal organization for you.

### 1.2 Generate API Key

1. Log in to PayIn Admin dashboard
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Enter a name (e.g., "MCP Server Key")
5. Copy the generated API key (you won't see it again!)

::: warning Save Your API Key
API keys are only shown once during creation. Store it securely - you'll need it for MCP configuration.
:::

## Step 2: Configure MCP Client

### Claude Desktop Configuration

Edit your Claude Desktop configuration file:

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-payin-api-key-here",
        "X-PayIn-API-URL": "https://your-payin.example.com"
      }
    }
  }
}
```

::: details Configuration Parameters Explained
- **url**: MCP Server endpoint
  - Testnet: `https://mcp.payin.com/sse`
  - Mainnet: `https://mcp.payin.com/sse` (same endpoint, different API URL)
- **transport**: Connection protocol - use `"sse"` (Server-Sent Events)
- **X-API-Key**: Your PayIn API key from Step 1.2
- **X-PayIn-API-URL**: PayIn API base URL
  - Testnet: `https://your-payin.example.com`
  - Mainnet: `https://your-payin.example.com`
:::

### Cline Configuration

For Cline (VS Code extension), add to your MCP settings:

```json
{
  "payin": {
    "command": "node",
    "args": ["/path/to/mcp-client.js"],
    "env": {
      "PAYIN_API_KEY": "your-payin-api-key-here",
      "PAYIN_API_URL": "https://your-payin.example.com"
    }
  }
}
```

### Restart Your Client

After saving the configuration, restart Claude Desktop or reload your VS Code window to activate the MCP connection.

## Step 3: Verify Connection

Open a new conversation with your AI assistant and try:

```
Can you check if PayIn MCP Server is connected?
```

If successful, your AI assistant will confirm the connection and show available capabilities.

## Step 4: Set Up Address Pool

Before creating orders or deposits, you need payment addresses in your pool.

::: warning Required Before Creating Payments
If you try to create an order without addresses, you'll get an error: "No available addresses in pool". Complete this step before continuing.
:::

**Quick Setup:**
1. Install Address Tool: `npm install -g @payin/address-tool`
2. Generate addresses: `payin-address-tool generate --mnemonic "..." --protocol evm --count 1000`
3. Import via Admin UI: **Address Pool** → **Import Addresses**

**Detailed Guide:**
- [Address Pool Setup →](/en/guide/address-pool-setup) - Complete step-by-step instructions

## Step 5: Start Using PayIn

### Example 1: Create a Payment Order

```
Create a payment order:
- Order Reference: ORDER-2025-001
- Amount: 10 USDT
- Chain: ethereum-sepolia
```

The AI will call the `create_order` tool and return the payment details including:
- Payment address
- Amount and currency
- Order status
- QR code for payment

### Example 2: Query Order Status

```
What's the status of order ORDER-2025-001?
```

### Example 3: Integration Assistance

```
How do I integrate PayIn payment into my Node.js e-commerce backend?
```

The AI will guide you through the integration process with code examples.

### Example 4: Create Deposit Address

```
Create a deposit address for user ID: user_123456
- Currency: USDT
- Chain: polygon-amoy
```

## Read-Only Mode (No API Key)

You can use the MCP Server without an API key for **read-only** access:

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-PayIn-API-URL": "https://your-payin.example.com"
      }
    }
  }
}
```

In read-only mode, you can:
- ✅ Access PayIn documentation through AI
- ✅ Get integration guidance and code examples
- ✅ Ask how-to questions
- ❌ Cannot create orders or perform operations

::: tip When to Use Read-Only Mode
Use read-only mode when you're just exploring PayIn or need integration help without accessing your account data.
:::

## Available MCP Capabilities

Once connected, your AI assistant can use these PayIn capabilities:

### 🔧 Tools (Operations)

- **Orders**: `create_order`, `get_order`, `list_orders`
- **Deposits**: `create_deposit_reference`, `get_deposit_reference`, `list_deposits`
- **Transfers**: `list_transfers`, `get_transfer`
- **Address Pool**: `get_pool_status`
- **Configuration**: `get_config`, `update_config`
- **Monitoring**: `get_system_status`

### 📚 Resources (Documentation)

- Access to all PayIn technical documentation
- API references and schemas
- Integration examples

### 💡 Prompts (Wizards)

- **Integration Wizard**: Step-by-step integration guidance
- **Troubleshooting Assistant**: Diagnose and fix issues

## Troubleshooting

### "MCP Server not responding"

1. Check your internet connection
2. Verify API key is correct
3. Ensure `X-PayIn-API-URL` matches your environment (testnet/mainnet)
4. Check Claude Desktop/client logs for detailed errors

### "Authentication failed"

1. Verify API key is active (check Admin dashboard)
2. Ensure API key hasn't expired
3. Check for extra spaces in the API key string

### "Operation not permitted"

Your API key may lack necessary permissions. Check your organization role:
- **Owner/Admin**: Full access to all operations
- **Member**: Can create orders and deposits, cannot manage settings
- **Viewer**: Read-only access

## Next Steps

### Essential Setup
- [Address Pool Setup](/en/guide/address-pool-setup) - Set up payment addresses (if not done yet)

### Learn More
- [Testnet vs Mainnet](/en/guide/testnet-vs-mainnet) - Understanding environments
- [Supported Networks](/en/guide/supported-networks) - Blockchain networks
- [Supported Tokens](/en/guide/supported-tokens) - Stablecoin details
- [API Integration](/en/guide/api-integration) - Direct API usage

## Getting Help

- Ask your AI assistant: "How do I [task] with PayIn?"
- Visit [PayIn Open Documentation](/)
- Join our [Discord Community](https://discord.gg/payin) 
