/**
 * Environment-specific configuration and limits
 */

import type { Environment } from './types.js';

export interface EnvironmentLimits {
  maxAddressCount: number;
  allowMnemonicImport: boolean;
  allowCustomPath: boolean;
  allowAddressVerification: boolean;
  showSecurityWarnings: boolean;
}

export const ENVIRONMENT_LIMITS: Record<Environment, EnvironmentLimits> = {
  // Online web version - Test mode only
  web: {
    maxAddressCount: 10,
    allowMnemonicImport: false,      // Prevent importing real mnemonics
    allowCustomPath: false,           // Standard paths only
    allowAddressVerification: false,  // Would require real mnemonic
    showSecurityWarnings: true,       // Prominent warnings
  },

  // Browser extension - Production mode
  extension: {
    maxAddressCount: Infinity,
    allowMnemonicImport: true,
    allowCustomPath: true,
    allowAddressVerification: true,
    showSecurityWarnings: false,      // Minimal warnings
  },

  // CLI tool - Full features
  cli: {
    maxAddressCount: Infinity,
    allowMnemonicImport: true,
    allowCustomPath: true,
    allowAddressVerification: true,
    showSecurityWarnings: false,
  },
};

/**
 * Detect current environment
 */
export function detectEnvironment(): Environment {
  // Browser extension
  if (
    typeof globalThis !== 'undefined' &&
    'chrome' in globalThis &&
    typeof (globalThis as any).chrome === 'object' &&
    (globalThis as any).chrome?.runtime?.id
  ) {
    return 'extension';
  }

  // Web browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'web';
  }

  // CLI / Node.js
  return 'cli';
}

/**
 * Get limits for current environment
 */
export function getEnvironmentLimits(env?: Environment): EnvironmentLimits {
  const environment = env || detectEnvironment();
  return ENVIRONMENT_LIMITS[environment];
}
