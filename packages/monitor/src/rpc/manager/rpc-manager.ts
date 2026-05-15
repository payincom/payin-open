import { EventEmitter } from 'events'
import { ConfigLoader, RPCGlobalConfig, RPCEndpointInstance, RPCEndpointConfig, RPCMetrics, RPCProviderTemplate, ConfigFormat } from '../types/rpc-config.js'
import { LoadBalancer } from './load-balancer.js'
import { HealthChecker, HealthCheckResult } from './health-checker.js'
import { EndpointRateLimiter } from './rate-limiter.js'
import { RPCConfigLoader } from '../config/config-loader.js'
import { createLogger, LogCategory } from '@payin/shared'

export interface RPCRequest {
  method: string
  params: any[]
  id?: string | number
}

export interface RPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface RPCManagerOptions {
  rpcKeys?: Record<string, string>
  configPath?: string
  rpcConfig?: ConfigFormat | RPCGlobalConfig
  enableRetry?: boolean
  enableRateLimit?: boolean
  enableHealthCheck?: boolean
  disablePublicProviders?: boolean
}

export class RPCManager extends EventEmitter {
  private config!: RPCGlobalConfig
  private endpoints: Map<string, RPCEndpointInstance[]> = new Map()
  private loadBalancers: Map<string, LoadBalancer> = new Map()
  private healthChecker!: HealthChecker
  private rateLimiter!: EndpointRateLimiter
  private configLoader: ConfigLoader
  private providerTemplates: Map<string, RPCProviderTemplate> = new Map()
  private isInitialized = false
  private readonly logger = createLogger(LogCategory.RPC)
  private providerRequestCounts: Map<string, number> = new Map()

  constructor(private options: RPCManagerOptions) {
    super()
    
    // 创建配置加载器
    // Only pass ConfigFormat to the config loader, not RPCGlobalConfig
    const configForLoader = this.isRPCGlobalConfig(options.rpcConfig) ? undefined : options.rpcConfig as ConfigFormat | undefined
    this.configLoader = new RPCConfigLoader(
      options.configPath,
      options.rpcKeys || {},
      configForLoader,
      options.disablePublicProviders
    )
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // 加载配置
    await this.loadConfiguration()

    // 初始化健康检查器
    this.healthChecker = new HealthChecker({
      ...this.config.settings.healthCheck,
      maxFailures: 3
    })
    this.setupHealthCheckEvents()

    // 初始化速率限制器
    this.rateLimiter = new EndpointRateLimiter(this.config.settings.rateLimit)

    // 启动健康检查（确保失败的 endpoint 可以自动恢复）
    const allEndpoints = Array.from(this.endpoints.values()).flat()
    if (allEndpoints.length > 0) {
      this.healthChecker.startMonitoring(allEndpoints)
      this.logger.info('Health check monitoring started', {
        endpointCount: allEndpoints.length,
        interval: this.config.settings.healthCheck.interval,
        enabled: this.config.settings.healthCheck.enabled
      })
    }

    // 配置变更监听已移除，现在使用静态配置

    this.isInitialized = true
    this.emit('initialized')
  }

  async makeRequest(chain: string, request: RPCRequest): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('RPCManager not initialized. Call initialize() first.')
    }

    const chainEndpoints = this.endpoints.get(chain)
    if (!chainEndpoints || chainEndpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for chain: ${chain}`)
    }

    const loadBalancer = this.loadBalancers.get(chain)!
    const retryConfig = this.getChainConfig(chain)?.retry || this.config.settings.retry

    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= retryConfig.maxRetries) {
      const endpoint = loadBalancer.selectEndpoint(chainEndpoints)
      
      if (!endpoint) {
        throw new Error(`No healthy RPC endpoints available for chain: ${chain}`)
      }

      // 在try块外定义startTime，确保catch块能访问
      const startTime = Date.now()
      
      try {
        // 检查速率限制
        if (this.options.enableRateLimit !== false) {
          const rateLimitConfig = {
            maxRequestsPerSecond: endpoint.config.maxRequestsPerSecond ||
                                 endpoint.provider?.defaultMaxRequestsPerSecond || 10
          }
          await this.rateLimiter.waitForLimit(endpoint.id, rateLimitConfig)
        }

        // 执行请求
        this.recordProviderRequest(endpoint, 1)
        this.logger.debug('RPC request executing', {
          chain,
          endpointName: endpoint.name,
          endpointUrl: this.redactEndpointUrl(endpoint.url),
          method: request.method
        })
        const response = await this.executeRequest(endpoint, request)
        const responseTime = Date.now() - startTime

        // 记录成功
        loadBalancer.onRequestSuccess(endpoint, responseTime)
        endpoint.requestCount++
        endpoint.successRate = (endpoint.successRate * 0.9) + (1 * 0.1)
        
        // 更新平均响应时间
        if (endpoint.avgResponseTime === 0) {
          endpoint.avgResponseTime = responseTime
        } else {
          endpoint.avgResponseTime = (endpoint.avgResponseTime * 0.7) + (responseTime * 0.3)
        }

        this.emit('request-success', { chain, endpoint: endpoint.name, responseTime })
        
        return response.result
      } catch (error) {
        const err = error as Error
        // Attach provider information to error
        ;(err as any).endpointName = endpoint.name
        ;(err as any).providerName = endpoint.provider?.name || endpoint.name

        lastError = err
        const responseTime = Date.now() - startTime

        // 记录失败
        loadBalancer.onRequestFailure(endpoint, lastError.message)
        endpoint.requestCount++
        endpoint.successRate = endpoint.successRate * 0.9

        this.emit('request-failure', {
          chain,
          endpoint: endpoint.name,
          error: lastError.message,
          attempt: attempt + 1
        })

        // 如果是网络错误或超时，标记端点不健康
        if (this.isNetworkError(lastError)) {
          endpoint.isHealthy = false
          endpoint.consecutiveFailures++
        }

        attempt++

        // 计算重试延迟
        if (attempt <= retryConfig.maxRetries) {
          const delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1)
          await this.sleep(Math.min(delay, 30000)) // 最大30秒
        }
      }
    }

    // Include provider information in error message
    const providerInfo = (lastError as any)?.providerName
      ? ` (Provider: ${(lastError as any).providerName})`
      : ''

    const finalError = new Error(
      `All RPC requests failed for chain ${chain}${providerInfo}. Last error: ${lastError?.message}`
    )

    if (lastError) {
      ;(finalError as any).cause = lastError
      if ((lastError as any).endpointName) {
        ;(finalError as any).endpointName = (lastError as any).endpointName
      }
      if ((lastError as any).providerName) {
        ;(finalError as any).providerName = (lastError as any).providerName
      }
    }

    throw finalError
  }

  async makeBatchRequest(chain: string, requests: RPCRequest[]): Promise<RPCResponse[]> {
    if (!this.isInitialized) {
      throw new Error('RPCManager not initialized. Call initialize() first.')
    }

    if (requests.length === 0) {
      return []
    }

    const chainEndpoints = this.endpoints.get(chain)
    if (!chainEndpoints || chainEndpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for chain: ${chain}`)
    }

    const loadBalancer = this.loadBalancers.get(chain)!
    const retryConfig = this.getChainConfig(chain)?.retry || this.config.settings.retry

    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= retryConfig.maxRetries) {
      const endpoint = loadBalancer.selectEndpoint(chainEndpoints)

      if (!endpoint) {
        throw new Error(`No healthy RPC endpoints available for chain: ${chain}`)
      }

      const startTime = Date.now()

      try {
        if (this.options.enableRateLimit !== false) {
          const rateLimitConfig = {
            maxRequestsPerSecond: endpoint.config.maxRequestsPerSecond ||
                                 endpoint.provider?.defaultMaxRequestsPerSecond || 10
          }
          await this.rateLimiter.waitForLimit(endpoint.id, rateLimitConfig)
        }

        const responses = await this.executeBatchRequest(endpoint, requests)
        const responseTime = Date.now() - startTime

        loadBalancer.onRequestSuccess(endpoint, responseTime)
        endpoint.requestCount++
        endpoint.successRate = (endpoint.successRate * 0.9) + (1 * 0.1)

        if (endpoint.avgResponseTime === 0) {
          endpoint.avgResponseTime = responseTime
        } else {
          endpoint.avgResponseTime = (endpoint.avgResponseTime * 0.7) + (responseTime * 0.3)
        }

        this.emit('request-success', { chain, endpoint: endpoint.name, responseTime })

        return responses
      } catch (error) {
        const err = error as Error
        ;(err as any).endpointName = endpoint.name
        ;(err as any).providerName = endpoint.provider?.name || endpoint.name

        lastError = err
        const responseTime = Date.now() - startTime

        loadBalancer.onRequestFailure(endpoint, lastError.message)
        endpoint.requestCount++
        endpoint.successRate = endpoint.successRate * 0.9

        this.emit('request-failure', {
          chain,
          endpoint: endpoint.name,
          error: lastError.message,
          attempt: attempt + 1
        })

        if (this.isNetworkError(lastError)) {
          endpoint.isHealthy = false
          endpoint.consecutiveFailures++
        }

        attempt++

        if (attempt <= retryConfig.maxRetries) {
          const delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1)
          await this.sleep(Math.min(delay, 30000))
        }
      }
    }

    // Include provider information in error message
    const providerInfo = (lastError as any)?.providerName
      ? ` (Provider: ${(lastError as any).providerName})`
      : ''

    const finalError = new Error(
      `All RPC batch requests failed for chain ${chain}${providerInfo}. Last error: ${lastError?.message}`
    )

    if (lastError) {
      ;(finalError as any).cause = lastError
      if ((lastError as any).endpointName) {
        ;(finalError as any).endpointName = (lastError as any).endpointName
      }
      if ((lastError as any).providerName) {
        ;(finalError as any).providerName = (lastError as any).providerName
      }
    }

    throw finalError
  }

  async getChainEndpoints(chain: string): Promise<RPCEndpointInstance[]> {
    return this.endpoints.get(chain) || []
  }

  async getHealthyEndpoints(chain: string): Promise<RPCEndpointInstance[]> {
    const endpoints = await this.getChainEndpoints(chain)
    return endpoints.filter(ep => ep.isHealthy && ep.config.enabled !== false)
  }

  async getEndpointMetrics(chain?: string): Promise<RPCMetrics[]> {
    if (chain) {
      const endpoints = await this.getChainEndpoints(chain)
      return endpoints
        .map(ep => this.createMetricsFromEndpoint(ep))
        .filter(metrics => metrics !== null) as RPCMetrics[]
    }
    
    // Get metrics for all chains
    const allMetrics: RPCMetrics[] = []
    for (const [chainName, _] of Object.entries(this.config.chains)) {
      const endpoints = await this.getChainEndpoints(chainName)
      const chainMetrics = endpoints
        .map(ep => this.createMetricsFromEndpoint(ep))
        .filter(metrics => metrics !== null) as RPCMetrics[]
      allMetrics.push(...chainMetrics)
    }
    
    return allMetrics
  }

  private createMetricsFromEndpoint(endpoint: RPCEndpointInstance): RPCMetrics | null {
    // Create metrics from actual endpoint data, combining health check data with real usage data
    const healthMetrics = this.healthChecker.getMetrics(endpoint.id)
    
    return {
      endpoint: endpoint.id,
      chain: endpoint.chain,
      requestCount: endpoint.requestCount || (healthMetrics?.requestCount ?? 0),
      successCount: Math.round((endpoint.successRate || 1.0) * (endpoint.requestCount || 0)),
      failureCount: (endpoint.requestCount || 0) - Math.round((endpoint.successRate || 1.0) * (endpoint.requestCount || 0)),
      avgResponseTime: endpoint.avgResponseTime || (healthMetrics?.avgResponseTime ?? 0),
      lastRequestTime: healthMetrics?.lastRequestTime ?? new Date(),
      errors: healthMetrics?.errors ?? []
    }
  }

  async testEndpoint(chain: string, endpointName: string): Promise<HealthCheckResult> {
    const endpoints = await this.getChainEndpoints(chain)
    const endpoint = endpoints.find(ep => ep.name === endpointName)
    
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointName} not found in chain ${chain}`)
    }

    return await this.healthChecker.checkEndpoint(endpoint)
  }

  async reloadConfiguration(newConfig?: RPCGlobalConfig): Promise<void> {
    if (newConfig) {
      this.config = newConfig
    } else {
      await this.loadConfiguration()
    }
    
    this.setupEndpoints()
    this.setupLoadBalancers()
    
    // 重启健康检查
    this.healthChecker.stopMonitoring()
    const allEndpoints = Array.from(this.endpoints.values()).flat()
    this.healthChecker.startMonitoring(allEndpoints)

    this.emit('configuration-reloaded')
  }

  getConfiguration(): RPCGlobalConfig {
    return this.config
  }

  async stop(): Promise<void> {
    this.healthChecker.stopMonitoring()
    this.removeAllListeners()
  }

  private isRPCGlobalConfig(config: any): config is RPCGlobalConfig {
    return config && config.chains && typeof config.chains === 'object' &&
           Object.values(config.chains).some((chain: any) => chain.endpoints)
  }

  private async loadConfiguration(): Promise<void> {
    // If rpcConfig is provided directly, use it instead of config loader
    this.logger.info(`Loading configuration, rpcConfig provided: ${!!this.options.rpcConfig}`)
    if (this.options.rpcConfig) {
      // Check if it's already a RPCGlobalConfig (has chains with endpoints)
      if (this.isRPCGlobalConfig(this.options.rpcConfig)) {
        // It's already a RPCGlobalConfig from RPC config builder
        this.config = this.options.rpcConfig
        this.logger.info('Using provided RPCGlobalConfig, skipping config loader')

        // Build provider templates from the direct config
        this.providerTemplates.clear()
        // For direct config, we don't need provider templates since endpoints are already configured

        this.setupEndpoints()
        this.setupLoadBalancers()
        return
      } else {
        // It's a ConfigFormat, continue with normal config loader flow
        this.logger.info('Using provided ConfigFormat, continuing with config loader')
      }
    }

    // Otherwise use the config loader
    this.logger.info('No rpcConfig provided, using config loader')
    this.config = await this.configLoader.loadGlobalConfig()

    // 加载提供商模板
    const providers = await this.configLoader.loadProviderTemplates()
    this.providerTemplates.clear()
    for (const provider of providers) {
      this.providerTemplates.set(provider.name, provider)
    }

    this.setupEndpoints()
    this.setupLoadBalancers()
  }

  private setupEndpoints(): void {
    this.endpoints.clear()

    for (const [chainName, chainConfig] of Object.entries(this.config.chains)) {
      const chainEndpoints: RPCEndpointInstance[] = []

      for (const endpointConfig of chainConfig.endpoints) {
        // Check if we're using pre-built config (has URL already)
        if (endpointConfig.url) {
          // Pre-built configuration - use directly
          const endpoint: RPCEndpointInstance = {
            id: `${chainName}-${endpointConfig.name}`,
            name: endpointConfig.name,
            chain: chainName,
            provider: null, // No provider template needed for pre-built config
            config: endpointConfig,
            url: endpointConfig.url,
            isHealthy: true,
            consecutiveFailures: 0,
            lastHealthCheck: new Date(),
            avgResponseTime: 0,
            requestCount: 0,
            successRate: 1.0
          }

          if (endpointConfig.headers) {
            endpoint.headers = endpointConfig.headers
          }
          if (endpointConfig.queryParams) {
            endpoint.queryParams = endpointConfig.queryParams
          }

          chainEndpoints.push(endpoint)
          continue
        }

        // Traditional configuration - use provider templates
        const provider = this.providerTemplates.get(endpointConfig.provider)
        if (!provider) {
          console.warn(`Unknown provider: ${endpointConfig.provider}`)
          continue
        }

        try {
          // 使用配置加载器构建URL
          const url = this.configLoader.buildEndpointUrl(provider, chainName, endpointConfig.apiKey)
          const headers = this.configLoader.buildAuthHeaders(provider, endpointConfig.apiKey)
          const queryParams = this.configLoader.buildQueryParams(provider, endpointConfig.apiKey)

          const endpoint: RPCEndpointInstance = {
            id: `${chainName}-${endpointConfig.name}`,
            name: endpointConfig.name,
            chain: chainName,
            provider,
            config: endpointConfig,
            url,
            headers,
            queryParams,
            isHealthy: true,
            consecutiveFailures: 0,
            lastHealthCheck: new Date(),
            avgResponseTime: 0,
            requestCount: 0,
            successRate: 1.0
          }

          chainEndpoints.push(endpoint)
        } catch (error) {
          console.error(`Failed to setup endpoint ${endpointConfig.name} for chain ${chainName}:`, error)
        }
      }

      if (chainEndpoints.length > 0) {
        this.endpoints.set(chainName, chainEndpoints)
      }
    }
  }

  private setupLoadBalancers(): void {
    this.loadBalancers.clear()

    for (const [chainName, chainConfig] of Object.entries(this.config.chains)) {
      const loadBalancer = new LoadBalancer(chainConfig.strategy)
      this.loadBalancers.set(chainName, loadBalancer)
    }
  }

  private setupHealthCheckEvents(): void {
    this.healthChecker.on('health-check', (result: HealthCheckResult) => {
      this.emit('endpoint-health-check', result)
    })

    this.healthChecker.on('endpoint-failed', (endpoint: RPCEndpointInstance, error?: string) => {
      this.emit('endpoint-failed', endpoint, error)
    })

    this.healthChecker.on('endpoint-recovered', (endpoint: RPCEndpointInstance) => {
      this.emit('endpoint-recovered', endpoint)
    })
  }

  private async executeRequest(endpoint: RPCEndpointInstance, request: RPCRequest): Promise<RPCResponse> {
    const timeout = endpoint.config.timeout ||
                   endpoint.provider?.defaultTimeout ||
                   5000

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const requestBody = {
        jsonrpc: '2.0',
        method: request.method,
        params: request.params,
        id: request.id || Date.now()
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const jsonResponse = await response.json()
      
      if ((jsonResponse as any).error) {
        throw new Error(`RPC Error ${(jsonResponse as any).error.code}: ${(jsonResponse as any).error.message}`)
      }

      return jsonResponse as RPCResponse
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async executeBatchRequest(endpoint: RPCEndpointInstance, requests: RPCRequest[]): Promise<RPCResponse[]> {
    const timeout = endpoint.config.timeout ||
                   endpoint.provider?.defaultTimeout ||
                   5000

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      this.recordProviderRequest(endpoint, requests.length)
      const requestBody = requests.map((request, index) => ({
        jsonrpc: '2.0',
        method: request.method,
        params: request.params,
        id: request.id ?? `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
      }))

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const jsonResponse = await response.json()

      if (!Array.isArray(jsonResponse)) {
        throw new Error('Invalid RPC batch response format')
      }

      const responseMap = new Map<string | number, RPCResponse>()
      for (const item of jsonResponse) {
        if ((item as any).error) {
          throw new Error(`RPC Error ${(item as any).error.code}: ${(item as any).error.message}`)
        }
        responseMap.set((item as RPCResponse).id, item as RPCResponse)
      }

      return requestBody.map(batchRequest => {
        const responseItem = responseMap.get(batchRequest.id)
        if (!responseItem) {
          throw new Error(`Missing response for batch request id: ${batchRequest.id}`)
        }
        return responseItem
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private getChainConfig(chain: string) {
    return this.config.chains[chain]
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorMessages = [
      'fetch',
      'network',
      'timeout',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'aborted'
    ]

    return networkErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private redactEndpointUrl(url: string): string {
    return url
      .replace(/([?&](?:api[-_]?key|key|token|access_token)=)[^&]+/gi, '$1***')
      .replace(/(\/v2\/)[^/?#]+/gi, '$1***')
  }

  // Public alias for makeRequest
  async request(chain: string, request: RPCRequest): Promise<RPCResponse> {
    return await this.makeRequest(chain, request)
  }

  private recordProviderRequest(endpoint: RPCEndpointInstance, count: number): void {
    const providerKey = endpoint.provider?.name || endpoint.name || endpoint.id
    const previous = this.providerRequestCounts.get(providerKey) ?? 0
    const next = previous + count
    this.providerRequestCounts.set(providerKey, next)
    if (next % 100 === 0 || previous === 0) {
      this.logger.info('RPC provider request summary', {
        provider: providerKey,
        totalRequests: next,
        endpointUrl: this.redactEndpointUrl(endpoint.url)
      })
    } else {
      this.logger.debug('RPC provider request count updated', {
        provider: providerKey,
        totalRequests: next
      })
    }
  }

  getProviderRequestStats(): Record<string, number> {
    return Object.fromEntries(this.providerRequestCounts.entries())
  }
}
