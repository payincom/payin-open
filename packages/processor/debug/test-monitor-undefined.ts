/**
 * 专门测试Monitor中undefined问题的脚本
 */
import { Processor } from '../src/processor-legacy.js';

async function testMonitorUndefined() {
  console.log('🔍 Testing Monitor undefined issue...');
  
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
    
    // 预先添加地址到池中  
    console.log('🔑 Adding addresses to pool...');
    await paymentSystem.depositService.generateAndAddAddresses('evm', 1);
    
    await paymentSystem.start();
    
    console.log('🔗 Testing address binding...');
    const result = await paymentSystem.depositService.bindDepositAddress({
      depositReference: 'test_user_monitor',
      chainFamily: 'evm'
    });
    
    console.log('✅ Address bound without undefined issues:', result.address);
    
    await paymentSystem.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMonitorUndefined();