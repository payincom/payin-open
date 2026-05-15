/**
 * EVM adapter for Ethereum-compatible chains
 * Implements basic block scanning with ethers.js
 */
import type { Chain } from '../types/index.js';
import { BaseAdapter, type NetworkRPCCapabilities, type BlockScanRequest, type BlockScanResult } from './base-adapter.js';
import type { RPCManager } from '../rpc/index.js';
/**
 * EVM adapter implementation
 */
export declare class EVMAdapter extends BaseAdapter {
    private readonly logger;
    private readonly rpcManager;
    private provider?;
    constructor(chain: Chain, rpcManager: RPCManager);
    /**
     * Validate chain is EVM compatible
     */
    private validateChain;
    /**
     * Get network capabilities
     */
    getCapabilities(): NetworkRPCCapabilities;
    /**
     * Initialize the adapter
     */
    initialize(): Promise<void>;
    /**
     * Get current block number
     */
    getCurrentBlockNumber(): Promise<number>;
    /**
     * Scan blocks for transfer events
     */
    scanBlocks(request: BlockScanRequest): Promise<BlockScanResult>;
    /**
     * Get transfer events using contract-level batch filtering
     */
    private getTransferEvents;
    /**
     * Get transfer events for a batch of contracts using single JSON-RPC call
     */
    private getBatchTransferEvents;
    /**
     * Parse transfer log to TransferEvent
     */
    private parseTransferLog;
    /**
     * Check if adapter is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get transaction receipt for confirmation
     */
    getTransactionReceipt(transactionHash: string): Promise<{
        blockNumber: number;
        transactionHash: string;
        status: boolean;
        gasUsed?: number;
        logs?: any[];
    } | null>;
    /**
     * Clean up adapter resources
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=evm-adapter.d.ts.map