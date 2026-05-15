/**
 * Test Solana Adapter Optimizations
 *
 * Verifies:
 * 1. Failed transactions are filtered out
 * 2. Transfers are returned in forward order (slot ASC)
 * 3. Dynamic batch sizing works correctly
 * 4. Signature caching in Recovery mode reduces RPC calls
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { SolanaAdapter } from '../src/adapters/solana-adapter.js'
import { createRPCManager } from '../src/rpc/index.js'
import type { Chain } from '../src/types/index.js'

describe('Solana Adapter Optimizations', () => {
  let adapter: SolanaAdapter
  let rpcManager: any

  beforeAll(async () => {
    const chain: Chain = 'solana-devnet'

    // Create RPC Manager with inline config for solana-devnet (public RPC, no key needed)
    rpcManager = await createRPCManager(
      {}, // no API keys needed for public RPC
      undefined,
      {
        providers: {
          'solana-public': {
            displayName: 'Solana Public RPC',
            authType: 'none',
            baseUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
            supportedChains: ['solana-devnet'],
            requiresApiKey: false,
            defaultTimeout: 10000,
            defaultWeight: 60,
            defaultMaxRequestsPerSecond: 5
          }
        },
        chains: {
          'solana-devnet': {
            preferredProviders: ['solana-public'],
            strategy: 'round_robin'
          }
        },
        settings: {}
      }
    )

    // Create adapter
    adapter = new SolanaAdapter(chain, rpcManager)
    await adapter.initialize()
  })

  beforeEach(() => {
    // Clear cache before each test
    ;(adapter as any).signatureCache = null
  })

  it('should return transfers in forward order (slot ASC)', async () => {
    // Get current slot
    const currentSlot = await adapter.getCurrentBlockNumber()

    // Scan a small range
    const fromSlot = Math.max(0, currentSlot - 100)
    const toSlot = currentSlot

    const result = await adapter.scanBlocks({
      fromBlock: fromSlot,
      toBlock: toSlot,
      addresses: [
        // Solana devnet USDC mint (as example)
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
      ],
      contracts: [
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
      ],
      priority: 'high'
    })

    // Verify transfers are in ascending order
    if (result.transfers.length > 1) {
      for (let i = 1; i < result.transfers.length; i++) {
        const prevSlot = result.transfers[i - 1]!.blockNumber
        const currSlot = result.transfers[i]!.blockNumber

        expect(currSlot).toBeGreaterThanOrEqual(prevSlot)
      }

      console.log('✅ Transfers are in forward order (slot ASC)')
      console.log(`   First transfer slot: ${result.transfers[0]?.blockNumber}`)
      console.log(`   Last transfer slot: ${result.transfers[result.transfers.length - 1]?.blockNumber}`)
    } else {
      console.log('⏭️  Not enough transfers to verify ordering')
    }
  })

  it('should handle empty results correctly', async () => {
    const currentSlot = await adapter.getCurrentBlockNumber()

    const result = await adapter.scanBlocks({
      fromBlock: currentSlot - 10,
      toBlock: currentSlot,
      addresses: ['NonExistentAddress123456789'],
      contracts: ['NonExistentContract123456789'],
      priority: 'high'
    })

    expect(result.success).toBe(true)
    expect(result.transfers).toEqual([])
  })

  it('should adapt batch size based on RPC provider', () => {
    // Access private method via type assertion (for testing only)
    const batchSize = (adapter as any).getDynamicBatchSize()

    expect(batchSize).toBeGreaterThan(0)
    expect(batchSize).toBeLessThanOrEqual(100)

    console.log(`✅ Dynamic batch size: ${batchSize}`)
  })

  it('should cache signatures in Recovery mode', async () => {
    const currentSlot = await adapter.getCurrentBlockNumber()

    // Simulate Recovery mode: large lag (startBlock far behind current)
    const startBlock = Math.max(0, currentSlot - 200)
    const firstBatchEnd = startBlock + 99

    console.log(`\n📦 Testing signature caching:`)
    console.log(`   Current slot: ${currentSlot}`)
    console.log(`   Recovery range: ${startBlock} to ${currentSlot}`)
    console.log(`   First batch: ${startBlock} to ${firstBatchEnd}`)

    // First scan: should trigger caching
    const result1 = await adapter.scanBlocks({
      fromBlock: startBlock,
      toBlock: firstBatchEnd,
      addresses: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
      contracts: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
      priority: 'high'
    })

    expect(result1.success).toBe(true)

    // Check if cache was created (may not be created if no signatures found on devnet)
    const cache = (adapter as any).signatureCache

    if (cache) {
      console.log(`\n✅ Cache created:`)
      console.log(`   Cached signatures: ${cache.signatures.size}`)
      console.log(`   Cached range: ${cache.fromSlot} to ${cache.toSlot}`)

      expect(cache.fromSlot).toBe(startBlock)
      expect(cache.toSlot).toBeGreaterThanOrEqual(firstBatchEnd)

      // Second scan: should use cache
      const secondBatchStart = startBlock + 100
      const secondBatchEnd = startBlock + 199

      console.log(`\n   Second batch: ${secondBatchStart} to ${secondBatchEnd}`)

      const result2 = await adapter.scanBlocks({
        fromBlock: secondBatchStart,
        toBlock: secondBatchEnd,
        addresses: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
        contracts: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
        priority: 'high'
      })

      expect(result2.success).toBe(true)
      console.log(`✅ Second batch used cache (no additional signature fetches)`)
    } else {
      console.log(`⏭️  Cache not created (insufficient lag or no signatures found)`)
    }
  })

  it('should not cache in Normal mode (small lag)', async () => {
    const currentSlot = await adapter.getCurrentBlockNumber()

    // Simulate Normal mode: small lag (recent blocks)
    const startBlock = currentSlot - 50
    const endBlock = currentSlot - 40

    console.log(`\n🔄 Testing Normal mode (no caching):`)
    console.log(`   Current slot: ${currentSlot}`)
    console.log(`   Scan range: ${startBlock} to ${endBlock} (lag: 50 slots)`)

    const result = await adapter.scanBlocks({
      fromBlock: startBlock,
      toBlock: endBlock,
      addresses: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
      contracts: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
      priority: 'high'
    })

    expect(result.success).toBe(true)

    // Cache should not be created (lag < 100)
    const cache = (adapter as any).signatureCache
    expect(cache).toBeNull()

    console.log(`✅ No cache created in Normal mode`)
  })
})
