/**
 * Runtime payment scope used to isolate payment resources.
 *
 * PayIn Open uses one fixed single-merchant scope. PayIn Cloud maps this
 * scope to an explicit tenant/organization. The current persistence layer still
 * stores this value in organization_id columns for compatibility, but Open-facing
 * APIs should never ask merchants or AI agents to provide an organization id.
 */
export interface PaymentScope {
  /** Stable internal identifier used by the current persistence layer. */
  id: string;
  /** Product/runtime model that owns this scope. */
  kind: 'single-merchant' | 'tenant';
  /** Human-readable label for logs/docs. */
  label?: string;
}

/** Stable internal payment scope used by the default PayIn Open runtime. */
export const DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_LABEL = 'PayIn Open Merchant';

export function singleMerchantScope(
  id: string = DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_ID,
  label = DEFAULT_SINGLE_TENANT_PAYMENT_SCOPE_LABEL
): PaymentScope {
  return { id, kind: 'single-merchant', label };
}

export function tenantPaymentScope(id: string, label?: string): PaymentScope {
  return { id, kind: 'tenant', ...(label ? { label } : {}) };
}

export function paymentScopeToOrganizationId(scope: PaymentScope): string {
  return scope.id;
}
