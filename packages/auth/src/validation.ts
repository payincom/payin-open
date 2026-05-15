/**
 * Validation utilities for user input
 * Provides both frontend and backend validation
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Username validation rules (industry best practices):
 * - Length: 6-12 characters
 * - Format: alphanumeric, underscore, hyphen only
 * - Must start with a letter
 * - Cannot be all numbers
 */
export function validateUsername(username: string): ValidationResult {
  // Check required
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  // Trim whitespace
  const trimmed = username.trim();

  // Check length
  if (trimmed.length < 6) {
    return { valid: false, error: 'Username must be at least 6 characters' };
  }

  if (trimmed.length > 12) {
    return { valid: false, error: 'Username must not exceed 12 characters' };
  }

  // Check format: only letters, numbers, underscore, hyphen
  const validFormat = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  if (!validFormat.test(trimmed)) {
    return {
      valid: false,
      error: 'Username must start with a letter and contain only letters, numbers, underscores, or hyphens',
    };
  }

  // Check if all numbers (not allowed)
  const allNumbers = /^[0-9_-]+$/;
  if (allNumbers.test(trimmed)) {
    return { valid: false, error: 'Username cannot consist only of numbers' };
  }

  return { valid: true };
}

/**
 * Email validation rules (RFC 5322 simplified):
 * - Basic email format: local@domain
 * - Valid characters in local part
 * - Valid domain with TLD
 */
export function validateEmail(email: string): ValidationResult {
  // Check required
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  // Trim whitespace
  const trimmed = email.trim().toLowerCase();

  // Check length (reasonable limits)
  if (trimmed.length < 5) {
    return { valid: false, error: 'Email is too short' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  // RFC 5322 simplified email regex
  // This covers 99% of valid email addresses
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Password validation rules:
 * - Minimum 8 characters
 * - At least one letter
 * - At least one number
 * - Optional: special characters for stronger passwords
 */
export function validatePassword(password: string): ValidationResult {
  // Check required
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  // Check minimum length
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Check maximum length (prevent DoS)
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }

  // Check for at least one letter
  const hasLetter = /[a-zA-Z]/.test(password);
  if (!hasLetter) {
    return { valid: false, error: 'Password must contain at least one letter' };
  }

  // Check for at least one number
  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Validate user registration input
 * Combines all validation rules
 */
export function validateRegistration(input: {
  username: string;
  email: string;
  password: string;
}): ValidationResult {
  // Validate username
  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid) {
    return usernameResult;
  }

  // Validate email
  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) {
    return emailResult;
  }

  // Validate password
  const passwordResult = validatePassword(input.password);
  if (!passwordResult.valid) {
    return passwordResult;
  }

  return { valid: true };
}

/**
 * Sanitize username: trim and lowercase for consistency
 */
export function sanitizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Sanitize email: trim and lowercase
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
