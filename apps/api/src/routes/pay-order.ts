/**
 * Order Payment Page Routes (Client-side rendering with React)
 * Public pages for users to complete order payments
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';
import { html, raw } from 'hono/html';
import QRCode from 'qrcode';

const payOrderNew = new Hono();

function getProtocolFromChain(chain: string): 'evm' | 'tron' | 'solana' {
  if (chain.includes('solana')) return 'solana';
  if (chain.startsWith('tron')) return 'tron';
  return 'evm';
}

/**
 * Get order payment page (client-side rendering with shared layout)
 * GET /pay/order/:orderId
 * Public endpoint - No authentication required
 */
payOrderNew.get('/:orderId', async (c) => {
  try {
    const manager = getManager();
    const orderId = c.req.param('orderId');

    // Fetch order details
    const order = await manager.getOrder(orderId);

    if (!order) {
      return c.html(
        html`<!DOCTYPE html>
          <html lang="en" class="dark">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Order Not Found - PayIn</title>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
              <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
              <link rel="stylesheet" href="/dist/assets/style.css" />
            </head>
            <body class="bg-background text-foreground">
              <div class="min-h-screen flex items-center justify-center p-4">
                <div class="max-w-md w-full text-center space-y-4">
                  <h1 class="text-2xl font-bold text-destructive">Order Not Found</h1>
                  <p class="text-muted-foreground">Order ID: ${orderId}</p>
                  <p class="text-muted-foreground">This order does not exist or has been deleted.</p>
                </div>
              </div>
            </body>
          </html>`,
        404
      );
    }

    // Get metadata - only show for pending orders to avoid info leakage
    const metadata = order.metadata || {};
    const title = order.status === 'pending'
      ? (metadata.title || 'Order Payment')
      : 'Order Payment';

    // For pending orders, prepare data for React bundle
    let qrCodeDataUrl = '';
    let chainData: any = null;
    let supportedChains: any[] = [];

    if (order.status === 'pending') {
      // Generate QR code
      qrCodeDataUrl = await QRCode.toDataURL(order.address, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      // Get full chain information from manager/processor configuration
      try {
        const config = await manager.getChainConfig(order.chain);

        if (config) {
          const {
            chain_id,
            chainId: configChainId,
            protocol,
            network,
            name,
            display_order,
            displayOrder,
            metadata,
          } = config as Record<string, any>;

          chainData = {
            chainId: chain_id ?? configChainId ?? order.chain,
            protocol: protocol ?? getProtocolFromChain(order.chain),
            network: network ?? (order.chain.includes('mainnet') ? 'mainnet' : 'testnet'),
            name: name ?? order.chain,
            displayOrder: display_order ?? displayOrder ?? 0,
            metadata: metadata ?? {},
          };
        }
      } catch (err) {
        console.error('Failed to get chain config from manager:', err);
      }

      // Fallback to basic chain info if processor config not available
      if (!chainData) {
        chainData = {
          chainId: order.chain,
          protocol: getProtocolFromChain(order.chain),
          network: order.chain.includes('mainnet') ? 'mainnet' : 'testnet',
          name: order.chain,
          displayOrder: 0,
          metadata: {}
        };
      }

      supportedChains = [chainData];
    }

    // Get redirect URL for completed/expired orders
    let redirectUrl: string | null = null;
    if (order.status === 'completed' || order.status === 'expired') {
      redirectUrl = await manager.getOrderRedirectUrl(
        order.id,
        order.status === 'completed'
      );
    }

    return c.html(html`<!DOCTYPE html>
      <html lang="en" class="dark">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title} - PayIn</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <link rel="stylesheet" href="/dist/assets/style.css" />
        </head>
        <body class="bg-background text-foreground">
          <!-- React Root -->
          <div id="order-payment-root"></div>

          ${
            order.status === 'pending'
              ? html`
                  <script>
                    // Inject data for React app
                    window.__ORDER_DATA__ = ${raw(JSON.stringify({
                      id: order.id,
                      order_reference: order.order_reference,
                      orderReference: order.order_reference,
                      chain_id: order.chain,
                      chainId: order.chain,
                      amount: order.amount,
                      token_symbol: order.token,
                      currency: order.token,
                      payment_address: order.address,
                      paymentAddress: order.address,
                      status: order.status,
                      metadata: order.metadata
                    }))};
                    window.__CHAIN_DATA__ = ${raw(JSON.stringify(chainData))};
                    window.__QR_CODE_DATA_URL__ = ${raw(JSON.stringify(qrCodeDataUrl))};
                    window.__SUPPORTED_CHAINS__ = ${raw(JSON.stringify(supportedChains))};
                  </script>

                  <!-- Load React bundle -->
                  <script type="module" src="/dist/order-payment.js"></script>
                `
              : html`
                  <script>
                    // Inject completed/expired order data with redirect URL
                    window.__ORDER_DATA__ = ${raw(JSON.stringify({
                      id: order.id,
                      order_reference: order.order_reference,
                      status: order.status,
                      completed_at: order.completed_at,
                      redirect_url: redirectUrl
                    }))};
                  </script>
                  <script type="module" src="/dist/order-payment.js"></script>
                `
          }
        </body>
      </html>`);
  } catch (error) {
    console.error(`Failed to load order payment page for ${c.req.param('orderId')}:`, error);
    return c.html(
      html`<!DOCTYPE html>
        <html lang="en" class="dark">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Error - PayIn</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="/dist/assets/style.css" />
          </head>
          <body class="bg-background text-foreground">
            <div class="min-h-screen flex items-center justify-center p-4">
              <div class="max-w-md w-full text-center space-y-4">
                <h1 class="text-2xl font-bold text-destructive">Load Failed</h1>
                <p class="text-muted-foreground">Unable to load order payment page</p>
                <p class="text-sm text-muted-foreground">${error instanceof Error ? error.message : 'Unknown error'}</p>
              </div>
            </div>
          </body>
        </html>`,
      500
    );
  }
});

export default payOrderNew;
