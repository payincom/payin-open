/**
 * Test that tron-nile RPC configuration works correctly
 * Verifies the networkMappings fix
 */

import { RPCConfigBuilder } from '@payin/monitor'

async function testTronNileConfig() {
  console.log('🧪 Testing Tron Nile RPC Configuration')
  console.log('='.repeat(70))

  try {
    // Create RPC config builder
    const builder = new RPCConfigBuilder({
      apiKeys: {
        trongrid: 'your_trongrid_key'
      }
    })

    console.log('\n📍 Building RPC config for tron-nile...')
    const rpcConfig = await builder.buildForChains(['tron-nile'])

    if (!rpcConfig.chains['tron-nile']) {
      console.log('❌ FAILED: No config generated for tron-nile')
      console.log('Available chains:', Object.keys(rpcConfig.chains))
      process.exit(1)
    }

    console.log('✅ SUCCESS: Config generated for tron-nile')

    const chainConfig = rpcConfig.chains['tron-nile']
    console.log(`\n📋 Chain: ${chainConfig.chain}`)
    console.log(`Strategy: ${chainConfig.strategy}`)
    console.log(`Endpoints: ${chainConfig.endpoints.length}`)

    chainConfig.endpoints.forEach((endpoint, i) => {
      console.log(`\n   Endpoint ${i + 1}:`)
      console.log(`   - Provider: ${endpoint.provider}`)
      console.log(`   - URL: ${endpoint.url}`)
      console.log(`   - Weight: ${endpoint.weight}`)
      console.log(`   - Enabled: ${endpoint.enabled}`)
    })

    // Verify URL is correct
    const trongridEndpoint = chainConfig.endpoints.find(e => e.provider === 'trongrid')
    if (!trongridEndpoint) {
      console.log('\n❌ FAILED: TronGrid endpoint not found')
      process.exit(1)
    }

    const expectedUrl = 'https://nile.trongrid.io/jsonrpc'
    if (trongridEndpoint.url !== expectedUrl) {
      console.log(`\n❌ FAILED: URL mismatch`)
      console.log(`   Expected: ${expectedUrl}`)
      console.log(`   Got: ${trongridEndpoint.url}`)
      process.exit(1)
    }

    console.log(`\n✅ URL correct: ${trongridEndpoint.url}`)
    console.log('\n' + '='.repeat(70))
    console.log('🎉 All tests passed!\n')

  } catch (error) {
    console.log('\n❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testTronNileConfig()
