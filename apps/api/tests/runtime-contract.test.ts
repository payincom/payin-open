import { describe, expect, it } from 'vitest';
import { PAYIN_OPEN_RUNTIME_CONTRACT } from '../src/runtime-contract.js';

describe('PayIn Open runtime composition contract', () => {
  it('publishes stable metadata for Cloud consumers', () => {
    expect(PAYIN_OPEN_RUNTIME_CONTRACT).toMatchObject({
      name: 'payin-open-runtime-composition',
      version: '1.0.0',
      packageName: '@payin/app',
      exportPath: '@payin/app/runtime-contract',
      stability: 'stable',
      owner: 'payin-open',
      consumer: 'payin-cloud-layer',
    });

    expect(PAYIN_OPEN_RUNTIME_CONTRACT.surfaces).toEqual([
      'managerProvider',
      'cloudOnlyRouteGuard',
      'routeFactories',
      'routeDependencies',
      'extensionHooks',
      'policySeams',
    ]);
  });
});
