/**
 * Error Utility Functions
 * Provides consistent error handling and classification across the system
 */

/**
 * Error categories for better error handling
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  BLOCKCHAIN = 'BLOCKCHAIN',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  CONFIGURATION = 'CONFIGURATION',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  PERMISSION = 'PERMISSION',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  EXTERNAL_API = 'EXTERNAL_API'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Base processor error with enhanced metadata
 */
export class ProcessorError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    message: string,
    category: ErrorCategory,
    options: {
      severity?: ErrorSeverity;
      context?: Record<string, any>;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'ProcessorError';
    this.category = category;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.context = options.context;
    this.timestamp = new Date();
    this.retryable = options.retryable || false;

    if (options.cause) {
      this.cause = options.cause;
    }

    // Ensure the stack trace points to where the error was created
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessorError);
    }
  }

  /**
   * Get error code for API responses
   */
  getErrorCode(): string {
    return `${this.category}_ERROR`;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

/**
 * Specific error types for common scenarios
 */
export class ValidationError extends ProcessorError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCategory.VALIDATION, {
      severity: ErrorSeverity.LOW,
      context,
      retryable: false
    });
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends ProcessorError {
  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, ErrorCategory.DATABASE, {
      severity: ErrorSeverity.HIGH,
      context,
      cause,
      retryable: true
    });
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends ProcessorError {
  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, ErrorCategory.NETWORK, {
      severity: ErrorSeverity.MEDIUM,
      context,
      cause,
      retryable: true
    });
    this.name = 'NetworkError';
  }
}

export class BlockchainError extends ProcessorError {
  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, ErrorCategory.BLOCKCHAIN, {
      severity: ErrorSeverity.MEDIUM,
      context,
      cause,
      retryable: true
    });
    this.name = 'BlockchainError';
  }
}

export class BusinessLogicError extends ProcessorError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCategory.BUSINESS_LOGIC, {
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: false
    });
    this.name = 'BusinessLogicError';
  }
}

export class ServiceUnavailableError extends ProcessorError {
  constructor(serviceName: string, context?: Record<string, any>) {
    super(`${serviceName} is not available`, ErrorCategory.SERVICE_UNAVAILABLE, {
      severity: ErrorSeverity.HIGH,
      context: { serviceName, ...context },
      retryable: true
    });
    this.name = 'ServiceUnavailableError';
  }
}

export class ResourceNotFoundError extends ProcessorError {
  constructor(resourceType: string, resourceId: string, context?: Record<string, any>) {
    super(`${resourceType} not found: ${resourceId}`, ErrorCategory.RESOURCE_NOT_FOUND, {
      severity: ErrorSeverity.LOW,
      context: { resourceType, resourceId, ...context },
      retryable: false
    });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Error utilities for consistent error handling
 */
export class ErrorUtils {
  /**
   * Wrap unknown errors into ProcessorError
   * @param error - Unknown error
   * @param defaultCategory - Default category if not a ProcessorError
   * @param context - Additional context
   * @returns ProcessorError instance
   */
  static wrapError(
    error: unknown,
    defaultCategory: ErrorCategory = ErrorCategory.BUSINESS_LOGIC,
    context?: Record<string, any>
  ): ProcessorError {
    if (error instanceof ProcessorError) {
      return error;
    }

    if (error instanceof Error) {
      return new ProcessorError(error.message, defaultCategory, {
        cause: error,
        context
      });
    }

    return new ProcessorError(
      typeof error === 'string' ? error : 'Unknown error occurred',
      defaultCategory,
      { context: { originalError: error, ...context } }
    );
  }

  /**
   * Check if error is retryable
   * @param error - Error to check
   * @returns True if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof ProcessorError) {
      return error.retryable;
    }

    // Default retryability rules for non-ProcessorError instances
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('unavailable');
    }

    return false;
  }

  /**
   * Get error severity
   * @param error - Error to analyze
   * @returns Error severity
   */
  static getErrorSeverity(error: unknown): ErrorSeverity {
    if (error instanceof ProcessorError) {
      return error.severity;
    }

    // Default severity assignment
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Create error response object for APIs
   * @param error - Error to convert
   * @returns Error response object
   */
  static toErrorResponse(error: unknown): {
    error: string;
    code: string;
    message: string;
    timestamp: string;
    retryable?: boolean;
  } {
    const processedError = this.wrapError(error);

    return {
      error: processedError.name,
      code: processedError.getErrorCode(),
      message: processedError.message,
      timestamp: processedError.timestamp.toISOString(),
      retryable: processedError.retryable || undefined
    };
  }

  /**
   * Log error with appropriate level based on severity
   * @param error - Error to log
   * @param logger - Logger instance
   * @param context - Additional context
   */
  static logError(
    error: unknown,
    logger: any,
    context?: Record<string, any>
  ): void {
    const processedError = this.wrapError(error);
    const logContext = {
      ...processedError.context,
      ...context
    };

    switch (processedError.severity) {
      case ErrorSeverity.LOW:
        logger.warn(processedError.message, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        logger.error(processedError.message, logContext);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logger.error(processedError.message, {
          ...logContext,
          stack: processedError.stack
        });
        break;
    }
  }
}