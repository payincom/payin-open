/**
 * Target manager for monitoring target lifecycle and validation
 */
import type { Chain, MonitoringTarget, MonitoringRequest, TransferEvent } from '../types/index.js';
/**
 * Target statistics
 */
interface TargetStatistics {
    readonly totalTargets: number;
    readonly targetsByChain: Map<Chain, number>;
    readonly targetsByContract: Map<string, number>;
    readonly uniqueAddresses: number;
    readonly uniqueContracts: number;
}
/**
 * Target manager handles monitoring target lifecycle
 */
export declare class TargetManager {
    private readonly logger;
    private readonly activeTargets;
    private readonly targetsByChain;
    private readonly targetsByContract;
    private readonly targetsByAddress;
    /**
     * Set all monitoring targets (replace existing)
     */
    setTargets(targets: readonly MonitoringTarget[]): Promise<void>;
    /**
     * Add array of targets and return added ones
     */
    addTargets(targets: readonly MonitoringTarget[]): Promise<MonitoringTarget[]>;
    /**
     * Remove array of targets and return removed ones
     */
    removeTargets(targets: readonly MonitoringTarget[]): Promise<MonitoringTarget[]>;
    /**
     * Add monitoring targets from request
     */
    addTargetsFromRequest(request: MonitoringRequest): void;
    /**
     * Remove monitoring targets from request
     */
    removeTargetsFromRequest(request: MonitoringRequest): void;
    /**
     * Add single monitoring target
     */
    private addTarget;
    /**
     * Remove single monitoring target
     */
    private removeTarget;
    /**
     * Check if target exists
     */
    hasTarget(target: MonitoringTarget): boolean;
    /**
     * Get all active targets
     */
    getAllTargets(): MonitoringTarget[];
    /**
     * Get targets for a specific chain
     */
    getTargetsByChain(chain: Chain): MonitoringTarget[];
    /**
     * Get targets for a specific contract
     */
    getTargetsByContract(contract: string): MonitoringTarget[];
    /**
     * Get targets for a specific address
     */
    getTargetsByAddress(address: string): MonitoringTarget[];
    /**
     * Get target count
     */
    getTargetCount(): number;
    /**
     * Get target statistics
     */
    getTargetStatistics(): TargetStatistics;
    /**
     * Check if target matches a transfer event
     */
    matchesTransfer(target: MonitoringTarget, transfer: TransferEvent): boolean;
    /**
     * Find targets that match a transfer event
     */
    findMatchingTargets(transfer: TransferEvent): MonitoringTarget[];
    /**
     * Clear all targets
     */
    clear(): void;
    /**
     * Validate monitoring target
     */
    private validateTarget;
    /**
     * Validate address format for chain
     */
    private isValidAddress;
    /**
     * Generate unique key for target
     */
    private getTargetKey;
    /**
     * Add target to index
     */
    private addToIndex;
    /**
     * Remove target from index
     */
    private removeFromIndex;
}
export {};
//# sourceMappingURL=target-manager.d.ts.map