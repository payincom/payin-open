/**
 * Monitor core types and interfaces
 */

import type { Chain, MonitoringTarget, TransferEvent } from '../types/index.js'

/**
 * Monitor instance status
 */
export type MonitorStatus = 
  | 'stopped'      // Monitor is stopped
  | 'starting'     // Monitor is starting up
  | 'running'      // Monitor is actively running
  | 'pausing'      // Monitor is pausing
  | 'paused'       // Monitor is paused (can be resumed)
  | 'stopping'     // Monitor is shutting down
  | 'error'        // Monitor encountered an error

/**
 * Monitor statistics
 */
export interface MonitorStats {
  readonly status: MonitorStatus
  readonly uptime: number                    // Uptime in milliseconds
  readonly totalTransfers: number           // Total transfers detected
  readonly transfersPerChain: Map<Chain, number>  // Transfers per chain
  readonly errorCount: number               // Total errors encountered
  readonly lastError?: string | undefined   // Last error message
  readonly lastTransfer?: TransferEvent | undefined  // Last transfer detected
  readonly currentBlock: Map<Chain, number> // Current block per chain
  readonly targetCount: number              // Number of active targets
  readonly chainsActive: number             // Number of active chains
  readonly adaptersHealthy: number          // Number of healthy adapters
  readonly averageBlockTime: Map<Chain, number>  // Average block time per chain (ms)
  readonly rpcResponseTime: Map<Chain, number>   // Average RPC response time per chain (ms)
}

/**
 * Block scan task for internal scheduling
 */
export interface BlockScanTask {
  readonly id: string                       // Unique task ID
  readonly chain: Chain                     // Target chain
  readonly fromBlock: number                // Start block
  readonly toBlock: number                  // End block
  readonly targets: readonly MonitoringTarget[]  // Monitoring targets
  readonly priority: number                 // Task priority (lower = higher priority)
  readonly retryCount: number               // Current retry count
  readonly createdAt: number                // Task creation timestamp
  readonly scheduledAt?: number             // Task scheduled timestamp
}

/**
 * Monitor performance metrics
 */
export interface MonitorPerformance {
  blocksPerSecond: Map<Chain, number>     // Blocks processed per second
  transfersPerSecond: Map<Chain, number>  // Transfers detected per second
  rpcCallsPerSecond: Map<Chain, number>   // RPC calls per second
  costPerHour: Map<Chain, number>         // Estimated cost per hour
  memoryUsage: number                     // Memory usage in MB
  cpuUsage?: number                       // CPU usage percentage
}

/**
 * Monitor event data types
 */
export interface MonitorEventData {
  // Transfer events
  'transfer': TransferEvent
  'transferBatch': readonly TransferEvent[]

  // Block progress events
  'blockProgress': {
    chain: Chain
    blockNumber: number
    timestamp: number
  }

  // Block scanned event (for DelayedConfirmation optimization)
  'blockScanned': {
    chain: Chain
    currentBlock: number
    timestamp: number
  }

  // Sync status events
  'syncStatusChanged': {
    isAllChainsSynced: boolean
    timestamp: number
  }

  'chainTargetReached': {
    chain: Chain
    targetBlock: number
    finalBlock: number
  }

  // Status events
  'statusChanged': {
    oldStatus: MonitorStatus
    newStatus: MonitorStatus
    timestamp: number
  }

  // Error events
  'error': {
    chain?: Chain
    error: Error
    timestamp: number
    context?: string
  }

  // Performance events
  'performance': MonitorPerformance

  // Target management events
  'targetsUpdated': {
    added: readonly MonitoringTarget[]
    removed: readonly MonitoringTarget[]
    total: number
  }


  // RPC Manager events
  'rpcRequestSuccess': {
    chain: Chain
    endpoint: string
    responseTime: number
    timestamp: number
  }

  'rpcRequestFailure': {
    chain: Chain
    endpoint: string
    error: string
    attempt: number
    timestamp: number
  }

  'rpcEndpointFailed': {
    endpoint: string
    chain: Chain
    error?: string
    timestamp: number
  }

  'rpcEndpointRecovered': {
    endpoint: string
    chain: Chain
    timestamp: number
  }

  'rpcConfigReloaded': {
    timestamp: number
  }
}

/**
 * Monitor recovery state
 */
export interface MonitorRecoveryState {
  readonly timestamp: number                      // State save timestamp
  readonly lastBlock: Map<Chain, number>          // Last processed block per chain
  readonly targets: readonly MonitoringTarget[]   // Active monitoring targets
  readonly stats: Partial<MonitorStats>          // Saved statistics
}

/**
 * Chain monitoring state
 */
export interface ChainMonitoringState {
  readonly chain: Chain
  readonly currentBlock: number                   // Current block being processed
  readonly lastProcessedBlock: number             // Last successfully processed block
  readonly targetBlock?: number | undefined      // Target block for recovery scan
  readonly isHealthy: boolean                     // Adapter health status
  readonly lastError?: string | undefined        // Last error message
  readonly blockProcessingRate: number            // Blocks per second
  readonly transferDetectionRate: number          // Transfers per second
  readonly lastActivity: number                   // Last activity timestamp
}