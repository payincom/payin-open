import { ConfigLoader, RPCProviderTemplate, RPCGlobalConfig, ConfigFormat, RPCProviderKeys } from '../types/rpc-config.js';
export declare class RPCConfigLoader implements ConfigLoader {
    private configPath?;
    private rpcKeys;
    private rpcConfig?;
    private disablePublicProviders;
    private config;
    private availableProviders;
    private readonly logger;
    constructor(configPath?: string | undefined, rpcKeys?: RPCProviderKeys, rpcConfig?: ConfigFormat | undefined, disablePublicProviders?: boolean);
    loadProviderTemplates(): Promise<RPCProviderTemplate[]>;
    loadGlobalConfig(): Promise<RPCGlobalConfig>;
    private loadConfigFile;
    private parseConfig;
    private buildProviderTemplates;
    buildEndpointUrl(provider: RPCProviderTemplate, chain: string, apiKey: string): string;
    buildAuthHeaders(provider: RPCProviderTemplate, apiKey: string): Record<string, string>;
    buildQueryParams(provider: RPCProviderTemplate, apiKey: string): Record<string, string>;
    getRpcKeys(): RPCProviderKeys;
    getAvailableProviders(): string[];
    getConfiguredChains(): string[];
    validateProviderKey(providerName: string): boolean;
}
//# sourceMappingURL=config-loader.d.ts.map