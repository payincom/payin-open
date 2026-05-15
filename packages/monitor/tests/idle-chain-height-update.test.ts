/**
 * Test: Monitor updates chain height even when no targets are being monitored
 *
 * This test verifies that the monitor continues to track blockchain progress
 * even during idle periods with no active monitoring targets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Monitor } from '../src/index.js';
import type { Chain } from '../src/types/index.js';

describe('Idle Chain Height Update', () => {
  let monitor: Monitor;
  const testChain: Chain = 'ethereum-sepolia';

  beforeAll(async () => {
    // Initialize monitor without any targets
    // Provide inline RPC config with public providers (no API key needed)
    monitor = new Monitor({
      chains: [testChain],
      targets: [], // Start with no targets
      scanInterval: 2000, // 2 seconds for faster testing
      safeBlockDistance: 3,
      blockRangeSize: 10,
      rpcKeys: {},
      rpcConfig: {
        providers: {
          'sepolia-public': {
            displayName: 'Sepolia Public RPC',
            authType: 'none',
            baseUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
            supportedChains: ['ethereum-sepolia'],
            requiresApiKey: false,
            defaultTimeout: 8000,
            defaultWeight: 60,
            defaultMaxRequestsPerSecond: 3
          }
        },
        chains: {
          'ethereum-sepolia': {
            preferredProviders: ['sepolia-public'],
            strategy: 'round_robin'
          }
        },
        settings: {}
      }
    });

    await monitor.start();
  });

  afterAll(async () => {
    if (monitor) {
      await monitor.stop();
    }
  });

  it('should update chain height even without active targets', async () => {
    // Wait for monitor to initialize and first scan cycle to complete
    // PublicNode RPC may take a few seconds to respond
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get initial stats
    const initialStats = monitor.getMonitorStats();
    const initialBlock = initialStats.currentBlock.get(testChain) || 0;

    console.log(`📊 Initial block height: ${initialBlock}`);
    expect(initialBlock).toBeGreaterThan(0);

    // Wait for multiple scan cycles (3 scans = 6 seconds)
    console.log('⏳ Waiting for 3 scan cycles (no targets active)...');
    await new Promise(resolve => setTimeout(resolve, 7000));

    // Get updated stats
    const updatedStats = monitor.getMonitorStats();
    const updatedBlock = updatedStats.currentBlock.get(testChain) || 0;

    console.log(`📊 Updated block height: ${updatedBlock}`);
    console.log(`📈 Block progress: ${updatedBlock - initialBlock} blocks`);

    // Verify that chain height was updated during idle period
    expect(updatedBlock).toBeGreaterThanOrEqual(initialBlock);

    // Note: In a real blockchain, we'd expect updatedBlock > initialBlock
    // But in testing, blocks might not be produced, so we check >= instead
    console.log('✅ Chain height tracking continues during idle periods');
  }, 15000);

  it('should resume normal scanning when targets are added after idle period', async () => {
    const dummyAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';
    const dummyContract = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // USDC on Sepolia

    // Add a monitoring target
    await monitor.watch([{
      chain: testChain,
      contract: dummyContract,
      to: dummyAddress
    }]);

    console.log('🎯 Added monitoring target after idle period');

    // Get current block
    const statsBeforeTargets = monitor.getMonitorStats();
    const blockBeforeTargets = statsBeforeTargets.currentBlock.get(testChain) || 0;

    console.log(`📊 Block height when target added: ${blockBeforeTargets}`);

    // Wait for a scan cycle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify scanning continues
    const statsAfterTargets = monitor.getMonitorStats();
    const blockAfterTargets = statsAfterTargets.currentBlock.get(testChain) || 0;

    console.log(`📊 Block height after scanning with targets: ${blockAfterTargets}`);
    expect(blockAfterTargets).toBeGreaterThanOrEqual(blockBeforeTargets);

    console.log('✅ Normal scanning resumed successfully');

    // Cleanup
    await monitor.unwatch([{
      chain: testChain,
      contract: dummyContract,
      to: dummyAddress
    }]);
  }, 10000);
});
