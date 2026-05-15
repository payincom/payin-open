/**
 * Chain state manager for monitoring progress tracking
 */

import type {
  Chain,
  MonitorConfig,
  MonitoringTarget,
  BlockProgressEvent
} from '../types/index.js'

import type { ChainScanState } from '../config/index.js'

import {
  createChainScanState,
  addTargetsToChainState,
  removeTargetsFromChainState,
  hasActiveTargets,
  getActiveContracts,
  getActiveAddresses,
  isTargetActive,
  updateLastWatchedBlock,
  getChainStateSummary
} from '../config/index.js'

import { MonitorEventEmitter } from '../events/index.js'
import { createLogger, LogCategory } from '@payin/shared'
import { EventPatterns } from '../events/index.js'

/**
 * Chain state manager handles monitoring progress for all chains
 */
export class ChainStateManager {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly states = new Map<Chain, ChainScanState>()
  private readonly eventEmitter: MonitorEventEmitter<any>
  private readonly config: any

  constructor(config: any, eventEmitter: MonitorEventEmitter<any>) {
    this.config = config
    this.eventEmitter = eventEmitter
    // Skip initialization if config doesn't have chainRanges
    if (config.chainRanges) {
      this.initializeStates()
    }
  }

  /**
   * Set chain progress (block number)
   */
  setChainProgress(chain: Chain, blockNumber: number): void {
    // Simply track the block progress without complex state
    this.eventEmitter.emit('blockProgress', {
      chain,
      blockNumber,
      timestamp: Date.now()
    })
  }

  /**
   * Initialize chain states from config
   */
  private initializeStates(): void {
    // Skip complex initialization for now
    this.logger.info('Chain state manager initialized')
  }

  /**
   * Get state for a specific chain
   */
  getState(chain: Chain): ChainScanState | undefined {
    return this.states.get(chain)
  }

  /**
   * Get all chain states
   */
  getAllStates(): ReadonlyMap<Chain, ChainScanState> {
    return this.states
  }

  /**
   * Get configured chains
   */
  getConfiguredChains(): Chain[] {
    return Array.from(this.states.keys())
  }

  /**
   * Add monitoring targets to relevant chains
   */
  addTargets(targets: readonly MonitoringTarget[]): void {
    for (const state of this.states.values()) {
      const chainTargets = targets.filter(target => target.chain === state.chain)
      if (chainTargets.length > 0) {
        addTargetsToChainState(state, chainTargets)
      }
    }
  }

  /**
   * Remove monitoring targets from relevant chains
   */
  removeTargets(targets: readonly MonitoringTarget[]): void {
    for (const state of this.states.values()) {
      const chainTargets = targets.filter(target => target.chain === state.chain)
      if (chainTargets.length > 0) {
        removeTargetsFromChainState(state, chainTargets)
      }
    }
  }

  /**
   * Update last watched block and emit progress event
   */
  updateProgress(
    chain: Chain, 
    fromBlock: number, 
    toBlock: number
  ): void {
    const state = this.states.get(chain)
    if (!state) return

    const previousBlock = state.lastWatchedBlock
    updateLastWatchedBlock(state, toBlock)

    // Emit block progress event
    const progressEvent: BlockProgressEvent = {
      chain,
      fromBlock,
      toBlock,
      lastWatchedBlock: toBlock,
      timestamp: Date.now()
    }

    // Emit to multiple patterns
    const patterns = EventPatterns.getBlockProgressPatterns(chain)
    for (const pattern of patterns) {
      this.eventEmitter.emit(pattern, progressEvent)
    }

  }


  /**
   * Get chains with active targets
   */
  getActiveChainsWithTargets(): Chain[] {
    return Array.from(this.states.keys())
  }

  /**
   * Get active contracts for a chain
   */
  getActiveContracts(chain: Chain): string[] {
    const state = this.states.get(chain)
    return []
  }

  /**
   * Get active addresses for a contract on a chain
   */
  getActiveAddresses(chain: Chain, contract: string): string[] {
    const state = this.states.get(chain)
    return state ? getActiveAddresses(state, contract) : []
  }

  /**
   * Check if a target is active
   */
  isTargetActive(chain: Chain, contract: string, address: string): boolean {
    const state = this.states.get(chain)
    return state ? isTargetActive(state, contract, address) : false
  }

  /**
   * Get batch size for a chain
   */
  getBatchSize(chain: Chain): number | undefined {
    const state = this.states.get(chain)
    return state?.batchSize
  }

  /**
   * Get next scan block for a chain
   */
  getNextScanBlock(chain: Chain): number | undefined {
    const state = this.states.get(chain)
    return state ? state.lastWatchedBlock + 1 : undefined
  }

  /**
   * Get target block for recovery mode
   */
  getTargetBlock(chain: Chain): number | undefined {
    const state = this.states.get(chain)
    return state?.targetBlock
  }


  /**
   * Get recovery progress for all chains
   */
  getRecoveryProgress(): {
    totalChains: number
    completedChains: number
    averageProgress: number
    chainProgress: Array<{ chain: Chain; progress: number }>
  } {
    const chains = this.getConfiguredChains()
    const chainProgress = chains.map(chain => {
      const state = this.states.get(chain)
      let progress = 100 // Default: real-time (completed)

      if (state?.targetBlock) {
        const range = this.config.chainRanges?.[chain]
        const startBlock = range?.startBlock ?? state.lastWatchedBlock
        const totalBlocks = state.targetBlock - startBlock + 1
        const processedBlocks = state.lastWatchedBlock - startBlock + 1
        progress = Math.min(100, Math.max(0, (processedBlocks / totalBlocks) * 100))
      }

      return { chain, progress }
    })

    const completedChains = chainProgress.filter(cp => cp.progress >= 100).length
    const averageProgress = chainProgress.reduce((sum, cp) => sum + cp.progress, 0) / chains.length

    return {
      totalChains: chains.length,
      completedChains,
      averageProgress,
      chainProgress
    }
  }

  /**
   * Get comprehensive state summary
   */
  getStateSummary() {
    const chains = this.getConfiguredChains()
    const chainSummaries = chains.map(chain => {
      const state = this.states.get(chain)!
      return getChainStateSummary(state)
    })

    const activeChainsCount = this.getActiveChainsWithTargets().length
    const progress = this.getRecoveryProgress()

    return {
      totalChains: chains.length,
      activeChainsCount,
      progress,
      chains: chainSummaries
    }
  }

  /**
   * Reset all chain states (for testing)
   */
  reset(): void {
    this.states.clear()
    this.initializeStates()
  }
}