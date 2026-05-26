-- ============================================
-- PayIn Multi-Tenancy Migration
-- Version: 001
-- Description: Add Organizations and Multi-tenancy support
-- ============================================

BEGIN;

-- ============================================
-- Step 1: Create Organizations table
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,

  -- Organization metadata
  avatar_url TEXT,
  website VARCHAR(255),
  description TEXT,

  -- Plan and limits
  plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  monthly_order_limit INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan_type);

-- ============================================
-- Step 2: Create Organization Members table
-- ============================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role and permissions
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Invitation status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by VARCHAR(255) REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_active ON organization_members(organization_id, user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);

-- ============================================
-- Step 3: Create merchant organization
-- ============================================
INSERT INTO organizations (id, name, slug, plan_type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'enterprise'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 4: Migrate existing users to merchant organization
-- ============================================
-- Set all existing users as owners of the merchant organization
INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT
  '00000000-0000-0000-0000-000000000001' AS organization_id,
  id AS user_id,
  'owner' AS role,
  'active' AS status
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = users.id
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- Step 5: Add organization_id to api_keys table
-- ============================================
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Migrate existing API keys to merchant organization
UPDATE api_keys
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Set NOT NULL constraint
ALTER TABLE api_keys
  ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_active ON api_keys(organization_id, is_active)
  WHERE is_active = true;

-- ============================================
-- Step 6: Add helper functions
-- ============================================

-- Function to generate unique organization slug
CREATE OR REPLACE FUNCTION generate_unique_slug(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
  counter INTEGER := 0;
  base_slug TEXT;
BEGIN
  -- Convert to lowercase and replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  -- Try base slug first
  slug := base_slug;

  -- If exists, append counter
  WHILE EXISTS (SELECT 1 FROM organizations WHERE organizations.slug = slug) LOOP
    counter := counter + 1;
    slug := base_slug || '-' || counter;
  END LOOP;

  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for organizations
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMIT;

-- ============================================
-- Verification queries (run separately)
-- ============================================

-- Check organizations
-- SELECT * FROM organizations;

-- Check organization members
-- SELECT om.*, u.username, o.name AS org_name
-- FROM organization_members om
-- JOIN users u ON om.user_id = u.id
-- JOIN organizations o ON om.organization_id = o.id;

-- Check API keys with organizations
-- SELECT ak.*, o.name AS org_name
-- FROM api_keys ak
-- JOIN organizations o ON ak.organization_id = o.id;
