# PayIn Wallet Tools - Web Application

Production-ready HD Wallet Address Generator for multiple blockchain protocols.

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# http://localhost:5174/
```

### Build for Production

```bash
# Build static files
npm run build

# Preview production build locally
npm run preview
```

## 🌐 Deployment to Cloudflare Pages

### Prerequisites

1. Install Wrangler CLI globally:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

### Deploy

```bash
# Build and deploy to Cloudflare Pages
npm run deploy
```

The application will be deployed to Cloudflare Pages and you'll receive a URL like:
`https://payin-wallet-tools.pages.dev`

## ✨ Features

- **Multi-Chain Support**: Generate addresses for EVM, Tron, and Solana
- **HD Wallet**: BIP44-compliant hierarchical deterministic wallet
- **Privacy Detection**: Automatically detects private browsing mode
- **Secure by Design**: Recommends offline usage for maximum security
- **Batch Generation**: Generate multiple addresses from a single mnemonic
- **Export Options**: Copy addresses or download as CSV
- **Responsive UI**: Works on desktop and mobile devices

## 🔐 Security Features

- **Private Mode Detection**: Warns users if not in private browsing
- **No Server Storage**: All operations happen in the browser
- **Mnemonic Backup**: Requires user confirmation before proceeding
- **Clear Warnings**: Security alerts for different environments

## 📁 Project Structure

```
web/
├── src/
│   ├── App.tsx              # Main application with wizard steps
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind + global styles
├── dist/                    # Build output (generated)
├── index.html
├── package.json
├── wrangler.toml            # Cloudflare Pages configuration
├── vite.config.ts           # Vite build configuration
└── tailwind.config.js       # Tailwind CSS configuration
```

## 🎨 UI Components

Uses shared UI components from `@payin/wallet-ui`:

- **WizardStep1Mnemonic**: Generate or import mnemonic phrase
- **WizardStep2Protocol**: Select blockchain protocol (EVM/Tron/Solana)
- **WizardStep3Addresses**: View and export generated addresses
- **SecurityWarning**: Environment-based security alerts
- **Base UI**: Button, Card, Input, Badge, Alert, etc.

## 🔧 Development

### Environment-Specific Behavior

The app adapts to the runtime environment:

1. **Browser Extension**: Full features, secure environment
2. **Web - Private Mode**: Limited features, offline recommended
3. **Web - Normal Mode**: Blocked for security reasons

### Hot Module Replacement

Changes to source files are automatically reflected in the browser thanks to Vite's HMR.

## 📦 Dependencies

- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool with HMR
- **Tailwind CSS**: Utility-first CSS framework
- **@payin/wallet-core**: Core wallet generation logic
- **@payin/wallet-ui**: Shared UI components
- **detectincognitojs**: Private mode detection

## 🌍 Cloudflare Pages Configuration

The `wrangler.toml` file configures the deployment:

```toml
name = "payin-wallet-tools"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"
```

Cloudflare Pages provides:
- Global CDN distribution
- Automatic HTTPS
- Instant cache invalidation
- Preview deployments for branches

## 📝 Notes

- All wallet operations happen client-side in the browser
- No data is sent to any server
- Mnemonic phrases are never stored or transmitted
- Recommended to use in offline mode for maximum security
- Works best in private/incognito browsing mode
