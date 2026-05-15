/**
 * E2E Order Payment Test
 *
 * This test performs a complete end-to-end order payment flow through the Web Server API.
 * It uses real blockchain transactions on testnet to verify the entire payment process.
 *
 * Prerequisites:
 * - Web Server must be running at http://localhost:3000
 * - Database must be initialized
 * - Processor and Monitor must be running
 *
 * Test flow:
 * 1. Initialize address pool via API
 * 2. Create order via API
 * 3. Send real testnet payment
 * 4. Monitor order status via API
 * 5. Verify order completion and transfer confirmation
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient, E2ETestUtils } from './test-utils.js';
describe('E2E Order Payment Flow (via Web Server API)', () => {
    let api;
    beforeAll(async () => {
        api = new ApiClient('http://localhost:3000');
        // Verify server is running
        console.log('🔍 Checking if Web Server is running...');
        try {
            const health = await api.health();
            console.log('✅ Web Server is healthy:', health);
        }
        catch (error) {
            throw new Error('Web Server is not running. Please start it with: cd app && npm run dev');
        }
        // Login to get authentication token
        console.log('🔐 Logging in...');
        try {
            const loginResult = await api.login('admin', 'admin123');
            console.log('✅ Logged in successfully');
        }
        catch (error) {
            throw new Error('Failed to login. Make sure the database is initialized.');
        }
    }, 30000);
    afterAll(async () => {
        await E2ETestUtils.cleanup();
    });
    test('Complete order payment flow with real blockchain transaction', async () => {
        console.log('\n🚀 Starting E2E Order Payment Test...\n');
        // Step 1: Select random chain and generate random amount
        console.log('📍 Step 1: Select random chain and amount');
        const selectedChain = E2ETestUtils.getRandomChain();
        const orderAmount = E2ETestUtils.getRandomAmount();
        // Auto-select token based on chain: Tron uses USDT, EVM chains use USDC
        const token = selectedChain.startsWith('tron-') ? 'USDT' : 'USDC';
        console.log(`🎲 Randomly selected chain: ${selectedChain}`);
        console.log(`🎲 Randomly generated amount: ${orderAmount} ${token}`);
        // Step 2: Create order (with automatic address generation on shortage)
        console.log('\n📍 Step 2: Create order');
        const orderReference = `e2e-test-order-${Date.now()}`;
        const createOrderResponse = await E2ETestUtils.createOrderWithAutoAddressGeneration(api, {
            orderReference,
            amount: orderAmount,
            currency: token,
            chainId: selectedChain,
            callbackUrl: 'https://example.com/callback',
        });
        console.log('Order created:', createOrderResponse.data);
        expect(createOrderResponse.success).toBe(true);
        const order = createOrderResponse.data;
        expect(order.orderId).toBeDefined();
        expect(order.paymentAddress).toBeDefined();
        expect(order.status).toBe('pending');
        expect(order.amount).toBe(orderAmount);
        // Step 3: Verify order can be retrieved
        console.log('\n📍 Step 3: Verify order retrieval');
        const getOrderResponse = await api.getOrder(order.orderId);
        console.log('Retrieved order:', getOrderResponse.data);
        expect(getOrderResponse.success).toBe(true);
        expect(getOrderResponse.data.id).toBe(order.orderId);
        // Step 4: Send real blockchain payment on the selected chain
        console.log(`\n📍 Step 4: Send real blockchain payment on ${selectedChain}`);
        const paymentResult = await E2ETestUtils.sendPayment({
            toAddress: order.paymentAddress,
            amount: orderAmount,
            token: token,
            chain: selectedChain,
        });
        console.log(`Transaction sent: ${paymentResult.txHash}`);
        console.log(`Explorer URL: ${paymentResult.explorerUrl}`);
        expect(paymentResult.success).toBe(true);
        expect(paymentResult.txHash).toBeDefined();
        // Step 5: Wait for order completion
        console.log('\n📍 Step 5: Wait for order completion');
        const completedOrder = await E2ETestUtils.waitForOrderStatus(api, order.orderId, 'completed', 180000 // 3 minutes timeout
        );
        console.log('Order completed:', completedOrder);
        expect(completedOrder.status).toBe('completed');
        expect(completedOrder.completed_at).toBeDefined();
        // Step 6: Verify transfers
        console.log('\n📍 Step 6: Verify transfers');
        const transfersResponse = await api.getTransfersByReference({
            orderId: order.orderId,
        });
        console.log('Transfers:', transfersResponse.data);
        expect(transfersResponse.success).toBe(true);
        expect(transfersResponse.data.length).toBeGreaterThan(0);
        const transfer = transfersResponse.data[0];
        expect(transfer.is_confirmed).toBe(true);
        expect(transfer.transaction_hash).toBe(paymentResult.txHash);
        expect(transfer.chain).toBe(selectedChain);
        expect(E2ETestUtils.isAmountEqual(transfer.amount, orderAmount)).toBe(true);
        // Step 7: Verify order statistics
        console.log('\n📍 Step 7: Verify order statistics');
        const statsResponse = await api.getOrderStats();
        console.log('Order statistics:', statsResponse.data);
        expect(statsResponse.success).toBe(true);
        expect(statsResponse.data.totalOrders).toBeGreaterThan(0);
        expect(statsResponse.data.completedOrders).toBeGreaterThan(0);
        console.log('\n🎉 E2E Order Payment Test completed successfully!');
    }, 300000); // 5 minutes timeout for entire test
    test('List orders and verify pagination', async () => {
        console.log('\n🚀 Testing order listing and pagination...\n');
        const listResponse = await api.listOrders({ limit: '10', page: '1' });
        console.log('Orders list:', listResponse);
        expect(listResponse.success).toBe(true);
        expect(listResponse.data).toBeDefined();
        expect(listResponse.pagination).toBeDefined();
        expect(listResponse.pagination.page).toBe(1);
        expect(listResponse.pagination.limit).toBe(10);
        console.log(`Total orders: ${listResponse.pagination.total}`);
        console.log(`Total pages: ${listResponse.pagination.totalPages}`);
    }, 30000);
    test('Verify address pool management', async () => {
        console.log('\n🚀 Testing address pool management...\n');
        // Get current pool status
        const poolStatus = await api.getAddressPoolAvailability('evm');
        console.log('Current pool status:', poolStatus.data);
        expect(poolStatus.success).toBe(true);
        expect(poolStatus.data.protocol).toBe('evm');
        expect(poolStatus.data.total).toBeDefined();
        console.log(`Total addresses: ${poolStatus.data.total}`);
        console.log(`Available: ${poolStatus.data.available}`);
        console.log(`Allocated: ${poolStatus.data.allocated}`);
        console.log(`Bound: ${poolStatus.data.bound}`);
    }, 30000);
});
