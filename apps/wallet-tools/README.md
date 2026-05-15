# PayIn Wallet Tools

Multi-platform HD wallet address generation tool for PayIn payment system.

## 🎯 Platforms

| Platform | Purpose | Status | Features |
|----------|---------|--------|----------|
| **Browser Extension** | Production use | 🚧 In Progress | Full features, offline, secure |
| **Web Application** | Testing/Demo | 🚧 In Progress | Limited features, warnings |
| **CLI Tool** | Automation | ⏳ To Migrate | Full features, scriptable |

## 📦 Packages

```
apps/wallet-tools/
├── shared/
│   ├── core/      ✅ DONE - Core wallet logic (@payin/wallet-core)
│   └── ui/        🚧 TODO - Shared React components (@payin/wallet-ui)
├── extension/     ⏳ TODO - Browser extension (Chrome/Firefox/Edge)
├── web/           ⏳ TODO - Web application (test mode)
└── cli/           ⏳ TODO - CLI tool (migrate from address-tool)
```

## 🚀 Quick Start

### Install Dependencies

```bash
# Core package
cd apps/wallet-tools/shared/core
npm install

# UI package (when ready)
cd ../ui
npm install

# Extension (when ready)
cd ../../extension
npm install

# Web (when ready)
cd ../web
npm install
```

### Development

```bash
# Build core package
cd shared/core
npm run build

# Watch mode
npm run dev
```

## 📚 Documentation

- [**Technical Design**](./TECHNICAL_DESIGN.md) - Complete architecture and implementation guide
- [**Component Spec**](./TECHNICAL_DESIGN.md#required-ui-components) - UI component specifications
- [**Security Guidelines**](./TECHNICAL_DESIGN.md#security-considerations) - Security best practices

## 🎨 Design System

Based on `apps/admin` style:
- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React

### Visual Differentiation

**Extension** (Production):
- ✅ Green theme - Safe and secure
- ✅ Full features unlocked
- ✅ Minimal warnings

**Web** (Test Mode):
- ⚠️ Orange theme - Warning
- ⚠️ Feature restrictions
- ⚠️ Prominent warnings

## 🔧 Development Status

### ✅ Completed
- [x] Project structure
- [x] @payin/wallet-core package
- [x] HD wallet logic (EVM, Tron, Solana)
- [x] Environment-based configuration
- [x] Type definitions

### 🚧 In Progress
- [ ] @payin/wallet-ui components
- [ ] Base UI components (from admin)
- [ ] Custom wallet components

### ⏳ Planned
- [ ] Browser extension
- [ ] Web application
- [ ] CLI tool migration
- [ ] Documentation
- [ ] Testing

## 📖 Usage Examples

### Core Package

```typescript
import {
  generateAddresses,
  createOrImportMnemonic,
  createWalletInfo,
  getEnvironmentLimits
} from '@payin/wallet-core';

// Generate new mnemonic
const mnemonic = createOrImportMnemonic();

// Get wallet info
const walletInfo = createWalletInfo(mnemonic, 'evm');
console.log('Master Public Key:', walletInfo.masterPublicKey);

// Generate 10 addresses
const addresses = generateAddresses('evm', mnemonic, 0, 10);
console.log('Generated addresses:', addresses);

// Check environment limits
const limits = getEnvironmentLimits('web');
console.log('Max addresses:', limits.maxAddressCount); // 10 for web
```

### UI Components (Planned)

```tsx
import {
  ProtocolSelector,
  GenerationForm,
  AddressTable,
  SecurityWarning
} from '@payin/wallet-ui';

function App() {
  return (
    <div>
      <SecurityWarning mode="extension" />
      <ProtocolSelector value={protocol} onChange={setProtocol} />
      <GenerationForm onGenerate={handleGenerate} limits={limits} />
      <AddressTable addresses={addresses} protocol={protocol} />
    </div>
  );
}
```

## 🔐 Security

- ✅ All cryptographic operations are local
- ✅ No private key transmission
- ✅ Environment-specific restrictions
- ✅ Open source and auditable
- ⚠️ Web version: test mode only, limited features

## 📝 Next Steps

Follow the [Technical Design Document](./TECHNICAL_DESIGN.md) for detailed implementation steps:

1. **Phase 1**: Complete UI package
2. **Phase 2**: Build browser extension
3. **Phase 3**: Build web version
4. **Phase 4**: Migrate CLI tool

## 🤝 Contributing

This is part of the PayIn project. See main repository for contribution guidelines.

## 📄 License

Apache-2.0 - PayIn Open Project
