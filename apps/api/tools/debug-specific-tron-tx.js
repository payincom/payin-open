/**
 * Debug specific Tron transaction that fails to confirm
 * Transaction: 0xc93f2d44379ee8683ecf541950df743260402d5ea0ab57dedbdcf073c1553d16
 */

const TRON_NILE_RPC = 'https://nile.trongrid.io/jsonrpc'
const TRON_NILE_API = 'https://nile.trongrid.io'
const API_KEY = 'your_trongrid_key'

// The problematic transaction hash from logs
const PROBLEM_TX = '0xc93f2d44379ee8683ecf541950df743260402d5ea0ab57dedbdcf073c1553d16'
const PROBLEM_TX_NO_PREFIX = PROBLEM_TX.slice(2)

async function debugTransaction() {
  console.log('🔍 Debugging Specific Tron Transaction')
  console.log('='.repeat(70))
  console.log(`Transaction: ${PROBLEM_TX}`)
  console.log(`Without 0x: ${PROBLEM_TX_NO_PREFIX}`)
  console.log('')

  // Test 1: Try eth_getTransactionReceipt (JSON-RPC)
  console.log('📍 Test 1: eth_getTransactionReceipt (with 0x prefix)')
  try {
    const response1 = await fetch(TRON_NILE_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [PROBLEM_TX],
        id: 1
      })
    })

    const data1 = await response1.json()
    if (data1.error) {
      console.log('❌ RPC Error:', data1.error)
    } else if (!data1.result) {
      console.log('⚠️  Result is null - transaction not found via eth_getTransactionReceipt')
    } else {
      console.log('✅ Found via eth_getTransactionReceipt:')
      console.log(JSON.stringify(data1.result, null, 2))
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '-'.repeat(70) + '\n')

  // Test 2: Try getTransactionInfoById (Tron HTTP API)
  console.log('📍 Test 2: getTransactionInfoById (without 0x prefix)')
  try {
    const response2 = await fetch(`${TRON_NILE_API}/wallet/gettransactioninfobyid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({ value: PROBLEM_TX_NO_PREFIX })
    })

    const data2 = await response2.json()
    if (data2.Error) {
      console.log('❌ API Error:', data2.Error)
    } else if (!data2.id && !data2.blockNumber) {
      console.log('⚠️  Empty response - transaction not found')
      console.log('Response:', JSON.stringify(data2))
    } else {
      console.log('✅ Found via getTransactionInfoById:')
      console.log(`   ID: ${data2.id}`)
      console.log(`   Block: ${data2.blockNumber}`)
      console.log(`   Status: ${data2.receipt?.result || 'N/A'}`)
      console.log(`   Full response:`)
      console.log(JSON.stringify(data2, null, 2))
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '-'.repeat(70) + '\n')

  // Test 3: Try getTransactionById to see if transaction exists at all
  console.log('📍 Test 3: getTransactionById (check if transaction exists)')
  try {
    const response3 = await fetch(`${TRON_NILE_API}/wallet/gettransactionbyid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({ value: PROBLEM_TX_NO_PREFIX })
    })

    const data3 = await response3.json()
    if (data3.Error) {
      console.log('❌ API Error:', data3.Error)
    } else if (!data3.txID) {
      console.log('⚠️  Transaction does NOT exist in blockchain')
      console.log('Response:', JSON.stringify(data3))
    } else {
      console.log('✅ Transaction exists:')
      console.log(`   TX ID: ${data3.txID}`)
      console.log(`   Full response:`)
      console.log(JSON.stringify(data3, null, 2))
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '-'.repeat(70) + '\n')

  // Test 4: Search in recent logs to see if it was ever emitted
  console.log('📍 Test 4: Check if transaction appears in eth_getLogs')
  try {
    // Get current block
    const blockResponse = await fetch(TRON_NILE_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    })
    const blockData = await blockResponse.json()
    const currentBlock = parseInt(blockData.result, 16)

    console.log(`Current block: ${currentBlock}`)
    console.log('Scanning last 1000 blocks for this transaction...')

    const scanFrom = currentBlock - 1000
    const logsResponse = await fetch(TRON_NILE_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TRON-PRO-API-KEY': API_KEY
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${scanFrom.toString(16)}`,
          toBlock: `0x${currentBlock.toString(16)}`,
          topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']
        }],
        id: 1
      })
    })

    const logsData = await logsResponse.json()
    if (logsData.error) {
      console.log('❌ RPC Error:', logsData.error)
    } else {
      const logs = logsData.result || []
      const foundLog = logs.find(log => log.transactionHash === PROBLEM_TX)

      if (foundLog) {
        console.log('✅ Found in eth_getLogs!')
        console.log('Log details:', JSON.stringify(foundLog, null, 2))
      } else {
        console.log('⚠️  NOT found in recent eth_getLogs')
        console.log(`Scanned ${logs.length} transfer events, none match this txHash`)
      }
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🏁 Debug Complete\n')
}

debugTransaction().catch(console.error)
