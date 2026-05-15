# PayIn MCP Server

PayIn MCP (Model Context Protocol) Server - AI-powered integration assistant and operations automation for PayIn multi-chain stablecoin payment system.

## Features

- 🤖 **AI Integration Assistant**: Help developers integrate PayIn into their systems through AI conversations
- ⚙️ **Operations Automation**: Automate PayIn operations through AI-powered tools
- 🔌 **MCP Protocol**: Standard Model Context Protocol for broad AI client compatibility
- ☁️ **Cloudflare Workers**: Serverless deployment with global edge network
- 🔐 **Secure**: API Key authentication using PayIn Auth system

## Architecture

- **Transport**: Streamable HTTP + SSE (Server-Sent Events)
- **Platform**: Cloudflare Workers
- **Protocol**: MCP (Model Context Protocol)
- **Language**: TypeScript

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account (for deployment)
- PayIn API Key

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
```

### Configuration

#### Network Type Selection (Testnet vs Mainnet)

PayIn MCP Server supports **automatic network selection** based on the `X-PayIn-Network` header:

- **Testnet** (default): Development and testing environment
- **Mainnet**: Production environment

**Example - Testnet Configuration:**

```json
{
  "mcpServers": {
    "payin-testnet": {
      "url": "https://payin-mcp.example.workers.dev",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_your_testnet_key",
        "X-PayIn-Network": "testnet"
      }
    }
  }
}
```

**Example - Mainnet Configuration:**

```json
{
  "mcpServers": {
    "payin-mainnet": {
      "url": "https://payin-mcp.example.workers.dev",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_live_your_mainnet_key",
        "X-PayIn-Network": "mainnet"
      }
    }
  }
}
```

**Example - Both Networks:**

```json
{
  "mcpServers": {
    "payin-testnet": {
      "url": "https://payin-mcp.example.workers.dev",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_your_testnet_key",
        "X-PayIn-Network": "testnet"
      }
    },
    "payin-mainnet": {
      "url": "https://payin-mcp.example.workers.dev",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_live_your_mainnet_key",
        "X-PayIn-Network": "mainnet"
      }
    }
  }
}
```

#### Option 1: Environment Variables (Recommended for Development)

Create `.dev.vars` file from template:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```bash
# Network-specific API URLs
PAYIN_TESTNET_API_URL=http://localhost:3000
PAYIN_MAINNET_API_URL=https://app.mainnet.payin.com

# API Key
PAYIN_API_KEY=pk_test_550e8400e29b41d4a716446655440001
LOG_LEVEL=debug
```

Configure MCP client (Claude Desktop) without headers:

```json
{
  "mcpServers": {
    "payin": {
      "url": "http://localhost:8787",
      "transport": "streamable-http"
    }
  }
}
```

#### Option 2: Headers-based Configuration (Recommended for Production)

Configure MCP client with headers:

```json
{
  "mcpServers": {
    "payin": {
      "url": "http://localhost:8787",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "your-payin-api-key",
        "X-PayIn-Network": "testnet"
      }
    }
  }
}
```

#### Configuration Priority

**Network Type Priority:**
1. `X-PayIn-Network` header (`testnet` or `mainnet`)
2. Default to `testnet`

**API URL Priority:**
1. `X-PayIn-API-URL` header (explicit override, ignores network type)
2. `PAYIN_API_URL` env (explicit override, ignores network type)
3. Network-specific URL (`PAYIN_TESTNET_API_URL` or `PAYIN_MAINNET_API_URL`)
4. `DEFAULT_PAYIN_API_URL` env (legacy fallback)

**API Key Priority:**
1. `X-API-Key` header
2. `PAYIN_API_KEY` env variable

### Deployment

#### Deploy to Development/Staging

```bash
# Deploy to default environment
npm run deploy

# Deploy to staging
wrangler deploy --env staging
```

#### Deploy to Production

```bash
# 1. Set production secrets (one-time setup)
wrangler secret put PAYIN_API_KEY --env production
# Enter your production API key when prompted

# 2. Deploy
wrangler deploy --env production
```

#### Production Environment Variables

For production, use Cloudflare secrets for sensitive values:

```bash
# Set API Key (sensitive)
wrangler secret put PAYIN_API_KEY --env production

# Set custom API URL (optional, if different from wrangler.toml)
wrangler secret put PAYIN_API_URL --env production

# Enable header-only auth (optional, for security)
wrangler secret put REQUIRE_API_KEY_HEADER --env production
# Enter: true
```

View all secrets:

```bash
wrangler secret list --env production
```

## Documentation

- [Configuration Guide](./CONFIGURATION.md) - **Complete configuration reference**
- [Getting Started](./docs/getting-started.md) - Quick start guide
- [Integration Guide](./docs/integration-guide.md) - Integrate PayIn with AI assistance
- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Examples](./docs/examples/) - Code examples and use cases

## MCP Capabilities

### Tools

- **Order Management**: Create, query, and manage payment orders
- **Deposit Management**: Bind, query, and manage user deposit addresses
- **Address Pool**: Monitor address pool availability
- **Monitoring**: System health checks and analytics reports

### Resources

- **Documentation**: Access PayIn docs through AI
- **Status**: Real-time system status and metrics
- **Examples**: curl and code examples

### Prompts

- **Integration Wizard**: Step-by-step integration guidance
- **Troubleshooting**: Diagnose and fix integration issues

## Security

### Authentication Methods

1. **Header-based (Recommended for Production)**
   - Pass API Key via `X-API-Key` header
   - Ensures per-request authentication
   - Allows different keys for different clients

2. **Environment Variable (Development Only)**
   - Set `PAYIN_API_KEY` in `.dev.vars` or Cloudflare secrets
   - Convenient for development and testing
   - Not recommended for multi-tenant scenarios

### Security Best Practices

- ✅ **Production**: Use `REQUIRE_API_KEY_HEADER=true` to enforce header-based auth
- ✅ **Secrets**: Store sensitive keys using `wrangler secret` in production
- ✅ **Permissions**: Use PayIn Auth system to control API key permissions
- ✅ **Audit**: All operations are automatically audited
- ⚠️ **Never commit**: `.dev.vars` file to version control (already gitignored)
- ⚠️ **Rotate keys**: Regularly rotate API keys in production

## License

MIT
