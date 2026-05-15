# @payin/wallet-core

Core wallet logic for PayIn wallet tools.

## Features

- ✅ HD wallet address generation (EVM, Tron, Solana)
- ✅ Mnemonic phrase handling
- ✅ Address verification
- ✅ Environment-specific configuration
- ✅ TypeScript support

## Usage

```typescript
import { generateAddresses, createOrImportMnemonic, createWalletInfo } from '@payin/wallet-core';

// Generate new mnemonic
const mnemonic = createOrImportMnemonic();

// Get wallet info
const walletInfo = createWalletInfo(mnemonic, 'evm');

// Generate addresses
const addresses = generateAddresses('evm', mnemonic, 0, 10);
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test
```
