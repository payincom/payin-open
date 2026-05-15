import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
// Note: DEFAULT_CONFIG removed - will be replaced with simplified provider templates
import { createLogger, LogCategory } from '@payin/shared';
export class RPCConfigLoader {
    configPath;
    rpcKeys;
    rpcConfig;
    disablePublicProviders;
    config;
    availableProviders = new Map();
    logger = createLogger(LogCategory.RPC);
    constructor(configPath, rpcKeys = {}, rpcConfig, disablePublicProviders = false) {
        this.configPath = configPath;
        this.rpcKeys = rpcKeys;
        this.rpcConfig = rpcConfig;
        this.disablePublicProviders = disablePublicProviders;
    }
    async loadProviderTemplates() {
        await this.loadConfigFile();
        return Array.from(this.availableProviders.values());
    }
    async loadGlobalConfig() {
        await this.loadConfigFile();
        const chains = {};
        for (const [chainName, chainConfig] of Object.entries(this.config.chains)) {
            const availableEndpoints = [];
            // Get provider list (support both availableProviders and preferredProviders)
            const providerList = chainConfig.preferredProviders || chainConfig.availableProviders || [];
            // 过滤可用的提供商（基于提供的密钥）
            for (const providerName of providerList) {
                const provider = this.availableProviders.get(providerName);
                if (!provider) {
                    console.warn(`Provider ${providerName} not found for chain ${chainName}`);
                    continue;
                }
                // 检查是否需要密钥以及是否已提供
                if (provider.requiresApiKey && !this.rpcKeys[providerName]) {
                    this.logger.debug('Skipping provider due to missing API key', {
                        providerName,
                        chainName
                    });
                    continue;
                }
                // 检查是否禁用了公共提供商
                if (!provider.requiresApiKey && this.disablePublicProviders) {
                    this.logger.debug('Skipping public provider due to configuration', {
                        providerName,
                        chainName
                    });
                    continue;
                }
                // 检查提供商是否支持该链 (consider chain mappings)
                const supportsChain = provider.supportedChains.includes(chainName) ||
                    (provider.chainUrls && provider.chainUrls[chainName]);
                if (!supportsChain) {
                    console.warn(`Provider ${providerName} does not support chain ${chainName}`);
                    continue;
                }
                // Get provider template to access its default settings
                const providerTemplate = this.availableProviders.get(providerName);
                if (!providerTemplate) {
                    console.warn(`Provider template not found for ${providerName}`);
                    continue;
                }
                // Priority: chain override → global defaults → provider defaults
                const endpoint = {
                    name: providerName,
                    provider: providerName,
                    chain: chainName,
                    apiKey: this.rpcKeys[providerName] || '',
                    weight: chainConfig.weight ?? providerTemplate.defaultWeight,
                    timeout: chainConfig.timeout ?? this.config?.defaults?.timeout ?? providerTemplate.defaultTimeout,
                    maxRequestsPerSecond: chainConfig.maxRequestsPerSecond ?? providerTemplate.defaultMaxRequestsPerSecond,
                    enabled: true
                };
                availableEndpoints.push(endpoint);
            }
            if (availableEndpoints.length === 0) {
                console.warn(`No available RPC endpoints for chain ${chainName}. Chain will be skipped.`);
                continue;
            }
            chains[chainName] = {
                chain: chainName,
                strategy: chainConfig.strategy ?? this.config.chainDefaults?.strategy ?? 'round_robin',
                endpoints: availableEndpoints,
                healthCheck: {
                    enabled: chainConfig.healthCheck?.enabled ?? this.config.settings?.healthCheck?.enabled ?? true,
                    interval: chainConfig.healthCheck?.interval ?? this.config.settings?.healthCheck?.interval ?? 30000,
                    timeout: chainConfig.healthCheck?.timeout ?? this.config.settings?.healthCheck?.timeout ?? 5000,
                    maxFailures: chainConfig.healthCheck?.maxFailures ?? 3
                },
                retry: {
                    maxRetries: chainConfig.retry?.maxRetries ?? this.config.settings?.retry?.maxRetries ?? 3,
                    backoffMultiplier: chainConfig.retry?.backoffMultiplier ?? this.config.settings?.retry?.backoffMultiplier ?? 1.5,
                    initialDelay: chainConfig.retry?.initialDelay ?? this.config.settings?.retry?.initialDelay ?? 1000
                }
            };
        }
        if (Object.keys(chains).length === 0) {
            throw new Error('No chains could be configured. Please provide valid RPC provider keys.');
        }
        return {
            chains,
            settings: {
                healthCheck: {
                    enabled: this.config.settings?.healthCheck?.enabled ?? true,
                    interval: this.config.settings?.healthCheck?.interval ?? 30000,
                    timeout: this.config.settings?.healthCheck?.timeout ?? 5000
                },
                retry: {
                    maxRetries: this.config.settings?.retry?.maxRetries ?? 3,
                    backoffMultiplier: this.config.settings?.retry?.backoffMultiplier ?? 1.5,
                    initialDelay: this.config.settings?.retry?.initialDelay ?? 1000
                },
                rateLimit: {
                    enabled: this.config.settings?.rateLimit?.enabled ?? true,
                    windowMs: this.config.settings?.rateLimit?.windowMs ?? 60000,
                    maxRequests: this.config.settings?.rateLimit?.maxRequests ?? 100
                }
            }
        };
    }
    async loadConfigFile() {
        if (this.config) {
            return; // 已加载
        }
        // 如果提供了配置对象，直接使用（优先级最高）
        if (this.rpcConfig) {
            this.logger.info('Using provided RPC configuration object');
            this.config = this.rpcConfig;
            await this.buildProviderTemplates();
            return;
        }
        // 如果提供了自定义配置文件路径，尝试加载
        if (this.configPath) {
            try {
                const configContent = await fs.readFile(this.configPath, 'utf-8');
                this.config = this.parseConfig(configContent);
                await this.buildProviderTemplates();
                return;
            }
            catch (error) {
                if (error.code === 'ENOENT') {
                    console.warn(`Custom config file not found: ${this.configPath}, falling back to default config`);
                }
                else {
                    throw new Error(`Failed to load custom RPC config: ${error}`);
                }
            }
        }
        // 尝试加载默认配置文件
        const defaultConfigPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../config/default.yaml');
        try {
            const defaultConfigContent = await fs.readFile(defaultConfigPath, 'utf-8');
            const parsedConfig = yaml.parse(defaultConfigContent);
            // Extract RPC configuration from nested structure
            this.config = parsedConfig.rpc || { providers: {}, chains: {}, settings: {} };
            this.logger.info('Using default configuration file');
            await this.buildProviderTemplates();
            return;
        }
        catch (error) {
            this.logger.warn('Failed to load default config file, using minimal configuration');
        }
        // Use empty config - built-in providers will be loaded by buildProviderTemplates()
        this.logger.info('Using built-in provider templates with minimal configuration');
        this.config = { chains: {}, settings: {} };
        await this.buildProviderTemplates();
    }
    parseConfig(content) {
        if (!this.configPath) {
            throw new Error('Config path is required for parsing');
        }
        const ext = path.extname(this.configPath).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
            return yaml.parse(content);
        }
        else if (ext === '.json') {
            return JSON.parse(content);
        }
        else {
            throw new Error(`Unsupported config file format: ${ext}. Use .yaml, .yml, or .json`);
        }
    }
    async buildProviderTemplates() {
        this.availableProviders.clear();
        // Priority: code providers > YAML providers/customProviders
        const providers = {};
        // Load YAML customProviders (if provided)
        if (this.config.customProviders) {
            Object.assign(providers, this.config.customProviders);
        }
        // Load YAML providers (if provided)
        if (this.config.providers) {
            Object.assign(providers, this.config.providers);
        }
        // If no providers configured, throw error
        if (Object.keys(providers).length === 0) {
            throw new Error('No RPC providers configured. Please provide providers through:\n' +
                '1. rpcConfig.providers in code initialization\n' +
                '2. providers or customProviders in YAML configuration\n' +
                '3. Database configuration via Manager.buildProcessorConfig()');
        }
        // Build provider templates with names
        // Convert from ProviderTemplate format to RPCProviderTemplate format
        for (const [providerName, providerConfig] of Object.entries(providers)) {
            // Combine supportedNetworks with networkMappings keys for supportedChains
            const supportedChains = providerConfig.supportedNetworks || providerConfig.supportedChains || [];
            const mappingKeys = providerConfig.networkMappings ? Object.keys(providerConfig.networkMappings) : [];
            const allSupportedChains = [...new Set([...supportedChains, ...mappingKeys])];
            const provider = {
                name: providerName,
                displayName: providerConfig.displayName,
                authType: providerConfig.authType,
                urlTemplate: providerConfig.urlPattern || providerConfig.urlTemplate,
                baseUrl: providerConfig.baseUrl,
                headers: providerConfig.headerTemplate || providerConfig.headers,
                queryParams: providerConfig.queryTemplate || providerConfig.queryParams,
                requiresApiKey: providerConfig.authType !== 'none',
                supportedChains: allSupportedChains,
                defaultTimeout: providerConfig.defaultSettings?.timeout || providerConfig.defaultTimeout || 5000,
                defaultWeight: providerConfig.defaultSettings?.weight || providerConfig.defaultWeight || 100,
                defaultMaxRequestsPerSecond: providerConfig.defaultSettings?.maxRequestsPerSecond || providerConfig.defaultMaxRequestsPerSecond || 10
            };
            this.availableProviders.set(providerName, provider);
        }
    }
    buildEndpointUrl(provider, chain, apiKey) {
        // 优先使用链特定的URL
        if (provider.chainUrls && provider.chainUrls[chain]) {
            const url = provider.chainUrls[chain];
            return provider.requiresApiKey ? url.replace('{api_key}', apiKey) : url;
        }
        // 使用通用URL模板
        if (provider.urlTemplate) {
            return provider.urlTemplate.replace('{api_key}', apiKey);
        }
        // 使用baseUrl
        if (provider.baseUrl) {
            return provider.baseUrl;
        }
        throw new Error(`Cannot build URL for provider ${provider.name} and chain ${chain}`);
    }
    buildAuthHeaders(provider, apiKey) {
        if (provider.authType !== 'header' || !provider.headers) {
            return {};
        }
        const headers = {};
        for (const [key, value] of Object.entries(provider.headers)) {
            headers[key] = value.replace('{api_key}', apiKey);
        }
        return headers;
    }
    buildQueryParams(provider, apiKey) {
        if (provider.authType !== 'query_param' || !provider.queryParams) {
            return {};
        }
        const params = {};
        for (const [key, value] of Object.entries(provider.queryParams)) {
            params[key] = value.replace('{api_key}', apiKey);
        }
        return params;
    }
    getRpcKeys() {
        return { ...this.rpcKeys };
    }
    getAvailableProviders() {
        return Array.from(this.availableProviders.keys());
    }
    getConfiguredChains() {
        return Object.keys(this.config?.chains || {});
    }
    validateProviderKey(providerName) {
        const provider = this.availableProviders.get(providerName);
        if (!provider) {
            return false;
        }
        if (provider.requiresApiKey && !this.rpcKeys[providerName]) {
            return false;
        }
        return true;
    }
}
//# sourceMappingURL=config-loader.js.map