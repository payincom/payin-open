/**
 * Utility functions for PayIn MCP Server
 */

import type { NetworkType } from '../types/index.js';

/**
 * Extract API configuration from request headers and environment variables
 *
 * Network Type Priority:
 * 1. X-PayIn-Network header ('testnet' or 'mainnet')
 * 2. Default to 'testnet'
 *
 * API URL Priority:
 * 1. X-PayIn-API-URL header (explicit override, ignores network type)
 * 2. PAYIN_API_URL env (explicit override, ignores network type)
 * 3. Network-specific URL (PAYIN_TESTNET_API_URL or PAYIN_MAINNET_API_URL)
 * 4. DEFAULT_PAYIN_API_URL env (legacy fallback)
 *
 * API Key Priority:
 * 1. X-API-Key header
 * 2. PAYIN_API_KEY env variable
 */
export function extractApiConfig(
  request: Request,
  env: {
    // Network-specific URLs
    PAYIN_TESTNET_API_URL?: string;
    PAYIN_MAINNET_API_URL?: string;

    // Legacy/Override URLs
    DEFAULT_PAYIN_API_URL?: string;
    PAYIN_API_URL?: string;

    // Authentication
    PAYIN_API_KEY?: string;
    REQUIRE_API_KEY_HEADER?: string;
  }
) {
  // ==================== Extract Network Type ====================

  const headerNetworkType = request.headers.get('X-PayIn-Network')?.toLowerCase();
  const networkType: NetworkType =
    (headerNetworkType === 'mainnet' || headerNetworkType === 'testnet')
      ? headerNetworkType
      : 'testnet'; // Default to testnet

  // ==================== Extract API Key ====================

  const headerApiKey = request.headers.get('X-API-Key');
  const envApiKey = env.PAYIN_API_KEY;
  const requireHeaderKey = env.REQUIRE_API_KEY_HEADER === 'true';

  let apiKey: string | null = null;

  if (requireHeaderKey) {
    // Enforce API key from header only (for security)
    apiKey = headerApiKey;
    if (!apiKey) {
      throw new Error('Missing X-API-Key header (REQUIRE_API_KEY_HEADER=true)');
    }
  } else {
    // Allow fallback to env variable
    apiKey = headerApiKey || envApiKey || null;
    if (!apiKey) {
      throw new Error('Missing API Key: provide X-API-Key header or set PAYIN_API_KEY environment variable');
    }
  }

  // ==================== Extract API URL ====================

  // Priority 1: Explicit override via header
  const headerApiUrl = request.headers.get('X-PayIn-API-URL');
  if (headerApiUrl) {
    return { apiKey, apiUrl: headerApiUrl, networkType };
  }

  // Priority 2: Explicit override via env variable
  const envApiUrl = env.PAYIN_API_URL;
  if (envApiUrl) {
    return { apiKey, apiUrl: envApiUrl, networkType };
  }

  // Priority 3: Network-specific URL
  const networkSpecificUrl = networkType === 'mainnet'
    ? env.PAYIN_MAINNET_API_URL
    : env.PAYIN_TESTNET_API_URL;

  if (networkSpecificUrl) {
    return { apiKey, apiUrl: networkSpecificUrl, networkType };
  }

  // Priority 4: Legacy default URL
  const defaultApiUrl = env.DEFAULT_PAYIN_API_URL;
  if (defaultApiUrl) {
    return { apiKey, apiUrl: defaultApiUrl, networkType };
  }

  // No API URL found
  throw new Error(
    `No API URL configured. Please set one of: ` +
    `X-PayIn-API-URL header, PAYIN_API_URL env, ` +
    `PAYIN_${networkType.toUpperCase()}_API_URL env, or DEFAULT_PAYIN_API_URL env`
  );
}

/**
 * Format error for MCP response
 */
export function formatError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Create structured error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  suggestions: string[] = [],
  details?: Record<string, any>
): {
  code: string;
  message: string;
  suggestions: string[];
  details?: Record<string, any>;
  documentation?: string;
} {
  const response: any = {
    code,
    message,
    suggestions,
  };

  if (details) {
    response.details = details;
  }

  // Add documentation link for common errors
  const docMap: Record<string, string> = {
    AUTHENTICATION_FAILED: 'docs://payin/troubleshooting#authentication',
    ORGANIZATION_CONTEXT_REQUIRED: 'docs://payin/getting-started#api-authentication',
    PERMISSION_DENIED: 'docs://payin/troubleshooting#permissions',
    INVALID_PARAMETERS: 'docs://payin/api-reference',
    RESOURCE_NOT_FOUND: 'docs://payin/api-reference',
    ORDER_VALIDATION_FAILED: 'docs://payin/troubleshooting#orders-validation',
    ORDER_AMOUNT_FORMAT_INVALID: 'docs://payin/troubleshooting#orders-validation',
    ORDER_FILTER_INVALID_DATE: 'docs://payin/troubleshooting#orders-filters',
    ORDER_FILTER_INVALID_PAGE: 'docs://payin/troubleshooting#orders-filters',
    ORDER_FILTER_INVALID_LIMIT: 'docs://payin/troubleshooting#orders-filters',
    ORDER_FILTER_INVALID_SORT: 'docs://payin/troubleshooting#orders-filters',
    ORDER_STATS_INVALID_DATE: 'docs://payin/troubleshooting#orders-filters',
    ORDER_CREATION_FAILED: 'docs://payin/troubleshooting#orders-runtime',
    ORDER_LIST_FAILED: 'docs://payin/troubleshooting#orders-runtime',
    ORDER_STATS_FAILED: 'docs://payin/troubleshooting#orders-runtime',
    ORDER_GET_FAILED: 'docs://payin/troubleshooting#orders-runtime',
    ORDER_NOT_FOUND: 'docs://payin/troubleshooting#orders-runtime',
    ORDER_ID_INVALID: 'docs://payin/troubleshooting#orders-validation',
    ADDRESS_POOL_EXHAUSTED: 'docs://payin/troubleshooting#address-pool-exhausted',
    ORDER_SERVICE_DISABLED: 'docs://payin/troubleshooting#order-service-disabled',
    DEPOSIT_VALIDATION_FAILED: 'docs://payin/troubleshooting#deposits-validation',
    DEPOSIT_PROTOCOL_UNSUPPORTED: 'docs://payin/troubleshooting#deposits-protocols',
    DEPOSIT_BIND_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    DEPOSIT_UNBIND_INVALID_PAYLOAD: 'docs://payin/troubleshooting#deposits-validation',
    DEPOSIT_UNBIND_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    DEPOSIT_FILTER_INVALID_PAGE: 'docs://payin/troubleshooting#deposits-filters',
    DEPOSIT_FILTER_INVALID_LIMIT: 'docs://payin/troubleshooting#deposits-filters',
    DEPOSIT_REFERENCES_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    DEPOSIT_ADDRESS_NOT_FOUND: 'docs://payin/troubleshooting#deposits-not-found',
    DEPOSIT_GET_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    DEPOSIT_LIST_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    DEPOSIT_STATS_INVALID_DATE: 'docs://payin/troubleshooting#deposits-filters',
    DEPOSIT_STATS_FAILED: 'docs://payin/troubleshooting#deposits-runtime',
    RATE_LIMIT_EXCEEDED: 'docs://payin/troubleshooting#rate-limits',
    SERVER_ERROR: 'docs://payin/troubleshooting#platform-status',
    API_ERROR: 'docs://payin/troubleshooting#general-api-errors',
    CONFLICT: 'docs://payin/troubleshooting#general-api-errors'
  };

  if (docMap[code]) {
    response.documentation = docMap[code];
  }

  return response;
}

/**
 * Validate required parameters
 */
export function validateRequiredParams(
  params: Record<string, any>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter((field) => !params[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
}

/**
 * Simple logger
 */
export class Logger {
  constructor(private level: string = 'info') {}

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.level);
    const targetLevel = levels.indexOf(level);
    return targetLevel >= currentLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}
