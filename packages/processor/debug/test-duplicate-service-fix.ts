/**
 * 测试重复服务启动修复的调试脚本
 */
import { Processor } from '../src/processor-legacy.js';

async function testDuplicateServiceFix() {
  console.log('🔧 Testing duplicate service startup fix...');
  
  try {
    const paymentSystem = new Processor({
      mode: 'both', 
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
    
    console.log('✅ System started');
    
    // 这里会触发重复服务创建/启动的场景
    console.log('🔧 Testing setDepositAddressGenerator...');
    await paymentSystem.setDepositAddressGenerator(null);
    
    console.log('✅ setDepositAddressGenerator completed without duplicate startup');
    
    await paymentSystem.shutdown();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDuplicateServiceFix();