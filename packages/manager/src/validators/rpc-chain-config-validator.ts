/**
 * Validator for RPC Chain Configuration
 */

import type { RPCChainConfig, ValidationError, OperationContext } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class RPCChainConfigValidator extends BaseValidator<RPCChainConfig> {
  constructor(db: any) {
    super(db, 'rpc_chain_config');
  }

  /**
   * Custom validation for create: ensure chain and provider exist
   */
  protected async validateCreateCustom(
    data: Partial<RPCChainConfig>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

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
          solution: 'Create the chain first before creating RPC configuration',
        });
      }
    }

    // Validate provider exists
    if (data.provider_name) {
      const providerResult = await this.db.query(
        'SELECT provider_name FROM processor_rpc_providers WHERE provider_name = $1',
        [data.provider_name],
      );

      if (providerResult.rows.length === 0) {
        errors.push({
          field: 'provider_name',
          layer: 1,
          type: 'invalid_value',
          message: `Provider '${data.provider_name}' does not exist`,
          solution: 'Create the provider first before creating RPC configuration',
        });
      }
    }

    return errors;
  }

  /**
   * RPC Chain Config has no child references (leaf entity)
   */
  protected async checkReferences(_data: RPCChainConfig): Promise<ValidationError[]> {
    return [];
  }
}
