/**
 * Validator for RPC Provider configurations
 */

import type { RPCProviderConfig, ValidationError, OperationContext } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class RPCProviderValidator extends BaseValidator<RPCProviderConfig> {
  constructor(db: any) {
    super(db, 'rpc_provider');
  }

  /**
   * Custom validation for create: ensure builtin constraints
   */
  protected async validateCreateCustom(
    data: Partial<RPCProviderConfig>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    if (data.is_builtin) {
      // Builtin providers: supported_chains and default_settings must be NULL
      if (data.supported_chains !== null && data.supported_chains !== undefined) {
        errors.push({
          field: 'supported_chains',
          layer: 1,
          type: 'invalid_value',
          message: 'Builtin provider: supported_chains must be NULL (uses Monitor template)',
          attempted: data.supported_chains,
          solution: 'Set supported_chains to NULL for builtin providers',
        });
      }

      if (data.default_settings !== null && data.default_settings !== undefined) {
        errors.push({
          field: 'default_settings',
          layer: 1,
          type: 'invalid_value',
          message: 'Builtin provider: default_settings must be NULL (uses Monitor template)',
          attempted: data.default_settings,
          solution: 'Set default_settings to NULL for builtin providers',
        });
      }
    } else {
      // Custom providers: supported_chains and default_settings required
      if (!data.supported_chains || data.supported_chains.length === 0) {
        errors.push({
          field: 'supported_chains',
          layer: 1,
          type: 'missing_required',
          message: 'Custom provider: supported_chains is required',
          solution: 'Provide array of supported chain IDs',
        });
      }

      if (!data.default_settings) {
        errors.push({
          field: 'default_settings',
          layer: 1,
          type: 'missing_required',
          message: 'Custom provider: default_settings is required',
          solution: 'Provide default settings object',
        });
      }
    }

    return errors;
  }

  /**
   * Check if provider has references in rpc_chain_configs
   */
  protected async checkReferences(data: RPCProviderConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM processor_rpc_chain_configs WHERE provider_name = $1',
      [data.provider_name],
    );

    if (parseInt(result.rows[0].count) > 0) {
      errors.push({
        field: 'provider_name',
        layer: 0,
        type: 'has_references',
        message: `Cannot delete provider '${data.provider_name}': has ${result.rows[0].count} chain configurations`,
        solution: 'Delete all RPC chain configurations first, or set is_active=false to disable',
      });
    }

    return errors;
  }
}
