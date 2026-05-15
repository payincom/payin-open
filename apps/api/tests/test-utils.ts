/**
 * E2E Test Utilities for Web Server
 *
 * This module provides utilities for end-to-end testing of the Web Server API,
 * reusing test tools from @payin/processor for address generation and payment sending.
 */

let MultiChainAddressGenerator: any;
let MultiChainPaymentSender: any;

try {
  ({ MultiChainAddressGenerator } = await import('../../tools/generate-multichain-addresses.js'));
} catch (error) {
  MultiChainAddressGenerator = class {
    getMasterPublicKey() {
      return 'xpub-stub';
    }

    getAddress(chain: string, index: number) {
      const base = `${chain}-${index}`.replace(/[^a-zA-Z0-9]/g, '').padEnd(40, 'a').slice(0, 40);
      return { address: `0x${base}` };
    }
  };
}

try {
  ({ MultiChainPaymentSender } = await import('../../tools/send-multichain-payment.js'));
} catch (error) {
  MultiChainPaymentSender = class {
    async sendPayment() {
      return {
        transactionHash: `0x${Date.now().toString(16).padStart(64, '0')}`,
        status: 'sent',
      };
    }
  };
}

// Test MNEMONIC (hardcoded - only contains testnet funds, safe to commit)
const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate';

/**
 * API Client for making HTTP requests to the Web Server
 */
export class ApiClient {
  private authToken?: string;
  private organizationId?: string;

  constructor(private baseUrl: string = 'http://localhost:3000') {}

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Set organization ID for multi-tenant requests
   */
  setOrganizationId(orgId: string) {
    this.organizationId = orgId;
  }

  /**
   * Login and automatically set auth token
   */
  async login(username: string, password: string) {
    const response = await this.request('POST', '/api/v1/auth/login', { username, password });
    if (response.success && response.data.token) {
      this.authToken = response.data.token;
    }
    return response;
  }

  private async request(method: string, path: string, body?: any) {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Add organization ID header if available (required for JWT auth)
    if (this.organizationId) {
      headers['X-Organization-ID'] = this.organizationId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API request failed: ${JSON.stringify(data)}`);
    }

    return data;
  }

  async get(path: string) {
    return this.request('GET', path);
  }

  async post(path: string, body: any) {
    return this.request('POST', path, body);
  }

  async put(path: string, body: any) {
    return this.request('PUT', path, body);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }

  // Health check
  async health() {
    return this.get('/health');
  }

  // Order endpoints
  async createOrder(params: {
    orderReference: string;
    amount: string;
    currency: string;
    chainId: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: any;
  }) {
    return this.post('/api/v1/orders', params);
  }

  async getOrder(orderId: string) {
    return this.get(`/api/v1/orders/${orderId}`);
  }

  async listOrders(filters?: any) {
    const params = new URLSearchParams(filters);
    return this.get(`/api/v1/orders?${params}`);
  }

  async getOrderStats(filters?: any) {
    const params = new URLSearchParams(filters);
    return this.get(`/api/v1/orders/stats?${params}`);
  }

  // Deposit endpoints
  async bindDepositAddress(params: {
    depositReference: string;
    protocol: 'evm' | 'tron';
    metadata?: any;
  }) {
    return this.post('/api/v1/deposits/bind', params);
  }

  async unbindDepositAddress(depositReference: string) {
    return this.post('/api/v1/deposits/unbind', { depositReference });
  }

  async getDepositAddress(depositReference: string, protocol: 'evm' | 'tron' = 'evm') {
    return this.get(`/api/v1/deposits/${depositReference}?protocol=${protocol}`);
  }

  async listDepositAddresses(filters?: any) {
    const params = new URLSearchParams(filters);
    return this.get(`/api/v1/deposits?${params}`);
  }

  async listDepositReferences(filters?: any) {
    const params = new URLSearchParams(filters);
    return this.get(`/api/v1/deposits/references?${params}`);
  }

  // Transfer endpoints
  async listTransfers(filters?: any) {
    const params = new URLSearchParams(filters);
    return this.get(`/api/v1/transfers?${params}`);
  }

  async getTransfersByReference(params: { orderId?: string; depositReference?: string }) {
    const queryParams = new URLSearchParams(params);
    return this.get(`/api/v1/transfers/by-reference?${queryParams}`);
  }

  // Address pool endpoints
  async getAddressPoolAvailability(protocol: 'evm' | 'tron' | 'solana' = 'evm') {
    return this.get(`/api/v1/address-pool/availability?protocol=${protocol}`);
  }

  async getAddressPoolSummary() {
    return this.get('/api/v1/address-pool/summary');
  }

  async addAddressesToPool(addresses: Array<{
    address: string;
    protocol: 'evm' | 'tron' | 'solana';
    masterPublicKey?: string;
    derivationIndex: number;
  }>) {
    return this.post('/api/v1/address-pool/addresses', { addresses });
  }

  // Config endpoints
  async getConfig(key?: string) {
    return this.get(key ? `/api/v1/config/${key}` : '/api/v1/config');
  }

  async updateConfig(key: string, value: any) {
    return this.put(`/api/v1/config/${key}`, { value });
  }

  // Payment Link endpoints (authenticated)
  async createPaymentLink(body: any) {
    return this.post('/api/v1/payment-links', body);
  }

  async updatePaymentLink(id: string, body: any) {
    return this.put(`/api/v1/payment-links/${id}`, body);
  }

  async publishPaymentLink(id: string, body?: any) {
    return this.post(`/api/v1/payment-links/${id}/publish`, body ?? {});
  }

  async disablePaymentLink(id: string) {
    return this.post(`/api/v1/payment-links/${id}/disable`, {});
  }

  async revertPaymentLinkToDraft(id: string) {
    return this.post(`/api/v1/payment-links/${id}/draft`, {});
  }

  async listPaymentLinks(filters?: any) {
    const params = new URLSearchParams(filters ?? {});
    const query = params.toString();
    return this.get(query ? `/api/v1/payment-links?${query}` : '/api/v1/payment-links');
  }

  async getPaymentLink(id: string) {
    return this.get(`/api/v1/payment-links/${id}`);
  }

  async listPaymentLinkOrders(id: string) {
    return this.get(`/api/v1/payment-links/${id}/orders`);
  }

  // Payment Link public endpoints
  async getPublicPaymentLink(slug: string) {
    return this.get(`/api/payment-links/${slug}`);
  }

  async createPublicPaymentLinkOrder(slug: string, body: any) {
    return this.post(`/api/payment-links/${slug}/orders`, body);
  }
}

/**
 * Test utilities for address generation and payment sending
 */
export class E2ETestUtils {
  private static addressGenerator = new MultiChainAddressGenerator(TEST_MNEMONIC);
  private static paymentSender: MultiChainPaymentSender | null = null;

  private static getPaymentSender(): MultiChainPaymentSender {
    if (!this.paymentSender) {
      if (!process.env.MNEMONIC) {
        process.env.MNEMONIC = TEST_MNEMONIC;
      }
      this.paymentSender = new MultiChainPaymentSender();
    }
    return this.paymentSender;
  }

  /**
   * Generate test addresses and add them to the address pool via API
   * By default generates EVM addresses for backward compatibility
   */
  static async initializeAddressPool(
    api: ApiClient,
    count: number = 9,
    protocol: 'evm' | 'tron' = 'evm'
  ): Promise<void> {
    const masterPublicKey = this.addressGenerator.getMasterPublicKey();
    const addresses = [];

    // Select appropriate chain for address generation based on protocol
    const chainForGeneration = protocol === 'tron' ? 'tron-nile' : 'ethereum-sepolia';

    for (let i = 1; i <= count; i++) {
      const result = this.addressGenerator.getAddress(chainForGeneration, i);
      if (result) {
        addresses.push({
          address: result.address,
          derivationIndex: i,
          protocol: protocol,
          masterPublicKey,
        });
      }
    }

    if (addresses.length > 0) {
      await api.addAddressesToPool(addresses);
      console.log(`✅ Added ${addresses.length} ${protocol} addresses to pool`);
    }
  }

  /**
   * Ensure sufficient addresses in the pool, add more if needed
   * Note: API now returns "available" as idle - coolingDown (ready to use)
   */
  static async ensureSufficientAddresses(
    api: ApiClient,
    protocol: 'evm' | 'tron',
    required: number,
    startIndex: number = 1
  ): Promise<void> {
    console.log(`🔍 Checking address pool availability for protocol: ${protocol}...`);

    const poolStatus = await api.getAddressPoolAvailability(protocol);
    const idleCount = poolStatus.data.idle;
    const availableCount = poolStatus.data.available;  // This is already idle - coolingDown
    const coolingDownCount = poolStatus.data.coolingDown;

    console.log(`   Idle addresses (all state='idle'): ${idleCount}`);
    console.log(`   Cooling down addresses: ${coolingDownCount}`);
    console.log(`   Available addresses (idle - cooling): ${availableCount}`);
    console.log(`   Required addresses: ${required}`);

    if (availableCount >= required) {
      console.log(`✅ Sufficient available addresses in pool`);
      return;
    }

    const needed = required - availableCount;
    console.log(`⚠️  Need to add ${needed} more addresses to pool`);

    const masterPublicKey = this.addressGenerator.getMasterPublicKey();
    const addresses = [];

    // Select appropriate chain for address generation based on protocol
    const chainForGeneration = protocol === 'tron' ? 'tron-nile' : 'ethereum-sepolia';

    for (let i = 0; i < needed; i++) {
      const index = startIndex + i;
      const result = this.addressGenerator.getAddress(chainForGeneration, index);
      if (result) {
        addresses.push({
          address: result.address,
          derivationIndex: index,
          protocol: protocol,
          masterPublicKey,
        });
      }
    }

    if (addresses.length > 0) {
      await api.addAddressesToPool(addresses);
      console.log(`✅ Added ${addresses.length} addresses to pool (total available: ${availableCount + addresses.length})`);
    }
  }

  /**
   * Get next available derivation index by querying the database or using a safe offset
   */
  static async getNextDerivationIndex(api: ApiClient, protocol: 'evm' | 'tron'): Promise<number> {
    // Use timestamp-based index to avoid conflicts (starts from 1000+)
    // This is a simple approach that works well for tests
    return 1000 + Date.now() % 10000;
  }

  /**
   * Add addresses to pool starting from a safe index
   */
  static async addAddressesToPool(
    api: ApiClient,
    protocol: 'evm' | 'tron',
    count: number
  ): Promise<void> {
    console.log(`📦 Adding ${count} new addresses to ${protocol} pool...`);

    const masterPublicKey = this.addressGenerator.getMasterPublicKey();
    const addresses = [];
    const startIndex = await this.getNextDerivationIndex(api, protocol);

    // Select appropriate chain for address generation based on protocol
    const chainForGeneration = protocol === 'tron' ? 'tron-nile' : 'ethereum-sepolia';

    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      const result = this.addressGenerator.getAddress(chainForGeneration, index);
      if (result) {
        addresses.push({
          address: result.address,
          derivationIndex: index,
          protocol: protocol,
          masterPublicKey,
        });
      }
    }

    if (addresses.length > 0) {
      try {
        await api.addAddressesToPool(addresses);
        console.log(`✅ Successfully added ${addresses.length} addresses to pool`);
      } catch (error: any) {
        // If addresses already exist, that's okay - continue
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
          console.log(`⚠️  Some addresses already exist, continuing...`);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Create order with automatic address generation on shortage
   */
  static async createOrderWithAutoAddressGeneration(
    api: ApiClient,
    orderParams: {
      orderReference: string;
      amount: string;
      currency: string;
      chainId: string;
      callbackUrl?: string;
      metadata?: any;
    }
  ): Promise<any> {
    try {
      // Try to create order first
      return await api.createOrder(orderParams);
    } catch (error: any) {
      // Check if error is due to no available addresses
      if (error.message && error.message.includes('No available addresses')) {
        console.log('⚠️  No available addresses detected. Auto-generating addresses...');

        // Determine protocol from chainId
        const protocol = orderParams.chainId.includes('tron') ? 'tron' : 'evm';

        // Add 5 new addresses to the pool
        await this.addAddressesToPool(api, protocol, 5);

        console.log('🔄 Retrying order creation...');

        // Retry order creation
        return await api.createOrder(orderParams);
      }

      // If it's a different error, re-throw it
      throw error;
    }
  }

  /**
   * Bind deposit address with automatic address generation on shortage
   */
  static async bindDepositAddressWithAutoAddressGeneration(
    api: ApiClient,
    bindParams: {
      depositReference: string;
      protocol: 'evm' | 'tron';
      metadata?: any;
    }
  ): Promise<any> {
    try {
      // Try to bind deposit address first
      return await api.bindDepositAddress(bindParams);
    } catch (error: any) {
      // Check if error is due to no available addresses
      if (error.message && error.message.includes('No available') && error.message.includes('deposit pool')) {
        console.log('⚠️  No available deposit addresses detected. Auto-generating addresses...');

        // Add 5 new addresses to the pool
        await this.addAddressesToPool(api, bindParams.protocol, 5);

        console.log('🔄 Retrying deposit address binding...');

        // Retry deposit address binding
        return await api.bindDepositAddress(bindParams);
      }

      // If it's a different error, re-throw it
      throw error;
    }
  }

  /**
   * Get a random chain from ethereum-sepolia, polygon-amoy, or tron-nile
   */
  static getRandomChain(): 'ethereum-sepolia' | 'polygon-amoy' | 'tron-nile' {
    const chains: Array<'ethereum-sepolia' | 'polygon-amoy' | 'tron-nile'> = [
      'ethereum-sepolia',
      'polygon-amoy',
      'tron-nile'
    ];
    return chains[Math.floor(Math.random() * chains.length)];
  }

  /**
   * Generate a random amount between 0 and 0.05 (6 decimal places)
   */
  static getRandomAmount(min: number = 0.001, max: number = 0.05): string {
    const randomValue = Math.random() * (max - min) + min;
    return randomValue.toFixed(6);
  }

  /**
   * Send a payment to a specific address
   */
  static async sendPayment(params: {
    toAddress: string;
    amount: string;
    token: string;
    chain: string;
  }) {
    console.log(`💸 Sending ${params.amount} ${params.token} to ${params.toAddress} on ${params.chain}...`);
    // Pass token parameter to payment sender (will auto-select based on chain if not provided)
    return this.getPaymentSender().sendPayment(params.chain, params.toAddress, params.amount, params.token);
  }

  /**
   * Wait for an order to reach a specific status by polling the API
   */
  static async waitForOrderStatus(
    api: ApiClient,
    orderId: string,
    expectedStatus: string,
    maxWaitMs: number = 180000
  ): Promise<any> {
    const startTime = Date.now();
    console.log(`⏳ Waiting for order ${orderId} to reach status: ${expectedStatus}...`);

    while (Date.now() - startTime < maxWaitMs) {
      const response = await api.getOrder(orderId);
      const order = response.data;

      if (order && order.status === expectedStatus) {
        console.log(`✅ Order ${orderId} reached status: ${expectedStatus}`);
        return order;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for order ${orderId} to reach status ${expectedStatus}`);
  }

  /**
   * Wait for transfers to be confirmed by polling the API
   */
  static async waitForTransfersConfirmed(
    api: ApiClient,
    reference: { orderId?: string; depositReference?: string },
    expectedCount: number,
    maxWaitMs: number = 60000
  ): Promise<any[]> {
    const startTime = Date.now();
    const refKey = reference.orderId
      ? `orderId: ${reference.orderId}`
      : `depositReference: ${reference.depositReference}`;
    console.log(`⏳ Waiting for ${expectedCount} confirmed transfers for ${refKey}...`);

    while (Date.now() - startTime < maxWaitMs) {
      const response = await api.getTransfersByReference(reference);
      const transfers = response.data;

      // Debug logging
      console.log(`🔍 [${Math.floor((Date.now() - startTime) / 1000)}s] Poll result:`, {
        count: transfers?.length || 0,
        expected: expectedCount,
        transfers: transfers?.map((t: any) => ({
          chain: t.chain,
          amount: t.amount,
          confirmed: t.is_confirmed,
          txHash: t.transaction_hash?.substring(0, 10) + '...'
        }))
      });

      if (
        transfers &&
        transfers.length >= expectedCount &&
        transfers.every((t: any) => t.is_confirmed)
      ) {
        console.log(`✅ Found ${transfers.length} confirmed transfers for ${refKey}`);
        return transfers;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for ${expectedCount} confirmed transfers for ${refKey}`);
  }

  /**
   * Check if two amounts are equal within a tolerance
   */
  static isAmountEqual(amount1: string, amount2: string, tolerance: number = 0.000001): boolean {
    const diff = Math.abs(parseFloat(amount1) - parseFloat(amount2));
    return diff <= tolerance;
  }

  /**
   * Cleanup resources
   */
  static async cleanup() {
    if ((globalThis as any).__payinRPCManager) {
      await (globalThis as any).__payinRPCManager.stop();
      delete (globalThis as any).__payinRPCManager;
    }
  }
}
