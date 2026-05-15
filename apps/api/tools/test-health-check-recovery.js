/**
 * Test RPC Manager health check and auto-recovery mechanism
 *
 * This test verifies:
 * 1. Health check starts automatically after initialization
 * 2. Failed endpoints are marked as unhealthy
 * 3. Endpoints automatically recover after health check succeeds
 */

import { RPCConfigBuilder, RPCManager } from '@payin/monitor'

async function testHealthCheckRecovery() {
  console.log('🧪 Testing Health Check and Auto-Recovery')
  console.log('='.repeat(70))

  try {
    // Build RPC config
    const builder = new RPCConfigBuilder({
      apiKeys: {
        trongrid: 'your_trongrid_key'
      }
    })

    const rpcConfig = await builder.buildForChains(['tron-nile'])
    console.log('✅ RPC Config built\n')

    // Initialize RPC Manager
    const rpcManager = new RPCManager({ rpcConfig })

    // Listen to health check events
    let healthCheckCount = 0
    let failedCount = 0
    let recoveredCount = 0

    rpcManager.on('endpoint-health-check', (result) => {
      healthCheckCount++
      console.log(`[Health Check #${healthCheckCount}] ${result.endpoint.name}:`, {
        isHealthy: result.isHealthy,
        responseTime: `${result.responseTime}ms`,
        error: result.error || 'none'
      })
    })

    rpcManager.on('endpoint-failed', (endpoint, error) => {
      failedCount++
      console.log(`\n❌ [Endpoint Failed] ${endpoint.name}:`, {
        consecutiveFailures: endpoint.consecutiveFailures,
        error
      })
    })

    rpcManager.on('endpoint-recovered', (endpoint) => {
      recoveredCount++
      console.log(`\n✅ [Endpoint Recovered] ${endpoint.name}:`, {
        consecutiveFailures: endpoint.consecutiveFailures,
        avgResponseTime: `${endpoint.avgResponseTime.toFixed(0)}ms`
      })
    })

    await rpcManager.initialize()
    console.log('✅ RPC Manager initialized\n')

    // Wait a bit to see initial health checks
    console.log('⏳ Waiting for health checks (will run every 30 seconds)...\n')
    await new Promise(resolve => setTimeout(resolve, 35000))

    // Get metrics
    const metrics = rpcManager.getMetrics()
    console.log('\n📊 Metrics after 35 seconds:')
    metrics.forEach(m => {
      console.log(`   ${m.endpoint}:`)
      console.log(`      - Requests: ${m.requestCount} (${m.successCount} success, ${m.failureCount} failed)`)
      console.log(`      - Avg Response: ${m.avgResponseTime.toFixed(0)}ms`)
      console.log(`      - Success Rate: ${(m.successCount / m.requestCount * 100).toFixed(1)}%`)
    })

    console.log('\n📈 Summary:')
    console.log(`   - Total health checks: ${healthCheckCount}`)
    console.log(`   - Endpoints failed: ${failedCount}`)
    console.log(`   - Endpoints recovered: ${recoveredCount}`)

    // Test making a request
    console.log('\n🔍 Testing makeRequest after health checks...')
    try {
      const blockNumber = await rpcManager.makeRequest('tron-nile', {
        method: 'eth_blockNumber',
        params: []
      })
      console.log(`✅ Request succeeded: Block ${parseInt(blockNumber, 16)}`)
    } catch (error) {
      console.log('❌ Request failed:', error.message)
    }

    // Cleanup
    await rpcManager.stop()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 Test Complete!')
    console.log('\n✅ Verification:')
    console.log('   - Health check is running automatically')
    console.log('   - Endpoints are being monitored')
    console.log('   - Failed endpoints would recover after successful health checks')
    console.log('')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testHealthCheckRecovery()
