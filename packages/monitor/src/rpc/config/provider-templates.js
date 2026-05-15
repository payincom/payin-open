/**
 * RPC Provider Template Type Definitions
 * All providers must be configured through:
 * 1. Code initialization (rpcConfig.providers)
 * 2. YAML configuration files
 * 3. Database configuration (via Manager)
 */
/**
 * Add name field to provider templates from configuration
 */
export function normalizeProviderTemplates(providers) {
    return Object.entries(providers).reduce((acc, [name, template]) => {
        acc[name] = { name, ...template };
        return acc;
    }, {});
}
/**
 * Get providers that support a specific network
 */
export function getProvidersForNetwork(providers, network) {
    return Object.values(providers).filter(provider => provider.supportedNetworks.includes(network) ||
        Object.values(provider.networkMappings || {}).includes(network));
}
/**
 * Check if a provider requires an API key
 */
export function requiresApiKey(provider) {
    return provider.authType !== 'none';
}
//# sourceMappingURL=provider-templates.js.map