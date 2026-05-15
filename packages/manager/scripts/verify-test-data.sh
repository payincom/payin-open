#!/bin/bash

# Verify Manager → Processor Integration Test Data
# This script checks if the test successfully created orders and transfers in the database

DATABASE_URL='postgresql://postgres:postgres@localhost:5432/payin_test'

echo "📊 Verifying Manager → Processor Integration Test Data"
echo "======================================================="
echo ""

echo "📋 Recent Orders (last 5):"
export PGPASSWORD='postgres'
psql -h localhost -U postgres -d postgres -c "
SELECT
  id,
  order_reference,
  status,
  amount,
  token,
  chain,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "💸 Recent Transfers (last 5):"
psql -h localhost -U postgres -d postgres -c "
SELECT
  id,
  order_id,
  transaction_hash,
  amount,
  chain,
  is_confirmed,
  block_number,
  detected_at
FROM transfers
ORDER BY detected_at DESC
LIMIT 5;
"

echo ""
echo "📈 Statistics:"
psql -h localhost -U postgres -d postgres -c "
SELECT
  'Orders' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count
FROM orders
UNION ALL
SELECT
  'Transfers' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_confirmed = true) as confirmed_count,
  COUNT(*) FILTER (WHERE is_confirmed = false) as pending_count,
  0 as expired_count
FROM transfers;
"

echo ""
echo "✅ Verification complete!"
