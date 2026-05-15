/**
 * Notification Endpoint Types
 */

export type EndpointType = 'webhook' | 'email' | 'telegram';

export type EndpointStatus = 'enabled' | 'disabled';

export interface WebhookConfig {
  url: string;
  secret: string;
}

export interface EmailConfig {
  to: string[];
  cc?: string[];
  subjectPrefix?: string;
}

export interface TelegramConfig {
  chatId: string;
  botToken: string;
}

export type EndpointConfig = WebhookConfig | EmailConfig | TelegramConfig;

export interface Endpoint {
  id: string;
  organization_id: string; // Multi-tenant isolation
  endpoint_name: string;
  endpoint_type: EndpointType;
  is_enabled: boolean;
  config: EndpointConfig;
  subscribed_events: string[];
  max_retries: number;
  timeout_ms: number;
  description?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface CreateEndpointRequest {
  organization_id: string; // Multi-tenant isolation
  endpoint_name: string;
  endpoint_type: EndpointType;
  config: EndpointConfig;
  subscribed_events: string[];
  max_retries?: number;
  timeout_ms?: number;
  description?: string;
  metadata?: Record<string, any>;
  is_enabled?: boolean;
}

export interface UpdateEndpointRequest {
  endpoint_name?: string;
  is_enabled?: boolean;
  config?: Partial<EndpointConfig>;
  subscribed_events?: string[];
  max_retries?: number;
  timeout_ms?: number;
  description?: string;
  metadata?: Record<string, any>;
}
