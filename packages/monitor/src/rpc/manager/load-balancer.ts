import { RPCEndpointInstance } from '../types/rpc-config.js'
import { createLogger, LogCategory } from '@payin/shared'

export interface LoadBalancerStrategy {
  selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null
  onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void
  onRequestFailure(endpoint: RPCEndpointInstance, error: string): void
  reset(): void
}

export class RoundRobinStrategy implements LoadBalancerStrategy {
  private currentIndex = 0
  private readonly logger = createLogger(LogCategory.RPC)

  selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null {
    const healthyEndpoints = endpoints.filter(ep => ep.isHealthy && ep.config.enabled !== false)
    
    if (healthyEndpoints.length === 0) {
      return null
    }

    // 根据权重展开endpoints
    const weightedEndpoints = this.expandByWeight(healthyEndpoints)
    
    if (weightedEndpoints.length === 0) {
      return healthyEndpoints[0] || null
    }

    const selected = weightedEndpoints[this.currentIndex % weightedEndpoints.length]
    this.currentIndex++
    
    return selected || null
  }

  onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void {
    // Round Robin不需要特殊处理成功请求
  }

  onRequestFailure(endpoint: RPCEndpointInstance, error: string): void {
    // Round Robin不需要特殊处理失败请求
  }

  reset(): void {
    this.currentIndex = 0
  }

  private expandByWeight(endpoints: RPCEndpointInstance[]): RPCEndpointInstance[] {
    const expanded: RPCEndpointInstance[] = []
    
    // 计算权重信息
    const weightInfo = endpoints.map(endpoint => ({
      endpoint,
      weight: endpoint.config.weight || endpoint.provider?.defaultWeight || 100,
      normalizedWeight: Math.max(1, Math.round((endpoint.config.weight || endpoint.provider?.defaultWeight || 100) / 10))
    }))
    
    const totalWeight = weightInfo.reduce((sum, info) => sum + info.normalizedWeight, 0)
    
    // 交错式分配：按权重比例交错填充
    const remaining = weightInfo.map(info => ({ ...info, remaining: info.normalizedWeight }))
    
    for (let i = 0; i < totalWeight; i++) {
      // 找到权重比例最高且还有剩余的端点
      let bestIndex = -1
      let bestRatio = -1
      
      for (let j = 0; j < remaining.length; j++) {
        const item = remaining[j]
        if (item && item.remaining > 0) {
          const ratio = item.remaining / item.normalizedWeight
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestIndex = j
          }
        }
      }
      
      if (bestIndex >= 0) {
        const selected = remaining[bestIndex]
        if (selected) {
          expanded.push(selected.endpoint)
          selected.remaining--
        }
      }
    }
    
    this.logger.debug('Round Robin weight distribution calculated', {
      distribution: weightInfo.map(info => ({
        endpoint: info.endpoint.name,
        normalizedWeight: info.normalizedWeight
      })),
      totalWeight
    })
    
    return expanded
  }
}

export class FailoverStrategy implements LoadBalancerStrategy {
  selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null {
    const healthyEndpoints = endpoints
      .filter(ep => ep.isHealthy && ep.config.enabled !== false)
      .sort((a, b) => {
        // 按权重降序排序，权重高的优先
        const weightA = a.config.weight || a.provider?.defaultWeight || 100
        const weightB = b.config.weight || b.provider?.defaultWeight || 100
        return weightB - weightA
      })

    return healthyEndpoints[0] || null
  }

  onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void {
    // Failover不需要特殊处理成功请求
  }

  onRequestFailure(endpoint: RPCEndpointInstance, error: string): void {
    // Failover依赖健康检查来处理故障
  }

  reset(): void {
    // Failover不需要重置状态
  }
}

export class FastestStrategy implements LoadBalancerStrategy {
  private performanceWindow: Map<string, number[]> = new Map()
  private readonly windowSize = 10

  selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null {
    const healthyEndpoints = endpoints.filter(ep => ep.isHealthy && ep.config.enabled !== false)
    
    if (healthyEndpoints.length === 0) {
      return null
    }

    if (healthyEndpoints.length === 1) {
      return healthyEndpoints[0] || null
    }

    // 选择平均响应时间最短的endpoint
    let fastestEndpoint = healthyEndpoints[0]!
    let fastestAvgTime = this.getAverageResponseTime(fastestEndpoint.id)

    for (let i = 1; i < healthyEndpoints.length; i++) {
      const endpoint = healthyEndpoints[i]!
      const avgTime = this.getAverageResponseTime(endpoint.id)
      
      if (avgTime < fastestAvgTime) {
        fastestEndpoint = endpoint
        fastestAvgTime = avgTime
      }
    }

    return fastestEndpoint || null
  }

  onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void {
    this.recordResponseTime(endpoint.id, responseTime)
  }

  onRequestFailure(endpoint: RPCEndpointInstance, error: string): void {
    // 失败请求不记录响应时间，但可以记录大的惩罚时间
    this.recordResponseTime(endpoint.id, 10000) // 10秒惩罚
  }

  reset(): void {
    this.performanceWindow.clear()
  }

  private recordResponseTime(endpointId: string, responseTime: number): void {
    let times = this.performanceWindow.get(endpointId)
    if (!times) {
      times = []
      this.performanceWindow.set(endpointId, times)
    }

    times.push(responseTime)
    
    // 保持窗口大小
    if (times.length > this.windowSize) {
      times.shift()
    }
  }

  private getAverageResponseTime(endpointId: string): number {
    const times = this.performanceWindow.get(endpointId)
    if (!times || times.length === 0) {
      return 1000 // 默认1秒
    }

    const sum = times.reduce((acc, time) => acc + time, 0)
    return sum / times.length
  }
}

export class LoadBalancer {
  private strategy: LoadBalancerStrategy

  constructor(strategyType: 'round_robin' | 'failover' | 'fastest') {
    this.strategy = this.createStrategy(strategyType)
  }

  selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null {
    if (endpoints.length === 0) {
      return null
    }

    return this.strategy.selectEndpoint(endpoints)
  }

  onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void {
    this.strategy.onRequestSuccess(endpoint, responseTime)
  }

  onRequestFailure(endpoint: RPCEndpointInstance, error: string): void {
    this.strategy.onRequestFailure(endpoint, error)
  }

  changeStrategy(strategyType: 'round_robin' | 'failover' | 'fastest'): void {
    this.strategy = this.createStrategy(strategyType)
  }

  reset(): void {
    this.strategy.reset()
  }

  private createStrategy(strategyType: 'round_robin' | 'failover' | 'fastest'): LoadBalancerStrategy {
    switch (strategyType) {
      case 'round_robin':
        return new RoundRobinStrategy()
      case 'failover':
        return new FailoverStrategy()
      case 'fastest':
        return new FastestStrategy()
      default:
        throw new Error(`Unknown load balancer strategy: ${strategyType}`)
    }
  }
}