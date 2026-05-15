/**
 * High-performance event emitter with multi-level subscription support
 * Optimized for blockchain monitoring with pattern matching
 */

import type {
  EventListener,
  TypedEventListener,
  TypedEventEmitter,
  StrictMonitorEventMap
} from '../types/events.js'

/**
 * Event subscription entry
 */
interface EventSubscription<T = any> {
  readonly pattern: string
  readonly listener: TypedEventListener<T> | EventListener
  readonly once: boolean
}

/**
 * Type-safe event emitter implementation with pattern matching
 */
export class TypedMonitorEventEmitter<TEventMap extends Record<string, any> = StrictMonitorEventMap> implements TypedEventEmitter<TEventMap> {
  private readonly subscriptions = new Map<string, Set<EventSubscription<any>>>()
  private readonly patternCache = new Map<string, string[]>()
  private readonly exactPatterns = new Set<string>()
  private readonly wildcardPatterns = new Map<string, string>()

  /**
   * Add typed event listener
   */
  on<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this {
    this.addSubscription(event as string, listener, false)
    return this
  }

  /**
   * Add one-time typed event listener
   */
  once<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this {
    this.addSubscription(event as string, listener, true)
    return this
  }

  /**
   * Remove typed event listener
   */
  off<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this {
    this.removeListener(event as string, listener)
    return this
  }

  /**
   * Emit typed event to all matching listeners
   */
  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): boolean {
    return this.emitEvent(event as string, data)
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners<K extends keyof TEventMap>(event?: K): this {
    if (event) {
      const eventStr = event as string
      this.subscriptions.delete(eventStr)
      this.unindexPattern(eventStr)
      this.clearPatternCache(eventStr)
    } else {
      this.subscriptions.clear()
      this.exactPatterns.clear()
      this.wildcardPatterns.clear()
      this.patternCache.clear()
    }
    return this
  }

  private unindexPattern(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      this.wildcardPatterns.delete(prefix)
    } else {
      this.exactPatterns.delete(pattern)
    }
  }

  /**
   * Get listener count for an event pattern
   */
  listenerCount<K extends keyof TEventMap>(event: K): number {
    return this.getListenerCount(event as string)
  }

  // Implementation methods
  private addSubscription(pattern: string, listener: TypedEventListener<any> | EventListener, once: boolean): void {
    let subscriptions = this.subscriptions.get(pattern)
    if (!subscriptions) {
      subscriptions = new Set()
      this.subscriptions.set(pattern, subscriptions)
      this.indexPattern(pattern)
    }

    subscriptions.add({ pattern, listener, once })
    this.clearPatternCache(pattern)
  }

  private indexPattern(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      this.wildcardPatterns.set(prefix, pattern)
    } else {
      this.exactPatterns.add(pattern)
    }
  }

  private removeListener(event: string, listener: TypedEventListener<any> | EventListener): void {
    const subscriptions = this.subscriptions.get(event)
    if (!subscriptions) return

    for (const subscription of subscriptions) {
      if (subscription.listener === listener) {
        subscriptions.delete(subscription)
        break
      }
    }

    if (subscriptions.size === 0) {
      this.subscriptions.delete(event)
      this.unindexPattern(event)
    }

    this.clearPatternCache(event)
  }

  private emitEvent(event: string, data: any): boolean {
    const matchingPatterns = this.getMatchingPatterns(event)
    let hasListeners = false

    for (const pattern of matchingPatterns) {
      const subscriptions = this.subscriptions.get(pattern)
      if (!subscriptions || subscriptions.size === 0) continue

      hasListeners = true

      // Convert to array to avoid modification during iteration
      const subscriptionArray = Array.from(subscriptions)

      for (const subscription of subscriptionArray) {
        try {
          subscription.listener(data)
        } catch (error) {
          // Emit error but don't stop other listeners
          console.error(`Event listener error for ${pattern}:`, error)
        }

        // Remove one-time listeners
        if (subscription.once) {
          subscriptions.delete(subscription)
        }
      }

      // Clean up empty subscription sets
      if (subscriptions.size === 0) {
        this.subscriptions.delete(pattern)
      }
    }

    return hasListeners
  }

  private getListenerCount(event: string): number {
    const matchingPatterns = this.getMatchingPatterns(event)
    let count = 0

    for (const pattern of matchingPatterns) {
      const subscriptions = this.subscriptions.get(pattern)
      if (subscriptions) {
        count += subscriptions.size
      }
    }

    return count
  }

  private getMatchingPatterns(event: string): string[] {
    // Check cache first
    if (this.patternCache.has(event)) {
      return this.patternCache.get(event)!
    }

    const matchingPatterns: string[] = []

    // Fast exact match check
    if (this.exactPatterns.has(event)) {
      matchingPatterns.push(event)
    }

    // Fast wildcard prefix matching
    for (const [prefix, pattern] of this.wildcardPatterns) {
      if (event.startsWith(prefix)) {
        matchingPatterns.push(pattern)
      }
    }

    // Cache the result
    this.patternCache.set(event, matchingPatterns)
    return matchingPatterns
  }

  private patternMatches(pattern: string, event: string): boolean {
    // Exact match
    if (pattern === event) {
      return true
    }

    // Wildcard pattern
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return event.startsWith(prefix)
    }

    return false
  }

  private clearPatternCache(pattern?: string): void {
    if (pattern) {
      // More efficient cache invalidation based on pattern type
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        // Clear cache entries that start with this prefix
        for (const [cachedEvent] of this.patternCache) {
          if (cachedEvent.startsWith(prefix)) {
            this.patternCache.delete(cachedEvent)
          }
        }
      } else {
        // For exact patterns, only clear the exact match
        this.patternCache.delete(pattern)
        // Also clear any cached events that might have matched this pattern via wildcards
        for (const [prefix] of this.wildcardPatterns) {
          if (pattern.startsWith(prefix)) {
            this.patternCache.delete(pattern)
            break
          }
        }
      }
    } else {
      this.patternCache.clear()
    }
  }

  /**
   * Get all registered event patterns
   */
  eventNames(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Get listeners for a specific pattern
   */
  listeners(event: string): (TypedEventListener<any> | EventListener)[] {
    const subscriptions = this.subscriptions.get(event)
    if (!subscriptions) return []

    return Array.from(subscriptions).map(sub => sub.listener)
  }
}

/**
 * Backward compatible event emitter
 * @deprecated Use TypedMonitorEventEmitter instead
 */
export class MonitorEventEmitter<TEventData = Record<string, any>> {
  private readonly subscriptions = new Map<string, Set<EventSubscription>>()
  private readonly patternCache = new Map<string, string[]>()
  private readonly exactPatterns = new Set<string>()
  private readonly wildcardPatterns = new Map<string, string>()
  
  /**
   * Add event listener
   */
  on(event: string, listener: EventListener): this {
    this.addSubscription(event, listener, false)
    return this
  }

  /**
   * Add one-time event listener
   */
  once(event: string, listener: EventListener): this {
    this.addSubscription(event, listener, true)
    return this
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: EventListener): this {
    const subscriptions = this.subscriptions.get(event)
    if (!subscriptions) return this

    for (const subscription of subscriptions) {
      if (subscription.listener === listener) {
        subscriptions.delete(subscription)
        break
      }
    }

    if (subscriptions.size === 0) {
      this.subscriptions.delete(event)
      this.unindexPattern(event)
    }

    // Clear pattern cache for this event
    this.clearPatternCache(event)

    return this
  }

  /**
   * Emit event to all matching listeners
   */
  emit<K extends keyof TEventData>(event: K, data: TEventData[K]): boolean {
    const matchingPatterns = this.getMatchingPatterns(event as string)
    let hasListeners = false

    for (const pattern of matchingPatterns) {
      const subscriptions = this.subscriptions.get(pattern)
      if (!subscriptions || subscriptions.size === 0) continue

      hasListeners = true
      
      // Convert to array to avoid modification during iteration
      const subscriptionArray = Array.from(subscriptions)
      
      for (const subscription of subscriptionArray) {
        try {
          subscription.listener(data)
        } catch (error) {
          // Emit error but don't stop other listeners
          console.error(`Event listener error for ${pattern}:`, error)
        }

        // Remove one-time listeners
        if (subscription.once) {
          subscriptions.delete(subscription)
        }
      }

      // Clean up empty subscription sets
      if (subscriptions.size === 0) {
        this.subscriptions.delete(pattern)
      }
    }

    return hasListeners
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.subscriptions.delete(event)
      this.unindexPattern(event)
      this.clearPatternCache(event)
    } else {
      this.subscriptions.clear()
      this.exactPatterns.clear()
      this.wildcardPatterns.clear()
      this.patternCache.clear()
    }
    return this
  }

  /**
   * Get listener count for an event pattern
   */
  listenerCount(event: string): number {
    const matchingPatterns = this.getMatchingPatterns(event)
    let count = 0
    
    for (const pattern of matchingPatterns) {
      const subscriptions = this.subscriptions.get(pattern)
      if (subscriptions) {
        count += subscriptions.size
      }
    }
    
    return count
  }

  /**
   * Get all registered event patterns
   */
  eventNames(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Get listeners for a specific pattern
   */
  listeners(event: string): EventListener[] {
    const subscriptions = this.subscriptions.get(event)
    if (!subscriptions) return []
    
    return Array.from(subscriptions).map(sub => sub.listener)
  }

  /**
   * Add subscription helper
   */
  private addSubscription(pattern: string, listener: EventListener, once: boolean): void {
    let subscriptions = this.subscriptions.get(pattern)
    if (!subscriptions) {
      subscriptions = new Set()
      this.subscriptions.set(pattern, subscriptions)
      this.indexPattern(pattern)
    }

    subscriptions.add({ pattern, listener, once })
    this.clearPatternCache(pattern)
  }

  private indexPattern(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      this.wildcardPatterns.set(prefix, pattern)
    } else {
      this.exactPatterns.add(pattern)
    }
  }

  private unindexPattern(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      this.wildcardPatterns.delete(prefix)
    } else {
      this.exactPatterns.delete(pattern)
    }
  }

  /**
   * Get patterns that match the given event
   * Supports multi-level matching:
   * - transfer:addr-a matches transfer:addr-a:*:*
   * - transfer:addr-a:ethereum-sepolia matches transfer:addr-a:*
   * - transfer:addr-a:ethereum-sepolia:0x123 matches exact
   */
  private getMatchingPatterns(event: string): string[] {
    // Check cache first
    if (this.patternCache.has(event)) {
      return this.patternCache.get(event)!
    }

    const matchingPatterns: string[] = []

    // Fast exact match check
    if (this.exactPatterns.has(event)) {
      matchingPatterns.push(event)
    }

    // Fast wildcard prefix matching
    for (const [prefix, pattern] of this.wildcardPatterns) {
      if (event.startsWith(prefix)) {
        matchingPatterns.push(pattern)
      }
    }

    // Cache the result
    this.patternCache.set(event, matchingPatterns)
    return matchingPatterns
  }

  /**
   * Check if pattern matches event
   * Pattern matching rules:
   * - Exact match: pattern === event
   * - Wildcard: pattern ends with '*'
   */
  private patternMatches(pattern: string, event: string): boolean {
    // Exact match
    if (pattern === event) {
      return true
    }

    // Wildcard pattern
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return event.startsWith(prefix)
    }

    return false
  }

  /**
   * Clear pattern cache for performance
   */
  private clearPatternCache(pattern?: string): void {
    if (pattern) {
      // More efficient cache invalidation based on pattern type
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        // Clear cache entries that start with this prefix
        for (const [cachedEvent] of this.patternCache) {
          if (cachedEvent.startsWith(prefix)) {
            this.patternCache.delete(cachedEvent)
          }
        }
      } else {
        // For exact patterns, only clear the exact match
        this.patternCache.delete(pattern)
        // Also clear any cached events that might have matched this pattern via wildcards
        for (const [prefix] of this.wildcardPatterns) {
          if (pattern.startsWith(prefix)) {
            this.patternCache.delete(pattern)
            break
          }
        }
      }
    } else {
      this.patternCache.clear()
    }
  }

  /**
   * Get subscription statistics for debugging
   */
  getStats(): {
    totalPatterns: number
    totalSubscriptions: number
    cacheSize: number
    patterns: Array<{ pattern: string; subscriptions: number }>
  } {
    const patterns = this.eventNames().map(pattern => ({
      pattern,
      subscriptions: this.subscriptions.get(pattern)?.size ?? 0
    }))

    const totalSubscriptions = patterns.reduce((sum, p) => sum + p.subscriptions, 0)

    return {
      totalPatterns: patterns.length,
      totalSubscriptions,
      cacheSize: this.patternCache.size,
      patterns
    }
  }
}