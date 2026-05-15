/**
 * Data Migration: Convert Multi-Owner Organizations to Single Owner
 *
 * Strategy:
 * 1. For each organization with multiple owners:
 *    - Keep the earliest created owner as the sole owner
 *    - Demote other owners to admin role
 *    - Log the changes for audit
 *
 * Run this BEFORE applying 002_single_owner.sql migration
 */

-- ============================================================================
-- Step 1: Identify organizations with multiple owners
-- ============================================================================

-- View organizations with multiple owners
SELECT
  om.organization_id,
  o.name as organization_name,
  COUNT(*) as owner_count,
  array_agg(u.username ORDER BY om.created_at) as owners,
  array_agg(om.user_id ORDER BY om.created_at) as owner_ids,
  MIN(om.created_at) as first_owner_created_at
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN users u ON u.id = om.user_id
WHERE om.role = 'owner'
GROUP BY om.organization_id, o.name
HAVING COUNT(*) > 1
ORDER BY owner_count DESC, o.name;

-- ============================================================================
-- Step 2: Create backup table
-- ============================================================================

-- Backup current state before migration
CREATE TABLE IF NOT EXISTS organization_members_backup_multi_owner AS
SELECT * FROM organization_members WHERE role = 'owner';

SELECT COUNT(*) as total_owners_backed_up FROM organization_members_backup_multi_owner;

-- ============================================================================
-- Step 3: Perform migration
-- ============================================================================

DO $$
DECLARE
  org_record RECORD;
  demoted_count INTEGER := 0;
  total_orgs_processed INTEGER := 0;
BEGIN
  -- Process each organization with multiple owners
  FOR org_record IN
    SELECT
      om.organization_id,
      o.name as org_name,
      array_agg(om.user_id ORDER BY om.created_at) as owner_ids,
      array_agg(u.username ORDER BY om.created_at) as owner_usernames,
      (array_agg(om.user_id ORDER BY om.created_at))[1] as keep_owner_id,
      (array_agg(u.username ORDER BY om.created_at))[1] as keep_owner_username
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    JOIN users u ON u.id = om.user_id
    WHERE om.role = 'owner'
    GROUP BY om.organization_id, o.name
    HAVING COUNT(*) > 1
  LOOP
    total_orgs_processed := total_orgs_processed + 1;

    RAISE NOTICE 'Processing organization: % (ID: %)', org_record.org_name, org_record.organization_id;
    RAISE NOTICE '  Keeping owner: % (ID: %)', org_record.keep_owner_username, org_record.keep_owner_id;
    RAISE NOTICE '  All owners: %', org_record.owner_usernames;

    -- Demote all owners except the first one to admin
    UPDATE organization_members
    SET role = 'admin'
    WHERE organization_id = org_record.organization_id
      AND role = 'owner'
      AND user_id != org_record.keep_owner_id;

    GET DIAGNOSTICS demoted_count = ROW_COUNT;

    RAISE NOTICE '  Demoted % owner(s) to admin', demoted_count;
    RAISE NOTICE '';

  END LOOP;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Organizations processed: %', total_orgs_processed;
  RAISE NOTICE '  Owners demoted to admin: %', demoted_count;
  RAISE NOTICE '===========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR during migration: %', SQLERRM;
    RAISE;
END;
$$;

-- ============================================================================
-- Step 4: Verification
-- ============================================================================

-- Verify: Check that all organizations now have exactly 1 owner
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'SUCCESS: All organizations have exactly 1 owner'
    ELSE 'ERROR: Found ' || COUNT(*) || ' organizations with != 1 owner'
  END as verification_result
FROM (
  SELECT organization_id, COUNT(*) as owner_count
  FROM organization_members
  WHERE role = 'owner'
  GROUP BY organization_id
  HAVING COUNT(*) != 1
) sub;

-- Show final owner distribution
SELECT
  'Total organizations' as metric,
  COUNT(DISTINCT organization_id) as count
FROM organization_members
WHERE role = 'owner'
UNION ALL
SELECT
  'Total owners' as metric,
  COUNT(*) as count
FROM organization_members
WHERE role = 'owner';

-- List all organizations with their sole owner
SELECT
  o.id as organization_id,
  o.name as organization_name,
  u.username as owner_username,
  u.id as owner_user_id,
  om.created_at as owner_since
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id AND om.role = 'owner'
JOIN users u ON u.id = om.user_id
ORDER BY o.name;
