/**
 * Test provider network matching logic
 * Verify that the fix for checking networkMappings keys works correctly
 */

import { getProvidersForNetwork } from '@payin/monitor/dist/rpc/config/provider-templates.js'
import { loadMonitorConfig } from '@payin/monitor/dist/config/config-loader.js'

async function testProviderMatching() {
  console.log('🧪 Testing Provider Network Matching')
  console.log('='.repeat(70))

  // Load config
  const config = await loadMonitorConfig()

  console.log('\n📋 Available providers:')
  Object.keys(config.rpc.providers).forEach(name => {
    console.log(`   - ${name}`)
  })

  // Test 1: tron-nile matching
  console.log('\n📍 Test: getProvidersForNetwork(providers, "tron-nile")')
  const tronNileProviders = getProvidersForNetwork(config.rpc.providers, 'tron-nile')

  if (tronNileProviders.length === 0) {
    console.log('❌ FAILED: No providers found for tron-nile')
  } else {
    console.log(`✅ Found ${tronNileProviders.length} provider(s):`)
    tronNileProviders.forEach(p => {
      console.log(`   - ${p.name} (${p.displayName})`)
      console.log(`     supportedNetworks: [${p.supportedNetworks.join(', ')}]`)
      console.log(`     networkMappings: ${JSON.stringify(p.networkMappings || {})}`)
    })
  }

  // Test 2: tron-mainnet matching
  console.log('\n📍 Test: getProvidersForNetwork(providers, "tron-mainnet")')
  const tronMainnetProviders = getProvidersForNetwork(config.rpc.providers, 'tron-mainnet')

  if (tronMainnetProviders.length === 0) {
    console.log('❌ FAILED: No providers found for tron-mainnet')
  } else {
    console.log(`✅ Found ${tronMainnetProviders.length} provider(s):`)
    tronMainnetProviders.forEach(p => {
      console.log(`   - ${p.name} (${p.displayName})`)
    })
  }

  // Test 3: ethereum-sepolia matching (should still work)
  console.log('\n📍 Test: getProvidersForNetwork(providers, "ethereum-sepolia")')
  const sepoliaProviders = getProvidersForNetwork(config.rpc.providers, 'ethereum-sepolia')

  if (sepoliaProviders.length === 0) {
    console.log('❌ FAILED: No providers found for ethereum-sepolia')
  } else {
    console.log(`✅ Found ${sepoliaProviders.length} provider(s):`)
    sepoliaProviders.forEach(p => {
      console.log(`   - ${p.name} (${p.displayName})`)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('🏁 Test Complete\n')
}

testProviderMatching().catch(console.error)
