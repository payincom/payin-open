#!/usr/bin/env tsx
/**
 * Database Initialization Script
 *
 * This script initializes the PayIn database schema and optionally generates demo data.
 * It can be run independently of the main application, making it suitable for:
 * - Initial deployment setup
 * - CI/CD pipelines
 * - Local development environment setup
 * - Database reset/refresh
 *
 * Usage:
 *   # Initialize database only (no demo data)
 *   tsx scripts/init-database.ts
 *
 *   # Initialize database with demo data
 *   tsx scripts/init-database.ts --demo-data
 *
 *   # Force re-initialization (drop existing tables)
 *   tsx scripts/init-database.ts --force
 *
 *   # Initialize with demo data and force reset
 *   tsx scripts/init-database.ts --demo-data --force
 *
 * Environment Variables:
 *   DB_CONNECTION_STRING - Database connection string (required)
 *   NODE_ENV - Environment (development/test/production)
 */

import { parseArgs } from 'node:util';
import { buildInitDatabasePlan, type InitModulePlan, type ProcessorInitPlan } from './init-database-plan.js';

interface InitOptions {
  demoData: boolean;
  force: boolean;
  openSafe: boolean;
  connectionString: string;
}

/**
 * Parse command line arguments
 */
function parseArguments(): InitOptions {
  const { values } = parseArgs({
    options: {
      'demo-data': { type: 'boolean', default: false },
      'force': { type: 'boolean', default: false },
      'open-safe': { type: 'boolean', default: false },
      'help': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Database Initialization Script

Usage:
  tsx scripts/init-database.ts [options]

Options:
  --demo-data    Generate demo data after initialization
  --force        Force re-initialization (drop existing tables); generic force keeps legacy admin behavior
  --open-safe    Use Open-safe schema init/reset without creating default users
  --help         Show this help message

Environment Variables:
  DB_CONNECTION_STRING    Database connection string (required)
  NODE_ENV               Environment (development/test/production)

Examples:
  # Initialize database only
  tsx scripts/init-database.ts

  # Initialize with demo data
  tsx scripts/init-database.ts --demo-data

  # Force reset with demo data
  tsx scripts/init-database.ts --force --demo-data
`);
    process.exit(0);
  }

  const connectionString = process.env.DB_CONNECTION_STRING;
  if (!connectionString) {
    console.error('❌ Error: DB_CONNECTION_STRING environment variable is required');
    console.error('   Example: DB_CONNECTION_STRING=postgresql://user:pass@host:5432/db tsx scripts/init-database.ts');
    process.exit(1);
  }

  return {
    demoData: values['demo-data'] as boolean,
    force: values['force'] as boolean,
    openSafe: values['open-safe'] as boolean,
    connectionString,
  };
}

/**
 * Initialize Auth module schema
 */
async function initializeAuthSchema(connectionString: string, plan: InitModulePlan): Promise<void> {
  console.log('🔐 Initializing Auth schema...');

  const { AuthManager } = await import('@payin/auth');
  const { EmailService, BrevoProvider } = await import('@payin/email');

  // Create a temporary email provider for schema initialization
  const brevoProvider = new BrevoProvider({
    user: process.env.BREVO_SMTP_USER || 'dummy-user@example.com',
    password: process.env.BREVO_SMTP_PASSWORD || 'dummy-password',
    from: process.env.BREVO_FROM_EMAIL || 'noreply@example.com',
  });

  const emailService = new EmailService({
    provider: brevoProvider,
    defaultFrom: process.env.BREVO_FROM_EMAIL || 'noreply@example.com',
  });

  const authManager = new AuthManager({
    connectionString,
    jwtSecret: process.env.JWT_SECRET || 'temp-secret-for-init',
    tokenExpiration: '24h',
    emailService,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  });

  if (plan.mode === 'schema-only') {
    try {
      await authManager.initializeSchemaOnly({ dropExisting: plan.dropExisting });
      console.log('   ✅ Auth schema initialized without default users');
    } finally {
      await authManager.close();
    }
    return;
  }

  // Legacy aggressive path: force reset only. This drops Auth tables and creates default admin.
  const originalInitDb = process.env.INIT_DB;
  process.env.INIT_DB = 'true';

  try {
    await authManager.initialize();
    console.log('   ✅ Auth schema initialized');
  } finally {
    await authManager.close();
    if (originalInitDb !== undefined) {
      process.env.INIT_DB = originalInitDb;
    } else {
      delete process.env.INIT_DB;
    }
  }
}

/**
 * Initialize Manager module schema
 */
async function initializeManagerSchema(connectionString: string, plan: InitModulePlan): Promise<void> {
  console.log('🏗️  Initializing Manager schema...');

  const { ConfigurationManager } = await import('@payin/manager');

  const manager = new ConfigurationManager({
    connectionString,
    autoInit: true,
  });

  if (plan.mode === 'schema-only') {
    try {
      await manager.initializeSchemaOnly({ dropExisting: plan.dropExisting });
      console.log(`   ✅ Manager schema initialized ${plan.dropExisting ? 'after reset' : 'without dropping data'}`);
    } finally {
      await manager.close();
    }
    return;
  }

  // Legacy aggressive path: force reset only. This drops Manager tables.
  const originalInitDb = process.env.INIT_DB;
  process.env.INIT_DB = 'true';

  try {
    await manager.initialize();

    console.log('   ✅ Manager schema initialized');
  } finally {
    await manager.close();
    if (originalInitDb !== undefined) {
      process.env.INIT_DB = originalInitDb;
    } else {
      delete process.env.INIT_DB;
    }
  }
}

/**
 * Initialize Processor module schema
 */
async function initializeProcessorSchema(connectionString: string, plan: ProcessorInitPlan): Promise<void> {
  console.log('⚙️  Initializing Processor schema...');

  const { PostgreSQLDatabase, DEFAULT_OPEN_ORGANIZATION_ID } = await import('@payin/processor');
  const openMerchantOrganizationId =
    process.env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_ORGANIZATION_ID;

  const database = new PostgreSQLDatabase(connectionString);
  await database.initialize();

  try {
    await database.initializeDatabaseSchema({
      dropExisting: plan.dropExisting,
      onlyMissing: plan.onlyMissing,
      force: plan.force,
    });

    await database.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         updated_at = NOW()`,
      [openMerchantOrganizationId, 'PayIn Open Merchant', 'payin-open-merchant']
    );

    console.log('   ✅ Processor schema initialized');
    console.log('   ✅ PayIn Open merchant organization ensured');
  } finally {
    await database.close();
  }
}

/**
 * Generate demo data
 */
async function generateDemoData(connectionString: string): Promise<void> {
  console.log('');
  console.log('🎭 Generating Demo Data...');

  const { generateDemoData } = await import('@payin/test-utils/demo-data');

  await generateDemoData({ connectionString });

  console.log('   ✅ Demo data generated');
}

/**
 * Main execution
 */
async function main() {
  const options = parseArguments();

  console.log('');
  console.log('═'.repeat(60));
  console.log('  PayIn Database Initialization');
  console.log('═'.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log(`  Environment:    ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database:       ${options.connectionString.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`  Force Reset:    ${options.force ? 'Yes' : 'No'}`);
  console.log(`  Open Safe:      ${options.openSafe ? 'Yes' : 'No'}`);
  console.log(`  Demo Data:      ${options.demoData ? 'Yes' : 'No'}`);
  console.log('');

  // Confirm force reset in production
  if (options.force && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  WARNING: Force reset in production environment!');
    console.warn('   This will DROP ALL EXISTING TABLES and data.');
    console.warn('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    console.warn('');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const plan = buildInitDatabasePlan({ force: options.force, openSafe: options.openSafe });
  const startTime = Date.now();

  try {
    // Step 1: Initialize Auth schema
    await initializeAuthSchema(options.connectionString, plan.auth);
    console.log('');

    // Step 2: Initialize Manager schema
    await initializeManagerSchema(options.connectionString, plan.manager);
    console.log('');

    // Step 3: Initialize Processor schema
    await initializeProcessorSchema(options.connectionString, plan.processor);
    console.log('');

    // Step 4: Generate demo data (optional)
    if (options.demoData) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Skipping demo data generation in production environment');
      } else {
        await generateDemoData(options.connectionString);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ Database initialization completed in ${duration}s`);
    console.log('═'.repeat(60));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ Database initialization failed');
    console.error('═'.repeat(60));
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');

    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run main function
main();
