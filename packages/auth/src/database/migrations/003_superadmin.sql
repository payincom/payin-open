-- ============================================
-- PayIn Super Admin Migration
-- Version: 003
-- Description: Add super admin support for global config management
-- ============================================

BEGIN;

-- ============================================
-- Step 1: Add is_superadmin column to users table
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

-- Add index for super admin queries (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_users_superadmin
  ON users(is_superadmin)
  WHERE is_superadmin = true;

-- Add comment for documentation
COMMENT ON COLUMN users.is_superadmin IS 'System-wide super admin flag for global configuration management';

-- ============================================
-- Step 2: Create super admin helper functions
-- ============================================

-- Function to check if a user is super admin
CREATE OR REPLACE FUNCTION is_user_superadmin(p_user_id VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id AND is_superadmin = true AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get super admin count
CREATE OR REPLACE FUNCTION get_superadmin_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM users WHERE is_superadmin = true AND is_active = true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Step 3: Audit logging for super admin changes
-- ============================================

-- Function to log super admin changes
CREATE OR REPLACE FUNCTION log_superadmin_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_superadmin != NEW.is_superadmin) THEN
    -- Log the change in audit_logs
    INSERT INTO audit_logs (
      user_id,
      username,
      action,
      resource,
      resource_id,
      method,
      path,
      request_body,
      created_at
    ) VALUES (
      NEW.id,
      NEW.username,
      CASE WHEN NEW.is_superadmin THEN 'GRANT_SUPERADMIN' ELSE 'REVOKE_SUPERADMIN' END,
      'user',
      NEW.id,
      'UPDATE',
      '/api/users/' || NEW.id || '/superadmin',
      jsonb_build_object(
        'old_value', OLD.is_superadmin,
        'new_value', NEW.is_superadmin,
        'timestamp', NOW()
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for super admin changes
DROP TRIGGER IF EXISTS audit_superadmin_changes ON users;
CREATE TRIGGER audit_superadmin_changes
  AFTER UPDATE OF is_superadmin ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_superadmin_change();

-- ============================================
-- Step 4: Optional - Create initial super admin
-- ============================================
-- Note: This should be done manually in production for security
-- Uncomment and modify the following if you want to create an initial super admin:

/*
UPDATE users
SET is_superadmin = true
WHERE username = 'admin'  -- Replace with your admin username
  AND is_active = true;
*/

COMMIT;

-- ============================================
-- Verification queries (run separately)
-- ============================================

-- Check super admins
-- SELECT id, username, email, is_superadmin, is_active, created_at
-- FROM users
-- WHERE is_superadmin = true;

-- Check super admin count
-- SELECT get_superadmin_count() as superadmin_count;

-- Test super admin check function
-- SELECT is_user_superadmin('user_id_here') as is_superadmin;
