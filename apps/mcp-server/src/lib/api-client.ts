/**
 * PayIn API HTTP Client
 */

import type {
  ApiResponse,
  CreateOrderParams,
  ListOrdersParams,
  Order,
  OrderStatistics,
  BindDepositAddressParams,
  UnbindDepositAddressParams,
  DepositAddress,
  Transfer,
  AddressPoolAvailability,
  PoolAddress,
  Chain,
  Token,
  SystemHealth,
  PaymentLink,
  CreatePaymentLinkParams,
  UpdatePaymentLinkParams,
  UpdatePaymentLinkCurrenciesParams,
  ListPaymentLinksParams,
  PaymentLinkStatistics
} from '../types/index.js';
import { handleApiError, ApiError } from './error-handler.js';
import { Logger } from './utils.js';

/**
 * PayIn API Client
 */
export class PayInApiClient {
  private logger: Logger;

  constructor(
    private apiUrl: string,
    private apiKey: string,
    logLevel: string = 'info'
  ) {
    this.logger = new Logger(logLevel);
  }

  /**
   * Make HTTP request to PayIn API
   */
  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.apiUrl}${path}`;

    this.logger.debug(`API Request: ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const mcpError = await handleApiError(response);
        throw new ApiError(mcpError, response.status);
      }

      const data = await response.json() as ApiResponse<T>;
      this.logger.debug(`API Response: Success`);
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      this.logger.error(`API Request failed: ${error}`);
      throw error;
    }
  }

  // ==================== Order Management ====================

  /**
   * Create a new order
   */
  async createOrder(params: CreateOrderParams): Promise<Order> {
    const response = await this.request<Order>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.data!;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const response = await this.request<Order>(`/api/v1/orders/${orderId}`);
      return response.data || null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List orders with filtering
   */
  async listOrders(params: ListOrdersParams = {}): Promise<{
    orders: Order[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();

    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status.join(',') : params.status;
      queryParams.set('status', statuses);
    }
    if (params.chain) queryParams.set('chain', params.chain);
    if (params.token) queryParams.set('token', params.token);
    if (params.orderReference) queryParams.set('orderReference', params.orderReference);
    if (params.createdAfter) queryParams.set('createdAfter', params.createdAfter.toISOString());
    if (params.createdBefore) queryParams.set('createdBefore', params.createdBefore.toISOString());
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    // Convert camelCase to snake_case for sortBy field
    if (params.sortBy) {
      const sortBySnakeCase = params.sortBy.replace(/([A-Z])/g, '_$1').toLowerCase();
      queryParams.set('sortBy', sortBySnakeCase);
    }
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

    const response = await this.request<Order[]>(`/api/v1/orders?${queryParams}`);
    return {
      orders: response.data || [],
      pagination: (response as any).pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }

  /**
   * Get order statistics
   */
  async getOrderStatistics(params?: {
    chain?: string;
    token?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  }): Promise<OrderStatistics> {
    const queryParams = new URLSearchParams();

    if (params?.chain) queryParams.set('chain', params.chain);
    if (params?.token) queryParams.set('token', params.token);
    if (params?.createdAfter) queryParams.set('createdAfter', params.createdAfter.toISOString());
    if (params?.createdBefore) queryParams.set('createdBefore', params.createdBefore.toISOString());

    const response = await this.request<OrderStatistics>(`/api/v1/orders/stats?${queryParams}`);
    return response.data!;
  }

  // ==================== Deposit Management ====================

  /**
   * Bind deposit address for user
   */
  async bindDepositAddress(params: BindDepositAddressParams): Promise<DepositAddress> {
    const response = await this.request<DepositAddress>('/api/v1/deposits/bind', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.data!;
  }

  /**
   * Unbind deposit address
   */
  async unbindDepositAddress(params: UnbindDepositAddressParams): Promise<void> {
    await this.request('/api/v1/deposits/unbind', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get user deposit address
   */
  async getUserDepositAddress(
    depositReference: string,
    protocol: 'evm' | 'tron' = 'evm'
  ): Promise<DepositAddress | null> {
    try {
      const response = await this.request<DepositAddress>(
        `/api/v1/deposits/${depositReference}?protocol=${protocol}`
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List deposit references
   */
  async listDepositReferences(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    references: Array<{ depositReference: string; totalDeposits: number; totalAmount: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();

    if (params?.search) queryParams.set('search', params.search);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const response = await this.request(`/api/v1/deposits/references?${queryParams}`);
    return {
      references: response.data || [],
      pagination: (response as any).pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }

  /**
   * List deposit addresses
   */
  async listDepositAddresses(params?: {
    protocol?: 'evm' | 'tron';
    depositReference?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    addresses: DepositAddress[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();

    if (params?.protocol) queryParams.set('protocol', params.protocol);
    if (params?.depositReference) queryParams.set('depositReference', params.depositReference);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const response = await this.request<DepositAddress[]>(`/api/v1/deposits?${queryParams}`);
    return {
      addresses: response.data || [],
      pagination: (response as any).pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }

  // ==================== Transfer Management ====================

  /**
   * List transfers
   */
  async listTransfers(params?: {
    chain?: string;
    token?: string;
    address?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transfers: Transfer[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();

    if (params?.chain) queryParams.set('chain', params.chain);
    if (params?.token) queryParams.set('token', params.token);
    if (params?.address) queryParams.set('address', params.address);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const response = await this.request<Transfer[]>(`/api/v1/transfers?${queryParams}`);
    return {
      transfers: response.data || [],
      pagination: (response as any).pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }

  // ==================== Address Pool Management ====================

  /**
   * Get address pool availability
   */
  async getAddressPoolAvailability(protocol: 'evm' | 'tron'): Promise<AddressPoolAvailability> {
    const response = await this.request<AddressPoolAvailability>(
      `/api/v1/address-pool/availability?protocol=${protocol}`
    );
    return response.data!;
  }

  /**
   * List addresses from pool
   */
  async listAddresses(params?: {
    protocol?: 'evm' | 'tron';
    page?: number;
    pageSize?: number;
  }): Promise<{
    addresses: PoolAddress[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const queryParams = new URLSearchParams();

    if (params?.protocol) queryParams.set('protocol', params.protocol);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());

    const response = await this.request(`/api/v1/address-pool/addresses?${queryParams}`);
    return response.data!;
  }

  // ==================== Configuration ====================

  /**
   * List chains
   */
  async listChains(): Promise<Chain[]> {
    const response = await this.request<Chain[]>('/api/v1/chains');
    return response.data || [];
  }

  /**
   * List tokens
   */
  async listTokens(): Promise<Token[]> {
    const response = await this.request<any>('/api/tokens');
    // Note: /api/tokens returns {tokens: [...]} instead of {data: [...]}
    return (response as any).tokens || response.data || [];
  }

  // ==================== Payment Links Management ====================

  /**
   * Create a new payment link
   */
  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>('/api/v1/payment-links', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.data!;
  }

  /**
   * Get payment link by ID
   */
  async getPaymentLink(linkId: string): Promise<PaymentLink | null> {
    try {
      const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}`);
      return response.data || null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update payment link
   */
  async updatePaymentLink(linkId: string, params: UpdatePaymentLinkParams): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    return response.data!;
  }

  /**
   * Update payment link currencies configuration
   */
  async updatePaymentLinkCurrencies(linkId: string, params: UpdatePaymentLinkCurrenciesParams): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}/currencies`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    return response.data!;
  }

  /**
   * Publish payment link
   */
  async publishPaymentLink(linkId: string, slug?: string): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ slug }),
    });
    return response.data!;
  }

  /**
   * Unpublish payment link
   */
  async unpublishPaymentLink(linkId: string): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}/unpublish`, {
      method: 'POST',
    });
    return response.data!;
  }

  /**
   * Archive payment link
   */
  async archivePaymentLink(linkId: string): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}/archive`, {
      method: 'POST',
    });
    return response.data!;
  }

  /**
   * Restore payment link from archive
   */
  async restorePaymentLink(linkId: string): Promise<PaymentLink> {
    const response = await this.request<PaymentLink>(`/api/v1/payment-links/${linkId}/restore`, {
      method: 'POST',
    });
    return response.data!;
  }

  /**
   * List payment links with filtering
   */
  async listPaymentLinks(params: ListPaymentLinksParams = {}): Promise<{
    links: PaymentLink[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const queryParams = new URLSearchParams();

    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status.join(',') : params.status;
      queryParams.set('status', statuses);
    }
    if (params.search) queryParams.set('search', params.search);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.includeArchived) queryParams.set('includeArchived', 'true');
    if (params.archivedOnly) queryParams.set('archived', 'true');

    const response = await this.request<PaymentLink[]>(`/api/v1/payment-links?${queryParams}`);
    return {
      links: response.data || [],
      pagination: (response as any).pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
    };
  }

  /**
   * Get payment link statistics
   */
  async getPaymentLinkStatistics(params?: {
    status?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  }): Promise<PaymentLinkStatistics> {
    const queryParams = new URLSearchParams();

    if (params?.status) queryParams.set('status', params.status);
    if (params?.createdAfter) queryParams.set('createdAfter', params.createdAfter.toISOString());
    if (params?.createdBefore) queryParams.set('createdBefore', params.createdBefore.toISOString());

    const response = await this.request<PaymentLinkStatistics>(`/api/v1/payment-links/stats?${queryParams}`);
    return response.data!;
  }

  /**
   * Get payment link preview URL
   */
  async getPaymentLinkPreviewUrl(linkId: string): Promise<{ url: string; expiresIn: string }> {
    const response = await this.request<{ url: string; expiresIn: string }>(
      `/api/v1/payment-links/${linkId}/preview-url`,
      { method: 'POST' }
    );
    return response.data!;
  }

  /**
   * List orders for a payment link
   */
  async listPaymentLinkOrders(linkId: string): Promise<Order[]> {
    const response = await this.request<Order[]>(`/api/v1/payment-links/${linkId}/orders`);
    return response.data || [];
  }

  // ==================== System Health ====================

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.request<SystemHealth>('/health');
    return response.data || {
      api: 'healthy',
      processor: 'healthy',
      monitor: 'healthy',
      database: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}
