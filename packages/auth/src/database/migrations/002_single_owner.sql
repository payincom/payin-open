/**
 * Migration: Single Owner per Organization + Ownership Transfer
 *
 * Changes:
 * 1. Add unique constraint: one owner per organization
 * 2. Create ownership_transfer_requests table
 * 3. Create ownership_transfer_audit table
 * 4. Add trigger to prevent removing last owner
 */

-- ============================================================================
-- Step 1: Create ownership transfer tables
-- ============================================================================

-- Ownership transfer requests table
CREATE TABLE IF NOT EXISTS ownership_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  to_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed', 'cancelled')),
  initiated_by VARCHAR(255) NOT NULL REFERENCES users(id),  -- Who initiated the transfer (usually from_user_id)
  message TEXT,  -- Optional message for the transfer
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,  -- Transfer request expiration (default 7 days)
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_organization ON ownership_transfer_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_from_user ON ownership_transfer_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_to_user ON ownership_transfer_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON ownership_transfer_requests(status);

-- Ownership transfer audit log
CREATE TABLE IF NOT EXISTS ownership_transfer_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id UUID NOT NULL REFERENCES ownership_transfer_requests(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,  -- 'initiated', 'accepted', 'rejected', 'completed', 'cancelled', 'expired'
  performed_by VARCHAR(255) REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_transfer_audit_request ON ownership_transfer_audit(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_action ON ownership_transfer_audit(action);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_timestamp ON ownership_transfer_audit(timestamp);

-- ============================================================================
-- Step 2: Add unique constraint for single owner per organization
-- ============================================================================

-- Create unique partial index: only one owner per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_organization
ON organization_members(organization_id)
WHERE role = 'owner';

-- ============================================================================
-- Step 3: Create trigger to prevent removing last owner
-- ============================================================================

-- Function to check if removing the last owner
CREATE OR REPLACE FUNCTION check_last_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when deleting an owner or changing owner role
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN

    -- Check if this is the only owner
    IF (SELECT COUNT(*) FROM organization_members
        WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND id != OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner of the organization. Transfer ownership first.';
    END IF;
  END IF;

  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger for DELETE operations
DROP TRIGGER IF EXISTS prevent_last_owner_deletion ON organization_members;
CREATE TRIGGER prevent_last_owner_deletion
BEFORE DELETE ON organization_members
FOR EACH ROW EXECUTE FUNCTION check_last_owner();

-- Trigger for UPDATE operations (role changes)
DROP TRIGGER IF EXISTS prevent_last_owner_demotion ON organization_members;
CREATE TRIGGER prevent_last_owner_demotion
BEFORE UPDATE OF role ON organization_members
FOR EACH ROW EXECUTE FUNCTION check_last_owner();

-- ============================================================================
-- Step 4: Comments for documentation
-- ============================================================================

COMMENT ON TABLE ownership_transfer_requests IS 'Tracks ownership transfer requests between users';
COMMENT ON TABLE ownership_transfer_audit IS 'Audit log for all ownership transfer events';
COMMENT ON INDEX idx_one_owner_per_organization IS 'Ensures only one owner per organization';
COMMENT ON FUNCTION check_last_owner IS 'Prevents removing or demoting the last owner of an organization';
