import type { Chain, Protocol } from '../types/index.js'
import { getChainConfig } from '../types/chains.js'
import { ChainAdapterError } from '../types/errors.js'
import { BaseAdapter } from './base-adapter.js'
import { EVMAdapter } from './evm-adapter.js'
import { TronAdapter } from './tron-adapter.js'
import { SolanaAdapter } from './solana-adapter.js'
import type { RPCManager } from '../rpc/index.js'
import { createLogger, LogCategory } from '@payin/shared'

/**
 * RPC endpoint configuration for adapters
 */
export interface RPCEndpointConfig {
  readonly name: string                    // Provider name: alchemy, infura, etc.
  readonly url: string                     // RPC URL
  readonly apiKey?: string                 // API key if required
  readonly timeout?: number                // Request timeout in ms
  readonly weight?: number                 // Load balancing weight
  readonly priority?: number               // Failover priority
}

/**
 * Chain adapter configuration
 */
export interface ChainAdapterConfig {
  readonly chain: Chain
  readonly endpoints: readonly RPCEndpointConfig[]
  readonly healthCheckInterval?: number    // Health check interval in ms
  readonly maxRetries?: number            // Max retry attempts
}

/**
 * Adapter constructor type
 */
type AdapterConstructor = new (chain: Chain, rpcManager: RPCManager) => BaseAdapter

/**
 * Adapter factory for creating protocol-specific adapters
 */
export class AdapterFactory {
  private static readonly adapterRegistry = new Map<Protocol, AdapterConstructor>()
  private readonly configRegistry = new Map<Chain, ChainAdapterConfig>()
  private readonly activeAdapters = new Map<Chain, BaseAdapter>()
  private readonly logger = createLogger(LogCategory.MONITOR)

  constructor() {
    // Register built-in adapters
    AdapterFactory.registerAdapter('evm', EVMAdapter)
    AdapterFactory.registerAdapter('tron', TronAdapter)
    AdapterFactory.registerAdapter('solana', SolanaAdapter)
  }

  /**
   * Register a protocol adapter class
   */
  static registerAdapter(protocol: Protocol, adapterClass: AdapterConstructor): void {
    this.adapterRegistry.set(protocol, adapterClass)
    // Static method - no logger instance available
    // This is called during class initialization, logging not critical
  }

  /**
   * Get registered adapter class for protocol
   */
  static getAdapterClass(protocol: Protocol): AdapterConstructor | undefined {
    return this.adapterRegistry.get(protocol)
  }

  /**
   * Get all registered protocols
   */
  static getRegisteredProtocols(): readonly Protocol[] {
    return Array.from(this.adapterRegistry.keys())
  }

  /**
   * Add chain configuration
   */
  addChainConfig(config: ChainAdapterConfig): void {
    this.validateChainConfig(config)
    this.configRegistry.set(config.chain, config)
    this.logger.info('Added chain configuration', {
      chain: config.chain,
      endpointCount: config.endpoints.length
    })
  }

  /**
   * Add multiple chain configurations
   */
  addChainConfigs(configs: readonly ChainAdapterConfig[]): void {
    for (const config of configs) {
      this.addChainConfig(config)
    }
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chain: Chain): ChainAdapterConfig | undefined {
    return this.configRegistry.get(chain)
  }

  /**
   * Get all configured chains
   */
  getConfiguredChains(): readonly Chain[] {
    return Array.from(this.configRegistry.keys())
  }

  /**
   * Create adapter for a chain
   */
  async createAdapter(chain: Chain, rpcManager: RPCManager): Promise<BaseAdapter> {
    const chainConfig = getChainConfig(chain)
    const AdapterClass = AdapterFactory.getAdapterClass(chainConfig.protocol)

    if (!AdapterClass) {
      throw new ChainAdapterError(
        `No adapter registered for protocol: ${chainConfig.protocol}`,
        chain
      )
    }

    this.logger.info('Creating adapter with RPC Manager', {
      protocol: chainConfig.protocol,
      chain
    })

    const adapter = new AdapterClass(chain, rpcManager)

    // Initialize the adapter
    await adapter.initialize()

    // Store in active adapters registry
    this.activeAdapters.set(chain, adapter)

    return adapter
  }


  /**
   * Get existing adapter for chain (if already created)
   */
  getAdapter(chain: Chain): BaseAdapter | undefined {
    return this.activeAdapters.get(chain)
  }

  /**
   * Get or create adapter for chain
   */
  async getOrCreateAdapter(chain: Chain, rpcManager: RPCManager): Promise<BaseAdapter> {
    const existing = this.getAdapter(chain)
    if (existing) {
      return existing
    }
    return await this.createAdapter(chain, rpcManager)
  }

  /**
   * Create adapters for multiple chains
   */
  async createAdapters(chains: readonly Chain[], rpcManager: RPCManager): Promise<Map<Chain, BaseAdapter>> {
    const adapters = new Map<Chain, BaseAdapter>()
    const errors: Array<{ chain: Chain; error: Error }> = []

    // Create adapters in parallel for better performance
    const results = await Promise.allSettled(
      chains.map(async (chain) => ({
        chain,
        adapter: await this.createAdapter(chain, rpcManager)
      }))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        adapters.set(result.value.chain, result.value.adapter)
      } else {
        const chain = chains[results.indexOf(result)]!
        this.logger.error('Adapter creation rejected', {
          chain,
          reason: result.reason,
          reasonMessage: (result.reason as any)?.message,
          reasonContext: (result.reason as any)?.context,
          reasonStack: (result.reason as any)?.stack
        })
        errors.push({ chain, error: result.reason as Error })
      }
    }

    // Log errors but don't fail completely
    for (const { chain, error } of errors) {
      this.logger.error('Failed to create adapter', {
        chain,
        error: error.message,
        context: (error as any)?.context,
        originalError: (error as any)?.context?.originalError,
        stack: error.stack
      })
    }

    this.logger.info('Adapters creation completed', {
      successCount: adapters.size,
      totalCount: chains.length
    })
    return adapters
  }

  /**
   * Check if adapter exists for chain
   */
  hasAdapter(chain: Chain): boolean {
    return this.activeAdapters.has(chain)
  }

  /**
   * Get all active chains
   */
  getActiveChains(): readonly Chain[] {
    return Array.from(this.activeAdapters.keys())
  }

  /**
   * Get adapters by protocol
   */
  getAdaptersByProtocol(protocol: Protocol): Map<Chain, BaseAdapter> {
    const result = new Map<Chain, BaseAdapter>()

    for (const [chain, adapter] of this.activeAdapters) {
      if (adapter.getProtocol() === protocol) {
        result.set(chain, adapter)
      }
    }

    return result
  }

  /**
   * Check health of all active adapters
   */
  async checkAdaptersHealth(): Promise<Map<Chain, boolean>> {
    const healthResults = new Map<Chain, boolean>()
    
    const healthChecks = Array.from(this.activeAdapters.entries()).map(
      async ([chain, adapter]) => ({
        chain,
        healthy: await adapter.isHealthy().catch(() => false)
      })
    )

    const results = await Promise.allSettled(healthChecks)
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        healthResults.set(result.value.chain, result.value.healthy)
      }
    }

    const healthyCount = Array.from(healthResults.values()).filter(Boolean).length
    const totalCount = this.activeAdapters.size

    this.logger.info('Adapter health check completed', {
      healthyCount,
      totalCount
    })
    
    return healthResults
  }

  /**
   * Destroy adapter for chain
   */
  async destroyAdapter(chain: Chain): Promise<void> {
    const adapter = this.activeAdapters.get(chain)
    if (adapter) {
      await adapter.destroy()
      this.activeAdapters.delete(chain)
      this.logger.info('Adapter destroyed', { chain })
    }
  }

  /**
   * Destroy all adapters
   */
  async destroyAllAdapters(): Promise<void> {
    const chains = Array.from(this.activeAdapters.keys())
    
    await Promise.allSettled(
      chains.map(chain => this.destroyAdapter(chain))
    )

    this.logger.info('All adapters destroyed', {
      count: chains.length
    })
  }

  /**
   * Get factory statistics
   */
  getStats(): {
    registeredProtocols: number
    configuredChains: number
    activeAdapters: number
    protocols: readonly Protocol[]
    chains: readonly Chain[]
  } {
    return {
      registeredProtocols: AdapterFactory.adapterRegistry.size,
      configuredChains: this.configRegistry.size,
      activeAdapters: this.activeAdapters.size,
      protocols: AdapterFactory.getRegisteredProtocols(),
      chains: this.getConfiguredChains()
    }
  }

  /**
   * Validate chain configuration
   */
  private validateChainConfig(config: ChainAdapterConfig): void {
    if (!config.chain) {
      throw new Error('Chain configuration missing chain identifier')
    }

    if (!config.endpoints || config.endpoints.length === 0) {
      throw new Error(`Chain ${config.chain} configuration missing endpoints`)
    }

    // Validate each endpoint
    for (const endpoint of config.endpoints) {
      if (!endpoint.name || !endpoint.url) {
        throw new Error(`Invalid endpoint configuration for chain ${config.chain}`)
      }
    }

    // Verify chain is supported
    try {
      getChainConfig(config.chain)
    } catch (error) {
      throw new Error(`Unsupported chain: ${config.chain}`)
    }
  }
}

/**
 * Create default adapter factory with built-in configurations
 * Uses RPC keys from CLAUDE.md
 */
export function createDefaultAdapterFactory(): AdapterFactory {
  const factory = new AdapterFactory()

  // Default Ethereum configurations
  const alchemyKey = process.env.RPC_ALCHEMY_KEY
  const infuraKey = process.env.RPC_INFURA_KEY

  if (alchemyKey || infuraKey) {
    const endpoints = []

    if (alchemyKey) {
      endpoints.push({
        name: 'alchemy',
        url: `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`,
        apiKey: alchemyKey,
        priority: 1
      })
    }

    if (infuraKey) {
      endpoints.push({
        name: 'infura',
        url: `https://sepolia.infura.io/v3/${infuraKey}`,
        apiKey: infuraKey,
        priority: 2
      })
    }

    factory.addChainConfig({
      chain: 'ethereum-sepolia',
      endpoints
    })
  }

  // Default Polygon configurations
  if (alchemyKey) {
    factory.addChainConfig({
      chain: 'polygon-amoy',
      endpoints: [
        {
          name: 'alchemy',
          url: `https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`,
          apiKey: alchemyKey,
          priority: 1
        }
      ]
    })
  }

  // Default Tron configurations
  const trongridKey = process.env.RPC_TRONGRID_KEY
  if (trongridKey) {
    factory.addChainConfig({
      chain: 'tron-nile',
      endpoints: [
        {
          name: 'trongrid',
          url: 'https://nile.trongrid.io/jsonrpc',
          apiKey: trongridKey,
          priority: 1
        }
      ]
    })
  }

  return factory
}
