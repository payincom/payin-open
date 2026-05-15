import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import { AuthManager } from '../../src/auth-manager.js';
import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DB_CONNECTION_STRING ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/payin_test';

const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

describe('AuthManager initialization with INIT_DB=true', () => {
  let pool: Pool;
  let auth: AuthManager;
  let originalInitDb: string | undefined;

  beforeAll(async () => {
    originalInitDb = process.env.INIT_DB;
    process.env.INIT_DB = 'true';

    pool = new Pool({ connectionString: DATABASE_URL });
    auth = new AuthManager({
      connectionString: DATABASE_URL,
      jwtSecret: 'test-secret',
    });

    await auth.initialize();
  }, 120000);

  afterAll(async () => {
    await auth.close();
    await pool.end();

    if (originalInitDb === undefined) {
      delete process.env.INIT_DB;
    } else {
      process.env.INIT_DB = originalInitDb;
    }
  });

  test('creates default organization and associates admin user', async () => {
    const orgResult = await pool.query(
      `SELECT id, name, slug, plan_type FROM organizations WHERE id = $1`,
      [DEFAULT_ORGANIZATION_ID]
    );

    expect(orgResult.rowCount).toBe(1);
    expect(orgResult.rows[0]).toMatchObject({
      id: DEFAULT_ORGANIZATION_ID,
      name: 'Default Organization',
      plan_type: 'enterprise',
    });

    const userResult = await pool.query(
      `SELECT id FROM users WHERE username = 'admin'`
    );

    expect(userResult.rowCount).toBe(1);
    const adminId = userResult.rows[0].id as string;

    const membershipResult = await pool.query(
      `SELECT role, status FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [DEFAULT_ORGANIZATION_ID, adminId]
    );

    expect(membershipResult.rowCount).toBe(1);
    expect(membershipResult.rows[0]).toMatchObject({
      role: 'owner',
      status: 'active',
    });
  });
});
