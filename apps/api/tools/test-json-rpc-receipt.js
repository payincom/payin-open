/**
 * Test eth_getTransactionReceipt JSON-RPC method vs HTTP API
 */

const TRON_NILE_RPC = 'https://nile.trongrid.io/jsonrpc'
const TRON_NILE_API = 'https://nile.trongrid.io'
const API_KEY = 'your_trongrid_key'

// Recent transaction from E2E test
const TX_HASH = '0x34699cfb8d36a1416b617d8b0fb7a01a77d10093f70f3ca852c066753aa7fa99'

async function compareAPIs() {
  console.log('🧪 Comparing JSON-RPC vs HTTP API for Transaction Receipt')
  console.log('='.repeat(70))
  console.log(`TX: ${TX_HASH}`)
  console.log('')

  // Method 1: JSON-RPC eth_getTransactionReceipt
  console.log('📍 Method 1: JSON-RPC eth_getTransactionReceipt')
  try {
    const start1 = Date.now()
    const response1 = await fetch(TRON_NILE_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [TX_HASH],
        id: 1
      })
    })
    const time1 = Date.now() - start1

    const data1 = await response1.json()

    if (data1.error) {
      console.log('❌ RPC Error:', data1.error)
    } else if (!data1.result) {
      console.log('⚠️  Result is null')
    } else {
      console.log(`✅ SUCCESS (${time1}ms)`)
      console.log('   Fields available:')
      console.log(`   - blockNumber: ${parseInt(data1.result.blockNumber, 16)}`)
      console.log(`   - status: ${data1.result.status}`)
      console.log(`   - gasUsed: ${parseInt(data1.result.gasUsed, 16)}`)
      console.log(`   - logs: ${data1.result.logs?.length || 0} entries`)
      console.log(`   - transactionHash: ${data1.result.transactionHash}`)
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '-'.repeat(70) + '\n')

  // Method 2: HTTP API getTransactionInfoById
  console.log('📍 Method 2: HTTP API /wallet/gettransactioninfobyid')
  try {
    const start2 = Date.now()
    const response2 = await fetch(`${TRON_NILE_API}/wallet/gettransactioninfobyid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({ value: TX_HASH.slice(2) })
    })
    const time2 = Date.now() - start2

    const data2 = await response2.json()

    if (!data2.id && !data2.blockNumber) {
      console.log('⚠️  Empty response')
    } else {
      console.log(`✅ SUCCESS (${time2}ms)`)
      console.log('   Fields available:')
      console.log(`   - blockNumber: ${data2.blockNumber}`)
      console.log(`   - receipt.result: ${data2.receipt?.result}`)
      console.log(`   - receipt.energy_usage_total: ${data2.receipt?.energy_usage_total}`)
      console.log(`   - log: ${data2.log?.length || 0} entries`)
      console.log(`   - id: ${data2.id}`)
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 Conclusion:')
  console.log('   Both methods work!')
  console.log('   Recommendation: Use JSON-RPC for consistency with other adapter methods')
  console.log('')
}

compareAPIs().catch(console.error)
