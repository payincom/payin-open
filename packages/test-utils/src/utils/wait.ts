/**
 * Waiting utilities for tests
 *
 * Provides utilities for waiting for conditions to be met during testing
 */

/**
 * Wait for a condition to be true with timeout
 *
 * @param condition - Async function that returns true when condition is met
 * @param maxWaitMs - Maximum wait time in milliseconds
 * @param pollIntervalMs - Polling interval in milliseconds
 * @param errorMessage - Error message to throw on timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 1000,
  errorMessage: string = 'Timeout waiting for condition'
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`${errorMessage} (waited ${maxWaitMs}ms)`)
}

/**
 * Wait for a value to be returned with timeout
 *
 * @param getter - Async function that returns a value
 * @param validator - Function to validate the value
 * @param maxWaitMs - Maximum wait time in milliseconds
 * @param pollIntervalMs - Polling interval in milliseconds
 * @param errorMessage - Error message to throw on timeout
 * @returns The validated value
 */
export async function waitForValue<T>(
  getter: () => Promise<T | null | undefined>,
  validator: (value: T) => boolean,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 1000,
  errorMessage: string = 'Timeout waiting for value'
): Promise<T> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const value = await getter()
    if (value != null && validator(value)) {
      return value
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`${errorMessage} (waited ${maxWaitMs}ms)`)
}

/**
 * Simple delay utility
 *
 * @param ms - Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
