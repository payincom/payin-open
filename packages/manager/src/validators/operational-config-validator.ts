/**
 * Validator for Operational Configuration (processor_configs)
 */

import type { OperationalConfig, ValidationError, OperationContext } from '../types.js';
import { BaseValidator } from './base-validator.js';

export class OperationalConfigValidator extends BaseValidator<OperationalConfig> {
  constructor(db: any) {
    super(db, 'operational_config');
  }

  /**
   * Custom validation for operational config
   */
  protected async validateCreateCustom(
    data: Partial<OperationalConfig>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate category
    const validCategories = ['orders', 'deposits', 'delayedConfirmation', 'services'];
    if (data.category && !validCategories.includes(data.category)) {
      errors.push({
        field: 'category',
        layer: 1,
        type: 'invalid_value',
        message: `Invalid category '${data.category}'. Must be one of: ${validCategories.join(', ')}`,
        attempted: data.category,
      });
    }

    // Validate config_data structure based on category
    if (data.config_data && data.category) {
      const categoryErrors = this.validateCategoryData(data.category, data.config_data);
      errors.push(...categoryErrors);
    }

    return errors;
  }

  /**
   * Validate config_data structure for specific category
   */
  private validateCategoryData(category: string, configData: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (category) {
      case 'orders':
        this.validateOrdersConfig(configData, errors);
        break;
      case 'deposits':
        this.validateDepositsConfig(configData, errors);
        break;
      case 'delayedConfirmation':
        this.validateDelayedConfirmationConfig(configData, errors);
        break;
      case 'services':
        this.validateServicesConfig(configData, errors);
        break;
    }

    return errors;
  }

  private validateOrdersConfig(data: Record<string, any>, errors: ValidationError[]): void {
    // Validate required fields for orders config
    const requiredFields = ['maintenanceIntervalMs', 'maxTotalTimeoutMinutes'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push({
          field: `config_data.${field}`,
          layer: 2,
          type: 'missing_required',
          message: `Orders config: missing required field '${field}'`,
        });
      }
    }
  }

  private validateDepositsConfig(data: Record<string, any>, errors: ValidationError[]): void {
    // Validate lowPoolThreshold <= maxPoolSize
    if (data.maxPoolSize && data.lowPoolThreshold) {
      if (data.lowPoolThreshold > data.maxPoolSize) {
        errors.push({
          field: 'config_data.lowPoolThreshold',
          layer: 2,
          type: 'out_of_range',
          message: `lowPoolThreshold (${data.lowPoolThreshold}) cannot exceed maxPoolSize (${data.maxPoolSize})`,
          attempted: data.lowPoolThreshold,
        });
      }
    }
  }

  private validateDelayedConfirmationConfig(data: Record<string, any>, errors: ValidationError[]): void {
    // Validate required fields for delayedConfirmation config
    const requiredFields = ['maxRetries', 'checkInterval'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push({
          field: `config_data.${field}`,
          layer: 2,
          type: 'missing_required',
          message: `DelayedConfirmation config: missing required field '${field}'`,
        });
      }
    }
  }

  private validateServicesConfig(data: Record<string, any>, errors: ValidationError[]): void {
    // Services config can be flexible, just validate structure
    if (!data.orders && !data.deposits) {
      errors.push({
        field: 'config_data',
        layer: 3,
        type: 'invalid_value',
        message: 'Services config must include at least one of: orders, deposits',
      });
    }
  }

  /**
   * Operational config has no child references
   */
  protected async checkReferences(_data: OperationalConfig): Promise<ValidationError[]> {
    return [];
  }
}
