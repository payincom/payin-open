/**
 * Organization-related type definitions
 */

/**
 * Organization role in the context of multi-tenancy
 */
export enum OrganizationRole {
  OWNER = 'owner',      // Organization creator, full permissions
  ADMIN = 'admin',      // Administrator, all permissions except org deletion
  MEMBER = 'member',    // Regular member, can create orders and view data
  VIEWER = 'viewer'     // Read-only member
}

/**
 * Organization plan types
 */
export enum OrganizationPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

/**
 * Organization member status
 */
export enum MemberStatus {
  PENDING = 'pending',     // Invitation sent but not accepted
  ACTIVE = 'active',       // Active member
  SUSPENDED = 'suspended'  // Temporarily suspended
}

/**
 * Organization entity
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  website?: string;
  description?: string;
  planType: OrganizationPlan;
  monthlyOrderLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization member entity
 */
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: MemberStatus;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt: Date;
  createdAt: Date;
}

/**
 * Organization with member info (for API responses)
 */
export interface OrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  planType: OrganizationPlan;
  role: OrganizationRole;
  memberStatus: MemberStatus;
  createdAt: Date;
}

/**
 * Create organization input
 */
export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  website?: string;
  description?: string;
}

/**
 * Update organization input
 */
export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  avatarUrl?: string;
  website?: string;
  description?: string;
  planType?: OrganizationPlan;
  monthlyOrderLimit?: number;
}

/**
 * Invite member input
 */
export interface InviteMemberInput {
  email: string;
  role: OrganizationRole;
}

/**
 * Update member input
 */
export interface UpdateMemberInput {
  role?: OrganizationRole;
  status?: MemberStatus;
}

/**
 * User session with organization context
 */
export interface UserSession {
  userId: string;
  username: string;
  currentOrgId: string;
  organizations: OrganizationWithRole[];
}

/**
 * Organization membership verification result
 */
export interface MembershipVerificationResult {
  valid: boolean;
  role?: OrganizationRole;
  status?: MemberStatus;
  error?: string;
}

/**
 * Ownership transfer request status
 */
export enum TransferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Ownership transfer request entity
 */
export interface OwnershipTransferRequest {
  id: string;
  organizationId: string;
  fromUserId: string;
  toUserId: string;
  status: TransferStatus;
  initiatedBy: string;
  message?: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Initiate ownership transfer input
 */
export interface InitiateTransferInput {
  toUserId: string;
  message?: string;
  expiresInDays?: number; // Default 7 days
}

/**
 * Organization permissions are now defined in permissions.ts
 * @see ../permissions.ts for ORGANIZATION_ROLE_PERMISSIONS and related functions
 * @deprecated Use hasOrganizationPermission from permissions.ts instead
 */
