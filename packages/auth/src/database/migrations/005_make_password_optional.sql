/**
 * Migration: Make password_hash optional and add auth_type
 *
 * This migration supports multiple authentication methods:
 * - password: Traditional username/password login
 * - oauth: Social login (Google, GitHub, etc.)
 * - magic_link: Email magic link (Supabase OTP)
 */

-- 1. Make password_hash optional (allow NULL)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add auth_type column to track authentication method
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) DEFAULT 'password'
  CHECK (auth_type IN ('password', 'oauth', 'magic_link'));

-- 3. Update existing users with auth_type based on oauth_provider
UPDATE users
SET auth_type = CASE
  WHEN oauth_provider IS NOT NULL THEN 'oauth'
  ELSE 'password'
END
WHERE auth_type IS NULL OR auth_type = 'password';

-- 4. Create index for auth_type queries
CREATE INDEX IF NOT EXISTS idx_users_auth_type ON users(auth_type);

-- 5. Add comments for documentation
COMMENT ON COLUMN users.password_hash IS 'Password hash (optional, NULL for OAuth/magic link users)';
COMMENT ON COLUMN users.auth_type IS 'Authentication method: password, oauth, or magic_link';
