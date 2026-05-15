#!/usr/bin/env tsx

/**
 * Detailed test to debug target removal process step by step
 */

import { Monitor } from '@payin/monitor';

async function detailedTargetTest() {
  console.log('🔬 Detailed Target Removal Debug Test...\n');

  const monitor = new Monitor({
    chains: ['ethereum-sepolia'],
    mode: 'normal',
    targets: [],
    scanInterval: 60000, // Long interval to avoid interference
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
    await monitor.start();
    
    const targetManager = monitor['targetManager'];
    
    // Add target with object 1
    const target1 = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      to: '0x457C66cb9Af7685E628eaCe82E63eb4F035D85cB'
    };

    console.log('🎯 Adding target...');
    await monitor.watch([target1]);
    
    // Check internal state
    console.log('\n📊 State after adding:');
    console.log(`   activeTargets.size: ${targetManager['activeTargets'].size}`);
    console.log(`   targetsByChain size: ${targetManager['targetsByChain'].size}`);
    console.log(`   targetsByContract size: ${targetManager['targetsByContract'].size}`);
    console.log(`   targetsByAddress size: ${targetManager['targetsByAddress'].size}`);
    console.log(`   getAllTargets(): ${targetManager.getAllTargets().length}`);

    // Check specific chain targets
    const chainTargets = targetManager['targetsByChain'].get('ethereum-sepolia');
    console.log(`   ethereum-sepolia targets: ${chainTargets ? chainTargets.size : 0}`);

    // Now try to remove with different object (same values)
    const target2 = {
      chain: 'ethereum-sepolia' as const,
      contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 
      to: '0x457C66cb9Af7685E628eaCe82E63eb4F035D85cB'
    };

    console.log('\n🗑️ Removing target with different object (same values)...');
    console.log(`   target1 === target2: ${target1 === target2}`);
    console.log(`   target1 key: ${targetManager['getTargetKey'](target1)}`);
    console.log(`   target2 key: ${targetManager['getTargetKey'](target2)}`);
    console.log(`   hasTarget(target2): ${targetManager.hasTarget(target2)}`);

    await monitor.unwatch([target2]);

    // Check state after removal attempt
    console.log('\n📊 State after removal attempt:');
    console.log(`   activeTargets.size: ${targetManager['activeTargets'].size}`);
    console.log(`   targetsByChain size: ${targetManager['targetsByChain'].size}`);
    console.log(`   targetsByContract size: ${targetManager['targetsByContract'].size}`);
    console.log(`   targetsByAddress size: ${targetManager['targetsByAddress'].size}`);
    console.log(`   getAllTargets(): ${targetManager.getAllTargets().length}`);

    // Check specific chain targets again
    const chainTargetsAfter = targetManager['targetsByChain'].get('ethereum-sepolia');
    console.log(`   ethereum-sepolia targets: ${chainTargetsAfter ? chainTargetsAfter.size : 0}`);

    // Check if the specific target objects are still in the set
    if (chainTargetsAfter && chainTargetsAfter.size > 0) {
      console.log('\n🔍 Remaining targets in chain set:');
      let i = 1;
      for (const t of chainTargetsAfter) {
        console.log(`   ${i++}. Object reference: ${t === target1 ? 'target1' : t === target2 ? 'target2' : 'different'}`);
        console.log(`      Key: ${targetManager['getTargetKey'](t)}`);
        console.log(`      Chain: ${t.chain}, Contract: ${t.contract}, To: ${t.to}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.stop();
  }
}

detailedTargetTest().catch(console.error);