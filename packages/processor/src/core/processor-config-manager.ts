/**
 * Processor Configuration Manager
 * Handles all configuration management and validation for the Processor
 */

import { ValidationUtils, ValidationError, type ValidationResult } from '../shared/validation-utils.js';
import type { MonitorConfig } from '@payin/monitor';
import type { TokenConfig } from '../config/token-config.js';
import type { Protocol } from '../config/chain-config.js';
import { mergeTokenConfigs } from './config-utils.js';

/**
 * Chain configuration from YAML
 */
export interface ChainConfigYAML {
  protocol: Protocol;
  name: string;
  network: 'mainnet' | 'testnet';
}

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  maxConnections?: number;
  ssl?: boolean | object;
}

export interface ServiceConfig {
  orders?: boolean;
  deposits?: boolean;
}

export interface OrderConfig {
  defaultPaymentWindowMinutes?: number;
  defaultGracePeriodMinutes?: number;
  maxTotalTimeoutMinutes?: number;
  maintenanceIntervalMs?: number;
}

export interface DelayedConfirmationConfig {
  enabled?: boolean;
  checkInterval?: number;
  maxPendingTime?: number;
  maxPendingTransactions?: number;
  maxRetries?: number;
}

export interface AddressPoolManagementConfig {
  defaultCooldownMinutes?: number;
  maxPoolSize?: number;
  // Match the expected interface from token-config
  inventory?: any;
  allocation?: any;
  cleanup?: any;
  monitoring?: any;
}

export interface AddressImportConfig {
  validateDerivationPath?: boolean;
  maxImportBatchSize?: number;
}

export interface DepositConfig {
  poolManagement?: AddressPoolManagementConfig;
  importValidation?: AddressImportConfig;
}

/**
 * Complete processor configuration interface
 */
export interface ProcessorConfig {
  database?: DatabaseConfig;
  monitor?: MonitorConfig;
  skipMonitorRecovery?: boolean;
  services?: ServiceConfig;
  orders?: OrderConfig;
  delayedConfirmation?: DelayedConfirmationConfig;
  chains?: {
    [chainId: string]: ChainConfigYAML;
  };
  tokens?: {
    [tokenSymbol: string]: TokenConfig;
  };
  deposits?: DepositConfig;
  rpc?: any;  // RPC configuration to override Monitor's settings
}

/**
 * Get default database configuration from environment variables
 * This function is called at runtime to ensure environment variables are properly loaded
 */
function getDefaultDatabaseConfig(): Required<DatabaseConfig> {
  return {
    connectionString: process.env.DATABASE_URL ||
                     process.env.PROCESSOR_DB_URL ||
                     '',  // Empty string requires explicit configuration
    host: process.env.PROCESSOR_DB_HOST || 'localhost',
    port: parseInt(process.env.PROCESSOR_DB_PORT || '5432'),
    database: process.env.PROCESSOR_DB_NAME || 'payin',
    username: process.env.PROCESSOR_DB_USER || 'postgres',
    password: process.env.PROCESSOR_DB_PASSWORD || '',
    maxConnections: parseInt(process.env.PROCESSOR_DB_MAX_CONNECTIONS || '10'),
    ssl: process.env.PROCESSOR_DB_SSL === 'true' || false
  };
}

const DEFAULT_SERVICE_CONFIG: Required<ServiceConfig> = {
  orders: true,
  deposits: true
};

const DEFAULT_ORDER_CONFIG: Required<OrderConfig> = {
  defaultPaymentWindowMinutes: 10,
  defaultGracePeriodMinutes: 5,
  maxTotalTimeoutMinutes: 60,
  maintenanceIntervalMs: 60000
};

const DEFAULT_DELAYED_CONFIRMATION_CONFIG: Required<DelayedConfirmationConfig> = {
  enabled: true,
  checkInterval: 30000,
  maxPendingTime: 600000,
  maxPendingTransactions: 1000,
  maxRetries: 3
};

const DEFAULT_DEPOSIT_CONFIG: Required<DepositConfig> = {
  poolManagement: {
    defaultCooldownMinutes: 30,
    maxPoolSize: 10000
  },
  importValidation: {
    validateDerivationPath: true,
    maxImportBatchSize: 1000
  }
};

/**
 * Configuration manager for the Processor
 */
export class ProcessorConfigManager {
  private config: ProcessorConfig;
  private mergedTokens: Record<string, TokenConfig>;
  private mergedChains: Record<string, ChainConfigYAML>;

  constructor(config: ProcessorConfig) {
    this.validateConfig(config);
    this.config = this.mergeWithDefaults(config);
    this.mergedTokens = mergeTokenConfigs(this.config.tokens);
    this.mergedChains = this.config.chains || {};
  }

  /**
   * Get the complete merged configuration
   */
  getConfig(): ProcessorConfig {
    return { ...this.config };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): Required<DatabaseConfig> {
    return { ...this.config.database } as Required<DatabaseConfig>;
  }

  /**
   * Get monitor configuration
   */
  getMonitorConfig(): MonitorConfig | undefined {
    return this.config.monitor ? { ...this.config.monitor } : undefined;
  }

  /**
   * Get service configuration
   */
  getServiceConfig(): Required<ServiceConfig> {
    return { ...this.config.services } as Required<ServiceConfig>;
  }

  /**
   * Get order configuration
   */
  getOrderConfig(): Required<OrderConfig> {
    return { ...this.config.orders } as Required<OrderConfig>;
  }

  /**
   * Get delayed confirmation configuration
   */
  getDelayedConfirmationConfig(): Required<DelayedConfirmationConfig> {
    return { ...this.config.delayedConfirmation } as Required<DelayedConfirmationConfig>;
  }

  /**
   * Get deposit configuration
   */
  getDepositConfig(): Required<DepositConfig> {
    return { ...this.config.deposits } as Required<DepositConfig>;
  }

  /**
   * Get merged token configurations
   */
  getTokenConfigs(): Record<string, TokenConfig> {
    return { ...this.mergedTokens };
  }

  /**
   * Get token configuration by symbol
   */
  getTokenConfig(symbol: string): TokenConfig | undefined {
    return this.mergedTokens[symbol];
  }

  /**
   * Get merged chain configurations
   */
  getChainConfigs(): Record<string, ChainConfigYAML> {
    return { ...this.mergedChains };
  }

  /**
   * Get chain configuration by ID
   */
  getChainConfig(chainId: string): ChainConfigYAML | undefined {
    return this.mergedChains[chainId];
  }

  /**
   * Check if monitor recovery should be skipped
   */
  shouldSkipMonitorRecovery(): boolean {
    return Boolean(this.config.skipMonitorRecovery);
  }

  /**
   * Validate the configuration
   */
  private validateConfig(config: ProcessorConfig): void {
    const validationResults: ValidationResult[] = [];

    // Validate database config if provided
    if (config.database) {
      validationResults.push(this.validateDatabaseConfig(config.database));
    }

    // Validate order config if provided
    if (config.orders) {
      validationResults.push(this.validateOrderConfig(config.orders));
    }

    // Validate delayed confirmation config if provided
    if (config.delayedConfirmation) {
      validationResults.push(this.validateDelayedConfirmationConfig(config.delayedConfirmation));
    }

    // Combine all validation results
    const combinedResult = ValidationUtils.combineValidationResults(validationResults);

    if (!combinedResult.isValid) {
      throw new ValidationError(
        `Configuration validation failed: ${combinedResult.errors.join(', ')}`
      );
    }
  }

  /**
   * Validate database configuration
   */
  private validateDatabaseConfig(config: DatabaseConfig): ValidationResult {
    const errors: string[] = [];

    // If connection string is provided, it should be valid
    if (config.connectionString) {
      const connResult = ValidationUtils.validateRequired(config.connectionString, 'database.connectionString');
      errors.push(...connResult.errors);
    }

    // If individual connection params are provided, validate them
    if (!config.connectionString) {
      if (config.port && (config.port < 1 || config.port > 65535)) {
        errors.push('database.port must be between 1 and 65535');
      }

      if (config.maxConnections && config.maxConnections < 1) {
        errors.push('database.maxConnections must be at least 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate order configuration
   */
  private validateOrderConfig(config: OrderConfig): ValidationResult {
    const errors: string[] = [];

    if (config.defaultPaymentWindowMinutes && config.defaultPaymentWindowMinutes < 1) {
      errors.push('orders.defaultPaymentWindowMinutes must be at least 1');
    }

    if (config.defaultGracePeriodMinutes && config.defaultGracePeriodMinutes < 0) {
      errors.push('orders.defaultGracePeriodMinutes cannot be negative');
    }

    if (config.maxTotalTimeoutMinutes && config.maxTotalTimeoutMinutes < 1) {
      errors.push('orders.maxTotalTimeoutMinutes must be at least 1');
    }

    if (config.maintenanceIntervalMs && config.maintenanceIntervalMs < 1000) {
      errors.push('orders.maintenanceIntervalMs must be at least 1000');
    }

    // Validate relationships between timeout values
    if (config.defaultPaymentWindowMinutes && config.defaultGracePeriodMinutes && config.maxTotalTimeoutMinutes) {
      const total = config.defaultPaymentWindowMinutes + config.defaultGracePeriodMinutes;
      if (total > config.maxTotalTimeoutMinutes) {
        errors.push('sum of defaultPaymentWindowMinutes and defaultGracePeriodMinutes cannot exceed maxTotalTimeoutMinutes');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate delayed confirmation configuration
   */
  private validateDelayedConfirmationConfig(config: DelayedConfirmationConfig): ValidationResult {
    const errors: string[] = [];

    if (config.checkInterval && config.checkInterval < 1000) {
      errors.push('delayedConfirmation.checkInterval must be at least 1000ms');
    }

    if (config.maxPendingTime && config.maxPendingTime < 60000) {
      errors.push('delayedConfirmation.maxPendingTime must be at least 60000ms');
    }

    if (config.maxPendingTransactions && config.maxPendingTransactions < 1) {
      errors.push('delayedConfirmation.maxPendingTransactions must be at least 1');
    }

    if (config.maxRetries && config.maxRetries < 0) {
      errors.push('delayedConfirmation.maxRetries cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: ProcessorConfig): ProcessorConfig {
    // Handle database configuration with connectionString logic
    const DEFAULT_DATABASE_CONFIG = getDefaultDatabaseConfig();
    const dbConfig = {
      ...DEFAULT_DATABASE_CONFIG,
      ...config.database
    };

    // If no connectionString in environment or config, and host is explicitly provided in config, build connectionString
    if (!dbConfig.connectionString && config.database?.host) {
      dbConfig.connectionString = `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
    }

    return {
      ...config,
      database: dbConfig,
      services: {
        ...DEFAULT_SERVICE_CONFIG,
        ...config.services
      },
      orders: {
        ...DEFAULT_ORDER_CONFIG,
        ...config.orders
      },
      delayedConfirmation: {
        ...DEFAULT_DELAYED_CONFIRMATION_CONFIG,
        ...config.delayedConfirmation
      },
      deposits: {
        ...DEFAULT_DEPOSIT_CONFIG,
        ...config.deposits
      },
      monitor: config.monitor ? {
        chains: [],
        ...config.monitor
      } : undefined
    };
  }
}