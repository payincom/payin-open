# Development Tasks - PayIn Wallet Tools

## 📊 Progress Overview

- ✅ **Phase 0**: Architecture & Core (100%)
- 🚧 **Phase 1**: UI Components (0%)
- ⏳ **Phase 2**: Browser Extension (0%)
- ⏳ **Phase 3**: Web Application (0%)
- ⏳ **Phase 4**: CLI Migration (0%)

---

## Phase 0: Architecture & Core ✅ COMPLETED

### Core Package (@payin/wallet-core)
- [x] Create package.json
- [x] Create tsconfig.json
- [x] Implement types.ts
- [x] Implement config.ts (environment limits)
- [x] Implement wallet.ts (HD wallet logic)
- [x] Build successfully
- [x] Generate TypeScript declarations

**Result**: `apps/wallet-tools/shared/core/` package built and ready

---

## Phase 1: UI Components 🚧 IN PROGRESS

### 1.1 Base UI Setup
- [ ] Create `shared/ui/` package structure
- [ ] Install dependencies (React, Radix UI, Tailwind)
- [ ] Create tsconfig.json
- [ ] Create tailwind.config.ts
- [ ] Setup build configuration (tsup)

### 1.2 Copy Base Components from Admin
Copy from `apps/admin/src/components/ui/`:
- [ ] `button.tsx`
- [ ] `input.tsx`
- [ ] `label.tsx`
- [ ] `card.tsx`
- [ ] `dialog.tsx`
- [ ] `select.tsx`
- [ ] `radio-group.tsx`
- [ ] `tabs.tsx`
- [ ] `badge.tsx`
- [ ] `alert.tsx`

Also copy:
- [ ] `lib/utils.ts` (cn function)
- [ ] Base CSS with color variables

### 1.3 Create Custom Wallet Components
Create in `shared/ui/src/components/`:

**Core Components**:
- [ ] `ProtocolSelector.tsx` - Select blockchain (EVM/Tron/Solana)
- [ ] `MnemonicDisplay.tsx` - Show mnemonic with copy/reveal
- [ ] `MnemonicInput.tsx` - Import mnemonic (disabled in web)
- [ ] `AddressTable.tsx` - Display generated addresses
- [ ] `GenerationForm.tsx` - Main generation form
- [ ] `SecurityWarning.tsx` - Warning banner
- [ ] `CSVExporter.tsx` - Export to CSV

**Utility Components**:
- [ ] `CopyButton.tsx` - Copy with feedback
- [ ] `WalletInfoCard.tsx` - Display master public key
- [ ] `ProtocolBadge.tsx` - Protocol indicator

### 1.4 Build and Test
- [ ] Build UI package
- [ ] Test component exports
- [ ] Create Storybook (optional)
- [ ] Write component documentation

**Deliverable**: `@payin/wallet-ui` package ready for use

---

## Phase 2: Browser Extension ⏳ PENDING

### 2.1 Project Setup
- [ ] Create `extension/` directory
- [ ] Create package.json
- [ ] Install dependencies (Vite, CRXJS, React)
- [ ] Create tsconfig.json
- [ ] Create vite.config.ts with CRXJS plugin

### 2.2 Manifest Configuration
- [ ] Create manifest.json (V3)
- [ ] Define permissions (storage, clipboardWrite)
- [ ] Configure popup action
- [ ] Add icons (16x16, 48x48, 128x128)
- [ ] Set content security policy

### 2.3 Extension UI
- [ ] Create popup.html
- [ ] Create src/popup/main.tsx
- [ ] Create src/popup/App.tsx
- [ ] Implement protocol selector
- [ ] Implement generation form
- [ ] Implement address table
- [ ] Implement CSV export

### 2.4 Extension Features
- [ ] Environment detection (extension mode)
- [ ] Apply extension limits (unlimited)
- [ ] Clipboard copy functionality
- [ ] Settings persistence (chrome.storage)
- [ ] Error handling

### 2.5 Build and Test
- [ ] Build extension package
- [ ] Load unpacked in Chrome
- [ ] Test all features
- [ ] Test in Firefox (using web-ext)
- [ ] Test in Edge

### 2.6 Polish
- [ ] Add loading states
- [ ] Add success/error toasts
- [ ] Optimize bundle size
- [ ] Add keyboard shortcuts
- [ ] Test accessibility

**Deliverable**: Chrome extension ready for Web Store submission

---

## Phase 3: Web Application ⏳ PENDING

### 3.1 Project Setup
- [ ] Create `web/` directory
- [ ] Create package.json
- [ ] Install dependencies (Vite, React, Tailwind)
- [ ] Create tsconfig.json
- [ ] Create vite.config.ts
- [ ] Create tailwind.config.ts

### 3.2 Entry Point
- [ ] Create public/index.html
- [ ] Create src/main.tsx
- [ ] Create src/App.tsx
- [ ] Setup routing (if needed)

### 3.3 Test Mode Components
Create in `web/src/components/`:
- [ ] `TestModeWarning.tsx` - Forced acknowledgment
- [ ] `ExtensionPromotion.tsx` - CTA to install extension
- [ ] `FeatureLimitInfo.tsx` - Explain limitations

### 3.4 Main UI (with Restrictions)
- [ ] Implement forced acknowledgment flow
- [ ] Add environment detection (web mode)
- [ ] Apply web limits (max 10 addresses)
- [ ] Disable mnemonic import
- [ ] Disable address verification
- [ ] Add prominent warning banner
- [ ] Add watermark

### 3.5 Visual Differentiation
- [ ] Use orange/warning color scheme
- [ ] Add dashed border
- [ ] Add "TEST MODE ONLY" watermark
- [ ] Add extension download CTA

### 3.6 Build and Deploy
- [ ] Build for production
- [ ] Test locally
- [ ] Deploy to Railway/Vercel
- [ ] Test deployed version
- [ ] Setup custom domain (optional)

**Deliverable**: Web app deployed and accessible

---

## Phase 4: CLI Migration ⏳ PENDING

### 4.1 Migration
- [ ] Copy `apps/address-tool/` to `wallet-tools/cli/`
- [ ] Update package.json name
- [ ] Replace imports with @payin/wallet-core
- [ ] Remove duplicated wallet logic
- [ ] Update README

### 4.2 Refactoring
- [ ] Use shared core functions
- [ ] Simplify command handlers
- [ ] Update CLI prompts
- [ ] Update help text

### 4.3 Testing
- [ ] Test address generation
- [ ] Test address verification
- [ ] Test CSV export
- [ ] Test all protocols (EVM, Tron, Solana)

### 4.4 Documentation
- [ ] Update README
- [ ] Add migration guide
- [ ] Update examples

**Deliverable**: CLI tool using shared core

---

## Phase 5: Documentation & Testing ⏳ PENDING

### 5.1 Documentation
- [ ] User guide (Extension)
- [ ] User guide (Web)
- [ ] User guide (CLI)
- [ ] API documentation
- [ ] Security best practices
- [ ] FAQ

### 5.2 Testing
- [ ] Unit tests for wallet-core
- [ ] Component tests for wallet-ui
- [ ] E2E tests for extension
- [ ] E2E tests for web

### 5.3 CI/CD
- [ ] Setup GitHub Actions
- [ ] Automated builds
- [ ] Automated tests
- [ ] Automated deployment (web)

---

## 📋 Quick Reference

### Build Order
1. `shared/core` → Build first (dependency for all)
2. `shared/ui` → Build second (dependency for extension & web)
3. `extension` → Build independently
4. `web` → Build independently
5. `cli` → Build independently

### Commands
```bash
# Build all
npm run build:all

# Watch mode
npm run dev:all

# Test
npm run test:all
```

### File Locations
- Core logic: `shared/core/src/`
- UI components: `shared/ui/src/components/`
- Extension: `extension/src/`
- Web: `web/src/`
- CLI: `cli/src/`

---

## 🎯 Current Priority

**Next Task**: Phase 1.2 - Copy base UI components from admin

**Steps**:
1. Create `shared/ui/src/components/ui/` directory
2. Copy button, input, label, card, etc. from admin
3. Copy `lib/utils.ts` and CSS
4. Setup Tailwind configuration
5. Build and test

**Estimated Time**: 2-3 hours

---

**Last Updated**: 2025-11-05
**Current Phase**: Phase 1 (UI Components)
