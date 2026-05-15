/**
 * Wagmi Configuration
 * Configures supported chains and transports for RainbowKit
 */

import { http, createConfig } from 'wagmi';
import { sepolia, mainnet, polygon, polygonAmoy, arbitrum, arbitrumSepolia, base, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { ChainInfo } from '../types';

/**
 * Mapping of chain IDs to Wagmi chain objects (EVM chains only)
 */
const CHAIN_MAP: Record<string, any> = {
  'ethereum-mainnet': mainnet,
  'ethereum-sepolia': sepolia,
  'polygon-mainnet': polygon,
  'polygon-amoy': polygonAmoy,
  'arbitrum-mainnet': arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  'base-mainnet': base,
  'base-sepolia': baseSepolia,
};

/**
 * Mapping of PayIn chain IDs to numeric chain IDs (EVM chains only)
 * Used for Wagmi chain switching - non-EVM chains (e.g., Tron) don't use Wagmi
 */
const NUMERIC_CHAIN_ID_MAP: Record<string, number> = {
  // EVM chains
  'ethereum-mainnet': 1,
  'ethereum-sepolia': 11155111,
  'polygon-mainnet': 137,
  'polygon-amoy': 80002,
  'arbitrum-mainnet': 42161,
  'arbitrum-sepolia': 421614,
  'base-mainnet': 8453,
  'base-sepolia': 84532,
};

/**
 * Create Wagmi config from supported chains
 */
export function createWagmiConfig(supportedChains: ChainInfo[]) {
  // Filter EVM chains only
  const evmChains = supportedChains.filter(chain => chain.protocol === 'evm');

  console.log('[Wagmi] Creating config with chains:', {
    supportedChains,
    evmChains,
  });

  // Map to Wagmi chain objects
  const chains = evmChains
    .map(chain => CHAIN_MAP[chain.chainId])
    .filter(Boolean);

  console.log('[Wagmi] Mapped chains:', chains.map(c => ({ id: c.id, name: c.name })));

  // Fallback to Sepolia if no chains configured
  if (chains.length === 0) {
    console.warn('[Wagmi] No chains configured, falling back to Sepolia');
    chains.push(sepolia);
  }

  // Create Wagmi config with RainbowKit defaults
  const config = getDefaultConfig({
    appName: 'PayIn Crypto Payment',
    projectId: 'a0e74b5de01a3794cefa5ff64e8bcfef',
    chains: chains as any,
    ssr: false,
  });

  return config;
}

/**
 * Get Wagmi chain object by chain ID
 */
export function getChainByChainId(chainId: string) {
  return CHAIN_MAP[chainId] || null;
}

/**
 * Get numeric chain ID from PayIn chain identifier
 * Works for both EVM and non-EVM chains (e.g., Tron)
 */
export function getNumericChainId(chainId: string): number | null {
  return NUMERIC_CHAIN_ID_MAP[chainId] || null;
}
