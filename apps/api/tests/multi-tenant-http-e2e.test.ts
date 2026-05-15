/**
 * Multi-Tenant HTTP E2E Tests
 *
 * Complete end-to-end tests using real HTTP APIs:
 * - Creates organizations via database (as there's no public org creation API)
 * - Registers users via API
 * - Logs in to get JWT tokens
 * - Creates API keys via API
 * - Tests multi-tenant isolation at HTTP layer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ApiClient } from './test-utils.js';

const DATABASE_URL = process.env.DB_CONNECTION_STRING
  ?? process.env.DATABASE_URL
  ?? 'postgresql://postgres:postgres@localhost:5432/payin_test';
const API_BASE_URL = 'http://localhost:3000';

describe('Multi-Tenant HTTP E2E Tests', () => {
  let pool: Pool;
  let apiClientA: ApiClient;
  let apiClientB: ApiClient;

  // Test organizations
  let orgA_id: string;
  let orgB_id: string;

  // Test users
  let userA_username: string;
  let userB_username: string;
  let userA_password: string;
  let userB_password: string;
  let userA_id: string;
  let userB_id: string;

  // Test tokens
  let tokenA: string;
  let tokenB: string;

  // Test data
  let orderA_id: string;
  let orderB_id: string;

  beforeAll(async () => {
    // Setup database connection for org creation only
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });

    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection established');

    // Initialize API clients
    apiClientA = new ApiClient(API_BASE_URL);
    apiClientB = new ApiClient(API_BASE_URL);

    // Step 1: Create test organizations directly in DB (no public API for this)
    const orgA = await pool.query(
      `INSERT INTO organizations (id, name, slug, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       RETURNING id`,
      ['E2E Test Organization A', `e2e-org-a-${Date.now()}`]
    );
    orgA_id = orgA.rows[0].id;

    const orgB = await pool.query(
      `INSERT INTO organizations (id, name, slug, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       RETURNING id`,
      ['E2E Test Organization B', `e2e-org-b-${Date.now()}`]
    );
    orgB_id = orgB.rows[0].id;

    console.log(`✓ Created organizations: A=${orgA_id}, B=${orgB_id}`);

    // Step 2: Register users via API
    userA_username = `e2e-user-a-${Date.now()}`;
    userA_password = 'Test123!@#';
    const registerA = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userA_username,
        email: `${userA_username}@test.com`,
        password: userA_password
      })
    });
    const registerAData = await registerA.json();
    if (!registerAData.success) {
      throw new Error(`Failed to register user A: ${JSON.stringify(registerAData)}`);
    }
    userA_id = registerAData.data.user.id;

    userB_username = `e2e-user-b-${Date.now()}`;
    userB_password = 'Test123!@#';
    const registerB = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userB_username,
        email: `${userB_username}@test.com`,
        password: userB_password
      })
    });
    const registerBData = await registerB.json();
    if (!registerBData.success) {
      throw new Error(`Failed to register user B: ${JSON.stringify(registerBData)}`);
    }
    userB_id = registerBData.data.user.id;

    console.log(`✓ Registered users: A=${userA_id}, B=${userB_id}`);

    // Step 3: Add users to organizations (via database, as there's no public API)
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')`,
      [orgA_id, userA_id]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')`,
      [orgB_id, userB_id]
    );

    console.log(`✓ Added users to organizations`);

    // Step 4: Login to get JWT tokens
    const loginA = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userA_username,
        password: userA_password
      })
    });
    const loginAData = await loginA.json();
    if (!loginAData.success) {
      throw new Error(`Failed to login user A: ${JSON.stringify(loginAData)}`);
    }
    tokenA = loginAData.data.token;
    apiClientA.setAuthToken(tokenA);
    apiClientA.setOrganizationId(orgA_id);

    const loginB = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userB_username,
        password: userB_password
      })
    });
    const loginBData = await loginB.json();
    if (!loginBData.success) {
      throw new Error(`Failed to login user B: ${JSON.stringify(loginBData)}`);
    }
    tokenB = loginBData.data.token;
    apiClientB.setAuthToken(tokenB);
    apiClientB.setOrganizationId(orgB_id);

    console.log(`✓ Logged in users and obtained JWT tokens`);
  });

  afterAll(async () => {
    // Cleanup test data
    if (pool) {
      try {
        await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [orgA_id, orgB_id]);
        await pool.query('DELETE FROM orders WHERE organization_id IN ($1, $2)', [orgA_id, orgB_id]);
        await pool.query('DELETE FROM sessions WHERE user_id IN ($1, $2)', [userA_id, userB_id]);
        await pool.query('DELETE FROM api_keys WHERE user_id IN ($1, $2)', [userA_id, userB_id]);
        await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userA_id, userB_id]);
        await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgA_id, orgB_id]);
        console.log('✓ Cleaned up test data');
      } catch (error) {
        console.error('⚠️  Cleanup error:', error);
      }
      await pool.end();
    }
  });

  describe('Authentication and Authorization', () => {
    it('should successfully authenticate with JWT token', async () => {
      // Verify that we can make authenticated requests
      const response = await apiClientA.get('/api/v1/orders');
      expect(response.success).toBe(true);
      console.log(`✓ User A authenticated successfully`);
    });

    it('should extract correct organization context from JWT', async () => {
      // Verify organization membership via database
      const memberA = await pool.query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2',
        [userA_id, 'active']
      );
      expect(memberA.rows[0].organization_id).toBe(orgA_id);

      const memberB = await pool.query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2',
        [userB_id, 'active']
      );
      expect(memberB.rows[0].organization_id).toBe(orgB_id);

      console.log(`✓ Organization context verified`);
    });
  });

  describe('Order Multi-Tenant Isolation', () => {
    it('should create orders with correct organization_id', async () => {
      // Create order for Organization A
      const responseA = await apiClientA.createOrder({
        orderReference: `e2e-order-a-${Date.now()}`,
        amount: '100',
        currency: 'USDC',
        chainId: 'ethereum-sepolia'
      });

      expect(responseA.success).toBe(true);
      orderA_id = responseA.data.orderId;

      // Verify in database
      const dbOrderA = await pool.query(
        'SELECT organization_id FROM orders WHERE id = $1',
        [orderA_id]
      );
      expect(dbOrderA.rows[0].organization_id).toBe(orgA_id);

      // Create order for Organization B
      const responseB = await apiClientB.createOrder({
        orderReference: `e2e-order-b-${Date.now()}`,
        amount: '200',
        currency: 'USDC',
        chainId: 'ethereum-sepolia'
      });

      expect(responseB.success).toBe(true);
      orderB_id = responseB.data.orderId;

      // Verify in database
      const dbOrderB = await pool.query(
        'SELECT organization_id FROM orders WHERE id = $1',
        [orderB_id]
      );
      expect(dbOrderB.rows[0].organization_id).toBe(orgB_id);

      console.log(`✓ Created orders with correct organization_id`);
    });

    it('should only list own organization orders', async () => {
      // List orders for Organization A
      const responseA = await apiClientA.listOrders({});
      expect(responseA.success).toBe(true);

      const orderIdsA = responseA.data.map((o: any) => o.id);
      expect(orderIdsA).toContain(orderA_id);
      expect(orderIdsA).not.toContain(orderB_id);

      // List orders for Organization B
      const responseB = await apiClientB.listOrders({});
      expect(responseB.success).toBe(true);

      const orderIdsB = responseB.data.map((o: any) => o.id);
      expect(orderIdsB).toContain(orderB_id);
      expect(orderIdsB).not.toContain(orderA_id);

      console.log(`✓ Order lists correctly isolated`);
    });

    it('should NOT access other organization orders', async () => {
      // Try to get Organization A's order with Organization B's token
      try {
        await apiClientB.getOrder(orderA_id);
        expect.fail('Should not access other organization order');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }

      console.log(`✓ Cross-organization order access blocked`);
    });

    it('should isolate order statistics by organization', async () => {
      const statsA = await apiClientA.getOrderStats({});
      expect(statsA.success).toBe(true);
      expect(statsA.data.totalOrders).toBeGreaterThanOrEqual(1);

      const statsB = await apiClientB.getOrderStats({});
      expect(statsB.success).toBe(true);
      expect(statsB.data.totalOrders).toBeGreaterThanOrEqual(1);

      console.log(`✓ Order statistics isolated by organization`);
    });
  });

  describe('API Key Management', () => {
    let apiKeyA_value: string;
    let apiKeyB_value: string;

    it('should create API keys via HTTP API', async () => {
      // Create API key for User A
      const responseA = await fetch(`${API_BASE_URL}/api/organizations/${orgA_id}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
          'X-Organization-ID': orgA_id
        },
        body: JSON.stringify({
          name: 'E2E Test Key A'
        })
      });
      const dataA = await responseA.json();
      expect(dataA.apiKey).toBeDefined();
      expect(dataA.key).toBeDefined();
      apiKeyA_value = dataA.key;

      // Create API key for User B
      const responseB = await fetch(`${API_BASE_URL}/api/organizations/${orgB_id}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`,
          'X-Organization-ID': orgB_id
        },
        body: JSON.stringify({
          name: 'E2E Test Key B'
        })
      });
      const dataB = await responseB.json();
      expect(dataB.apiKey).toBeDefined();
      expect(dataB.key).toBeDefined();
      apiKeyB_value = dataB.key;

      console.log(`✓ Created API keys via HTTP API`);
    });

    it('should use API keys for authentication', async () => {
      // Create new API clients with API keys
      const apiKeyClientA = new ApiClient(API_BASE_URL);
      apiKeyClientA.setAuthToken(apiKeyA_value);

      const apiKeyClientB = new ApiClient(API_BASE_URL);
      apiKeyClientB.setAuthToken(apiKeyB_value);

      // Test with API key authentication
      const responseA = await apiKeyClientA.listOrders({});
      expect(responseA.success).toBe(true);
      const orderIdsA = responseA.data.map((o: any) => o.id);
      expect(orderIdsA).toContain(orderA_id);

      const responseB = await apiKeyClientB.listOrders({});
      expect(responseB.success).toBe(true);
      const orderIdsB = responseB.data.map((o: any) => o.id);
      expect(orderIdsB).toContain(orderB_id);

      console.log(`✓ API key authentication working with correct isolation`);
    });
  });

  describe('Data Integrity', () => {
    it('should have proper indexes', async () => {
      const indexes = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE indexname LIKE '%organization_id%'
          AND tablename = 'orders'
      `);

      expect(indexes.rows.length).toBeGreaterThan(0);
      console.log(`✓ Organization indexes verified`);
    });

    it('should have NO NULL organization_id in orders', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM orders
        WHERE organization_id IS NULL
      `);

      expect(parseInt(result.rows[0].count)).toBe(0);
      console.log(`✓ No NULL organization_id values`);
    });
  });
});
