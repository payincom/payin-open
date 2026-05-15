import type { Chain, ScanSettings, MonitoringTarget } from '../types/index.js';
/**
 * Chain scan state for tracking monitoring progress
 */
export interface ChainScanState {
    readonly chain: Chain;
    lastWatchedBlock: number;
    readonly targetBlock?: number | undefined;
    readonly activeTargets: Map<string, Set<string>>;
    readonly scanSettings: ScanSettings;
}
/**
 * Create initial chain scan state
 */
export declare function createChainScanState(chain: Chain, startBlock: number, scanSettings: ScanSettings, targetBlock?: number): ChainScanState;
/**
 * Add monitoring targets to chain state
 */
export declare function addTargetsToChainState(state: ChainScanState, targets: readonly MonitoringTarget[]): void;
/**
 * Remove monitoring targets from chain state
 */
export declare function removeTargetsFromChainState(state: ChainScanState, targets: readonly MonitoringTarget[]): void;
/**
 * Check if chain has active targets
 */
export declare function hasActiveTargets(state: ChainScanState): boolean;
/**
 * Get all active contracts for a chain
 */
export declare function getActiveContracts(state: ChainScanState): string[];
/**
 * Get all active addresses for a contract
 */
export declare function getActiveAddresses(state: ChainScanState, contract: string): string[];
/**
 * Check if a target is active
 */
export declare function isTargetActive(state: ChainScanState, contract: string, address: string): boolean;
/**
 * Update last watched block
 */
export declare function updateLastWatchedBlock(state: ChainScanState, blockNumber: number): void;
/**
 * Get summary of chain state
 */
export declare function getChainStateSummary(state: ChainScanState): {
    chain: Chain;
    lastWatchedBlock: number;
    targetBlock: number | undefined;
    totalContracts: number;
    totalAddresses: number;
    scanSettings: ScanSettings;
};
//# sourceMappingURL=chain-state.d.ts.map