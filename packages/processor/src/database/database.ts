/**
 * PostgreSQL数据库实现
 * 实现 PaymentDatabase 接口，支持与 Core 模块的 PostgreSQL 数据源集成
 */

import { Pool, PoolClient } from 'pg';
import { createLogger, LogCategory } from '@payin/shared';
import { ChainBlocksRepository } from '../repositories/chain-blocks.repository.js';

// These types were previously in a deleted file and are now defined here for clarity.
export interface AddressPoolEntry {
  address: string;
  derivationIndex?: number | null; // Optional for self-managed mode
  protocol: 'evm' | 'tron' | 'solana';
  state?: 'available' | 'allocated' | 'bound' | 'archived';
  orderId?: string;
  depositReference?: string;
  allocatedAt?: Date;
  recycledAt?: Date;
  cooldownUntil?: Date;
  masterPublicKey?: string | null; // Optional for self-managed mode
  createdAt?: Date;
}

export interface DatabaseTransaction {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number }>;
}

// PostgreSQL 配置接口
export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxConnections?: number;
  ssl?: boolean | object;
  schema?: string; // Database schema to use (default: 'public')
}

// PostgreSQL 事务实现
class PostgreSQLTransaction implements DatabaseTransaction {
  constructor(private client: PoolClient) {}

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number }> {
    const result = await this.client.query(sql, params);
    return {
      affectedRows: result.rowCount || 0,
      insertId: result.rows[0]?.id
    };
  }
}

export class PostgreSQLDatabase {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private pool: Pool | null = null;
  private connectionString?: string;
  private config?: PostgreSQLConfig;
  private schema: string = 'public'; // Default schema
  private isInitialized = false;

  // Connection pool optimization
  private readonly DEFAULT_POOL_SIZE = 10;
  private readonly MAX_POOL_SIZE = 20;
  private readonly CONNECTION_TIMEOUT_MS = 5000;
  private readonly IDLE_TIMEOUT_MS = 30000;
  private readonly STATEMENT_TIMEOUT_MS = 30000;

  // Address pool configuration
  private cooldownMinutes: number = 30;

  constructor(configOrConnectionString: PostgreSQLConfig | string, schema?: string) {
    if (typeof configOrConnectionString === 'string') {
      this.connectionString = configOrConnectionString;
      this.schema = schema || 'public';
    } else {
      this.config = configOrConnectionString;
      this.schema = configOrConnectionString.schema || 'public';
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 创建优化的 PostgreSQL 连接池
      const poolConfig = {
        max: this.MAX_POOL_SIZE,
        min: 2, // 保持最小连接数
        idleTimeoutMillis: this.IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: this.CONNECTION_TIMEOUT_MS,
        statement_timeout: this.STATEMENT_TIMEOUT_MS,
        query_timeout: this.STATEMENT_TIMEOUT_MS,
        allowExitOnIdle: true // 优雅关闭
      };
      
      if (this.connectionString) {
        this.pool = new Pool({
          connectionString: this.connectionString,
          ssl: false,
          ...poolConfig
        });
      } else if (this.config) {
        this.pool = new Pool({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.username,
          password: this.config.password,
          ssl: this.config.ssl || false,
          ...poolConfig
        });
      } else {
        throw new Error('Database configuration or connection string required');
      }

      // 测试连接
      const client = await this.pool.connect();
      client.release();

      // 根据环境变量跳过数据库初始化
      if (process.env.SKIP_INIT_DB === 'true') {
        this.logger.info('SKIP_INIT_DB is true, skipping database table creation and migration.');
      } else {
        // 创建必要的表结构
        await this.createTables();
      }
      
      this.isInitialized = true;
      const dbInfo = this.connectionString ? 'connection string' : `${this.config!.host}:${this.config!.port}/${this.config!.database}`;
      this.logger.info('PostgreSQL database initialized for Payment module', {
        dbInfo,
        poolConfig: {
          min: poolConfig.min,
          max: poolConfig.max,
          idleTimeout: poolConfig.idleTimeoutMillis
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL database', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.isInitialized = false;
  }

  /**
   * Get database pool health status
   */
  getPoolStatus(): any {
    if (!this.pool) return { status: 'disconnected', totalCount: 0, idleCount: 0, waitingCount: 0 };
    
    return {
      status: 'connected',
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.MAX_POOL_SIZE
    };
  }

  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    const client = await this.pool.connect();
    try {
      // Set search path to the configured schema
      await client.query(`SET search_path TO ${this.schema}`);

      // Check if required tables exist in the configured schema
      const result = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name IN ('organizations', 'orders', 'transfers', 'address_pool', 'address_logs')
      `, [this.schema]);

      const existingTables = result.rows.map(row => row.table_name);
      const requiredTables = ['organizations', 'orders', 'transfers', 'address_pool', 'address_logs'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        this.logger.warn('PostgreSQL tables missing, creating tables', {
          schema: this.schema,
          missingTables: missingTables.join(', ')
        });
        await this.createMissingTables(client, missingTables);
      }

      // 升级现有表（无论是否刚创建）
      this.logger.info('Upgrading existing PostgreSQL tables', { schema: this.schema });
      await this.upgradeExistingTables(client, existingTables);

      this.logger.info('PostgreSQL database tables verified', { schema: this.schema });

    } finally {
      client.release();
    }
  }

  private async upgradeExistingTables(client: any, existingTables: string[]): Promise<void> {
    // 检查是否需要从旧表迁移到统一的address_pool表
    const needsMigration = existingTables.includes('order_address_pool') || existingTables.includes('deposit_address_pool');

    if (needsMigration && !existingTables.includes('address_pool')) {
      this.logger.info('Migrating legacy address pool tables to unified address_pool');

      try {
        // 创建临时统一表（使用新的schema定义）
        await client.query(`
          CREATE TABLE address_pool_temp (
            address VARCHAR(255) PRIMARY KEY,
            derivation_index INTEGER,
            protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('evm', 'tron', 'solana')),
            state VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'allocated', 'bound', 'archived')),
            order_id VARCHAR(255),
            deposit_reference VARCHAR(255),
            allocated_at TIMESTAMPTZ,
            recycled_at TIMESTAMPTZ,
            cooldown_until TIMESTAMPTZ,
            master_public_key VARCHAR(150),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT address_pool_business_logic CHECK (
              (order_id IS NOT NULL AND deposit_reference IS NULL AND state IN ('allocated')) OR
              (order_id IS NULL AND deposit_reference IS NOT NULL AND state IN ('bound')) OR
              (order_id IS NULL AND deposit_reference IS NULL AND state IN ('idle', 'archived'))
            )
          )
        `);

        // 从order_address_pool迁移数据
        if (existingTables.includes('order_address_pool')) {
          this.logger.debug('Migrating order_address_pool data');
          await client.query(`
            INSERT INTO address_pool_temp (
              address, derivation_index, protocol, state,
              order_id, allocated_at, master_public_key, created_at
            )
            SELECT
              address, derivation_index, COALESCE(chain_family, protocol, 'evm') as protocol,
              CASE WHEN state = 'allocated' THEN 'allocated' ELSE 'available' END as state,
              CASE WHEN state = 'allocated' THEN 'MIGRATION_ORDER' ELSE NULL END as order_id,
              CASE WHEN state = 'allocated' THEN NOW() ELSE NULL END as allocated_at,
              master_public_key,
              created_at
            FROM order_address_pool
          `);
        }

        // 从deposit_address_pool迁移数据
        if (existingTables.includes('deposit_address_pool')) {
          this.logger.debug('Migrating deposit_address_pool data');
          await client.query(`
            INSERT INTO address_pool_temp (
              address, derivation_index, protocol, state,
              deposit_reference, allocated_at, master_public_key, created_at
            )
            SELECT
              address,
              COALESCE(derivation_index, 0) as derivation_index,
              COALESCE(chain_family, protocol, 'evm') as protocol,
              CASE WHEN deposit_reference IS NOT NULL THEN 'bound' ELSE 'available' END as state,
              NULL as order_id,
              deposit_reference,
              CASE WHEN deposit_reference IS NOT NULL THEN NOW() ELSE NULL END as allocated_at,
              master_public_key,
              created_at
            FROM deposit_address_pool
            ON CONFLICT (address) DO NOTHING
          `);
        }

        // 重命名表
        await client.query(`ALTER TABLE address_pool_temp RENAME TO address_pool`);

        // 创建索引
        await client.query(`CREATE INDEX idx_address_pool_order_allocation ON address_pool(protocol, state, recycled_at NULLS FIRST, created_at) WHERE order_id IS NULL AND deposit_reference IS NULL`);
        await client.query(`CREATE INDEX idx_address_pool_deposit_lookup ON address_pool(deposit_reference, protocol) WHERE deposit_reference IS NOT NULL`);
        await client.query(`CREATE INDEX idx_address_pool_order_lookup ON address_pool(order_id) WHERE order_id IS NOT NULL`);
        await client.query(`CREATE INDEX idx_address_pool_cooldown ON address_pool(protocol, cooldown_until) WHERE cooldown_until IS NOT NULL`);

        // 创建复合唯一索引（仅对非NULL的HD字段生效）
        await client.query(`CREATE UNIQUE INDEX address_pool_hd_unique ON address_pool(derivation_index, master_public_key, protocol) WHERE derivation_index IS NOT NULL AND master_public_key IS NOT NULL`);

        // 删除旧表
        if (existingTables.includes('order_address_pool')) {
          await client.query(`DROP TABLE order_address_pool`);
          this.logger.debug('Dropped order_address_pool table');
        }
        if (existingTables.includes('deposit_address_pool')) {
          await client.query(`DROP TABLE deposit_address_pool`);
          this.logger.debug('Dropped deposit_address_pool table');
        }

        this.logger.info('Successfully migrated to unified address_pool table');
      } catch (error) {
        this.logger.error('Migration error', { error: error.message });
        throw error;
      }
    }

    // 升级address_pool表 - HD钱包支持和字段重命名
    if (existingTables.includes('address_pool')) {
      this.logger.debug('Upgrading address_pool table schema - HD wallet support and field renaming');
      try {
        // 1. 重命名字段（external_id -> deposit_reference）
        const hasExternalId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'address_pool' AND column_name = 'external_id'
        `);
        if (hasExternalId.rows.length > 0) {
          await client.query(`ALTER TABLE address_pool RENAME COLUMN external_id TO deposit_reference`);
          this.logger.debug('Renamed external_id to deposit_reference in address_pool');
        }

        // 2. 扩展master_public_key字段长度以支持xpub (111字符)
        await client.query(`ALTER TABLE address_pool ALTER COLUMN master_public_key TYPE VARCHAR(150)`);
        this.logger.debug('Extended master_public_key to VARCHAR(150)');

        // 3. 允许derivation_index为NULL以支持自管理模式
        await client.query(`ALTER TABLE address_pool ALTER COLUMN derivation_index DROP NOT NULL`);
        this.logger.debug('Made derivation_index nullable');

        // 4. 删除旧的derivation_index唯一约束
        await client.query(`ALTER TABLE address_pool DROP CONSTRAINT IF EXISTS address_pool_derivation_index_key`);
        this.logger.debug('Dropped old derivation_index unique constraint');

        // 5. 移除旧的HD钱包一致性约束（如果存在）
        await client.query(`
          ALTER TABLE address_pool DROP CONSTRAINT IF EXISTS address_pool_hd_consistency
        `);
        this.logger.debug('Removed old HD wallet consistency constraint');

        // 6. 创建复合唯一索引（仅对非NULL的HD字段生效）
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS address_pool_hd_unique
          ON address_pool(derivation_index, master_public_key, protocol)
          WHERE derivation_index IS NOT NULL AND master_public_key IS NOT NULL
        `);
        this.logger.debug('Created composite unique index for HD wallet mode');

        // 7. Multi-tenant support - Add organization_id field if missing
        const hasOrgId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'address_pool' AND column_name = 'organization_id'
        `);
        if (hasOrgId.rows.length === 0) {
          this.logger.debug('Adding organization_id to address_pool table');
          // Note: This requires organizations table to exist first
          // In production, you should populate organization_id before setting NOT NULL
          await client.query(`ALTER TABLE address_pool ADD COLUMN organization_id UUID`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_organization_id ON address_pool(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_protocol ON address_pool(organization_id, protocol)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_state ON address_pool(organization_id, protocol, state, recycled_at NULLS FIRST)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_idle_lru ON address_pool(organization_id, state, recycled_at NULLS FIRST) WHERE state = 'idle'`);
          // Add foreign key constraint
          await client.query(`ALTER TABLE address_pool ADD CONSTRAINT fk_address_pool_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`);
          this.logger.debug('Added organization_id to address_pool table with indexes and constraints');
        }

        this.logger.debug('Upgraded address_pool table schema for HD wallet support');
      } catch (error) {
        this.logger.warn('Address pool table upgrade warning', { error: error.message });
      }
    }

    // 升级address_logs表 - 字段重命名和新增
    if (existingTables.includes('address_logs')) {
      this.logger.debug('Upgrading address_logs table schema - field updates');
      try {
        // 重命名 external_id 到 deposit_reference
        const hasExternalId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'address_logs' AND column_name = 'external_id'
        `);
        if (hasExternalId.rows.length > 0) {
          await client.query(`ALTER TABLE address_logs RENAME COLUMN external_id TO deposit_reference`);
          this.logger.debug('Renamed external_id to deposit_reference in address_logs');
        }

        // 添加 order_id 字段
        await client.query(`ALTER TABLE address_logs ADD COLUMN IF NOT EXISTS order_id VARCHAR(255)`);

        // 创建新索引
        await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_deposit_reference_time ON address_logs(deposit_reference, created_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_order_id_time ON address_logs(order_id, created_at)`);

        // 添加外键约束 (先检查是否存在)
        const constraintExists = await client.query(`
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'address_logs' AND constraint_name = 'fk_address_logs_order_id'
        `);

        if (constraintExists.rows.length === 0) {
          await client.query(`
            ALTER TABLE address_logs
            ADD CONSTRAINT fk_address_logs_order_id
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
          `);
        }

        // Update CHECK constraints to support archive/unarchive actions and system business type
        try {
          // Drop old CHECK constraints if they exist
          await client.query(`
            ALTER TABLE address_logs
            DROP CONSTRAINT IF EXISTS address_logs_action_check
          `);
          await client.query(`
            ALTER TABLE address_logs
            DROP CONSTRAINT IF EXISTS address_logs_business_type_check
          `);

          // Add updated CHECK constraints
          await client.query(`
            ALTER TABLE address_logs
            ADD CONSTRAINT address_logs_action_check
            CHECK (action IN ('bind', 'unbind', 'allocate', 'release', 'archive', 'unarchive'))
          `);
          await client.query(`
            ALTER TABLE address_logs
            ADD CONSTRAINT address_logs_business_type_check
            CHECK (business_type IN ('order', 'deposit', 'system'))
          `);

          this.logger.debug('Updated address_logs CHECK constraints to support archive operations');
        } catch (error) {
          this.logger.warn('Failed to update address_logs CHECK constraints', { error: error.message });
        }

        this.logger.debug('Upgraded address_logs table schema with foreign key constraint');
      } catch (error) {
        this.logger.warn('Address logs table upgrade warning', { error: error.message });
      }
    }

    // 删除冗余的deposit_bindings表
    if (existingTables.includes('deposit_bindings')) {
      this.logger.debug('Removing redundant deposit_bindings table');
      try {
        await client.query(`DROP TABLE IF EXISTS deposit_bindings CASCADE`);
        this.logger.debug('Removed deposit_bindings table - schema simplified');
      } catch (error) {
        this.logger.warn('Deposit bindings removal warning', { error: error.message });
      }
    }

    // 升级orders表 - 重大架构变更
    if (existingTables.includes('orders')) {
      this.logger.debug('Upgrading orders table schema - major restructure');
      try {
        // 1. 重命名字段（external_id -> order_reference）
        const hasExternalId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'external_id'
        `);
        if (hasExternalId.rows.length > 0) {
          await client.query(`ALTER TABLE orders RENAME COLUMN external_id TO order_reference`);
          this.logger.debug('Renamed external_id to order_reference');
        }

        // 2. 添加新的时间字段
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_window_ends_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_transfer_detected_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS required_confirmations INTEGER DEFAULT 3`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_received DECIMAL(20,6) DEFAULT 0.000000`);
        
        // 2. 计算新时间字段的值（如果为空）
        await client.query(`
          UPDATE orders
          SET payment_window_ends_at = created_at + (payment_window_minutes || ' minutes')::INTERVAL
          WHERE payment_window_ends_at IS NULL
        `);
        await client.query(`
          UPDATE orders
          SET grace_period_ends_at = created_at + ((payment_window_minutes + grace_period_minutes) || ' minutes')::INTERVAL
          WHERE grace_period_ends_at IS NULL
        `);
        
        // 3. 设置时间字段为NOT NULL（在填充数据后）
        await client.query(`ALTER TABLE orders ALTER COLUMN payment_window_ends_at SET NOT NULL`);
        await client.query(`ALTER TABLE orders ALTER COLUMN grace_period_ends_at SET NOT NULL`);
        
        // 4. 简化状态值（将复杂状态映射到简化状态）
        await client.query(`
          UPDATE orders 
          SET status = CASE 
            WHEN status IN ('completed') THEN 'completed'
            WHEN status IN ('expired', 'payment_window_expired', 'grace_period_expired', 'cancelled', 'failed') THEN 'expired'
            ELSE 'pending'
          END
        `);
        
        // 5. 更新状态约束（删除旧约束并添加新约束）
        await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check`);
        await client.query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'expired', 'completed'))`);
        
        // 6. 创建新索引
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_reference ON orders(order_reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_payment_window ON orders(payment_window_ends_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_grace_period ON orders(grace_period_ends_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_timeout_status ON orders(status, payment_window_ends_at, grace_period_ends_at)`);
        
        // 7. 添加 redirect URL 字段
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS success_url TEXT`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_url TEXT`);
        this.logger.debug('Added redirect URL fields to orders table');

        // 8. 删除不再需要的字段
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS description`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS expires_at`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS partial_payment_detected_at`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS required_amount`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS received_amount`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS paid_at`);
        await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS confirmed_at`);

        // 9. Multi-tenant support - Add organization_id field if missing
        const hasOrgId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'organization_id'
        `);
        if (hasOrgId.rows.length === 0) {
          this.logger.debug('Adding organization_id to orders table');
          // Note: This requires organizations table to exist first
          // In production, you should populate organization_id before setting NOT NULL
          await client.query(`ALTER TABLE orders ADD COLUMN organization_id UUID`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_reference ON orders(organization_id, order_reference)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at DESC)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_chain ON orders(organization_id, chain)`);
          // Add foreign key constraint
          await client.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`);
          this.logger.debug('Added organization_id to orders table with indexes and constraints');
        }

        this.logger.debug('Upgraded orders table schema - major restructure completed');
      } catch (error) {
        this.logger.warn('Orders table upgrade warning', { error: error.message });
      }
    }

    // 升级transfers表 - 添加deposit_reference字段以支持充值业务
    if (existingTables.includes('transfers')) {
      this.logger.debug('Upgrading transfers table schema - adding deposit_reference field');
      try {
        // 1. 添加deposit_reference字段
        await client.query(`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS deposit_reference VARCHAR(255)`);

        // 2. 修改原有的business_type约束
        await client.query(`ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_business_type_check`);
        await client.query(`ALTER TABLE transfers ADD CONSTRAINT transfers_business_type_check CHECK (business_type IN ('order', 'deposit'))`);

        // 3. 添加业务约束确保数据完整性
        await client.query(`ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_business_logic`);
        await client.query(`
          ALTER TABLE transfers ADD CONSTRAINT transfers_business_logic CHECK (
            (business_type = 'order' AND order_id IS NOT NULL AND deposit_reference IS NULL) OR
            (business_type = 'deposit' AND deposit_reference IS NOT NULL AND order_id IS NULL)
          )
        `);

        // 4. 创建新索引
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_deposit_reference ON transfers(deposit_reference)`);

        // 5. 删除旧的deposit_external_id字段（如果存在）
        await client.query(`ALTER TABLE transfers DROP COLUMN IF EXISTS deposit_external_id`);

        // 6. Multi-tenant support - Add organization_id field if missing
        const hasOrgId = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'transfers' AND column_name = 'organization_id'
        `);
        if (hasOrgId.rows.length === 0) {
          this.logger.debug('Adding organization_id to transfers table');
          // Note: This requires organizations table to exist first
          // In production, you should populate organization_id before setting NOT NULL
          await client.query(`ALTER TABLE transfers ADD COLUMN organization_id UUID`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_organization_id ON transfers(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_business_type ON transfers(organization_id, business_type)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_confirmed ON transfers(organization_id, is_confirmed)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_order ON transfers(organization_id, order_id) WHERE order_id IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_deposit ON transfers(organization_id, deposit_reference) WHERE deposit_reference IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_business ON transfers(organization_id, business_type)`);
          // Add foreign key constraint
          await client.query(`ALTER TABLE transfers ADD CONSTRAINT fk_transfers_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT`);
          this.logger.debug('Added organization_id to transfers table with indexes and constraints');
        }

        this.logger.debug('Upgraded transfers table schema - deposit_reference support added, old fields cleaned up');
      } catch (error) {
        this.logger.warn('Transfers table upgrade warning', { error: error.message });
      }
    }

    // deposits表功能已移至transfers表 - 如果存在旧表则删除
    if (existingTables.includes('deposits')) {
      this.logger.debug('Removing deprecated deposits table - functionality moved to transfers table');
      try {
        await client.query(`DROP TABLE IF EXISTS deposits CASCADE`);
        this.logger.debug('Removed deprecated deposits table');
      } catch (error) {
        this.logger.warn('Deposits table removal warning', { error: error.message });
      }
    }

    // 升级所有时间列为 timestamptz（时区敏感类型）
    this.logger.debug('Upgrading timestamp columns to timestamptz');
    try {
      // Helper function to check and convert timestamp columns
      const convertToTimestamptz = async (table: string, column: string) => {
        const typeCheck = await client.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);

        if (typeCheck.rows.length > 0 && typeCheck.rows[0].data_type === 'timestamp without time zone') {
          await client.query(`
            ALTER TABLE ${table}
            ALTER COLUMN ${column} TYPE timestamptz
            USING ${column} AT TIME ZONE 'UTC'
          `);
          this.logger.debug(`Converted ${table}.${column} to timestamptz`);
        }
      };

      // Convert transfers table
      if (existingTables.includes('transfers')) {
        await convertToTimestamptz('transfers', 'detected_at');
        await convertToTimestamptz('transfers', 'confirmed_at');
      }

      // Convert orders table
      if (existingTables.includes('orders')) {
        await convertToTimestamptz('orders', 'created_at');
        await convertToTimestamptz('orders', 'payment_window_ends_at');
        await convertToTimestamptz('orders', 'grace_period_ends_at');
        await convertToTimestamptz('orders', 'first_transfer_detected_at');
        await convertToTimestamptz('orders', 'completed_at');
        await convertToTimestamptz('orders', 'updated_at');
      }

      // Convert address_pool table
      if (existingTables.includes('address_pool')) {
        await convertToTimestamptz('address_pool', 'allocated_at');
        await convertToTimestamptz('address_pool', 'recycled_at');
        await convertToTimestamptz('address_pool', 'cooldown_until');
        await convertToTimestamptz('address_pool', 'created_at');
      }

      // Convert address_logs table
      if (existingTables.includes('address_logs')) {
        await convertToTimestamptz('address_logs', 'created_at');
      }

      // Convert chain_blocks table
      if (existingTables.includes('chain_blocks')) {
        await convertToTimestamptz('chain_blocks', 'last_update_time');
        await convertToTimestamptz('chain_blocks', 'last_block_time');
        await convertToTimestamptz('chain_blocks', 'created_at');
        await convertToTimestamptz('chain_blocks', 'updated_at');
      }

      this.logger.debug('Timestamp to timestamptz conversion completed');
    } catch (error) {
      this.logger.warn('Timestamp conversion warning', { error: error.message });
    }
  }

  private async createMissingTables(client: any, missingTables: string[]): Promise<void> {
    // Create tables in dependency order - organizations must be created first
    const tableOrder = ['organizations', 'address_pool', 'orders', 'transfers', 'address_logs', 'chain_blocks'];

    for (const tableName of tableOrder) {
      if (!missingTables.includes(tableName)) continue;

      switch (tableName) {
        case 'organizations':
          await client.query(`
            CREATE TABLE IF NOT EXISTS organizations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(255) NOT NULL,
              slug VARCHAR(100) NOT NULL UNIQUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `);
          this.logger.debug('Organizations table created');
          break;

        case 'address_pool':
          await client.query(`
            CREATE TABLE IF NOT EXISTS address_pool (
              address VARCHAR(255) PRIMARY KEY,
              derivation_index INTEGER,
              protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('evm', 'tron', 'solana')),
              state VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'allocated', 'bound', 'archived')),
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
                (order_id IS NULL AND deposit_reference IS NULL AND state IN ('idle', 'archived'))
              ),
              CONSTRAINT fk_address_pool_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
            )
          `);

          // 创建优化索引
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_order_allocation ON address_pool(protocol, state, recycled_at NULLS FIRST, created_at) WHERE order_id IS NULL AND deposit_reference IS NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_deposit_lookup ON address_pool(deposit_reference, protocol) WHERE deposit_reference IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_order_lookup ON address_pool(order_id) WHERE order_id IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_cooldown ON address_pool(protocol, cooldown_until) WHERE cooldown_until IS NOT NULL`);

          // 创建复合唯一索引（仅对非NULL的HD字段生效）
          await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS address_pool_hd_unique ON address_pool(derivation_index, master_public_key, protocol) WHERE derivation_index IS NOT NULL AND master_public_key IS NOT NULL`);

          // Multi-tenant isolation indexes
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_organization_id ON address_pool(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_protocol ON address_pool(organization_id, protocol)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_state ON address_pool(organization_id, protocol, state, recycled_at NULLS FIRST)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_pool_org_idle_lru ON address_pool(organization_id, state, recycled_at NULLS FIRST) WHERE state = 'idle'`);
          break;
          
        case 'orders':
          await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
              /* ===== 核心字段 ===== */
              id VARCHAR(255) PRIMARY KEY,
              order_reference VARCHAR(255) NOT NULL,

              /* ===== 订单信息 ===== */
              amount DECIMAL(20,6) NOT NULL,
              token VARCHAR(10) NOT NULL,
              chain VARCHAR(50) NOT NULL,
              address VARCHAR(255) NOT NULL,
              required_confirmations INTEGER NOT NULL DEFAULT 3,

              /* ===== 简化状态 ===== */
              status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'expired', 'completed')),

              /* ===== 时间设计 ===== */
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              payment_window_ends_at TIMESTAMPTZ NOT NULL,
              grace_period_ends_at TIMESTAMPTZ NOT NULL,
              payment_window_minutes INTEGER DEFAULT 10,
              grace_period_minutes INTEGER DEFAULT 5,

              /* ===== 其他时间 ===== */
              first_transfer_detected_at TIMESTAMPTZ,
              completed_at TIMESTAMPTZ,
              updated_at TIMESTAMPTZ DEFAULT NOW(),

              /* ===== 性能优化字段 ===== */
              confirmed_received DECIMAL(20,6) DEFAULT 0.000000,

              /* ===== 扩展字段 ===== */
              metadata JSONB,

              /* ===== Redirect URL 字段 ===== */
              success_url TEXT,
              cancel_url TEXT,

              /* ===== Multi-tenant isolation ===== */
              organization_id UUID NOT NULL,

              /* ===== Foreign key constraints ===== */
              CONSTRAINT fk_orders_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
            )
          `);

          /* 创建优化的索引 */
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_order_reference ON orders(order_reference)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_address ON orders(address)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_payment_window ON orders(payment_window_ends_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_grace_period ON orders(grace_period_ends_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_timeout_status ON orders(status, payment_window_ends_at, grace_period_ends_at)`);

          /* Multi-tenant isolation indexes */
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_reference ON orders(organization_id, order_reference)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, status)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at DESC)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_org_chain ON orders(organization_id, chain)`);

          // 表已包含所有必需字段，跳过升级
          this.logger.debug('Orders table created with all required fields');
          break;
          
        case 'transfers':
          await client.query(`
            CREATE TABLE IF NOT EXISTS transfers (
              /* ===== 核心字段 ===== */
              id VARCHAR(255) PRIMARY KEY,
              order_id VARCHAR(255), /* 订单支付时使用，充值时为空 */
              deposit_reference VARCHAR(255), /* 充值时使用，订单支付时为空 */
              business_type VARCHAR(50) DEFAULT 'deposit' CHECK (business_type IN ('order', 'deposit')),

              /* ===== 区块链信息 ===== */
              transaction_hash VARCHAR(255) NOT NULL,
              block_number BIGINT NOT NULL,
              event_index INTEGER DEFAULT 0,
              chain VARCHAR(50) NOT NULL,
              token VARCHAR(10) NOT NULL,

              /* ===== 转账信息 ===== */
              amount DECIMAL(20,6) NOT NULL,
              from_address VARCHAR(255) NOT NULL,
              to_address VARCHAR(255) NOT NULL,

              /* ===== 确认状态 ===== */
              last_checked_confirmations INTEGER DEFAULT 0,
              required_confirmations INTEGER NOT NULL,
              is_confirmed BOOLEAN DEFAULT FALSE,
              is_failed BOOLEAN DEFAULT FALSE,

              /* ===== 时间字段 ===== */
              detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              confirmed_at TIMESTAMPTZ,

              /* ===== 错误处理 ===== */
              last_error TEXT,

              /* ===== Multi-tenant isolation ===== */
              organization_id UUID NOT NULL,

              /* ===== 业务约束 ===== */
              /* 确保根据业务类型有适当的标识符 */
              CONSTRAINT transfers_business_logic CHECK (
                (business_type = 'order' AND order_id IS NOT NULL AND deposit_reference IS NULL) OR
                (business_type = 'deposit' AND deposit_reference IS NOT NULL AND order_id IS NULL)
              ),
              /* 事务唯一性约束 */
              UNIQUE(transaction_hash, event_index),

              /* ===== Foreign key constraints ===== */
              CONSTRAINT fk_transfers_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
            )
          `);

          /* 创建transfers表索引 */
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_order_id ON transfers(order_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_deposit_reference ON transfers(deposit_reference)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_business_type ON transfers(business_type)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_confirmation ON transfers(order_id, is_confirmed)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_hash ON transfers(transaction_hash)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_block ON transfers(chain, block_number)`);

          /* Multi-tenant isolation indexes */
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_organization_id ON transfers(organization_id)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_business_type ON transfers(organization_id, business_type)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_confirmed ON transfers(organization_id, is_confirmed)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_order ON transfers(organization_id, order_id) WHERE order_id IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_deposit ON transfers(organization_id, deposit_reference) WHERE deposit_reference IS NOT NULL`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_org_business ON transfers(organization_id, business_type)`);

          this.logger.debug('Transfers table created with all required fields');
          break;
          
        // Legacy tables removed - functionality moved to unified address_pool
          
        // deposit_bindings table removed - functionality moved to deposit_address_pool
          
        case 'deposits':
          // deposits table removed - functionality moved to transfers table with business_type='deposit'
          this.logger.debug('Skipping deposits table creation - functionality moved to transfers table');
          break;

        case 'address_logs':
          await client.query(`
            CREATE TABLE IF NOT EXISTS address_logs (
              id SERIAL PRIMARY KEY,
              address VARCHAR(255) NOT NULL,
              order_id VARCHAR(255),                    /* Order业务时使用 */
              deposit_reference VARCHAR(255),          /* Deposit业务时使用 */
              action VARCHAR(20) NOT NULL CHECK (action IN ('bind', 'unbind', 'allocate', 'release', 'archive', 'unarchive')),
              business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('order', 'deposit', 'system')),
              created_at TIMESTAMPTZ DEFAULT NOW(),
              CONSTRAINT fk_address_logs_order_id
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
          `);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_action ON address_logs(action, created_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_address_time ON address_logs(address, created_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_business_type_time ON address_logs(business_type, created_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_deposit_reference_time ON address_logs(deposit_reference, created_at)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_address_logs_order_id_time ON address_logs(order_id, created_at)`);
          break;

        case 'chain_blocks':
          await client.query(`
            CREATE TABLE IF NOT EXISTS chain_blocks (
              /* ===== 主键字段 ===== */
              chain VARCHAR(50) PRIMARY KEY,

              /* ===== 区块高度信息 ===== */
              latest_block_number BIGINT NOT NULL,
              latest_processed_block BIGINT NOT NULL,

              /* ===== 状态信息 ===== */
              sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'syncing', 'behind')),
              is_healthy BOOLEAN NOT NULL DEFAULT true,

              /* ===== 时间戳信息 ===== */
              last_update_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_block_time TIMESTAMPTZ,

              /* ===== 性能统计 ===== */
              avg_block_time_seconds INTEGER,
              behind_blocks INTEGER DEFAULT 0,

              /* ===== 审计字段 ===== */
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `);

          // 创建索引
          await client.query(`CREATE INDEX IF NOT EXISTS idx_chain_blocks_update_time ON chain_blocks(last_update_time)`);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_chain_blocks_sync_status ON chain_blocks(sync_status) WHERE sync_status != 'synced'`);

          // 创建更新触发器
          await client.query(`
            CREATE OR REPLACE FUNCTION update_chain_blocks_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
          `);

          await client.query(`DROP TRIGGER IF EXISTS trigger_chain_blocks_updated_at ON chain_blocks`);
          await client.query(`
            CREATE TRIGGER trigger_chain_blocks_updated_at
                BEFORE UPDATE ON chain_blocks
                FOR EACH ROW
                EXECUTE FUNCTION update_chain_blocks_updated_at()
          `);

          break;
      }

      this.logger.debug('Created table', { tableName });
    }
  }

  async transaction<T>(callback: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Database not initialized');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx = new PostgreSQLTransaction(client);
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const startTime = performance.now();
    const client = await this.pool.connect();

    try {
      // Set search path to configured schema
      if (this.schema !== 'public') {
        await client.query(`SET search_path TO ${this.schema}`);
      }

      // Convert SQLite-style boolean comparisons to PostgreSQL
      const pgSql = this.convertSQLiteToPostgreSQL(sql);
      const result = await client.query(pgSql, params);

      // Log slow queries (>1000ms)
      const duration = performance.now() - startTime;
      if (duration > 1000) {
        this.logger.warn('Slow query detected', {
          duration: `${duration.toFixed(2)}ms`,
          query: pgSql.substring(0, 100) + '...'
        });
      }

      return result.rows;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Query failed', {
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  private convertSQLiteToPostgreSQL(sql: string): string {
    let pgSql = sql;
    
    // Convert SQLite boolean comparisons to PostgreSQL
    pgSql = pgSql
      .replace(/is_active\s*=\s*1/gi, 'is_active = TRUE')
      .replace(/is_active\s*=\s*0/gi, 'is_active = FALSE')
      .replace(/is_allocated\s*=\s*1/gi, 'is_allocated = TRUE')
      .replace(/is_allocated\s*=\s*0/gi, 'is_allocated = FALSE');
      
    // Convert SQLite parameter placeholders (?) to PostgreSQL ($1, $2, etc.)
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    return pgSql;
  }

  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number }> {
    if (!this.pool) {
      // Silently ignore database operations after cleanup to prevent errors during shutdown
      this.logger.debug('Database not initialized - ignoring operation during cleanup');
      return { affectedRows: 0 };
    }

    const startTime = performance.now();
    const client = await this.pool.connect();

    try {
      // Set search path to configured schema
      if (this.schema !== 'public') {
        await client.query(`SET search_path TO ${this.schema}`);
      }

      // Convert SQLite-style queries to PostgreSQL
      const pgSql = this.convertSQLiteToPostgreSQL(sql);
      const result = await client.query(pgSql, params);

      // Log slow operations (>1000ms)
      const duration = performance.now() - startTime;
      if (duration > 1000) {
        this.logger.warn('Slow execution detected', {
          duration: `${duration.toFixed(2)}ms`,
          query: pgSql.substring(0, 100) + '...'
        });
      }

      return {
        affectedRows: result.rowCount || 0,
        insertId: result.rows[0]?.id
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error('Execution failed', {
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Address pool methods moved to AddressPoolRepository






  // Deposit-related methods moved to AddressPoolRepository and TransferRepository




  // Order address allocation methods moved to AddressPoolRepository


  // Helper methods moved to respective repositories

  // Mapping methods moved to respective repositories

  /**
   * Get the required tables and their expected schema
   * 获取必需的表及其预期模式 - 作为schema定义的单一数据源
   */
  private getExpectedTables() {
    return {
      'orders': {
        requiredColumns: [
          'id', 'amount', 'token', 'chain', 'address',
          'status', 'created_at', 'expires_at', 'payment_window_minutes',
          'grace_period_minutes', 'required_amount', 'confirmed_received', 'order_reference',
          'updated_at', 'paid_at', 'confirmed_at'
        ],
        requiredIndexes: [
          'idx_orders_status', 'idx_orders_address'
        ]
      },
      'address_pool': {
        requiredColumns: [
          'address', 'derivation_index', 'protocol', 'state',
          'order_id', 'deposit_reference', 'allocated_at', 'recycled_at',
          'cooldown_until', 'master_public_key', 'created_at'
        ],
        requiredIndexes: [
          'idx_address_pool_order_allocation', 'idx_address_pool_deposit_lookup',
          'idx_address_pool_state', 'idx_address_pool_cooldown'
        ]
      },
      'transfers': {
        requiredColumns: [
          'id', 'order_id', 'transaction_hash', 'block_number', 'event_index',
          'from_address', 'to_address', 'amount', 'token', 'chain', 'detected_at',
          'is_confirmed', 'is_failed', 'business_type', 'deposit_reference'
        ],
        requiredIndexes: [
          'idx_transfers_order_id', 'idx_transfers_tx_hash'
        ]
      },
      'address_logs': {
        requiredColumns: [
          'id', 'address', 'deposit_reference', 'order_id', 'action', 'business_type', 'created_at'
        ],
        requiredIndexes: [
          'idx_address_logs_address', 'idx_address_logs_deposit_reference', 'idx_address_logs_order_id', 'idx_address_logs_business_type'
        ]
      },
      'chain_blocks': {
        requiredColumns: [
          'chain', 'latest_block_number', 'latest_processed_block', 'sync_status',
          'is_healthy', 'last_update_time', 'last_block_time', 'avg_block_time_seconds',
          'behind_blocks', 'created_at', 'updated_at'
        ],
        requiredIndexes: [
          'idx_chain_blocks_update_time', 'idx_chain_blocks_sync_status'
        ]
      }
    };
  }

  /**
   * Check database schema completeness
   * Returns information about missing tables and schema status
   */
  async checkDatabaseSchema(): Promise<{
    isComplete: boolean;
    missingTables: string[];
    existingTables: string[];
    requiredTables: string[];
  }> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const expectedTables = this.getExpectedTables();
    const requiredTables = Object.keys(expectedTables);

    // Check which tables exist
    const result = await this.pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (${requiredTables.map((_, i) => `$${i + 1}`).join(', ')})
    `, requiredTables);

    const existingTables = result.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    return {
      isComplete: missingTables.length === 0,
      missingTables,
      existingTables,
      requiredTables
    };
  }

  /**
   * Initialize database schema (structure only, no data)
   *
   * @param options Configuration options
   * @param options.dropExisting - Drop existing tables before creating (default: false)
   * @param options.onlyMissing - Only create missing tables (default: true)
   * @param options.force - Force execution without confirmation (default: false)
   */
  async initializeDatabaseSchema(options: {
    dropExisting?: boolean;      // 是否删除现有表后重建
    onlyMissing?: boolean;       // 只创建缺失的表
    seedData?: boolean;          // 是否填充种子数据（已废弃，保留用于兼容性）
    force?: boolean;             // 强制执行（跳过确认）
  } = {}): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    createdTables: string[];
    upgradedTables: string[];
    seedDataResults: { table: string; inserted: number }[];
    summary: string;
  }> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const {
      dropExisting = false,  // 默认不删除现有表
      onlyMissing = true,
      seedData = false,      // 已废弃，不再使用
      force = false          // 默认需要确认
    } = options;

    // Warn if seedData is requested
    if (seedData) {
      this.logger.warn('seedData option is deprecated and will be ignored. Processor only initializes schema structure.');
    }

    const result = {
      success: true,
      errors: [] as string[],
      warnings: [] as string[],
      createdTables: [] as string[],
      upgradedTables: [] as string[],
      seedDataResults: [] as { table: string; inserted: number }[],
      summary: ''
    };

    const client = await this.pool.connect();
    
    try {
      this.logger.info('Initializing Payment module database schema', {
        dropExisting,
        onlyMissing,
        seedData
      });

      if (dropExisting && !force) {
        result.errors.push('dropExisting=true requires force=true for safety');
        result.success = false;
        return result;
      }

      // Begin transaction for atomic operation
      await client.query('BEGIN');

      try {
        // Get the required tables from centralized definition
        const expectedTables = this.getExpectedTables();
        const requiredTables = Object.keys(expectedTables);
        
        // Reuse existing table checking logic
        const existingTablesResult = await client.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name IN (${requiredTables.map((_, i) => `$${i + 1}`).join(', ')})
        `, requiredTables);
        const existingTables = new Set(existingTablesResult.rows.map(row => row.table_name));
        const missingTables = requiredTables.filter(table => !existingTables.has(table));

        // Drop existing tables if requested
        if (dropExisting) {
          this.logger.debug('Dropping existing tables');
          // Use reverse dependency order for safe dropping
          const dropOrder = ['deposits', 'transfers', 'orders', 'address_logs', 'deposit_address_pool', 'order_address_pool', 'address_pool', 'chain_blocks'];
          for (const tableName of dropOrder) {
            if (existingTables.has(tableName)) {
              await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
              this.logger.debug('Dropped table', { tableName });
            }
          }
          existingTables.clear();
          result.createdTables = requiredTables; // All tables will be created
        }

        // Create missing tables using existing logic
        if (missingTables.length > 0 || dropExisting) {
          this.logger.debug('Creating tables', { mode: dropExisting ? 'all' : 'missing' });
          const tablesToCreate = dropExisting ? requiredTables : missingTables;
          
          // Reuse existing createMissingTables method
          await this.createMissingTables(client, tablesToCreate);
          if (!dropExisting) {
            result.createdTables = tablesToCreate;
          }
        }

        // Upgrade existing tables using existing logic
        if (!dropExisting && existingTables.size > 0) {
          this.logger.debug('Upgrading existing tables');
          const existingTablesArray = Array.from(existingTables);
          
          // Reuse existing upgradeExistingTables method  
          await this.upgradeExistingTables(client, existingTablesArray);
          result.upgradedTables = existingTablesArray;
        }

        // Processor only initializes schema, no data seeding
        // Data population is handled by:
        // - Manager: for configuration defaults (chains, tokens, RPC providers)
        // - External scripts: for address pools (generate-multichain-addresses.ts)
        result.warnings.push('Note: Schema initialized successfully. Use Manager to populate configuration defaults.');

        await client.query('COMMIT');
        this.logger.info('Database schema initialization completed successfully');

        result.summary = `✅ Schema initialized: ${result.createdTables.length} tables created, ${result.upgradedTables.length} tables upgraded`;

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Schema initialization failed: ${error.message}`);
      result.summary = `❌ Schema initialization failed: ${error.message}`;
      this.logger.error('Database schema initialization failed', { error: error.message, stack: error.stack });
    } finally {
      client.release();
    }

    return result;
  }

  // Chain block persistence methods moved to ChainBlocksRepository
}