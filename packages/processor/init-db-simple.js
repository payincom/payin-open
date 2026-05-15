// 简单的数据库初始化脚本
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:postgres@localhost:5432/payin_test';

console.log('🗄️ 使用 Supabase 数据库连接初始化...');

const client = new Client({
  connectionString: connectionString
});

try {
  await client.connect();
  console.log('✅ 数据库连接建立成功');

  // 删除现有表
  console.log('🗑️ 删除现有表...');
  
  const dropTables = [
    'DROP TABLE IF EXISTS deposits CASCADE',
    'DROP TABLE IF EXISTS user_deposit_addresses CASCADE', 
    'DROP TABLE IF EXISTS deposit_bindings CASCADE',
    'DROP TABLE IF EXISTS deposit_address_pool CASCADE',
    'DROP TABLE IF EXISTS orders CASCADE',
    'DROP TABLE IF EXISTS address_pool CASCADE',
    'DROP TABLE IF EXISTS order_address_pool CASCADE'
  ];
  
  for (const sql of dropTables) {
    await client.query(sql);
    console.log(`✅ 执行: ${sql}`);
  }

  // 创建新的表结构
  console.log('🔧 创建新的表结构...');

  // 订单表
  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      merchant_id VARCHAR(255) NOT NULL DEFAULT 'default',
      amount DECIMAL(20,6) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      chain_id VARCHAR(50) NOT NULL,
      assigned_address VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL CHECK (status IN (
        'pending', 'monitoring', 'paid', 'confirmed', 'completed', 
        'expired', 'cancelled', 'failed', 'payment_window_expired', 
        'partially_paid', 'overpaid', 'grace_period_expired'
      )),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      payment_window_minutes INTEGER DEFAULT 10,
      grace_period_minutes INTEGER DEFAULT 5,
      partial_payment_detected_at TIMESTAMP,
      required_amount DECIMAL(20,6) DEFAULT 0.000000,
      received_amount DECIMAL(20,6) DEFAULT 0.000000,
      external_id VARCHAR(255),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ 创建 orders 表');

  // 订单地址池表
  await client.query(`
    CREATE TABLE IF NOT EXISTS order_address_pool (
      id SERIAL PRIMARY KEY,
      address VARCHAR(255) NOT NULL UNIQUE,
      derivation_index INTEGER NOT NULL,
      chain_family VARCHAR(20) NOT NULL,
      master_public_key VARCHAR(68),
      is_allocated BOOLEAN DEFAULT FALSE,
      allocated_to VARCHAR(255),
      allocated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ 创建 order_address_pool 表');

  // 充值地址池表（重构版）
  await client.query(`
    CREATE TABLE IF NOT EXISTS deposit_address_pool (
      id VARCHAR(255) PRIMARY KEY,
      address VARCHAR(255) NOT NULL UNIQUE,
      chain_family VARCHAR(20) NOT NULL CHECK (chain_family IN ('evm', 'tron')),
      bound_to VARCHAR(255),
      bound_at TIMESTAMP,
      master_public_key VARCHAR(68),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✅ 创建 deposit_address_pool 表');

  // 充值记录表
  await client.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      id VARCHAR(255) PRIMARY KEY,
      external_id VARCHAR(255) NOT NULL,
      token VARCHAR(10) NOT NULL,
      chain VARCHAR(50) NOT NULL,
      amount DECIMAL(20,6) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      transaction_hash VARCHAR(255) NOT NULL UNIQUE,
      block_number BIGINT NOT NULL,
      event_index INTEGER NOT NULL,
      confirmations INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      confirmed_at TIMESTAMP
    )
  `);
  console.log('✅ 创建 deposits 表');

  // 创建索引
  console.log('🔧 创建索引...');
  
  const indexes = [
    // orders 表索引
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_assigned_address ON orders(assigned_address)',
    'CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(external_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at)',
    
    // order_address_pool 表索引
    'CREATE INDEX IF NOT EXISTS idx_order_address_pool_allocated ON order_address_pool(is_allocated, chain_family)',
    'CREATE INDEX IF NOT EXISTS idx_order_address_pool_chain_family ON order_address_pool(chain_family)',
    
    // deposit_address_pool 表索引（部分索引优化）
    'CREATE INDEX IF NOT EXISTS idx_deposit_available ON deposit_address_pool(chain_family) WHERE bound_to IS NULL',
    'CREATE INDEX IF NOT EXISTS idx_deposit_bound ON deposit_address_pool(bound_to, chain_family) WHERE bound_to IS NOT NULL',
    
    // deposits 表索引
    'CREATE INDEX IF NOT EXISTS idx_deposits_transaction_hash ON deposits(transaction_hash)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_external_id ON deposits(external_id)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_to_address ON deposits(to_address)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status)',
    'CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at)'
  ];
  
  for (const indexSql of indexes) {
    await client.query(indexSql);
    console.log(`✅ 索引: ${indexSql.substring(0, 60)}...`);
  }
  
  console.log('✅ 数据库初始化完成！重构后的schema已生效');
  console.log('📋 表结构总结:');
  console.log('   - orders: 订单表');
  console.log('   - order_address_pool: 订单地址池'); 
  console.log('   - deposit_address_pool: 充值地址池（重构版，移除了deposit_bindings）');
  console.log('   - deposits: 充值记录');
  console.log('🎯 关键改进:');
  console.log('   - 移除了冗余的deposit_bindings表');
  console.log('   - 使用bound_to字段判断地址绑定状态');
  console.log('   - 添加了部分索引优化查询性能');

} catch (error) {
  console.error('❌ 数据库操作失败:', error.message);
  console.error('详细错误:', error);
} finally {
  await client.end();
  console.log('🔌 数据库连接已关闭');
}