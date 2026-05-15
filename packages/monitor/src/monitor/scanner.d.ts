/**
 * Blockchain scanner implementation
 * Handles block scanning logic for unified monitoring
 */
import type { Chain, MonitoringTarget, TransferEvent } from '../types/index.js';
import type { BaseAdapter, BlockScanResult } from '../adapters/index.js';
import type { MonitorEventData, BlockScanTask } from './monitor-types.js';
import type { MonitorEventEmitter } from '../events/index.js';
/**
 * Scanner statistics
 */
export interface ScannerStats {
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    totalTransfers: number;
    averageBlockTime: number;
    averageResponseTime: number;
    lastScanTime: number;
}
/**
 * Scan task priority levels
 */
export declare enum ScanPriority {
    CRITICAL = 1,// Recovery catch-up at startup
    HIGH = 2,// Real-time scanning
    NORMAL = 3,// Regular maintenance
    LOW = 4
}
/**
 * Blockchain scanner for a specific chain
 */
export declare class ChainScanner {
    private readonly logger;
    private readonly chain;
    private readonly adapter;
    private readonly eventEmitter;
    private stats;
    private readonly responseTimeSamples;
    private readonly blockTimeSamples;
    private readonly maxSamples;
    constructor(chain: Chain, adapter: BaseAdapter, eventEmitter: MonitorEventEmitter<MonitorEventData>);
    /**
     * Execute a block scan task
     */
    executeScanTask(task: BlockScanTask, targets: readonly MonitoringTarget[]): Promise<BlockScanResult>;
    /**
     * Scan for latest blocks (normal mode)
     */
    scanLatestBlocks(task: BlockScanTask, // Now receives a fully formed task
    safeBlockDistance: number, // Still needed to calculate safeBlock
    targets: readonly MonitoringTarget[]): Promise<{
        scannedToBlock: number;
        transfers: readonly TransferEvent[];
    }>;
    /**
     * Get scanner statistics
     */
    getStats(): ScannerStats;
    /**
     * Check if adapter is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get current block number
     */
    getCurrentBlockNumber(): Promise<number>;
    /**
     * Get transaction receipt
     */
    getTransactionReceipt(transactionHash: string): Promise<{
        blockNumber: number;
        transactionHash: string;
        status: boolean;
        gasUsed?: number;
        logs?: any[];
    } | null>;
    /**
     * Process discovered transfers
     */
    private processTransfers;
    /**
     * Check if transfer matches any target
     */
    private matchesTargets;
    /**
     * Extract unique contracts from targets
     */
    private extractContracts;
    /**
     * Extract unique addresses from targets
     */
    private extractAddresses;
    /**
     * Update scanner statistics
     */
    private updateStats;
}
/**
 * Multi-chain scanner coordinator
 */
export declare class MultiChainScanner {
    private readonly logger;
    private readonly scanners;
    private readonly eventEmitter;
    constructor(eventEmitter: MonitorEventEmitter<MonitorEventData>);
    /**
     * Add scanner for a chain
     */
    addScanner(chain: Chain, adapter: BaseAdapter): void;
    /**
     * Remove scanner for a chain
     */
    removeScanner(chain: Chain): void;
    /**
     * Get scanner for a chain
     */
    getScanner(chain: Chain): ChainScanner | undefined;
    /**
     * Get all active chains
     */
    getActiveChains(): readonly Chain[];
    /**
     * Get combined statistics
     */
    getCombinedStats(): Record<Chain, ScannerStats>;
    /**
     * Check health of all scanners
     */
    checkAllHealth(): Promise<Map<Chain, boolean>>;
    /**
     * Get current block numbers for all chains
     */
    getCurrentBlocks(): Promise<Map<Chain, number>>;
}
//# sourceMappingURL=scanner.d.ts.map