/**
 * Shared Utilities for Processor Package
 * Exports all shared utility functions and classes
 */

// Amount utilities
export {
  AmountUtils,
  DEFAULT_TOKEN_DECIMALS,
  type TokenDecimalConfig
} from './amount-utils.js';

// Chain utilities
export {
  ChainUtils,
  DEFAULT_CHAIN_CONFIRMATIONS,
  type ChainConfirmationConfig
} from './chain-utils.js';

// Validation utilities
export {
  ValidationUtils,
  type ValidationResult
} from './validation-utils.js';

// Error utilities
export {
  ProcessorError,
  ValidationError,
  DatabaseError,
  NetworkError,
  BlockchainError,
  BusinessLogicError,
  ServiceUnavailableError,
  ResourceNotFoundError,
  ErrorUtils,
  ErrorCategory,
  ErrorSeverity
} from './error-utils.js';