export interface RPCProviderTemplate {
    name: string;
    displayName: string;
    authType: 'url_path' | 'header' | 'query_param' | 'none';
    urlTemplate?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    chainUrls?: Record<string, string>;
    requiresApiKey: boolean;
    supportedChains: string[];
    defaultTimeout: number;
    defaultWeight: number;
    defaultMaxRequestsPerSecond: number;
}
export interface RPCEndpointConfig {
    name: string;
    provider: string;
    chain: string;
    apiKey: string;
    url?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    weight?: number;
    timeout?: number;
    maxRequestsPerSecond?: number;
    enabled?: boolean;
}
export interface RPCChainConfig {
    chain: string;
    strategy: 'round_robin' | 'failover' | 'fastest';
    endpoints: RPCEndpointConfig[];
    healthCheck?: {
        enabled: boolean;
        interval: number;
        timeout: number;
        maxFailures: number;
    };
    retry?: {
        maxRetries: number;
        backoffMultiplier: number;
        initialDelay: number;
    };
}
export interface RPCGlobalConfig {
    chains: Record<string, RPCChainConfig>;
    settings: {
        healthCheck: {
            enabled: boolean;
            interval: number;
            timeout: number;
        };
        retry: {
            maxRetries: number;
            backoffMultiplier: number;
            initialDelay: number;
        };
        rateLimit: {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        };
    };
}
export interface ConfigLoader {
    loadProviderTemplates(): Promise<RPCProviderTemplate[]>;
    loadGlobalConfig(): Promise<RPCGlobalConfig>;
    buildEndpointUrl(provider: RPCProviderTemplate, chain: string, apiKey: string): string;
    buildAuthHeaders(provider: RPCProviderTemplate, apiKey: string): Record<string, string>;
    buildQueryParams(provider: RPCProviderTemplate, apiKey: string): Record<string, string>;
    getRpcKeys(): RPCProviderKeys;
    getAvailableProviders(): string[];
    getConfiguredChains(): string[];
    validateProviderKey(providerName: string): boolean;
}
export interface ConfigFormat {
    customProviders?: Record<string, Omit<RPCProviderTemplate, 'name'>>;
    providers?: Record<string, Omit<RPCProviderTemplate, 'name'>>;
    defaults?: {
        timeout?: number;
        maxRetries?: number;
        healthCheckInterval?: number;
    };
    chainDefaults?: {
        strategy?: 'round_robin' | 'failover' | 'fastest';
        healthCheck?: {
            enabled?: boolean;
            interval?: number;
            timeout?: number;
            maxFailures?: number;
        };
        retry?: {
            maxRetries?: number;
            backoffMultiplier?: number;
            initialDelay?: number;
        };
    };
    chains: Record<string, {
        strategy?: 'round_robin' | 'failover' | 'fastest';
        availableProviders?: string[];
        preferredProviders?: string[];
        excludeProviders?: string[];
        timeout?: number;
        weight?: number;
        maxRequestsPerSecond?: number;
        healthCheck?: {
            enabled?: boolean;
            interval?: number;
            timeout?: number;
            maxFailures?: number;
        };
        retry?: {
            maxRetries?: number;
            backoffMultiplier?: number;
            initialDelay?: number;
        };
    }>;
    settings?: {
        healthCheck?: {
            enabled?: boolean;
            interval?: number;
            timeout?: number;
        };
        retry?: {
            maxRetries?: number;
            backoffMultiplier?: number;
            initialDelay?: number;
        };
        rateLimit?: {
            enabled?: boolean;
            windowMs?: number;
            maxRequests?: number;
        };
    };
}
export interface RPCProviderKeys {
    [providerName: string]: string;
}
export interface RPCEndpointInstance {
    id: string;
    name: string;
    chain: string;
    provider: RPCProviderTemplate | null;
    config: RPCEndpointConfig;
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    isHealthy: boolean;
    consecutiveFailures: number;
    lastHealthCheck: Date;
    avgResponseTime: number;
    requestCount: number;
    successRate: number;
}
export interface RPCMetrics {
    endpoint: string;
    chain: string;
    requestCount: number;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
    lastRequestTime: Date;
    errors: Array<{
        timestamp: Date;
        error: string;
        code?: number;
    }>;
}
//# sourceMappingURL=rpc-config.d.ts.map