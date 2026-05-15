/**
 * Retry Strategy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRetryDelay,
  calculateNextRetryAt,
  shouldRetry,
  hasRetriesLeft,
  shouldScheduleRetry,
  DEFAULT_RETRY_CONFIG,
} from '../src/utils/retry-strategy';

describe('Retry Strategy', () => {
  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delays', () => {
      expect(calculateRetryDelay(0)).toBe(1000);   // 1s
      expect(calculateRetryDelay(1)).toBe(2000);   // 2s
      expect(calculateRetryDelay(2)).toBe(4000);   // 4s
      expect(calculateRetryDelay(3)).toBe(8000);   // 8s
      expect(calculateRetryDelay(4)).toBe(16000);  // 16s
    });

    it('should cap delay at maxDelay', () => {
      expect(calculateRetryDelay(5)).toBe(16000);  // Capped at 16s
      expect(calculateRetryDelay(10)).toBe(16000); // Still capped
    });

    it('should use custom config', () => {
      const config = {
        maxRetries: 3,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 3,
      };

      expect(calculateRetryDelay(0, config)).toBe(500);   // 500ms
      expect(calculateRetryDelay(1, config)).toBe(1500);  // 1.5s
      expect(calculateRetryDelay(2, config)).toBe(4500);  // 4.5s
      expect(calculateRetryDelay(3, config)).toBe(5000);  // Capped at 5s
    });
  });

  describe('calculateNextRetryAt', () => {
    it('should return future date', () => {
      const before = new Date();
      const nextRetry = calculateNextRetryAt(0);
      const after = new Date(Date.now() + 2000); // Add buffer

      expect(nextRetry.getTime()).toBeGreaterThan(before.getTime());
      expect(nextRetry.getTime()).toBeLessThan(after.getTime());
    });

    it('should add correct delay', () => {
      const now = Date.now();
      const nextRetry = calculateNextRetryAt(2); // Should add 4000ms

      const expectedTime = now + 4000;
      const actualTime = nextRetry.getTime();

      // Allow 100ms tolerance for execution time
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(100);
    });
  });

  describe('shouldRetry', () => {
    it('should retry on network errors (null)', () => {
      expect(shouldRetry(null)).toBe(true);
      expect(shouldRetry(undefined)).toBe(true);
    });

    it('should retry on 5xx server errors', () => {
      expect(shouldRetry(500)).toBe(true);
      expect(shouldRetry(502)).toBe(true);
      expect(shouldRetry(503)).toBe(true);
      expect(shouldRetry(504)).toBe(true);
    });

    it('should not retry on 2xx success', () => {
      expect(shouldRetry(200)).toBe(false);
      expect(shouldRetry(201)).toBe(false);
      expect(shouldRetry(204)).toBe(false);
    });

    it('should not retry on 4xx client errors', () => {
      expect(shouldRetry(400)).toBe(false);
      expect(shouldRetry(401)).toBe(false);
      expect(shouldRetry(403)).toBe(false);
      expect(shouldRetry(404)).toBe(false);
    });

    it('should not retry on 3xx redirects', () => {
      expect(shouldRetry(301)).toBe(false);
      expect(shouldRetry(302)).toBe(false);
    });
  });

  describe('hasRetriesLeft', () => {
    it('should return true when retries left', () => {
      expect(hasRetriesLeft(0)).toBe(true);  // Can retry 5 more times
      expect(hasRetriesLeft(1)).toBe(true);  // Can retry 4 more times
      expect(hasRetriesLeft(4)).toBe(true);  // Can retry 1 more time
    });

    it('should return false when max retries reached', () => {
      expect(hasRetriesLeft(5)).toBe(false);  // Max reached
      expect(hasRetriesLeft(6)).toBe(false);  // Beyond max
    });

    it('should use custom config', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 };

      expect(hasRetriesLeft(2, config)).toBe(true);
      expect(hasRetriesLeft(3, config)).toBe(false);
    });
  });

  describe('shouldScheduleRetry', () => {
    it('should schedule retry for retryable errors with retries left', () => {
      expect(shouldScheduleRetry(500, 0)).toBe(true);  // Server error, retry 0
      expect(shouldScheduleRetry(null, 2)).toBe(true); // Network error, retry 2
    });

    it('should not schedule retry when max retries reached', () => {
      expect(shouldScheduleRetry(500, 5)).toBe(false);  // Server error but max retries
      expect(shouldScheduleRetry(null, 6)).toBe(false); // Network error but max retries
    });

    it('should not schedule retry for non-retryable errors', () => {
      expect(shouldScheduleRetry(404, 0)).toBe(false); // Client error
      expect(shouldScheduleRetry(200, 0)).toBe(false); // Success
    });

    it('should combine both conditions correctly', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 };

      // Should retry: server error, retries left
      expect(shouldScheduleRetry(500, 0, config)).toBe(true);
      expect(shouldScheduleRetry(500, 1, config)).toBe(true);

      // Should not retry: server error, but max retries
      expect(shouldScheduleRetry(500, 2, config)).toBe(false);

      // Should not retry: client error, even with retries left
      expect(shouldScheduleRetry(404, 0, config)).toBe(false);
    });
  });
});
