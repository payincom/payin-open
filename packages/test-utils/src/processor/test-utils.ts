/**
 * Processor Test Utilities
 *
 * Centralized test helpers for @payin/processor module
 */

import { TestSchemaManager } from '../database/index.js';
import { TEST_MNEMONIC, TEST_ORG_ID, TEST_DATABASE_URL, TEST_RPC_KEYS } from './fixtures.js';
import { UnifiedAddressGenerator, createDefaultAddressGenerator } from './address-generator.js';
import { ChainTokenConfig, getTestChainConfig } from './chain-config.js';

// Type imports
import type { Processor, ProcessorConfig } from '@payin/processor';

// Multi-chain payment sender
import { MultiChainPaymentSender } from '../blockchain/index.js';

/**
 * Create a test processor instance with standard test configuration
 *
 * @param config - Additional processor configuration to merge with defaults
 * @param schema - Optional database schema for test isolation
 * @returns Configured processor instance
 */
export async function createTestProcessor(
  config: ProcessorConfig = {},
  schema?: string
): Promise<Processor> {
  console.log('🔧 Creating new Processor instance for test...');

  // Set up test database connection
  ProcessorTestUtils.setupTestDatabase(schema);

  // Dynamically import Processor to avoid circular dependencies
  const { Processor } = await import('@payin/processor');

  // Merge test RPC keys with provided config
  const testConfig: ProcessorConfig = {
    ...config,
    monitor: config.monitor ? {
      ...config.monitor,
      rpcKeys: {
        ...TEST_RPC_KEYS,
        ...config.monitor.rpcKeys
      }
    } as any : undefined
  };

  // Create processor with test config + test.yaml file
  const processor = await Processor.create(testConfig, 'test.yaml');
  console.log('✅ New Processor instance created.');
  return processor;
}

/**
 * Processor Test Utilities Class
 *
 * Provides helper methods for testing processor functionality
 */
export class ProcessorTestUtils {
  /** Test organization ID for single-org tests */
  static readonly TEST_ORG_ID = TEST_ORG_ID;

  private static unifiedAddressGenerator = createDefaultAddressGenerator();
  private static paymentSender: MultiChainPaymentSender | null = null;

  private static getPaymentSender(): MultiChainPaymentSender {
    if (!this.paymentSender) {
      // Ensure MNEMONIC is set before creating payment sender
      if (!process.env.MNEMONIC) {
        process.env.MNEMONIC = TEST_MNEMONIC;
      }
      this.paymentSender = new MultiChainPaymentSender();
    }
    return this.paymentSender;
  }

  /**
   * Initialize address pool with test addresses
   *
   * @param processor - Processor instance
   * @param options - Configuration options
   * @param options.type - 'order' or 'deposit' (default: 'order')
   * @param options.chainConfig - Chain configuration (auto-detected if not provided)
   * @param options.count - Number of addresses to generate (default: 10)
   */
  static async initializeAddressPool(
    processor: Processor,
    options?: {
      type?: 'order' | 'deposit';
      chainConfig?: ChainTokenConfig;
      count?: number;
    }
  ): Promise<void> {
    const type = options?.type || 'order';
    const count = options?.count || 10;

    // Get chain config (either provided or auto-detect from environment)
    const chainConfig = options?.chainConfig || getTestChainConfig();
    const protocol = chainConfig.protocol;

    // Use UnifiedAddressGenerator to generate addresses for the specified protocol
    const generatedAddresses = this.unifiedAddressGenerator.generateAddresses(protocol, count, 1);

    // Get master public key from UnifiedAddressGenerator (only for EVM/Tron)
    const masterPublicKey = this.unifiedAddressGenerator.getMasterPublicKey(protocol);

    // Convert to processor format
    const addresses = generatedAddresses.map(addr => ({
      address: addr.address,
      derivationIndex: addr.derivationIndex,
      protocol: protocol,
      masterPublicKey,
      organizationId: ProcessorTestUtils.TEST_ORG_ID
    }));

    if (addresses.length > 0) {
      await processor.addAddressesToPool(addresses);
    }
  }

  /**
   * Send payment to an address
   *
   * @param params - Payment parameters
   * @param params.toAddress - Destination address
   * @param params.amount - Amount to send
   * @param params.token - Token symbol (e.g., 'USDC', 'USDT')
   * @param params.chain - Chain ID (e.g., 'ethereum-sepolia', 'solana-devnet')
   * @param params.chainConfig - Optional chain configuration (auto-detects protocol)
   */
  static async sendPayment(params: {
    toAddress: string;
    amount: string;
    token: string;
    chain: string;
    chainConfig?: ChainTokenConfig;
  }) {
    // Use chain from params or from chainConfig
    const chain = params.chainConfig?.chain || params.chain;
    return this.getPaymentSender().sendPayment(chain, params.toAddress, params.amount);
  }

  /**
   * Bind deposit address to a deposit reference
   */
  static async bindDepositAddress(
    processor: Processor,
    depositReference: string,
    protocol: 'evm' | 'tron' | 'solana' = 'evm'
  ) {
    return await processor.bindDepositAddress({
      depositReference,
      protocol,
      organizationId: ProcessorTestUtils.TEST_ORG_ID
    });
  }

  /**
   * Unbind deposit address from a deposit reference
   */
  static async unbindDepositAddress(
    processor: Processor,
    depositReference: string,
    protocol: 'evm' | 'tron' | 'solana' = 'evm'
  ) {
    await processor.unbindDepositAddress({
      depositReference,
      protocol,
      organizationId: ProcessorTestUtils.TEST_ORG_ID
    });
  }

  /**
   * Create a test order
   *
   * @param processor - Processor instance
   * @param amount - Order amount
   * @param options - Configuration options
   */
  static async createTestOrder(
    processor: Processor,
    amount: string,
    options?: 'evm' | 'tron' | { chain?: string; currency?: string; chainConfig?: ChainTokenConfig }
  ) {
    let chainId: string = 'ethereum-sepolia'; // Default to EVM
    let currency: string = 'USDC'; // Default to USDC

    if (typeof options === 'string') {
      // Legacy protocol parameter
      if (options === 'tron') {
        chainId = 'tron-nile';
      }
    } else if (options && typeof options === 'object') {
      // If chainConfig is provided, use it
      if (options.chainConfig) {
        chainId = options.chainConfig.chain;
        currency = options.chainConfig.token;
      } else {
        // Otherwise use individual chain/currency parameters
        if (options.chain) {
          chainId = options.chain;
        }
        if (options.currency) {
          currency = options.currency;
        }
      }
    }

    return await processor.createOrder({
      orderReference: `test-order-${Date.now()}`,
      amount: amount,
      currency: currency,
      chainId: chainId,
      organizationId: ProcessorTestUtils.TEST_ORG_ID,
    });
  }

  /**
   * Wait for order to reach expected status
   */
  static async waitForOrderStatus(
    processor: Processor,
    orderId: string,
    expectedStatus: string,
    maxWaitMs: number = 180000
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const order = await processor.getOrder(orderId);
      if (order && order.status === expectedStatus) return order;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Timeout waiting for order status ${expectedStatus}`);
  }

  /**
   * Get address pool availability statistics
   */
  static async getAddressPoolStats(processor: Processor, protocol: 'evm' | 'tron' = 'evm') {
    return await processor.getAddressPoolAvailability(protocol);
  }

  /**
   * Wait for transfers to be confirmed
   */
  static async waitForTransfersConfirmed(
    processor: Processor,
    reference: { orderId?: string, depositReference?: string },
    expectedCount: number,
    maxWaitMs: number = 30000
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const transfers = await processor.getTransfers(reference);

      if (transfers && transfers.length >= expectedCount && transfers.every(t => t.is_confirmed)) {
        return transfers;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const refKey = reference.orderId ? `orderId: ${reference.orderId}` : `depositReference: ${reference.depositReference}`;
    throw new Error(`Timeout waiting for ${expectedCount} transfers to be confirmed for ${refKey}.`);
  }

  /**
   * Check if two amounts are equal within tolerance
   */
  static isAmountEqual(amount1: string, amount2: string, tolerance: number = 0.000001): boolean {
    const diff = Math.abs(parseFloat(amount1) - parseFloat(amount2));
    return diff <= tolerance;
  }

  /**
   * Get user deposit address
   */
  static async getUserDepositAddress(
    processor: Processor,
    depositReference: string,
    protocol: 'evm' | 'tron' | 'solana' = 'evm'
  ) {
    return await processor.getUserDepositAddress(depositReference, protocol);
  }

  /**
   * Set up event listener on processor
   */
  static setupEventListener(
    processor: Processor,
    eventName: string,
    callback: (event: any) => void
  ): () => void {
    const eventBus = (processor as any).processorCore?.getEventBus();
    if (!eventBus) {
      throw new Error('Processor core not initialized');
    }
    eventBus.on(eventName, callback);
    return () => eventBus.off(eventName, callback);
  }

  /**
   * Clean up global resources
   */
  static async cleanup() {
    if ((globalThis as any).__payinRPCManager) {
      await (globalThis as any).__payinRPCManager.stop();
      delete (globalThis as any).__payinRPCManager;
    }
  }

  /**
   * Wait for recovery to complete
   */
  static async waitForRecovery(processor: Processor, maxWaitMs = 120000): Promise<void> {
    const startTime = Date.now();
    const pollIntervalMs = 100;
    this.log('info', '⏳ Waiting for recovery to complete by polling...');

    while ((processor as any).processorCore?.getSystemStatus().isRecovering) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Timeout waiting for recovery completion after ${maxWaitMs}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    this.log('info', '✅ Recovery completed, isRecovering flag is now false.');
  }

  /**
   * Initialize database schema for test suite
   */
  static async initializeTestSuiteDatabase(): Promise<void> {
    if (process.env.SKIP_INIT_DB === 'true') {
      this.log('info', 'SKIP_INIT_DB is true, skipping database initialization.');
      return;
    }

    this.log('info', '🔄 Initializing database schema for the suite...');
    let tempProcessor: Processor | null = null;
    try {
      tempProcessor = await createTestProcessor();
      await tempProcessor.start();
      // The actual schema drop and create happens here
      await tempProcessor.initializeDatabaseSchema({ dropExisting: true, force: true });
      this.log('info', '✅ Database schema initialized.');
    } catch (error) {
      this.log('error', `Database initialization failed: ${(error as Error).message}`);
      throw error; // Re-throw to fail the test suite
    } finally {
      if (tempProcessor) {
        await tempProcessor.stop();
      }
      await this.cleanup();
    }
  }

  /**
   * Log helper
   */
  static log(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  /**
   * Set up test environment
   * - Database connection
   * - Test mnemonic (hardcoded, only has testnet funds)
   * - Optional schema for test isolation
   */
  static setupTestDatabase(schema?: string): void {
    // Set test database connection
    let dbUrl = TEST_DATABASE_URL;

    // If schema is provided, append it to DATABASE_URL
    if (schema) {
      process.env.DATABASE_SCHEMA = schema;
      this.log('info', `🔑 Test environment configured with schema: ${schema}`);
    } else {
      this.log('info', '🔑 Test environment configured');
    }

    process.env.DATABASE_URL = dbUrl;

    // Set test mnemonic
    process.env.MNEMONIC = TEST_MNEMONIC;
  }

  /**
   * Create a test schema manager for isolated testing
   */
  static createSchemaManager(schema?: string): TestSchemaManager {
    return new TestSchemaManager({
      connectionString: TEST_DATABASE_URL,
      schema: schema || TestSchemaManager.generateSchemaName('test')
    });
  }
}
