/**
 * Supported blockchain chains
 */
export type Chain =
  | 'ethereum-mainnet'
  | 'ethereum-sepolia'
  | 'polygon-mainnet'
  | 'polygon-amoy'
  | 'tron-mainnet'
  | 'tron-nile'
  | 'base-mainnet'
  | 'base-sepolia'
  | 'solana-mainnet'
  | 'solana-devnet'
  | 'arbitrum-mainnet'
  | 'arbitrum-sepolia'
  | 'xlayer-mainnet'
  | 'xlayer-testnet'

/**
 * Protocol types for chain grouping
 */
export type Protocol = 'evm' | 'tron' | 'solana'

/**
 * Chain configuration mapping
 */
export interface ChainConfig {
  readonly chain: Chain
  readonly name: string
  readonly protocol: Protocol
  readonly chainId?: number  // EVM chains only
  readonly isTestnet: boolean
  readonly nativeToken: string
  readonly blockTime: number  // Average block time in seconds
  readonly safeBlockDistance: number  // Safe block distance to avoid reorgs
  readonly defaultBatchSize: number  // Default number of blocks/slots to scan per batch in recovery mode
}

/**
 * Chain configuration registry
 */
export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  'ethereum-mainnet': {
    chain: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    protocol: 'evm',
    chainId: 1,
    isTestnet: false,
    nativeToken: 'ETH',
    blockTime: 12,
    safeBlockDistance: 12,
    defaultBatchSize: 50  // 12s/block * 50 = 10 minutes per batch
  },
  'ethereum-sepolia': {
    chain: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    protocol: 'evm',
    chainId: 11155111,
    isTestnet: true,
    nativeToken: 'ETH',
    blockTime: 12,
    safeBlockDistance: 3,
    defaultBatchSize: 50  // 12s/block * 50 = 10 minutes per batch
  },
  'polygon-mainnet': {
    chain: 'polygon-mainnet',
    name: 'Polygon Mainnet',
    protocol: 'evm',
    chainId: 137,
    isTestnet: false,
    nativeToken: 'MATIC',
    blockTime: 2,
    safeBlockDistance: 30,
    defaultBatchSize: 100  // 2s/block * 100 = 3.3 minutes per batch
  },
  'polygon-amoy': {
    chain: 'polygon-amoy',
    name: 'Polygon Amoy',
    protocol: 'evm',
    chainId: 80002,
    isTestnet: true,
    nativeToken: 'MATIC',
    blockTime: 2,
    safeBlockDistance: 3,
    defaultBatchSize: 100  // 2s/block * 100 = 3.3 minutes per batch
  },
  'tron-mainnet': {
    chain: 'tron-mainnet',
    name: 'Tron Mainnet',
    protocol: 'tron',
    isTestnet: false,
    nativeToken: 'TRX',
    blockTime: 3,
    safeBlockDistance: 19,
    defaultBatchSize: 100  // 3s/block * 100 = 5 minutes per batch
  },
  'tron-nile': {
    chain: 'tron-nile',
    name: 'Tron Nile',
    protocol: 'tron',
    isTestnet: true,
    nativeToken: 'TRX',
    blockTime: 3,
    safeBlockDistance: 1,
    defaultBatchSize: 100  // 3s/block * 100 = 5 minutes per batch
  },
  'base-mainnet': {
    chain: 'base-mainnet',
    name: 'Base Mainnet',
    protocol: 'evm',
    chainId: 8453,
    isTestnet: false,
    nativeToken: 'ETH',
    blockTime: 2,
    safeBlockDistance: 30,
    defaultBatchSize: 100  // 2s/block * 100 = 3.3 minutes per batch
  },
  'base-sepolia': {
    chain: 'base-sepolia',
    name: 'Base Sepolia',
    protocol: 'evm',
    chainId: 84532,
    isTestnet: true,
    nativeToken: 'ETH',
    blockTime: 2,
    safeBlockDistance: 3,
    defaultBatchSize: 100  // 2s/block * 100 = 3.3 minutes per batch
  },
  'solana-mainnet': {
    chain: 'solana-mainnet',
    name: 'Solana Mainnet',
    protocol: 'solana',
    isTestnet: false,
    nativeToken: 'SOL',
    blockTime: 0.4,  // ~400ms slot time
    safeBlockDistance: 32,  // Finalized commitment (~12.8 seconds)
    defaultBatchSize: 500  // 0.4s/slot * 500 = 3.3 minutes per batch
  },
  'solana-devnet': {
    chain: 'solana-devnet',
    name: 'Solana Devnet',
    protocol: 'solana',
    isTestnet: true,
    nativeToken: 'SOL',
    blockTime: 0.4,
    safeBlockDistance: 32,
    defaultBatchSize: 500  // 0.4s/slot * 500 = 3.3 minutes per batch
  },
  'arbitrum-mainnet': {
    chain: 'arbitrum-mainnet',
    name: 'Arbitrum One',
    protocol: 'evm',
    chainId: 42161,
    isTestnet: false,
    nativeToken: 'ETH',
    blockTime: 0.3,
    safeBlockDistance: 20,
    defaultBatchSize: 150
  },
  'arbitrum-sepolia': {
    chain: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    protocol: 'evm',
    chainId: 421614,
    isTestnet: true,
    nativeToken: 'ETH',
    blockTime: 0.3,
    safeBlockDistance: 5,
    defaultBatchSize: 150
  },
  'xlayer-mainnet': {
    chain: 'xlayer-mainnet',
    name: 'X Layer Mainnet',
    protocol: 'evm',
    chainId: 196,
    isTestnet: false,
    nativeToken: 'OKB',
    blockTime: 3,
    safeBlockDistance: 10,
    defaultBatchSize: 100  // 3s/block * 100 = 5 minutes per batch
  },
  'xlayer-testnet': {
    chain: 'xlayer-testnet',
    name: 'X Layer Testnet',
    protocol: 'evm',
    chainId: 1952,
    isTestnet: true,
    nativeToken: 'OKB',
    blockTime: 3,
    safeBlockDistance: 3,
    defaultBatchSize: 100
  }
}

/**
 * Get chain configuration
 */
export function getChainConfig(chain: Chain): ChainConfig {
  const config = CHAIN_CONFIGS[chain]
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`)
  }
  return config
}

/**
 * Get chains by protocol family
 */
export function getChainsByProtocol(protocol: Protocol): Chain[] {
  return Object.values(CHAIN_CONFIGS)
    .filter(config => config.protocol === protocol)
    .map(config => config.chain)
}

/**
 * Check if chain is testnet
 */
export function isTestnet(chain: Chain): boolean {
  return getChainConfig(chain).isTestnet
}
