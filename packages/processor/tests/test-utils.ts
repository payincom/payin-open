/**
 * Test Utils - Final Refactoring with Fast Confirmation Interval
 *
 * This module provides test utilities with hardcoded test credentials:
 * - TEST_MNEMONIC: Hardcoded test mnemonic (only contains testnet funds, safe to commit)
 * - Auto-configures environment variables for testing
 * - No need to set .env or environment variables manually
 */

import { Processor, type ProcessorConfig } from '../src/processor.js';
import { MultiChainAddressGenerator } from '../../../tools/generate-multichain-addresses.js';
import { MultiChainPaymentSender } from '../../../tools/send-multichain-payment.js';
import { TestSchemaManager } from '@payin/test-utils/database';

// A stateless factory function to create a fresh processor for each test
export async function createTestProcessor(config: ProcessorConfig = {}, schema?: string): Promise<Processor> {
  console.log('🔧 Creating new Processor instance for test...');

  // Set up test database connection
  TestUtils.setupTestDatabase(schema);

  // Merge test RPC keys with provided config
  const testConfig: ProcessorConfig = {
    ...config,
    monitor: {
      ...config.monitor,
      rpcKeys: {
        alchemy: 'your_alchemy_key',
        infura: 'your_infura_key',
        trongrid: 'your_trongrid_key',
        ankr: 'your_helius_key',
        ...config.monitor?.rpcKeys
      }
    }
  };

  // Create processor with test config + test.yaml file
  const processor = await Processor.create(testConfig, 'test.yaml');
  console.log('✅ New Processor instance created.');
  return processor;
}

// Test MNEMONIC (hardcoded - only contains testnet funds, safe to commit)
const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate';

// A stateless utility class
export class TestUtils {
  // Test organization ID for single-org tests
  static readonly TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

  private static addressGenerator = new MultiChainAddressGenerator(TEST_MNEMONIC);
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

  static async initializeAddressPool(processor: Processor, type: 'order' | 'deposit' = 'order'): Promise<void> {
    const masterPublicKey = this.addressGenerator.getMasterPublicKey();
    const addresses = [];
    for (let i = 1; i < 10; i++) {
      const result = this.addressGenerator.getAddress('ethereum-sepolia', i);
      if(result) addresses.push({
        address: result.address,
        derivationIndex: i,
        protocol: 'evm' as const,
        masterPublicKey,
        organizationId: TestUtils.TEST_ORG_ID
      });
    }
    if (addresses.length > 0) await processor.addAddressesToPool(addresses);
  }

  static async sendPayment(params: { toAddress: string; amount: string; token: string; chain: string; }) {
    return this.getPaymentSender().sendPayment(params.chain, params.toAddress, params.amount);
  }

  static async bindDepositAddress(processor: Processor, depositReference: string, protocol: 'evm' | 'tron' = 'evm') {
    return await processor.bindDepositAddress({ depositReference, protocol });
  }

  static async unbindDepositAddress(processor: Processor, depositReference: string, protocol: 'evm' | 'tron' = 'evm') {
    await processor.unbindDepositAddress({ depositReference, protocol });
  }

  static async createTestOrder(
    processor: Processor,
    amount: string,
    options?: 'evm' | 'tron' | { chain?: string; currency?: string }
  ) {
    let chainId: string = 'ethereum-sepolia'; // Default to EVM
    let currency: string = 'USDC'; // Default to USDC

    if (typeof options === 'string') {
      // Legacy protocol parameter
      if (options === 'tron') {
        chainId = 'tron-nile';
      }
    } else if (options && typeof options === 'object') {
      // New object-based options
      if (options.chain) {
        chainId = options.chain;
      }
      if (options.currency) {
        currency = options.currency;
      }
    }

    return await processor.createOrder({
      orderReference: `test-order-${Date.now()}`,
      amount: amount,
      currency: currency,
      chainId: chainId,
      organizationId: TestUtils.TEST_ORG_ID,
    });
  }

  static async waitForOrderStatus(processor: Processor, orderId: string, expectedStatus: string, maxWaitMs: number = 180000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const order = await processor.getOrder(orderId);
      if (order && order.status === expectedStatus) return order;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Timeout waiting for order status ${expectedStatus}`);
  }

  static async getAddressPoolStats(processor: Processor, protocol: 'evm' | 'tron' = 'evm') {
      return await processor.getAddressPoolAvailability(protocol);
  }

  static async waitForTransfersConfirmed(processor: Processor, reference: { orderId?: string, depositReference?: string }, expectedCount: number, maxWaitMs: number = 30000) {
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

  static isAmountEqual(amount1: string, amount2: string, tolerance: number = 0.000001): boolean {
    const diff = Math.abs(parseFloat(amount1) - parseFloat(amount2));
    return diff <= tolerance;
  }

  static async getUserDepositAddress(processor: Processor, depositReference: string, protocol: 'evm' | 'tron' = 'evm') {
      return await processor.getUserDepositAddress(depositReference, protocol);
  }

  static setupEventListener(processor: Processor, eventName: string, callback: (event: any) => void): () => void {
    const eventBus = (processor as any).processorCore?.getEventBus();
    if (!eventBus) {
      throw new Error('Processor core not initialized');
    }
    eventBus.on(eventName, callback);
    return () => eventBus.off(eventName, callback);
  }

  static async cleanup() {
    if ((globalThis as any).__payinRPCManager) {
      await (globalThis as any).__payinRPCManager.stop();
      delete (globalThis as any).__payinRPCManager;
    }
  }

  static async waitForRecovery(processor: Processor, maxWaitMs = 60000): Promise<void> {
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
      this.log('error', `Database initialization failed: ${error.message}`);
      throw error; // Re-throw to fail the test suite
    } finally {
      if (tempProcessor) {
        await tempProcessor.stop();
      }
      await this.cleanup();
    }
  }

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
    // Set test database connection - supports env override
    let dbUrl = process.env.DB_CONNECTION_STRING
      || process.env.TEST_DATABASE_URL
      || 'postgresql://postgres:postgres@localhost:5432/payin_test';

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
    const dbUrl = process.env.DB_CONNECTION_STRING
      || process.env.TEST_DATABASE_URL
      || 'postgresql://postgres:postgres@localhost:5432/payin_test';
    return new TestSchemaManager({
      connectionString: dbUrl,
      schema: schema || TestSchemaManager.generateSchemaName('test')
    });
  }
}
