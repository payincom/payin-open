/**
 * Hosted Payment Link Checkout Page
 * Public SSR page for buyers to complete Payment Link payments.
 *
 * GET /checkout/:slug
 */

import { Hono } from 'hono';
import { html } from 'hono/html';
import { renderPaymentLinkCheckoutPage } from '@payin/shared/checkout';
import { getManager } from '../manager-instance.js';
import { getStylesheetUrl, getViteClientScript } from '../utils/asset-helpers.js';

const checkout = new Hono<{
  Bindings: {
    PAYIN_API_BASE_URL?: string;
  };
}>();

const renderUnavailable = (title: string, message: string, icon: string = '❌', status = 404) => {
  const stylesheetUrl = getStylesheetUrl();
  const viteClient = getViteClientScript();

  return html`<!DOCTYPE html>
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
      <body class="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full">
          <div class="bg-card border border-border rounded-lg p-8 text-center">
            <div class="text-6xl mb-4">${icon}</div>
            <h1 class="text-2xl font-bold mb-4">${title}</h1>
            <p class="text-muted-foreground">${message}</p>
          </div>
        </div>
      </body>
    </html>` as ReturnType<typeof html> & { status?: number };
};

checkout.get('/:slug', async (c) => {
  const rawSlug = c.req.param('slug');
  const slug = rawSlug?.trim();
  if (!slug) {
    return c.html(renderUnavailable('Invalid Payment Link', 'Provide a valid payment link slug to open checkout.', '⚠️', 400));
  }

  try {
    const manager = getManager();
    const link = await manager.getPaymentLinkBySlug(slug);

    if (!link) {
      return c.html(
        renderUnavailable(
          'Payment Link Not Found',
          'We could not locate this payment link. It may have expired or been removed.',
          '🔍',
          404,
        ),
      );
    }

    if (link.status !== 'published') {
      const statusResponses: Record<string, { title: string; message: string; icon: string; status: number }> = {
        draft: {
          title: 'Payment Link Paused',
          message: 'This payment link is currently unavailable. Please contact the merchant for a new link.',
          icon: '⏸️',
          status: 410,
        },
        disabled: {
          title: 'Payment Link Disabled',
          message: 'This payment link is disabled. Please contact the merchant for support.',
          icon: '🚫',
          status: 410,
        },
        soldout: {
          title: 'Payment Link Sold Out',
          message: 'This payment link has sold out its inventory. Please contact the merchant for availability.',
          icon: '📦',
          status: 409,
        },
      };

      const response =
        statusResponses[link.status as keyof typeof statusResponses] ??
        {
          title: 'Payment Link Unavailable',
          message: 'This payment link cannot be accessed at the moment. Please try again later.',
          icon: '⚠️',
          status: 409,
        };

      return c.html(renderUnavailable(response.title, response.message, response.icon, response.status));
    }

    const forwardedProto = c.req.header('x-forwarded-proto');
    const requestUrl = new URL(c.req.url);
    const protocol = forwardedProto ?? requestUrl.protocol.replace(/:$/, '');
    const hostHeader = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? requestUrl.host ?? 'localhost:3000';
    const requestOrigin = `${protocol}://${hostHeader}`;

    const apiBaseUrl = (c.env.PAYIN_API_BASE_URL || requestOrigin).replace(/\/$/, '');
    const orderBaseUrl = `${requestOrigin.replace(/\/$/, '')}/pay/order`;
    const normalizedOrigin = requestOrigin.replace(/\/$/, '');
    const shareUrl = link.slug ? `${normalizedOrigin}/checkout/${link.slug}` : `${normalizedOrigin}${c.req.path}`;

    const currencies = link.currencies && link.currencies.length > 0
      ? link.currencies.map((currency) => ({
          currency: currency.currency,
          chains: currency.chain_options ?? [],
          amount: currency.amount ?? null,
          isPrimary: currency.is_primary ?? false,
        }))
      : link.currency && link.chain_options
      ? [{
          currency: link.currency,
          chains: link.chain_options ?? [],
          amount: link.amount,
          isPrimary: true,
        }]
      : [];

    const htmlOutput = renderPaymentLinkCheckoutPage(
      {
        title: link.title,
        description: link.description ?? null,
        slug: link.slug ?? undefined,
        defaultAmount: link.amount,
        currencies,
        shareUrl,
        inventoryTotal: link.inventory_total ?? null,
        inventoryReserved: link.inventory_reserved ?? null,
        inventorySold: link.inventory_sold ?? null,
        amountType: link.amount_type ?? 'fixed',
        ctaText: link.cta_text ?? null,
        theme: link.theme ?? 'dark',
      },
      {
        mode: 'live',
        requestOrigin,
        apiBaseUrl,
        orderBaseUrl,
      },
    );

    return c.html(htmlOutput);
  } catch (error) {
    console.error('Failed to render payment link checkout page:', error);
    return c.html(
      renderUnavailable(
        'Unexpected Error',
        'We encountered an unexpected error while loading this payment link. Please try again later.',
        '💥',
        500,
      ),
    );
  }
});

export default checkout;
