/**
 * Test Schema Manager
 *
 * Manages isolated database schemas for test isolation
 *
 * Creates separate test schemas (e.g., 'test', 'test_xxx') to avoid
 * interfering with production data in 'public' schema
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface SchemaManagerOptions {
  connectionString: string
  schema?: string  // Default: 'test'
}

export class TestSchemaManager {
  private pool: Pool
  private schema: string

  constructor(options: SchemaManagerOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: 5
    })
    // Default to 'test' schema, NEVER use 'public'
    this.schema = options.schema || 'test'

    if (this.schema === 'public') {
      throw new Error('Cannot use "public" schema for tests! Use a test-specific schema like "test"')
    }
  }

  /**
   * Initialize test schema
   *
   * Creates isolated schema and all required tables
   */
  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect()
    try {
      // Create test schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`)
      await client.query(`SET search_path TO ${this.schema}`)

      // Create tables in test schema
      await this.createTables(client)
    } finally {
      client.release()
    }
  }

  /**
   * Create all required tables in the test schema
   */
  private async createTables(client: any): Promise<void> {
    // First, ensure organizations table exists (needed for foreign keys)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Create address_pool table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.address_pool (
        address VARCHAR(255) PRIMARY KEY,
        derivation_index INTEGER,
        protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('evm', 'tron', 'solana')),
        state VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'allocated', 'bound')),
        order_id VARCHAR(255),
        deposit_reference VARCHAR(255),
        allocated_at TIMESTAMPTZ,
        recycled_at TIMESTAMPTZ,
        cooldown_until TIMESTAMPTZ,
        master_public_key VARCHAR(150),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        organization_id UUID NOT NULL,
        CONSTRAINT address_pool_business_logic CHECK (
          (order_id IS NOT NULL AND deposit_reference IS NULL AND state IN ('allocated')) OR
          (order_id IS NULL AND deposit_reference IS NOT NULL AND state IN ('bound')) OR
          (order_id IS NULL AND deposit_reference IS NULL AND state IN ('idle'))
        ),
        CONSTRAINT fk_address_pool_organization FOREIGN KEY (organization_id) REFERENCES ${this.schema}.organizations(id) ON DELETE RESTRICT
      )
    `)

    // Create indexes for address_pool
    await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_order_allocation ON ${this.schema}.address_pool(protocol, state, recycled_at NULLS FIRST, created_at) WHERE order_id IS NULL AND deposit_reference IS NULL`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_deposit_lookup ON ${this.schema}.address_pool(deposit_reference, protocol) WHERE deposit_reference IS NOT NULL`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_order_lookup ON ${this.schema}.address_pool(order_id) WHERE order_id IS NOT NULL`)

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.orders (
        id VARCHAR(255) PRIMARY KEY,
        order_reference VARCHAR(255) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        token VARCHAR(10) NOT NULL,
        chain VARCHAR(50) NOT NULL,
        address VARCHAR(255) NOT NULL,
        required_confirmations INTEGER NOT NULL DEFAULT 3,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'expired', 'completed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payment_window_ends_at TIMESTAMPTZ NOT NULL,
        grace_period_ends_at TIMESTAMPTZ NOT NULL,
        payment_window_minutes INTEGER DEFAULT 10,
        grace_period_minutes INTEGER DEFAULT 5,
        first_transfer_detected_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        confirmed_received DECIMAL(20,6) DEFAULT 0.000000,
        metadata JSONB,
        success_url TEXT,
        cancel_url TEXT,
        organization_id UUID NOT NULL,
        CONSTRAINT fk_orders_organization FOREIGN KEY (organization_id) REFERENCES ${this.schema}.organizations(id) ON DELETE RESTRICT
      )
    `)

    // Create indexes for orders
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON ${this.schema}.orders(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_reference ON ${this.schema}.orders(order_reference)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_address ON ${this.schema}.orders(address)`)

    // Create transfers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.transfers (
        id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255),
        deposit_reference VARCHAR(255),
        business_type VARCHAR(50) DEFAULT 'deposit' CHECK (business_type IN ('order', 'deposit')),
        transaction_hash VARCHAR(255) NOT NULL,
        block_number BIGINT NOT NULL,
        event_index INTEGER DEFAULT 0,
        chain VARCHAR(50) NOT NULL,
        token VARCHAR(10) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        from_address VARCHAR(255) NOT NULL,
        to_address VARCHAR(255) NOT NULL,
        last_checked_confirmations INTEGER DEFAULT 0,
        required_confirmations INTEGER NOT NULL,
        is_confirmed BOOLEAN DEFAULT FALSE,
        is_failed BOOLEAN DEFAULT FALSE,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        last_error TEXT,
        organization_id UUID NOT NULL,
        CONSTRAINT transfers_business_logic CHECK (
          (business_type = 'order' AND order_id IS NOT NULL AND deposit_reference IS NULL) OR
          (business_type = 'deposit' AND deposit_reference IS NOT NULL AND order_id IS NULL)
        ),
        UNIQUE(transaction_hash, event_index),
        CONSTRAINT fk_transfers_organization FOREIGN KEY (organization_id) REFERENCES ${this.schema}.organizations(id) ON DELETE RESTRICT
      )
    `)

    // Create indexes for transfers
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_order_id ON ${this.schema}.transfers(order_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_deposit_reference ON ${this.schema}.transfers(deposit_reference)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_hash ON ${this.schema}.transfers(transaction_hash)`)

    // Create chain_blocks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.chain_blocks (
        chain VARCHAR(50) PRIMARY KEY,
        latest_block_number BIGINT NOT NULL,
        latest_processed_block BIGINT NOT NULL,
        sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'syncing', 'behind')),
        is_healthy BOOLEAN NOT NULL DEFAULT true,
        last_update_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_block_time TIMESTAMPTZ,
        avg_block_time_seconds INTEGER,
        behind_blocks INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Create address_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schema}.address_logs (
        id SERIAL PRIMARY KEY,
        address VARCHAR(255) NOT NULL,
        order_id VARCHAR(255),
        deposit_reference VARCHAR(255),
        action VARCHAR(20) NOT NULL CHECK (action IN ('bind', 'unbind', 'allocate', 'release')),
        business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('order', 'deposit')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_address_logs_order_id FOREIGN KEY (order_id) REFERENCES ${this.schema}.orders(id) ON DELETE CASCADE
      )
    `)
  }

  /**
   * Clean schema data
   *
   * Truncates all tables in the test schema
   */
  async cleanSchema(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(`SET search_path TO ${this.schema}`)

      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica')

      try {
        // Clean tables in dependency order (reversed)
        const tables = [
          'address_logs',
          'transfers',
          'orders',
          'address_pool',
          'chain_blocks',
          'organizations'
        ]

        for (const table of tables) {
          await client.query(`TRUNCATE TABLE ${this.schema}.${table} CASCADE`)
        }
      } finally {
        // Re-enable foreign key checks
        await client.query('SET session_replication_role = origin')
      }
    } finally {
      client.release()
    }
  }

  /**
   * Drop test schema
   *
   * Drops the entire test schema and all its tables
   * WARNING: Cannot drop 'public' schema (protected)
   */
  async dropSchema(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`)
    } finally {
      client.release()
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end()
  }

  /**
   * Get schema name
   */
  getSchema(): string {
    return this.schema
  }

  /**
   * Execute SQL in schema context
   */
  async execute(sql: string, params: any[] = []): Promise<any> {
    const client = await this.pool.connect()
    try {
      if (this.schema !== 'public') {
        await client.query(`SET search_path TO ${this.schema}`)
      }
      return await client.query(sql, params)
    } finally {
      client.release()
    }
  }

  /**
   * Query SQL in schema context
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    const result = await this.execute(sql, params)
    return result.rows
  }

  /**
   * Create test organization
   *
   * Helper method to create a test organization in the schema
   */
  async createTestOrganization(orgId: string, name: string = 'Test Organization', slug: string = 'test-org'): Promise<void> {
    await this.execute(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [orgId, name, slug]
    )
  }

  /**
   * Create a unique test schema name
   *
   * Generates schema name based on test identifier
   */
  static generateSchemaName(testName?: string): string {
    const timestamp = Date.now()
    const suffix = testName ? `_${testName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : ''
    return `test_${timestamp}${suffix}`
  }
}
