import { Hono } from 'hono';
import { renderPaymentLinkCheckoutPage } from '@payin/shared/checkout';
import { getAuth } from '../auth-instance.js';
import { getManager } from '../manager-instance.js';

const checkoutPreview = new Hono<{
  Bindings: {
    PAYIN_API_BASE_URL?: string;
  };
}>();

checkoutPreview.get(
  '/:id',
  // No authMiddleware - preview token provides sufficient authentication
  async (c) => {
    try {
      const previewToken = c.req.query('token');
      if (!previewToken) {
        return c.json({ success: false, error: 'Unauthorized', message: 'Preview token missing' }, 401);
      }

      const authManager = getAuth();
      const verification = authManager.verifyPreviewToken(previewToken);
      if (!verification.valid || !verification.payload) {
        return c.json({ success: false, error: 'Unauthorized', message: 'Invalid preview token' }, 401);
      }

      const { linkId, organizationId } = verification.payload;
      const requestedId = c.req.param('id')!;
      if (!linkId || !organizationId || linkId !== requestedId) {
        return c.json({ success: false, error: 'Unauthorized', message: 'Invalid preview token context' }, 401);
      }

      const manager = getManager();
      const link = await manager.getPaymentLink(linkId, organizationId);
      if (!link) {
        return c.json({ success: false, error: 'Not Found', message: 'Payment Link not found' }, 404);
      }

      const forwardedProto = c.req.header('x-forwarded-proto');
      const hostHeader = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost:3000';
      const protocol = forwardedProto ?? (hostHeader.startsWith('localhost') ? 'http' : 'https');
      const requestOrigin = `${protocol}://${hostHeader}`.replace(/\/$/, '');
      const requestUrl = new URL(c.req.url, `${requestOrigin}/`);
      const apiBaseUrl = (c.env.PAYIN_API_BASE_URL || requestOrigin).replace(/\/$/, '');
      const orderBaseUrl = `${requestOrigin}/pay/order`;

      // Get viewport preference from query parameter (desktop or mobile)
      const viewportParam = c.req.query('viewport');
      const previewViewport = viewportParam === 'mobile' ? 'mobile' : 'desktop';

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

      const liveShareUrl = link.slug ? `${requestOrigin}/checkout/${link.slug}` : null;
      const shareUrl = liveShareUrl ?? requestUrl.toString();

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
          mode: 'preview',
          previewViewport,
          requestOrigin,
          apiBaseUrl,
          orderBaseUrl,
        },
      );

      return c.html(htmlOutput);
    } catch (error) {
      console.error('Failed to render checkout preview page:', error);
      return c.json({
        success: false,
        error: 'Unexpected error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

export default checkoutPreview;
