/**
 * Reset database for Manager tests
 * Drops all Manager-related tables and recreates them
 */

import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/payin_test';

async function resetDatabase() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔧 Resetting Manager database tables...\n');

    // Drop all tables in reverse order (to handle foreign keys)
    const tablesToDrop = [
      'processor_config_history',
      'processor_configs',
      'processor_rpc_chain_configs',
      'processor_rpc_providers',
      'processor_token_chains',
      'processor_tokens',
      'processor_chains',
    ];

    console.log('📋 Dropping existing tables...');
    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✓ Dropped ${table}`);
      } catch (error: any) {
        console.log(`  ⚠️  Could not drop ${table}: ${error.message}`);
      }
    }

    console.log('\n✅ Database reset complete!');
    console.log('💡 Run the integration test to recreate tables with correct schema.\n');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetDatabase().catch(console.error);
