import type { Chain } from './chains.js'

/**
 * Base monitor error
 */
export class MonitorError extends Error {
  public readonly code: string
  public readonly chain?: Chain | undefined
  public readonly context?: Record<string, unknown> | undefined

  constructor(
    message: string,
    code: string,
    chain?: Chain,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'MonitorError'
    this.code = code
    this.chain = chain
    this.context = context
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      chain: this.chain,
      context: this.context,
      stack: this.stack
    }
  }
}

/**
 * Configuration validation error
 */
export class ConfigError extends MonitorError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', undefined, context)
    this.name = 'ConfigError'
  }
}

/**
 * Chain adapter error
 */
export class ChainAdapterError extends MonitorError {
  constructor(message: string, chain: Chain, context?: Record<string, unknown>) {
    super(message, 'CHAIN_ADAPTER_ERROR', chain, context)
    this.name = 'ChainAdapterError'
  }
}

/**
 * RPC provider error
 */
export class RPCProviderError extends MonitorError {
  constructor(message: string, chain: Chain, context?: Record<string, unknown>) {
    super(message, 'RPC_PROVIDER_ERROR', chain, context)
    this.name = 'RPCProviderError'
  }
}

/**
 * Block scanning error
 */
export class BlockScanError extends MonitorError {
  constructor(message: string, chain: Chain, context?: Record<string, unknown>) {
    super(message, 'BLOCK_SCAN_ERROR', chain, context)
    this.name = 'BlockScanError'
  }
}

/**
 * Monitor lifecycle error
 */
export class MonitorLifecycleError extends MonitorError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MONITOR_LIFECYCLE_ERROR', undefined, context)
    this.name = 'MonitorLifecycleError'
  }
}

/**
 * Event processing error
 */
export class EventProcessingError extends MonitorError {
  constructor(message: string, chain?: Chain, context?: Record<string, unknown>) {
    super(message, 'EVENT_PROCESSING_ERROR', chain, context)
    this.name = 'EventProcessingError'
  }
}

/**
 * Monitor error codes enum
 */
export const MonitorErrorCode = {
  CONFIG_ERROR: 'CONFIG_ERROR',
  CHAIN_ADAPTER_ERROR: 'CHAIN_ADAPTER_ERROR', 
  RPC_PROVIDER_ERROR: 'RPC_PROVIDER_ERROR',
  BLOCK_SCAN_ERROR: 'BLOCK_SCAN_ERROR',
  MONITOR_LIFECYCLE_ERROR: 'MONITOR_LIFECYCLE_ERROR',
  EVENT_PROCESSING_ERROR: 'EVENT_PROCESSING_ERROR'
} as const

export type MonitorErrorCodeType = typeof MonitorErrorCode[keyof typeof MonitorErrorCode]

/**
 * Error utility functions
 */
export function isMonitorError(error: unknown): error is MonitorError {
  return error instanceof MonitorError
}

export function createChainError(
  message: string,
  chain: Chain,
  originalError?: Error
): ChainAdapterError {
  const context = originalError ? {
    originalError: originalError.message,
    stack: originalError.stack
  } : undefined
  
  return new ChainAdapterError(message, chain, context)
}

export function createRPCError(
  message: string,
  chain: Chain,
  endpoint?: string,
  originalError?: Error
): RPCProviderError {
  const context = {
    endpoint,
    originalError: originalError?.message,
    stack: originalError?.stack
  }
  
  return new RPCProviderError(message, chain, context)
}