/**
 * Blockchain protocol types
 * Represents the fundamental technical protocol classification
 */
export type Protocol = 'evm' | 'tron' | 'bitcoin' | 'solana';

/**
 * Supported blockchain chain identifiers
 */
export type ChainId = string;

/**
 * Chain configuration interface
 */
export interface ChainConfig {
  protocol: Protocol;
  name: string;
  network: 'mainnet' | 'testnet';
}

/**
 * Protocol registry - populated from YAML configuration at runtime
 * This is maintained in Processor system as it's business logic, not RPC configuration
 */
let CHAIN_PROTOCOLS: Record<string, Protocol> = {};

/**
 * Initialize protocols from configuration
 * This should be called by ProcessorCore during initialization
 */
export function initializeChainProtocols(chainsConfig: Record<string, ChainConfig>): void {
  CHAIN_PROTOCOLS = {};
  for (const [chainId, config] of Object.entries(chainsConfig)) {
    CHAIN_PROTOCOLS[chainId] = config.protocol;
  }
}

/**
 * Get the current protocols registry
 * For testing and debugging purposes
 */
export function getChainProtocolsRegistry(): Record<string, Protocol> {
  return { ...CHAIN_PROTOCOLS };
}

/**
 * Get protocol for a given chain ID
 * @param chainId - The blockchain chain identifier
 * @returns The protocol type
 * @throws Error if chain ID is not supported
 */
export function getProtocol(chainId: string): Protocol {
  const protocol = CHAIN_PROTOCOLS[chainId];
  if (!protocol) {
    throw new Error(`Unsupported chain ID: ${chainId}. Available chains: ${Object.keys(CHAIN_PROTOCOLS).join(', ')}`);
  }
  return protocol;
}

/**
 * Check if a chain ID is supported
 * @param chainId - The blockchain chain identifier to check
 * @returns True if the chain is supported
 */
export function isSupportedChain(chainId: string): boolean {
  return chainId in CHAIN_PROTOCOLS;
}

/**
 * Get all supported chain IDs
 * @returns Array of all supported chain identifiers
 */
export function getAllSupportedChains(): string[] {
  return Object.keys(CHAIN_PROTOCOLS);
}

/**
 * Get chains by protocol type
 * @param protocol - The protocol to filter by
 * @returns Array of chain IDs belonging to the specified protocol
 */
export function getChainsByProtocol(protocol: Protocol): string[] {
  return Object.entries(CHAIN_PROTOCOLS)
    .filter(([, chainProtocol]) => chainProtocol === protocol)
    .map(([id]) => id);
}

/**
 * Check if a chain is EVM-compatible
 * @param chainId - The blockchain chain identifier
 * @returns True if the chain uses EVM
 */
export function isEVMChain(chainId: string): boolean {
  try {
    return getProtocol(chainId) === 'evm';
  } catch {
    return false;
  }
}

/**
 * Check if a chain is Tron-based
 * @param chainId - The blockchain chain identifier
 * @returns True if the chain is Tron-based
 */
export function isTronChain(chainId: string): boolean {
  try {
    return getProtocol(chainId) === 'tron';
  } catch {
    return false;
  }
}