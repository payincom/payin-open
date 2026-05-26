/**
 * Database schema definitions for Auth module
 */

/**
 * Users table schema
 */
export const SCHEMA_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_superadmin BOOLEAN NOT NULL DEFAULT false,


  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_superadmin ON users(is_superadmin) WHERE is_superadmin = true;
`;

/**
 * Sessions table schema
 */
export const SCHEMA_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`;

/**
 * Audit logs table schema
 */
export const SCHEMA_AUDIT_LOGS = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER,
  duration INTEGER,
  error TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
`;

/**
 * Organizations table schema
 */
export const SCHEMA_ORGANIZATIONS = `
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan_type);
`;

/**
 * Organization Members table schema
 */
export const SCHEMA_ORGANIZATION_MEMBERS = `
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role and permissions
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Invitation status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by VARCHAR(255) REFERENCES users(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_active ON organization_members(organization_id, user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);

-- Single owner constraint: only one owner per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_organization
ON organization_members(organization_id)
WHERE role = 'owner';
`;

/**
 * API Keys table schema
 */
export const SCHEMA_API_KEYS = `
CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- API Key identification
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,

  -- Metadata
  name VARCHAR(100) NOT NULL,

  -- Status management
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_org_active ON api_keys(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
`;

/**
 * Ownership Transfer Requests table schema
 */
export const SCHEMA_OWNERSHIP_TRANSFER_REQUESTS = `
CREATE TABLE IF NOT EXISTS ownership_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  to_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed', 'cancelled')),
  initiated_by VARCHAR(255) NOT NULL REFERENCES users(id),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_organization ON ownership_transfer_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_from_user ON ownership_transfer_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_to_user ON ownership_transfer_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON ownership_transfer_requests(status);
`;

/**
 * Ownership Transfer Audit table schema
 */
export const SCHEMA_OWNERSHIP_TRANSFER_AUDIT = `
CREATE TABLE IF NOT EXISTS ownership_transfer_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id UUID NOT NULL REFERENCES ownership_transfer_requests(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  performed_by VARCHAR(255) REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_transfer_audit_request ON ownership_transfer_audit(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_action ON ownership_transfer_audit(action);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_timestamp ON ownership_transfer_audit(timestamp);
`;

/**
 * Trigger function and triggers for preventing last owner removal
 */
/**
 * Email verifications table schema
 */
export const SCHEMA_EMAIL_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
`;

export const SCHEMA_OWNER_PROTECTION_TRIGGERS = `
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
`;

/**
 * All schemas in creation order (respecting foreign key dependencies)
 */
export const ALL_SCHEMAS = [
  SCHEMA_USERS,
  SCHEMA_SESSIONS,
  SCHEMA_EMAIL_VERIFICATIONS,
  SCHEMA_AUDIT_LOGS,
  SCHEMA_ORGANIZATIONS,
  SCHEMA_ORGANIZATION_MEMBERS,
  SCHEMA_API_KEYS,
  SCHEMA_OWNERSHIP_TRANSFER_REQUESTS,
  SCHEMA_OWNERSHIP_TRANSFER_AUDIT,
  SCHEMA_OWNER_PROTECTION_TRIGGERS,
];

/**
 * Table names for checking existence
 */
export const TABLE_NAMES = [
  'users',
  'sessions',
  'email_verifications',
  'audit_logs',
  'organizations',
  'organization_members',
  'api_keys',
  'ownership_transfer_requests',
  'ownership_transfer_audit',
] as const;

export type TableName = typeof TABLE_NAMES[number];
