/**
 * Asset URL helpers for development and production environments
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER = 'http://localhost:5173';

// TEMPORARY WORKAROUND: Use production build in dev due to React Fast Refresh preamble detection issues
// TODO: Fix preamble detection and enable HMR
const USE_PROD_BUILD = true;

/**
 * Get the URL for a client-side JavaScript entry point
 * In development, returns Vite dev server URL with HMR support
 * In production, returns the built bundle path
 */
export function getScriptUrl(entryPoint: 'order-payment' | 'deposit-payment'): string {
  if (isDevelopment && !USE_PROD_BUILD) {
    return `${VITE_DEV_SERVER}/client/${entryPoint}.tsx`;
  }
  return `/dist/${entryPoint}.js`;
}

/**
 * Get the URL for the main stylesheet
 * In development, returns empty (Vite injects CSS via JS)
 * In production, returns the built CSS file
 */
export function getStylesheetUrl(): string | null {
  if (isDevelopment && !USE_PROD_BUILD) {
    // Vite injects CSS automatically in dev mode
    return null;
  }
  return '/dist/assets/style.css';
}

/**
 * Get Vite client script for HMR (development only)
 * This enables hot module replacement in development
 */
export function getViteClientScript(): string | null {
  if (isDevelopment && !USE_PROD_BUILD) {
    return `${VITE_DEV_SERVER}/@vite/client`;
  }
  return null;
}

/**
 * Check if we're in development mode
 */
export function isDevMode(): boolean {
  return isDevelopment;
}
