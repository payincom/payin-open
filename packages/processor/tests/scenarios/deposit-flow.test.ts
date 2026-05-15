/**
 * Unified Deposit Flow Test (Multi-Chain)
 *
 * This test demonstrates the unified multi-chain deposit testing architecture.
 * It runs the complete deposit flow on different chains based on configuration.
 *
 * Usage:
 * - Random chain: npx vitest run tests/scenarios/deposit-flow.test.ts
 * - Specific chain: TEST_CHAIN=ethereum-sepolia npx vitest run tests/scenarios/deposit-flow.test.ts
 * - Specific protocol: TEST_PROTOCOL=evm npx vitest run tests/scenarios/deposit-flow.test.ts
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

/**
 * Wait for deposit status (for Solana)
 */
async function waitForDepositStatus(
  processor: Processor,
  depositReference: string,
  targetStatus: 'pending' | 'confirmed' | 'completed',
  timeoutMs: number = 120000
): Promise<any> {
  const startTime = Date.now()
  const pollInterval = 2000 // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const transfers = await processor.getDatabase().query(
      'SELECT * FROM transfers WHERE deposit_reference = $1 AND business_type = $2',
      [depositReference, 'deposit']
    )

    if (transfers.length > 0) {
      const transfer = transfers[0]

      // Check status based on confirmation
      if (targetStatus === 'pending' && !transfer.is_confirmed) {
        console.log(`   ✅ Deposit found in 'pending' state`)
        return transfer
      }

      if (targetStatus === 'confirmed' && transfer.is_confirmed) {
        console.log(`   ✅ Deposit confirmed`)
        return transfer
      }

      if (targetStatus === 'completed' && transfer.is_confirmed) {
        // For deposits, completed is essentially the same as confirmed
        console.log(`   ✅ Deposit completed`)
        return transfer
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
    process.stdout.write('.')
  }

  throw new Error(`Timeout waiting for deposit to reach status: ${targetStatus}`)
}

describe('Deposit Flow Test (Multi-Chain)', () => {
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
    testSchema = TestSchemaManager.generateSchemaName('deposit_flow_unified')
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

  test(`Complete ${chainConfig.chain}+${chainConfig.token} deposit flow`, async () => {
    console.log(`\n🚀 Starting ${chainConfig.protocol.toUpperCase()} deposit flow test...\n`)

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

      // Step 2: Setup deposit address based on protocol
      let depositAddress: string
      const depositReference = `${chainConfig.protocol}_user_${Date.now()}`

      // Initialize address pool (for all protocols)
      await TestUtils.initializeAddressPool(processor, {
        chainConfig,
        count: 5,
      })
      console.log(`📍 Address pool initialized for ${chainConfig.protocol.toUpperCase()}`)

      // Bind deposit address (unified API for all protocols)
      const binding = await TestUtils.bindDepositAddress(
        processor,
        depositReference,
        chainConfig.protocol
      )
      depositAddress = binding.depositAddress
      console.log(`   Deposit Reference: ${depositReference}`)
      console.log(`   Deposit Address: ${depositAddress}`)
      console.log(`   Monitoring Targets:`, JSON.stringify(binding.monitoringTargets, null, 2))

      // Step 3: Send deposit payment based on protocol
      const depositAmount = '0.050000'  // Use 0.05 USDC for all chains
      console.log(`\n💸 Sending deposit of ${depositAmount} ${chainConfig.token}...`)

      if (chainConfig.protocol === 'solana') {
        // Solana-specific deposit
        const senderWalletInfo = WalletLoader.loadSolana('sender')
        const signature = await SolanaTestUtils.sendToken({
          fromSecretKey: senderWalletInfo.secretKey,
          toAddress: depositAddress,
          amount: depositAmount,
          mintAddress: USDC_MINT_DEVNET,
          rpcUrl: SOLANA_DEVNET_RPC,
        })

        console.log(`   ✅ Transaction sent!`)
        console.log(`   Signature: ${signature}`)
        console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`)
      } else {
        // EVM/Tron deposit using unified payment sender
        await TestUtils.sendPayment({
          toAddress: depositAddress,
          amount: depositAmount,
          token: chainConfig.token,
          chain: chainConfig.chain,
          chainConfig,
        })
        console.log(`   ✅ Deposit sent on ${chainConfig.chain}`)
      }

      // Step 4: Wait for deposit detection and confirmation
      console.log('\n⏳ Waiting for monitor to detect deposit...')

      if (chainConfig.protocol === 'solana') {
        // For Solana, wait for pending status first
        const pendingTransfer = await waitForDepositStatus(
          processor,
          depositReference,
          'pending',
          180000 // 3 minutes
        )

        expect(pendingTransfer).toBeDefined()
        expect(pendingTransfer.deposit_reference).toBe(depositReference)
        expect(pendingTransfer.business_type).toBe('deposit')
        expect(pendingTransfer.chain).toBe(chainConfig.chain)
        expect(pendingTransfer.token).toBe(chainConfig.token)
        expect(parseFloat(pendingTransfer.amount)).toBe(parseFloat(depositAmount))

        console.log(`\n📊 Transfer detected:`)
        console.log(`   Transaction Hash: ${pendingTransfer.transaction_hash}`)
        console.log(`   Amount: ${pendingTransfer.amount} ${chainConfig.token}`)
        console.log(`   Status: pending (awaiting confirmations)`)
        console.log(`   Block: ${pendingTransfer.block_number}`)

        // Wait for confirmation
        console.log('\n⏳ Waiting for block confirmations...')
        const confirmedTransfer = await waitForDepositStatus(
          processor,
          depositReference,
          'confirmed',
          180000 // 3 minutes
        )

        expect(confirmedTransfer.is_confirmed).toBe(true)
        expect(confirmedTransfer.confirmed_at).toBeDefined()

        console.log(`\n✅ Deposit confirmed:`)
        console.log(`   Confirmed At: ${confirmedTransfer.confirmed_at}`)
        console.log(`   Final Status: confirmed`)
      } else {
        // For EVM/Tron, use event-based waiting
        let receivedEvents: any[] = []
        const depositPromise = new Promise<any[]>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for deposit events')), 300000)

          // Listen for deposit confirmation events
          const cleanup = TestUtils.setupEventListener(processor!, `deposit:${depositReference}`, (event) => {
            receivedEvents.push(event)
            console.log(`🎉 Received deposit CONFIRMED event for ${depositReference}`)
            clearTimeout(timeout)
            cleanup()
            resolve(receivedEvents)
          })
        })

        await depositPromise

        // Verify transfer is confirmed
        const transfers = await processor.getDatabase().query(
          `SELECT * FROM transfers WHERE deposit_reference = $1`,
          [depositReference]
        )

        expect(transfers.length).toBeGreaterThan(0)
        const transfer = transfers[0]
        expect(transfer.is_confirmed).toBe(true)
        expect(transfer.chain).toBe(chainConfig.chain)
        expect(transfer.token).toBe(chainConfig.token)
        expect(parseFloat(transfer.amount)).toBe(parseFloat(depositAmount))

        console.log(`\n📊 Transfer verification:`)
        console.log(`   Transaction Hash: ${transfer.transaction_hash}`)
        console.log(`   Amount: ${transfer.amount} ${transfer.token}`)
        console.log(`   Confirmed: ${transfer.is_confirmed}`)
        console.log(`   Block: ${transfer.block_number}`)
      }

      console.log(`\n🎉 ${chainConfig.protocol.toUpperCase()} deposit flow test completed successfully!\n`)

    } finally {
      console.log('🧹 Cleaning up...')
      if (processor) await processor.stop()
      await TestUtils.cleanup()
    }
  }, 400000) // 6.5 minutes timeout (longer than order test due to confirmation waiting)
})
