import type { RuntimeActor, RuntimeContext } from '@payin/processor';

export type PaymentLinkPolicyOperation = 'create' | 'update' | 'publish';

export interface PaymentLinkCurrencyPolicyRequest {
  currency: string;
  chainOptions: string[];
  amount?: string | number;
  is_primary?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentLinkCreatePolicyRequest {
  title: string;
  description?: string | null;
  amount: string | number;
  currencies: PaymentLinkCurrencyPolicyRequest[];
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

export interface PaymentLinkUpdatePolicyRequest {
  title?: string;
  description?: string | null;
  amount?: string | number;
  inventoryTotal?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

export interface PaymentLinkPublishPolicyRequest {
  slug?: string;
}

export type PaymentLinkPolicyRequest =
  | PaymentLinkCreatePolicyRequest
  | PaymentLinkUpdatePolicyRequest
  | PaymentLinkPublishPolicyRequest;

export interface PaymentLinkPolicyInput {
  runtimeContext: RuntimeContext;
  operation: PaymentLinkPolicyOperation;
  paymentLinkId?: string;
  request: PaymentLinkPolicyRequest;
}

export interface PaymentLinkPolicyDecision {
  allowed: boolean;
  code?: string;
  message?: string;
  status?: 400 | 401 | 403 | 409 | 422 | 429;
}

export interface PaymentLinkPolicy {
  check(
    input: PaymentLinkPolicyInput
  ): PaymentLinkPolicyDecision | Promise<PaymentLinkPolicyDecision>;
}

export interface PaymentLinkEventEnvelope {
  name: 'payment_link.created' | 'payment_link.updated' | 'payment_link.published';
  occurredAt: string;
  paymentScope: RuntimeContext['paymentScope'];
  actor?: RuntimeActor;
  requestId?: string;
  source?: string;
  operation: PaymentLinkPolicyOperation;
  paymentLink: {
    id?: string;
    status?: string;
    slug?: string | null;
  };
}

export interface PaymentLinkEventSink {
  record(envelope: PaymentLinkEventEnvelope): void | Promise<void>;
}

export const allowAllPaymentLinkPolicy: PaymentLinkPolicy = {
  check: () => ({ allowed: true }),
};

export const noOpPaymentLinkEventSink: PaymentLinkEventSink = {
  record: () => undefined,
};
