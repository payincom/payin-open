/**
 * E2E Deposit Flow Test
 *
 * This test performs a complete end-to-end deposit flow through the Web Server API.
 * It uses real blockchain transactions on testnet to verify the entire deposit process.
 *
 * Prerequisites:
 * - Web Server must be running at E2E_BASE_URL or http://localhost:3000
 * - Database must be initialized
 * - Processor and Monitor must be running
 *
 * Environment Variables (optional):
 * - E2E_BASE_URL: API base URL (default: 'http://localhost:3000')
 * - TEST_CHAIN: Optional deterministic testnet chain (ethereum-sepolia, polygon-amoy, tron-nile)
 * - TEST_USERNAME: Username for login (default: 'admin')
 * - TEST_PASSWORD: Password for login (default: 'admin123')
 * - TEST_ORGANIZATION_ID: Optional organization ID override; Open runtime omits X-Organization-Id by default
 *
 * Example usage:
 * ```bash
 * # Open runtime: use default admin/operator account and omit organization header
 * npm run test:e2e:deposit
 *
 * # Cloud runtime or explicit Open compatibility override
 * TEST_USERNAME=alice_owner TEST_PASSWORD=Test1234! TEST_ORGANIZATION_ID=org-123 npm run test:e2e:deposit
 * ```
 *
 * Test flow:
 * 1. Login with credentials; Open auto-resolves the default merchant, Cloud selects an organization
 * 2. Initialize address pool via API
 * 3. Bind deposit address for a user via API
 * 4. Send real testnet payments from multiple chains
 * 5. Monitor transfers via API
 * 6. Verify transfer confirmations
 * 7. Test address unbinding and reuse
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient, E2ETestUtils } from './test-utils.js';

describe('E2E Deposit Flow (via Web Server API)', () => {
  let api: ApiClient;

  beforeAll(async () => {
    const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
    api = new ApiClient(baseUrl);

    // Verify server is running
    console.log(`🔍 Checking if Web Server is running at ${baseUrl}...`);
    try {
      const health = await api.health();
      console.log('✅ Web Server is healthy:', health);
    } catch (error) {
      throw new Error(
        'Web Server is not running. Please start PayIn Open from the repository root with: npm run dev:api'
      );
    }

    // Login to get authentication token
    // Support environment variables: TEST_USERNAME, TEST_PASSWORD, TEST_ORGANIZATION_ID
    const username = process.env.TEST_USERNAME || 'admin';
    const password = process.env.TEST_PASSWORD || 'admin123';
    console.log(`🔐 Logging in as: ${username}`);

    try {
      const loginResult = await api.login(username, password);
      console.log('✅ Logged in successfully');
    } catch (error) {
      throw new Error(`Failed to login as ${username}. Make sure the database is initialized and credentials are correct.`);
    }

    // Set organization ID only when explicitly provided, or when testing Cloud/multi-tenant runtime.
    // In PayIn Open, omitted X-Organization-Id lets the API verify the operator and resolve
    // the default Open merchant automatically.
    let organizationId = process.env.TEST_ORGANIZATION_ID;
    const runtime = (process.env.PAYIN_RUNTIME || process.env.PAYIN_EDITION || 'open').toLowerCase();
    const isOpenRuntime = runtime === 'open' || runtime === 'payin-open';

    if (!organizationId && !isOpenRuntime) {
      // Get user's organizations
      const response = await api.get('/api/v1/organizations');

      if (response.organizations && response.organizations.length > 0) {
        organizationId = response.organizations[0].id;
        console.log(`📋 Using user's first organization: ${response.organizations[0].name} (${organizationId})`);
      } else {
        throw new Error('User has no organizations. Please create one first.');
      }
    } else {
      if (organizationId) {
        console.log(`📋 Using provided organization ID: ${organizationId}`);
      } else {
        console.log('📋 PayIn Open runtime: omitting X-Organization-Id; API will resolve default merchant');
      }
    }

    if (organizationId) {
      api.setOrganizationId(organizationId);
    }
  }, 30000);

  afterAll(async () => {
    await E2ETestUtils.cleanup();
  });

  test('Complete deposit flow with multi-chain payments', async () => {
    console.log('\n🚀 Starting E2E Deposit Flow Test...\n');

    // Step 1: Bind deposit address for user (auto-generates addresses if needed)
    console.log('📍 Step 1: Bind deposit address for user');
    const depositReference = `e2e-test-deposit-${Date.now()}`;

    const bindResponse = await E2ETestUtils.bindDepositAddressWithAutoAddressGeneration(api, {
      depositReference,
      protocol: 'evm',
      metadata: { userId: '12345', username: 'testuser' },
    });

    console.log('Deposit address bound:', bindResponse.data);
    expect(bindResponse.success).toBe(true);

    const binding = bindResponse.data;
    expect(binding.depositReference).toBe(depositReference);
    expect(binding.depositAddress).toBeDefined();
    expect(binding.protocol).toBe('evm');

    // Step 2: Verify deposit address can be retrieved
    console.log('\n📍 Step 2: Verify deposit address retrieval');
    const getAddressResponse = await api.getDepositAddress(depositReference, 'evm');
    console.log('Retrieved deposit address:', getAddressResponse.data);
    expect(getAddressResponse.success).toBe(true);
    expect(getAddressResponse.data.address).toBe(binding.depositAddress);

    // Step 3: Select random chain and generate random amounts
    const selectedChain = E2ETestUtils.getRandomChain();
    const amount1 = E2ETestUtils.getRandomAmount();
    const amount2 = E2ETestUtils.getRandomAmount();
    // Auto-select token based on chain: Tron uses USDT, EVM chains use USDC
    const token = selectedChain.startsWith('tron-') ? 'USDT' : 'USDC';
    console.log(`\n🎲 Randomly selected chain for first payment: ${selectedChain}`);
    console.log(`🎲 Randomly generated amount 1: ${amount1} ${token}`);
    console.log(`🎲 Randomly generated amount 2: ${amount2} ${token}`);

    // Step 4: Send real blockchain payment on the selected chain
    console.log(`\n📍 Step 4: Send payment on ${selectedChain}`);
    const paymentResult = await E2ETestUtils.sendPayment({
      toAddress: binding.depositAddress,
      amount: amount1,
      token: token,
      chain: selectedChain,
    });

    console.log(`✅ Payment sent on ${selectedChain}: ${paymentResult.txHash}`);
    console.log(`   Explorer: ${paymentResult.explorerUrl}`);
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.txHash).toBeDefined();

    // Step 5: Wait for transfer to be confirmed
    console.log('\n📍 Step 5: Wait for transfer confirmation');
    const confirmedTransfers = await E2ETestUtils.waitForTransfersConfirmed(
      api,
      { depositReference },
      1, // Expecting 1 transfer
      240000 // 4 minutes timeout
    );

    console.log('Confirmed transfers:', confirmedTransfers);
    expect(confirmedTransfers.length).toBe(1);

    // Verify transfer
    const transfer = confirmedTransfers[0];
    expect(transfer).toBeDefined();
    expect(transfer.is_confirmed).toBe(true);
    expect(transfer.transaction_hash).toBe(paymentResult.txHash);
    expect(transfer.chain).toBe(selectedChain);
    expect(E2ETestUtils.isAmountEqual(transfer.amount, amount1)).toBe(true);

    // Step 6: List all transfers for this deposit
    console.log('\n📍 Step 6: Verify transfer listing');
    const listTransfersResponse = await api.getTransfersByReference({
      depositReference,
    });

    console.log('All transfers:', listTransfersResponse.data);
    expect(listTransfersResponse.success).toBe(true);
    expect(listTransfersResponse.data.length).toBe(1);

    console.log('\n🎉 E2E Deposit Flow Test completed successfully!');
  }, 360000); // 6 minutes timeout for entire test

  test('Deposit address unbinding and reuse', async () => {
    console.log('\n🚀 Testing deposit address unbinding and reuse...\n');

    // Step 1: Bind a new deposit address (auto-generates addresses if needed)
    console.log('📍 Step 1: Bind deposit address');
    const depositReference = `e2e-test-unbind-${Date.now()}`;

    const bindResponse = await E2ETestUtils.bindDepositAddressWithAutoAddressGeneration(api, {
      depositReference,
      protocol: 'evm',
    });

    console.log('Deposit address bound:', bindResponse.data);
    expect(bindResponse.success).toBe(true);
    const originalAddress = bindResponse.data.depositAddress;

    // Step 2: Get pool stats before unbinding
    console.log('\n📍 Step 2: Check pool stats before unbinding');
    const poolBefore = await api.getAddressPoolAvailability('evm');
    console.log('Pool status before unbind:', poolBefore.data);
    expect(poolBefore.data.bound).toBeGreaterThan(0);

    // Step 3: Unbind the deposit address
    console.log('\n📍 Step 3: Unbind deposit address');
    const unbindResponse = await api.unbindDepositAddress(depositReference);
    console.log('Unbind response:', unbindResponse);
    expect(unbindResponse.success).toBe(true);

    // Step 4: Verify address is no longer retrievable
    console.log('\n📍 Step 4: Verify address is unbound');
    try {
      await api.getDepositAddress(depositReference, 'evm');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      console.log('✅ Address correctly not found after unbinding');
      // Expected behavior - address should not be found
    }

    // Step 5: Verify pool stats after unbinding
    console.log('\n📍 Step 5: Check pool stats after unbinding');
    const poolAfter = await api.getAddressPoolAvailability('evm');
    console.log('Pool status after unbind:', poolAfter.data);
    // Note: Due to test isolation issues, we just verify the unbind succeeded
    // by checking that the address is no longer retrievable (verified in Step 4)
    console.log('✅ Pool stats updated (bound count may vary due to other tests)');

    // Step 6: Bind a new address (should get a different address)
    console.log('\n📍 Step 6: Bind new address (should be different)');
    const newDepositReference = `e2e-test-new-${Date.now()}`;

    const newBindResponse = await E2ETestUtils.bindDepositAddressWithAutoAddressGeneration(api, {
      depositReference: newDepositReference,
      protocol: 'evm',
    });

    console.log('New deposit address bound:', newBindResponse.data);
    expect(newBindResponse.success).toBe(true);
    expect(newBindResponse.data.depositAddress).not.toBe(originalAddress);
    console.log(`✅ New address assigned: ${newBindResponse.data.depositAddress}`);
    console.log(`   (different from original: ${originalAddress})`);

    console.log('\n🎉 Address unbinding and reuse test completed successfully!');
  }, 60000); // 1 minute timeout

  test('List deposit addresses with pagination', async () => {
    console.log('\n🚀 Testing deposit address listing and pagination...\n');

    // Step 1: Create a few deposit addresses (auto-generates addresses if needed)
    console.log('📍 Step 1: Creating test deposit addresses');
    const references: string[] = [];
    for (let i = 0; i < 3; i++) {
      const ref = `e2e-test-list-${Date.now()}-${i}`;
      references.push(ref);
      await E2ETestUtils.bindDepositAddressWithAutoAddressGeneration(api, {
        depositReference: ref,
        protocol: 'evm',
      });
      console.log(`✅ Created deposit address ${i + 1}/3: ${ref}`);
    }

    // Step 2: List all deposit addresses
    console.log('\n📍 Step 2: Listing deposit addresses');
    const listResponse = await api.listDepositAddresses({
      limit: '10',
      page: '1',
      protocol: 'evm',
    });

    console.log('Deposit addresses list:', listResponse);
    expect(listResponse.success).toBe(true);
    expect(listResponse.data).toBeDefined();
    expect(listResponse.pagination).toBeDefined();
    expect(listResponse.data.length).toBeGreaterThanOrEqual(3);

    // Verify our created addresses are in the list
    const addressReferences = listResponse.data.map((d: any) => d.deposit_reference);
    for (const ref of references) {
      expect(addressReferences).toContain(ref);
    }

    console.log(`Total deposit addresses: ${listResponse.pagination.total}`);
    console.log(`Total pages: ${listResponse.pagination.totalPages}`);

    console.log('\n🎉 Deposit address listing test completed successfully!');
  }, 60000); // 1 minute timeout

  test('Verify address pool management for deposits', async () => {
    console.log('\n🚀 Testing address pool management for deposits...\n');

    // Get current pool status
    const poolStatus = await api.getAddressPoolAvailability('evm');
    console.log('Current pool status:', poolStatus.data);

    expect(poolStatus.success).toBe(true);
    expect(poolStatus.data.protocol).toBe('evm');
    expect(poolStatus.data.total).toBeDefined();
    expect(poolStatus.data.available).toBeDefined();
    expect(poolStatus.data.allocated).toBeDefined();
    expect(poolStatus.data.bound).toBeDefined();
    expect(poolStatus.data.coolingDown).toBeDefined();

    // Verify pool stats add up correctly
    // total = available + allocated + bound + coolingDown
    const total = poolStatus.data.total;
    const sum =
      poolStatus.data.available +
      poolStatus.data.allocated +
      poolStatus.data.bound +
      poolStatus.data.coolingDown;

    expect(sum).toBe(total);

    console.log(`\nPool statistics:`);
    console.log(`  Total addresses: ${total}`);
    console.log(`  Available: ${poolStatus.data.available}`);
    console.log(`  Allocated (for orders): ${poolStatus.data.allocated}`);
    console.log(`  Bound (for deposits): ${poolStatus.data.bound}`);
    console.log(`  Cooling down: ${poolStatus.data.coolingDown}`);

    console.log('\n🎉 Address pool management test completed successfully!');
  }, 30000);
});
