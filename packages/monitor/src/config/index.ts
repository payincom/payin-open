/**
 * @payin/monitor - Configuration management
 */

// Chain state management
export type { ChainScanState } from './chain-state.js'

export {
  createChainScanState,
  addTargetsToChainState,
  removeTargetsFromChainState,
  hasActiveTargets,
  getActiveContracts,
  getActiveAddresses,
  isTargetActive,
  updateLastWatchedBlock,
  getChainStateSummary
} from './chain-state.js'

// Monitor configuration (re-export from unified types)
export {
  validateMonitorConfig,
  validateChainRange,
  createBlockRangeConfig,
  cloneMonitorConfig
} from '../types/index.js'

// Configuration management
export { MonitorConfigLoader, loadMonitorConfig } from './config-loader.js'
export type { LoadedConfig } from './config-loader.js'

export { ConfigValidator, validateConfig } from './config-validator.js'
export type { ValidationResult } from './config-validator.js'