import type {
  Chain,
  TransferEvent,
  MonitoringTarget,
  Protocol
} from '../types/index.js'

/**
 * Network RPC capabilities - different networks support different filter combinations
 */
export interface NetworkRPCCapabilities {
  readonly supportsMultiContractFiltering: boolean    // Can filter by multiple contracts in one call
  readonly supportsMultiAddressFiltering: boolean     // Can filter by multiple to/from addresses
  readonly maxContractsPerFilter: number              // Max contracts in single filter
  readonly maxAddressesPerFilter: number              // Max addresses in single filter
  readonly supportsBatchRequests: boolean             // Supports JSON-RPC batch requests
}

/**
 * Block scan request for protocol adapters
 */
export interface BlockScanRequest {
  readonly chain: Chain
  readonly fromBlock: number
  readonly toBlock: number
  readonly contracts: readonly string[]               // Contracts to monitor
  readonly addresses: readonly string[]               // Addresses to monitor (may be empty for contract-level filtering)
  readonly taskId?: string                           // Optional task identifier for logging
  readonly isRecoveryMode?: boolean                  // Whether this is a recovery mode scan
}

/**
 * Scan result from protocol adapter
 */
export interface BlockScanResult {
  readonly success: boolean
  readonly fromBlock: number
  readonly toBlock: number
  readonly transfers: readonly TransferEvent[]
  readonly error?: string
  readonly responseTime: number                      // Response time in milliseconds
}

/**
 * Abstract base class for protocol adapters
 */
export abstract class BaseAdapter {
  protected readonly chain: Chain
  protected readonly protocol: Protocol

  constructor(chain: Chain, protocol: Protocol) {
    this.chain = chain
    this.protocol = protocol
  }

  /**
   * Get network RPC capabilities
   */
  abstract getCapabilities(): NetworkRPCCapabilities

  /**
   * Initialize the adapter
   */
  abstract initialize(): Promise<void>

  /**
   * Scan blocks for transfer events
   */
  abstract scanBlocks(request: BlockScanRequest): Promise<BlockScanResult>

  /**
   * Get current block number
   */
  abstract getCurrentBlockNumber(): Promise<number>

  /**
   * Check if adapter is healthy and responsive
   */
  abstract isHealthy(): Promise<boolean>

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
  } | null>

  /**
   * Clean up adapter resources
   */
  abstract destroy(): Promise<void>

  /**
   * Get protocol
   */
  getProtocol(): Protocol {
    return this.protocol
  }

  /**
   * Get chain
   */
  getChain(): Chain {
    return this.chain
  }

  /**
   * Filter targets by chain (utility method)
   */
  protected filterTargetsByChain(targets: readonly MonitoringTarget[]): MonitoringTarget[] {
    return targets.filter(target => target.chain === this.chain)
  }

  /**
   * Group targets by contract (utility method)
   */
  protected groupTargetsByContract(targets: readonly MonitoringTarget[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>()
    
    for (const target of targets) {
      if (target.chain !== this.chain) continue
      
      const addresses = grouped.get(target.contract) ?? []
      addresses.push(target.to)
      grouped.set(target.contract, addresses)
    }
    
    return grouped
  }

  /**
   * Extract unique contracts from targets (utility method)
   */
  protected extractContracts(targets: readonly MonitoringTarget[]): string[] {
    const contracts = new Set<string>()
    
    for (const target of targets) {
      if (target.chain === this.chain) {
        contracts.add(target.contract)
      }
    }
    
    return Array.from(contracts)
  }

  /**
   * Extract unique addresses from targets (utility method)
   */
  protected extractAddresses(targets: readonly MonitoringTarget[]): string[] {
    const addresses = new Set<string>()
    
    for (const target of targets) {
      if (target.chain === this.chain) {
        addresses.add(target.to)
      }
    }
    
    return Array.from(addresses)
  }

  /**
   * Check if transfer event matches any target
   */
  protected matchesTargets(
    transfer: TransferEvent,
    targets: readonly MonitoringTarget[]
  ): boolean {
    for (const target of targets) {
      if (
        target.chain === transfer.chain &&
        target.contract === transfer.contract &&
        target.to === transfer.to
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Validate transfer event (utility method)
   */
  protected validateTransferEvent(transfer: Partial<TransferEvent>): transfer is TransferEvent {
    return !!(
      transfer.chain &&
      transfer.contract &&
      transfer.to &&
      transfer.from &&
      transfer.amount &&
      transfer.transactionHash &&
      typeof transfer.blockNumber === 'number' &&
      typeof transfer.logIndex === 'number' &&
      typeof transfer.timestamp === 'number'
    )
  }
}