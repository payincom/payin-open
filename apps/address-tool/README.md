# PayIn Address Tool

HD wallet address generation and management tool for PayIn payment system.

## Overview

This CLI tool helps you generate and manage blockchain addresses for use with the PayIn payment system. It supports:
- **EVM-compatible chains** (Ethereum, Polygon, etc.)
- **Tron** blockchain
- **Solana** blockchain

## Features

### Phase 1 (Current)

- ✅ **Generate Addresses**: Create new HD wallet addresses with mnemonic phrase
- ✅ **Verify Address**: Check if an address belongs to your wallet
- 📋 **CSV Export**: Export addresses in PayIn-compatible CSV format

### Phase 2 (Coming Soon)

- 📊 **Balance Statistics**: Check balances across all chains
- 💰 **Fund Collection**: Collect funds from multiple addresses

## Installation

```bash
cd apps/address-tool
npm install
```

## Usage

### Start the Tool

```bash
npm start
```

### Generate New Addresses

1. Select protocol (EVM, Tron, or Solana)
2. Choose to generate new mnemonic or import existing one
3. Set derivation index range (start index + count)
4. Review and confirm
5. Export to CSV

The generated CSV file can be directly imported to PayIn Admin UI.

### Verify Address Ownership

1. Select protocol
2. Enter your mnemonic phrase
3. Enter the address to verify
4. Set search range (default: 1000)
5. View verification result

## Security

### ⚠️ IMPORTANT SECURITY NOTICE

This tool handles sensitive mnemonic phrases and private keys. **ALWAYS** follow these security practices:

1. **Offline Operation** (Recommended for address generation):
   - Disconnect from network
   - Generate addresses and export CSV
   - Securely save mnemonic and CSV files
   - Reconnect to network

2. **Mnemonic Storage**:
   - Write down your mnemonic phrase
   - Store it in a secure, offline location
   - This tool does NOT save your mnemonic
   - Anyone with the mnemonic can access your funds

3. **Private Keys**:
   - Private keys are derived locally and never transmitted
   - CSV exports contain only public addresses and derivation info
   - Keep CSV files secure (they enable address tracking)

## CSV Format

### Simplified Format (Two Columns)

```csv
address,derivation_index
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0,0
0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE,1
```

This format includes:
- `address`: The blockchain address
- `derivation_index`: HD wallet derivation index

## Derivation Paths

### EVM Chains (Ethereum, Polygon, etc.)
- Standard path: `m/44'/60'/0'/0/{index}`
- Coin type: 60
- Uses BIP32 extended public keys (xpub)

### Tron Chain
- Standard path: `m/44'/195'/0'/0/{index}`
- Coin type: 195
- Uses BIP32 extended public keys (xpub)

### Solana Chain
- Standard path: `m/44'/501'/{index}'/0'`
- Coin type: 501
- Uses Ed25519 with SLIP-0010 (hardened derivation)

### Custom Paths
You can specify custom derivation paths when generating addresses. Use `{index}` as a placeholder for the derivation index.

### ⚠️ Important: Solana Limitations

**Solana uses Ed25519 cryptography with hardened derivation (SLIP-0010), which has important differences from EVM/Tron:**

1. **No Public Key Derivation**: Unlike EVM/Tron, you **cannot** derive child addresses from the master public key
2. **Account-level Identifier Only**: The `master_public_key` field for Solana contains the account-level public key (`m/44'/501'/0'`) as a **wallet identifier only**
3. **Full Mnemonic Required**: To generate or verify Solana addresses, you must have the full mnemonic phrase
4. **Address Verification**: Address verification works normally (requires mnemonic), but the master public key cannot be used for verification

**What this means:**
- ✅ Address generation: Works perfectly with mnemonic
- ✅ Address tracking: derivation_index + master_public_key identify which wallet generated the address
- ✅ CSV import: Compatible with PayIn Admin UI
- ❌ Child address derivation: Cannot generate new addresses from public key alone
- ❌ Public key verification: Cannot verify address belongs to wallet using only public key

**This is a fundamental cryptographic difference**, not a limitation of this tool. All Solana wallets work this way due to Ed25519's security properties.

## Examples

### Example 1: Generate 100 EVM Addresses

```
1. Select: Generate New Addresses
2. Protocol: EVM
3. Mnemonic: Generate new mnemonic
4. Start index: 0
5. Count: 100
6. Confirm and export
```

Result: `evm-addresses-2025-01-16-full.csv` with 100 addresses

### Example 2: Verify Address Ownership

```
1. Select: Verify Address Ownership
2. Protocol: EVM
3. Enter mnemonic: [your 12/24 word phrase]
4. Enter address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
5. Search range: 1000
```

Result: Shows if address belongs to wallet and its derivation index

## Integration with PayIn Admin

1. Generate addresses using this tool
2. Export to CSV (address,derivation_index format)
3. Open PayIn Admin UI
4. Navigate to Address Pool
5. Select protocol (EVM, Tron, or Solana)
6. Click "Import Addresses"
7. Upload the CSV file or paste addresses

## File Structure

```
apps/address-tool/
├── src/
│   ├── commands/
│   │   ├── generate.ts    # Address generation command
│   │   └── verify.ts      # Address verification command
│   ├── utils/
│   │   ├── wallet.ts      # HD wallet operations
│   │   ├── csv.ts         # CSV export utilities
│   │   └── security.ts    # Security warnings and display
│   ├── types.ts           # TypeScript type definitions
│   └── index.ts           # CLI entry point
├── output/                # Generated CSV files (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### "Invalid mnemonic phrase"
- Ensure you have exactly 12 or 24 words
- Check for typos and extra spaces
- Mnemonic is case-sensitive

### "Address not found in wallet"
- Try increasing the search range
- Verify you're using the correct protocol
- Double-check the mnemonic phrase

### "CSV import failed in Admin UI"
- Ensure CSV has correct format (4 columns)
- Check that protocol matches the import target
- Verify no special characters in addresses

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Dependencies

- **ethers**: Ethereum library for HD wallet operations (EVM chains)
- **tronweb**: Tron blockchain library
- **@solana/web3.js**: Solana blockchain library
- **ed25519-hd-key**: Ed25519 HD key derivation for Solana
- **bip39**: Mnemonic phrase generation and validation
- **inquirer**: Interactive CLI prompts
- **chalk**: Terminal string styling
- **ora**: Terminal spinners
- **csv-stringify**: CSV generation

## License

Apache-2.0 - PayIn Open Project

## Support

For issues and questions, please contact the PayIn development team.

## Version History

### v1.1.0 (2025-10-16)
- ✅ Added Solana blockchain support
- ✅ Support for Ed25519 key derivation (SLIP-0010)
- ✅ Account-level public key as wallet identifier
- ✅ Documentation updated with Solana limitations
- ✅ All tests passing (EVM + Tron + Solana)

### v1.0.0 (2025-01-16)
- ✅ Initial release
- ✅ Generate addresses (EVM + Tron)
- ✅ Verify address ownership
- ✅ CSV export
- ✅ Security warnings
