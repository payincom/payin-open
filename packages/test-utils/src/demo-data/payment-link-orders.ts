/**
 * Demo Payment Link Orders Generator
 *
 * Generates sample orders for payment links
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { DEMO_ORGANIZATIONS } from './constants.js';

interface PaymentLinkOrderTemplate {
  buyerEmail: string;
  status: 'pending' | 'completed' | 'expired' | 'canceled';
  selectedChain: string;
  selectedCurrency: string;
  amount: string;
  metadata?: Record<string, any>;
  createdAt?: Date; // When the order was created
  completedAt?: Date;
  orderId?: string; // For completed orders, link to actual order
}

/**
 * Generate demo payment link orders
 */
export async function generatePaymentLinkOrders(db: Pool): Promise<void> {
  console.log('  📦 Creating payment link orders...');

  let totalOrders = 0;

  for (const org of DEMO_ORGANIZATIONS) {
    // Get payment links for this organization
    const paymentLinksResult = await db.query(
      `SELECT id, title, amount, currency, status
       FROM paymentlinks
       WHERE organization_id = $1 AND is_archived = false
       ORDER BY title`,
      [org.id]
    );

    if (paymentLinksResult.rows.length === 0) {
      console.log(`     ⚠ No payment links found for ${org.slug}, skipping`);
      continue;
    }

    for (const paymentLink of paymentLinksResult.rows) {
      const templates = generateOrderTemplatesForLink(org.slug, paymentLink);

      for (const template of templates) {
        const orderId = randomUUID();

        const createdAt = template.createdAt || new Date();
        const updatedAt = template.completedAt || createdAt;

        await db.query(
          `INSERT INTO paymentlink_orders
           (id, paymentlink_id, organization_id, buyer_email, status,
            selected_chain, selected_currency, amount, metadata,
            created_at, updated_at, completed_at, order_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            orderId,
            paymentLink.id,
            org.id,
            template.buyerEmail,
            template.status,
            template.selectedChain,
            template.selectedCurrency,
            template.amount,
            JSON.stringify(template.metadata || {}),
            createdAt,
            updatedAt,
            template.completedAt || null,
            template.orderId || null,
          ]
        );

        totalOrders++;
      }
    }

    console.log(`     ✓ ${org.slug}: Created orders for ${paymentLinksResult.rows.length} payment links`);
  }

  console.log(`     ✓ Total: ${totalOrders} payment link orders`);
}

/**
 * Generate order templates for a payment link
 */
function generateOrderTemplatesForLink(
  orgSlug: string,
  paymentLink: any
): PaymentLinkOrderTemplate[] {
  const linkTitle = paymentLink.title.toLowerCase().replace(/\s+/g, '-');
  const baseEmail = `buyer-${linkTitle}`;
  const amount = parseFloat(paymentLink.amount) > 0 ? paymentLink.amount : '50.00';

  const orders: PaymentLinkOrderTemplate[] = [];

  // Completed orders (2 per link)
  const completedAt1 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  orders.push({
    buyerEmail: `${baseEmail}-001@example.com`,
    status: 'completed',
    selectedChain: 'ethereum-sepolia',
    selectedCurrency: paymentLink.currency || 'USDT',
    amount: amount,
    metadata: { source: 'demo', type: 'completed' },
    createdAt: new Date(completedAt1.getTime() - 2 * 60 * 60 * 1000), // Created 2 hours before completion
    completedAt: completedAt1,
  });

  // Completed 12 hours ago (within 24h window for revenue testing)
  const completedAt2 = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
  orders.push({
    buyerEmail: `${baseEmail}-002@example.com`,
    status: 'completed',
    selectedChain: 'polygon-amoy',
    selectedCurrency: paymentLink.currency || 'USDT',
    amount: amount,
    metadata: { source: 'demo', type: 'completed' },
    createdAt: new Date(completedAt2.getTime() - 30 * 60 * 1000), // Created 30 minutes before completion
    completedAt: completedAt2,
  });

  // Pending orders (1 per link) - created 2 hours ago
  orders.push({
    buyerEmail: `${baseEmail}-pending@example.com`,
    status: 'pending',
    selectedChain: 'ethereum-sepolia',
    selectedCurrency: paymentLink.currency || 'USDT',
    amount: amount,
    metadata: { source: 'demo', type: 'pending' },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  });

  // Expired order (1 per link, only for published links) - created 5 days ago
  if (paymentLink.status === 'published') {
    orders.push({
      buyerEmail: `${baseEmail}-expired@example.com`,
      status: 'expired',
      selectedChain: 'ethereum-sepolia',
      selectedCurrency: paymentLink.currency || 'USDT',
      amount: amount,
      metadata: { source: 'demo', type: 'expired' },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });
  }

  return orders;
}
