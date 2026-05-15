/**
 * Tron adapter for Tron blockchain
 * Implements basic block scanning with TronWeb
 */
import type { Chain } from '../types/index.js';
import { BaseAdapter, type NetworkRPCCapabilities, type BlockScanRequest, type BlockScanResult } from './base-adapter.js';
import type { RPCManager } from '../rpc/index.js';
/**
 * Tron adapter implementation
 */
export declare class TronAdapter extends BaseAdapter {
    private readonly logger;
    private tronWeb;
    private readonly rpcManager;
    constructor(chain: Chain, rpcManager: RPCManager);
    /**
     * Validate chain is Tron compatible
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
     * Get current block number using JSON-RPC
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
     * Convert Tron Base58 address to TronGrid-compatible hex format (20-byte Ethereum format)
     */
    private convertToTronGridFormat;
    /**
     * Convert TronGrid hex format back to Tron Base58 address
     */
    private convertHexToBase58;
    /**
     * Pad address to 32 bytes for event topics
     */
    private padToTopic;
    /**
     * Parse address from log topic (remove padding and convert back to Tron Base58)
     */
    private parseAddressFromTopic;
    /**
     * Parse amount from log data
     */
    private parseAmountFromData;
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
//# sourceMappingURL=tron-adapter.d.ts.map