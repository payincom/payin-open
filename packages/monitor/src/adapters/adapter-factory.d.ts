import type { Chain, Protocol } from '../types/index.js';
import { BaseAdapter } from './base-adapter.js';
import type { RPCManager } from '../rpc/index.js';
/**
 * RPC endpoint configuration for adapters
 */
export interface RPCEndpointConfig {
    readonly name: string;
    readonly url: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly weight?: number;
    readonly priority?: number;
}
/**
 * Chain adapter configuration
 */
export interface ChainAdapterConfig {
    readonly chain: Chain;
    readonly endpoints: readonly RPCEndpointConfig[];
    readonly healthCheckInterval?: number;
    readonly maxRetries?: number;
}
/**
 * Adapter constructor type
 */
type AdapterConstructor = new (chain: Chain, rpcManager: RPCManager) => BaseAdapter;
/**
 * Adapter factory for creating protocol-specific adapters
 */
export declare class AdapterFactory {
    private static readonly adapterRegistry;
    private readonly configRegistry;
    private readonly activeAdapters;
    private readonly logger;
    constructor();
    /**
     * Register a protocol adapter class
     */
    static registerAdapter(protocol: Protocol, adapterClass: AdapterConstructor): void;
    /**
     * Get registered adapter class for protocol
     */
    static getAdapterClass(protocol: Protocol): AdapterConstructor | undefined;
    /**
     * Get all registered protocols
     */
    static getRegisteredProtocols(): readonly Protocol[];
    /**
     * Add chain configuration
     */
    addChainConfig(config: ChainAdapterConfig): void;
    /**
     * Add multiple chain configurations
     */
    addChainConfigs(configs: readonly ChainAdapterConfig[]): void;
    /**
     * Get chain configuration
     */
    getChainConfig(chain: Chain): ChainAdapterConfig | undefined;
    /**
     * Get all configured chains
     */
    getConfiguredChains(): readonly Chain[];
    /**
     * Create adapter for a chain
     */
    createAdapter(chain: Chain, rpcManager: RPCManager): Promise<BaseAdapter>;
    /**
     * Get existing adapter for chain (if already created)
     */
    getAdapter(chain: Chain): BaseAdapter | undefined;
    /**
     * Get or create adapter for chain
     */
    getOrCreateAdapter(chain: Chain, rpcManager: RPCManager): Promise<BaseAdapter>;
    /**
     * Create adapters for multiple chains
     */
    createAdapters(chains: readonly Chain[], rpcManager: RPCManager): Promise<Map<Chain, BaseAdapter>>;
    /**
     * Check if adapter exists for chain
     */
    hasAdapter(chain: Chain): boolean;
    /**
     * Get all active chains
     */
    getActiveChains(): readonly Chain[];
    /**
     * Get adapters by protocol
     */
    getAdaptersByProtocol(protocol: Protocol): Map<Chain, BaseAdapter>;
    /**
     * Check health of all active adapters
     */
    checkAdaptersHealth(): Promise<Map<Chain, boolean>>;
    /**
     * Destroy adapter for chain
     */
    destroyAdapter(chain: Chain): Promise<void>;
    /**
     * Destroy all adapters
     */
    destroyAllAdapters(): Promise<void>;
    /**
     * Get factory statistics
     */
    getStats(): {
        registeredProtocols: number;
        configuredChains: number;
        activeAdapters: number;
        protocols: readonly Protocol[];
        chains: readonly Chain[];
    };
    /**
     * Validate chain configuration
     */
    private validateChainConfig;
}
/**
 * Create default adapter factory with built-in configurations
 * Uses RPC keys from CLAUDE.md
 */
export declare function createDefaultAdapterFactory(): AdapterFactory;
export {};
//# sourceMappingURL=adapter-factory.d.ts.map