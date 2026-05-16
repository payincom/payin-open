/**
 * URL Builder Utilities
 * Generates public-facing URLs for payment links, orders, and deposits
 */

/**
 * Build checkout URL for a published payment link
 * @param baseUrl - Base URL of the API server (e.g., https://api.your-payin.example.com)
 * @param slug - Payment link slug
 * @returns Full checkout URL
 */
export function buildPaymentLinkCheckoutUrl(baseUrl: string, slug: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/checkout/${encodeURIComponent(slug)}`;
}

/**
 * Build order payment page URL
 * @param baseUrl - Base URL of the API server (e.g., https://api.your-payin.example.com)
 * @param orderId - Order UUID
 * @returns Full order payment page URL
 */
export function buildOrderPaymentUrl(baseUrl: string, orderId: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/pay/order/${orderId}`;
}

/**
 * Build deposit page URL
 * @param baseUrl - Base URL of the API server (e.g., https://api.your-payin.example.com)
 * @param depositReference - Deposit reference (external user ID)
 * @param protocol - Protocol (evm/tron)
 * @returns Full deposit page URL
 */
export function buildDepositPageUrl(baseUrl: string, depositReference: string, protocol: 'evm' | 'tron'): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/pay/deposit/${encodeURIComponent(depositReference)}?protocol=${protocol}`;
}

/**
 * Build deposit address URL (same as deposit page, for backward compatibility)
 * @deprecated Use buildDepositPageUrl instead
 */
export const buildDepositAddressUrl = buildDepositPageUrl;

/**
 * Get base URL from environment or fallback to localhost
 * @returns Base URL for the API server
 */
export function getBaseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}
