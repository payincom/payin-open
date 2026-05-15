/**
 * Debug script to check user fields
 */

import { Pool } from 'pg';

const connectionString = 'postgresql://postgres:postgres@localhost:5432/payin_test';

async function debugUser() {
  const pool = new Pool({ connectionString });

  try {
    // Query without field renaming
    const result1 = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    console.log('Query 1 (SELECT *):');
    console.log(JSON.stringify(result1.rows[0], null, 2));

    // Query with field renaming
    const result2 = await pool.query(
      `SELECT id, username, email, password_hash AS "passwordHash",
              role, is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE username = $1`,
      ['admin']
    );
    console.log('\nQuery 2 (with AS):');
    console.log(JSON.stringify(result2.rows[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugUser();
