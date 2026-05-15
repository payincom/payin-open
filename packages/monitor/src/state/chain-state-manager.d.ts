/**
 * Chain state manager for monitoring progress tracking
 */
import type { Chain, MonitoringTarget, ScanSettings } from '../types/index.js';
import type { ChainScanState } from '../config/index.js';
import { MonitorEventEmitter } from '../events/index.js';
/**
 * Chain state manager handles monitoring progress for all chains
 */
export declare class ChainStateManager {
    private readonly logger;
    private readonly states;
    private readonly eventEmitter;
    private readonly config;
    constructor(config: any, eventEmitter: MonitorEventEmitter<any>);
    /**
     * Set chain progress (block number)
     */
    setChainProgress(chain: Chain, blockNumber: number): void;
    /**
     * Initialize chain states from config
     */
    private initializeStates;
    /**
     * Get state for a specific chain
     */
    getState(chain: Chain): ChainScanState | undefined;
    /**
     * Get all chain states
     */
    getAllStates(): ReadonlyMap<Chain, ChainScanState>;
    /**
     * Get configured chains
     */
    getConfiguredChains(): Chain[];
    /**
     * Add monitoring targets to relevant chains
     */
    addTargets(targets: readonly MonitoringTarget[]): void;
    /**
     * Remove monitoring targets from relevant chains
     */
    removeTargets(targets: readonly MonitoringTarget[]): void;
    /**
     * Update last watched block and emit progress event
     */
    updateProgress(chain: Chain, fromBlock: number, toBlock: number): void;
    /**
     * Get chains with active targets
     */
    getActiveChainsWithTargets(): Chain[];
    /**
     * Get active contracts for a chain
     */
    getActiveContracts(chain: Chain): string[];
    /**
     * Get active addresses for a contract on a chain
     */
    getActiveAddresses(chain: Chain, contract: string): string[];
    /**
     * Check if a target is active
     */
    isTargetActive(chain: Chain, contract: string, address: string): boolean;
    /**
     * Get scan settings for a chain
     */
    getScanSettings(chain: Chain): ScanSettings | undefined;
    /**
     * Get next scan block for a chain
     */
    getNextScanBlock(chain: Chain): number | undefined;
    /**
     * Get target block for recovery mode
     */
    getTargetBlock(chain: Chain): number | undefined;
    /**
     * Get recovery progress for all chains
     */
    getRecoveryProgress(): {
        totalChains: number;
        completedChains: number;
        averageProgress: number;
        chainProgress: Array<{
            chain: Chain;
            progress: number;
        }>;
    };
    /**
     * Get comprehensive state summary
     */
    getStateSummary(): {
        totalChains: number;
        activeChainsCount: number;
        progress: {
            totalChains: number;
            completedChains: number;
            averageProgress: number;
            chainProgress: Array<{
                chain: Chain;
                progress: number;
            }>;
        };
        chains: {
            chain: Chain;
            lastWatchedBlock: number;
            targetBlock: number | undefined;
            totalContracts: number;
            totalAddresses: number;
            scanSettings: ScanSettings;
        }[];
    };
    /**
     * Reset all chain states (for testing)
     */
    reset(): void;
}
//# sourceMappingURL=chain-state-manager.d.ts.map