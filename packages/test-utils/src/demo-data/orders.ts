/**
 * Demo Orders Generator
 *
 * Generates sample orders with various states and scenarios
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { DEMO_ORGANIZATIONS, DEMO_DATA_COUNTS } from './constants.js';

interface OrderTemplate {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  status: 'pending' | 'completed' | 'expired';
  metadata: Record<string, any>;
  // For completed orders
  txHash?: string;
  completedAt?: Date;
}

/**
 * Generate demo orders
 */
export async function generateOrders(db: Pool): Promise<void> {
  console.log('  🛒 Creating demo orders...');

  let totalOrders = 0;

  for (const org of DEMO_ORGANIZATIONS) {
    const orders = generateOrderTemplatesForOrg(org.slug);

    for (const template of orders) {
      // Get an available address from the pool
      const addressResult = await db.query(
        `SELECT address FROM address_pool
         WHERE organization_id = $1 AND protocol = 'evm' AND state = 'idle'
         LIMIT 1`,
        [org.id]
      );

      if (addressResult.rows.length === 0) {
        console.warn(`     ⚠ No available addresses for ${org.slug}, skipping order`);
        continue;
      }

      const address = addressResult.rows[0].address;
      const orderId = randomUUID();

      // Mark address as allocated for this order
      await db.query(
        `UPDATE address_pool
         SET state = 'allocated',
             order_id = $1,
             allocated_at = NOW()
         WHERE address = $2`,
        [orderId, address]
      );

      // Create order
      await db.query(
        `INSERT INTO orders
         (id, organization_id, order_reference, amount, token, chain, status,
          address, metadata, created_at, updated_at, completed_at,
          payment_window_ends_at, grace_period_ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10,
                 NOW() + INTERVAL '10 minutes', NOW() + INTERVAL '15 minutes')`,
        [
          orderId,
          org.id,
          template.orderReference,
          template.amount,
          template.currency,
          template.chainId,
          template.status,
          address,
          JSON.stringify(template.metadata),
          template.completedAt || null,
        ]
      );

      // For completed orders, create a transfer record
      if (template.status === 'completed' && template.txHash) {
        const transferId = randomUUID();
        await db.query(
          `INSERT INTO transfers
           (id, organization_id, order_id, business_type, transaction_hash, from_address, to_address,
            amount, token, chain, block_number, required_confirmations, detected_at, confirmed_at, is_confirmed)
           VALUES ($1, $2, $3, 'order', $4, $5, $6, $7, $8, $9, 1000000, 3, NOW(), NOW(), true)`,
          [
            transferId,
            org.id,
            orderId,
            template.txHash,
            '0x0000000000000000000000000000000000000001', // Mock sender
            address,
            template.amount,
            template.currency,
            template.chainId,
          ]
        );

        // Release the address back to pool (completed orders release addresses)
        await db.query(
          `UPDATE address_pool
           SET state = 'idle',
               order_id = NULL,
               recycled_at = NOW(),
               cooldown_until = NOW() + INTERVAL '30 minutes'
           WHERE address = $1`,
          [address]
        );
      }

      totalOrders++;
    }

    console.log(`     ✓ ${org.slug}: ${orders.length} orders`);
  }

  console.log(`     ✓ Total: ${totalOrders} orders`);
}

/**
 * Generate order templates for an organization
 */
function generateOrderTemplatesForOrg(orgSlug: string): OrderTemplate[] {
  const baseRef = `${orgSlug}-order`;

  return [
    // Pending orders (40%)
    {
      orderReference: `${baseRef}-pending-001`,
      amount: '100.00',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'pending' as const,
      metadata: { source: 'demo', category: 'subscription' },
    },
    {
      orderReference: `${baseRef}-pending-002`,
      amount: '50.50',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'pending' as const,
      metadata: { source: 'demo', category: 'purchase' },
    },
    {
      orderReference: `${baseRef}-pending-003`,
      amount: '250.00',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'pending' as const,
      metadata: { source: 'demo', category: 'premium' },
    },

    // Completed orders (varied time ranges)
    // 24h range: Recent completions
    {
      orderReference: `${baseRef}-completed-recent-001`,
      amount: '29.99',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      metadata: { source: 'demo', category: 'addon', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-recent-002`,
      amount: '59.99',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      metadata: { source: 'demo', category: 'purchase', completed: true },
    },
    // 7d range: Within last week
    {
      orderReference: `${baseRef}-completed-7d-001`,
      amount: '49.99',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      metadata: { source: 'demo', category: 'addon', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-7d-002`,
      amount: '99.99',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      metadata: { source: 'demo', category: 'subscription', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-7d-003`,
      amount: '199.00',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      metadata: { source: 'demo', category: 'purchase', completed: true },
    },
    // 30d range: Older completions
    {
      orderReference: `${baseRef}-completed-30d-001`,
      amount: '149.99',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      metadata: { source: 'demo', category: 'premium', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-30d-002`,
      amount: '299.00',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      metadata: { source: 'demo', category: 'enterprise', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-30d-003`,
      amount: '79.99',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      metadata: { source: 'demo', category: 'subscription', completed: true },
    },
    {
      orderReference: `${baseRef}-completed-30d-004`,
      amount: '399.00',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'completed' as const,
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
      completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      metadata: { source: 'demo', category: 'enterprise', completed: true },
    },

    // Expired orders (20%)
    {
      orderReference: `${baseRef}-expired-001`,
      amount: '75.00',
      currency: 'USDT',
      chainId: 'ethereum-sepolia',
      status: 'expired' as const,
      metadata: { source: 'demo', category: 'subscription', expired: true },
    },
    {
      orderReference: `${baseRef}-expired-002`,
      amount: '150.00',
      currency: 'USDC',
      chainId: 'polygon-amoy',
      status: 'expired' as const,
      metadata: { source: 'demo', category: 'purchase', expired: true },
    },
  ];
}
