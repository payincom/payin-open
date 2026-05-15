/**
 * Demo: Monitor continues tracking chain height during idle periods
 *
 * This demonstrates the fix for the issue where monitor would stop updating
 * chain height when no monitoring targets are active.
 */

import { Monitor } from '../src/index.js';
import type { Chain } from '../src/types/index.js';
import { loadRootEnv } from '@payin/shared';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadRootEnv(['.env'], { rootDir: resolve(__dirname, '..') });

const testChain: Chain = 'ethereum-sepolia';

async function demonstrateIdleTracking() {
  console.log('🚀 Starting Monitor with NO active targets...\n');

  const monitor = new Monitor({
    chains: [testChain],
    targets: [], // No targets initially
    scanInterval: 3000, // 3 seconds
    safeBlockDistance: 3,
    blockRangeSize: 10
  });

  // Track block updates
  let blockUpdateCount = 0;
  monitor.on('blockProgress', (event) => {
    blockUpdateCount++;
    console.log(`📊 Block Update #${blockUpdateCount}: Chain ${event.chain} at block ${event.blockNumber}`);
  });

  await monitor.start();
  console.log('✅ Monitor started (no targets active)\n');

  // Wait for 10 seconds to observe idle tracking
  console.log('⏳ Observing for 10 seconds (NO targets)...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  if (blockUpdateCount > 0) {
    console.log(`\n✅ SUCCESS: Chain height was updated ${blockUpdateCount} times during idle period!`);
    console.log('   This confirms that the monitor continues tracking even without active targets.\n');
  } else {
    console.log('\n❌ FAILURE: No block updates during idle period');
    console.log('   The monitor should continue tracking chain height even without targets.\n');
  }

  // Now add a target and observe
  console.log('🎯 Adding a monitoring target...\n');
  const dummyAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';
  const dummyContract = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // USDC on Sepolia

  await monitor.watch([{
    chain: testChain,
    contract: dummyContract,
    to: dummyAddress
  }]);

  const beforeTargetCount = blockUpdateCount;
  console.log('⏳ Observing for 10 seconds (WITH target)...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  const afterTargetCount = blockUpdateCount;
  if (afterTargetCount > beforeTargetCount) {
    console.log(`\n✅ SUCCESS: Chain height continued updating with targets`);
    console.log(`   Updates: ${afterTargetCount - beforeTargetCount} times\n`);
  }

  await monitor.stop();
  console.log('🛑 Monitor stopped\n');

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY: Idle Chain Height Tracking');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total block updates: ${blockUpdateCount}`);
  console.log(`\n✨ The monitor now continues tracking chain height even during`);
  console.log(`   idle periods with no active monitoring targets!`);
  console.log(`\n💡 This prevents long catch-up scans when new orders/deposits`);
  console.log(`   are created after idle periods.`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run the demo
demonstrateIdleTracking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
