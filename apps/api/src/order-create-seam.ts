import type { RuntimeActor, RuntimeContext } from '@payin/processor';

export interface OrderCreatePolicyRequest {
  orderReference: string;
  amount: string;
  currency: string;
  chainId: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface OrderCreatePolicyInput {
  runtimeContext: RuntimeContext;
  request: OrderCreatePolicyRequest;
}

export interface OrderCreatePolicyDecision {
  allowed: boolean;
  code?: string;
  message?: string;
  status?: 400 | 401 | 403 | 409 | 422 | 429;
}

export interface OrderCreatePolicy {
  check(
    input: OrderCreatePolicyInput
  ): OrderCreatePolicyDecision | Promise<OrderCreatePolicyDecision>;
}

export interface OrderCreateEventEnvelope {
  name: 'order.created';
  occurredAt: string;
  paymentScope: RuntimeContext['paymentScope'];
  actor?: RuntimeActor;
  requestId?: string;
  source?: string;
  order: {
    id?: string;
    reference: string;
  };
}

export interface OrderCreateEventSink {
  record(envelope: OrderCreateEventEnvelope): void | Promise<void>;
}

export const allowAllOrderCreatePolicy: OrderCreatePolicy = {
  check: () => ({ allowed: true }),
};

export const noOpOrderCreateEventSink: OrderCreateEventSink = {
  record: () => undefined,
};
