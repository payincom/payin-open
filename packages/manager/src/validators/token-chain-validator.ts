/**
 * Validator for TokenChain configurations
 */

import type { TokenChainConfig, ValidationError, OperationContext } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class TokenChainValidator extends BaseValidator<TokenChainConfig> {
  constructor(db: any) {
    super(db, 'token_chain');
  }

  /**
   * Custom validation for create: ensure token and chain exist
   */
  protected async validateCreateCustom(
    data: Partial<TokenChainConfig>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate token exists
    if (data.symbol || data.token_id) {
      const tokenId = data.symbol || data.token_id;
      const tokenResult = await this.db.query('SELECT symbol FROM processor_tokens WHERE symbol = $1', [
        tokenId,
      ]);

      if (tokenResult.rows.length === 0) {
        errors.push({
          field: 'token_id',
          layer: 1,
          type: 'invalid_value',
          message: `Token '${tokenId}' does not exist`,
          solution: 'Create the token first before creating token-chain mapping',
        });
      }
    }

    // Validate chain exists
    if (data.chain_id) {
      const chainResult = await this.db.query('SELECT chain_id FROM processor_chains WHERE chain_id = $1', [
        data.chain_id,
      ]);

      if (chainResult.rows.length === 0) {
        errors.push({
          field: 'chain_id',
          layer: 1,
          type: 'invalid_value',
          message: `Chain '${data.chain_id}' does not exist`,
          solution: 'Create the chain first before creating token-chain mapping',
        });
      }
    }

    // Validate contract address format
    if (data.contract_address) {
      // Basic format check (can be enhanced based on protocol)
      if (!/^0x[a-fA-F0-9]{40}$/.test(data.contract_address)) {
        errors.push({
          field: 'contract_address',
          layer: 1,
          type: 'invalid_value',
          message: `Invalid contract address format: ${data.contract_address}`,
          solution: 'Provide valid EVM address (0x followed by 40 hex characters)',
        });
      }
    }

    return errors;
  }

  /**
   * TokenChain has no child references (leaf entity)
   */
  protected async checkReferences(_data: TokenChainConfig): Promise<ValidationError[]> {
    return [];
  }
}
