/**
 * @payin/monitor - Multi-chain blockchain monitoring system
 *
 * A high-performance, cost-optimized solution for monitoring cryptocurrency
 * transactions across multiple blockchain networks.
 *
 * Features:
 * - 🌐 Multi-Chain Support: Ethereum, Polygon, Tron, and more
 * - 📄 Multi-Contract: Monitor any ERC20/TRC20 token contracts
 * - 🚀 99%+ Cost Reduction: Contract-level batch filtering
 * - ⚡ Real-time Monitoring: Sub-10 second transaction detection
 * - 🛡️ Enterprise Recovery: Instance lifecycle management
 * - 🔄 Round Robin + Failover: Production-grade RPC management
 */
// Export all types
export * from './types/index.js';
// Export configuration management
export * from './config/index.js';
// Export adapters
export * from './adapters/index.js';
// Export events
export { MonitorEventEmitter, TypedMonitorEventEmitter, EventPatterns } from './events/index.js';
// Export state management
export * from './state/index.js';
// Export target management
export * from './targets/index.js';
// Export RPC management
export { RPCConfigLoader, RPCConfigBuilder, createRPCConfig, getProvidersForNetwork, requiresApiKey, normalizeProviderTemplates, RPCManager, LoadBalancer, RoundRobinStrategy, FailoverStrategy, FastestStrategy, HealthChecker, EndpointRateLimiter, TokenBucketRateLimiter, GlobalRateLimiter, createRPCManager } from './rpc/index.js';
// Export monitor engine
export { Monitor } from './monitor/index.js';
// Export defaults
export { getDefaults } from './defaults.js';
// Version info
export const VERSION = '0.1.0';
export const PACKAGE_NAME = '@payin/monitor';
/**
 * Package metadata
 */
export const PACKAGE_INFO = {
    name: PACKAGE_NAME,
    version: VERSION,
    description: 'Protocol-agnostic multi-chain blockchain monitoring system',
    features: [
        'Multi-Chain Support',
        'Contract-level Batch Filtering',
        'Instance Lifecycle Management',
        'Event-driven Architecture',
        'Round Robin + Failover RPC'
    ]
};
//# sourceMappingURL=index.js.map