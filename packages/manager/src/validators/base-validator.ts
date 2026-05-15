/**
 * Base validator for configuration entities
 * Implements three-layer validation system
 */

import type { Pool } from 'pg';
import type {
  ValidationError,
  ValidationResult,
  OperationContext,
  LayerDefinition,
  ValidationRule,
} from '../types.js';
import { ENTITY_LAYERS, LAYER2_RULES } from '../entity-layers.js';

export abstract class BaseValidator<T extends Record<string, any>> {
  protected readonly entityType: string;
  protected readonly layers: LayerDefinition;
  protected readonly layer2Rules: ValidationRule[];

  constructor(
    protected readonly db: Pool,
    entityType: string,
  ) {
    this.entityType = entityType;

    const layerDef = ENTITY_LAYERS[entityType];
    if (!layerDef) {
      throw new Error(`No layer definition found for entity type: ${entityType}`);
    }

    this.layers = layerDef;
    this.layer2Rules = LAYER2_RULES[entityType] || [];
  }

  /**
   * Validate create operation
   */
  async validateCreate(data: Partial<T>, context?: OperationContext): Promise<ValidationResult> {
    if (context?.bypassValidation) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = [];

    // Check required fields (Layer 1 immutable fields are required)
    for (const field of this.layers.layer1_immutable) {
      if (data[field] === undefined || data[field] === null) {
        errors.push({
          field,
          layer: 1,
          type: 'missing_required',
          message: `Required field '${field}' is missing`,
          solution: `Provide value for '${field}'`,
        });
      }
    }

    // Validate Layer 2 bounded fields
    const layer2Errors = this.validateLayer2Fields(data);
    errors.push(...layer2Errors.errors);

    // Custom validation hook
    const customErrors = await this.validateCreateCustom(data, context);
    errors.push(...customErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings: layer2Errors.warnings,
    };
  }

  /**
   * Validate update operation
   */
  async validateUpdate(
    currentData: T,
    updates: Partial<T>,
    context?: OperationContext,
  ): Promise<ValidationResult> {
    if (context?.bypassValidation) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = [];

    // Layer 0: Check builtin protection
    if (this.layers.protected_if_builtin && currentData['is_builtin']) {
      // Builtin resources: only Layer 3 fields can be modified
      for (const field of Object.keys(updates)) {
        if (!this.layers.layer3_free.includes(field)) {
          errors.push({
            field,
            layer: 0,
            type: 'protected',
            message: `Builtin resource: cannot modify '${field}'`,
            current: currentData[field],
            attempted: updates[field],
            solution: 'Only Layer 3 fields (display & preferences) can be modified for builtin resources',
          });
        }
      }
    } else {
      // Non-builtin resources: Layer 1 cannot be modified, Layer 2 bounded
      // Layer 1: Check immutable fields
      for (const field of this.layers.layer1_immutable) {
        if (field in updates && updates[field] !== currentData[field]) {
          errors.push({
            field,
            layer: 1,
            type: 'immutable',
            message: `Field '${field}' is immutable after creation`,
            current: currentData[field],
            attempted: updates[field],
            solution: 'Delete and recreate with new value if change is necessary',
          });
        }
      }
    }

    // Layer 2: Validate bounded fields
    const layer2Errors = this.validateLayer2Fields(updates);
    errors.push(...layer2Errors.errors);

    // Custom validation hook
    const customErrors = await this.validateUpdateCustom(currentData, updates, context);
    errors.push(...customErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings: layer2Errors.warnings,
    };
  }

  /**
   * Validate delete operation
   */
  async validateDelete(data: T, context?: OperationContext): Promise<ValidationResult> {
    if (context?.bypassValidation) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = [];

    // Layer 0: Check builtin protection
    if (this.layers.protected_if_builtin && data['is_builtin']) {
      errors.push({
        field: 'is_builtin',
        layer: 0,
        type: 'protected',
        message: 'Cannot delete builtin resource',
        current: true,
        solution: 'Set is_active/is_enabled to false to disable instead of deleting',
      });
    }

    // Check for references in other tables
    const referenceErrors = await this.checkReferences(data);
    errors.push(...referenceErrors);

    // Custom validation hook
    const customErrors = await this.validateDeleteCustom(data, context);
    errors.push(...customErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Layer 2 bounded fields
   */
  private validateLayer2Fields(data: Partial<T>): { errors: ValidationError[]; warnings: ValidationError[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const rule of this.layer2Rules) {
      const value = data[rule.field];
      if (value === undefined || value === null) continue;

      // Check custom validator if provided
      if (rule.validator && !rule.validator(value)) {
        errors.push({
          field: rule.field,
          layer: 2,
          type: 'invalid_value',
          message: rule.message || `Invalid value for '${rule.field}'`,
          attempted: value,
        });
        continue;
      }

      // Check pattern if provided
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push({
          field: rule.field,
          layer: 2,
          type: 'invalid_value',
          message: rule.message || `Value for '${rule.field}' does not match required pattern`,
          attempted: value,
        });
        continue;
      }

      // Check numeric range
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({
            field: rule.field,
            layer: 2,
            type: 'out_of_range',
            message: rule.message || `Value for '${rule.field}' is below minimum ${rule.min}`,
            attempted: value,
            recommended: rule.recommended,
          });
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push({
            field: rule.field,
            layer: 2,
            type: 'out_of_range',
            message: rule.message || `Value for '${rule.field}' exceeds maximum ${rule.max}`,
            attempted: value,
            recommended: rule.recommended,
          });
        }

        // Check recommended range (warning only)
        if (rule.recommended) {
          if (value < rule.recommended.min || value > rule.recommended.max) {
            warnings.push({
              field: rule.field,
              layer: 2,
              type: 'out_of_range',
              message: `Value for '${rule.field}' is outside recommended range [${rule.recommended.min}, ${rule.recommended.max}]`,
              attempted: value,
              recommended: rule.recommended,
            });
          }
        }
      }
    }

    return { errors, warnings };
  }

  // Abstract methods for subclasses to implement

  /**
   * Custom validation for create operation
   * Subclasses can override to add entity-specific validation
   */
  protected async validateCreateCustom(
    _data: Partial<T>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    return [];
  }

  /**
   * Custom validation for update operation
   * Subclasses can override to add entity-specific validation
   */
  protected async validateUpdateCustom(
    _currentData: T,
    _updates: Partial<T>,
    _context?: OperationContext,
  ): Promise<ValidationError[]> {
    return [];
  }

  /**
   * Custom validation for delete operation
   * Subclasses can override to add entity-specific validation
   */
  protected async validateDeleteCustom(_data: T, _context?: OperationContext): Promise<ValidationError[]> {
    return [];
  }

  /**
   * Check if entity has references in other tables
   * Subclasses must implement this based on foreign key relationships
   */
  protected abstract checkReferences(data: T): Promise<ValidationError[]>;
}
