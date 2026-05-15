/**
 * Verify the new problematic transaction
 */

const TRON_NILE_API = 'https://nile.trongrid.io'
const API_KEY = 'your_trongrid_key'

// New transaction from logs
const TX_HASH = '34699cfb8d36a1416b617d8b0fb7a01a77d10093f70f3ca852c066753aa7fa99'

async function verify() {
  console.log('🔍 Verifying Transaction')
  console.log('='.repeat(70))
  console.log(`TX Hash: ${TX_HASH}`)
  console.log('')

  // Test 1: getTransactionInfoById
  console.log('📍 Test: getTransactionInfoById')
  try {
    const response = await fetch(`${TRON_NILE_API}/wallet/gettransactioninfobyid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({ value: TX_HASH })
    })

    const data = await response.json()

    console.log('Response:', JSON.stringify(data, null, 2))

    if (!data.id && !data.blockNumber) {
      console.log('\n⚠️  Empty response - transaction might not exist or not indexed yet')
    } else {
      console.log('\n✅ Transaction found!')
      console.log(`   Block: ${data.blockNumber}`)
      console.log(`   Status: ${data.receipt?.result}`)
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '='.repeat(70) + '\n')
}

verify().catch(console.error)
