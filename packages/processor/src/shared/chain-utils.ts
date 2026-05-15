/**
 * Chain Utility Functions
 * Provides consistent chain-related operations and configurations
 */

import type { Protocol, ChainId } from '../config/chain-config.js';

/**
 * Chain confirmation requirements
 */
export interface ChainConfirmationConfig {
  [chainId: string]: number;
}

/**
 * Default confirmation requirements by chain
 */
export const DEFAULT_CHAIN_CONFIRMATIONS: ChainConfirmationConfig = {
  'ethereum-mainnet': 3,
  'ethereum-sepolia': 3,
  'polygon-mainnet': 10,
  'polygon-amoy': 10,
  'tron-mainnet': 20,
  'tron-nile': 20,
  'tron-shasta': 20,
  'bitcoin-mainnet': 6,
  'bitcoin-testnet': 3,
  'solana-mainnet': 32,
  'solana-devnet': 32,
  'arbitrum-mainnet': 5,
  'arbitrum-sepolia': 3,
  'xlayer-mainnet': 10,
  'xlayer-testnet': 3
};

/**
 * Chain utilities for blockchain operations
 */
export class ChainUtils {
  /**
   * Get required confirmations for a chain
   * @param chainId - Chain identifier
   * @returns Number of required confirmations
   */
  static getRequiredConfirmations(chainId: string): number {
    return DEFAULT_CHAIN_CONFIRMATIONS[chainId] || 3;
  }

  /**
   * Get protocol from chain ID
   * @param chainId - Chain identifier
   * @returns Protocol ('evm', 'tron', 'bitcoin', or 'solana')
   */
  static getChainFamily(chainId: string): Protocol {
    if (chainId.includes('tron') || chainId.includes('nile') || chainId.includes('shasta')) {
      return 'tron';
    }
    if (chainId.includes('bitcoin')) {
      return 'bitcoin';
    }
    if (chainId.includes('solana')) {
      return 'solana';
    }
    // Default to EVM for Ethereum, Polygon, BSC, etc.
    return 'evm';
  }

  /**
   * Check if chain is EVM compatible
   * @param chainId - Chain identifier
   * @returns True if EVM compatible
   */
  static isEVMChain(chainId: string): boolean {
    return this.getChainFamily(chainId) === 'evm';
  }

  /**
   * Check if chain is Tron
   * @param chainId - Chain identifier
   * @returns True if Tron chain
   */
  static isTronChain(chainId: string): boolean {
    return this.getChainFamily(chainId) === 'tron';
  }

  /**
   * Check if chain is Bitcoin
   * @param chainId - Chain identifier
   * @returns True if Bitcoin chain
   */
  static isBitcoinChain(chainId: string): boolean {
    return this.getChainFamily(chainId) === 'bitcoin';
  }

  /**
   * Normalize chain ID to standard format
   * @param chainId - Chain identifier
   * @returns Normalized chain ID
   */
  static normalizeChainId(chainId: string): string {
    if (!chainId) {
      return '';
    }
    return chainId
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, '-');
  }

  /**
   * Get chains by protocol
   * @param protocol - Protocol type
   * @returns Array of chain IDs in the protocol
   */
  static getChainsByFamily(protocol: Protocol): string[] {
    const allChains = Object.keys(DEFAULT_CHAIN_CONFIRMATIONS);
    return allChains.filter(chain => this.getChainFamily(chain) === protocol);
  }

  /**
   * Validate chain ID format
   * @param chainId - Chain identifier to validate
   * @returns True if valid chain ID format
   */
  static isValidChainId(chainId: string): boolean {
    if (!chainId || typeof chainId !== 'string') return false;
    const normalized = this.normalizeChainId(chainId);
    // Basic validation: should contain alphanumeric characters and hyphens
    return /^[a-z0-9-]+$/.test(normalized) && normalized.length > 0;
  }

  /**
   * Check if chain is supported
   * @param chainId - Chain identifier
   * @returns True if chain is supported
   */
  static isSupportedChain(chainId: string): boolean {
    return chainId in DEFAULT_CHAIN_CONFIRMATIONS;
  }

  /**
   * Get all supported chains
   * @returns Array of all supported chain IDs
   */
  static getAllSupportedChains(): string[] {
    return Object.keys(DEFAULT_CHAIN_CONFIRMATIONS);
  }

  /**
   * Get mainnet chain for a testnet
   * @param testnetChain - Testnet chain ID
   * @returns Mainnet chain ID or original if already mainnet
   */
  static getMainnetChain(testnetChain: string): string {
    const mainnetMap: { [testnet: string]: string } = {
      'ethereum-sepolia': 'ethereum-mainnet',
      'polygon-amoy': 'polygon-mainnet',
      'tron-nile': 'tron-mainnet',
      'tron-shasta': 'tron-mainnet',
      'bitcoin-testnet': 'bitcoin-mainnet',
      'solana-devnet': 'solana-mainnet',
      'arbitrum-sepolia': 'arbitrum-mainnet'
    };

    return mainnetMap[testnetChain] || testnetChain;
  }

  /**
   * Get testnet chain for a mainnet
   * @param mainnetChain - Mainnet chain ID
   * @returns Testnet chain ID or original if no testnet available
   */
  static getTestnetChain(mainnetChain: string): string {
    const testnetMap: { [mainnet: string]: string } = {
      'ethereum-mainnet': 'ethereum-sepolia',
      'polygon-mainnet': 'polygon-amoy',
      'tron-mainnet': 'tron-nile',
      'bitcoin-mainnet': 'bitcoin-testnet',
      'solana-mainnet': 'solana-devnet',
      'arbitrum-mainnet': 'arbitrum-sepolia'
    };

    return testnetMap[mainnetChain] || mainnetChain;
  }

  /**
   * Check if chain is a testnet
   * @param chainId - Chain identifier
   * @returns True if testnet
   */
  static isTestnet(chainId: string): boolean {
    const testnets = ['sepolia', 'amoy', 'nile', 'shasta', 'testnet', 'devnet'];
    return testnets.some(testnet => chainId.includes(testnet));
  }

  /**
   * Get chain display name
   * @param chainId - Chain identifier
   * @returns Human-readable chain name
   */
  static getChainDisplayName(chainId: string): string {
    const displayNames: { [chainId: string]: string } = {
      'ethereum-mainnet': 'Ethereum',
      'ethereum-sepolia': 'Ethereum Sepolia',
      'polygon-mainnet': 'Polygon',
      'polygon-amoy': 'Polygon Amoy',
      'tron-mainnet': 'Tron',
      'tron-nile': 'Tron Nile',
      'tron-shasta': 'Tron Shasta',
      'bitcoin-mainnet': 'Bitcoin',
      'bitcoin-testnet': 'Bitcoin Testnet',
      'solana-mainnet': 'Solana',
      'solana-devnet': 'Solana Devnet',
      'arbitrum-mainnet': 'Arbitrum One',
      'arbitrum-sepolia': 'Arbitrum Sepolia'
    };

    return displayNames[chainId] || chainId;
  }

  /**
   * Detect protocol from address format
   * @param address - Blockchain address
   * @returns Protocol ('evm' or 'tron')
   * @throws Error if address format is invalid
   */
  static detectProtocolFromAddress(address: string): 'evm' | 'tron' {
    if (!address || typeof address !== 'string') {
      throw new Error('Invalid address: address must be a non-empty string');
    }

    const trimmedAddress = address.trim();

    // EVM address: starts with 0x, 42 characters total (0x + 40 hex chars)
    if (trimmedAddress.startsWith('0x') && trimmedAddress.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(trimmedAddress)) {
      return 'evm';
    }

    // Tron address: starts with T, 34 characters total (Base58 encoded)
    if (trimmedAddress.startsWith('T') && trimmedAddress.length === 34 && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmedAddress)) {
      return 'tron';
    }

    throw new Error(`Invalid address format: ${address}. Expected EVM (0x...) or Tron (T...) address`);
  }
}
