/**
 * Get default configuration from Processor
 *
 * This function loads default configurations from Processor's default.yaml and Monitor's defaults
 * Returns them in a format suitable for Manager to store in database
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import { getDefaults as getMonitorDefaults } from '@payin/monitor';
import type { MonitorDefaults, RPCProviderDefault, RPCChainConfigDefault } from '@payin/monitor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChainDefault {
  chain_id: string;
  protocol: string;
  name: string;
  network: 'mainnet' | 'testnet';
  is_builtin: boolean;
  is_enabled: boolean;
}

export interface TokenDefault {
  symbol: string;
  name: string;
  decimals: number;
  is_builtin: boolean;
  is_active: boolean;
}

export interface TokenChainDefault {
  symbol: string;
  chain_id: string;
  contract_address: string;
  confirmations: number;
  is_active: boolean;
}

export interface OperationalConfigDefault {
  category: string;
  config_data: Record<string, any>;
}

export interface ProcessorDefaults {
  chains: ChainDefault[];
  tokens: TokenDefault[];
  tokenChains: TokenChainDefault[];
  rpcProviders: RPCProviderDefault[];
  rpcChainConfigs: RPCChainConfigDefault[];
  operationalConfigs: OperationalConfigDefault[];
}

/**
 * Get Processor's default configuration
 *
 * Reads from default.yaml and Monitor's defaults
 * Returns defaults that can be stored in Manager's database
 *
 * @param configPath - Optional path to config file (defaults to default.yaml)
 */
export async function getDefaults(configPath?: string): Promise<ProcessorDefaults> {
  // Load Processor's default.yaml
  const yamlPath = configPath || path.join(__dirname, '../config/default.yaml');
  const configContent = await fs.readFile(yamlPath, 'utf-8');
  const config = yaml.parse(configContent);

  const chains: ChainDefault[] = [];
  const tokens: TokenDefault[] = [];
  const tokenChains: TokenChainDefault[] = [];
  const operationalConfigs: OperationalConfigDefault[] = [];

  // Extract chains
  const chainsConfig = config.chains || {};
  for (const [chainId, chainInfo] of Object.entries(chainsConfig)) {
    const info = chainInfo as any;
    chains.push({
      chain_id: chainId,
      protocol: info.protocol,
      name: info.name,
      network: info.network,
      is_builtin: true,
      is_enabled: true,
    });
  }

  // Extract tokens
  const tokensConfig = config.tokens || {};
  for (const [symbol, tokenInfo] of Object.entries(tokensConfig)) {
    const info = tokenInfo as any;
    tokens.push({
      symbol,
      name: info.name,
      decimals: info.decimals,
      is_builtin: true,
      is_active: true,
    });

    // Extract token-chain mappings
    const contracts = info.contracts || {};
    for (const [chainId, contractAddress] of Object.entries(contracts)) {
      // Get confirmations from chain config (YAML), fallback to 3
      const chainConfig = chainsConfig[chainId] as any;
      const confirmations = chainConfig?.confirmations || 3;

      tokenChains.push({
        symbol,
        chain_id: chainId,
        contract_address: contractAddress as string,
        confirmations,
        is_active: true,
      });
    }
  }

  // Extract operational configs
  if (config.orders) {
    operationalConfigs.push({
      category: 'orders',
      config_data: config.orders,
    });
  }

  if (config.deposits) {
    operationalConfigs.push({
      category: 'deposits',
      config_data: config.deposits,
    });
  }

  if (config.delayedConfirmation) {
    operationalConfigs.push({
      category: 'delayedConfirmation',
      config_data: config.delayedConfirmation,
    });
  }

  if (config.services) {
    operationalConfigs.push({
      category: 'services',
      config_data: config.services,
    });
  }

  // Get Monitor defaults (RPC providers and configs)
  const monitorDefaults: MonitorDefaults = await getMonitorDefaults();

  return {
    chains,
    tokens,
    tokenChains,
    rpcProviders: monitorDefaults.rpcProviders,
    rpcChainConfigs: monitorDefaults.rpcChainConfigs,
    operationalConfigs,
  };
}
