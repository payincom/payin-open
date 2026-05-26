/**
 * Run multi-tenancy migration script
 */

import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  // Get database URL from environment or use default
  const databaseUrl = process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/payin_test';

  console.log('🚀 Starting multi-tenancy migration...');
  console.log(`📊 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../src/database/migrations/001_multi_tenancy.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration script...');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n📋 Verifying created tables...');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('organizations', 'organization_members')
      ORDER BY table_name
    `);

    if (result.rows.length === 2) {
      console.log('✅ All tables created:');
      result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    } else {
      console.warn('⚠️  Some tables may not have been created');
    }

    // Check merchant organization
    const orgResult = await pool.query(`
      SELECT id, name, slug FROM organizations WHERE slug = 'default'
    `);

    if (orgResult.rows.length > 0) {
      console.log('\n✅ Single organization created:');
      console.log(`  ID: ${orgResult.rows[0].id}`);
      console.log(`  Name: ${orgResult.rows[0].name}`);
      console.log(`  Slug: ${orgResult.rows[0].slug}`);
    }

    // Check API keys migration
    const apiKeyCount = await pool.query(`
      SELECT COUNT(*) as count FROM api_keys WHERE organization_id IS NOT NULL
    `);

    console.log(`\n✅ API Keys migrated: ${apiKeyCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
