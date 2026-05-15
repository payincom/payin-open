/**
 * Core Monitor Engine - Final Refactoring with API Restoration and Hardcoded Dependency
 */
import type { Chain, MonitoringTarget } from '../types/index.js';
import { AdapterFactory } from '../adapters/index.js';
import { MonitorEventEmitter } from '../events/index.js';
import type { MonitorConfig, MonitorOptions } from '../types/index.js';
import type { MonitorStats, MonitorStatus, MonitorEventData } from './monitor-types.js';
export declare class Monitor extends MonitorEventEmitter<MonitorEventData> {
    private readonly logger;
    private readonly config;
    private readonly adapterFactory;
    private readonly stateManager;
    private readonly targetManager;
    private readonly scanner;
    private rpcManager;
    private status;
    private startTime;
    private adapters;
    private chainStates;
    private stats;
    private scanStartTimes;
    private isAllChainsSynced;
    private scanInterval?;
    constructor(config: MonitorConfig, adapterFactory?: AdapterFactory, options?: MonitorOptions);
    start(options?: MonitorOptions): Promise<void>;
    stop(): Promise<void>;
    watch(targets: readonly MonitoringTarget[]): Promise<void>;
    unwatch(targets: readonly MonitoringTarget[]): Promise<void>;
    watchAddressMatrix(address: string, chainFamily: 'evm' | 'tron' | 'solana', tokenContracts: Record<string, Record<string, string>>): Promise<MonitoringTarget[]>;
    unwatchAddressMatrix(address: string, chainFamily: 'evm' | 'tron' | 'solana', tokenContracts: Record<string, Record<string, string>>): Promise<MonitoringTarget[]>;
    validateTransaction(chain: Chain, transactionHash: string): Promise<{
        isValid: boolean;
        blockNumber?: number;
        currentConfirmations?: number;
        error?: string;
    }>;
    getStatus(): MonitorStatus;
    getMonitorStats(): MonitorStats;
    /**
     * FOR TESTING PURPOSES ONLY
     * Gets the current number of active monitoring targets.
     * @returns The number of targets.
     */
    getInternalTargetCount(): number;
    private _getChainsByFamily;
    private startScanning;
    private executeScanCycle;
    private executeRecoveryScanForChain;
    private executeNormalScanForChain;
    private processScanResult;
    private updateChainHealth;
    private tryAcquireScanLock;
    private releaseScanLock;
    private setStatus;
    private createInitialStats;
    private clearIntervals;
    private initializeRPCManager;
    private initializeAdapters;
    private setupScanners;
    private setupTargets;
    private initializeState;
    saveState(): Promise<void>;
    private startIntervals;
    private updateAllChainsSyncedStatus;
    /**
     * Destroy adapters
     */
    private destroyAdapters;
}
//# sourceMappingURL=monitor.d.ts.map