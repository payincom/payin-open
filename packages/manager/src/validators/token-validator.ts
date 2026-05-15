/**
 * Validator for Token configurations
 */

import type { TokenConfig, ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class TokenValidator extends BaseValidator<TokenConfig> {
  constructor(db: any) {
    super(db, 'token');
  }

  /**
   * Check if token has references in other tables
   */
  protected async checkReferences(data: TokenConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check token_chains references
    const tokenChainResult = await this.db.query(
      'SELECT COUNT(*) as count FROM processor_token_chains WHERE token_id = $1',
      [data.symbol],
    );

    if (parseInt(tokenChainResult.rows[0].count) > 0) {
      errors.push({
        field: 'symbol',
        layer: 0,
        type: 'has_references',
        message: `Cannot delete token '${data.symbol}': has ${tokenChainResult.rows[0].count} chain mappings`,
        solution: 'Delete all token-chain mappings first, or set is_active=false to disable',
      });
    }

    return errors;
  }
}
