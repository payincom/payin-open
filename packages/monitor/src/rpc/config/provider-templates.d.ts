/**
 * RPC Provider Template Type Definitions
 * All providers must be configured through:
 * 1. Code initialization (rpcConfig.providers)
 * 2. YAML configuration files
 * 3. Database configuration (via Manager)
 */
export interface ProviderTemplate {
    name: string;
    displayName: string;
    authType: 'none' | 'url_path' | 'header' | 'query_param';
    urlPattern: string;
    headerTemplate?: Record<string, string>;
    queryTemplate?: Record<string, string>;
    supportedNetworks: string[];
    networkMappings?: Record<string, string>;
    defaultSettings: {
        timeout: number;
        weight: number;
        maxRequestsPerSecond: number;
    };
}
/**
 * Add name field to provider templates from configuration
 */
export declare function normalizeProviderTemplates(providers: Record<string, Omit<ProviderTemplate, 'name'>>): Record<string, ProviderTemplate>;
/**
 * Get providers that support a specific network
 */
export declare function getProvidersForNetwork(providers: Record<string, ProviderTemplate>, network: string): ProviderTemplate[];
/**
 * Check if a provider requires an API key
 */
export declare function requiresApiKey(provider: ProviderTemplate): boolean;
//# sourceMappingURL=provider-templates.d.ts.map