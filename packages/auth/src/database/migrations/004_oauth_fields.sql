-- Migration: Add OAuth fields to users table
-- Date: 2025-01-20
-- Description: Support social login via Google, GitHub, etc.

-- Add OAuth-related columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS oauth_avatar_url TEXT;

-- Create index for faster OAuth user lookup
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id
  ON users(oauth_provider, oauth_provider_id);

-- Create index for email lookup (used in social auth)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Add comment
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name (google, github, etc.)';
COMMENT ON COLUMN users.oauth_provider_id IS 'Unique ID from OAuth provider';
COMMENT ON COLUMN users.oauth_avatar_url IS 'Profile picture URL from OAuth provider';
