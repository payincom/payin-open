/**
 * 测试 undefined 参数问题的调试脚本
 */
import { Processor } from '../src/processor-legacy.js';

async function testUndefinedParams() {
  console.log('🔍 Testing undefined parameters issue...');
  
  try {
    // 创建一个最小的测试实例
    const paymentSystem = new Processor({
      mode: 'deposit', 
      database: { path: ':memory:' }
    });
    
    await paymentSystem.initialize();
    await paymentSystem.start();
    
    // 测试绑定地址
    console.log('🔗 Testing address binding...');
    const result = await paymentSystem.depositService.bindDepositAddress({
      depositReference: 'test_user_123',
      chainFamily: 'evm'
    });
    
    console.log('✅ Binding result:', {
      address: result.address,
      targetCount: result.monitoringTargets.length
    });
    
    await paymentSystem.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUndefinedParams();