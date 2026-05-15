#!/usr/bin/env tsx

/**
 * Test to check if target matching works correctly
 * Investigates potential mismatches between watch/unwatch targets
 */

import { Monitor } from '@payin/monitor';

async function testTargetMatching() {
  console.log('🔬 Testing target matching in watch/unwatch operations...\n');

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

    // Test case 1: Exact same target
    const target1 = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      to: '0x742d35Cc6234Bb6B4d9DEb984b5d0e2C15c4A8F9'
    };

    console.log('🎯 Test 1: Adding and removing exact same target object');
    console.log('   Target:', JSON.stringify(target1));

    await monitor.watch([target1]);
    let targets = monitor['targetManager'].getAllTargets();
    console.log(`   After watch: ${targets.length} targets`);

    await monitor.unwatch([target1]);
    targets = monitor['targetManager'].getAllTargets();
    console.log(`   After unwatch: ${targets.length} targets`);
    
    if (targets.length === 0) {
      console.log('   ✅ Test 1 PASSED\n');
    } else {
      console.log('   ❌ Test 1 FAILED\n');
    }

    // Test case 2: Different object with same values
    const target2a = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      to: '0x457C66cb9Af7685E628eaCe82E63eb4F035D85cB'
    };

    const target2b = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      to: '0x457C66cb9Af7685E628eaCe82E63eb4F035D85cB'
    };

    console.log('🎯 Test 2: Adding with one object, removing with different object (same values)');
    console.log('   Watch target:', JSON.stringify(target2a));
    console.log('   Unwatch target:', JSON.stringify(target2b));

    await monitor.watch([target2a]);
    targets = monitor['targetManager'].getAllTargets();
    console.log(`   After watch: ${targets.length} targets`);

    await monitor.unwatch([target2b]);
    targets = monitor['targetManager'].getAllTargets();
    console.log(`   After unwatch: ${targets.length} targets`);
    
    if (targets.length === 0) {
      console.log('   ✅ Test 2 PASSED\n');
    } else {
      console.log('   ❌ Test 2 FAILED\n');
    }

    // Test case 3: Case sensitivity test
    const target3a = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // lowercase
      to: '0xe9a2d1bfc10d92f2b14824672a24a0af5115c6ce' // lowercase
    };

    const target3b = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1C7D4B196Cb0C7B01d743Fbc6116a902379C7238', // mixed case
      to: '0xE9a2d1BfC10d92F2b14824672A24a0Af5115C6CE' // mixed case
    };

    console.log('🎯 Test 3: Case sensitivity test');
    console.log('   Watch target:', JSON.stringify(target3a));
    console.log('   Unwatch target:', JSON.stringify(target3b));

    await monitor.watch([target3a]);
    targets = monitor['targetManager'].getAllTargets();
    console.log(`   After watch: ${targets.length} targets`);

    await monitor.unwatch([target3b]);
    targets = monitor['targetManager'].getAllTargets();
    console.log(`   After unwatch: ${targets.length} targets`);
    
    if (targets.length === 0) {
      console.log('   ✅ Test 3 PASSED (case insensitive)');
    } else {
      console.log('   ❌ Test 3 FAILED (case sensitive issue)');
    }

    // Show any remaining targets
    if (targets.length > 0) {
      console.log('\n❌ Remaining targets after all tests:');
      targets.forEach((target, i) => {
        console.log(`   ${i+1}. ${target.chain}:${target.contract}:${target.to}`);
      });
    } else {
      console.log('\n✅ All tests completed successfully - no remaining targets');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.stop();
    console.log('\n🛑 Monitor stopped');
  }
}

// Run test
testTargetMatching().catch(console.error);