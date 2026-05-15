/**
 * Demo Deposits Generator
 *
 * Generates deposit address bindings and sample deposit records
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { DEMO_ORGANIZATIONS, DEMO_DATA_COUNTS } from './constants.js';

interface DepositTemplate {
  depositReference: string;
  protocol: 'evm' | 'tron';
  metadata: Record<string, any>;
  // Optional: add sample transfers
  transfers?: Array<{
    amount: string;
    currency: string;
    chainId: string;
    txHash: string;
  }>;
}

/**
 * Generate demo deposit bindings and records
 */
export async function generateDeposits(db: Pool): Promise<void> {
  console.log('  💰 Creating deposit bindings...');

  let totalBindings = 0;
  let totalTransfers = 0;

  for (const org of DEMO_ORGANIZATIONS) {
    const deposits = generateDepositTemplatesForOrg(org.slug);

    for (const template of deposits) {
      // Get an available address from the pool
      const addressResult = await db.query(
        `SELECT address FROM address_pool
         WHERE organization_id = $1 AND protocol = $2 AND state = 'idle'
         LIMIT 1`,
        [org.id, template.protocol]
      );

      if (addressResult.rows.length === 0) {
        console.warn(`     ⚠ No available ${template.protocol} addresses for ${org.slug}, skipping binding`);
        continue;
      }

      const address = addressResult.rows[0].address;

      // Mark address as bound for deposit
      await db.query(
        `UPDATE address_pool
         SET state = 'bound',
             deposit_reference = $1,
             allocated_at = NOW()
         WHERE address = $2`,
        [template.depositReference, address]
      );

      totalBindings++;

      // Create sample transfers if provided
      if (template.transfers && template.transfers.length > 0) {
        for (const transfer of template.transfers) {
          const transferId = randomUUID();
          await db.query(
            `INSERT INTO transfers
             (id, organization_id, deposit_reference, business_type, transaction_hash,
              from_address, to_address, amount, token, chain, block_number, required_confirmations,
              detected_at, confirmed_at, is_confirmed)
             VALUES ($1, $2, $3, 'deposit', $4, $5, $6, $7, $8, $9, 2000000, 3, NOW(), NOW(), true)`,
            [
              transferId,
              org.id,
              template.depositReference,
              transfer.txHash,
              '0x0000000000000000000000000000000000000002', // Mock sender
              address,
              transfer.amount,
              transfer.currency,
              transfer.chainId,
            ]
          );
          totalTransfers++;
        }
      }
    }

    console.log(`     ✓ ${org.slug}: ${deposits.length} bindings`);
  }

  console.log(`     ✓ Total: ${totalBindings} bindings, ${totalTransfers} deposit transfers`);
}

/**
 * Generate deposit templates for an organization
 */
function generateDepositTemplatesForOrg(orgSlug: string): DepositTemplate[] {
  const baseRef = `${orgSlug}-user`;

  return [
    // Active deposit addresses with transfer history
    {
      depositReference: `${baseRef}-1001`,
      protocol: 'evm',
      metadata: { source: 'demo', userType: 'premium', region: 'US' },
      transfers: [
        {
          amount: '500.00',
          currency: 'USDT',
          chainId: 'ethereum-sepolia',
          txHash: `0x${randomUUID().replace(/-/g, '')}`,
        },
        {
          amount: '250.00',
          currency: 'USDC',
          chainId: 'polygon-amoy',
          txHash: `0x${randomUUID().replace(/-/g, '')}`,
        },
      ],
    },
    {
      depositReference: `${baseRef}-1002`,
      protocol: 'evm',
      metadata: { source: 'demo', userType: 'standard', region: 'EU' },
      transfers: [
        {
          amount: '100.00',
          currency: 'USDT',
          chainId: 'ethereum-sepolia',
          txHash: `0x${randomUUID().replace(/-/g, '')}`,
        },
      ],
    },

    // Newly bound addresses (no transfers yet)
    {
      depositReference: `${baseRef}-1003`,
      protocol: 'tron',
      metadata: { source: 'demo', userType: 'trial', region: 'APAC' },
    },
    {
      depositReference: `${baseRef}-1004`,
      protocol: 'evm',
      metadata: { source: 'demo', userType: 'standard', region: 'US' },
    },
    {
      depositReference: `${baseRef}-1005`,
      protocol: 'tron',
      metadata: { source: 'demo', userType: 'premium', region: 'EU' },
    },
  ];
}
