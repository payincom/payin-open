/**
 * Entity layer definitions for validation
 *
 * Layer 0: System protection (is_builtin resources)
 * Layer 1: Immutable after creation (identity & capabilities)
 * Layer 2: Mutable but bounded (operational parameters with range limits)
 * Layer 3: Freely mutable (display & preferences)
 */

import type { LayerDefinition, ValidationRule } from './types.js';

export const ENTITY_LAYERS: Record<string, LayerDefinition> = {
  /**
   * RPC Providers
   */
  rpc_provider: {
    layer1_immutable: [
      'provider_name',        // Primary key
      'is_builtin',           // Builtin flag (determines if DB config is used)
      'supported_chains',     // Custom provider required, builtin must be NULL
      'default_settings',     // Custom provider required, builtin must be NULL
      'api_key_required',     // Authentication requirement
    ],
    layer2_bounded: [],       // RPC provider itself has no Layer 2 fields
    layer3_free: [
      'display_name',
      'provider_type',
      'homepage_url',
      'documentation_url',
      'api_key',
      'is_active',
    ],
    protected_if_builtin: true,
  },

  /**
   * RPC Chain Configurations
   */
  rpc_chain_config: {
    layer1_immutable: [
      'chain_id',
      'provider_name',
    ],
    layer2_bounded: [
      'timeout_ms',              // Range: 1000-60000
      'max_requests_per_second', // Range: 1-1000
    ],
    layer3_free: [
      'priority',
      'strategy',
      'custom_endpoint_url',
      'health_check_config',
      'retry_config',
      'is_enabled',
    ],
    protected_if_builtin: false,
  },

  /**
   * Chains
   */
  chain: {
    layer1_immutable: [
      'chain_id',             // Primary key
      'protocol',             // evm/tron - determines technical implementation
      'network',              // mainnet/testnet - determines asset reality
      'is_builtin',           // Builtin flag
    ],
    layer2_bounded: [],       // No operational parameters
    layer3_free: [
      'name',
      'display_order',
      'metadata',
      'is_enabled',
    ],
    protected_if_builtin: true,
  },

  /**
   * Tokens
   */
  token: {
    layer1_immutable: [
      'symbol',               // Primary key
      'decimals',             // Smart contract property
      'is_builtin',           // Builtin flag
    ],
    layer2_bounded: [],       // No operational parameters
    layer3_free: [
      'name',
      'icon_url',
      'metadata',
      'is_active',
    ],
    protected_if_builtin: true,
  },

  /**
   * Token-Chain Mappings
   */
  token_chain: {
    layer1_immutable: [
      'token_id',             // Or symbol (converted to token_id)
      'chain_id',
      'contract_address',     // Blockchain fact
    ],
    layer2_bounded: [
      'confirmations',        // Range: 1-100
    ],
    layer3_free: [
      'is_active',
      'verified',
    ],
    protected_if_builtin: false,
  },

  /**
   * Operational Configurations (processor_configs)
   */
  operational_config: {
    layer1_immutable: [],     // No immutable fields
    layer2_bounded: [
      // Orders config
      'maintenanceIntervalMs',        // 1000-60000
      'maxTotalTimeoutMinutes',       // 5-120
      'defaultGracePeriodMinutes',    // 0-30
      'defaultPaymentWindowMinutes',  // 1-60

      // Deposits config
      'maxPoolSize',                  // 10-1000
      'lowPoolThreshold',             // 1-maxPoolSize
      'defaultCooldownMinutes',       // 0-60
      'maxImportBatchSize',           // 1-1000

      // DelayedConfirmation config
      'maxRetries',                   // 0-10
      'checkInterval',                // 100-60000
      'maxPendingTime',               // 1000-600000
      'maxPendingTransactions',       // 1-1000
    ],
    layer3_free: [
      'validateDerivationPath',
      'enabled',
      'orders',   // services
      'deposits', // services
    ],
    protected_if_builtin: false,
  },
};

/**
 * Layer 2 validation rules
 */
export const LAYER2_RULES: Record<string, ValidationRule[]> = {
  rpc_chain_config: [
    {
      field: 'timeout_ms',
      min: 1000,
      max: 60000,
      recommended: { min: 3000, max: 10000 },
      message: 'timeout_ms should be between 1000-60000ms (recommended: 3000-10000ms)',
    },
    {
      field: 'max_requests_per_second',
      min: 1,
      max: 1000,
      recommended: { min: 5, max: 100 },
      message: 'max_requests_per_second should be between 1-1000 (recommended: 5-100)',
    },
  ],

  token_chain: [
    {
      field: 'confirmations',
      min: 1,
      max: 100,
      recommended: { min: 3, max: 50 },
      message: 'confirmations should be between 1-100 (recommended: 3-50)',
    },
  ],

  operational_config: [
    // Orders
    {
      field: 'maintenanceIntervalMs',
      min: 1000,
      max: 60000,
      recommended: { min: 3000, max: 10000 },
      message: 'maintenanceIntervalMs should be between 1000-60000ms',
    },
    {
      field: 'maxTotalTimeoutMinutes',
      min: 5,
      max: 120,
      recommended: { min: 15, max: 60 },
      message: 'maxTotalTimeoutMinutes should be between 5-120 minutes',
    },
    {
      field: 'defaultGracePeriodMinutes',
      min: 0,
      max: 30,
      recommended: { min: 1, max: 10 },
      message: 'defaultGracePeriodMinutes should be between 0-30 minutes',
    },
    {
      field: 'defaultPaymentWindowMinutes',
      min: 1,
      max: 60,
      recommended: { min: 5, max: 30 },
      message: 'defaultPaymentWindowMinutes should be between 1-60 minutes',
    },

    // Deposits
    {
      field: 'maxPoolSize',
      min: 10,
      max: 1000,
      recommended: { min: 50, max: 500 },
      message: 'maxPoolSize should be between 10-1000',
    },
    {
      field: 'lowPoolThreshold',
      min: 1,
      max: 1000,  // Will be validated against maxPoolSize dynamically
      message: 'lowPoolThreshold should be between 1 and maxPoolSize',
    },
    {
      field: 'defaultCooldownMinutes',
      min: 0,
      max: 60,
      recommended: { min: 1, max: 30 },
      message: 'defaultCooldownMinutes should be between 0-60 minutes',
    },
    {
      field: 'maxImportBatchSize',
      min: 1,
      max: 1000,
      recommended: { min: 10, max: 100 },
      message: 'maxImportBatchSize should be between 1-1000',
    },

    // DelayedConfirmation
    {
      field: 'maxRetries',
      min: 0,
      max: 10,
      recommended: { min: 2, max: 5 },
      message: 'maxRetries should be between 0-10',
    },
    {
      field: 'checkInterval',
      min: 100,
      max: 60000,
      recommended: { min: 1000, max: 5000 },
      message: 'checkInterval should be between 100-60000ms',
    },
    {
      field: 'maxPendingTime',
      min: 1000,
      max: 600000,
      recommended: { min: 30000, max: 180000 },
      message: 'maxPendingTime should be between 1000-600000ms',
    },
    {
      field: 'maxPendingTransactions',
      min: 1,
      max: 1000,
      recommended: { min: 50, max: 500 },
      message: 'maxPendingTransactions should be between 1-1000',
    },
  ],
};
