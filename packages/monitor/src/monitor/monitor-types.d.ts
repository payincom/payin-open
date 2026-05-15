/**
 * Monitor core types and interfaces
 */
import type { Chain, MonitoringTarget, TransferEvent } from '../types/index.js';
/**
 * Monitor instance status
 */
export type MonitorStatus = 'stopped' | 'starting' | 'running' | 'pausing' | 'paused' | 'stopping' | 'error';
/**
 * Monitor statistics
 */
export interface MonitorStats {
    readonly status: MonitorStatus;
    readonly uptime: number;
    readonly totalTransfers: number;
    readonly transfersPerChain: Map<Chain, number>;
    readonly errorCount: number;
    readonly lastError?: string | undefined;
    readonly lastTransfer?: TransferEvent | undefined;
    readonly currentBlock: Map<Chain, number>;
    readonly targetCount: number;
    readonly chainsActive: number;
    readonly adaptersHealthy: number;
    readonly averageBlockTime: Map<Chain, number>;
    readonly rpcResponseTime: Map<Chain, number>;
}
/**
 * Block scan task for internal scheduling
 */
export interface BlockScanTask {
    readonly id: string;
    readonly chain: Chain;
    readonly fromBlock: number;
    readonly toBlock: number;
    readonly targets: readonly MonitoringTarget[];
    readonly priority: number;
    readonly retryCount: number;
    readonly createdAt: number;
    readonly scheduledAt?: number;
}
/**
 * Monitor performance metrics
 */
export interface MonitorPerformance {
    blocksPerSecond: Map<Chain, number>;
    transfersPerSecond: Map<Chain, number>;
    rpcCallsPerSecond: Map<Chain, number>;
    costPerHour: Map<Chain, number>;
    memoryUsage: number;
    cpuUsage?: number;
}
/**
 * Monitor event data types
 */
export interface MonitorEventData {
    'transfer': TransferEvent;
    'transferBatch': readonly TransferEvent[];
    'blockProgress': {
        chain: Chain;
        blockNumber: number;
        timestamp: number;
    };
    'syncStatusChanged': {
        isAllChainsSynced: boolean;
        timestamp: number;
    };
    'chainTargetReached': {
        chain: Chain;
        targetBlock: number;
        finalBlock: number;
    };
    'statusChanged': {
        oldStatus: MonitorStatus;
        newStatus: MonitorStatus;
        timestamp: number;
    };
    'error': {
        chain?: Chain;
        error: Error;
        timestamp: number;
        context?: string;
    };
    'performance': MonitorPerformance;
    'targetsUpdated': {
        added: readonly MonitoringTarget[];
        removed: readonly MonitoringTarget[];
        total: number;
    };
    'rpcRequestSuccess': {
        chain: Chain;
        endpoint: string;
        responseTime: number;
        timestamp: number;
    };
    'rpcRequestFailure': {
        chain: Chain;
        endpoint: string;
        error: string;
        attempt: number;
        timestamp: number;
    };
    'rpcEndpointFailed': {
        endpoint: string;
        chain: Chain;
        error?: string;
        timestamp: number;
    };
    'rpcEndpointRecovered': {
        endpoint: string;
        chain: Chain;
        timestamp: number;
    };
    'rpcConfigReloaded': {
        timestamp: number;
    };
}
/**
 * Monitor recovery state
 */
export interface MonitorRecoveryState {
    readonly timestamp: number;
    readonly lastBlock: Map<Chain, number>;
    readonly targets: readonly MonitoringTarget[];
    readonly stats: Partial<MonitorStats>;
}
/**
 * Chain monitoring state
 */
export interface ChainMonitoringState {
    readonly chain: Chain;
    readonly currentBlock: number;
    readonly lastProcessedBlock: number;
    readonly targetBlock?: number | undefined;
    readonly isHealthy: boolean;
    readonly lastError?: string | undefined;
    readonly blockProcessingRate: number;
    readonly transferDetectionRate: number;
    readonly lastActivity: number;
}
//# sourceMappingURL=monitor-types.d.ts.map