import type { Chain } from './chains.js'
import type { RPCManager, ConfigFormat } from '../rpc/index.js'
import { ConfigError } from './errors.js'
import { getChainConfig } from './chains.js'

/**
 * Monitoring target specification
 */
export interface MonitoringTarget {
  readonly chain: Chain
  readonly contract: string  // Token contract address
  readonly to: string        // Address to monitor for incoming transfers
}

/**
 * Array of monitoring targets
 */
export type MonitoringRequest = readonly MonitoringTarget[]

/**
 * Chain-specific range configuration
 * Used for defining scan boundaries (e.g., during recovery)
 */
export interface ChainRange {
  readonly startBlock?: number | undefined  // Starting block number (optional)
  readonly endBlock?: number | undefined    // Ending block (optional)
}

/**
 * Chain-specific settings
 * Contains all per-chain configurations including range limits and performance settings
 */
export interface ChainSettings {
  readonly chainRanges?: ChainRange          // Optional scan range limits (e.g., for recovery)
  readonly batchSize?: number                // Chain-specific batch size (blocks per scan)
}

/**
 * State storage interface for persistence
 */
export interface StateStorage {
  /**
   * Save monitor state
   */
  save(key: string, state: any): Promise<void>

  /**
   * Load monitor state
   */
  load(key: string): Promise<any | null>

  /**
   * Delete saved state
   */
  delete(key: string): Promise<void>

  /**
   * Check if state exists
   */
  exists(key: string): Promise<boolean>
}

/**
 * Monitor configuration - Unified interface
 */
export interface MonitorConfig {
  // Core settings
  readonly chains: readonly Chain[]                    // Chains to monitor
  // Note: Monitoring targets are managed dynamically via watch()/unwatch() methods, not through static config

  // RPC settings
  readonly rpcManager?: RPCManager                     // Custom RPC manager instance
  readonly rpcKeys?: Record<string, string>           // RPC provider API keys
  readonly rpcConfigPath?: string                      // Path to custom RPC config file
  readonly rpcConfig?: ConfigFormat                   // RPC configuration object (has highest priority)

  // Block scanning settings
  readonly blockRangeSize?: number                     // Blocks per scan (default: 10)
  readonly maxConcurrentScans?: number                 // Max parallel scans (default: 5)
  readonly scanInterval?: number                       // Scan interval in ms (default: 5000)
  readonly safeBlockDistance?: number                 // Safe block distance to avoid reorgs (default: 1)
  readonly scanLockTimeout?: number                    // Timeout for scan lock in ms (default: 300000)

  // Chain-specific settings
  readonly chainSettings?: Record<Chain, ChainSettings> | undefined // Per-chain configuration (range limits + performance settings)

  // Legacy: Deprecated, use chainSettings instead
  /** @deprecated Use chainSettings instead */
  readonly chainRanges?: Record<Chain, ChainRange> | undefined // Optional chain start/end blocks (legacy)

  // Performance settings
  readonly rateLimiting?: {
    readonly rpcCallsPerSecond?: number                // RPC rate limit (default: 10)
    readonly burstLimit?: number                       // Burst limit (default: 20)
    readonly cooldownMs?: number                       // Cooldown period (default: 1000)
  }

  // Error handling
  readonly errorHandling?: {
    readonly maxRetries?: number                       // Max retries per task (default: 3)
    readonly retryDelayMs?: number                     // Retry delay (default: 1000)
    readonly exponentialBackoff?: boolean              // Use exponential backoff (default: true)
    readonly maxRetryDelayMs?: number                  // Max retry delay (default: 30000)
  }

  // State persistence
  readonly persistence?: {
    readonly saveInterval?: number                     // State save interval (default: 60000)
    readonly autoRecover?: boolean                     // Auto-recover on restart (default: true)
    readonly stateStorage?: StateStorage               // Custom state storage
  }

  // Monitoring and alerting
  readonly monitoring?: {
    readonly statsInterval?: number                    // Stats update interval (default: 10000)
    readonly healthCheckInterval?: number              // Health check interval (default: 30000)
    readonly performanceTracking?: boolean             // Track performance metrics (default: true)
  }
}

/**
 * Monitor options (runtime configuration)
 */
export interface MonitorOptions {
  readonly startImmediately?: boolean                  // Start monitor immediately (default: true)
  readonly overrideState?: boolean                     // Override saved state (default: false)
  readonly debugMode?: boolean                         // Enable debug logging (default: false)
  readonly dryRun?: boolean                            // Dry run mode - no state changes (default: false)
}

/**
 * Default monitor configuration
 */
export const DEFAULT_MONITOR_CONFIG: Required<Omit<MonitorConfig, 'chains' | 'targets' | 'chainRanges' | 'chainSettings' | 'rpcManager' | 'rpcKeys' | 'rpcConfigPath' | 'rpcConfig'>> = {
  blockRangeSize: 10,
  maxConcurrentScans: 5,
  scanInterval: 5000,
  safeBlockDistance: 1,
  scanLockTimeout: 300000, // 5 minutes
  rateLimiting: {
    rpcCallsPerSecond: 10,
    burstLimit: 20,
    cooldownMs: 1000
  },
  errorHandling: {
    maxRetries: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true,
    maxRetryDelayMs: 30000
  },
  persistence: {
    saveInterval: 60000,
    autoRecover: true
  },
  monitoring: {
    statsInterval: 10000,
    healthCheckInterval: 120000,  // 2 minutes, reduce conflict with scanning
    performanceTracking: true
  }
}

/**
 * Create monitor configuration with defaults
 */
export function createMonitorConfig(config: MonitorConfig): any {
  // Derive chains list from chainRanges or use explicit chains
  const chains = config.chains || (config.chainRanges ? Object.keys(config.chainRanges) : [])

  return {
    ...config,
    chains: chains,
    blockRangeSize: config.blockRangeSize ?? DEFAULT_MONITOR_CONFIG.blockRangeSize,
    maxConcurrentScans: config.maxConcurrentScans ?? DEFAULT_MONITOR_CONFIG.maxConcurrentScans,
    scanInterval: config.scanInterval ?? DEFAULT_MONITOR_CONFIG.scanInterval,
    safeBlockDistance: config.safeBlockDistance ?? DEFAULT_MONITOR_CONFIG.safeBlockDistance,
    scanLockTimeout: config.scanLockTimeout ?? DEFAULT_MONITOR_CONFIG.scanLockTimeout,
    rateLimiting: {
      ...DEFAULT_MONITOR_CONFIG.rateLimiting,
      ...config.rateLimiting
    },
    errorHandling: {
      ...DEFAULT_MONITOR_CONFIG.errorHandling,
      ...config.errorHandling
    },
    persistence: {
      ...DEFAULT_MONITOR_CONFIG.persistence,
      ...config.persistence
    },
    monitoring: {
      ...DEFAULT_MONITOR_CONFIG.monitoring,
      ...config.monitoring
    }
  }
}

/**
 * Helper to create monitor config with chain ranges
 */
export function createBlockRangeConfig(
  chainRanges: Record<Chain, ChainRange>
): MonitorConfig {
  const chains = Object.keys(chainRanges) as Chain[]
  return {
    chains,
    chainRanges
  }
}

/**
 * Helper to create simple config with chain list
 */
export function createSimpleConfig(
  chains: Chain[]
): MonitorConfig {
  return {
    chains
  }
}

/**
 * Validate monitor configuration
 */
export function validateMonitorConfig(config: MonitorConfig): void {

  // Either chainRanges or chains must be specified
  const hasChainRanges = config.chainRanges && Object.keys(config.chainRanges).length > 0
  const hasChains = config.chains && config.chains.length > 0

  if (!hasChainRanges && !hasChains) {
    throw new ConfigError('Monitor configuration requires either chainRanges or chains to be specified')
  }

  // Validate chainRanges if provided
  if (hasChainRanges) {
    for (const [chainKey, range] of Object.entries(config.chainRanges!)) {
      const chain = chainKey as Chain

      // Validate chain exists
      try {
        getChainConfig(chain)
      } catch {
        throw new ConfigError(`Unsupported chain: ${chain}`)
      }

      // Validate range
      validateChainRange(chain, range)
    }
  }

  // Validate chains list if provided
  if (hasChains) {
    for (const chain of config.chains!) {
      try {
        getChainConfig(chain)
      } catch {
        throw new ConfigError(`Unsupported chain: ${chain}`)
      }
    }
  }

  // Note: Targets are validated at runtime when added via watch() method

  // Validate block range size
  if (config.blockRangeSize !== undefined && config.blockRangeSize <= 0) {
    throw new ConfigError('blockRangeSize must be positive')
  }

  // Validate concurrent scans
  if (config.maxConcurrentScans !== undefined && config.maxConcurrentScans <= 0) {
    throw new ConfigError('maxConcurrentScans must be positive')
  }

  // Validate scan interval
  if (config.scanInterval !== undefined && config.scanInterval <= 0) {
    throw new ConfigError('scanInterval must be positive')
  }

  // Validate safeBlockDistance
  if (config.safeBlockDistance !== undefined && config.safeBlockDistance < 0) {
    throw new ConfigError('safeBlockDistance cannot be negative')
  }
}

/**
 * Validate chain range configuration
 */
export function validateChainRange(
  chain: Chain,
  range: ChainRange
): void {

  // Validate start block
  if (range.startBlock !== undefined) {
    if (!Number.isInteger(range.startBlock) || range.startBlock < 0) {
      throw new ConfigError(
        `Invalid startBlock for ${chain}: must be non-negative integer`,
        { chain, startBlock: range.startBlock }
      )
    }
  }

  // Validate end block if provided
  if (range.endBlock !== undefined) {
    const startBlock = range.startBlock ?? 0
    if (!Number.isInteger(range.endBlock) || range.endBlock < startBlock) {
      throw new ConfigError(
        `Invalid endBlock for ${chain}: must be integer >= startBlock`,
        { chain, startBlock, endBlock: range.endBlock }
      )
    }
  }
}


/**
 * Clone monitor config
 */
export function cloneMonitorConfig(config: MonitorConfig): MonitorConfig {
  return {
    ...config,
    chains: config.chains ? [...config.chains] : [],
    chainRanges: config.chainRanges ? { ...config.chainRanges } : undefined,
    rpcKeys: config.rpcKeys ? { ...config.rpcKeys } : undefined,
    rateLimiting: config.rateLimiting ? { ...config.rateLimiting } : undefined,
    errorHandling: config.errorHandling ? { ...config.errorHandling } : undefined,
    persistence: config.persistence ? { ...config.persistence } : undefined,
    monitoring: config.monitoring ? { ...config.monitoring } : undefined
  } as MonitorConfig
}

/**
 * Helper to create monitoring targets
 */
export function createMonitoringTarget(
  chain: Chain,
  contract: string,
  to: string
): MonitoringTarget {
  return { chain, contract, to }
}

/**
 * Helper to create monitoring request
 */
export function createMonitoringRequest(...targets: MonitoringTarget[]): MonitoringRequest {
  return targets
}