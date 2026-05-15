/**
 * Script to enable admin user
 */

import { Pool } from 'pg';

const connectionString = 'postgresql://postgres:postgres@localhost:5432/payin_test';

async function fixAdminUser() {
  const pool = new Pool({ connectionString });

  try {
    // Check if admin user exists
    const result = await pool.query('SELECT id, username, is_active FROM users WHERE username = $1', ['admin']);

    if (result.rows.length === 0) {
      console.log('❌ Admin user does not exist');
      return;
    }

    const user = result.rows[0];
    console.log(`Found admin user: ${JSON.stringify(user)}`);

    if (user.is_active) {
      console.log('✅ Admin user is already active');
    } else {
      // Enable admin user
      await pool.query('UPDATE users SET is_active = true WHERE username = $1', ['admin']);
      console.log('✅ Admin user enabled successfully');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixAdminUser();
