/**
 * Test login flow directly
 */

import { AuthManager } from '@payin/auth';

const connectionString = 'postgresql://postgres:postgres@localhost:5432/payin_test';

async function testLogin() {
  const authManager = new AuthManager({
    connectionString,
    jwtSecret: 'test-secret',
    tokenExpiration: '24h'
  });

  try {
    console.log('Testing login...\n');

    const result = await authManager.login({
      username: 'admin',
      password: 'admin123'
    });

    console.log('Login result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await authManager.close();
  }
}

testLogin();
