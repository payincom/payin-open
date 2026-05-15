/**
 * Multi-Chain Test Configuration
 *
 * Defines available chain+token combinations for testing
 * Supports random selection or explicit configuration via env vars
 */

export interface ChainTokenConfig {
  chain: string
  token: string
  protocol: 'evm' | 'solana' | 'tron'
}

/**
 * Available chain+token combinations for testing
 */
export const AVAILABLE_TEST_CHAINS: ChainTokenConfig[] = [
  { chain: 'ethereum-sepolia', token: 'USDC', protocol: 'evm' },
  { chain: 'polygon-amoy', token: 'USDC', protocol: 'evm' },
  { chain: 'solana-devnet', token: 'USDC', protocol: 'solana' },
  // { chain: 'tron-nile', token: 'USDT', protocol: 'tron' },  // Optional - can be unstable
]

/**
 * Get test chain configuration from environment or random selection
 *
 * Environment variables:
 * - TEST_CHAIN: Chain ID (e.g., 'ethereum-sepolia', 'solana-devnet')
 * - TEST_TOKEN: Token symbol (e.g., 'USDC', 'USDT')
 *
 * @param options Optional override options
 * @returns Chain configuration to use for testing
 */
export function getTestChainConfig(options?: {
  chain?: string
  token?: string
  protocol?: 'evm' | 'solana' | 'tron'
}): ChainTokenConfig {
  // Priority: options > env vars > random
  const chain = options?.chain || process.env.TEST_CHAIN
  const token = options?.token || process.env.TEST_TOKEN
  const protocol = options?.protocol || process.env.TEST_PROTOCOL

  // If both chain and token specified, find exact match
  if (chain && token) {
    const config = AVAILABLE_TEST_CHAINS.find(
      c => c.chain === chain && c.token === token
    )
    if (config) {
      return config
    }
    throw new Error(
      `Invalid chain+token combination: ${chain}+${token}. ` +
      `Available combinations: ${AVAILABLE_TEST_CHAINS.map(c => `${c.chain}+${c.token}`).join(', ')}`
    )
  }

  // If only chain specified, find first match
  if (chain) {
    const config = AVAILABLE_TEST_CHAINS.find(c => c.chain === chain)
    if (config) {
      return config
    }
    throw new Error(
      `Invalid chain: ${chain}. ` +
      `Available chains: ${[...new Set(AVAILABLE_TEST_CHAINS.map(c => c.chain))].join(', ')}`
    )
  }

  // If only token specified, find first match
  if (token) {
    const config = AVAILABLE_TEST_CHAINS.find(c => c.token === token)
    if (config) {
      return config
    }
    throw new Error(
      `Invalid token: ${token}. ` +
      `Available tokens: ${[...new Set(AVAILABLE_TEST_CHAINS.map(c => c.token))].join(', ')}`
    )
  }

  // If only protocol specified, randomly select from that protocol
  if (protocol) {
    const protocolChains = AVAILABLE_TEST_CHAINS.filter(c => c.protocol === protocol)
    if (protocolChains.length === 0) {
      throw new Error(`No chains available for protocol: ${protocol}`)
    }
    return protocolChains[Math.floor(Math.random() * protocolChains.length)]
  }

  // Random selection from all available chains
  return AVAILABLE_TEST_CHAINS[Math.floor(Math.random() * AVAILABLE_TEST_CHAINS.length)]
}

/**
 * Get multiple random chain configurations (for multi-chain deposit tests)
 *
 * @param count Number of chains to select
 * @param protocol Optional protocol filter
 * @returns Array of chain configurations
 */
export function getMultiChainConfig(count: number = 2, protocol?: 'evm' | 'solana' | 'tron'): ChainTokenConfig[] {
  const availableChains = protocol
    ? AVAILABLE_TEST_CHAINS.filter(c => c.protocol === protocol)
    : AVAILABLE_TEST_CHAINS

  if (availableChains.length < count) {
    throw new Error(`Not enough chains available. Requested: ${count}, Available: ${availableChains.length}`)
  }

  // Shuffle and take first N
  const shuffled = [...availableChains].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
