/**
 * 专门测试Monitor回调中undefined问题的最小脚本
 */
import { Processor } from '../src/processor-legacy.js';

async function testMonitorCallback() {
  console.log('🔍 Testing Monitor callback undefined issue...');
  
  try {
    const paymentSystem = new Processor({
      mode: 'deposit', 
      database: { path: ':memory:' },
      monitor: {
        rpcManager: {
          chains: {
            'ethereum-sepolia': {
              providers: { 
                publicnode: { weight: 1 }
              }
            }
          }
        }
      }
    });
    
    await paymentSystem.initialize();
    
    // 手动添加一个地址到池中
    console.log('🔧 Adding test address...');
    await paymentSystem.depositService.generateAndAddAddresses('evm', 1);
    
    await paymentSystem.start();
    
    console.log('🔗 Testing single address binding...');
    const result = await paymentSystem.depositService.bindDepositAddress({
      depositReference: 'test_monitor_callback',
      chainFamily: 'evm'
    });
    
    console.log('✅ Address bound:', result.address);
    console.log('📊 Monitoring targets:', result.monitoringTargets.length);
    
    await paymentSystem.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMonitorCallback();