import type { Chain } from './chains.js'

/**
 * Transfer event from blockchain
 */
export interface TransferEvent {
  readonly chain: Chain
  readonly contract: string        // Token contract address
  readonly to: string              // Recipient address  
  readonly from: string            // Sender address
  readonly amount: string          // Raw amount string (no decimals applied)
  readonly transactionHash: string
  readonly blockNumber: number
  readonly logIndex: number        // EVM specific - kept for backward compatibility
  readonly eventIndex: number      // Universal event index for cross-chain deduplication
  readonly timestamp: number       // Block timestamp in seconds
}

/**
 * Block progress event
 */
export interface BlockProgressEvent {
  readonly chain: Chain
  readonly fromBlock: number
  readonly toBlock: number
  readonly lastWatchedBlock: number
  readonly timestamp: number
}

/**
 * Monitor status event
 */
export interface MonitorStatusEvent {
  readonly status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped'
  readonly chains: readonly Chain[]
  readonly timestamp: number
}

/**
 * Monitor error event
 */
export interface MonitorErrorEvent {
  readonly error: Error
  readonly chain?: Chain
  readonly context?: string
  readonly timestamp: number
}

/**
 * Strict event map with strong typing
 */
export interface StrictMonitorEventMap {
  // Transfer events - multi-level subscription
  'transfer': TransferEvent

  // Block progress events
  'blockProgress': BlockProgressEvent

  // Status events
  'status': MonitorStatusEvent

  // Error events
  'error': MonitorErrorEvent
}

/**
 * Strict event map with pattern matching support
 */
export type StrictMonitorEventMapWithPatterns = StrictMonitorEventMap & {
  // Pattern-based event types for multi-level subscription
  [K in TransferEventPattern]: TransferEvent
} & {
  [K in BlockProgressEventPattern]: BlockProgressEvent
} & {
  [K in ErrorEventPattern]: MonitorErrorEvent
}

/**
 * Backward compatibility event map
 * @deprecated Use StrictMonitorEventMap instead
 */
export interface MonitorEventMap extends Record<string, (...args: any[]) => void> {
  // Transfer events - multi-level subscription
  'transfer': (event: TransferEvent) => void

  // Block progress events
  'blockProgress': (event: BlockProgressEvent) => void

  // Status events
  'status': (event: MonitorStatusEvent) => void

  // Error events
  'error': (error: Error) => void
}

/**
 * Event subscription pattern types
 */
export type TransferEventPattern = `transfer:${string}`
export type BlockProgressEventPattern = `blockProgress:${string}` | 'blockProgress'
export type ErrorEventPattern = `error:${string}` | 'error'

/**
 * Type-safe event listener for specific event types
 */
export type TypedEventListener<T> = (data: T) => void

/**
 * Event listener function type
 * @deprecated Use TypedEventListener instead
 */
export type EventListener<T = any> = (...args: any[]) => void

/**
 * Type-safe event emitter interface
 */
export interface TypedEventEmitter<TEventMap extends Record<string, any>> {
  on<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this
  off<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this
  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): boolean
  once<K extends keyof TEventMap>(event: K, listener: TypedEventListener<TEventMap[K]>): this
  removeAllListeners<K extends keyof TEventMap>(event?: K): this
  listenerCount<K extends keyof TEventMap>(event: K): number
}

/**
 * Event emitter base interface
 * @deprecated Use TypedEventEmitter instead
 */
export interface EventEmitter {
  on(event: string, listener: EventListener): this
  off(event: string, listener: EventListener): this
  emit(event: string, ...args: any[]): boolean
  once(event: string, listener: EventListener): this
  removeAllListeners(event?: string): this
  listenerCount(event: string): number
}

/**
 * Monitor event emitter type
 * @deprecated Use TypedEventEmitter<StrictMonitorEventMap> instead
 */
export type MonitorEventEmitter = EventEmitter