import { describe, expect, it } from 'vitest';
import { notificationRuntimeScopeToOrganizationId } from '../src/notification-service.js';

describe('notification runtime scope seam', () => {
  it('maps a RuntimeContext payment scope to the legacy organization_id compatibility value', () => {
    expect(
      notificationRuntimeScopeToOrganizationId({
        runtimeKind: 'single-tenant',
        paymentScope: {
          id: '00000000-0000-0000-0000-000000000001',
          kind: 'single-merchant',
          label: 'PayIn Open Merchant',
        },
      })
    ).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('maps a direct payment scope to the legacy organization_id compatibility value', () => {
    expect(
      notificationRuntimeScopeToOrganizationId({
        id: 'tenant-org-1',
        kind: 'tenant',
      })
    ).toBe('tenant-org-1');
  });
});
