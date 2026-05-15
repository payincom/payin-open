// Types
import type { ConfigFormat } from './types/rpc-config.js'
export type {
  RPCProviderTemplate,
  RPCEndpointConfig,
  RPCChainConfig,
  RPCGlobalConfig,
  RPCEndpointInstance,
  RPCMetrics,
  ConfigLoader,
  ConfigFormat,
  RPCProviderKeys
} from './types/rpc-config.js'

// Config System
export { RPCConfigLoader } from './config/config-loader.js'
export { RPCConfigBuilder, createRPCConfig } from './config/rpc-config-builder.js'
export { getProvidersForNetwork, requiresApiKey, normalizeProviderTemplates } from './config/provider-templates.js'

// RPC Manager
export { RPCManager } from './manager/rpc-manager.js'
export type { RPCManagerOptions, RPCRequest, RPCResponse } from './manager/rpc-manager.js'

// Load Balancer
export { LoadBalancer, RoundRobinStrategy, FailoverStrategy, FastestStrategy } from './manager/load-balancer.js'
export type { LoadBalancerStrategy } from './manager/load-balancer.js'

// Health Checker
export { HealthChecker } from './manager/health-checker.js'
export type { HealthCheckResult, HealthCheckOptions } from './manager/health-checker.js'

// Rate Limiter
export { EndpointRateLimiter, TokenBucketRateLimiter, GlobalRateLimiter } from './manager/rate-limiter.js'
export type { RateLimiterOptions, EndpointRateLimitConfig } from './manager/rate-limiter.js'

// Main convenience function to create RPC Manager
export async function createRPCManager(
  rpcKeys: Record<string, string>, 
  configPath?: string, 
  rpcConfig?: ConfigFormat,
  disablePublicProviders?: boolean
) {
  const { RPCManager } = await import('./manager/rpc-manager.js')
  
  const options: any = { rpcKeys }
  if (configPath) {
    options.configPath = configPath
  }
  if (rpcConfig) {
    options.rpcConfig = rpcConfig
  }
  if (disablePublicProviders !== undefined) {
    options.disablePublicProviders = disablePublicProviders
  }
  
  const rpcManager = new RPCManager(options)
  await rpcManager.initialize()
  return rpcManager
}