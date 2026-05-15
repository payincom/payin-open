import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ApiClient } from './test-utils.js';

const DATABASE_URL =
  process.env.DB_CONNECTION_STRING ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/payin_test';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

describe('Payment Link API Integration', () => {
  let pool: Pool;
  let apiClient: ApiClient;
  let publicClient: ApiClient;

  let organizationId: string;
  let userId: string;
  let apiKey: string;
  let paymentLinkId: string;
  let paymentLinkSlug: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });

    await pool.query('SELECT 1'); // sanity check

    apiClient = new ApiClient(API_BASE_URL);
    publicClient = new ApiClient(API_BASE_URL);

    const org = await pool.query(
      `INSERT INTO organizations (id, name, slug, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       RETURNING id`,
      ['Payment Link Test Org', `payment-link-test-${Date.now()}`]
    );
    organizationId = org.rows[0].id;

    const user = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [`payment-link-user-${Date.now()}`, `payment-link-${Date.now()}@example.com`, 'dummy_hash']
    );
    userId = user.rows[0].id;

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW())`,
      [organizationId, userId]
    );

    const apiKeyRow = await pool.query(
      `INSERT INTO api_keys (id, user_id, key_prefix, key_hash, name, organization_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [userId, 'pltest', 'dummy_hash_payment_link', 'Payment Link Test Key', organizationId]
    );
    apiKey = `pl_test_${apiKeyRow.rows[0].id}`;

    apiClient.setAuthToken(apiKey);
    apiClient.setOrganizationId(organizationId);

    const masterPublicKey = 'xpub-test-paymentlink';
    for (let i = 0; i < 5; i++) {
      const address = `0x${(Date.now() + i).toString(16).padStart(40, 'a')}`;
      await pool.query(
        `INSERT INTO address_pool (
          address,
          organization_id,
          derivation_index,
          protocol,
          state,
          master_public_key,
          created_at
        ) VALUES ($1, $2, $3, 'evm', 'idle', $4, NOW())
        ON CONFLICT (address) DO NOTHING`,
        [address, organizationId, i + 1, masterPublicKey]
      );
    }
  });

  afterAll(async () => {
    if (pool) {
      try {
        const safeExec = async (sql: string, params: any[] = []) => {
          try {
            await pool.query(sql, params);
          } catch (error) {
            console.warn('Cleanup warning:', (error as Error).message);
          }
        };

        await safeExec('DELETE FROM paymentlink_orders WHERE paymentlink_id IN (SELECT id FROM paymentlinks WHERE organization_id = $1)', [organizationId]);
        await safeExec('DELETE FROM paymentlinks WHERE organization_id = $1', [organizationId]);
        await safeExec('DELETE FROM orders WHERE organization_id = $1', [organizationId]);
        await safeExec('DELETE FROM address_pool WHERE organization_id = $1', [organizationId]);
        await safeExec('DELETE FROM api_keys WHERE user_id = $1', [userId]);
        await safeExec('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [organizationId, userId]);
        await safeExec('DELETE FROM users WHERE id = $1', [userId]);
        await safeExec('DELETE FROM organizations WHERE id = $1', [organizationId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
      await pool.end();
    }
  });

  it('should create, publish, and process Payment Link orders via public API', async () => {
    const createResponse = await apiClient.createPaymentLink({
      title: 'Test Payment Link',
      description: 'Integration test payment link',
      amount: '25.50',
      currency: 'USDT',
      chainOptions: ['ethereum-sepolia'],
      inventoryTotal: 1,
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.data.status).toBe('draft');
    paymentLinkId = createResponse.data.id;

    const publishResponse = await apiClient.publishPaymentLink(paymentLinkId);
    expect(publishResponse.success).toBe(true);
    expect(publishResponse.data.status).toBe('published');
    expect(publishResponse.data.slug).toBeTruthy();

    paymentLinkSlug = publishResponse.data.slug;

    const publicLink = await publicClient.getPublicPaymentLink(paymentLinkSlug);
    expect(publicLink.success).toBe(true);
    expect(publicLink.data.title).toBe('Test Payment Link');
    expect(publicLink.data.availableInventory).toBe(1);

    const orderResponse = await publicClient.createPublicPaymentLinkOrder(paymentLinkSlug, {
      email: 'buyer@example.com',
      chainId: 'ethereum-sepolia',
    });

    expect(orderResponse.success).toBe(true);
    expect(orderResponse.data.order).toBeDefined();
    expect(orderResponse.data.order.orderId || orderResponse.data.order.id).toBeTruthy();
    expect(orderResponse.data.paymentLinkOrder.status).toBe('pending');

    const adminOrders = await apiClient.listPaymentLinkOrders(paymentLinkId);
    expect(adminOrders.success).toBe(true);
    expect(adminOrders.data.length).toBeGreaterThan(0);
    expect(adminOrders.data[0].buyer_email).toBe('buyer@example.com');

    const updatedLink = await apiClient.getPaymentLink(paymentLinkId);
    expect(updatedLink.success).toBe(true);
    expect(updatedLink.data.inventory_reserved).toBeGreaterThanOrEqual(1);
    expect(updatedLink.data.status).toBe('published');
  });
});
