/**
 * Blockchain scanner implementation
 * Handles block scanning logic for unified monitoring
 */

import type { Chain, MonitoringTarget, TransferEvent } from '../types/index.js'
import type { BaseAdapter, BlockScanRequest, BlockScanResult } from '../adapters/index.js'
import { EventPatterns } from '../events/index.js'
import type { MonitorEventData, BlockScanTask, ChainMonitoringState } from './monitor-types.js'
import type { MonitorEventEmitter } from '../events/index.js'
import { createLogger, LogCategory } from '@payin/shared'

/**
 * Scanner statistics
 */
export interface ScannerStats {
  totalScans: number
  successfulScans: number
  failedScans: number
  totalTransfers: number
  averageBlockTime: number
  averageResponseTime: number
  lastScanTime: number
}

/**
 * Scan task priority levels
 */
export enum ScanPriority {
  CRITICAL = 1,    // Recovery catch-up at startup
  HIGH = 2,        // Real-time scanning
  NORMAL = 3,      // Regular maintenance
  LOW = 4          // Background optimization
}

/**
 * Blockchain scanner for a specific chain
 */
export class ChainScanner {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly chain: Chain
  private readonly adapter: BaseAdapter
  private readonly eventEmitter: MonitorEventEmitter<MonitorEventData>
  
  private stats: ScannerStats = {
    totalScans: 0,
    successfulScans: 0,
    failedScans: 0,
    totalTransfers: 0,
    averageBlockTime: 0,
    averageResponseTime: 0,
    lastScanTime: 0
  }
  
  private readonly responseTimeSamples: number[] = []
  private readonly blockTimeSamples: number[] = []
  private readonly maxSamples = 100

  constructor(
    chain: Chain, 
    adapter: BaseAdapter, 
    eventEmitter: MonitorEventEmitter<MonitorEventData>
  ) {
    this.chain = chain
    this.adapter = adapter
    this.eventEmitter = eventEmitter
  }

  /**
   * Execute a block scan task
   */
  async executeScanTask(task: BlockScanTask, targets: readonly MonitoringTarget[]): Promise<BlockScanResult> {
    const startTime = Date.now()
    this.stats.totalScans++

    try {
      this.logger.debug('Executing block scan task', {
        chain: this.chain,
        fromBlock: task.fromBlock,
        toBlock: task.toBlock,
        targetCount: targets.length,
        taskId: task.id
      })

      // Extract contracts and addresses from targets
      const contracts = this.extractContracts(targets)
      const addresses = this.extractAddresses(targets)

      // Scan request prepared - details logged at debug level to reduce noise

      // Prepare scan request
      const request: BlockScanRequest = {
        chain: this.chain,
        fromBlock: task.fromBlock,
        toBlock: task.toBlock,
        contracts,
        addresses,
        taskId: task.id
      }

      // Execute the scan
      const result = await this.adapter.scanBlocks(request)
      
      // Update statistics
      this.updateStats(result, startTime)

      if (result.success) {
        this.stats.successfulScans++

        // CRITICAL BUG FIX: Ensure transfers are processed even if empty
        try {
          await this.processTransfers(result.transfers, targets)
        } catch (error) {
          this.logger.error('Failed to process transfers', {
            chain: this.chain,
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error)
          })
          throw error
        }
        
        // Emit block progress event
        this.eventEmitter.emit('blockProgress', {
          chain: this.chain,
          blockNumber: task.toBlock,
          timestamp: Date.now()
        })
        
        if (result.transfers.length > 0) {
          this.logger.info('Transfers found in scan', {
            chain: this.chain,
            transferCount: result.transfers.length,
            fromBlock: task.fromBlock,
            toBlock: task.toBlock
          })
        }
      } else {
        this.stats.failedScans++
        this.logger.error('Block scan failed', {
          chain: this.chain,
          fromBlock: task.fromBlock,
          toBlock: task.toBlock,
          error: result.error
        })
        
        this.eventEmitter.emit('error', {
          chain: this.chain,
          error: new Error(result.error || 'Scan failed'),
          timestamp: Date.now(),
          context: `Block scan ${task.fromBlock}-${task.toBlock}`
        })
      }
      
      return result
      
    } catch (error) {
      this.stats.failedScans++
      const responseTime = Date.now() - startTime
      
      this.logger.error('Block scan exception', {
        chain: this.chain,
        fromBlock: task.fromBlock,
        toBlock: task.toBlock,
        error: (error as Error).message
      })
      
      this.eventEmitter.emit('error', {
        chain: this.chain,
        error: error as Error,
        timestamp: Date.now(),
        context: `Block scan ${task.fromBlock}-${task.toBlock}`
      })
      
      return {
        success: false,
        fromBlock: task.fromBlock,
        toBlock: task.toBlock,
        transfers: [],
        error: (error as Error).message,
        responseTime
      }
    }
  }

  /**
   * Scan for latest blocks (normal mode)
   */
  async scanLatestBlocks(
    task: BlockScanTask, // Now receives a fully formed task
    safeBlockDistance: number, // Still needed to calculate safeBlock
    targets: readonly MonitoringTarget[] // Still needed for filtering
  ): Promise<{ scannedToBlock: number; transfers: readonly TransferEvent[] }> {
    try {
      // Get current block number
      const currentBlock = await this.adapter.getCurrentBlockNumber()
      const safeBlock = currentBlock - safeBlockDistance

      // The task already contains fromBlock and toBlock, but we need to ensure
      // we don't scan beyond the current safe block.
      const actualToBlock = Math.min(task.toBlock, safeBlock);

      if (actualToBlock <= task.fromBlock) { // No new blocks to scan in this range
        return { scannedToBlock: task.fromBlock - 1, transfers: [] } // Return block before start if nothing to scan
      }

      // Adjust task for actual scan range
      const adjustedTask: BlockScanTask = {
        ...task,
        toBlock: actualToBlock
      };
      
      // Execute scan
      const result = await this.executeScanTask(adjustedTask, targets)

      this.logger.debug(`🔍 DEBUG: scanLatestBlocks executeScanTask completed`, {
        chain: this.chain,
        fromBlock: adjustedTask.fromBlock,
        toBlock: adjustedTask.toBlock,
        success: result.success,
        transfersCount: result.transfers.length,
        taskId: adjustedTask.id
      })

      return {
        scannedToBlock: result.success ? adjustedTask.toBlock : adjustedTask.fromBlock - 1, // If failed, return block before start
        transfers: result.transfers
      }
      
    } catch (error) {
      this.logger.error('Failed to scan latest blocks', {
        chain: this.chain,
        fromBlock: task.fromBlock,
        toBlock: task.toBlock,
        error: error instanceof Error ? error.message : String(error)
      })
      return { scannedToBlock: task.fromBlock - 1, transfers: [] } // If failed, return block before start
    }
  }


  /**
   * Get scanner statistics
   */
  getStats(): ScannerStats {
    return { ...this.stats }
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    return await this.adapter.isHealthy()
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    return await this.adapter.getCurrentBlockNumber()
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(transactionHash: string): Promise<{
    blockNumber: number;
    transactionHash: string;
    status: boolean;
    gasUsed?: number;
    logs?: any[];
  } | null> {
    return await this.adapter.getTransactionReceipt(transactionHash)
  }

  /**
   * Process discovered transfers
   */
  private async processTransfers(
    transfers: readonly TransferEvent[],
    targets: readonly MonitoringTarget[]
  ): Promise<void> {
    this.logger.debug(`Processing ${transfers.length} transfers for ${targets.length} targets on ${this.chain}`)

    if (transfers.length === 0) return

    this.stats.totalTransfers += transfers.length

    // NOTE: Transfers are already filtered by adapter layer
    // No need to filter again since adapter only returns transfers matching our targets
    const relevantTransfers = transfers

    this.logger.debug(`🔍 DEBUG: relevantTransfers filtered`, {
      chain: this.chain,
      originalCount: transfers.length,
      relevantCount: relevantTransfers.length
    })

    if (relevantTransfers.length === 0) return

    // Emit individual transfer events
    for (const transfer of relevantTransfers) {
      this.logger.debug(`🔍 DEBUG: Processing individual transfer`, {
        chain: this.chain,
        txHash: transfer.transactionHash,
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount
      })

      // Generate all transfer event patterns
      const patterns = EventPatterns.getTransferPatterns(transfer)

      this.logger.debug(`🔍 DEBUG: Generated ${patterns.length} event patterns`, {
        chain: this.chain,
        txHash: transfer.transactionHash,
        patterns: patterns
      })

      // Emit for each pattern level
      for (const pattern of patterns) {
        this.logger.debug(`Emitting ${pattern} for tx ${transfer.transactionHash.slice(0, 10)}...`)
        this.eventEmitter.emit(pattern as any, transfer)
      }
    }

    // Emit batch event if multiple transfers
    if (relevantTransfers.length > 1) {
      this.logger.debug(`🔍 DEBUG: Emitting transferBatch event`, {
        chain: this.chain,
        batchSize: relevantTransfers.length
      })
      this.eventEmitter.emit('transferBatch', relevantTransfers)
    }
  }

  /**
   * Check if transfer matches any target
   */
  private matchesTargets(
    transfer: TransferEvent,
    targets: readonly MonitoringTarget[]
  ): boolean {
    return targets.some(target =>
      target.chain === transfer.chain &&
      target.contract === transfer.contract &&
      target.to === transfer.to
    )
  }

  /**
   * Extract unique contracts from targets
   */
  private extractContracts(targets: readonly MonitoringTarget[]): string[] {
    const contracts = new Set<string>()
    
    for (const target of targets) {
      if (target.chain === this.chain) {
        contracts.add(target.contract)
      }
    }
    
    return Array.from(contracts)
  }

  /**
   * Extract unique addresses from targets
   */
  private extractAddresses(targets: readonly MonitoringTarget[]): string[] {
    const addresses = new Set<string>()
    
    for (const target of targets) {
      if (target.chain === this.chain) {
        addresses.add(target.to)
      }
    }
    
    return Array.from(addresses)
  }

  /**
   * Update scanner statistics
   */
  private updateStats(result: BlockScanResult, startTime: number): void {
    const responseTime = Date.now() - startTime
    
    // Update response time samples
    this.responseTimeSamples.push(responseTime)
    if (this.responseTimeSamples.length > this.maxSamples) {
      this.responseTimeSamples.shift()
    }
    
    // Calculate average response time
    this.stats.averageResponseTime = this.responseTimeSamples.reduce((a, b) => a + b, 0) / 
                                    this.responseTimeSamples.length
    
    // Update block time if we have multiple blocks
    const blockCount = result.toBlock - result.fromBlock + 1
    if (blockCount > 1 && result.success) {
      const blockTime = responseTime / blockCount
      this.blockTimeSamples.push(blockTime)
      
      if (this.blockTimeSamples.length > this.maxSamples) {
        this.blockTimeSamples.shift()
      }
      
      this.stats.averageBlockTime = this.blockTimeSamples.reduce((a, b) => a + b, 0) / 
                                   this.blockTimeSamples.length
    }
    
    this.stats.lastScanTime = Date.now()
  }
}

/**
 * Multi-chain scanner coordinator
 */
export class MultiChainScanner {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly scanners = new Map<Chain, ChainScanner>()
  private readonly eventEmitter: MonitorEventEmitter<MonitorEventData>

  constructor(eventEmitter: MonitorEventEmitter<MonitorEventData>) {
    this.eventEmitter = eventEmitter
  }

  /**
   * Add scanner for a chain
   */
  addScanner(chain: Chain, adapter: BaseAdapter): void {
    if (this.scanners.has(chain)) {
      throw new Error(`Scanner already exists for chain: ${chain}`)
    }

    const scanner = new ChainScanner(chain, adapter, this.eventEmitter)
    this.scanners.set(chain, scanner)
    
    this.logger.info('Scanner added for chain', { chain })
  }

  /**
   * Remove scanner for a chain
   */
  removeScanner(chain: Chain): void {
    if (this.scanners.delete(chain)) {
      this.logger.info('Scanner removed for chain', { chain })
    }
  }

  /**
   * Get scanner for a chain
   */
  getScanner(chain: Chain): ChainScanner | undefined {
    return this.scanners.get(chain)
  }

  /**
   * Get all active chains
   */
  getActiveChains(): readonly Chain[] {
    return Array.from(this.scanners.keys())
  }

  /**
   * Get combined statistics
   */
  getCombinedStats(): Record<Chain, ScannerStats> {
    const stats: Record<string, ScannerStats> = {}
    
    for (const [chain, scanner] of this.scanners) {
      stats[chain] = scanner.getStats()
    }
    
    return stats as Record<Chain, ScannerStats>
  }

  /**
   * Check health of all scanners
   */
  async checkAllHealth(): Promise<Map<Chain, boolean>> {
    const health = new Map<Chain, boolean>()
    
    const healthChecks = Array.from(this.scanners.entries()).map(
      async ([chain, scanner]) => ({
        chain,
        healthy: await scanner.isHealthy().catch(() => false)
      })
    )
    
    const results = await Promise.allSettled(healthChecks)
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        health.set(result.value.chain, result.value.healthy)
      }
    }
    
    return health
  }

  /**
   * Get current block numbers for all chains
   */
  async getCurrentBlocks(): Promise<Map<Chain, number>> {
    const blocks = new Map<Chain, number>()
    
    const blockChecks = Array.from(this.scanners.entries()).map(
      async ([chain, scanner]) => ({
        chain,
        block: await scanner.getCurrentBlockNumber().catch(() => -1)
      })
    )
    
    const results = await Promise.allSettled(blockChecks)
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.block >= 0) {
        blocks.set(result.value.chain, result.value.block)
      }
    }
    
    return blocks
  }
}