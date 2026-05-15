# Monitor RPC Configuration Complete Guide

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration Methods](#configuration-methods)
- [Configuration File Format](#configuration-file-format)
- [Environment Variables](#environment-variables)
- [Built-in Providers](#built-in-providers)
- [Custom Providers](#custom-providers)
- [Authentication Methods](#authentication-methods)
- [Advanced Configuration](#advanced-configuration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Monitor RPC configuration system provides a flexible, type-safe way to manage multi-chain blockchain RPC endpoints. It supports:

- 🌐 **Multi-chain Support**: Ethereum, Polygon, Tron, and other major blockchains
- 🔑 **Multiple Authentication Methods**: URL path, HTTP headers, query parameters, no authentication
- ⚖️ **Load Balancing**: Round Robin, Failover, Fastest response
- 🏥 **Health Checks**: Automatic endpoint failure detection and recovery
- 🚦 **Rate Limiting**: Prevent exceeding provider limits
- 📊 **Zero-config Startup**: Quick start with environment variables

---

## Quick Start

### Simplest Way (Environment Variables)

```bash
# Set API keys
export RPC_ALCHEMY_KEY="your_alchemy_key"
export RPC_INFURA_KEY="your_infura_key"

# Run your application
npm start
```

```typescript
import { createRPCManager } from '@payin/monitor';

// API keys are automatically discovered from environment variables
const rpcManager = await createRPCManager({
  alchemy: process.env.RPC_ALCHEMY_KEY!,
  infura: process.env.RPC_INFURA_KEY!,
});

await rpcManager.initialize();
```

### Using Configuration File

```yaml
# config/monitor.yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
      timeout: 5000
    polygon-amoy:
      preferredProviders: [alchemy, ankr]
      timeout: 6000
```

```typescript
const rpcManager = await createRPCManager(
  rpcKeys,
  './config/monitor.yaml'
);
```

---

## Configuration Methods

Monitor supports multiple configuration methods, in priority order from highest to lowest:

### 1. Direct Code Configuration (Highest Priority)

```typescript
import { RPCManager } from '@payin/monitor';

const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      chain: 'ethereum-sepolia',
      strategy: 'round_robin',
      endpoints: [{
        name: 'alchemy',
        provider: 'alchemy',
        url: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
        weight: 100,
        timeout: 5000,
        maxRequestsPerSecond: 15,
        enabled: true
      }],
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        maxFailures: 3
      },
      retry: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    }
  },
  settings: {
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      maxFailures: 3
    },
    retry: {
      maxRetries: 3,
      backoffMultiplier: 1.5,
      initialDelay: 1000
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      timeWindow: 1000
    }
  }
};

const rpcManager = new RPCManager({ rpcConfig });
await rpcManager.initialize();
```

### 2. Using Configuration Builder

```typescript
import { RPCConfigBuilder } from '@payin/monitor';

const builder = new RPCConfigBuilder({
  apiKeys: {
    alchemy: process.env.RPC_ALCHEMY_KEY!,
    infura: process.env.RPC_INFURA_KEY!,
  }
});

const rpcConfig = await builder.buildForChains([
  'ethereum-sepolia',
  'polygon-amoy',
  'tron-mainnet'
]);

const rpcManager = new RPCManager({ rpcConfig });
await rpcManager.initialize();
```

### 3. Custom Configuration File Path

```typescript
const rpcManager = await createRPCManager(
  rpcKeys,
  process.env.MONITOR_CONFIG_FILE || './config/custom.yaml'
);
```

### 4. Default Configuration File

Monitor automatically attempts to load `packages/monitor/config/default.yaml` (lowest priority)

---

## Configuration File Format

### Complete Configuration Example

```yaml
# Monitor configuration file
rpc:
  # Global defaults
  defaults:
    timeout: 5000
    maxRetries: 3
    healthCheckInterval: 30000

  # Chain defaults (default values for all chains)
  chainDefaults:
    strategy: round_robin  # Load balancing strategy: round_robin | failover | fastest
    healthCheck:
      enabled: true
      interval: 30000      # Health check interval (ms)
      timeout: 5000        # Health check timeout (ms)
      maxFailures: 3       # Max consecutive failures
    retry:
      maxRetries: 3        # Max retry attempts
      backoffMultiplier: 1.5  # Backoff multiplier
      initialDelay: 1000   # Initial delay (ms)

  # Custom provider definitions (optional)
  providers:
    my-custom-rpc:
      displayName: "My Custom RPC"
      authType: 'url_path'
      urlPattern: "https://my-rpc.com/{network}/{apiKey}"
      supportedNetworks: ["ethereum-sepolia", "polygon-amoy"]
      networkMappings:
        ethereum-sepolia: "eth-sepolia"
      defaultSettings:
        timeout: 5000
        weight: 100
        maxRequestsPerSecond: 10

  # Chain-specific configuration (overrides chainDefaults)
  chains:
    ethereum-mainnet:
      preferredProviders: [alchemy, infura, publicnode]
      strategy: fastest    # Override default strategy
      timeout: 5000
      healthCheck:
        maxFailures: 5     # Override default

    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
      timeout: 5000

    polygon-mainnet:
      preferredProviders: [alchemy, ankr, publicnode]
      timeout: 6000

    polygon-amoy:
      preferredProviders: [alchemy, ankr]
      timeout: 6000

    tron-mainnet:
      preferredProviders: [trongrid]
      timeout: 8000

monitor:
  # Scanning settings
  scanning:
    defaultConfirmations: 3
    maxBlockRange: 1000
    scanInterval: 10000

  # Event handling
  events:
    maxListeners: 100
    errorRetryInterval: 5000

  # Performance settings
  performance:
    enableCache: true
    cacheSize: 1000
    concurrentRequests: 5
```

### Minimal Configuration Example

```yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura]
    polygon-amoy:
      preferredProviders: [alchemy]
```

---

## Environment Variables

### RPC API Key Auto-discovery

Monitor automatically recognizes environment variables in the `RPC_*_KEY` format:

```bash
# Format: RPC_{PROVIDER_NAME}_KEY
export RPC_ALCHEMY_KEY="your_alchemy_key"
export RPC_INFURA_KEY="your_infura_key"
export RPC_ANKR_KEY="your_ankr_key"
export RPC_TRONGRID_KEY="your_trongrid_key"

# Custom providers
export RPC_QUICKNODE_KEY="your_quicknode_key"
export RPC_BLAST_KEY="your_blast_key"
```

**Naming Convention:**
- Prefix must be `RPC_`
- Suffix must be `_KEY`
- Middle part is provider name (uppercase, underscore-separated)
- Provider name is automatically converted to lowercase

**Examples:**
```bash
RPC_ALCHEMY_KEY      → alchemy
RPC_INFURA_KEY       → infura
RPC_MY_CUSTOM_KEY    → my_custom (note: underscores preserved)
```

### Configuration File Path

```bash
# Specify custom configuration file
export MONITOR_CONFIG_FILE="./config/production.yaml"
```

### Using Environment Variables in Code

```typescript
// Automatically extract RPC keys from environment variables
function extractRpcKeysFromEnv(): Record<string, string> {
  const rpcKeys: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('RPC_') && key.endsWith('_KEY') && typeof value === 'string') {
      // RPC_ALCHEMY_KEY -> alchemy
      const providerName = key.slice(4, -4).toLowerCase();
      rpcKeys[providerName] = value;
    }
  }

  return rpcKeys;
}

// Usage
const rpcKeys = extractRpcKeysFromEnv();
console.log(rpcKeys);
// { alchemy: 'xxx', infura: 'xxx', ankr: 'xxx', ... }
```

---

## Built-in Providers

Monitor includes the following built-in RPC provider templates:

### Providers Requiring API Keys

| Provider | Auth Method | Supported Chains | Default Rate Limit |
|----------|-------------|------------------|-------------------|
| **Alchemy** | URL Path | Ethereum, Polygon | 15 req/s |
| **Infura** | URL Path | Ethereum, Polygon | 10 req/s |
| **Ankr** | URL Path | Ethereum, Polygon | 12 req/s |
| **TronGrid** | HTTP Header | Tron | 8 req/s |

### Public Providers (No API Key Required)

| Provider | Supported Chains | Default Rate Limit |
|----------|------------------|-------------------|
| **PublicNode** | Ethereum, Polygon | 3 req/s |
| **Cloudflare** | Ethereum Mainnet | 3 req/s |

### Detailed Provider Configuration

#### Alchemy
```typescript
{
  displayName: "Alchemy",
  authType: 'url_path',
  urlPattern: "https://{network}.g.alchemy.com/v2/{apiKey}",
  supportedNetworks: ["eth-mainnet", "eth-sepolia", "polygon-mainnet", "polygon-amoy"],
  networkMappings: {
    "ethereum-mainnet": "eth-mainnet",
    "ethereum-sepolia": "eth-sepolia"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 100,
    maxRequestsPerSecond: 15
  }
}
```

#### Infura
```typescript
{
  displayName: "Infura",
  authType: 'url_path',
  urlPattern: "https://{network}.infura.io/v3/{apiKey}",
  supportedNetworks: ["mainnet", "sepolia", "polygon-mainnet", "polygon-amoy"],
  networkMappings: {
    "ethereum-mainnet": "mainnet",
    "ethereum-sepolia": "sepolia"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 90,
    maxRequestsPerSecond: 10
  }
}
```

#### Ankr
```typescript
{
  displayName: "Ankr",
  authType: 'url_path',
  urlPattern: "https://rpc.ankr.com/{network}/{apiKey}",
  supportedNetworks: ["eth", "eth_sepolia", "polygon", "polygon_amoy"],
  networkMappings: {
    "ethereum-mainnet": "eth",
    "ethereum-sepolia": "eth_sepolia",
    "polygon-mainnet": "polygon",
    "polygon-amoy": "polygon_amoy"
  },
  defaultSettings: {
    timeout: 5000,
    weight: 85,
    maxRequestsPerSecond: 12
  }
}
```

#### TronGrid
```typescript
{
  displayName: "TronGrid",
  authType: 'header',
  urlPattern: "https://api.trongrid.io/jsonrpc",
  headerTemplate: {
    "TRON-PRO-API-KEY": "{apiKey}"
  },
  supportedNetworks: ["tron-mainnet", "tron-nile"],
  defaultSettings: {
    timeout: 8000,
    weight: 80,
    maxRequestsPerSecond: 8
  }
}
```

---

## Custom Providers

### Method 1: Define in Configuration File

```yaml
rpc:
  # Define custom providers
  providers:
    quicknode:
      displayName: "QuickNode"
      authType: 'url_path'
      urlPattern: "https://{network}.quiknode.pro/{apiKey}"
      supportedNetworks: ["eth-mainnet", "eth-sepolia"]
      networkMappings:
        ethereum-mainnet: "eth-mainnet"
        ethereum-sepolia: "eth-sepolia"
      defaultSettings:
        timeout: 3000
        weight: 100
        maxRequestsPerSecond: 25

    blast:
      displayName: "Blast API"
      authType: 'url_path'
      urlPattern: "https://{network}.blastapi.io/{apiKey}"
      supportedNetworks: ["eth-mainnet", "polygon-mainnet"]
      networkMappings:
        ethereum-mainnet: "eth-mainnet"
        polygon-mainnet: "polygon-mainnet"
      defaultSettings:
        timeout: 5000
        weight: 90
        maxRequestsPerSecond: 15

  chains:
    ethereum-sepolia:
      preferredProviders: [quicknode, alchemy, infura]
```

### Method 2: Provide Complete Endpoint Configuration

```typescript
const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      chain: 'ethereum-sepolia',
      strategy: 'round_robin',
      endpoints: [
        {
          name: 'my-custom-endpoint',
          provider: 'custom',
          url: 'https://my-rpc.com/ethereum/sepolia',  // Complete URL
          headers: {  // Optional: custom headers
            'Authorization': 'Bearer YOUR_TOKEN',
            'X-API-Key': 'YOUR_KEY'
          },
          weight: 100,
          timeout: 5000,
          maxRequestsPerSecond: 10,
          enabled: true
        }
      ],
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        maxFailures: 3
      },
      retry: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000
      }
    }
  },
  settings: {
    healthCheck: { enabled: true, interval: 30000, timeout: 5000, maxFailures: 3 },
    retry: { maxRetries: 3, backoffMultiplier: 1.5, initialDelay: 1000 },
    rateLimit: { enabled: true, maxRequests: 100, timeWindow: 1000 }
  }
};
```

### Method 3: Extend Built-in Provider Templates

**Edit `packages/monitor/src/rpc/config/provider-templates.ts`:**

```typescript
export const RPC_PROVIDERS: Record<string, Omit<ProviderTemplate, 'name'>> = {
  // ... existing providers

  // Add new provider
  'getblock': {
    displayName: "GetBlock",
    authType: 'url_path',
    urlPattern: "https://{network}.getblock.io/{apiKey}/mainnet/",
    supportedNetworks: ["eth", "matic"],
    networkMappings: {
      "ethereum-mainnet": "eth",
      "polygon-mainnet": "matic"
    },
    defaultSettings: {
      timeout: 6000,
      weight: 85,
      maxRequestsPerSecond: 12
    }
  }
} as const;
```

---

## Authentication Methods

Monitor supports 4 RPC provider authentication methods:

### 1. URL Path Authentication (`url_path`)

API key is embedded in the URL path.

```yaml
providers:
  my-provider:
    authType: 'url_path'
    urlPattern: "https://{network}.provider.com/v2/{apiKey}"
```

**Generated URL Example:**
```
https://eth-mainnet.provider.com/v2/YOUR_API_KEY
```

**Use Cases:** Alchemy, Infura, Ankr, etc.

### 2. HTTP Header Authentication (`header`)

API key is passed through HTTP request headers.

```yaml
providers:
  my-provider:
    authType: 'header'
    urlPattern: "https://api.provider.com/jsonrpc"
    headerTemplate:
      Authorization: "Bearer {apiKey}"
      X-API-Key: "{apiKey}"
      X-Custom-Header: "static-value"
```

**Generated HTTP Request:**
```http
POST https://api.provider.com/jsonrpc
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
X-Custom-Header: static-value
Content-Type: application/json
```

**Use Cases:** TronGrid, providers requiring Bearer tokens

### 3. Query Parameter Authentication (`query_param`)

API key as URL query parameter.

```yaml
providers:
  my-provider:
    authType: 'query_param'
    urlPattern: "https://api.provider.com/rpc"
    queryTemplate:
      apikey: "{apiKey}"
      network: "{network}"
      format: "json"
```

**Generated URL Example:**
```
https://api.provider.com/rpc?apikey=YOUR_KEY&network=eth-mainnet&format=json
```

**Use Cases:** RESTful APIs using query parameters

### 4. No Authentication (`none`)

Public RPC endpoints requiring no API key.

```yaml
providers:
  public-rpc:
    authType: 'none'
    urlPattern: "https://public-rpc.example.com"
```

**Generated URL Example:**
```
https://public-rpc.example.com
```

**Use Cases:** PublicNode, Cloudflare Web3, public testnet RPCs

---

## Advanced Configuration

### Load Balancing Strategies

Monitor supports 3 load balancing strategies:

#### 1. Round Robin - Default

Rotate through all healthy endpoints by weight.

```yaml
chains:
  ethereum-sepolia:
    strategy: round_robin
    preferredProviders: [alchemy, infura, ankr]
```

**Features:**
- ✅ Evenly distribute requests
- ✅ Considers endpoint weights
- ✅ Automatically skips unhealthy endpoints

#### 2. Failover

Use highest weight endpoint first, failover to next on failure.

```yaml
chains:
  ethereum-mainnet:
    strategy: failover
    preferredProviders: [alchemy, infura, publicnode]
```

**Features:**
- ✅ Clear priority
- ✅ Fast failover
- ✅ Suitable for primary/backup RPC scenarios

#### 3. Fastest

Select endpoint with fastest average response time.

```yaml
chains:
  polygon-mainnet:
    strategy: fastest
    preferredProviders: [alchemy, ankr, publicnode]
```

**Features:**
- ✅ Automatic performance optimization
- ✅ Dynamic adjustment
- ✅ Suitable for latency-sensitive applications

### Health Check Configuration

```yaml
rpc:
  chainDefaults:
    healthCheck:
      enabled: true        # Enable health checks
      interval: 30000      # Check interval (ms)
      timeout: 5000        # Timeout (ms)
      maxFailures: 3       # Max failures before marking unhealthy

  chains:
    ethereum-sepolia:
      healthCheck:
        interval: 15000    # More frequent checks
        maxFailures: 5     # More tolerant of failures
```

### Retry Configuration

```yaml
rpc:
  chainDefaults:
    retry:
      maxRetries: 3              # Max retry attempts
      backoffMultiplier: 1.5     # Backoff multiplier (each retry delay * 1.5)
      initialDelay: 1000         # Initial delay (ms)

  chains:
    tron-mainnet:
      retry:
        maxRetries: 5            # Tron may need more retries
        backoffMultiplier: 2.0   # More aggressive backoff
```

**Retry Delay Calculation:**
```
1st retry: 1000ms
2nd retry: 1000ms * 1.5 = 1500ms
3rd retry: 1500ms * 1.5 = 2250ms
```

### Rate Limiting Configuration

```yaml
rpc:
  settings:
    rateLimit:
      enabled: true
      maxRequests: 100     # Max requests
      timeWindow: 1000     # Time window (ms)
```

**Each endpoint can be configured independently:**

```typescript
{
  name: 'alchemy',
  provider: 'alchemy',
  url: 'https://eth-sepolia.g.alchemy.com/v2/key',
  maxRequestsPerSecond: 15,  // Rate limit for this endpoint
  // ...
}
```

### Endpoint Weight Configuration

Weight affects selection frequency during load balancing. Higher weight = higher probability of selection.

```yaml
# Set default weight in provider template
providers:
  high-priority-rpc:
    defaultSettings:
      weight: 100  # High weight

  backup-rpc:
    defaultSettings:
      weight: 50   # Lower weight
```

```typescript
// Or override in endpoint configuration
{
  name: 'alchemy',
  weight: 100,  // Prefer this
}
{
  name: 'publicnode',
  weight: 30,   // Use less frequently
}
```

---

## Best Practices

### 1. Production Environment Configuration

```yaml
# config/production.yaml
rpc:
  chainDefaults:
    strategy: fastest  # Use fastest response strategy
    healthCheck:
      enabled: true
      interval: 30000
      timeout: 5000
      maxFailures: 3
    retry:
      maxRetries: 3
      backoffMultiplier: 1.5
      initialDelay: 1000

  chains:
    ethereum-mainnet:
      preferredProviders: [alchemy, infura, blast]  # Multiple reliable providers
      timeout: 5000

    polygon-mainnet:
      preferredProviders: [alchemy, ankr, quicknode]
      timeout: 6000
```

```bash
# Environment variables
export RPC_ALCHEMY_KEY="prod_alchemy_key"
export RPC_INFURA_KEY="prod_infura_key"
export RPC_BLAST_KEY="prod_blast_key"
export MONITOR_CONFIG_FILE="./config/production.yaml"
```

### 2. Development/Test Environment Configuration

```yaml
# config/development.yaml
rpc:
  chainDefaults:
    strategy: round_robin
    healthCheck:
      enabled: true
      interval: 60000  # Longer check interval
      maxFailures: 5   # More tolerant
    retry:
      maxRetries: 5    # More retries

  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, infura, publicnode]  # Include free options

    polygon-amoy:
      preferredProviders: [alchemy, publicnode]
```

### 3. CI/CD Environment Configuration

```yaml
# config/ci.yaml
rpc:
  chainDefaults:
    strategy: failover  # Simple failover
    healthCheck:
      enabled: false    # Disable health checks to speed up tests
    retry:
      maxRetries: 1     # Fail fast

  chains:
    ethereum-sepolia:
      preferredProviders: [publicnode]  # Use public RPC only
```

### 4. Recommended Provider Combinations

**Ethereum Mainnet:**
```yaml
preferredProviders: [alchemy, infura, blast, publicnode]
```

**Ethereum Sepolia (Testnet):**
```yaml
preferredProviders: [alchemy, infura, publicnode]
```

**Polygon Mainnet:**
```yaml
preferredProviders: [alchemy, ankr, quicknode, publicnode]
```

**Polygon Amoy (Testnet):**
```yaml
preferredProviders: [alchemy, ankr, publicnode]
```

**Tron Mainnet:**
```yaml
preferredProviders: [trongrid]
```

### 5. Security Best Practices

**❌ Don't Do:**
```yaml
# Don't hardcode API keys in config files
providers:
  alchemy:
    apiKey: "sk_12345..."  # ❌ Dangerous!
```

**✅ Do:**
```bash
# Use environment variables
export RPC_ALCHEMY_KEY="sk_12345..."
```

```yaml
# Config file contains only structure
chains:
  ethereum-sepolia:
    preferredProviders: [alchemy]  # ✅ Keys from environment
```

**✅ Use Secret Management Services:**
```typescript
import { getSecret } from './secrets';

const rpcKeys = {
  alchemy: await getSecret('RPC_ALCHEMY_KEY'),
  infura: await getSecret('RPC_INFURA_KEY'),
};
```

### 6. Monitoring and Logging

**Enable Verbose Logging:**
```typescript
import { createLogger, LogLevel } from '@payin/shared';

const logger = createLogger('RPC', LogLevel.DEBUG);
```

**Listen to RPC Events:**
```typescript
rpcManager.on('endpoint-failed', (endpoint, error) => {
  console.error(`Endpoint ${endpoint.name} failed:`, error);
  // Send alert
});

rpcManager.on('endpoint-recovered', (endpoint) => {
  console.log(`Endpoint ${endpoint.name} recovered`);
});

rpcManager.on('configuration-reloaded', () => {
  console.log('RPC configuration reloaded');
});
```

### 7. Performance Optimization

**Connection Pool Configuration:**
```typescript
const rpcConfig = {
  // ...
  settings: {
    connectionPool: {
      maxConnections: 10,
      idleTimeout: 30000,
      keepAlive: true
    }
  }
};
```

**Cache Configuration:**
```yaml
monitor:
  performance:
    enableCache: true
    cacheSize: 1000  # Cache 1000 most recent blocks
    cacheTTL: 60000  # Cache for 1 minute
```

---

## Troubleshooting

### Issue 1: No chains could be configured

**Error Message:**
```
Error: No chains could be configured. Please provide valid RPC provider keys.
```

**Causes:**
- No API keys provided
- Environment variable name format incorrect
- No chains defined in configuration file

**Solutions:**

1. Check environment variables:
```bash
# Ensure correctly formatted environment variables are set
echo $RPC_ALCHEMY_KEY
echo $RPC_INFURA_KEY

# Format must be RPC_*_KEY
export RPC_ALCHEMY_KEY="your_key"
```

2. Check configuration file:
```yaml
rpc:
  chains:
    ethereum-sepolia:  # At least define one chain
      preferredProviders: [alchemy]
```

3. Explicitly provide keys in code:
```typescript
const rpcManager = await createRPCManager({
  alchemy: 'your_alchemy_key',
  infura: 'your_infura_key',
});
```

### Issue 2: Unknown provider

**Error Message:**
```
Unknown provider: my-custom-provider
```

**Causes:**
- Provider name not defined in configuration
- Provider template doesn't exist

**Solutions:**

1. Define provider in configuration file:
```yaml
rpc:
  providers:
    my-custom-provider:
      displayName: "My Provider"
      authType: 'url_path'
      urlPattern: "https://..."
      supportedNetworks: [...]
```

2. Or use direct endpoint configuration:
```typescript
const rpcConfig = {
  chains: {
    'ethereum-sepolia': {
      endpoints: [{
        name: 'custom',
        provider: 'custom',
        url: 'https://my-rpc.com/...',  // Provide complete URL
        // ...
      }]
    }
  }
};
```

### Issue 3: Failed to initialize any adapters

**Error Message:**
```
Error: Failed to initialize any adapters
```

**Causes:**
- All RPC endpoints unable to connect
- Invalid API keys
- Network issues

**Solutions:**

1. Verify API keys are valid:
```bash
# Test Alchemy
curl https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

2. Check network connectivity:
```bash
# Test connectivity
ping eth-sepolia.g.alchemy.com
```

3. Increase timeout and retries:
```yaml
rpc:
  chainDefaults:
    retry:
      maxRetries: 5
    timeout: 10000  # Increase timeout
```

4. Enable debug logging:
```typescript
import { createLogger, LogLevel } from '@payin/shared';
const logger = createLogger('RPC', LogLevel.DEBUG);
```

### Issue 4: Rate limit exceeded

**Error Message:**
```
Error: Rate limit exceeded for endpoint alchemy
```

**Causes:**
- Exceeded RPC provider's rate limit
- `maxRequestsPerSecond` set too high

**Solutions:**

1. Lower rate limit:
```yaml
providers:
  alchemy:
    defaultSettings:
      maxRequestsPerSecond: 10  # Lower limit
```

2. Add more providers:
```yaml
chains:
  ethereum-sepolia:
    preferredProviders: [alchemy, infura, ankr]  # Distribute load
```

3. Upgrade to higher API plan

### Issue 5: Configuration file not found

**Error Message:**
```
Custom config file not found: ./config/monitor.yaml
```

**Causes:**
- Configuration file path incorrect
- File doesn't exist

**Solutions:**

1. Check if file exists:
```bash
ls -la ./config/monitor.yaml
```

2. Use absolute path:
```typescript
const configPath = path.join(__dirname, '../config/monitor.yaml');
const rpcManager = await createRPCManager(rpcKeys, configPath);
```

3. Or use default configuration:
```typescript
// Don't specify config file path, use default
const rpcManager = await createRPCManager(rpcKeys);
```

### Debugging Tips

**Enable Verbose Logging:**
```typescript
import { createLogger, LogCategory, LogLevel } from '@payin/shared';

// Enable DEBUG level logging for RPC
const logger = createLogger(LogCategory.RPC, LogLevel.DEBUG);
```

**Listen to All Events:**
```typescript
rpcManager.on('*', (event, data) => {
  console.log('RPC Event:', event, data);
});
```

**Check Configuration State:**
```typescript
const config = rpcManager.getConfiguration();
console.log('Current RPC Config:', JSON.stringify(config, null, 2));

console.log('Available chains:', Object.keys(config.chains));
console.log('Endpoints per chain:');
for (const [chain, chainConfig] of Object.entries(config.chains)) {
  console.log(`  ${chain}:`, chainConfig.endpoints.map(e => e.name));
}
```

**Test Individual Endpoint:**
```typescript
const endpoint = rpcManager.getEndpoint('ethereum-sepolia', 'alchemy');
const response = await rpcManager.executeRequest('ethereum-sepolia', {
  method: 'eth_blockNumber',
  params: [],
});
console.log('Block number:', parseInt(response.result, 16));
```

---

## Related Documentation

- [Monitor Architecture Documentation](./monitor.md)
- [RPC Provider Templates](../../packages/monitor/src/rpc/config/provider-templates.ts)
- [Environment Variables Guide](../../packages/monitor/config/environment-variables.md)
- [Configuration Examples](../../packages/monitor/config/examples/)

---

## Changelog

- **2025-09-30**: Initial version
  - Added complete RPC configuration guide
  - Included environment variable auto-discovery feature
  - Support for custom provider configuration
  - Added troubleshooting guide