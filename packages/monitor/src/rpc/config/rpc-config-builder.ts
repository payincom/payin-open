/**
 * Simplified RPC Configuration Builder
 * Replaces complex 590-line configuration with dynamic generation
 * based on provider templates and actual requirements
 */

import type {
  RPCGlobalConfig,
  RPCChainConfig,
  RPCEndpointConfig
} from '../types/rpc-config.js'
import {
  getProvidersForNetwork,
  type ProviderTemplate
} from './provider-templates.js'
import type { LoadedConfig } from '../../config/config-loader.js'
import { loadMonitorConfig } from '../../config/config-loader.js'
import { validateConfig } from '../../config/config-validator.js'
import { createLogger, LogCategory } from '@payin/shared'

export interface BuildOptions {
  includeProviders?: string[]      // Only use specified providers
  excludeProviders?: string[]      // Exclude specified providers
  requireApiKey?: boolean          // Only use providers that require keys
  allowNoApiKey?: boolean          // Allow providers without keys (default: true)
  strategy?: 'round_robin' | 'failover' | 'fastest'  // Override default strategy
}

export class RPCConfigBuilder {
  private config?: LoadedConfig
  private readonly logger = createLogger(LogCategory.RPC)
  private skippedProviders: Map<string, Map<string, string>> = new Map()

  constructor(private options: {
    configFile?: string                                                // Custom YAML config file path
    apiKeys?: Record<string, string>
    customProviders?: Record<string, Omit<ProviderTemplate, 'name'>>
    configOverrides?: Partial<LoadedConfig>                          // Runtime config overrides
  } = {}) {}

  /**
   * Build RPC configuration for specified chains
   */
  async buildForChains(chains: string[], buildOptions: BuildOptions = {}): Promise<RPCGlobalConfig> {
    // Load multi-layer configuration
    await this.loadConfiguration()
    this.skippedProviders.clear()

    // Validate configuration and provide helpful feedback
    const validation = validateConfig(this.config!, chains)
    if (!validation.isValid) {
      const errorMessage = `Configuration validation failed:\n${validation.errors.join('\n')}`
      throw new Error(errorMessage)
    }

    const rpcConfig: RPCGlobalConfig = {
      chains: {},
      settings: this.getGlobalSettings()
    }

    for (const chain of chains) {
      try {
        const chainConfig = await this.buildChainConfig(chain, buildOptions)
        if (chainConfig.endpoints.length > 0) {
          rpcConfig.chains[chain] = chainConfig
        } else {
          this.logger.warn(`No available providers for chain ${chain} - skipping`)
        }
      } catch (error) {
        this.logger.error(`Failed to build config for chain ${chain}:`, error)
      }
    }

    if (Object.keys(rpcConfig.chains).length === 0) {
      throw new Error('No chains could be configured. Please provide valid RPC provider keys or check chain names.')
    }

    return rpcConfig
  }

  private async loadConfiguration(): Promise<void> {
    if (this.config) return

    // Load configuration: default.yaml → custom yaml (if provided) → runtime overrides
    this.config = await loadMonitorConfig(this.options.configFile, this.options.configOverrides)

    // Apply runtime API keys (highest priority)
    if (this.options.apiKeys) {
      this.config.rpc = this.config.rpc || {}
      this.config.rpc.apiKeys = { ...this.config.rpc.apiKeys, ...this.options.apiKeys }
    }

    if (this.config.rpc?.apiKeys) {
      this.config.rpc.apiKeys = this.sanitizeApiKeys(this.config.rpc.apiKeys)
    }
  }

  private sanitizeApiKeys(apiKeys: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {}

    for (const [provider, rawKey] of Object.entries(apiKeys)) {
      if (this.isUsableApiKey(rawKey)) {
        sanitized[provider] = rawKey.trim()
      }
    }

    return sanitized
  }

  private isUsableApiKey(value: unknown): value is string {
    if (typeof value !== 'string') return false

    const trimmed = value.trim()
    if (!trimmed) return false

    // Env interpolation placeholders and redacted/template examples must not
    // make key-based providers look usable in self-hosted Open/testnet mode.
    if (trimmed.includes('${') || trimmed.includes('{apiKey}') || trimmed.includes('***')) return false
    if (/^(your[_-]?|replace[_-]?me|changeme|placeholder)/i.test(trimmed)) return false
    if (/^(undefined|null)$/i.test(trimmed)) return false

    return true
  }

  private async buildChainConfig(chain: string, options: BuildOptions): Promise<RPCChainConfig> {
    const chainSettings = this.config?.rpc?.chains?.[chain] || {}
    const chainDefaults = this.config?.rpc?.chainDefaults || {}

    // Get available providers for this chain
    const availableProviders = await this.getAvailableProviders(chain, options, chainSettings)

    if (availableProviders.length === 0) {
      if (options.requireApiKey) {
        throw new Error(`No providers with API keys available for ${chain}`)
      } else {
        throw new Error(`No providers available for ${chain}`)
      }
    }

    return {
      chain,
      strategy: options.strategy || chainSettings.strategy || chainDefaults.strategy || 'round_robin',
      endpoints: availableProviders.map(provider => this.buildEndpointConfig(provider, chain)),
      healthCheck: {
        enabled: chainDefaults.healthCheck?.enabled ?? true,
        interval: chainDefaults.healthCheck?.interval ?? 30000,
        timeout: chainDefaults.healthCheck?.timeout ?? 5000,
        maxFailures: chainDefaults.healthCheck?.maxFailures ?? 3
      },
      retry: {
        maxRetries: chainDefaults.retry?.maxRetries ?? 3,
        backoffMultiplier: chainDefaults.retry?.backoffMultiplier ?? 1.5,
        initialDelay: chainDefaults.retry?.initialDelay ?? 1000
      }
    }
  }

  private async getAvailableProviders(
    chain: string,
    options: BuildOptions,
    chainSettings: any
  ): Promise<ProviderTemplate[]> {
    // Build provider templates map from config
    const providersMap: Record<string, ProviderTemplate> = {}

    // Add providers from YAML config
    if (this.config?.rpc?.providers) {
      for (const [name, template] of Object.entries(this.config.rpc.providers)) {
        providersMap[name] = { name, ...template as Omit<ProviderTemplate, 'name'> }
      }
    }

    // Add custom providers (highest priority, can override YAML)
    if (this.options.customProviders) {
      for (const [name, template] of Object.entries(this.options.customProviders)) {
        providersMap[name] = { name, ...template }
      }
    }

    const skippedProviders: Array<{ name: string; reason: string }> = []
    const preferredProviders: string[] = chainSettings.preferredProviders || chainSettings.availableProviders || []

    if (preferredProviders.length > 0) {
      for (const providerName of preferredProviders) {
        const template = providersMap[providerName]

        if (!template) {
          skippedProviders.push({ name: providerName, reason: 'unknown_provider' })
          continue
        }

        const supportsNetwork =
          template.supportedNetworks.includes(chain) ||
          Object.prototype.hasOwnProperty.call(template.networkMappings || {}, chain)

        if (!supportsNetwork) {
          skippedProviders.push({ name: providerName, reason: 'unsupported_network' })
        }
      }
    }

    // Filter providers that support this chain
    let candidates = getProvidersForNetwork(providersMap, chain)

    // Apply filters
    candidates = candidates.filter(provider => {
      // 1. Include/exclude filters
      if (options.includeProviders && !options.includeProviders.includes(provider.name)) {
        skippedProviders.push({ name: provider.name, reason: 'not_in_include_filter' })
        return false
      }
      if (options.excludeProviders?.includes(provider.name)) {
        skippedProviders.push({ name: provider.name, reason: 'excluded_by_options' })
        return false
      }
      if (chainSettings.excludeProviders?.includes(provider.name)) {
        skippedProviders.push({ name: provider.name, reason: 'excluded_by_chain_settings' })
        return false
      }

      // 2. API key requirements
      const needsKey = provider.authType !== 'none'
      const hasKey = !!(this.config?.rpc?.apiKeys?.[provider.name])

      if (needsKey && !hasKey) {
        skippedProviders.push({ name: provider.name, reason: 'missing_api_key' })
        return false
      }

      if (options.requireApiKey && !needsKey) {
        skippedProviders.push({ name: provider.name, reason: 'requires_api_key_only' })
        return false
      }

      if (options.allowNoApiKey === false && !needsKey) {
        skippedProviders.push({ name: provider.name, reason: 'no_api_key_allowed' })
        return false
      }

      return true
    })

    if (skippedProviders.length > 0) {
      const uniqueProviders = new Map<string, string>()
      for (const { name, reason } of skippedProviders) {
        if (!uniqueProviders.has(name)) {
          uniqueProviders.set(name, reason)
        }
      }
      if (uniqueProviders.size > 0) {
        for (const [providerName, reason] of uniqueProviders.entries()) {
          this.recordSkippedProvider(chain, providerName, reason)
        }
        this.logger.warn('RPC providers skipped during configuration', {
          chain,
          providers: Array.from(uniqueProviders.entries()).map(([name, reason]) => ({ name, reason }))
        })
      }
    }

    // Apply ordering preferences
    return this.orderProviders(candidates, chainSettings)
  }

  private orderProviders(providers: ProviderTemplate[], chainSettings: any): ProviderTemplate[] {
    // Support both preferredProviders (YAML) and availableProviders (code config)
    const preferredProviders = chainSettings.preferredProviders || chainSettings.availableProviders || []

    return providers.sort((a, b) => {
      // 1. Preferred providers first
      const aPreferred = preferredProviders.indexOf(a.name)
      const bPreferred = preferredProviders.indexOf(b.name)

      if (aPreferred !== -1 && bPreferred !== -1) {
        return aPreferred - bPreferred
      }
      if (aPreferred !== -1) return -1
      if (bPreferred !== -1) return 1

      // 2. Providers with API keys preferred over public
      const aHasKey = a.authType !== 'none' && !!(this.config?.rpc?.apiKeys?.[a.name])
      const bHasKey = b.authType !== 'none' && !!(this.config?.rpc?.apiKeys?.[b.name])

      if (aHasKey && !bHasKey) return -1
      if (!aHasKey && bHasKey) return 1

      // 3. Sort by weight
      return b.defaultSettings.weight - a.defaultSettings.weight
    })
  }

  private buildEndpointConfig(provider: ProviderTemplate, chain: string): RPCEndpointConfig {
    const apiKey = this.config?.rpc?.apiKeys?.[provider.name] || ''
    const chainSettings = this.config?.rpc?.chains?.[chain] || {}

    const headers = this.buildHeaders(provider, apiKey)
    const queryParams = this.buildQueryParams(provider, apiKey)

    // Priority: chain override → global defaults → provider defaults
    const config: RPCEndpointConfig = {
      name: provider.name,
      provider: provider.name,
      chain,
      apiKey,
      url: this.buildUrl(provider, chain, apiKey),
      weight: chainSettings.weight ?? provider.defaultSettings.weight,
      timeout: chainSettings.timeout ?? this.config?.rpc?.defaults?.timeout ?? provider.defaultSettings.timeout,
      maxRequestsPerSecond: chainSettings.maxRequestsPerSecond ?? provider.defaultSettings.maxRequestsPerSecond,
      enabled: true
    }

    if (headers) config.headers = headers
    if (queryParams) config.queryParams = queryParams

    return config
  }

  private buildUrl(provider: ProviderTemplate, chain: string, apiKey: string): string {
    const networkName = provider.networkMappings?.[chain] || chain

    return provider.urlPattern
      .replace('{network}', networkName)
      .replace('{apiKey}', apiKey)
  }

  private buildHeaders(provider: ProviderTemplate, apiKey: string): Record<string, string> | undefined {
    if (provider.authType !== 'header' || !provider.headerTemplate) {
      return undefined
    }

    const headers: Record<string, string> = {}
    for (const [key, template] of Object.entries(provider.headerTemplate)) {
      headers[key] = template.replace('{apiKey}', apiKey)
    }

    return Object.keys(headers).length > 0 ? headers : undefined
  }

  private buildQueryParams(provider: ProviderTemplate, apiKey: string): Record<string, string> | undefined {
    if (provider.authType !== 'query_param' || !provider.queryTemplate) {
      return undefined
    }

    const params: Record<string, string> = {}
    for (const [key, template] of Object.entries(provider.queryTemplate)) {
      params[key] = template.replace('{apiKey}', apiKey)
    }

    return Object.keys(params).length > 0 ? params : undefined
  }

  private recordSkippedProvider(chain: string, provider: string, reason: string): void {
    if (!this.skippedProviders.has(chain)) {
      this.skippedProviders.set(chain, new Map())
    }
    const providers = this.skippedProviders.get(chain)!
    if (!providers.has(provider)) {
      providers.set(provider, reason)
    }
  }

  getSkippedProviders(): Record<string, { name: string; reason: string }[]> {
    const result: Record<string, { name: string; reason: string }[]> = {}
    for (const [chain, providers] of this.skippedProviders.entries()) {
      result[chain] = Array.from(providers.entries()).map(([name, reason]) => ({ name, reason }))
    }
    return result
  }

  private getGlobalSettings() {
    const defaults = this.config?.rpc?.defaults || {}
    const chainDefaults = this.config?.rpc?.chainDefaults || {}

    return {
      healthCheck: {
        enabled: chainDefaults.healthCheck?.enabled ?? true,
        interval: chainDefaults.healthCheck?.interval ?? 30000,
        timeout: chainDefaults.healthCheck?.timeout ?? 5000
      },
      retry: {
        maxRetries: chainDefaults.retry?.maxRetries ?? 3,
        backoffMultiplier: chainDefaults.retry?.backoffMultiplier ?? 1.5,
        initialDelay: chainDefaults.retry?.initialDelay ?? 1000
      },
      rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100
      }
    }
  }
}

/**
 * Convenience function to create RPC configuration
 */
export async function createRPCConfig(
  chains: string[],
  options: {
    apiKeys?: Record<string, string>
    includeProviders?: string[]
    excludeProviders?: string[]
    strategy?: 'round_robin' | 'failover' | 'fastest'
  } = {}
): Promise<RPCGlobalConfig> {
  const builderOptions: any = {}
  if (options.apiKeys) builderOptions.apiKeys = options.apiKeys

  const builder = new RPCConfigBuilder(builderOptions)

  const buildOptions: BuildOptions = {}
  if (options.includeProviders) buildOptions.includeProviders = options.includeProviders
  if (options.excludeProviders) buildOptions.excludeProviders = options.excludeProviders
  if (options.strategy) buildOptions.strategy = options.strategy

  return builder.buildForChains(chains, buildOptions)
}
