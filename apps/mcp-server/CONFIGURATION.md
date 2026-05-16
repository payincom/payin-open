# PayIn MCP Server Configuration Guide

This guide explains all configuration options for PayIn MCP Server.

## Table of Contents

- [Configuration Methods](#configuration-methods)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Configuration Methods

PayIn MCP Server supports three configuration methods with clear priority order:

### Priority Order

1. **Request Headers** (Highest Priority)
2. **Environment Variables**
3. **Default Values** (Lowest Priority)

### Configuration Sources

| Method | API Key | API URL | Use Case |
|--------|---------|---------|----------|
| **Request Headers** | `X-API-Key` | `X-PayIn-API-URL` | Production, multi-tenant |
| **Environment Variables** | `PAYIN_API_KEY` | `PAYIN_API_URL` | Development, single-tenant |
| **Default Values** | N/A | `DEFAULT_PAYIN_API_URL` | Fallback |

---

## Environment Variables

### Available Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DEFAULT_PAYIN_API_URL` | string | Yes | `http://localhost:3000` | Default API server URL |
| `PAYIN_API_URL` | string | No | - | Override API URL (takes priority over DEFAULT) |
| `PAYIN_API_KEY` | string | No | - | Default API Key for all requests |
| `REQUIRE_API_KEY_HEADER` | boolean | No | `false` | Enforce API key from header only |
| `LOG_LEVEL` | string | No | `info` | Log level: `debug`, `info`, `warn`, `error` |

### Setting Environment Variables

#### Local Development (`.dev.vars`)

```bash
# 1. Copy template
cp .dev.vars.example .dev.vars

# 2. Edit .dev.vars
PAYIN_API_URL=http://localhost:3000
PAYIN_API_KEY=pk_test_550e8400e29b41d4a716446655440001
LOG_LEVEL=debug
```

#### Cloudflare Workers (Production)

```bash
# Non-sensitive variables (wrangler.toml)
[vars]
DEFAULT_PAYIN_API_URL = "https://api.your-payin.example.com"
LOG_LEVEL = "info"

# Sensitive variables (Cloudflare secrets)
wrangler secret put PAYIN_API_KEY --env production
wrangler secret put REQUIRE_API_KEY_HEADER --env production
```

---

## Configuration Examples

### Example 1: Local Development (Environment Variables)

**Scenario**: Single developer, local testing

**`.dev.vars`**:
```bash
PAYIN_API_URL=http://localhost:3000
PAYIN_API_KEY=pk_test_550e8400e29b41d4a716446655440001
LOG_LEVEL=debug
```

**Claude Desktop Config** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "payin-local": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http"
    }
  }
}
```

**Result**: All requests use the API key and URL from `.dev.vars`.

---

### Example 2: Multi-Environment Development (Headers)

**Scenario**: Developer working with multiple environments

**`.dev.vars`**:
```bash
# No API credentials in .dev.vars
LOG_LEVEL=debug
```

**Claude Desktop Config**:
```json
{
  "mcpServers": {
    "payin-local": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_local_key",
        "X-PayIn-API-URL": "http://localhost:3000"
      }
    },
    "payin-railway": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_railway_key",
        "X-PayIn-API-URL": "https://payin-api-test.up.railway.app"
      }
    }
  }
}
```

**Result**: Each MCP server uses different credentials via headers.

---

### Example 3: Production Deployment (Secure)

**Scenario**: Production Cloudflare Workers deployment

**`wrangler.toml`**:
```toml
[env.production]
name = "payin-mcp-server-prod"
vars = {
  DEFAULT_PAYIN_API_URL = "https://api.your-payin.example.com",
  LOG_LEVEL = "info",
  REQUIRE_API_KEY_HEADER = "true"
}
```

**Cloudflare Secrets**:
```bash
# Set via Cloudflare Dashboard or CLI
# No default PAYIN_API_KEY - forces header-based auth
```

**Client Configuration**:
```json
{
  "mcpServers": {
    "payin-production": {
      "url": "https://mcp.payin.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_live_production_key"
      }
    }
  }
}
```

**Result**:
- API key MUST come from request header
- API URL uses default from wrangler.toml
- Enhanced security with `REQUIRE_API_KEY_HEADER=true`

---

### Example 4: Shared MCP Server (Multi-Tenant)

**Scenario**: Single MCP server instance serving multiple organizations

**Cloudflare Workers Configuration**:
```toml
[env.production]
vars = {
  DEFAULT_PAYIN_API_URL = "https://api.your-payin.example.com",
  REQUIRE_API_KEY_HEADER = "true",
  LOG_LEVEL = "info"
}
```

**Client Configuration (Organization A)**:
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_live_org_a_key"
      }
    }
  }
}
```

**Client Configuration (Organization B)**:
```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_live_org_b_key"
      }
    }
  }
}
```

**Result**: Each organization uses their own API key, accessing only their data.

---

### Example 5: Hybrid Configuration (Override)

**Scenario**: Default config with selective header overrides

**`.dev.vars`**:
```bash
PAYIN_API_URL=http://localhost:3000
PAYIN_API_KEY=pk_test_default_key
LOG_LEVEL=info
```

**Claude Desktop Config**:
```json
{
  "mcpServers": {
    "payin-default": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http"
    },
    "payin-custom": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_custom_key"
      }
    }
  }
}
```

**Result**:
- `payin-default`: Uses API key from `.dev.vars`
- `payin-custom`: Uses custom API key from header, URL from `.dev.vars`

---

## Security Considerations

### Production Recommendations

1. ✅ **Use `REQUIRE_API_KEY_HEADER=true`**
   - Enforces header-based authentication
   - Prevents accidental use of default API key
   - Supports multi-tenant scenarios

2. ✅ **Never set `PAYIN_API_KEY` in production**
   - Avoid default API key in production
   - Force clients to provide their own keys
   - Better audit trail per client

3. ✅ **Use Cloudflare Secrets for sensitive data**
   ```bash
   wrangler secret put PAYIN_API_KEY --env production
   ```

4. ✅ **Restrict API Key permissions**
   - Create API keys with minimal required permissions
   - Use PayIn Auth system to control access

### Development Recommendations

1. ✅ **Use `.dev.vars` for local secrets**
   - Never commit `.dev.vars` to git
   - Copy from `.dev.vars.example` template

2. ✅ **Use test API keys**
   - Create separate API keys for development
   - Prefix with `pk_test_` for clarity

3. ✅ **Enable debug logging**
   ```bash
   LOG_LEVEL=debug
   ```

---

## Troubleshooting

### Error: "Missing X-API-Key header"

**Cause**: No API key provided in header or environment

**Solutions**:
1. Add `X-API-Key` header in client config
2. Set `PAYIN_API_KEY` in `.dev.vars`
3. Verify `.dev.vars` file exists and is loaded

### Error: "Missing X-API-Key header (REQUIRE_API_KEY_HEADER=true)"

**Cause**: `REQUIRE_API_KEY_HEADER=true` but no header provided

**Solutions**:
1. Add `X-API-Key` header in client config
2. Set `REQUIRE_API_KEY_HEADER=false` for development
3. Remove `REQUIRE_API_KEY_HEADER` variable (defaults to false)

### API URL Not Working

**Check Priority**:
1. Verify `X-PayIn-API-URL` header value
2. Check `PAYIN_API_URL` in `.dev.vars`
3. Check `DEFAULT_PAYIN_API_URL` in `wrangler.toml`

**Debug**:
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

### Cloudflare Secrets Not Loading

**Verify Secrets**:
```bash
wrangler secret list --env production
```

**Re-deploy**:
```bash
wrangler deploy --env production
```

---

## Quick Reference

### Environment Variable Template

```bash
# .dev.vars
PAYIN_API_URL=http://localhost:3000
PAYIN_API_KEY=pk_test_your_key_here
LOG_LEVEL=debug
REQUIRE_API_KEY_HEADER=false
```

### Claude Desktop Config Template

```json
{
  "mcpServers": {
    "payin": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "pk_test_your_key_here",
        "X-PayIn-API-URL": "http://localhost:3000"
      }
    }
  }
}
```

### Cloudflare Secret Commands

```bash
# Set secret
wrangler secret put PAYIN_API_KEY --env production

# List secrets
wrangler secret list --env production

# Delete secret
wrangler secret delete PAYIN_API_KEY --env production
```

---

## Further Reading

- [Cloudflare Workers Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Wrangler Secrets](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
