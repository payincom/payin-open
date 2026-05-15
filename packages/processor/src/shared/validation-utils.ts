/**
 * Validation Utility Functions
 * Provides consistent validation logic across the system
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation utilities for common validation patterns
 */
export class ValidationUtils {
  /**
   * Validate if a string is not empty or null
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns Validation result
   */
  static validateRequired(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (value === null || value === undefined) {
      errors.push(`${fieldName} is required`);
    } else if (typeof value === 'string' && value.trim() === '') {
      errors.push(`${fieldName} cannot be empty`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Ethereum address format
   * @param address - Address to validate
   * @returns Validation result
   */
  static validateEthereumAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address || typeof address !== 'string') {
      errors.push('Address is required and must be a string');
    } else {
      const cleanAddress = address.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
        errors.push('Invalid Ethereum address format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Tron address format
   * @param address - Address to validate
   * @returns Validation result
   */
  static validateTronAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address || typeof address !== 'string') {
      errors.push('Address is required and must be a string');
    } else {
      const cleanAddress = address.trim();
      if (!/^T[A-Za-z0-9]{33}$/.test(cleanAddress)) {
        errors.push('Invalid Tron address format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Solana address format (base58, 32-44 characters)
   * @param address - Address to validate
   * @returns Validation result
   */
  static validateSolanaAddress(address: string): ValidationResult {
    const errors: string[] = [];

    if (!address || typeof address !== 'string') {
      errors.push('Address is required and must be a string');
    } else {
      const cleanAddress = address.trim();
      // Solana addresses are base58-encoded public keys, typically 32-44 characters
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress)) {
        errors.push('Invalid Solana address format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate address based on chain family
   * @param address - Address to validate
   * @param protocol - Chain family ('evm', 'tron', or 'solana')
   * @returns Validation result
   */
  static validateAddressByChain(address: string, protocol: 'evm' | 'tron' | 'solana'): ValidationResult {
    switch (protocol) {
      case 'evm':
        return this.validateEthereumAddress(address);
      case 'tron':
        return this.validateTronAddress(address);
      case 'solana':
        return this.validateSolanaAddress(address);
      default:
        return {
          isValid: false,
          errors: [`Unsupported chain family: ${protocol}`]
        };
    }
  }

  /**
   * Validate transaction hash format
   * @param txHash - Transaction hash to validate
   * @param protocol - Chain family for format validation
   * @returns Validation result
   */
  static validateTransactionHash(txHash: string, protocol?: 'evm' | 'tron'): ValidationResult {
    const errors: string[] = [];

    if (!txHash || typeof txHash !== 'string') {
      errors.push('Transaction hash is required and must be a string');
    } else {
      const cleanHash = txHash.trim();

      if (protocol === 'evm') {
        if (!/^0x[a-fA-F0-9]{64}$/.test(cleanHash)) {
          errors.push('Invalid EVM transaction hash format');
        }
      } else if (protocol === 'tron') {
        if (!/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
          errors.push('Invalid Tron transaction hash format');
        }
      } else {
        // Generic hex validation
        if (!/^(0x)?[a-fA-F0-9]{64}$/.test(cleanHash)) {
          errors.push('Invalid transaction hash format');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate UUID format
   * @param uuid - UUID to validate
   * @returns Validation result
   */
  static validateUUID(uuid: string): ValidationResult {
    const errors: string[] = [];

    if (!uuid || typeof uuid !== 'string') {
      errors.push('UUID is required and must be a string');
    } else {
      const cleanUuid = uuid.trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanUuid)) {
        errors.push('Invalid UUID format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate amount string
   * @param amount - Amount to validate
   * @param minValue - Minimum allowed value (optional)
   * @param maxValue - Maximum allowed value (optional)
   * @returns Validation result
   */
  static validateAmount(amount: string, minValue?: number, maxValue?: number): ValidationResult {
    const errors: string[] = [];

    if (!amount || typeof amount !== 'string') {
      errors.push('Amount is required and must be a string');
    } else {
      const parsed = parseFloat(amount);

      if (isNaN(parsed)) {
        errors.push('Amount must be a valid number');
      } else {
        if (parsed < 0) {
          errors.push('Amount cannot be negative');
        }

        if (minValue !== undefined && parsed < minValue) {
          errors.push(`Amount must be at least ${minValue}`);
        }

        if (maxValue !== undefined && parsed > maxValue) {
          errors.push(`Amount cannot exceed ${maxValue}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   * @param email - Email to validate
   * @returns Validation result
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email is required and must be a string');
    } else {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errors.push('Invalid email format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate URL format
   * @param url - URL to validate
   * @returns Validation result
   */
  static validateURL(url: string): ValidationResult {
    const errors: string[] = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required and must be a string');
    } else {
      try {
        new URL(url);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate HTTP(S) URL format for redirect URLs
   * Only accepts http:// and https:// protocols for security
   *
   * @param url - URL to validate
   * @returns Validation result
   */
  static validateHttpUrl(url: string): ValidationResult {
    const errors: string[] = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required and must be a string');
      return { isValid: false, errors };
    }

    const trimmedUrl = url.trim();
    if (trimmedUrl === '') {
      errors.push('URL cannot be empty');
      return { isValid: false, errors };
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('URL must use http:// or https:// protocol');
      }
    } catch {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a value is a valid HTTP(S) URL (convenience method)
   * Returns true only if URL is valid and uses http/https protocol
   *
   * @param url - URL to check
   * @returns true if valid HTTP(S) URL, false otherwise
   */
  static isValidHttpUrl(url: any): url is string {
    return this.validateHttpUrl(url).isValid;
  }

  /**
   * Combine multiple validation results
   * @param results - Array of validation results
   * @returns Combined validation result
   */
  static combineValidationResults(results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(result => result.errors);
    const allWarnings = results.flatMap(result => result.warnings || []);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  /**
   * Validate service state
   * @param isStarted - Whether service is started
   * @param serviceName - Name of the service
   * @returns Validation result
   */
  static validateServiceState(isStarted: boolean, serviceName: string): ValidationResult {
    const errors: string[] = [];

    if (!isStarted) {
      errors.push(`${serviceName} is not started`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}