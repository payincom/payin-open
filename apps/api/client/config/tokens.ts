/**
 * Token Contract Addresses Configuration
 * Maps PayIn chain IDs to token contract addresses
 *
 * ⚠️ DEPRECATED: This file will be replaced by dynamic API in the future
 * For now, it matches packages/processor/config/default.yaml
 */

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

// Token contract addresses by PayIn chain ID
export const TOKEN_CONTRACTS: Record<string, Record<string, TokenConfig>> = {
  // Ethereum Sepolia Testnet
  // ✅ Matches processor config: only USDC is supported
  'ethereum-sepolia': {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },

  // Polygon Amoy Testnet
  // ✅ Matches processor config: only USDC is supported
  'polygon-amoy': {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    },
  },

  // Tron Nile Testnet
  // ✅ Matches processor config: only USDT is supported
  'tron-nile': {
    USDT: {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    },
  },

  // Production chains - commented out until configured in processor
  // 'ethereum-mainnet': {
  //   USDT: {
  //     symbol: 'USDT',
  //     name: 'Tether USD',
  //     decimals: 6,
  //     address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  //   },
  //   USDC: {
  //     symbol: 'USDC',
  //     name: 'USD Coin',
  //     decimals: 6,
  //     address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  //   },
  // },
};

/**
 * Get token contract address for a specific chain and token symbol
 */
export function getTokenContract(chainId: string, tokenSymbol: string): TokenConfig | null {
  const chainTokens = TOKEN_CONTRACTS[chainId];
  if (!chainTokens) {
    return null;
  }
  return chainTokens[tokenSymbol] || null;
}
