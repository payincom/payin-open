/**
 * Simplified RPC Configuration Builder
 * Replaces complex 590-line configuration with dynamic generation
 * based on provider templates and actual requirements
 */
import { getProvidersForNetwork } from './provider-templates.js';
import { loadMonitorConfig } from '../../config/config-loader.js';
import { validateConfig } from '../../config/config-validator.js';
import { createLogger, LogCategory } from '@payin/shared';
export class RPCConfigBuilder {
    options;
    config;
    logger = createLogger(LogCategory.RPC);
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Build RPC configuration for specified chains
     */
    async buildForChains(chains, buildOptions = {}) {
        // Load multi-layer configuration
        await this.loadConfiguration();
        // Validate configuration and provide helpful feedback
        const validation = validateConfig(this.config, chains);
        if (!validation.isValid) {
            const errorMessage = `Configuration validation failed:\n${validation.errors.join('\n')}`;
            throw new Error(errorMessage);
        }
        const rpcConfig = {
            chains: {},
            settings: this.getGlobalSettings()
        };
        for (const chain of chains) {
            try {
                const chainConfig = await this.buildChainConfig(chain, buildOptions);
                if (chainConfig.endpoints.length > 0) {
                    rpcConfig.chains[chain] = chainConfig;
                }
                else {
                    this.logger.warn(`No available providers for chain ${chain} - skipping`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to build config for chain ${chain}:`, error);
            }
        }
        if (Object.keys(rpcConfig.chains).length === 0) {
            throw new Error('No chains could be configured. Please provide valid RPC provider keys or check chain names.');
        }
        return rpcConfig;
    }
    async loadConfiguration() {
        if (this.config)
            return;
        // Load configuration: default.yaml → custom yaml (if provided) → runtime overrides
        this.config = await loadMonitorConfig(this.options.configFile, this.options.configOverrides);
        // Apply runtime API keys (highest priority)
        if (this.options.apiKeys) {
            this.config.rpc = this.config.rpc || {};
            this.config.rpc.apiKeys = { ...this.config.rpc.apiKeys, ...this.options.apiKeys };
        }
    }
    async buildChainConfig(chain, options) {
        const chainSettings = this.config?.rpc?.chains?.[chain] || {};
        const chainDefaults = this.config?.rpc?.chainDefaults || {};
        // Get available providers for this chain
        const availableProviders = await this.getAvailableProviders(chain, options, chainSettings);
        if (availableProviders.length === 0) {
            if (options.requireApiKey) {
                throw new Error(`No providers with API keys available for ${chain}`);
            }
            else {
                throw new Error(`No providers available for ${chain}`);
            }
        }
        return {
            chain,
            strategy: options.strategy || chainSettings.strategy || chainDefaults.strategy || 'round_robin',
            endpoints: availableProviders.map(provider => this.buildEndpointConfig(provider, chain)),
            healthCheck: {
                enabled: chainDefaults.healthCheck?.enabled ?? true,
                interval: chainDefaults.healthCheck?.interval ?? 30000,
                timeout: chainDefaults.healthCheck?.timeout ?? 5000,
                maxFailures: chainDefaults.healthCheck?.maxFailures ?? 3
            },
            retry: {
                maxRetries: chainDefaults.retry?.maxRetries ?? 3,
                backoffMultiplier: chainDefaults.retry?.backoffMultiplier ?? 1.5,
                initialDelay: chainDefaults.retry?.initialDelay ?? 1000
            }
        };
    }
    async getAvailableProviders(chain, options, chainSettings) {
        // Build provider templates map from config
        const providersMap = {};
        // Add providers from YAML config
        if (this.config?.rpc?.providers) {
            for (const [name, template] of Object.entries(this.config.rpc.providers)) {
                providersMap[name] = { name, ...template };
            }
        }
        // Add custom providers (highest priority, can override YAML)
        if (this.options.customProviders) {
            for (const [name, template] of Object.entries(this.options.customProviders)) {
                providersMap[name] = { name, ...template };
            }
        }
        // Filter providers that support this chain
        let candidates = getProvidersForNetwork(providersMap, chain);
        // Apply filters
        candidates = candidates.filter(provider => {
            // 1. Include/exclude filters
            if (options.includeProviders && !options.includeProviders.includes(provider.name)) {
                return false;
            }
            if (options.excludeProviders?.includes(provider.name)) {
                return false;
            }
            if (chainSettings.excludeProviders?.includes(provider.name)) {
                return false;
            }
            // 2. API key requirements
            const needsKey = provider.authType !== 'none';
            const hasKey = !!(this.config?.rpc?.apiKeys?.[provider.name]);
            if (needsKey && !hasKey) {
                this.logger.debug(`Skipping ${provider.name}: requires API key but none provided`);
                return false;
            }
            if (options.requireApiKey && !needsKey) {
                return false;
            }
            if (options.allowNoApiKey === false && !needsKey) {
                return false;
            }
            return true;
        });
        // Apply ordering preferences
        return this.orderProviders(candidates, chainSettings);
    }
    orderProviders(providers, chainSettings) {
        // Support both preferredProviders (YAML) and availableProviders (code config)
        const preferredProviders = chainSettings.preferredProviders || chainSettings.availableProviders || [];
        return providers.sort((a, b) => {
            // 1. Preferred providers first
            const aPreferred = preferredProviders.indexOf(a.name);
            const bPreferred = preferredProviders.indexOf(b.name);
            if (aPreferred !== -1 && bPreferred !== -1) {
                return aPreferred - bPreferred;
            }
            if (aPreferred !== -1)
                return -1;
            if (bPreferred !== -1)
                return 1;
            // 2. Providers with API keys preferred over public
            const aHasKey = a.authType !== 'none' && !!(this.config?.rpc?.apiKeys?.[a.name]);
            const bHasKey = b.authType !== 'none' && !!(this.config?.rpc?.apiKeys?.[b.name]);
            if (aHasKey && !bHasKey)
                return -1;
            if (!aHasKey && bHasKey)
                return 1;
            // 3. Sort by weight
            return b.defaultSettings.weight - a.defaultSettings.weight;
        });
    }
    buildEndpointConfig(provider, chain) {
        const apiKey = this.config?.rpc?.apiKeys?.[provider.name] || '';
        const chainSettings = this.config?.rpc?.chains?.[chain] || {};
        const headers = this.buildHeaders(provider, apiKey);
        const queryParams = this.buildQueryParams(provider, apiKey);
        // Priority: chain override → global defaults → provider defaults
        const config = {
            name: provider.name,
            provider: provider.name,
            chain,
            apiKey,
            url: this.buildUrl(provider, chain, apiKey),
            weight: chainSettings.weight ?? provider.defaultSettings.weight,
            timeout: chainSettings.timeout ?? this.config?.rpc?.defaults?.timeout ?? provider.defaultSettings.timeout,
            maxRequestsPerSecond: chainSettings.maxRequestsPerSecond ?? provider.defaultSettings.maxRequestsPerSecond,
            enabled: true
        };
        if (headers)
            config.headers = headers;
        if (queryParams)
            config.queryParams = queryParams;
        return config;
    }
    buildUrl(provider, chain, apiKey) {
        const networkName = provider.networkMappings?.[chain] || chain;
        return provider.urlPattern
            .replace('{network}', networkName)
            .replace('{apiKey}', apiKey);
    }
    buildHeaders(provider, apiKey) {
        if (provider.authType !== 'header' || !provider.headerTemplate) {
            return undefined;
        }
        const headers = {};
        for (const [key, template] of Object.entries(provider.headerTemplate)) {
            headers[key] = template.replace('{apiKey}', apiKey);
        }
        return Object.keys(headers).length > 0 ? headers : undefined;
    }
    buildQueryParams(provider, apiKey) {
        if (provider.authType !== 'query_param' || !provider.queryTemplate) {
            return undefined;
        }
        const params = {};
        for (const [key, template] of Object.entries(provider.queryTemplate)) {
            params[key] = template.replace('{apiKey}', apiKey);
        }
        return Object.keys(params).length > 0 ? params : undefined;
    }
    getGlobalSettings() {
        const defaults = this.config?.rpc?.defaults || {};
        const chainDefaults = this.config?.rpc?.chainDefaults || {};
        return {
            healthCheck: {
                enabled: chainDefaults.healthCheck?.enabled ?? true,
                interval: chainDefaults.healthCheck?.interval ?? 30000,
                timeout: chainDefaults.healthCheck?.timeout ?? 5000
            },
            retry: {
                maxRetries: chainDefaults.retry?.maxRetries ?? 3,
                backoffMultiplier: chainDefaults.retry?.backoffMultiplier ?? 1.5,
                initialDelay: chainDefaults.retry?.initialDelay ?? 1000
            },
            rateLimit: {
                enabled: true,
                windowMs: 60000,
                maxRequests: 100
            }
        };
    }
}
/**
 * Convenience function to create RPC configuration
 */
export async function createRPCConfig(chains, options = {}) {
    const builderOptions = {};
    if (options.apiKeys)
        builderOptions.apiKeys = options.apiKeys;
    const builder = new RPCConfigBuilder(builderOptions);
    const buildOptions = {};
    if (options.includeProviders)
        buildOptions.includeProviders = options.includeProviders;
    if (options.excludeProviders)
        buildOptions.excludeProviders = options.excludeProviders;
    if (options.strategy)
        buildOptions.strategy = options.strategy;
    return builder.buildForChains(chains, buildOptions);
}
//# sourceMappingURL=rpc-config-builder.js.map