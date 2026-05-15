import { EventEmitter } from 'events'
import type { Monitor } from '@payin/monitor'
import type { Chain, TransferEvent } from '@payin/monitor'
import { createLogger, LogCategory } from '@payin/shared'

/**
 * 业务上下文信息
 */
export interface BusinessContext {
  readonly type: 'order' | 'deposit'
  readonly id: string
  readonly entity: any
}

/**
 * 待确认交易信息
 */
export interface PendingTransaction {
  readonly txHash: string
  readonly blockNumber: number
  readonly chain: Chain
  readonly discoveredAt: number
  readonly requiredConfirmations: number
  readonly transferData: TransferEvent
  readonly businessContext?: BusinessContext
  retryCount: number
}

/**
 * 延迟确认服务配置
 */
export interface DelayedConfirmationConfig {
  readonly checkInterval: number          // 检查间隔(ms) - 默认30秒
  readonly maxPendingTime: number         // 最大等待时间(ms) - 默认10分钟
  readonly maxPendingTransactions: number // 最大待确认交易数 - 默认1000
  readonly maxRetries: number             // 最大重试次数 - 默认3
}

/**
 * 延迟确认服务
 * 
 * 优化RPC调用频率的核心思路：
 * 1. Monitor发现Transfer事件时，不立即确认
 * 2. 添加到待确认队列，定期批量检查
 * 3. 大幅降低RPC调用频率（从每区块检查改为定时批量检查）
 * 4. 尊重业务设置的requiredConfirmations，不擅自修改安全标准
 */
/**
 * Current block cache entry
 */
interface BlockCache {
  block: number
  timestamp: number
}

export class DelayedConfirmationService extends EventEmitter {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private pendingTransactions = new Map<string, PendingTransaction>()
  private checkInterval: NodeJS.Timeout | undefined
  private monitor: Monitor
  private config: DelayedConfirmationConfig
  private isRunning = false

  // Current block cache for RPC optimization (cache fresh for 15 seconds)
  private currentBlockCache = new Map<Chain, BlockCache>()
  private readonly CACHE_TTL_MS = 15000  // 15 seconds

  // 默认配置
  private static readonly DEFAULT_CONFIG: DelayedConfirmationConfig = {
    checkInterval: 30000,        // 30秒检查一次 (vs 之前每2-3秒)
    maxPendingTime: 600000,      // 10分钟超时
    maxPendingTransactions: 1000,
    maxRetries: 3
  }

  constructor(monitor: Monitor, config?: Partial<DelayedConfirmationConfig>) {
    super()
    this.monitor = monitor
    this.config = { ...DelayedConfirmationService.DEFAULT_CONFIG, ...config }

    // Subscribe to Monitor's blockScanned event for cache optimization
    this.setupBlockCacheListener()

    this.logger.info('DelayedConfirmationService initialized', {
      checkInterval: `${this.config.checkInterval}ms`,
      maxPendingTime: `${this.config.maxPendingTime/1000}s`,
      cacheTTL: `${this.CACHE_TTL_MS}ms`
    })
  }

  /**
   * Setup listener for Monitor's blockScanned event
   */
  private setupBlockCacheListener(): void {
    this.monitor.on('blockScanned', ({ chain, currentBlock, timestamp }) => {
      this.currentBlockCache.set(chain, { block: currentBlock, timestamp });
      this.logger.debug('Block cache updated', {
        chain,
        currentBlock,
        cacheSize: this.currentBlockCache.size
      });
    });
  }

  /**
   * Update the Monitor instance (used during recovery)
   */
  updateMonitor(newMonitor: Monitor): void {
    // Remove old listener
    if (this.monitor) {
      this.monitor.removeAllListeners('blockScanned');
    }

    // Update monitor reference
    this.monitor = newMonitor;

    // Re-setup block cache listener
    this.setupBlockCacheListener();

    this.logger.info('Monitor instance updated, block cache listener re-registered');
  }

  /**
   * 启动延迟确认服务
   */
  start(): void {
    this.logger.info('🚀 Attempting to start DelayedConfirmationService...');
    if (this.isRunning) {
      this.logger.warn('DelayedConfirmationService is already running');
      return;
    }

    this.isRunning = true
    
    // 定期检查待确认交易
    this.checkInterval = setInterval(
      () => this.checkPendingTransactions(),
      this.config.checkInterval
    )

    this.logger.info(`✅ DelayedConfirmationService started with check interval: ${this.config.checkInterval}ms`);
  }

  /**
   * 停止延迟确认服务
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }

    // Clear caches
    this.pendingTransactions.clear()
    this.currentBlockCache.clear()

    // Remove Monitor event listener
    if (this.monitor) {
      this.monitor.removeAllListeners('blockScanned');
    }

    this.removeAllListeners()

    this.logger.info('DelayedConfirmationService stopped, caches cleared')
  }

  /**
   * 添加待确认交易
   */
  addPendingTransaction(
    transfer: TransferEvent,
    requiredConfirmations: number = 3,
    businessContext?: BusinessContext
  ): void {
    // 检查是否超过最大待确认数量
    if (this.pendingTransactions.size >= this.config.maxPendingTransactions) {
      this.logger.warn('Pending confirmations limit reached, dropping oldest', {
        limit: this.config.maxPendingTransactions
      })
      this.dropOldestTransaction()
    }

    const pendingTx: PendingTransaction = {
      txHash: transfer.transactionHash,
      blockNumber: transfer.blockNumber,
      chain: transfer.chain,
      discoveredAt: Date.now(),
      requiredConfirmations,
      transferData: transfer,
      businessContext,
      retryCount: 0
    }

    this.pendingTransactions.set(transfer.transactionHash, pendingTx)

    this.logger.debug('Added pending transaction', {
      transactionHash: transfer.transactionHash,
      blockNumber: transfer.blockNumber,
      chain: transfer.chain,
      totalPending: this.pendingTransactions.size
    })

    // 立即发出初始处理事件，让Processor处理数据库记录和金额更新
    this.emit('initialProcessing', {
      txHash: transfer.transactionHash,
      chain: transfer.chain,
      blockNumber: transfer.blockNumber,
      businessContext,
      transferData: transfer
    })
  }

  /**
   * 检查所有待确认交易
   */
  private async checkPendingTransactions(): Promise<void> {
    if (this.pendingTransactions.size === 0) {
      return
    }

    this.logger.debug('Checking pending transactions', {
      pendingCount: this.pendingTransactions.size
    })

    const checkPromises = Array.from(this.pendingTransactions.values()).map(
      pending => this.processPendingTransaction(pending)
    )

    // 并行检查所有待确认交易
    await Promise.allSettled(checkPromises)

    // 清理过期交易
    this.cleanupExpiredTransactions()
  }

  /**
   * Get cached or fetch current block number
   * Optimization: Try to use cached currentBlock from Monitor's blockScanned event
   */
  private async getCurrentBlockNumber(chain: Chain): Promise<number> {
    const cached = this.currentBlockCache.get(chain);
    const isCacheFresh = cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS);

    if (isCacheFresh) {
      this.logger.debug('Using cached currentBlock', {
        chain,
        cachedBlock: cached.block,
        cacheAge: Date.now() - cached.timestamp
      });
      return cached.block;
    }

    // Cache miss or expired, fetch via RPC
    this.logger.debug('Cache miss or expired, fetching currentBlock via RPC', {
      chain,
      hasCached: !!cached,
      cacheExpired: cached ? (Date.now() - cached.timestamp >= this.CACHE_TTL_MS) : false
    });

    const scanner = (this.monitor as any).scanner?.getScanner(chain);
    if (!scanner) {
      throw new Error(`No scanner available for chain: ${chain}`);
    }

    return await scanner.getCurrentBlockNumber();
  }

  /**
   * 处理单个待确认交易
   * Optimized with currentBlock caching to reduce RPC calls by ~50%
   */
  private async processPendingTransaction(pending: PendingTransaction): Promise<void> {
    try {
      // 1. Get transaction receipt (always RPC call - required for validation)
      const scanner = (this.monitor as any).scanner?.getScanner(pending.chain);
      if (!scanner) {
        throw new Error(`No scanner available for chain: ${pending.chain}`);
      }

      const receipt = await scanner.getTransactionReceipt(pending.txHash);

      // 2. Validate transaction exists and succeeded
      if (!receipt) {
        // Increment retry count for temporary API failures (e.g., Tron indexing delay)
        pending.retryCount++;

        if (pending.retryCount >= this.config.maxRetries) {
          // Max retries exceeded, transaction likely doesn't exist
          this.logger.error('Transaction not found after max retries (possible reorg)', {
            txHash: pending.txHash,
            chain: pending.chain,
            retryCount: pending.retryCount,
            maxRetries: this.config.maxRetries
          });

          this.pendingTransactions.delete(pending.txHash);
          this.emit('transactionInvalid', {
            txHash: pending.txHash,
            chain: pending.chain,
            blockNumber: pending.blockNumber,
            businessContext: pending.businessContext,
            error: 'Transaction not found after retries'
          });
          return;
        }

        // Still have retries left, keep in pending queue (handles API indexing delays)
        this.logger.warn('Transaction receipt not found, will retry', {
          txHash: pending.txHash,
          chain: pending.chain,
          retryCount: pending.retryCount,
          maxRetries: this.config.maxRetries,
          nextCheckIn: `${this.config.checkInterval/1000}s`
        });
        return; // Don't delete, will check again next cycle
      }

      if (!receipt.status) {
        this.logger.warn('Transaction failed', {
          txHash: pending.txHash,
          chain: pending.chain
        });

        this.pendingTransactions.delete(pending.txHash);
        this.emit('transactionInvalid', {
          txHash: pending.txHash,
          chain: pending.chain,
          blockNumber: pending.blockNumber,
          businessContext: pending.businessContext,
          error: 'Transaction execution failed'
        });
        return;
      }

      // 3. Get current block (optimized: try cache first, fallback to RPC)
      const currentBlock = await this.getCurrentBlockNumber(pending.chain);

      // 4. Calculate confirmations
      const currentConfirmations = currentBlock - receipt.blockNumber + 1;

      // Log validation result
      this.logger.info('Transaction validated', {
        txHash: pending.txHash,
        currentConfirmations,
        requiredConfirmations: pending.requiredConfirmations,
        receiptBlock: receipt.blockNumber,
        currentBlock
      })

      this.logger.debug('Transaction confirmation status', {
        chain: pending.chain,
        txHash: pending.txHash,
        currentConfirmations,
        requiredConfirmations: pending.requiredConfirmations
      })

      // 发出确认进度事件
      this.emit('confirmationProgress', {
        txHash: pending.txHash,
        chain: pending.chain,
        blockNumber: pending.blockNumber,
        currentConfirmations,
        requiredConfirmations: pending.requiredConfirmations,
        businessContext: pending.businessContext,
        transferData: pending.transferData
      })

      // 检查是否满足业务要求的确认数
      if (currentConfirmations >= pending.requiredConfirmations) {
        this.logger.info('Delayed confirmation completed', {
          txHash: pending.txHash,
          chain: pending.chain,
          confirmations: currentConfirmations,
          processingTimeSeconds: ((Date.now() - pending.discoveredAt)/1000).toFixed(1)
        })
        
        // 确认完成，移除并发出事件
        this.pendingTransactions.delete(pending.txHash)
        
        this.emit('transactionConfirmed', {
          txHash: pending.txHash,
          chain: pending.chain,
          blockNumber: pending.blockNumber,
          currentConfirmations,
          businessContext: pending.businessContext,
          transferData: pending.transferData,
          processingTime: Date.now() - pending.discoveredAt
        })
      } else {
        // 还需要等待更多确认
        const remainingConfirmations = pending.requiredConfirmations - currentConfirmations
        this.logger.debug('Transaction needs more confirmations', {
          chain: pending.chain,
          txHash: pending.txHash,
          remainingConfirmations
        })
      }

    } catch (error) {
      pending.retryCount++
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error('Failed to process pending transaction', {
        chain: pending.chain,
        txHash: pending.txHash,
        error: errorMessage,
        retryCount: pending.retryCount
      })

      if (pending.retryCount >= this.config.maxRetries) {
        this.logger.error('Max retries reached for pending transaction, removing', {
          chain: pending.chain,
          txHash: pending.txHash
        })
        this.pendingTransactions.delete(pending.txHash)
        
        this.emit('transactionFailed', {
          txHash: pending.txHash,
          chain: pending.chain,
          error: errorMessage,
          retryCount: pending.retryCount,
          businessContext: pending.businessContext
        })
      }
    }
  }

  /**
   * 清理过期的待确认交易
   */
  private cleanupExpiredTransactions(): void {
    const now = Date.now()
    const expiredTxs: string[] = []

    for (const [txHash, pending] of this.pendingTransactions) {
      if (now - pending.discoveredAt > this.config.maxPendingTime) {
        expiredTxs.push(txHash)
      }
    }

    if (expiredTxs.length > 0) {
      this.logger.debug('Cleaning up expired pending transactions', {
        expiredCount: expiredTxs.length
      })
      
      for (const txHash of expiredTxs) {
        const pending = this.pendingTransactions.get(txHash)
        if (pending) {
          this.pendingTransactions.delete(txHash)
          
          this.emit('transactionTimeout', {
            txHash: pending.txHash,
            chain: pending.chain,
            blockNumber: pending.blockNumber,
            businessContext: pending.businessContext,
            waitTime: now - pending.discoveredAt
          })
        }
      }
    }
  }

  /**
   * 移除最旧的待确认交易（当达到限制时）
   */
  private dropOldestTransaction(): void {
    let oldest: PendingTransaction | undefined
    let oldestTxHash = ''

    for (const [txHash, pending] of this.pendingTransactions) {
      if (!oldest || pending.discoveredAt < oldest.discoveredAt) {
        oldest = pending
        oldestTxHash = txHash
      }
    }

    if (oldest && oldestTxHash) {
      this.pendingTransactions.delete(oldestTxHash)
      this.logger.debug('Dropped oldest pending transaction', {
        txHash: oldestTxHash
      })
      
      this.emit('transactionDropped', {
        txHash: oldestTxHash,
        chain: oldest.chain,
        reason: 'capacity_limit'
      })
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPending: number
    byChain: Record<string, number>
    oldestPendingTime: number | null
    averageWaitTime: number
  } {
    const byChain: Record<string, number> = {}
    let oldestTime: number | null = null
    let totalWaitTime = 0
    const now = Date.now()

    for (const pending of this.pendingTransactions.values()) {
      byChain[pending.chain] = (byChain[pending.chain] || 0) + 1
      
      if (oldestTime === null || pending.discoveredAt < oldestTime) {
        oldestTime = pending.discoveredAt
      }
      
      totalWaitTime += now - pending.discoveredAt
    }

    const averageWaitTime = this.pendingTransactions.size > 0 ? 
      totalWaitTime / this.pendingTransactions.size : 0

    return {
      totalPending: this.pendingTransactions.size,
      byChain,
      oldestPendingTime: oldestTime,
      averageWaitTime
    }
  }

  /**
   * 强制检查特定交易
   */
  async forceCheckTransaction(txHash: string): Promise<boolean> {
    const pending = this.pendingTransactions.get(txHash)
    if (!pending) {
      this.logger.warn('Transaction not found in pending list', { txHash })
      return false
    }

    await this.processPendingTransaction(pending)
    return !this.pendingTransactions.has(txHash) // 如果已被移除，说明处理完成
  }
}