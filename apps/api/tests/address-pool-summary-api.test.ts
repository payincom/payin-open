import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { ApiClient } from './test-utils.js';

const DATABASE_URL =
  process.env.DB_CONNECTION_STRING ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/payin_test';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

describe('Address Pool Summary API', () => {
  let pool: Pool;
  let apiClient: ApiClient;

  let organizationId: string;
  let userId: string;
  let apiKey: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });

    await pool.query('SELECT 1'); // connection sanity

    apiClient = new ApiClient(API_BASE_URL);

    const org = await pool.query(
      `INSERT INTO organizations (id, name, slug, created_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       RETURNING id`,
      ['Address Pool Summary Org', `address-pool-summary-${Date.now()}`]
    );
    organizationId = org.rows[0].id;

    const user = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [`address-pool-summary-user-${Date.now()}`, `address-pool-summary-${Date.now()}@example.com`, 'dummy_hash']
    );
    userId = user.rows[0].id;

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW())`,
      [organizationId, userId]
    );

    const apiKeyValue = `pk_test_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    const keyPrefix = apiKeyValue.substring(0, 8); // pk_test_
    const hashedKey = await bcrypt.hash(apiKeyValue, 10);

    const apiKeyRow = await pool.query(
      `INSERT INTO api_keys (id, user_id, key_prefix, key_hash, name, organization_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [userId, keyPrefix, hashedKey, 'Address Pool Summary Key', organizationId]
    );

    apiKey = apiKeyValue;

    apiClient.setAuthToken(apiKey);
    apiClient.setOrganizationId(organizationId);
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

  it('returns an empty summary when no addresses are present', async () => {
    const response = await apiClient.getAddressPoolSummary();
    expect(response.success).toBe(true);
    expect(response.data.totalAddresses).toBe(0);
    expect(response.data.hasAddresses).toBe(false);
    expect(Array.isArray(response.data.protocols)).toBe(true);
    expect(response.data.protocols.length).toBeGreaterThan(0);
    for (const protocol of response.data.protocols) {
      expect(protocol.total).toBe(0);
      expect(protocol.available).toBe(0);
    }
  });

  it('reflects imported addresses in the summary response', async () => {
    const addresses = Array.from({ length: 3 }).map((_, index) => ({
      address: `0x${(Date.now() + index).toString(16).padStart(40, 'a')}`,
      protocol: 'evm' as const,
      derivationIndex: index,
      masterPublicKey: 'xpub-address-pool-summary',
    }));

    await apiClient.addAddressesToPool(addresses);

    const response = await apiClient.getAddressPoolSummary();
    expect(response.success).toBe(true);
    expect(response.data.totalAddresses).toBeGreaterThanOrEqual(addresses.length);
    expect(response.data.hasAddresses).toBe(true);

    const evmPool = response.data.protocols.find((protocol: any) => protocol.protocol === 'evm');
    expect(evmPool).toBeDefined();
    expect(evmPool.total).toBeGreaterThanOrEqual(addresses.length);
    expect(evmPool.available).toBeGreaterThanOrEqual(0);
  });
});
