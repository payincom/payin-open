/**
 * @payin/monitor - Type definitions
 */

// Chain types
export type {
  Chain,
  Protocol,
  ChainConfig
} from './chains.js'

export {
  CHAIN_CONFIGS,
  getChainConfig,
  getChainsByProtocol,
  isTestnet
} from './chains.js'

// Event types
export type {
  TransferEvent,
  BlockProgressEvent,
  MonitorStatusEvent,
  MonitorErrorEvent,
  StrictMonitorEventMap,
  StrictMonitorEventMapWithPatterns,
  MonitorEventMap,
  TransferEventPattern,
  BlockProgressEventPattern,
  ErrorEventPattern,
  TypedEventListener,
  TypedEventEmitter,
  EventListener,
  EventEmitter,
  MonitorEventEmitter
} from './events.js'

// Request types
export type {
  MonitoringTarget,
  MonitoringRequest,
  ChainRange,
  MonitorConfig,
  MonitorOptions,
  StateStorage
} from './requests.js'

export {
  DEFAULT_MONITOR_CONFIG,
  createMonitorConfig,
  createBlockRangeConfig,
  createSimpleConfig,
  createMonitoringTarget,
  createMonitoringRequest,
  validateMonitorConfig,
  validateChainRange,
  cloneMonitorConfig
} from './requests.js'

// Error types
export {
  MonitorError,
  ConfigError,
  ChainAdapterError,
  RPCProviderError,
  BlockScanError,
  MonitorLifecycleError,
  EventProcessingError,
  MonitorErrorCode,
  isMonitorError,
  createChainError,
  createRPCError
} from './errors.js'

export type {
  MonitorErrorCodeType
} from './errors.js'