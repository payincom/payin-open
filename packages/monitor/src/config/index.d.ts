/**
 * @payin/monitor - Configuration management
 */
export type { ChainScanState } from './chain-state.js';
export { createChainScanState, addTargetsToChainState, removeTargetsFromChainState, hasActiveTargets, getActiveContracts, getActiveAddresses, isTargetActive, updateLastWatchedBlock, getChainStateSummary } from './chain-state.js';
export { validateMonitorConfig, validateChainRange, validateScanSettings, getEffectiveScanSettings, createBlockRangeConfig, cloneMonitorConfig } from '../types/index.js';
export { MonitorConfigLoader, loadMonitorConfig } from './config-loader.js';
export type { LoadedConfig } from './config-loader.js';
export { ConfigValidator, validateConfig } from './config-validator.js';
export type { ValidationResult } from './config-validator.js';
//# sourceMappingURL=index.d.ts.map