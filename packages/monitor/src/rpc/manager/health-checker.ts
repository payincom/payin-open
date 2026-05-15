import { EventEmitter } from 'events'
import { RPCEndpointInstance, RPCMetrics } from '../types/rpc-config.js'

export interface HealthCheckResult {
  endpoint: RPCEndpointInstance
  isHealthy: boolean
  responseTime: number
  error?: string
}

export interface HealthCheckOptions {
  enabled: boolean
  interval: number
  timeout: number
  maxFailures: number
}

export class HealthChecker extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private metrics: Map<string, RPCMetrics> = new Map()

  constructor(private options: HealthCheckOptions) {
    super()
  }

  startMonitoring(endpoints: RPCEndpointInstance[]): void {
    if (!this.options.enabled) return

    for (const endpoint of endpoints) {
      this.startEndpointMonitoring(endpoint)
    }
  }

  stopMonitoring(endpointId?: string): void {
    if (endpointId) {
      const interval = this.intervals.get(endpointId)
      if (interval) {
        clearInterval(interval)
        this.intervals.delete(endpointId)
      }
    } else {
      // 停止所有监控
      for (const interval of this.intervals.values()) {
        clearInterval(interval)
      }
      this.intervals.clear()
    }
  }

  async checkEndpoint(endpoint: RPCEndpointInstance): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout)

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber', // 对于Tron会在实际使用时调整
          params: [],
          id: 1
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok

      if (isHealthy) {
        await response.json() // 验证响应格式
      }

      this.updateEndpointHealth(endpoint, isHealthy, responseTime)
      this.updateMetrics(endpoint.id, true, responseTime)

      return {
        endpoint,
        isHealthy,
        responseTime,
        error: isHealthy ? '' : `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      this.updateEndpointHealth(endpoint, false, responseTime, errorMessage)
      this.updateMetrics(endpoint.id, false, responseTime, errorMessage)

      return {
        endpoint,
        isHealthy: false,
        responseTime,
        error: errorMessage
      }
    }
  }

  getMetrics(endpointId: string): RPCMetrics | undefined {
    return this.metrics.get(endpointId)
  }

  getAllMetrics(): RPCMetrics[] {
    return Array.from(this.metrics.values())
  }

  clearMetrics(endpointId?: string): void {
    if (endpointId) {
      this.metrics.delete(endpointId)
    } else {
      this.metrics.clear()
    }
  }

  private startEndpointMonitoring(endpoint: RPCEndpointInstance): void {
    // 清除现有的监控
    this.stopMonitoring(endpoint.id)

    // 立即执行一次健康检查
    this.checkEndpoint(endpoint).then(result => {
      this.emit('health-check', result)
    }).catch(error => {
      console.error(`Initial health check failed for ${endpoint.name}:`, error)
    })

    // 启动定期监控
    const interval = setInterval(async () => {
      try {
        const result = await this.checkEndpoint(endpoint)
        this.emit('health-check', result)
      } catch (error) {
        console.error(`Health check failed for ${endpoint.name}:`, error)
      }
    }, this.options.interval)

    this.intervals.set(endpoint.id, interval)
  }

  private updateEndpointHealth(
    endpoint: RPCEndpointInstance, 
    isHealthy: boolean, 
    responseTime: number,
    error?: string
  ): void {
    const previouslyHealthy = endpoint.isHealthy !== false
    endpoint.lastHealthCheck = new Date()
    
    if (isHealthy) {
      endpoint.consecutiveFailures = 0
      if (!previouslyHealthy) {
        this.emit('endpoint-recovered', endpoint)
      }
      endpoint.isHealthy = true
      // 更新平均响应时间（简单移动平均）
      if (endpoint.avgResponseTime === 0) {
        endpoint.avgResponseTime = responseTime
      } else {
        endpoint.avgResponseTime = (endpoint.avgResponseTime * 0.7) + (responseTime * 0.3)
      }
    } else {
      endpoint.consecutiveFailures++
      if (endpoint.consecutiveFailures >= this.options.maxFailures) {
        if (previouslyHealthy) {
          this.emit('endpoint-failed', endpoint, error)
        }
        endpoint.isHealthy = false
      }
    }
  }

  private updateMetrics(
    endpointId: string, 
    success: boolean, 
    responseTime: number, 
    error?: string
  ): void {
    let metrics = this.metrics.get(endpointId)
    
    if (!metrics) {
      const endpoint = this.getEndpointById(endpointId)
      metrics = {
        endpoint: endpointId,
        chain: endpoint?.chain || 'unknown',
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        avgResponseTime: 0,
        lastRequestTime: new Date(),
        errors: []
      }
      this.metrics.set(endpointId, metrics)
    }

    metrics.requestCount++
    metrics.lastRequestTime = new Date()

    if (success) {
      metrics.successCount++
      // 更新平均响应时间
      if (metrics.avgResponseTime === 0) {
        metrics.avgResponseTime = responseTime
      } else {
        metrics.avgResponseTime = (metrics.avgResponseTime * 0.8) + (responseTime * 0.2)
      }
    } else {
      metrics.failureCount++
      // 记录错误（保留最近10个错误）
      metrics.errors.unshift({
        timestamp: new Date(),
        error: error || 'Unknown error'
      })
      if (metrics.errors.length > 10) {
        metrics.errors = metrics.errors.slice(0, 10)
      }
    }
  }

  private getEndpointById(endpointId: string): RPCEndpointInstance | undefined {
    // 这里需要从RPC Manager获取endpoint信息
    // 暂时返回undefined，在RPC Manager中会注入正确的方法
    return undefined
  }
}
