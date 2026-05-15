/**
 * Redirect Service
 * Handles redirect URL generation for completed/expired orders and deposits
 */

export interface RedirectConfig {
  // Order default redirect URLs
  default_order_success_url?: string | null;
  default_order_cancel_url?: string | null;

  // Deposit global redirect URL (no per-deposit override)
  deposit_success_url?: string | null;
}

/**
 * Order information for redirect URL generation
 * Minimal interface to avoid cross-package dependencies
 */
export interface OrderInfo {
  id: string;
  order_reference: string;
  amount: string;
  token: string;
  chain: string;
  status: string;
  completed_at: Date | null;
  success_url?: string | null;
  cancel_url?: string | null;
}

export interface DepositInfo {
  id: string;
  deposit_reference: string;
  amount: string;
  token: string;
  chain: string;
  status: string;
  confirmed_at: Date | null;
}

export interface TransferInfo {
  transaction_hash: string;
}

export class RedirectService {
  constructor(private config: RedirectConfig) {}

  /**
   * Build order redirect URL with query parameters
   */
  private buildOrderRedirectUrl(
    baseUrl: string,
    order: OrderInfo,
    status: 'completed' | 'expired'
  ): string {
    const url = new URL(baseUrl);

    // Add common parameters
    url.searchParams.set('order_reference', order.order_reference);
    url.searchParams.set('status', status);
    url.searchParams.set('amount', order.amount);
    url.searchParams.set('currency', order.token);
    url.searchParams.set('chain_id', order.chain);

    // Add status-specific parameters
    if (status === 'completed' && order.completed_at) {
      url.searchParams.set('completed_at', order.completed_at.toISOString());
    }

    return url.toString();
  }

  /**
   * Build deposit redirect URL with query parameters
   */
  private buildDepositRedirectUrl(
    baseUrl: string,
    deposit: DepositInfo,
    transfer: TransferInfo
  ): string {
    const url = new URL(baseUrl);

    url.searchParams.set('deposit_reference', deposit.deposit_reference);
    url.searchParams.set('deposit_id', deposit.id);
    url.searchParams.set('status', 'completed');
    url.searchParams.set('amount', deposit.amount);
    url.searchParams.set('currency', deposit.token);
    url.searchParams.set('chain_id', deposit.chain);
    url.searchParams.set('tx_hash', transfer.transaction_hash);

    if (deposit.confirmed_at) {
      url.searchParams.set('confirmed_at', deposit.confirmed_at.toISOString());
    }

    return url.toString();
  }

  /**
   * Get order redirect URL
   * Priority: order.success_url/cancel_url > config.default_order_*_url
   */
  getOrderRedirectUrl(
    order: OrderInfo,
    success: boolean
  ): string | null {
    const baseUrl = success
      ? (order.success_url || this.config.default_order_success_url)
      : (order.cancel_url || this.config.default_order_cancel_url);

    if (!baseUrl) return null;

    return this.buildOrderRedirectUrl(
      baseUrl,
      order,
      success ? 'completed' : 'expired'
    );
  }

  /**
   * Get deposit redirect URL
   * Only use global config (no per-deposit override)
   */
  getDepositRedirectUrl(
    deposit: DepositInfo,
    transfer: TransferInfo
  ): string | null {
    const baseUrl = this.config.deposit_success_url;

    if (!baseUrl) return null;
    if (deposit.status !== 'completed') return null;

    return this.buildDepositRedirectUrl(baseUrl, deposit, transfer);
  }

  /**
   * Update redirect configuration
   */
  updateConfig(config: Partial<RedirectConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current redirect configuration
   */
  getConfig(): RedirectConfig {
    return { ...this.config };
  }
}
