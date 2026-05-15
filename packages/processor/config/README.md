# Processor Configuration

This directory contains configuration files for the Processor system.

## Configuration Files

- **`default.yaml`** - Default configuration with base values for all environments
- **`test.yaml`** - Test environment configuration (optimized for fast testing)

## Configuration Loading

The Processor uses a **multi-layer configuration system** with the following priority (later sources override earlier ones):

1. **Built-in defaults** - Hardcoded defaults in `processor-config-manager.ts`
2. **`default.yaml`** - Base configuration file (always loaded)
3. **Custom config file** - Specified via `configFile` parameter (optional)
4. **Runtime configuration** - Provided to `Processor.create()` (highest priority)

### Important Notes

- ⚠️ **No automatic environment-based config loading** - The system does NOT automatically load config files based on `NODE_ENV`
- ✅ You must explicitly specify which config file to load via the `configFile` parameter
- ✅ Or override settings via runtime configuration object

## Usage Examples

### 1. Using Default Configuration Only

```typescript
import { Processor } from '@payin/processor';

// Only loads default.yaml
const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  },
  monitor: {
    rpcKeys: {
      alchemy: process.env.ALCHEMY_API_KEY,
      infura: process.env.INFURA_API_KEY
    }
  }
});
```

### 2. Using Custom Config File

```typescript
// Loads default.yaml + custom.yaml
const processor = await Processor.create(
  {
    database: {
      connectionString: process.env.DATABASE_URL
    }
  },
  'custom.yaml'  // ← Explicitly specify config file
);
```

### 3. Test Environment (used by test suite)

```typescript
// Loads default.yaml + test.yaml
const processor = await Processor.create(
  {
    monitor: {
      rpcKeys: { alchemy: 'test-key' }
    }
  },
  'test.yaml'  // ← Test-specific settings
);
```

## Environment Variables

The following environment variables are supported:

### Database Configuration

- `DATABASE_URL` or `PROCESSOR_DB_URL` - Full PostgreSQL connection string (recommended)
- `PROCESSOR_DB_HOST` - Database host (default: localhost)
- `PROCESSOR_DB_PORT` - Database port (default: 5432)
- `PROCESSOR_DB_NAME` - Database name (default: payin)
- `PROCESSOR_DB_USER` - Database username (default: postgres)
- `PROCESSOR_DB_PASSWORD` - Database password
- `PROCESSOR_DB_MAX_CONNECTIONS` - Max connections (default: 10)
- `PROCESSOR_DB_SSL` - Enable SSL (true/false)

### RPC Provider Keys

⚠️ **Not supported via environment variables** - Must be provided via:
1. Runtime configuration object (`monitor.rpcKeys`)
2. Custom config file

```typescript
// ✅ Recommended: Pass via runtime config
const processor = await Processor.create({
  monitor: {
    rpcKeys: {
      alchemy: process.env.ALCHEMY_API_KEY,
      infura: process.env.INFURA_API_KEY,
      ankr: process.env.ANKR_API_KEY,
      trongrid: process.env.TRONGRID_API_KEY
    }
  }
});
```

## Creating Custom Configuration Files

### Step 1: Create a custom YAML file

```bash
# Copy default.yaml as a starting point
cp default.yaml custom.yaml
```

### Step 2: Edit your custom configuration

```yaml
# custom.yaml - Production settings example
database:
  maxConnections: 20
  ssl: true

# Monitor will track all chains defined here (new behavior!)
chains:
  ethereum-mainnet:
    protocol: evm
    name: Ethereum Mainnet
    network: mainnet
  polygon-mainnet:
    protocol: evm
    name: Polygon Mainnet
    network: mainnet

# Optional: Monitor only specific chains (subset of chains above)
# monitor:
#   chains: [ethereum-mainnet]

orders:
  defaultPaymentWindowMinutes: 15
  defaultGracePeriodMinutes: 5

delayedConfirmation:
  checkInterval: 30000
  maxPendingTransactions: 5000
```

### Step 3: Use your custom configuration

```typescript
const processor = await Processor.create(
  {
    database: {
      connectionString: process.env.DATABASE_URL
    },
    monitor: {
      rpcKeys: {
        alchemy: process.env.ALCHEMY_API_KEY,
        infura: process.env.INFURA_API_KEY
      }
    }
  },
  'custom.yaml'  // Load your custom config
);
```

## New Feature: Automatic Chain Inheritance

🆕 **Monitor chains now automatically inherit from processor chains!**

```yaml
# Define all supported chains
chains:
  ethereum-sepolia:
    protocol: evm
    name: Ethereum Sepolia
    network: testnet
  polygon-amoy:
    protocol: evm
    name: Polygon Amoy
    network: testnet

# Monitor configuration
monitor:
  # Option 1: Don't specify chains (recommended)
  # → Monitor will automatically track ALL chains defined above

  # Option 2: Specify a subset (optional)
  # chains: [ethereum-sepolia]
  # → Monitor will only track ethereum-sepolia

  rpcKeys:
    alchemy: "your-key"
```

**Key benefits:**
- ✅ Reduces configuration duplication (DRY)
- ✅ Single source of truth for supported chains
- ✅ Validation ensures monitor.chains is a subset of processor.chains

## Security Best Practices

⚠️ **NEVER commit sensitive information to version control!**

### ✅ DO:
- Store secrets in environment variables
- Use `.env` files for local development (already in `.gitignore`)
- Pass RPC keys via runtime configuration
- Document required environment variables

### ❌ DON'T:
- Hardcode credentials in YAML files
- Commit `.env` files
- Include API keys in version control

## Configuration Reference

For a complete list of all configuration options, see:
- **Source code**: `src/core/processor-config-manager.ts`
- **Default values**: `config/default.yaml`
- **Type definitions**: `ProcessorConfig` interface

## Troubleshooting

### Issue: "No chains could be configured"

**Cause**: No valid RPC providers with API keys for the requested chains.

**Solution**: Ensure you provide RPC keys for at least one provider that supports your chains:

```typescript
const processor = await Processor.create({
  monitor: {
    rpcKeys: {
      alchemy: 'your-alchemy-key',  // Supports Ethereum, Polygon
      infura: 'your-infura-key'     // Supports Ethereum, Polygon
    }
  }
});
```

### Issue: "Invalid chains in monitor configuration"

**Cause**: `monitor.chains` contains chains not defined in `processor.chains`.

**Solution**: Ensure all chains in `monitor.chains` are also defined in `processor.chains`:

```yaml
chains:
  ethereum-sepolia: {...}
  polygon-amoy: {...}

monitor:
  chains:
    - ethereum-sepolia  # ✅ Valid - defined above
    - polygon-amoy      # ✅ Valid - defined above
    # - tron-nile       # ❌ Invalid - not in processor.chains
```
