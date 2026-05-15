/**
 * Chains API Routes
 * Provides chain configuration information from Manager
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';

const apiChains = new Hono();

/**
 * Get all enabled chains
 * GET /api/chains
 * Query params: protocol (optional)
 */
apiChains.get('/', async (c) => {
  try {
    const manager = getManager();
    const protocol = c.req.query('protocol') as 'evm' | 'tron' | undefined;

    const chainConfigs = await manager.getChainConfigs();

    // Convert to array and filter
    const chains = Object.entries(chainConfigs)
      .map(([chainId, config]: [string, any]) => ({
        chainId: config.chain_id || chainId,
        protocol: config.protocol,
        network: config.network,
        name: config.name,
        displayOrder: config.display_order || 0,
        metadata: config.metadata || {}
      }))
      .filter((chain: any) => {
        // Filter by protocol if specified
        if (protocol && chain.protocol !== protocol) {
          return false;
        }
        return true;
      })
      .sort((a: any, b: any) => {
        // Sort by display_order, then by name
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return a.name.localeCompare(b.name);
      });

    return c.json({
      success: true,
      chains
    });
  } catch (error) {
    console.error('Failed to fetch chains:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get specific chain details
 * GET /api/chains/:chainId
 */
apiChains.get('/:chainId', async (c) => {
  try {
    const manager = getManager();
    const chainId = c.req.param('chainId');

    const config = await manager.getChainConfig(chainId);

    if (!config) {
      return c.json({
        success: false,
        error: 'Chain not found'
      }, 404);
    }

    return c.json({
      success: true,
      chain: {
        chainId: config.chain_id || chainId,
        protocol: config.protocol,
        network: config.network,
        name: config.name,
        displayOrder: config.display_order || 0,
        metadata: config.metadata || {}
      }
    });
  } catch (error) {
    console.error(`Failed to fetch chain ${c.req.param('chainId')}:`, error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default apiChains;
