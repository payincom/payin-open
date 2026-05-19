import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPEN_ORGANIZATION_ID,
  SingleTenantContextProvider,
  createSingleTenantRuntimeContextProvider,
  paymentScopeToOrganizationId,
  singleMerchantScope,
  tenantPaymentScope,
} from '../../src/index.js';

describe('RuntimeContext and PaymentScope', () => {
  it('creates the default Open single-tenant payment scope', () => {
    const provider = new SingleTenantContextProvider();

    expect(provider.getPaymentScope()).toEqual({
      id: DEFAULT_OPEN_ORGANIZATION_ID,
      kind: 'single-merchant',
      label: 'PayIn Open Merchant',
    });
    expect(provider.organizationId).toBe(DEFAULT_OPEN_ORGANIZATION_ID);
  });

  it('creates a runtime context without exposing organization as public API', () => {
    const provider = createSingleTenantRuntimeContextProvider({
      scopeId: 'scope-1',
      scopeLabel: 'Local Merchant',
    });

    expect(provider.getRuntimeContext({ actor: { type: 'system' }, requestId: 'req-1' })).toEqual({
      runtimeKind: 'single-tenant',
      paymentScope: { id: 'scope-1', kind: 'single-merchant', label: 'Local Merchant' },
      actor: { type: 'system' },
      requestId: 'req-1',
    });
  });

  it('keeps organization id mapping as a compatibility helper', () => {
    expect(paymentScopeToOrganizationId(singleMerchantScope('scope-2'))).toBe('scope-2');
    expect(paymentScopeToOrganizationId(tenantPaymentScope('tenant-1'))).toBe('tenant-1');
  });
});
