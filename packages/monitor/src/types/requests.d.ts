import type { Chain } from './chains.js';
import type { RPCManager, ConfigFormat } from '../rpc/index.js';
/**
 * Monitoring target specification
 */
export interface MonitoringTarget {
    readonly chain: Chain;
    readonly contract: string;
    readonly to: string;
}
/**
 * Array of monitoring targets
 */
export type MonitoringRequest = readonly MonitoringTarget[];
/**
 * Scan settings for block scanning
 */
export interface ScanSettings {
    readonly interval: number;
    readonly batchSize: number;
}
/**
 * Chain-specific range configuration
 */
export interface ChainRange {
    readonly startBlock?: number | undefined;
    readonly endBlock?: number | undefined;
    readonly scanSettings?: ScanSettings | undefined;
    readonly batchSize?: number;
}
/**
 * State storage interface for persistence
 */
export interface StateStorage {
    /**
     * Save monitor state
     */
    save(key: string, state: any): Promise<void>;
    /**
     * Load monitor state
     */
    load(key: string): Promise<any | null>;
    /**
     * Delete saved state
     */
    delete(key: string): Promise<void>;
    /**
     * Check if state exists
     */
    exists(key: string): Promise<boolean>;
}
/**
 * Monitor configuration - Unified interface
 */
export interface MonitorConfig {
    readonly chains: readonly Chain[];
    readonly targets: readonly MonitoringTarget[];
    readonly rpcManager?: RPCManager;
    readonly rpcKeys?: Record<string, string>;
    readonly rpcConfigPath?: string;
    readonly rpcConfig?: ConfigFormat;
    readonly blockRangeSize?: number;
    readonly maxConcurrentScans?: number;
    readonly scanInterval?: number;
    readonly safeBlockDistance?: number;
    readonly chainRanges?: Record<Chain, ChainRange> | undefined;
    readonly defaultScanSettings?: ScanSettings | undefined;
    readonly rateLimiting?: {
        readonly rpcCallsPerSecond?: number;
        readonly burstLimit?: number;
        readonly cooldownMs?: number;
    };
    readonly errorHandling?: {
        readonly maxRetries?: number;
        readonly retryDelayMs?: number;
        readonly exponentialBackoff?: boolean;
        readonly maxRetryDelayMs?: number;
    };
    readonly persistence?: {
        readonly saveInterval?: number;
        readonly autoRecover?: boolean;
        readonly stateStorage?: StateStorage;
    };
    readonly monitoring?: {
        readonly statsInterval?: number;
        readonly healthCheckInterval?: number;
        readonly performanceTracking?: boolean;
    };
}
/**
 * Monitor options (runtime configuration)
 */
export interface MonitorOptions {
    readonly startImmediately?: boolean;
    readonly overrideState?: boolean;
    readonly debugMode?: boolean;
    readonly dryRun?: boolean;
}
/**
 * Default scan settings
 */
export declare const DEFAULT_SCAN_SETTINGS: ScanSettings;
/**
 * Default monitor configuration
 */
export declare const DEFAULT_MONITOR_CONFIG: Required<Omit<MonitorConfig, 'chains' | 'targets' | 'chainRanges' | 'rpcManager' | 'rpcKeys' | 'rpcConfigPath' | 'rpcConfig'>>;
/**
 * Create monitor configuration with defaults
 */
export declare function createMonitorConfig(config: MonitorConfig): any;
/**
 * Helper to create monitor config with chain ranges
 */
export declare function createBlockRangeConfig(chainRanges: Record<Chain, ChainRange>, defaultScanSettings?: ScanSettings): MonitorConfig;
/**
 * Helper to create simple config with chain list
 */
export declare function createSimpleConfig(chains: Chain[], defaultScanSettings?: ScanSettings): MonitorConfig;
/**
 * Validate monitor configuration
 */
export declare function validateMonitorConfig(config: MonitorConfig): void;
/**
 * Validate chain range configuration
 */
export declare function validateChainRange(chain: Chain, range: ChainRange): void;
/**
 * Validate scan settings
 */
export declare function validateScanSettings(settings: ScanSettings, chain?: Chain): void;
/**
 * Get effective scan settings for a chain
 */
export declare function getEffectiveScanSettings(config: MonitorConfig, chain: Chain): ScanSettings;
/**
 * Clone monitor config
 */
export declare function cloneMonitorConfig(config: MonitorConfig): MonitorConfig;
/**
 * Helper to create monitoring targets
 */
export declare function createMonitoringTarget(chain: Chain, contract: string, to: string): MonitoringTarget;
/**
 * Helper to create monitoring request
 */
export declare function createMonitoringRequest(...targets: MonitoringTarget[]): MonitoringRequest;
//# sourceMappingURL=requests.d.ts.map