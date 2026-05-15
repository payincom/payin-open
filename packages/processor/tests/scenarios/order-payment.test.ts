/**
 * Unified Order Payment Test (Multi-Chain)
 *
 * This test demonstrates the unified multi-chain testing architecture.
 * It runs the complete order payment flow on different chains based on configuration.
 *
 * Usage:
 * - Random chain: npx vitest run tests/scenarios/order-payment.test.ts
 * - Specific chain: TEST_CHAIN=ethereum-sepolia npx vitest run tests/scenarios/order-payment.test.ts
 * - Specific protocol: TEST_PROTOCOL=evm npx vitest run tests/scenarios/order-payment.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestProcessor,
  ProcessorTestUtils as TestUtils,
  getTestChainConfig,
} from '@payin/test-utils/processor'
import { Processor } from '../../src/index.js'
import { TestSchemaManager } from '@payin/test-utils/database'
import { Keypair, Connection } from '@solana/web3.js'
import { WalletLoader } from '@payin/test-utils/wallets'
import { SolanaTestUtils } from '@payin/test-utils/blockchain'

// Solana-specific configuration
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com'
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Official Devnet USDC

describe('Order Payment Test (Multi-Chain)', () => {
  let schemaManager: TestSchemaManager
  let testSchema: string
  let senderWallet: Keypair | null = null
  let connection: Connection | null = null

  // Get chain configuration - will be random or from environment variables
  const chainConfig = getTestChainConfig()

  console.log(`\n🎲 Selected chain configuration:`)
  console.log(`   Chain: ${chainConfig.chain}`)
  console.log(`   Token: ${chainConfig.token}`)
  console.log(`   Protocol: ${chainConfig.protocol}\n`)

  beforeAll(async () => {
    // Create isolated test schema
    testSchema = TestSchemaManager.generateSchemaName('order_payment_unified')
    schemaManager = TestUtils.createSchemaManager(testSchema)
    await schemaManager.initializeSchema()
    console.log(`✅ Created test schema: ${testSchema}`)

    // Create test organization
    await schemaManager.createTestOrganization(TestUtils.TEST_ORG_ID)
    console.log(`✅ Test organization created: ${TestUtils.TEST_ORG_ID}`)

    // Solana-specific setup
    if (chainConfig.protocol === 'solana') {
      console.log('📂 Loading Solana test wallets...')
      const senderWalletInfo = WalletLoader.loadSolana('sender')
      senderWallet = senderWalletInfo.keypair
      console.log(`   Sender: ${senderWallet.publicKey.toBase58()}`)

      // Initialize Solana connection
      connection = new Connection(SOLANA_DEVNET_RPC, 'finalized')

      // Check sender SOL balance
      const solBalance = await connection.getBalance(senderWallet.publicKey)
      console.log(`   Sender SOL balance: ${(solBalance / 1e9).toFixed(4)} SOL`)

      if (solBalance < 0.01 * 1e9) {
        console.warn('⚠️  WARNING: Sender has low SOL balance. May not be able to pay transaction fees.')
        console.warn('   Please request SOL from https://faucet.solana.com/')
      }
    }
  }, 120000)

  afterAll(async () => {
    // Clean up test schema
    if (schemaManager) {
      await schemaManager.dropSchema()
      await schemaManager.close()
      console.log(`✅ Cleaned up test schema: ${testSchema}`)
    }
    await TestUtils.cleanup()
  })

  test(`Complete ${chainConfig.chain}+${chainConfig.token} order payment flow`, async () => {
    console.log(`\n🚀 Starting ${chainConfig.protocol.toUpperCase()} order payment test...\n`)

    let processor: Processor | null = null

    try {
      // Step 1: Create processor with schema isolation
      processor = await createTestProcessor(
        {
          paymentWindowMinutes: 10,
          gracePeriodMinutes: 5,
          skipMonitorRecovery: true,
        },
        testSchema
      )
      await processor.start()

      // Step 2: Initialize address pool based on protocol
      let paymentAddress: string | undefined

      if (chainConfig.protocol === 'solana') {
        // For Solana, manually set up a payment address
        console.log('📍 Initializing Solana address pool...')
        const receiverWalletInfo = WalletLoader.loadSolana('receiver')
        paymentAddress = receiverWalletInfo.address

        // Delete existing row first to avoid constraint violations
        await processor.getDatabase().execute(
          `DELETE FROM address_pool WHERE address = $1`,
          [paymentAddress]
        )

        await processor.getDatabase().execute(
          `INSERT INTO address_pool (address, protocol, state, organization_id)
           VALUES ($1, $2, $3, $4)`,
          [paymentAddress, 'solana', 'idle', TestUtils.TEST_ORG_ID]
        )
        console.log(`   Payment address ready: ${paymentAddress}`)
      } else {
        // For EVM/Tron, use standard address pool initialization
        await TestUtils.initializeAddressPool(processor, {
          chainConfig,
          count: 5,
        })
        console.log(`📍 Address pool initialized for ${chainConfig.protocol.toUpperCase()}`)
      }

      // Step 3: Create order
      console.log('\n📝 Creating order...')
      const order = await TestUtils.createTestOrder(processor, '0.050000', {
        chainConfig,
      })

      console.log(`   Order ID: ${order.orderId}`)
      console.log(`   Amount: ${order.amount} ${order.currency}`)
      console.log(`   Payment Address: ${order.paymentAddress}`)
      console.log(`   Chain: ${order.chainId}`)

      // Verify order details
      expect(order.chainId).toBe(chainConfig.chain)
      expect(order.currency).toBe(chainConfig.token)
      expect(order.status).toBe('pending')

      if (paymentAddress) {
        expect(order.paymentAddress).toBe(paymentAddress)
      }

      // Step 4: Send payment based on protocol
      console.log('\n💸 Sending payment...')
      if (chainConfig.protocol === 'solana') {
        // Solana-specific payment
        const senderWalletInfo = WalletLoader.loadSolana('sender')
        const signature = await SolanaTestUtils.sendToken({
          fromSecretKey: senderWalletInfo.secretKey,
          toAddress: order.paymentAddress,
          amount: order.amount,
          mintAddress: USDC_MINT_DEVNET,
          rpcUrl: SOLANA_DEVNET_RPC,
        })

        console.log(`   ✅ Transaction sent!`)
        console.log(`   Signature: ${signature}`)
        console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`)
      } else {
        // EVM/Tron payment using unified payment sender
        await TestUtils.sendPayment({
          toAddress: order.paymentAddress,
          amount: order.amount,
          token: order.currency,
          chain: order.chainId,
          chainConfig,
        })
        console.log(`   ✅ Payment sent on ${chainConfig.chain}`)
      }

      // Step 5: Wait for order completion
      console.log('\n⏳ Waiting for monitor to detect and confirm payment...')
      const completedOrder = await TestUtils.waitForOrderStatus(
        processor,
        order.orderId,
        'completed',
        180000 // 3 minutes timeout
      )

      // Step 6: Verify order completion
      expect(completedOrder.status).toBe('completed')
      expect(completedOrder.id).toBe(order.orderId)
      console.log(`   ✅ Order completed successfully!`)

      // Step 7: Verify transfer record
      const transfers = await processor.getDatabase().query(
        'SELECT * FROM transfers WHERE order_id = $1',
        [order.orderId]
      )

      expect(transfers.length).toBeGreaterThan(0)
      const transfer = transfers[0]
      expect(transfer.is_confirmed).toBe(true)
      expect(transfer.chain).toBe(chainConfig.chain)
      expect(transfer.token).toBe(chainConfig.token)
      expect(parseFloat(transfer.amount)).toBe(parseFloat(order.amount))

      console.log(`\n📊 Transfer verification:`)
      console.log(`   Transaction Hash: ${transfer.transaction_hash}`)
      console.log(`   Amount: ${transfer.amount} ${transfer.token}`)
      console.log(`   Confirmed: ${transfer.is_confirmed}`)
      console.log(`   Block: ${transfer.block_number}`)

      console.log(`\n🎉 ${chainConfig.protocol.toUpperCase()} order payment test completed successfully!\n`)

    } finally {
      console.log('🧹 Cleaning up...')
      if (processor) await processor.stop()
      await TestUtils.cleanup()
    }
  }, 300000) // 5 minutes timeout
})
