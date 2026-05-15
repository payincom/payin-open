#!/usr/bin/env tsx

/**
 * Simplified test specifically for monitoring target cleanup
 * Tests if targets are properly removed from monitor's TargetManager
 */

import { Processor } from '../src/processor-legacy.js';

async function testMonitorTargetCleanup() {
  console.log('🔬 Testing monitor target cleanup specifically...\n');

  const paymentSystem = new Processor({
    database: { filename: ':memory:', enableForeignKeys: true, enableWAL: false },
    monitor: { 
      chains: ['ethereum-sepolia'], 
      mode: 'normal',
      targets: []
    },
    addressManagement: { strategy: 'database' }
  });

  try {
    await paymentSystem.start();
    console.log('✅ Payment system started');

    // Add test address
    const testAddress = '0x742d35Cc6234Bb6B4d9DEb984b5d0e2C15c4A8F9';
    await paymentSystem['database'].initializeAddressPool([{
      address: testAddress,
      chainFamily: 'evm' as const,
      state: 'available' as const,
      createdAt: new Date()
    }]);

    // Create order
    const orderRequest = {
      order_reference: `test-${Date.now()}`,
      amount: '0.05',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      metadata: { user_id: 'test-user' }
    };

    console.log('📋 Creating test order...');
    const order = await paymentSystem.createOrder(orderRequest);
    console.log(`✅ Order created: ${order.orderId}`);
    console.log(`📮 Payment address: ${order.paymentAddress}\n`);

    // Get monitor and check targets
    const monitor = paymentSystem['monitor'];
    if (!monitor) {
      throw new Error('Monitor not found');
    }

    console.log('📊 Checking targets before cleanup...');
    const targetsBefore = monitor['targetManager'].getAllTargets();
    console.log(`📋 Targets before: ${targetsBefore.length}`);
    targetsBefore.forEach((target, i) => {
      console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
    });

    // Now manually trigger monitoring cleanup (simulate order completion)
    console.log('\n🧹 Manually triggering monitoring cleanup...');
    const orderService = paymentSystem['orderService'];
    
    // This calls the stopMonitoring method directly
    await orderService['stopMonitoring'](order.orderId);
    console.log('✅ Monitoring cleanup completed\n');

    // Check targets after cleanup
    console.log('📊 Checking targets after cleanup...');
    const targetsAfter = monitor['targetManager'].getAllTargets();
    console.log(`📋 Targets after: ${targetsAfter.length}`);
    
    if (targetsAfter.length > 0) {
      console.log('❌ PROBLEM: Targets still exist after cleanup!');
      targetsAfter.forEach((target, i) => {
        console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
      });
    } else {
      console.log('✅ SUCCESS: All targets properly cleaned up!');
    }

    // Wait briefly and check again for any async cleanup
    console.log('\n⏳ Waiting 1 second and checking again...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalTargets = monitor['targetManager'].getAllTargets();
    console.log(`📋 Final check - Targets: ${finalTargets.length}`);
    
    if (finalTargets.length === 0) {
      console.log('✅ FINAL RESULT: Monitoring cleanup working correctly!');
    } else {
      console.log('❌ FINAL RESULT: Monitoring cleanup issue confirmed!');
      console.log('   The targets are properly removed from TargetManager but scanner still shows targets');
      
      // Let's simulate what happens in performNormalScan
      console.log('\n🔍 Simulating normal scan to see where targets come from...');
      const allTargetsFromManager = monitor['targetManager'].getAllTargets();
      console.log(`   TargetManager.getAllTargets(): ${allTargetsFromManager.length}`);
      
      const chainTargets = allTargetsFromManager.filter(t => t.chain === 'ethereum-sepolia');
      console.log(`   Filtered for ethereum-sepolia: ${chainTargets.length}`);
      
      if (chainTargets.length > 0) {
        console.log('   🐛 BUG CONFIRMED: TargetManager.getAllTargets() still returns removed targets!');
      } else {
        console.log('   ✅ TargetManager is correctly cleaned up - bug must be elsewhere');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await paymentSystem.stop();
    console.log('\n🛑 Payment system stopped');
  }
}

// Run test
testMonitorTargetCleanup().catch(console.error);