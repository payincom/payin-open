import type { ProcessorConfig } from '../processor.js';
import type { Chain, ChainRange } from '@payin/monitor';
import { getSupportedTokensRegistry } from '../config/token-config.js';
import type { TokenConfig } from '../config/token-config.js';
import type { PostgreSQLDatabase } from '../database/database.js';
import { ChainBlocksRepository } from '../repositories/chain-blocks.repository.js';

export function mergeTokenConfigs(customTokens?: { [tokenSymbol: string]: TokenConfig }): Record<string, TokenConfig> {
  const SUPPORTED_TOKENS = getSupportedTokensRegistry();
  return { ...SUPPORTED_TOKENS, ...customTokens };
}

export async function buildChainRangesFromDatabase(
  database: PostgreSQLDatabase,
  logger: any,
  configChainSettings?: any,
  configuredChains?: string[] // New parameter
): Promise<Record<Chain, ChainRange> | undefined> {
  try {
    const chainBlocksRepository = new ChainBlocksRepository(database);
    const chainBlocks = await chainBlocksRepository.getAllChainBlocks();

    const chainRanges: Record<string, ChainRange> = {};
    const RECOVERY_SAFETY_BLOCKS = 10;

    // Initialize chainRanges with a default startBlock for all configured chains
    // This ensures every configured chain has an entry, even if not in DB
    for (const chain of configuredChains) {
      chainRanges[chain] = {
        startBlock: 1 // Default to block 1 if no entry in DB
      };
    }

    for (const block of chainBlocks) {
      const lastProcessed = Number(block.latest_processed_block);
      const safeStartBlock = Math.max(1, lastProcessed - RECOVERY_SAFETY_BLOCKS);

      // Override with actual data from DB
      chainRanges[block.chain as Chain] = {
        startBlock: safeStartBlock
      };

      logger.info(`Recovery: Chain ${block.chain} will start from block ${safeStartBlock}`);
    }

    // If after processing, no chains have a startBlock other than the default 1,
    // it means no actual recovery data was found. In this case, return undefined
    // to indicate normal mode.
    const hasActualRecoveryData = Object.values(chainRanges).some(range => range.startBlock !== 1);
    if (!hasActualRecoveryData && chainBlocks.length === 0) {
      return undefined;
    }

    return chainRanges as Record<Chain, ChainRange>;
  } catch (error) {
    logger.error('Failed to build chain ranges from database:', error);
    return undefined;
  }
}
