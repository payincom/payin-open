/**
 * @payin/monitor - Protocol Adapters
 */

// Base adapter
export type {
  NetworkRPCCapabilities,
  BlockScanRequest,
  BlockScanResult
} from './base-adapter.js'

export { BaseAdapter } from './base-adapter.js'

// Concrete adapters
export { EVMAdapter } from './evm-adapter.js'
export { TronAdapter } from './tron-adapter.js'
export { SolanaAdapter } from './solana-adapter.js'

// Adapter factory
export type {
  RPCEndpointConfig,
  ChainAdapterConfig
} from './adapter-factory.js'

export { AdapterFactory, createDefaultAdapterFactory } from './adapter-factory.js'