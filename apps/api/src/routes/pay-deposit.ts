/**
 * Deposit Payment Page Routes (New shadcn UI version)
 * Public pages for users to deposit to their accounts
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';
import { html, raw } from 'hono/html';
import { getScriptUrl, getStylesheetUrl, getViteClientScript } from '../utils/asset-helpers.js';

const payDepositNew = new Hono();

/**
 * Get deposit payment page (New shadcn UI version)
 * GET /pay/deposit/:address
 * Public endpoint - No authentication required
 * Address is globally unique identifier
 */
payDepositNew.get('/:address', async (c) => {
  try {
    const manager = getManager();
    const address = c.req.param('address')!;

    // Fetch deposit by address (public endpoint)
    const depositAddress = await manager.getDepositByAddress(address);

    const depositReference = depositAddress?.deposit_reference ?? address;

    if (!depositAddress || depositAddress.state !== 'bound' || !depositAddress.deposit_reference) {
      const stylesheetUrl = getStylesheetUrl();
      const viteClient = getViteClientScript();

      return c.html(
        html`<!DOCTYPE html>
          <html lang="en" class="dark">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Deposit Address Not Found - PayIn</title>
              ${viteClient ? html`<script type="module" src="${viteClient}"></script>` : ''}
              ${stylesheetUrl ? html`<link rel="stylesheet" href="${stylesheetUrl}" />` : ''}
            </head>
            <body class="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
              <div class="max-w-md w-full">
                <div class="bg-card border border-destructive rounded-lg p-8 text-center">
                  <div class="text-6xl mb-4">❌</div>
                  <h1 class="text-2xl font-bold text-destructive mb-4">Deposit Address Not Found</h1>
                  <p class="text-muted-foreground mb-2">Deposit Reference: <code class="bg-muted px-2 py-1 rounded">${depositReference}</code></p>
                  <p class="text-muted-foreground">This deposit reference does not have any bound addresses.</p>
                </div>
              </div>
            </body>
          </html>`,
        404
      );
    }

    // Get metadata
    const metadata = depositAddress.metadata || {};
    const title = metadata.title || 'Account Deposit';
    const description = metadata.description || '';
    const protocol = depositAddress.protocol;

    const stylesheetUrl = getStylesheetUrl();
    const viteClient = getViteClientScript();
    const scriptUrl = getScriptUrl('deposit-payment');

    return c.html(html`<!DOCTYPE html>
      <html lang="en" class="dark">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title} - PayIn</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
          ${viteClient ? html`<script type="module" src="${viteClient}"></script>` : ''}
          ${stylesheetUrl ? html`<link rel="stylesheet" href="${stylesheetUrl}" />` : ''}
        </head>
        <body class="bg-background text-foreground min-h-screen">
          <!-- React Root -->
          <div id="deposit-payment-root"></div>

          <script>
            // Inject data for React app
            window.__DEPOSIT_REFERENCE__ = ${raw(JSON.stringify(depositReference))};
            window.__DEPOSIT_ADDRESSES__ = ${raw(JSON.stringify({
              [protocol]: { address: depositAddress.address, protocol }
            }))};
            window.__DEPOSIT_METADATA__ = ${raw(JSON.stringify({
              title,
              description,
            }))};
          </script>

          <!-- Load React bundle -->
          <script type="module" src="${scriptUrl}"></script>
        </body>
      </html>`);
  } catch (error) {
    console.error(`Failed to load deposit payment page for ${c.req.param('depositReference')!}:`, error);
    const stylesheetUrl = getStylesheetUrl();
    const viteClient = getViteClientScript();

    return c.html(
      html`<!DOCTYPE html>
        <html lang="en" class="dark">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Error - PayIn</title>
            ${viteClient ? html`<script type="module" src="${viteClient}"></script>` : ''}
            ${stylesheetUrl ? html`<link rel="stylesheet" href="${stylesheetUrl}" />` : ''}
          </head>
          <body class="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
            <div class="max-w-md w-full">
              <div class="bg-card border border-destructive rounded-lg p-8 text-center">
                <div class="text-6xl mb-4">❌</div>
                <h1 class="text-2xl font-bold text-destructive mb-4">Load Failed</h1>
                <p class="text-muted-foreground mb-4">Unable to load deposit payment page</p>
                <pre class="bg-muted p-4 rounded text-xs text-left overflow-auto">${error instanceof Error ? error.message : 'Unknown error'}</pre>
              </div>
            </div>
          </body>
        </html>`,
      500
    );
  }
});

export default payDepositNew;
