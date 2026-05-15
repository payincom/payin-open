/**
 * Configuration Metadata Definitions
 * Defines all configurable items with their types, validation rules, and UI hints
 */

/**
 * Processor mapping strategies for config values
 * Defines how config_values are transformed into Processor config structure
 */
export type ProcessorMappingStrategy =
  | { type: 'simple'; path: string }                          // Simple path mapping with camelCase conversion
  | { type: 'chainFilter'; path: 'chains' }                   // Filter chains from defaults based on enabled list
  | { type: 'confirmations'; path: 'tokens' }                  // Merge confirmations into token configs
  | { type: 'monitorChains'; path: 'monitor.chains' }         // Pass through to monitor.chains array
  | { type: 'serviceSwitch'; path: string }                    // Map service.X.enabled → service.X boolean
  | { type: 'ignore' };                                        // Don't map to Processor config (Manager-only)

export interface ConfigMetadata {
  key: string;
  category?: 'business_rules' | 'address_pool' | 'service_switches' | 'chain_operations';
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'json';
  defaultValue: any;
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    itemType?: string;
    allowedValues?: string[];
  };
  uiHints?: {
    group?: string;
    order?: number;
    inputType?: string;
    placeholder?: string;
    helpText?: string;
    unit?: string;
  };
  editable?: boolean;

  /**
   * If true, this configuration can only be set at global level (not organization-level)
   * Used for system-wide performance or operational parameters that should not vary by organization
   */
  globalOnly?: boolean;

  /**
   * How this config value maps to Processor configuration structure
   * Declarative mapping to avoid hardcoded transformation logic
   */
}

/**
 * All configuration metadata definitions
 */
export const CONFIG_METADATA: ConfigMetadata[] = [
  // ========== Business Rules ==========
  {
    key: 'orders.payment_window_minutes',
    category: 'business_rules',
    displayName: 'Order Payment Window',
    description: 'Default payment window time for orders (minutes)',
    type: 'number',
    defaultValue: 10,
    validationRules: { min: 1, max: 60 },
    uiHints: {
      group: 'Order Timing',
      order: 1,
      inputType: 'number',
      helpText: 'Orders unpaid after this time will enter grace period',
      unit: 'minutes'
    },
  },
  {
    key: 'orders.grace_period_minutes',
    category: 'business_rules',
    displayName: 'Order Grace Period',
    description: 'Grace period after payment window ends (minutes)',
    type: 'number',
    defaultValue: 5,
    validationRules: { min: 0, max: 30 },
    uiHints: {
      group: 'Order Timing',
      order: 2,
      inputType: 'number',
      helpText: 'Additional time for pending transactions to confirm',
      unit: 'minutes'
    },
  },
  {
    key: 'orders.max_total_timeout_minutes',
    category: 'business_rules',
    displayName: 'Order Max Total Timeout',
    description: 'Maximum total timeout for orders (minutes)',
    type: 'number',
    defaultValue: 60,
    validationRules: { min: 5, max: 1440 },
    uiHints: {
      group: 'Order Timing',
      order: 3,
      inputType: 'number',
      helpText: 'Payment window + grace period should not exceed this',
      unit: 'minutes'
    },
  },

  // ========== Address Pool ==========
  {
    key: 'address_pool.cooldown_minutes',
    category: 'address_pool',
    displayName: 'Address Cooldown Time',
    description: 'Cooldown time after address is released (minutes)',
    type: 'number',
    defaultValue: 30,
    validationRules: { min: 0, max: 1440 },
    uiHints: {
      group: 'Address Pool',
      order: 1,
      inputType: 'number',
      helpText: 'Addresses cannot be reused until cooldown expires',
      unit: 'minutes'
    },
  },

  // ========== Chain and Token configurations moved to YAML ==========
  // chains.enabled, tokens.enabled, confirmations.* are now managed in processor/config/default.yaml
  // This simplifies database schema and provides single source of truth for technical configurations

  // ========== Service Switches ==========
  {
    key: 'services.orders_enabled',
    category: 'service_switches',
    displayName: 'Order Service Enabled',
    description: 'Enable or disable order payment service',
    type: 'boolean',
    defaultValue: true,
    uiHints: {
      group: 'Services',
      order: 1,
      inputType: 'switch',
      helpText: 'When disabled, new order creation requests will be rejected'
    },
  },
  {
    key: 'services.deposits_enabled',
    category: 'service_switches',
    displayName: 'Deposit Service Enabled',
    description: 'Enable or disable user deposit service',
    type: 'boolean',
    defaultValue: true,
    uiHints: {
      group: 'Services',
      order: 2,
      inputType: 'switch',
      helpText: 'When disabled, new deposit binding requests will be rejected'
    },
  },
  {
    key: 'delayed_confirmation.check_interval',
    category: 'service_switches',
    displayName: 'Delayed Confirmation Check Interval',
    description: 'Interval to check pending confirmations (seconds)',
    type: 'number',
    defaultValue: 30,
    validationRules: { min: 1, max: 300 },
    uiHints: {
      group: 'Services',
      order: 3,
      inputType: 'number',
      helpText: 'System-wide setting: How often to check for confirmed transactions (applies to all organizations)',
      unit: 'seconds'
    },
    globalOnly: true, // This is a system-level performance parameter
  },

  // ========== Redirect URLs ==========
  {
    key: 'redirect.default_order_success_url',
    category: 'service_switches',
    displayName: 'Default Order Success Redirect URL',
    description: 'Default redirect URL when order is completed successfully',
    type: 'string',
    defaultValue: null,
    validationRules: {
      pattern: '^https?://.+',
    },
    uiHints: {
      group: 'Redirect',
      order: 10,
      inputType: 'url',
      placeholder: 'https://merchant.com/payment/success',
      helpText: 'Users will see "Return to Merchant" button when order completes'
    },
  },
  {
    key: 'redirect.default_order_cancel_url',
    category: 'service_switches',
    displayName: 'Default Order Cancel Redirect URL',
    description: 'Default redirect URL when order expires or fails',
    type: 'string',
    defaultValue: null,
    validationRules: {
      pattern: '^https?://.+',
    },
    uiHints: {
      group: 'Redirect',
      order: 11,
      inputType: 'url',
      placeholder: 'https://merchant.com/payment/cancel',
      helpText: 'Users will see "Return to Merchant" button when order expires'
    },
  },
  {
    key: 'redirect.deposit_success_url',
    category: 'service_switches',
    displayName: 'Deposit Success Redirect URL',
    description: 'Redirect URL when deposit is confirmed (global only, no per-deposit override)',
    type: 'string',
    defaultValue: null,
    validationRules: {
      pattern: '^https?://.+',
    },
    uiHints: {
      group: 'Redirect',
      order: 12,
      inputType: 'url',
      placeholder: 'https://game.com/wallet/recharged',
      helpText: 'Users will see "Return to Application" button when deposit confirms'
    },
  },
];

/**
 * Get config metadata by key
 */
export function getConfigMetadata(key: string): ConfigMetadata | undefined {
  return CONFIG_METADATA.find(m => m.key === key);
}
