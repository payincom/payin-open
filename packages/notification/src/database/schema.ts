/**
 * Notification Database Schema
 *
 * Tables:
 * - notification_endpoints: Webhook/Email/Telegram endpoint configurations
 * - notification_logs: Notification delivery history
 * - notification_stats: Aggregated statistics (optional, for performance)
 */

/**
 * Notification Endpoints Table
 * Stores webhook URLs, email addresses, telegram chats, etc.
 */
export const NOTIFICATION_ENDPOINTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS notification_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Endpoint basic information
  endpoint_name VARCHAR(100) NOT NULL,
  endpoint_type VARCHAR(20) NOT NULL CHECK (endpoint_type IN ('webhook', 'email', 'telegram')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Endpoint configuration (JSONB)
  -- webhook: { url: string, secret: string }
  -- email: { to: string[], cc?: string[], subject_prefix?: string }
  -- telegram: { chat_id: string, bot_token: string }
  config JSONB NOT NULL,

  -- Subscribed event types (JSONB array)
  -- Example: ["order.created", "order.completed", "deposit.completed"]
  subscribed_events JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Retry configuration
  max_retries INTEGER NOT NULL DEFAULT 5,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,

  -- Metadata
  description TEXT,
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_notification_endpoints_type ON notification_endpoints(endpoint_type);
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_enabled ON notification_endpoints(is_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_name ON notification_endpoints(endpoint_name);

-- Multi-tenant isolation: endpoint_name is unique per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_endpoints_org_name
  ON notification_endpoints(organization_id, endpoint_name);
`;

/**
 * Notification Logs Table
 * Stores notification delivery history and status
 */
export const NOTIFICATION_LOGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation (inherited from endpoint but explicit for queries)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Endpoint reference
  endpoint_id UUID NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,

  -- Event information
  event_type VARCHAR(50) NOT NULL,
  event_id VARCHAR(100) NOT NULL,  -- Idempotency key

  -- Business association
  business_type VARCHAR(20) CHECK (business_type IN ('order', 'deposit', 'transfer')),
  business_id VARCHAR(100),  -- order_id, deposit_reference, transfer_id

  -- Notification payload
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sending', 'success', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Response information
  http_status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Idempotency constraint
  CONSTRAINT notification_logs_event_id_endpoint_id_key UNIQUE (event_id, endpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_endpoint_id ON notification_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_business ON notification_logs(business_type, business_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_next_retry ON notification_logs(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_id ON notification_logs(event_id);
`;

/**
 * Notification Statistics Table (Optional)
 * Aggregated statistics for performance optimization
 */
export const NOTIFICATION_STATS_SCHEMA = `
CREATE TABLE IF NOT EXISTS notification_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Statistics data
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_success INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_retried INTEGER NOT NULL DEFAULT 0,

  avg_response_time_ms INTEGER,

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_stats_endpoint_date_key UNIQUE (endpoint_id, date)
);

CREATE INDEX IF NOT EXISTS idx_notification_stats_endpoint_date ON notification_stats(endpoint_id, date DESC);
`;

/**
 * All schemas
 */
export const ALL_SCHEMAS = [
  NOTIFICATION_ENDPOINTS_SCHEMA,
  NOTIFICATION_LOGS_SCHEMA,
  NOTIFICATION_STATS_SCHEMA,
];

/**
 * Table names
 */
export const TABLE_NAMES = [
  'notification_endpoints',
  'notification_logs',
  'notification_stats',
] as const;

export type TableName = typeof TABLE_NAMES[number];
