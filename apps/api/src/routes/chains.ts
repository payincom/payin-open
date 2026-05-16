/**
 * Chain Configuration Routes
 * Provides read-only access to chain configurations from Processor
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getManager } from '../manager-instance.js';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware } from '@payin/auth';

const chains = new Hono();

// Lazy middleware factories
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};


/**
 * List all chain configurations
 * GET /chains
 */
chains.get('/', authMiddleware(), async (c) => {
  try {
    const manager = getManager();

    // Get chain configurations from Manager (proxies to Processor)
    const chainsConfig = await manager.getChainConfigs();

    // Get chain sync status from Manager (proxies to Processor)
    const chainSyncStatuses = await manager.getAllChainsSyncStatus();
    const syncStatusMap = new Map(
      chainSyncStatuses.map(status => [status.chain, status])
    );

    // Convert to array format and merge with sync status
    const chains = Object.entries(chainsConfig).map(([chainId, config]) => {
      const syncStatus = syncStatusMap.get(chainId);
      return {
        chainId,
        ...config,
        syncStatus: syncStatus ? {
          latestProcessedBlock: syncStatus.latest_processed_block,
          syncStatus: syncStatus.sync_status || 'unknown',
          isHealthy: syncStatus.is_healthy ?? true,
          behindBlocks: syncStatus.behind_blocks || 0,
          updatedAt: syncStatus.updated_at
        } : null
      };
    });

    return c.json({
      success: true,
      data: chains,
      total: chains.length
    });
  } catch (error) {
    console.error('Failed to list chains:', error);
    return c.json({
      success: false,
      error: 'Failed to list chains',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get specific chain configuration
 * GET /chains/:chainId
 */
chains.get('/:chainId', authMiddleware(), async (c) => {
  try {
    const manager = getManager();
    const chainId = c.req.param('chainId')!;

    // Get chain configuration from Manager (proxies to Processor)
    const chainConfig = await manager.getChainConfig(chainId);

    if (!chainConfig) {
      return c.json({
        success: false,
        error: 'Chain not found',
        message: `Chain "${chainId}" not found in configuration`
      }, 404);
    }

    // Get chain sync status from Manager (proxies to Processor)
    const syncStatus = await manager.getChainSyncStatus(chainId);

    return c.json({
      success: true,
      data: {
        chainId,
        ...chainConfig,
        syncStatus: syncStatus ? {
          latestProcessedBlock: syncStatus.latest_processed_block,
          syncStatus: syncStatus.sync_status || 'unknown',
          isHealthy: syncStatus.is_healthy ?? true,
          behindBlocks: syncStatus.behind_blocks || 0,
          updatedAt: syncStatus.updated_at
        } : null
      }
    });
  } catch (error) {
    console.error(`Failed to get chain ${c.req.param('chainId')!}:`, error);
    return c.json({
      success: false,
      error: 'Failed to get chain configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default chains;
