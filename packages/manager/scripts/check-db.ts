import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/payin_test';

const pool = new Pool({ connectionString: DATABASE_URL });

async function checkData() {
  try {
    console.log('📊 Checking Orders...\n');
    const orders = await pool.query(`
      SELECT order_id, order_reference, status, amount, currency, chain_id, 
             payment_address, created_at, completed_at
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('Recent Orders:');
    console.table(orders.rows);

    console.log('\n📊 Checking Transfers...\n');
    const transfers = await pool.query(`
      SELECT transfer_id, order_id, deposit_reference_id, transaction_hash, 
             amount, chain, is_confirmed, block_number, created_at
      FROM transfers 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('Recent Transfers:');
    console.table(transfers.rows);

    // Check specific order from test
    console.log('\n📊 Checking test order a192b7d2-f0a8-43d2-804a-13856a7d3075...\n');
    const testOrder = await pool.query(`
      SELECT * FROM orders WHERE order_id = 'a192b7d2-f0a8-43d2-804a-13856a7d3075'
    `);
    console.log('Test Order:');
    console.table(testOrder.rows);

    const testTransfers = await pool.query(`
      SELECT * FROM transfers WHERE order_id = 'a192b7d2-f0a8-43d2-804a-13856a7d3075'
    `);
    console.log('\nTest Order Transfers:');
    console.table(testTransfers.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkData();
