import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthHeaders,
  buildSmokeOrderPayload,
  collectOpenDatabaseChecks,
  collectOpenDoctorChecks,
  collectOpenRuntimePostureChecks,
  extractOrderId,
  extractPaymentUrl,
  isOpenRuntime,
  redactConnectionString,
} from '../scripts/open/ops-lib.js';

describe('PayIn Open ops library', () => {
  it('defaults to open runtime', () => {
    expect(isOpenRuntime({})).toBe(true);
    expect(isOpenRuntime({ PAYIN_RUNTIME: 'open' })).toBe(true);
    expect(isOpenRuntime({ PAYIN_RUNTIME: 'cloud' })).toBe(false);
  });

  it('redacts database passwords', () => {
    expect(redactConnectionString('postgresql://user:secret@localhost:5432/payin'))
      .toBe('postgresql://user:****@localhost:5432/payin');
  });

  it('fails when runtime is not open', () => {
    const summary = collectOpenDoctorChecks({
      env: { PAYIN_RUNTIME: 'cloud', DB_CONNECTION_STRING: 'postgresql://user:pw@localhost/db' },
      fileExists: () => true,
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.find((check) => check.id === 'runtime.open')?.status).toBe('fail');
    expect(summary.checks.find((check) => check.id === 'runtime.profile')?.status).toBe('fail');
  });

  it('reports Open runtime profile and operator posture', () => {
    const checks = collectOpenRuntimePostureChecks({
      env: { PAYIN_RUNTIME: 'open' },
      defaultMerchantId: '00000000-0000-0000-0000-000000000001',
    });

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime.profile',
        status: 'pass',
        message: expect.stringContaining('single-tenant self-hosted'),
      }),
      expect.objectContaining({
        id: 'auth.api-key-scope',
        status: 'pass',
        message: expect.stringContaining('do not send X-Organization-ID'),
      }),
      expect.objectContaining({
        id: 'auth.jwt-operator-caveat',
        status: 'pass',
        detail: expect.stringContaining('X-Organization-Id: 00000000-0000-0000-0000-000000000001'),
      }),
      expect.objectContaining({
        id: 'admin.production-posture',
        status: 'pass',
        message: expect.stringContaining('No default production admin promotion'),
      }),
    ]));
  });

  it('warns but does not fail when database is not configured in non-strict preflight', () => {
    const summary = collectOpenDoctorChecks({
      env: { PAYIN_RUNTIME: 'open' },
      fileExists: () => true,
    });

    expect(summary.ok).toBe(true);
    expect(summary.checks.find((check) => check.id === 'database.connection')?.status).toBe('warn');
  });

  it('fails when database is not configured in strict preflight', () => {
    const summary = collectOpenDoctorChecks({
      env: { PAYIN_RUNTIME: 'open' },
      fileExists: () => true,
      strict: true,
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.find((check) => check.id === 'database.connection')?.status).toBe('fail');
  });

  it('fails if required Open operation files are missing', () => {
    const summary = collectOpenDoctorChecks({
      env: { PAYIN_RUNTIME: 'open' },
      fileExists: (path) => path !== 'skills/payin-open/SKILL.md',
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.find((check) => check.id === 'file.skills/payin-open/SKILL.md')?.status).toBe('fail');
  });

  it('builds auth headers for live smoke checks without exposing tenant concepts', () => {
    expect(buildAuthHeaders({ apiKey: 'sk_test' })).toEqual({
      Authorization: 'Bearer sk_test',
      'X-API-Key': 'sk_test',
    });
    expect(buildAuthHeaders({ bearerToken: 'jwt' })).toEqual({ Authorization: 'Bearer jwt' });
  });

  it('builds an Open smoke order payload with safe sandbox defaults', () => {
    expect(buildSmokeOrderPayload({ orderReference: 'smoke-1' })).toMatchObject({
      orderReference: 'smoke-1',
      amount: '1.00',
      currency: 'USDC',
      chainId: 'ethereum-sepolia',
      metadata: { source: 'payin-open-smoke' },
    });
  });

  it('extracts order id and payment URL from order responses', () => {
    const response = { data: { orderId: 'order-1' } };
    expect(extractOrderId(response)).toBe('order-1');
    expect(extractPaymentUrl(response, 'http://localhost:3000', 'order-1')).toBe('http://localhost:3000/pay/order/order-1');
    expect(extractPaymentUrl({ data: { url: 'https://example.com/pay/order-1' } }, 'http://localhost:3000')).toBe('https://example.com/pay/order-1');
  });

  it('skips live database checks as a warning when no DB is configured', async () => {
    const result = await collectOpenDatabaseChecks({
      defaultMerchantId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.summary.configured).toBe(false);
    expect(result.checks.find((check) => check.id === 'database.live-check')?.status).toBe('warn');
  });

  it('reports schema and default merchant status from a configured database', async () => {
    const fakeDatabase = {
      initialize: vi.fn(async () => undefined),
      checkDatabaseSchema: vi.fn(async () => ({
        isComplete: true,
        missingTables: [],
        existingTables: ['organizations', 'orders'],
        requiredTables: ['organizations', 'orders'],
      })),
      query: vi.fn(async () => [{ id: '00000000-0000-0000-0000-000000000001' }]),
      close: vi.fn(async () => undefined),
    };

    const result = await collectOpenDatabaseChecks({
      connectionString: 'postgresql://user:pw@localhost/db',
      defaultMerchantId: '00000000-0000-0000-0000-000000000001',
      databaseFactory: () => fakeDatabase,
    });

    expect(result.summary).toMatchObject({
      configured: true,
      reachable: true,
      schemaComplete: true,
      defaultMerchantExists: true,
    });
    expect(result.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'database.reachable',
      'database.schema',
      'database.default-merchant',
    ]));
  });
});
