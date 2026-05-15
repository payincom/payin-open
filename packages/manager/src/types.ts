/**
 * Core types for Configuration Management System
 */

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  layer: 0 | 1 | 2 | 3;  // 0 = system protection (builtin), 1 = immutable, 2 = bounded, 3 = free
  type: 'immutable' | 'out_of_range' | 'protected' | 'missing_required' | 'has_references' | 'invalid_value';
  message: string;
  current?: any;
  attempted?: any;
  recommended?: any;
  solution?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

/**
 * Operation context
 */
export interface OperationContext {
  /** Bypass validation (for testing and internal operations) */
  bypassValidation?: boolean;
  /** Reason for the change (optional, for audit log) */
  reason?: string;
}

/**
 * Layer definition for an entity type
 */
export interface LayerDefinition {
  /** Layer 1: Immutable fields after creation (identity & capabilities) */
  layer1_immutable: string[];
  /** Layer 2: Mutable but bounded fields (operational parameters) */
  layer2_bounded: string[];
  /** Layer 3: Freely mutable fields (display & preferences) */
  layer3_free: string[];
  /** Whether builtin resources (is_builtin = true) are protected from deletion */
  protected_if_builtin: boolean;
}

/**
 * Validation rule for Layer 2 fields
 */
export interface ValidationRule {
  field: string;
  min?: number;
  max?: number;
  recommended?: { min: number; max: number };
  pattern?: RegExp;
  message?: string;
  validator?: (value: any) => boolean;
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  chain_id: string;
  protocol: 'evm' | 'tron' | 'solana';
  network: 'mainnet' | 'testnet';
  name: string;
  is_builtin?: boolean;
  is_enabled?: boolean;
  display_order?: number;
  metadata?: Record<string, any>;
}

/**
 * Token configuration
 */
export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  is_builtin?: boolean;
  is_active?: boolean;
  icon_url?: string;
  metadata?: Record<string, any>;
}

/**
 * Token-Chain mapping
 */
export interface TokenChainConfig {
  token_id?: string;  // Symbol (string) - maps to processor_tokens.symbol
  symbol?: string;  // Alternative to token_id for easier API usage
  chain_id: string;
  contract_address: string;
  confirmations: number;
  is_active?: boolean;
  verified?: boolean;
}

/**
 * RPC Provider configuration
 */
export interface RPCProviderConfig {
  provider_name: string;
  display_name: string;
  provider_type: 'commercial' | 'public' | 'custom';
  is_builtin?: boolean;
  api_key_required?: boolean;
  api_key?: string;
  homepage_url?: string;
  documentation_url?: string;

  // For custom providers only (builtin providers: these should be NULL)
  supported_chains?: string[] | null;
  default_settings?: Record<string, any> | null;

  is_active?: boolean;
}

/**
 * RPC Chain-specific configuration
 */
export interface RPCChainConfig {
  chain_id: string;
  provider_name: string;

  // NULL = use Monitor defaults
  timeout_ms?: number | null;
  max_requests_per_second?: number | null;
  health_check_config?: Record<string, any> | null;
  retry_config?: Record<string, any> | null;

  priority?: number;
  strategy?: 'round_robin' | 'failover' | 'fastest' | null;
  custom_endpoint_url?: string | null;
  is_enabled?: boolean;
}

/**
 * Operational configuration (processor_configs)
 */
export interface OperationalConfig {
  category: 'orders' | 'deposits' | 'delayedConfirmation' | 'services';
  config_data: Record<string, any>;
}

// ConfigHistory and SystemSettingHistory removed
// Audit logging is now handled by Auth module's audit_logs table

/**
 * System setting (business-level configuration)
 *
 * Note: description is stored in config_metadata table, not duplicated here.
 * To get description, JOIN with config_metadata table.
 * Audit trail is stored in audit_logs table managed by Auth module.
 */
export interface SystemSetting {
  key: string;
  value: any;
  category: 'business_rules' | 'address_pool' | 'chain_operations' | 'service_switches';
  editable_via_ui?: boolean;
  updated_at?: Date;
  // updated_by removed - audit handled by Auth module
}

/**
 * Payment Link status values
 */
export type PaymentLinkStatus = 'draft' | 'published';

/**
 * Payment Link amount type values
 */
export type PaymentLinkAmountType = 'fixed' | 'user_input';

/**
 * Payment Link theme values
 */
export type PaymentLinkTheme = 'dark' | 'light';

/**
 * Payment Link order status values
 */
export type PaymentLinkOrderStatus = 'pending' | 'completed' | 'expired' | 'canceled';

/**
 * Payment Link currency configuration
 */
export interface PaymentLinkCurrency {
  id: string;
  paymentlink_id: string;
  currency: string;
  chain_options: string[];
  amount?: string | null;
  is_primary: boolean;
  metadata?: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Payment Link entity (multi-currency support)
 */
export interface PaymentLink {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  amount: string;
  currency?: string | null; // For backward compatibility (legacy field)
  status: PaymentLinkStatus;
  is_archived: boolean;
  slug?: string | null;
  chain_options?: string[] | null; // For backward compatibility (legacy field)
  currencies: PaymentLinkCurrency[]; // Multi-currency configuration
  inventory_total?: number | null;
  inventory_reserved: number;
  inventory_sold: number;
  metadata?: Record<string, any> | null;
  expires_at?: Date | null;
  published_at?: Date | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
  amount_type: PaymentLinkAmountType;
  cta_text?: string | null;
  theme: PaymentLinkTheme;
}

/**
 * Input type for creating/updating payment link
 */
export interface CreatePaymentLinkInput {
  title: string;
  description?: string;
  amount: string | number;
  currencies: Array<{
    currency: string;
    chain_options: string[];
    amount?: string | number;
    is_primary?: boolean;
    metadata?: Record<string, any>;
  }>;
  inventory_total?: number;
  metadata?: Record<string, any>;
  expires_at?: Date;
  amount_type?: PaymentLinkAmountType;
  cta_text?: string;
  theme?: PaymentLinkTheme;
}

/**
 * Input type for updating payment link currencies
 */
export interface UpdatePaymentLinkCurrenciesInput {
  currencies: Array<{
    currency: string;
    chain_options: string[];
    amount?: string | number;
    is_primary?: boolean;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Checkout response for public API
 */
export interface PaymentLinkCheckoutResponse {
  id: string;
  title: string;
  description: string | null | undefined;
  amount: string;
  currencies: Array<{
    currency: string;
    amount: string;
    chains: string[];
    is_primary: boolean;
  }>;
  expires_at: Date | null | undefined;
  amount_type: PaymentLinkAmountType;
  cta_text?: string | null;
  theme: PaymentLinkTheme;
}

/**
 * Input type for creating payment link order
 */
export interface CreatePaymentLinkOrderInput {
  email: string;
  currency: string;
  chainId: string;
}

/**
 * Payment Link order entity
 */
export interface PaymentLinkOrder {
  id: string;
  paymentlink_id: string;
  organization_id: string;
  order_id?: string | null;
  buyer_email: string;
  status: PaymentLinkOrderStatus;
  selected_chain: string;
  selected_currency: string;
  amount: string;
  metadata?: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date | null;
}
