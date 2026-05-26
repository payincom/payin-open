import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OPEN_ORGANIZATION_ID,
  SingleTenantContextProvider,
  tenantPaymentScope,
  type RuntimeContext,
} from '@payin/processor';
import { apiKeyRuntimeScopeToOrganizationId, AuthManager } from '../../src/auth-manager.js';

describe('AuthManager API key runtime-scope compatibility seams', () => {
  it('maps RuntimeContext to the legacy organization id', () => {
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-api-keys'),
      actor: { type: 'api-key', id: 'key-api-keys' },
      source: 'unit-test',
    };

    expect(apiKeyRuntimeScopeToOrganizationId(runtimeContext)).toBe('tenant-org-api-keys');
  });

  it('maps the Open single-merchant payment scope to the merchant organization id', () => {
    const provider = new SingleTenantContextProvider();

    expect(apiKeyRuntimeScopeToOrganizationId(provider.getPaymentScope())).toBe(
      DEFAULT_OPEN_ORGANIZATION_ID
    );
  });

  it('maps RuntimeContext to legacy organization id when creating an API key', async () => {
    const manager = Object.create(AuthManager.prototype) as AuthManager;
    const createApiKey = vi.fn(async () => ({
      apiKey: 'pk_test_secret',
      metadata: { id: 'key-1', organizationId: 'tenant-org-create-key' },
    }));
    (manager as any).createApiKey = createApiKey;
    const runtimeContext: RuntimeContext = {
      runtimeKind: 'multi-tenant',
      paymentScope: tenantPaymentScope('tenant-org-create-key'),
      actor: { type: 'operator', id: 'user-1' },
      source: 'unit-test',
    };

    await manager.createApiKeyForRuntimeScope('user-1', runtimeContext, {
      name: 'Tenant key',
      expiresAt: undefined,
    });

    expect(createApiKey).toHaveBeenCalledWith('user-1', 'tenant-org-create-key', {
      name: 'Tenant key',
      expiresAt: undefined,
    });
  });

  it('maps PaymentScope to legacy organization id when listing API keys', async () => {
    const manager = Object.create(AuthManager.prototype) as AuthManager;
    const listApiKeys = vi.fn(async () => []);
    (manager as any).listApiKeys = listApiKeys;

    await manager.listApiKeysForRuntimeScope(tenantPaymentScope('tenant-org-list-keys'), 'user-1');

    expect(listApiKeys).toHaveBeenCalledWith('tenant-org-list-keys', 'user-1');
  });

  it('queries API key by id within the runtime payment scope', async () => {
    const manager = Object.create(AuthManager.prototype) as AuthManager;
    const db = {
      query: vi.fn(async () => ({ rows: [{ id: 'key-1', organizationId: 'tenant-org-get' }] })),
    };
    (manager as any).db = db;

    const result = await manager.getApiKeyByIdForRuntimeScope(
      'key-1',
      tenantPaymentScope('tenant-org-get')
    );

    expect(result).toEqual({ id: 'key-1', organizationId: 'tenant-org-get' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('organization_id = $2'), [
      'key-1',
      'tenant-org-get',
    ]);
  });

  it('updates API key within the runtime payment scope', async () => {
    const manager = Object.create(AuthManager.prototype) as AuthManager;
    const db = {
      query: vi.fn(async () => ({ rows: [{ id: 'key-1', organizationId: 'tenant-org-update' }] })),
    };
    (manager as any).db = db;

    const result = await manager.updateApiKeyForRuntimeScope(
      'key-1',
      tenantPaymentScope('tenant-org-update'),
      { name: 'Updated key' }
    );

    expect(result).toEqual({ id: 'key-1', organizationId: 'tenant-org-update' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('organization_id = $3'), [
      'Updated key',
      'key-1',
      'tenant-org-update',
    ]);
  });

  it('revokes API key within the runtime payment scope', async () => {
    const manager = Object.create(AuthManager.prototype) as AuthManager;
    const db = { query: vi.fn(async () => ({ rows: [] })) };
    (manager as any).db = db;

    await manager.revokeApiKeyForRuntimeScope('key-1', tenantPaymentScope('tenant-org-revoke'));

    expect(db.query).toHaveBeenCalledWith(
      'DELETE FROM api_keys WHERE id = $1 AND organization_id = $2',
      ['key-1', 'tenant-org-revoke']
    );
  });
});
