/**
 * Dual Business Recovery Test - Schema Isolated
 *
 * This test uses schema isolation to avoid interfering with other tests.
 * Tests recovery of offline transactions for both orders and deposits.
 *
 * Usage:
 * - Random chain: npx vitest run tests/scenarios/dual-business-recovery.test.ts
 * - Specific chain: TEST_CHAIN=ethereum-sepolia npx vitest run tests/scenarios/dual-business-recovery.test.ts
 * - Specific protocol: TEST_PROTOCOL=solana npx vitest run tests/scenarios/dual-business-recovery.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestProcessor,
  ProcessorTestUtils as TestUtils,
  getTestChainConfig,
} from '@payin/test-utils/processor';
import { Processor } from '../../src';
import { TestSchemaManager } from '@payin/test-utils/database';

describe('Dual Business Recovery Test (Schema Isolated)', () => {
  let schemaManager: TestSchemaManager;
  let testSchema: string;

  // Get chain configuration - will be random or from environment variables
  const chainConfig = getTestChainConfig();

  console.log(`\n🎲 Selected chain configuration:`);
  console.log(`   Chain: ${chainConfig.chain}`);
  console.log(`   Token: ${chainConfig.token}`);
  console.log(`   Protocol: ${chainConfig.protocol}\n`);

  beforeAll(async () => {
    // Create isolated test schema
    testSchema = TestSchemaManager.generateSchemaName('dual_recovery');
    schemaManager = TestUtils.createSchemaManager(testSchema);
    await schemaManager.initializeSchema();
    console.log(`✅ Created test schema: ${testSchema}`);

    // Create test organization
    await schemaManager.createTestOrganization(TestUtils.TEST_ORG_ID);
    console.log(`✅ Test organization created: ${TestUtils.TEST_ORG_ID}`);
  }, 120000);

  afterAll(async () => {
    // Clean up test schema
    if (schemaManager) {
      await schemaManager.dropSchema();
      await schemaManager.close();
      console.log(`✅ Cleaned up test schema: ${testSchema}`);
    }
    await TestUtils.cleanup();
  });

  test(`Complete ${chainConfig.chain}+${chainConfig.token} dual business recovery`, async () => {
    console.log(`\n🧪 Starting ${chainConfig.protocol.toUpperCase()} full end-to-end recovery and post-recovery test...\n`);
    let onlineProcessor: Processor | null = null;
    let recoveryProcessor: Processor | null = null;

    try {
      // ========== Phase 1: Setup, Pre-populate Pool, and Go Offline ==========
      console.log('--- Phase 1: Setup and Go Offline ---');
      onlineProcessor = await createTestProcessor({ skipMonitorRecovery: true }, testSchema);
      await onlineProcessor.start();

      // Initialize address pool with chain configuration
      await TestUtils.initializeAddressPool(onlineProcessor, { chainConfig });

      // Create order with chain configuration
      const offlineOrder = await TestUtils.createTestOrder(onlineProcessor, '0.050000', { chainConfig });
      console.log(`📝 Created offline order: ${offlineOrder.orderId}`);

      const depositReference = `dual_recovery_${Date.now()}`;
      const depositBinding = await TestUtils.bindDepositAddress(onlineProcessor, depositReference, chainConfig.protocol);
      console.log(`📍 Bound deposit address: ${depositBinding.depositAddress}`);

      // Wait a moment for everything to settle
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get current block heights
      const currentBlocks = await onlineProcessor.getDatabase().query(`SELECT chain, latest_processed_block FROM chain_blocks`);
      console.log('📊 Current block heights:', currentBlocks);

      // Stop processor (simulate going offline)
      await onlineProcessor.stop();
      await TestUtils.cleanup();
      onlineProcessor = null;
      console.log('✅ Online processor stopped. System is now "offline".\n');

      // ========== Phase 2: Simulate Offline Payments ==========
      console.log('--- Phase 2: Simulating Offline Payments ---');
      console.log('💸 Sending offline payments...');

      // Send payment to order address
      await TestUtils.sendPayment({
        toAddress: offlineOrder.paymentAddress,
        amount: '0.050000',
        token: chainConfig.token,
        chain: chainConfig.chain,
        chainConfig
      });

      // Send first deposit payment
      await TestUtils.sendPayment({
        toAddress: depositBinding.depositAddress,
        amount: '0.030000',
        token: chainConfig.token,
        chain: chainConfig.chain,
        chainConfig
      });

      // For EVM protocols, send a second deposit on a different chain within the same protocol
      // For Solana, send a second deposit on the same chain
      if (chainConfig.protocol === 'solana') {
        await TestUtils.sendPayment({
          toAddress: depositBinding.depositAddress,
          amount: '0.020000',
          token: chainConfig.token,
          chain: chainConfig.chain,
          chainConfig
        });
      } else {
        // For EVM, use a different chain within the protocol
        const secondChain = chainConfig.chain === 'ethereum-sepolia' ? 'polygon-amoy' : 'ethereum-sepolia';
        await TestUtils.sendPayment({
          toAddress: depositBinding.depositAddress,
          amount: '0.020000',
          token: chainConfig.token,
          chain: secondChain,
          chainConfig: { ...chainConfig, chain: secondChain }
        });
      }

      // Wait for transactions to be mined
      console.log('⏳ Waiting for transactions to be mined...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      console.log('✅ Offline payments have been sent.\n');

      // ========== Phase 3: Recovery ==========
      console.log('--- Phase 3: Starting Recovery ---');

      const recoveryConfig: ProcessorConfig = {
        skipMonitorRecovery: false,
        monitor: {
          chains: ['ethereum-sepolia', 'polygon-amoy', 'tron-nile', 'solana-devnet'],
          chainSettings: {
            'polygon-amoy': {
              batchSize: 50,
            },
          },
        },
      };

      recoveryProcessor = await createTestProcessor(recoveryConfig, testSchema);

      await recoveryProcessor.start();
      console.log('🚀 Recovery processor started. Waiting for recovery to complete...');

      await TestUtils.waitForRecovery(recoveryProcessor, 180000); // Increased timeout to 3 minutes

      // ========== Phase 4: Verify Recovered Data ==========
      console.log('\n--- Phase 4: Verifying Recovered Data ---');
      const orderConfirmationPromise = TestUtils.waitForTransfersConfirmed(recoveryProcessor, { orderId: offlineOrder.orderId }, 1);
      const depositConfirmationPromise = TestUtils.waitForTransfersConfirmed(recoveryProcessor, { depositReference }, 2);

      await Promise.all([orderConfirmationPromise, depositConfirmationPromise]);
      console.log('🎉 Both offline order and deposit transfers confirmed in database!');

      // Verify order status
      const finalDb = recoveryProcessor.getDatabase();
      const finalOrder = await finalDb.query(`SELECT status FROM orders WHERE id = $1`, [offlineOrder.orderId]);
      expect(finalOrder[0]?.status).toBe('completed');
      console.log('✅ Offline order status is COMPLETED.');

      // ========== Phase 5: Process New Order on the SAME Recovered System ==========
      console.log('\n--- Phase 5: Processing New Order on the SAME Recovered System ---');

      const newOrderAmount = '0.015000';
      const newOrder = await TestUtils.createTestOrder(recoveryProcessor, newOrderAmount, { chainConfig });
      console.log(`📝 Created new order ${newOrder.orderId} for ${newOrderAmount} ${chainConfig.token}.`);

      await TestUtils.sendPayment({
        toAddress: newOrder.paymentAddress,
        amount: newOrderAmount,
        token: chainConfig.token,
        chain: chainConfig.chain,
        chainConfig
      });
      console.log(`💸 Sent payment for new order. Waiting for completion...`);

      const finalNewOrder = await TestUtils.waitForOrderStatus(recoveryProcessor, newOrder.orderId, 'completed', 180000);
      console.log(`🎉 New order ${newOrder.orderId} has been successfully completed.`);

      expect(finalNewOrder.status).toBe('completed');
      expect(TestUtils.isAmountEqual(finalNewOrder.confirmed_received, newOrderAmount)).toBe(true);
      console.log('✅ Assertions passed: New order processed correctly post-recovery.\n');

    } finally {
      console.log('🧹 Final cleanup for the entire test scenario...');
      if (onlineProcessor) await onlineProcessor.stop();
      if (recoveryProcessor) await recoveryProcessor.stop();
      await TestUtils.cleanup();
      console.log('✅ Test environment cleaned.');
    }
  }, 600000);
});
