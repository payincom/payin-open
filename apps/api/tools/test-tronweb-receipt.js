/**
 * Test TronWeb getTransactionInfo directly
 * To verify if the issue is with TronWeb initialization or transaction hash format
 */

import { TronWeb } from 'tronweb'

const TRON_NILE_URL = 'https://nile.trongrid.io'
const API_KEY = 'your_trongrid_key'

// The problematic transaction from logs
const PROBLEM_TX_WITH_PREFIX = '0xc93f2d44379ee8683ecf541950df743260402d5ea0ab57dedbdcf073c1553d16'
const PROBLEM_TX_NO_PREFIX = 'c93f2d44379ee8683ecf541950df743260402d5ea0ab57dedbdcf073c1553d16'

async function testTronWebReceipt() {
  console.log('🧪 Testing TronWeb getTransactionInfo')
  console.log('='.repeat(70))

  // Test 1: TronWeb WITHOUT API key (current implementation)
  console.log('\n📍 Test 1: TronWeb WITHOUT API key')
  console.log(`Initializing with: ${TRON_NILE_URL}`)

  const tronWebNoKey = new TronWeb({
    fullHost: TRON_NILE_URL
  })

  console.log(`\nTrying transaction: ${PROBLEM_TX_NO_PREFIX}`)

  try {
    const info1 = await tronWebNoKey.trx.getTransactionInfo(PROBLEM_TX_NO_PREFIX)

    if (!info1 || !info1.blockNumber) {
      console.log('❌ FAILED: No blockNumber in response')
      console.log('Response:', JSON.stringify(info1))
    } else {
      console.log('✅ SUCCESS:')
      console.log(`   Block: ${info1.blockNumber}`)
      console.log(`   Status: ${info1.receipt?.result}`)
    }
  } catch (error) {
    console.log('❌ EXCEPTION:', error.message)
  }

  // Test 2: TronWeb WITH API key
  console.log('\n' + '-'.repeat(70))
  console.log('\n📍 Test 2: TronWeb WITH API key')
  console.log(`Initializing with: ${TRON_NILE_URL} + API key`)

  const tronWebWithKey = new TronWeb({
    fullHost: TRON_NILE_URL,
    headers: { 'TRON-PRO-API-KEY': API_KEY }
  })

  console.log(`\nTrying transaction: ${PROBLEM_TX_NO_PREFIX}`)

  try {
    const info2 = await tronWebWithKey.trx.getTransactionInfo(PROBLEM_TX_NO_PREFIX)

    if (!info2 || !info2.blockNumber) {
      console.log('❌ FAILED: No blockNumber in response')
      console.log('Response:', JSON.stringify(info2))
    } else {
      console.log('✅ SUCCESS:')
      console.log(`   Block: ${info2.blockNumber}`)
      console.log(`   Status: ${info2.receipt?.result}`)
    }
  } catch (error) {
    console.log('❌ EXCEPTION:', error.message)
  }

  // Test 3: Try with 0x prefix (should handle it)
  console.log('\n' + '-'.repeat(70))
  console.log('\n📍 Test 3: Try with 0x prefix (adapter strips it)')

  const txToTest = PROBLEM_TX_WITH_PREFIX.startsWith('0x')
    ? PROBLEM_TX_WITH_PREFIX.slice(2)
    : PROBLEM_TX_WITH_PREFIX

  console.log(`Original: ${PROBLEM_TX_WITH_PREFIX}`)
  console.log(`After strip: ${txToTest}`)

  try {
    const info3 = await tronWebWithKey.trx.getTransactionInfo(txToTest)

    if (!info3 || !info3.blockNumber) {
      console.log('❌ FAILED: No blockNumber in response')
      console.log('Response:', JSON.stringify(info3))
    } else {
      console.log('✅ SUCCESS:')
      console.log(`   Block: ${info3.blockNumber}`)
      console.log(`   Status: ${info3.receipt?.result}`)
    }
  } catch (error) {
    console.log('❌ EXCEPTION:', error.message)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🏁 Test Complete\n')
}

testTronWebReceipt().catch(console.error)
