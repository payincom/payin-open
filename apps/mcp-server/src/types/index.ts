/**
 * Type definitions for PayIn MCP Server
 */

/**
 * Network type for API selection
 */
export type NetworkType = 'testnet' | 'mainnet';

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // API Configuration - Network-specific URLs
  PAYIN_TESTNET_API_URL?: string;  // Testnet API URL (default fallback)
  PAYIN_MAINNET_API_URL?: string;  // Mainnet API URL

  // Legacy/Override Configuration (for backward compatibility)
  DEFAULT_PAYIN_API_URL?: string;  // Legacy: fallback if network-specific URLs not set
  PAYIN_API_URL?: string;          // Override: explicit API URL (highest priority)

  // Authentication
  PAYIN_API_KEY?: string;          // Default API Key (optional, can be overridden by header)

  // Server Configuration
  LOG_LEVEL?: string;

  // Feature Flags
  REQUIRE_API_KEY_HEADER?: string; // 'true' to enforce API key from header only
}

/**
 * MCP Error response
 */
export interface McpError {
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestions: string[];
  documentation?: string;
}

/**
 * PayIn API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Order types
 */
export interface Order {
  id: string;
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  status: 'pending' | 'completed' | 'expired';
  address?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface CreateOrderParams {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface ListOrdersParams {
  status?: string | string[];
  chain?: string;
  token?: string;
  orderReference?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderStatistics {
  total: number;
  completed: number;
  pending: number;
  expired: number;
  totalAmount: string;
}

/**
 * Deposit types
 */
export interface DepositAddress {
  address: string;
  protocol: 'evm' | 'tron';
  depositReference: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BindDepositAddressParams {
  depositReference: string;
  protocol: 'evm' | 'tron';
  metadata?: Record<string, any>;
}

export interface UnbindDepositAddressParams {
  depositReference?: string;
  address?: string;
  protocol?: 'evm' | 'tron';
}

/**
 * Transfer types
 */
export interface Transfer {
  id: string;
  txHash: string;
  chainId: string;
  tokenSymbol: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  blockNumber: number;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'completed';
  detectedAt: string;
  confirmedAt?: string;
  completedAt?: string;
}

/**
 * Address Pool types
 */
export interface AddressPoolAvailability {
  available: number;
  allocated: number;
  bound: number;
  totalManaged: number;
  lowThresholdWarning: boolean;
}

export interface PoolAddress {
  address: string;
  protocol: 'evm' | 'tron';
  status: 'available' | 'allocated' | 'bound';
  derivationIndex?: number;
  masterPublicKey?: string;
  allocatedAt?: string;
  boundAt?: string;
  recycledAt?: string;
  cooldownUntil?: string;
}

/**
 * Configuration types
 */
export interface Chain {
  id: string;
  name: string;
  protocol: 'evm' | 'tron';
  rpcUrl: string;
  explorerUrl?: string;
  testnet: boolean;
}

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  chains: {
    chainId: string;
    contractAddress: string;
  }[];
}

/**
 * Payment Link types
 */
export type PaymentLinkStatus = 'draft' | 'published';

export interface PaymentLink {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  amount: string;
  status: PaymentLinkStatus;
  slug?: string | null;
  inventoryTotal?: number | null;
  inventorySold?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  isArchived: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  currencies?: Array<{
    currency: string;
    chainOptions: string[];
    amount?: string;
    isPrimary?: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface CreatePaymentLinkParams {
  title: string;
  description?: string | null;
  amount: string | number;
  currencies: Array<{
    currency: string;
    chainOptions: string[];
    amount?: string | number;
    is_primary?: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdatePaymentLinkParams {
  title?: string;
  description?: string | null;
  amount?: string | number;
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdatePaymentLinkCurrenciesParams {
  currencies: Array<{
    currency: string;
    chainOptions: string[];
    amount?: string | number;
    is_primary?: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface ListPaymentLinksParams {
  status?: PaymentLinkStatus | PaymentLinkStatus[];
  search?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

export interface PaymentLinkStatistics {
  totalLinks: number;
  publishedLinks: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  revenue: Record<string, number>;
  conversionRate: number;
}

/**
 * System health types
 */
export interface SystemHealth {
  api: 'healthy' | 'unhealthy';
  processor: 'healthy' | 'unhealthy';
  monitor: 'healthy' | 'unhealthy';
  database: 'healthy' | 'unhealthy';
  timestamp: string;
}
