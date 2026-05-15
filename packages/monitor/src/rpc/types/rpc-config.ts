export interface RPCProviderTemplate {
  name: string
  displayName: string
  authType: 'url_path' | 'header' | 'query_param' | 'none'
  urlTemplate?: string
  baseUrl?: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  chainUrls?: Record<string, string>
  requiresApiKey: boolean
  supportedChains: string[]
  defaultTimeout: number
  defaultWeight: number
  defaultMaxRequestsPerSecond: number
}

export interface RPCEndpointConfig {
  name: string
  provider: string
  chain: string
  apiKey: string
  url?: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  weight?: number
  timeout?: number
  maxRequestsPerSecond?: number
  enabled?: boolean
}

export interface RPCChainConfig {
  chain: string
  strategy: 'round_robin' | 'failover' | 'fastest'
  endpoints: RPCEndpointConfig[]
  healthCheck?: {
    enabled: boolean
    interval: number
    timeout: number
    maxFailures: number
  }
  retry?: {
    maxRetries: number
    backoffMultiplier: number
    initialDelay: number
  }
}

export interface RPCGlobalConfig {
  chains: Record<string, RPCChainConfig>
  settings: {
    healthCheck: {
      enabled: boolean
      interval: number
      timeout: number
    }
    retry: {
      maxRetries: number
      backoffMultiplier: number
      initialDelay: number
    }
    rateLimit: {
      enabled: boolean
      windowMs: number
      maxRequests: number
    }
  }
}

export interface ConfigLoader {
  loadProviderTemplates(): Promise<RPCProviderTemplate[]>
  loadGlobalConfig(): Promise<RPCGlobalConfig>
  buildEndpointUrl(provider: RPCProviderTemplate, chain: string, apiKey: string): string
  buildAuthHeaders(provider: RPCProviderTemplate, apiKey: string): Record<string, string>
  buildQueryParams(provider: RPCProviderTemplate, apiKey: string): Record<string, string>
  getRpcKeys(): RPCProviderKeys
  getAvailableProviders(): string[]
  getConfiguredChains(): string[]
  validateProviderKey(providerName: string): boolean
}

export interface ConfigFormat {
  // Custom provider definitions (YAML or code-defined)
  customProviders?: Record<string, Omit<RPCProviderTemplate, 'name'>>

  // Code-provided providers (highest priority, for backward compatibility)
  providers?: Record<string, Omit<RPCProviderTemplate, 'name'>>

  // Global defaults
  defaults?: {
    timeout?: number
    maxRetries?: number
    healthCheckInterval?: number
  }

  // Chain default settings (applied to all chains unless overridden)
  chainDefaults?: {
    strategy?: 'round_robin' | 'failover' | 'fastest'
    healthCheck?: {
      enabled?: boolean
      interval?: number
      timeout?: number
      maxFailures?: number
    }
    retry?: {
      maxRetries?: number
      backoffMultiplier?: number
      initialDelay?: number
    }
  }

  chains: Record<string, {
    strategy?: 'round_robin' | 'failover' | 'fastest'
    availableProviders?: string[]      // Available providers for code-based config
    preferredProviders?: string[]      // Preferred providers for YAML config
    excludeProviders?: string[]        // Providers to exclude
    // Chain-level overrides (optional, will override provider defaults)
    timeout?: number                   // Override timeout for all providers on this chain
    weight?: number                    // Override weight for all providers on this chain
    maxRequestsPerSecond?: number      // Override rate limit for all providers on this chain
    healthCheck?: {
      enabled?: boolean
      interval?: number
      timeout?: number
      maxFailures?: number
    }
    retry?: {
      maxRetries?: number
      backoffMultiplier?: number
      initialDelay?: number
    }
  }>
  settings?: {
    healthCheck?: {
      enabled?: boolean
      interval?: number
      timeout?: number
    }
    retry?: {
      maxRetries?: number
      backoffMultiplier?: number
      initialDelay?: number
    }
    rateLimit?: {
      enabled?: boolean
      windowMs?: number
      maxRequests?: number
    }
  }
}

export interface RPCProviderKeys {
  [providerName: string]: string
}

export interface RPCEndpointInstance {
  id: string
  name: string
  chain: string
  provider: RPCProviderTemplate | null
  config: RPCEndpointConfig
  url: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  isHealthy: boolean
  consecutiveFailures: number
  lastHealthCheck: Date
  avgResponseTime: number
  requestCount: number
  successRate: number
}

export interface RPCMetrics {
  endpoint: string
  chain: string
  requestCount: number
  successCount: number
  failureCount: number
  avgResponseTime: number
  lastRequestTime: Date
  errors: Array<{
    timestamp: Date
    error: string
    code?: number
  }>
}