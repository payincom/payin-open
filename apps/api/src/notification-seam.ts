import type { RuntimeActor, RuntimeContext } from '@payin/processor';

export type NotificationPolicyOperation =
  | 'create_endpoint'
  | 'test_endpoint'
  | 'retry_notification';

export interface NotificationEndpointPolicyRequest {
  endpoint_name?: string;
  endpoint_type?: 'webhook' | 'email' | 'telegram' | string;
  config?: Record<string, unknown>;
  subscribed_events?: string[];
  max_retries?: number;
  timeout_ms?: number;
  description?: string;
  is_enabled?: boolean;
}

export interface NotificationRetryPolicyRequest {
  logId: string;
}

export type NotificationPolicyRequest =
  | NotificationEndpointPolicyRequest
  | NotificationRetryPolicyRequest;

export interface NotificationPolicyInput {
  runtimeContext: RuntimeContext;
  operation: NotificationPolicyOperation;
  endpointId?: string;
  request: NotificationPolicyRequest;
}

export interface NotificationPolicyDecision {
  allowed: boolean;
  code?: string;
  message?: string;
  status?: 400 | 401 | 403 | 409 | 422 | 429;
}

export interface NotificationPolicy {
  check(
    input: NotificationPolicyInput
  ): NotificationPolicyDecision | Promise<NotificationPolicyDecision>;
}

export interface NotificationEventEnvelope {
  name:
    | 'notification.endpoint.created'
    | 'notification.endpoint.tested'
    | 'notification.retry.requested';
  occurredAt: string;
  paymentScope: RuntimeContext['paymentScope'];
  actor?: RuntimeActor;
  requestId?: string;
  source?: string;
  operation: NotificationPolicyOperation;
  endpoint?: {
    id?: string;
    name?: string;
    type?: string;
  };
  test?: {
    success: boolean;
  };
  notificationLog?: {
    id: string;
  };
}

export interface NotificationEventSink {
  record(envelope: NotificationEventEnvelope): void | Promise<void>;
}

export const allowAllNotificationPolicy: NotificationPolicy = {
  check: () => ({ allowed: true }),
};

export const noOpNotificationEventSink: NotificationEventSink = {
  record: () => undefined,
};
