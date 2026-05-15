import type { PostgreSQLDatabase } from '../database/database.js';

export interface ChainBlocksDbObject {
  chain: string;
  latest_processed_block: number;
  created_at: Date;
  updated_at: Date;
}

export class ChainBlocksRepository {
  constructor(private db: PostgreSQLDatabase) {}

  private mapRowToChainBlocks(row: any): ChainBlocksDbObject | null {
    if (!row) return null;
    return {
      ...row,
      latest_processed_block: Number(row.latest_processed_block),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  async getAllChainBlocks(): Promise<ChainBlocksDbObject[]> {
    try {
      const rows = await this.db.query(`SELECT * FROM chain_blocks ORDER BY chain`);
      return rows.map(row => this.mapRowToChainBlocks(row)!).filter(Boolean);
    } catch (error: any) {
      // If table doesn't exist, return empty array (no recovery needed)
      if (error.message?.includes('relation "chain_blocks" does not exist')) {
        return [];
      }
      throw error;
    }
  }

  async updateChainBlock(chain: string, blockNumber: number): Promise<void> {
    await this.db.query(`
      INSERT INTO chain_blocks (
        chain, latest_block_number, latest_processed_block,
        sync_status, is_healthy, last_update_time, behind_blocks,
        created_at, updated_at
      )
      VALUES ($1, $2, $2, 'synced', true, NOW(), 0, NOW(), NOW())
      ON CONFLICT (chain)
      DO UPDATE SET
        latest_block_number = $2,
        latest_processed_block = $2,
        sync_status = 'synced',
        is_healthy = true,
        last_update_time = NOW(),
        behind_blocks = 0,
        updated_at = NOW()
    `, [chain, blockNumber]);
  }

  async getChainBlock(chain: string): Promise<ChainBlocksDbObject | null> {
    const rows = await this.db.query(`SELECT * FROM chain_blocks WHERE chain = $1`, [chain]);
    return this.mapRowToChainBlocks(rows[0]);
  }
}