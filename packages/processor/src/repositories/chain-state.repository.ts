import type { PostgreSQLDatabase } from '../database/database.js';

export interface ChainStateDbObject {
  chain: string;
  order_id: string | null;
  deposit_reference: string | null;
  business_type: 'order' | 'deposit' | null;
  address: string;
  last_processed_block: number;
  created_at: Date;
  updated_at: Date;
}

export class ChainStateRepository {
  constructor(private db: PostgreSQLDatabase) {}

  /**
   * Wait for database to be ready (important during recovery)
   */
  private async waitForDatabase(): Promise<void> {
    const maxRetries = 20;
    const retryDelay = 100; // 100ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.db.query('SELECT 1');
        return; // Database is ready
      } catch (error: any) {
        if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error('Database not ready after maximum retries');
  }

  private mapRowToChainState(row: any): ChainStateDbObject | null {
    if (!row) return null;
    return {
      ...row,
      business_type: row.business_type as 'order' | 'deposit' | null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  async findByAddress(address: string, chainId: string): Promise<ChainStateDbObject | null> {
    const result = await this.db.query(`
      SELECT * FROM address_pool
      WHERE LOWER(address) = $1 AND protocol = $2
      LIMIT 1
    `, [address.toLowerCase(), this.getProtocol(chainId)]);

    return this.mapRowToChainState(result[0]);
  }

  async findActiveOrder(address: string, chainId: string): Promise<any | null> {
    try {
      // Wait for database to be ready (important during recovery)
      await this.waitForDatabase();

      const result = await this.db.query(`
        SELECT * FROM orders
        WHERE LOWER(address) = $1
        AND chain = $2
        AND status NOT IN ('paid', 'completed', 'expired', 'failed', 'cancelled')
        ORDER BY created_at DESC
        LIMIT 1
      `, [address.toLowerCase(), chainId]);

      return result.length > 0 ? result[0] : null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping order lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  async findInsufficientPaidOrder(address: string, chainId: string): Promise<any | null> {
    try {
      await this.waitForDatabase();

      const result = await this.db.query(`
        SELECT * FROM orders
        WHERE LOWER(address) = $1
        AND chain = $2
        AND status = 'pending'
        AND CAST(confirmed_received AS DECIMAL) < CAST(amount AS DECIMAL)
        ORDER BY created_at DESC
        LIMIT 1
      `, [address.toLowerCase(), chainId]);

      return result.length > 0 ? result[0] : null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping insufficient paid order lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  async findDepositBinding(address: string, chainId: string): Promise<any | null> {
    try {
      await this.waitForDatabase();

      const protocol = this.getProtocol(chainId);

      const result = await this.db.query(`
        SELECT deposit_reference, address, protocol
        FROM address_pool
        WHERE LOWER(address) = $1
        AND protocol = $2
        AND deposit_reference IS NOT NULL
        LIMIT 1
      `, [address.toLowerCase(), protocol]);

      return result.length > 0 ? result[0] : null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping deposit binding lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  private getProtocol(chainId: string): string {
    if (chainId.startsWith('tron') || chainId.includes('tron')) {
      return 'tron';
    }

    if (chainId.includes('ethereum') ||
        chainId.includes('polygon') ||
        chainId.includes('bsc') ||
        chainId.includes('avalanche') ||
        chainId.includes('arbitrum') ||
        chainId.includes('optimism') ||
        chainId.includes('xlayer') ||
        chainId.includes('sepolia') ||
        chainId.includes('amoy') ||
        chainId.includes('goerli') ||
        chainId.includes('mainnet')) {
      return 'evm';
    }

    if (chainId.includes('bitcoin') || chainId.includes('btc')) {
      return 'bitcoin';
    }

    if (chainId.includes('solana') || chainId.includes('sol')) {
      return 'solana';
    }

    console.warn(`Unknown protocol family for chainId: ${chainId}, defaulting to 'evm'`);
    return 'evm';
  }
}