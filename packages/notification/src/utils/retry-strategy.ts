/**
 * Retry Strategy
 * Implements exponential backoff for failed notifications
 *
 * Retry schedule:
 * - Retry 1: 1 second
 * - Retry 2: 2 seconds
 * - Retry 3: 4 seconds
 * - Retry 4: 8 seconds
 * - Retry 5: 16 seconds
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
};

/**
 * Calculate next retry delay using exponential backoff
 *
 * Formula: delay = initialDelay * (multiplier ^ retryCount)
 * Capped at maxDelay
 *
 * @param retryCount - Current retry count (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 *
 * @example
 * ```typescript
 * calculateRetryDelay(0) // Returns: 1000ms (1s)
 * calculateRetryDelay(1) // Returns: 2000ms (2s)
 * calculateRetryDelay(2) // Returns: 4000ms (4s)
 * calculateRetryDelay(3) // Returns: 8000ms (8s)
 * calculateRetryDelay(4) // Returns: 16000ms (16s)
 * ```
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Calculate next retry time
 *
 * @param retryCount - Current retry count (0-based)
 * @param config - Retry configuration
 * @returns Next retry time as Date
 *
 * @example
 * ```typescript
 * const nextRetry = calculateNextRetryAt(2);
 * console.log('Next retry at:', nextRetry);
 * ```
 */
export function calculateNextRetryAt(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Date {
  const delayMs = calculateRetryDelay(retryCount, config);
  return new Date(Date.now() + delayMs);
}

/**
 * Check if notification should be retried based on HTTP status
 *
 * Retry conditions:
 * - null (network error or timeout)
 * - 5xx server errors
 *
 * Do NOT retry:
 * - 2xx success
 * - 4xx client errors (wrong URL, authentication failed, etc.)
 *
 * @param httpStatusCode - HTTP status code from response (or null for network errors)
 * @returns true if should retry
 *
 * @example
 * ```typescript
 * shouldRetry(null)  // true - network error
 * shouldRetry(500)   // true - server error
 * shouldRetry(503)   // true - service unavailable
 * shouldRetry(200)   // false - success
 * shouldRetry(404)   // false - not found
 * shouldRetry(401)   // false - unauthorized
 * ```
 */
export function shouldRetry(httpStatusCode: number | null | undefined): boolean {
  if (httpStatusCode === null || httpStatusCode === undefined) {
    // Network error or timeout, should retry
    return true;
  }

  if (httpStatusCode >= 500) {
    // Server error, should retry
    return true;
  }

  // 2xx success or 4xx client error, should not retry
  return false;
}

/**
 * Check if max retries reached
 *
 * @param retryCount - Current retry count
 * @param config - Retry configuration
 * @returns true if can retry more
 *
 * @example
 * ```typescript
 * hasRetriesLeft(0) // true - can retry
 * hasRetriesLeft(4) // true - can retry (last retry)
 * hasRetriesLeft(5) // false - max retries reached
 * ```
 */
export function hasRetriesLeft(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return retryCount < config.maxRetries;
}

/**
 * Check if notification should be retried
 *
 * Combines status check and retry limit check
 *
 * @param httpStatusCode - HTTP status code
 * @param retryCount - Current retry count
 * @param config - Retry configuration
 * @returns true if should schedule retry
 *
 * @example
 * ```typescript
 * shouldScheduleRetry(500, 2) // true - server error, can retry
 * shouldScheduleRetry(500, 5) // false - server error but max retries reached
 * shouldScheduleRetry(404, 2) // false - client error, don't retry
 * ```
 */
export function shouldScheduleRetry(
  httpStatusCode: number | null | undefined,
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return shouldRetry(httpStatusCode) && hasRetriesLeft(retryCount, config);
}
