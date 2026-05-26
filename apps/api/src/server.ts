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
import { createApiKeysRoutes } from './routes/api-keys.js';
import configRoutes from './routes/config.js';
import configManagementRoutes from './routes/config-management.js';
import configDiagnosticsRoutes from './routes/config-diagnostics.js';
import chainsRoutes from './routes/chains.js';
import tokensRoutes from './routes/tokens.js';
import { createOrdersRoutes } from './routes/orders.js';
import { createDepositsRoutes } from './routes/deposits.js';
import { createTransfersRoutes } from './routes/transfers.js';
import { createAddressPoolRoutes } from './routes/address-pool.js';
import { createPaymentLinksRoutes } from './routes/payment-links.js';
import { createNotificationsRoutes } from './routes/notifications.js';
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
import { cloudOnlyRouteGuard } from './open-runtime.js';
import {
  type OpenRuntimeCompositionOptions,
  type OpenRuntimeRouteDependencies,
  type OpenRuntimeRouteFactories,
} from './runtime-contract.js';

export type BuiltInRouteFactories = OpenRuntimeRouteFactories;
export type BuiltInRouteDependencies = OpenRuntimeRouteDependencies;
export type CreateAppOptions = OpenRuntimeCompositionOptions;

/**
 * Create and configure Hono application
 */
export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();
  const managerProvider = options.getManager ?? getManager;
  const cloudOnlyGuard = options.cloudOnlyRouteGuard ?? cloudOnlyRouteGuard;
  const routeFactories = {
    apiKeys: createApiKeysRoutes,
    orders: createOrdersRoutes,
    paymentLinks: createPaymentLinksRoutes,
    deposits: createDepositsRoutes,
    addressPool: createAddressPoolRoutes,
    transfers: createTransfersRoutes,
    notifications: createNotificationsRoutes,
    ...options.routeFactories,
  };
  const routeDependencies = options.routeDependencies ?? {};

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Static file serving for React bundles and assets
  // Map /dist/* and /assets/* to files in public directory
  // File location: apps/api/public/dist/assets/style.css
  // URL: /dist/assets/style.css -> public/dist/assets/style.css
  app.use(
    '/dist/*',
    serveStatic({
      root: publicDir,
      rewriteRequestPath: path => path, // Keep original path including /dist
    })
  );
  app.use(
    '/assets/*',
    serveStatic({
      root: publicDir,
      rewriteRequestPath: path => path, // Keep original path including /assets
    })
  );

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
  app.get('/health', async c => {
    try {
      managerProvider();

      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        manager: {
          initialized: true,
        },
        version: '0.1.0',
      });
    } catch (error) {
      return c.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        503
      );
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
  app.route('/api/tokens', tokensRoutes); // Public token configuration API
  app.route('/api/order-status', orderStatusRoutes); // Public order status API
  app.route('/api/transfer-status', transferStatusRoutes); // Public transfer status API
  options.extendPublicRoutes?.(app);

  // ==================== API Routes ====================

  /**
   * API v1 routes
   */
  const api = app.basePath('/api/v1');

  // Authentication API
  // Hosted OAuth signup/profile bootstrap is Cloud-only; Open uses local first-operator registration.
  api.use('/auth/oauth/*', cloudOnlyGuard('OAuth API'));
  api.use('/auth/oauth', cloudOnlyGuard('OAuth API'));
  api.route('/auth', authRoutes);

  // Hosted user/admin management is Cloud-only; Open remains headless/operator-managed.
  api.use('/users/*', cloudOnlyGuard('Users Management API'));
  api.use('/users', cloudOnlyGuard('Users Management API'));
  api.route('/users', usersRoutes);
  api.route('/audit', auditRoutes);
  api.route('/api-keys', routeFactories.apiKeys(routeDependencies.apiKeys));

  // Multi-tenancy API (Cloud-only in hosted runtime; hidden in PayIn Open)
  api.use('/organizations/*', cloudOnlyGuard('Organizations API'));
  api.use('/organizations', cloudOnlyGuard('Organizations API'));
  api.route('/organizations', organizationsRoutes);

  // Configuration Management API (Phase 2)
  // Super-admin diagnostics are Cloud-only; Open uses open:doctor/open:init checks.
  api.use('/config/diagnostics/*', cloudOnlyGuard('Super Admin Diagnostics API'));
  api.use('/config/diagnostics', cloudOnlyGuard('Super Admin Diagnostics API'));
  api.route('/config', configRoutes); // Legacy config API (backward compatibility)
  // Multi-tenant configuration management is Cloud-only; Open uses local/self-hosted config flows.
  api.use('/config-management/*', cloudOnlyGuard('Config Management API'));
  api.use('/config-management', cloudOnlyGuard('Config Management API'));
  api.route('/config-management', configManagementRoutes); // New config API with multi-tenant support
  api.route('/config/diagnostics', configDiagnosticsRoutes);
  api.route('/chains', chainsRoutes);
  api.route('/tokens', tokensRoutes);

  // Business Operations API (Phase 3) ✅
  api.route('/orders', routeFactories.orders(routeDependencies.orders));
  api.route('/deposits', routeFactories.deposits(routeDependencies.deposits));
  api.route('/payment-links', routeFactories.paymentLinks(routeDependencies.paymentLinks));
  api.route('/transfers', routeFactories.transfers(routeDependencies.transfers));
  api.route('/address-pool', routeFactories.addressPool(routeDependencies.addressPool));

  // Notification API ✅
  api.route('/notifications', routeFactories.notifications(routeDependencies.notifications));

  // Public checkout API (no auth required) — alias for /api/payment-links
  api.route('/checkout', apiPaymentLinksRoutes);

  options.extendApiRoutes?.(api);

  // ==================== 404 Handler ====================

  app.notFound(c => {
    return c.json(
      {
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404
    );
  });

  // ==================== Error Handler ====================

  app.onError((err, c) => {
    console.error('❌ Error:', err);

    return c.json(
      {
        error: 'Internal Server Error',
        message: err.message,
      },
      500
    );
  });

  return app;
}
