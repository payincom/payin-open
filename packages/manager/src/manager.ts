/**
 * Configuration Management System
 * Provides CRUD operations and validation for database configuration
 */

import { Pool } from 'pg';
import type { ConfigProvider } from '@payin/shared';
import type {
  ChainConfig,
  TokenConfig,
  TokenChainConfig,
  RPCProviderConfig,
  RPCChainConfig,
  OperationalConfig,
  OperationContext,
  SystemSetting,
  PaymentLink,
  PaymentLinkOrder,
  PaymentLinkOrderStatus,
  UpdatePaymentLinkCurrenciesInput,
  PaymentLinkCheckoutResponse,
  CreatePaymentLinkInput,
} from './types.js';
import { ALL_SCHEMAS, TABLE_NAMES, type TableName } from './database/schema.js';
import {
  ChainValidator,
  TokenValidator,
  TokenChainValidator,
  RPCProviderValidator,
  RPCChainConfigValidator,
  OperationalConfigValidator,
} from './validators/index.js';
import { mapOrderStatusEvent, mapDepositEvent } from '@payin/notification';
import { ProcessorEventName } from '@payin/processor';
import { RedirectService, type RedirectConfig } from './services/redirect.service.js';
import {
  PaymentLinkService,
  type UpdatePaymentLinkInput,
  type PaymentLinkFilters,
  type PaymentLinkListResult,
  type PublishPaymentLinkInput,
} from './services/payment-link.service.js';

export interface ManagerOptions {
  /** Database connection string (required) */
  connectionString: string;
  /** YAML config path for Processor defaults (optional) */
  yamlPath?: string;
  /** Automatically initialize tables and defaults if missing (default: true) */
  autoInit?: boolean;
}

/**
 * Processor configuration built from database
 */
export interface ProcessorConfigFromDB {
  database?: {
    connectionString?: string;
  };
  chains?: {
    [chainId: string]: {
      protocol: string;
      name: string;
      network: 'mainnet' | 'testnet';
    };
  };
  tokens?: {
    [symbol: string]: {
      symbol: string;
      name: string;
      decimals: number;
      contracts: {
        [chainId: string]: string;
      };
    };
  };
  monitor?: {
    rpcConfig?: {
      providers: {
        [providerName: string]: {
          apiKeys?: string[];
        };
      };
      chains?: {
        [chainId: string]: Array<{
          provider: string;
          priority: number;
          config?: {
            timeout?: number;
            maxRequestsPerSecond?: number;
          };
        }>;
      };
    };
  };
}

export class ConfigurationManager implements ConfigProvider {
  private readonly db: Pool;
  private readonly connectionString: string;
  private readonly yamlPath?: string; // Manager YAML config file path
  private processor?: any; // Processor instance
  private notificationService?: any; // NotificationService instance
  private redirectService: RedirectService; // RedirectService instance
  private paymentLinkService: PaymentLinkService;

  // Configuration cache (singleton pattern ensures consistency)
  private configCache = new Map<string, {
    value: any;
    organizationId: string | null;
  }>();

  private readonly chainValidator: ChainValidator;
  private readonly tokenValidator: TokenValidator;
  private readonly tokenChainValidator: TokenChainValidator;
  private readonly rpcProviderValidator: RPCProviderValidator;
  private readonly rpcChainConfigValidator: RPCChainConfigValidator;
  private readonly operationalConfigValidator: OperationalConfigValidator;

  constructor(private readonly options: ManagerOptions) {
    // Validate required options
    if (!options.connectionString) {
      throw new Error('ConfigurationManager requires connectionString in options');
    }

    // Store connection string, YAML path, and create database pool
    this.connectionString = options.connectionString;
    if (options.yamlPath !== undefined) {
      this.yamlPath = options.yamlPath;
    }
    this.db = new Pool({ connectionString: this.connectionString });
    this.paymentLinkService = new PaymentLinkService(this.db);

    // Initialize validators
    this.chainValidator = new ChainValidator(this.db);
    this.tokenValidator = new TokenValidator(this.db);
    this.tokenChainValidator = new TokenChainValidator(this.db);
    this.rpcProviderValidator = new RPCProviderValidator(this.db);
    this.rpcChainConfigValidator = new RPCChainConfigValidator(this.db);
    this.operationalConfigValidator = new OperationalConfigValidator(this.db);

    // Initialize RedirectService with empty config (will be loaded during initialize())
    this.redirectService = new RedirectService({});
  }

  /**
   * Get database connection string
   * Used to pass to Processor
   */
  getConnectionString(): string {
    return this.connectionString;
  }

  /**
   * Initialize the Manager
   *
   * When INIT_DB=true:
   * - Creates database schema (Manager tables only)
   * - Initializes configuration metadata (config_metadata table)
   * - Initializes business settings defaults (config_values table)
   *
   * When INIT_DB is not set or false:
   * - Does nothing (safe default)
   *
   * Note: Technical configuration (chains, tokens, RPC) is managed via YAML files
   */
  async initialize(): Promise<void> {
    const shouldInit = process.env.INIT_DB === 'true';

    if (shouldInit) {
      console.log('🔧 Initializing Manager (INIT_DB=true)...');
      console.log('⚠️  AGGRESSIVE MODE: All Manager tables will be dropped and recreated!');

      // Drop and recreate all tables
      console.log('🗑️  Dropping existing Manager tables...');
      await this.dropTables();
      console.log('✅ Existing tables dropped');

      console.log('🏗️  Creating database schema...');
      await this.createTables([]);
      console.log('✅ Database schema created!\n');

      // Initialize config metadata and business settings
      console.log('📋 Initializing configuration metadata...');
      await this.initializeConfigMetadata();

      console.log('⚙️  Initializing business settings...');
      await this.initializeDefaultSystemSettings();
      console.log('✅ Manager initialization completed successfully!\n');
    } else {
      console.log('⏭️  Skipping Manager initialization (INIT_DB not set to true)\n');
    }

    // Load redirect configuration from database (always run, not just on init)
    await this.loadRedirectConfig();
  }

  /**
   * Check database schema completeness
   * Returns information about missing tables and schema status
   */
  async checkDatabaseSchema(): Promise<{
    isComplete: boolean;
    missingTables: TableName[];
    existingTables: TableName[];
    requiredTables: TableName[];
  }> {
    const missing: TableName[] = [];
    const existing: TableName[] = [];

    for (const tableName of TABLE_NAMES) {
      const result = await this.db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [tableName],
      );

      if (result.rows[0].exists) {
        existing.push(tableName);
      } else {
        missing.push(tableName);
      }
    }

    return {
      isComplete: missing.length === 0,
      missingTables: missing,
      existingTables: existing,
      requiredTables: [...TABLE_NAMES]
    };
  }

  /**
   * Check which required tables are missing from database
   * @deprecated Use checkDatabaseSchema() instead
   */
  async checkMissingTables(): Promise<TableName[]> {
    const result = await this.checkDatabaseSchema();
    return result.missingTables;
  }

  /**
   * Drop all Manager tables
   * DANGEROUS: This will delete all data!
   */
  private async dropTables(): Promise<void> {
    // Drop tables in reverse dependency order
    await this.db.query('DROP TABLE IF EXISTS paymentlink_orders CASCADE');
    await this.db.query('DROP TABLE IF EXISTS paymentlinks CASCADE');
    await this.db.query('DROP TABLE IF EXISTS config_values CASCADE');
    await this.db.query('DROP TABLE IF EXISTS config_metadata CASCADE');
  }

  /**
   * Create missing tables
   * Note: Creates all tables if any are missing to ensure schema consistency
   */
  async createTables(_tables: TableName[]): Promise<void> {
    // Create all tables to ensure foreign key consistency
    for (const schema of ALL_SCHEMAS) {
      await this.db.query(schema);
    }
  }

  /**
   * @deprecated No longer used - technical configuration is in YAML files
   *
   * Initialize default configuration from Processor
   *
   * This method was used to populate database with builtin chains, tokens, RPC providers.
   * Now these are managed via YAML files instead.
   */
  async initializeDefaults(): Promise<void> {
    try {
      // Dynamically import Processor.getDefaults()
      // Using type assertion to avoid cross-package TypeScript errors
      const processorModule = await import('@payin/processor') as any;

      const defaults = await processorModule.getDefaults(this.options.yamlPath) as any;

      console.log('📦 Initializing default configuration from Processor...');
      console.log(`   - Chains: ${defaults.chains.length}`);
      console.log(`   - Tokens: ${defaults.tokens.length}`);
      console.log(`   - Token-Chain mappings: ${defaults.tokenChains.length}`);
      console.log(`   - RPC Providers: ${defaults.rpcProviders.length}`);
      console.log(`   - RPC Chain configs: ${defaults.rpcChainConfigs.length}`);
      console.log(`   - Operational configs: ${defaults.operationalConfigs.length}`);

      // Create chains
      for (const chain of defaults.chains) {
        await this.createChain(chain as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.chains.length} chains`);

      // Create tokens
      for (const token of defaults.tokens) {
        await this.createToken(token as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.tokens.length} tokens`);

      // Create token-chain mappings
      for (const tokenChain of defaults.tokenChains) {
        await this.createTokenChain(tokenChain as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.tokenChains.length} token-chain mappings`);

      // Create RPC providers
      for (const provider of defaults.rpcProviders) {
        await this.createRPCProvider(provider as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.rpcProviders.length} RPC providers`);

      // Create RPC chain configs
      for (const rpcConfig of defaults.rpcChainConfigs) {
        await this.createRPCChainConfig(rpcConfig as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.rpcChainConfigs.length} RPC chain configurations`);

      // Create operational configs
      for (const opConfig of defaults.operationalConfigs) {
        await this.createOperationalConfig(opConfig as any, { bypassValidation: true });
      }
      console.log(`✅ Created ${defaults.operationalConfigs.length} operational configurations`);

      console.log('✨ Default configuration initialized successfully\n');
    } catch (error: any) {
      console.error('❌ Failed to initialize defaults:', error.message);
      throw error;
    }
    //   // Insert chains, tokens, tokenChains, providers, configs...
    //   // ...
    //
    //   console.log('Default configuration initialized successfully!');
    // } catch (error) {
    //   console.error('Failed to initialize defaults:', error);
    //   throw error;
    // }
  }

  /**
   * Check if configuration exists in database
   */
  async hasConfiguration(): Promise<boolean> {
    const result = await this.db.query('SELECT COUNT(*) as count FROM processor_chains');
    return parseInt(result.rows[0].count) > 0;
  }

  // ==================== Chain CRUD ====================

  async createChain(data: ChainConfig, context?: OperationContext): Promise<ChainConfig> {
    const validation = await this.chainValidator.validateCreate(data, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_chains
        (chain_id, protocol, network, name, is_builtin, is_enabled, display_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.chain_id,
        data.protocol,
        data.network,
        data.name,
        data.is_builtin || false,
        data.is_enabled !== undefined ? data.is_enabled : true,
        data.display_order || null,
        data.metadata || null,
      ],
    );

    return result.rows[0];
  }

  async updateChain(
    chainId: string,
    updates: Partial<ChainConfig>,
    context?: OperationContext,
  ): Promise<ChainConfig> {
    const current = await this.getChain(chainId);
    if (!current) {
      throw new Error(`Chain '${chainId}' not found`);
    }

    const validation = await this.chainValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'chain_id') {
        // chain_id is immutable
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(chainId);

    const result = await this.db.query(
      `UPDATE processor_chains SET ${fields.join(', ')} WHERE chain_id = $${paramIndex} RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteChain(chainId: string, context?: OperationContext): Promise<void> {
    const current = await this.getChain(chainId);
    if (!current) {
      throw new Error(`Chain '${chainId}' not found`);
    }

    const validation = await this.chainValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_chains WHERE chain_id = $1', [chainId]);
  }

  async getChain(chainId: string): Promise<ChainConfig | null> {
    const result = await this.db.query('SELECT * FROM processor_chains WHERE chain_id = $1', [chainId]);
    return result.rows[0] || null;
  }

  async listChains(filters?: { protocol?: string; network?: string; is_enabled?: boolean }): Promise<ChainConfig[]> {
    let query = 'SELECT * FROM processor_chains WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.protocol) {
      query += ` AND protocol = $${paramIndex++}`;
      values.push(filters.protocol);
    }
    if (filters?.network) {
      query += ` AND network = $${paramIndex++}`;
      values.push(filters.network);
    }
    if (filters?.is_enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      values.push(filters.is_enabled);
    }

    query += ' ORDER BY display_order ASC, chain_id ASC';

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // ==================== Token CRUD ====================

  async createToken(data: TokenConfig, context?: OperationContext): Promise<TokenConfig> {
    const validation = await this.tokenValidator.validateCreate(data, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_tokens
        (symbol, name, decimals, is_builtin, is_active, icon_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.symbol,
        data.name,
        data.decimals,
        data.is_builtin || false,
        data.is_active !== undefined ? data.is_active : true,
        data.icon_url || null,
        data.metadata || null,
      ],
    );

    return result.rows[0];
  }

  async updateToken(
    symbol: string,
    updates: Partial<TokenConfig>,
    context?: OperationContext,
  ): Promise<TokenConfig> {
    const current = await this.getToken(symbol);
    if (!current) {
      throw new Error(`Token '${symbol}' not found`);
    }

    const validation = await this.tokenValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'symbol') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(symbol);

    const result = await this.db.query(
      `UPDATE processor_tokens SET ${fields.join(', ')} WHERE symbol = $${paramIndex} RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteToken(symbol: string, context?: OperationContext): Promise<void> {
    const current = await this.getToken(symbol);
    if (!current) {
      throw new Error(`Token '${symbol}' not found`);
    }

    const validation = await this.tokenValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_tokens WHERE symbol = $1', [symbol]);
  }

  async getToken(symbol: string): Promise<TokenConfig | null> {
    const result = await this.db.query('SELECT * FROM processor_tokens WHERE symbol = $1', [symbol]);
    return result.rows[0] || null;
  }

  async listTokens(filters?: { is_active?: boolean }): Promise<TokenConfig[]> {
    let query = 'SELECT * FROM processor_tokens WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      values.push(filters.is_active);
    }

    query += ' ORDER BY symbol ASC';

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // ==================== TokenChain CRUD ====================

  async createTokenChain(data: TokenChainConfig, context?: OperationContext): Promise<TokenChainConfig> {
    // Convert symbol to token_id if provided
    const tokenId = data.symbol || data.token_id;
    if (!tokenId) {
      throw new Error('Either symbol or token_id must be provided');
    }

    const validation = await this.tokenChainValidator.validateCreate({ ...data, token_id: tokenId }, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_token_chains
        (token_id, chain_id, contract_address, confirmations, is_active, verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tokenId,
        data.chain_id,
        data.contract_address,
        data.confirmations || 3,
        data.is_active !== undefined ? data.is_active : true,
        data.verified || false,
      ],
    );

    return result.rows[0];
  }

  async updateTokenChain(
    tokenId: string,
    chainId: string,
    updates: Partial<TokenChainConfig>,
    context?: OperationContext,
  ): Promise<TokenChainConfig> {
    const current = await this.getTokenChain(tokenId, chainId);
    if (!current) {
      throw new Error(`TokenChain '${tokenId}:${chainId}' not found`);
    }

    const validation = await this.tokenChainValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'token_id' && key !== 'chain_id' && key !== 'symbol') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(tokenId, chainId);

    const result = await this.db.query(
      `UPDATE processor_token_chains SET ${fields.join(', ')}
       WHERE token_id = $${paramIndex} AND chain_id = $${paramIndex + 1}
       RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteTokenChain(tokenId: string, chainId: string, context?: OperationContext): Promise<void> {
    const current = await this.getTokenChain(tokenId, chainId);
    if (!current) {
      throw new Error(`TokenChain '${tokenId}:${chainId}' not found`);
    }

    const validation = await this.tokenChainValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_token_chains WHERE token_id = $1 AND chain_id = $2', [
      tokenId,
      chainId,
    ]);
  }

  async getTokenChain(tokenId: string, chainId: string): Promise<TokenChainConfig | null> {
    const result = await this.db.query(
      'SELECT * FROM processor_token_chains WHERE token_id = $1 AND chain_id = $2',
      [tokenId, chainId],
    );
    return result.rows[0] || null;
  }

  async listTokenChains(filters?: {
    token_id?: string;
    chain_id?: string;
    is_active?: boolean;
  }): Promise<TokenChainConfig[]> {
    let query = 'SELECT * FROM processor_token_chains WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.token_id) {
      query += ` AND token_id = $${paramIndex++}`;
      values.push(filters.token_id);
    }
    if (filters?.chain_id) {
      query += ` AND chain_id = $${paramIndex++}`;
      values.push(filters.chain_id);
    }
    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      values.push(filters.is_active);
    }

    query += ' ORDER BY token_id ASC, chain_id ASC';

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // ==================== RPC Provider CRUD ====================

  async createRPCProvider(data: RPCProviderConfig, context?: OperationContext): Promise<RPCProviderConfig> {
    const validation = await this.rpcProviderValidator.validateCreate(data, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_rpc_providers
        (provider_name, display_name, provider_type, is_builtin, api_key_required, api_key,
         homepage_url, documentation_url, supported_chains, default_settings, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.provider_name,
        data.display_name,
        data.provider_type,
        data.is_builtin || false,
        data.api_key_required || false,
        data.api_key || null,
        data.homepage_url || null,
        data.documentation_url || null,
        data.supported_chains || null,
        data.default_settings || null,
        data.is_active !== undefined ? data.is_active : true,
      ],
    );

    return result.rows[0];
  }

  async updateRPCProvider(
    providerName: string,
    updates: Partial<RPCProviderConfig>,
    context?: OperationContext,
  ): Promise<RPCProviderConfig> {
    const current = await this.getRPCProvider(providerName);
    if (!current) {
      throw new Error(`RPC Provider '${providerName}' not found`);
    }

    const validation = await this.rpcProviderValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'provider_name') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(providerName);

    const result = await this.db.query(
      `UPDATE processor_rpc_providers SET ${fields.join(', ')} WHERE provider_name = $${paramIndex} RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteRPCProvider(providerName: string, context?: OperationContext): Promise<void> {
    const current = await this.getRPCProvider(providerName);
    if (!current) {
      throw new Error(`RPC Provider '${providerName}' not found`);
    }

    const validation = await this.rpcProviderValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_rpc_providers WHERE provider_name = $1', [providerName]);
  }

  async getRPCProvider(providerName: string): Promise<RPCProviderConfig | null> {
    const result = await this.db.query('SELECT * FROM processor_rpc_providers WHERE provider_name = $1', [
      providerName,
    ]);
    return result.rows[0] || null;
  }

  async listRPCProviders(filters?: { provider_type?: string; is_active?: boolean }): Promise<RPCProviderConfig[]> {
    let query = 'SELECT * FROM processor_rpc_providers WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.provider_type) {
      query += ` AND provider_type = $${paramIndex++}`;
      values.push(filters.provider_type);
    }
    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      values.push(filters.is_active);
    }

    query += ' ORDER BY provider_name ASC';

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // ==================== RPC Chain Config CRUD ====================

  async createRPCChainConfig(data: RPCChainConfig, context?: OperationContext): Promise<RPCChainConfig> {
    const validation = await this.rpcChainConfigValidator.validateCreate(data, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_rpc_chain_configs
        (chain_id, provider_name, timeout_ms, max_requests_per_second, health_check_config,
         retry_config, priority, strategy, custom_endpoint_url, is_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.chain_id,
        data.provider_name,
        data.timeout_ms || null,
        data.max_requests_per_second || null,
        data.health_check_config || null,
        data.retry_config || null,
        data.priority || 100,
        data.strategy || null,
        data.custom_endpoint_url || null,
        data.is_enabled !== undefined ? data.is_enabled : true,
      ],
    );

    return result.rows[0];
  }

  async updateRPCChainConfig(
    chainId: string,
    providerName: string,
    updates: Partial<RPCChainConfig>,
    context?: OperationContext,
  ): Promise<RPCChainConfig> {
    const current = await this.getRPCChainConfig(chainId, providerName);
    if (!current) {
      throw new Error(`RPC Chain Config '${chainId}:${providerName}' not found`);
    }

    const validation = await this.rpcChainConfigValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'chain_id' && key !== 'provider_name') {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(chainId, providerName);

    const result = await this.db.query(
      `UPDATE processor_rpc_chain_configs SET ${fields.join(', ')}
       WHERE chain_id = $${paramIndex} AND provider_name = $${paramIndex + 1}
       RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteRPCChainConfig(chainId: string, providerName: string, context?: OperationContext): Promise<void> {
    const current = await this.getRPCChainConfig(chainId, providerName);
    if (!current) {
      throw new Error(`RPC Chain Config '${chainId}:${providerName}' not found`);
    }

    const validation = await this.rpcChainConfigValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_rpc_chain_configs WHERE chain_id = $1 AND provider_name = $2', [
      chainId,
      providerName,
    ]);
  }

  async getRPCChainConfig(chainId: string, providerName: string): Promise<RPCChainConfig | null> {
    const result = await this.db.query(
      'SELECT * FROM processor_rpc_chain_configs WHERE chain_id = $1 AND provider_name = $2',
      [chainId, providerName],
    );
    return result.rows[0] || null;
  }

  async listRPCChainConfigs(filters?: {
    chain_id?: string;
    provider_name?: string;
    is_enabled?: boolean;
  }): Promise<RPCChainConfig[]> {
    let query = 'SELECT * FROM processor_rpc_chain_configs WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.chain_id) {
      query += ` AND chain_id = $${paramIndex++}`;
      values.push(filters.chain_id);
    }
    if (filters?.provider_name) {
      query += ` AND provider_name = $${paramIndex++}`;
      values.push(filters.provider_name);
    }
    if (filters?.is_enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      values.push(filters.is_enabled);
    }

    query += ' ORDER BY chain_id ASC, priority ASC';

    const result = await this.db.query(query, values);
    return result.rows;
  }

  // ==================== Operational Config CRUD ====================

  async createOperationalConfig(data: OperationalConfig, context?: OperationContext): Promise<OperationalConfig> {
    const validation = await this.operationalConfigValidator.validateCreate(data, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `INSERT INTO processor_configs (category, config_data) VALUES ($1, $2) RETURNING *`,
      [data.category, data.config_data],
    );

    return result.rows[0];
  }

  async updateOperationalConfig(
    category: string,
    updates: Partial<OperationalConfig>,
    context?: OperationContext,
  ): Promise<OperationalConfig> {
    const current = await this.getOperationalConfig(category);
    if (!current) {
      throw new Error(`Operational config '${category}' not found`);
    }

    const validation = await this.operationalConfigValidator.validateUpdate(current, updates, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    const result = await this.db.query(
      `UPDATE processor_configs SET config_data = $1, updated_at = NOW() WHERE category = $2 RETURNING *`,
      [updates.config_data || current.config_data, category],
    );

    return result.rows[0];
  }

  async deleteOperationalConfig(category: string, context?: OperationContext): Promise<void> {
    const current = await this.getOperationalConfig(category);
    if (!current) {
      throw new Error(`Operational config '${category}' not found`);
    }

    const validation = await this.operationalConfigValidator.validateDelete(current, context);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors, null, 2)}`);
    }

    await this.db.query('DELETE FROM processor_configs WHERE category = $1', [category]);
  }

  async getOperationalConfig(category: string): Promise<OperationalConfig | null> {
    const result = await this.db.query('SELECT * FROM processor_configs WHERE category = $1', [category]);
    return result.rows[0] || null;
  }

  async listOperationalConfigs(): Promise<OperationalConfig[]> {
    const result = await this.db.query('SELECT * FROM processor_configs ORDER BY category ASC');
    return result.rows;
  }

  // History methods removed - audit handled by Auth module

  // ==================== System Settings CRUD ====================

  /**
   * Create or update a system setting
   *
   * Note: description is defined in config_metadata table, not stored in config_values
   * Note: Audit logging is handled by Auth module via middleware
   */
  async setSystemSetting(
    key: string,
    value: any
  ): Promise<SystemSetting> {
    // Check if setting exists
    const existing = await this.getSystemSetting(key);

    // PostgreSQL JSONB column requires proper JSON format
    // All values must be valid JSON, including strings (must be quoted)
    // Use JSON.stringify for all types to ensure proper JSONB serialization
    const jsonValue = JSON.stringify(value);

    if (existing) {
      // Update existing setting
      const result = await this.db.query(
        `UPDATE config_values
         SET value = $1::jsonb, updated_at = NOW()
         WHERE key = $2
         RETURNING *`,
        [jsonValue, key]
      );

      return result.rows[0];
    } else {
      // Create new setting
      const result = await this.db.query(
        `INSERT INTO config_values (key, value)
         VALUES ($1, $2::jsonb)
         RETURNING *`,
        [key, jsonValue]
      );

      return result.rows[0];
    }
  }

  /**
   * Get a system setting by key
   */
  async getSystemSetting(key: string): Promise<SystemSetting | null> {
    const result = await this.db.query(
      'SELECT * FROM config_values WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // JSONB values are automatically parsed by pg driver
    return result.rows[0];
  }

  /**
   * List system settings
   */
  async listSystemSettings(filters?: {
    editableViaUi?: boolean;
  }): Promise<SystemSetting[]> {
    let query = 'SELECT * FROM config_values WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.editableViaUi !== undefined) {
      query += ` AND editable_via_ui = $${paramIndex++}`;
      values.push(filters.editableViaUi);
    }

    query += ' ORDER BY key ASC';

    const result = await this.db.query(query, values);
    // JSONB values are automatically parsed by pg driver
    return result.rows;
  }

  /**
   * Delete a system setting
   * Note: Audit logging is handled by Auth module via middleware
   */
  async deleteSystemSetting(key: string): Promise<void> {
    const existing = await this.getSystemSetting(key);
    if (!existing) {
      throw new Error(`System setting '${key}' not found`);
    }

    await this.db.query('DELETE FROM config_values WHERE key = $1', [key]);
  }

  // getSystemSettingHistory removed - audit handled by Auth module

  // ==================== ConfigProvider Interface Implementation ====================

  /**
   * Get configuration value with organization isolation (ConfigProvider interface)
   *
   * Priority:
   * 1. Organization-level config (if organizationId provided)
   * 2. Global config_values (organization_id IS NULL)
   * 3. config_metadata.default_value
   * 4. Returns undefined if config key doesn't exist
   *
   * This method implements caching for performance optimization.
   */
  async getConfig(key: string, organizationId?: string): Promise<any | undefined> {
    const setting = await this.getSystemSettingWithCache(key, organizationId);
    if (setting) {
      return setting.value;
    }

    // Fallback to config_metadata default_value
    const { CONFIG_METADATA } = await import('./config/config-metadata.js');
    const metadata = CONFIG_METADATA.find(m => m.key === key);
    return metadata?.defaultValue;
  }

  /**
   * Get Order default redirect URL configuration with organization isolation
   *
   * Priority (for each URL):
   * 1. Organization-level config (if organizationId provided)
   * 2. Global config (organization_id IS NULL)
   * 3. undefined (if not configured)
   *
   * Note: These are configuration values. Order-level overrides (success_url/cancel_url in orders table)
   * take precedence over these configuration values.
   *
   * @param organizationId - Organization ID for organization-level config
   * @returns Object with successUrl and cancelUrl, or empty object if not configured
   */
  async getOrderDefaultRedirectUrls(organizationId?: string): Promise<{
    successUrl?: string;
    cancelUrl?: string;
  }> {
    const successUrl = await this.getConfig('redirect.default_order_success_url', organizationId);
    const cancelUrl = await this.getConfig('redirect.default_order_cancel_url', organizationId);

    return {
      successUrl,
      cancelUrl
    };
  }

  /**
   * Get Deposit default redirect URL configuration with organization isolation
   *
   * Priority:
   * 1. Organization-level config (if organizationId provided)
   * 2. Global config (organization_id IS NULL)
   * 3. undefined (if not configured)
   *
   * Note: Deposit redirect URL is global/organization-level only.
   * There is no per-deposit override (deposits are long-term, not one-time like orders).
   *
   * @param organizationId - Organization ID for organization-level config
   * @returns Redirect URL or undefined if not configured
   */
  async getDepositDefaultRedirectUrl(organizationId?: string): Promise<string | undefined> {
    return await this.getConfig('redirect.deposit.success_url', organizationId);
  }

  /**
   * Get system setting with cache support and organization isolation
   * Internal method used by both getConfig() and getSystemSetting()
   */
  private async getSystemSettingWithCache(key: string, organizationId?: string): Promise<SystemSetting | null> {
    // Try organization-level cache first
    if (organizationId) {
      const orgCacheKey = this.buildCacheKey(key, organizationId);
      const cached = this.configCache.get(orgCacheKey);
      if (cached) {
        return {
          key,
          value: cached.value,
          organization_id: cached.organizationId,
          category: 'business_rules', // Category info not cached, filled for type compatibility
          editable_via_ui: true,
          updated_at: new Date()
        } as SystemSetting;
      }
    }

    // Try global cache
    const globalCacheKey = this.buildCacheKey(key, null);
    const globalCached = this.configCache.get(globalCacheKey);
    if (globalCached && !organizationId) {
      return {
        key,
        value: globalCached.value,
        organization_id: null,
        category: 'business_rules',
        editable_via_ui: true,
        updated_at: new Date()
      } as SystemSetting;
    }

    // Cache miss - query database with priority logic
    // Try organization-level first
    if (organizationId) {
      const orgResult = await this.db.query(
        'SELECT * FROM config_values WHERE key = $1 AND organization_id = $2',
        [key, organizationId]
      );
      if (orgResult.rows.length > 0) {
        const setting = orgResult.rows[0];
        // Cache organization-level config
        this.configCache.set(
          this.buildCacheKey(key, organizationId),
          { value: setting.value, organizationId: setting.organization_id }
        );
        return setting;
      }
    }

    // Fallback to global config
    const globalResult = await this.db.query(
      'SELECT * FROM config_values WHERE key = $1 AND organization_id IS NULL',
      [key]
    );
    if (globalResult.rows.length > 0) {
      const setting = globalResult.rows[0];
      // Cache global config
      this.configCache.set(
        this.buildCacheKey(key, null),
        { value: setting.value, organizationId: null }
      );
      return setting;
    }

    return null;
  }

  /**
   * Build cache key for configuration
   */
  private buildCacheKey(key: string, organizationId: string | null): string {
    return `${key}:${organizationId || 'global'}`;
  }

  /**
   * Clear configuration cache
   * Useful for manual refresh or testing
   */
  clearConfigCache(): void {
    this.configCache.clear();
  }

  /**
   * Get configuration cache statistics
   * Useful for monitoring and debugging
   */
  getConfigCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys())
    };
  }

  // ==================== Configuration Metadata ====================

  /**
   * Initialize configuration metadata
   * Populates config_metadata table with all configurable items
   */
  async initializeConfigMetadata(): Promise<void> {
    const { CONFIG_METADATA } = await import('./config/config-metadata.js');

    for (const metadata of CONFIG_METADATA) {
      const existing = await this.db.query(
        'SELECT * FROM config_metadata WHERE key = $1',
        [metadata.key]
      );

      if (existing.rows.length === 0) {
        await this.db.query(
          `INSERT INTO config_metadata
            (key, display_name, description, type, default_value, validation_rules, ui_hints, editable, global_only)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
          [
            metadata.key,
            metadata.displayName,
            metadata.description,
            metadata.type,
            JSON.stringify(metadata.defaultValue),
            JSON.stringify(metadata.validationRules || null),
            JSON.stringify(metadata.uiHints || null),
            metadata.editable !== false,
            metadata.globalOnly === true
          ]
        );
      }
    }

    console.log(`✅ Initialized ${CONFIG_METADATA.length} configuration metadata items`);
  }

  /**
   * Extract default values from Processor defaults
   * Maps Processor configuration to Manager config_values keys
   */
  private async extractDefaultValuesFromProcessor(): Promise<Record<string, any>> {
    const { getDefaults } = await import('@payin/processor');
    const processorDefaults = await getDefaults();

    const defaultValues: Record<string, any> = {};

    // Extract from operationalConfigs
    for (const opConfig of processorDefaults.operationalConfigs) {
      if (opConfig.category === 'orders') {
        const data = opConfig.config_data;
        if (data.defaultPaymentWindowMinutes !== undefined) {
          defaultValues['orders.payment_window_minutes'] = data.defaultPaymentWindowMinutes;
        }
        if (data.defaultGracePeriodMinutes !== undefined) {
          defaultValues['orders.grace_period_minutes'] = data.defaultGracePeriodMinutes;
        }
        if (data.maxTotalTimeoutMinutes !== undefined) {
          defaultValues['orders.max_total_timeout_minutes'] = data.maxTotalTimeoutMinutes;
        }
      }

      if (opConfig.category === 'deposits') {
        const data = opConfig.config_data;
        if (data.poolManagement) {
          if (data.poolManagement.defaultCooldownMinutes !== undefined) {
            defaultValues['address_pool.cooldown_minutes'] = data.poolManagement.defaultCooldownMinutes;
          }
        }
      }

      if (opConfig.category === 'delayedConfirmation') {
        const data = opConfig.config_data;
        if (data.checkInterval !== undefined) {
          // Convert milliseconds to seconds for storage in Manager DB
          defaultValues['delayed_confirmation.check_interval'] = Math.floor(data.checkInterval / 1000);
        }
      }

      if (opConfig.category === 'services') {
        const data = opConfig.config_data;
        if (data.orders !== undefined) {
          defaultValues['services.orders_enabled'] = data.orders;
        }
        if (data.deposits !== undefined) {
          defaultValues['services.deposits_enabled'] = data.deposits;
        }
      }
    }

    // NOTE: chains, tokens, and confirmations are now managed in Processor YAML
    // They are no longer extracted to Manager database

    return defaultValues;
  }

  /**
   * Initialize default system settings
   * Populates config_values table with default values from Processor defaults
   */
  async initializeDefaultSystemSettings(): Promise<void> {
    const { CONFIG_METADATA } = await import('./config/config-metadata.js');

    // Get default values from Processor
    const processorDefaults = await this.extractDefaultValuesFromProcessor();

    for (const metadata of CONFIG_METADATA) {
      const existing = await this.getSystemSetting(metadata.key);
      if (!existing) {
        // Use Processor default if available, otherwise use metadata default
        const defaultValue = processorDefaults[metadata.key] !== undefined
          ? processorDefaults[metadata.key]
          : metadata.defaultValue;

        await this.setSystemSetting(metadata.key, defaultValue);
      }
    }

    console.log(`✅ Initialized ${CONFIG_METADATA.length} default system settings`);
  }

  // ==================== Build Processor Config ====================

  /**
   * Build Processor configuration from Database config_values
   *
   * Transforms config_values (Manager format) to ProcessorConfig (Processor format)
   * using Processor defaults as the base template
   *
   * @returns ProcessorConfig object ready for Processor.create()
   */
  async buildProcessorConfig(): Promise<ProcessorConfigFromDB> {
    // Read system settings (business configuration from database)
    const systemSettings = await this.listSystemSettings();

    // Transform config_values to Processor format
    // NOTE: chains, tokens, confirmations are no longer included - they come from Processor YAML
    const { transformToProcessorConfig } = await import('./config/config-transformer.js');
    const transformedConfig = await transformToProcessorConfig(systemSettings);

    // Build final config
    const config: ProcessorConfigFromDB = {
      // Database connection (ALWAYS included - Manager provides it to Processor)
      database: {
        connectionString: this.connectionString,
      },
      // Transformed business configuration from config_values
      ...transformedConfig,
    };

    return config;
  }

  // ==================== Runtime Configuration (Read-only) ====================

  /**
   * Get Manager YAML configuration metadata
   * This includes configuration item definitions, not the actual values
   */
  async getManagerYamlConfig(): Promise<any> {
    if (!this.yamlPath) {
      return { configMetadata: [] };
    }

    try {
      const { readFileSync } = await import('fs');
      const { parse } = await import('yaml');
      const content = readFileSync(this.yamlPath, 'utf-8');
      return parse(content);
    } catch (error) {
      console.warn(`Failed to load Manager YAML config from ${this.yamlPath}:`, error);
      return { configMetadata: [] };
    }
  }

  /**
   * Get Processor default configuration
   */
  async getProcessorDefaultConfig(): Promise<any> {
    try {
      // @ts-ignore - Dynamic import of compiled module
      const { loadConfig } = await import('@payin/processor/dist/core/config-loader.js');
      return await loadConfig();
    } catch (error) {
      console.warn('Failed to load Processor default config:', error);
      return {};
    }
  }

  /**
   * Get Monitor default configuration
   */
  async getMonitorDefaultConfig(): Promise<any> {
    try {
      // @ts-ignore - Dynamic import of compiled module
      const { loadMonitorConfig } = await import('@payin/monitor/dist/config/config-loader.js');
      return await loadMonitorConfig();
    } catch (error) {
      console.warn('Failed to load Monitor default config:', error);
      return {};
    }
  }

  /**
   * Get complete runtime configuration (merged)
   *
   * This returns the final configuration that the system is using,
   * combining Manager YAML, Processor YAML, Monitor defaults, and Database values.
   *
   * Priority (low to high):
   * 1. Monitor built-in defaults
   * 2. Monitor default.yaml
   * 3. Processor default.yaml
   * 4. Manager YAML (metadata)
   * 5. Database config_values (highest)
   */
  async getRuntimeConfig(): Promise<{
    source: string;
    timestamp: string;
    layers: {
      monitor: any;
      processor: any;
      manager: any;
      database: any;
    };
    merged: any;
  }> {
    const timestamp = new Date().toISOString();

    // Get all configuration layers
    const [monitor, processor, manager, database] = await Promise.all([
      this.getMonitorDefaultConfig(),
      this.getProcessorDefaultConfig(),
      this.getManagerYamlConfig(),
      this.listSystemSettings()
    ]);

    // Build merged configuration (simplified - actual merge happens in Processor/Monitor)
    const merged = {
      database: {
        connectionString: this.maskConnectionString(this.connectionString)
      },
      ...processor,
      monitor,
      // Database settings override YAML values
      _databaseOverrides: database
    };

    return {
      source: 'merged',
      timestamp,
      layers: {
        monitor,
        processor,
        manager,
        database
      },
      merged
    };
  }

  /**
   * Get configuration metadata for a specific key
   */
  async getConfigMetadata(key: string): Promise<any | null> {
    const result = await this.db.query(
      'SELECT * FROM config_metadata WHERE key = $1',
      [key]
    );
    const rows = result.rows;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      key: row.key,
      category: row.category,
      dataType: row.data_type,
      defaultValue: row.default_value,
      validationRules: row.validation_rules,
      description: row.description
    };
  }

  /**
   * List all configuration metadata
   */
  async listConfigMetadata(): Promise<any[]> {
    const query = 'SELECT * FROM config_metadata ORDER BY key';
    const result = await this.db.query(query);
    const rows = result.rows;

    return rows.map((row: any) => ({
      key: row.key,
      dataType: row.data_type,
      defaultValue: row.default_value,
      validationRules: row.validation_rules,
      description: row.description,
      globalOnly: row.global_only,
    }));
  }

  /**
   * Mask sensitive information in connection string
   */
  private maskConnectionString(connStr: string): string {
    return connStr.replace(/:[^:@]+@/, ':****@');
  }

  // ==================== Processor Integration ====================

  /**
   * Initialize and start Processor
   * This should be called after Manager initialization
   * @param config - Processor configuration override
   * @param config.monitor - Monitor configuration (e.g., rpcKeys, chains)
   * @param config.processorConfigFile - Optional path to Processor config file (e.g., 'development.yaml')
   */
  async startProcessor(config?: { monitor?: any; processorConfigFile?: string; [key: string]: any }): Promise<void> {
    const { Processor } = await import('@payin/processor');
    const { ConfigProviderAdapter } = await import('./config-provider-adapter.js');

    // Extract processorConfigFile from config
    const { processorConfigFile, ...otherConfig } = config || {};

    // Build Processor config from Manager
    const processorConfig = await this.buildProcessorConfig();

    // Merge with provided config (provided config takes precedence)
    const finalConfig: any = {
      ...processorConfig,
      ...otherConfig,
    };

    // Create ConfigProvider adapter for secure configuration access
    const configProvider = new ConfigProviderAdapter(this);

    // Create and start Processor with ConfigProvider
    // Pass processorConfigFile to load environment-specific chains/tokens
    this.processor = await Processor.create(finalConfig, processorConfigFile, configProvider);
    await this.processor.start();

    // Start NotificationService
    await this.startNotificationService();

    // Setup event forwarding from Processor to Notification
    this.setupProcessorEventForwarding();
  }

  /**
   * Stop Processor
   */
  async stopProcessor(): Promise<void> {
    // Stop NotificationService first
    if (this.notificationService) {
      await this.notificationService.stop();
      this.notificationService = undefined;
      console.log('✅ NotificationService stopped');
    }

    // Then stop Processor
    if (this.processor) {
      await this.processor.stop();
      this.processor = undefined;
      console.log('✅ Processor stopped');
    }
  }

  /**
   * Get Processor instance
   * Throws error if Processor not started
   */
  private getProcessor(): any {
    if (!this.processor) {
      throw new Error('Processor not started. Call startProcessor() first.');
    }
    return this.processor;
  }

  /**
   * Start NotificationService
   */
  private async startNotificationService(): Promise<void> {
    const { NotificationService } = await import('@payin/notification');

    this.notificationService = await NotificationService.create({
      database: {
        connectionString: this.connectionString,
      },
      queue: {
        maxConcurrency: 10,
        checkIntervalMs: 5000,
      },
    });

    await this.notificationService.start();
  }

  /**
   * Setup event forwarding from Processor to NotificationService
   */
  private setupProcessorEventForwarding(): void {
    if (!this.processor || !this.notificationService) {
      return;
    }

    const eventBus = this.processor.getEventBus();

    // Forward order events
    eventBus.subscribe(ProcessorEventName.ORDER_STATUS_CHANGED, async (event: any) => {
      const notificationEvent = mapOrderStatusEvent(event);
      if (notificationEvent) {
        await this.notificationService!.sendNotification(notificationEvent);
      }

      const mappedStatus = this.mapOrderStatusToPaymentLinkStatus(event.newStatus);
      if (mappedStatus && event.orderReference && event.orderId) {
        try {
          await this.paymentLinkService.syncOrderStatus({
            orderReference: event.orderReference,
            orderId: event.orderId,
            newStatus: mappedStatus,
            completedAt: event.completedAt ?? null,
          });
        } catch (error) {
          console.warn('⚠️ Failed to sync Payment Link order status:', error);
        }
      }
    });

    // Forward deposit events
    eventBus.subscribe(ProcessorEventName.DEPOSIT_RECEIVED, async (event: any) => {
      const notificationEvent = mapDepositEvent(event, 'completed');
      await this.notificationService!.sendNotification(notificationEvent);
    });

    eventBus.subscribe(ProcessorEventName.ADDRESS_BOUND, async (event: any) => {
      const notificationEvent = mapDepositEvent(event, 'address_bound');
      await this.notificationService!.sendNotification(notificationEvent);
    });
  }

  /**
   * Get NotificationService instance
   */
  getNotificationService(): any {
    return this.notificationService;
  }

  // ==================== Payment Link Operations ====================

  async createPaymentLink(request: CreatePaymentLinkInput): Promise<PaymentLink> {
    return await this.paymentLinkService.createPaymentLink(request);
  }

  async updatePaymentLink(
    paymentLinkId: string,
    organizationId: string,
    updates: UpdatePaymentLinkInput
  ): Promise<PaymentLink> {
    return await this.paymentLinkService.updatePaymentLink(paymentLinkId, organizationId, updates);
  }

  async publishPaymentLink(
    paymentLinkId: string,
    organizationId: string,
    slug?: string
  ): Promise<PaymentLink> {
    const payload: PublishPaymentLinkInput = {
      paymentLinkId,
      organizationId,
      ...(slug ? { slug } : {}),
    };
    return await this.paymentLinkService.publishPaymentLink(payload);
  }

  async unpublishPaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    return await this.paymentLinkService.unpublishPaymentLink(paymentLinkId, organizationId);
  }

  async archivePaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    return await this.paymentLinkService.archivePaymentLink(paymentLinkId, organizationId);
  }

  async restorePaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    return await this.paymentLinkService.restorePaymentLink(paymentLinkId, organizationId);
  }

  async listPaymentLinks(filters: PaymentLinkFilters): Promise<PaymentLinkListResult> {
    return await this.paymentLinkService.listPaymentLinks(filters);
  }

  async getPaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink | null> {
    return await this.paymentLinkService.getPaymentLinkById(paymentLinkId, organizationId);
  }

  async getPaymentLinkBySlug(slug: string): Promise<PaymentLink | null> {
    return await this.paymentLinkService.getPaymentLinkBySlug(slug);
  }

  async listPaymentLinkOrders(
    paymentLinkId: string,
    organizationId: string
  ): Promise<PaymentLinkOrder[]> {
    return await this.paymentLinkService.listPaymentLinkOrders(paymentLinkId, organizationId);
  }

  /**
   * Update payment link currencies configuration
   */
  async updatePaymentLinkCurrencies(
    paymentLinkId: string,
    organizationId: string,
    input: UpdatePaymentLinkCurrenciesInput
  ): Promise<PaymentLink> {
    return await this.paymentLinkService.updatePaymentLinkCurrencies(paymentLinkId, organizationId, input);
  }

  /**
   * Get payment link checkout data (with currency and chain options)
   */
  async getPaymentLinkCheckoutData(slug: string): Promise<PaymentLinkCheckoutResponse> {
    return await this.paymentLinkService.getPaymentLinkCheckoutData(slug);
  }

  async createPaymentLinkOrder(request: {
    slug: string;
    buyerEmail: string;
    currency: string;
    chainId: string;
    amount?: string | number;
  }): Promise<{
    order: any;
    paymentLink: PaymentLink;
    paymentLinkOrder: PaymentLinkOrder;
  }> {
    const reservation = await this.paymentLinkService.reserveOrderBySlug(
      request.slug,
      request.buyerEmail,
      request.currency,
      request.chainId,
      request.amount
    );

    const { paymentLink, paymentLinkOrder } = reservation;

    try {
      const metadata = {
        source: 'paymentlink',
        paymentLinkId: paymentLink.id,
        paymentLinkSlug: paymentLink.slug,
        title: paymentLink.title,
        description: paymentLink.description,
        buyerEmail: request.buyerEmail,
      };

      const order = await this.createOrder({
        organizationId: paymentLink.organization_id,
        orderReference: paymentLinkOrder.id,
        amount: paymentLinkOrder.amount,
        currency: paymentLinkOrder.selected_currency,
        chainId: paymentLinkOrder.selected_chain,
        metadata,
      });

      const orderId = order?.orderId ?? order?.id;
      if (orderId) {
        await this.paymentLinkService.attachOrderId(paymentLinkOrder.id, orderId);
        paymentLinkOrder.order_id = orderId;
      }

      return { order, paymentLink, paymentLinkOrder };
    } catch (error) {
      await this.paymentLinkService.releaseReservation(paymentLinkOrder.id);
      throw error;
    }
  }

  private mapOrderStatusToPaymentLinkStatus(status: string): PaymentLinkOrderStatus | null {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'completed':
        return 'completed';
      case 'expired':
        return 'expired';
      default:
        return null;
    }
  }

  // ==================== Business Operations (Proxy to Processor) ====================

  /**
   * Check if a service is enabled for an organization
   * Priority: Organization config > Global config > Default (true)
   *
   * @param service - Service name ('orders' or 'deposits')
   * @param organizationId - Organization ID
   * @returns true if service is enabled, false if disabled
   */
  private async isServiceEnabled(
    service: 'orders' | 'deposits',
    organizationId: string
  ): Promise<boolean> {
    const configKey = `services.${service}_enabled`;
    const enabled = await this.getConfig(configKey, organizationId);

    // Default to true if config not found (services are enabled by default)
    return enabled !== false;
  }

  /**
   * Create order (proxy to Processor)
   * Service switch: Checks if order service is enabled for the organization
   */
  async createOrder(request: {
    organizationId: string; // Multi-tenant isolation
    orderReference: string;
    amount: string;
    currency: string;
    chainId: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    // Check if order service is enabled
    const ordersEnabled = await this.isServiceEnabled('orders', request.organizationId);
    if (!ordersEnabled) {
      throw new Error(
        `Order service is disabled for organization ${request.organizationId}. ` +
        `Please contact support for assistance.`
      );
    }

    return await this.getProcessor().createOrder(request);
  }

  /**
   * Get order (proxy to Processor)
   * @param orderId - Order ID
   * @param organizationId - Optional organization ID for multi-tenant filtering (API calls should always provide this)
   */
  async getOrder(orderId: string, organizationId?: string): Promise<any> {
    return await this.getProcessor().getOrder(orderId, organizationId);
  }

  /**
   * List orders with filtering and pagination (proxy to Processor)
   */
  async listOrders(filters: {
    organizationId?: string; // Multi-tenant isolation
    status?: string | string[];
    chain?: string;
    token?: string;
    orderReference?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'updated_at' | 'amount';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ orders: any[]; total: number; page: number; limit: number }> {
    return await this.getProcessor().listOrders(filters);
  }

  /**
   * Get order statistics (proxy to Processor)
   */
  async getOrderStatistics(filters: {
    organizationId?: string; // Multi-tenant isolation
    chain?: string;
    token?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  } = {}): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    expiredOrders: number;
    totalAmount: string;
    completedAmount: string;
    avgPaymentTimeSeconds: number;
    byStatus: Record<string, number>;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
  }> {
    return await this.getProcessor().getOrderStatistics(filters);
  }

  /**
   * Bind deposit address (proxy to Processor)
   * Service switch: Checks if deposit service is enabled for the organization
   */
  async bindDepositAddress(request: {
    organizationId: string; // Multi-tenant isolation
    depositReference: string;
    protocol: 'evm' | 'tron';
    callbackUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    // Check if deposit service is enabled
    const depositsEnabled = await this.isServiceEnabled('deposits', request.organizationId);
    if (!depositsEnabled) {
      throw new Error(
        `Deposit service is disabled for organization ${request.organizationId}. ` +
        `Please contact support for assistance.`
      );
    }

    return await this.getProcessor().bindDepositAddress(request);
  }

  /**
   * Unbind deposit address (proxy to Processor)
   */
  async unbindDepositAddress(request: {
    depositReference: string;
  }): Promise<void> {
    return await this.getProcessor().unbindDepositAddress(request);
  }

  /**
   * Unbind deposit address by address (proxy to Processor)
   */
  async unbindDepositAddressByAddress(request: {
    organizationId: string;
    address: string;
    protocol: 'evm' | 'tron';
  }): Promise<void> {
    return await this.getProcessor().unbindDepositAddressByAddress(request);
  }

  /**
   * List deposit references with statistics (proxy to Processor)
   */
  async listDepositReferences(filters: {
    organizationId?: string; // Multi-tenant filtering
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{
    references: Array<{
      depositReference: string;
      protocols: string[];
      addressCount: number;
      totalDeposits: number;
      totalAmount: Record<string, number>;
      lastDepositAt: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    return await this.getProcessor().listDepositReferences(filters);
  }

  /**
   * Get user deposit address (proxy to Processor)
   * @param organizationId - Organization ID for multi-tenant filtering
   * @param depositReference - Deposit reference ID
   * @param protocol - Protocol (evm or tron)
   */
  async getUserDepositAddress(organizationId: string, depositReference: string, protocol: 'evm' | 'tron' | 'solana' = 'evm'): Promise<any> {
    return await this.getProcessor().getUserDepositAddress(organizationId, depositReference, protocol);
  }

  /**
   * Get deposit address by address (proxy to Processor)
   * Used by public endpoints - address is globally unique identifier
   * @param address - Blockchain address
   */
  async getDepositByAddress(address: string): Promise<any> {
    return await this.getProcessor().getDepositByAddress(address);
  }

  /**
   * List deposit addresses (proxy to Processor)
   */
  async listDepositAddresses(filters: {
    organizationId?: string;
    protocol?: 'evm' | 'tron';
    depositReference?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ addresses: any[]; total: number; page: number; limit: number }> {
    return await this.getProcessor().listDepositAddresses(filters);
  }

  /**
   * List transfers with filtering and pagination (proxy to Processor)
   */
  async listTransfers(filters: {
    organizationId?: string; // Multi-tenant filtering
    orderId?: string;
    depositReference?: string;
    businessType?: 'order' | 'deposit';
    chain?: string;
    token?: string;
    isConfirmed?: boolean;
    isFailed?: boolean;
    detectedAfter?: Date;
    detectedBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'detected_at' | 'confirmed_at' | 'amount';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ transfers: any[]; total: number; page: number; limit: number }> {
    return await this.getProcessor().listTransfers(filters);
  }

  /**
   * Get transfers for order or deposit reference (proxy to Processor)
   */
  async getTransfers(reference: { orderId?: string; depositReference?: string }): Promise<any[]> {
    return await this.getProcessor().getTransfers(reference);
  }

  /**
   * Get transfer by transaction hash (proxy to Processor)
   */
  async getTransferByTxHash(txHash: string): Promise<any | null> {
    return await this.getProcessor().getTransferByTxHash(txHash);
  }

  /**
   * Get address pool availability (proxy to Processor)
   */
  async getAddressPoolAvailability(organizationId: string, protocol: 'evm' | 'tron' | 'solana' = 'evm'): Promise<{
    total: number;
    available: number;
    allocated: number;
    bound: number;
    coolingDown: number;
    archived: number;
  }> {
    return await this.getProcessor().getAddressPoolAvailability(organizationId, protocol);
  }

  /**
   * List addresses from address pool with pagination (proxy to Processor)
   */
  async listAddresses(params: {
    organizationId: string;
    protocol?: 'evm' | 'tron' | 'solana';
    page?: number;
    pageSize?: number;
  }): Promise<{
    addresses: Array<{
      address: string;
      protocol: 'evm' | 'tron' | 'solana';
      status: 'available' | 'allocated' | 'bound';
      type: 'order' | 'deposit' | null;
      externalId: string | null;
      allocatedAt: Date | null;
      recycledAt: Date | null;
      cooldownUntil: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    return await this.getProcessor().listAddresses(params);
  }

  /**
   * Add addresses to pool (proxy to Processor)
   */
  async addAddressesToPool(addresses: Array<{
    organizationId: string;
    address: string;
    derivationIndex: number;
    protocol: 'evm' | 'tron' | 'solana';
    masterPublicKey: string;
  }>): Promise<{ added: number; skipped: number; errors: string[] }> {
    return await this.getProcessor().addAddressesToPool(addresses);
  }

  /**
   * Archive an address (soft delete)
   * Archived addresses cannot be allocated or bound until unarchived
   */
  async archiveAddress(organizationId: string, address: string): Promise<void> {
    return await this.getProcessor().archiveAddress(organizationId, address);
  }

  /**
   * Unarchive an address (restore to available state)
   */
  async unarchiveAddress(organizationId: string, address: string): Promise<void> {
    return await this.getProcessor().unarchiveAddress(organizationId, address);
  }

  // ==================== Configuration Query (Proxy to Processor) ====================

  /**
   * Get all chain configurations (proxy to Processor)
   * Returns chain configs from Processor's in-memory ConfigManager
   */
  async getChainConfigs(): Promise<Record<string, any>> {
    const processor = this.getProcessor();
    const configManager = processor.processorCore.getConfigManager();
    return configManager.getChainConfigs();
  }

  /**
   * Get specific chain configuration (proxy to Processor)
   */
  async getChainConfig(chainId: string): Promise<any | null> {
    const processor = this.getProcessor();
    const configManager = processor.processorCore.getConfigManager();
    return configManager.getChainConfig(chainId);
  }

  /**
   * Get all token configurations (proxy to Processor)
   * Returns token configs from Processor's in-memory ConfigManager
   */
  async getTokenConfigs(): Promise<Record<string, any>> {
    const processor = this.getProcessor();
    const configManager = processor.processorCore.getConfigManager();
    return configManager.getTokenConfigs();
  }

  /**
   * Get specific token configuration (proxy to Processor)
   */
  async getTokenConfig(symbol: string): Promise<any | null> {
    const processor = this.getProcessor();
    const configManager = processor.processorCore.getConfigManager();
    return configManager.getTokenConfig(symbol);
  }

  /**
   * Get chain sync status for all chains (proxy to Processor)
   */
  async getAllChainsSyncStatus(): Promise<Array<{
    chain: string;
    latest_processed_block: number;
    sync_status?: string;
    is_healthy?: boolean;
    behind_blocks?: number;
    updated_at: Date;
  }>> {
    return await this.getProcessor().getAllChainsSyncStatus();
  }

  /**
   * Get chain sync status for a specific chain (proxy to Processor)
   */
  async getChainSyncStatus(chainId: string): Promise<{
    chain: string;
    latest_processed_block: number;
    sync_status?: string;
    is_healthy?: boolean;
    behind_blocks?: number;
    updated_at: Date;
  } | null> {
    return await this.getProcessor().getChainSyncStatus(chainId);
  }

  // ==================== Redirect Management ====================

  /**
   * Load redirect configuration from database
   * Called during initialize() to populate RedirectService with persisted config
   */
  private async loadRedirectConfig(): Promise<void> {
    try {
      const defaultOrderSuccessUrl = await this.getSystemSetting('redirect.default_order_success_url');
      const defaultOrderCancelUrl = await this.getSystemSetting('redirect.default_order_cancel_url');
      const depositSuccessUrl = await this.getSystemSetting('redirect.deposit_success_url');

      this.redirectService.updateConfig({
        default_order_success_url: defaultOrderSuccessUrl?.value || null,
        default_order_cancel_url: defaultOrderCancelUrl?.value || null,
        deposit_success_url: depositSuccessUrl?.value || null,
      });
    } catch (error) {
      console.warn('Failed to load redirect config from database:', error);
      // Continue with default (empty) config
    }
  }

  /**
   * Get order redirect URL
   * Returns the redirect URL for an order based on its status
   */
  async getOrderRedirectUrl(orderId: string, success: boolean): Promise<string | null> {
    const order = await this.getOrder(orderId);
    if (!order) return null;

    return this.redirectService.getOrderRedirectUrl(order, success);
  }

  /**
   * Get deposit redirect URL
   * Returns the redirect URL for a completed deposit
   */
  async getDepositRedirectUrl(transferId: string): Promise<string | null> {
    // Get transfer info from processor
    const deposits = await this.listTransfers({ businessType: 'deposit' });
    const depositTransfer = deposits.transfers.find((t: any) => t.id === transferId);

    if (!depositTransfer) return null;

    // Only generate redirect URL for confirmed deposits
    if (!depositTransfer.is_confirmed) return null;

    const depositInfo = {
      id: transferId,
      deposit_reference: depositTransfer.deposit_reference,
      amount: depositTransfer.amount,
      token: depositTransfer.token,
      chain: depositTransfer.chain,
      status: 'completed', // Use 'completed' status for confirmed deposits
      confirmed_at: depositTransfer.confirmed_at,
    };

    const transferInfo = {
      transaction_hash: depositTransfer.transaction_hash,
    };

    return this.redirectService.getDepositRedirectUrl(depositInfo, transferInfo);
  }

  /**
   * Update redirect configuration
   * Persists to database and updates RedirectService
   */
  async updateRedirectConfig(config: Partial<RedirectConfig>): Promise<void> {
    // Persist to database
    if (config.default_order_success_url !== undefined) {
      await this.setSystemSetting(
        'redirect.default_order_success_url',
        config.default_order_success_url
      );
    }
    if (config.default_order_cancel_url !== undefined) {
      await this.setSystemSetting(
        'redirect.default_order_cancel_url',
        config.default_order_cancel_url
      );
    }
    if (config.deposit_success_url !== undefined) {
      await this.setSystemSetting(
        'redirect.deposit_success_url',
        config.deposit_success_url
      );
    }

    // Update RedirectService in-memory config
    this.redirectService.updateConfig(config);
  }

  /**
   * Get current redirect configuration
   */
  getRedirectConfig(): RedirectConfig {
    return this.redirectService.getConfig();
  }

  // ==================== Cleanup ====================

  async close(): Promise<void> {
    // Stop Processor if running
    await this.stopProcessor();
    // Close database connection
    await this.db.end();
  }
}
