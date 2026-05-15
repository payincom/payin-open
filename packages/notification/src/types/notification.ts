/**
 * Notification Types
 */

export type NotificationStatus = 'pending' | 'sending' | 'success' | 'failed' | 'cancelled';

export type BusinessType = 'order' | 'deposit' | 'transfer';

export interface NotificationEvent {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, any>;
}

export interface NotificationLog {
  id: string;
  organization_id: string; // Multi-tenant isolation
  endpoint_id: string;
  event_type: string;
  event_id: string;
  business_type?: BusinessType;
  business_id?: string;
  payload: NotificationEvent;
  status: NotificationStatus;
  retry_count: number;
  http_status_code?: number;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  created_at: Date;
  sent_at?: Date;
  completed_at?: Date;
  next_retry_at?: Date;
}

export interface NotificationResult {
  success: boolean;
  httpStatusCode?: number | null;
  responseBody?: string | null;
  responseTime?: number;
  errorMessage?: string;
  deliveryId?: string;
}

export interface QueueItem {
  endpointId: string;
  event: NotificationEvent;
}
