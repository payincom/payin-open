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

export function singleMerchantScope(id: string, label = 'PayIn Open Merchant'): PaymentScope {
  return { id, kind: 'single-merchant', label };
}

export function tenantPaymentScope(id: string, label?: string): PaymentScope {
  return { id, kind: 'tenant', ...(label ? { label } : {}) };
}
