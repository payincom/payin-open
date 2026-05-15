/**
 * Validator for Chain configurations
 */

import type { ChainConfig, ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class ChainValidator extends BaseValidator<ChainConfig> {
  constructor(db: any) {
    super(db, 'chain');
  }

  /**
   * Check if chain has references in other tables
   */
  protected async checkReferences(data: ChainConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check token_chains references
    const tokenChainResult = await this.db.query(
      'SELECT COUNT(*) as count FROM processor_token_chains WHERE chain_id = $1',
      [data.chain_id],
    );

    if (parseInt(tokenChainResult.rows[0].count) > 0) {
      errors.push({
        field: 'chain_id',
        layer: 0,
        type: 'has_references',
        message: `Cannot delete chain '${data.chain_id}': has ${tokenChainResult.rows[0].count} token mappings`,
        solution: 'Delete all token-chain mappings first, or set is_enabled=false to disable',
      });
    }

    // Check rpc_chain_configs references
    const rpcConfigResult = await this.db.query(
      'SELECT COUNT(*) as count FROM processor_rpc_chain_configs WHERE chain_id = $1',
      [data.chain_id],
    );

    if (parseInt(rpcConfigResult.rows[0].count) > 0) {
      errors.push({
        field: 'chain_id',
        layer: 0,
        type: 'has_references',
        message: `Cannot delete chain '${data.chain_id}': has ${rpcConfigResult.rows[0].count} RPC configurations`,
        solution: 'Delete all RPC chain configurations first, or set is_enabled=false to disable',
      });
    }

    return errors;
  }
}
