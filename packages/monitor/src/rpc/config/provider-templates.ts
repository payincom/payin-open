/**
 * RPC Provider Template Type Definitions
 * All providers must be configured through:
 * 1. Code initialization (rpcConfig.providers)
 * 2. YAML configuration files
 * 3. Database configuration (via Manager)
 */

export interface ProviderTemplate {
  name: string
  displayName: string

  // Core: Authentication configuration
  authType: 'none' | 'url_path' | 'header' | 'query_param'
  urlPattern: string
  headerTemplate?: Record<string, string>
  queryTemplate?: Record<string, string>

  // Network support
  supportedNetworks: string[]
  networkMappings?: Record<string, string>  // Resolve naming differences

  // Basic settings
  defaultSettings: {
    timeout: number
    weight: number
    maxRequestsPerSecond: number
  }
}

/**
 * Add name field to provider templates from configuration
 */
export function normalizeProviderTemplates(
  providers: Record<string, Omit<ProviderTemplate, 'name'>>
): Record<string, ProviderTemplate> {
  return Object.entries(providers).reduce((acc, [name, template]) => {
    acc[name] = { name, ...template }
    return acc
  }, {} as Record<string, ProviderTemplate>)
}

/**
 * Get providers that support a specific network
 *
 * @param providers - Provider templates map
 * @param network - Chain ID to check (e.g., 'tron-nile', 'ethereum-mainnet')
 * @returns Providers that support the given network
 *
 * Matching logic:
 * 1. Check if network is in provider's supportedNetworks array
 * 2. Check if network is a KEY in provider's networkMappings (chain ID → subdomain mapping)
 */
export function getProvidersForNetwork(
  providers: Record<string, ProviderTemplate>,
  network: string
): ProviderTemplate[] {
  return Object.values(providers).filter(provider =>
    provider.supportedNetworks.includes(network) ||
    Object.keys(provider.networkMappings || {}).includes(network)  // FIX: Check keys (chain IDs), not values (subdomains)
  )
}

/**
 * Check if a provider requires an API key
 */
export function requiresApiKey(provider: ProviderTemplate): boolean {
  return provider.authType !== 'none'
}

/**
 * Built-in provider templates
 * These match the providers defined in config/default.yaml
 */
export const BUILTIN_PROVIDERS: Record<string, ProviderTemplate> = normalizeProviderTemplates({
  alchemy: {
    displayName: 'Alchemy',
    authType: 'url_path',
    urlPattern: 'https://{network}.g.alchemy.com/v2/{apiKey}',
    supportedNetworks: ['eth-mainnet', 'eth-sepolia', 'polygon-mainnet', 'polygon-amoy', 'arbitrum-mainnet', 'arbitrum-sepolia'],
    networkMappings: {
      'ethereum-mainnet': 'eth-mainnet',
      'ethereum-sepolia': 'eth-sepolia',
      'arbitrum-mainnet': 'arb-mainnet',
      'arbitrum-sepolia': 'arb-sepolia'
    },
    defaultSettings: { timeout: 5000, weight: 100, maxRequestsPerSecond: 15 }
  },
  infura: {
    displayName: 'Infura',
    authType: 'url_path',
    urlPattern: 'https://{network}.infura.io/v3/{apiKey}',
    supportedNetworks: ['mainnet', 'sepolia', 'polygon-mainnet', 'polygon-amoy'],
    networkMappings: {
      'ethereum-mainnet': 'mainnet',
      'ethereum-sepolia': 'sepolia'
    },
    defaultSettings: { timeout: 5000, weight: 90, maxRequestsPerSecond: 10 }
  },
  ankr: {
    displayName: 'Ankr',
    authType: 'url_path',
    urlPattern: 'https://rpc.ankr.com/{network}/{apiKey}',
    supportedNetworks: ['eth', 'eth_sepolia', 'polygon', 'polygon_amoy'],
    networkMappings: {
      'ethereum-mainnet': 'eth',
      'ethereum-sepolia': 'eth_sepolia',
      'polygon-mainnet': 'polygon',
      'polygon-amoy': 'polygon_amoy'
    },
    defaultSettings: { timeout: 5000, weight: 85, maxRequestsPerSecond: 12 }
  },
  trongrid: {
    displayName: 'TronGrid',
    authType: 'header',
    urlPattern: 'https://{network}.trongrid.io/jsonrpc',
    headerTemplate: { 'TRON-PRO-API-KEY': '{apiKey}' },
    supportedNetworks: [],
    networkMappings: {
      'tron-mainnet': 'api',
      'tron-nile': 'nile'
    },
    defaultSettings: { timeout: 8000, weight: 80, maxRequestsPerSecond: 8 }
  },
  helius: {
    displayName: 'Helius',
    authType: 'query_param',
    urlPattern: 'https://{network}.helius-rpc.com/?api-key={apiKey}',
    queryTemplate: { 'api-key': '{apiKey}' },
    supportedNetworks: [],
    networkMappings: {
      'solana-mainnet': 'mainnet',
      'solana-devnet': 'devnet'
    },
    defaultSettings: { timeout: 5000, weight: 100, maxRequestsPerSecond: 15 }
  },
  tatum: {
    displayName: 'Tatum',
    authType: 'header',
    urlPattern: 'https://{network}.gateway.tatum.io/',
    headerTemplate: { 'x-api-key': '{apiKey}' },
    supportedNetworks: [],
    networkMappings: {
      'solana-mainnet': 'solana-mainnet',
      'solana-devnet': 'solana-devnet'
    },
    defaultSettings: { timeout: 8000, weight: 90, maxRequestsPerSecond: 12 }
  },
  quicknode: {
    displayName: 'QuickNode',
    authType: 'none',
    urlPattern: '{apiKey}',
    supportedNetworks: ['solana-mainnet', 'solana-devnet'],
    defaultSettings: { timeout: 6000, weight: 95, maxRequestsPerSecond: 12 }
  },
  publicnode: {
    displayName: 'PublicNode',
    authType: 'none',
    urlPattern: 'https://{network}-rpc.publicnode.com',
    supportedNetworks: ['ethereum', 'ethereum-sepolia', 'polygon', 'polygon-amoy', 'arbitrum', 'arbitrum-sepolia', 'bsc', 'bsc-testnet'],
    networkMappings: {
      'ethereum-mainnet': 'ethereum',
      'polygon-mainnet': 'polygon-bor',
      'arbitrum-mainnet': 'arbitrum',
      'arbitrum-sepolia': 'arbitrum-sepolia'
    },
    defaultSettings: { timeout: 8000, weight: 60, maxRequestsPerSecond: 3 }
  },
  cloudflare: {
    displayName: 'Cloudflare Web3',
    authType: 'none',
    urlPattern: 'https://cloudflare-eth.com',
    supportedNetworks: ['ethereum-mainnet'],
    defaultSettings: { timeout: 8000, weight: 50, maxRequestsPerSecond: 3 }
  },
  'solana-public': {
    displayName: 'Solana Public RPC',
    authType: 'none',
    urlPattern: 'https://api.{network}.solana.com',
    supportedNetworks: [],
    networkMappings: {
      'solana-mainnet': 'mainnet-beta',
      'solana-devnet': 'devnet'
    },
    defaultSettings: { timeout: 10000, weight: 60, maxRequestsPerSecond: 5 }
  },
  'xlayer-public': {
    displayName: 'X Layer Public RPC',
    authType: 'none',
    urlPattern: 'https://{network}',
    supportedNetworks: ['xlayer-mainnet', 'xlayer-testnet'],
    networkMappings: {
      'xlayer-mainnet': 'rpc.xlayer.tech',
      'xlayer-testnet': 'testrpc.xlayer.tech/terigon'
    },
    defaultSettings: { timeout: 10000, weight: 70, maxRequestsPerSecond: 5 }
  },
  'xlayer-okx': {
    displayName: 'X Layer OKX RPC',
    authType: 'none',
    urlPattern: 'https://{network}',
    supportedNetworks: ['xlayer-mainnet', 'xlayer-testnet'],
    networkMappings: {
      'xlayer-mainnet': 'xlayerrpc.okx.com',
      'xlayer-testnet': 'xlayertestrpc.okx.com/terigon'
    },
    defaultSettings: { timeout: 10000, weight: 60, maxRequestsPerSecond: 5 }
  }
})