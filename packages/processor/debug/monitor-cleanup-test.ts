#!/usr/bin/env tsx

/**
 * Debug script to test monitoring target cleanup
 * Tests if targets are properly removed from monitor's TargetManager
 */

import { Processor } from '../src/processor-legacy.js';

async function testMonitorCleanup() {
  console.log('🔬 Testing monitor target cleanup...\n');

  const processor = new Processor({
    database: { filename: ':memory:', enableForeignKeys: true, enableWAL: false },
    monitor: { 
      chains: ['ethereum-sepolia'], 
      mode: 'normal',
      targets: []
    },
    addressManagement: { strategy: 'database' },
    orders: { 
      defaultPaymentWindowMinutes: 2,
      defaultGracePeriodMinutes: 1,
    }
  });

  try {
    await processor.start();
    console.log('✅ Payment system started\n');

    // Add a test address to the database
    const testAddress = '0x742d35Cc6234Bb6B4d9DEb984b5d0e2C15c4A8F9';
    await processor['database'].initializeAddressPool([{
      address: testAddress,
      chainFamily: 'evm' as const,
      state: 'available' as const,
      createdAt: new Date()
    }]);
    console.log(`✅ Added test address: ${testAddress}\n`);

    // Create a test order
    const orderRequest = {
      order_reference: `debug-test-${Date.now()}`,
      amount: '0.05',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      metadata: {
        user_id: 'debug-user-123',
        description: 'Debug test order'
      }
    };

    console.log('📋 Creating test order...');
    const order = await processor.createOrder(orderRequest);
    console.log(`✅ Order created: ${order?.id || 'undefined'}`);
    console.log(`📮 Payment address: ${order?.payment_address || 'undefined'}\n`);

    if (!order) {
      throw new Error('Order creation failed - returned undefined');
    }

    // Check initial monitor status
    const initialStatus = processor.getStatus();
    console.log('📊 Initial payment system status:', JSON.stringify(initialStatus, null, 2));

    // Get monitor instance and check targets
    const monitor = processor['monitor'];
    if (monitor) {
      const allTargets = monitor['targetManager'].getAllTargets();
      console.log(`📋 Targets in monitor: ${allTargets.length}`);
      allTargets.forEach((target, i) => {
        console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
      });
    }
    console.log('');

    // Now cancel the order (this should clean up monitoring)
    console.log('❌ Canceling order to test cleanup...');
    await processor.cancelOrder(order.id);
    console.log('✅ Order canceled\n');

    // Check monitor status after cleanup  
    const afterStatus = processor.getStatus();
    console.log('📊 Payment system status after cleanup:', JSON.stringify(afterStatus, null, 2));

    // Check targets again
    if (monitor) {
      const remainingTargets = monitor['targetManager'].getAllTargets();
      console.log(`📋 Remaining targets in monitor: ${remainingTargets.length}`);
      remainingTargets.forEach((target, i) => {
        console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
      });
    }

    // Wait a moment for any async cleanup
    console.log('\n⏳ Waiting 2 seconds for any async cleanup...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Final check
    if (monitor) {
      const finalTargets = monitor['targetManager'].getAllTargets();
      console.log(`📋 Final targets in monitor: ${finalTargets.length}`);
      if (finalTargets.length > 0) {
        console.log('❌ PROBLEM: Targets still exist after cleanup!');
        finalTargets.forEach((target, i) => {
          console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
        });
      } else {
        console.log('✅ SUCCESS: All targets properly cleaned up!');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await processor.stop();
    console.log('\n🛑 Payment system stopped');
  }
}

// Run test
testMonitorCleanup().catch(console.error);