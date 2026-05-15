# API Application - Development Optimization Guide

## Overview

This document explains the optimized development workflow for the API application, which uses a hybrid architecture combining Hono backend with React frontend.

## Architecture

- **Backend**: Hono server (port 3000) - Server-side rendering and API routes
- **Frontend**: React components (2 entry points: order-payment.tsx, deposit-payment.tsx)
- **Development**: Vite dev server (port 5173) - HMR support for frontend
- **Production**: Pre-built static bundles served by Hono

## Development Workflow

### Starting the Development Server

```bash
cd apps/api
npm run dev
```

This command runs 3 processes concurrently:
1. **Hono server** (port 3000) - Backend API and SSR
2. **Vite dev server** (port 5173) - Frontend HMR
3. **Shared package watcher** - Auto-compile shared TypeScript

### How It Works

#### Development Mode (NODE_ENV=development)

When `NODE_ENV=development`, the HTML templates automatically reference Vite dev server:

- CSS: Injected by Vite (no separate stylesheet link)
- JavaScript: `http://localhost:5173/client/order-payment.tsx`
- HMR Client: `http://localhost:5173/@vite/client`

**Benefits:**
- ✅ Instant CSS hot reload (~50ms)
- ✅ React component HMR
- ✅ Browser auto-refresh
- ✅ Source maps for debugging

#### Production Mode (NODE_ENV=production)

When `NODE_ENV=production`, the HTML templates reference pre-built bundles:

- CSS: `/dist/assets/style.css`
- JavaScript: `/dist/order-payment.js`

### Asset Helper Functions

The `src/utils/asset-helpers.ts` module provides environment-aware URL generation:

```typescript
import { getScriptUrl, getStylesheetUrl, getViteClientScript } from '../utils/asset-helpers.js';

// In route handlers:
const stylesheetUrl = getStylesheetUrl();      // null in dev, '/dist/assets/style.css' in prod
const viteClient = getViteClientScript();       // Vite HMR client in dev, null in prod
const scriptUrl = getScriptUrl('order-payment'); // Dev or prod URL
```

## Modified Files

The following route files have been updated to use asset helpers:

1. `src/routes/pay-order.ts` - Order payment page
2. `src/routes/pay-deposit.ts` - Deposit payment page
3. `src/routes/checkout.ts` - Payment link checkout page

## Development Tips

### Hot Reload Not Working?

1. Check that all 3 processes are running (server, vite, shared)
2. Verify `NODE_ENV=development` is set
3. Ensure Vite dev server is accessible at http://localhost:5173
4. Check browser console for WebSocket connection errors

### Building for Production

```bash
npm run build       # Builds both client and server
npm run start       # Starts production server
```

### Testing Production Build Locally

```bash
npm run build
NODE_ENV=production npm run dev:server-only
```

This runs the server in production mode while using the built assets.

## Performance Comparison

| Metric | Before (build --watch) | After (Vite HMR) |
|--------|----------------------|------------------|
| CSS change response | 2-5 seconds | ~50ms |
| React change response | 2-5 seconds | ~100ms |
| Browser refresh | Manual | Automatic |
| Source maps | Limited | Full support |

## Troubleshooting

### Port 5173 Already in Use

Change the port in `vite.config.ts`:

```typescript
server: {
  port: 5174,  // Change to available port
  // ...
}
```

Then update `VITE_DEV_SERVER` in `src/utils/asset-helpers.ts`.

### CSS Not Loading in Development

Vite injects CSS automatically via JavaScript in development mode. If you see FOUC (Flash of Unstyled Content):

1. Ensure Vite client script loads before React bundle
2. Check browser console for CSS import errors
3. Verify Tailwind configuration is correct

### Production Build Issues

If the production build doesn't work:

1. Run `npm run build:client` to see detailed errors
2. Check `public/dist/` directory is created
3. Verify static file serving in `src/server.ts`:
   ```typescript
   app.use('/dist/*', serveStatic({ root: './public' }));
   ```

## Future Improvements

- [ ] Add CSS extraction option for development (optional)
- [ ] Implement build caching for faster rebuilds
- [ ] Add TypeScript type checking in watch mode
- [ ] Consider migrating to Vite SSR for unified dev/prod experience
