/**
 * Simplified RPC Configuration Builder
 * Replaces complex 590-line configuration with dynamic generation
 * based on provider templates and actual requirements
 */
import type { RPCGlobalConfig } from '../types/rpc-config.js';
import { type ProviderTemplate } from './provider-templates.js';
import type { LoadedConfig } from '../../config/config-loader.js';
export interface BuildOptions {
    includeProviders?: string[];
    excludeProviders?: string[];
    requireApiKey?: boolean;
    allowNoApiKey?: boolean;
    strategy?: 'round_robin' | 'failover' | 'fastest';
}
export declare class RPCConfigBuilder {
    private options;
    private config?;
    private readonly logger;
    constructor(options?: {
        configFile?: string;
        apiKeys?: Record<string, string>;
        customProviders?: Record<string, Omit<ProviderTemplate, 'name'>>;
        configOverrides?: Partial<LoadedConfig>;
    });
    /**
     * Build RPC configuration for specified chains
     */
    buildForChains(chains: string[], buildOptions?: BuildOptions): Promise<RPCGlobalConfig>;
    private loadConfiguration;
    private buildChainConfig;
    private getAvailableProviders;
    private orderProviders;
    private buildEndpointConfig;
    private buildUrl;
    private buildHeaders;
    private buildQueryParams;
    private getGlobalSettings;
}
/**
 * Convenience function to create RPC configuration
 */
export declare function createRPCConfig(chains: string[], options?: {
    apiKeys?: Record<string, string>;
    includeProviders?: string[];
    excludeProviders?: string[];
    strategy?: 'round_robin' | 'failover' | 'fastest';
}): Promise<RPCGlobalConfig>;
//# sourceMappingURL=rpc-config-builder.d.ts.map