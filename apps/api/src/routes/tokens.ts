/**
 * Token Configuration Routes
 * Provides read-only access to token configurations from Processor
 * Public endpoints for payment pages
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';

const tokens = new Hono();

/**
 * List all available tokens
 * GET /api/tokens
 * Query params:
 *  - protocol: Filter by protocol (evm/tron/solana)
 *  - chainId: Filter by specific chain
 * Public endpoint - No authentication required
 */
tokens.get('/', async (c) => {
  try {
    const protocol = c.req.query('protocol') as 'evm' | 'tron' | 'solana' | undefined;
    const chainId = c.req.query('chainId');

    const manager = getManager();

    // Get token configurations from Manager (proxies to Processor)
    const tokensConfig = await manager.getTokenConfigs();

    // Get chain configs to filter by protocol
    let chainFilter: Set<string> | null = null;
    if (protocol) {
      const chainsConfig = await manager.getChainConfigs();
      chainFilter = new Set(
        Object.entries(chainsConfig)
          .filter(([_, config]) => config.protocol === protocol)
          .map(([id]) => id)
      );
    }

    // Build response
    const tokens = Object.entries(tokensConfig).map(([symbol, config]) => {
      // Filter contracts by chainId or protocol
      let contracts = config.contracts;

      if (chainId) {
        // Filter to specific chain
        contracts = config.contracts[chainId]
          ? { [chainId]: config.contracts[chainId] }
          : {};
      } else if (chainFilter) {
        // Filter by protocol
        contracts = Object.fromEntries(
          Object.entries(config.contracts).filter(([chain]) => chainFilter!.has(chain))
        );
      }

      return {
        symbol: config.symbol,
        name: config.name,
        decimals: config.decimals,
        chains: Object.entries(contracts).map(([chain, address]) => ({
          chainId: chain,
          contractAddress: address,
        })),
      };
    }).filter(token => token.chains.length > 0); // Only include tokens with at least one chain

    return c.json({
      success: true,
      tokens,
      total: tokens.length,
    });
  } catch (error) {
    console.error('Failed to list tokens:', error);
    return c.json({
      success: false,
      error: 'Failed to list tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get tokens available for a specific deposit address
 * GET /api/tokens/deposit/:address/available
 * Public endpoint - No authentication required
 * Address is globally unique identifier
 */
tokens.get('/deposit/:address/available', async (c) => {
  try {
    const address = c.req.param('address')!;
    const manager = getManager();

    // Fetch deposit by address (public endpoint)
    const depositAddress = await manager.getDepositByAddress(address);

    if (!depositAddress) {
      return c.json({
        success: false,
        error: 'Deposit address not found',
        message: `Address "${address}" is not found or not bound to any deposit`,
      }, 404);
    }

    // Verify address is bound to a deposit
    if (depositAddress.state !== 'bound' || !depositAddress.deposit_reference) {
      return c.json({
        success: false,
        error: 'Address not bound to deposit',
        message: `Address "${address}" is not bound to any deposit`,
      }, 404);
    }

    const protocol = depositAddress.protocol;

    // Get token configurations from Manager
    const tokensConfig = await manager.getTokenConfigs();

    // Get chain configs
    const chainsConfig = await manager.getChainConfigs();

    // Determine supported chains based on protocol
    const supportedChains = new Set<string>();
    Object.entries(chainsConfig)
      .filter(([_, config]) => config.protocol === protocol)
      .forEach(([chainId]) => supportedChains.add(chainId));

    // Build tokens list filtered by supported chains
    const tokens = Object.entries(tokensConfig).map(([symbol, config]) => {
      const availableChains = Object.entries(config.contracts)
        .filter(([chainId]) => supportedChains.has(chainId))
        .map(([chainId, address]) => ({
          chainId,
          contractAddress: address,
        }));

      return {
        symbol: config.symbol,
        name: config.name,
        decimals: config.decimals,
        chains: availableChains,
      };
    }).filter(token => token.chains.length > 0);

    return c.json({
      success: true,
      address: depositAddress.address,
      depositReference: depositAddress.deposit_reference,
      protocol,
      tokens,
      total: tokens.length,
    });
  } catch (error) {
    console.error(`Failed to get available tokens for ${c.req.param('address')!}:`, error);
    return c.json({
      success: false,
      error: 'Failed to get available tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default tokens;
