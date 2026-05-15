# Processor Configuration Guide

This document provides comprehensive instructions on how to configure the PayIn Processor system.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Configuration Methods](#configuration-methods)
- [Configuration Priority](#configuration-priority)
- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Configuration Options](#configuration-options)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [FAQ](#faq)

---

## Configuration Overview

Processor provides a flexible multi-layer configuration system that supports:

- 📁 **Configuration Files** - Manage settings using YAML format
- 🔑 **Environment Variables** - Override sensitive data and environment-specific settings
- 💻 **Code Configuration** - Provide configuration directly in code
- 🎯 **Environment Adaptive** - Auto-select configuration based on `NODE_ENV`

Configuration file location: `packages/processor/config/`

---

## Configuration Methods

Processor supports four configuration methods that can be flexibly combined:

### 1. Configuration Files (Recommended)

Use YAML files to manage configurations with multi-environment support:

```bash
# Use development environment config
NODE_ENV=development npm start

# Use production environment config
NODE_ENV=production npm start

# Use test environment config
NODE_ENV=test npm test
```

**Advantages**:
- ✅ Clear configuration structure
- ✅ Supports comments and documentation
- ✅ Version control friendly
- ✅ Easy multi-environment management

### 2. Custom Configuration File

Create `config/custom.yaml` for local overrides (already in .gitignore):

```bash
# Copy example config
cp config/config.example.yaml config/custom.yaml

# Edit custom config
nano config/custom.yaml

# Start (auto-loads custom.yaml)
npm start
```

**Advantages**:
- ✅ Flexible local development
- ✅ Doesn't affect team configuration
- ✅ Not committed to version control

### 3. Environment Variables (Production Recommended)

Set configuration via environment variables, suitable for production:

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export RPC_ALCHEMY_KEY="your_alchemy_key"
export NODE_ENV=production

# Start
npm start
```

**Advantages**:
- ✅ High security (not saved in files)
- ✅ CI/CD friendly
- ✅ Container deployment friendly
- ✅ Dynamic configuration updates

### 4. Code Configuration

Provide configuration directly in code:

```typescript
import { Processor } from '@payin/processor';

const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  },
  monitor: {
    chains: ['ethereum-sepolia', 'polygon-amoy']
  },
  orders: {
    defaultPaymentWindowMinutes: 15
  }
});

await processor.start();
```

**Advantages**:
- ✅ Full control over configuration
- ✅ Suitable for testing scenarios
- ✅ Backward compatible

---

## Configuration Priority

Configuration loading order (later overrides earlier):

```
1. Built-in defaults (defined in code)
   ↓
2. config/default.yaml
   ↓
3. config/{environment}.yaml
   (development.yaml / production.yaml / test.yaml)
   ↓
4. config/custom.yaml
   (local custom configuration)
   ↓
5. Code-provided configuration
   (Processor.create(config))
   ↓
6. Environment variables
   (DATABASE_URL, PROCESSOR_DB_*, RPC_*_KEY, etc.)
```

**Environment variables have the highest priority**, suitable for overriding sensitive configurations in production.

---

## Configuration Files

### File Structure

```
packages/processor/config/
├── default.yaml           # Base default configuration
├── development.yaml       # Development environment config
├── production.yaml        # Production environment config
├── test.yaml             # Test environment config
├── config.example.yaml   # Complete configuration example
├── custom.yaml           # Custom config (create yourself)
└── README.md             # Configuration guide
```

### default.yaml - Base Configuration

Contains default values for all configuration items, applicable to all environments:

```yaml
database:
  host: localhost
  port: 5432
  database: payin
  username: postgres
  password: ""
  maxConnections: 10
  ssl: false

monitor:
  chains:
    - ethereum-sepolia
    - polygon-amoy
  targets: []

services:
  orders: true
  deposits: true

orders:
  defaultPaymentWindowMinutes: 10
  defaultGracePeriodMinutes: 5
  maxTotalTimeoutMinutes: 60
  maintenanceIntervalMs: 60000

# ... more configuration items
```

### development.yaml - Development Environment

Development-specific settings, suitable for local development:

```yaml
database:
  database: payin_dev

orders:
  defaultPaymentWindowMinutes: 30  # Longer payment window for testing
  defaultGracePeriodMinutes: 10

delayedConfirmation:
  checkInterval: 10000  # More frequent checks (10 seconds)

deposits:
  poolManagement:
    defaultCooldownMinutes: 5  # Shorter cooldown for testing
```

### production.yaml - Production Environment

Production configuration, focused on performance and security:

```yaml
database:
  maxConnections: 20  # More connections for production load
  ssl: true          # Enable SSL

monitor:
  chains:
    - ethereum-mainnet
    - polygon-mainnet
    - tron-mainnet

orders:
  maintenanceIntervalMs: 30000  # More frequent maintenance

delayedConfirmation:
  maxPendingTransactions: 5000  # Higher limit for production

deposits:
  poolManagement:
    maxPoolSize: 100000         # Large address pool
    lowPoolThreshold: 1000
```

### test.yaml - Test Environment

Test configuration for fast test execution:

```yaml
database:
  database: payin_test

orders:
  defaultPaymentWindowMinutes: 5  # Short time window
  maintenanceIntervalMs: 5000

delayedConfirmation:
  checkInterval: 1000  # Check every second
  maxPendingTime: 60000

deposits:
  poolManagement:
    defaultCooldownMinutes: 1  # Very short cooldown
    maxPoolSize: 100
```

---

## Environment Variables

### Database Configuration

#### Method 1: Connection String (Recommended)

```bash
# Standard connection string
DATABASE_URL="postgresql://user:password@host:5432/database?ssl=true"

# Or use Processor-specific variable
PROCESSOR_DB_URL="postgresql://user:password@host:5432/database"
```

#### Method 2: Individual Parameters

```bash
PROCESSOR_DB_HOST=localhost
PROCESSOR_DB_PORT=5432
PROCESSOR_DB_NAME=payin
PROCESSOR_DB_USER=postgres
PROCESSOR_DB_PASSWORD=your_password
PROCESSOR_DB_MAX_CONNECTIONS=20
PROCESSOR_DB_SSL=true
```

**Note**: `DATABASE_URL` or `PROCESSOR_DB_URL` has higher priority than individual parameters.

### RPC Provider API Keys

```bash
# Alchemy (Ethereum, Polygon)
RPC_ALCHEMY_KEY=your_alchemy_api_key

# Infura (Ethereum, Polygon)
RPC_INFURA_KEY=your_infura_api_key

# Ankr (Multi-chain)
RPC_ANKR_KEY=your_ankr_api_key

# TronGrid (Tron)
RPC_TRONGRID_KEY=your_trongrid_api_key
```

### Application Settings

```bash
# Environment (development, production, test)
NODE_ENV=production

# Custom config file (optional)
PROCESSOR_CONFIG_FILE=custom.yaml

# Skip database initialization (for testing)
SKIP_INIT_DB=false
```

### Environment Variable File

It's recommended to use a `.env` file to manage environment variables:

```bash
# Copy example file
cp .env.example .env

# Edit .env file
nano .env

# Start (auto-loads .env)
npm start
```

**Important**: `.env` file is in `.gitignore` and won't be committed to version control.

---

## Configuration Options

### database - Database Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | string | - | PostgreSQL connection string, highest priority |
| `host` | string | localhost | Database host |
| `port` | number | 5432 | Database port |
| `database` | string | payin | Database name |
| `username` | string | postgres | Database username |
| `password` | string | "" | Database password |
| `maxConnections` | number | 10 | Maximum connections |
| `ssl` | boolean | false | Enable SSL |

### monitor - Monitor Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chains` | string[] | ['ethereum-sepolia', 'polygon-amoy'] | Blockchain networks to monitor |
| `targets` | object[] | [] | Initial monitor targets (usually empty, added dynamically) |

### services - Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orders` | boolean | true | Enable order payment service |
| `deposits` | boolean | true | Enable user deposit service |

### orders - Order Service Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPaymentWindowMinutes` | number | 10 | Default payment window (minutes) |
| `defaultGracePeriodMinutes` | number | 5 | Grace period after payment window (minutes) |
| `maxTotalTimeoutMinutes` | number | 60 | Maximum total timeout (minutes) |
| `maintenanceIntervalMs` | number | 60000 | Maintenance task interval (milliseconds) |

### delayedConfirmation - Delayed Confirmation Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable delayed confirmation service |
| `checkInterval` | number | 30000 | Check interval (milliseconds) |
| `maxPendingTime` | number | 600000 | Maximum pending time (milliseconds) |
| `maxPendingTransactions` | number | 1000 | Maximum pending transactions |
| `maxRetries` | number | 3 | Maximum retry attempts |

### deposits - Deposit Service Configuration

#### poolManagement - Address Pool Management

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultCooldownMinutes` | number | 30 | Address cooldown period (minutes) |
| `maxPoolSize` | number | 10000 | Maximum address pool size |
| `lowPoolThreshold` | number | 100 | Low pool warning threshold |

#### importValidation - Import Validation

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validateDerivationPath` | boolean | true | Validate HD wallet derivation path |
| `maxImportBatchSize` | number | 1000 | Maximum batch import size |

### tokens - Token Configuration

Define supported tokens and their chain-specific settings:

```yaml
tokens:
  USDC:
    decimals: 6
    chains:
      ethereum-mainnet:
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        confirmations: 12
      ethereum-sepolia:
        contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        confirmations: 3
```

---

## Usage Examples

### Scenario 1: Local Development

Simplest approach using default configuration:

```bash
# 1. Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payin_dev"
export RPC_ALCHEMY_KEY="your_test_key"

# 2. Start (auto-uses development.yaml)
NODE_ENV=development npm start
```

### Scenario 2: Custom Local Configuration

When you need special configuration:

```bash
# 1. Create custom config
cp config/config.example.yaml config/custom.yaml

# 2. Edit custom.yaml
nano config/custom.yaml

# 3. Set environment variables (sensitive data)
export DATABASE_URL="postgresql://..."
export RPC_ALCHEMY_KEY="..."

# 4. Start
npm start
```

### Scenario 3: Production Deployment (Docker)

Deploy using environment variables:

```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

```bash
# docker-compose.yml
version: '3.8'
services:
  processor:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/payin
      - RPC_ALCHEMY_KEY=${RPC_ALCHEMY_KEY}
      - RPC_INFURA_KEY=${RPC_INFURA_KEY}
    depends_on:
      - db
```

```bash
# Start
docker-compose up
```

### Scenario 4: Test Environment

Tests automatically use test.yaml configuration:

```bash
# Run tests (auto-uses test.yaml)
npm test

# Run specific test
npm test -- tests/scenarios/order-single-payment.test.ts
```

### Scenario 5: CI/CD Environment

Use environment variables in CI/CD:

```yaml
# .github/workflows/test.yml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      RPC_ALCHEMY_KEY: ${{ secrets.RPC_ALCHEMY_KEY }}
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
```

### Scenario 6: Code Configuration (Advanced)

Full control over configuration:

```typescript
import { Processor } from '@payin/processor';

const processor = await Processor.create({
  database: {
    connectionString: process.env.DATABASE_URL
  },
  monitor: {
    chains: ['ethereum-mainnet', 'polygon-mainnet'],
    targets: []
  },
  services: {
    orders: true,
    deposits: true
  },
  orders: {
    defaultPaymentWindowMinutes: 15,
    defaultGracePeriodMinutes: 7
  },
  delayedConfirmation: {
    enabled: true,
    checkInterval: 20000
  },
  deposits: {
    poolManagement: {
      defaultCooldownMinutes: 45,
      maxPoolSize: 50000
    }
  }
});

await processor.start();
```

---

## Best Practices

### 🔐 Security

1. **Never commit sensitive information to version control**
   ```bash
   # ✅ Correct: Use environment variables
   export DATABASE_URL="postgresql://..."

   # ❌ Wrong: Hardcode in config files
   database:
     connectionString: "postgresql://user:pass@..."
   ```

2. **Use .env file for local environment variables**
   ```bash
   # ✅ .env is already in .gitignore
   cp .env.example .env
   nano .env
   ```

3. **Production environments should use environment variables, not config files**
   ```bash
   # ✅ Production environment
   export DATABASE_URL="..."
   export RPC_ALCHEMY_KEY="..."
   NODE_ENV=production npm start
   ```

### 🎯 Environment Management

1. **Development**: Use `development.yaml` + `.env`
2. **Testing**: Use `test.yaml` + CI environment variables
3. **Production**: Use `production.yaml` + server/container environment variables

### 📝 Config File Management

1. **default.yaml** - Only non-sensitive default values
2. **{environment}.yaml** - Environment-specific settings (can commit)
3. **custom.yaml** - Local overrides (don't commit, already in .gitignore)

### 🔄 Configuration Updates

1. **Update config files**: Requires application restart
2. **Update environment variables**: Requires application restart
3. **Code configuration**: Takes effect when creating Processor instance

---

## FAQ

### Q1: How to view current configuration?

Configuration loading outputs to console:

```
✅ Loaded config from: default.yaml
✅ Loaded config from: development.yaml
✅ Loaded config from: custom.yaml
```

### Q2: Environment variables not taking effect?

Check in order:
1. Confirm environment variable is set: `echo $DATABASE_URL`
2. Confirm exported before start command: `export DATABASE_URL=...`
3. Confirm not overridden by code configuration

### Q3: How to use different configs in different environments?

Use `NODE_ENV` environment variable:

```bash
# Development
NODE_ENV=development npm start

# Production
NODE_ENV=production npm start

# Test
NODE_ENV=test npm test
```

### Q4: What if config file not found?

1. Confirm config file is in `packages/processor/config/` directory
2. Confirm working directory is correct (should be in processor package directory)
3. Config files are not required, system will use built-in defaults

### Q5: How to override partial configuration?

Configurations are deep merged, only provide parts to override:

```typescript
// Only override order config, others use defaults
await Processor.create({
  orders: {
    defaultPaymentWindowMinutes: 15
  }
});
```

### Q6: How to skip database initialization in tests?

Set environment variable:

```bash
SKIP_INIT_DB=true npm test
```

### Q7: How to add new token configuration?

Add in `custom.yaml` or code:

```yaml
tokens:
  DAI:
    decimals: 18
    chains:
      ethereum-mainnet:
        contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        confirmations: 12
```

### Q8: How to view all available configuration options?

Check `config/config.example.yaml`, which contains complete documentation for all configuration items.

### Q9: What is the configuration priority?

From low to high:
1. Built-in defaults
2. default.yaml
3. {environment}.yaml
4. custom.yaml
5. Code configuration
6. Environment variables (highest)

### Q10: How to configure in Docker?

Use environment variables:

```yaml
# docker-compose.yml
services:
  processor:
    image: processor:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - RPC_ALCHEMY_KEY=${RPC_ALCHEMY_KEY}
```

---

## Related Documentation

- [Processor Main Documentation](./processor-configuration.en.md)
- [Monitor RPC Configuration](./rpc-configuration.en.md)
- [Configuration File Example](../../packages/processor/config/default.yaml)
- [Environment Variables Example](../../packages/processor/.env.example)

---

## Technical Support

For questions, please refer to:
- GitHub Issues: https://github.com/your-repo/payin/issues
- Configuration Example: `packages/processor/config/config.example.yaml`
- Quick Start: `packages/processor/config/README.md`