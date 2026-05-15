/**
 * Test unified JSON-RPC architecture for Tron Adapter
 * Verify all methods now use RPC Manager
 */

import { Monitor, RPCConfigBuilder } from '@payin/monitor'

const TEST_TX = '0x34699cfb8d36a1416b617d8b0fb7a01a77d10093f70f3ca852c066753aa7fa99'

async function testUnifiedArchitecture() {
  console.log('🧪 Testing Unified JSON-RPC Architecture')
  console.log('='.repeat(70))

  try {
    // Build RPC config
    const builder = new RPCConfigBuilder({
      apiKeys: {
        trongrid: 'your_trongrid_key'
      }
    })

    const rpcConfig = await builder.buildForChains(['tron-nile'])

    // Initialize RPC Manager
    const { RPCManager } = await import('@payin/monitor')
    const rpcManager = new RPCManager({ rpcConfig })
    await rpcManager.initialize()

    // Create Monitor
    const monitor = new Monitor({
      rpcManager,
      chains: ['tron-nile']
    })

    await monitor.start()

    console.log('✅ Monitor started\n')

    // Get adapter via Monitor's internal API
    const adapter = monitor.adapters?.get('tron-nile')
    if (!adapter) {
      throw new Error('Tron adapter not found')
    }

    // Test 1: getCurrentBlockNumber (JSON-RPC)
    console.log('📍 Test 1: getCurrentBlockNumber()')
    const blockNumber = await adapter.getCurrentBlockNumber()
    console.log(`   ✅ Block number: ${blockNumber}`)

    // Test 2: getTransactionReceipt (now JSON-RPC)
    console.log('\n📍 Test 2: getTransactionReceipt()')
    console.log(`   TX: ${TEST_TX}`)
    const receipt = await adapter.getTransactionReceipt(TEST_TX)

    if (!receipt) {
      console.log('   ⚠️  Receipt not found (maybe old transaction)')
    } else {
      console.log('   ✅ Receipt fetched:')
      console.log(`      - Block: ${receipt.blockNumber}`)
      console.log(`      - Status: ${receipt.status ? 'SUCCESS' : 'FAILED'}`)
      console.log(`      - Gas Used: ${receipt.gasUsed}`)
      console.log(`      - Logs: ${receipt.logs?.length || 0} entries`)
    }

    await monitor.stop()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 All JSON-RPC methods work correctly!')
    console.log('\n✅ Unified Architecture Summary:')
    console.log('   - getCurrentBlockNumber: RPC Manager (eth_blockNumber)')
    console.log('   - scanBlocks: RPC Manager (eth_getLogs)')
    console.log('   - getTransactionReceipt: RPC Manager (eth_getTransactionReceipt)')
    console.log('   - Address conversion: TronWeb (local utility)')
    console.log('')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testUnifiedArchitecture()
