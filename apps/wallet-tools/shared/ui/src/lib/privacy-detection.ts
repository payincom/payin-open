import { detectIncognito } from 'detectincognitojs';

/**
 * Detect if browser is in private/incognito mode
 * Uses detectIncognito library for cross-browser detection
 */
export async function isPrivateMode(): Promise<boolean> {
  try {
    const result = await detectIncognito();
    console.log('🔍 detectIncognito result:', { isPrivate: result.isPrivate, browserName: result.browserName });
    return result.isPrivate;
  } catch (error) {
    console.error('❌ detectIncognito failed:', error);
    // Fallback to simple detection
    return fallbackDetection();
  }
}

/**
 * Fallback detection for localhost/development
 */
async function fallbackDetection(): Promise<boolean> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      console.log('🔍 Fallback: Storage quota check:', { quotaMB: Math.round(quota / 1024 / 1024) });

      // In private mode, quota is usually very limited (< 120MB in Chrome)
      if (quota > 0 && quota < 120000000) {
        console.log('✅ Fallback: Private mode detected via quota');
        return true;
      }
    }

    console.log('❌ Fallback: Normal mode assumed');
    return false;
  } catch (error) {
    console.error('❌ Fallback detection failed:', error);
    return false;
  }
}

/**
 * Detect current environment
 */
export type Environment = 'extension' | 'web-private' | 'web-normal';

export async function detectEnvironment(): Promise<Environment> {
  // Check if running in extension
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalChrome = (globalThis as any).chrome;
  if (typeof globalChrome !== 'undefined' && globalChrome.runtime && globalChrome.runtime.id) {
    console.log('🔍 Environment: Browser Extension');
    return 'extension';
  }

  // Check if private mode
  const isPrivate = await isPrivateMode();
  const env = isPrivate ? 'web-private' : 'web-normal';
  console.log('🔍 Final Environment:', env);
  return env;
}

/**
 * Get security warnings based on environment
 */
export function getSecurityWarning(env: Environment): {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  canProceed: boolean;
  canImportMnemonic: boolean;
} {
  console.log('🔄 getSecurityWarning called with env:', env, '- UPDATED VERSION');
  switch (env) {
    case 'extension':
      return {
        type: 'success',
        title: 'Secure Environment',
        message: 'You are using the browser extension. All features are available and your data is secure.',
        canProceed: true,
        canImportMnemonic: true,
      };
    case 'web-private':
      return {
        type: 'warning',
        title: 'Private Browsing Mode',
        message:
          'Recommended to use in offline mode. Your data will be cleared when you close this tab.',
        canProceed: true,
        canImportMnemonic: false,
      };
    case 'web-normal':
      return {
        type: 'error',
        title: 'Insecure Environment',
        message:
          'You are NOT in private browsing mode. For security reasons, this tool is blocked in normal browsing mode. Please switch to private/incognito mode or install the browser extension.',
        canProceed: false,
        canImportMnemonic: false,
      };
  }
}
