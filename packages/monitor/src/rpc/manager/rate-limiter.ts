export interface RateLimiterOptions {
  enabled: boolean
  windowMs: number
  maxRequests: number
}

export interface EndpointRateLimitConfig {
  maxRequestsPerSecond: number
  burstCapacity?: number
}

export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly capacity: number
  private readonly refillRate: number

  constructor(
    maxRequestsPerSecond: number,
    burstCapacity?: number
  ) {
    this.capacity = burstCapacity || maxRequestsPerSecond * 2
    this.refillRate = maxRequestsPerSecond
    this.tokens = this.capacity
    this.lastRefill = Date.now()
  }

  async waitForToken(): Promise<void> {
    this.refillTokens()
    
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    // 需要等待的时间（毫秒）
    const waitTime = (1000 / this.refillRate)
    await this.sleep(waitTime)
    
    this.refillTokens()
    if (this.tokens >= 1) {
      this.tokens -= 1
    }
  }

  canMakeRequest(): boolean {
    this.refillTokens()
    return this.tokens >= 1
  }

  private refillTokens(): void {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    const tokensToAdd = (timePassed / 1000) * this.refillRate
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export class GlobalRateLimiter {
  private windows: Map<string, { count: number; resetTime: number }> = new Map()
  
  constructor(private options: RateLimiterOptions) {}

  async checkGlobalLimit(): Promise<boolean> {
    if (!this.options.enabled) {
      return true
    }

    const now = Date.now()
    const windowKey = Math.floor(now / this.options.windowMs).toString()
    
    let window = this.windows.get(windowKey)
    if (!window) {
      window = { count: 0, resetTime: now + this.options.windowMs }
      this.windows.set(windowKey, window)
      
      // 清理旧窗口
      this.cleanupOldWindows(now)
    }

    if (window.count >= this.options.maxRequests) {
      return false
    }

    window.count++
    return true
  }

  private cleanupOldWindows(currentTime: number): void {
    for (const [key, window] of this.windows.entries()) {
      if (window.resetTime < currentTime) {
        this.windows.delete(key)
      }
    }
  }
}

export class EndpointRateLimiter {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map()
  private globalLimiter: GlobalRateLimiter

  constructor(globalOptions: RateLimiterOptions) {
    this.globalLimiter = new GlobalRateLimiter(globalOptions)
  }

  async checkLimit(endpointId: string, config?: EndpointRateLimitConfig): Promise<boolean> {
    // 首先检查全局限制
    const globalOk = await this.globalLimiter.checkGlobalLimit()
    if (!globalOk) {
      return false
    }

    // 然后检查端点级限制
    if (!config || !config.maxRequestsPerSecond) {
      return true
    }

    let limiter = this.limiters.get(endpointId)
    if (!limiter) {
      limiter = new TokenBucketRateLimiter(
        config.maxRequestsPerSecond,
        config.burstCapacity
      )
      this.limiters.set(endpointId, limiter)
    }

    return limiter.canMakeRequest()
  }

  async waitForLimit(endpointId: string, config?: EndpointRateLimitConfig): Promise<void> {
    // 检查全局限制
    const globalOk = await this.globalLimiter.checkGlobalLimit()
    if (!globalOk) {
      // 等待到下个窗口期
      await this.sleep(100)
      return this.waitForLimit(endpointId, config)
    }

    // 检查端点级限制
    if (!config || !config.maxRequestsPerSecond) {
      return
    }

    let limiter = this.limiters.get(endpointId)
    if (!limiter) {
      limiter = new TokenBucketRateLimiter(
        config.maxRequestsPerSecond,
        config.burstCapacity
      )
      this.limiters.set(endpointId, limiter)
    }

    await limiter.waitForToken()
  }

  updateEndpointConfig(endpointId: string, config: EndpointRateLimitConfig): void {
    // 重新创建限制器以应用新配置
    const limiter = new TokenBucketRateLimiter(
      config.maxRequestsPerSecond,
      config.burstCapacity
    )
    this.limiters.set(endpointId, limiter)
  }

  removeEndpoint(endpointId: string): void {
    this.limiters.delete(endpointId)
  }

  getStats(): { endpointId: string; canMakeRequest: boolean }[] {
    const stats: { endpointId: string; canMakeRequest: boolean }[] = []
    
    for (const [endpointId, limiter] of this.limiters.entries()) {
      stats.push({
        endpointId,
        canMakeRequest: limiter.canMakeRequest()
      })
    }
    
    return stats
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}