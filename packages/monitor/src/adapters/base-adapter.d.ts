import type { Chain, TransferEvent, MonitoringTarget, Protocol } from '../types/index.js';
/**
 * Network RPC capabilities - different networks support different filter combinations
 */
export interface NetworkRPCCapabilities {
    readonly supportsMultiContractFiltering: boolean;
    readonly supportsMultiAddressFiltering: boolean;
    readonly maxContractsPerFilter: number;
    readonly maxAddressesPerFilter: number;
    readonly supportsBatchRequests: boolean;
}
/**
 * Block scan request for protocol adapters
 */
export interface BlockScanRequest {
    readonly chain: Chain;
    readonly fromBlock: number;
    readonly toBlock: number;
    readonly contracts: readonly string[];
    readonly addresses: readonly string[];
    readonly taskId?: string;
    readonly isRecoveryMode?: boolean;
}
/**
 * Scan result from protocol adapter
 */
export interface BlockScanResult {
    readonly success: boolean;
    readonly fromBlock: number;
    readonly toBlock: number;
    readonly transfers: readonly TransferEvent[];
    readonly error?: string;
    readonly responseTime: number;
}
/**
 * Abstract base class for protocol adapters
 */
export declare abstract class BaseAdapter {
    protected readonly chain: Chain;
    protected readonly protocol: Protocol;
    constructor(chain: Chain, protocol: Protocol);
    /**
     * Get network RPC capabilities
     */
    abstract getCapabilities(): NetworkRPCCapabilities;
    /**
     * Initialize the adapter
     */
    abstract initialize(): Promise<void>;
    /**
     * Scan blocks for transfer events
     */
    abstract scanBlocks(request: BlockScanRequest): Promise<BlockScanResult>;
    /**
     * Get current block number
     */
    abstract getCurrentBlockNumber(): Promise<number>;
    /**
     * Check if adapter is healthy and responsive
     */
    abstract isHealthy(): Promise<boolean>;
    /**
     * Get transaction receipt for confirmation
     * @param transactionHash Transaction hash to look up
     * @returns Transaction receipt or null if not found
     */
    abstract getTransactionReceipt(transactionHash: string): Promise<{
        blockNumber: number;
        transactionHash: string;
        status: boolean;
        gasUsed?: number;
        logs?: any[];
    } | null>;
    /**
     * Clean up adapter resources
     */
    abstract destroy(): Promise<void>;
    /**
     * Get protocol
     */
    getProtocol(): Protocol;
    /**
     * Get chain
     */
    getChain(): Chain;
    /**
     * Filter targets by chain (utility method)
     */
    protected filterTargetsByChain(targets: readonly MonitoringTarget[]): MonitoringTarget[];
    /**
     * Group targets by contract (utility method)
     */
    protected groupTargetsByContract(targets: readonly MonitoringTarget[]): Map<string, string[]>;
    /**
     * Extract unique contracts from targets (utility method)
     */
    protected extractContracts(targets: readonly MonitoringTarget[]): string[];
    /**
     * Extract unique addresses from targets (utility method)
     */
    protected extractAddresses(targets: readonly MonitoringTarget[]): string[];
    /**
     * Check if transfer event matches any target
     */
    protected matchesTargets(transfer: TransferEvent, targets: readonly MonitoringTarget[]): boolean;
    /**
     * Validate transfer event (utility method)
     */
    protected validateTransferEvent(transfer: Partial<TransferEvent>): transfer is TransferEvent;
}
//# sourceMappingURL=base-adapter.d.ts.map