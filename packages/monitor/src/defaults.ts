/**
 * Get default RPC configuration from Monitor
 *
 * This function loads the default RPC provider configurations from Monitor's default.yaml
 * and returns them in a format suitable for Manager to store in database
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RPCProviderDefault {
  provider_name: string;
  display_name: string;
  provider_type: 'commercial' | 'community' | 'private';
  api_key_required: boolean;
  homepage_url?: string;
  is_builtin: boolean;
  is_active: boolean;
}

export interface RPCChainConfigDefault {
  chain_id: string;
  provider_name: string;
  priority: number;
  timeout_ms?: number;
  max_requests_per_second?: number;
  is_enabled: boolean;
}

export interface MonitorDefaults {
  rpcProviders: RPCProviderDefault[];
  rpcChainConfigs: RPCChainConfigDefault[];
}

/**
 * Get Monitor's default RPC configuration
 *
 * Reads from default.yaml and extracts RPC provider information
 * Returns defaults that can be stored in Manager's database
 */
export async function getDefaults(): Promise<MonitorDefaults> {
  // Load default.yaml
  const configPath = path.join(__dirname, '../config/default.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config = yaml.parse(configContent);

  const rpcProviders: RPCProviderDefault[] = [];
  const rpcChainConfigs: RPCChainConfigDefault[] = [];

  // Extract RPC provider information from chains configuration
  const chains = config.rpc?.chains || {};
  const providerSet = new Set<string>();

  for (const [chainId, chainConfig] of Object.entries(chains)) {
    const providers = (chainConfig as any).preferredProviders || [];

    providers.forEach((providerName: string, index: number) => {
      providerSet.add(providerName);

      // Create RPC chain config
      rpcChainConfigs.push({
        chain_id: chainId,
        provider_name: providerName,
        priority: index + 1, // Priority based on order in preferredProviders
        timeout_ms: (chainConfig as any).timeout || config.rpc?.defaults?.timeout || 5000,
        max_requests_per_second: 10, // Default
        is_enabled: true,
      });
    });
  }

  // Create RPC provider entries
  // Note: We define known providers here, could also be loaded from a separate config
  const knownProviders: Record<string, Partial<RPCProviderDefault>> = {
    alchemy: {
      display_name: 'Alchemy',
      provider_type: 'commercial',
      api_key_required: true,
      homepage_url: 'https://www.alchemy.com',
    },
    infura: {
      display_name: 'Infura',
      provider_type: 'commercial',
      api_key_required: true,
      homepage_url: 'https://infura.io',
    },
    ankr: {
      display_name: 'Ankr',
      provider_type: 'commercial',
      api_key_required: true,
      homepage_url: 'https://www.ankr.com',
    },
    publicnode: {
      display_name: 'PublicNode',
      provider_type: 'community',
      api_key_required: false,
      homepage_url: 'https://www.publicnode.com',
    },
    trongrid: {
      display_name: 'TronGrid',
      provider_type: 'commercial',
      api_key_required: true,
      homepage_url: 'https://www.trongrid.io',
    },
  };

  for (const providerName of providerSet) {
    const knownInfo = knownProviders[providerName] || {};

    const provider: RPCProviderDefault = {
      provider_name: providerName,
      display_name: knownInfo.display_name || providerName,
      provider_type: knownInfo.provider_type || 'community',
      api_key_required: knownInfo.api_key_required || false,
      is_builtin: true,
      is_active: true,
    };

    if (knownInfo.homepage_url) {
      provider.homepage_url = knownInfo.homepage_url;
    }

    rpcProviders.push(provider);
  }

  return {
    rpcProviders,
    rpcChainConfigs,
  };
}
