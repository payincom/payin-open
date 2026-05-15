-- ============================================
-- PayIn Multi-Tenancy Performance Indexes
-- Version: 002
-- Description: Add performance indexes for organization_id fields in business tables
-- ============================================

BEGIN;

-- ============================================
-- Orders Table Indexes
-- ============================================
-- Single column index for basic organization filtering
CREATE INDEX IF NOT EXISTS idx_orders_organization_id
  ON orders(organization_id);

-- Composite index for status queries within organization
CREATE INDEX IF NOT EXISTS idx_orders_org_status
  ON orders(organization_id, status);

-- Composite index for time-based queries within organization
CREATE INDEX IF NOT EXISTS idx_orders_org_created
  ON orders(organization_id, created_at DESC);

-- Composite index for chain-based queries within organization
CREATE INDEX IF NOT EXISTS idx_orders_org_chain
  ON orders(organization_id, chain);

-- ============================================
-- Transfers Table Indexes
-- ============================================
-- Single column index for basic organization filtering
CREATE INDEX IF NOT EXISTS idx_transfers_organization_id
  ON transfers(organization_id);

-- Composite index for order-related transfer queries
CREATE INDEX IF NOT EXISTS idx_transfers_org_order
  ON transfers(organization_id, order_id)
  WHERE order_id IS NOT NULL;

-- Composite index for deposit-related transfer queries
CREATE INDEX IF NOT EXISTS idx_transfers_org_deposit
  ON transfers(organization_id, deposit_reference)
  WHERE deposit_reference IS NOT NULL;

-- Composite index for business type filtering within organization
CREATE INDEX IF NOT EXISTS idx_transfers_org_business_type
  ON transfers(organization_id, business_type);

-- Composite index for confirmation status queries
CREATE INDEX IF NOT EXISTS idx_transfers_org_confirmed
  ON transfers(organization_id, is_confirmed);

-- ============================================
-- Address Pool Table Indexes
-- ============================================
-- Single column index for basic organization filtering
CREATE INDEX IF NOT EXISTS idx_address_pool_organization_id
  ON address_pool(organization_id);

-- Composite index for state-based address queries within organization
CREATE INDEX IF NOT EXISTS idx_address_pool_org_state
  ON address_pool(organization_id, state);

-- Composite index for protocol-based address queries within organization
CREATE INDEX IF NOT EXISTS idx_address_pool_org_protocol
  ON address_pool(organization_id, protocol);

-- Composite index for idle address selection (LRU)
-- This supports the "SELECT ... WHERE organization_id = ? AND state = 'idle' ORDER BY recycled_at NULLS FIRST" query
CREATE INDEX IF NOT EXISTS idx_address_pool_org_idle_lru
  ON address_pool(organization_id, state, recycled_at NULLS FIRST)
  WHERE state = 'idle';

-- ============================================
-- Notification Endpoints Table Indexes
-- ============================================
-- Single column index for basic organization filtering
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_organization_id
  ON notification_endpoints(organization_id);

-- Composite index for enabled endpoints queries
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_org_enabled
  ON notification_endpoints(organization_id, is_enabled)
  WHERE is_enabled = true;

-- ============================================
-- Notification Logs Table Indexes
-- ============================================
-- Single column index for basic organization filtering
CREATE INDEX IF NOT EXISTS idx_notification_logs_organization_id
  ON notification_logs(organization_id);

-- Composite index for status-based queries within organization
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_status
  ON notification_logs(organization_id, status);

-- Composite index for time-based queries within organization
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_created
  ON notification_logs(organization_id, created_at DESC);

COMMIT;

-- ============================================
-- Index Statistics and Verification
-- ============================================

-- View all indexes for multi-tenant tables
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('orders', 'transfers', 'address_pool', 'notification_endpoints', 'notification_logs')
--   AND indexname LIKE '%org%'
-- ORDER BY tablename, indexname;

-- Check index usage statistics
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan AS index_scans,
--   idx_tup_read AS tuples_read,
--   idx_tup_fetch AS tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('orders', 'transfers', 'address_pool', 'notification_endpoints', 'notification_logs')
--   AND indexname LIKE '%org%'
-- ORDER BY idx_scan DESC;
