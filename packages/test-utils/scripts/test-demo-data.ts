/**
 * Test Demo Data Generation
 *
 * This script tests the demo data generator against an existing database
 *
 * Usage:
 *   tsx scripts/test-demo-data.ts [connection-string]
 *
 * Example:
 *   tsx scripts/test-demo-data.ts "postgresql://postgres:password@localhost:5432/payin"
 *
 * Or use environment variable:
 *   DATABASE_URL="postgresql://..." tsx scripts/test-demo-data.ts
 */

import { Pool } from 'pg';

// Get connection string from args or environment
const connectionString =
  process.argv[2] ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/payin_test';

/**
 * Check if required tables exist
 */
async function checkTables(db: Pool): Promise<{ exists: string[]; missing: string[] }> {
  const requiredTables = [
    'organizations',
    'users',
    'organization_members',
    'address_pool',
    'orders',
    'transfers',
    'paymentlinks',
  ];

  const exists: string[] = [];
  const missing: string[] = [];

  for (const table of requiredTables) {
    const result = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )`,
      [table]
    );

    if (result.rows[0].exists) {
      exists.push(table);
    } else {
      missing.push(table);
    }
  }

  return { exists, missing };
}

/**
 * Count existing records in key tables
 */
async function countRecords(db: Pool): Promise<Record<string, number>> {
  const tables = [
    'organizations',
    'users',
    'organization_members',
    'address_pool',
    'orders',
    'transfers',
    'paymentlinks',
  ];

  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = parseInt(result.rows[0].count, 10);
    } catch (error) {
      counts[table] = -1; // Table doesn't exist
    }
  }

  return counts;
}

/**
 * Verify generated data
 */
async function verifyData(db: Pool): Promise<void> {
  console.log('');
  console.log('🔍 Verifying generated data...');
  console.log('');

  // Check organizations
  const orgs = await db.query('SELECT id, slug, name FROM organizations ORDER BY slug');
  console.log(`✓ Organizations: ${orgs.rows.length}`);
  orgs.rows.forEach((org) => {
    console.log(`  - ${org.slug} (${org.name}): ${org.id}`);
  });
  console.log('');

  // Check users per organization
  const users = await db.query(`
    SELECT o.slug, COUNT(om.user_id) as user_count
    FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    GROUP BY o.id, o.slug
    ORDER BY o.slug
  `);
  console.log(`✓ Users per organization:`);
  users.rows.forEach((row) => {
    console.log(`  - ${row.slug}: ${row.user_count} users`);
  });
  console.log('');

  // Check addresses per organization and protocol
  const addresses = await db.query(`
    SELECT o.slug, ap.protocol, COUNT(*) as count
    FROM organizations o
    LEFT JOIN address_pool ap ON o.id = ap.organization_id
    GROUP BY o.id, o.slug, ap.protocol
    ORDER BY o.slug, ap.protocol
  `);
  console.log(`✓ Addresses per organization:`);
  let currentOrg = '';
  addresses.rows.forEach((row) => {
    if (row.slug !== currentOrg) {
      currentOrg = row.slug;
      console.log(`  ${row.slug}:`);
    }
    if (row.protocol) {
      console.log(`    - ${row.protocol}: ${row.count}`);
    }
  });
  console.log('');

  // Check orders per organization and status
  const orders = await db.query(`
    SELECT o.slug, ord.status, COUNT(*) as count
    FROM organizations o
    LEFT JOIN orders ord ON o.id = ord.organization_id
    GROUP BY o.id, o.slug, ord.status
    ORDER BY o.slug, ord.status
  `);
  console.log(`✓ Orders per organization:`);
  currentOrg = '';
  orders.rows.forEach((row) => {
    if (row.slug !== currentOrg) {
      currentOrg = row.slug;
      console.log(`  ${row.slug}:`);
    }
    if (row.status) {
      console.log(`    - ${row.status}: ${row.count}`);
    }
  });
  console.log('');

  // Check deposits (bound addresses)
  const deposits = await db.query(`
    SELECT o.slug, COUNT(*) as count
    FROM organizations o
    LEFT JOIN address_pool ap ON o.id = ap.organization_id AND ap.state = 'bound'
    WHERE ap.address IS NOT NULL
    GROUP BY o.id, o.slug
    ORDER BY o.slug
  `);
  console.log(`✓ Deposit bindings per organization:`);
  deposits.rows.forEach((row) => {
    console.log(`  - ${row.slug}: ${row.count}`);
  });
  console.log('');

  // Check payment links
  const paymentLinks = await db.query(`
    SELECT o.slug, pl.status, COUNT(*) as count
    FROM organizations o
    LEFT JOIN paymentlinks pl ON o.id = pl.organization_id
    GROUP BY o.id, o.slug, pl.status
    ORDER BY o.slug, pl.status
  `);
  console.log(`✓ Payment links per organization:`);
  currentOrg = '';
  paymentLinks.rows.forEach((row) => {
    if (row.slug !== currentOrg) {
      currentOrg = row.slug;
      console.log(`  ${row.slug}:`);
    }
    if (row.status) {
      console.log(`    - ${row.status}: ${row.count}`);
    }
  });
  console.log('');
}

/**
 * Main test function
 */
async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('  Demo Data Generation Test');
  console.log('='.repeat(70));
  console.log('');
  console.log(`📊 Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');

  const db = new Pool({ connectionString });

  try {
    // 1. Check database connection
    console.log('🔌 Testing database connection...');
    await db.query('SELECT 1');
    console.log('✅ Database connection successful');
    console.log('');

    // 2. Check tables
    console.log('📋 Checking required tables...');
    const { exists, missing } = await checkTables(db);
    console.log(`✓ Found: ${exists.join(', ')}`);
    if (missing.length > 0) {
      console.log(`❌ Missing: ${missing.join(', ')}`);
      console.log('');
      console.log('⚠️  Please run INIT_DB=true to create missing tables first');
      process.exit(1);
    }
    console.log('');

    // 3. Count existing records (before)
    console.log('📊 Current database state:');
    const beforeCounts = await countRecords(db);
    for (const [table, count] of Object.entries(beforeCounts)) {
      console.log(`  ${table.padEnd(25)} ${count.toString().padStart(5)} records`);
    }
    console.log('');

    // 4. Ask for confirmation
    console.log('⚠️  This will generate demo data in the database.');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('');

    // 5. Generate demo data
    console.log('🎭 Generating demo data...');
    console.log('━'.repeat(70));

    // Import and run the generator
    // Note: We need to build the package first
    const { generateDemoData } = await import('../dist/demo-data/index.js');

    await generateDemoData({ connectionString });

    console.log('━'.repeat(70));
    console.log('');

    // 6. Count records after
    console.log('📊 Database state after generation:');
    const afterCounts = await countRecords(db);
    for (const [table, count] of Object.entries(afterCounts)) {
      const before = beforeCounts[table];
      const diff = count - before;
      const diffStr = diff > 0 ? `(+${diff})` : '';
      console.log(`  ${table.padEnd(25)} ${count.toString().padStart(5)} records ${diffStr}`);
    }
    console.log('');

    // 7. Verify data
    await verifyData(db);

    console.log('='.repeat(70));
    console.log('✅ Demo data generation test completed successfully!');
    console.log('='.repeat(70));
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error);
    console.error('');
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the test
main();
