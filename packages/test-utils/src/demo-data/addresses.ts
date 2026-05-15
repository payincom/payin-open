/**
 * Demo Address Pool Generator
 *
 * Generates address pool for all organizations and protocols
 */

import { Pool } from 'pg';
import { UnifiedAddressGenerator } from '../processor/address-generator.js';
import { DEMO_ORGANIZATIONS, ADDRESS_POOL_CONFIG } from './constants.js';

/**
 * Generate demo address pools
 */
export async function generateAddressPools(db: Pool): Promise<void> {
  console.log('  💳 Creating address pools...');

  let totalAddresses = 0;

  for (const org of DEMO_ORGANIZATIONS) {
    const generator = new UnifiedAddressGenerator(org.mnemonic);

    // Generate EVM addresses
    const evmAddresses = generator.generateAddresses('evm', ADDRESS_POOL_CONFIG.perOrganization.evm);
    for (const addr of evmAddresses) {
      await db.query(
        `INSERT INTO address_pool
         (organization_id, address, protocol, derivation_index, master_public_key, state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'idle', NOW())
         ON CONFLICT (address) DO NOTHING`,
        [org.id, addr.address, 'evm', addr.derivationIndex, generator.getMasterPublicKey('evm')]
      );
    }
    totalAddresses += evmAddresses.length;

    // Generate Solana addresses
    const solanaAddresses = generator.generateAddresses('solana', ADDRESS_POOL_CONFIG.perOrganization.solana);
    for (const addr of solanaAddresses) {
      await db.query(
        `INSERT INTO address_pool
         (organization_id, address, protocol, derivation_index, master_public_key, state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'idle', NOW())
         ON CONFLICT (address) DO NOTHING`,
        [org.id, addr.address, 'solana', addr.derivationIndex, generator.getMasterPublicKey('solana')]
      );
    }
    totalAddresses += solanaAddresses.length;

    // Generate Tron addresses (currently mock implementation)
    const tronAddresses = generator.generateAddresses('tron', ADDRESS_POOL_CONFIG.perOrganization.tron);
    for (const addr of tronAddresses) {
      await db.query(
        `INSERT INTO address_pool
         (organization_id, address, protocol, derivation_index, master_public_key, state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'idle', NOW())
         ON CONFLICT (address) DO NOTHING`,
        [org.id, addr.address, 'tron', addr.derivationIndex, generator.getMasterPublicKey('tron')]
      );
    }
    totalAddresses += tronAddresses.length;

    console.log(`     ✓ ${org.slug}: ${evmAddresses.length} EVM + ${solanaAddresses.length} Solana + ${tronAddresses.length} Tron`);
  }

  console.log(`     ✓ Total: ${totalAddresses} addresses across ${DEMO_ORGANIZATIONS.length} organizations`);
}
