/**
 * Demo Data Generator
 *
 * Generates complete demo dataset for development and testing
 *
 * Usage:
 * ```typescript
 * import { generateDemoData } from '@payin/test-utils/demo-data';
 *
 * await generateDemoData({
 *   connectionString: 'postgresql://...',
 * });
 * ```
 */

import { Pool } from 'pg';
import { generateOrganizations, addAdminUserToOrganizations } from './organizations.js';
import { generateAddressPools } from './addresses.js';
import { generateOrders } from './orders.js';
import { generateDeposits } from './deposits.js';
import { generatePaymentLinks } from './payment-links.js';
import { generatePaymentLinkOrders } from './payment-link-orders.js';

export interface DemoDataOptions {
  /** Database connection string */
  connectionString: string;

  /** Skip specific data generation (for partial regeneration) */
  skip?: {
    organizations?: boolean;
    adminUser?: boolean;
    addresses?: boolean;
    orders?: boolean;
    deposits?: boolean;
    paymentLinks?: boolean;
    paymentLinkOrders?: boolean;
  };
}

/**
 * Generate complete demo dataset
 *
 * This function populates the database with:
 * - 3 organizations (TechCorp, GameStudio, ECommerce)
 * - 9 users across organizations with different roles
 * - Admin user access to all demo organizations
 * - Address pools for all protocols (EVM, Solana, Tron)
 * - Sample orders in various states (pending, completed, expired)
 * - Deposit bindings with transfer history
 * - Payment links with different configurations
 * - Payment link orders (buyer orders through payment links)
 *
 * @param options Configuration options
 */
export async function generateDemoData(options: DemoDataOptions): Promise<void> {
  const { connectionString, skip = {} } = options;
  const db = new Pool({ connectionString });

  try {
    console.log('');
    console.log('🎭 Generating Demo Data');
    console.log('━'.repeat(60));
    console.log('');

    const startTime = Date.now();

    // 1. Organizations and users (foundation)
    if (!skip.organizations) {
      await generateOrganizations(db);
      console.log('');
    }

    // 1a. Add admin user to demo organizations (so admin can access demo data)
    if (!skip.adminUser) {
      await addAdminUserToOrganizations(db);
      console.log('');
    }

    // 2. Address pools (required for orders and deposits)
    if (!skip.addresses) {
      await generateAddressPools(db);
      console.log('');
    }

    // 3. Orders (uses addresses from pool)
    if (!skip.orders) {
      await generateOrders(db);
      console.log('');
    }

    // 4. Deposits (uses addresses from pool)
    if (!skip.deposits) {
      await generateDeposits(db);
      console.log('');
    }

    // 5. Payment links
    if (!skip.paymentLinks) {
      await generatePaymentLinks(db);
      console.log('');
    }

    // 6. Payment link orders (requires payment links)
    if (!skip.paymentLinkOrders) {
      await generatePaymentLinkOrders(db);
      console.log('');
    }

    const duration = Date.now() - startTime;

    console.log('━'.repeat(60));
    console.log(`✅ Demo data generated successfully in ${duration}ms`);
    console.log('');
    console.log('📊 Demo Data Summary:');
    console.log('   • 3 organizations (tech-corp, game-studio, e-commerce)');
    console.log('   • 9 users with different roles (owner, admin, member, viewer)');
    console.log('   • Admin user added to all demo organizations');
    console.log('   • ~180 addresses across all protocols and organizations');
    console.log('   • ~24 orders (pending, completed, expired)');
    console.log('   • ~15 deposit bindings with transfer history');
    console.log('   • ~9 payment links (published, draft)');
    console.log('   • ~27 payment link orders (completed, pending, expired)');
    console.log('');
    console.log('🔐 Demo Login Credentials:');
    console.log('   Admin: admin / admin123 (access all demo organizations)');
    console.log('   Demo users: alice_owner, bob_owner, carol_owner / Test1234!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Failed to generate demo data:', error);
    console.error('');
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * Re-export constants for external use
 */
export { DEMO_ORGANIZATIONS, DEMO_USERS, ADDRESS_POOL_CONFIG, DEMO_DATA_COUNTS } from './constants.js';
export { getOrgById, getUsersByOrg, getOwnerUser } from './organizations.js';
