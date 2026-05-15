/**
 * Hono Web Server
 * Provides REST API for PayIn system management
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { getManager } from './manager-instance.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve public directory relative to the built dist/index.js location
// Development: apps/api/src/server.ts -> apps/api/public
// Production: apps/api/dist/server.js -> apps/api/public
const publicDir = resolve(__dirname, '../public');
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import apiKeysRoutes from './routes/api-keys.js';
import configRoutes from './routes/config.js';
import configManagementRoutes from './routes/config-management.js';
import configDiagnosticsRoutes from './routes/config-diagnostics.js';
import chainsRoutes from './routes/chains.js';
import tokensRoutes from './routes/tokens.js';
import ordersRoutes from './routes/orders.js';
import depositsRoutes from './routes/deposits.js';
import transfersRoutes from './routes/transfers.js';
import addressPoolRoutes from './routes/address-pool.js';
import paymentLinksRoutes from './routes/payment-links.js';
import notificationsRoutes from './routes/notifications.js';
import organizationsRoutes from './routes/organizations.js';
import payOrderRoutes from './routes/pay-order.js';
import payDepositRoutes from './routes/pay-deposit.js';
import checkoutRoutes from './routes/checkout.js';
import checkoutPreviewRoutes from './routes/checkout-preview.js';
import apiChainsRoutes from './routes/api-chains.js';
import apiDepositsRoutes from './routes/api-deposits.js';
import apiPaymentLinksRoutes from './routes/api-payment-links.js';
import orderStatusRoutes from './routes/order-status.js';
import transferStatusRoutes from './routes/transfer-status.js';

/**
 * Create and configure Hono application
 */
export function createApp() {
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Static file serving for React bundles and assets
  // Map /dist/* and /assets/* to files in public directory
  // File location: apps/api/public/dist/assets/style.css
  // URL: /dist/assets/style.css -> public/dist/assets/style.css
  app.use('/dist/*', serveStatic({
    root: publicDir,
    rewriteRequestPath: (path) => path // Keep original path including /dist
  }));
  app.use('/assets/*', serveStatic({
    root: publicDir,
    rewriteRequestPath: (path) => path // Keep original path including /assets
  }));

  // Serve favicon and other root-level static files
  // Explicitly list each file since wildcard patterns don't work with serveStatic
  app.use('/favicon.ico', serveStatic({ root: publicDir }));
  app.use('/favicon-16x16.png', serveStatic({ root: publicDir }));
  app.use('/favicon-32x32.png', serveStatic({ root: publicDir }));
  app.use('/apple-touch-icon.png', serveStatic({ root: publicDir }));
  app.use('/android-chrome-192x192.png', serveStatic({ root: publicDir }));
  app.use('/android-chrome-512x512.png', serveStatic({ root: publicDir }));
  app.use('/site.webmanifest', serveStatic({ root: publicDir }));

  // ==================== Health Check ====================

  /**
   * Health check endpoint
   * GET /health
   */
  app.get('/health', async (c) => {
    try {
      const manager = getManager();

      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        manager: {
          initialized: true
        },
        version: '0.1.0'
      });
    } catch (error) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 503);
    }
  });

  // ==================== Public Payment Pages ====================

  /**
   * Public payment pages (no authentication required)
   */
  app.route('/pay/order', payOrderRoutes);
  app.route('/pay/deposit', payDepositRoutes);
  app.route('/checkout', checkoutRoutes);
  app.route('/checkout/preview', checkoutPreviewRoutes);

  // ==================== Public API ====================

  /**
   * Public API endpoints (no authentication required)
   */
  app.route('/api/chains', apiChainsRoutes);
  app.route('/api/deposits', apiDepositsRoutes);
  app.route('/api/payment-links', apiPaymentLinksRoutes);
  app.route('/api/tokens', tokensRoutes);  // Public token configuration API
  app.route('/api/order-status', orderStatusRoutes);  // Public order status API
  app.route('/api/transfer-status', transferStatusRoutes);  // Public transfer status API

  // ==================== API Routes ====================

  /**
   * API v1 routes
   */
  const api = app.basePath('/api/v1');

  // Authentication API
  api.route('/auth', authRoutes);
  api.route('/users', usersRoutes);
  api.route('/audit', auditRoutes);
  api.route('/api-keys', apiKeysRoutes);

  // Multi-tenancy API ✅
  api.route('/organizations', organizationsRoutes);

  // Configuration Management API (Phase 2) ✅
  api.route('/config', configRoutes);  // Legacy config API (backward compatibility)
  api.route('/config-management', configManagementRoutes);  // New config API with multi-tenant support
  api.route('/config/diagnostics', configDiagnosticsRoutes);
  api.route('/chains', chainsRoutes);
  api.route('/tokens', tokensRoutes);

  // Business Operations API (Phase 3) ✅
  api.route('/orders', ordersRoutes);
  api.route('/deposits', depositsRoutes);
  api.route('/payment-links', paymentLinksRoutes);
  api.route('/transfers', transfersRoutes);
  api.route('/address-pool', addressPoolRoutes);

  // Notification API ✅
  api.route('/notifications', notificationsRoutes);

  // Public checkout API (no auth required) — alias for /api/payment-links
  api.route('/checkout', apiPaymentLinksRoutes);

  // ==================== 404 Handler ====================

  app.notFound((c) => {
    return c.json({
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`
    }, 404);
  });

  // ==================== Error Handler ====================

  app.onError((err, c) => {
    console.error('❌ Error:', err);

    return c.json({
      error: 'Internal Server Error',
      message: err.message
    }, 500);
  });

  return app;
}
