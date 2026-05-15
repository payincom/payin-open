# PayIn Wallet Tools - Technical Design Document

## 📋 Overview

**Purpose**: Multi-platform HD wallet address generation tool
**Platforms**: CLI, Browser Extension (Production), Web (Test Only)
**Core Technology**: React + TypeScript + Tailwind CSS + shadcn/ui
**Architecture**: Monorepo with shared packages

---

## 🏗️ Project Structure

```
apps/wallet-tools/
├── cli/                    # CLI tool (migrate from address-tool)
├── extension/              # Browser extension (production environment)
├── web/                    # Web application (test environment only)
└── shared/
    ├── core/              # ✅ COMPLETED - Core wallet logic
    └── ui/                # 🚧 IN PROGRESS - Shared React components
```

---

## 📦 Package Architecture

### 1. @payin/wallet-core ✅ COMPLETED

**Location**: `apps/wallet-tools/shared/core/`
**Status**: Built and tested
**Exports**:
- `types.ts` - TypeScript type definitions
- `wallet.ts` - HD wallet operations (EVM, Tron, Solana)
- `config.ts` - Environment-specific limits

**Key Features**:
```typescript
// Environment detection
export function detectEnvironment(): Environment // 'cli' | 'web' | 'extension'

// Environment limits
export const ENVIRONMENT_LIMITS: Record<Environment, EnvironmentLimits> = {
  web: {
    maxAddressCount: 10,              // Test mode restriction
    allowMnemonicImport: false,       // Prevent real mnemonic import
    allowCustomPath: false,
    allowAddressVerification: false,
    showSecurityWarnings: true,
  },
  extension: {
    maxAddressCount: Infinity,        // No limits
    allowMnemonicImport: true,
    allowCustomPath: true,
    allowAddressVerification: true,
    showSecurityWarnings: false,
  },
  cli: { /* Full features */ }
}

// Core wallet operations
export function generateAddresses(protocol, mnemonic, startIndex, count, customPath?)
export function verifyAddress(protocol, mnemonic, targetAddress, searchRange)
export function createOrImportMnemonic(mnemonicPhrase?)
export function getMasterPublicKey(mnemonic, protocol)
```

**Build Command**: `npm run build`
**Output**: ESM + TypeScript declarations

---

### 2. @payin/wallet-ui 🚧 IN PROGRESS

**Location**: `apps/wallet-tools/shared/ui/`
**Design Reference**: `apps/admin` (Tailwind + shadcn/ui + Radix UI)
**Dependencies**: React 19, Radix UI, Lucide Icons

#### Required UI Components

##### Core Components (from shadcn/ui)
Copy from `apps/admin/src/components/ui/`:
- ✅ `button.tsx` - Primary/secondary/outline variants
- ✅ `input.tsx` - Text input with validation states
- ✅ `label.tsx` - Form labels
- ✅ `card.tsx` - Content containers
- ✅ `dialog.tsx` - Modal dialogs
- ✅ `select.tsx` - Dropdown selects
- ✅ `radio-group.tsx` - Radio button groups
- ✅ `tabs.tsx` - Tab navigation
- ✅ `badge.tsx` - Status badges
- ✅ `alert.tsx` - Warning/info messages

##### Custom Wallet Components (New)
Create in `apps/wallet-tools/shared/ui/src/components/`:

**1. ProtocolSelector.tsx**
```tsx
// Select blockchain protocol (EVM, Tron, Solana)
interface ProtocolSelectorProps {
  value: Protocol;
  onChange: (protocol: Protocol) => void;
  disabled?: boolean;
}
```

**2. MnemonicDisplay.tsx**
```tsx
// Display mnemonic phrase with copy/reveal controls
interface MnemonicDisplayProps {
  mnemonic: string;
  onCopy?: () => void;
  hideByDefault?: boolean; // For security
}
```

**3. MnemonicInput.tsx**
```tsx
// Import existing mnemonic (only in extension/cli)
interface MnemonicInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (valid: boolean) => void;
  disabled?: boolean; // Disabled in web version
}
```

**4. AddressTable.tsx**
```tsx
// Display generated addresses in table format
interface AddressTableProps {
  addresses: GeneratedAddress[];
  protocol: Protocol;
  onCopy?: (address: string) => void;
  showPrivateKeys?: boolean; // Hidden by default
}
```

**5. GenerationForm.tsx**
```tsx
// Main form for address generation
interface GenerationFormProps {
  onGenerate: (options: GenerateOptions) => void;
  limits: EnvironmentLimits; // From wallet-core
  isLoading?: boolean;
}
```

**6. SecurityWarning.tsx**
```tsx
// Warning banner for web version
interface SecurityWarningProps {
  mode: 'web' | 'extension';
  extensionDownloadUrl?: string;
}
```

**7. CSVExporter.tsx**
```tsx
// Export addresses to CSV
interface CSVExporterProps {
  addresses: AddressData[];
  protocol: Protocol;
  filename?: string;
}
```

##### Utility Components

**8. CopyButton.tsx**
```tsx
// Copy to clipboard with visual feedback
interface CopyButtonProps {
  value: string;
  label?: string;
}
```

**9. WalletInfoCard.tsx**
```tsx
// Display wallet master public key
interface WalletInfoCardProps {
  walletInfo: WalletInfo;
  onCopy?: () => void;
}
```

---

## 🎨 Design System (Match Admin Style)

### Color Scheme
```css
/* Copy from apps/admin/src/index.css */
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(240 10% 3.9%);
  --primary: hsl(240 5.9% 10%);
  --primary-foreground: hsl(0 0% 98%);
  /* ... full color system */
}

.dark {
  --background: hsl(222 14% 9%);
  --foreground: hsl(210 20% 98%);
  --primary: hsl(217 91% 60%);
  /* ... dark mode colors */
}
```

### Visual Differentiation

**Extension Version** (Production):
- Primary color: Green (`hsl(142 76% 36%)`) - Safe/Secure
- Badge: "Production Mode"
- No prominent warnings

**Web Version** (Test Only):
- Primary color: Orange (`hsl(38 92% 50%)`) - Warning
- Dashed border: `border: 2px dashed var(--destructive)`
- Watermark: "TEST MODE ONLY"
- Prominent warning banner at top

---

## 🔌 Browser Extension Implementation

### Manifest V3 Configuration

**File**: `apps/wallet-tools/extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "PayIn Wallet Tools",
  "version": "1.0.0",
  "description": "HD wallet address generator for PayIn",
  "permissions": [
    "storage",        // Save user preferences
    "clipboardWrite"  // Copy addresses
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Extension Structure

```
extension/
├── manifest.json
├── popup.html           # Entry point
├── src/
│   ├── popup/
│   │   ├── main.tsx    # React app entry
│   │   └── App.tsx     # Main UI
│   ├── background/
│   │   └── service-worker.ts
│   └── assets/
│       └── icons/
├── public/
│   └── icons/
├── package.json
├── vite.config.ts      # Build configuration
└── tsconfig.json
```

### Extension package.json

```json
{
  "name": "@payin/wallet-tools-extension",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@payin/wallet-core": "file:../shared/core",
    "@payin/wallet-ui": "file:../shared/ui",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@types/chrome": "^0.0.268",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.1.0",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.9.3",
    "vite": "^7.1.12"
  }
}
```

### Extension Vite Config

**File**: `apps/wallet-tools/extension/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'popup.html'
      }
    }
  }
});
```

### Extension Main App

**File**: `apps/wallet-tools/extension/src/popup/App.tsx`

```tsx
import { useState } from 'react';
import { getEnvironmentLimits } from '@payin/wallet-core/config';
import {
  ProtocolSelector,
  GenerationForm,
  AddressTable,
  CSVExporter,
  SecurityWarning
} from '@payin/wallet-ui';

export default function App() {
  const limits = getEnvironmentLimits('extension');
  const [protocol, setProtocol] = useState<Protocol>('evm');
  const [addresses, setAddresses] = useState<GeneratedAddress[]>([]);

  return (
    <div className="w-[600px] h-[700px] p-6">
      <SecurityWarning mode="extension" />

      <ProtocolSelector
        value={protocol}
        onChange={setProtocol}
      />

      <GenerationForm
        onGenerate={handleGenerate}
        limits={limits}
      />

      {addresses.length > 0 && (
        <>
          <AddressTable addresses={addresses} protocol={protocol} />
          <CSVExporter addresses={addresses} protocol={protocol} />
        </>
      )}
    </div>
  );
}
```

---

## 🌐 Web Version Implementation

### Web Structure

```
web/
├── src/
│   ├── App.tsx          # Main app with restrictions
│   ├── main.tsx         # Entry point
│   ├── components/
│   │   ├── TestModeWarning.tsx
│   │   └── ExtensionPromotion.tsx
│   └── styles/
│       └── globals.css
├── public/
│   └── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Web package.json

```json
{
  "name": "@payin/wallet-tools-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@payin/wallet-core": "file:../shared/core",
    "@payin/wallet-ui": "file:../shared/ui",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.1.0",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.9.3",
    "vite": "^7.1.12"
  }
}
```

### Web Main App (with Restrictions)

**File**: `apps/wallet-tools/web/src/App.tsx`

```tsx
import { useState, useEffect } from 'react';
import { getEnvironmentLimits } from '@payin/wallet-core/config';
import {
  ProtocolSelector,
  GenerationForm,
  AddressTable,
  CSVExporter,
  SecurityWarning
} from '@payin/wallet-ui';
import { TestModeWarning } from './components/TestModeWarning';
import { ExtensionPromotion } from './components/ExtensionPromotion';

export default function App() {
  const limits = getEnvironmentLimits('web');
  const [protocol, setProtocol] = useState<Protocol>('evm');
  const [addresses, setAddresses] = useState<GeneratedAddress[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  // Force user acknowledgment
  if (!acknowledged) {
    return (
      <TestModeWarning
        onAcknowledge={() => setAcknowledged(true)}
        extensionDownloadUrl="/install-extension"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Watermark */}
      <div className="fixed bottom-4 right-4 text-6xl font-bold opacity-5 rotate-[-20deg] pointer-events-none">
        TEST MODE ONLY
      </div>

      {/* Warning banner */}
      <SecurityWarning
        mode="web"
        extensionDownloadUrl="/install-extension"
      />

      {/* Main content */}
      <div className="max-w-4xl mx-auto space-y-6 border-2 border-dashed border-destructive p-6 rounded-lg">
        <ProtocolSelector
          value={protocol}
          onChange={setProtocol}
        />

        <GenerationForm
          onGenerate={handleGenerate}
          limits={limits} // maxAddressCount: 10
        />

        {addresses.length > 0 && (
          <>
            <AddressTable addresses={addresses} protocol={protocol} />
            <CSVExporter addresses={addresses} protocol={protocol} />
          </>
        )}
      </div>

      {/* Extension promotion */}
      <ExtensionPromotion />
    </div>
  );
}
```

### Test Mode Warning Component

**File**: `apps/wallet-tools/web/src/components/TestModeWarning.tsx`

```tsx
import { AlertTriangle } from 'lucide-react';
import { Button } from '@payin/wallet-ui';

interface TestModeWarningProps {
  onAcknowledge: () => void;
  extensionDownloadUrl: string;
}

export function TestModeWarning({ onAcknowledge, extensionDownloadUrl }: TestModeWarningProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-2xl w-full space-y-6 border-2 border-destructive p-8 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h1 className="text-2xl font-bold">Test Environment Only</h1>
        </div>

        <div className="space-y-4">
          <p className="text-muted-foreground">
            This online version is <strong>for testing and demonstration only</strong>.
          </p>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Limitations:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Maximum 10 addresses per generation</li>
              <li>Cannot import existing mnemonics</li>
              <li>Cannot verify address ownership</li>
              <li>No custom derivation paths</li>
            </ul>
          </div>

          <div className="bg-primary/5 border border-primary p-4 rounded-lg">
            <h3 className="font-semibold mb-2">For Production Use:</h3>
            <p className="text-sm mb-3">
              Install the browser extension for full features and enhanced security.
            </p>
            <Button asChild className="w-full">
              <a href={extensionDownloadUrl}>Install Browser Extension</a>
            </Button>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              I understand this is test mode only and will use the browser extension for production addresses.
            </span>
          </label>

          <Button
            onClick={onAcknowledge}
            disabled={!checked}
            className="w-full"
            variant="outline"
          >
            Continue to Test Mode
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📝 Implementation Checklist

### Phase 1: Shared UI Components ✅ Core Done, 🚧 UI In Progress

- [x] @payin/wallet-core package setup
- [x] Core wallet logic implementation
- [x] Environment configuration
- [x] Build and type generation
- [ ] @payin/wallet-ui package setup
- [ ] Copy base UI components from admin
- [ ] Create custom wallet components
- [ ] Build and test UI package

### Phase 2: Browser Extension 🔜

- [ ] Create extension directory structure
- [ ] Setup manifest.json (V3)
- [ ] Configure Vite + CRXJS plugin
- [ ] Implement popup UI (reuse shared components)
- [ ] Add clipboard permissions
- [ ] Add icons (16x16, 48x48, 128x128)
- [ ] Build extension package
- [ ] Test in Chrome/Edge
- [ ] Test in Firefox

### Phase 3: Web Version 🔜

- [ ] Create web directory structure
- [ ] Setup Vite configuration
- [ ] Implement forced acknowledgment flow
- [ ] Add test mode warnings
- [ ] Add extension promotion
- [ ] Add visual differentiation (orange theme)
- [ ] Add watermark
- [ ] Build and deploy

### Phase 4: CLI Migration 🔜

- [ ] Migrate from address-tool to wallet-tools/cli
- [ ] Use @payin/wallet-core
- [ ] Update package.json
- [ ] Update README
- [ ] Test all commands

---

## 🔐 Security Considerations

### Extension
- ✅ Code signing via Chrome Web Store
- ✅ Manifest V3 restrictions
- ✅ No network requests in main logic
- ✅ Local-only cryptographic operations

### Web Version
- ⚠️ Disable mnemonic import (prevent real key exposure)
- ⚠️ Limit address generation (10 max)
- ⚠️ Prominent warnings and visual differentiation
- ⚠️ Clear disclaimers and forced acknowledgment

### Shared Core
- ✅ No private key transmission
- ✅ All crypto operations local
- ✅ No telemetry or analytics
- ✅ Open source and auditable

---

## 🚀 Build and Deployment

### Development
```bash
# Install all dependencies
cd apps/wallet-tools/shared/core && npm install
cd ../ui && npm install
cd ../../extension && npm install
cd ../web && npm install

# Watch mode (parallel)
npm run dev:all
```

### Production Build
```bash
# Build core first
cd shared/core && npm run build

# Build UI
cd ../ui && npm run build

# Build extension
cd ../../extension && npm run build
# Output: extension/dist/ (upload to Chrome Web Store)

# Build web
cd ../web && npm run build
# Output: web/dist/ (deploy to static hosting)
```

### Deployment Targets
- **Extension**: Chrome Web Store, Firefox Add-ons, Edge Add-ons
- **Web**: Railway, Vercel, Cloudflare Pages
- **CLI**: npm registry (optional)

---

## 📚 Next Steps

1. **Complete UI Package** ⏭️ NEXT
   - Copy shadcn/ui components from admin
   - Create wallet-specific components
   - Build and test

2. **Build Extension**
   - Setup CRXJS + Vite
   - Implement popup UI
   - Test in browsers

3. **Build Web Version**
   - Add restrictions
   - Add warnings
   - Deploy

4. **Documentation**
   - User guides
   - API documentation
   - Security best practices

---

**Last Updated**: 2025-11-05
**Status**: Phase 1 (Core ✅, UI 🚧)
