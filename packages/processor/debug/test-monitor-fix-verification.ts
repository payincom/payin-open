/**
 * 验证Monitor修复的最小测试
 */
import { Processor } from '../src/processor-legacy.js';

async function testMonitorFix() {
  console.log('🔍 Testing Monitor undefined fix...');
  
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
    await paymentSystem.start();
    
    // 预先添加地址
    console.log('🔑 Adding address to pool...');
    await paymentSystem.depositService.generateAndAddAddresses('evm', 1);
    
    console.log('🔗 Binding address...');
    const result = await paymentSystem.depositService.bindDepositAddress({
      depositReference: 'test_fix_verification',
      chainFamily: 'evm'
    });
    
    console.log('✅ Test completed, check logs above for undefined issues');
    
    await paymentSystem.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMonitorFix();