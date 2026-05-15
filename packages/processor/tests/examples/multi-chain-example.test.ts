/**
 * Multi-Chain Testing Example
 *
 * This example demonstrates how to use the unified multi-chain testing infrastructure.
 * The same test can run on different chains by using environment variables or random selection.
 *
 * Usage Examples:
 *
 * 1. Random chain selection (default):
 *    npx vitest run tests/examples/multi-chain-example.test.ts
 *
 * 2. Specify chain and token:
 *    TEST_CHAIN=solana-devnet TEST_TOKEN=USDC npx vitest run tests/examples/multi-chain-example.test.ts
 *
 * 3. Specify only protocol (random chain from that protocol):
 *    TEST_PROTOCOL=evm npx vitest run tests/examples/multi-chain-example.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestProcessor,
  ProcessorTestUtils as TestUtils,
  getTestChainConfig,
  createDefaultAddressGenerator,
} from '@payin/test-utils/processor'
import { Processor } from '../../src/index.js'
import { TestSchemaManager } from '@payin/test-utils/database'

describe('Multi-Chain Testing Example', () => {
  let schemaManager: TestSchemaManager
  let testSchema: string
  let processor: Processor | null = null

  // Get chain configuration - will be random or from environment variables
  const chainConfig = getTestChainConfig()

  console.log(`\n🎲 Selected chain configuration:`)
  console.log(`   Chain: ${chainConfig.chain}`)
  console.log(`   Token: ${chainConfig.token}`)
  console.log(`   Protocol: ${chainConfig.protocol}\n`)

  beforeAll(async () => {
    // Create isolated test schema
    testSchema = TestSchemaManager.generateSchemaName('multi_chain_example')
    schemaManager = TestUtils.createSchemaManager(testSchema)
    await schemaManager.initializeSchema()
    console.log(`✅ Created test schema: ${testSchema}`)

    // Create test organization
    await schemaManager.createTestOrganization(TestUtils.TEST_ORG_ID)
    console.log(`✅ Test organization created: ${TestUtils.TEST_ORG_ID}`)

    // Create processor with schema isolation
    processor = await createTestProcessor(
      {
        paymentWindowMinutes: 10,
        gracePeriodMinutes: 5,
        skipMonitorRecovery: true,
      },
      testSchema
    )
    await processor.start()
    console.log('✅ Processor started')
  }, 120000)

  afterAll(async () => {
    // Clean up
    if (processor) await processor.stop()
    if (schemaManager) {
      await schemaManager.dropSchema()
      await schemaManager.close()
      console.log(`✅ Cleaned up test schema: ${testSchema}`)
    }
    await TestUtils.cleanup()
  })

  test('Example: Address generation works for selected chain', async () => {
    // Generate addresses using the unified address generator
    const addressGenerator = createDefaultAddressGenerator()
    const addresses = addressGenerator.generateAddresses(chainConfig.protocol, 3)

    console.log(`\n📍 Generated ${addresses.length} addresses for ${chainConfig.protocol}:`)
    addresses.forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr.address}`)
    })

    // Verify addresses were generated
    expect(addresses).toHaveLength(3)
    expect(addresses[0].protocol).toBe(chainConfig.protocol)
    expect(addresses[0].address).toBeTruthy()
  })

  test('Example: Initialize address pool with chain config', async () => {
    if (!processor) throw new Error('Processor not initialized')

    // For EVM/Tron, initialize address pool
    // For Solana, addresses are managed directly in tests
    if (chainConfig.protocol !== 'solana') {
      await TestUtils.initializeAddressPool(processor, {
        chainConfig,
        count: 5,
      })

      const stats = await processor.getAddressPoolAvailability(
        TestUtils.TEST_ORG_ID,
        chainConfig.protocol as 'evm' | 'tron'
      )
      console.log(`\n📊 Address pool stats for ${chainConfig.protocol}:`)
      console.log(`   Available: ${stats.available}`)
      console.log(`   Total: ${stats.total}`)

      expect(stats.total).toBeGreaterThanOrEqual(5)
    } else {
      console.log(`\n⚠️  Solana addresses are managed directly in tests (not via address pool)`)
    }
  })

  test('Example: Create order with chain config', async () => {
    if (!processor) throw new Error('Processor not initialized')

    // Skip order creation for Solana (not supported in current processor implementation)
    if (chainConfig.protocol === 'solana') {
      console.log(`\n⚠️  Solana order creation not yet supported in processor (coming in Phase 2)`)
      return
    }

    // Create order with the selected chain configuration
    const order = await TestUtils.createTestOrder(processor, '10.0', {
      chainConfig,
    })

    console.log(`\n📦 Created order:`)
    console.log(`   Order ID: ${order.orderId}`)
    console.log(`   Chain: ${order.chainId}`)
    console.log(`   Currency: ${order.currency}`)
    console.log(`   Amount: ${order.amount}`)
    console.log(`   Payment Address: ${order.paymentAddress}`)

    // Verify order was created with correct chain/currency
    expect(order.chainId).toBe(chainConfig.chain)
    expect(order.currency).toBe(chainConfig.token)
    expect(order.status).toBe('pending')
  })

  test('Example: Chain config can be retrieved from environment', () => {
    // The getTestChainConfig() function reads from environment variables:
    // - TEST_CHAIN: Chain ID (e.g., 'ethereum-sepolia', 'solana-devnet')
    // - TEST_TOKEN: Token symbol (e.g., 'USDC', 'USDT')
    // - TEST_PROTOCOL: Protocol filter (e.g., 'evm', 'solana', 'tron')

    // If none are set, it randomly selects from available chains
    const config = getTestChainConfig()

    console.log(`\n🔧 Current chain config:`)
    console.log(`   Chain: ${config.chain}`)
    console.log(`   Token: ${config.token}`)
    console.log(`   Protocol: ${config.protocol}`)

    expect(config.chain).toBeTruthy()
    expect(config.token).toBeTruthy()
    expect(config.protocol).toBeTruthy()
  })
})
