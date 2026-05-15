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
export * from './types/index.js';
export * from './config/index.js';
export * from './adapters/index.js';
export { MonitorEventEmitter, TypedMonitorEventEmitter, EventPatterns } from './events/index.js';
export * from './state/index.js';
export * from './targets/index.js';
export { RPCConfigLoader, RPCConfigBuilder, createRPCConfig, getProvidersForNetwork, requiresApiKey, normalizeProviderTemplates, RPCManager, LoadBalancer, RoundRobinStrategy, FailoverStrategy, FastestStrategy, HealthChecker, EndpointRateLimiter, TokenBucketRateLimiter, GlobalRateLimiter, createRPCManager } from './rpc/index.js';
export type { RPCProviderTemplate, RPCChainConfig, RPCGlobalConfig, RPCEndpointInstance, RPCMetrics, ConfigLoader, ConfigFormat, RPCProviderKeys, RPCManagerOptions, RPCRequest, RPCResponse, LoadBalancerStrategy, HealthCheckResult, HealthCheckOptions, RateLimiterOptions, EndpointRateLimitConfig } from './rpc/index.js';
export { Monitor } from './monitor/index.js';
export type { MonitorOptions, MonitorStats, MonitorStatus } from './monitor/index.js';
export { getDefaults } from './defaults.js';
export type { MonitorDefaults, RPCProviderDefault, RPCChainConfigDefault } from './defaults.js';
export declare const VERSION = "0.1.0";
export declare const PACKAGE_NAME = "@payin/monitor";
/**
 * Package metadata
 */
export declare const PACKAGE_INFO: {
    readonly name: "@payin/monitor";
    readonly version: "0.1.0";
    readonly description: "Protocol-agnostic multi-chain blockchain monitoring system";
    readonly features: readonly ["Multi-Chain Support", "Contract-level Batch Filtering", "Instance Lifecycle Management", "Event-driven Architecture", "Round Robin + Failover RPC"];
};
//# sourceMappingURL=index.d.ts.map