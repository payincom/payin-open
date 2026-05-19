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

  it('maps the Open single-merchant payment scope to the default organization id', () => {
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
});
