# Monitor Environment Variables Guide

This document describes all environment variables supported by the @payin/monitor package.

## 🔑 API Keys (Auto-Discovery)

The monitor automatically discovers RPC provider API keys using the pattern `RPC_{PROVIDER}_KEY`:

```bash
# Required: RPC Provider API Keys
RPC_ALCHEMY_KEY=your_alchemy_api_key
RPC_INFURA_KEY=your_infura_api_key
RPC_ANKR_KEY=your_ankr_api_key
RPC_TRONGRID_KEY=your_trongrid_api_key

# The monitor will automatically:
# 1. Discover all RPC_*_KEY environment variables
# 2. Enable corresponding providers for supported chains
# 3. Skip providers without keys (with debug logging)
```

## 📁 Configuration Files

Control which configuration files are loaded:

```bash
# Override default configuration
MONITOR_CONFIG_FILE=/path/to/your/custom-config.yaml

# Examples:
MONITOR_CONFIG_FILE=./config/production.yaml
MONITOR_CONFIG_FILE=/etc/monitor/custom.yaml
MONITOR_CONFIG_FILE=../shared-config/monitor.yaml
```

## ⚙️ Global Settings Override

Override global monitor and RPC settings:

```bash
# RPC Settings
MONITOR_DEFAULT_TIMEOUT=5000              # Default RPC timeout (ms)
MONITOR_MAX_RETRIES=3                     # Default retry attempts

# Monitor Settings
MONITOR_SCAN_INTERVAL=10000               # Block scanning interval (ms)
MONITOR_MAX_CONFIRMATIONS=3               # Default confirmation requirement
MONITOR_MAX_BLOCK_RANGE=1000              # Maximum blocks per scan batch
```

## 🔗 Chain-Specific Provider Preferences

Configure provider preferences per chain using the pattern `MONITOR_{CHAIN}_PROVIDERS`:

```bash
# Ethereum Mainnet
MONITOR_ETHEREUM_MAINNET_PROVIDERS=alchemy,infura,publicnode

# Ethereum Sepolia Testnet
MONITOR_ETHEREUM_SEPOLIA_PROVIDERS=alchemy,infura

# Polygon
MONITOR_POLYGON_MAINNET_PROVIDERS=alchemy,ankr,publicnode
MONITOR_POLYGON_AMOY_PROVIDERS=alchemy,ankr

# Tron
MONITOR_TRON_MAINNET_PROVIDERS=trongrid
MONITOR_TRON_NILE_PROVIDERS=trongrid

# Provider ordering:
# - Listed providers are preferred in the specified order
# - Unlisted providers are used as fallbacks (if available)
# - Providers without API keys are automatically skipped
```

## 🚀 Complete Environment Examples

### Development Environment
```bash
# API Keys
RPC_ALCHEMY_KEY=your_dev_alchemy_key
RPC_INFURA_KEY=your_dev_infura_key

# Custom config for development
MONITOR_CONFIG_FILE=./config/examples/development.yaml

# Development-specific overrides
MONITOR_SCAN_INTERVAL=5000                # Faster scanning for dev
MONITOR_MAX_CONFIRMATIONS=1               # Fast confirmations
MONITOR_DEFAULT_TIMEOUT=10000             # Longer timeout for debugging
```

### Production Environment
```bash
# API Keys
RPC_ALCHEMY_KEY=your_prod_alchemy_key
RPC_INFURA_KEY=your_prod_infura_key
RPC_ANKR_KEY=your_ankr_key

# Production configuration
MONITOR_CONFIG_FILE=/etc/monitor/production.yaml

# Production-specific settings
MONITOR_MAX_CONFIRMATIONS=6               # High security
MONITOR_DEFAULT_TIMEOUT=3000              # Tight timeouts
MONITOR_ETHEREUM_MAINNET_PROVIDERS=alchemy,infura
MONITOR_POLYGON_MAINNET_PROVIDERS=alchemy,ankr
```

### Minimal Setup (Testing)
```bash
# Only essential API key
RPC_ALCHEMY_KEY=your_alchemy_key

# All other settings use built-in defaults
# Monitor will use Alchemy for all supported chains
```

## 🔍 Environment Variable Priority

Settings are applied in this priority order (low to high):

1. **Built-in defaults** (code)
2. **Default config file** (`config/default.yaml`)
3. **Custom config file** (`MONITOR_CONFIG_FILE`)
4. **Environment variables** (`MONITOR_*`, `RPC_*_KEY`)
5. **Runtime configuration** (constructor parameters)

## 📋 Environment Variable Reference

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `RPC_{PROVIDER}_KEY` | string | API key for RPC provider | `RPC_ALCHEMY_KEY=abc123` |
| `MONITOR_CONFIG_FILE` | string | Path to custom config file | `/path/to/config.yaml` |
| `MONITOR_DEFAULT_TIMEOUT` | number | Default RPC timeout (ms) | `5000` |
| `MONITOR_MAX_RETRIES` | number | Default retry attempts | `3` |
| `MONITOR_SCAN_INTERVAL` | number | Block scan interval (ms) | `10000` |
| `MONITOR_MAX_CONFIRMATIONS` | number | Default confirmations | `3` |
| `MONITOR_MAX_BLOCK_RANGE` | number | Max blocks per batch | `1000` |
| `MONITOR_{CHAIN}_PROVIDERS` | string | Provider preference list | `alchemy,infura` |

## 🛠️ Debugging Environment Configuration

Enable debug logging to see how environment variables are processed:

```bash
# View configuration loading process
DEBUG=monitor:config node your-app.js

# Check which API keys are discovered
DEBUG=monitor:rpc node your-app.js

# See provider selection for each chain
DEBUG=monitor:provider-selection node your-app.js
```

## 🔧 Validation and Error Handling

The monitor validates environment variables and provides helpful error messages:

- **Invalid timeout values**: Must be positive integers
- **Unknown providers**: Warns about unrecognized provider names
- **Missing required chains**: Errors if no providers available for requested chains
- **Invalid chain names**: Suggests correct chain identifiers

Common validation errors and solutions:

```bash
# Error: No providers available for chain 'ethereum'
# Solution: Use correct chain name
MONITOR_ETHEREUM_MAINNET_PROVIDERS=alchemy,infura  # ✅ Correct
MONITOR_ETHEREUM_PROVIDERS=alchemy,infura          # ❌ Wrong

# Error: Provider 'alakemy' not found
# Solution: Check provider name spelling
RPC_ALCHEMY_KEY=your_key                           # ✅ Correct
RPC_ALAKEMY_KEY=your_key                           # ❌ Typo
```