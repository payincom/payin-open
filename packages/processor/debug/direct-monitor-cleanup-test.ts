#!/usr/bin/env tsx

/**
 * Direct test of monitoring target cleanup in isolation
 * Tests the Monitor and TargetManager directly
 */

import { Monitor } from '@payin/monitor';

async function testDirectMonitorCleanup() {
  console.log('🔬 Testing monitor target cleanup directly...\n');

  const monitor = new Monitor({
    chains: ['ethereum-sepolia'],
    mode: 'normal',
    targets: [],
    scanInterval: 5000,
    normalBlockRangeSize: 10,
    historyBlockRangeSize: 100,
    confirmations: 1,
    rpcConfig: {
      ethereum: {
        sepolia: {
          alchemy: 'your_alchemy_key'
        }
      }
    },
    persistence: {
      autoRecover: false
    }
  });

  try {
    console.log('🚀 Starting monitor...');
    await monitor.start();
    console.log('✅ Monitor started\n');

    // Add a test target
    const testTarget = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      to: '0x742d35Cc6234Bb6B4d9DEb984b5d0e2C15c4A8F9'
    };

    console.log('🎯 Adding test target...');
    await monitor.watch([testTarget]);
    console.log('✅ Target added\n');

    // Check targets
    const targetsBefore = monitor['targetManager'].getAllTargets();
    console.log(`📋 Targets before cleanup: ${targetsBefore.length}`);
    targetsBefore.forEach((target, i) => {
      console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
    });

    // Now remove the target
    console.log('\n🗑️ Removing test target...');
    await monitor.unwatch([testTarget]);
    console.log('✅ Target removal completed\n');

    // Check targets after cleanup
    const targetsAfter = monitor['targetManager'].getAllTargets();
    console.log(`📋 Targets after cleanup: ${targetsAfter.length}`);
    
    if (targetsAfter.length > 0) {
      console.log('❌ PROBLEM: Targets still exist after cleanup!');
      targetsAfter.forEach((target, i) => {
        console.log(`  ${i+1}. ${target.chain}:${target.contract}:${target.to.slice(0, 8)}...`);
      });
    } else {
      console.log('✅ SUCCESS: All targets properly cleaned up!');
    }

    // Wait and check again, but also simulate concurrent scanning
    console.log('\n⏳ Waiting 2 seconds and simulating concurrent scanning...');
    
    // Simulate what happens when scanning runs concurrently with cleanup
    const scanPromises = [];
    for (let i = 0; i < 3; i++) {
      scanPromises.push(new Promise(async (resolve) => {
        await new Promise(r => setTimeout(r, 100 * (i + 1))); // Stagger the checks
        const targets = monitor['targetManager'].getAllTargets();
        console.log(`   📊 Concurrent scan ${i+1}: ${targets.length} targets`);
        resolve(targets.length);
      }));
    }
    
    await Promise.all(scanPromises);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalTargets = monitor['targetManager'].getAllTargets();
    console.log(`📋 Final check - Targets: ${finalTargets.length}`);

    if (finalTargets.length === 0) {
      console.log('✅ CONFIRMED: Monitor cleanup working correctly at core level!');
    } else {
      console.log('❌ CONFIRMED: Core monitor cleanup has issues!');
    }

    // Let's also check what the scanner would see during a scan
    console.log('\n🔍 Testing what scanner sees during normal scan...');
    const scanner = monitor['scanner'];
    const allTargets = monitor['targetManager'].getAllTargets();
    const chainTargets = allTargets.filter(t => t.chain === 'ethereum-sepolia');
    
    console.log(`   getAllTargets() returned: ${allTargets.length}`);
    console.log(`   Filtered for ethereum-sepolia: ${chainTargets.length}`);

    if (chainTargets.length === 0) {
      console.log('✅ Scanner would see 0 targets - this is correct!');
    } else {
      console.log('❌ Scanner would still see targets - this is the bug!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.stop();
    console.log('\n🛑 Monitor stopped');
  }
}

// Run test
testDirectMonitorCleanup().catch(console.error);