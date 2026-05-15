/**
 * Database schema definitions for Configuration Management System
 */

/**
 * Schema for processor_chains table
 * Stores blockchain network configurations
 */
export const SCHEMA_CHAINS = `
CREATE TABLE IF NOT EXISTS processor_chains (
  chain_id VARCHAR(50) PRIMARY KEY,
  protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('evm', 'tron')),
  network VARCHAR(20) NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  name VARCHAR(100) NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chains_protocol_network ON processor_chains(protocol, network);
CREATE INDEX IF NOT EXISTS idx_chains_enabled ON processor_chains(is_enabled) WHERE is_enabled = true;
`;

/**
 * Schema for processor_tokens table
 * Stores token configurations (USDT, USDC, etc.)
 */
export const SCHEMA_TOKENS = `
CREATE TABLE IF NOT EXISTS processor_tokens (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  decimals INTEGER NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_active ON processor_tokens(is_active) WHERE is_active = true;
`;

/**
 * Schema for processor_token_chains table
 * Maps tokens to specific chains with contract addresses
 */
export const SCHEMA_TOKEN_CHAINS = `
CREATE TABLE IF NOT EXISTS processor_token_chains (
  token_id VARCHAR(20) NOT NULL REFERENCES processor_tokens(symbol) ON DELETE CASCADE,
  chain_id VARCHAR(50) NOT NULL REFERENCES processor_chains(chain_id) ON DELETE CASCADE,
  contract_address VARCHAR(255) NOT NULL,
  confirmations INTEGER NOT NULL DEFAULT 3 CHECK (confirmations >= 1 AND confirmations <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_token_chains_chain ON processor_token_chains(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_chains_active ON processor_token_chains(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_token_chains_contract ON processor_token_chains(contract_address);
`;

/**
 * Schema for processor_rpc_providers table
 * Stores RPC provider configurations (Alchemy, Infura, etc.)
 *
 * Design notes:
 * - provider_name is natural primary key
 * - is_builtin = true: uses Monitor's hardcoded template, supported_chains/default_settings must be NULL
 * - is_builtin = false: custom provider, supported_chains/default_settings stored in DB
 */
export const SCHEMA_RPC_PROVIDERS = `
CREATE TABLE IF NOT EXISTS processor_rpc_providers (
  provider_name VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('commercial', 'community', 'custom', 'private')),
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  api_key_required BOOLEAN NOT NULL DEFAULT false,
  api_key TEXT,
  homepage_url TEXT,
  documentation_url TEXT,
  supported_chains TEXT[] CHECK (
    (is_builtin = true AND supported_chains IS NULL) OR
    (is_builtin = false)
  ),
  default_settings JSONB CHECK (
    (is_builtin = true AND default_settings IS NULL) OR
    (is_builtin = false)
  ),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpc_providers_type ON processor_rpc_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_rpc_providers_active ON processor_rpc_providers(is_active) WHERE is_active = true;
`;

/**
 * Schema for processor_rpc_chain_configs table
 * Chain-specific RPC configurations
 *
 * Design notes:
 * - NULL values mean "use Monitor's internal defaults"
 * - Only non-NULL values override Monitor defaults
 */
export const SCHEMA_RPC_CHAIN_CONFIGS = `
CREATE TABLE IF NOT EXISTS processor_rpc_chain_configs (
  chain_id VARCHAR(50) NOT NULL REFERENCES processor_chains(chain_id) ON DELETE CASCADE,
  provider_name VARCHAR(50) NOT NULL REFERENCES processor_rpc_providers(provider_name) ON DELETE CASCADE,
  timeout_ms INTEGER CHECK (timeout_ms IS NULL OR (timeout_ms >= 1000 AND timeout_ms <= 60000)),
  max_requests_per_second INTEGER CHECK (max_requests_per_second IS NULL OR (max_requests_per_second >= 1 AND max_requests_per_second <= 1000)),
  health_check_config JSONB,
  retry_config JSONB,
  priority INTEGER NOT NULL DEFAULT 100,
  strategy VARCHAR(20) CHECK (strategy IS NULL OR strategy IN ('round_robin', 'failover', 'fastest')),
  custom_endpoint_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_rpc_chain_configs_provider ON processor_rpc_chain_configs(provider_name);
CREATE INDEX IF NOT EXISTS idx_rpc_chain_configs_enabled ON processor_rpc_chain_configs(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_rpc_chain_configs_priority ON processor_rpc_chain_configs(chain_id, priority) WHERE is_enabled = true;
`;

/**
 * Schema for processor_configs table
 * Operational configuration parameters
 */
export const SCHEMA_CONFIGS = `
CREATE TABLE IF NOT EXISTS processor_configs (
  category VARCHAR(50) PRIMARY KEY CHECK (category IN ('orders', 'deposits', 'delayedConfirmation', 'services')),
  config_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
`;

/**
 * Schema for config_metadata table
 * Metadata definitions for all configurable items
 * Used to generate UI forms and validate configuration values
 */
export const SCHEMA_CONFIG_METADATA = `
CREATE TABLE IF NOT EXISTS config_metadata (
  key VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'string', 'number', 'boolean', 'array', 'json'
  )),
  default_value JSONB NOT NULL,
  validation_rules JSONB,
  ui_hints JSONB,
  editable BOOLEAN NOT NULL DEFAULT true,
  global_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_metadata_editable ON config_metadata(editable) WHERE editable = true;
`;

/**
 * Schema for config_values table
 * Business-level configuration managed via Manager UI
 * These settings can be modified at runtime and require processor restart to take effect
 *
 * Multi-tenant support:
 * - organization_id = NULL: Global configuration (fallback for all organizations)
 * - organization_id = UUID: Organization-specific configuration (overrides global)
 *
 * Design notes:
 * - Uses surrogate key (id) as primary key because PostgreSQL primary keys cannot contain NULL
 * - UNIQUE constraint on (key, organization_id) ensures configuration uniqueness
 * - NULL is allowed in UNIQUE constraints, enabling global configurations
 *
 * Note: description is stored in config_metadata table, not duplicated here
 */
export const SCHEMA_CONFIG_VALUES = `
CREATE TABLE IF NOT EXISTS config_values (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  organization_id UUID DEFAULT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  editable_via_ui BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- updated_by removed - audit handled by Auth module

  -- Audit fields
  CONSTRAINT valid_key_format CHECK (key ~ '^[a-z_]+(\.[a-z_]+)*$')
);

-- UNIQUE constraint for business logic (allows NULL in organization_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_values_unique_key_org ON config_values(key, organization_id);
-- Index for organization-specific queries
CREATE INDEX IF NOT EXISTS idx_config_values_organization ON config_values(organization_id);
-- Index for global configuration queries (where organization_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_config_values_global ON config_values(key) WHERE organization_id IS NULL;
-- Index for editable configs
CREATE INDEX IF NOT EXISTS idx_config_values_editable ON config_values(editable_via_ui) WHERE editable_via_ui = true;
`;

// config_history and processor_config_history tables removed
// Audit logging is now handled by Auth module's audit_logs table

/**
 * All schemas in creation order (respecting foreign key dependencies)
 *
 * Note: Manager only manages business configuration tables.
 * Technical configuration (chains, tokens, RPC) is managed via YAML files.
 * Audit logging is handled by Auth module (audit_logs table).
 */
export const SCHEMA_PAYMENTLINKS = `
CREATE TABLE IF NOT EXISTS paymentlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount NUMERIC(24, 6) NOT NULL,
  currency VARCHAR(20),
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published')),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  slug VARCHAR(120) UNIQUE,
  chain_options TEXT[],
  inventory_total INTEGER,
  inventory_reserved INTEGER NOT NULL DEFAULT 0,
  inventory_sold INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'user_input')),
  cta_text VARCHAR(100),
  theme VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  CONSTRAINT chk_paymentlinks_inventory_nonnegative CHECK (
    inventory_reserved >= 0 AND inventory_sold >= 0
  ),
  CONSTRAINT chk_paymentlinks_inventory_total CHECK (
    inventory_total IS NULL OR inventory_total >= 0
  ),
  CONSTRAINT chk_paymentlinks_inventory_consistency CHECK (
    inventory_total IS NULL OR inventory_total >= inventory_reserved + inventory_sold
  )
);

CREATE INDEX IF NOT EXISTS idx_paymentlinks_org ON paymentlinks(organization_id);
CREATE INDEX IF NOT EXISTS idx_paymentlinks_status ON paymentlinks(status) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_paymentlinks_archived ON paymentlinks(is_archived);
CREATE INDEX IF NOT EXISTS idx_paymentlinks_slug ON paymentlinks(slug) WHERE slug IS NOT NULL AND is_archived = false;
`;

/**
 * Schema for paymentlink_currencies table
 * Stores multi-currency configuration for payment links
 * Enables each payment link to support multiple currencies with independent chain options
 */
export const SCHEMA_PAYMENTLINK_CURRENCIES = `
CREATE TABLE IF NOT EXISTS paymentlink_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paymentlink_id UUID NOT NULL REFERENCES paymentlinks(id) ON DELETE CASCADE,
  currency VARCHAR(20) NOT NULL,
  chain_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  amount NUMERIC(24, 6),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(paymentlink_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_paymentlink_currencies_link ON paymentlink_currencies(paymentlink_id);
CREATE INDEX IF NOT EXISTS idx_paymentlink_currencies_primary ON paymentlink_currencies(paymentlink_id) WHERE is_primary = true;
`;

export const SCHEMA_PAYMENTLINK_ORDERS = `
CREATE TABLE IF NOT EXISTS paymentlink_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paymentlink_id UUID NOT NULL REFERENCES paymentlinks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID,
  buyer_email VARCHAR(320) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'canceled')),
  selected_chain VARCHAR(50) NOT NULL,
  selected_currency VARCHAR(20) NOT NULL,
  amount NUMERIC(24, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paymentlink_orders_link ON paymentlink_orders(paymentlink_id);
CREATE INDEX IF NOT EXISTS idx_paymentlink_orders_org ON paymentlink_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_paymentlink_orders_order_id ON paymentlink_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_paymentlink_orders_status ON paymentlink_orders(status);
`;

export const ALL_SCHEMAS = [
  SCHEMA_CONFIG_METADATA,
  SCHEMA_CONFIG_VALUES,
  SCHEMA_PAYMENTLINKS,
  SCHEMA_PAYMENTLINK_CURRENCIES,
  SCHEMA_PAYMENTLINK_ORDERS,
  // SCHEMA_CONFIG_HISTORY removed - audit handled by Auth module
];

/**
 * Table names for checking existence
 *
 * Manager tables only - technical configuration is in YAML
 */
export const TABLE_NAMES = [
  'config_metadata',
  'config_values',
  'paymentlinks',
  'paymentlink_currencies',
  'paymentlink_orders',
] as const;

export type TableName = typeof TABLE_NAMES[number];
