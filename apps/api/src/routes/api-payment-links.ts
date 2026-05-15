/**
 * Public API routes for Payment Link operations
 */

import { Hono } from 'hono';
import type { PaymentLinkStatus } from '@payin/manager';
import { getManager } from '../manager-instance.js';

const publicPaymentLinks = new Hono();

interface CreatePublicPaymentLinkOrderRequest {
  email: string;
  currency: string;
  chainId: string;
  amount?: string | number;
}

const serializeStatus = (status: PaymentLinkStatus) => status;

type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 410 | 500;

publicPaymentLinks.get('/:slug', async (c) => {
  try {
    const manager = getManager();
    const slug = c.req.param('slug');

    // Get checkout data with currency options
    const checkoutData = await manager.getPaymentLinkCheckoutData(slug);

    const inventoryInfo = await (async () => {
      const link = await manager.getPaymentLinkBySlug(slug);
      if (!link) return { total: null, available: null };
      const total = link.inventory_total ?? null;
      const available = total !== null
        ? Math.max(0, total - link.inventory_reserved - link.inventory_sold)
        : null;
      return { total, available };
    })();

    return c.json({
      success: true,
      data: {
        id: checkoutData.id,
        slug: slug,
        title: checkoutData.title,
        description: checkoutData.description,
        amount: checkoutData.amount,
        currencies: checkoutData.currencies,
        expiresAt: checkoutData.expires_at ? checkoutData.expires_at.toISOString() : null,
        availableInventory: inventoryInfo.available,
      },
    });
  } catch (error) {
    console.error('Failed to fetch public payment link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.includes('not found') ? 404 :
                   errorMessage.includes('not available') ? 410 : 500;

    return c.json({
      success: false,
      error: 'Failed to fetch payment link',
      message: errorMessage,
    }, status);
  }
});

publicPaymentLinks.post('/:slug/orders', async (c) => {
  try {
    const manager = getManager();
    const slug = c.req.param('slug');
    const body = await c.req.json<CreatePublicPaymentLinkOrderRequest>();

    // Validate required fields
    if (!body ||
        typeof body.email !== 'string' || body.email.trim() === '' ||
        typeof body.currency !== 'string' || body.currency.trim() === '' ||
        typeof body.chainId !== 'string' || body.chainId.trim() === '') {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Required fields: email, currency, chainId',
      }, 400);
    }

    const email = body.email.trim();
    const currency = body.currency.trim();
    const chainId = body.chainId.trim();

    const amount =
      typeof body.amount === 'number'
        ? body.amount
        : typeof body.amount === 'string'
        ? body.amount.trim()
        : undefined;

    const result = await manager.createPaymentLinkOrder({
      slug,
      buyerEmail: email,
      currency,
      chainId,
      amount,
    });

    return c.json({
      success: true,
      data: {
        order: result.order,
        paymentLink: {
          slug: result.paymentLink.slug,
          title: result.paymentLink.title,
          description: result.paymentLink.description,
          amount: result.paymentLink.amount,
          currencies: result.paymentLink.currencies.map((c) => ({
            currency: c.currency,
            amount: c.amount ?? result.paymentLink.amount,
            chains: c.chain_options,
            is_primary: c.is_primary,
          })),
          metadata: result.paymentLink.metadata ?? {},
        },
        paymentLinkOrder: result.paymentLinkOrder,
      },
    }, 201);
  } catch (error) {
    console.error('Failed to create payment link order:', error);

    if (error instanceof Error) {
      const normalizedMessage = error.message || '';
      const knownStatuses: Record<string, HttpErrorStatus> = {
        'Payment Link not found': 404,
        'Payment Link is not available for payment': 409,
        'Payment Link has expired': 410,
        'Payment Link is sold out': 409,
        'Selected currency is not available for this Payment Link': 400,
        'Selected chain is not available for this currency': 400,
        'Custom amount is required for this Payment Link': 400,
        'Invalid custom amount. Enter a number greater than 0.': 400,
      };
      const status: HttpErrorStatus = knownStatuses[normalizedMessage] ?? 500;

      return c.json({
        success: false,
        error: normalizedMessage || 'Failed to create payment link order',
        message: normalizedMessage || 'Failed to create payment link order',
      }, status);
    }

    return c.json({
      success: false,
      error: 'Failed to create payment link order',
      message: 'Unknown error',
    }, 500);
  }
});

export default publicPaymentLinks;
