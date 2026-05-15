#!/usr/bin/env tsx

/**
 * Seed Demo Data Script
 *
 * Generates complete demo dataset for test environment
 *
 * Usage:
 *   tsx scripts/seed-demo-data.ts
 *
 * Or with custom database:
 *   DB_CONNECTION_STRING="postgresql://..." tsx scripts/seed-demo-data.ts
 */

import { generateDemoData } from '../packages/test-utils/src/demo-data/index.js';

async function main() {
  // Get database connection from environment variable
  const connectionString = process.env.DB_CONNECTION_STRING;

  if (!connectionString) {
    console.error('❌ Error: DB_CONNECTION_STRING environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  export DB_CONNECTION_STRING="postgresql://..."');
    console.error('  tsx scripts/seed-demo-data.ts');
    console.error('');
    console.error('Or inline:');
    console.error('  DB_CONNECTION_STRING="postgresql://..." tsx scripts/seed-demo-data.ts');
    console.error('');
    process.exit(1);
  }

  try {
    await generateDemoData({ connectionString });
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed demo data:', error);
    process.exit(1);
  }
}

main();
