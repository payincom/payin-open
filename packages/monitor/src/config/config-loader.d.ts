/**
 * Multi-layer configuration loader for Monitor
 *
 * Loading priority (low to high):
 * 1. Built-in defaults (code)
 * 2. Default config file (config/default.yaml)
 * 3. Custom config file (if provided via configFile parameter)
 * 4. Runtime configuration (constructor params - highest priority)
 */
export interface LoadedConfig {
    rpc?: {
        providers?: Record<string, any>;
        apiKeys?: Record<string, string>;
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
        chains?: Record<string, {
            preferredProviders?: string[];
            excludeProviders?: string[];
            timeout?: number;
            weight?: number;
            maxRequestsPerSecond?: number;
            strategy?: 'round_robin' | 'failover' | 'fastest';
        }>;
    };
    monitor?: {
        scanning?: {
            defaultConfirmations?: number;
            maxBlockRange?: number;
            scanInterval?: number;
        };
        events?: {
            maxListeners?: number;
            errorRetryInterval?: number;
        };
        performance?: {
            enableCache?: boolean;
            cacheSize?: number;
            concurrentRequests?: number;
        };
    };
}
export declare class MonitorConfigLoader {
    private static instance?;
    private loadedConfig;
    private readonly logger;
    static getInstance(): MonitorConfigLoader;
    loadConfig(configFile?: string, runtimeConfig?: Partial<LoadedConfig>): Promise<LoadedConfig>;
    private getBuiltinDefaults;
    private getDefaultConfigPath;
    private loadConfigFile;
    private fileExists;
    private deepMerge;
    /**
     * Clear cached configuration (useful for testing)
     */
    clearCache(): void;
}
/**
 * Convenience function to load monitor configuration
 */
export declare function loadMonitorConfig(configFile?: string, runtimeConfig?: Partial<LoadedConfig>): Promise<LoadedConfig>;
//# sourceMappingURL=config-loader.d.ts.map