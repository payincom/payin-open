# Adding a New Chain to Processor

This guide demonstrates how to add a new blockchain to the PayIn Processor system.

## Example: Adding Arbitrum Mainnet

### Step 1: Update Processor Configuration (`config/default.yaml`)

Add the new chain with all required fields:

```yaml
chains:
  # ... existing chains ...

  arbitrum-mainnet:
    protocol: evm
    name: Arbitrum Mainnet
    network: mainnet
    confirmations: 20         # Required block confirmations
```

### Step 2: Add Token Contracts (if applicable)

Add contract addresses for tokens that are deployed on the new chain:

```yaml
tokens:
  USDC:
    symbol: USDC
    name: USD Coin
    decimals: 6
    contracts:
      # ... existing chains ...
      arbitrum-mainnet: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

  USDT:
    symbol: USDT
    name: Tether USD
    decimals: 6
    contracts:
      arbitrum-mainnet: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
```

### Step 3: Configure RPC Providers (optional)

Add RPC configuration for the new chain:

```yaml
rpc:
  chains:
    arbitrum-mainnet:
      preferredProviders: [alchemy, ankr]
      timeout: 5000
```

### Step 4: (Optional) Add Custom RPC Provider

If you need a provider not supported by Monitor:

```yaml
rpc:
  providers:
    quicknode:
      displayName: "QuickNode"
      authType: url_path
      urlPattern: "https://{network}.quiknode.pro/{apiKey}"
      supportedNetworks: [arbitrum-mainnet]
      networkMappings:
        arbitrum-mainnet: arbitrum-mainnet
      defaultSettings:
        timeout: 5000
        weight: 95
        maxRequestsPerSecond: 15

  chains:
    arbitrum-mainnet:
      preferredProviders: [quicknode, alchemy]
```

### Step 5: Verify Configuration

No code changes needed! The system will automatically:
- ✅ Load chain configuration
- ✅ Extract confirmations from YAML
- ✅ Configure RPC providers
- ✅ Enable the chain for use

## Configuration Architecture

### Three-Layer System

```
┌─────────────────────────────────────┐
│ Processor YAML (One-Stop Config)    │
│ - Chain definitions + confirmations │
│ - Token contracts                   │
│ - RPC overrides                     │
└─────────────────────────────────────┘
              ↓ overrides
┌─────────────────────────────────────┐
│ Monitor YAML (Default RPC Templates)│
│ - Built-in provider templates       │
│ - Default RPC configurations        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Runtime (Merged Configuration)      │
│ - Processor config + Monitor config │
│ - API keys from database/env        │
└─────────────────────────────────────┘
```

### Benefits

1. **No Code Changes**: Add chains by editing YAML only
2. **Centralized Configuration**: All chain settings in one place
3. **Automatic Validation**: System validates configuration on startup
4. **Flexible Overrides**: Override Monitor defaults per chain
5. **Custom Providers**: Add your own RPC providers easily

## Testing New Chain

After adding configuration, test with:

```bash
# 1. Update Manager database (if using Manager)
npm run manager:init

# 2. Run integration tests
npm run test:integration

# 3. Create test order
const processor = await Processor.create();
await processor.start();

const order = await processor.createOrder({
  amount: "100000000",
  currency: "USDC",
  chainId: "arbitrum-mainnet",  // Your new chain!
  orderReference: "test-001"
});
```

## Troubleshooting

### Chain not found error
- Verify chain ID matches exactly in all configurations
- Check chains are enabled in `chains.enabled` (if using Manager)

### RPC provider error
- Ensure provider supports the chain's network
- Check `networkMappings` are correct
- Verify API keys are configured

### Contract not found error
- Confirm token contract address is correct
- Verify contract is deployed on the chain
- Check token is in `tokens.enabled` (if using Manager)

## Configuration Reference

### Chain Fields
- `protocol`: `evm` or `tron`
- `name`: Display name
- `network`: `mainnet` or `testnet`
- `confirmations`: Block confirmations (1-500)

### RPC Chain Settings
- `preferredProviders`: Provider priority order
- `timeout`: Request timeout in ms
- `strategy`: `round_robin`, `failover`, or `fastest`
- `maxRequestsPerSecond`: Rate limit per provider

### Token Contract Requirements
- Must be ERC20 (for EVM) or TRC20 (for Tron)
- Contract must be verified and active
- Decimals must match token definition
