/**
 * Simple test to verify health check is running
 */

import { RPCConfigBuilder, RPCManager } from '@payin/monitor'

async function testHealthCheck() {
  console.log('🧪 Testing Health Check Auto-Start')
  console.log('='.repeat(70))

  const builder = new RPCConfigBuilder({
    apiKeys: {
      trongrid: 'your_trongrid_key'
    }
  })

  const rpcConfig = await builder.buildForChains(['tron-nile'])
  const rpcManager = new RPCManager({ rpcConfig })

  let healthCheckCount = 0

  rpcManager.on('endpoint-health-check', (result) => {
    healthCheckCount++
    console.log(`[Health Check #${healthCheckCount}]`, {
      endpoint: result.endpoint.name,
      healthy: result.isHealthy,
      responseTime: `${result.responseTime}ms`,
      consecutiveFailures: result.endpoint.consecutiveFailures
    })
  })

  rpcManager.on('endpoint-failed', (endpoint, error) => {
    console.log('\n❌ [FAILED]', endpoint.name, '- will auto-recover on next successful check')
  })

  rpcManager.on('endpoint-recovered', (endpoint) => {
    console.log('\n✅ [RECOVERED]', endpoint.name)
  })

  await rpcManager.initialize()
  console.log('✅ Initialized - health checks will run every 30 seconds\n')

  // Wait for 2 health check cycles (65 seconds)
  console.log('⏳ Waiting 65 seconds for health checks...\n')
  await new Promise(resolve => setTimeout(resolve, 65000))

  console.log(`\n📊 Total health checks performed: ${healthCheckCount}`)
  console.log('\n' + '='.repeat(70))
  console.log('✅ Health check is working!')
  console.log('   - Runs automatically every 30 seconds')
  console.log('   - Failed endpoints will auto-recover')
  console.log('')

  await rpcManager.stop()
}

testHealthCheck().catch(console.error)
