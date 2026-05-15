/**
 * 测试Monitor方法签名和返回值
 */
import { Processor } from '../src/processor-legacy.js';

async function testMonitorMethodSignature() {
  console.log('🔍 Testing Monitor method signature...');
  
  try {
    const paymentSystem = new Processor({
      mode: 'deposit', 
      database: { path: ':memory:' }
    });
    
    await paymentSystem.initialize();
    
    // 获取Monitor实例
    const monitor = paymentSystem.getMonitor();
    console.log('📊 Monitor instance obtained');
    
    // 测试直接调用watchAddressMatrix
    console.log('🔧 Testing direct watchAddressMatrix call...');
    
    const tokenContracts = {
      'ethereum-sepolia': {
        'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      }
    };
    
    try {
      console.log('📝 Parameters to be passed:');
      console.log('  - address: 0x1234567890123456789012345678901234567890');
      console.log('  - chainFamily: evm');
      console.log('  - tokenContracts:', tokenContracts);
      
      const result = await monitor.watchAddressMatrix(
        '0x1234567890123456789012345678901234567890',
        'evm',
        tokenContracts
      );
      
      console.log('✅ watchAddressMatrix result:', result);
      
    } catch (error) {
      console.log('❌ Direct call error:', error.message);
      
      // 尝试使用旧的参数签名
      console.log('🔧 Trying with additional parameters...');
      try {
        const resultWithOldParams = await monitor.watchAddressMatrix(
          '0x1234567890123456789012345678901234567890',
          'evm', 
          tokenContracts,
          'deposit',  // businessType
          'test_user' // businessId
        );
        
        console.log('✅ watchAddressMatrix with old params result:', resultWithOldParams);
      } catch (oldError) {
        console.log('❌ Old params call also failed:', oldError.message);
      }
    }
    
    await paymentSystem.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMonitorMethodSignature();