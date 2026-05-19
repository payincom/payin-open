import {
  DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_ID,
  DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_LABEL,
  paymentScopeToOrganizationId,
  singleMerchantScope,
  type PaymentScope,
} from './payment-scope.js';

export type RuntimeKind = 'single-tenant' | 'multi-tenant';

export interface RuntimeActor {
  type: 'system' | 'operator' | 'api-key' | 'anonymous';
  id?: string;
}

/**
 * Neutral request/payment context passed at Open core boundaries.
 *
 * The `paymentScope.id` currently maps to legacy organization_id storage, but
 * callers should treat it as an opaque payment ownership scope.
 */
export interface RuntimeContext {
  runtimeKind: RuntimeKind;
  paymentScope: PaymentScope;
  actor?: RuntimeActor;
  requestId?: string;
  source?: string;
}

export interface RuntimeContextInput {
  actor?: RuntimeActor;
  requestId?: string;
  source?: string;
}

export interface RuntimeContextProvider {
  getPaymentScope(): PaymentScope;
  getRuntimeContext(input?: RuntimeContextInput): RuntimeContext;
}

export interface SingleTenantContextProviderOptions {
  /** Internal compatibility id; currently persisted as organization_id. */
  scopeId?: string;
  /** Human-readable label for logs/docs. */
  scopeLabel?: string;
}

/**
 * PayIn Open default context provider.
 *
 * This provider intentionally models one self-hosted merchant. It does not add
 * Cloud organization/member/billing behavior; it only centralizes the default
 * compatibility scope used by current storage adapters.
 */
export class SingleTenantContextProvider implements RuntimeContextProvider {
  readonly paymentScope: PaymentScope;

  constructor(options: SingleTenantContextProviderOptions = {}) {
    this.paymentScope = singleMerchantScope(
      options.scopeId ?? DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_ID,
      options.scopeLabel ?? DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_LABEL
    );
  }

  getPaymentScope(): PaymentScope {
    return this.paymentScope;
  }

  getRuntimeContext(input: RuntimeContextInput = {}): RuntimeContext {
    return {
      runtimeKind: 'single-tenant',
      paymentScope: this.paymentScope,
      ...input,
    };
  }

  get organizationId(): string {
    return paymentScopeToOrganizationId(this.paymentScope);
  }
}

export function createSingleTenantRuntimeContextProvider(
  options: SingleTenantContextProviderOptions = {}
): SingleTenantContextProvider {
  return new SingleTenantContextProvider(options);
}
